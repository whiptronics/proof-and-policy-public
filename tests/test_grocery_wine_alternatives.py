"""The independent closed-form check of the Utah grocery-wine alternatives.

The closed forms are checked on small examples worked by hand. When the TypeScript export exists
(``npm --prefix web run export:grocery-wine``), every alternative in it is recomputed and compared.
"""

import importlib.util
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "gw_check", ROOT / "scripts" / "grocery_wine_alternatives_check.py"
)
gw_check = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(gw_check)


def test_closed_forms_match_hand_worked_examples():
    assert gw_check.hand_examples() == []


def test_export_agrees_with_the_closed_forms():
    if not gw_check.DEFAULT.exists():
        pytest.skip("no export: run `npm --prefix web run export:grocery-wine`")
    assert gw_check.check(gw_check.DEFAULT) == []


def test_price_share_closed_forms_match_hand_worked_examples():
    assert gw_check.grid_hand_examples() == []


def test_price_share_grid_agrees_with_the_closed_forms():
    if not gw_check.GRID_DEFAULT.exists():
        pytest.skip("no export: run `npm --prefix web run export:grocery-wine`")
    assert gw_check.check_grid(gw_check.GRID_DEFAULT, gw_check.DEFAULT) == []
