"""Direct age standardization of a rate, with an interval. Standard library only.

Method version ``AGE_ADJUST_METHOD``. Nothing here is wired into the dataset yet: the plan for that is in
docs/plans/denominators-and-deflators.md. It exists so the statistics are written and tested before the data
plumbing (age-group deaths from the FARS person files, age-group populations from Census PEP) is built.

**Why.** Utah's population is the youngest in the country, and the risk of dying in a crash is not the same at
every age, so a crude per-100,000 rate partly reflects who lives there. Direct standardization asks what the
state's age-specific rates would give in one fixed age structure, so states and years can be compared.

**Method.** With age-group deaths ``d_i`` and populations ``n_i``, the adjusted rate is ``R = sum(w_i * d_i / n_i)``
where ``w_i`` are the standard population's shares. Treating each ``d_i`` as Poisson, its variance is
``V = sum(w_i**2 * d_i / n_i**2)``. The interval is the gamma interval of Fay and Feuer (1997, Statistics in
Medicine 16:791-801), which is the one NCHS uses for age-adjusted rates and which stays valid when some age
groups have few or no deaths:

    lower = V / (2R) * chi2(alpha/2; 2R^2 / V)
    upper = (V + w_m^2) / (2 (R + w_m)) * chi2(1 - alpha/2; 2 (R + w_m)^2 / (V + w_m^2))

with ``w_m = max(w_i / n_i)``. Like the count intervals in ``uncertainty.py`` it measures chance variation in
the deaths given the populations, which it treats as exact.

**Standard.** The year 2000 U.S. standard population (NCHS, 18 five-year groups from 0-4 to 85+), as used for
the age-adjusted rates already in the dataset (CDC Chronic Disease Indicators). Changing the standard changes
every adjusted rate, so the standard is part of the measure's name when this is wired in.
"""

from __future__ import annotations

import math
from collections.abc import Sequence
from dataclasses import dataclass

from alcohol_data.uncertainty import DEFAULT_LEVEL, gamma_quantile

AGE_ADJUST_METHOD = "age-adjust@1.0"

GROUPS = (
    "0-4", "5-9", "10-14", "15-19", "20-24", "25-29", "30-34", "35-39", "40-44",
    "45-49", "50-54", "55-59", "60-64", "65-69", "70-74", "75-79", "80-84", "85+",
)  # fmt: skip

# NCHS year 2000 U.S. standard population, per 1,000,000, with the under-1 and 1-4 groups combined into 0-4
# (13,818 + 55,317).
STANDARD_2000_US = (
    69135, 72533, 73032, 72169, 66478, 64529, 71044, 80762, 81851,
    72118, 62716, 48454, 38793, 34264, 31773, 26999, 17842, 15508,
)  # fmt: skip
STANDARD_NAME = "us_2000_standard_5yr"


def five_year_group(age: int) -> int:
    """Index into GROUPS for a single year of age (85 and over share the last group)."""
    if age < 0:
        raise ValueError("age cannot be negative")
    return min(age // 5, len(GROUPS) - 1)


def spread_unknown(counts: Sequence[float], unknown: float) -> list[float]:
    """Share deaths of unknown age across the known age groups in proportion to their counts. Returns the counts
    unchanged when nothing is unknown, and raises when there is nothing to share them with."""
    known = sum(counts)
    if unknown == 0:
        return list(counts)
    if known <= 0:
        raise ValueError("cannot spread deaths of unknown age when no age group has a death")
    return [c * (known + unknown) / known for c in counts]


def chi2_quantile(p: float, df: float) -> float:
    """Chi-square quantile through the gamma quantile: chi2(p; df) = 2 * gamma(p; df / 2)."""
    return 2.0 * gamma_quantile(p, df / 2.0)


@dataclass(frozen=True)
class AgeAdjusted:
    rate: float
    se: float
    ci_low: float
    ci_high: float
    crude: float
    deaths: float
    population: float
    level: float
    per: float


def age_adjust(
    deaths: Sequence[float],
    population: Sequence[float],
    weights: Sequence[float] = STANDARD_2000_US,
    level: float = DEFAULT_LEVEL,
    per: float = 100_000.0,
) -> AgeAdjusted:
    """Age-adjusted rate per ``per`` with a Fay-Feuer interval, from deaths and populations by age group."""
    k = len(weights)
    if len(deaths) != k or len(population) != k:
        raise ValueError(f"deaths and population need {k} age groups to match the standard")
    if any(d < 0 for d in deaths):
        raise ValueError("deaths cannot be negative")
    if any(n <= 0 for n in population):
        raise ValueError("every age group needs a positive population")
    total_w = float(sum(weights))
    w = [x / total_w for x in weights]
    r = sum(wi * d / n for wi, d, n in zip(w, deaths, population, strict=True))
    v = sum(wi * wi * d / (n * n) for wi, d, n in zip(w, deaths, population, strict=True))
    w_m = max(wi / n for wi, n in zip(w, population, strict=True))
    alpha = 1.0 - level
    low = 0.0 if r == 0 or v == 0 else v / (2.0 * r) * chi2_quantile(alpha / 2.0, 2.0 * r * r / v)
    up = (
        (v + w_m**2)
        / (2.0 * (r + w_m))
        * chi2_quantile(1.0 - alpha / 2.0, 2.0 * (r + w_m) ** 2 / (v + w_m**2))
    )
    d_all, n_all = float(sum(deaths)), float(sum(population))
    return AgeAdjusted(
        rate=r * per,
        se=math.sqrt(v) * per,
        ci_low=low * per,
        ci_high=up * per,
        crude=d_all / n_all * per,
        deaths=d_all,
        population=n_all,
        level=level,
        per=per,
    )
