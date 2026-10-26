// Which publishers stand behind a chart. A measure's own files name its source; a value this project derives
// (rates per 100,000, fiscal-year sums) names the project, so its inputs are followed back to their
// publishers; and a per-person or constant-dollar form adds the population or price source it divides by.
import type { MetricMeta, MonthlyMeta, Source, SourcesData } from "./types";

export const PROJECT_SOURCE = "project_derivations";
const DEFLATORS = "deflators";
const POP_ALL = "pop_total_resident@point_in_time";
const POP_21 = "pop_age21plus_resident@point_in_time";
/** Inputs the export lists for any measure with conversions, whether or not the form shown uses them. */
const CONVERSION_INPUTS = new Set([DEFLATORS, POP_ALL, POP_21]);

export type ShownForm = "nominal" | "per_resident" | "per_resident_21plus" | "real_cy2024" | "index" | string;

interface Lookup {
  metrics: MetricMeta[];
  monthly: MonthlyMeta[];
  sources: SourcesData;
}

function sourceOfAsset(assetId: string, l: Lookup): string | undefined {
  return l.sources.assets.find((a) => a.asset_id === assetId)?.source_id;
}

function sourcesOfInput(id: string, l: Lookup, depth: number): string[] {
  if (id === DEFLATORS) return ["bls_cpi"];
  if (id.startsWith("monthly:")) {
    const m = l.monthly.find((s) => s.measure_id === id.slice("monthly:".length));
    return (m?.asset_ids ?? []).map((a) => sourceOfAsset(a, l)).filter((s): s is string => Boolean(s));
  }
  const meta = l.metrics.find((m) => m.metric_id === id);
  return meta ? metricSourceIds(meta, "nominal", l, depth + 1) : [];
}

/** Source ids, own sources first, then the inputs', without the project itself. */
export function metricSourceIds(meta: MetricMeta, shown: ShownForm, l: Lookup, depth = 0): string[] {
  const out: string[] = [];
  const add = (ids: string[]) => ids.forEach((s) => s !== PROJECT_SOURCE && !out.includes(s) && out.push(s));
  add(meta.asset_ids.map((a) => sourceOfAsset(a, l)).filter((s): s is string => Boolean(s)));
  if (depth > 3) return out;
  const hasConversions = meta.conversions.length > 0;
  for (const i of meta.input_metrics) {
    if (hasConversions && CONVERSION_INPUTS.has(i)) continue;
    add(sourcesOfInput(i, l, depth));
  }
  if (shown === "real_cy2024") add(sourcesOfInput(DEFLATORS, l, depth));
  if (shown === "per_resident") add(sourcesOfInput(POP_ALL, l, depth));
  if (shown === "per_resident_21plus") add(sourcesOfInput(POP_21, l, depth));
  return out;
}

export function monthlySourceIds(meta: MonthlyMeta, l: Lookup): string[] {
  return [...new Set(meta.asset_ids.map((a) => sourceOfAsset(a, l)).filter((s): s is string => Boolean(s)))];
}

export function sourcesById(ids: string[], data: SourcesData): Source[] {
  return ids.map((id) => data.sources.find((s) => s.source_id === id)).filter((s): s is Source => Boolean(s));
}

/** One line of plain text for a download or an image: "Sources: publisher, title; ...". */
export function sourceLine(sources: Source[], derived: boolean): string {
  if (!sources.length) return "";
  const list = sources.map((s) => `${s.publisher}, ${s.title}`).join("; ");
  return `Source${sources.length > 1 ? "s" : ""}: ${list}.${derived ? " Computed by this project from those sources." : ""}`;
}
