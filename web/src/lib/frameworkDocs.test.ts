import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { frameworkDocs } from "./frameworkDocs";

describe("generated policy documents", () => {
  for (const [path, text] of Object.entries(frameworkDocs())) {
    it(`${path} matches its data (run npm run docs:framework after a change)`, () => {
      const disk = readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
      expect(disk).toBe(text);
    });
  }
});
