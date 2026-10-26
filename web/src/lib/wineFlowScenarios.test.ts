import { describe, expect, it } from "vitest";
import { DEFAULT_FLOWS, FLOW_ARRANGEMENTS, arrangementTerms, checkFlows, computeFlows, withFlows } from "./wineFlows";
import {
  NAMED_SCENARIOS,
  breakEvenTable,
  collectionFrontier,
  migrationPriceGrid,
  scenarioById,
  scenarioRuns,
  sensitivityTable,
  termsAtGrocerMargin,
  termsAtPremium,
} from "./wineFlowScenarios";

const runs = scenarioRuns();
const run = (arr: string, sc: string) => runs.find((r) => r.arrangement.id === arr && r.scenario.id === sc)!;

describe("named scenarios", () => {
  it("are valid inputs with unique ids, and the accounting case is the default", () => {
    expect(new Set(NAMED_SCENARIOS.map((s) => s.id)).size).toBe(NAMED_SCENARIOS.length);
    for (const s of NAMED_SCENARIOS) expect(checkFlows(s.inputs), s.id).toEqual([]);
    expect(scenarioById("accounting_30").inputs).toBe(DEFAULT_FLOWS);
  });
  it("every run reconciles and has no negative quantity", () => {
    for (const r of runs) {
      expect(r.result.reconciles, `${r.arrangement.id}/${r.scenario.id}`).toBe(true);
      for (const t of [r.result.baseline, r.result.proposed]) for (const c of t.cells) expect(c.litres, `${r.scenario.id} ${c.beverage}`).toBeGreaterThanOrEqual(-1e-6);
      for (const o of r.result.origins) expect(Math.min(o.grocery.storeEquivalent, o.dabs.storeEquivalent)).toBeGreaterThanOrEqual(-1e-6);
    }
  });
  it("say correctly whether total alcohol is unchanged", () => {
    const unchanged = ["accounting_30", "channel_60", "channel_30", "channel_15", "declined_outside_utah", "beer_2", "beer_5", "beer_5_split", "spirits_2", "spirits_5", "recapture_2", "costs_high", "license_fees", "restructuring"];
    const changed = ["declined_not_bought", "migrant_response", "beer_5_volume", "beer_5_spending", "additional_2", "combined_illustrative", "combined_adverse"];
    expect([...unchanged, ...changed].sort()).toEqual(NAMED_SCENARIOS.map((s) => s.id).sort());
    // These change alcohol only through the grocery price: at today's price (the matched designs) nothing changes.
    const priceOnly = ["declined_not_bought", "migrant_response", "combined_adverse"];
    for (const id of FLOW_ARRANGEMENTS) {
      const dear = arrangementTerms(id).consumerRatio > 1 + 1e-9;
      for (const s of unchanged) expect(run(id, s).totalAlcoholUnchanged, `${id}/${s}`).toBe(true);
      for (const s of changed) expect(run(id, s).totalAlcoholUnchanged, `${id}/${s}`).toBe(priceOnly.includes(s) && !dear);
    }
  });
  it("the declined-purchase scenarios differ from channel choice only by where the declined purchases go", () => {
    for (const id of FLOW_ARRANGEMENTS) {
      const base = run(id, "channel_30").result;
      const none = run(id, "declined_not_bought").result;
      expect(none.migrationUsed).toBeCloseTo(base.migrationUsed, 12);
      const lost = none.lines.find((l) => l.id === "declined_not_bought")!.value;
      expect(none.change.net - base.change.net).toBeCloseTo(lost, 4);
      expect(lost).toBeLessThanOrEqual(0);
    }
  });
});

describe("grocery prices", () => {
  it("solve for the premium and the grocer's margin asked for", () => {
    for (const id of ["preserved_dabs", "preserved_private", "dabs_discount_20", "private_tax_20"] as const) {
      for (const p of [0, 0.2, 0.5]) expect(termsAtPremium(id, p)!.consumerRatio, `${id} ${p}`).toBeCloseTo(1 + p, 9);
    }
    for (const id of ["preserved_dabs", "preserved_private"] as const) expect(termsAtGrocerMargin(id, 0.28)!.grocerMarginShare).toBeCloseTo(0.28, 9);
    // The preserved designs priced for a 28% grocer margin are the arrangements' own terms.
    expect(termsAtGrocerMargin("preserved_dabs", 0.28)!.shelf).toBeCloseTo(arrangementTerms("preserved_dabs").shelf, 9);
    // Changing the price leaves the state's collection per bottle as the arrangement sets it.
    expect(termsAtPremium("preserved_private", 0.1)!.stateCollection).toBeCloseTo(arrangementTerms("preserved_private").stateCollection, 12);
  });
  it("migration falls to zero at the convenience limit and the declined purchases stay at DABS", () => {
    const g = migrationPriceGrid();
    for (const k of g) {
      if (k.limit === null) expect(k.migrationUsed).toBeCloseTo(k.migrationAtParity, 12);
      else if (k.premium >= k.limit - 1e-9) {
        expect(k.migrationUsed).toBeCloseTo(0, 9);
        expect(k.net).toBeCloseTo(-DEFAULT_FLOWS.costs.admin, 4);
      }
    }
  });
});

describe("break-even", () => {
  const t = breakEvenTable();
  it("each value found brings the net change to about zero, and the status follows the end points", () => {
    for (const r of t) {
      if (r.status === "found") expect(Math.abs(r.check!), `${r.arrangement}/${r.context}/${r.lever}`).toBeLessThan(1);
      if (r.status === "already_above") expect(r.atLow).toBeGreaterThanOrEqual(-0.005);
      if (r.status === "wrong_direction") expect(r.atHigh).toBeLessThan(r.atLow);
      if (r.status === "no_effect") expect(r.atHigh).toBeCloseTo(r.atLow, 2);
      if (r.status === "unattainable_in_range") expect(r.atHigh).toBeLessThan(0);
    }
  });
  it("when nobody moves at the grocery price, migration has no effect (not a wrong direction)", () => {
    for (const id of ["preserved_dabs", "preserved_private"]) expect(t.find((r) => r.arrangement === id && r.context === "channel_30" && r.lever === "migration")!.status).toBe("no_effect");
  });
  it("preserved designs at a fixed 30% are already above; discount designs need a lever", () => {
    for (const r of t.filter((k) => k.context === "accounting_30")) {
      if (r.arrangement.startsWith("preserved") && r.lever !== "migration") expect(r.status, `${r.arrangement}/${r.lever}`).toBe("already_above");
      if (r.arrangement === "dabs_discount_20" && r.lever !== "migration") expect(r.status, r.lever).toBe("found");
      if (r.arrangement === "dabs_discount_20" && r.lever === "migration") expect(r.status).toBe("wrong_direction");
    }
  });
  it("the collection frontier starts preserved (no lever needed) and needs more as the collection falls", () => {
    const f = collectionFrontier().filter((k) => k.family === "dabs_discount" && k.lever === "additional");
    expect(f[0].setting).toBe(0);
    expect(f[0].status).toBe("already_above");
    const found = f.filter((k) => k.status === "found");
    for (let i = 1; i < found.length; i++) expect(found[i].value!).toBeGreaterThan(found[i - 1].value!);
    for (let i = 1; i < f.length; i++) expect(f[i].x).toBeLessThan(f[i - 1].x);
  });
});

describe("sensitivity", () => {
  it("runs the context's own net at the base and skips parameters that do not apply", () => {
    const s = sensitivityTable();
    for (const r of s) {
      expect(r.base).toBeCloseTo(computeFlows(arrangementTerms(r.arrangement), scenarioById(r.context).inputs).change.net, 6);
      if (r.param.id === "handling") expect(r.low === null).toBe(arrangementTerms(r.arrangement).supply !== "dabs");
      if (r.param.id === "grocer_margin") expect(r.low === null).toBe(!r.arrangement.startsWith("preserved"));
      // Beer values cannot matter when no beer is replaced.
      if (r.context === "accounting_30" && ["beer_price", "beer_excise", "beer_household", "wine_price"].includes(r.param.id)) {
        expect(r.low!).toBeCloseTo(r.base, 4);
        expect(r.high!).toBeCloseTo(r.base, 4);
      }
    }
    // Admin at $1M costs exactly $500k more than at $500k.
    const a = s.find((r) => r.arrangement === "preserved_dabs" && r.context === "accounting_30" && r.param.id === "admin")!;
    expect(a.base - a.high!).toBeCloseTo(500_000, 4);
    expect(computeFlows(arrangementTerms("preserved_dabs"), withFlows(DEFAULT_FLOWS, { costs: { admin: 1_000_000 } })).change.net).toBeCloseTo(a.high!, 6);
  });
});
