"""The store cost regression (src/alcohol_data/store_cost.py), checked against statsmodels.

The fixture is a made-up panel of six systems and one that closes, not Census data. The reference values were
computed with statsmodels 0.15.0, ``smf.ols("dE ~ dR + C(y)").fit(cov_type="cluster", cov_kwds={"groups": g})``,
with the interval rebuilt as slope +/- t(0.975, clusters - 1) * se (statsmodels' cluster results use the normal).
"""

import pytest

from alcohol_data import store_cost as sc

PANEL = [
    ("state:01", 2000, 61.128, 36.799),
    ("state:01", 2001, 59.61, 35.69),
    ("state:01", 2002, 63.665, 38.299),
    ("state:01", 2003, 63.456, 38.366),
    ("state:01", 2004, 61.934, 37.544),
    ("state:01", 2005, 64.237, 40.462),
    ("state:01", 2006, 62.885, 37.013),
    ("state:01", 2007, 64.3, 38.706),
    ("state:01", 2008, 68.047, 42.658),
    ("state:01", 2009, 72.959, 46.132),
    ("state:16", 2000, 26.035, 15.639),
    ("state:16", 2001, 25.449, 14.997),
    ("state:16", 2002, 26.831, 16.529),
    ("state:16", 2003, 27.5, 16.918),
    ("state:16", 2004, 29.539, 18.048),
    ("state:16", 2005, 28.773, 17.854),
    ("state:16", 2006, 28.919, 17.928),
    ("state:16", 2007, 29.886, 18.608),
    ("state:16", 2008, 30.462, 18.792),
    ("state:16", 2009, 32.587, 20.197),
    ("state:19", 2000, 136.478, 78.319),
    ("state:19", 2001, 143.768, 88.955),
    ("state:19", 2002, 140.806, 83.289),
    ("state:19", 2003, 137.609, 85.19),
    ("state:19", 2005, 146.437, 85.929),
    ("state:19", 2006, 145.295, 87.224),
    ("state:19", 2007, 156.078, 92.959),
    ("state:19", 2008, 160.442, 99.724),
    ("state:19", 2009, 159.305, 98.139),
    ("state:23", 2008, 0.025, 0.001),
    ("state:23", 2007, 50.0, 41.0),
    ("state:23", 2006, 48.0, 40.0),
    ("state:23", 2005, 46.0, 37.0),
    ("state:42", 2000, 928.092, 561.912),
    ("state:42", 2001, 903.298, 561.375),
    ("state:42", 2002, 891.512, 510.318),
    ("state:42", 2003, 915.16, 549.605),
    ("state:42", 2004, 904.452, 569.84),
    ("state:42", 2005, 965.845, 600.031),
    ("state:42", 2006, 963.588, 587.284),
    ("state:42", 2007, 1019.073, 626.167),
    ("state:42", 2008, 990.473, 605.811),
    ("state:42", 2009, 1074.595, 662.7),
    ("state:49", 2000, 129.372, 76.1),
    ("state:49", 2001, 133.205, 82.965),
    ("state:49", 2002, 138.68, 84.07),
    ("state:49", 2003, 137.398, 83.17),
    ("state:49", 2004, 146.776, 89.055),
    ("state:49", 2005, 151.62, 94.086),
    ("state:49", 2006, 155.235, 99.659),
    ("state:49", 2007, 168.792, 105.793),
    ("state:49", 2008, 179.767, 114.378),
    ("state:49", 2009, 186.85, 119.451),
    ("state:50", 2000, 31.875, 18.793),
    ("state:50", 2001, 34.028, 20.55),
    ("state:50", 2002, 36.699, 23.223),
    ("state:50", 2003, 39.558, 24.357),
    ("state:50", 2004, 40.267, 24.559),
    ("state:50", 2005, 39.237, 24.811),
    ("state:50", 2006, 42.32, 26.206),
    ("state:50", 2007, 41.915, 26.385),
    ("state:50", 2008, 44.399, 28.481),
    ("state:50", 2009, 43.687, 27.09),
]
ROWS = [sc.StateYear(g, y, r, e) for g, y, r, e in PANEL]


def _kept():
    kept, _ = sc.prepare(ROWS)
    return kept


def test_a_closed_system_is_left_out_with_the_reason():
    kept, dropped = sc.prepare(ROWS)
    assert [(d["geo_id"], d["year"]) for d in dropped] == [("state:23", 2008)]
    assert "closed, sold or leased" in dropped[0]["why"]
    assert len(kept) == len(ROWS) - 1


def test_prepare_drops_rows_without_positive_revenue():
    kept, dropped = sc.prepare(
        [sc.StateYear("state:01", 2000, 0.0, 5.0), sc.StateYear("state:01", 2001, 10.0, 6.0)]
    )
    assert [r.year for r in kept] == [2001]
    assert dropped[0]["why"] == "no positive revenue"


def test_a_state_that_never_ran_a_system_is_one_summary_line():
    rows = [sc.StateYear("state:02", y, 0.0, 0.0) for y in (1972, 1977, 1978)] + [
        sc.StateYear("state:01", 2001, 10.0, 6.0)
    ]
    kept, dropped = sc.prepare(rows)
    assert [r.geo_id for r in kept] == ["state:01"]
    assert dropped == [
        {
            "geo_ids": ["state:02"],
            "state_years": 3,
            "why": "the state ran no liquor-store system in any year (revenue zero or missing throughout)",
        }
    ]


def test_differences_skip_a_missing_year():
    one = sc.differences(_kept(), 1)
    assert not [p for p in one if p.geo_id == "state:19" and p.year in (2004, 2005)]
    three = sc.differences(_kept(), 3)
    assert any(p.geo_id == "state:19" and p.year == 2005 for p in three)  # 2002 -> 2005
    assert not [p for p in three if p.geo_id == "state:23"]


@pytest.mark.parametrize(
    ("k", "weighting", "n", "beta", "se", "df", "lo", "hi"),
    [
        (
            1,
            "dollars",
            54,
            0.6720716931589189,
            0.004553961198300313,
            6,
            0.6609285515331434,
            0.6832148347846944,
        ),
        (
            1,
            "state_size_normalized",
            54,
            0.7259397659828998,
            0.06838071896322845,
            6,
            0.5586181743619619,
            0.8932613576038376,
        ),
        (3, "dollars", 40, 0.6963453452357736, 0.006324274271758166, 5, 0.68008828066921, 0.7126024098023372),
        (
            3,
            "state_size_normalized",
            40,
            0.7011898968018679,
            0.03028518249770477,
            5,
            0.6233393567843373,
            0.7790404368193986,
        ),
    ],
)
def test_slope_matches_statsmodels_cluster_results(k, weighting, n, beta, se, df, lo, hi):
    e = sc.estimate(_kept(), k, weighting)
    assert e is not None
    assert e["n"] == n
    assert e["df"] == df
    assert e["beta"] == pytest.approx(beta, abs=2e-6)
    assert e["se"] == pytest.approx(se, abs=2e-6)
    assert e["ci_low"] == pytest.approx(lo, abs=2e-6)
    assert e["ci_high"] == pytest.approx(hi, abs=2e-6)


def test_leave_one_state_out_brackets_the_slope_and_names_the_state():
    e = sc.estimate(_kept(), 1, "dollars")
    loo = e["leave_one_state_out"]
    assert loo["low"] <= e["beta"] <= loo["high"]
    assert loo["low_without"].startswith("state:") and loo["high_without"].startswith("state:")


def test_a_known_slope_is_recovered_without_noise():
    # Expenditure is exactly 0.8 of revenue plus a state constant, and each state's revenue follows its own path,
    # so every change has slope 0.8 under either weighting.
    paths = {
        "a": (3.0, (50.0, 55.0, 61.0, 58.0)),
        "b": (1.0, (80.0, 82.0, 90.0, 99.0)),
        "c": (2.0, (20.0, 24.0, 23.0, 27.0)),
    }
    rows = [
        sc.StateYear(g, 2000 + i, r, 0.8 * r + c) for g, (c, rs) in paths.items() for i, r in enumerate(rs)
    ]
    for w in sc.WEIGHTINGS:
        e = sc.estimate(rows, 1, w)
        assert e is not None
        assert e["beta"] == pytest.approx(0.8, abs=1e-9)
        assert e["se"] == pytest.approx(0.0, abs=1e-9)


def test_no_variation_across_states_gives_no_estimate():
    # Every state's revenue moves by the same proportion each year, so once the year effect is removed nothing is left.
    rows = [
        sc.StateYear(g, 2000 + i, base * (1.1**i), 0.7 * base * (1.1**i))
        for g, base in (("a", 10.0), ("b", 10.0), ("c", 10.0))
        for i in range(4)
    ]
    assert sc.estimate(rows, 1, "dollars") is None


def test_too_little_data_gives_no_estimate():
    assert (
        sc.estimate([sc.StateYear("a", 2000, 10.0, 6.0), sc.StateYear("a", 2001, 11.0, 6.5)], 1, "dollars")
        is None
    )
    with pytest.raises(ValueError):
        sc.estimate(_kept(), 1, "unweighted")


def test_run_reports_every_horizon_under_both_weightings_and_says_what_was_used():
    out = sc.run(ROWS, horizons=(1, 3))
    assert out["method"] == sc.STORE_COST_METHOD
    assert [(e["horizon_years"], e["weighting"]) for e in out["estimates"]] == [
        (1, "dollars"),
        (1, "state_size_normalized"),
        (3, "dollars"),
        (3, "state_size_normalized"),
    ]
    assert out["sample"]["states"] == [
        "state:01",
        "state:16",
        "state:19",
        "state:23",
        "state:42",
        "state:49",
        "state:50",
    ]
    assert out["sample"]["first_year"] == 2000 and out["sample"]["last_year"] == 2009
    assert 0.5 < out["sample"]["pooled_expenditure_per_revenue_dollar"] < 0.8
    assert out["excluded"][0]["geo_id"] == "state:23"


def test_export_writes_cost_model_json_from_preferred_observations(tmp_path):
    import json

    import duckdb

    from alcohol_data.dashboard.export import Export

    db = tmp_path / "t.duckdb"
    con = duckdb.connect(str(db))
    con.execute("CREATE TABLE build_info (key VARCHAR, value VARCHAR)")
    con.execute("INSERT INTO build_info VALUES ('as_of_date', '2026-10-10')")
    con.execute(
        "CREATE TABLE preferred_observations (geo_id VARCHAR, year INTEGER, measure_id VARCHAR, value DOUBLE)"
    )
    for g, y, r, e in PANEL:
        con.execute(
            "INSERT INTO preferred_observations VALUES (?, ?, ?, ?)", [g, y, sc.MEASURES["revenue"], r * 1e6]
        )
        con.execute(
            "INSERT INTO preferred_observations VALUES (?, ?, ?, ?)",
            [g, y, sc.MEASURES["expenditure"], e * 1e6],
        )
    # A national row and a revenue with no matching expenditure are not part of the panel.
    con.execute("INSERT INTO preferred_observations VALUES ('us', 2000, ?, 1.0)", [sc.MEASURES["revenue"]])
    con.execute(
        "INSERT INTO preferred_observations VALUES ('state:01', 1999, ?, 5.0)", [sc.MEASURES["revenue"]]
    )
    con.close()
    out = tmp_path / "out"
    ex = Export(out, db)
    ex.cost_model()
    d = json.loads((out / "cost_model.json").read_text(encoding="utf-8"))
    assert d["method"] == sc.STORE_COST_METHOD
    assert d["sample"]["state_years"] == len(PANEL) - 1  # the closed system's 2008 row
    assert [e["horizon_years"] for e in d["estimates"]] == [1, 1, 5, 5]
    assert d["inputs"]["measures"] == [sc.MEASURES["revenue"], sc.MEASURES["expenditure"]]
    assert "cost_model.json" in ex.files


# ----- which years: the shown sample stops at a last year; the extension is a stated comparison ---------------------

# Ten later years for the same systems: the same states, revenue and expenditure growing with some noise.
LATER = [
    sc.StateYear(g, y + 10, r * (1.25 + 0.01 * (y % 3)), e * (1.27 - 0.01 * (y % 2)))
    for g, y, r, e in PANEL
    if g != "state:23"
]


def test_run_stops_at_its_last_year_and_counts_what_it_leaves_out():
    base = sc.run(ROWS)
    cut = sc.run(ROWS + LATER, last_year=2009)
    assert cut["estimates"] == base["estimates"]
    assert cut["sample"]["last_year"] == 2009 and cut["sample"]["last_year_allowed"] == 2009
    later = cut["excluded"][-1]
    assert later["state_years"] == len(LATER) and later["why"] == "after FY2009, the last year of this sample"
    assert sc.run(ROWS + LATER)["sample"]["last_year"] == 2019  # without a last year, everything is used


def test_differences_across_a_comparability_group_change_are_left_out():
    rows = [
        sc.StateYear("a", 2000, 10.0, 6.0, group="g1"),
        sc.StateYear("a", 2001, 12.0, 7.0, group="g2"),
        sc.StateYear("a", 2002, 13.0, 8.0, group="g2"),
    ]
    assert [p.year for p in sc.differences(rows, 1)] == [2002]
    assert sc.differences(rows, 2) == []
    assert sc.across_groups(rows, 1) == [{"geo_id": "a", "from_year": 2000, "to_year": 2001}]
    assert sc.run(ROWS)["sample"]["differences_left_out_across_comparability_groups"] == {"1": 0, "5": 0}


def test_flagged_rows_always_and_repeats_from_a_year_are_left_out():
    rows = [
        sc.StateYear("a", 2015, 10.0, 6.0),
        sc.StateYear("a", 2016, 10.0, 6.5),  # revenue carried forward
        sc.StateYear("a", 2017, 12.0, 12.0, flags=("census_expenditure_equals_revenue",)),
        sc.StateYear("a", 2018, 13.0, 8.0, flags=("census_formula",)),  # not an excluding flag
    ]
    kept, dropped = sc.prepare(rows, repeats_from=2016)
    assert [r.year for r in kept] == [2015, 2018]
    why = {d["year"]: d["why"] for d in dropped}
    assert why[2016] == "revenue equals the previous year's exactly (carried forward)"
    assert why[2017].startswith("flagged census_expenditure_equals_revenue")
    kept, _ = sc.prepare(rows)  # the shown sample's rule: repeats stay
    assert [r.year for r in kept] == [2015, 2016, 2018]
    assert sc.repeats_previous_year(rows, 2016) == {("a", 2016): "revenue"}


def test_compare_extension_puts_both_samples_side_by_side():
    out = sc.compare_extension(ROWS + LATER, base_last_year=2009)
    assert out["base_sample"]["last_year"] == 2009 and out["extended_sample"]["last_year"] == 2019
    assert [(s["horizon_years"], s["weighting"]) for s in out["slopes"]] == [
        (k, w) for k in sc.DEFAULT_HORIZONS for w in sc.WEIGHTINGS
    ]
    base = {
        (e["horizon_years"], e["weighting"]): e for e in sc.run(ROWS + LATER, last_year=2009)["estimates"]
    }
    for s in out["slopes"]:
        b = base[(s["horizon_years"], s["weighting"])]
        assert s["base"]["beta"] == b["beta"] and s["base"]["ci_low"] == b["ci_low"]
        assert s["extended"]["n"] > s["base"]["n"]
        assert s["extended_outside_base_interval"] == (
            not b["ci_low"] <= s["extended"]["beta"] <= b["ci_high"]
        )
    assert out["any_slope_outside_the_other_interval"] == any(
        s["extended_outside_base_interval"] or s["base_outside_extended_interval"] for s in out["slopes"]
    )


def test_export_holds_the_shown_estimate_at_fy2015(tmp_path):
    import json

    import duckdb

    from alcohol_data.dashboard.export import Export

    def write(db, extra):
        con = duckdb.connect(str(db))
        con.execute("CREATE TABLE build_info (key VARCHAR, value VARCHAR)")
        con.execute("INSERT INTO build_info VALUES ('as_of_date', '2026-10-13')")
        con.execute(
            "CREATE TABLE preferred_observations (geo_id VARCHAR, year INTEGER, measure_id VARCHAR, value DOUBLE, "
            "comparability_group VARCHAR, quality_flags VARCHAR)"
        )
        for g, y, r, e, flags in [(g, y + 6, r, e, None) for g, y, r, e in PANEL] + extra:
            for m, v in ((sc.MEASURES["revenue"], r), (sc.MEASURES["expenditure"], e)):
                con.execute(
                    "INSERT INTO preferred_observations VALUES (?, ?, ?, ?, 'g', ?)",
                    [g, y, m, v * 1e6, flags],
                )
        con.close()

    later = [(r.geo_id, r.year + 6, r.revenue, r.expenditure, None) for r in LATER] + [
        ("state:28", 2020, 40.0, 40.0, "census_expenditure_equals_revenue")
    ]
    write(tmp_path / "a.duckdb", [])
    write(tmp_path / "b.duckdb", later)
    Export(tmp_path / "a", tmp_path / "a.duckdb").cost_model()
    Export(tmp_path / "b", tmp_path / "b.duckdb").cost_model()
    a = json.loads((tmp_path / "a" / "cost_model.json").read_text(encoding="utf-8"))
    b = json.loads((tmp_path / "b" / "cost_model.json").read_text(encoding="utf-8"))
    assert b["estimates"] == a["estimates"] and b["sample"]["last_year"] == 2015
    assert "extension_check" not in a
    check = b["extension_check"]
    assert check["extended_sample"]["last_year"] == 2025
    assert {"geo_id": "state:28", "year": 2020} == {
        k: v for k, v in check["extended_excluded"][0].items() if k != "why"
    }
