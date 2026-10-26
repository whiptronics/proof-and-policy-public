import { describe, expect, it } from "vitest";
import { jointScenarios } from "./arrangements";
import { INITIATIVES, initiativeById, initiativeFigures, jointNets, proposalInputs, workedBounds } from "./initiatives";
import { WORKED_PROPOSALS } from "./scenario";

// The Utah brief's figures (docs/briefings/utah-grocery-wine/brief.md), which scripts/grocery_wine_briefing_example.py
// recomputes by hand. The page computes them from the models; these pin them so the page, the brief and the script agree.
describe("the Utah grocery-wine initiative page", () => {
  const ut = initiativeById("ut_grocery_wine")!;
  const f = initiativeFigures(ut);

  it("is found by id and is the default", () => {
    expect(ut).not.toBeNull();
    expect(INITIATIVES[0].id).toBe("ut_grocery_wine");
    expect(initiativeById("nope")).toBeNull();
  });

  it("uses the worked comparison's settings and gives the brief's FY2025 figures", () => {
    expect(f.settings.priceCase).toBe("matched");
    expect(f.moved).toBeCloseTo(45_436_423.86, 1);
    expect(f.baseline).toBeCloseTo(96_154_809.14, 1);
    expect(f.comparison.private.lines!.net).toBeCloseTo(-12_105_857.99, 1);
    expect(f.comparison.wholesale.lines!.net).toBeCloseTo(-7_315_463.58, 1);
    expect(f.school + f.enforcement).toBeCloseTo(5_313_789.77, 1);
    expect(f.comparison.private.breakEven.value!).toBeCloseTo(0.7639850249, 6);
    expect(f.comparison.wholesale.breakEven.value!).toBeCloseTo(0.0389956128, 6);
  });

  it("gives the brief's substitution thresholds", () => {
    expect(f.substitution.private.threshold.wineGallons!).toBeCloseTo(1_266_173.94, 0);
    expect(f.substitution.wholesale.threshold.wineGallons!).toBeCloseTo(473_014.71, 0);
    expect(f.substitution.private.ethanolAdded).toBe(0);
  });

  it("reads the worked proposal's own address fields, as the scenario tool does", () => {
    const p = WORKED_PROPOSALS.find((w) => w.id === ut.worked.proposalId)!;
    expect(f.values).toBe(p.values);
    expect(f.inputs.shift).toBeCloseTo(0.3, 12);
    expect(f.inputs.eligible).toBeCloseTo(0.82, 12);
    expect(f.inputs.wineSales).toBeCloseTo(0.335 * ut.worked.data.sales, 4);
    expect(f.inputs.grossMargin).toBeCloseTo(ut.worked.data.grossProfit / ut.worked.data.sales, 12);
    expect(proposalInputs({ ...p.values, s: "40" }, ut.worked.data).shift).toBeCloseTo(0.4, 12);
  });

  // What would have to be true for each structure to break even. The closed forms at matched prices (net change per
  // dollar that moves: private -m + a/(1+a) + v, DABS v - d; less new costs N) are recomputed independently by
  // scripts/grocery_wine_robustness_check.py.
  it("gives the break-even thresholds and tested ranges", () => {
    const r = f.robustness;
    const row = (id: string) => r.rows.find((x) => x.id === id)!;
    expect(r.net.private).toBeCloseTo(f.comparison.private.lines!.net, 4);
    expect(r.net.wholesale).toBeCloseTo(f.comparison.wholesale.lines!.net, 4);
    expect(r.keepAtBreakEven).toBeCloseTo(0.0389956128, 9);
    expect(r.perDollar.private).toBeCloseTo(-0.2554307096, 9);
    expect(r.perDollar.wholesale).toBeCloseTo(-0.15, 12);
    expect(r.lawfulDiscount).toBeCloseTo(0.0049035542, 9);
    expect(r.statuteMargins.floor).toBeCloseTo(0.885 / 1.885, 12);
    expect(r.statuteMargins.smallMaker).toBeCloseTo(0.49 / 1.49, 12);
    expect(row("avoidable").zero.private).toBeCloseTo(0.3164350967, 8);
    expect(row("avoidable").zero.wholesale).toBeCloseTo(0.2110043872, 8);
    expect(row("margin").zero.private).toBeCloseTo(0.2056622795, 8);
    expect(row("margin").zero.wholesale).toBeNull();
    for (const id of ["shift", "eligible", "scope", "share", "newCosts"]) {
      expect(row(id).zero).toEqual({ private: null, wholesale: null });
      for (const end of [row(id).atLow, row(id).atHigh]) {
        expect(end.private).toBeLessThan(0);
        expect(end.wholesale).toBeLessThan(0);
      }
    }
    expect(row("shift").atHigh.private).toBeCloseTo(-15_974_477.32, 1);
    expect(row("margin").atLow.private).toBeCloseTo(-5_597_621.16, 1);
    expect(row("avoidable").atHigh.wholesale).toBeCloseTo(-5_138_051.28, 1);
    const ceiling = r.joint.find((j) => j.id === "ceiling")!;
    expect(ceiling.net.private).toBeCloseTo(-6_335_400.32, 1);
    expect(ceiling.net.wholesale).toBeCloseTo(-2_337_081.67, 1);
    // The same ceiling with the income statement's non-operating depreciation and interest also avoidable (p. 30).
    expect(r.ceilingAllExpenses.avoid).toBeCloseTo((81_910_000 + 18_071_000) / 551_346_000, 12);
    expect(r.ceilingAllExpenses.net.private).toBeCloseTo(-4_846_169.21, 1);
    expect(r.ceilingAllExpenses.net.wholesale).toBeCloseTo(-847_850.56, 1);
    expect(r.ceilingAllExpenses.avoid).toBeLessThan(row("avoidable").zero.wholesale!);
  });

  it("computes the joint rows exactly as the comparison's joint scenarios do", () => {
    const b = workedBounds(ut.worked.data);
    const full = jointScenarios(f.inputs, f.settings, ut.worked.rates, b);
    for (const j of jointNets(f.inputs, f.settings, b)) {
      const s = full.find((x) => x.id === j.id)!;
      expect(j.net.private).toBeCloseTo(s.private.net!, 4);
      expect(j.net.wholesale).toBeCloseTo(s.wholesale.net!, 4);
      expect(j.breakEven.private).toBeCloseTo(s.private.breakEven!, 9);
      expect(j.breakEven.wholesale).toBeCloseTo(s.wholesale.breakEven!, 9);
    }
  });

  it("keeps the advocate's goal apart from the findings and labels every assumption", () => {
    for (const i of INITIATIVES) {
      expect(i.advocacy.goal.length).toBeGreaterThan(0);
      for (const a of i.worked.assumptions) expect(["source", "assumption", "policy"]).toContain(a.basis);
    }
  });
});
