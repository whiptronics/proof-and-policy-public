"""The committed consumer access figures (web/src/lib/consumerAccess.generated.ts) match the pinned raw files.

Needs the DABS locator, SNAP retailer and Census center-of-population files under data/raw (``alcohol-data fetch``);
the drift test skips without them.
"""

import importlib.util
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
SPEC = importlib.util.spec_from_file_location("consumer_access", ROOT / "scripts" / "consumer_access.py")
ca = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(ca)

RAW = ROOT / "data" / "raw"  # the checkout's own raw cache (the tests' data home is a temporary folder)
HAVE_RAW = all((RAW / a).is_dir() for a in (ca.STATE_STORES, ca.AGENCIES, ca.SNAP, ca.CENPOP))

DAY = "<tr>\r\n<td>{d}</td>\r\n<td>{t}</td>\r\n</tr>"
OPEN = '<span><time datetime="11:00">11:00 AM</time> - <time datetime="22:00">10:00 PM</time></span>'


@pytest.mark.skipif(not HAVE_RAW, reason="no consumer access raw files: run `alcohol-data fetch`")
def test_generated_file_matches_the_raw_files():
    assert ca.OUT.read_text(encoding="utf-8") == ca.render(ca.measure(RAW))


def test_weekly_hours_reads_the_locator_table():
    table = "".join(DAY.format(d=d, t="Closed" if d == "Sunday" else OPEN) for d in ca.DAYS)
    assert ca.weekly_hours(table) == (66.0, False)
    with pytest.raises(ValueError):
        ca.weekly_hours(DAY.format(d="Monday", t=OPEN))


def test_summary_is_population_weighted():
    s = ca.summary([(1, 0.5), (1, 2.0), (2, 4.0)])
    assert s["median"] == 2.0 and s["mean"] == 2.62
    assert s["within"][:3] == [0.25, 0.5, 1.0]


def test_miles_is_great_circle():
    assert ca.miles((40.0, -111.0), (41.0, -111.0)) == pytest.approx(69.09, abs=0.01)
