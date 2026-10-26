"""Utah liquor-sales reconciliation: DABS's reported sales, the statutory deposits, Census receipts and the audited
fund's sales, year by year. Method ``BRIDGE_METHOD``. Standard library plus DuckDB; nothing here changes a value.

**What is bridged.** DABS's annual sales line ("Sales net of Taxes" in the FY2012-FY2019 reports, "Sales" and later
"Revenue from Liquor Sales") is compared with Census's state-government liquor-store receipts (A90) and, where read,
the audited Alcoholic Beverage Services Fund's sales in the State of Utah ACFR. Only two adjustments are applied,
because Utah law computes them on the same base: the deposit of a percentage of "the total gross revenue from sales
of liquor" with the Uniform School Fund (Utah Code 32B-2-304) and, after it, with the Alcoholic Beverage Control Act
Enforcement Fund (32B-2-305). Earmarks set as fixed amounts or appropriations (Parents Empowered, underage drinking
prevention, other programs) are not subtracted: nothing computes them on sales, and subtracting them because the
numbers come out closer would be fitting, not reconciling.

**Two variants, never merged.** "Reported" subtracts the deposits as DABS printed them; "statutory" subtracts the rate
in force for the fiscal year (metadata/legal_history/utah_liquor_deposit_rates.csv) times DABS's sales. Neither
reconciles every year, and each residual is kept as it falls. A year counts as reconciling numerically only when a
residual is within ``TOLERANCE_DOLLARS``; that is a numerical statement, not proof of how either publisher classifies
the deposits. Whether Census and the audited fund leave the deposits out of sales is *inferred*, because no financial
statement or note read so far says so.

**Evidence status** of every line: ``documented`` (a pinned, checksummed source states it), ``documented_provisional``
(a source states it but was read online and is not yet saved), ``reconciles_numerically``, ``inferred`` and
``unresolved``. No numerical confidence score is attached to an accounting conclusion.
"""

from __future__ import annotations

import csv
from dataclasses import dataclass
from functools import lru_cache

from alcohol_data import paths

BRIDGE_METHOD = "utah-liquor-bridge@1.0"
TOLERANCE_DOLLARS = 150_000.0
UT = "state:49"
RATES_CSV = paths.METADATA_DIR / "legal_history" / "utah_liquor_deposit_rates.csv"
PROVISIONAL_CSV = paths.CURATED_DIR / "research" / "provisional_figures.csv"
STATUSES = {
    "documented": "Documented: a saved, checksummed source states it.",
    "documented_provisional": "Documented, provisional: a source states it, but it was read online and is not yet saved in the project.",
    "reconciles_numerically": "Reconciles numerically: the figures agree within the stated tolerance; that is arithmetic, not a stated accounting rule.",
    "inferred": "Inferred: follows from the figures or from related text, but no source states it.",
    "unresolved": "Unresolved: the figures differ and no source explains why.",
}
DEPOSITS = ("school_meals", "enforcement_fund")
RATE_COLUMNS = [
    "rate_id",
    "deposit",
    "fiscal_year_from",
    "fiscal_year_to",
    "rate",
    "statute",
    "text",
    "evidence",
    "evidence_ref",
    "status",
    "note",
]
PROVISIONAL_COLUMNS = [
    "figure_id", "geo_id", "entity", "document", "page", "table", "item_as_printed", "concept", "fiscal_year", "value",
    "unit", "url", "read_on", "read_method", "lead_id", "note",
    "checked_on", "checked_against", "checked_page", "check", "record",
]  # fmt: skip
# How a reading was checked once its document was saved: in the right row and year column of the PDF's text layer,
# by reading the page (label and value on separate text lines), or not at all because the document is not saved.
CHECKS = {"row_and_column", "page_reading", "not_saved"}
UNIT_MULTIPLIER = {"dollars": 1.0, "thousands_of_dollars": 1000.0}
READ_METHODS = {"web_reader"}
DABS_MEASURES = {
    "sales": "ut_dabs_liquor_sales_revenue",
    "school_meals": "ut_dabs_school_lunch_transfer",
    "enforcement_fund": "ut_dabs_sbi_transfer",
}
DABS_CONCEPTS = {
    "sales": "sales_net_of_taxes",
    "school_meals": "school_meals_deposit",
    "enforcement_fund": "enforcement_fund_deposit",
}
CENSUS_RECEIPTS = "census_liquor_stores_revenue"
AUDITED_SALES = (
    "ut_abs_fund_sales_revenue"  # the Alcoholic Beverage Services Fund's sales in the State of Utah ACFR
)
# For years before the pinned DABS reports (FY2020 on), the latest DABC report covering the year is used; the FY2016
# sales value printed on the 81st report's page 8 is a typographical error (see its note), so FY2015-FY2016 use the 84th.
PROVISIONAL_REPORT_FOR_YEAR = {
    2012: "dabc81",
    2013: "dabc81",
    2014: "dabc81",
    2015: "dabc84",
    2016: "dabc84",
    2017: "dabc86",
    2018: "dabc86",
    2019: "dabc86",
}


@dataclass(frozen=True)
class DepositRate:
    rate_id: str
    deposit: str
    fiscal_year_from: int
    fiscal_year_to: int
    rate: float
    statute: str
    text: str
    evidence: str
    evidence_ref: str
    status: str
    note: str


def _read(path) -> list[dict]:
    with open(path, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


@lru_cache(maxsize=1)
def deposit_rates() -> tuple[DepositRate, ...]:
    rows = _read(RATES_CSV)
    if rows and list(rows[0].keys()) != RATE_COLUMNS:
        raise ValueError(f"{paths.rel(RATES_CSV)}: columns differ from {RATE_COLUMNS}")
    out = []
    for r in rows:
        out.append(
            DepositRate(
                r["rate_id"],
                r["deposit"],
                int(r["fiscal_year_from"]),
                int(r["fiscal_year_to"]),
                float(r["rate"]),
                r["statute"],
                r["text"],
                r["evidence"],
                r["evidence_ref"],
                r["status"],
                r["note"],
            )  # fmt: skip
        )
    problems = check_rates(out)
    if problems:
        raise ValueError("; ".join(problems))
    return tuple(out)


def check_rates(rates) -> list[str]:
    problems = []
    for r in rates:
        if r.deposit not in DEPOSITS:
            problems.append(f"{r.rate_id}: unknown deposit {r.deposit}")
        if r.status not in STATUSES:
            problems.append(f"{r.rate_id}: unknown status {r.status}")
        if not 0 < r.rate < 1:
            problems.append(f"{r.rate_id}: rate {r.rate} outside (0, 1)")
        if r.fiscal_year_from > r.fiscal_year_to:
            problems.append(f"{r.rate_id}: years reversed")
        if r.status == "documented" and not r.evidence_ref.startswith("asset:"):
            problems.append(f"{r.rate_id}: 'documented' needs a pinned asset")
    for d in DEPOSITS:
        years = sorted(
            y for r in rates if r.deposit == d for y in range(r.fiscal_year_from, r.fiscal_year_to + 1)
        )
        if len(years) != len(set(years)):
            problems.append(f"{d}: overlapping fiscal years")
    return problems


def deposit_rate(deposit: str, fy: int) -> DepositRate | None:
    hits = [
        r for r in deposit_rates() if r.deposit == deposit and r.fiscal_year_from <= fy <= r.fiscal_year_to
    ]
    return hits[0] if hits else None


@lru_cache(maxsize=1)
def provisional_figures() -> tuple[dict, ...]:
    """Figures read through a web reader: a research note, never an observation. Each row carries its document, page
    and address; ``value_dollars`` applies the unit. Once the document is saved, ``check`` says how the reading was
    checked against it and ``record`` names the manual observation that now carries the value (the source of truth)."""
    rows = _read(PROVISIONAL_CSV) if PROVISIONAL_CSV.is_file() else []
    problems = check_provisional(rows)
    if problems:
        raise ValueError(f"{paths.rel(PROVISIONAL_CSV)}: " + "; ".join(problems[:10]))
    out = []
    for r in rows:
        d = dict(r)
        d["fiscal_year"] = int(r["fiscal_year"])
        d["value"] = float(r["value"])
        d["value_dollars"] = d["value"] * UNIT_MULTIPLIER[r["unit"]]
        out.append(d)
    return tuple(out)


def check_provisional(rows: list[dict]) -> list[str]:
    problems = []
    if rows and list(rows[0].keys()) != PROVISIONAL_COLUMNS:
        problems.append("columns differ from the contract")
        return problems
    ids = [r["figure_id"] for r in rows]
    dupes = sorted({i for i in ids if ids.count(i) > 1})
    if dupes:
        problems.append(f"duplicate figure ids {dupes}")
    for r in rows:
        if r["unit"] not in UNIT_MULTIPLIER:
            problems.append(f"{r['figure_id']}: unknown unit {r['unit']}")
        if r["read_method"] not in READ_METHODS:
            problems.append(f"{r['figure_id']}: unknown read_method {r['read_method']}")
        if not r["url"].startswith("https://"):
            problems.append(f"{r['figure_id']}: url must be https")
        if r["check"] not in CHECKS:
            problems.append(f"{r['figure_id']}: unknown check {r['check']!r}")
        elif (r["check"] == "not_saved") != (not r["checked_against"]):
            problems.append(
                f"{r['figure_id']}: a checked figure names the saved asset it was checked against"
            )
        if r["record"] and r["check"] == "not_saved":
            problems.append(f"{r['figure_id']}: only a checked figure can point to a record")
        try:
            float(r["value"])
        except ValueError:
            problems.append(
                f"{r['figure_id']}: value {r['value']!r} is not a number (a dash is no row, never a zero)"
            )
    return problems


def figures(geo_id: str, concept: str, fy: int, prefix: str | None = None) -> list[dict]:
    return [
        f
        for f in provisional_figures()
        if f["geo_id"] == geo_id
        and f["concept"] == concept
        and f["fiscal_year"] == fy
        and (prefix is None or f["figure_id"].startswith(prefix + "_"))
    ]


def identity_problems() -> list[str]:
    """Each statement's own arithmetic, recomputed from the transcribed lines: a check that the web reader copied
    them correctly. DABC five-year summaries: gross profit + other income = total revenue, and total revenue less
    every printed deduction = net profit. Pennsylvania's State Stores Fund statement: each subtotal from its lines."""
    by: dict[tuple[str, int], dict[str, float]] = {}
    unit: dict[str, float] = {}
    for f in provisional_figures():
        key = (f["figure_id"].split("_")[0], f["fiscal_year"])
        by.setdefault(key, {})[f["concept"]] = f["value"]
        unit[key[0]] = UNIT_MULTIPLIER[f["unit"]]
    problems = []

    def close(a, b, tol, what):
        if abs(a - b) > tol:
            problems.append(f"{what}: {a:,.0f} vs {b:,.0f}")

    for (doc, fy), v in sorted(by.items()):
        tol = 2.0 if unit[doc] == 1000.0 else 2.0  # rounding of each printed line
        if (
            doc.startswith("dabc")
            and {"gross_profit", "other_income", "total_revenue", "net_profit_general_fund"} <= v.keys()
        ):
            close(
                v["gross_profit"] + v["other_income"],
                v["total_revenue"],
                tol * 2,
                f"{doc} FY{fy} gross profit + other income",
            )
            deductions = [
                "parents_empowered",
                "underage_drinking_prevention",
                "operating_nonoperating_expenses",
                "enforcement_fund_deposit",
                "school_meals_deposit",
                "other_programs_transfer",
            ]
            net = v["total_revenue"] - sum(v.get(k, 0.0) for k in deductions)
            close(net, v["net_profit_general_fund"], tol * 4, f"{doc} FY{fy} total revenue less deductions")
        if doc.startswith("pa") and "sales_net_of_taxes" in v:
            close(
                v["sales_net_of_taxes"] - v["cost_of_goods_sold"],
                v["gross_profit"],
                tol,
                f"{doc} FY{fy} gross profit",
            )
            parts = [k for k in v if k.startswith("operating_expenses_") and k != "operating_expenses_total"]
            close(
                sum(v[k] for k in parts),
                v["operating_expenses_total"],
                tol * 3,
                f"{doc} FY{fy} operating expenses",
            )
            close(
                v["gross_profit"] - v["operating_expenses_total"],
                v["operating_profit"],
                tol,
                f"{doc} FY{fy} operating profit",
            )
            close(
                v["enforcement_fines"] + v["license_fees"] + v["miscellaneous_income"],
                v["other_operating_revenues_total"],
                tol,
                f"{doc} FY{fy} other operating revenues",
            )
            close(
                v["operating_profit"] + v["other_operating_revenues_total"],
                v["total_operating_income"],
                tol,
                f"{doc} FY{fy} total operating income",
            )
            close(
                v["total_operating_income"] + v["nonoperating_total"],
                v["income_before_transfers"],
                tol,
                f"{doc} FY{fy} income before transfers",
            )
            out = sum(
                v.get(k, 0.0)
                for k in (
                    "enforcement_transfer",
                    "general_fund_transfer",
                    "agriculture_transfer",
                    "drug_alcohol_programs_transfer",
                )
            )
            close(
                v["income_before_transfers"] - out,
                v["change_in_net_position"],
                tol * 2,
                f"{doc} FY{fy} change in net position",
            )
    return problems


# ----- the bridge --------------------------------------------------------------------------------------------------


def _pinned(con) -> dict:
    """DABS lines (every candidate the reports print) and Census receipts (preferred) for Utah, from the build."""
    out: dict[tuple[str, int], list[dict]] = {}
    rows = con.execute(
        """SELECT o.measure_id, o.year, o.value, o.observation_id, o.source_locator, o.period_kind, o.review_status
        FROM observations o WHERE o.geo_id = ? AND o.measure_id IN (?, ?, ?) AND o.value IS NOT NULL
        ORDER BY o.measure_id, o.year, o.value, o.observation_id""",
        [UT, *DABS_MEASURES.values()],
    ).fetchall()
    pref = {
        (m, y): oid
        for m, y, oid in con.execute(
            "SELECT measure_id, year, observation_id FROM preferred_observations WHERE geo_id = ? AND measure_id IN (?, ?, ?, ?)",
            [UT, *DABS_MEASURES.values(), CENSUS_RECEIPTS],
        ).fetchall()
    }
    preferred_values: dict[tuple[str, int], list] = {}
    for m, y, v in con.execute(
        "SELECT measure_id, year, value FROM preferred_observations WHERE geo_id = ? AND measure_id IN (?, ?, ?)",
        [UT, *DABS_MEASURES.values()],
    ).fetchall():
        preferred_values.setdefault((m, int(y)), []).append(v)
    for m, y, v, oid, loc, pk, rs in rows:
        pv = preferred_values.get((m, int(y)), [])
        if len(pv) == 1 and pv[0] is not None and abs(pv[0] - v) >= 0.5:
            continue  # a lower-priority edition printing another value: the build's preferred value stands
        cands = out.setdefault((m, int(y)), [])
        if not any(abs(c["value"] - v) < 0.5 for c in cands):
            cands.append(
                {
                    "value": float(v),
                    "rec": f"obs:{m}@{pk}:{pref.get((m, y), oid)}",
                    "locator": loc,
                    "review_status": rs,
                }
            )
    for m, y, v, oid in con.execute(
        "SELECT measure_id, year, value, observation_id FROM preferred_observations WHERE geo_id = ? AND measure_id = ? AND value IS NOT NULL",
        [UT, CENSUS_RECEIPTS],
    ).fetchall():
        out[(m, int(y))] = [
            {
                "value": float(v),
                "rec": f"obs:{m}@state_fiscal_year:{oid}",
                "locator": None,
                "review_status": None,
            }
        ]
    return out


def _prov_line(concept_key: str, fy: int) -> list[dict]:
    doc = PROVISIONAL_REPORT_FOR_YEAR.get(fy)
    if doc is None:
        return []
    return [
        {
            "value": f["value_dollars"],
            "figure_id": f["figure_id"],
            "url": f["url"],
            "page": f["page"],
            "document": f["document"],
            "item": f["item_as_printed"],
            "check": f["check"],
        }
        for f in figures(UT, DABS_CONCEPTS[concept_key], fy, doc)
    ]


def _status_for_rate(r: DepositRate | None) -> str:
    return r.status if r else "unresolved"


def utah_bridge(con, years=range(2012, 2026), include_provisional: bool = True) -> list[dict]:
    """One row per fiscal year. Values in dollars. Sources: ``rec`` (a record in the build) or ``figure_id`` (a
    provisional figure). Missing stays None; nothing is filled."""
    pinned = _pinned(con)
    audited: dict[int, list[dict]] = {}
    for y, v, oid, pk in con.execute(
        "SELECT year, value, observation_id, period_kind FROM preferred_observations WHERE geo_id = ? AND measure_id = ? AND value IS NOT NULL",
        [UT, AUDITED_SALES],
    ).fetchall():
        audited.setdefault(int(y), []).append({"value": float(v), "rec": f"obs:{AUDITED_SALES}@{pk}:{oid}"})
    out = []
    for fy in years:

        def line(key, fy=fy):
            got = pinned.get((DABS_MEASURES[key], fy), [])
            if got:
                return [dict(c, provisional=False) for c in got]
            # A reading counts as provisional until it has been checked against the saved document.
            return (
                [dict(c, provisional=c["check"] == "not_saved") for c in _prov_line(key, fy)]
                if include_provisional
                else []
            )

        sales, school, enforcement = line("sales"), line("school_meals"), line("enforcement_fund")
        census = pinned.get((CENSUS_RECEIPTS, fy), [])
        acfr = [dict(c, provisional=False) for c in audited.get(fy, [])] or ([
            {"value": f["value_dollars"], "figure_id": f["figure_id"], "url": f["url"], "page": f["page"], "document": f["document"], "provisional": f["check"] == "not_saved"}
            for f in figures(UT, "fund_sales_revenues", fy)
        ] if include_provisional else [])  # fmt: skip
        if not sales or not (census or acfr):
            continue  # nothing to bridge: a year needs DABS's sales and something to compare them with
        rates = {d: deposit_rate(d, fy) for d in DEPOSITS}
        target = (
            {"kind": "census", "value": census[0]["value"]}
            if census
            else {"kind": "audited_fund_sales", "value": acfr[0]["value"]}
        )
        variants = []
        for s in sales:
            stat = {d: (rates[d].rate * s["value"] if rates[d] else None) for d in DEPOSITS}
            rep = {
                d: ([c["value"] for c in (school if d == "school_meals" else enforcement)] or [None])[0]
                for d in DEPOSITS
            }
            for kind, dep in (("statutory", stat), ("reported", rep)):
                if any(v is None for v in dep.values()):
                    res = None
                else:
                    res = s["value"] - sum(dep.values()) - target["value"]
                variants.append(
                    {
                        "sales": s["value"],
                        "kind": kind,
                        "school_meals": dep["school_meals"],
                        "enforcement_fund": dep["enforcement_fund"],
                        "sales_less_deposits": None
                        if any(v is None for v in dep.values())
                        else s["value"] - sum(dep.values()),
                        "residual": res,
                        "within_tolerance": None if res is None else abs(res) <= TOLERANCE_DOLLARS,
                    }
                )
        reported_share = {
            d: ([c["value"] for c in (school if d == "school_meals" else enforcement)] or [None])[0]
            for d in DEPOSITS
        }
        ok = [v for v in variants if v["within_tolerance"]]
        status = "reconciles_numerically" if ok else "unresolved"
        out.append(
            {
                "fiscal_year": fy,
                "dabs_sales": sales,
                "dabs_sales_conflict": len(sales) > 1,
                "reported_deposits": {"school_meals": school, "enforcement_fund": enforcement},
                "reported_share_of_sales": {
                    d: (
                        None
                        if reported_share[d] is None or not sales
                        else reported_share[d] / sales[0]["value"]
                    )
                    for d in DEPOSITS
                },
                "statutory_rates": {
                    d: (
                        None
                        if rates[d] is None
                        else {"rate": rates[d].rate, "rate_id": rates[d].rate_id, "status": rates[d].status}
                    )
                    for d in DEPOSITS
                },
                "census_receipts": census,
                "audited_fund_sales": acfr,
                "compared_with": target["kind"],
                "variants": variants,
                "reconciles_with": sorted({v["kind"] for v in ok}),
                "status": status,
                "uses_provisional": any(c.get("provisional") for c in sales + school + enforcement)
                or (target["kind"] == "audited_fund_sales" and bool(acfr[0].get("provisional"))),
            }
        )
    return out


# ----- one fiscal year, every accounting basis for the deposits ------------------------------------------------

COMBINED_TRANSFER = "ut_dabs_school_lunch_usf_public_safety_transfer"
BASES = ("statutory", "combined_transfer", "printed_lines", "school_only")


def deposit_bases(con, fy: int) -> list[dict]:
    """Every distinct accounting basis for what lies between DABS's sales and Census's receipts in one fiscal year,
    for each sales figure DABS prints: the equation's terms with their records and the residual (dollars).

    residual = DABS sales - deposits - Census receipts, where the deposits are
      statutory:          the school-meals and enforcement rates in law times the sales figure;
      combined_transfer:  DABS's income-statement transfer "School Lunch, Uniform School Fund and Public Safety";
      printed_lines:      the five-year summary's "School Lunch/Uniform School Fund" plus "Transfer to SBI";
      school_only:        the school-meals rate alone (the 2026-10-13 calculation, superseded).
    A basis whose terms are not all in the build is left out; nothing is filled."""
    pinned = _pinned(con)
    sales = pinned.get((DABS_MEASURES["sales"], fy), [])
    census = pinned.get((CENSUS_RECEIPTS, fy), [])
    if not sales or not census:
        return []
    school = pinned.get((DABS_MEASURES["school_meals"], fy), [])
    enforcement = pinned.get((DABS_MEASURES["enforcement_fund"], fy), [])
    combined = [
        {"value": float(v), "rec": f"obs:{COMBINED_TRANSFER}@{pk}:{oid}", "locator": loc}
        for v, oid, pk, loc in con.execute(
            "SELECT value, observation_id, period_kind, source_locator FROM observations WHERE geo_id = ? AND measure_id = ? AND year = ? AND value IS NOT NULL ORDER BY observation_id",
            [UT, COMBINED_TRANSFER, fy],
        ).fetchall()
    ][:1]
    rates = {d: deposit_rate(d, fy) for d in DEPOSITS}
    c = census[0]
    out = []
    for s in sales:
        terms: dict[str, list[dict]] = {}
        if all(rates.values()):
            terms["statutory"] = [
                {
                    "what": d,
                    "value": rates[d].rate * s["value"],
                    "rate_id": rates[d].rate_id,
                    "rate": rates[d].rate,
                }
                for d in DEPOSITS
            ]
            terms["school_only"] = [
                {
                    "what": "school_meals",
                    "value": rates["school_meals"].rate * s["value"],
                    "rate_id": rates["school_meals"].rate_id,
                    "rate": rates["school_meals"].rate,
                }
            ]
        if combined:
            terms["combined_transfer"] = [
                {"what": "combined", "value": combined[0]["value"], "rec": combined[0]["rec"]}
            ]
        if school and enforcement:
            terms["printed_lines"] = [
                {"what": "school_meals", "value": school[0]["value"], "rec": school[0]["rec"]},
                {"what": "enforcement_fund", "value": enforcement[0]["value"], "rec": enforcement[0]["rec"]},
            ]
        for basis in BASES:
            if basis not in terms:
                continue
            deducted = sum(t["value"] for t in terms[basis])
            out.append(
                {
                    "basis": basis,
                    "sales": {"value": s["value"], "rec": s["rec"]},
                    "deposits": terms[basis],
                    "deposits_total": deducted,
                    "census": {"value": c["value"], "rec": c["rec"]},
                    "residual": s["value"] - deducted - c["value"],
                }
            )
    return out


# ----- the two Utah formulas side by side ---------------------------------------------------------------------------

AUDITED_OPERATING_REVENUE = "ut_abs_fund_operating_revenues"
DABS_OTHER_INCOME = "ut_dabs_other_income"


def _one_value(con, measure: str, fy: int) -> float | None:
    """The build's preferred value; where the editions conflict (no preferred value), the lower printed value."""
    pref = con.execute(
        "SELECT value FROM preferred_observations WHERE geo_id = ? AND measure_id = ? AND year = ? AND value IS NOT NULL",
        [UT, measure, fy],
    ).fetchall()
    if len(pref) == 1:
        return float(pref[0][0])
    rows = con.execute(
        "SELECT min(value) FROM observations WHERE geo_id = ? AND measure_id = ? AND year = ? AND value IS NOT NULL",
        [UT, measure, fy],
    ).fetchone()
    return None if rows is None or rows[0] is None else float(rows[0])


def formula_change(con, years=range(2015, 2026)) -> list[dict]:
    """The two Utah formulas of 2026-10-14 side by side, in dollars, with one sign: DABS-based minus the comparator.

    bridge (utah-liquor-bridge@1.0, the morning):  DABS sales - statutory deposits - C, where C is Census's
        receipts, or the audited fund's sales where Census has no year (FY2025);
    revenue series (the evening):                  DABS sales - statutory deposits + DABS other income - A, where A
        is the audited fund's operating revenue (the ACFR's statistical series).
    The revenue series was printed as A minus the DABS-based figure (the opposite sign); here both use one sign.
    bridge - series = (A - C) - DABS other income exactly, so a residual changes between the two only through the
    comparator and the other income. Where DABS prints two figures (sales FY2024; other income FY2024-FY2025), the
    lower is used, as in the documentation. A year missing any term is left out; nothing is filled. The audited operating
    revenue is the latest edition's (the build's preference); the year's own edition, as first printed, is returned
    beside it (FY2023: 523,992 first printed, 506,492 restated in the FY2024 and FY2025 editions)."""
    out = []
    for fy in years:
        sales = _one_value(con, DABS_MEASURES["sales"], fy)
        other = _one_value(con, DABS_OTHER_INCOME, fy)
        census = _one_value(con, CENSUS_RECEIPTS, fy)
        audited_sales = _one_value(con, AUDITED_SALES, fy)
        op_rev = _one_value(con, AUDITED_OPERATING_REVENUE, fy)
        rates = {d: deposit_rate(d, fy) for d in DEPOSITS}
        comparator, comparator_kind = (
            (census, "census_receipts") if census is not None else (audited_sales, "audited_sales")
        )
        if sales is None or other is None or op_rev is None or comparator is None or not all(rates.values()):
            continue
        deposits = sum(rates[d].rate * sales for d in DEPOSITS)
        bridge = sales - deposits - comparator
        series = sales - deposits + other - op_rev
        first = _first_published(con, AUDITED_OPERATING_REVENUE, fy)
        out.append(
            {
                "fiscal_year": fy,
                "dabs_sales": sales,
                "statutory_deposits": deposits,
                "dabs_other_income": other,
                "comparator": comparator,
                "comparator_kind": comparator_kind,
                "audited_operating_revenue": op_rev,
                "bridge_residual": bridge,
                "series_residual": series,
                "comparator_gap": op_rev - comparator,
                "difference": bridge - series,
                # The fiscal year's own ACFR edition (its first printing), kept apart from the latest edition's
                # figure that the build prefers; None where that edition is not in the build.
                "audited_operating_revenue_first_published": first,
                "series_residual_first_published": None
                if first is None
                else sales - deposits + other - first,
            }
        )
    return out


def _first_published(con, measure: str, fy: int) -> float | None:
    """The value printed for fiscal year `fy` by that year's own State of Utah ACFR (asset utah_acfr_fy<fy>), or None."""
    cols = {c[0] for c in con.execute("DESCRIBE observations").fetchall()}
    if "asset_id" not in cols:
        return None
    rows = con.execute(
        "SELECT DISTINCT value FROM observations WHERE geo_id = ? AND measure_id = ? AND year = ? AND asset_id = ? AND value IS NOT NULL",
        [UT, measure, fy, f"utah_acfr_fy{fy}"],
    ).fetchall()
    return float(rows[0][0]) if len(rows) == 1 else None
