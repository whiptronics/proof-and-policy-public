"""Census Bureau County Business Patterns (CBP), state files: alcohol retail and drinking-place industries.

One comma-delimited file per year (cbp<yy>st.txt in cbp<yy>st.zip), one row per state x NAICS code (and,
from 2010, x legal form of organization; only the all-forms rows, lfo "-", are read). Read here:

* NAICS 445310, beer, wine and liquor stores: establishments and employment;
* NAICS 722410, drinking places (alcoholic beverages): establishments and employment;
* NAICS 445110, supermarkets and other grocery (except convenience) stores: establishments.

CBP covers private employers only. Government establishments are out of scope, so in a state whose
government runs liquor stores those stores are not in NAICS 445310, and the count is never a count of all
off-premises outlets. Grocery stores that sell alcohol are classified under grocery (4451), not 445310.

Establishments are counts of locations with paid employees during the year; they are published as
collected. Employment is for the pay period including March 12 and is disclosure-protected, so its method
changes over time (kept as comparability groups):

* 2000-2006: a cell that would disclose an employer is withheld (``empflag`` gives a size range instead);
* 2007-2016: noise added to every value (``emp_nf``: G low, H moderate, J high) and some cells still
  withheld (``emp_nf`` D, or ``empflag``);
* 2017 on: noise only; ``emp_nf`` S marks a value not published because it does not meet standards.

A withheld or unpublished value is stored as missing with its flag, never as the 0 the file prints.
"""

from __future__ import annotations

import csv
import io
import zipfile
from datetime import date
from pathlib import Path

from alcohol_data import geo
from alcohol_data.adapters.base import Rejected, Staged, register, state_geo
from alcohol_data.config import AssetConfig

INDUSTRIES = {
    "445310": ("naics_445310", True),  # beer, wine and liquor stores
    "722410": ("naics_722410", True),  # drinking places
    "445110": ("naics_445110", False),  # supermarkets; establishments only
}
NAICS_VINTAGE = [
    (2003, "NAICS 1997"),
    (2008, "NAICS 2002"),
    (2012, "NAICS 2007"),
    (2017, "NAICS 2012"),
    (9999, "NAICS 2017"),
]
NOISE = {"G": "cbp_noise_low", "H": "cbp_noise_moderate", "J": "cbp_noise_high"}
WITHHELD = {"D": "suppressed", "S": "not_published"}


def naics_vintage(year: int) -> str:
    return next(v for until, v in NAICS_VINTAGE if year < until)


def emp_method(year: int) -> str:
    if year < 2007:
        return "withheld_cells_no_noise"
    if year < 2017:
        return "noise_and_withheld_cells"
    return "noise_only"


@register("census_cbp_state", "1.0")
def parse(asset: AssetConfig, path: Path):
    year = int(asset.options["year"])
    zf = zipfile.ZipFile(path)
    names = [n for n in zf.namelist() if n.lower() == f"cbp{year % 100:02d}st.txt"]
    if len(names) != 1:
        yield Rejected(
            asset.asset_id, f"expected cbp{year % 100:02d}st.txt in the archive, found {zf.namelist()}"
        )
        return
    name = names[0]
    reader = csv.reader(io.TextIOWrapper(zf.open(name), encoding="latin-1", newline=""))
    hdr = [h.strip().lower() for h in next(reader)]
    need = ["fipstate", "naics", "emp", "est"]
    if any(h not in hdr for h in need):
        yield Rejected(name, f"heading lacks {[h for h in need if h not in hdr]}")
        return
    col = {h: i for i, h in enumerate(hdr)}
    seen: dict[str, set[str]] = {code: set() for code in INDUSTRIES}
    for lineno, r in enumerate(reader, start=2):
        if not r:
            continue
        code = r[col["naics"]].strip()
        if code not in INDUSTRIES or ("lfo" in col and r[col["lfo"]].strip() != "-"):
            continue
        fips = r[col["fipstate"]].strip()
        st = geo.by_fips(fips)
        loc = f"{name} line {lineno} (state {fips}, NAICS {code})"
        if st is None:
            yield Rejected(loc, f"unknown state FIPS {fips!r}")
            continue
        if st.fips in seen[code]:
            yield Rejected(loc, "second all-forms row for this state and industry")
            continue
        seen[code].add(st.fips)
        slug, with_emp = INDUSTRIES[code]
        extra = {"naics_vintage": naics_vintage(year), "cbp_year": year}
        est = r[col["est"]].strip()
        if not est.isdigit():
            yield Rejected(loc, f"unreadable establishment count {est!r}", geo_id=st.geo_id, raw_value=est)
        else:
            yield Staged(
                geo_id=state_geo(st.fips),
                measure_id=f"cbp_establishments_{slug}",
                period_start=date(year, 1, 1),
                period_end=date(year, 12, 31),
                period_kind="calendar_year",
                period_label=str(year),
                year=year,
                value=float(est),
                source_locator=f"{loc}, column est",
                estimate_type="reported_count",
                extraction_method="csv_parser",
                comparability_group=f"cbp|naics_{code}|establishments",
                source_code=code,
                raw_value=est,
                raw_unit="establishments",
                multiplier=1.0,
                extra=extra,
            )
        if not with_emp:
            continue
        emp = r[col["emp"]].strip()
        empflag = r[col["empflag"]].strip() if "empflag" in col else ""
        nf = r[col["emp_nf"]].strip() if "emp_nf" in col else ""
        march = date(year, 3, 12)
        base = dict(
            geo_id=state_geo(st.fips),
            measure_id=f"cbp_employment_{slug}",
            period_start=march,
            period_end=march,
            period_kind="point_in_time",
            period_label=f"pay period including {march.isoformat()}",
            year=year,
            source_locator=f"{loc}, column emp",
            estimate_type="reported_count",
            extraction_method="csv_parser",
            comparability_group=f"cbp|naics_{code}|employment|{emp_method(year)}",
            source_code=code,
            raw_value=emp,
            raw_unit="employees",
            multiplier=1.0,
            extra={**extra, "empflag": empflag or None, "emp_nf": nf or None},
        )
        if empflag or nf in WITHHELD:
            reason = "suppressed" if empflag else WITHHELD[nf]
            yield Staged(value=None, missing_reason=reason, quality_flags=["cbp_withheld"], **base)
        elif not emp.isdigit():
            yield Rejected(loc, f"unreadable employment {emp!r}", geo_id=st.geo_id, raw_value=emp)
        else:
            flags = [NOISE[nf]] if nf in NOISE else []
            yield Staged(value=float(emp), quality_flags=flags, **base)
    for code, states in seen.items():
        if len(states) != 51:
            yield Rejected(name, f"NAICS {code}: {len(states)} states with an all-forms row, expected 51")
