"""Comparison rules shared by reports, analysis code and the static explorer.

The defaults refuse comparisons the data cannot support, with a plain reason:

* different geography levels (Salt Lake City vs Salt Lake County vs the Salt
  Lake metro vs Utah) unless the caller explicitly allows and labels it;
* different measures, units, age universes, beverages or period kinds;
* a trend line across a comparability break (it is split into segments);
* modeled small-area estimates (e.g. CDC PLACES) as causal outcomes;
* dividing per capita consumption by a drinking prevalence to get
  "consumption per drinker".
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Series:
    geo_id: str
    geo_level: str
    measure_id: str
    unit: str
    age_universe: str
    beverage: str
    period_kind: str
    method_family: str
    causal_outcome_eligible: bool = True


@dataclass(frozen=True)
class Verdict:
    ok: bool
    reasons: tuple[str, ...]
    label: str | None = None


def compatible(
    a: Series, b: Series, *, allow_geo_level_mismatch: bool = False, mismatch_label: str | None = None
) -> Verdict:
    reasons = []
    if a.geo_level != b.geo_level:
        if not allow_geo_level_mismatch:
            reasons.append(
                f"different geography levels ({a.geo_level} {a.geo_id} vs {b.geo_level} {b.geo_id}); "
                "a city, county, metro area and state are different populations"
            )
        elif not mismatch_label:
            reasons.append("geography-level mismatch allowed only with an explicit label")
    if a.measure_id != b.measure_id:
        reasons.append(f"different measures ({a.measure_id} vs {b.measure_id})")
    if a.unit != b.unit:
        reasons.append(f"different units ({a.unit} vs {b.unit})")
    if a.age_universe != b.age_universe:
        reasons.append(f"different age universes ({a.age_universe} vs {b.age_universe})")
    if a.beverage != b.beverage:
        reasons.append(f"different beverages ({a.beverage} vs {b.beverage})")
    if a.period_kind != b.period_kind:
        reasons.append(
            f"different period kinds ({a.period_kind} vs {b.period_kind}); fiscal and calendar years are not the same period"
        )
    return Verdict(
        not reasons, tuple(reasons), mismatch_label if not reasons and a.geo_level != b.geo_level else None
    )


def trend_segments(points: list[dict]) -> list[list[dict]]:
    """Split a time-ordered series wherever the comparability group changes or a year is missing.

    Each point needs 'year', 'value' and 'comparability_group'. Missing values end a
    segment and are never interpolated.
    """
    segments: list[list[dict]] = []
    current: list[dict] = []
    for p in sorted(points, key=lambda p: p["year"]):
        if p["value"] is None:
            if current:
                segments.append(current)
            current = []
            continue
        if current and (
            p["comparability_group"] != current[-1]["comparability_group"]
            or p["year"] != current[-1]["year"] + 1
        ):
            segments.append(current)
            current = []
        current.append(p)
    if current:
        segments.append(current)
    return segments


def causal_outcome_allowed(s: Series) -> Verdict:
    if s.method_family == "modeled_small_area":
        return Verdict(
            False,
            (
                "modeled small-area estimates (e.g. CDC PLACES) must not be used to evaluate local policy effects",
            ),
        )
    if not s.causal_outcome_eligible:
        return Verdict(False, (f"{s.measure_id} is not marked eligible as a causal outcome",))
    return Verdict(True, ())


def ratio_allowed(numerator: Series, denominator: Series) -> Verdict:
    """Guard derived ratios. Consumption per capita / drinking prevalence is not consumption per drinker."""
    reasons = []
    if numerator.method_family == "apparent_consumption" and denominator.unit == "percent":
        reasons.append(
            "dividing per capita consumption by a drinking prevalence does not give consumption per drinker "
            "(different sources, age universes and concepts)"
        )
    if numerator.age_universe != denominator.age_universe and "not_applicable" not in (
        numerator.age_universe,
        denominator.age_universe,
    ):
        reasons.append(f"age universes differ ({numerator.age_universe} vs {denominator.age_universe})")
    if numerator.geo_id != denominator.geo_id:
        reasons.append("numerator and denominator are different geographies")
    return Verdict(not reasons, tuple(reasons))
