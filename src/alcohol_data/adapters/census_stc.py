"""Census Bureau Annual Survey of State Government Tax Collections (STC).

Amounts are state-government tax collections in thousands of current dollars,
for each state's own fiscal year. Census classification (Government Finance and
Employment Classification Manual): T10 "Alcoholic Beverages Sales Tax" is taxes
on the sale of alcoholic beverages whether collected through government-operated
liquor stores or private outlets; T20 "Alcoholic Beverages License" is licenses
for manufacturing, importing, wholesaling and retailing. Profits of state-run
liquor stores are liquor store revenue, NOT T10, so in control states such as
Utah T10 is not total alcohol revenue.

Conventions handled here:
* 'X' = not applicable (stored as NULL with missing_reason not_applicable);
* -11111 in early national rows = not available (NULL, not a negative amount);
* the period comes from the published FY Ending Date (MMDDYY), which in the
  1950s can end in the year before the STC survey year.
"""

from __future__ import annotations

import csv
import io
from datetime import date
from pathlib import Path

import openpyxl

from alcohol_data import geo
from alcohol_data.adapters.base import NATION, Rejected, Staged, register
from alcohol_data.config import AssetConfig
from alcohol_data.fiscal import fiscal_period, fiscal_period_for

ITEMS = {
    "T10": "stc_alcoholic_beverages_sales_tax",
    "T20": "stc_alcoholic_beverages_license_tax",
    "C105": "stc_total_taxes",
}
SENTINEL_NOT_AVAILABLE = -11111


def _amount(row_measure: str, raw, *, loc: str, base: dict) -> Staged | Rejected:
    """Build a staged amount from a raw cell (int thousands, 'X', or sentinel)."""
    flags = list(base.pop("flags", []))
    if isinstance(raw, str) and raw.strip().upper() == "X":
        return Staged(
            measure_id=row_measure,
            value=None,
            missing_reason="not_applicable",
            raw_value="X",
            source_locator=loc,
            quality_flags=flags,
            **base,
        )
    try:
        n = int(str(raw).strip().replace(",", ""))
    except ValueError:
        return Rejected(
            loc,
            f"non-numeric amount {raw!r}",
            measure_id=row_measure,
            geo_id=base["geo_id"],
            raw_value=str(raw),
        )
    if n == SENTINEL_NOT_AVAILABLE:
        return Staged(
            measure_id=row_measure,
            value=None,
            missing_reason="unavailable",
            raw_value=str(n),
            source_locator=loc,
            quality_flags=flags + ["source_sentinel_-11111"],
            **base,
        )
    if n < 0:
        return Rejected(
            loc,
            f"negative tax amount {n} needs review",
            measure_id=row_measure,
            geo_id=base["geo_id"],
            raw_value=str(n),
        )
    return Staged(
        measure_id=row_measure,
        value=n * 1000.0,
        raw_value=str(n),
        source_locator=loc,
        quality_flags=flags,
        **base,
    )


def _common(asset, geo_id, start, end, label, year, fy_end, code, flags, extra=None) -> dict:
    return dict(
        geo_id=geo_id,
        period_start=start,
        period_end=end,
        period_kind="state_fiscal_year",
        period_label=label,
        year=year,
        estimate_type="administrative_amount",
        extraction_method="spreadsheet_parser" if asset.format == "xlsx" else "csv_parser",
        comparability_group="census_stc|state_government",
        source_code=code,
        raw_unit="thousands_of_dollars",
        multiplier=1000.0,
        fiscal_year_end=fy_end,
        flags=flags,
        extra=extra,
    )


@register("census_stc_historical_xlsx", "1.0")
def parse_historical(asset: AssetConfig, path: Path):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    sheets = [ws for ws in wb.worksheets if ws.title.startswith("STC_Historical")]
    if len(sheets) != 1:
        yield Rejected(
            "workbook", f"expected one STC_Historical sheet, found {[w.title for w in wb.worksheets]}"
        )
        return
    ws = sheets[0]
    rows = ws.iter_rows(values_only=True)
    header = [str(h).strip() if h is not None else "" for h in next(rows)]
    next(rows)  # descriptions row
    col = {h: i for i, h in enumerate(header)}
    for need in ("Year", "State", "Name", "FY Ending Date", *ITEMS):
        if need not in col:
            yield Rejected("header", f"column {need} missing")
            return
    for excel_row, r in enumerate(rows, start=3):
        if r[col["Year"]] is None:
            continue
        stc_year = int(r[col["Year"]])
        code = int(r[col["State"]])
        name = str(r[col["Name"]] or "").strip()
        fy_raw = r[col["FY Ending Date"]]
        if code == 0:
            geo_id = NATION
            # The U.S. row sums states whose fiscal years differ; no single 12-month period applies.
            start, end, fy_end = date(stc_year - 1, 4, 1), date(stc_year, 9, 30), None
            label = f"STC {stc_year} (sum of state fiscal years ending in {stc_year})"
            flags = ["aggregate_of_differing_fiscal_years"]
            year = stc_year
        else:
            st = geo.by_census_gov_code(f"{code:02d}")
            if st is None or not name.startswith(st.usps + " "):
                yield Rejected(
                    f"row {excel_row}", f"state code {code} / name {name!r} do not match the crosswalk"
                )
                continue
            geo_id = st.geo_id
            s = str(fy_raw).strip().zfill(6)
            if not s.isdigit():
                yield Rejected(f"row {excel_row}", f"FY Ending Date {fy_raw!r} not MMDDYY", geo_id=geo_id)
                continue
            mm, dd, yy = int(s[:2]), int(s[2:4]), int(s[4:])
            # Two-digit year: the fiscal year ends in the survey year or the year before it.
            fy_year = next((y for y in (stc_year, stc_year - 1) if y % 100 == yy), None)
            if fy_year is None:
                yield Rejected(
                    f"row {excel_row}",
                    f"FY Ending Date {fy_raw} inconsistent with STC year {stc_year}",
                    geo_id=geo_id,
                )
                continue
            fy_end = date(fy_year, mm, dd)
            start, end = fiscal_period(fy_end)
            label = f"FY ending {fy_end.isoformat()}"
            flags = [] if fy_year == stc_year else ["fiscal_year_ends_before_stc_year"]
            year = fy_year
        for item, measure in ITEMS.items():
            base = _common(
                asset, geo_id, start, end, label, year, fy_end, item, flags, {"stc_year": stc_year}
            )
            yield _amount(
                measure, r[col[item]], loc=f"sheet '{ws.title}' row {excel_row} column {item}", base=base
            )


@register("census_stc_flat_file", "1.0")
def parse_flat(asset: AssetConfig, path: Path):
    """FYxxxx-Flat-File.txt: ITEM column then one column per state (US, AL, ... including DC)."""
    fy = int(asset.options["fiscal_year"])
    text = path.read_text(encoding="latin-1")
    reader = csv.reader(io.StringIO(text))
    header = next(reader)
    if header[0] != "ITEM":
        yield Rejected("line 1", f"expected ITEM header, found {header[0]!r}")
        return
    for lineno, row in enumerate(reader, start=2):
        item = row[0].strip()
        if item not in ITEMS:
            continue
        for abbr, raw in zip(header[1:], row[1:], strict=True):
            loc = f"line {lineno} ({item}), column {abbr}"
            if abbr == "US":
                geo_id = NATION
                start, end, fy_end, flags = (
                    date(fy - 1, 4, 1),
                    date(fy, 9, 30),
                    None,
                    ["aggregate_of_differing_fiscal_years"],
                )
                label = f"STC {fy} (sum of state fiscal years ending in {fy})"
            else:
                st = geo.by_usps(abbr)
                if st is None:
                    yield Rejected(loc, f"unknown state abbreviation {abbr}")
                    continue
                geo_id = st.geo_id
                per = fiscal_period_for(geo_id, fy)
                if per is None:
                    yield Rejected(loc, "no fiscal-year rule", geo_id=geo_id)
                    continue
                start, end, rule = per
                fy_end = end
                flags = [] if rule.verified else ["fiscal_year_dates_not_verified_against_source"]
                label = f"FY ending {end.isoformat()}"
            base = _common(asset, geo_id, start, end, label, fy, fy_end, item, flags, {"stc_year": fy})
            yield _amount(ITEMS[item], raw, loc=loc, base=base)
