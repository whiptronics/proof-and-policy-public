import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FLOW_DATA } from "./wineFlows";

// The purchase-flow model carries the dataset values it needs (wineFlows.ts FLOW_DATA). Whenever the exported dataset
// is present (web/public/data, written by `alcohol-data dashboard export`), they must equal it.
const DATA = join(__dirname, "..", "..", "public", "data");
const have = existsSync(join(DATA, "metrics"));

function at(file: string, label: string | number): number | undefined {
  const d = JSON.parse(readFileSync(join(DATA, "metrics", `${file}.json`), "utf8"));
  const col = (name: string) => d.columns.indexOf(name);
  const key = typeof label === "number" ? "year" : "period_label";
  const row = d.rows.find((r: unknown[]) => r[col("geo_id")] === "state:49" && r[col(key)] === label && r[col("value")] !== null);
  return row ? (row[col("value")] as number) : undefined;
}

describe.skipIf(!have)("the purchase-flow model's copied values against the exported dataset", () => {
  const f = FLOW_DATA.dabsFy2026;
  it("matches DABS's FY2026 sales and 9-litre cases by beverage", () => {
    const fy = (m: string) => at(`${m}.state_fiscal_year`, "FY2026");
    expect(fy("ut_dabs_fy_gross_sales_total")).toBeCloseTo(f.salesTotal, 2);
    expect(fy("ut_dabs_fy_gross_sales_wine")).toBeCloseTo(f.salesWine, 2);
    expect(fy("ut_dabs_fy_gross_sales_spirits")).toBeCloseTo(f.salesSpirits, 2);
    expect(fy("ut_dabs_fy_gross_sales_beer")).toBeCloseTo(f.salesHeavyBeer, 2);
    expect(fy("ut_dabs_fy_cases_9l_wine")).toBeCloseTo(f.cases9lWine, 4);
    expect(fy("ut_dabs_fy_cases_9l_spirits")).toBeCloseTo(f.cases9lSpirits, 4);
    expect(fy("ut_dabs_fy_cases_9l_beer")).toBeCloseTo(f.cases9lHeavyBeer, 4);
  });
  it("matches NIAAA's 2024 Utah beer gallons and alcohol by volume", () => {
    const n = FLOW_DATA.niaaa2024;
    expect(at("niaaa_beverage_gallons_beer.calendar_year", 2024)).toBe(n.beerGallons);
    expect(at("niaaa_time_varying_abv_beer.calendar_year", 2024)).toBe(n.abvBeer);
    expect(at("niaaa_time_varying_abv_wine.calendar_year", 2024)).toBe(n.abvWine);
    expect(at("niaaa_time_varying_abv_spirits.calendar_year", 2024)).toBe(n.abvSpirits);
  });
});
