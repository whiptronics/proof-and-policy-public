"""Policy catalog: structure of the curated files, and the conformance check on coded policies."""

from __future__ import annotations

import csv

import duckdb

from alcohol_data import paths
from alcohol_data.validation.checks import c_policy_catalog

CAT = paths.METADATA_DIR / "policy_catalog.csv"
VALS = paths.METADATA_DIR / "policy_catalog_values.csv"


def _read(p):
    with open(p, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def test_catalog_structure():
    dims = _read(CAT)
    vals = _read(VALS)
    sets = {v["value_set"] for v in vals}
    ids = [d["dimension_id"] for d in dims]
    assert len(ids) == len(set(ids))
    for d in dims:
        assert d["layer"] in ("state", "local"), d["dimension_id"]
        assert d["value_type"] in ("categorical", "numeric", "fraction", "text"), d["dimension_id"]
        if d["value_type"] == "categorical":
            assert d["value_set"] in sets, d["dimension_id"]
        else:
            assert d["value_format"], d["dimension_id"]
        if d["layer"] == "local" and d["statewide_counterpart"]:
            assert d["statewide_counterpart"] in ids  # local take-up points at the statewide permission
    domains = {d["domain"] for d in dims}
    for needed in (
        "retail_permission",
        "local_implementation",
        "retail_structure",
        "wholesale_structure",
        "tax",
        "markup",
        "sunday_sales",
        "sales_hours",
        "delivery",
    ):
        assert needed in domains
    # Statewide permission and local implementation are separate dimensions.
    assert {d["layer"] for d in dims if d["dimension_id"] == "grocery_wine_local_adoption_share"} == {"local"}
    assert {d["layer"] for d in dims if d["dimension_id"] == "ordinary_grocery_wine_authorization"} == {
        "state"
    }


def _con(events):
    con = duckdb.connect()
    con.execute(
        "CREATE TABLE policy_dimensions (dimension_id VARCHAR, value_type VARCHAR, value_set VARCHAR, value_format VARCHAR)"
    )
    con.execute("CREATE TABLE policy_dimension_values (value_set VARCHAR, value VARCHAR)")
    con.execute(
        "CREATE TABLE policy_snapshots (snapshot_id VARCHAR, policy_dimension VARCHAR, policy_value VARCHAR)"
    )
    con.execute(
        "CREATE TABLE policy_events (policy_id VARCHAR, policy_dimension VARCHAR, policy_value VARCHAR)"
    )
    for d in _read(CAT):
        con.execute(
            "INSERT INTO policy_dimensions VALUES (?, ?, ?, ?)",
            [d["dimension_id"], d["value_type"], d["value_set"] or None, d["value_format"] or None],
        )
    for v in _read(VALS):
        con.execute("INSERT INTO policy_dimension_values VALUES (?, ?)", [v["value_set"], v["value"]])
    for e in events:
        con.execute("INSERT INTO policy_events VALUES (?, ?, ?)", list(e))
    return con


def test_conformance_check_catches_bad_codings():
    good = [
        ("a", "ordinary_grocery_wine_authorization", "authorized_local_option"),
        ("b", "beer_excise_tax_per_31gal_barrel", "usd_13.10"),
        ("c", "grocery_wine_local_adoption_share", "share_0.412"),
        ("d", "beer_definition_max_alcohol", "max_5.0pct_abv_or_4.0pct_abw"),
    ]
    bad, _ = c_policy_catalog(_con(good))
    assert bad == []
    wrong = [
        ("e", "ordinary_grocery_wine_authorization", "allowed"),  # not in the value set
        ("f", "beer_excise_tax_per_31gal_barrel", "13.10"),  # numeric without its unit prefix
        ("g", "grocery_wine_local_adoption_share", "share_1.5"),  # a share above 1
        ("h", "grocery_cannabis_authorization", "authorized"),  # dimension not catalogued
    ]
    bad, _ = c_policy_catalog(_con(wrong))
    assert [b.split(":")[0] for b in bad] == ["e", "f", "g", "h"]
