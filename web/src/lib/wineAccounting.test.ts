import { describe, expect, it } from "vitest";
import { compute, type ScenarioInputs } from "./scenario";
import { ledger, marginFromMarkup, markupFromMargin, priceForMargin, priceStack, rateOnBaseFromShare, shareOfInclusive, signWords, type AccountingOptions } from "./wineAccounting";

// Round numbers checked by hand: $100 of wine, a 50% margin, 5% sales tax, $20 moves (20% of all sales), 3 cents of
// cost avoided per dollar that moves, $1 of new administration a year.
const X: ScenarioInputs = {
  wineSales: 100,
  wineGallons: 10,
  grossMargin: 0.5,
  salesTax: 0.05,
  avoidableCost: 0.03,
  newCosts: 1,
  shift: 0.2,
  eligible: 1,
  priceRatio: 1,
  matchPrice: true,
  revenueMode: "wholesale",
  retained: null,
  excise: null,
  adValorem: null,
  discount: 0.1,
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
const DABS: AccountingOptions = { supply: "dabs", rates: RATES, savings: { shortRun: 0.03, conditional: 0 }, depositsOnGrocerSales: true };
const PRIV: AccountingOptions = { supply: "private", rates: RATES, savings: { shortRun: 0.03, conditional: 0 }, wholesalerMargin: 0.2 };
const lineOf = (l: ReturnType<typeof ledger>, id: string) => l.lines.find((k) => k.id === id)?.value;
const stackSum = (c: ReturnType<typeof priceStack>["after"]) => c.acquisition + c.dabsMargin + c.wholesaleMargin + c.retailerMargin + c.chargeInPrice + c.chargeAbsorbed;

describe("ledger by hand", () => {
  it("DABS supply at a 10% discount, matched prices: -2 margin + 0.6 saved - 1 new = -2.4, and it reconciles", () => {
    const r = compute(X);
    const l = ledger(X, r, DABS);
    expect(lineOf(l, "dabs_trading_margin")).toBeCloseTo(-2, 9); // the discount on $20
    expect(lineOf(l, "state_sales_tax")).toBeCloseTo(0, 9); // the same shelf price: the sales tax is retained, not lost
    expect(lineOf(l, "savings_short_run")).toBeCloseTo(0.6, 9);
    expect(lineOf(l, "new_administration")).toBeCloseTo(-1, 9);
    expect(lineOf(l, "local_sales_tax")).toBeNull();
    expect(l.net).toBeCloseTo(-2.4, 9);
    expect(l.reconciles).toBe(true);
  });
  it("allocations: deposits on DABS's $18 of sales to grocers leave the funds 2 x 11.695% short; funds + others = net", () => {
    const l = ledger(X, compute(X), DABS);
    expect(l.allocations.funds).toBeCloseTo(-0.11695 * 2, 9);
    expect(l.allocations.funds + l.allocations.others).toBeCloseTo(l.net, 9);
    const l2 = ledger(X, compute(X), { ...DABS, depositsOnGrocerSales: false });
    expect(l2.allocations.funds).toBeCloseTo(-0.11695 * 20, 9); // no deposits on the $20 that moves
    expect(l2.net).toBeCloseTo(l.net, 9); // the reading moves money between funds, not the total
  });
  it("a guarantee moves money to the funds and leaves the statewide change alone", () => {
    const l = ledger(X, compute(X), { ...DABS, guarantee: 5 });
    expect(l.allocations.funds).toBeCloseTo(-0.11695 * 2 + 5, 9);
    expect(l.allocations.others).toBeCloseTo(-2.4 - (-0.11695 * 2 + 5), 9);
    expect(l.net).toBeCloseTo(-2.4, 9);
  });
  it("unaffected business cancels: the same $20 moving out of $100 or $1,000 of wine gives the same change", () => {
    const small = ledger(X, compute(X), DABS);
    const xBig = { ...X, wineSales: 1000, shift: 0.02 };
    const big = ledger(xBig, compute(xBig), DABS);
    expect(big.net).toBeCloseTo(small.net, 9);
    expect(big.unaffected.wineMargin).toBeCloseTo(0.5 * 980, 9);
    expect(big.unaffected.change).toBe(0);
  });
  it("zero channel shift: only the administration cost is left", () => {
    const x0 = { ...X, shift: 0 };
    const l = ledger(x0, compute(x0), DABS);
    expect(l.net).toBeCloseTo(-1, 9);
    expect(lineOf(l, "dabs_trading_margin")).toBeCloseTo(0, 9);
  });
  it("zero discount: +0.6 - 1 = -0.4; with zero avoidable cost as well, -1", () => {
    const xz = { ...X, discount: 0 };
    expect(ledger(xz, compute(xz), DABS).net).toBeCloseTo(-0.4, 9);
    const xzz = { ...xz, avoidableCost: 0 };
    expect(ledger(xzz, compute(xzz), { ...DABS, savings: { shortRun: 0, conditional: 0 } }).net).toBeCloseTo(-1, 9);
  });
  it("splits the avoided cost into the short-run and conditional parts and refuses a split that does not add up", () => {
    const l = ledger(X, compute(X), { ...DABS, savings: { shortRun: 0.01, conditional: 0.02 } });
    expect(lineOf(l, "savings_short_run")).toBeCloseTo(0.2, 9);
    expect(lineOf(l, "savings_conditional")).toBeCloseTo(0.4, 9);
    expect(() => ledger(X, compute(X), { ...DABS, savings: { shortRun: 0.01, conditional: 0 } })).toThrow();
  });
  it("private supply with a 25% charge at matched prices: sellers' price 0.8, charge 0.2 a dollar; -10 + 4 + 0.6 - 1 = -6.4", () => {
    const xp: ScenarioInputs = { ...X, revenueMode: "percent", adValorem: 0.25, discount: null, taxToPrice: 1 };
    const r = compute(xp);
    const l = ledger(xp, r, PRIV);
    expect(lineOf(l, "dabs_trading_margin")).toBeCloseTo(-10, 9);
    expect(lineOf(l, "state_charge")).toBeCloseTo(4, 9);
    expect(lineOf(l, "state_sales_tax")).toBeCloseTo(0, 9);
    expect(l.net).toBeCloseTo(-6.4, 9);
    expect(l.allocations.funds).toBeCloseTo(-0.11695 * 20, 9); // DABS no longer sells it, so no deposit
    // Outside the sales-tax base the tax is on 0.8: 0.05 x (0.8 - 1) x 20 = -0.2 more.
    const xo = { ...xp, chargeInSalesTax: false };
    const lo = ledger(xo, compute(xo), PRIV);
    expect(lineOf(lo, "state_sales_tax")).toBeCloseTo(-0.2, 9);
    expect(lo.net).toBeCloseTo(-6.6, 9);
    expect(lo.reconciles).toBe(true);
  });
  it("a cost of supplying grocers is its own line", () => {
    const xh = { ...X, handlingCost: 0.01 };
    const l = ledger(xh, compute(xh), DABS);
    expect(lineOf(l, "new_handling")).toBeCloseTo(-0.2, 9);
    expect(l.net).toBeCloseTo(-2.6, 9);
    expect(l.reconciles).toBe(true);
    // Ignored outside DABS supply.
    const xp = { ...xh, revenueMode: "percent" as const, adValorem: 0.25, discount: null, taxToPrice: 1 };
    expect(compute(xp).netA).toBeCloseTo(-6.4, 9);
  });
});

describe("price stack and denominators", () => {
  it("adds up to the shelf price in every structure", () => {
    for (const x of [X, { ...X, matchPrice: false, priceRatio: 0.9 / 0.72 }, { ...X, revenueMode: "percent" as const, adValorem: 0.25, discount: null, taxToPrice: 1 }]) {
      const s = priceStack(x, compute(x), x.revenueMode === "wholesale" ? DABS : PRIV);
      expect(stackSum(s.after)).toBeCloseTo(s.after.shelf, 12);
      expect(stackSum(s.today)).toBeCloseTo(1, 12);
    }
  });
  it("margin and markup convert: 88.5% markup is a 46.95% margin, and back", () => {
    expect(marginFromMarkup(0.885)).toBeCloseTo(0.885 / 1.885, 12);
    expect(markupFromMargin(marginFromMarkup(0.885))).toBeCloseTo(0.885, 12);
    const s = priceStack(X, compute(X), DABS);
    expect(s.dabsMarkupOnCost.today).toBeCloseTo(1, 12); // a 50% margin is a 100% markup
    expect(s.dabsMarginShare.after).toBeCloseTo(0.4 / 0.9, 12); // DABS sells at 0.9 and keeps 0.4
  });
  it("a tax on the sellers' price is a smaller share of the price that includes it: 20% -> 16.7%, 76.4% -> 43.3%", () => {
    expect(shareOfInclusive(0.2)).toBeCloseTo(1 / 6, 12);
    expect(shareOfInclusive(0.764)).toBeCloseTo(0.4331, 4);
    expect(rateOnBaseFromShare(shareOfInclusive(0.764))).toBeCloseTo(0.764, 12);
    const xp: ScenarioInputs = { ...X, revenueMode: "percent", adValorem: 0.2, discount: null, taxToPrice: 1 };
    const s = priceStack(xp, compute(xp), PRIV);
    expect(s.charge?.rateOnBase).toBeCloseTo(0.2, 12);
    expect(s.charge?.shareOfPriceWithCharge).toBeCloseTo(1 / 6, 12);
    expect(s.after.chargeInPrice).toBeCloseTo(1 / 6, 12); // matched: the charge is inside the unchanged $1
  });
  it("funding a retailer margin raises the price: paying DABS 0.9, a 28% margin needs 0.9 / 0.72 = 1.25", () => {
    expect(priceForMargin(0.9, 0.28)).toBeCloseTo(1.25, 12);
    const xt = { ...X, matchPrice: false, priceRatio: priceForMargin(0.9, 0.28) };
    const r = compute(xt);
    const s = priceStack(xt, r, DABS);
    expect(s.retailerMarginShare).toBeCloseTo(0.28, 12);
    expect(s.consumerChange).toBeCloseTo(0.25, 12);
    // At fixed volume the higher price only adds sales tax: -2 + 0.05 x 0.25 x 20 + 0.6 - 1 = -2.15.
    expect(ledger(xt, r, DABS).net).toBeCloseTo(-2.15, 9);
    // At matched prices the retailer's margin is the discount.
    expect(priceStack(X, compute(X), DABS).retailerMarginShare).toBeCloseTo(0.1, 12);
  });
});

describe("fixed volume and demand stay apart", () => {
  it("the price response is reported only on the demand basis, and both bases reconcile", () => {
    const xt: ScenarioInputs = { ...X, matchPrice: false, priceRatio: 1.25, extra: true, growth: 0, extraGrocery: 1, elasticity: -0.5 };
    const r = compute(xt);
    const fixed = ledger(xt, r, DABS, "fixed_volume");
    const demand = ledger(xt, r, DABS, "with_demand");
    expect(fixed.net).toBeCloseTo(r.netA, 9);
    expect(demand.net).toBeCloseTo(r.netB!, 9);
    expect(demand.reconciles).toBe(true);
    // 1.25^-0.5 of the $20 is bought: the rest loses DABS's 0.4 and the 0.0625 sales tax per dollar.
    const lost = 20 * (1 - Math.pow(1.25, -0.5));
    expect(demand.net - fixed.net).toBeCloseTo(-lost * (0.4 + 0.05 * 1.25), 9);
    expect(demand.volume.grocery).toBeCloseTo(20 - lost, 9);
  });
  it("recapture and access are separate streams that add up with the price response", () => {
    const base: ScenarioInputs = { ...X, matchPrice: false, priceRatio: 1.25, extra: true, growth: 0, extraGrocery: 1, elasticity: null, recapture: null };
    const net = (p: Partial<ScenarioInputs>) => {
      const r = compute({ ...base, ...p });
      return r.netB! - r.netA;
    };
    const parts = net({ elasticity: -0.5 }) + net({ recapture: 0.02 }) + net({ growth: 0.03 });
    expect(net({ elasticity: -0.5, recapture: 0.02, growth: 0.03 })).toBeCloseTo(parts, 9);
  });
});

describe("words follow the sign", () => {
  it("never calls a gain a loss", () => {
    expect(signWords(1_391_803)).toBe("raises");
    expect(signWords(-8_552_462)).toBe("lowers");
    expect(signWords(0.2)).toBe("leaves unchanged");
  });
});
