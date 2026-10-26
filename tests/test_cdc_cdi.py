"""CDC Chronic Disease Indicators: footnote symbols, the rows read and skipped, and duplicate cells."""

from __future__ import annotations

import csv
from pathlib import Path

from alcohol_data.adapters.base import Rejected, Staged
from alcohol_data.adapters.cdc_cdi import NEED, parse
from alcohol_data.config import AssetConfig

LIVER = dict(
    QuestionID="ALC09",
    DataSource="NVSS",
    Question="Chronic liver disease mortality",
    DataValueUnit="cases per 100,000",
    DataValueType="Age-adjusted Rate",
)
BINGE = dict(
    QuestionID="ALC06",
    DataSource="BRFSS",
    Question="Binge drinking prevalence among adults",
    DataValueUnit="%",
    DataValueType="Age-adjusted Prevalence",
)


def _row(base, loc, year, value="", symbol="", note="", strat="Overall", year_end=None, **kw):
    r = dict.fromkeys(NEED, "")
    r.update(base)
    r.update(
        YearStart=str(year),
        YearEnd=str(year_end or year),
        LocationAbbr=loc,
        Topic="Alcohol",
        DataValue=value,
        DataValueFootnoteSymbol=symbol,
        DataValueFootnote=note,
        StratificationCategory1=strat,
        Stratification1="Overall" if strat == "Overall" else "Male",
        LowConfidenceLimit="",
        HighConfidenceLimit="",
    )
    r.update(kw)
    return r


def _csv(tmp_path: Path, rows) -> Path:
    p = tmp_path / "cdi.csv"
    with open(p, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=[*NEED, "Response"])
        w.writeheader()
        for r in rows:
            w.writerow(r)
    return p


def _asset() -> AssetConfig:
    return AssetConfig(
        "cdi_test", "cdc_cdi", None, "manual_import", "e", "cdc_cdi", "v", "csv", "cdc_cdi_alcohol", "cdi.csv"
    )


def _parse(tmp_path, rows):
    return list(parse(_asset(), _csv(tmp_path, rows)))


def test_values_footnotes_and_zero_are_kept_apart(tmp_path):
    items = _parse(
        tmp_path,
        [
            _row(LIVER, "UT", 2021, "11.6", LowConfidenceLimit="10.4", HighConfidenceLimit="12.9"),
            _row(LIVER, "WY", 2021, "", "****", "Suppressed: fewer than 20 deaths"),
            _row(LIVER, "VT", 2021, "", "*", "No data available"),
            _row(BINGE, "DC", 2021, "0.0", "##"),
            _row(LIVER, "US", 2021, "13.9"),
        ],
    )
    assert not [i for i in items if isinstance(i, Rejected)]
    got = {(s.geo_id, s.measure_id): s for s in items if isinstance(s, Staged)}
    ut = got[("state:49", "cdi_chronic_liver_disease_mortality_age_adjusted_rate")]
    assert (ut.value, ut.ci_low, ut.ci_high, ut.period_label) == (11.6, 10.4, 12.9, "2021")
    wy = got[("state:56", "cdi_chronic_liver_disease_mortality_age_adjusted_rate")]
    assert (wy.value, wy.missing_reason, wy.suppression_flag) == (None, "suppressed", "****")
    vt = got[("state:50", "cdi_chronic_liver_disease_mortality_age_adjusted_rate")]
    assert (vt.value, vt.missing_reason) == (None, "unavailable")
    dc = got[("state:11", "brfss_binge_age_adjusted_pct")]
    assert dc.value == 0.0 and dc.missing_reason is None  # "##" is a reported zero, not a gap
    assert got[("nation:us", "cdi_chronic_liver_disease_mortality_age_adjusted_rate")].value == 13.9


def test_skips_us_brfss_territories_pooled_years_and_break_outs(tmp_path):
    items = _parse(
        tmp_path,
        [
            _row(BINGE, "US", 2021, "16.5"),  # national estimate or median of states? the export does not say
            _row(LIVER, "GU", 2021, "20.0"),
            _row(LIVER, "UT", 2019, "9.0", year_end=2021),
            _row(LIVER, "UT", 2021, "12.0", strat="Sex"),
        ],
    )
    assert items == []


def test_cross_check_items_are_staged_only_with_a_value(tmp_path):
    """CDI's copy of BRFSS crude binge drinking is a cross-check. An empty row would become the preferred
    row wherever BRFSS has none (New Jersey 2019) and put a false change of source into the BRFSS series."""
    crude = {**BINGE, "DataValueType": "Crude Prevalence"}
    items = _parse(
        tmp_path,
        [
            _row(crude, "NJ", 2019, "", "*", "No data available"),
            _row(crude, "NJ", 2020, "", "~"),
            _row(crude, "UT", 2021, "11.0"),
            _row(BINGE, "NJ", 2019, "", "*"),  # the age-adjusted item is CDI's own: its gap is kept
        ],
    )
    got = {(s.geo_id, s.measure_id, s.year): s for s in items if isinstance(s, Staged)}
    assert set(got) == {
        ("state:49", "brfss_binge_5m_4f_pct", 2021),
        ("state:34", "brfss_binge_age_adjusted_pct", 2019),
    }
    assert got[("state:34", "brfss_binge_age_adjusted_pct", 2019)].missing_reason == "unavailable"


def test_a_second_row_for_the_same_cell_is_rejected_not_overwritten(tmp_path):
    items = _parse(tmp_path, [_row(LIVER, "UT", 2021, "11.6"), _row(LIVER, "UT", 2021, "99.9")])
    staged = [i for i in items if isinstance(i, Staged)]
    rejected = [i for i in items if isinstance(i, Rejected)]
    assert [s.value for s in staged] == [11.6] and len(rejected) == 1 and "second row" in rejected[0].reason


def test_contradictions_are_rejected(tmp_path):
    items = _parse(
        tmp_path,
        [
            _row(LIVER, "UT", 2021, "5.0", "****"),  # says suppressed but has a value
            _row(BINGE, "UT", 2021, "3.0", "##"),  # says zero but is not
            _row({**LIVER, "DataValueUnit": "per 1,000"}, "ID", 2021, "4.0"),
            _row(LIVER, "NV", 2021, "4.0", "?"),
        ],
    )
    assert len(items) == 4 and all(isinstance(i, Rejected) for i in items)
