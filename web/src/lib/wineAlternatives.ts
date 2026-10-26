// Policy alternatives for sealed wine in Utah grocery stores while the state stores stay open (method
// WINE_ALTERNATIVES_METHOD). Each alternative is a named set of inputs to the existing scenario engine (lib/scenario.ts
// compute, through lib/arrangements.ts arrangementInputs), laid out by lib/wineAccounting.ts. Nothing here is a second
// model: the alternatives only choose who supplies the wine, how grocers are paid, and how the state collects.
//
// Rules:
// * Fixed-volume accounting first: the same household purchases move (30% of household wine), total wine bought does
//   not change, and the result is conditional on every input listed. Demand sensitivity comes after, separately, from
//   the engine's own price response, cross-border recapture and access mechanisms, each on its own and then together.
// * Two pricing modes, never both at once: matched consumer prices (grocers charge today's state-store price; the
//   retailer's margin is whatever the arrangement leaves, reported) or a retailer-margin target (grocers price to earn
//   the reference margin on their own selling price; the consumer price is whatever that requires, reported).
// * State stores stay open. Savings are the FY2025 expense lines that move with sales (card fees, package-agency
//   contracts, bags) in the short run; staff and delivery reductions are conditional longer-run cases; rent, systems,
//   depreciation and interest are not avoidable while the stores operate. DABS supply keeps its wholesale costs.
// * The historical references (the brief's two worked cases, 5 cents of avoided cost) are kept exactly as they were.
// * National average margins are reference points, not proven minimums for grocery wine; an alternative that leaves a
//   retailer less reports the implied margin rather than being called unworkable.
import { arrangementInputs, settingsFromFields, solveLever, withMechanisms, type ArrangementSettings } from "./arrangements";
import { INITIATIVES, proposalInputs, type WorkedData } from "./initiatives";
import { compute, WORKED_PROPOSALS, type DepositRates, type ScenarioInputs, type ScenarioResult } from "./scenario";
import { substitution, type SubstitutionResult } from "./substitution";
import { ledger, priceStack, signWords, type AccountingOptions, type ChargePoint, type Ledger, type PriceStack } from "./wineAccounting";
import { STATUTORY_MARKUP } from "./wineMargin";

export const WINE_ALTERNATIVES_METHOD = "wine-alternatives@1.0";

// ----- assumptions --------------------------------------------------------------------------------------------------

export type Standing = "source" | "derived" | "statute" | "assumption" | "illustrative" | "reference" | "policy";

export interface Assumption {
  id: string;
  label: string;
  value: string;
  standing: Standing;
  note: string;
}

const INIT = INITIATIVES[0];
const DATA: WorkedData = INIT.worked.data;
const RATES: DepositRates = INIT.worked.rates;
const PROPOSAL = WORKED_PROPOSALS.find((p) => p.id === INIT.worked.proposalId)!;
/** The worked comparison's inputs as the scenario tool reads them (FY2025). */
const X0: ScenarioInputs = proposalInputs(PROPOSAL.values, DATA);
const SET0: ArrangementSettings = settingsFromFields((k) => PROPOSAL.values[k]);

const E = DATA.expenses;
/** FY2025 expense lines per $ of DABS sales (all products), applied per $ of wine that moves. */
export const COST_LINES = {
  shortRun: (E.card + E.agency + E.bags) / DATA.sales,
  wages: E.wages / DATA.sales,
  delivery: E.delivery / DATA.sales,
  operating: E.total / DATA.sales,
} as const;
/** The brief's illustrative avoided cost (historical references only). */
export const REFERENCE_AVOIDED = 0.05;
export const RETAILER_TARGET = SET0.grocerMargin ?? 0.28;
export const WHOLESALER_MARGIN = SET0.wholesalerMargin ?? 0.295;
export const ELASTICITY = typeof X0.elasticity === "number" ? X0.elasticity : -0.46;
/** Illustrative only, no source: purchases now made outside Utah that would be made in Utah, share of baseline volume. */
export const RECAPTURE_ILLUSTRATIVE = 0.02;
/** Exploratory: the lower quartile of per-capita sales increases after full retail privatization (Community Guide). */
export const ACCESS_EXPLORATORY = 0.045;

const W = X0.wineSales ?? 0;
const M = X0.grossMargin ?? 0;
const G = X0.wineGallons ?? 0;
const pctS = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;
const cS = (v: number) => `${(v * 100).toFixed(2)}¢`;

export const ASSUMPTIONS: Assumption[] = [
  { id: "U01", label: "Wine sales, FY2025, at state-store prices before sales tax", value: `$${(W / 1e6).toFixed(1)}M (33.5% of DABS's $551.3M)`, standing: "derived", note: "DABS FY2025 liquor sales times wine's share of gross sales in the twelve FY2026 monthly reports." },
  { id: "U02", label: "Gross margin on wine (DABS trading margin as a share of its selling price)", value: pctS(M, 2), standing: "assumption", note: "DABS's FY2025 all-product gross profit over sales, applied to wine. The 88.5% minimum markup on landed cost implies 46.95%." },
  { id: "U03", label: "Households' share of wine purchases", value: pctS(X0.eligible ?? 1, 0), standing: "assumption", note: "DABS's FY2025 all-product off-premise share, applied to wine; licensees keep buying from DABS." },
  { id: "U04", label: "Household wine purchases that move to grocers", value: pctS(X0.shift ?? 0, 0), standing: "illustrative", note: "No source. Not price-dependent in the engine: the same share moves whatever the grocery price." },
  { id: "U05", label: "State sales tax", value: pctS(X0.salesTax ?? 0, 2), standing: "source", note: "State portion only (Publication 25). Local sales tax is not modelled: whether state-store sales carry it as grocery sales would is unresolved." },
  { id: "U06", label: "School-meals and enforcement deposits", value: "10% and 1.695% of total gross revenue from liquor sales", standing: "statute", note: "Utah Code §§ 32B-2-304(5), 32B-2-305(4). Whether DABS's sales to grocers count is unresolved; both readings are shown." },
  { id: "U07", label: "Short-run avoidable store cost per $ that leaves (stores stay open): a source-based assumption", value: cS(COST_LINES.shortRun), standing: "assumption", note: "FY2025 card fees, package-agency contracts and bags divided by all-product sales: an allocation of accounting expense categories, not a measured marginal cost or demonstrated saving. Every alternative is also shown with no avoidable cost. Costs that remain while the stores stay open and DABS keeps supplying wine: store rent and occupancy, staff unless cut, systems, purchasing, warehouse and delivery, depreciation and interest." },
  { id: "U08", label: "Conditional longer-run reductions", value: `wages ${cS(COST_LINES.wages)}; delivery ${cS(COST_LINES.delivery)} (private supply only)`, standing: "assumption", note: "Only if staffing, or DABS's delivery runs, fall in proportion to the sales that leave. Not in the main cases." },
  { id: "U09", label: "Rent, systems, depreciation and interest", value: "not avoidable", standing: "assumption", note: "The stores stay open, so these do not fall with sales." },
  { id: "U10", label: "New licensing, enforcement and administration", value: "$500,000 a year", standing: "illustrative", note: "No estimate exists." },
  { id: "U11", label: "Additional wholesale handling or distribution cost of supplying grocers", value: "unknown: zero is a placeholder in the main cases; 1.05¢ per $ as a sensitivity", standing: "assumption", note: "DABS keeps buying, storing and delivering the wine, so its existing wholesale costs remain (not saved). Any extra cost of serving many grocery stores (order handling, more delivery stops) is unmeasured; private supply's distribution costs are inside the private margins." },
  { id: "U12", label: "Retailer gross-margin target", value: pctS(RETAILER_TARGET, 1), standing: "reference", note: "Census ARTS 2022, grocery stores (NAICS 4451), national, all products: a reference point, not a proven minimum for grocery wine." },
  { id: "U13", label: "Private wholesaler gross margin", value: pctS(WHOLESALER_MARGIN, 1), standing: "reference", note: "Census AWTS 2022, beer, wine and spirits merchant wholesalers (NAICS 4248), national." },
  { id: "U14", label: "Private sellers' acquisition cost", value: pctS(1 - M, 2) + " of today's price", standing: "assumption", note: "Private wholesalers pay suppliers what DABS pays (its landed cost)." },
  { id: "U15", label: "Price elasticity of wine demand", value: String(ELASTICITY), standing: "source", note: "Nelson (2013), a meta-analysis of market-level studies. Applying it to one channel's price is the assumption." },
  { id: "U16", label: "Wine gallons and average price per gallon", value: `${(G / 1e6).toFixed(2)}M gallons; $${(W / G).toFixed(2)} a gallon`, standing: "derived", note: "NIAAA 2024 Utah wine gallons; wine sales over gallons (both include licensees)." },
  { id: "U17", label: "Historical reference cases", value: "5¢ avoided cost; 20% replacement tax; 20% discount; matched prices", standing: "reference", note: "The brief's worked example of 2026-10-17, kept unchanged for comparison." },
  { id: "U18", label: "Recapture and access in the demand sensitivity", value: `recapture ${pctS(RECAPTURE_ILLUSTRATIVE, 0)}; access +${pctS(ACCESS_EXPLORATORY, 1)}`, standing: "illustrative", note: "Recapture has no source. Access is the lower quartile after full retail privatization elsewhere, not grocery licensing in Utah. Neither is a probability." },
];

// ----- alternatives -------------------------------------------------------------------------------------------------

export type Pricing = "matched" | "margin_target";
/** What a DABS-supply or charge alternative is defined to preserve per bottle. */
export type Preserves = "nothing" | "gross_trading_margin" | "gross_take_as_charge" | "net_fiscal_contribution";

export interface ChargeDef {
  kind: "on_price" | "per_gallon";
  collectedAt: ChargePoint;
  inSalesTaxBase: boolean;
  /** A rate (on-price: share of the grocery price before the charge; per gallon: $) or how to size it. */
  size: { rate: number } | "gross_take" | "break_even";
}

export interface AltDef {
  id: string;
  group: "reference" | "A" | "B" | "C";
  label: string;
  short: string;
  supply: "dabs" | "private";
  pricing: Pricing;
  /** DABS supply: the discount off today's shelf price at which DABS sells to grocers, or the break-even one. */
  discount?: number | "break_even";
  charge?: ChargeDef;
  savings: "reference" | "short_run";
  preserves: Preserves;
  defines: string;
}

export const ALTERNATIVES: AltDef[] = [
  { id: "R1", group: "reference", label: "Reference 1 (brief): private supply, 20% replacement tax, matched prices, 5¢ avoided", short: "Ref. 1: private, 20% tax", supply: "private", pricing: "matched", charge: { kind: "on_price", collectedAt: "retailer", inSalesTaxBase: true, size: { rate: 0.2 } }, savings: "reference", preserves: "nothing", defines: "The brief's arrangement A, unchanged." },
  { id: "R2", group: "reference", label: "Reference 2 (brief): DABS supply, 20% discount, matched prices, 5¢ avoided", short: "Ref. 2: DABS, 20% discount", supply: "dabs", pricing: "matched", discount: 0.2, savings: "reference", preserves: "nothing", defines: "The brief's arrangement B, unchanged." },
  { id: "A_target", group: "A", label: "A. DABS supplies at today's price (keeps its trading margin); grocers price for a 28% margin", short: "A: DABS keeps margin, grocer 28%", supply: "dabs", pricing: "margin_target", discount: 0, savings: "short_run", preserves: "gross_trading_margin", defines: "DABS sells to grocers at today's shelf price, so it keeps its gross trading margin (47.2¢ per $1 of today's price) on every bottle. The grocer's margin is paid by a higher grocery price." },
  { id: "A_matched", group: "A", label: "A. DABS supplies at today's price; grocers charge today's price", short: "A: DABS keeps margin, matched price", supply: "dabs", pricing: "matched", discount: 0, savings: "short_run", preserves: "gross_trading_margin", defines: "As A, but grocers charge what a state store charges: their gross margin is zero (diagnostic case)." },
  { id: "A_net", group: "A", label: "A. DABS keeps its net fiscal contribution: the largest discount at which the state breaks even; grocers price for 28%", short: "A: net contribution kept, grocer 28%", supply: "dabs", pricing: "margin_target", discount: "break_even", savings: "short_run", preserves: "net_fiscal_contribution", defines: "The discount at which the statewide change is zero at fixed volume: DABS gives grocers only what it saves, less the new costs, plus the extra sales tax a higher price brings." },
  { id: "B20_matched", group: "B", label: "B. DABS supplies at a 20% discount; grocers charge today's price", short: "B: 20% discount, matched", supply: "dabs", pricing: "matched", discount: 0.2, savings: "short_run", preserves: "nothing", defines: "Reference 2's structure with the documented short-run savings: the grocer's margin is the 20% discount." },
  { id: "B20_target", group: "B", label: "B. DABS supplies at a 20% discount; grocers price for a 28% margin", short: "B: 20% discount, grocer 28%", supply: "dabs", pricing: "margin_target", discount: 0.2, savings: "short_run", preserves: "nothing", defines: "The grocer pays DABS 80% of today's price and prices to keep 28% of its own price." },
  { id: "C_take", group: "C", label: "C. Private supply; a charge on the grocery price equal to DABS's margin per bottle; sellers price for national margins", short: "C: charge = DABS margin, sellers' margins", supply: "private", pricing: "margin_target", charge: { kind: "on_price", collectedAt: "retailer", inSalesTaxBase: true, size: "gross_take" }, savings: "short_run", preserves: "gross_take_as_charge", defines: "A retail-level charge, collected from the grocer on its price before the charge, sized so the state collects 47.2¢ per $1 of today's price, as DABS's margin does now. Wholesaler 29.5% and grocer 28% of their own prices." },
  { id: "C_gallon", group: "C", label: "C. Private supply; a per-gallon charge at the wholesaler equal to DABS's margin per gallon; passed on at cost", short: "C: per-gallon charge at wholesaler", supply: "private", pricing: "margin_target", charge: { kind: "per_gallon", collectedAt: "wholesaler", inSalesTaxBase: true, size: "gross_take" }, savings: "short_run", preserves: "gross_take_as_charge", defines: "A charge per gallon collected from the licensed wholesaler at its first sale, equal to DABS's average margin per gallon; sellers add it to their prices without a margin on it." },
  { id: "C_take_outside", group: "C", label: "C. As 'charge = DABS margin', with the charge outside the sales-tax base", short: "C: charge outside sales-tax base", supply: "private", pricing: "margin_target", charge: { kind: "on_price", collectedAt: "retailer", inSalesTaxBase: false, size: "gross_take" }, savings: "short_run", preserves: "gross_take_as_charge", defines: "Sales tax on the grocery price before the charge." },
  { id: "C_break_even", group: "C", label: "C. Private supply; the charge on the grocery price at which the state breaks even; sellers price for national margins", short: "C: break-even charge, sellers' margins", supply: "private", pricing: "margin_target", charge: { kind: "on_price", collectedAt: "retailer", inSalesTaxBase: true, size: "break_even" }, savings: "short_run", preserves: "net_fiscal_contribution", defines: "The charge rate at which the statewide change is zero at fixed volume, with sellers earning the reference margins." },
  { id: "C_matched_be", group: "C", label: "C. Private supply; the break-even charge with grocers charging today's price", short: "C: break-even charge, matched", supply: "private", pricing: "matched", charge: { kind: "on_price", collectedAt: "retailer", inSalesTaxBase: true, size: "break_even" }, savings: "short_run", preserves: "net_fiscal_contribution", defines: "Sellers keep whatever is left of today's price after the charge (reported)." },
  { id: "C20_matched", group: "C", label: "C. Private supply; 20% charge; grocers charge today's price (Reference 1 with documented savings)", short: "C: 20% charge, matched", supply: "private", pricing: "matched", charge: { kind: "on_price", collectedAt: "retailer", inSalesTaxBase: true, size: { rate: 0.2 } }, savings: "short_run", preserves: "nothing", defines: "Reference 1's structure with the documented short-run savings." },
];

// ----- inputs for one alternative --------------------------------------------------------------------------------------

export interface Built {
  id: "private" | "wholesale";
  base: ScenarioInputs;
  set: ArrangementSettings;
  /** The fixed-volume engine inputs (the arrangement's own lever applied; no purchase changes). */
  x: ScenarioInputs;
}

export interface Overrides {
  avoided?: { shortRun: number; conditional: number };
  handling?: number;
  newCosts?: number;
  shift?: number;
  discount?: number;
  chargeRate?: number;
  /** The engine's entered grocery price before any charge reaches it, per $1 of today's state-store price. When set,
   * the price is entered (not matched and not priced for a margin target), whatever the alternative's own pricing. */
  priceRatio?: number;
}

function savingsOf(def: AltDef, o: Overrides): { shortRun: number; conditional: number } {
  if (o.avoided) return o.avoided;
  if (def.savings === "reference") return { shortRun: COST_LINES.shortRun, conditional: REFERENCE_AVOIDED - COST_LINES.shortRun };
  return { shortRun: COST_LINES.shortRun, conditional: 0 };
}

/** The sellers' price before any charge, per $1 of today's price, when they price for the reference margins. */
export function sellersOwnPrice(supply: "dabs" | "private", discount = 0): number {
  return supply === "dabs" ? (1 - discount) / (1 - RETAILER_TARGET) : (1 - M) / ((1 - WHOLESALER_MARGIN) * (1 - RETAILER_TARGET));
}

function inputsAt(def: AltDef, o: Overrides, discount: number, charge: number): Built {
  const sv = savingsOf(def, o);
  const id = def.supply === "dabs" ? "wholesale" : "private";
  const entered = o.priceRatio !== undefined;
  const priceRatio = entered ? o.priceRatio! : def.pricing === "matched" ? 1 : sellersOwnPrice(def.supply, discount);
  const base: ScenarioInputs = {
    ...X0,
    extra: false,
    avoidableCost: sv.shortRun + sv.conditional,
    newCosts: o.newCosts ?? X0.newCosts,
    shift: o.shift ?? X0.shift,
    priceRatio,
    passThrough: null,
    handlingCost: def.supply === "dabs" ? (o.handling ?? 0) : null,
    chargeInSalesTax: def.charge ? def.charge.inSalesTaxBase : null,
  };
  const set: ArrangementSettings = {
    ...SET0,
    priceCase: !entered && def.pricing === "matched" ? "matched" : "entered",
    taxKind: def.charge?.kind === "per_gallon" ? "excise" : "percent",
    taxRate: charge,
    taxToPrice: 1,
    wholesaleCost: 0,
    discount,
  };
  const x = withMechanisms(arrangementInputs(base, set, id), {});
  return { id, base, set, x };
}

const netAt = (b: Built) => {
  const r = compute(b.x);
  return r.missing.length || r.invalid.length ? NaN : r.netA;
};

/** The alternative's lever resolved: a fixed value, the charge equal to DABS's margin, or the break-even value. */
export function leverOf(def: AltDef, o: Overrides = {}): { discount: number; charge: number } {
  if (def.supply === "dabs") {
    let d = o.discount ?? (typeof def.discount === "number" ? def.discount : 0);
    if (o.discount === undefined && def.discount === "break_even") {
      const s = solveLever((v) => netAt(inputsAt(def, o, v, 0)), 0, M);
      d = s.atLow < 0 ? 0 : (s.root ?? M);
    }
    return { discount: d, charge: 0 };
  }
  const c = def.charge!;
  if (o.chargeRate !== undefined) return { discount: 0, charge: o.chargeRate };
  if (typeof c.size === "object") return { discount: 0, charge: c.size.rate };
  if (c.size === "gross_take") {
    if (c.kind === "per_gallon") return { discount: 0, charge: (M * W) / G };
    // On-price: rate x the sellers' price before the charge = DABS's margin per $1 of today's price.
    const own = def.pricing === "matched" ? null : sellersOwnPrice("private");
    return { discount: 0, charge: own === null ? M / (1 - M) : M / own };
  }
  const hi = c.kind === "per_gallon" ? (2 * W) / G : 3;
  const s = solveLever((v) => netAt(inputsAt(def, o, 0, v)), 0, hi, 600);
  return { discount: 0, charge: s.root ?? NaN };
}

export function build(def: AltDef, o: Overrides = {}): Built {
  const l = leverOf(def, o);
  return inputsAt(def, o, l.discount, l.charge);
}

// ----- results --------------------------------------------------------------------------------------------------------

export interface DemandCase {
  id: "fixed" | "price_constant" | "price_linear" | "return_to_stores" | "recapture" | "access" | "all";
  label: string;
  /** What kind of purchase change this is (never combined with another in a single row except "all"). */
  kind: "fixed_volume" | "fewer_bottles" | "channel_return" | "recaptured" | "added_consumption" | "combined";
  net: number;
  /** Change against the fixed-volume result. */
  delta: number;
  ledger: Ledger | null;
  /** Wine bought at grocers relative to the wine that moves at fixed volume. */
  groceryFactor: number | null;
  note: string;
}

export interface LegalNote {
  item: string;
  status: "change needed" | "unresolved" | "consistent with current law";
  text: string;
  cite: string;
}

export interface AltResult {
  def: AltDef;
  built: Built;
  lever: { discount: number; charge: number };
  fixed: { result: ScenarioResult; stack: PriceStack; ledger: Ledger; ledgerOtherReading: Ledger | null };
  retailer: {
    target: number;
    marginShare: number | null;
    meetsTarget: boolean | null;
    centsPerDollar: number;
    /** Wholesaler and grocer together, per $1 of today's price and as a share of their price before any charge. */
    sellersTogether: number;
    sellersTogetherShare: number | null;
    belowCost: { grocer: boolean; sellersTogether: boolean };
    /** True when the state's result needs a seller to sell below its acquisition cost under the stated split: the result
     * is arithmetic only and is not presented as a workable arrangement. */
    arithmeticOnly: boolean;
    note: string;
  };
  demand: DemandCase[];
  /** Price response alone, plus recapture alone, plus access alone, equals all three together (engine additivity). */
  demandAdditive: boolean;
  beer: SubstitutionResult;
  legal: LegalNote[];
  /** The same policy (same lever) with no avoidable operating cost at all: the comparison for U07. */
  zeroSavings: { net: number; ledger: Ledger };
  /** The fixed-volume change in five parts (allocations are reported separately, in `fixed.ledger.allocations`). */
  reconciliation: Reconciliation;
  /** A one-line conditional statement of the fixed-volume result. */
  headline: string;
}

export interface Reconciliation {
  /** DABS trading-margin change (before operating expenses). */
  tradingMargin: number;
  /** State tax change: the explicit charge and the state sales tax (checkout tax). Local sales tax is not modelled. */
  taxes: { charge: number; salesTax: number; total: number };
  /** Avoidable operating costs (positive: the state stops paying them). */
  avoidableCosts: number;
  /** New costs (negative): administration and any cost of supplying grocers. */
  newCosts: number;
  net: number;
  /** Where a positive result comes from: the margin and charge together, checkout tax, savings and new costs. */
  sources: { marginAndCharge: number; checkoutTax: number; savings: number; newCosts: number };
}

export function optionsFor(def: AltDef, o: Overrides = {}, depositsOnGrocerSales = true): AccountingOptions {
  return {
    supply: def.supply,
    rates: RATES,
    savings: savingsOf(def, o),
    wholesalerMargin: def.supply === "private" ? WHOLESALER_MARGIN : null,
    chargePoint: def.charge?.collectedAt,
    depositsOnGrocerSales,
  };
}

/** The engine's scenario-B inputs for the demand mechanisms, from an alternative's base inputs. */
function demandFrom(base: ScenarioInputs, extra: Partial<ScenarioInputs>): ScenarioInputs {
  return { ...base, extra: true, growth: 0, extraGrocery: 1, recapture: null, elasticity: ELASTICITY, ...extra };
}

const runDemand = (x: ScenarioInputs) => {
  const r = compute(x);
  return { x, r, net: r.netB ?? r.netA };
};

/** The engine's constant-elasticity price response for one alternative's inputs. The share that moves is assigned first,
 * as at fixed volume; the quantity bought at grocers then changes with the grocery price (q = price ratio ^ elasticity),
 * and purchases no longer made at grocers leave the Utah market: they do not return to DABS. DABS's avoided store cost
 * is still counted on all the wine that left its stores. */
export function priceResponse(b: Built): { x: ScenarioInputs; r: ScenarioResult; net: number } {
  return runDemand(withMechanisms(arrangementInputs(b.base, b.set, b.id), { price: true }, demandFrom(b.base, { demandForm: "constant" })));
}

function demandCases(def: AltDef, b: Built, fixedNet: number, fixedRes: ScenarioResult, o: Overrides): { cases: DemandCase[]; additive: boolean } {
  const acc = optionsFor(def, o);
  const x0 = arrangementInputs(b.base, b.set, b.id);
  const from = (extra: Partial<ScenarioInputs>): ScenarioInputs => demandFrom(b.base, extra);
  const run = runDemand;
  const S = (b.x.wineSales ?? 0) * (b.x.eligible ?? 1) * (b.x.shift ?? 0);
  const out: DemandCase[] = [{ id: "fixed", label: "Fixed volume (conditional accounting)", kind: "fixed_volume", net: fixedNet, delta: 0, ledger: null, groceryFactor: 1, note: "The same purchases move; nothing else changes." }];
  const priceMoves = Math.abs((fixedRes.priceRatioUsed ?? 1) - 1) > 1e-9;
  const grocery = (r: ScenarioResult) => (S > 0 ? (S + (r.extraStreams?.find((e) => e.id === "price")?.dollars ?? 0)) / S : null);
  const add = (id: DemandCase["id"], label: string, kind: DemandCase["kind"], k: ReturnType<typeof run>, factor: number | null, note: string) =>
    out.push({ id, label, kind, net: k.net, delta: k.net - fixedNet, ledger: ledger(k.x, k.r, acc, "with_demand"), groceryFactor: factor, note });
  const pc = priceResponse(b);
  add(
    "price_constant",
    "Price response, constant elasticity",
    "fewer_bottles",
    pc,
    grocery(pc.r),
    priceMoves
      ? "A conditional sensitivity calculation, not a forecast. The elasticity (−0.46) applies only to the wine that moves, at its grocery price relative to the state-store price. The purchases no longer made at grocers are assumed to leave the Utah market: they do not return to DABS, and DABS's avoided store cost is still counted on all the wine that left its stores. The 30% share that moves does not respond to the premium (missing capability: channel choice)."
      : "Prices do not change, so the price response is zero.",
  );
  const pl = run(withMechanisms({ ...x0, demandForm: "linear" }, { price: true }, from({ demandForm: "linear" })));
  add("price_linear", "Price response, straight-line demand", "fewer_bottles", pl, grocery(pl.r), "The same with a straight-line demand curve of the same slope at today's price.");
  // Exploratory: the buyers put off by the price go back to state stores instead (the share moving falls by the factor).
  const f = pc.r.demandFactor ?? 1;
  const xr = { ...b.x, shift: (b.x.shift ?? 0) * f };
  const rr = compute(xr);
  out.push({ id: "return_to_stores", label: "Price response read as buyers returning to state stores (exploratory)", kind: "channel_return", net: rr.netA, delta: rr.netA - fixedNet, ledger: ledger(xr, rr, acc), groceryFactor: f, note: "The other reading of the same response: the purchases put off by the grocery price stay at DABS at today's price, so the share that moves falls instead. The market-wide elasticity does not measure switching between channels; exploratory." });
  const rc = run(withMechanisms(x0, { recapture: true }, from({ recapture: RECAPTURE_ILLUSTRATIVE, elasticity: null })));
  add("recapture", `Cross-border recapture, ${pctS(RECAPTURE_ILLUSTRATIVE, 0)} of baseline volume, bought at grocers (illustrative)`, "recaptured", rc, null, "Purchases now made in other states made in Utah instead. No source sizes it.");
  const ac = run(withMechanisms(x0, { access: true }, from({ growth: ACCESS_EXPLORATORY, elasticity: null })));
  add("access", `Easier access: +${pctS(ACCESS_EXPLORATORY, 1)} wine bought in total, at grocers (exploratory)`, "added_consumption", ac, null, "More wine drunk in total; no beer or spirits offset is assumed (see the beer threshold). From full privatization elsewhere, not grocery licensing.");
  const al = run(withMechanisms(x0, { price: true, recapture: true, access: true }, from({ demandForm: "constant", recapture: RECAPTURE_ILLUSTRATIVE, growth: ACCESS_EXPLORATORY })));
  add("all", "Price response, recapture and access together", "combined", al, null, "The three mechanisms add up: each is computed on its own stream of wine.");
  const sum = out.find((c) => c.id === "price_constant")!.delta + out.find((c) => c.id === "recapture")!.delta + out.find((c) => c.id === "access")!.delta;
  return { cases: out, additive: Math.abs(sum - (al.net - fixedNet)) < 0.01 };
}

const MARKUP_CITE = "Utah Code § 32B-2-304(2)(b)";

function legalNotes(def: AltDef, lever: { discount: number }): LegalNote[] {
  const common: LegalNote[] = [
    { item: "Grocery retail of wine", status: "change needed", text: "Wine is liquor under Title 32B, and an off-premise beer retailer's licence gives no authority to sell liquor; a new grocery licence or authority is needed.", cite: "Utah Code 32B-1-102(68), (143); 32B-7-201, 32B-7-202" },
    { item: "Local sales tax", status: "unresolved", text: "Whether state-store sales carry local sales tax as grocery sales would. Not modelled.", cite: "Tax Commission (question for staff)" },
  ];
  if (def.supply === "dabs") {
    const lawful = Math.max(0, 1 - (1 + STATUTORY_MARKUP.wine) * (1 - M));
    return [
      ...common,
      {
        item: "DABS price to grocers",
        status: lever.discount <= lawful + 1e-9 ? "consistent with current law" : "change needed",
        text: `DABS must mark wine up at least 88.5% over landed case cost. At the 47.2% all-product margin a discount of at most ${pctS(lawful, 2)} keeps the floor; ${pctS(lever.discount, 1)} ${lever.discount <= lawful + 1e-9 ? "does" : "does not"}.`,
        cite: MARKUP_CITE,
      },
      { item: "Deposits on DABS's sales to grocers", status: "unresolved", text: "Whether \"total gross revenue from sales of liquor\" includes DABS's sales to grocers. Both readings are shown.", cite: "Utah Code 32B-2-304(5), 32B-2-305(4)" },
    ];
  }
  return [
    ...common,
    { item: "Private supply of wine", status: "change needed", text: "Manufacturers may sell liquor in Utah only to the department or military installations, and out-of-state sellers may ship liquor into Utah only to the department; private wholesale of wine needs new authority and a licence.", cite: "Utah Code 32B-11-208; 32B-4-401(2)" },
    { item: "The state charge", status: "change needed", text: "Utah collects on wine through the department's markup; no wine excise was found in the saved sources (Title 59 has a beer tax). A charge needs new taxing authority: its base, rate, collection point and administrator are the bill's choices.", cite: "Utah Code 59-15-101 (beer only); saved sources" },
    { item: "Sales-tax base", status: "unresolved", text: "Whether the charge is part of the price subject to sales tax depends on Title 59, Chapter 12 definitions, which are not in the saved sources; both treatments are shown.", cite: "not saved" },
    { item: "Deposits", status: "unresolved", text: "Wine DABS no longer sells carries no deposit; keeping the funds whole needs an explicit allocation of the charge, which moves money between funds.", cite: "Utah Code 32B-2-304(5), 32B-2-305(4)" },
  ];
}

const money = (v: number) => `${v < 0 ? "−" : "+"}$${(Math.abs(v) / 1e6).toFixed(1)}M`;

/** The grocer's position in words: gross margin (not profit), and any selling below acquisition cost, with the split that
 * produces it. National averages are references, not minimums; only selling below cost is treated as a constraint. */
function retailerNote(def: AltDef, st: PriceStack): string {
  const tog = `${(st.sellersTogether * 100).toFixed(1)}¢ per $1 of today's price${st.sellersTogetherShare === null ? "" : ` (${pctS(st.sellersTogetherShare, 1)} of their price before any charge)`}`;
  if (st.belowCost.sellersTogether) return `Arithmetic only: the sellers together would sell below acquisition cost (${tog}).`;
  if (st.belowCost.grocer)
    return `Arithmetic only: if the wholesaler keeps its assumed ${pctS(WHOLESALER_MARGIN, 1)}, the grocer's gross margin is ${pctS(st.retailerMarginShare ?? NaN, 1)}, selling below its acquisition cost. Wholesaler and grocer together keep ${tog}; any split of that is possible only if the wholesaler takes far less.`;
  if (def.supply === "private") return `Grocer's gross margin ${pctS(st.retailerMarginShare ?? NaN, 1)} after a wholesaler keeping ${pctS(WHOLESALER_MARGIN, 1)}; together ${tog}.`;
  return Math.abs(st.after.retailerMargin) < 1e-9 ? "The grocer sells at its acquisition cost (zero gross margin): arithmetic, not an arrangement a grocer is shown to accept." : `Grocer's gross margin ${pctS(st.retailerMarginShare ?? NaN, 1)} of its selling price, before its own costs.`;
}

export function evaluate(def: AltDef, o: Overrides = {}): AltResult {
  const lever = leverOf(def, o);
  const b = inputsAt(def, o, lever.discount, lever.charge);
  const result = compute(b.x);
  if (result.missing.length || result.invalid.length) throw new Error(`${def.id}: ${[...result.missing, ...result.invalid].join("; ")}`);
  const acc = optionsFor(def, o, true);
  const stack = priceStack(b.x, result, acc);
  const led = ledger(b.x, result, acc);
  const other = def.supply === "dabs" ? ledger(b.x, result, optionsFor(def, o, false)) : null;
  const share = stack.retailerMarginShare;
  const d = demandCases(def, b, led.net, result, o);
  const beer = substitution(b.base, b.set, b.id, INIT.worked.swap, RATES);
  const headline = `${def.short}: at fixed volume this ${signWords(led.net)} state revenue${Math.abs(led.net) > 0.5 ? ` by ${money(led.net).slice(1)} a year` : ""}; the grocery price is ${pctS(stack.consumerChange, 1)} against a state store and the grocer's gross margin (before its own costs; not profit) is ${share === null ? "not split from the wholesaler's" : pctS(share, 1)} of its selling price${stack.belowCost.grocer || stack.belowCost.sellersTogether ? ", below its acquisition cost under the stated split, so this result is arithmetic only" : ""} (inputs U01-U16).`;
  const v = (id: string) => led.lines.find((l) => l.id === id)?.value ?? 0;
  const reconciliation: Reconciliation = {
    tradingMargin: v("dabs_trading_margin"),
    taxes: { charge: v("state_charge"), salesTax: v("state_sales_tax"), total: v("state_charge") + v("state_sales_tax") },
    avoidableCosts: v("savings_short_run") + v("savings_conditional"),
    newCosts: v("new_administration") + v("new_handling"),
    net: led.net,
    sources: {
      marginAndCharge: v("dabs_trading_margin") + v("state_charge"),
      checkoutTax: v("state_sales_tax"),
      savings: v("savings_short_run") + v("savings_conditional"),
      newCosts: v("new_administration") + v("new_handling"),
    },
  };
  const zb = inputsAt(def, { ...o, avoided: { shortRun: 0, conditional: 0 } }, lever.discount, lever.charge);
  const zr = compute(zb.x);
  const zl = ledger(zb.x, zr, optionsFor(def, { ...o, avoided: { shortRun: 0, conditional: 0 } }, true));
  return {
    def,
    built: b,
    lever,
    fixed: { result, stack, ledger: led, ledgerOtherReading: other },
    retailer: {
      target: RETAILER_TARGET,
      marginShare: share,
      meetsTarget: share === null ? null : share >= RETAILER_TARGET - 1e-9,
      centsPerDollar: stack.after.retailerMargin,
      sellersTogether: stack.sellersTogether,
      sellersTogetherShare: stack.sellersTogetherShare,
      belowCost: stack.belowCost,
      arithmeticOnly: stack.belowCost.grocer || stack.belowCost.sellersTogether,
      note: retailerNote(def, stack),
    },
    demand: d.cases,
    demandAdditive: d.additive,
    beer,
    legal: legalNotes(def, lever),
    zeroSavings: { net: zl.net, ledger: zl },
    reconciliation,
    headline,
  };
}

// ----- sweeps -----------------------------------------------------------------------------------------------------------

export interface SweepRow {
  v: number;
  net: number;
  consumerChange: number;
  retailerShare: number | null;
  /** What the grocer (and any private wholesaler) keeps together, per $1 of today's price. */
  sellersPerDollar: number;
  funds: number;
  fundsOther: number | null;
}

export interface FixedCase {
  built: Built;
  result: ScenarioResult;
  stack: PriceStack;
  ledger: Ledger;
  /** DABS supply: the same case with no deposits on DABS's sales to grocers (the other reading of the law). */
  ledgerOtherReading: Ledger | null;
}

/** One fixed-volume case of an alternative: its lever (or the one given in the overrides) and any other overrides. Null
 * when the engine reports missing or invalid inputs. The sweeps and the price-and-share grid are built from this. */
export function evaluateFixed(def: AltDef, o: Overrides = {}): FixedCase | null {
  const l = leverOf(def, o);
  const b = inputsAt(def, o, l.discount, l.charge);
  const r = compute(b.x);
  if (r.missing.length || r.invalid.length) return null;
  return {
    built: b,
    result: r,
    stack: priceStack(b.x, r, optionsFor(def, o, true)),
    ledger: ledger(b.x, r, optionsFor(def, o, true)),
    ledgerOtherReading: def.supply === "dabs" ? ledger(b.x, r, optionsFor(def, o, false)) : null,
  };
}

/** One lever across its span for one alternative (others as defined). */
export function sweepLever(def: AltDef, lever: "discount" | "charge", from: number, to: number, steps: number, o: Overrides = {}): SweepRow[] {
  const rows: SweepRow[] = [];
  for (let i = 0; i <= steps; i++) {
    const v = from + ((to - from) * i) / steps;
    const k = evaluateFixed(def, lever === "discount" ? { ...o, discount: v } : { ...o, chargeRate: v });
    if (!k) continue;
    const st = k.stack;
    const l = k.ledger;
    rows.push({ v, net: l.net, consumerChange: st.consumerChange, retailerShare: st.retailerMarginShare, sellersPerDollar: st.after.wholesaleMargin + st.after.retailerMargin, funds: l.allocations.funds, fundsOther: k.ledgerOtherReading ? k.ledgerOtherReading.allocations.funds : null });
  }
  return rows;
}

export interface SensitivityRow {
  id: string;
  label: string;
  standing: Standing;
  net: number;
}

/** Cost and volume cases for one alternative, each changing one thing from the alternative as defined. */
export function costCases(def: AltDef): SensitivityRow[] {
  const base = savingsOf(def, {});
  const rows: SensitivityRow[] = [
    { id: "as_defined", label: "As defined", standing: "assumption", net: evaluate(def).fixed.ledger.net },
    { id: "no_savings", label: "No store costs avoided", standing: "illustrative", net: evaluate(def, { avoided: { shortRun: 0, conditional: 0 } }).fixed.ledger.net },
    { id: "short_run", label: `Short-run lines only (${cS(COST_LINES.shortRun)})`, standing: "derived", net: evaluate(def, { avoided: { shortRun: COST_LINES.shortRun, conditional: 0 } }).fixed.ledger.net },
    { id: "plus_wages", label: `Plus wages falling in proportion to sales (+${cS(COST_LINES.wages)})`, standing: "assumption", net: evaluate(def, { avoided: { shortRun: COST_LINES.shortRun, conditional: COST_LINES.wages } }).fixed.ledger.net },
    ...(def.supply === "private" ? [{ id: "plus_delivery", label: `Plus wages and delivery (+${cS(COST_LINES.wages + COST_LINES.delivery)})`, standing: "assumption" as const, net: evaluate(def, { avoided: { shortRun: COST_LINES.shortRun, conditional: COST_LINES.wages + COST_LINES.delivery } }).fixed.ledger.net }] : []),
    { id: "operating_proportional", label: `Every FY2025 operating-expense line falling in proportion to the sales that leave (${cS(COST_LINES.operating)})`, standing: "illustrative", net: evaluate(def, { avoided: { shortRun: COST_LINES.shortRun, conditional: COST_LINES.operating - COST_LINES.shortRun } }).fixed.ledger.net },
    { id: "no_new_costs", label: "No new administration costs", standing: "illustrative", net: evaluate(def, { newCosts: 0, avoided: base }).fixed.ledger.net },
    { id: "double_new_costs", label: "New administration costs doubled ($1M)", standing: "illustrative", net: evaluate(def, { newCosts: 2 * (X0.newCosts ?? 0), avoided: base }).fixed.ledger.net },
    { id: "zero_shift", label: "No wine moves (administration still paid)", standing: "illustrative", net: evaluate(def, { shift: 0, avoided: base }).fixed.ledger.net },
    ...(def.supply === "dabs" ? [{ id: "handling", label: `Supplying grocers costs DABS ${cS(COST_LINES.delivery)} per $ more`, standing: "assumption" as const, net: evaluate(def, { handling: COST_LINES.delivery, avoided: base }).fixed.ledger.net }] : []),
  ];
  return rows;
}

export interface AlternativesReport {
  method: string;
  assumptions: Assumption[];
  results: AltResult[];
  movedDollars: number;
  baselineWineRevenue: number;
  costLines: typeof COST_LINES;
  missingCapabilities: string[];
}

export const MISSING_CAPABILITIES = [
  "Channel choice: here the share of purchases that moves does not respond to a grocery price premium, so a 30% shift at a 39-51% premium is an input, not a prediction (the purchase-flow model, wine-purchase-flows@1.0, adds an illustrative straight-line channel choice).",
  "Spirits substitution: this engine can offset beer only (and only for added wine); the purchase-flow model adds wine replacing spirits and beer for any grocery wine.",
  "Margins applied on a per-gallon charge: the engine passes a charge on at cost; percentage margins applied to it would raise the shelf price further.",
  "Local sales tax, one-time transition costs and timing are not modelled.",
];

let cached: AlternativesReport | null = null;
export function alternativesReport(): AlternativesReport {
  if (cached) return cached;
  const results = ALTERNATIVES.map((d) => evaluate(d));
  const S = W * (X0.eligible ?? 1) * (X0.shift ?? 0);
  cached = {
    method: WINE_ALTERNATIVES_METHOD,
    assumptions: ASSUMPTIONS,
    results,
    movedDollars: S,
    baselineWineRevenue: results[0].fixed.result.baselineTotal,
    costLines: COST_LINES,
    missingCapabilities: MISSING_CAPABILITIES,
  };
  return cached;
}

export function alternativeById(id: string): AltDef {
  const d = ALTERNATIVES.find((a) => a.id === id);
  if (!d) throw new Error(`Unknown alternative ${id}`);
  return d;
}
