"""Constant-dollar and per-person conversions for the dashboard's dollar series (state fiscal years and
calendar years: any 12-month period containing one July 1).

These follow the conventions of the canonical derivations (transforms/derive.py), so a T10 value
converted here equals the canonical derived T10 value (a test checks this):

* Deflator: CPI-U (U.S. city average, all items, not seasonally adjusted) averaged over the 12 months
  of the observation's own fiscal year, rebased to the calendar-2024 average. A fiscal year is never
  relabelled as a calendar year. If any of the 12 months is missing, the converted value is missing.
* Denominator: the Census July 1 resident estimate whose date falls inside the fiscal year (all ages, or
  ages 21+). Never a NIAAA calendar-year denominator, never a different age universe.

Formulas (named and versioned as contracts.TRANSFORM_VERSION):
  constant dollars = nominal x CPI(base) / CPI(period)
  per person       = value / denominator
"""

from __future__ import annotations

from datetime import date

from alcohol_data.dashboard.contracts import TRANSFORM_VERSION

CPI_MEASURE = "bls_cpi_u_us_all_items_nsa"
BASE_YEAR = 2024
DENOMINATORS = {
    "per_resident": ("pop_total_resident", "Resident population, all ages (Census July 1 estimate)"),
    "per_resident_21plus": (
        "pop_age21plus_resident",
        "Resident population age 21 and older (Census July 1 estimate)",
    ),
}
METHODS = {
    "real_cy2024": f"{TRANSFORM_VERSION}:real_cy2024 = nominal x CPI-U(2024 avg) / CPI-U(avg of the period's 12 months)",
    "per_resident": f"{TRANSFORM_VERSION}:per_resident = nominal / Census July 1 resident population inside the period",
    "per_resident_21plus": f"{TRANSFORM_VERSION}:per_resident_21plus = nominal / Census July 1 population 21+ inside the period",
}


def constant_dollars(
    nominal: float | None, base_index: float | None, period_index: float | None
) -> float | None:
    """nominal x base / period. None when any input is missing or the period index is not positive."""
    if nominal is None or base_index is None or period_index is None or period_index <= 0:
        return None
    return nominal * base_index / period_index


def per_person(value: float | None, denominator: float | None) -> float | None:
    """value / denominator. None when either is missing or the denominator is not positive."""
    if value is None or denominator is None or denominator <= 0:
        return None
    return value / denominator


def months(start: date, end: date) -> list[tuple[int, int]]:
    out, y, m = [], start.year, start.month
    while (y, m) <= (end.year, end.month):
        out.append((y, m))
        m += 1
        if m == 13:
            y, m = y + 1, 1
    return out


def july1s(start: date, end: date) -> list[date]:
    return [date(y, 7, 1) for y in range(start.year, end.year + 1) if start <= date(y, 7, 1) <= end]


class Converter:
    """Holds the CPI and July 1 population inputs and converts one fiscal-year amount at a time."""

    def __init__(
        self,
        cpi: dict[tuple[int, int], tuple[float | None, str]],
        pop: dict[tuple[str, str, date], tuple[float | None, str]],
    ):
        self.cpi = cpi  # (year, month) -> (value, observation_id)
        self.pop = pop  # (measure_id, geo_id, july1) -> (value, observation_id)
        base = [cpi.get((BASE_YEAR, m)) for m in range(1, 13)]
        self.base_ids = [b[1] for b in base if b is not None]
        self.base = (
            sum(b[0] for b in base) / 12.0 if all(b is not None and b[0] is not None for b in base) else None
        )
        self.deflators: dict[str, dict] = {}

    def deflator(self, start: date, end: date) -> tuple[str | None, str | None]:
        """(deflator key, reason it is missing). Records the deflator and its inputs once per key."""
        key = f"cpi_fy:{start:%Y-%m}..{end:%Y-%m}"
        if key in self.deflators:
            d = self.deflators[key]
            return (key, None) if d["value"] is not None else (None, d["missing"])
        ms = months(start, end)
        got = [self.cpi.get(k) for k in ms]
        missing = [f"{y}-{m:02d}" for (y, m), g in zip(ms, got, strict=True) if g is None or g[0] is None]
        if len(ms) != 12:
            value, reason = None, f"period is {len(ms)} months, not a 12-month period"
        elif missing:
            value, reason = None, f"CPI-U month(s) missing: {', '.join(missing)}"
        else:
            value, reason = sum(g[0] for g in got) / 12.0, None
        self.deflators[key] = {
            "value": value,
            "missing": reason,
            "months": f"{ms[0][0]}-{ms[0][1]:02d}..{ms[-1][0]}-{ms[-1][1]:02d}" if ms else "",
            "observation_ids": [g[1] for g in got if g is not None],
        }
        return (key, None) if value is not None else (None, reason)

    def convert(self, row: dict) -> dict:
        """Constant-dollar and per-person versions of one fiscal-year amount, with inputs and reasons."""
        out: dict = {}
        start, end, geo, value = row["period_start"], row["period_end"], row["geo_id"], row["value"]
        if value is None:
            reason = f"nominal value missing ({row.get('missing_reason') or 'no reason'})"
            for t in ("real_cy2024", *DENOMINATORS):
                out[t] = {"value": None, "missing": reason, "inputs": [row["observation_id"]]}
            return out
        key, why = self.deflator(start, end)
        if self.base is None:
            key, why = None, f"CPI-U {BASE_YEAR} base months incomplete"
        out["real_cy2024"] = {
            "value": constant_dollars(value, self.base, self.deflators[key]["value"]) if key else None,
            "missing": why,
            "inputs": [row["observation_id"]] + ([key, f"cpi_base:{BASE_YEAR}"] if key else []),
        }
        j = july1s(start, end)
        for t, (measure, _label) in DENOMINATORS.items():
            p = self.pop.get((measure, geo, j[0])) if len(j) == 1 else None
            if len(j) != 1:
                why = "period does not contain exactly one July 1"
            elif p is None or p[0] is None:
                why = f"no Census July 1 {j[0].year} estimate for this population"
            else:
                why = None
            out[t] = {
                "value": per_person(value, p[0]) if p else None,
                "missing": why,
                "inputs": [row["observation_id"]] + ([p[1]] if p else []),
            }
        return out
