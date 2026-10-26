"""Contracts for the dashboard export: schema version, metric families, cell states, curated registers.

The export reads the canonical database and the curated files; nothing here holds a research value.
"""

from __future__ import annotations

import csv
from pathlib import Path

from alcohol_data import paths

SCHEMA_VERSION = "dashboard-export@1.6"
TRANSFORM_VERSION = "dashboard-transform@1.0"

RESEARCH_DIR = paths.CURATED_DIR / "research"
GAPS_CSV = RESEARCH_DIR / "research_gaps.csv"
LEADS_CSV = RESEARCH_DIR / "source_leads.csv"
POLICY_DATES_CSV = RESEARCH_DIR / "policy_dates_overlay.csv"
CASES_DIR = paths.CONFIG_DIR / "dashboard" / "cases"
ANALYSES_DIR = paths.CONFIG_DIR / "dashboard" / "analyses"

# How a saved analysis may show its values (the Explore view's choices; the UI keeps the same list).
SHOWN = ("nominal", "real_cy2024", "per_resident", "per_resident_21plus", "index")
ANALYSIS_MAX_METRICS = 4
ANALYSIS_MAX_GEOS = 6
ANALYSIS_KEYS = {
    "analysis_id",
    "title",
    "question",
    "metrics",
    "geos",
    "years",
    "shown",
    "base_year",
    "policy_dimension",
    "notes",
    "cannot_show",
}

# Metric families shown in the coverage matrix. "measures.source_family" maps onto them.
FAMILIES = {
    "population": ("Population and age", "Census resident population estimates and NIAAA's denominators."),
    "fiscal": (
        "Fiscal",
        "Taxes, licenses, state-store sales, profits and transfers. Components overlap; none is a total.",
    ),
    "behavior": (
        "Drinking behavior (survey)",
        "BRFSS prevalence among adults 18+ and YRBS among high school students: shares of people, with "
        "confidence intervals.",
    ),
    "consumption": (
        "Purchases and apparent consumption",
        "NIAAA gallons of ethanol from sales and shipments (includes visitors and stock changes), and BEA spending "
        "by residents on alcohol bought to take away.",
    ),
    "policy": (
        "Policy (legal status)",
        "Days on which a coded legal status is verified, by policy dimension.",
    ),
    "context": (
        "Context (prices, income, businesses)",
        "CPI for constant-dollar conversions, BEA personal income, and County Business Patterns counts of private "
        "establishments (not alcohol outlets).",
    ),
    "health": (
        "Health outcomes",
        "Chronic liver disease deaths (CDC Chronic Disease Indicators, from death certificates). Not only "
        "alcohol-related.",
    ),
    "safety": (
        "Traffic safety",
        "FARS traffic deaths and alcohol-impaired-driving deaths (NHTSA's imputed driver BAC), counted where the "
        "crash happened.",
    ),
}
SOURCE_FAMILY_TO_FAMILY = {
    "population": "population",
    "finance": "fiscal",
    "behavior": "behavior",
    "consumption": "consumption",
    "context": "context",
    "safety": "safety",
    "health": "health",
}

# One code per coverage cell. Codes are words in the UI; the letters only keep the export small.
CELL_STATES = {
    "S": ("Sourced", "Value parsed by code from an official machine-readable file."),
    "D": ("Derived", "Computed by the project from sourced inputs; inputs and method are listed."),
    "U": (
        "Extracted, unreviewed",
        "Transcribed by hand from an official document; no person has checked it yet.",
    ),
    "R": ("Reviewed", "Transcribed by hand and checked by a named person."),
    "0": ("Observed zero", "The source reports zero. A real value, not a missing one."),
    "C": ("Conflict", "Sources (or tables of one source) disagree and no documented rule picks one."),
    "M": (
        "Missing (reason given)",
        "A row exists but the source did not publish a value; the reason is recorded.",
    ),
    "W": (
        "Suppressed by the source",
        "Withheld for confidentiality, small numbers or quality (e.g. Census 'D', CDC '****'). Never zero.",
    ),
    "N": ("Not applicable", "The concept does not apply (e.g. Census 'X': tax not imposed)."),
    ".": ("No record", "The series covers this jurisdiction in other years but has no row for this one."),
    "-": ("Not in this series", "This source does not cover the jurisdiction at all."),
    " ": ("Outside the series' years", "No jurisdiction has a row for this year in this series."),
    "K": ("Law known every day", "A coded legal status is verified for every day of the year."),
    "P": ("Law partly known", "A legal status is verified for some days; the rest are unknown."),
    "?": ("Law unknown", "No day of the year has a verified legal status."),
    "L": ("Local option, adoption unknown", "State law lets localities opt in; which did is unknown."),
    "F": ("Year not over", "Part of the year is after the build's as-of date."),
}
VALUE_CODES = {"S", "D", "U", "R", "0"}

GAP_COLUMNS = [
    "gap_id",
    "priority",
    "category",
    "title",
    "affected_measures",
    "affected_geos",
    "year_from",
    "year_to",
    "affected_periods",
    "why_it_matters",
    "blocks",
    "lead_ids",
    "next_action",
    "access_obstacle",
    "status",
    "owner",
    "updated_on",
]
GAP_CATEGORIES = {
    "case_fiscal": "Missing fiscal components for the worked example",
    "policy_dates": "Missing policy dates or continuity",
    "comparison_data": "Missing comparison data",
    "historical_extension": "Historical extension",
    "review": "Human review owed",
}
GAP_STATUSES = {"open", "in_progress", "waiting_on_owner", "blocked", "done"}
LEAD_COLUMNS = [
    "lead_id",
    "publisher",
    "title",
    "jurisdictions",
    "source_type",
    "landing_url",
    "direct_url",
    "periods",
    "access_status",
    "attempted",
    "needed_for",
    "next_action",
    "rights_note",
]
LEAD_ACCESS = {
    "verified_available",
    "manual_download_needed",
    "request_needed",
    "not_online",
    "blocked_access",
    "not_investigated",
    "acquired",
}

# Plain labels for the policy catalog's domains (metadata/policy_catalog.csv), used as timeline filters.
DOMAIN_LABELS = {
    "retail_permission": "Retail permissions (who may sell what)",
    "local_implementation": "Local implementation and local option",
    "retail_structure": "Retail structure (state or private)",
    "wholesale_structure": "Wholesale structure (state or private)",
    "special_channel": "Special channels (state-contract agencies)",
    "tax": "Excise taxes",
    "markup": "State markups",
    "pricing": "Price rules",
    "product_definition": "Product definitions",
    "sunday_sales": "Sunday sales",
    "sales_hours": "Sales hours",
    "delivery": "Delivery and shipping",
}


def read_csv(path: Path) -> list[dict]:
    if not path.is_file():
        return []
    with open(path, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def split(value: str | None) -> list[str]:
    return [v for v in (value or "").split("|") if v]


def check_registers(gaps: list[dict], leads: list[dict]) -> list[str]:
    """Problems in the curated research registers (empty list when clean)."""
    problems = []
    lead_ids = [r["lead_id"] for r in leads]
    gap_ids = [r["gap_id"] for r in gaps]
    for name, ids in (("gap", gap_ids), ("lead", lead_ids)):
        dupes = sorted({i for i in ids if ids.count(i) > 1})
        if dupes:
            problems.append(f"duplicate {name} ids: {dupes}")
    if gaps and list(gaps[0].keys()) != GAP_COLUMNS:
        problems.append("research_gaps.csv columns differ from the contract")
    if leads and list(leads[0].keys()) != LEAD_COLUMNS:
        problems.append("source_leads.csv columns differ from the contract")
    for g in gaps:
        if g["category"] not in GAP_CATEGORIES:
            problems.append(f"{g['gap_id']}: unknown category {g['category']}")
        if g["status"] not in GAP_STATUSES:
            problems.append(f"{g['gap_id']}: unknown status {g['status']}")
        if not g["priority"].isdigit():
            problems.append(f"{g['gap_id']}: priority must be a whole number")
        for lid in split(g["lead_ids"]):
            if lid not in lead_ids:
                problems.append(f"{g['gap_id']}: unknown lead {lid}")
        if (g["year_from"] and g["year_to"]) and int(g["year_from"]) > int(g["year_to"]):
            problems.append(f"{g['gap_id']}: year_from after year_to")
    for r in leads:
        if r["access_status"] not in LEAD_ACCESS:
            problems.append(f"{r['lead_id']}: unknown access_status {r['access_status']}")
        for gid in split(r["needed_for"]):
            if gid not in gap_ids:
                problems.append(f"{r['lead_id']}: needed_for names unknown gap {gid}")
    return problems
