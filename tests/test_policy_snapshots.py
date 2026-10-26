"""Dated policy snapshots: excerpt extraction, the snapshot table rules, and the coverage matrix."""

from __future__ import annotations

import csv
import importlib.util

import duckdb
import pytest

from alcohol_data import paths
from alcohol_data.policy_coverage import compute

ROOT = paths.ROOT
DB = ROOT / "data" / "processed" / "alcohol_data.duckdb"
needs_db = pytest.mark.skipif(not DB.is_file(), reason="full build not present in the checkout")

spec = importlib.util.spec_from_file_location("ps", ROOT / "scripts" / "policy_snapshots.py")
ps = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ps)


def test_excerpt_needs_the_exact_phrase_and_stays_local():
    text = ps.normalize(
        "Home Licensing Menu Item Item Item Overview A license allows grocery stores to sell wine. "
        "It is valid for one year. Other text."
    )
    ex = ps.excerpt_for(text, "allows grocery stores to sell wine")
    assert "allows grocery stores to sell wine" in ex and "Menu" not in ex
    assert (
        ps.excerpt_for(text, "allows grocery stores to sell spirits") is None
    )  # not found, never paraphrased
    assert ps.normalize("a b “q”") == 'a b "q"'


def test_snapshot_rows_are_well_formed():
    with open(ROOT / "data" / "curated" / "policy_snapshots.csv", encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))
    assert rows
    ids = [r["snapshot_id"] for r in rows]
    assert len(ids) == len(set(ids))
    for r in rows:
        assert r["legal_review_status"] in ("machine_assisted_review", "unreviewed") or r["reviewed_by"]
        if r["observed_precision"] == "year":
            assert not r["observed_on"]  # no invented day
        else:
            assert r["observed_on"].startswith(r["observed_year"])
        assert r["excerpt"].strip()


@pytest.fixture(scope="module")
def coverage():
    if not DB.is_file():
        pytest.skip("full build not present")
    con = duckdb.connect(str(DB), read_only=True)
    try:
        return {(r["policy_dimension"], r["geo_id"]): r for r in compute(con)}
    finally:
        con.close()


@needs_db
def test_snapshots_never_count_as_verified_history(coverage):
    ga = coverage[("ordinary_grocery_wine_authorization", "state:13")]
    assert ga["status"] == "snapshot_only" and ga["verified_days_since_2000"] == 0 and ga["snapshots"] >= 1
    va = coverage[("ordinary_grocery_wine_authorization", "state:51")]  # snapshots plus the version ledger
    assert va["status"] == "verified_history" and va["snapshots"] >= 1 and va["first_verified_day"]
    ut = coverage[("ordinary_grocery_wine_authorization", "state:49")]
    assert ut["status"] == "verified_history" and ut["verified_days_since_2000"] > 8000
    for r in coverage.values():  # status follows from the counts, never from the latest value
        if r["verified_days_since_2000"]:
            assert r["status"] == "verified_history"
        elif r["snapshots"]:
            assert r["status"] == "snapshot_only" and not r["first_verified_day"]
        else:
            assert r["status"] == "not_coded" and not r["latest_snapshot_value"]
    co = coverage[("ordinary_grocery_wine_authorization", "state:08")]
    assert co["latest_snapshot_on"] == 2024 and co["latest_snapshot_support"] == "no_outlet_restriction"


def test_excerpt_cut_lands_on_a_word_boundary():
    text = "Lead in. The license lets stores sell wine " + "and more words follow here " * 30
    ex = ps.excerpt_for(text, "The license lets stores sell wine")
    assert ex.endswith(" …") and ex.removesuffix(" …").split(" ")[-1] in (
        "and",
        "more",
        "words",
        "follow",
        "here",
    )
    assert len(ex) < 400


def test_support_basis_vocabulary_and_defaults():
    with open(ROOT / "data" / "curated" / "policy_snapshots.csv", encoding="utf-8", newline="") as f:
        rows = {r["snapshot_id"]: r for r in csv.DictReader(f)}
    assert {r["support_basis"] for r in rows.values()} <= {
        "explicit_text",
        "no_outlet_restriction",
        "indirect",
    }
    assert (
        rows["base_va_grocery_wine"]["support_basis"] == "explicit_text"
    )  # the statute names grocery stores
    assert (
        rows["base_ga_grocery_wine"]["support_basis"] == "indirect"
    )  # delivery guidance, not a license rule
    assert rows["base_ca_grocery_wine"]["support_basis"] == "no_outlet_restriction"


def test_anchored_find_reads_only_the_version_in_force():
    text = ps.normalize(
        "§ 9 Sales [Effective until Oct. 21, 2026]. Grocery stores may not sell wine. "
        "§ 9 Sales [Effective Oct. 21, 2026]. Grocery stores may sell wine."
    )
    region, problem = ps.section_region(
        text, "§ 9 Sales [Effective until Oct. 21, 2026]", "§ 9 Sales [Effective Oct"
    )
    assert problem is None and "may not sell wine" in region and "may sell wine." not in region
    assert ps.excerpt_for(region, "Grocery stores may sell wine") is None  # the later version is out of reach
    _, problem = ps.section_region(text, "§ 9 Sales [Effective Jan. 1, 2030]", None)
    assert problem and "anchor not found" in problem  # a missing anchor is a stop, never a fallback
    _, problem = ps.section_region(text, "§ 9 Sales [Effective until Oct. 21, 2026]", "§ 10")
    assert problem and "end anchor" in problem
