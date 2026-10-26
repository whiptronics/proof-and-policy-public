"""End-to-end offline build on the fixtures: build, validate, export, and compare formats."""

import csv
import hashlib

import duckdb
import pytest

from alcohol_data import paths
from alcohol_data.exports.export import EXPORT_DIR, export_all, export_objects
from alcohol_data.transforms.build import run_build
from alcohol_data.validation.checks import run_checks
from tests.conftest import FIXTURE_BUILD, FIXTURES

GOLD = FIXTURES / "gold_standard.csv"


def test_build_has_observations_and_no_quarantine(fixture_db):
    assert fixture_db["counts"]["observations"] > 1000
    assert fixture_db["counts"]["quarantine"] == 0


def test_release_checks_pass_on_fixture_build(fixture_db):
    results = run_checks(profile="release")
    errors = [r for r in results if r.failed and r.severity == "error"]
    assert not errors, [(r.name, r.summary, r.details[:3]) for r in errors]


def test_gold_standard_values(fixture_db):
    con = duckdb.connect(str(paths.DATABASE_PATH), read_only=True)
    try:
        with open(GOLD, encoding="utf-8", newline="") as f:
            for g in csv.DictReader(f):
                rows = con.execute(
                    "SELECT value FROM observations WHERE geo_id = ? AND measure_id = ? AND period_label = ? AND source_series = ?",
                    [g["geo_id"], g["measure_id"], g["period_label"], g["source_series"]],
                ).fetchall()
                assert rows, g  # every edition holding the cell must carry the official value
                for (v,) in rows:
                    assert v == pytest.approx(float(g["value"]), rel=0, abs=float(g["tolerance"])), g
    finally:
        con.close()


def test_csv_parquet_duckdb_contents_match(fixture_db):
    con = duckdb.connect()
    for name in export_objects():
        c = con.execute(
            f"SELECT count(*) FROM read_csv('{(EXPORT_DIR / 'csv' / (name + '.csv')).as_posix()}', header=true, all_varchar=true)"
        ).fetchone()[0]
        p = con.execute(
            f"SELECT count(*) FROM read_parquet('{(EXPORT_DIR / 'parquet' / (name + '.parquet')).as_posix()}')"
        ).fetchone()[0]
        d = duckdb.connect(str(EXPORT_DIR / "alcohol_data.duckdb"), read_only=True)
        n = d.execute(f"SELECT count(*) FROM {name}").fetchone()[0]
        d.close()
        assert c == p == n, name
    # Values identical between Parquet and the database for the main table
    diff = con.execute(f"""
        SELECT count(*) FROM read_parquet('{(EXPORT_DIR / "parquet" / "observations.parquet").as_posix()}') p
        FULL JOIN (SELECT * FROM read_csv('{(EXPORT_DIR / "csv" / "observations.csv").as_posix()}', header=true,
                   types={{'value': 'DOUBLE', 'geo_id': 'VARCHAR'}})) c USING (observation_id)
        WHERE p.value IS DISTINCT FROM c.value OR p.geo_id IS DISTINCT FROM c.geo_id""").fetchone()[0]
    assert diff == 0


def test_csv_keeps_leading_zeros(fixture_db):
    with open(EXPORT_DIR / "csv" / "geographies.csv", encoding="utf-8", newline="") as f:
        codes = {r["geo_id"]: r["official_code"] for r in csv.DictReader(f)}
    assert codes["state:01"] == "01" and codes["state:06"] == "06"


def test_rebuild_from_same_inputs_gives_identical_csv(fixture_db, tmp_path):
    def digests():
        return {
            p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in (EXPORT_DIR / "csv").glob("*.csv")
        }

    first = digests()
    run_build(FIXTURE_BUILD)
    export_all(["csv", "parquet", "duckdb"])
    second = digests()
    first.pop("build_info.csv")  # holds the build timestamp
    second.pop("build_info.csv")
    assert first == second


def test_offline_build_fails_clearly_without_cache(tmp_path, monkeypatch):
    from alcohol_data.acquisition import fetch
    from alcohol_data.config import load_all_sources

    asset = load_all_sources()["census_stc"].assets[0]
    with pytest.raises(fetch.AcquisitionError, match="offline mode never falls back"):
        fetch.acquire(asset, {asset.asset_id: {"sha256": "f" * 64}}, client=None, offline=True)


def test_descriptive_outputs_one_row_per_period_and_break_segments(fixture_db, tmp_path):
    from alcohol_data.descriptive import descriptive_outputs

    series, peers, timeline, _ = descriptive_outputs(out_dir=tmp_path)
    with open(series, encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))
    keys = [(r["state"], r["measure_id"], r["period_label"]) for r in rows]
    assert len(keys) == len(set(keys)), "one row per state, measure and period"
    binge_ut = {
        int(r["year"]): r for r in rows if r["state"] == "UT" and r["measure_id"] == "brfss_binge_5m_4f_pct"
    }
    assert binge_ut[2010]["trend_segment"] != binge_ut[2011]["trend_segment"]  # 2011 method break
    with open(peers, encoding="utf-8", newline="") as f:
        assert all(r["pre_period"] == "2011-2015" for r in csv.DictReader(f))
