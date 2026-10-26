// Rank intervals: how much a state's rank could move if every state's value is redrawn within its own sampling
// error. A rank from survey estimates (BRFSS, YRBS) looks exact but is not: two states a point apart with
// margins of error of three points can swap places. The interval is the 5th to 95th percentile of a state's rank
// across simulated redraws, each state's value drawn independently from a normal distribution centred on its
// published value with the standard error implied by its published 95% interval (lib/stats.ts seFromInterval).
//
// * States are independent samples, so independent draws are the right model for survey estimates by state.
// * A state without a published interval is held at its value in every draw. Its own rank can still move
//   (other states move around it) but the interval then leaves out its own sampling error, so it is reported
//   with hasSe = false and the reader is told.
// * Rank 1 = highest value; equal values share the best rank (1, 2, 2, 4), as everywhere else in the tool.
// * Descriptive only: an interval says how precisely the ranking is known, not why states differ.

import { hashSeed, mulberry32, stdNormal } from "./stats";

export const RANKS_METHOD = "rank-intervals@1.0";

export interface RankItem {
  id: string;
  value: number;
  /** Standard error of the value, or null when no interval was published. */
  se: number | null;
}

export interface RankInterval {
  id: string;
  /** Rank of the published values. */
  rank: number;
  /** Lower and upper end of the rank interval (best rank first: low <= high). */
  low: number;
  high: number;
  /** Median rank across the draws. */
  median: number;
  /** Whether the interval includes this state's own sampling error. */
  hasSe: boolean;
  /** Share of draws at each rank, index 0 = rank 1. */
  distribution: number[];
}

export interface RankIntervalOptions {
  /** Number of redraws (default 2000). */
  draws?: number;
  /** Seed; by default derived from the items, so the same data always gives the same intervals. */
  seed?: number;
  /** Interval ends as probabilities (defaults 0.05 and 0.95). */
  lower?: number;
  upper?: number;
}

/** Rank of every value, highest first, equal values sharing the best rank. */
export function competitionRanks(values: number[]): number[] {
  const order = values.map((v, i) => [v, i] as const).sort((a, b) => b[0] - a[0]);
  const ranks = new Array<number>(values.length);
  let prev = NaN;
  let prevRank = 0;
  order.forEach(([v, i], pos) => {
    const r = v === prev ? prevRank : pos + 1;
    ranks[i] = r;
    prev = v;
    prevRank = r;
  });
  return ranks;
}

/** Rank intervals for a set of states ranked on one measure. Empty for fewer than two items. */
export function rankIntervals(items: RankItem[], opts: RankIntervalOptions = {}): Map<string, RankInterval> {
  const out = new Map<string, RankInterval>();
  const n = items.length;
  if (n < 2) return out;
  const draws = opts.draws ?? 2000;
  const lower = opts.lower ?? 0.05;
  const upper = opts.upper ?? 0.95;
  const rng = mulberry32(opts.seed ?? hashSeed(JSON.stringify(items)));
  const point = competitionRanks(items.map((x) => x.value));
  const counts = items.map(() => new Array<number>(n).fill(0));
  const drawn = new Array<number>(n);
  for (let d = 0; d < draws; d++) {
    for (let i = 0; i < n; i++) drawn[i] = items[i].se ? items[i].value + items[i].se! * stdNormal(rng) : items[i].value;
    const ranks = competitionRanks(drawn);
    for (let i = 0; i < n; i++) counts[i][ranks[i] - 1] += 1;
  }
  items.forEach((x, i) => {
    const dist = counts[i].map((c) => c / draws);
    let cum = 0;
    let low = n;
    let high = n;
    let median = n;
    let gotLow = false;
    let gotMedian = false;
    for (let r = 0; r < n; r++) {
      cum += dist[r];
      if (!gotLow && cum >= lower - 1e-12) {
        low = r + 1;
        gotLow = true;
      }
      if (!gotMedian && cum >= 0.5 - 1e-12) {
        median = r + 1;
        gotMedian = true;
      }
      if (cum >= upper - 1e-12) {
        high = r + 1;
        break;
      }
    }
    out.set(x.id, { id: x.id, rank: point[i], low, high, median, hasSe: Boolean(x.se), distribution: dist });
  });
  return out;
}

/** "4" when the interval is a single rank, "4 to 11" otherwise. */
export function rankRangeText(low: number, high: number): string {
  return low === high ? String(low) : `${low} to ${high}`;
}
