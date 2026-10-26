"""Census liquor store items: the IndFin historical database and the yearly state-by-type files.

The synthetic archives reproduce each file's layout in a few records. Tests on the real files run when the
checkout's raw cache holds them.
"""

from __future__ import annotations

import csv
import zipfile
from datetime import date
from pathlib import Path

import duckdb
import pytest

from alcohol_data import paths
from alcohol_data.adapters.base import Rejected, Staged
from alcohol_data.adapters.census_govfin import (
    CAPITAL_OUTLAY,
    CURRENT_OPERATIONS,
    EXPENDITURE,
    REVENUE,
    parse_indfin,
    parse_state_type,
)
from alcohol_data.config import AssetConfig
from alcohol_data.validation.checks import r_govfin

A_HEAD = (
    "SortCode,SurveyYr,Year4,ID,State Code,Type Code,Name,FIPS Code-State,FYEndDate,YearofData,Version,"
    "ReviseDate,Data_Flag,Imputed Record,Liquor Stores Revenue"
)
C_HEAD = "SortCode,Year4,ID,Liquor Stores-Tot Exp,Liquor Stores-Cap Out"


def _a(yy, year, cid, typ, name, fips, fy_end, yod, revenue):
    return f'1,{yy},{year},"{cid}","{cid[:2]}","{typ}","{name}","{fips}","{fy_end}","{yod}","A"," ","Z","0",{revenue}'


def _c(year, cid, total, capital):
    return f'1,{year},"{cid}",{total},{capital}'


def _asset(asset_id="census_govfin_indfin_test", **options) -> AssetConfig:
    return AssetConfig(
        asset_id=asset_id,
        source_id="census_govfin",
        url=None,
        method="GET",
        edition="test",
        source_series="census_govfin_indfin",
        source_vintage="test",
        format="zip",
        parser="census_indfin_state_liquor_stores",
        filename="test.zip",
        options=options,
    )


def _indfin_zip(tmp_path: Path, mi_fy_2012="930") -> Path:
    files = {
        # FY1972, a census year: Michigan's fiscal year still ended June 30.
        "IndFin72a.Txt": [
            A_HEAD,
            _a(72, 1972, "230000000", "0", "MICHIGAN STATE GOVT", "26", "630", "72", 95000),
            _a(72, 1972, "450000000", "0", "UTAH STATE GOVT", "49", "630", "72", 28341),
            _a(72, 1972, "451018018", "1", "SALT LAKE COUNTY", "49", "1231", "72", 5),
        ],
        "IndFin72c.Txt": [C_HEAD, _c(1972, "230000000", 80000, 100), _c(1972, "450000000", 19622, 34)],
        # FY1973: no state government records at all (documented), so nothing is emitted or rejected.
        "IndFin73a.Txt": [A_HEAD, _a(73, 1973, "451018018", "1", "SALT LAKE COUNTY", "49", "1231", "73", 0)],
        "IndFin73c.Txt": [C_HEAD, _c(1973, "451018018", 0, 0)],
        "IndFin12a.Txt": [
            A_HEAD,
            _a(12, 2012, "230000000", "0", "MICHIGAN STATE GOVT", "26", mi_fy_2012, "12R", 180000),
            _a(12, 2012, "450000000", "0", "UTAH STATE GOVT", "49", "0630", "12R", 269638),
        ],
        "IndFin12c.Txt": [C_HEAD, _c(2012, "230000000", 150000, 0), _c(2012, "450000000", 194918, 0)],
        "_ReadMe_First_IndFin.txt": ["not data"],
    }
    p = tmp_path / "indfin.zip"
    with zipfile.ZipFile(p, "w") as z:
        for name, lines in files.items():
            z.writestr(name, "\r\n".join(lines) + "\r\n")
    return p


def _split(items):
    items = list(items)  # adapters are generators; read them once
    assert items, "the adapter yielded nothing"
    staged = [i for i in items if isinstance(i, Staged)]
    rejected = [i for i in items if isinstance(i, Rejected)]
    return staged, rejected


def test_indfin_reads_state_governments_only_with_census_formula_flagged(tmp_path):
    staged, rejected = _split(parse_indfin(_asset(expected_state_records=2), _indfin_zip(tmp_path)))
    assert rejected == []
    assert {s.geo_id for s in staged} == {"state:26", "state:49"}  # the county record is not read
    assert {s.year for s in staged} == {1972, 2012}
    ut = {(s.year, s.measure_id): s for s in staged if s.geo_id == "state:49"}
    assert ut[(2012, REVENUE)].value == 269_638_000.0
    ops = ut[(1972, CURRENT_OPERATIONS)]
    assert ops.value == (19622 - 34) * 1000.0 and ops.raw_value == "19622-34"
    assert "census_formula" in ops.quality_flags and "formula" in ops.extra
    for m in (REVENUE, EXPENDITURE, CAPITAL_OUTLAY):
        assert "census_formula" not in ut[(2012, m)].quality_flags  # printed, not computed
    assert ut[(2012, EXPENDITURE)].extra["year_of_data"] == "12R"


def test_indfin_fiscal_year_comes_from_the_record_and_is_checked_from_1985(tmp_path):
    staged, _ = _split(parse_indfin(_asset(expected_state_records=2), _indfin_zip(tmp_path)))
    mi = {s.year: s for s in staged if s.geo_id == "state:26" and s.measure_id == REVENUE}
    assert mi[1972].period_end == date(1972, 6, 30)
    assert "fiscal_year_end_from_census_record" in mi[1972].quality_flags
    assert (mi[2012].period_start, mi[2012].period_end) == (date(2011, 10, 1), date(2012, 9, 30))
    # A record whose fiscal year contradicts metadata/fiscal_years.csv is rejected, not re-dated.
    staged, rejected = _split(parse_indfin(_asset(expected_state_records=2), _indfin_zip(tmp_path, "0630")))
    assert not any(s.geo_id == "state:26" and s.year == 2012 for s in staged)
    assert any("fiscal_years.csv" in r.reason for r in rejected)


def test_indfin_wrong_state_count_or_missing_state_year_is_rejected(tmp_path):
    _, rejected = _split(parse_indfin(_asset(), _indfin_zip(tmp_path)))  # expects 50 states
    assert len(rejected) == 2 and all("expected 50" in r.reason for r in rejected)
    p = tmp_path / "gap.zip"
    with zipfile.ZipFile(p, "w") as z:
        z.writestr("IndFin80a.Txt", A_HEAD + "\r\n")
        z.writestr("IndFin80c.Txt", C_HEAD + "\r\n")
    _, rejected = _split(parse_indfin(_asset(), p))
    assert len(rejected) == 1 and "FY1980 should have them" in rejected[0].reason


def _state_type_zip(tmp_path: Path, lines: list[str], year="12") -> Path:
    p = tmp_path / f"{year}statetypepu.zip"
    with zipfile.ZipFile(p, "w") as z:
        z.writestr(f"{year}statetypepu.txt", "\n".join(lines) + "\n")
    return p


ST_LINES = [
    "002 A90      7114248        0.00 12",  # U.S. total of state governments: skipped
    "012 A90       267388        0.00 12",
    "012 E90       248133        0.00 12",
    "012 G90          734        0.00 12",
    "092 A90            0        0.00 12",  # DC's type 2 zeros (FY2008 layout): skipped
    "451 A90       269638        0.00 12",  # type 1 = state and local: not read
    "452 A90       269638        0.00 12",
    "452 E90       194918        0.00 12",
    "452 T10        45823        0.00 12",
    "021 A90         5762             12",
]


def test_state_type_reads_type_2_and_sums_only_printed_items(tmp_path):
    asset = _asset("census_govfin_state_type_test", fiscal_year=2012)
    staged, rejected = _split(parse_state_type(asset, _state_type_zip(tmp_path, ST_LINES)))
    assert rejected == []
    got = {(s.geo_id, s.measure_id): s for s in staged}
    assert set(got) == {
        ("state:01", REVENUE),
        ("state:01", CURRENT_OPERATIONS),
        ("state:01", CAPITAL_OUTLAY),
        ("state:01", EXPENDITURE),
        ("state:49", REVENUE),
        ("state:49", CURRENT_OPERATIONS),
        ("state:49", EXPENDITURE),
    }
    assert got[("state:49", REVENUE)].value == 269_638_000.0  # type 2, not the type 1 line
    al_total = got[("state:01", EXPENDITURE)]
    assert al_total.value == (248133 + 734) * 1000.0 and "census_formula" in al_total.quality_flags
    assert "census_formula" not in got[("state:01", CURRENT_OPERATIONS)].quality_flags
    assert got[("state:01", REVENUE)].period_end == date(2012, 9, 30)  # Alabama's fiscal year


def test_state_type_rejects_unreadable_liquor_lines(tmp_path):
    asset = _asset("census_govfin_state_type_test", fiscal_year=2012)
    lines = [*ST_LINES, "132 A90          abc        0.00 12", "162 E90         1000        0.00 13"]
    staged, rejected = _split(parse_state_type(asset, _state_type_zip(tmp_path, lines)))
    assert len(rejected) == 2
    assert not any(s.geo_id in ("state:16", "state:19") for s in staged)


def _obs_db(rows):
    con = duckdb.connect()
    con.execute(
        "CREATE TABLE observations (source_series VARCHAR, geo_id VARCHAR, measure_id VARCHAR, "
        "period_start DATE, period_end DATE, value DOUBLE)"
    )
    con.executemany("INSERT INTO observations VALUES (?, ?, ?, ?, ?, ?)", rows)
    return con


def _row(series, geo, year, value, measure=REVENUE):
    return (series, geo, measure, date(year - 1, 7, 1), date(year, 6, 30), value)


def test_reconciliation_check_counts_disagreements_and_missing_lines():
    i, s = "census_govfin_indfin", "census_govfin_state_type"
    agree = [
        _row(i, "state:49", 2012, 5.0),
        _row(s, "state:49", 2012, 5.0),
        _row(i, "state:06", 2012, 0.0),  # IndFin zero, no state-by-type line: agrees
        _row(s, "state:49", 2013, 7.0),  # state-by-type only, after IndFin ends: not compared
    ]
    details, summary = r_govfin(_obs_db(agree))
    assert details == [] and "1 cells present in both" in summary
    details, _ = r_govfin(
        _obs_db([*agree[:3], _row(s, "state:49", 2013, 7.0), _row(i, "state:30", 2012, 9.0)])
    )
    assert len(details) == 1 and "state:30" in details[0]  # IndFin non-zero with no state-by-type line
    details, _ = r_govfin(_obs_db([_row(i, "state:49", 2012, 5.0), _row(s, "state:49", 2012, 6.0)]))
    assert len(details) == 1


def test_no_policy_record_rests_on_census_liquor_store_values():
    """A retail system is coded from law, never from whether a liquor store value exists."""
    curated = paths.ROOT / "data" / "curated"
    for name in ("policy_events.csv", "policy_evidence.csv", "policy_snapshots.csv"):
        text = (curated / name).read_text(encoding="utf-8")
        assert "census_govfin" not in text and "census_liquor_stores" not in text, name
    with open(paths.METADATA_DIR / "measures.csv", encoding="utf-8", newline="") as f:
        defs = {r["measure_id"]: r["definition"] for r in csv.DictReader(f)}
    for m in (REVENUE, EXPENDITURE, CURRENT_OPERATIONS, CAPITAL_OUTLAY):
        assert "never codes the retail system" in defs[m]


RAW = paths.ROOT / "data" / "raw"  # the checkout's cache; tests run with a temporary ALCOHOL_DATA_HOME


def _cached(asset_id: str) -> Path | None:
    hits = sorted((RAW / asset_id).glob("*.zip"))
    return hits[0] if hits else None


@pytest.mark.skipif(_cached("census_govfin_indfin_1967_2012") is None, reason="IndFin not in the raw cache")
def test_real_indfin_and_state_type_files_agree():
    staged, rejected = _split(
        parse_indfin(_asset("census_govfin_indfin_1967_2012"), _cached("census_govfin_indfin_1967_2012"))
    )
    assert rejected == []
    assert {s.year for s in staged} == {1972, *range(1977, 2013)}
    revenue = {(s.geo_id, s.year): s.value for s in staged if s.measure_id == REVENUE}
    assert revenue[("state:49", 2012)] == 269_638_000.0
    assert len({g for (g, y), v in revenue.items() if v > 0}) == 17
    indfin = {(s.geo_id, s.year, s.measure_id): s.value for s in staged}
    compared = 0
    for fy in range(2008, 2013):
        asset_id = f"census_govfin_state_type_fy{fy}"
        if _cached(asset_id) is None:
            continue
        st, rej = _split(parse_state_type(_asset(asset_id, fiscal_year=fy), _cached(asset_id)))
        assert rej == []
        for s in st:
            assert indfin[(s.geo_id, s.year, s.measure_id)] == s.value, (s.geo_id, s.year, s.measure_id)
            compared += 1
    assert compared > 0
