# Data dictionary

Generated from `src/alcohol_data/schemas/tables.py`, `src/alcohol_data/schemas/vocab.py` and
`metadata/measures.csv` (`alcohol-data report dictionary`). Do not edit by hand.

Conventions: geographic IDs are strings (state FIPS keep their leading zero: `state:06`, not `state:6`);
dates are ISO `YYYY-MM-DD`; timestamps are UTC; a missing value is an empty cell with a reason in
`missing_reason`, and `0` is always a real zero. Spreadsheet programs may strip leading zeros from
codes such as `06` when opening the CSV; import those columns as text.

## Tables

### `sources`

One row per publisher dataset or document family.

Primary key: `source_id`.

| Column | Type | Required | Description |
|---|---|---|---|
| `source_id` | VARCHAR | yes | Stable project identifier for the source. |
| `publisher` | VARCHAR | yes | Publishing agency or organization. |
| `title` | VARCHAR | yes | Title of the dataset or document family. |
| `landing_url` | VARCHAR | yes | Official landing page. |
| `citation` | VARCHAR | yes | Suggested citation text for the original source. |
| `source_family` | VARCHAR | yes | population | consumption | behavior | finance | policy | context. |
| `rights_status` | VARCHAR | yes | See vocabulary in docs/data-dictionary.md. |
| `rights_evidence_url` | VARCHAR |  | Where the rights determination comes from. |
| `notes` | VARCHAR |  | Caveats that apply to every asset from this source. |

### `source_assets`

One row per exact file or API response used by the build, identified by content hash.

Primary key: `asset_id`.

| Column | Type | Required | Description |
|---|---|---|---|
| `asset_id` | VARCHAR | yes | Stable project identifier for the asset. |
| `source_id` | VARCHAR | yes | Parent source. |
| `url` | VARCHAR |  | Asset URL with any credentials removed. Empty for manual-only assets. |
| `request_method` | VARCHAR | yes | GET, POST, or manual_import. |
| `edition` | VARCHAR | yes | Edition, vintage, or release label as published. |
| `source_series` | VARCHAR | yes | Series this asset belongs to (used in observation natural keys). |
| `source_vintage` | VARCHAR | yes | Vintage or edition token used in observation natural keys. |
| `retrieved_at` | TIMESTAMP |  | UTC time the bytes were retrieved or imported. |
| `sha256` | VARCHAR |  | SHA-256 of the raw bytes. |
| `bytes` | BIGINT |  | Size of the raw file. |
| `format` | VARCHAR | yes | Declared format (csv, xlsx, text_fixed_width, json, pdf, html). |
| `acquisition_status` | VARCHAR | yes | acquired | blocked_access | not_published | ... |
| `rights_status` | VARCHAR | yes | Rights status of this specific asset. |
| `redistribute_raw` | BOOLEAN | yes | Whether the raw file may be bundled in release downloads. |
| `parser` | VARCHAR |  | Adapter that parsed the asset. |
| `parser_version` | VARCHAR |  | Adapter version string. |
| `priority` | INTEGER |  | Higher wins when choosing preferred observations among competing series. |
| `notes` | VARCHAR |  | Asset-specific caveats. |

### `geographies`

Geographic units. IDs are strings; FIPS codes keep leading zeros.

Primary key: `geo_id`.

| Column | Type | Required | Description |
|---|---|---|---|
| `geo_id` | VARCHAR | yes | Project ID, e.g. 'state:49' (Utah), 'nation:us', 'census_region:4'. |
| `geo_level` | VARCHAR | yes | nation | census_region | state | county | place | cbsa. |
| `official_code` | VARCHAR | yes | Code in the official system (e.g. 2-digit state FIPS '06'). |
| `code_system` | VARCHAR | yes | Code system for official_code (e.g. fips_state). |
| `name` | VARCHAR | yes | Official name. |
| `abbreviation` | VARCHAR |  | USPS abbreviation where applicable. |
| `boundary_vintage` | VARCHAR | yes | Boundary vintage the geography definition refers to. |
| `valid_from` | DATE |  | First date this definition is valid, if bounded. |
| `valid_to` | DATE |  | Day after the last valid date, if bounded (half-open). |
| `in_default_panel` | BOOLEAN | yes | True for the 50 states + DC default panel. Territories are never added implicitly. |

### `geography_relationships`

Parent/child links between geographies (supports metros that cross state lines).

Primary key: `child_geo_id, parent_geo_id, relationship`.

| Column | Type | Required | Description |
|---|---|---|---|
| `child_geo_id` | VARCHAR | yes | Contained geography. |
| `parent_geo_id` | VARCHAR | yes | Containing geography. |
| `relationship` | VARCHAR | yes | within | part_within (crosses the parent's boundary). |
| `valid_from` | DATE |  | First valid date, if bounded. |
| `valid_to` | DATE |  | Day after last valid date, if bounded. |

### `measures`

What a value means: definition, unit, beverage, age universe and method family.

Primary key: `measure_id`.

| Column | Type | Required | Description |
|---|---|---|---|
| `measure_id` | VARCHAR | yes | Stable project identifier. |
| `label` | VARCHAR | yes | Short human label. |
| `definition` | VARCHAR | yes | Exact definition, following the source's wording where possible. |
| `unit` | VARCHAR | yes | Unit of the stored value (e.g. persons, usd_nominal, percent, us_gallons). |
| `value_kind` | VARCHAR | yes | count | amount | percent | rate | ratio | index | fraction. |
| `beverage` | VARCHAR | yes | all_alcohol | wine | beer | spirits | not_applicable. |
| `age_universe` | VARCHAR | yes | all_ages | age_14_plus | age_18_plus | age_21_plus | high_school_students (grades 9-12) | not_applicable. |
| `recall_period` | VARCHAR | yes | Survey recall period (e.g. past_30_days) or not_applicable. |
| `numerator` | VARCHAR |  | What is counted or summed. |
| `denominator` | VARCHAR |  | Denominator for rates and percentages. |
| `method_family` | VARCHAR | yes | e.g. population_estimate, apparent_consumption, survey_direct, modeled_small_area, administrative_finance, price_index, derived. |
| `source_family` | VARCHAR | yes | population | consumption | behavior | finance | context | safety | health. |
| `nonnegative` | BOOLEAN | yes | True if negative values are invalid. Net amounts may be negative. |
| `causal_outcome_eligible` | BOOLEAN | yes | False for modeled small-area estimates (e.g. CDC PLACES), which must not be used to evaluate local policy effects. |
| `fiscal_component` | VARCHAR |  | Finance only: tax | license | enterprise_gross_sales | enterprise_gross_profit | enterprise_net_transfer | earmarked_transfer | sales_tax_on_enterprise_sales | context_total. |
| `government_level` | VARCHAR |  | Finance only: state | local | state_and_local. |
| `accounting_basis` | VARCHAR |  | Finance only: as published (e.g. census_classification, agency_unaudited). |
| `costs_subtracted` | BOOLEAN |  | Finance only: whether operating costs are already netted out. |
| `overlap_note` | VARCHAR |  | Finance only: which other components this amount overlaps with or is part of. |
| `notes` | VARCHAR |  | Caveats. |

### `observations`

Every candidate value, including competing editions and revisions. Use preferred_observations for one value per cell.

Primary key: `observation_id`.

| Column | Type | Required | Description |
|---|---|---|---|
| `observation_id` | VARCHAR | yes | Deterministic ID derived from the natural key. |
| `geo_id` | VARCHAR | yes | Geography. |
| `measure_id` | VARCHAR | yes | Measure. |
| `period_start` | DATE | yes | First day of the period. |
| `period_end` | DATE | yes | Last day of the period (inclusive). Equals period_start for point_in_time. |
| `period_kind` | VARCHAR | yes | point_in_time | calendar_year | state_fiscal_year | survey_year | month | pooled_years. |
| `period_label` | VARCHAR | yes | Label as the source uses it (e.g. 'FY2025', '2019'). |
| `year` | INTEGER | yes | Reference year for convenience: calendar year, survey year, or fiscal year END year. |
| `subgroup` | VARCHAR | yes | Population subgroup; 'all' when not disaggregated. |
| `value` | DOUBLE |  | Value in the measure's unit. NULL when missing; see missing_reason. Zero is a real observed zero. |
| `missing_reason` | VARCHAR |  | Why value is NULL. NULL when value is present. |
| `estimate_type` | VARCHAR | yes | reported_count | administrative_amount | survey_estimate | modeled_estimate | official_estimate | derived. |
| `extraction_method` | VARCHAR | yes | api | csv_parser | fixed_width_parser | spreadsheet_parser | pdf_table | manual | ocr | computed. |
| `asset_id` | VARCHAR | yes | Source asset the value came from (for derived values, the build's derivation asset). |
| `source_locator` | VARCHAR | yes | Where in the asset: row/line/page/cell. |
| `source_series` | VARCHAR | yes | Series identifier (part of the natural key). |
| `source_vintage` | VARCHAR | yes | Edition/vintage token (part of the natural key). |
| `comparability_group` | VARCHAR | yes | Values in different groups must not be joined into one uninterrupted trend. |
| `quality_flags` | VARCHAR |  | Pipe-separated flags (e.g. method_break_2011|variable_version_change). |
| `review_status` | VARCHAR |  | For manual extractions: extracted_unreviewed | reviewed. NULL for parsed files. |

### `observation_details`

Source-specific detail kept alongside each observation.

Primary key: `observation_id`.

| Column | Type | Required | Description |
|---|---|---|---|
| `observation_id` | VARCHAR | yes | Observation. |
| `source_code` | VARCHAR |  | Variable or item code in the source (e.g. BRFSS _RFBING5, Census T10). |
| `raw_value` | VARCHAR |  | Value exactly as it appeared in the source, before scaling. |
| `raw_unit` | VARCHAR |  | Unit as published (e.g. thousands_of_dollars). |
| `multiplier` | DOUBLE |  | Factor applied to raw_value to obtain value (e.g. 1000, 0.0001). |
| `ci_low` | DOUBLE |  | Lower confidence limit, in the measure's unit. |
| `ci_high` | DOUBLE |  | Upper confidence limit, in the measure's unit. |
| `ci_level` | DOUBLE |  | Confidence level (e.g. 0.95). |
| `standard_error` | DOUBLE |  | Standard error, if published. |
| `sample_size` | BIGINT |  | Sample size as published (BRFSS: unweighted respondents in the response category). |
| `suppression_flag` | VARCHAR |  | Source suppression or footnote symbol. |
| `footnote` | VARCHAR |  | Source footnote text. |
| `fiscal_year_end` | DATE |  | Finance only: the state's fiscal year end date as published. |
| `extra` | VARCHAR |  | JSON object with other source fields worth keeping (e.g. NIAAA decile, data source type). |

### `quarantine`

Rows that failed row-level validation. Visible for audit; never used in comparisons.

| Column | Type | Required | Description |
|---|---|---|---|
| `asset_id` | VARCHAR | yes | Source asset. |
| `source_locator` | VARCHAR | yes | Where in the asset. |
| `measure_id` | VARCHAR |  | Intended measure, if known. |
| `geo_id` | VARCHAR |  | Intended geography, if known. |
| `period_label` | VARCHAR |  | Period label, if known. |
| `raw_value` | VARCHAR |  | Raw value. |
| `reason` | VARCHAR | yes | Why the row was quarantined. |

### `preferred_selection`

For every cell with at least one candidate: each candidate, its rank, and the documented reason. Rank 1 is preferred.

Primary key: `cell_key, observation_id`.

| Column | Type | Required | Description |
|---|---|---|---|
| `cell_key` | VARCHAR | yes | geo_id|measure_id|period_start|period_end|subgroup. |
| `observation_id` | VARCHAR | yes | Candidate observation. |
| `rank` | INTEGER | yes | 1 = preferred. |
| `candidate_count` | INTEGER | yes | Number of candidates in the cell. |
| `reason` | VARCHAR | yes | Rule that produced the ranking. |

### `policy_events`

Legal status intervals [effective_start, effective_end) for one jurisdiction and policy dimension.

Primary key: `policy_id`.

| Column | Type | Required | Description |
|---|---|---|---|
| `policy_id` | VARCHAR | yes | Stable identifier. |
| `geo_id` | VARCHAR | yes | Jurisdiction whose law this is. |
| `policy_dimension` | VARCHAR | yes | e.g. ordinary_grocery_wine_authorization, beer_definition_max_alcohol. |
| `beverage` | VARCHAR | yes | Beverage the provision concerns. |
| `policy_value` | VARCHAR | yes | Coded value (e.g. not_authorized, conditional_or_special_channel, max_5.0pct_abv_or_4.0pct_abw). |
| `value_detail` | VARCHAR |  | Plain-language detail of the provision. |
| `authority_layer` | VARCHAR | yes | state | local. |
| `requires_local_adoption` | BOOLEAN | yes | True if the state provision only applies where a locality adopts it. |
| `enactment_date` | DATE |  | Date enacted/signed, if known. |
| `effective_start` | DATE |  | First day the value applies. NULL = unknown (never assumed). |
| `effective_start_precision` | VARCHAR | yes | day | month | year | unknown. |
| `effective_end` | DATE |  | Day the value stops applying (exclusive). NULL = open-ended or unknown; see end_status. |
| `end_status` | VARCHAR | yes | superseded | open_current | unknown. |
| `known_in_effect_from` | DATE |  | Earliest date the evidence establishes the value was in effect (when effective_start is unknown). |
| `known_in_effect_through` | DATE |  | Latest date the evidence establishes the value was still in effect (for open_current intervals). |
| `extraction_status` | VARCHAR | yes | parsed | checked_against_original | uncertain. |
| `temporal_status` | VARCHAR | yes | unresolved | anchored | reconstructed | reconciled. |
| `legal_review_status` | VARCHAR | yes | unreviewed | machine_assisted_review | maintainer_reviewed | expert_reviewed. Machine checks and Claude's reading are machine_assisted_review, never a human review. |
| `claim_status` | VARCHAR | yes | supported | contradicted | incomplete | ambiguous. |
| `reviewer` | VARCHAR |  | Human who reviewed it. Required for maintainer_reviewed / expert_reviewed. |
| `review_date` | DATE |  | Human review date. Required with reviewer. |
| `notes` | VARCHAR |  | Coding notes and caveats. |

### `policy_evidence`

Evidence for each policy interval: citation, locator and a short excerpt or paraphrase.

Primary key: `evidence_id`.

| Column | Type | Required | Description |
|---|---|---|---|
| `evidence_id` | VARCHAR | yes | Stable identifier. |
| `policy_id` | VARCHAR | yes | Policy interval supported. |
| `asset_id` | VARCHAR | yes | Source asset consulted. |
| `citation` | VARCHAR | yes | Statutory or legislative citation. |
| `locator` | VARCHAR | yes | Section, subsection, line numbers or page. |
| `excerpt_or_paraphrase` | VARCHAR | yes | Short supporting excerpt (statutory text) or paraphrase. |
| `supports` | VARCHAR | yes | What it supports: value | start_date | end_date | local_option | status_as_of. |
| `evidence_strength` | VARCHAR | yes | enacted_text | current_code | legislative_record_summary | inference. |
| `extracted_by` | VARCHAR | yes | Who extracted it. |
| `extracted_on` | DATE | yes | Date extracted. |
| `reviewed_by` | VARCHAR |  | Who reviewed it, if anyone. |
| `reviewed_on` | DATE |  | Review date. |

### `policy_exposure`

Derived jurisdiction-period-policy rows. Exposure is legal time exposed, not market penetration.

Primary key: `geo_id, policy_dimension, policy_value, period_kind, period_start`.

| Column | Type | Required | Description |
|---|---|---|---|
| `geo_id` | VARCHAR | yes | Jurisdiction. |
| `policy_dimension` | VARCHAR | yes | Policy dimension. |
| `policy_value` | VARCHAR | yes | Value whose exposure is measured. |
| `period_kind` | VARCHAR | yes | calendar_year | state_fiscal_year. |
| `period_start` | DATE | yes | First day of the period. |
| `period_end` | DATE | yes | Last day of the period (inclusive). |
| `year` | INTEGER | yes | Calendar year, or fiscal year END year. |
| `days_in_period` | INTEGER | yes | Days in the period (leap years counted). |
| `covered_days` | INTEGER | yes | Days on which the value is verified to apply. |
| `known_other_days` | INTEGER | yes | Days on which a different value is verified to apply. |
| `unknown_days` | INTEGER | yes | Days up to the as-of date with unknown legal status for this dimension. |
| `future_days` | INTEGER | yes | Days after the build's as-of date (not historical observations). |
| `exposure_fraction` | DOUBLE |  | covered_days / days_in_period when every day is known and historical; NULL otherwise. |
| `exposure_fraction_min` | DOUBLE | yes | Lower bound: covered_days / days_in_period (a bound, not an estimate). |
| `exposure_fraction_max` | DOUBLE | yes | Upper bound: (covered + unknown + future days) / days_in_period (a bound, not an estimate). |
| `exposure_status` | VARCHAR | yes | exposed_full | exposed_partial | not_exposed | unknown | local_option_unknown | period_not_complete. |
| `policy_ids` | VARCHAR | yes | Pipe-separated policy intervals used. |
| `derivation_version` | VARCHAR | yes | Version of the exposure algorithm. |

### `policy_segments`

Continuous runs of days for one jurisdiction and dimension: a verified value, unknown, or disputed. No filling.

Primary key: `geo_id, policy_dimension, segment_start`.

| Column | Type | Required | Description |
|---|---|---|---|
| `geo_id` | VARCHAR | yes | Jurisdiction. |
| `policy_dimension` | VARCHAR | yes | Policy dimension. |
| `segment_start` | DATE | yes | First day of the run. |
| `segment_end` | DATE | yes | Last day of the run (inclusive). |
| `days` | INTEGER | yes | Days in the run. |
| `state` | VARCHAR | yes | A policy value, or 'unknown' or 'disputed'. |
| `policy_ids` | VARCHAR | yes | Pipe-separated intervals supporting the run; '-' when unknown. |
| `derivation_version` | VARCHAR | yes | Version of the exposure algorithm. |

### `claim_dependencies`

Provisions a policy conclusion depends on, their role, and why the text answers the question (curated).

Primary key: `claim_id, provision, role`.

| Column | Type | Required | Description |
|---|---|---|---|
| `claim_id` | VARCHAR | yes | Claim (a ledger claim or policy interval). |
| `provision` | VARCHAR | yes | Statutory provision. |
| `role` | VARCHAR | yes | product_definition | retailer_category | affirmative_authority | general_prohibition | corroborating | special_channel. |
| `indispensable` | BOOLEAN | yes | True if the conclusion fails without it. |
| `actor_scope` | VARCHAR | yes | Whom the provision binds or authorizes. |
| `reasoning` | VARCHAR | yes | Plain-language reason the text bears on the claim. |
| `ledger_check` | VARCHAR |  | section:check=expected used by the ledger, if any. |
| `legal_review_status` | VARCHAR | yes | unreviewed | machine_assisted_review | maintainer_reviewed | expert_reviewed. |

### `claim_exceptions`

Exceptions and special channels examined for a claim, with the relevance decision (curated).

Primary key: `exception_id`.

| Column | Type | Required | Description |
|---|---|---|---|
| `exception_id` | VARCHAR | yes | Stable identifier. |
| `claim_id` | VARCHAR | yes | Claim examined. |
| `provision` | VARCHAR | yes | Provision creating the exception or channel. |
| `actor` | VARCHAR | yes | Who may act under it. |
| `transaction` | VARCHAR | yes | What it permits. |
| `product` | VARCHAR | yes | Products covered. |
| `geography` | VARCHAR | yes | Where it applies. |
| `dates` | VARCHAR | yes | Period examined. |
| `relevance_decision` | VARCHAR | yes | Whether and how it affects the claim. |
| `evidence` | VARCHAR | yes | Asset IDs or citations. |
| `legal_review_status` | VARCHAR | yes | unreviewed | machine_assisted_review | maintainer_reviewed | expert_reviewed. |

### `policy_snapshots`

Dated observations of a legal status from one source. A snapshot shows the status on the day it names; it is never stretched over other days and never counts as a verified interval (curated).

Primary key: `snapshot_id`.

| Column | Type | Required | Description |
|---|---|---|---|
| `snapshot_id` | VARCHAR | yes | Stable identifier. |
| `geo_id` | VARCHAR | yes | Jurisdiction whose law this is. |
| `policy_dimension` | VARCHAR | yes | Catalogued dimension (policy_dimensions). |
| `policy_value` | VARCHAR | yes | Value observed, in the dimension's format. |
| `value_detail` | VARCHAR |  | Plain-language detail of the observed provision. |
| `observed_on` | DATE |  | Day the source shows the status. NULL when only the year is known. |
| `observed_year` | INTEGER | yes | Year of the observation (always set). |
| `observed_precision` | VARCHAR | yes | day | year. |
| `observed_basis` | VARCHAR | yes | retrieval_date (a current-law page read that day) | currency_statement (the source states the date its text is current to) | document_date (a dated print or enacted text). |
| `asset_id` | VARCHAR | yes | Pinned source asset. |
| `citation` | VARCHAR | yes | Statute, rule or page cited. |
| `locator` | VARCHAR | yes | Section, subsection or page location. |
| `excerpt` | VARCHAR | yes | Short excerpt of the source text supporting the value. |
| `evidence_strength` | VARCHAR | yes | current_code | enacted_text | agency_guidance | secondary_compilation. |
| `support_basis` | VARCHAR | yes | explicit_text (the excerpt names the outlet type or arrangement) | no_outlet_restriction (a general license open to retail businesses; that the outlet type qualifies is inferred from the absence of a restriction) | indirect (the text implies the status without stating it). |
| `extraction_status` | VARCHAR | yes | parsed | checked_against_original | uncertain. |
| `legal_review_status` | VARCHAR | yes | unreviewed | machine_assisted_review | maintainer_reviewed | expert_reviewed. |
| `extracted_by` | VARCHAR | yes | Who extracted it. |
| `extracted_on` | DATE | yes | Date extracted. |
| `reviewed_by` | VARCHAR |  | Human reviewer, if any. |
| `reviewed_on` | DATE |  | Review date. |
| `policy_id` | VARCHAR |  | Interval in policy_events this snapshot also supports, if any. |
| `notes` | VARCHAR |  | Caveats: local variation, exceptions, conditions. |

### `policy_dimensions`

Policy catalog: every coded policy dimension, what it means, and how its values are written (curated).

Primary key: `dimension_id`.

| Column | Type | Required | Description |
|---|---|---|---|
| `dimension_id` | VARCHAR | yes | Stable identifier used in policy_events.policy_dimension. |
| `domain` | VARCHAR | yes | retail_permission | local_implementation | retail_structure | wholesale_structure | special_channel | tax | markup | pricing | product_definition | sunday_sales | sales_hours | delivery. |
| `label` | VARCHAR | yes | Plain label. |
| `beverage` | VARCHAR | yes | Beverage the dimension concerns. |
| `outlet` | VARCHAR | yes | Outlet or market level the dimension concerns. |
| `layer` | VARCHAR | yes | state (statewide permission or rule) | local (local implementation or take-up). |
| `value_type` | VARCHAR | yes | categorical | numeric | fraction | text. |
| `value_set` | VARCHAR |  | For categorical dimensions: the value set in policy_dimension_values. |
| `value_format` | VARCHAR |  | For numeric, fraction and text dimensions: how values are written. |
| `statewide_counterpart` | VARCHAR |  | For local dimensions: the statewide permission they implement. |
| `definition` | VARCHAR | yes | What the dimension records. |
| `notes` | VARCHAR |  | Coding notes. |

### `policy_dimension_values`

Allowed values of categorical policy dimensions, with definitions (curated).

Primary key: `value_set, value`.

| Column | Type | Required | Description |
|---|---|---|---|
| `value_set` | VARCHAR | yes | Value set named by policy_dimensions.value_set. |
| `value` | VARCHAR | yes | Coded value. |
| `label` | VARCHAR | yes | Plain label. |
| `definition` | VARCHAR | yes | What the value means. |

### `measure_concepts`

Groups measures that replace one another over time (definition changes), in order (curated).

Primary key: `measure_id`.

| Column | Type | Required | Description |
|---|---|---|---|
| `concept_id` | VARCHAR | yes | Concept identifier. |
| `concept_label` | VARCHAR | yes | Plain label of the concept. |
| `measure_id` | VARCHAR | yes | Measure that implements one definition of the concept. |
| `sequence` | INTEGER | yes | Order of the definitions over time. |
| `definition_label` | VARCHAR | yes | Which definition, and for which years. |
| `break_note` | VARCHAR |  | What changed at the start of this definition. |

### `lineage`

How each output was produced: inputs, transformation and code version.

Primary key: `output_id, output_table`.

| Column | Type | Required | Description |
|---|---|---|---|
| `output_id` | VARCHAR | yes | Observation or other output ID. |
| `output_table` | VARCHAR | yes | Table holding the output. |
| `input_ids` | VARCHAR | yes | Pipe-separated input IDs (asset_id for parsed values; observation_ids for derived). |
| `transform_id` | VARCHAR | yes | Adapter or formula identifier with version. |
| `code_commit` | VARCHAR | yes | Git commit of the code that built it (with -dirty if uncommitted changes). |
| `build_id` | VARCHAR | yes | Build identifier. |

### `coverage`

Coverage by source series, measure and geography. Gaps inside the observed range are listed explicitly.

Primary key: `source_series, measure_id, geo_level`.

| Column | Type | Required | Description |
|---|---|---|---|
| `source_series` | VARCHAR | yes | Series. |
| `measure_id` | VARCHAR | yes | Measure. |
| `geo_level` | VARCHAR | yes | Geography level. |
| `geo_count` | INTEGER | yes | Geographies with at least one value. |
| `first_year` | INTEGER |  | First year with a value. |
| `last_year` | INTEGER |  | Last year with a value. |
| `expected_cells` | INTEGER | yes | geo_count x years between first_year and last_year (declared denominator). |
| `observed_cells` | INTEGER | yes | Cells with a non-null value. |
| `missing_cells_with_reason` | INTEGER | yes | Cells present as rows with a missing_reason. |
| `absent_cells` | INTEGER | yes | Expected cells with no row at all. |
| `missing_reasons` | VARCHAR |  | Counts by missing reason, e.g. not_applicable:12|suppressed:3. |
| `interior_gap_years` | VARCHAR |  | Years inside [first_year, last_year] with no value for any geography. |

### Views

- `preferred_observations`: one row per cell (geography x measure x period x subgroup) chosen by
  `preferred_selection`; conflicting cells appear with `value` NULL and `missing_reason = unresolved_conflict`.
- `state_year_long`: preferred state values with labels and units, long format (excludes monthly CPI).
- `fiscal_components`: finance measures side by side with what each includes and overlaps. No totals.
- `build_info` (table): build identifier, code commit, schema version, pins digest.

## Controlled vocabularies

### estimate_type

- `reported_count`: A count published by the source (people, gallons, cases).
- `administrative_amount`: A money amount taken from an administrative or financial record.
- `survey_estimate`: A weighted estimate published from a probability survey.
- `modeled_estimate`: A model-based estimate (e.g. small-area models). Never a causal outcome by default.
- `official_estimate`: A demographic or statistical estimate published by an agency (e.g. Census population estimates).
- `derived`: Computed by this project from other observations; see lineage.

### extraction_method

- `api`: Machine-readable API response.
- `csv_parser`: Delimited text file parsed by code.
- `fixed_width_parser`: Fixed-width text file parsed by code.
- `spreadsheet_parser`: Spreadsheet parsed by code.
- `pdf_table`: Table extracted from a PDF by code.
- `manual`: Transcribed by hand from a rendered page. Still an official value if the source is official.
- `ocr`: Optical character recognition.
- `computed`: Computed by this project (derived values only).

### missing_reason

- `not_collected`: The source did not collect this item for this unit and period.
- `not_published`: Collected but not published (or not yet published).
- `suppressed`: Withheld by the source, e.g. for small samples or confidentiality.
- `not_applicable`: The concept does not apply (e.g. Census 'X': tax not imposed / not applicable).
- `unavailable`: Published as unavailable by the source, or an input needed for a derivation is missing.
- `unresolved_conflict`: Sources disagree and no documented rule selects one value.

### period_kind

- `point_in_time`: A single date (e.g. July 1 population estimate). period_start == period_end.
- `calendar_year`: January 1 to December 31.
- `state_fiscal_year`: The state government's 12-month fiscal year; dates vary by state.
- `survey_year`: A survey's data year (BRFSS interviews fielded during the calendar year).
- `month`: One calendar month.
- `pooled_years`: An estimate pooling several years. Never an observation of a single year.

### geo_level

- `nation`: United States (50 states and DC unless a source says otherwise).
- `census_region`: Census Bureau region (Northeast, Midwest, South, West).
- `state`: State or the District of Columbia.
- `county`: County or county-equivalent.
- `place`: Incorporated place (city/town).
- `cbsa`: Core-based statistical area (metro/micro). Delineation vintage matters.

### rights_status

- `public_domain_us_federal`: Work of the U.S. federal government (17 U.S.C. 105); verify embedded third-party material.
- `open_license`: Published under an open license; see license field.
- `government_edict`: Statutes and enacted legislation; not subject to copyright (government edicts doctrine).
- `facts_with_citation`: Only extracted factual values and short citations are redistributed; the original document is not.
- `rights_unresolved`: Redistribution of the raw file is not cleared. Raw file is not bundled.
- `blocked_access`: Automated access is refused by the host. Manual acquisition required.

### extraction_status

- `parsed`: Text extracted by code; not compared with the original rendering.
- `checked_against_original`: Excerpts compared with the original page image or source file.
- `uncertain`: Extraction may be wrong (OCR doubt, layout loss); needs checking.

### temporal_status

- `unresolved`: Dates rest on a summary or inference; operative dates not established.
- `anchored`: Dates come from official dated versions or enacted effective-date clauses.
- `reconstructed`: Operative text and dates rebuilt from enacted amendments.
- `reconciled`: Reconstruction checked against an independent anchor (e.g. a later code edition).

### legal_review_status

- `unreviewed`: Nobody has assessed whether the cited text answers the question.
- `machine_assisted_review`: Assessed by code checks and/or an AI assistant (Claude). Not a human review.
- `maintainer_reviewed`: A named project maintainer reviewed the claim against the evidence.
- `expert_reviewed`: A named legal expert reviewed the claim. Recorded only when real.

### claim_status

- `supported`: The cited evidence supports the coded value for the stated window.
- `contradicted`: Evidence contradicts the coded value.
- `incomplete`: Some indispensable dependency is unverified for part of the window.
- `ambiguous`: Evidence admits more than one reading.

### exposure_status

- `exposed_full`: The policy value applied on every day of the period.
- `exposed_partial`: The policy value applied on some days; see covered_days and exposure_fraction.
- `not_exposed`: Verified that the policy value did not apply on any day of the period.
- `unknown`: Legal status unknown for some or all days. Never treated as exposed or not exposed.
- `local_option_unknown`: State authorized local adoption, but local adoption coverage is unknown.
- `period_not_complete`: Part of the period lies after the build's as-of date; see the min/max bounds.

## Measures

| Measure | Label | Unit | Beverage | Age universe | Method | Definition |
|---|---|---|---|---|---|---|
| `pop_total_resident` | Resident population, all ages | persons | not_applicable | all_ages | population_estimate | Resident population, all ages. Census series: July 1 estimate (point_in_time). NIAAA denominator series: the population NIAAA used for the calendar year (calendar_year period kind), a separate cell that never substitutes for a Census July 1 value. |
| `pop_age14plus_resident` | Resident population age 14 and older | persons | not_applicable | age_14_plus | population_estimate | Resident population age 14 and older. Census series: July 1 estimate (point_in_time). NIAAA denominator series: the population NIAAA used for the calendar year (calendar_year period kind), a separate cell that never substitutes for a Census July 1 value. |
| `pop_age18plus_resident` | Resident population age 18 and older | persons | not_applicable | age_18_plus | population_estimate | Resident population age 18 and older. Census series: July 1 estimate (point_in_time). NIAAA denominator series: the population NIAAA used for the calendar year (calendar_year period kind), a separate cell that never substitutes for a Census July 1 value. |
| `pop_age21plus_resident` | Resident population age 21 and older | persons | not_applicable | age_21_plus | population_estimate | Resident population age 21 and older. Census series: July 1 estimate (point_in_time). NIAAA denominator series: the population NIAAA used for the calendar year (calendar_year period kind), a separate cell that never substitutes for a Census July 1 value. |
| `niaaa_beverage_gallons_spirits` | Apparent consumption, gallons of distilled spirits (beverage volume) | us_gallons | spirits | not_applicable | apparent_consumption | Gallons of distilled spirits (beverage, not ethanol) in NIAAA apparent consumption data, from state sales, tax-receipt or shipment records or industry sources. |
| `niaaa_time_varying_abv_spirits` | Time-varying alcohol by volume used for distilled spirits | fraction | spirits | not_applicable | apparent_consumption | Alcohol-by-volume fraction NIAAA assigns to distilled spirits for the state and year in its time-varying ABV method. |
| `niaaa_beverage_gallons_wine` | Apparent consumption, gallons of wine (beverage volume) | us_gallons | wine | not_applicable | apparent_consumption | Gallons of wine (beverage, not ethanol) in NIAAA apparent consumption data, from state sales, tax-receipt or shipment records or industry sources. |
| `niaaa_time_varying_abv_wine` | Time-varying alcohol by volume used for wine | fraction | wine | not_applicable | apparent_consumption | Alcohol-by-volume fraction NIAAA assigns to wine for the state and year in its time-varying ABV method. |
| `niaaa_beverage_gallons_beer` | Apparent consumption, gallons of beer (beverage volume) | us_gallons | beer | not_applicable | apparent_consumption | Gallons of beer (beverage, not ethanol) in NIAAA apparent consumption data, from state sales, tax-receipt or shipment records or industry sources. |
| `niaaa_time_varying_abv_beer` | Time-varying alcohol by volume used for beer | fraction | beer | not_applicable | apparent_consumption | Alcohol-by-volume fraction NIAAA assigns to beer for the state and year in its time-varying ABV method. |
| `niaaa_ethanol_gallons_spirits` | Apparent consumption, gallons of ethanol from distilled spirits | us_gallons_ethanol | spirits | not_applicable | apparent_consumption | Gallons of pure ethanol from distilled spirits, converted from beverage volume with NIAAA's standard ethanol conversion factors. |
| `niaaa_ethanol_gallons_time_varying_abv_spirits` | Gallons of ethanol from distilled spirits, time-varying ABV method | us_gallons_ethanol | spirits | not_applicable | apparent_consumption | Gallons of ethanol from distilled spirits using NIAAA's time-varying ABV estimates instead of fixed conversion factors. |
| `niaaa_ethanol_per_capita_14plus_spirits` | Apparent consumption per capita age 14 and older, gallons of ethanol (distilled spirits) | us_gallons_ethanol_per_person | spirits | age_14_plus | apparent_consumption | Gallons of ethanol from distilled spirits divided by NIAAA's population age 14 and older. Published x 10,000; stored in gallons. |
| `niaaa_ethanol_per_capita_21plus_spirits` | Apparent consumption per capita age 21 and older, gallons of ethanol (distilled spirits) | us_gallons_ethanol_per_person | spirits | age_21_plus | apparent_consumption | Gallons of ethanol from distilled spirits divided by NIAAA's population age 21 and older. Published x 10,000; stored in gallons. |
| `niaaa_ethanol_gallons_wine` | Apparent consumption, gallons of ethanol from wine | us_gallons_ethanol | wine | not_applicable | apparent_consumption | Gallons of pure ethanol from wine, converted from beverage volume with NIAAA's standard ethanol conversion factors. |
| `niaaa_ethanol_gallons_time_varying_abv_wine` | Gallons of ethanol from wine, time-varying ABV method | us_gallons_ethanol | wine | not_applicable | apparent_consumption | Gallons of ethanol from wine using NIAAA's time-varying ABV estimates instead of fixed conversion factors. |
| `niaaa_ethanol_per_capita_14plus_wine` | Apparent consumption per capita age 14 and older, gallons of ethanol (wine) | us_gallons_ethanol_per_person | wine | age_14_plus | apparent_consumption | Gallons of ethanol from wine divided by NIAAA's population age 14 and older. Published x 10,000; stored in gallons. |
| `niaaa_ethanol_per_capita_21plus_wine` | Apparent consumption per capita age 21 and older, gallons of ethanol (wine) | us_gallons_ethanol_per_person | wine | age_21_plus | apparent_consumption | Gallons of ethanol from wine divided by NIAAA's population age 21 and older. Published x 10,000; stored in gallons. |
| `niaaa_ethanol_gallons_beer` | Apparent consumption, gallons of ethanol from beer | us_gallons_ethanol | beer | not_applicable | apparent_consumption | Gallons of pure ethanol from beer, converted from beverage volume with NIAAA's standard ethanol conversion factors. |
| `niaaa_ethanol_gallons_time_varying_abv_beer` | Gallons of ethanol from beer, time-varying ABV method | us_gallons_ethanol | beer | not_applicable | apparent_consumption | Gallons of ethanol from beer using NIAAA's time-varying ABV estimates instead of fixed conversion factors. |
| `niaaa_ethanol_per_capita_14plus_beer` | Apparent consumption per capita age 14 and older, gallons of ethanol (beer) | us_gallons_ethanol_per_person | beer | age_14_plus | apparent_consumption | Gallons of ethanol from beer divided by NIAAA's population age 14 and older. Published x 10,000; stored in gallons. |
| `niaaa_ethanol_per_capita_21plus_beer` | Apparent consumption per capita age 21 and older, gallons of ethanol (beer) | us_gallons_ethanol_per_person | beer | age_21_plus | apparent_consumption | Gallons of ethanol from beer divided by NIAAA's population age 21 and older. Published x 10,000; stored in gallons. |
| `niaaa_ethanol_gallons_all` | Apparent consumption, gallons of ethanol from all alcoholic beverages | us_gallons_ethanol | all | not_applicable | apparent_consumption | Gallons of pure ethanol from all alcoholic beverages, converted from beverage volume with NIAAA's standard ethanol conversion factors. |
| `niaaa_ethanol_gallons_time_varying_abv_all` | Gallons of ethanol from all alcoholic beverages, time-varying ABV method | us_gallons_ethanol | all | not_applicable | apparent_consumption | Gallons of ethanol from all alcoholic beverages using NIAAA's time-varying ABV estimates instead of fixed conversion factors. |
| `niaaa_ethanol_per_capita_14plus_all` | Apparent consumption per capita age 14 and older, gallons of ethanol (all alcoholic beverages) | us_gallons_ethanol_per_person | all | age_14_plus | apparent_consumption | Gallons of ethanol from all alcoholic beverages divided by NIAAA's population age 14 and older. Published x 10,000; stored in gallons. |
| `niaaa_ethanol_per_capita_21plus_all` | Apparent consumption per capita age 21 and older, gallons of ethanol (all alcoholic beverages) | us_gallons_ethanol_per_person | all | age_21_plus | apparent_consumption | Gallons of ethanol from all alcoholic beverages divided by NIAAA's population age 21 and older. Published x 10,000; stored in gallons. |
| `brfss_drank_any_past_month_question_pct` | Drank any alcohol in the past month (1995-1999 questionnaire item) | percent | all_alcohol | age_18_plus | survey_direct | Percent of adults answering yes to 'During the past month, have you had at least one drink of any alcoholic beverage?' (BRFSS item DRINKANY). Published crude prevalence, Overall break-out. |
| `brfss_drank_any_past_30d_pct` | Drank any alcohol in the past 30 days | percent | all_alcohol | age_18_plus | survey_direct | Percent of adults who have had at least one drink of alcohol within the past 30 days (BRFSS calculated variables DRNKANY2-DRNKANY6). Published crude prevalence, Overall break-out. |
| `brfss_binge_5plus_any_sex_pct` | Binge drinking, 5+ drinks on one occasion (same threshold for men and women) | percent | all_alcohol | age_18_plus | survey_direct | Percent of adults having five or more drinks on one occasion in the past 30 days (BRFSS _RFBINGE, _RFBING2, _RFBING3; 1995-2005). Published crude prevalence, Overall break-out. |
| `brfss_binge_5m_4f_pct` | Binge drinking, 5+ drinks (men) / 4+ drinks (women) on one occasion | percent | all_alcohol | age_18_plus | survey_direct | Percent of adults: men having five or more, women four or more drinks on one occasion in the past 30 days (BRFSS _RFBING4-_RFBING6; 2006 onward). Published crude prevalence, Overall break-out. |
| `brfss_heavy_2m_1f_per_day_pct` | Heavy drinking, more than 2 drinks/day (men) or 1/day (women) | percent | all_alcohol | age_18_plus | survey_direct | Percent of adult men having more than two drinks per day and adult women more than one drink per day (BRFSS _RFDRHVY, _RFDRHV2-_RFDRHV4; 2001-2014). Published crude prevalence, Overall break-out. |
| `brfss_heavy_14m_7f_per_week_pct` | Heavy drinking, more than 14 drinks/week (men) or 7/week (women) | percent | all_alcohol | age_18_plus | survey_direct | Percent of adult men having more than 14 drinks per week and adult women more than 7 drinks per week (BRFSS _RFDRHV5-_RFDRHV9; 2015 onward). Published crude prevalence, Overall break-out. |
| `brfss_chronic_60plus_per_month_pct` | Chronic drinking, more than 60 drinks in the past month | percent | all_alcohol | age_18_plus | survey_direct | Percent of adults having more than 60 alcoholic beverages in the past month (BRFSS _RFDRCHR; 1995-1999). Published crude prevalence, Overall break-out. |
| `stc_alcoholic_beverages_sales_tax` | State alcoholic beverage sales taxes (Census T10) | usd_nominal | all_alcohol | not_applicable | administrative_finance | Census item T10: taxes on sale of alcoholic beverages, whether collected through government-operated liquor stores or private outlets. State government only. |
| `stc_alcoholic_beverages_license_tax` | State alcoholic beverage license taxes (Census T20) | usd_nominal | all_alcohol | not_applicable | administrative_finance | Census item T20: licenses for manufacturing, importing, wholesaling and retailing of alcoholic beverages. State government only. |
| `stc_total_taxes` | State total taxes (Census C105) | usd_nominal | not_applicable | not_applicable | administrative_finance | Census C105 total taxes of the state government, all tax types. |
| `bls_cpi_u_us_all_items_nsa` | CPI-U, U.S. city average, all items (NSA) | index_1982_84_eq_100 | not_applicable | not_applicable | price_index | Consumer Price Index for All Urban Consumers, U.S. city average, all items, not seasonally adjusted (BLS series CUUR0000SA0), monthly. |
| `ut_dabs_liquor_sales_revenue` | DABS revenue from liquor sales | usd_nominal | all_alcohol | not_applicable | administrative_finance | 'Revenue from Liquor Sales' in the DABS five-year financial summary: sales of liquor (spirits, wine, heavy beer, flavored malt beverages) by state liquor stores and package agencies. |
| `ut_dabs_gross_profit` | DABS gross profit | usd_nominal | all_alcohol | not_applicable | administrative_finance | 'Gross Profits' in the DABS five-year financial summary: liquor sales revenue less cost of liquor sold. |
| `ut_dabs_net_profit_general_fund` | DABS net profit for transfer to the General Fund | usd_nominal | all_alcohol | not_applicable | administrative_finance | 'Net Profit for Transfer to General Fund' in the DABS five-year financial summary. |
| `ut_dabs_school_lunch_transfer` | DABS transfer to School Lunch / Uniform School Fund | usd_nominal | all_alcohol | not_applicable | administrative_finance | 'Less School Lunch/Uniform School Fund' in the DABS five-year financial summary. |
| `ut_dabs_sales_tax_reported` | Sales tax reported by DABS | usd_nominal | all_alcohol | not_applicable | administrative_finance | 'Sales Tax' in the DABS five-year financial summary. The FY2025 report's letter attributes $32.4 million of sales tax revenue to local municipalities; whether the line is all sales tax on DABS sales or only the local share is unresolved. |
| `ut_dabs_other_income` | DABS other income | usd_nominal | all_alcohol | not_applicable | administrative_finance | 'Other Income' (five-year summary) / 'Other Income (e.g. Fees)' (income statement). |
| `ut_dabs_total_revenue` | DABS total revenue | usd_nominal | all_alcohol | not_applicable | administrative_finance | 'Total Revenue' (five-year summary tables) / 'Total Operating Revenue' (income statement): gross profit plus other income. |
| `ut_dabs_parents_empowered` | DABS Parents Empowered deduction | usd_nominal | all_alcohol | not_applicable | administrative_finance | 'Less Parents Empowered' in the five-year summary (underage drinking prevention media campaign). |
| `ut_dabs_underage_drinking_prevention_transfer` | DABS transfer to Underage Drinking Prevention Program | usd_nominal | all_alcohol | not_applicable | administrative_finance | 'Less Underage Drinking Prevention Program' in the five-year summary. |
| `ut_dabs_operating_nonoperating_expenses` | DABS operating expenses (five-year summary row printed as operating and non-operating) | usd_nominal | all_alcohol | not_applicable | administrative_finance | The five-year summary row printed 'Less Operating and Non-Operating Expenses' ('Less Operating Expenses' in the 81st report). In FY2024 and FY2025, the years checked, it equals the income statement's Total Operating Expenses and so excludes depreciation, amortization and interest, which that statement lists as non-operating. It is not total expenses; the identifier keeps the printed wording for compatibility. |
| `ut_dabs_sbi_transfer` | DABS transfer to SBI | usd_nominal | all_alcohol | not_applicable | administrative_finance | 'Less Transfer to SBI' in the five-year summary. The report does not expand 'SBI'. |
| `ut_dabs_other_programs_transfer` | DABS transfer to other programs | usd_nominal | all_alcohol | not_applicable | administrative_finance | 'Less Transfer to other programs' in the five-year summary (printed as an accounting dash in every year shown). |
| `ut_dabs_salaries_wages` | DABS salaries and wages | usd_nominal | all_alcohol | not_applicable | administrative_finance | 'Less Salaries and Wages' in the DABS Operations Summary table. |
| `ut_dabs_other_program_transfers` | DABS other program transfers (operations summary) | usd_nominal | all_alcohol | not_applicable | administrative_finance | 'Less Other Program Transfers' in the DABS Operations Summary table. |
| `ut_dabs_other_expenses_net` | DABS other expenses net of revenues (operations summary) | usd_nominal | all_alcohol | not_applicable | administrative_finance | 'Less other Expenses (Revenues)' in the DABS Operations Summary table. |
| `ut_dabs_cost_of_liquor_sold` | DABS cost of liquor sold | usd_nominal | all_alcohol | not_applicable | administrative_finance | 'Cost of Liquor Sold' in the income statement (printed in parentheses; stored as a positive amount). |
| `ut_dabs_total_operating_expenses` | DABS total operating expenses | usd_nominal | all_alcohol | not_applicable | administrative_finance | 'Total Operating Expenses' in the income statement. |
| `ut_dabs_net_operating_income` | DABS net operating income | usd_nominal | all_alcohol | not_applicable | administrative_finance | 'Net Operating Income' in the income statement. |
| `ut_dabs_total_nonoperating_net` | DABS total non-operating revenue / (expenses) | usd_nominal | all_alcohol | not_applicable | administrative_finance | 'Total Non Operating Revenue / (Expenses)' in the income statement; negative = net expense, as printed. |
| `ut_dabs_school_lunch_usf_public_safety_transfer` | DABS transfer to School Lunch, Uniform School Fund and Public Safety | usd_nominal | all_alcohol | not_applicable | administrative_finance | 'Transfer to School Lunch, Uniform School Fund and Public Safety' in the income statement (printed in parentheses; stored positive). |
| `ut_dabs_cases_sold` | DABS total cases sold | cases | all_alcohol | not_applicable | administrative_finance | 'Total Cases Sold (In Thousands)' in the DABS Operations Summary table; stored in cases. |
| `stc_alcoholic_beverages_sales_tax_per_capita` | State alcoholic beverage sales taxes per resident (derived) | usd_nominal_per_person | all_alcohol | all_ages | derived | Census T10 for the state fiscal year divided by the Census July 1 resident population (all ages) for the July 1 that falls inside that fiscal year. |
| `stc_alcoholic_beverages_sales_tax_per_resident_21plus` | State alcoholic beverage sales taxes per resident age 21+ (derived) | usd_nominal_per_person | all_alcohol | age_21_plus | derived | Census T10 for the state fiscal year divided by the Census July 1 resident population age 21+ for the July 1 inside that fiscal year. |
| `stc_alcoholic_beverages_sales_tax_real_cy2024usd` | State alcoholic beverage sales taxes, constant 2024 dollars (derived) | usd_constant_cy2024 | all_alcohol | not_applicable | derived | Census T10 multiplied by (CPI-U calendar-2024 average / CPI-U average over the 12 months of the state's fiscal year). Requires all 12 fiscal-year months and all 12 months of 2024. |
| `tn_dor_wine_tax_collections` | Tennessee wine tax collections (Department of Revenue account 11002, 'Wine Tax') | usd_nominal | wine | not_applicable | administrative_finance | Collections received by the Tennessee Department of Revenue in the fiscal year under account 11002, printed 'Wine Tax' in the June Summary of Collections through the FY2017 report. Collections basis, before any distribution to local governments. From the FY2018 report the same account is printed 'Wine Tax & High Alcohol Beer' and is kept as a separate measure. |
| `tn_dor_account_11002_with_high_alcohol_beer` | Tennessee account 11002 collections, printed 'Wine Tax & High Alcohol Beer' | usd_nominal | wine_and_high_alcohol_beer | not_applicable | administrative_finance | Collections received by the Tennessee Department of Revenue in the fiscal year under account 11002 as printed from the FY2018 report on: 'Wine Tax & High Alcohol Beer'. Not wine-only. Collections basis, before any distribution to local governments. |
| `tn_dor_winery_wine_tax_collections` | Tennessee winery wine tax collections (account 11013) | usd_nominal | wine | not_applicable | administrative_finance | Collections received by the Tennessee Department of Revenue in the fiscal year under account 11013, printed 'Wine Tax' through the FY2017 report and 'Wine Tax (Winery)' from FY2018. Treated as one account because the code is unchanged; the label change splits its comparability group. Collections basis. |
| `tn_dor_wine_enforcement_tax_collections` | Tennessee wine enforcement tax collections (account 11018) | usd_nominal | wine | not_applicable | administrative_finance | Collections received by the Tennessee Department of Revenue in the fiscal year under account 11018, printed 'Wine Enforcement Tax'. Collections basis. |
| `tn_dor_alcoholic_beverages_class_total` | Tennessee ALCOHOLIC BEVERAGES class total (Department of Revenue) | usd_nominal | spirits_and_wine_accounts | not_applicable | administrative_finance | Total of every account printed under the ALCOHOLIC BEVERAGES class of tax on the fiscal-year-to-date page of the June Summary of Collections (alcohol tax, wine taxes, licenses, brand registration, enforcement taxes and smaller accounts). Excludes the separate BEER and MIXED DRINK classes. Collections basis. |
| `census_liquor_stores_revenue` | State liquor-store receipts (Census A90) | usd_nominal | all_alcohol | not_applicable | administrative_finance | Census item A90: amounts received from the sale of liquor and other miscellaneous revenue of government-maintained alcoholic beverage monopoly systems, excluding any taxes the system collects for its own or other governments. Census 'liquor stores' are the alcoholic beverage distribution facilities of government monopoly systems, wholesale-only ones included; a value never codes the retail system. Beverage scope follows each state's monopoly and differs by state and year. |
| `census_liquor_stores_expenditure` | State liquor store expenditure, total (Census -90) | usd_nominal | all_alcohol | not_applicable | administrative_finance | Census liquor stores expenditure: purchase of liquor for resale and the provision and operation of government-maintained alcoholic beverage monopoly systems (current operations plus capital outlay), excluding law enforcement and licensing. Census 'liquor stores' are the alcoholic beverage distribution facilities of government monopoly systems, wholesale-only ones included; a value never codes the retail system. Beverage scope follows each state's monopoly and differs by state and year. |
| `census_liquor_stores_current_operations` | State liquor store expenditure, current operations (Census E90) | usd_nominal | all_alcohol | not_applicable | administrative_finance | Census item E90: current operation expenditure of government liquor stores, including the purchase of liquor for resale. Census formula E90 = total liquor stores expenditure minus capital outlay. Census 'liquor stores' are the alcoholic beverage distribution facilities of government monopoly systems, wholesale-only ones included; a value never codes the retail system. Beverage scope follows each state's monopoly and differs by state and year. |
| `census_liquor_stores_capital_outlay` | State liquor store expenditure, capital outlay (Census F90 + G90) | usd_nominal | all_alcohol | not_applicable | administrative_finance | Census liquor stores capital outlay: construction (F90) plus other capital outlay (G90) of government liquor stores. Census 'liquor stores' are the alcoholic beverage distribution facilities of government monopoly systems, wholesale-only ones included; a value never codes the retail system. Beverage scope follows each state's monopoly and differs by state and year. |
| `bea_personal_income` | Personal income (BEA SAINC1) | usd_nominal | not_applicable | all_ages | economic_accounts | BEA SAINC1 line 1: income received by or on behalf of persons residing in the area (wages and salaries, supplements, proprietors' income, rental income, dividends, interest and personal current transfer receipts, less contributions for government social insurance, plus the adjustment for residence). Current dollars, calendar year. |
| `bea_per_capita_personal_income` | Per capita personal income (BEA SAINC1) | usd_nominal_per_person | not_applicable | all_ages | economic_accounts | BEA SAINC1 line 3: personal income divided by total midyear population (Census Bureau estimates as BEA used them). Current dollars, calendar year. |
| `cbp_establishments_naics_445310` | Beer, wine and liquor stores: establishments (CBP, NAICS 445310) | establishments | all_alcohol | not_applicable | business_register | Number of private establishments with paid employees classified in NAICS 445310 (beer, wine and liquor stores) during the year. Excludes government-operated stores (for example state liquor stores in control states) and stores whose main activity is groceries. |
| `cbp_employment_naics_445310` | Beer, wine and liquor stores: employment (CBP, NAICS 445310) | employees | all_alcohol | not_applicable | business_register | Paid employees of private NAICS 445310 establishments in the pay period including March 12. Excludes government-operated stores. |
| `cbp_establishments_naics_722410` | Drinking places (alcoholic beverages): establishments (CBP, NAICS 722410) | establishments | all_alcohol | not_applicable | business_register | Number of private establishments with paid employees classified in NAICS 722410 (bars, taverns, nightclubs and other drinking places primarily serving alcoholic beverages) during the year. Restaurants that serve alcohol are classified elsewhere. |
| `cbp_employment_naics_722410` | Drinking places (alcoholic beverages): employment (CBP, NAICS 722410) | employees | all_alcohol | not_applicable | business_register | Paid employees of private NAICS 722410 establishments in the pay period including March 12. |
| `cbp_establishments_naics_445110` | Supermarkets and other grocery stores: establishments (CBP, NAICS 445110) | establishments | not_applicable | not_applicable | business_register | Number of private establishments with paid employees classified in NAICS 445110 (supermarkets and other grocery retailers, except convenience stores) during the year. |
| `yrbs_current_alcohol_use_hs_pct` | Current alcohol use, high school students (YRBS) | percent | all_alcohol | high_school_students | survey_direct | Percent of high school students who had at least one drink of alcohol on at least 1 day during the 30 days before the survey (YRBSS question H42). Weighted state or national estimate with 95% confidence limits. |
| `yrbs_first_drink_before_13_hs_pct` | First drink before age 13, high school students (YRBS) | percent | all_alcohol | high_school_students | survey_direct | Percent of high school students who had their first drink of alcohol, other than a few sips, before age 13 years (YRBSS question H41). |
| `yrbs_binge_drinking_hs_pct` | Current binge drinking, high school students (YRBS, 2017 definition) | percent | all_alcohol | high_school_students | survey_direct | Percent of high school students who had four or more drinks of alcohol in a row (female) or five or more (male) within a couple of hours on at least 1 day during the 30 days before the survey (YRBSS question H44, 2017). |
| `fars_traffic_fatalities` | Traffic fatalities (FARS) | deaths | not_applicable | all_ages | administrative_census | Deaths within 30 days in crashes on public roads involving a motor vehicle in transport, summed over FARS crashes by the state where the crash happened (accident file, FATALS). |
| `fars_alcohol_impaired_driving_fatalities` | Alcohol-impaired-driving fatalities (FARS, NHTSA definition) | deaths | all_alcohol | all_ages | multiple_imputation | Deaths in fatal crashes in which at least one driver had a BAC of .08 g/dL or more, using NHTSA's ten multiple imputations of the highest driver BAC (MIDRVACC.CSV) for unreported BACs; the mean over the ten imputations, by the state where the crash happened. |
| `nhtsa_published_traffic_fatalities` | Traffic fatalities as published by NHTSA (state estimates report) | deaths | not_applicable | all_ages | administrative_census | Total fatalities by state as printed in NHTSA's State Alcohol-Impaired-Driving Estimates report, from the FARS file version that report names. |
| `nhtsa_published_alcohol_impaired_driving_fatalities` | Alcohol-impaired-driving fatalities as published by NHTSA (state estimates report) | deaths | all_alcohol | all_ages | multiple_imputation | Fatalities in crashes with a driver at BAC .08 g/dL or more, by state, as printed in NHTSA's State Alcohol-Impaired-Driving Estimates report. |
| `cdi_chronic_liver_disease_mortality_age_adjusted_rate` | Chronic liver disease deaths per 100,000, age-adjusted (CDC CDI) | deaths_per_100k | not_applicable | all_ages | vital_statistics | Deaths with chronic liver disease and cirrhosis as the underlying cause per 100,000 residents, age-adjusted by CDC (indicator ALC09, Overall). Age adjustment lets states with older or younger populations be compared. |
| `cdi_chronic_liver_disease_mortality_crude_rate` | Chronic liver disease deaths per 100,000, crude (CDC CDI) | deaths_per_100k | not_applicable | all_ages | vital_statistics | Deaths with chronic liver disease and cirrhosis as the underlying cause per 100,000 residents, not age-adjusted (indicator ALC09, Overall). |
| `cdi_chronic_liver_disease_deaths` | Chronic liver disease deaths (CDC CDI) | deaths | not_applicable | all_ages | vital_statistics | Number of deaths with chronic liver disease and cirrhosis as the underlying cause (indicator ALC09, Overall). |
| `brfss_binge_age_adjusted_pct` | Binge drinking, adults, age-adjusted (CDC CDI) | percent | all_alcohol | age_18_plus | survey_direct | Percent of adults 18+ who binge drank in the past 30 days (5+ drinks for men, 4+ for women on one occasion), age-adjusted by CDC (indicator ALC06). Age adjustment matters for states with young populations such as Utah. |
| `brfss_binge_frequency_median` | Binge episodes in the past 30 days, median among adults who binge drink (CDC CDI) | occasions | all_alcohol | age_18_plus | survey_direct | Median number of binge drinking occasions in the past 30 days among adults who binge drank (indicator ALC04, crude median). |
| `brfss_binge_intensity_median` | Largest number of drinks on one occasion, median among adults who binge drink (CDC CDI) | drinks | all_alcohol | age_18_plus | survey_direct | Median of the largest number of drinks on any occasion in the past 30 days among adults who binge drank (indicator ALC05, crude median). |
| `bea_pce_off_premises_alcohol` | Spending on alcohol bought to take away (BEA PCE by state) | usd_nominal | all_alcohol | not_applicable | economic_accounts | Personal consumption expenditures on alcoholic beverages purchased for off-premises consumption by residents of the state, current dollars (BEA SAPCE3 line 28). Covers purchases from any store type: grocery, convenience, liquor and state stores. |
| `msrs_total_retail_yoy_pct` | Retail sales, change from a year earlier (Census MSRS, total excluding nonstore) | percent_change | not_applicable | not_applicable | survey_direct | Percent change in total retail sales excluding nonstore retailers from the same month a year earlier, by state (Census Monthly State Retail Sales, code TOTAL). Experimental; not seasonally adjusted. |
| `msrs_food_beverage_stores_yoy_pct` | Food and beverage store sales, change from a year earlier (Census MSRS, NAICS 445) | percent_change | not_applicable | not_applicable | survey_direct | Percent change in sales of food and beverage stores (NAICS 445: supermarkets, convenience-type food stores and beer, wine and liquor stores together) from the same month a year earlier, by state. Experimental; not seasonally adjusted. |
| `ec_sales_naics_445310` | Beer, wine and liquor store sales (Economic Census, NAICS 445310) | usd_nominal | all_alcohol | not_applicable | business_register | Sales (receipts) of private establishments with payroll classified as beer, wine and liquor stores (NAICS 445310), current dollars, Economic Census 2012 and 2017. |
| `ec_establishments_naics_445310` | Beer, wine and liquor stores: establishments (Economic Census, NAICS 445310) | establishments | not_applicable | not_applicable | business_register | Number of private establishments with payroll classified as beer, wine and liquor stores (NAICS 445310), Economic Census 2012 and 2017. |
| `state_sales_tax_rate_state_portion` | State sales and use tax rate, state portion (Utah Tax Commission Publication 25) | percent | not_applicable | not_applicable | administrative_finance | The state's own part of the combined sales and use tax rate, as printed in the Utah State Tax Commission's Publication 25 (Chart 2, 'Taxes in the Combined Rate'). Local option, county option and resort taxes are separate and go to local governments. |
| `ut_dabs_monthly_gross_sales_spirits` | DABS monthly gross sales: spirits | usd_nominal | spirits | not_applicable | administrative_finance | Gross sales by the Utah Department of Alcoholic Beverage Services in the month, Spirits (whiskey, vodka, tequila, rum, gin, brandy, liqueurs, schnapps), summed from the monthly Sales Analysis Report (products grouped by metadata/dabs_class_beverage_map.csv). |
| `ut_dabs_monthly_cases_9l_spirits` | DABS monthly sales in 9-liter cases: spirits | nine_liter_cases | spirits | not_applicable | administrative_finance | Volume sold by DABS in the month in 9-liter case equivalents (one case = 9 liters = 2.378 U.S. gallons of beverage), Spirits (whiskey, vodka, tequila, rum, gin, brandy, liqueurs, schnapps). |
| `ut_dabs_fy_gross_sales_spirits` | DABS gross sales, fiscal year: spirits | usd_nominal | spirits | not_applicable | derived | Sum of the twelve monthly Sales Analysis Reports of a Utah fiscal year (July-June), Spirits (whiskey, vodka, tequila, rum, gin, brandy, liqueurs, schnapps). Computed only when all twelve reports are held. |
| `ut_dabs_fy_cases_9l_spirits` | DABS sales in 9-liter cases, fiscal year: spirits | nine_liter_cases | spirits | not_applicable | derived | Sum of the twelve monthly reports of a Utah fiscal year, 9-liter case equivalents, Spirits (whiskey, vodka, tequila, rum, gin, brandy, liqueurs, schnapps). |
| `ut_dabs_monthly_gross_sales_wine` | DABS monthly gross sales: wine | usd_nominal | wine | not_applicable | administrative_finance | Gross sales by the Utah Department of Alcoholic Beverage Services in the month, Wine (table, sparkling, fortified and aromatized wine, fruit wine, sake), summed from the monthly Sales Analysis Report (products grouped by metadata/dabs_class_beverage_map.csv). |
| `ut_dabs_monthly_cases_9l_wine` | DABS monthly sales in 9-liter cases: wine | nine_liter_cases | wine | not_applicable | administrative_finance | Volume sold by DABS in the month in 9-liter case equivalents (one case = 9 liters = 2.378 U.S. gallons of beverage), Wine (table, sparkling, fortified and aromatized wine, fruit wine, sake). |
| `ut_dabs_fy_gross_sales_wine` | DABS gross sales, fiscal year: wine | usd_nominal | wine | not_applicable | derived | Sum of the twelve monthly Sales Analysis Reports of a Utah fiscal year (July-June), Wine (table, sparkling, fortified and aromatized wine, fruit wine, sake). Computed only when all twelve reports are held. |
| `ut_dabs_fy_cases_9l_wine` | DABS sales in 9-liter cases, fiscal year: wine | nine_liter_cases | wine | not_applicable | derived | Sum of the twelve monthly reports of a Utah fiscal year, 9-liter case equivalents, Wine (table, sparkling, fortified and aromatized wine, fruit wine, sake). |
| `ut_dabs_monthly_gross_sales_beer` | DABS monthly gross sales: beer | usd_nominal | beer | not_applicable | administrative_finance | Gross sales by the Utah Department of Alcoholic Beverage Services in the month, Beer sold by DABS (heavy beer and flavored malt beverages), summed from the monthly Sales Analysis Report (products grouped by metadata/dabs_class_beverage_map.csv). |
| `ut_dabs_monthly_cases_9l_beer` | DABS monthly sales in 9-liter cases: beer | nine_liter_cases | beer | not_applicable | administrative_finance | Volume sold by DABS in the month in 9-liter case equivalents (one case = 9 liters = 2.378 U.S. gallons of beverage), Beer sold by DABS (heavy beer and flavored malt beverages). |
| `ut_dabs_fy_gross_sales_beer` | DABS gross sales, fiscal year: beer | usd_nominal | beer | not_applicable | derived | Sum of the twelve monthly Sales Analysis Reports of a Utah fiscal year (July-June), Beer sold by DABS (heavy beer and flavored malt beverages). Computed only when all twelve reports are held. |
| `ut_dabs_fy_cases_9l_beer` | DABS sales in 9-liter cases, fiscal year: beer | nine_liter_cases | beer | not_applicable | derived | Sum of the twelve monthly reports of a Utah fiscal year, 9-liter case equivalents, Beer sold by DABS (heavy beer and flavored malt beverages). |
| `ut_dabs_monthly_gross_sales_cider` | DABS monthly gross sales: cider | usd_nominal | cider | not_applicable | administrative_finance | Gross sales by the Utah Department of Alcoholic Beverage Services in the month, Cider (DABS files it with beer), summed from the monthly Sales Analysis Report (products grouped by metadata/dabs_class_beverage_map.csv). |
| `ut_dabs_monthly_cases_9l_cider` | DABS monthly sales in 9-liter cases: cider | nine_liter_cases | cider | not_applicable | administrative_finance | Volume sold by DABS in the month in 9-liter case equivalents (one case = 9 liters = 2.378 U.S. gallons of beverage), Cider (DABS files it with beer). |
| `ut_dabs_fy_gross_sales_cider` | DABS gross sales, fiscal year: cider | usd_nominal | cider | not_applicable | derived | Sum of the twelve monthly Sales Analysis Reports of a Utah fiscal year (July-June), Cider (DABS files it with beer). Computed only when all twelve reports are held. |
| `ut_dabs_fy_cases_9l_cider` | DABS sales in 9-liter cases, fiscal year: cider | nine_liter_cases | cider | not_applicable | derived | Sum of the twelve monthly reports of a Utah fiscal year, 9-liter case equivalents, Cider (DABS files it with beer). |
| `ut_dabs_monthly_gross_sales_premixed` | DABS monthly gross sales: premixed | usd_nominal | premixed_unspecified_base | not_applicable | administrative_finance | Gross sales by the Utah Department of Alcoholic Beverage Services in the month, Premixed drinks and coolers (spirit or wine base not stated), summed from the monthly Sales Analysis Report (products grouped by metadata/dabs_class_beverage_map.csv). |
| `ut_dabs_monthly_cases_9l_premixed` | DABS monthly sales in 9-liter cases: premixed | nine_liter_cases | premixed_unspecified_base | not_applicable | administrative_finance | Volume sold by DABS in the month in 9-liter case equivalents (one case = 9 liters = 2.378 U.S. gallons of beverage), Premixed drinks and coolers (spirit or wine base not stated). |
| `ut_dabs_fy_gross_sales_premixed` | DABS gross sales, fiscal year: premixed | usd_nominal | premixed_unspecified_base | not_applicable | derived | Sum of the twelve monthly Sales Analysis Reports of a Utah fiscal year (July-June), Premixed drinks and coolers (spirit or wine base not stated). Computed only when all twelve reports are held. |
| `ut_dabs_fy_cases_9l_premixed` | DABS sales in 9-liter cases, fiscal year: premixed | nine_liter_cases | premixed_unspecified_base | not_applicable | derived | Sum of the twelve monthly reports of a Utah fiscal year, 9-liter case equivalents, Premixed drinks and coolers (spirit or wine base not stated). |
| `ut_dabs_monthly_gross_sales_other` | DABS monthly gross sales: other | usd_nominal | unclassified | not_applicable | administrative_finance | Gross sales by the Utah Department of Alcoholic Beverage Services in the month, Special orders with no beverage stated, and supplies, summed from the monthly Sales Analysis Report (products grouped by metadata/dabs_class_beverage_map.csv). |
| `ut_dabs_monthly_cases_9l_other` | DABS monthly sales in 9-liter cases: other | nine_liter_cases | unclassified | not_applicable | administrative_finance | Volume sold by DABS in the month in 9-liter case equivalents (one case = 9 liters = 2.378 U.S. gallons of beverage), Special orders with no beverage stated, and supplies. |
| `ut_dabs_fy_gross_sales_other` | DABS gross sales, fiscal year: other | usd_nominal | unclassified | not_applicable | derived | Sum of the twelve monthly Sales Analysis Reports of a Utah fiscal year (July-June), Special orders with no beverage stated, and supplies. Computed only when all twelve reports are held. |
| `ut_dabs_fy_cases_9l_other` | DABS sales in 9-liter cases, fiscal year: other | nine_liter_cases | unclassified | not_applicable | derived | Sum of the twelve monthly reports of a Utah fiscal year, 9-liter case equivalents, Special orders with no beverage stated, and supplies. |
| `ut_dabs_monthly_gross_sales_total` | DABS monthly gross sales: total | usd_nominal | all_dabs_products | not_applicable | administrative_finance | Gross sales by the Utah Department of Alcoholic Beverage Services in the month, All products (the report's printed total), summed from the monthly Sales Analysis Report (products grouped by metadata/dabs_class_beverage_map.csv). |
| `ut_dabs_monthly_cases_9l_total` | DABS monthly sales in 9-liter cases: total | nine_liter_cases | all_dabs_products | not_applicable | administrative_finance | Volume sold by DABS in the month in 9-liter case equivalents (one case = 9 liters = 2.378 U.S. gallons of beverage), All products (the report's printed total). |
| `ut_dabs_fy_gross_sales_total` | DABS gross sales, fiscal year: total | usd_nominal | all_dabs_products | not_applicable | derived | Sum of the twelve monthly Sales Analysis Reports of a Utah fiscal year (July-June), All products (the report's printed total). Computed only when all twelve reports are held. |
| `ut_dabs_fy_cases_9l_total` | DABS sales in 9-liter cases, fiscal year: total | nine_liter_cases | all_dabs_products | not_applicable | derived | Sum of the twelve monthly reports of a Utah fiscal year, 9-liter case equivalents, All products (the report's printed total). |
| `fars_alcohol_impaired_driving_deaths_per_100k` | Alcohol-impaired-driving deaths per 100,000 residents (FARS) | deaths_per_100k | all_alcohol | all_ages | derived | fars_alcohol_impaired_driving_fatalities for the calendar year divided by the Census July 1 resident population of the same year, times 100,000 (derived by the project). |
| `fars_traffic_deaths_per_100k` | Traffic deaths per 100,000 residents (FARS) | deaths_per_100k | not_applicable | all_ages | derived | fars_traffic_fatalities for the calendar year divided by the Census July 1 resident population of the same year, times 100,000 (derived by the project). |
| `ut_abs_fund_sales_revenue` | Utah Alcoholic Beverage Services Fund sales revenue (audited) | usd_nominal | all_alcohol | not_applicable | administrative_finance | 'Sales and Charges for Services/Premiums' of the Alcoholic Beverage Services Fund in the State of Utah ACFR's statement of revenues, expenses and changes in fund net position (proprietary funds). |
| `ut_abs_fund_operating_revenues` | Utah Alcoholic Beverage Services Fund operating revenues (audited) | usd_nominal | all_alcohol | not_applicable | administrative_finance | 'Total Operating Revenues' of the Alcoholic Beverage Services Fund (sales plus fees, interest on notes and miscellaneous), which the ACFR's statistical section reports as 'Liquor Retail Sales' charges for services in the changes in net position. |
| `ut_abs_fund_operating_expenses` | Utah Alcoholic Beverage Services Fund operating expenses (audited) | usd_nominal | all_alcohol | not_applicable | administrative_finance | 'Total Operating Expenses' of the Alcoholic Beverage Services Fund in the proprietary funds statement, including purchases for resale (the cost of liquor sold). |
| `ut_abs_fund_operating_income` | Utah Alcoholic Beverage Services Fund operating income (audited) | usd_nominal | all_alcohol | not_applicable | administrative_finance | 'Operating Income (Loss)' of the Alcoholic Beverage Services Fund in the proprietary funds statement. |
| `ut_abs_govwide_liquor_expenses` | Utah liquor retail sales expenses, government-wide (audited) | usd_nominal | all_alcohol | not_applicable | administrative_finance | 'Liquor Retail Sales' expenses of the business-type activities in the ACFR's statement of activities, as repeated in the statistical section's changes in net position. |
| `ut_abs_school_lunch_collections_paid` | Utah Alcoholic Beverage Services Fund payments of sales tax and school lunch collections (audited) | usd_nominal | all_alcohol | not_applicable | administrative_finance | 'Payments of Sales Tax and School Lunch Collections' in the operating activities of the Alcoholic Beverage Services Fund's statement of cash flows (printed in parentheses; stored positive). |
| `ut_liquor_sales_allocated_school_lunch` | Utah liquor sales allocated for school lunch (audited) | usd_nominal | all_alcohol | not_applicable | administrative_finance | 'Liquor Sales Allocated for School Lunch', a revenue of the Income Tax Fund in the ACFR's statement of revenues, expenditures and changes in fund balances (governmental funds). |
| `ut_abs_liquor_profit_transfer` | Utah liquor profit transfer to the General Fund (ACFR text) | usd_nominal | all_alcohol | not_applicable | administrative_finance | The liquor profit transferred to the General Fund as stated in the ACFR's management's discussion of the Alcoholic Beverage Services Fund. |
| `pa_plcb_ssf_sales_net_of_taxes` | Pennsylvania State Stores Fund sales net of taxes (audited) | usd_nominal | wine_and_spirits | not_applicable | administrative_finance | 'Sales net of taxes' of the Pennsylvania Liquor Control Board's State Stores Fund in the Auditor General's audited statement of revenues, expenses and changes in net position. |
| `pa_plcb_ssf_cost_of_goods_sold` | Pennsylvania State Stores Fund cost of goods sold (audited) | usd_nominal | wine_and_spirits | not_applicable | administrative_finance | 'Cost of goods sold' of the State Stores Fund (printed in parentheses; stored positive). |
| `pa_plcb_ssf_gross_profit` | Pennsylvania State Stores Fund gross profit from sales (audited) | usd_nominal | wine_and_spirits | not_applicable | administrative_finance | 'Gross profit from sales' of the State Stores Fund: sales net of taxes less cost of goods sold. |
| `pa_plcb_ssf_operating_expenses` | Pennsylvania State Stores Fund operating expenses (audited) | usd_nominal | wine_and_spirits | not_applicable | administrative_finance | Total 'Operating (expenses)' of the State Stores Fund: wholesale, retail, e-commerce, regulatory, enterprise and Commonwealth-provided services (printed in parentheses; stored positive). |
| `pa_plcb_ssf_total_operating_income` | Pennsylvania State Stores Fund total operating income (audited) | usd_nominal | wine_and_spirits | not_applicable | administrative_finance | 'Total operating income' of the State Stores Fund: operating profit plus enforcement fines, license fees and miscellaneous income. |
| `pa_plcb_ssf_transfer_general_fund` | Pennsylvania State Stores Fund transfer to the General Fund (audited) | usd_nominal | wine_and_spirits | not_applicable | administrative_finance | 'Transfers out: General Fund' of the State Stores Fund (printed in parentheses; stored positive). |
| `pa_plcb_ssf_transfer_psp_enforcement` | Pennsylvania State Stores Fund transfer for Pennsylvania State Police enforcement (audited) | usd_nominal | wine_and_spirits | not_applicable | administrative_finance | 'Operating transfers out: PSP enforcement' of the State Stores Fund (printed in parentheses; stored positive). |
| `pa_plcb_ssf_transfer_drug_alcohol_programs` | Pennsylvania State Stores Fund transfer to drug and alcohol programs (audited) | usd_nominal | wine_and_spirits | not_applicable | administrative_finance | 'Transfers out: Drug and alcohol programs' of the State Stores Fund (printed in parentheses; stored positive). |
| `ut_abs_fund_receipts_from_customers` | Utah Alcoholic Beverage Services Fund cash receipts from customers (audited) | usd_nominal | all_alcohol | not_applicable | administrative_finance | 'Receipts from Customers/Loan Interest/Fees/Premiums' in the operating activities of the Alcoholic Beverage Services Fund's statement of cash flows (proprietary funds). |
| `ut_abs_fund_income_before_transfers` | Utah Alcoholic Beverage Services Fund income before transfers (audited) | usd_nominal | all_alcohol | not_applicable | administrative_finance | 'Income (Loss) before Capital Contributions and Transfers' of the Alcoholic Beverage Services Fund in the proprietary funds statement. |
| `ut_dabs_credit_card_fees` | DABS credit card fees | usd_nominal | all_alcohol | not_applicable | administrative_finance | 'Credit Card Fees' in the income statement's operating expenses. |
| `ut_dabs_delivery_to_stores` | DABS delivery to stores | usd_nominal | all_alcohol | not_applicable | administrative_finance | 'Delivery to Stores' in the income statement's operating expenses. |
| `ut_dabs_package_agency_contracts` | DABS package agency contracts | usd_nominal | all_alcohol | not_applicable | administrative_finance | 'Package Agency Contracts' ('P.A. Contracts') in the income statement's operating expenses. |
| `ut_dabs_liquor_bags` | DABS liquor bags | usd_nominal | all_alcohol | not_applicable | administrative_finance | 'Liquor Bags' in the income statement's operating expenses. |
| `ut_dabs_off_premise_sales_share` | DABS off-premise sales, share of its sales | percent | all_alcohol | not_applicable | administrative_finance | 'Off-Premise Sales' in the DABS annual report's 'On-Premise vs. Off-Premise Sales' chart: sales of alcoholic beverages purchased at state liquor stores and package agencies to be consumed elsewhere, as a percent of DABS's sales. All products. |
| `ut_dabs_on_premise_sales_share` | DABS on-premise sales, share of its sales | percent | all_alcohol | not_applicable | administrative_finance | 'On-Premise Sales' in the DABS annual report's 'On-Premise vs. Off-Premise Sales' chart: sales of alcoholic beverages to be consumed on premises, such as in restaurants and bars (licensees' purchases), as a percent of DABS's sales. All products. |
| `us_retail_gross_margin_pct_total` | Retail gross margin, percent of sales (Census ARTS, all retail) | percent | not_applicable | not_applicable | survey_direct | Gross margin (sales less cost of goods sold: beginning inventory plus purchases for resale less ending inventory) as a percent of sales, all products the businesses sell, United States, calendar data year. All retail trade (NAICS 44-45). Annual Retail Trade Survey (gmper.xlsx). |
| `us_retail_gross_margin_pct_food_beverage_stores` | Food and beverage stores' gross margin, percent of sales (Census ARTS, NAICS 445) | percent | not_applicable | not_applicable | survey_direct | Gross margin (sales less cost of goods sold: beginning inventory plus purchases for resale less ending inventory) as a percent of sales, all products the businesses sell, United States, calendar data year. Food and beverage stores (NAICS 445: grocery, specialty food, and beer, wine and liquor stores). Annual Retail Trade Survey (gmper.xlsx). |
| `us_retail_gross_margin_pct_grocery_stores` | Grocery stores' gross margin, percent of sales (Census ARTS, NAICS 4451) | percent | not_applicable | not_applicable | survey_direct | Gross margin (sales less cost of goods sold: beginning inventory plus purchases for resale less ending inventory) as a percent of sales, all products the businesses sell, United States, calendar data year. Grocery stores (NAICS 4451: supermarkets and other grocery stores, convenience stores). Annual Retail Trade Survey (gmper.xlsx). |
| `us_retail_gross_margin_pct_alcohol_stores` | Beer, wine and liquor stores' gross margin, percent of sales (Census ARTS, NAICS 4453) | percent | not_applicable | not_applicable | survey_direct | Gross margin (sales less cost of goods sold: beginning inventory plus purchases for resale less ending inventory) as a percent of sales, all products the businesses sell, United States, calendar data year. Beer, wine and liquor stores (NAICS 4453), all products they sell. Annual Retail Trade Survey (gmper.xlsx). |
| `us_retail_gross_margin_pct_warehouse_clubs_supercenters` | Warehouse clubs' and supercenters' gross margin, percent of sales (Census ARTS, NAICS 452311) | percent | not_applicable | not_applicable | survey_direct | Gross margin (sales less cost of goods sold: beginning inventory plus purchases for resale less ending inventory) as a percent of sales, all products the businesses sell, United States, calendar data year. Warehouse clubs and supercenters (NAICS 452311). Annual Retail Trade Survey (gmper.xlsx). |
| `us_wholesale_gross_margin_pct_total` | Merchant wholesalers' gross margin, percent of sales (Census AWTS, NAICS 42) | percent | not_applicable | not_applicable | survey_direct | Gross margin (sales less cost of goods sold: beginning inventory plus purchases for resale less ending inventory) as a percent of sales, all products the businesses sell, United States, calendar data year. All merchant wholesalers except manufacturers' sales branches and offices (NAICS 42). Annual Wholesale Trade Survey, table 4 (merchant wholesalers except manufacturers' sales branches and offices). |
| `us_wholesale_gross_margin_pct_grocery` | Grocery wholesalers' gross margin, percent of sales (Census AWTS, NAICS 4244) | percent | not_applicable | not_applicable | survey_direct | Gross margin (sales less cost of goods sold: beginning inventory plus purchases for resale less ending inventory) as a percent of sales, all products the businesses sell, United States, calendar data year. Grocery and related product merchant wholesalers (NAICS 4244). Annual Wholesale Trade Survey, table 4 (merchant wholesalers except manufacturers' sales branches and offices). |
| `us_wholesale_gross_margin_pct_alcohol_beverages` | Beer, wine and spirits wholesalers' gross margin, percent of sales (Census AWTS, NAICS 4248) | percent | not_applicable | not_applicable | survey_direct | Gross margin (sales less cost of goods sold: beginning inventory plus purchases for resale less ending inventory) as a percent of sales, all products the businesses sell, United States, calendar data year. Beer, wine and distilled alcoholic beverage merchant wholesalers (NAICS 4248), all products. Annual Wholesale Trade Survey, table 4 (merchant wholesalers except manufacturers' sales branches and offices). |
