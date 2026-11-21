"""Chart titles for the grocery-wine graph package (scripts/grocery_wine_chart_text.py).

Every title is written from the exported numbers. These tests need the exports
(``npm --prefix web run export:grocery-wine`` and ``export:tennessee``) and skip without them.
"""

import importlib.util
import re
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
SPEC = importlib.util.spec_from_file_location(
    "gw_chart_text", ROOT / "scripts" / "grocery_wine_chart_text.py"
)
ct = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(ct)


def test_check_titles_rejects_universal_claims_and_unlabelled_models():
    bad = {
        "F1": ("Model: moving sales to grocers necessarily costs the state money", ""),
        "F2": ("Model: it only pays for itself through new consumption", ""),
        "U1": ("Grocery wine loses money", "There is no option that preserves both revenue and price"),
        "T1": ("Tennessee gained", ""),
    }
    errs = ct.check_titles(bad)
    assert any("F1" in e and "necessarily costs" in e for e in errs)
    assert any("F2" in e and "only pays for itself" in e for e in errs)
    assert any("U1" in e and "no option that preserves" in e for e in errs)
    assert any("U1" in e and "model" in e for e in errs)
    assert any("T1" in e and "observed" in e for e in errs)


@pytest.mark.skipif(not ct.FLOWS.exists(), reason="no export: run `npm --prefix web run export:grocery-wine`")
def test_flow_titles_pass_the_checks_and_follow_the_numbers():
    fl = ct.load_flows()
    t = ct.flow_titles(fl)
    assert ct.check_titles(t) == []
    assert all(t[f"F{i}"][0].startswith("Model") for i in range(1, 12))
    # F2 names the accounting-case range of the preserved designs from the export.
    nets = [ct.flow_net(fl, a, "accounting_30") for a in ct.PRESERVED]
    assert ct.money(min(nets)) in t["F2"][0] and ct.money(max(nets)) in t["F2"][0]
    # F3 counts the designs in which each source gains, from the decomposition.
    beer_up = sum(
        ct.flow_line(fl, a, "beer_5", "beer_to_wine")["value"] > 0 for a in ct.PRESERVED + ct.REDUCED
    )
    assert f"under {beer_up} of 5 designs" in t["F3"][0]


@pytest.mark.skipif(not (ct.UTAH.exists() and ct.PRICE_SHARE.exists()), reason="no export")
def test_old_price_response_titles_are_labelled_exploratory():
    t = {**ct.utah_titles(ct.load_utah()), **ct.price_share_titles(ct.load_price_share())}
    assert ct.check_titles(t) == []
    for k in ("U6", "U12"):
        assert "exploratory" in t[k][0].lower()


@pytest.mark.skipif(not (ct.UTAH.exists() and ct.FLOWS.exists()), reason="no export")
def test_headline_titles_lead_with_no_store_savings():
    d, fl = ct.load_utah(), ct.load_flows()
    u, f = ct.utah_titles(d), ct.flow_titles(fl)
    # The flows' no-savings figures in the accounting case equal the alternatives model's own zero-savings nets.
    for flow_id, alt_id in (
        ("preserved_dabs", "A_target"),
        ("preserved_private", "C_take"),
        ("preserved_dabs_matched", "A_matched"),
    ):
        zero = ct.alt(d, alt_id)["zero_savings_net"]
        saved = (
            fl["cost_lines_per_dollar"]["shortRun"]
            * ct.flow_result(fl, flow_id, "accounting_30")["origins"][0]["grocery"]["storeEquivalent"]
        )
        assert abs(ct.flow_net(fl, flow_id, "accounting_30") - saved - zero) < 1
    zeros = [ct.alt(d, a)["zero_savings_net"] for a in ("A_target", "C_take", "A_matched")]
    assert ct.money_range(zeros) in f["F2"][0]
    # The first dollar figure in each headline title is the one with no store savings.
    first = {
        k: re.search(r"\$[\d.,]+M", t[0]).group(0) for k, t in {**u, **f}.items() if k in ("U1", "U4", "F2")
    }
    assert first["U1"] == ct.money(ct.alt(d, "R2")["zero_savings_net"])[1:]
    assert first["U4"] == ct.money(ct.alt(d, "A_target")["zero_savings_net"])[1:]
    assert first["F2"] == ct.money(min(zeros))[1:]
    for k in ("U2", "S0"):
        assert "no store savings" in {**u, **f}[k][0]
