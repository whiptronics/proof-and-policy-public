import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SWEEPS } from "./arrangements";
import { INITIATIVES } from "./initiatives";
import { WORKED_PROPOSALS } from "./scenario";
import { SENSITIVITY_RANGES } from "./scenarioRanges";
import { ALTERNATIVES, alternativesReport } from "./wineAlternatives";
import { FLOW_ARRANGEMENTS, arrangementTerms } from "./wineFlows";
import { GRID_ARRANGEMENTS, ROLES } from "./winePriceShare";

// Ethan's review, 2026-11-15: the full analysis page and the scenario tool describe DABS's price to grocers ("80% of
// the shelf price"), not a "discount". The lever keeps its name in code and data (`dc`, x.discount: the share below
// the shelf price); only words a reader sees are checked here.
const WORD = /discount/i;
// Code that names the lever (string keys, object keys, fields, ids) and comments. No bare `discount:` pattern: it
// also matches prose.
const CODE =
  /"discount"|\.discount\b|(^|[{,(])\s*discount\??:|lawfulDiscount|breakEvenDiscount|break_even_discount|dabs_discount_20|\/\/.*$|\/\*[\s\S]*?\*\//gm;

describe("reader-facing words say DABS's price to grocers, not a discount", () => {
  it("in the alternatives, price-share grids, purchase flows and the proposal", () => {
    const words = [
      ...ALTERNATIVES.flatMap((a) => [a.label, a.short, a.defines]),
      ...alternativesReport().results.flatMap((r) => r.legal.map((l) => l.text)),
      ...GRID_ARRANGEMENTS.flatMap((a) => [a.label, a.short, a.lever.words]),
      ...ROLES.map((r) => r.quantity),
      ...FLOW_ARRANGEMENTS.flatMap((id) => {
        const t = arrangementTerms(id);
        return [t.label, t.short, t.note];
      }),
      ...INITIATIVES.flatMap((i) => i.proposal),
    ];
    expect(words.filter((w) => WORD.test(w))).toEqual([]);
  });

  it("in the scenario tool's worked proposals, sweeps and sensitivity ranges", () => {
    const words = [
      ...WORKED_PROPOSALS.flatMap((p) => [p.label, ...p.proposal.map((x) => x.text), ...p.demonstrates, ...p.cannotEstablish]),
      ...Object.values(SWEEPS).flatMap((s) => [s.label, s.note]),
      ...Object.values(SENSITIVITY_RANGES).flatMap((r) => [r.label, r.basis]),
    ];
    expect(words.filter((w) => WORD.test(w))).toEqual([]);
  });

  for (const f of ["views/InitiativeView", "views/PriceShareSection", "views/FlowsSection", "views/ScenarioView", "components/ArrangementComparison", "lib/scenario", "lib/arrangements", "views/BriefingView", "lib/briefing", "components/BriefCharts"]) {
    it(`in ${f}`, () => {
      const file = join(__dirname, "..", `${f}${f.startsWith("lib/") ? ".ts" : ".tsx"}`);
      const src = readFileSync(file, "utf8").replace(CODE, "");
      expect(src.split("\n").filter((l) => WORD.test(l))).toEqual([]);
    });
  }
});
