"""Policy evidence excerpts must be found in the documents they cite.

Runs against the pinned documents when they are present locally (after
'alcohol-data fetch' / 'import-asset'); skipped otherwise, e.g. in CI.
"""

import csv
import re

import pytest

from alcohol_data import paths
from alcohol_data.acquisition.fetch import load_pins, sha256_file
from alcohol_data.config import load_all_sources
from alcohol_data.legal.utah_session_laws import LINENO

REPO_RAW = paths.ROOT / "data" / "raw"

# Distinctive fragments of each enacted-text or current-code excerpt (OCR and markup tolerant).
FRAGMENTS = {
    "ev_tn_before_value": "prior to that date no retail food store may sell wine",
    "ev_tn_before_effective": "Section 1 of this act shall take effect upon becoming a law",
    "ev_tn_lo_nov2014": "no such referendum may be held prior to the regular November election in 2014",
    "ev_tn_lo_abv": "alcoholic content of eighteen percent",
    "ev_tn_lo_license": "has full-time law enforcement through a police or sheriff",
    "ev_tn_beer_value": "beginning July 1, 2014, a retail licensee holding a license issued under",
    "ev_tn_uwsl_value": "wine at less than cost to the retailer",
    "ev_tn_uwsl_start": "Section 30 of this act shall take effect July 1, 2016",
    "ev_ut_beer4_end": "take effect on November 1, 2019",
    "ev_ut_tax1385": "$13.85 per 31-gallon barrel",
    "ev_ut_wine_liquor_2014": "Liquor does not include beer",
    "ev_ut_wine_opbr_2014": "engaged in the retail sale of beer to a patron for consumption off the beer retailer's premises",
    "ev_ut_wine_import_2014": "into this state except to the extent authorized by this title to: (a) the department",
    "ev_ut_wine_manufacturer_2014": "manufacturing licensee may not sell liquor within the state except to: (a) the department",
    "ev_ut_wine_industry_rep": "may not sell liquor within the state except to: (i) the department",
    "ev_ut_wine_authorized_only": "an alcoholic product in any place, or at any day or time other than as authorized by this title",
    "ev_ut_beer4_2014": "not more than 4% of alcohol by volume or 3.2% by weight",
    "ev_ut_wine_local_beer_license": "issue, suspend, and revoke a local license to sell beer at retail for off-premise consumption",
    "ev_ut_pa_authority": "from premises other than those owned or leased by the state",
    "ev_ut_pa_host_business": "the type of establishment or business in which the package agency may be located",
    "ev_ut_beer5_20191101": "not more than 5% of alcohol by volume or 4% by weight",
    "ev_ut_tax1280_2014": "$12.80 per 31-gallon barrel for beer imported or manufactured",
    "ev_ut_tax1310_2019": "$13.10 per 31-gallon barrel for beer imported or manufactured",
    "ev_ut_wine_2011_commencement": "This bill takes effect on July 1, 2011",
    "ev_ut_wine_liquor_2011": "is considered liquor for purposes of this title",
    "ev_ut_wine_opbr_2011": "issue, suspend, and revoke a local license to sell beer at retail for off-premise consumption",
    "ev_ut_pa_authority_2011": "from premises other than those owned or leased by the state",
    "ev_ut_beer4_2011": "not more than 4% of alcohol by volume or 3.2% by weight",
    "ev_ut_tax1280_2011": "$12.80 per 31-gallon barrel for beer imported or manufactured",
    "ev_ut_tax1100_2003": "$11 per 31-gallon barrel for beer imported or manufactured: (A) before July 1, 2003",
    "ev_ut_tax1100_flat": "of $11 per 31-gallon barrel",
    "ev_ut_tax1280_start": "$12.80 per 31-gallon barrel for beer imported or manufactured: (A) on or after July 1, 2003",
    "ev_ut_tax1280_chain": "as last amended by Laws of Utah 2003, Chapter 307",
    "ev_ut_beer4_2003": "but not more than 4% of alcohol by volume or 3.2% by weight",
    "ev_ut_beer4_2009": "contains at least .5% of alcohol by volume, but not more than 4% of alcohol by volume",
    "ev_ut_beer4_crosswalk": "32A-1-105. Definitions",
    "ev_ut_wine_32a_general_rule": "or at any day or time other than as authorized by this title",
    "ev_ut_wine_32a_liquor": 'is considered "liquor" for purposes of this title',
    "ev_ut_wine_32a_beer_license": "licenses to businesses to sell beer at retail for off-premise consumption",
    "ev_ut_pa_32a_authority": "from premises other than those owned or leased by the state",
    "ev_ut_pa_32a_host_business": "the type of establishment or business in which the agency may be located",
    "ev_ut_tax1100_1992": "at the rate of $11 per 31-gallon barrel on all beer",
    "ev_va_wine_general_1997": "which shall authorize the licensee to sell wine and beer in closed containers",
    "ev_va_wine_general_2020": "which shall authorize the licensee to sell wine and beer in closed containers",
    "ev_va_wine_general_end": "shall become effective on July 1, 2021",
    "ev_va_wine_listed_start": "shall become effective on July 1, 2021",
    "ev_va_wine_listed_enacted": "gourmet oyster house, gourmet shop, grocery store, or marina store",
    "ev_va_wine_listed_2024": "gourmet oyster house, gourmet shop, grocery store, or marina store",
    "ev_va_wine_listed_current": "gourmet oyster house, gourmet shop, grocery store, or marina store",
    "ev_ar_wine_2017_value": "A grocery store wine permit allows a permittee to purchase and",
    "ev_ar_wine_2017_conditions": "county in which the retail sale of alcohol under",
    "ev_ar_wine_2017_start": "effective on October 1, 2017",
    # Utah liquor control (2026-10-10): retail by state stores and package agencies, wholesale by the department.
    "ev_ut_spirits_rt_state_stores": "for the sale of liquor by employees of the state",
    "ev_ut_wine_rt_state_stores": "for the sale of liquor by employees of the state",
    "ev_ut_spirits_rt_state_stores_2011": "The commission may establish state stores in the numbers and at places",
    "ev_ut_wine_rt_state_stores_2011": "The commission may establish state stores in the numbers and at places",
    "ev_ut_spirits_rt_package_agencies": "from premises other than those owned or leased by the state",
    "ev_ut_wine_rt_package_agencies": "from premises other than those owned or leased by the state",
    "ev_ut_spirits_wh_import_2014": "into this state except to the extent authorized by this title to: (a) the department",
    "ev_ut_wine_wh_import_2014": "into this state except to the extent authorized by this title to: (a) the department",
    "ev_ut_spirits_wh_manufacturer_2014": "manufacturing licensee may not sell liquor within the state except to: (a) the department",
    "ev_ut_wine_wh_manufacturer_2014": "manufacturing licensee may not sell liquor within the state except to: (a) the department",
    "ev_ut_spirits_wh_industry_rep": "may not sell liquor within the state except to: (i) the department",
    "ev_ut_wine_wh_industry_rep": "may not sell liquor within the state except to: (i) the department",
    "ev_ut_spirits_wh_2003": "A licensee may not sell any liquor within the state except to the department",
    "ev_ut_wine_wh_2003": "may not sell any liquor, wine, or heavy beer within the state except to the department",
}


def _norm(s: str) -> str:
    s = s.replace("§", " ").replace("’", "'")
    return re.sub(r"\s+", " ", re.sub(r"[^A-Za-z0-9$.,'()%-]+", " ", s)).strip().lower()


def _document_text(asset, path) -> str:
    if asset.format == "pdf":
        pypdf = pytest.importorskip("pypdf")
        return " ".join(page.extract_text() or "" for page in pypdf.PdfReader(str(path)).pages)
    raw = path.read_text(encoding="utf-8", errors="replace")
    # Enrolled Utah bills interleave printed line numbers with the text; drop them first.
    raw = LINENO.sub(" ", raw)
    return re.sub(r"<[^>]+>", " ", raw).replace("&nbsp;", " ").replace("&quot;", '"').replace("&amp;", "&")


@pytest.mark.parametrize("evidence_id,fragment", sorted(FRAGMENTS.items()))
def test_excerpt_found_in_cited_document(evidence_id, fragment):
    with open(paths.CURATED_DIR / "policy_evidence.csv", encoding="utf-8", newline="") as f:
        row = next((r for r in csv.DictReader(f) if r["evidence_id"] == evidence_id), None)
    assert row is not None, evidence_id
    assert (
        _norm(fragment) in _norm(row["excerpt_or_paraphrase"].replace("[", "").replace("]", ""))
        or row["evidence_strength"] != "enacted_text"
        or "struck" in row["excerpt_or_paraphrase"]
    ), evidence_id
    asset = next(a for s in load_all_sources().values() for a in s.assets if a.asset_id == row["asset_id"])
    pin = load_pins(paths.BUILDS_DIR / "preview.pins.json").get(asset.asset_id)
    # The test session redirects ALCOHOL_DATA_HOME to a temp dir; documents live in the checkout's cache.
    path = REPO_RAW / asset.asset_id / f"{pin['sha256'][:16]}-{asset.filename}" if pin else None
    if path is None or not path.is_file() or sha256_file(path) != pin["sha256"]:
        pytest.skip(f"{asset.asset_id} not present locally")
    assert _norm(fragment) in _norm(_document_text(asset, path)), (
        f"{evidence_id}: fragment not found in {asset.asset_id}"
    )
