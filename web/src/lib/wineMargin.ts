// A wine-specific gross margin from Utah's pricing statute, checked against DABS's own figures.
//
// What the law says (Utah Code § 32B-2-304, read on 2026-10-12 through the legislature's page reader from the PDFs
// of the version effective 2024-05-01 (superseded 2026-03-13) and the version effective 2026-03-13; the PDFs could
// not be downloaded into the project from this environment). The two agree on every percentage used here: wine
// sold by the department "shall be marked up in an amount not less than 88.5% above the landed case cost to the
// department" (2)(b). Spirituous liquor (2)(a) and flavored malt beverages (2)(d) carry the same 88.5%; heavy beer
// (2)(c) 66.5%. Landed case cost is the product cost plus the department's inbound shipping and case handling, not
// outbound shipping to a store (1). S.B. 180 (2026 General Session, effective 2026-07-01) leaves the rates alone.
// A 2025 bill (S.B. 258) would have raised liquor and wine to 89%; the 2024 version stayed in force until
// 2026-03-13 and the 2026 text still says 88.5%, so it did not take effect.
//
// A markup m on cost makes the price (1 + m) times the cost, so the margin on the price is m / (1 + m): 88.5%
// becomes 46.95%. It is a scenario assumption, not an observed margin: no wine-specific cost or profit figure is in
// the dataset. The statute sets a floor, not a price. Wine below it: 49% for makers of under 20,000 gallons a year
// (620,000 for hard cider) who apply (3)(c), 17% on sales to military installations (3)(a), discounts on
// discontinued items (7). Wine possibly above it: prices set higher than the floor and, from 2026-03-13 only,
// rounding under § 32B-2-213 (the 2026 version's (7); the 2024 version's (7) covers discontinued items only). The
// wine subscription program carries 88.5% on the subscription cost (4). Which way these net out for wine is not
// known. The two versions cover the whole of FY2025 and FY2026 (2024-05-01 to 2026-03-13, and 2026-03-13 on);
// earlier years are not checked here.
//
// The check: put the floor on each beverage's share of DABS gross sales and compare the all-product margin it
// implies with the margin DABS reports (gross profit over liquor sales). If gross sales included sales tax, the
// reported margin would sit well above the floor; if they exclude it, near it. The tax-inclusive figure uses the
// state's rate alone; local rates would push it higher still. It cannot settle the question: reduced markups pull
// the actual margin below the floors and higher or rounded prices push it above.
export const WINE_MARGIN_METHOD = "wine-margin@1.0";

/** Minimum markups over landed case cost, § 32B-2-304(2). */
export const STATUTORY_MARKUP = { spirits: 0.885, wine: 0.885, flavoredMalt: 0.885, heavyBeer: 0.665 } as const;

export const STATUTE_NOTE =
  "Utah Code § 32B-2-304(2)(b): wine sold by the department is marked up not less than 88.5% above landed case cost (the versions effective 2024-05-01 and 2026-03-13 both say so; read through the legislature's site on 2026-10-12; the PDFs are not yet saved into the project's sources).";

/** Margin on the price for a markup on cost. */
export function marginOfMarkup(markup: number): number {
  return markup / (1 + markup);
}

/** Which markup the statute puts on each DABS Sales Analysis beverage group. Hard cider is wine; premixed drinks
 * are spirit-based or flavored malt beverages, both at 88.5%; DABS's "Beer" is heavy beer. "Other" (special
 * orders) is left out: it has no single markup and is about 0.01% of sales. */
export const BEVERAGE_MARKUP: Record<string, number | null> = {
  spirits: STATUTORY_MARKUP.spirits,
  wine: STATUTORY_MARKUP.wine,
  cider: STATUTORY_MARKUP.wine,
  premixed: STATUTORY_MARKUP.flavoredMalt,
  beer: STATUTORY_MARKUP.heavyBeer,
  other: null,
};

export interface MixMargin {
  /** Sales-weighted margin at the statutory floors, over the groups that have a markup. */
  margin: number | null;
  /** Share of the total that the groups with a markup cover. */
  covered: number;
  total: number;
}

/** The all-product margin implied by the floors for a mix of gross sales by beverage group. */
export function impliedMargin(salesByGroup: Record<string, number | null | undefined>): MixMargin {
  let total = 0;
  let covered = 0;
  let weighted = 0;
  for (const [group, v] of Object.entries(salesByGroup)) {
    if (v === null || v === undefined || !Number.isFinite(v) || v < 0) continue;
    total += v;
    const m = BEVERAGE_MARKUP[group];
    if (m === null || m === undefined) continue;
    covered += v;
    weighted += v * marginOfMarkup(m);
  }
  return { margin: covered > 0 ? weighted / covered : null, covered: total > 0 ? covered / total : 0, total };
}

/** The margin DABS would report if its gross sales included a sales tax of rate t on top of a shelf price set at
 * the markup: the price is cost × (1 + markup) and sales are price × (1 + t). */
export function marginIfTaxIncluded(markup: number, taxRate: number): number {
  return 1 - 1 / ((1 + markup) * (1 + taxRate));
}

export interface MarginCheck {
  wineFloor: number;
  mixFloor: number | null;
  mixCovered: number;
  reported: number | null;
  /** reported − mixFloor, in share points. */
  gap: number | null;
  /** The margin a state sales tax inside gross sales would put on the all-product mix, at the floors. */
  ifTaxIncluded: { rate: number; margin: number } | null;
  /** Which reading the reported margin is closer to, or null when it cannot be told. */
  closer: "excludes_tax" | "includes_tax" | null;
}

export function crossCheck(args: { salesByGroup: Record<string, number | null | undefined>; reportedMargin: number | null; taxRate: number | null }): MarginCheck {
  const mix = impliedMargin(args.salesByGroup);
  const wineFloor = marginOfMarkup(STATUTORY_MARKUP.wine);
  const reported = args.reportedMargin;
  const gap = reported !== null && mix.margin !== null ? reported - mix.margin : null;
  let ifTax: MarginCheck["ifTaxIncluded"] = null;
  if (args.taxRate !== null && mix.margin !== null) {
    // Tax on top of the floor, in the same mix: scale each group's price by (1 + t).
    const t = args.taxRate;
    let sum = 0;
    let cov = 0;
    for (const [g, v] of Object.entries(args.salesByGroup)) {
      const m = BEVERAGE_MARKUP[g];
      if (m === null || m === undefined || v === null || v === undefined || !Number.isFinite(v) || v <= 0) continue;
      sum += v * marginIfTaxIncluded(m, t);
      cov += v;
    }
    if (cov > 0) ifTax = { rate: t, margin: sum / cov };
  }
  let closer: MarginCheck["closer"] = null;
  if (reported !== null && mix.margin !== null && ifTax) closer = Math.abs(reported - mix.margin) <= Math.abs(reported - ifTax.margin) ? "excludes_tax" : "includes_tax";
  return { wineFloor, mixFloor: mix.margin, mixCovered: mix.covered, reported, gap, ifTaxIncluded: ifTax, closer };
}

/** The lowest and highest of a set of reported margins, for a spread of the all-product figure across years. */
export function spreadOf(values: (number | null)[]): { low: number; high: number; n: number } | null {
  const v = values.filter((x): x is number => x !== null && Number.isFinite(x));
  return v.length >= 2 ? { low: Math.min(...v), high: Math.max(...v), n: v.length } : null;
}
