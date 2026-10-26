"""Data checks run against the built database.

Severity: error (fails 'alcohol-data validate'), warn (reported, review needed), info
(reconciliation results worth publishing either way). The release profile adds the
release gates: no untraceable values, no unknown units, no conflicting values
leaking into preferred_observations, no 'reviewed' claim without review evidence.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path

import duckdb

from alcohol_data import paths
from alcohol_data.schemas import vocab
from alcohol_data.schemas.tables import ALL_TABLES


@dataclass
class CheckResult:
    name: str
    severity: str
    failed: bool
    summary: str
    details: list = field(default_factory=list)


CHECKS = []


def check(name: str, severity: str, profiles=("dev", "release")):
    def deco(fn):
        CHECKS.append((name, severity, profiles, fn))
        return fn

    return deco


def _rows(con, sql, params=None):
    return con.execute(sql, params or []).fetchall()


def _vals(xs) -> str:
    return ", ".join(f"'{x}'" for x in sorted(xs))


# ------------------------------------------------------------------ structure


@check("schema_not_null", "error")
def c_not_null(con):
    bad = []
    for t in ALL_TABLES:
        for c in t.columns:
            if not c.nullable:
                n = _rows(con, f"SELECT count(*) FROM {t.name} WHERE {c.name} IS NULL")[0][0]
                if n:
                    bad.append(f"{t.name}.{c.name}: {n}")
    return bad, f"{len(bad)} required columns with NULLs"


@check("foreign_keys", "error")
def c_fk(con):
    bad = []
    for t in ALL_TABLES:
        for col, ref_t, ref_c in t.foreign_keys:
            n = _rows(
                con,
                f"SELECT count(*) FROM {t.name} x LEFT JOIN {ref_t} r ON x.{col} = r.{ref_c} "
                f"WHERE x.{col} IS NOT NULL AND r.{ref_c} IS NULL",
            )[0][0]
            if n:
                bad.append(f"{t.name}.{col} -> {ref_t}.{ref_c}: {n} orphans")
    return bad, f"{len(bad)} broken foreign keys"


@check("primary_keys_unique", "error")
def c_pk(con):
    bad = []
    for t in ALL_TABLES:
        if t.primary_key:
            k = ", ".join(t.primary_key)
            n = _rows(
                con, f"SELECT count(*) FROM (SELECT {k} FROM {t.name} GROUP BY {k} HAVING count(*) > 1)"
            )[0][0]
            if n:
                bad.append(f"{t.name} ({k}): {n} duplicated keys")
    return bad, f"{len(bad)} tables with duplicate keys"


@check("observation_natural_key_unique", "error")
def c_nk(con):
    rows = _rows(
        con,
        """SELECT geo_id, measure_id, period_start, period_end, subgroup, source_series, source_vintage, count(*)
                         FROM observations GROUP BY ALL HAVING count(*) > 1 LIMIT 20""",
    )
    return [str(r) for r in rows], f"{len(rows)} duplicated natural keys"


@check("geography_ids", "error")
def c_geo(con):
    bad = _rows(
        con,
        r"""SELECT geo_id, official_code FROM geographies
        WHERE (geo_level = 'state' AND NOT regexp_full_match(geo_id, 'state:[0-9]{2}'))
           OR (geo_level = 'state' AND (length(official_code) <> 2 OR geo_id <> 'state:' || official_code))""",
    )
    terr = _rows(con, "SELECT geo_id FROM geographies WHERE in_default_panel AND geo_level <> 'state'")
    return [
        str(b) for b in bad + terr
    ], f"{len(bad)} malformed state ids, {len(terr)} non-state geographies in the default panel"


@check("controlled_vocabularies", "error")
def c_vocab(con):
    bad = []
    tests = [
        ("observations", "estimate_type", vocab.ESTIMATE_TYPES),
        ("observations", "extraction_method", vocab.EXTRACTION_METHODS),
        ("observations", "period_kind", vocab.PERIOD_KINDS),
        ("observations", "missing_reason", vocab.MISSING_REASONS),
        ("geographies", "geo_level", vocab.GEO_LEVELS),
        ("measures", "value_kind", vocab.VALUE_KINDS),
        ("sources", "rights_status", vocab.RIGHTS_STATUSES),
        ("source_assets", "rights_status", vocab.RIGHTS_STATUSES),
        ("source_assets", "acquisition_status", vocab.ACQUISITION_STATUSES),
        ("policy_events", "extraction_status", vocab.EXTRACTION_STATUSES),
        ("policy_events", "temporal_status", vocab.TEMPORAL_STATUSES),
        ("policy_events", "legal_review_status", vocab.LEGAL_REVIEW_STATUSES),
        ("policy_events", "claim_status", vocab.CLAIM_STATUSES),
        ("claim_dependencies", "legal_review_status", vocab.LEGAL_REVIEW_STATUSES),
        ("claim_exceptions", "legal_review_status", vocab.LEGAL_REVIEW_STATUSES),
        ("policy_exposure", "exposure_status", vocab.POLICY_EXPOSURE_STATUSES),
    ]
    for table, col, allowed in tests:
        rows = _rows(
            con,
            f"SELECT DISTINCT {col} FROM {table} WHERE {col} IS NOT NULL AND {col} NOT IN ({_vals(allowed)})",
        )
        bad += [f"{table}.{col} = {r[0]!r}" for r in rows]
    return bad, f"{len(bad)} values outside controlled vocabularies"


@check("units_known", "error")
def c_units(con):
    rows = _rows(
        con, "SELECT measure_id FROM measures WHERE unit IS NULL OR trim(unit) = '' OR unit = 'unknown'"
    )
    unused = _rows(
        con,
        "SELECT DISTINCT o.measure_id FROM observations o LEFT JOIN measures m USING (measure_id) WHERE m.unit IS NULL",
    )
    return [r[0] for r in rows + unused], f"{len(rows) + len(unused)} measures without a known unit"


# ------------------------------------------------------------------ values


@check("value_xor_missing_reason", "error")
def c_xor(con):
    n = _rows(con, "SELECT count(*) FROM observations WHERE (value IS NULL) = (missing_reason IS NULL)")[0][0]
    return ([f"{n} rows"] if n else []), f"{n} rows where value and missing_reason are both set or both empty"


@check("observed_zero_distinct_from_missing", "error")
def c_zero(con):
    # A zero must come from a source zero, never from a missing token.
    rows = _rows(
        con,
        """SELECT o.observation_id, d.raw_value FROM observations o JOIN observation_details d USING (observation_id)
        WHERE o.value = 0 AND o.extraction_method <> 'computed'
          AND (d.raw_value IS NULL OR trim(d.raw_value) IN ('', '.', 'X', 'x', 'NA', 'N/A'))""",
    )
    return [str(r) for r in rows[:20]], f"{len(rows)} zero values whose raw token is a missing marker"


@check("nonnegative_measures", "error")
def c_nonneg(con):
    rows = _rows(
        con,
        """SELECT o.measure_id, count(*) FROM observations o JOIN measures m USING (measure_id)
        WHERE m.nonnegative AND o.value < 0 GROUP BY 1""",
    )
    return [str(r) for r in rows], f"{sum(r[1] for r in rows)} negative values in nonnegative measures"


@check("percent_and_ci_ranges", "error")
def c_pct(con):
    rows = _rows(
        con,
        """SELECT o.observation_id FROM observations o JOIN measures m USING (measure_id)
        LEFT JOIN observation_details d USING (observation_id)
        WHERE (m.value_kind = 'percent' AND (o.value < 0 OR o.value > 100))
           OR (d.ci_low IS NOT NULL AND d.ci_high IS NOT NULL AND NOT (d.ci_low <= o.value AND o.value <= d.ci_high))
           OR (d.ci_low > d.ci_high)""",
    )
    return [r[0] for r in rows[:20]], f"{len(rows)} percent or confidence-interval violations"


@check("period_kinds_consistent", "error")
def c_period(con):
    rows = _rows(
        con,
        """SELECT observation_id FROM observations WHERE period_start > period_end
        OR (period_kind = 'point_in_time' AND period_start <> period_end)
        OR (period_kind IN ('calendar_year', 'survey_year') AND (month(period_start) <> 1 OR day(period_start) <> 1
             OR month(period_end) <> 12 OR day(period_end) <> 31))
        OR (period_kind = 'state_fiscal_year' AND coalesce(quality_flags, '') NOT LIKE '%aggregate_of_differing_fiscal_years%'
            AND date_diff('day', period_start, period_end) NOT BETWEEN 364 AND 365)
        OR (period_kind = 'state_fiscal_year' AND coalesce(quality_flags, '') LIKE '%aggregate_of_differing_fiscal_years%'
            AND date_diff('day', period_start, period_end) > 548)""",
    )
    return [r[0] for r in rows[:20]], f"{len(rows)} periods inconsistent with their kind"


# ------------------------------------------------------------------ provenance


@check("provenance_complete", "error")
def c_prov(con):
    no_lineage = _rows(
        con,
        "SELECT count(*) FROM observations o LEFT JOIN lineage l ON l.output_id = o.observation_id WHERE l.output_id IS NULL",
    )[0][0]
    no_locator = _rows(
        con, "SELECT count(*) FROM observations WHERE source_locator IS NULL OR trim(source_locator) = ''"
    )[0][0]
    unhashed = _rows(
        con,
        """SELECT DISTINCT o.asset_id FROM observations o JOIN source_assets a USING (asset_id)
        WHERE a.sha256 IS NULL AND a.acquisition_status <> 'parsed' OR (a.sha256 IS NULL AND a.format <> 'derived')""",
    )
    bad = []
    if no_lineage:
        bad.append(f"{no_lineage} observations without lineage")
    if no_locator:
        bad.append(f"{no_locator} observations without a source locator")
    bad += [f"observations from un-hashed asset {r[0]}" for r in unhashed]
    return bad, "; ".join(bad) or "every observation has lineage, a locator and hashed input bytes"


@check("derived_inputs_exist", "error")
def c_derived(con):
    rows = _rows(
        con,
        """WITH x AS (SELECT l.output_id, unnest(string_split(l.input_ids, '|')) AS inp
                                     FROM lineage l JOIN observations o ON o.observation_id = l.output_id
                                     WHERE o.estimate_type = 'derived')
        SELECT count(*) FROM x LEFT JOIN observations o ON o.observation_id = x.inp WHERE o.observation_id IS NULL""",
    )
    n = rows[0][0]
    return ([f"{n} missing inputs"] if n else []), f"{n} derived-value inputs not found among observations"


@check("no_synthetic_data_in_outputs", "error")
def c_synth(con):
    rows = _rows(
        con,
        """SELECT DISTINCT asset_id FROM observations
        WHERE lower(asset_id) LIKE '%synthetic%' OR lower(asset_id) LIKE '%demo%' OR lower(source_series) LIKE '%synthetic%'""",
    )
    return [r[0] for r in rows], f"{len(rows)} synthetic or demonstration assets in observations"


# ------------------------------------------------------------------ comparability rules


@check("brfss_2011_break_respected", "error")
def c_brfss(con):
    rows = _rows(
        con,
        """SELECT comparability_group, min(year), max(year) FROM observations
        WHERE source_series LIKE 'cdc_brfss%' GROUP BY 1 HAVING min(year) < 2011 AND max(year) >= 2011""",
    )
    return [str(r) for r in rows], f"{len(rows)} BRFSS comparability groups spanning the 2011 break"


@check("modeled_small_area_not_causal", "error")
def c_places(con):
    rows = _rows(
        con,
        "SELECT measure_id FROM measures WHERE method_family = 'modeled_small_area' AND causal_outcome_eligible",
    )
    return [r[0] for r in rows], f"{len(rows)} modeled small-area measures marked causal-eligible"


@check("age_universe_declared", "error")
def c_age(con):
    rows = _rows(
        con,
        """SELECT measure_id FROM measures WHERE age_universe NOT IN
        ('all_ages', 'age_14_plus', 'age_18_plus', 'age_21_plus', 'high_school_students', 'not_applicable')""",
    )
    return [r[0] for r in rows], f"{len(rows)} measures with an undeclared age universe"


@check("wine_measures_not_all_alcohol", "error")
def c_wine(con):
    # A measure labelled wine must be defined on wine; all-alcohol finance must never be relabelled as wine.
    rows = _rows(
        con,
        """SELECT measure_id FROM measures
        WHERE (lower(measure_id) LIKE '%wine%' AND beverage <> 'wine')
           OR (fiscal_component IS NOT NULL AND beverage = 'wine' AND lower(definition) NOT LIKE '%wine%')""",
    )
    return [r[0] for r in rows], f"{len(rows)} wine/all-alcohol labelling mismatches"


# ------------------------------------------------------------------ policy


@check("policy_evidence_and_review", "error")
def c_policy(con):
    bad = []
    bad += [
        f"{r[0]}: no evidence rows"
        for r in _rows(
            con,
            """SELECT p.policy_id FROM policy_events p
        LEFT JOIN policy_evidence e USING (policy_id) WHERE e.policy_id IS NULL""",
        )
    ]
    bad += [
        f"{r[0]}: reviewed without reviewer/date"
        for r in _rows(
            con,
            """SELECT policy_id FROM policy_events
        WHERE legal_review_status IN ('maintainer_reviewed', 'expert_reviewed') AND (reviewer IS NULL OR review_date IS NULL)""",
        )
    ]
    bad += [
        f"{r[0]}: reviewed but no evidence row records a reviewer"
        for r in _rows(
            con,
            """SELECT p.policy_id FROM policy_events p
        WHERE p.legal_review_status IN ('maintainer_reviewed', 'expert_reviewed') AND NOT EXISTS (SELECT 1 FROM policy_evidence e WHERE e.policy_id = p.policy_id AND e.reviewed_by IS NOT NULL)""",
        )
    ]
    bad += [
        f"{r[0]}: start not before end"
        for r in _rows(
            con,
            """SELECT policy_id FROM policy_events
        WHERE effective_start IS NOT NULL AND effective_end IS NOT NULL AND effective_start >= effective_end""",
        )
    ]
    bad += [
        f"{r[0]}: open_current without known_in_effect_through"
        for r in _rows(
            con,
            """SELECT policy_id FROM policy_events
        WHERE end_status = 'open_current' AND known_in_effect_through IS NULL""",
        )
    ]
    bad += [
        f"{r[0]}: unknown start but no known_in_effect_from"
        for r in _rows(
            con,
            """SELECT policy_id FROM policy_events
        WHERE effective_start IS NULL AND known_in_effect_from IS NULL""",
        )
    ]
    return bad, f"{len(bad)} policy coding problems"


@check("policy_catalog_conformance", "error")
def c_policy_catalog(con):
    """Every coded policy uses a catalogued dimension, and its value fits that dimension's rule."""
    import re

    dims = {
        r[0]: r[1:]
        for r in con.execute(
            "SELECT dimension_id, value_type, value_set, value_format FROM policy_dimensions"
        ).fetchall()
    }
    values = {
        (r[0], r[1]) for r in con.execute("SELECT value_set, value FROM policy_dimension_values").fetchall()
    }
    sets = {r[0] for r in con.execute("SELECT DISTINCT value_set FROM policy_dimension_values").fetchall()}
    bad = []
    for vt, vs, _fmt in dims.values():
        if vt == "categorical" and vs not in sets:
            bad.append(f"categorical dimension with unknown value set {vs}")
    for pid, dim, value in con.execute(
        "SELECT policy_id, policy_dimension, policy_value FROM policy_events "
        "UNION ALL SELECT snapshot_id, policy_dimension, policy_value FROM policy_snapshots ORDER BY 1"
    ).fetchall():
        if dim not in dims:
            bad.append(f"{pid}: dimension {dim} is not in the policy catalog")
            continue
        vt, vs, _fmt = dims[dim]
        ok = {
            "categorical": (vs, value) in values,
            "numeric": re.fullmatch(r"(usd|pct)_-?\d+(\.\d+)?", value) is not None,
            "fraction": re.fullmatch(r"share_(0(\.\d+)?|1(\.0+)?)", value) is not None,
            "text": bool(value.strip()),
        }.get(vt, False)
        if not ok:
            bad.append(f"{pid}: value {value!r} does not fit {dim} ({vt}{' ' + vs if vs else ''})")
    return bad, f"{len(bad)} policy codings outside the catalog"


@check("policy_snapshot_rules", "error")
def c_policy_snapshots(con):
    """Snapshots carry a known vocabulary, a dated observation and no human review claimed without a name."""
    bad = []
    rows = con.execute(
        """SELECT snapshot_id, observed_on, observed_year, observed_precision, observed_basis, evidence_strength,
                  extraction_status, legal_review_status, reviewed_by, reviewed_on, policy_id, support_basis
           FROM policy_snapshots ORDER BY snapshot_id"""
    ).fetchall()
    events = {r[0] for r in con.execute("SELECT policy_id FROM policy_events").fetchall()}
    for sid, on, year, prec, basis, strength, ext, rev, by, when, pid, support in rows:
        if support not in ("explicit_text", "no_outlet_restriction", "indirect"):
            bad.append(f"{sid}: support basis {support}")
        if prec not in ("day", "year"):
            bad.append(f"{sid}: precision {prec}")
        if prec == "day" and (on is None or on.year != year):
            bad.append(f"{sid}: day precision needs observed_on in observed_year")
        if prec == "year" and on is not None:
            bad.append(f"{sid}: year precision must not invent a day")
        if basis not in ("retrieval_date", "currency_statement", "document_date"):
            bad.append(f"{sid}: basis {basis}")
        if strength not in ("current_code", "enacted_text", "agency_guidance", "secondary_compilation"):
            bad.append(f"{sid}: evidence strength {strength}")
        if ext not in ("parsed", "checked_against_original", "uncertain"):
            bad.append(f"{sid}: extraction status {ext}")
        if rev in ("maintainer_reviewed", "expert_reviewed") and not (by and when):
            bad.append(f"{sid}: human review claimed without a named reviewer and date")
        if rev not in ("unreviewed", "machine_assisted_review", "maintainer_reviewed", "expert_reviewed"):
            bad.append(f"{sid}: review status {rev}")
        if pid and pid not in events:
            bad.append(f"{sid}: names unknown interval {pid}")
    return bad, f"{len(rows)} snapshots, {len(bad)} problems"


@check("policy_conflicting_overlaps", "error")
def c_overlap(con):
    from alcohol_data.transforms.policy import conflicts

    cols = [d[0] for d in con.execute("SELECT * FROM policy_events LIMIT 0").description]
    events = [dict(zip(cols, r, strict=True)) for r in con.execute("SELECT * FROM policy_events").fetchall()]
    found = conflicts(events)
    summary = {}
    for geo, dim, d, ids in found:
        summary.setdefault((geo, dim, tuple(ids)), []).append(d)
    det = [f"{g} {dim} {ids}: {min(ds)}..{max(ds)} ({len(ds)} days)" for (g, dim, ids), ds in summary.items()]
    return det, f"{len(found)} days with conflicting verified policy values"


@check("review_independence", "error")
def c_review_independence(con):
    """Machine checks and AI reading can never stand in for a human review."""
    bad = [
        f"{r[0]}: human review status recorded with reviewer {r[1]!r}"
        for r in _rows(
            con,
            """SELECT policy_id, reviewer FROM policy_events
        WHERE legal_review_status IN ('maintainer_reviewed', 'expert_reviewed')
          AND (lower(reviewer) LIKE '%claude%' OR lower(reviewer) LIKE '%ai assistant%'
               OR lower(reviewer) LIKE '%machine%' OR lower(reviewer) LIKE '%automated%')""",
        )
    ]
    bad += [
        f"{r[0]}: evidence 'reviewed_by' is an AI or machine ({r[1]!r})"
        for r in _rows(
            con,
            """SELECT evidence_id, reviewed_by FROM policy_evidence
        WHERE lower(reviewed_by) LIKE '%claude%' OR lower(reviewed_by) LIKE '%ai assistant%'
           OR lower(reviewed_by) LIKE '%machine%' OR lower(reviewed_by) LIKE '%automated%'""",
        )
    ]
    return bad, f"{len(bad)} machine or AI entries recorded as human review"


@check("claim_dependency_scope", "error")
def c_dependency_scope(con):
    """An on-premise provision alone cannot support an ordinary grocery conclusion; every claim needs an indispensable
    affirmative-authority or retailer-category dependency."""
    bad = [
        f"{r[0]}: indispensable dependency {r[1]} binds on-premise licensees only"
        for r in _rows(
            con,
            """SELECT claim_id, provision FROM claim_dependencies
        WHERE indispensable AND lower(actor_scope) LIKE '%on-premise%'""",
        )
    ]
    bad += [
        f"{r[0]}: no indispensable retailer_category or affirmative_authority dependency"
        for r in _rows(
            con,
            """SELECT claim_id FROM claim_dependencies GROUP BY claim_id
        HAVING count(*) FILTER (WHERE indispensable AND role IN ('retailer_category', 'affirmative_authority')) = 0
           AND count(*) FILTER (WHERE role = 'special_channel') = 0""",
        )
    ]
    return bad, f"{len(bad)} claim dependency scope problems"


@check("future_days_not_history", "error")
def c_future(con):
    as_of = _rows(con, "SELECT value FROM build_info WHERE key = 'as_of_date'")
    if not as_of:
        return ["build_info has no as_of_date"], "no as-of date recorded"
    n = _rows(
        con,
        f"""SELECT count(*) FROM policy_events
        WHERE known_in_effect_through > DATE '{as_of[0][0]}'
           OR (end_status = 'superseded' AND effective_start > DATE '{as_of[0][0]}')""",
    )[0][0]
    m = _rows(con, f"SELECT count(*) FROM policy_segments WHERE segment_end > DATE '{as_of[0][0]}'")[0][0]
    return ([f"{n} intervals and {m} segments claim days after the as-of date"] if n or m else []), (
        f"as-of {as_of[0][0]}: {n} intervals and {m} segments claim later days"
    )


@check("unknown_policy_never_exposed", "error")
def c_unknown(con):
    n = _rows(
        con,
        """SELECT count(*) FROM policy_exposure WHERE unknown_days > 0 AND exposure_fraction IS NOT NULL""",
    )[0][0]
    return ([f"{n} rows"] if n else []), f"{n} exposure rows with unknown days but a computed fraction"


# ------------------------------------------------------------------ release gates


@check("preferred_has_no_conflicting_value", "error")
def c_conflict_leak(con):
    n = _rows(
        con,
        """SELECT count(*) FROM preferred_observations
        WHERE selection_reason LIKE 'unresolved_conflict%' AND value IS NOT NULL""",
    )[0][0]
    total = _rows(
        con, "SELECT count(*) FROM preferred_observations WHERE missing_reason = 'unresolved_conflict'"
    )[0][0]
    return ([f"{n} leaked"] if n else []), f"{total} cells marked unresolved_conflict; {n} leak a value"


@check("manual_extractions_review_state", "warn")
def c_manual(con):
    rows = _rows(
        con,
        """SELECT review_status, count(*) FROM observations WHERE extraction_method IN ('manual', 'ocr') GROUP BY 1""",
    )
    unreviewed = sum(r[1] for r in rows if r[0] != "reviewed")
    return ([f"{unreviewed} manual values await maintainer review"] if unreviewed else []), ", ".join(
        f"{r[0]}: {r[1]}" for r in rows
    ) or "no manual extractions"


@check("quarantine_empty", "warn")
def c_quarantine(con):
    rows = _rows(con, "SELECT asset_id, reason, count(*) FROM quarantine GROUP BY 1, 2 ORDER BY 3 DESC")
    return [str(r) for r in rows], f"{sum(r[2] for r in rows)} quarantined rows"


@check("blocked_or_manual_assets", "warn")
def c_blocked(con):
    rows = _rows(
        con,
        "SELECT asset_id, acquisition_status FROM source_assets WHERE acquisition_status NOT IN ('parsed', 'acquired')",
    )
    return [f"{a}: {s}" for a, s in rows], f"{len(rows)} assets not acquired"


@check("policy_not_yet_reviewed", "warn")
def c_policy_review(con):
    rows = _rows(con, "SELECT legal_review_status, count(*) FROM policy_events GROUP BY 1")
    pending = sum(n for s, n in rows if s != "reviewed")
    return ([f"{pending} policy intervals not reviewed by a maintainer"] if pending else []), ", ".join(
        f"{s}: {n}" for s, n in rows
    )


# ------------------------------------------------------------------ reconciliations (published either way)


@check("reconcile_stc_us_equals_sum_of_states", "info")
def r_stc_us(con):
    rows = _rows(
        con,
        """WITH s AS (
          SELECT o.measure_id, o.source_vintage, coalesce((d.extra::JSON->>'stc_year')::INT, o.year) AS stc_year,
                 sum(o.value) FILTER (WHERE o.geo_id LIKE 'state:%' AND o.geo_id <> 'state:11') AS states,
                 max(o.value) FILTER (WHERE o.geo_id = 'nation:us') AS us,
                 count(*) FILTER (WHERE o.geo_id LIKE 'state:%' AND o.geo_id <> 'state:11' AND o.value IS NOT NULL) AS n_states
          FROM observations o JOIN observation_details d USING (observation_id)
          WHERE o.source_series = 'census_stc' GROUP BY ALL)
        SELECT measure_id, source_vintage, stc_year, us, states, n_states FROM s
        WHERE us IS NOT NULL AND n_states >= 45 AND abs(us - states) > 1000 * 2
        ORDER BY stc_year DESC LIMIT 30""",
    )
    return [str(r) for r in rows], (
        f"{len(rows)} STC years where the U.S. row differs from the sum of the 50 states by more than rounding "
        "(the STC 'US' total excludes DC: FY2023-FY2025 flat files reconcile exactly once DC is left out)"
    )


@check("reconcile_stc_editions_agree", "info")
def r_stc_ed(con):
    rows = _rows(
        con,
        """SELECT a.geo_id, a.measure_id, a.year, a.source_vintage, a.value, b.source_vintage, b.value
        FROM observations a JOIN observations b ON a.geo_id = b.geo_id AND a.measure_id = b.measure_id
          AND a.period_start = b.period_start AND a.period_end = b.period_end AND a.source_vintage < b.source_vintage
        WHERE a.source_series = 'census_stc' AND b.source_series = 'census_stc'
          AND (a.value IS DISTINCT FROM b.value) ORDER BY a.year DESC, a.geo_id LIMIT 50""",
    )
    return [str(r) for r in rows], f"{len(rows)} STC cells revised between editions (first 50 listed)"


@check("reconcile_census_liquor_store_files", "warn")
def r_govfin(con):
    """IndFin and the yearly state-by-type files must agree wherever both cover a state and year.

    A state-by-type file lists only items that are not zero (except FY2008), so a missing state-by-type
    row counts as zero, and an IndFin zero with no state-by-type row agrees."""
    rows = _rows(
        con,
        """WITH i AS (SELECT geo_id, measure_id, period_start, period_end, value FROM observations
                      WHERE source_series = 'census_govfin_indfin'),
             s AS (SELECT geo_id, measure_id, period_start, period_end, value FROM observations
                      WHERE source_series = 'census_govfin_state_type'),
             years AS (SELECT DISTINCT year(period_end) AS y FROM observations
                       WHERE source_series = 'census_govfin_state_type')
        SELECT coalesce(i.geo_id, s.geo_id), coalesce(i.measure_id, s.measure_id), coalesce(i.period_end, s.period_end),
               i.value, s.value
        FROM i FULL JOIN s USING (geo_id, measure_id, period_start, period_end)
        WHERE year(coalesce(i.period_end, s.period_end)) IN (SELECT y FROM years)
          AND (i.geo_id IS NOT NULL OR year(s.period_end) <= (SELECT max(year(period_end)) FROM i))
          AND coalesce(i.value, 0) IS DISTINCT FROM coalesce(s.value, 0)
        ORDER BY 3, 1, 2""",
    )
    shared = _rows(
        con,
        """SELECT count(*) FROM observations i JOIN observations s USING (geo_id, measure_id, period_start, period_end)
        WHERE i.source_series = 'census_govfin_indfin' AND s.source_series = 'census_govfin_state_type'""",
    )[0][0]
    return [str(r) for r in rows[:50]], (
        f"{len(rows)} state-year cells where the IndFin database and the yearly state-by-type files disagree "
        f"({shared} cells present in both; a missing state-by-type line counts as zero)"
    )


def _thousands_text(v) -> str:
    return "none (no item)" if v is None else f"{v / 1000:,.0f}"


@check("compare_census_fy2015_releases", "info")
def r_govfin_fy2015(con):
    """FY2015 in two Census releases: the state-by-type file of 2017 (preferred) and the Individual Unit File of 2020
    (kept as a competing candidate). Lists every state government liquor-store cell where they differ, a cell only
    one release has included; an absent item is shown as none, never as zero."""
    rows = _rows(
        con,
        """WITH a AS (SELECT geo_id, measure_id, period_start, period_end, value FROM observations
                      WHERE asset_id = 'census_govfin_state_type_fy2015'),
             b AS (SELECT geo_id, measure_id, period_start, period_end, value FROM observations
                      WHERE asset_id = 'census_govfin_unit_fy2015')
        SELECT coalesce(a.geo_id, b.geo_id) AS geo_id, coalesce(a.measure_id, b.measure_id), a.value, b.value,
               g.name
        FROM a FULL JOIN b USING (geo_id, measure_id, period_start, period_end)
        LEFT JOIN geographies g ON g.geo_id = coalesce(a.geo_id, b.geo_id)
        WHERE a.value IS DISTINCT FROM b.value ORDER BY 5, 2""",
    )
    agree = _rows(
        con,
        """SELECT count(*) FROM observations a JOIN observations b USING (geo_id, measure_id, period_start, period_end)
        WHERE a.asset_id = 'census_govfin_state_type_fy2015' AND b.asset_id = 'census_govfin_unit_fy2015'
          AND a.value = b.value""",
    )[0][0]
    details = [
        f"{name} ({geo}) {measure.removeprefix('census_liquor_stores_')}: 2017 release {_thousands_text(a)}, "
        f"2020 release {_thousands_text(b)}"
        + ("" if a is None or b is None else f", difference {(b - a) / 1000:+,.0f}")
        + " (thousands of dollars)"
        for geo, measure, a, b, name in rows
    ]
    return details, (
        f"{len(rows)} FY2015 state liquor-store cells differ between the 2017 state-by-type release (preferred) and "
        f"the 2020 unit-file release (candidate); {agree} cells agree"
    )


@check("census_unit_file_repeats_and_equal_items", "info")
def r_govfin_repeats(con):
    """Individual Unit File values (FY2015-FY2024) equal to the same state's previous fiscal year in the same files,
    which reads as a value carried forward rather than a new measurement, and state-years whose current operations
    equal revenue to the thousand (flag census_expenditure_equals_revenue)."""
    repeats = _rows(
        con,
        """WITH x AS (
          SELECT geo_id, measure_id, year, value,
                 lag(value) OVER (PARTITION BY geo_id, measure_id ORDER BY period_end) AS prev,
                 lag(year) OVER (PARTITION BY geo_id, measure_id ORDER BY period_end) AS prev_year
          FROM observations WHERE source_series = 'census_govfin_unit')
        SELECT g.name, x.geo_id, x.year, x.measure_id, x.value FROM x LEFT JOIN geographies g USING (geo_id)
        WHERE x.value = x.prev AND x.prev_year = x.year - 1 ORDER BY x.year, g.name, x.measure_id""",
    )
    equal = _rows(
        con,
        """SELECT DISTINCT g.name, o.geo_id, o.year, o.value FROM observations o LEFT JOIN geographies g USING (geo_id)
        WHERE o.source_series = 'census_govfin_unit' AND o.measure_id = 'census_liquor_stores_revenue'
          AND contains(coalesce(o.quality_flags, ''), 'census_expenditure_equals_revenue')
        ORDER BY o.year, g.name""",
    )
    details = [
        f"repeat: {name} ({geo}) FY{year} {measure.removeprefix('census_liquor_stores_')} {value / 1000:,.0f} "
        f"equals FY{year - 1}"
        for name, geo, year, measure, value in repeats
    ] + [
        f"current operations = revenue: {name} ({geo}) FY{year}, {value / 1000:,.0f}"
        for name, geo, year, value in equal
    ]
    return details, (
        f"{len(repeats)} unit-file cells repeat the previous fiscal year exactly; {len(equal)} state-years whose "
        "current operations equal revenue (kept, flagged, left out of the store-cost comparison)"
    )


@check("compare_utah_census_receipts_vs_dabs_sales", "info")
def r_ut_census_dabs(con):
    """Utah's Census liquor-store receipts (A90) beside DABS's annual sales less the two deposits Utah law computes on
    total gross revenue from liquor sales (school meals, 32B-2-304; enforcement fund, 32B-2-305), as DABS reported them
    and at the statutory rates (fiscal_bridge.py). Pinned figures only; the dashboard's bridge adds the years read
    online. Agreement within the tolerance is arithmetic: that Census leaves the deposits out is inferred, not stated."""
    from alcohol_data import fiscal_bridge as fb

    rows = fb.utah_bridge(con, include_provisional=False)
    k = lambda v: "—" if v is None else f"{v / 1000:,.0f}"  # noqa: E731
    details, ok, unresolved = [], [], []
    for r in rows:
        if r["compared_with"] != "census" or not r["dabs_sales"]:
            continue
        parts = []
        for v in r["variants"]:
            parts.append(
                f"{v['kind']} deposits {k(v['school_meals'])} + {k(v['enforcement_fund'])} on sales {k(v['sales'])} "
                f"leave {k(v['sales_less_deposits'])}, residual {k(v['residual'])}"
            )
        details.append(
            f"FY{r['fiscal_year']}: Census {k(r['census_receipts'][0]['value'])}; "
            + "; ".join(parts)
            + " (thousands of dollars)"
        )
        (ok if r["status"] == "reconciles_numerically" else unresolved).append(f"FY{r['fiscal_year']}")
    if not details:
        return [], "no fiscal year with both Utah's Census receipts and a DABS liquor sales figure"
    return details, (
        f"{len(ok)} of {len(details)} Utah fiscal years reconcile within ${fb.TOLERANCE_DOLLARS / 1e6:.2f} million on at least one "
        f"deposit variant; unresolved: {', '.join(unresolved) or 'none'}. The audited fund books the school-meals deposit outside its "
        "sales (documented in the ACFR); that the enforcement deposit is outside Census's receipts too is inferred"
    )


@check("reconcile_cdi_vs_brfss_binge", "warn")
def r_cdi_brfss(con):
    """CDI repeats BRFSS crude binge prevalence. Both publish one decimal, so values within 0.1 point agree."""
    rows = _rows(
        con,
        """SELECT c.geo_id, c.year, c.value, o.value FROM observations c
        JOIN observations o USING (geo_id, measure_id, period_start, period_end)
        WHERE c.measure_id = 'brfss_binge_5m_4f_pct' AND c.source_series = 'cdc_cdi'
          AND o.source_series LIKE 'cdc_brfss%' AND c.value IS NOT NULL AND o.value IS NOT NULL
          AND abs(c.value - o.value) > 0.1001 ORDER BY 1, 2""",
    )
    n = _rows(
        con,
        """SELECT count(*) FROM observations c JOIN observations o USING (geo_id, measure_id, period_start, period_end)
        WHERE c.measure_id = 'brfss_binge_5m_4f_pct' AND c.source_series = 'cdc_cdi'
          AND o.source_series LIKE 'cdc_brfss%' AND c.value IS NOT NULL AND o.value IS NOT NULL""",
    )[0][0]
    return [
        str(r) for r in rows
    ], f"{len(rows)} of {n} state-years where CDI and BRFSS binge prevalence differ by more than 0.1 point"


@check("compare_cdi_vs_niaaa_per_capita", "info")
def r_cdi_niaaa(con):
    """CDI's per capita consumption (ages 14+) is rounded and repeats an older NIAAA edition; differences from the
    preferred NIAAA edition are listed so nobody mistakes the CDI copy for an independent confirmation."""
    rows = _rows(
        con,
        """SELECT c.geo_id, c.year, c.value, p.value FROM observations c
        JOIN preferred_observations p USING (geo_id, measure_id, period_start, period_end)
        WHERE c.measure_id = 'niaaa_ethanol_per_capita_14plus_all' AND c.source_series = 'cdc_cdi'
          AND p.source_series = 'niaaa_apparent_consumption' AND abs(c.value - p.value) > 0.05 ORDER BY 1, 2""",
    )
    return (
        [str(r) for r in rows],
        f"{len(rows)} state-years where CDI's per capita consumption differs from the preferred NIAAA edition by more than 0.05 gallon",
    )


@check("reconcile_economic_census_2017_files", "warn")
def r_ec2017(con):
    """The 2017 basic statistics and the 2012-2017 comparative file must give the same 2017 values."""
    rows = _rows(
        con,
        """SELECT b.geo_id, b.measure_id, b.value, c.value, b.missing_reason, c.missing_reason FROM observations b
        JOIN observations c USING (geo_id, measure_id, period_start, period_end)
        WHERE b.source_series = 'census_ec2017_basic' AND c.source_series = 'census_ec2017_comp'
          AND (b.value IS DISTINCT FROM c.value OR b.missing_reason IS DISTINCT FROM c.missing_reason) ORDER BY 1, 2""",
    )
    n = _rows(
        con,
        """SELECT count(*) FROM observations b JOIN observations c USING (geo_id, measure_id, period_start, period_end)
        WHERE b.source_series = 'census_ec2017_basic' AND c.source_series = 'census_ec2017_comp'""",
    )[0][0]
    return [
        str(r) for r in rows
    ], f"{len(rows)} of {n} 2017 cells where the two Economic Census files disagree"


@check("reconcile_dabs_monthly_beverages_sum_to_total", "warn")
def r_dabs_monthly(con):
    """Each month's beverage groups (spirits, wine, beer, cider, premixed, other) must add up to the report's
    printed total, for gross sales (to the cent) and for 9-liter cases (to 0.001 case)."""
    rows = _rows(
        con,
        """WITH m AS (SELECT period_start, measure_id, value FROM preferred_observations
                   WHERE measure_id LIKE 'ut_dabs_monthly_%'),
             parts AS (SELECT period_start,
                   CASE WHEN measure_id LIKE '%gross_sales%' THEN 'sales' ELSE 'cases' END AS what,
                   sum(value) FILTER (WHERE measure_id NOT LIKE '%_total') AS parts,
                   max(value) FILTER (WHERE measure_id LIKE '%_total') AS total
                   FROM m GROUP BY 1, 2)
        SELECT period_start, what, parts, total FROM parts
        WHERE abs(parts - total) > CASE WHEN what = 'sales' THEN 0.01 ELSE 0.001 END ORDER BY 1, 2""",
    )
    n = _rows(
        con,
        "SELECT count(DISTINCT period_start) FROM preferred_observations WHERE measure_id LIKE 'ut_dabs_monthly_%'",
    )[0][0]
    return (
        [str(r) for r in rows],
        f"{len(rows)} month-measures (of {n} months) where DABS beverage groups do not add up to the printed total",
    )


@check("dabs_monthly_gross_sales_at_shelf_prices", "warn")
def r_dabs_shelf(con):
    """Each DABS monthly report's gross sales should read as statewide shelf prices times bottles: among
    products with at least 10 bottles, at least 75% must divide to a whole number of cents (products sold at
    two prices in a month fail without contradicting this), and the bottle column must agree with 9-liter
    cases and bottle size for at least 99% of products. A month without a profile fails too. This settles
    the shelf-price basis only, not whether shelf prices include sales tax (docs/fiscal-reconciliation.md)."""
    rows = _rows(
        con,
        """SELECT o.period_label, d.extra FROM observations o
           JOIN observation_details d USING (observation_id)
           WHERE o.measure_id = 'ut_dabs_monthly_gross_sales_total' ORDER BY o.period_start""",
    )
    bad, tested, whole = [], 0, 0
    for label, extra in rows:
        prof = (json.loads(extra) if extra else {}).get("shelf_price_profile")
        if not prof:
            bad.append(f"{label}: no shelf-price profile")
            continue
        t, w = prof["products_tested"], prof["whole_cent_unit_price"]
        sized, match = prof["products_with_size"], prof["bottles_match_cases"]
        tested, whole = tested + t, whole + w
        if not t or w / t < 0.75:
            bad.append(f"{label}: {w} of {t} products at a whole-cent unit price")
        if not sized or match / sized < 0.99:
            bad.append(f"{label}: bottles agree with cases for {match} of {sized} products")
    share = f"{whole / tested:.1%}" if tested else "n/a"
    return (
        bad,
        f"{len(bad)} problems in {len(rows)} months; {whole} of {tested} products with 10+ bottles "
        f"({share}) sold at a whole-cent unit price",
    )


@check("reconcile_bea_alcohol_spending_states_sum_to_us", "info")
def r_bea_pce(con):
    """BEA's U.S. line for off-premises alcohol spending against the sum of the 50 states and DC (BEA says the
    two differ only for broad PCE categories, by net expenditures abroad)."""
    rows = _rows(
        con,
        """WITH s AS (SELECT year, sum(value) AS states, count(*) AS n FROM preferred_observations
                   WHERE measure_id = 'bea_pce_off_premises_alcohol' AND geo_id LIKE 'state:%' GROUP BY 1),
             u AS (SELECT year, value AS us FROM preferred_observations
                   WHERE measure_id = 'bea_pce_off_premises_alcohol' AND geo_id = 'nation:us')
        SELECT year, states, us, n FROM s JOIN u USING (year)
        WHERE n <> 51 OR abs(states - us) > 0.001 * us ORDER BY 1""",
    )
    return [
        str(r) for r in rows
    ], f"{len(rows)} years where the states' alcohol spending does not add up to the U.S. line within 0.1%"


@check("reconcile_fars_vs_nhtsa_state_table", "warn")
def r_fars(con):
    """Values computed from the FARS files must equal NHTSA's published state table when both come from the
    same file version (a final file); against an annual report file, differences are expected and counted."""
    rows = _rows(
        con,
        """WITH pub AS (
              SELECT o.geo_id, o.year, o.measure_id, o.value, d.extra::JSON->>'fars_file_version' AS ver
              FROM observations o JOIN observation_details d USING (observation_id)
              WHERE o.measure_id IN ('nhtsa_published_traffic_fatalities',
                                     'nhtsa_published_alcohol_impaired_driving_fatalities')),
           comp AS (
              SELECT geo_id, year, measure_id, value FROM observations
              WHERE measure_id IN ('fars_traffic_fatalities', 'fars_alcohol_impaired_driving_fatalities'))
        SELECT p.ver, c.measure_id, c.geo_id, c.year, c.value, p.value
        FROM comp c JOIN pub p ON p.geo_id = c.geo_id AND p.year = c.year
          AND p.measure_id = replace(c.measure_id, 'fars_', 'nhtsa_published_')
        WHERE abs(c.value - p.value) > CASE WHEN c.measure_id LIKE '%alcohol%' THEN 0.5 ELSE 0 END
        ORDER BY abs(c.value - p.value) DESC""",
    )
    final = [r for r in rows if r[0] and "Final" in r[0]]
    compared = _rows(
        con,
        """SELECT count(*) FROM observations
        WHERE measure_id IN ('nhtsa_published_traffic_fatalities', 'nhtsa_published_alcohol_impaired_driving_fatalities')""",
    )[0][0]
    return [str(r) for r in final[:50]], (
        f"{len(final)} state-years where FARS computed from a final file differs from NHTSA's table from the same "
        f"file beyond rounding; {len(rows) - len(final)} differences against tables built from an earlier "
        f"annual report file (expected); {compared} published values"
    )


@check("reconcile_niaaa_states_sum_to_us", "info")
def r_niaaa(con):
    rows = _rows(
        con,
        """WITH x AS (
          SELECT source_vintage, measure_id, year,
                 sum(value) FILTER (WHERE geo_id LIKE 'state:%') AS states, max(value) FILTER (WHERE geo_id = 'nation:us') AS us
          FROM observations WHERE source_series = 'niaaa_apparent_consumption' AND measure_id LIKE 'niaaa_ethanol_gallons_%'
            AND measure_id NOT LIKE '%time_varying%' GROUP BY ALL)
        SELECT source_vintage, measure_id, year, us, states, round(100 * (us - states) / us, 3) AS pct FROM x
        WHERE us IS NOT NULL AND abs(us - states) / us > 0.001 ORDER BY abs(us - states) / us DESC LIMIT 20""",
    )
    return [
        str(r) for r in rows
    ], f"{len(rows)} NIAAA year-beverage totals where states differ from the U.S. by more than 0.1%"


@check("reconcile_niaaa_per_capita_components", "info")
def r_pc(con):
    n = _rows(
        con,
        "SELECT count(*) FROM observations WHERE quality_flags LIKE '%per_capita_inconsistent_with_components%'",
    )[0][0]
    return (
        [f"{n} rows flagged"] if n else []
    ), f"{n} NIAAA rows whose per capita value disagrees with ethanol / population beyond rounding"


@check("reconcile_niaaa_denominators_vs_census", "info")
def r_den(con):
    rows = _rows(
        con,
        """WITH n AS (SELECT geo_id, measure_id, year, source_vintage, value FROM observations
                                    WHERE source_series = 'niaaa_apparent_consumption' AND measure_id LIKE 'pop_age%'),
             c AS (SELECT geo_id, measure_id, year, value FROM preferred_observations
                   WHERE period_kind = 'point_in_time' AND measure_id LIKE 'pop_age%')
        SELECT n.source_vintage, n.measure_id, min(n.year), max(n.year), count(*),
               round(100 * max(abs(n.value - c.value) / c.value), 2) AS max_pct,
               round(100 * avg(abs(n.value - c.value) / c.value), 3) AS mean_pct
        FROM n JOIN c USING (geo_id, measure_id, year) WHERE n.geo_id LIKE 'state:%' GROUP BY 1, 2 ORDER BY 1, 2""",
    )
    return [
        str(r) for r in rows
    ], "NIAAA calendar-year denominators vs Census July 1 estimates (max/mean % difference by edition)"


@check("reconcile_utah_dabs_arithmetic", "info")
def r_dabs(con):
    rows = _rows(
        con,
        """WITH v AS (SELECT source_vintage, source_series, year, measure_id, value FROM observations
                                    WHERE geo_id = 'state:49' AND source_series LIKE 'utah_dabs%'),
        p AS (PIVOT v ON measure_id USING first(value) GROUP BY source_vintage, source_series, year)
        SELECT * FROM p ORDER BY source_vintage, source_series, year""",
    )
    cols = [
        d[0]
        for d in con.execute("""WITH v AS (SELECT source_vintage, source_series, year, measure_id, value FROM observations
                                    WHERE geo_id = 'state:49' AND source_series LIKE 'utah_dabs%')
        PIVOT v ON measure_id USING first(value) GROUP BY source_vintage, source_series, year LIMIT 0""").description
    ]
    out = []
    for r in rows:
        d = dict(zip(cols, r, strict=True))
        g = d.get
        series = d["source_series"].split(":")[-1]
        tag = f"{d['source_vintage']} {series} FY{d['year']}"
        if series == "five_year_summary_financial_information":
            gp, oi, tr = g("ut_dabs_gross_profit"), g("ut_dabs_other_income"), g("ut_dabs_total_revenue")
            if None not in (gp, oi, tr) and abs(gp + oi - tr) > 1000.5:
                out.append(
                    f"{tag}: gross profit + other income = {gp + oi:,.0f} but total revenue printed {tr:,.0f}"
                )
            ded = [
                g(k)
                for k in (
                    "ut_dabs_parents_empowered",
                    "ut_dabs_underage_drinking_prevention_transfer",
                    "ut_dabs_operating_nonoperating_expenses",
                    "ut_dabs_sbi_transfer",
                    "ut_dabs_school_lunch_transfer",
                    "ut_dabs_other_programs_transfer",
                )
            ]
            net = g("ut_dabs_net_profit_general_fund")
            if None not in ded and None not in (tr, net) and abs(tr - sum(ded) - net) > 1000.5:
                out.append(
                    f"{tag}: total revenue - listed deductions = {tr - sum(ded):,.0f} but net profit printed {net:,.0f}"
                )
        elif series == "five_year_operations_summary":
            tr, net = g("ut_dabs_total_revenue"), g("ut_dabs_net_profit_general_fund")
            ded = [
                g(k)
                for k in (
                    "ut_dabs_salaries_wages",
                    "ut_dabs_other_program_transfers",
                    "ut_dabs_other_expenses_net",
                )
            ]
            if None not in ded and None not in (tr, net) and abs(tr - sum(ded) - net) > 1000.5:
                out.append(
                    f"{tag}: total revenue - listed deductions = {tr - sum(ded):,.0f} but net profit printed {net:,.0f}"
                )
        elif series == "income_statement":
            noi, nonop, net = (
                g("ut_dabs_net_operating_income"),
                g("ut_dabs_total_nonoperating_net"),
                g("ut_dabs_net_profit_general_fund"),
            )
            if None not in (noi, nonop, net) and abs(noi + nonop - net) > 1000.5:
                out.append(
                    f"{tag}: net operating income + non-operating = {noi + nonop:,.0f} but net liquor profit printed {net:,.0f}"
                )
    return out, f"{len(out)} DABS table-years whose printed components do not reproduce the printed total"


@check("large_year_over_year_changes", "info")
def r_yoy(con):
    rows = _rows(
        con,
        """WITH x AS (
          SELECT geo_id, measure_id, year, value,
                 lag(value) OVER (PARTITION BY geo_id, measure_id, period_kind ORDER BY period_start) AS prev,
                 lag(comparability_group) OVER (PARTITION BY geo_id, measure_id, period_kind ORDER BY period_start) AS prev_group,
                 comparability_group
          FROM preferred_observations WHERE geo_id LIKE 'state:%' AND period_kind <> 'month')
        SELECT measure_id, geo_id, year, prev, value FROM x
        WHERE prev > 0 AND value IS NOT NULL AND comparability_group = prev_group AND abs(value / prev - 1) > 0.5
        ORDER BY abs(value / prev - 1) DESC LIMIT 25""",
    )
    n = _rows(
        con,
        """WITH x AS (SELECT value, lag(value) OVER (PARTITION BY geo_id, measure_id, period_kind ORDER BY period_start) AS prev
                                 FROM preferred_observations WHERE geo_id LIKE 'state:%' AND period_kind <> 'month')
                      SELECT count(*) FROM x WHERE prev > 0 AND value IS NOT NULL AND abs(value / prev - 1) > 0.5""",
    )[0][0]
    return [
        str(r) for r in rows
    ], f"{n} state year-over-year changes above 50% (review list, not removed; top 25 listed)"


def run_checks(profile: str = "dev", database: Path | None = None) -> list[CheckResult]:
    database = database or paths.DATABASE_PATH
    if not database.exists():
        raise FileNotFoundError(f"{paths.rel(database)} not found; run 'alcohol-data build' first")
    con = duckdb.connect(str(database), read_only=True)
    results = []
    try:
        for name, severity, profiles, fn in CHECKS:
            if profile not in profiles:
                continue
            details, summary = fn(con)
            failed = bool(details) and severity in ("error", "warn")
            results.append(CheckResult(name, severity, failed, summary, list(details)))
    finally:
        con.close()
    return results


def write_validation_report(results: list[CheckResult], profile: str) -> Path:
    out_json = paths.PROCESSED_DIR / "validation_report.json"
    out_json.write_text(
        json.dumps({"profile": profile, "results": [asdict(r) for r in results]}, indent=2, default=str)
        + "\n",
        encoding="utf-8",
        newline="\n",
    )
    lines = [f"# Validation report ({profile} profile)", "", "| Check | Severity | Result |", "|---|---|---|"]
    for r in results:
        status = "FAIL" if r.failed else ("note" if r.severity == "info" and r.details else "pass")
        lines.append(f"| {r.name} | {r.severity} | {status}: {r.summary} |")
    for r in results:
        if r.details:
            lines += ["", f"## {r.name}", ""] + [f"- {d}" for d in r.details[:60]]
            if len(r.details) > 60:
                lines.append(f"- ... {len(r.details) - 60} more in validation_report.json")
    out_md = paths.PROCESSED_DIR / "validation_report.md"
    out_md.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")
    return out_md
