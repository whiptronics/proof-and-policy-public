import { describe, expect, it } from "vitest";
import { designBridge, designSplit, whatIf } from "./briefing";
import { INITIATIVES, initiativeFigures } from "./initiatives";
import { alternativesReport } from "./wineAlternatives";

// The briefing's charts lay out the policy alternatives report's results; these checks pin that they add up, so a chart
// can never show a bar the model does not produce.
describe("Utah briefing chart data", () => {
  const alt = alternativesReport();
  const res = (id: string) => alt.results.find((r) => r.def.id === id)!;

  for (const id of ["A_target", "C_take", "B20_matched", "C20_matched"]) {
    const r = res(id);
    const steps = designBridge(r.fixed.ledger, r.def.supply);
    const by = (k: string) => steps.find((s) => s.id === k)!;

    it(`${id}: the bridge ends at the ledger's net change, and the moving steps add up to it`, () => {
      expect(by("net").value).toBeCloseTo(r.fixed.ledger.net, 6);
      const moving = steps.filter((s) => s.kind === "revenue" || s.kind === "cost");
      expect(moving.reduce((t, s) => t + s.value, 0)).toBeCloseTo(r.fixed.ledger.net, 6);
    });

    it(`${id}: each bar starts where the last ended, with finite values`, () => {
      let run = 0;
      for (const s of steps) {
        expect(Number.isFinite(s.value) && Number.isFinite(s.from) && Number.isFinite(s.to)).toBe(true);
        if (s.kind === "subtotal" || s.kind === "total") expect(s.to).toBeCloseTo(run, 6);
        else {
          expect(s.from).toBeCloseTo(run, 6);
          run = s.to;
        }
      }
    });
  }

  it("the take step shows no change in both designs, and the 80% design's lost markup", () => {
    for (const id of ["A_target", "C_take"]) {
      const r = res(id);
      expect(Math.abs(designBridge(r.fixed.ledger, r.def.supply).find((s) => s.id === "take")!.value)).toBeLessThan(0.01);
    }
    const b = res("B20_matched");
    expect(designBridge(b.fixed.ledger, b.def.supply).find((s) => s.id === "take")!.value).toBeLessThan(-1e6);
  });

  const split = designSplit(
    ["A_target", "C_take", "B20_matched"].map((id) => ({ id, label: id, law: "", stack: res(id).fixed.stack })),
    { label: "today", law: "Current law" },
  );
  const at = (id: string) => split.find((k) => k.id === id)!;

  it("every split adds up to its shelf price, and sales tax brings it to the consumer price", () => {
    for (const k of split) {
      const beforeTax = k.segments.filter((s) => s.id !== "sales_tax").reduce((t, s) => t + s.amount, 0);
      const salesTax = k.segments.find((s) => s.id === "sales_tax")!.amount;
      expect(beforeTax).toBeCloseTo(k.shelf, 9);
      expect(beforeTax + salesTax).toBeCloseTo(k.consumer, 9);
      for (const s of k.segments) expect(Number.isFinite(s.amount)).toBe(true);
    }
  });

  it("today is $100 on the shelf; each design's shelf price is its own price stack's", () => {
    expect(at("today").shelf).toBeCloseTo(100, 9);
    expect(at("today").consumer).toBeCloseTo(104.85, 9);
    for (const id of ["A_target", "C_take", "B20_matched"]) expect(at(id).shelf).toBeCloseTo(100 * res(id).fixed.stack.after.shelf, 9);
  });

  // The chart's title says so: "The state keeps its share of every bottle in both designs".
  it("the state's part is at least today's in both designs and smaller in the design to avoid", () => {
    const state = (id: string) => at(id).state;
    expect(state("A_target")).toBeGreaterThanOrEqual(state("today"));
    expect(state("C_take")).toBeGreaterThanOrEqual(state("today"));
    expect(state("B20_matched")).toBeLessThan(state("today"));
    // Markup and charge stay apart: the private design has no DABS markup, the DABS design no charge.
    expect(at("C_take").segments.some((s) => s.kind === "markup")).toBe(false);
    expect(at("A_target").segments.some((s) => s.id === "state_charge")).toBe(false);
  });

  it("the what-if bars are the report's own demand cases and no-savings result", () => {
    for (const id of ["A_target", "C_take"]) {
      const r = res(id);
      const bars = whatIf(r);
      expect(bars.find((b) => b.id === "fixed")!.value).toBeCloseTo(r.fixed.ledger.net, 6);
      expect(bars.find((b) => b.id === "zero_savings")!.value).toBe(r.zeroSavings.net);
      for (const d of r.demand) expect(bars.find((b) => b.id === d.id)!.value).toBe(d.net);
      for (const b of bars) expect(b.from).toBe(0);
    }
  });

  // The page's words: "Only the two readings where shoppers buy less wine come out short."
  it("only the two buy-less readings come out short in either design", () => {
    for (const id of ["A_target", "C_take"]) {
      const short = whatIf(res(id)).filter((b) => b.value < 0).map((b) => b.id);
      expect(short.sort()).toEqual(["price_constant", "price_linear"]);
    }
  });
});

// The briefing and the start page say these in words ("ahead", "short", "above the state store"). If the model ever
// stops supporting a word, this fails and the copy has to be rewritten, not just the number.
describe("the briefing's claims about the designs that keep revenue whole", () => {
  const alt = alternativesReport();
  const net = (id: string, d?: string) => {
    const r = alt.results.find((x) => x.def.id === id)!;
    return d ? r.demand.find((x) => x.id === d)!.net : r.fixed.ledger.net;
  };
  for (const id of ["A_target", "C_take"]) {
    it(`${id}: ahead at fixed volume, if shoppers return to state stores, and with no store savings`, () => {
      expect(net(id)).toBeGreaterThan(0);
      expect(net(id, "return_to_stores")).toBeGreaterThan(0);
      expect(alt.results.find((x) => x.def.id === id)!.zeroSavings.net).toBeGreaterThan(0);
    });
    it(`${id}: grocery wine priced above the state store; short in the fewer-bottles cases`, () => {
      expect(alt.results.find((x) => x.def.id === id)!.fixed.stack.consumerChange).toBeGreaterThan(0);
      expect(net(id, "price_constant")).toBeLessThan(0);
      expect(net(id, "price_linear")).toBeLessThan(0);
    });
  }
  it("the matched-price worked example costs the state under both structures", () => {
    const c = initiativeFigures(INITIATIVES[0]).comparison;
    expect(c.private.lines!.net).toBeLessThan(0);
    expect(c.wholesale.lines!.net).toBeLessThan(0);
  });
});

// docs/briefings/utah-grocery-wine/brief.md (private) quotes these, rounded to $0.1M. If a model change moves one, the
// brief has to be rewritten with it.
describe("the two-page brief's figures", () => {
  const alt = alternativesReport();
  const r = (id: string) => alt.results.find((x) => x.def.id === id)!;
  const m = (v: number) => Math.round(v / 1e5) / 10;
  const d = (id: string, c: string) => m(r(id).demand.find((x) => x.id === c)!.net);

  it("the two designs, the designs to avoid and the October examples", () => {
    expect([m(r("A_target").fixed.ledger.net), m(r("C_take").fixed.ledger.net)]).toEqual([1.4, 1.7]);
    expect([m(r("A_target").zeroSavings.net), m(r("C_take").zeroSavings.net), m(r("C_take_outside").fixed.ledger.net)]).toEqual([0.4, 0.6, 0.6]);
    expect([Math.round(r("A_target").fixed.stack.consumerChange * 100), Math.round(r("C_take").fixed.stack.consumerChange * 100)]).toEqual([39, 51]);
    expect([m(r("B20_matched").fixed.ledger.net), m(r("C20_matched").fixed.ledger.net)]).toEqual([-8.6, -13.3]);
    expect([m(r("R2").fixed.ledger.net), m(r("R1").fixed.ledger.net)]).toEqual([-7.3, -12.1]);
  });

  it("what could change the numbers", () => {
    expect([d("A_target", "return_to_stores"), d("C_take", "return_to_stores")]).toEqual([1.1, 1.3]);
    expect([d("A_target", "price_constant"), d("A_target", "price_linear")]).toEqual([-2.0, -3.0]);
    expect([d("C_take", "price_constant"), d("C_take", "price_linear")]).toEqual([-2.6, -4.2]);
    expect([d("A_target", "all"), d("C_take", "all")]).toEqual([4.4, 3.9]);
  });

  it("school meals: no change in the DABS design when DABS's sales to grocers carry the deposits; $5.3M of a $21.5M charge in the private design", () => {
    const a = r("A_target").fixed;
    const withDeposits = [a.ledger, a.ledgerOtherReading].find((l) => l?.allocations.reading === "deposits_on_grocer_sales")!;
    expect(Math.abs(withDeposits.allocations.funds)).toBeLessThan(1);
    expect(m(-r("C_take").fixed.ledger.allocations.funds)).toBe(5.3);
    expect(m(r("C_take").reconciliation.taxes.charge)).toBe(21.5);
  });
});
