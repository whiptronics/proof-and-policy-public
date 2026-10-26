import { describe, expect, it } from "vitest";
import { standing, type GlancePoint } from "./glance";

const pts = (...xs: [number, number | null, string?][]): GlancePoint[] => xs.map(([year, value, group]) => ({ year, value, group: group ?? "g" }));

describe("Utah's standing", () => {
  it("ranks only states with a value for Utah's latest year and definition", () => {
    const m = new Map<string, GlancePoint[]>([
      ["state:49", pts([2022, 5], [2023, null])], // Utah's latest value is 2022
      ["state:01", pts([2022, 9], [2023, 1])], // has 2023 too: compared on 2022, counted as later elsewhere
      ["state:02", pts([2022, 5])], // ties with Utah
      ["state:03", pts([2022, 2, "other"])], // another definition: left out
      ["state:04", pts([2021, 1])], // no 2022 value: left out
      ["nation:us", pts([2022, 100])], // the nation is never ranked
    ]);
    const s = standing(m, "state:49");
    expect(s).toEqual({ year: 2022, value: 5, group: "g", rank: 2, n: 3, laterElsewhere: 1, otherDefinition: 1, rankRange: null }); // no published intervals: no range
  });
  it("adds a rank range when the states have published intervals", () => {
    const withSe = (se: number | null) => (value: number): GlancePoint[] => [{ year: 2022, value, group: "g", se }];
    const m = new Map<string, GlancePoint[]>([
      ["state:49", withSe(3)(10)],
      ["state:01", withSe(3)(11)],
      ["state:02", withSe(3)(9)],
      ["state:03", withSe(null)(50)], // no interval: held fixed
      ["state:04", withSe(3)(1)],
    ]);
    const s = standing(m, "state:49");
    expect("year" in s && s.rank).toBe(3);
    if (!("year" in s)) throw new Error("expected a standing");
    expect(s.rankRange).toMatchObject({ withMargins: 4, ownMargin: true });
    expect(s.rankRange!.low).toBeGreaterThanOrEqual(2); // state:03 is always first
    expect(s.rankRange!.high).toBeGreaterThan(s.rankRange!.low);
    expect(s.rankRange!.high).toBeLessThanOrEqual(5);
    expect(standing(m, "state:49")).toEqual(s); // same data, same range
  });
  it("says why there is no standing", () => {
    expect(standing(new Map([["state:49", pts([2022, null])]]), "state:49")).toEqual({ why: "no value for this state" });
    expect(standing(new Map([["state:49", pts([2022, 1])], ["state:01", pts([2021, 3])]]), "state:49")).toEqual({
      why: "only 1 state with a 2022 value under this definition",
    });
  });
});
