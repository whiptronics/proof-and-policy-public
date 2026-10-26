"""Descriptive outputs: series for named states, peer-comparison inputs, policy timeline.

Everything here is descriptive. Peer-comparison inputs describe pre-period levels and
trends for every state; they do not choose comparison states, and they use only
pre-policy years (Tennessee's change took effect 2016-07-01), never outcomes measured
after a policy.
"""

from __future__ import annotations

import csv
from pathlib import Path

import duckdb

from alcohol_data import paths
from alcohol_data.compare import trend_segments

OUT_DIR = paths.PROCESSED_DIR / "descriptive"
SERIES_MEASURES = (
    "niaaa_ethanol_per_capita_21plus_wine",
    "niaaa_ethanol_per_capita_21plus_all",
    "brfss_drank_any_past_30d_pct",
    "brfss_binge_5m_4f_pct",
    "stc_alcoholic_beverages_sales_tax_per_resident_21plus",
    "stc_alcoholic_beverages_sales_tax_real_cy2024usd",
)
FOCUS_STATES = ("state:49", "state:47")
PRE_PERIOD = (2011, 2015)  # one BRFSS comparability group; ends before Tennessee's 2016-07-01 change
GROCERY_WINE = "ordinary_grocery_wine_authorization"


def _write(path: Path, header: list[str], rows: list) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(header)
        w.writerows(rows)


def _slope(points: list[tuple[int, float]]) -> float | None:
    if len(points) < 3:
        return None
    n = len(points)
    mx = sum(x for x, _ in points) / n
    my = sum(y for _, y in points) / n
    den = sum((x - mx) ** 2 for x, _ in points)
    return sum((x - mx) * (y - my) for x, y in points) / den if den else None


def descriptive_outputs(database: Path | None = None, out_dir: Path = OUT_DIR) -> list[Path]:
    con = duckdb.connect(str(database or paths.DATABASE_PATH), read_only=True)
    try:
        q = f"""
            SELECT s.geo_id, s.state, s.measure_id, s.measure_label, s.unit, s.age_universe, s.period_kind,
                   s.period_label, s.year, s.value, s.missing_reason, d.ci_low, d.ci_high, s.comparability_group,
                   s.source_series, s.source_vintage, s.observation_id,
                   e.legal_days AS grocery_wine_value, e.unknown_days AS grocery_wine_exposure
            FROM state_year_long s
            LEFT JOIN observation_details d USING (observation_id)
            LEFT JOIN (
                SELECT geo_id, period_kind, year,
                       string_agg(policy_value || ':' || covered_days, '|' ORDER BY policy_value)
                           FILTER (WHERE covered_days > 0) AS legal_days,
                       max(unknown_days) AS unknown_days
                FROM policy_exposure WHERE policy_dimension = '{GROCERY_WINE}' GROUP BY ALL
            ) e ON e.geo_id = s.geo_id AND e.year = s.year
                 AND e.period_kind = CASE WHEN s.period_kind = 'state_fiscal_year' THEN 'state_fiscal_year' ELSE 'calendar_year' END
            WHERE s.geo_id IN {FOCUS_STATES} AND s.measure_id IN {SERIES_MEASURES}
            ORDER BY s.measure_id, s.geo_id, s.period_start"""
        cols = [d[0] for d in con.execute(q + " LIMIT 0").description]
        rows = [dict(zip(cols, r, strict=True)) for r in con.execute(q).fetchall()]
        out_rows = []
        for m in SERIES_MEASURES:
            for g in FOCUS_STATES:
                pts = [r for r in rows if r["measure_id"] == m and r["geo_id"] == g]
                seg_of = {}
                for i, seg in enumerate(trend_segments(pts), start=1):
                    for p in seg:
                        seg_of[p["observation_id"]] = i
                for r in pts:
                    out_rows.append(
                        [
                            r["state"],
                            r["measure_id"],
                            r["measure_label"],
                            r["unit"],
                            r["age_universe"],
                            r["period_kind"],
                            r["period_label"],
                            r["year"],
                            r["value"],
                            r["missing_reason"],
                            r["ci_low"],
                            r["ci_high"],
                            r["comparability_group"],
                            seg_of.get(r["observation_id"]),
                            r["grocery_wine_value"] or "",
                            r["grocery_wine_exposure"] if r["grocery_wine_exposure"] is not None else "",
                            r["source_series"],
                            r["source_vintage"],
                            r["observation_id"],
                        ]
                    )
        series_path = out_dir / "ut_tn_series.csv"
        _write(
            series_path,
            [
                "state",
                "measure_id",
                "measure_label",
                "unit",
                "age_universe",
                "period_kind",
                "period_label",
                "year",
                "value",
                "missing_reason",
                "ci_low",
                "ci_high",
                "comparability_group",
                "trend_segment",
                "grocery_wine_verified_days_by_value",
                "grocery_wine_unknown_days",
                "source_series",
                "source_vintage",
                "observation_id",
            ],
            out_rows,
        )

        lo, hi = PRE_PERIOD
        q2 = f"""SELECT geo_id, state, state_name, measure_id, unit, year, value, comparability_group
                 FROM state_year_long WHERE measure_id IN {SERIES_MEASURES} AND year BETWEEN {lo} AND {hi}
                 ORDER BY geo_id, measure_id, year"""
        peers: dict[tuple, dict] = {}
        for geo, st, name, m, unit, y, v, grp in con.execute(q2).fetchall():
            k = (geo, st, name, m, unit)
            p = peers.setdefault(k, {"pts": [], "groups": set(), "missing": 0})
            if v is None:
                p["missing"] += 1
            else:
                p["pts"].append((y, v))
                p["groups"].add(grp)
        peer_rows = []
        for (geo, st, name, m, unit), p in sorted(peers.items()):
            vals = [v for _, v in p["pts"]]
            slope = _slope(p["pts"])
            peer_rows.append(
                [
                    geo,
                    st,
                    name,
                    m,
                    unit,
                    f"{lo}-{hi}",
                    len(vals),
                    p["missing"],
                    round(sum(vals) / len(vals), 6) if vals else None,
                    round(slope, 6) if slope is not None else None,
                    "|".join(sorted(p["groups"])) if len(p["groups"]) > 1 else "",
                ]
            )
        peer_path = out_dir / "peer_comparison_inputs.csv"
        _write(
            peer_path,
            [
                "geo_id",
                "state",
                "state_name",
                "measure_id",
                "unit",
                "pre_period",
                "years_with_values",
                "years_missing",
                "pre_period_mean",
                "pre_period_slope_per_year",
                "mixed_comparability_groups_warning",
            ],
            peer_rows,
        )

        q3 = """SELECT p.geo_id, g.abbreviation, p.policy_dimension, p.policy_value, p.effective_start,
                       p.effective_start_precision, p.effective_end, p.end_status, p.known_in_effect_from,
                       p.known_in_effect_through, p.requires_local_adoption, p.temporal_status, p.legal_review_status, p.claim_status,
                       count(e.evidence_id) AS evidence_rows,
                       string_agg(DISTINCT e.evidence_strength, '|' ORDER BY e.evidence_strength) AS evidence_strength,
                       p.policy_id
                FROM policy_events p JOIN geographies g USING (geo_id)
                LEFT JOIN policy_evidence e USING (policy_id)
                GROUP BY ALL ORDER BY p.geo_id, p.policy_dimension, coalesce(min(p.effective_start), min(p.known_in_effect_from))"""
        timeline_path = out_dir / "policy_timeline.csv"
        _write(
            timeline_path,
            [d[0] for d in con.execute(q3 + " LIMIT 0").description],
            con.execute(q3).fetchall(),
        )
    finally:
        con.close()
    readme = out_dir / "README.md"
    readme.write_text(
        "# Descriptive outputs\n\n"
        "- `ut_tn_series.csv`: Utah and Tennessee series with confidence intervals, comparability groups and\n"
        "  `trend_segment` (a new segment starts at every comparability break or missing year: never draw one\n"
        "  line across segments), plus the coded grocery-wine status for the same year.\n"
        f"- `peer_comparison_inputs.csv`: every state's {lo}-{hi} mean and linear slope per measure, with counts of\n"
        "  years with and without values. Inputs only: they do not select comparison states, and they cover\n"
        "  only years before Tennessee's 2016-07-01 change.\n"
        "- `policy_timeline.csv`: coded intervals with evidence counts and review status.\n\n"
        "Descriptive only. Differences between states or years are not policy effects. NIAAA values are\n"
        "calendar years, Census tax values are state fiscal years, and BRFSS values are survey years.\n",
        encoding="utf-8",
        newline="\n",
    )
    return [series_path, peer_path, timeline_path, readme]
