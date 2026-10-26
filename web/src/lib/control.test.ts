import { describe, expect, it } from "vitest";
import { CONTROL_DIMS, assess, criterionById, dimStatus, tally, verdictText, type Criterion } from "./control";
import type { Segment, Snapshot } from "./types";

const seg = (geo: string, dim: string, start: string, end: string, state: string): Segment => ({
  geo_id: geo,
  policy_dimension: dim,
  segment_start: start,
  segment_end: end,
  days: 0,
  state,
  policy_ids: `${geo}_${dim}`,
  derivation_version: "t",
});
const snap = (geo: string, dim: string, value: string, day: string): Snapshot =>
  ({ snapshot_id: `${geo}_${dim}_${day}`, geo_id: geo, policy_dimension: dim, policy_value: value, observed_on: day, observed_year: Number(day.slice(0, 4)) }) as Snapshot;

const SR = "spirits_off_premise_retail_system";
const SW = "spirits_wholesale_system";
const UT = "state:49";
const ASOF = "2026-10-06";
const SEGS: Segment[] = [
  seg(UT, SW, "2003-05-05", "2026-10-06", "state_operated"),
  seg(UT, SR, "2011-07-01", "2026-10-06", "state_stores_and_contract_agencies"),
  seg("state:A", SW, "2000-01-01", "2026-10-06", "state_operated"),
  seg("state:A", SR, "2000-01-01", "2026-10-06", "state_stores_and_contract_agencies"),
  seg("state:B", SR, "2000-01-01", "2026-10-06", "private_licensed"),
  seg("state:C", SR, "2000-01-01", "2016-06-30", "state_operated_stores"),
  seg("state:C", SR, "2016-07-01", "2026-10-06", "private_licensed"),
  seg("state:D", SR, "2018-01-01", "2026-10-06", "state_operated_stores"),
];
const SNAPS: Snapshot[] = [snap("state:E", SR, "state_stores_and_contract_agencies", "2026-10-08"), snap("state:E", SW, "state_operated", "2026-10-08")];
const label = (d: string) => CONTROL_DIMS.find((x) => x.dim === d)!.short;
const statuses = (geo: string, from: string, to: string) => CONTROL_DIMS.map((d) => dimStatus(SEGS, SNAPS, geo, d.dim, from, to, ASOF));
const run = (c: Criterion, geo: string, from = "2015-01-01", to = "2019-12-31") => assess(c, statuses(geo, from, to), statuses(UT, from, to), label);

describe("a value counts only when verified on every day of the period", () => {
  it("reads a dimension over exact dates", () => {
    const st = dimStatus(SEGS, [], UT, SR, "2011-01-01", "2011-12-31", ASOF);
    expect(st.value).toBeNull(); // verified from 2011-07-01 only
    expect(st.knownDays).toBe(184);
    expect(dimStatus(SEGS, [], UT, SR, "2012-01-01", "2012-12-31", ASOF).value).toBe("state_stores_and_contract_agencies");
    expect(dimStatus(SEGS, [], UT, SR, "2026-01-01", "2026-12-31", ASOF).value).toBeNull(); // days after the as-of date
    // Built runs stop at the as-of date; a run recorded past it still cannot verify the later days.
    const past = [seg("state:F", SR, "2000-01-01", "2030-12-31", "private_licensed")];
    expect(dimStatus(past, [], "state:F", SR, "2026-01-01", "2026-12-31", ASOF).value).toBeNull();
    expect(dimStatus(past, [], "state:F", SR, "2026-01-01", "2026-12-31", ASOF).knownDays).toBe(279); // 1 January to 6 October
  });
});

describe("criteria", () => {
  const same = criterionById("same_as_target")!;
  const spiritsGov = criterionById("spirits_retail_government")!;
  const stores = criterionById("spirits_retail_state_stores")!;
  it("matches, differs, or cannot be assessed", () => {
    const sameAsUtah: Criterion = { ...same, rules: same.rules.filter((r) => [SW, SR].includes(r.dim)) };
    expect(run(sameAsUtah, "state:A").verdict).toBe("yes");
    expect(run(spiritsGov, "state:B").verdict).toBe("no");
    expect(run(stores, "state:A").verdict).toBe("yes");
  });
  it("never treats a change inside the period, partial coverage or a missing history as a match or a mismatch", () => {
    const c = run(spiritsGov, "state:C");
    expect(c.verdict).toBe("unknown");
    expect(c.reasons[0]).toMatch(/changed during the period/);
    expect(run(spiritsGov, "state:D").verdict).toBe("unknown"); // verified from 2018 only
    expect(run(spiritsGov, "state:D", "2019-01-01", "2023-12-31").verdict).toBe("yes");
  });
  it("cannot compare with the chosen state where its own arrangement is unverified", () => {
    const a = run(same, "state:A", "2005-01-01", "2009-12-31"); // Utah's retail arrangement is verified from 2011-07-01 only
    expect(a.verdict).toBe("unknown");
    expect(a.reasons.some((r) => /chosen state's arrangement is not verified/.test(r))).toBe(true);
  });
  it("reports current law beside the verdict but never lets it decide", () => {
    const e = run(criterionById("spirits_wholesale_state")!, "state:E");
    expect(e.verdict).toBe("unknown");
    expect(e.currentLaw).toEqual({ verdict: "yes", date: "2026-10-08" });
    expect(verdictText(e)).toBe("cannot be assessed (current law matches, dated 2026-10-08; history not verified)");
    expect(tally([e, run(spiritsGov, "state:B")])).toEqual({ yes: 0, no: 1, unknown: 1, unknownCurrentYes: 1 });
  });
});
