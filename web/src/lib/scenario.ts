// Utah wine revenue scenarios: what the reader's assumptions imply for state revenue from wine if grocery
// stores could sell it. Arithmetic on stated inputs only (method version SCENARIO_METHOD); not a forecast.
//
// Accounting rules:
// * State-store revenue enters as gross margin (sales minus the cost of the wine), never as gross sales.
//   Gross margin is not profit: operating costs are separate, and only the avoidable part is counted.
// * Sales tax is a tax on the shelf price, kept apart from state-store margin. DABS's own "sales tax" line
//   is not used (its state/local scope is unresolved); the state rate is the reader's input.
// * Scenario A moves some existing wine purchases to grocery stores; the total bought does not change, and
//   shifted sales are never counted as new demand. Scenario B adds extra purchases on top, separately, from
//   up to three named sources that are never merged: easier access (growth), the price response of the wine
//   that moves (an elasticity, with a pass-through of the price gap), and cross-border recapture.
// * When extra wine replaces beer, the beer revenue lost is subtracted, holding spending, volume or pure
//   alcohol constant as the reader chooses.
// * In the wholesale arrangement (1.2) DABS still sells the wine, to grocers, at its shelf price less a retailer
//   discount: the state keeps the gross margin less the discount on each dollar that moves, at state-store prices.
// * The statutory school-meals and enforcement deposits are paid out of the gross margin, so they are already
//   inside it; they are shown as the existing allocation of the sales that move, never subtracted again.
// * A replacement tax can reach the shelf price (1.3): with `taxToPrice` the excise per gallon or the tax on the
//   shelf price is added to the grocery price, in that share, before sales tax and before any price response. The
//   tax on the shelf price is levied on the price before it. Omitted, nothing changes from 1.2: the entered grocery
//   price is the shelf price, whatever the tax.
// * The price response (1.4) is a constant-elasticity curve, q = r^elasticity, unless `demandForm` is "linear": a straight
//   line with the same slope at today's price, q = 1 + elasticity x (r - 1), never below zero. The two agree for small
//   price changes and part for large ones; the elasticity was estimated on ordinary price variation, so large changes
//   are extrapolation either way.
// * Only household purchases can move (1.5). With `eligible` the share moving applies to the household (off-premise)
//   share of wine sales; licensees (bars, restaurants, clubs) keep buying from DABS. DABS publishes no wine sales by
//   customer type, so the household share is an uncertain input; omitted, every wine sale counts as eligible (1.4).
// * Matched consumer prices (1.5): with `matchPrice` the grocery shelf price equals today's state-store price. In the
//   "excise" and "percent" arrangements the whole replacement tax is inside that unchanged price, so the seller's price
//   before the tax falls to (1 - excise per $) or 1 / (1 + tax rate), and sellers, not buyers, bear the tax; with prices
//   unchanged there is no price response. The entered grocery price, pass-through and taxToPrice are then not used.
// * Two explicit choices (1.6), each off by default so every earlier result is unchanged:
//   - `handlingCost`: in the wholesale arrangement, a state cost per $ of wine DABS supplies to grocers (at state-store
//     prices) beyond what it spends on that wine today: the cost of serving grocers. Its retained wholesale costs are
//     not "saved" anywhere (only `avoidableCost` is), so they continue as today.
//   - `chargeInSalesTax`: whether a replacement charge (excise or tax on the shelf price) is inside the sales-tax base.
//     False: sales tax applies to the grocery price before the charge. Null or omitted: inside (as in 1.5).
// Per year, nominal dollars of the base year. Health outcomes are outside this calculator.

export const SCENARIO_METHOD = "utah-wine-scenario@1.6";

export interface ScenarioInputs {
  /** Baseline wine sales through state stores and package agencies, $ per year at state-store prices, before sales tax. */
  wineSales: number | null;
  /** Gallons of wine sold per year (needed for an excise per gallon and for volume-based substitution). */
  wineGallons: number | null;
  /** Gross margin: share of state-store wine sales kept after paying for the wine (0-1). */
  grossMargin: number | null;
  /** State sales tax rate on the shelf price (0-1). */
  salesTax: number | null;
  /** Avoidable state operating cost per $ of state-store sales (0-1). */
  avoidableCost: number | null;
  /** New state costs of licensing and enforcing grocery wine sales, $ per year. */
  newCosts: number | null;
  /** Share of the eligible (household) wine purchases that moves to grocery stores (0-1); of all wine sales when
   * `eligible` is omitted. */
  shift: number | null;
  /** Share of baseline wine sales bought by households, the only purchases that could move (0-1); licensees keep buying
   * from DABS. Not measured for wine. Null: not entered (reported missing). Omitted: every sale counts as eligible (1.4). */
  eligible?: number | null;
  /** Hold the grocery shelf price at today's state-store price, any replacement tax inside it (1.5). */
  matchPrice?: boolean | null;
  /** Grocery shelf price relative to the state-store price for the same wine (1 = same). */
  priceRatio: number | null;
  /** How the state collects revenue on grocery wine. "wholesale": DABS sells the wine to grocers at a discount. */
  revenueMode: "keep" | "excise" | "percent" | "combo" | "wholesale";
  /** Share of each grocery sales dollar the state keeps, e.g. as wholesaler (0-1). */
  retained: number | null;
  /** Excise tax on grocery wine, $ per gallon. */
  excise: number | null;
  /** Extra tax on the grocery shelf price (0-1). */
  adValorem: number | null;
  /** Wholesale arrangement: the discount off the state-store shelf price at which DABS sells wine to grocers (0-1). */
  discount?: number | null;
  /** Scenario B: also model extra purchases. */
  extra: boolean;
  /** Increase in total wine volume (fraction of baseline). */
  growth: number | null;
  /** Share of the extra wine bought in grocery stores (0-1). */
  extraGrocery: number | null;
  /** Some extra wine replaces beer. */
  substitution: boolean;
  /** Share of the extra wine that replaces beer purchases (0-1). */
  replaces: number | null;
  basis: "spending" | "volume" | "ethanol" | null;
  /** Beer shelf price, $ per gallon. */
  beerPrice: number | null;
  /** Utah beer excise, $ per 31-gallon barrel. */
  beerTax: number | null;
  wineAbv: number | null;
  beerAbv: number | null;
  /** Own-price elasticity of wine demand (zero or negative). Null or omitted: the quantity bought ignores the price change. Used in scenario B only. */
  elasticity?: number | null;
  /** Share of the entered grocery price gap (priceRatio - 1) that reaches the shelf (0-2). Null or omitted: all of it. */
  passThrough?: number | null;
  /** Wine now bought outside Utah that would be bought in Utah, as a fraction of baseline volume. Null or omitted: none. Scenario B only. */
  recapture?: number | null;
  /** Share of the replacement tax (excise or tax on the shelf price) that reaches the grocery shelf price (0-1), in the
   * "excise" and "percent" arrangements only. Null or omitted: none (1.2: the entered grocery price already includes any tax). */
  taxToPrice?: number | null;
  /** Shape of the price response (scenario B): "constant" elasticity (the default) or "linear" with the same slope at today's price. */
  demandForm?: "constant" | "linear" | null;
  /** Wholesale arrangement only (1.6): state cost per $ of wine DABS supplies to grocers, at state-store prices, beyond
   * what it spends on the same wine today (0-1). Null or omitted: none. */
  handlingCost?: number | null;
  /** Excise and tax-on-price arrangements only (1.6): whether the replacement charge is inside the sales-tax base. Null or
   * omitted: inside. */
  chargeInSalesTax?: boolean | null;
}

export interface Component {
  id: string;
  label: string;
  value: number;
  kind: "revenue" | "cost_saved" | "cost_added" | "revenue_lost";
}

export interface ScenarioResult {
  missing: string[];
  invalid: string[];
  baseline: Component[];
  baselineTotal: number;
  a: Component[];
  aRevenue: number;
  netA: number;
  /** Net change per $1 of baseline sales that moves to grocery stores. */
  perShiftedDollar: number;
  breakEvenRetained: { value: number | null; note: string };
  /** Wholesale arrangement: the retailer discount at which scenario A changes nothing (other inputs held). */
  breakEvenDiscount: { value: number | null; note: string };
  /** The excise per gallon on grocery wine at which scenario A changes nothing (other inputs held). */
  breakEvenExcise: { value: number | null; note: string };
  /** The share of wine that must move to cover the fixed new costs, when each moved dollar gains revenue. */
  breakEvenShift: { value: number | null; note: string };
  b: Component[] | null;
  netB: number | null;
  beer: { gallons: number; dollars: number; basis: string } | null;
  /** The grocery shelf price relative to the state store that the model used: the entered ratio after pass-through, plus
   * any replacement tax that reaches the shelf (before sales tax). */
  priceRatioUsed: number | null;
  /** The same before any replacement tax reaches it (equal to priceRatioUsed unless taxToPrice is set). */
  priceBeforeTax: number | null;
  /** Quantity multiplier on the wine that moves, from the elasticity (null when no elasticity is applied). */
  demandFactor: number | null;
  /** Where the extra wine of scenario B comes from, in baseline-price dollars and gallons. */
  extraStreams: ExtraStream[] | null;
}

export interface ExtraStream {
  id: "access" | "price" | "recapture";
  label: string;
  /** Wine volume at state-store prices, $ per year (negative: less wine bought). */
  dollars: number;
  gallons: number;
}

/** The share of all baseline wine sales that moves: the share moving times the household share (all sales when the
 * household share is omitted). */
export function movedShare(x: ScenarioInputs): number {
  return (x.shift ?? 0) * (x.eligible ?? 1);
}

/** An excise per gallon as a share of the state-store price: the excise over the price per gallon. */
export function excisePerDollar(x: ScenarioInputs): number {
  const W = x.wineSales ?? 0;
  return x.revenueMode === "excise" || x.revenueMode === "combo" ? (W > 0 ? ((x.excise ?? 0) * (x.wineGallons ?? 0)) / W : 0) : 0;
}

/** The grocery price relative to the state store after pass-through: 1 + passThrough x (priceRatio - 1). With matched
 * prices, the seller's price before any replacement tax that keeps the shelf price at today's. */
export function effectivePrice(x: ScenarioInputs): number | null {
  if (x.matchPrice) {
    if (x.revenueMode === "percent") return 1 / (1 + (x.adValorem ?? 0));
    if (x.revenueMode === "excise") return 1 - excisePerDollar(x);
    return 1;
  }
  if (x.priceRatio === null || x.priceRatio === undefined) return null;
  return 1 + (x.passThrough ?? 1) * (x.priceRatio - 1);
}

/** Whether this configuration needs wine gallons (an excise per gallon or volume-based substitution). */
export function usesGallons(x: ScenarioInputs): boolean {
  return x.revenueMode === "excise" || x.revenueMode === "combo" || (x.extra && x.substitution);
}

type Need = [keyof ScenarioInputs, string];

/** Which inputs this configuration needs, and which of them are missing or out of range. */
export function check(x: ScenarioInputs): { missing: string[]; invalid: string[] } {
  const needs: Need[] = [
    ["wineSales", "baseline wine sales"],
    ["grossMargin", "gross margin on wine"],
    ["salesTax", "state sales tax rate"],
    ["avoidableCost", "avoidable operating cost"],
    ["newCosts", "new state costs of licensing and enforcement"],
    ["shift", x.eligible === undefined ? "share of wine moving to grocery stores" : "share of household wine purchases moving to grocery stores"],
  ];
  if (!x.matchPrice) needs.push(["priceRatio", "grocery price compared with the state store"]);
  if (x.revenueMode === "keep" || x.revenueMode === "combo") needs.push(["retained", "share of grocery sales the state keeps"]);
  if (x.revenueMode === "excise" || x.revenueMode === "combo") needs.push(["excise", "excise per gallon"]);
  if (x.revenueMode === "percent" || x.revenueMode === "combo") needs.push(["adValorem", "tax on the grocery shelf price"]);
  if (x.revenueMode === "wholesale") needs.push(["discount", "discount DABS gives grocers"]);
  const gallonsNeeded = usesGallons(x);
  if (gallonsNeeded) needs.push(["wineGallons", "wine gallons sold"]);
  if (x.extra) {
    needs.push(["growth", "increase in total wine purchases"], ["extraGrocery", "share of the extra wine bought in grocery stores"]);
    if (x.substitution) {
      needs.push(["replaces", "share of the extra wine that replaces beer"], ["basis", "what the substitution holds constant"], ["beerPrice", "beer price per gallon"], ["beerTax", "beer excise per barrel"]);
      if (x.basis === "ethanol") needs.push(["wineAbv", "wine alcohol content"], ["beerAbv", "beer alcohol content"]);
    }
  }
  const missing = needs.filter(([k]) => x[k] === null || x[k] === undefined).map(([, label]) => label);
  if (x.eligible === null) missing.push("household share of wine sales (licensees keep buying from DABS)");
  const invalid: string[] = [];
  const share = (k: keyof ScenarioInputs, label: string) => {
    const v = x[k];
    if (typeof v === "number" && (v < 0 || v > 1)) invalid.push(`${label} must be between 0% and 100%`);
  };
  share("grossMargin", "Gross margin");
  share("salesTax", "Sales tax rate");
  share("avoidableCost", "Avoidable operating cost");
  share("shift", "Share moving to grocery stores");
  share("eligible", "Household share of wine sales");
  share("retained", "Share the state keeps");
  share("adValorem", "Tax on the shelf price");
  share("discount", "Discount DABS gives grocers");
  share("extraGrocery", "Share of extra wine bought in grocery stores");
  share("replaces", "Share of extra wine replacing beer");
  for (const [k, label] of [
    ["wineSales", "Wine sales"],
    ["wineGallons", "Wine gallons"],
    ["newCosts", "New state costs"],
    ["excise", "Excise"],
    ["beerPrice", "Beer price"],
    ["beerTax", "Beer excise"],
  ] as [keyof ScenarioInputs, string][]) {
    const v = x[k];
    if (typeof v === "number" && v < 0) invalid.push(`${label} cannot be negative`);
  }
  if (!x.matchPrice && x.priceRatio !== null && x.priceRatio <= 0) invalid.push("The grocery price must be above zero");
  if (x.matchPrice && x.revenueMode === "excise" && excisePerDollar(x) >= 1) invalid.push("At the state-store price the excise would take the whole price");
  if (x.growth !== null && x.extra && x.growth < -1) invalid.push("Purchases cannot fall by more than 100%");
  if (gallonsNeeded && x.wineGallons === 0) invalid.push("Wine gallons must be above zero");
  if (typeof x.elasticity === "number" && x.elasticity > 0) invalid.push("The price elasticity of demand must be zero or negative");
  if (typeof x.elasticity === "number" && x.elasticity < -5) invalid.push("The price elasticity of demand cannot be below -5");
  if (typeof x.passThrough === "number" && (x.passThrough < 0 || x.passThrough > 2)) invalid.push("Pass-through must be between 0% and 200%");
  if (typeof x.recapture === "number" && x.recapture < 0) invalid.push("Cross-border recapture cannot be negative");
  if (typeof x.taxToPrice === "number" && (x.taxToPrice < 0 || x.taxToPrice > 1)) invalid.push("The share of the tax in the shelf price must be between 0% and 100%");
  if (typeof x.handlingCost === "number" && (x.handlingCost < 0 || x.handlingCost > 1)) invalid.push("The cost of supplying grocers must be between 0% and 100%");
  const used = effectivePrice(x);
  if (!x.matchPrice && used !== null && used <= 0 && x.priceRatio !== null && x.priceRatio > 0 && !invalid.some((p) => p.startsWith("Pass-through"))) invalid.push("With this pass-through the grocery price would be zero or negative");
  for (const [k, label] of [["wineAbv", "Wine alcohol content"], ["beerAbv", "Beer alcohol content"]] as [keyof ScenarioInputs, string][]) {
    const v = x[k];
    if (x.extra && x.substitution && x.basis === "ethanol" && typeof v === "number" && (v <= 0 || v >= 1)) invalid.push(`${label} must be between 0% and 100%`);
  }
  return { missing, invalid };
}

const n = (v: number | null | undefined) => v ?? 0;

export function compute(x: ScenarioInputs): ScenarioResult {
  const { missing, invalid } = check(x);
  const empty: ScenarioResult = {
    missing,
    invalid,
    baseline: [],
    baselineTotal: 0,
    a: [],
    aRevenue: 0,
    netA: 0,
    perShiftedDollar: 0,
    breakEvenRetained: { value: null, note: "" },
    breakEvenDiscount: { value: null, note: "" },
    breakEvenShift: { value: null, note: "" },
    breakEvenExcise: { value: null, note: "" },
    b: null,
    netB: null,
    beer: null,
    priceRatioUsed: null,
    priceBeforeTax: null,
    demandFactor: null,
    extraStreams: null,
  };
  if (missing.length || invalid.length) return empty;
  const W = x.wineSales!;
  const m = x.grossMargin!;
  const t = x.salesTax!;
  const v = x.avoidableCost!;
  const elig = x.eligible ?? 1;
  const s = x.shift! * elig; // share of all baseline wine sales that moves
  const keep = x.revenueMode === "keep" || x.revenueMode === "combo";
  const exc = x.revenueMode === "excise" || x.revenueMode === "combo";
  const pct = x.revenueMode === "percent" || x.revenueMode === "combo";
  const whole = x.revenueMode === "wholesale";
  const dsc = whole ? n(x.discount) : 0;
  const rho = keep ? n(x.retained) : 0;
  const e = exc ? n(x.excise) : 0;
  const a = pct ? n(x.adValorem) : 0;
  const G = n(x.wineGallons);
  const r0 = effectivePrice(x)!; // the grocery price after pass-through (or matched), before any replacement tax reaches it
  // The replacement tax per state-store dollar of wine, and the share of it that reaches the shelf (1.3); with matched
  // prices all of it is inside the unchanged shelf price (1.5).
  const tau = x.revenueMode === "excise" || x.revenueMode === "percent" ? (x.matchPrice ? 1 : n(x.taxToPrice)) : 0;
  const r = r0 + tau * (a * r0 + (W > 0 ? (e * G) / W : 0)); // the grocery shelf price, before sales tax
  // The sales-tax base on grocery wine (1.6): the shelf price, or the shelf price less the part of the charge in it.
  const charged = x.revenueMode === "excise" || x.revenueMode === "percent";
  const rTax = charged && x.chargeInSalesTax === false ? r - tau * (a * r0 + (W > 0 ? (e * G) / W : 0)) : r;
  const h = whole ? n(x.handlingCost) : 0; // cost per $ of wine DABS supplies to grocers (1.6)

  const baseline: Component[] = [
    { id: "store_margin", label: "State-store gross margin on wine", value: m * W, kind: "revenue" },
    { id: "sales_tax", label: "State sales tax on wine", value: t * W, kind: "revenue" },
  ];
  const baselineTotal = m * W + t * W;
  const shifted = W * s; // baseline sales (at state-store prices) that move to grocery stores
  const grocerySales = r * shifted; // the same wine at grocery shelf prices
  const groceryTaxBase = rTax * shifted; // its sales-tax base (= grocerySales unless the charge is outside the base)
  const aParts: Component[] = [
    { id: "store_margin", label: "State-store gross margin on the wine still sold by the state", value: m * (W - shifted), kind: "revenue" },
    ...(keep ? [{ id: "retained", label: "State share of grocery wine sales (e.g. wholesale margin)", value: rho * grocerySales, kind: "revenue" as const }] : []),
    ...(exc ? [{ id: "excise", label: "Excise on grocery wine", value: e * G * s, kind: "revenue" as const }] : []),
    ...(pct ? [{ id: "ad_valorem", label: "Tax on the grocery shelf price", value: a * r0 * shifted, kind: "revenue" as const }] : []),
    ...(whole ? [{ id: "wholesale", label: "State margin on wine DABS sells to grocers (gross margin less the discount)", value: (m - dsc) * shifted, kind: "revenue" as const }] : []),
    { id: "sales_tax", label: "State sales tax on all wine", value: t * (W - shifted + groceryTaxBase), kind: "revenue" },
  ];
  const aRevenue = aParts.reduce((sum, c) => sum + c.value, 0);
  const saved = v * shifted;
  const added = x.newCosts!;
  const handling = h * shifted;
  const a2: Component[] = [
    ...aParts,
    { id: "cost_saved", label: "State operating costs avoided on the shifted sales", value: saved, kind: "cost_saved" },
    { id: "new_costs", label: "New state costs of licensing and enforcing grocery sales", value: added, kind: "cost_added" },
    ...(whole && h > 0 ? [{ id: "handling", label: "State cost of supplying grocers, beyond today's cost of that wine", value: handling, kind: "cost_added" as const }] : []),
  ];
  const netA = aRevenue - baselineTotal + saved - added - handling;
  // Net change per $1 of shifted sales, before the fixed new costs.
  const perShiftedDollar = -m + rho * r + a * r0 + (whole ? m - dsc - h : 0) + t * (rTax - 1) + v + (W > 0 ? (e * G) / W : 0);
  // Break-even: the share of grocery sales the state would need to keep for scenario A to change nothing.
  let breakEven: ScenarioResult["breakEvenRetained"];
  if (s === 0) breakEven = { value: null, note: "No wine moves, so there is nothing to break even." };
  else if (whole) breakEven = { value: null, note: "In the wholesale arrangement the state keeps its margin less the discount; see the break-even discount." };
  else if (W === 0) breakEven = { value: null, note: "Baseline wine sales are zero." };
  else {
    const need = (m - t * (r - 1) - v - a * r0 - (e * G) / W + added / shifted) / r;
    breakEven = {
      value: need,
      note:
        need <= 0
          ? "Already at or above break-even without the state keeping any share of grocery sales."
          : need > 1
            ? "Not reachable: the state would need to keep more than 100% of each grocery sales dollar."
            : "Share of each grocery sales dollar the state would need to keep (on top of the other revenue chosen) for state revenue to stay unchanged.",
    };
  }

  // Wholesale: net A falls by the shifted sales for each point of discount, so it is zero at d + net A / shifted.
  const breakEvenDiscount: ScenarioResult["breakEvenDiscount"] = !whole
    ? { value: null, note: "" }
    : s === 0 || W === 0
      ? { value: null, note: "No wine moves." }
      : (() => {
          const need = dsc + netA / shifted;
          return {
            value: need,
            note:
              need < 0
                ? "Not reachable with a discount: even selling to grocers at the full shelf price, the state would collect less than today."
                : "Largest discount DABS could give grocers for state revenue to stay unchanged (other inputs as entered).",
          };
        })();
  // Net A rises by G x s for each extra dollar of excise per gallon, and by t x tau x G x s more through the sales tax
  // on the part of it that reaches the shelf.
  const breakEvenExcise: ScenarioResult["breakEvenExcise"] =
    s === 0 || G <= 0
      ? { value: null, note: s === 0 ? "No wine moves." : "Needs wine gallons." }
      : (() => {
          const need = e + -netA / (G * s * (1 + (x.revenueMode === "excise" && x.chargeInSalesTax !== false ? t * tau : 0)));
          return { value: need, note: need <= 0 ? "Already at or above break-even without an excise." : "Excise per gallon on grocery wine at which state revenue stays unchanged (other inputs as entered)." };
        })();
  let breakEvenShift: ScenarioResult["breakEvenShift"];
  if (perShiftedDollar <= 0) {
    breakEvenShift = { value: null, note: "No share breaks even: each dollar that moves lowers state revenue, so moving more makes it worse." };
  } else if (added === 0) {
    breakEvenShift = { value: 0, note: "Any share raises state revenue, because each dollar that moves gains revenue and there are no new fixed costs." };
  } else {
    const need = added / (W * elig * perShiftedDollar);
    breakEvenShift = {
      value: need,
      note:
        need > 1
          ? `Not reachable: even moving all ${x.eligible === undefined ? "wine sales" : "household purchases"} would not cover the new costs.`
          : `Share of ${x.eligible === undefined ? "wine purchases" : "household wine purchases"} that must move to grocery stores to cover the new fixed costs.`,
    };
  }

  let b: Component[] | null = null;
  let netB: number | null = null;
  let beer: ScenarioResult["beer"] = null;
  let demandFactor: number | null = null;
  let extraStreams: ExtraStream[] | null = null;
  if (x.extra) {
    const g = x.growth!;
    const q = x.extraGrocery!;
    // Three named sources of extra wine, in baseline-price dollars (a negative amount is less wine bought):
    //  * access: easier buying raises total volume by g (a share q of it bought in grocery stores);
    //  * price: the wine that moved is bought in a different quantity because its price changed (r ** elasticity);
    //  * recapture: wine now bought outside Utah that would be bought here instead (same channel mix as access).
    const eps = x.elasticity ?? 0;
    demandFactor = eps !== 0 ? (x.demandForm === "linear" ? Math.max(0, 1 + eps * (r - 1)) : Math.pow(r, eps)) : null;
    const accessDollars = g * W;
    const accessGallons = g * G;
    const priceDollars = ((demandFactor ?? 1) - 1) * shifted;
    const priceGallons = ((demandFactor ?? 1) - 1) * G * s;
    const recapDollars = n(x.recapture) * W;
    const recapGallons = n(x.recapture) * G;
    const viaState = (1 - q) * (accessDollars + recapDollars); // bought from state stores
    const viaGrocery = q * (accessDollars + recapDollars) + priceDollars; // bought in grocery stores
    const groceryGallons = q * (accessGallons + recapGallons) + priceGallons;
    extraStreams = [
      { id: "access", label: "Easier access: more wine bought in total", dollars: accessDollars, gallons: accessGallons },
      ...(demandFactor !== null ? [{ id: "price" as const, label: "Price response of the wine that moves", dollars: priceDollars, gallons: priceGallons }] : []),
      ...(n(x.recapture) > 0 ? [{ id: "recapture" as const, label: "Recaptured from purchases outside Utah", dollars: recapDollars, gallons: recapGallons }] : []),
    ];
    const bParts: Component[] = [
      { id: "extra_store_margin", label: "State-store gross margin on extra wine bought from the state", value: m * viaState, kind: "revenue" },
      ...(keep ? [{ id: "extra_retained", label: "State share of extra grocery wine sales", value: rho * r * viaGrocery, kind: "revenue" as const }] : []),
      ...(exc ? [{ id: "extra_excise", label: "Excise on extra grocery wine", value: e * groceryGallons, kind: "revenue" as const }] : []),
      ...(pct ? [{ id: "extra_ad_valorem", label: "Tax on extra grocery wine", value: a * r0 * viaGrocery, kind: "revenue" as const }] : []),
      ...(whole ? [{ id: "extra_wholesale", label: "State margin on extra wine DABS sells to grocers", value: (m - dsc) * viaGrocery, kind: "revenue" as const }] : []),
      { id: "extra_sales_tax", label: "State sales tax on the extra wine", value: t * (viaState + rTax * viaGrocery), kind: "revenue" },
      { id: "extra_cost", label: "State operating costs of the extra state-store sales", value: v * viaState, kind: "cost_added" },
      ...(whole && h > 0 ? [{ id: "extra_handling", label: "State cost of supplying grocers the extra wine", value: h * viaGrocery, kind: "cost_added" as const }] : []),
    ];
    // Beer is displaced only by the extra wine that easier access creates: the price response is a change in how
    // much wine is bought at a new price (no beer offset is assumed), and recaptured wine is already being drunk.
    if (x.substitution && x.replaces! > 0) {
      const spend = (1 - q) * accessDollars + q * r * accessDollars; // consumer spending on the access wine
      const gallons = accessGallons;
      const k = x.replaces!;
      const Pb = x.beerPrice!;
      let beerGallons: number;
      let beerDollars: number;
      if (x.basis === "spending") {
        beerDollars = k * spend;
        beerGallons = Pb > 0 ? beerDollars / Pb : 0;
      } else if (x.basis === "volume") {
        beerGallons = k * gallons;
        beerDollars = beerGallons * Pb;
      } else {
        beerGallons = (k * gallons * x.wineAbv!) / x.beerAbv!;
        beerDollars = beerGallons * Pb;
      }
      beer = { gallons: beerGallons, dollars: beerDollars, basis: x.basis! };
      bParts.push(
        { id: "beer_excise_lost", label: "Beer excise lost on beer no longer bought", value: (beerGallons / 31) * x.beerTax!, kind: "revenue_lost" },
        { id: "beer_sales_tax_lost", label: "Sales tax lost on beer no longer bought", value: t * beerDollars, kind: "revenue_lost" },
      );
    }
    b = bParts;
    netB = netA + bParts.reduce((sum, c) => sum + (c.kind === "revenue" ? c.value : -c.value), 0);
  }
  return { missing, invalid, baseline, baselineTotal, a: a2, aRevenue, netA, perShiftedDollar, breakEvenRetained: breakEven, breakEvenDiscount, breakEvenShift, breakEvenExcise, b, netB, beer, priceRatioUsed: r, priceBeforeTax: r0, demandFactor, extraStreams };
}

/** Worked examples for the calculator. The values are round illustrations, labelled as such wherever they
 * appear; they are not estimates for Utah. Keys are the calculator's address fields. */
export const SCENARIO_EXAMPLES: { id: string; label: string; values: Record<string, string> }[] = [
  {
    id: "shift",
    label: "Channel shift only",
    values: { wr: "share", ws: "25", st: "5", vc: "5", nc: "500000", s: "30", r: "100", rm: "keep", rho: "20" },
  },
  {
    id: "more",
    label: "Shift plus more wine bought, some replacing beer",
    values: { wr: "share", ws: "25", st: "5", vc: "5", nc: "500000", s: "30", r: "100", rm: "keep", rho: "20", b: "1", g: "5", q: "100", sub: "1", k: "50", bas: "ethanol", pb: "10" },
  },
  {
    id: "excise",
    label: "Grocery wine taxed per gallon instead",
    values: { wr: "gallons", pg: "60", st: "5", vc: "5", nc: "500000", s: "30", r: "95", rm: "excise", exc: "3" },
  },
];

// ----- scenario A step by step, and the lever that breaks even ----------------------------------------------

export interface BridgeStep {
  id: string;
  label: string;
  /** Signed change in state revenue, $ per year. "of" rows break down the step above them and are not added again. */
  value: number;
  formula: string;
  part: "step" | "of" | "total";
}

/** Statutory deposit rates for the base year (from reconciliation.json): share of gross liquor sales. */
export interface DepositRates {
  school: number;
  enforcement: number;
}

/** Scenario A from today's revenue to the net change, one step per kind of money. The steps add up to netA; the
 * "of" rows show how the margin that moves is allocated today (the statutory deposits come out of the gross
 * margin), and are not added again. */
export function stepsA(x: ScenarioInputs, res: ScenarioResult, rates: DepositRates | null = null): BridgeStep[] {
  if (res.missing.length || res.invalid.length) return [];
  const W = x.wineSales!;
  const shifted = W * movedShare(x);
  const m = x.grossMargin!;
  const t = x.salesTax!;
  const get = (id: string) => res.a.find((c) => c.id === id)?.value ?? 0;
  const replaced = get("retained") + get("excise") + get("ad_valorem") + get("wholesale");
  const out: BridgeStep[] = [
    { id: "displaced", label: "Gross margin the state stores no longer earn on the sales that move", value: -m * shifted, formula: "− gross margin × sales that move (at state-store prices)", part: "step" },
  ];
  if (rates) {
    const school = rates.school * shifted;
    const enf = rates.enforcement * shifted;
    out.push(
      { id: "of_school", label: "of which today allocated to the Uniform School Fund (school meals)", value: school, formula: `${pctText(rates.school)} of the sales that move`, part: "of" },
      { id: "of_enforcement", label: "of which today allocated to the alcohol enforcement fund", value: enf, formula: `${pctText(rates.enforcement)} of the sales that move`, part: "of" },
      { id: "of_rest", label: "of which the rest: store costs, other transfers and the General Fund", value: m * shifted - school - enf, formula: "the margin less the two deposits", part: "of" },
    );
  }
  out.push(
    { id: "replaced", label: "Revenue the state keeps or replaces on the wine grocers sell", value: replaced, formula: replacedFormula(x), part: "step" },
    { id: "sales_tax", label: "Change in state sales tax", value: get("sales_tax") - t * W, formula: "sales tax rate × (grocery sales-tax base ÷ state-store price − 1) × sales that move", part: "step" },
    { id: "cost_saved", label: "Operating costs the state stores avoid (assumption)", value: get("cost_saved"), formula: "avoidable cost × sales that move", part: "step" },
    { id: "new_costs", label: "New licensing and enforcement costs (assumption)", value: -get("new_costs"), formula: "as entered", part: "step" },
    ...(get("handling") > 0 ? [{ id: "handling", label: "Cost of supplying grocers, beyond today's cost of that wine (assumption)", value: -get("handling"), formula: "handling cost × sales that move", part: "step" as const }] : []),
    { id: "net", label: "Net change in state revenue, all state funds together", value: res.netA, formula: "sum of the steps", part: "total" },
  );
  return out;
}

function pctText(v: number): string {
  return `${Number((v * 100).toFixed(3))}%`;
}

function replacedFormula(x: ScenarioInputs): string {
  switch (x.revenueMode) {
    case "wholesale":
      return "(gross margin − discount) × sales that move";
    case "keep":
      return "share kept × grocery sales";
    case "excise":
      return "excise × gallons that move";
    case "percent":
      return "tax rate × grocery sales";
    default:
      return "share kept and taxes on grocery sales";
  }
}

export type Lever = "retained" | "discount" | "excise" | "adValorem";

/** The value of the arrangement's own lever (share kept, discount, excise or extra tax) at which the net change of
 * scenario A or B is zero, other inputs as entered. Every scenario is linear in its lever, including the price
 * response of scenario B (which depends on the shelf price, not on the lever), so two evaluations solve it; a third
 * checks it. Null when the arrangement has several levers or the lever has no effect, and when the tax reaches the
 * shelf price in scenario B with a price response (then the net change is not linear in the tax: see
 * arrangements.solveLever). */
export function breakEvenLever(x: ScenarioInputs, which: "A" | "B"): { lever: Lever; value: number } | null {
  const lever: Lever | null =
    x.revenueMode === "keep" ? "retained" : x.revenueMode === "wholesale" ? "discount" : x.revenueMode === "excise" ? "excise" : x.revenueMode === "percent" ? "adValorem" : null;
  if (!lever || (which === "B" && !x.extra)) return null;
  const net = (v: number) => {
    const c = compute({ ...x, [lever]: v });
    return which === "A" ? c.netA : (c.netB ?? NaN);
  };
  const base = compute(x);
  if (base.missing.length || base.invalid.length) return null;
  const f0 = net(0);
  const f1 = net(lever === "discount" || lever === "retained" || lever === "adValorem" ? 0.5 : 1);
  const step = lever === "excise" ? 1 : 0.5;
  const slope = (f1 - f0) / step;
  if (!Number.isFinite(slope) || Math.abs(slope) < 1e-9) return null;
  const value = -f0 / slope;
  const check = net(value);
  if (!Number.isFinite(check) || Math.abs(check) > 1e-6 * Math.max(1, Math.abs(f0), Math.abs(f1))) return null;
  return { lever, value };
}

/** A worked proposal: one explicit policy, every input either from the dataset or a stated assumption, with what it
 * shows and what it cannot. Opened like an example (eg=<id>), but its inputs are the proposal's assumptions. */
export interface WorkedProposal {
  id: string;
  label: string;
  values: Record<string, string>;
  proposal: { item: string; text: string; basis: "data" | "assumption" | "policy" }[];
  demonstrates: string[];
  cannotEstablish: string[];
}

export const WORKED_PROPOSALS: WorkedProposal[] = [
  {
    id: "dabs_wholesale",
    label: "Worked proposal: grocery wine with DABS as wholesaler",
    values: { fy: "2025", wr: "share", ws: "33.5", st: "4.85", vc: "5", nc: "500000", s: "30", hh: "82", r: "100", rm: "wholesale", dc: "20" },
    proposal: [
      { item: "What changes", basis: "policy", text: "Licensed grocery stores may sell wine to take home. State stores and package agencies keep selling everything, wine included." },
      { item: "Who supplies the wine", basis: "policy", text: "DABS stays the only wine wholesaler. It sells to grocers at its own shelf price less a 20% retailer discount, so on each dollar of wine that moves the state keeps its gross margin less 20 points. That needs a change to Utah Code § 32B-2-304(2): at DABS's all-product margin, a discount above about 0.5% takes the markup on that wine below the 88.5% minimum." },
      { item: "Prices", basis: "assumption", text: "Grocers charge the state-store price; shelf prices, and so sales tax per bottle, do not change, and no price response follows." },
      { item: "Which purchases move", basis: "assumption", text: "30% of the wine households now buy from state stores and package agencies (by value at state-store prices) is bought in grocery stores instead; licensees (bars, restaurants, clubs) keep buying from DABS. Households are taken to buy 82% of wine sales, DABS's off-premise share of all its sales in FY2025 (its annual report, p. 18, read from a chart): an all-product figure applied to wine, so 24.6% of wine sales move. Total wine bought does not change (scenario A). No source measures either share for wine." },
      { item: "Costs", basis: "assumption", text: "The state stores avoid 5 cents of operating cost for each dollar of sales that leaves them; licensing and enforcing grocery sales costs the state $500,000 a year. The exploratory cost regression is shown beside the input and not used." },
      { item: "Earmarks", basis: "policy", text: "The deposit provisions, Utah Code §§ 32B-2-304(5) and 32B-2-305(4), are left as they are. The proposal does not decide whether DABS's sales to grocers carry the school-meals and enforcement deposits, so those amounts are shown as today's allocation of the sales that move, not as losses to those funds." },
      { item: "Baseline", basis: "data", text: "DABS's FY2025 liquor sales (its FY2025 annual report, transcribed, not reviewed by a person) times wine's 33.5% share of gross sales in DABS's twelve FY2026 monthly reports: wine at state-store prices, before sales tax. The share is from the following year." },
      { item: "Sales tax", basis: "assumption", text: "4.85%, the state portion in Publication 25 (Rev. 9/26), taken as FY2025's rate, which the dataset does not establish. With prices unchanged, the rate changes today's revenue but not the net change." },
    ],
    demonstrates: [
      "How the state's revenue changes when retail moves but DABS keeps the wholesale margin: per dollar that moves, the state gives up the retailer discount and saves the operating cost it avoids; the gross margin itself cancels out.",
      "The largest discount at which state revenue stays unchanged, and which assumptions could turn the result positive.",
      "That the school-meals and enforcement amounts are part of the margin already counted, so the total is unchanged by how they are allocated; only who receives the money depends on the law.",
    ],
    cannotEstablish: [
      "How much wine would move, what share of wine households buy, what discount grocers would accept, or how much store cost would really fall: all are assumptions.",
      "Whether people would buy more wine, or less beer, and any effect on drinking, health or safety.",
      "Local sales tax, grocers' profits, one-time costs, or how the legislature would fund the school-meals and enforcement allocations.",
      "A forecast: DABS's FY2025 figures are unaudited and unreviewed, and the wine share is from a later year's monthly reports.",
    ],
  },
  {
    id: "compare_fy2025",
    label: "Worked comparison: three grocery-wine arrangements, FY2025",
    values: { fy: "2025", wr: "share", ws: "33.5", st: "4.85", vc: "5", nc: "500000", s: "30", hh: "82", r: "100", rm: "wholesale", dc: "20", b: "1", g: "0", q: "100", el: "-0.46", cmp: "1", pc: "matched", rt: "percent", rtv: "20", eb: "private", er: "fixed", gw: "29.5", gg: "28" },
    proposal: [
      { item: "What changes", basis: "policy", text: "Licensed grocery stores may sell wine to take home; state stores and package agencies keep selling everything. Three ways for the state to collect on that wine are set side by side. None is current law, and none is a bill." },
      { item: "Arrangement 1", basis: "policy", text: "Grocers buy from private wholesalers. The state levies a retail-level replacement tax of 20% of the grocery price before the tax and before sales tax (its base); ordinary state sales tax then applies to the shelf price with the tax in it. The state stops both retailing and wholesaling that wine, so it gives up its whole gross margin on it." },
      { item: "Arrangement 2", basis: "policy", text: "DABS stays the only wine wholesaler and sells to grocers at its shelf price less 20%. The grocer keeps the difference between its shelf price and what it pays DABS; the state keeps its gross margin less the discount. That needs a change to Utah Code § 32B-2-304(2): at DABS's all-product margin, a discount above about 0.5% takes the markup on that wine below the 88.5% minimum." },
      { item: "Arrangement 3", basis: "policy", text: "Arrangement 1, with the school-meals and enforcement funds guaranteed what the wine that moves would have paid them: 10% and 1.695% (the base year's statutory deposit rates) of its value at state-store prices, about $5.3 million, paid from the replacement tax. Two versions are different proposals and both are shown: a fixed guarantee set once from this scenario, or a proportional one that pays those rates on the state-store sales actually lost each year. Either is the proposal's term, not current law; it moves money between state funds, adds none, and leaves the whole loss with the General Fund and other funds." },
      { item: "Prices", basis: "assumption", text: "The reference case is matched consumer prices: grocers charge what a state store charges for the same bottle. In arrangement 1 the 20% replacement tax is then inside that price, so private wholesalers and grocers sell at 83.3% of today's price before the tax and bear it; in arrangement 2 the grocer keeps the 20% discount. Prices do not change, so no price response follows. The alternative, grocers charging today's price before the tax and adding all of it (20% more than a state store), is a row of the joint scenarios, with the price response read as less wine bought; reading it as buyers going back to state stores is exploratory. No source measures what grocers would charge." },
      { item: "Which purchases move", basis: "assumption", text: "30% of the wine households now buy from state stores and agencies, by value at state-store prices, moves to grocers; licensees (bars, restaurants, clubs) keep buying from DABS. Households are taken to buy 82% of wine sales, DABS's off-premise share of all its sales in FY2025 (its annual report, p. 18, read from a chart; whole percents, all products): wine's own split is not published, so 24.6% of wine sales moving rests on two unmeasured shares. A records request for the split is drafted, not sent." },
      { item: "Purchases", basis: "assumption", text: "The share moving does not depend on price. When prices change (the alternative case), the moved wine responds with an elasticity of −0.46 (Nelson 2013, a published meta-analysis of market-level studies; applying it to one channel's price in Utah is the assumption). No recapture, access effect or beer substitution is entered: no source measures them for Utah." },
      { item: "Sellers", basis: "assumption", text: "To ask whether sellers could live with each arrangement, the gross margins sellers need are taken as Census's 2022 national averages as a percent of sales: 29.5% for beer, wine and spirits merchant wholesalers (Annual Wholesale Trade Survey, table 4, 2022 revised) and 28.0% for grocery stores (Annual Retail Trade Survey, 2022 benchmarked). All products, all states, not wine in Utah. Both workbooks are saved, pinned and parsed into the dataset (us_wholesale_gross_margin_pct_alcohol_beverages and us_retail_gross_margin_pct_grocery_stores, 2022)." },
      { item: "Costs", basis: "assumption", text: "The state stores stop paying 5 cents of operating cost per dollar of sales that leaves them, in both arrangements; nothing more is counted for the wholesaling the state stops in arrangement 1. Licensing and enforcing grocery sales costs $500,000 a year." },
      { item: "Baseline", basis: "data", text: "DABS's FY2025 liquor sales and gross profit (its FY2025 annual report, transcribed, not reviewed by a person) and wine's 33.5% share of gross sales in DABS's twelve FY2026 monthly reports: wine at state-store prices, before sales tax. The audited FY2025 fund agrees with DABS's sales after the two statutory deposits, as a cross-check." },
      { item: "Sales tax and deposits", basis: "assumption", text: "4.85%, the state portion in Publication 25 (Rev. 9/26), taken as FY2025's rate. The school-meals (10%) and enforcement (1.695%) deposit rates are the law as read online, not reviewed." },
    ],
    demonstrates: [
      "How much of the state's margin each arrangement gives up and what replaces it: the whole gross margin against a replacement tax in arrangement 1, only the discount in arrangement 2.",
      "That at matched prices the state and the sellers divide the same margin: the state breaks even only if sellers keep no more than the operating cost it avoids less the new costs (3.9 cents a dollar here), far below the margins sellers are assumed to need; and the shelf price at which both would hold.",
      "The replacement tax at which arrangement 1 would leave state revenue unchanged, with the price response included and without it, and the largest discount arrangement 2 could give.",
      "That an allocation to school meals and enforcement changes which funds bear the result, not its size: keeping those funds whole puts the whole loss on the General Fund and other funds, in both cases shown.",
      "Which assumptions reverse the sign, and where, in the chart and the sensitivity notes. The result is kept as it falls, unfavourable or not.",
    ],
    cannotEstablish: [
      "How much wine would move, what share of wine households buy, what grocers would charge, what margin they would accept, or how much state cost would really stop: all are assumptions.",
      "Whether total drinking would change, through access, recapture or substitution between beer, wine and spirits (the evidence on substitution is inadequate, and privatization studies elsewhere found no offsetting fall in other beverages), and any effect on health or safety.",
      "Local sales tax, private wholesalers' and grocers' profits, one-time costs, or whether any arrangement is legally or administratively workable.",
      "A forecast: DABS's FY2025 figures are unaudited and unreviewed, the wine share is from a later year, and the margin is for all products.",
    ],
  },
];
