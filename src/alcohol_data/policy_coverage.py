"""Policy coverage matrix: for every catalogued dimension and every state, what is actually known.

Three kinds of knowledge are kept apart:

* verified history: days covered by policy_events intervals (policy_segments), counted from 2000-01-01;
* dated snapshots: the status a source shows on one day (policy_snapshots), which say nothing about other
  days;
* nothing coded.

A snapshot that disagrees with a verified interval on the same day is flagged. Nationwide current
coverage is never presented as historical coverage.

Writes metadata/policy_coverage.csv and docs/policy-coverage.md (`alcohol-data report policy-coverage`).
"""

from __future__ import annotations

import csv
from collections import defaultdict
from datetime import date
from pathlib import Path

import duckdb

from alcohol_data import paths

CSV_OUT = paths.METADATA_DIR / "policy_coverage.csv"
MD_OUT = paths.DOCS_DIR / "policy-coverage.md"
HISTORY_FROM = date(2000, 1, 1)
COLUMNS = [
    "policy_dimension",
    "domain",
    "geo_id",
    "state",
    "status",
    "verified_days_since_2000",
    "possible_days_since_2000",
    "first_verified_day",
    "last_verified_day",
    "snapshots",
    "latest_snapshot_on",
    "latest_snapshot_value",
    "latest_snapshot_support",
    "values_seen",
    "disagreements",
]
# Dimensions shown as columns of the summary matrix in the Markdown report.
MATRIX = [
    ("ordinary_grocery_wine_authorization", "Grocery wine"),
    ("ordinary_grocery_beer_authorization", "Grocery beer"),
    ("ordinary_grocery_spirits_authorization", "Grocery spirits"),
    ("ordinary_convenience_wine_authorization", "Convenience wine"),
    ("spirits_off_premise_retail_system", "Spirits retail"),
    ("wine_off_premise_retail_system", "Wine retail"),
    ("spirits_wholesale_system", "Spirits wholesale"),
]
SHORT = {
    "not_authorized": "no",
    "authorized": "yes",
    "authorized_local_option": "local opt",
    "conditional_or_special_channel": "special",
    "chains_and_supermarkets_barred": "chains barred",
    "state_operated_stores": "state",
    "state_stores_and_contract_agencies": "state+agency",
    "state_contract_agencies_only": "agency",
    "local_government_stores": "local govt",
    "private_licensed": "private",
    "mixed_state_and_private": "mixed",
    "mixed_local_government_and_private": "local govt+private",
    "state_operated": "state",
    "mixed": "mixed",
}


def compute(con: duckdb.DuckDBPyConnection) -> list[dict]:
    as_of = date.fromisoformat(
        con.execute("SELECT value FROM build_info WHERE key = 'as_of_date'").fetchone()[0]
    )
    possible = (as_of - HISTORY_FROM).days + 1
    dims = con.execute(
        "SELECT dimension_id, domain FROM policy_dimensions ORDER BY domain, dimension_id"
    ).fetchall()
    states = con.execute(
        "SELECT geo_id, coalesce(abbreviation, name) FROM geographies WHERE geo_level = 'state' ORDER BY name"
    ).fetchall()
    segs = defaultdict(list)
    for g, d, a, b, st in con.execute(
        "SELECT geo_id, policy_dimension, segment_start, segment_end, state FROM policy_segments"
    ).fetchall():
        segs[(g, d)].append((a, b, st))
    snaps = defaultdict(list)
    for g, d, v, on, yr, sup in con.execute(
        "SELECT geo_id, policy_dimension, policy_value, observed_on, observed_year, support_basis FROM policy_snapshots"
    ).fetchall():
        snaps[(g, d)].append((v, on, yr, sup))
    rows = []
    for dim, domain in dims:
        for geo, abbr in states:
            verified = [
                (max(a, HISTORY_FROM), min(b, as_of), st)
                for a, b, st in segs.get((geo, dim), [])
                if st not in ("unknown", "disputed") and b >= HISTORY_FROM
            ]
            days = sum((b - a).days + 1 for a, b, _ in verified if b >= a)
            ss = snaps.get((geo, dim), [])
            dated = sorted((s for s in ss if s[1] is not None), key=lambda s: s[1])
            # Latest by year; within a year a dated snapshot outranks one known only to the year.
            latest = max(ss, key=lambda s: (s[2], s[1] is not None, s[1] or date.min)) if ss else None
            disagreements = 0
            for v, on, _yr, _sup in dated:
                for a, b, st in segs.get((geo, dim), []):
                    if a <= on <= b and st not in ("unknown", "disputed") and st != v:
                        disagreements += 1
            if days:
                status = "verified_history"
            elif ss:
                status = "snapshot_only"
            else:
                status = "not_coded"
            rows.append(
                {
                    "policy_dimension": dim,
                    "domain": domain,
                    "geo_id": geo,
                    "state": abbr,
                    "status": status,
                    "verified_days_since_2000": days,
                    "possible_days_since_2000": possible,
                    "first_verified_day": min((a for a, _, _ in verified), default=""),
                    "last_verified_day": max((b for _, b, _ in verified), default=""),
                    "snapshots": len(ss),
                    "latest_snapshot_on": (latest[1] or latest[2]) if latest else "",
                    "latest_snapshot_value": latest[0] if latest else "",
                    "latest_snapshot_support": latest[3] if latest else "",
                    "values_seen": "|".join(sorted({s[0] for s in ss} | {st for _, _, st in verified})),
                    "disagreements": disagreements,
                }
            )
    return rows


def write_report(con: duckdb.DuckDBPyConnection | None = None) -> tuple[Path, Path]:
    own = con is None
    if own:
        con = duckdb.connect(str(paths.DATABASE_PATH), read_only=True)
    try:
        rows = compute(con)
        build = dict(con.execute("SELECT key, value FROM build_info").fetchall())
        labels = dict(con.execute("SELECT dimension_id, label FROM policy_dimensions").fetchall())
    finally:
        if own:
            con.close()
    with open(CSV_OUT, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS, lineterminator="\n")
        w.writeheader()
        w.writerows(rows)
    by_dim = defaultdict(list)
    for r in rows:
        by_dim[r["policy_dimension"]].append(r)
    n_states = len({r["geo_id"] for r in rows})
    lines = [
        "# Policy coverage matrix",
        "",
        f"Generated from build `{build.get('build_id')}` (law as of {build.get('as_of_date')}). Regenerate with",
        "`alcohol-data report policy-coverage`. Detail: `metadata/policy_coverage.csv`.",
        "",
        "Three kinds of knowledge, never merged:",
        "",
        "- **Verified history**: days covered by evidence of continuity (intervals). Counted here from",
        "  2000-01-01 to the as-of date.",
        "- **Snapshot only**: a source shows the status on one day. Earlier and later days stay unknown.",
        "- **Not coded**: nothing recorded. The status is unknown, not absent.",
        "",
        "Nationwide snapshots of current law are not historical coverage. A state with a 2026 snapshot and no",
        "intervals has zero verified days.",
        "",
        "## By dimension",
        "",
        f"| Dimension | Verified history | Snapshot only | Not coded | Verified days since 2000 (all {n_states} states) |",
        "|---|---|---|---|---|",
    ]
    for dim in sorted(by_dim, key=lambda d: (by_dim[d][0]["domain"], d)):
        rs = by_dim[dim]
        counts = defaultdict(int)
        for r in rs:
            counts[r["status"]] += 1
        days = sum(r["verified_days_since_2000"] for r in rs)
        possible = sum(r["possible_days_since_2000"] for r in rs)
        lines.append(
            f"| {labels.get(dim, dim)} (`{dim}`) | {counts['verified_history']} | {counts['snapshot_only']} | "
            f"{counts['not_coded']} | {days:,} of {possible:,} ({100 * days / possible:.1f}%) |"
        )
    lines += [
        "",
        "## Current-status matrix (latest snapshot or verified value)",
        "",
        "Cells show the latest known value and its date (a year alone means the source gives only a year). A",
        "dagger (†) gives the verified days since 2000; a value with only a date is a snapshot. An asterisk (*) means the",
        "source creates a general retail license and the outlet type's eligibility is inferred from the absence",
        "of a restriction; a tilde (~) means the text implies the status without stating it. A dash means nothing",
        "is coded.",
        "",
        "| State | " + " | ".join(lab for _, lab in MATRIX) + " |",
        "|---|" + "---|" * len(MATRIX),
    ]
    idx = {(r["policy_dimension"], r["geo_id"]): r for r in rows}
    for geo, abbr in sorted({(r["geo_id"], r["state"]) for r in rows}, key=lambda x: x[1]):
        cells = []
        for dim, _ in MATRIX:
            r = idx.get((dim, geo))
            if not r or r["status"] == "not_coded":
                cells.append("—")
            elif r["latest_snapshot_value"]:
                mark = {"no_outlet_restriction": "*", "indirect": "~"}.get(r["latest_snapshot_support"], "")
                cells.append(
                    f"{SHORT.get(r['latest_snapshot_value'], r['latest_snapshot_value'])}{mark}"
                    f" ({r['latest_snapshot_on']})"
                )
                if r["verified_days_since_2000"]:
                    cells[-1] += f"; † {r['first_verified_day']} to {r['last_verified_day']}"
            else:
                vals = r["values_seen"].split("|")[-1]
                cells.append(
                    f"{SHORT.get(vals, vals)} † {r['first_verified_day']} to {r['last_verified_day']}"
                )
            if r and r["disagreements"]:
                cells[-1] += " ⚠"
        lines.append(f"| {abbr} | " + " | ".join(cells) + " |")
    lines += ["", "⚠ = a snapshot disagrees with a verified interval on the same day.", ""]
    MD_OUT.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")
    return CSV_OUT, MD_OUT
