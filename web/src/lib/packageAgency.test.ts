import { describe, expect, it } from "vitest";
import { agencyPay, agencyRates, priceClassIndex, stepFor, typicalGrocer } from "./packageAgency";
import { PACKAGE_AGENCY_GRID } from "./packageAgencyGrid.generated";
import { defaultSamePriceReport } from "./samePrice";

describe("package agency pay", () => {
  it("places volumes and prices in the grid's cells, ends included", () => {
    expect(stepFor(999).step).toBe(1);
    expect(stepFor(1000).step).toBe(2);
    expect(stepFor(5000).step).toBe(2);
    expect(stepFor(5001).step).toBe(3);
    expect(stepFor(300_001).step).toBe(15);
    expect(PACKAGE_AGENCY_GRID.classes[priceClassIndex(2.99)].id).toBe("A");
    expect(PACKAGE_AGENCY_GRID.classes[priceClassIndex(10)].id).toBe("C");
    expect(PACKAGE_AGENCY_GRID.classes[priceClassIndex(16.19)].id).toBe("D");
    expect(PACKAGE_AGENCY_GRID.classes[priceClassIndex(55)].id).toBe("G");
  });

  it("reads the PDF's amounts: step 3, class D pays $27,800", () => {
    const p = agencyPay(6_830, 16.19);
    expect([p.step, p.priceClass, p.pay]).toEqual([3, "D", 27_800]);
    expect(p.rate).toBeCloseTo(27_800 / (6_830 * 16.19), 12);
  });

  it("pays more than Pennsylvania's 10% at small volumes and less at large ones", () => {
    // Not monotonic: the rate falls within a step and jumps at the next step's first bottle.
    const r = agencyRates();
    expect(r[0].rate).toBeGreaterThan(0.1);
    expect(r[r.length - 1].rate).toBeLessThan(0.1);
  });

  it("puts a typical grocery store in a small-volume step", () => {
    const t = typicalGrocer(defaultSamePriceReport().moved);
    expect(t.sales * 411).toBeCloseTo(defaultSamePriceReport().moved, 0);
    expect(t.step).toBe(3);
  });
});
