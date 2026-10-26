// Grocery price premium and grocery share (method PRICE_SHARE_METHOD): how the state's annual fiscal change and what
// sellers keep vary with the grocery price and with the share of household wine purchases that moves to grocers, for a
// policy whose lever (DABS's discount to grocers, or the state charge's rate) is held fixed.
//
// A conditional sensitivity grid. It is not a forecast and not a channel-choice model: no combination is given a
// probability, and nothing here says shoppers would pay a premium or that any share would move at it.
//
// Every cell is one run of the existing engine (lib/scenario.ts compute) through lib/wineAlternatives.ts
// (evaluateFixed, priceResponse), laid out by lib/wineAccounting.ts. The only arithmetic added here is search: the
// engine's entered grocery price that produces a chosen consumer premium, and the points where the state breaks even or
// a seller's margin crosses zero or the 28% reference (bisection with lib/arrangements.ts solveLever on engine outputs).
//
// What is chosen and what follows, per $1 of today's state-store shelf price before checkout taxes:
//  * held fixed in each grid, chosen by the policy: DABS's discount to grocers, or the state charge's rate;
//  * chosen on the axes: the grocery price (as a consumer premium over the state store, state sales tax included) and
//    the share of covered household purchases that moves;
//  * follows: the grocer's gross margin (for private supply, after a wholesaler assumed to keep 29.5% of its price), what
//    sellers keep together, the state's annual change, and the protected-fund allocations inside it.
// Price, retailer margin, discount and charge cannot all be chosen: with the lever fixed, a price fixes the margin (and a
// margin target would fix the price). The 28% grocery margin is therefore a reference contour, not a constraint.
import { solveLever } from "./arrangements";
import { ledger, type Ledger, type PriceStack } from "./wineAccounting";
import {
  ASSUMPTIONS,
  COST_LINES,
  ELASTICITY,
  RETAILER_TARGET,
  WHOLESALER_MARGIN,
  alternativeById,
  alternativesReport,
  evaluateFixed,
  leverOf,
  optionsFor,
  priceResponse,
  type Assumption,
  type FixedCase,
  type Overrides,
} from "./wineAlternatives";

export const PRICE_SHARE_METHOD = "wine-price-share@1.0";

/** Consumer price premiums over a state store (state sales tax included): 0% to 60% in 5-point steps. */
export const PREMIUMS: number[] = Array.from({ length: 13 }, (_, i) => (i * 5) / 100);
/** Shares of covered household wine purchases that move to grocers: none to half. */
export const SHARES: number[] = [0, 0.1, 0.2, 0.3, 0.4, 0.5];
/** The worked example's share. */
export const WORKED_SHARE = 0.3;
/** How far the break-even searches look for a premium. */
export const PREMIUM_SEARCH_MAX = 1;

export type SavingsCase = "source_based" | "none";
export type VolumeBasis = "fixed_volume" | "price_response";
export const SAVINGS_CASES: SavingsCase[] = ["source_based", "none"];
export const VOLUME_BASES: VolumeBasis[] = ["fixed_volume", "price_response"];

export const AXES = {
  premium: {
    values: PREMIUMS,
    unit: "share of the state-store consumer price (0.35 = 35%)",
    definition:
      "The consumer price of a bottle at a grocer against the same bottle at a state store today, state sales tax (4.85%) included on both; local sales tax is not modelled.",
    rationale:
      "Illustrative. 0% is the state-store price. The 35% to 51% band holds the existing alternatives that price for sellers' reference margins (34.9%, 38.9%, 47.7%, 49.0%, 51.2%); 60% is one step beyond them. No source says what premium shoppers would pay.",
  },
  share: {
    values: SHARES,
    unit: "share of covered household wine purchases (0.3 = 30%)",
    definition:
      "Of the covered baseline household wine purchases: FY2025 DABS wine sales at state-store prices before sales tax (U01) times households' share of wine purchases (U03, 82%). Not all DABS sales, and not purchases by bars, restaurants and other licensees, which keep buying from DABS.",
    rationale: "Illustrative. 0% is no purchases moving; 30% is the worked example (U04, no source); 50% shows how the result scales. No source says what share would move at any price.",
  },
} as const;

export interface GridArrangement {
  id: "dabs_0" | "dabs_20" | "private_20" | "private_take";
  /** The policy alternative whose definition (supply, charge kind, tax base, savings) the grid uses. */
  alt: string;
  supply: "dabs" | "private";
  lever: { kind: "discount" | "charge"; value: number; words: string };
  label: string;
  short: string;
  /** How the grocer's margin follows from the price and the lever. */
  marginRule: string;
  /** Alternatives that are points on this grid: the same lever, savings and sales-tax treatment, at 30%. */
  references: string[];
}

const TAKE = leverOf(alternativeById("C_take")).charge;
const pctS = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;

export const GRID_ARRANGEMENTS: GridArrangement[] = [
  {
    id: "dabs_0",
    alt: "A_matched",
    supply: "dabs",
    lever: { kind: "discount", value: 0, words: "DABS sells to grocers at today's shelf price (no discount)" },
    label: "DABS supplies grocers at today's price, no discount",
    short: "DABS, no discount",
    marginRule: "The grocer pays DABS today's shelf price; its gross margin is the premium over that price, as a share of its own price.",
    references: ["A_matched", "A_target"],
  },
  {
    id: "dabs_20",
    alt: "B20_matched",
    supply: "dabs",
    lever: { kind: "discount", value: 0.2, words: "DABS sells to grocers at 20% off today's shelf price" },
    label: "DABS supplies grocers at a 20% discount",
    short: "DABS, 20% discount",
    marginRule: "The grocer pays DABS 80% of today's shelf price; its gross margin is the rest of its own price.",
    references: ["B20_matched", "B20_target"],
  },
  {
    id: "private_20",
    alt: "C20_matched",
    supply: "private",
    lever: { kind: "charge", value: 0.2, words: "a state charge of 20% of the grocery price before the charge (16.7% of the price including it), inside the sales-tax base" },
    label: "Private supply, 20% state charge",
    short: "Private, 20% charge",
    marginRule: `Sellers' price before the charge is the shelf price divided by 1.2; a private wholesaler keeps an assumed ${pctS(WHOLESALER_MARGIN)} of its own price and the grocer the rest.`,
    references: ["C20_matched"],
  },
  {
    id: "private_take",
    alt: "C_take",
    supply: "private",
    lever: {
      kind: "charge",
      value: TAKE,
      words: `a state charge of ${pctS(TAKE)} of the grocery price before the charge (${pctS(TAKE / (1 + TAKE))} of the price including it), inside the sales-tax base: the rate that collects DABS's margin per bottle when sellers price for their reference margins`,
    },
    label: `Private supply, ${pctS(TAKE)} state charge (DABS's margin per bottle at reference prices)`,
    short: `Private, ${pctS(TAKE)} charge`,
    marginRule: `Sellers' price before the charge is the shelf price divided by ${(1 + TAKE).toFixed(3)}; a private wholesaler keeps an assumed ${pctS(WHOLESALER_MARGIN)} of its own price and the grocer the rest.`,
    references: ["C_take"],
  },
];

/** What each quantity is in these grids: chosen, held fixed, assumed or derived. */
export const ROLES: { quantity: string; role: "policy lever (held fixed)" | "chosen on an axis" | "assumption" | "derived"; note: string }[] = [
  { quantity: "DABS's discount to grocers (DABS supply) or the state charge's rate (private supply)", role: "policy lever (held fixed)", note: "One value per grid; see each arrangement." },
  { quantity: "Grocery price premium over the state store", role: "chosen on an axis", note: "Illustrative range; not a prediction of what grocers would charge or shoppers pay." },
  { quantity: "Share of covered household wine purchases that moves", role: "chosen on an axis", note: "Illustrative range; the engine does not make it respond to the price (no channel-choice model)." },
  { quantity: "Private wholesaler's gross margin", role: "assumption", note: `${pctS(WHOLESALER_MARGIN)} of its own price (U13), so the grocer's share of the private sellers' margin follows; the sellers' combined margin does not depend on this split.` },
  { quantity: "Grocer's gross margin", role: "derived", note: "From the price and the lever (and the wholesaler's assumed margin). Gross margin is the seller's price less what it pays, before its own costs: not profit." },
  { quantity: "State annual fiscal change, all state funds", role: "derived", note: "The engine's net change: DABS trading margin, state charge, state sales tax, avoidable costs, new costs." },
  { quantity: "School-meals and enforcement fund allocations", role: "derived", note: "Allocations inside the statewide change, reported apart and never added to it." },
];

const ASSUMPTION_IDS = ["U01", "U02", "U03", "U05", "U06", "U07", "U10", "U11", "U12", "U13", "U14", "U15"];
export const GRID_ASSUMPTIONS: Assumption[] = ASSUMPTIONS.filter((a) => ASSUMPTION_IDS.includes(a.id));

export const SAVINGS_WORDS: Record<SavingsCase, string> = {
  source_based: `source-based assumption, ${(COST_LINES.shortRun * 100).toFixed(2)}¢ of store cost avoided per $1 that leaves (U07)`,
  none: "no avoidable store cost",
};
export const VOLUME_WORDS: Record<VolumeBasis, string> = {
  fixed_volume: "fixed volume: existing household purchases move from DABS to grocers; total wine bought does not change",
  price_response: `conditional price response: the share is assigned first, then the wine bought at grocers changes with the grocery price (elasticity ${ELASTICITY}, U15); purchases no longer made leave the Utah market and do not return to DABS`,
};

// ----- one case ----------------------------------------------------------------------------------------------------------

function overridesFor(a: GridArrangement, extra: Overrides = {}): Overrides {
  return a.lever.kind === "discount" ? { ...extra, discount: a.lever.value } : { ...extra, chargeRate: a.lever.value };
}
const savingsOverride = (s: SavingsCase): Overrides => (s === "none" ? { avoided: { shortRun: 0, conditional: 0 } } : {});

function fixedCase(a: GridArrangement, o: Overrides): FixedCase {
  const k = evaluateFixed(alternativeById(a.alt), overridesFor(a, o));
  if (!k) throw new Error(`${a.id}: the engine rejected the inputs`);
  return k;
}

const ratioCache = new Map<string, number>();
/** The engine's entered grocery price (before any charge) that gives a consumer premium, found by bisection on the price
 * stack the engine produces. */
export function priceRatioFor(a: GridArrangement, premium: number): number {
  const key = `${a.id}:${premium}`;
  const hit = ratioCache.get(key);
  if (hit !== undefined) return hit;
  const s = solveLever((v) => fixedCase(a, { priceRatio: v }).stack.consumerChange - premium, 0.05, 4, 60);
  if (s.root === null) throw new Error(`${a.id}: no grocery price gives a ${premium} premium`);
  ratioCache.set(key, s.root);
  return s.root;
}

export type SellerPosition = "below_cost" | "at_cost" | "below_reference" | "reference_or_above" | "not_split";

export function positionOf(st: PriceStack): SellerPosition {
  if (st.belowCost.grocer || st.belowCost.sellersTogether) return "below_cost";
  const g = st.retailerMarginShare;
  if (g === null) return "not_split";
  if (Math.abs(g) < 1e-9) return "at_cost";
  return g < RETAILER_TARGET - 1e-9 ? "below_reference" : "reference_or_above";
}

export const POSITION_WORDS: Record<SellerPosition, string> = {
  below_cost: "below acquisition cost",
  at_cost: "at acquisition cost (zero margin)",
  below_reference: `positive, below the ${pctS(RETAILER_TARGET, 0)} reference`,
  reference_or_above: `at or above the ${pctS(RETAILER_TARGET, 0)} reference`,
  not_split: "not split",
};

export interface PricePoint {
  arrangement: GridArrangement["id"];
  premium: number;
  /** The engine's entered grocery price before any charge, and the shelf price before checkout taxes, per $1 today. */
  priceRatio: number;
  shelf: number;
  /** The grocer's gross margin as a share of its own selling price (private supply: after the assumed wholesaler). */
  grocerMargin: number | null;
  wholesalerMargin: number | null;
  /** What the grocer and any private wholesaler keep together, per $1 of today's price, and as a share of their price. */
  sellersTogether: number;
  sellersTogetherShare: number | null;
  /** The state charge per $1 of today's price (private supply). */
  chargePerDollar: number | null;
  belowCost: { grocer: boolean; sellersTogether: boolean };
  position: SellerPosition;
}

function pricePointAt(a: GridArrangement, premium: number, ratio: number): PricePoint {
  const st = fixedCase(a, { priceRatio: ratio }).stack;
  return {
    arrangement: a.id,
    premium,
    priceRatio: ratio,
    shelf: st.after.shelf,
    grocerMargin: st.retailerMarginShare,
    wholesalerMargin: st.wholesaleMarginShare,
    sellersTogether: st.sellersTogether,
    sellersTogetherShare: st.sellersTogetherShare,
    chargePerDollar: st.charge ? st.charge.perDollar : null,
    belowCost: st.belowCost,
    position: positionOf(st),
  };
}

export function pricePoint(a: GridArrangement, premium: number): PricePoint {
  return pricePointAt(a, premium, priceRatioFor(a, premium));
}

export interface GridCell {
  arrangement: GridArrangement["id"];
  savings: SavingsCase;
  volume: VolumeBasis;
  premium: number;
  share: number;
  /** Covered household purchases that move, $ a year at state-store prices before sales tax. */
  movedDollars: number;
  /** Wine bought at grocers, $ a year at state-store prices (after the price response where it applies). */
  groceryDollars: number;
  /** Statewide annual change, all state funds together. */
  net: number;
  /** School-meals and enforcement funds together (DABS supply: if DABS's sales to grocers carry the deposits). */
  funds: number;
  /** DABS supply: the same if DABS's sales to grocers carry no deposits. */
  fundsOtherReading: number | null;
  /** Every other state fund: net less the two funds. */
  others: number;
  reconciles: boolean;
  ledger: Ledger;
}

function cellAt(a: GridArrangement, premium: number, ratio: number, share: number, savings: SavingsCase, volume: VolumeBasis): GridCell {
  const o = { ...savingsOverride(savings), priceRatio: ratio, shift: share };
  const k = fixedCase(a, o);
  const x = k.built.x;
  const moved = (x.wineSales ?? 0) * (x.eligible ?? 1) * share;
  const def = alternativeById(a.alt);
  let led = k.ledger;
  let other = k.ledgerOtherReading;
  if (volume === "price_response") {
    const pr = priceResponse(k.built);
    led = ledger(pr.x, pr.r, optionsFor(def, overridesFor(a, o), true), "with_demand");
    other = a.supply === "dabs" ? ledger(pr.x, pr.r, optionsFor(def, overridesFor(a, o), false), "with_demand") : null;
  }
  return {
    arrangement: a.id,
    savings,
    volume,
    premium,
    share,
    movedDollars: moved,
    groceryDollars: led.volume.grocery,
    net: led.net,
    funds: led.allocations.funds,
    fundsOtherReading: other ? other.allocations.funds : null,
    others: led.allocations.others,
    reconciles: led.reconciles && (other === null || other.reconciles),
    ledger: led,
  };
}

/** One cell of a grid at any premium (the grid's own premiums, or a reference point's). */
export function gridCell(a: GridArrangement, premium: number, share: number, savings: SavingsCase, volume: VolumeBasis): GridCell {
  return cellAt(a, premium, priceRatioFor(a, premium), share, savings, volume);
}

// ----- break-even points -----------------------------------------------------------------------------------------------

export type ShareStatus = "within_grid" | "beyond_grid" | "not_reachable" | "never";

export interface ShareBreakEven {
  arrangement: GridArrangement["id"];
  savings: SavingsCase;
  volume: VolumeBasis;
  premium: number;
  /** The share of covered household purchases at which the statewide change is zero; null when none exists. */
  share: number | null;
  status: ShareStatus;
  note: string;
}

const STATUS_NOTE: Record<ShareStatus, string> = {
  within_grid: "Moving at least this share keeps state receipts whole; less loses (the administration cost is paid whatever moves).",
  beyond_grid: "Reached only above the grid's 50%.",
  not_reachable: "Not reached even if every covered household purchase moved.",
  never: "Each dollar that moves lowers state receipts, so no share breaks even: moving more makes it worse.",
};

function shareStatus(s: number | null, rises: boolean): ShareStatus {
  if (s === null) return rises ? "not_reachable" : "never";
  if (s > 1 + 1e-12) return "not_reachable";
  return s > SHARES[SHARES.length - 1] + 1e-12 ? "beyond_grid" : "within_grid";
}

/** The share at which the state breaks even. Fixed volume: the engine's own break-even share. With the price response:
 * bisection on the engine's net change over the share. */
export function shareBreakEven(a: GridArrangement, premium: number, savings: SavingsCase, volume: VolumeBasis): ShareBreakEven {
  const ratio = priceRatioFor(a, premium);
  let s: number | null;
  let rises: boolean;
  if (volume === "fixed_volume") {
    const r = fixedCase(a, { ...savingsOverride(savings), priceRatio: ratio, shift: WORKED_SHARE }).result;
    s = r.breakEvenShift.value;
    rises = r.perShiftedDollar > 0;
  } else {
    const f = (sh: number) => cellAt(a, premium, ratio, sh, savings, volume).net;
    const sol = solveLever(f, 0, 1, 20);
    s = sol.root;
    rises = f(1) > f(0);
    if (s === null && rises && f(1) >= 0) s = 0;
  }
  const status = shareStatus(s, rises);
  return { arrangement: a.id, savings, volume, premium, share: status === "never" || status === "not_reachable" ? (s !== null && s > 1 ? s : null) : s, status, note: STATUS_NOTE[status] };
}

export interface PreservedRange {
  /** Premium where the range starts: 0 when receipts are already whole at today's price. */
  from: number;
  /** Premium where it ends; null when receipts are still whole at PREMIUM_SEARCH_MAX. */
  to: number | null;
  fromPoint: PricePoint;
  toPoint: PricePoint | null;
}

export interface PremiumRanges {
  arrangement: GridArrangement["id"];
  savings: SavingsCase;
  volume: VolumeBasis;
  share: number;
  /** Where the statewide change is zero or better, for premiums from 0% to PREMIUM_SEARCH_MAX (empty: nowhere). */
  ranges: PreservedRange[];
}

/** The premiums at which state receipts are preserved at one share: a scan of the engine's net change over the grocery
 * price, each boundary found by bisection. */
export function preservedRanges(a: GridArrangement, share: number, savings: SavingsCase, volume: VolumeBasis): PremiumRanges {
  const lo = priceRatioFor(a, 0);
  const hi = priceRatioFor(a, PREMIUM_SEARCH_MAX);
  const f = (v: number) => cellAt(a, NaN, v, share, savings, volume).net;
  const n = 200;
  const vs = Array.from({ length: n + 1 }, (_, i) => lo + ((hi - lo) * i) / n);
  const ys = vs.map(f);
  const edge = (i: number) => solveLever(f, vs[i - 1], vs[i], 1).root ?? vs[i];
  const at = (v: number): PricePoint => (v === lo ? pricePoint(a, 0) : pricePointAt(a, fixedCase(a, { priceRatio: v }).stack.consumerChange, v));
  const ranges: PreservedRange[] = [];
  let start: number | null = ys[0] >= 0 ? lo : null;
  const close = (end: number | null) => {
    const fp = at(start!);
    const tp = end === null ? null : at(end);
    ranges.push({ from: fp.premium, to: tp ? tp.premium : null, fromPoint: fp, toPoint: tp });
    start = null;
  };
  for (let i = 1; i < vs.length; i++) {
    const was = ys[i - 1] >= 0;
    const is = ys[i] >= 0;
    if (!was && is) start = edge(i);
    if (was && !is) close(edge(i));
  }
  if (start !== null) close(null);
  return { arrangement: a.id, savings, volume, share, ranges };
}

export interface MarginMarkers {
  arrangement: GridArrangement["id"];
  /** Premium below which the grocer (under the stated split) sells below its acquisition cost; null if never in range. */
  grocerCost: number | null;
  /** Premium below which the private sellers together sell below cost (private supply). */
  sellersCost: number | null;
  /** Premium at which the grocer's gross margin reaches the 28% reference. */
  reference: number | null;
}

export function marginMarkers(a: GridArrangement): MarginMarkers {
  const lo = priceRatioFor(a, -0.5);
  const hi = priceRatioFor(a, 2);
  const at = (v: number) => fixedCase(a, { priceRatio: v }).stack;
  const solveFor = (g: (st: PriceStack) => number) => {
    const s = solveLever((v) => g(at(v)), lo, hi, 120);
    return s.root === null ? null : at(s.root).consumerChange;
  };
  return {
    arrangement: a.id,
    grocerCost: solveFor((st) => st.after.retailerMargin),
    sellersCost: a.supply === "private" ? solveFor((st) => st.sellersTogether) : null,
    reference: solveFor((st) => (st.retailerMarginShare ?? NaN) - RETAILER_TARGET),
  };
}

// ----- reference points --------------------------------------------------------------------------------------------------

export interface GridReference {
  altId: string;
  short: string;
  arrangement: GridArrangement["id"];
  premium: number;
  share: number;
  /** The alternative's own fixed-volume result and the same point computed on the grid. */
  net: number;
  gridNet: number;
  zeroSavingsNet: number;
  gridZeroSavingsNet: number;
  matches: boolean;
}

// ----- the report --------------------------------------------------------------------------------------------------------

export interface PriceShareReport {
  method: string;
  axes: typeof AXES;
  roles: typeof ROLES;
  arrangements: GridArrangement[];
  assumptions: Assumption[];
  savingsWords: typeof SAVINGS_WORDS;
  volumeWords: typeof VOLUME_WORDS;
  /** Covered baseline household wine purchases (the share's denominator), $ a year, and its two factors. */
  denominator: { coveredHousehold: number; wineSales: number; householdShare: number };
  newCosts: number;
  handlingCost: number;
  prices: PricePoint[];
  cells: GridCell[];
  shareBreakEvens: ShareBreakEven[];
  /** At the worked 30% share: the premiums that keep state receipts whole. */
  preserved: PremiumRanges[];
  markers: MarginMarkers[];
  references: GridReference[];
  /** A symmetric colour domain shared by every fixed-volume grid, $ a year. */
  colourLimit: number;
}

let cached: PriceShareReport | null = null;

export function priceShareReport(): PriceShareReport {
  if (cached) return cached;
  const rep = alternativesReport();
  const prices: PricePoint[] = [];
  const cells: GridCell[] = [];
  const shareBreakEvens: ShareBreakEven[] = [];
  const preserved: PremiumRanges[] = [];
  for (const a of GRID_ARRANGEMENTS) {
    for (const p of PREMIUMS) {
      prices.push(pricePoint(a, p));
      for (const sv of SAVINGS_CASES)
        for (const vb of VOLUME_BASES) {
          for (const s of SHARES) cells.push(gridCell(a, p, s, sv, vb));
          shareBreakEvens.push(shareBreakEven(a, p, sv, vb));
        }
    }
    for (const sv of SAVINGS_CASES) for (const vb of VOLUME_BASES) preserved.push(preservedRanges(a, WORKED_SHARE, sv, vb));
  }
  const references: GridReference[] = GRID_ARRANGEMENTS.flatMap((a) =>
    a.references.map((id) => {
      const r = rep.results.find((x) => x.def.id === id)!;
      const premium = r.fixed.stack.consumerChange;
      const share = r.built.x.shift ?? WORKED_SHARE;
      const g = gridCell(a, premium, share, "source_based", "fixed_volume");
      const z = gridCell(a, premium, share, "none", "fixed_volume");
      return {
        altId: id,
        short: r.def.short,
        arrangement: a.id,
        premium,
        share,
        net: r.fixed.ledger.net,
        gridNet: g.net,
        zeroSavingsNet: r.zeroSavings.net,
        gridZeroSavingsNet: z.net,
        matches: Math.abs(g.net - r.fixed.ledger.net) < 0.01 && Math.abs(z.net - r.zeroSavings.net) < 0.01,
      };
    }),
  );
  const x0 = fixedCase(GRID_ARRANGEMENTS[0], {}).built.x;
  const fixedNets = cells.filter((c) => c.volume === "fixed_volume").map((c) => Math.abs(c.net));
  const step = 2.5e6;
  cached = {
    method: PRICE_SHARE_METHOD,
    axes: AXES,
    roles: ROLES,
    arrangements: GRID_ARRANGEMENTS,
    assumptions: GRID_ASSUMPTIONS,
    savingsWords: SAVINGS_WORDS,
    volumeWords: VOLUME_WORDS,
    denominator: { coveredHousehold: (x0.wineSales ?? 0) * (x0.eligible ?? 1), wineSales: x0.wineSales ?? 0, householdShare: x0.eligible ?? 1 },
    newCosts: x0.newCosts ?? 0,
    handlingCost: x0.handlingCost ?? 0,
    prices,
    cells,
    shareBreakEvens,
    preserved,
    markers: GRID_ARRANGEMENTS.map(marginMarkers),
    references,
    colourLimit: Math.ceil(Math.max(...fixedNets) / step) * step,
  };
  return cached;
}

export const arrangementById = (id: string) => GRID_ARRANGEMENTS.find((a) => a.id === id);
