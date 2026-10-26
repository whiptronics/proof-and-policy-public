// Three ways Utah could let grocery stores sell wine, compared on one baseline (method ARRANGEMENTS_METHOD). Each is a
// proposed arrangement, not a description of what current law allows, and each is the Utah wine scenario model
// (lib/scenario.ts) with the same inputs and a different way for the state to collect on the wine that moves:
//
//  1. private: grocers buy from private wholesalers and the state levies an explicit replacement tax (a tax on the
//     grocery price before tax, or an excise per gallon), with ordinary sales tax on the shelf price. The state stops
//     both retailing and wholesaling that wine, so it gives up the whole gross margin; the tax can reach the shelf
//     price and, with a price elasticity, the quantity bought.
//  2. wholesale: DABS stays the only wholesaler and sells to grocers at its shelf price less a discount. Its receipts
//     and the cost of the wine are shown apart, and the grocer's own margin (the shelf price less what it pays DABS)
//     is shown apart from the state's. The state's retail markup does not survive: it keeps the margin less the discount.
//  3. earmarked: arrangement 1 or 2 with an explicit allocation of its proceeds to school meals and alcohol
//     enforcement. An allocation moves money between state funds and creates none; a guarantee above the proceeds is a
//     funding requirement on other state money, shown as such.
//
// Purchases. The comparison starts from scenario A (existing purchases change channel; total wine bought does not
// change). Each mechanism the reader has entered in scenario B (price response, cross-border recapture, easier access)
// is then added on its own and all together; the model is additive in them, so the parts add up to the whole, and the
// volume reconciliation says where every dollar of wine is bought. Beer substitution is left out of the comparison.
// State government only on both sides; local sales tax is not modelled. Not a forecast.
//
// 1.1. Only household purchases move (the scenario's household share, an uncertain input). Prices have a reference
// case, matched consumer prices: the grocery shelf price equals today's state-store price, so any replacement tax comes
// out of what sellers keep. What sellers keep is reported (`sellers`), because a price consumers accept is not
// automatically a price a seller can sustain; with gross margins the reader says sellers need, the comparison also
// finds the price at which the state breaks even and sellers earn them (`viability`). The entered grocery price, with
// the tax added to the shelf, is the alternative; reading its price response as buyers returning to state stores is
// exploratory (a market-wide elasticity does not measure switching between two channels). The school-meals and
// enforcement guarantee of arrangement 3 is either fixed (an annual amount set once from the initial scenario) or
// proportional (today's deposit rates on the state-store sales actually lost); both are shown in every case.
import { compute, excisePerDollar, movedShare, type DepositRates, type ScenarioInputs, type ScenarioResult } from "./scenario";
import { sensitivity, type Sensitivity } from "./scenarioRanges";

export const ARRANGEMENTS_METHOD = "utah-wine-arrangements@1.1";

export type ArrangementId = "private" | "wholesale" | "earmarked";
export type TaxKind = "percent" | "excise";
/** fixed: an annual guarantee set once from the initial scenario (today's deposit rates times the sales the entered share
 * moves), paid whatever happens later; proportional: today's deposit rates times the state-store sales actually lost in
 * each case; amount: a fixed sum a year; share: a share of the arrangement's proceeds. ("today" in older addresses is
 * "fixed".) */
export type EarmarkRule = "fixed" | "proportional" | "amount" | "share";
/** matched: the grocery shelf price equals today's state-store price (the reference case); entered: the grocery price
 * as entered in the scenario, with the share of any replacement tax entered added to it. */
export type PriceCase = "matched" | "entered";
/** shift: channel shift only; all: with every purchase change entered (the price response read as less wine bought);
 * return: exploratory, the price response read as buyers going back to state stores. */
export type EarmarkCase = "shift" | "all" | "return";
export type MechanismId = "price" | "recapture" | "access";

export interface ArrangementSettings {
  /** Which prices the comparison uses: matched consumer prices (the reference) or the grocery price as entered. */
  priceCase: PriceCase;
  /** Replacement tax in arrangement 1: on the grocery price before the tax ("percent") or per gallon ("excise"). */
  taxKind: TaxKind;
  /** Share of the grocery price before the tax (percent) or $ per gallon (excise). */
  taxRate: number | null;
  /** Share of the replacement tax that reaches the shelf price (0-1). Null: all of it (labelled as an assumption). */
  taxToPrice: number | null;
  /** Arrangement 1 only: avoidable state cost per $ moved for the wholesaling the state also stops, on top of the
   * avoidable retail cost (0-1). Null: none (labelled: no source measures it). */
  wholesaleCost: number | null;
  /** Arrangement 2: the discount off the state-store price at which DABS sells to grocers (0-1). */
  discount: number | null;
  /** Arrangement 3: which arrangement's proceeds the allocation is made from. */
  earmarkBase: "private" | "wholesale";
  /** See EarmarkRule. Amount and share are split between the funds in today's statutory proportion. */
  earmarkRule: EarmarkRule;
  /** Dollars a year (amount) or a share of the proceeds, 0-1 (share). */
  earmarkValue: number | null;
  /** Gross margins sellers need on their own selling price (assumptions; 0-1): a private wholesaler (arrangement 1) and
   * the grocer. Null: not entered, and no price at which both sides hold is computed. */
  wholesalerMargin: number | null;
  grocerMargin: number | null;
}

// ----- address fields ------------------------------------------------------------------------------------------------

/** The comparison's fields in the scenario tool's address (the discount is the tool's own `dc`). */
export const COMPARISON_FIELDS = ["cmp", "pc", "rt", "rtv", "rtp", "vw", "eb", "er", "ea", "gw", "gg", "sx"] as const;

const num = (s: string | null | undefined): number | null => {
  if (s === null || s === undefined || s.trim() === "") return null;
  const v = Number(s.replace(/[$,\s]/g, ""));
  return Number.isFinite(v) ? v : null;
};
const pct = (s: string | null | undefined) => {
  const v = num(s);
  return v === null ? null : v / 100;
};

/** The settings written in an address (percent fields as typed, e.g. "20" for 20%). */
export function settingsFromFields(get: (k: string) => string | null | undefined): ArrangementSettings {
  const taxKind: TaxKind = get("rt") === "excise" ? "excise" : "percent";
  const er = get("er");
  const earmarkRule: EarmarkRule = er === "amount" ? "amount" : er === "share" ? "share" : er === "proportional" ? "proportional" : "fixed";
  return {
    // Addresses written before 1.1 have no price case: they keep the grocery price they were made with.
    priceCase: get("pc") === "matched" ? "matched" : "entered",
    taxKind,
    taxRate: taxKind === "excise" ? num(get("rtv")) : pct(get("rtv")),
    taxToPrice: pct(get("rtp")),
    wholesaleCost: pct(get("vw")),
    discount: pct(get("dc")),
    earmarkBase: get("eb") === "wholesale" ? "wholesale" : "private",
    earmarkRule,
    earmarkValue: earmarkRule === "share" ? pct(get("ea")) : earmarkRule === "amount" ? num(get("ea")) : null,
    wholesalerMargin: pct(get("gw")),
    grocerMargin: pct(get("gg")),
  };
}

// ----- mapping each arrangement onto the scenario model ----------------------------------------------------------------

/** The shared scenario as arrangement 1 or 2 (the reader's scenario B inputs kept; beer substitution removed). */
export function arrangementInputs(base: ScenarioInputs, set: ArrangementSettings, id: "private" | "wholesale"): ScenarioInputs {
  const common: ScenarioInputs = {
    ...base,
    retained: null,
    excise: null,
    adValorem: null,
    discount: null,
    taxToPrice: null,
    substitution: false,
    replaces: null,
    basis: null,
    matchPrice: set.priceCase === "matched",
  };
  if (id === "wholesale") return { ...common, revenueMode: "wholesale", discount: set.discount };
  return {
    ...common,
    revenueMode: set.taxKind,
    excise: set.taxKind === "excise" ? set.taxRate : null,
    adValorem: set.taxKind === "percent" ? set.taxRate : null,
    taxToPrice: set.taxToPrice ?? 1,
    avoidableCost: base.avoidableCost === null ? null : base.avoidableCost + (set.wholesaleCost ?? 0),
  };
}

/** Which purchase mechanisms the reader has entered (scenario B). */
export function enteredMechanisms(base: ScenarioInputs): Record<MechanismId, boolean> {
  return {
    price: base.extra && typeof base.elasticity === "number" && base.elasticity !== 0,
    recapture: base.extra && typeof base.recapture === "number" && base.recapture > 0,
    access: base.extra && typeof base.growth === "number" && base.growth !== 0,
  };
}

/** The arrangement with only the chosen mechanisms switched on (none: channel shift only). */
export function withMechanisms(x: ScenarioInputs, on: Partial<Record<MechanismId, boolean>>, from: ScenarioInputs = x): ScenarioInputs {
  if (!on.price && !on.recapture && !on.access) return { ...x, extra: false };
  return {
    ...x,
    extra: true,
    growth: on.access ? from.growth : 0,
    recapture: on.recapture ? (from.recapture ?? null) : null,
    elasticity: on.price ? (from.elasticity ?? null) : null,
    extraGrocery: on.recapture || on.access ? from.extraGrocery : (from.extraGrocery ?? 0),
    substitution: false,
  };
}

// ----- solving for a lever ---------------------------------------------------------------------------------------------

export interface Solve {
  /** The first value in the range where the function reaches zero from below (or from above for a falling function). */
  root: number | null;
  /** Value of the function at the low end of the range. */
  atLow: number;
  /** Where the function is highest in the range, and its value. */
  best: { at: number; value: number };
  /** How many times the function changes sign in the range (on the scanning grid). */
  crossings: number;
}

/** Scan [lo, hi] on a fine grid, then bisect the first sign change. Works when the net change is not linear in the lever
 * (a tax that raises the price and lowers the quantity bought). Reports no root rather than extrapolating. */
export function solveLever(f: (v: number) => number, lo: number, hi: number, steps = 400): Solve {
  const xs = Array.from({ length: steps + 1 }, (_, i) => lo + ((hi - lo) * i) / steps);
  const ys = xs.map(f);
  let best = { at: xs[0], value: ys[0] };
  let crossings = 0;
  let root: number | null = null;
  for (let i = 0; i < xs.length; i++) {
    if (Number.isFinite(ys[i]) && ys[i] > best.value) best = { at: xs[i], value: ys[i] };
    if (i === 0) continue;
    const a = ys[i - 1];
    const b = ys[i];
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    if (b === 0 && root === null) root = xs[i];
    if (Math.sign(a) !== Math.sign(b) && a !== 0 && b !== 0) {
      crossings++;
      if (root === null) {
        let l = xs[i - 1];
        let h = xs[i];
        let fl = a;
        for (let k = 0; k < 80; k++) {
          const mid = (l + h) / 2;
          const fm = f(mid);
          if (fm === 0) {
            l = h = mid;
            break;
          }
          if (Math.sign(fm) === Math.sign(fl)) {
            l = mid;
            fl = fm;
          } else h = mid;
        }
        root = (l + h) / 2;
      }
    }
  }
  return { root, atLow: ys[0], best, crossings };
}

// ----- results ---------------------------------------------------------------------------------------------------------

export interface Lines {
  /** Today: state-store gross margin on wine plus state sales tax on wine. */
  baselineRevenue: number;
  /** The gross margin the state stores no longer earn on the wine that moves (negative). */
  marginDisplaced: number;
  /** What the state collects instead on that wine: the replacement tax, or DABS's margin on its sales to grocers. */
  replacement: number;
  /** Wholesale only: DABS's receipts from grocers and what DABS pays for that wine. replacement = receipts - cost. */
  wholesaleReceipts: number | null;
  acquisitionCost: number | null;
  /** Change in state sales tax: the moved wine at its new sales-tax base (its shelf price unless a charge is outside it). */
  salesTaxChange: number;
  /** State revenue from wine under the arrangement (margin, replacement and sales tax). */
  proposedRevenue: number;
  costsAvoided: number;
  /** New licensing and enforcement costs, plus any cost of supplying grocers (scenario 1.6 `handlingCost`; zero unless
   * entered). lib/wineAccounting.ts reports the two apart. */
  newCosts: number;
  /** proposedRevenue - baselineRevenue + costsAvoided - newCosts. */
  net: number;
}

export interface MechanismPart {
  id: MechanismId;
  label: string;
  entered: boolean;
  /** Change in the net from adding this mechanism alone to the channel shift. */
  net: number | null;
  /** Wine this mechanism adds (negative: removes), at state-store prices, $ a year, and gallons. */
  dollars: number | null;
  gallons: number | null;
}

export interface Volume {
  /** Measured: today's wine sales at state-store prices (all through state stores and agencies). */
  baseline: number;
  /** Modelled, at state-store prices: bought from state stores and agencies, and from grocers. */
  state: number;
  grocery: number;
  total: number;
  /** total / baseline. */
  index: number;
}

export interface BreakEven {
  lever: "taxRate" | "discount";
  /** shift: channel shift only; all: with every purchase mechanism entered (including the price response, if entered). */
  basis: "shift" | "all";
  range: [number, number];
  status: "found" | "not_needed" | "none_in_range" | "unavailable";
  value: number | null;
  /** Highest net change in the range and where (when no value breaks even). */
  best: { at: number; value: number } | null;
  note: string;
}

export interface ArrangementResult {
  id: "private" | "wholesale";
  label: string;
  x: ScenarioInputs;
  /** The same with every purchase change entered (null when none is entered). */
  xAll: ScenarioInputs | null;
  missing: string[];
  invalid: string[];
  shift: ScenarioResult;
  all: ScenarioResult | null;
  lines: Lines | null;
  netAll: number | null;
  mechanisms: MechanismPart[];
  volumeShift: Volume | null;
  volumeAll: Volume | null;
  price: { beforeTax: number; shelf: number; withSalesTax: number; retailerMargin: number | null } | null;
  /** Whether the grocery shelf price differs from today's state-store price (false at matched prices). */
  priceMoves: boolean;
  breakEven: BreakEven;
  /** The same break-even with a straight-line demand curve instead of constant elasticity (only with a price response). */
  breakEvenLinear: BreakEven | null;
  /** Exploratory: the price response read the other way, buyers put off by the grocery price going back to state stores
   * and buying the same wine there, so the share that moves falls instead of the wine bought. The market-wide elasticity
   * used to size it does not measure switching between channels. Null without a price response or when the price does
   * not move. */
  channelReturn: { net: number; shareMoving: number; x: ScenarioInputs; result: ScenarioResult; basis: "shift" | "all" } | null;
  /** What sellers keep on the wine that moves, at the entered lever (channel shift). */
  sellers: Keep | null;
  /** The same at the arrangement's break-even lever (null when there is none). */
  sellersAtBreakEven: Keep | null;
  /** The price at which the state breaks even and sellers earn the gross margins entered (null when they are not). */
  viability: Viability | null;
  /** Assumptions with a value that reverses the sign of the headline result, one at a time (zero.inRange says whether
   * that value lies inside the assumption's documented range). */
  reversals: Sensitivity[];
  /** Wholesale only, context: operating costs the state keeps paying on the wine that moves, at DABS's all-product average. */
  retainedCosts: number | null;
}

/** What sellers keep per $1 of today's state-store price (before sales tax) on the wine that moves: their own price less
 * the cost of the wine (arrangement 1: private wholesalers and grocers together, after the replacement tax), or less what
 * the grocer pays DABS (arrangement 2). Their operating costs and profit come out of it. */
export interface Keep {
  perDollar: number;
  /** The sellers' own price before the replacement tax and sales tax, per $1 of today's state-store price. */
  ownPrice: number;
  /** perDollar / ownPrice: a gross margin on their own price, the definition Census uses (gross margin as a percent of sales). */
  margin: number;
  /** perDollar times the sales that move (channel shift), $ a year. */
  dollars: number;
  /** Arrangement 1 with a private wholesaler's margin entered: what the grocer keeps after paying that wholesaler. Arrangement 2: the grocer (all of it). */
  grocer: { perDollar: number; margin: number } | null;
}

export interface ViabilityCase {
  status: BreakEven["status"];
  /** The arrangement's lever at which the state breaks even with sellers pricing to earn the margins entered. */
  lever: number | null;
  /** The sellers' price before any replacement tax, and the shelf price before sales tax, % of today's state-store price. */
  ownPrice: number | null;
  shelf: number | null;
  /** Wine bought at grocers as a share of the wine that moves, at that shelf price (null without a price response). */
  demandFactor: number | null;
  note: string;
}

/** The price at which both sides hold: the state's revenue is unchanged and sellers earn the gross margins entered. */
export interface Viability {
  wholesaler: number | null;
  grocer: number;
  shift: ViabilityCase;
  /** With the purchase changes entered (the price response read as less wine bought); null when none is entered. */
  all: ViabilityCase | null;
}

export interface EarmarkResult {
  base: "private" | "wholesale";
  basis: EarmarkCase;
  rule: EarmarkRule;
  /** The fixed guarantee: today's statutory allocation of the margin on the wine the initial scenario moves, set once. */
  today: { school: number; enforcement: number };
  /** State-store sales lost in this case, at state-store prices (today's sales less what the state stores still sell). */
  lostSales: number;
  /** Today's deposit rates on those lost sales (never below zero): what a proportional guarantee pays in this case. */
  proportional: number;
  /** The fixed guarantee in total (= today.school + today.enforcement). */
  fixed: number;
  /** The base arrangement's own revenue on grocery wine in this case: the replacement tax, or DABS's margin on its sales to grocers. */
  proceeds: number;
  allocation: { school: number; enforcement: number; total: number };
  /** Other state money needed when the allocation exceeds the proceeds. */
  requirement: number;
  /** What is left of the proceeds for the General Fund and other uses (negative: the requirement). */
  remainder: number;
  /** Change for the two funds against today (they keep today's deposits on what the state stores still sell, plus the
   * allocation), and for every other state fund; they add up to the arrangement's net change. */
  fundsChange: number;
  othersChange: number;
  /** The arrangement's total net change in this case (all state funds together); unchanged by the allocation. */
  net: number;
  /** The base's own lever at which its proceeds just cover the allocation (in this case). */
  coverLever: { lever: "taxRate" | "discount"; value: number } | null;
  coverNote: string;
}

/** Arrangement 3 under one guarantee rule, in every case that arises. */
export interface GuaranteeSet {
  rule: EarmarkRule;
  cases: EarmarkResult[];
}

export interface Comparison {
  method: string;
  settings: ArrangementSettings;
  priceCase: PriceCase;
  missing: string[];
  invalid: string[];
  entered: Record<MechanismId, boolean>;
  /** Which case the headline, the break-even values and the reversals use. */
  headline: "shift" | "all";
  private: ArrangementResult;
  wholesale: ArrangementResult;
  /** Arrangement 3 under the chosen rule: channel shift only, with every purchase change entered, and in the exploratory
   * return-to-state-stores reading (null when that case does not arise). */
  earmarked: EarmarkResult | null;
  earmarkedAll: EarmarkResult | null;
  earmarkedReturn: EarmarkResult | null;
  /** Arrangement 3 in every case under the chosen rule and, when it is fixed or proportional, under the other one too:
   * they are different proposals. */
  guarantees: GuaranteeSet[];
}

const LABEL = {
  private: "1. Private retail with a replacement tax",
  wholesale: "2. State wholesale, grocers retail",
  earmarked: "3. Either, with an explicit allocation to school meals and enforcement",
} as const;
export const ARRANGEMENT_LABELS = LABEL;

const MECH_LABEL: Record<MechanismId, string> = {
  price: "Price response of the wine that moves (elasticity)",
  recapture: "Cross-border recapture",
  access: "Easier access: more wine bought in total",
};

function linesOf(x: ScenarioInputs, r: ScenarioResult): Lines {
  const W = x.wineSales!;
  const S = W * movedShare(x);
  const m = x.grossMargin!;
  const t = x.salesTax!;
  const get = (id: string) => r.a.find((c) => c.id === id)?.value ?? 0;
  const whole = x.revenueMode === "wholesale";
  const d = whole ? (x.discount ?? 0) : 0;
  return {
    baselineRevenue: r.baselineTotal,
    marginDisplaced: -m * S,
    replacement: get("retained") + get("excise") + get("ad_valorem") + get("wholesale"),
    wholesaleReceipts: whole ? (1 - d) * S : null,
    acquisitionCost: whole ? (1 - m) * S : null,
    salesTaxChange: get("sales_tax") - t * W,
    proposedRevenue: r.aRevenue,
    costsAvoided: get("cost_saved"),
    newCosts: get("new_costs") + get("handling"),
    net: r.netA,
  };
}

function volumeOf(x: ScenarioInputs, r: ScenarioResult): Volume {
  const W = x.wineSales!;
  const S = W * movedShare(x);
  const q = x.extra ? (x.extraGrocery ?? 0) : 0;
  const st = r.extraStreams ?? [];
  const of = (id: string) => st.find((e) => e.id === id)?.dollars ?? 0;
  const spread = of("access") + of("recapture");
  const state = W - S + (1 - q) * spread;
  const grocery = S + of("price") + q * spread;
  return { baseline: W, state, grocery, total: state + grocery, index: W > 0 ? (state + grocery) / W : 1 };
}

function netOf(x: ScenarioInputs, basis: "shift" | "all"): number {
  const r = compute(x);
  if (r.missing.length || r.invalid.length) return NaN;
  return basis === "shift" ? r.netA : (r.netB ?? NaN);
}

/** What sellers keep per $1 of today's state-store price on the wine that moves (see Keep). The cost of the wine is DABS's
 * all-product share (1 - gross margin); for private wholesalers that is an assumption. */
export function sellersKeep(x: ScenarioInputs, r: ScenarioResult, wholesalerMargin: number | null = null): Keep {
  const shelf = r.priceRatioUsed ?? 1;
  const r0 = r.priceBeforeTax ?? 1;
  const S = (x.wineSales ?? 0) * movedShare(x);
  const cost = 1 - (x.grossMargin ?? 0);
  if (x.revenueMode === "wholesale") {
    const k = shelf - (1 - (x.discount ?? 0));
    const mg = shelf > 0 ? k / shelf : NaN;
    return { perDollar: k, ownPrice: shelf, margin: mg, dollars: k * S, grocer: { perDollar: k, margin: mg } };
  }
  const tax = x.revenueMode === "excise" ? excisePerDollar(x) : x.revenueMode === "percent" ? (x.adValorem ?? 0) * r0 : 0;
  const own = shelf - tax;
  const k = own - cost;
  const g = wholesalerMargin !== null && wholesalerMargin >= 0 && wholesalerMargin < 1 ? own - cost / (1 - wholesalerMargin) : null;
  return { perDollar: k, ownPrice: own, margin: own > 0 ? k / own : NaN, dollars: k * S, grocer: g === null ? null : { perDollar: g, margin: own > 0 ? g / own : NaN } };
}

function breakEvenOf(id: "private" | "wholesale", x: ScenarioInputs, basis: "shift" | "all"): BreakEven {
  const lever = id === "private" ? "taxRate" : "discount";
  if (id === "wholesale") {
    const m = x.grossMargin!;
    const range: [number, number] = [0, Math.max(0, m)];
    const f = (d: number) => netOf({ ...x, discount: d }, basis);
    const s = solveLever(f, range[0], range[1]);
    if (!Number.isFinite(s.atLow)) return { lever, basis, range, status: "unavailable", value: null, best: null, note: "Not computable with these inputs." };
    if (s.atLow < 0)
      return { lever, basis, range, status: "none_in_range", value: null, best: s.best, note: "No discount works: even selling to grocers at the full state-store price, the state would collect less than today." };
    if (s.root === null) return { lever, basis, range, status: "found", value: range[1], best: null, note: "Any discount up to the whole gross margin keeps state revenue at or above today's." };
    return { lever, basis, range, status: "found", value: s.root, best: null, note: "The largest discount DABS could give grocers with state revenue unchanged." };
  }
  const excise = x.revenueMode === "excise";
  const G = x.wineGallons ?? 0;
  const W = x.wineSales ?? 0;
  if (excise && (!G || !W)) return { lever, basis, range: [0, 0], status: "unavailable", value: null, best: null, note: "An excise needs wine gallons." };
  // Supported range: a tax of up to the whole grocery price before tax, or an excise of up to the state-store price per gallon.
  const range: [number, number] = excise ? [0, W / G] : [0, 1];
  const f = (v: number) => netOf(excise ? { ...x, excise: v } : { ...x, adValorem: v }, basis);
  const s = solveLever(f, range[0], range[1]);
  if (!Number.isFinite(s.atLow)) return { lever, basis, range, status: "unavailable", value: null, best: null, note: "Not computable with these inputs." };
  if (s.atLow >= 0) return { lever, basis, range, status: "not_needed", value: 0, best: null, note: "No replacement tax is needed: the state collects at least today's revenue without one." };
  if (s.root === null)
    return {
      lever,
      basis,
      range,
      status: "none_in_range",
      value: null,
      best: s.best,
      note: excise
        ? "No excise up to the state-store price per gallon restores today's revenue."
        : "No tax up to 100% of the grocery price before tax restores today's revenue.",
    };
  return { lever, basis, range, status: "found", value: s.root, best: null, note: "The replacement tax at which state revenue is unchanged." };
}

/** The lever at which the state breaks even when sellers price to earn the gross margins entered (all of any replacement
 * tax on top of their price). Arrangement 1: the sellers' price is the cost of the wine grossed up by the wholesaler's
 * and the grocer's margins; arrangement 2: the grocer's price is what it pays DABS grossed up by its margin, so it
 * depends on the discount and is solved with it. */
function viabilityCase(id: "private" | "wholesale", x: ScenarioInputs, basis: "shift" | "all", w: number | null, g: number): ViabilityCase {
  const cost = 1 - (x.grossMargin ?? 0);
  const at = (v: ScenarioInputs) => {
    const r = compute(v);
    return { shelf: r.priceRatioUsed, factor: basis === "all" ? r.demandFactor : null };
  };
  if (id === "private") {
    if (w === null) return { status: "unavailable", lever: null, ownPrice: null, shelf: null, demandFactor: null, note: "Needs the private wholesaler's margin." };
    const own = cost / ((1 - w) * (1 - g));
    const xv: ScenarioInputs = { ...x, matchPrice: false, priceRatio: own, passThrough: null, taxToPrice: 1 };
    const be = breakEvenOf("private", xv, basis);
    if (be.status === "unavailable" || be.status === "none_in_range" || be.value === null) return { status: be.status, lever: null, ownPrice: own, shelf: null, demandFactor: null, note: be.note };
    const v: ScenarioInputs = x.revenueMode === "excise" ? { ...xv, excise: be.value } : { ...xv, adValorem: be.value };
    const p = at(v);
    return { status: be.status, lever: be.value, ownPrice: own, shelf: p.shelf, demandFactor: p.factor, note: "The replacement tax at which state revenue is unchanged when sellers earn the margins entered and add all of the tax to the shelf price." };
  }
  const m = x.grossMargin ?? 0;
  const xd = (d: number): ScenarioInputs => ({ ...x, matchPrice: false, priceRatio: (1 - d) / (1 - g), passThrough: null, discount: d });
  const s = solveLever((d) => netOf(xd(d), basis), 0, Math.max(0, m));
  if (!Number.isFinite(s.atLow)) return { status: "unavailable", lever: null, ownPrice: null, shelf: null, demandFactor: null, note: "Not computable with these inputs." };
  if (s.atLow < 0) return { status: "none_in_range", lever: null, ownPrice: 1 / (1 - g), shelf: 1 / (1 - g), demandFactor: null, note: "No discount works: even with no discount, and the grocer pricing for its margin, the state collects less than today." };
  const d = s.root ?? m;
  const p = at(xd(d));
  return { status: "found", lever: d, ownPrice: (1 - d) / (1 - g), shelf: p.shelf, demandFactor: p.factor, note: "The largest discount at which state revenue is unchanged when the grocer prices to earn the margin entered." };
}

function arrangement(id: "private" | "wholesale", base: ScenarioInputs, set: ArrangementSettings, opexShare: number | null): ArrangementResult {
  const x0 = arrangementInputs(base, set, id);
  const x = withMechanisms(x0, {});
  const entered = enteredMechanisms(base);
  const any = entered.price || entered.recapture || entered.access;
  const shift = compute(x);
  const missing = [...shift.missing];
  const invalid = [...shift.invalid];
  if (id === "private" && typeof set.wholesaleCost === "number" && (set.wholesaleCost < 0 || (base.avoidableCost ?? 0) + set.wholesaleCost > 1))
    invalid.push("Avoidable retail and wholesale costs together must be between 0% and 100%");
  if (id === "private" && set.taxKind === "percent" && typeof set.taxRate === "number" && set.taxRate > 2) invalid.push("The replacement tax cannot exceed 200% of the price");
  const ok = !missing.length && !invalid.length;
  const xAll = any ? withMechanisms(x0, entered, base) : null;
  const all = ok && xAll ? compute(xAll) : null;
  if (all && (all.missing.length || all.invalid.length)) {
    for (const m of all.missing) if (!missing.includes(m)) missing.push(m);
    for (const m of all.invalid) if (!invalid.includes(m)) invalid.push(m);
  }
  const ready = !missing.length && !invalid.length;
  const basis: "shift" | "all" = any ? "all" : "shift";
  const mechanisms: MechanismPart[] = (["price", "recapture", "access"] as MechanismId[]).map((m) => {
    if (!ready || !entered[m]) return { id: m, label: MECH_LABEL[m], entered: entered[m], net: null, dollars: null, gallons: null };
    const r = compute(withMechanisms(x0, { [m]: true }, base));
    const stream = r.extraStreams?.find((e) => e.id === m);
    return { id: m, label: MECH_LABEL[m], entered: true, net: (r.netB ?? 0) - r.netA, dollars: stream?.dollars ?? 0, gallons: x.wineGallons ? (stream?.gallons ?? 0) : null };
  });
  const head = ready ? (basis === "all" ? xAll! : x) : x;
  const reversals = ready ? sensitivity(head, basis === "all" ? "B" : "A").filter((z) => z.zero !== null) : [];
  const d = set.discount ?? 0;
  const t = x.salesTax ?? 0;
  const W = x.wineSales ?? 0;
  const S = W * movedShare(x);
  const breakEven: BreakEven = ready
    ? breakEvenOf(id, basis === "all" ? xAll! : x, basis)
    : { lever: id === "private" ? "taxRate" : "discount", basis, range: [0, 0], status: "unavailable", value: null, best: null, note: "Needs the inputs listed." };
  const atLever = (v: number): ScenarioInputs => (id === "wholesale" ? { ...x, discount: v } : x.revenueMode === "excise" ? { ...x, excise: v } : { ...x, adValorem: v });
  const w = set.wholesalerMargin;
  const beShift = ready ? (basis === "shift" ? breakEven : breakEvenOf(id, x, "shift")) : null;
  const sellersAtBreakEven = ready && beShift && beShift.value !== null && beShift.status !== "unavailable" ? sellersKeep(atLever(beShift.value), compute(atLever(beShift.value)), id === "private" ? w : null) : null;
  const priceMoves = ready && Math.abs((shift.priceRatioUsed ?? 1) - 1) > 1e-9;
  const g = set.grocerMargin;
  const viability: Viability | null =
    ready && g !== null && g >= 0 && g < 1 && (w === null || (w >= 0 && w < 1))
      ? { wholesaler: id === "private" ? w : null, grocer: g, shift: viabilityCase(id, x, "shift", w, g), all: any && xAll ? viabilityCase(id, xAll, "all", w, g) : null }
      : null;
  return {
    id,
    label: LABEL[id],
    x,
    missing,
    invalid,
    shift,
    all,
    lines: ready ? linesOf(x, shift) : null,
    netAll: all?.netB ?? null,
    mechanisms,
    volumeShift: ready ? volumeOf(x, shift) : null,
    volumeAll: ready && all && xAll ? volumeOf(xAll, all) : null,
    price: ready
      ? {
          beforeTax: shift.priceBeforeTax ?? 1,
          shelf: shift.priceRatioUsed ?? 1,
          withSalesTax: (shift.priceRatioUsed ?? 1) * (1 + t),
          retailerMargin: id === "wholesale" ? (shift.priceRatioUsed ?? 1) - (1 - d) : null,
        }
      : null,
    priceMoves,
    breakEven,
    breakEvenLinear: ready && entered.price && xAll && priceMoves ? breakEvenOf(id, { ...xAll, demandForm: "linear" }, "all") : null,
    channelReturn: ready && entered.price && priceMoves ? channelReturnOf(x0, base, entered, shift) : null,
    sellers: ready ? sellersKeep(x, shift, id === "private" ? w : null) : null,
    sellersAtBreakEven,
    viability,
    xAll,
    reversals,
    retainedCosts: id === "wholesale" && ready && opexShare !== null && opexShare >= (x.avoidableCost ?? 0) ? (opexShare - (x.avoidableCost ?? 0)) * S : null,
  };
}

/** Exploratory: the price response read as a return to state stores. The share of household purchases moving falls by
 * the demand factor at the arrangement's shelf price, no wine is lost, and the other entered purchase changes stay as
 * they are. The elasticity is market-wide; nothing measures switching between channels, so this is not evidence. */
function channelReturnOf(x0: ScenarioInputs, base: ScenarioInputs, entered: Record<MechanismId, boolean>, shift: ScenarioResult): ArrangementResult["channelReturn"] {
  const r = shift.priceRatioUsed ?? 1;
  const eps = base.elasticity ?? 0;
  const f = base.demandForm === "linear" ? Math.max(0, 1 + eps * (r - 1)) : Math.pow(r, eps);
  const s2 = (x0.shift ?? 0) * f;
  const rest = { recapture: entered.recapture, access: entered.access };
  const xr = withMechanisms({ ...x0, shift: s2 }, rest, { ...base, shift: s2 });
  const res = compute(xr);
  const any = rest.recapture || rest.access;
  return { net: any ? (res.netB ?? NaN) : res.netA, shareMoving: s2, x: xr, result: res, basis: any ? "all" : "shift" };
}

const REPLACEMENT_IDS = ["retained", "excise", "ad_valorem", "wholesale"];

/** What the arrangement itself collects on grocery wine: the replacement tax, or DABS's margin on its sales to grocers;
 * with the purchase changes, on the extra grocery wine too. */
export function replacementOf(r: ScenarioResult, basis: "shift" | "all"): number {
  const a = r.a.filter((c) => REPLACEMENT_IDS.includes(c.id)).reduce((s, c) => s + c.value, 0);
  if (basis === "shift") return a;
  return a + (r.b ?? []).filter((c) => REPLACEMENT_IDS.some((id) => c.id === `extra_${id}`)).reduce((s, c) => s + c.value, 0);
}

function earmark(set: ArrangementSettings, rates: DepositRates | null, base: ArrangementResult, settingsMissing: string[], basis: EarmarkCase, rule: EarmarkRule): EarmarkResult | null {
  if (!rates || !base.lines || settingsMissing.length) return null;
  const x = base.x;
  const W = x.wineSales!;
  // The scenario in this case: its inputs, result, which net it reports, and how much the state stores still sell.
  let xx: ScenarioInputs;
  let res: ScenarioResult;
  let resBasis: "shift" | "all";
  let net: number;
  if (basis === "shift") {
    xx = x;
    res = base.shift;
    resBasis = "shift";
    net = base.lines.net;
  } else if (basis === "all") {
    if (!base.all || !base.xAll || base.netAll === null) return null;
    xx = base.xAll;
    res = base.all;
    resBasis = "all";
    net = base.netAll;
  } else {
    if (!base.channelReturn) return null;
    xx = base.channelReturn.x;
    res = base.channelReturn.result;
    resBasis = base.channelReturn.basis;
    net = base.channelReturn.net;
  }
  const stateSales = volumeOf(xx, res).state;
  const lostSales = W - stateSales;
  const S0 = W * movedShare(x); // the sales the initial scenario moves (channel shift): the base of the fixed guarantee
  const rateSum = rates.school + rates.enforcement;
  const today = { school: rates.school * S0, enforcement: rates.enforcement * S0 };
  const fixed = rateSum * S0;
  const proportional = rateSum * Math.max(0, lostSales);
  const proceeds = replacementOf(res, resBasis);
  const share = rates.school / rateSum;
  let total: number;
  if (rule === "fixed") total = fixed;
  else if (rule === "proportional") total = proportional;
  else if (rule === "amount") total = set.earmarkValue ?? 0;
  else total = (set.earmarkValue ?? 0) * Math.max(0, proceeds);
  const allocation = { school: total * share, enforcement: total * (1 - share), total };
  const requirement = Math.max(0, total - proceeds);
  // Under current law the two funds keep today's deposits on what the state stores still sell; against today they lose
  // the deposits on the lost sales and gain the allocation.
  const fundsChange = total - rateSum * lostSales;
  // The lever at which the arrangement's own proceeds just cover the allocation, in this case (solved numerically, so a
  // price response that the tax sets off is included). Not solved in the exploratory return reading, where the share
  // that moves would change with the lever.
  let coverLever: EarmarkResult["coverLever"] = null;
  let coverNote = "";
  if (rule === "share") coverNote = "A share of the proceeds never exceeds them, so no other state money is needed.";
  else if (basis === "return") coverNote = "Not solved in the exploratory return reading: the share that moves would change with the lever.";
  else {
    const whole = base.id === "wholesale";
    const key = whole ? "discount" : xx.revenueMode === "excise" ? "excise" : "adValorem";
    const hi = whole ? x.grossMargin! : xx.revenueMode === "excise" ? (x.wineGallons ? W / x.wineGallons : 0) : 1;
    const f = (v: number) => {
      const r = compute({ ...xx, [key]: v });
      if (r.missing.length || r.invalid.length) return NaN;
      const due = rule === "proportional" ? rateSum * Math.max(0, W - volumeOf({ ...xx, [key]: v }, r).state) : total;
      return replacementOf(r, resBasis) - due;
    };
    const sol = solveLever(f, 0, hi);
    if (whole) {
      coverLever = sol.atLow < 0 ? null : { lever: "discount", value: sol.root ?? hi };
      coverNote = sol.atLow < 0 ? "No discount covers it: the allocation is larger than DABS's whole margin on the wine it sells to grocers." : "The largest discount at which DABS's margin on its sales to grocers still covers the allocation.";
    } else {
      coverLever = sol.atLow >= 0 ? { lever: "taxRate", value: 0 } : sol.root === null ? null : { lever: "taxRate", value: sol.root };
      coverNote = coverLever ? "The replacement tax at which its proceeds just cover the allocation." : "No replacement tax in the supported range raises enough to cover the allocation.";
    }
  }
  return {
    base: base.id,
    basis,
    rule,
    today,
    lostSales,
    proportional,
    fixed,
    proceeds,
    allocation,
    requirement,
    remainder: proceeds - total,
    fundsChange,
    othersChange: net - fundsChange,
    net,
    coverLever,
    coverNote,
  };
}

/** The settings each arrangement needs, and which are out of range. */
export function checkSettings(set: ArrangementSettings, rates: DepositRates | null): { missing: string[]; invalid: string[] } {
  const missing: string[] = [];
  const invalid: string[] = [];
  if (set.taxRate === null) missing.push(set.taxKind === "excise" ? "replacement excise per gallon (arrangement 1)" : "replacement tax rate (arrangement 1)");
  else if (set.taxRate < 0) invalid.push("The replacement tax cannot be negative");
  if (set.discount === null) missing.push("discount DABS gives grocers (arrangement 2)");
  if (typeof set.taxToPrice === "number" && (set.taxToPrice < 0 || set.taxToPrice > 1)) invalid.push("The share of the tax in the shelf price must be between 0% and 100%");
  if ((set.earmarkRule === "amount" || set.earmarkRule === "share") && set.earmarkValue === null) missing.push(set.earmarkRule === "amount" ? "amount allocated each year (arrangement 3)" : "share of the proceeds allocated (arrangement 3)");
  if (set.earmarkRule === "share" && typeof set.earmarkValue === "number" && (set.earmarkValue < 0 || set.earmarkValue > 1)) invalid.push("The share allocated must be between 0% and 100%");
  if (set.earmarkRule === "amount" && typeof set.earmarkValue === "number" && set.earmarkValue < 0) invalid.push("The amount allocated cannot be negative");
  for (const [v, label] of [
    [set.wholesalerMargin, "The private wholesaler's margin"],
    [set.grocerMargin, "The grocer's margin"],
  ] as [number | null, string][])
    if (typeof v === "number" && (v < 0 || v >= 1)) invalid.push(`${label} must be at least 0% and below 100%`);
  if (!rates) missing.push("statutory deposit rates for the base year (reconciliation data)");
  return { missing, invalid };
}

/** The three arrangements on the shared inputs. `opexShare` (DABS's operating expenses over its sales) is context only. */
export function compare(base: ScenarioInputs, set: ArrangementSettings, rates: DepositRates | null, opexShare: number | null = null): Comparison {
  const entered = enteredMechanisms(base);
  const own = checkSettings(set, rates);
  const priv = arrangement("private", base, set, opexShare);
  const whole = arrangement("wholesale", base, set, opexShare);
  const uniq = (xs: string[]) => [...new Set(xs)];
  // The lever inputs are reported by checkSettings in the comparison's own words; drop the scenario's wording of them.
  const dropLever = (xs: string[]) => xs.filter((m) => !["excise per gallon", "tax on the grocery shelf price", "discount DABS gives grocers"].includes(m));
  const missing = uniq([...own.missing, ...dropLever(priv.missing), ...dropLever(whole.missing)]);
  const invalid = uniq([...own.invalid, ...priv.invalid, ...whole.invalid]);
  const baseFor = set.earmarkBase === "wholesale" ? whole : priv;
  const ok = !invalid.length && !missing.length;
  const setFor = (rule: EarmarkRule): GuaranteeSet => ({
    rule,
    cases: (["shift", "all", "return"] as EarmarkCase[]).map((b) => earmark(set, rates, baseFor, own.missing, b, rule)).filter((e): e is EarmarkResult => e !== null),
  });
  const rules: EarmarkRule[] = set.earmarkRule === "fixed" ? ["fixed", "proportional"] : set.earmarkRule === "proportional" ? ["proportional", "fixed"] : [set.earmarkRule];
  const guarantees = ok ? rules.map(setFor) : [];
  const chosen = guarantees[0]?.cases ?? [];
  return {
    method: ARRANGEMENTS_METHOD,
    settings: set,
    priceCase: set.priceCase,
    missing,
    invalid,
    entered,
    headline: entered.price || entered.recapture || entered.access ? "all" : "shift",
    private: priv,
    wholesale: whole,
    earmarked: chosen.find((e) => e.basis === "shift") ?? null,
    earmarkedAll: chosen.find((e) => e.basis === "all") ?? null,
    earmarkedReturn: chosen.find((e) => e.basis === "return") ?? null,
    guarantees,
  };
}


// ----- one assumption at a time, as a chart ---------------------------------------------------------------------------

export type SweepKey = "avoidableCost" | "shift" | "eligible" | "priceRatio" | "grossMargin" | "elasticity" | "taxRate" | "discount";

export const SWEEPS: Record<SweepKey, { label: string; from: number; to: number; format: "percent" | "plain" | "money2"; note: string }> = {
  avoidableCost: { label: "Avoidable state operating cost (% of the sales that move)", from: 0, to: 0.3, format: "percent", note: "0% to 30%: DABS's operating expenses were about 15% of its sales in FY2025, an accounting ceiling for the whole business (its depreciation and interest, listed separately, are not costs that stop when sales move)." },
  shift: { label: "Share of household wine purchases moving to grocers", from: 0, to: 1, format: "percent", note: "0% to 100% of the household (eligible) wine purchases from state stores and agencies." },
  eligible: {
    label: "Household share of wine sales (could move; licensees keep buying from DABS)",
    from: 0.5,
    to: 1,
    format: "percent",
    note: "50% to 100%. DABS's FY2025 report puts off-premise sales (stores and agencies) at 82% of all its sales, all products; wine's split is not published.",
  },
  priceRatio: { label: "Grocery price before any replacement tax (% of the state-store price; entered-price case only)", from: 0.7, to: 1.3, format: "percent", note: "70% to 130%. At matched consumer prices the entered grocery price is not used." },
  grossMargin: { label: "Gross margin on wine", from: 0.3, to: 0.6, format: "percent", note: "30% to 60%; DABS's all-product margin and wine's statutory floor are both about 47%." },
  elasticity: { label: "Price elasticity of wine demand", from: -1.5, to: 0, format: "plain", note: "-1.5 to 0; Nelson (2013) puts wine at about -0.46." },
  taxRate: { label: "Replacement tax (arrangement 1's lever; arrangement 2 does not use it)", from: 0, to: 1, format: "percent", note: "0% to 100% of the grocery price before tax, or an excise up to the state-store price per gallon." },
  discount: { label: "Discount DABS gives grocers (arrangement 2's lever; arrangement 1 does not use it)", from: 0, to: 0.5, format: "percent", note: "0% to 50% off the state-store price." },
};

export interface SweepPoint {
  v: number;
  private: number | null;
  wholesale: number | null;
}

/** The headline net change of arrangements 1 and 2 as one assumption moves across its span, the others as entered. */
export function sweep(base: ScenarioInputs, set: ArrangementSettings, key: SweepKey, steps = 60): { key: SweepKey; from: number; to: number; points: SweepPoint[] } {
  const spec = SWEEPS[key];
  let from = spec.from;
  let to = spec.to;
  if (key === "taxRate" && set.taxKind === "excise") {
    from = 0;
    to = base.wineSales && base.wineGallons ? base.wineSales / base.wineGallons : 0;
  }
  const entered = enteredMechanisms(base);
  const any = entered.price || entered.recapture || entered.access;
  const points: SweepPoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const v = from + ((to - from) * i) / steps;
    const b2: ScenarioInputs = ["avoidableCost", "shift", "eligible", "priceRatio", "grossMargin", "elasticity"].includes(key) ? { ...base, [key]: v } : base;
    const s2: ArrangementSettings = key === "taxRate" ? { ...set, taxRate: v } : key === "discount" ? { ...set, discount: v } : set;
    const one = (id: "private" | "wholesale") => {
      if ((key === "taxRate" && id === "wholesale") || (key === "discount" && id === "private")) return null;
      const x0 = arrangementInputs(b2, s2, id);
      const xx = any ? withMechanisms(x0, entered, b2) : withMechanisms(x0, {});
      const r = compute(xx);
      if (r.missing.length || r.invalid.length) return null;
      return any ? r.netB : r.netA;
    };
    points.push({ v, private: one("private"), wholesale: one("wholesale") });
  }
  return { key, from, to, points };
}

/** Where a series in a sweep crosses zero (linear interpolation between grid points). */
export function zerosOf(points: SweepPoint[], id: "private" | "wholesale"): number[] {
  const out: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1][id];
    const b = points[i][id];
    if (a === null || b === null) continue;
    if (a === 0) out.push(points[i - 1].v);
    else if (Math.sign(a) !== Math.sign(b) && b !== 0) out.push(points[i - 1].v + ((points[i].v - points[i - 1].v) * a) / (a - b));
  }
  return out;
}

// ----- the price build-up -----------------------------------------------------------------------------------------------

export interface PriceLine {
  id: string;
  label: string;
  /** Per $1 of today's state-store shelf price (before sales tax), at the channel shift's prices. Null: not modelled. */
  today: number | null;
  private: number | null;
  wholesale: number | null;
  /** "price" rows add up to the shelf price; "ratio" rows are markups or margins, not added. */
  kind: "price" | "subtotal" | "tax" | "total" | "ratio";
  note: string;
}

/** How each arrangement's shelf price is built from the cost of the wine, per $1 of today's state-store price. The cost of
 * the wine is DABS's all-product share (1 - gross margin) for every arrangement: private wholesalers are assumed to pay
 * suppliers what DABS pays. A markup is on cost; a margin is on the selling price. */
export function priceBuildUp(c: Comparison): PriceLine[] {
  const P = c.private;
  const w = c.settings.wholesalerMargin;
  const Wh = c.wholesale;
  if (!P.lines || !Wh.lines || !P.price || !Wh.price) return [];
  const m = P.x.grossMargin!;
  const t = P.x.salesTax!;
  const cost = 1 - m;
  const d = Wh.x.discount ?? 0;
  const r0 = P.price.beforeTax;
  const shelfP = P.price.shelf;
  const W = P.x.wineSales!;
  const G = P.x.wineGallons ?? 0;
  const excise = P.x.revenueMode === "excise";
  const tax = excise ? (W > 0 ? ((P.x.excise ?? 0) * G) / W : 0) : (P.x.adValorem ?? 0) * r0;
  const absorbed = tax - (shelfP - r0); // the part of the tax sellers absorb
  const privMargin = r0 - cost - absorbed; // private wholesale and retail margin after any tax they absorb
  const shelfW = Wh.price.shelf;
  return [
    { id: "cost", label: "Cost of the wine to the first buyer (landed cost)", today: cost, private: cost, wholesale: cost, kind: "price", note: "1 − DABS's all-product gross margin; for arrangement 1 an assumption that private wholesalers pay suppliers what DABS pays." },
    { id: "state_margin", label: "State margin (DABS's markup earnings)", today: m, private: 0, wholesale: m - d, kind: "price", note: "Arrangement 2: DABS's charge to grocers (1 − discount) less the cost of the wine." },
    { id: "private_margin", label: "Private wholesale and retail margin", today: 0, private: privMargin, wholesale: shelfW - (1 - d), kind: "price", note: `Arrangement 1: wholesalers and grocers together, after any part of the tax they absorb${w === null ? " (split between them only when a wholesaler's margin is entered: no Utah data)" : ""}. Arrangement 2: the grocer's margin over what it pays DABS. Their own costs come out of it.` },
    ...(w !== null
      ? [
          { id: "wholesaler_margin", label: "of which the private wholesaler (at the margin entered)", today: null, private: cost / (1 - w) - cost, wholesale: null, kind: "ratio" as const, note: `${(100 * w).toFixed(1)}% of the wholesaler's own price, an assumption. Not added again.` },
          { id: "grocer_margin", label: "of which the grocer", today: null, private: privMargin - (cost / (1 - w) - cost), wholesale: shelfW - (1 - d), kind: "ratio" as const, note: "What is left after paying the wholesaler. Not added again." },
        ]
      : []),
    {
      id: "replacement_tax",
      label: excise ? "Replacement tax (per gallon, as a share of today's price)" : "Replacement tax in the price (on the grocery price before the tax)",
      today: 0,
      private: shelfP - r0,
      wholesale: 0,
      kind: "tax",
      note: P.x.matchPrice
        ? `Matched consumer prices: the shelf price stays at today's, so the tax is inside it and the sellers' own price is ${(100 * r0).toFixed(1)}% of today's${excise ? "" : ` (the ${(100 * (P.x.adValorem ?? 0)).toFixed(1)}% tax is levied on that price, its base, before sales tax)`}.`
        : excise
          ? "A per-volume excise; the share reaching the shelf as entered."
          : `A retail-level tax of ${(100 * (P.x.adValorem ?? 0)).toFixed(1)}% on the grocery price before the tax and before sales tax (its base), ${(100 * (P.x.taxToPrice ?? 1)).toFixed(0)}% of it added to the shelf price.`,
    },
    { id: "shelf", label: "Shelf price before sales tax", today: 1, private: shelfP, wholesale: shelfW, kind: "subtotal", note: "The sales-tax base." },
    { id: "sales_tax", label: "State sales tax", today: t, private: t * shelfP, wholesale: t * shelfW, kind: "tax", note: "State portion only, on the shelf price including any replacement tax in it. Local sales tax is not modelled." },
    { id: "consumer", label: "Consumer price with state sales tax", today: 1 + t, private: shelfP * (1 + t), wholesale: shelfW * (1 + t), kind: "total", note: "" },
    { id: "state_markup", label: "State markup on the cost of the wine", today: m / cost, private: null, wholesale: (m - d) / cost, kind: "ratio", note: "A markup is on cost; DABS's 88.5% statutory minimum is on landed case cost. Not added." },
    { id: "private_markup", label: "Private markup on the cost of the wine", today: null, private: privMargin / cost, wholesale: (shelfW - (1 - d)) / (1 - d), kind: "ratio", note: "Arrangement 1: wholesalers and grocers together on the cost of the wine. Arrangement 2: the grocer's markup on what it pays DABS. Not added." },
  ];
}

// ----- joint scenarios --------------------------------------------------------------------------------------------------

/** Documented bounds from the base year's accounts (all products; shares of DABS's sales at state-store prices). */
export interface Bounds {
  /** Card fees, package agency contracts and bags: lines that move with sales. */
  avoidLow: number;
  /** The same plus every salary and wage: an upper accounting bound, not a saving. */
  avoidHigh: number;
  /** All operating expenses (DABS's income statement; its five-year summary labels the same total operating and
   * non-operating, but depreciation and interest are listed separately as non-operating): the mathematical ceiling. */
  avoidCeiling: number;
  /** Delivery to stores: stops only if the state stops wholesaling the wine (arrangement 1). */
  delivery: number;
  /** Lowest and highest all-product gross margin DABS reported over the years in the dataset. */
  marginLow: number;
  marginHigh: number;
}

export interface JointRow {
  id: string;
  label: string;
  standing: "as entered" | "documented bounds" | "exploratory" | "mathematical only";
  what: string;
  private: { net: number | null; breakEven: number | null; status: BreakEven["status"] };
  wholesale: { net: number | null; breakEven: number | null; status: BreakEven["status"] };
}

/** A handful of joint scenarios that move several assumptions together, each labelled by what supports it. The policy
 * levers (the replacement tax and the discount) stay as entered, so each row also reports the lever value at which it
 * would break even. These are not probabilities. */
export function jointScenarios(base: ScenarioInputs, set: ArrangementSettings, rates: DepositRates | null, b: Bounds): JointRow[] {
  const one = (bx: ScenarioInputs, sx: ArrangementSettings, id: "private" | "wholesale") => {
    const c = compare(bx, sx, rates);
    const a = id === "private" ? c.private : c.wholesale;
    return { net: c.headline === "all" ? a.netAll : (a.lines?.net ?? null), breakEven: a.breakEven.value, status: a.breakEven.status };
  };
  const pctT = (v: number) => `${(v * 100).toFixed(1)}%`;
  const rows: JointRow[] = [];
  // Arrangement 2 can be given its own inputs (the parity row changes arrangement 1's price only).
  const push = (id: string, label: string, standing: JointRow["standing"], what: string, bx: ScenarioInputs, sx: ArrangementSettings, bw: ScenarioInputs = bx, sw: ArrangementSettings = sx) =>
    rows.push({ id, label, standing, what, private: one(bx, sx, "private"), wholesale: one(bw, sw, "wholesale") });
  push("entered", "As entered", "as entered", "Every input as entered above.", base, set);
  push(
    "favourable",
    "Costs and margin at the state-favourable ends of the documented bounds",
    "documented bounds",
    `Avoidable store cost ${pctT(b.avoidHigh)} (card fees, agency contracts, bags and every salary); arrangement 1 also stops delivery (${pctT(b.delivery)}); gross margin ${pctT(b.marginLow)}, the lowest DABS reported. Upper accounting bounds, not measured savings.`,
    { ...base, avoidableCost: b.avoidHigh, grossMargin: b.marginLow },
    { ...set, wholesaleCost: b.delivery },
  );
  push(
    "unfavourable",
    "Costs and margin at the state-unfavourable ends of the documented bounds",
    "documented bounds",
    `Avoidable store cost ${pctT(b.avoidLow)} (only the lines that move with sales); no wholesaling cost stops; gross margin ${pctT(b.marginHigh)}, the highest DABS reported.`,
    { ...base, avoidableCost: b.avoidLow, grossMargin: b.marginHigh },
    { ...set, wholesaleCost: 0 },
  );
  push(
    "favourable_more",
    "The favourable bounds, half of household wine purchases moving and half the new costs",
    "exploratory",
    `As the favourable row, with 50% of household purchases moving and new costs halved. Neither has a source.`,
    { ...base, avoidableCost: b.avoidHigh, grossMargin: b.marginLow, shift: 0.5, newCosts: (base.newCosts ?? 0) / 2 },
    { ...set, wholesaleCost: b.delivery },
  );
  if (set.priceCase === "entered")
    push(
      "parity",
      "Matched consumer prices (the reference case)",
      "exploratory",
      "Grocers charge what a state store charges for the same wine, any replacement tax inside that price: sellers bear the tax and no price response follows. Otherwise as entered.",
      base,
      { ...set, priceCase: "matched" },
    );
  else if (base.priceRatio !== null && base.priceRatio !== undefined)
    push(
      "parity",
      "The entered grocery price, the tax added to the shelf (the alternative price case)",
      "exploratory",
      `A grocery price before tax of ${pctT(base.priceRatio)} of today's, with ${pctT(set.taxToPrice ?? 1)} of the replacement tax added to the shelf price, and any price response entered. Otherwise as entered.`,
      base,
      { ...set, priceCase: "entered" },
    );
  push(
    "access",
    "An access effect at the low end of privatization studies",
    "exploratory",
    "Wine bought in total rises 4.5% (the lower quartile of the per-capita sales increases after full retail privatization in the Community Guide review), all of it from grocers. Full privatization elsewhere is not grocery licensing in Utah; this is extra drinking, not substitution.",
    { ...base, extra: true, growth: 0.045, extraGrocery: 1, elasticity: base.extra ? base.elasticity : null, recapture: base.extra ? base.recapture : null },
    set,
  );
  push(
    "ceiling",
    "Every DABS operating expense avoidable",
    "mathematical only",
    `Avoidable cost ${pctT(b.avoidCeiling)} of the sales that move (all operating expenses, fixed costs included; the non-operating depreciation and interest are not), gross margin ${pctT(b.marginLow)}, no new costs. Not supported by any evidence; shown to bound what is arithmetically possible.`,
    { ...base, avoidableCost: b.avoidCeiling, grossMargin: b.marginLow, newCosts: 0 },
    { ...set, wholesaleCost: 0 },
  );
  return rows;
}
