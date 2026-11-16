// One bottle, from what it costs DABS to land to what the shopper pays (method BOTTLE_METHOD). Not a second model: the
// price stacks (lib/wineAccounting.ts) are per $1 of today's state-store shelf price, and a bottle is the same stack at
// the scale where its acquisition cost equals the landed cost the reader enters. lib/briefing.ts designSplit draws it.
//
// Two things are kept apart, because they are often confused:
//  * the statute: DABS must mark wine up at least 88.5% over its landed case cost (§ 32B-2-304(2)(b)), a floor on a
//    price, not a tax and not a profit;
//  * what DABS actually earns: its FY2025 all-product gross margin (47.2% of sales, a markup of about 89.4% on cost),
//    which the model applies to wine. Out of that margin DABS pays its operating costs and the statutory transfers
//    before any net profit reaches the General Fund (dabsDollar).
import type { BridgeKind, BridgeStep } from "./briefing";
import type { WorkedData } from "./initiatives";
import type { StackColumn } from "./wineAccounting";
import { STATUTORY_MARKUP } from "./wineMargin";

export const BOTTLE_METHOD = "bottle@1.0";

/** The multiplier that turns a per-$1-of-today's-shelf-price stack into one bottle that costs `landed` to land. */
export function bottleScale(today: StackColumn, landed: number): number {
  if (!(landed > 0) || !(today.acquisition > 0)) throw new Error("landed cost and acquisition share must be positive");
  return landed / today.acquisition;
}

/** The statute's arithmetic for a bottle at exactly the minimum markup (an illustration: the statute sets a floor). */
export function statutoryFloor(landed: number) {
  const markup = landed * STATUTORY_MARKUP.wine;
  return { landed, markupRate: STATUTORY_MARKUP.wine, markup, price: landed + markup };
}

export interface DollarPart {
  id: "cost" | "operating" | "other_income" | "transfers" | "net_profit";
  label: string;
  /** Share of DABS's FY sales (other income is negative here: it adds to what the sales leave). */
  share: number;
}

/** Where a dollar of DABS's sales went in the base year, on the income statement (all products, not wine alone). The
 * parts add up to the dollar: cost + operating expenses − other income + transfers and non-operating items, net + net
 * profit = 1. Throws if the statement lines do not reconcile, so a mistyped line cannot reach the page. */
export function dabsDollar(d: WorkedData): DollarPart[] {
  const s = d.statement;
  const check = (a: number, b: number, what: string) => {
    if (Math.abs(a - b) > 0.5) throw new Error(`${what}: ${a} vs ${b}`);
  };
  check(d.sales - s.cost, d.grossProfit, "sales − cost ≠ gross profit");
  check(d.grossProfit + s.otherIncome - d.expenses.total, s.netOperatingIncome, "gross profit + other income − operating expenses ≠ net operating income");
  check(s.netOperatingIncome + s.nonOperatingNet, s.netProfit, "net operating income + non-operating ≠ net profit");
  const of = (v: number) => v / d.sales;
  return [
    { id: "cost", label: "Cost of the product (what DABS paid suppliers, landed)", share: of(s.cost) },
    { id: "operating", label: "DABS's operating expenses (stores, staff, warehouse, card fees)", share: of(d.expenses.total) },
    { id: "other_income", label: "Other income (adds to what the sales leave)", share: -of(s.otherIncome) },
    { id: "transfers", label: "School-meals and other program transfers, and non-operating items, net", share: of(-s.nonOperatingNet) },
    { id: "net_profit", label: "Net profit transferred to the General Fund", share: of(s.netProfit) },
  ];
}

/** The base-year income statement as a waterfall, from sales to net profit (all products, $ a year), drawn from the same
 * lines dabsDollar checks: gross collections on the first row, what reaches the General Fund on the last. */
export function dabsAccountsBridge(d: WorkedData): BridgeStep[] {
  dabsDollar(d); // throws unless the statement lines reconcile
  const s = d.statement;
  const steps: BridgeStep[] = [];
  let run = 0;
  const add = (id: string, label: string, kind: BridgeKind, value: number, note: string) => {
    if (kind === "subtotal" || kind === "total") steps.push({ id, label, kind, value: run, from: 0, to: run, note });
    else {
      steps.push({ id, label, kind, value, from: run, to: run + value, note });
      run += value;
    }
  };
  add("sales", "Liquor sales, all products", "revenue", d.sales, "Operating revenue as printed; the reports' arithmetic reads as excluding sales tax, which they do not define.");
  add("cost", "Cost of the product", "cost", -s.cost, "Cost of liquor sold, as printed.");
  add("gross_profit", "Gross profit: what the markup brings in", "subtotal", 0, "Before any of DABS's own costs.");
  add("other_income", "Other income", "revenue", s.otherIncome, "As printed on the income statement; the five-year summary prints a different figure (unresolved).");
  add("operating", "Operating expenses: stores, staff, warehouse, card fees", "cost", -d.expenses.total, "Every operating expense line.");
  add("noi", "Net operating income", "subtotal", 0, "As printed.");
  add("non_operating", "School-meals and other transfers, and non-operating items", "cost", s.nonOperatingNet, "Net of non-operating income; mostly the transfer to school lunch, the Uniform School Fund and public safety.");
  add("net_profit", "Net profit to the General Fund", "total", 0, "As printed.");
  if (Math.abs(run - s.netProfit) > 0.5) throw new Error(`accounts bridge ends at ${run}, not the net profit ${s.netProfit}`);
  return steps;
}
