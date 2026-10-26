import { describe, expect, it } from "vitest";
import type { ObsRow } from "./bundle";
import { PLACEBO_MIN_RUNS, analyzeChange, eventTime, locateYear0, logChange, meaningfulPct, periodRole, placeboInTime, shiftDate, slopePerYear, trendFit, type ChangeSpec } from "./change";
import { zForLevel } from "./stats";
import type { FiscalYearRule, MetricMeta, Obs } from "./types";

const RULES: FiscalYearRule[] = [
  { geo_id: "state:01", fy_end_month: 9, fy_end_day: 30, valid_from_fy: 1985, valid_to_fy: 2099, evidence: "", verified: true },
  { geo_id: "*", fy_end_month: 6, fy_end_day: 30, valid_from_fy: 1985, valid_to_fy: 2099, evidence: "", verified: true },
];
const META = { metric_id: "m@x" } as MetricMeta;
const pad = (n: number) => String(n).padStart(2, "0");

/** One row per (year, value). Fiscal years end June 30 unless `fyEnd` says otherwise; calendar years run
 * January to December; point-in-time rows sit on July 1. */
function rows(geo: string, kind: "fy" | "cy" | "pit", values: Record<number, number | null>, opts: { fyEndMonth?: number; group?: Record<number, string> } = {}): ObsRow[] {
  return Object.entries(values).map(([ys, v]) => {
    const y = Number(ys);
    const m = opts.fyEndMonth ?? 6;
    const lastDay = m === 9 ? 30 : 30;
    const start = kind === "fy" ? `${y - 1}-${pad(m + 1)}-01` : kind === "cy" ? `${y}-01-01` : `${y}-07-01`;
    const end = kind === "fy" ? `${y}-${pad(m)}-${lastDay}` : kind === "cy" ? `${y}-12-31` : `${y}-07-01`;
    const obs = {
      observation_id: `${geo}-${y}`,
      geo_id: geo,
      year: y,
      value: v,
      missing_reason: v === null ? "not_published" : null,
      period_start: start,
      period_end: end,
      period_label: String(y),
      comparability_group: opts.group?.[y] ?? "g1",
    } as Obs;
    return { meta: META, obs };
  });
}
const span = (from: number, to: number, f: (y: number) => number | null) => {
  const out: Record<number, number | null> = {};
  for (let y = from; y <= to; y++) out[y] = f(y);
  return out;
};
const SPEC: ChangeSpec = { date: "2016-07-01", before: 5, after: 5, includeTransition: false, yearSet: "common" };

describe("periods are placed by their own dates", () => {
  it("before, after and straddling", () => {
    expect(periodRole("2015-07-01", "2016-06-30", "2016-07-01")).toBe("before");
    expect(periodRole("2016-07-01", "2017-06-30", "2016-07-01")).toBe("after");
    expect(periodRole("2015-10-01", "2016-09-30", "2016-07-01")).toBe("transition"); // Alabama's FY2016
    expect(periodRole("2016-01-01", "2016-12-31", "2016-07-01")).toBe("transition");
    expect(periodRole("2016-07-01", "2016-07-01", "2016-07-01")).toBe("after"); // a July 1 estimate on the day
  });
  it("finds year zero for fiscal, calendar and point-in-time series", () => {
    expect(locateYear0(rows("state:47", "fy", { 2017: 1 }), "2016-07-01", "state_fiscal_year", "state:47", RULES)).toEqual({ year0: 2017, transition: false });
    expect(locateYear0(rows("state:01", "fy", { 2016: 1 }, { fyEndMonth: 9 }), "2016-07-01", "state_fiscal_year", "state:01", RULES)).toEqual({ year0: 2016, transition: true });
    expect(locateYear0(rows("state:47", "cy", { 2016: 1 }), "2016-07-01", "calendar_year", "state:47", RULES)).toEqual({ year0: 2016, transition: true });
    expect(locateYear0(rows("state:47", "pit", { 2016: 1 }), "2016-07-01", "point_in_time", "state:47", RULES)).toEqual({ year0: 2016, transition: false });
    expect(locateYear0(rows("state:47", "pit", { 2016: 1 }), "2016-08-01", "point_in_time", "state:47", RULES)).toEqual({ year0: 2017, transition: false });
    // No row near the date: the period-kind rule decides.
    expect(locateYear0([], "2016-07-01", "state_fiscal_year", "state:47", RULES)).toEqual({ year0: 2017, transition: false });
    expect(locateYear0([], "2016-01-01", "calendar_year", "state:47", RULES)).toEqual({ year0: 2016, transition: false });
  });
});

describe("before-and-after averages by hand", () => {
  it("fiscal years ending June 30: FY2012-16 against FY2017-21", () => {
    const r = analyzeChange([{ geo: "state:47", rows: rows("state:47", "fy", span(2010, 2023, (y) => (y <= 2016 ? 10 : 12))) }], SPEC, "state_fiscal_year", RULES);
    expect(r.year0).toBe(2017);
    expect(r.transitionYear).toBeNull();
    expect(r.beforeWindow).toEqual([2012, 2013, 2014, 2015, 2016]);
    expect(r.afterWindow).toEqual([2017, 2018, 2019, 2020, 2021]);
    expect(r.states[0]).toMatchObject({ beforeMean: 10, afterMean: 12, change: 2, pctChange: 20 });
  });
  it("a calendar year that straddles the date is left out, unless included in after", () => {
    const vals = span(2010, 2022, (y) => (y < 2016 ? 4 : y === 2016 ? 7 : 6));
    const out = analyzeChange([{ geo: "state:47", rows: rows("state:47", "cy", vals) }], SPEC, "calendar_year", RULES);
    expect(out.transitionYear).toBe(2016);
    expect(out.usedAfter).toEqual([2017, 2018, 2019, 2020, 2021]);
    expect(out.states[0]).toMatchObject({ beforeMean: 4, afterMean: 6, change: 2, pctChange: 50 });
    expect(out.states[0].cells.find((c) => c.year === 2016)?.status).toBe("transition_excluded");
    const incl = analyzeChange([{ geo: "state:47", rows: rows("state:47", "cy", vals) }], { ...SPEC, includeTransition: true }, "calendar_year", RULES);
    expect(incl.usedAfter).toEqual([2016, 2017, 2018, 2019, 2020, 2021]);
    expect(incl.states[0].afterMean).toBeCloseTo(37 / 6, 12); // (7 + 6 x 5) / 6
  });
  it("a comparison state with a September fiscal year loses the year that straddles the date, for everyone", () => {
    const tn = rows("state:47", "fy", span(2010, 2022, (y) => (y <= 2016 ? 10 : 12)));
    const al = rows("state:01", "fy", span(2010, 2022, (y) => (y <= 2016 ? 20 : 21)), { fyEndMonth: 9 });
    const r = analyzeChange([{ geo: "state:47", rows: tn }, { geo: "state:01", rows: al }], SPEC, "state_fiscal_year", RULES);
    expect(r.usedBefore).toEqual([2012, 2013, 2014, 2015]);
    expect(r.dropped).toEqual([{ year: 2016, window: "before", why: "not usable for state:01" }]);
    expect(r.states[1].cells.find((c) => c.year === 2016)).toMatchObject({ status: "wrong_side" });
    expect(r.states[1].cells.find((c) => c.year === 2016)?.why).toMatch(/straddles 2016-07-01 for this state \(2015-10-01 to 2016-09-30\)/);
    // Alabama: before 20, after 21 => change 1; Tennessee 2 => difference in changes 1; percent: 20 - 5 = 15 points.
    expect(r.diffs[0]).toMatchObject({ geo: "state:01", diffChange: 1, diffPct: 15 });
  });
  it("never fills a missing year; it drops it for every state and says so", () => {
    const tn = rows("state:47", "cy", span(2010, 2022, (y) => (y < 2016 ? 4 : 6)));
    const va = rows("state:51", "cy", span(2010, 2022, (y) => (y === 2013 ? null : y < 2016 ? 2 : 3)));
    const r = analyzeChange([{ geo: "state:47", rows: tn }, { geo: "state:51", rows: va }], SPEC, "calendar_year", RULES);
    expect(r.usedBefore).toEqual([2011, 2012, 2014, 2015]);
    expect(r.dropped).toEqual([{ year: 2013, window: "before", why: "not usable for state:51" }]);
    expect(r.states[0].cells.find((c) => c.year === 2013)?.status).toBe("not_common");
    expect(r.states[1].cells.find((c) => c.year === 2013)).toMatchObject({ status: "missing", why: "not published" });
    expect(r.diffs[0]).toMatchObject({ diffChange: 1 }); // (6 - 4) - (3 - 2)
  });
  it("leaves out a comparison state with nothing after the change, and computes nothing for it", () => {
    const tn = rows("state:47", "cy", span(2010, 2022, () => 5));
    const ga = rows("state:13", "cy", span(2010, 2015, () => 5));
    const r = analyzeChange([{ geo: "state:47", rows: tn }, { geo: "state:13", rows: ga }], SPEC, "calendar_year", RULES);
    expect(r.states[1]).toMatchObject({ included: false, excludedWhy: "no usable value after the change in these years", change: null });
    expect(r.diffs[0]).toMatchObject({ diffChange: null, why: "no usable value after the change in these years" });
    expect(r.usedBefore).toEqual([2011, 2012, 2013, 2014, 2015]); // the excluded state does not shrink the years
  });
  it("with each state's own years, no difference between states is computed", () => {
    const tn = rows("state:47", "cy", span(2010, 2022, (y) => (y < 2016 ? 4 : 6)));
    const va = rows("state:51", "cy", span(2010, 2022, (y) => (y === 2013 ? null : y < 2016 ? 2 : 3)));
    const r = analyzeChange([{ geo: "state:47", rows: tn }, { geo: "state:51", rows: va }], { ...SPEC, yearSet: "own" }, "calendar_year", RULES);
    expect(r.states[0].beforeYears).toEqual([2011, 2012, 2013, 2014, 2015]);
    expect(r.states[1].beforeYears).toEqual([2011, 2012, 2014, 2015]);
    expect(r.diffs[0]).toMatchObject({ diffChange: null, diffPct: null, why: "each state uses its own years, so the averages cover different years" });
  });
  it("says why a percent change is undefined: zero or negative base", () => {
    expect(meaningfulPct(0, 5)).toEqual({ pct: null, why: "the before average is zero, so a percent change is undefined" });
    expect(meaningfulPct(-2, 5).pct).toBeNull();
    expect(meaningfulPct(4, 5)).toEqual({ pct: 25, why: null });
    const z = analyzeChange([{ geo: "state:47", rows: rows("state:47", "cy", span(2010, 2022, (y) => (y < 2016 ? 0 : 3))) }], SPEC, "calendar_year", RULES);
    expect(z.states[0]).toMatchObject({ change: 3, pctChange: null });
  });
  it("computes no change across a definition change", () => {
    const vals = span(2010, 2022, (y) => (y < 2016 ? 50 : 55));
    const groups: Record<number, string> = {};
    for (let y = 2010; y <= 2022; y++) groups[y] = y < 2014 ? "old" : "new";
    const r = analyzeChange([{ geo: "state:47", rows: rows("state:47", "cy", vals, { group: groups }) }], SPEC, "calendar_year", RULES);
    expect(r.computable).toBe(false);
    expect(r.states[0].change).toBeNull();
    expect(r.whyNot).toMatch(/comparability groups: old, new/);
  });
  it("reports pre-period trends and their difference", () => {
    expect(slopePerYear([{ year: 2011, value: 1 }, { year: 2012, value: 2 }, { year: 2013, value: 3 }])).toBe(1);
    expect(slopePerYear([{ year: 2011, value: 1 }])).toBeNull();
    expect(slopePerYear([{ year: 2011, value: 1 }, { year: 2012, value: 3 }])).toBeNull(); // three points, as the Python outputs require
    const tn = rows("state:47", "cy", span(2010, 2022, (y) => (y < 2016 ? y - 2010 : 10)));
    const va = rows("state:51", "cy", span(2010, 2022, () => 3));
    const r = analyzeChange([{ geo: "state:47", rows: tn }, { geo: "state:51", rows: va }], SPEC, "calendar_year", RULES);
    expect(r.states[0].slope).toBe(1);
    expect(r.diffs[0].slopeDiff).toBe(1);
    // Middles of 2011-2015 and 2017-2021 are 2013 and 2019: trends alone would give 1 x 6 = 6.
    expect(r.diffs[0].trendOnly).toBe(6);
  });
  it("refuses when the target has nothing on one side", () => {
    const r = analyzeChange([{ geo: "state:47", rows: rows("state:47", "cy", span(2010, 2015, () => 1)) }], SPEC, "calendar_year", RULES);
    expect(r).toMatchObject({ computable: false, whyNot: "the target state has no usable value after the change" });
  });
});

describe("event time", () => {
  it("counts years from year zero and can show percent of the before average", () => {
    const pts = eventTime(rows("state:47", "cy", { 2015: 10, 2016: 11, 2017: 12 }), 2016, 10, true);
    expect(pts.map((p) => [p.k, p.value])).toEqual([[-1, 100], [0, 110], [1, 120]]);
    expect(eventTime(rows("state:47", "cy", { 2015: 10 }), 2016, 0, true)[0].value).toBeNull(); // zero base
  });
});

// ----- 1.1: sampling error, trend uncertainty, pooled comparison, placebo-in-time -----------------------------

const Z95 = zForLevel(0.95);
/** Give every row a published 95% interval whose standard error is `se` (a number, or a function of the year). */
function withCi(rs: ObsRow[], se: number | ((year: number) => number)): ObsRow[] {
  return rs.map((r) => {
    const e = typeof se === "number" ? se : se(r.obs.year);
    const v = r.obs.value;
    return { ...r, obs: { ...r.obs, ci_low: v === null ? null : v - Z95 * e, ci_high: v === null ? null : v + Z95 * e, ci_level: 0.95 } };
  });
}
/** Values that step from `a` to `b` at 2016 (the transition year takes `b`). */
const stepped = (a: number, b: number, from = 2010, to = 2022) => span(from, to, (y) => (y < 2016 ? a : b));

describe("sampling error from published intervals", () => {
  it("carries a standard error through the window means, the change and the difference in changes", () => {
    const tn = withCi(rows("state:47", "cy", stepped(10, 12)), 1);
    const va = withCi(rows("state:51", "cy", stepped(10, 10)), 1);
    const r = analyzeChange([{ geo: "state:47", rows: tn }, { geo: "state:51", rows: va }], SPEC, "calendar_year", RULES);
    const t = r.states[0];
    expect(t.beforeSE).toBeCloseTo(1 / Math.sqrt(5), 12); // five independent annual estimates, each with se 1
    expect(t.afterSE).toBeCloseTo(1 / Math.sqrt(5), 12);
    expect(t.changeSE).toBeCloseTo(Math.sqrt(0.4), 12);
    const d = r.diffs[0];
    expect(d.diffChange).toBe(2);
    expect(d.diffChangeSE).toBeCloseTo(Math.sqrt(0.8), 12);
    expect(d.diffZ).toBeCloseTo(2 / Math.sqrt(0.8), 12);
    expect(d.diffP).toBeCloseTo(0.0253, 3);
    expect(d.diffInterval![0]).toBeCloseTo(2 - Z95 * Math.sqrt(0.8), 6);
    expect(d.diffInterval![1]).toBeCloseTo(2 + Z95 * Math.sqrt(0.8), 6);
    expect(t.cells.find((c) => c.year === 2013)?.se).toBeCloseTo(1, 12);
  });
  it("gives no error, and says nothing about noise, for a measure without published intervals", () => {
    const r = analyzeChange(
      [{ geo: "state:47", rows: rows("state:47", "cy", stepped(10, 12)) }, { geo: "state:51", rows: rows("state:51", "cy", stepped(10, 10)) }],
      SPEC, "calendar_year", RULES,
    );
    expect(r.states[0]).toMatchObject({ beforeSE: null, afterSE: null, changeSE: null });
    expect(r.diffs[0]).toMatchObject({ diffChange: 2, diffChangeSE: null, diffZ: null, diffP: null, diffInterval: null });
  });
  it("gives no error when only some years have an interval", () => {
    const tn = withCi(rows("state:47", "cy", stepped(10, 12)), (y) => (y === 2013 ? Number.NaN : 1));
    const r = analyzeChange([{ geo: "state:47", rows: tn }], SPEC, "calendar_year", RULES);
    expect(r.states[0].beforeSE).toBeNull();
    expect(r.states[0].afterSE).not.toBeNull();
    expect(r.states[0].changeSE).toBeNull();
  });
  it("gives a converted value no error: the published interval belongs to the published value", () => {
    const tn = withCi(rows("state:47", "cy", stepped(10, 12)), 1).map((r) => ({ ...r, shown: { kind: "per_resident" as const, value: r.obs.value, unit: "x", missing: null, inputs: [], method: "m" } }));
    const r = analyzeChange([{ geo: "state:47", rows: tn }], SPEC, "calendar_year", RULES);
    expect(r.states[0].changeSE).toBeNull();
  });
});

describe("pre-period trends carry their own uncertainty", () => {
  it("needs three points for a slope", () => {
    expect(trendFit([{ year: 1, value: 1 }, { year: 2, value: 2 }])).toBeNull();
    expect(trendFit([{ year: 1, value: 1 }, { year: 2, value: 2 }, { year: 3, value: 3 }])?.slope).toBe(1);
  });
  it("calls a noisy trend unreliable and a clean one reliable", () => {
    // Target before values 1,3,2,5,4: slope 0.8, residual variance 3.6 / 3, se sqrt(1.2 / 10) = 0.346; t(3 df) = 3.182.
    const noisy = [1, 3, 2, 5, 4];
    const tn = rows("state:47", "cy", span(2010, 2022, (y) => (y >= 2011 && y <= 2015 ? noisy[y - 2011] : 4)));
    const flat = rows("state:51", "cy", span(2010, 2022, () => 3));
    const r = analyzeChange([{ geo: "state:47", rows: tn }, { geo: "state:51", rows: flat }], SPEC, "calendar_year", RULES);
    expect(r.states[0].slope).toBeCloseTo(0.8, 12);
    expect(r.states[0].slopeSE).toBeCloseTo(Math.sqrt(0.12), 12);
    expect(r.states[0].slopeDf).toBe(3);
    expect(r.states[1].slopeSE).toBeCloseTo(0, 12);
    const d = r.diffs[0];
    const gap = 6; // middles of 2011-2015 and 2017-2021
    expect(d.trendOnly).toBeCloseTo(0.8 * gap, 12);
    expect(d.trendOnlySE).toBeCloseTo(gap * Math.sqrt(0.12), 12);
    expect(d.trendOnlyInterval![1]).toBeCloseTo(0.8 * gap + 3.182 * gap * Math.sqrt(0.12), 6);
    expect(d.trendReliable).toBe(false); // 4.8 against a half-width of 6.6
    // A clean line: the same slope with no noise is reliable.
    const clean = rows("state:47", "cy", span(2010, 2022, (y) => (y >= 2011 && y <= 2015 ? y - 2010 : 4)));
    const r2 = analyzeChange([{ geo: "state:47", rows: clean }, { geo: "state:51", rows: flat }], SPEC, "calendar_year", RULES);
    expect(r2.diffs[0]).toMatchObject({ trendReliable: true });
    expect(r2.diffs[0].trendOnlySE).toBeCloseTo(0, 12);
  });
  it("is unknown with fewer than three before values", () => {
    const short = { ...SPEC, before: 2 };
    const r = analyzeChange(
      [{ geo: "state:47", rows: rows("state:47", "cy", stepped(1, 2)) }, { geo: "state:51", rows: rows("state:51", "cy", stepped(1, 1)) }],
      short, "calendar_year", RULES,
    );
    expect(r.states[0].slope).toBeNull();
    expect(r.diffs[0]).toMatchObject({ trendOnly: null, trendReliable: null, trendOnlyInterval: null });
  });
});

describe("pooled comparison and log changes", () => {
  const tn = rows("state:47", "cy", stepped(10, 14)); // change 4
  const a = rows("state:01", "cy", stepped(10, 11)); // change 1
  const b = rows("state:02", "cy", stepped(10, 13)); // change 3
  const c = rows("state:04", "cy", stepped(10, 15)); // change 5
  const all = [{ geo: "state:47", rows: tn }, { geo: "state:01", rows: a }, { geo: "state:02", rows: b }, { geo: "state:04", rows: c }];
  it("pools the comparison changes and leaves each state out in turn", () => {
    const p = analyzeChange(all, SPEC, "calendar_year", RULES).pooled!;
    expect(p.why).toBeNull();
    expect(p.weights).toEqual([1 / 3, 1 / 3, 1 / 3]);
    expect(p.comparisonChange).toBeCloseTo(3, 12);
    expect(p.diffChange).toBeCloseTo(1, 12);
    expect(p.leaveOneOut.map((x) => [x.dropped, x.diffChange])).toEqual([["state:01", 0], ["state:02", 1], ["state:04", 2]]);
    expect(p.range).toEqual([0, 2]);
  });
  it("reports how far the comparison states' own changes spread, which the pooled interval leaves out", () => {
    const p = analyzeChange(all, SPEC, "calendar_year", RULES).pooled!;
    expect(p.spread!.min).toBeCloseTo(1, 12);
    expect(p.spread!.max).toBeCloseTo(5, 12);
    expect(p.spread!.sd).toBeCloseTo(2, 12); // changes 1, 3, 5
    expect(p.spread!.targetInside).toBe(true); // the target's change is 4
    const far = analyzeChange([{ geo: "state:47", rows: rows("state:47", "cy", stepped(10, 20)) }, ...all.slice(1)], SPEC, "calendar_year", RULES).pooled!;
    expect(far.spread!.targetInside).toBe(false);
    expect(analyzeChange(all, { ...SPEC, yearSet: "own" }, "calendar_year", RULES).pooled!.spread).toBeNull();
  });
  it("weights the pool when asked", () => {
    const p = analyzeChange(all, SPEC, "calendar_year", RULES, { weights: { "state:01": 2, "state:02": 1, "state:04": 1 } }).pooled!;
    expect(p.weights).toEqual([0.5, 0.25, 0.25]);
    expect(p.comparisonChange).toBeCloseTo(2.5, 12);
    expect(p.diffChange).toBeCloseTo(1.5, 12);
  });
  it("carries sampling error into the pool", () => {
    const withErr = all.map((s) => ({ geo: s.geo, rows: withCi(s.rows, 1) }));
    const p = analyzeChange(withErr, SPEC, "calendar_year", RULES).pooled!;
    const se1 = Math.sqrt(0.4); // one state's change
    expect(p.comparisonChangeSE).toBeCloseTo(Math.sqrt(3 * (se1 / 3) ** 2), 12);
    expect(p.diffChangeSE).toBeCloseTo(Math.sqrt(se1 ** 2 + 3 * (se1 / 3) ** 2), 12);
    expect(p.diffZ).toBeCloseTo(p.diffChange! / p.diffChangeSE!, 12);
  });
  it("with one comparison state the pool is that state, with no range", () => {
    const p = analyzeChange(all.slice(0, 2), SPEC, "calendar_year", RULES).pooled!;
    expect(p.diffChange).toBeCloseTo(3, 12);
    expect(p.leaveOneOut).toEqual([]);
    expect(p.range).toBeNull();
  });
  it("has no pool without comparison states, and says why when it cannot pool", () => {
    expect(analyzeChange(all.slice(0, 1), SPEC, "calendar_year", RULES).pooled).toBeNull();
    expect(analyzeChange(all, { ...SPEC, yearSet: "own" }, "calendar_year", RULES).pooled).toMatchObject({ diffChange: null, why: expect.stringMatching(/own years/) });
  });
  it("differences log changes, which are symmetric where percent changes are not", () => {
    expect(logChange(10, 14)).toBeCloseTo(Math.log(1.4), 12);
    expect(logChange(0, 5)).toBeNull();
    expect(logChange(5, -1)).toBeNull();
    expect(logChange(null, 5)).toBeNull();
    const r = analyzeChange(
      [{ geo: "state:47", rows: rows("state:47", "cy", stepped(10, 14)) }, { geo: "state:51", rows: rows("state:51", "cy", stepped(20, 21)) }],
      SPEC, "calendar_year", RULES,
    );
    expect(r.diffs[0].diffLog).toBeCloseTo(Math.log(1.4) - Math.log(1.05), 12);
    expect(r.pooled!.diffLog).toBeCloseTo(Math.log(1.4) - Math.log(1.05), 12);
    // Swapping which state is the target flips the sign of the log difference exactly.
    const flip = analyzeChange(
      [{ geo: "state:51", rows: rows("state:51", "cy", stepped(20, 21)) }, { geo: "state:47", rows: rows("state:47", "cy", stepped(10, 14)) }],
      SPEC, "calendar_year", RULES,
    );
    expect(flip.diffs[0].diffLog).toBeCloseTo(-r.diffs[0].diffLog!, 12);
  });
});

describe("placebo-in-time", () => {
  it("moves dates by whole years, keeping 29 February valid", () => {
    expect(shiftDate("2016-07-01", -3)).toBe("2013-07-01");
    expect(shiftDate("2020-02-29", -1)).toBe("2019-02-28");
    expect(shiftDate("2020-02-29", -4)).toBe("2016-02-29");
  });
  it("shows how large a gap is when nothing happened", () => {
    // Flat before 2016 for both states, then the target steps up by 5: every placebo gap is exactly zero.
    const tn = rows("state:47", "cy", span(1985, 2023, (y) => (y < 2016 ? 10 : 15)));
    const va = rows("state:51", "cy", span(1985, 2023, () => 10));
    const pl = placeboInTime([{ geo: "state:47", rows: tn }, { geo: "state:51", rows: va }], SPEC, "calendar_year", RULES);
    expect(pl.why).toBeNull();
    // Placebo dates 2010-07-01 and earlier have windows ending before 2016 (their after windows end 2015 or earlier).
    expect(pl.runs.every((r) => r.lastYear < 2016)).toBe(true);
    expect(pl.runs.map((r) => r.date)[0]).toBe("2010-07-01");
    expect(pl.runs.length).toBe(15); // shifts of 6 to 20 years
    const s = pl.summaries[0];
    expect(s).toMatchObject({ geo: "state:51", actual: 5, n: 15, enough: true, typical: 0 });
    expect(s.values.every((v) => v === 0)).toBe(true);
    expect(s.share).toBeCloseTo(1 / 16, 12); // only the real change counts as extreme
    expect(pl.pooled).toMatchObject({ geo: "pooled", actual: 5, n: 15 });
  });
  it("finds the real gap ordinary when the series simply wanders", () => {
    // A zig-zag target against a flat comparison: placebo gaps are as large as the real one.
    const zig = (y: number) => 10 + (y % 2 === 0 ? 2 : -2) + (y >= 2016 ? 0 : 0);
    const tn = rows("state:47", "cy", span(1985, 2023, zig));
    const va = rows("state:51", "cy", span(1985, 2023, () => 10));
    const pl = placeboInTime([{ geo: "state:47", rows: tn }, { geo: "state:51", rows: va }], SPEC, "calendar_year", RULES);
    const s = pl.summaries[0];
    expect(s.actual).not.toBeNull();
    expect(s.share!).toBeGreaterThan(0.3); // not unusual
  });
  it("reports too little history instead of inventing a spread", () => {
    const tn = rows("state:47", "cy", span(2011, 2023, (y) => (y < 2016 ? 4 : 6)));
    const va = rows("state:51", "cy", span(2011, 2023, () => 3));
    const pl = placeboInTime([{ geo: "state:47", rows: tn }, { geo: "state:51", rows: va }], SPEC, "calendar_year", RULES);
    expect(pl.runs).toEqual([]);
    expect(pl.why).toMatch(/too little comparable history/);
  });
  it("does not quote a share from fewer than the minimum number of dates", () => {
    // Three years either side, history from 2008: only 2012-07-01 and 2011-07-01 leave three full years before
    // and a window that ends before 2016. Dates further back would have to make do with fewer years.
    const tn = rows("state:47", "cy", span(2008, 2023, (y) => (y < 2016 ? 4 : 6)));
    const va = rows("state:51", "cy", span(2008, 2023, () => 3));
    const pl = placeboInTime([{ geo: "state:47", rows: tn }, { geo: "state:51", rows: va }], { ...SPEC, before: 3, after: 3 }, "calendar_year", RULES);
    expect(pl.runs.map((r) => r.date)).toEqual(["2012-07-01", "2011-07-01"]);
    expect(pl.runs.length).toBeLessThan(PLACEBO_MIN_RUNS);
    expect(pl.summaries[0].enough).toBe(false);
  });
  it("needs a comparison state and a computable real comparison", () => {
    expect(placeboInTime([{ geo: "state:47", rows: rows("state:47", "cy", stepped(1, 2)) }], SPEC, "calendar_year", RULES).why).toMatch(/comparison state/);
    const tn = rows("state:47", "cy", span(2010, 2015, () => 1));
    const va = rows("state:51", "cy", span(2010, 2023, () => 1));
    expect(placeboInTime([{ geo: "state:47", rows: tn }, { geo: "state:51", rows: va }], SPEC, "calendar_year", RULES).why).toMatch(/no usable value after/);
  });
});
