import { describe, expect, it } from "vitest";
import { writeStored } from "./analysis";
import { SAVED_FORMAT, cleanParams, parseRecordFile, readSaved, recordFile, restoreSearch, writeSaved, type SavedRecord } from "./saved";

const store = () => {
  const mem = new Map<string, string>();
  return { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), mem };
};
const REC: SavedRecord = {
  format: SAVED_FORMAT,
  name: "TN 2016",
  saved_at: "2026-10-09T10:00:00Z",
  view: "change",
  params: "d=2016-07-01&t=state%3A47&v=change",
  build_id: "preview-abc",
  release: "0.2.0-preview (preview-abc)",
  method: "before-after@1.0",
};

describe("saved analyses keep the build and method", () => {
  it("restores the inputs and names the build and method they were saved with", () => {
    expect(restoreSearch(REC)).toBe("?d=2016-07-01&t=state%3A47&v=change&sb=preview-abc&sm=before-after%401.0");
    // Saving again from a restored page does not pile up old build markers or an open record.
    expect(cleanParams("?v=change&t=state%3A47&sb=old&sm=x&rec=obs%3Aa&a=case%3A1")).toBe("v=change&t=state%3A47");
  });
  it("stores records without their result snapshots, and reads old Explore entries too", () => {
    const s = store();
    expect(writeSaved(s, [{ ...REC, results: { big: true } }])).toBe(true);
    writeStored(s, [{ name: "old", saved_at: "2026-10-01", analysis: { metrics: ["m@x"], geos: ["state:49"], from: 2000, to: 2010, shown: "nominal", base: null, policy: null } }]);
    const all = readSaved(s);
    expect(all).toHaveLength(2);
    expect(all[0]).toEqual(REC);
    expect(all[1]).toMatchObject({ name: "old", view: "explore", build_id: "", params: "g=state%3A49&m=m%40x&pd=none&v=explore&y0=2000&y1=2010" });
  });
  it("survives blocked or corrupt storage", () => {
    const s = store();
    s.mem.set("alcohol-dashboard.saved.v2", "{oops");
    expect(readSaved(s)).toEqual([]);
    expect(readSaved(null)).toEqual([]);
    expect(writeSaved({ setItem: () => { throw new Error("full"); } }, [REC])).toBe(false);
  });
});

describe("analysis files", () => {
  it("round-trips a record with its results", () => {
    const withResults = { ...REC, results: { kind: "observations", states: [1, 2] } };
    expect(parseRecordFile(recordFile(withResults), ["change"])).toEqual(withResults);
  });
  it("refuses a tool this dashboard does not have, and anything else", () => {
    expect(() => parseRecordFile(recordFile({ ...REC, view: "forecast" }), ["change"])).toThrow(/does not have \(forecast\)/);
    expect(() => parseRecordFile("[]", ["change"])).toThrow(/not a saved analysis/);
    expect(() => parseRecordFile("nope", ["change"])).toThrow(/not JSON/);
  });
  it("opens an Explore file from the earlier format", () => {
    const v1 = JSON.stringify({ format: "alcohol-dashboard-analysis@1", title: "Old", release: "r", analysis: { metrics: ["m@x"], geos: ["state:49"], from: 2000, to: 2010, shown: "index", base: 2005, policy: "p" } });
    expect(parseRecordFile(v1, ["explore"])).toMatchObject({ view: "explore", name: "Old", params: "base=2005&g=state%3A49&m=m%40x&pd=p&tf=index&v=explore&y0=2000&y1=2010" });
  });
});
