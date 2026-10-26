import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TN_2016_RESULTS, computeCaseResults, metricsNeeded, summarize, type CaseResults } from "./caseResults";

// The Tennessee 2016 comparison planned in docs/analyses/tn-2016-grocery-wine/specification.md, run on the exported
// dataset (web/public/data, written by `alcohol-data dashboard export`). These pin the figures quoted in results.md and
// the statements the results section makes, so a new export that changes them fails here until both are updated.
const DATA = join(__dirname, "..", "..", "public", "data");
const have = existsSync(join(DATA, "metrics"));

function run(): CaseResults {
  const idx = JSON.parse(readFileSync(join(DATA, "metrics.json"), "utf8"));
  const geos = JSON.parse(readFileSync(join(DATA, "geographies.json"), "utf8")) as { geo_id: string; geo_level: string; name: string }[];
  const files = new Map();
  for (const id of metricsNeeded(TN_2016_RESULTS)) {
    const meta = idx.metrics.find((m: { metric_id: string }) => m.metric_id === id);
    if (meta) files.set(id, JSON.parse(readFileSync(join(DATA, meta.file), "utf8")));
  }
  const states = geos.filter((g) => g.geo_level === "state").map((g) => g.geo_id);
  return computeCaseResults(TN_2016_RESULTS, { idx, files, states, name: (g) => geos.find((x) => x.geo_id === g)?.name ?? g });
}

describe.skipIf(!have)("the Tennessee 2016 planned comparison on the exported dataset", () => {
  // The describe callback runs during collection even when skipped, so read the files only when they exist.
  const res = have ? run() : ({} as CaseResults);
  const main = (id: string) => res.main.find((r) => r.outcome.id === id)!;
  const sum = (id: string) => summarize(main(id));

  it("uses the planned windows, pools and finder pool", () => {
    expect(res.pools.P1).toEqual(TN_2016_RESULTS.borders);
    expect(res.pools.P4).toEqual(["state:01", "state:21", "state:28", "state:29"]);
    expect(sum("B1").beforeYears).toEqual([2011, 2012, 2013, 2014, 2015]);
    expect(sum("B1").afterYears).toEqual([2017, 2018, 2019]);
    expect(main("B1").result!.transitionYear).toBe(2016);
    // Alabama's FY2016 straddles the date, so FY2016 is dropped for every state under the common-years rule.
    expect(sum("R1").beforeYears).toEqual([2012, 2013, 2014, 2015]);
    expect(sum("R1").afterYears).toEqual([2017, 2018, 2019]);
    expect(sum("R2").afterYears).toEqual([2017]);
    for (const r of res.main.filter((x) => !x.outcome.treatedOnly)) expect(r.result!.states.every((s) => s.included)).toBe(true);
  });

  it("gives the main figures quoted in results.md", () => {
    expect(sum("B1").tnChange!).toBeCloseTo(0.074273, 5);
    expect(sum("B1").diffChange!).toBeCloseTo(0.051718, 5);
    expect(sum("B1").diffLog!).toBeCloseTo(16.28, 2);
    expect(sum("B2").tnChange!).toBeCloseTo(-0.0983, 5);
    expect(sum("B2").diffChange!).toBeCloseTo(-0.008587, 5);
    expect(sum("B2").diffLog!).toBeCloseTo(-1.13, 2);
    expect(sum("B3").diffChange!).toBeCloseTo(0.060754, 5);
    expect(sum("B3").diffLog!).toBeCloseTo(6.65, 2);
    expect(sum("B4").tnChange!).toBeCloseTo(0.126407, 5);
    expect(sum("B4").diffChange!).toBeCloseTo(0.103863, 5);
    expect(sum("B4").diffLog!).toBeCloseTo(4.47, 2);
    expect(sum("R1").tnPct!).toBeCloseTo(31.56, 2);
    expect(sum("R1").diffLog!).toBeCloseTo(22.65, 2);
    expect(main("R1").result!.states[0].slope!).toBeCloseTo(9_244_976, -1);
    expect(sum("R2").tnBefore!).toBeCloseTo(16_914_751, -1);
    expect(sum("R2").tnAfter!).toBeCloseTo(22_096_998, -1);
    expect(sum("R3").tnPct!).toBeCloseTo(24.36, 2);
  });

  it("supports the section's statements about ranges and placebo dates", () => {
    // Wine: outside every neighbour's change; no earlier placebo date as large (share counts the real one).
    expect(sum("B1").spread!.targetInside).toBe(false);
    expect(main("B1").placebo!.pooled!.n).toBe(17);
    expect(main("B1").placebo!.pooled!.share!).toBeCloseTo(1 / 18, 12);
    // Beer: inside the neighbours' range, and smaller than the typical placebo gap.
    expect(sum("B2").spread!.targetInside).toBe(true);
    expect(Math.abs(sum("B2").diffChange!)).toBeLessThan(main("B2").placebo!.pooled!.typical!);
    // Total ethanol: about wine plus spirits, and a gap that earlier dates often match.
    expect(sum("B4").diffChange!).toBeCloseTo(sum("B1").diffChange! + sum("B2").diffChange! + sum("B3").diffChange!, 2);
    expect(main("B4").placebo!.pooled!.share!).toBeCloseTo(6 / 18, 12);
  });

  it("keeps the sensitivity ranges results.md reports", () => {
    const logs = (id: string) => [summarize(main(id)).diffLog!, ...res.sensitivity.flatMap((v) => v.runs.filter((r) => r.outcome.id === id).map((r) => summarize(r).diffLog!))];
    for (const v of logs("B1")) expect(v > 16 && v < 19).toBe(true);
    for (const v of logs("B2")) expect(v > -2.5 && v < 2).toBe(true);
    for (const v of logs("B4")) expect(v > 2 && v < 8).toBe(true);
    for (const v of logs("R1")) expect(v > 19 && v < 32).toBe(true);
  });
});
