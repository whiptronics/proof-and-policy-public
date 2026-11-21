// The public funding page's model layer ("Where the Money Goes", ?v=funding): an adapter over the existing
// policy-designs engine (netPerDollar, terms), not a second calculator. It maps one scenario to
//   - the state's net change (all accounts together), from the engine's closed form;
//   - each earmarked program's change, from the deposit rates in the law ledger (publicFunding.generated.ts);
//   - three conditions, each "satisfied", "not_satisfied" or "undetermined", never a single score.
// Earmarks are allocations inside the state's receipts: routing money to a program moves it between state accounts and
// adds none, so the programs' changes and the rest (General Fund and other accounts) always sum to the net change.
import { PUBLIC_FUNDING as PF } from "./publicFunding.generated";
import { POLICY_DESIGNS_METHOD, SAVINGS_CASES, netPerDollar, terms, type SavingsCase, type TakeStructure, type Terms } from "./policyDesigns";
import { RETAILER_TARGET, WHOLESALER_MARGIN } from "./wineAlternatives";
import { toCsv, type Column } from "./csv";

export const PUBLIC_FUNDING_METHOD = "public-funding@1.0";
export const FUNDING_SCHEMA = 1;

export type Arrangement = "A" | "B" | "C";
export const ARRANGEMENTS: { id: Arrangement; label: string; status: "observed" | "hypothetical"; text: string }[] = [
  { id: "A", label: "Current DABS channel", status: "observed", text: "Observed structure; the financial baseline." },
  { id: "B", label: "Grocery retail with DABS wholesale", status: "hypothetical", text: "DABS stays the wholesaler and sells to licensed grocers; grocers have costs and margins of their own." },
  { id: "C", label: "Private distribution with a state remittance", status: "hypothetical", text: "Private wholesalers supply grocers; the state receives only the charge the policy sets." },
];

/** How the bill routes the earmarked deposits on the wine that moves. */
export type Routing = "law_as_written" | "retail_value";
export const ROUTINGS: { id: Routing; label: string; text: string }[] = [
  {
    id: "law_as_written",
    label: "The deposit sections as written",
    text: "The deposits stay on DABS's own sales revenue (32B-2-304(5), -305(4), -306(3)). Wine DABS sells to grocers is assumed to count, at DABS's price to grocers; wine a private wholesaler sells does not.",
  },
  {
    id: "retail_value",
    label: "The bill applies the deposit rates to the grocery sale",
    text: "As 32B-2-304(6)(a) already does for package agencies at a manufacturing facility: 10%, 1.695% and 0.60% of the grocer's sales of the wine go to the same three accounts, paid from the state's receipts on that wine.",
  },
];

export type Condition = "satisfied" | "not_satisfied" | "undetermined";

const TOL = 1e-9;

// ----- the canonical tests (the scenario and the map use these; the synthetic vectors check them) ---------------------------

/** A markup is on cost: 88.5% on $10 is $18.85. */
export const priceFromMarkup = (cost: number, markup: number) => cost * (1 + markup);
/** The gross margin on the selling price that a markup on cost gives: 88.5% gives 46.95%. */
export const marginOfMarkup = (markup: number) => markup / (1 + markup);
/** A gross margin is on the selling price: 25% on a $15 cost is a $20 price. */
export const priceFromMargin = (cost: number, margin: number) => cost / (1 - margin);

/** Like-basis net public receipts: unknown is undetermined, never neutral. */
export function revenueNeutral(baseline: number | null, after: number | null): Condition {
  if (baseline === null || after === null || !Number.isFinite(baseline) || !Number.isFinite(after)) return "undetermined";
  return after >= baseline - TOL ? "satisfied" : "not_satisfied";
}

/** The same product's final price: no higher than today. */
export function priceNeutral(baseline: number | null, after: number | null): Condition {
  if (baseline === null || after === null || !Number.isFinite(baseline) || !Number.isFinite(after)) return "undetermined";
  return after <= baseline + TOL ? "satisfied" : "not_satisfied";
}

/** Receipts on the state's consolidated boundary: a transfer between its own accounts (DABS to the school fund, say)
 * is not a receipt, so only money from outside counts. */
export const consolidatedReceipts = (flows: { amount: number; internal: boolean }[]) => flows.reduce((a, f) => a + (f.internal ? 0 : f.amount), 0);

export interface FundingInputs {
  arrangement: Arrangement;
  /** Shelf price per $1 of today's state-store price, before sales tax (1 = the same price). */
  price: number;
  /** The grocer's gross margin on its own price (before any state charge). */
  grocerMargin: number;
  /** Share of household wine purchases that move to grocery stores; null = not measured (documented inputs only). */
  share: number | null;
  /** New purchases in Utah (brought back from other states or new), share of household wine purchases. */
  additional: number;
  savings: SavingsCase;
  /** Private wholesaler's margin (C only), share of its price. */
  distribution: number;
  routing: Routing;
  /** License fees cover the new administration exactly (a design choice). */
  fees: boolean;
}

/** Bounds every input is checked against (the URL decoder and the page's controls use the same ones). */
export const BOUNDS = {
  price: [0.8, 1.6],
  grocerMargin: [0, 0.6],
  share: [0, 1],
  additional: [0, 0.3],
  distribution: [0, 0.5],
} as const;

export const T: Terms = terms();
export const HOUSEHOLD_WINE = T.wine * T.household;
export const DEFAULT_SHARE = T.shift;

export const DEFAULT_INPUTS: FundingInputs = {
  arrangement: "B",
  price: 1,
  grocerMargin: 0.1,
  share: DEFAULT_SHARE,
  additional: 0,
  savings: "none",
  distribution: WHOLESALER_MARGIN,
  routing: "law_as_written",
  fees: true,
};

export function validInputs(x: FundingInputs): string[] {
  const bad: string[] = [];
  const within = (k: keyof typeof BOUNDS, v: number | null) => {
    if (v === null) return;
    const [lo, hi] = BOUNDS[k];
    if (!Number.isFinite(v) || v < lo || v > hi) bad.push(`${k} must be between ${lo} and ${hi}`);
  };
  within("price", x.price);
  within("grocerMargin", x.grocerMargin);
  within("share", x.share);
  within("additional", x.additional);
  within("distribution", x.distribution);
  if (!ARRANGEMENTS.some((a) => a.id === x.arrangement)) bad.push("unknown arrangement");
  if (!SAVINGS_CASES.some((s) => s.id === x.savings)) bad.push("unknown savings case");
  if (!ROUTINGS.some((r) => r.id === x.routing)) bad.push("unknown routing");
  return bad;
}

// ----- the law ledger's rates (never retyped) -------------------------------------------------------------------------------

function rule(id: string) {
  const r = PF.law.find((l) => l.rule_id === id);
  if (!r || r.rate === null) throw new Error(`law ledger: ${id} missing`);
  return r;
}

export type ProgramId = "school_meals" | "enforcement" | "underage_campaign";
export const PROGRAMS: { id: ProgramId; label: string; rate: number; rule: string; lagYears: number }[] = [
  { id: "school_meals", label: "School meals (Uniform School Fund)", rate: rule("UT-32B-2-304-5").rate!, rule: "UT-32B-2-304-5", lagYears: 0 },
  { id: "enforcement", label: "Alcohol law enforcement fund", rate: rule("UT-32B-2-305-4").rate!, rule: "UT-32B-2-305-4", lagYears: 0 },
  { id: "underage_campaign", label: "Underage drinking prevention media campaign", rate: rule("UT-32B-2-306-3").rate!, rule: "UT-32B-2-306-3", lagYears: 2 },
];
/** 32B-2-304(6)(a)'s total for package agencies at a manufacturing facility: the three rates together. */
export const PACKAGE_AGENCY_REMITTANCE = rule("UT-32B-2-304-6a").rate!;

// ----- one scenario --------------------------------------------------------------------------------------------------------

const STRUCTURE: Record<Exclude<Arrangement, "A">, TakeStructure> = { B: "wholesale_price", C: "retail_charge" };

export interface ProgramResult {
  id: ProgramId;
  label: string;
  /** Per $1 of today's state-store sales that move; annual $ when the share is known. */
  perDollar: number;
  baseline: number | null;
  after: number | null;
  delta: number | null;
  /** new >= baseline on the same basis. */
  financiallyProtected: Condition;
  /** Whether the routing names who pays, on what base, into which account (a description, not a legal opinion). */
  legallySpecified: Condition;
}

export interface FundingResult {
  method: string;
  engine: string;
  inputs: FundingInputs;
  errors: string[];
  movedDollars: number | null;
  additionalDollars: number;
  /** State's net change per $ that moves (license fees or not as chosen; administration per $ uses the engine's moved). */
  netPerDollar: number;
  net: number | null;
  programs: ProgramResult[];
  /** The rest: General Fund and other accounts (net less the programs). */
  rest: number | null;
  conditions: { revenue: Condition; price: Condition; grocer: Condition; programs: Condition };
  /** What is missing for an undetermined condition, in words. */
  missing: string[];
}

/** The earmarks' base per $1 of today's sales: what the deposit rates apply to under the routing. */
export function earmarkBase(a: Arrangement, routing: Routing, price: number, grocerMargin: number): number {
  if (a === "A") return 1;
  if (routing === "retail_value") return price;
  return a === "B" ? price * (1 - grocerMargin) : 0;
}

/** A grocer earns nothing at 0% and is not shown to cover its costs below the grocery-store average. */
export function grocerCondition(g: number): Condition {
  if (g <= 0) return "not_satisfied";
  return g >= RETAILER_TARGET - TOL ? "satisfied" : "undetermined";
}

/** Who gets each part of one bottle's price, per $1 of today's state-store price before tax; the shopper pays the sum,
 * sales tax included once, on the shelf price. */
export function bottleReceipt(x: FundingInputs): { who: string; v: number }[] {
  const P = x.arrangement === "A" ? 1 : x.price;
  const g = x.grocerMargin;
  const tax = { who: "State sales tax", v: T.salesTax * P };
  if (x.arrangement === "A") return [{ who: "Supplier (DABS's landed cost)", v: T.landed }, { who: "DABS's gross margin (the state)", v: T.margin }, tax];
  if (x.arrangement === "B")
    return [{ who: "Supplier (DABS's landed cost)", v: T.landed }, { who: "DABS's gross margin on its sale to the grocer (the state)", v: P * (1 - g) - T.landed }, { who: "Grocer's gross margin", v: P * g }, tax];
  const Q = T.landed / ((1 - x.distribution) * (1 - g));
  return [{ who: "Supplier (landed cost)", v: T.landed }, { who: "Private wholesaler's margin", v: Q * (1 - g) - T.landed }, { who: "Grocer's gross margin", v: Q * g }, { who: "State charge", v: P - Q }, tax];
}

/** The law ledger is a reading on one date; after `maxDays` the page says to check for later changes. */
export function lawIsStale(asOf: string, today: Date, maxDays = 180): boolean {
  return (today.getTime() - Date.parse(`${asOf}T00:00:00Z`)) / 86_400_000 > maxDays;
}

export function fundingScenario(x: FundingInputs): FundingResult {
  const errors = validInputs(x);
  const empty = (why: string): FundingResult => ({
    method: PUBLIC_FUNDING_METHOD, engine: POLICY_DESIGNS_METHOD, inputs: x, errors, movedDollars: null, additionalDollars: 0, netPerDollar: 0, net: null,
    programs: PROGRAMS.map((p) => ({ id: p.id, label: p.label, perDollar: 0, baseline: null, after: null, delta: null, financiallyProtected: "undetermined", legallySpecified: "undetermined" })),
    rest: null, conditions: { revenue: "undetermined", price: "undetermined", grocer: "undetermined", programs: "undetermined" }, missing: [why],
  });
  if (errors.length) return empty(`Invalid inputs: ${errors.join("; ")}`);

  const missing: string[] = [];
  const moved = x.share === null ? null : (T.moved * x.share) / T.shift;
  if (moved === null) missing.push("The share of household wine purchases that would move to grocery stores is not measured for Utah.");
  const additionalDollars = x.additional * HOUSEHOLD_WINE;
  const v = SAVINGS_CASES.find((s) => s.id === x.savings)!.perDollar;
  const admin = x.fees ? 0 : T.admin;

  if (x.arrangement === "A") {
    const programs = PROGRAMS.map((p) => ({ id: p.id, label: p.label, perDollar: 0, baseline: moved === null ? null : p.rate * moved, after: moved === null ? null : p.rate * moved, delta: moved === null ? null : 0, financiallyProtected: "satisfied" as Condition, legallySpecified: "satisfied" as Condition }));
    return { method: PUBLIC_FUNDING_METHOD, engine: POLICY_DESIGNS_METHOD, inputs: x, errors, movedDollars: moved, additionalDollars: 0, netPerDollar: 0, net: 0, programs, rest: 0, conditions: { revenue: "satisfied", price: "satisfied", grocer: "satisfied", programs: "satisfied" }, missing };
  }

  const s = STRUCTURE[x.arrangement];
  const f = { distribution: x.arrangement === "C" ? x.distribution : 0, savings: v.shortRun + v.conditional, adminPerDollar: 0, handling: 0 };
  const per = netPerDollar(s, x.price, x.grocerMargin, T, f);
  // New sales displace nothing at DABS: the state keeps its whole take on them, and no DABS cost is saved.
  const perNew = netPerDollar(s, x.price, x.grocerMargin, T, { ...f, savings: 0 }) + T.margin + T.salesTax;
  const net = moved === null ? null : per * moved + perNew * additionalDollars - admin;

  const base = earmarkBase(x.arrangement, x.routing, x.price, x.grocerMargin);
  const specified: Condition = x.routing === "retail_value" ? "satisfied" : x.arrangement === "B" ? "undetermined" : "not_satisfied";
  const programs: ProgramResult[] = PROGRAMS.map((p) => {
    const perDollar = p.rate * (base - 1);
    const baseline = moved === null ? null : p.rate * moved;
    const after = moved === null ? null : p.rate * (base * moved + base * additionalDollars);
    const delta = baseline === null || after === null ? null : after - baseline;
    // With no new sales the sign of the change per $ decides; new sales can only add to a program.
    const prot: Condition = delta !== null ? (delta >= -TOL ? "satisfied" : "not_satisfied") : perDollar >= -TOL ? "satisfied" : x.additional > 0 ? "undetermined" : "not_satisfied";
    return { id: p.id, label: p.label, perDollar, baseline, after, delta, financiallyProtected: prot, legallySpecified: specified };
  });
  const programSum = programs.every((p) => p.delta !== null) ? programs.reduce((a, p) => a + (p.delta as number), 0) : null;
  const rest = net === null || programSum === null ? null : net - programSum;

  let revenue: Condition;
  if (net !== null) revenue = revenueNeutral(0, net);
  else if (!x.fees) revenue = "undetermined"; // a fixed administration cost needs the volume
  else revenue = per >= -TOL ? "satisfied" : x.additional > 0 ? "undetermined" : "not_satisfied";
  if (revenue === "undetermined" && !missing.length) missing.push("The share that moves decides whether the fixed administration is covered.");

  const price = priceNeutral(1, x.price);
  const grocer = grocerCondition(x.grocerMargin);
  if (grocer === "undetermined") missing.push(`Whether grocers would sell wine at a ${(x.grocerMargin * 100).toFixed(0)}% gross margin is not measured (grocery stores' average on everything they sell is about ${(RETAILER_TARGET * 100).toFixed(0)}%).`);
  if (x.additional > 0) missing.push("New purchases are counted as new drinking: if some replace beer, the beer revenue lost is not subtracted here (the scenario page, ?v=scenario, subtracts it).");
  const progs = programs.map((p) => p.financiallyProtected);
  const programsCond: Condition = progs.includes("not_satisfied") ? "not_satisfied" : progs.includes("undetermined") ? "undetermined" : "satisfied";
  return { method: PUBLIC_FUNDING_METHOD, engine: POLICY_DESIGNS_METHOD, inputs: x, errors, movedDollars: moved, additionalDollars, netPerDollar: per, net, programs, rest, conditions: { revenue, price, grocer, programs: programsCond }, missing };
}

/** "Documented inputs only": every assumption that is not measured is removed (no store savings, no new purchases, the
 * share that moves unknown). What still has an answer is what the per-dollar arithmetic decides. */
export function documentedOnly(x: FundingInputs): FundingInputs {
  return { ...x, share: null, additional: 0, savings: "none" };
}

// ----- the price and revenue map ---------------------------------------------------------------------------------------------

export type Region = "both" | "price_only" | "revenue_only" | "neither";

export interface MapPoint {
  price: number;
  grocerMargin: number;
  netPerDollar: number;
  region: Region;
  /** The grocer test at this margin; the two map tests say nothing about whether a grocer can sell at it. */
  grocer: Condition;
}

export const MAP_PRICES = Array.from({ length: 13 }, (_, i) => Math.round((0.9 + i * 0.05) * 100) / 100);
export const MAP_MARGINS = Array.from({ length: 9 }, (_, i) => i * 0.05);

/** Every point is classified by the same two tests the scenario uses (per $ that moves, license fees covering the
 * administration, the chosen savings case and no new purchases). */
export function priceRevenueMap(a: Exclude<Arrangement, "A">, savings: SavingsCase, distribution: number = WHOLESALER_MARGIN): MapPoint[] {
  const v = SAVINGS_CASES.find((s) => s.id === savings)!.perDollar;
  const f = { distribution: a === "C" ? distribution : 0, savings: v.shortRun + v.conditional, adminPerDollar: 0, handling: 0 };
  const out: MapPoint[] = [];
  for (const g of MAP_MARGINS)
    for (const P of MAP_PRICES) {
      const n = netPerDollar(STRUCTURE[a], P, g, T, f);
      const rev = revenueNeutral(0, n) === "satisfied";
      const pr = priceNeutral(1, P) === "satisfied";
      out.push({ price: P, grocerMargin: g, netPerDollar: n, region: rev && pr ? "both" : pr ? "price_only" : rev ? "revenue_only" : "neither", grocer: grocerCondition(g) });
    }
  return out;
}

// ----- stress test -----------------------------------------------------------------------------------------------------------

export const STRESS_SHARES = [0.05, 0.15, 0.3, 0.45, 0.6] as const;
export const STRESS_ADDITIONAL = [0, 0.025, 0.05] as const;

export interface StressRow {
  savings: SavingsCase;
  fees: boolean;
  min: number;
  max: number;
  minAt: { share: number; additional: number };
  maxAt: { share: number; additional: number };
}

/** Deterministic sweep of the unmeasured inputs around one design point. Ranges are conditional results, not intervals. */
export function stressTest(x: FundingInputs): StressRow[] {
  const rows: StressRow[] = [];
  for (const sv of SAVINGS_CASES)
    for (const fees of [true, false]) {
      let lo = { v: Infinity, share: 0, additional: 0 };
      let hi = { v: -Infinity, share: 0, additional: 0 };
      for (const share of STRESS_SHARES)
        for (const additional of STRESS_ADDITIONAL) {
          const r = fundingScenario({ ...x, share, additional, savings: sv.id, fees });
          if (r.net === null) continue;
          if (r.net < lo.v) lo = { v: r.net, share, additional };
          if (r.net > hi.v) hi = { v: r.net, share, additional };
        }
      rows.push({ savings: sv.id, fees, min: lo.v, max: hi.v, minAt: { share: lo.share, additional: lo.additional }, maxAt: { share: hi.share, additional: hi.additional } });
    }
  return rows;
}

// ----- the share link ---------------------------------------------------------------------------------------------------------

const SAV: SavingsCase[] = ["none", "allocated", "longer_run"];
const ROUT: Routing[] = ["law_as_written", "retail_value"];

/** A versioned, bounded encoding of the public inputs only: v1_B_1.000_0.100_0.300_0_0_0.295_0_1. */
export function encodeScenario(x: FundingInputs): string {
  const n = (v: number) => v.toFixed(3);
  return ["v1", x.arrangement, n(x.price), n(x.grocerMargin), x.share === null ? "x" : n(x.share), n(x.additional), SAV.indexOf(x.savings), n(x.distribution), ROUT.indexOf(x.routing), x.fees ? 1 : 0].join("_");
}

/** Null for anything malformed, out of bounds, of another version or too long; the page then uses the defaults. */
export function decodeScenario(s: string | null): FundingInputs | null {
  if (!s || s.length > 80 || !/^[A-Za-z0-9._]+$/.test(s)) return null;
  const p = s.split("_");
  if (p.length !== 10 || p[0] !== "v1") return null;
  const num = (t: string) => (/^\d+(\.\d+)?$/.test(t) ? Number(t) : NaN);
  const idx = (t: string, n: number) => (/^\d$/.test(t) && Number(t) < n ? Number(t) : -1);
  const arrangement = p[1] as Arrangement;
  const sav = idx(p[6], SAV.length);
  const rout = idx(p[8], ROUT.length);
  if (!ARRANGEMENTS.some((a) => a.id === arrangement) || sav < 0 || rout < 0 || (p[9] !== "0" && p[9] !== "1")) return null;
  const x: FundingInputs = {
    arrangement,
    price: num(p[2]),
    grocerMargin: num(p[3]),
    share: p[4] === "x" ? null : num(p[4]),
    additional: num(p[5]),
    savings: SAV[sav],
    distribution: num(p[7]),
    routing: ROUT[rout],
    fees: p[9] === "1",
  };
  return validInputs(x).length ? null : x;
}

// ----- public value ---------------------------------------------------------------------------------------------------------

export interface Comparator {
  id: string;
  label: string;
  /** The base amount and its unit; null when no sourced amount exists. */
  amount: number | null;
  unit: "share" | "units";
  unitLabel: string;
  year: string;
  source: string;
  note: string;
  /** A one-time cost set against a yearly amount: shown as one every so many years. */
  oneTime?: boolean;
}

const dest = (id: string) => PF.dabs.destinations.find((d) => d.id === id)!.amount;
const UT = PF.education.states.find((s) => s.usps === "UT")!;
const CMP = PF.comparators;
const FREE_LUNCH = Math.round((PF.meals.freeLunchReimbursement.section11 + PF.meals.freeLunchReimbursement.section4) * 100) / 100;

export const COMPARATORS: Comparator[] = [
  { id: "school_deposit", label: "FY2025 school-meals deposit from liquor sales", amount: dest("school_meals"), unit: "share", unitLabel: "of the deposit", year: "FY2025", source: "DABS 90th Annual Report, p. 32", note: "A restricted deposit: the Uniform School Fund's school meals program." },
  { id: "child_nutrition", label: "FY2025 Child Nutrition line item (all sources)", amount: PF.meals.fy2025ChildNutrition.total, unit: "share", unitLabel: "of the line item", year: "FY2025", source: "Office of Legislative Research and General Counsel, School Meals Programs (rev. 2025-01-16), p. 5", note: `Includes $${(PF.meals.fy2025ChildNutrition.federal / 1e6).toFixed(1)} million of federal funds; liquor money is one stream among several.` },
  { id: "general_fund", label: "FY2025 net profit transfer to the General Fund", amount: dest("general_fund"), unit: "share", unitLabel: "of the transfer", year: "FY2025", source: "DABS 90th Annual Report, p. 32", note: "Unrestricted: the Legislature appropriates it for any purpose." },
  { id: "per_pupil", label: "A year of current spending for one Utah public-school student", amount: UT.ppcs, unit: "units", unitLabel: "student-years", year: "FY2024", source: "Census, 2024 Annual Survey of School System Finances, Table 8", note: "Current spending only (no buildings or debt). The comparison is a scale, not a number of students who would be served." },
  { id: "free_lunch_reimbursement", label: "Federal reimbursement for one free school lunch (a reimbursement rate, not a cost)", amount: FREE_LUNCH, unit: "units", unitLabel: "free lunches' federal reimbursement", year: PF.meals.freeLunchReimbursement.schoolYear, source: "USDA Food and Nutrition Service, 89 FR 56720 (July 10, 2024), Sections 4 and 11, contiguous states", note: `What the federal government pays a school for one free lunch, July 2024 to June 2025: Section 11 ($${PF.meals.freeLunchReimbursement.section11.toFixed(2)}) plus Section 4 (${Math.round(PF.meals.freeLunchReimbursement.section4 * 100)} cents) where under 60% of lunches are free or reduced-price; ${Math.round(PF.meals.freeLunchReimbursement.section4HighNeedExtra * 100)} cents more at 60% or above, and ${Math.round(PF.meals.freeLunchReimbursement.performanceExtra * 100)} cents more for schools certified for the meal-pattern payment. USDA Foods and state money come on top. Not what a lunch costs to make, and not a number of children who would be fed.` },
  { id: "meal_cost", label: "Full cost of one school lunch (national, school year 2014-15)", amount: CMP.mealCost.lunchFullWeighted, unit: "units", unitLabel: "lunches at that cost", year: CMP.mealCost.schoolYear, source: "USDA Food and Nutrition Service, School Nutrition and Meal Cost Study, Volume 3 summary (April 2019), p. 1", note: `The mean full cost to produce a reimbursable lunch, weighted by lunches served, across the nation in school year 2014-15, in that year's dollars (not adjusted for inflation). Full cost adds district costs not charged to food service to the reported cost ($${CMP.mealCost.lunchReportedWeighted.toFixed(2)}); for the average school food authority the two were $${CMP.mealCost.lunchFullAverage.toFixed(2)} and $${CMP.mealCost.lunchReportedAverage.toFixed(2)}, against a free-lunch subsidy of $${CMP.mealCost.freeLunchSubsidy.toFixed(2)} then. No later study with published cost figures was found (the follow-up study of 2022-23 had none). The legislature's brief gives the prices families pay ($3.56 lunch, $2.17 breakfast), not what a meal costs.` },
  { id: "teacher", label: "Average total compensation of one Utah teacher, FY2025 (includes benefits)", amount: CMP.teacher.totalCompensationMean, unit: "units", unitLabel: "teachers' yearly total compensation", year: CMP.teacher.fiscalYear, source: "Office of the State Auditor, Transparent Utah Teacher Compensation Dashboard, FY2025 (downloaded 2026-11-21)", note: `The mean over ${CMP.teacher.teachers.toLocaleString("en-US")} teachers whose primary role was classroom teaching, each counted once per district or charter school, as the dashboard counts them. Total compensation includes benefits and some pay for non-teaching roles; teaching pay alone averaged $${Math.round(CMP.teacher.instructionalMean).toLocaleString("en-US")}. USBE's statewide average teacher salary for ${CMP.teacher.usbeSalary.schoolYear}, salary only, was $${CMP.teacher.usbeSalary.mean.toLocaleString("en-US", { minimumFractionDigits: 2 })}. A scale, not a count of teachers who could be hired.` },
  { id: "classroom_supplies", label: "Teaching supplies money for one K-6 classroom teacher for a year (set in law)", amount: CMP.supplies.k6, unit: "units", unitLabel: "K-6 teachers' yearly supplies money", year: "FY2026 on", source: "Utah Code 53F-2-527(2) (version effective 2025-07-01)", note: `$${CMP.supplies.k6} for each classroom teacher position in pre-kindergarten special education and kindergarten through grade 6; $${CMP.supplies.grades7to12} for grades 7 through 12. If the appropriation falls short, the state board may reduce the amounts in proportion (subsection 3). Supplies and materials only, not a classroom's whole budget.` },
  { id: "trooper", label: "Ongoing yearly cost of one Highway Patrol trooper (2022 agency estimate)", amount: CMP.trooper.ongoing, unit: "units", unitLabel: "troopers' ongoing yearly cost", year: "FY2023", source: "Utah Highway Patrol, Bangerter Highway - Mountain View Corridor Resource Analysis / Proposal (2022), pp. 2-3, Cost Per Position Title", note: "The patrol's own estimate for a staffing proposal, in July 2022 prices, not an audited cost. Ongoing cost only; the one-time cost of a new position is left out. A scale, not a count of troopers who could be hired." },
  { id: "new_school", label: "One new district elementary school (one-time construction estimate)", amount: CMP.school.middleCost, unit: "units", unitLabel: "new elementary schools", oneTime: true, year: "FY2023-24", source: "Utah State Board of Education, School Plant Capital Outlay Reports 2023 and 2024", note: `A one-time cost set against a yearly amount, so the comparison is one school every so many years. The middle of the three new district elementary schools the two reports list: ${CMP.school.schools.map((s) => `${s.name} (${s.district}, $${(s.cost / 1e6).toFixed(1)}M)`).join(", ")}. Estimates from the districts' SP-4 forms, which the reports say are not final costs. No build time is given.` },
];

/** How many times a yearly amount covers a comparator, in words; a one-time cost reads as one every so many years. */
export function compareWords(amount: number, c: Comparator): string {
  const q = compare(amount, c);
  if (q === null) return "Not available";
  if (c.unit === "share") return `${(q * 100).toFixed(1)}% ${c.unitLabel}`;
  const n = (v: number, d: number) => v.toLocaleString("en-US", { maximumFractionDigits: d });
  if (!c.oneTime) return `about ${n(q, 0)} ${c.unitLabel}`;
  if (q === 0) return `no ${c.unitLabel}`;
  return q >= 1 ? `about ${n(q, 1)} ${c.unitLabel} a year` : `one every ${n(1 / q, 1)} years`;
}

/** Published findings that cut against this page's results, each read from the source on the date given. Searches
 *  that found nothing are recorded in docs/public-funding/qa/contrary-evidence.md. */
export const CONTRARY: { id: string; finding: string; against: string; differs: string; source: string; url: string; read: string }[] = [
  {
    id: "privatization_consumption",
    finding: "The Community Preventive Services Task Force recommends against further privatization of retail alcohol sales where government controls them, on strong evidence that privatization raises per capita consumption: a 44.4% median rise in per capita sales of the privatized beverage (17 studies), against a 2.2% median fall in beverages that stayed in state stores (9 studies).",
    against: "This page counts new purchases only as state revenue. It does not count the health, safety or enforcement costs of more drinking, and a grocery wine license privatizes part of wine retail.",
    differs: "The review covers many kinds of privatization, most before 2008; none is a design in which the state stays the wholesaler at today's shelf price.",
    source: "Community Preventive Services Task Force, Alcohol Excessive Consumption: Privatization of Retail Alcohol Sales (April 2011; 18 studies, search through October 2007)",
    url: "https://thecommunityguide.cdc.gov/findings/alcohol-excessive-consumption-privatization-retail-alcohol-sales.html",
    read: "2026-11-20",
  },
  {
    id: "washington_prices",
    finding: "After Washington privatized liquor in 2012, spirits prices rose an average of 15.5% for 750 ml bottles and 4.7% for 1.75 l bottles, while prices in Oregon and Idaho changed little. The authors conclude the new taxes and fees, set to replace the revenue the state store system had earned, were largely passed on to buyers.",
    against: "This page finds designs in which the shelf price need not change. Washington is a case where replacing the state's margin with fees raised prices.",
    differs: "Spirits, not wine; Washington ended state wholesaling and retailing together and charged new fees on sales. In the designs here DABS stays the wholesaler and the price is an input, not a forecast.",
    source: "Kerr, Williams and Greenfield, Analysis of Price Changes in Washington Following the 2012 Liquor Privatization, Alcohol and Alcoholism 50(6):654-660 (2015); 45 stores, about 68 brands",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC4608622/",
    read: "2026-11-20",
  },
  {
    id: "earmark_fungibility",
    finding: "Earmarks are partly fungible: of each lottery dollar earmarked for K-12 schools, 50 to 70 cents reached school districts, and the authors reject the idea that school spending rises dollar for dollar with the earmark.",
    against: "This page's \"programs kept whole\" test is about the deposit. A program's total funding also depends on what the Legislature does with its other money, so a deposit kept whole does not prove the program is (and a deposit lost would not prove it is cut).",
    differs: "Lottery profits in sixteen states, not alcohol revenue in Utah.",
    source: "Evans and Zhang, The Impact of Earmarked Lottery Revenue on K-12 Educational Expenditures, Education Finance and Policy 2(1):40-73 (2007)",
    url: "https://ideas.repec.org/a/tpr/edfpol/v2y2007i1p40-73.html",
    read: "2026-11-20",
  },
  {
    id: "washington_local_shares",
    finding: "Thirteen years after Washington's privatization, a 2025 Senate bill sought to restore liquor revenue distributions to local governments, replacing the amounts set under the 2012 law with shares of 10% to counties and 40% to cities and towns.",
    against: "A promise about who receives liquor money, written when the system changes, can be revisited by later legislatures. This page reads the earmarks in today's statutes; it cannot say how long a new guarantee would hold.",
    differs: "Local shares of all liquor revenue in Washington, not a school-meals deposit; the bill's outcome was not checked.",
    source: "Washington Senate Bill 5389 (2025 regular session; Senators Wagoner and J. Wilson; read first time 2025-01-21, referred to Ways & Means)",
    url: "https://lawfilesext.leg.wa.gov/biennium/2025-26/Pdf/Bills/Senate%20Bills/5389.pdf",
    read: "2026-11-20",
  },
];

// ----- Tennessee and Colorado beside Utah (devplan PPF-407) -------------------------------------------------------------
// Context only: nothing here enters fundingScenario(), and no difference between states is attributed to a law change.

export const COMPARISON_STATES = ["UT", "TN", "CO"] as const;
export type ComparisonState = (typeof COMPARISON_STATES)[number];
export const STATE_NAME: Record<ComparisonState | "US", string> = { UT: "Utah", TN: "Tennessee", CO: "Colorado", US: "United States" };
const GALLON_L = 3.785411784;
const BOTTLE_GAL = 0.75 / GALLON_L;

/** State tax or margin on one 750 ml bottle of wine: a fixed amount in Tennessee and Colorado, a share of the shelf price in Utah. */
export function stateTakePerBottle() {
  const S = PF.states;
  return { TN: S.tennessee.winePerGallon * BOTTLE_GAL, CO: S.colorado.winePerLiter * 0.75, coFee: S.colorado.wineDevelopmentFeePerLiter * 0.75, utPerDollar: T.margin };
}

export function stateComparison(): { id: string; label: string; values: Record<ComparisonState, string>; source: string }[] {
  const S = PF.states;
  const rule = (id: string) => PF.law.find((l) => l.rule_id === id)!;
  const markup = rule("UT-32B-2-304-2b"), meals = rule("UT-32B-2-304-5"), profit = rule("UT-32B-2-301-6");
  const b = stateTakePerBottle();
  const year = S.consumption.years[S.consumption.years.length - 1];
  const c = S.consumption.byState;
  const per = (v: number) => v.toFixed(3);
  const cts = (v: number) => `${(v * 100).toFixed(1)}¢`;
  return [
    {
      id: "wholesale",
      label: "Who sells wine to stores",
      values: { UT: "DABS, a state agency, for its own stores and package agencies", TN: "Private licensed wholesalers (a three-tier system)", CO: "Private licensed wholesalers" },
      source: `DABS annual report; ${S.tennessee.taxSource.edition}; ${S.colorado.source.edition}`,
    },
    {
      id: "retail",
      label: "Who sells wine to shoppers",
      values: {
        UT: "State stores and package agencies; no grocery store sells wine",
        TN: "Package stores and, from July 1, 2016, food stores in places whose voters approved them",
        CO: "Liquor stores and, from March 1, 2023, every beer retailer, grocery and convenience stores included",
      },
      source: `${S.tennessee.actSource.edition}; Colorado Proposition 125 (Other States page)`,
    },
    {
      id: "take",
      label: "How the state takes its share of wine",
      values: {
        UT: `A markup of at least ${(markup.rate! * 100).toFixed(1)}% on DABS's landed case cost, inside the shelf price (${markup.citation})`,
        TN: `$${S.tennessee.winePerGallon.toFixed(2)} a gallon, a state tax only, generally paid by wholesalers`,
        CO: `${(S.colorado.winePerLiter * 100).toFixed(2)}¢ a liter, plus a ${(S.colorado.wineDevelopmentFeePerLiter * 100).toFixed(1)}¢ wine development fee, paid by the maker or the first licensee to receive the wine`,
      },
      source: `${markup.source.edition}; ${S.tennessee.taxSource.edition}, ${S.tennessee.taxSource.locator}; ${S.colorado.source.locator}`,
    },
    {
      id: "bottle",
      label: "What the state collects on one 750 ml bottle",
      values: {
        UT: `DABS's gross margin, about ${Math.round(b.utPerDollar * 100)}¢ of every shelf dollar, before its own store costs (FY2025, all liquor)`,
        TN: `A tax of about ${cts(b.TN)}, whatever the price`,
        CO: `A tax of about ${cts(b.CO)}, plus ${(b.coFee * 100).toFixed(2)}¢ for the wine fund, whatever the price`,
      },
      source: "Computed: the rates above times 0.75 liter; Utah's from DABS's FY2025 statements",
    },
    {
      id: "store",
      label: "Does it depend on which store sells the bottle?",
      values: {
        UT: "Yes: the markup applies to wine sold by the department",
        TN: "No: it is paid at wholesale on each gallon sold in the state",
        CO: "No: it is paid at wholesale on each liter sold in the state",
      },
      source: "Read from the quotes above",
    },
    {
      id: "where",
      label: "Where that money goes",
      values: {
        UT: `${(meals.rate! * 100).toFixed(0)}% of gross liquor revenue to the Uniform School Fund for school meals (${meals.citation}); other deposits set by statute; net profit to the General Fund (${profit.citation})`,
        TN: "Not read: the department's manual gives the rate and who pays, not where the receipts go",
        CO: `${(S.colorado.pensionShare * 100).toFixed(0)}% of state liquor taxes and license fees to the old age pension fund, the rest to the general fund (C.R.S. 44-3-502(1)(a)); the wine fee to the Colorado wine industry development fund`,
      },
      source: `${meals.source.edition}; ${S.colorado.source.edition}`,
    },
    {
      id: "wine",
      label: `Wine bought per resident 21+, ${year} (gallons of ethanol)`,
      values: { UT: per(c.UT[year].wine), TN: per(c.TN[year].wine), CO: per(c.CO[year].wine) },
      source: `${S.consumption.source.edition}; United States ${per(c.US[year].wine)}`,
    },
    {
      id: "all",
      label: `All alcohol bought per resident 21+, ${year} (gallons of ethanol)`,
      values: { UT: per(c.UT[year].all), TN: per(c.TN[year].all), CO: per(c.CO[year].all) },
      source: `${S.consumption.source.edition}; United States ${per(c.US[year].all)}`,
    },
  ];
}

export function compare(amount: number, c: Comparator): number | null {
  if (c.amount === null || !(c.amount > 0) || !Number.isFinite(amount)) return null;
  return amount / c.amount;
}

// ----- the bill completeness checklist -----------------------------------------------------------------------------------------

export type ChecklistAnswer = "specified" | "missing" | "ambiguous" | "not_applicable";
export const CHECKLIST: { id: string; item: string; ask: string }[] = [
  { id: "scope", item: "Product and license scope", ask: "Which products (sealed wine only?), which retailers qualify, and what is excluded?" },
  { id: "collector", item: "Collector and legal taxpayer", ask: "Who collects the money and who is legally liable for it?" },
  { id: "rate", item: "Base and rate", ask: "What exact rate or formula applies, and to what base?" },
  { id: "base", item: "Taxable base convention", ask: "Is the base gross, wholesale or retail, and is sales tax included or excluded?" },
  { id: "admin", item: "Payment, reports, audits and records", ask: "When are payments due, what is reported, who audits, and how long are records kept?" },
  { id: "enforce", item: "Enforcement and sanctions", ask: "Which agency enforces it and what are the sanctions?" },
  { id: "meals", item: "School-meals transfer", ask: "Is the school-meals deposit restricted, on what base, and at what protected level?" },
  { id: "transfers", item: "Other transfers and the General Fund", ask: "Which other deposits continue, and how is the General Fund amount defined?" },
  { id: "dabs", item: "DABS transition liabilities", ask: "What happens to DABS's labor, leases, inventory, bonds and other transition costs?" },
  { id: "local", item: "Local sales-tax allocation", ask: "How are local sales taxes allocated, and under which jurisdiction rules?" },
  { id: "appropriations", item: "Appropriations, effective date and shortfalls", ask: "What is appropriated, when does it take effect, how is it phased in, and what covers a temporary shortfall?" },
  { id: "reporting", item: "Reporting, true-up and review", ask: "How often is it reported, how is it trued up, and is there a sunset or review date?" },
  { id: "underage", item: "Underage access and license conditions", ask: "What license conditions limit underage access, and what do compliance checks cost?" },
];

export function openQuestions(answers: Record<string, ChecklistAnswer | undefined>): { id: string; item: string; ask: string; answer: ChecklistAnswer | "unanswered" }[] {
  return CHECKLIST.filter((c) => answers[c.id] !== "specified" && answers[c.id] !== "not_applicable").map((c) => ({ ...c, answer: answers[c.id] ?? "unanswered" }));
}

// ----- education helpers ---------------------------------------------------------------------------------------------------------

export type Jurisdictions = "states" | "states_dc";

/** Ranks by current spending per pupil, highest first; ties share the better rank. D.C. only when asked for. */
export function spendingRanks(j: Jurisdictions) {
  const rows = PF.education.states.filter((s) => j === "states_dc" || s.isState).slice().sort((a, b) => b.ppcs - a.ppcs || a.name.localeCompare(b.name));
  return rows.map((s, i) => ({ ...s, rank: rows.findIndex((r) => r.ppcs === s.ppcs) + 1 || i + 1, of: rows.length }));
}

/** A value in fiscal-year-2024 dollars by the CPI-U fiscal-year average; null stays null (never zero, never interpolated). */
export function inFy2024Dollars(v: number | null, fy: string): number | null {
  const cpi = PF.education.cpi.byFiscalYear as Record<string, number>;
  if (v === null || !(fy in cpi)) return null;
  return (v * cpi["2024"]) / cpi[fy];
}

// ----- exports ------------------------------------------------------------------------------------------------------------------

type Dest = (typeof PF.dabs.destinations)[number];
type Bridge = (typeof PF.dabs.bridge)[number];
type Law = (typeof PF.law)[number];

export function observedCsv(): string {
  const rows: { table: string; id: string; label: string; amount: number; kind: string; statute: string; locator: string }[] = [
    ...PF.dabs.destinations.map((d: Dest) => ({ table: "destinations (p. 32)", id: d.id, label: d.label, amount: d.amount, kind: d.restricted ? "restricted" : "unrestricted", statute: d.statute ?? "not identified", locator: d.locator })),
    ...PF.dabs.bridge.map((b: Bridge) => ({ table: "income statement (p. 30)", id: b.id, label: b.label, amount: b.amount, kind: b.kind, statute: "", locator: PF.dabs.bridgeLocator })),
  ];
  const cols: Column<(typeof rows)[number]>[] = [
    { key: "fiscal_year", kind: "number", get: () => PF.dabs.fiscalYear },
    { key: "table", kind: "text", get: (r) => r.table },
    { key: "id", kind: "text", get: (r) => r.id },
    { key: "label", kind: "text", get: (r) => r.label },
    { key: "amount_usd", kind: "number", get: (r) => r.amount },
    { key: "kind", kind: "text", get: (r) => r.kind },
    { key: "statute", kind: "text", get: (r) => r.statute },
    { key: "source_asset", kind: "text", get: () => PF.dabs.source.asset },
    { key: "source_sha16", kind: "text", get: () => PF.dabs.source.sha16 },
    { key: "locator", kind: "text", get: (r) => r.locator },
    { key: "review_status", kind: "text", get: () => "machine-assisted transcription; not reviewed by a person" },
    { key: "method", kind: "text", get: () => PUBLIC_FUNDING_METHOD },
  ];
  return toCsv(cols, rows);
}

export function lawCsv(): string {
  const cols: Column<Law>[] = [
    { key: "rule_id", kind: "text", get: (r) => r.rule_id },
    { key: "citation", kind: "text", get: (r) => r.citation },
    { key: "title", kind: "text", get: (r) => r.title },
    { key: "effective_from", kind: "date", get: (r) => r.effective_from },
    { key: "effective_to", kind: "date", get: (r) => r.effective_to },
    { key: "status", kind: "text", get: (r) => r.status },
    { key: "transaction_scope", kind: "text", get: (r) => r.transaction_scope },
    { key: "collection_entity", kind: "text", get: (r) => r.collection_entity },
    { key: "remitter", kind: "text", get: (r) => r.remitter },
    { key: "calculation_base", kind: "text", get: (r) => r.calculation_base },
    { key: "rate", kind: "number", get: (r) => r.rate },
    { key: "rate_basis", kind: "text", get: (r) => r.rate_basis },
    { key: "beneficiary", kind: "text", get: (r) => r.beneficiary },
    { key: "restrictions", kind: "list", get: (r) => r.restrictions },
    { key: "quote", kind: "text", get: (r) => r.quote },
    { key: "source_asset", kind: "text", get: (r) => r.source.asset },
    { key: "source_sha16", kind: "text", get: (r) => r.source.sha16 },
    { key: "as_of", kind: "date", get: (r) => r.as_of },
    { key: "fy2025_version_effective", kind: "date", get: (r) => r.fy2025?.effective_from ?? null },
    { key: "fy2025_version_superseded", kind: "date", get: (r) => r.fy2025?.superseded ?? null },
    { key: "fy2025_same_quote", kind: "text", get: (r) => (r.fy2025 ? "yes" : "not checked: earlier version not found") },
    { key: "fy2025_source_asset", kind: "text", get: (r) => r.fy2025?.source.asset ?? null },
    { key: "machine_reviewed", kind: "bool", get: (r) => r.machine_reviewed },
    { key: "human_reviewed", kind: "bool", get: (r) => r.human_reviewed },
  ];
  return toCsv(cols, PF.law as unknown as Law[]);
}

export function educationCsv(): string {
  type Row = { geo: string; metric: string; period: number; period_kind: string; value: number | null; unit: string; status: string; source: string; sig: string };
  const rows: Row[] = [];
  for (const s of PF.education.states) {
    for (const [y, v] of Object.entries(s.series)) rows.push({ geo: s.usps, metric: "current_spending_per_pupil", period: Number(y), period_kind: "fiscal_year", value: v, unit: "usd_nominal", status: v === null ? "not_available" : "observed", source: PF.education.source.asset, sig: "" });
    for (const [k, a] of Object.entries(PF.education.naep)) {
      const r = (a.byJurisdiction as Record<string, { score: number; vsNation: string | null }>)[s.usps];
      rows.push({ geo: s.usps, metric: `naep_${k}_average_scale_score`, period: 2024, period_kind: "assessment_year", value: r ? r.score : null, unit: "scale_score", status: r ? "observed" : "not_available", source: a.source.asset, sig: r?.vsNation ?? "" });
    }
  }
  const cols: Column<Row>[] = [
    { key: "geo", kind: "text", get: (r) => r.geo },
    { key: "metric", kind: "text", get: (r) => r.metric },
    { key: "period", kind: "number", get: (r) => r.period },
    { key: "period_kind", kind: "text", get: (r) => r.period_kind },
    { key: "value", kind: "number", get: (r) => r.value },
    { key: "unit", kind: "text", get: (r) => r.unit },
    { key: "coverage_status", kind: "text", get: (r) => r.status },
    { key: "vs_national_public_nces_test", kind: "text", get: (r) => r.sig },
    { key: "source_asset", kind: "text", get: (r) => r.source },
  ];
  return toCsv(cols, rows);
}

export function scenarioJson(x: FundingInputs): string {
  const r = fundingScenario(x);
  return JSON.stringify(
    {
      schema_version: FUNDING_SCHEMA,
      model_version: PUBLIC_FUNDING_METHOD,
      engine: POLICY_DESIGNS_METHOD,
      base_year: PF.dabs.fiscalYear,
      law_as_of: PF.law[0].as_of,
      link: encodeScenario(x),
      inputs: x,
      input_classification: { price: "policy_choice", grocerMargin: "policy_choice", share: x.share === null ? "unmeasured" : "illustrative", additional: x.additional ? "illustrative" : "none", savings: x.savings === "none" ? "headline_rule" : "illustrative", distribution: "illustrative", routing: "policy_choice", fees: "policy_choice" },
      result: { net: r.net, netPerDollar: r.netPerDollar, programs: r.programs, rest: r.rest, conditions: r.conditions },
      missing_inputs: r.missing,
      sensitivity_method: "deterministic_range",
      notes: "Conditional on the stated inputs; not a forecast or a fiscal note. Machine-assisted; not reviewed by a person.",
    },
    null,
    1,
  );
}
