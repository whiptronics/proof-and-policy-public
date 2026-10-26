"""Coverage, change and data-dictionary reports."""

from __future__ import annotations

import csv
import io
import json
import zipfile
from pathlib import Path

import duckdb

from alcohol_data import paths
from alcohol_data.schemas import vocab
from alcohol_data.schemas.tables import ALL_TABLES

COVERAGE_CSV = paths.METADATA_DIR / "coverage.csv"
COVERAGE_MD = paths.DOCS_DIR / "coverage-report.md"
DICTIONARY_MD = paths.DOCS_DIR / "data-dictionary.md"


def _con():
    if not paths.DATABASE_PATH.exists():
        raise FileNotFoundError(f"{paths.rel(paths.DATABASE_PATH)} not found; run 'alcohol-data build' first")
    return duckdb.connect(str(paths.DATABASE_PATH), read_only=True)


def coverage_report() -> tuple[Path, Path]:
    con = _con()
    try:
        cols = [d[0] for d in con.execute("SELECT * FROM coverage LIMIT 0").description]
        rows = con.execute("SELECT * FROM coverage ORDER BY source_series, measure_id, geo_level").fetchall()
        build = dict(con.execute("SELECT key, value FROM build_info").fetchall())
        fam = con.execute("""
            SELECT m.source_family, g.geo_level, count(DISTINCT o.measure_id), count(DISTINCT o.geo_id) FILTER (WHERE o.value IS NOT NULL),
                   min(o.year) FILTER (WHERE o.value IS NOT NULL), max(o.year) FILTER (WHERE o.value IS NOT NULL),
                   count(*) FILTER (WHERE o.value IS NOT NULL), count(*) FILTER (WHERE o.value IS NULL)
            FROM preferred_observations o JOIN measures m USING (measure_id) JOIN geographies g USING (geo_id)
            GROUP BY 1, 2 ORDER BY 1, 2""").fetchall()
        tables = {t.name: con.execute(f"SELECT count(*) FROM {t.name}").fetchone()[0] for t in ALL_TABLES}
        exposure = con.execute("""SELECT geo_id, policy_dimension, period_kind, exposure_status, count(*), min(year), max(year)
                                  FROM policy_exposure GROUP BY ALL ORDER BY 1, 2, 3, 4""").fetchall()
    finally:
        con.close()
    with open(COVERAGE_CSV, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(cols)
        w.writerows(rows)
    lines = (
        [
            "# Coverage report",
            "",
            f"Generated from build `{build.get('build_id')}` (code {build.get('code_commit')}, release label {build.get('release_version')}).",
            "Regenerate with `alcohol-data report coverage`. The declared denominator for each series is",
            "geographies with any value x years from its first to last year with a value; cells outside that",
            "range are outside the source's scope, not missing.",
            "",
            "## Table row counts",
            "",
            "| Table | Rows |",
            "|---|---:|",
        ]
        + [f"| {k} | {v:,} |" for k, v in tables.items()]
        + [
            "",
            "## Preferred values by measure family and geography level",
            "",
            "| Family | Geography level | Measures | Geographies with values | First year | Last year | Values | Missing (with reason) |",
            "|---|---|---:|---:|---:|---:|---:|---:|",
        ]
        + [f"| {a} | {b} | {c} | {d} | {e} | {f} | {g:,} | {h:,} |" for a, b, c, d, e, f, g, h in fam]
        + [
            "",
            "## Policy exposure status counts",
            "",
            "| Jurisdiction | Dimension | Period kind | Status | Periods | First | Last |",
            "|---|---|---|---|---:|---:|---:|",
        ]
        + [f"| {a} | {b} | {c} | {d} | {e} | {f} | {g} |" for a, b, c, d, e, f, g in exposure]
        + [
            "",
            "## Coverage by series, measure and geography level",
            "",
            "| Series | Measure | Level | Geos | First | Last | Expected | Observed | Missing w/ reason | Absent | Missing reasons | Gap years |",
            "|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|",
        ]
    )
    for r in rows:
        d = dict(zip(cols, r, strict=True))
        lines.append(
            f"| {d['source_series']} | {d['measure_id']} | {d['geo_level']} | {d['geo_count']} | {d['first_year'] or ''} | "
            f"{d['last_year'] or ''} | {d['expected_cells']:,} | {d['observed_cells']:,} | {d['missing_cells_with_reason']:,} | "
            f"{d['absent_cells']:,} | {d['missing_reasons'] or ''} | {d['interior_gap_years'] or ''} |"
        )
    COVERAGE_MD.parent.mkdir(parents=True, exist_ok=True)
    COVERAGE_MD.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")
    return COVERAGE_MD, COVERAGE_CSV


def data_dictionary(out: Path = DICTIONARY_MD) -> Path:
    lines = [
        "# Data dictionary",
        "",
        "Generated from `src/alcohol_data/schemas/tables.py`, `src/alcohol_data/schemas/vocab.py` and",
        "`metadata/measures.csv` (`alcohol-data report dictionary`). Do not edit by hand.",
        "",
        "Conventions: geographic IDs are strings (state FIPS keep their leading zero: `state:06`, not `state:6`);",
        "dates are ISO `YYYY-MM-DD`; timestamps are UTC; a missing value is an empty cell with a reason in",
        "`missing_reason`, and `0` is always a real zero. Spreadsheet programs may strip leading zeros from",
        "codes such as `06` when opening the CSV; import those columns as text.",
        "",
        "## Tables",
        "",
    ]
    for t in ALL_TABLES:
        lines += [f"### `{t.name}`", "", t.description, ""]
        if t.primary_key:
            lines += [f"Primary key: `{', '.join(t.primary_key)}`.", ""]
        lines += ["| Column | Type | Required | Description |", "|---|---|---|---|"]
        lines += [
            f"| `{c.name}` | {c.type} | {'yes' if not c.nullable else ''} | {c.description} |"
            for c in t.columns
        ]
        lines.append("")
    lines += [
        "### Views",
        "",
        "- `preferred_observations`: one row per cell (geography x measure x period x subgroup) chosen by",
        "  `preferred_selection`; conflicting cells appear with `value` NULL and `missing_reason = unresolved_conflict`.",
        "- `state_year_long`: preferred state values with labels and units, long format (excludes monthly CPI).",
        "- `fiscal_components`: finance measures side by side with what each includes and overlaps. No totals.",
        "- `build_info` (table): build identifier, code commit, schema version, pins digest.",
        "",
        "## Controlled vocabularies",
        "",
    ]
    for name, d in [
        ("estimate_type", vocab.ESTIMATE_TYPES),
        ("extraction_method", vocab.EXTRACTION_METHODS),
        ("missing_reason", vocab.MISSING_REASONS),
        ("period_kind", vocab.PERIOD_KINDS),
        ("geo_level", vocab.GEO_LEVELS),
        ("rights_status", vocab.RIGHTS_STATUSES),
        ("extraction_status", vocab.EXTRACTION_STATUSES),
        ("temporal_status", vocab.TEMPORAL_STATUSES),
        ("legal_review_status", vocab.LEGAL_REVIEW_STATUSES),
        ("claim_status", vocab.CLAIM_STATUSES),
        ("exposure_status", vocab.POLICY_EXPOSURE_STATUSES),
    ]:
        lines += [f"### {name}", ""] + [f"- `{k}`: {v}" for k, v in d.items()] + [""]
    lines += [
        "## Measures",
        "",
        "| Measure | Label | Unit | Beverage | Age universe | Method | Definition |",
        "|---|---|---|---|---|---|---|",
    ]
    with open(paths.METADATA_DIR / "measures.csv", encoding="utf-8", newline="") as f:
        for m in csv.DictReader(f):
            lines.append(
                f"| `{m['measure_id']}` | {m['label']} | {m['unit']} | {m['beverage']} | {m['age_universe']} | "
                f"{m['method_family']} | {m['definition'].replace('|', '/')} |"
            )
    out.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")
    return out


def _load_previous_observations(con: duckdb.DuckDBPyConnection, against: Path) -> None:
    d = against if against.is_dir() else against.parent
    pz = d / "parquet.zip"
    cz = d / "csv.zip"
    tmp = paths.STAGING_DIR / "previous_release"
    tmp.mkdir(parents=True, exist_ok=True)
    if pz.exists():
        with zipfile.ZipFile(pz) as z:
            name = next(n for n in z.namelist() if n.endswith("observations.parquet"))
            target = tmp / "observations.parquet"
            target.write_bytes(z.read(name))
        con.execute(f"CREATE TEMP TABLE prev AS SELECT * FROM read_parquet('{target.as_posix()}')")
    elif cz.exists():
        with zipfile.ZipFile(cz) as z:
            name = next(n for n in z.namelist() if n.endswith("observations.csv"))
            target = tmp / "observations.csv"
            target.write_bytes(z.read(name))
        con.execute(
            f"CREATE TEMP TABLE prev AS SELECT * FROM read_csv('{target.as_posix()}', header=true, all_varchar=false)"
        )
    else:
        raise FileNotFoundError(f"no parquet.zip or csv.zip next to {against}")


def changes_report(against: Path, out: Path | None = None) -> tuple[Path, dict]:
    against = Path(against)
    manifest_path = against / "manifest.json" if against.is_dir() else against
    prev_manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    con = duckdb.connect()
    con.execute(f"ATTACH '{paths.DATABASE_PATH.as_posix()}' AS cur (READ_ONLY)")
    _load_previous_observations(con, against)
    key = "geo_id, measure_id, period_start, period_end, subgroup, source_series, source_vintage"
    added = con.execute(f"SELECT count(*) FROM cur.observations c ANTI JOIN prev p USING ({key})").fetchone()[
        0
    ]
    removed = con.execute(
        f"SELECT count(*) FROM prev p ANTI JOIN cur.observations c USING ({key})"
    ).fetchone()[0]
    changed_rows = con.execute(f"""SELECT c.measure_id, c.geo_id, c.period_label, c.source_vintage, p.value, c.value
        FROM cur.observations c JOIN prev p USING ({key})
        WHERE c.value IS DISTINCT FROM p.value ORDER BY 1, 2, 3 LIMIT 200""").fetchall()
    changed = con.execute(f"""SELECT count(*) FROM cur.observations c JOIN prev p USING ({key})
        WHERE c.value IS DISTINCT FROM p.value""").fetchone()[0]
    con.close()
    cur_summary = json.loads((paths.PROCESSED_DIR / "build_summary.json").read_text(encoding="utf-8"))
    prev_inputs = {i["asset_id"]: i.get("sha256") for i in prev_manifest.get("inputs", [])}
    cur_inputs = {i["asset_id"]: i.get("sha256") for i in cur_summary.get("inputs", [])}
    input_changes = sorted(
        a for a in set(prev_inputs) | set(cur_inputs) if prev_inputs.get(a) != cur_inputs.get(a)
    )
    counts = {"added": added, "removed": removed, "revised": changed, "inputs_changed": len(input_changes)}
    buf = io.StringIO()
    buf.write(f"# Changes against release {prev_manifest.get('release_version')}\n\n")
    buf.write(
        f"Previous build `{prev_manifest.get('build', {}).get('build_id')}`; current build `{cur_summary.get('build_id')}`.\n\n"
    )
    buf.write(
        f"- Observations added: {added:,}\n- Observations removed: {removed:,}\n- Values revised: {changed:,}\n"
    )
    buf.write(f"- Input assets whose bytes changed: {len(input_changes)}\n\n")
    if input_changes:
        buf.write(
            "## Changed inputs\n\n"
            + "".join(f"- `{a}`: {prev_inputs.get(a)} -> {cur_inputs.get(a)}\n" for a in input_changes)
            + "\n"
        )
    if changed_rows:
        buf.write(
            "## Revised values (first 200)\n\n| Measure | Geography | Period | Edition | Previous | Current |\n|---|---|---|---|---:|---:|\n"
        )
        buf.write("".join(f"| {a} | {b} | {c} | {d} | {e} | {f} |\n" for a, b, c, d, e, f in changed_rows))
    out = out or paths.PROCESSED_DIR / "changes_report.md"
    out.write_text(buf.getvalue(), encoding="utf-8", newline="\n")
    return out, counts
