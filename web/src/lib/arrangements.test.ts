import { describe, expect, it } from "vitest";
import { ARRANGEMENTS_METHOD, COMPARISON_FIELDS, arrangementInputs, compare, jointScenarios, priceBuildUp, replacementOf, settingsFromFields, solveLever, sweep, withMechanisms, zerosOf, type ArrangementSettings, type Bounds } from "./arrangements";
import { WORKED_PROPOSALS, compute, type ScenarioInputs } from "./scenario";

// Round numbers so every result can be checked by hand: $1,000,000 of wine at a 50% margin, 30% moves, no price change.
const BASE: ScenarioInputs = {
  wineSales: 1_000_000,
  wineGallons: 20_000, // $50 a gallon
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
const RATES = { school: 0.1, enforcement: 0.01695 };

describe("each arrangement by hand (channel shift only)", () => {
  const c = compare(BASE, SET, RATES);
  it("needs nothing more and reports the method", () => {
    expect(c.missing).toEqual([]);
    expect(c.invalid).toEqual([]);
    expect(c.method).toBe(ARRANGEMENTS_METHOD);
    expect(c.headline).toBe("shift");
  });
  it("private retail: the whole margin goes, the tax comes back, and the tax reaches the shelf price", () => {
    const l = c.private.lines!;
    expect(l.baselineRevenue).toBe(550_000);
    expect(l.marginDisplaced).toBeCloseTo(-150_000, 6);
    expect(l.replacement).toBeCloseTo(60_000, 6); // 20% of $300,000 at the price before tax
    expect(l.salesTaxChange).toBeCloseTo(3_000, 6); // 5% x (1.2 - 1) x 300,000: the tax is in the shelf price
    expect(l.proposedRevenue).toBeCloseTo(463_000, 6);
    expect(l.net).toBeCloseTo(-82_000, 6); // -150,000 + 60,000 + 3,000 + 15,000 - 10,000
    expect(l.proposedRevenue - l.baselineRevenue + l.costsAvoided - l.newCosts).toBeCloseTo(l.net, 6);
    expect(l.baselineRevenue + l.marginDisplaced + l.replacement + l.salesTaxChange).toBeCloseTo(l.proposedRevenue, 6);
    expect(c.private.price!.shelf).toBeCloseTo(1.2, 12);
    expect(c.private.price!.withSalesTax).toBeCloseTo(1.26, 12);
    // Break-even without a price response: -145,000 + 315,000 a = 0.
    expect(c.private.breakEven.status).toBe("found");
    expect(c.private.breakEven.value).toBeCloseTo(145_000 / 315_000, 6);
  });
  it("state wholesale: receipts and the cost of the wine apart, the grocer's margin apart from the state's", () => {
    const l = c.wholesale.lines!;
    expect(l.wholesaleReceipts).toBeCloseTo(240_000, 6); // 80% of $300,000
    expect(l.acquisitionCost).toBeCloseTo(150_000, 6);
    expect(l.replacement).toBeCloseTo(l.wholesaleReceipts! - l.acquisitionCost!, 6);
    expect(l.net).toBeCloseTo(-55_000, 6); // -0.2 x 300,000 + 15,000 - 10,000
    expect(c.wholesale.price!.retailerMargin).toBeCloseTo(0.2, 12); // shelf 1.00 less 0.80 paid to DABS
    expect(c.wholesale.breakEven.value).toBeCloseTo(0.05 - 10_000 / 300_000, 6);
  });
  it("the wholesale arrangement agrees with the scenario tool's own wholesale mode", () => {
    const own = compute({ ...BASE, revenueMode: "wholesale", discount: 0.2 });
    expect(c.wholesale.lines!.net).toBeCloseTo(own.netA, 6);
  });
  it("without the tax in the price, the private arrangement agrees with the tool's percent mode", () => {
    const c0 = compare(BASE, { ...SET, taxToPrice: 0 }, RATES);
    expect(c0.private.lines!.net).toBeCloseTo(compute({ ...BASE, revenueMode: "percent", adValorem: 0.2 }).netA, 6);
  });
  it("counts the wholesaling the state also stops only in arrangement 1", () => {
    const c2 = compare(BASE, { ...SET, wholesaleCost: 0.02 }, RATES);
    expect(c2.private.lines!.costsAvoided).toBeCloseTo(0.07 * 300_000, 6);
    expect(c2.wholesale.lines!.costsAvoided).toBeCloseTo(0.05 * 300_000, 6);
  });
});

describe("zero-change behaviour", () => {
  it("nothing moves and nothing is added: no change in either arrangement", () => {
    const c = compare({ ...BASE, shift: 0, newCosts: 0 }, SET, RATES);
    expect(c.private.lines!.net).toBeCloseTo(0, 9);
    expect(c.wholesale.lines!.net).toBeCloseTo(0, 9);
    expect(c.earmarked!.allocation.total).toBeCloseTo(0, 9);
  });
  it("a discount equal to the avoidable cost, or a tax that replaces the margin, leaves revenue unchanged", () => {
    const b = { ...BASE, newCosts: 0 };
    expect(compare(b, { ...SET, discount: 0.05 }, RATES).wholesale.lines!.net).toBeCloseTo(0, 6);
    // Tax fully in the price: -m + a + t a + v = 0 at a = (m - v) / (1 + t).
    expect(compare(b, { ...SET, taxRate: 0.45 / 1.05 }, RATES).private.lines!.net).toBeCloseTo(0, 6);
  });
});

describe("purchases: the channel shift first, then each mechanism on its own", () => {
  const B: ScenarioInputs = { ...BASE, extra: true, growth: 0.05, extraGrocery: 0.5, elasticity: -0.5, recapture: 0.02 };
  const c = compare(B, SET, RATES);
  it("adds up: the parts of each mechanism sum to the whole", () => {
    expect(c.headline).toBe("all");
    for (const a of [c.private, c.wholesale]) {
      const sum = a.mechanisms.reduce((s, m) => s + (m.net ?? 0), 0);
      expect(a.lines!.net + sum).toBeCloseTo(a.netAll!, 6);
      expect(a.mechanisms.every((m) => m.entered)).toBe(true);
    }
  });
  it("conserves volume: the channel shift moves wine without adding any, and the total reconciles to the parts", () => {
    for (const a of [c.private, c.wholesale]) {
      const v0 = a.volumeShift!;
      expect(v0.total).toBeCloseTo(1_000_000, 6);
      expect(v0.grocery).toBeCloseTo(300_000, 6);
      const v = a.volumeAll!;
      const parts = a.mechanisms.reduce((s, m) => s + (m.dollars ?? 0), 0);
      expect(v.total).toBeCloseTo(1_000_000 + parts, 6);
      expect(v.state + v.grocery).toBeCloseTo(v.total, 6);
    }
    // Recapture and access are the same in both; the price response differs because the shelf prices differ.
    const rp = c.private.mechanisms.find((m) => m.id === "recapture")!;
    expect(rp.dollars).toBeCloseTo(20_000, 6);
    const pp = c.private.mechanisms.find((m) => m.id === "price")!;
    expect(pp.dollars).toBeCloseTo((Math.pow(1.2, -0.5) - 1) * 300_000, 6); // fewer bottles at the taxed price
    expect(c.wholesale.mechanisms.find((m) => m.id === "price")!.dollars).toBeCloseTo(0, 9); // price unchanged
  });
  it("accounts for recapture by channel, at each channel's own revenue", () => {
    // Recapture alone in the wholesale arrangement: $20,000 of wine, half from state stores, half via DABS to grocers.
    const x = withMechanisms(arrangementInputs(B, SET, "wholesale"), { recapture: true }, B);
    const r = compute(x);
    const byHand = 10_000 * 0.5 + 10_000 * (0.5 - 0.2) + 0.05 * 20_000 - 0.05 * 10_000;
    expect(r.netB! - r.netA).toBeCloseTo(byHand, 6);
  });
  it("leaves beer substitution out of the comparison", () => {
    const withBeer = { ...B, substitution: true, replaces: 0.5, basis: "spending" as const, beerPrice: 10, beerTax: 11 };
    expect(compare(withBeer, SET, RATES).private.netAll).toBeCloseTo(c.private.netAll!, 6);
  });
  it("solves the break-even tax with the price response included", () => {
    const be = c.private.breakEven;
    expect(be.basis).toBe("all");
    expect(be.status).toBe("found");
    const x = withMechanisms(arrangementInputs(B, { ...SET, taxRate: be.value }, "private"), { price: true, recapture: true, access: true }, B);
    expect(compute(x).netB!).toBeCloseTo(0, 3);
    // Higher than without the response: the tax lowers what is bought.
    expect(be.value!).toBeGreaterThan(compare({ ...B, elasticity: null }, SET, RATES).private.breakEven.value!);
  });
  it("says when no tax in the supported range breaks even, and gives the best it can do", () => {
    const steep = { ...B, elasticity: -3, growth: 0, recapture: null };
    const be = compare(steep, SET, RATES).private.breakEven;
    expect(be.status).toBe("none_in_range");
    expect(be.value).toBeNull();
    expect(be.best!.value).toBeLessThan(0);
  });
});

describe("arrangement 3: allocating the proceeds", () => {
  it("keeps today's amounts for the two funds out of the proceeds; the total is unchanged", () => {
    const e = compare(BASE, SET, RATES).earmarked!;
    expect(e.today.school).toBeCloseTo(30_000, 6);
    expect(e.today.enforcement).toBeCloseTo(5_085, 6);
    expect(e.proceeds).toBeCloseTo(60_000, 6);
    expect(e.requirement).toBe(0);
    expect(e.remainder).toBeCloseTo(24_915, 6);
    expect(e.fundsChange).toBeCloseTo(0, 6);
    expect(e.fundsChange + e.othersChange).toBeCloseTo(-82_000, 6);
    expect(e.coverLever!.value).toBeCloseTo(0.11695, 9); // the tax at which the proceeds just cover it
  });
  it("shows a funding requirement when the guarantee exceeds the proceeds", () => {
    const e = compare(BASE, { ...SET, taxRate: 0.05 }, RATES).earmarked!;
    expect(e.proceeds).toBeCloseTo(15_000, 6);
    expect(e.requirement).toBeCloseTo(20_085, 6);
    const a = compare(BASE, { ...SET, earmarkRule: "amount", earmarkValue: 100_000 }, RATES).earmarked!;
    expect(a.requirement).toBeCloseTo(40_000, 6);
    expect(a.allocation.school + a.allocation.enforcement).toBeCloseTo(100_000, 6);
    expect(a.fundsChange + a.othersChange).toBeCloseTo(-82_000, 6);
    const s = compare(BASE, { ...SET, earmarkRule: "share", earmarkValue: 0.5, earmarkBase: "wholesale" }, RATES).earmarked!;
    expect(s.allocation.total).toBeCloseTo(45_000, 6);
    expect(s.requirement).toBe(0);
  });
  it("needs the deposit rates and the value its rule uses", () => {
    expect(compare(BASE, SET, null).missing.join(" ")).toMatch(/deposit rates/);
    expect(compare(BASE, { ...SET, earmarkRule: "amount" }, RATES).missing.join(" ")).toMatch(/amount allocated/);
    expect(compare(BASE, { ...SET, taxRate: null, discount: null }, RATES).missing).toEqual(["replacement tax rate (arrangement 1)", "discount DABS gives grocers (arrangement 2)"]);
  });
});

describe("solving and sweeping", () => {
  it("bisects a sign change and reports none rather than extrapolating", () => {
    expect(solveLever((v) => v - 0.3, 0, 1).root).toBeCloseTo(0.3, 9);
    const none = solveLever((v) => -1 - v, 0, 1);
    expect(none.root).toBeNull();
    expect(none.best).toEqual({ at: 0, value: -1 });
  });
  it("crosses zero where the break-even says, for each arrangement", () => {
    const sw = sweep(BASE, SET, "avoidableCost");
    const z = zerosOf(sw.points, "wholesale");
    expect(z).toHaveLength(1);
    expect(z[0]).toBeCloseTo(0.2 + 10_000 / 300_000, 3); // net = (-0.2 + v) x 300,000 - 10,000
    const d = sweep(BASE, SET, "discount");
    expect(d.points.every((p) => p.private === null)).toBe(true);
  });
});

describe("the worked comparison", () => {
  const p = WORKED_PROPOSALS.find((w) => w.id === "compare_fy2025")!;
  it("restores from its address exactly", () => {
    const q = new URLSearchParams(new URLSearchParams(p.values).toString());
    const s1 = settingsFromFields((k) => p.values[k]);
    const s2 = settingsFromFields((k) => q.get(k));
    expect(s2).toEqual(s1);
    for (const k of Object.keys(p.values)) expect(["fy", "wr", "ws", "st", "vc", "nc", "s", "hh", "r", "rm", "dc", "b", "g", "q", "el", "rc", ...COMPARISON_FIELDS]).toContain(k);
    expect(s1.priceCase).toBe("matched");
    expect(s1.earmarkRule).toBe("fixed");
  });
  it("gives the hand-checkable FY2025 results", () => {
    // FY2025 DABS liquor sales $551,346,000 and gross profit $260,289,000; wine 33.5% of sales; households 82% of it;
    // 30% of household purchases move. Matched consumer prices: the shelf price is today's.
    const W = 551_346_000 * 0.335;
    const m = 260_289_000 / 551_346_000;
    const x: ScenarioInputs = { ...BASE, wineSales: W, wineGallons: null, grossMargin: m, salesTax: 0.0485, avoidableCost: 0.05, newCosts: 500_000, shift: 0.3, eligible: 0.82, priceRatio: 1, extra: true, growth: 0, extraGrocery: 1, elasticity: -0.46 };
    const s = settingsFromFields((k) => p.values[k]);
    const c = compare(x, s, RATES);
    const S = W * 0.82 * 0.3;
    expect(c.wholesale.lines!.net).toBeCloseTo(-0.15 * S - 500_000, 2); // the margin cancels: -discount + avoidable cost
    // The 20% tax is inside today's price: sellers' price 1/1.2, the tax 0.2/1.2 of it, no change in sales tax.
    expect(c.private.lines!.net).toBeCloseTo(S * (-m + 0.2 / 1.2 + 0.05) - 500_000, 2);
    expect(c.private.lines!.salesTaxChange).toBeCloseTo(0, 6);
    expect(c.private.netAll).toBeCloseTo(c.private.lines!.net, 2); // prices unchanged: the price response does nothing
    expect(c.private.channelReturn).toBeNull();
    expect(c.earmarked!.requirement).toBe(0);
    expect(c.earmarked!.allocation.total).toBeCloseTo(0.11695 * S, 2);
    // At matched prices the state breaks even only if sellers keep its avoided cost less the new costs, whatever the arrangement.
    const keep = 0.05 - 500_000 / S;
    expect(c.private.sellersAtBreakEven!.perDollar).toBeCloseTo(keep, 9);
    expect(c.wholesale.sellersAtBreakEven!.perDollar).toBeCloseTo(keep, 9);
    // At the entered levers: sellers keep 1/1.2 - (1 - m) in 1, the 20% discount in 2.
    expect(c.private.sellers!.perDollar).toBeCloseTo(1 / 1.2 - (1 - m), 12);
    expect(c.private.sellers!.grocer!.perDollar).toBeCloseTo(1 / 1.2 - (1 - m) / (1 - 0.295), 12);
    expect(c.wholesale.sellers!.margin).toBeCloseTo(0.2, 12);
    // Both sides hold, arrangement 1: sellers price at the cost grossed up by 29.5% and 28%, the tax solved on top.
    const own = (1 - m) / (0.705 * 0.72);
    const v1 = c.private.viability!.shift;
    expect(v1.ownPrice).toBeCloseTo(own, 12);
    expect(S * (-m + v1.lever! * own + 0.0485 * (own * (1 + v1.lever!) - 1) + 0.05) - 500_000).toBeCloseTo(0, 0);
    expect(v1.shelf).toBeCloseTo(own * (1 + v1.lever!), 9);
    // Arrangement 2: the grocer prices at (1 - d) / 0.72 and the state breaks even at that price.
    const v2 = c.wholesale.viability!.shift;
    expect(v2.shelf).toBeCloseTo((1 - v2.lever!) / 0.72, 9);
    expect(S * (-v2.lever! + 0.0485 * (v2.shelf! - 1) + 0.05) - 500_000).toBeCloseTo(0, 0);
    // The alternative price case: the tax on today's price, added to the shelf, and the price response.
    const alt = compare(x, { ...s, priceCase: "entered" }, RATES);
    expect(alt.private.lines!.net).toBeCloseTo(S * (-m + 0.2 + 0.0485 * 0.2 + 0.05) - 500_000, 2);
    const f = Math.pow(1.2, -0.46);
    expect(alt.earmarkedAll!.proceeds).toBeCloseTo(0.2 * S * f, 2);
    expect(alt.earmarkedAll!.othersChange).toBeCloseTo(alt.private.netAll!, 2);
    expect(alt.private.breakEven.status).toBe("found");
  });
});

describe("only household purchases move", () => {
  it("scales what moves by the household share and leaves the rest with DABS", () => {
    const c = compare({ ...BASE, eligible: 0.8 }, SET, RATES);
    const S = 1_000_000 * 0.8 * 0.3; // $240,000
    expect(c.wholesale.lines!.marginDisplaced).toBeCloseTo(-0.5 * S, 6);
    expect(c.wholesale.lines!.net).toBeCloseTo(-0.15 * S - 10_000, 6);
    expect(c.wholesale.volumeShift!.state).toBeCloseTo(1_000_000 - S, 6);
    expect(c.earmarked!.allocation.total).toBeCloseTo(0.11695 * S, 6);
    // Omitted, every sale counts (1.4); null is a missing input.
    expect(compare(BASE, SET, RATES).wholesale.lines!.marginDisplaced).toBeCloseTo(-150_000, 6);
    expect(compare({ ...BASE, eligible: null }, SET, RATES).missing.join(" ")).toMatch(/household share/);
    expect(compare({ ...BASE, eligible: 1.2 }, SET, RATES).invalid.join(" ")).toMatch(/Household share/);
  });
  it("the share of fixed new costs per dollar moved rises as fewer purchases can move", () => {
    const hi = compute({ ...BASE, revenueMode: "wholesale", discount: 0, eligible: 1 });
    const lo = compute({ ...BASE, revenueMode: "wholesale", discount: 0, eligible: 0.5 });
    expect(hi.breakEvenShift.value).toBeCloseTo(10_000 / (1_000_000 * 0.05), 9);
    expect(lo.breakEvenShift.value).toBeCloseTo(10_000 / (1_000_000 * 0.5 * 0.05), 9);
  });
});

describe("matched consumer prices and what sellers keep", () => {
  const M = { ...SET, priceCase: "matched" as const };
  const c = compare(BASE, M, RATES);
  it("keeps the shelf price at today's and puts the tax inside it", () => {
    expect(c.private.price!.shelf).toBeCloseTo(1, 12);
    expect(c.private.price!.beforeTax).toBeCloseTo(1 / 1.2, 12);
    expect(c.private.lines!.replacement).toBeCloseTo((0.2 / 1.2) * 300_000, 6);
    expect(c.private.lines!.salesTaxChange).toBeCloseTo(0, 9);
    expect(c.private.priceMoves).toBe(false);
    // An excise inside today's price: sellers' price falls by the excise per dollar.
    const e = compare({ ...BASE }, { ...M, taxKind: "excise", taxRate: 5 }, RATES); // $5 a gallon on $50 a gallon
    expect(e.private.price!.beforeTax).toBeCloseTo(0.9, 12);
    expect(e.private.sellers!.perDollar).toBeCloseTo(0.9 - 0.5, 12);
  });
  it("reports what sellers keep, and the grocer's part after a private wholesaler's margin", () => {
    const k = compare(BASE, { ...M, wholesalerMargin: 0.25, grocerMargin: 0.3 }, RATES).private.sellers!;
    expect(k.perDollar).toBeCloseTo(1 / 1.2 - 0.5, 12);
    expect(k.margin).toBeCloseTo((1 / 1.2 - 0.5) / (1 / 1.2), 12);
    expect(k.grocer!.perDollar).toBeCloseTo(1 / 1.2 - 0.5 / 0.75, 12);
    expect(k.dollars).toBeCloseTo(k.perDollar * 300_000, 6);
  });
  it("at the state's break-even lever, sellers keep exactly the avoided cost less the new costs per dollar moved", () => {
    const keep = 0.05 - 10_000 / 300_000;
    expect(c.private.sellersAtBreakEven!.perDollar).toBeCloseTo(keep, 9);
    expect(c.wholesale.sellersAtBreakEven!.perDollar).toBeCloseTo(keep, 9);
  });
  it("finds the price at which the state breaks even and sellers earn the margins entered", () => {
    const v = compare(BASE, { ...M, wholesalerMargin: 0.2, grocerMargin: 0.25 }, RATES);
    const own = 0.5 / (0.8 * 0.75);
    const p1 = v.private.viability!.shift;
    expect(p1.ownPrice).toBeCloseTo(own, 12);
    // -0.5 + a own + 0.05 (own (1 + a) - 1) + 0.05 - 10,000/300,000 = 0
    const a = (0.5 - 0.05 + 10_000 / 300_000 - 0.05 * (own - 1)) / (own * 1.05);
    expect(p1.lever).toBeCloseTo(a, 9);
    expect(p1.shelf).toBeCloseTo(own * (1 + a), 9);
    // Arrangement 2: -d + 0.05 ((1 - d)/0.75 - 1) + 0.05 - 10,000/300,000 = 0.
    const d = (0.05 * (1 / 0.75 - 1) + 0.05 - 10_000 / 300_000) / (1 + 0.05 / 0.75);
    expect(v.wholesale.viability!.shift.lever).toBeCloseTo(d, 9);
    expect(v.wholesale.viability!.shift.shelf).toBeCloseTo((1 - d) / 0.75, 9);
    // Without margins entered there is no such price.
    expect(c.private.viability).toBeNull();
    expect(compare(BASE, { ...M, grocerMargin: 0.25 }, RATES).private.viability!.shift.status).toBe("unavailable");
  });
  it("needs margins below 100%", () => {
    expect(compare(BASE, { ...M, grocerMargin: 1 }, RATES).invalid.join(" ")).toMatch(/grocer's margin/);
  });
});

describe("the guarantee: fixed or proportional", () => {
  const B: ScenarioInputs = { ...BASE, extra: true, growth: 0, extraGrocery: 1, elasticity: -0.5 };
  const c = compare(B, SET, RATES); // entered prices: the tax raises the grocery price 20%
  const fixed = c.guarantees.find((g) => g.rule === "fixed")!;
  const prop = c.guarantees.find((g) => g.rule === "proportional")!;
  const at = (g: typeof fixed, b: string) => g.cases.find((e) => e.basis === b)!;
  it("shows both proposals in every case, including the exploratory return to state stores", () => {
    expect(c.guarantees.map((g) => g.rule)).toEqual(["fixed", "proportional"]);
    for (const g of [fixed, prop]) expect(g.cases.map((e) => e.basis)).toEqual(["shift", "all", "return"]);
    expect(c.earmarkedReturn!.basis).toBe("return");
  });
  it("agree while the state stores lose the sales the scenario moves", () => {
    for (const b of ["shift", "all"]) {
      expect(at(fixed, b).lostSales).toBeCloseTo(300_000, 6);
      expect(at(prop, b).allocation.total).toBeCloseTo(at(fixed, b).allocation.total, 6);
    }
  });
  it("part when fewer buyers move: the fixed one overpays the two funds, the proportional one tracks the loss", () => {
    const f = Math.pow(1.2, -0.5);
    const rf = at(fixed, "return");
    const rp = at(prop, "return");
    expect(rf.lostSales).toBeCloseTo(300_000 * f, 6);
    expect(rf.allocation.total).toBeCloseTo(0.11695 * 300_000, 6);
    expect(rp.allocation.total).toBeCloseTo(0.11695 * 300_000 * f, 6);
    expect(rf.fundsChange).toBeCloseTo(0.11695 * 300_000 * (1 - f), 6);
    expect(rp.fundsChange).toBeCloseTo(0, 6);
    for (const e of [rf, rp]) expect(e.fundsChange + e.othersChange).toBeCloseTo(c.private.channelReturn!.net, 6);
    expect(rf.coverLever).toBeNull();
  });
  it("reads an older address's 'today' as the fixed guarantee", () => {
    expect(settingsFromFields((k) => ({ er: "today" })[k as "er"]).earmarkRule).toBe("fixed");
    expect(settingsFromFields((k) => ({ er: "proportional" })[k as "er"]).earmarkRule).toBe("proportional");
    expect(settingsFromFields(() => undefined).priceCase).toBe("entered");
  });
});

describe("arrangement 3 is shown consistently in both cases (the earlier mismatch)", () => {
  const B: ScenarioInputs = { ...BASE, extra: true, growth: 0, extraGrocery: 1, elasticity: -0.5 };
  const c = compare(B, SET, RATES);
  it("uses the channel-shift figures in one case and the purchase-change figures in the other, never mixed", () => {
    const e0 = c.earmarked!;
    const e1 = c.earmarkedAll!;
    expect(e0.basis).toBe("shift");
    expect(e1.basis).toBe("all");
    expect(e0.net).toBeCloseTo(c.private.lines!.net, 6);
    expect(e1.net).toBeCloseTo(c.private.netAll!, 6);
    for (const e of [e0, e1]) expect(e.fundsChange + e.othersChange).toBeCloseTo(e.net, 6);
    // The tax collected falls with the price response: fewer bottles at the taxed price.
    const f = Math.pow(1.2, -0.5);
    expect(e0.proceeds).toBeCloseTo(60_000, 6);
    expect(e1.proceeds).toBeCloseTo(60_000 * f, 6);
    // The guarantee is the same in both: today's statutory deposits on the wine that moves at today's prices.
    expect(e1.allocation.total).toBeCloseTo(e0.allocation.total, 9);
    expect(e0.allocation.total).toBeCloseTo((0.1 + 0.01695) * 300_000, 6);
  });
  it("solves the lever that covers the guarantee in each case, with the price response where it applies", () => {
    for (const e of [c.earmarked!, c.earmarkedAll!]) {
      const x = e.basis === "shift" ? c.private.x : c.private.xAll!;
      const covered = replacementOf(compute({ ...x, adValorem: e.coverLever!.value }), e.basis as "shift" | "all");
      expect(covered).toBeCloseTo(e.allocation.total, 2);
    }
    expect(c.earmarkedAll!.coverLever!.value).toBeGreaterThan(c.earmarked!.coverLever!.value);
  });
  it("a guarantee above the proceeds is a requirement on other funds, and the total does not move", () => {
    const small = compare(B, { ...SET, taxRate: 0.05 }, RATES);
    for (const e of [small.earmarked!, small.earmarkedAll!]) {
      expect(e.requirement).toBeCloseTo(e.allocation.total - e.proceeds, 6);
      expect(e.remainder).toBeCloseTo(-e.requirement, 6);
      expect(e.fundsChange).toBeCloseTo(0, 6);
      expect(e.othersChange).toBeCloseTo(e.net, 6);
    }
  });
});

describe("the price build-up", () => {
  const c = compare(BASE, SET, RATES);
  const lines = priceBuildUp(c);
  const at = (id: string) => lines.find((l) => l.id === id)!;
  it("adds up to the shelf price in each arrangement, and counts the state's margin once", () => {
    for (const k of ["today", "private", "wholesale"] as const) {
      const sum = at("cost")[k]! + at("state_margin")[k]! + at("private_margin")[k]! + at("replacement_tax")[k]!;
      expect(sum).toBeCloseTo(at("shelf")[k]!, 12);
      expect(at("consumer")[k]!).toBeCloseTo(at("shelf")[k]! * 1.05, 12);
    }
    expect(at("state_margin").today).toBeCloseTo(0.5, 12);
    expect(at("state_margin").private).toBe(0);
    expect(at("state_margin").wholesale).toBeCloseTo(0.3, 12); // 0.8 charged to grocers less 0.5 cost
    expect(at("private_margin").wholesale).toBeCloseTo(0.2, 12); // the grocer keeps 1.0 - 0.8
    expect(at("private_markup").wholesale).toBeCloseTo(0.25, 12); // 0.2 on its cost of 0.8
    expect(at("state_markup").today).toBeCloseTo(1, 12); // a 50% margin is a 100% markup
  });
  it("taxes the price before the replacement tax, and puts sales tax on the price with the tax in it", () => {
    const half = compare(BASE, { ...SET, taxToPrice: 0.5 }, RATES);
    expect(half.private.price!.shelf).toBeCloseTo(1.1, 12); // half of the 20% reaches the shelf
    expect(half.private.lines!.replacement).toBeCloseTo(0.2 * 1 * 300_000, 6); // the base is the price before tax
    expect(half.private.lines!.salesTaxChange).toBeCloseTo(0.05 * 0.1 * 300_000, 6);
    const l = priceBuildUp(half);
    expect(l.find((z) => z.id === "private_margin")!.private).toBeCloseTo(0.5 - 0.1, 12); // sellers absorb the other half
  });
});

describe("demand curves and the reading of the price response", () => {
  const B: ScenarioInputs = { ...BASE, extra: true, growth: 0, extraGrocery: 1, elasticity: -0.5 };
  it("a straight line with the same slope agrees for small price changes and buys less for large ones", () => {
    const x = withMechanisms(arrangementInputs(B, SET, "private"), { price: true }, B);
    expect(compute(x).demandFactor).toBeCloseTo(Math.pow(1.2, -0.5), 12);
    expect(compute({ ...x, demandForm: "linear" }).demandFactor).toBeCloseTo(1 - 0.5 * 0.2, 12);
    const small = { ...x, adValorem: 0.01 };
    expect(compute({ ...small, demandForm: "linear" }).demandFactor! - compute(small).demandFactor!).toBeCloseTo(0, 4);
    const c = compare(B, SET, RATES);
    expect(c.private.breakEvenLinear!.value!).toBeGreaterThan(c.private.breakEven.value!);
    const lin = withMechanisms(arrangementInputs(B, { ...SET, taxRate: c.private.breakEvenLinear!.value }, "private"), { price: true }, B);
    expect(compute({ ...lin, demandForm: "linear" }).netB!).toBeCloseTo(0, 3);
  });
  it("reads the price response as a return to state stores: the share moving falls and no wine is lost", () => {
    const c = compare(B, SET, RATES);
    const f = Math.pow(1.2, -0.5);
    expect(c.private.channelReturn!.shareMoving).toBeCloseTo(0.3 * f, 12);
    expect(c.private.channelReturn!.net).toBeCloseTo(compare({ ...BASE, shift: 0.3 * f }, SET, RATES).private.lines!.net, 6);
    expect(c.wholesale.channelReturn).toBeNull(); // the price does not change in 2, so there is nothing to return from
  });
  it("does not let the tax rate run into a second root unnoticed", () => {
    // A hump: zero at 0.2137 and at 0.8137; the first is reported and the count says there is another.
    const s = solveLever((v) => -(v - 0.2137) * (v - 0.8137), 0, 1);
    expect(s.root).toBeCloseTo(0.2137, 9);
    expect(s.crossings).toBe(2);
  });
});

describe("joint scenarios", () => {
  const b: Bounds = { avoidLow: 0.02, avoidHigh: 0.1, avoidCeiling: 0.15, delivery: 0.01, marginLow: 0.45, marginHigh: 0.5 };
  const rows = jointScenarios(BASE, SET, RATES, b);
  const at = (id: string) => rows.find((r) => r.id === id)!;
  it("labels each row by what supports it and keeps the arithmetic-only row apart", () => {
    expect(rows.map((r) => r.standing)).toEqual(["as entered", "documented bounds", "documented bounds", "exploratory", "exploratory", "exploratory", "mathematical only"]);
    expect(at("entered").wholesale.net).toBeCloseTo(-55_000, 6);
  });
  it("moves the documented assumptions together", () => {
    // Favourable: v = 10% for both, plus 1% wholesaling for arrangement 1; margin 45%.
    expect(at("favourable").wholesale.net).toBeCloseTo((-0.2 + 0.1) * 300_000 - 10_000, 6);
    expect(at("favourable").private.net).toBeCloseTo(300_000 * (-0.45 + 0.2 + 0.05 * 0.2 + 0.11) - 10_000, 6);
    expect(at("unfavourable").wholesale.net).toBeCloseTo((-0.2 + 0.02) * 300_000 - 10_000, 6);
    // The ceiling row reaches break-even for arrangement 2 only if the discount is below 15%.
    expect(at("ceiling").wholesale.breakEven).toBeCloseTo(0.15, 6);
  });
  it("prices arrangement 1 to match the state store without changing arrangement 2", () => {
    const p = at("parity");
    expect(p.wholesale.net).toBeCloseTo(at("entered").wholesale.net!, 6);
    // Price before tax 1/1.2: the tax collected is 20% of that, and the shelf price is today's.
    expect(p.private.net).toBeCloseTo(300_000 * (-0.5 + 0.2 / 1.2 + 0.05) - 10_000, 6);
  });
});
