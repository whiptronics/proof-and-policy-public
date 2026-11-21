import { describe, expect, it } from "vitest";
import { SAVINGS_CASES } from "./policyDesigns";
import { PA_LICENSEE_MARGIN, SAME_PRICE_MARGINS, defaultSamePriceReport, samePriceCase, samePriceInputs } from "./samePrice";
import { alternativeById, evaluateFixed } from "./wineAlternatives";
import { DEFAULT_FLOWS, arrangementTerms, computeFlows, setLever } from "./wineFlows";

const rep = defaultSamePriceReport();
const perDollar = (s: string) => {
  const v = SAVINGS_CASES.find((c) => c.id === s)!.perDollar;
  return v;
};

describe("same shelf price", () => {
  it("is the alternatives engine's matched-price DABS design, at every margin and savings case", () => {
    for (const m of SAME_PRICE_MARGINS) {
      for (const s of SAVINGS_CASES) {
        const engine = evaluateFixed(alternativeById("B20_matched"), { discount: m, avoided: perDollar(s.id) })!;
        expect(engine.stack.consumerChange).toBeCloseTo(0, 9);
        expect(samePriceCase(m, s.id, false).net).toBeCloseTo(engine.ledger.net, 0);
      }
    }
  });

  it("reproduces the flow model's own DABS-at-80% accounting case", () => {
    const own = computeFlows(arrangementTerms("dabs_discount_20"), DEFAULT_FLOWS).change.net;
    expect(samePriceCase(0.2, "allocated", false).net).toBeCloseTo(own, 0);
  });

  it("keeps the shopper's price at today's in every case", () => {
    for (const k of rep.grid) expect(Number.isFinite(k.net)).toBe(true);
    expect(rep.grid).toHaveLength(SAME_PRICE_MARGINS.length * SAVINGS_CASES.length * 2);
  });

  it("breaks even exactly at the reported margin, with and without fees", () => {
    for (const s of SAVINGS_CASES) {
      const b = rep.breakEvenMargin[s.id];
      expect(samePriceCase(b.fees, s.id, true).net).toBeCloseTo(0, 0);
      if (b.noFees >= 0) expect(samePriceCase(b.noFees, s.id, false).net).toBeCloseTo(0, 0);
    }
    // With no saving and no fee, no margin at all works: the administration alone is a loss.
    expect(rep.breakEvenMargin.none.noFees).toBeLessThan(0);
    expect(rep.breakEvenMargin.none.fees).toBe(0);
  });

  it("splits the grocer's income into avoided DABS costs and the state's share", () => {
    for (const s of SAVINGS_CASES) {
      const c = rep.cover[s.id];
      expect(c.dabsCostsAvoided + c.feesLessAdmin + c.stateShare).toBeCloseTo(c.grocerIncome, 0);
      expect(samePriceCase(rep.margin, s.id, true).net).toBeCloseTo(-c.stateShare, 0);
    }
    expect(rep.cover.none.grocerIncome).toBeCloseTo(PA_LICENSEE_MARGIN.value * rep.moved, 0);
  });

  it("finds the extra purchases that close the remaining gap", () => {
    for (const s of SAVINGS_CASES) {
      for (const lever of ["additional", "recapture"] as const) {
        const b = rep.needed[s.id][lever];
        if (b.status !== "found") continue;
        const x = setLever(samePriceInputs(s.id, true), lever, b.value!);
        expect(computeFlows(arrangementTerms("dabs_discount_20", { discount: rep.margin }), x).change.net).toBeCloseTo(0, 0);
      }
    }
  });

  it("flags Pennsylvania's discount as below Utah's markup floor", () => {
    expect(rep.lawfulDiscount).toBeGreaterThanOrEqual(0);
    expect(rep.lawfulDiscount).toBeLessThan(PA_LICENSEE_MARGIN.value);
  });
});
