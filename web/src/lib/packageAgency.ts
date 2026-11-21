// Utah's own precedent for a private store selling at the state's price. DABS contracts with package agencies (Type 2:
// run with another business whose main income is not liquor, such as a convenience store; Type 3: small, mostly rural,
// mainly selling liquor), which may sell only at the price the commission fixes (Utah Code 32B-2-605(7)) and are paid
// a fixed annual amount by annual bottles sold and average bottle price (the grid in packageAgencyGrid.generated.ts,
// read from DABS's PDF). Dividing that pay by the agency's sales gives the share of the
// shelf price Utah already pays a private seller, the same quantity as a grocer's margin at the same shelf price.
//
// The grid pays on all products an agency sells; here it is applied to wine alone at DABS's FY2026 average wine bottle
// price, which is this page's assumption, not DABS's.
import { PACKAGE_AGENCY_GRID } from "./packageAgencyGrid.generated";
import { DABS_WINE_BOTTLES } from "./dabsWineBottles.generated";
import { UTAH_GROCERY_ESTABLISHMENTS } from "./policyDesigns";

export type PriceClass = (typeof PACKAGE_AGENCY_GRID.classes)[number]["id"];

/** The grid's price class for an average bottle price. The PDF's ranges share their ends ($3.00-$10.00, $10.00-$15.00);
 * a price on an end is placed in the higher class. */
export function priceClassIndex(averagePrice: number): number {
  const i = PACKAGE_AGENCY_GRID.classes.findIndex((c) => c.maxPrice === null || averagePrice < c.maxPrice);
  return i;
}

export function stepFor(bottles: number) {
  const n = Math.round(bottles);
  return PACKAGE_AGENCY_GRID.steps.find((s) => s.maxBottles === null || n <= s.maxBottles)!;
}

export interface AgencyPay {
  bottles: number;
  averagePrice: number;
  sales: number;
  step: number;
  priceClass: PriceClass;
  /** DABS's fixed annual pay for that cell, $. */
  pay: number;
  /** Pay as a share of the agency's sales at state prices. */
  rate: number;
}

export function agencyPay(bottles: number, averagePrice: number = DABS_WINE_BOTTLES.all.averagePrice): AgencyPay {
  const s = stepFor(bottles);
  const c = priceClassIndex(averagePrice);
  const sales = bottles * averagePrice;
  return {
    bottles,
    averagePrice,
    sales,
    step: s.step,
    priceClass: PACKAGE_AGENCY_GRID.classes[c].id,
    pay: s.pay[c],
    rate: s.pay[c] / sales,
  };
}

/** A typical grocery store if the wine that moves were shared evenly by Utah's grocery stores (Census County Business
 * Patterns establishments), at DABS's average wine bottle price. */
export function typicalGrocer(moved: number): AgencyPay {
  const price = DABS_WINE_BOTTLES.all.averagePrice;
  return agencyPay(moved / price / UTAH_GROCERY_ESTABLISHMENTS.count, price);
}

/** The grid's rate at a range of annual wine bottle volumes, for the page's table. */
export const AGENCY_VOLUMES = [5_000, 10_000, 25_000, 50_000, 100_000, 200_000, 300_000] as const;
export const agencyRates = () => AGENCY_VOLUMES.map((b) => agencyPay(b));
