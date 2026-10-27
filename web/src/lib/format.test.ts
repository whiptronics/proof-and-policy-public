import { describe, expect, it } from "vitest";
import { areaCount } from "./format";

const states = (n: number, dc = true) => [...Array.from({ length: n }, (_, i) => `state:${i === 10 ? 99 : i + 1}`), ...(dc ? ["state:11"] : [])];

describe("areaCount", () => {
  it("never counts the U.S. total or Census regions as states or jurisdictions", () => {
    expect(areaCount(["nation:us", ...states(50)])).toBe("50 states and DC, the U.S. total");
    expect(areaCount(["nation:us", ...states(50), "census_region:1", "census_region:2", "census_region:3", "census_region:4"])).toBe(
      "50 states and DC, the U.S. total, 4 Census regions",
    );
    expect(areaCount(states(50))).toBe("50 states and DC");
    expect(areaCount(states(4, false))).toBe("4 states");
  });
});
