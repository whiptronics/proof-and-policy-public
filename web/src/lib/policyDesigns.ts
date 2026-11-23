// Policy design comparison (method POLICY_DESIGNS_METHOD): the maintainer's development plan of 2026-11-19 asks for five
// distribution arrangements, compared on the same accounting, with prices that respond to how purchases choose a channel,
// break-even conditions and a transparent comparison. Nothing here is a second engine. Every dollar comes from the
// alternatives (lib/wineAlternatives.ts evaluateFixed, which runs lib/scenario.ts compute) and producer-direct supply
// (lib/producerDirect.ts). The closed forms below restate the engine's own fixed-volume arithmetic so a frontier can be
// drawn; policyDesigns.test.ts checks them against the engine at every point it reports.
//
// The plan's letters are not the engine's. The plan's A is today (the engine's "today" column). Its B, DABS wholesale to
// grocers, is the engine's group A and B designs, and the headline is A_target. Its C, private wholesale, is C_take. Its D,
// direct supply, is the engine's D. Its E, a hybrid, is new and built here from B and C. The engine's ids stay as they
// are, because they are in exports, file names and tests.
//
// Rules carried from the plan:
// * Savings: allocated store costs are not counted as saved in any headline. The FY2025 card-fee, agency and bag lines
//   (2.28 cents per dollar that leaves) and the longer-run wage case are shown beside it as illustrative.
// * Channel choice: the share of household purchases that moves is not price-blind here. It falls in a straight line from
//   the engine's 30% at equal prices to zero at a "convenience limit". The limits are the purchase-flow model's 15%, 30%
//   and 60% (F20), which are illustrative and have no source. The fixed share is kept as one case and labeled.
// * Break-evens are bounded. A share that moves is in [0, 1], a margin is in [0, 1), and a price to grocers is no lower
//   than what DABS pays. A solver never finds break-even by adding demand.
// * No single score. The comparison reports every criterion, the designs no other design beats on all three computed
//   criteria (Pareto), and a classification whose thresholds are inputs. The defaults are stated and never tuned to a
//   result.
import { bottleScale } from "./bottle";
import { amendmentsFor, openQuestionsFor } from "./statutes";
import { DIRECT_COST_SHARES, PRODUCER_PREMIUMS, directDef } from "./producerDirect";
import { COST_LINES, RETAILER_TARGET, WHOLESALER_MARGIN, alternativeById, distributorMargin, evaluateFixed, leverOf, type AltDef, type FixedCase, type Overrides } from "./wineAlternatives";
import { minus } from "./format";

export const POLICY_DESIGNS_METHOD = "policy-designs@1.0";

// ----- savings cases and channel choice ---------------------------------------------------------------------------------

export type SavingsCase = "none" | "allocated" | "longer_run";

export const SAVINGS_CASES: { id: SavingsCase; label: string; perDollar: { shortRun: number; conditional: number }; evidence: string; note: string }[] = [
  {
    id: "none",
    label: "No store costs counted as saved",
    perDollar: { shortRun: 0, conditional: 0 },
    evidence: "headline rule",
    note: "No avoidable DABS cost is measured. The plan's rule: zero in the main result, illustrative savings apart.",
  },
  {
    id: "allocated",
    label: `FY2025 card fees, agency contracts and bags, allocated by sales (${(COST_LINES.shortRun * 100).toFixed(2)}¢ per $)`,
    perDollar: { shortRun: COST_LINES.shortRun, conditional: 0 },
    evidence: "illustrative",
    note: "An allocation of accounting expense categories by sales share, not a measured or realized saving. Card fees plausibly fall with sales. Agency contracts fall only if the wine that moves came from agencies paid by volume. Bags are small.",
  },
  {
    id: "longer_run",
    label: `Plus wages falling in proportion to sales (+${(COST_LINES.wages * 100).toFixed(2)}¢ per $)`,
    perDollar: { shortRun: COST_LINES.shortRun, conditional: COST_LINES.wages },
    evidence: "illustrative",
    note: "Only if staffing were cut in proportion to the sales that leave, after a transition. No staffing plan exists.",
  },
];

/** The purchase-flow model's convenience limits (F20): the grocery price premium at which no household moves. */
export const CONVENIENCE_LIMITS = [0.6, 0.3, 0.15] as const;

/** Share of household purchases that moves at a consumer price premium, under a convenience limit (null: fixed share). */
export function shareMoving(base: number, premium: number, limit: number | null): number {
  if (limit === null || premium <= 0) return base;
  if (!(limit > 0)) throw new Error("the convenience limit must be above zero");
  return base * Math.min(1, Math.max(0, 1 - premium / limit));
}

// ----- the five arrangements ----------------------------------------------------------------------------------------------

export type DesignId = "A" | "B" | "C" | "D" | "E";

export interface DesignDef {
  id: DesignId;
  label: string;
  short: string;
  path: string;
  /** The engine alternative behind it (null for today and the hybrid). */
  engine: string | null;
  legalStatus: string;
}

export const DESIGNS: DesignDef[] = [
  { id: "A", label: "A. Current Utah system", short: "A: today", path: "Producer or importer → DABS → state store or package agency → consumer", engine: null, legalStatus: "Current law." },
  {
    id: "B",
    label: "B. DABS wholesale to licensed grocers",
    short: "B: DABS wholesale",
    path: "Producer or importer → DABS → licensed grocer → consumer",
    engine: "A_target",
    legalStatus: "Needs a grocery wine license and authority for DABS to sell to grocers for resale. The 88.5% markup floor holds only at a price to grocers of at least 99.5% of the shelf price.",
  },
  {
    id: "C",
    label: "C. Licensed private wholesale",
    short: "C: private wholesale",
    path: "Producer or importer → licensed private wholesaler → licensed grocer → consumer",
    engine: "C_take",
    legalStatus: "Needs private wholesale licenses, a state charge with new taxing authority, and the grocery license.",
  },
  {
    id: "D",
    label: "D. Authorized direct supply",
    short: "D: direct supply",
    path: "Producer, importer or qualifying winery → licensed grocer → consumer",
    engine: "D_direct",
    legalStatus: "A legislative alternative, not current law. Needs authority for producers to sell to grocers, a charge, and the grocery license. Federal permits apply (see the framework).",
  },
  {
    id: "E",
    label: "E. Hybrid: DABS supplies part, licensed private or direct supply the rest",
    short: "E: hybrid",
    path: "DABS → grocer for part of the range; licensed wholesaler or producer → grocer for the rest",
    engine: null,
    legalStatus: "Needs everything B and C need, and rules for which products go which way.",
  },
];

/** Illustrative: a second collection and licensing system for the hybrid, as a share of the $500,000 first one. */
export const HYBRID_EXTRA_ADMIN_SHARE = 0.5;
/** Illustrative: the hybrid's share of grocery wine supplied by DABS. */
export const HYBRID_DABS_SHARE = 0.5;
/** Illustrative bottles: landed cost to DABS, $ per 750 ml. Price points, not products: no product's procurement cost is
 * in the dataset, and none is worked back from a shelf price. */
export const BASKET: { id: string; label: string; landed: number }[] = [
  { id: "value", label: "Value", landed: 5 },
  { id: "everyday", label: "Everyday table", landed: 8 },
  { id: "midrange", label: "Midrange", landed: 12 },
  { id: "premium", label: "Premium", landed: 20 },
];
/** Utah supermarkets and other grocery stores, CBP 2023 (NAICS 445110, dataset cbp_establishments_naics_445110). */
export const UTAH_GROCERY_ESTABLISHMENTS = { count: 411, year: 2023, metric: "cbp_establishments_naics_445110@calendar_year" } as const;

const engineDef = (d: DesignDef): AltDef => (d.engine === "D_direct" ? directDef() : alternativeById(d.engine!));

const overrides = (s: SavingsCase, extra: Overrides = {}): Overrides => ({ ...extra, avoided: SAVINGS_CASES.find((c) => c.id === s)!.perDollar });

function fixed(def: AltDef, o: Overrides): FixedCase {
  const k = evaluateFixed(def, o);
  if (!k) throw new Error(`${def.id}: the engine reports missing or invalid inputs`);
  return k;
}

// ----- the base terms, read from the engine (never retyped) ---------------------------------------------------------------

export interface Terms {
  /** All DABS wine, $ a year at state-store prices; the households' share; the share that moves at equal prices. */
  wine: number;
  household: number;
  shift: number;
  /** DABS's gross margin, its landed cost (1 − margin), and the state sales tax rate. */
  margin: number;
  landed: number;
  salesTax: number;
  /** New administration, $ a year (illustrative). */
  admin: number;
  /** The engine's wine moved at the fixed share, $ a year at state-store prices (read from its ledger). */
  moved: number;
}

export function terms(): Terms {
  const k = fixed(alternativeById("A_target"), overrides("none"));
  const x = k.built.x;
  return {
    wine: k.ledger.volume.baseline,
    household: x.eligible ?? 1,
    shift: x.shift ?? 0,
    margin: k.stack.today.dabsMargin,
    landed: k.stack.today.acquisition,
    salesTax: k.stack.today.stateSalesTax,
    admin: x.newCosts ?? 0,
    moved: k.ledger.volume.grocery,
  };
}

// ----- closed forms: the revenue-neutrality frontier ----------------------------------------------------------------------

/** Where the state's take sits. "wholesale_price": inside DABS's price to grocers, so the grocer's percentage margin applies
 * to it (design B). "retail_charge": a charge on the grocer's price before the charge, so no seller's margin applies to it
 * (designs C and D; a DABS that sold at cost plus a retail-level charge is the same arithmetic). */
export type TakeStructure = "wholesale_price" | "retail_charge";

export interface FrontierInputs {
  /** Distribution margin between DABS's landed cost and the grocer's cost, share of the distributor's price (retail_charge
   * only; zero means delivery costs nothing). */
  distribution: number;
  /** Avoided DABS cost per $ that moves, and new administration per $ that moves. */
  savings: number;
  adminPerDollar: number;
  /** Extra cost of supplying grocers per $ (wholesale_price only; DABS keeps its existing wholesale costs). */
  handling: number;
}

/** Net change for the state per $ of wine that moves (state-store prices), at a consumer price P per $1 of today's (both
 * include state sales tax at the same rate) and a grocer gross margin g on its own price before any charge. */
export function netPerDollar(s: TakeStructure, P: number, g: number, t: Terms, f: FrontierInputs): number {
  const tax = t.salesTax * (P - 1);
  if (s === "wholesale_price") {
    const pd = P * (1 - g); // what the grocer pays DABS
    return pd - t.landed - t.margin + tax + f.savings - f.handling - f.adminPerDollar;
  }
  const Q = t.landed / ((1 - f.distribution) * (1 - g)); // the sellers' price before the charge
  return P - Q - t.margin + tax + f.savings - f.adminPerDollar;
}

/** The highest grocer gross margin at which the state breaks even at consumer price P (may be negative: no margin works). */
export function maxGrocerMargin(s: TakeStructure, P: number, t: Terms, f: FrontierInputs): number {
  const tax = t.salesTax * (P - 1);
  if (s === "wholesale_price") return 1 - (t.landed + t.margin - tax - f.savings + f.handling + f.adminPerDollar) / P;
  const room = P - t.margin + tax + f.savings - f.adminPerDollar; // what is left for the sellers' price
  return room > 0 ? 1 - t.landed / ((1 - f.distribution) * room) : -Infinity;
}

/** The lowest consumer price (per $1 of today's) at which the state breaks even with the grocer earning margin g. */
export function minPrice(s: TakeStructure, g: number, t: Terms, f: FrontierInputs): number {
  const r = t.salesTax;
  if (s === "wholesale_price") return (t.landed + t.margin + r - f.savings + f.handling + f.adminPerDollar) / (1 - g + r);
  const Q = t.landed / ((1 - f.distribution) * (1 - g));
  return (Q + t.margin + r - f.savings + f.adminPerDollar) / (1 + r);
}

/** The largest distribution margin at which a retail-charge design breaks even at consumer price P and grocer margin g. */
export function maxDistribution(P: number, g: number, t: Terms, f: Omit<FrontierInputs, "distribution">): number {
  const room = P - t.margin + t.salesTax * (P - 1) + f.savings - f.adminPerDollar;
  return room > 0 ? 1 - t.landed / ((1 - g) * room) : -Infinity;
}

/** The what-if panel's inputs: B's structure (DABS at today's shelf price, take inside the wholesale price) and C's
 * (a retail-level charge equal to DABS's margin on top of a private wholesaler's price), recomputed by the closed forms. */
export interface WhatIfInputs {
  grocerMargin: number;
  distribution: number;
  limit: number | null;
  savings: SavingsCase;
  admin: number;
  feesCoverAdmin: boolean;
}

export interface WhatIfResult {
  premium: number;
  share: number;
  moved: number;
  net: number;
}

export function whatIfDesigns(t: Terms, w: WhatIfInputs): Record<"B" | "C", WhatIfResult> {
  const v = SAVINGS_CASES.find((s) => s.id === w.savings)!.perDollar;
  const admin = w.feesCoverAdmin ? 0 : w.admin;
  const one = (s: TakeStructure): WhatIfResult => {
    const P = s === "wholesale_price" ? 1 / (1 - w.grocerMargin) : t.landed / ((1 - w.distribution) * (1 - w.grocerMargin)) + t.margin;
    const share = shareMoving(t.shift, P - 1, w.limit);
    const moved = (t.moved * share) / t.shift;
    const per = netPerDollar(s, P, w.grocerMargin, t, { distribution: w.distribution, savings: v.shortRun + v.conditional, adminPerDollar: 0, handling: 0 });
    return { premium: P - 1, share, moved, net: per * moved - admin };
  };
  return { B: one("wholesale_price"), C: one("retail_charge") };
}

// ----- one design under one savings case and one channel-choice case --------------------------------------------------------

export interface Flow {
  party: "supplier" | "dabs" | "distributor" | "grocer" | "state_charge" | "state_sales_tax";
  label: string;
  /** Per $1 of today's state-store shelf price before sales tax (the consumer pays the sum). */
  perDollar: number;
  /** $ a year on the wine that moves. */
  annual: number;
  /** Kept by the state: DABS's gross margin (before its operating costs), a charge, or sales tax. */
  state: boolean;
}

export interface DesignCase {
  savings: SavingsCase;
  /** null: the fixed 30% share; otherwise the convenience limit. */
  limit: number | null;
  shift: number;
  moved: number;
  net: number;
  /** The same with license fees that cover the new administration exactly (a design choice, not a result). */
  netWithFees: number;
  /** State receipts on the wine that moves (DABS gross margin + charges + state sales tax), $ a year, today and after. */
  gross: { today: number; after: number };
}

export interface DesignResult {
  def: DesignDef;
  /** Price per $1 of today's shelf price before sales tax, and the consumer price change against a state store. */
  shelf: number;
  premium: number;
  grocerMargin: number | null;
  sellersBelowCost: boolean;
  /** DABS's price to grocers as a share of its shelf price (B), or the charge rate on the price before it (C, D). */
  lever: { priceToGrocers: number | null; chargeRate: number | null };
  structure: TakeStructure | null;
  distribution: number | null;
  flows: { today: Flow[]; after: Flow[] };
  basket: { id: string; label: string; landed: number; stateStore: number; grocery: number }[];
  cases: DesignCase[];
  breakEven: BreakEvens;
  /** Share of DABS's wine sales (all buyers) that leaves its stores, fixed share and at the 30% convenience limit. */
  dabsVolumeLost: { fixed: number; limit30: number };
}

export interface BreakEvens {
  /** The lowest state take per $1 of today's price at which the state breaks even, by savings case (DABS's margin today
   * is `terms().margin`). B: DABS's lowest price to grocers. C, D: the lowest charge. */
  minTake: Record<SavingsCase, number | null>;
  /** The smallest share of household purchases that must move to cover the fixed administration (null: never). */
  minShift: Record<SavingsCase, number | null>;
  /** Avoided cost per $ needed to break even at the design's own lever (0 when it is ahead with none). */
  savingsNeeded: number;
  /** The lowest premium compatible with breaking even at the reference grocer margin, with no savings and with allocated. */
  minPremiumAtReference: Record<SavingsCase, number>;
  /** The grocer margin left at a 10% premium with the state breaking even (no savings). */
  grocerMarginAt10: number;
}

function flowsOf(k: FixedCase, moved: number): { today: Flow[]; after: Flow[] } {
  const col = (c: FixedCase["stack"]["today"]): Flow[] => [
    { party: "supplier", label: "Producer or importer (landed cost)", perDollar: c.acquisition, annual: c.acquisition * moved, state: false },
    { party: "dabs", label: "DABS gross margin (before its operating costs)", perDollar: c.dabsMargin, annual: c.dabsMargin * moved, state: true },
    { party: "distributor", label: "Wholesaler or producer delivery", perDollar: c.wholesaleMargin, annual: c.wholesaleMargin * moved, state: false },
    { party: "grocer", label: "Grocer gross margin (before its costs)", perDollar: c.retailerMargin, annual: c.retailerMargin * moved, state: false },
    { party: "state_charge", label: "State charge on grocery wine", perDollar: c.chargeInPrice + c.chargeAbsorbed, annual: (c.chargeInPrice + c.chargeAbsorbed) * moved, state: true },
    { party: "state_sales_tax", label: "State sales tax", perDollar: c.stateSalesTax, annual: c.stateSalesTax * moved, state: true },
  ];
  return { today: col(k.stack.today), after: col(k.stack.after) };
}

const grossOf = (fl: Flow[]) => fl.filter((f) => f.state).reduce((s, f) => s + f.annual, 0);

function caseOf(def: AltDef, s: SavingsCase, limit: number | null, t: Terms, premium: number): DesignCase {
  const shift = shareMoving(t.shift, premium, limit);
  const k = fixed(def, overrides(s, { shift }));
  const moved = k.ledger.volume.grocery;
  const fl = flowsOf(k, moved);
  return { savings: s, limit, shift, moved, net: k.ledger.net, netWithFees: k.ledger.net + t.admin, gross: { today: grossOf(fl.today), after: grossOf(fl.after) } };
}

function frontierInputs(d: DesignDef, def: AltDef, s: SavingsCase, t: Terms): FrontierInputs {
  const v = SAVINGS_CASES.find((c) => c.id === s)!.perDollar;
  return { distribution: d.id === "B" ? 0 : (distributorMargin(def) ?? WHOLESALER_MARGIN), savings: v.shortRun + v.conditional, adminPerDollar: t.admin / t.moved, handling: 0 };
}

function breakEvens(d: DesignDef, def: AltDef, t: Terms, structure: TakeStructure): BreakEvens {
  const ids: SavingsCase[] = ["none", "allocated", "longer_run"];
  const minTake = {} as Record<SavingsCase, number | null>;
  const minShift = {} as Record<SavingsCase, number | null>;
  const minPremiumAtReference = {} as Record<SavingsCase, number>;
  for (const s of ids) {
    const o = overrides(s);
    if (structure === "wholesale_price") {
      const l = leverOf({ ...alternativeById("A_net"), id: `${def.id}_be` }, o);
      minTake[s] = 1 - l.discount - t.landed;
    } else {
      const l = leverOf({ ...def, id: `${def.id}_be`, charge: { ...def.charge!, size: "break_even" } }, o);
      const k = evaluateFixed(def, { ...o, chargeRate: l.charge });
      minTake[s] = k && Number.isFinite(l.charge) ? (k.stack.charge?.perDollar ?? null) : null;
    }
    // The engine is linear in the share that moves: the slope from no movement to the fixed share.
    const k0 = fixed(def, overrides(s, { shift: 0 }));
    const slope = (fixed(def, o).ledger.net - k0.ledger.net) / t.shift;
    minShift[s] = slope > 0 ? Math.min(1, -k0.ledger.net / slope) : null;
    minPremiumAtReference[s] = minPrice(structure, RETAILER_TARGET, t, frontierInputs(d, def, s, t)) - 1;
  }
  const net0 = fixed(def, overrides("none")).ledger.net;
  return {
    minTake,
    minShift,
    savingsNeeded: Math.max(0, -net0 / t.moved),
    minPremiumAtReference,
    grocerMarginAt10: maxGrocerMargin(structure, 1.1, t, frontierInputs(d, def, "none", t)),
  };
}

function evaluateDesign(d: DesignDef, t: Terms): DesignResult {
  if (d.id === "A") {
    const k = fixed(alternativeById("A_target"), overrides("none"));
    const fl = flowsOf(k, t.moved);
    const zero = (s: SavingsCase, limit: number | null): DesignCase => ({ savings: s, limit, shift: 0, moved: 0, net: 0, netWithFees: 0, gross: { today: grossOf(fl.today), after: grossOf(fl.today) } });
    return {
      def: d,
      shelf: 1,
      premium: 0,
      grocerMargin: null,
      sellersBelowCost: false,
      lever: { priceToGrocers: null, chargeRate: null },
      structure: null,
      distribution: null,
      flows: { today: fl.today, after: fl.today },
      basket: BASKET.map((b) => ({ ...b, stateStore: bottleScale(k.stack.today, b.landed) * k.stack.today.consumer, grocery: NaN })),
      cases: SAVINGS_CASES.flatMap((s) => [null, ...CONVENIENCE_LIMITS].map((l) => zero(s.id, l))),
      breakEven: { minTake: { none: null, allocated: null, longer_run: null }, minShift: { none: null, allocated: null, longer_run: null }, savingsNeeded: 0, minPremiumAtReference: { none: NaN, allocated: NaN, longer_run: NaN }, grocerMarginAt10: NaN },
      dabsVolumeLost: { fixed: 0, limit30: 0 },
    };
  }
  if (d.id === "E") return hybrid(d, t);
  const def = engineDef(d);
  const k = fixed(def, overrides("none"));
  const st = k.stack;
  const premium = st.consumerChange;
  const structure: TakeStructure = def.supply === "dabs" ? "wholesale_price" : "retail_charge";
  const cases = SAVINGS_CASES.flatMap((s) => [null, ...CONVENIENCE_LIMITS].map((l) => caseOf(def, s.id, l, t, premium)));
  const c30 = cases.find((c) => c.savings === "none" && c.limit === 0.3)!;
  return {
    def: d,
    shelf: st.after.shelf,
    premium,
    grocerMargin: st.retailerMarginShare,
    sellersBelowCost: st.belowCost.grocer || st.belowCost.sellersTogether,
    lever: { priceToGrocers: def.supply === "dabs" ? 1 - (k.built.set.discount ?? 0) : null, chargeRate: def.supply === "dabs" ? null : (st.charge?.rateOnBase ?? null) },
    structure,
    distribution: structure === "retail_charge" ? distributorMargin(def) : null,
    flows: flowsOf(k, k.ledger.volume.grocery),
    basket: BASKET.map((b) => ({ ...b, stateStore: bottleScale(st.today, b.landed) * st.today.consumer, grocery: bottleScale(st.today, b.landed) * st.after.consumer })),
    cases,
    breakEven: breakEvens(d, def, t, structure),
    dabsVolumeLost: { fixed: k.ledger.volume.grocery / t.wine, limit30: c30.moved / t.wine },
  };
}

/** The hybrid: DABS supplies a share h of grocery wine (B's terms), licensed private supply the rest (C's terms). Each
 * part's participation responds to its own premium. The engine is linear in the share that moves (tested), so each part's
 * net is its per-dollar result on its own volume; administration is counted once for the first system plus an
 * illustrative second system. */
function hybrid(d: DesignDef, t: Terms, h = HYBRID_DABS_SHARE): DesignResult {
  const b = engineDef(DESIGNS[1]);
  const c = engineDef(DESIGNS[2]);
  const kb = fixed(b, overrides("none"));
  const kc = fixed(c, overrides("none"));
  const moved = t.moved;
  const extra = HYBRID_EXTRA_ADMIN_SHARE * t.admin;
  // Each part's result before administration, scaled from the fixed share to this part's share (the engine is linear).
  const part = (def: AltDef, s: SavingsCase, shift: number) => (fixed(def, overrides(s)).ledger.net + t.admin) * (shift / t.shift);
  const cases: DesignCase[] = SAVINGS_CASES.flatMap((s) =>
    [null, ...CONVENIENCE_LIMITS].map((limit) => {
      const sb = h * shareMoving(t.shift, kb.stack.consumerChange, limit);
      const sc = (1 - h) * shareMoving(t.shift, kc.stack.consumerChange, limit);
      const net = part(b, s.id, sb) + part(c, s.id, sc) - t.admin - extra;
      const vb = moved * (sb / t.shift);
      const vc = moved * (sc / t.shift);
      const gb = flowsOf(kb, vb);
      const gc = flowsOf(kc, vc);
      return { savings: s.id, limit, shift: sb + sc, moved: vb + vc, net, netWithFees: net + t.admin + extra, gross: { today: grossOf(gb.today) + grossOf(gc.today), after: grossOf(gb.after) + grossOf(gc.after) } };
    }),
  );
  const mix = (x: number, y: number) => h * x + (1 - h) * y;
  const premium = mix(kb.stack.consumerChange, kc.stack.consumerChange);
  const fb = flowsOf(kb, moved * h);
  const fc = flowsOf(kc, moved * (1 - h));
  const merge = (p: Flow[], q: Flow[]): Flow[] => p.map((f, i) => ({ ...f, perDollar: mix(f.perDollar, q[i].perDollar), annual: f.annual + q[i].annual }));
  const c30 = cases.find((x) => x.savings === "none" && x.limit === 0.3)!;
  const net0 = cases.find((x) => x.savings === "none" && x.limit === null)!.net;
  return {
    def: d,
    shelf: mix(kb.stack.after.shelf, kc.stack.after.shelf),
    premium,
    grocerMargin: RETAILER_TARGET,
    sellersBelowCost: false,
    lever: { priceToGrocers: 1 - (kb.built.set.discount ?? 0), chargeRate: kc.stack.charge?.rateOnBase ?? null },
    structure: null,
    distribution: null,
    flows: { today: merge(fb.today, fc.today), after: merge(fb.after, fc.after) },
    basket: BASKET.map((x) => ({ ...x, stateStore: bottleScale(kb.stack.today, x.landed) * kb.stack.today.consumer, grocery: bottleScale(kb.stack.today, x.landed) * mix(kb.stack.after.consumer, kc.stack.after.consumer) })),
    cases,
    breakEven: {
      minTake: { none: null, allocated: null, longer_run: null },
      minShift: { none: null, allocated: null, longer_run: null },
      savingsNeeded: Math.max(0, -net0 / moved),
      minPremiumAtReference: { none: NaN, allocated: NaN, longer_run: NaN },
      grocerMarginAt10: NaN,
    },
    dabsVolumeLost: { fixed: moved / t.wine, limit30: c30.moved / t.wine },
  };
}

// ----- direct supply over its unmeasured delivery cost ----------------------------------------------------------------------

export interface DirectSpan {
  costShare: number;
  producerPremium: number;
  premium: number;
  net: number;
  netLimit30: number;
}

/** D across its grid of delivery cost × producer premium (both illustrative), with no savings. */
export function directSpan(t: Terms): DirectSpan[] {
  return DIRECT_COST_SHARES.flatMap((cs) =>
    PRODUCER_PREMIUMS.map((pp) => {
      const def = directDef(cs, pp);
      const k = fixed(def, overrides("none"));
      const premium = k.stack.consumerChange;
      return { costShare: cs, producerPremium: pp, premium, net: k.ledger.net, netLimit30: caseOf(def, "none", 0.3, t, premium).net };
    }),
  );
}

// ----- comparison -----------------------------------------------------------------------------------------------------------

export type Verdict = "meets" | "meets_under_assumptions" | "fails" | "cannot_be_determined";

export interface Constraints {
  /** Largest consumer price premium over the state store treated as competitive: a policy choice, no source. */
  maxPremium: number;
  /** Smallest grocer gross margin treated as commercially viable: the Census national grocery margin, a reference point. */
  minGrocerMargin: number;
}

export const DEFAULT_CONSTRAINTS: Constraints = { maxPremium: 0.1, minGrocerMargin: RETAILER_TARGET };

export interface Classification {
  verdict: Verdict;
  /** Each test: fiscal with no savings at the fixed share and at every convenience limit; fiscal with allocated savings;
   * consumer price; commercial margin. */
  tests: { id: string; label: string; pass: boolean | null }[];
  reason: string;
}

export function classify(r: DesignResult, c: Constraints, direct: DirectSpan[] | null = null): Classification {
  if (r.def.id === "A") return { verdict: "meets", tests: [], reason: "The baseline: every other design is measured against it." };
  const noSave = r.cases.filter((x) => x.savings === "none");
  const fiscalFixed = noSave.find((x) => x.limit === null)!.net >= -0.5;
  const fiscalChoice = noSave.every((x) => x.net >= -0.5);
  const fiscalSaved = r.cases.filter((x) => x.savings === "allocated").every((x) => x.net >= -0.5);
  const price = r.premium <= c.maxPremium + 1e-9;
  const margin = r.grocerMargin !== null && !r.sellersBelowCost && r.grocerMargin >= c.minGrocerMargin - 1e-9;
  const tests = [
    { id: "fiscal_fixed", label: "State breaks even, no savings, fixed 30% share", pass: fiscalFixed },
    { id: "fiscal_choice", label: "State breaks even, no savings, under every convenience limit", pass: fiscalChoice },
    { id: "fiscal_saved", label: "State breaks even with allocated savings, every case", pass: fiscalSaved },
    { id: "price", label: `Grocery price within ${(c.maxPremium * 100).toFixed(0)}% of the state store`, pass: price },
    { id: "margin", label: `Grocer gross margin at least ${(c.minGrocerMargin * 100).toFixed(0)}%, sellers above cost`, pass: margin },
  ];
  if (r.def.id === "D" && direct) {
    const ok = direct.map((g) => g.premium <= c.maxPremium + 1e-9 && g.net >= -0.5);
    if (ok.some(Boolean) && !ok.every(Boolean))
      return { verdict: "cannot_be_determined", tests, reason: "Whether it meets the constraints depends on the producer's delivery cost and price to grocers, which nothing measures." };
  }
  if (fiscalChoice && price && margin) return { verdict: "meets", tests, reason: "Meets every constraint with no savings counted and under every convenience limit." };
  if ((fiscalFixed || fiscalSaved) && price && margin) return { verdict: "meets_under_assumptions", tests, reason: fiscalFixed ? "Meets them only if the 30% share moves whatever the price." : "Meets them only if the allocated savings are real." };
  const failed = tests.filter((x) => !x.pass).map((x) => x.label.toLowerCase());
  return { verdict: "fails", tests, reason: `Fails: ${failed.join("; ")}.` };
}

/** Designs no other design beats on all three computed criteria at once (state net with no savings at the 30% limit, the
 * consumer premium, and the grocer margin), with at least one strictly better. */
export function pareto(rs: DesignResult[]): DesignId[] {
  const pts = rs
    .filter((r) => r.def.id !== "A")
    .map((r) => ({ id: r.def.id, net: r.cases.find((x) => x.savings === "none" && x.limit === 0.3)!.net, premium: r.premium, margin: r.grocerMargin ?? -Infinity }));
  const beats = (a: (typeof pts)[number], b: (typeof pts)[number]) =>
    a.net >= b.net - 0.5 && a.premium <= b.premium + 1e-9 && a.margin >= b.margin - 1e-9 && (a.net > b.net + 0.5 || a.premium < b.premium - 1e-9 || a.margin > b.margin + 1e-9);
  return pts.filter((p) => !pts.some((q) => q !== p && beats(q, p))).map((p) => p.id);
}

export interface Criterion {
  id: string;
  label: string;
  /** "computed" cells come from the model; "assessed" cells are qualitative and say so. */
  kind: "computed" | "assessed";
  cells: Record<DesignId, string>;
}

const pct = (v: number, d = 1) => `${minus((v * 100).toFixed(d))}%`;
const usd = (v: number) => `${v < -0.5 ? "−" : v > 0.5 ? "+" : ""}$${(Math.abs(v) / 1e6).toFixed(2)}M`;

export function criteria(rs: DesignResult[]): Criterion[] {
  const cell = (f: (r: DesignResult) => string): Record<DesignId, string> => Object.fromEntries(rs.map((r) => [r.def.id, f(r)])) as Record<DesignId, string>;
  const net = (r: DesignResult, s: SavingsCase, l: number | null) => r.cases.find((x) => x.savings === s && x.limit === l)!.net;
  return [
    { id: "revenue", label: "1. State net revenue, $ a year (no savings: fixed share / 30% limit / allocated savings, fixed)", kind: "computed", cells: cell((r) => (r.def.id === "A" ? "baseline" : `${usd(net(r, "none", null))} / ${usd(net(r, "none", 0.3))} / ${usd(net(r, "allocated", null))}`)) },
    { id: "price", label: "2. Consumer price against a state store", kind: "computed", cells: cell((r) => (r.def.id === "A" ? "baseline" : `+${pct(r.premium)}`)) },
    { id: "retailer", label: "3. Grocer gross margin (before its own costs)", kind: "computed", cells: cell((r) => (r.grocerMargin === null ? "—" : `${pct(r.grocerMargin)}${r.sellersBelowCost ? ", below cost" : ""}`)) },
    {
      id: "distribution",
      label: "4. Distribution efficiency",
      kind: "assessed",
      cells: { A: "DABS warehouse and delivery to its own stores.", B: "Uses DABS's existing warehouse; adds deliveries to grocers (cost unmeasured, zero in the main case).", C: "Adds a private wholesale tier; its cost is inside the 29.5% reference margin.", D: "Removes the wholesaler's margin but not its work: delivery cost is an unmeasured input (main case equal to the wholesaler's).", E: "Runs both channels; scale is split between them." },
    },
    { id: "admin", label: "5. Administrative cost, $ a year (illustrative: no estimate exists)", kind: "computed", cells: cell((r) => (r.def.id === "A" ? "$0 new" : r.def.id === "E" ? `$${((1 + HYBRID_EXTRA_ADMIN_SHARE) * 0.5).toFixed(2)}M` : "$0.50M")) },
    {
      id: "enforcement",
      label: "6. Enforcement feasibility",
      kind: "assessed",
      cells: { A: "Current state-store controls.", B: "DABS knows every bottle sold to grocers; retail compliance checks as for off-premise beer.", C: "Needs wholesaler licensing, charge returns and audits on top of retail checks.", D: "Many small shippers to audit; the hardest to trace.", E: "Both B's and C's tasks, and product-routing rules." },
    },
    { id: "stores", label: "7. State stores and package agencies: share of DABS wine sales that leaves (fixed share / 30% limit)", kind: "computed", cells: cell((r) => `${pct(r.dabsVolumeLost.fixed)} / ${pct(r.dabsVolumeLost.limit30)}`) },
    {
      id: "producers",
      label: "8. Producer access",
      kind: "assessed",
      cells: { A: "Through DABS listings and special orders.", B: "Through DABS listings, as today.", C: "Through private wholesalers' books.", D: "Most direct for producers able to deliver; small out-of-state producers face delivery cost.", E: "Either route, by product." },
    },
    {
      id: "health",
      label: "9. Public-health considerations",
      kind: "assessed",
      cells: { A: "Baseline.", B: "More outlets; prices above state stores damp the effect.", C: "More outlets; the highest premium.", D: "More outlets; lower premiums if delivery is cheap, so a larger availability effect.", E: "More outlets; mixed prices." },
    },
    { id: "law", label: "10. Legislative complexity: amendments and open legal questions in the change matrix", kind: "computed", cells: cell((r) => `${amendmentsFor(r.def.id).length} amendments, ${openQuestionsFor(r.def.id).length} open questions`) },
  ];
}

// ----- the report -----------------------------------------------------------------------------------------------------------

export interface FrontierPoint {
  premium: number;
  wholesalePrice: number;
  retailChargeReference: number;
  retailChargeNoDistribution: number;
  wholesalePriceAllocated: number;
  retailChargeReferenceAllocated: number;
}

export interface PolicyDesignsReport {
  method: string;
  terms: Terms;
  results: DesignResult[];
  direct: DirectSpan[];
  classification: Record<DesignId, Classification>;
  constraints: Constraints;
  pareto: DesignId[];
  criteria: Criterion[];
  frontier: FrontierPoint[];
  /** The premium at which each structure breaks even at the reference grocer margin, no savings. */
  frontierAtReference: { wholesalePrice: number; retailChargeReference: number; retailChargeNoDistribution: number };
  /** The largest distribution margin at which a retail-charge design matches B's lowest premium (no savings). */
  distributionToMatchB: number;
  licenseFeePerGroceryStore: number;
  selected: { id: DesignId | null; reason: string; whatWouldNeedToChange: string[] };
}

export function frontier(t: Terms, steps = 60, top = 0.6): FrontierPoint[] {
  const f = (distribution: number, savings: number): FrontierInputs => ({ distribution, savings, adminPerDollar: t.admin / t.moved, handling: 0 });
  const v = COST_LINES.shortRun;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const premium = (top * i) / steps;
    const P = 1 + premium;
    return {
      premium,
      wholesalePrice: maxGrocerMargin("wholesale_price", P, t, f(0, 0)),
      retailChargeReference: maxGrocerMargin("retail_charge", P, t, f(WHOLESALER_MARGIN, 0)),
      retailChargeNoDistribution: maxGrocerMargin("retail_charge", P, t, f(0, 0)),
      wholesalePriceAllocated: maxGrocerMargin("wholesale_price", P, t, f(0, v)),
      retailChargeReferenceAllocated: maxGrocerMargin("retail_charge", P, t, f(WHOLESALER_MARGIN, v)),
    };
  });
}

export function policyDesignsReport(c: Constraints = DEFAULT_CONSTRAINTS): PolicyDesignsReport {
  const t = terms();
  const results = DESIGNS.map((d) => evaluateDesign(d, t));
  const direct = directSpan(t);
  const classification = Object.fromEntries(results.map((r) => [r.def.id, classify(r, c, r.def.id === "D" ? direct : null)])) as Record<DesignId, Classification>;
  const f0 = (distribution: number): FrontierInputs => ({ distribution, savings: 0, adminPerDollar: t.admin / t.moved, handling: 0 });
  const atRef = {
    wholesalePrice: minPrice("wholesale_price", RETAILER_TARGET, t, f0(0)) - 1,
    retailChargeReference: minPrice("retail_charge", RETAILER_TARGET, t, f0(WHOLESALER_MARGIN)) - 1,
    retailChargeNoDistribution: minPrice("retail_charge", RETAILER_TARGET, t, f0(0)) - 1,
  };
  const distributionToMatchB = maxDistribution(1 + atRef.wholesalePrice, RETAILER_TARGET, t, { savings: 0, adminPerDollar: t.admin / t.moved, handling: 0 });
  const meets = results.filter((r) => r.def.id !== "A" && classification[r.def.id].verdict === "meets");
  const b = results.find((r) => r.def.id === "B")!;
  const selected = meets.length
    ? { id: meets[0].def.id, reason: classification[meets[0].def.id].reason, whatWouldNeedToChange: [] }
    : {
        id: null,
        reason: `No modeled arrangement meets all three constraints (the state breaks even with no savings under every convenience limit, a grocery price within ${pct(c.maxPremium, 0)} of the state store, and a grocer margin of at least ${pct(c.minGrocerMargin, 0)}). B, DABS wholesale at today's price, is the best-supported design: with no savings it keeps the state ahead if the 30% share moves (${usd(b.cases.find((x) => x.savings === "none" && x.limit === null)!.net)} a year), it has the lowest premium of the designs whose inputs are measured or referenced (${pct(b.premium)}), and no other design beats it on revenue, price and grocer margin at once. At that premium few households would switch under the price-sensitive cases, so the convenience gain is small and the fixed administration turns the result negative unless license fees cover it. D could have a lower premium only if delivery costs less than ${pct(distributionToMatchB)} of the price to grocers, which nothing measures.`,
        whatWouldNeedToChange: [
          `Collect the state's take as a retail-level charge rather than inside the wholesale price. A percentage grocer margin then does not apply to it: at a 28% grocer margin the lowest break-even premium falls from ${pct(atRef.wholesalePrice)} (B) to ${pct(atRef.retailChargeNoDistribution)} if distribution cost nothing, and ${atRef.retailChargeReference > atRef.wholesalePrice ? "rises" : "falls"} to ${pct(atRef.retailChargeReference)} at the private wholesaler's reference margin.`,
          `Grocers accepting a lower margin on wine than the 28% all-product reference: at a 10% premium the state breaks even (no savings) with a grocer margin of ${pct(b.breakEven.grocerMarginAt10)} under B.`,
          `Cover the fixed administration with license fees so that low participation cannot turn the result negative: $${Math.round(t.admin / UTAH_GROCERY_ESTABLISHMENTS.count).toLocaleString("en-US")} a year per store if all ${UTAH_GROCERY_ESTABLISHMENTS.count} grocery establishments (CBP ${UTAH_GROCERY_ESTABLISHMENTS.year}) were licensed.`,
          "Measure DABS's avoidable costs. Without them, every saving is illustrative and the headline stays at zero.",
          "Measure how households choose between a grocer and a state store at a given price difference. The 15%, 30% and 60% convenience limits are scenarios, not estimates.",
        ],
      };
  return {
    method: POLICY_DESIGNS_METHOD,
    terms: t,
    results,
    direct,
    classification,
    constraints: c,
    pareto: pareto(results),
    criteria: criteria(results),
    frontier: frontier(t),
    frontierAtReference: atRef,
    distributionToMatchB,
    licenseFeePerGroceryStore: t.admin / UTAH_GROCERY_ESTABLISHMENTS.count,
    selected,
  };
}

let cached: PolicyDesignsReport | null = null;
/** The report at the default constraints (cached: the page and the export read the same object). */
export function defaultDesignsReport(): PolicyDesignsReport {
  return (cached ??= policyDesignsReport());
}
