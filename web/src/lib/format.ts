// Number and label formatting. Formatting never changes a value; zero always prints as 0.

const UNIT_LABELS: Record<string, string> = {
  persons: "persons",
  usd_nominal: "US dollars (nominal)",
  usd_constant_cy2024: "US dollars (constant, calendar-2024 prices)",
  usd_nominal_per_person: "US dollars per person (nominal)",
  percent: "percent",
  fraction: "fraction",
  us_gallons: "US gallons of beverage",
  us_gallons_ethanol: "US gallons of ethanol",
  us_gallons_ethanol_per_person: "US gallons of ethanol per person",
  index_1982_84_eq_100: "index (1982-84 = 100)",
  cases: "cases (as reported by DABS)",
  nine_liter_cases: "9-liter cases",
  deaths: "deaths",
  deaths_per_100k: "deaths per 100,000 residents",
  percent_change: "percent change from a year earlier",
  occasions: "occasions",
  drinks: "drinks",
  establishments: "establishments",
  employees: "employees",
};

export function unitLabel(unit: string): string {
  return UNIT_LABELS[unit] ?? unit.replaceAll("_", " ");
}

export const CONVERSION_LABELS: Record<string, string> = {
  nominal: "Nominal dollars (as published)",
  real_cy2024: "Constant dollars (calendar-2024 prices, CPI-U)",
  per_resident: "Per resident (Census July 1, all ages)",
  per_resident_21plus: "Per resident aged 21+ (Census July 1)",
  index: "Index (selected base year = 100)",
};

export function unitAfter(unit: string, conversion: string): string {
  if (conversion === "real_cy2024") return "usd_constant_cy2024";
  if (conversion === "per_resident" || conversion === "per_resident_21plus") return "usd_nominal_per_person";
  if (conversion === "index") return "index_base_100";
  return unit;
}

const nf = (digits: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: digits, minimumFractionDigits: 0 });

/** Full-precision display for tables and detail panels. */
export function formatValue(v: number | null | undefined, unit: string): string {
  if (v === null || v === undefined) return "—";
  if (v === 0) return "0";
  if (unit.startsWith("usd") && unit.includes("per_person")) return `$${nf(2).format(v)}`;
  if (unit.startsWith("usd")) return `$${nf(0).format(v)}`;
  if (unit === "percent") return `${new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v)}%`;
  if (unit === "fraction") return nf(4).format(v);
  if (unit === "us_gallons_ethanol_per_person") return nf(2).format(v);
  if (unit.startsWith("index")) return nf(1).format(v);
  return nf(Math.abs(v) < 100 ? 2 : 0).format(v);
}

const SIG = new Intl.NumberFormat("en-US", { maximumSignificantDigits: 4 });
const SIG3 = new Intl.NumberFormat("en-US", { maximumSignificantDigits: 3 });

/** A short label that fits inside a state on a map: three significant digits, dollars abbreviated.
 * Tables, bars and downloads keep the full value. */
export function mapLabel(v: number, unit: string): string {
  if (v === 0) return "0";
  const abs = Math.abs(v);
  if (unit.startsWith("usd")) {
    const sign = v < 0 ? "-" : "";
    if (abs >= 1e9) return `${sign}$${SIG3.format(abs / 1e9)}B`;
    if (abs >= 1e6) return `${sign}$${SIG3.format(abs / 1e6)}M`;
    if (abs >= 1e4) return `${sign}$${SIG3.format(abs / 1e3)}k`;
    return `${sign}$${nf(abs >= 100 ? 0 : 2).format(abs)}`;
  }
  if (unit === "percent") return `${nf(1).format(v)}%`;
  if (abs >= 1e4) return nf(0).format(v);
  return SIG3.format(v);
}

/** Averages and changes keep enough digits to be read: small values get four significant digits instead
 * of two decimals, so a real change never prints as 0. Dollars and percentages print as formatValue. */
export function precise(v: number | null | undefined, unit: string): string {
  if (v === null || v === undefined) return "—";
  if (v === 0) return "0";
  if (unit.startsWith("usd") || unit === "percent" || Math.abs(v) >= 100) return formatValue(v, unit);
  return SIG.format(v);
}

/** Short display for chart axes. */
export function formatAxis(v: number, unit: string): string {
  if (v === 0) return "0";
  const abs = Math.abs(v);
  const compact = (x: number) =>
    abs >= 1e9 ? `${nf(1).format(x / 1e9)}B` : abs >= 1e6 ? `${nf(1).format(x / 1e6)}M` : abs >= 1e4 ? `${nf(0).format(x / 1e3)}k` : nf(2).format(x);
  if (unit.startsWith("usd")) return `$${compact(v)}`;
  if (unit === "percent") return `${nf(0).format(v)}%`;
  return compact(v);
}

export function words(code: string | null | undefined): string {
  return (code ?? "").replaceAll("_", " ");
}

/** How a snapshot's excerpt supports its value (policy_snapshots.support_basis). */
export const SUPPORT_LABELS: Record<string, { short: string; long: string }> = {
  explicit_text: { short: "stated", long: "The excerpt names the outlet type or arrangement." },
  no_outlet_restriction: {
    short: "general license",
    long: "The source creates a general retail license; that this outlet type qualifies is inferred from the absence of a restriction.",
  },
  indirect: { short: "implied", long: "The text implies the status without stating it." },
};

export function geoName(geoId: string, geos: { geo_id: string; name: string }[]): string {
  return geos.find((g) => g.geo_id === geoId)?.name ?? geoId;
}

export function bytes(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

export const PERIOD_KIND_LABELS: Record<string, string> = {
  // Population estimates are for July 1; CBP employment is for the pay period including March 12.
  point_in_time: "A single date (the definition says which)",
  calendar_year: "Calendar year",
  state_fiscal_year: "State fiscal year (dates vary by state)",
  survey_year: "Survey year",
  month: "Month",
  pooled_years: "Pooled years",
};
