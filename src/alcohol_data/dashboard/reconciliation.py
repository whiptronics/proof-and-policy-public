"""reconciliation.json for the dashboard: the Utah liquor-sales bridge (fiscal_bridge.py), the findings and their
evidence status (config/dashboard/reconciliation/*.yaml), and the Utah-peer comparison.

Observed values come from the build (pinned sources) or from data/curated/research/provisional_figures.csv (read
online, not yet saved); every value says which. Ratios are computed only from two values of the same system and year;
nothing is summed across kinds of money. Every source reference is checked, and an unknown one stops the export.
"""

from __future__ import annotations

from pathlib import Path

import yaml

from alcohol_data import fiscal_bridge as fb
from alcohol_data import paths

CONFIG_DIR = paths.CONFIG_DIR / "dashboard" / "reconciliation"
COMPARABLE = {"yes", "partly", "no"}
REF_KINDS = ("asset", "figure", "rate", "url", "lead", "gap")


def _ids(con, sql) -> set[str]:
    return {r[0] for r in con.execute(sql).fetchall()}


class Refs:
    """Resolves and checks source references."""

    def __init__(self, con, leads: set[str], gaps: set[str]):
        self.assets = {
            r[0]: (r[1], r[2])
            for r in con.execute("SELECT asset_id, edition, url FROM source_assets").fetchall()
        }
        self.figures = {f["figure_id"]: f for f in fb.provisional_figures()}
        self.rates = {r.rate_id: r for r in fb.deposit_rates()}
        self.leads, self.gaps = leads, gaps
        self.used_figures: set[str] = set()
        self.con = con

    def _record(self, f: dict) -> str | None:
        """The observation that now carries a checked figure (its ``record``), as a record link."""
        measure = f["record"].split(":")[2]
        cols = {c[0] for c in self.con.execute("DESCRIBE observations").fetchall()}
        if "asset_id" not in cols:
            return None  # a test database without provenance columns: cite the saved document instead
        row = self.con.execute(
            """SELECT observation_id, period_kind FROM observations WHERE asset_id = ? AND measure_id = ? AND year = ?
            AND abs(value - ?) < 0.5 ORDER BY observation_id LIMIT 1""",
            [f["checked_against"], measure, f["fiscal_year"], f["value_dollars"]],
        ).fetchone()
        return f"obs:{measure}@{row[1]}:{row[0]}" if row else None

    def resolve(self, ref: str, where: str) -> dict:
        kind, _, rid = ref.partition(":")
        if kind not in REF_KINDS or not rid:
            raise ValueError(f"{where}: bad source reference {ref!r}")
        if kind == "asset":
            if rid not in self.assets:
                raise ValueError(f"{where}: unknown asset {rid}")
            ed, url = self.assets[rid]
            return {
                "kind": "asset",
                "id": rid,
                "label": ed,
                "rec": f"asset:{rid}",
                "url": url,
                "provisional": False,
            }
        if kind == "figure":
            f = self.figures.get(rid)
            if f is None:
                raise ValueError(f"{where}: unknown provisional figure {rid}")
            if f["check"] != "not_saved" and f["checked_against"] in self.assets:
                # Checked against the saved document: cite the record that now carries it, or the document itself.
                ed, url = self.assets[f["checked_against"]]
                rec = self._record(f) if f["record"] else None
                return {
                    "kind": "figure", "id": rid, "label": f"{ed}, PDF page {f['checked_page']}: {f['item_as_printed']}",
                    "rec": rec or f"asset:{f['checked_against']}", "url": url, "provisional": False,
                }  # fmt: skip
            self.used_figures.add(rid)
            return {
                "kind": "figure", "id": rid, "label": f"{f['document']}, page {f['page']}: {f['item_as_printed']}",
                "url": f["url"], "page": f["page"], "provisional": True,
            }  # fmt: skip
        if kind == "rate":
            r = self.rates.get(rid)
            if r is None:
                raise ValueError(f"{where}: unknown deposit rate {rid}")
            pinned = r.evidence_ref.startswith("asset:")
            return {
                "kind": "rate", "id": rid, "label": f"{r.statute}: {r.rate:.3%} ({r.evidence})", "status": r.status,
                "rec": r.evidence_ref.split("|")[0] if pinned else None,
                "url": None if pinned else (r.evidence_ref.split("|")[0].removeprefix("url:") or None),
                "provisional": not pinned,
            }  # fmt: skip
        if kind == "url":
            if not rid.startswith("https://"):
                raise ValueError(f"{where}: url references must be https")
            return {"kind": "url", "id": rid, "label": rid, "url": rid, "provisional": True}
        if kind == "lead":
            if rid not in self.leads:
                raise ValueError(f"{where}: unknown lead {rid}")
            return {"kind": "lead", "id": rid, "label": rid, "rec": f"lead:{rid}", "provisional": False}
        if rid not in self.gaps:
            raise ValueError(f"{where}: unknown gap {rid}")
        return {"kind": "gap", "id": rid, "label": rid, "rec": f"gap:{rid}", "provisional": False}


def _values(con, refs: Refs, geo: str, fy: int, spec: dict, where: str) -> list[dict]:
    """Every distinct value a spec gives for one system and year (a conflict keeps all candidates)."""
    if "none" in spec:
        return []
    if "measure" in spec:
        rows = con.execute(
            """SELECT o.value, o.observation_id, o.period_kind, p.observation_id
            FROM observations o
            LEFT JOIN preferred_observations p ON p.geo_id = o.geo_id AND p.measure_id = o.measure_id AND p.year = o.year
              AND p.period_kind = o.period_kind
            WHERE o.geo_id = ? AND o.measure_id = ? AND o.year = ? AND o.period_kind = 'state_fiscal_year'
              AND o.value IS NOT NULL ORDER BY o.value""",
            [geo, spec["measure"], fy],
        ).fetchall()
        if (
            not rows
            and not con.execute("SELECT 1 FROM measures WHERE measure_id = ?", [spec["measure"]]).fetchone()
        ):
            raise ValueError(f"{where}: unknown measure {spec['measure']}")
        pv = con.execute(
            "SELECT value FROM preferred_observations WHERE geo_id = ? AND measure_id = ? AND year = ? AND period_kind = 'state_fiscal_year'",
            [geo, spec["measure"], fy],
        ).fetchall()
        if len(pv) == 1 and pv[0][0] is not None:
            rows = [
                r for r in rows if abs(r[0] - pv[0][0]) < 0.5
            ]  # the build's preferred value; other editions stand aside
        out: list[dict] = []
        for v, oid, pk, pref in rows:
            if not any(abs(o["value"] - v) < 0.5 for o in out):
                out.append(
                    {
                        "value": float(v),
                        "rec": f"obs:{spec['measure']}@{pk}:{pref or oid}",
                        "provisional": False,
                    }
                )
        return out
    if "concept" in spec:
        out = []
        for f in fb.figures(geo, spec["concept"], fy):
            if not any(abs(o["value"] - f["value_dollars"]) < 0.5 for o in out):
                if f["check"] == "not_saved":
                    refs.used_figures.add(f["figure_id"])
                out.append(
                    {
                        "value": f["value_dollars"],
                        "figure_id": f["figure_id"],
                        "url": f["url"],
                        "page": f["page"],
                        "provisional": f["check"] == "not_saved",
                    }
                )
        return out
    if "ratio" in spec:
        num, den = (_values(con, refs, geo, fy, s, where) for s in spec["ratio"])
        out = []
        for a in num:
            for b in den:
                if b["value"]:
                    out.append(
                        {
                            "value": a["value"] / b["value"],
                            "ratio": True,
                            "inputs": [a, b],
                            "provisional": a["provisional"] or b["provisional"],
                        }
                    )
        return out
    raise ValueError(f"{where}: a value spec needs measure, concept, ratio or none")


def build(con, leads: set[str], gaps: set[str]) -> dict | None:
    files = sorted(CONFIG_DIR.glob("*.yaml")) if CONFIG_DIR.is_dir() else []
    if not files:
        return None
    if len(files) != 1:
        raise ValueError(f"{paths.rel(CONFIG_DIR)}: expected one reconciliation, found {len(files)}")
    p: Path = files[0]
    c = yaml.safe_load(p.read_text(encoding="utf-8"))
    has = con.execute(
        "SELECT 1 FROM observations WHERE geo_id = ? AND measure_id = ? LIMIT 1",
        [fb.UT, fb.DABS_MEASURES["sales"]],
    ).fetchone()
    if not has:
        return None  # a build without Utah's DABS figures (the small test build): nothing to reconcile
    refs = Refs(con, leads, gaps)
    problems = fb.check_rates(fb.deposit_rates())
    if problems:
        raise ValueError("; ".join(problems))

    def src(items, where):
        return [refs.resolve(r, where) for r in items or []]

    for f in c.get("findings", []):
        if f["status"] not in fb.STATUSES:
            raise ValueError(f"{p.name}: finding {f['id']}: unknown status {f['status']}")
        f["sources"] = src(f.get("sources"), f"{p.name}: finding {f['id']}")
    fy24 = c.get("fy2024") or {}
    for i, fact in enumerate(fy24.get("facts", [])):
        if fact["status"] not in fb.STATUSES:
            raise ValueError(f"{p.name}: fy2024 fact {i}: unknown status")
        fact["sources"] = src(fact.get("sources"), f"{p.name}: fy2024 fact {i}")
    texts = fy24.get("bases")
    if texts:
        unknown = set(texts) - set(fb.BASES) - {"equation"}
        missing = [b for b in fb.BASES if b not in texts]
        if unknown or missing:
            raise ValueError(f"{p.name}: fy2024 bases: unknown {sorted(unknown)}, missing {missing}")
        for b in fb.BASES:
            st = texts[b].get("status")
            if st is not None and st not in fb.STATUSES:
                raise ValueError(f"{p.name}: fy2024 basis {b}: unknown status {st}")
        fy24["bases"] = {
            "equation": texts["equation"],
            "texts": {b: texts[b] for b in fb.BASES},
            "rows": fb.deposit_bases(con, 2024),
        }
    for s in c.get("sales_tax_basis", []):
        if s["status"] not in fb.STATUSES:
            raise ValueError(f"{p.name}: sales_tax_basis {s['id']}: unknown status")
        s["sources"] = src(s.get("sources"), f"{p.name}: sales_tax_basis {s['id']}")

    peer = c.get("peer")
    if peer:
        for row in peer["rows"]:
            if row["comparable"] not in COMPARABLE:
                raise ValueError(
                    f"{p.name}: peer row {row['id']}: comparable must be one of {sorted(COMPARABLE)}"
                )
            row["values"] = {
                side: {
                    str(fy): _values(
                        con,
                        refs,
                        fb.UT if side == "utah" else peer["geo_id"],
                        fy,
                        row[side],
                        f"{p.name}: {row['id']}",
                    )
                    for fy in peer["years"]
                }
                for side in ("utah", "peer")
            }
            row["utah_label"] = row["utah"].get("label")
            row["peer_label"] = row["peer"].get("label") or row["peer"].get("none")

    bridge = fb.utah_bridge(con)
    notes = {int(k): v for k, v in (c.get("year_notes") or {}).items()}
    outside = sorted(y for y in notes if not 2012 <= y <= 2025)
    if outside:
        raise ValueError(f"{p.name}: year_notes outside FY2012-FY2025: {outside}")
    for r in bridge:
        r["note"] = notes.get(r["fiscal_year"])
    for r in bridge:
        for line in (
            r["dabs_sales"],
            r["reported_deposits"]["school_meals"],
            r["reported_deposits"]["enforcement_fund"],
            r["audited_fund_sales"],
        ):
            for v in line:
                if v.get("figure_id"):
                    refs.used_figures.add(v["figure_id"])
    rates = [
        {
            "rate_id": r.rate_id,
            "deposit": r.deposit,
            "fiscal_year_from": r.fiscal_year_from,
            "fiscal_year_to": r.fiscal_year_to,
            "rate": r.rate,
            "statute": r.statute,
            "text": r.text,
            "evidence": r.evidence,
            "status": r.status,
            "note": r.note,
            "sources": [refs.resolve(x, f"rate {r.rate_id}") for x in r.evidence_ref.split("|") if x],
        }  # fmt: skip
        for r in fb.deposit_rates()
    ]
    docs: dict[str, dict] = {}
    for fid in sorted(refs.used_figures):
        f = refs.figures[fid]
        d = docs.setdefault(
            f["url"],
            {
                "document": f["document"],
                "url": f["url"],
                "read_on": f["read_on"],
                "read_method": f["read_method"],
                "lead_id": f["lead_id"],
                "figures": 0,
            },
        )
        d["figures"] += 1
    for d in docs.values():
        if d["lead_id"] and d["lead_id"] not in leads:
            raise ValueError(f"provisional figures: unknown lead {d['lead_id']}")
    return {
        "method": fb.BRIDGE_METHOD,
        "config_file": paths.rel(p),
        "tolerance_dollars": fb.TOLERANCE_DOLLARS,
        "statuses": fb.STATUSES,
        **{
            k: c.get(k)
            for k in (
                "reconciliation_id",
                "title",
                "checked_on",
                "question",
                "summary",
                "findings",
                "fy2024",
                "sales_tax_basis",
                "corrections",
            )
        },
        "deposit_rates": rates,
        "bridge": bridge,
        "peer": peer,
        "provisional_documents": sorted(docs.values(), key=lambda d: d["document"]),
    }
