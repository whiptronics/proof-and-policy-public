"""Policy exposure, preferred selection, derivations, comparison rules and manual-number parsing."""

from datetime import date

import pytest

from alcohol_data.compare import Series, causal_outcome_allowed, compatible, ratio_allowed, trend_segments
from alcohol_data.transforms import derive, policy, prefer
from alcohol_data.transforms.build import parse_manual_number

FAR_FUTURE = date(2099, 1, 1)


def ev(**kw):
    base = dict(
        policy_id="p",
        geo_id="state:49",
        policy_dimension="dim",
        policy_value="v",
        requires_local_adoption=False,
        effective_start=None,
        effective_end=None,
        end_status="superseded",
        known_in_effect_from=None,
        known_in_effect_through=None,
    )
    base.update(kw)
    return base


def rows(out, kind, value, year):
    return next(
        r for r in out if r["period_kind"] == kind and r["policy_value"] == value and r["year"] == year
    )


# ---------------------------------------------------------------- policy exposure


def test_midyear_change_gives_partial_fiscal_year_and_leap_year_days():
    events = [
        ev(
            policy_id="old",
            policy_value="a",
            known_in_effect_from=date(2019, 3, 26),
            effective_end=date(2019, 11, 1),
        ),
        ev(
            policy_id="new",
            policy_value="b",
            effective_start=date(2019, 11, 1),
            end_status="open_current",
            known_in_effect_through=date(2026, 10, 6),
        ),
    ]
    out = policy.expand(events, (2019, 2021), FAR_FUTURE)
    fy2020 = rows(out, "state_fiscal_year", "b", 2020)  # Jul 1 2019 - Jun 30 2020 (contains Feb 29)
    assert fy2020["days_in_period"] == 366
    assert fy2020["covered_days"] == 243 and fy2020["known_other_days"] == 123 and fy2020["unknown_days"] == 0
    assert fy2020["exposure_status"] == "exposed_partial"
    assert fy2020["exposure_fraction"] == pytest.approx(243 / 366)
    cy2019 = rows(out, "calendar_year", "b", 2019)
    assert (
        cy2019["unknown_days"] == 84
        and cy2019["exposure_status"] == "unknown"
        and cy2019["exposure_fraction"] is None
    )
    assert rows(out, "calendar_year", "b", 2020)["exposure_status"] == "exposed_full"
    assert rows(out, "calendar_year", "a", 2020)["exposure_status"] == "not_exposed"


def test_unknown_start_is_never_carried_backward():
    events = [
        ev(
            policy_value="not_permitted",
            end_status="open_current",
            known_in_effect_from=date(2026, 5, 6),
            known_in_effect_through=date(2026, 10, 6),
        )
    ]
    out = policy.expand(events, (2015, 2026), FAR_FUTURE)
    assert all(r["exposure_status"] == "unknown" and r["covered_days"] == 0 for r in out if r["year"] < 2026)


def test_open_interval_not_carried_past_known_date():
    events = [
        ev(effective_start=date(2016, 7, 1), end_status="unknown", known_in_effect_through=date(2016, 7, 1))
    ]
    out = policy.expand(events, (2016, 2018), FAR_FUTURE)
    assert rows(out, "calendar_year", "v", 2017)["covered_days"] == 0
    assert rows(out, "calendar_year", "v", 2017)["exposure_status"] == "unknown"


def test_local_option_never_counts_as_statewide_exposure():
    events = [
        ev(
            policy_value="permitted_local_option",
            requires_local_adoption=True,
            effective_start=date(2016, 7, 1),
            end_status="open_current",
            known_in_effect_through=date(2020, 12, 31),
        )
    ]
    out = policy.expand(events, (2017, 2018), FAR_FUTURE)
    r = rows(out, "calendar_year", "permitted_local_option", 2017)
    assert r["exposure_status"] == "local_option_unknown" and r["exposure_fraction"] is None


def test_conflicting_values_detected_and_treated_as_unknown():
    events = [
        ev(policy_id="x", policy_value="a", effective_start=date(2020, 1, 1), effective_end=date(2021, 1, 1)),
        ev(policy_id="y", policy_value="b", effective_start=date(2020, 6, 1), effective_end=date(2021, 1, 1)),
    ]
    assert len(policy.conflicts(events)) == 214
    r = rows(policy.expand(events, (2020, 2020), FAR_FUTURE), "calendar_year", "a", 2020)
    assert r["unknown_days"] == 214 and r["exposure_status"] == "unknown"


# ---------------------------------------------------------------- preferred selection


def obs(oid, asset, value, cell="c1"):
    return {"observation_id": oid, "asset_id": asset, "value": value, "cell_key": cell}


def test_priority_wins_and_every_candidate_kept():
    sel = prefer.rank_cells([obs("o1", "old", 1.0), obs("o2", "new", 2.0)], {"old": 10, "new": 20})
    assert [(s["observation_id"], s["rank"]) for s in sel] == [("o2", 1), ("o1", 2)]
    assert "highest priority" in sel[0]["reason"]


def test_tied_different_values_are_an_unresolved_conflict():
    sel = prefer.rank_cells([obs("o1", "a", 260_082_000.0), obs("o2", "a", 260_821_000.0)], {"a": 20})
    assert all(s["reason"].startswith("unresolved_conflict") for s in sel)


def test_tied_identical_values_are_not_a_conflict():
    sel = prefer.rank_cells([obs("o1", "a", 5.0), obs("o2", "b", 5.0)], {"a": 20, "b": 20})
    assert not any(s["reason"].startswith("unresolved_conflict") for s in sel)


# ---------------------------------------------------------------- derivations


def _p(oid, measure, geo, start, end, value, kind):
    return {
        "observation_id": oid,
        "measure_id": measure,
        "geo_id": geo,
        "period_start": start,
        "period_end": end,
        "period_kind": kind,
        "period_label": "x",
        "year": end.year,
        "subgroup": "all",
        "value": value,
        "missing_reason": None if value is not None else "unavailable",
        "quality_flags": None,
    }


def test_per_capita_uses_july1_inside_fiscal_year_and_cpi_needs_all_months():
    pref = [
        _p(
            "t",
            "stc_alcoholic_beverages_sales_tax",
            "state:47",
            date(2016, 7, 1),
            date(2017, 6, 30),
            187_125_000.0,
            "state_fiscal_year",
        ),
        _p(
            "p16",
            "pop_total_resident",
            "state:47",
            date(2016, 7, 1),
            date(2016, 7, 1),
            6_600_000.0,
            "point_in_time",
        ),
        _p(
            "p17",
            "pop_total_resident",
            "state:47",
            date(2017, 7, 1),
            date(2017, 7, 1),
            9_999_999.0,
            "point_in_time",
        ),
    ]
    for y in (2016, 2017, 2024):
        for m in range(1, 13):
            pref.append(
                _p(
                    f"c{y}{m}",
                    "bls_cpi_u_us_all_items_nsa",
                    "nation:us",
                    date(y, m, 1),
                    date(y, m, 28),
                    100.0 + y - 2016,
                    "month",
                )
            )
    out = {d["measure_id"]: (d, inputs) for d, inputs, _ in derive.derive(pref)}
    pc, inputs = out["stc_alcoholic_beverages_sales_tax_per_capita"]
    assert pc["value"] == pytest.approx(187_125_000 / 6_600_000) and inputs == ["t", "p16"]
    real, _ = out["stc_alcoholic_beverages_sales_tax_real_cy2024usd"]
    fy_avg = (6 * 100.0 + 6 * 101.0) / 12
    assert real["value"] == pytest.approx(187_125_000 * 108.0 / fy_avg)
    # Remove one fiscal-year month: the constant-dollar value must become missing, not estimated.
    pref = [x for x in pref if x["observation_id"] != "c201610"]
    out = {d["measure_id"]: d for d, _, _ in derive.derive(pref)}
    assert out["stc_alcoholic_beverages_sales_tax_real_cy2024usd"]["value"] is None
    assert out["stc_alcoholic_beverages_sales_tax_real_cy2024usd"]["missing_reason"] == "unavailable"


# ---------------------------------------------------------------- comparison rules


def s(**kw):
    base = dict(
        geo_id="state:49",
        geo_level="state",
        measure_id="m",
        unit="percent",
        age_universe="age_18_plus",
        beverage="all_alcohol",
        period_kind="survey_year",
        method_family="survey_direct",
    )
    base.update(kw)
    return Series(**base)


def test_salt_lake_city_is_not_utah():
    v = compatible(s(), s(geo_id="place:4967000", geo_level="place"))
    assert not v.ok and "geography levels" in v.reasons[0]
    labelled = compatible(
        s(),
        s(geo_id="place:4967000", geo_level="place"),
        allow_geo_level_mismatch=True,
        mismatch_label="Utah statewide vs Salt Lake City",
    )
    assert labelled.ok and labelled.label


def test_fiscal_vs_calendar_and_age_universe_mismatch_rejected():
    v = compatible(
        s(period_kind="state_fiscal_year"), s(period_kind="calendar_year", age_universe="age_21_plus")
    )
    assert not v.ok and len(v.reasons) == 2


def test_trend_split_at_comparability_break_and_missing_years():
    pts = [
        {"year": y, "value": 1.0, "comparability_group": "g|1995_2010" if y < 2011 else "g|2011_onward"}
        for y in range(2008, 2014)
    ]
    pts[-2]["value"] = None
    segs = trend_segments(pts)
    assert [[p["year"] for p in seg] for seg in segs] == [[2008, 2009, 2010], [2011], [2013]]


def test_places_not_causal_and_per_drinker_refused():
    assert not causal_outcome_allowed(s(method_family="modeled_small_area")).ok
    per_capita = s(
        measure_id="niaaa_ethanol_per_capita_14plus_all",
        unit="us_gallons_ethanol_per_person",
        age_universe="age_14_plus",
        method_family="apparent_consumption",
        period_kind="calendar_year",
    )
    prevalence = s(measure_id="brfss_drank_any_past_30d_pct")
    assert not ratio_allowed(per_capita, prevalence).ok


# ---------------------------------------------------------------- manual numbers


@pytest.mark.parametrize(
    "raw,expected", [("517,390", 517390.0), ("(317,370)", -317370.0), ("$ 1,750", 1750.0), ("-", 0.0)]
)
def test_accounting_numbers(raw, expected):
    assert parse_manual_number(raw)[0] == expected
    assert ("accounting_dash_read_as_zero" in parse_manual_number(raw)[1]) == (raw == "-")


# ---------------------------------------------------------------- as-of cutoff, bounds, segments


def test_days_after_as_of_are_future_not_history():
    events = [
        ev(
            policy_value="v",
            effective_start=date(2014, 1, 1),
            end_status="open_current",
            known_in_effect_through=date(2030, 1, 1),
        )
    ]
    r = rows(policy.expand(events, (2026, 2026), date(2026, 10, 6)), "calendar_year", "v", 2026)
    assert (r["covered_days"], r["future_days"], r["unknown_days"]) == (279, 86, 0)
    assert r["exposure_status"] == "period_not_complete" and r["exposure_fraction"] is None
    assert r["exposure_fraction_min"] == pytest.approx(279 / 365) and r["exposure_fraction_max"] == 1.0


def test_partial_fiscal_year_keeps_verified_days_and_bounds():
    events = [
        ev(
            policy_value="not_authorized",
            end_status="open_current",
            known_in_effect_from=date(2014, 1, 1),
            known_in_effect_through=date(2026, 10, 6),
        )
    ]
    r = rows(
        policy.expand(events, (2014, 2014), date(2026, 10, 6)), "state_fiscal_year", "not_authorized", 2014
    )
    assert (r["covered_days"], r["unknown_days"]) == (181, 184)  # Jan-Jun 2014 known, Jul-Dec 2013 unknown
    assert r["exposure_status"] == "unknown" and r["exposure_fraction"] is None
    assert r["exposure_fraction_min"] == pytest.approx(181 / 365) and r["exposure_fraction_max"] == 1.0


def test_transition_boundaries_day_before_of_and_after():
    events = [
        ev(
            policy_id="a",
            policy_value="old",
            known_in_effect_from=date(2019, 1, 1),
            effective_end=date(2019, 11, 1),
        ),
        ev(
            policy_id="b",
            policy_value="new",
            effective_start=date(2019, 11, 1),
            end_status="open_current",
            known_in_effect_through=date(2020, 12, 31),
        ),
    ]
    values, _, _ = policy.day_status(events, date(2026, 1, 1))
    assert values[date(2019, 10, 31)] == {"old"}
    assert values[date(2019, 11, 1)] == {"new"}
    assert values[date(2019, 11, 2)] == {"new"}
    assert date(2021, 1, 1) not in values  # not carried past known_in_effect_through


def test_segments_never_fill_unknown():
    events = [
        ev(
            policy_value="x",
            known_in_effect_from=date(2014, 1, 1),
            end_status="open_current",
            known_in_effect_through=date(2014, 12, 31),
        )
    ]
    segs = policy.segments(events, date(2015, 6, 30), start=date(2013, 1, 1))
    assert [(s["state"], s["segment_start"], s["segment_end"]) for s in segs] == [
        ("unknown", date(2013, 1, 1), date(2013, 12, 31)),
        ("x", date(2014, 1, 1), date(2014, 12, 31)),
        ("unknown", date(2015, 1, 1), date(2015, 6, 30)),
    ]


def test_conflict_shows_as_disputed_segment():
    events = [
        ev(policy_id="x", policy_value="a", effective_start=date(2020, 1, 1), effective_end=date(2020, 1, 3)),
        ev(policy_id="y", policy_value="b", effective_start=date(2020, 1, 2), effective_end=date(2020, 1, 3)),
    ]
    segs = policy.segments(events, date(2020, 1, 2), start=date(2020, 1, 1))
    assert [s["state"] for s in segs] == ["a", "disputed"]


# ---------------------------------------------------------------- review independence and claim scope


def _con_with(sql_tables: dict[str, str]):
    import duckdb

    con = duckdb.connect()
    for sql in sql_tables.values():
        con.execute(sql)
    return con


def test_machine_or_ai_cannot_be_recorded_as_human_review():
    from alcohol_data.validation.checks import c_review_independence

    con = _con_with(
        {
            "p": "CREATE TABLE policy_events AS SELECT 'p1' AS policy_id, 'maintainer_reviewed' AS legal_review_status, "
            "'Claude (AI assistant)' AS reviewer",
            "e": "CREATE TABLE policy_evidence AS SELECT 'e1' AS evidence_id, NULL::VARCHAR AS reviewed_by",
        }
    )
    bad, _ = c_review_independence(con)
    assert bad and "p1" in bad[0]
    con.execute("UPDATE policy_events SET reviewer = 'Ethan Whipple'")
    assert c_review_independence(con)[0] == []


def test_on_premise_provision_cannot_carry_a_grocery_claim():
    from alcohol_data.validation.checks import c_dependency_scope

    con = _con_with(
        {
            "d": """CREATE TABLE claim_dependencies AS SELECT * FROM (VALUES
        ('c', '32B-4-401(1)', 'general_prohibition', true, 'retail licensees = on-premise licenses only'),
        ('c', '32B-1-102', 'product_definition', true, 'all persons')) t(claim_id, provision, role, indispensable, actor_scope)"""
        }
    )
    bad, _ = c_dependency_scope(con)
    assert any("on-premise" in b for b in bad)
    assert any("no indispensable retailer_category" in b for b in bad)
