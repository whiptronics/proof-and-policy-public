// Measures offered on the nationwide map, in plain language. Each points at exported data only: an annual
// metric (metrics.json) or a monthly series (monthly.json). Normalizations are offered only where the
// dataset has them (the metric's own conversions), and a caution travels with measures that are easy to
// misread.
export interface MapVariant {
  key: string;
  label: string;
  metric: string;
}

export interface MapMeasure {
  id: string;
  topic: string;
  label: string;
  help: string;
  caution?: string;
  metric?: string;
  variants?: MapVariant[];
  monthly?: string;
  /** Published values are changes (centred on zero). */
  diverging?: boolean;
  defaultShown?: "nominal" | "per_resident" | "per_resident_21plus" | "real_cy2024";
}

export const MAP_TOPICS: Record<string, string> = {
  consumption: "Purchases and consumption",
  revenue: "Government revenue",
  retail: "Retail sales",
  drinking: "Drinking (surveys)",
  health: "Health",
  safety: "Traffic safety",
  context: "Context",
};

const NIAAA = (b: string) => `niaaa_ethanol_per_capita_21plus_${b}@calendar_year`;

export const MAP_MEASURES: MapMeasure[] = [
  {
    id: "alcohol_per_adult",
    topic: "consumption",
    label: "Pure alcohol sold per resident 21+ (apparent consumption)",
    help: "NIAAA: gallons of pure alcohol from sales and shipments, divided by residents aged 21 and over. Counts what visitors buy and stock changes; it is not measured drinking.",
    variants: [
      { key: "all", label: "All drinks", metric: NIAAA("all") },
      { key: "beer", label: "Beer", metric: NIAAA("beer") },
      { key: "wine", label: "Wine", metric: NIAAA("wine") },
      { key: "spirits", label: "Spirits", metric: NIAAA("spirits") },
    ],
  },
  {
    id: "alcohol_spending",
    topic: "consumption",
    label: "Spending on alcohol bought to take away (BEA)",
    help: "BEA personal consumption expenditures: what a state's residents spent on alcohol from any store (grocery, convenience, liquor or state store). Excludes bars and restaurants.",
    caution: "Spending by residents, not tax revenue and not any store's sales.",
    metric: "bea_pce_off_premises_alcohol@calendar_year",
    defaultShown: "per_resident_21plus",
  },
  {
    id: "alcohol_taxes",
    topic: "revenue",
    label: "State alcohol taxes (Census T10)",
    help: "Alcohol taxes the state government collects (beer, wine and spirits excise and similar).",
    caution: "Excludes the profit of state-run liquor stores, so states that sell liquor themselves look low. “Revenue by state” shows each state's components side by side.",
    metric: "stc_alcoholic_beverages_sales_tax@state_fiscal_year",
    defaultShown: "per_resident_21plus",
  },
  {
    id: "liquor_store_revenue",
    topic: "revenue",
    label: "State liquor-store receipts (Census A90)",
    help: "What a state government's liquor monopoly (wholesale or retail) took in, before the cost of the liquor and of running it; FY1972 and FY1977-FY2024. A state government with no liquor-store item has no value from FY2013 (an absent item, not a zero); only the FY1972-FY2012 files print zeros for those states.",
    caution: "Gross sales, not profit, and not comparable with taxes. It does not say who runs the retail stores.",
    metric: "census_liquor_stores_revenue@state_fiscal_year",
    defaultShown: "per_resident_21plus",
  },
  {
    id: "liquor_store_sales",
    topic: "retail",
    label: "Beer, wine and liquor store sales (Economic Census)",
    help: "Sales of private beer, wine and liquor stores with payroll, 2012 and 2017.",
    caution: "Not total alcohol sales: grocery, convenience and drug stores, restaurants and state-run stores sell alcohol outside this industry. Utah's figures are withheld by Census.",
    metric: "ec_sales_naics_445310@calendar_year",
    defaultShown: "per_resident_21plus",
  },
  {
    id: "retail_change",
    topic: "retail",
    label: "Retail sales, change from a year earlier (Census MSRS)",
    help: "Percent change in total retail sales (excluding nonstore retailers) from the same month a year earlier. Experimental Census data, not seasonally adjusted.",
    caution: "The Census maps mark changes whose 90% confidence interval includes zero; the downloaded file has no such flags, so this map cannot show them.",
    monthly: "msrs_total_retail_yoy_pct",
    diverging: true,
  },
  {
    id: "food_beverage_store_change",
    topic: "retail",
    label: "Food and beverage store sales, change from a year earlier (Census MSRS)",
    help: "Percent change in sales of food and beverage stores (supermarkets and liquor stores together) from the same month a year earlier.",
    caution: "Mostly grocery sales; no liquor-store detail is published. No significance flags in the file.",
    monthly: "msrs_food_beverage_stores_yoy_pct",
    diverging: true,
  },
  {
    id: "adults_drinking",
    topic: "drinking",
    label: "Adults who drank in the past 30 days (BRFSS)",
    help: "Share of adults 18+ who reported any drinking in the past 30 days. A survey estimate with a confidence interval.",
    metric: "brfss_drank_any_past_30d_pct@survey_year",
  },
  {
    id: "adults_binge",
    topic: "drinking",
    label: "Adults who binge drank (BRFSS, crude)",
    help: "Share of adults who had 5+ drinks (men) or 4+ (women) on one occasion in the past 30 days.",
    metric: "brfss_binge_5m_4f_pct@survey_year",
  },
  {
    id: "adults_binge_age_adjusted",
    topic: "drinking",
    label: "Adults who binge drank, age-adjusted (CDC CDI)",
    help: "The same binge measure adjusted by CDC for age, so states with younger or older adults compare fairly. 2019-2023.",
    metric: "brfss_binge_age_adjusted_pct@survey_year",
  },
  {
    id: "students_drinking",
    topic: "drinking",
    label: "High school students who drank in the past 30 days (YRBS)",
    help: "Share of students in grades 9-12 who had at least one drink in the past 30 days. Odd years (2019 on from CDC's Chronic Disease Indicators); a state appears only when it reported results.",
    metric: "yrbs_current_alcohol_use_hs_pct@survey_year",
  },
  {
    id: "liver_deaths",
    topic: "health",
    label: "Chronic liver disease deaths per 100,000, age-adjusted (CDC CDI)",
    help: "Deaths with chronic liver disease or cirrhosis as the underlying cause, age-adjusted, 2019-2022.",
    caution: "Not only alcohol-related: chronic liver disease has other causes too, and a death reflects many years of drinking or illness.",
    metric: "cdi_chronic_liver_disease_mortality_age_adjusted_rate@calendar_year",
  },
  {
    id: "impaired_driving_deaths",
    topic: "safety",
    label: "Alcohol-impaired-driving deaths per 100,000 residents (FARS)",
    help: "Deaths in crashes with a driver at .08 BAC or more (NHTSA's imputation), counted where the crash happened, per 100,000 residents.",
    caution: "Crashes involving visitors count in the state where they happened.",
    metric: "fars_alcohol_impaired_driving_deaths_per_100k@calendar_year",
  },
  {
    id: "income",
    topic: "context",
    label: "Personal income per person (BEA)",
    help: "Per capita personal income, current dollars.",
    metric: "bea_per_capita_personal_income@calendar_year",
  },
];

export function measureById(id: string | null): MapMeasure {
  return MAP_MEASURES.find((m) => m.id === id) ?? MAP_MEASURES[0];
}
