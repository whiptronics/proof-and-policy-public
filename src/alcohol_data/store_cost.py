"""How much state liquor-store expenditure moves with state liquor-store revenue. Standard library only.

Method version ``STORE_COST_METHOD``. Exploratory. It is shown beside one input of the Utah wine scenarios, the
share of sales that leaves with the sales ("avoidable operating cost"), and is never filled into it: it describes
the whole liquor-store systems of the Census panel (Utah is one of the 17 states), not Utah's avoidable costs,
and not an effect of any policy.

**Data.** Census state government finance, liquor stores: revenue (A90) and current operations expenditure
(E90), which *includes the purchase of liquor for resale*. One row per state and fiscal year, the 17 states that
ran liquor stores in the years Census published, FY1972 and FY1977-FY2015. Expenditure is therefore mostly cost
of goods, so the slope of expenditure on revenue is not the operating-cost share; the scenario subtracts the
cost-of-goods share (one minus the margin the reader uses) to get an operating-cost figure.

**Model.** For each horizon of ``k`` years, the change in expenditure on the change in revenue, with a separate
intercept for each end year (the end-year fixed effect, which takes out price and wage inflation that moves
every state's revenue and costs together): ``dE_{s,t} = a_t + beta * dR_{s,t} + e``, where ``d`` is the
difference between year ``t`` and year ``t - k`` of the same state. One-year changes read the short run, when
stores, systems and staff mostly stay; five-year changes read a longer run, when they can be closed or reduced.
Overlapping windows are not independent, so errors are clustered by state; the interval uses Student's t with
(states - 1) degrees of freedom and the usual small-sample factor (Stata's, and statsmodels' ``cluster``).

**Weighting.** Two readings are always reported together because they disagree and the disagreement is the
finding. "dollars" uses dollars as published, so the large systems (Pennsylvania, Ohio, Michigan) dominate.
"state_size_normalized" divides each state's revenue and expenditure by its own mean revenue, so every state
counts alike. Each carries a leave-one-state-out range for the slope.

**Closed or sold systems.** A state-year whose expenditure is under ``MIN_EXPENDITURE_SHARE`` of its revenue is
left out: that is Maine from FY2005, when it stopped running the business (revenue fell to about $25,000 a year
and expenditure to nearly nothing). Washington's last year in the data is FY2012.

**Which years.** ``run`` takes the last fiscal year of its sample. The estimate the dashboard shows stops at
``DISPLAY_LAST_YEAR`` (FY2015, the end of the IndFin and state-by-type files), so the Individual Unit Files
(FY2015-FY2024) never extend it on their own once they load. ``compare_extension`` runs the same model with the
later years added, as a stated comparison only: it leaves out state-years flagged as not measuring both items
(``EXCLUDED_FLAGS``), state-years from the added years that repeat the previous year's revenue or expenditure
exactly, and every difference whose two ends sit in different comparability groups.

**What it cannot say.** It cannot split cost of goods from operating cost within expenditure, it treats a state's
whole liquor-store system as one unit, and 17 clusters is few. Differences in the two weightings are larger than
either interval. Read the result as "the data do not pin this down", with the range, not as a point.
"""

from __future__ import annotations

import math
from collections import defaultdict
from dataclasses import asdict, dataclass, replace

from alcohol_data.uncertainty import t_critical

STORE_COST_METHOD = "store-cost@1.0"
MIN_EXPENDITURE_SHARE = 0.3
DEFAULT_HORIZONS = (1, 5)
# The shown estimate's last fiscal year: the loaded files before the Individual Unit Files end here.
DISPLAY_LAST_YEAR = 2015
# Parser flags (adapters/census_govfin.py) on a value that does not measure both items of a state-year.
EXCLUDED_FLAGS = ("census_expenditure_equals_revenue", "census_expenditure_without_revenue")
WEIGHTINGS = ("dollars", "state_size_normalized")
MEASURES = {
    "revenue": "census_liquor_stores_revenue",
    "expenditure": "census_liquor_stores_current_operations",
}


@dataclass(frozen=True)
class StateYear:
    geo_id: str
    year: int
    revenue: float
    expenditure: float
    # Comparability groups of the two values; a difference between rows of different groups is not used.
    group: str = ""
    # Quality flags of either value; a row carrying one of EXCLUDED_FLAGS is left out.
    flags: tuple[str, ...] = ()


@dataclass(frozen=True)
class Pair:
    geo_id: str
    year: int
    d_revenue: float
    d_expenditure: float


@dataclass(frozen=True)
class SlopeFit:
    beta: float
    se: float
    df: int
    ci_low: float
    ci_high: float
    n: int
    clusters: int
    year_groups: int


def repeats_previous_year(rows: list[StateYear], from_year: int) -> dict[tuple[str, int], str]:
    """State-years from ``from_year`` on whose revenue or expenditure equals the same state's previous fiscal year
    exactly (a value carried forward, not a new measurement), with which of the two repeats."""
    by = {(r.geo_id, r.year): r for r in rows}
    out: dict[tuple[str, int], str] = {}
    for (g, y), r in sorted(by.items()):
        prev = by.get((g, y - 1))
        if y < from_year or prev is None:
            continue
        same = [
            n
            for n in ("revenue", "expenditure")
            if getattr(r, n) is not None and getattr(r, n) == getattr(prev, n)
        ]
        if same:
            out[(g, y)] = " and ".join(same)
    return out


def prepare(rows: list[StateYear], repeats_from: int | None = None) -> tuple[list[StateYear], list[dict]]:
    """Keep state-years with positive revenue and an expenditure that is a plausible share of it. Returns the kept
    rows and the exclusions: one record per excluded state-year of a state that ran a system in some other year,
    and one summary record for states that never did (Census lists every state, with zeros). Rows flagged with one
    of ``EXCLUDED_FLAGS`` are left out, and so, from ``repeats_from`` on, are rows that repeat the previous year."""
    ever = {r.geo_id for r in rows if r.revenue is not None and r.revenue > 0}
    repeats = repeats_previous_year(rows, repeats_from) if repeats_from is not None else {}
    kept: list[StateYear] = []
    dropped: list[dict] = []
    never_states: set[str] = set()
    never_rows = 0
    for r in sorted(rows, key=lambda r: (r.geo_id, r.year)):
        flagged = sorted({f for f in r.flags if f in EXCLUDED_FLAGS})
        if r.geo_id not in ever:
            never_states.add(r.geo_id)
            never_rows += 1
        elif r.revenue is None or r.expenditure is None or not r.revenue > 0:
            dropped.append({"geo_id": r.geo_id, "year": r.year, "why": "no positive revenue"})
        elif flagged:
            dropped.append(
                {
                    "geo_id": r.geo_id,
                    "year": r.year,
                    "why": f"flagged {', '.join(flagged)}: not a measurement of both items",
                }
            )
        elif (r.geo_id, r.year) in repeats:
            dropped.append(
                {
                    "geo_id": r.geo_id,
                    "year": r.year,
                    "why": f"{repeats[(r.geo_id, r.year)]} "
                    f"{'equal' if ' and ' in repeats[(r.geo_id, r.year)] else 'equals'} the previous year's exactly "
                    "(carried forward)",
                }
            )
        elif r.expenditure / r.revenue < MIN_EXPENDITURE_SHARE:
            dropped.append(
                {
                    "geo_id": r.geo_id,
                    "year": r.year,
                    "why": f"expenditure under {MIN_EXPENDITURE_SHARE:.0%} of revenue: the system was closed, sold or leased",
                }
            )
        else:
            kept.append(r)
    if never_rows:
        dropped.append(
            {
                "geo_ids": sorted(never_states),
                "state_years": never_rows,
                "why": "the state ran no liquor-store system in any year (revenue zero or missing throughout)",
            }
        )
    return kept, dropped


def normalize(rows: list[StateYear]) -> list[StateYear]:
    """Divide each state's revenue and expenditure by the state's mean revenue."""
    total: dict[str, float] = defaultdict(float)
    count: dict[str, int] = defaultdict(int)
    for r in rows:
        total[r.geo_id] += r.revenue
        count[r.geo_id] += 1
    mean = {g: total[g] / count[g] for g in total}
    return [
        replace(r, revenue=r.revenue / mean[r.geo_id], expenditure=r.expenditure / mean[r.geo_id])
        for r in rows
    ]


def differences(rows: list[StateYear], k: int) -> list[Pair]:
    """Changes between year ``t - k`` and year ``t`` of the same state, where both years are present and in the
    same comparability groups (a change across a classification break is not a change in the state's system)."""
    by = {(r.geo_id, r.year): r for r in rows}
    out: list[Pair] = []
    for (g, y), r in sorted(by.items()):
        prev = by.get((g, y - k))
        if prev is not None and prev.group == r.group:
            out.append(Pair(g, y, r.revenue - prev.revenue, r.expenditure - prev.expenditure))
    return out


def across_groups(rows: list[StateYear], k: int) -> list[dict]:
    """The differences ``differences`` leaves out because their two ends are in different comparability groups."""
    by = {(r.geo_id, r.year): r for r in rows}
    return [
        {"geo_id": g, "from_year": y - k, "to_year": y}
        for (g, y), r in sorted(by.items())
        if (g, y - k) in by and by[(g, y - k)].group != r.group
    ]


def fit_slope(pairs: list[Pair], level: float = 0.95) -> SlopeFit | None:
    """OLS of d_expenditure on d_revenue with an intercept per end year and errors clustered by state."""
    n = len(pairs)
    groups: dict[int, list[Pair]] = defaultdict(list)
    for p in pairs:
        groups[p.year].append(p)
    if n < 4 or len(groups) < 1:
        return None
    # Year fixed effects: demean both variables within end year (exact for one set of dummies).
    xs: list[float] = []
    ys: list[float] = []
    states: list[str] = []
    for ps in groups.values():
        mx = sum(p.d_revenue for p in ps) / len(ps)
        my = sum(p.d_expenditure for p in ps) / len(ps)
        for p in ps:
            xs.append(p.d_revenue - mx)
            ys.append(p.d_expenditure - my)
            states.append(p.geo_id)
    sxx = sum(x * x for x in xs)
    if sxx <= 0:
        return None
    beta = sum(x * y for x, y in zip(xs, ys, strict=True)) / sxx
    resid = [y - beta * x for x, y in zip(xs, ys, strict=True)]
    score: dict[str, float] = defaultdict(float)
    for g, x, e in zip(states, xs, resid, strict=True):
        score[g] += x * e
    big_g = len(score)
    if big_g < 2:
        return None
    k_params = 1 + len(groups)
    if n <= k_params:
        return None
    scale = (big_g / (big_g - 1)) * ((n - 1) / (n - k_params))
    var = scale * sum(s * s for s in score.values()) / (sxx * sxx)
    se = math.sqrt(var)
    df = big_g - 1
    half = t_critical(level, df) * se
    return SlopeFit(beta, se, df, beta - half, beta + half, n, big_g, len(groups))


def leave_one_state_out(pairs: list[Pair]) -> dict | None:
    """The lowest and highest slope with each state dropped in turn."""
    out: list[tuple[float, str]] = []
    for g in sorted({p.geo_id for p in pairs}):
        f = fit_slope([p for p in pairs if p.geo_id != g])
        if f is not None:
            out.append((f.beta, g))
    if not out:
        return None
    lo, hi = min(out), max(out)
    return {"low": lo[0], "low_without": lo[1], "high": hi[0], "high_without": hi[1]}


def estimate(rows: list[StateYear], k: int, weighting: str, level: float = 0.95) -> dict | None:
    if weighting not in WEIGHTINGS:
        raise ValueError(f"weighting must be one of {WEIGHTINGS}")
    use = normalize(rows) if weighting == "state_size_normalized" else rows
    pairs = differences(use, k)
    fit = fit_slope(pairs, level)
    if fit is None:
        return None
    loo = leave_one_state_out(pairs)
    return {
        "horizon_years": k,
        "weighting": weighting,
        "level": level,
        **{key: (round(v, 6) if isinstance(v, float) else v) for key, v in asdict(fit).items()},
        "leave_one_state_out": None
        if loo is None
        else {key: (round(v, 6) if isinstance(v, float) else v) for key, v in loo.items()},
    }


def run(
    rows: list[StateYear],
    horizons: tuple[int, ...] = DEFAULT_HORIZONS,
    last_year: int | None = None,
    repeats_from: int | None = None,
) -> dict:
    """All horizons and both weightings, with the sample description. ``last_year`` ends the sample (the dashboard
    passes ``DISPLAY_LAST_YEAR``); later state-years are left out and counted. ``repeats_from`` leaves out
    state-years from that year on that repeat the previous year's revenue or expenditure."""
    later = [r for r in rows if last_year is not None and r.year > last_year]
    kept, dropped = prepare([r for r in rows if last_year is None or r.year <= last_year], repeats_from)
    if later:
        dropped.append(
            {
                "geo_ids": sorted({r.geo_id for r in later}),
                "state_years": len(later),
                "why": f"after FY{last_year}, the last year of this sample",
            }
        )
    specs = []
    for k in horizons:
        for w in WEIGHTINGS:
            e = estimate(kept, k, w)
            if e is not None:
                specs.append(e)
    revenue = sum(r.revenue for r in kept)
    states = sorted({r.geo_id for r in kept})
    crossing = {str(k): across_groups(kept, k) for k in horizons}
    return {
        "method": STORE_COST_METHOD,
        "outcome": "Census current operations expenditure of state liquor stores (E90), which includes the purchase of liquor for resale",
        "regressor": "Census revenue of state liquor stores (A90)",
        "model": "change over k years in expenditure on change in revenue, an intercept per end year, errors clustered by state, Student t with states - 1 degrees of freedom",
        "sample": {
            "state_years": len(kept),
            "states": states,
            "first_year": min((r.year for r in kept), default=None),
            "last_year": max((r.year for r in kept), default=None),
            "pooled_expenditure_per_revenue_dollar": None
            if revenue <= 0
            else round(sum(r.expenditure for r in kept) / revenue, 4),
            "last_year_allowed": last_year,
            "differences_left_out_across_comparability_groups": {k: len(v) for k, v in crossing.items()},
        },
        "excluded": dropped,
        "differences_across_comparability_groups": {k: v for k, v in crossing.items() if v},
        "estimates": specs,
    }


def compare_extension(rows: list[StateYear], base_last_year: int = DISPLAY_LAST_YEAR) -> dict:
    """The shown sample (through ``base_last_year``) beside the same model with every later year added, after the
    exclusions above. For each horizon and weighting: both slopes and intervals, and whether either slope falls
    outside the other's interval. A comparison to report, not an estimate to show."""
    base = run(rows, last_year=base_last_year)
    extended = run(rows, repeats_from=base_last_year + 1)
    key = lambda e: (e["horizon_years"], e["weighting"])  # noqa: E731
    ext = {key(e): e for e in extended["estimates"]}
    out = []
    for b in base["estimates"]:
        e = ext.get(key(b))
        if e is None:
            continue
        out.append(
            {
                "horizon_years": b["horizon_years"],
                "weighting": b["weighting"],
                "base": {n: b[n] for n in ("beta", "ci_low", "ci_high", "n", "clusters")},
                "extended": {n: e[n] for n in ("beta", "ci_low", "ci_high", "n", "clusters")},
                "change": round(e["beta"] - b["beta"], 6),
                "extended_outside_base_interval": not (b["ci_low"] <= e["beta"] <= b["ci_high"]),
                "base_outside_extended_interval": not (e["ci_low"] <= b["beta"] <= e["ci_high"]),
            }
        )
    return {
        "method": STORE_COST_METHOD,
        "base_sample": base["sample"],
        "extended_sample": extended["sample"],
        "extended_excluded": [x for x in extended["excluded"] if x.get("year", 0) > base_last_year],
        "extended_differences_across_comparability_groups": extended[
            "differences_across_comparability_groups"
        ],
        "slopes": out,
        "any_slope_outside_the_other_interval": any(
            s["extended_outside_base_interval"] or s["base_outside_extended_interval"] for s in out
        ),
    }
