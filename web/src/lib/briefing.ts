// Chart data for the Utah briefing (method BRIEFING_METHOD). Not a model: every value is the policy alternatives
// report's own result (lib/wineAlternatives: each design's price stack, fixed-volume ledger and demand cases), laid out
// for three charts:
//  * designSplit: where the money from a bottle goes (supplier, state, sellers), today and under each design;
//  * designBridge: a design's change in state revenue and costs, step by step, ending at the ledger's net;
//  * whatIf: a design's net change under each demand case and with no store savings.
// briefing.test.ts checks that every bridge reconciles to the ledger's net and every split adds up to the price.
import type { Ledger, LedgerKind, PriceStack, StackColumn } from "./wineAccounting";
import type { AltResult } from "./wineAlternatives";

export const BRIEFING_METHOD = "utah-briefing@2.0";

/** Revenue items and cost items are different kinds of money: a cost avoided is not revenue. */
export type BridgeKind = "revenue" | "cost" | "subtotal" | "total";

export interface BridgeStep {
  id: string;
  label: string;
  kind: BridgeKind;
  /** Change against today, $ a year (positive: better for the state). Subtotals and totals carry their running sum. */
  value: number;
  /** Where the bar starts and ends on the running total, $ a year. */
  from: number;
  to: number;
  note: string;
}

const sum = (l: Ledger, kinds: LedgerKind[]) => l.lines.filter((x) => kinds.includes(x.kind)).reduce((t, x) => t + (x.value ?? 0), 0);

/** A design's annual change, from today's position (0) to the ledger's net, in four plain steps. */
export function designBridge(l: Ledger, supply: "dabs" | "private"): BridgeStep[] {
  const steps: BridgeStep[] = [];
  let run = 0;
  const add = (id: string, label: string, kind: BridgeKind, value: number, note: string) => {
    if (kind === "subtotal" || kind === "total") {
      steps.push({ id, label, kind, value: run, from: 0, to: run, note });
      return;
    }
    steps.push({ id, label, kind, value, from: run, to: run + value, note });
    run += value;
  };
  add(
    "take",
    supply === "dabs" ? "DABS's markup on every bottle" : "State charge in place of DABS's markup",
    "revenue",
    sum(l, ["trading_margin", "charge"]),
    supply === "dabs"
      ? "DABS sells to grocers at its normal price, so it keeps its full markup on the wine that moves."
      : "The charge equals DABS's markup per bottle, so the state collects the same amount on the wine that moves.",
  );
  add("taxes", "Sales tax on the higher grocery price", "revenue", sum(l, ["sales_tax", "beer_tax"]), "State sales tax only; local sales tax is not modeled.");
  add("revenue_change", "Change in state revenue", "subtotal", 0, "Revenue only: before any cost change.");
  add("savings", "Store costs saved (an allocation, not measured)", "cost", sum(l, ["saving"]), "DABS expense lines allocated to the wine that leaves its stores.");
  add("new_costs", "New licensing and enforcement (assumed)", "cost", sum(l, ["new_cost"]), "An illustration: no estimate exists.");
  add("net", "Net change for the state", "total", 0, "Revenue change plus cost changes; the ledger's net change.");
  return steps;
}

export type Recipient = "supplier" | "state" | "sellers";
/** Taxes, the state's markup income and commercial margins are kept apart: none is the same kind of money. */
export type FlowKind = "cost" | "markup" | "tax" | "margin";

export interface FlowSegment {
  id: string;
  label: string;
  to: Recipient;
  kind: FlowKind;
  /** Dollars of the purchase (before sales tax) or of the sales tax on it. */
  amount: number;
}

export interface FlowColumn {
  id: string;
  label: string;
  /** What the design needs in law, in words. */
  law: string;
  segments: FlowSegment[];
  shelf: number;
  consumer: number;
  /** Everything the state receives: markup income, the charge and sales tax. */
  state: number;
}

export interface SplitInput {
  id: string;
  label: string;
  law: string;
  stack: PriceStack;
}

/** A bottle that costs `base` dollars at a state store today, before sales tax: today's split (from the first design's
 * stack) and each design's split at the grocery price it implies. Price rows add up to the shelf price; sales tax is on
 * top. */
export function designSplit(designs: SplitInput[], today: { label: string; law: string }, base = 100): FlowColumn[] {
  if (!designs.length) throw new Error("designSplit needs at least one design");
  const one = (id: string, label: string, law: string, c: StackColumn): FlowColumn => {
    const s = (v: number) => v * base;
    const segs: FlowSegment[] = [{ id: "supplier", label: "Supplier (cost of the wine)", to: "supplier", kind: "cost", amount: s(c.acquisition) }];
    const push = (seg: Omit<FlowSegment, "amount">, v: number) => {
      if (v !== 0) segs.push({ ...seg, amount: s(v) });
    };
    push({ id: "dabs_margin", label: "DABS markup income (before its operating costs)", to: "state", kind: "markup" }, c.dabsMargin);
    push({ id: "state_charge", label: "State charge on grocery wine", to: "state", kind: "tax" }, c.chargeInPrice + c.chargeAbsorbed);
    push({ id: "wholesaler", label: "Private wholesaler's margin", to: "sellers", kind: "margin" }, c.wholesaleMargin);
    push({ id: "grocer", label: "Grocer's margin", to: "sellers", kind: "margin" }, c.retailerMargin);
    segs.push({ id: "sales_tax", label: "State sales tax (paid on top)", to: "state", kind: "tax", amount: s(c.stateSalesTax) });
    return { id, label, law, segments: segs, shelf: s(c.shelf), consumer: s(c.consumer), state: segs.filter((g) => g.to === "state").reduce((t, g) => t + g.amount, 0) };
  };
  return [one("today", today.label, today.law, designs[0].stack.today), ...designs.map((d) => one(d.id, d.label, d.law, d.stack.after))];
}

export type CaseBasis = "main" | "allocation" | "exploratory" | "illustrative";

export interface WhatIfBar extends BridgeStep {
  basis: CaseBasis;
  group: "main" | "smaller" | "larger";
}

const CASES: { id: string; label: string; basis: CaseBasis; group: WhatIfBar["group"] }[] = [
  { id: "fixed", label: "Main case: 30% of household wine purchases move to grocers", basis: "main", group: "main" },
  { id: "zero_savings", label: "No store costs saved at all", basis: "allocation", group: "smaller" },
  { id: "return_to_stores", label: "Some shoppers stay with state stores", basis: "exploratory", group: "smaller" },
  { id: "price_constant", label: "Shoppers buy less wine, harsher reading", basis: "exploratory", group: "smaller" },
  { id: "price_linear", label: "Same, with straight-line demand", basis: "exploratory", group: "smaller" },
  { id: "recapture", label: "Utahns buy wine here that they now buy in other states", basis: "illustrative", group: "larger" },
  { id: "access", label: "Easier access adds wine sales", basis: "exploratory", group: "larger" },
  { id: "all", label: "Buy less, buy here and easier access together", basis: "illustrative", group: "larger" },
];

/** A design's net change in each case, each bar drawn from zero (they are alternatives, not steps). */
export function whatIf(r: AltResult): WhatIfBar[] {
  return CASES.map((c) => {
    const net = c.id === "zero_savings" ? r.zeroSavings.net : r.demand.find((d) => d.id === c.id)?.net;
    if (net === undefined) throw new Error(`${r.def.id} has no ${c.id} case`);
    // Cases nothing measures for Utah say so on the chart itself, not only in the notes below it.
    const label = c.basis === "exploratory" || c.basis === "illustrative" ? `${c.label} (${c.basis})` : c.label;
    return { ...c, label, kind: c.basis === "main" ? "total" : "revenue", value: net, from: 0, to: net, note: c.basis };
  });
}
