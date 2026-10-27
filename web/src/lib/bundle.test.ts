import { describe, expect, it } from "vitest";
import { readme } from "./bundle";
import { AI_DISCLOSURE } from "./disclosure";
import type { Manifest } from "./types";

const man = {
  schema_version: "dashboard-export@test",
  dataset: { release_label: "test", built_at: "2026-01-01", built_from_commit: "abc", law_as_of_date: "2026-01-01", law_as_of_timezone: "UTC" },
  export: { generated_at: "2026-01-01T00:00:00Z" },
} as unknown as Manifest;

describe("download README", () => {
  it("carries the AI disclosure, without claiming any human review", () => {
    const text = readme(man, "Test download", {});
    expect(text).toContain(AI_DISCLOSURE);
    expect(AI_DISCLOSURE).toContain("no transcribed value or legal coding has yet been checked by a person");
  });
});
