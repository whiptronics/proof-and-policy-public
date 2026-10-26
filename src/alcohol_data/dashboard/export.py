"""Deterministic export of the canonical database for the local research dashboard (web/).

The dashboard reads only these files. Every value comes from the built DuckDB database or from a
curated, version-controlled CSV; nothing is typed in here. Output (default web/public/data/):

  manifest.json            schema, release, build, commits, generation time, row counts, file hashes
  geographies.json         jurisdictions in display order
  metrics.json             one entry per measure x period kind, with definitions and transform eligibility
  metrics/<id>.json        preferred observations for one metric (lazy-loaded), alternates, conversions
  coverage.json            coverage cells per metric and family, with explicit denominators
  policy.json              intervals, evidence, segments, ledger runs, snapshots, dependencies, exceptions
  sources.json             sources, held assets (with rights and local availability) and leads not held
  research.json            research gaps (ordered queue) and source leads
  deflators.json           CPI-U fiscal-year averages and the base, with input observation IDs
  cases.json               worked examples (config/dashboard/cases/*.yaml)
  analyses.json            saved analyses for the Explore view (config/dashboard/analyses/*.yaml)
  monthly.json             monthly series (Census MSRS changes, Utah DABS monthly reports, Utah sales tax rate)
  map.json                 one SVG outline per state (us-atlas, Albers USA)
  officials.json           reference data on officeholders and committees: source, license, snapshot, index
  officials/<code>.json    officeholder records and committees for one archive folder (state, dc, pr or us)
  cost_model.json          regression of Census state liquor-store expenditure on revenue (store_cost.py), for the scenario's avoidable-cost input
  reconciliation.json      Utah liquor-sales bridge (fiscal_bridge.py), findings with evidence status, Utah-peer comparison

Ordering is stable, so re-exporting unchanged inputs changes only manifest.json's generation time.
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
import subprocess
from collections import defaultdict
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import duckdb
import yaml

from alcohol_data import fiscal, paths, store_cost
from alcohol_data.dashboard import contracts as K
from alcohol_data.dashboard.transforms import BASE_YEAR, CPI_MEASURE, DENOMINATORS, METHODS, Converter
from alcohol_data.schemas import vocab

DEFAULT_OUT = paths.ROOT / "web" / "public" / "data"
LEGAL_DIR = paths.METADATA_DIR / "legal_history"

OBS_COLUMNS = [
    "observation_id",
    "geo_id",
    "period_label",
    "period_start",
    "period_end",
    "year",
    "value",
    "missing_reason",
    "estimate_type",
    "extraction_method",
    "review_status",
    "comparability_group",
    "quality_flags",
    "asset_id",
    "source_locator",
    "source_series",
    "source_vintage",
    "candidate_count",
    "selection_reason",
    "ci_low",
    "ci_high",
    "ci_level",
    "realized_ci_low",
    "realized_ci_high",
    "sample_size",
    "suppression_flag",
    "raw_value",
    "raw_unit",
    "multiplier",
    "footnote",
    "transform_id",
    "input_ids",
    "cell",
    "open_page",
]
CONVERSION_COLUMNS = ["kind", "value", "missing", "inputs"]
GEO_ORDER = {"state": 0, "nation": 1, "census_region": 2}


def _default(o):
    if isinstance(o, (date, datetime)):
        return o.isoformat()
    raise TypeError(type(o))


def _dump(obj) -> bytes:
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"), default=_default).encode("utf-8")


def _git_head() -> str | None:
    try:
        sha = subprocess.run(
            ["git", "rev-parse", "HEAD"], cwd=paths.ROOT, capture_output=True, text=True, check=True
        ).stdout.strip()
        dirty = subprocess.run(
            ["git", "status", "--porcelain"], cwd=paths.ROOT, capture_output=True, text=True, check=True
        ).stdout.strip()
        return sha + ("-dirty" if dirty else "")
    except (OSError, subprocess.CalledProcessError):
        return None


def metric_id(measure_id: str, period_kind: str) -> str:
    return f"{measure_id}@{period_kind}"


def metric_file(mid: str) -> str:
    return "metrics/" + mid.replace("@", ".") + ".json"


def cell_code(value, missing_reason, extraction_method, review_status) -> str:
    """Coverage state of one observation (see contracts.CELL_STATES)."""
    if value is not None:
        if value == 0:
            return "0"
        if extraction_method == "computed":
            return "D"
        if extraction_method in ("manual", "ocr"):
            return "R" if review_status == "reviewed" else "U"
        return "S"
    if missing_reason == "unresolved_conflict":
        return "C"
    if missing_reason == "not_applicable":
        return "N"
    if missing_reason == "suppressed":
        return "W"
    return "M"


def _rows(con, sql, params=()):
    cur = con.execute(sql, params)
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, r, strict=True)) for r in cur.fetchall()]


def _local_file(asset_id: str, sha: str | None) -> Path | None:
    d = paths.RAW_DIR / asset_id
    if not sha or not d.is_dir():
        return None
    hits = sorted(p for p in d.glob(f"{sha[:16]}-*") if not p.name.endswith(".meta.json"))
    return hits[0] if hits else None


def _pdf_pages(path: Path | None) -> int | None:
    """Number of pages in a locally held PDF (None if not a PDF or not held)."""
    if path is None or path.suffix.lower() != ".pdf":
        return None
    try:
        import pypdf

        logging.getLogger("pypdf").setLevel(logging.ERROR)
        return len(pypdf.PdfReader(str(path)).pages)
    except Exception:  # noqa: BLE001 - an unreadable PDF just gets no page links
        return None


# Project locator convention: "page N" counts pages of the file (1 = first page), which is what a PDF
# viewer's #page=N opens; "printed page N" is the number printed on a book page and is not linked to a
# file page. Checked against the content of the Tennessee chapter and the DABS reports on 2026-10-07.
PAGE_RE = re.compile(r"^page (\d+)\b")


log = logging.getLogger(__name__)


def topology_paths(topo: dict, obj: str) -> tuple[dict[str, str], dict[str, list[float]]]:
    """Decode a quantized TopoJSON object into SVG path strings and a label point per feature id.

    Arcs are delta-encoded integer positions; transform.scale and transform.translate map them to the
    projected plane. A negative arc index ~i means arc i reversed. The label point is the area-weighted
    centroid of the feature's largest ring."""
    sx, sy = topo["transform"]["scale"]
    tx, ty = topo["transform"]["translate"]
    arcs = []
    for arc in topo["arcs"]:
        x = y = 0
        pts = []
        for dx, dy in arc:
            x += dx
            y += dy
            pts.append((x * sx + tx, y * sy + ty))
        arcs.append(pts)

    def ring(indexes: list[int]) -> list[tuple[float, float]]:
        pts: list[tuple[float, float]] = []
        for i in indexes:
            seg = arcs[i] if i >= 0 else arcs[~i][::-1]
            pts.extend(seg[1:] if pts else seg)
        return pts

    def area_centroid(pts):
        a = cx = cy = 0.0
        for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1], strict=True):
            cross = x0 * y1 - x1 * y0
            a += cross
            cx += (x0 + x1) * cross
            cy += (y0 + y1) * cross
        if a == 0:
            return 0.0, (pts[0] if pts else (0.0, 0.0))
        return abs(a) / 2, (cx / (3 * a), cy / (3 * a))

    paths_out: dict[str, str] = {}
    labels: dict[str, list[float]] = {}
    for g in topo["objects"][obj]["geometries"]:
        polys = g["arcs"] if g["type"] == "MultiPolygon" else [g["arcs"]] if g["type"] == "Polygon" else []
        parts, best = [], (-1.0, (0.0, 0.0))
        for poly in polys:
            for k, r in enumerate(poly):
                pts = ring(r)
                if not pts:
                    continue
                parts.append("M" + "L".join(f"{x:.1f},{y:.1f}" for x, y in pts) + "Z")
                if k == 0:
                    area, c = area_centroid(pts)
                    if area > best[0]:
                        best = (area, c)
        paths_out[str(g["id"])] = "".join(parts)
        labels[str(g["id"])] = [round(best[1][0], 1), round(best[1][1], 1)]
    return paths_out, labels


def page_link(url: str | None, locator: str | None, fmt: str | None, pages: int | None) -> str | None:
    """Publisher URL, opened at the cited file page when the locator is 'page N' of a PDF."""
    if not url:
        return None
    m = PAGE_RE.match((locator or "").strip())
    if m and fmt == "pdf" and (pages is None or int(m.group(1)) <= pages):
        return f"{url}#page={m.group(1)}"
    return url


class Export:
    def __init__(self, out_dir: Path, db_path: Path):
        self.out = out_dir
        self.con = duckdb.connect(str(db_path), read_only=True)
        self.files: dict[str, dict] = {}
        self.counts: dict[str, int] = {}
        self.build = dict(self.con.execute("SELECT key, value FROM build_info").fetchall())
        self.as_of = date.fromisoformat(self.build["as_of_date"])
        self._page_cache: dict[str, int | None] = {}

    def catalog(self) -> dict[str, tuple[str, str, str]]:
        """dimension_id -> (label, domain, outlet) from the canonical policy catalog."""
        if not hasattr(self, "_catalog"):
            self._catalog = {
                r[0]: (r[1], r[2], r[3])
                for r in self.con.execute(
                    "SELECT dimension_id, label, domain, outlet FROM policy_dimensions"
                ).fetchall()
            }
        return self._catalog

    def write(self, rel: str, obj) -> None:
        data = _dump(obj)
        p = self.out / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data)
        self.files[rel] = {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}

    # ----- geographies -------------------------------------------------------------------------
    def geographies(self) -> list[dict]:
        rows = _rows(
            self.con,
            "SELECT geo_id, geo_level, official_code, name, abbreviation, in_default_panel FROM geographies",
        )
        region = {
            r["child_geo_id"]: r["parent_geo_id"]
            for r in _rows(self.con, "SELECT * FROM geography_relationships")
            if r["parent_geo_id"].startswith("census_region:")
        }
        for r in rows:
            r["region"] = region.get(r["geo_id"])
        rows.sort(key=lambda r: (GEO_ORDER.get(r["geo_level"], 9), r["name"]))
        self.geos = rows
        self.geo_ids = [r["geo_id"] for r in rows]
        self.write("geographies.json", rows)
        self.counts["geographies"] = len(rows)
        return rows

    # ----- metrics and observations ------------------------------------------------------------
    def metrics(self) -> None:
        measures = {r["measure_id"]: r for r in _rows(self.con, "SELECT * FROM measures")}
        obs = _rows(
            self.con,
            """
            SELECT p.*, d.ci_low, d.ci_high, d.ci_level,
                   -- FARS imputed deaths: the interval for the deaths that occurred (imputation only), kept
                   -- apart from ci_low/ci_high, which are for the underlying expected number.
                   TRY_CAST(json_extract_string(d.extra, '$.realized_total.ci_low') AS DOUBLE) AS realized_ci_low,
                   TRY_CAST(json_extract_string(d.extra, '$.realized_total.ci_high') AS DOUBLE) AS realized_ci_high,
                   d.sample_size, d.suppression_flag, d.raw_value,
                   d.raw_unit, d.multiplier, d.footnote,
                   CASE WHEN p.extraction_method = 'computed' THEN l.transform_id END AS transform_id,
                   CASE WHEN p.extraction_method = 'computed' THEN l.input_ids END AS input_ids
            FROM preferred_observations p
            LEFT JOIN observation_details d USING (observation_id)
            LEFT JOIN lineage l ON l.output_id = p.observation_id AND l.output_table = 'observations'
            WHERE p.period_kind <> 'month' AND p.subgroup = 'all'
            ORDER BY p.measure_id, p.period_kind, p.geo_id, p.period_start, p.observation_id
            """,
        )
        # Competing candidates that report a different value from the preferred one (revisions, conflicts).
        alternates = _rows(
            self.con,
            """
            WITH pref AS (SELECT cell_key, observation_id AS pref_id FROM preferred_selection WHERE rank = 1)
            SELECT pref.pref_id, s.rank, s.reason, o.observation_id, o.value, o.missing_reason, o.source_series,
                   o.source_vintage, o.asset_id, o.source_locator, po.value AS pref_value
            FROM preferred_selection s
            JOIN pref USING (cell_key)
            JOIN observations o ON o.observation_id = s.observation_id
            JOIN observations po ON po.observation_id = pref.pref_id
            WHERE s.rank > 1 AND (o.value IS DISTINCT FROM po.value)
            ORDER BY pref.pref_id, s.rank, o.observation_id
            """,
        )
        # Unresolved conflicts have no rank-1 value; list every candidate for those cells.
        conflicts = _rows(
            self.con,
            """
            SELECT p.observation_id AS pref_id, s.rank, s.reason, o.observation_id, o.value, o.missing_reason,
                   o.source_series, o.source_vintage, o.asset_id, o.source_locator
            FROM preferred_observations p
            JOIN preferred_selection s ON s.cell_key = p.geo_id || '|' || p.measure_id || '|' || p.period_start
                 || '|' || p.period_end || '|' || p.subgroup
            JOIN observations o ON o.observation_id = s.observation_id
            WHERE p.missing_reason = 'unresolved_conflict'
            ORDER BY p.observation_id, s.rank, o.observation_id
            """,
        )
        alt_by_pref: dict[str, list] = defaultdict(list)
        for a in alternates + conflicts:
            alt_by_pref[a["pref_id"]].append(
                [
                    a["observation_id"],
                    a["value"],
                    a["missing_reason"],
                    a["source_series"],
                    a["source_vintage"],
                    a["asset_id"],
                    a["source_locator"],
                    a["reason"],
                ]
            )

        # Conversion inputs: CPI-U months and Census July 1 populations (preferred values only).
        cpi = {
            (r["period_start"].year, r["period_start"].month): (r["value"], r["observation_id"])
            for r in _rows(
                self.con,
                "SELECT * FROM preferred_observations WHERE measure_id = ? AND geo_id = 'nation:us' "
                "AND period_kind = 'month'",
                (CPI_MEASURE,),
            )
        }
        pop = {
            (r["measure_id"], r["geo_id"], r["period_start"]): (r["value"], r["observation_id"])
            for r in _rows(
                self.con,
                "SELECT * FROM preferred_observations WHERE period_kind = 'point_in_time' AND measure_id IN (?, ?)",
                tuple(m for m, _ in DENOMINATORS.values()),
            )
        }
        conv = Converter(cpi, pop)

        by_metric: dict[str, list[dict]] = defaultdict(list)
        obs_metric: dict[str, str] = {}
        for o in obs:
            mid = metric_id(o["measure_id"], o["period_kind"])
            by_metric[mid].append(o)
            obs_metric[o["observation_id"]] = mid
        cpi_ids = {oid for _, oid in cpi.values()}
        # Monthly rows (the DABS fiscal-year sums' inputs) are in monthly/<measure>.json, not in a metric
        # file; a derived value names them "monthly:<measure>" so the record drawer can find them.
        monthly_metric = {
            r["observation_id"]: f"monthly:{r['measure_id']}"
            for r in _rows(
                self.con,
                "SELECT observation_id, measure_id FROM preferred_observations "
                "WHERE period_kind = 'month' AND subgroup = 'all'",
            )
        }

        self.metric_meta: dict[str, dict] = {}
        self.cells: dict[str, dict[str, dict[int, str]]] = {}
        total_rows = 0
        for mid in sorted(by_metric):
            rows = by_metric[mid]
            m = measures[rows[0]["measure_id"]]
            family = K.SOURCE_FAMILY_TO_FAMILY.get(m["source_family"], "context")
            if m["fiscal_component"]:
                family = "fiscal"
            convertible, why_not = self._convertible(m, rows[0]["period_kind"])
            table, cells, conversions = [], defaultdict(dict), {}
            for o in rows:
                code = cell_code(o["value"], o["missing_reason"], o["extraction_method"], o["review_status"])
                prev = cells[o["geo_id"]].get(o["year"])
                if prev is not None and prev != code:
                    code = "C" if "C" in (prev, code) else prev  # two cells in one year: keep the first
                cells[o["geo_id"]][o["year"]] = code
                pm = PAGE_RE.match((o["source_locator"] or "").strip())
                row = {
                    **o,
                    "input_ids": K.split(o["input_ids"]),
                    "cell": code,
                    "open_page": int(pm.group(1)) if pm else None,
                }
                table.append([row.get(c) for c in OBS_COLUMNS])
                if convertible and o["geo_id"].startswith("state:"):
                    c = conv.convert(o)
                    conversions[o["observation_id"]] = [
                        [kind, c[kind]["value"], c[kind]["missing"], c[kind]["inputs"]] for kind in sorted(c)
                    ]
            input_metrics = set()
            for o in rows:
                for i in K.split(o["input_ids"]):
                    input_metrics.add(
                        "deflators"
                        if i in cpi_ids
                        else obs_metric.get(i) or monthly_metric.get(i, "unresolved")
                    )
            if conversions:
                input_metrics |= {
                    "deflators",
                    *(metric_id(m, "point_in_time") for m, _ in DENOMINATORS.values()),
                }
            input_metrics.discard(mid)
            years = sorted({o["year"] for o in rows})
            geo_levels = sorted({self._level(o["geo_id"]) for o in rows})
            meta = {
                "metric_id": mid,
                "measure_id": m["measure_id"],
                "period_kind": rows[0]["period_kind"],
                "family": family,
                "label": m["label"],
                "definition": m["definition"],
                "unit": m["unit"],
                "value_kind": m["value_kind"],
                "beverage": m["beverage"],
                "age_universe": m["age_universe"],
                "recall_period": m["recall_period"],
                "numerator": m["numerator"],
                "denominator": m["denominator"],
                "method_family": m["method_family"],
                "source_family": m["source_family"],
                "causal_outcome_eligible": m["causal_outcome_eligible"],
                "fiscal_component": m["fiscal_component"],
                "government_level": m["government_level"],
                "accounting_basis": m["accounting_basis"],
                "costs_subtracted": m["costs_subtracted"],
                "overlap_note": m["overlap_note"],
                "notes": m["notes"],
                "first_year": years[0],
                "last_year": years[-1],
                "years_with_rows": years,
                "geo_levels": geo_levels,
                "geo_count": len({o["geo_id"] for o in rows}),
                "rows": len(rows),
                "values": sum(1 for o in rows if o["value"] is not None),
                "zeros": sum(1 for o in rows if o["value"] == 0),
                "comparability_groups": sorted({o["comparability_group"] for o in rows}),
                "source_series": sorted({o["source_series"] for o in rows}),
                "asset_ids": sorted({o["asset_id"] for o in rows}),
                "file": metric_file(mid),
                "conversions": sorted(METHODS) if convertible else [],
                "conversions_unavailable_reason": why_not,
                "input_metrics": sorted(input_metrics),
            }
            self.metric_meta[mid] = meta
            self.cells[mid] = cells
            self.write(
                meta["file"],
                {
                    "metric_id": mid,
                    "columns": OBS_COLUMNS,
                    "rows": table,
                    "alternate_columns": [
                        "observation_id",
                        "value",
                        "missing_reason",
                        "source_series",
                        "source_vintage",
                        "asset_id",
                        "source_locator",
                        "selection_reason",
                    ],
                    "alternates": {
                        o["observation_id"]: alt_by_pref[o["observation_id"]]
                        for o in rows
                        if o["observation_id"] in alt_by_pref
                    },
                    "conversion_columns": CONVERSION_COLUMNS,
                    "conversions": conversions,
                },
            )
            total_rows += len(rows)
        self.counts["observations_exported"] = total_rows
        self.counts["metrics"] = len(self.metric_meta)
        self.write(
            "metrics.json",
            {
                "families": {k: {"label": v[0], "description": v[1]} for k, v in K.FAMILIES.items()},
                "metrics": [self.metric_meta[k] for k in sorted(self.metric_meta)],
                "conversion_methods": METHODS,
                "denominators": {k: {"measure_id": v[0], "label": v[1]} for k, v in DENOMINATORS.items()},
                "fiscal_year_rules": [
                    {
                        "geo_id": r.geo_id,
                        "fy_end_month": r.month,
                        "fy_end_day": r.day,
                        "valid_from_fy": r.valid_from,
                        "valid_to_fy": r.valid_to,
                        "evidence": r.evidence,
                        "verified": r.verified,
                    }
                    for r in fiscal.rules()
                ],
            },
        )
        self.write(
            "deflators.json",
            {
                "measure_id": CPI_MEASURE,
                "base": {
                    "key": f"cpi_base:{BASE_YEAR}",
                    "label": f"CPI-U average of calendar {BASE_YEAR}",
                    "value": conv.base,
                    "observation_ids": conv.base_ids,
                },
                "periods": dict(sorted(conv.deflators.items())),
                "months": {
                    oid: {"month": f"{y}-{m:02d}", "value": v} for (y, m), (v, oid) in sorted(cpi.items())
                },
            },
        )

    def _level(self, geo_id: str) -> str:
        return geo_id.split(":")[0]

    def _convertible(self, m: dict, period_kind: str) -> tuple[bool, str | None]:
        if m["unit"] != "usd_nominal":
            return (
                False,
                f"Unit is {m['unit']}; constant-dollar and per-person conversions apply to nominal dollar amounts only.",
            )
        if period_kind not in ("state_fiscal_year", "calendar_year"):
            return False, "Conversions are defined for fiscal-year and calendar-year amounts only."
        return True, None

    # ----- coverage ----------------------------------------------------------------------------
    def coverage(self) -> None:
        metrics_out = {}
        fam_metrics: dict[str, list[str]] = defaultdict(list)
        for mid, meta in self.metric_meta.items():
            cells = self.cells[mid]
            y0, y1 = meta["first_year"], meta["last_year"]
            span_years = set(meta["years_with_rows"])
            grid = {}
            for geo in self.geo_ids:
                if geo not in cells:
                    continue
                grid[geo] = "".join(
                    cells[geo].get(y, "." if y in span_years else " ") for y in range(y0, y1 + 1)
                )
            metrics_out[mid] = {"first_year": y0, "last_year": y1, "rows": grid}
            fam_metrics[meta["family"]].append(mid)

        # Policy: one "metric" per jurisdiction x dimension, from verified segments, by calendar year.
        segs = _rows(
            self.con, "SELECT * FROM policy_segments ORDER BY geo_id, policy_dimension, segment_start"
        )
        local = {
            r["policy_id"]
            for r in _rows(self.con, "SELECT policy_id FROM policy_events WHERE requires_local_adoption")
        }
        policy_cells: dict[str, dict[str, dict[int, dict]]] = defaultdict(lambda: defaultdict(dict))
        by_dim = defaultdict(list)
        for s in segs:
            by_dim[(s["policy_dimension"], s["geo_id"])].append(s)
        y_first = min(s["segment_start"].year for s in segs)
        y_last = self.as_of.year
        for (dim, geo), ss in sorted(by_dim.items()):
            for y in range(y_first, y_last + 1):
                start, end = date(y, 1, 1), date(y, 12, 31)
                total = (end - start).days + 1
                future = max(0, (end - max(self.as_of + timedelta(days=1), start)).days + 1)
                known = local_days = 0
                for s in ss:
                    a, b = max(s["segment_start"], start), min(s["segment_end"], end)
                    if a > b or s["state"] in ("unknown", "disputed"):
                        continue
                    n = (b - a).days + 1
                    known += n
                    if set(K.split(s["policy_ids"])) & local:
                        local_days += n
                past = total - future
                if future:
                    code = "F"
                elif known == past and local_days:
                    code = "L"
                elif known == past:
                    code = "K"
                elif known:
                    code = "P"
                else:
                    code = "?"
                policy_cells[dim][geo][y] = {
                    "code": code,
                    "known_days": known,
                    "days": total,
                    "future_days": future,
                    "local_option_days": local_days,
                }
        for dim, geos in sorted(policy_cells.items()):
            mid = f"policy:{dim}"
            rows = {
                geo: "".join(geos[geo][y]["code"] for y in range(y_first, y_last + 1))
                for geo in self.geo_ids
                if geo in geos
            }
            label, category, outlet = self.catalog().get(dim, (dim, "other", ""))
            metrics_out[mid] = {
                "first_year": y_first,
                "last_year": y_last,
                "rows": rows,
                "label": label,
                "days": {
                    geo: [
                        [y, v["known_days"], v["days"], v["future_days"], v["local_option_days"]]
                        for y, v in sorted(cells.items())
                    ]
                    for geo, cells in sorted(geos.items())
                },
            }
            fam_metrics["policy"].append(mid)

        # Family counts: per jurisdiction-year, metrics with a value / metrics defined for it.
        # "Defined" = the metric has a row for this jurisdiction in some year AND a row for some
        # jurisdiction in this year. Explicit denominator; no percent-complete over an undefined universe.
        families = {}
        for fam, mids in sorted(fam_metrics.items()):
            y0 = min(metrics_out[m]["first_year"] for m in mids)
            y1 = max(metrics_out[m]["last_year"] for m in mids)
            out_rows = {}
            for geo in self.geo_ids:
                have, defined, unreviewed, conflict = [], [], [], []
                any_defined = False
                for y in range(y0, y1 + 1):
                    h = d = u = c = 0
                    for m in sorted(mids):
                        cov = metrics_out[m]
                        row = cov["rows"].get(geo)
                        if row is None or not (cov["first_year"] <= y <= cov["last_year"]):
                            continue
                        code = row[y - cov["first_year"]]
                        if code == " ":
                            continue
                        d += 1
                        if code in K.VALUE_CODES or code in ("K", "L"):
                            h += 1
                        if code == "U":
                            u += 1
                        if code == "C":
                            c += 1
                    have.append(h)
                    defined.append(d)
                    unreviewed.append(u)
                    conflict.append(c)
                    any_defined |= d > 0
                if any_defined:
                    out_rows[geo] = {
                        "have": have,
                        "defined": defined,
                        "unreviewed": unreviewed,
                        "conflict": conflict,
                    }
            families[fam] = {"first_year": y0, "last_year": y1, "metrics": sorted(mids), "rows": out_rows}
        self.write(
            "coverage.json",
            {
                "states": {k: {"label": v[0], "description": v[1]} for k, v in K.CELL_STATES.items()},
                "value_codes": sorted(K.VALUE_CODES | {"K", "L"}),
                "metrics": dict(sorted(metrics_out.items())),
                "families": families,
                "denominator_rule": (
                    "A metric counts toward a jurisdiction-year's denominator when the dataset has a row for "
                    "that jurisdiction in some year and a row for some jurisdiction in that year. The numerator "
                    "counts metrics with a value (sourced, derived, transcribed or an observed zero); for policy, "
                    "dimensions whose status is verified on every day of the year."
                ),
            },
        )
        self.counts["coverage_metrics"] = len(metrics_out)

    # ----- policy ------------------------------------------------------------------------------
    def policy(self) -> None:
        events = _rows(self.con, "SELECT * FROM policy_events ORDER BY geo_id, policy_dimension, policy_id")
        evidence = _rows(
            self.con,
            """
            SELECT e.*, a.url AS asset_url, a.format AS asset_format, a.sha256 AS asset_sha256,
                   a.edition AS asset_edition, a.source_id, a.rights_status AS asset_rights_status
            FROM policy_evidence e JOIN source_assets a USING (asset_id) ORDER BY e.policy_id, e.evidence_id
            """,
        )
        deps = _rows(self.con, "SELECT * FROM claim_dependencies ORDER BY claim_id, provision, role")
        excs = _rows(self.con, "SELECT * FROM claim_exceptions ORDER BY claim_id, exception_id")
        segs = _rows(
            self.con, "SELECT * FROM policy_segments ORDER BY geo_id, policy_dimension, segment_start"
        )
        ledger = K.read_csv(LEGAL_DIR / "utah_code_claims.csv")
        snapshots = _rows(
            self.con,
            "SELECT * FROM policy_snapshots ORDER BY geo_id, policy_dimension, observed_year, snapshot_id",
        )
        overlay = {r["policy_id"]: r for r in K.read_csv(K.POLICY_DATES_CSV)}
        try:
            from alcohol_data.legal.utah_code import INTERVAL_CLAIMS
        except ImportError:  # pragma: no cover
            INTERVAL_CLAIMS = {}

        for ev in evidence:
            path = _local_file(ev["asset_id"], ev["asset_sha256"])
            ev["open_url"] = page_link(
                ev["asset_url"], ev["locator"], ev["asset_format"], self._pages(ev["asset_id"], path)
            )
            ev["page"] = int(m.group(1)) if (m := PAGE_RE.match((ev["locator"] or "").strip())) else None
        ev_by_policy = defaultdict(list)
        for ev in evidence:
            ev_by_policy[ev["policy_id"]].append(ev)
        policy_ids = {e["policy_id"] for e in events}
        for e in events:
            label, category, outlet = self.catalog().get(
                e["policy_dimension"], (e["policy_dimension"], "other", "")
            )
            e["dimension_label"], e["category"], e["outlet"] = label, category, outlet
            o = overlay.get(e["policy_id"], {})
            e["operational_start"] = o.get("operational_start") or None
            e["operational_precision"] = o.get("operational_precision") or "unknown"
            e["operational_note"] = o.get("operational_note") or "Not recorded."
            e["evidence"] = ev_by_policy.get(e["policy_id"], [])
            e["ledger_claims"] = INTERVAL_CLAIMS.get(e["policy_id"], [])
            e["dependencies"] = [d for d in deps if d["claim_id"] == e["policy_id"]]
            e["exceptions"] = [x for x in excs if x["claim_id"] == e["policy_id"]]
        for s in snapshots:
            if s["policy_id"] and s["policy_id"] not in policy_ids:
                raise ValueError(f"snapshot {s['snapshot_id']} names unknown policy {s['policy_id']}")
        for pid in overlay:
            if pid not in policy_ids:
                raise ValueError(f"policy_dates_overlay names unknown policy {pid}")
        self.write(
            "policy.json",
            {
                "as_of_date": self.as_of,
                "as_of_timezone": self.build.get("as_of_timezone"),
                "dimensions": {
                    k: {"label": v[0], "category": v[1], "outlet": v[2]}
                    for k, v in sorted(self.catalog().items())
                },
                "categories": K.DOMAIN_LABELS,
                "events": events,
                "segments": segs,
                "ledger_runs": ledger,
                "snapshots": snapshots,
                "statuses": {
                    "temporal": vocab.TEMPORAL_STATUSES,
                    "legal_review": vocab.LEGAL_REVIEW_STATUSES,
                    "claim": vocab.CLAIM_STATUSES,
                    "extraction": vocab.EXTRACTION_STATUSES,
                },
            },
        )
        self.counts["policy_events"] = len(events)
        self.counts["policy_evidence"] = len(evidence)

    def _pages(self, asset_id: str, path: Path | None) -> int | None:
        if asset_id not in self._page_cache:
            self._page_cache[asset_id] = _pdf_pages(path)
        return self._page_cache[asset_id]

    # ----- sources -----------------------------------------------------------------------------
    def sources(self) -> None:
        sources = _rows(self.con, "SELECT * FROM sources ORDER BY source_id")
        assets = _rows(self.con, "SELECT * FROM source_assets ORDER BY source_id, asset_id")
        registry = {r["asset_id"]: r for r in K.read_csv(paths.METADATA_DIR / "source_registry.csv")}
        rights = {r["asset_id"]: r for r in K.read_csv(paths.METADATA_DIR / "rights_registry.csv")}
        obs_counts = defaultdict(dict)
        for r in _rows(
            self.con,
            "SELECT asset_id, measure_id, count(*) AS n, count(value) AS v, min(year) AS y0, max(year) AS y1 "
            "FROM observations GROUP BY ALL ORDER BY asset_id, measure_id",
        ):
            obs_counts[r["asset_id"]][r["measure_id"]] = {
                "rows": r["n"],
                "values": r["v"],
                "first_year": r["y0"],
                "last_year": r["y1"],
            }
        geos = defaultdict(set)
        for r in _rows(self.con, "SELECT DISTINCT asset_id, geo_id FROM observations"):
            geos[r["asset_id"]].add(r["geo_id"])
        evidence = defaultdict(list)
        for r in _rows(
            self.con,
            "SELECT e.asset_id, e.evidence_id, e.policy_id, p.geo_id FROM policy_evidence e "
            "JOIN policy_events p USING (policy_id) ORDER BY e.evidence_id",
        ):
            evidence[r["asset_id"]].append({"evidence_id": r["evidence_id"], "policy_id": r["policy_id"]})
            geos[r["asset_id"]].add(r["geo_id"])
        ledger_text = "\n".join(p.read_text(encoding="utf-8") for p in sorted(LEGAL_DIR.glob("*.csv")))
        for a in assets:
            reg, rt = registry.get(a["asset_id"], {}), rights.get(a["asset_id"], {})
            path = _local_file(a["asset_id"], a["sha256"])
            a["landing_url"] = reg.get("landing_url") or None
            a["title"] = reg.get("title") or None
            a["agency"] = reg.get("agency") or None
            a["access_method"] = reg.get("access_method") or None
            a["authentication"] = reg.get("authentication") or None
            a["update_frequency"] = reg.get("update_frequency") or None
            a["observed_first_year"] = reg.get("observed_first_year") or None
            a["observed_last_year"] = reg.get("observed_last_year") or None
            a["raw_retention"] = reg.get("raw_retention") or None
            a["extraction_status"] = reg.get("extraction_status") or None
            a["blockers"] = reg.get("blockers") or None
            a["next_action"] = reg.get("next_action") or None
            a["attribution"] = rt.get("attribution") or None
            a["rights_notes"] = rt.get("notes") or None
            a["raw_in_release_bundle"] = (rt.get("raw_in_release_bundle") or "").lower() == "true"
            a["local_copy"] = path is not None
            a["local_copy_servable"] = bool(
                path is not None
                and a["redistribute_raw"]
                and a["rights_status"] in ("public_domain_us_federal", "government_edict", "open_license")
            )
            a["local_filename"] = path.name if a["local_copy_servable"] else None
            a["pdf_pages"] = self._pages(a["asset_id"], path)
            a["observations_by_measure"] = obs_counts.get(a["asset_id"], {})
            a["evidence"] = evidence.get(a["asset_id"], [])
            a["used_by_legal_ledger"] = a["asset_id"] in ledger_text
            a["jurisdictions"] = sorted(geos.get(a["asset_id"], set()))
        jur_by_source = defaultdict(set)
        for a in assets:
            jur_by_source[a["source_id"]] |= set(a["jurisdictions"])
        for s in sources:
            s["jurisdictions"] = sorted(jur_by_source[s["source_id"]])
            s["asset_ids"] = [a["asset_id"] for a in assets if a["source_id"] == s["source_id"]]
        leads = K.read_csv(K.LEADS_CSV)
        release = self._release_bundle()
        self.write("sources.json", {"sources": sources, "assets": assets, "leads": leads, "release": release})
        self.counts["sources"] = len(sources)
        self.counts["assets"] = len(assets)
        self.counts["leads"] = len(leads)

    def _release_bundle(self) -> dict | None:
        d = paths.DIST_DIR / self.build.get("release_version", "")
        man = d / "manifest.json"
        if not man.is_file():
            return None
        m = json.loads(man.read_text(encoding="utf-8"))
        files = sorted(p for p in d.iterdir() if p.is_file())
        return {
            "version": self.build.get("release_version"),
            "release_id": m.get("release_id"),
            "build_id": (m.get("build") or {}).get("build_id"),
            "code_commit": (m.get("build") or {}).get("code_commit"),
            "matches_current_build": (m.get("build") or {}).get("build_id") == self.build.get("build_id"),
            "files": [{"name": p.name, "bytes": p.stat().st_size} for p in files],
        }

    # ----- research gaps -----------------------------------------------------------------------
    def research(self) -> None:
        gaps, leads = K.read_csv(K.GAPS_CSV), K.read_csv(K.LEADS_CSV)
        problems = K.check_registers(gaps, leads)
        if problems:
            raise ValueError("research registers: " + "; ".join(problems))
        measure_family = {
            r["measure_id"]: (
                "fiscal"
                if r["fiscal_component"]
                else K.SOURCE_FAMILY_TO_FAMILY.get(r["source_family"], "context")
            )
            for r in _rows(self.con, "SELECT measure_id, source_family, fiscal_component FROM measures")
        }
        for g in gaps:
            fams = {measure_family[m] for m in K.split(g["affected_measures"]) if m in measure_family}
            unknown = [m for m in K.split(g["affected_measures"]) if m not in measure_family]
            if unknown:
                raise ValueError(f"{g['gap_id']}: unknown measures {unknown}")
            if g["category"] in ("policy_dates", "historical_extension"):
                fams.add("policy")
            if g["category"] == "case_fiscal":
                fams.add("fiscal")
            g["families"] = sorted(fams)
            g["priority"] = int(g["priority"])
            g["year_from"] = int(g["year_from"]) if g["year_from"] else None
            g["year_to"] = int(g["year_to"]) if g["year_to"] else None
            g["affected_measures"] = K.split(g["affected_measures"])
            g["affected_geos"] = K.split(g["affected_geos"])
            g["lead_ids"] = K.split(g["lead_ids"])
        gaps.sort(key=lambda g: (g["priority"], g["gap_id"]))
        self.write("research.json", {"categories": K.GAP_CATEGORIES, "gaps": gaps, "leads": leads})
        self.counts["research_gaps"] = len(gaps)

    # ----- monthly series ----------------------------------------------------------------------
    def monthly(self) -> None:
        """Monthly series (not in metrics.json, whose files are one value per year): Census MSRS changes, the
        Utah DABS monthly reports and the Utah state sales tax rate. One row per preferred observation."""
        measures = {r["measure_id"]: r for r in _rows(self.con, "SELECT * FROM measures")}
        rows = _rows(
            self.con,
            """SELECT p.measure_id, p.geo_id, p.period_label, p.period_start, p.period_end, p.value, p.missing_reason,
                      d.suppression_flag, p.observation_id, p.asset_id, p.source_locator, p.review_status,
                      p.comparability_group
               FROM preferred_observations p LEFT JOIN observation_details d USING (observation_id)
               WHERE p.period_kind = 'month' AND p.subgroup = 'all' AND p.measure_id IN (
                   SELECT measure_id FROM measures
                   WHERE measure_id LIKE 'msrs_%' OR measure_id LIKE 'ut_dabs_monthly_%'
                      OR measure_id = 'state_sales_tax_rate_state_portion')
               ORDER BY p.measure_id, p.geo_id, p.period_start""",
        )
        series: dict[str, dict] = {}
        cols = [
            "geo_id",
            "period_label",
            "period_start",
            "period_end",
            "value",
            "missing_reason",
            "suppression_flag",
            "observation_id",
            "asset_id",
            "source_locator",
            "review_status",
            "comparability_group",
        ]
        for r in rows:
            m = measures[r["measure_id"]]
            s = series.setdefault(
                r["measure_id"],
                {
                    "measure_id": r["measure_id"],
                    "label": m["label"],
                    "definition": m["definition"],
                    "unit": m["unit"],
                    "beverage": m["beverage"],
                    "overlap_note": m["overlap_note"],
                    "notes": m["notes"],
                    "rows": [],
                },
            )
            s["rows"].append([r[c] for c in cols])
        index = []
        for k in sorted(series):
            meta = {key: v for key, v in series[k].items() if key != "rows"}
            meta["file"] = f"monthly/{k}.json"
            meta["periods"] = sorted({row[1] for row in series[k]["rows"]})
            # The files behind the series, so a chart can cite them without loading every row.
            meta["asset_ids"] = sorted({row[cols.index("asset_id")] for row in series[k]["rows"]})
            index.append(meta)
            self.write(meta["file"], {"measure_id": k, "columns": cols, "rows": series[k]["rows"]})
        self.write("monthly.json", {"series": index})
        self.counts["monthly_series"] = len(series)

    # ----- map shapes --------------------------------------------------------------------------
    def map_shapes(self) -> None:
        """One SVG outline per state from the pinned us-atlas TopoJSON (already projected to Albers USA)."""
        from alcohol_data.acquisition.fetch import load_pins, resolve_pinned
        from alcohol_data.config import load_all_sources

        sources = load_all_sources()
        if "us_atlas" not in sources:
            return
        asset = sources["us_atlas"].assets[0]
        try:
            path = resolve_pinned(asset, load_pins(paths.ROOT / "config" / "builds" / "preview.pins.json"))
        except Exception as e:  # pragma: no cover - map is optional when the shapes are not cached
            log.warning("map shapes not exported: %s", e)
            return
        if path is None or not Path(path).is_file():
            log.warning("map shapes not exported: %s is not in the raw cache", asset.asset_id)
            return
        topo = json.loads(Path(path).read_text(encoding="utf-8"))
        shapes, label = topology_paths(topo, "states")
        out = {}
        for fips, d in sorted(shapes.items()):
            if f"state:{fips}" not in self.geo_ids:
                continue
            out[f"state:{fips}"] = {"path": d, "label": label[fips]}
        self.write(
            "map.json",
            {
                "viewBox": "0 0 975 610",
                "source": {"asset_id": asset.asset_id, "citation": sources["us_atlas"].citation.strip()},
                "states": out,
            },
        )
        self.counts["map_states"] = len(out)

    # ----- officials and committees (reference data) --------------------------------------------
    def officials(self) -> None:
        """Officeholders and committees from the pinned Open States People archive (see officials/).

        Reference data only: it feeds no observation, estimate or scenario. Skipped (with a warning) when the
        archive is not in the raw cache, like the map shapes.
        """
        from alcohol_data.acquisition.fetch import load_pins, resolve_pinned
        from alcohol_data.config import load_all_sources
        from alcohol_data.officials import dashboard as OD
        from alcohol_data.officials.importer import load_officials

        sources = load_all_sources()
        if "openstates_people" not in sources:
            return
        src = sources["openstates_people"]
        asset = src.assets[0]
        try:
            path = resolve_pinned(asset, load_pins(paths.ROOT / "config" / "builds" / "preview.pins.json"))
        except Exception as e:  # pragma: no cover - optional when the archive is not cached
            log.warning("officials not exported: %s", e)
            return
        if path is None or not Path(path).is_file():
            log.warning("officials not exported: %s is not in the raw cache", asset.asset_id)
            return
        off = load_officials(Path(path))
        errors = off.errors()
        if errors:
            raise ValueError(
                f"officials archive failed its field checks ({len(errors)} errors, first: {errors[0]['detail']})"
            )
        abbr = {g["geo_id"]: g["abbreviation"].lower() for g in self.geos if g.get("abbreviation")}
        labels = self.catalog()
        dates = []
        for r in K.read_csv(paths.CURATED_DIR / "policy_events.csv"):
            state = abbr.get(r["geo_id"])
            if not state or not r["enactment_date"]:
                continue
            dim = labels.get(r["policy_dimension"], (r["policy_dimension"],))[0]
            dates.append(
                {
                    "policy_id": r["policy_id"],
                    "state": state,
                    "date": r["enactment_date"],
                    "dimension": dim,
                    "value": r["policy_value"],
                    "beverage": r["beverage"],
                    "claim_status": r["claim_status"],
                }
            )
        dates.sort(key=lambda d: (d["state"], d["date"], d["policy_id"]))
        relevance = OD.read_relevance(paths.CURATED_DIR / "officials" / "committee_relevance.csv")
        files = OD.build_files(
            off,
            dates,
            relevance,
            {
                "source_id": src.source_id,
                "asset_id": asset.asset_id,
                "archive_name": asset.filename,
                "publisher": src.publisher,
                "title": src.title,
                "landing_url": src.landing_url,
                "citation": src.citation.strip(),
                "rights_evidence_url": src.rights_evidence_url,
            },
        )
        for rel, obj in sorted(files.items()):
            self.write(rel, obj)
        c = off.counts()
        self.counts["officials_records"] = c["records"]
        self.counts["officials_committees"] = c["committees"]
        self.counts["officials_files"] = len(files) - 1

    # ----- worked examples ---------------------------------------------------------------------
    def cases(self) -> None:
        cases = []
        measures = {r[0] for r in self.con.execute("SELECT measure_id FROM measures").fetchall()}
        for p in sorted(K.CASES_DIR.glob("*.yaml")) if K.CASES_DIR.is_dir() else []:
            c = yaml.safe_load(p.read_text(encoding="utf-8"))
            c["config_file"] = paths.rel(p)
            for mid in c.get("metrics", []):
                if mid.split("@")[0] not in measures:
                    raise ValueError(f"{p.name}: unknown measure in metric {mid}")
            # A known measure with no rows in this build (e.g. the small test build) is listed, not fatal.
            c["metrics_without_data"] = [m for m in c.get("metrics", []) if m not in self.metric_meta]
            c["metrics"] = [m for m in c.get("metrics", []) if m in self.metric_meta]
            # Each panel opens in Explore as a saved analysis, which shows every series one way.
            for panel in c.get("panels", []):
                kinds = {pm.get("conversion") or "nominal" for pm in panel.get("metrics", [])}
                if len(kinds) > 1:
                    raise ValueError(
                        f"{p.name}: panel {panel.get('title')!r} mixes conversions {sorted(kinds)}"
                    )
                n_geos = 1 + (
                    0
                    if panel.get("treated_only")
                    else len(c.get("comparison_geos", [])) + len(c.get("reference_geos", []))
                )
                if n_geos > K.ANALYSIS_MAX_GEOS or len(panel.get("metrics", [])) > K.ANALYSIS_MAX_METRICS:
                    raise ValueError(
                        f"{p.name}: panel {panel.get('title')!r} exceeds the Explore limits "
                        f"({K.ANALYSIS_MAX_METRICS} metrics, {K.ANALYSIS_MAX_GEOS} jurisdictions)"
                    )
            cases.append(c)
        self.write("cases.json", {"cases": cases})
        self.counts["cases"] = len(cases)

    # ----- saved analyses ----------------------------------------------------------------------
    def analyses(self) -> None:
        """Starting points for the Explore view, each checked against this build.

        A saved analysis is a selection (measures, jurisdictions, years, how values are shown and a policy
        to show underneath) with the question it serves and what it cannot show. It states no finding:
        findings belong in a worked example, where each sentence is tied to a checked claim. Worked-example
        panels become saved analyses in the UI, from cases.json.
        """
        measures = {r[0] for r in self.con.execute("SELECT measure_id FROM measures").fetchall()}
        out = []
        for p in sorted(K.ANALYSES_DIR.glob("*.yaml")) if K.ANALYSES_DIR.is_dir() else []:
            a = yaml.safe_load(p.read_text(encoding="utf-8"))
            out.append(self.check_analysis(p, a, measures))
        self.write("analyses.json", {"analyses": out})
        self.counts["analyses"] = len(out)

    def check_analysis(self, p: Path, a: dict, measures: set[str]) -> dict:
        def fail(why: str):
            raise ValueError(f"{p.name}: {why}")

        if not isinstance(a, dict):
            fail("not a mapping")
        if unknown := sorted(set(a) - K.ANALYSIS_KEYS):
            fail(f"unknown keys {unknown} (a saved analysis states no finding; use a worked example)")
        if a.get("analysis_id") != p.stem:
            fail("analysis_id must equal the file name")
        for key in ("title", "question"):
            if not isinstance(a.get(key), str) or not a[key].strip():
                fail(f"{key} is required")
        for key in ("notes", "cannot_show"):
            if not isinstance(a.get(key, []), list) or not all(isinstance(x, str) for x in a.get(key, [])):
                fail(f"{key} must be a list of sentences")
        if not a.get("cannot_show"):
            fail("cannot_show is required: say what the selection cannot establish")
        metrics, geos = a.get("metrics") or [], a.get("geos") or []
        if not 1 <= len(metrics) <= K.ANALYSIS_MAX_METRICS or len(set(metrics)) != len(metrics):
            fail(f"1 to {K.ANALYSIS_MAX_METRICS} distinct metrics")
        if not 1 <= len(geos) <= K.ANALYSIS_MAX_GEOS or len(set(geos)) != len(geos):
            fail(f"1 to {K.ANALYSIS_MAX_GEOS} distinct jurisdictions")
        for mid in metrics:
            if mid.split("@")[0] not in measures:
                fail(f"unknown measure in metric {mid}")
        if missing := [g for g in geos if g not in self.geo_ids]:
            fail(f"unknown jurisdictions {missing}")
        years = a.get("years")
        if not (isinstance(years, list) and len(years) == 2 and all(isinstance(y, int) for y in years)):
            fail("years must be [from, to]")
        if years[0] > years[1]:
            fail("years out of order")
        shown = a.get("shown", "nominal")
        if shown not in K.SHOWN:
            fail(f"shown must be one of {K.SHOWN}")
        base = a.get("base_year")
        if (shown == "index") != (base is not None):
            fail("base_year is given exactly when values are shown as an index")
        if base is not None and not (isinstance(base, int) and years[0] <= base <= years[1]):
            fail("base_year must lie inside years")
        with_data = [m for m in metrics if m in self.metric_meta]
        if shown in ("real_cy2024", "per_resident", "per_resident_21plus"):
            if bad := [m for m in with_data if shown not in self.metric_meta[m]["conversions"]]:
                fail(f"{shown} is not available for {bad}")
        dim = a.get("policy_dimension")
        if dim is not None and dim not in self.catalog():
            fail(f"unknown policy dimension {dim}")
        return {
            "analysis_id": a["analysis_id"],
            "title": a["title"].strip(),
            "question": " ".join(a["question"].split()),
            "metrics": with_data,
            "metrics_without_data": [m for m in metrics if m not in self.metric_meta],
            "geos": geos,
            "years": years,
            "shown": shown,
            "base_year": base,
            "policy_dimension": dim,
            "notes": a.get("notes", []),
            "cannot_show": a["cannot_show"],
            "config_file": paths.rel(p),
        }

    # ----- cost model --------------------------------------------------------------------------
    def cost_model(self) -> None:
        """Regression of Census state liquor-store expenditure on revenue (store_cost.py). Read from the preferred
        observations, so it changes only when those do; the scenario turns the slope into an operating-cost
        range using the margin the reader chooses. The shown estimate stops at store_cost.DISPLAY_LAST_YEAR;
        the same model with the later years added is written beside it as ``extension_check``, never shown as
        the estimate."""
        rev, exp = store_cost.MEASURES["revenue"], store_cost.MEASURES["expenditure"]
        got = _rows(
            self.con,
            "SELECT * FROM preferred_observations "
            "WHERE measure_id IN (?, ?) AND value IS NOT NULL AND geo_id LIKE 'state:%'",
            (rev, exp),
        )
        cells: dict[tuple[str, int], dict[str, dict]] = defaultdict(dict)
        for r in got:
            cells[(r["geo_id"], int(r["year"]))][r["measure_id"]] = r
        rows = [
            store_cost.StateYear(
                g,
                y,
                float(v[rev]["value"]),
                float(v[exp]["value"]),
                group=f"{v[rev].get('comparability_group') or ''} / {v[exp].get('comparability_group') or ''}",
                flags=tuple(f for m in (rev, exp) for f in (v[m].get("quality_flags") or "").split("|") if f),
            )
            for (g, y), v in sorted(cells.items())
            if rev in v and exp in v
        ]
        out = store_cost.run(rows, last_year=store_cost.DISPLAY_LAST_YEAR)
        out["inputs"] = {
            "measures": [rev, exp],
            "geo_scope": "states with a Census liquor-store system in the year",
            "preferred_observations_read": len(got),
        }
        if any(r.year > store_cost.DISPLAY_LAST_YEAR for r in rows):
            out["extension_check"] = store_cost.compare_extension(rows)
        self.counts["cost_model_state_years"] = out["sample"]["state_years"]
        self.write("cost_model.json", out)

    # ----- reconciliation --------------------------------------------------------------------
    def reconciliation(self) -> None:
        """The Utah liquor-sales bridge, its findings and the Utah-peer comparison (dashboard/reconciliation.py)."""
        from alcohol_data.dashboard import reconciliation

        leads = {r["lead_id"] for r in K.read_csv(K.LEADS_CSV)}
        gaps = {r["gap_id"] for r in K.read_csv(K.GAPS_CSV)}
        out = reconciliation.build(self.con, leads, gaps)
        if out is None:
            return
        self.write("reconciliation.json", out)
        self.counts["reconciliation_years"] = len(out["bridge"])

    # ----- manifest ----------------------------------------------------------------------------
    def manifest(self) -> dict:
        retrieved = self.con.execute(
            "SELECT min(retrieved_at), max(retrieved_at) FROM source_assets WHERE retrieved_at IS NOT NULL"
        ).fetchone()
        man = {
            "schema_version": K.SCHEMA_VERSION,
            "dataset": {
                "release_version": self.build.get("release_version"),
                "build_id": self.build.get("build_id"),
                "release_label": f"{self.build.get('release_version')} ({self.build.get('build_id')})",
                "database_schema_version": self.build.get("schema_version"),
                "built_at": self.build.get("built_at"),
                "built_from_commit": self.build.get("code_commit"),
                "law_as_of_date": self.build.get("as_of_date"),
                "law_as_of_timezone": self.build.get("as_of_timezone"),
                "source_retrieval_first": retrieved[0],
                "source_retrieval_last": retrieved[1],
            },
            "export": {
                "generated_at": datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
                "exported_from_commit": _git_head(),
                "transform_version": K.TRANSFORM_VERSION,
            },
            "counts": dict(sorted(self.counts.items())),
            "files": dict(sorted(self.files.items())),
        }
        p = self.out / "manifest.json"
        p.write_bytes(json.dumps(man, ensure_ascii=False, indent=1, default=_default).encode("utf-8"))
        return man


def export_dashboard(out_dir: Path | None = None, db_path: Path | None = None) -> dict:
    out = Path(out_dir or DEFAULT_OUT)
    db = Path(db_path or paths.DATABASE_PATH)
    if not db.is_file():
        raise FileNotFoundError(f"{db} not found; run `alcohol-data build` first")
    out.mkdir(parents=True, exist_ok=True)
    for stale in (out / "metrics", out / "monthly", out / "officials"):
        if stale.is_dir():
            for f in stale.glob("*.json"):
                f.unlink()
    ex = Export(out, db)
    ex.geographies()
    ex.metrics()
    ex.coverage()
    ex.policy()
    ex.sources()
    ex.research()
    ex.cases()
    ex.analyses()
    ex.monthly()
    ex.map_shapes()
    ex.officials()
    ex.cost_model()
    ex.reconciliation()
    return ex.manifest()
