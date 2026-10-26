"""Tennessee Department of Revenue June collection reports: year-to-date page parsing.

The excerpt fixture is copied from the FY2017 report's fiscal-year-to-date page (page 8). Tests on the
full reports run when the checkout's raw cache holds them (they are not redistributed).
"""

from __future__ import annotations

from pathlib import Path

import pytest

from alcohol_data import paths
from alcohol_data.adapters.tn_dor_collections import (
    FY_HEADER,
    MEASURES,
    amount,
    parse_class,
    split_amounts,
    ytd_page,
)

FIX = Path(__file__).parent / "fixtures" / "tn_dor" / "ytd_page_fy2017_excerpt.txt"
RAW = paths.ROOT / "data" / "raw"


def test_amounts_keep_sign_and_survive_split_numbers():
    assert amount("(30,443.70)") == -30443.70
    assert amount("0.00") == 0.0
    assert split_amounts("53,3 43,312.35 55,507,944.78") == ["53,343,312.35", "55,507,944.78"]
    assert split_amounts("18,586,264. 58 (224,452.52) -1.26%") == ["18,586,264.58", "(224,452.52)"]
    assert split_amounts("1,519,546.04 1,435,256.95") == ["1,519,546.04", "1,435,256.95"]


def test_year_to_date_page_and_class_parse():
    text = FIX.read_text(encoding="utf-8")
    assert ytd_page(["June-17 monthly page without the header", text]) == (1, text)
    assert FY_HEADER.search(text).groups() == ("2016", "2017")
    rows, total = parse_class(text)
    codes = [r[0] for r in rows]
    assert codes[0] == "11001" and codes[-1] == "11018" and "10901" not in codes  # stops at the class TOTAL
    wine = {r[0]: r for r in rows}["11002"]
    assert wine[1] == "Wine Tax" and wine[2][:2] == ["13,958,492.25", "17,093,285.69"]
    current = sum(amount(r[2][1]) for r in rows)
    assert abs(current - amount(total[1])) < 0.01  # the class adds up to its printed TOTAL


def test_older_header_format_is_recognized():
    old = "SUMMARY OF COLLECTIONS\nJuly 2011 - June 2012   PAGE # 8\nCLASS OF TAX 2011 2012 GAIN OR LOSS PER CENT\nALCOHOLIC BEVERAGES\n"
    assert ytd_page([old]) is not None
    assert FY_HEADER.search(old).groups() == ("2011", "2012")


def test_relabelled_accounts_are_separate_measures():
    assert MEASURES[("11002", "Wine Tax")] != MEASURES[("11002", "Wine Tax & High Alcohol Beer")]
    assert "wine" not in MEASURES[("11002", "Wine Tax & High Alcohol Beer")]  # not wine-only
    assert ("11002", "Wine Tax (Food Store)") not in MEASURES  # an unknown label is rejected, not folded in


def _reports():
    out = {}
    for d in sorted(RAW.glob("tn_dor_collections_june_*")):
        pdfs = [p for p in d.glob("*.pdf")]
        if pdfs:
            out[int(d.name.rsplit("_", 1)[1])] = pdfs[0]
    return out


@pytest.mark.skipif(not _reports(), reason="Tennessee reports not in the checkout's raw cache")
def test_every_cached_report_parses_and_years_chain():
    import logging

    import pypdf

    logging.getLogger("pypdf").setLevel(logging.ERROR)
    current, prior = {}, {}
    for fy, pdf in sorted(_reports().items()):
        pages = [(p.extract_text() or "") for p in pypdf.PdfReader(str(pdf)).pages]
        found = ytd_page(pages)
        assert found, fy
        _, text = found
        assert FY_HEADER.search(text).groups() == (str(fy - 1), str(fy))
        rows, total = parse_class(text)
        assert abs(sum(amount(r[2][1]) for r in rows) - amount(total[1])) < 0.01 * len(rows), fy
        wine = {r[0]: r for r in rows}["11002"]
        current[fy], prior[fy] = amount(wine[2][1]), amount(wine[2][0])
    chained = [fy for fy in current if fy - 1 in current]
    assert chained
    for fy in chained:
        # the next report's prior-year column repeats the closing report's figure
        assert prior[fy] == pytest.approx(current[fy - 1], abs=0.01), fy
