// Shapes of the files written by `alcohol-data dashboard export` (schema dashboard-export@1.6).
// The Python export is the contract; these types only describe it.

export interface Manifest {
  schema_version: string;
  dataset: {
    release_version: string;
    build_id: string;
    release_label: string;
    database_schema_version: string;
    built_at: string;
    built_from_commit: string;
    law_as_of_date: string;
    law_as_of_timezone: string;
    source_retrieval_first: string;
    source_retrieval_last: string;
  };
  export: { generated_at: string; exported_from_commit: string | null; transform_version: string };
  counts: Record<string, number>;
  files: Record<string, { bytes: number; sha256: string }>;
}

export interface Geography {
  geo_id: string;
  geo_level: string;
  official_code: string;
  name: string;
  abbreviation: string | null;
  in_default_panel: boolean;
  region: string | null;
}

export type ConversionKind = "real_cy2024" | "per_resident" | "per_resident_21plus";

export interface MetricMeta {
  metric_id: string;
  measure_id: string;
  period_kind: string;
  family: string;
  label: string;
  definition: string;
  unit: string;
  value_kind: string;
  beverage: string;
  age_universe: string;
  recall_period: string;
  numerator: string | null;
  denominator: string | null;
  method_family: string;
  source_family: string;
  causal_outcome_eligible: boolean;
  fiscal_component: string | null;
  government_level: string | null;
  accounting_basis: string | null;
  costs_subtracted: boolean | null;
  overlap_note: string | null;
  notes: string | null;
  first_year: number;
  last_year: number;
  years_with_rows: number[];
  geo_levels: string[];
  geo_count: number;
  rows: number;
  values: number;
  zeros: number;
  comparability_groups: string[];
  source_series: string[];
  asset_ids: string[];
  file: string;
  conversions: ConversionKind[];
  conversions_unavailable_reason: string | null;
  /** Metric files (or "deflators") holding the inputs of derived and converted values. */
  input_metrics: string[];
}

export interface FiscalYearRule {
  geo_id: string;
  fy_end_month: number;
  fy_end_day: number;
  valid_from_fy: number;
  valid_to_fy: number;
  evidence: string;
  verified: boolean;
}

export interface MetricsIndex {
  families: Record<string, { label: string; description: string }>;
  metrics: MetricMeta[];
  conversion_methods: Record<ConversionKind, string>;
  denominators: Record<string, { measure_id: string; label: string }>;
  fiscal_year_rules: FiscalYearRule[];
}

/** One preferred observation, decoded from the metric file's row arrays. */
export interface Obs {
  observation_id: string;
  geo_id: string;
  period_label: string;
  period_start: string;
  period_end: string;
  year: number;
  value: number | null;
  missing_reason: string | null;
  estimate_type: string;
  extraction_method: string;
  review_status: string | null;
  comparability_group: string;
  quality_flags: string | null;
  asset_id: string;
  source_locator: string;
  source_series: string;
  source_vintage: string;
  candidate_count: number;
  selection_reason: string;
  ci_low: number | null;
  ci_high: number | null;
  ci_level: number | null;
  /** FARS imputed deaths only (1.4): the interval for the deaths that actually occurred, from the imputations
   * alone. ci_low/ci_high are for the underlying expected number. */
  realized_ci_low: number | null;
  realized_ci_high: number | null;
  sample_size: number | null;
  suppression_flag: string | null;
  raw_value: string | null;
  raw_unit: string | null;
  multiplier: number | null;
  footnote: string | null;
  transform_id: string | null;
  input_ids: string[];
  cell: string;
  open_page: number | null;
}

export interface Alternate {
  observation_id: string;
  value: number | null;
  missing_reason: string | null;
  source_series: string;
  source_vintage: string;
  asset_id: string;
  source_locator: string;
  selection_reason: string;
}

export interface Conversion {
  kind: ConversionKind;
  value: number | null;
  missing: string | null;
  inputs: string[];
}

export interface MetricFile {
  metric_id: string;
  columns: string[];
  rows: unknown[][];
  alternate_columns: string[];
  alternates: Record<string, unknown[][]>;
  conversion_columns: string[];
  conversions: Record<string, unknown[][]>;
}

export interface CoverageMetric {
  first_year: number;
  last_year: number;
  rows: Record<string, string>;
  label?: string;
  /** Policy only: [year, known_days, days, future_days, local_option_days] per jurisdiction. */
  days?: Record<string, [number, number, number, number, number][]>;
}

export interface CoverageFamily {
  first_year: number;
  last_year: number;
  metrics: string[];
  rows: Record<string, { have: number[]; defined: number[]; unreviewed: number[]; conflict: number[] }>;
}

export interface Coverage {
  states: Record<string, { label: string; description: string }>;
  value_codes: string[];
  metrics: Record<string, CoverageMetric>;
  families: Record<string, CoverageFamily>;
  denominator_rule: string;
}

export interface Evidence {
  evidence_id: string;
  policy_id: string;
  asset_id: string;
  citation: string;
  locator: string;
  excerpt_or_paraphrase: string;
  supports: string;
  evidence_strength: string;
  extracted_by: string;
  extracted_on: string;
  reviewed_by: string | null;
  reviewed_on: string | null;
  asset_url: string | null;
  asset_format: string;
  asset_sha256: string | null;
  asset_edition: string;
  source_id: string;
  asset_rights_status: string;
  open_url: string | null;
  page: number | null;
}

export interface PolicyEvent {
  policy_id: string;
  geo_id: string;
  policy_dimension: string;
  beverage: string;
  policy_value: string;
  value_detail: string | null;
  authority_layer: string;
  requires_local_adoption: boolean;
  enactment_date: string | null;
  effective_start: string | null;
  effective_start_precision: string;
  effective_end: string | null;
  end_status: string;
  known_in_effect_from: string | null;
  known_in_effect_through: string | null;
  extraction_status: string;
  temporal_status: string;
  legal_review_status: string;
  claim_status: string;
  reviewer: string | null;
  review_date: string | null;
  notes: string | null;
  dimension_label: string;
  category: string;
  outlet: string;
  operational_start: string | null;
  operational_precision: string;
  operational_note: string;
  evidence: Evidence[];
  ledger_claims: string[];
  dependencies: Record<string, string | boolean | null>[];
  exceptions: Record<string, string | null>[];
}

export interface Segment {
  geo_id: string;
  policy_dimension: string;
  segment_start: string;
  segment_end: string;
  days: number;
  state: string;
  policy_ids: string;
  derivation_version: string;
}

export interface LedgerRun {
  claim_id: string;
  verified_from: string;
  verified_through: string;
  days: string;
  claim_status: string;
  role: string;
  temporal_status: string;
  legal_review_status: string;
  as_of_date: string;
  requirements: string;
  versions: string;
}

export interface Snapshot {
  snapshot_id: string;
  geo_id: string;
  policy_dimension: string;
  policy_value: string;
  value_detail: string | null;
  observed_on: string | null;
  observed_year: number;
  observed_precision: string;
  observed_basis: string;
  asset_id: string;
  citation: string;
  locator: string;
  excerpt: string;
  evidence_strength: string;
  support_basis: string;
  extraction_status: string;
  legal_review_status: string;
  extracted_by: string;
  extracted_on: string;
  reviewed_by: string | null;
  reviewed_on: string | null;
  policy_id: string | null;
  notes: string | null;
}

export interface PolicyData {
  as_of_date: string;
  as_of_timezone: string;
  dimensions: Record<string, { label: string; category: string; outlet: string }>;
  categories: Record<string, string>;
  events: PolicyEvent[];
  segments: Segment[];
  ledger_runs: LedgerRun[];
  snapshots: Snapshot[];
  statuses: Record<string, Record<string, string>>;
}

export interface Asset {
  asset_id: string;
  source_id: string;
  url: string | null;
  request_method: string;
  edition: string;
  source_series: string;
  source_vintage: string;
  retrieved_at: string | null;
  sha256: string | null;
  bytes: number | null;
  format: string;
  acquisition_status: string;
  rights_status: string;
  redistribute_raw: boolean;
  parser: string | null;
  parser_version: string | null;
  priority: number | null;
  notes: string | null;
  landing_url: string | null;
  title: string | null;
  agency: string | null;
  access_method: string | null;
  authentication: string | null;
  update_frequency: string | null;
  observed_first_year: string | null;
  observed_last_year: string | null;
  raw_retention: string | null;
  extraction_status: string | null;
  blockers: string | null;
  next_action: string | null;
  attribution: string | null;
  rights_notes: string | null;
  raw_in_release_bundle: boolean;
  local_copy: boolean;
  local_copy_servable: boolean;
  local_filename: string | null;
  pdf_pages: number | null;
  observations_by_measure: Record<string, { rows: number; values: number; first_year: number; last_year: number }>;
  evidence: { evidence_id: string; policy_id: string }[];
  used_by_legal_ledger: boolean;
  jurisdictions: string[];
}

export interface Source {
  source_id: string;
  publisher: string;
  title: string;
  landing_url: string;
  citation: string;
  source_family: string;
  rights_status: string;
  rights_evidence_url: string | null;
  notes: string | null;
  jurisdictions: string[];
  asset_ids: string[];
}

export interface Lead {
  lead_id: string;
  publisher: string;
  title: string;
  jurisdictions: string;
  source_type: string;
  landing_url: string;
  direct_url: string;
  periods: string;
  access_status: string;
  attempted: string;
  needed_for: string;
  next_action: string;
  rights_note: string;
}

export interface ReleaseBundle {
  version: string;
  release_id: string;
  build_id: string;
  code_commit: string;
  matches_current_build: boolean;
  files: { name: string; bytes: number }[];
}

export interface SourcesData {
  sources: Source[];
  assets: Asset[];
  leads: Lead[];
  release: ReleaseBundle | null;
}

export interface Gap {
  gap_id: string;
  priority: number;
  category: string;
  title: string;
  affected_measures: string[];
  affected_geos: string[];
  year_from: number | null;
  year_to: number | null;
  affected_periods: string;
  why_it_matters: string;
  blocks: string;
  lead_ids: string[];
  next_action: string;
  access_obstacle: string;
  status: string;
  owner: string;
  updated_on: string;
  families: string[];
}

export interface Research {
  categories: Record<string, string>;
  gaps: Gap[];
  leads: Lead[];
}

export interface Deflators {
  measure_id: string;
  base: { key: string; label: string; value: number | null; observation_ids: string[] };
  periods: Record<string, { value: number | null; missing: string | null; months: string; observation_ids: string[] }>;
  /** CPI-U monthly observations by observation_id. */
  months: Record<string, { month: string; value: number | null }>;
}

export interface CaseMetric {
  metric_id: string;
  conversion?: ConversionKind | null;
  note?: string;
}

export interface CaseStudy {
  case_id: string;
  title: string;
  status: string;
  question: string;
  treated_geo: string;
  reform_policy_ids: string[];
  concurrent_policy_ids: string[];
  reform_date: string;
  transition_note: string;
  windows: Record<string, { from: number; to: number; period_kind: string; note: string }>;
  comparison_geos: { geo_id: string; reason: string }[];
  reference_geos: { geo_id: string; reason: string }[];
  metrics: string[];
  panels: { title: string; metrics: CaseMetric[]; note: string; treated_only?: boolean }[];
  what_changed: string[];
  collected: string[];
  missing: string[];
  shows: string[];
  cannot_establish: string[];
  would_improve: string[];
  confounders: { name: string; status: string; note: string }[];
  selection_doc: string;
  config_file: string;
}

/** Monthly series (monthly.json index and monthly/<measure>.json files). */
export interface MonthlyMeta {
  measure_id: string;
  label: string;
  definition: string;
  unit: string;
  beverage: string;
  overlap_note: string | null;
  notes: string | null;
  file: string;
  periods: string[];
  asset_ids: string[];
}

export interface MonthlyFile {
  measure_id: string;
  columns: string[];
  rows: unknown[][];
}

/** One state outline per jurisdiction (map.json), already projected (Albers USA, 975 x 610). */
export interface MapShapes {
  viewBox: string;
  source: { asset_id: string; citation: string };
  states: Record<string, { path: string; label: [number, number] }>;
}

/** A starting point for the Explore view (config/dashboard/analyses/*.yaml), checked by the export. */
export interface SavedAnalysisConfig {
  analysis_id: string;
  title: string;
  question: string;
  metrics: string[];
  metrics_without_data: string[];
  geos: string[];
  years: [number, number];
  shown: string;
  base_year: number | null;
  policy_dimension: string | null;
  notes: string[];
  cannot_show: string[];
  config_file: string;
}

// ----- reconciliation.json (src/alcohol_data/dashboard/reconciliation.py, fiscal_bridge.py) ----------------------
export type EvidenceStatus = "documented" | "documented_provisional" | "reconciles_numerically" | "inferred" | "unresolved";

export interface ReconSource {
  kind: "asset" | "figure" | "rate" | "url" | "lead" | "gap";
  id: string;
  label: string;
  rec?: string | null;
  url?: string | null;
  page?: string;
  status?: EvidenceStatus;
  provisional: boolean;
}

/** One value with where it came from: a record in the build (`rec`) or a figure read online (`figure_id`). */
export interface ReconValue {
  value: number;
  rec?: string;
  figure_id?: string;
  url?: string;
  page?: string;
  document?: string;
  item?: string;
  provisional: boolean;
  ratio?: boolean;
  inputs?: ReconValue[];
}

export interface BridgeVariant {
  sales: number;
  kind: "statutory" | "reported";
  school_meals: number | null;
  enforcement_fund: number | null;
  sales_less_deposits: number | null;
  residual: number | null;
  within_tolerance: boolean | null;
}

export interface BridgeYear {
  fiscal_year: number;
  dabs_sales: ReconValue[];
  dabs_sales_conflict: boolean;
  reported_deposits: { school_meals: ReconValue[]; enforcement_fund: ReconValue[] };
  reported_share_of_sales: { school_meals: number | null; enforcement_fund: number | null };
  statutory_rates: Record<"school_meals" | "enforcement_fund", { rate: number; rate_id: string; status: EvidenceStatus } | null>;
  census_receipts: ReconValue[];
  audited_fund_sales: ReconValue[];
  compared_with: "census" | "audited_fund_sales" | null;
  variants: BridgeVariant[];
  reconciles_with: ("statutory" | "reported")[];
  status: EvidenceStatus;
  uses_provisional: boolean;
  note: string | null;
}

export interface ReconFinding {
  id: string;
  status: EvidenceStatus;
  text: string;
  sources: ReconSource[];
}

export interface PeerRow {
  id: string;
  label: string;
  comparable: "yes" | "partly" | "no";
  why: string;
  utah_label?: string | null;
  peer_label?: string | null;
  values: { utah: Record<string, ReconValue[]>; peer: Record<string, ReconValue[]> };
}

export interface Reconciliation {
  method: string;
  config_file: string;
  tolerance_dollars: number;
  statuses: Record<EvidenceStatus, string>;
  reconciliation_id: string;
  title: string;
  checked_on: string;
  question: string;
  summary: string;
  findings: ReconFinding[];
  fy2024: {
    status: EvidenceStatus;
    text: string;
    facts: { status: EvidenceStatus; text: string; sources: ReconSource[] }[];
    next: string;
    /** Every accounting basis for the deposits, with the equation's terms and the residual on each DABS sales figure. */
    bases?: {
      equation: string;
      texts: Record<BasisId, { status: EvidenceStatus | null; label: string; text: string }>;
      rows: BasisRow[];
    };
  };
  sales_tax_basis: { id: string; series: string; status: EvidenceStatus; text: string; sources: ReconSource[]; scenario_use: string }[];
  corrections: { on: string; was: string; now: string }[];
  deposit_rates: {
    rate_id: string;
    deposit: "school_meals" | "enforcement_fund";
    fiscal_year_from: number;
    fiscal_year_to: number;
    rate: number;
    statute: string;
    text: string;
    evidence: string;
    status: EvidenceStatus;
    note: string;
    sources: ReconSource[];
  }[];
  bridge: BridgeYear[];
  peer: {
    geo_id: string;
    name: string;
    years: number[];
    saved_analysis: string;
    structure: string;
    rows: PeerRow[];
  } | null;
  provisional_documents: { document: string; url: string; read_on: string; read_method: string; lead_id: string; figures: number }[];
}

export type BasisId = "statutory" | "combined_transfer" | "printed_lines" | "school_only";

export interface BasisRow {
  basis: BasisId;
  sales: { value: number; rec: string };
  deposits: { what: string; value: number; rec?: string; rate_id?: string; rate?: number }[];
  deposits_total: number;
  census: { value: number; rec: string };
  residual: number;
}
