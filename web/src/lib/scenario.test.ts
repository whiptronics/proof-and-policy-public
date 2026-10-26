import { describe, expect, it } from "vitest";
import { check, compute, effectivePrice, type ScenarioInputs } from "./scenario";
import { sensitivity } from "./scenarioRanges";

// Round numbers so every result can be checked by hand: $100 of wine, 10 gallons ($10 a gallon).
const BASE: ScenarioInputs = {
  wineSales: 100,
  wineGallons: 10,
  grossMargin: 0.5,
  salesTax: 0.05,
  avoidableCost: 0.1,
  newCosts: 0,
  shift: 0.2,
  priceRatio: 1,
  revenueMode: "keep",
  retained: 0.3,
  excise: null,
  adValorem: null,
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
const val = (parts: { id: string; value: number }[], id: string) => parts.find((p) => p.id === id)?.value;

describe("baseline and channel shift by hand", () => {
  it("counts margin and tax, never gross sales", () => {
    const r = compute(BASE);
    expect(r.baselineTotal).toBe(55); // 0.5 x 100 + 0.05 x 100
    expect(val(r.baseline, "store_margin")).toBe(50);
    // A tool that added gross sales would report 155 or more.
    expect(compute({ ...BASE, grossMargin: 0, salesTax: 0 }).baselineTotal).toBe(0);
  });
  it("moves $20 of sales without creating demand", () => {
    const r = compute(BASE);
    expect(val(r.a, "store_margin")).toBe(40); // 0.5 x 80
    expect(val(r.a, "retained")).toBeCloseTo(6, 12); // 0.3 x 20
    expect(val(r.a, "sales_tax")).toBeCloseTo(5, 12); // same total spending, same tax
    expect(val(r.a, "cost_saved")).toBeCloseTo(2, 12); // 0.1 x 20
    expect(r.netA).toBeCloseTo(-2, 12); // (40 + 6 + 5) - 55 + 2
    expect(r.perShiftedDollar).toBeCloseTo(-0.1, 12); // -0.5 + 0.3 + 0.1
  });
  it("breaks even when the state keeps 40% of grocery sales, and says when it cannot", () => {
    expect(compute(BASE).breakEvenRetained.value).toBeCloseTo(0.4, 12); // (0.5 - 0.1) / 1
    expect(compute({ ...BASE, retained: 0.4 }).netA).toBeCloseTo(0, 12);
    expect(compute({ ...BASE, grossMargin: 0.95, avoidableCost: 0 }).breakEvenRetained.value).toBeCloseTo(0.95, 12);
    expect(compute({ ...BASE, shift: 0 }).breakEvenRetained).toEqual({ value: null, note: "No wine moves, so there is nothing to break even." });
    const unreachable = compute({ ...BASE, priceRatio: 0.5, grossMargin: 0.9, avoidableCost: 0 });
    expect(unreachable.breakEvenRetained.value).toBeGreaterThan(1);
    expect(unreachable.breakEvenRetained.note).toMatch(/Not reachable/);
  });
  it("subtracts new licensing and enforcement costs, and raises the break-even share to cover them", () => {
    const r = compute({ ...BASE, newCosts: 1 });
    expect(r.netA).toBeCloseTo(-3, 12);
    expect(r.perShiftedDollar).toBeCloseTo(-0.1, 12); // per-dollar figure is before the fixed costs
    expect(r.breakEvenRetained.value).toBeCloseTo(0.45, 12); // (0.5 - 0.1 + 1 / 20) / 1
    expect(compute({ ...BASE, newCosts: 1, retained: 0.45 }).netA).toBeCloseTo(0, 12);
  });
  it("finds the excise per gallon that breaks even", () => {
    // Excise only: net = 20 x (-0.5 + 0.1) + e x 10 x 0.2 = -8 + 2e, so e = $4 a gallon.
    const x = { ...BASE, revenueMode: "excise" as const, retained: null, excise: 1 };
    expect(compute(x).breakEvenExcise.value).toBeCloseTo(4, 12);
    expect(compute({ ...x, excise: 4 }).netA).toBeCloseTo(0, 12);
  });
  it("finds the share that covers fixed new costs only when moved sales gain revenue", () => {
    // Keeping 60%: each moved dollar gains -0.5 + 0.6 + 0.1 = 0.2; $1 of new costs needs $5 moved = 5% of $100.
    expect(compute({ ...BASE, retained: 0.6, newCosts: 1 }).breakEvenShift.value).toBeCloseTo(0.05, 12);
    expect(compute({ ...BASE, retained: 0.6, newCosts: 1, shift: 0.05 }).netA).toBeCloseTo(0, 12);
    expect(compute({ ...BASE, newCosts: 1 }).breakEvenShift.value).toBeNull(); // each moved dollar loses 0.1
    expect(compute({ ...BASE, retained: 0.6, newCosts: 0 }).breakEvenShift.value).toBe(0);
    expect(compute({ ...BASE, retained: 0.6, newCosts: 50 }).breakEvenShift.note).toMatch(/Not reachable/);
  });
  it("taxes the grocery price: cheaper grocery wine lowers sales tax", () => {
    const r = compute({ ...BASE, priceRatio: 0.9 });
    expect(val(r.a, "sales_tax")).toBeCloseTo(0.05 * (80 + 18), 12);
    expect(val(r.a, "retained")).toBeCloseTo(0.3 * 18, 12);
  });
  it("puts an excise on gallons, not dollars", () => {
    const r = compute({ ...BASE, revenueMode: "excise", excise: 2, retained: null });
    expect(val(r.a, "excise")).toBeCloseTo(4, 12); // $2 x 10 gallons x 20%
    expect(val(r.a, "retained")).toBeUndefined();
    expect(r.netA).toBeCloseTo(40 + 4 + 5 - 55 + 2, 12);
  });
});

describe("more purchases are kept apart from the shift", () => {
  it("adds nothing when purchases do not grow", () => {
    const r = compute({ ...BASE, extra: true, growth: 0, extraGrocery: 1 });
    expect(r.netB).toBeCloseTo(r.netA, 12);
  });
  it("counts only the extra wine as new demand", () => {
    const r = compute({ ...BASE, extra: true, growth: 0.1, extraGrocery: 1 });
    // $10 extra, all in grocery stores: state keeps 0.3 x 10 and taxes 0.05 x 10.
    expect(val(r.b!, "extra_retained")).toBeCloseTo(3, 12);
    expect(val(r.b!, "extra_sales_tax")).toBeCloseTo(0.5, 12);
    expect(r.netB).toBeCloseTo(-2 + 3.5, 12);
    expect(r.netA).toBeCloseTo(-2, 12); // scenario A is unchanged by scenario B
  });
  it("charges extra state-store sales their operating cost", () => {
    const r = compute({ ...BASE, extra: true, growth: 0.1, extraGrocery: 0 });
    expect(val(r.b!, "extra_store_margin")).toBeCloseTo(5, 12);
    expect(val(r.b!, "extra_cost")).toBeCloseTo(1, 12);
    expect(r.netB).toBeCloseTo(-2 + 5 + 0.5 - 1, 12);
  });
  it("subtracts the beer revenue lost, on the basis chosen", () => {
    // $10 of extra wine (1 gallon), half of it replacing beer; beer $5 a gallon, $31 a barrel = $1 a gallon.
    const sub = { ...BASE, extra: true, growth: 0.1, extraGrocery: 1, substitution: true, replaces: 0.5, beerPrice: 5, beerTax: 31, wineAbv: 0.12, beerAbv: 0.048 };
    const spending = compute({ ...sub, basis: "spending" });
    expect(spending.beer).toMatchObject({ dollars: 5, gallons: 1 });
    expect(spending.netB).toBeCloseTo(1.5 - (1 + 0.25), 12);
    const volume = compute({ ...sub, basis: "volume" });
    expect(volume.beer).toMatchObject({ gallons: 0.5, dollars: 2.5 });
    expect(volume.netB).toBeCloseTo(1.5 - (0.5 + 0.125), 12);
    const ethanol = compute({ ...sub, basis: "ethanol" });
    expect(ethanol.beer!.gallons).toBeCloseTo(1.25, 12); // 0.5 gallon of wine at 12% = 0.06 gal alcohol = 1.25 gal of 4.8% beer
    expect(ethanol.netB).toBeCloseTo(1.5 - (1.25 + 0.05 * 6.25), 12);
  });
});

describe("inputs are requested, never invented", () => {
  it("lists what is missing for the chosen configuration", () => {
    const blank = { ...BASE, wineSales: null, salesTax: null };
    expect(check(blank).missing).toEqual(["baseline wine sales", "state sales tax rate"]);
    const r = compute(blank);
    expect(r.a).toEqual([]);
    expect(check({ ...BASE, revenueMode: "excise", wineGallons: null }).missing).toEqual(["excise per gallon", "wine gallons sold"]);
    expect(check({ ...BASE, extra: true, substitution: true, basis: "ethanol" }).missing).toEqual([
      "increase in total wine purchases",
      "share of the extra wine bought in grocery stores",
      "share of the extra wine that replaces beer",
      "beer price per gallon",
      "beer excise per barrel",
      "wine alcohol content",
      "beer alcohol content",
    ]);
  });
  it("rejects impossible values", () => {
    expect(check({ ...BASE, shift: 1.2 }).invalid).toEqual(["Share moving to grocery stores must be between 0% and 100%"]);
    expect(check({ ...BASE, priceRatio: 0 }).invalid).toEqual(["The grocery price must be above zero"]);
    expect(check({ ...BASE, revenueMode: "excise", excise: 1, wineGallons: 0 }).invalid).toEqual(["Wine gallons must be above zero"]);
  });
});

describe("sensitivity", () => {
  it("moves one input at a time and ranks by swing", () => {
    const s = sensitivity(BASE, "A");
    const shift = s.find((x) => x.input === "shift")!;
    expect([shift.low, shift.high]).toEqual([0.1, expect.closeTo(0.3, 12)]);
    expect(shift.netLow).toBeCloseTo(-1, 12); // -0.1 x $10
    expect(shift.netHigh).toBeCloseTo(-3, 12);
    const margin = s.find((x) => x.input === "grossMargin")!;
    expect(margin.netLow).toBeCloseTo(0, 12); // margin 0.4 = break-even
    expect(s[0].swing).toBeGreaterThanOrEqual(s[s.length - 1].swing);
    expect(s.some((x) => x.input === "excise")).toBe(false); // not part of this configuration
  });
});

describe("price response, pass-through and recapture", () => {
  const B_ON = { ...BASE, extra: true, growth: 0, extraGrocery: 1 };

  it("passes only part of the price gap to the shelf", () => {
    const half = compute({ ...BASE, priceRatio: 0.8, passThrough: 0.5 });
    const direct = compute({ ...BASE, priceRatio: 0.9 });
    expect(half.priceRatioUsed).toBeCloseTo(0.9, 12);
    expect(half.netA).toBeCloseTo(direct.netA, 12);
    expect(compute({ ...BASE, priceRatio: 0.8, passThrough: 0 }).netA).toBeCloseTo(compute(BASE).netA, 12); // no pass-through, no price change
    expect(compute({ ...BASE, priceRatio: 0.8, passThrough: null }).priceRatioUsed).toBeCloseTo(0.8, 12);
    expect(effectivePrice({ ...BASE, priceRatio: 1.2, passThrough: 0.5 })).toBeCloseTo(1.1, 12);
  });
  it("rejects impossible pass-through, elasticity and recapture", () => {
    expect(check({ ...BASE, passThrough: 2.5 }).invalid).toEqual(["Pass-through must be between 0% and 200%"]);
    expect(check({ ...BASE, priceRatio: 0.4, passThrough: 2 }).invalid).toEqual(["With this pass-through the grocery price would be zero or negative"]);
    expect(check({ ...B_ON, elasticity: 0.3 }).invalid).toEqual(["The price elasticity of demand must be zero or negative"]);
    expect(check({ ...B_ON, elasticity: -9 }).invalid).toEqual(["The price elasticity of demand cannot be below -5"]);
    expect(check({ ...B_ON, recapture: -0.1 }).invalid).toEqual(["Cross-border recapture cannot be negative"]);
  });
  it("changes the quantity of the wine that moves when its price changes, in scenario B only", () => {
    const x = { ...B_ON, priceRatio: 0.9, elasticity: -0.5 };
    const res = compute(x);
    const factor = Math.pow(0.9, -0.5);
    expect(res.demandFactor).toBeCloseTo(factor, 12);
    const priceDollars = (factor - 1) * 20; // 20 of the 100 dollars move
    expect(res.extraStreams!.find((s) => s.id === "price")!.dollars).toBeCloseTo(priceDollars, 12);
    expect(val(res.b!, "extra_retained")).toBeCloseTo(0.3 * 0.9 * priceDollars, 12);
    expect(val(res.b!, "extra_sales_tax")).toBeCloseTo(0.05 * 0.9 * priceDollars, 12);
    expect(val(res.b!, "extra_store_margin")).toBe(0); // all of it is bought in grocery stores
    expect(res.netA).toBeCloseTo(compute({ ...BASE, priceRatio: 0.9 }).netA, 12); // A never counts new demand
    // A higher grocery price buys less wine, and the state loses on the lost volume.
    const dearer = compute({ ...B_ON, priceRatio: 1.1, elasticity: -0.5 });
    expect(dearer.demandFactor!).toBeLessThan(1);
    expect(dearer.netB!).toBeLessThan(dearer.netA);
    // Perfectly inelastic demand, or no elasticity, changes nothing.
    expect(compute({ ...x, elasticity: 0 }).netB).toBeCloseTo(compute({ ...x, elasticity: null }).netB!, 12);
    expect(compute({ ...x, elasticity: 0 }).demandFactor).toBeNull();
  });
  it("prices excise on the price-response gallons", () => {
    const x = { ...B_ON, revenueMode: "excise" as const, retained: null, excise: 2, priceRatio: 0.9, elasticity: -0.5 };
    const res = compute(x);
    const gallons = (Math.pow(0.9, -0.5) - 1) * 10 * 0.2;
    expect(val(res.b!, "extra_excise")).toBeCloseTo(2 * gallons, 12);
  });
  it("adds recaptured wine as new state revenue without displacing beer", () => {
    const viaState = compute({ ...BASE, extra: true, growth: 0, extraGrocery: 0, recapture: 0.1 });
    // $10 of wine now bought across the border, all from state stores: margin 5 + tax 0.5 - operating cost 1.
    expect(viaState.netB! - viaState.netA).toBeCloseTo(5 + 0.5 - 1, 12);
    const viaGrocery = compute({ ...BASE, extra: true, growth: 0, extraGrocery: 1, recapture: 0.1 });
    expect(viaGrocery.netB! - viaGrocery.netA).toBeCloseTo(3 + 0.5, 12);
    expect(viaGrocery.extraStreams!.map((s) => s.id)).toEqual(["access", "recapture"]);
    const sub = compute({ ...BASE, extra: true, growth: 0, extraGrocery: 1, recapture: 0.1, substitution: true, replaces: 1, basis: "spending", beerPrice: 5, beerTax: 31 });
    expect(sub.beer).toMatchObject({ dollars: 0, gallons: 0 }); // recapture is not new drinking
    expect(sub.netB! - sub.netA).toBeCloseTo(3.5, 12);
  });
  it("keeps the three sources of extra wine additive and separate", () => {
    const common = { ...BASE, priceRatio: 0.9, extra: true, extraGrocery: 0.5 };
    const delta = (patch: Partial<ScenarioInputs>) => {
      const r = compute({ ...common, growth: 0, elasticity: null, recapture: null, ...patch });
      return r.netB! - r.netA;
    };
    const all = delta({ growth: 0.1, elasticity: -0.5, recapture: 0.05 });
    expect(all).toBeCloseTo(delta({ growth: 0.1 }) + delta({ elasticity: -0.5 }) + delta({ recapture: 0.05 }), 10);
  });
});
