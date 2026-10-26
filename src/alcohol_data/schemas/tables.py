"""Canonical table definitions.

This module is the single definition of the released tables. The DuckDB DDL,
the data dictionary (docs/data-dictionary.md), the export column order, and the
schema checks in validation are all generated from it.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Column:
    name: str
    type: str  # DuckDB type
    description: str
    nullable: bool = True


@dataclass(frozen=True)
class Table:
    name: str
    description: str
    columns: tuple[Column, ...]
    primary_key: tuple[str, ...] = ()
    foreign_keys: tuple[tuple[str, str, str], ...] = ()  # (column, ref_table, ref_column)
    export: bool = True
    sort_by: tuple[str, ...] = field(default=())

    def column_names(self) -> list[str]:
        return [c.name for c in self.columns]

    def ddl(self) -> str:
        lines = []
        for c in self.columns:
            null = "" if c.nullable else " NOT NULL"
            lines.append(f"  {c.name} {c.type}{null}")
        if self.primary_key:
            lines.append(f"  PRIMARY KEY ({', '.join(self.primary_key)})")
        body = ",\n".join(lines)
        return f"CREATE TABLE {self.name} (\n{body}\n);"

    def order_by(self) -> tuple[str, ...]:
        return self.sort_by or self.primary_key or tuple(self.column_names())


C = Column

SOURCES = Table(
    "sources",
    "One row per publisher dataset or document family.",
    (
        C("source_id", "VARCHAR", "Stable project identifier for the source.", False),
        C("publisher", "VARCHAR", "Publishing agency or organization.", False),
        C("title", "VARCHAR", "Title of the dataset or document family.", False),
        C("landing_url", "VARCHAR", "Official landing page.", False),
        C("citation", "VARCHAR", "Suggested citation text for the original source.", False),
        C(
            "source_family",
            "VARCHAR",
            "population | consumption | behavior | finance | policy | context.",
            False,
        ),
        C("rights_status", "VARCHAR", "See vocabulary in docs/data-dictionary.md.", False),
        C("rights_evidence_url", "VARCHAR", "Where the rights determination comes from."),
        C("notes", "VARCHAR", "Caveats that apply to every asset from this source."),
    ),
    primary_key=("source_id",),
)

SOURCE_ASSETS = Table(
    "source_assets",
    "One row per exact file or API response used by the build, identified by content hash.",
    (
        C("asset_id", "VARCHAR", "Stable project identifier for the asset.", False),
        C("source_id", "VARCHAR", "Parent source.", False),
        C("url", "VARCHAR", "Asset URL with any credentials removed. Empty for manual-only assets."),
        C("request_method", "VARCHAR", "GET, POST, or manual_import.", False),
        C("edition", "VARCHAR", "Edition, vintage, or release label as published.", False),
        C(
            "source_series",
            "VARCHAR",
            "Series this asset belongs to (used in observation natural keys).",
            False,
        ),
        C("source_vintage", "VARCHAR", "Vintage or edition token used in observation natural keys.", False),
        C("retrieved_at", "TIMESTAMP", "UTC time the bytes were retrieved or imported."),
        C("sha256", "VARCHAR", "SHA-256 of the raw bytes."),
        C("bytes", "BIGINT", "Size of the raw file."),
        C("format", "VARCHAR", "Declared format (csv, xlsx, text_fixed_width, json, pdf, html).", False),
        C("acquisition_status", "VARCHAR", "acquired | blocked_access | not_published | ...", False),
        C("rights_status", "VARCHAR", "Rights status of this specific asset.", False),
        C("redistribute_raw", "BOOLEAN", "Whether the raw file may be bundled in release downloads.", False),
        C("parser", "VARCHAR", "Adapter that parsed the asset."),
        C("parser_version", "VARCHAR", "Adapter version string."),
        C("priority", "INTEGER", "Higher wins when choosing preferred observations among competing series."),
        C("notes", "VARCHAR", "Asset-specific caveats."),
    ),
    primary_key=("asset_id",),
    foreign_keys=(("source_id", "sources", "source_id"),),
)

GEOGRAPHIES = Table(
    "geographies",
    "Geographic units. IDs are strings; FIPS codes keep leading zeros.",
    (
        C("geo_id", "VARCHAR", "Project ID, e.g. 'state:49' (Utah), 'nation:us', 'census_region:4'.", False),
        C("geo_level", "VARCHAR", "nation | census_region | state | county | place | cbsa.", False),
        C("official_code", "VARCHAR", "Code in the official system (e.g. 2-digit state FIPS '06').", False),
        C("code_system", "VARCHAR", "Code system for official_code (e.g. fips_state).", False),
        C("name", "VARCHAR", "Official name.", False),
        C("abbreviation", "VARCHAR", "USPS abbreviation where applicable."),
        C("boundary_vintage", "VARCHAR", "Boundary vintage the geography definition refers to.", False),
        C("valid_from", "DATE", "First date this definition is valid, if bounded."),
        C("valid_to", "DATE", "Day after the last valid date, if bounded (half-open)."),
        C(
            "in_default_panel",
            "BOOLEAN",
            "True for the 50 states + DC default panel. Territories are never added implicitly.",
            False,
        ),
    ),
    primary_key=("geo_id",),
)

GEOGRAPHY_RELATIONSHIPS = Table(
    "geography_relationships",
    "Parent/child links between geographies (supports metros that cross state lines).",
    (
        C("child_geo_id", "VARCHAR", "Contained geography.", False),
        C("parent_geo_id", "VARCHAR", "Containing geography.", False),
        C("relationship", "VARCHAR", "within | part_within (crosses the parent's boundary).", False),
        C("valid_from", "DATE", "First valid date, if bounded."),
        C("valid_to", "DATE", "Day after last valid date, if bounded."),
    ),
    primary_key=("child_geo_id", "parent_geo_id", "relationship"),
    foreign_keys=(("child_geo_id", "geographies", "geo_id"), ("parent_geo_id", "geographies", "geo_id")),
)

MEASURES = Table(
    "measures",
    "What a value means: definition, unit, beverage, age universe and method family.",
    (
        C("measure_id", "VARCHAR", "Stable project identifier.", False),
        C("label", "VARCHAR", "Short human label.", False),
        C("definition", "VARCHAR", "Exact definition, following the source's wording where possible.", False),
        C(
            "unit",
            "VARCHAR",
            "Unit of the stored value (e.g. persons, usd_nominal, percent, us_gallons).",
            False,
        ),
        C("value_kind", "VARCHAR", "count | amount | percent | rate | ratio | index | fraction.", False),
        C("beverage", "VARCHAR", "all_alcohol | wine | beer | spirits | not_applicable.", False),
        C(
            "age_universe",
            "VARCHAR",
            "all_ages | age_14_plus | age_18_plus | age_21_plus | high_school_students (grades 9-12) | not_applicable.",
            False,
        ),
        C("recall_period", "VARCHAR", "Survey recall period (e.g. past_30_days) or not_applicable.", False),
        C("numerator", "VARCHAR", "What is counted or summed."),
        C("denominator", "VARCHAR", "Denominator for rates and percentages."),
        C(
            "method_family",
            "VARCHAR",
            "e.g. population_estimate, apparent_consumption, survey_direct, modeled_small_area, administrative_finance, price_index, derived.",
            False,
        ),
        C(
            "source_family",
            "VARCHAR",
            "population | consumption | behavior | finance | context | safety | health.",
            False,
        ),
        C(
            "nonnegative",
            "BOOLEAN",
            "True if negative values are invalid. Net amounts may be negative.",
            False,
        ),
        C(
            "causal_outcome_eligible",
            "BOOLEAN",
            "False for modeled small-area estimates (e.g. CDC PLACES), which must not be used to evaluate local policy effects.",
            False,
        ),
        C(
            "fiscal_component",
            "VARCHAR",
            "Finance only: tax | license | enterprise_gross_sales | enterprise_gross_profit | enterprise_net_transfer | earmarked_transfer | sales_tax_on_enterprise_sales | context_total.",
        ),
        C("government_level", "VARCHAR", "Finance only: state | local | state_and_local."),
        C(
            "accounting_basis",
            "VARCHAR",
            "Finance only: as published (e.g. census_classification, agency_unaudited).",
        ),
        C("costs_subtracted", "BOOLEAN", "Finance only: whether operating costs are already netted out."),
        C(
            "overlap_note",
            "VARCHAR",
            "Finance only: which other components this amount overlaps with or is part of.",
        ),
        C("notes", "VARCHAR", "Caveats."),
    ),
    primary_key=("measure_id",),
)

OBSERVATIONS = Table(
    "observations",
    "Every candidate value, including competing editions and revisions. Use preferred_observations for one value per cell.",
    (
        C("observation_id", "VARCHAR", "Deterministic ID derived from the natural key.", False),
        C("geo_id", "VARCHAR", "Geography.", False),
        C("measure_id", "VARCHAR", "Measure.", False),
        C("period_start", "DATE", "First day of the period.", False),
        C(
            "period_end",
            "DATE",
            "Last day of the period (inclusive). Equals period_start for point_in_time.",
            False,
        ),
        C(
            "period_kind",
            "VARCHAR",
            "point_in_time | calendar_year | state_fiscal_year | survey_year | month | pooled_years.",
            False,
        ),
        C("period_label", "VARCHAR", "Label as the source uses it (e.g. 'FY2025', '2019').", False),
        C(
            "year",
            "INTEGER",
            "Reference year for convenience: calendar year, survey year, or fiscal year END year.",
            False,
        ),
        C("subgroup", "VARCHAR", "Population subgroup; 'all' when not disaggregated.", False),
        C(
            "value",
            "DOUBLE",
            "Value in the measure's unit. NULL when missing; see missing_reason. Zero is a real observed zero.",
        ),
        C("missing_reason", "VARCHAR", "Why value is NULL. NULL when value is present."),
        C(
            "estimate_type",
            "VARCHAR",
            "reported_count | administrative_amount | survey_estimate | modeled_estimate | official_estimate | derived.",
            False,
        ),
        C(
            "extraction_method",
            "VARCHAR",
            "api | csv_parser | fixed_width_parser | spreadsheet_parser | pdf_table | manual | ocr | computed.",
            False,
        ),
        C(
            "asset_id",
            "VARCHAR",
            "Source asset the value came from (for derived values, the build's derivation asset).",
            False,
        ),
        C("source_locator", "VARCHAR", "Where in the asset: row/line/page/cell.", False),
        C("source_series", "VARCHAR", "Series identifier (part of the natural key).", False),
        C("source_vintage", "VARCHAR", "Edition/vintage token (part of the natural key).", False),
        C(
            "comparability_group",
            "VARCHAR",
            "Values in different groups must not be joined into one uninterrupted trend.",
            False,
        ),
        C(
            "quality_flags",
            "VARCHAR",
            "Pipe-separated flags (e.g. method_break_2011|variable_version_change).",
        ),
        C(
            "review_status",
            "VARCHAR",
            "For manual extractions: extracted_unreviewed | reviewed. NULL for parsed files.",
        ),
    ),
    primary_key=("observation_id",),
    foreign_keys=(
        ("geo_id", "geographies", "geo_id"),
        ("measure_id", "measures", "measure_id"),
        ("asset_id", "source_assets", "asset_id"),
    ),
    sort_by=(
        "measure_id",
        "geo_id",
        "period_start",
        "period_end",
        "subgroup",
        "source_series",
        "source_vintage",
    ),
)

OBSERVATION_DETAILS = Table(
    "observation_details",
    "Source-specific detail kept alongside each observation.",
    (
        C("observation_id", "VARCHAR", "Observation.", False),
        C("source_code", "VARCHAR", "Variable or item code in the source (e.g. BRFSS _RFBING5, Census T10)."),
        C("raw_value", "VARCHAR", "Value exactly as it appeared in the source, before scaling."),
        C("raw_unit", "VARCHAR", "Unit as published (e.g. thousands_of_dollars)."),
        C("multiplier", "DOUBLE", "Factor applied to raw_value to obtain value (e.g. 1000, 0.0001)."),
        C("ci_low", "DOUBLE", "Lower confidence limit, in the measure's unit."),
        C("ci_high", "DOUBLE", "Upper confidence limit, in the measure's unit."),
        C("ci_level", "DOUBLE", "Confidence level (e.g. 0.95)."),
        C("standard_error", "DOUBLE", "Standard error, if published."),
        C(
            "sample_size",
            "BIGINT",
            "Sample size as published (BRFSS: unweighted respondents in the response category).",
        ),
        C("suppression_flag", "VARCHAR", "Source suppression or footnote symbol."),
        C("footnote", "VARCHAR", "Source footnote text."),
        C("fiscal_year_end", "DATE", "Finance only: the state's fiscal year end date as published."),
        C(
            "extra",
            "VARCHAR",
            "JSON object with other source fields worth keeping (e.g. NIAAA decile, data source type).",
        ),
    ),
    primary_key=("observation_id",),
    foreign_keys=(("observation_id", "observations", "observation_id"),),
)

QUARANTINE = Table(
    "quarantine",
    "Rows that failed row-level validation. Visible for audit; never used in comparisons.",
    (
        C("asset_id", "VARCHAR", "Source asset.", False),
        C("source_locator", "VARCHAR", "Where in the asset.", False),
        C("measure_id", "VARCHAR", "Intended measure, if known."),
        C("geo_id", "VARCHAR", "Intended geography, if known."),
        C("period_label", "VARCHAR", "Period label, if known."),
        C("raw_value", "VARCHAR", "Raw value."),
        C("reason", "VARCHAR", "Why the row was quarantined.", False),
    ),
    sort_by=("asset_id", "source_locator", "reason"),
)

PREFERRED_SELECTION = Table(
    "preferred_selection",
    "For every cell with at least one candidate: each candidate, its rank, and the documented reason. Rank 1 is preferred.",
    (
        C("cell_key", "VARCHAR", "geo_id|measure_id|period_start|period_end|subgroup.", False),
        C("observation_id", "VARCHAR", "Candidate observation.", False),
        C("rank", "INTEGER", "1 = preferred.", False),
        C("candidate_count", "INTEGER", "Number of candidates in the cell.", False),
        C("reason", "VARCHAR", "Rule that produced the ranking.", False),
    ),
    primary_key=("cell_key", "observation_id"),
    foreign_keys=(("observation_id", "observations", "observation_id"),),
)

POLICY_EVENTS = Table(
    "policy_events",
    "Legal status intervals [effective_start, effective_end) for one jurisdiction and policy dimension.",
    (
        C("policy_id", "VARCHAR", "Stable identifier.", False),
        C("geo_id", "VARCHAR", "Jurisdiction whose law this is.", False),
        C(
            "policy_dimension",
            "VARCHAR",
            "e.g. ordinary_grocery_wine_authorization, beer_definition_max_alcohol.",
            False,
        ),
        C("beverage", "VARCHAR", "Beverage the provision concerns.", False),
        C(
            "policy_value",
            "VARCHAR",
            "Coded value (e.g. not_authorized, conditional_or_special_channel, max_5.0pct_abv_or_4.0pct_abw).",
            False,
        ),
        C("value_detail", "VARCHAR", "Plain-language detail of the provision."),
        C("authority_layer", "VARCHAR", "state | local.", False),
        C(
            "requires_local_adoption",
            "BOOLEAN",
            "True if the state provision only applies where a locality adopts it.",
            False,
        ),
        C("enactment_date", "DATE", "Date enacted/signed, if known."),
        C("effective_start", "DATE", "First day the value applies. NULL = unknown (never assumed)."),
        C("effective_start_precision", "VARCHAR", "day | month | year | unknown.", False),
        C(
            "effective_end",
            "DATE",
            "Day the value stops applying (exclusive). NULL = open-ended or unknown; see end_status.",
        ),
        C("end_status", "VARCHAR", "superseded | open_current | unknown.", False),
        C(
            "known_in_effect_from",
            "DATE",
            "Earliest date the evidence establishes the value was in effect (when effective_start is unknown).",
        ),
        C(
            "known_in_effect_through",
            "DATE",
            "Latest date the evidence establishes the value was still in effect (for open_current intervals).",
        ),
        C("extraction_status", "VARCHAR", "parsed | checked_against_original | uncertain.", False),
        C("temporal_status", "VARCHAR", "unresolved | anchored | reconstructed | reconciled.", False),
        C(
            "legal_review_status",
            "VARCHAR",
            "unreviewed | machine_assisted_review | maintainer_reviewed | expert_reviewed. Machine checks and "
            "Claude's reading are machine_assisted_review, never a human review.",
            False,
        ),
        C("claim_status", "VARCHAR", "supported | contradicted | incomplete | ambiguous.", False),
        C(
            "reviewer",
            "VARCHAR",
            "Human who reviewed it. Required for maintainer_reviewed / expert_reviewed.",
        ),
        C("review_date", "DATE", "Human review date. Required with reviewer."),
        C("notes", "VARCHAR", "Coding notes and caveats."),
    ),
    primary_key=("policy_id",),
    foreign_keys=(("geo_id", "geographies", "geo_id"),),
)

POLICY_EVIDENCE = Table(
    "policy_evidence",
    "Evidence for each policy interval: citation, locator and a short excerpt or paraphrase.",
    (
        C("evidence_id", "VARCHAR", "Stable identifier.", False),
        C("policy_id", "VARCHAR", "Policy interval supported.", False),
        C("asset_id", "VARCHAR", "Source asset consulted.", False),
        C("citation", "VARCHAR", "Statutory or legislative citation.", False),
        C("locator", "VARCHAR", "Section, subsection, line numbers or page.", False),
        C(
            "excerpt_or_paraphrase",
            "VARCHAR",
            "Short supporting excerpt (statutory text) or paraphrase.",
            False,
        ),
        C(
            "supports",
            "VARCHAR",
            "What it supports: value | start_date | end_date | local_option | status_as_of.",
            False,
        ),
        C(
            "evidence_strength",
            "VARCHAR",
            "enacted_text | current_code | legislative_record_summary | inference.",
            False,
        ),
        C("extracted_by", "VARCHAR", "Who extracted it.", False),
        C("extracted_on", "DATE", "Date extracted.", False),
        C("reviewed_by", "VARCHAR", "Who reviewed it, if anyone."),
        C("reviewed_on", "DATE", "Review date."),
    ),
    primary_key=("evidence_id",),
    foreign_keys=(("policy_id", "policy_events", "policy_id"), ("asset_id", "source_assets", "asset_id")),
)

POLICY_EXPOSURE = Table(
    "policy_exposure",
    "Derived jurisdiction-period-policy rows. Exposure is legal time exposed, not market penetration.",
    (
        C("geo_id", "VARCHAR", "Jurisdiction.", False),
        C("policy_dimension", "VARCHAR", "Policy dimension.", False),
        C("policy_value", "VARCHAR", "Value whose exposure is measured.", False),
        C("period_kind", "VARCHAR", "calendar_year | state_fiscal_year.", False),
        C("period_start", "DATE", "First day of the period.", False),
        C("period_end", "DATE", "Last day of the period (inclusive).", False),
        C("year", "INTEGER", "Calendar year, or fiscal year END year.", False),
        C("days_in_period", "INTEGER", "Days in the period (leap years counted).", False),
        C("covered_days", "INTEGER", "Days on which the value is verified to apply.", False),
        C("known_other_days", "INTEGER", "Days on which a different value is verified to apply.", False),
        C(
            "unknown_days",
            "INTEGER",
            "Days up to the as-of date with unknown legal status for this dimension.",
            False,
        ),
        C(
            "future_days",
            "INTEGER",
            "Days after the build's as-of date (not historical observations).",
            False,
        ),
        C(
            "exposure_fraction",
            "DOUBLE",
            "covered_days / days_in_period when every day is known and historical; NULL otherwise.",
        ),
        C(
            "exposure_fraction_min",
            "DOUBLE",
            "Lower bound: covered_days / days_in_period (a bound, not an estimate).",
            False,
        ),
        C(
            "exposure_fraction_max",
            "DOUBLE",
            "Upper bound: (covered + unknown + future days) / days_in_period (a bound, not an estimate).",
            False,
        ),
        C(
            "exposure_status",
            "VARCHAR",
            "exposed_full | exposed_partial | not_exposed | unknown | local_option_unknown | period_not_complete.",
            False,
        ),
        C("policy_ids", "VARCHAR", "Pipe-separated policy intervals used.", False),
        C("derivation_version", "VARCHAR", "Version of the exposure algorithm.", False),
    ),
    primary_key=("geo_id", "policy_dimension", "policy_value", "period_kind", "period_start"),
)

POLICY_SEGMENTS = Table(
    "policy_segments",
    "Continuous runs of days for one jurisdiction and dimension: a verified value, unknown, or disputed. No filling.",
    (
        C("geo_id", "VARCHAR", "Jurisdiction.", False),
        C("policy_dimension", "VARCHAR", "Policy dimension.", False),
        C("segment_start", "DATE", "First day of the run.", False),
        C("segment_end", "DATE", "Last day of the run (inclusive).", False),
        C("days", "INTEGER", "Days in the run.", False),
        C("state", "VARCHAR", "A policy value, or 'unknown' or 'disputed'.", False),
        C("policy_ids", "VARCHAR", "Pipe-separated intervals supporting the run; '-' when unknown.", False),
        C("derivation_version", "VARCHAR", "Version of the exposure algorithm.", False),
    ),
    primary_key=("geo_id", "policy_dimension", "segment_start"),
)

CLAIM_DEPENDENCIES = Table(
    "claim_dependencies",
    "Provisions a policy conclusion depends on, their role, and why the text answers the question (curated).",
    (
        C("claim_id", "VARCHAR", "Claim (a ledger claim or policy interval).", False),
        C("provision", "VARCHAR", "Statutory provision.", False),
        C(
            "role",
            "VARCHAR",
            "product_definition | retailer_category | affirmative_authority | general_prohibition | corroborating | special_channel.",
            False,
        ),
        C("indispensable", "BOOLEAN", "True if the conclusion fails without it.", False),
        C("actor_scope", "VARCHAR", "Whom the provision binds or authorizes.", False),
        C("reasoning", "VARCHAR", "Plain-language reason the text bears on the claim.", False),
        C("ledger_check", "VARCHAR", "section:check=expected used by the ledger, if any."),
        C(
            "legal_review_status",
            "VARCHAR",
            "unreviewed | machine_assisted_review | maintainer_reviewed | expert_reviewed.",
            False,
        ),
    ),
    primary_key=("claim_id", "provision", "role"),
)

POLICY_SNAPSHOTS = Table(
    "policy_snapshots",
    "Dated observations of a legal status from one source. A snapshot shows the status on the day it names; it"
    " is never stretched over other days and never counts as a verified interval (curated).",
    (
        C("snapshot_id", "VARCHAR", "Stable identifier.", False),
        C("geo_id", "VARCHAR", "Jurisdiction whose law this is.", False),
        C("policy_dimension", "VARCHAR", "Catalogued dimension (policy_dimensions).", False),
        C("policy_value", "VARCHAR", "Value observed, in the dimension's format.", False),
        C("value_detail", "VARCHAR", "Plain-language detail of the observed provision."),
        C("observed_on", "DATE", "Day the source shows the status. NULL when only the year is known."),
        C("observed_year", "INTEGER", "Year of the observation (always set).", False),
        C("observed_precision", "VARCHAR", "day | year.", False),
        C(
            "observed_basis",
            "VARCHAR",
            "retrieval_date (a current-law page read that day) | currency_statement (the source states the date "
            "its text is current to) | document_date (a dated print or enacted text).",
            False,
        ),
        C("asset_id", "VARCHAR", "Pinned source asset.", False),
        C("citation", "VARCHAR", "Statute, rule or page cited.", False),
        C("locator", "VARCHAR", "Section, subsection or page location.", False),
        C("excerpt", "VARCHAR", "Short excerpt of the source text supporting the value.", False),
        C(
            "evidence_strength",
            "VARCHAR",
            "current_code | enacted_text | agency_guidance | secondary_compilation.",
            False,
        ),
        C(
            "support_basis",
            "VARCHAR",
            "explicit_text (the excerpt names the outlet type or arrangement) | no_outlet_restriction (a general "
            "license open to retail businesses; that the outlet type qualifies is inferred from the absence of a "
            "restriction) | indirect (the text implies the status without stating it).",
            False,
        ),
        C("extraction_status", "VARCHAR", "parsed | checked_against_original | uncertain.", False),
        C(
            "legal_review_status",
            "VARCHAR",
            "unreviewed | machine_assisted_review | maintainer_reviewed | expert_reviewed.",
            False,
        ),
        C("extracted_by", "VARCHAR", "Who extracted it.", False),
        C("extracted_on", "DATE", "Date extracted.", False),
        C("reviewed_by", "VARCHAR", "Human reviewer, if any."),
        C("reviewed_on", "DATE", "Review date."),
        C("policy_id", "VARCHAR", "Interval in policy_events this snapshot also supports, if any."),
        C("notes", "VARCHAR", "Caveats: local variation, exceptions, conditions."),
    ),
    primary_key=("snapshot_id",),
    foreign_keys=(("geo_id", "geographies", "geo_id"), ("asset_id", "source_assets", "asset_id")),
)

POLICY_DIMENSIONS = Table(
    "policy_dimensions",
    "Policy catalog: every coded policy dimension, what it means, and how its values are written (curated).",
    (
        C("dimension_id", "VARCHAR", "Stable identifier used in policy_events.policy_dimension.", False),
        C(
            "domain",
            "VARCHAR",
            "retail_permission | local_implementation | retail_structure | wholesale_structure | special_channel | "
            "tax | markup | pricing | product_definition | sunday_sales | sales_hours | delivery.",
            False,
        ),
        C("label", "VARCHAR", "Plain label.", False),
        C("beverage", "VARCHAR", "Beverage the dimension concerns.", False),
        C("outlet", "VARCHAR", "Outlet or market level the dimension concerns.", False),
        C(
            "layer",
            "VARCHAR",
            "state (statewide permission or rule) | local (local implementation or take-up).",
            False,
        ),
        C("value_type", "VARCHAR", "categorical | numeric | fraction | text.", False),
        C("value_set", "VARCHAR", "For categorical dimensions: the value set in policy_dimension_values."),
        C("value_format", "VARCHAR", "For numeric, fraction and text dimensions: how values are written."),
        C(
            "statewide_counterpart",
            "VARCHAR",
            "For local dimensions: the statewide permission they implement.",
        ),
        C("definition", "VARCHAR", "What the dimension records.", False),
        C("notes", "VARCHAR", "Coding notes."),
    ),
    primary_key=("dimension_id",),
)

POLICY_DIMENSION_VALUES = Table(
    "policy_dimension_values",
    "Allowed values of categorical policy dimensions, with definitions (curated).",
    (
        C("value_set", "VARCHAR", "Value set named by policy_dimensions.value_set.", False),
        C("value", "VARCHAR", "Coded value.", False),
        C("label", "VARCHAR", "Plain label.", False),
        C("definition", "VARCHAR", "What the value means.", False),
    ),
    primary_key=("value_set", "value"),
)

MEASURE_CONCEPTS = Table(
    "measure_concepts",
    "Groups measures that replace one another over time (definition changes), in order (curated).",
    (
        C("concept_id", "VARCHAR", "Concept identifier.", False),
        C("concept_label", "VARCHAR", "Plain label of the concept.", False),
        C("measure_id", "VARCHAR", "Measure that implements one definition of the concept.", False),
        C("sequence", "INTEGER", "Order of the definitions over time.", False),
        C("definition_label", "VARCHAR", "Which definition, and for which years.", False),
        C("break_note", "VARCHAR", "What changed at the start of this definition."),
    ),
    primary_key=("measure_id",),
    foreign_keys=(("measure_id", "measures", "measure_id"),),
)

CLAIM_EXCEPTIONS = Table(
    "claim_exceptions",
    "Exceptions and special channels examined for a claim, with the relevance decision (curated).",
    (
        C("exception_id", "VARCHAR", "Stable identifier.", False),
        C("claim_id", "VARCHAR", "Claim examined.", False),
        C("provision", "VARCHAR", "Provision creating the exception or channel.", False),
        C("actor", "VARCHAR", "Who may act under it.", False),
        C("transaction", "VARCHAR", "What it permits.", False),
        C("product", "VARCHAR", "Products covered.", False),
        C("geography", "VARCHAR", "Where it applies.", False),
        C("dates", "VARCHAR", "Period examined.", False),
        C("relevance_decision", "VARCHAR", "Whether and how it affects the claim.", False),
        C("evidence", "VARCHAR", "Asset IDs or citations.", False),
        C(
            "legal_review_status",
            "VARCHAR",
            "unreviewed | machine_assisted_review | maintainer_reviewed | expert_reviewed.",
            False,
        ),
    ),
    primary_key=("exception_id",),
)

LINEAGE = Table(
    "lineage",
    "How each output was produced: inputs, transformation and code version.",
    (
        C("output_id", "VARCHAR", "Observation or other output ID.", False),
        C("output_table", "VARCHAR", "Table holding the output.", False),
        C(
            "input_ids",
            "VARCHAR",
            "Pipe-separated input IDs (asset_id for parsed values; observation_ids for derived).",
            False,
        ),
        C("transform_id", "VARCHAR", "Adapter or formula identifier with version.", False),
        C(
            "code_commit",
            "VARCHAR",
            "Git commit of the code that built it (with -dirty if uncommitted changes).",
            False,
        ),
        C("build_id", "VARCHAR", "Build identifier.", False),
    ),
    primary_key=("output_id", "output_table"),
)

COVERAGE = Table(
    "coverage",
    "Coverage by source series, measure and geography. Gaps inside the observed range are listed explicitly.",
    (
        C("source_series", "VARCHAR", "Series.", False),
        C("measure_id", "VARCHAR", "Measure.", False),
        C("geo_level", "VARCHAR", "Geography level.", False),
        C("geo_count", "INTEGER", "Geographies with at least one value.", False),
        C("first_year", "INTEGER", "First year with a value."),
        C("last_year", "INTEGER", "Last year with a value."),
        C(
            "expected_cells",
            "INTEGER",
            "geo_count x years between first_year and last_year (declared denominator).",
            False,
        ),
        C("observed_cells", "INTEGER", "Cells with a non-null value.", False),
        C("missing_cells_with_reason", "INTEGER", "Cells present as rows with a missing_reason.", False),
        C("absent_cells", "INTEGER", "Expected cells with no row at all.", False),
        C("missing_reasons", "VARCHAR", "Counts by missing reason, e.g. not_applicable:12|suppressed:3."),
        C(
            "interior_gap_years",
            "VARCHAR",
            "Years inside [first_year, last_year] with no value for any geography.",
        ),
    ),
    primary_key=("source_series", "measure_id", "geo_level"),
)

ALL_TABLES: tuple[Table, ...] = (
    SOURCES,
    SOURCE_ASSETS,
    GEOGRAPHIES,
    GEOGRAPHY_RELATIONSHIPS,
    MEASURES,
    OBSERVATIONS,
    OBSERVATION_DETAILS,
    QUARANTINE,
    PREFERRED_SELECTION,
    POLICY_EVENTS,
    POLICY_EVIDENCE,
    POLICY_EXPOSURE,
    POLICY_SEGMENTS,
    CLAIM_DEPENDENCIES,
    CLAIM_EXCEPTIONS,
    POLICY_SNAPSHOTS,
    POLICY_DIMENSIONS,
    POLICY_DIMENSION_VALUES,
    MEASURE_CONCEPTS,
    LINEAGE,
    COVERAGE,
)

TABLES = {t.name: t for t in ALL_TABLES}
