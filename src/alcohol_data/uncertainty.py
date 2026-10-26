"""Uncertainty for counts, and for counts averaged over multiple imputations. Standard library only.

Used for FARS deaths (``adapters/nhtsa_fars.py``) and the rates derived from them (``transforms/derive.py``).
Method version ``UNCERTAINTY_METHOD``. Nothing here estimates a policy effect: it says how much a count could
move by chance, never why it moved.

Two kinds of noise are kept apart and then combined:

* **Count noise.** FARS lists every fatal crash, so a year's deaths are not a sample. They are still one draw
  of a process that would give a different number in another year with the same underlying risk, which is what
  matters when a state's number is compared with its own earlier year or with another state's. Crashes are
  treated as Poisson and the deaths in each crash as given, so the deaths are compound Poisson: their variance
  is the sum over crashes of the squared deaths per crash (``sum_sq``), larger than the count itself whenever a
  crash kills more than one person. The interval is the exact Garwood interval of a scaled Poisson with that
  variance: ``phi * Garwood(count / phi)`` with ``phi = sum_sq / count``, which keeps the Garwood interval's
  good behaviour for the small counts of small states (a plus-or-minus-1.96-square-roots interval does not).
  Without ``sum_sq`` (``phi = 1``) it is the plain Poisson interval.
* **Imputation noise.** Where a crash's driver BAC was not reported, NHTSA supplies ten imputed values, so
  "alcohol-impaired-driving deaths" comes in ten versions, one per imputation. Their spread is real
  uncertainty about the missing BACs. Rubin's rules combine them: with ``m`` versions ``Q_1..Q_m``, the pooled
  estimate is their mean, the within-imputation variance ``W`` is the mean count noise, the between-imputation
  variance ``B`` is the sample variance of the ``Q_i``, and the total variance is ``T = W + (1 + 1/m) B``.

Two targets, two intervals (``uncertainty@1.2``).

* **The underlying expected number** (the risk the year's crashes are a draw from), the quantity to use when
  comparing years or states: total variance ``T = W + (1 + 1/m) B``, referred to Student's t with Rubin's
  (1987) degrees of freedom ``nu = (m - 1) * (1 + W / ((1 + 1/m) B))**2``, as NHTSA's own report on the FARS
  imputations does (Subramanian 2002, DOT HS 809 403). The interval keeps the Garwood interval's asymmetry:
  each one-sided distance is ``(t_nu / z) * sqrt(d_count**2 + (z * sqrt((1 + 1/m) B))**2)``, where ``d_count``
  is that side of the scaled Garwood interval. That is ``estimate +/- t_nu * sqrt(T)`` once the count is large
  enough for the Garwood interval to be symmetric, the Garwood interval itself when the imputations agree
  (``B = 0``, ``nu`` infinite), and ``estimate +/- t_(m-1) * sqrt((1 + 1/m) B)`` as the count noise vanishes.
  In the FARS years held (2000-2023) the imputation part is at most 56% of ``T`` (the nation, 2023), so ``nu``
  stays above 28 and ``t_nu`` is within 5% of ``z``; the median state-year is within 0.2%.
* **The deaths that actually occurred**, a fixed number once FARS is final: no count noise (``W = 0``), so
  only the imputation part, ``(1 + 1/m) B``, with ``m - 1`` degrees of freedom (Rubin's ``nu`` at ``W = 0``):
  ``estimate +/- t_(m-1) * sqrt((1 + 1/m) B)``, cut at zero and at the total deaths. With ``m = 10`` that
  multiplier is 2.262 against 1.960 for the normal, about 15% wider. ``realized_total_interval`` computes it;
  ``fars_traffic_fatalities`` has no such interval because nothing in it is imputed.

Both rest on NHTSA's imputations being proper in Rubin's sense; neither covers coding errors or the
imputation model being wrong.

The Census population in a rate is treated as exact. Its own error is small next to the count noise of a state,
and it is revised with each vintage, so a rate's interval is the count's interval divided by the population.
"""

from __future__ import annotations

import math
from collections.abc import Sequence
from dataclasses import dataclass
from statistics import NormalDist

UNCERTAINTY_METHOD = "uncertainty@1.2"

DEFAULT_LEVEL = 0.95


def z_for_level(level: float) -> float:
    """The z that bounds a two-sided interval of the given level (1.959964 for 0.95)."""
    if not 0 < level < 1:
        raise ValueError("level must be between 0 and 1")
    return NormalDist().inv_cdf(0.5 + level / 2)


# ----- the gamma distribution (for the exact Poisson interval) --------------------------------------------------


def _gamma_p(a: float, x: float) -> float:
    """Regularized lower incomplete gamma function P(a, x) (series below a + 1, continued fraction above)."""
    if x <= 0:
        return 0.0
    log_front = -x + a * math.log(x) - math.lgamma(a)
    if x < a + 1.0:
        term = total = 1.0 / a
        ap = a
        for _ in range(10_000):
            ap += 1.0
            term *= x / ap
            total += term
            if abs(term) < abs(total) * 1e-16:
                break
        return total * math.exp(log_front)
    tiny = 1e-300
    b = x + 1.0 - a
    c = 1.0 / tiny
    d = 1.0 / b
    h = d
    for i in range(1, 10_000):
        an = -i * (i - a)
        b += 2.0
        d = an * d + b
        if abs(d) < tiny:
            d = tiny
        c = b + an / c
        if abs(c) < tiny:
            c = tiny
        d = 1.0 / d
        delta = d * c
        h *= delta
        if abs(delta - 1.0) < 1e-16:
            break
    return 1.0 - math.exp(log_front) * h


def gamma_quantile(p: float, shape: float) -> float:
    """The x with P(Gamma(shape, scale 1) <= x) = p, by bisection (about 1e-12 relative accuracy)."""
    if not 0 < p < 1:
        raise ValueError("p must be between 0 and 1")
    if shape <= 0:
        raise ValueError("shape must be positive")
    lo, hi = 0.0, max(1.0, shape)
    while _gamma_p(shape, hi) < p:
        hi *= 2.0
    for _ in range(200):
        mid = 0.5 * (lo + hi)
        if _gamma_p(shape, mid) < p:
            lo = mid
        else:
            hi = mid
        if hi - lo <= 1e-13 * max(1.0, hi):
            break
    return 0.5 * (lo + hi)


def poisson_interval(count: float, level: float = DEFAULT_LEVEL) -> tuple[float, float]:
    """Exact (Garwood) interval for the mean of a Poisson variable observed as ``count``.

    ``count`` may be fractional (the mean of imputed counts): the gamma form of the interval is used, which
    reduces to the textbook chi-square form for whole counts. For 0 the lower end is 0 and the upper end is
    -ln(alpha / 2), 3.689 at 95%.
    """
    if count < 0 or not math.isfinite(count):
        raise ValueError("count must be a finite, non-negative number")
    alpha = 1.0 - level
    low = 0.0 if count == 0 else gamma_quantile(alpha / 2, count)
    high = gamma_quantile(1.0 - alpha / 2, count + 1.0)
    return low, high


# ----- Rubin's rules for counts --------------------------------------------------------------------------------


@dataclass(frozen=True)
class CountInterval:
    """An estimate of a count with its interval and the parts of its uncertainty."""

    estimate: float
    low: float
    high: float
    level: float
    #: total standard error, sqrt(T) = sqrt(W + (1 + 1/m) B); the Poisson part alone when m = 1
    se: float
    #: standard error from count noise alone, sqrt(W)
    count_se: float
    #: standard error from the spread between imputations, sqrt((1 + 1/m) B); 0 for a single count
    imputation_se: float
    #: number of imputations combined (1 for an ordinary count)
    m: int
    #: degrees of freedom of the t reference (Rubin's nu); infinite when there is no imputation part
    df: float = math.inf


def _scaled_poisson(count: float, variance: float, level: float) -> tuple[float, float]:
    """``phi * Garwood(count / phi)`` with ``phi = variance / count``; the plain interval when phi is 1 or undefined."""
    if count <= 0 or variance <= 0:
        return poisson_interval(count, level)
    phi = variance / count
    low, high = poisson_interval(count / phi, level)
    return phi * low, phi * high


def count_interval(count: float, level: float = DEFAULT_LEVEL, sum_sq: float | None = None) -> CountInterval:
    """Interval for an ordinary count: count noise only.

    ``sum_sq`` is the sum over crashes (events) of the squared count per crash; it is the variance of a compound
    Poisson count. Omitted, each event counts one and the variance is the count."""
    var = count if sum_sq is None else sum_sq
    low, high = _scaled_poisson(count, var, level)
    se = math.sqrt(var)
    return CountInterval(count, low, high, level, se, se, 0.0, 1)


def imputed_count_interval(
    versions: Sequence[float], level: float = DEFAULT_LEVEL, sums_sq: Sequence[float] | None = None
) -> CountInterval:
    """Interval for a count known through ``m`` imputed versions: Rubin's rules plus count noise.

    ``versions`` are the completed-data counts, one per imputation (for FARS, the ten sums of deaths in crashes
    whose imputed driver BAC reaches .08). ``sums_sq``, one per imputation, are the sums of squared deaths per
    crash over the same crashes: each is that completed data set's count variance, and their mean is Rubin's
    within-imputation variance ``W``. Omitted, ``W`` is the mean count (every crash one death).
    """
    m = len(versions)
    if m < 1:
        raise ValueError("at least one version is needed")
    if sums_sq is not None and len(sums_sq) != m:
        raise ValueError("one sum of squares per version is needed")
    q = sum(versions) / m
    if m == 1:
        return count_interval(q, level, None if sums_sq is None else sums_sq[0])
    within = q if sums_sq is None else sum(sums_sq) / m
    between = sum((v - q) ** 2 for v in versions) / (m - 1)
    imp_var = (1.0 + 1.0 / m) * between
    low_p, high_p = _scaled_poisson(q, within, level)
    z = z_for_level(level)
    df = rubin_df(within, imp_var, m)
    scale = 1.0 if math.isinf(df) else t_critical(level, df) / z
    h_imp = z * math.sqrt(imp_var)
    low = max(0.0, q - scale * math.hypot(q - low_p, h_imp))
    high = q + scale * math.hypot(high_p - q, h_imp)
    return CountInterval(
        q, low, high, level, math.sqrt(within + imp_var), math.sqrt(within), math.sqrt(imp_var), m, df
    )


def rubin_df(within: float, imputation_var: float, m: int) -> float:
    """Rubin's (1987) degrees of freedom, ``(m - 1) * (1 + 1/r)**2`` with ``r = imputation_var / within``.

    ``imputation_var`` is ``(1 + 1/m) B``. Infinite when the imputations agree (no imputation part); ``m - 1``
    when there is no within-imputation variance, as for a total that is a fixed fact. Barnard and Rubin's
    (1999) small-sample version reduces to this when the complete-data degrees of freedom are infinite, as they
    are for a count's large-sample inference."""
    if m < 2:
        raise ValueError("degrees of freedom need at least two imputations")
    if imputation_var <= 0:
        return math.inf
    if within <= 0:
        return float(m - 1)
    return (m - 1) * (1.0 + within / imputation_var) ** 2


@dataclass(frozen=True)
class RealizedInterval:
    """The deaths that actually occurred, known through imputations: uncertainty from the imputations only."""

    estimate: float
    low: float
    high: float
    level: float
    #: sqrt((1 + 1/m) B)
    se: float
    #: m - 1, or infinite when the imputations agree
    df: float
    m: int


def realized_total_interval(
    versions: Sequence[float], level: float = DEFAULT_LEVEL, upper: float | None = None
) -> RealizedInterval:
    """Interval for a realized total whose only uncertainty is the missing values that were imputed.

    No count noise enters (the total is a fixed fact), so the variance is ``(1 + 1/m) B`` with ``m - 1`` degrees
    of freedom. The interval is cut at zero and, when given, at ``upper`` (for FARS, the total deaths, which an
    imputed subset cannot exceed). With identical versions, or one version, it is the estimate itself."""
    m = len(versions)
    if m < 1:
        raise ValueError("at least one version is needed")
    q = sum(versions) / m
    if m == 1:
        return RealizedInterval(q, q, q, level, 0.0, math.inf, 1)
    between = sum((v - q) ** 2 for v in versions) / (m - 1)
    imp_var = (1.0 + 1.0 / m) * between
    df = rubin_df(0.0, imp_var, m)
    if math.isinf(df):
        return RealizedInterval(q, q, q, level, 0.0, df, m)
    se = math.sqrt(imp_var)
    half = t_critical(level, df) * se
    high = q + half if upper is None else min(upper, q + half)
    return RealizedInterval(q, max(0.0, q - half), high, level, se, df, m)


def rate_interval(
    interval: CountInterval, denominator: float, per: float = 100_000.0
) -> tuple[float, float, float]:
    """(rate, low, high) per ``per`` of the denominator, treating the denominator as exact."""
    if not denominator or denominator <= 0:
        raise ValueError("denominator must be positive")
    scale = per / denominator
    return interval.estimate * scale, interval.low * scale, interval.high * scale


def difference_z(a: float, se_a: float, b: float, se_b: float) -> float | None:
    """z statistic of a - b for independent estimates; None when both errors are zero."""
    se = math.hypot(se_a, se_b)
    return None if se == 0 else (a - b) / se


# ---- Student's t -------------------------------------------------------------------------------------------


def _betacf(a: float, b: float, x: float) -> float:
    """Continued fraction for the incomplete beta function (modified Lentz)."""
    tiny = 1e-300
    qab, qap, qam = a + b, a + 1.0, a - 1.0
    c = 1.0
    d = 1.0 - qab * x / qap
    d = 1.0 / (d if abs(d) > tiny else tiny)
    h = d
    for m in range(1, 400):
        m2 = 2 * m
        aa = m * (b - m) * x / ((qam + m2) * (a + m2))
        d = 1.0 + aa * d
        d = 1.0 / (d if abs(d) > tiny else tiny)
        c = 1.0 + aa / c
        c = c if abs(c) > tiny else tiny
        h *= d * c
        aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
        d = 1.0 + aa * d
        d = 1.0 / (d if abs(d) > tiny else tiny)
        c = 1.0 + aa / c
        c = c if abs(c) > tiny else tiny
        delta = d * c
        h *= delta
        if abs(delta - 1.0) < 1e-15:
            break
    return h


def _betainc(a: float, b: float, x: float) -> float:
    """Regularized incomplete beta function I_x(a, b)."""
    if x <= 0.0:
        return 0.0
    if x >= 1.0:
        return 1.0
    ln_front = math.lgamma(a + b) - math.lgamma(a) - math.lgamma(b) + a * math.log(x) + b * math.log1p(-x)
    front = math.exp(ln_front)
    if x < (a + 1.0) / (a + b + 2.0):
        return front * _betacf(a, b, x) / a
    return 1.0 - front * _betacf(b, a, 1.0 - x) / b


def t_cdf(t: float, df: float) -> float:
    """P(T <= t) for Student's t with ``df`` degrees of freedom."""
    if df <= 0:
        raise ValueError("df must be positive")
    tail = 0.5 * _betainc(df / 2.0, 0.5, df / (df + t * t))
    return 1.0 - tail if t > 0 else tail


def t_quantile(p: float, df: float) -> float:
    """The ``p`` quantile of Student's t with ``df`` degrees of freedom (bisection on the exact CDF)."""
    if not 0.0 < p < 1.0:
        raise ValueError("p must be strictly between 0 and 1")
    if p == 0.5:
        return 0.0
    if p < 0.5:
        return -t_quantile(1.0 - p, df)
    lo, hi = 0.0, 1.0
    while t_cdf(hi, df) < p:
        hi *= 2.0
        if hi > 1e12:
            break
    for _ in range(200):
        mid = 0.5 * (lo + hi)
        if t_cdf(mid, df) < p:
            lo = mid
        else:
            hi = mid
        if hi - lo < 1e-13 * max(1.0, hi):
            break
    return 0.5 * (lo + hi)


def t_critical(level: float, df: float) -> float:
    """Two-sided critical value: ``t_critical(0.95, 16)`` is about 2.12, against 1.96 for the normal."""
    return t_quantile(0.5 + level / 2.0, df)
