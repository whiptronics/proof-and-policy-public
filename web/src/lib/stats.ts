// Small, dependency-free statistics helpers shared by the descriptive tools (Before & after, Compare,
// Utah at a glance, the revenue scenarios). Method version STATS_METHOD. Nothing here estimates a policy
// effect: these functions say how large sampling noise is, never why a number moved.
//
// Randomness is seeded. The same inputs and seed always give the same simulated numbers, so a figure on
// screen can be reproduced.

export const STATS_METHOD = "stats-helpers@1.1";

// ----- the normal distribution ---------------------------------------------------------------------------

/** Complementary error function, fractional error below 1.2e-7 (Numerical Recipes, erfcc). */
function erfc(x: number): number {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r =
    t *
    Math.exp(
      -z * z -
        1.26551223 +
        t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
    );
  return x >= 0 ? r : 2 - r;
}

/** P(Z <= x) for a standard normal Z. */
export function normalCdf(x: number): number {
  return 0.5 * erfc(-x / Math.SQRT2);
}

/** Two-sided p-value of a z statistic: P(|Z| >= |z|). */
export function twoSidedP(z: number): number {
  return erfc(Math.abs(z) / Math.SQRT2);
}

const A = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
const B = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
const C = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
const D = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];

/** The z with P(Z <= z) = p (Acklam's rational approximation, relative error about 1e-9). */
export function normalQuantile(p: number): number {
  if (!(p > 0 && p < 1)) return p === 0 ? -Infinity : p === 1 ? Infinity : NaN;
  const low = 0.02425;
  if (p < low) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((C[0] * q + C[1]) * q + C[2]) * q + C[3]) * q + C[4]) * q + C[5]) / ((((D[0] * q + D[1]) * q + D[2]) * q + D[3]) * q + 1);
  }
  if (p > 1 - low) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((C[0] * q + C[1]) * q + C[2]) * q + C[3]) * q + C[4]) * q + C[5]) / ((((D[0] * q + D[1]) * q + D[2]) * q + D[3]) * q + 1);
  }
  const q = p - 0.5;
  const r = q * q;
  return ((((((A[0] * r + A[1]) * r + A[2]) * r + A[3]) * r + A[4]) * r + A[5]) * q) / (((((B[0] * r + B[1]) * r + B[2]) * r + B[3]) * r + B[4]) * r + 1);
}

/** The z that bounds a two-sided interval of the given confidence level (1.96 for 0.95). */
export function zForLevel(level: number): number {
  return normalQuantile(0.5 + level / 2);
}

// ----- Student's t ---------------------------------------------------------------------------------------

const T95: [number, number][] = [
  [1, 12.706], [2, 4.303], [3, 3.182], [4, 2.776], [5, 2.571], [6, 2.447], [7, 2.365], [8, 2.306], [9, 2.262], [10, 2.228],
  [11, 2.201], [12, 2.179], [13, 2.16], [14, 2.145], [15, 2.131], [16, 2.12], [17, 2.11], [18, 2.101], [19, 2.093], [20, 2.086],
  [21, 2.08], [22, 2.074], [23, 2.069], [24, 2.064], [25, 2.06], [26, 2.056], [27, 2.052], [28, 2.048], [29, 2.045], [30, 2.042],
  [40, 2.021], [60, 2.0], [120, 1.98],
];

/** Two-sided 95% critical value of Student's t with `df` degrees of freedom (fractional df interpolate).
 * Null with less than one degree of freedom, where no interval can be formed. */
export function tCritical95(df: number): number | null {
  if (!Number.isFinite(df)) return 1.96;
  if (df < 1) return null;
  if (df >= 120) return 1.96 + (1.98 - 1.96) * (120 / df);
  for (let i = 0; i < T95.length - 1; i++) {
    const [d0, t0] = T95[i];
    const [d1, t1] = T95[i + 1];
    if (df >= d0 && df <= d1) {
      // linear in 1/df between table rows, which is how t shrinks toward the normal value
      const w = (1 / df - 1 / d1) / (1 / d0 - 1 / d1);
      return t1 + (t0 - t1) * w;
    }
  }
  return 1.96;
}

// ----- uncertainty carried by published intervals --------------------------------------------------------

const finite = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);

/** Standard error implied by a published confidence interval, for a normal approximation.
 *
 * With the estimate given and inside the interval, the larger of its two one-sided distances over the interval's
 * z; otherwise half the width over z. Most BRFSS and YRBS intervals are symmetric to within a few percent, so the
 * two agree; the CDC medians (binge frequency, intensity) and death rates from small counts are not, and there
 * the larger side is the cautious choice: it never makes a gap look more certain than either side of the published
 * interval allows. A missing level is read as 95%, the level the CDC sources publish. Null when either limit is
 * missing or the limits are reversed.
 *
 * Using the result assumes the estimate is roughly normal at that scale, and that estimates combined with it are
 * independent: separate annual survey samples, separate states, separate years of deaths. No source in the
 * dataset publishes a covariance between years or states, so none can be used. */
export function seFromInterval(
  low: number | null | undefined,
  high: number | null | undefined,
  level: number | null | undefined = 0.95,
  value?: number | null,
): number | null {
  if (!finite(low) || !finite(high) || high < low) return null;
  const lv = finite(level) && level > 0 && level < 1 ? level : 0.95;
  const z = zForLevel(lv);
  if (finite(value) && value >= low && value <= high) return Math.max(high - value, value - low) / z;
  return (high - low) / (2 * z);
}

/** What a value's published interval describes, from its estimate type and comparability group. */
export type IntervalKind = "sampling" | "count" | "source";

export function intervalKind(o: { estimate_type?: string | null; comparability_group?: string | null }): IntervalKind {
  if (o.estimate_type === "survey_estimate") return "sampling";
  const g = o.comparability_group ?? "";
  if (g.startsWith("fars|") || g.startsWith("derived|fars_")) return "count";
  return "source";
}

/** A short phrase for what an interval covers: "sampling error", "chance variation in the count", or the source's own interval. */
export function intervalPhrase(kind: IntervalKind): string {
  return kind === "sampling" ? "sampling error" : kind === "count" ? "chance variation in the yearly count" : "the source's published interval";
}

/** Standard error of the mean of independent estimates (annual surveys are independent samples):
 * sqrt(sum of squared errors) / n. Null when any one has no error. */
export function seOfMean(ses: (number | null)[]): number | null {
  if (!ses.length || ses.some((s) => !finite(s))) return null;
  return Math.sqrt((ses as number[]).reduce((a, s) => a + s * s, 0)) / ses.length;
}

/** Standard error of a sum or difference of independent estimates. */
export function seOfSum(ses: (number | null)[]): number | null {
  if (!ses.length || ses.some((s) => !finite(s))) return null;
  return Math.sqrt((ses as number[]).reduce((a, s) => a + s * s, 0));
}

export interface Estimate {
  value: number;
  se: number | null;
}

export type Verdict = "differs" | "within_noise" | "unknown";

export interface Contrast {
  diff: number;
  se: number | null;
  z: number | null;
  p: number | null;
  interval: [number, number] | null;
  /** "differs": the gap is larger than sampling noise usually produces (two-sided test at 1 - level).
   * "within_noise": it is not. "unknown": at least one estimate has no published uncertainty. */
  verdict: Verdict;
}

/** a - b with a z test of the gap. Overlapping intervals are not a test; this is: the standard error of a
 * difference of independent estimates is sqrt(se_a^2 + se_b^2), smaller than the two intervals' combined
 * half-widths, so intervals can overlap while the gap is still real. */
export function contrast(a: Estimate, b: Estimate, level = 0.95): Contrast {
  const diff = a.value - b.value;
  if (!finite(a.se) || !finite(b.se)) return { diff, se: null, z: null, p: null, interval: null, verdict: "unknown" };
  const se = Math.sqrt(a.se * a.se + b.se * b.se);
  if (se === 0) return { diff, se, z: null, p: diff === 0 ? 1 : 0, interval: [diff, diff], verdict: diff === 0 ? "within_noise" : "differs" };
  const z = diff / se;
  const p = twoSidedP(z);
  const h = zForLevel(level) * se;
  return { diff, se, z, p, interval: [diff - h, diff + h], verdict: p < 1 - level ? "differs" : "within_noise" };
}

export interface PairContrast<T> {
  a: T;
  b: T;
  contrast: Contrast;
}

/** Every pair among the estimates, each tested on its own gap (no multiple-comparison correction: with k
 * estimates there are k(k-1)/2 pairs, so a few "differs" among many pairs can arise by chance). */
export function pairwiseContrasts<T extends Estimate>(items: T[], level = 0.95): PairContrast<T>[] {
  const out: PairContrast<T>[] = [];
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) out.push({ a: items[i], b: items[j], contrast: contrast(items[i], items[j], level) });
  return out;
}

// ----- least squares line ----------------------------------------------------------------------------------

export interface LineFit {
  n: number;
  slope: number;
  intercept: number;
  /** Standard error of the slope; null with fewer than three points (no residual degrees of freedom). */
  se: number | null;
  /** Residual degrees of freedom, n - 2. */
  df: number;
  rss: number;
  xbar: number;
}

/** Ordinary least squares of y on x. Null with fewer than two points or no spread in x. */
export function olsLine(points: { x: number; y: number }[]): LineFit | null {
  const n = points.length;
  if (n < 2) return null;
  const xbar = points.reduce((a, p) => a + p.x, 0) / n;
  const ybar = points.reduce((a, p) => a + p.y, 0) / n;
  let sxx = 0;
  let sxy = 0;
  for (const p of points) {
    sxx += (p.x - xbar) ** 2;
    sxy += (p.x - xbar) * (p.y - ybar);
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  const intercept = ybar - slope * xbar;
  let rss = 0;
  for (const p of points) rss += (p.y - (intercept + slope * p.x)) ** 2;
  const df = n - 2;
  const se = df >= 1 ? Math.sqrt(rss / df / sxx) : null;
  return { n, slope, intercept, se, df, rss, xbar };
}

/** 95% interval for a fitted slope; null where the fit has no standard error. */
export function slopeInterval95(fit: LineFit): [number, number] | null {
  const t = tCritical95(fit.df);
  if (fit.se === null || t === null) return null;
  return [fit.slope - t * fit.se, fit.slope + t * fit.se];
}

// ----- seeded randomness and summaries ---------------------------------------------------------------------

/** A small, fast, seeded generator (mulberry32): uniform draws in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A 32-bit seed from text (FNV-1a), so a simulation can be seeded by its own inputs. */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A standard normal draw (Box-Muller) from a uniform generator. */
export function stdNormal(rng: () => number): number {
  const u1 = 1 - rng(); // (0, 1]
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** Linear-interpolated quantile of sorted values. */
export function quantileSorted(sorted: number[], p: number): number {
  if (!sorted.length) return NaN;
  const pos = p * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.min(sorted.length - 1, lo + 1);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export interface Summary {
  n: number;
  mean: number;
  sd: number | null;
  min: number;
  p05: number;
  p10: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
  p95: number;
  max: number;
}

/** Mean, sample standard deviation and quantiles. Null for no values. */
export function summarize(values: number[]): Summary | null {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  const n = v.length;
  if (!n) return null;
  const mean = v.reduce((a, x) => a + x, 0) / n;
  const sd = n > 1 ? Math.sqrt(v.reduce((a, x) => a + (x - mean) ** 2, 0) / (n - 1)) : null;
  const q = (p: number) => quantileSorted(v, p);
  return { n, mean, sd, min: v[0], p05: q(0.05), p10: q(0.1), p25: q(0.25), median: q(0.5), p75: q(0.75), p90: q(0.9), p95: q(0.95), max: v[n - 1] };
}

// ----- small linear algebra -------------------------------------------------------------------------------

/** Lower-triangular Cholesky factor L (A = L L') of a symmetric positive definite matrix, or null when A is not positive definite. */
export function cholesky(A: number[][]): number[][] | null {
  const k = A.length;
  const L = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  for (let i = 0; i < k; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = A[i][j];
      for (let t = 0; t < j; t++) sum -= L[i][t] * L[j][t];
      if (i === j) {
        if (!(sum > 1e-12)) return null;
        L[i][i] = Math.sqrt(sum);
      } else L[i][j] = sum / L[j][j];
    }
  }
  return L;
}

/** Solve L y = b for lower-triangular L (forward substitution). The squared length of y is b' A^-1 b when A = L L'. */
export function forwardSolve(L: number[][], b: number[]): number[] {
  const y = new Array<number>(b.length).fill(0);
  for (let i = 0; i < b.length; i++) {
    let sum = b[i];
    for (let j = 0; j < i; j++) sum -= L[i][j] * y[j];
    y[i] = sum / L[i][i];
  }
  return y;
}
