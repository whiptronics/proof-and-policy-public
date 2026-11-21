import { describe, expect, it } from "vitest";
import { STATE_CASES, SAFEGUARDS, businessImpacts, feeBurden, frameworkPoints, hardQuestions, headline } from "./framework";
import { DESIGNS, defaultDesignsReport } from "./policyDesigns";
import { LAW_SOURCES, STATUTE_ROWS, amendmentsFor, openQuestionsFor } from "./statutes";

const r = defaultDesignsReport();
const texts = (): string[] => [
  ...frameworkPoints(r).flatMap((p) => [p.title, p.proposal, p.basis]),
  ...hardQuestions(r).flatMap((q) => [q.q, q.a]),
  ...businessImpacts(r).map((i) => i.effect),
  ...STATE_CASES.flatMap((c) => [c.legal, c.applies, c.concurrent, ...c.evidence.map((e) => e.text)]),
];

describe("statute matrix", () => {
  it("has unique ids, a known source for every row, and no row that touches no design", () => {
    const ids = STATUTE_ROWS.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const row of STATUTE_ROWS) {
      expect(LAW_SOURCES.some((s) => s.id === row.source), row.id).toBe(true);
      expect(Object.keys(row.by).length, row.id).toBeGreaterThan(0);
    }
  });
  it("orders the designs by legal complexity: today < B < C = D < E", () => {
    const n = (d: "A" | "B" | "C" | "D" | "E") => amendmentsFor(d).length;
    expect(n("A")).toBe(0);
    expect(n("B")).toBeLessThan(n("C"));
    expect(n("C")).toBe(n("D"));
    expect(n("D")).toBeLessThan(n("E"));
    expect(openQuestionsFor("D").map((x) => x.id)).toContain("M16");
  });
  it("feeds criterion 10 of the comparison", () => {
    const law = r.criteria.find((c) => c.id === "law")!;
    for (const d of DESIGNS) expect(law.cells[d.id]).toBe(`${amendmentsFor(d.id).length} amendments, ${openQuestionsFor(d.id).length} open questions`);
  });
});

describe("framework content", () => {
  it("covers the plan's 14 framework points and 20 questions", () => {
    expect(frameworkPoints(r).map((p) => p.n)).toEqual(Array.from({ length: 14 }, (_, i) => i + 1));
    expect(hardQuestions(r)).toHaveLength(20);
  });
  it("prints no broken numbers", () => {
    for (const t of texts()) expect(t).not.toMatch(/NaN|undefined|Infinity|\$-/);
  });
  it("quotes the model's own figures", () => {
    const h = headline(r);
    expect(h.bFixed).toBeCloseTo(r.results[1].cases.find((c) => c.savings === "none" && c.limit === null)!.net, 6);
    expect(h.b30).toBeCloseTo(-h.admin, 0);
    expect(h.b30Fees).toBeCloseTo(0, 0);
    expect(h.fee * 411).toBeCloseTo(h.admin, 3);
  });
  it("makes a flat fee weigh more on smaller stores", () => {
    const f = feeBurden(r);
    expect(f[0].feeShare).toBeLessThan(f[1].feeShare);
    expect(f[2].feeShare).toBeCloseTo(f[0].feeShare * 10, 9);
  });
  it("marks every safeguard against current law with a citation", () => {
    for (const s of SAFEGUARDS) expect(s.cite.length, s.name).toBeGreaterThan(2);
    expect(SAFEGUARDS.filter((s) => s.status === "new").length).toBeGreaterThan(0);
  });
  it("labels every state finding with its evidence strength and a source", () => {
    for (const c of STATE_CASES) for (const e of c.evidence) expect(e.url.length, `${c.id}: ${e.label}`).toBeGreaterThan(3);
    expect(STATE_CASES.find((c) => c.id === "tn")!.evidence.map((e) => e.strength)).toContain("causal_estimate");
  });
});
