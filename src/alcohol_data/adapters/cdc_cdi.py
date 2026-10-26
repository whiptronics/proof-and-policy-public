"""CDC U.S. Chronic Disease Indicators (CDI), CSV export of data.cdc.gov dataset hksd-2xuw: alcohol topic.

The export holds every CDI topic, year and break-out. Only Topic "Alcohol", the Overall break-out, single
years (YearStart == YearEnd), the 50 states, DC and the United States are read. Territories (GU, PR, VI) are
outside the dataset's panel. Each (question, data value type) is mapped to one measure below; anything
else in the topic is skipped, and a row seen twice for the same cell is rejected rather than overwritten.

CDI footnote symbols are kept with the value:
* "*"    no data available            -> missing, unavailable
* "****" suppressed (denominator < 50 or relative standard error > 30%) -> missing, suppressed
* "~"    suppressed (too few respondents or cases)                      -> missing, suppressed
* "##"   estimate is 0.0% because no cases were reported                 -> a real zero
The export gives confidence limits without stating their level, so the level is not recorded.

Two items repeat sources the dataset already holds and are read only so a check can compare them: the
crude adult binge drinking prevalence (BRFSS) and per capita consumption ages 14+ (NIAAA, "AEDS"). They are
stored as candidates for those measures at a lower priority, so the original publishers stay preferred, and
only where CDI has a value (see CROSS_CHECK).
CDI's per capita consumption is rounded and does not match either NIAAA edition held (it appears to
repeat an earlier edition).
"US" rows of BRFSS items are skipped: the export does not say whether they are national estimates or
medians of states.
"""

from __future__ import annotations

import csv
from datetime import date
from pathlib import Path

from alcohol_data import geo
from alcohol_data.adapters.base import NATION, Rejected, Staged, register
from alcohol_data.config import AssetConfig

# (QuestionID, DataValueType) -> (measure, period kind, expected unit text)
ITEMS = {
    ("ALC09", "Age-adjusted Rate"): (
        "cdi_chronic_liver_disease_mortality_age_adjusted_rate",
        "calendar_year",
        "cases per 100,000",
    ),
    ("ALC09", "Crude Rate"): (
        "cdi_chronic_liver_disease_mortality_crude_rate",
        "calendar_year",
        "cases per 100,000",
    ),
    ("ALC09", "Number"): ("cdi_chronic_liver_disease_deaths", "calendar_year", "Number"),
    ("ALC01", "Crude Prevalence"): ("yrbs_current_alcohol_use_hs_pct", "survey_year", "%"),
    ("ALC07", "Crude Prevalence"): ("yrbs_binge_drinking_hs_pct", "survey_year", "%"),
    ("ALC06", "Age-adjusted Prevalence"): ("brfss_binge_age_adjusted_pct", "survey_year", "%"),
    ("ALC06", "Crude Prevalence"): ("brfss_binge_5m_4f_pct", "survey_year", "%"),
    ("ALC04", "Crude Median"): ("brfss_binge_frequency_median", "survey_year", "Number"),
    ("ALC05", "Crude Median"): ("brfss_binge_intensity_median", "survey_year", "Number"),
    ("ALC08", "Per capita alcohol consumption gallons"): (
        "niaaa_ethanol_per_capita_14plus_all",
        "calendar_year",
        "gallons",
    ),
}
# Items read only to compare with their original publisher. A row of theirs without a value is not staged:
# it could only become the preferred row where the original has none (BRFSS has no New Jersey 2019 binge
# figure, for example), and would put a false change of source into the original series on both sides.
CROSS_CHECK = {"brfss_binge_5m_4f_pct", "niaaa_ethanol_per_capita_14plus_all"}
FOOTNOTES = {
    "*": ("unavailable", None),
    "****": ("suppressed", "****"),
    "~": ("suppressed", "~"),
}
NEED = [
    "YearStart",
    "YearEnd",
    "LocationAbbr",
    "DataSource",
    "Topic",
    "Question",
    "DataValueUnit",
    "DataValueType",
    "DataValue",
    "DataValueFootnoteSymbol",
    "DataValueFootnote",
    "LowConfidenceLimit",
    "HighConfidenceLimit",
    "StratificationCategory1",
    "Stratification1",
    "QuestionID",
]


def _num(s: str) -> float | None:
    s = (s or "").strip().replace(",", "")
    return float(s) if s else None


@register("cdc_cdi_alcohol", "1.0")
def parse(asset: AssetConfig, path: Path):
    seen: set[tuple[str, str, int]] = set()
    with open(path, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        missing = [h for h in NEED if h not in (reader.fieldnames or [])]
        if missing:
            yield Rejected(path.name, f"export lacks columns {missing}")
            return
        for lineno, row in enumerate(reader, start=2):
            if row["Topic"] != "Alcohol" or row["StratificationCategory1"] != "Overall":
                continue
            key = (row["QuestionID"], row["DataValueType"])
            if key not in ITEMS:
                continue  # e.g. 75th percentiles; not loaded
            measure, period_kind, unit_text = ITEMS[key]
            loc = f"{path.name} line {lineno} ({row['LocationAbbr']}, {row['QuestionID']}, {row['DataValueType']}, {row['YearStart']})"
            if row["DataValueUnit"].strip() != unit_text:
                yield Rejected(
                    loc, f"unit {row['DataValueUnit']!r}, expected {unit_text!r}", measure_id=measure
                )
                continue
            if row["YearStart"] != row["YearEnd"]:
                continue  # pooled years are never one year's observation
            abbr = row["LocationAbbr"].strip()
            if abbr == "US" and row["DataSource"].strip() == "BRFSS":
                # BRFSS is a state survey; the export does not say whether its "US" value is a national
                # estimate or a median of states, and the dataset does not load BRFSS median rows.
                continue
            if abbr == "US":
                geo_id = NATION
            else:
                st = geo.by_usps(abbr)
                if st is None:
                    continue  # territories
                geo_id = st.geo_id
            year = int(row["YearStart"])
            cell = (measure, geo_id, year)
            if cell in seen:
                yield Rejected(
                    loc, "second row for the same measure, place and year", measure_id=measure, geo_id=geo_id
                )
                continue
            seen.add(cell)
            symbol = row["DataValueFootnoteSymbol"].strip()
            note = row["DataValueFootnote"].strip() or None
            base = dict(
                geo_id=geo_id,
                measure_id=measure,
                period_start=date(year, 1, 1),
                period_end=date(year, 12, 31),
                period_kind=period_kind,
                period_label=str(year),
                year=year,
                estimate_type=(
                    "reported_count"
                    if row["DataValueType"] == "Number"
                    else "survey_estimate"
                    if row["DataSource"].strip() in ("BRFSS", "YRBSS")
                    else "official_estimate"
                ),
                extraction_method="csv_parser",
                comparability_group=f"cdi|{row['QuestionID']}|{row['DataValueType']}",
                source_code=f"{row['QuestionID']} {row['DataValueType']}",
                raw_unit=row["DataValueUnit"].strip(),
                multiplier=1.0,
                source_locator=loc,
                footnote=note,
                extra={"cdi_data_source": row["DataSource"].strip(), "cdi_question": row["Question"].strip()},
            )
            raw = row["DataValue"].strip()
            if symbol in FOOTNOTES:
                reason, flag = FOOTNOTES[symbol]
                if raw:
                    yield Rejected(
                        loc, f"footnote {symbol!r} says no value, but the row has {raw!r}", measure_id=measure
                    )
                    continue
                if measure in CROSS_CHECK:
                    continue
                yield Staged(
                    value=None, missing_reason=reason, suppression_flag=flag, raw_value=symbol, **base
                )
                continue
            if symbol not in ("", "##"):
                yield Rejected(loc, f"unknown footnote symbol {symbol!r}", measure_id=measure)
                continue
            try:
                value = _num(raw)
            except ValueError:
                yield Rejected(loc, f"unreadable value {raw!r}", measure_id=measure)
                continue
            if value is None:
                if measure not in CROSS_CHECK:
                    yield Staged(value=None, missing_reason="unavailable", raw_value=raw, **base)
                continue
            if symbol == "##" and value != 0:
                yield Rejected(loc, f"footnote '##' (reported zero) with value {raw!r}", measure_id=measure)
                continue
            yield Staged(
                value=value,
                raw_value=raw,
                ci_low=_num(row["LowConfidenceLimit"]),
                ci_high=_num(row["HighConfidenceLimit"]),
                **base,
            )
