// Same shelf price (method SAME_PRICE_METHOD). Grocers sell wine at today's state-store price, and DABS sells it to them
// at a discount off that price, which becomes the grocer's margin. This is Pennsylvania's structure (state stores sell to
// licensees at retail less 10%, Liquor Code section 305(b)) and the engine's "DABS at a discount, grocers charge today's
// price" alternative with the discount varied. Shoppers pay what they pay today, so no price-sensitive case applies: the
// share that moves is the same at every convenience limit.
//
// At the same price the state's change on the wine that moves is the grocer's margin, less what DABS stops spending,
// less any license fees, plus what the state collects on wine bought in Utah that was not bought at DABS before. Nothing
// here is a second engine: every figure is the purchase-flow model's (lib/wineFlows.ts computeFlows on
// arrangementTerms("dabs_discount_20", { discount })), whose accounting case equals the alternatives engine's
// (samePrice.test.ts checks both). Savings cases are the design model's (none, allocated, longer run); no headline counts
// a saving as measured.
import { SAVINGS_CASES, UTAH_GROCERY_ESTABLISHMENTS, type SavingsCase } from "./policyDesigns";
import { DEFAULT_FLOWS, arrangementTerms, breakEven, computeFlows, withFlows, type BreakEven, type FlowInputs } from "./wineFlows";
import { RETAILER_TARGET } from "./wineAlternatives";
import { STATUTORY_MARKUP } from "./wineMargin";

export const SAME_PRICE_METHOD = "same-price@1.0";

/** Pennsylvania's licensee price: state stores sell to licensees at retail less 10%, which is the licensee's margin. */
export const PA_LICENSEE_MARGIN = {
  value: 0.1,
  source: "Pennsylvania Liquor Code section 305(b), as printed in HB 1690 (PN 2653), palegis.us, read 2026-11-19",
} as const;

/** The grocer margins the grid reports, share of the shelf price (0.28 is the national all-product grocery reference). */
export const SAME_PRICE_MARGINS = [0, 0.05, PA_LICENSEE_MARGIN.value, 0.15, 0.2, RETAILER_TARGET] as const;

const savingsPerDollar = (s: SavingsCase) => {
  const v = SAVINGS_CASES.find((c) => c.id === s)!.perDollar;
  return v.shortRun + v.conditional;
};

/** The flow inputs for one case: the accounting case (30% of household DABS wine moves, nothing else changes), with the
 * savings case's avoided cost, optional license fees equal to the new administration, and optional extra purchases. */
export function samePriceInputs(s: SavingsCase, fees: boolean, extra: { additional?: number; recapture?: number } = {}): FlowInputs {
  const admin = DEFAULT_FLOWS.costs.admin;
  return withFlows(DEFAULT_FLOWS, {
    costs: { variable: savingsPerDollar(s), licenseReceipts: fees ? admin : 0 },
    additional: { share: extra.additional ?? 0 },
    recapture: { share: extra.recapture ?? 0 },
  });
}

const terms = (margin: number) => arrangementTerms("dabs_discount_20", { discount: margin });

export interface SamePriceCase {
  margin: number;
  savings: SavingsCase;
  fees: boolean;
  /** Net change for the state, $ a year (all state funds, against today). */
  net: number;
  /** What grocers keep on the wine that moves, $ a year. */
  grocerIncome: number;
}

export function samePriceCase(margin: number, savings: SavingsCase, fees: boolean): SamePriceCase {
  const r = computeFlows(terms(margin), samePriceInputs(savings, fees));
  if (Math.abs(r.arrangement.consumerRatio - 1) > 1e-9) throw new Error("same price: the grocery price differs from today's");
  return { margin, savings, fees, net: r.change.net, grocerIncome: r.arrangement.grocerKeeps * r.origins[0].grocery.storeEquivalent };
}

/** Where the grocer's margin comes from at one case: what DABS stops spending, license fees net of the new
 * administration, and what is left for the state's share to cover. The three add up to the grocer's income. */
export interface MarginCover {
  grocerIncome: number;
  dabsCostsAvoided: number;
  feesLessAdmin: number;
  stateShare: number;
}

/** Who covers the grocer's margin at one margin and savings case, with license fees covering the new administration. */
export function coverAt(margin: number, s: SavingsCase): MarginCover {
  const k = samePriceCase(margin, s, true);
  const moved = computeFlows(terms(margin), samePriceInputs(s, true)).origins[0].grocery.storeEquivalent;
  const dabsCostsAvoided = savingsPerDollar(s) * moved;
  return { grocerIncome: k.grocerIncome, dabsCostsAvoided, feesLessAdmin: 0, stateShare: k.grocerIncome - dabsCostsAvoided };
}

export interface SamePriceReport {
  method: string;
  /** The headline margin (Pennsylvania's licensee discount). */
  margin: number;
  /** Wine that moves at the fixed 30% share, $ a year at state-store prices, and the new administration. */
  moved: number;
  admin: number;
  feePerStore: number;
  grid: SamePriceCase[];
  /** The highest grocer margin at which the state breaks even, by savings case, without and with fees. */
  breakEvenMargin: Record<SavingsCase, { noFees: number; fees: number }>;
  /** At the headline margin with fees: extra wine bought in Utah that would make up the rest, as a share of household
   * DABS wine (additional purchases, or purchases brought back from other states). */
  needed: Record<SavingsCase, { additional: BreakEven; recapture: BreakEven }>;
  cover: Record<SavingsCase, MarginCover>;
  /** The share of the shelf price DABS must keep under the markup floor: discounts above this need a law change. */
  lawfulDiscount: number;
}

export function samePriceReport(margin: number = PA_LICENSEE_MARGIN.value): SamePriceReport {
  const cases: SavingsCase[] = SAVINGS_CASES.map((s) => s.id);
  const grid = SAME_PRICE_MARGINS.flatMap((m) => cases.flatMap((s) => [false, true].map((f) => samePriceCase(m, s, f))));
  const base = computeFlows(terms(margin), samePriceInputs("none", false));
  const moved = base.origins[0].grocery.storeEquivalent;
  const admin = DEFAULT_FLOWS.costs.admin;
  // At the same price the state's change is moved x (savings - margin) - administration + fees (the flow model's
  // arithmetic with nothing else changing); the break-even margin solves it for zero. The test checks it against the model.
  const breakEvenMargin = Object.fromEntries(
    cases.map((s) => [s, { noFees: savingsPerDollar(s) - admin / moved, fees: savingsPerDollar(s) }]),
  ) as SamePriceReport["breakEvenMargin"];
  const needed = Object.fromEntries(
    cases.map((s) => {
      const a = terms(margin);
      const x = samePriceInputs(s, true);
      return [s, { additional: breakEven(a, x, "additional"), recapture: breakEven(a, x, "recapture") }];
    }),
  ) as SamePriceReport["needed"];
  const cover = Object.fromEntries(cases.map((s) => [s, coverAt(margin, s)])) as SamePriceReport["cover"];
  return {
    method: SAME_PRICE_METHOD,
    margin,
    moved,
    admin,
    feePerStore: admin / UTAH_GROCERY_ESTABLISHMENTS.count,
    grid,
    breakEvenMargin,
    needed,
    cover,
    // Utah Code 32B-2-304(2)(b): at least an 88.5% markup over landed cost, the engine's own legal note's arithmetic.
    lawfulDiscount: Math.max(0, 1 - (1 + STATUTORY_MARKUP.wine) * base.arrangement.acquisition),
  };
}

/** The figures the policy pages quote, in one place: at the headline margin with license fees covering the
 * administration, what the state gives up in each savings case (positive: a cost), what closes the no-savings case, and
 * the lowest price to grocers the markup floor allows today. */
export function samePriceHeadline(rep: SamePriceReport = defaultSamePriceReport()) {
  return {
    margin: rep.margin,
    priceToGrocers: 1 - rep.margin,
    cost: { none: rep.cover.none.stateShare, allocated: rep.cover.allocated.stateShare, longerRun: rep.cover.longer_run.stateShare },
    neededNone: rep.needed.none.additional.value ?? Number.NaN,
    breakEvenLongerRun: rep.breakEvenMargin.longer_run.fees,
    lowestLawfulPrice: 1 - rep.lawfulDiscount,
    moved: rep.moved,
  };
}

let cached: SamePriceReport | null = null;
/** The report at Pennsylvania's 10% (cached: pages and exports read the same object). */
export function defaultSamePriceReport(): SamePriceReport {
  return (cached ??= samePriceReport());
}
