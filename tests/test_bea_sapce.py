"""BEA PCE by state (SAPCE3): only line 28, checked by its words and unit, with BEA's footnote markers kept."""

from __future__ import annotations

import zipfile
from pathlib import Path

from alcohol_data.adapters.base import Rejected, Staged
from alcohol_data.adapters.bea_sapce import parse
from alcohol_data.config import AssetConfig

HEAD = "GeoFIPS,GeoName,Region,TableName,LineCode,IndustryClassification,Description,Unit,2023,2024"
LINE28 = '"Alcoholic beverages purchased for off-premises consumption","Millions of current dollars"'
ROWS = [
    f'"00000","United States", ,SAPCE3,28,"...",{LINE28},150000.0,155000.5',
    f'"49000","Utah",7,SAPCE3,28,"...",{LINE28},1400.1,1455.2',
    f'"47000","Tennessee",5,SAPCE3,28,"...",{LINE28},(D),3721.1',
    f'"91000","New England",1,SAPCE3,28,"...",{LINE28},9000,9100',
    '"49000","Utah",7,SAPCE3,27,"...","Food and beverages purchased for off-premises consumption","Millions of current dollars",9,9',
]
TAIL = ['"Last updated: September 26, 2026-- new statistics for 2025; revised statistics for 2018-2024."']


def _zip(tmp_path: Path, rows=ROWS, tail=TAIL) -> Path:
    p = tmp_path / "SAPCE.zip"
    with zipfile.ZipFile(p, "w") as z:
        z.writestr("SAPCE3__ALL_AREAS_1997_2024.csv", "\n".join([HEAD, *rows, *tail]) + "\n")
        z.writestr("SAPCE4__ALL_AREAS_1997_2024.csv", "not read\n")
    return p


def _asset() -> AssetConfig:
    return AssetConfig(
        "bea_sapce_test",
        "bea_regional",
        None,
        "GET",
        "e",
        "bea_sapce",
        "v",
        "zip",
        "bea_sapce3_alcohol",
        "SAPCE.zip",
    )


def test_reads_line_28_for_states_and_nation_in_dollars(tmp_path):
    items = list(parse(_asset(), _zip(tmp_path)))
    assert not [i for i in items if isinstance(i, Rejected)]
    got = {(s.geo_id, s.year): s for s in items if isinstance(s, Staged)}
    assert set(got) == {
        (g, y) for g in ("nation:us", "state:49", "state:47") for y in (2023, 2024)
    }  # no region, no line 27
    assert got[("state:49", 2024)].value == 1_455_200_000.0 and got[("state:49", 2024)].raw_value == "1455.2"
    tn = got[("state:47", 2023)]
    assert (tn.value, tn.missing_reason, tn.suppression_flag) == (None, "suppressed", "(D)")
    assert got[("nation:us", 2024)].extra["bea_release"].startswith("September 26, 2026")


def test_a_relabelled_line_28_or_a_missing_release_line_is_rejected(tmp_path):
    relabelled = [ROWS[1].replace("Millions of current dollars", "Thousands of current dollars")]
    items = list(parse(_asset(), _zip(tmp_path, rows=relabelled)))
    assert items and all(isinstance(i, Rejected) for i in items)
    items = list(parse(_asset(), _zip(tmp_path, tail=[])))
    assert len(items) == 1 and isinstance(items[0], Rejected) and "vintage" in items[0].reason
