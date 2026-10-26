"""Completeness by metric, jurisdiction, year and definition.

The coverage table summarizes a series by its first and last year. That hides gaps inside the span,
jurisdictions that are missing, and definitions that change. This report keeps them:

* metadata/completeness.csv: one row per measure x period kind x jurisdiction. For each one it gives
  - the years the series spans (any jurisdiction has a row);
  - the years with a value, observed zeros, missing values by reason and absent years, as ranges;
  - the comparability groups with their year ranges.
* metadata/series_breaks.csv: every change of comparability group inside a measure. A break shared by
  every jurisdiction in the series is listed once, with geo_id '*'. It also lists every change of
  definition between the measures of one concept (metadata/measure_concepts.csv), such as BRFSS binge
  drinking in 2006 or Tennessee account 11002 in FY2018.
* docs/completeness.md: the same, summarized per concept for reading.

Nothing here fills, joins or interpolates. A year is "absent" when the series has rows for some
jurisdiction that year but none for this one.
"""

from __future__ import annotations

import csv
from collections import defaultdict
from pathlib import Path

import duckdb

from alcohol_data import paths

CONCEPTS_CSV = paths.METADATA_DIR / "measure_concepts.csv"
COMPLETENESS_CSV = paths.METADATA_DIR / "completeness.csv"
BREAKS_CSV = paths.METADATA_DIR / "series_breaks.csv"
COMPLETENESS_MD = paths.DOCS_DIR / "completeness.md"

COLUMNS = [
    "concept_id",
    "measure_id",
    "period_kind",
    "geo_id",
    "geo_level",
    "series_first_year",
    "series_last_year",
    "span_years",
    "years_with_value",
    "observed_zeros",
    "missing_with_reason",
    "missing_reasons",
    "absent_years",
    "value_years",
    "missing_years",
    "absent_ranges",
    "comparability_groups",
]
BREAK_COLUMNS = ["kind", "concept_id", "measure_id", "period_kind", "geo_id", "year", "from", "to", "note"]


def ranges(years: list[int]) -> str:
    """'1990-1995|1998|2001-2003' for a sorted list of years ('' when empty)."""
    out, start, prev = [], None, None
    for y in sorted(years):
        if start is None:
            start = prev = y
        elif y == prev + 1:
            prev = y
        else:
            out.append(f"{start}" if start == prev else f"{start}-{prev}")
            start = prev = y
    if start is not None:
        out.append(f"{start}" if start == prev else f"{start}-{prev}")
    return "|".join(out)


def load_concepts() -> dict[str, dict]:
    if not CONCEPTS_CSV.is_file():
        return {}
    with open(CONCEPTS_CSV, encoding="utf-8", newline="") as f:
        return {r["measure_id"]: r for r in csv.DictReader(f)}


def compute(con: duckdb.DuckDBPyConnection) -> tuple[list[dict], list[dict]]:
    concepts = load_concepts()
    rows = con.execute(
        """
        SELECT p.measure_id, p.period_kind, p.geo_id, g.geo_level, p.year, p.value, p.missing_reason,
               p.comparability_group
        FROM preferred_observations p JOIN geographies g USING (geo_id)
        WHERE p.period_kind <> 'month' AND p.subgroup = 'all'
        ORDER BY p.measure_id, p.period_kind, p.geo_id, p.year
        """
    ).fetchall()
    by_series: dict[tuple[str, str], list[tuple]] = defaultdict(list)
    for r in rows:
        by_series[(r[0], r[1])].append(r)
    out, breaks = [], []
    for (measure, pk), rs in sorted(by_series.items()):
        concept = concepts.get(measure, {}).get("concept_id", measure)
        # Spans are per geography level: national rows reaching back further must not make every state
        # look incomplete.
        level_span = defaultdict(set)
        for r in rs:
            level_span[r[3]].add(r[4])
        by_geo: dict[str, list[tuple]] = defaultdict(list)
        for r in rs:
            by_geo[r[2]].append(r)
        geo_breaks: dict[str, list[tuple[int, str, str]]] = {}
        for geo, grs in sorted(by_geo.items()):
            span = sorted(level_span[grs[0][3]])
            years = {r[4]: r for r in grs}
            value_years = sorted(y for y, r in years.items() if r[5] is not None)
            zeros = sum(1 for r in grs if r[5] == 0)
            missing = sorted(y for y, r in years.items() if r[5] is None)
            reasons: dict[str, int] = defaultdict(int)
            for r in grs:
                if r[5] is None:
                    reasons[r[6] or "unspecified"] += 1
            absent = [y for y in span if y not in years]
            groups: dict[str, list[int]] = defaultdict(list)
            seq: list[tuple[int, str]] = []
            for y in sorted(years):
                groups[years[y][7]].append(y)
                seq.append((y, years[y][7]))
            gb = [(y, a, b) for (_, a), (y, b) in zip(seq, seq[1:], strict=False) if a != b]
            geo_breaks[geo] = gb
            out.append(
                {
                    "concept_id": concept,
                    "measure_id": measure,
                    "period_kind": pk,
                    "geo_id": geo,
                    "geo_level": grs[0][3],
                    "series_first_year": span[0],
                    "series_last_year": span[-1],
                    "span_years": len(span),
                    "years_with_value": len(value_years),
                    "observed_zeros": zeros,
                    "missing_with_reason": len(missing),
                    "missing_reasons": "|".join(f"{k}:{v}" for k, v in sorted(reasons.items())),
                    "absent_years": len(absent),
                    "value_years": ranges(value_years),
                    "missing_years": ranges(missing),
                    "absent_ranges": ranges(absent),
                    "comparability_groups": "|".join(
                        f"{g}:{ranges(ys)}" for g, ys in sorted(groups.items(), key=lambda kv: kv[1][0])
                    ),
                }
            )
        # Group changes, one row per (year, from, to): '*' when every jurisdiction observed in both groups
        # has the change, otherwise the pipe-separated jurisdictions that do.
        in_group: dict[str, set[str]] = defaultdict(set)
        for r in rs:
            in_group[r[7]].add(r[2])
        changes: dict[tuple[int, str, str], set[str]] = defaultdict(set)
        for geo, gb in geo_breaks.items():
            for y, a, b in gb:
                changes[(y, a, b)].add(geo)
        for (y, a, b), geos in sorted(changes.items()):
            both = in_group[a] & in_group[b]
            where = "*" if geos == both else "|".join(sorted(geos))
            same_report = a.split(":")[0] == b.split(":")[0] and ":" in a
            note = "preferred value comes from a different table of the same report" if same_report else ""
            breaks.append(_brk("comparability_group_change", concept, measure, pk, where, y, a, b, note))
    # Definition changes between measures of one concept.
    spans = defaultdict(dict)
    for r in out:
        s = spans[(r["concept_id"], r["period_kind"])].setdefault(r["measure_id"], [10**6, -1])
        s[0] = min(s[0], r["series_first_year"])
        s[1] = max(s[1], r["series_last_year"])
    for (cid, pk), ms in sorted(spans.items()):
        seq = sorted(ms, key=lambda m: (int(concepts.get(m, {}).get("sequence", 1)), ms[m][0]))
        for a, b in zip(seq, seq[1:], strict=False):
            note = concepts.get(b, {}).get("break_note", "")
            breaks.append(
                _brk(
                    "definition_change",
                    cid,
                    b,
                    pk,
                    "*",
                    ms[b][0],
                    f"{a} ({concepts.get(a, {}).get('definition_label', '')}, to {ms[a][1]})",
                    f"{b} ({concepts.get(b, {}).get('definition_label', '')})",
                    note,
                )
            )
    breaks.sort(key=lambda x: (x["concept_id"], x["measure_id"], x["period_kind"], x["year"], x["geo_id"]))
    return out, breaks


def _brk(kind, concept, measure, pk, geo, year, a, b, note) -> dict:
    return {
        "kind": kind,
        "concept_id": concept,
        "measure_id": measure,
        "period_kind": pk,
        "geo_id": geo,
        "year": year,
        "from": a,
        "to": b,
        "note": note,
    }


def write_reports(con: duckdb.DuckDBPyConnection | None = None) -> tuple[Path, Path, Path]:
    own = con is None
    if own:
        con = duckdb.connect(str(paths.DATABASE_PATH), read_only=True)
    try:
        rows, breaks = compute(con)
        build = dict(con.execute("SELECT key, value FROM build_info").fetchall())
        labels = dict(con.execute("SELECT measure_id, label FROM measures").fetchall())
        names = dict(con.execute("SELECT geo_id, coalesce(abbreviation, name) FROM geographies").fetchall())
        all_states = [
            r[0] for r in con.execute("SELECT geo_id FROM geographies WHERE geo_level = 'state'").fetchall()
        ]
    finally:
        if own:
            con.close()
    for path, cols, data in ((COMPLETENESS_CSV, COLUMNS, rows), (BREAKS_CSV, BREAK_COLUMNS, breaks)):
        with open(path, "w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=cols, lineterminator="\n")
            w.writeheader()
            w.writerows(data)
    _write_markdown(rows, breaks, build, labels, names, all_states)
    return COMPLETENESS_CSV, BREAKS_CSV, COMPLETENESS_MD


def _md(text) -> str:
    """Escape a value for a Markdown table cell."""
    return str(text).replace("|", "\\|")


def _write_markdown(rows, breaks, build, labels, names, all_states) -> None:
    concepts = load_concepts()
    by_series: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for r in rows:
        by_series[(r["measure_id"], r["period_kind"])].append(r)
    by_concept: dict[str, list[tuple[str, str]]] = defaultdict(list)
    for key in by_series:
        by_concept[concepts.get(key[0], {}).get("concept_id", key[0])].append(key)
    lines = [
        "# Completeness by metric, jurisdiction, year and definition",
        "",
        f"Generated from build `{build.get('build_id')}` (code {build.get('code_commit')}). Regenerate with",
        "`alcohol-data report completeness`. Machine-readable detail: `metadata/completeness.csv` (one row per",
        "metric and jurisdiction, with year ranges) and `metadata/series_breaks.csv`.",
        "",
        "How to read it:",
        "",
        "- The **span** of a series is the set of years in which any jurisdiction has a row. A jurisdiction",
        "  inside the series is complete only if it has a value in every span year.",
        "- **Missing** means a row exists with a published reason (e.g. not published, suppressed).",
        "- **Absent** means the series has rows that year for other jurisdictions but none for this one.",
        "- A jurisdiction with no row at all is **not in the series**. That is coverage, not missingness.",
        "- Definition changes are listed under each concept and are never joined into one trend.",
        "",
        f"States and DC: {len(all_states)}. Only state-level and national rows are summarized here; regional",
        "rows are in the CSV.",
        "",
        "## Definition changes and series breaks",
        "",
        "| Concept | Year | Kind | From | To | Jurisdictions | Note |",
        "|---|---|---|---|---|---|---|",
    ]
    for b in breaks:
        lines.append(
            f"| {b['concept_id']} | {b['year']} | {b['kind'].replace('_', ' ')} | {_md(b['from'])} | {_md(b['to'])} | "
            f"{'all in series' if b['geo_id'] == '*' else _md(', '.join(names.get(g, g) for g in b['geo_id'].split('|')))} | "
            f"{_md(b['note'])} |"
        )
    lines += ["", "## Metrics", ""]
    for cid in sorted(by_concept):
        keys = sorted(by_concept[cid], key=lambda k: (int(concepts.get(k[0], {}).get("sequence", 1)), k[1]))
        clabel = concepts.get(keys[0][0], {}).get("concept_label", labels.get(keys[0][0], cid))
        lines += [f"### {clabel}", ""]
        if len({k[0] for k in keys}) > 1:
            for k in keys:
                c = concepts.get(k[0], {})
                lines.append(
                    f"- `{k[0]}`: {c.get('definition_label', '')}. {c.get('break_note', '')}".rstrip()
                )
            lines.append("")
        elif concepts.get(keys[0][0], {}).get("break_note"):
            lines += [f"Note: {concepts[keys[0][0]]['break_note']}", ""]
        lines += [
            "| Measure | Period | Span | States in series | Complete states | Partial states | Not in series |"
            " Value-years / possible | Missing (reasons) | Absent |",
            "|---|---|---|---|---|---|---|---|---|---|",
        ]
        for k in keys:
            rs = [r for r in by_series[k] if r["geo_level"] == "state"]
            if not rs:
                rs_n = [r for r in by_series[k] if r["geo_level"] != "state"]
                span = f"{rs_n[0]['series_first_year']}-{rs_n[0]['series_last_year']}" if rs_n else ""
                lines.append(f"| `{k[0]}` | {k[1]} | {span} | 0 | 0 | 0 | {len(all_states)} | — | — | — |")
                continue
            complete = [r for r in rs if r["years_with_value"] == r["span_years"]]
            partial = [r for r in rs if 0 < r["years_with_value"] < r["span_years"]]
            possible = sum(r["span_years"] for r in rs)
            have = sum(r["years_with_value"] for r in rs)
            reasons: dict[str, int] = defaultdict(int)
            for r in rs:
                for part in filter(None, r["missing_reasons"].split("|")):
                    name, n = part.rsplit(":", 1)
                    reasons[name] += int(n)
            reason_text = ", ".join(f"{n} {k2.replace('_', ' ')}" for k2, n in sorted(reasons.items())) or "0"
            absent = sum(r["absent_years"] for r in rs)
            lines.append(
                f"| `{k[0]}` | {k[1].replace('_', ' ')} | {rs[0]['series_first_year']}-{rs[0]['series_last_year']} "
                f"({rs[0]['span_years']} yrs) | {len(rs)} | {len(complete)} | {len(partial)} | "
                f"{len(all_states) - len(rs)} | {have:,} / {possible:,} | {reason_text} | {absent} |"
            )
        gaps = []
        for k in keys:
            for r in by_series[k]:
                if r["geo_level"] == "state" and (r["absent_ranges"] or r["missing_years"]):
                    detail = []
                    if r["missing_years"]:
                        detail.append(f"missing {r['missing_years']}")
                    if r["absent_ranges"]:
                        detail.append(f"absent {r['absent_ranges']}")
                    text = "; ".join(detail).replace("|", ", ")
                    gaps.append(f"`{k[0]}` {names.get(r['geo_id'], r['geo_id'])}: {text}")
        if gaps:
            shown = gaps[:25]
            lines += ["", "Gaps inside the span (state level):", ""] + [f"- {g}" for g in shown]
            if len(gaps) > len(shown):
                lines.append(f"- … {len(gaps) - len(shown)} more in metadata/completeness.csv")
        lines.append("")
    COMPLETENESS_MD.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")
