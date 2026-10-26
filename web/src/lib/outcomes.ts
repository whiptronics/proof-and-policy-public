// Plain-language groups of the measures most relevant to the grocery-wine question, used by the guided
// tools so nobody needs a measure id. Every other exported measure stays available under "Other measures".
import type { Shown } from "./series";
import type { MetricMeta } from "./types";

export interface Topic {
  id: string;
  label: string;
  help: string;
  metrics: { id: string; help: string }[];
}

export const TOPICS: Topic[] = [
  {
    id: "revenue",
    label: "Government revenue",
    help: "Money reaching state government. Taxes and state-store receipts are different kinds of money and are never added.",
    metrics: [
      { id: "stc_alcoholic_beverages_sales_tax@state_fiscal_year", help: "All alcohol taxes the state collects (beer, wine, spirits). Excludes state liquor-store profit." },
      { id: "stc_alcoholic_beverages_license_tax@state_fiscal_year", help: "State alcohol license fees and taxes." },
      { id: "census_liquor_stores_revenue@state_fiscal_year", help: "State liquor-store receipts: what a state liquor monopoly (wholesale or retail) took in, FY1972 and FY1977-FY2024. Not profit, and not total alcohol sales." },
      { id: "tn_dor_wine_tax_collections@state_fiscal_year", help: "Tennessee only: wine tax account 11002, through FY2017 (relabelled after)." },
      { id: "tn_dor_wine_enforcement_tax_collections@state_fiscal_year", help: "Tennessee only: wine enforcement tax account 11018." },
    ],
  },
  {
    id: "consumption",
    label: "Purchases and consumption",
    help: "Apparent consumption from sales and shipments (NIAAA): includes visitors and stock changes, not measured drinking.",
    metrics: [
      { id: "niaaa_ethanol_per_capita_21plus_wine@calendar_year", help: "Gallons of pure alcohol from wine per resident 21+." },
      { id: "niaaa_ethanol_per_capita_21plus_all@calendar_year", help: "Gallons of pure alcohol from all drinks per resident 21+." },
      { id: "niaaa_ethanol_per_capita_21plus_beer@calendar_year", help: "Gallons of pure alcohol from beer per resident 21+." },
      { id: "niaaa_ethanol_per_capita_21plus_spirits@calendar_year", help: "Gallons of pure alcohol from spirits per resident 21+." },
      { id: "niaaa_beverage_gallons_wine@calendar_year", help: "Gallons of wine (beverage volume), whole state." },
      { id: "bea_pce_off_premises_alcohol@calendar_year", help: "Residents' spending on alcohol bought to take home, from any kind of store (BEA). Not tax revenue." },
    ],
  },
  {
    id: "drinking",
    label: "Drinking (surveys)",
    help: "Shares of people who report drinking, with confidence intervals. Not amounts drunk.",
    metrics: [
      { id: "brfss_drank_any_past_30d_pct@survey_year", help: "Adults 18+ who drank in the past 30 days (BRFSS)." },
      { id: "brfss_binge_5m_4f_pct@survey_year", help: "Adults who binge drank (5+ drinks men, 4+ women) (BRFSS)." },
      { id: "brfss_binge_age_adjusted_pct@survey_year", help: "The same binge measure, age-adjusted by CDC so older and younger states compare fairly (2019 on)." },
      { id: "brfss_heavy_14m_7f_per_week_pct@survey_year", help: "Adults drinking heavily (BRFSS, from 2015)." },
      { id: "yrbs_current_alcohol_use_hs_pct@survey_year", help: "High school students who drank in the past 30 days (YRBS, odd years: to 2017 from CDC's YRBS files, 2019-2023 from CDC's Chronic Disease Indicators; the line breaks where the source changes)." },
    ],
  },
  {
    id: "safety",
    label: "Traffic safety",
    help: "Deaths counted where the crash happened (FARS). The per-100,000 rates divide by the state's residents, though visitors die in crashes too.",
    metrics: [
      { id: "fars_alcohol_impaired_driving_fatalities@calendar_year", help: "Deaths in crashes with a driver at .08 BAC or more (NHTSA's imputation)." },
      { id: "fars_alcohol_impaired_driving_deaths_per_100k@calendar_year", help: "The same deaths per 100,000 residents (Census July 1 population)." },
      { id: "fars_traffic_fatalities@calendar_year", help: "All traffic deaths." },
      { id: "fars_traffic_deaths_per_100k@calendar_year", help: "All traffic deaths per 100,000 residents." },
    ],
  },
  {
    id: "health",
    label: "Health",
    help: "Deaths from causes tied to long-term drinking, by where the person lived (CDC). Years of drinking lie behind each death, so a change soon after a law is not expected here.",
    metrics: [
      { id: "cdi_chronic_liver_disease_mortality_age_adjusted_rate@calendar_year", help: "Chronic liver disease deaths per 100,000 residents, age-adjusted (CDC Chronic Disease Indicators, 2019-2022)." },
    ],
  },
  {
    id: "context",
    label: "Context",
    help: "Characteristics that differ between states for reasons unrelated to alcohol law.",
    metrics: [
      { id: "bea_per_capita_personal_income@calendar_year", help: "Per capita personal income, current dollars (BEA)." },
      { id: "pop_total_resident@point_in_time", help: "Resident population on July 1 (Census)." },
      { id: "cbp_establishments_naics_445310@calendar_year", help: "Private beer, wine and liquor stores (CBP); state-run stores not counted." },
      { id: "cbp_establishments_naics_445110@calendar_year", help: "Supermarkets and other grocery stores (CBP)." },
    ],
  },
];

export const METRIC_HELP: Record<string, string> = Object.fromEntries(TOPICS.flatMap((t) => t.metrics.map((m) => [m.id, m.help])));

export const SHOWN_LABELS: Record<Shown, string> = {
  nominal: "As published",
  real_cy2024: "Constant 2024 dollars",
  per_resident: "Per resident",
  per_resident_21plus: "Per resident 21+",
  index: "Index",
};

export const SHOWN_HELP: Record<Shown, string> = {
  nominal: "The value in the source's own unit.",
  real_cy2024: "Dollars adjusted for inflation (CPI-U) to 2024 prices.",
  per_resident: "Divided by the Census July 1 population.",
  per_resident_21plus: "Divided by the Census July 1 population aged 21 and over.",
  index: "Each value relative to a base year (= 100).",
};

/** The value formats a measure offers, and why the others are not offered. */
export function formatsFor(m: MetricMeta): { shown: Shown; available: boolean; why: string | null }[] {
  return (["nominal", "real_cy2024", "per_resident", "per_resident_21plus"] as Shown[]).map((s) => ({
    shown: s,
    available: s === "nominal" || m.conversions.includes(s as never),
    why: s === "nominal" || m.conversions.includes(s as never) ? null : (m.conversions_unavailable_reason ?? "No conversion for this measure."),
  }));
}

/** Measures grouped for a select box: the topics first, then everything else by family. */
export function groupedMetrics(all: MetricMeta[], families: Record<string, { label: string }>): { label: string; metrics: MetricMeta[] }[] {
  const byId = new Map(all.map((m) => [m.metric_id, m]));
  const listed = new Set(TOPICS.flatMap((t) => t.metrics.map((m) => m.id)));
  const groups = TOPICS.map((t) => ({ label: t.label, metrics: t.metrics.map((m) => byId.get(m.id)).filter((m): m is MetricMeta => m !== undefined) }));
  for (const f of Object.keys(families)) {
    const rest = all.filter((m) => m.family === f && !listed.has(m.metric_id)).sort((a, b) => a.label.localeCompare(b.label));
    if (rest.length) groups.push({ label: `Other measures: ${families[f].label}`, metrics: rest });
  }
  return groups.filter((g) => g.metrics.length);
}

export const PERIOD_SHORT: Record<string, string> = {
  point_in_time: "single date",
  calendar_year: "calendar year",
  state_fiscal_year: "state fiscal year",
  survey_year: "survey year",
  month: "month",
  pooled_years: "pooled years",
};
