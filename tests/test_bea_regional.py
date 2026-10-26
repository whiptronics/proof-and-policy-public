"""BEA state personal income (SAINC1): the layout, missing markers, and the file's own arithmetic."""

from __future__ import annotations

import csv
import io
import zipfile
from pathlib import Path

import pytest

from alcohol_data import paths
from alcohol_data.adapters.base import Rejected, Staged
from alcohol_data.adapters.bea_regional import MEMBER, parse
from alcohol_data.config import AssetConfig

HEAD = "GeoFIPS,GeoName,Region,TableName,LineCode,IndustryClassification,Description,Unit,1948,1949,1950"
ROWS = [
    '"00000","United States", ,SAINC1,1,"...","Personal income (millions of dollars) ","Millions of dollars",211495.0,209009.0,232835.6',
    '"00000","United States", ,SAINC1,2,"...","Population (persons) 1/","Number of persons",146091000,148666000,151871000',
    '"00000","United States", ,SAINC1,3,"...","Per capita personal income (dollars) 2/","Dollars",1448,1406,1533',
    '"02000","Alaska *",8,SAINC1,1,"...","Personal income (millions of dollars) ","Millions of dollars",(NA),(NA),231.0',
    '"02000","Alaska *",8,SAINC1,3,"...","Per capita personal income (dollars) 2/","Dollars",(NA),(NA),2384',
    '"98000","Far West *",8,SAINC1,3,"...","Per capita personal income (dollars) 2/","Dollars",1779,1761,1897',
]
TAIL = [
    '"Note: See the included footnote file."',
    '"Last updated: September 30, 2026-- revised statistics for 2009-2025."',
]


def _asset() -> AssetConfig:
    return AssetConfig(
        "bea_test", "bea_regional", None, "GET", "e", "bea_sainc", "v", "zip", "bea_sainc1", "t.zip"
    )


def _zip(tmp_path: Path, rows=ROWS, tail=TAIL) -> Path:
    p = tmp_path / "SAINC.zip"
    with zipfile.ZipFile(p, "w") as z:
        z.writestr("SAINC1__ALL_AREAS_1948_1950.csv", "\n".join([HEAD, *rows, *tail]) + "\n")
        z.writestr("SAINC4__ALL_AREAS_1948_1950.csv", "not read\n")
    return p


def test_reads_states_and_nation_not_regions_and_keeps_missing_markers(tmp_path):
    items = list(parse(_asset(), _zip(tmp_path)))
    assert not [i for i in items if isinstance(i, Rejected)]
    got = {(s.geo_id, s.measure_id, s.year): s for s in items if isinstance(s, Staged)}
    assert {g for g, _, _ in got} == {"nation:us", "state:02"}  # the Far West region is skipped
    assert not any(m == "pop" for _, m, _ in got)  # line 2 (population) is not read
    us = got[("nation:us", "bea_personal_income", 1950)]
    assert us.value == 232_835_600_000.0 and us.raw_value == "232835.6"
    assert us.extra["bea_release"].startswith("September 30, 2026")
    ak = got[("state:02", "bea_per_capita_personal_income", 1949)]
    assert ak.value is None and ak.missing_reason == "not_published" and ak.raw_value == "(NA)"


def test_a_file_without_its_release_line_is_rejected(tmp_path):
    items = list(parse(_asset(), _zip(tmp_path, tail=TAIL[:1])))
    assert len(items) == 1 and isinstance(items[0], Rejected) and "vintage" in items[0].reason


def test_a_relabelled_line_is_rejected_not_read(tmp_path):
    rows = [
        ROWS[0].replace("Personal income (millions of dollars)", "Personal income (thousands of dollars)")
    ]
    items = list(parse(_asset(), _zip(tmp_path, rows=rows)))
    assert items and all(isinstance(i, Rejected) for i in items)


RAW = paths.ROOT / "data" / "raw" / "bea_sainc_zip"


@pytest.mark.skipif(not list(RAW.glob("*-SAINC.zip")), reason="SAINC.zip not in the raw cache")
def test_per_capita_is_income_over_population_in_the_real_file():
    """Line 3 must equal line 1 / line 2 within rounding for every state and year read."""
    path = sorted(RAW.glob("*-SAINC.zip"))[0]
    zf = zipfile.ZipFile(path)
    name = next(n for n in zf.namelist() if MEMBER.match(n))
    rows = list(csv.reader(io.StringIO(zf.read(name).decode("utf-8-sig"))))
    header = rows[0]
    years = [i for i, h in enumerate(header) if h.isdigit()]
    by = {(r[0].strip().strip('"'), r[4].strip()): r for r in rows[1:] if len(r) == len(header)}
    checked = 0
    for (fips, line), r in by.items():
        if line != "1" or not fips.endswith("000"):
            continue
        pop, pc = by[(fips, "2")], by[(fips, "3")]
        for i in years:
            if "(" in r[i]:
                continue
            assert abs(float(r[i]) * 1e6 / float(pop[i]) - float(pc[i])) <= 1.0, (fips, header[i])
            checked += 1
    assert checked > 5000
    staged = [s for s in parse(_asset(), path) if isinstance(s, Staged)]
    assert len({s.geo_id for s in staged}) == 52  # 50 states, DC and the U.S.
