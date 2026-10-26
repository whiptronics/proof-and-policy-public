"""Assemble a release: dist/<version>/ with zipped tables, the database, manifest, checksums and docs.

Packaging refuses to run when release validation has errors. Raw source files are
not bundled (several are large and some may not be redistributed); the manifest
lists every input's URL and SHA-256 so it can be re-acquired and verified.
"""

from __future__ import annotations

import hashlib
import json
import shutil
import zipfile
from datetime import UTC, datetime
from pathlib import Path

import duckdb

from alcohol_data import SCHEMA_VERSION, __version__, paths
from alcohol_data.config import load_all_sources, load_build
from alcohol_data.exports.export import export_all, export_objects
from alcohol_data.reports import coverage_report, data_dictionary
from alcohol_data.validation.checks import run_checks, write_validation_report

FIXED_ZIP_TIME = (1980, 1, 1, 0, 0, 0)
DOC_FILES = [
    "docs/limitations.md",
    "docs/reproduction.md",
    "docs/fiscal-reconciliation.md",
    "docs/policy-coding-guide.md",
    "docs/coverage-audit.md",
    "DATA_LICENSE.md",
    "THIRD_PARTY_NOTICES.md",
    "CITATION.cff",
    "metadata/source_registry.csv",
    "metadata/rights_registry.csv",
    "metadata/coverage.csv",
    "metadata/measures.csv",
    "metadata/legal_history/utah_code_versions.csv",
    "metadata/legal_history/utah_code_claims.csv",
    "metadata/legal_history/utah_session_inventory.csv",
    "metadata/legal_history/utah_enactments.csv",
    "metadata/legal_history/utah_reconstructed_versions.csv",
    "metadata/legal_history/utah_title32a_crosswalk.csv",
    "docs/methods/legal-history.md",
    "docs/review/utah-policy-review-packet.md",
    "docs/sources/utah-historical-source-catalog.md",
    "docs/gaps/utah-missing-records.md",
]
EXAMPLES = Path(__file__).resolve().parent / "examples"


class PackageError(RuntimeError):
    pass


def sha256_file(p: Path) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def deterministic_zip(src_dir: Path, zip_path: Path, prefix: str) -> None:
    files = sorted(p for p in src_dir.rglob("*") if p.is_file())
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for p in files:
            info = zipfile.ZipInfo(f"{prefix}/{p.relative_to(src_dir).as_posix()}", date_time=FIXED_ZIP_TIME)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            z.writestr(info, p.read_bytes(), compresslevel=9)


def release_gates(source_ids: list[str]) -> list[tuple[str, str]]:
    """Sources in the build that a release may not include yet, with the reason."""
    sources = load_all_sources()
    return [
        (sid, " ".join(sources[sid].release_gate.split()))
        for sid in source_ids
        if sid in sources and sources[sid].release_gate
    ]


def package_release(version: str, config: Path) -> Path:
    build = load_build(config)
    summary_path = paths.PROCESSED_DIR / "build_summary.json"
    if not summary_path.exists():
        raise PackageError("no build found; run 'alcohol-data build' first")
    summary = json.loads(summary_path.read_text(encoding="utf-8"))

    gated = release_gates(build.sources)
    if gated:
        raise PackageError(
            "release gated by the owner's pending decision: "
            + "; ".join(f"{sid}: {why}" for sid, why in gated)
        )

    results = run_checks(profile="release")
    write_validation_report(results, "release")
    errors = [r for r in results if r.failed and r.severity == "error"]
    if errors:
        raise PackageError(
            "release validation failed: " + "; ".join(f"{r.name}: {r.summary}" for r in errors)
        )

    coverage_report()
    data_dictionary()
    from alcohol_data.descriptive import descriptive_outputs

    descriptive_outputs()

    out = paths.DIST_DIR / version
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    staging = paths.STAGING_DIR / f"release-{version}"
    if staging.exists():
        shutil.rmtree(staging)
    export_all(["csv", "parquet", "duckdb"], out_dir=staging)

    name = f"alcohol-policy-revenue-data-{version}"
    deterministic_zip(staging / "csv", out / "csv.zip", f"{name}-csv")
    deterministic_zip(staging / "parquet", out / "parquet.zip", f"{name}-parquet")
    shutil.copyfile(staging / "alcohol_data.duckdb", out / "alcohol_data.duckdb")

    docs = out / "docs"
    docs.mkdir()
    for rel in DOC_FILES + ["docs/data-dictionary.md", "docs/coverage-report.md"]:
        src = paths.ROOT / rel
        if src.exists():
            shutil.copyfile(src, docs / src.name)
    shutil.copyfile(paths.PROCESSED_DIR / "validation_report.md", docs / "validation_report.md")
    ex = out / "examples"
    shutil.copytree(EXAMPLES, ex)
    shutil.copytree(paths.PROCESSED_DIR / "descriptive", out / "descriptive")

    con = duckdb.connect(str(out / "alcohol_data.duckdb"), read_only=True)
    try:
        table_rows = {n: con.execute(f"SELECT count(*) FROM {n}").fetchone()[0] for n in export_objects()}
        families = con.execute("""SELECT m.source_family, count(DISTINCT p.measure_id),
                                         count(DISTINCT p.geo_id) FILTER (WHERE p.value IS NOT NULL AND p.geo_id LIKE 'state:%'),
                                         min(p.year) FILTER (WHERE p.value IS NOT NULL), max(p.year) FILTER (WHERE p.value IS NOT NULL),
                                         count(*) FILTER (WHERE p.value IS NOT NULL)
                                  FROM preferred_observations p JOIN measures m USING (measure_id) GROUP BY 1 ORDER BY 1""").fetchall()
        conflicts = con.execute(
            "SELECT count(*) FROM preferred_observations WHERE missing_reason = 'unresolved_conflict'"
        ).fetchone()[0]
        policies = con.execute(
            "SELECT legal_review_status, count(*) FROM policy_events GROUP BY 1 ORDER BY 1"
        ).fetchall()
        manual = con.execute(
            "SELECT count(*) FROM observations WHERE extraction_method = 'manual'"
        ).fetchone()[0]
    finally:
        con.close()

    table_files = {}
    for n in export_objects():
        table_files[n] = {
            "rows": table_rows[n],
            "csv_sha256": sha256_file(staging / "csv" / f"{n}.csv"),
            "parquet_sha256": sha256_file(staging / "parquet" / f"{n}.parquet"),
        }
    warnings = [{"check": r.name, "summary": r.summary} for r in results if r.failed and r.severity == "warn"]
    created = datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    manifest = {
        "release_id": f"{name}+{summary['build_id']}",
        "release_version": version,
        "created_at": created,
        "code_version": __version__,
        "schema_version": SCHEMA_VERSION,
        "build": {
            k: summary[k]
            for k in (
                "build_id",
                "code_commit",
                "built_at",
                "as_of_date",
                "as_of_timezone",
                "pins_sha256",
                "preference_rule",
                "policy_exposure",
                "derivations",
                "config",
            )
        },
        "build_parameters": {
            "config": paths.rel(build.path),
            "exposure_years": list(build.exposure_years),
            "sources": build.sources,
        },
        "inputs": summary["inputs"],
        "tables": table_files,
        "coverage_by_family": [
            {
                "source_family": f,
                "measures": m,
                "states_with_values": s,
                "first_year": a,
                "last_year": b,
                "preferred_values": n,
            }
            for f, m, s, a, b, n in families
        ],
        "validation": {"profile": "release", "errors": 0, "warnings": warnings},
        "limitations": [
            "Research preview: coverage is partial and declared per series in docs/coverage-report.md.",
            f"{conflicts} preferred cells are unresolved conflicts between tables in the same Utah DABS report.",
            f"{manual} Utah DABS values were transcribed by hand (Claude) and await maintainer review.",
            "Policy intervals by legal review status: "
            + ", ".join(f"{s} {n}" for s, n in policies)
            + " (machine_assisted_review is not a human review).",
            "Utah legal status is verified from 2014-01-01 only; earlier years are unknown. The grocery-wine value "
            "covers the ordinary off-premise retail authorization, not special channels such as package agencies.",
            "Census T10 is all-alcohol state tax only; it is not wine revenue and excludes state liquor store profits.",
            "No causal analysis is included; descriptive relationships are not effects.",
        ],
        "reproduce": [
            "python -m pip install -e .",
            f"alcohol-data fetch --config {paths.rel(build.path)}",
            f"alcohol-data build --config {paths.rel(build.path)} --manifest dist/{version}/manifest.json",
            "alcohol-data validate --profile release",
        ],
        "raw_files_bundled": False,
    }
    (out / "manifest.json").write_text(
        json.dumps(manifest, indent=2, default=str) + "\n", encoding="utf-8", newline="\n"
    )
    (out / "RELEASE_NOTES.md").write_text(release_notes(manifest), encoding="utf-8", newline="\n")

    lines = []
    for p in sorted(x for x in out.rglob("*") if x.is_file() and x.name != "checksums.sha256"):
        lines.append(f"{sha256_file(p)}  {p.relative_to(out).as_posix()}")
    (out / "checksums.sha256").write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")
    shutil.rmtree(staging)
    return out


def release_notes(m: dict) -> str:
    fam = "\n".join(
        f"| {r['source_family']} | {r['measures']} | {r['states_with_values']} | {r['first_year']} | {r['last_year']} | {r['preferred_values']:,} |"
        for r in m["coverage_by_family"]
    )
    inputs = "\n".join(
        f"| `{i['asset_id']}` | {i['acquisition_status']} | {i['rights_status']} | {(i.get('sha256') or '-')[:16]} |"
        for i in m["inputs"]
    )
    warns = "\n".join(f"- {w['check']}: {w['summary']}" for w in m["validation"]["warnings"]) or "- none"
    lims = "\n".join(f"- {x}" for x in m["limitations"])
    rep = "\n".join(m["reproduce"])
    return f"""# Release {m["release_version"]}

Release ID `{m["release_id"]}`, built {m["build"]["built_at"]} from code `{m["build"]["code_commit"]}`
(schema {m["schema_version"]}).

This is a research preview. It answers no causal question, and it does not show that grocery wine sales
raise or lower revenue, consumption or harm. Download the tables to inspect sources, coverage and gaps.

## Contents

- `csv.zip`, `parquet.zip`: every table and view (same content in both formats)
- `alcohol_data.duckdb`: the same tables in one DuckDB database
- `manifest.json`: inputs with SHA-256, build parameters, table row counts and file hashes
- `checksums.sha256`: SHA-256 of every file in this release
- `docs/`: data dictionary, coverage report, limitations, source and rights registries, validation report
- `examples/`: loading the CSVs in Python and querying the database with SQL
- `descriptive/`: Utah and Tennessee series split at method breaks, pre-2016 peer-comparison inputs, policy timeline

## Coverage (preferred values)

| Family | Measures | States with values | First year | Last year | Values |
|---|---:|---:|---:|---:|---:|
{fam}

## Validation

Release profile: 0 errors. Warnings (open work, not hidden):

{warns}

## Limitations

{lims}

## Inputs

| Asset | Status | Rights | SHA-256 (first 16) |
|---|---|---|---|
{inputs}

## Reproduce

Raw source files are not bundled. To rebuild from the same bytes:

```
{rep}
```

`fetch` downloads each input and reports any whose bytes no longer match this manifest. Inputs that
refuse automated downloads are listed with status `blocked_access`; see docs/reproduction.md.
"""
