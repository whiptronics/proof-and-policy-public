import { describe, expect, it } from "vitest";
import {
  contrast,
  hashSeed,
  intervalKind,
  intervalPhrase,
  mulberry32,
  normalCdf,
  normalQuantile,
  olsLine,
  pairwiseContrasts,
  quantileSorted,
  seFromInterval,
  seOfMean,
  seOfSum,
  slopeInterval95,
  stdNormal,
  summarize,
  tCritical95,
  twoSidedP,
  zForLevel,
} from "./stats";

describe("normal distribution", () => {
  it("matches reference values", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 7);
    expect(normalCdf(1.96)).toBeCloseTo(0.9750021, 6);
    expect(normalCdf(-1.96)).toBeCloseTo(0.0249979, 6);
    expect(twoSidedP(1.96)).toBeCloseTo(0.05, 4);
    expect(twoSidedP(0)).toBeCloseTo(1, 7);
    expect(twoSidedP(-2.576)).toBeCloseTo(0.01, 3);
  });
  it("inverts the cdf", () => {
    expect(normalQuantile(0.975)).toBeCloseTo(1.959964, 5);
    expect(normalQuantile(0.5)).toBeCloseTo(0, 9);
    expect(normalQuantile(0.025)).toBeCloseTo(-1.959964, 5);
    expect(normalQuantile(0.995)).toBeCloseTo(2.575829, 5);
    expect(zForLevel(0.95)).toBeCloseTo(1.959964, 5);
    expect(zForLevel(0.9)).toBeCloseTo(1.644854, 5);
    for (const p of [0.001, 0.02, 0.3, 0.7, 0.98, 0.999]) expect(normalCdf(normalQuantile(p))).toBeCloseTo(p, 6);
    expect(normalQuantile(0)).toBe(-Infinity);
    expect(normalQuantile(1)).toBe(Infinity);
    expect(normalQuantile(1.5)).toBeNaN();
  });
});

describe("Student t", () => {
  it("matches the table and tends to the normal value", () => {
    expect(tCritical95(1)).toBeCloseTo(12.706, 3);
    expect(tCritical95(3)).toBeCloseTo(3.182, 3);
    expect(tCritical95(10)).toBeCloseTo(2.228, 3);
    expect(tCritical95(30)).toBeCloseTo(2.042, 3);
    expect(tCritical95(60)).toBeCloseTo(2.0, 3);
    expect(tCritical95(1e9)).toBeCloseTo(1.96, 3);
    expect(tCritical95(Infinity)).toBe(1.96);
  });
  it("interpolates between rows and refuses less than one degree of freedom", () => {
    const t = tCritical95(35)!;
    expect(t).toBeLessThan(2.042);
    expect(t).toBeGreaterThan(2.021);
    expect(tCritical95(0)).toBeNull();
    expect(tCritical95(0.5)).toBeNull();
  });
});

describe("uncertainty from published intervals", () => {
  it("turns a 95% interval into a standard error", () => {
    expect(seFromInterval(40, 50, 0.95)).toBeCloseTo(10 / (2 * 1.959964), 5);
    expect(seFromInterval(40, 50, 0.9)).toBeCloseTo(10 / (2 * 1.644854), 5);
    expect(seFromInterval(40, 50, null)).toBeCloseTo(10 / (2 * 1.959964), 5); // BRFSS intervals are 95%
  });
  it("refuses missing or reversed limits", () => {
    expect(seFromInterval(null, 50)).toBeNull();
    expect(seFromInterval(40, undefined)).toBeNull();
    expect(seFromInterval(50, 40)).toBeNull();
    expect(seFromInterval(Number.NaN, 40)).toBeNull();
  });
  it("combines independent errors", () => {
    expect(seOfMean([3, 4])).toBeCloseTo(2.5, 12); // sqrt(9 + 16) / 2
    expect(seOfMean([3, null])).toBeNull();
    expect(seOfMean([])).toBeNull();
    expect(seOfSum([3, 4])).toBeCloseTo(5, 12);
    expect(seOfSum([3, null])).toBeNull();
  });
});

describe("asymmetric intervals and what an interval describes", () => {
  it("uses the larger side of the interval when the estimate is given", () => {
    // A skewed interval, 10 to 20 around 12: the upper side (8) is the larger and sets the error.
    expect(seFromInterval(10, 20, 0.95, 12)).toBeCloseTo(8 / 1.959964, 5);
    expect(seFromInterval(10, 20, 0.95, 18)).toBeCloseTo(8 / 1.959964, 5);
    // Symmetric, or no usable estimate: half the width.
    expect(seFromInterval(40, 50, 0.95, 45)).toBeCloseTo(seFromInterval(40, 50, 0.95)!, 12);
    expect(seFromInterval(40, 50, 0.95, 60)).toBeCloseTo(seFromInterval(40, 50, 0.95)!, 12);
    expect(seFromInterval(40, 50, 0.95, null)).toBeCloseTo(seFromInterval(40, 50, 0.95)!, 12);
  });
  it("names sampling error, count noise or the source's own interval", () => {
    expect(intervalKind({ estimate_type: "survey_estimate", comparability_group: "brfss|x" })).toBe("sampling");
    expect(intervalKind({ estimate_type: "count", comparability_group: "fars|fars_traffic_fatalities" })).toBe("count");
    expect(intervalKind({ estimate_type: "derived", comparability_group: "derived|fars_traffic_deaths_per_100k" })).toBe("count");
    expect(intervalKind({ estimate_type: "rate", comparability_group: "cdc_wonder|x" })).toBe("source");
    expect(intervalKind({})).toBe("source");
    expect(intervalPhrase("sampling")).toBe("sampling error");
    expect(intervalPhrase("count")).toMatch(/chance variation/);
    expect(intervalPhrase("source")).toMatch(/source/);
  });
});

describe("contrast of two estimates", () => {
  it("tests the gap, not whether the intervals overlap", () => {
    // 20 +/- 3.92 (se 2) against 26 +/- 3.92 (se 2): the 95% intervals (16.1-23.9 and 22.1-29.9) overlap,
    // but the gap of 6 has standard error 2.83, z = 2.12, p = 0.034.
    const c = contrast({ value: 26, se: 2 }, { value: 20, se: 2 });
    expect(c.diff).toBe(6);
    expect(c.se).toBeCloseTo(Math.sqrt(8), 12);
    expect(c.z).toBeCloseTo(2.1213, 3);
    expect(c.p).toBeCloseTo(0.0339, 3);
    expect(c.verdict).toBe("differs");
    expect(c.interval![0]).toBeCloseTo(6 - 1.959964 * Math.sqrt(8), 4);
  });
  it("calls a small gap noise", () => {
    expect(contrast({ value: 21, se: 2 }, { value: 20, se: 2 }).verdict).toBe("within_noise");
  });
  it("is unknown, never noise, when an error is missing", () => {
    const c = contrast({ value: 21, se: null }, { value: 20, se: 2 });
    expect(c).toMatchObject({ verdict: "unknown", se: null, z: null, p: null, interval: null, diff: 1 });
  });
  it("handles exact estimates", () => {
    expect(contrast({ value: 3, se: 0 }, { value: 3, se: 0 }).verdict).toBe("within_noise");
    expect(contrast({ value: 4, se: 0 }, { value: 3, se: 0 }).verdict).toBe("differs");
  });
});

describe("least squares line", () => {
  it("matches a textbook fit", () => {
    // x = 1..5, y = 2,4,5,4,5: slope 0.6, intercept 2.2, RSS 2.4 on 3 df, se = sqrt(0.8 / 10)
    const f = olsLine([2, 4, 5, 4, 5].map((y, i) => ({ x: i + 1, y })))!;
    expect(f.slope).toBeCloseTo(0.6, 12);
    expect(f.intercept).toBeCloseTo(2.2, 12);
    expect(f.rss).toBeCloseTo(2.4, 12);
    expect(f.df).toBe(3);
    expect(f.se).toBeCloseTo(Math.sqrt(0.08), 12);
    const [lo, hi] = slopeInterval95(f)!;
    expect(lo).toBeCloseTo(0.6 - 3.182 * Math.sqrt(0.08), 3);
    expect(hi).toBeCloseTo(0.6 + 3.182 * Math.sqrt(0.08), 3);
  });
  it("gives a zero error for an exact line and none for two points", () => {
    const exact = olsLine([1, 2, 3, 4].map((x) => ({ x, y: 2 * x + 1 })))!;
    expect(exact.slope).toBeCloseTo(2, 12);
    expect(exact.se).toBeCloseTo(0, 12);
    const two = olsLine([{ x: 1, y: 1 }, { x: 2, y: 3 }])!;
    expect(two.slope).toBe(2);
    expect(two.se).toBeNull();
    expect(slopeInterval95(two)).toBeNull();
  });
  it("refuses one point or no spread", () => {
    expect(olsLine([{ x: 1, y: 1 }])).toBeNull();
    expect(olsLine([{ x: 1, y: 1 }, { x: 1, y: 2 }])).toBeNull();
  });
});

describe("seeded randomness", () => {
  it("repeats for the same seed and differs between seeds", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const xs = Array.from({ length: 5 }, () => a());
    expect(xs).toEqual(Array.from({ length: 5 }, () => b()));
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(mulberry32(43)()).not.toBe(xs[0]);
    expect(hashSeed("utah")).toBe(hashSeed("utah"));
    expect(hashSeed("utah")).not.toBe(hashSeed("Utah"));
  });
  it("draws standard normals", () => {
    const rng = mulberry32(7);
    const xs = Array.from({ length: 20000 }, () => stdNormal(rng));
    const s = summarize(xs)!;
    expect(s.mean).toBeCloseTo(0, 1);
    expect(s.sd!).toBeCloseTo(1, 1);
    expect(s.p05).toBeCloseTo(-1.645, 1);
    expect(s.p95).toBeCloseTo(1.645, 1);
  });
});

describe("summaries", () => {
  it("interpolates quantiles", () => {
    expect(quantileSorted([1, 2, 3, 4, 5], 0.5)).toBe(3);
    expect(quantileSorted([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantileSorted([], 0.5)).toBeNaN();
  });
  it("summarizes, ignoring non-finite values", () => {
    const s = summarize([4, 1, 3, 2, Number.NaN])!;
    expect(s).toMatchObject({ n: 4, mean: 2.5, min: 1, max: 4, median: 2.5 });
    expect(s.sd).toBeCloseTo(Math.sqrt(5 / 3), 12);
    expect(summarize([])).toBeNull();
    expect(summarize([5])!.sd).toBeNull();
  });
});

describe("pairwise contrasts", () => {
  it("tests every pair on its own gap, and leaves unknowns unknown", () => {
    const items = [
      { id: "UT", value: 20, se: 1 },
      { id: "CO", value: 21, se: 1 },
      { id: "TN", value: 30, se: 1 },
      { id: "XX", value: 22, se: null },
    ];
    const pairs = pairwiseContrasts(items);
    expect(pairs.length).toBe(6);
    const by = (a: string, b: string) => pairs.find((p) => p.a.id === a && p.b.id === b)!.contrast;
    expect(by("UT", "CO").verdict).toBe("within_noise"); // gap 1, se 1.41
    expect(by("UT", "TN").verdict).toBe("differs"); // gap 10
    expect(by("UT", "XX").verdict).toBe("unknown");
    expect(by("UT", "CO").diff).toBe(-1);
  });
});
