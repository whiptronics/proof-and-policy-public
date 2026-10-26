import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { marginSpreadOf } from "./costEvidence";
import { initiativeById } from "./initiatives";

// The initiative page carries the few base-year dataset values it needs (initiatives.ts `worked.data`), so it runs
// without the metric files. Whenever the exported dataset is present (web/public/data, written by
// `alcohol-data dashboard export`), these must equal what the scenario tool reads from it for the same year.
const DATA = join(__dirname, "..", "..", "public", "data");
const have = existsSync(join(DATA, "metrics"));

function metric(file: string): { year: number; value: number | null }[] {
  const d = JSON.parse(readFileSync(join(DATA, "metrics", `${file}.json`), "utf8"));
  const col = (name: string) => d.columns.indexOf(name);
  return d.rows.filter((r: unknown[]) => r[col("geo_id")] === "state:49").map((r: unknown[]) => ({ year: r[col("year")] as number, value: r[col("value")] as number | null }));
}
const at = (file: string, year: number) => metric(file).find((o) => o.year === year && o.value !== null)?.value;

describe.skipIf(!have)("the initiative's copied values against the exported dataset", () => {
  const ut = initiativeById("ut_grocery_wine")!;
  const d = ut.worked.data;
  const fy = d.fy;

  it("matches DABS's base-year sales, gross profit and expense lines", () => {
    expect(at("ut_dabs_liquor_sales_revenue.state_fiscal_year", fy)).toBe(d.sales);
    expect(at("ut_dabs_gross_profit.state_fiscal_year", fy)).toBe(d.grossProfit);
    expect(at("ut_dabs_credit_card_fees.state_fiscal_year", fy)).toBe(d.expenses.card);
    expect(at("ut_dabs_package_agency_contracts.state_fiscal_year", fy)).toBe(d.expenses.agency);
    expect(at("ut_dabs_liquor_bags.state_fiscal_year", fy)).toBe(d.expenses.bags);
    expect(at("ut_dabs_salaries_wages.state_fiscal_year", fy)).toBe(d.expenses.wages);
    expect(at("ut_dabs_delivery_to_stores.state_fiscal_year", fy)).toBe(d.expenses.delivery);
    expect(at("ut_dabs_operating_nonoperating_expenses.state_fiscal_year", fy)).toBe(d.expenses.total);
  });

  it("matches the margin range and the wine gallons the tool uses", () => {
    const sales = metric("ut_dabs_liquor_sales_revenue.state_fiscal_year");
    const gp = metric("ut_dabs_gross_profit.state_fiscal_year");
    const years = [...new Set([...sales, ...gp].map((o) => o.year))];
    const spread = marginSpreadOf(years.map((year) => ({ year, sales: sales.find((o) => o.year === year)?.value ?? null, gp: gp.find((o) => o.year === year)?.value ?? null })))!;
    expect(spread.low).toBeCloseTo(d.marginRange.low, 12);
    expect(spread.high).toBeCloseTo(d.marginRange.high, 12);
    const gal = metric("niaaa_beverage_gallons_wine.calendar_year").filter((o) => o.value !== null && o.year <= fy);
    const cal = Math.max(...gal.map((o) => o.year));
    expect(cal).toBe(d.wineGallonsYear);
    expect(at("niaaa_beverage_gallons_wine.calendar_year", cal)).toBe(d.wineGallons);
  });

  it("matches the statutory deposit rates and the FY2026 monthly wine share", () => {
    const rec = JSON.parse(readFileSync(join(DATA, "reconciliation.json"), "utf8"));
    const rate = (deposit: string) => rec.deposit_rates.find((r: { deposit: string; fiscal_year_from: number; fiscal_year_to: number | null }) => r.deposit === deposit && r.fiscal_year_from <= fy && (r.fiscal_year_to === null || r.fiscal_year_to >= fy)).rate;
    expect(rate("school_meals")).toBe(ut.worked.rates.school);
    expect(rate("enforcement_fund")).toBe(ut.worked.rates.enforcement);
    const month = (cls: string) => {
      const m = JSON.parse(readFileSync(join(DATA, "monthly", `ut_dabs_monthly_gross_sales_${cls}.json`), "utf8"));
      const c = (name: string) => m.columns.indexOf(name);
      return m.rows.filter((r: unknown[]) => (r[c("period_label")] as string) >= "2025-07" && (r[c("period_label")] as string) <= "2026-06").reduce((s: number, r: unknown[]) => s + (r[c("value")] as number), 0);
    };
    expect(Math.round((month("wine") / month("total")) * 1000) / 10).toBe(33.5);
  });
});
