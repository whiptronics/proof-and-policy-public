"""Command-line interface: alcohol-data <command>."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Annotated

import typer

from alcohol_data import paths

app = typer.Typer(add_completion=False, no_args_is_help=True, help=__doc__)
sources_app = typer.Typer(no_args_is_help=True, help="Source registry commands.")
report_app = typer.Typer(no_args_is_help=True, help="Coverage and change reports.")
legal_app = typer.Typer(no_args_is_help=True, help="Legal-history tools (dated statute versions).")
dashboard_app = typer.Typer(no_args_is_help=True, help="Local research dashboard (web/) data.")
officials_app = typer.Typer(no_args_is_help=True, help="Officeholder and committee reference data.")
app.add_typer(sources_app, name="sources")
app.add_typer(report_app, name="report")
app.add_typer(legal_app, name="legal")
app.add_typer(dashboard_app, name="dashboard")
app.add_typer(officials_app, name="officials")


DEFAULT_BUILD = "config/builds/preview.yaml"
ConfigOpt = Annotated[str, typer.Option("--config", "-c", help="Build configuration YAML.")]


def _echo(msg: str) -> None:
    typer.echo(msg)


def _fail(msg: str, code: int = 1) -> None:
    typer.secho(msg, fg=typer.colors.RED, err=True)
    raise typer.Exit(code)


@legal_app.command("discover-utah")
def legal_discover_utah():
    """List every Historical Code version of the tracked Utah sections; write config/sources/utah_code_history.yaml."""
    from datetime import UTC, datetime

    from alcohol_data.acquisition.fetch import PoliteClient
    from alcohol_data.legal import utah_code

    client = PoliteClient({"le.utah.gov": 2.0})
    try:
        found = utah_code.discover(client)
    finally:
        client.close()
    path = utah_code.write_source_yaml(found, datetime.now(UTC).date().isoformat())
    for section, rows in found.items():
        _echo(f"{section}: {len(rows)} version files")
    _echo(
        f"wrote {paths.rel(path)}; add 'utah_code_history' to the build's sources, then run 'alcohol-data fetch'"
    )


@legal_app.command("ledger-utah")
def legal_ledger_utah(config: ConfigOpt = DEFAULT_BUILD):
    """Check every pinned Utah Code version and session law; write the inventory, pre-2014 reconstruction,
    version ledger and verified claim windows."""
    from alcohol_data.acquisition.fetch import load_pins
    from alcohol_data.config import load_build
    from alcohol_data.legal import utah_archived_code, utah_code
    from alcohol_data.legal import utah_session_laws as sl
    from alcohol_data.legal import utah_title32a as t32a

    build = load_build(Path(config))
    pins = load_pins(build.pins_file)
    versions = utah_code.load_versions(pins)
    rec = sl.load_records(pins)
    if rec.missing:
        _fail(
            f"session-law records not pinned or not local: {', '.join(rec.missing)}; run 'alcohol-data fetch'"
        )
    sessions, enactments = sl.inventory(rec)
    states = sl.reconstruct_all(rec, enactments, versions, utah_archived_code.load_captures(pins))
    from alcohol_data.config import load_all_sources
    from alcohol_data.legal import utah_annotated_code

    vol = next(
        (
            a
            for s in load_all_sources().values()
            for a in s.assets
            if a.asset_id == utah_annotated_code.ASSET_ID
        ),
        None,
    )
    pin = pins.get(utah_annotated_code.ASSET_ID)
    if vol is not None and pin:
        local = paths.RAW_DIR / vol.asset_id / f"{pin['sha256'][:16]}-{vol.filename}"
        if local.is_file():
            utah_annotated_code.annotate(states, local)
    written = sl.write_outputs(sessions, enactments, states)
    table = next((p for a, p in rec.recodification_tables.items()), None)
    if table is None:
        _fail("the Title 32A recodification table (ut_2010_title32a_recod_table) is not pinned or not local")
    written.append(t32a.write_crosswalk(t32a.parse_crosswalk(sl.digest_pages(table))))
    for s in sessions:
        _echo(
            f"{s['session']:<7} {s['coverage']:<36} bills touching tracked sections: {s['bills_touching_tracked_sections'] or '-'}"
        )
    rows, claims = utah_code.ledger(
        versions, build.as_of_date, build.as_of_timezone, sl.earlier_states(states)
    )
    v, c = utah_code.write_ledger(rows, claims)
    for cl in claims:
        span = f"{cl['verified_from']} .. {cl['verified_through']}" if cl["days"] else "never verified"
        _echo(f"{cl['claim_id']:<46} {span} ({cl['days']} days, {cl['temporal_status']})")
    _echo("wrote " + ", ".join(paths.rel(p) for p in [*written, v, c]))


@legal_app.command("review-packet-utah")
def legal_review_packet_utah(
    prior: Annotated[
        Path | None,
        typer.Option(
            "--prior", help="A previous release directory (dist/<version>) to report changes against."
        ),
    ] = None,
):
    """Write the Utah review packet (docs/review/) and source catalog (docs/sources/) from committed files."""
    from alcohol_data.legal import review_packet

    if prior is None and (paths.DIST_DIR / "0.1.0-preview").is_dir():
        prior = paths.DIST_DIR / "0.1.0-preview"
    for p in review_packet.write_all(prior):
        _echo(f"wrote {paths.rel(p)}")


@sources_app.command("audit")
def sources_audit(config: ConfigOpt = DEFAULT_BUILD):
    """Write metadata/source_registry.csv and metadata/rights_registry.csv from the source configs and pins."""
    from alcohol_data.registry import write_registries

    n_sources, n_assets = write_registries(config)
    _echo(f"wrote registries for {n_sources} sources / {n_assets} assets")


@app.command()
def fetch(
    config: ConfigOpt = DEFAULT_BUILD,
    offline: Annotated[
        bool, typer.Option("--offline", help="Use cached pinned bytes only; never use the network.")
    ] = False,
    refresh: Annotated[
        bool,
        typer.Option(
            "--refresh",
            help="Download again to detect upstream changes (cached pinned bytes are otherwise reused).",
        ),
    ] = False,
    update_pins: Annotated[
        bool,
        typer.Option("--update-pins", help="With --refresh: accept changed upstream bytes as the new pins."),
    ] = False,
    only: Annotated[list[str] | None, typer.Option("--only", help="Restrict to these asset IDs.")] = None,
):
    """Make every pinned source asset available locally, downloading only what is missing.

    Use --refresh to re-download and report upstream changes without moving pins.
    """
    from alcohol_data.acquisition.fetch import (
        AcquisitionError,
        PoliteClient,
        acquire,
        load_pins,
        log_acquisition,
        save_pins,
    )
    from alcohol_data.config import build_assets, load_all_sources, load_build

    paths.ensure_dirs()
    build = load_build(Path(config))
    sources = load_all_sources()
    assets = [a for a in build_assets(build, sources) if not only or a.asset_id in only]
    pins = load_pins(build.pins_file)
    intervals = {}
    for s in sources.values():
        for a in s.assets:
            if a.host:
                intervals[a.host] = max(intervals.get(a.host, 0.0), s.host_min_interval_seconds)
    client = None if offline else PoliteClient(intervals)
    failures = 0
    try:
        for a in assets:
            try:
                res = acquire(
                    a,
                    pins,
                    client=client,
                    offline=offline,
                    local_file=build.local_assets.get(a.asset_id),
                    update_pins=update_pins,
                    refresh=refresh,
                )
            except (AcquisitionError, OSError) as e:
                from alcohol_data.acquisition.redact import redact_text

                if a.parser is None and pins.get(a.asset_id):
                    # Cited document, not a data input: the build records its pinned hash as pinned_not_local.
                    _echo(
                        f"UNAVAILABLE {a.asset_id}: {redact_text(str(e))} (cited document; pinned hash kept)"
                    )
                    continue
                failures += 1
                _echo(f"FAILED   {a.asset_id}: {redact_text(str(e))}")
                continue
            if res.status != "cached":
                log_acquisition(res)
            line = f"{res.status:<16} {a.asset_id}"
            if res.sha256:
                line += f"  sha256:{res.sha256[:16]}  {res.bytes:,} bytes"
            _echo(line)
            if res.message:
                _echo(f"                 {res.message}")
    finally:
        if client:
            client.close()
        save_pins(build.pins_file, pins)
    if failures:
        _fail(f"{failures} asset(s) failed")


@app.command("import-asset")
def import_asset(
    asset_id: str,
    file: Path,
    config: ConfigOpt = DEFAULT_BUILD,
    update_pin: Annotated[
        bool, typer.Option("--update-pin", help="Accept a file whose bytes differ from the existing pin.")
    ] = False,
):
    """Import an official file you downloaded manually (for hosts that refuse automated requests).

    If the asset is already pinned, the file must match the pinned SHA-256 unless --update-pin is given.
    """
    from alcohol_data.acquisition.fetch import (
        AcquisitionError,
        import_local,
        load_pins,
        log_acquisition,
        save_pins,
    )
    from alcohol_data.acquisition.fetch import _pin_record as pin_record
    from alcohol_data.config import load_all_sources, load_build

    build = load_build(Path(config))
    sources = load_all_sources()
    asset = next((a for s in sources.values() for a in s.assets if a.asset_id == asset_id), None)
    if asset is None:
        _fail(f"unknown asset {asset_id}")
    try:
        res = import_local(asset, file, method="manual_import")
    except AcquisitionError as e:
        _fail(str(e))
    log_acquisition(res)
    pins = load_pins(build.pins_file)
    old = pins.get(asset_id, {}).get("sha256")
    if old == res.sha256:
        _echo(f"imported {asset_id} sha256:{res.sha256[:16]} ({res.bytes:,} bytes); matches the pin")
        return
    if old and not update_pin:
        _fail(
            f"{asset_id}: file sha256:{res.sha256[:16]} does not match the pin {old[:16]}. It may be a different "
            "edition or a corrupted download. Use --update-pin only after reviewing the difference."
        )
    pins[asset_id] = pin_record(asset, res)
    save_pins(build.pins_file, pins)
    _echo(
        f"imported {asset_id} sha256:{res.sha256[:16]} ({res.bytes:,} bytes)"
        + (f"; replaced pin {old[:16]}" if old else "; new pin")
    )


@app.command()
def build(
    config: ConfigOpt = DEFAULT_BUILD,
    offline: Annotated[
        bool, typer.Option("--offline", help="Fail rather than use the network (the build never downloads).")
    ] = False,
    manifest: Annotated[
        Path | None,
        typer.Option("--manifest", help="Rebuild exactly the inputs pinned in a release manifest.json."),
    ] = None,
):
    """Parse pinned assets and build the canonical DuckDB database."""
    from alcohol_data.transforms.build import run_build

    summary = run_build(Path(config), manifest=manifest)
    _echo(json.dumps(summary, indent=2))


@app.command()
def validate(
    profile: Annotated[str, typer.Option("--profile", help="dev or release")] = "dev",
):
    """Run data checks against the built database. Exit code 1 if any error-level check fails."""
    from alcohol_data.validation.checks import run_checks, write_validation_report

    results = run_checks(profile=profile)
    path = write_validation_report(results, profile)
    errors = [r for r in results if r.failed and r.severity == "error"]
    warns = [r for r in results if r.failed and r.severity == "warn"]
    for r in results:
        mark = "FAIL" if r.failed else "ok  "
        _echo(f"{mark} [{r.severity:<5}] {r.name}: {r.summary}")
    _echo(f"report: {paths.rel(path)}  ({len(errors)} errors, {len(warns)} warnings)")
    if errors:
        raise typer.Exit(1)


@app.command()
def export(
    format: Annotated[
        str, typer.Option("--format", help="Comma-separated: csv,parquet,duckdb")
    ] = "csv,parquet,duckdb",
):
    """Write deterministic CSV / Parquet / DuckDB exports to data/processed/exports."""
    from alcohol_data.exports.export import export_all

    out = export_all([f.strip() for f in format.split(",") if f.strip()])
    for k, v in out.items():
        _echo(f"{k}: {v}")


@dashboard_app.command("export")
def dashboard_export(
    out: Annotated[
        Path | None, typer.Option("--out", help="Output directory (default web/public/data).")
    ] = None,
):
    """Write the dashboard's JSON files from the built database and the curated research registers."""
    from alcohol_data.dashboard.export import export_dashboard

    try:
        man = export_dashboard(out)
    except (FileNotFoundError, ValueError) as e:
        _fail(str(e))
    _echo(f"dashboard export: {man['dataset']['release_label']}, {len(man['files'])} files")
    for k, v in man["counts"].items():
        _echo(f"  {k}: {v}")


@officials_app.command("check")
def officials_check(
    archive: Annotated[
        Path | None,
        typer.Option("--archive", help="Check this zip instead of the pinned, cached archive."),
    ] = None,
    config: ConfigOpt = DEFAULT_BUILD,
):
    """Re-read the officials-only archive and check the parsed tables against it (counts, ids, committee links,
    removed fields). Exits 1 if any check fails. The checks test structure, not whether the source is true."""
    from alcohol_data.acquisition.fetch import load_pins, resolve_pinned
    from alcohol_data.config import load_all_sources, load_build
    from alcohol_data.officials.importer import ArchiveError, check_officials, load_officials

    if archive is None:
        build = load_build(Path(config))
        asset = load_all_sources()["openstates_people"].assets[0]
        archive = resolve_pinned(asset, load_pins(build.pins_file))
        if archive is None:
            _fail(
                f"{asset.asset_id} is not in the raw cache; run: alcohol-data import-asset {asset.asset_id} "
                "<path to people-main-officials-only.zip>"
            )
    try:
        off = load_officials(archive)
        results = check_officials(archive, off)
    except ArchiveError as e:
        _fail(str(e))
    _echo(
        f"snapshot {off.snapshot}; license {off.provenance['license']}; {off.provenance['archive_sha256'][:16]}"
    )
    for k, v in off.counts().items():
        _echo(f"  {k}: {v}")
    for k, v in off.issue_counts().items():
        _echo(f"  issues, {k}: {v}")
    failed = 0
    for name, ok, detail in results:
        _echo(f"{'PASS' if ok else 'FAIL'}  {name}: {detail}")
        failed += 0 if ok else 1
    if failed:
        _fail(f"{failed} officials check(s) failed")


@report_app.command("coverage")
def report_coverage():
    """Write docs/coverage-report.md and metadata/coverage.csv from the built database."""
    from alcohol_data.reports import coverage_report

    md, csv_path = coverage_report()
    _echo(f"wrote {paths.rel(md)} and {paths.rel(csv_path)}")


@report_app.command("completeness")
def report_completeness():
    """Write metadata/completeness.csv, metadata/series_breaks.csv and docs/completeness.md."""
    from alcohol_data.completeness import write_reports

    if not paths.DATABASE_PATH.exists():
        _fail("database not found; run 'alcohol-data build' first")
    for p in write_reports():
        _echo(f"wrote {paths.rel(p)}")


@report_app.command("policy-coverage")
def report_policy_coverage():
    """Write metadata/policy_coverage.csv and docs/policy-coverage.md (dimension x state knowledge matrix)."""
    from alcohol_data.policy_coverage import write_report

    if not paths.DATABASE_PATH.exists():
        _fail("database not found; run 'alcohol-data build' first")
    for p in write_report():
        _echo(f"wrote {paths.rel(p)}")


@report_app.command("descriptive")
def report_descriptive():
    """Write descriptive series, peer-comparison inputs and the policy timeline to data/processed/descriptive."""
    from alcohol_data.descriptive import descriptive_outputs

    for p in descriptive_outputs():
        _echo(f"wrote {paths.rel(p)}")


@report_app.command("dictionary")
def report_dictionary():
    """Regenerate docs/data-dictionary.md from the schema, vocabularies and measures."""
    from alcohol_data.reports import data_dictionary

    _echo(f"wrote {paths.rel(data_dictionary())}")


@report_app.command("changes")
def report_changes(
    against: Annotated[
        Path, typer.Option("--against", help="Previous release manifest.json (or its directory).")
    ],
):
    """Compare the current build with a previous release: added, removed and revised values."""
    from alcohol_data.reports import changes_report

    path, counts = changes_report(against)
    _echo(f"wrote {paths.rel(path)}: {counts}")


@app.command()
def package(
    version: Annotated[str, typer.Option("--version", help="Release version label, e.g. 0.1.0-preview")],
    config: ConfigOpt = DEFAULT_BUILD,
):
    """Assemble dist/<version>/ with zipped tables, database, manifest, checksums and documentation."""
    from alcohol_data.exports.package import package_release

    out = package_release(version, Path(config))
    _echo(f"release written to {paths.rel(out)}")


def main() -> None:  # pragma: no cover
    try:
        app()
    except KeyboardInterrupt:
        sys.exit(130)


if __name__ == "__main__":  # pragma: no cover
    main()
