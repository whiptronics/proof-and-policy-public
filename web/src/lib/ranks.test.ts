import { describe, expect, it } from "vitest";
import { competitionRanks, rankIntervals, rankRangeText } from "./ranks";
import { normalCdf } from "./stats";

describe("competition ranks", () => {
  it("gives equal values the best shared rank", () => {
    expect(competitionRanks([5, 9, 5, 1])).toEqual([2, 1, 2, 4]);
    expect(competitionRanks([])).toEqual([]);
  });
});

describe("rank intervals", () => {
  const items = (vals: number[], se: number | null) => vals.map((value, i) => ({ id: `s${i}`, value, se }));
  it("is exactly the rank when there is no sampling error anywhere", () => {
    const r = rankIntervals(items([3, 1, 2], null), { draws: 200 });
    expect([...r.values()].map((x) => [x.rank, x.low, x.high, x.hasSe])).toEqual([[1, 1, 1, false], [3, 3, 3, false], [2, 2, 2, false]]);
  });
  it("lets well separated states keep their places", () => {
    const r = rankIntervals(items([100, 50, 0], 1), { draws: 500 });
    expect([r.get("s0")!.low, r.get("s0")!.high, r.get("s2")!.low, r.get("s2")!.high]).toEqual([1, 1, 3, 3]);
  });
  it("matches the normal probability of two states swapping", () => {
    // 0 and 1, each with SE 1: P(second is above first) = Phi(1 / sqrt 2)
    const r = rankIntervals([{ id: "lo", value: 0, se: 1 }, { id: "hi", value: 1, se: 1 }], { draws: 40000, seed: 9 });
    const pAbove = normalCdf(1 / Math.SQRT2);
    expect(r.get("hi")!.distribution[0]).toBeCloseTo(pAbove, 1);
    expect(r.get("lo")!.distribution[0]).toBeCloseTo(1 - pAbove, 1);
    expect([r.get("lo")!.low, r.get("lo")!.high]).toEqual([1, 2]);
    expect(r.get("lo")!.rank).toBe(2);
  });
  it("widens the interval as the sampling error grows, and more for states in the crowded middle", () => {
    const vals = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
    const width = (se: number, id: string) => {
      const x = rankIntervals(items(vals, se), { draws: 3000, seed: 4 }).get(id)!;
      return x.high - x.low;
    };
    expect(width(0.5, "s4")).toBeLessThanOrEqual(width(2, "s4"));
    expect(width(2, "s4")).toBeGreaterThan(width(2, "s0")); // the top state can only move down
    expect(rankIntervals(items(vals, 2), { draws: 3000, seed: 4 }).get("s0")!.low).toBe(1);
  });
  it("holds a state with no interval fixed and says so", () => {
    const r = rankIntervals([{ id: "a", value: 5, se: null }, { id: "b", value: 5.5, se: 2 }, { id: "c", value: 1, se: 2 }], { draws: 3000, seed: 2 });
    expect(r.get("a")!.hasSe).toBe(false);
    expect(r.get("b")!.hasSe).toBe(true);
    expect(r.get("a")!.high).toBeGreaterThan(r.get("a")!.low); // still moves, because b moves around it
  });
  it("is reproducible and tied to the data", () => {
    const x = items([4, 3, 2, 1], 1);
    expect(rankIntervals(x)).toEqual(rankIntervals(x));
    expect(rankIntervals(x, { seed: 1 }).get("s1")!.distribution).not.toEqual(rankIntervals(x, { seed: 2 }).get("s1")!.distribution);
    expect(rankIntervals(items([1], 1)).size).toBe(0);
  });
  it("writes a range compactly", () => {
    expect(rankRangeText(4, 4)).toBe("4");
    expect(rankRangeText(4, 11)).toBe("4 to 11");
  });
});
