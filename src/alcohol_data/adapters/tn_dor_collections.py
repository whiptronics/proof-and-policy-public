"""Tennessee Department of Revenue, monthly "Summary of Collections" reports (June editions).

Each June report has a fiscal-year-to-date page headed "July <year>-June <yy>" (FY2014 on; "July <year> -
June <year>" before) with columns "FY <prior> FY <current> ..." (plain years before FY2014), listing collections by account code under class-of-tax
headings. The ALCOHOLIC BEVERAGES class carries the wine accounts this adapter reads:

* 11002, printed "Wine Tax" through the FY2017 report and "Wine Tax & High Alcohol Beer" from the FY2018
  report. The two labels are kept as two measures: the later one is not wine-only.
* 11013, printed "Wine Tax" through FY2017 and "Wine Tax (Winery)" from FY2018 (the winery account).
* 11018 "Wine Enforcement Tax".
* the class TOTAL (every ALCOHOLIC BEVERAGES account, including licenses and brand registration).

Only the current fiscal-year column of each report is read, so every fiscal year has one value from the
report that closed it. Amounts are collections received July-June (collections basis), as printed, before
any distribution to local governments. Text comes from the PDF's own text layer; a number split by a stray
space is rejoined by its comma and two-decimal structure, and every class is checked: its account lines
must add up to its printed TOTAL, or the whole class is rejected for review.
"""

from __future__ import annotations

import logging
import re
from pathlib import Path

from alcohol_data.adapters.base import Rejected, Staged, register, state_geo
from alcohol_data.config import AssetConfig
from alcohol_data.fiscal import fiscal_period_for

TN = state_geo("47")
YTD_HEADER = re.compile(r"July\s+\d{4}\s*-\s*June\s+(?:\d{4}|\d{2})", re.I)
FY_HEADER = re.compile(r"CLASS OF TAX\s+(?:FY\s*)?(\d{4})\s+(?:FY\s*)?(\d{4})")
LINE = re.compile(r"^\s*(\d{5})\s+(.*?)\s+(?=\(?-?[\d,]+\.\d)")
AMOUNT = re.compile(r"\(?-?\d{1,3}(?:,\d{3})*\.\d{2}\)?")
CLASS_HEADING = re.compile(r"^[A-Z][A-Z ,.&()/'-]+$")

# (account code, label as printed) -> measure. Unknown labels for these codes are rejected, so a relabelling
# is noticed instead of being folded into an existing series.
MEASURES = {
    ("11002", "Wine Tax"): "tn_dor_wine_tax_collections",
    ("11002", "Wine Tax & High Alcohol Beer"): "tn_dor_account_11002_with_high_alcohol_beer",
    ("11013", "Wine Tax"): "tn_dor_winery_wine_tax_collections",
    ("11013", "Wine Tax (Winery)"): "tn_dor_winery_wine_tax_collections",
    ("11018", "Wine Enforcement Tax"): "tn_dor_wine_enforcement_tax_collections",
}
WATCHED = {code for code, _ in MEASURES}
CLASS_TOTAL_MEASURE = "tn_dor_alcoholic_beverages_class_total"


def amount(text: str) -> float:
    neg = text.startswith("(") or text.startswith("-")
    v = float(text.strip("()").lstrip("-").replace(",", ""))
    return -v if neg else v


def split_amounts(tail: str) -> list[str]:
    """Amounts in the numeric tail of a line. Spaces are dropped first, because the text layer sometimes
    splits a number ("53,3 43,312.35"); the comma groups and two decimals then mark where each one ends.
    A trailing percentage (the GAIN OR LOSS PERCENT column) is dropped first."""
    if "%" in tail:
        tail = tail[: tail.index("%")].rstrip()
        tail = tail[: tail.rfind(" ")] if " " in tail else ""
    return AMOUNT.findall(tail.replace(" ", ""))


def ytd_page(pages: list[str]) -> tuple[int, str] | None:
    for i, t in enumerate(pages):
        if YTD_HEADER.search(t) and FY_HEADER.search(t) and "ALCOHOLIC BEVERAGES" in t:
            return i, t
    return None


def parse_class(
    text: str, heading: str = "ALCOHOLIC BEVERAGES"
) -> tuple[list[tuple[str, str, list[str]]], list[str] | None]:
    """Account lines (code, label, amounts) and the TOTAL amounts of one class of tax on the page."""
    lines = text.splitlines()
    try:
        start = next(i for i, line in enumerate(lines) if line.strip() == heading)
    except StopIteration:
        return [], None
    rows, total = [], None
    for line in lines[start + 1 :]:
        s = line.strip()
        if s.startswith("TOTAL"):
            total = split_amounts(s[len("TOTAL") :])
            break
        m = LINE.match(s)
        if m:
            rows.append((m.group(1), m.group(2).strip(), split_amounts(s[m.end(2) :])))
        elif CLASS_HEADING.match(s):
            break  # next class began without a TOTAL line
    return rows, total


@register("tn_dor_collections_june", "1.0")
def parse(asset: AssetConfig, path: Path):
    import pypdf

    logging.getLogger("pypdf").setLevel(logging.ERROR)
    pages = [(p.extract_text() or "") for p in pypdf.PdfReader(str(path)).pages]
    found = ytd_page(pages)
    if found is None:
        yield Rejected(f"{asset.asset_id}", "no fiscal-year-to-date page with an ALCOHOLIC BEVERAGES class")
        return
    page_no, text = found
    fy_prior, fy = (int(x) for x in FY_HEADER.search(text).groups())
    expected = (asset.options or {}).get("fiscal_year")
    if expected and int(expected) != fy:
        yield Rejected(
            f"{asset.asset_id} page {page_no + 1}", f"report is for FY{fy}, config says FY{expected}"
        )
        return
    rows, total = parse_class(text)
    loc0 = f"page {page_no + 1} (fiscal year to date, July {fy - 1}-June {fy}), ALCOHOLIC BEVERAGES"
    bad = [r for r in rows if len(r[2]) < 2]
    if total is None or len(total) < 2 or bad:
        yield Rejected(loc0, f"class not read cleanly (total {total}, unparsed lines {[b[0] for b in bad]})")
        return
    current = [amount(r[2][1]) for r in rows]
    if abs(sum(current) - amount(total[1])) > 0.01 * max(1, len(rows)):
        yield Rejected(loc0, f"account lines sum to {sum(current):,.2f}, printed TOTAL is {total[1]}")
        return
    period = fiscal_period_for(TN, fy)
    if period is None:
        yield Rejected(loc0, f"no fiscal-year rule for Tennessee FY{fy}")
        return
    start, end, _rule = period
    base = dict(
        geo_id=TN,
        period_start=start,
        period_end=end,
        period_kind="state_fiscal_year",
        period_label=f"FY{fy}",
        year=fy,
        estimate_type="administrative_amount",
        extraction_method="pdf_table",
        raw_unit="dollars",
        multiplier=1.0,
        fiscal_year_end=end,
    )
    seen = set()
    for code, label, amts in rows:
        if code not in WATCHED:
            continue
        measure = MEASURES.get((code, label))
        loc = f"{loc0}, account {code} '{label}', column FY {fy}"
        if measure is None:
            yield Rejected(
                loc,
                f"account {code} printed as {label!r}, a label this adapter does not know",
                raw_value=amts[1],
            )
            continue
        seen.add(code)
        yield Staged(
            measure_id=measure,
            value=amount(amts[1]),
            source_locator=loc,
            source_code=code,
            raw_value=amts[1],
            comparability_group=f"tn_dor_collections|{measure}|{label}",
            extra={"label_as_printed": label, "prior_year_column": amts[0], "report_page": page_no + 1},
            **base,
        )
    for code in sorted(WATCHED - seen):
        yield Rejected(loc0, f"account {code} not found in the class")
    yield Staged(
        measure_id=CLASS_TOTAL_MEASURE,
        value=amount(total[1]),
        source_locator=f"{loc0}, TOTAL, column FY {fy}",
        source_code="ALCOHOLIC BEVERAGES TOTAL",
        raw_value=total[1],
        comparability_group=f"tn_dor_collections|{CLASS_TOTAL_MEASURE}",
        extra={"accounts": [r[0] for r in rows], "prior_year_column": total[0], "report_page": page_no + 1},
        **base,
    )
