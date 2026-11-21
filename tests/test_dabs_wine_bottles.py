"""The committed DABS wine bottle figures (web/src/lib/dabsWineBottles.generated.ts) match the raw sales reports.

Needs the twelve FY2026 Sales Analysis workbooks under data/raw (``alcohol-data fetch``); skips without them.
"""

import importlib.util
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
SPEC = importlib.util.spec_from_file_location("dabs_wine_bottles", ROOT / "scripts" / "dabs_wine_bottles.py")
wb = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(wb)

RAW = ROOT / "data" / "raw"  # the checkout's own raw cache (the tests' data home is a temporary folder)
HAVE_RAW = all(any((RAW / a).glob("*.xlsx")) for a in wb.asset_ids())


@pytest.mark.skipif(not HAVE_RAW, reason="no FY2026 sales workbooks: run `alcohol-data fetch`")
def test_generated_file_matches_the_reports():
    assert wb.OUT.read_text(encoding="utf-8") == wb.render(wb.totals(RAW))


def test_average_is_sales_over_bottles():
    tot = {"all": [100.0, 8.0], "750": [60.0, 4.0]}
    text = wb.render(tot)
    assert "averagePrice: 12.5 }" in text and "averagePrice: 15.0 }" in text
