// One accounting breakdown for grocery-wine scenarios (method WINE_ACCOUNTING_METHOD), shared by the initiative page,
// the policy alternatives (lib/wineAlternatives.ts), the graph export (src/export/groceryWine.ts) and the Python check
// (scripts/grocery_wine_alternatives_check.py). It is not a second model: every dollar comes from the scenario engine's
// result (lib/scenario.ts compute) and is laid out here on one set of definitions.
//
// Per $1 of today's state-store shelf price before checkout taxes, for the wine that moves:
//  * acquisition cost: what the first buyer pays the supplier. DABS's landed cost is 1 − its gross margin; private
//    wholesalers are assumed to pay what DABS pays (an assumption, stated wherever it is used).
//  * DABS trading margin: DABS's selling price less the acquisition cost, before operating expenses. Not profit.
//  * private wholesale margin and retailer (grocer) gross margin: each seller's selling price less what it pays.
//  * explicit state charge: a replacement charge collected on the wine (per gallon, or a tax on the grocery price).
//  * shelf price before checkout taxes; state sales tax on its base; local sales tax (not modelled); consumer price.
// A margin is a share of the seller's own selling price; a markup is on the seller's acquisition cost:
// margin = markup / (1 + markup). A charge's rate is quoted on its legal base and as a share of the price that includes
// it: rate / (1 + rate).
//
// The annual ledger is incremental. Today's revenue from the DABS business the change does not touch (the wine that does
// not move, and every other product, which this model does not cover) is listed and cancels. The statewide change is
// the change in DABS trading margin + state charges + state sales tax + operating costs avoided − new costs, and must
// equal the engine's net change (checked). The school-meals and enforcement deposits are allocations of the trading
// margin: the ledger reports the change for those two funds and for every other state fund, which add up to the
// statewide change; they are never added to it again.
import { movedShare, type DepositRates, type ScenarioInputs, type ScenarioResult } from "./scenario";

export const WINE_ACCOUNTING_METHOD = "wine-accounting@1.0";

export type Supply = "dabs" | "private";
export type ChargePoint = "wholesaler" | "retailer";

/** One column of the price stack, per $1 of today's state-store shelf price before checkout taxes. Price rows add up to
 * the shelf price: acquisition + DABS margin + private wholesale margin + retailer margin + charge in the price +
 * charge absorbed (the part of a charge sellers pay out of their own price) = shelf. */
export interface StackColumn {
  acquisition: number;
  dabsMargin: number;
  wholesaleMargin: number;
  retailerMargin: number;
  /** The part of the explicit state charge that is in the shelf price. */
  chargeInPrice: number;
  /** The part sellers pay out of their own price (zero unless a charge is only partly passed on; at matched prices the
   * whole charge is in the unchanged price, so sellers' own price is lower instead). */
  chargeAbsorbed: number;
  shelf: number;
  salesTaxBase: number;
  stateSalesTax: number;
  /** Not modelled: whether state-store sales carry local sales tax as grocery sales would is unresolved. */
  localSalesTax: null;
  /** Shelf price plus state sales tax (local sales tax not included). */
  consumer: number;
}

export interface PriceStack {
  today: StackColumn;
  after: StackColumn;
  /** Consumer price at the grocer against the same bottle at a state store today (state sales tax included). */
  consumerChange: number;
  /** Margins as shares of each seller's own selling price; null where that seller does not exist. */
  dabsMarginShare: { today: number; after: number | null };
  dabsMarkupOnCost: { today: number; after: number | null };
  wholesaleMarginShare: number | null;
  /** The retailer's gross margin over its selling price before checkout taxes and before any retail-level charge. For
   * private supply this is under the stated split: the wholesaler keeps its assumed margin and the grocer gets the rest. */
  retailerMarginShare: number | null;
  retailerSellingPrice: number;
  /** What the private wholesaler (if any) and the grocer keep together per $1 of today's price, and as a share of their
   * own price before any charge. Independent of how it is split between them. */
  sellersTogether: number;
  sellersTogetherShare: number | null;
  /** Whether a seller would sell below its acquisition cost: the grocer under the stated split, or the sellers together. */
  belowCost: { grocer: boolean; sellersTogether: boolean };
  charge: null | {
    kind: "per_gallon" | "on_price";
    collectedAt: ChargePoint;
    inSalesTaxBase: boolean;
    /** Per $1 of today's price, all of it (in the price and absorbed). */
    perDollar: number;
    /** On-price charges: the rate on its legal base (the grocery price before the charge) and as a share of the price
     * that includes it. */
    rateOnBase: number | null;
    shareOfPriceWithCharge: number | null;
    /** Per-gallon charges: dollars per gallon. */
    perGallon: number | null;
  };
}

export type LedgerKind = "trading_margin" | "charge" | "sales_tax" | "saving" | "new_cost" | "beer_tax";

export interface LedgerLine {
  id: string;
  label: string;
  kind: LedgerKind;
  /** Change against today, $ a year (positive: more for the state). Null: not modelled. */
  value: number | null;
}

export interface Allocations {
  /** Today's deposits on the wine that moves (statutory rates times its value at state-store prices). */
  today: { school: number; enforcement: number };
  /** Change for the two funds against today, under the reading stated, and for every other state fund. */
  school: number;
  enforcement: number;
  funds: number;
  others: number;
  /** How DABS's sales to grocers are treated for the deposits (DABS supply only). */
  reading: "not_applicable" | "deposits_on_grocer_sales" | "no_deposits_on_grocer_sales";
  /** An explicit guarantee to the two funds, $ a year (moved from other state funds; zero unless entered). */
  guarantee: number;
}

export interface Ledger {
  basis: "fixed_volume" | "with_demand";
  /** Today's state revenue from wine that is not touched: the wine that does not move (margin and sales tax). Unchanged. */
  unaffected: { wineMargin: number; wineSalesTax: number; change: 0 };
  lines: LedgerLine[];
  net: number;
  /** The engine's net change for the same case, and whether the ledger adds up to it (within a cent). */
  engineNet: number;
  reconciles: boolean;
  allocations: Allocations;
  /** Wine bought, $ a year at state-store prices: from state stores and agencies, from grocers, and in total. */
  volume: { state: number; grocery: number; total: number; baseline: number };
}

export interface AccountingOptions {
  supply: Supply;
  rates: DepositRates;
  /** The avoidable cost split into the part that falls in the short run with stores open and a conditional longer-run
   * part. They must add up to the scenario's avoidable cost. */
  savings: { shortRun: number; conditional: number };
  /** Private supply: the private wholesaler's gross margin on its own price, to split the private margin (null: shown
   * together). */
  wholesalerMargin?: number | null;
  /** Private supply: where a per-gallon charge is collected (an on-price charge is collected from the retailer). */
  chargePoint?: ChargePoint;
  /** DABS supply: whether DABS's sales to grocers carry the school-meals and enforcement deposits (unresolved in law). */
  depositsOnGrocerSales?: boolean;
  guarantee?: number;
}

const near = (a: number, b: number) => Math.abs(a - b) <= 0.01 + 1e-9 * Math.abs(b);

/** The price stack of a scenario (its fixed-volume prices; the price response does not change prices). */
export function priceStack(x: ScenarioInputs, r: ScenarioResult, o: AccountingOptions): PriceStack {
  const m = x.grossMargin ?? 0;
  const t = x.salesTax ?? 0;
  const c = 1 - m;
  const shelf = r.priceRatioUsed ?? 1;
  const r0 = r.priceBeforeTax ?? 1;
  const today: StackColumn = { acquisition: c, dabsMargin: m, wholesaleMargin: 0, retailerMargin: 0, chargeInPrice: 0, chargeAbsorbed: 0, shelf: 1, salesTaxBase: 1, stateSalesTax: t, localSalesTax: null, consumer: 1 + t };
  if (o.supply === "dabs") {
    const d = x.discount ?? 0;
    const pd = 1 - d;
    const after: StackColumn = { acquisition: c, dabsMargin: pd - c, wholesaleMargin: 0, retailerMargin: shelf - pd, chargeInPrice: 0, chargeAbsorbed: 0, shelf, salesTaxBase: shelf, stateSalesTax: t * shelf, localSalesTax: null, consumer: shelf * (1 + t) };
    return {
      today,
      after,
      consumerChange: after.consumer / today.consumer - 1,
      dabsMarginShare: { today: m, after: pd > 0 ? (pd - c) / pd : null },
      dabsMarkupOnCost: { today: m / c, after: (pd - c) / c },
      wholesaleMarginShare: null,
      retailerMarginShare: shelf > 0 ? (shelf - pd) / shelf : null,
      retailerSellingPrice: shelf,
      sellersTogether: shelf - pd,
      sellersTogetherShare: shelf > 0 ? (shelf - pd) / shelf : null,
      belowCost: { grocer: shelf - pd < -1e-9, sellersTogether: shelf - pd < -1e-9 },
      charge: null,
    };
  }
  const W = x.wineSales ?? 0;
  const G = x.wineGallons ?? 0;
  const perGallon = x.revenueMode === "excise";
  const total = perGallon ? (W > 0 ? ((x.excise ?? 0) * G) / W : 0) : x.revenueMode === "percent" ? (x.adValorem ?? 0) * r0 : 0;
  const inPrice = shelf - r0; // the engine adds tau x charge to the price before the charge
  const absorbed = total - inPrice;
  const point: ChargePoint = perGallon ? (o.chargePoint ?? "wholesaler") : "retailer";
  const sellersNet = shelf - total; // what private sellers keep from the shelf price after the charge
  const w = o.wholesalerMargin;
  const pw = w !== null && w !== undefined && w >= 0 && w < 1 ? c / (1 - w) : null; // wholesaler's price, before any charge
  const wholesaleMargin = pw === null ? 0 : pw - c;
  const retailerMargin = pw === null ? sellersNet - c : sellersNet - pw;
  // The retailer's selling price before checkout taxes and before a charge levied on that price (retail level). A
  // per-gallon charge collected from the wholesaler is part of the retailer's cost and of its selling price.
  const retailerSellingPrice = point === "retailer" ? shelf - inPrice : shelf;
  const base = x.chargeInSalesTax === false ? shelf - inPrice : shelf;
  const after: StackColumn = { acquisition: c, dabsMargin: 0, wholesaleMargin, retailerMargin, chargeInPrice: inPrice, chargeAbsorbed: absorbed, shelf, salesTaxBase: base, stateSalesTax: t * base, localSalesTax: null, consumer: shelf + t * base };
  return {
    today,
    after,
    consumerChange: after.consumer / today.consumer - 1,
    dabsMarginShare: { today: m, after: null },
    dabsMarkupOnCost: { today: m / c, after: null },
    wholesaleMarginShare: pw === null ? null : wholesaleMargin / pw,
    // Without a wholesaler's margin the private margin is shown together and no retailer share is computed.
    retailerMarginShare: pw === null ? null : retailerSellingPrice > 0 ? retailerMargin / retailerSellingPrice : null,
    retailerSellingPrice,
    sellersTogether: sellersNet - c,
    sellersTogetherShare: sellersNet > 0 ? (sellersNet - c) / sellersNet : null,
    belowCost: { grocer: retailerMargin < -1e-9, sellersTogether: sellersNet - c < -1e-9 },
    charge: {
      kind: perGallon ? "per_gallon" : "on_price",
      collectedAt: point,
      inSalesTaxBase: x.chargeInSalesTax !== false,
      perDollar: total,
      rateOnBase: perGallon ? null : (x.adValorem ?? 0),
      shareOfPriceWithCharge: perGallon ? null : (x.adValorem ?? 0) / (1 + (x.adValorem ?? 0)),
      perGallon: perGallon ? (x.excise ?? 0) : null,
    },
  };
}

const sumOf = (cs: { id: string; value: number }[] | null, ids: string[]) => (cs ?? []).filter((k) => ids.includes(k.id)).reduce((s, k) => s + k.value, 0);

/** The incremental ledger of one case: the channel shift alone (fixed volume: `r.netA`) or with the purchase changes
 * entered (`r.netB`, when `x.extra`). */
export function ledger(x: ScenarioInputs, r: ScenarioResult, o: AccountingOptions, basis: "fixed_volume" | "with_demand" = "fixed_volume"): Ledger {
  const W = x.wineSales ?? 0;
  const S = W * movedShare(x);
  const m = x.grossMargin ?? 0;
  const t = x.salesTax ?? 0;
  const v = x.avoidableCost ?? 0;
  const parts = o.savings.shortRun + o.savings.conditional;
  if (Math.abs(parts - v) > 1e-9) throw new Error(`savings split (${parts}) does not add up to the avoidable cost (${v})`);
  const a = r.a;
  const b = basis === "with_demand" ? (r.b ?? []) : [];
  const get = (ids: string[]) => sumOf(a, ids) + sumOf(b, ids.map((id) => `extra_${id}`));
  // DABS trading margin: on state-store sales (today m x W), and on its sales to grocers.
  const tradingMargin = get(["store_margin", "wholesale"]) - m * W;
  const charge = get(["excise", "ad_valorem", "retained"]);
  const salesTax = get(["sales_tax"]) - t * W;
  const saved = sumOf(a, ["cost_saved"]);
  const extraCost = sumOf(b, ["extra_cost"]); // operating cost of extra state-store sales (with demand)
  const share = (p: number) => (v > 0 ? p / v : 0);
  const lines: LedgerLine[] = [
    { id: "dabs_trading_margin", label: "DABS trading margin (before operating expenses)", kind: "trading_margin", value: tradingMargin },
    { id: "state_charge", label: "Explicit state charge on grocery wine", kind: "charge", value: charge },
    { id: "state_sales_tax", label: "State sales tax", kind: "sales_tax", value: salesTax },
    { id: "local_sales_tax", label: "Local sales tax (not modelled)", kind: "sales_tax", value: null },
    { id: "savings_short_run", label: "Store costs that fall in the short run (stores stay open)", kind: "saving", value: saved * share(o.savings.shortRun) },
    { id: "savings_conditional", label: "Conditional longer-run cost reductions", kind: "saving", value: saved * share(o.savings.conditional) },
    ...(basis === "with_demand" ? [{ id: "extra_operating_cost", label: "Operating cost of extra state-store sales", kind: "new_cost" as const, value: -extraCost }] : []),
    { id: "new_administration", label: "New licensing, enforcement and administration", kind: "new_cost", value: -sumOf(a, ["new_costs"]) },
    { id: "new_handling", label: "Cost of supplying grocers beyond today's cost of that wine", kind: "new_cost", value: -get(["handling"]) },
    ...(basis === "with_demand" ? [{ id: "beer_tax_lost", label: "Beer excise and sales tax lost on beer replaced", kind: "beer_tax" as const, value: -sumOf(b, ["beer_excise_lost", "beer_sales_tax_lost"]) }] : []),
  ];
  const net = lines.reduce((s, l) => s + (l.value ?? 0), 0);
  const engineNet = basis === "with_demand" ? (r.netB ?? NaN) : r.netA;
  // Volumes: the engine's extra streams (with demand) on top of the channel shift.
  const q = x.extra ? (x.extraGrocery ?? 0) : 0;
  const st = basis === "with_demand" ? (r.extraStreams ?? []) : [];
  const of = (id: string) => st.find((e) => e.id === id)?.dollars ?? 0;
  const spread = of("access") + of("recapture");
  const stateSales = W - S + (1 - q) * spread;
  const grocery = S + of("price") + q * spread;
  // Allocations: today's deposits on all DABS wine sales, and after on what DABS still sells.
  const rate = o.rates.school + o.rates.enforcement;
  const dabsToGrocers = o.supply === "dabs" && o.depositsOnGrocerSales ? (1 - (x.discount ?? 0)) * grocery : 0;
  const lost = W - stateSales - dabsToGrocers; // the sales base the deposits lose
  const guarantee = o.guarantee ?? 0;
  const school = -o.rates.school * lost + (guarantee * o.rates.school) / rate;
  const enforcement = -o.rates.enforcement * lost + (guarantee * o.rates.enforcement) / rate;
  const funds = school + enforcement;
  return {
    basis,
    unaffected: { wineMargin: m * (W - S), wineSalesTax: t * (W - S), change: 0 },
    lines,
    net,
    engineNet,
    reconciles: near(net, engineNet),
    allocations: {
      today: { school: o.rates.school * S, enforcement: o.rates.enforcement * S },
      school,
      enforcement,
      funds,
      others: net - funds,
      reading: o.supply === "private" ? "not_applicable" : o.depositsOnGrocerSales ? "deposits_on_grocer_sales" : "no_deposits_on_grocer_sales",
      guarantee,
    },
    volume: { state: stateSales, grocery, total: stateSales + grocery, baseline: W },
  };
}

/** A plain-words description of a net change that follows its sign (used in chart titles and on the page, so a title
 * cannot say "loss" over a gain). */
export function signWords(net: number, tol = 0.5): "raises" | "lowers" | "leaves unchanged" {
  if (net > tol) return "raises";
  if (net < -tol) return "lowers";
  return "leaves unchanged";
}

/** Margin on the selling price for a markup on cost, and back. */
export const marginFromMarkup = (markup: number) => markup / (1 + markup);
export const markupFromMargin = (margin: number) => margin / (1 - margin);
/** A charge quoted on its base (the price before the charge), as a share of the price that includes it, and back. */
export const shareOfInclusive = (rateOnBase: number) => rateOnBase / (1 + rateOnBase);
export const rateOnBaseFromShare = (share: number) => share / (1 - share);
/** The selling price a seller needs to earn a gross margin g on it, given what it pays: cost / (1 - g). */
export const priceForMargin = (cost: number, g: number) => cost / (1 - g);
