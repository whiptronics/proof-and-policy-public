import { describe, expect, it } from "vitest";
import { WORKED_PROPOSALS, breakEvenLever, compute, stepsA, type ScenarioInputs } from "./scenario";
import { SENSITIVITY_RANGES, sensitivity, zeroCrossing } from "./scenarioRanges";

// Round numbers so every result can be checked by hand: $1,000,000 of wine at a 50% margin, 30% moves.
const W: ScenarioInputs = {
  wineSales: 1_000_000,
  wineGallons: null,
  grossMargin: 0.5,
  salesTax: 0.05,
  avoidableCost: 0.05,
  newCosts: 10_000,
  shift: 0.3,
  priceRatio: 1,
  revenueMode: "wholesale",
  retained: null,
  excise: null,
  adValorem: null,
  discount: 0.2,
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
const RATES = { school: 0.1, enforcement: 0.01695 };

describe("wholesale arrangement by hand", () => {
  it("keeps the margin less the discount on the wine that moves", () => {
    const r = compute(W);
    expect(r.missing).toEqual([]);
    expect(r.baselineTotal).toBe(550_000); // 0.5 x 1,000,000 + 0.05 x 1,000,000
    expect(r.a.find((c) => c.id === "wholesale")!.value).toBeCloseTo(90_000, 6); // (0.5 - 0.2) x 300,000
    expect(r.aRevenue).toBeCloseTo(490_000, 6); // 350,000 + 90,000 + 50,000
    expect(r.netA).toBeCloseTo(-55_000, 6); // -0.2 x 300,000 + 0.05 x 300,000 - 10,000
    expect(r.perShiftedDollar).toBeCloseTo(-0.15, 12);
    expect(r.breakEvenDiscount.value).toBeCloseTo(0.2 - 55_000 / 300_000, 12); // 1.67%
  });
  it("lets the gross margin cancel when prices do not change", () => {
    expect(compute({ ...W, grossMargin: 0.3 }).netA).toBeCloseTo(compute(W).netA, 6);
    // ... but not when the grocery price differs: sales tax then changes.
    expect(compute({ ...W, priceRatio: 0.9 }).netA).toBeCloseTo(-55_000 + 0.05 * -0.1 * 300_000, 6);
  });
  it("needs the discount, and keeps it a share", () => {
    expect(compute({ ...W, discount: null }).missing).toContain("discount DABS gives grocers");
    expect(compute({ ...W, discount: 1.2 }).invalid.join(" ")).toMatch(/Discount DABS gives grocers/);
  });
});

describe("scenario A step by step", () => {
  it("adds up to the net change, and the allocation rows split the margin without being added again", () => {
    for (const x of [W, { ...W, revenueMode: "keep" as const, retained: 0.25, discount: null }, { ...W, priceRatio: 0.9 }]) {
      const r = compute(x);
      const steps = stepsA(x, r, RATES);
      const added = steps.filter((s) => s.part === "step").reduce((a, s) => a + s.value, 0);
      expect(added).toBeCloseTo(r.netA, 6);
      expect(steps.find((s) => s.part === "total")!.value).toBe(r.netA);
      const of = steps.filter((s) => s.part === "of").reduce((a, s) => a + s.value, 0);
      expect(of).toBeCloseTo(0.5 * 300_000, 6); // the margin that moves, no more
    }
    const s = stepsA(W, compute(W), RATES);
    expect(s.find((x) => x.id === "of_school")!.value).toBeCloseTo(30_000, 6); // 10% of 300,000
    expect(s.find((x) => x.id === "of_enforcement")!.value).toBeCloseTo(5_085, 6); // 1.695% of 300,000
    expect(stepsA(W, compute(W)).some((x) => x.part === "of")).toBe(false); // no rates: no allocation rows
  });
});

describe("break-even lever", () => {
  it("matches the closed forms for scenario A", () => {
    expect(breakEvenLever(W, "A")!.value).toBeCloseTo(compute(W).breakEvenDiscount.value!, 9);
    const keep = { ...W, revenueMode: "keep" as const, retained: 0.25, discount: null };
    expect(breakEvenLever(keep, "A")!.value).toBeCloseTo(compute(keep).breakEvenRetained.value!, 9);
  });
  it("includes the extra purchases and the price response in scenario B", () => {
    const b = { ...W, extra: true, growth: 0.05, extraGrocery: 1, priceRatio: 0.9, elasticity: -0.46 };
    const lv = breakEvenLever(b, "B")!;
    expect(lv.lever).toBe("discount");
    expect(compute({ ...b, discount: lv.value }).netB).toBeCloseTo(0, 4);
    expect(breakEvenLever({ ...W, revenueMode: "combo" }, "A")).toBeNull(); // several levers: no single answer
  });
});

describe("where the result changes sign", () => {
  it("finds the avoidable cost at which scenario A breaks even, and says whether it is inside the range", () => {
    // net = (-0.2 + v) x 300,000 - 10,000 = 0 at v = 0.2 + 1/30 = 0.2333, outside the +-5 point range.
    const z = zeroCrossing(W, "avoidableCost", "A", { low: 0, high: 0.1 })!;
    expect(z.value).toBeCloseTo(0.2 + 10_000 / 300_000, 9);
    expect(z.inRange).toBe(false);
    const d = sensitivity(W, "A").find((s) => s.input === "discount")!;
    expect(d.zero!.value).toBeCloseTo(0.2 - 55_000 / 300_000, 9);
    expect(SENSITIVITY_RANGES.discount.half).toBe(0.05);
    // The gross margin cancels: no value of it changes the sign.
    expect(sensitivity(W, "A").find((s) => s.input === "grossMargin")!.zero).toBeNull();
    // A grocery price 4.3 times the state store's would break even through sales tax; it is beyond reach, so not reported.
    expect(sensitivity(W, "A").find((s) => s.input === "priceRatio")!.zero).toBeNull();
  });
});

describe("the worked proposal", () => {
  const p = WORKED_PROPOSALS[0];
  it("states every part of the policy and its standing", () => {
    expect(p.values.rm).toBe("wholesale");
    expect(p.proposal.map((q) => q.item)).toEqual(["What changes", "Who supplies the wine", "Prices", "Which purchases move", "Costs", "Earmarks", "Baseline", "Sales tax"]);
    expect(p.cannotEstablish.length).toBeGreaterThan(0);
  });
  it("gives the hand-checkable FY2025 result", () => {
    // FY2025 DABS liquor sales $551,346,000 and gross profit $260,289,000 (FY2025 report p. 32); wine 33.5% of sales.
    const x: ScenarioInputs = {
      ...W,
      wineSales: 551_346_000 * 0.335,
      grossMargin: 260_289_000 / 551_346_000,
      salesTax: Number(p.values.st) / 100,
      avoidableCost: Number(p.values.vc) / 100,
      newCosts: Number(p.values.nc),
      shift: Number(p.values.s) / 100,
      priceRatio: Number(p.values.r) / 100,
      discount: Number(p.values.dc) / 100,
    };
    const r = compute(x);
    const shifted = 551_346_000 * 0.335 * 0.3; // $55,410,273
    expect(shifted).toBeCloseTo(55_410_273, 0);
    expect(r.netA).toBeCloseTo(-0.15 * shifted - 500_000, 2); // -$8,811,541
    expect(r.breakEvenDiscount.value).toBeCloseTo(0.05 - 500_000 / shifted, 9); // 4.10%
  });
});
