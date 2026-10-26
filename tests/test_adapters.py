"""Adapter tests on real slices of the source files (tests/fixtures)."""

from datetime import date

from alcohol_data.adapters import ADAPTERS, Rejected, Staged
from tests.conftest import FIXTURES


def run(parser, asset):
    fn, _ = ADAPTERS[parser]
    items = list(fn(asset, asset._path))
    return [i for i in items if isinstance(i, Staged)], [i for i in items if isinstance(i, Rejected)]


def make(asset_factory, parser, fixture, **kw):
    a = asset_factory(parser=parser, **kw)
    a._path = FIXTURES / fixture
    return a


# ---------------------------------------------------------------- Census population


def test_2000s_file_leading_zero_restored(asset_factory):
    a = make(asset_factory, "census_pep_st_agesex_2000s", "census_st_agesex_2000s_subset.csv")
    staged, rejected = run("census_pep_st_agesex_2000s", a)
    assert not rejected
    geos = {s.geo_id for s in staged}
    assert "state:01" in geos and "state:1" not in geos  # file publishes Alabama as "1"


def test_2000s_age_universes_and_published_total(asset_factory):
    a = make(asset_factory, "census_pep_st_agesex_2000s", "census_st_agesex_2000s_subset.csv")
    staged, _ = run("census_pep_st_agesex_2000s", a)
    ut = {(s.measure_id, s.year): s.value for s in staged if s.geo_id == "state:49"}
    # Gold standard: AGE=999 total for Utah, July 1, 2005, as published in st-est00int-agesex.csv.
    assert ut[("pop_total_resident", 2005)] == 2457719
    assert (
        ut[("pop_total_resident", 2005)]
        > ut[("pop_age14plus_resident", 2005)]
        > ut[("pop_age18plus_resident", 2005)]
        > ut[("pop_age21plus_resident", 2005)]
    )
    assert all(s.period_kind == "point_in_time" and s.period_start == date(s.year, 7, 1) for s in staged)


def test_alldata6_ignores_sex_rows_and_sums_six_races(asset_factory):
    a = make(asset_factory, "census_pep_alldata6", "census_alldata6_v2025_utah.csv")
    staged, rejected = run("census_pep_alldata6", a)
    assert not rejected
    total_2020 = next(s.value for s in staged if s.measure_id == "pop_total_resident" and s.year == 2020)
    assert total_2020 == 3283970  # sum over SEX=0, ORIGIN=0, RACE 1-6 (checked against the raw file)


def test_1990s_intercensal_aggregates_counties_only_to_total(asset_factory):
    a = make(
        asset_factory,
        "census_pep_icen_1990s",
        "census_icen1995_two_utah_counties.txt",
        options={"year": 1995},
    )
    staged, rejected = run("census_pep_icen_1990s", a)
    assert not rejected and len(staged) == 1
    s = staged[0]
    assert s.measure_id == "pop_total_resident" and s.geo_id == "state:49"
    manual = sum(
        int(line.split()[-1])
        for line in (FIXTURES / "census_icen1995_two_utah_counties.txt").read_text().splitlines()
    )
    assert s.value == manual
    assert "aggregated_from_county_rows" in s.quality_flags


def test_1990s_year_mismatch_rejected(asset_factory):
    a = make(
        asset_factory,
        "census_pep_icen_1990s",
        "census_icen1995_two_utah_counties.txt",
        options={"year": 1996},
    )
    staged, rejected = run("census_pep_icen_1990s", a)
    assert not staged and rejected


# ---------------------------------------------------------------- NIAAA


def test_niaaa_documented_layout_would_truncate_population():
    line = next(
        x
        for x in (FIXTURES / "niaaa_pcyr_subset.txt").read_text(encoding="latin-1").splitlines()
        if x.startswith("2016 49 4")
    )
    assert line[31:40].strip() == "232066"  # documented columns 32-40: one digit short
    assert line.split()[5] == "2320667"


def test_niaaa_values_scaled_and_missing_not_zero(asset_factory):
    a = make(asset_factory, "niaaa_pcyr", "niaaa_pcyr_subset.txt", format="text_fixed_width")
    staged, rejected = run("niaaa_pcyr", a)
    assert not rejected
    get = {(s.geo_id, s.measure_id, s.year): s for s in staged}
    wine = get[("state:49", "niaaa_ethanol_per_capita_14plus_wine", 2016)]
    assert abs(wine.value - 0.1899) < 1e-12 and wine.raw_value == "1899"
    assert get[("state:49", "pop_age14plus_resident", 2016)].value == 2320667
    # "." (not published) for all-beverage time-varying ABV must be missing, never 0
    assert ("state:49", "niaaa_time_varying_abv_all", 2016) not in get
    region = get[("census_region:4", "niaaa_ethanol_gallons_all", 2024)]
    assert region.value == 179500607
    missing = [s for s in staged if s.value is None]
    assert all(s.missing_reason == "not_published" for s in missing)
    assert all(s.value != 0 for s in staged if s.raw_value == ".")


def test_niaaa_per_capita_consistent_with_components(asset_factory):
    a = make(asset_factory, "niaaa_pcyr", "niaaa_pcyr_subset.txt", format="text_fixed_width")
    staged, _ = run("niaaa_pcyr", a)
    assert not any("per_capita_inconsistent_with_components" in s.quality_flags for s in staged)


# ---------------------------------------------------------------- BRFSS


def test_brfss_crosswalk_breaks_and_skips(asset_factory):
    staged = []
    for fx in ("brfss_2011_present_subset.csv", "brfss_1995_2010_subset.csv"):
        a = make(asset_factory, "cdc_brfss_prevalence", fx)
        s, rejected = run("cdc_brfss_prevalence", a)
        assert not rejected
        staged += s
    geos = {s.geo_id for s in staged}
    assert geos == {"state:47", "state:49"}  # medians (UW) and territories (PR) skipped
    binge = {(s.geo_id, s.year): s for s in staged if s.measure_id == "brfss_binge_5m_4f_pct"}
    ut2011 = binge[("state:49", 2011)]
    assert (ut2011.value, ut2011.ci_low, ut2011.ci_high) == (12.0, 11.1, 12.8)  # gold standard row
    assert ut2011.comparability_group != binge[("state:49", 2010)].comparability_group
    assert "method_break_2011_first_year" in ut2011.quality_flags
    # binge definition changed in 2006: 2005 must be a different measure
    assert not any(s.measure_id == "brfss_binge_5m_4f_pct" and s.year == 2005 for s in staged)
    assert any(s.measure_id == "brfss_binge_5plus_any_sex_pct" and s.year == 2005 for s in staged)
    heavy = [s for s in staged if s.measure_id == "brfss_heavy_14m_7f_per_week_pct"]
    assert heavy and all(s.source_code.startswith("_RFDRHV") for s in heavy)
    assert all(s.period_kind == "survey_year" and s.ci_level == 0.95 for s in staged if s.ci_low is not None)


# ---------------------------------------------------------------- Census STC


def test_stc_historical_units_sentinels_and_fiscal_years(asset_factory):
    a = make(asset_factory, "census_stc_historical_xlsx", "stc_historical_subset.xlsx", format="xlsx")
    staged, rejected = run("census_stc_historical_xlsx", a)
    assert not rejected
    t10 = {(s.geo_id, s.year): s for s in staged if s.measure_id == "stc_alcoholic_beverages_sales_tax"}
    ut = t10[("state:49", 2025)]
    assert (
        ut.value == 19_086_000 and ut.raw_value == "19086" and ut.multiplier == 1000.0
    )  # thousands -> dollars
    assert ut.period_start == date(2024, 7, 1) and ut.period_end == date(2025, 6, 30)
    al = t10[("state:01", 2025)]
    assert al.period_end == date(2025, 9, 30)  # Alabama fiscal year ends Sept 30
    al55 = next(
        s
        for s in staged
        if s.geo_id == "state:01" and s.extra["stc_year"] == 1955 and s.measure_id.endswith("sales_tax")
    )
    assert al55.period_end == date(1954, 9, 30) and "fiscal_year_ends_before_stc_year" in al55.quality_flags
    us1922 = {s.measure_id: s for s in staged if s.geo_id == "nation:us" and s.year == 1922}
    # 1922 (Prohibition): T10 is a published zero; T20 is the -11111 "not available" code, never a negative amount.
    assert (
        us1922["stc_alcoholic_beverages_sales_tax"].value == 0
        and us1922["stc_alcoholic_beverages_sales_tax"].raw_value == "0"
    )
    lic = us1922["stc_alcoholic_beverages_license_tax"]
    assert (
        lic.value is None
        and lic.missing_reason == "unavailable"
        and "source_sentinel_-11111" in lic.quality_flags
    )


def test_fiscal_calendar_matches_published_fiscal_year_ends(asset_factory):
    from alcohol_data.fiscal import fiscal_period_for

    a = make(asset_factory, "census_stc_historical_xlsx", "stc_historical_subset.xlsx", format="xlsx")
    staged, _ = run("census_stc_historical_xlsx", a)
    checked = 0
    for s in staged:
        if s.fiscal_year_end and s.fiscal_year_end.year >= 1985:
            start, end, rule = fiscal_period_for(s.geo_id, s.fiscal_year_end.year)
            assert (start, end) == (s.period_start, s.period_end), s.geo_id
            checked += 1
    assert checked >= 30


def test_stc_flat_file_x_is_not_applicable_and_dc_present(asset_factory):
    a = make(asset_factory, "census_stc_flat_file", "stc_fy2025_flat.txt", options={"fiscal_year": 2025})
    staged, rejected = run("census_stc_flat_file", a)
    assert not rejected
    dc = next(
        s for s in staged if s.geo_id == "state:11" and s.measure_id == "stc_alcoholic_beverages_sales_tax"
    )
    assert dc.value == 6_966_000
    assert "fiscal_year_dates_not_verified_against_source" in dc.quality_flags
    xs = [s for s in staged if s.raw_value == "X"]
    assert xs and all(s.value is None and s.missing_reason == "not_applicable" for s in xs)


def test_stc_flat_and_historical_agree_for_2025(asset_factory):
    h = make(asset_factory, "census_stc_historical_xlsx", "stc_historical_subset.xlsx", format="xlsx")
    f = make(asset_factory, "census_stc_flat_file", "stc_fy2025_flat.txt", options={"fiscal_year": 2025})
    hs, _ = run("census_stc_historical_xlsx", h)
    fs, _ = run("census_stc_flat_file", f)
    key = lambda s: (s.geo_id, s.measure_id, s.period_start, s.period_end)  # noqa: E731
    hist = {key(s): s.value for s in hs if s.year == 2025}
    flat = {key(s): s.value for s in fs}
    common = set(hist) & set(flat)
    assert len(common) == 8  # 4 geographies x T10, T20 (flat files carry no C105 total row)
    assert all(hist[k] == flat[k] for k in common)


# ---------------------------------------------------------------- BLS


def test_cpi_unavailable_month_is_missing_with_footnote(asset_factory):
    a = make(asset_factory, "bls_cpi_api", "bls_cpi_2023_2025.json", format="json")
    staged, rejected = run("bls_cpi_api", a)
    assert not rejected
    oct25 = next(s for s in staged if s.period_label == "2025-10")
    assert oct25.value is None and oct25.missing_reason == "unavailable"
    assert "lapse in appropriations" in (oct25.footnote or "")
    assert len([s for s in staged if s.year == 2024 and s.value is not None]) == 12
