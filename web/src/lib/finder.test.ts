import { describe, expect, it } from "vitest";
import type { ObsRow } from "./bundle";
import {
  MIN_LAMBDA,
  baselineGroup,
  baselineTrend,
  baselineValue,
  decorrelation,
  finderWarnings,
  mahalanobisScore,
  rank,
  rankCandidates,
  scaleOf,
  scaledDiff,
  score,
  similarityWord,
  trendPercent,
  type CharData,
  type Characteristic,
  type Decorrelation,
} from "./finder";
import type { MetricMeta, Obs } from "./types";

const row = (geo: string, year: number, value: number | null, group = "g"): ObsRow => ({
  meta: { metric_id: "m" } as MetricMeta,
  obs: { geo_id: geo, year, value, comparability_group: group, observation_id: `${geo}${year}` } as Obs,
});

describe("baseline values", () => {
  it("averages the baseline years and needs at least half of them", () => {
    const r = [row("a", 2015, 2), row("a", 2016, 4), row("a", 2017, null), row("a", 2018, 6), row("a", 2020, 100)];
    expect(baselineValue(r, 2015, 2019, null, "numeric")).toMatchObject({ value: 4, years: [2015, 2016, 2018], why: null });
    expect(baselineValue(r.slice(0, 2), 2015, 2019, null, "numeric")).toMatchObject({ value: null, why: "values in 2 of 5 baseline years (needs 3)" });
  });
  it("averages within one comparability group only", () => {
    const r = [row("t", 2009, 10, "old"), row("t", 2010, 10, "old"), row("t", 2011, 20, "new"), row("t", 2012, 22, "new")];
    const g = baselineGroup(new Map([["t", r]]), "t", 2009, 2012);
    expect(g).toBe("new");
    expect(baselineValue(r, 2009, 2012, g, "numeric")).toMatchObject({ value: 21, years: [2011, 2012] });
  });
  it("a yes/no characteristic must hold in every baseline year", () => {
    expect(baselineValue([row("a", 2014, 5), row("a", 2015, 7)], 2014, 2015, null, "binary").value).toBe(1);
    expect(baselineValue([row("a", 2014, 0), row("a", 2015, 0)], 2014, 2015, null, "binary").value).toBe(0);
    expect(baselineValue([row("a", 2014, 0), row("a", 2015, 7)], 2014, 2015, null, "binary")).toMatchObject({ value: null, why: "reported in some baseline years but not others" });
  });
});

describe("scaling by hand", () => {
  it("uses the population SD across states", () => {
    // values 2, 4, 6: mean 4, SD sqrt(8/3)
    const s = scaleOf([2, 4, 6, null], { scale: "linear", kind: "numeric" }, 4);
    expect(s).toMatchObject({ usable: true, mean: 4, n: 3 });
    expect(s.sd).toBeCloseTo(Math.sqrt(8 / 3), 12);
    expect(scaledDiff(2, 6, { scale: "linear", kind: "numeric" }, s)).toBeCloseTo(4 / Math.sqrt(8 / 3), 12);
  });
  it("logs size measures, so equal ratios are equal differences", () => {
    const s = scaleOf([1e6, 1e7, 1e8], { scale: "log10", kind: "numeric" }, 1e7);
    expect(scaledDiff(1e6, 1e7, { scale: "log10", kind: "numeric" }, s)).toBeCloseTo(scaledDiff(1e7, 1e8, { scale: "log10", kind: "numeric" }, s)!, 12);
  });
  it("refuses a characteristic that cannot tell states apart, or that the target lacks", () => {
    expect(scaleOf([5, 5, 5], { scale: "linear", kind: "numeric" }, 5)).toMatchObject({ usable: false, why: "every state has the same value, so it cannot tell states apart" });
    expect(scaleOf([1, 2], { scale: "linear", kind: "numeric" }, 1).usable).toBe(false);
    expect(scaleOf([1, 2, 3], { scale: "linear", kind: "numeric" }, null)).toMatchObject({ usable: false, why: "the target state has no baseline value" });
  });
  it("labels differences", () => {
    expect(similarityWord(0.2, "numeric")).toBe("similar");
    expect(similarityWord(1.5, "numeric")).toBe("different");
    expect(similarityWord(0.7, "numeric")).toBe("in between");
    expect(similarityWord(null, "numeric")).toBe("missing");
    expect(similarityWord(1, "binary")).toBe("different");
  });
});

describe("scores and ranking", () => {
  it("is the weighted root-mean-square of the differences", () => {
    // weights 1 and 3, differences 2 and 0: sqrt((1*4 + 3*0) / 4) = 1
    expect(score([{ id: "a", weight: 1, diff: 2 }, { id: "b", weight: 3, diff: 0 }])).toEqual({ score: 1, used: 2, missing: 0 });
    expect(score([{ id: "a", weight: 0, diff: 2 }, { id: "b", weight: 1, diff: 1 }]).score).toBe(1); // weight 0 = left out
  });
  it("never lets missing data look like a good match", () => {
    const parts = (a: number | null, b: number | null) => [
      { id: "x", weight: 1, diff: a },
      { id: "y", weight: 1, diff: b },
    ];
    const ranked = rank(
      [
        { item: "complete-but-far", name: "B", parts: parts(1, 1) },
        { item: "close-on-one-missing-other", name: "A", parts: parts(0, null) },
        { item: "nothing", name: "C", parts: parts(null, null) },
      ],
      0.5,
    );
    expect(ranked.map((r) => r.item)).toEqual(["complete-but-far", "close-on-one-missing-other", "nothing"]);
    expect(ranked[1]).toMatchObject({ score: 0, missing: 1, coverage: 0.5, eligible: true });
    expect(ranked[2]).toMatchObject({ score: null, eligible: false });
    // With full coverage required, the incomplete candidate is not scored at all.
    expect(rank([{ item: "a", name: "A", parts: parts(0, null) }], 1)[0].eligible).toBe(false);
  });
});

// ----- trend characteristics -------------------------------------------------------------------------------

describe("baseline trends", () => {
  const grow = (rate: number, from = 2010, to = 2014) => Array.from({ length: to - from + 1 }, (_, i) => row("a", from + i, 100 * (1 + rate) ** i));
  it("is the slope of the log of the yearly values", () => {
    const t = baselineTrend(grow(0.1), 2010, 2014, null);
    expect(t.value).toBeCloseTo(Math.log(1.1), 12);
    expect(trendPercent(t.value!)).toBeCloseTo(10, 10);
    expect(trendPercent(baselineTrend(grow(-0.05), 2010, 2014, null).value!)).toBeCloseTo(-5, 10);
    expect(baselineTrend(grow(0), 2010, 2014, null).value).toBeCloseTo(0, 12);
  });
  it("needs three years, enough coverage and positive values", () => {
    expect(baselineTrend(grow(0.1, 2013, 2014), 2013, 2014, null)).toMatchObject({ value: null, why: "a trend needs a baseline of at least three years" });
    expect(baselineTrend(grow(0.1).slice(0, 2), 2010, 2014, null)).toMatchObject({ value: null, why: "values in 2 of 5 baseline years (a trend needs 3)" });
    expect(baselineTrend([row("a", 2010, 5), row("a", 2011, 0), row("a", 2012, 6)], 2010, 2012, null)).toMatchObject({ value: null, why: "has zero or negative values, so no growth rate" });
  });
  it("uses one comparability group only", () => {
    const r = [row("a", 2010, 1, "old"), row("a", 2011, 1000, "old"), row("a", 2012, 100, "new"), row("a", 2013, 110, "new"), row("a", 2014, 121, "new")];
    expect(baselineTrend(r, 2010, 2014, "new").value).toBeCloseTo(Math.log(1.1), 12);
  });
});

// ----- decorrelated distance -------------------------------------------------------------------------------

const chr = (id: string, kind: "numeric" | "binary" = "numeric"): Characteristic => ({ id, label: id, help: "", metric: "m", shown: "nominal", scale: "linear", kind, defaultOn: true });
const cdata = (id: string, vals: Record<string, number | null>, kind: "numeric" | "binary" = "numeric"): CharData => {
  const c = chr(id, kind);
  const values = new Map(Object.entries(vals).map(([g, value]) => [g, { value, years: [], why: null, rows: [] }]));
  return { c, meta: undefined, values, scale: scaleOf([...values.values()].map((v) => v.value), c, values.get("T")!.value), group: null };
};
const ident = (ids: string[]): Decorrelation => ({ ids, R: ids.map((_, i) => ids.map((_, j) => (i === j ? 1 : 0))), lambda: 1, raw: [] });
const corr2 = (r: number): Decorrelation => ({ ids: ["a", "b"], R: [[1, r], [r, 1]], lambda: 0, raw: [] });
const parts = (a: number, b: number, wa = 1, wb = 1) => [
  { id: "a", weight: wa, diff: Math.abs(a), signed: a },
  { id: "b", weight: wb, diff: Math.abs(b), signed: b },
];

describe("Mahalanobis score by hand", () => {
  it("is the weighted root-mean-square difference when characteristics are independent", () => {
    // weights 1 and 3, differences 2 and 0: sqrt((1*4 + 3*0) / 4) = 1, as score() gives
    expect(mahalanobisScore(parts(2, 0, 1, 3), ident(["a", "b"]))).toEqual({ score: 1, used: 2, missing: 0 });
    expect(mahalanobisScore(parts(2, 0, 1, 3), ident(["a", "b"])).score).toBe(score(parts(2, 0, 1, 3)).score);
    expect(mahalanobisScore(parts(2, 0, 1, 3), null).score).toBe(1); // no matrix at all: the same
  });
  it("counts two correlated characteristics once", () => {
    // r = 0.9, both 1 SD out in the usual direction: d2 = 2 / 1.9, score = sqrt(d2 / 2) = sqrt(1 / 1.9)
    expect(mahalanobisScore(parts(1, 1), corr2(0.9)).score).toBeCloseTo(Math.sqrt(1 / 1.9), 12);
    expect(score(parts(1, 1)).score).toBe(1); // plain distance counts it twice over
  });
  it("punishes a state that differs against the usual direction", () => {
    // r = 0.9, +1 and -1 SD: d2 = 2 / 0.1 = 20, score = sqrt(10)
    expect(mahalanobisScore(parts(1, -1), corr2(0.9)).score).toBeCloseTo(Math.sqrt(10), 10);
    // and negative correlation turns the same two differences around
    expect(mahalanobisScore(parts(1, -1), corr2(-0.9)).score).toBeCloseTo(Math.sqrt(1 / 1.9), 12);
  });
  it("uses only the characteristics both states have, and never reads a missing one as a match", () => {
    const p = [{ id: "a", weight: 1, diff: 0.5, signed: 0.5 }, { id: "b", weight: 1, diff: null, signed: null }];
    expect(mahalanobisScore(p, corr2(0.9))).toEqual({ score: 0.5, used: 1, missing: 1 });
    expect(mahalanobisScore([{ id: "a", weight: 1, diff: null }], corr2(0.9))).toEqual({ score: null, used: 0, missing: 1 });
    expect(mahalanobisScore([{ id: "a", weight: 0, diff: 3, signed: 3 }, { id: "b", weight: 1, diff: 1, signed: 1 }], corr2(0.9)).score).toBeCloseTo(1, 12); // weight 0 = left out
  });
  it("adds yes/no characteristics outside the decorrelation", () => {
    const p = [{ id: "a", weight: 1, diff: 0, signed: 0 }, { id: "m", weight: 1, diff: 1 }];
    expect(mahalanobisScore(p, corr2(0.9)).score).toBeCloseTo(Math.sqrt(1 / 2), 12);
  });
});

describe("decorrelation across states", () => {
  // 18 states on a line plus the target and two candidates; b follows a closely.
  const line = (f: (i: number) => number) => Object.fromEntries(Array.from({ length: 18 }, (_, k) => [`S${String(k + 1).padStart(2, "0")}`, f(k + 1)]));
  const a = cdata("a", { ...line((i) => i), T: 9.5, P: 15, Q: 15 });
  const b = cdata("b", { ...line((i) => i + (i % 2 ? 0.5 : -0.5)), T: 9.5, P: 15, Q: 4 });
  it("measures how closely the characteristics move together and shrinks toward independence", () => {
    const d = decorrelation([a, b]);
    expect(d.ids).toEqual(["a", "b"]);
    expect(d.raw[0][1]).toBeGreaterThan(0.85);
    expect(d.lambda).toBeGreaterThanOrEqual(MIN_LAMBDA);
    expect(d.lambda).toBeLessThanOrEqual(1);
    expect(d.R[0][0]).toBe(1);
    expect(d.R[0][1]).toBeCloseTo((1 - d.lambda) * d.raw[0][1], 12);
    expect(d.R[0][1]).toBeLessThan(d.raw[0][1]);
  });
  it("estimates no correlation from too few states", () => {
    const few = (v: number[]) => cdata("x", Object.fromEntries([["T", 1], ...v.map((x, i) => [`S${i}`, x])]));
    const d = decorrelation([few([2, 3, 4, 5]), { ...few([2, 3, 4, 5]), c: chr("y") }]);
    expect(d.raw[0][1]).toBe(0);
    expect(d.R).toEqual([[1, 0], [0, 1]]);
  });
  it("ranks the state that differs along the usual direction ahead of one that differs against it", () => {
    const pool = ["P", "Q"];
    const nm = (g: string) => g;
    const m = rankCandidates([a, b], "T", pool, nm, {}, 1);
    const r = rankCandidates([a, b], "T", pool, nm, {}, 1, { distance: "rms" });
    expect(m.distance).toBe("mahalanobis");
    expect(m.ranked.map((x) => x.item)).toEqual(["P", "Q"]);
    expect(m.ranked[1].score!).toBeGreaterThan(2 * m.ranked[0].score!);
    // The plain distance cannot tell them apart (both are 5.5 out on each characteristic).
    const sc = (g: string) => r.ranked.find((x) => x.item === g)!.score!;
    expect(Math.abs(sc("P") - sc("Q")) / sc("P")).toBeLessThan(0.1);
    expect(r.decorrelation).toBeNull();
  });
  it("reduces to the plain distance with one characteristic", () => {
    const m = rankCandidates([a], "T", ["P"], (g) => g, {}, 1);
    const r = rankCandidates([a], "T", ["P"], (g) => g, {}, 1, { distance: "rms" });
    expect(m.ranked[0].score).toBeCloseTo(r.ranked[0].score!, 12);
  });
  it("gives a pair score from the same distance", () => {
    const m = rankCandidates([a, b], "T", ["P", "Q"], (g) => g, {}, 1);
    expect(m.pairScore("T", "P")).toBeCloseTo(m.ranked.find((x) => x.item === "P")!.score!, 12);
    expect(m.pairScore("P", "T")).toBeCloseTo(m.pairScore("T", "P")!, 12);
  });
});

describe("warnings about the match", () => {
  const spread = (n: number, f: (i: number) => number) => Object.fromEntries(Array.from({ length: n }, (_, k) => [`S${String(k + 1).padStart(2, "0")}`, f(k + 1)]));
  const run = (cd: CharData[], pool: string[], minCoverage = 1) => {
    const r = rankCandidates(cd, "T", pool, (g) => g, {}, minCoverage, { distance: "rms" });
    return finderWarnings(r, "T", (g) => (g === "T" ? "Target" : g));
  };
  it("warns when the target is outside the range of every other state, and the closest state is still far", () => {
    const x = cdata("x", { ...spread(14, (i) => i), T: 60 });
    const w = run([x], Object.keys(spread(14, (i) => i)));
    expect(w.map((v) => v.id)).toEqual(["extreme_target", "far_match"]);
    expect(w[0].text).toMatch(/x \(3\.6 SD above the state average; no other state is as high\)/);
    expect(w[1].text).toMatch(/Even the closest state, S14, scores 3\.37/);
    expect(w[1].text).toMatch(/or more and farther than 90% of states/);
  });
  it("stays quiet for a target in the middle of the states", () => {
    const x = cdata("x", { ...spread(20, (i) => i), T: 10.4 });
    expect(run([x], Object.keys(spread(20, (i) => i)))).toEqual([]);
  });
  it("flags a closest state that is far only relative to how close states usually are", () => {
    // States 0.1 apart, but the target sits 0.2 from the nearest one: under 1 SD and inside the usual range, yet far for this crowd.
    const x = cdata("x", { ...spread(20, (i) => i * 0.1), T: 2.2 });
    const w = run([x], Object.keys(spread(20, (i) => i * 0.1)));
    expect(w.map((v) => v.id)).toEqual(["far_match"]);
    expect(w[0].text).not.toMatch(/SD or more/);
  });
  it("says so when very few states can be scored", () => {
    const x = cdata("x", { ...spread(12, (i) => i), T: 6.5 });
    const w = run([x], ["S01", "S02"]);
    expect(w.some((v) => v.id === "few_candidates")).toBe(true);
  });
});
