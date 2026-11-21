import { describe, expect, it, test } from "vitest";
import { directDef } from "./producerDirect";
import {
  whatIfDesigns,
  CONVENIENCE_LIMITS,
  DEFAULT_CONSTRAINTS,
  HYBRID_EXTRA_ADMIN_SHARE,
  defaultDesignsReport,
  maxDistribution,
  maxGrocerMargin,
  minPrice,
  netPerDollar,
  policyDesignsReport,
  shareMoving,
  terms,
  type FrontierInputs,
} from "./policyDesigns";
import { COST_LINES, RETAILER_TARGET, WHOLESALER_MARGIN, alternativeById, evaluate, evaluateFixed } from "./wineAlternatives";

const t = terms();
const moved = t.moved;
const f = (distribution: number, savings = 0): FrontierInputs => ({ distribution, savings, adminPerDollar: t.admin / moved, handling: 0 });
const none = { avoided: { shortRun: 0, conditional: 0 } };
const allocated = { avoided: { shortRun: COST_LINES.shortRun, conditional: 0 } };
const rep = defaultDesignsReport();
const design = (id: string) => rep.results.find((r) => r.def.id === id)!;
const net = (id: string, s: string, l: number | null) => design(id).cases.find((c) => c.savings === s && c.limit === l)!.net;

/** The engine's net for DABS supply at consumer price P and grocer margin g (entered price; DABS's price to grocers set
 * so the grocer keeps g of its price). */
function engineDabs(P: number, g: number, o = none) {
  const k = evaluateFixed(alternativeById("A_target"), { ...o, priceRatio: P, discount: 1 - P * (1 - g) })!;
  return k;
}
/** The engine's net for a retail-charge design with distribution margin w at consumer price P and grocer margin g. */
function engineCharge(P: number, g: number, w: number, o = none) {
  const Q = t.landed / ((1 - w) * (1 - g));
  return evaluateFixed(directDef(w, 0), { ...o, priceRatio: Q, chargeRate: (P - Q) / Q })!;
}

describe("closed forms against the engine", () => {
  test("net per dollar equals the engine's ledger at entered prices, both structures", () => {
    // Only where the engine accepts the inputs: DABS's price to grocers at or below its shelf price, and a charge from 0%
    // to 100% of the price before it.
    let n = 0;
    for (const P of [1, 1.1, 1.25, 1.389, 1.6])
      for (const g of [0, 0.1, 0.28]) {
        if (P * (1 - g) <= 1) {
          expect(netPerDollar("wholesale_price", P, g, t, f(0)) * moved).toBeCloseTo(engineDabs(P, g).ledger.net, 2);
          n++;
        }
        for (const w of [0, 0.1, WHOLESALER_MARGIN])
          if (P >= t.landed / ((1 - w) * (1 - g)) && P <= (2 * t.landed) / ((1 - w) * (1 - g))) {
            expect(netPerDollar("retail_charge", P, g, t, f(w)) * moved).toBeCloseTo(engineCharge(P, g, w).ledger.net, 2);
            n++;
          }
      }
    expect(n).toBeGreaterThan(15);
  });
  test("the engine breaks even on the frontier and on the minimum price", () => {
    for (const P of [1.3, 1.5]) {
      expect(Math.abs(engineDabs(P, maxGrocerMargin("wholesale_price", P, t, f(0))).ledger.net)).toBeLessThan(1);
      const g = maxGrocerMargin("retail_charge", P, t, f(WHOLESALER_MARGIN));
      if (g > 0) expect(Math.abs(engineCharge(P, g, WHOLESALER_MARGIN).ledger.net)).toBeLessThan(1);
    }
    expect(Math.abs(engineDabs(minPrice("wholesale_price", RETAILER_TARGET, t, f(0)), RETAILER_TARGET).ledger.net)).toBeLessThan(1);
    expect(Math.abs(engineCharge(minPrice("retail_charge", RETAILER_TARGET, t, f(0.1)), RETAILER_TARGET, 0.1).ledger.net)).toBeLessThan(1);
    const P = 1 + rep.frontierAtReference.wholesalePrice;
    expect(Math.abs(engineCharge(P, RETAILER_TARGET, maxDistribution(P, RETAILER_TARGET, t, f(0))).ledger.net)).toBeLessThan(1);
  });
  test("with allocated savings the minimum premiums are the published break-even designs A_net and C_break_even", () => {
    expect(design("B").breakEven.minPremiumAtReference.allocated).toBeCloseTo(evaluate(alternativeById("A_net")).fixed.stack.consumerChange, 9);
    expect(design("C").breakEven.minPremiumAtReference.allocated).toBeCloseTo(evaluate(alternativeById("C_break_even")).fixed.stack.consumerChange, 9);
  });
});

describe("the published results are reproduced, not replaced", () => {
  test("B and C at the fixed share equal the engine's A_target and C_take with and without savings", () => {
    for (const [d, id] of [["B", "A_target"], ["C", "C_take"]]) {
      const e = evaluate(alternativeById(id));
      expect(net(d, "allocated", null)).toBeCloseTo(e.fixed.ledger.net, 6);
      expect(net(d, "none", null)).toBeCloseTo(e.zeroSavings.net, 6);
      expect(design(d).premium).toBeCloseTo(e.fixed.stack.consumerChange, 12);
    }
  });
  test("D's main case is producer-direct@1.0's main case and equals C (delivery costs what a wholesaler earns)", () => {
    expect(net("D", "none", null)).toBeCloseTo(net("C", "none", null), 6);
    expect(rep.direct.find((x) => x.costShare === WHOLESALER_MARGIN && x.producerPremium === 0)!.net).toBeCloseTo(net("C", "none", null), 6);
  });
  test("the allocated saving is the $1.03M traced in the audit", () => {
    const k = evaluateFixed(alternativeById("A_target"), allocated)!;
    expect(k.ledger.lines.find((l) => l.id === "savings_short_run")!.value).toBeCloseTo(1_034_822.37, 1);
  });
});

describe("model properties (plan 15.2)", () => {
  test("a higher grocer margin at the same landed cost never lowers the shelf price", () => {
    let last = -Infinity;
    for (const g of [0, 0.1, 0.2, 0.28, 0.4]) {
      const P = minPrice("wholesale_price", g, t, f(0));
      expect(P).toBeGreaterThan(last);
      last = P;
    }
  });
  test("a purchase moved from a state store is not a new purchase: total wine bought is unchanged at fixed volume", () => {
    for (const d of ["B", "C", "D"]) {
      const k = evaluateFixed(d === "D" ? directDef() : alternativeById(d === "B" ? "A_target" : "C_take"), none)!;
      expect(k.ledger.volume.total).toBeCloseTo(k.ledger.volume.baseline, 6);
    }
  });
  test("a higher charge collects more per bottle, but can collect less in total once households respond", () => {
    const rates = [0.3, 0.45, 0.6, 0.8];
    const per = rates.map((r) => evaluateFixed(alternativeById("C_take"), { ...none, chargeRate: r })!.stack.charge!.perDollar);
    for (let i = 1; i < per.length; i++) expect(per[i]).toBeGreaterThan(per[i - 1]);
    const total = rates.map((r) => {
      const k = evaluateFixed(alternativeById("C_take"), { ...none, chargeRate: r })!;
      const shift = shareMoving(t.shift, k.stack.consumerChange, 0.6);
      return evaluateFixed(alternativeById("C_take"), { ...none, chargeRate: r, shift })!.ledger.lines.find((l) => l.id === "state_charge")!.value!;
    });
    expect(total[3]).toBeLessThan(total[1]);
  });
  test("removing the wholesaler does not remove distribution: D's main case keeps the delivery cost in the price", () => {
    const d = design("D");
    expect(d.distribution).toBeCloseTo(WHOLESALER_MARGIN, 12);
    expect(d.flows.after.find((x) => x.party === "distributor")!.perDollar).toBeGreaterThan(0.2);
  });
  test("no savings means no savings line", () => {
    for (const id of ["A_target", "C_take", "B20_matched"]) {
      const k = evaluateFixed(alternativeById(id), none)!;
      expect(k.ledger.lines.filter((l) => l.kind === "saving").every((l) => l.value === 0)).toBe(true);
    }
  });
  test("observed values do not move when the scenario settings move", () => {
    const before = JSON.stringify(terms());
    policyDesignsReport({ maxPremium: 0.5, minGrocerMargin: 0.1 });
    expect(JSON.stringify(terms())).toBe(before);
    for (const r of rep.results) expect(r.flows.today.map((x) => x.perDollar.toFixed(12))).toEqual(rep.results[0].flows.today.map((x) => x.perDollar.toFixed(12)));
  });
  test("the result is continuous across each break-even", () => {
    const b = design("B").breakEven;
    const at = (s: number) => evaluateFixed(alternativeById("A_target"), { ...none, shift: s })!.ledger.net;
    const s0 = b.minShift.none!;
    expect(Math.abs(at(s0))).toBeLessThan(1);
    expect(at(s0 - 1e-6)).toBeLessThan(0);
    expect(at(s0 + 1e-6)).toBeGreaterThan(0);
    // A step of 2e-6 in the share moves the result by the slope times the step, and no more.
    const slope = (at(0.3) - at(0)) / 0.3;
    expect(Math.abs(at(s0 + 1e-6) - at(s0 - 1e-6))).toBeLessThan(slope * 2e-6 * 1.001);
  });
  test("the engine is linear in the share that moves (what the hybrid relies on)", () => {
    const at = (s: number) => evaluateFixed(alternativeById("C_take"), { ...none, shift: s })!.ledger.net;
    expect(at(0.2) - at(0.1)).toBeCloseTo(at(0.3) - at(0.2), 4);
  });
});

describe("edge cases (plan 15.1)", () => {
  test("no grocery sales: the state loses exactly the new administration", () => {
    for (const id of ["A_target", "C_take"]) expect(evaluateFixed(alternativeById(id), { ...none, shift: 0 })!.ledger.net).toBeCloseTo(-t.admin, 6);
  });
  test("high grocery prices: nobody moves at or above the convenience limit, and the share never leaves [0, base]", () => {
    for (const l of CONVENIENCE_LIMITS) {
      expect(shareMoving(0.3, l, l)).toBe(0);
      expect(shareMoving(0.3, 5, l)).toBe(0);
      expect(shareMoving(0.3, -0.2, l)).toBe(0.3);
    }
    expect(() => shareMoving(0.3, 0.1, 0)).toThrow();
  });
  test("at today's price with no savings, no positive grocer margin keeps DABS supply whole", () => {
    expect(maxGrocerMargin("wholesale_price", 1, t, f(0))).toBeLessThan(0);
  });
  test("losing DABS sales lowers the state's gross receipts on that wine unless a charge replaces them", () => {
    const c = design("C").cases.find((x) => x.savings === "none" && x.limit === null)!;
    expect(c.gross.after).toBeGreaterThanOrEqual(c.gross.today);
    const b20 = evaluateFixed(alternativeById("B20_matched"), none)!;
    expect(b20.ledger.net).toBeLessThan(0);
  });
  test("license fees that cover administration leave every no-savings case at or above zero", () => {
    for (const r of rep.results) for (const c of r.cases) if (c.savings === "none") expect(c.netWithFees).toBeGreaterThan(-1e-6 - 1);
  });
});

describe("hybrid and comparison", () => {
  test("the hybrid lies between its parts, less its second administrative system", () => {
    const e = net("E", "none", null);
    const b = net("B", "none", null);
    const c = net("C", "none", null);
    const extra = HYBRID_EXTRA_ADMIN_SHARE * t.admin;
    expect(e).toBeCloseTo((b + c) / 2 - extra, 4);
    expect(e).toBeLessThan(Math.max(b, c));
  });
  test("with the default constraints no design meets all three, and the selection says so", () => {
    for (const id of ["B", "C", "D", "E"] as const) expect(rep.classification[id].verdict).toBe("fails");
    expect(rep.selected.id).toBeNull();
    expect(rep.selected.whatWouldNeedToChange.length).toBeGreaterThan(3);
  });
  test("a looser price limit makes B meet the constraints only under the fixed-share assumption", () => {
    const loose = policyDesignsReport({ ...DEFAULT_CONSTRAINTS, maxPremium: 0.4 });
    expect(loose.classification.B.verdict).toBe("meets_under_assumptions");
    expect(loose.classification.C.verdict).toBe("fails");
  });
  test("Pareto: B is the only design no other beats on revenue, price and margin at once", () => {
    expect(rep.pareto).toEqual(["B"]);
  });
  test("direct supply at no delivery cost has the lowest premium, which is why its delivery cost matters", () => {
    const cheapest = rep.direct.reduce((a, b) => (b.premium < a.premium ? b : a));
    expect(cheapest.costShare).toBe(0);
    expect(cheapest.premium).toBeCloseTo(rep.frontierAtReference.retailChargeNoDistribution, 2);
    expect(rep.distributionToMatchB).toBeGreaterThan(0.15);
    expect(rep.distributionToMatchB).toBeLessThan(WHOLESALER_MARGIN);
  });
});

describe("what-if panel", () => {
  const rep = defaultDesignsReport();
  const t = rep.terms;
  const base = { grocerMargin: 0.28, distribution: 0.295, limit: null, savings: "none" as const, admin: t.admin, feesCoverAdmin: false };
  const net = (id: "B" | "C", savings: "none" | "allocated", limit: number | null) => rep.results.find((r) => r.def.id === id)!.cases.find((c) => c.savings === savings && c.limit === limit)!.net;
  it("reproduces the report's B and C results at the defaults", () => {
    const w = whatIfDesigns(t, base);
    expect(w.B.net).toBeCloseTo(net("B", "none", null), 2);
    expect(w.C.net).toBeCloseTo(net("C", "none", null), 2);
    expect(whatIfDesigns(t, { ...base, limit: 0.3 }).B.net).toBeCloseTo(net("B", "none", 0.3), 2);
    expect(whatIfDesigns(t, { ...base, limit: 0.6 }).C.net).toBeCloseTo(net("C", "none", 0.6), 2);
    expect(whatIfDesigns(t, { ...base, savings: "allocated" }).B.net).toBeCloseTo(net("B", "allocated", null), 2);
  });
  it("moves the right way when an input worsens", () => {
    const w0 = whatIfDesigns(t, base);
    expect(whatIfDesigns(t, { ...base, distribution: 0.35 }).C.premium).toBeGreaterThan(w0.C.premium);
    expect(whatIfDesigns(t, { ...base, grocerMargin: 0.2 }).B.premium).toBeLessThan(w0.B.premium);
    expect(whatIfDesigns(t, { ...base, feesCoverAdmin: true }).B.net).toBeCloseTo(w0.B.net + t.admin, 6);
  });
});

