// Uncertainty for the Utah wine scenario model (lib/scenario.ts): documented per-input ranges, a one-at-a-time
// sensitivity table, and two combined sensitivity scenarios (every input at the end of its range that lowers the
// result, and every input at the end that raises it).
//
// A range is a low and a high value around the reader's entered value. Every range carries its basis. Only the
// price elasticity has a published source; the rest are conventions, said to be conventions wherever they appear,
// because no source in the dataset measures them. A range can be replaced by evidence (RangeOverrides), for
// example the span the dataset can bound.
//
// What is shown, and why (method 1.1). The dashboard reports sensitivity scenarios, not probabilities. The library
// still has a seeded Monte Carlo (monteCarlo below) that reads each range's ends as its 10th and 90th percentiles
// and draws through a Gaussian copula with stated correlations. It is not shown: with one range resting on a
// published source and the distributions, percentiles and correlations all conventions, the spread it produces
// and the share of runs above zero would read as probabilities that nothing supports. Use it only once the ranges
// and their dependence rest on evidence.

import { compute, effectivePrice, usesGallons, type ScenarioInputs } from "./scenario";
import { cholesky, hashSeed, mulberry32, normalCdf, normalQuantile, stdNormal, summarize } from "./stats";

export const RANGES_METHOD = "scenario-ranges@1.2";

/** Inputs that can be varied. "volume" and "pricePerGallon" split baseline sales into gallons and the average price per gallon. */
export type RangeKey =
  | "grossMargin"
  | "shift"
  | "eligible"
  | "salesTax"
  | "avoidableCost"
  | "retained"
  | "discount"
  | "adValorem"
  | "extraGrocery"
  | "replaces"
  | "wineSales"
  | "volume"
  | "pricePerGallon"
  | "priceRatio"
  | "passThrough"
  | "excise"
  | "growth"
  | "recapture"
  | "elasticity"
  | "newCosts"
  | "beerPrice"
  | "beerTax"
  | "wineAbv"
  | "beerAbv";

export type RangeFormat = "percent" | "money" | "money2" | "gallons" | "plain";
export type Evidence = "published" | "data" | "convention";

export interface RangeSpec {
  label: string;
  /** abs: entered value plus or minus `half`; rel: entered value divided or multiplied by 1 + `half` (never crosses zero). */
  kind: "abs" | "rel";
  half: number;
  /** Hard limits of the input itself. */
  min?: number;
  max?: number;
  format: RangeFormat;
  evidence: Evidence;
  basis: string;
}

const SHARE = { min: 0, max: 1, format: "percent" as const };
const CONV = "convention" as const;

export const SENSITIVITY_RANGES: Record<RangeKey, RangeSpec> = {
  grossMargin: { label: "Gross margin on wine", kind: "abs", half: 0.1, ...SHARE, evidence: CONV, basis: "±10 points, a convention: the margin used is DABS's all-product figure, and nothing in the dataset bounds how far wine's own margin differs from it." },
  shift: { label: "Share moving to grocery stores", kind: "abs", half: 0.1, ...SHARE, evidence: CONV, basis: "±10 points, a convention: no source in the dataset measures how much wine buying would move." },
  eligible: {
    label: "Household share of wine sales (could move to grocers)",
    kind: "abs",
    half: 0.15,
    ...SHARE,
    evidence: CONV,
    basis: "±15 points, a convention. DABS's FY2025 report puts off-premise sales (stores and agencies) at 82% of all its sales and on-premise (licensees) at 18%, all products; wine's split by customer type is not published, and restaurants may buy a larger or smaller share of wine than of spirits.",
  },
  salesTax: { label: "State sales tax rate", kind: "abs", half: 0.01, ...SHARE, evidence: CONV, basis: "±1 point, a convention sized to a rate of a few percent (a ±10 point range would put a 5% rate at 15%). The rate is an input, not a measurement; this shows what an adjacent rate would do." },
  avoidableCost: { label: "Avoidable operating cost", kind: "abs", half: 0.05, ...SHARE, evidence: CONV, basis: "±5 points of sales, a convention: stores, systems and staff do not all shrink with sales. Replace it with a measured interval when one is available." },
  retained: { label: "Share of grocery sales the state keeps", kind: "abs", half: 0.1, ...SHARE, evidence: CONV, basis: "±10 points, a convention: the share is a policy choice the reader states." },
  discount: { label: "Discount DABS gives grocers", kind: "abs", half: 0.05, ...SHARE, evidence: CONV, basis: "±5 points, a convention: the discount is a term of the policy the reader states." },
  adValorem: { label: "Tax on the grocery shelf price", kind: "abs", half: 0.02, ...SHARE, evidence: CONV, basis: "±2 points, a convention sized to a tax of a few percent." },
  extraGrocery: { label: "Share of extra wine bought in grocery stores", kind: "abs", half: 0.1, ...SHARE, evidence: CONV, basis: "±10 points, a convention." },
  replaces: { label: "Share of extra wine replacing beer", kind: "abs", half: 0.1, ...SHARE, evidence: CONV, basis: "±10 points, a convention: nothing in the dataset measures substitution between wine and beer." },
  wineSales: { label: "Baseline wine sales", kind: "rel", half: 0.25, format: "money", evidence: CONV, basis: "÷ or × 1.25, a convention: wine sales are reached through an assumed share of liquor sales or an assumed price per gallon, so their error is mostly that assumption's." },
  volume: { label: "Wine volume (sales and gallons together, price held)", kind: "rel", half: 0.15, format: "gallons", evidence: CONV, basis: "÷ or × 1.15, a convention. Sales and gallons move together so the implied price per gallon does not change by accident." },
  pricePerGallon: { label: "Average price per gallon (sales vary, gallons held)", kind: "rel", half: 0.15, format: "money2", evidence: CONV, basis: "÷ or × 1.15, a convention. Gallons stay fixed, so sales move with the price." },
  priceRatio: { label: "Grocery price compared with the state store", kind: "rel", half: 0.1, format: "percent", evidence: CONV, basis: "÷ or × 1.10, a convention: the grocery price is the reader's assumption, and ten percent either way is a large difference in a shelf price." },
  passThrough: { label: "Pass-through of the price gap to the shelf", kind: "abs", half: 0.25, min: 0, max: 2, format: "percent", evidence: CONV, basis: "±25 points, a convention: how much of a change in the state's markup or tax reaches shelf prices is uncertain and varies by market." },
  excise: { label: "Excise per gallon", kind: "rel", half: 0.25, format: "money2", evidence: CONV, basis: "÷ or × 1.25, a convention: the excise is a policy choice the reader states." },
  growth: { label: "Increase in total wine purchases", kind: "rel", half: 0.5, format: "percent", evidence: CONV, basis: "÷ or × 1.5, a convention: the effect of easier access on total purchases is the least certain input here." },
  recapture: { label: "Cross-border recapture", kind: "rel", half: 0.5, format: "percent", evidence: CONV, basis: "÷ or × 1.5, a convention: nothing in the dataset measures purchases made across state lines." },
  elasticity: {
    label: "Price elasticity of wine demand",
    kind: "abs",
    half: 0.15,
    min: -5,
    max: 0,
    format: "plain",
    evidence: "published",
    basis: "±0.15 around the entered value. Nelson (2013, Health Economics Review 3:17), a meta-analysis: wine −0.46 after correcting for publication bias (95% CI −0.54 to −0.38; the abstract rounds it to −0.45); the uncorrected random-effects mean is −0.58. Around −0.46 the range (−0.61 to −0.31) covers the corrected interval and reaches past the uncorrected mean. The source is published; the ±0.15 width is a convention.",
  },
  newCosts: { label: "New state costs", kind: "rel", half: 0.5, format: "money", evidence: CONV, basis: "÷ or × 1.5, a convention: the cost of a new licensing and enforcement program is poorly known in advance." },
  beerPrice: { label: "Beer price per gallon", kind: "rel", half: 0.2, format: "money2", evidence: CONV, basis: "÷ or × 1.20, a convention." },
  beerTax: { label: "Beer excise per barrel", kind: "rel", half: 0.1, format: "money2", evidence: CONV, basis: "÷ or × 1.10, a convention. The coded rate is a fact; the range only shows how much a different rate would matter." },
  wineAbv: { label: "Wine alcohol content", kind: "abs", half: 0.01, min: 0.005, max: 0.99, format: "percent", evidence: CONV, basis: "±1 point, a convention: the national average ABV hides a spread across wines." },
  beerAbv: { label: "Beer alcohol content", kind: "abs", half: 0.005, min: 0.005, max: 0.99, format: "percent", evidence: CONV, basis: "±0.5 point, a convention: the national average ABV hides a spread across beers." },
};

/** Replace a range with bounds from data: its low and high ends, with an optional note on where they come from. (Only the
 * unshown Monte Carlo reads the ends as 10th and 90th percentiles.) */
export type RangeOverrides = Partial<Record<RangeKey, { low: number; high: number; basis?: string }>>;

/** Which pairs of inputs move together in the simulation, with the correlation of their underlying normals. */
export type Correlation = [RangeKey, RangeKey, number];

/** A cheaper grocery price goes with a bigger shift, and a bigger shift with a bigger access effect. Conventions. */
export const DEFAULT_CORRELATIONS: Correlation[] = [
  ["priceRatio", "shift", -0.5],
  ["shift", "growth", 0.3],
];

// ----- reading and writing one input of a scenario ---------------------------------------------------------

/** The entered value of an input, or null when it has none. */
export function levelOf(x: ScenarioInputs, key: RangeKey): number | null {
  if (key === "volume") return x.wineGallons;
  if (key === "pricePerGallon") return x.wineSales !== null && x.wineGallons ? x.wineSales / x.wineGallons : null;
  const v = x[key as keyof ScenarioInputs];
  return typeof v === "number" ? v : null;
}

/** A copy of the scenario with one input set. "volume" scales sales with gallons; "pricePerGallon" sets sales from gallons. */
export function withLevel(x: ScenarioInputs, key: RangeKey, v: number): ScenarioInputs {
  if (key === "volume") {
    const g = x.wineGallons;
    return g ? { ...x, wineGallons: v, wineSales: (x.wineSales ?? 0) * (v / g) } : x;
  }
  if (key === "pricePerGallon") return { ...x, wineSales: v * (x.wineGallons ?? 0) };
  return { ...x, [key]: v };
}

const B_ONLY: RangeKey[] = ["growth", "extraGrocery", "recapture", "elasticity", "replaces", "beerPrice", "beerTax", "wineAbv", "beerAbv"];

/** Whether an input matters for this configuration (and for the scenario asked about). */
export function isRelevant(x: ScenarioInputs, key: RangeKey, which: "A" | "B"): boolean {
  if (which === "A" && B_ONLY.includes(key)) return false;
  const bOn = x.extra;
  const r = effectivePrice(x);
  switch (key) {
    case "retained":
      return x.revenueMode === "keep" || x.revenueMode === "combo";
    case "excise":
      return x.revenueMode === "excise" || x.revenueMode === "combo";
    case "adValorem":
      return x.revenueMode === "percent" || x.revenueMode === "combo";
    case "discount":
      return x.revenueMode === "wholesale";
    case "growth":
    case "extraGrocery":
      return bOn;
    case "recapture":
      return bOn && (x.recapture ?? 0) > 0;
    case "elasticity":
      // The shelf price the response applies to includes any replacement tax that reaches it (scenario 1.3).
      return bOn && typeof x.elasticity === "number" && x.elasticity !== 0 && (compute(x).priceRatioUsed ?? r) !== 1;
    case "replaces":
    case "beerPrice":
    case "beerTax":
      return bOn && x.substitution;
    case "wineAbv":
    case "beerAbv":
      return bOn && x.substitution && x.basis === "ethanol";
    case "passThrough":
      return !x.matchPrice && typeof x.passThrough === "number" && x.priceRatio !== 1;
    case "priceRatio":
      return !x.matchPrice;
    case "wineSales":
      return !usesGallons(x) || !x.wineGallons;
    case "volume":
    case "pricePerGallon":
      return usesGallons(x) && Boolean(x.wineGallons);
    default:
      return true;
  }
}

const ALL_KEYS = Object.keys(SENSITIVITY_RANGES) as RangeKey[];

/** The inputs that vary for this configuration, in a fixed order (volume before price per gallon). */
export function activeKeys(x: ScenarioInputs, which: "A" | "B"): RangeKey[] {
  return ALL_KEYS.filter((k) => isRelevant(x, k, which)).filter((k) => {
    const v = levelOf(x, k);
    if (v === null) return false;
    // A relative range on zero is still zero (nothing to vary); an absolute range on an entered zero is real.
    return SENSITIVITY_RANGES[k].kind === "abs" || v > 0;
  });
}

// ----- ranges ----------------------------------------------------------------------------------------------

export interface Range {
  key: RangeKey;
  label: string;
  /** Low and high end of the range before cutting at the input's limits. */
  rawLow: number;
  rawHigh: number;
  /** The same, cut at the input's limits (what the sensitivity table shows). */
  low: number;
  high: number;
  format: RangeFormat;
  evidence: Evidence;
  basis: string;
}

/** The range for one input of a scenario, or null when the input has no entered value to vary. */
export function rangeFor(x: ScenarioInputs, key: RangeKey, overrides: RangeOverrides = {}): Range | null {
  const v = levelOf(x, key);
  const spec = SENSITIVITY_RANGES[key];
  if (v === null) return null;
  const ov = overrides[key];
  let rawLow: number;
  let rawHigh: number;
  let evidence = spec.evidence;
  let basis = spec.basis;
  if (ov) {
    rawLow = Math.min(ov.low, ov.high);
    rawHigh = Math.max(ov.low, ov.high);
    evidence = "data";
    basis = ov.basis ?? "Replaced by an interval supplied from data.";
  } else if (spec.kind === "abs") {
    rawLow = v - spec.half;
    rawHigh = v + spec.half;
  } else {
    if (v <= 0) return null;
    rawLow = v / (1 + spec.half);
    rawHigh = v * (1 + spec.half);
  }
  const cut = (y: number) => Math.min(spec.max ?? Infinity, Math.max(spec.min ?? -Infinity, y));
  return { key, label: spec.label, rawLow, rawHigh, low: cut(rawLow), high: cut(rawHigh), format: spec.format, evidence, basis };
}

// ----- one at a time sensitivity ---------------------------------------------------------------------------

export interface Sensitivity {
  input: RangeKey;
  label: string;
  low: number;
  high: number;
  netLow: number;
  netHigh: number;
  swing: number;
  /** Where the net change crosses zero as this input alone moves, other inputs held: inside its range, outside it
   * (within the input's possible values), or never. */
  zero: { value: number; inRange: boolean } | null;
  format: RangeFormat;
  evidence: Evidence;
  basis: string;
}

/** The values an input can take when searching for the point where the net change is zero. */
function domainOf(x: ScenarioInputs, key: RangeKey): [number, number] | null {
  const spec = SENSITIVITY_RANGES[key];
  const v = levelOf(x, key);
  if (v === null) return null;
  // Shares and other bounded inputs: every value they can take. Amounts and ratios: four range-widths either side, so
  // a crossing is reported only where the input stays within reach of the value entered (a grocery price four times
  // the state store's is not a scenario anyone states).
  const reach = Math.pow(1 + spec.half, 4);
  const lo = spec.min ?? (spec.kind === "rel" ? v / reach : v - 4 * spec.half);
  const hi = spec.max ?? (spec.kind === "rel" ? v * reach : v + 4 * spec.half);
  return [lo, hi];
}

/** A value of one input at which the net change is zero, searched between two points where it has opposite signs. */
function bisect(f: (v: number) => number, a: number, b: number): number | null {
  let fa = f(a);
  const fb = f(b);
  if (!Number.isFinite(fa) || !Number.isFinite(fb) || fa === 0 || fb === 0 || Math.sign(fa) === Math.sign(fb)) return fa === 0 ? a : fb === 0 ? b : null;
  for (let i = 0; i < 200 && Math.abs(b - a) > 1e-12 * Math.max(1, Math.abs(a)); i++) {
    const mid = (a + b) / 2;
    const fm = f(mid);
    if (!Number.isFinite(fm)) return null;
    if (Math.sign(fm) === Math.sign(fa)) {
      a = mid;
      fa = fm;
    } else b = mid;
  }
  return (a + b) / 2;
}

/** Where the net change of scenario A or B reaches zero as one input moves from its entered value, others held. The
 * search runs from the entered value towards each end of the input's possible values (amounts and ratios: four
 * range-widths either side) and keeps the nearest crossing. */
export function zeroCrossing(x: ScenarioInputs, key: RangeKey, which: "A" | "B", range: { low: number; high: number }): { value: number; inRange: boolean } | null {
  const dom = domainOf(x, key);
  const v = levelOf(x, key);
  if (!dom || v === null) return null;
  const f = (y: number) => {
    const c = compute(withLevel(x, key, y));
    if (c.missing.length || c.invalid.length) return NaN;
    return which === "A" ? c.netA : (c.netB ?? c.netA);
  };
  const hits = [bisect(f, v, dom[0]), bisect(f, v, dom[1])].filter((z): z is number => z !== null && z !== v);
  if (!hits.length) return null;
  const z = hits.sort((p, q) => Math.abs(p - v) - Math.abs(q - v))[0];
  const tol = 1e-9 * Math.max(1, Math.abs(z));
  return { value: z, inRange: z >= range.low - tol && z <= range.high + tol };
}

/** One input at a time moved to the low and high end of its documented range, others held; largest swing first. */
export function sensitivity(x: ScenarioInputs, which: "A" | "B", overrides: RangeOverrides = {}): Sensitivity[] {
  const base = compute(x);
  if (base.missing.length || base.invalid.length) return [];
  const net = (y: ScenarioInputs) => {
    const c = compute(y);
    if (c.missing.length || c.invalid.length) return NaN;
    return which === "A" ? c.netA : (c.netB ?? c.netA);
  };
  const out: Sensitivity[] = [];
  for (const key of activeKeys(x, which)) {
    const r = rangeFor(x, key, overrides);
    if (!r) continue;
    const netLow = net(withLevel(x, key, r.low));
    const netHigh = net(withLevel(x, key, r.high));
    if (!Number.isFinite(netLow) || !Number.isFinite(netHigh)) continue;
    const zero = zeroCrossing(x, key, which, r);
    out.push({ input: key, label: r.label, low: r.low, high: r.high, netLow, netHigh, swing: Math.abs(netHigh - netLow), zero, format: r.format, evidence: r.evidence, basis: r.basis });
  }
  return out.sort((p, q) => q.swing - p.swing);
}

// ----- combined sensitivity scenarios ---------------------------------------------------------------------

export interface Combined {
  /** Net change with every varied input at the end of its range that lowers the result (one-at-a-time direction). */
  low: { net: number; settings: { key: RangeKey; label: string; value: number; format: RangeFormat }[] };
  /** The same at the ends that raise it. */
  high: { net: number; settings: { key: RangeKey; label: string; value: number; format: RangeFormat }[] };
}

/** Every varied input at once at the end of its range that lowers (low) or raises (high) the net change, the direction
 * taken from the one-at-a-time table. A deliberately extreme pair of scenarios that brackets the one-at-a-time
 * results, not a likely outcome and not a probability interval. Inputs whose two ends give the same result stay at
 * their entered values. Null when the scenario is incomplete. */
export function combinedScenarios(x: ScenarioInputs, which: "A" | "B", overrides: RangeOverrides = {}): Combined | null {
  const sens = sensitivity(x, which, overrides);
  const base = compute(x);
  if (base.missing.length || base.invalid.length) return null;
  const net = (y: ScenarioInputs) => {
    const c = compute(y);
    if (c.missing.length || c.invalid.length) return NaN;
    return which === "A" ? c.netA : (c.netB ?? c.netA);
  };
  // Keep the fixed key order of activeKeys (volume before price per gallon) when setting several inputs.
  const order = activeKeys(x, which);
  const sorted = [...sens].sort((p, q) => order.indexOf(p.input) - order.indexOf(q.input));
  const build = (pickLow: (s: Sensitivity) => boolean) => {
    let y = x;
    const settings: Combined["low"]["settings"] = [];
    for (const s of sorted) {
      if (s.netLow === s.netHigh) continue;
      const v = pickLow(s) ? s.low : s.high;
      y = withLevel(y, s.input, v);
      settings.push({ key: s.input, label: s.label, value: v, format: s.format });
    }
    return { net: net(y), settings };
  };
  const low = build((s) => s.netLow < s.netHigh);
  const high = build((s) => s.netLow > s.netHigh);
  if (!Number.isFinite(low.net) || !Number.isFinite(high.net)) return null;
  return { low, high };
}

// ----- Monte Carlo (not shown in the dashboard; see the header) --------------------------------------------

const Z80 = normalQuantile(0.9); // 1.2816: the 90th percentile of a standard normal

export interface McOptions {
  /** Number of draws (default 5000). */
  runs?: number;
  /** Seed; by default derived from the inputs, so the same scenario always gives the same answer. */
  seed?: number;
  ranges?: RangeOverrides;
  correlations?: Correlation[];
  /** Multiplies every range's width (1 = as documented, 0 = no uncertainty). */
  scale?: number;
}

interface Marginal {
  key: RangeKey;
  value: number;
  centre: number;
  sLow: number;
  sHigh: number;
  log: boolean;
  wMin: number;
  wMax: number;
  min: number;
  max: number;
}

function marginalFor(x: ScenarioInputs, key: RangeKey, overrides: RangeOverrides, scale: number): Marginal | null {
  const r = rangeFor(x, key, overrides);
  const v = levelOf(x, key);
  if (!r || v === null) return null;
  const spec = SENSITIVITY_RANGES[key];
  const log = spec.kind === "rel";
  if (log && (v <= 0 || r.rawLow <= 0)) return null;
  const w = (y: number) => (log ? Math.log(y) : y);
  const centre = w(v);
  const sLow = (Math.max(0, centre - w(r.rawLow)) / Z80) * scale;
  const sHigh = (Math.max(0, w(r.rawHigh) - centre) / Z80) * scale;
  const min = spec.min ?? (log ? 0 : -Infinity);
  const max = spec.max ?? Infinity;
  return { key, value: v, centre, sLow, sHigh, log, wMin: min === -Infinity || min <= 0 && log ? -Infinity : w(min), wMax: max === Infinity ? Infinity : w(max), min, max };
}

/** The input's value at normal score z: a two-piece normal around the entered value (its 10th and 90th percentiles are the range), cut at the input's limits. */
function quantileAt(m: Marginal, z: number): number {
  if (m.sLow === 0 && m.sHigh === 0) return Math.min(m.max, Math.max(m.min, m.value));
  const cdf = (w: number) => (w < m.centre ? (m.sLow === 0 ? 0 : normalCdf((w - m.centre) / m.sLow)) : m.sHigh === 0 ? 1 : normalCdf((w - m.centre) / m.sHigh));
  const uLow = m.wMin === -Infinity ? 0 : cdf(m.wMin);
  const uHigh = m.wMax === Infinity ? 1 : cdf(m.wMax);
  if (!(uHigh > uLow)) return Math.min(m.max, Math.max(m.min, m.value));
  const u = Math.min(1 - 1e-12, Math.max(1e-12, uLow + normalCdf(z) * (uHigh - uLow)));
  const zz = normalQuantile(u);
  const w = m.centre + (zz < 0 ? m.sLow : m.sHigh) * zz;
  const y = m.log ? Math.exp(w) : w;
  return Math.min(m.max, Math.max(m.min, y));
}

export interface McSummary {
  median: number;
  mean: number;
  p10: number;
  p90: number;
  /** Share of runs in which the net change is above zero, and its Monte Carlo standard error. */
  shareUp: number;
  shareUpSe: number;
}

export interface McInput {
  key: RangeKey;
  label: string;
  low: number;
  high: number;
  evidence: Evidence;
  basis: string;
}

export interface McResult {
  runs: number;
  /** Runs dropped because a draw made the scenario invalid (normally none). */
  dropped: number;
  seed: number;
  a: McSummary;
  b: McSummary | null;
  inputs: McInput[];
  /** The dependence actually applied (pairs whose inputs both vary). */
  correlations: Correlation[];
}

/** Draw scenarios: every uncertain input from its range, dependent where stated. Exposed so the draws can be checked. */
export function simulateInputs(x: ScenarioInputs, opts: McOptions = {}): { draws: ScenarioInputs[]; seed: number; inputs: McInput[]; correlations: Correlation[] } {
  const runs = opts.runs ?? 5000;
  const scale = opts.scale ?? 1;
  const overrides = opts.ranges ?? {};
  const which = x.extra ? "B" : "A";
  const marginals = activeKeys(x, which)
    .map((k) => marginalFor(x, k, overrides, scale))
    .filter((m): m is Marginal => m !== null);
  const index = new Map(marginals.map((m, i) => [m.key, i]));
  const applied = (opts.correlations ?? DEFAULT_CORRELATIONS).filter(([p, q]) => index.has(p) && index.has(q));
  const R: number[][] = marginals.map((_, i) => marginals.map((_, j) => (i === j ? 1 : 0)));
  for (const [p, q, rho] of applied) {
    R[index.get(p)!][index.get(q)!] = rho;
    R[index.get(q)!][index.get(p)!] = rho;
  }
  const L = cholesky(R);
  if (!L) throw new Error("The stated correlations are not jointly possible");
  const seed = opts.seed ?? hashSeed(JSON.stringify([x, overrides, opts.correlations ?? null, scale]));
  const rng = mulberry32(seed);
  const draws: ScenarioInputs[] = [];
  const eps = new Array<number>(marginals.length);
  for (let run = 0; run < runs; run++) {
    for (let i = 0; i < eps.length; i++) eps[i] = stdNormal(rng);
    let y = x;
    for (let i = 0; i < marginals.length; i++) {
      let z = 0;
      for (let j = 0; j <= i; j++) z += L[i][j] * eps[j];
      y = withLevel(y, marginals[i].key, quantileAt(marginals[i], z));
    }
    draws.push(y);
  }
  const inputs = marginals.map((m) => {
    const r = rangeFor(x, m.key, overrides)!;
    return { key: m.key, label: r.label, low: r.rawLow, high: r.rawHigh, evidence: r.evidence, basis: r.basis };
  });
  return { draws, seed, inputs, correlations: applied };
}

function summary(values: number[]): McSummary {
  const s = summarize(values)!;
  const up = values.filter((v) => v > 0).length / values.length;
  return { median: s.median, mean: s.mean, p10: s.p10, p90: s.p90, shareUp: up, shareUpSe: Math.sqrt((up * (1 - up)) / values.length) };
}

/** Monte Carlo over the documented ranges: the spread of the net change in state revenue. Null when the scenario is incomplete. */
export function monteCarlo(x: ScenarioInputs, opts: McOptions = {}): McResult | null {
  const base = compute(x);
  if (base.missing.length || base.invalid.length) return null;
  const { draws, seed, inputs, correlations } = simulateInputs(x, opts);
  const netA: number[] = [];
  const netB: number[] = [];
  let dropped = 0;
  for (const y of draws) {
    const c = compute(y);
    if (c.missing.length || c.invalid.length) {
      dropped += 1;
      continue;
    }
    netA.push(c.netA);
    if (x.extra) netB.push(c.netB ?? c.netA);
  }
  if (!netA.length) return null;
  return { runs: draws.length, dropped, seed, a: summary(netA), b: x.extra ? summary(netB) : null, inputs, correlations };
}
