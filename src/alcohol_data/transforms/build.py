"""Build the canonical DuckDB database from pinned source bytes.

The build never downloads. It reads exactly the bytes pinned in the build's pins
file (or in a release manifest with --manifest), so the same inputs and code give
the same tables.
"""

from __future__ import annotations

import csv
import hashlib
import json
import os
import subprocess
from datetime import UTC, date, datetime
from pathlib import Path

from alcohol_data import SCHEMA_VERSION, __version__, paths
from alcohol_data.acquisition.fetch import load_pins, resolve_pinned
from alcohol_data.adapters import ADAPTERS, Rejected, Staged
from alcohol_data.config import AssetConfig, build_assets, load_all_sources, load_build
from alcohol_data.schemas import vocab
from alcohol_data.transforms import db, derive, policy, prefer
from alcohol_data.transforms.ids import cell_key, natural_key, observation_id

BUILD_SUMMARY = paths.PROCESSED_DIR / "build_summary.json"
MANUAL_TRANSFORM = "manual_transcription@1.0"


class BuildError(RuntimeError):
    pass


def git_commit() -> str:
    try:
        head = subprocess.run(
            ["git", "rev-parse", "HEAD"], cwd=paths.ROOT, capture_output=True, text=True, check=True
        ).stdout.strip()
        dirty = subprocess.run(
            ["git", "status", "--porcelain", "--", "src", "sql", "config", "metadata", "data/curated"],
            cwd=paths.ROOT,
            capture_output=True,
            text=True,
            check=True,
        ).stdout.strip()
        return head + ("-dirty" if dirty else "")
    except (subprocess.CalledProcessError, FileNotFoundError):
        return "uncommitted"


def read_csv(path: Path) -> list[dict]:
    with open(path, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def _d(s: str | None) -> date | None:
    return date.fromisoformat(s) if s else None


def parse_manual_number(raw: str) -> tuple[float | None, list[str]]:
    """Accounting-style number: '1,234', '(1,234)' negative, '-' is a printed zero, '4.85%' a printed rate."""
    t = raw.strip().replace("$", "").replace(" ", "").removesuffix("%")
    if t in ("-", "–", "—"):
        return 0.0, ["accounting_dash_read_as_zero"]
    neg = t.startswith("(") and t.endswith(")")
    t = t.strip("()").replace(",", "")
    v = float(t)
    return (-v if neg else v), []


def row_problems(s: Staged, measures: dict, geos: set) -> list[str]:
    p = []
    if s.geo_id not in geos:
        p.append(f"unknown geography {s.geo_id}")
    m = measures.get(s.measure_id)
    if m is None:
        p.append(f"unknown measure {s.measure_id}")
    if s.period_kind not in vocab.PERIOD_KINDS:
        p.append(f"unknown period kind {s.period_kind}")
    if s.period_start > s.period_end:
        p.append("period_start after period_end")
    if s.period_kind == "point_in_time" and s.period_start != s.period_end:
        p.append("point_in_time period must have start == end")
    if (s.value is None) == (s.missing_reason is None):
        p.append("value and missing_reason must be exclusive (exactly one set)")
    if s.missing_reason is not None and s.missing_reason not in vocab.MISSING_REASONS:
        p.append(f"unknown missing reason {s.missing_reason}")
    if s.estimate_type not in vocab.ESTIMATE_TYPES:
        p.append(f"unknown estimate type {s.estimate_type}")
    if s.extraction_method not in vocab.EXTRACTION_METHODS:
        p.append(f"unknown extraction method {s.extraction_method}")
    if m is not None and s.value is not None:
        if m["nonnegative"] == "true" and s.value < 0:
            p.append("negative value for a nonnegative measure")
        if m["value_kind"] == "percent" and not (0 <= s.value <= 100):
            p.append("percent outside 0-100")
        if m["value_kind"] == "fraction" and not (0 <= s.value <= 1):
            p.append("fraction outside 0-1")
    if s.ci_low is not None and s.ci_high is not None and s.value is not None:
        if not (s.ci_low <= s.value <= s.ci_high):
            p.append("confidence interval does not contain the estimate")
    return p


# The derivations read the preferred observations. They may carry an input's interval (FARS rates do), so each
# row comes with its confidence limits, standard error and interval basis from observation_details.
DERIVE_INPUT_SQL = """
    SELECT p.*, d.ci_low, d.ci_high, d.ci_level, d.standard_error,
           json_extract_string(d.extra, '$.interval_basis') AS interval_basis
    FROM preferred_observations p LEFT JOIN observation_details d USING (observation_id)"""


def _obs_row(
    s: Staged, oid: str, asset: AssetConfig | None, series: str, vintage: str, asset_id: str
) -> dict:
    return {
        "observation_id": oid,
        "geo_id": s.geo_id,
        "measure_id": s.measure_id,
        "period_start": s.period_start,
        "period_end": s.period_end,
        "period_kind": s.period_kind,
        "period_label": s.period_label,
        "year": s.year,
        "subgroup": s.subgroup,
        "value": s.value,
        "missing_reason": s.missing_reason,
        "estimate_type": s.estimate_type,
        "extraction_method": s.extraction_method,
        "asset_id": asset_id,
        "source_locator": s.source_locator,
        "source_series": series,
        "source_vintage": vintage,
        "comparability_group": s.comparability_group or f"{series}|{s.measure_id}",
        "quality_flags": "|".join(sorted(set(s.quality_flags))) or None,
        "review_status": s.review_status,
    }


def _detail_row(s: Staged, oid: str) -> dict:
    return {
        "observation_id": oid,
        "source_code": s.source_code,
        "raw_value": s.raw_value,
        "raw_unit": s.raw_unit,
        "multiplier": s.multiplier,
        "ci_low": s.ci_low,
        "ci_high": s.ci_high,
        "ci_level": s.ci_level,
        "standard_error": s.standard_error,
        "sample_size": s.sample_size,
        "suppression_flag": s.suppression_flag,
        "footnote": s.footnote,
        "fiscal_year_end": s.fiscal_year_end,
        "extra": s.extra_json(),
    }


def load_manifest_pins(manifest: Path) -> dict[str, dict]:
    p = manifest / "manifest.json" if manifest.is_dir() else manifest
    m = json.loads(p.read_text(encoding="utf-8"))
    return {
        i["asset_id"]: {
            "sha256": i["sha256"],
            "bytes": i.get("bytes"),
            "retrieved_at": i.get("retrieved_at"),
            "url": i.get("url"),
        }
        for i in m["inputs"]
        if i.get("sha256")
    }


def run_build(config_path: Path, manifest: Path | None = None) -> dict:
    build = load_build(config_path)
    sources = load_all_sources()
    assets = build_assets(build, sources)
    pins = load_manifest_pins(manifest) if manifest else load_pins(build.pins_file)
    commit = git_commit()
    pin_digest = hashlib.sha256(
        json.dumps({k: v["sha256"] for k, v in sorted(pins.items())}, sort_keys=True).encode()
    ).hexdigest()
    build_id = (
        f"{build.name}-{hashlib.sha256((pin_digest + commit + SCHEMA_VERSION).encode()).hexdigest()[:12]}"
    )

    paths.ensure_dirs()
    tmp = paths.DATABASE_PATH.with_name("alcohol_data.building.duckdb")
    for f in (tmp, tmp.with_suffix(".duckdb.wal")):
        if f.exists():
            f.unlink()
    con = db.connect(tmp)
    db.create_schema(con)

    geos = read_csv(paths.METADATA_DIR / "geography_crosswalks" / "geographies.csv")
    db.insert_rows(con, "geographies", geos)
    db.insert_rows(
        con,
        "geography_relationships",
        read_csv(paths.METADATA_DIR / "geography_crosswalks" / "geography_relationships.csv"),
    )
    measures_rows = read_csv(paths.METADATA_DIR / "measures.csv")
    db.insert_rows(con, "measures", measures_rows)
    for table, name in (
        ("policy_dimensions", "policy_catalog.csv"),
        ("policy_dimension_values", "policy_catalog_values.csv"),
        ("measure_concepts", "measure_concepts.csv"),
    ):
        rows = read_csv(paths.METADATA_DIR / name)
        for r in rows:
            for k, v in r.items():
                r[k] = v if v != "" else None
            if "sequence" in r:
                r["sequence"] = int(r["sequence"])
        db.insert_rows(con, table, rows)
    measures = {m["measure_id"]: m for m in measures_rows}
    geo_ids = {g["geo_id"] for g in geos}

    source_rows = [
        {
            "source_id": s.source_id,
            "publisher": s.publisher,
            "title": s.title,
            "landing_url": s.landing_url,
            "citation": s.citation,
            "source_family": s.source_family,
            "rights_status": s.rights_status,
            "rights_evidence_url": s.rights_evidence_url,
            "notes": s.notes,
        }
        for sid, s in sources.items()
        if sid in build.sources
    ]
    source_rows.append(
        {
            "source_id": "project_derivations",
            "publisher": "alcohol-policy-revenue-data project",
            "title": "Derived measures computed by this project",
            "landing_url": "docs/methods/derived-measures.md",
            "citation": "See lineage table for the inputs of every derived value.",
            "source_family": "derived",
            "rights_status": "open_license",
            "rights_evidence_url": "DATA_LICENSE.md",
            "notes": "Formulas in src/alcohol_data/transforms/derive.py.",
        }
    )
    db.insert_rows(con, "sources", source_rows)

    obs, details, lineage, quarantine, asset_rows = [], [], [], [], []
    priority: dict[str, int] = {}
    seen: set[str] = set()
    asset_by_id = {a.asset_id: a for a in assets}
    resolved: dict[str, Path | None] = {}
    inputs_manifest = []

    for a in assets:
        path = resolve_pinned(a, pins)
        resolved[a.asset_id] = path
        pin = pins.get(a.asset_id) or {}
        if path is None:
            if not a.parser and pin.get("sha256"):
                status = "pinned_not_local"  # cited document: hash known, bytes not in this environment
            elif a.method == "manual_import" or a.expected_status != "acquired":
                status = a.expected_status if a.expected_status != "acquired" else "blocked_access"
            elif build.missing_assets == "record":
                status = "verified_available"
            else:
                raise BuildError(
                    f"pinned bytes for {a.asset_id} are not available locally; run 'alcohol-data fetch' "
                    "(or 'alcohol-data fetch --offline' to verify the cache)"
                )
        else:
            status = "parsed" if a.parser else "acquired"
        parser_version = ADAPTERS[a.parser][1] if a.parser else None
        known = path is not None or status == "pinned_not_local"
        asset_rows.append(
            {
                "asset_id": a.asset_id,
                "source_id": a.source_id,
                "url": pin.get("url") or a.url,
                "request_method": a.method,
                "edition": a.edition,
                "source_series": a.source_series,
                "source_vintage": a.source_vintage,
                "retrieved_at": pin.get("retrieved_at") if known else None,
                "sha256": pin.get("sha256") if known else None,
                "bytes": pin.get("bytes") if known else None,
                "format": a.format,
                "acquisition_status": status,
                "rights_status": a.rights_status,
                "redistribute_raw": a.redistribute_raw,
                "parser": a.parser,
                "parser_version": parser_version,
                "priority": a.priority,
                "notes": a.notes,
            }
        )
        inputs_manifest.append(
            {
                "asset_id": a.asset_id,
                "source_id": a.source_id,
                "url": pin.get("url") or a.url,
                "edition": a.edition,
                "sha256": pin.get("sha256") if known else None,
                "bytes": pin.get("bytes") if known else None,
                "retrieved_at": pin.get("retrieved_at") if known else None,
                "acquisition_status": status,
                "rights_status": a.rights_status,
                "redistribute_raw": a.redistribute_raw,
                "filename": a.filename,
            }
        )
        priority[a.asset_id] = a.priority
        if path is None or not a.parser:
            continue
        fn, ver = ADAPTERS[a.parser]
        for item in fn(a, path):
            if isinstance(item, Rejected):
                quarantine.append(
                    {
                        "asset_id": a.asset_id,
                        "source_locator": item.source_locator,
                        "measure_id": item.measure_id,
                        "geo_id": item.geo_id,
                        "period_label": item.period_label,
                        "raw_value": item.raw_value,
                        "reason": item.reason,
                    }
                )
                continue
            probs = row_problems(item, measures, geo_ids)
            nk = natural_key(
                item.geo_id,
                item.measure_id,
                item.period_start,
                item.period_end,
                item.subgroup,
                a.source_series,
                a.source_vintage,
            )
            if not probs and nk in seen:
                probs = ["duplicate natural key within build"]
            if probs:
                quarantine.append(
                    {
                        "asset_id": a.asset_id,
                        "source_locator": item.source_locator,
                        "measure_id": item.measure_id,
                        "geo_id": item.geo_id,
                        "period_label": item.period_label,
                        "raw_value": item.raw_value,
                        "reason": "; ".join(probs),
                    }
                )
                continue
            seen.add(nk)
            oid = observation_id(nk)
            obs.append(_obs_row(item, oid, a, a.source_series, a.source_vintage, a.asset_id))
            details.append(_detail_row(item, oid))
            lineage.append(
                {
                    "output_id": oid,
                    "output_table": "observations",
                    "input_ids": a.asset_id,
                    "transform_id": f"{a.parser}@{ver}",
                    "code_commit": commit,
                    "build_id": build_id,
                }
            )

    # Hand-transcribed observations
    if build.manual_observations and build.manual_observations.exists():
        for i, r in enumerate(read_csv(build.manual_observations), start=2):
            a = asset_by_id.get(r["asset_id"])
            loc = f"{paths.rel(build.manual_observations)} row {i}"
            if a is None or not (pins.get(a.asset_id) or {}).get("sha256"):
                quarantine.append(
                    {
                        "asset_id": r["asset_id"],
                        "source_locator": loc,
                        "measure_id": r["measure_id"],
                        "geo_id": r["geo_id"],
                        "period_label": r["period_label"],
                        "raw_value": r["raw_value"],
                        "reason": "manual observation cites an asset with no pinned hash in this build",
                    }
                )
                continue
            missing = r.get("missing_reason") or None
            flags = [f for f in (r.get("quality_flags") or "").split("|") if f]
            if missing:
                value = None
            else:
                num, extra_flags = parse_manual_number(r["raw_value"])
                value = num * float(r["multiplier"])
                flags += extra_flags
            m = measures.get(r["measure_id"], {})
            s = Staged(
                geo_id=r["geo_id"],
                measure_id=r["measure_id"],
                period_start=_d(r["period_start"]),
                period_end=_d(r["period_end"]),
                period_kind=r["period_kind"],
                period_label=r["period_label"],
                year=int(r["year"]),
                value=value,
                missing_reason=missing,
                source_locator=r["source_locator"],
                estimate_type="reported_count" if m.get("value_kind") == "count" else "administrative_amount",
                extraction_method="manual",
                comparability_group=f"{r['source_series']}|{r['measure_id']}",
                quality_flags=flags,
                review_status=r["review_status"],
                source_code=r["source_code"],
                raw_value=r["raw_value"],
                raw_unit=r["raw_unit"],
                multiplier=float(r["multiplier"]),
                extra={
                    "manual_id": r["manual_id"],
                    "transcribed_by": r["transcribed_by"],
                    "transcribed_on": r["transcribed_on"],
                    "reviewed_by": r.get("reviewed_by") or None,
                    "reviewed_on": r.get("reviewed_on") or None,
                    "notes": r.get("notes") or None,
                },
            )
            series = r.get("source_series") or a.source_series
            probs = row_problems(s, measures, geo_ids)
            if r["review_status"] not in ("extracted_unreviewed", "reviewed"):
                probs.append(f"unknown review status {r['review_status']}")
            if r["review_status"] == "reviewed" and not (r.get("reviewed_by") and r.get("reviewed_on")):
                probs.append("reviewed without reviewer and date")
            nk = natural_key(
                s.geo_id, s.measure_id, s.period_start, s.period_end, s.subgroup, series, a.source_vintage
            )
            if not probs and nk in seen:
                probs = ["duplicate natural key within build"]
            if probs:
                quarantine.append(
                    {
                        "asset_id": a.asset_id,
                        "source_locator": loc,
                        "measure_id": s.measure_id,
                        "geo_id": s.geo_id,
                        "period_label": s.period_label,
                        "raw_value": s.raw_value,
                        "reason": "; ".join(probs),
                    }
                )
                continue
            seen.add(nk)
            oid = observation_id(nk)
            obs.append(_obs_row(s, oid, a, series, a.source_vintage, a.asset_id))
            details.append(_detail_row(s, oid))
            lineage.append(
                {
                    "output_id": oid,
                    "output_table": "observations",
                    "input_ids": a.asset_id,
                    "transform_id": MANUAL_TRANSFORM,
                    "code_commit": commit,
                    "build_id": build_id,
                }
            )

    asset_rows.append(
        {
            "asset_id": derive.DERIVED_ASSET,
            "source_id": "project_derivations",
            "url": None,
            "request_method": "computed",
            "edition": derive.FORMULA_VERSION,
            "source_series": "project_derived",
            "source_vintage": derive.FORMULA_VERSION,
            "retrieved_at": None,
            "sha256": None,
            "bytes": None,
            "format": "derived",
            "acquisition_status": "parsed",
            "rights_status": "open_license",
            "redistribute_raw": True,
            "parser": "derive",
            "parser_version": derive.FORMULA_VERSION,
            "priority": 0,
            "notes": "Pseudo-asset for values computed by the build; inputs are in lineage.",
        }
    )
    db.insert_rows(con, "source_assets", asset_rows)
    db.insert_rows(con, "observations", obs)
    db.insert_rows(con, "observation_details", details)
    db.insert_rows(con, "quarantine", quarantine)

    for o in obs:
        o["cell_key"] = cell_key(
            o["geo_id"], o["measure_id"], o["period_start"], o["period_end"], o["subgroup"]
        )
    selection = prefer.rank_cells(obs, priority)
    db.insert_rows(con, "preferred_selection", selection)
    con.execute(prefer.PREFERRED_VIEW)

    derived_count = 0
    if build.derived:
        cols = [d[0] for d in con.execute(DERIVE_INPUT_SQL + " LIMIT 0").description]
        preferred = [dict(zip(cols, r, strict=True)) for r in con.execute(DERIVE_INPUT_SQL).fetchall()]
        d_obs, d_det, d_sel = [], [], []
        for d, inputs, fid in derive.derive(preferred):
            s = Staged(
                geo_id=d["geo_id"],
                measure_id=d["measure_id"],
                period_start=d["period_start"],
                period_end=d["period_end"],
                period_kind=d["period_kind"],
                period_label=d["period_label"],
                year=d["year"],
                subgroup=d["subgroup"],
                value=d["value"],
                missing_reason=d["missing_reason"],
                source_locator=d["source_locator"],
                estimate_type="derived",
                extraction_method="computed",
                comparability_group=d["comparability_group"],
                quality_flags=d["quality_flags"],
                ci_low=d.get("ci_low"),
                ci_high=d.get("ci_high"),
                ci_level=d.get("ci_level"),
                standard_error=d.get("standard_error"),
                extra=d.get("extra"),
            )
            probs = row_problems(s, measures, geo_ids)
            nk = natural_key(
                s.geo_id,
                s.measure_id,
                s.period_start,
                s.period_end,
                s.subgroup,
                "project_derived",
                derive.FORMULA_VERSION,
            )
            if probs or nk in seen:
                quarantine_row = {
                    "asset_id": derive.DERIVED_ASSET,
                    "source_locator": s.source_locator,
                    "measure_id": s.measure_id,
                    "geo_id": s.geo_id,
                    "period_label": s.period_label,
                    "raw_value": None,
                    "reason": "; ".join(probs) or "duplicate natural key within build",
                }
                db.insert_rows(con, "quarantine", [quarantine_row])
                continue
            seen.add(nk)
            oid = observation_id(nk)
            d_obs.append(
                _obs_row(s, oid, None, "project_derived", derive.FORMULA_VERSION, derive.DERIVED_ASSET)
            )
            d_det.append(_detail_row(s, oid))
            lineage.append(
                {
                    "output_id": oid,
                    "output_table": "observations",
                    "input_ids": "|".join(inputs),
                    "transform_id": fid,
                    "code_commit": commit,
                    "build_id": build_id,
                }
            )
            d_sel.append(
                {
                    "cell_key": cell_key(s.geo_id, s.measure_id, s.period_start, s.period_end, s.subgroup),
                    "observation_id": oid,
                    "rank": 1,
                    "candidate_count": 1,
                    "reason": "single candidate (derived)",
                }
            )
        db.insert_rows(con, "observations", d_obs)
        db.insert_rows(con, "observation_details", d_det)
        db.insert_rows(con, "preferred_selection", d_sel)
        derived_count = len(d_obs)

    # Policy
    events, evidence, exposure = [], [], []
    if build.policy_events and build.policy_events.exists():
        for r in read_csv(build.policy_events):
            ev = dict(r)
            for k in (
                "enactment_date",
                "effective_start",
                "effective_end",
                "known_in_effect_from",
                "known_in_effect_through",
                "review_date",
            ):
                ev[k] = _d(r.get(k))
            ev["requires_local_adoption"] = r["requires_local_adoption"].strip().lower() == "true"
            for k in ("reviewer", "notes", "value_detail"):
                ev[k] = r.get(k) or None
            events.append(ev)
        db.insert_rows(con, "policy_events", events)
        exposure = policy.expand(events, build.exposure_years, build.as_of_date)
        db.insert_rows(con, "policy_exposure", exposure)
        db.insert_rows(con, "policy_segments", policy.segments(events, build.as_of_date))
    for table, path in (
        ("claim_dependencies", build.claim_dependencies),
        ("claim_exceptions", build.claim_exceptions),
    ):
        if path and path.exists():
            db.insert_rows(con, table, read_csv(path))
    if build.policy_snapshots and build.policy_snapshots.exists():
        snaps = read_csv(build.policy_snapshots)
        for s in snaps:
            for k, v in s.items():
                s[k] = v if v != "" else None
            s["observed_year"] = int(s["observed_year"])
        db.insert_rows(con, "policy_snapshots", snaps)
    if build.policy_evidence and build.policy_evidence.exists():
        evidence = read_csv(build.policy_evidence)
        for e in evidence:
            for k in ("reviewed_by", "reviewed_on"):
                e[k] = e.get(k) or None
        db.insert_rows(con, "policy_evidence", evidence)

    db.insert_rows(con, "lineage", lineage)
    con.execute(COVERAGE_SQL)
    con.execute((paths.SQL_DIR / "views.sql").read_text(encoding="utf-8"))

    created = datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    info = {
        "build_id": build_id,
        "build_name": build.name,
        "release_version": build.release_version,
        "code_version": __version__,
        "schema_version": SCHEMA_VERSION,
        "code_commit": commit,
        "built_at": created,
        "pins_sha256": pin_digest,
        "pins_source": paths.rel(manifest) if manifest else paths.rel(build.pins_file),
        "as_of_date": build.as_of_date.isoformat(),
        "as_of_timezone": build.as_of_timezone,
        "preference_rule": prefer.RULE_VERSION,
        "policy_exposure": policy.DERIVATION_VERSION,
        "derivations": derive.FORMULA_VERSION,
    }
    for k, v in info.items():
        con.execute("INSERT INTO build_info VALUES (?, ?)", [k, str(v)])
    counts = {
        t: con.execute(f"SELECT count(*) FROM {t}").fetchone()[0]
        for t in (
            "observations",
            "quarantine",
            "preferred_selection",
            "policy_events",
            "policy_exposure",
            "lineage",
            "coverage",
        )
    }
    con.close()
    os.replace(tmp, paths.DATABASE_PATH)

    summary = {
        **info,
        "counts": counts,
        "derived_observations": derived_count,
        "inputs": inputs_manifest,
        "config": paths.rel(build.path),
    }
    BUILD_SUMMARY.write_text(
        json.dumps(summary, indent=2, default=str) + "\n", encoding="utf-8", newline="\n"
    )
    return {k: summary[k] for k in ("build_id", "code_commit", "counts", "derived_observations")}


COVERAGE_SQL = """
INSERT INTO coverage
WITH base AS (
  SELECT o.source_series, o.measure_id, g.geo_level, o.geo_id, o.year,
         max(CASE WHEN o.value IS NOT NULL THEN 1 ELSE 0 END) AS has_value,
         string_agg(DISTINCT o.missing_reason, '|') AS reasons
  FROM observations o JOIN geographies g USING (geo_id)
  GROUP BY ALL
), bounds AS (
  SELECT source_series, measure_id, geo_level,
         count(DISTINCT CASE WHEN has_value = 1 THEN geo_id END) AS geo_count,
         min(CASE WHEN has_value = 1 THEN year END) AS first_year,
         max(CASE WHEN has_value = 1 THEN year END) AS last_year
  FROM base GROUP BY ALL
), stats AS (
  SELECT b.source_series, b.measure_id, b.geo_level,
         count(*) FILTER (WHERE b.has_value = 1) AS observed_cells,
         count(*) FILTER (WHERE b.has_value = 0) AS missing_cells
  FROM base b JOIN bounds x USING (source_series, measure_id, geo_level)
  WHERE x.first_year IS NULL OR b.year BETWEEN x.first_year AND x.last_year
  GROUP BY ALL
), reasons AS (
  SELECT source_series, measure_id, geo_level,
         string_agg(r || ':' || n, '|' ORDER BY r) AS missing_reasons
  FROM (
    SELECT o.source_series, o.measure_id, g.geo_level, o.missing_reason AS r, count(*) AS n
    FROM observations o JOIN geographies g USING (geo_id)
    WHERE o.missing_reason IS NOT NULL GROUP BY ALL
  ) GROUP BY ALL
), years AS (
  SELECT source_series, measure_id, geo_level, year, max(has_value) AS any_value FROM base GROUP BY ALL
), gaps AS (
  SELECT x.source_series, x.measure_id, x.geo_level,
         string_agg(CAST(y.y AS VARCHAR), ',' ORDER BY y.y) AS gap_years
  FROM bounds x
  CROSS JOIN LATERAL (SELECT unnest(range(x.first_year, x.last_year + 1)) AS y) y
  LEFT JOIN years yr ON yr.source_series = x.source_series AND yr.measure_id = x.measure_id
       AND yr.geo_level = x.geo_level AND yr.year = y.y
  WHERE x.first_year IS NOT NULL AND coalesce(yr.any_value, 0) = 0
  GROUP BY ALL
)
SELECT x.source_series, x.measure_id, x.geo_level, x.geo_count, x.first_year, x.last_year,
       CASE WHEN x.first_year IS NULL THEN 0 ELSE x.geo_count * (x.last_year - x.first_year + 1) END AS expected_cells,
       coalesce(s.observed_cells, 0), coalesce(s.missing_cells, 0),
       greatest(0, CASE WHEN x.first_year IS NULL THEN 0 ELSE x.geo_count * (x.last_year - x.first_year + 1) END
                   - coalesce(s.observed_cells, 0) - coalesce(s.missing_cells, 0)),
       r.missing_reasons, g.gap_years
FROM bounds x
LEFT JOIN stats s USING (source_series, measure_id, geo_level)
LEFT JOIN reasons r USING (source_series, measure_id, geo_level)
LEFT JOIN gaps g USING (source_series, measure_id, geo_level)
"""
