"""Census Economic Census: NAICS 445310 (beer, wine and liquor stores) by state, 2017 and 2012.

EC1700BASIC.dat (pipe-delimited, 1.1 GB inside the zip; read as a stream) gives 2017 summary statistics for
every geography and industry; EC1700COMP.dat gives 2012 and 2017 side by side. Only the United States
(GEOTYPE 01) and whole states (GEOTYPE 02, GEOCOMP 00; not their metro/non-metro parts), all establishments
(TYPOP 00, TAXSTAT 00 in the basic file) and NAICS 445310 are read: establishments and sales (receipts,
$1,000).

Flags: "D" withheld to avoid disclosing a single company, "S" withheld for quality, "N" not available, "X"
not applicable, and for employment a letter giving the size range of a withheld figure. The files print 0
in a withheld cell; it is stored as missing (suppressed), never as zero. Receipts are this industry's
sales only (private stores with payroll), not total alcohol sales in a state.
"""

from __future__ import annotations

import io
import zipfile
from datetime import date
from pathlib import Path

from alcohol_data import geo
from alcohol_data.adapters.base import NATION, Rejected, Staged, register, state_geo
from alcohol_data.config import AssetConfig

NAICS = "445310"
FIELDS = {
    "ESTAB": ("ec_establishments_naics_445310", 1.0, "establishments"),
    "RCPTOT": ("ec_sales_naics_445310", 1000.0, "thousands_of_dollars"),
}
FLAGS = {"D": "suppressed", "S": "suppressed", "N": "not_published", "X": "not_applicable"}


def _rows(path: Path, member: str):
    zf = zipfile.ZipFile(path)
    with zf.open(member) as raw:
        f = io.TextIOWrapper(raw, encoding="latin-1", newline="")
        header = f.readline().rstrip("\r\n").lstrip("#").split("|")
        yield header
        for n, line in enumerate(f, start=2):
            yield n, line.rstrip("\r\n").split("|")


def _staged(asset_id, member, n, p, h, year, naics_col, geo_title):
    geotype = p[h["GEOTYPE"]]
    if geotype == "01":
        geo_id = NATION
    elif geotype == "02" and geo.by_fips(p[h["ST"]]) is not None:
        geo_id = state_geo(p[h["ST"]])
    else:
        return
    for field, (measure, mult, raw_unit) in FIELDS.items():
        raw, flag = p[h[field]].strip(), p[h[f"{field}_F"]].strip()
        loc = f"{member} line {n} ({p[h[geo_title]]}, {naics_col} {NAICS}, {year}), {field}"
        base = dict(
            geo_id=geo_id,
            measure_id=measure,
            period_start=date(year, 1, 1),
            period_end=date(year, 12, 31),
            period_kind="calendar_year",
            period_label=str(year),
            year=year,
            estimate_type="administrative_amount" if field == "RCPTOT" else "reported_count",
            extraction_method="csv_parser",
            comparability_group=f"census_economic_census|{measure}",
            source_code=f"{field} NAICS {NAICS}",
            raw_unit=raw_unit,
            multiplier=mult,
            source_locator=loc,
        )
        if flag:
            reason = FLAGS.get(flag, "suppressed" if flag.isalpha() and flag.islower() else None)
            if reason is None:
                yield Rejected(loc, f"unknown flag {flag!r}", measure_id=measure, geo_id=geo_id)
                continue
            yield Staged(value=None, missing_reason=reason, suppression_flag=flag, raw_value=raw, **base)
            continue
        try:
            value = float(raw)
        except ValueError:
            yield Rejected(loc, f"unreadable value {raw!r}", measure_id=measure, geo_id=geo_id)
            continue
        yield Staged(value=value * mult, raw_value=raw, **base)


@register("census_ec2017_basic", "1.0")
def parse_basic(asset: AssetConfig, path: Path):
    member = "EC1700BASIC.dat"
    it = _rows(path, member)
    header = next(it)
    h = {k: i for i, k in enumerate(header)}
    need = [
        "GEOTYPE",
        "ST",
        "GEOCOMP",
        "GEO_TTL",
        "NAICS2017",
        "TYPOP",
        "TAXSTAT",
        "YEAR",
        "ESTAB",
        "ESTAB_F",
        "RCPTOT",
        "RCPTOT_F",
    ]
    if any(k not in h for k in need):
        yield Rejected(member, f"heading lacks {[k for k in need if k not in h]}")
        return
    for n, p in it:
        if len(p) != len(header) or p[h["NAICS2017"]] != NAICS:
            continue
        if (
            p[h["GEOTYPE"]] not in ("01", "02")
            or p[h["GEOCOMP"]] != "00"
            or p[h["TYPOP"]] != "00"
            or p[h["TAXSTAT"]] != "00"
        ):
            continue
        if p[h["YEAR"]] != "2017":
            yield Rejected(f"{member} line {n}", f"year {p[h['YEAR']]!r}, expected 2017")
            continue
        yield from _staged(asset.asset_id, member, n, p, h, 2017, "NAICS2017", "GEO_TTL")


@register("census_ec2017_comp", "1.0")
def parse_comp(asset: AssetConfig, path: Path):
    member = "EC1700COMP.dat"
    it = _rows(path, member)
    header = next(it)
    h = {k: i for i, k in enumerate(header)}
    need = ["GEOTYPE", "ST", "GEO_TTL", "NAICS2012", "YEAR", "ESTAB", "ESTAB_F", "RCPTOT", "RCPTOT_F"]
    if any(k not in h for k in need):
        yield Rejected(member, f"heading lacks {[k for k in need if k not in h]}")
        return
    for n, p in it:
        if len(p) != len(header) or p[h["NAICS2012"]] != NAICS or p[h["GEOTYPE"]] not in ("01", "02"):
            continue
        year = int(p[h["YEAR"]])
        if year not in (2012, 2017):
            yield Rejected(f"{member} line {n}", f"year {year}, expected 2012 or 2017")
            continue
        yield from _staged(asset.asset_id, member, n, p, h, year, "NAICS2012", "GEO_TTL")
