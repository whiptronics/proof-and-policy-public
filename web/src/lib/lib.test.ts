import { describe, expect, it } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import vectors from "./compare.vectors.json";
import { compatible, panelKey, ratioAllowed, trendSegments, type Series } from "./compare";
import { cell, neutralize, toCsv, zip, type Column } from "./csv";
import { formatValue } from "./format";
import { indexToBase, percentChange, undefinedReason } from "./formulas";
import { applyPatch, pickInt, pickList, pickOne, pickRange } from "./url";

describe("formulas (hand-checkable)", () => {
  it("percent change", () => {
    expect(percentChange(200, 250)).toBe(25);
    expect(percentChange(250, 200)).toBe(-20);
    expect(percentChange(80, 80)).toBe(0);
    expect(percentChange(-50, -25)).toBe(-50); // relative to a negative base: sign follows the formula
  });
  it("percent change is undefined for a zero or missing base, never Infinity", () => {
    expect(percentChange(0, 10)).toBeUndefined();
    expect(percentChange(null, 10)).toBeUndefined();
    expect(percentChange(10, null)).toBeUndefined();
    expect(percentChange(undefined, 10)).toBeUndefined();
    expect(undefinedReason(0, 10)).toMatch(/zero/);
    expect(undefinedReason(null, 10)).toMatch(/missing/);
    expect(undefinedReason(5, 10)).toBeUndefined();
  });
  it("a zero later value is a real -100% change, not missing", () => {
    expect(percentChange(40, 0)).toBe(-100);
  });
  it("index to base", () => {
    expect(indexToBase(150, 100)).toBe(150);
    expect(indexToBase(0, 100)).toBe(0);
    expect(indexToBase(5, 0)).toBeUndefined();
    expect(indexToBase(5, null)).toBeUndefined();
  });
});

describe("formatting keeps zero distinct from missing", () => {
  it("prints 0 and a dash", () => {
    expect(formatValue(0, "usd_nominal")).toBe("0");
    expect(formatValue(null, "usd_nominal")).toBe("—");
    expect(formatValue(1234567, "usd_nominal")).toBe("$1,234,567");
    expect(formatValue(12.345, "percent")).toBe("12.3%");
  });
});

describe("CSV safe export", () => {
  it("neutralizes formula starts in text only", () => {
    expect(neutralize("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(neutralize("+1")).toBe("'+1");
    expect(neutralize("-x")).toBe("'-x");
    expect(neutralize("@cmd")).toBe("'@cmd");
    expect(neutralize("\tx")).toBe("'\tx");
    expect(neutralize("Utah")).toBe("Utah");
    expect(cell(-5, "number")).toBe("-5");
    expect(cell(0, "number")).toBe("0");
    expect(cell(null, "number")).toBe("");
    expect(cell(1e-7, "number")).toBe("1e-7");
  });
  it("quotes commas, quotes and newlines", () => {
    expect(cell('a "b", c', "text")).toBe('"a ""b"", c"');
    expect(cell("line1\nline2", "text")).toBe('"line1\nline2"');
    expect(cell(["a", "b"], "list")).toBe("a|b");
  });
  it("writes a header and CRLF rows; missing stays empty and zero stays 0", () => {
    type R = { id: string; v: number | null; note: string };
    const cols: Column<R>[] = [
      { key: "id", kind: "text", get: (r) => r.id },
      { key: "value", kind: "number", get: (r) => r.v },
      { key: "note", kind: "text", get: (r) => r.note },
    ];
    const out = toCsv(cols, [
      { id: "obs_1", v: 0, note: "=1+1" },
      { id: "obs_2", v: null, note: "not published" },
      { id: "obs_3", v: -2.5, note: "a, b" },
    ]);
    expect(out).toBe('id,value,note\r\nobs_1,0,\'=1+1\r\nobs_2,,not published\r\nobs_3,-2.5,"a, b"\r\n');
  });
  it("zips deterministically", () => {
    const a = zip([{ name: "x.csv", text: "a,b\r\n" }]);
    const b = zip([{ name: "x.csv", text: "a,b\r\n" }]);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
    expect(strFromU8(unzipSync(a)["x.csv"])).toBe("a,b\r\n");
  });
});

describe("URL state validation", () => {
  it("rejects unknown values", () => {
    expect(pickOne("revenue", ["coverage", "revenue"] as const, "coverage")).toBe("revenue");
    expect(pickOne("<script>", ["coverage", "revenue"] as const, "coverage")).toBe("coverage");
    expect(pickInt("2016", 1990, 2026, 2020)).toBe(2016);
    expect(pickInt("1e3", 1990, 2026, 2020)).toBe(2020);
    expect(pickInt("3000", 1990, 2026, 2020)).toBe(2020);
    expect(pickList("state:49,bogus,state:49,state:47", ["state:49", "state:47"], 6, [])).toEqual([
      "state:49",
      "state:47",
    ]);
    expect(pickList("bogus", ["state:49"], 6, ["state:49"])).toEqual(["state:49"]);
    expect(pickRange("2020", "2010", 1990, 2026, [1990, 2026])).toEqual([2010, 2020]);
  });
  it("patches and sorts keys; empty removes", () => {
    expect(applyPatch("?v=coverage&m=x", { m: null, geo: "state:49" })).toBe("?geo=state%3A49&v=coverage");
    expect(applyPatch("?v=coverage", { v: "revenue" }, true)).toBe("?v=revenue");
    expect(applyPatch("?v=coverage", { v: "" })).toBe("");
  });
});

describe("comparison rules match src/alcohol_data/compare.py", () => {
  for (const c of vectors.compatible) {
    it(`compatible: ${c.name}`, () => {
      const v = compatible(c.a as Series, c.b as Series, c.opts);
      expect(v.ok).toBe(c.ok);
      expect(v.reasons).toEqual(c.reasons);
      expect(v.label).toBe(c.label);
    });
  }
  for (const c of vectors.ratio_allowed) {
    it(`ratio_allowed: ${c.name}`, () => {
      const v = ratioAllowed(c.a as Series, c.b as Series);
      expect(v.ok).toBe(c.ok);
      expect(v.reasons).toEqual(c.reasons);
    });
  }
  it("trend segments break at missing years, gaps and group changes", () => {
    for (const t of vectors.trend_segments) {
      expect(trendSegments(t.points).map((s) => s.map((p) => p.year))).toEqual(t.segments);
    }
  });
  it("different units never share a panel", () => {
    expect(panelKey({ unit: "usd_nominal", period_kind: "state_fiscal_year", age_universe: "not_applicable" })).not.toBe(
      panelKey({ unit: "percent", period_kind: "survey_year", age_universe: "age_18_plus" }),
    );
  });
});

import { windowMean } from "./formulas";
import { fiscalYearOf, policyAnnotations } from "./series";
import type { FiscalYearRule, PolicyEvent } from "./types";

describe("window means", () => {
  it("averages a complete window and refuses a gappy one", () => {
    const pts = [
      { year: 2011, value: 10 },
      { year: 2012, value: 20 },
      { year: 2013, value: 0 },
      { year: 2014, value: null },
    ];
    expect(windowMean(pts, 2011, 2013)).toEqual({ mean: 10, years: 3, missing: [] });
    expect(windowMean(pts, 2012, 2014).mean).toBeUndefined();
    expect(windowMean(pts, 2012, 2014).missing).toEqual([2014]);
    expect(windowMean(pts, 2015, 2016).missing).toEqual([2015, 2016]);
  });
});

describe("fiscal-year placement of policy dates", () => {
  const rules: FiscalYearRule[] = [
    { geo_id: "*", fy_end_month: 6, fy_end_day: 30, valid_from_fy: 1900, valid_to_fy: 2099, evidence: "", verified: true },
    { geo_id: "state:01", fy_end_month: 9, fy_end_day: 30, valid_from_fy: 1985, valid_to_fy: 2099, evidence: "", verified: true },
  ];
  it("puts a July 1 start in the fiscal year that begins that day", () => {
    expect(fiscalYearOf("2016-07-01", "state:47", rules)).toBe(2017);
    expect(fiscalYearOf("2016-06-30", "state:47", rules)).toBe(2016);
    expect(fiscalYearOf("2016-07-01", "state:01", rules)).toBe(2016);
    expect(fiscalYearOf("2016-10-01", "state:01", rules)).toBe(2017);
  });
  it("marks a start on the first day of a period as a boundary and a mid-period start as a transition", () => {
    const ev = (d: string) =>
      ({ geo_id: "state:49", effective_start: d, effective_start_precision: "day", dimension_label: "Beer tax", policy_value: "usd_13.10" }) as PolicyEvent;
    const fy = policyAnnotations([ev("2019-11-01"), ev("2003-07-01")], "state:49", "state_fiscal_year", rules, [2000, 2026]);
    expect(fy.map((a) => [a.year, a.kind])).toEqual([
      [2020, "transition"],
      [2004, "line"],
    ]);
    const cal = policyAnnotations([ev("2019-11-01"), ev("2003-01-01")], "state:49", "calendar_year", rules, [2000, 2026]);
    expect(cal.map((a) => [a.year, a.kind])).toEqual([
      [2019, "transition"],
      [2003, "line"],
    ]);
    const unknown = { ...ev("2019-11-01"), effective_start_precision: "unknown" } as PolicyEvent;
    expect(policyAnnotations([unknown], "state:49", "calendar_year", rules, [2000, 2026])).toEqual([]);
  });
});
