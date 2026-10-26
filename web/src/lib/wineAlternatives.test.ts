import { describe, expect, it } from "vitest";
import { signWords } from "./wineAccounting";
import { ALTERNATIVES, ASSUMPTIONS, COST_LINES, REFERENCE_AVOIDED, RETAILER_TARGET, WHOLESALER_MARGIN, alternativeById, alternativesReport, costCases, evaluate, leverOf, sweepLever } from "./wineAlternatives";

const rep = alternativesReport();
const res = (id: string) => rep.results.find((r) => r.def.id === id)!;
const line = (id: string, l: string) => res(id).fixed.ledger.lines.find((k) => k.id === l)!.value!;
// The worked example's inputs, written out to recompute results independently of the engine.
const W = 551_346_000 * 0.335;
const m = 260_289_000 / 551_346_000;
const S = W * 0.82 * 0.3;
const t = 0.0485;
const N = 500_000;
const vs = (8_403_000 + 3_474_000 + 680_000) / 551_346_000;

describe("historical references are unchanged", () => {
  it("reproduces the brief's published results to the cent", () => {
    expect(res("R1").fixed.ledger.net).toBeCloseTo(-12_105_857.99, 1);
    expect(res("R2").fixed.ledger.net).toBeCloseTo(-7_315_463.58, 1);
    expect(REFERENCE_AVOIDED).toBe(0.05);
  });
  it("keeps the state sales tax on the wine that moves in both (matched prices): never a loss", () => {
    expect(line("R1", "state_sales_tax")).toBeCloseTo(0, 6);
    expect(line("R2", "state_sales_tax")).toBeCloseTo(0, 6);
    expect(res("R1").fixed.stack.after.stateSalesTax).toBeCloseTo(t, 12);
  });
});

describe("every alternative", () => {
  it("reconciles with the engine, adds its demand mechanisms up, and splits funds and other state money exactly", () => {
    for (const r of rep.results) {
      expect(r.fixed.ledger.reconciles, r.def.id).toBe(true);
      expect(r.demandAdditive, r.def.id).toBe(true);
      for (const d of r.demand) if (d.ledger) expect(d.ledger.reconciles, `${r.def.id} ${d.id}`).toBe(true);
      const a = r.fixed.ledger.allocations;
      expect(a.funds + a.others).toBeCloseTo(r.fixed.ledger.net, 6);
    }
  });
  it("keeps fixed volume and demand apart: no price response where prices do not move", () => {
    for (const r of rep.results) {
      const pc = r.demand.find((d) => d.id === "price_constant")!;
      if (r.def.pricing === "matched") expect(pc.delta, r.def.id).toBeCloseTo(0, 6);
      else expect(pc.delta, r.def.id).toBeLessThan(0);
    }
  });
  it("uses only documented short-run savings outside the references, with stores open", () => {
    for (const r of rep.results.filter((x) => x.def.savings === "short_run")) {
      expect(r.built.x.avoidableCost).toBeCloseTo(vs, 12);
      expect(r.fixed.ledger.lines.find((l) => l.id === "savings_conditional")!.value).toBeCloseTo(0, 6);
    }
  });
  it("headline words follow the sign of the number they describe", () => {
    for (const r of rep.results) expect(r.headline).toContain(signWords(r.fixed.ledger.net));
  });
});

describe("A: DABS keeps its per-bottle trading margin", () => {
  it("at today's price to grocers and a 28% retailer margin: price 1/0.72, margin unchanged, net = S(t x 0.389 + v) - N", () => {
    const a = res("A_target");
    expect(a.lever.discount).toBe(0);
    expect(line("A_target", "dabs_trading_margin")).toBeCloseTo(0, 4);
    expect(a.fixed.stack.after.shelf).toBeCloseTo(1 / (1 - RETAILER_TARGET), 12);
    expect(a.retailer.marginShare).toBeCloseTo(RETAILER_TARGET, 12);
    expect(a.fixed.ledger.net).toBeCloseTo(S * (t * (1 / 0.72 - 1) + vs) - N, 2);
    // Deposits unchanged if DABS's sales to grocers carry them (it sells the same $ to grocers).
    expect(a.fixed.ledger.allocations.funds).toBeCloseTo(0, 2);
    expect(a.fixed.ledgerOtherReading!.allocations.funds).toBeCloseTo(-0.11695 * S, 2);
  });
  it("at matched prices the grocer keeps nothing: reported, not called unworkable", () => {
    const a = res("A_matched");
    expect(a.retailer.marginShare).toBeCloseTo(0, 12);
    expect(a.retailer.meetsTarget).toBe(false);
    expect(a.fixed.ledger.net).toBeCloseTo(S * vs - N, 2);
  });
  it("the net-contribution version breaks even at fixed volume", () => {
    expect(res("A_net").fixed.ledger.net).toBeCloseTo(0, 0);
    expect(res("A_net").lever.discount).toBeGreaterThan(0);
  });
  it("preserving receipts per bottle does not preserve annual receipts once the price response is counted", () => {
    expect(res("A_target").demand.find((d) => d.id === "price_constant")!.net).toBeLessThan(0);
  });
});

describe("B: the discount sweep", () => {
  it("zero discount gains +S x 5 cents - N with the reference savings and loses N with none (diagnostic)", () => {
    const def = alternativeById("B20_matched");
    expect(evaluate(def, { discount: 0, avoided: { shortRun: COST_LINES.shortRun, conditional: REFERENCE_AVOIDED - COST_LINES.shortRun } }).fixed.ledger.net).toBeCloseTo(S * 0.05 - N, 2);
    expect(evaluate(def, { discount: 0, avoided: { shortRun: 0, conditional: 0 } }).fixed.ledger.net).toBeCloseTo(-N, 2);
  });
  it("crosses zero where the solved break-even says, in both pricing modes", () => {
    for (const id of ["B20_matched", "B20_target"]) {
      const rows = sweepLever(alternativeById(id), "discount", 0, 0.5, 200);
      const cross = rows.findIndex((r, i) => i > 0 && Math.sign(r.net) !== Math.sign(rows[i - 1].net));
      expect(cross, id).toBeGreaterThan(0);
      const be = leverOf({ ...alternativeById(id), discount: "break_even" }).discount;
      expect(rows[cross - 1].v).toBeLessThanOrEqual(be + 1e-9);
      expect(rows[cross].v).toBeGreaterThanOrEqual(be - 1e-9);
    }
    // Matched prices: the break-even discount is v - N / S.
    expect(leverOf({ ...alternativeById("B20_matched"), discount: "break_even" }).discount).toBeCloseTo(vs - N / S, 6);
  });
  it("at matched prices the retailer's margin is the discount; with a target the price carries it", () => {
    expect(res("B20_matched").retailer.marginShare).toBeCloseTo(0.2, 12);
    expect(res("B20_target").fixed.stack.consumerChange).toBeCloseTo(0.8 / 0.72 - 1, 12);
  });
});

describe("C: private supply with an explicit charge", () => {
  it("a charge equal to DABS's margin per bottle replaces it exactly; the change is the sales tax on the higher price plus savings less new costs", () => {
    const own = (1 - m) / ((1 - WHOLESALER_MARGIN) * (1 - RETAILER_TARGET));
    const c = res("C_take");
    expect(line("C_take", "state_charge")).toBeCloseTo(-line("C_take", "dabs_trading_margin"), 2);
    expect(c.lever.charge).toBeCloseTo(m / own, 12);
    expect(c.fixed.ledger.net).toBeCloseTo(S * (t * (own + m - 1) + vs) - N, 2);
    // Per gallon at the wholesaler: the same dollars, but the grocer's 28% is on less than its whole selling price.
    expect(res("C_gallon").fixed.ledger.net).toBeCloseTo(c.fixed.ledger.net, 2);
    expect(res("C_gallon").retailer.marginShare!).toBeLessThan(RETAILER_TARGET);
  });
  it("outside the sales-tax base the state collects less on the same charge", () => {
    expect(res("C_take_outside").fixed.ledger.net).toBeLessThan(res("C_take").fixed.ledger.net);
    expect(res("C_take_outside").fixed.stack.after.salesTaxBase).toBeCloseTo(res("C_take").fixed.stack.after.shelf - res("C_take").fixed.stack.after.chargeInPrice, 12);
  });
  it("the break-even charges are found, and at matched prices leave sellers about a cent", () => {
    expect(res("C_break_even").fixed.ledger.net).toBeCloseTo(0, 0);
    const mb = res("C_matched_be");
    expect(mb.fixed.ledger.net).toBeCloseTo(0, 0);
    const kept = mb.fixed.stack.after.wholesaleMargin + mb.fixed.stack.after.retailerMargin;
    expect(kept).toBeCloseTo(vs - N / S, 6);
  });
  it("shows the legal changes needed", () => {
    expect(res("C_take").legal.some((l) => l.item === "Private supply of wine" && l.status === "change needed")).toBe(true);
    expect(res("A_target").legal.find((l) => l.item === "DABS price to grocers")!.status).toBe("consistent with current law");
    expect(res("R2").legal.find((l) => l.item === "DABS price to grocers")!.status).toBe("change needed");
  });
});

describe("cost cases", () => {
  it("no wine moving leaves only the administration cost; avoided-cost cases move the result the right way", () => {
    for (const id of ["A_target", "C_take", "B20_matched"]) {
      const rows = costCases(alternativeById(id));
      const v = (k: string) => rows.find((r) => r.id === k)!.net;
      expect(v("zero_shift")).toBeCloseTo(-N, 2);
      expect(v("no_savings")).toBeLessThan(v("short_run"));
      expect(v("plus_wages")).toBeGreaterThan(v("short_run"));
    }
  });
  it("every alternative is defined", () => {
    expect(ALTERNATIVES.length).toBe(rep.results.length);
  });
});

describe("interpretation checks (2026-10-17, second pass)", () => {
  it("reconciles every alternative into margin, taxes, avoidable costs and new costs, with allocations apart", () => {
    for (const r of rep.results) {
      const k = r.reconciliation;
      expect(k.tradingMargin + k.taxes.total + k.avoidableCosts + k.newCosts, r.def.id).toBeCloseTo(r.fixed.ledger.net, 4);
      expect(k.taxes.total).toBeCloseTo(k.taxes.charge + k.taxes.salesTax, 6);
      const s = k.sources;
      expect(s.marginAndCharge + s.checkoutTax + s.savings + s.newCosts).toBeCloseTo(k.net, 4);
    }
  });
  it("shows every alternative without avoidable savings, at the same lever", () => {
    for (const r of rep.results) {
      expect(r.zeroSavings.net, r.def.id).toBeCloseTo(r.fixed.ledger.net - r.reconciliation.avoidableCosts, 2);
      expect(r.zeroSavings.ledger.reconciles).toBe(true);
    }
  });
  it("the preserve-the-take alternatives gain only from checkout tax and assumed savings, not from the take itself", () => {
    for (const id of ["A_target", "C_take", "C_gallon"]) {
      const s = res(id).reconciliation.sources;
      expect(Math.abs(s.marginAndCharge), id).toBeLessThan(1);
      expect(res(id).fixed.ledger.net).toBeCloseTo(s.checkoutTax + s.savings + s.newCosts, 2);
    }
    // Without the assumed savings, A keeps only the extra checkout tax less the new costs.
    const a = res("A_target").reconciliation.sources;
    expect(res("A_target").zeroSavings.net).toBeCloseTo(a.checkoutTax + a.newCosts, 2);
  });
  it("labels the short-run saving as a source-based assumption and the handling cost as unknown", () => {
    const u07 = ASSUMPTIONS.find((x) => x.id === "U07")!;
    expect(u07.standing).toBe("assumption");
    expect(u07.label).toContain("source-based assumption");
    expect(ASSUMPTIONS.find((x) => x.id === "U11")!.value).toContain("unknown");
  });
  it("says the price response is conditional and where the lost purchases go", () => {
    const n = res("A_target").demand.find((d) => d.id === "price_constant")!.note;
    expect(n).toContain("not a forecast");
    expect(n).toContain("do not return to DABS");
  });
});

describe("seller positions (verification checkpoint)", () => {
  it("traces the break-even charge at today's price to one price stack: 1.2 cents together, below cost for the grocer only under the 29.5% split", () => {
    const r = res("C_matched_be");
    const st = r.fixed.stack;
    const own = st.after.shelf - st.after.chargeInPrice;
    expect(r.retailer.sellersTogether).toBeCloseTo(own - (1 - m), 12);
    expect(r.retailer.sellersTogether).toBeCloseTo(vs - N / S, 6);
    expect(st.after.wholesaleMargin + st.after.retailerMargin).toBeCloseTo(r.retailer.sellersTogether, 12);
    expect(st.after.wholesaleMargin).toBeCloseTo((1 - m) / (1 - WHOLESALER_MARGIN) - (1 - m), 12);
    expect(r.retailer.marginShare!).toBeLessThan(0);
    expect(r.retailer.belowCost).toEqual({ grocer: true, sellersTogether: false });
    expect(r.retailer.arithmeticOnly).toBe(true);
    expect(r.retailer.note).toContain("below its acquisition cost");
    expect(r.headline).toContain("arithmetic only");
  });
  it("does not flag arrangements whose sellers stay at or above cost", () => {
    for (const id of ["R1", "R2", "A_target", "B20_matched", "C_take", "C20_matched"]) expect(res(id).retailer.arithmeticOnly, id).toBe(false);
    expect(res("A_matched").retailer.note).toContain("zero gross margin");
  });
});
