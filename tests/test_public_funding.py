"""The committed public funding figures (web/src/lib/publicFunding.generated.ts) match the pinned raw files.

Needs the DABS, Utah Code, legislature, Census, NAEP, BLS, USDA, USBE, Tennessee, Colorado and NIAAA files under
data/raw (``alcohol-data fetch``); the drift test skips without them. The parsing and quote checks run without them.
"""

import importlib.util
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
SPEC = importlib.util.spec_from_file_location("public_funding", ROOT / "scripts" / "public_funding.py")
pf = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(pf)

RAW = ROOT / "data" / "raw"  # the checkout's own raw cache (the tests' data home is a temporary folder)
ASSETS = (
    {r["asset"] for r in pf.LAW}
    | {v[0] for v in pf.FY2025_VERSION.values()}
    | {
        pf.SUMTABLES,
        pf.UNITS,
        pf.CPI,
        "ut_olrgc_school_meals_2025",
        "ut_sb0180s01_2026_fiscal_note",
        pf.NSLP,
        pf.USBE_PPE,
        pf.TN_MANUAL,
        pf.TN_ACT,
        pf.CO_LAW,
        pf.NIAAA,
        pf.TEACHER_PAY,
        pf.USBE_SALARIES,
        pf.SNMCS,
        pf.SUPPLIES_LAW,
        pf.UHP_COSTS,
        *pf.CAPITAL_OUTLAY,
    }
    | {f"tn_dor_collections_june_{fy}" for fy in range(2012, 2026)}
)
HAVE_RAW = all((RAW / a).is_dir() for a in ASSETS)


@pytest.mark.skipif(not HAVE_RAW, reason="no public funding raw files: run `alcohol-data fetch`")
def test_generated_file_matches_the_raw_files():
    assert pf.OUT.read_text(encoding="utf-8") == pf.render(pf.measure(RAW))


def test_amounts_read_as_printed():
    assert pf._amount("551,346", "1000") == 551_346_000
    assert pf._amount("(291,057)", "-1000") == 291_057_000
    assert pf._amount("(86,151)", "1000") == -86_151_000
    assert pf._amount("-", "1000") is None


def test_a_quote_missing_from_the_saved_text_fails():
    pf.require("deposit 10% of the total gross revenue", "10% of the total gross revenue", "test")
    with pytest.raises(ValueError):
        pf.require("deposit 11% of the total gross revenue", "10% of the total gross revenue", "test")


def test_destinations_and_dabs_figures_come_from_the_curated_transcription():
    d = pf.dabs(pf.dabs_rows())
    assert d["sales"] == 551_346_000
    assert round(d["destinationsSum"] / 1e5) / 10 == 204.5
    assert {c["label"] for c in d["conflicts"]} == {"Other income", "Total revenue"}
    assert next(b for b in d["bridge"] if b["id"] == "nonop_rest")["kind"] == "unreconciled"


def test_a_duplicated_charge_fails_the_reconciliation_and_rounding_does_not():
    rows = pf.dabs_rows()
    keys = [k for k in rows if k[1] == "ut_dabs_total_operating_expenses" and k[2] == 2025]
    assert keys
    doubled = dict(rows) | {k: dict(rows[k], value=rows[k]["value"] * 2) for k in keys}
    with pytest.raises(ValueError, match="page 30"):
        pf.dabs(doubled)
    within = dict(rows) | {k: dict(rows[k], value=rows[k]["value"] + 0.4 * pf.TOLERANCE) for k in keys}
    pf.dabs(within)


def test_the_fy2025_versions_cover_the_whole_fiscal_year():
    for asset, effective, superseded in pf.FY2025_VERSION.values():
        assert asset.startswith("law_ut_32b_2_")
        assert effective <= "2024-07-01"
        assert superseded is None or superseded >= "2025-07-01"
