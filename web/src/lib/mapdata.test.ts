import { describe, expect, it } from "vitest";
import { cellKind, changeBetween, colorFor, domainOf, inkFor, jumpWithinNoise, largestJump, position, rankCells, type MapCell } from "./mapdata";

const cell = (geo: string, value: number | null, missing: string | null = null): MapCell => ({
  geo,
  value,
  kind: cellKind(value, missing),
  why: missing,
  rec: null,
  period: "2024",
});
const NAMES: Record<string, string> = { a: "Alabama", b: "Bravo", c: "Charlie", d: "Delta", e: "Echo", f: "Foxtrot" };
const name = (g: string) => NAMES[g];

describe("missing, suppressed and zero stay apart", () => {
  it("classifies cells", () => {
    expect(cellKind(0, null)).toBe("zero");
    expect(cellKind(3, null)).toBe("value");
    expect(cellKind(null, "suppressed")).toBe("suppressed");
    expect(cellKind(null, "not_applicable")).toBe("not_applicable");
    expect(cellKind(null, "not_published")).toBe("missing");
    expect(cellKind(null, null)).toBe("missing");
  });
  it("ranks only values, shares ranks on ties, and lists the rest after", () => {
    const r = rankCells([cell("a", 2), cell("b", null, "suppressed"), cell("c", 5), cell("d", 0), cell("e", 5), cell("f", null)], name);
    expect(r.map((x) => [x.geo, x.rank])).toEqual([
      ["c", 1],
      ["e", 1],
      ["a", 3],
      ["d", 4], // a reported zero is a value and is ranked
      ["b", null],
      ["f", null],
    ]);
    expect(r.every((x) => x.rankLow === undefined && x.rankHigh === undefined)).toBe(true); // no published intervals, no range
  });
  it("adds a rank range only for states with a published interval", () => {
    const withSe = (c: MapCell, se: number | null): MapCell => ({ ...c, se });
    const r = rankCells([withSe(cell("a", 10), 3), withSe(cell("c", 11), 3), withSe(cell("d", 50), null), withSe(cell("e", 9), 3), cell("f", null)], name);
    const by = Object.fromEntries(r.map((x) => [x.geo, x]));
    expect(by.d.rankLow).toBeUndefined(); // no interval of its own: no range, rank stays 1
    expect(by.d.rank).toBe(1);
    expect(by.a.rank).toBe(3);
    expect(by.a.rankLow).toBeGreaterThanOrEqual(2);
    expect(by.a.rankHigh!).toBeGreaterThan(by.a.rankLow!);
    expect(by.a.rankHigh!).toBeLessThanOrEqual(4);
    expect(by.f.rankLow).toBeUndefined();
  });
});

describe("color scales", () => {
  it("runs from lowest to highest for levels", () => {
    const d = domainOf([2, 4, 6], false)!;
    expect(d).toEqual({ min: 2, max: 6, diverging: false });
    expect(position(4, d)).toBe(0.5);
    expect(colorFor(2, d)).toBe("#eff3ff");
    expect(colorFor(6, d)).toBe("#08306b");
  });
  it("centres changes on zero, symmetric, like the Census retail map", () => {
    const d = domainOf([-7.6, 11.3, 0.2], true)!;
    expect(d).toEqual({ min: -11.3, max: 11.3, diverging: true });
    expect(colorFor(0, d)).toBe("#f7f7f7");
    expect(colorFor(-11.3, d)).toBe("#d68028");
    expect(colorFor(11.3, d)).toBe("#1e5494");
  });
  it("trims a scale shared by many periods so one extreme period cannot wash out the rest", () => {
    // 200 ordinary changes of -10..+10 and one +354% (April 2021 against the April 2020 lockdown month).
    const v = [...Array.from({ length: 200 }, (_, i) => -10 + i / 10), 354];
    const full = domainOf(v, true)!;
    expect(full.max).toBe(354);
    const d = domainOf(v, true, true)!;
    expect(d.max).toBeLessThan(11);
    expect(d.min).toBe(-d.max);
    expect(d.clipped?.high).toBe(true);
    expect(colorFor(354, d)).toBe("#1e5494"); // beyond the end: the end color, never a new one
    expect(colorFor(7.5, d)).not.toBe("#f7f7f7");
    // Too few values to trim (one period's map): the full range, unclipped.
    expect(domainOf([-7.6, 11.3, 0.2], true, true)).toEqual({ min: -11.3, max: 11.3, diverging: true });
    const levels = domainOf([...Array.from({ length: 150 }, (_, i) => 1 + i / 100), 9], false, true)!;
    expect(levels.max).toBeLessThan(9);
    expect(levels.clipped?.high).toBe(true);
  });
  it("has no domain without values, and picks readable label ink", () => {
    expect(domainOf([], false)).toBeNull();
    expect(inkFor("#08306b")).toBe("#ffffff");
    expect(inkFor("#eff3ff")).toBe("#111111");
  });
});

describe("large one-year jumps inside a change span", () => {
  // Utah's Census T10, $ thousands, as published: 50,002 in FY2017, 7,959 in FY2018.
  const ut = [
    { period: "2014", value: 48413 },
    { period: "2017", value: 50002 },
    { period: "2018", value: 7959 },
    { period: "2019", value: 14203 },
    { period: "2025", value: 19086 },
  ];
  it("finds the largest, either way", () => {
    const j = largestJump(ut, "2014", "2025")!;
    expect([j.from, j.to]).toEqual(["2017", "2018"]);
    expect(j.pct).toBeCloseTo(-84.08, 1);
  });
  it("looks only inside the span and ignores ordinary changes", () => {
    expect(largestJump(ut, "2019", "2025")).toBeNull(); // +34% is under the threshold
    expect(largestJump(ut, "2014", "2017")).toBeNull();
  });
  it("does not bridge a missing value", () => {
    expect(largestJump([{ period: "2017", value: 50 }, { period: "2018", value: null }, { period: "2019", value: 5 }], "2017", "2019")).toBeNull();
  });
});

describe("a jump that stays inside the published error is not flagged", () => {
  // Utah deaths counted by FARS, with the count-noise standard errors the build now publishes: a +58% move,
  // but 22 deaths apart on a combined error of about 12, so z is under 1.96.
  const deaths = [
    { period: "2019", value: 38.0, se: 8.7 },
    { period: "2020", value: 60.1, se: 8.1 },
  ];
  it("holds back the flag when both ends carry an error and the gap is within chance", () => {
    expect(jumpWithinNoise(deaths[0], deaths[1])).toBe(true);
    expect(largestJump(deaths, "2019", "2020")).toBeNull();
  });
  it("still flags the same move when there is no error to judge it against", () => {
    const bare = deaths.map(({ period, value }) => ({ period, value }));
    expect(jumpWithinNoise(bare[0], bare[1])).toBe(false);
    expect(largestJump(bare, "2019", "2020")!.pct).toBeCloseTo(58.16, 1);
  });
  it("still flags a move that clears the noise", () => {
    const j = largestJump([{ period: "2019", value: 38.0, se: 3 }, { period: "2020", value: 90, se: 3 }], "2019", "2020")!;
    expect([j.from, j.to]).toEqual(["2019", "2020"]);
  });
  it("needs an error at both ends", () => {
    expect(jumpWithinNoise({ value: 38, se: 8.7 }, { value: 60, se: null })).toBe(false);
    expect(jumpWithinNoise({ value: null, se: 8.7 }, { value: 60, se: 8 })).toBe(false);
  });
});

describe("change over time", () => {
  it("is a percent of the base, undefined for a zero or negative base", () => {
    expect(changeBetween(4, 5)).toEqual({ value: 25, why: null });
    expect(changeBetween(0, 5).value).toBeNull();
    expect(changeBetween(-1, 5).value).toBeNull();
    expect(changeBetween(null, 5).why).toBe("no value in the base period");
  });
});
