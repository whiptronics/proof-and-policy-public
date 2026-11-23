import { describe, expect, it } from "vitest";
import { andList, areaCount, lowerFirst, minus, withArticle, words } from "./format";

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

describe("copy helpers", () => {
  it("writes the article a number is said with", () => {
    for (const n of ["8.9%", "11.1%", "18%", "80%", "89.1%", "800", "8,000", "11,000", "$8"]) expect(withArticle(n)).toBe(`an ${n}`);
    for (const n of ["28%", "1.8%", "110%", "180%", "1,800", "0%", "0.8%", "−8.9%", "—"]) expect(withArticle(n)).toBe(`a ${n}`);
  });
  it("reads coded law values as words and leaves other codes alone", () => {
    expect(words("max_5.0pct_abv_or_4.0pct_abw")).toBe("max 5.0% ABV or 4.0% ABW");
    expect(words("usd_13.10")).toBe("$13.10");
    expect(words("no_sales_below_cost_plus_20pct")).toBe("no sales below cost plus 20%");
    expect(words("usd_nominal")).toBe("usd nominal");
    expect(words("brfss_binge_5m_4f_pct")).toBe("brfss binge 5m 4f pct");
  });
  it("prints a minus sign, and no sign on a rounded zero", () => {
    expect(minus("-38.8")).toBe("−38.8");
    expect(minus("-0.0")).toBe("0.0");
    expect(minus("-0")).toBe("0");
    expect(minus("12.5")).toBe("12.5");
  });
  it("joins a list for a sentence", () => {
    expect(andList(["population", "income per person", "wine consumption"])).toBe("population, income per person and wine consumption");
    expect(andList(["wine"])).toBe("wine");
    expect(andList([])).toBe("");
  });
  it("lowercases a joined sentence but not an acronym", () => {
    expect(lowerFirst("Whether grocers would")).toBe("whether grocers would");
    expect(lowerFirst("FY2025 card fees")).toBe("FY2025 card fees");
    expect(lowerFirst("DABS sells")).toBe("DABS sells");
  });
});
