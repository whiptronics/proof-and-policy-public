"""Completeness report: ranges, per-level spans, definition changes and series breaks."""

from __future__ import annotations

import csv

import duckdb
import pytest

from alcohol_data import paths
from alcohol_data.completeness import CONCEPTS_CSV, compute, ranges

DB = paths.ROOT / "data" / "processed" / "alcohol_data.duckdb"
needs_db = pytest.mark.skipif(not DB.is_file(), reason="full build not present in the checkout")


def test_ranges():
    assert ranges([]) == ""
    assert ranges([2001]) == "2001"
    assert ranges([2003, 2001, 2002, 2005, 2007, 2008]) == "2001-2003|2005|2007-2008"


def test_concept_map_covers_every_measure_once():
    with open(paths.METADATA_DIR / "measures.csv", encoding="utf-8", newline="") as f:
        measures = [r["measure_id"] for r in csv.DictReader(f)]
    with open(CONCEPTS_CSV, encoding="utf-8", newline="") as f:
        mapped = [r["measure_id"] for r in csv.DictReader(f)]
    assert sorted(mapped) == sorted(measures)


@pytest.fixture(scope="module")
def report():
    if not DB.is_file():
        pytest.skip("full build not present")
    con = duckdb.connect(str(DB), read_only=True)
    try:
        return compute(con)
    finally:
        con.close()


@needs_db
def test_definition_changes_are_reported_not_joined(report):
    _, breaks = report
    defs = {(b["concept_id"], b["year"]) for b in breaks if b["kind"] == "definition_change"}
    assert ("brfss_binge_drinking", 2006) in defs
    assert ("brfss_heavy_drinking", 2015) in defs
    assert ("tn_dor_account_11002", 2018) in defs  # wine only -> wine plus high-alcohol beer
    groups = {(b["measure_id"], b["year"]) for b in breaks if b["kind"] == "comparability_group_change"}
    assert ("brfss_drank_any_past_30d_pct", 2011) in groups
    assert ("pop_total_resident", 2020) in groups


@needs_db
def test_state_spans_ignore_longer_national_history(report):
    rows, _ = report
    t10 = {r["geo_id"]: r for r in rows if r["measure_id"] == "stc_alcoholic_beverages_sales_tax"}
    assert t10["nation:us"]["series_first_year"] < 1940
    assert t10["state:49"]["series_first_year"] >= 1940  # states start in the 1940s, not 1902


@needs_db
def test_a_known_gap_is_counted_as_absent_not_missing(report):
    rows, _ = report
    tn = next(r for r in rows if r["measure_id"] == "brfss_binge_5m_4f_pct" and r["geo_id"] == "state:47")
    assert "2024" in tn["absent_ranges"].split("|") and tn["missing_with_reason"] == 0
    assert tn["years_with_value"] + tn["absent_years"] + tn["missing_with_reason"] == tn["span_years"]
