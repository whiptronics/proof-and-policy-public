// Filtered downloads: observations plus the measure and source tables needed to read them, a README
// explaining the joins, and the filter state and release that produced them.
import { saveFile, toCsv, zip, type Column } from "./csv";
import { AI_DISCLOSURE } from "./disclosure";
import { FORMULA_VERSION } from "./formulas";
import type { Asset, ConversionKind, Geography, Manifest, MetricMeta, Obs, SourcesData } from "./types";

export interface ObsRow {
  meta: MetricMeta;
  obs: Obs;
  /** Present when the row carries a converted or indexed value. */
  shown?: {
    kind: ConversionKind | "index" | "nominal";
    value: number | null;
    unit: string;
    missing: string | null;
    inputs: string[];
    method: string;
  };
}

function obsColumns(geos: Map<string, Geography>, assets: Map<string, Asset>, withShown: boolean): Column<ObsRow>[] {
  const cols: Column<ObsRow>[] = [
    { key: "observation_id", kind: "text", get: (r) => r.obs.observation_id },
    { key: "metric_id", kind: "text", get: (r) => r.meta.metric_id },
    { key: "measure_id", kind: "text", get: (r) => r.meta.measure_id },
    { key: "geo_id", kind: "text", get: (r) => r.obs.geo_id },
    { key: "geo_name", kind: "text", get: (r) => geos.get(r.obs.geo_id)?.name },
    { key: "period_kind", kind: "text", get: (r) => r.meta.period_kind },
    { key: "period_label", kind: "text", get: (r) => r.obs.period_label },
    { key: "period_start", kind: "date", get: (r) => r.obs.period_start },
    { key: "period_end", kind: "date", get: (r) => r.obs.period_end },
    { key: "year", kind: "number", get: (r) => r.obs.year },
    { key: "value", kind: "number", get: (r) => r.obs.value },
    { key: "unit", kind: "text", get: (r) => r.meta.unit },
    { key: "missing_reason", kind: "text", get: (r) => r.obs.missing_reason },
    { key: "coverage_state", kind: "text", get: (r) => r.obs.cell },
    { key: "estimate_type", kind: "text", get: (r) => r.obs.estimate_type },
    { key: "extraction_method", kind: "text", get: (r) => r.obs.extraction_method },
    { key: "review_status", kind: "text", get: (r) => r.obs.review_status },
    { key: "comparability_group", kind: "text", get: (r) => r.obs.comparability_group },
    { key: "quality_flags", kind: "text", get: (r) => r.obs.quality_flags },
    { key: "ci_low", kind: "number", get: (r) => r.obs.ci_low },
    { key: "ci_high", kind: "number", get: (r) => r.obs.ci_high },
    { key: "ci_level", kind: "number", get: (r) => r.obs.ci_level },
    { key: "sample_size", kind: "number", get: (r) => r.obs.sample_size },
    { key: "raw_value", kind: "text", get: (r) => r.obs.raw_value },
    { key: "raw_unit", kind: "text", get: (r) => r.obs.raw_unit },
    { key: "multiplier", kind: "number", get: (r) => r.obs.multiplier },
    { key: "asset_id", kind: "text", get: (r) => r.obs.asset_id },
    { key: "source_id", kind: "text", get: (r) => assets.get(r.obs.asset_id)?.source_id },
    { key: "source_locator", kind: "text", get: (r) => r.obs.source_locator },
    { key: "source_series", kind: "text", get: (r) => r.obs.source_series },
    { key: "source_vintage", kind: "text", get: (r) => r.obs.source_vintage },
    { key: "transform_id", kind: "text", get: (r) => r.obs.transform_id },
    { key: "input_ids", kind: "list", get: (r) => r.obs.input_ids },
  ];
  if (withShown) {
    cols.push(
      { key: "shown_as", kind: "text", get: (r) => r.shown?.kind },
      { key: "shown_value", kind: "number", get: (r) => r.shown?.value },
      { key: "shown_unit", kind: "text", get: (r) => r.shown?.unit },
      { key: "shown_missing_reason", kind: "text", get: (r) => r.shown?.missing },
      { key: "shown_input_ids", kind: "list", get: (r) => r.shown?.inputs },
      { key: "shown_method", kind: "text", get: (r) => r.shown?.method },
    );
  }
  return cols;
}

const META_COLUMNS: Column<MetricMeta>[] = [
  "metric_id",
  "measure_id",
  "period_kind",
  "family",
  "label",
  "definition",
  "unit",
  "value_kind",
  "beverage",
  "age_universe",
  "recall_period",
  "numerator",
  "denominator",
  "method_family",
  "fiscal_component",
  "government_level",
  "accounting_basis",
  "costs_subtracted",
  "overlap_note",
  "notes",
].map((k) => ({
  key: k,
  kind: k === "costs_subtracted" ? ("bool" as const) : ("text" as const),
  get: (m: MetricMeta) => (m as unknown as Record<string, unknown>)[k],
}));

const ASSET_COLUMNS: Column<Asset>[] = [
  "asset_id",
  "source_id",
  "title",
  "edition",
  "url",
  "landing_url",
  "retrieved_at",
  "sha256",
  "format",
  "acquisition_status",
  "rights_status",
  "redistribute_raw",
].map((k) => ({
  key: k,
  kind: k === "redistribute_raw" ? ("bool" as const) : ("text" as const),
  get: (a: Asset) => (a as unknown as Record<string, unknown>)[k],
}));

export function readme(man: Manifest, title: string, filters: Record<string, string>, extra: string[] = []): string {
  return [
    `${title}`,
    "",
    `Dataset release: ${man.dataset.release_label}; database built ${man.dataset.built_at} from commit ${man.dataset.built_from_commit}.`,
    `Law as of ${man.dataset.law_as_of_date} (${man.dataset.law_as_of_timezone}). Dashboard export ${man.export.generated_at} (${man.schema_version}).`,
    `Downloaded ${new Date().toISOString()}.`,
    "",
    "Files",
    "  observations.csv  one row per observation shown (preferred value per cell; see the release for all candidates)",
    "  measures.csv      what each metric means: definition, unit, beverage, age universe, fiscal component",
    "  sources.csv       the file each value came from, with its SHA-256 and rights status",
    "  filters.json      the dashboard filters and release that produced this download",
    "",
    "Joins",
    "  observations.metric_id -> measures.metric_id",
    "  observations.asset_id  -> sources.asset_id",
    "  observations.input_ids lists, for derived values, the observation_ids (or CPI-U month observations) they were computed from;",
    "  shown_input_ids does the same for converted values; cpi_fy:<months> and cpi_base:2024 name CPI-U averages listed in the",
    "  dashboard's deflators.json.",
    "",
    "Reading the values",
    "  value is in the unit named by unit. An empty value is missing (missing_reason says why); 0 is an observed zero.",
    "  coverage_state: S sourced, D derived, U transcribed and unreviewed, R reviewed, 0 observed zero, C conflict, M missing, N not applicable.",
    "  Fiscal years are the state's own (period_start/period_end); they are not calendar years.",
    "  These are descriptive data. Nothing here estimates the effect of a policy.",
    "",
    "How this was made",
    `  ${AI_DISCLOSURE}`,
    "",
    "CSV convention",
    "  UTF-8, comma-separated, CRLF line ends, RFC 4180 quoting. Text fields that begin with = + - @ TAB or CR are prefixed with an",
    "  apostrophe (') so spreadsheet programs do not run them as formulas; number fields are never altered. Lists use |.",
    `  Percent changes and indexes use ${FORMULA_VERSION}: 100 x (later - earlier) / earlier and 100 x value / base, undefined for a zero or missing base.`,
    "",
    ...(extra.length ? ["Notes", ...extra.map((x) => `  ${x}`), ""] : []),
    "Filters",
    ...Object.entries(filters).map(([k, v]) => `  ${k} = ${v}`),
    "",
  ].join("\r\n");
}

export function downloadBundle(opts: {
  name: string;
  title: string;
  rows: ObsRow[];
  geos: Geography[];
  sources: SourcesData;
  manifest: Manifest;
  filters: Record<string, string>;
  notes?: string[];
}) {
  const geos = new Map(opts.geos.map((g) => [g.geo_id, g]));
  const assets = new Map(opts.sources.assets.map((a) => [a.asset_id, a]));
  const withShown = opts.rows.some((r) => r.shown && r.shown.kind !== "nominal");
  const metas = [...new Map(opts.rows.map((r) => [r.meta.metric_id, r.meta])).values()].sort((a, b) =>
    a.metric_id.localeCompare(b.metric_id),
  );
  const used = [...new Set(opts.rows.map((r) => r.obs.asset_id))]
    .sort()
    .map((id) => assets.get(id))
    .filter((a): a is Asset => Boolean(a));
  const files = [
    { name: "observations.csv", text: toCsv(obsColumns(geos, assets, withShown), opts.rows) },
    { name: "measures.csv", text: toCsv(META_COLUMNS, metas) },
    { name: "sources.csv", text: toCsv(ASSET_COLUMNS, used) },
    {
      name: "filters.json",
      text:
        JSON.stringify(
          {
            release: opts.manifest.dataset.release_label,
            export_generated_at: opts.manifest.export.generated_at,
            url: typeof window === "undefined" ? "" : window.location.href,
            filters: opts.filters,
          },
          null,
          1,
        ) + "\n",
    },
    { name: "README.txt", text: readme(opts.manifest, opts.title, opts.filters, opts.notes) },
  ];
  saveFile(`${opts.name}.zip`, zip(files), "application/zip");
}
