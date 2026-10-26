"""Utah DABS Sales Analysis Report (monthly spreadsheet): gross sales and 9-liter cases by beverage type.

Each report lists every product sold in the month with its DABS class code and class name, gross sales in
dollars ("Total" under "Gross Sales") and sales in 9-liter case equivalents ("Total" under "Case Count (9L)
Sales"). The adapter:

* checks the fiscal period and month printed at the top against the asset configuration;
* groups products into beverage types through metadata/dabs_class_beverage_map.csv (DABS class names and
  department groups; cider and premixed drinks kept apart) and rejects a class code the map does not list;
* requires the products to add up to the report's printed totals (to the cent and to 0.001 case), so a
  layout change cannot silently drop rows;
* yields one value per beverage type and month, plus the printed totals;
* profiles how far gross sales look like shelf price x bottles sold (shelf_price_profile) and keeps the
  profile with the printed gross-sales total, for the validation check of the same name.

Gross sales are as printed. The reports do not say whether they include sales tax. The profile shows they
are statewide shelf prices times bottles, with no store-specific tax folded in or taken out; whether the
shelf prices themselves include sales tax is a separate question that no DABS document found answers
(docs/fiscal-reconciliation.md).
"""

from __future__ import annotations

import calendar
import csv
import re
from datetime import date, datetime
from pathlib import Path

import openpyxl

from alcohol_data import paths
from alcohol_data.adapters.base import Rejected, Staged, register
from alcohol_data.config import AssetConfig

MAP_CSV = paths.METADATA_DIR / "dabs_class_beverage_map.csv"
GROUPS = ("spirits", "wine", "beer", "cider", "premixed", "unclassified", "non_beverage")
UT = "state:49"
PERIOD = re.compile(r"^FY(\d{2}) P(\d{1,2})$")
MONTH_ABBR = {m: i for i, m in enumerate(calendar.month_abbr) if m}
# Products with fewer bottles than this say little: one bottle always divides to a whole number of cents.
SHELF_MIN_BOTTLES = 10


def beverage_map() -> dict[str, str]:
    with open(MAP_CSV, encoding="utf-8", newline="") as f:
        return {r["class_code"]: r["beverage_group"] for r in csv.DictReader(f)}


def _month(v) -> tuple[int, int] | None:
    if isinstance(v, datetime):
        return v.year, v.month
    m = re.fullmatch(r"([A-Z][a-z]{2})\w* (\d{4})", str(v or "").strip())
    if m and m.group(1) in MONTH_ABBR:
        return int(m.group(2)), MONTH_ABBR[m.group(1)]
    return None


def shelf_price_profile(rows: list[list], hi: int, c: int) -> dict | None:
    """How far a report's gross sales look like a statewide shelf price times bottles sold.

    For each product with at least SHELF_MIN_BOTTLES bottles (a whole number), gross sales divided by
    bottles is tested for a whole number of cents. A single shelf price times bottles always passes. A total
    with each store's own local sales tax folded in, or taken out, almost never does (by chance, about one time in
    the number of bottles). A product sold at two prices in the month, for example across a
    price change, fails without contradicting the shelf-price reading, so the share is never expected to be
    one. The bottle column is confirmed against 9-liter cases and bottle size (cases x 9,000 ml = bottles x
    ml, within 0.5% or 4.5 ml). Returns None when the heading row lacks 'Bottle Size' and 'Bottle Count
    Sales' where DABS prints them.
    """
    head = rows[hi]
    if len(head) <= c + 12 or head[c + 2] != "Bottle Size" or head[c + 11] != "Bottle Count Sales":
        return None
    tested = whole = sized = consistent = 0
    dollars = whole_dollars = 0.0
    for r in rows[hi + 1 :]:
        if not r or len(r) <= c + 12 or r[c] is None:
            continue
        sales, bottles, cases = r[c + 7], r[c + 11], r[c + 12]
        if not isinstance(bottles, (int, float)) or isinstance(bottles, bool) or bottles <= 0:
            continue
        try:
            ml = float(r[c + 2])
        except (TypeError, ValueError):
            ml = 0.0
        if ml > 0 and isinstance(cases, (int, float)):
            sized += 1
            if abs(cases * 9000 - bottles * ml) <= max(0.005 * bottles * ml, 4.5):
                consistent += 1
        if bottles < SHELF_MIN_BOTTLES or not float(bottles).is_integer():
            continue
        if not isinstance(sales, (int, float)) or sales <= 0:
            continue
        tested += 1
        dollars += sales
        if round(sales * 100) % int(bottles) == 0:
            whole += 1
            whole_dollars += sales
    return {
        "min_bottles": SHELF_MIN_BOTTLES,
        "products_tested": tested,
        "whole_cent_unit_price": whole,
        "gross_sales_tested": round(dollars, 2),
        "gross_sales_whole_cent": round(whole_dollars, 2),
        "products_with_size": sized,
        "bottles_match_cases": consistent,
    }


@register("dabs_sales_analysis", "1.1")
def parse(asset: AssetConfig, path: Path):
    want_fy, want_p = int(asset.options["fiscal_year"]), int(asset.options["period"])
    want_y, want_m = (int(x) for x in str(asset.options["month"]).split("-"))
    ws = openpyxl.load_workbook(path, read_only=True, data_only=True).worksheets[0]
    rows = [list(r) for r in ws.iter_rows(values_only=True)]
    try:
        hi = next(i for i, r in enumerate(rows) if "Class Code" in r)
    except StopIteration:
        yield Rejected(path.name, "no 'Class Code' heading row")
        return
    c = rows[hi].index("Class Code")
    if (
        rows[hi][c : c + 2] != ["Class Code", "Class Name"]
        or rows[hi][c + 7] != "Total"
        or rows[hi][c + 12] != "Total"
    ):
        yield Rejected(path.name, f"unexpected heading row {rows[hi]}")
        return
    top = [v for r in rows[:hi] for v in r if v is not None]
    fp = next((PERIOD.match(str(v).strip()) for v in top if PERIOD.match(str(v).strip())), None)
    month = next((_month(v) for v in top if _month(v)), None)
    numbers = [v for v in top if isinstance(v, (int, float)) and not isinstance(v, bool)]
    if fp is None or (2000 + int(fp.group(1)), int(fp.group(2))) != (want_fy, want_p):
        yield Rejected(
            path.name, f"report period {fp.group(0) if fp else None!r}, expected FY{want_fy % 100} P{want_p}"
        )
        return
    if month != (want_y, want_m):
        yield Rejected(path.name, f"report month {month}, expected {want_y}-{want_m:02d}")
        return
    if len(numbers) != 2:
        yield Rejected(path.name, f"expected two printed totals above the table, found {numbers}")
        return
    printed_sales, printed_cases = float(numbers[0]), float(numbers[1])
    groups = beverage_map()
    sales = dict.fromkeys(GROUPS, 0.0)
    cases = dict.fromkeys(GROUPS, 0.0)
    products = dict.fromkeys(GROUPS, 0)
    for i, r in enumerate(rows[hi + 1 :], start=hi + 2):
        if not r or all(v is None for v in r):
            continue
        code = str(r[c]).strip() if r[c] is not None else ""
        if code not in groups:
            yield Rejected(
                f"{path.name} row {i}", f"class code {code!r} ({r[c + 1]!r}) is not in {MAP_CSV.name}"
            )
            return
        g = groups[code]
        sales[g] += float(r[c + 7] or 0)
        cases[g] += float(r[c + 12] or 0)
        products[g] += 1
    if abs(sum(sales.values()) - printed_sales) > 0.005 or abs(sum(cases.values()) - printed_cases) > 0.001:
        yield Rejected(
            path.name,
            f"products add up to {sum(sales.values()):.2f} dollars and {sum(cases.values()):.3f} cases; "
            f"the report prints {printed_sales:.2f} and {printed_cases:.3f}",
        )
        return
    start = date(want_y, want_m, 1)
    end = date(want_y, want_m, calendar.monthrange(want_y, want_m)[1])
    label = f"{want_y}-{want_m:02d}"
    common = dict(
        geo_id=UT,
        period_start=start,
        period_end=end,
        period_kind="month",
        period_label=label,
        year=want_y,
        estimate_type="administrative_amount",
        extraction_method="spreadsheet_parser",
        multiplier=1.0,
        extra={"dabs_fiscal_period": fp.group(0)},
    )
    for g in GROUPS:
        if g in ("unclassified", "non_beverage"):
            continue
        yield Staged(
            measure_id=f"ut_dabs_monthly_gross_sales_{g}",
            value=round(sales[g], 2),
            raw_value=f"{sales[g]:.2f}",
            raw_unit="dollars",
            comparability_group=f"utah_dabs_sales_analysis|gross_sales|{g}",
            source_locator=f"{path.name}: sum of 'Gross Sales Total' over {products[g]} products in {g} classes",
            **common,
        )
        yield Staged(
            measure_id=f"ut_dabs_monthly_cases_9l_{g}",
            value=round(cases[g], 4),
            raw_value=f"{cases[g]:.4f}",
            raw_unit="9-liter cases",
            comparability_group=f"utah_dabs_sales_analysis|cases_9l|{g}",
            source_locator=f"{path.name}: sum of 'Case Count (9L) Sales Total' over {products[g]} products in {g} classes",
            **common,
        )
    other_sales = sales["unclassified"] + sales["non_beverage"]
    other_cases = cases["unclassified"] + cases["non_beverage"]
    yield Staged(
        measure_id="ut_dabs_monthly_gross_sales_other",
        value=round(other_sales, 2),
        raw_value=f"{other_sales:.2f}",
        raw_unit="dollars",
        comparability_group="utah_dabs_sales_analysis|gross_sales|other",
        source_locator=f"{path.name}: special orders with no beverage stated and supplies ({products['unclassified'] + products['non_beverage']} products)",
        **common,
    )
    yield Staged(
        measure_id="ut_dabs_monthly_cases_9l_other",
        value=round(other_cases, 4),
        raw_value=f"{other_cases:.4f}",
        raw_unit="9-liter cases",
        comparability_group="utah_dabs_sales_analysis|cases_9l|other",
        source_locator=f"{path.name}: special orders with no beverage stated and supplies",
        **common,
    )
    profile = shelf_price_profile(rows, hi, c)
    total_common = (
        {**common, "extra": {**common["extra"], "shelf_price_profile": profile}} if profile else common
    )
    yield Staged(
        measure_id="ut_dabs_monthly_gross_sales_total",
        value=printed_sales,
        raw_value=f"{printed_sales:.2f}",
        raw_unit="dollars",
        comparability_group="utah_dabs_sales_analysis|gross_sales|total",
        source_locator=f"{path.name}: printed 'Gross Sales' total above the table",
        **total_common,
    )
    yield Staged(
        measure_id="ut_dabs_monthly_cases_9l_total",
        value=printed_cases,
        raw_value=f"{printed_cases:.4f}",
        raw_unit="9-liter cases",
        comparability_group="utah_dabs_sales_analysis|cases_9l|total",
        source_locator=f"{path.name}: printed 'Case Count (9L) Sales' total above the table",
        **common,
    )
