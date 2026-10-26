// What Census state liquor-store finance says about the share of sales that leaves with the sales, and the
// ranges the scenario uses when the reader asks for evidence-based ranges. Exploratory: the regression describes
// the whole systems of the 17 states that ran liquor stores in FY1972 and FY1977-FY2015 (Utah among them, as one
// cluster of 17) and is never filled into the scenario as Utah's avoidable cost. The Census files now reach FY2024,
// but the shown sample stops at FY2015 (store_cost.DISPLAY_LAST_YEAR): the same model with FY2016-FY2024 added is
// in cost_model.json as extension_check, a comparison only, summarized by extensionSummary below. The regression itself is run in
// Python (src/alcohol_data/store_cost.py) and read from cost_model.json; this module only converts and bounds.
//
// The regression's outcome is Census current-operations expenditure, which includes buying the liquor, so its
// slope on revenue is cost of goods plus the operating cost that moves with sales. The scenario's input is the
// operating part: slope minus the cost-of-goods share (one minus the margin). That share is not negative, so a
// slope below the cost of goods alone is reported as zero and flagged.
import type { RangeOverrides } from "./scenarioRanges";

export interface CostSpec {
  horizon_years: number;
  weighting: "dollars" | "state_size_normalized";
  level: number;
  beta: number;
  se: number;
  df: number;
  ci_low: number;
  ci_high: number;
  n: number;
  clusters: number;
  year_groups: number;
  leave_one_state_out: { low: number; low_without: string; high: number; high_without: string } | null;
}

export interface CostSample {
  state_years: number;
  states: string[];
  first_year: number | null;
  last_year: number | null;
  pooled_expenditure_per_revenue_dollar: number | null;
}

interface SlopeBrief {
  beta: number;
  ci_low: number;
  ci_high: number;
  n: number;
  clusters: number;
}

/** The shown sample beside the same model with the later Census years added (store_cost.compare_extension). */
export interface ExtensionCheck {
  method: string;
  base_sample: CostSample;
  extended_sample: CostSample;
  extended_excluded: { geo_id: string; year: number; why: string }[];
  extended_differences_across_comparability_groups: Record<string, { geo_id: string; from_year: number; to_year: number }[]>;
  slopes: {
    horizon_years: number;
    weighting: CostSpec["weighting"];
    base: SlopeBrief;
    extended: SlopeBrief;
    change: number;
    extended_outside_base_interval: boolean;
    base_outside_extended_interval: boolean;
  }[];
  any_slope_outside_the_other_interval: boolean;
}

export interface CostModel {
  method: string;
  outcome: string;
  regressor: string;
  model: string;
  sample: CostSample;
  excluded: ({ geo_id: string; year: number; why: string } | { geo_ids: string[]; state_years: number; why: string })[];
  estimates: CostSpec[];
  extension_check?: ExtensionCheck;
}

/** One paragraph on what the later Census years do to the slopes, for a reader of the shown estimate. */
export function extensionSummary(x: ExtensionCheck): string {
  const b = x.base_sample;
  const e = x.extended_sample;
  if (!x.slopes.length || b.last_year === null || e.last_year === null) return "";
  const range = (vs: number[]) => `${Math.min(...vs).toFixed(2)} to ${Math.max(...vs).toFixed(2)}`;
  const crossing = Object.values(x.extended_differences_across_comparability_groups).reduce((n, v) => n + v.length, 0);
  const outside = x.slopes.filter((s) => s.extended_outside_base_interval || s.base_outside_extended_interval).length;
  return (
    `The Census files now reach FY${e.last_year}. Run again with FY${b.last_year + 1}-FY${e.last_year} added (${e.state_years - b.state_years} more state-years, after leaving out ` +
    `${x.extended_excluded.length} that are flagged or repeat the year before, and ${crossing} changes across a classification break), the four slopes run ` +
    `${range(x.slopes.map((s) => s.extended.beta))}, against ${range(x.slopes.map((s) => s.base.beta))} here; ` +
    (outside === 0
      ? "none falls outside the other's interval. "
      : `in ${outside} of ${x.slopes.length}, one slope falls outside the other's interval. `) +
    `The estimate shown stays on FY${b.first_year}-FY${b.last_year}: the later expenditure comes from a later Census release, which revises FY${b.last_year} for several states without explanation, so it is not shown to be comparable.`
  );
}

export const WEIGHTING_LABEL: Record<CostSpec["weighting"], string> = {
  dollars: "dollars as published (large systems count most)",
  state_size_normalized: "every state counts alike",
};

export interface Implied {
  /** The slope minus the cost-of-goods share, before cutting at zero. */
  raw: number;
  value: number;
  low: number;
  high: number;
  /** True when the point estimate was below zero and shown as zero. */
  floored: boolean;
}

/** The operating cost that moves with sales implied by a slope, given the margin (so the cost-of-goods share is 1 - margin). */
export function impliedAvoidable(beta: number, ciLow: number, ciHigh: number, margin: number): Implied {
  const cogs = 1 - margin;
  const cut = (v: number) => Math.max(0, v);
  const raw = beta - cogs;
  return { raw, value: cut(raw), low: cut(ciLow - cogs), high: cut(ciHigh - cogs), floored: raw < 0 };
}

export interface ImpliedRow extends Implied {
  spec: CostSpec;
}

export function impliedRows(model: CostModel, margin: number): ImpliedRow[] {
  return model.estimates.map((spec) => ({ spec, ...impliedAvoidable(spec.beta, spec.ci_low, spec.ci_high, margin) }));
}

/** The span of the implied figures across every specification: from the lowest lower limit to the highest upper limit. */
export function impliedSpan(rows: ImpliedRow[]): { low: number; high: number } | null {
  if (!rows.length) return null;
  return { low: Math.min(...rows.map((r) => r.low)), high: Math.max(...rows.map((r) => r.high)) };
}

export interface EvidenceInputs {
  /** DABS total operating expenses over liquor sales for the fiscal year, an upper bound on any avoidable operating cost. */
  opexShare: number | null;
  /** Lowest and highest reported all-product margin across the fiscal years that have both figures. */
  marginSpread: { low: number; high: number; years: number[] } | null;
}

export const EVIDENCE_NOTE_COST =
  "From none of DABS's operating expenses to all of them, used as the two ends of the range. The operating cost that leaves with sales cannot exceed total operating expenses, so the high end is an accounting ceiling, not a savings estimate: stores, systems, staff and earmarked costs would not all go. The Census regressions of store expenditure on revenue (section 3) are exploratory and disagree with each other by more than their own intervals, so they do not narrow it.";

/** Ranges for the inputs the dataset can bound, to replace the conventional ranges. */
export function evidenceRanges(ev: EvidenceInputs): RangeOverrides {
  const out: RangeOverrides = {};
  if (ev.opexShare !== null && ev.opexShare > 0) out.avoidableCost = { low: 0, high: ev.opexShare, basis: EVIDENCE_NOTE_COST };
  if (ev.marginSpread && ev.marginSpread.high > ev.marginSpread.low) {
    const { low, high, years } = ev.marginSpread;
    out.grossMargin = {
      low,
      high,
      basis: `The lowest and highest all-product gross margin DABS reported in FY${years[0]}-FY${years[years.length - 1]} (${(100 * low).toFixed(1)}% to ${(100 * high).toFixed(1)}%, ${years.length} years with both figures). A spread of the whole product mix across years, not an interval for wine: wine sold at reduced markups (small producers, military) would have a lower margin, and the dataset does not say how much.`,
    };
  }
  return out;
}

/** Spread of reported margins over years that have both sales and gross profit. */
export function marginSpreadOf(series: { year: number; sales: number | null; gp: number | null }[]): EvidenceInputs["marginSpread"] {
  const ys = series.filter((s) => s.sales !== null && s.sales > 0 && s.gp !== null).sort((a, b) => a.year - b.year);
  if (ys.length < 2) return null;
  const m = ys.map((s) => s.gp! / s.sales!);
  return { low: Math.min(...m), high: Math.max(...m), years: ys.map((s) => s.year) };
}
