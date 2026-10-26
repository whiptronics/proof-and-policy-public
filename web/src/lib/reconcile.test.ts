import { describe, expect, it } from "vitest";
import { cellText, ratePct, residualPoints, share, tally, thousands, valueHref } from "./reconcile";
import type { BridgeYear } from "./types";

const year = (fy: number, sales: number[], residuals: Record<string, number | null>, status: BridgeYear["status"] = "reconciles_numerically"): BridgeYear => ({
  fiscal_year: fy,
  dabs_sales: sales.map((value) => ({ value, provisional: false })),
  dabs_sales_conflict: sales.length > 1,
  reported_deposits: { school_meals: [], enforcement_fund: [] },
  reported_share_of_sales: { school_meals: null, enforcement_fund: null },
  statutory_rates: { school_meals: null, enforcement_fund: null },
  census_receipts: [],
  audited_fund_sales: [],
  compared_with: "census",
  variants: sales.flatMap((s, i) => [
    { sales: s, kind: "statutory" as const, school_meals: null, enforcement_fund: null, sales_less_deposits: null, residual: residuals[`s${i}`] ?? null, within_tolerance: null },
    { sales: s, kind: "reported" as const, school_meals: null, enforcement_fund: null, sales_less_deposits: null, residual: residuals[`r${i}`] ?? null, within_tolerance: null },
  ]),
  reconciles_with: [],
  status,
  uses_provisional: false,
  note: null,
});

describe("reconciliation display", () => {
  it("formats thousands, shares and statutory rates without inventing zeros", () => {
    expect(thousands(445_208_000)).toBe("445,208");
    expect(thousands(-1_074_700)).toBe("−1,075");
    expect(thousands(null)).toBe("—");
    expect(share(0.47212)).toBe("47.2%");
    expect(ratePct(0.00875)).toBe("0.875%");
    expect(ratePct(0.01695)).toBe("1.695%");
    expect(ratePct(0.1)).toBe("10%");
  });

  it("charts the first sales figure of a conflicting year and marks it", () => {
    const pts = residualPoints([year(2023, [579_050_000], { s0: -1_074_700, r0: -1_084_000 }, "unresolved"), year(2024, [578_856_000, 583_836_000], { s0: 17_513_800, r0: 7_693_000, s1: 21_911_400 }, "unresolved")]);
    expect(pts[0]).toMatchObject({ fy: 2023, label: "FY2023", conflict: false });
    expect(pts[0].statutory).toBeCloseTo(-1.0747, 4);
    expect(pts[1]).toMatchObject({ label: "FY2024*", conflict: true });
    expect(pts[1].statutory).toBeCloseTo(17.5138, 4);
    expect(pts[1].reported).toBeCloseTo(7.693, 4);
  });

  it("keeps a missing residual missing", () => {
    expect(residualPoints([year(2019, [479_324_000], { s0: 10_400 })])[0].reported).toBeNull();
  });

  it("counts reconciled and unresolved years separately", () => {
    expect(tally([year(2020, [1], {}), year(2023, [1], {}, "unresolved")])).toEqual({ reconciled: [2020], unresolved: [2023] });
  });

  it("shows every candidate in a peer cell and ratios as percentages", () => {
    expect(cellText([{ value: 578_856_000, provisional: false }, { value: 583_836_000, provisional: false }])).toBe("578,856 or 583,836");
    expect(cellText([{ value: 0.3043, ratio: true, provisional: true }])).toBe("30.4%");
    expect(cellText([])).toBe("—");
  });

  it("links a pinned value to its record and a provisional one to its page", () => {
    expect(valueHref({ value: 1, rec: "obs:m@k:1", provisional: false })).toEqual({ rec: "obs:m@k:1" });
    expect(valueHref({ value: 1, url: "https://x.gov/a.pdf", page: "16", provisional: true })).toEqual({ url: "https://x.gov/a.pdf#page=16" });
  });
});
