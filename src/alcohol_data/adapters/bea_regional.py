"""BEA Regional Economic Accounts: state annual personal income (table SAINC1, from SAINC.zip).

SAINC1 gives, for the United States, each state and DC, and BEA's regions, three lines per calendar year:
personal income (millions of current dollars), population (Census midyear estimates, as BEA used them) and
per capita personal income (dollars). Only personal income and per capita personal income are read; the
population line repeats Census estimates the dataset already has. BEA's regions are not Census regions and
are skipped.

Every release revises earlier years (the file says which: "revised statistics for 2009-2025"), so a pin is
one vintage. The release line is kept with each value. "(NA)" (not available, e.g. Alaska and Hawaii before
1950) and "(NM)" (not meaningful) are stored as missing, never as zero.
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

LINES = {
    "1": ("bea_personal_income", 1_000_000.0, "millions_of_dollars", "Personal income (millions of dollars)"),
    "3": ("bea_per_capita_personal_income", 1.0, "dollars", "Per capita personal income (dollars)"),
}
MISSING = {"(NA)": "not_published", "(NM)": "not_applicable", "(D)": "suppressed"}
MEMBER = re.compile(r"^SAINC1__ALL_AREAS_\d{4}_\d{4}\.csv$")
UPDATED = re.compile(r"Last updated: ([^\"]+)")


@register("bea_sainc1", "1.0")
def parse(asset: AssetConfig, path: Path):
    zf = zipfile.ZipFile(path)
    names = [n for n in zf.namelist() if MEMBER.match(n)]
    if len(names) != 1:
        yield Rejected(asset.asset_id, f"expected one SAINC1__ALL_AREAS_<years>.csv, found {names}")
        return
    name = names[0]
    text = zf.read(name).decode("utf-8-sig", errors="replace")
    m = UPDATED.search(text)
    release = m.group(1).strip() if m else None
    if release is None:
        yield Rejected(name, "no 'Last updated' line: the vintage cannot be recorded")
        return
    reader = csv.reader(io.StringIO(text))
    header = [h.strip() for h in next(reader)]
    need = ["GeoFIPS", "GeoName", "LineCode", "Description", "Unit"]
    if any(h not in header for h in need):
        yield Rejected(name, f"heading lacks {[h for h in need if h not in header]}")
        return
    idx = {h: header.index(h) for h in need}
    years = [(i, int(h)) for i, h in enumerate(header) if re.fullmatch(r"\d{4}", h)]
    for lineno, row in enumerate(reader, start=2):
        if len(row) < len(header):
            continue  # the notes at the end of the file
        fips = row[idx["GeoFIPS"]].strip().strip('"').strip()
        line = row[idx["LineCode"]].strip()
        if line not in LINES or not re.fullmatch(r"\d{5}", fips):
            continue
        if fips == "00000":
            geo_id = NATION
        elif fips.endswith("000") and geo.by_fips(fips[:2]) is not None:
            geo_id = state_geo(fips[:2])
        else:
            continue  # BEA regions (91000-98000)
        measure, multiplier, raw_unit, expected = LINES[line]
        desc = row[idx["Description"]].strip()
        if not desc.startswith(expected):
            yield Rejected(f"{name} line {lineno}", f"line {line} is {desc!r}, expected {expected!r}")
            continue
        for col, year in years:
            raw = row[col].strip()
            loc = f"{name} line {lineno} ({row[idx['GeoName']].strip()}, line code {line}), column {year}"
            base = dict(
                geo_id=geo_id,
                measure_id=measure,
                period_start=date(year, 1, 1),
                period_end=date(year, 12, 31),
                period_kind="calendar_year",
                period_label=str(year),
                year=year,
                estimate_type="official_estimate",
                extraction_method="csv_parser",
                comparability_group=f"bea_sainc|{measure}",
                source_code=f"SAINC1 line {line}",
                raw_unit=raw_unit,
                multiplier=multiplier,
                source_locator=loc,
                extra={"bea_release": release},
            )
            if raw in MISSING:
                yield Staged(value=None, missing_reason=MISSING[raw], raw_value=raw, **base)
                continue
            try:
                value = float(raw.replace(",", ""))
            except ValueError:
                yield Rejected(
                    loc, f"unreadable value {raw!r}", measure_id=measure, geo_id=geo_id, raw_value=raw
                )
                continue
            yield Staged(value=value * multiplier, raw_value=raw, **base)
