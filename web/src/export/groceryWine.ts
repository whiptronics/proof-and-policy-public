// Export of the Utah grocery-wine alternatives for the graph package (Node only; not part of the dashboard bundle).
// Every number is computed here by the dashboard's own modules (lib/wineAlternatives.ts on lib/scenario.ts and
// lib/arrangements.ts, laid out by lib/wineAccounting.ts); scripts/grocery_wine_graphs.py only draws them and
// scripts/grocery_wine_alternatives_check.py recomputes them independently.
//
// Run from web/:  npm run export:grocery-wine [-- <extra output folder>]
// Writes data/processed/grocery-wine/ (gitignored) and any extra folder given.
import { execSync } from "node:child_process";
import { join, resolve } from "node:path";
import { ARRANGEMENTS_METHOD } from "../lib/arrangements";
import { SCENARIO_METHOD } from "../lib/scenario";
import { SUBSTITUTION_METHOD } from "../lib/substitution";
import { WINE_ACCOUNTING_METHOD, type Ledger, type StackColumn } from "../lib/wineAccounting";
import {
  ALTERNATIVES,
  COST_LINES,
  ELASTICITY,
  MISSING_CAPABILITIES,
  RETAILER_TARGET,
  WHOLESALER_MARGIN,
  WINE_ALTERNATIVES_METHOD,
  alternativeById,
  alternativesReport,
  distributorMargin,
  costCases,
  sweepLever,
  type AltResult,
  type SweepRow,
} from "../lib/wineAlternatives";
import { PRODUCER_DIRECT_METHOD, directReport } from "../lib/producerDirect";
import { BASKET, CONVENIENCE_LIMITS, HYBRID_DABS_SHARE, HYBRID_EXTRA_ADMIN_SHARE, POLICY_DESIGNS_METHOD, SAVINGS_CASES, UTAH_GROCERY_ESTABLISHMENTS, defaultDesignsReport, type DesignResult } from "../lib/policyDesigns";
import { PRICE_SHARE_METHOD, POSITION_WORDS, priceShareReport, type GridArrangement, type GridCell } from "../lib/winePriceShare";
import { csvText, writeAll, type Cell } from "./csv";
import { flowFiles, flowProblems } from "./groceryWineFlows";

const ROOT = resolve(__dirname, "..", "..", "..", "..");
const OUT = [join(ROOT, "data", "processed", "grocery-wine"), ...process.argv.slice(2).map((p) => resolve(p))];
const commit = (() => {
  try {
    return execSync("git rev-parse --short HEAD", { cwd: ROOT }).toString().trim() + (execSync("git status --porcelain web/src scripts", { cwd: ROOT }).toString().trim() ? " (with uncommitted changes)" : "");
  } catch {
    return "unknown";
  }
})();
const BASE_YEAR = "FY2025 (DABS fiscal year to 2025-06-30); wine share from FY2026 monthly reports";

const rep = alternativesReport();
const OLD = { R1: -12_105_857.99, R2: -7_315_463.58 }; // the brief's published results (2026-10-17)

const inputsOf = (a: AltResult) => {
  const x = a.built.x;
  return {
    wine_sales: x.wineSales,
    wine_gallons: x.wineGallons,
    gross_margin: x.grossMargin,
    state_sales_tax: x.salesTax,
    household_share: x.eligible,
    share_moving: x.shift,
    avoided_cost_per_dollar: x.avoidableCost,
    avoided_short_run: a.fixed.ledger.lines.find((l) => l.id === "savings_short_run")!.value! / Math.max(1e-9, rep.movedDollars * ((x.shift ?? 0) / 0.3)),
    new_costs: x.newCosts,
    handling_cost_per_dollar: x.handlingCost ?? 0,
    revenue_mode: x.revenueMode,
    matched_price: !!x.matchPrice,
    price_before_charge: a.fixed.result.priceBeforeTax,
    shelf_price: a.fixed.result.priceRatioUsed,
    discount: x.revenueMode === "wholesale" ? (x.discount ?? 0) : null,
    charge_rate_on_price: x.revenueMode === "percent" ? (x.adValorem ?? 0) : null,
    charge_per_gallon: x.revenueMode === "excise" ? (x.excise ?? 0) : null,
    charge_in_sales_tax_base: x.chargeInSalesTax !== false,
    wholesaler_margin: distributorMargin(a.def),
    retailer_margin_target: RETAILER_TARGET,
    deposit_rates: { school: 0.1, enforcement: 0.01695 },
  };
};

const ledgerJson = (l: Ledger) => ({ basis: l.basis, lines: l.lines, net: l.net, engine_net: l.engineNet, reconciles: l.reconciles, unaffected: l.unaffected, allocations: l.allocations, volume: l.volume });

const altJson = (a: AltResult) => ({
  id: a.def.id,
  group: a.def.group,
  label: a.def.label,
  short: a.def.short,
  supply: a.def.supply,
  pricing: a.def.pricing,
  preserves: a.def.preserves,
  defines: a.def.defines,
  savings_case: a.def.savings,
  lever: a.lever,
  inputs: inputsOf(a),
  price_stack: a.fixed.stack,
  ledger_fixed: ledgerJson(a.fixed.ledger),
  ledger_fixed_no_deposits_on_grocer_sales: a.fixed.ledgerOtherReading ? ledgerJson(a.fixed.ledgerOtherReading) : null,
  retailer: a.retailer,
  demand: a.demand.map((d) => ({ id: d.id, label: d.label, kind: d.kind, net: d.net, delta: d.delta, grocery_factor: d.groceryFactor, note: d.note, lines: d.ledger?.lines ?? null, reconciles: d.ledger ? d.ledger.reconciles : true })),
  demand_additive: a.demandAdditive,
  beer_threshold: a.beer.threshold,
  beer_per_gallon: a.beer.perGallon,
  legal: a.legal,
  zero_savings_net: a.zeroSavings.net,
  reconciliation: a.reconciliation,
  headline: a.headline,
});

const json = {
  generated_at: new Date().toISOString(),
  project_commit: commit,
  base_year: BASE_YEAR,
  units: "US dollars a year, nominal FY2025; per-unit values per $1 of today's state-store shelf price before checkout taxes",
  methods: { alternatives: WINE_ALTERNATIVES_METHOD, accounting: WINE_ACCOUNTING_METHOD, scenario: SCENARIO_METHOD, arrangements: ARRANGEMENTS_METHOD, substitution: SUBSTITUTION_METHOD },
  assumptions: rep.assumptions,
  cost_lines_per_dollar: COST_LINES,
  elasticity: ELASTICITY,
  moved_dollars: rep.movedDollars,
  baseline_wine_revenue: rep.baselineWineRevenue,
  missing_capabilities: MISSING_CAPABILITIES,
  reference_check: Object.fromEntries(
    (["R1", "R2"] as const).map((id) => {
      const a = rep.results.find((r) => r.def.id === id)!;
      return [id, { published: OLD[id], now: a.fixed.ledger.net, unchanged: Math.abs(a.fixed.ledger.net - OLD[id]) < 0.01 }];
    }),
  ),
  alternatives: rep.results.map((a) => altJson(a)),
  sweeps: {
    discount_matched: sweepLever(alternativeById("B20_matched"), "discount", 0, 0.5, 100),
    discount_target: sweepLever(alternativeById("B20_target"), "discount", 0, 0.5, 100),
    charge_matched: sweepLever(alternativeById("C20_matched"), "charge", 0, 1.5, 150),
    charge_target: sweepLever(alternativeById("C_take"), "charge", 0, 1.5, 150),
  },
  cost_cases: Object.fromEntries(["A_target", "B20_matched", "B20_target", "C_take", "C20_matched"].map((id) => [id, costCases(alternativeById(id))])),
};

// ----- CSV tables ---------------------------------------------------------------------------------------------------
const pct = (v: number | null | undefined) => (v === null || v === undefined ? null : v * 100);
const summary: Cell[][] = [
  [
    "alternative_id", "group", "label", "supply", "pricing", "preserves", "discount_pct_of_todays_price", "charge_rate_pct_of_price_before_charge", "charge_pct_of_price_including_charge", "charge_usd_per_gallon",
    "consumer_price_change_pct_vs_state_store", "retailer_margin_pct_of_its_selling_price", "retailer_target_pct", "meets_target", "state_change_fixed_volume_usd", "dabs_trading_margin_change_usd", "state_charge_usd",
    "state_sales_tax_change_usd", "short_run_savings_usd", "conditional_savings_usd", "new_administration_usd", "new_handling_usd", "funds_change_usd_deposits_on_grocer_sales", "funds_change_usd_no_deposits_on_grocer_sales",
    "other_state_funds_change_usd", "state_change_price_response_usd", "state_change_return_to_stores_usd", "reconciles", "assumption_ids", "headline",
    "state_change_no_avoidable_cost_usd", "state_tax_change_usd", "avoidable_costs_usd", "new_costs_usd",
    "wholesaler_and_grocer_keep_per_dollar_of_todays_price", "wholesaler_and_grocer_keep_pct_of_their_price", "grocer_below_acquisition_cost_under_split", "arithmetic_only", "seller_note",
  ],
];
const line = (a: AltResult, id: string) => a.fixed.ledger.lines.find((l) => l.id === id)?.value ?? null;
for (const a of rep.results) {
  const ch = a.fixed.stack.charge;
  summary.push([
    a.def.id, a.def.group, a.def.label, a.def.supply, a.def.pricing, a.def.preserves, a.def.supply === "dabs" ? pct(a.lever.discount) : null, pct(ch?.rateOnBase ?? null), pct(ch?.shareOfPriceWithCharge ?? null), ch?.perGallon ?? null,
    pct(a.fixed.stack.consumerChange), pct(a.retailer.marginShare), pct(RETAILER_TARGET), a.retailer.meetsTarget, a.fixed.ledger.net, line(a, "dabs_trading_margin"), line(a, "state_charge"),
    line(a, "state_sales_tax"), line(a, "savings_short_run"), line(a, "savings_conditional"), line(a, "new_administration"), line(a, "new_handling"), a.fixed.ledger.allocations.funds, a.fixed.ledgerOtherReading?.allocations.funds ?? a.fixed.ledger.allocations.funds,
    a.fixed.ledger.allocations.others, a.demand.find((d) => d.id === "price_constant")!.net, a.demand.find((d) => d.id === "return_to_stores")!.net, a.fixed.ledger.reconciles, a.def.savings === "reference" ? "U01-U06,U14,U16,U17" : "U01-U16", a.headline,
    a.zeroSavings.net, a.reconciliation.taxes.total, a.reconciliation.avoidableCosts, a.reconciliation.newCosts,
    a.retailer.sellersTogether, pct(a.retailer.sellersTogetherShare), a.retailer.belowCost.grocer, a.retailer.arithmeticOnly, a.retailer.note,
  ]);
}
const ledgerRows: Cell[][] = [["alternative_id", "basis", "line_id", "label", "kind", "change_usd_per_year"]];
for (const a of rep.results) {
  for (const l of a.fixed.ledger.lines) ledgerRows.push([a.def.id, "fixed_volume", l.id, l.label, l.kind, l.value]);
  ledgerRows.push([a.def.id, "fixed_volume", "net", "Statewide change (sum of the lines)", "total", a.fixed.ledger.net]);
  for (const d of a.demand) if (d.ledger) for (const l of d.ledger.lines) ledgerRows.push([a.def.id, d.id, l.id, l.label, l.kind, l.value]);
}
const stackRows: Cell[][] = [["alternative_id", "column", "row", "per_dollar_of_todays_pretax_price"]];
const ROWS: (keyof StackColumn)[] = ["acquisition", "dabsMargin", "wholesaleMargin", "retailerMargin", "chargeInPrice", "chargeAbsorbed", "shelf", "salesTaxBase", "stateSalesTax", "localSalesTax", "consumer"];
for (const a of rep.results) for (const col of ["today", "after"] as const) for (const r of ROWS) stackRows.push([a.def.id, col, r, a.fixed.stack[col][r] as number | null]);
const demandRows: Cell[][] = [["alternative_id", "case_id", "kind", "label", "state_change_usd", "change_vs_fixed_volume_usd", "grocery_wine_factor", "note"]];
for (const a of rep.results) for (const d of a.demand) demandRows.push([a.def.id, d.id, d.kind, d.label, d.net, d.delta, d.groceryFactor, d.note]);
const sweepRows = (rows: SweepRow[], lever: string): Cell[][] => [
  [lever, "state_change_fixed_volume_usd", "consumer_price_change_pct", "retailer_margin_pct_of_its_selling_price", "private_sellers_and_grocer_keep_per_dollar_of_todays_price", "funds_change_usd_deposits_on_grocer_sales", "funds_change_usd_no_deposits_on_grocer_sales"],
  ...rows.map((r) => [r.v * 100, r.net, pct(r.consumerChange), pct(r.retailerShare), r.sellersPerDollar, r.funds, r.fundsOther]),
];
const costRows: Cell[][] = [["alternative_id", "case_id", "label", "standing", "state_change_fixed_volume_usd"]];
for (const [id, rows] of Object.entries(json.cost_cases)) for (const r of rows) costRows.push([id, r.id, r.label, r.standing, r.net]);
const assumptionRows: Cell[][] = [["assumption_id", "label", "value", "standing", "note"], ...rep.assumptions.map((s) => [s.id, s.label, s.value, s.standing, s.note])];
const legalRows: Cell[][] = [["alternative_id", "item", "status", "text", "citation"]];
for (const a of rep.results) for (const l of a.legal) legalRows.push([a.def.id, l.item, l.status, l.text, l.cite]);

// ----- grocery price premium x grocery share (lib/winePriceShare.ts) ---------------------------------------------------
const ps = priceShareReport();
const arrOf = (id: string) => ps.arrangements.find((a) => a.id === id)!;
const leverPct = (a: GridArrangement) => a.lever.value * 100;
const idsFor = (a: GridArrangement, savings: GridCell["savings"], volume: GridCell["volume"]) =>
  ["U01", "U02", "U03", "U05", "U06", ...(savings === "source_based" ? ["U07"] : []), "U10", "U11", "U12", ...(a.supply === "private" ? ["U13"] : []), "U14", ...(volume === "price_response" ? ["U15"] : [])].join(",");
const priceOf = (id: string, premium: number) => ps.prices.find((k) => k.arrangement === id && Math.abs(k.premium - premium) < 1e-12)!;
const gridRows: Cell[][] = [
  [
    "arrangement_id", "arrangement", "supply", "lever", "lever_pct", "savings_case", "volume_basis", "price_premium_pct", "channel_share_pct_of_covered_household_purchases",
    "moved_household_purchases_usd", "grocery_wine_usd_at_state_store_prices", "state_change_usd", "protected_funds_change_usd", "protected_funds_change_no_deposits_on_grocer_sales_usd",
    "other_state_funds_change_usd", "grocer_margin_pct_of_its_price", "seller_position", "reconciles", "assumption_ids", "method", "revision",
  ],
];
for (const k of ps.cells) {
  const a = arrOf(k.arrangement);
  const pt = priceOf(k.arrangement, k.premium);
  gridRows.push([
    a.id, a.label, a.supply, a.lever.kind, leverPct(a), k.savings, k.volume, k.premium * 100, k.share * 100,
    k.movedDollars, k.groceryDollars, k.net, k.funds, k.fundsOtherReading,
    k.others, pct(pt.grocerMargin), pt.position, k.reconciles, idsFor(a, k.savings, k.volume), PRICE_SHARE_METHOD, commit,
  ]);
}
const priceRows: Cell[][] = [
  [
    "arrangement_id", "price_premium_pct", "engine_entered_price_per_dollar_of_todays_price", "shelf_price_per_dollar_before_checkout_taxes", "state_charge_per_dollar",
    "wholesaler_margin_pct_of_its_price", "grocer_margin_pct_of_its_price", "sellers_together_per_dollar_of_todays_price", "sellers_together_pct_of_their_price",
    "grocer_below_acquisition_cost", "sellers_together_below_acquisition_cost", "seller_position", "seller_position_words", "method", "revision",
  ],
  ...ps.prices.map((k) => [
    k.arrangement, k.premium * 100, k.priceRatio, k.shelf, k.chargePerDollar, pct(k.wholesalerMargin), pct(k.grocerMargin), k.sellersTogether, pct(k.sellersTogetherShare),
    k.belowCost.grocer, k.belowCost.sellersTogether, k.position, POSITION_WORDS[k.position], PRICE_SHARE_METHOD, commit,
  ]),
];
const shareBeRows: Cell[][] = [
  ["arrangement_id", "savings_case", "volume_basis", "price_premium_pct", "break_even_share_pct_of_covered_household_purchases", "status", "note", "method", "revision"],
  ...ps.shareBreakEvens.map((b) => [b.arrangement, b.savings, b.volume, b.premium * 100, b.share === null ? null : b.share * 100, b.status, b.note, PRICE_SHARE_METHOD, commit]),
];
const premiumBeRows: Cell[][] = [
  [
    "arrangement_id", "savings_case", "volume_basis", "channel_share_pct", "receipts_preserved", "from_premium_pct", "to_premium_pct", "grocer_margin_pct_at_from", "seller_position_at_from",
    "grocer_margin_pct_at_to", "seller_position_at_to", "search_limit_premium_pct", "method", "revision",
  ],
];
for (const b of ps.preserved) {
  if (!b.ranges.length) premiumBeRows.push([b.arrangement, b.savings, b.volume, b.share * 100, false, null, null, null, null, null, null, 100, PRICE_SHARE_METHOD, commit]);
  for (const r of b.ranges)
    premiumBeRows.push([
      b.arrangement, b.savings, b.volume, b.share * 100, true, r.from * 100, r.to === null ? null : r.to * 100, pct(r.fromPoint.grocerMargin), r.fromPoint.position,
      pct(r.toPoint?.grocerMargin ?? null), r.toPoint?.position ?? null, 100, PRICE_SHARE_METHOD, commit,
    ]);
}
const markerRows: Cell[][] = [
  ["arrangement_id", "premium_pct_grocer_at_acquisition_cost", "premium_pct_sellers_together_at_acquisition_cost", "premium_pct_grocer_margin_at_reference", "reference_margin_pct", "method", "revision"],
  ...ps.markers.map((k) => [k.arrangement, pct(k.grocerCost), pct(k.sellersCost), pct(k.reference), RETAILER_TARGET * 100, PRICE_SHARE_METHOD, commit]),
];
const refRows: Cell[][] = [
  ["alternative_id", "arrangement_id", "price_premium_pct", "channel_share_pct", "alternative_state_change_usd", "grid_state_change_usd", "alternative_no_savings_usd", "grid_no_savings_usd", "matches", "method", "revision"],
  ...ps.references.map((r) => [r.altId, r.arrangement, r.premium * 100, r.share * 100, r.net, r.gridNet, r.zeroSavingsNet, r.gridZeroSavingsNet, r.matches, PRICE_SHARE_METHOD, commit]),
];
const priceShareJson = {
  generated_at: new Date().toISOString(),
  project_commit: commit,
  base_year: BASE_YEAR,
  method: PRICE_SHARE_METHOD,
  methods_used: { alternatives: WINE_ALTERNATIVES_METHOD, accounting: WINE_ACCOUNTING_METHOD, scenario: SCENARIO_METHOD, arrangements: ARRANGEMENTS_METHOD },
  question: "How do state fiscal change and seller compensation vary with the grocery price premium and the share of existing household wine purchases moving to grocery stores?",
  standing: "A conditional sensitivity grid: not a forecast, not a channel-choice model, no probabilities. Nothing here says shoppers would pay any premium or that any share would move at it.",
  units: {
    money: "US dollars a year, nominal FY2025",
    price_premium_pct: "consumer price at a grocer against the same bottle at a state store today, state sales tax included on both, in percent",
    channel_share_pct: "percent of covered baseline household wine purchases",
    per_dollar: "per $1 of today's state-store shelf price before checkout taxes",
    margins: "gross margin as a percent of the seller's own selling price, before its own costs (not profit)",
  },
  denominator: {
    definition: ps.axes.share.definition,
    covered_household_purchases_usd: ps.denominator.coveredHousehold,
    wine_sales_usd: ps.denominator.wineSales,
    household_share: ps.denominator.householdShare,
  },
  axes: ps.axes,
  roles: ps.roles,
  arrangements: ps.arrangements,
  savings_cases: ps.savingsWords,
  volume_bases: ps.volumeWords,
  new_costs_usd: ps.newCosts,
  handling_cost_per_dollar: ps.handlingCost,
  handling_note: "Unknown: zero is a placeholder (U11).",
  reference_margin: RETAILER_TARGET,
  wholesaler_margin: WHOLESALER_MARGIN,
  assumptions: ps.assumptions,
  colour_limit_usd: ps.colourLimit,
  prices: ps.prices,
  cells: ps.cells.map(({ ledger: l, ...k }) => ({ ...k, lines: l.lines })),
  share_break_evens: ps.shareBreakEvens,
  receipts_preserved_at_worked_share: ps.preserved,
  markers: ps.markers,
  references: ps.references,
};

const files: Record<string, string> = {
  "alternatives.json": JSON.stringify(json, null, 1),
  "alternatives_summary.csv": csvText(summary),
  "alternatives_ledger.csv": csvText(ledgerRows),
  "alternatives_price_stack.csv": csvText(stackRows),
  "demand_sensitivity.csv": csvText(demandRows),
  "sweep_discount_matched.csv": csvText(sweepRows(json.sweeps.discount_matched, "discount_pct")),
  "sweep_discount_retailer_target.csv": csvText(sweepRows(json.sweeps.discount_target, "discount_pct")),
  "sweep_charge_matched.csv": csvText(sweepRows(json.sweeps.charge_matched, "charge_rate_pct_of_price_before_charge")),
  "sweep_charge_sellers_margins.csv": csvText(sweepRows(json.sweeps.charge_target, "charge_rate_pct_of_price_before_charge")),
  "cost_cases.csv": csvText(costRows),
  "assumptions.csv": csvText(assumptionRows),
  "legal_notes.csv": csvText(legalRows),
  "price_share.json": JSON.stringify(priceShareJson, null, 1),
  "price_share_grid.csv": csvText(gridRows),
  "price_share_prices.csv": csvText(priceRows),
  "price_share_break_even_share.csv": csvText(shareBeRows),
  "price_share_receipts_preserved.csv": csvText(premiumBeRows),
  "price_share_markers.csv": csvText(markerRows),
  "price_share_references.csv": csvText(refRows),
  ...flowFiles(commit, BASE_YEAR),
};
// The list of files this run wrote, so that a reader of the folder (scripts/grocery_wine_graphs.py) can tell them
// from files an older version left behind.
// Producer-direct supply (scenario D): its own file, in the alternatives' shape, so the independent check recomputes it
// the same way; the 13 alternatives above are unchanged by it.
const dr = directReport();
files["producer_direct.json"] = JSON.stringify(
  {
    generated_at: new Date().toISOString(),
    project_commit: commit,
    base_year: BASE_YEAR,
    units: json.units,
    methods: { producer_direct: PRODUCER_DIRECT_METHOD, ...json.methods },
    assumptions: dr.assumptions,
    elasticity: ELASTICITY,
    reference_check: {},
    alternatives: [dr.main, ...dr.grid.map((c) => c.result)].map((a) => ({ ...altJson(a), direct: a.def.direct })),
  },
  null,
  1,
);
files["producer_direct_grid.csv"] = csvText([
  ["producer_cost_share_pct_of_its_price", "producer_premium_pct_over_dabs_cost", "combined_margin_pct_of_grocer_cost", "consumer_price_change_pct_vs_state_store", "grocer_margin_pct_of_its_price", "state_change_fixed_volume_usd", "state_charge_usd", "state_sales_tax_change_usd", "main_case"],
  ...dr.grid.map((c): Cell[] => [
    pct(c.costShare),
    pct(c.producerPremium),
    pct(c.margin),
    pct(c.result.fixed.stack.consumerChange),
    pct(c.result.retailer.marginShare),
    c.result.fixed.ledger.net,
    line(c.result, "state_charge"),
    line(c.result, "state_sales_tax"),
    c.result.def.id === dr.main.def.id,
  ]),
]);
// Policy design comparison (the five arrangements A-E): read from the alternatives above, never a second engine. The
// independent check (scripts/policy_designs_check.py) recomputes its closed forms from this file's terms.
const pd = defaultDesignsReport();
const pdNet = (r: DesignResult, s: string, l: number | null) => r.cases.find((c) => c.savings === s && c.limit === l)!.net;
files["policy_designs.json"] = JSON.stringify(
  {
    generated_at: new Date().toISOString(),
    project_commit: commit,
    base_year: BASE_YEAR,
    methods: { policy_designs: POLICY_DESIGNS_METHOD, producer_direct: PRODUCER_DIRECT_METHOD, ...json.methods },
    units: "$ a year at FY2025 prices; prices and margins per $1 of today's state-store shelf price before sales tax; premiums against a state store, sales tax included on both",
    savings_cases: SAVINGS_CASES,
    convenience_limits: CONVENIENCE_LIMITS,
    basket: BASKET,
    hybrid: { dabs_share: HYBRID_DABS_SHARE, extra_admin_share: HYBRID_EXTRA_ADMIN_SHARE },
    grocery_establishments: UTAH_GROCERY_ESTABLISHMENTS,
    review_status: "Not reviewed by a person. Scripts recompute the arithmetic; nothing here is a fiscal note.",
    ...pd,
  },
  (_k, v) => (typeof v === "number" && !Number.isFinite(v) ? null : v),
  1,
);
files["policy_designs_summary.csv"] = csvText([
  ["design", "label", "path", "engine_alternative", "consumer_price_change_pct_vs_state_store", "grocer_margin_pct_of_its_price", "state_take_structure", "distribution_margin_pct", "state_change_no_savings_fixed_share_usd", "state_change_no_savings_limit_60_usd", "state_change_no_savings_limit_30_usd", "state_change_allocated_savings_fixed_share_usd", "min_premium_at_28pct_grocer_margin_no_savings_pct", "min_share_moving_to_break_even_no_savings_pct", "classification", "reason"],
  ...pd.results.map((r): Cell[] => [
    r.def.id,
    r.def.label,
    r.def.path,
    r.def.engine,
    pct(r.premium),
    r.grocerMargin === null ? null : pct(r.grocerMargin),
    r.structure,
    r.distribution === null ? null : pct(r.distribution),
    pdNet(r, "none", null),
    pdNet(r, "none", 0.6),
    pdNet(r, "none", 0.3),
    pdNet(r, "allocated", null),
    Number.isFinite(r.breakEven.minPremiumAtReference.none) ? pct(r.breakEven.minPremiumAtReference.none) : null,
    r.breakEven.minShift.none === null ? null : pct(r.breakEven.minShift.none),
    pd.classification[r.def.id].verdict,
    pd.classification[r.def.id].reason,
  ]),
]);
files["policy_designs_cases.csv"] = csvText([
  ["design", "savings_case", "convenience_limit_pct", "share_of_household_purchases_moving_pct", "wine_moved_usd", "state_change_usd", "state_change_with_fees_covering_administration_usd", "state_gross_receipts_today_usd", "state_gross_receipts_after_usd"],
  ...pd.results.flatMap((r) => r.cases.map((c): Cell[] => [r.def.id, c.savings, c.limit === null ? "fixed share" : pct(c.limit), pct(c.shift), c.moved, c.net, c.netWithFees, c.gross.today, c.gross.after])),
]);
files["policy_designs_flows.csv"] = csvText([
  ["design", "when", "party", "label", "per_dollar_of_todays_price", "usd_per_year_on_wine_moved", "kept_by_state"],
  ...pd.results.flatMap((r) => (["today", "after"] as const).flatMap((w) => r.flows[w].map((f): Cell[] => [r.def.id, w, f.party, f.label, f.perDollar, f.annual, f.state]))),
]);
files["policy_designs_basket.csv"] = csvText([
  ["design", "bottle", "landed_cost_usd", "state_store_price_with_sales_tax_usd", "grocery_price_with_sales_tax_usd", "standing"],
  ...pd.results.filter((r) => r.def.id !== "A").flatMap((r) => r.basket.map((b): Cell[] => [r.def.id, b.label, b.landed, b.stateStore, b.grocery, "illustrative price point, not a product"])),
]);
files["policy_designs_frontier.csv"] = csvText([
  ["consumer_price_change_pct_vs_state_store", "max_grocer_margin_take_in_wholesale_price_pct", "max_grocer_margin_retail_charge_wholesaler_margin_pct", "max_grocer_margin_retail_charge_no_distribution_cost_pct", "max_grocer_margin_take_in_wholesale_price_allocated_savings_pct", "max_grocer_margin_retail_charge_wholesaler_margin_allocated_savings_pct"],
  ...pd.frontier.map((p): Cell[] => [pct(p.premium), pct(p.wholesalePrice), pct(p.retailChargeReference), pct(p.retailChargeNoDistribution), pct(p.wholesalePriceAllocated), pct(p.retailChargeReferenceAllocated)]),
]);
files["policy_designs_direct.csv"] = csvText([
  ["producer_cost_share_pct", "producer_premium_pct", "consumer_price_change_pct_vs_state_store", "state_change_no_savings_fixed_share_usd", "state_change_no_savings_limit_30_usd"],
  ...pd.direct.map((d): Cell[] => [pct(d.costShare), pct(d.producerPremium), pct(d.premium), d.net, d.netLimit30]),
]);
files["policy_designs_criteria.csv"] = csvText([["criterion", "kind", "A", "B", "C", "D", "E"], ...pd.criteria.map((c): Cell[] => [c.label, c.kind, c.cells.A, c.cells.B, c.cells.C, c.cells.D, c.cells.E])]);
files["export_files.json"] = JSON.stringify({ generated_at: new Date().toISOString(), project_commit: commit, files: Object.keys(files).sort() }, null, 1);
writeAll(OUT, files);
console.log(`policy designs: ${pd.results.length} arrangements, Pareto ${pd.pareto.join(", ")}, selected ${pd.selected.id ?? "none"} (${POLICY_DESIGNS_METHOD})`);
const bad = rep.results.filter((a) => !a.fixed.ledger.reconciles || !a.demandAdditive || a.demand.some((d) => d.ledger && !d.ledger.reconciles));
console.log(`grocery-wine export: ${rep.results.length} alternatives, commit ${commit}, written to ${OUT.join(" and ")}`);
console.log(`producer-direct supply: main case and ${dr.grid.length} grid cells (${PRODUCER_DIRECT_METHOD})`);
if ([dr.main, ...dr.grid.map((c) => c.result)].some((a) => !a.fixed.ledger.reconciles)) {
  console.error("producer-direct supply: a ledger does not reconcile");
  process.exit(1);
}
if (bad.length) {
  console.error(`ledger does not reconcile for: ${bad.map((a) => a.def.id).join(", ")}`);
  process.exit(1);
}
const gridBad = ps.cells.filter((k) => !k.reconciles).length + ps.references.filter((r) => !r.matches).length;
console.log(`price-and-share grid: ${ps.cells.length} cells, ${ps.references.length} reference points (${PRICE_SHARE_METHOD})`);
if (gridBad) {
  console.error(`price-and-share grid: ${gridBad} cells or reference points do not reconcile`);
  process.exit(1);
}
if (!json.reference_check.R1.unchanged || !json.reference_check.R2.unchanged) {
  console.error("the historical references no longer reproduce the published results");
  process.exit(1);
}
const flowBad = flowProblems();
console.log(`purchase flows: ${flowBad.length ? `${flowBad.length} scenarios do not reconcile` : "every scenario reconciles"}`);
if (flowBad.length) {
  console.error(`purchase flows do not reconcile: ${flowBad.join(", ")}`);
  process.exit(1);
}
void ALTERNATIVES;
