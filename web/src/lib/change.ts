// Before-and-after comparison around a policy change date. Descriptive arithmetic only: window means,
// changes between them, a difference in changes between states, pre-period trends, and how large chance
// variation is. Nothing here estimates an effect.
//
// Rules (method version CHANGE_METHOD):
// * Each observation is placed by its own period dates: before (ends before the date), after (starts on or
//   after it) or transition (straddles it). Fiscal years therefore keep each state's own boundaries.
// * Year zero is the target state's period that contains the change date (a transition period) or, when the
//   date is a period's first day, the period that starts on it.
// * The transition period is left out of the averages unless the reader includes it in "after".
// * Missing years are never filled. By default every state's averages use the same years ("common years");
//   a year one state lacks is dropped for all, and the drop is reported. With each state's own years,
//   differences between states are not computed.
// * A change is computed only when every value used shares one comparability group.
//
// Added in 1.1 (all descriptive; none of it makes a difference in changes an effect):
// * Sampling error. Where a value carries a published confidence interval (survey shares), its standard
//   error is half the interval's width over its z. A window mean's error is sqrt(sum of squared errors) / n
//   (annual surveys are independent samples); a change's error combines its two windows; a difference in
//   changes combines the two states'. Measures with no published interval get none, and the tool says so.
//   Only sampling error is covered: nothing here measures bias, confounding or the pandemic.
// * Pre-period trend with its own error. A slope needs three points (as the Python descriptive outputs
//   do). The "if before trends had continued" figure carries the error of both slopes, and the tool says
//   that trends explain a difference only when that figure is distinguishable from zero.
// * A pooled comparison (equal weights unless the caller gives weights) with every leave-one-state-out
//   result, and differences in log changes, which are symmetric where percent changes are not.
// * Placebo-in-time: the same calculation at earlier dates that precede the real change, to show how large a
//   "difference in changes" is at dates chosen without regard to any law. A diagnostic only: other things can
//   have changed in those years too, so a placebo gap is not "what happens when nothing happens".
//
// Changed in 1.2: a year's error uses the larger side of an asymmetric published interval (lib/stats
// seFromInterval); the interval may be sampling error (surveys) or chance variation in a count (FARS), and the
// tool names which (lib/stats intervalKind). The pooled comparison also reports how far the comparison states'
// own changes spread, because its interval covers sampling error only and says nothing about how much states'
// changes differ from one another.
import { percentChange } from "./formulas";
import type { ObsRow } from "./bundle";
import { placeDate } from "./series";
import { contrast, olsLine, quantileSorted, seFromInterval, seOfMean, seOfSum, summarize, tCritical95, type LineFit } from "./stats";
import type { FiscalYearRule } from "./types";

export const CHANGE_METHOD = "before-after@1.2";

export type Role = "before" | "after" | "transition";

export function periodRole(start: string, end: string, date: string): Role {
  if (end < date) return "before";
  if (start >= date) return "after";
  return "transition";
}

export interface ChangeSpec {
  date: string;
  before: number;
  after: number;
  includeTransition: boolean;
  yearSet: "common" | "own";
}

export interface ChangeOptions {
  /** Relative weights of comparison states in the pooled comparison (default: equal). */
  weights?: Record<string, number>;
}

export type CellStatus = "used" | "missing" | "wrong_side" | "not_common" | "transition_excluded" | "excluded_state";

export interface YearCell {
  year: number;
  window: "before" | "after" | "transition";
  value: number | null;
  /** Standard error of the value, from its published confidence interval; null when it has none. */
  se: number | null;
  role: Role | null;
  row: ObsRow | null;
  status: CellStatus;
  why: string | null;
}

export interface StateResult {
  geo: string;
  included: boolean;
  excludedWhy: string | null;
  beforeYears: number[];
  afterYears: number[];
  beforeMean: number | null;
  afterMean: number | null;
  beforeSE: number | null;
  afterSE: number | null;
  change: number | null;
  /** Standard error of the change; null unless every value used has a published interval. */
  changeSE: number | null;
  pctChange: number | null;
  pctWhy: string | null;
  /** ln(after average / before average), where both averages are above zero. */
  logChange: number | null;
  slope: number | null;
  /** Standard error and residual degrees of freedom of the before-period slope (three or more points). */
  slopeSE: number | null;
  slopeDf: number | null;
  comparable: boolean;
  notComparableWhy: string | null;
  cells: YearCell[];
}

export interface DiffResult {
  geo: string;
  diffChange: number | null;
  diffChangeSE: number | null;
  /** z statistic and two-sided p of the difference in changes against sampling noise alone. */
  diffZ: number | null;
  diffP: number | null;
  /** 95% interval for the difference in changes from sampling error alone. */
  diffInterval: [number, number] | null;
  diffPct: number | null;
  /** Difference in log changes (target minus comparison); times 100 it reads as percent. */
  diffLog: number | null;
  slopeDiff: number | null;
  slopeDiffSE: number | null;
  /** What the difference in changes would be if both states had simply kept their before-period trends:
   * difference in trends x years between the middles of the before and after years used. */
  trendOnly: number | null;
  trendOnlySE: number | null;
  trendOnlyInterval: [number, number] | null;
  /** True when the trend-only figure is distinguishable from zero, false when it is not, null when the
   * slopes have no error (fewer than three before values in a state). */
  trendReliable: boolean | null;
  why: string | null;
}

export interface PooledResult {
  geos: string[];
  /** Normalized weights, in the order of `geos`. */
  weights: number[];
  comparisonChange: number | null;
  comparisonChangeSE: number | null;
  diffChange: number | null;
  diffChangeSE: number | null;
  diffZ: number | null;
  diffP: number | null;
  diffInterval: [number, number] | null;
  diffLog: number | null;
  /** The pooled difference in changes with each comparison state left out in turn. */
  leaveOneOut: { dropped: string; diffChange: number | null }[];
  /** Lowest and highest difference in changes among the full pool and every leave-one-out pool. */
  range: [number, number] | null;
  /** How far the comparison states' own changes spread: lowest, highest, sample SD (two or more states), and
   * whether the target's change lies inside [lowest, highest]. Null when the pool is not computed. The pooled
   * interval covers sampling error only; this spread is the between-state variation it leaves out. */
  spread: { min: number; max: number; sd: number | null; targetInside: boolean } | null;
  why: string | null;
}

export interface OutcomeResult {
  year0: number;
  transitionYear: number | null;
  beforeWindow: number[];
  afterWindow: number[];
  usedBefore: number[];
  usedAfter: number[];
  dropped: { year: number; window: string; why: string }[];
  states: StateResult[];
  diffs: DiffResult[];
  pooled: PooledResult | null;
  computable: boolean;
  whyNot: string | null;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Least-squares fit of value on year, for the before-period trend. Three points or more, as the Python
 * descriptive outputs require: two points always fit a line exactly and say nothing about its error. */
export function trendFit(points: { year: number; value: number }[]): LineFit | null {
  if (points.length < 3) return null;
  return olsLine(points.map((p) => ({ x: p.year, y: p.value })));
}

/** Least-squares slope of value on year (units per year); null with fewer than three points. */
export function slopePerYear(points: { year: number; value: number }[]): number | null {
  return trendFit(points)?.slope ?? null;
}

/** ln(after / before), only where both averages are above zero. */
export function logChange(before: number | null, after: number | null): number | null {
  if (before === null || after === null || !(before > 0) || !(after > 0)) return null;
  return Math.log(after / before);
}

/** Percent change between window means, only where it means something: a positive base. */
export function meaningfulPct(before: number | null, after: number | null): { pct: number | null; why: string | null } {
  if (before === null || after === null) return { pct: null, why: "an average is missing" };
  if (before === 0) return { pct: null, why: "the before average is zero, so a percent change is undefined" };
  if (before < 0) return { pct: null, why: "the before average is negative, so a percent change would mislead" };
  return { pct: percentChange(before, after) ?? null, why: null };
}

/** Where year zero falls for the target: from its own observations when it has one near the date (period
 * dates are authoritative), otherwise from the period-kind rules. */
export function locateYear0(
  targetRows: ObsRow[],
  date: string,
  periodKind: string,
  geo: string,
  rules: FiscalYearRule[],
): { year0: number; transition: boolean } {
  const byYear = new Map(targetRows.map((r) => [r.obs.year, r]));
  const rule = placeDate(date, geo, periodKind, rules);
  let year0 = rule.year;
  if (periodKind === "point_in_time") {
    const r = byYear.get(year0);
    if (r && periodRole(r.obs.period_start, r.obs.period_end, date) === "before") year0 += 1;
    return { year0, transition: false };
  }
  const r = byYear.get(year0);
  if (r) {
    const role = periodRole(r.obs.period_start, r.obs.period_end, date);
    if (role === "transition") return { year0, transition: true };
    if (role === "after") return { year0, transition: false };
    return { year0: year0 + 1, transition: false };
  }
  return { year0, transition: rule.kind === "transition" };
}

const fmtPeriod = (r: ObsRow) => `${r.obs.period_start} to ${r.obs.period_end}`;

function shownValue(r: ObsRow): number | null {
  return r.shown ? r.shown.value : r.obs.value;
}

function shownMissing(r: ObsRow): string | null {
  return r.shown ? r.shown.missing : r.obs.missing_reason;
}

/** A published interval describes the value as published. A converted value (per resident, constant
 * dollars, an index) has no interval of its own, so it gets no standard error. */
function shownSE(r: ObsRow): number | null {
  if (r.shown && r.shown.kind !== "nominal") return null;
  return seFromInterval(r.obs.ci_low, r.obs.ci_high, r.obs.ci_level, r.obs.value);
}

function blankDiff(geo: string, why: string | null): DiffResult {
  return {
    geo,
    diffChange: null,
    diffChangeSE: null,
    diffZ: null,
    diffP: null,
    diffInterval: null,
    diffPct: null,
    diffLog: null,
    slopeDiff: null,
    slopeDiffSE: null,
    trendOnly: null,
    trendOnlySE: null,
    trendOnlyInterval: null,
    trendReliable: null,
    why,
  };
}

/** Pool the comparison states' changes (weighted mean) and compare the target's change with the pool. */
function pool(t: StateResult, others: StateResult[], weights: Record<string, number> | undefined): Omit<PooledResult, "leaveOneOut" | "range" | "spread" | "why"> {
  const raw = others.map((s) => {
    const w = weights?.[s.geo];
    return typeof w === "number" && Number.isFinite(w) && w > 0 ? w : weights ? 0 : 1;
  });
  const total = raw.reduce((a, b) => a + b, 0);
  const w = total > 0 ? raw.map((x) => x / total) : raw.map(() => 1 / others.length);
  const changes = others.map((s) => s.change!);
  const comparisonChange = changes.reduce((a, c, i) => a + w[i] * c, 0);
  const ses = others.map((s) => s.changeSE);
  const comparisonChangeSE = ses.some((x) => x === null) ? null : Math.sqrt(ses.reduce<number>((a, x, i) => a + (w[i] * x!) ** 2, 0));
  const ct = contrast({ value: t.change!, se: t.changeSE }, { value: comparisonChange, se: comparisonChangeSE });
  const logs = others.map((s) => s.logChange);
  const diffLog = t.logChange === null || logs.some((x) => x === null) ? null : t.logChange - logs.reduce<number>((a, x, i) => a + w[i] * x!, 0);
  return {
    geos: others.map((s) => s.geo),
    weights: w,
    comparisonChange,
    comparisonChangeSE,
    diffChange: ct.diff,
    diffChangeSE: ct.se,
    diffZ: ct.z,
    diffP: ct.p,
    diffInterval: ct.interval,
    diffLog,
  };
}

/** Compare before and after windows for a target state (first entry) and comparison states. */
export function analyzeChange(
  series: { geo: string; rows: ObsRow[] }[],
  spec: ChangeSpec,
  periodKind: string,
  rules: FiscalYearRule[],
  opts: ChangeOptions = {},
): OutcomeResult {
  const target = series[0];
  const { year0, transition } = locateYear0(target.rows, spec.date, periodKind, target.geo, rules);
  const beforeWindow: number[] = [];
  for (let y = year0 - spec.before; y < year0; y++) beforeWindow.push(y);
  const afterStart = transition ? year0 + 1 : year0;
  const afterWindow: number[] = [];
  for (let y = afterStart; y < afterStart + spec.after; y++) afterWindow.push(y);
  const transitionYear = transition ? year0 : null;
  const useTransition = transition && spec.includeTransition;

  const states: StateResult[] = series.map((s) => {
    const byYear = new Map(s.rows.map((r) => [r.obs.year, r]));
    const cell = (year: number, window: YearCell["window"]): YearCell => {
      const row = byYear.get(year) ?? null;
      if (!row) return { year, window, value: null, se: null, role: null, row: null, status: "missing", why: "no record for this year" };
      const value = shownValue(row);
      const se = shownSE(row);
      const role = periodRole(row.obs.period_start, row.obs.period_end, spec.date);
      if (value === null) return { year, window, value, se: null, role, row, status: "missing", why: (shownMissing(row) ?? "missing").replaceAll("_", " ") };
      if (window === "transition" && !useTransition) {
        return { year, window, value, se, role, row, status: "transition_excluded", why: "transition period, left out of the averages" };
      }
      const ok = window === "before" ? role === "before" : window === "after" ? role === "after" : role !== "before";
      if (!ok) {
        const why =
          role === "transition"
            ? `straddles ${spec.date} for this state (${fmtPeriod(row)})`
            : role === "after"
              ? `entirely after ${spec.date} for this state (${fmtPeriod(row)})`
              : `entirely before ${spec.date} for this state (${fmtPeriod(row)})`;
        return { year, window, value, se, role, row, status: "wrong_side", why };
      }
      return { year, window, value, se, role, row, status: "used", why: null };
    };
    const cells = [
      ...beforeWindow.map((y) => cell(y, "before")),
      ...(transitionYear !== null ? [cell(transitionYear, "transition")] : []),
      ...afterWindow.map((y) => cell(y, "after")),
    ];
    return {
      geo: s.geo,
      included: true,
      excludedWhy: null,
      beforeYears: [],
      afterYears: [],
      beforeMean: null,
      afterMean: null,
      beforeSE: null,
      afterSE: null,
      change: null,
      changeSE: null,
      pctChange: null,
      pctWhy: null,
      logChange: null,
      slope: null,
      slopeSE: null,
      slopeDf: null,
      comparable: true,
      notComparableWhy: null,
      cells,
    };
  });

  const qualifying = (st: StateResult, w: "before" | "after") =>
    st.cells.filter((c) => c.status === "used" && (w === "before" ? c.window === "before" : c.window !== "before")).map((c) => c.year);
  const base: OutcomeResult = {
    year0,
    transitionYear,
    beforeWindow,
    afterWindow,
    usedBefore: [],
    usedAfter: [],
    dropped: [],
    states,
    diffs: [],
    pooled: null,
    computable: false,
    whyNot: null,
  };
  const t = states[0];
  if (!qualifying(t, "before").length || !qualifying(t, "after").length) {
    base.whyNot = !qualifying(t, "before").length ? "the target state has no usable value before the change" : "the target state has no usable value after the change";
    return base;
  }
  for (const st of states.slice(1)) {
    const missingWindow = !qualifying(st, "before").length ? "before" : !qualifying(st, "after").length ? "after" : null;
    if (missingWindow) {
      st.included = false;
      st.excludedWhy = `no usable value ${missingWindow} the change in these years`;
      for (const c of st.cells) {
        if (c.status !== "used") continue;
        c.status = "excluded_state";
        c.why = `this state is left out of this outcome (${st.excludedWhy})`;
      }
    }
  }
  const active = states.filter((s) => s.included);

  if (spec.yearSet === "common") {
    for (const w of ["before", "after"] as const) {
      const sets = active.map((s) => new Set(qualifying(s, w)));
      const years = [...sets[0]].filter((y) => sets.every((x) => x.has(y))).sort((a, b) => a - b);
      const windowYears = w === "before" ? beforeWindow : [...(useTransition ? [transitionYear!] : []), ...afterWindow];
      for (const y of windowYears) {
        if (years.includes(y)) continue;
        const lacking = active.filter((_, i) => !sets[i].has(y)).map((s) => s.geo);
        base.dropped.push({ year: y, window: w, why: `not usable for ${lacking.join(", ")}` });
      }
      if (w === "before") base.usedBefore = years;
      else base.usedAfter = years;
    }
    for (const s of active) {
      for (const c of s.cells) {
        if (c.status !== "used") continue;
        const keep = c.window === "before" ? base.usedBefore.includes(c.year) : base.usedAfter.includes(c.year);
        if (!keep) {
          c.status = "not_common";
          c.why = "another state has no usable value this year";
        }
      }
    }
    if (!base.usedBefore.length || !base.usedAfter.length) {
      base.whyNot = `no ${!base.usedBefore.length ? "before" : "after"} year has a usable value for every state shown; remove a state or use each state's own years`;
      return base;
    }
  }

  for (const s of active) {
    const used = s.cells.filter((c) => c.status === "used");
    const usedBefore = used.filter((c) => c.window === "before");
    const usedAfter = used.filter((c) => c.window !== "before");
    s.beforeYears = usedBefore.map((c) => c.year);
    s.afterYears = usedAfter.map((c) => c.year);
    const groups = [...new Set(used.map((c) => c.row!.obs.comparability_group))];
    if (groups.length > 1) {
      s.comparable = false;
      s.notComparableWhy = `the definition or method changes inside these years (comparability groups: ${groups.join(", ")})`;
      continue;
    }
    s.beforeMean = mean(usedBefore.map((c) => c.value!));
    s.afterMean = mean(usedAfter.map((c) => c.value!));
    s.beforeSE = seOfMean(usedBefore.map((c) => c.se));
    s.afterSE = seOfMean(usedAfter.map((c) => c.se));
    s.change = s.beforeMean !== null && s.afterMean !== null ? s.afterMean - s.beforeMean : null;
    s.changeSE = s.change === null ? null : seOfSum([s.beforeSE, s.afterSE]);
    const p = meaningfulPct(s.beforeMean, s.afterMean);
    s.pctChange = p.pct;
    s.pctWhy = p.why;
    s.logChange = logChange(s.beforeMean, s.afterMean);
    const fit = trendFit(usedBefore.map((c) => ({ year: c.year, value: c.value! })));
    s.slope = fit ? fit.slope : null;
    s.slopeSE = fit ? fit.se : null;
    s.slopeDf = fit ? fit.df : null;
  }
  base.usedBefore = spec.yearSet === "common" ? base.usedBefore : [...new Set(active.flatMap((s) => s.beforeYears))].sort((a, b) => a - b);
  base.usedAfter = spec.yearSet === "common" ? base.usedAfter : [...new Set(active.flatMap((s) => s.afterYears))].sort((a, b) => a - b);
  base.computable = t.comparable;
  base.whyNot = t.comparable ? null : t.notComparableWhy;
  for (const s of states.slice(1)) {
    let why: string | null = null;
    if (!s.included) why = s.excludedWhy;
    else if (spec.yearSet !== "common") why = "each state uses its own years, so the averages cover different years";
    else if (!t.comparable || !s.comparable) why = "a definition change inside these years";
    if (why) {
      base.diffs.push(blankDiff(s.geo, why));
      continue;
    }
    const slopeDiff = t.slope !== null && s.slope !== null ? t.slope - s.slope : null;
    const slopeDiffSE = seOfSum([t.slopeSE, s.slopeSE]);
    const gap = mean(base.usedAfter)! - mean(base.usedBefore)!;
    const trendOnly = slopeDiff === null ? null : slopeDiff * gap;
    const trendOnlySE = slopeDiffSE === null ? null : Math.abs(gap) * slopeDiffSE;
    // Two fits with different degrees of freedom: the smaller is the safe one to take the t value from.
    const tc = t.slopeDf !== null && s.slopeDf !== null ? tCritical95(Math.min(t.slopeDf, s.slopeDf)) : null;
    const half = tc !== null && trendOnlySE !== null ? tc * trendOnlySE : null;
    const ct = t.change !== null && s.change !== null ? contrast({ value: t.change, se: t.changeSE }, { value: s.change, se: s.changeSE }) : null;
    base.diffs.push({
      geo: s.geo,
      diffChange: ct ? ct.diff : null,
      diffChangeSE: ct ? ct.se : null,
      diffZ: ct ? ct.z : null,
      diffP: ct ? ct.p : null,
      diffInterval: ct ? ct.interval : null,
      diffPct: t.pctChange !== null && s.pctChange !== null ? t.pctChange - s.pctChange : null,
      diffLog: t.logChange !== null && s.logChange !== null ? t.logChange - s.logChange : null,
      slopeDiff,
      slopeDiffSE,
      trendOnly,
      trendOnlySE,
      trendOnlyInterval: half !== null && trendOnly !== null ? [trendOnly - half, trendOnly + half] : null,
      trendReliable: half !== null && trendOnly !== null ? Math.abs(trendOnly) > half : null,
      why: t.pctChange === null || s.pctChange === null ? "a percent change is undefined for one of the two states" : null,
    });
  }

  const others = states.slice(1);
  if (others.length) {
    const ok = others.filter((s) => s.included && s.comparable && s.change !== null);
    const blocked = spec.yearSet !== "common" ? "each state uses its own years, so the averages cover different years" : !t.comparable ? "a definition change inside these years" : !ok.length ? "no comparison state has a change to pool" : null;
    if (blocked || t.change === null) {
      base.pooled = {
        geos: ok.map((s) => s.geo),
        weights: [],
        comparisonChange: null,
        comparisonChangeSE: null,
        diffChange: null,
        diffChangeSE: null,
        diffZ: null,
        diffP: null,
        diffInterval: null,
        diffLog: null,
        leaveOneOut: [],
        range: null,
        spread: null,
        why: blocked ?? "the target has no change",
      };
    } else {
      const full = pool(t, ok, opts.weights);
      const loo = ok.length > 1 ? ok.map((s) => ({ dropped: s.geo, diffChange: pool(t, ok.filter((x) => x !== s), opts.weights).diffChange })) : [];
      const all = [full.diffChange!, ...loo.map((x) => x.diffChange!)];
      const changes = ok.map((s) => s.change!);
      const lo = Math.min(...changes);
      const hi = Math.max(...changes);
      const spread = { min: lo, max: hi, sd: summarize(changes)?.sd ?? null, targetInside: t.change! >= lo && t.change! <= hi };
      base.pooled = { ...full, leaveOneOut: loo, range: loo.length ? [Math.min(...all), Math.max(...all)] : null, spread, why: null };
    }
  }
  return base;
}

/** Event-time points: year zero is the target's change period. Optionally as a percent of each state's
 * before average (only for states with a positive before average). */
export function eventTime(
  rows: ObsRow[],
  year0: number,
  beforeMean: number | null,
  relative: boolean,
): { k: number; value: number | null; row: ObsRow }[] {
  return rows
    .map((r) => {
      const v = shownValue(r);
      const value = !relative ? v : v === null || beforeMean === null || beforeMean <= 0 ? null : (100 * v) / beforeMean;
      return { k: r.obs.year - year0, value, row: r };
    })
    .sort((a, b) => a.k - b.k);
}

// ----- placebo-in-time ---------------------------------------------------------------------------------------

/** Fewest usable placebo dates before a placebo comparison is quoted as a number. */
export const PLACEBO_MIN_RUNS = 5;

/** A date moved by whole years; 29 February lands on 28 February in a year that is not a leap year. */
export function shiftDate(date: string, years: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const ny = y + years;
  const leap = (ny % 4 === 0 && ny % 100 !== 0) || ny % 400 === 0;
  const day = m === 2 && d === 29 && !leap ? 28 : d;
  return `${String(ny).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export interface PlaceboRun {
  date: string;
  year0: number;
  /** Last year of the placebo's after window (and transition year); always before the real change. */
  lastYear: number;
  /** Difference in changes against each comparison state, by geo id; null where not computed. */
  diffs: Record<string, number | null>;
  pooled: number | null;
}

export interface PlaceboSummary {
  /** A comparison state's geo id, or "pooled". */
  geo: string;
  /** The real difference in changes. */
  actual: number | null;
  /** The placebo differences in changes, one per usable placebo date. */
  values: number[];
  n: number;
  /** Sample standard deviation of the placebo differences (two or more). */
  sd: number | null;
  /** Median size of a placebo difference: how large a gap is at dates chosen without regard to any law. */
  typical: number | null;
  /** |actual| divided by the typical placebo gap. */
  ratio: number | null;
  /** Share of placebo gaps at least as large as the real one, counting the real one: (1 + k) / (1 + n). */
  share: number | null;
  /** Enough placebo dates (PLACEBO_MIN_RUNS) to quote the share. */
  enough: boolean;
}

export interface PlaceboResult {
  /** Dates tried, going back one year at a time. */
  tried: number;
  runs: PlaceboRun[];
  summaries: PlaceboSummary[];
  pooled: PlaceboSummary | null;
  why: string | null;
}

function summarizePlacebo(geo: string, actual: number | null, values: number[]): PlaceboSummary {
  const n = values.length;
  const abs = values.map(Math.abs).sort((a, b) => a - b);
  const typical = n ? quantileSorted(abs, 0.5) : null;
  const sd = summarize(values)?.sd ?? null;
  const share = actual !== null && n ? (1 + abs.filter((v) => v >= Math.abs(actual) - 1e-12).length) / (1 + n) : null;
  return { geo, actual, values, n, sd, typical, ratio: actual !== null && typical !== null && typical > 0 ? Math.abs(actual) / typical : null, share, enough: n >= PLACEBO_MIN_RUNS };
}

/** Repeat the before-and-after comparison at earlier dates (the real month and day, one to `maxBack` years
 * earlier) whose whole window ends before the real change and uses at least as many years as the real
 * comparison did. If the real "difference in changes" is no larger
 * than the gaps found on those dates, nothing in this comparison separates the change from ordinary
 * movement. Neighbouring placebo windows overlap, so the dates are not independent draws; read the share as
 * a rough guide. With few years of comparable history there are few or no usable dates, and that is
 * reported rather than hidden. */
export function placeboInTime(
  series: { geo: string; rows: ObsRow[] }[],
  spec: ChangeSpec,
  periodKind: string,
  rules: FiscalYearRule[],
  opts: ChangeOptions & { maxBack?: number } = {},
): PlaceboResult {
  const empty = (why: string, tried = 0): PlaceboResult => ({ tried, runs: [], summaries: [], pooled: null, why });
  if (series.length < 2) return empty("needs at least one comparison state");
  const real = analyzeChange(series, spec, periodKind, rules, opts);
  if (!real.computable) return empty(real.whyNot ?? "the real comparison is not computed");
  const firstAffected = real.transitionYear ?? real.year0;
  const needBefore = real.states[0].beforeYears.length;
  const needAfter = real.states[0].afterYears.length;
  const maxBack = opts.maxBack ?? 20;
  const runs: PlaceboRun[] = [];
  let tried = 0;
  for (let k = 1; k <= maxBack; k++) {
    tried += 1;
    const date = shiftDate(spec.date, -k);
    const res = analyzeChange(series, { ...spec, date }, periodKind, rules, opts);
    if (!res.computable) continue;
    const lastYear = Math.max(...res.afterWindow, res.transitionYear ?? -Infinity);
    if (lastYear >= firstAffected) continue;
    // Like for like: a placebo window that has to make do with fewer years than the real comparison used is
    // noisier than the real one, so it would make the real gap look more unusual than it is.
    if (res.states[0].beforeYears.length < needBefore || res.states[0].afterYears.length < needAfter) continue;
    const diffs: Record<string, number | null> = {};
    for (const d of res.diffs) diffs[d.geo] = d.why === null || d.diffChange !== null ? d.diffChange : null;
    runs.push({ date, year0: res.year0, lastYear, diffs, pooled: res.pooled && res.pooled.why === null ? res.pooled.diffChange : null });
  }
  if (!runs.length) {
    return empty(`none of the ${tried} earlier dates has a comparable, complete window that ends before the real change: too little comparable history for a placebo`, tried);
  }
  const summaries = real.diffs.map((d) =>
    summarizePlacebo(
      d.geo,
      d.diffChange,
      runs.map((r) => r.diffs[d.geo]).filter((v): v is number => v !== null && v !== undefined),
    ),
  );
  const pooled = real.pooled && real.pooled.why === null ? summarizePlacebo("pooled", real.pooled.diffChange, runs.map((r) => r.pooled).filter((v): v is number => v !== null)) : null;
  return { tried, runs, summaries, pooled, why: null };
}
