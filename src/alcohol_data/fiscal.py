"""State fiscal-year calendars (metadata/fiscal_years.csv)."""

from __future__ import annotations

import csv
from dataclasses import dataclass
from datetime import date, timedelta
from functools import lru_cache

from alcohol_data import paths

FISCAL_YEARS_CSV = paths.METADATA_DIR / "fiscal_years.csv"


@dataclass(frozen=True)
class FiscalRule:
    geo_id: str
    month: int
    day: int
    valid_from: int
    valid_to: int
    evidence: str
    verified: bool


@lru_cache(maxsize=1)
def rules() -> tuple[FiscalRule, ...]:
    with open(FISCAL_YEARS_CSV, encoding="utf-8", newline="") as f:
        return tuple(
            FiscalRule(
                r["geo_id"],
                int(r["fy_end_month"]),
                int(r["fy_end_day"]),
                int(r["valid_from_fy"]),
                int(r["valid_to_fy"]),
                r["evidence"],
                r["verified_against_source"].lower() == "true",
            )
            for r in csv.DictReader(f)
        )


def fiscal_rule(geo_id: str, fy_end_year: int) -> FiscalRule | None:
    specific = [r for r in rules() if r.geo_id == geo_id and r.valid_from <= fy_end_year <= r.valid_to]
    if specific:
        return specific[0]
    default = [r for r in rules() if r.geo_id == "*" and r.valid_from <= fy_end_year <= r.valid_to]
    return default[0] if default else None


def fiscal_period(fy_end: date) -> tuple[date, date]:
    """12-month period ending on fy_end (inclusive)."""
    try:
        start = fy_end.replace(year=fy_end.year - 1) + timedelta(days=1)
    except ValueError:  # Feb 29
        start = date(fy_end.year - 1, 3, 1)
    return start, fy_end


def fiscal_period_for(geo_id: str, fy_end_year: int) -> tuple[date, date, FiscalRule] | None:
    rule = fiscal_rule(geo_id, fy_end_year)
    if rule is None:
        return None
    end = date(fy_end_year, rule.month, rule.day)
    start, end = fiscal_period(end)
    return start, end, rule
