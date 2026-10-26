// Building chart series from exported observations. All charts, tables and downloads go through here,
// so a plotted point, its table cell and its CSV row are the same value with the same inputs.
import type { ObsRow } from "./bundle";
import type { DecodedMetric } from "./decode";
import { unitAfter } from "./format";
import { FORMULA_VERSION, indexToBase, undefinedReason } from "./formulas";
import type { ChartPoint } from "../components/TrendChart";
import type { ConversionKind, FiscalYearRule, MetricMeta, MetricsIndex, PolicyEvent } from "./types";

export type Shown = "nominal" | ConversionKind | "index";

export interface BuiltSeries {
  points: ChartPoint[];
  rows: ObsRow[];
  unit: string;
  unavailable: string | null;
}

export function buildSeries(
  meta: MetricMeta,
  dm: DecodedMetric,
  geoId: string,
  shown: Shown,
  idx: MetricsIndex,
  baseYear?: number,
): BuiltSeries {
  const unit = unitAfter(meta.unit, shown);
  if ((shown === "real_cy2024" || shown === "per_resident" || shown === "per_resident_21plus") && !meta.conversions.includes(shown)) {
    return { points: [], rows: [], unit, unavailable: meta.conversions_unavailable_reason ?? "No conversion for this metric." };
  }
  const obs = dm.obs.filter((o) => o.geo_id === geoId).sort((a, b) => a.year - b.year);
  const base = shown === "index" ? obs.find((o) => o.year === baseYear) : undefined;
  const points: ChartPoint[] = [];
  const rows: ObsRow[] = [];
  for (const o of obs) {
    let value: number | null = o.value;
    let missing: string | null = o.value === null ? o.missing_reason : null;
    let inputs: string[] = [];
    let method = "as published";
    if (shown === "real_cy2024" || shown === "per_resident" || shown === "per_resident_21plus") {
      const c = dm.conversions.get(o.observation_id)?.get(shown);
      value = c?.value ?? null;
      missing = c ? c.missing : "no conversion exported for this row";
      inputs = c?.inputs ?? [];
      method = idx.conversion_methods[shown];
    } else if (shown === "index") {
      const v = indexToBase(o.value, base?.value);
      value = v ?? null;
      missing = v === undefined ? (undefinedReason(base?.value, o.value) ?? "undefined") : null;
      inputs = base ? [o.observation_id, base.observation_id] : [o.observation_id];
      method = `${FORMULA_VERSION}: index = 100 x value / value in ${baseYear}`;
    }
    points.push({
      year: o.year,
      value,
      low: shown === "nominal" ? o.ci_low : null,
      high: shown === "nominal" ? o.ci_high : null,
      comparability_group: o.comparability_group,
      rec: `obs:${meta.metric_id}:${o.observation_id}`,
      period_label: o.period_label,
      note: missing ?? undefined,
    });
    rows.push({ meta, obs: o, shown: { kind: shown, value, unit, missing, inputs, method } });
  }
  return { points, rows, unit, unavailable: null };
}

/** Fiscal year (end year) containing a date for a state, from metadata/fiscal_years.csv rules. */
export function fiscalYearOf(date: string, geoId: string, rules: FiscalYearRule[]): number {
  const [y, m, d] = date.split("-").map(Number);
  const pick = (fy: number) =>
    rules.find((r) => r.geo_id === geoId && r.valid_from_fy <= fy && fy <= r.valid_to_fy) ??
    rules.find((r) => r.geo_id === "*" && r.valid_from_fy <= fy && fy <= r.valid_to_fy);
  const r = pick(y) ?? { fy_end_month: 6, fy_end_day: 30 };
  const afterEnd = m > r.fy_end_month || (m === r.fy_end_month && d > r.fy_end_day);
  return afterEnd ? y + 1 : y;
}

/** Policy changes with a known legal start inside the range, placed on the period axis used by a chart.
 * A change that starts mid-period makes that period a transition period: it is shaded, never prorated. */
export function policyAnnotations(
  events: PolicyEvent[],
  geoId: string,
  periodKind: string,
  rules: FiscalYearRule[],
  range: [number, number],
): { year: number; label: string; kind: "transition" | "line" }[] {
  const out: { year: number; label: string; kind: "transition" | "line" }[] = [];
  for (const e of events) {
    if (e.geo_id !== geoId || !e.effective_start || e.effective_start_precision !== "day") continue;
    const d = e.effective_start;
    const { year, kind } = placeDate(d, geoId, periodKind, rules);
    if (year < range[0] || year > range[1]) continue;
    const label = `${periodKind === "state_fiscal_year" ? `FY${year}` : year}: ${e.dimension_label} → ${e.policy_value.replaceAll("_", " ")} from ${d}`;
    out.push({ year, label, kind });
  }
  return out;
}

/** The period of a chart's axis that contains a date: a dashed line when the date is the period's first
 * day, a shaded transition period otherwise. */
export function placeDate(date: string, geoId: string, periodKind: string, rules: FiscalYearRule[]): { year: number; kind: "transition" | "line" } {
  const year = periodKind === "state_fiscal_year" ? fiscalYearOf(date, geoId, rules) : Number(date.slice(0, 4));
  const firstDay =
    periodKind === "state_fiscal_year"
      ? (() => {
          const r = rules.find((x) => x.geo_id === geoId) ?? rules.find((x) => x.geo_id === "*");
          const end = new Date(Date.UTC(year - 1, (r?.fy_end_month ?? 6) - 1, r?.fy_end_day ?? 30));
          end.setUTCDate(end.getUTCDate() + 1);
          return end.toISOString().slice(0, 10);
        })()
      : `${year}-01-01`;
  return { year, kind: date === firstDay ? "line" : "transition" };
}

/** Verified status changes (see analysis.statusChanges) placed on a chart's period axis. */
export function changeAnnotations(
  changes: { day: string; label: string }[],
  geoId: string,
  periodKind: string,
  rules: FiscalYearRule[],
  range: [number, number],
): { year: number; label: string; kind: "transition" | "line" }[] {
  const out: { year: number; label: string; kind: "transition" | "line" }[] = [];
  for (const c of changes) {
    const { year, kind } = placeDate(c.day, geoId, periodKind, rules);
    if (year < range[0] || year > range[1]) continue;
    out.push({ year, label: `${periodKind === "state_fiscal_year" ? `FY${year}` : year}: ${c.label}`, kind });
  }
  return out;
}
