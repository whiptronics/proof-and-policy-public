import { describe, expect, it } from "vitest";
import {
  FILE_FORMAT,
  analysisFile,
  analysisPatch,
  casePanelAnalysis,
  parseAnalysisFile,
  readAnalysis,
  readStored,
  sameAnalysis,
  snapshotCheck,
  snapshotsFor,
  statusChanges,
  statusOnDay,
  writeStored,
  yearRuns,
  yearStatuses,
  type Allowed,
  type Analysis,
} from "./analysis";
import { changeAnnotations, placeDate } from "./series";
import type { CaseStudy, FiscalYearRule, MetricMeta, Segment, Snapshot } from "./types";
import { applyPatch } from "./url";

const AS_OF = "2026-10-06";
const seg = (geo: string, start: string, end: string, state: string, ids = "-"): Segment => ({
  geo_id: geo,
  policy_dimension: "grocery_wine",
  segment_start: start,
  segment_end: end,
  days: 0,
  state,
  policy_ids: ids,
  derivation_version: "test",
});
// Modelled on Tennessee: verified not authorized 2014-03-20 to 2016-06-30, local option on 2016-07-01 only.
const TN = [
  seg("state:47", "1990-01-01", "2014-03-19", "unknown"),
  seg("state:47", "2014-03-20", "2016-06-30", "not_authorized", "tn_before"),
  seg("state:47", "2016-07-01", "2016-07-01", "authorized_local_option", "tn_2016"),
  seg("state:47", "2016-07-02", AS_OF, "unknown"),
];
// Modelled on Virginia: the same value on two legal bases.
const VA = [
  seg("state:51", "1990-01-01", "1997-06-30", "unknown"),
  seg("state:51", "1997-07-01", "2021-06-30", "authorized", "va_general"),
  seg("state:51", "2021-07-01", AS_OF, "authorized", "va_listed"),
];
const SEGS = [...TN, ...VA];
const snap = (id: string, geo: string, value: string, on: string | null, year: number): Snapshot =>
  ({ snapshot_id: id, geo_id: geo, policy_dimension: "grocery_wine", policy_value: value, observed_on: on, observed_year: year }) as Snapshot;

const ALLOWED: Allowed = {
  metrics: ["a@calendar_year", "b@state_fiscal_year", "c@survey_year", "d@calendar_year", "e@calendar_year"],
  geos: ["state:47", "state:51", "state:49", "state:21", "state:13", "state:05", "nation:us"],
  policies: ["grocery_wine"],
  yearMin: 1950,
  yearMax: 2026,
};
const DEFAULT: Analysis = { metrics: ["a@calendar_year"], geos: ["state:49"], from: 2000, to: 2024, shown: "nominal", base: null, policy: "grocery_wine" };
const viaUrl = (a: Analysis, id: string | null = null) => readAnalysis(new URLSearchParams(applyPatch("", analysisPatch(a, id))), ALLOWED, DEFAULT);

describe("Explore selections round-trip through the URL", () => {
  it("keeps every field, including empty lists and no policy", () => {
    const a: Analysis = { metrics: ["b@state_fiscal_year", "a@calendar_year"], geos: ["state:51", "nation:us"], from: 1990, to: 2015, shown: "index", base: 2001, policy: null };
    expect(viaUrl(a)).toEqual(a);
    const empty: Analysis = { ...DEFAULT, metrics: [], geos: [], policy: null };
    expect(viaUrl(empty)).toEqual(empty);
  });
  it("falls back on unknown ids, swaps reversed years and caps the lists", () => {
    const p = new URLSearchParams("m=zzz&g=state:47,state:51,state:49,state:21,state:13,state:05,nation:us&y0=2020&y1=1999&pd=bogus&tf=per_resident&base=2005");
    const a = readAnalysis(p, ALLOWED, DEFAULT);
    expect(a.metrics).toEqual(DEFAULT.metrics);
    expect(a.geos).toHaveLength(6);
    expect([a.from, a.to]).toEqual([1999, 2020]);
    expect(a.policy).toBe("grocery_wine");
    expect(a.base).toBeNull(); // a base year only exists for an index
  });
  it("clamps an index base year into the range", () => {
    const a = readAnalysis(new URLSearchParams("tf=index&y0=2005&y1=2010&base=1990"), ALLOWED, DEFAULT);
    expect(a.base).toBe(2005);
  });
  it("compares selections field by field", () => {
    expect(sameAnalysis(DEFAULT, { ...DEFAULT })).toBe(true);
    expect(sameAnalysis(DEFAULT, { ...DEFAULT, geos: ["state:47"] })).toBe(false);
    expect(sameAnalysis(DEFAULT, { ...DEFAULT, base: 2010 })).toBe(true); // base is ignored unless indexed
  });
});

describe("policy status by calendar year comes from verified days only", () => {
  const ys = yearStatuses(SEGS, "state:47", "grocery_wine", 2013, 2027, AS_OF);
  const at = (y: number) => ys.find((s) => s.year === y)!;
  it("counts verified days by hand", () => {
    expect(at(2013)).toMatchObject({ kind: "unknown", knownDays: 0, days: 365 });
    // 2014-03-20 to 12-31: 365 - (31 + 28 + 19) = 287 days
    expect(at(2014)).toMatchObject({ kind: "partial", values: ["not_authorized"], knownDays: 287, days: 365 });
    expect(at(2015)).toMatchObject({ kind: "known", values: ["not_authorized"], knownDays: 365 });
    // 2016 is a leap year: Jan-Jun is 182 days, plus 2016-07-01
    expect(at(2016)).toMatchObject({ kind: "changed", values: ["not_authorized", "authorized_local_option"], knownDays: 183, days: 366 });
    expect(at(2017)).toMatchObject({ kind: "unknown", knownDays: 0 });
    // 2026 counts only to the as-of date: 273 days to Sep 30, plus 6
    expect(at(2026)).toMatchObject({ kind: "unknown", days: 279 });
    expect(at(2027)).toMatchObject({ kind: "after_as_of", days: 0 });
  });
  it("never fills a year from a neighbour or from a snapshot", () => {
    // Georgia-like: a snapshot exists, but no day run, so every year is "not coded".
    const ga = yearStatuses(SEGS, "state:13", "grocery_wine", 2020, 2026, AS_OF);
    expect(ga.every((s) => s.kind === "not_coded" && s.knownDays === 0)).toBe(true);
    expect(statusOnDay(SEGS, "state:13", "grocery_wine", "2026-10-01", AS_OF)).toEqual({ kind: "not_coded" });
    expect(statusOnDay(SEGS, "state:47", "grocery_wine", "2016-07-02", AS_OF).kind).toBe("unknown");
    expect(statusOnDay(SEGS, "state:47", "grocery_wine", "1989-12-31", AS_OF)).toEqual({ kind: "unknown", why: "outside the coded period" });
    expect(statusOnDay(SEGS, "state:51", "grocery_wine", "2026-10-07", AS_OF)).toEqual({ kind: "unknown", why: "after the build's as-of date" });
    expect(statusOnDay(SEGS, "state:47", "grocery_wine", "2016-07-01", AS_OF)).toMatchObject({ kind: "known", value: "authorized_local_option", policyIds: ["tn_2016"] });
  });
  it("merges only years that read the same", () => {
    const runs = yearRuns(yearStatuses(SEGS, "state:47", "grocery_wine", 2010, 2026, AS_OF));
    expect(runs.map((r) => [r.from, r.to, r.status.kind])).toEqual([
      [2010, 2013, "unknown"],
      [2014, 2014, "partial"],
      [2015, 2015, "known"],
      [2016, 2016, "changed"],
      [2017, 2026, "unknown"], // unknown years merge; only partial and changed years carry day counts
    ]);
    // Partial years merge only with the same number of verified days.
    const two = [seg("state:21", "1990-01-01", "2010-03-31", "unknown"), seg("state:21", "2010-04-01", "2010-12-31", "authorized", "x"), seg("state:21", "2011-01-01", "2011-03-31", "unknown"), seg("state:21", "2011-04-01", AS_OF, "authorized", "x")];
    expect(yearRuns(yearStatuses(two, "state:21", "grocery_wine", 2010, 2012, AS_OF)).map((r) => [r.from, r.to, r.status.knownDays])).toEqual([
      [2010, 2011, 275],
      [2012, 2012, 366],
    ]);
  });
});

describe("only a verified change of value is marked on charts", () => {
  it("skips the first verified day and a new legal basis for the same value", () => {
    expect(statusChanges(SEGS, "state:47", "grocery_wine")).toEqual([
      { day: "2016-07-01", from: "not_authorized", to: "authorized_local_option", policyIds: ["tn_2016"] },
    ]);
    expect(statusChanges(SEGS, "state:51", "grocery_wine")).toEqual([]);
  });
  it("places a date on the fiscal-year or calendar axis", () => {
    const rules: FiscalYearRule[] = [{ geo_id: "*", fy_end_month: 6, fy_end_day: 30, valid_from_fy: 1985, valid_to_fy: 2099, evidence: "", verified: true }];
    expect(placeDate("2016-07-01", "state:47", "state_fiscal_year", rules)).toEqual({ year: 2017, kind: "line" });
    expect(placeDate("2016-07-01", "state:47", "calendar_year", rules)).toEqual({ year: 2016, kind: "transition" });
    expect(placeDate("2016-01-01", "state:47", "survey_year", rules)).toEqual({ year: 2016, kind: "line" });
    expect(changeAnnotations([{ day: "2016-07-01", label: "x" }], "state:47", "state_fiscal_year", rules, [2010, 2016])).toEqual([]);
    expect(changeAnnotations([{ day: "2016-07-01", label: "x" }], "state:47", "state_fiscal_year", rules, [2010, 2020])[0].label).toBe("FY2017: x");
  });
});

describe("snapshots stay on their own day", () => {
  it("orders snapshots and checks them only against verified days", () => {
    const s = [snap("late", "state:51", "authorized", "2026-10-07", 2026), snap("year", "state:51", "authorized", null, 2026), snap("old", "state:51", "not_authorized", "2000-05-01", 2000)];
    expect(snapshotsFor(s, "state:51", "grocery_wine").map((x) => x.snapshot_id)).toEqual(["old", "year", "late"]);
    expect(snapshotCheck(SEGS, s[2], AS_OF)).toBe("differs"); // verified authorized on 2000-05-01
    expect(snapshotCheck(SEGS, s[0], AS_OF)).toBe("no_history"); // after the as-of date
    expect(snapshotCheck(SEGS, s[1], AS_OF)).toBe("no_history"); // a year names no day
    // A year-only snapshot inside verified history is still not checked against any one day of that year.
    expect(snapshotCheck(SEGS, snap("y2010", "state:51", "not_authorized", null, 2010), AS_OF)).toBe("no_history");
    expect(snapshotCheck(SEGS, snap("ok", "state:51", "authorized", "2010-01-01", 2010), AS_OF)).toBe("agrees");
  });
});

describe("worked-example panels are saved analyses", () => {
  const meta = (id: string, period_kind: string, last_year: number) => ({ metric_id: id, period_kind, last_year }) as MetricMeta;
  const metas = [meta("tax@state_fiscal_year", "state_fiscal_year", 2025), meta("wine@calendar_year", "calendar_year", 2024)];
  const c = {
    case_id: "tn",
    treated_geo: "state:47",
    comparison_geos: [{ geo_id: "state:51", reason: "" }],
    reference_geos: [{ geo_id: "state:49", reason: "" }],
    windows: {
      pre_fiscal: { from: 2012, to: 2016, period_kind: "state_fiscal_year", note: "" },
      post_fiscal: { from: 2017, to: 2021, period_kind: "state_fiscal_year", note: "" },
      pre_calendar: { from: 2011, to: 2015, period_kind: "calendar_year", note: "" },
      post_calendar: { from: 2017, to: 2021, period_kind: "calendar_year", note: "" },
    },
    panels: [
      { title: "TN only", treated_only: true, metrics: [{ metric_id: "tax@state_fiscal_year" }], note: "n" },
      { title: "Real", metrics: [{ metric_id: "tax@state_fiscal_year", conversion: "real_cy2024" }], note: "" },
      { title: "Wine", metrics: [{ metric_id: "wine@calendar_year" }], note: "" },
      { title: "Missing", metrics: [{ metric_id: "nope@calendar_year" }], note: "" },
    ],
  } as unknown as CaseStudy;
  it("carries the chart's years, jurisdictions and conversion", () => {
    expect(casePanelAnalysis(c, 0, metas, "grocery_wine")).toEqual({
      id: "case:tn:0",
      title: "TN only",
      note: "n",
      analysis: { metrics: ["tax@state_fiscal_year"], geos: ["state:47"], from: 2011, to: 2022, shown: "nominal", base: null, policy: "grocery_wine" },
    });
    expect(casePanelAnalysis(c, 1, metas, null)!.analysis).toMatchObject({ geos: ["state:47", "state:51", "state:49"], shown: "real_cy2024" });
    expect(casePanelAnalysis(c, 2, metas, null)!.analysis).toMatchObject({ from: 2010, to: 2022 });
    expect(casePanelAnalysis(c, 3, metas, null)).toBeNull();
  });
});

describe("saving to a file and to this browser", () => {
  const a: Analysis = { metrics: ["a@calendar_year", "zzz@calendar_year"], geos: ["state:47", "state:99"], from: 1900, to: 2030, shown: "index", base: 1920, policy: "gone" };
  it("drops and names what this release does not hold", () => {
    const r = parseAnalysisFile(analysisFile(a, "Mine", "rel", null), ALLOWED);
    expect(r.title).toBe("Mine");
    expect(r.analysis).toEqual({ metrics: ["a@calendar_year"], geos: ["state:47"], from: 1950, to: 2026, shown: "index", base: 1950, policy: null });
    expect(r.dropped).toEqual([
      "measure zzz@calendar_year (not in this release)",
      "jurisdiction state:99 (not in this release)",
      "policy gone (not coded in this release)",
      "years 1900-2030 narrowed to 1950-2026",
      "base year 1920 moved to 1950",
    ]);
  });
  it("refuses files that are not saved analyses", () => {
    expect(() => parseAnalysisFile("not json", ALLOWED)).toThrow(/not JSON/);
    expect(() => parseAnalysisFile(JSON.stringify({ format: "other", analysis: a }), ALLOWED)).toThrow(FILE_FORMAT);
    expect(() => parseAnalysisFile(JSON.stringify({ format: FILE_FORMAT, analysis: { ...a, from: "1990" } }), ALLOWED)).toThrow(/malformed/);
    expect(() => parseAnalysisFile(JSON.stringify({ format: FILE_FORMAT, analysis: { ...a, shown: "ratio" } }), ALLOWED)).toThrow(/ratio/);
  });
  it("survives missing, blocked or corrupt browser storage", () => {
    const mem = new Map<string, string>();
    const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    const entry = { name: "x", saved_at: "2026-10-09T00:00:00Z", analysis: DEFAULT };
    expect(writeStored(store, [entry])).toBe(true);
    expect(readStored(store)).toEqual([entry]);
    mem.set([...mem.keys()][0], "{broken");
    expect(readStored(store)).toEqual([]);
    mem.set([...mem.keys()][0], JSON.stringify([entry, { name: 3 }, { ...entry, analysis: { metrics: "a" } }]));
    expect(readStored(store)).toEqual([entry]);
    const blocked = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("full"); } };
    expect(readStored(blocked)).toEqual([]);
    expect(writeStored(blocked, [entry])).toBe(false);
    expect(readStored(null)).toEqual([]);
  });
});
