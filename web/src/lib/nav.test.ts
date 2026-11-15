import { describe, expect, it } from "vitest";
import { DESCRIPTIONS, NAV_GROUPS, TITLES, groupOf } from "./nav";
import { VIEWS } from "./url";

describe("navigation", () => {
  const listed = NAV_GROUPS.flatMap((g) => g.views.map(([v]) => v));

  it("lists every view exactly once", () => {
    expect([...listed].sort()).toEqual([...VIEWS].sort());
  });

  it("gives every view a title and a description of search-result length", () => {
    for (const v of VIEWS) {
      expect(TITLES[v]).toBeTruthy();
      expect(DESCRIPTIONS[v].length).toBeGreaterThan(40);
      expect(DESCRIPTIONS[v].length).toBeLessThanOrEqual(200);
      expect(groupOf(v).views.some(([x]) => x === v)).toBe(true);
    }
  });
});
