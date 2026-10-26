import { describe, expect, it } from "vitest";
import { compute, type ScenarioInputs } from "./scenario";
import { DEFAULT_CORRELATIONS, SENSITIVITY_RANGES, combinedScenarios, monteCarlo, rangeFor, sensitivity, simulateInputs, withLevel, type RangeKey } from "./scenarioRanges";

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
const corr = (a: number[], b: number[]) => {
  const n = a.length;
  const ma = a.reduce((s, v) => s + v, 0) / n;
  const mb = b.reduce((s, v) => s + v, 0) / n;
  let sab = 0;
  let saa = 0;
  let sbb = 0;
  for (let i = 0; i < n; i++) {
    sab += (a[i] - ma) * (b[i] - mb);
    saa += (a[i] - ma) ** 2;
    sbb += (b[i] - mb) ** 2;
  }
  return sab / Math.sqrt(saa * sbb);
};
const pct = (v: number[], p: number) => [...v].sort((a, b) => a - b)[Math.floor(p * (v.length - 1))];

describe("documented ranges", () => {
  it("states a basis for every range and marks only the elasticity as published", () => {
    for (const [k, spec] of Object.entries(SENSITIVITY_RANGES)) {
      expect(spec.basis.length, k).toBeGreaterThan(20);
      expect(spec.half, k).toBeGreaterThan(0);
    }
    const published = Object.entries(SENSITIVITY_RANGES).filter(([, s]) => s.evidence === "published");
    expect(published.map(([k]) => k)).toEqual(["elasticity"]);
    expect(SENSITIVITY_RANGES.elasticity.basis).toMatch(/Nelson/);
  });
  it("sizes each range to its input instead of one width for all", () => {
    const tax = rangeFor(BASE, "salesTax")!;
    expect([tax.low, tax.high]).toEqual([expect.closeTo(0.04, 12), expect.closeTo(0.06, 12)]); // not 0% to 15%
    const price = rangeFor(BASE, "priceRatio")!;
    expect(price.low).toBeCloseTo(1 / 1.1, 12);
    expect(price.high).toBeCloseTo(1.1, 12);
    const e = rangeFor({ ...BASE, elasticity: -0.46 }, "elasticity")!;
    expect([e.low, e.high]).toEqual([expect.closeTo(-0.61, 12), expect.closeTo(-0.31, 12)]);
    // Shares are cut at their limits in the table, and kept raw for the simulation.
    const shift = rangeFor({ ...BASE, shift: 0.05 }, "shift")!;
    expect(shift.low).toBe(0);
    expect(shift.rawLow).toBeCloseTo(-0.05, 12);
  });
  it("accepts evidence in place of a convention", () => {
    const r = rangeFor(BASE, "avoidableCost", { avoidableCost: { low: 0.02, high: 0.12, basis: "regression interval" } })!;
    expect([r.low, r.high]).toEqual([0.02, 0.12]);
    expect(r.evidence).toBe("data");
    expect(r.basis).toBe("regression interval");
    const s = sensitivity(BASE, "A", { avoidableCost: { low: 0.02, high: 0.12 } }).find((z) => z.input === "avoidableCost")!;
    expect([s.low, s.high]).toEqual([0.02, 0.12]);
  });
  it("returns no range for an input with nothing to vary", () => {
    expect(rangeFor({ ...BASE, newCosts: 0 }, "newCosts")).toBeNull(); // a relative range on zero is zero
    expect(rangeFor({ ...BASE, retained: null }, "retained")).toBeNull();
  });
});

describe("sensitivity covers the inputs the old table left out", () => {
  const FULL: ScenarioInputs = {
    ...BASE,
    newCosts: 1,
    revenueMode: "combo",
    excise: 1,
    adValorem: 0.02,
    extra: true,
    growth: 0.1,
    extraGrocery: 0.5,
    substitution: true,
    replaces: 0.5,
    basis: "ethanol",
    beerPrice: 5,
    beerTax: 31,
    wineAbv: 0.12,
    beerAbv: 0.048,
    priceRatio: 0.95,
    passThrough: 0.8,
    elasticity: -0.46,
    recapture: 0.02,
  };
  it("lists new costs, beer excise, both alcohol contents and the price terms", () => {
    const keys = sensitivity(FULL, "B").map((s) => s.input);
    for (const k of ["newCosts", "beerTax", "wineAbv", "beerAbv", "volume", "pricePerGallon", "passThrough", "elasticity", "recapture", "growth"] as RangeKey[]) expect(keys, k).toContain(k);
    expect(keys).not.toContain("wineSales"); // gallons are in play, so sales are split into volume and price
    // Scenario A leaves out the inputs only scenario B uses.
    const a = sensitivity(FULL, "A").map((s) => s.input);
    for (const k of ["growth", "elasticity", "recapture", "beerTax", "wineAbv"] as RangeKey[]) expect(a, k).not.toContain(k);
  });
  it("varies sales and gallons together, or the price alone, never one by accident", () => {
    const vol = withLevel(FULL, "volume", 12);
    expect([vol.wineGallons, vol.wineSales]).toEqual([12, 120]); // price per gallon held at $10
    const px = withLevel(FULL, "pricePerGallon", 11);
    expect([px.wineGallons, px.wineSales]).toEqual([10, 110]);
    const rows = sensitivity(FULL, "B");
    const v = rows.find((s) => s.input === "volume")!;
    expect(v.low).toBeCloseTo(10 / 1.15, 12);
    expect(v.high).toBeCloseTo(11.5, 12);
    const p = rows.find((s) => s.input === "pricePerGallon")!;
    expect(p.low).toBeCloseTo(10 / 1.15, 12);
  });
  it("uses a single sales row when gallons do not matter", () => {
    const keys = sensitivity(BASE, "A").map((s) => s.input);
    expect(keys).toContain("wineSales");
    expect(keys).not.toContain("volume");
  });
  it("ranks by swing and carries each range's basis", () => {
    const rows = sensitivity(FULL, "B");
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1].swing).toBeGreaterThanOrEqual(rows[i].swing);
    expect(rows.every((r) => r.basis.length > 0 && ["published", "data", "convention"].includes(r.evidence))).toBe(true);
    expect(sensitivity({ ...BASE, shift: null }, "A")).toEqual([]);
  });
});

describe("combined sensitivity scenarios (shown instead of the simulation)", () => {
  it("sets every varied input to the end that lowers, or raises, the result, and brackets the one-at-a-time table", () => {
    const x: ScenarioInputs = { ...BASE, newCosts: 5 };
    const sens = sensitivity(x, "A");
    const c = combinedScenarios(x, "A")!;
    expect(c).not.toBeNull();
    for (const s of sens) {
      expect(c.low.net).toBeLessThanOrEqual(Math.min(s.netLow, s.netHigh) + 1e-9);
      expect(c.high.net).toBeGreaterThanOrEqual(Math.max(s.netLow, s.netHigh) - 1e-9);
    }
    // The settings listed are the ones used: applying them reproduces the net change.
    let y: ScenarioInputs = x;
    for (const st of c.low.settings) y = withLevel(y, st.key, st.value);
    expect(compute(y).netA).toBeCloseTo(c.low.net, 9);
    expect(c.low.settings.length).toBe(sens.filter((s) => s.netLow !== s.netHigh).length);
  });
  it("uses bounds from data when given, and returns nothing for an incomplete scenario", () => {
    const c = combinedScenarios(BASE, "A", { avoidableCost: { low: 0, high: 0.15 } })!;
    expect(c.low.settings.find((s) => s.key === "avoidableCost")!.value).toBe(0);
    expect(c.high.settings.find((s) => s.key === "avoidableCost")!.value).toBe(0.15);
    expect(combinedScenarios({ ...BASE, wineSales: null }, "A")).toBeNull();
  });
});

describe("monte carlo draws", () => {
  it("reproduces the documented range as its 10th to 90th percentile, centred on the entered value", () => {
    const { draws } = simulateInputs({ ...BASE, shift: 0.4 }, { runs: 20000, seed: 7 });
    const shift = draws.map((d) => d.shift!);
    expect(pct(shift, 0.1)).toBeCloseTo(0.3, 2);
    expect(pct(shift, 0.5)).toBeCloseTo(0.4, 2);
    expect(pct(shift, 0.9)).toBeCloseTo(0.5, 2);
    const margin = draws.map((d) => d.grossMargin!);
    expect(pct(margin, 0.1)).toBeCloseTo(0.4, 2);
    const price = draws.map((d) => d.priceRatio!);
    expect(pct(price, 0.1)).toBeCloseTo(1 / 1.1, 2);
    expect(pct(price, 0.9)).toBeCloseTo(1.1, 2);
  });
  it("keeps shares inside 0-100% by truncating instead of piling up at the edge", () => {
    const { draws } = simulateInputs({ ...BASE, shift: 0.02, retained: 0.97 }, { runs: 5000, seed: 3 });
    expect(draws.every((d) => d.shift! >= 0 && d.shift! <= 1 && d.retained! >= 0 && d.retained! <= 1)).toBe(true);
    expect(draws.filter((d) => d.shift === 0).length).toBe(0);
  });
  it("makes a cheaper grocery price go with a bigger shift", () => {
    const { draws, correlations } = simulateInputs({ ...BASE, shift: 0.4 }, { runs: 20000, seed: 11 });
    expect(correlations).toEqual([["priceRatio", "shift", -0.5]]); // growth is not varied in scenario A
    const r = corr(draws.map((d) => d.priceRatio!), draws.map((d) => d.shift!));
    expect(r).toBeLessThan(-0.42);
    expect(r).toBeGreaterThan(-0.56);
    const indep = simulateInputs({ ...BASE, shift: 0.4 }, { runs: 20000, seed: 11, correlations: [] });
    expect(Math.abs(corr(indep.draws.map((d) => d.priceRatio!), indep.draws.map((d) => d.shift!)))).toBeLessThan(0.03);
  });
  it("applies every stated dependence when the inputs it joins are both uncertain", () => {
    const x = { ...BASE, shift: 0.4, extra: true, growth: 0.1, extraGrocery: 0.5 };
    const { draws, correlations } = simulateInputs(x, { runs: 20000, seed: 5 });
    expect(correlations).toEqual(DEFAULT_CORRELATIONS);
    expect(corr(draws.map((d) => d.shift!), draws.map((d) => d.growth!))).toBeGreaterThan(0.2);
  });
  it("refuses correlations that cannot all hold at once", () => {
    const x = { ...BASE, extra: true, growth: 0.1, extraGrocery: 0.5 };
    expect(() =>
      simulateInputs(x, {
        runs: 10,
        correlations: [
          ["priceRatio", "shift", -0.9],
          ["shift", "growth", 0.9],
          ["priceRatio", "growth", 0.9],
        ],
      }),
    ).toThrow(/jointly possible/);
  });
});

describe("monte carlo results", () => {
  it("is reproducible and moves with the seed", () => {
    const a = monteCarlo(BASE, { runs: 500 })!;
    const b = monteCarlo(BASE, { runs: 500 })!;
    expect(a).toEqual(b);
    expect(monteCarlo(BASE, { runs: 500, seed: 1 })!.a.median).not.toBe(monteCarlo(BASE, { runs: 500, seed: 2 })!.a.median);
    expect(monteCarlo({ ...BASE, shift: 0.3 }, { runs: 500 })!.seed).not.toBe(a.seed); // the default seed comes from the inputs
  });
  it("collapses to the point answer when there is no uncertainty", () => {
    const r = monteCarlo(BASE, { runs: 200, scale: 0 })!;
    expect(r.a.median).toBeCloseTo(-2, 10);
    expect(r.a.p10).toBeCloseTo(-2, 10);
    expect(r.a.p90).toBeCloseTo(-2, 10);
    expect(r.a.shareUp).toBe(0);
    expect(r.b).toBeNull();
  });
  it("reports the share of runs in which revenue rises, with its own sampling error", () => {
    const up = monteCarlo({ ...BASE, retained: 0.95 }, { runs: 2000 })!; // every moved dollar gains, whatever the draw
    expect(up.a.shareUp).toBe(1);
    expect(up.a.shareUpSe).toBe(0);
    const even = monteCarlo({ ...BASE, retained: 0.4 }, { runs: 4000 })!; // centred on break-even
    expect(even.a.shareUp).toBeGreaterThan(0.3);
    expect(even.a.shareUp).toBeLessThan(0.7);
    expect(even.a.shareUpSe).toBeCloseTo(Math.sqrt((even.a.shareUp * (1 - even.a.shareUp)) / 4000), 12);
    expect(even.a.p10).toBeLessThan(even.a.median);
    expect(even.a.median).toBeLessThan(even.a.p90);
  });
  it("adds scenario B only when it is on, from the same draws", () => {
    const b = monteCarlo({ ...BASE, extra: true, growth: 0.1, extraGrocery: 1, elasticity: -0.46, priceRatio: 0.95 }, { runs: 1000 })!;
    expect(b.b).not.toBeNull();
    expect(b.inputs.map((i) => i.key)).toEqual(expect.arrayContaining(["growth", "elasticity", "priceRatio", "shift"]));
    expect(b.inputs.find((i) => i.key === "elasticity")!.evidence).toBe("published");
  });
  it("returns nothing for an incomplete scenario", () => {
    expect(monteCarlo({ ...BASE, wineSales: null })).toBeNull();
  });
});
