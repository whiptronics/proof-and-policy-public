"""The committed package agency grid (web/src/lib/packageAgencyGrid.generated.ts) matches DABS's PDF.

Needs the PDF under data/raw (``alcohol-data fetch --only utah_dabs_pa_compensation_fy2027``); skips without it.
"""

import importlib.util
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
SPEC = importlib.util.spec_from_file_location(
    "dabs_package_agency_grid", ROOT / "scripts" / "dabs_package_agency_grid.py"
)
pg = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(pg)

RAW = ROOT / "data" / "raw"  # the checkout's own raw cache (the tests' data home is a temporary folder)
HAVE_RAW = any((RAW / pg.ASSET).glob("*.pdf"))


@pytest.mark.skipif(not HAVE_RAW, reason="no package agency PDF: run `alcohol-data fetch`")
def test_generated_file_matches_the_pdf():
    grid = pg.read(RAW)
    assert len(grid["steps"]) == 15 and [c["id"] for c in grid["classes"]] == list("ABCDEFG")
    assert pg.OUT.read_text(encoding="utf-8") == pg.render(grid)


def test_render_writes_open_ends_as_null():
    grid = {
        "revision": "07-2026",
        "classes": [{"id": "A", "minPrice": None, "maxPrice": 3.0}],
        "steps": [{"step": 1, "minBottles": 0, "maxBottles": None, "pay": [5100]}],
    }
    text = pg.render(grid)
    assert '{ id: "A", minPrice: null, maxPrice: 3.0 }' in text
    assert "{ step: 1, minBottles: 0, maxBottles: null, pay: [5100] }" in text
