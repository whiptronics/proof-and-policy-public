"""CDC Youth Risk Behavior Surveillance System (YRBSS), high school, state and national estimates.

Read from data.cdc.gov dataset svam-8dhg ("DASH - YRBSS: High School - Excluding Sexual Identity",
1991-2017, public domain), queried for three alcohol questions and the total population (sex, race and
grade all "Total"). Only the rows whose stratification type is State or National are read; local school
districts and territories are left out. A state appears only in the years it ran a survey with weighted
results, so the series has gaps by design.

* H42 current alcohol use: at least one drink on at least 1 day in the past 30 days;
* H41 first drink before age 13 (other than a few sips);
* H44 current binge drinking, defined from 2017 as four or more drinks in a row (female) or five or more
  (male) within a couple of hours; earlier years asked a different question, which is not in this
  dataset under this code.

Values are percentages with 95% confidence limits and the unweighted sample size. YRBS is a school-based
survey of students in grades 9-12: it does not describe youth who are not in school.
"""

from __future__ import annotations

import csv
import io
from datetime import date
from pathlib import Path

from alcohol_data import geo
from alcohol_data.adapters.base import NATION, Rejected, Staged, register, state_geo
from alcohol_data.config import AssetConfig

QUESTIONS = {
    "H42": "yrbs_current_alcohol_use_hs_pct",
    "H41": "yrbs_first_drink_before_13_hs_pct",
    "H44": "yrbs_binge_drinking_hs_pct",
}


def _num(s: str) -> float | None:
    s = s.strip()
    return float(s) if s else None


@register("cdc_yrbs_high_school", "1.0")
def parse(asset: AssetConfig, path: Path):
    text = path.read_text(encoding="utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    need = {
        "year",
        "locationid",
        "questioncode",
        "stratificationtype",
        "sex",
        "race",
        "grade",
        "greater_risk_data_value",
    }
    if not need <= set(reader.fieldnames or []):
        yield Rejected(asset.asset_id, f"columns missing: {sorted(need - set(reader.fieldnames or []))}")
        return
    seen = set()
    for lineno, r in enumerate(reader, start=2):
        loc = f"line {lineno} ({r['locationdesc']}, {r['year']}, {r['questioncode']})"
        kind = r["stratificationtype"]
        if kind not in ("State", "National") or r["questioncode"] not in QUESTIONS:
            continue
        if (r["sex"], r["race"], r["grade"]) != ("Total", "Total", "Total"):
            yield Rejected(loc, "not a total-population row; the query should have excluded it")
            continue
        if kind == "National":
            geo_id = NATION
        else:
            st = geo.by_fips(r["locationid"].strip().zfill(2))
            if st is None:
                yield Rejected(loc, f"location id {r['locationid']!r} is not a state FIPS code")
                continue
            geo_id = state_geo(st.fips)
        year = int(r["year"])
        measure = QUESTIONS[r["questioncode"]]
        key = (geo_id, measure, year)
        if key in seen:
            yield Rejected(loc, "a second total row for this place, question and year")
            continue
        seen.add(key)
        value = _num(r["greater_risk_data_value"])
        footnote = (r.get("greater_risk_data_value_footnote") or "").strip() or None
        base = dict(
            geo_id=geo_id,
            measure_id=measure,
            period_start=date(year, 1, 1),
            period_end=date(year, 12, 31),
            period_kind="survey_year",
            period_label=str(year),
            year=year,
            source_locator=f"{asset.asset_id} {loc}",
            estimate_type="survey_estimate",
            extraction_method="csv_parser",
            comparability_group=f"yrbs_high_school|{measure}",
            source_code=r["questioncode"],
            raw_value=r["greater_risk_data_value"],
            raw_unit="percent",
            multiplier=1.0,
            footnote=footnote,
            extra={"question": r.get("greater_risk_question"), "location_code": r.get("locationabbr")},
        )
        if value is None:
            yield Staged(value=None, missing_reason="suppressed", **base)
            continue
        size = r.get("sample_size", "").strip()
        yield Staged(
            value=value,
            ci_low=_num(r.get("greater_risk_low_confidence_limit", "")),
            ci_high=_num(r.get("greater_risk_high_confidence_limit", "")),
            ci_level=0.95,
            sample_size=int(float(size)) if size else None,
            **base,
        )
