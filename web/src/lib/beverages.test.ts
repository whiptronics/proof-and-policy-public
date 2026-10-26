import { describe, expect, it } from "vitest";
import { GALLONS_PER_9L_CASE, change, sameMonthChanges, sharesOf } from "./beverages";

describe("beverage shares", () => {
  it("are shares of the three beverages' own sum and add to 100", () => {
    const s = sharesOf({ beer: 1.0, wine: 0.5, spirits: 0.5 })!;
    expect(s).toEqual({ beer: 50, wine: 25, spirits: 25 });
    expect(s.beer + s.wine + s.spirits).toBeCloseTo(100, 10);
  });
  it("need all three values; a missing beverage is never a zero share", () => {
    expect(sharesOf({ beer: 1, wine: null, spirits: 1 })).toBeNull();
    expect(sharesOf({ beer: 1, spirits: 1 })).toBeNull();
    expect(sharesOf({ beer: 0, wine: 0, spirits: 0 })).toBeNull();
  });
  it("keeps a reported zero as a zero share", () => {
    expect(sharesOf({ beer: 1, wine: 0, spirits: 1 })).toEqual({ beer: 50, wine: 0, spirits: 50 });
  });
});

describe("changes", () => {
  it("are undefined from a zero base or a missing end", () => {
    expect(change(2, 3)).toBe(50);
    expect(change(0, 3)).toBeNull();
    expect(change(null, 3)).toBeNull();
    expect(change(2, undefined)).toBeNull();
  });
  it("compare a month only with the same month a year earlier", () => {
    const v = new Map<string, number | null>([
      ["2025-05", 100],
      ["2025-06", 200],
      ["2025-07", null],
      ["2026-05", 110],
      ["2026-06", 180],
      ["2026-07", 50],
      ["2026-08", 70],
    ]);
    expect(sameMonthChanges(v)).toEqual([
      { month: "2026-05", earlier: "2025-05", now: 110, before: 100, pct: 10 },
      { month: "2026-06", earlier: "2025-06", now: 180, before: 200, pct: -10 },
    ]);
  });
});

describe("volumes", () => {
  it("convert a 9-liter case to about 2.378 U.S. gallons", () => {
    expect(GALLONS_PER_9L_CASE).toBeCloseTo(2.37755, 5);
    // Utah's FY2026 state-store wine: 1,291,694.77 cases is about 3.07 million gallons.
    expect((1291694.77 * GALLONS_PER_9L_CASE) / 1e6).toBeCloseTo(3.071, 3);
  });
});
