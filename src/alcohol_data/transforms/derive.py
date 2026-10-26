"""Derived measures. Each derived value records its exact inputs in lineage.

* T10 per resident and per resident 21+: the denominator is the Census July 1
  estimate whose date falls inside the state's fiscal year (never a NIAAA
  calendar-year denominator, never a different age universe).
* T10 in constant calendar-2024 dollars: deflated with the CPI-U average over the
  12 months of that state's fiscal year, rebased to the 2024 calendar-year
  average. If any required month is missing the derived value is missing too.
* Utah DABS fiscal-year totals by beverage: the sum of the twelve monthly Sales
  Analysis Reports of a fiscal year (July-June). A fiscal year with fewer than
  twelve monthly values gets no total at all (a partial sum is never a year).
"""

from __future__ import annotations

from datetime import date

DERIVED_ASSET = "project_derivations"
FORMULA_VERSION = "derive@1.0"
DERIVATION_FIRST_JULY1 = date(1990, 7, 1)
CPI = "bls_cpi_u_us_all_items_nsa"
T10 = "stc_alcoholic_beverages_sales_tax"


def _month_keys(start: date, end: date) -> list[tuple[int, int]]:
    out, y, m = [], start.year, start.month
    while (y, m) <= (end.year, end.month):
        out.append((y, m))
        m += 1
        if m == 13:
            y, m = y + 1, 1
    return out


DABS_MONTHLY = "ut_dabs_monthly_"


def dabs_fiscal_years(preferred: list[dict]) -> list[tuple[dict, list[str], str]]:
    """Fiscal-year sums of the DABS monthly measures, only for complete fiscal years."""
    by_fy: dict[tuple[str, str, int], dict[int, dict]] = {}
    for o in preferred:
        if not o["measure_id"].startswith(DABS_MONTHLY) or o["period_kind"] != "month":
            continue
        start = o["period_start"]
        fy = start.year + 1 if start.month >= 7 else start.year
        by_fy.setdefault((o["measure_id"], o["geo_id"], fy), {})[start.month] = o
    out = []
    for (measure, geo_id, fy), months in sorted(by_fy.items()):
        if sorted(months) != list(range(1, 13)) or any(m["value"] is None for m in months.values()):
            continue
        ordered = [months[m] for m in (7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6)]
        out.append(
            (
                {
                    "geo_id": geo_id,
                    "measure_id": measure.replace("_monthly_", "_fy_"),
                    "period_start": date(fy - 1, 7, 1),
                    "period_end": date(fy, 6, 30),
                    "period_kind": "state_fiscal_year",
                    "period_label": f"FY{fy}",
                    "year": fy,
                    "subgroup": "all",
                    "value": sum(m["value"] for m in ordered),
                    "missing_reason": None,
                    "source_locator": f"dabs_fy_sum: {measure} summed over the 12 monthly reports July {fy - 1} to June {fy}",
                    "comparability_group": f"derived|{measure.replace('_monthly_', '_fy_')}",
                    "quality_flags": [],
                },
                [m["observation_id"] for m in ordered],
                f"{FORMULA_VERSION}:dabs_fy_sum",
            )
        )
    return out


def derive(preferred: list[dict]) -> list[tuple[dict, list[str], str]]:
    """Return (staged-like dict, input observation ids, formula id) tuples."""
    pop: dict[tuple[str, str, date], dict] = {}
    cpi: dict[tuple[int, int], dict] = {}
    t10: list[dict] = []
    for o in preferred:
        if (
            o["measure_id"] in ("pop_total_resident", "pop_age21plus_resident")
            and o["period_kind"] == "point_in_time"
        ):
            pop[(o["measure_id"], o["geo_id"], o["period_start"])] = o
        elif o["measure_id"] == CPI and o["geo_id"] == "nation:us":
            cpi[(o["period_start"].year, o["period_start"].month)] = o
        elif (
            o["measure_id"] == T10
            and o["geo_id"].startswith("state:")
            and o["period_kind"] == "state_fiscal_year"
        ):
            t10.append(o)

    base_months = [cpi.get((2024, m)) for m in range(1, 13)]
    base = None
    if all(b is not None and b["value"] is not None for b in base_months):
        base = sum(b["value"] for b in base_months) / 12.0
    base_ids = [b["observation_id"] for b in base_months if b is not None]

    out = []
    for o in t10:
        start, end = o["period_start"], o["period_end"]
        july1s = [date(y, 7, 1) for y in range(start.year, end.year + 1) if start <= date(y, 7, 1) <= end]
        # Declared derivation range: fiscal years containing a July 1 from 1990 on (population coverage).
        if not july1s or july1s[0] < DERIVATION_FIRST_JULY1:
            continue
        common = {
            k: o[k]
            for k in (
                "geo_id",
                "period_start",
                "period_end",
                "period_kind",
                "period_label",
                "year",
                "subgroup",
            )
        }
        flags = [f for f in (o.get("quality_flags") or "").split("|") if f]
        for measure, pop_measure, fid in (
            ("stc_alcoholic_beverages_sales_tax_per_capita", "pop_total_resident", "t10_per_resident"),
            (
                "stc_alcoholic_beverages_sales_tax_per_resident_21plus",
                "pop_age21plus_resident",
                "t10_per_resident_21plus",
            ),
        ):
            p = pop.get((pop_measure, o["geo_id"], july1s[0])) if len(july1s) == 1 else None
            if o["value"] is None or p is None or not p["value"]:
                value, missing = None, (o["missing_reason"] if o["value"] is None else "unavailable")
                inputs = [o["observation_id"]] + ([p["observation_id"]] if p else [])
            else:
                value, missing = o["value"] / p["value"], None
                inputs = [o["observation_id"], p["observation_id"]]
            out.append(
                (
                    {
                        **common,
                        "measure_id": measure,
                        "value": value,
                        "missing_reason": missing,
                        "source_locator": f"{fid}: {T10} / {pop_measure} at {july1s[0].isoformat() if july1s else 'n/a'}",
                        "comparability_group": f"derived|{measure}",
                        "quality_flags": flags,
                    },
                    inputs,
                    f"{FORMULA_VERSION}:{fid}",
                )
            )
        months = [cpi.get(k) for k in _month_keys(start, end)]
        ok = (
            len(months) == 12
            and all(m is not None and m["value"] is not None for m in months)
            and base is not None
        )
        if o["value"] is None or not ok:
            value = None
            missing = o["missing_reason"] if o["value"] is None else "unavailable"
        else:
            fy_avg = sum(m["value"] for m in months) / 12.0
            value, missing = o["value"] * base / fy_avg, None
        out.append(
            (
                {
                    **common,
                    "measure_id": "stc_alcoholic_beverages_sales_tax_real_cy2024usd",
                    "value": value,
                    "missing_reason": missing,
                    "source_locator": f"t10_real_cy2024: {T10} x CPI-U(2024 avg) / CPI-U(avg {start:%Y-%m}..{end:%Y-%m})",
                    "comparability_group": "derived|stc_alcoholic_beverages_sales_tax_real_cy2024usd",
                    "quality_flags": flags,
                },
                [o["observation_id"]] + [m["observation_id"] for m in months if m is not None] + base_ids,
                f"{FORMULA_VERSION}:t10_real_cy2024",
            )
        )
    out.extend(dabs_fiscal_years(preferred))
    out.extend(fars_rates(preferred, pop))
    return out


FARS_RATES = {
    "fars_alcohol_impaired_driving_fatalities": "fars_alcohol_impaired_driving_deaths_per_100k",
    "fars_traffic_fatalities": "fars_traffic_deaths_per_100k",
}


def fars_rates(preferred: list[dict], pop: dict) -> list[tuple[dict, list[str], str]]:
    """FARS deaths per 100,000 residents: the calendar year's deaths over the Census July 1 estimate of the same
    year (all ages). Deaths are counted where the crash happened, so visitors' crashes count too.

    When the deaths carry an interval (``ci_low``/``ci_high``, from alcohol_data.uncertainty), the rate carries it
    divided by the same population: the population is treated as exact, so the rate's interval is the count's
    interval on a per-100,000 scale."""
    out = []
    for o in preferred:
        target = FARS_RATES.get(o["measure_id"])
        if target is None or o["period_kind"] != "calendar_year":
            continue
        p = pop.get(("pop_total_resident", o["geo_id"], date(o["year"], 7, 1)))
        interval: dict = {}
        if o["value"] is None or p is None or not p["value"]:
            value, missing = None, (o["missing_reason"] if o["value"] is None else "unavailable")
        else:
            value, missing = 100000.0 * o["value"] / p["value"], None
            scale = 100000.0 / p["value"]
            if o.get("ci_low") is not None and o.get("ci_high") is not None:
                interval = {
                    "ci_low": o["ci_low"] * scale,
                    "ci_high": o["ci_high"] * scale,
                    "ci_level": o.get("ci_level"),
                    "standard_error": o["standard_error"] * scale
                    if o.get("standard_error") is not None
                    else None,
                    "extra": {
                        "interval_basis": o.get("interval_basis") or "count_noise",
                        "population_treated_as_exact": True,
                    },
                }
        out.append(
            (
                {
                    **{
                        k: o[k]
                        for k in (
                            "geo_id",
                            "period_start",
                            "period_end",
                            "period_kind",
                            "period_label",
                            "year",
                            "subgroup",
                        )
                    },
                    "measure_id": target,
                    "value": value,
                    "missing_reason": missing,
                    "source_locator": f"fars_per_100k: 100000 x {o['measure_id']} / pop_total_resident at {o['year']}-07-01",
                    "comparability_group": f"derived|{target}",
                    "quality_flags": [],
                    **interval,
                },
                [o["observation_id"]] + ([p["observation_id"]] if p else []),
                f"{FORMULA_VERSION}:fars_per_100k",
            )
        )
    return out
