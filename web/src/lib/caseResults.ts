// Results of a pre-specified, descriptive before-and-after analysis for a worked example
// (docs/analyses/tn-2016-grocery-wine/specification.md). This file holds that specification as data and runs it
// with the dashboard's existing tools only: analyzeChange and placeboInTime (lib/change, before-after@1.2) for every
// comparison, and the comparison finder (lib/finder, comparison-finder@1.1) for the finder pool. It adds no
// calculation of its own beyond arranging their results; the substitution table sets ethanol changes side by side,
// which is valid because every beverage outcome is in gallons of ethanol. It estimates no effect.
import { analyzeChange, placeboInTime, type ChangeSpec, type OutcomeResult, type PlaceboResult, type PooledResult } from "./change";
import { decodeMetric } from "./decode";
import { CHARACTERISTICS, characteristicData, rankCandidates } from "./finder";
import { buildSeries, type Shown } from "./series";
import type { MetricFile, MetricMeta, MetricsIndex } from "./types";

export const CASE_RESULTS_METHOD = "case-results@1.0";

export type History = "verified_unchanged" | "verified_one_day" | "not_coded";

export interface OutcomeSpec {
  id: string;
  label: string;
  metric: string;
  shown: Shown;
  group: "beverage" | "revenue";
  /** No comparison-state equivalent exists: Tennessee's own before and after only. */
  treatedOnly?: boolean;
  note: string;
}

export interface PoolSpec {
  id: string;
  label: string;
  role: string;
  /** The pool's states, or "finder" for the finder's closest bordering states. */
  geos: string[] | "finder";
}

/** One planned sensitivity check: what it changes from the main specification. */
export interface SensitivitySpec {
  id: string;
  label: string;
  /** Extra years after the change, by period kind, replacing the main counts ("latest" runs to the metric's last year). */
  after?: { calendar_year: number | "latest"; state_fiscal_year: number | "latest" };
  includeTransition?: boolean;
  pool?: string;
  /** Outcome id -> replacement metric (and how it is shown). */
  swap?: Record<string, { metric: string; shown: Shown; label: string }>;
  /** Only these outcomes are rerun (default: every outcome with comparison states). */
  outcomes?: string[];
}

export interface CaseResultsSpec {
  caseId: string;
  title: string;
  specDoc: string;
  resultsDoc: string;
  target: string;
  date: string;
  borders: string[];
  history: Record<string, History>;
  outcomes: OutcomeSpec[];
  /** Main windows: years before and after the change, by period kind; the transition year is left out. */
  main: { before: number; after: { calendar_year: number; state_fiscal_year: number } };
  pools: PoolSpec[];
  mainPool: string;
  finder: { from: number; to: number; take: number };
  sensitivities: SensitivitySpec[];
  placeboMaxBack: number;
}

const BORDERS = ["state:01", "state:05", "state:13", "state:21", "state:28", "state:29", "state:37", "state:51"];

export const TN_2016_RESULTS: CaseResultsSpec = {
  caseId: "tn_2016_food_store_wine",
  title: "Before and after: results of the planned comparison",
  specDoc: "docs/analyses/tn-2016-grocery-wine/specification.md",
  resultsDoc: "docs/analyses/tn-2016-grocery-wine/results.md",
  target: "state:47",
  date: "2016-07-01",
  borders: BORDERS,
  history: {
    "state:21": "verified_unchanged",
    "state:51": "verified_unchanged",
    "state:05": "verified_one_day",
    "state:01": "not_coded",
    "state:13": "not_coded",
    "state:28": "not_coded",
    "state:29": "not_coded",
    "state:37": "not_coded",
  },
  outcomes: [
    { id: "B1", label: "Wine", metric: "niaaa_ethanol_per_capita_21plus_wine@calendar_year", shown: "nominal", group: "beverage", note: "Gallons of ethanol from wine per resident 21+ (NIAAA apparent consumption: sales and shipments, not drinking)." },
    { id: "B2", label: "Beer", metric: "niaaa_ethanol_per_capita_21plus_beer@calendar_year", shown: "nominal", group: "beverage", note: "Gallons of ethanol from beer per resident 21+." },
    { id: "B3", label: "Spirits", metric: "niaaa_ethanol_per_capita_21plus_spirits@calendar_year", shown: "nominal", group: "beverage", note: "Gallons of ethanol from spirits per resident 21+." },
    { id: "B4", label: "All beverages", metric: "niaaa_ethanol_per_capita_21plus_all@calendar_year", shown: "nominal", group: "beverage", note: "Gallons of ethanol from all beverages per resident 21+: total alcohol in one unit." },
    { id: "R1", label: "State alcohol taxes (Census T10)", metric: "stc_alcoholic_beverages_sales_tax@state_fiscal_year", shown: "real_cy2024", group: "revenue", note: "State alcoholic-beverage selective sales taxes, all beverages, constant 2024 dollars (CPI-U fiscal-year averages)." },
    { id: "R2", label: "Tennessee wine tax (account 11002, 'Wine Tax')", metric: "tn_dor_wine_tax_collections@state_fiscal_year", shown: "real_cy2024", group: "revenue", treatedOnly: true, note: "All channels; constant 2024 dollars; FY2010-FY2017 only, because from FY2018 the account also covers high-alcohol beer and is a separate series." },
    { id: "R3", label: "Tennessee wine enforcement tax (account 11018)", metric: "tn_dor_wine_enforcement_tax_collections@state_fiscal_year", shown: "real_cy2024", group: "revenue", treatedOnly: true, note: "All channels; constant 2024 dollars." },
  ],
  main: { before: 5, after: { calendar_year: 3, state_fiscal_year: 3 } },
  pools: [
    { id: "P1", label: "All eight bordering states", role: "Main", geos: BORDERS },
    { id: "P2", label: "Kentucky and Virginia (verified histories)", role: "Sensitivity", geos: ["state:21", "state:51"] },
    { id: "P3", label: "The worked example's shortlist", role: "Sensitivity", geos: ["state:51", "state:13", "state:05", "state:21"] },
    { id: "P4", label: "The finder's four closest bordering states", role: "Sensitivity", geos: "finder" },
  ],
  mainPool: "P1",
  finder: { from: 2011, to: 2015, take: 4 },
  sensitivities: [
    { id: "S1", label: "Longer follow-up, through 2021 / FY2021 (pandemic included)", after: { calendar_year: 5, state_fiscal_year: 5 } },
    { id: "S2", label: "Latest follow-up, through 2024 / FY2025", after: { calendar_year: "latest", state_fiscal_year: "latest" } },
    { id: "S3", label: "Calendar 2016 added to the after window", includeTransition: true, outcomes: ["B1", "B2", "B3", "B4"] },
    { id: "S4-P2", label: "Pool P2: Kentucky and Virginia only", pool: "P2" },
    { id: "S4-P3", label: "Pool P3: the worked example's shortlist", pool: "P3" },
    { id: "S4-P4", label: "Pool P4: the finder's closest bordering states", pool: "P4" },
    {
      id: "S5",
      label: "Residents 14+ in place of 21+",
      outcomes: ["B1", "B2", "B3", "B4"],
      swap: {
        B1: { metric: "niaaa_ethanol_per_capita_14plus_wine@calendar_year", shown: "nominal", label: "Wine, per resident 14+" },
        B2: { metric: "niaaa_ethanol_per_capita_14plus_beer@calendar_year", shown: "nominal", label: "Beer, per resident 14+" },
        B3: { metric: "niaaa_ethanol_per_capita_14plus_spirits@calendar_year", shown: "nominal", label: "Spirits, per resident 14+" },
        B4: { metric: "niaaa_ethanol_per_capita_14plus_all@calendar_year", shown: "nominal", label: "All beverages, per resident 14+" },
      },
    },
    {
      id: "S6",
      label: "Total ethanol by the time-varying ABV method (gallons, not per resident)",
      outcomes: ["B4"],
      swap: { B4: { metric: "niaaa_ethanol_gallons_time_varying_abv_all@calendar_year", shown: "nominal", label: "All beverages, gallons of ethanol (time-varying ABV)" } },
    },
    {
      id: "S7",
      label: "T10 per resident 21+ (nominal) in place of constant dollars",
      outcomes: ["R1"],
      swap: { R1: { metric: "stc_alcoholic_beverages_sales_tax@state_fiscal_year", shown: "per_resident_21plus", label: "T10 per resident 21+, nominal dollars" } },
    },
  ],
  placeboMaxBack: 20,
};

export function caseResultsFor(caseId: string | null | undefined): CaseResultsSpec | null {
  return caseId === TN_2016_RESULTS.caseId ? TN_2016_RESULTS : null;
}

/** Every metric the analysis reads: its outcomes, the sensitivity swaps and the finder's default characteristics. */
export function metricsNeeded(s: CaseResultsSpec): string[] {
  const ids = new Set<string>(s.outcomes.map((o) => o.metric));
  for (const v of s.sensitivities) for (const w of Object.values(v.swap ?? {})) ids.add(w.metric);
  for (const c of CHARACTERISTICS.filter((x) => x.defaultOn)) ids.add(c.metric);
  return [...ids];
}

export interface Inputs {
  idx: MetricsIndex;
  files: Map<string, MetricFile>;
  /** Every state-level geography id (the finder scales characteristics across all of them). */
  states: string[];
  name: (geo: string) => string;
}

export interface FinderPool {
  geos: string[];
  ranked: { geo: string; score: number | null; eligible: boolean }[];
  used: string[];
  why: string | null;
}

/** Pool P4: the bordering states the comparison finder ranks closest to the target, on its default
 * characteristics over the pre-period baseline only, scaled across every state. */
export function finderPool(s: CaseResultsSpec, inp: Inputs): FinderPool {
  const chars = CHARACTERISTICS.filter((c) => c.defaultOn);
  const cd = chars.map((c) => {
    const meta = inp.idx.metrics.find((m) => m.metric_id === c.metric);
    return characteristicData(c, meta, inp.files.get(c.metric), { target: s.target, from: s.finder.from, to: s.finder.to }, inp.states, inp.idx);
  });
  const res = rankCandidates(cd, s.target, s.borders, inp.name, {}, 1);
  const ranked = res.ranked.map((r) => ({ geo: r.item, score: r.score, eligible: r.eligible }));
  const geos = ranked.filter((r) => r.eligible).slice(0, s.finder.take).map((r) => r.geo);
  return { geos, ranked, used: res.used.map((x) => x.c.id), why: geos.length < s.finder.take ? "fewer eligible states than requested" : null };
}

export interface Run {
  outcome: OutcomeSpec;
  metric: string;
  label: string;
  shown: Shown;
  periodKind: string;
  pool: string | null;
  geos: string[];
  spec: ChangeSpec;
  result: OutcomeResult | null;
  placebo: PlaceboResult | null;
  unavailable: string | null;
}

export interface Summary {
  tnBefore: number | null;
  tnAfter: number | null;
  tnChange: number | null;
  tnPct: number | null;
  tnLog: number | null;
  beforeYears: number[];
  afterYears: number[];
  poolChange: number | null;
  diffChange: number | null;
  diffLog: number | null;
  looRange: [number, number] | null;
  spread: PooledResult["spread"];
  /** Pooled leave-one-out difference in log changes, lowest and highest. */
  looLogRange: [number, number] | null;
  why: string | null;
}

export interface CaseResults {
  method: string;
  spec: CaseResultsSpec;
  finder: FinderPool;
  pools: Record<string, string[]>;
  main: Run[];
  /** Main specification on the other pools (sensitivity S4), keyed by pool id. */
  sensitivity: { variant: SensitivitySpec; runs: Run[] }[];
}

const meanOf = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

function seriesFor(meta: MetricMeta, file: MetricFile, geos: string[], shown: Shown, idx: MetricsIndex) {
  const dm = decodeMetric(file);
  const built = geos.map((g) => ({ geo: g, b: buildSeries(meta, dm, g, shown, idx) }));
  const unavailable = built.find((x) => x.b.unavailable)?.b.unavailable ?? null;
  return { series: built.map((x) => ({ geo: x.geo, rows: x.b.rows })), unavailable };
}

function afterCount(meta: MetricMeta, want: number | "latest", s: CaseResultsSpec): number {
  if (want !== "latest") return want;
  // The first after year is the year after the change year for calendar series (2016 is the transition) and the
  // change year for Tennessee's July-June fiscal years (FY2017 starts on the date).
  const first = Number(s.date.slice(0, 4)) + 1;
  return Math.max(1, (meta.last_year ?? first) - first + 1);
}

function runOne(
  s: CaseResultsSpec,
  inp: Inputs,
  outcome: OutcomeSpec,
  poolId: string | null,
  geos: string[],
  opts: { metric?: string; shown?: Shown; label?: string; after?: SensitivitySpec["after"]; includeTransition?: boolean; placebo?: boolean },
): Run {
  const metric = opts.metric ?? outcome.metric;
  const shown = opts.shown ?? outcome.shown;
  const label = opts.label ?? outcome.label;
  const meta = inp.idx.metrics.find((m) => m.metric_id === metric);
  const file = inp.files.get(metric);
  const periodKind = meta?.period_kind ?? "";
  const pk = periodKind === "state_fiscal_year" ? "state_fiscal_year" : "calendar_year";
  const want = opts.after ? opts.after[pk] : s.main.after[pk];
  const spec: ChangeSpec = {
    date: s.date,
    before: s.main.before,
    after: meta ? afterCount(meta, want, s) : 1,
    includeTransition: opts.includeTransition ?? false,
    yearSet: "common",
  };
  const base = { outcome, metric, label, shown, periodKind, pool: poolId, geos, spec, placebo: null };
  if (!meta || !file) return { ...base, result: null, unavailable: `${metric} is not in this build` };
  const all = outcome.treatedOnly ? [s.target] : [s.target, ...geos];
  const { series, unavailable } = seriesFor(meta, file, all, shown, inp.idx);
  if (unavailable) return { ...base, result: null, unavailable };
  const result = analyzeChange(series, spec, periodKind, inp.idx.fiscal_year_rules);
  const placebo = opts.placebo && !outcome.treatedOnly && result.computable ? placeboInTime(series, spec, periodKind, inp.idx.fiscal_year_rules, { maxBack: s.placeboMaxBack }) : null;
  return { ...base, result, placebo, unavailable: null };
}

/** Run the specification: the main comparison (with placebo dates) on the main pool, then every sensitivity. */
export function computeCaseResults(s: CaseResultsSpec, inp: Inputs): CaseResults {
  const finder = finderPool(s, inp);
  const pools: Record<string, string[]> = {};
  for (const p of s.pools) pools[p.id] = p.geos === "finder" ? finder.geos : p.geos;
  const main = s.outcomes.map((o) => runOne(s, inp, o, o.treatedOnly ? null : s.mainPool, o.treatedOnly ? [] : pools[s.mainPool], { placebo: true }));
  const sensitivity = s.sensitivities.map((v) => {
    const ids = v.outcomes ?? s.outcomes.filter((o) => !o.treatedOnly).map((o) => o.id);
    const runs = s.outcomes
      .filter((o) => ids.includes(o.id))
      .map((o) => {
        const sw = v.swap?.[o.id];
        const pool = v.pool ?? s.mainPool;
        return runOne(s, inp, o, o.treatedOnly ? null : pool, o.treatedOnly ? [] : pools[pool], {
          metric: sw?.metric,
          shown: sw?.shown,
          label: sw?.label,
          after: v.after,
          includeTransition: v.includeTransition,
        });
      });
    return { variant: v, runs };
  });
  return { method: CASE_RESULTS_METHOD, spec: s, finder, pools, main, sensitivity };
}

/** The numbers a reader needs from one run. */
export function summarize(run: Run): Summary {
  const empty: Summary = { tnBefore: null, tnAfter: null, tnChange: null, tnPct: null, tnLog: null, beforeYears: [], afterYears: [], poolChange: null, diffChange: null, diffLog: null, looRange: null, spread: null, looLogRange: null, why: run.unavailable };
  const r = run.result;
  if (!r) return empty;
  if (!r.computable) return { ...empty, why: r.whyNot };
  const tn = r.states[0];
  const p = r.pooled;
  // Leave-one-out in log points, from the per-state differences in log changes (equal weights, as the pool uses).
  const logs = r.diffs.map((d) => d.diffLog);
  let looLogRange: [number, number] | null = null;
  if (p && p.why === null && logs.length >= 2 && logs.every((x): x is number => x !== null)) {
    const vals = logs.map((_, i) => meanOf(logs.filter((__, j) => j !== i) as number[])!);
    vals.push(meanOf(logs as number[])!);
    looLogRange = [Math.min(...vals), Math.max(...vals)];
  }
  return {
    tnBefore: tn.beforeMean,
    tnAfter: tn.afterMean,
    tnChange: tn.change,
    tnPct: tn.pctChange,
    tnLog: tn.logChange === null ? null : 100 * tn.logChange,
    beforeYears: tn.beforeYears,
    afterYears: tn.afterYears,
    poolChange: p?.comparisonChange ?? null,
    diffChange: p?.diffChange ?? null,
    diffLog: p?.diffLog === null || p?.diffLog === undefined ? null : 100 * p.diffLog,
    looRange: p?.range ?? null,
    spread: p?.spread ?? null,
    looLogRange: looLogRange ? [100 * looLogRange[0], 100 * looLogRange[1]] : null,
    why: r.diffs.length ? (p?.why ?? null) : null,
  };
}

/** Ethanol changes side by side (main pool): Tennessee's change, the pool's average change and the difference, in
 * gallons of ethanol per resident 21+, for each beverage and for all beverages. */
export function substitutionRows(res: CaseResults): { id: string; label: string; tn: number | null; pool: number | null; diff: number | null }[] {
  return res.main
    .filter((r) => r.outcome.group === "beverage")
    .map((r) => {
      const x = summarize(r);
      return { id: r.outcome.id, label: r.outcome.label, tn: x.tnChange, pool: x.poolChange, diff: x.diffChange };
    });
}
