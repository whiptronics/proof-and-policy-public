"""Census Monthly State Retail Sales (MSRS, experimental): year-over-year percent changes, state_retail_yy.csv.

Columns: fips, stateabbr, naics, then yyYYYYMM for each month (percent change from the same month a year
earlier). Two series are read: TOTAL (total retail sales excluding nonstore retailers, as the Census maps
title it) and 445 (food and beverage stores, which mixes supermarkets with beer, wine and liquor stores).
The other subsectors are not about alcohol and are skipped. The file has no dollar levels and no
significance flags. "S" (does not meet publication standards) is stored as suppressed and a blank cell as
not published; neither is ever zero.
"""

from __future__ import annotations

import calendar
import csv
import re
from datetime import date
from pathlib import Path

from alcohol_data import geo
from alcohol_data.adapters.base import NATION, Rejected, Staged, register
from alcohol_data.config import AssetConfig

SERIES = {
    "TOTAL": "msrs_total_retail_yoy_pct",
    "445": "msrs_food_beverage_stores_yoy_pct",
}
COL = re.compile(r"^yy(\d{4})(\d{2})$")


@register("census_msrs_yy", "1.0")
def parse(asset: AssetConfig, path: Path):
    with open(path, encoding="utf-8-sig", newline="") as f:
        reader = csv.reader(f)
        header = next(reader)
        if header[:3] != ["fips", "stateabbr", "naics"]:
            yield Rejected(path.name, f"unexpected heading {header[:3]}")
            return
        months = [(i, int(m.group(1)), int(m.group(2))) for i, h in enumerate(header) if (m := COL.match(h))]
        if len(months) != len(header) - 3:
            yield Rejected(path.name, "some columns are not yyYYYYMM")
            return
        seen: set[tuple[str, str]] = set()
        for lineno, row in enumerate(reader, start=2):
            naics = row[2].strip()
            if naics not in SERIES:
                continue
            fips, abbr = row[0].strip(), row[1].strip()
            if fips == "00" and abbr == "USA":
                geo_id = NATION
            else:
                st = geo.by_fips(fips)
                if st is None or st.usps != abbr:
                    yield Rejected(f"{path.name} line {lineno}", f"unknown state {fips} {abbr}")
                    continue
                geo_id = st.geo_id
            if (geo_id, naics) in seen:
                yield Rejected(f"{path.name} line {lineno}", f"second row for {abbr} {naics}")
                continue
            seen.add((geo_id, naics))
            measure = SERIES[naics]
            for col, y, m in months:
                raw = row[col].strip() if col < len(row) else ""
                base = dict(
                    geo_id=geo_id,
                    measure_id=measure,
                    period_start=date(y, m, 1),
                    period_end=date(y, m, calendar.monthrange(y, m)[1]),
                    period_kind="month",
                    period_label=f"{y}-{m:02d}",
                    year=y,
                    estimate_type="survey_estimate",
                    extraction_method="csv_parser",
                    comparability_group=f"census_msrs|{measure}",
                    source_code=f"naics {naics}, {header[col]}",
                    raw_unit="percent change from the same month a year earlier",
                    multiplier=1.0,
                    source_locator=f"{path.name} line {lineno} ({abbr}, naics {naics}), column {header[col]}",
                    quality_flags=["experimental_data_product", "not_seasonally_adjusted"],
                )
                if raw == "":
                    yield Staged(value=None, missing_reason="not_published", raw_value=raw, **base)
                    continue
                if raw == "S":  # Census: does not meet publication standards
                    yield Staged(
                        value=None, missing_reason="suppressed", suppression_flag="S", raw_value=raw, **base
                    )
                    continue
                try:
                    value = float(raw)
                except ValueError:
                    yield Rejected(
                        base["source_locator"], f"unreadable value {raw!r}", measure_id=measure, geo_id=geo_id
                    )
                    continue
                yield Staged(value=value, raw_value=raw, **base)
