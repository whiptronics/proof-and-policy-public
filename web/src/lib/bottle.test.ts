import { describe, expect, it } from "vitest";
import { bottleScale, dabsAccountsBridge, dabsDollar, statutoryFloor } from "./bottle";
import { designSplit } from "./briefing";
import { INITIATIVES } from "./initiatives";
import { alternativesReport } from "./wineAlternatives";

const data = INITIATIVES[0].worked.data;
const alt = alternativesReport();
const get = (id: string) => alt.results.find((r) => r.def.id === id)!;

describe("one bottle", () => {
  it("the statute's floor: $10 landed, 88.5% markup, $18.85 before sales tax", () => {
    const f = statutoryFloor(10);
    expect(f.markup).toBeCloseTo(8.85, 10);
    expect(f.price).toBeCloseTo(18.85, 10);
  });

  it("a $10 bottle at DABS's observed margin: the supplier gets $10 and the state-store price follows from 47.2%", () => {
    const st = get("A_target").fixed.stack;
    const k = bottleScale(st.today, 10);
    const [today] = designSplit([{ id: "a", label: "", law: "", stack: st }], { label: "", law: "" }, k);
    expect(today.segments.find((s) => s.id === "supplier")!.amount).toBeCloseTo(10, 10);
    expect(today.shelf).toBeCloseTo(10 / (1 - data.grossProfit / data.sales), 8);
    // DABS's average markup on cost is above the statutory floor (it is a floor, and DABS's figure is all products).
    expect(today.segments.find((s) => s.id === "dabs_margin")!.amount / 10).toBeGreaterThan(0.885);
  });

  it("scales every design's split by the same factor, so the same bottle costs the same to land in each", () => {
    const k = bottleScale(get("A_target").fixed.stack.today, 12.5);
    const cols = designSplit(
      ["A_target", "C_take", "B20_matched"].map((id) => ({ id, label: id, law: "", stack: get(id).fixed.stack })),
      { label: "today", law: "" },
      k,
    );
    for (const c of cols) expect(c.segments.find((s) => s.id === "supplier")!.amount, c.id).toBeCloseTo(12.5, 8);
  });

  it("refuses a landed cost that is not positive", () => {
    expect(() => bottleScale(get("A_target").fixed.stack.today, 0)).toThrow();
  });
});

describe("where a dollar of DABS's FY2025 sales went", () => {
  it("adds up to the dollar, from the income statement's own lines", () => {
    const parts = dabsDollar(data);
    expect(parts.reduce((t, p) => t + p.share, 0)).toBeCloseTo(1, 12);
    const by = (id: string) => parts.find((p) => p.id === id)!.share;
    expect(by("cost")).toBeCloseTo(291_057 / 551_346, 12);
    expect(by("net_profit")).toBeCloseTo(100_465 / 551_346, 12);
    // Markup is not profit: of the gross margin, less than half reaches the General Fund as net profit.
    expect(by("net_profit") / (1 - by("cost"))).toBeLessThan(0.5);
  });

  it("throws when a statement line does not reconcile", () => {
    expect(() => dabsDollar({ ...data, statement: { ...data.statement, netProfit: data.statement.netProfit + 1_000_000 } })).toThrow(/net profit/);
  });
});

describe("DABS's FY2025 accounts, sales to net profit", () => {
  it("passes through the printed gross profit and net operating income and ends at the printed net profit", () => {
    const steps = dabsAccountsBridge(data);
    const by = (id: string) => steps.find((s) => s.id === id)!;
    expect(by("sales").to).toBe(551_346_000);
    expect(by("gross_profit").value).toBeCloseTo(data.grossProfit, 6);
    expect(by("noi").value).toBeCloseTo(data.statement.netOperatingIncome, 6);
    expect(by("net_profit").value).toBeCloseTo(100_465_000, 6);
    // Gross collections are not net revenue: net profit is under a fifth of sales.
    expect(by("net_profit").value / by("sales").value).toBeLessThan(0.2);
  });

  it("throws when the statement does not reconcile", () => {
    expect(() => dabsAccountsBridge({ ...data, statement: { ...data.statement, nonOperatingNet: data.statement.nonOperatingNet - 1_000_000 } })).toThrow();
  });
});
