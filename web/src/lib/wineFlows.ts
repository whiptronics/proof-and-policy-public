// Grocery-wine purchase flows (method WINE_FLOWS_METHOD): where wine sold in grocery stores would come from, and what
// each source does to state receipts, computed from before-and-after totals by beverage and channel.
//
// Why a second layer (Ethan's brief of 2026-10-18): the alternatives (lib/wineAlternatives.ts) move existing DABS wine
// to grocers and, for demand, apply a market-wide price elasticity to the grocery price as though every wine price had
// changed, counting every bottle not bought at a grocer as gone from Utah. This layer keeps the alternatives' per-bottle
// terms (read from their price stacks, never re-derived) and replaces the purchase side:
//
// * Grocery wine has five origins that reconcile to the grocery total: A. wine households used to buy at DABS;
//   B. beer purchases replaced by wine; C. spirits purchases replaced by wine; D. purchases that used to be made outside
//   Utah; E. purchases that replace nothing (additional). B to E may also be bought at DABS (a channel split each).
// * Migration (A) is a share of household DABS wine at equal consumer prices. A convenience scenario may make it fall
//   as the grocery price rises above the state store's. Purchases that would move at equal prices but do not at the
//   arrangement's price are "declined" and split explicitly: still bought at DABS (default), switched to grocery beer,
//   bought outside Utah, or not bought. Declining a grocery purchase is never taken to mean less wine bought in Utah
//   unless that split says so.
// * Substitution (B, C) is participation (share of eligible buyers who change) x intensity (share of their purchases of
//   the original beverage they replace) x a purchase weight (participants' purchases relative to the average eligible
//   buyer's), applied to household purchases of that beverage. The wine bought for what was replaced is set on a stated
//   basis: equal pure alcohol (default, the constant-alcohol scenario), equal litres, or equal spending.
// * Every quantity is kept in litres of beverage, litres of pure alcohol and dollars; wine is also counted in dollars
//   at today's state-store price ("state-store-equivalent dollars"), the unit the alternatives use. No two units are
//   added together.
// * State receipts are computed for the baseline and the proposal from quantities, prices and the collection on each
//   beverage in each channel; the change is the difference of the two totals. A decomposition by origin explains it
//   and must add back to it. School-meals and enforcement deposits are allocations of DABS's gross revenue, reported
//   under both readings of the law and never added to the totals.
// * Licensees (bars, restaurants, clubs) keep buying from DABS and are outside every flow. Local sales tax is not
//   modelled. Health and safety are outside the calculation.
//
// Arithmetic on stated inputs. Shares of switching, recapture and additional buying have no Utah source: they are
// illustrative and varied in the exported grids, never estimated here.
import { INITIATIVES, proposalInputs } from "./initiatives";
import { WORKED_PROPOSALS } from "./scenario";
import { COST_LINES, ELASTICITY, alternativeById, evaluateFixed, type Overrides } from "./wineAlternatives";
import { STATUTORY_MARKUP, marginOfMarkup } from "./wineMargin";

export const WINE_FLOWS_METHOD = "wine-purchase-flows@1.0";

// ----- units and base-year data ---------------------------------------------------------------------------------------

export const L_PER_GALLON = 3.785411784;
/** Container sizes used only to report bottles and cans (no quantity is computed per occasion). */
export const CONTAINER_L = { wine: 0.75, spirits: 0.75, beer: 0.354882 } as const;

/** Dataset values the flows read (checked against the exported dataset in wineFlows.data.test.ts). */
export const FLOW_DATA = {
  /** DABS twelve FY2026 monthly reports summed (dataset ut_dabs_fy_*, FY2026). */
  dabsFy2026: {
    salesTotal: 543_682_177.59,
    salesWine: 182_331_954.71,
    salesSpirits: 302_995_274.82,
    salesHeavyBeer: 32_101_654.42,
    cases9lWine: 1_291_694.7722,
    cases9lSpirits: 1_389_659.8497,
    cases9lHeavyBeer: 529_830.9865,
  },
  /** NIAAA apparent consumption, Utah, calendar 2024 (dataset niaaa_*). */
  niaaa2024: { beerGallons: 26_660_000, abvBeer: 0.048, abvWine: 0.118, abvSpirits: 0.349 },
} as const;

/** Stated values: placeholders with no source in the dataset (varied in the sensitivity table), and the beer excise. */
export const FLOW_PLACEHOLDERS = {
  /** Grocery beer shelf price before sales tax, $ per US gallon (no Utah beer price is in the dataset). */
  beerPricePerGallon: 12,
  /** Utah beer excise for FY2025, $ per 31-gallon barrel, on beer and heavy beer: Utah Code 59-15-101(2)(b)(ii) in the
   * version effective 2024-05-01 (dataset policy event ut_beer_tax_1335). A statute, not a placeholder. */
  beerExcisePerBarrel: 13.35,
  /** ABV of the heavy beer DABS sells (above 5%; no average is published). */
  heavyBeerAbv: 0.07,
  /** Share of beer bought by households (off-premise): DABS's all-product off-premise share used as a proxy. */
  beerHouseholdShare: 0.82,
} as const;

const INIT = INITIATIVES[0];
const D = INIT.worked.data;
/** The worked comparison's own scenario inputs (wine sales, household share, margin, sales tax), read as the
 * alternatives read them, so the two layers cannot drift apart. */
const X0 = proposalInputs(WORKED_PROPOSALS.find((p) => p.id === INIT.worked.proposalId)!.values, D);

export interface BeverageBase {
  /** Dollars a year at the baseline shelf price before sales tax. */
  value: number;
  /** Litres of beverage a year. */
  litres: number;
  /** Shelf price before sales tax, $ per litre. */
  price: number;
  abv: number;
  /** Share bought by households (the only purchases that can move or switch). */
  household: number;
  /** State margin on the shelf price (DABS beverages); zero for grocery beer. */
  margin: number;
}

export interface FlowBase {
  year: string;
  /** All DABS wine (households and licensees), FY2025 dollars at state-store prices. */
  wine: BeverageBase;
  spirits: BeverageBase;
  /** Heavy beer sold by DABS (above 5% ABV). */
  heavyBeer: BeverageBase;
  /** Beer sold outside DABS (grocery and convenience stores and licensees through distributors). */
  beer: BeverageBase & { excisePerLitre: number };
  salesTax: number;
  rates: { school: number; enforcement: number };
}

function base(): FlowBase {
  const f = FLOW_DATA.dabsFy2026;
  const n = FLOW_DATA.niaaa2024;
  const sales = D.sales; // DABS FY2025 liquor sales
  const wineValue = X0.wineSales!; // FY2025 sales x wine's 33.5% share (the alternatives' U01)
  const household = X0.eligible!; // the alternatives' U03
  const priceOf = (s: number, cases: number) => s / (cases * 9);
  const wp = priceOf(f.salesWine, f.cases9lWine);
  const sp = priceOf(f.salesSpirits, f.cases9lSpirits);
  const hp = priceOf(f.salesHeavyBeer, f.cases9lHeavyBeer);
  const margin = X0.grossMargin!; // DABS FY2025 all-product gross margin (U02)
  const spiritsValue = sales * (f.salesSpirits / f.salesTotal);
  const heavyValue = sales * (f.salesHeavyBeer / f.salesTotal);
  const beerLitres = n.beerGallons * L_PER_GALLON - f.cases9lHeavyBeer * 9;
  const bp = FLOW_PLACEHOLDERS.beerPricePerGallon / L_PER_GALLON;
  return {
    year: `FY${D.fy}`,
    wine: { value: wineValue, litres: wineValue / wp, price: wp, abv: n.abvWine, household, margin },
    spirits: { value: spiritsValue, litres: spiritsValue / sp, price: sp, abv: n.abvSpirits, household, margin },
    heavyBeer: { value: heavyValue, litres: heavyValue / hp, price: hp, abv: FLOW_PLACEHOLDERS.heavyBeerAbv, household, margin: marginOfMarkup(STATUTORY_MARKUP.heavyBeer) },
    beer: { value: beerLitres * bp, litres: beerLitres, price: bp, abv: n.abvBeer, household: FLOW_PLACEHOLDERS.beerHouseholdShare, margin: 0, excisePerLitre: FLOW_PLACEHOLDERS.beerExcisePerBarrel / 31 / L_PER_GALLON },
    salesTax: X0.salesTax!,
    rates: INIT.worked.rates,
  };
}

/** The base year the flows use (FY2025 dollars; prices per litre from DABS's FY2026 monthly reports). */
export const FLOW_BASE: FlowBase = base();

export interface BaseChanges {
  /** Households' share of DABS purchases (wine, spirits, heavy beer). */
  household?: number;
  /** Households' share of beer bought outside DABS. */
  beerHousehold?: number;
  beerPricePerGallon?: number;
  beerExcisePerBarrel?: number;
  /** Wine price per litre at a state store (dollars stay fixed; litres follow). */
  winePricePerLitre?: number;
}

/** The base year with some stated values changed, for the sensitivity table. Dollar totals stay fixed except beer's,
 * which is litres (measured) x the price (a placeholder). */
export function flowBaseWith(c: BaseChanges, b: FlowBase = FLOW_BASE): FlowBase {
  const h = c.household ?? b.wine.household;
  const wp = c.winePricePerLitre ?? b.wine.price;
  const bp = c.beerPricePerGallon !== undefined ? c.beerPricePerGallon / L_PER_GALLON : b.beer.price;
  return {
    ...b,
    wine: { ...b.wine, household: h, price: wp, litres: b.wine.value / wp },
    spirits: { ...b.spirits, household: h },
    heavyBeer: { ...b.heavyBeer, household: h },
    beer: {
      ...b.beer,
      household: c.beerHousehold ?? b.beer.household,
      price: bp,
      value: b.beer.litres * bp,
      excisePerLitre: c.beerExcisePerBarrel !== undefined ? c.beerExcisePerBarrel / 31 / L_PER_GALLON : b.beer.excisePerLitre,
    },
  };
}

// ----- arrangements -------------------------------------------------------------------------------------------------

export type FlowArrangementId = "baseline" | "preserved_dabs" | "preserved_private" | "preserved_dabs_matched" | "dabs_discount_20" | "private_tax_20";

export interface ArrangementTerms {
  id: FlowArrangementId;
  label: string;
  short: string;
  /** The alternative whose price stack gives the terms (null for the baseline). */
  altId: string | null;
  supply: "none" | "dabs" | "private";
  /** The state's markup or replacement charge per $1 of wine at today's state-store price, on the grocery channel. */
  stateCollection: number;
  collection: "none" | "dabs_markup" | "replacement_charge";
  /** How the collection is set and on what base. */
  chargeBase: string;
  /** Who pays the state and who remits. */
  collectedFrom: string;
  /** Grocery shelf price before sales tax, per $1 of today's state-store price. */
  shelf: number;
  /** State sales-tax base per $1 of today's state-store price. */
  salesTaxBase: number;
  /** Grocery consumer price against the same bottle at a state store, state sales tax included (1 = same). */
  consumerRatio: number;
  /** Per $1 of today's state-store price: what the wine costs (landed cost), and what each seller keeps. */
  acquisition: number;
  wholesalerKeeps: number;
  grocerKeeps: number;
  /** The grocer's gross margin as a share of its own selling price (before its own costs: not profit). */
  grocerMarginShare: number | null;
  /** DABS's revenue from its sales to grocers per $1 (DABS supply): the deposit base under the reading that counts it. */
  dabsRevenuePerDollar: number;
  /** Whether the state's collection per equivalent bottle equals today's markup (a proposed design, not current law). */
  preservesCollection: boolean;
  note: string;
}

const ARR_DEFS: { id: Exclude<FlowArrangementId, "baseline">; altId: string; label: string; short: string; note: string }[] = [
  {
    id: "preserved_dabs",
    altId: "A_target",
    label: "Preserved collection, DABS as wholesaler: DABS sells to grocers at today's shelf price; the grocer adds its own margin (28%)",
    short: "Preserved, DABS wholesale",
    note: "Proposed design, not current law. The state keeps its full markup on every bottle. The grocer is paid by a higher grocery price: the price is a result, not an assumption.",
  },
  {
    id: "preserved_private",
    altId: "C_gallon",
    label: "Preserved collection, private supply: a per-gallon charge collected from the licensed wholesaler, equal to DABS's average markup per gallon",
    short: "Preserved, private + charge",
    note: "Proposed design, not current law (no wine excise exists). Same dollars to the state per gallon as DABS's markup today. The private wholesaler (29.5%) and the grocer (28% of its price before the charge, which it passes on at cost: 19.3% of its full shelf price) are paid by a higher price.",
  },
  {
    id: "preserved_dabs_matched",
    altId: "A_matched",
    label: "Preserved collection at today's consumer price: DABS keeps its markup and grocers charge the state-store price",
    short: "Preserved, today's price",
    note: "Diagnostic: with both the state's markup and the consumer price held, nothing is left to pay the grocer (a 0% margin). Shows why preserving the collection does not also preserve the price.",
  },
  {
    id: "dabs_discount_20",
    altId: "B20_matched",
    label: "DABS sells to grocers at 20% off its shelf price; grocers charge the state-store price",
    short: "DABS 20% discount",
    note: "The grocer's margin (20%) comes out of DABS's markup. Needs a change to the statutory minimum markup.",
  },
  {
    id: "private_tax_20",
    altId: "C20_matched",
    label: "Private wholesalers supply grocers; the state levies a 20% tax on the grocery price before the tax; grocers charge the state-store price",
    short: "Private, 20% tax",
    note: "The state gives up its markup for a 20% tax; sellers keep the rest of today's price.",
  },
];

/** The terms of one arrangement, read from its alternative's price stack (optionally at an entered grocery price). */
export function arrangementTerms(id: FlowArrangementId, o: Overrides = {}): ArrangementTerms {
  if (id === "baseline") {
    return {
      id, label: "Baseline: DABS is the only wine retailer", short: "Baseline", altId: null, supply: "none", stateCollection: 0, collection: "none", chargeBase: "none", collectedFrom: "none",
      shelf: 1, salesTaxBase: 1, consumerRatio: 1, acquisition: 1 - FLOW_BASE.wine.margin, wholesalerKeeps: 0, grocerKeeps: 0, grocerMarginShare: null, dabsRevenuePerDollar: 0, preservesCollection: true, note: "Today.",
    };
  }
  const d = ARR_DEFS.find((a) => a.id === id)!;
  const def = alternativeById(d.altId);
  const k = evaluateFixed(def, o);
  if (!k) throw new Error(`${id}: the engine rejected the arrangement's inputs`);
  const st = k.stack;
  const a = st.after;
  const supply = def.supply;
  const charge = st.charge ? st.charge.perDollar : 0;
  const collection = supply === "dabs" ? a.dabsMargin : charge;
  const m = FLOW_BASE.wine.margin;
  return {
    id,
    label: d.label,
    short: d.short,
    altId: d.altId,
    supply,
    stateCollection: collection,
    collection: supply === "dabs" ? "dabs_markup" : "replacement_charge",
    chargeBase:
      supply === "dabs"
        ? `DABS's price to grocers (${((1 - (k.built.set.discount ?? 0)) * 100).toFixed(0)}% of today's shelf price) less its landed cost`
        : st.charge?.kind === "per_gallon"
          ? "per gallon, a fixed dollar amount equal to DABS's average markup per gallon"
          : "the grocery price before the charge (an on-price rate)",
    collectedFrom: supply === "dabs" ? "DABS keeps the markup on its sales to grocers" : st.charge?.collectedAt === "wholesaler" ? "collected from the licensed wholesaler at its first sale and remitted to the state" : "collected from the grocer and remitted to the state",
    shelf: a.shelf,
    salesTaxBase: a.salesTaxBase,
    consumerRatio: a.consumer / st.today.consumer,
    acquisition: a.acquisition,
    wholesalerKeeps: a.wholesaleMargin,
    grocerKeeps: a.retailerMargin,
    grocerMarginShare: st.retailerMarginShare,
    dabsRevenuePerDollar: supply === "dabs" ? a.acquisition + a.dabsMargin : 0,
    preservesCollection: Math.abs(collection - m) < 1e-9,
    note: d.note,
  };
}

export const FLOW_ARRANGEMENTS: FlowArrangementId[] = ["preserved_dabs", "preserved_private", "preserved_dabs_matched", "dabs_discount_20", "private_tax_20"];

// ----- inputs -------------------------------------------------------------------------------------------------------

export type ConversionBasis = "pure_alcohol" | "volume" | "spending";

export interface SubstitutionFlow {
  /** Share of eligible household buyers of the original beverage who change behaviour because wine is on the same shelf. */
  participation: number;
  /** Share of those buyers' purchases of the original beverage that they replace with wine. */
  intensity: number;
  /** Participants' purchases of the original beverage relative to the average eligible buyer's (1 = average). */
  weight: number;
  basis: ConversionBasis;
  /** Share of the wine bought instead that is bought at grocers (the rest at DABS). */
  grocery: number;
}

export interface FlowInputs {
  /** Share of household DABS wine purchases that would move to grocers at equal consumer prices. */
  migration: number;
  /** Convenience scenario: the grocery price premium (consumer price, 0.3 = 30%) at which nobody would move. Migration
   * falls in a straight line from `migration` at no premium to zero there. Null: migration ignores the price (the fixed
   * accounting case). */
  convenienceLimit: number | null;
  /** Where purchases go that would move at equal prices but not at the arrangement's price. Shares sum to 1. */
  declined: { dabs: number; beer: number; outOfState: number; none: number };
  beer: SubstitutionFlow & { /** Share of the beer replaced that is heavy beer bought at DABS (the rest is grocery beer). */ heavyShare: number };
  spirits: SubstitutionFlow;
  /** Purchases households now make outside Utah that would be made in Utah: share of household DABS wine purchases. */
  recapture: { share: number; grocery: number };
  /** Purchases that replace nothing: share of household DABS wine purchases. */
  additional: { share: number; grocery: number };
  costs: {
    /** DABS store costs that move with sales, per $ of DABS store sales (card fees, agency contracts, bags). */
    variable: number;
    /** DABS supply only: extra cost per $ of wine supplied to grocers. */
    handling: number;
    /** New licensing and enforcement, $ a year (only when grocery wine exists). */
    admin: number;
    /** Grocery wine license fees, $ a year. */
    licenseReceipts: number;
    /** Explicit longer-run restructuring: further DABS cost reduction per $ of lost DABS store sales (wages, delivery). */
    restructuring: number;
  };
  /** Exploratory: an elasticity applied to migrants' purchases at the grocery shelf price (the alternatives' old
   * treatment); what they no longer buy leaves the market. Null: migrants buy the same amount. */
  migrantResponse: number | null;
}

export const NO_SUBSTITUTION: SubstitutionFlow = { participation: 0, intensity: 0, weight: 1, basis: "pure_alcohol", grocery: 1 };

/** The comparable accounting case: 30% of household DABS wine moves whatever the price, nothing else changes. */
export const DEFAULT_FLOWS: FlowInputs = {
  migration: 0.3,
  convenienceLimit: null,
  declined: { dabs: 1, beer: 0, outOfState: 0, none: 0 },
  beer: { ...NO_SUBSTITUTION, heavyShare: 0 },
  spirits: { ...NO_SUBSTITUTION },
  recapture: { share: 0, grocery: 1 },
  additional: { share: 0, grocery: 1 },
  costs: { variable: COST_LINES.shortRun, handling: 0, admin: 500_000, licenseReceipts: 0, restructuring: 0 },
  migrantResponse: null,
};

/** A copy of the inputs with some fields changed (nested objects merged one level). */
export function withFlows(x: FlowInputs, ch: Partial<{ [K in keyof FlowInputs]: FlowInputs[K] extends object ? Partial<FlowInputs[K]> : FlowInputs[K] }>): FlowInputs {
  const out = { ...x } as Record<string, unknown>;
  for (const [k, v] of Object.entries(ch)) {
    const cur = (x as unknown as Record<string, unknown>)[k];
    out[k] = v !== null && typeof v === "object" && cur !== null && typeof cur === "object" ? { ...(cur as object), ...(v as object) } : v;
  }
  return out as unknown as FlowInputs;
}

/** Problems that make the inputs meaningless (shares outside 0-1, splits that do not add up, more than exists). */
export function checkFlows(x: FlowInputs, b: FlowBase = FLOW_BASE): string[] {
  const p: string[] = [];
  const share = (v: number, what: string) => {
    if (!Number.isFinite(v) || v < 0 || v > 1) p.push(`${what} must be between 0 and 1`);
  };
  share(x.migration, "Migration");
  if (x.convenienceLimit !== null && !(x.convenienceLimit > 0)) p.push("The convenience limit must be above zero");
  for (const [k, v] of Object.entries(x.declined)) share(v, `Declined purchases to ${k}`);
  const sum = x.declined.dabs + x.declined.beer + x.declined.outOfState + x.declined.none;
  if (Math.abs(sum - 1) > 1e-9) p.push("The split of declined purchases must add up to 1");
  for (const [name, s] of [["Beer", x.beer], ["Spirits", x.spirits]] as const) {
    share(s.participation, `${name} participation`);
    share(s.intensity, `${name} intensity`);
    share(s.grocery, `${name} grocery share`);
    if (!(s.weight >= 0)) p.push(`${name} purchase weight cannot be negative`);
    const replaced = s.participation * s.intensity * s.weight;
    if (replaced > 1 + 1e-12) p.push(`${name}: participation x intensity x weight would replace more than all household purchases`);
  }
  share(x.beer.heavyShare, "Heavy beer share");
  const beerPa = x.beer.participation * x.beer.intensity * x.beer.weight * b.beer.litres * b.beer.household * b.beer.abv;
  if (beerPa * x.beer.heavyShare > b.heavyBeer.litres * b.heavyBeer.household * b.heavyBeer.abv + 1e-6) p.push("More heavy beer would be replaced than households buy");
  for (const [name, f] of [["Recapture", x.recapture], ["Additional", x.additional]] as const) {
    if (!(f.share >= 0)) p.push(`${name} share cannot be negative`);
    share(f.grocery, `${name} grocery share`);
  }
  for (const [k, v] of Object.entries(x.costs)) if (!(v >= 0)) p.push(`Cost ${k} cannot be negative`);
  if (x.costs.variable > 1 || x.costs.handling > 1 || x.costs.restructuring > 1) p.push("Costs per dollar must be at most 1");
  if (x.migrantResponse !== null && !(x.migrantResponse <= 0 && x.migrantResponse >= -5)) p.push("The migrants' price elasticity must be between -5 and 0");
  return p;
}

// ----- results ------------------------------------------------------------------------------------------------------

export interface ChannelCell {
  beverage: "wine" | "beer" | "spirits" | "heavy_beer";
  channel: "dabs_store" | "grocery" | "outside_utah";
  litres: number;
  pureAlcoholLitres: number;
  /** Consumer spending before sales tax, $. */
  spending: number;
  /** Wine only: dollars at today's state-store price. */
  storeEquivalent: number | null;
}

export interface Collections {
  dabsWineMarkup: number;
  replacementCharge: number;
  dabsSpiritsMarkup: number;
  dabsHeavyBeerMarkup: number;
  beerExcise: number;
  salesTax: number;
  licenseReceipts: number;
}

export interface Costs {
  dabsVariableStoreCosts: number;
  handling: number;
  admin: number;
  /** Longer-run restructuring savings (a negative cost). */
  restructuringSavings: number;
}

export interface Totals {
  collections: Collections;
  gross: number;
  costs: Costs;
  costTotal: number;
  /** Gross collections less the state costs modelled: the state's net fiscal contribution from these beverages. */
  net: number;
  cells: ChannelCell[];
  /** DABS gross revenue from liquor sales on these beverages, and the two deposits on it, under each reading. */
  deposits: { countsGrocerSales: { base: number; school: number; enforcement: number }; excludesGrocerSales: { base: number; school: number; enforcement: number } };
}

export type FlowLineId =
  | "migration"
  | "migrant_response"
  | "declined_to_beer"
  | "declined_outside_utah"
  | "declined_not_bought"
  | "beer_to_wine"
  | "spirits_to_wine"
  | "recapture"
  | "additional"
  | "admin"
  | "license_receipts"
  | "restructuring";

export interface FlowLine {
  id: FlowLineId;
  label: string;
  /** Change in the state's net fiscal contribution, $ a year. */
  value: number;
  /** Of which: state collections gained on wine, and collections lost on the beverage it replaces. */
  wineGained: number;
  displacedLost: number;
}

export interface Origin {
  id: "A" | "B" | "C" | "D" | "E";
  label: string;
  /** Wine bought at grocers from this origin: dollars at today's state-store price, litres, pure-alcohol litres. */
  grocery: { storeEquivalent: number; litres: number; pureAlcoholLitres: number; spending: number };
  /** Wine from this origin bought at DABS instead (new DABS purchases). */
  dabs: { storeEquivalent: number; litres: number; pureAlcoholLitres: number };
}

export interface FlowResult {
  method: string;
  arrangement: ArrangementTerms;
  inputs: FlowInputs;
  /** Migration actually used at the arrangement's price, and the grocery price premium. */
  migrationUsed: number;
  premium: number;
  baseline: Totals;
  proposed: Totals;
  /** proposed - baseline. */
  change: { gross: number; costs: number; net: number; collections: Collections; costsBy: Costs; deposits: { countsGrocerSales: number; excludesGrocerSales: number } };
  lines: FlowLine[];
  origins: Origin[];
  displaced: { beerLitres: number; heavyBeerLitres: number; spiritsLitres: number; beerPureAlcohol: number; spiritsPureAlcohol: number; declinedToBeerLitres: number };
  /** Litres of pure alcohol bought by Utah households in Utah and outside it: change against the baseline. */
  alcohol: { inUtah: number; outsideUtah: number; total: number };
  spending: { inUtah: number; outsideUtah: number };
  /** The decomposition adds back to the change in the totals, and origins add up to the grocery total. */
  reconciles: boolean;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** The flows of one arrangement under the inputs given. Throws on inputs checkFlows rejects. */
export function computeFlows(a: ArrangementTerms, x: FlowInputs, b: FlowBase = FLOW_BASE): FlowResult {
  const bad = checkFlows(x, b);
  if (bad.length) throw new Error(`Invalid flow inputs: ${bad.join("; ")}`);
  const active = a.supply !== "none";
  const w = b.wine;
  const t = b.salesTax;
  const H = w.value * w.household; // household DABS wine, $ at state-store prices
  const premium = a.consumerRatio - 1;
  const m0 = active ? x.migration : 0;
  const m = !active ? 0 : x.convenienceLimit === null || premium <= 0 ? m0 : m0 * clamp01(1 - premium / x.convenienceLimit);
  const moved = m * H;
  const declined = (m0 - m) * H;
  const f = !active || x.migrantResponse === null ? 1 : Math.pow(a.shelf, x.migrantResponse);
  const reduced = moved * (1 - f);

  // Substitution: the original beverage replaced, then the wine bought for it on the stated basis.
  const zero = { participation: 0, intensity: 0, weight: 1 };
  const bs = active ? x.beer : { ...x.beer, ...zero };
  const ss = active ? x.spirits : { ...x.spirits, ...zero };
  const beerPaReplaced = bs.participation * bs.intensity * bs.weight * b.beer.litres * b.beer.household * b.beer.abv;
  const heavyPa = beerPaReplaced * x.beer.heavyShare;
  const groceryBeerPa = beerPaReplaced - heavyPa;
  const beerL = groceryBeerPa / b.beer.abv;
  const heavyL = heavyPa / b.heavyBeer.abv;
  const spiritsPa = ss.participation * ss.intensity * ss.weight * b.spirits.litres * b.spirits.household * b.spirits.abv;
  const spiritsL = spiritsPa / b.spirits.abv;
  const avgShelf = (g: number) => g * a.shelf + (1 - g);
  const wineFor = (pa: number, litres: number, spend: number, s: SubstitutionFlow) => (s.basis === "pure_alcohol" ? pa / w.abv : s.basis === "volume" ? litres : spend / (w.price * avgShelf(s.grocery)));
  const wineB = wineFor(beerPaReplaced, beerL + heavyL, beerL * b.beer.price + heavyL * b.heavyBeer.price, bs) * w.price; // $ at state-store prices
  const wineC = wineFor(spiritsPa, spiritsL, spiritsL * b.spirits.price, ss) * w.price;
  const wineD = active ? x.recapture.share * H : 0;
  const wineE = active ? x.additional.share * H : 0;
  const declinedBeer = declined * x.declined.beer;
  const declinedBeerL = ((declinedBeer / w.price) * w.abv) / b.beer.abv; // grocery beer bought instead, constant pure alcohol

  // Proposed quantities ($ at state-store prices for wine).
  const newDabs = (1 - bs.grocery) * wineB + (1 - ss.grocery) * wineC + (1 - x.recapture.grocery) * wineD + (1 - x.additional.grocery) * wineE;
  const newGrocery = bs.grocery * wineB + ss.grocery * wineC + x.recapture.grocery * wineD + x.additional.grocery * wineE;
  const storeWine = w.value - m0 * H + declined * x.declined.dabs + newDabs;
  const groceryWine = moved - reduced + newGrocery;
  const beerAfterL = b.beer.litres - beerL + declinedBeerL;
  const spiritsAfter = b.spirits.value - spiritsL * b.spirits.price;
  const heavyAfter = b.heavyBeer.value - heavyL * b.heavyBeer.price;
  const outsideWine = -wineD + declined * x.declined.outOfState; // change in wine bought outside Utah, $ at state-store prices

  const c = x.costs;
  const totals = (sw: number, gw: number, beerLitres: number, sp: number, hb: number, live: boolean): Totals => {
    const dabsSupply = a.supply === "dabs";
    const collections: Collections = {
      dabsWineMarkup: w.margin * sw + (dabsSupply ? a.stateCollection * gw : 0),
      replacementCharge: a.supply === "private" ? a.stateCollection * gw : 0,
      dabsSpiritsMarkup: b.spirits.margin * sp,
      dabsHeavyBeerMarkup: b.heavyBeer.margin * hb,
      beerExcise: b.beer.excisePerLitre * (beerLitres + hb / b.heavyBeer.price), // beer and heavy beer (59-15-101)
      salesTax: t * (sw + a.salesTaxBase * gw + sp + hb + beerLitres * b.beer.price),
      licenseReceipts: live ? c.licenseReceipts : 0,
    };
    const lostStore = Math.max(0, w.value + b.spirits.value + b.heavyBeer.value - (sw + sp + hb));
    const costs: Costs = {
      dabsVariableStoreCosts: c.variable * (sw + sp + hb),
      handling: dabsSupply ? c.handling * gw : 0,
      admin: live ? c.admin : 0,
      restructuringSavings: live ? -c.restructuring * lostStore : 0,
    };
    const gross = Object.values(collections).reduce((s, v) => s + v, 0);
    const costTotal = Object.values(costs).reduce((s, v) => s + v, 0);
    const dep = (baseValue: number) => ({ base: baseValue, school: b.rates.school * baseValue, enforcement: b.rates.enforcement * baseValue });
    const dabsBase = sw + sp + hb;
    const cells: ChannelCell[] = [
      { beverage: "wine", channel: "dabs_store", litres: sw / w.price, pureAlcoholLitres: (sw / w.price) * w.abv, spending: sw, storeEquivalent: sw },
      { beverage: "wine", channel: "grocery", litres: gw / w.price, pureAlcoholLitres: (gw / w.price) * w.abv, spending: gw * a.shelf, storeEquivalent: gw },
      { beverage: "beer", channel: "grocery", litres: beerLitres, pureAlcoholLitres: beerLitres * b.beer.abv, spending: beerLitres * b.beer.price, storeEquivalent: null },
      { beverage: "heavy_beer", channel: "dabs_store", litres: hb / b.heavyBeer.price, pureAlcoholLitres: (hb / b.heavyBeer.price) * b.heavyBeer.abv, spending: hb, storeEquivalent: null },
      { beverage: "spirits", channel: "dabs_store", litres: sp / b.spirits.price, pureAlcoholLitres: (sp / b.spirits.price) * b.spirits.abv, spending: sp, storeEquivalent: null },
    ];
    return {
      collections,
      gross,
      costs,
      costTotal,
      net: gross - costTotal,
      cells,
      deposits: { countsGrocerSales: dep(dabsBase + (dabsSupply ? a.dabsRevenuePerDollar * gw : 0)), excludesGrocerSales: dep(dabsBase) },
    };
  };
  const before = totals(w.value, 0, b.beer.litres, b.spirits.value, b.heavyBeer.value, false);
  const after = totals(storeWine, groceryWine, beerAfterL, spiritsAfter, heavyAfter, active);

  // Decomposition by origin: collections net of the variable costs that move with each purchase.
  const unitStore = w.margin + t - c.variable; // per $ of DABS store wine
  const unitGrocery = a.stateCollection + t * a.salesTaxBase - (a.supply === "dabs" ? c.handling : 0); // per $ of grocery wine
  const unitWine = (g: number) => g * unitGrocery + (1 - g) * unitStore;
  const beerUnit = b.beer.excisePerLitre + t * b.beer.price; // per litre of grocery beer
  const heavyUnit = (b.heavyBeer.margin + t - c.variable) * b.heavyBeer.price + b.beer.excisePerLitre; // per litre, excise included
  const spiritsUnit = (b.spirits.margin + t - c.variable) * b.spirits.price;
  const line = (id: FlowLineId, label: string, gained: number, lost: number): FlowLine => ({ id, label, value: gained - lost, wineGained: gained, displacedLost: lost });
  const lostStore = Math.max(0, w.value + b.spirits.value + b.heavyBeer.value - (storeWine + spiritsAfter + heavyAfter));
  const lines: FlowLine[] = [
    line("migration", "A. Household wine bought at grocers instead of DABS", moved * unitGrocery, moved * unitStore),
    line("migrant_response", "Exploratory: movers buy less at the grocery price", 0, reduced * unitGrocery),
    line("declined_to_beer", "Declined grocery purchases switched to grocery beer", declinedBeerL * beerUnit, declinedBeer * unitStore),
    line("declined_outside_utah", "Declined grocery purchases bought outside Utah", 0, declined * x.declined.outOfState * unitStore),
    line("declined_not_bought", "Declined grocery purchases not bought at all", 0, declined * x.declined.none * unitStore),
    line("beer_to_wine", "B. Beer replaced by wine", wineB * unitWine(bs.grocery), beerL * beerUnit + heavyL * heavyUnit),
    line("spirits_to_wine", "C. Spirits replaced by wine", wineC * unitWine(ss.grocery), spiritsL * spiritsUnit),
    line("recapture", "D. Wine once bought outside Utah", wineD * unitWine(x.recapture.grocery), 0),
    line("additional", "E. Additional wine (replaces nothing)", wineE * unitWine(x.additional.grocery), 0),
    line("admin", "New licensing and enforcement costs", 0, active ? c.admin : 0),
    line("license_receipts", "Grocery wine license receipts", active ? c.licenseReceipts : 0, 0),
    line("restructuring", "Longer-run DABS restructuring savings (explicit scenario)", active ? c.restructuring * lostStore : 0, 0),
  ];
  const net = after.net - before.net;
  const sumLines = lines.reduce((s, l) => s + l.value, 0);

  const wl = (v: number) => v / w.price;
  const origin = (id: Origin["id"], label: string, g: number, dabs: number): Origin => ({
    id,
    label,
    grocery: { storeEquivalent: g, litres: wl(g), pureAlcoholLitres: wl(g) * w.abv, spending: g * a.shelf },
    dabs: { storeEquivalent: dabs, litres: wl(dabs), pureAlcoholLitres: wl(dabs) * w.abv },
  });
  const origins: Origin[] = [
    origin("A", "Wine households used to buy at DABS", moved - reduced, 0),
    origin("B", "Replaces beer", bs.grocery * wineB, (1 - bs.grocery) * wineB),
    origin("C", "Replaces spirits", ss.grocery * wineC, (1 - ss.grocery) * wineC),
    origin("D", "Once bought outside Utah", x.recapture.grocery * wineD, (1 - x.recapture.grocery) * wineD),
    origin("E", "Additional (replaces nothing)", x.additional.grocery * wineE, (1 - x.additional.grocery) * wineE),
  ];
  const originSum = origins.reduce((s, o) => s + o.grocery.storeEquivalent, 0);

  const paIn = (tt: Totals) => tt.cells.reduce((s, cl) => s + cl.pureAlcoholLitres, 0);
  const outsidePa = wl(outsideWine) * w.abv;
  const sub = (k: keyof Collections) => after.collections[k] - before.collections[k];
  const subC = (k: keyof Costs) => after.costs[k] - before.costs[k];
  const collectionsChange = Object.fromEntries((Object.keys(before.collections) as (keyof Collections)[]).map((k) => [k, sub(k)])) as unknown as Collections;
  const costsChange = Object.fromEntries((Object.keys(before.costs) as (keyof Costs)[]).map((k) => [k, subC(k)])) as unknown as Costs;
  return {
    method: WINE_FLOWS_METHOD,
    arrangement: a,
    inputs: x,
    migrationUsed: m,
    premium,
    baseline: before,
    proposed: after,
    change: {
      gross: after.gross - before.gross,
      costs: after.costTotal - before.costTotal,
      net,
      collections: collectionsChange,
      costsBy: costsChange,
      deposits: {
        countsGrocerSales: after.deposits.countsGrocerSales.school + after.deposits.countsGrocerSales.enforcement - (before.deposits.countsGrocerSales.school + before.deposits.countsGrocerSales.enforcement),
        excludesGrocerSales: after.deposits.excludesGrocerSales.school + after.deposits.excludesGrocerSales.enforcement - (before.deposits.excludesGrocerSales.school + before.deposits.excludesGrocerSales.enforcement),
      },
    },
    lines,
    origins,
    displaced: { beerLitres: beerL, heavyBeerLitres: heavyL, spiritsLitres: spiritsL, beerPureAlcohol: beerPaReplaced, spiritsPureAlcohol: spiritsPa, declinedToBeerLitres: declinedBeerL },
    alcohol: { inUtah: paIn(after) - paIn(before), outsideUtah: outsidePa, total: paIn(after) - paIn(before) + outsidePa },
    spending: { inUtah: after.cells.reduce((s, cl) => s + cl.spending, 0) - before.cells.reduce((s, cl) => s + cl.spending, 0), outsideUtah: outsideWine },
    reconciles: Math.abs(sumLines - net) < 0.01 && Math.abs(originSum - groceryWine) < 0.01,
  };
}

// ----- break-even ---------------------------------------------------------------------------------------------------

export type BreakEvenLever = "additional" | "beer" | "spirits" | "migration" | "recapture";

export interface BreakEven {
  lever: BreakEvenLever;
  status: "already_above" | "found" | "unattainable_in_range" | "wrong_direction" | "no_effect";
  /** The lever's value at which the net change is zero (null unless found; 0 when already above). */
  value: number | null;
  /** The net change at the bottom and top of the tested range. */
  atLow: number;
  atHigh: number;
  high: number;
  /** The net change at the value found (approximately zero). */
  check: number | null;
}

/** The inputs with one break-even lever set. Beer and spirits set the combined share replaced (participation 1 x
 * intensity v x weight 1, every other substitution setting kept). */
export function setLever(x: FlowInputs, lever: BreakEvenLever, v: number): FlowInputs {
  switch (lever) {
    case "additional":
      return withFlows(x, { additional: { share: v } });
    case "recapture":
      return withFlows(x, { recapture: { share: v } });
    case "migration":
      return withFlows(x, { migration: v });
    case "beer":
      return withFlows(x, { beer: { participation: 1, intensity: v, weight: 1 } });
    case "spirits":
      return withFlows(x, { spirits: { participation: 1, intensity: v, weight: 1 } });
  }
}

/** The lever value in [0, high] at which the net change is zero, others as given (bisection on computeFlows). */
export function breakEven(a: ArrangementTerms, x: FlowInputs, lever: BreakEvenLever, high = 1): BreakEven {
  const f = (v: number) => computeFlows(a, setLever(x, lever, v)).change.net;
  const lo = f(0);
  const hi = f(high);
  if (lo >= -0.005) return { lever, status: "already_above", value: 0, atLow: lo, atHigh: hi, high, check: lo };
  if (Math.abs(hi - lo) < 0.005) return { lever, status: "no_effect", value: null, atLow: lo, atHigh: hi, high, check: null };
  if (hi <= lo) return { lever, status: "wrong_direction", value: null, atLow: lo, atHigh: hi, high, check: null };
  if (hi < 0) return { lever, status: "unattainable_in_range", value: null, atLow: lo, atHigh: hi, high, check: null };
  let l = 0;
  let h = high;
  for (let i = 0; i < 80; i++) {
    const mid = (l + h) / 2;
    if (f(mid) >= 0) h = mid;
    else l = mid;
  }
  return { lever, status: "found", value: h, atLow: lo, atHigh: hi, high, check: f(h) };
}

// ----- assumptions --------------------------------------------------------------------------------------------------

export type Evidence = "measured" | "statute" | "derived" | "proxy" | "estimate" | "placeholder" | "illustrative" | "policy";

export interface FlowAssumption {
  id: string;
  label: string;
  value: string;
  evidence: Evidence;
  source: string;
  /** Low and high used in the sensitivity table (a tested range, not a confidence interval). */
  range: string;
  note: string;
}

const fmt$ = (v: number) => `$${(v / 1e6).toFixed(1)}M`;
const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;

export const FLOW_ASSUMPTIONS: FlowAssumption[] = [
  { id: "F01", label: "DABS wine sales, FY2025, at state-store prices before sales tax", value: fmt$(FLOW_BASE.wine.value), evidence: "derived", source: "DABS FY2025 annual report (liquor sales) x wine's 33.5% share of the FY2026 monthly reports' gross sales", range: "-", note: "Includes licensee purchases; only the household share can move." },
  { id: "F02", label: "Wine price per litre at a state store", value: `$${FLOW_BASE.wine.price.toFixed(2)}`, evidence: "derived", source: "DABS FY2026 monthly reports: wine gross sales / (9-litre cases x 9)", range: "$14.80 (NIAAA gallons)", note: "Converts dollars to litres. The alternatives' U16 uses NIAAA gallons ($14.80); the monthly reports' own cases are used here so dollars and litres share one source." },
  { id: "F03", label: "Households' share of DABS wine and spirits purchases", value: pct(FLOW_BASE.wine.household, 0), evidence: "proxy", source: "DABS FY2025 annual report p. 18: off-premise 82% of all its sales (a chart; all products)", range: "67%-97%", note: "Not measured for wine or spirits." },
  { id: "F04", label: "DABS markup as a margin on its price (wine and spirits)", value: pct(FLOW_BASE.wine.margin, 2), evidence: "proxy", source: "DABS FY2025 gross profit / sales, all products", range: "46.95% (the 88.5% statutory floor)", note: "Gross margin, before DABS's operating costs: not profit. Markup on landed cost = margin / (1 - margin)." },
  { id: "F05", label: "DABS spirits sales, FY2025, and price per litre", value: `${fmt$(FLOW_BASE.spirits.value)}; $${FLOW_BASE.spirits.price.toFixed(2)}/L`, evidence: "derived", source: "FY2025 sales x spirits' share of the FY2026 monthly reports; price from the monthly reports' cases", range: "-", note: "Spirits are sold only by DABS." },
  { id: "F06", label: "Heavy beer at DABS (above 5% ABV): sales, price per litre, margin", value: `${fmt$(FLOW_BASE.heavyBeer.value)}; $${FLOW_BASE.heavyBeer.price.toFixed(2)}/L; ${pct(FLOW_BASE.heavyBeer.margin)}`, evidence: "statute", source: "FY2026 monthly reports; margin at the 66.5% statutory minimum markup", range: "-", note: "Used only when some of the beer replaced is heavy beer (sensitivity)." },
  { id: "F07", label: "Beer sold outside DABS (grocery, convenience, licensees)", value: `${(FLOW_BASE.beer.litres / 1e6).toFixed(1)}M litres`, evidence: "derived", source: "NIAAA 2024 Utah beer gallons less DABS heavy beer (FY2026 cases)", range: "-", note: "Calendar 2024 volume against fiscal-year DABS cases." },
  { id: "F08", label: "Households' share of that beer", value: pct(FLOW_BASE.beer.household, 0), evidence: "proxy", source: "DABS's all-product off-premise share, reused for beer", range: "70%-90%", note: "No Utah split of beer by premise." },
  { id: "F09", label: "Grocery beer shelf price", value: `$${FLOW_PLACEHOLDERS.beerPricePerGallon}/gallon ($${FLOW_BASE.beer.price.toFixed(2)}/L)`, evidence: "placeholder", source: "none in the dataset", range: "$8-$20 a gallon", note: "Enters through sales tax on beer, and through the equal-spending basis." },
  { id: "F10", label: "Utah beer excise (beer and heavy beer)", value: `$${FLOW_PLACEHOLDERS.beerExcisePerBarrel}/barrel`, evidence: "statute", source: "Utah Code 59-15-101(2)(b)(ii), version effective 2024-05-01: $13.35 a 31-gallon barrel from 2024-07-01 to 2025-06-30 (dataset policy event ut_beer_tax_1335)", range: "$13.10-$13.85 (the statute's FY2020-FY2027 rates)", note: "Since the 2024-05-01 version the tax also applies to heavy beer; it rises $0.25 each July 1 to $13.85." },
  { id: "F11", label: "Alcohol by volume: beer, wine, spirits", value: `${pct(FLOW_BASE.beer.abv)}, ${pct(FLOW_BASE.wine.abv)}, ${pct(FLOW_BASE.spirits.abv)}`, evidence: "measured", source: "NIAAA 2024 time-varying ABV, Utah", range: "-", note: `One 750 ml bottle of wine holds ${(0.75 * FLOW_BASE.wine.abv * 1000).toFixed(1)} ml of pure alcohol, as much as ${((0.75 * FLOW_BASE.wine.abv) / (CONTAINER_L.beer * FLOW_BASE.beer.abv)).toFixed(1)} 12-ounce cans of beer or ${((0.75 * FLOW_BASE.wine.abv) / (0.75 * FLOW_BASE.spirits.abv)).toFixed(2)} bottles of spirits.` },
  { id: "F12", label: "Heavy beer ABV", value: pct(FLOW_PLACEHOLDERS.heavyBeerAbv), evidence: "placeholder", source: "none", range: "6%-9%", note: "Only with a heavy-beer share above zero." },
  { id: "F13", label: "State sales tax", value: pct(FLOW_BASE.salesTax, 2), evidence: "measured", source: "Publication 25, state portion", range: "-", note: "Local sales tax is not modelled." },
  { id: "F14", label: "DABS store costs that move with sales", value: `${(COST_LINES.shortRun * 100).toFixed(2)}¢ per $`, evidence: "estimate", source: "DABS FY2025 card fees, package-agency contracts and bags / all-product sales", range: "0¢-5¢", note: "Variable lines only: a 30% fall in wine sales does not cut 30% of operating costs. Wages and delivery are a separate restructuring scenario." },
  { id: "F15", label: "Longer-run restructuring", value: "0 in the main cases", evidence: "illustrative", source: "DABS FY2025 wages 7.51¢ and delivery 1.05¢ per $", range: "0¢-8.56¢", note: "Only if staffing and delivery are cut in proportion." },
  { id: "F16", label: "New licensing and enforcement; license receipts", value: "$500,000 a year; $0", evidence: "placeholder", source: "no estimate exists", range: "$250,000-$1,000,000; $0-$500,000", note: "A license fee could offset part of the cost." },
  { id: "F17", label: "Handling cost of DABS supplying grocers", value: "0", evidence: "placeholder", source: "none", range: "0-1.05¢ per $", note: "DABS keeps buying, storing and delivering the wine." },
  { id: "F18", label: "Grocer and private wholesaler gross margins", value: "28.0%; 29.5%", evidence: "proxy", source: "Census ARTS 2022 grocery stores (NAICS 4451); AWTS 2022 beer, wine and spirits wholesalers (4248)", range: "grocer 10%-35%", note: "National, all products: references, not minimums." },
  { id: "F19", label: "Migration at equal prices", value: "30% of household DABS wine", evidence: "illustrative", source: "none", range: "0%-50%", note: "The comparable accounting case holds it whatever the price; channel-choice scenarios let it fall with the price." },
  { id: "F20", label: "Convenience limit (premium at which nobody moves)", value: "none (fixed) or 15%, 30%, 60%", evidence: "illustrative", source: "none", range: "-", note: "A straight-line scenario, not an estimated channel-choice model." },
  { id: "F21", label: "Beer and spirits replaced by wine", value: "0 in the accounting case; grids 0%-20% of household purchases", evidence: "illustrative", source: "none for Utah; see S01 for existing overlap", range: "0%-20%", note: "Participation x intensity x purchase weight. Constant pure alcohol by default." },
  { id: "F22", label: "Recapture and additional purchases", value: "0 in the accounting case; grids 0%-10% of household wine", evidence: "illustrative", source: "none for Utah", range: "0%-10%", note: "Each with a channel split; additional purchases may be bought at DABS." },
  { id: "F23", label: "Migrants' price response (exploratory)", value: `off; ${ELASTICITY} when on`, evidence: "illustrative", source: "Nelson (2013), a market-wide elasticity", range: "-", note: "Applying a market-wide elasticity to one channel's price is the old treatment, kept only as an exploratory case." },
  { id: "S01", label: "Existing overlap: beer-preferring adults 21-39 who drink wine weekly or more", value: "23%", evidence: "measured", source: "Wine Opinions, 'Wine Behaviors of Age 21-39 Beverage Alcohol Consumers' (July 2022 survey, n = 631 U.S. consumers aged 21-39 from an independent survey-respondent provider, screened to drink alcohol 2-3 times a month or more), p. 3; source lead lead_wine_opinions_under40_2022", range: "-", note: "Overlap that already exists among surveyed U.S. drinkers under 40. Not a Utah figure, not a switching rate, not an effect of grocery availability, not a share of beer sales. Not used as a parameter; current overlap is not new demand." },
];
