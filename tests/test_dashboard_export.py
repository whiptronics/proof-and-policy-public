"""Dashboard export: contracts, conversions, provenance and the worked example's checked claims.

Tests that need the built database are skipped when it is absent (a fresh clone before `build`).
"""

from __future__ import annotations

import json
import math
import re
from datetime import date
from pathlib import Path

import duckdb
import pytest
import yaml

from alcohol_data import paths
from alcohol_data.dashboard import contracts as K
from alcohol_data.dashboard.export import cell_code, export_dashboard, page_link, topology_paths
from alcohol_data.dashboard.transforms import Converter, constant_dollars, per_person

ROOT = Path(__file__).resolve().parents[1]
# The test session points ALCOHOL_DATA_HOME at a temporary directory; the full build (when one exists)
# lives in the checkout, like the cached legal documents test_policy_evidence reads.
CHECKOUT = paths.ROOT
DB = CHECKOUT / "data" / "processed" / "alcohol_data.duckdb"
needs_db = pytest.mark.skipif(
    not DB.is_file(), reason="full build not present in the checkout (run alcohol-data build)"
)


# ----- pure functions (hand-checkable) ----------------------------------------------------------


def test_constant_dollars_and_per_person_by_hand():
    assert constant_dollars(100.0, 300.0, 150.0) == 200.0
    assert constant_dollars(0.0, 300.0, 150.0) == 0.0  # an observed zero stays zero
    assert constant_dollars(None, 300.0, 150.0) is None
    assert constant_dollars(100.0, 300.0, 0.0) is None
    assert per_person(1_000_000.0, 2_000_000.0) == 0.5
    assert per_person(0.0, 10.0) == 0.0
    assert per_person(5.0, 0.0) is None
    assert per_person(5.0, None) is None


def _cpi(year_values: dict[int, float]) -> dict:
    return {(y, m): (v, f"cpi_{y}_{m:02d}") for y, v in year_values.items() for m in range(1, 13)}


def test_converter_uses_the_fiscal_years_own_months_and_july1():
    cpi = _cpi({2015: 50.0, 2016: 50.0, 2024: 100.0})
    pop = {
        ("pop_total_resident", "state:99", date(2015, 7, 1)): (1000.0, "pop_a"),
        ("pop_age21plus_resident", "state:99", date(2015, 7, 1)): (None, "pop_b"),
    }
    conv = Converter(cpi, pop)
    row = {
        "observation_id": "o1",
        "geo_id": "state:99",
        "period_start": date(2015, 7, 1),
        "period_end": date(2016, 6, 30),
        "value": 10.0,
    }
    out = conv.convert(row)
    assert out["real_cy2024"]["value"] == 20.0  # 10 x 100 / 50
    assert out["real_cy2024"]["inputs"] == ["o1", "cpi_fy:2015-07..2016-06", "cpi_base:2024"]
    assert conv.deflators["cpi_fy:2015-07..2016-06"]["observation_ids"][0] == "cpi_2015_07"
    assert out["per_resident"]["value"] == 0.01
    assert out["per_resident"]["inputs"] == ["o1", "pop_a"]
    assert (
        out["per_resident_21plus"]["value"] is None and "July 1 2015" in out["per_resident_21plus"]["missing"]
    )


def test_converter_refuses_a_fiscal_year_with_a_missing_cpi_month():
    cpi = _cpi({2025: 50.0, 2024: 100.0})
    cpi[(2025, 10)] = (None, "cpi_2025_10")  # October 2025 was not published
    conv = Converter(cpi, {})
    row = {
        "observation_id": "o2",
        "geo_id": "state:99",
        "period_start": date(2025, 7, 1),
        "period_end": date(2026, 6, 30),
        "value": 10.0,
    }
    out = conv.convert(row)
    assert out["real_cy2024"]["value"] is None
    assert "2025-10" in out["real_cy2024"]["missing"]


def test_cell_codes_keep_zero_and_missing_apart():
    assert cell_code(0.0, None, "spreadsheet_parser", None) == "0"
    assert cell_code(0.0, None, "manual", "extracted_unreviewed") == "0"
    assert cell_code(None, "not_published", "api", None) == "M"
    assert cell_code(None, "not_applicable", "spreadsheet_parser", None) == "N"
    assert cell_code(None, "suppressed", "csv_parser", None) == "W"  # withheld, never zero or plain missing
    assert cell_code(None, "unresolved_conflict", "manual", None) == "C"
    assert cell_code(5.0, None, "manual", "extracted_unreviewed") == "U"
    assert cell_code(5.0, None, "manual", "reviewed") == "R"
    assert cell_code(5.0, None, "computed", None) == "D"
    assert cell_code(5.0, None, "csv_parser", None) == "S"


def test_page_links_follow_the_locator_convention():
    url = "https://example.gov/a.pdf"
    assert page_link(url, "page 22, table", "pdf", 23) == url + "#page=22"
    assert page_link(url, "printed page 473", "pdf", 26) == url  # a book page number, not a file page
    assert page_link(url, "page 40", "pdf", 23) == url  # beyond the file
    assert page_link("https://example.gov/a.htm", "page 2", "html", None) == "https://example.gov/a.htm"


def test_research_registers_are_consistent():
    gaps, leads = K.read_csv(K.GAPS_CSV), K.read_csv(K.LEADS_CSV)
    assert gaps and leads
    assert K.check_registers(gaps, leads) == []
    bad = [dict(g) for g in gaps[:1]]
    bad[0]["lead_ids"] = "lead_does_not_exist"
    assert any("unknown lead" in p for p in K.check_registers(bad, leads))


def test_compare_vectors_match_python_rules():
    """web/src/lib/compare.vectors.json must be what compare.py returns today (see scripts/)."""
    import importlib.util

    spec = importlib.util.spec_from_file_location("mcv", ROOT / "scripts" / "make_compare_vectors.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    committed = (ROOT / "web" / "src" / "lib" / "compare.vectors.json").read_text(encoding="utf-8")
    assert committed == mod.render(), "regenerate with: python scripts/make_compare_vectors.py"


# ----- the export against the built database ----------------------------------------------------


@pytest.fixture(scope="module")
def exported(tmp_path_factory):
    """Export the checkout's full build, reading its raw cache and dist folder (not the temp home)."""
    if not DB.is_file():
        pytest.skip("built database not present")
    out = tmp_path_factory.mktemp("dash")
    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(paths, "RAW_DIR", CHECKOUT / "data" / "raw")
        mp.setattr(paths, "DIST_DIR", CHECKOUT / "dist")
        man = export_dashboard(out, DB)
    return out, man


def test_export_runs_on_the_fixture_build(fixture_db, tmp_path):
    """The small fixture build (always available) exports without error and keeps its rows."""
    man = export_dashboard(tmp_path, paths.DATABASE_PATH)
    assert man["counts"]["metrics"] > 0 and man["counts"]["observations_exported"] > 0
    assert (tmp_path / "coverage.json").is_file() and (tmp_path / "research.json").is_file()


def test_saved_analysis_checks_refuse_bad_selections(fixture_db, tmp_path):
    """A saved analysis is a selection with what it cannot show; anything else fails the export."""
    from alcohol_data.dashboard.export import Export

    ex = Export(tmp_path, paths.DATABASE_PATH)
    ex.geographies()
    ex.metrics()
    measures = {r[0] for r in ex.con.execute("SELECT measure_id FROM measures").fetchall()}
    plain = next(m for m, v in ex.metric_meta.items() if not v["conversions"])
    dollars = next(m for m, v in ex.metric_meta.items() if v["conversions"])
    good = {
        "analysis_id": "x",
        "title": "T",
        "question": "Q?",
        "metrics": [dollars],
        "geos": [ex.geo_ids[0]],
        "years": [2000, 2010],
        "shown": "real_cy2024",
        "policy_dimension": next(iter(ex.catalog())),
        "cannot_show": ["c"],
    }
    p = tmp_path / "x.yaml"
    assert ex.check_analysis(p, good, measures)["metrics"] == [dollars]
    bad = [
        ({"shows": ["a finding"]}, "unknown keys"),
        ({"analysis_id": "y"}, "file name"),
        ({"cannot_show": []}, "cannot_show is required"),
        ({"metrics": ["nope@calendar_year"]}, "unknown measure"),
        ({"metrics": [dollars, dollars]}, "distinct metrics"),
        ({"geos": ["state:99"]}, "unknown jurisdictions"),
        ({"geos": ex.geo_ids[:7]}, "distinct jurisdictions"),
        ({"years": [2010, 2000]}, "out of order"),
        ({"metrics": [plain]}, "not available"),
        ({"base_year": 2005}, "base_year is given"),
        ({"shown": "index"}, "base_year is given"),
        ({"shown": "index", "base_year": 1990}, "inside years"),
        ({"shown": "ratio"}, "shown must be"),
        ({"policy_dimension": "nope"}, "unknown policy dimension"),
    ]
    for patch, why in bad:
        with pytest.raises(ValueError, match=why):
            ex.check_analysis(p, {**good, **patch}, measures)
    ex.con.close()


def _load(out: Path, rel: str):
    return json.loads((out / rel).read_text(encoding="utf-8"))


TOOL_FILES = [
    "web/src/lib/outcomes.ts",
    "web/src/lib/finder.ts",
    "web/src/views/ChangeView.tsx",
    "web/src/views/ScenarioView.tsx",
    "web/src/views/StartView.tsx",
    "web/src/views/CompareView.tsx",
    "web/src/lib/mapMeasures.ts",
    "web/src/lib/beverages.ts",
    "web/src/views/FiscalView.tsx",
    "web/src/views/UtahView.tsx",
]
METRIC_ID = re.compile(r"\b([a-z][a-z0-9_]*@(?:state_fiscal_year|calendar_year|survey_year|point_in_time))\b")


@needs_db
def test_every_measure_the_tools_name_is_in_the_build(exported):
    """The guided tools name measures in plain-language lists and examples; a renamed or dropped measure
    would silently vanish from a list or break an example, so every id they name must be exported."""
    out, _ = exported
    ids = {m["metric_id"] for m in _load(out, "metrics.json")["metrics"]}
    for rel in TOOL_FILES:
        named = set(METRIC_ID.findall((ROOT / rel).read_text(encoding="utf-8")))
        assert named, f"{rel}: no measure ids found (pattern out of date?)"
        assert not named - ids, (rel, sorted(named - ids))


def test_topology_paths_decode_delta_arcs_and_reversed_arcs():
    """A unit square drawn from two arcs, the second used reversed (~1): scale 10, translate (5, 5)."""
    topo = {
        "transform": {"scale": [10, 10], "translate": [5, 5]},
        "arcs": [[[0, 0], [1, 0], [0, 1]], [[0, 0], [0, 1], [1, 0]]],
        "objects": {"states": {"geometries": [{"type": "Polygon", "id": "49", "arcs": [[0, ~1]]}]}},
    }
    paths_out, labels = topology_paths(topo, "states")
    # arc 0: (5,5) (15,5) (15,15); arc 1 reversed: (15,15) (5,15) (5,5) — the shared point is not repeated
    assert paths_out["49"] == "M5.0,5.0L15.0,5.0L15.0,15.0L5.0,15.0L5.0,5.0Z"
    assert labels["49"] == [10.0, 10.0]


@needs_db
def test_officials_export(exported):
    """Reference data on officeholders: counts agree with the archive, each file agrees with the index, and the
    source, license and snapshot travel with it. Skipped when the archive has not been imported."""
    out, man = exported
    if not (out / "officials.json").is_file():
        pytest.skip(
            "officials archive not imported (alcohol-data import-asset openstates_people_officials_2026_10_08)"
        )
    idx = _load(out, "officials.json")
    assert idx["source"]["license"] == "CC0-1.0" and idx["source"]["snapshot_date"] == "2026-10-08"
    assert idx["source"]["asset_id"] == "openstates_people_officials_2026_10_08"
    assert idx["review_status"] == "not_reviewed"
    assert idx["counts"]["records"] == 22692 and idx["counts"]["committees"] == 3042
    total = 0
    for j in idx["jurisdictions"]:
        f = _load(out, j["file"])
        assert len(f["records"]) == j["records"] and len(f["committees"]) == j["committees"]
        assert j["records"] == j["current_in_source"] + j["ended_in_current_files"] + j["former_in_source"]
        total += len(f["records"])
    assert total == idx["counts"]["records"]
    assert man["counts"]["officials_records"] == 22692
    # Policy dates come only from policy records that carry an enactment date.
    assert {
        "policy_id": "tn_ordinary_grocery_wine_local_option_2016",
        "state": "tn",
        "date": "2014-03-20",
    }.items() <= next(
        d for d in idx["policy_dates"] if d["policy_id"] == "tn_ordinary_grocery_wine_local_option_2016"
    ).items()
    # Only records current in the source carry contact details.
    ut = _load(out, "officials/ut.json")
    assert all(r["status"] == "current_in_source" for r in ut["records"] if "contact" in r)


@needs_db
def test_map_and_monthly_exports(exported):
    out, _ = exported
    shapes = _load(out, "map.json")
    assert len(shapes["states"]) == 51 and all(s["path"].startswith("M") for s in shapes["states"].values())
    assert shapes["source"]["asset_id"] == "us_atlas_states_albers_10m"
    idx = _load(out, "monthly.json")
    series = {s["measure_id"]: s for s in idx["series"]}
    # Every monthly measure the map names is exported.
    named = set(
        re.findall(
            r'monthly: "([a-z0-9_]+)"', (ROOT / "web/src/lib/mapMeasures.ts").read_text(encoding="utf-8")
        )
    )
    assert named and named <= set(series)
    # Each series names the files behind it, so a chart can cite its source without loading every row.
    assert all(s["asset_ids"] for s in series.values())
    assert len(series["ut_dabs_monthly_gross_sales_wine"]["asset_ids"]) == 16
    f = _load(out, series["msrs_total_retail_yoy_pct"]["file"])
    c = {k: i for i, k in enumerate(f["columns"])}
    ut = {r[c["period_label"]]: r for r in f["rows"] if r[c["geo_id"]] == "state:49"}
    assert ut["2026-06"][c["value"]] == 7.5  # the Census June 2026 map prints 7.5 for Utah
    # Monthly rows never reach the annual metric files.
    metrics = _load(out, "metrics.json")["metrics"]
    assert not [m for m in metrics if m["metric_id"].endswith("@month")]
    # Every input of a derived value can be found: in a metric file, the deflators, or a monthly file (the
    # DABS fiscal-year sums), so the record drawer never says an input is missing.
    known = {m["metric_id"] for m in metrics} | {"deflators"} | {f"monthly:{k}" for k in series}
    assert not [(m["metric_id"], i) for m in metrics for i in m["input_metrics"] if i not in known]
    assert "monthly:ut_dabs_monthly_gross_sales_wine" in next(
        m["input_metrics"]
        for m in metrics
        if m["metric_id"] == "ut_dabs_fy_gross_sales_wine@state_fiscal_year"
    )


@needs_db
def test_the_beverage_page_finds_every_dabs_measure_it_builds(exported):
    """BeveragesView builds DABS ids from the group names, which the id scan above cannot see."""
    out, _ = exported
    ids = {m["metric_id"] for m in _load(out, "metrics.json")["metrics"]}
    monthly = {s["measure_id"] for s in _load(out, "monthly.json")["series"]}
    src = (ROOT / "web/src/lib/beverages.ts").read_text(encoding="utf-8")
    groups = re.search(r"DABS_GROUPS = \[([^\]]+)\]", src).group(1)
    for g in re.findall(r'"([a-z]+)"', groups):
        for kind in ("gross_sales", "cases_9l"):
            assert f"ut_dabs_monthly_{kind}_{g}" in monthly
            assert f"ut_dabs_fy_{kind}_{g}@state_fiscal_year" in ids


CONTROL_DIMS = [
    "spirits_wholesale_system",
    "spirits_off_premise_retail_system",
    "wine_wholesale_system",
    "wine_off_premise_retail_system",
]


@needs_db
def test_liquor_control_history_and_peer_snapshots(exported):
    """Utah's four arrangements are verified history from their stated first days and unknown before; the
    peers are dated snapshots only, never history (lib/control.ts must report them as not assessable)."""
    out, _ = exported
    pol = _load(out, "policy.json")
    ut = {
        s["policy_dimension"]: s
        for s in pol["segments"]
        if s["geo_id"] == "state:49" and s["policy_dimension"] in CONTROL_DIMS and s["state"] != "unknown"
    }
    assert {d: ut[d]["segment_start"] for d in CONTROL_DIMS} == {
        "spirits_wholesale_system": "2003-05-05",
        "spirits_off_premise_retail_system": "2011-07-01",
        "wine_wholesale_system": "2003-05-05",
        "wine_off_premise_retail_system": "2011-07-01",
    }
    before = [
        s
        for s in pol["segments"]
        if s["geo_id"] == "state:49"
        and s["policy_dimension"] in CONTROL_DIMS
        and s["segment_end"] < "2003-05-05"
    ]
    assert before and all(s["state"] == "unknown" for s in before)
    peers = {"state:51", "state:42", "state:16", "state:41"}
    assert not [s for s in pol["segments"] if s["geo_id"] in peers and s["policy_dimension"] in CONTROL_DIMS]
    snaps = {(s["geo_id"], s["policy_dimension"]) for s in pol["snapshots"] if s["observed_on"]}
    for g in peers:
        for d in CONTROL_DIMS:
            if (g, d) == ("state:41", "spirits_off_premise_retail_system"):
                continue  # statute allows commission stores or agents; only the 2012 brief (year only) is coded
            assert (g, d) in snaps, (g, d)


def test_fars_rates_divide_by_the_same_years_july_population():
    from alcohol_data.transforms.derive import fars_rates

    deaths = {
        "measure_id": "fars_alcohol_impaired_driving_fatalities",
        "period_kind": "calendar_year",
        "geo_id": "state:49",
        "year": 2023,
        "value": 63.1,
        "missing_reason": None,
        "observation_id": "d1",
        "period_start": date(2023, 1, 1),
        "period_end": date(2023, 12, 31),
        "period_label": "2023",
        "subgroup": "all",
    }
    pop = {("pop_total_resident", "state:49", date(2023, 7, 1)): {"value": 3449259.0, "observation_id": "p1"}}
    ((row, inputs, formula),) = fars_rates([deaths], pop)
    assert row["measure_id"] == "fars_alcohol_impaired_driving_deaths_per_100k"
    assert row["value"] == pytest.approx(1.82938, rel=1e-5) and inputs == ["d1", "p1"]
    ((row, inputs, _),) = fars_rates(
        [{**deaths, "year": 2024}], pop
    )  # no 2024 population: a gap, never a guess
    assert row["value"] is None and row["missing_reason"] == "unavailable" and inputs == ["d1"]
    ((row, _, _),) = fars_rates([{**deaths, "value": None, "missing_reason": "suppressed"}], pop)
    assert row["value"] is None and row["missing_reason"] == "suppressed"


def test_an_odbl_source_gates_packaging():
    from alcohol_data.exports.package import release_gates

    gated = dict(release_gates(["cdc_cdi", "bea_regional", "census_msrs"]))
    assert set(gated) == {"cdc_cdi"} and "ODbL" in gated["cdc_cdi"]


@needs_db
def test_saved_analyses_show_data_in_the_full_build(exported):
    """Every starting point is exported, and each of its measures has a value for one of its jurisdictions
    inside its years (a saved analysis that opens on empty charts is a broken link)."""
    out, _ = exported
    analyses = _load(out, "analyses.json")["analyses"]
    configs = sorted(p.stem for p in (ROOT / "config" / "dashboard" / "analyses").glob("*.yaml"))
    assert sorted(a["analysis_id"] for a in analyses) == configs and configs
    metas = {m["metric_id"]: m for m in _load(out, "metrics.json")["metrics"]}
    for a in analyses:
        assert not a["metrics_without_data"], a["analysis_id"]
        lo, hi = a["years"]
        for mid in a["metrics"]:
            rows = _rows(out, metas[mid])
            assert any(
                r["geo_id"] in a["geos"] and lo <= r["year"] <= hi and r["value"] is not None for r in rows
            ), (a["analysis_id"], mid)


def _rows(out: Path, meta: dict) -> list[dict]:
    f = _load(out, meta["file"])
    return [dict(zip(f["columns"], r, strict=True)) for r in f["rows"]]


@needs_db
def test_fars_exports_both_interval_targets_apart(exported):
    """FARS imputed deaths carry two intervals: ci_low/ci_high for the underlying expected number and
    realized_ci_low/realized_ci_high for the deaths that occurred (imputation only, so never wider). Every other
    measure has no realized interval."""
    out, _ = exported
    metas = {m["metric_id"]: m for m in _load(out, "metrics.json")["metrics"]}
    rows = [
        r
        for r in _rows(out, metas["fars_alcohol_impaired_driving_fatalities@calendar_year"])
        if r["value"] is not None
    ]
    assert rows
    for r in rows:
        assert r["realized_ci_low"] is not None and r["realized_ci_high"] is not None
        assert 0 <= r["realized_ci_low"] <= r["value"] <= r["realized_ci_high"]
        assert r["ci_low"] <= r["realized_ci_low"] and r["realized_ci_high"] <= r["ci_high"]
    for mid in ("fars_traffic_fatalities@calendar_year", "brfss_binge_5m_4f_pct@survey_year"):
        assert all(
            r["realized_ci_low"] is None and r["realized_ci_high"] is None for r in _rows(out, metas[mid])
        )


@needs_db
def test_export_is_deterministic(exported, tmp_path, monkeypatch):
    out, man = exported
    monkeypatch.setattr(paths, "RAW_DIR", CHECKOUT / "data" / "raw")
    monkeypatch.setattr(paths, "DIST_DIR", CHECKOUT / "dist")
    again = export_dashboard(tmp_path, DB)
    assert again["files"] == man["files"]  # identical bytes for identical inputs
    assert man["schema_version"] == K.SCHEMA_VERSION
    assert man["dataset"]["build_id"].startswith("preview-")


@needs_db
def test_every_preferred_value_is_exported_once(exported):
    out, man = exported
    con = duckdb.connect(str(DB), read_only=True)
    n = con.execute(
        "SELECT count(*) FROM preferred_observations WHERE period_kind <> 'month' AND subgroup = 'all'"
    ).fetchone()[0]
    assert man["counts"]["observations_exported"] == n
    ids = set()
    for meta in _load(out, "metrics.json")["metrics"]:
        rows = _rows(out, meta)
        kinds = {meta["period_kind"]}
        assert len(kinds) == 1  # one period kind per metric file: fiscal and calendar never mixed
        for r in rows:
            assert r["observation_id"] not in ids
            ids.add(r["observation_id"])
    assert len(ids) == n


@needs_db
def test_zero_and_missing_stay_distinct_through_export(exported):
    out, _ = exported
    zeros = missing = suppressed = 0
    for meta in _load(out, "metrics.json")["metrics"]:
        for r in _rows(out, meta):
            v = r["value"]
            assert not (isinstance(v, float) and math.isnan(v))
            if v == 0:
                zeros += 1
                assert r["cell"] == "0" and r["missing_reason"] is None
            if v is None:
                missing += 1
                assert r["missing_reason"] and r["cell"] in ("M", "N", "C", "W")
                # Suppressed by the source has its own code, so the map and coverage grid can draw it apart.
                assert (r["cell"] == "W") == (r["missing_reason"] == "suppressed") or r["cell"] == "C"
                suppressed += r["cell"] == "W"
    assert zeros > 0 and missing > 0 and suppressed > 0


@needs_db
def test_derived_values_keep_inputs_and_method(exported):
    out, _ = exported
    seen = 0
    for meta in _load(out, "metrics.json")["metrics"]:
        for r in _rows(out, meta):
            if r["cell"] == "D" or r["extraction_method"] == "computed":
                seen += 1
                assert r["transform_id"] and r["input_ids"], r["observation_id"]
    assert seen > 0


@needs_db
def test_dashboard_conversions_equal_canonical_derivations(exported):
    """The export's T10 conversions use the same conventions as transforms/derive.py."""
    out, _ = exported
    metas = {m["metric_id"]: m for m in _load(out, "metrics.json")["metrics"]}
    t10 = _load(out, metas["stc_alcoholic_beverages_sales_tax@state_fiscal_year"]["file"])
    conv = t10["conversions"]
    canon = {
        "real_cy2024": "stc_alcoholic_beverages_sales_tax_real_cy2024usd@state_fiscal_year",
        "per_resident": "stc_alcoholic_beverages_sales_tax_per_capita@state_fiscal_year",
        "per_resident_21plus": "stc_alcoholic_beverages_sales_tax_per_resident_21plus@state_fiscal_year",
    }
    compared = 0
    for kind, mid in canon.items():
        by_input = {}
        for r in _rows(out, metas[mid]):
            by_input[r["input_ids"][0]] = r["value"]
        for obs_id, rows in conv.items():
            c = {x[0]: x for x in rows}[kind]
            if obs_id in by_input and by_input[obs_id] is not None:
                assert c[1] is not None and math.isclose(c[1], by_input[obs_id], rel_tol=1e-12), (
                    kind,
                    obs_id,
                )
                compared += 1
    assert compared > 3000


@needs_db
def test_restricted_assets_are_never_servable_or_copied(exported):
    out, _ = exported
    assets = _load(out, "sources.json")["assets"]
    for a in assets:
        if a["rights_status"] in ("rights_unresolved", "facts_with_citation") or not a["redistribute_raw"]:
            assert a["local_copy_servable"] is False and a["local_filename"] is None, a["asset_id"]
    held = {a["asset_id"]: a for a in assets}
    # The dangerous path is reached: these restricted files ARE held locally, and are still not servable.
    for aid in ("uca_1992_title59_ch15_21", "utah_dabs_annual_report_fy2025"):
        if held[aid]["local_copy"]:
            assert held[aid]["local_copy_servable"] is False
    assert any(a["local_copy"] for a in assets if not a["redistribute_raw"]), (
        "no restricted file held: test proves nothing"
    )
    assert any(a["local_copy_servable"] for a in assets), "nothing servable at all: the rule is not exercised"
    for p in (x for x in out.rglob("*") if x.is_file()):
        assert p.suffix in (".json",), f"unexpected file in the export: {p.name}"


@needs_db
def test_policy_coverage_counts_days_and_never_extends_snapshots(exported):
    out, _ = exported
    cov = _load(out, "coverage.json")["metrics"]
    tax = cov["policy:beer_excise_tax_per_31gal_barrel"]
    ut = tax["rows"]["state:49"]
    y0 = tax["first_year"]
    assert ut[1992 - y0] == "?"  # the 1992 volume is a snapshot, not a verified year
    assert ut[2002 - y0] == "?"
    assert ut[2003 - y0] == "P"  # known from 2003-05-05
    assert ut[2004 - y0] == "K"
    days = {d[0]: d for d in tax["days"]["state:49"]}
    assert days[2003][1] == (date(2003, 12, 31) - date(2003, 5, 5)).days + 1
    assert days[2016][2] == 366  # leap year
    assert ut[-1] == "F"  # the as-of year is not over
    wine = cov["policy:ordinary_grocery_wine_authorization"]
    tn = {d[0]: d for d in wine["days"]["state:47"]}
    assert wine["rows"]["state:47"][2016 - wine["first_year"]] == "P"
    assert tn[2016][1] == 182 + 1  # 2016-01-01..06-30 not authorized, plus 2016-07-01 only
    assert tn[2016][4] == 1  # one local-option day
    assert wine["rows"]["state:47"][2017 - wine["first_year"]] == "?"
    pol = _load(out, "policy.json")
    snap = [s for s in pol["snapshots"] if s["policy_id"] == "ut_beer_tax_1100"]
    assert snap and snap[0]["observed_year"] == 1992 and snap[0]["observed_on"] is None
    seg = [
        s
        for s in pol["segments"]
        if s["geo_id"] == "state:49" and s["policy_dimension"] == "beer_excise_tax_per_31gal_barrel"
    ]
    assert min(s["segment_start"] for s in seg if s["state"] != "unknown") == "2003-05-05"


@needs_db
def test_family_counts_have_explicit_denominators(exported):
    out, _ = exported
    fam = _load(out, "coverage.json")["families"]
    for name, f in fam.items():
        for geo, r in f["rows"].items():
            for h, d in zip(r["have"], r["defined"], strict=True):
                assert 0 <= h <= d, (name, geo)


@needs_db
def test_no_fiscal_total_is_manufactured(exported):
    """Only measures from the canonical database appear; the export adds no sum of components."""
    out, _ = exported
    con = duckdb.connect(str(DB), read_only=True)
    measures = {r[0] for r in con.execute("SELECT measure_id FROM measures").fetchall()}
    for m in _load(out, "metrics.json")["metrics"]:
        assert m["measure_id"] in measures


# ----- worked example: every 'shows' sentence rests on a checked claim ----------------------------


def _series(con, metric, period_kind, geo):
    return dict(
        con.execute(
            "SELECT year, value FROM preferred_observations WHERE measure_id = ? AND period_kind = ? AND geo_id = ?",
            [metric, period_kind, geo],
        ).fetchall()
    )


def _ci(con, metric, geo, year):
    return con.execute(
        "SELECT d.ci_low, d.ci_high FROM preferred_observations p JOIN observation_details d USING (observation_id) "
        "WHERE p.measure_id = ? AND p.geo_id = ? AND p.year = ?",
        [metric, geo, year],
    ).fetchone()


def _mean(s, a, b):
    vals = [s.get(y) for y in range(a, b + 1)]
    assert all(v is not None for v in vals), f"window {a}-{b} incomplete"
    return sum(vals) / len(vals)


CASES = sorted((ROOT / "config" / "dashboard" / "cases").glob("*.yaml"))


def _pct(a: float, b: float) -> float:
    return 100 * (b / a - 1)


def _check_claim(con, c: dict, treated: str, comps: list[str]) -> None:
    def ser(geo: str) -> dict:
        return _series(con, c["metric"], c["period_kind"], geo)

    t = c["type"]
    if t == "step":
        assert _pct(ser(treated)[c["from"]], ser(treated)[c["to"]]) >= c["treated_min_pct"]
        for g in comps:
            assert abs(_pct(ser(g)[c["from"]], ser(g)[c["to"]])) < c["comparisons_max_abs_pct"], g
    elif t == "stays_above":
        s = ser(treated)
        assert all(s[y] > s[c["reference_year"]] for y in range(c["years"][0], c["years"][1] + 1))
    elif t == "ci_step":
        s = ser(treated)
        assert c["treated_min_points"] <= s[c["to"]] - s[c["from"]] <= c["treated_max_points"]
        lo0, hi0 = _ci(con, c["metric"], treated, c["from"])
        lo1, hi1 = _ci(con, c["metric"], treated, c["to"])
        assert hi0 < lo1 or hi1 < lo0  # intervals do not overlap
        for g in comps:
            sg = ser(g)
            assert abs(sg[c["to"]] - sg[c["from"]]) < c["comparisons_max_abs_points"], g
    elif t == "rises_every_year":
        s = ser(treated)
        assert all(s[y] > s[y - 1] for y in range(c["years"][0], c["years"][1] + 1))
    elif t in ("within_prior_range", "exceeds_prior_range"):
        s = ser(treated)
        prior = [_pct(s[y - 1], s[y]) for y in range(c["prior"][0], c["prior"][1] + 1)]
        change = _pct(s[c["change_to"] - 1], s[c["change_to"]])
        if t == "within_prior_range":
            assert min(prior) <= change <= max(prior)
        else:
            assert change >= c["min_pct"] and change > max(prior)
            if "prior_min_pct" in c:  # the sentence quotes the prior range to one decimal
                assert (
                    round(min(prior), 1) == c["prior_min_pct"] and round(max(prior), 1) == c["prior_max_pct"]
                )
    elif t == "window_change_exceeds_comparisons":

        def change(g: str) -> float:
            s = ser(g)
            return _mean(s, *c["post"]) / _mean(s, *c["pre"]) - 1

        assert all(change(treated) > change(g) for g in comps)
    elif t == "prior_growth_exceeds":
        s = ser(treated)
        mine = _pct(s[c["from"]], s[c["to"]])
        for g in c["geos"]:
            assert mine > _pct(ser(g)[c["from"]], ser(g)[c["to"]]), g
    elif t == "cross_measure_change":
        a = _series(con, c["from_metric"], c["period_kind"], treated)[c["from_year"]]
        b = _series(con, c["to_metric"], c["period_kind"], treated)[c["to_year"]]
        assert c["min_pct"] <= _pct(a, b) <= c["max_pct"]
    elif t == "irregular":
        s = ser(c["geo"])
        assert all(abs(_pct(s[y - 1], s[y])) >= c["min_abs_pct"] for y in c["years"])
    elif t in ("policy_constant", "policy_known_days"):
        # Statements about the comparison states' coded law, from verified day runs only.
        lo, hi = date.fromisoformat(c["from"]), date.fromisoformat(c["to"])
        segs = con.execute(
            "SELECT segment_start, segment_end, state FROM policy_segments WHERE geo_id = ? AND policy_dimension = ? "
            "AND segment_end >= ? AND segment_start <= ? ORDER BY segment_start",
            [c["geo"], c["dimension"], lo, hi],
        ).fetchall()
        if t == "policy_constant":  # one verified value on every day of [from, to]
            assert segs and segs[0][0] <= lo and segs[-1][1] >= hi, c
            assert all(s[2] == c["value"] for s in segs), c
            assert all((b[0] - a[1]).days == 1 for a, b in zip(segs, segs[1:], strict=False)), c
        else:
            known = sum(
                (min(s[1], hi) - max(s[0], lo)).days + 1 for s in segs if s[2] not in ("unknown", "disputed")
            )
            assert known == c["days"], (c, known)
    else:
        pytest.fail(f"unknown claim type {t}")


@needs_db
@pytest.mark.parametrize("path", CASES, ids=[p.stem for p in CASES])
def test_worked_example_claims_hold(path):
    case = yaml.safe_load(path.read_text(encoding="utf-8"))
    con = duckdb.connect(str(DB), read_only=True)
    comps = [g["geo_id"] for g in case["comparison_geos"]]
    assert case["claims"], "a worked example must tie its statements to checked claims"
    for c in case["claims"]:
        _check_claim(con, c, case["treated_geo"], comps)
