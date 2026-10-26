"""BEA Personal Consumption Expenditures by State, table SAPCE3 (PCE by type of product), from SAPCE.zip.

Only line 28 is read: "Alcoholic beverages purchased for off-premises consumption", millions of current
dollars, calendar years 1997 on, for the United States, each state and DC. It is spending by a state's
residents on alcohol bought to take away, from any kind of store (grocery, liquor, convenience or state
store). Drinks bought in bars and restaurants sit inside food services and are not separated. BEA's
regions are skipped. Each release revises earlier years (the file says which), so the release line is kept.
BEA footnotes: "(L)" less than $50,000, "(NM)" not meaningful, "(NA)" not available, "(D)" withheld; none is
ever stored as zero.
"""

from __future__ import annotations

import csv
import io
import re
import zipfile
from datetime import date
from pathlib import Path

from alcohol_data import geo
from alcohol_data.adapters.base import NATION, Rejected, Staged, register, state_geo
from alcohol_data.config import AssetConfig

LINE = "28"
EXPECTED = "Alcoholic beverages purchased for off-premises consumption"
MEASURE = "bea_pce_off_premises_alcohol"
MISSING = {"(NA)": "not_published", "(NM)": "not_applicable", "(D)": "suppressed", "(L)": "unavailable"}
MEMBER = re.compile(r"^SAPCE3__ALL_AREAS_\d{4}_\d{4}\.csv$")
UPDATED = re.compile(r"Last updated: ([^\"]+)")


@register("bea_sapce3_alcohol", "1.0")
def parse(asset: AssetConfig, path: Path):
    zf = zipfile.ZipFile(path)
    names = [n for n in zf.namelist() if MEMBER.match(n)]
    if len(names) != 1:
        yield Rejected(asset.asset_id, f"expected one SAPCE3__ALL_AREAS_<years>.csv, found {names}")
        return
    name = names[0]
    text = zf.read(name).decode("utf-8-sig", errors="replace")
    m = UPDATED.search(text)
    if m is None:
        yield Rejected(name, "no 'Last updated' line: the vintage cannot be recorded")
        return
    release = m.group(1).strip()
    reader = csv.reader(io.StringIO(text))
    header = [h.strip() for h in next(reader)]
    need = ["GeoFIPS", "GeoName", "LineCode", "Description", "Unit"]
    if any(h not in header for h in need):
        yield Rejected(name, f"heading lacks {[h for h in need if h not in header]}")
        return
    idx = {h: header.index(h) for h in need}
    years = [(i, int(h)) for i, h in enumerate(header) if re.fullmatch(r"\d{4}", h)]
    for lineno, row in enumerate(reader, start=2):
        if len(row) < len(header) or row[idx["LineCode"]].strip() != LINE:
            continue
        fips = row[idx["GeoFIPS"]].strip().strip('"').strip()
        if fips == "00000":
            geo_id = NATION
        elif re.fullmatch(r"\d{2}000", fips) and geo.by_fips(fips[:2]) is not None:
            geo_id = state_geo(fips[:2])
        else:
            continue  # BEA regions
        desc = row[idx["Description"]].strip()
        unit = row[idx["Unit"]].strip()
        if desc != EXPECTED or unit != "Millions of current dollars":
            yield Rejected(
                f"{name} line {lineno}",
                f"line {LINE} is {desc!r} in {unit!r}; expected {EXPECTED!r} in millions",
            )
            continue
        for col, year in years:
            raw = row[col].strip()
            loc = f"{name} line {lineno} ({row[idx['GeoName']].strip()}, SAPCE3 line {LINE}), column {year}"
            base = dict(
                geo_id=geo_id,
                measure_id=MEASURE,
                period_start=date(year, 1, 1),
                period_end=date(year, 12, 31),
                period_kind="calendar_year",
                period_label=str(year),
                year=year,
                estimate_type="official_estimate",
                extraction_method="csv_parser",
                comparability_group=f"bea_sapce|{MEASURE}",
                source_code=f"SAPCE3 line {LINE}",
                raw_unit="millions_of_dollars",
                multiplier=1_000_000.0,
                source_locator=loc,
                extra={"bea_release": release},
            )
            if raw in MISSING:
                yield Staged(
                    value=None,
                    missing_reason=MISSING[raw],
                    raw_value=raw,
                    suppression_flag=raw if raw == "(D)" else None,
                    **base,
                )
                continue
            try:
                value = float(raw.replace(",", ""))
            except ValueError:
                yield Rejected(
                    loc, f"unreadable value {raw!r}", measure_id=MEASURE, geo_id=geo_id, raw_value=raw
                )
                continue
            yield Staged(value=value * 1_000_000.0, raw_value=raw, **base)
