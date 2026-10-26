import { describe, expect, it } from "vitest";
import { metricSourceIds, monthlySourceIds, sourceLine, sourcesById } from "./sources";
import type { MetricMeta, MonthlyMeta, SourcesData } from "./types";

const meta = (id: string, assets: string[], inputs: string[] = [], conversions: string[] = [], family = "x") =>
  ({ metric_id: id, asset_ids: assets, input_metrics: inputs, conversions, method_family: family }) as unknown as MetricMeta;
const src = (id: string) => ({ source_id: id, publisher: id.toUpperCase(), title: `${id} title`, landing_url: `https://example.org/${id}` });
const SOURCES = {
  sources: ["census_stc", "census_pep", "bls_cpi", "nhtsa_fars", "project_derivations", "utah_dabs_sales_analysis"].map(src),
  assets: [
    { asset_id: "stc_db", source_id: "census_stc" },
    { asset_id: "pep_2020", source_id: "census_pep" },
    { asset_id: "cpi", source_id: "bls_cpi" },
    { asset_id: "fars_2023", source_id: "nhtsa_fars" },
    { asset_id: "project_derivations", source_id: "project_derivations" },
    { asset_id: "dabs_p01", source_id: "utah_dabs_sales_analysis" },
  ],
  leads: [],
  release: null,
} as unknown as SourcesData;
const CONV = ["deflators", "pop_age21plus_resident@point_in_time", "pop_total_resident@point_in_time"];
const METRICS = [
  meta("stc@fy", ["stc_db"], CONV, ["per_resident", "per_resident_21plus", "real_cy2024"]),
  meta("pop_total_resident@point_in_time", ["pep_2020"]),
  meta("pop_age21plus_resident@point_in_time", ["pep_2020"]),
  meta("fars@cy", ["fars_2023"]),
  meta("fars_rate@cy", ["project_derivations"], ["fars@cy", "pop_total_resident@point_in_time"], [], "derived"),
  meta("dabs_fy@fy", ["project_derivations"], ["monthly:dabs_wine", ...CONV], ["per_resident"], "derived"),
];
const MONTHLY = [{ measure_id: "dabs_wine", asset_ids: ["dabs_p01"] }] as unknown as MonthlyMeta[];
const L = { metrics: METRICS, monthly: MONTHLY, sources: SOURCES };
const of = (id: string) => METRICS.find((m) => m.metric_id === id)!;

describe("which sources a chart names", () => {
  it("names a measure's own publisher, and the divisor only in the form that divides by it", () => {
    expect(metricSourceIds(of("stc@fy"), "nominal", L)).toEqual(["census_stc"]);
    expect(metricSourceIds(of("stc@fy"), "per_resident_21plus", L)).toEqual(["census_stc", "census_pep"]);
    expect(metricSourceIds(of("stc@fy"), "real_cy2024", L)).toEqual(["census_stc", "bls_cpi"]);
  });
  it("follows a derived value back to its publishers and never names the project as a source", () => {
    expect(metricSourceIds(of("fars_rate@cy"), "nominal", L)).toEqual(["nhtsa_fars", "census_pep"]);
    expect(metricSourceIds(of("dabs_fy@fy"), "nominal", L)).toEqual(["utah_dabs_sales_analysis"]);
    expect(monthlySourceIds(MONTHLY[0], L)).toEqual(["utah_dabs_sales_analysis"]);
  });
  it("writes one plain line for downloads and images", () => {
    expect(sourceLine(sourcesById(["nhtsa_fars", "census_pep"], SOURCES), true)).toBe(
      "Sources: NHTSA_FARS, nhtsa_fars title; CENSUS_PEP, census_pep title. Computed by this project from those sources.",
    );
    expect(sourceLine([], false)).toBe("");
  });
});
