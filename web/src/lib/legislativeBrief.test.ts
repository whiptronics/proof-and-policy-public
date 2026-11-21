import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { legislativeBriefHtml } from "./legislativeBrief";

describe("legislative briefing", () => {
  const html = legislativeBriefHtml();
  it("matches its data (run npm run brief:legislative after a change)", () => {
    const disk = readFileSync(new URL("../../../docs/briefings/utah-grocery-wine/legislative-briefing.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
    expect(disk).toBe(html);
  });
  it("prints no missing values", () => {
    expect(html).not.toMatch(/NaN|undefined|Infinity|\[object/);
  });
  it("names its status and the maintainer's view", () => {
    expect(html).toContain("not attorney-reviewed");
    expect(html).toContain("The maintainer supports grocery wine");
  });
});
