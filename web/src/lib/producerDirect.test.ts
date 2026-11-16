import { describe, expect, it } from "vitest";
import { DIRECT_COST_SHARES, PRODUCER_PREMIUMS, directDef, directReport } from "./producerDirect";
import { WHOLESALER_MARGIN, distributorMargin } from "./wineAlternatives";

const rep = directReport();
const line = (r: (typeof rep)["main"], id: string) => r.fixed.ledger.lines.find((l) => l.id === id)?.value ?? 0;

describe("producer-direct supply (scenario D)", () => {
  it("with no saving assumed, gives the private design's result: removing the wholesaler is not a saving by itself", () => {
    expect(rep.main.fixed.ledger.net).toBeCloseTo(rep.wholesale.fixed.ledger.net, 4);
    expect(rep.main.fixed.stack.after.shelf).toBeCloseTo(rep.wholesale.fixed.stack.after.shelf, 12);
  });

  it("collects the same charge per bottle in every cell, so cost and premium move the price and only sales tax", () => {
    const charge = line(rep.wholesale, "state_charge");
    const t = rep.main.built.x.salesTax!;
    const x = rep.main.built.x;
    const S = x.wineSales! * x.eligible! * x.shift!;
    for (const c of rep.grid) {
      const r = c.result;
      expect(line(r, "state_charge"), `${c.costShare}/${c.producerPremium}`).toBeCloseTo(charge, 2);
      // The net differs from the main case by exactly the sales tax on the price difference.
      const dShelf = r.fixed.stack.after.salesTaxBase - rep.main.fixed.stack.after.salesTaxBase;
      expect(r.fixed.ledger.net - rep.main.fixed.ledger.net).toBeCloseTo(t * dShelf * S, 2);
    }
  });

  it("a cheaper delivery lowers the grocery price; a producer premium raises it", () => {
    const at = (c: number, p: number) => rep.grid.find((g) => g.costShare === c && g.producerPremium === p)!.result.fixed.stack.consumerChange;
    for (const p of PRODUCER_PREMIUMS) for (let i = 1; i < DIRECT_COST_SHARES.length; i++) expect(at(DIRECT_COST_SHARES[i], p)).toBeGreaterThan(at(DIRECT_COST_SHARES[i - 1], p));
    for (const c of DIRECT_COST_SHARES) expect(at(c, 0.2)).toBeGreaterThan(at(c, 0));
  });

  it("combines cost share and premium into one margin over what DABS pays", () => {
    expect(distributorMargin(directDef(0.2, 0.1))).toBeCloseTo(1 - 0.8 / 1.1, 12);
    expect(distributorMargin(directDef())).toBeCloseTo(WHOLESALER_MARGIN, 12);
    expect(distributorMargin(directDef(0, 0))).toBe(0);
    expect(() => distributorMargin(directDef(1, 0))).toThrow();
  });

  it("needs a change in law for producers selling to grocers, and leaves the federal questions unresolved", () => {
    const items = Object.fromEntries(rep.main.legal.map((n) => [n.item, n.status]));
    expect(items["Producers selling to grocers"]).toBe("change needed");
    expect(items["Federal permits and trade-practice rules"]).toBe("unresolved");
    expect(items["Private supply of wine"]).toBeUndefined();
  });
});
