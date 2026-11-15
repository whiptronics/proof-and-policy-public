import { describe, expect, it } from "vitest";
import { EVIDENCE, EVIDENCE_ORDER, REVIEW_STATUS } from "./evidence";
import { INITIATIVES, initiativeFigures } from "./initiatives";

describe("evidence classes and the assumption register", () => {
  it("lists every class once, each with its own symbol", () => {
    expect([...EVIDENCE_ORDER].sort()).toEqual(Object.keys(EVIDENCE).sort());
    expect(new Set(EVIDENCE_ORDER.map((c) => EVIDENCE[c].symbol)).size).toBe(EVIDENCE_ORDER.length);
  });

  it("never says a person reviewed or verified anything", () => {
    expect(REVIEW_STATUS).toMatch(/^Not yet reviewed by a person\./);
    for (const c of EVIDENCE_ORDER) expect(`${EVIDENCE[c].label} ${EVIDENCE[c].help}`).not.toMatch(/verified|reviewed|checked by/i);
  });

  for (const init of INITIATIVES) {
    it(`${init.id}: every input has a known class, and every tested range is a robustness row the page computes`, () => {
      const rows = new Set(initiativeFigures(init).robustness.rows.map((r) => r.id));
      for (const a of init.worked.assumptions) {
        expect(EVIDENCE_ORDER, a.item).toContain(a.basis);
        if (a.range) expect(rows.has(a.range), `${a.item} → ${a.range}`).toBe(true);
      }
      // Each illustrative or proxy input is the kind a reader most needs a range for: none may go untested.
      for (const a of init.worked.assumptions.filter((x) => x.basis === "illustrative" || x.basis === "proxy")) {
        if (a.item === "Grocery prices" || a.item.startsWith("Sellers")) continue; // tested by the price-share grid and the margin split, not the table
        expect(a.range, a.item).toBeTruthy();
      }
    });
  }
});
