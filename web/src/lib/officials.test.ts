import { describe, expect, it } from "vitest";
import {
  coverRole,
  filterRecords,
  govOf,
  isRealDate,
  membershipsByPerson,
  nameMatches,
  options,
  termText,
  type Committee,
  type Filters,
  type OfficialRecord,
} from "./officials";

const F: Filters = { svc: "current", chamber: "", gov: "", district: "", committee: "", q: "", day: "", unclear: false };

const rec = (id: string, name: string, status: OfficialRecord["status"], roles: OfficialRecord["roles"], aka?: string[]): OfficialRecord => ({
  id: `ocd-person/${id}`,
  name,
  aka,
  group: status === "former_in_source" ? "retired" : "legislature",
  status,
  roles,
});

const R = [
  // current senator: term ends after the snapshot
  rec("a", "Ana Álvarez", "current_in_source", [{ type: "upper", scope: "state", district: "7", start: "2021-01-04", end: "2029-01-01" }], ["A. Alvarez"]),
  // current representative: open role with no end date, plus an earlier closed role
  rec("b", "Bo Brandt Jr.", "current_in_source", [
    { type: "lower", scope: "state", district: "52", start: "2023-01-01" },
    { type: "lower", scope: "state", district: "6", end: "2023-01-01" },
  ]),
  // filed with current officials but every role ended
  rec("c", "Cy Cole", "ended_in_current_files", [{ type: "mayor", scope: "place", place: "ogden", end: "2020-01-06" }]),
  // former senator, with dates
  rec("d", "Dee Dunn", "former_in_source", [{ type: "upper", scope: "state", district: "10", start: "2011-01-01", end: "2016-12-31" }]),
  // former, no start date recorded
  rec("e", "Eli Eck", "former_in_source", [{ type: "upper", scope: "state", district: "10", end: "2010-12-31" }]),
  // former, no end date recorded: a missing end date proves nothing
  rec("f", "Flo Fox", "former_in_source", [{ type: "lower", scope: "state", district: "3", start: "2005-01-01" }]),
];

describe("what a role's dates support on a given day", () => {
  it("is yes inside a fully dated role, inclusive of both ends", () => {
    const r = { start: "2021-01-04", end: "2029-01-01" };
    expect(coverRole(r, "2025-06-01", true)).toBe("yes");
    expect(coverRole(r, "2021-01-04", false)).toBe("yes");
    expect(coverRole(r, "2029-01-01", false)).toBe("yes");
  });
  it("is no before the start and after the end", () => {
    const r = { start: "2021-01-04", end: "2029-01-01" };
    expect(coverRole(r, "2021-01-03", true)).toBe("no");
    expect(coverRole(r, "2029-01-02", true)).toBe("no");
  });
  it("counts a missing end date as ongoing only for a record that is current in the source", () => {
    expect(coverRole({ start: "2023-01-01" }, "2025-01-01", true)).toBe("yes");
    expect(coverRole({ start: "2005-01-01" }, "2010-01-01", false)).toBe("unknown");
  });
  it("cannot say when the start is missing, but can rule out days after the end", () => {
    expect(coverRole({ end: "2010-12-31" }, "2009-06-01", false)).toBe("unknown");
    expect(coverRole({ end: "2010-12-31" }, "2011-01-01", false)).toBe("no");
    expect(coverRole({}, "2015-01-01", true)).toBe("unknown");
  });
  it("cannot say when the source's own dates contradict each other", () => {
    expect(coverRole({ start: "2023-01-17", end: "2017-01-21" }, "2020-01-01", false)).toBe("unknown");
  });
  it("matches the Python importer on the same cases", () => {
    // tests/test_officials.py::test_role_covers_cases uses these exact rows.
    const cases: [string | undefined, string | undefined, string, boolean, string][] = [
      ["2021-01-04", "2029-01-01", "2025-06-01", true, "yes"],
      ["2021-01-04", "2029-01-01", "2021-01-03", true, "no"],
      ["2023-01-01", undefined, "2025-01-01", true, "yes"],
      ["2005-01-01", undefined, "2010-01-01", false, "unknown"],
      [undefined, "2010-12-31", "2009-06-01", false, "unknown"],
      [undefined, "2010-12-31", "2011-01-01", false, "no"],
      [undefined, undefined, "2015-01-01", true, "unknown"],
      ["2023-01-17", "2017-01-21", "2020-01-01", false, "unknown"],
    ];
    for (const [start, end, day, cur, want] of cases) expect(coverRole({ start, end }, day, cur)).toBe(want);
  });
});

describe("dates", () => {
  it("accepts real calendar days only", () => {
    expect(isRealDate("2024-02-29")).toBe(true);
    expect(isRealDate("2023-02-29")).toBe(false);
    expect(isRealDate("2023-13-01")).toBe(false);
    expect(isRealDate("2023-1-1")).toBe(false);
    expect(isRealDate(null)).toBe(false);
  });
  it("words the term the way the source supports it", () => {
    expect(termText({ type: "upper", scope: "state", start: "2021-01-04", end: "2029-01-01" })).toBe("2021-01-04 to 2029-01-01");
    expect(termText({ type: "lower", scope: "state", start: "2023-01-01" })).toBe("from 2023-01-01; no end date recorded");
    expect(termText({ type: "upper", scope: "state", end: "2010-12-31" })).toBe("start not recorded; to 2010-12-31");
    expect(termText({ type: "upper", scope: "state" })).toBe("no dates recorded");
    expect(termText({ type: "upper", scope: "state", start: "2023-01-17", end: "2017-01-21", conflict: true })).toContain("contradict");
  });
});

describe("current versus former display", () => {
  it("shows only records that are current in the source by default", () => {
    expect(filterRecords(R, [], F).map((h) => h.rec.name)).toEqual(["Ana Álvarez", "Bo Brandt Jr."]);
  });
  it("shows former and ended records together, never mixed into the current list", () => {
    const names = filterRecords(R, [], { ...F, svc: "former" }).map((h) => h.rec.name);
    expect(names).toEqual(["Cy Cole", "Dee Dunn", "Eli Eck", "Flo Fox"]);
    expect(names).not.toContain("Ana Álvarez");
  });
  it("all puts current records first", () => {
    const names = filterRecords(R, [], { ...F, svc: "all" }).map((h) => h.rec.status);
    expect(names.slice(0, 2)).toEqual(["current_in_source", "current_in_source"]);
    expect(names.slice(-3)).toEqual(["former_in_source", "former_in_source", "former_in_source"]);
  });
});

describe("historical date filter", () => {
  const on = (day: string, extra: Partial<Filters> = {}) =>
    filterRecords(R, [], { ...F, svc: "all", day, ...extra }).map((h) => h.rec.name);
  it("lists only records whose recorded dates support the day", () => {
    expect(on("2013-05-01")).toEqual(["Dee Dunn"]);
    expect(on("2025-05-01")).toEqual(["Ana Álvarez", "Bo Brandt Jr."]);
  });
  it("keeps records with unclear dates out unless asked, and then says which roles are unclear", () => {
    expect(on("2009-01-01")).toEqual([]);
    const hits = filterRecords(R, [], { ...F, svc: "all", day: "2009-01-01", unclear: true });
    expect(hits.map((h) => h.rec.name)).toEqual(["Bo Brandt Jr.", "Cy Cole", "Eli Eck", "Flo Fox"]);
    expect(hits.every((h) => h.roles.every((r) => r.cover === "unknown"))).toBe(true);
  });
  it("does not treat a former record's missing end date as service", () => {
    expect(on("2015-06-01")).toEqual(["Dee Dunn"]); // Flo Fox has start 2005, no end: unknown, not yes
  });
  it("matches the role that covers the day, not just any role", () => {
    const hits = filterRecords(R, [], { ...F, svc: "all", day: "2022-06-01", district: "6" });
    expect(hits.map((h) => h.rec.name)).toEqual([]); // Bo's district-6 role has no start date: unclear
    const unclear = filterRecords(R, [], { ...F, svc: "all", day: "2022-06-01", district: "6", unclear: true });
    expect(unclear.map((h) => h.rec.name)).toEqual(["Bo Brandt Jr."]);
  });
});

describe("chamber, government, district and name filters", () => {
  it("filter by role", () => {
    expect(filterRecords(R, [], { ...F, svc: "all", chamber: "upper" }).map((h) => h.rec.name)).toEqual(["Ana Álvarez", "Dee Dunn", "Eli Eck"]);
    expect(filterRecords(R, [], { ...F, svc: "all", gov: "place:ogden" }).map((h) => h.rec.name)).toEqual(["Cy Cole"]);
    expect(filterRecords(R, [], { ...F, svc: "all", chamber: "upper", district: "10" }).map((h) => h.rec.name)).toEqual(["Dee Dunn", "Eli Eck"]);
    expect(govOf(R[2].roles[0])).toBe("place:ogden");
  });
  it("offers districts that exist for the chosen chamber only", () => {
    expect(options(R, { chamber: "upper", gov: "" }).districts).toEqual(["7", "10"]);
    expect(options(R, { chamber: "lower", gov: "" }).districts).toEqual(["3", "6", "52"]);
  });
  it("searches names ignoring accents and case, including other names, and never merges by name", () => {
    expect(nameMatches(R[0], "alvarez")).toBe(true);
    expect(nameMatches(R[0], "a. alvarez")).toBe(true);
    expect(nameMatches(R[0], "ocd-person/a")).toBe(true);
    expect(nameMatches(R[0], "brandt")).toBe(false);
    const twins = [rec("x1", "Sam Lee", "current_in_source", [{ type: "upper", scope: "state" }]), rec("x2", "Sam Lee", "current_in_source", [{ type: "lower", scope: "state" }])];
    expect(filterRecords(twins, [], { ...F, q: "sam lee" })).toHaveLength(2); // two ids, two records
  });
});

describe("committee relationships", () => {
  const C: Committee[] = [
    {
      id: "ocd-organization/1",
      name: "Revenue and Taxation",
      chamber: "upper",
      class: "committee",
      scope: "state",
      members: [
        { pid: "ocd-person/a", role: "chair" },
        { pid: "ocd-person/d", role: "member", former: true },
        { pid: "ocd-person/zz", role: "member", unresolved: true, name: "Gary Daniels" },
      ],
    },
  ];
  it("filters to a committee's members and carries the role", () => {
    const hits = filterRecords(R, C, { ...F, svc: "all", committee: "ocd-organization/1" });
    expect(hits.map((h) => [h.rec.name, h.committeeRole])).toEqual([
      ["Ana Álvarez", "chair"],
      ["Dee Dunn", "member"],
    ]);
  });
  it("leaves an unresolved member unmatched instead of guessing a record by name", () => {
    const hits = filterRecords(R, C, { ...F, svc: "all", committee: "ocd-organization/1", q: "daniels" });
    expect(hits).toEqual([]);
    expect(membershipsByPerson(C).has("ocd-person/zz")).toBe(true); // kept by id, with no record to attach to
  });
});
