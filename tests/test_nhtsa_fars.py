"""FARS: traffic deaths and alcohol-impaired-driving deaths from NHTSA's imputed driver BAC, and the check
against NHTSA's published state table."""

from __future__ import annotations

import json
import zipfile
from datetime import date
from pathlib import Path

import duckdb
import pytest

from alcohol_data import paths
from alcohol_data.adapters.base import Rejected, Staged
from alcohol_data.adapters.nhtsa_fars import parse_fars, parse_report
from alcohol_data.config import AssetConfig
from alcohol_data.validation.checks import r_fars

ACCIDENT = "﻿STATE,STATENAME,ST_CASE,FATALS\n49,Utah,490001,2\n49,Utah,490002,1\n49,Utah,490003,1\n47,Tennessee,470001,3\n"
# Highest DRIVER BAC, ten imputations, hundredths of g/dL. Crash 490003 has no driver row.
MIDRVACC = "ST_CASE,A1,A2,A3,A4,A5,A6,A7,A8,A9,A10\n490001,8,8,8,8,8,0,0,0,0,0\n490002,0,0,0,0,0,0,0,0,0,0\n470001,15,15,15,15,15,15,15,15,15,15\n"
# Highest BAC of anyone (pedestrians included): not the measure; set high so reading it would show.
MIACC = "ST_CASE,A1,A2,A3,A4,A5,A6,A7,A8,A9,A10\n490001,20,20,20,20,20,20,20,20,20,20\n490002,20,20,20,20,20,20,20,20,20,20\n490003,20,20,20,20,20,20,20,20,20,20\n470001,15,15,15,15,15,15,15,15,15,15\n"


def _asset(year=2020) -> AssetConfig:
    return AssetConfig(
        f"fars_{year}",
        "nhtsa_fars",
        None,
        "GET",
        "e",
        "nhtsa_fars",
        "v",
        "zip",
        "fars_national_csv",
        "f.zip",
        options={"year": year},
    )


def _zip(tmp_path: Path) -> Path:
    p = tmp_path / "FARS2020NationalCSV.zip"
    with zipfile.ZipFile(p, "w") as z:
        z.writestr("FARS2020NationalCSV/accident.csv", ACCIDENT)
        z.writestr("FARS2020NationalCSV/MIDRVACC.CSV", MIDRVACC)
        z.writestr("FARS2020NationalCSV/MIACC.CSV", MIACC)
    return p


def test_deaths_and_imputed_alcohol_impaired_driving_deaths(tmp_path):
    items = list(parse_fars(_asset(), _zip(tmp_path)))
    assert not [i for i in items if isinstance(i, Rejected)]
    got = {(s.geo_id, s.measure_id): s for s in items if isinstance(s, Staged)}
    assert got[("state:49", "fars_traffic_fatalities")].value == 4
    ut = got[("state:49", "fars_alcohol_impaired_driving_fatalities")]
    # Crash 490001 (2 deaths) is impaired in 5 of 10 imputations: 2 x 5 / 10 = 1.0. Pedestrian BACs do not count.
    assert ut.value == 1.0 and ut.extra["imputations"] == [2, 2, 2, 2, 2, 0, 0, 0, 0, 0]
    assert got[("state:47", "fars_alcohol_impaired_driving_fatalities")].value == 3.0
    assert got[("nation:us", "fars_traffic_fatalities")].value == 7
    assert got[("nation:us", "fars_alcohol_impaired_driving_fatalities")].value == 4.0
    assert ut.period_start == date(2020, 1, 1) and ut.estimate_type == "modeled_estimate"


def test_a_file_without_the_driver_imputation_is_rejected(tmp_path):
    p = tmp_path / "f.zip"
    with zipfile.ZipFile(p, "w") as z:
        z.writestr("accident.csv", ACCIDENT)
        z.writestr("MIACC.CSV", MIACC)
    items = list(parse_fars(_asset(), p))
    assert len(items) == 1 and isinstance(items[0], Rejected)


def _db(rows):
    con = duckdb.connect()
    con.execute(
        "CREATE TABLE observations (observation_id VARCHAR, geo_id VARCHAR, year INT, measure_id VARCHAR, value DOUBLE)"
    )
    con.execute("CREATE TABLE observation_details (observation_id VARCHAR, extra VARCHAR)")
    for i, (measure, geo_id, year, value, ver) in enumerate(rows):
        con.execute("INSERT INTO observations VALUES (?, ?, ?, ?, ?)", [str(i), geo_id, year, measure, value])
        con.execute(
            "INSERT INTO observation_details VALUES (?, ?)",
            [str(i), json.dumps({"fars_file_version": ver}) if ver else None],
        )
    return con


def test_check_fails_only_on_a_mismatch_with_a_final_file_table():
    ok = [
        ("fars_alcohol_impaired_driving_fatalities", "state:49", 2013, 36.5, None),
        (
            "nhtsa_published_alcohol_impaired_driving_fatalities",
            "state:49",
            2013,
            37.0,
            "FARS 2013 Final File",
        ),
        ("fars_traffic_fatalities", "state:49", 2022, 330.0, None),
        ("nhtsa_published_traffic_fatalities", "state:49", 2022, 319.0, "FARS 2022 ARF"),
    ]
    details, summary = r_fars(_db(ok))
    assert details == [] and "1 differences against tables built from an earlier" in summary
    bad = ok[:1] + [
        (
            "nhtsa_published_alcohol_impaired_driving_fatalities",
            "state:49",
            2013,
            40.0,
            "FARS 2013 Final File",
        )
    ]
    details, _ = r_fars(_db(bad))
    assert len(details) == 1


RAW = paths.ROOT / "data" / "raw"


def _cached(asset_id: str, pattern: str) -> Path | None:
    hits = sorted((RAW / asset_id).glob(pattern))
    return hits[0] if hits else None


@pytest.mark.skipif(
    _cached("fars_national_2013", "*.zip") is None
    or _cached("nhtsa_state_ai_estimates_2022", "*.pdf") is None,
    reason="FARS 2013 or the NHTSA report not in the raw cache",
)
def test_real_2013_final_file_reproduces_nhtsa_published_state_table():
    computed = {
        (s.geo_id, s.measure_id): s.value
        for s in parse_fars(_asset(2013), _cached("fars_national_2013", "*.zip"))
        if isinstance(s, Staged)
    }
    report = AssetConfig(
        "nhtsa_state_ai_estimates_2022",
        "nhtsa_fars",
        None,
        "GET",
        "e",
        "nhtsa_state_ai_report",
        "dot_hs_813579",
        "pdf",
        "nhtsa_state_ai_report",
        "r.pdf",
    )
    published = [
        s
        for s in parse_report(report, _cached("nhtsa_state_ai_estimates_2022", "*.pdf"))
        if isinstance(s, Staged)
    ]
    pub13 = [s for s in published if s.year == 2013]
    assert len(pub13) == 104 and {s.extra["fars_file_version"] for s in pub13} == {"FARS 2013 Final File"}
    for s in pub13:
        mine = computed[(s.geo_id, s.measure_id.replace("nhtsa_published_", "fars_"))]
        tolerance = 0.5 if "alcohol" in s.measure_id else 0
        assert abs(mine - s.value) <= tolerance, (s.geo_id, s.measure_id, mine, s.value)
