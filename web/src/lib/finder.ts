// Candidate comparison states: which states resemble a target state in a baseline period, on
// characteristics the reader chooses. Transparent arithmetic only (method version FINDER_METHOD):
//
// * Baseline value = the average of a state's values in the baseline years, within one comparability
//   group (the target's, or the most common one). A state needs values in at least half of those years,
//   otherwise its value is missing.
// * Scaling: each characteristic is turned into standard-deviation units across every state that has a
//   value (z = (x - mean) / SD, population SD), after a log10 for size measures. A characteristic with no
//   spread, fewer than three states, or no target value cannot be used, and the report says why.
// * Difference on one characteristic = |z(candidate) - z(target)|; for a yes/no characteristic, 0 when the
//   same and 1 when different.
// * Score (default, "mahalanobis") = square root of the weighted squared distance between the two states in
//   standard-deviation units, divided by the total weight, over the characteristics both states have. The
//   squared distance is Mahalanobis: differences are decorrelated with the correlation matrix of the numeric
//   characteristics across states (shrunk toward independence, Schaefer-Strimmer), so two characteristics
//   that move together (all alcohol and wine consumption, income and spending) are not double counted and a
//   state that differs in the usual direction beats one that differs against it. With independent
//   characteristics this is exactly the weighted root-mean-square difference, kept as the "rms" distance.
//   Yes/no characteristics sit outside the decorrelation and add their weight times 0 or 1.
// * Trend characteristics are the slope of the log of a state's yearly values over the baseline years (about
//   the percent change per year), so states can be matched on where they were heading, not only where they
//   stood. They need at least three baseline years.
// * Warnings are about the match, not the states: even the closest state may be far (in absolute terms and
//   compared with how close states usually are to their own nearest neighbour), and the target may sit
//   outside the range of the other states, where any comparison is an extrapolation.
// * Missing data never helps: candidates are ranked first by how many selected characteristics they lack,
//   then by score. A candidate below the minimum coverage is listed as not scored.
// Only baseline values are used, never outcomes after a change.
import type { ObsRow } from "./bundle";
import { decodeMetric } from "./decode";
import { buildSeries, type Shown } from "./series";
import { cholesky, forwardSolve, olsLine, quantileSorted } from "./stats";
import type { MetricFile, MetricMeta, MetricsIndex } from "./types";

export const FINDER_METHOD = "comparison-finder@1.1";

export interface Characteristic {
  id: string;
  label: string;
  help: string;
  metric: string;
  shown: Shown;
  scale: "linear" | "log10";
  kind: "numeric" | "binary";
  defaultOn: boolean;
  /** Match on the baseline-period trend of the metric (slope of its log per year) instead of its level. */
  trend?: boolean;
}

export const CHARACTERISTICS: Characteristic[] = [
  {
    id: "population",
    label: "Population",
    help: "Residents on July 1. Compared on a log scale: 2 vs 4 million counts the same as 5 vs 10 million.",
    metric: "pop_total_resident@point_in_time",
    shown: "nominal",
    scale: "log10",
    kind: "numeric",
    defaultOn: true,
  },
  {
    id: "income",
    label: "Income per person",
    help: "Per capita personal income, current dollars (BEA).",
    metric: "bea_per_capita_personal_income@calendar_year",
    shown: "nominal",
    scale: "linear",
    kind: "numeric",
    defaultOn: true,
  },
  {
    id: "drinking",
    label: "Adults who drink",
    help: "Share of adults who drank in the past 30 days (BRFSS survey).",
    metric: "brfss_drank_any_past_30d_pct@survey_year",
    shown: "nominal",
    scale: "linear",
    kind: "numeric",
    defaultOn: true,
  },
  {
    id: "binge",
    label: "Binge drinking",
    help: "Share of adults who binge drank (BRFSS).",
    metric: "brfss_binge_5m_4f_pct@survey_year",
    shown: "nominal",
    scale: "linear",
    kind: "numeric",
    defaultOn: false,
  },
  {
    id: "wine",
    label: "Wine consumption",
    help: "Gallons of alcohol from wine per resident 21+ (sales-based, NIAAA).",
    metric: "niaaa_ethanol_per_capita_21plus_wine@calendar_year",
    shown: "nominal",
    scale: "linear",
    kind: "numeric",
    defaultOn: true,
  },
  {
    id: "alcohol",
    label: "All alcohol consumption",
    help: "Gallons of alcohol from all drinks per resident 21+ (NIAAA).",
    metric: "niaaa_ethanol_per_capita_21plus_all@calendar_year",
    shown: "nominal",
    scale: "linear",
    kind: "numeric",
    defaultOn: true,
  },
  {
    id: "spending",
    label: "Take-home alcohol spending per adult",
    help: "What residents spent on alcohol to take home, from any kind of store, per resident 21+ (BEA, current dollars). Spending, not consumption or revenue.",
    metric: "bea_pce_off_premises_alcohol@calendar_year",
    shown: "per_resident_21plus",
    scale: "linear",
    kind: "numeric",
    defaultOn: false,
  },
  {
    id: "taxes",
    label: "Alcohol taxes per adult",
    help: "State alcohol taxes (Census T10) per resident 21+. In states that sell liquor themselves most of the money is store profit, not tax.",
    metric: "stc_alcoholic_beverages_sales_tax_per_resident_21plus@state_fiscal_year",
    shown: "nominal",
    scale: "linear",
    kind: "numeric",
    defaultOn: false,
  },
  {
    id: "monopoly",
    label: "State liquor-store receipts",
    help: "Yes when Census reports state liquor-store receipts (a state wholesale or retail monopoly) in every baseline year. It does not say who runs the retail stores. Census figures cover FY1972 and FY1977-FY2024; from FY2013 a state government with no liquor-store item has no value rather than a zero, so this characteristic is missing for it in those years, not \"no\".",
    metric: "census_liquor_stores_revenue@state_fiscal_year",
    shown: "nominal",
    scale: "linear",
    kind: "binary",
    defaultOn: false,
  },
  {
    id: "population_trend",
    label: "Population growth (trend)",
    help: "Average yearly growth of population over the baseline years: the slope of the log of the yearly values, about the percent change per year. Needs three baseline years.",
    metric: "pop_total_resident@point_in_time",
    shown: "nominal",
    scale: "linear",
    kind: "numeric",
    trend: true,
    defaultOn: false,
  },
  {
    id: "income_trend",
    label: "Income growth (trend)",
    help: "Average yearly growth of per capita personal income (current dollars) over the baseline years. Needs three baseline years.",
    metric: "bea_per_capita_personal_income@calendar_year",
    shown: "nominal",
    scale: "linear",
    kind: "numeric",
    trend: true,
    defaultOn: false,
  },
  {
    id: "wine_trend",
    label: "Wine consumption trend",
    help: "Average yearly change in wine consumption per resident 21+ over the baseline years. Matching on it favours states that were heading the same way before; it does not show they would have kept moving together. Needs three baseline years.",
    metric: "niaaa_ethanol_per_capita_21plus_wine@calendar_year",
    shown: "nominal",
    scale: "linear",
    kind: "numeric",
    trend: true,
    defaultOn: false,
  },
  {
    id: "alcohol_trend",
    label: "All alcohol consumption trend",
    help: "Average yearly change in all-alcohol consumption per resident 21+ over the baseline years. Needs three baseline years.",
    metric: "niaaa_ethanol_per_capita_21plus_all@calendar_year",
    shown: "nominal",
    scale: "linear",
    kind: "numeric",
    trend: true,
    defaultOn: false,
  },
];

/** A log slope per year as a percent change per year ("2.1" for a slope of ln 1.021). */
export const trendPercent = (slope: number) => 100 * (Math.exp(slope) - 1);

export interface BaselineValue {
  value: number | null;
  years: number[];
  why: string | null;
  rows: ObsRow[];
}

const shownOf = (r: ObsRow) => (r.shown ? r.shown.value : r.obs.value);

/** The comparability group to average within: the target's latest one in the baseline, or the most common. */
export function baselineGroup(rowsByGeo: Map<string, ObsRow[]>, target: string, from: number, to: number): string | null {
  const inBase = (r: ObsRow) => r.obs.year >= from && r.obs.year <= to && shownOf(r) !== null;
  const t = (rowsByGeo.get(target) ?? []).filter(inBase).sort((a, b) => b.obs.year - a.obs.year);
  if (t.length) return t[0].obs.comparability_group;
  const counts = new Map<string, number>();
  for (const rows of rowsByGeo.values()) for (const r of rows.filter(inBase)) counts.set(r.obs.comparability_group, (counts.get(r.obs.comparability_group) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/** One state's baseline value for one characteristic. */
export function baselineValue(rows: ObsRow[], from: number, to: number, group: string | null, kind: "numeric" | "binary"): BaselineValue {
  const n = to - from + 1;
  const used = rows.filter((r) => r.obs.year >= from && r.obs.year <= to && shownOf(r) !== null && (group === null || r.obs.comparability_group === group));
  const need = Math.ceil(n / 2);
  if (used.length < need) {
    return { value: null, years: used.map((r) => r.obs.year), why: `values in ${used.length} of ${n} baseline years (needs ${need})`, rows: used };
  }
  const values = used.map((r) => shownOf(r)!);
  if (kind === "binary") {
    const pos = values.filter((v) => v > 0).length;
    if (pos !== 0 && pos !== values.length) {
      return { value: null, years: used.map((r) => r.obs.year), why: "reported in some baseline years but not others", rows: used };
    }
    return { value: pos ? 1 : 0, years: used.map((r) => r.obs.year), why: null, rows: used };
  }
  return { value: values.reduce((a, b) => a + b, 0) / values.length, years: used.map((r) => r.obs.year), why: null, rows: used };
}

/** One state's baseline trend: the OLS slope of ln(value) on year, within one comparability group. Needs three
 * baseline years, values in at least half of them (never fewer than three), and no zero or negative value. */
export function baselineTrend(rows: ObsRow[], from: number, to: number, group: string | null): BaselineValue {
  const n = to - from + 1;
  const used = rows.filter((r) => r.obs.year >= from && r.obs.year <= to && shownOf(r) !== null && (group === null || r.obs.comparability_group === group));
  const years = used.map((r) => r.obs.year);
  if (n < 3) return { value: null, years, why: "a trend needs a baseline of at least three years", rows: used };
  const need = Math.max(3, Math.ceil(n / 2));
  if (used.length < need) return { value: null, years, why: `values in ${used.length} of ${n} baseline years (a trend needs ${need})`, rows: used };
  if (used.some((r) => shownOf(r)! <= 0)) return { value: null, years, why: "has zero or negative values, so no growth rate", rows: used };
  const fit = olsLine(used.map((r) => ({ x: r.obs.year, y: Math.log(shownOf(r)!) })));
  if (!fit) return { value: null, years, why: "no spread in years", rows: used };
  return { value: fit.slope, years, why: null, rows: used };
}

export interface Scale {
  usable: boolean;
  why: string | null;
  mean: number | null;
  sd: number | null;
  n: number;
}

const tx = (v: number, scale: "linear" | "log10") => (scale === "log10" ? (v > 0 ? Math.log10(v) : null) : v);

/** Mean and SD across states for a numeric characteristic (after the log for size measures). */
export function scaleOf(values: (number | null)[], c: Pick<Characteristic, "scale" | "kind">, targetValue: number | null): Scale {
  const xs = values.filter((v): v is number => v !== null).map((v) => tx(v, c.scale)).filter((v): v is number => v !== null);
  if (targetValue === null) return { usable: false, why: "the target state has no baseline value", mean: null, sd: null, n: xs.length };
  if (c.kind === "binary") return { usable: xs.length >= 3, why: xs.length >= 3 ? null : "fewer than three states have values", mean: null, sd: null, n: xs.length };
  if (xs.length < 3) return { usable: false, why: "fewer than three states have values", mean: null, sd: null, n: xs.length };
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
  if (sd === 0) return { usable: false, why: "every state has the same value, so it cannot tell states apart", mean, sd, n: xs.length };
  return { usable: true, why: null, mean, sd, n: xs.length };
}

/** Difference between two baseline values in standard-deviation units (0 or 1 for yes/no). */
export function scaledDiff(a: number, b: number, c: Pick<Characteristic, "scale" | "kind">, s: Scale): number | null {
  if (c.kind === "binary") return a === b ? 0 : 1;
  const xa = tx(a, c.scale);
  const xb = tx(b, c.scale);
  if (xa === null || xb === null || !s.sd) return null;
  return Math.abs(xa - xb) / s.sd;
}

export interface Part {
  id: string;
  weight: number;
  diff: number | null;
  /** Signed difference in standard-deviation units (candidate minus reference), for numeric characteristics only. */
  signed?: number | null;
}

/** Weighted root-mean-square of the differences a candidate has; missing ones are counted, never zero. */
export function score(parts: Part[]): { score: number | null; used: number; missing: number } {
  const have = parts.filter((p) => p.diff !== null && p.weight > 0);
  const missing = parts.filter((p) => p.diff === null && p.weight > 0).length;
  const w = have.reduce((a, p) => a + p.weight, 0);
  if (!have.length || w === 0) return { score: null, used: 0, missing };
  return { score: Math.sqrt(have.reduce((a, p) => a + p.weight * p.diff! ** 2, 0) / w), used: have.length, missing };
}

export interface Ranked<T> {
  item: T;
  score: number | null;
  missing: number;
  coverage: number;
  eligible: boolean;
}

/** Rank by the number of missing characteristics first, then by score; below minimum coverage, not scored. */
export function rank<T>(items: { item: T; name: string; parts: Part[] }[], minCoverage: number, scorer: (parts: Part[]) => { score: number | null; used: number; missing: number } = score): Ranked<T>[] {
  const out = items.map((x) => {
    const s = scorer(x.parts);
    const total = x.parts.filter((p) => p.weight > 0).length;
    const coverage = total ? s.used / total : 0;
    return { item: x.item, name: x.name, score: s.score, missing: s.missing, coverage, eligible: s.score !== null && coverage + 1e-9 >= minCoverage };
  });
  out.sort((a, b) =>
    a.eligible !== b.eligible ? (a.eligible ? -1 : 1) : a.missing !== b.missing ? a.missing - b.missing : (a.score ?? Infinity) - (b.score ?? Infinity) || a.name.localeCompare(b.name),
  );
  return out.map(({ item, score, missing, coverage, eligible }) => ({ item, score, missing, coverage, eligible }));
}

export interface CharData {
  c: Characteristic;
  meta: MetricMeta | undefined;
  values: Map<string, BaselineValue>;
  scale: Scale;
  group: string | null;
}

/** One characteristic's baseline value for every state, and its scale. Shared by the finder and Utah at a
 * glance so the two can never rank candidates differently. */
export function characteristicData(
  c: Characteristic,
  meta: MetricMeta | undefined,
  file: MetricFile | undefined,
  f: { target: string; from: number; to: number },
  states: string[],
  idx: MetricsIndex,
): CharData {
  const values = new Map<string, BaselineValue>();
  if (!meta || !file) return { c, meta, values, scale: { usable: false, why: "not in this build", mean: null, sd: null, n: 0 }, group: null };
  const dm = decodeMetric(file);
  const rows = new Map(states.map((g) => [g, buildSeries(meta, dm, g, c.shown, idx).rows]));
  const group = baselineGroup(rows, f.target, f.from, f.to);
  for (const g of states) values.set(g, c.trend ? baselineTrend(rows.get(g)!, f.from, f.to, group) : baselineValue(rows.get(g)!, f.from, f.to, group, c.kind));
  const scale = scaleOf(
    states.map((g) => values.get(g)!.value),
    c,
    values.get(f.target)!.value,
  );
  return { c, meta, values, scale, group };
}

export type Distance = "mahalanobis" | "rms";
export const DEFAULT_DISTANCE: Distance = "mahalanobis";

/** The correlation matrix of the numeric characteristics across states, shrunk toward independence. */
export interface Decorrelation {
  ids: string[];
  /** Shrunk correlation matrix (positive definite). */
  R: number[][];
  /** Weight on independence: 0 would use the raw correlations, 1 would ignore them. */
  lambda: number;
  /** Raw pairwise correlations, for display. */
  raw: number[][];
}

/** Fewest states with both values before a correlation is estimated at all. */
export const MIN_PAIRS = 8;
/** Shrinkage never goes below this, which also keeps the matrix away from singular. */
export const MIN_LAMBDA = 0.05;

function zOf(x: CharData, g: string): number | null {
  if (x.c.kind !== "numeric" || x.scale.mean === null || !x.scale.sd) return null;
  const v = x.values.get(g)?.value;
  if (v === null || v === undefined) return null;
  const t = tx(v, x.c.scale);
  return t === null ? null : (t - x.scale.mean) / x.scale.sd;
}

/** Pearson r of two samples and Schaefer-Strimmer's estimate of its variance (for the shrinkage weight). */
function pairCorrelation(a: number[], b: number[]): { r: number; v: number } | null {
  const n = a.length;
  if (n < MIN_PAIRS) return null;
  const ma = a.reduce((s, x) => s + x, 0) / n;
  const mb = b.reduce((s, x) => s + x, 0) / n;
  const sa = Math.sqrt(a.reduce((s, x) => s + (x - ma) ** 2, 0) / (n - 1));
  const sb = Math.sqrt(b.reduce((s, x) => s + (x - mb) ** 2, 0) / (n - 1));
  if (!sa || !sb) return null;
  const w = a.map((x, i) => ((x - ma) / sa) * ((b[i] - mb) / sb));
  const wbar = w.reduce((s, x) => s + x, 0) / n;
  return { r: (n * wbar) / (n - 1), v: (n / (n - 1) ** 3) * w.reduce((s, x) => s + (x - wbar) ** 2, 0) };
}

/** Correlations of the usable numeric characteristics, shrunk with the Schaefer-Strimmer weight
 * lambda = sum of var(r) / sum of r^2 over pairs (floored at MIN_LAMBDA, raised until the matrix is positive definite). */
export function decorrelation(used: CharData[]): Decorrelation {
  const num = used.filter((x) => x.c.kind === "numeric" && x.scale.usable);
  const states = num.length ? [...num[0].values.keys()] : [];
  const k = num.length;
  const raw: number[][] = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => (i === j ? 1 : 0)));
  let sumV = 0;
  let sumR2 = 0;
  for (let i = 0; i < k; i++)
    for (let j = i + 1; j < k; j++) {
      const a: number[] = [];
      const b: number[] = [];
      for (const g of states) {
        const za = zOf(num[i], g);
        const zb = zOf(num[j], g);
        if (za !== null && zb !== null) {
          a.push(za);
          b.push(zb);
        }
      }
      const pc = pairCorrelation(a, b);
      if (!pc) continue;
      raw[i][j] = raw[j][i] = pc.r;
      sumV += pc.v;
      sumR2 += pc.r ** 2;
    }
  let lambda = k < 2 ? 1 : sumR2 > 0 ? Math.min(1, Math.max(MIN_LAMBDA, sumV / sumR2)) : 1;
  const shrink = (l: number) => raw.map((row, i) => row.map((v, j) => (i === j ? 1 : (1 - l) * v)));
  let R = shrink(lambda);
  while (!cholesky(R) && lambda < 1) {
    lambda = Math.min(1, lambda + 0.05);
    R = shrink(lambda);
  }
  return { ids: num.map((x) => x.c.id), R, lambda, raw };
}

/** Weighted Mahalanobis score: sqrt(d2 / total weight), where d2 is the squared distance of the weighted numeric
 * differences under the correlation matrix (restricted to the characteristics both states have) plus
 * weight x diff^2 for yes/no ones. With an identity matrix this equals score(). Missing is counted, never zero. */
export function mahalanobisScore(parts: Part[], dec: Decorrelation | null): { score: number | null; used: number; missing: number } {
  const have = parts.filter((p) => p.diff !== null && p.weight > 0);
  const missing = parts.filter((p) => p.diff === null && p.weight > 0).length;
  const w = have.reduce((a, p) => a + p.weight, 0);
  if (!have.length || w === 0) return { score: null, used: 0, missing };
  const idx = (p: Part) => (dec && p.signed !== undefined && p.signed !== null ? dec.ids.indexOf(p.id) : -1);
  const numeric = have.filter((p) => idx(p) >= 0);
  let d2 = have.filter((p) => idx(p) < 0).reduce((a, p) => a + p.weight * p.diff! ** 2, 0);
  if (numeric.length && dec) {
    const ix = numeric.map(idx);
    const sub = ix.map((i) => ix.map((j) => dec.R[i][j]));
    const L = cholesky(sub);
    const delta = numeric.map((p) => Math.sqrt(p.weight) * p.signed!);
    if (L) d2 += forwardSolve(L, delta).reduce((a, y) => a + y * y, 0);
    else d2 += numeric.reduce((a, p) => a + p.weight * p.diff! ** 2, 0);
  }
  return { score: Math.sqrt(d2 / w), used: have.length, missing };
}

export interface RankResult {
  used: CharData[];
  ranked: Ranked<string>[];
  /** Absolute difference of one state from the target on one characteristic, in SD units (0 or 1 for yes/no). */
  diffOf: (x: CharData, g: string) => number | null;
  distance: Distance;
  decorrelation: Decorrelation | null;
  /** The score of one state against another (same distance, weights and coverage rule); null when it cannot be scored. */
  pairScore: (a: string, b: string) => number | null;
}

/** Rank every candidate on the usable characteristics: the finder's scoring, in one place. */
export function rankCandidates(
  cd: CharData[],
  target: string,
  pool: string[],
  name: (g: string) => string,
  weights: Record<string, number>,
  minCoverage: number,
  opts: { distance?: Distance } = {},
): RankResult {
  const used = cd.filter((x) => x.scale.usable);
  const distance = opts.distance ?? DEFAULT_DISTANCE;
  const dec = distance === "mahalanobis" ? decorrelation(used) : null;
  const scorer = (parts: Part[]) => (dec ? mahalanobisScore(parts, dec) : score(parts));
  const between = (x: CharData, a: string, b: string): { diff: number | null; signed: number | null } => {
    const va = x.values.get(a)?.value ?? null;
    const vb = x.values.get(b)?.value ?? null;
    if (va === null || vb === null) return { diff: null, signed: null };
    const diff = scaledDiff(va, vb, x.c, x.scale);
    if (x.c.kind === "binary") return { diff, signed: null };
    const za = zOf(x, a);
    const zb = zOf(x, b);
    return { diff, signed: za === null || zb === null ? null : za - zb };
  };
  const partsOf = (a: string, b: string): Part[] =>
    used.map((x) => {
      const d = between(x, a, b);
      return { id: x.c.id, weight: weights[x.c.id] ?? 1, diff: d.diff, ...(x.c.kind === "numeric" ? { signed: d.signed } : {}) };
    });
  const diffOf = (x: CharData, g: string) => between(x, g, target).diff;
  const ranked = rank(
    pool.map((g) => ({ item: g, name: name(g), parts: partsOf(g, target) })),
    minCoverage,
    scorer,
  );
  const pairScore = (a: string, b: string) => {
    const parts = partsOf(a, b);
    const s = scorer(parts);
    const total = parts.filter((p) => p.weight > 0).length;
    return s.score !== null && total && s.used / total + 1e-9 >= minCoverage ? s.score : null;
  };
  return { used, ranked, diffOf, distance, decorrelation: dec, pairScore };
}

// ----- warnings about the match -----------------------------------------------------------------------------

/** The closest state is not a good match when its score is at least this many standard deviations... */
export const FAR_SCORE = 1;
/** ...or worse than this share of states are from their own nearest neighbour. */
export const FAR_PERCENTILE = 0.9;
/** The target is extreme on a characteristic when it is this many standard deviations from the state average. */
export const EXTREME_Z = 2;

export interface FinderWarning {
  id: "far_match" | "extreme_target" | "few_candidates";
  text: string;
}

/** Cautions about the quality of the match itself, from the same ranking the reader sees. */
export function finderWarnings(r: RankResult, target: string, name: (g: string) => string): FinderWarning[] {
  const out: FinderWarning[] = [];
  const eligible = r.ranked.filter((x) => x.eligible);
  if (eligible.length < 3) {
    out.push({ id: "few_candidates", text: `Only ${eligible.length} state${eligible.length === 1 ? "" : "s"} could be scored with these settings, so there is little to choose from. Loosen the exclusions or the minimum coverage, or choose fewer characteristics.` });
  }
  // Extreme target: outside the usual spread of the states on a characteristic.
  const extremes = r.used
    .filter((x) => x.c.kind === "numeric")
    .flatMap((x) => {
      const z = zOf(x, target);
      if (z === null || Math.abs(z) < EXTREME_Z) return [];
      const tv = x.values.get(target)!.value!;
      const others = [...x.values.entries()].filter(([g, v]) => g !== target && v.value !== null).map(([, v]) => v.value!);
      const beyond = others.length && tv > Math.max(...others) ? "no other state is as high" : others.length && tv < Math.min(...others) ? "no other state is as low" : null;
      return [`${x.c.label.toLowerCase()} (${Math.abs(z).toFixed(1)} SD ${z > 0 ? "above" : "below"} the state average${beyond ? `; ${beyond}` : ""})`];
    });
  if (extremes.length) {
    out.push({
      id: "extreme_target",
      text: `${name(target)} is unusual among states on ${extremes.join(", ")}. Few states resemble it there, so any comparison leans on states that differ from it, and an average of them can only approximate it by extrapolation.`,
    });
  }
  // Even the closest state is far: in absolute terms, or compared with how close states usually are to their nearest neighbour.
  const best = eligible[0];
  if (best && best.score !== null) {
    const states = r.used.length ? [...r.used[0].values.keys()] : [];
    const nn = states
      .filter((g) => g !== target)
      .map((g) => Math.min(...states.filter((h) => h !== g).map((h) => r.pairScore(g, h)).filter((v): v is number => v !== null)))
      .filter((v) => Number.isFinite(v))
      .sort((a, b) => a - b);
    const p90 = nn.length >= 10 ? quantileSorted(nn, FAR_PERCENTILE) : null;
    const absolute = best.score >= FAR_SCORE;
    const relative = p90 !== null && best.score > p90;
    if (absolute || relative) {
      out.push({
        id: "far_match",
        text: `Even the closest state, ${name(best.item)}, scores ${best.score.toFixed(2)}${absolute ? `, an average difference of ${FAR_SCORE} SD or more` : ""}${
          relative ? `${absolute ? " and" : ","} farther than ${Math.round(FAR_PERCENTILE * 100)}% of states are from their own nearest neighbour (${p90!.toFixed(2)} or less)` : ""
        }. None of these states closely matches ${name(target)} on the chosen characteristics; treat each as a loose analogy.`,
      });
    }
  }
  return out;
}

export function similarityWord(diff: number | null, kind: "numeric" | "binary"): "similar" | "different" | "in between" | "missing" {
  if (diff === null) return "missing";
  if (kind === "binary") return diff === 0 ? "similar" : "different";
  return diff < 0.5 ? "similar" : diff > 1 ? "different" : "in between";
}
