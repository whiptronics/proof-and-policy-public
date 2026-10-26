import { describe, expect, it } from "vitest";
import { STATUTORY_MARKUP, crossCheck, impliedMargin, marginIfTaxIncluded, marginOfMarkup, spreadOf } from "./wineMargin";

// DABS monthly Sales Analysis Reports, FY2026 (July 2025 - June 2026), gross sales by beverage group.
const FY2026 = {
  spirits: 302995274.82,
  wine: 182331954.71,
  beer: 32101654.42,
  cider: 3875021.12,
  premixed: 22336528.04,
  other: 41744.48,
};

describe("a markup on cost is a smaller margin on the price", () => {
  it("turns 88.5% into 46.95% and 66.5% into 39.94%", () => {
    expect(marginOfMarkup(STATUTORY_MARKUP.wine)).toBeCloseTo(0.469496, 6);
    expect(marginOfMarkup(STATUTORY_MARKUP.heavyBeer)).toBeCloseTo(0.399399, 6);
    expect(marginOfMarkup(0)).toBe(0);
  });
});

describe("the margin the floors imply for DABS's whole mix", () => {
  it("weights each group by its sales and leaves out groups with no single markup", () => {
    const m = impliedMargin(FY2026);
    // beer 5.9% of sales at 39.94%, everything else with a markup at 46.95%
    const beerShare = FY2026.beer / (543682177.59 - FY2026.other);
    const expected = (1 - beerShare) * 0.469496 + beerShare * 0.399399;
    expect(m.margin).toBeCloseTo(expected, 5);
    expect(m.margin).toBeGreaterThan(0.465);
    expect(m.margin).toBeLessThan(0.466);
    expect(m.covered).toBeGreaterThan(0.9999);
    expect(m.covered).toBeLessThan(1);
  });
  it("is null with nothing to weight, and skips missing or negative groups", () => {
    expect(impliedMargin({}).margin).toBeNull();
    expect(impliedMargin({ other: 5 }).margin).toBeNull();
    expect(impliedMargin({ wine: 100, beer: null, spirits: -5 }).margin).toBeCloseTo(0.469496, 6);
  });
});

describe("if gross sales included sales tax", () => {
  it("would lift the margin above the floor", () => {
    // price = cost × 1.885, sales = price × 1.0485 -> margin 1 - 1/(1.885 × 1.0485)
    expect(marginIfTaxIncluded(0.885, 0.0485)).toBeCloseTo(0.4940, 3);
    expect(marginIfTaxIncluded(0.885, 0)).toBeCloseTo(0.469496, 6);
  });
});

describe("the cross-check against the reported margin", () => {
  it("finds FY2025's reported 47.2% closer to the no-tax floor than to a tax-inclusive one", () => {
    const reported = 260289 / 551346; // DABS FY2025: gross profit / revenue from liquor sales
    const c = crossCheck({ salesByGroup: FY2026, reportedMargin: reported, taxRate: 0.0485 });
    expect(c.wineFloor).toBeCloseTo(0.4695, 4);
    expect(c.reported).toBeCloseTo(0.4721, 4);
    expect(c.mixFloor).toBeCloseTo(0.4654, 3);
    expect(c.gap).toBeGreaterThan(0.005);
    expect(c.gap).toBeLessThan(0.009);
    expect(c.ifTaxIncluded!.margin).toBeGreaterThan(0.485);
    expect(c.closer).toBe("excludes_tax");
  });
  it("says which reading it is closer to only when it can tell", () => {
    expect(crossCheck({ salesByGroup: FY2026, reportedMargin: 0.495, taxRate: 0.0485 }).closer).toBe("includes_tax");
    expect(crossCheck({ salesByGroup: FY2026, reportedMargin: null, taxRate: 0.0485 }).closer).toBeNull();
    expect(crossCheck({ salesByGroup: FY2026, reportedMargin: 0.47, taxRate: null }).closer).toBeNull();
  });
});

describe("the spread of reported margins", () => {
  it("needs two values and ignores gaps", () => {
    expect(spreadOf([0.45, null, 0.47, 0.46])).toEqual({ low: 0.45, high: 0.47, n: 3 });
    expect(spreadOf([0.45, null])).toBeNull();
  });
});
