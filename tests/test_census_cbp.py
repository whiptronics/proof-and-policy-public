"""County Business Patterns state files: both layouts, withheld and noisy employment, the all-forms rows."""

from __future__ import annotations

import zipfile
from pathlib import Path

import pytest

from alcohol_data import paths
from alcohol_data.adapters.base import Rejected, Staged
from alcohol_data.adapters.census_cbp import emp_method, parse
from alcohol_data.config import AssetConfig

OLD_HEAD = '"fipstate","naics","empflag","emp","qp1","ap","est"'
OLD_ROWS = [
    '"01","445310",,914,3740,15489,296',
    '"02","445310","E",0,0,0,49',  # employment withheld: size range E, printed 0
    '"01","722410",,2105,4913,20482,366',
    '"01","445120",,10,10,10,3',  # not read
]
NEW_HEAD = '"fipstate","naics","lfo","emp_nf","emp","qp1_nf","qp1","ap_nf","ap","est"'
NEW_ROWS = [
    '"01","445310","C","H",140,"J",932,"H",3722,37',  # a legal-form row, listed first: not read
    '"01","445310","-","H",1541,"G",9531,"G",44597,434',
    '"02","445310","-","S",0,"S",0,"S",0,40',  # employment not published
    '"01","445110","-","G",5000,"G",1,"G",1,700',
]


def _asset(year: int) -> AssetConfig:
    return AssetConfig(
        f"cbp_{year}",
        "census_cbp",
        None,
        "GET",
        "e",
        "census_cbp_state",
        "v",
        "zip",
        "census_cbp_state",
        "f.zip",
        options={"year": year},
    )


def _zip(tmp_path: Path, year: int, head: str, rows: list[str]) -> Path:
    p = tmp_path / f"cbp{year % 100:02d}st.zip"
    with zipfile.ZipFile(p, "w") as z:
        z.writestr(f"cbp{year % 100:02d}st.txt", "\n".join([head, *rows]) + "\n")
    return p


def _split(items):
    items = list(items)
    return [i for i in items if isinstance(i, Staged)], [i for i in items if isinstance(i, Rejected)]


def test_old_layout_withheld_employment_is_missing_not_zero(tmp_path):
    staged, rejected = _split(parse(_asset(2003), _zip(tmp_path, 2003, OLD_HEAD, OLD_ROWS)))
    got = {(s.geo_id, s.measure_id): s for s in staged}
    assert got[("state:01", "cbp_establishments_naics_445310")].value == 296
    ak = got[("state:02", "cbp_employment_naics_445310")]
    assert ak.value is None and ak.missing_reason == "suppressed" and ak.extra["empflag"] == "E"
    assert got[("state:02", "cbp_establishments_naics_445310")].value == 49  # counts are never withheld
    assert not any("445120" in (s.source_code or "") for s in staged)
    emp = got[("state:01", "cbp_employment_naics_445310")]
    assert emp.period_kind == "point_in_time" and emp.period_start.isoformat() == "2003-03-12"
    assert emp.extra["naics_vintage"] == "NAICS 2002"
    # The synthetic file has 2 states, not 51: each industry is reported, not silently accepted.
    assert len(rejected) == 3 and all("expected 51" in r.reason for r in rejected)


def test_new_layout_reads_only_all_forms_rows_and_keeps_noise_flags(tmp_path):
    staged, rejected = _split(parse(_asset(2018), _zip(tmp_path, 2018, NEW_HEAD, NEW_ROWS)))
    assert not any("second all-forms row" in r.reason for r in rejected)
    al = [s for s in staged if s.geo_id == "state:01" and s.measure_id == "cbp_employment_naics_445310"]
    assert len(al) == 1 and al[0].value == 1541 and al[0].quality_flags == ["cbp_noise_moderate"]
    ak = next(s for s in staged if s.geo_id == "state:02" and s.measure_id == "cbp_employment_naics_445310")
    assert ak.value is None and ak.missing_reason == "not_published"
    assert not any(s.measure_id == "cbp_employment_supermarkets" for s in staged)  # establishments only
    assert al[0].comparability_group.endswith("noise_only")


def test_employment_method_groups_follow_the_disclosure_changes():
    assert [emp_method(y) for y in (2006, 2007, 2016, 2017)] == [
        "withheld_cells_no_noise",
        "noise_and_withheld_cells",
        "noise_and_withheld_cells",
        "noise_only",
    ]


RAW = paths.ROOT / "data" / "raw"


@pytest.mark.skipif(
    not list(RAW.glob("census_cbp_state_2023/*.zip")), reason="CBP files not in the raw cache"
)
def test_every_real_year_has_all_51_jurisdictions():
    for year in range(2000, 2024):
        hits = sorted(RAW.glob(f"census_cbp_state_{year}/*.zip"))
        assert hits, year
        staged, rejected = _split(parse(_asset(year), hits[0]))
        assert rejected == [], (year, rejected[:2])
        assert len(staged) == 51 * 5, year
