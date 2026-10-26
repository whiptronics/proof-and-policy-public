"""YRBSS high school estimates: state and national totals only, with confidence limits and sample sizes."""

from __future__ import annotations

from pathlib import Path

import pytest

from alcohol_data import paths
from alcohol_data.adapters.base import Rejected, Staged
from alcohol_data.adapters.cdc_yrbs import parse
from alcohol_data.config import AssetConfig

HEAD = (
    '"year","locationabbr","locationdesc","greater_risk_question","greater_risk_data_value",'
    '"greater_risk_data_value_footnote","greater_risk_low_confidence_limit","greater_risk_high_confidence_limit",'
    '"sample_size","sex","race","grade","questioncode","locationid","stratificationtype"'
)
ROWS = [
    '"2017","UT","Utah","Currently drank alcohol","8.9",,"7.4","10.6","1584","Total","Total","Total","H42","49","State"',
    '"2017","XX","United States","Currently drank alcohol","29.8",,"28.1","31.6","14765","Total","Total","Total","H42","59","National"',
    '"2017","SF","San Francisco, CA","Currently drank alcohol","17.0",,"15.0","19.0","2000","Total","Total","Total","H42","06","Local"',
    '"2017","TN","Tennessee","Currently drank alcohol",,"Data not available",,,"","Total","Total","Total","H42","47","State"',
]


def _asset() -> AssetConfig:
    return AssetConfig("yrbs", "cdc_yrbs", None, "GET", "e", "s", "v", "csv", "cdc_yrbs_high_school", "y.csv")


def _file(tmp_path: Path, rows=ROWS) -> Path:
    p = tmp_path / "y.csv"
    p.write_text("\n".join([HEAD, *rows]) + "\n", encoding="utf-8")
    return p


def test_state_and_national_totals_only_with_confidence_limits(tmp_path):
    items = list(parse(_asset(), _file(tmp_path)))
    assert not [i for i in items if isinstance(i, Rejected)]
    got = {s.geo_id: s for s in items if isinstance(s, Staged)}
    assert set(got) == {"state:49", "nation:us", "state:47"}  # the San Francisco district is not read
    ut = got["state:49"]
    assert (ut.value, ut.ci_low, ut.ci_high, ut.sample_size) == (8.9, 7.4, 10.6, 1584)
    assert ut.measure_id == "yrbs_current_alcohol_use_hs_pct" and ut.period_kind == "survey_year"
    tn = got["state:47"]
    assert tn.value is None and tn.missing_reason == "suppressed" and tn.footnote == "Data not available"


def test_a_subgroup_row_is_rejected_not_read_as_a_total(tmp_path):
    row = ROWS[0].replace('"Total","Total","Total"', '"Female","Total","Total"')
    items = list(parse(_asset(), _file(tmp_path, [row])))
    assert len(items) == 1 and isinstance(items[0], Rejected)


RAW = paths.ROOT / "data" / "raw" / "cdc_yrbs_hs_alcohol_totals"


@pytest.mark.skipif(not list(RAW.glob("*.csv")), reason="YRBS extract not in the raw cache")
def test_real_extract_reads_every_state_and_national_row():
    staged = [s for s in parse(_asset(), sorted(RAW.glob("*.csv"))[0]) if isinstance(s, Staged)]
    assert len(staged) == 913
    assert {s.year for s in staged if s.geo_id == "nation:us"} == set(range(1991, 2018, 2))
