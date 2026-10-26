"""Census national gross margins (ARTS gmper.xlsx, AWTS table 4): rows read by NAICS code and checked against their
labels; "S", "x" and "NA" are never zero; the grocery-wine comparison's 28.0% and 29.5% references are these cells."""

from __future__ import annotations

import csv
from pathlib import Path

import openpyxl
import pytest

from alcohol_data import paths
from alcohol_data.adapters.base import Rejected, Staged
from alcohol_data.adapters.census_trade_margins import parse_arts, parse_awts
from alcohol_data.config import AssetConfig

RAW = paths.ROOT / "data" / "raw"  # the checkout's cache; tests run with a temporary ALCOHOL_DATA_HOME
DOTS = " ���...��"


def _asset(series: str, parser: str) -> AssetConfig:
    return AssetConfig(
        "t", "census_trade_margins", None, "manual_import", "e", series, "v", "xlsx", parser, "f"
    )


def _xlsx(tmp_path: Path, name: str, title: str, rows: list[list]) -> Path:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = title
    for r in rows:
        ws.append(r)
    p = tmp_path / name
    wb.save(p)
    return p


def _split(items):
    items = list(items)
    return [i for i in items if isinstance(i, Staged)], [i for i in items if isinstance(i, Rejected)]


ARTS_ROWS = [
    ["Table with row headers in column B and NAICS codes in column A"],
    ["Estimated Annual Gross Margin as a Percentage of Sales of U.S. Retail Firms by Kind of Business"],
    ["[Estimates are shown as percentages]"],
    ["NAICS Code", "Kind of business", "2022r", "2021r", 2017],
    [None, "Retail gross margin as a percentage of sales, total" + DOTS, 31.1, 30.6, 29.5],
    [
        None,
        "Retail gross margin as a percentage of sales, total (excl. motor vehicle and parts dealers)" + DOTS,
        32.9,
        33.8,
        32.1,
    ],
    [441, "   Motor vehicle and parts dealers" + DOTS, 24.8, 20.3, 20.8],
    [445, "   Food and beverage stores" + DOTS, 28.7, 28.1, 27.6],
    [4451, "   Grocery stores" + DOTS, 28, 27.3, "S"],
    [4453, "   Beer, wine, and liquor stores" + DOTS, 31.1, 30.7, None],
    [452311, "   Warehouse clubs and supercenters" + DOTS, 24.3, 24.8, 24.7],
    ["S - Estimate does not meet publication standards"],
]


def test_arts_reads_the_five_rows_by_naics_with_cell_references(tmp_path):
    p = _xlsx(tmp_path, "gmper.xlsx", "Gross Margin as % of Sales", ARTS_ROWS)
    staged, rejected = _split(parse_arts(_asset("census_arts_gmper", "census_arts_gmper"), p))
    assert rejected == []
    got = {(s.measure_id, s.year): s for s in staged}
    assert (
        len(got) == 15
    )  # five rows, three years; the "excl. motor vehicle" total and NAICS 441 are not read
    g = got[("us_retail_gross_margin_pct_grocery_stores", 2022)]
    assert g.value == 28.0 and g.geo_id == "nation:us" and g.period_kind == "calendar_year"
    assert str(g.period_start) == "2022-01-01" and str(g.period_end) == "2022-12-31"
    assert "cell C9" in g.source_locator and "NAICS 4451" in g.source_locator
    assert g.quality_flags == ["revised"] and g.extraction_method == "spreadsheet_parser"
    assert got[("us_retail_gross_margin_pct_grocery_stores", 2017)].quality_flags == []
    assert (
        got[("us_retail_gross_margin_pct_total", 2022)].value == 31.1
    )  # the all-retail total, not the excl. row
    s = got[("us_retail_gross_margin_pct_grocery_stores", 2017)]
    assert s.value is None and s.missing_reason == "suppressed" and s.suppression_flag == "S"
    b = got[("us_retail_gross_margin_pct_alcohol_stores", 2017)]
    assert b.value is None and b.missing_reason == "not_published"
    assert "Grocery stores" in g.source_code and DOTS.strip() not in g.source_code


def test_arts_rejects_a_relabelled_or_missing_row_instead_of_misreading_it(tmp_path):
    rows = [r[:] for r in ARTS_ROWS]
    rows[8][1] = "   Supermarkets and other grocery (except convenience) stores"
    del rows[10]  # warehouse clubs
    staged, rejected = _split(
        parse_arts(_asset("census_arts_gmper", "census_arts_gmper"), _xlsx(tmp_path, "g.xlsx", "x", rows))
    )
    reasons = " | ".join(r.reason for r in rejected)
    assert "NAICS 4451" in reasons and "NAICS 452311" in reasons
    assert not [
        s
        for s in staged
        if s.measure_id
        in (
            "us_retail_gross_margin_pct_grocery_stores",
            "us_retail_gross_margin_pct_warehouse_clubs_supercenters",
        )
    ]


OP = "Merchant Wholesalers, except manufacturers' sales branches and offices"
AWTS_ROWS = [
    ["Table 4. Estimated Annual Purchases, Gross Margins, and Gross Margins as a Percent of Sales"],
    [None],
    ["[Purchases and gross margins estimates are shown in millions of dollars]"],
    ["2017 NAICS Code", "Data Item", "Kind of Business ", "Type of Operation ", "2022r", "2021r", 1992],
    [None],
    ["4248", "Gross margins", "Beer, Wine, and Distilled Alcoholic Beverages", OP, 54635, 54474, "x"],
    ["42", "Gross margins as a percent of sales", "Wholesale Trade", OP, 20.3, 20.9, "x"],
    ["4244", "Gross margins as a percent of sales", "Grocery and Related Products", OP, 16.2, "S", "x"],
    [
        "4248",
        "Gross margins as a percent of sales",
        "Beer, Wine, and Distilled Alcoholic Beverages",
        OP,
        29.5,
        "NA",
        "x",
    ],
    ["4249", "Gross margins as a percent of sales", "Miscellaneous Nondurable Goods", OP, 19.5, 20.3, "x"],
    ["Notes:"],
]


def test_awts_reads_percent_rows_only_and_keeps_x_s_and_na_apart_from_zero(tmp_path):
    p = _xlsx(tmp_path, "t4.xlsx", "Sheet1", AWTS_ROWS)
    staged, rejected = _split(parse_awts(_asset("census_awts_table4", "census_awts_table4"), p))
    assert rejected == []
    got = {(s.measure_id, s.year): s for s in staged}
    assert (
        len(got) == 9
    )  # three rows, three years; the dollar "Gross margins" row and NAICS 4249 are not read
    w = got[("us_wholesale_gross_margin_pct_alcohol_beverages", 2022)]
    assert w.value == 29.5 and "cell E9" in w.source_locator and w.quality_flags == ["revised"]
    x = got[("us_wholesale_gross_margin_pct_alcohol_beverages", 1992)]
    assert x.value is None and x.missing_reason == "unavailable" and "prior year inventories" in x.footnote
    na = got[("us_wholesale_gross_margin_pct_alcohol_beverages", 2021)]
    assert na.value is None and na.missing_reason == "unavailable"
    s = got[("us_wholesale_gross_margin_pct_grocery", 2021)]
    assert s.value is None and s.missing_reason == "suppressed"


def test_awts_rejects_another_type_of_operation(tmp_path):
    rows = [r[:] for r in AWTS_ROWS]
    rows[8][3] = "Manufacturers' sales branches and offices"
    staged, rejected = _split(
        parse_awts(
            _asset("census_awts_table4", "census_awts_table4"), _xlsx(tmp_path, "t.xlsx", "Sheet1", rows)
        )
    )
    assert any("NAICS 4248" in r.reason for r in rejected)
    assert not [s for s in staged if s.measure_id == "us_wholesale_gross_margin_pct_alcohol_beverages"]


def _cached(asset_id: str) -> Path | None:
    hits = sorted((RAW / asset_id).glob("*.xlsx"))
    return hits[0] if hits else None


ARTS_REAL, AWTS_REAL = _cached("census_arts_gmper_2022"), _cached("census_awts_table4_2022")


@pytest.mark.skipif(
    ARTS_REAL is None or AWTS_REAL is None, reason="Census margin workbooks not in the raw cache"
)
def test_real_workbooks_read_whole_with_the_cells_the_comparison_cites():
    a_st, a_rj = _split(parse_arts(_asset("census_arts_gmper", "census_arts_gmper"), ARTS_REAL))
    w_st, w_rj = _split(parse_awts(_asset("census_awts_table4", "census_awts_table4"), AWTS_REAL))
    assert a_rj == [] and w_rj == []
    assert len(a_st) == 5 * 30 and len(w_st) == 3 * 31  # 1993-2022 retail; 1992-2022 wholesale
    a = {(s.measure_id, s.year): s for s in a_st}
    w = {(s.measure_id, s.year): s for s in w_st}
    g = a[("us_retail_gross_margin_pct_grocery_stores", 2022)]
    assert g.value == 28.0 and "cell C16" in g.source_locator
    assert a[("us_retail_gross_margin_pct_alcohol_stores", 2022)].value == 31.1
    b = w[("us_wholesale_gross_margin_pct_alcohol_beverages", 2022)]
    assert b.value == 29.5 and "cell E73" in b.source_locator
    # The 2022revised table (2022 Economic Census), not the earlier 2022 one, which printed 28.4 for 2020.
    assert w[("us_wholesale_gross_margin_pct_alcohol_beverages", 2020)].value == 28.3
    y1992 = [s for (_, y), s in w.items() if y == 1992]
    assert len(y1992) == 3 and all(s.value is None and s.missing_reason == "unavailable" for s in y1992)


GW_ASSUMPTIONS = paths.ROOT / "data" / "processed" / "grocery-wine" / "assumptions.csv"


@pytest.mark.skipif(
    ARTS_REAL is None or AWTS_REAL is None or not GW_ASSUMPTIONS.exists(),
    reason="workbooks or grocery-wine export missing",
)
def test_grocery_wine_margin_references_are_these_cells():
    with open(GW_ASSUMPTIONS, encoding="utf-8", newline="") as f:
        u = {r["assumption_id"]: r for r in csv.DictReader(f)}
    a = {
        (s.measure_id, s.year): s
        for s in _split(parse_arts(_asset("census_arts_gmper", "census_arts_gmper"), ARTS_REAL))[0]
    }
    w = {
        (s.measure_id, s.year): s
        for s in _split(parse_awts(_asset("census_awts_table4", "census_awts_table4"), AWTS_REAL))[0]
    }
    assert u["U12"]["value"] == f"{a[('us_retail_gross_margin_pct_grocery_stores', 2022)].value:.1f}%"
    assert u["U13"]["value"] == f"{w[('us_wholesale_gross_margin_pct_alcohol_beverages', 2022)].value:.1f}%"
