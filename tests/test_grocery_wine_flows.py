"""The independent closed-form check of the grocery-wine purchase flows (scripts/grocery_wine_flows_check.py).

The closed forms are checked on small examples worked by hand. When the TypeScript export exists
(``npm --prefix web run export:grocery-wine``), every named scenario, grid point, break-even and sensitivity row in it
is recomputed and compared.
"""

import importlib.util
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "gw_flows_check", ROOT / "scripts" / "grocery_wine_flows_check.py"
)
flows_check = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(flows_check)


def test_closed_forms_match_hand_worked_examples():
    assert flows_check.hand_examples() == []


def test_break_even_classifies_each_case():
    base = {
        "wine": {"value": 100.0, "litres": 10.0, "price": 10.0, "abv": 0.1, "household": 0.5, "margin": 0.5},
        "spirits": {"value": 0.0, "litres": 0.0, "price": 20.0, "abv": 0.4, "household": 0.5, "margin": 0.5},
        "heavyBeer": {
            "value": 0.0,
            "litres": 0.0,
            "price": 5.0,
            "abv": 0.07,
            "household": 0.5,
            "margin": 0.4,
        },
        "beer": {
            "value": 200.0,
            "litres": 100.0,
            "price": 2.0,
            "abv": 0.05,
            "household": 1.0,
            "margin": 0.0,
            "excisePerLitre": 0.1,
        },
        "salesTax": 0.05,
        "rates": {"school": 0.1, "enforcement": 0.0},
    }
    none = {"participation": 0.0, "intensity": 0.0, "weight": 1.0, "basis": "pure_alcohol", "grocery": 1.0}
    x = {
        "migration": 0.2,
        "convenienceLimit": None,
        "declined": {"dabs": 1.0, "beer": 0.0, "outOfState": 0.0, "none": 0.0},
        "beer": {**none, "heavyShare": 0.0},
        "spirits": dict(none),
        "recapture": {"share": 0.0, "grocery": 1.0},
        "additional": {"share": 0.0, "grocery": 1.0},
        "costs": {
            "variable": 0.0,
            "handling": 0.0,
            "admin": 0.0,
            "licenseReceipts": 0.0,
            "restructuring": 0.0,
        },
        "migrantResponse": None,
    }
    kept = {
        "supply": "dabs",
        "stateCollection": 0.5,
        "shelf": 1.0,
        "salesTaxBase": 1.0,
        "consumerRatio": 1.0,
        "dabsRevenuePerDollar": 1.0,
    }
    cut = dict(kept, stateCollection=0.3)
    # The same collection at the same price: nothing changes, so no lever is needed.
    assert flows_check.break_even(base, kept, x, "additional") == ("already_above", 0.0)
    # A smaller collection, with a new administration cost so that moving nothing is below break-even: more migration
    # only loses more.
    with_admin = dict(x, costs=dict(x["costs"], admin=1.0))
    assert flows_check.break_even(base, cut, with_admin, "migration")[0] == "wrong_direction"
    # The same, but additional wine can pay for it: 0.35 a dollar against a loss of 10 x 0.2 + 1 = 3, 3 / 0.35 / 50.
    status, value = flows_check.break_even(base, cut, with_admin, "additional")
    assert status == "found" and value == pytest.approx(3 / 0.35 / 50)
    # Nobody moves at a 40% premium with a 20% convenience limit: migration changes nothing.
    dear = dict(cut, shelf=1.4, salesTaxBase=1.4, consumerRatio=1.4)
    assert (
        flows_check.break_even(
            base, dear, dict(x, convenienceLimit=0.2, costs=dict(x["costs"], admin=1.0)), "migration"
        )[0]
        == "no_effect"
    )


def test_export_agrees_with_the_closed_forms():
    if not flows_check.DEFAULT.exists():
        pytest.skip("no export: run `npm --prefix web run export:grocery-wine`")
    errs, counts = flows_check.check(flows_check.DEFAULT)
    assert errs == []
    assert counts["scenarios"] > 0 and counts["break-evens"] > 0
