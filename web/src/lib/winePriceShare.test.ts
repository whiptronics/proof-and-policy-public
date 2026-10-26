import { describe, expect, it } from "vitest";
import { evaluateFixed, alternativeById } from "./wineAlternatives";
import {
  GRID_ARRANGEMENTS,
  PREMIUMS,
  SHARES,
  arrangementById,
  gridCell,
  priceRatioFor,
  priceShareReport,
  shareBreakEven,
  type GridArrangement,
  type GridCell,
} from "./winePriceShare";

const rep = priceShareReport();
// The worked example's inputs, written out to recompute results independently of the engine.
const W = 551_346_000 * 0.335;
const H = W * 0.82; // covered household purchases: the share's denominator
const m = 260_289_000 / 551_346_000;
const c = 1 - m;
const t = 0.0485;
const N = 500_000;
const vs = (8_403_000 + 3_474_000 + 680_000) / 551_346_000;
const w = 0.295;
const D = 0.1 + 0.01695;
const arr = (id: string) => arrangementById(id)!;
const cell = (id: string, p: number, s: number, sv: GridCell["savings"] = "source_based", vb: GridCell["volume"] = "fixed_volume") =>
  rep.cells.find((k) => k.arrangement === id && Math.abs(k.premium - p) < 1e-12 && k.share === s && k.savings === sv && k.volume === vb)!;
const point = (id: string, p: number) => rep.prices.find((k) => k.arrangement === id && Math.abs(k.premium - p) < 1e-12)!;
/** Closed form of one fixed-volume cell, written apart from the engine. */
function closed(a: GridArrangement, p: number, s: number, savings: number): number {
  const S = H * s;
  const r = 1 + p; // shelf price per $1 of today's (sales tax in the base on both sides)
  if (a.supply === "dabs") return S * (-a.lever.value + t * (r - 1) + savings) - N;
  const own = r / (1 + a.lever.value);
  return S * (-m + a.lever.value * own + t * (r - 1) + savings) - N;
}

describe("the grid's denominator and axes", () => {
  it("measures the share against covered household purchases, not all DABS sales or licensee purchases", () => {
    expect(rep.denominator.coveredHousehold).toBeCloseTo(H, 2);
    expect(rep.denominator.householdShare).toBe(0.82);
    expect(cell("dabs_0", 0, 0.3).movedDollars).toBeCloseTo(0.3 * H, 2);
  });
  it("includes no premium, the 35-51% examples, no shift and the worked 30%", () => {
    expect(PREMIUMS[0]).toBe(0);
    for (const p of [0.35, 0.4, 0.45, 0.5]) expect(PREMIUMS).toContain(p);
    expect(PREMIUMS[PREMIUMS.length - 1]).toBe(0.6);
    expect(SHARES).toEqual([0, 0.1, 0.2, 0.3, 0.4, 0.5]);
  });
  it("finds the engine price that produces each premium (consumer price, state sales tax included)", () => {
    for (const a of GRID_ARRANGEMENTS)
      for (const p of PREMIUMS) {
        const k = evaluateFixed(alternativeById(a.alt), a.lever.kind === "discount" ? { discount: a.lever.value, priceRatio: priceRatioFor(a, p) } : { chargeRate: a.lever.value, priceRatio: priceRatioFor(a, p) })!;
        expect(k.stack.consumerChange, `${a.id} ${p}`).toBeCloseTo(p, 10);
      }
  });
});

describe("zero channel shift", () => {
  it("changes nothing but the administration cost, which the state pays even when no purchase moves", () => {
    for (const k of rep.cells.filter((x) => x.share === 0)) {
      expect(k.net, `${k.arrangement} ${k.premium} ${k.savings} ${k.volume}`).toBeCloseTo(-N, 4);
      expect(k.movedDollars).toBe(0);
      expect(k.groceryDollars).toBeCloseTo(0, 6);
      expect(k.funds).toBeCloseTo(0, 6);
    }
    expect(rep.newCosts).toBe(N);
  });
});

describe("existing reference points", () => {
  it("lie on their grids: the grid reproduces each alternative's result to the cent, with and without savings", () => {
    expect(rep.references.map((r) => r.altId).sort()).toEqual(["A_matched", "A_target", "B20_matched", "B20_target", "C20_matched", "C_take"]);
    for (const r of rep.references) expect(r.matches, r.altId).toBe(true);
  });
  it("sit at the premiums the alternatives name", () => {
    const at = (id: string) => rep.references.find((r) => r.altId === id)!.premium;
    expect(at("A_matched")).toBeCloseTo(0, 10);
    expect(at("A_target")).toBeCloseTo(1 / 0.72 - 1, 10);
    expect(at("B20_target")).toBeCloseTo(0.8 / 0.72 - 1, 10);
    expect(at("C20_matched")).toBeCloseTo(0, 10);
    expect(at("C_take")).toBeCloseTo(c / (0.705 * 0.72) + m - 1, 10);
  });
  it("agree with the closed form on every fixed-volume cell", () => {
    for (const a of GRID_ARRANGEMENTS)
      for (const p of PREMIUMS)
        for (const s of SHARES) {
          expect(cell(a.id, p, s).net, `${a.id} ${p} ${s}`).toBeCloseTo(closed(a, p, s, vs), 2);
          expect(cell(a.id, p, s, "none").net, `${a.id} ${p} ${s} none`).toBeCloseTo(closed(a, p, s, 0), 2);
        }
  });
});

describe("price and margin are consistent", () => {
  it("DABS supply: the grocer keeps the premium over what it pays DABS", () => {
    for (const id of ["dabs_0", "dabs_20"])
      for (const p of PREMIUMS) {
        const d = arr(id).lever.value;
        const k = point(id, p);
        expect(k.shelf).toBeCloseTo(1 + p, 10);
        expect(k.grocerMargin!).toBeCloseTo(1 - (1 - d) / (1 + p), 10);
        expect(k.sellersTogether).toBeCloseTo(1 + p - (1 - d), 10);
      }
  });
  it("private supply: sellers' price is the shelf price less the charge, split with a wholesaler keeping 29.5%", () => {
    for (const id of ["private_20", "private_take"])
      for (const p of PREMIUMS) {
        const a = arr(id).lever.value;
        const own = (1 + p) / (1 + a);
        const k = point(id, p);
        expect(k.sellersTogether).toBeCloseTo(own - c, 10);
        expect(k.grocerMargin!).toBeCloseTo((own - c / (1 - w)) / own, 10);
        expect(k.chargePerDollar!).toBeCloseTo(a * own, 10);
      }
  });
  it("does not depend on the share: a seller's margin is fixed by the price and the lever alone", () => {
    const a = arr("private_20");
    const at = (s: number) => evaluateFixed(alternativeById(a.alt), { chargeRate: a.lever.value, priceRatio: priceRatioFor(a, 0.3), shift: s })!.stack.retailerMarginShare;
    expect(at(0.1)).toBeCloseTo(at(0.5)!, 12);
  });
});

describe("below-cost flags", () => {
  it("separate selling below acquisition cost from a positive margin below the 28% reference", () => {
    expect(point("dabs_0", 0).position).toBe("at_cost");
    expect(point("dabs_0", 0.35).position).toBe("below_reference");
    expect(point("dabs_0", 0.4).position).toBe("reference_or_above");
    expect(point("dabs_20", 0).position).toBe("below_reference");
    expect(point("private_20", 0).position).toBe("below_reference");
    expect(point("private_take", 0).position).toBe("below_cost");
    expect(point("private_take", 0).belowCost.grocer).toBe(true);
    expect(point("private_take", 0.6).position).toBe("reference_or_above");
    // "At cost" means a zero margin, not a small one: 4.8% and 1.0% are positive margins below the reference.
    expect(point("dabs_0", 0.05).position).toBe("below_reference");
    expect(point("private_take", 0.1).grocerMargin!).toBeCloseTo(0.0103, 4);
    expect(point("private_take", 0.1).position).toBe("below_reference");
    for (const k of rep.prices) {
      const g = k.grocerMargin!;
      if (k.position === "below_cost") expect(g < 0 || k.sellersTogether < 0).toBe(true);
      else expect(g).toBeGreaterThanOrEqual(-1e-9);
    }
  });
  it("places the cost and 28% markers where the margin crosses them", () => {
    const mk = (id: string) => rep.markers.find((k) => k.arrangement === id)!;
    expect(mk("dabs_0").grocerCost).toBeCloseTo(0, 8);
    expect(mk("dabs_0").reference).toBeCloseTo(1 / 0.72 - 1, 8);
    expect(mk("dabs_20").grocerCost).toBeCloseTo(-0.2, 8);
    expect(mk("dabs_20").reference).toBeCloseTo(0.8 / 0.72 - 1, 8);
    // Private: the grocer reaches zero when the sellers' price equals the wholesaler's price c / (1 - w).
    const a = arr("private_take").lever.value;
    expect(mk("private_take").grocerCost).toBeCloseTo((c / (1 - w)) * (1 + a) - 1, 8);
    expect(mk("private_take").sellersCost).toBeCloseTo(c * (1 + a) - 1, 8);
    expect(mk("private_take").reference).toBeCloseTo(c / (0.705 * 0.72) + m - 1, 8);
  });
});

describe("accounting", () => {
  it("every cell reconciles with the engine and splits the protected funds out of the total, never added", () => {
    for (const k of rep.cells) {
      expect(k.reconciles, `${k.arrangement} ${k.premium} ${k.share} ${k.savings} ${k.volume}`).toBe(true);
      expect(k.funds + k.others).toBeCloseTo(k.net, 6);
    }
  });
  it("at fixed volume the protected funds follow the share only, not the price", () => {
    for (const a of GRID_ARRANGEMENTS)
      for (const s of SHARES)
        for (const p of PREMIUMS) {
          const k = cell(a.id, p, s);
          const S = H * s;
          if (a.supply === "dabs") {
            expect(k.funds).toBeCloseTo(-D * a.lever.value * S, 4);
            expect(k.fundsOtherReading!).toBeCloseTo(-D * S, 4);
          } else expect(k.funds).toBeCloseTo(-D * S, 4);
        }
  });
  it("source-based savings add 2.28 cents per moved dollar and nothing else", () => {
    for (const k of rep.cells.filter((x) => x.volume === "fixed_volume" && x.savings === "source_based")) {
      const z = cell(k.arrangement, k.premium, k.share, "none");
      expect(k.net - z.net).toBeCloseTo(vs * k.movedDollars, 4);
    }
  });
  it("keeps handling at its zero placeholder and administration at $500,000", () => {
    expect(rep.handlingCost).toBe(0);
    for (const k of rep.cells) expect(k.ledger.lines.find((l) => l.id === "new_handling")!.value).toBeCloseTo(0, 6);
  });
});

describe("price response (conditional)", () => {
  it("assigns the share first: with no price change it equals fixed volume", () => {
    for (const a of GRID_ARRANGEMENTS)
      for (const s of SHARES) expect(cell(a.id, 0, s, "source_based", "price_response").net).toBeCloseTo(cell(a.id, 0, s).net, 4);
  });
  it("reads the protected funds the same two ways: DABS loses deposits on its lost store sales and keeps them on its (smaller) sales to grocers only on that reading", () => {
    for (const k of rep.cells.filter((x) => x.volume === "price_response" && x.share > 0)) {
      const a = arr(k.arrangement);
      const tag = `${k.arrangement} ${k.premium} ${k.share} ${k.savings}`;
      if (a.supply === "dabs") {
        expect(k.funds, tag).toBeCloseTo(D * (-k.movedDollars + (1 - a.lever.value) * k.groceryDollars), 4);
        expect(k.fundsOtherReading!, tag).toBeCloseTo(-D * k.movedDollars, 4);
      } else expect(k.funds, tag).toBeCloseTo(-D * k.movedDollars, 4);
    }
  });
  it("sends purchases lost at grocers out of the market, never back to DABS (no double counting)", () => {
    for (const k of rep.cells.filter((x) => x.volume === "price_response" && x.share > 0)) {
      const r = point(k.arrangement, k.premium).shelf;
      expect(k.ledger.volume.state).toBeCloseTo(W - k.movedDollars, 2);
      expect(k.groceryDollars).toBeCloseTo(k.movedDollars * Math.pow(r, -0.46), 2);
    }
  });
});

describe("break-even shares", () => {
  it("fixed volume: the engine's break-even share zeroes the net change", () => {
    for (const b of rep.shareBreakEvens.filter((x) => x.volume === "fixed_volume" && x.status === "within_grid")) {
      const a = arr(b.arrangement);
      expect(gridCell(a, b.premium, b.share!, b.savings, "fixed_volume").net).toBeCloseTo(0, 2);
    }
  });
  it("is never found where each moved dollar loses money", () => {
    const b = shareBreakEven(arr("private_20"), 0, "source_based", "fixed_volume");
    expect(b.status).toBe("never");
    expect(b.share).toBeNull();
  });
  it("reports the premiums that keep receipts whole at 30%, with the margins at each end", () => {
    const rg = (id: string, sv: GridCell["savings"], vb: GridCell["volume"]) => rep.preserved.find((x) => x.arrangement === id && x.savings === sv && x.volume === vb)!.ranges;
    const d0 = rg("dabs_0", "source_based", "fixed_volume");
    expect(d0).toHaveLength(1);
    expect(d0[0].from).toBe(0); // already whole at today's price, where the grocer is at cost
    expect(d0[0].to).toBeNull(); // and at every premium up to 100%
    expect(d0[0].fromPoint.position).toBe("at_cost");
    const pt = rg("private_take", "source_based", "fixed_volume");
    expect(pt).toHaveLength(1);
    expect(gridCell(arr("private_take"), pt[0].from, 0.3, "source_based", "fixed_volume").net).toBeCloseTo(0, 2);
    expect(pt[0].fromPoint.position).toBe("below_reference");
    // With the price response DABS supply at today's price keeps receipts only up to a small premium.
    const dr = rg("dabs_0", "source_based", "price_response");
    expect(dr).toHaveLength(1);
    expect(dr[0].from).toBe(0);
    expect(dr[0].to).not.toBeNull();
    expect(gridCell(arr("dabs_0"), dr[0].to!, 0.3, "source_based", "price_response").net).toBeCloseTo(0, 2);
    for (const id of ["dabs_20", "private_20"]) for (const sv of ["source_based", "none"] as const) expect(rg(id, sv, "fixed_volume")).toEqual([]);
  });
});
