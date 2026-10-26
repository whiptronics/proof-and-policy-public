"""Census retail sources: Monthly State Retail Sales (year-over-year changes) and the Economic Census
(NAICS 445310 by state). Suppressed, blank and withheld cells are never zero."""

from __future__ import annotations

import zipfile
from pathlib import Path

from alcohol_data.adapters.base import Rejected, Staged
from alcohol_data.adapters.census_econ import parse_basic, parse_comp
from alcohol_data.adapters.census_msrs import parse as parse_msrs
from alcohol_data.config import AssetConfig


def _asset(parser: str, fmt: str = "csv") -> AssetConfig:
    return AssetConfig("t", "s", None, "manual_import", "e", "s", "v", fmt, parser, "f")


# ----- MSRS ---------------------------------------------------------------------------------------

MSRS = [
    "fips,stateabbr,naics,yy202605,yy202606",
    "00,USA,TOTAL,4.1,7.4",
    "49,UT,TOTAL,6.0,7.5",
    "02,AK,TOTAL,-3.0,-7.6",
    "56,WY,445,S,",
    "49,UT,452,9.9,9.9",
]


def _msrs(tmp_path: Path, lines=MSRS) -> Path:
    p = tmp_path / "state_retail_yy.csv"
    p.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return p


def test_msrs_reads_two_series_by_month_and_keeps_s_and_blank_apart(tmp_path):
    items = list(parse_msrs(_asset("census_msrs_yy"), _msrs(tmp_path)))
    assert not [i for i in items if isinstance(i, Rejected)]
    got = {(s.geo_id, s.measure_id, s.period_label): s for s in items if isinstance(s, Staged)}
    assert got[("state:49", "msrs_total_retail_yoy_pct", "2026-06")].value == 7.5
    assert (
        got[("state:02", "msrs_total_retail_yoy_pct", "2026-06")].value == -7.6
    )  # a fall is negative, not missing
    assert got[("nation:us", "msrs_total_retail_yoy_pct", "2026-06")].value == 7.4
    s = got[("state:56", "msrs_food_beverage_stores_yoy_pct", "2026-05")]
    assert (s.value, s.missing_reason, s.suppression_flag) == (None, "suppressed", "S")
    b = got[("state:56", "msrs_food_beverage_stores_yoy_pct", "2026-06")]
    assert (b.value, b.missing_reason) == (None, "not_published")
    assert not any(m == "452" or "452" in m for _, m, _ in got)  # other subsectors are not read
    assert (
        "experimental_data_product" in got[("state:49", "msrs_total_retail_yoy_pct", "2026-06")].quality_flags
    )


def test_msrs_rejects_a_mismatched_state_and_a_repeated_row(tmp_path):
    items = list(
        parse_msrs(_asset("census_msrs_yy"), _msrs(tmp_path, [*MSRS, "49,ID,TOTAL,1,1", "49,UT,TOTAL,1,1"]))
    )
    rejected = [i for i in items if isinstance(i, Rejected)]
    assert len(rejected) == 2


# ----- Economic Census ----------------------------------------------------------------------------

BASIC_HEAD = "GEOTYPE|ST|GEOCOMP|GEO_TTL|NAICS2017|TYPOP|TAXSTAT|YEAR|ESTAB|ESTAB_F|RCPTOT|RCPTOT_F"
BASIC = [
    "01|00|00|United States|445310|00|00|2017|35000||60000000|",
    "02|42|00|Pennsylvania|445310|00|00|2017|1869||3352946|",
    "02|49|00|Utah|445310|00|00|2017|0|D|0|D",
    "02|42|01|Pennsylvania (metro)|445310|00|00|2017|1500||3000000|",
    "02|42|00|Pennsylvania|445310|10|00|2017|1|||",
    "02|42|00|Pennsylvania|445110|00|00|2017|9999||9999|",
]


def _ec(tmp_path: Path, member: str, head: str, rows) -> Path:
    p = tmp_path / "EC.zip"
    with zipfile.ZipFile(p, "w") as z:
        z.writestr(member, "\r\n".join([head, *rows]) + "\r\n")
    return p


def test_economic_census_reads_whole_states_and_never_turns_a_withheld_zero_into_a_value(tmp_path):
    items = list(
        parse_basic(_asset("census_ec2017_basic", "zip"), _ec(tmp_path, "EC1700BASIC.dat", BASIC_HEAD, BASIC))
    )
    assert not [i for i in items if isinstance(i, Rejected)]
    got = {(s.geo_id, s.measure_id): s for s in items if isinstance(s, Staged)}
    assert set(got) == {
        (g, m)
        for g in ("nation:us", "state:42", "state:49")
        for m in ("ec_establishments_naics_445310", "ec_sales_naics_445310")
    }
    assert got[("state:42", "ec_sales_naics_445310")].value == 3_352_946_000.0  # $1,000s
    assert got[("state:42", "ec_establishments_naics_445310")].value == 1869
    ut = got[("state:49", "ec_sales_naics_445310")]
    assert (ut.value, ut.missing_reason, ut.suppression_flag, ut.raw_value) == (None, "suppressed", "D", "0")


def test_economic_census_comparative_file_reads_2012_and_2017(tmp_path):
    head = "GEOTYPE|ST|GEO_TTL|NAICS2012|YEAR|ESTAB|ESTAB_F|RCPTOT|RCPTOT_F"
    rows = [
        "02|42|Pennsylvania|445310|2012|1900||2987219|",
        "02|42|Pennsylvania|445310|2017|1869||3352946|",
        "02|42|Pennsylvania|445310|2007|1|||",
    ]
    items = list(parse_comp(_asset("census_ec2017_comp", "zip"), _ec(tmp_path, "EC1700COMP.dat", head, rows)))
    staged = {(s.year, s.measure_id): s.value for s in items if isinstance(s, Staged)}
    assert staged[(2012, "ec_sales_naics_445310")] == 2_987_219_000.0
    assert staged[(2017, "ec_sales_naics_445310")] == 3_352_946_000.0
    assert sum(isinstance(i, Rejected) for i in items) == 1  # 2007 is not in this file's design
