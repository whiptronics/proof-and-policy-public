"""NHTSA Fatality Analysis Reporting System (FARS): traffic fatalities and alcohol-impaired-driving fatalities.

``fars_national_csv`` reads one year's national CSV zip (FARS<year>NationalCSV.zip):

* ``accident.csv``: one row per fatal crash, with the state where it happened (STATE) and the number of
  deaths (FATALS). Their sum is ``fars_traffic_fatalities``.
* ``MIDRVACC.CSV``: for each crash, ten imputations (A1-A10) of the highest blood alcohol concentration
  among the drivers, in hundredths of a gram per deciliter (8 = .08 g/dL). NHTSA fills BACs that were not
  reported by multiple imputation. A crash is alcohol-impaired-driving if a driver had a BAC of .08 or more;
  ``fars_alcohol_impaired_driving_fatalities`` is the crash's deaths summed over such crashes, averaged
  over the ten imputations, as NHTSA computes it. ``MIACC.CSV`` (highest BAC of anyone in the crash,
  pedestrians included) is not the measure and is not read. Crashes with no driver have no MIDRVACC row and
  are not alcohol-impaired-driving crashes.

Both measures carry a 95% interval (``alcohol_data.uncertainty``): count noise, which says how much a year's
deaths could move by chance alone with the same underlying risk, and for the imputed measure also the spread
between NHTSA's ten imputations combined by Rubin's rules. Crashes are the Poisson events and a crash can kill
several people, so the count noise uses the sum of squared deaths per crash (compound Poisson), not the count.
FARS is a list of every fatal crash, not a sample, so the interval is about chance variation in the count, not
survey sampling error; ``extra.interval_basis`` says which. The interval (``ci_low``, ``ci_high``) is for the
underlying expected number, referred to Student's t with Rubin's degrees of freedom (``extra.rubin_df``). For
the deaths that actually occurred in a final year, only the imputation part applies:
``extra.realized_total`` holds that interval (t with m - 1 = 9 degrees of freedom, cut at zero and at the year's
total deaths). See alcohol_data.uncertainty.

Deaths are counted where the crash happened, not where the person lived. NHTSA revises a year's file after
its first release; the pin is the version read, and the comparison with NHTSA's published state table is a
validation check (``reconcile_fars_vs_nhtsa_state_table``).

``nhtsa_state_ai_report`` reads the published tables of NHTSA's "State Alcohol-Impaired-Driving Estimates"
report (the 2022 edition has two: 2013 from the FARS 2013 Final File and 2022 from the 2022 Annual Report
File) as published values, kept as their own measures for that comparison. Each table's FARS file version
is recorded; a final file can differ from the annual report file it replaced.
"""

from __future__ import annotations

import csv
import io
import logging
import math
import re
import zipfile
from collections import defaultdict
from datetime import date
from pathlib import Path

from alcohol_data import geo
from alcohol_data.adapters.base import NATION, Rejected, Staged, register, state_geo
from alcohol_data.config import AssetConfig
from alcohol_data.uncertainty import (
    DEFAULT_LEVEL,
    CountInterval,
    count_interval,
    imputed_count_interval,
    realized_total_interval,
)

THRESHOLD = 8  # hundredths of g/dL: .08


def _interval_fields(iv: CountInterval) -> dict:
    """Staged fields for an interval. Rounded to 3 decimals so exports do not depend on the platform's libm."""
    return dict(
        ci_low=round(iv.low, 3),
        ci_high=round(iv.high, 3),
        ci_level=DEFAULT_LEVEL,
        standard_error=round(iv.se, 4),
    )


def _member(zf: zipfile.ZipFile, name: str) -> str | None:
    hits = [n for n in zf.namelist() if n.split("/")[-1].lower() == name]
    return hits[0] if len(hits) == 1 else None


def _rows(zf: zipfile.ZipFile, member: str):
    reader = csv.reader(io.TextIOWrapper(zf.open(member), encoding="latin-1", newline=""))
    header = [h.strip().lstrip("﻿").lstrip("ï»¿").upper() for h in next(reader)]
    return header, reader


def _year_base(year: int, geo_id: str) -> dict:
    return dict(
        geo_id=geo_id,
        period_start=date(year, 1, 1),
        period_end=date(year, 12, 31),
        period_kind="calendar_year",
        period_label=str(year),
        year=year,
        extraction_method="csv_parser",
        raw_unit="deaths",
        multiplier=1.0,
    )


@register("fars_national_csv", "1.2")  # 1.1: intervals; 1.2: Rubin's t for the expected count, realized total
def parse_fars(asset: AssetConfig, path: Path):
    year = int(asset.options["year"])
    zf = zipfile.ZipFile(path)
    acc_name, mi_name = _member(zf, "accident.csv"), _member(zf, "midrvacc.csv")
    if acc_name is None or mi_name is None:
        yield Rejected(
            asset.asset_id, f"accident.csv and MIDRVACC.CSV both needed; found {zf.namelist()[:8]}"
        )
        return
    header, reader = _rows(zf, mi_name)
    cols = ["ST_CASE"] + [f"A{i}" for i in range(1, 11)]
    if any(c not in header for c in cols):
        yield Rejected(mi_name, f"columns missing: {[c for c in cols if c not in header]}")
        return
    idx = [header.index(c) for c in cols]
    imputed: dict[str, list[int]] = {}
    for r in reader:
        if r:
            imputed[r[idx[0]].strip()] = [int(r[i]) for i in idx[1:]]
    header, reader = _rows(zf, acc_name)
    for need in ("STATE", "ST_CASE", "FATALS"):
        if need not in header:
            yield Rejected(acc_name, f"column {need} missing")
            return
    i_state, i_case, i_fat = header.index("STATE"), header.index("ST_CASE"), header.index("FATALS")
    deaths: dict[str, int] = defaultdict(int)
    deaths_sq: dict[str, int] = defaultdict(
        int
    )  # sum of squared deaths per crash: the compound Poisson variance
    impaired: dict[str, list[float]] = defaultdict(lambda: [0.0] * 10)
    impaired_sq: dict[str, list[float]] = defaultdict(lambda: [0.0] * 10)
    crashes = defaultdict(int)
    for lineno, r in enumerate(reader, start=2):
        if not r:
            continue
        st = geo.by_fips(r[i_state].strip().zfill(2))
        if st is None:
            yield Rejected(f"{acc_name} line {lineno}", f"state code {r[i_state]!r} not in the crosswalk")
            continue
        n = int(r[i_fat])
        deaths[st.fips] += n
        deaths_sq[st.fips] += n * n
        crashes[st.fips] += 1
        bacs = imputed.get(r[i_case].strip())
        if bacs is not None:
            for k, bac in enumerate(bacs):
                if bac >= THRESHOLD:
                    impaired[st.fips][k] += n
                    impaired_sq[st.fips][k] += n * n
    for fips in sorted(deaths) + ["US"]:
        if fips == "US":
            geo_id, total, total_sq = NATION, sum(deaths.values()), sum(deaths_sq.values())
            sums = [sum(impaired[f][k] for f in deaths) for k in range(10)]
            sums_sq = [sum(impaired_sq[f][k] for f in deaths) for k in range(10)]
        else:
            geo_id, total, total_sq = state_geo(fips), deaths[fips], deaths_sq[fips]
            sums, sums_sq = impaired[fips], impaired_sq[fips]
        loc = f"{acc_name} (FATALS summed by STATE{'' if fips == 'US' else ' = ' + fips})"
        yield Staged(
            measure_id="fars_traffic_fatalities",
            value=float(total),
            source_locator=loc,
            estimate_type="reported_count",
            comparability_group="fars|traffic_fatalities",
            source_code="FATALS",
            raw_value=str(total),
            extra={
                "fatal_crashes": crashes[fips] if fips != "US" else sum(crashes.values()),
                "interval_basis": "count_noise",
                "sum_sq_deaths_per_crash": total_sq,
            },
            **_interval_fields(count_interval(total, sum_sq=total_sq)),
            **_year_base(year, geo_id),
        )
        mean = sum(sums) / 10
        iv = imputed_count_interval(sums, sums_sq=sums_sq)
        rt = realized_total_interval(sums, upper=float(total))
        yield Staged(
            measure_id="fars_alcohol_impaired_driving_fatalities",
            value=round(mean, 1),
            source_locator=f"{loc} with {mi_name} (A1-A10 >= {THRESHOLD})",
            estimate_type="modeled_estimate",
            comparability_group="fars|alcohol_impaired_driving|midrvacc_bac08",
            source_code="MIDRVACC A1-A10",
            raw_value=" ".join(f"{s:g}" for s in sums),
            quality_flags=["multiple_imputation_mean"],
            extra={
                "imputations": sums,
                "imputation_min": min(sums),
                "imputation_max": max(sums),
                "interval_basis": "count_noise_and_imputation",
                "count_se": round(iv.count_se, 4),
                "imputation_se": round(iv.imputation_se, 4),
                # Degrees of freedom of the t behind ci_low/ci_high; null when the imputations agree (normal).
                "rubin_df": None if math.isinf(iv.df) else round(iv.df, 1),
                # The deaths that occurred: imputation uncertainty only (no count noise), t with m - 1 df.
                "realized_total": {
                    "ci_low": round(rt.low, 3),
                    "ci_high": round(rt.high, 3),
                    "ci_level": DEFAULT_LEVEL,
                    "df": None if math.isinf(rt.df) else rt.df,
                },
            },
            **_interval_fields(iv),
            **_year_base(year, geo_id),
        )


TABLE = re.compile(r"Table \d+\. Traffic Fatalities, by State and Highest Driver BAC in the Crash, (\d{4})")
ROW = re.compile(
    r"^(?P<name>[A-Z][A-Za-z .]+?)\s+(?P<total>[\d,]+)\s+[\d,]+\s+\d+%\s+[\d,]+\s+\d+%\s+(?P<ai>[\d,]+)\s+\d+%"
)


@register("nhtsa_state_ai_report", "1.0")
def parse_report(asset: AssetConfig, path: Path):
    import pypdf

    logging.getLogger("pypdf").setLevel(logging.ERROR)
    pages = [(p.extract_text() or "") for p in pypdf.PdfReader(str(path)).pages]
    names = {s.name.upper(): s for s in geo.states()}
    names["DISTRICT OF COLUMBIA"] = geo.by_fips("11")
    found_years = []
    for page_no, text in enumerate(pages, start=1):
        m = TABLE.search(text)
        if not m:
            continue
        year = int(m.group(1))
        found_years.append(year)
        version = re.search(r"Source: (FARS \d{4} [A-Za-z ]+?)\s*$", text, re.M)
        fars_version = version.group(1).strip() if version else None
        got = 0
        for line in text.splitlines():
            r = ROW.match(line.strip())
            if not r:
                continue
            name = r.group("name").strip().upper()
            if name == "U.S. TOTAL":
                geo_id = NATION
            elif name in names:
                geo_id = names[name].geo_id
            else:
                continue
            got += 1
            loc = f"page {page_no}, Table for {year}, row '{r.group('name').strip()}'"
            for measure, raw in (
                ("nhtsa_published_traffic_fatalities", r.group("total")),
                ("nhtsa_published_alcohol_impaired_driving_fatalities", r.group("ai")),
            ):
                yield Staged(
                    measure_id=measure,
                    value=float(raw.replace(",", "")),
                    source_locator=loc,
                    estimate_type="official_estimate",
                    comparability_group=f"nhtsa_state_ai_report|{asset.source_vintage}",
                    raw_value=raw,
                    extra={"fars_file_version": fars_version},
                    extraction_method="pdf_table",
                    raw_unit="deaths",
                    multiplier=1.0,
                    geo_id=geo_id,
                    period_start=date(year, 1, 1),
                    period_end=date(year, 12, 31),
                    period_kind="calendar_year",
                    period_label=str(year),
                    year=year,
                )
        if got != 52:
            yield Rejected(
                f"page {page_no} ({year})", f"read {got} rows, expected 51 jurisdictions and the U.S. total"
            )
    if not found_years:
        yield Rejected(asset.asset_id, "no 'Traffic Fatalities, by State and Highest Driver BAC' table found")
