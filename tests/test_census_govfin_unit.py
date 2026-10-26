"""Census Individual Unit Files, FY2015-FY2024: the parser census_unit_liquor_stores and its validation checks.

The synthetic archives reproduce both layouts with all 50 state government directory records (the parser requires
exactly 50) and a few liquor store items. Tests on the real files run when the checkout's raw cache holds them.
"""

from __future__ import annotations

import zipfile
from datetime import date
from pathlib import Path

import duckdb
import pytest

from alcohol_data import geo, paths
from alcohol_data.adapters.base import Rejected, Staged
from alcohol_data.adapters.census_govfin import (
    CAPITAL_OUTLAY,
    COMPARABILITY,
    CURRENT_OPERATIONS,
    EXPENDITURE,
    REVENUE,
    parse_state_type,
    parse_unit,
)
from alcohol_data.config import AssetConfig
from alcohol_data.fiscal import fiscal_period_for
from alcohol_data.validation.checks import r_govfin_fy2015, r_govfin_repeats

STATES = [s for s in geo.states() if s.usps != "DC"]


def _asset(fy: int, asset_id: str | None = None) -> AssetConfig:
    return AssetConfig(
        asset_id=asset_id or f"census_govfin_unit_fy{fy}",
        source_id="census_govfin",
        url=None,
        method="manual_import",
        edition="test",
        source_series="census_govfin_unit",
        source_vintage="test",
        format="zip",
        parser="census_unit_liquor_stores",
        filename="test.zip",
        options={"fiscal_year": fy},
    )


def _gid(st, census: bool, n: int, codes: str | None = None) -> str:
    """A state government's ID: 14 characters in the Fin_GID layout, 12 in Fin_PID; Census or FIPS state codes."""
    code = st.census_gov_code if (codes or ("census" if census else "fips")) == "census" else st.fips
    return f"{code}0" + "0" * 11 if census else f"{code}0000{n:06d}"


def _directory_line(
    st, census: bool, n: int, fy: int, name: str | None = None, fy_end: str | None = None, codes=None
) -> str:
    end = fiscal_period_for(st.geo_id, fy)[1]
    tail = (
        f"{' ' * 9}{fy % 100:02d}{' ' * 7}{' ' * 2}{' ' * 2}{' ' * 2}"
        f"{fy_end or f'{end.month:02d}{end.day:02d}'}{fy % 100:02d}"
    )
    head = f"{_gid(st, census, n, codes)}{(name or st.name.upper()):<64}{'':<35}"
    line = head + (f"{st.fips}000{'':<5}" if census else f"{'':<5}") + tail
    assert len(line) == (153 if census else 146), len(line)
    return line


def _unit_line(gid: str, item: str, amount, fy: int, flag: str = "R") -> str:
    return f"{gid}{item}{amount:>12}{fy}{flag}"


def _level_line(code: str, level: str, item: str, amount: int, yy: int) -> str:
    return f"{code}{level} {item} {amount:>12}  {'0.00':>10} {yy:02d}"


def unit_zip(
    tmp_path: Path,
    fy: int,
    items: dict[str, dict[str, int]],
    *,
    census: bool | None = None,
    flags: dict[tuple[str, str], str] | None = None,
    level2: dict[str, dict[str, int]] | None = None,
    extra_unit: list[str] | None = None,
    names: dict[str, str] | None = None,
    fy_ends: dict[str, str] | None = None,
    drop: tuple[str, ...] = (),
    directory_kind: str | None = None,
    codes: str | None = None,
) -> Path:
    """A unit-file zip for ``fy``: ``items`` maps USPS codes to {item: thousands}; the level 2 lines repeat them
    unless ``level2`` says otherwise."""
    census = fy < 2017 if census is None else census
    flags, names, fy_ends = flags or {}, names or {}, fy_ends or {}
    by_usps = {s.usps: (i, s) for i, s in enumerate(STATES, start=1)}
    directory, unit, level = [], [], []
    for i, st in enumerate(STATES, start=1):
        if st.usps in drop:
            continue
        directory.append(_directory_line(st, census, i, fy, names.get(st.usps), fy_ends.get(st.usps), codes))
        unit.append(_unit_line(_gid(st, census, i, codes), "19U", 1000, fy))  # a debt item: not read
    yy = fy % 100
    for usps, its in items.items():
        i, st = by_usps[usps]
        for item, amount in its.items():
            unit.append(
                _unit_line(_gid(st, census, i, codes), item, amount, fy, flags.get((usps, item), "R"))
            )
    for usps, its in (level2 if level2 is not None else items).items():
        i, st = by_usps[usps]
        code = _gid(st, census, i, codes)[:2]
        level += [_level_line(code, "2", item, amount, yy) for item, amount in its.items()]
        level += [_level_line(code, "1", item, amount + 5, yy) for item, amount in its.items()]
    level.insert(0, _level_line("00", "2", "A90", 999999, yy))  # the U.S. total of state governments
    # A county government's liquor store (type 1) and a state record of another item: never read.
    unit.append(f"{'49' if not census else '45'}1018018{'0' * (5 if census else 3)}A90{77:>12}{fy}R")
    unit += extra_unit or []
    kind = directory_kind or ("GID" if census else "PID")
    folder = f"{fy}_Individual_Unit_Files/" if fy >= 2022 else ""
    p = tmp_path / f"unit{fy}.zip"
    with zipfile.ZipFile(p, "w") as z:
        z.writestr(
            f"{folder}{fy}FinEstDAT_07152026modp{'_pu' if fy < 2022 else ''}.txt", "\r\n".join(unit) + "\r\n"
        )
        z.writestr(f"{folder}Fin_{kind}_{fy}.txt", "\r\n".join(directory) + "\r\n")
        z.writestr(f"{folder}{yy:02d}statetypepu.txt", "\r\n".join(level) + "\r\n")
        z.writestr(f"{folder}{fy} S&L Public Use Files Technical Documentation.pdf", b"%PDF")
    return p


def _split(items):
    items = list(items)
    assert items, "the adapter yielded nothing"
    return [i for i in items if isinstance(i, Staged)], [i for i in items if isinstance(i, Rejected)]


def _by(staged):
    return {(s.geo_id, s.measure_id): s for s in staged}


def test_census_code_layout_reads_state_governments_only(tmp_path):
    items = {
        "UT": {"A90": 361199, "E90": 257660},
        "KY": {"E90": 5557, "G90": 153},
        "OR": {"A90": 568119, "E90": 423756, "G90": 4610},
        "AL": {"A90": 325393, "E90": 321268},
    }
    p = unit_zip(tmp_path, 2016, items, flags={("OR", "G90"): "I"})
    staged, rejected = _split(parse_unit(_asset(2016), p))
    assert rejected == []
    got = _by(staged)
    assert {g for g, _ in got} == {
        "state:49",
        "state:21",
        "state:41",
        "state:01",
    }  # Census codes 45, 18, 38, 01
    ut = got[("state:49", REVENUE)]
    assert ut.value == 361_199_000.0 and ut.raw_value == "361199" and ut.source_code == "A90"
    assert ut.period_end == date(2016, 6, 30) and got[("state:01", REVENUE)].period_end == date(2016, 9, 30)
    assert ut.quality_flags == [] and ut.comparability_group == COMPARABILITY
    assert ut.extra["item_flags"] == {"A90": "R", "E90": "R"} and ut.extra["census_name"] == "UTAH"
    assert "statetypepu.txt line" in ut.source_locator and "FinEstDAT" in ut.source_locator
    # A total counts an absent item as zero, says so and lists it; no capital outlay without an F or G item.
    total = got[("state:49", EXPENDITURE)]
    assert total.value == 257_660_000.0 and "census_formula" in total.quality_flags
    assert total.extra["absent_items_counted_as_zero"] == ["F90", "G90"]
    assert ("state:49", CAPITAL_OUTLAY) not in got
    # The county government's A90 (type 1) is not read: Utah's revenue is the state record only.
    assert sum(1 for s in staged if s.measure_id == REVENUE and s.geo_id == "state:49") == 1


def test_expenditure_without_revenue_is_flagged_and_revenue_stays_absent(tmp_path):
    p = unit_zip(tmp_path, 2015, {"KY": {"E90": 5134, "G90": 70}})
    staged, rejected = _split(parse_unit(_asset(2015), p))
    assert rejected == []
    got = _by(staged)
    assert ("state:21", REVENUE) not in got  # no A90: no value, not a zero
    assert set(got) == {("state:21", m) for m in (CURRENT_OPERATIONS, CAPITAL_OUTLAY, EXPENDITURE)}
    assert all("census_expenditure_without_revenue" in s.quality_flags for s in staged)
    assert got[("state:21", CAPITAL_OUTLAY)].value == 70_000.0
    assert got[("state:21", CAPITAL_OUTLAY)].extra["absent_items_counted_as_zero"] == ["F90"]
    assert got[("state:21", EXPENDITURE)].value == 5_204_000.0


def test_oregon_and_item_flags_get_their_own_groups_and_flags(tmp_path):
    p = unit_zip(
        tmp_path, 2016, {"OR": {"A90": 568119, "E90": 423756, "G90": 4610}}, flags={("OR", "G90"): "I"}
    )
    got = _by(_split(parse_unit(_asset(2016), p))[0])
    oregon = COMPARABILITY + "|oregon_unit_files"
    assert got[("state:41", REVENUE)].comparability_group == COMPARABILITY
    assert got[("state:41", CURRENT_OPERATIONS)].comparability_group == oregon
    assert got[("state:41", EXPENDITURE)].comparability_group == oregon
    assert got[("state:41", CAPITAL_OUTLAY)].comparability_group == COMPARABILITY
    assert "census_item_flag_I" in got[("state:41", CAPITAL_OUTLAY)].quality_flags
    assert "census_item_flag_I" in got[("state:41", EXPENDITURE)].quality_flags
    assert "census_item_flag_I" not in got[("state:41", CURRENT_OPERATIONS)].quality_flags
    assert got[("state:41", REVENUE)].extra["item_flags"]["G90"] == "I"


def test_fips_layout_from_fy2022_has_no_g_item_group_and_flags_equal_items(tmp_path):
    items = {
        "MS": {"A90": 517265, "E90": 517265},
        "VA": {"A90": 1150071, "E90": 917109, "F90": 2625},
        "OR": {"A90": 827830, "E90": 568927, "F90": 8704},
        "UT": {"A90": 496883, "E90": 359276},
    }
    p = unit_zip(tmp_path, 2022, items)
    staged, rejected = _split(parse_unit(_asset(2022), p))
    assert rejected == []
    got = _by(staged)
    no_g = COMPARABILITY + "|no_g_item_from_fy2022"
    assert got[("state:51", CAPITAL_OUTLAY)].comparability_group == no_g
    assert got[("state:51", CAPITAL_OUTLAY)].source_code == "F90"
    assert got[("state:51", EXPENDITURE)].comparability_group == no_g
    assert got[("state:51", EXPENDITURE)].value == (917109 + 2625) * 1000.0
    assert "absent_items_counted_as_zero" not in got[("state:51", EXPENDITURE)].extra  # no G item exists
    assert got[("state:49", EXPENDITURE)].extra["absent_items_counted_as_zero"] == ["F90"]
    assert got[("state:51", REVENUE)].comparability_group == COMPARABILITY
    assert got[("state:51", CURRENT_OPERATIONS)].comparability_group == COMPARABILITY
    assert (
        got[("state:41", EXPENDITURE)].comparability_group
        == COMPARABILITY + "|oregon_unit_files|no_g_item_from_fy2022"
    )
    for m in (REVENUE, CURRENT_OPERATIONS, EXPENDITURE):
        assert "census_expenditure_equals_revenue" in got[("state:28", m)].quality_flags
    assert all(
        "census_expenditure_equals_revenue" not in s.quality_flags for s in staged if s.geo_id != "state:28"
    )


def test_two_character_flag_records_and_a_g_item_after_fy2021(tmp_path):
    st = next(s for s in STATES if s.usps == "UT")
    n = STATES.index(st) + 1
    gid = f"{st.fips}0000{n:06d}"
    p = unit_zip(
        tmp_path,
        2024,
        {},
        extra_unit=[_unit_line(gid, "A90", 493645, 2024, "R ")],
        level2={"UT": {"A90": 493645}},
    )
    staged, rejected = _split(parse_unit(_asset(2024), p))
    assert (
        rejected == [] and _by(staged)[("state:49", REVENUE)].value == 493_645_000.0
    )  # 33 characters accepted
    p = unit_zip(tmp_path, 2023, {"UT": {"A90": 517153, "G90": 5}})
    staged, rejected = _split(parse_unit(_asset(2023), p))
    assert staged == [] and len(rejected) == 1 and "G item" in rejected[0].source_locator + rejected[0].reason


def test_code_system_mix_up_is_caught_by_the_directory_names(tmp_path):
    # An FY2017 file whose IDs use Census codes: only Alabama and Alaska (01, 02 in both systems) still fit.
    p = unit_zip(tmp_path, 2017, {"UT": {"A90": 380544}}, codes="census")
    staged, rejected = _split(parse_unit(_asset(2017), p))
    assert staged == []
    assert sum("directory names" in r.reason for r in rejected) == 48
    # A Fin_PID directory in an FY2016 archive does not fit the year's layout at all.
    p = unit_zip(tmp_path, 2016, {"UT": {"A90": 361199}}, directory_kind="PID")
    staged, rejected = _split(parse_unit(_asset(2016), p))
    assert staged == [] and len(rejected) == 1 and "does not fit FY2016" in rejected[0].reason


def test_a_wrong_name_or_fiscal_year_end_rejects_only_that_state(tmp_path):
    items = {"UT": {"A90": 1}, "ID": {"A90": 2}, "AL": {"A90": 3}}
    p = unit_zip(tmp_path, 2018, items, names={"UT": "UTAH STATE"}, fy_ends={"AL": "0630"})
    staged, rejected = _split(parse_unit(_asset(2018), p))
    assert {s.geo_id for s in staged} == {"state:16"}
    reasons = " ".join(r.reason for r in rejected)
    assert len(rejected) == 2 and "UTAH STATE" in reasons and "fiscal-year end '0630'" in reasons


def test_level_2_disagreement_rejects_that_state(tmp_path):
    items = {"UT": {"A90": 100, "E90": 80}, "ID": {"A90": 50, "E90": 40}}
    level2 = {"UT": {"A90": 100, "E90": 81}, "ID": {"A90": 50, "E90": 40}}
    staged, rejected = _split(parse_unit(_asset(2019), unit_zip(tmp_path, 2019, items, level2=level2)))
    assert {s.geo_id for s in staged} == {"state:16"}
    assert len(rejected) == 1 and rejected[0].geo_id == "state:49" and "level 2" in rejected[0].reason
    # Level 2 lines for a state government with no unit records disagree too.
    staged, rejected = _split(
        parse_unit(
            _asset(2019),
            unit_zip(tmp_path, 2019, {"ID": {"A90": 50}}, level2={"ID": {"A90": 50}, "UT": {"A90": 9}}),
        )
    )
    assert {s.geo_id for s in staged} == {"state:16"} and rejected[0].geo_id == "state:49"


def test_duplicate_negative_or_misdated_records_reject_the_state(tmp_path):
    st = next(s for s in STATES if s.usps == "UT")
    gid = f"{st.fips}0000{STATES.index(st) + 1:06d}"
    cases = [
        _unit_line(gid, "A90", 100, 2020),  # a second A90
        _unit_line(gid, "E90", -5, 2020),
        _unit_line(gid, "E90", 5, 2019),
        _unit_line(gid, "E90", 5, 2020, "?"),
    ]
    for extra in cases:
        p = unit_zip(tmp_path, 2020, {"UT": {"A90": 100}, "ID": {"A90": 50}}, extra_unit=[extra])
        staged, rejected = _split(parse_unit(_asset(2020), p))
        assert {s.geo_id for s in staged} == {"state:16"}, extra
        assert len(rejected) == 1 and rejected[0].geo_id == "state:49", extra


def test_anything_but_50_state_governments_rejects_the_year(tmp_path):
    p = unit_zip(tmp_path, 2021, {"UT": {"A90": 1}}, drop=("WY",))
    staged, rejected = _split(parse_unit(_asset(2021), p))
    assert staged == [] and len(rejected) == 1 and "49 state government records" in rejected[0].reason


# ----- validation checks --------------------------------------------------------------------------------------------


def _check_db(rows):
    con = duckdb.connect()
    con.execute(
        "CREATE TABLE observations (asset_id VARCHAR, source_series VARCHAR, geo_id VARCHAR, measure_id VARCHAR, "
        "period_start DATE, period_end DATE, year INTEGER, value DOUBLE, quality_flags VARCHAR)"
    )
    con.execute("CREATE TABLE geographies (geo_id VARCHAR, name VARCHAR)")
    con.executemany("INSERT INTO geographies VALUES (?, ?)", [(s.geo_id, s.name) for s in STATES])
    con.executemany("INSERT INTO observations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", rows)
    return con


def _obs(asset, geo_id, year, value, measure=REVENUE, flags=None):
    series = "census_govfin_unit" if "unit" in asset else "census_govfin_state_type"
    return (asset, series, geo_id, measure, date(year - 1, 7, 1), date(year, 6, 30), year, value, flags)


def test_fy2015_release_check_lists_differences_and_one_sided_cells():
    a, b = "census_govfin_state_type_fy2015", "census_govfin_unit_fy2015"
    con = _check_db(
        [
            _obs(a, "state:49", 2015, 334_840_000.0),
            _obs(b, "state:49", 2015, 334_840_000.0),
            _obs(a, "state:41", 2015, 544_756_000.0),
            _obs(b, "state:41", 2015, 1_087_630_000.0),
            _obs(b, "state:21", 2015, 5_134_000.0, CURRENT_OPERATIONS),
            _obs(a, "state:01", 2015, 3_675_000.0, CAPITAL_OUTLAY),
        ]
    )
    details, summary = r_govfin_fy2015(con)
    assert len(details) == 3 and "1 cells agree" in summary
    text = "\n".join(details)
    assert (
        "Oregon (state:41) revenue: 2017 release 544,756, 2020 release 1,087,630, difference +542,874" in text
    )
    assert "Kentucky (state:21) current_operations: 2017 release none (no item), 2020 release 5,134" in text
    assert "Alabama (state:01) capital_outlay: 2017 release 3,675, 2020 release none (no item)" in text


def test_repeat_check_lists_carried_forward_values_and_equal_items():
    u = "census_govfin_unit_fy"
    con = _check_db(
        [
            _obs(u + "2015", "state:26", 2015, 1_021_890_000.0),
            _obs(u + "2016", "state:26", 2016, 1_021_890_000.0),
            _obs(u + "2017", "state:26", 2017, 1_082_256_000.0),
            _obs(u + "2019", "state:26", 2019, 1_082_256_000.0),  # equal, but FY2018 is missing: not a repeat
            _obs(u + "2020", "state:28", 2020, 427_617_000.0, flags="census_expenditure_equals_revenue"),
        ]
    )
    details, summary = r_govfin_repeats(con)
    assert details == [
        "repeat: Michigan (state:26) FY2016 revenue 1,021,890 equals FY2015",
        "current operations = revenue: Mississippi (state:28) FY2020, 427,617",
    ]
    assert summary.startswith("1 unit-file cells repeat")


# ----- the real files -----------------------------------------------------------------------------------------------

RAW = paths.ROOT / "data" / "raw"
YEARS = range(2015, 2025)
SIXTEEN = {"AL", "IA", "ID", "ME", "MI", "MS", "MT", "NH", "OH", "OR", "PA", "UT", "VA", "VT", "WV", "WY"}


def _cached(asset_id: str) -> Path | None:
    hits = sorted((RAW / asset_id).glob("*.zip"))
    return hits[0] if hits else None


@pytest.fixture(scope="module")
def real_units():
    if any(_cached(f"census_govfin_unit_fy{y}") is None for y in YEARS):
        pytest.skip("Census unit files not in the raw cache")
    return {y: _split(parse_unit(_asset(y), _cached(f"census_govfin_unit_fy{y}"))) for y in YEARS}


def test_real_unit_files_parse_without_rejections(real_units):
    usps = {s.geo_id: s.usps for s in STATES}
    for y, (staged, rejected) in real_units.items():
        assert rejected == [], (y, rejected[:3])
        assert {usps[s.geo_id] for s in staged if s.measure_id == REVENUE} == SIXTEEN, y
        assert all(s.extra["item_flags"] and set(s.extra["item_flags"].values()) == {"R"} for s in staged), y
        if y >= 2022:
            assert all(s.source_code == "F90" for s in staged if s.measure_id == CAPITAL_OUTLAY), y
    got = _by(real_units[2024][0])
    assert got[("state:49", REVENUE)].value == 493_645_000.0
    flagged = {
        (s.geo_id, y, f)
        for y, (staged, _) in real_units.items()
        for s in staged
        for f in s.quality_flags
        if f.startswith("census_expenditure")
    }
    assert flagged == {("state:21", y, "census_expenditure_without_revenue") for y in (2015, 2016)} | {
        ("state:28", y, "census_expenditure_equals_revenue") for y in range(2020, 2025)
    }


def test_real_fy2015_releases_agree_for_ten_states(real_units):
    p = _cached("census_govfin_state_type_fy2015")
    if p is None:
        pytest.skip("FY2015 state-by-type file not in the raw cache")
    asset = AssetConfig(
        asset_id="census_govfin_state_type_fy2015",
        source_id="census_govfin",
        url=None,
        method="GET",
        edition="test",
        source_series="census_govfin_state_type",
        source_vintage="test",
        format="zip",
        parser="census_state_type_liquor_stores",
        filename="x.zip",
        options={"fiscal_year": 2015},
    )
    old = _by(_split(parse_state_type(asset, p))[0])
    new = _by(real_units[2015][0])
    usps = {s.geo_id: s.usps for s in STATES}
    differ = {usps[g] for g, m in set(old) ^ set(new)} | {
        usps[g] for (g, m) in set(old) & set(new) if old[(g, m)].value != new[(g, m)].value
    }
    assert differ == {"AL", "KY", "NH", "OH", "OR", "VA", "WY"}
    agree = {usps[g] for g, _ in new} - differ
    assert agree == {"IA", "ID", "ME", "MI", "MS", "MT", "PA", "UT", "VT", "WV"}


def test_utah_census_receipts_are_set_beside_dabs_sales_less_the_statutory_deposits():
    from alcohol_data import fiscal_bridge as fb
    from alcohol_data.validation.checks import r_ut_census_dabs

    con = duckdb.connect()
    con.execute(
        "CREATE TABLE observations (observation_id VARCHAR, geo_id VARCHAR, measure_id VARCHAR, year INTEGER, "
        "value DOUBLE, source_locator VARCHAR, period_kind VARCHAR, review_status VARCHAR)"
    )
    con.execute("CREATE TABLE preferred_observations AS SELECT * FROM observations")
    rows = [
        ("ut_dabs_liquor_sales_revenue", 2020, 500212000.0),
        ("ut_dabs_school_lunch_transfer", 2020, 50022000.0),
        ("ut_dabs_sbi_transfer", 2020, 5002000.0),
        ("ut_dabs_liquor_sales_revenue", 2023, 579050000.0),
        ("ut_dabs_school_lunch_transfer", 2023, 57914000.0),
        ("ut_dabs_sbi_transfer", 2023, 5067000.0),
        ("ut_dabs_liquor_sales_revenue", 2025, 551346000.0),  # no Census value: not in this pinned-only check
    ]
    for i, (m, y, v) in enumerate(rows):
        con.execute(
            "INSERT INTO observations VALUES (?, 'state:49', ?, ?, ?, 'p', 'state_fiscal_year', NULL)",
            [f"o{i}", m, y, v],
        )
    for y, v in ((2020, 445208000.0), (2023, 517153000.0)):
        con.execute(
            "INSERT INTO preferred_observations VALUES (?, 'state:49', ?, ?, ?, NULL, 'state_fiscal_year', NULL)",
            [f"c{y}", fb.CENSUS_RECEIPTS, y, v],
        )
    details, summary = r_ut_census_dabs(con)
    assert len(details) == 2
    assert details[0].startswith(
        "FY2020: Census 445,208; statutory deposits 50,021 + 5,002 on sales 500,212 leave 445,189, residual -19"
    )
    assert "reported deposits 50,022 + 5,002 on sales 500,212 leave 445,188, residual -20" in details[0]
    assert (
        summary.startswith("1 of 2 Utah fiscal years reconcile within $0.15 million")
        and "unresolved: FY2023" in summary
    )
    assert "school-meals deposit outside its sales (documented" in summary and "is inferred" in summary
    con.execute("DELETE FROM preferred_observations")
    assert r_ut_census_dabs(con) == (
        [],
        "no fiscal year with both Utah's Census receipts and a DABS liquor sales figure",
    )
