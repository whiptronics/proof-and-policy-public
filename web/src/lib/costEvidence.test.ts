import { describe, expect, it } from "vitest";
import { evidenceRanges, extensionSummary, impliedAvoidable, impliedRows, impliedSpan, marginSpreadOf, type CostModel, type ExtensionCheck } from "./costEvidence";

const spec = (horizon_years: number, weighting: "dollars" | "state_size_normalized", beta: number, lo: number, hi: number) => ({
  horizon_years,
  weighting,
  level: 0.95,
  beta,
  se: 0.1,
  df: 16,
  ci_low: lo,
  ci_high: hi,
  n: 600,
  clusters: 17,
  year_groups: 40,
  leave_one_state_out: null,
});

// The slopes the Census panel gives (FY1972-FY2015, 17 states), rounded.
const MODEL: CostModel = {
  method: "store-cost@1.0",
  outcome: "",
  regressor: "",
  model: "",
  sample: { state_years: 666, states: [], first_year: 1972, last_year: 2015, pooled_expenditure_per_revenue_dollar: 0.8115 },
  excluded: [],
  estimates: [
    spec(1, "dollars", 0.675, 0.455, 0.895),
    spec(1, "state_size_normalized", 0.135, -0.032, 0.303),
    spec(5, "dollars", 0.832, 0.625, 1.039),
    spec(5, "state_size_normalized", 0.434, 0.195, 0.673),
  ],
};

describe("slope to operating cost", () => {
  it("subtracts the cost of goods, one minus the margin", () => {
    const i = impliedAvoidable(0.675, 0.455, 0.895, 0.4695);
    expect(i.raw).toBeCloseTo(0.675 - 0.5305, 6);
    expect(i.value).toBeCloseTo(0.1445, 4);
    expect(i.low).toBe(0); // 0.455 - 0.5305 < 0
    expect(i.high).toBeCloseTo(0.3645, 4);
    expect(i.floored).toBe(false);
  });
  it("shows zero, and says so, when the slope is below the cost of goods alone", () => {
    const i = impliedAvoidable(0.135, -0.032, 0.303, 0.4695);
    expect(i.value).toBe(0);
    expect(i.floored).toBe(true);
    expect(i.high).toBe(0);
  });
  it("spans every specification", () => {
    const span = impliedSpan(impliedRows(MODEL, 0.4695))!;
    expect(span.low).toBe(0);
    expect(span.high).toBeCloseTo(1.039 - 0.5305, 4);
    expect(impliedSpan([])).toBeNull();
  });
});

describe("evidence ranges", () => {
  it("bounds avoidable cost between none and all of DABS's operating expenses", () => {
    const r = evidenceRanges({ opexShare: 0.1486, marginSpread: null });
    expect(r.avoidableCost).toMatchObject({ low: 0, high: 0.1486 });
    expect(r.grossMargin).toBeUndefined();
  });
  it("uses the spread of reported margins for gross margin", () => {
    const ms = marginSpreadOf([
      { year: 2020, sales: 500.212, gp: 229.517 },
      { year: 2021, sales: 517.39, gp: 235.239 },
      { year: 2022, sales: 557.452, gp: 254.504 },
      { year: 2023, sales: 579.05, gp: 272.259 },
      { year: 2024, sales: null, gp: 254.897 }, // sales conflict between tables: left out
      { year: 2025, sales: 551.346, gp: 260.289 },
    ])!;
    expect(ms.years).toEqual([2020, 2021, 2022, 2023, 2025]);
    expect(ms.low).toBeCloseTo(0.4547, 4);
    expect(ms.high).toBeCloseTo(0.4721, 4);
    const r = evidenceRanges({ opexShare: null, marginSpread: ms });
    expect(r.grossMargin!.low).toBeCloseTo(0.4547, 4);
    expect(r.grossMargin!.basis).toContain("FY2020-FY2025");
    expect(r.avoidableCost).toBeUndefined();
  });
  it("offers nothing when there is nothing to bound", () => {
    expect(evidenceRanges({ opexShare: null, marginSpread: null })).toEqual({});
    expect(marginSpreadOf([{ year: 2025, sales: 5, gp: 2 }])).toBeNull();
  });
});

describe("the later Census years, as a comparison", () => {
  const sample = (state_years: number, last_year: number) => ({ state_years, states: [], first_year: 1972, last_year, pooled_expenditure_per_revenue_dollar: 0.81 });
  const slope = (k: number, w: "dollars" | "state_size_normalized", b: number[], e: number[], outB: boolean, outE: boolean) => ({
    horizon_years: k,
    weighting: w,
    base: { beta: b[0], ci_low: b[1], ci_high: b[2], n: 632, clusters: 17 },
    extended: { beta: e[0], ci_low: e[1], ci_high: e[2], n: 764, clusters: 17 },
    change: e[0] - b[0],
    extended_outside_base_interval: outB,
    base_outside_extended_interval: outE,
  });
  const X: ExtensionCheck = {
    method: "store-cost@1.0",
    base_sample: sample(666, 2015),
    extended_sample: sample(801, 2024),
    extended_excluded: [{ geo_id: "state:28", year: 2020, why: "flagged" }, { geo_id: "state:26", year: 2016, why: "repeat" }],
    extended_differences_across_comparability_groups: { "1": [{ geo_id: "state:41", from_year: 2015, to_year: 2016 }], "5": [] },
    slopes: [
      slope(1, "dollars", [0.675, 0.455, 0.895], [0.826, 0.675, 0.977], false, true),
      slope(1, "state_size_normalized", [0.135, -0.032, 0.303], [0.249, 0.031, 0.468], false, false),
    ],
    any_slope_outside_the_other_interval: true,
  };

  it("says how many years were added, what was left out and whether slopes left each other's intervals", () => {
    const s = extensionSummary(X);
    expect(s).toContain("reach FY2024");
    expect(s).toContain("FY2016-FY2024 added (135 more state-years, after leaving out 2 that are flagged or repeat the year before, and 1 changes");
    expect(s).toContain("run 0.25 to 0.83, against 0.14 to 0.68 here; in 1 of 2, one slope falls outside");
    expect(s).toContain("stays on FY1972-FY2015");
    expect(extensionSummary({ ...X, slopes: [X.slopes[1]] })).toContain("none falls outside the other's interval");
    expect(extensionSummary({ ...X, slopes: [] })).toBe("");
  });

  it("is optional in the model the scenario reads", () => {
    const m: CostModel = { ...MODEL, extension_check: X };
    expect(m.extension_check?.extended_sample.last_year).toBe(2024);
    expect(MODEL.extension_check).toBeUndefined();
  });
});
