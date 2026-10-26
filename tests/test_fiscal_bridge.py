"""The Utah liquor-sales bridge (src/alcohol_data/fiscal_bridge.py), the provisional-figure register and the
dashboard's reconciliation.json (src/alcohol_data/dashboard/reconciliation.py).

The bridge keeps residuals as they fall: the tests check the arithmetic and the missing-data rules, not agreement.
"""

from __future__ import annotations

import html
import re

import duckdb
import pytest
import yaml

from alcohol_data import fiscal_bridge as fb
from alcohol_data import paths
from alcohol_data.dashboard import reconciliation as rc

UT = fb.UT


def test_rate_schedule_covers_every_year_once_and_marks_its_evidence():
    rates = fb.deposit_rates()
    assert fb.check_rates(rates) == []
    for fy in range(2012, 2027):
        for d in fb.DEPOSITS:
            assert fb.deposit_rate(d, fy) is not None, (d, fy)
    assert fb.deposit_rate("school_meals", 2012).status == "documented"
    assert fb.deposit_rate("enforcement_fund", 2012).rate == 0.01
    # The 2012 and 2013 bills were read online; the 2015-2020 text was not read.
    assert fb.deposit_rate("enforcement_fund", 2013).status == "documented_provisional"
    assert fb.deposit_rate("enforcement_fund", 2016).status == "inferred"
    assert fb.deposit_rate("enforcement_fund", 2022).rate == 0.00875
    assert fb.deposit_rate("enforcement_fund", 2024).rate == 0.01695
    assert fb.deposit_rate("school_meals", 2011) is None  # before the 2011 enactment: not coded


def test_rate_checks_catch_overlaps_unknown_status_and_unpinned_documents():
    r = fb.deposit_rates()[0]
    bad = [r, fb.DepositRate(**{**r.__dict__, "rate_id": "x", "status": "proven"})]
    problems = fb.check_rates(bad)
    assert any("overlapping" in p for p in problems) and any("unknown status" in p for p in problems)
    unpinned = fb.DepositRate(**{**r.__dict__, "evidence_ref": "url:https://example.gov"})
    assert any("pinned asset" in p for p in fb.check_rates([unpinned]))


RAW = paths.ROOT / "data" / "raw"


@pytest.mark.parametrize(
    ("asset", "phrase"),
    [
        ("ut_2010gs_sb0167_enrolled", "deposit 10% of the total gross revenue from sales of liquor"),
        ("ut_2011gs_sb0314_enrolled", "deposit 1% of the total gross revenue from the sale of liquor"),
    ],
)
def test_the_pinned_session_laws_say_what_the_schedule_cites(asset, phrase):
    files = (
        [p for p in (RAW / asset).glob("*") if not p.name.endswith(".json")] if (RAW / asset).is_dir() else []
    )
    if not files:
        pytest.skip(f"{asset} not in the raw cache")
    text = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", files[0].read_text(encoding="latin-1"))))
    text = re.sub(r" \d{4} ", " ", text)  # the enrolled copy numbers its lines
    assert phrase in text


def test_provisional_register_follows_its_contract():
    rows = fb.provisional_figures()
    assert rows and all(r["read_method"] == "web_reader" and r["url"].startswith("https://") for r in rows)
    assert fb.check_provisional(
        [
            {
                **dict.fromkeys(fb.PROVISIONAL_COLUMNS, ""),
                "figure_id": "a",
                "unit": "dollars",
                "read_method": "web_reader",
                "url": "https://x",
                "value": "-",
                "check": "not_saved",
            }
        ]
    ) == ["a: value '-' is not a number (a dash is no row, never a zero)"]
    bad = {
        **dict.fromkeys(fb.PROVISIONAL_COLUMNS, ""),
        "figure_id": "b",
        "unit": "dollars",
        "read_method": "web_reader",
    }
    bad.update(url="https://x", value="1", check="row_and_column")  # checked, but against no saved asset
    assert fb.check_provisional([bad]) == ["b: a checked figure names the saved asset it was checked against"]


def test_checked_readings_match_the_records_that_replace_them():
    """Every online reading checked against a saved document either names the manual observation that now carries its
    value, with the same value, or stays a checked research note; only readings of unsaved documents are unchecked."""
    import csv
    import json

    manual = {
        r["manual_id"]: r
        for r in csv.DictReader(
            open(paths.CURATED_DIR / "manual_observations.csv", encoding="utf-8", newline="")
        )
    }
    assets = set(
        json.loads((paths.ROOT / "config" / "builds" / "preview.pins.json").read_text(encoding="utf-8"))
    )
    rows = fb.provisional_figures()
    for f in rows:
        if f["check"] == "not_saved":
            assert not f["checked_against"] and not f["record"]
            continue
        assert f["checked_against"] in assets, f["figure_id"]
        if f["record"]:
            m = manual[f["record"]]
            num = float(m["raw_value"].strip("$()").replace(",", "")) if m["raw_value"] != "-" else 0.0
            assert (
                m["asset_id"] in assets
            )  # the same document, or (for a figure quoted in a later report) its source
            assert abs(num * abs(float(m["multiplier"])) - f["value_dollars"]) < 0.5, f["figure_id"]
    assert sum(1 for f in rows if f["record"]) == 216
    # Every online reading is now checked against a saved document (the FY2022 and FY2023 ACFRs, saved 2026-10-14).
    assert not [f["figure_id"] for f in rows if f["check"] == "not_saved"]


def test_each_statement_reproduces_its_own_subtotals():
    """Pennsylvania's statements and the DABC summaries reproduce their subtotals from their lines. The only failures
    are in the DABC reports themselves (FY2013-FY2015; both the 81st and the 84th miss FY2015 by the same amount), so
    they are listed here rather than hidden."""
    problems = fb.identity_problems()
    assert not [p for p in problems if p.startswith("pa")]
    assert {p.split(":")[0] for p in problems} == {
        "dabc81 FY2013 total revenue less deductions",
        "dabc81 FY2014 total revenue less deductions",
        "dabc81 FY2015 total revenue less deductions",
        "dabc84 FY2015 total revenue less deductions",
    }


def test_overlapping_readings_agree():
    by = {}
    for f in fb.provisional_figures():
        doc = f["figure_id"].split("_")[0]
        if doc.startswith("dabc") or doc.startswith("pa"):
            by.setdefault((f["geo_id"], f["concept"], f["fiscal_year"]), []).append(f["value_dollars"])
    disagree = {k: sorted(v) for k, v in by.items() if max(v) - min(v) > 1500}
    # The 81st report's page 8 prints FY2016 sales as 405,991,384; its page 21 and the 84th print 405,911,384.
    assert disagree == {(UT, "sales_net_of_taxes", 2016): [405_911_000.0, 405_911_384.0, 405_991_384.0]}


def _db(rows, census=()):
    con = duckdb.connect()
    con.execute(
        "CREATE TABLE observations (observation_id VARCHAR, geo_id VARCHAR, measure_id VARCHAR, year INTEGER, value DOUBLE, "
        "source_locator VARCHAR, period_kind VARCHAR, review_status VARCHAR)"
    )
    con.execute(
        "CREATE TABLE preferred_observations AS SELECT observation_id, geo_id, measure_id, year, value, period_kind FROM observations"
    )
    for i, (m, y, v) in enumerate(rows):
        con.execute(
            "INSERT INTO observations VALUES (?, ?, ?, ?, ?, 'p', 'state_fiscal_year', 'extracted_unreviewed')",
            [f"o{i}", UT, m, y, v],
        )
        con.execute(
            "INSERT INTO preferred_observations VALUES (?, ?, ?, ?, ?, 'state_fiscal_year')",
            [f"o{i}", UT, m, y, v],
        )
    for i, (y, v) in enumerate(census):
        con.execute(
            "INSERT INTO preferred_observations VALUES (?, ?, ?, ?, ?, 'state_fiscal_year')",
            [f"c{i}", UT, fb.CENSUS_RECEIPTS, y, v],
        )
    return con


S, L, E = fb.DABS_MEASURES["sales"], fb.DABS_MEASURES["school_meals"], fb.DABS_MEASURES["enforcement_fund"]


def test_fy2024_every_basis_reproduces_the_figures_given_so_far():
    # The FY2024 figures: two sales lines, the two printed deposit lines, the one combined transfer, Census.
    con = _db(
        [
            (S, 2024, 578_856_000.0),
            (S, 2024, 583_836_000.0),
            (L, 2024, 67_706_000.0),
            (E, 2024, 9_812_000.0),
            (fb.COMBINED_TRANSFER, 2024, 67_699_000.0),
        ],
        census=[(2024, 493_645_000.0)],
    )
    rows = {(r["basis"], r["sales"]["value"]): r for r in fb.deposit_bases(con, 2024)}
    k = lambda basis, sales: round(rows[(basis, sales)]["residual"] / 1000, 1)  # noqa: E731
    # The rates in law: 578,856 x (1 - 0.10 - 0.01695) - 493,645 = 17,513.8
    assert k("statutory", 578_856_000.0) == 17_513.8 and k("statutory", 583_836_000.0) == 21_911.4
    # DABS's combined transfer agrees with the rates in law on 578,856 within $2 thousand.
    assert (
        k("combined_transfer", 578_856_000.0) == 17_512.0
        and k("combined_transfer", 583_836_000.0) == 22_492.0
    )
    # The two printed lines (the "reported" variant): 7.7 and 12.7 million.
    assert k("printed_lines", 578_856_000.0) == 7_693.0 and k("printed_lines", 583_836_000.0) == 12_673.0
    # The school-meals deposit alone (2026-10-13, superseded): 27.3 and 31.8 million.
    assert k("school_only", 578_856_000.0) == 27_325.4 and k("school_only", 583_836_000.0) == 31_807.4
    # The difference between the bases is the enforcement transfer, once, twice or not at all.
    assert k("school_only", 578_856_000.0) - k("statutory", 578_856_000.0) == pytest.approx(9_811.6, abs=0.1)
    # A missing term leaves its basis out instead of filling it.
    con2 = _db([(S, 2024, 578_856_000.0)], census=[(2024, 493_645_000.0)])
    assert {r["basis"] for r in fb.deposit_bases(con2, 2024)} == {"statutory", "school_only"}
    assert fb.deposit_bases(_db([(S, 2024, 578_856_000.0)]), 2024) == []  # no Census: nothing


def test_the_two_formulas_differ_only_by_the_comparator_and_the_other_income():
    # The bridge (DABS sales - statutory deposits - Census) and the revenue series (the same + DABS other income -
    # the audited operating revenue), with one sign. FY2023's -1,075 and 16,485 are one gap seen against two figures.
    oi, opr = fb.DABS_OTHER_INCOME, fb.AUDITED_OPERATING_REVENUE
    con = _db(
        [
            (S, 2023, 579_050_000.0),
            (oi, 2023, 6_899_000.0),
            (opr, 2023, 506_492_000.0),
            (S, 2024, 578_856_000.0),
            (S, 2024, 583_836_000.0),  # two printed sales figures: the lower is used
            (oi, 2024, 4_454_000.0),
            (oi, 2024, 9_381_000.0),
            (opr, 2024, 499_666_000.0),
            (S, 2025, 551_346_000.0),
            (oi, 2025, 6_569_000.0),
            (opr, 2025, 493_437_000.0),
            (fb.AUDITED_SALES, 2025, 486_942_000.0),
            (S, 2022, 557_452_000.0),  # no other income and no audited revenue: left out
        ],
        census=[(2023, 517_153_000.0), (2024, 493_645_000.0)],
    )
    rows = {r["fiscal_year"]: r for r in fb.formula_change(con, range(2022, 2026))}
    assert sorted(rows) == [2023, 2024, 2025]
    k = lambda fy, key: round(rows[fy][key] / 1000, 1)  # noqa: E731
    assert (k(2023, "bridge_residual"), k(2023, "series_residual")) == (-1_074.7, 16_485.3)
    assert (k(2024, "bridge_residual"), k(2024, "series_residual")) == (17_513.8, 15_946.8)
    assert (k(2025, "bridge_residual"), k(2025, "series_residual")) == (-75.9, -1.9)
    assert (
        rows[2025]["comparator_kind"] == "audited_sales"
        and rows[2024]["comparator_kind"] == "census_receipts"
    )
    for r in rows.values():
        assert r["difference"] == pytest.approx(r["comparator_gap"] - r["dabs_other_income"], abs=1e-6)
    # FY2023: Census is 10,661 above the audited operating revenue the later ACFRs print for that year.
    assert k(2023, "comparator_gap") == -10_661.0 and k(2023, "difference") == -17_560.0
    assert (
        rows[2023]["audited_operating_revenue_first_published"] is None
    )  # no asset column in this test table


def test_fy2023_as_first_printed_reconciles_and_the_restated_figure_does_not():
    # The FY2023 ACFR (saved 2026-10-14) prints the fund's FY2023 operating revenue as 523,992; the FY2024 and FY2025
    # editions restate it to 506,492. Against DABS's own figures the first printing is within $1.1 million, like every
    # other year; the restated figure is $16.5 million lower. FY2024's gap is in its first printing too.
    db = paths.ROOT / "data" / "processed" / "alcohol_data.duckdb"  # the checkout's build, not the test home
    if not db.is_file():
        pytest.skip("full build not present in the checkout")
    con = duckdb.connect(str(db), read_only=True)
    rows = {r["fiscal_year"]: r for r in fb.formula_change(con, range(2022, 2026))}
    r23, r24 = rows[2023], rows[2024]
    assert r23["audited_operating_revenue_first_published"] == 523_992_000.0
    assert r23["audited_operating_revenue"] == 506_492_000.0  # the latest edition, preferred by the build
    assert round(r23["series_residual_first_published"] / 1000) == -1_015
    assert round(r23["series_residual"] / 1000) == 16_485
    assert (
        r24["audited_operating_revenue_first_published"] == r24["audited_operating_revenue"] == 499_666_000.0
    )
    assert round(r24["series_residual_first_published"] / 1000) == 15_947


def test_bridge_arithmetic_both_variants():
    con = _db(
        [(S, 2020, 500_212_000.0), (L, 2020, 50_022_000.0), (E, 2020, 5_002_000.0)],
        census=[(2020, 445_208_000.0)],
    )
    (r,) = fb.utah_bridge(con, years=[2020], include_provisional=False)
    stat, rep = r["variants"]
    assert (
        stat["kind"] == "statutory"
        and stat["school_meals"] == pytest.approx(50_021_200.0)
        and stat["enforcement_fund"] == pytest.approx(5_002_120.0)
    )
    assert stat["residual"] == pytest.approx(500_212_000 - 50_021_200 - 5_002_120 - 445_208_000)
    assert rep["residual"] == pytest.approx(500_212_000 - 50_022_000 - 5_002_000 - 445_208_000)
    assert r["status"] == "reconciles_numerically" and r["reconciles_with"] == ["reported", "statutory"]
    assert r["census_receipts"][0]["rec"].startswith(f"obs:{fb.CENSUS_RECEIPTS}@state_fiscal_year:")


def test_a_conflict_keeps_both_sales_figures_and_a_large_residual_stays_unresolved():
    con = _db(
        [(S, 2024, 578_856_000.0), (S, 2024, 583_836_000.0), (L, 2024, 67_706_000.0), (E, 2024, 9_812_000.0)],
        census=[(2024, 493_645_000.0)],
    )
    (r,) = fb.utah_bridge(con, years=[2024], include_provisional=False)
    assert r["dabs_sales_conflict"] and len(r["variants"]) == 4
    assert r["status"] == "unresolved" and r["reconciles_with"] == []
    stat = [v for v in r["variants"] if v["kind"] == "statutory"]
    assert [round(v["residual"] / 1e3, 1) for v in stat] == [17513.8, 21911.4]


def test_missing_values_stay_missing():
    # No reported deposits: the reported variant has no residual (never a zero deposit).
    con = _db([(S, 2021, 517_390_000.0)], census=[(2021, 461_147_000.0)])
    (r,) = fb.utah_bridge(con, years=[2021], include_provisional=False)
    rep = next(v for v in r["variants"] if v["kind"] == "reported")
    assert rep["school_meals"] is None and rep["residual"] is None and rep["within_tolerance"] is None
    # Nothing to compare with: no row at all.
    assert fb.utah_bridge(_db([(S, 2026, 1.0)]), years=[2026], include_provisional=False) == []


def test_checked_readings_fill_years_a_build_lacks_and_fy2025_uses_the_audited_fund():
    con = _db(
        [(S, 2025, 551_346_000.0), (L, 2025, 56_897_000.0), (E, 2025, 9_600_000.0)],
        census=[(2015, 334_840_000.0)],
    )
    rows = {r["fiscal_year"]: r for r in fb.utah_bridge(con, years=[2015, 2025])}
    # A build without the transcriptions falls back on the readings, which are checked against the saved reports.
    assert rows[2015]["dabs_sales"][0]["figure_id"] == "dabc84_sales_net_of_taxes_fy2015"
    assert not rows[2015]["uses_provisional"]
    assert rows[2025]["compared_with"] == "audited_fund_sales" and not rows[2025]["uses_provisional"]
    stat = next(v for v in rows[2025]["variants"] if v["kind"] == "statutory")
    assert stat["residual"] == pytest.approx(551_346_000 * (1 - 0.1 - 0.01695) - 486_942_000)
    assert fb.utah_bridge(con, years=[2015], include_provisional=False) == []


# ----- reconciliation.json ----------------------------------------------------------------------------------------


def _export_db(drop_asset: str | None = None):
    cfg = yaml.safe_load(next(rc.CONFIG_DIR.glob("*.yaml")).read_text(encoding="utf-8"))
    text = yaml.safe_dump(cfg)
    assets = set(re.findall(r"asset:([a-z0-9_]+)", text)) | {
        r.evidence_ref.split("|")[0].removeprefix("asset:")
        for r in fb.deposit_rates()
        if r.evidence_ref.startswith("asset:")
    }
    measures = (
        set(re.findall(r"measure: ([a-z0-9_]+)", text))
        | set(fb.DABS_MEASURES.values())
        | {fb.CENSUS_RECEIPTS}
    )
    con = _db(
        [(S, 2024, 578_856_000.0), (S, 2024, 583_836_000.0), ("ut_dabs_gross_profit", 2024, 254_897_000.0)],
        census=[(2024, 493_645_000.0)],
    )
    con.execute("CREATE TABLE source_assets (asset_id VARCHAR, edition VARCHAR, url VARCHAR)")
    con.executemany(
        "INSERT INTO source_assets VALUES (?, 'e', 'https://x')", [[a] for a in sorted(assets - {drop_asset})]
    )
    con.execute("CREATE TABLE measures (measure_id VARCHAR)")
    con.executemany("INSERT INTO measures VALUES (?)", [[m] for m in sorted(measures)])
    for oid, m in [("pa1", fb.CENSUS_RECEIPTS), ("pa2", "pa_plcb_ssf_sales_net_of_taxes")]:
        con.execute(
            "INSERT INTO observations VALUES (?, 'state:42', ?, 2024, 2545114000, 'p', 'state_fiscal_year', NULL)",
            [oid, m],
        )
    return con, sorted(assets)


def _registers():
    from alcohol_data.dashboard import contracts as K

    return {r["lead_id"] for r in K.read_csv(K.LEADS_CSV)}, {r["gap_id"] for r in K.read_csv(K.GAPS_CSV)}


def test_reconciliation_json_resolves_sources_and_keeps_kinds_apart():
    con, _ = _export_db()
    out = rc.build(con, *_registers())
    assert out["method"] == fb.BRIDGE_METHOD and set(out["statuses"]) == set(fb.STATUSES)
    assert all(s["kind"] in rc.REF_KINDS for f in out["findings"] for s in f["sources"])
    # Every reference of a rate is shown, not only the first; an inferred rate cites none.
    rates = {r["rate_id"]: r for r in out["deposit_rates"]}
    assert [s["url"] for s in rates["ut_enforcement_fy2013_fy2014"]["sources"]] == [
        "https://le.utah.gov/~2012/bills/hbillenr/hb0354.htm",
        "https://le.utah.gov/~2013/bills/hbillenr/hb0399.htm",
        "https://le.utah.gov/~2012S4/bills/sbillint/SB4001.htm",
    ]
    assert rates["ut_enforcement_fy2015_fy2020"]["sources"] == []
    rows = {r["id"]: r for r in out["peer"]["rows"]}
    # Utah's FY2024 sales conflict: both candidates; Pennsylvania's from the saved audit, as a record.
    assert [v["value"] for v in rows["own_sales"]["values"]["utah"]["2024"]] == [578_856_000.0, 583_836_000.0]
    pa = rows["own_sales"]["values"]["peer"]["2024"]
    assert len(pa) == 1 and not pa[0]["provisional"] and pa[0]["value"] == 2_545_114_000.0
    assert pa[0]["rec"].startswith("obs:pa_plcb_ssf_sales_net_of_taxes@")
    gm = rows["gross_margin"]["values"]["utah"]["2024"]
    assert [round(v["value"], 4) for v in gm] == [round(254_897 / 578_856, 4), round(254_897 / 583_836, 4)]
    assert rows["school_meals"]["values"]["peer"]["2024"] == []  # no counterpart: nothing, not zero
    assert {r["comparable"] for r in out["peer"]["rows"]} <= rc.COMPARABLE
    assert all(d["read_method"] == "web_reader" for d in out["provisional_documents"])


def test_reconciliation_json_refuses_an_unknown_source():
    con, assets = _export_db(drop_asset="ut_2011gs_sb0314_enrolled")
    with pytest.raises(ValueError, match="unknown asset ut_2011gs_sb0314_enrolled"):
        rc.build(con, *_registers())
