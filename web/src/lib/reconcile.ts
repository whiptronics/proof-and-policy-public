// Display helpers for the Utah liquor-sales reconciliation (reconciliation.json). The arithmetic is done in Python
// (src/alcohol_data/fiscal_bridge.py); this module only labels and arranges it. Evidence statuses are words with a
// symbol, never a score and never color alone.
import type { BridgeYear, EvidenceStatus, ReconValue } from "./types";

export const STATUS_META: Record<EvidenceStatus, { label: string; sym: string }> = {
  documented: { label: "Documented", sym: "✓" },
  documented_provisional: { label: "Documented, read online", sym: "◐" },
  reconciles_numerically: { label: "Reconciles numerically", sym: "=" },
  inferred: { label: "Inferred", sym: "→" },
  unresolved: { label: "Unresolved", sym: "?" },
};

export const STATUS_ORDER: EvidenceStatus[] = ["documented", "documented_provisional", "reconciles_numerically", "inferred", "unresolved"];

/** Dollars as thousands with separators, the unit the reports print ("—" for no value; a missing value is never 0). */
export function thousands(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const k = Math.round(v / 1000);
  return (k < 0 ? "−" : "") + Math.abs(k).toLocaleString("en-US");
}

export function share(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(digits)}%`;
}

/** Rate as printed in the statute: 10%, 1%, 0.875%, 1.695%. */
export function ratePct(rate: number): string {
  return `${Number((rate * 100).toFixed(3))}%`;
}

export interface ResidualPoint {
  fy: number;
  label: string;
  /** Left over after the statutory deposits, $ millions (first sales figure when DABS prints two). */
  statutory: number | null;
  reported: number | null;
  conflict: boolean;
  status: EvidenceStatus;
}

/** One point per fiscal year for the residual chart. When DABS prints two sales figures the first (the five-year
 * summary's) is charted and the year is marked; the table shows both. */
export function residualPoints(bridge: BridgeYear[]): ResidualPoint[] {
  return bridge.map((r) => {
    const first = r.dabs_sales[0]?.value;
    const pick = (kind: "statutory" | "reported") => {
      const v = r.variants.find((x) => x.kind === kind && x.sales === first);
      return v && v.residual !== null ? v.residual / 1e6 : null;
    };
    return { fy: r.fiscal_year, label: `FY${r.fiscal_year}${r.dabs_sales_conflict ? "*" : ""}`, statutory: pick("statutory"), reported: pick("reported"), conflict: r.dabs_sales_conflict, status: r.status };
  });
}

/** Years that reconcile within the tolerance on at least one variant, and the ones that do not. */
export function tally(bridge: BridgeYear[]): { reconciled: number[]; unresolved: number[] } {
  const reconciled = bridge.filter((r) => r.status === "reconciles_numerically").map((r) => r.fiscal_year);
  const unresolved = bridge.filter((r) => r.status === "unresolved").map((r) => r.fiscal_year);
  return { reconciled, unresolved };
}

/** A peer-table cell: one value, or every candidate when a report prints more than one. Ratios as percentages. */
export function cellText(values: ReconValue[] | undefined): string {
  if (!values || values.length === 0) return "—";
  return values.map((v) => (v.ratio ? share(v.value) : thousands(v.value))).join(" or ");
}

/** Where a value came from, for a link: a record in the build, or an address read online with its page. */
export function valueHref(v: ReconValue): { rec?: string; url?: string } {
  if (v.rec) return { rec: v.rec };
  if (v.url) return { url: v.page ? `${v.url}#page=${v.page}` : v.url };
  return {};
}
