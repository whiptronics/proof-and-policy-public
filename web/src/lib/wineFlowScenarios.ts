// Named scenarios, grids, break-even tables and a sensitivity table on the purchase-flow model (lib/wineFlows.ts),
// shared by the export (src/export/groceryWineFlows.ts) and the tests.
//
// Every share of switching, recapture or additional buying here is illustrative: chosen to span a range, never
// estimated, and labelled so. Ranges are tested ranges, not confidence intervals. "Exploratory" marks the treatments the
// brief of 2026-10-18 asked to keep only as exploration (a market-wide elasticity applied to one channel's price, and
// purchases that leave the market because one channel's price rose).
import { COST_LINES, ELASTICITY } from "./wineAlternatives";
import {
  DEFAULT_FLOWS,
  FLOW_ARRANGEMENTS,
  FLOW_BASE,
  arrangementTerms,
  breakEven,
  computeFlows,
  flowBaseWith,
  withFlows,
  type ArrangementTerms,
  type BaseChanges,
  type BreakEven,
  type BreakEvenLever,
  type FlowArrangementId,
  type FlowInputs,
  type FlowResult,
} from "./wineFlows";
import type { Overrides } from "./wineAlternatives";

export type Standing = "accounting" | "channel_choice" | "illustrative" | "exploratory" | "cost_case";

export const STANDING_WORDS: Record<Standing, string> = {
  accounting: "Accounting case: a stated share moves whatever the price; nothing else changes. Comparable with the alternatives.",
  channel_choice: "Channel-choice scenario: a straight-line convenience assumption, not an estimated model.",
  illustrative: "Illustrative: the shares are chosen to show the mechanism, not estimated. No Utah evidence gives them.",
  exploratory: "Exploratory: a treatment kept only to show its effect (see the note); not a central case.",
  cost_case: "Cost case: the accounting case with one cost assumption changed.",
};

export interface NamedScenario {
  id: string;
  label: string;
  standing: Standing;
  inputs: FlowInputs;
  note: string;
}

/** Wages and delivery per $ of DABS sales: the longer-run restructuring case (F15). */
export const RESTRUCTURING_PER_DOLLAR = COST_LINES.wages + COST_LINES.delivery;
/** The handling cost tested for DABS supplying grocers (F17): DABS's own delivery cost per $. */
export const HANDLING_HIGH = COST_LINES.delivery;

const D0 = DEFAULT_FLOWS;
const channel = (limit: number) => withFlows(D0, { convenienceLimit: limit });
const C30 = channel(0.3);
/** participation x intensity = the share of households' purchases of that beverage (in pure alcohol) replaced. */
const subst = (x: FlowInputs, k: "beer" | "spirits", participation: number, intensity: number, extra: Partial<FlowInputs["spirits"]> = {}) =>
  withFlows(x, { [k]: { participation, intensity, weight: 1, ...extra } } as Partial<FlowInputs>);

export const NAMED_SCENARIOS: NamedScenario[] = [
  { id: "accounting_30", label: "30% of household DABS wine moves to grocers at any price; nothing else changes", standing: "accounting", inputs: D0, note: "The alternatives' fixed-volume case. Total alcohol unchanged." },
  { id: "channel_60", label: "Channel choice: 30% would move at equal prices, none at a 60% grocery premium; the rest stay at DABS", standing: "channel_choice", inputs: channel(0.6), note: "Purchases that do not move are still bought at DABS." },
  { id: "channel_30", label: "Channel choice: as above, none move at a 30% premium", standing: "channel_choice", inputs: C30, note: "Purchases that do not move are still bought at DABS." },
  { id: "channel_15", label: "Channel choice: as above, none move at a 15% premium", standing: "channel_choice", inputs: channel(0.15), note: "Purchases that do not move are still bought at DABS." },
  {
    id: "declined_not_bought",
    label: "Exploratory: channel choice at a 30% limit, but purchases that do not move are not bought at all",
    standing: "exploratory",
    inputs: withFlows(C30, { declined: { dabs: 0, none: 1 } }),
    note: "A shopper who finds grocery wine dear can still buy it at DABS at today's price; assuming they buy nothing is the old treatment's effect.",
  },
  {
    id: "declined_outside_utah",
    label: "Exploratory: channel choice at a 30% limit, but purchases that do not move are bought outside Utah",
    standing: "exploratory",
    inputs: withFlows(C30, { declined: { dabs: 0, outOfState: 1 } }),
    note: "An upper bound on cross-border loss: nothing measures it.",
  },
  {
    id: "migrant_response",
    label: `Exploratory, the old treatment: 30% move and buy less at the grocery price (elasticity ${ELASTICITY}); what they do not buy leaves the market`,
    standing: "exploratory",
    inputs: withFlows(D0, { migrantResponse: ELASTICITY }),
    note: "Applies a market-wide elasticity to one channel's price as though every wine price had risen; reproduces the alternatives' price_constant case.",
  },
  { id: "beer_2", label: "Illustrative: wine replaces 2% of households' beer, same alcohol (10% of buyers replace 20% of their beer); bought at grocers", standing: "illustrative", inputs: subst(D0, "beer", 0.1, 0.2), note: "Plus the 30% accounting move. Total alcohol unchanged." },
  { id: "beer_5", label: "Illustrative: wine replaces 5% of households' beer, same alcohol (20% of buyers replace 25%); bought at grocers", standing: "illustrative", inputs: subst(D0, "beer", 0.2, 0.25), note: "Plus the 30% accounting move. Total alcohol unchanged." },
  { id: "beer_5_volume", label: "Illustrative: as beer 5%, but a litre of wine for each litre of beer", standing: "illustrative", inputs: subst(D0, "beer", 0.2, 0.25, { basis: "volume" }), note: "Wine is about 2.5 times as strong as beer: total alcohol rises." },
  { id: "beer_5_spending", label: "Illustrative: as beer 5%, but the same dollars on wine as were spent on beer", standing: "illustrative", inputs: subst(D0, "beer", 0.2, 0.25, { basis: "spending" }), note: "Uses the placeholder beer price (F09): total alcohol falls." },
  { id: "beer_5_split", label: "Illustrative: as beer 5%, with half the wine bought at DABS", standing: "illustrative", inputs: subst(D0, "beer", 0.2, 0.25, { grocery: 0.5 }), note: "A shopper switching from beer may buy the wine at a state store." },
  { id: "spirits_2", label: "Illustrative: wine replaces 2% of households' spirits, same alcohol; bought at grocers", standing: "illustrative", inputs: subst(D0, "spirits", 0.1, 0.2), note: "Spirits carry DABS's markup today: the state loses that markup." },
  { id: "spirits_5", label: "Illustrative: wine replaces 5% of households' spirits, same alcohol; bought at grocers", standing: "illustrative", inputs: subst(D0, "spirits", 0.2, 0.25), note: "Spirits carry DABS's markup today: the state loses that markup." },
  { id: "recapture_2", label: "Illustrative: wine households now buy outside Utah, equal to 2% of household DABS wine, is bought at Utah grocers", standing: "illustrative", inputs: withFlows(D0, { recapture: { share: 0.02 } }), note: "More alcohol bought in Utah, the same in total." },
  { id: "additional_2", label: "Illustrative: additional wine equal to 2% of household DABS wine, replacing nothing; bought at grocers", standing: "illustrative", inputs: withFlows(D0, { additional: { share: 0.02 } }), note: "More alcohol in total." },
  { id: "costs_high", label: "Cost case: new administration $1,000,000 a year and a handling cost for DABS supply", standing: "cost_case", inputs: withFlows(D0, { costs: { admin: 1_000_000, handling: HANDLING_HIGH } }), note: "Handling applies only when DABS supplies grocers." },
  { id: "license_fees", label: "Cost case: grocery wine license fees bring $500,000 a year", standing: "cost_case", inputs: withFlows(D0, { costs: { licenseReceipts: 500_000 } }), note: "No fee is proposed or estimated." },
  { id: "restructuring", label: "Cost case: DABS cuts wages and delivery in proportion to its lost store sales (longer run)", standing: "cost_case", inputs: withFlows(D0, { costs: { restructuring: RESTRUCTURING_PER_DOLLAR } }), note: "Only if staffing and delivery actually shrink." },
  {
    id: "combined_illustrative",
    label: "Illustrative combination: channel choice (30% limit) with 2% each of beer and spirits replaced, recapture and additional wine",
    standing: "illustrative",
    inputs: withFlows(subst(subst(C30, "beer", 0.1, 0.2), "spirits", 0.1, 0.2), { recapture: { share: 0.02 }, additional: { share: 0.02 } }),
    note: "One combination among many; not a forecast.",
  },
  {
    id: "combined_adverse",
    label: "Exploratory combination: channel choice (30% limit); of purchases that do not move, half leave Utah or are not bought; movers buy less; administration $1M",
    standing: "exploratory",
    inputs: withFlows(C30, { declined: { dabs: 0.5, outOfState: 0.25, none: 0.25 }, migrantResponse: ELASTICITY, costs: { admin: 1_000_000 } }),
    note: "One unfavourable combination among many; not a forecast.",
  },
];

export const scenarioById = (id: string) => {
  const s = NAMED_SCENARIOS.find((k) => k.id === id);
  if (!s) throw new Error(`unknown flow scenario ${id}`);
  return s;
};

/** Pure-alcohol change below this many litres a year counts as unchanged (rounding). */
export const ALCOHOL_TOLERANCE_L = 1;

export interface ScenarioRun {
  scenario: NamedScenario;
  arrangement: ArrangementTerms;
  result: FlowResult;
  totalAlcoholUnchanged: boolean;
}

export function scenarioRuns(ids: FlowArrangementId[] = FLOW_ARRANGEMENTS): ScenarioRun[] {
  const out: ScenarioRun[] = [];
  for (const id of ids) {
    const a = arrangementTerms(id);
    for (const s of NAMED_SCENARIOS) {
      const r = computeFlows(a, s.inputs);
      out.push({ scenario: s, arrangement: a, result: r, totalAlcoholUnchanged: Math.abs(r.alcohol.total) < ALCOHOL_TOLERANCE_L });
    }
  }
  return out;
}

// ----- prices -------------------------------------------------------------------------------------------------------

/** Bisection on the engine's entered price for a target value of an increasing function of it. */
function solvePrice(id: FlowArrangementId, value: (a: ArrangementTerms) => number, target: number, extra: Overrides = {}): ArrangementTerms | null {
  let lo = 0.3;
  let hi = 4;
  const at = (p: number) => arrangementTerms(id, { ...extra, priceRatio: p });
  if (value(at(lo)) > target || value(at(hi)) < target) return null;
  for (let i = 0; i < 70; i++) {
    const mid = (lo + hi) / 2;
    if (value(at(mid)) < target) lo = mid;
    else hi = mid;
  }
  return at(hi);
}

/** The arrangement's terms when grocers charge a given premium over the state-store price (consumer price, tax included). */
export function termsAtPremium(id: FlowArrangementId, premium: number, extra: Overrides = {}): ArrangementTerms | null {
  return solvePrice(id, (a) => a.consumerRatio, 1 + premium, extra);
}

/** The arrangement's terms when the grocer's gross margin is a given share of its own selling price. */
export function termsAtGrocerMargin(id: FlowArrangementId, margin: number, extra: Overrides = {}): ArrangementTerms | null {
  return solvePrice(id, (a) => a.grocerMarginShare ?? -Infinity, margin, extra);
}

// ----- grids --------------------------------------------------------------------------------------------------------

const steps = (from: number, to: number, step: number) => {
  const n = Math.round((to - from) / step);
  return Array.from({ length: n + 1 }, (_, i) => Number((from + i * step).toFixed(10)));
};

export interface SubstitutionPoint {
  arrangement: FlowArrangementId;
  beverage: "beer" | "spirits";
  basis: "pure_alcohol" | "volume" | "spending";
  share: number;
  net: number;
  wineGained: number;
  displacedLost: number;
  wineLitres: number;
  displacedLitres: number;
  alcoholChange: number;
}

export const SUBSTITUTION_SHARES = steps(0, 0.2, 0.005);

/** Net change against the share of households' beer or spirits replaced by wine (on top of the accounting case). */
export function substitutionGrid(): SubstitutionPoint[] {
  const out: SubstitutionPoint[] = [];
  for (const id of FLOW_ARRANGEMENTS) {
    const a = arrangementTerms(id);
    for (const beverage of ["beer", "spirits"] as const) {
      for (const basis of ["pure_alcohol", "volume", "spending"] as const) {
        for (const share of SUBSTITUTION_SHARES) {
          const r = computeFlows(a, subst(D0, beverage, 1, share, { basis }));
          const l = r.lines.find((k) => k.id === (beverage === "beer" ? "beer_to_wine" : "spirits_to_wine"))!;
          const o = r.origins.find((k) => k.id === (beverage === "beer" ? "B" : "C"))!;
          out.push({
            arrangement: id,
            beverage,
            basis,
            share,
            net: r.change.net,
            wineGained: l.wineGained,
            displacedLost: l.displacedLost,
            wineLitres: o.grocery.litres + o.dabs.litres,
            displacedLitres: beverage === "beer" ? r.displaced.beerLitres + r.displaced.heavyBeerLitres : r.displaced.spiritsLitres,
            alcoholChange: r.alcohol.total,
          });
        }
      }
    }
  }
  return out;
}

export interface PricePoint {
  arrangement: FlowArrangementId;
  premium: number;
  limit: number | null;
  migrationAtParity: number;
  migrationUsed: number;
  net: number;
  grocerMargin: number | null;
  stateCollection: number;
  shelf: number;
}

export const PRICE_PREMIUMS = steps(0, 0.6, 0.025);
export const CONVENIENCE_LIMITS: (number | null)[] = [null, 0.15, 0.3, 0.6, 1];
export const PARITY_MIGRATIONS = [0.1, 0.3, 0.5];
export const PRICE_ARRANGEMENTS: FlowArrangementId[] = ["preserved_dabs", "preserved_private", "dabs_discount_20", "private_tax_20"];

/** Net change against the grocery premium, for each convenience limit and migration at equal prices. Declined
 * purchases stay at DABS. The arrangement's lever (markup, discount, charge) is held; only the grocery price moves. */
export function migrationPriceGrid(): PricePoint[] {
  const out: PricePoint[] = [];
  for (const id of PRICE_ARRANGEMENTS) {
    for (const premium of PRICE_PREMIUMS) {
      const a = termsAtPremium(id, premium);
      if (!a) continue;
      for (const limit of CONVENIENCE_LIMITS) {
        for (const m of PARITY_MIGRATIONS) {
          const r = computeFlows(a, withFlows(D0, { migration: m, convenienceLimit: limit }));
          out.push({ arrangement: id, premium, limit, migrationAtParity: m, migrationUsed: r.migrationUsed, net: r.change.net, grocerMargin: a.grocerMarginShare, stateCollection: a.stateCollection, shelf: a.shelf });
        }
      }
    }
  }
  return out;
}

export interface MigrationPoint {
  arrangement: FlowArrangementId;
  household: number;
  migration: number;
  net: number;
  gross: number;
}

export const HOUSEHOLD_SHARES = [0.67, FLOW_BASE.wine.household, 0.97];

/** The accounting case across the share moving, for three household shares (F03's tested range). */
export function migrationGrid(): MigrationPoint[] {
  const out: MigrationPoint[] = [];
  for (const id of FLOW_ARRANGEMENTS) {
    const a = arrangementTerms(id);
    for (const h of HOUSEHOLD_SHARES) {
      const b = flowBaseWith({ household: h });
      for (const m of steps(0, 1, 0.05)) {
        const r = computeFlows(a, withFlows(D0, { migration: m }), b);
        out.push({ arrangement: id, household: h, migration: m, net: r.change.net, gross: r.change.gross });
      }
    }
  }
  return out;
}

// ----- break-even ---------------------------------------------------------------------------------------------------

export const BREAK_EVEN_LEVERS: BreakEvenLever[] = ["migration", "beer", "spirits", "recapture", "additional"];
export const BREAK_EVEN_CONTEXTS = ["accounting_30", "channel_30"] as const;

/** What reaching break-even through this lever does to the alcohol households buy. */
export const LEVER_ALCOHOL: Record<BreakEvenLever, string> = {
  migration: "unchanged (the same wine bought at a different store)",
  beer: "unchanged (same pure alcohol)",
  spirits: "unchanged (same pure alcohol)",
  recapture: "unchanged in total (bought in Utah instead of another state)",
  additional: "more alcohol bought",
};

export const LEVER_WORDS: Record<BreakEvenLever, string> = {
  migration: "share of household DABS wine moving to grocers",
  beer: "share of households' beer replaced by wine (pure alcohol)",
  spirits: "share of households' spirits replaced by wine (pure alcohol)",
  recapture: "out-of-state wine brought home, as a share of household DABS wine",
  additional: "additional wine, as a share of household DABS wine",
};

export interface BreakEvenRow extends BreakEven {
  arrangement: FlowArrangementId;
  context: string;
  netAtContext: number;
}

export function breakEvenTable(): BreakEvenRow[] {
  const out: BreakEvenRow[] = [];
  for (const id of FLOW_ARRANGEMENTS) {
    const a = arrangementTerms(id);
    for (const ctx of BREAK_EVEN_CONTEXTS) {
      const x = scenarioById(ctx).inputs;
      const net = computeFlows(a, x).change.net;
      for (const lever of BREAK_EVEN_LEVERS) out.push({ ...breakEven(a, x, lever), arrangement: id, context: ctx, netAtContext: net });
    }
  }
  return out;
}

export interface FrontierPoint {
  family: string;
  arrangement: FlowArrangementId;
  /** The x value: migration share, or the state's collection per $1 of today's price. */
  x: number;
  xKind: "migration" | "collection_per_dollar";
  /** The arrangement's lever at x (the DABS discount or the charge rate), when x is a collection. */
  setting: number | null;
  lever: BreakEvenLever;
  status: BreakEven["status"];
  value: number | null;
}

export const FRONTIER_LEVERS: BreakEvenLever[] = ["beer", "spirits", "recapture", "additional"];

/** Break-even shares against the share moving (accounting case, every arrangement). */
export function migrationFrontier(): FrontierPoint[] {
  const out: FrontierPoint[] = [];
  for (const id of FLOW_ARRANGEMENTS) {
    const a = arrangementTerms(id);
    for (const m of steps(0.05, 0.5, 0.05)) {
      const x = withFlows(D0, { migration: m });
      for (const lever of FRONTIER_LEVERS) {
        const b = breakEven(a, x, lever);
        out.push({ family: "migration", arrangement: id, x: m, xKind: "migration", setting: null, lever, status: b.status, value: b.value });
      }
    }
  }
  return out;
}

export const DISCOUNTS = steps(0, 0.35, 0.025);
export const CHARGE_RATES = steps(0, 0.9, 0.05);

/** Break-even shares against the state's collection per bottle, from preserved to reduced, at today's consumer price:
 * DABS supply at a discount, and private supply with an on-price charge. 30% moves (accounting case). */
export function collectionFrontier(): FrontierPoint[] {
  const out: FrontierPoint[] = [];
  const fam = [
    { family: "dabs_discount", id: "dabs_discount_20" as const, values: DISCOUNTS, o: (v: number): Overrides => ({ discount: v }) },
    { family: "private_charge", id: "private_tax_20" as const, values: CHARGE_RATES, o: (v: number): Overrides => ({ chargeRate: v }) },
  ];
  for (const f of fam) {
    for (const v of f.values) {
      const a = arrangementTerms(f.id, f.o(v));
      for (const lever of FRONTIER_LEVERS) {
        const b = breakEven(a, D0, lever);
        out.push({ family: f.family, arrangement: f.id, x: a.stateCollection, xKind: "collection_per_dollar", setting: v, lever, status: b.status, value: b.value });
      }
    }
  }
  return out;
}

// ----- sensitivity --------------------------------------------------------------------------------------------------

export interface SensitivityParam {
  id: string;
  label: string;
  assumption: string;
  low: string;
  high: string;
  /** Runs the context with the parameter at its low or high value; null when it does not apply. */
  run: (a: FlowArrangementId, x: FlowInputs, side: "low" | "high") => FlowResult | null;
}

const withBase = (c: BaseChanges) => (id: FlowArrangementId, x: FlowInputs) => computeFlows(arrangementTerms(id), x, flowBaseWith(c));
const withInputs = (ch: (x: FlowInputs) => FlowInputs) => (id: FlowArrangementId, x: FlowInputs) => computeFlows(arrangementTerms(id), ch(x));

export const SENSITIVITY: SensitivityParam[] = [
  { id: "household", label: "Households' share of DABS purchases", assumption: "F03", low: "67%", high: "97%", run: (id, x, s) => withBase({ household: s === "low" ? 0.67 : 0.97 })(id, x) },
  { id: "migration", label: "Share of household wine moving", assumption: "F19", low: "10%", high: "50%", run: (id, x, s) => withInputs((k) => withFlows(k, { migration: s === "low" ? 0.1 : 0.5 }))(id, x) },
  {
    id: "grocer_margin",
    label: "Grocer's gross margin (sets the grocery price)",
    assumption: "F18",
    low: "10%",
    high: "35%",
    run: (id, x, s) => {
      if (!id.startsWith("preserved") || id === "preserved_dabs_matched") return null;
      const a = termsAtGrocerMargin(id, s === "low" ? 0.1 : 0.35);
      return a ? computeFlows(a, x) : null;
    },
  },
  { id: "variable_costs", label: "DABS store costs that move with sales", assumption: "F14", low: "0¢ per $", high: "5¢ per $", run: (id, x, s) => withInputs((k) => withFlows(k, { costs: { variable: s === "low" ? 0 : 0.05 } }))(id, x) },
  { id: "admin", label: "New licensing and enforcement", assumption: "F16", low: "$250,000", high: "$1,000,000", run: (id, x, s) => withInputs((k) => withFlows(k, { costs: { admin: s === "low" ? 250_000 : 1_000_000 } }))(id, x) },
  { id: "license", label: "Grocery wine license receipts", assumption: "F16", low: "$0", high: "$500,000", run: (id, x, s) => withInputs((k) => withFlows(k, { costs: { licenseReceipts: s === "low" ? 0 : 500_000 } }))(id, x) },
  {
    id: "handling",
    label: "DABS handling cost for grocery supply",
    assumption: "F17",
    low: "0¢ per $",
    high: `${(HANDLING_HIGH * 100).toFixed(2)}¢ per $`,
    run: (id, x, s) => (arrangementTerms(id).supply === "dabs" ? withInputs((k) => withFlows(k, { costs: { handling: s === "low" ? 0 : HANDLING_HIGH } }))(id, x) : null),
  },
  { id: "restructuring", label: "Longer-run DABS restructuring", assumption: "F15", low: "0¢ per $", high: `${(RESTRUCTURING_PER_DOLLAR * 100).toFixed(2)}¢ per $`, run: (id, x, s) => withInputs((k) => withFlows(k, { costs: { restructuring: s === "low" ? 0 : RESTRUCTURING_PER_DOLLAR } }))(id, x) },
  { id: "beer_price", label: "Grocery beer price", assumption: "F09", low: "$8 a gallon", high: "$20 a gallon", run: (id, x, s) => withBase({ beerPricePerGallon: s === "low" ? 8 : 20 })(id, x) },
  { id: "beer_excise", label: "Utah beer excise", assumption: "F10", low: "$13.10 a barrel (FY2020-FY2024)", high: "$13.85 a barrel (FY2027)", run: (id, x, s) => withBase({ beerExcisePerBarrel: s === "low" ? 13.1 : 13.85 })(id, x) },
  { id: "beer_household", label: "Households' share of beer", assumption: "F08", low: "70%", high: "90%", run: (id, x, s) => withBase({ beerHousehold: s === "low" ? 0.7 : 0.9 })(id, x) },
  {
    id: "wine_price",
    label: "Wine price per litre at a state store",
    assumption: "F02",
    low: "$14.80 (NIAAA gallons)",
    high: `$${FLOW_BASE.wine.price.toFixed(2)} (base)`,
    run: (id, x, s) => withBase({ winePricePerLitre: s === "low" ? 14.8 : FLOW_BASE.wine.price })(id, x),
  },
];

export const SENSITIVITY_CONTEXTS = ["accounting_30", "beer_5"] as const;
export const SENSITIVITY_ARRANGEMENTS: FlowArrangementId[] = ["preserved_dabs", "preserved_private", "dabs_discount_20", "private_tax_20"];

export interface SensitivityRow {
  arrangement: FlowArrangementId;
  context: string;
  param: SensitivityParam;
  base: number;
  low: number | null;
  high: number | null;
}

export function sensitivityTable(): SensitivityRow[] {
  const out: SensitivityRow[] = [];
  for (const id of SENSITIVITY_ARRANGEMENTS) {
    for (const ctx of SENSITIVITY_CONTEXTS) {
      const x = scenarioById(ctx).inputs;
      const base = computeFlows(arrangementTerms(id), x).change.net;
      for (const p of SENSITIVITY) {
        const lo = p.run(id, x, "low");
        const hi = p.run(id, x, "high");
        out.push({ arrangement: id, context: ctx, param: p, base, low: lo ? lo.change.net : null, high: hi ? hi.change.net : null });
      }
    }
  }
  return out;
}

