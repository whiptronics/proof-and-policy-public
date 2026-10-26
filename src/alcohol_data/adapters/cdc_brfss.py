"""CDC BRFSS prevalence data (data.cdc.gov), alcohol consumption class, Overall break-out.

Published state crude prevalence estimates with 95% confidence limits. No
microdata are used. Rules enforced here:

* each published calculated variable maps to a measure through a versioned
  crosswalk (metadata/variable_crosswalks/brfss_alcohol.csv); a definition change
  (e.g. binge 5+ for everyone -> 5 men / 4 women) is a different measure;
* 2011 is a comparability break: estimates before and after are in different
  comparability groups and must not be drawn as one uninterrupted trend;
* the first year of each new variable version is flagged;
* 'US' and 'UW' rows are medians of state estimates, not national estimates, and
  territories (PR, GU, VI) are outside the default panel, so all are skipped.
"""

from __future__ import annotations

import csv
import io
from datetime import date
from pathlib import Path

from alcohol_data import paths
from alcohol_data.adapters.base import Rejected, Staged, register, state_geo
from alcohol_data.config import AssetConfig

CROSSWALK = paths.METADATA_DIR / "variable_crosswalks" / "brfss_alcohol.csv"
SKIP_LOCATIONS = {
    "US": "median of states and territories",
    "UW": "median of states and DC",
    "PR": "territory",
    "GU": "territory",
    "VI": "territory",
}


def load_crosswalk(path: Path = CROSSWALK) -> dict[str, dict]:
    with open(path, encoding="utf-8", newline="") as f:
        return {r["questionid"]: r for r in csv.DictReader(f)}


def comparability_group(measure_id: str, year: int) -> str:
    return f"{measure_id}|brfss_{'1995_2010' if year < 2011 else '2011_onward'}"


def _f(s: str) -> float | None:
    s = (s or "").strip()
    return float(s) if s else None


@register("cdc_brfss_prevalence", "1.0")
def parse(asset: AssetConfig, path: Path):
    xwalk = load_crosswalk()
    text = path.read_text(encoding="utf-8")
    rows = list(csv.DictReader(io.StringIO(text)))
    # first year each measure appears under each variable version (across all states)
    version_first_year: dict[tuple[str, str], int] = {}
    for r in rows:
        q = r["questionid"]
        if q in xwalk:
            k = (xwalk[q]["measure_id"], q)
            version_first_year[k] = min(version_first_year.get(k, 9999), int(r["year"]))
    measure_first_year: dict[str, int] = {}
    for (m, _q), y in version_first_year.items():
        measure_first_year[m] = min(measure_first_year.get(m, 9999), y)

    for i, r in enumerate(rows, start=2):
        loc = f"csv row {i}"
        q = r["questionid"]
        x = xwalk.get(q)
        if x is None:
            yield Rejected(loc, f"questionid {q} not in crosswalk", raw_value=r.get("question", "")[:80])
            continue
        if r["responseid"] != x["positive_response_id"]:
            continue  # complement ("No") rows are not stored
        if r["response"] != x["positive_response_text"]:
            yield Rejected(loc, f"response text {r['response']!r} does not match crosswalk for {q}")
            continue
        abbr = r["locationabbr"]
        if abbr in SKIP_LOCATIONS:
            continue
        fips = r["locationid"].strip().zfill(2)
        if (
            r["break_out"] != "Overall"
            or r["data_value_type"] != "Crude Prevalence"
            or r["data_value_unit"] != "%"
        ):
            yield Rejected(loc, "unexpected break-out, value type or unit")
            continue
        year = int(r["year"])
        measure = x["measure_id"]
        value = _f(r["data_value"])
        flags = []
        if year == 2011:
            flags.append("method_break_2011_first_year")
        if version_first_year[(measure, q)] == year and measure_first_year[measure] != year:
            flags.append("variable_version_change")
        missing = None
        if value is None:
            missing = "suppressed" if r["data_value_footnote_symbol"] else "not_published"
        yield Staged(
            geo_id=state_geo(fips),
            measure_id=measure,
            period_start=date(year, 1, 1),
            period_end=date(year, 12, 31),
            period_kind="survey_year",
            period_label=str(year),
            year=year,
            value=value,
            missing_reason=missing,
            source_locator=f"{loc} (year={year}, locationabbr={abbr}, questionid={q}, responseid={r['responseid']})",
            estimate_type="survey_estimate",
            extraction_method="api",
            comparability_group=comparability_group(measure, year),
            quality_flags=flags,
            source_code=q,
            raw_value=r["data_value"],
            raw_unit="percent",
            multiplier=1.0,
            ci_low=_f(r["confidence_limit_low"]),
            ci_high=_f(r["confidence_limit_high"]),
            ci_level=0.95 if r["confidence_limit_low"] else None,
            sample_size=int(r["sample_size"]) if r["sample_size"].strip() else None,
            suppression_flag=r["data_value_footnote_symbol"] or None,
            footnote=r["data_value_footnote"] or None,
            extra={"locationabbr": abbr, "data_value_type": r["data_value_type"]},
        )
