import { describe, expect, it } from "vitest";
import { compare, settingsFromFields, type ArrangementSettings } from "./arrangements";
import { WORKED_PROPOSALS, type ScenarioInputs } from "./scenario";
import { SUBSTITUTION_METHOD, substitution, type SubstitutionInputs } from "./substitution";

// The round numbers of arrangements.test.ts: $1,000,000 of wine, 20,000 gallons ($50 a gallon), a 50% margin, 30% moves.
const BASE: ScenarioInputs = {
  wineSales: 1_000_000,
  wineGallons: 20_000,
  grossMargin: 0.5,
  salesTax: 0.05,
  avoidableCost: 0.05,
  newCosts: 10_000,
  shift: 0.3,
  priceRatio: 1,
  revenueMode: "keep",
  retained: null,
  excise: null,
  adValorem: null,
  discount: null,
  extra: false,
  growth: null,
  extraGrocery: null,
  substitution: false,
  replaces: null,
  basis: null,
  beerPrice: null,
  beerTax: null,
  wineAbv: null,
  beerAbv: null,
};
const SET: ArrangementSettings = { priceCase: "entered", taxKind: "percent", taxRate: 0.2, taxToPrice: null, wholesaleCost: null, discount: 0.2, earmarkBase: "private", earmarkRule: "fixed", earmarkValue: null, wholesalerMargin: null, grocerMargin: null };
const SUB: SubstitutionInputs = { swap: 0.1, grocery: 1, beerPrice: 10, beerTax: 13.35, wineAbv: 0.12, beerAbv: 0.048 };
const RATES = { school: 0.1, enforcement: 0.01695 };

describe("beer-to-wine substitution, by hand", () => {
  it("reports its method and needs its inputs", () => {
    const r = substitution(BASE, SET, "wholesale", { ...SUB, beerPrice: null });
    expect(r.method).toBe(SUBSTITUTION_METHOD);
    expect(r.missing).toContain("beer price per gallon");
    expect(r.threshold.status).toBe("unavailable");
  });

  it("arrangement 2: DABS's margin and sales tax on the wine, the beer's excise and sales tax lost", () => {
    const r = substitution(BASE, SET, "wholesale", SUB, RATES);
    // 10% of 20,000 gallons = 2,000 gallons, $100,000 at state-store prices, all bought at grocers.
    expect(r.wineGallons).toBeCloseTo(2_000, 9);
    // DABS keeps the margin less the discount (30 cents) and the state 5 cents of sales tax a dollar.
    const wine = 0.3 * 100_000 + 0.05 * 100_000;
    // Pure alcohol held: 2,000 x 0.12 / 0.048 = 5,000 gallons of beer at $10, $13.35 a barrel.
    const beer = (5_000 / 31) * 13.35 + 0.05 * 5_000 * 10;
    expect(r.beerGallonsReplaced).toBeCloseTo(5_000, 9);
    expect(r.swapNet).toBeCloseTo(wine - beer, 6);
    expect(r.perGallon!.net).toBeCloseTo((wine - beer) / 2_000, 9);
    expect(r.perGallon!.beerPerWine).toBeCloseTo(2.5, 12);
    // DABS's receipts from grocers carry the school-meals deposit only if the law says so: 10% of 80% of $100,000.
    expect(r.dabsGrossAdded).toBeCloseTo(80_000, 6);
    expect(r.schoolDepositAdded).toBeCloseTo(8_000, 6);
  });

  it("holds total ethanol constant", () => {
    for (const id of ["private", "wholesale"] as const) {
      const r = substitution(BASE, SET, id, { ...SUB, swap: 0.37, grocery: 0.6 });
      expect(r.ethanolAdded!).toBeCloseTo(r.ethanolRemoved!, 9);
    }
  });

  it("at state stores the wine earns the margin and sales tax less the avoidable cost of selling it", () => {
    const r = substitution(BASE, SET, "private", { ...SUB, grocery: 0 });
    const beerPerWineGallon = 2.5 * (13.35 / 31 + 0.05 * 10);
    expect(r.perGallon!.wine).toBeCloseTo(50 * (0.5 + 0.05 - 0.05), 9);
    expect(r.perGallon!.beer).toBeCloseTo(beerPerWineGallon, 9);
    expect(r.dabsGrossAdded).toBeCloseTo(100_000, 6);
  });

  it("is computed on the channel shift alone: other purchase changes cannot be counted with it", () => {
    const busy: ScenarioInputs = { ...BASE, extra: true, growth: 0.2, extraGrocery: 0.5, elasticity: -0.46, recapture: 0.1, substitution: true, replaces: 0.5, basis: "volume", beerPrice: 99, beerTax: 99, wineAbv: 0.5, beerAbv: 0.5 };
    for (const id of ["private", "wholesale"] as const) {
      const a = substitution(BASE, SET, id, SUB);
      const b = substitution(busy, SET, id, SUB);
      expect(b.swapNet).toBeCloseTo(a.swapNet!, 9);
      expect(b.shiftNet).toBeCloseTo(a.shiftNet!, 9);
      // and the channel shift is the comparison's own
      const c = compare(BASE, SET, null);
      expect(a.shiftNet).toBeCloseTo((id === "private" ? c.private : c.wholesale).lines!.net, 6);
    }
  });

  it("finds the amount that offsets the loss, and the net there is zero", () => {
    const r = substitution(BASE, SET, "wholesale", SUB);
    // Arrangement 2 loses 0.2 x 300,000 - 0.05 x 300,000 + 10,000 = 55,000; each wine gallon nets the per-gallon figure.
    expect(r.shiftNet).toBeCloseTo(-55_000, 6);
    expect(r.threshold.status).toBe("found");
    expect(r.threshold.wineGallons!).toBeCloseTo(55_000 / r.perGallon!.net, 3);
    const at = substitution(BASE, SET, "wholesale", { ...SUB, swap: r.threshold.swap });
    expect(at.withSwapNet!).toBeCloseTo(0, 3);
  });

  it("says when there is not enough beer to replace, and when switching loses money", () => {
    const few = substitution(BASE, SET, "private", { ...SUB, beerGallons: 1_000 });
    expect(few.threshold.status).toBe("beyond_beer");
    // A beer price so high that its sales tax outweighs the wine's revenue: each switched gallon loses money.
    const dear = substitution(BASE, SET, "private", { ...SUB, beerPrice: 1_000 });
    expect(dear.perGallon!.net).toBeLessThan(0);
    expect(dear.threshold.status).toBe("never");
  });

  it("rejects values out of range", () => {
    expect(substitution(BASE, SET, "private", { ...SUB, grocery: 1.5 }).invalid.length).toBe(1);
    expect(substitution(BASE, SET, "private", { ...SUB, swap: -0.1 }).invalid.length).toBe(1);
    expect(substitution(BASE, SET, "private", { ...SUB, beerAbv: 0 }).invalid.length).toBe(1);
  });
});

describe("the briefing's worked example (FY2025, matched prices)", () => {
  // The worked comparison's inputs, with NIAAA's 2024 Utah wine gallons and average ABVs and the beer excise in force in
  // FY2025 ($13.35 a barrel). The beer price ($12 a gallon) is an illustration with no source.
  const p = WORKED_PROPOSALS.find((w) => w.id === "compare_fy2025")!;
  const W = 551_346_000 * 0.335;
  const m = 260_289_000 / 551_346_000;
  const x: ScenarioInputs = { ...BASE, wineSales: W, wineGallons: 3_297_940, grossMargin: m, salesTax: 0.0485, avoidableCost: 0.05, newCosts: 500_000, shift: 0.3, eligible: 0.82, priceRatio: 1, extra: true, growth: 0, extraGrocery: 1, elasticity: -0.46 };
  const s = settingsFromFields((k) => p.values[k]);
  const sub: SubstitutionInputs = { swap: 0, grocery: 1, beerPrice: 12, beerTax: 13.35, wineAbv: 0.118, beerAbv: 0.048, beerGallons: 26_660_000 };
  const S = W * 0.82 * 0.3;

  it("matches the comparison's channel-shift losses", () => {
    expect(substitution(x, s, "private", sub).shiftNet).toBeCloseTo(S * (-m + 0.2 / 1.2 + 0.05) - 500_000, 2);
    expect(substitution(x, s, "wholesale", sub).shiftNet).toBeCloseTo(-0.15 * S - 500_000, 2);
  });

  it("gives the per-gallon figures and thresholds by hand", () => {
    const P = W / 3_297_940; // about $56 a gallon at state-store prices
    const beer = (0.118 / 0.048) * (13.35 / 31 + 0.0485 * 12);
    const a1 = substitution(x, s, "private", sub);
    const a2 = substitution(x, s, "wholesale", sub);
    // Matched prices: the 20% tax is 0.2/1.2 of the shelf price; DABS keeps m - 20% on its sales to grocers.
    expect(a1.perGallon!.wine).toBeCloseTo(P * (0.2 / 1.2 + 0.0485), 9);
    expect(a2.perGallon!.wine).toBeCloseTo(P * (m - 0.2 + 0.0485), 9);
    expect(a1.perGallon!.beer).toBeCloseTo(beer, 9);
    expect(a1.threshold.wineGallons!).toBeCloseTo(-a1.shiftNet! / (P * (0.2 / 1.2 + 0.0485) - beer), 0);
    expect(a2.threshold.wineGallons!).toBeCloseTo(-a2.shiftNet! / (P * (m - 0.2 + 0.0485) - beer), 0);
    // Both thresholds need far less beer than Utah drinks, but a large rise in wine bought.
    expect(a1.threshold.beerShare!).toBeLessThan(1);
    expect(a2.threshold.swap!).toBeLessThan(a1.threshold.swap!);
  });
});
