// Nationwide map: one value per state for one period, ranked, colored and tabled from the same rows, so the
// map, the bars, the table and the download can never disagree. Missing, suppressed and zero stay distinct.

import { rankIntervals } from "./ranks";
import { contrast } from "./stats";

export type CellKind = "value" | "zero" | "missing" | "suppressed" | "not_applicable";

export interface MapCell {
  geo: string;
  value: number | null;
  kind: CellKind;
  why: string | null;
  rec: string | null;
  period: string | null;
  /** Standard error of the value from its published interval, when there is one. */
  se?: number | null;
}

export interface RankedCell extends MapCell {
  /** 1 = highest value; ties share a rank; no rank without a value. */
  rank: number | null;
  /** 5th to 95th percentile of the state's rank when every state's value is redrawn within its sampling error
   * (lib/ranks.ts). Present only for a state whose own value has a published interval. */
  rankLow?: number;
  rankHigh?: number;
}

export function cellKind(value: number | null, missing: string | null): CellKind {
  if (value !== null) return value === 0 ? "zero" : "value";
  if (missing === "suppressed") return "suppressed";
  if (missing === "not_applicable") return "not_applicable";
  return "missing";
}

/** Highest value first; equal values share a rank (1, 2, 2, 4). Cells without a value are listed after,
 * unranked, in name order. */
export function rankCells(cells: MapCell[], name: (geo: string) => string): RankedCell[] {
  const valued = cells.filter((c) => c.value !== null).sort((a, b) => b.value! - a.value! || name(a.geo).localeCompare(name(b.geo)));
  const out: RankedCell[] = [];
  valued.forEach((c, i) => {
    const prev = out[i - 1];
    out.push({ ...c, rank: prev && prev.value === c.value ? prev.rank : i + 1 });
  });
  const rest = cells.filter((c) => c.value === null).sort((a, b) => name(a.geo).localeCompare(name(b.geo)));
  // Rank intervals, when any state has a published interval: simulated from every state's value and standard error.
  if (valued.some((c) => c.se)) {
    const iv = rankIntervals(valued.map((c) => ({ id: c.geo, value: c.value!, se: c.se ?? null })));
    for (const c of out) {
      const r = iv.get(c.geo);
      if (r?.hasSe) {
        c.rankLow = r.low;
        c.rankHigh = r.high;
      }
    }
  }
  return [...out, ...rest.map((c) => ({ ...c, rank: null }))];
}

export interface Domain {
  min: number;
  max: number;
  diverging: boolean;
  /** Set when some values lie beyond the ends: they take the end color and keep their true labels. */
  clipped?: { low: boolean; high: boolean; note: string };
}

/** Linear-interpolated quantile of sorted values. */
export function quantile(sorted: number[], p: number): number {
  const pos = p * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.min(sorted.length - 1, lo + 1);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** At least this many values (several periods' worth) before a fixed scale is trimmed of its extremes. */
export const ROBUST_MIN_VALUES = 100;

/** The color domain. A diverging domain is symmetric around zero, so equal increases and decreases get
 * equal strength of color; otherwise it runs from the lowest to the highest value. With `robust`, a scale
 * shared by many periods stops at the 95th percentile of the size of changes (or the 2nd and 98th
 * percentiles of levels), so a few extreme periods such as spring 2020 and 2021 cannot wash every other
 * map out to white. */
export function domainOf(values: number[], diverging: boolean, robust = false): Domain | null {
  const v = values.filter((x) => Number.isFinite(x));
  if (!v.length) return null;
  const trim = robust && v.length >= ROBUST_MIN_VALUES;
  if (diverging) {
    const abs = v.map(Math.abs).sort((a, b) => a - b);
    const full = abs[abs.length - 1];
    const m = trim ? quantile(abs, 0.95) : full;
    if (trim && m < full && m > 0)
      return {
        min: -m,
        max: m,
        diverging: true,
        clipped: {
          low: v.some((x) => x < -m),
          high: v.some((x) => x > m),
          note: "The scale stops at the 95th percentile of the size of every change in every period, so a few extreme periods do not wash out the rest; larger changes take the end color and their labels show the true value.",
        },
      };
    return { min: -full, max: full, diverging: true };
  }
  const s = [...v].sort((a, b) => a - b);
  const [lo, hi] = trim ? [quantile(s, 0.02), quantile(s, 0.98)] : [s[0], s[s.length - 1]];
  if (trim && (lo > s[0] || hi < s[s.length - 1]) && hi > lo)
    return {
      min: lo,
      max: hi,
      diverging: false,
      clipped: {
        low: lo > s[0],
        high: hi < s[s.length - 1],
        note: "The scale runs from the 2nd to the 98th percentile of every value in every period; values beyond either end take the end color and their labels show the true value.",
      },
    };
  return { min: s[0], max: s[s.length - 1], diverging: false };
}

// Single-hue blue for levels (darker = higher, not better or worse); orange to blue around zero for changes.
const SEQ: [number, number, number][] = [
  [239, 243, 255],
  [8, 48, 107],
];
const NEG: [number, number, number] = [214, 128, 40];
const MID: [number, number, number] = [247, 247, 247];
const POS: [number, number, number] = [30, 84, 148];

const mix = (a: [number, number, number], b: [number, number, number], t: number) =>
  a.map((x, i) => Math.round(x + (b[i] - x) * t)) as [number, number, number];
const hex = (c: [number, number, number]) => `#${c.map((x) => x.toString(16).padStart(2, "0")).join("")}`;

/** Position of a value on the domain, 0..1 (clamped). */
export function position(value: number, d: Domain): number {
  if (d.max === d.min) return 0.5;
  return Math.min(1, Math.max(0, (value - d.min) / (d.max - d.min)));
}

export function colorFor(value: number, d: Domain): string {
  const t = position(value, d);
  if (!d.diverging) return hex(mix(SEQ[0], SEQ[1], t));
  return t < 0.5 ? hex(mix(NEG, MID, t / 0.5)) : hex(mix(MID, POS, (t - 0.5) / 0.5));
}

/** Black or white label text, whichever contrasts more with the fill. */
export function inkFor(fill: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(fill.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return (l + 0.05) / 0.05 > 1.05 / (l + 0.05) ? "#111111" : "#ffffff";
}

export function gradientStops(d: Domain, n = 9): { offset: number; color: string }[] {
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    return { offset: t, color: colorFor(d.min + t * (d.max - d.min), d) };
  });
}

/** A one-year change at least this large (either way) is flagged on a change map. */
export const JUMP_PCT = 50;

export interface Jump {
  from: string;
  to: string;
  pct: number;
}

/** The largest change between consecutive periods inside [base, current], when it is at least JUMP_PCT.
 * A change map hides how it got from one end to the other; a jump this large often reflects a change in
 * what the source counts (Census T10 for Utah falls 84% in FY2018), so the map flags it rather than
 * presenting the span as a trend. Gaps break the chain: only adjacent periods that both have a value count.
 *
 * Where both values carry a standard error (a survey share, or deaths with a count-noise interval), a move
 * that stays inside what chance produces is not flagged: a state with 30 deaths a year swings by half from
 * one year to the next without anything in the source changing, and calling that a break would send the
 * reader to look for one. The test is the gap against sqrt(se_a^2 + se_b^2) at 95%. A value without an
 * error is flagged as before, because nothing says how large chance is for it. */
export function largestJump(points: { period: string; value: number | null; se?: number | null }[], base: string, current: string): Jump | null {
  const ps = points.filter((p) => p.period >= base && p.period <= current).sort((a, b) => (a.period < b.period ? -1 : 1));
  let best: Jump | null = null;
  for (let i = 1; i < ps.length; i++) {
    const a = ps[i - 1].value;
    const b = ps[i].value;
    if (a === null || b === null || a <= 0) continue;
    const pct = (100 * (b - a)) / a;
    if (Math.abs(pct) < JUMP_PCT) continue;
    if (jumpWithinNoise(ps[i - 1], ps[i])) continue;
    if (!best || Math.abs(pct) > Math.abs(best.pct)) best = { from: ps[i - 1].period, to: ps[i].period, pct };
  }
  return best;
}

/** True when both points have an error and the gap between them is not larger than chance (two-sided, 95%). */
export function jumpWithinNoise(a: { value: number | null; se?: number | null }, b: { value: number | null; se?: number | null }): boolean {
  if (a.value === null || b.value === null || !a.se || !b.se) return false;
  return contrast({ value: b.value, se: b.se }, { value: a.value, se: a.se }).verdict === "within_noise";
}

/** Percent change between two values of one state, only where it means something. */
export function changeBetween(base: number | null, current: number | null): { value: number | null; why: string | null } {
  if (base === null || current === null) return { value: null, why: base === null ? "no value in the base period" : "no value in this period" };
  if (base === 0) return { value: null, why: "the base value is zero, so a percent change is undefined" };
  if (base < 0) return { value: null, why: "the base value is negative" };
  return { value: (100 * (current - base)) / base, why: null };
}
