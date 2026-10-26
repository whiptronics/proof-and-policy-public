"""Write web/src/lib/compare.vectors.json: verdicts of src/alcohol_data/compare.py on fixed cases.

The dashboard's TypeScript port (web/src/lib/compare.ts) is tested against these vectors, and
tests/test_dashboard_export.py fails if this file no longer matches what compare.py returns, so the
two implementations cannot drift apart silently.

    python scripts/make_compare_vectors.py
"""

from __future__ import annotations

import json
from dataclasses import asdict, replace
from pathlib import Path

from alcohol_data.compare import Series, compatible, ratio_allowed, trend_segments

OUT = Path(__file__).resolve().parents[1] / "web" / "src" / "lib" / "compare.vectors.json"

UT_T10 = Series(
    geo_id="state:49",
    geo_level="state",
    measure_id="stc_alcoholic_beverages_sales_tax",
    unit="usd_nominal",
    age_universe="not_applicable",
    beverage="all_alcohol",
    period_kind="state_fiscal_year",
    method_family="administrative_finance",
)
TN_T10 = replace(UT_T10, geo_id="state:47")
UT_WINE = Series(
    geo_id="state:49",
    geo_level="state",
    measure_id="niaaa_ethanol_per_capita_21plus_wine",
    unit="us_gallons_ethanol_per_person",
    age_universe="age_21_plus",
    beverage="wine",
    period_kind="calendar_year",
    method_family="apparent_consumption",
)
UT_ANY = Series(
    geo_id="state:49",
    geo_level="state",
    measure_id="brfss_drank_any_past_30d_pct",
    unit="percent",
    age_universe="age_18_plus",
    beverage="all_alcohol",
    period_kind="survey_year",
    method_family="survey_direct",
)
SLC = replace(UT_ANY, geo_id="place:4967000", geo_level="place")


def vectors() -> dict:
    pairs = [
        ("same measure, two states", UT_T10, TN_T10, {}),
        ("fiscal tax vs calendar consumption", UT_T10, UT_WINE, {}),
        ("consumption vs prevalence", UT_WINE, UT_ANY, {}),
        ("state vs city, not allowed", UT_ANY, SLC, {}),
        ("state vs city, allowed without label", UT_ANY, SLC, {"allow_geo_level_mismatch": True}),
        (
            "state vs city, allowed with label",
            UT_ANY,
            SLC,
            {"allow_geo_level_mismatch": True, "mismatch_label": "Utah (state) vs Salt Lake City (place)"},
        ),
        (
            "wine vs all beverages",
            UT_WINE,
            replace(UT_WINE, measure_id="niaaa_ethanol_per_capita_21plus_all", beverage="all_alcohol"),
            {},
        ),
        ("age 21+ vs 14+", UT_WINE, replace(UT_WINE, age_universe="age_14_plus"), {}),
    ]
    out = {"compatible": [], "ratio_allowed": [], "trend_segments": []}
    for name, a, b, kw in pairs:
        v = compatible(a, b, **kw)
        out["compatible"].append(
            {
                "name": name,
                "a": asdict(a),
                "b": asdict(b),
                "opts": {
                    "allowGeoLevelMismatch": kw.get("allow_geo_level_mismatch", False),
                    "mismatchLabel": kw.get("mismatch_label"),
                },
                "ok": v.ok,
                "reasons": list(v.reasons),
                "label": v.label,
            }
        )
    for name, a, b in [
        ("consumption per drinker", UT_WINE, UT_ANY),
        ("tax per 21+ population", UT_T10, replace(UT_ANY, unit="persons", age_universe="age_21_plus")),
        ("different places", UT_T10, TN_T10),
    ]:
        v = ratio_allowed(a, b)
        out["ratio_allowed"].append(
            {"name": name, "a": asdict(a), "b": asdict(b), "ok": v.ok, "reasons": list(v.reasons)}
        )
    points = [
        {"year": 2008, "value": 1.0, "comparability_group": "a"},
        {"year": 2009, "value": 2.0, "comparability_group": "a"},
        {"year": 2010, "value": None, "comparability_group": "a"},
        {"year": 2011, "value": 3.0, "comparability_group": "b"},
        {"year": 2012, "value": 4.0, "comparability_group": "b"},
        {"year": 2014, "value": 5.0, "comparability_group": "b"},
        {"year": 2015, "value": 0.0, "comparability_group": "c"},
    ]
    out["trend_segments"].append(
        {"points": points, "segments": [[p["year"] for p in seg] for seg in trend_segments(points)]}
    )
    return out


def render() -> str:
    return json.dumps(vectors(), indent=1, ensure_ascii=False) + "\n"


if __name__ == "__main__":
    OUT.write_text(render(), encoding="utf-8", newline="\n")
    print(f"wrote {OUT}")
