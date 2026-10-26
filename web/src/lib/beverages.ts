// Beer, wine and spirits: the arithmetic behind the beverage page, kept apart so it can be tested.
// Shares are of the three beverages' own sum, and a change is computed only between two real values.
import { percentChange } from "./formulas";

export type BevKey = "beer" | "wine" | "spirits";

export const BEVERAGES: { key: BevKey; label: string; perAdult: string; gallons: string }[] = [
  { key: "beer", label: "Beer", perAdult: "niaaa_ethanol_per_capita_21plus_beer@calendar_year", gallons: "niaaa_beverage_gallons_beer@calendar_year" },
  { key: "wine", label: "Wine", perAdult: "niaaa_ethanol_per_capita_21plus_wine@calendar_year", gallons: "niaaa_beverage_gallons_wine@calendar_year" },
  { key: "spirits", label: "Spirits", perAdult: "niaaa_ethanol_per_capita_21plus_spirits@calendar_year", gallons: "niaaa_beverage_gallons_spirits@calendar_year" },
];
export const ALL_PER_ADULT = "niaaa_ethanol_per_capita_21plus_all@calendar_year";

/** DABS product groups, in the order the page lists them. "other" is non-beverage and unclassified items. */
export const DABS_GROUPS = ["spirits", "wine", "beer", "cider", "premixed", "other", "total"] as const;
export type DabsGroup = (typeof DABS_GROUPS)[number];
export const DABS_LABELS: Record<DabsGroup, string> = {
  spirits: "Spirits",
  wine: "Wine",
  beer: "Beer (heavy beer and malt drinks)",
  cider: "Cider",
  premixed: "Premixed drinks",
  other: "Other items",
  total: "All products",
};

export const LITERS_PER_US_GALLON = 3.785411784;
/** One 9-liter case in U.S. gallons of beverage (about 2.378). */
export const GALLONS_PER_9L_CASE = 9 / LITERS_PER_US_GALLON;

export interface Shares {
  beer: number;
  wine: number;
  spirits: number;
}

/** Each beverage's share (percent) of beer + wine + spirits. Null unless all three have a value and the
 * sum is positive. The sum is used rather than NIAAA's all-beverage figure, which is rounded on its own,
 * so the three shares always add to 100. */
export function sharesOf(v: Partial<Record<BevKey, number | null>>): Shares | null {
  const { beer, wine, spirits } = v;
  if (beer == null || wine == null || spirits == null) return null;
  const sum = beer + wine + spirits;
  if (!(sum > 0)) return null;
  return { beer: (100 * beer) / sum, wine: (100 * wine) / sum, spirits: (100 * spirits) / sum };
}

/** Percent change, or null where it is undefined (a missing end or a zero base). */
export function change(from: number | null | undefined, to: number | null | undefined): number | null {
  return percentChange(from, to) ?? null;
}

export interface SameMonth {
  month: string;
  earlier: string;
  now: number;
  before: number;
  pct: number | null;
}

/** Each month that also has a value exactly twelve months earlier, with the change from it.
 * Months are "YYYY-MM"; a month without its year-earlier partner is left out, never compared with a
 * neighbour. */
export function sameMonthChanges(values: Map<string, number | null>): SameMonth[] {
  const out: SameMonth[] = [];
  for (const [month, now] of [...values.entries()].sort()) {
    const earlier = `${Number(month.slice(0, 4)) - 1}${month.slice(4)}`;
    const before = values.get(earlier);
    if (now == null || before == null) continue;
    out.push({ month, earlier, now, before, pct: change(before, now) });
  }
  return out;
}
