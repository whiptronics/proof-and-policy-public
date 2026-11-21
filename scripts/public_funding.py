"""Observed figures for the public funding page ("Where the Money Goes", ?v=funding).

Writes web/src/lib/publicFunding.generated.ts from pinned sources only:
  - DABS's FY2025 annual report, as transcribed by hand in data/curated/manual_observations.csv (pages 30 and 32;
    unaudited and not reviewed by a person). Both printings are kept where they differ.
  - The Utah Code sections that send liquor revenue to public accounts (32B-2-301, -304, -305, -306), read from the
    pinned version files. Every ledger row quotes the statute, and the quote must appear in the saved text.
  - 2026 S.B. 180 (status recorded by hand in metadata/legal_history/utah_sb180_2026_status.csv), its fiscal note,
    and the legislature's School Meals Programs brief; each figure used must appear in the saved text.
  - Census's FY2024 Annual Survey of School System Finances (Tables 8, 11 and 20; Utah's school districts from the
    unit file), NAEP 2024 state results with NCES's own significance tests, and BLS CPI-U monthly values.

Nothing here is a forecast or a scenario: scenarios are computed in web/src/lib/publicFunding.ts from the existing
policy-designs engine.

Run:  python -B scripts/public_funding.py          (write the file)
      python -B scripts/public_funding.py --check  (exit 1 if the committed file differs)
The raw files are found under ALCOHOL_DATA_HOME/data/raw (default: this checkout).
"""

from __future__ import annotations

import csv
import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from alcohol_data import geo  # noqa: E402
from alcohol_data.paths import RAW_DIR  # noqa: E402

OUT = ROOT / "web" / "src" / "lib" / "publicFunding.generated.ts"
PINS = ROOT / "config" / "builds" / "preview.pins.json"
MANUAL = ROOT / "data" / "curated" / "manual_observations.csv"
SB180 = ROOT / "metadata" / "legal_history" / "utah_sb180_2026_status.csv"
DABS_ASSET = "utah_dabs_annual_report_fy2025"
SUMTABLES = "census_elsec_fy2024_sumtables"
UNITS = "census_elsec_fy2024_units"
CPI = "bls_cpi_u_2017_2026"
NSLP = "usda_nslp_rates_sy2024_25"
USBE_PPE = "usbe_current_expenditure_per_pupil_fy2024"
ASSESSMENTS = (
    ("math4", "Mathematics, grade 4"),
    ("math8", "Mathematics, grade 8"),
    ("read4", "Reading, grade 4"),
    ("read8", "Reading, grade 8"),
)
SERIES_YEARS = (2019, 2020, 2021, 2022, 2023, 2024)
TOLERANCE = 1_000  # $: the report prints thousands, so identities may miss by rounding

# Census's FY2024 press release figures (2026-05-07), checked against Table 8 (acceptance test E01).
PRESS_RELEASE = {"US": 17_619, "UT": 11_347, "ID": 11_060, "AZ": 12_003}


def _pins() -> dict:
    return json.loads(PINS.read_text(encoding="utf-8"))


def pinned(raw: Path, asset: str) -> Path:
    """The pinned file of an asset in the raw cache (its name starts with the first 16 hex digits of its SHA-256)."""
    pin = _pins()[asset]
    p = raw / asset / f"{pin['sha256'][:16]}-{pin['filename']}"
    if not p.is_file():
        raise FileNotFoundError(
            f"{asset}: pinned file {p.name} is not in {raw / asset}; run `alcohol-data fetch`"
        )
    return p


def source(asset: str, locator: str) -> dict:
    pin = _pins()[asset]
    return {
        "asset": asset,
        "edition": pin["edition"],
        "url": pin["url"],
        "sha16": pin["sha256"][:16],
        "retrieved": pin["retrieved_at"][:10],
        "locator": locator,
    }


def page_text(p: Path) -> str:
    t = p.read_text(encoding="utf-8", errors="replace")
    t = re.sub(r"<script.*?</script>|<style.*?</style>", " ", t, flags=re.S)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", t)))


def pdf_text(p: Path) -> str:
    import pdfplumber

    with pdfplumber.open(p) as pdf:
        return re.sub(r"\s+", " ", " ".join(pg.extract_text() or "" for pg in pdf.pages))


def require(text: str, quote: str, where: str) -> None:
    if quote not in text:
        raise ValueError(f"{where}: the saved text no longer says {quote!r}")


# ----- DABS FY2025 --------------------------------------------------------------------------------------------------------


def _amount(raw: str, multiplier: str) -> float | None:
    s = raw.strip()
    if s in ("", "-", "—"):
        return None
    neg = s.startswith("(") and s.endswith(")")
    v = float(s.strip("()").replace(",", "").rstrip("%"))
    return (-v if neg else v) * float(multiplier)


def dabs_rows() -> dict[tuple[str, str, int], dict]:
    """(table, measure, fiscal year) -> value and locator, for the FY2025 report."""
    out = {}
    for r in csv.DictReader(MANUAL.open(encoding="utf-8")):
        if r["asset_id"] != DABS_ASSET or not r["year"]:
            continue
        table = r["manual_id"].split(":")[1]
        out[(table, r["measure_id"], int(r["year"]))] = {
            "value": _amount(r["raw_value"], r["multiplier"]),
            "locator": r["source_locator"].split(",")[0] + ", " + r["source_locator"].split(",")[1].strip(),
            "review": r["review_status"],
        }
    return out


DESTINATIONS = (
    # (id, measure, label, statute or None, restricted)
    (
        "general_fund",
        "ut_dabs_net_profit_general_fund",
        "General Fund (net profit transfer)",
        "UT-32B-2-301-6",
        False,
    ),
    (
        "school_meals",
        "ut_dabs_school_lunch_transfer",
        "School meals (Uniform School Fund)",
        "UT-32B-2-304-5",
        True,
    ),
    ("sales_tax", "ut_dabs_sales_tax_reported", "Sales tax collected from buyers", None, False),
    (
        "enforcement",
        "ut_dabs_sbi_transfer",
        "Alcohol law enforcement (Department of Public Safety)",
        "UT-32B-2-305-4",
        True,
    ),
    (
        "parents_empowered",
        "ut_dabs_parents_empowered",
        "Parents Empowered (underage drinking media campaign)",
        "UT-32B-2-306-3",
        True,
    ),
    (
        "underage_prevention",
        "ut_dabs_underage_drinking_prevention_transfer",
        "Underage drinking prevention (other)",
        None,
        True,
    ),
)


def dabs(rows: dict) -> dict:
    fin = "five_year_summary_financial_information"
    inc = "income_statement"

    def v(table: str, measure: str, fy: int = 2025) -> float:
        x = rows[(table, measure, fy)]["value"]
        if x is None:
            raise ValueError(f"{measure} FY{fy} in {table} has no value")
        return x

    sales = v(fin, "ut_dabs_liquor_sales_revenue")
    if abs(sales - v(inc, "ut_dabs_liquor_sales_revenue")) > TOLERANCE:
        raise ValueError("pages 30 and 32 print different FY2025 sales")
    dest = [
        {
            "id": i,
            "label": lab,
            "amount": v(fin, m),
            "statute": st,
            "restricted": rest,
            "locator": rows[(fin, m, 2025)]["locator"],
        }
        for i, m, lab, st, rest in DESTINATIONS
    ]
    # The income statement on page 30, step by step; each identity must hold within rounding.
    b = {
        k: v(inc, k)
        for k in (
            "ut_dabs_cost_of_liquor_sold",
            "ut_dabs_other_income",
            "ut_dabs_total_revenue",
            "ut_dabs_total_operating_expenses",
            "ut_dabs_net_operating_income",
            "ut_dabs_total_nonoperating_net",
            "ut_dabs_school_lunch_usf_public_safety_transfer",
            "ut_dabs_net_profit_general_fund",
        )
    }
    gross = sales - b["ut_dabs_cost_of_liquor_sold"]
    checks = [
        ("gross profit", gross, v(fin, "ut_dabs_gross_profit")),
        ("total revenue", gross + b["ut_dabs_other_income"], b["ut_dabs_total_revenue"]),
        (
            "net operating income",
            b["ut_dabs_total_revenue"] - b["ut_dabs_total_operating_expenses"],
            b["ut_dabs_net_operating_income"],
        ),
        (
            "net profit",
            b["ut_dabs_net_operating_income"] + b["ut_dabs_total_nonoperating_net"],
            b["ut_dabs_net_profit_general_fund"],
        ),
    ]
    for name, got, printed in checks:
        if abs(got - printed) > TOLERANCE:
            raise ValueError(f"page 30 {name}: {got:,.0f} computed, {printed:,.0f} printed")
    nonop = -b["ut_dabs_total_nonoperating_net"]
    bridge = [
        {"id": "sales", "label": "Liquor sales", "amount": sales, "kind": "total"},
        {
            "id": "cost",
            "label": "Cost of liquor sold",
            "amount": -b["ut_dabs_cost_of_liquor_sold"],
            "kind": "step",
        },
        {"id": "gross", "label": "Gross profit", "amount": gross, "kind": "subtotal"},
        {"id": "other", "label": "Other income", "amount": b["ut_dabs_other_income"], "kind": "step"},
        {
            "id": "opex",
            "label": "Operating expenses",
            "amount": -b["ut_dabs_total_operating_expenses"],
            "kind": "step",
        },
        {
            "id": "noi",
            "label": "Net operating income",
            "amount": b["ut_dabs_net_operating_income"],
            "kind": "subtotal",
        },
        {
            "id": "deposits",
            "label": "School meals, school fund and public safety transfer",
            "amount": -b["ut_dabs_school_lunch_usf_public_safety_transfer"],
            "kind": "step",
        },
        {
            "id": "nonop_rest",
            "label": "Other nonoperating items, net (not itemized in this transcription)",
            "amount": -(nonop - b["ut_dabs_school_lunch_usf_public_safety_transfer"]),
            "kind": "unreconciled",
        },
        {
            "id": "gf",
            "label": "Net profit to the General Fund",
            "amount": b["ut_dabs_net_profit_general_fund"],
            "kind": "total",
        },
    ]
    conflicts = []
    for m, label in (("ut_dabs_other_income", "Other income"), ("ut_dabs_total_revenue", "Total revenue")):
        a, c = v(inc, m), v(fin, m)
        if abs(a - c) > TOLERANCE:
            conflicts.append({"label": label, "page30": a, "page32": c})
    sales_2023 = v(fin, "ut_dabs_liquor_sales_revenue", 2023)
    return {
        "fiscalYear": 2025,
        "source": source(DABS_ASSET, "pages 30 and 32"),
        "review": "extracted_unreviewed",
        "sales": sales,
        "sales2023": sales_2023,
        "offPremiseShare": rows[("on_off_premise_sales", "ut_dabs_off_premise_sales_share", 2025)]["value"]
        / 100,
        "destinations": dest,
        "destinationsSum": sum(d["amount"] for d in dest),
        "bridge": bridge,
        "bridgeLocator": rows[(inc, "ut_dabs_net_profit_general_fund", 2025)]["locator"],
        "conflicts": conflicts,
    }


# ----- the law ledger -----------------------------------------------------------------------------------------------------

LAW = (
    {
        "rule_id": "UT-32B-2-304-2b",
        "citation": "Utah Code 32B-2-304(2)(b)",
        "asset": "law_ut_32b_2_304_v20260313",
        "effective_from": "2026-03-13",
        "quote": "wine sold by the department within the state shall be marked up in an amount not less than 88.5% above the landed case cost",
        "title": "Wine markup floor",
        "transaction_scope": "Wine sold by DABS within the state (exceptions in (3) and (4))",
        "collection_entity": "DABS",
        "remitter": None,
        "calculation_base": "Landed case cost (product, inbound shipping and case handling)",
        "rate": 0.885,
        "rate_basis": "markup on landed case cost (not a margin on the selling price)",
        "beneficiary": "Liquor Control Fund (32B-2-301(3))",
        "restrictions": ["A minimum; the commission sets prices"],
    },
    {
        "rule_id": "UT-32B-2-304-5",
        "citation": "Utah Code 32B-2-304(5)",
        "asset": "law_ut_32b_2_304_v20260313",
        "effective_from": "2026-03-13",
        "quote": "The department shall deposit 10% of the total gross revenue from sales of liquor with the state treasurer to be credited to the Uniform School Fund and used to support the school meals program",
        "title": "School meals deposit",
        "transaction_scope": "Sales of liquor by DABS",
        "collection_entity": "DABS",
        "remitter": "DABS",
        "calculation_base": "Total gross revenue from sales of liquor",
        "rate": 0.10,
        "rate_basis": "share of gross revenue",
        "beneficiary": "Uniform School Fund, school meals program (53E-3-510)",
        "restrictions": ["Used to support the school meals program"],
    },
    {
        "rule_id": "UT-32B-2-304-6a",
        "citation": "Utah Code 32B-2-304(6)(a)",
        "asset": "law_ut_32b_2_304_v20260313",
        "effective_from": "2026-03-13",
        "quote": "12.295% of the package agency's reported monthly revenue",
        "title": "Remittance by package agencies at a manufacturing facility",
        "transaction_scope": "Sales by a package agency located at a licensed manufacturing facility",
        "collection_entity": "DABS (collects monthly)",
        "remitter": "The package agency",
        "calculation_base": "The package agency's reported monthly revenue",
        "rate": 0.12295,
        "rate_basis": "share of reported revenue: 1.695% enforcement, 10% school meals, 0.60% underage drinking prevention",
        "beneficiary": "The same three accounts as DABS's own deposits",
        "restrictions": ["Applies only to these package agencies; not to grocers"],
    },
    {
        "rule_id": "UT-32B-2-304-8",
        "citation": "Utah Code 32B-2-304(8)",
        "asset": "law_ut_32b_2_304_v20260313",
        "effective_from": "2026-03-13",
        "quote": "an amount equal to the revenue generated from a 0.5% markup above the landed case cost to the department on spirituous liquor",
        "title": "Substance use disorder treatment appropriation",
        "transaction_scope": "Spirituous liquor only (not wine)",
        "collection_entity": "Legislature (appropriation)",
        "remitter": None,
        "calculation_base": "Revenue from a 0.5% markup on spirituous liquor's landed case cost",
        "rate": 0.005,
        "rate_basis": "markup on landed case cost, spirits only",
        "beneficiary": "Substance use disorder treatment services",
        "restrictions": ["An appropriation, not a deposit; wine does not enter it"],
    },
    {
        "rule_id": "UT-32B-2-305-4",
        "citation": "Utah Code 32B-2-305(4)",
        "asset": "law_ut_32b_2_305_v20240501",
        "effective_from": "2024-05-01",
        "quote": "the department shall deposit 1.695% of the total gross revenue from the sale of liquor with the state treasurer to be credited to the fund",
        "title": "Enforcement deposit",
        "transaction_scope": "Sales of liquor by DABS",
        "collection_entity": "DABS",
        "remitter": "DABS",
        "calculation_base": "Total gross revenue from the sale of liquor",
        "rate": 0.01695,
        "rate_basis": "share of gross revenue",
        "beneficiary": "Alcoholic Beverage Control Act Enforcement Fund (Department of Public Safety)",
        "restrictions": ["Officers and staff listed in (6); unspent money reallocated as (7) says"],
    },
    {
        "rule_id": "UT-32B-2-306-3",
        "citation": "Utah Code 32B-2-306(3)",
        "asset": "law_ut_32b_2_306_v20260506",
        "effective_from": "2026-05-06",
        "quote": "The department shall deposit 0.6% of the total gross revenue from sales of liquor with the state treasurer, as determined by the total gross revenue collected for the fiscal year two years preceding",
        "title": "Underage drinking prevention media campaign deposit",
        "transaction_scope": "Sales of liquor by DABS, two fiscal years earlier",
        "collection_entity": "DABS",
        "remitter": "DABS",
        "calculation_base": "Total gross revenue from sales of liquor, two fiscal years before",
        "rate": 0.006,
        "rate_basis": "share of gross revenue, lagged two years",
        "beneficiary": "Underage Drinking Prevention Media and Education Campaign Restricted Account",
        "restrictions": ["Subject to appropriation; used for the campaign (DABS runs Parents Empowered)"],
    },
    {
        "rule_id": "UT-32B-2-301-6",
        "citation": "Utah Code 32B-2-301(6)(a)",
        "asset": "law_ut_32b_2_301_v20250507",
        "effective_from": "2025-05-07",
        "quote": "The Division of Finance shall transfer annually from the Liquor Control Fund to the General Fund a sum equal to the amount of net profit earned from the sale of liquor",
        "title": "Net profit to the General Fund",
        "transaction_scope": "The Liquor Control Fund's net profit",
        "collection_entity": "Division of Finance",
        "remitter": "Liquor Control Fund",
        "calculation_base": "Net profit from the sale of liquor, adjusted for cash operations",
        "rate": None,
        "rate_basis": "a residual, after costs and the deposits",
        "beneficiary": "General Fund",
        "restrictions": ["Unrestricted: available for general appropriation"],
    },
)


# The version in force through FY2025 (July 2024 to June 2025), for each current version file: (asset, effective,
# superseded). Each version page prints "Effective <date>" and "Superseded <date>". 32B-2-301's current version took
# effect 2025-05-07, inside FY2025; the version before it is not at any version-file name probed (see
# docs/public-funding/qa/legal-as-of.md), so it has none here.
FY2025_VERSION = {
    "law_ut_32b_2_304_v20260313": ("law_ut_32b_2_304_v20240501", "2024-05-01", "2026-03-13"),
    "law_ut_32b_2_305_v20240501": ("law_ut_32b_2_305_v20240501", "2024-05-01", None),
    "law_ut_32b_2_306_v20260506": ("law_ut_32b_2_306_v20240501", "2024-05-01", "2026-05-06"),
}


def law(raw: Path) -> list[dict]:
    texts = {}

    def text(asset: str) -> str:
        if asset not in texts:
            texts[asset] = page_text(pinned(raw, asset))
        return texts[asset]

    out = []
    for r in LAW:
        require(text(r["asset"]), r["quote"], r["citation"])
        fy = FY2025_VERSION.get(r["asset"])
        if fy:
            require(text(fy[0]), r["quote"], f"{r['citation']} as in force in FY2025")
            if fy[2]:
                require(text(fy[0]), f"Superseded {int(fy[2][5:7])}/{int(fy[2][8:])}/{fy[2][:4]}", fy[0])
        row = {k: v for k, v in r.items() if k != "asset"}
        row |= {
            "effective_to": None,
            "status": "current_law",
            "as_of": "2026-11-20",
            "machine_reviewed": True,
            "human_reviewed": False,
            "source": source(r["asset"], r["citation"]),
            "fy2025": (
                {
                    "effective_from": fy[1],
                    "superseded": fy[2],
                    "same_quote": True,
                    "source": source(fy[0], r["citation"]),
                }
                if fy
                else None
            ),
        }
        out.append(row)
    return out


# ----- school meals and S.B. 180 ------------------------------------------------------------------------------------------


def meals(raw: Path) -> dict:
    brief = pdf_text(pinned(raw, "ut_olrgc_school_meals_2025"))
    for q in (
        "over $322 million in federal dollars for school meals programs",
        "about $50 million from the Liquor Tax",
        "Child Nutrition line item in the state budget was appropriated $374 million",
        "49.1 million lunches and 11.5 million breakfasts",
        "about 198,000 Utah students qualified for free or reduced-price meals",
    ):
        require(brief, q, "School Meals Programs brief")
    note = page_text(pinned(raw, "ut_sb0180s01_2026_fiscal_note"))
    require(
        note,
        "State funding comes from revenue generated by the sale of liquor. The FY 2027 base appropriation is $50.1 million",
        "S.B. 180 fiscal note",
    )
    fr = page_text(pinned(raw, NSLP))
    for q in (
        "for the period July 1, 2024, through June 30, 2025",
        "served less than 60 percent free and reduced-price lunches in School Year (SY) 2022-2023, the payments for meals served are: Contiguous States--paid rate--42 cents",
        "Contiguous States--paid rate--44 cents",
        "an additional 9 cents (adjusted annually)",
        "Section 11 National Average Payment Factors--Contiguous States-- free lunch--4 dollars and 1 cent",
    ):
        require(fr, q, "89 FR 56720")
    status = list(csv.DictReader(SB180.open(encoding="utf-8")))
    if any(r["human_reviewed"] != "false" for r in status):
        raise ValueError("the S.B. 180 status rows must not claim a human review")
    return {
        "fy2024": {
            "federal": 322e6,
            "federalWords": "over $322 million",
            "liquor": 50e6,
            "liquorWords": "about $50 million",
        },
        "fy2025ChildNutrition": {"total": 374e6, "federal": 322.8e6},
        "fy2027LiquorBase": 50.1e6,
        "mealsServed2023": {"lunches": 49.1e6, "breakfasts": 11.5e6, "schoolYear": "2022-23"},
        "freeReduced2024": {"students": 198_000, "schoolYear": "2023-24"},
        "brief": source("ut_olrgc_school_meals_2025", "pages 1, 4 and 5"),
        "fiscalNote": source("ut_sb0180s01_2026_fiscal_note", "Local Government"),
        # Federal cash per free lunch, contiguous states: Section 11 plus Section 4 (under 60% free and reduced-price).
        "freeLunchReimbursement": {
            "section11": 4.01,
            "section4": 0.42,
            "section4HighNeedExtra": 0.02,
            "performanceExtra": 0.09,
            "schoolYear": "SY2024-25",
            "source": source(NSLP, "89 FR 56721-56722, Section 4 and Section 11 payment factors"),
        },
        "sb180": {
            "bill": "S.B. 180 (2026), School Nutrition Amendments",
            "sponsor": "Sen. Luz Escamilla; House sponsor Rep. Tyler Clancy",
            "stage": "not_enacted",
            "summary": "Would have let the State Board of Education use part of the liquor revenue for meals for more students. Passed the Senate; held in House Education; filed as not passed on 2026-03-06.",
            "timeline": [{k: r[k] for k in ("date", "action", "location", "vote")} for r in status],
            "readFrom": status[0]["read_from"],
            "readOn": status[0]["read_on"],
            "text": source("ut_sb0180_2026_introduced", "introduced text"),
        },
    }


# ----- education ----------------------------------------------------------------------------------------------------------


def _state_by_name(name: str):
    n = re.sub(r"\.+$", "", name.strip()).strip()
    return next((s for s in geo.states() if s.name == n), None)


def education(raw: Path) -> dict:
    import openpyxl

    wb = openpyxl.load_workbook(pinned(raw, SUMTABLES), read_only=True, data_only=True)
    t8 = {}
    us = None
    for r in wb["8"].iter_rows(values_only=True):
        if not r[0] or not isinstance(r[2], (int, float)):
            continue
        if "United States" in r[0]:
            us = r[2]
            continue
        s = _state_by_name(r[0])
        if s is None:
            raise ValueError(f"Table 8: unknown area {r[0]!r}")
        t8[s.usps] = {"total": r[2], "instruction": r[5], "support": r[8]}
    if len(t8) != 51 or us is None:
        raise ValueError(f"Table 8: {len(t8)} areas")
    series: dict[str, dict[int, float | None]] = {}
    hdr = None
    for r in wb["20"].iter_rows(values_only=True):
        if r[0] == "Geographic area":
            hdr = r
            continue
        if hdr is None or not r[0]:
            continue
        key = "US" if "United States" in r[0] else getattr(_state_by_name(r[0]), "usps", None)
        if key is None:
            continue
        series[key] = {
            y: (r[hdr.index(y)] if isinstance(r[hdr.index(y)], (int, float)) else None) for y in SERIES_YEARS
        }
    if len(series) != 52:
        raise ValueError(f"Table 20: {len(series)} areas")
    rank11 = None
    for r in wb["11"].iter_rows(values_only=True):
        if isinstance(r[0], int) and r[10] and str(r[10]).startswith("UT"):
            rank11 = r[0]
    for k, want in PRESS_RELEASE.items():
        got = us if k == "US" else t8[k]["total"]
        if round(got) != want:
            raise ValueError(f"Table 8 {k}: {got:,.2f}, press release {want:,}")
    if abs(series["UT"][2024] - t8["UT"]["total"]) > 0.5:
        raise ValueError("Tables 8 and 20 disagree for Utah")

    naep = {}
    for k, label in ASSESSMENTS:
        scores = json.loads(pinned(raw, f"naep_2024_{k}_scores").read_text(encoding="utf-8"))["result"]
        sig = json.loads(pinned(raw, f"naep_2024_{k}_sig").read_text(encoding="utf-8"))["result"]
        vs = {}
        for p in sig:
            if p["focalJurisdiction"] == "NP" and p["isSigDisplayable"] == 1:
                # focal NP LOWER than the target means the state scored higher than the nation, by NCES's test
                vs[p["targetJurisdiction"]] = {
                    "LOWER": "higher",
                    "HIGHER": "lower",
                    "EQUAL": "not_different",
                }[p["sig"]]
        row = {}
        for s in scores:
            if s["isStatDisplayable"] != 1:
                continue
            row[s["jurisdiction"]] = {"score": round(s["value"], 1), "vsNation": vs.get(s["jurisdiction"])}
        if len(row) != 52 or row["NP"]["vsNation"] is not None:
            raise ValueError(f"NAEP {k}: {len(row)} jurisdictions")
        naep[k] = {
            "label": label,
            "year": 2024,
            "universe": "Public school students",
            "byJurisdiction": row,
            "source": source(f"naep_2024_{k}_scores", "GetAdhocData type=data"),
            "sigSource": source(f"naep_2024_{k}_sig", "GetAdhocData type=sigacrossjuris"),
        }

    cpi = json.loads(pinned(raw, CPI).read_text(encoding="utf-8"))["Results"]["series"][0]["data"]
    # BLS prints "-" for a month it did not publish (October 2025); such a month is absent, never zero.
    month = {
        (int(d["year"]), int(d["period"][1:])): float(d["value"])
        for d in cpi
        if d["period"].startswith("M") and d["period"] != "M13" and d["value"] != "-"
    }

    def fy_avg(fy: int) -> float:
        keys = [(fy - 1, m) for m in range(7, 13)] + [(fy, m) for m in range(1, 7)]
        if any(k not in month for k in keys):
            raise ValueError(f"CPI: FY{fy} is missing a month")
        return round(sum(month[k] for k in keys) / 12, 3)

    states = []
    for s in geo.states():
        if s.usps not in t8:
            continue
        states.append(
            {
                "usps": s.usps,
                "name": s.name,
                "isState": s.usps != "DC",
                "ppcs": round(t8[s.usps]["total"], 2),
                "instruction": round(t8[s.usps]["instruction"], 2),
                "support": round(t8[s.usps]["support"], 2),
                "series": {str(y): (None if v is None else round(v, 2)) for y, v in series[s.usps].items()},
            }
        )
    return {
        "fiscalYear": 2024,
        "measure": "Current spending per pupil (current operation spending of public elementary-secondary school systems over fall enrollment; excludes capital outlay and debt service)",
        "us": {
            "ppcs": round(us, 2),
            "series": {str(y): (None if v is None else round(v, 2)) for y, v in series["US"].items()},
        },
        "states": states,
        "censusRankUT": {
            "rank": rank11,
            "of": 51,
            "note": "Census's Table 11 ranks the District of Columbia with the states",
        },
        "enrollmentNote": "Census's tables say per pupil amounts use fall 2022 memberships from NCES's Common Core of Data (school year 2022-23).",
        "source": source(SUMTABLES, "Tables 8, 11 and 20"),
        "naep": naep,
        "cpi": {
            "series": "CUUR0000SA0 (CPI-U, U.S. city average, not seasonally adjusted)",
            "basis": "average of July to June, Utah's fiscal year (other states' fiscal years can differ)",
            "byFiscalYear": {str(y): fy_avg(y) for y in SERIES_YEARS},
            "source": source(CPI, "monthly values"),
        },
    }


def _district_key(name: str) -> str:
    """'Salt Lake City School Dist' and USBE's 'Salt Lake District' both become 'salt lake'."""
    drop = {"school", "sch", "district", "dist", "county", "co", "city"}
    return " ".join(w for w in name.lower().split() if w not in drop)


def usbe_per_pupil(raw: Path) -> tuple[dict[str, int], dict[str, int]]:
    """FY2024 current expenditures per pupil by district from USBE's report, and its District and Statewide totals."""
    t = pdf_text(pinned(raw, USBE_PPE))
    require(t, "Current Expenditures Per Pupil in Fall Enrollment", USBE_PPE)
    require(t, "Type Nbr LEA FY2020 FY2021 FY2022 FY2023 FY2024 Pct Chg", USBE_PPE)
    # The PDF's text puts a space inside numbers ("1 0,401"); a value is digits, spaces and one comma, or "-".
    val = r"(?:\$ )?(\d[\d ]*,\d{3}|-)"
    rows = {}
    for m in re.finditer(
        rf"District \d+ ([A-Z][A-Za-z ]+?) District {val} {val} {val} {val} {val} -?[\d.]+%", t
    ):
        fy24 = m.group(6)
        if fy24 != "-":
            rows[_district_key(m.group(1))] = int(fy24.replace(" ", "").replace(",", ""))
    totals = {}
    for kind in ("District", "Statewide"):
        m = re.search(rf"{kind} Total {val} {val} {val} {val} {val}", t)
        if not m:
            raise ValueError(f"{USBE_PPE}: no {kind} Total row")
        totals[kind] = int(m.group(5).replace(" ", "").replace(",", ""))
    if len(rows) != 41:
        raise ValueError(f"{USBE_PPE}: {len(rows)} district rows, expected Utah's 41")
    return rows, totals


def districts(raw: Path) -> dict:
    import openpyxl

    wb = openpyxl.load_workbook(pinned(raw, UNITS), read_only=True, data_only=True)
    it = wb["elsec24"].iter_rows(values_only=True)
    hdr = next(it)
    ix = {h: i for i, h in enumerate(hdr)}
    out = []
    for r in it:
        if str(r[ix["FIPST"]]) != "49":
            continue
        enr = r[ix["V33"]]
        cur = r[ix["TCURELSC"]] * 1000
        out.append(
            {
                "ncesId": str(r[ix["NCESID"]]),
                "name": str(r[ix["NAME"]]).title(),
                "countyFips": str(r[ix["CONUM"]]),
                "enrollment": enr,
                "currentSpending": cur,
                "perPupil": round(cur / enr, 2) if enr else None,
                "revenue": {
                    k: r[ix[c]] * 1000
                    for k, c in (
                        ("total", "TOTALREV"),
                        ("federal", "TFEDREV"),
                        ("state", "TSTREV"),
                        ("local", "TLOCREV"),
                    )
                },
            }
        )
    if len(out) < 40:
        raise ValueError(f"unit file: only {len(out)} Utah school systems")
    usbe, totals = usbe_per_pupil(raw)
    by_key = {_district_key(d["name"]): d for d in out}
    missing = sorted(set(usbe) - set(by_key))
    if missing:
        raise ValueError(f"USBE districts with no Census row: {missing}")
    for k, v in usbe.items():
        by_key[k]["usbePerPupil"] = v
    out.sort(key=lambda d: d["name"])
    return {
        "fiscalYear": 2024,
        "systems": out,
        "usbe": {
            "districtTotal": totals["District"],
            "statewide": totals["Statewide"],
            "source": source(USBE_PPE, "FY2024 column, District rows"),
            "note": "USBE's own measure: current expenditures over fall enrollment from the Utah Public Education Financial System, excluding community services, buildings, debt and tuition paid to other districts. Utah's FY2024 runs July 2023 to June 2024, the same year as Census's FY2024 for Utah; neither is a federal fiscal year.",
        },
        "source": source(UNITS, "rows with FIPST 49"),
        "note": "Per pupil here is current spending (TCURELSC) over fall enrollment (V33) from Census's unit file, computed by this page. Utah's charter schools are not separate rows in this file. A school district's county is where Census places it; districts and counties are not the same areas.",
    }


# ----- Tennessee and Colorado (devplan PPF-407): context only, never an input to the model -----------------------------


def _asset_config(asset_id: str):
    from alcohol_data.config import load_all_sources

    for s in load_all_sources(ROOT / "config" / "sources").values():
        for a in s.assets:
            if a.asset_id == asset_id:
                return a
    raise KeyError(asset_id)


def _staged(asset_id: str, path: Path) -> list:
    """Run the project's own adapter for an asset; its checks (class totals, token counts) apply unchanged."""
    from alcohol_data.adapters import niaaa_pcyr, tn_dor_collections

    a = _asset_config(asset_id)
    fn = {"tn_dor_collections_june": tn_dor_collections.parse, "niaaa_pcyr": niaaa_pcyr.parse}[a.parser]
    return [r for r in fn(a, path) if hasattr(r, "measure_id")]


def _pdf_pages(p: Path, pages: list[int]) -> str:
    import pdfplumber

    with pdfplumber.open(p) as pdf:
        return re.sub(r"\s+", " ", " ".join(pdf.pages[n - 1].extract_text() or "" for n in pages))


TN_MANUAL = "tn_dor_alcohol_tax_manual_2025_06"
TN_ACT = "tn_public_chapter_2014_554"
CO_LAW = "law_co_crs_2024_title_44"
NIAAA = "niaaa_pcyr_sr124"
TN_WINE_TAX = {
    "tn_dor_wine_tax_collections": "Wine Tax",
    "tn_dor_account_11002_with_high_alcohol_beer": "Wine Tax & High Alcohol Beer",
}
NIAAA_STATES = {"UT": "state:49", "TN": "state:47", "CO": "state:08", "US": "nation:us"}
NIAAA_YEARS = (2015, 2017, 2022, 2024)


def states(raw: Path) -> dict:
    manual = pdf_text(pinned(raw, TN_MANUAL))
    for q in (
        "The wine gallonage tax is a state tax only.",
        "The tax rate (per gallon) for wine is $1.21.",
        "Generally, wholesalers pay the wholesale gallonage tax.",
        "Tennessee has a three-tiered system for distributing alcoholic beverages.",
    ):
        require(manual, q, TN_MANUAL)
    act = pdf_text(pinned(raw, TN_ACT))
    for q in (
        "The commission shall begin issuing the retail food store wine licenses on July 1, 2016",
        "licenses shall only be issued to a retail food store located in a county or municipality that has authorized the sale of wine at retail food stores by local option election",
    ):
        require(act, q, TN_ACT)

    account = []
    for fy in range(2012, 2026):
        asset = f"tn_dor_collections_june_{fy}"
        rows = [r for r in _staged(asset, pinned(raw, asset)) if r.measure_id in TN_WINE_TAX]
        if len(rows) != 1:
            raise ValueError(f"{asset}: expected one account 11002 value, found {len(rows)}")
        r = rows[0]
        account.append(
            {
                "fy": fy,
                "label": TN_WINE_TAX[r.measure_id],
                "amount": r.value,
                "source": source(asset, r.source_locator),
            }
        )
    before = [a["amount"] for a in account if 2012 <= a["fy"] <= 2016]
    fy2017 = next(a for a in account if a["fy"] == 2017)
    if fy2017["label"] != "Wine Tax":
        raise ValueError("account 11002 in FY2017 is no longer printed 'Wine Tax'")

    co = _pdf_pages(pinned(raw, CO_LAW), [100, 101])
    for q in (
        "The state treasurer shall credit eighty-five percent of the fees and taxes to the old age pension fund and the balance to the general fund.",
        "7.33 cents per liter on all vinous liquors except hard cider",
        "a wine development fee at the rate of 1.0 cent per liter is imposed on all vinous liquors except hard cider",
        "the first licensee receiving alcohol beverages in this state if shipped from without the state, shall be primarily liable for the payment",
    ):
        require(co, q, CO_LAW)

    consumption: dict = {k: {} for k in NIAAA_STATES}
    geo_key = {v: k for k, v in NIAAA_STATES.items()}
    for r in _staged(NIAAA, pinned(raw, NIAAA)):
        bev = r.measure_id.removeprefix("niaaa_ethanol_per_capita_21plus_")
        if r.geo_id in geo_key and r.year in NIAAA_YEARS and bev in ("wine", "all"):
            consumption[geo_key[r.geo_id]].setdefault(str(r.year), {})[bev] = r.value
    for k, years in consumption.items():
        for y in NIAAA_YEARS:
            if set(years.get(str(y), {})) != {"wine", "all"} or None in years[str(y)].values():
                raise ValueError(f"{NIAAA}: {k} {y} lacks wine or all-beverage ethanol per resident 21+")

    return {
        "tennessee": {
            "winePerGallon": 1.21,
            "taxSource": source(TN_MANUAL, "Chapter 3, Wine Gallonage Tax, page 20"),
            "licensesFrom": "2016-07-01",
            "actSource": source(
                TN_ACT, "Section 1 (57-3-801(a)(1)) and the retail food store wine license section"
            ),
            "account11002": account,
            "fy2012to2016Average": round(sum(before) / len(before), 2),
            "fy2017OverAverage": round(fy2017["amount"] / (sum(before) / len(before)) - 1, 4),
        },
        "colorado": {
            "winePerLiter": 0.0733,
            "wineDevelopmentFeePerLiter": 0.01,
            "pensionShare": 0.85,
            "source": source(CO_LAW, "C.R.S. 44-3-502(1)(a) and 44-3-503(1)(a), (c)(I), pages 100-101"),
        },
        "consumption": {
            "years": list(NIAAA_YEARS),
            "byState": consumption,
            "source": source(NIAAA, "gallons of ethanol per resident 21+, wine and all beverages"),
        },
    }


def measure(raw: Path = RAW_DIR) -> dict:
    return {
        "dabs": dabs(dabs_rows()),
        "law": law(raw),
        "meals": meals(raw),
        "education": education(raw),
        "districts": districts(raw),
        "states": states(raw),
    }


def render(m: dict) -> str:
    body = re.sub(r'"(\w+)":', r"\1:", json.dumps(m, ensure_ascii=False, indent=1))
    return (
        "// Generated by scripts/public_funding.py from pinned DABS, Utah Code, legislature, Census, NAEP, BLS, USDA, USBE,\n"
        "// Tennessee, Colorado and NIAAA files; do not edit by hand. tests/test_public_funding.py fails when this file differs from what the script writes.\n"
        f"export const PUBLIC_FUNDING = {body} as const;\n"
    )


def main(argv: list[str]) -> int:
    text = render(measure())
    if "--check" in argv:
        same = OUT.read_text(encoding="utf-8") == text
        print("publicFunding.generated.ts " + ("matches" if same else "DIFFERS from the raw files"))
        return 0 if same else 1
    OUT.write_text(text, encoding="utf-8", newline="\n")
    print(f"wrote {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
