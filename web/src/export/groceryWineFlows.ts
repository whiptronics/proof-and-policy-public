// The purchase-flow tables (lib/wineFlows.ts, lib/wineFlowScenarios.ts) for the graph package. Called by
// groceryWine.ts, which writes them next to the alternatives' tables. Every number is computed by the dashboard's own
// modules; scripts/grocery_wine_flows_check.py recomputes the scenarios from flows.json with its own closed forms.
import { COST_LINES } from "../lib/wineAlternatives";
import {
  CONTAINER_L,
  DEFAULT_FLOWS,
  FLOW_ARRANGEMENTS,
  FLOW_ASSUMPTIONS,
  FLOW_BASE,
  FLOW_DATA,
  FLOW_PLACEHOLDERS,
  L_PER_GALLON,
  WINE_FLOWS_METHOD,
  arrangementTerms,
  type ArrangementTerms,
  type BreakEven,
  type Collections,
  type Costs,
  type FlowInputs,
  type FlowResult,
} from "../lib/wineFlows";
import {
  BREAK_EVEN_CONTEXTS,
  CONVENIENCE_LIMITS,
  HANDLING_HIGH,
  LEVER_ALCOHOL,
  LEVER_WORDS,
  NAMED_SCENARIOS,
  PARITY_MIGRATIONS,
  PRICE_PREMIUMS,
  RESTRUCTURING_PER_DOLLAR,
  STANDING_WORDS,
  SUBSTITUTION_SHARES,
  breakEvenTable,
  collectionFrontier,
  migrationFrontier,
  migrationGrid,
  migrationPriceGrid,
  scenarioRuns,
  sensitivityTable,
  substitutionGrid,
} from "../lib/wineFlowScenarios";
import { csvText, type Cell } from "./csv";

const pct = (v: number | null | undefined) => (v === null || v === undefined ? null : v * 100);

export const STATUS_WORDS: Record<BreakEven["status"], string> = {
  already_above: "At or above break-even with this lever at zero",
  found: "Break-even at the value shown",
  unattainable_in_range: "Still below break-even at the top of the tested range",
  wrong_direction: "Raising this lever lowers the state's net: no break-even",
  no_effect: "This lever changes nothing here (for example, nobody moves at this grocery price)",
};

const COLLECTION_KEYS: (keyof Collections)[] = ["dabsWineMarkup", "replacementCharge", "dabsSpiritsMarkup", "dabsHeavyBeerMarkup", "beerExcise", "salesTax", "licenseReceipts"];
const COLLECTION_WORDS: Record<keyof Collections, string> = {
  dabsWineMarkup: "DABS gross margin on wine (its markup, before operating costs)",
  replacementCharge: "Replacement charge on grocery wine (private supply)",
  dabsSpiritsMarkup: "DABS gross margin on spirits",
  dabsHeavyBeerMarkup: "DABS gross margin on heavy beer",
  beerExcise: "Beer excise",
  salesTax: "State sales tax on these beverages (state portion only)",
  licenseReceipts: "Grocery wine license receipts",
};
const COST_KEYS: (keyof Costs)[] = ["dabsVariableStoreCosts", "handling", "admin", "restructuringSavings"];
const COST_WORDS: Record<keyof Costs, string> = {
  dabsVariableStoreCosts: "DABS store costs that move with sales (card fees, agency contracts, bags)",
  handling: "DABS handling of wine supplied to grocers",
  admin: "New licensing and enforcement",
  restructuringSavings: "Longer-run DABS restructuring (a negative cost)",
};

const assumptionIds = (x: FlowInputs, a: ArrangementTerms) => {
  const ids = ["F01", "F02", "F03", "F04", "F11", "F13", "F14", "F16", "F19"];
  if (a.supply === "private" || a.grocerMarginShare !== null) ids.push("F18");
  if (x.convenienceLimit !== null) ids.push("F20");
  if (x.beer.participation * x.beer.intensity > 0) ids.push("F07", "F08", "F09", "F10", "F21");
  if (x.beer.heavyShare > 0) ids.push("F06", "F12");
  if (x.spirits.participation * x.spirits.intensity > 0) ids.push("F05", "F21");
  if (x.recapture.share > 0 || x.additional.share > 0) ids.push("F22");
  if (x.migrantResponse !== null) ids.push("F23");
  if (x.costs.restructuring > 0) ids.push("F15");
  if (x.costs.handling > 0) ids.push("F17");
  return [...new Set(ids)].sort().join(",");
};

const sumOf = (r: FlowResult, which: "baseline" | "proposed", beverage: string, f: "litres" | "pureAlcoholLitres" | "spending") =>
  r[which].cells.filter((c) => c.beverage === beverage).reduce((s, c) => s + c[f], 0);

export function flowFiles(commit: string, baseYear: string): Record<string, string> {
  const runs = scenarioRuns();
  const arrangements = [arrangementTerms("baseline"), ...FLOW_ARRANGEMENTS.map((id) => arrangementTerms(id))];

  // ----- arrangements -------------------------------------------------------------------------------------------------
  const arrRows: Cell[][] = [
    [
      "arrangement_id", "label", "short", "alternative_id", "supply", "collection_type", "state_collection_per_dollar_of_todays_price", "collection_base", "collected_from", "preserves_state_collection",
      "acquisition_per_dollar", "wholesaler_keeps_per_dollar", "grocer_keeps_per_dollar", "grocer_margin_pct_of_its_price", "shelf_price_per_dollar_before_sales_tax", "sales_tax_base_per_dollar",
      "consumer_price_change_pct_vs_state_store", "dabs_revenue_per_dollar_of_grocery_wine", "standing", "note", "method", "revision",
    ],
    ...arrangements.map((a) => [
      a.id, a.label, a.short, a.altId, a.supply, a.collection, a.stateCollection, a.chargeBase, a.collectedFrom, a.preservesCollection,
      a.acquisition, a.wholesalerKeeps, a.grocerKeeps, pct(a.grocerMarginShare), a.shelf, a.salesTaxBase,
      pct(a.consumerRatio - 1), a.dabsRevenuePerDollar, a.id === "baseline" ? "current law" : a.preservesCollection ? "proposed design, not current law" : "requires a change to the statutory markup or a new tax",
      a.note, WINE_FLOWS_METHOD, commit,
    ]),
  ];

  // ----- scenarios ----------------------------------------------------------------------------------------------------
  const scenarioRows: Cell[][] = [
    [
      "arrangement_id", "scenario_id", "standing", "scenario", "migration_at_equal_prices_pct", "convenience_limit_premium_pct", "grocery_premium_pct", "migration_used_pct",
      "declined_to_dabs_pct", "declined_to_beer_pct", "declined_outside_utah_pct", "declined_not_bought_pct",
      "beer_replaced_pct_of_household_beer", "beer_participation_pct", "beer_intensity_pct", "beer_weight", "beer_basis", "beer_heavy_share_pct", "beer_wine_at_grocers_pct",
      "spirits_replaced_pct_of_household_spirits", "spirits_participation_pct", "spirits_intensity_pct", "spirits_weight", "spirits_basis", "spirits_wine_at_grocers_pct",
      "recapture_pct_of_household_dabs_wine", "recapture_at_grocers_pct", "additional_pct_of_household_dabs_wine", "additional_at_grocers_pct", "migrant_price_elasticity",
      "variable_cost_per_dollar", "handling_cost_per_dollar", "new_administration_usd", "license_receipts_usd", "restructuring_per_dollar",
      "gross_collections_change_usd", "state_costs_change_usd", "net_change_usd",
      ...COLLECTION_KEYS.map((k) => `change_${k}_usd`), ...COST_KEYS.map((k) => `change_${k}_usd`),
      "grocery_wine_usd_at_state_store_prices", "grocery_wine_consumer_spending_usd", "grocery_wine_litres", "grocery_wine_bottles_750ml",
      "wine_bought_in_utah_litres_change", "beer_litres_change", "heavy_beer_litres_change", "spirits_litres_change",
      "pure_alcohol_in_utah_litres_change", "pure_alcohol_outside_utah_litres_change", "pure_alcohol_total_litres_change", "total_alcohol_unchanged",
      "consumer_spending_in_utah_change_usd", "wine_spending_outside_utah_change_usd_at_state_store_prices",
      "deposits_change_usd_counting_dabs_sales_to_grocers", "deposits_change_usd_not_counting_them", "reconciles", "assumption_ids", "method", "revision",
    ],
  ];
  for (const k of runs) {
    const r = k.result;
    const x = r.inputs;
    const grocery = r.proposed.cells.find((c) => c.beverage === "wine" && c.channel === "grocery")!;
    scenarioRows.push([
      k.arrangement.id, k.scenario.id, k.scenario.standing, k.scenario.label, pct(x.migration), pct(x.convenienceLimit), pct(r.premium), pct(r.migrationUsed),
      pct(x.declined.dabs), pct(x.declined.beer), pct(x.declined.outOfState), pct(x.declined.none),
      pct(x.beer.participation * x.beer.intensity * x.beer.weight), pct(x.beer.participation), pct(x.beer.intensity), x.beer.weight, x.beer.basis, pct(x.beer.heavyShare), pct(x.beer.grocery),
      pct(x.spirits.participation * x.spirits.intensity * x.spirits.weight), pct(x.spirits.participation), pct(x.spirits.intensity), x.spirits.weight, x.spirits.basis, pct(x.spirits.grocery),
      pct(x.recapture.share), pct(x.recapture.grocery), pct(x.additional.share), pct(x.additional.grocery), x.migrantResponse,
      x.costs.variable, x.costs.handling, x.costs.admin, x.costs.licenseReceipts, x.costs.restructuring,
      r.change.gross, r.change.costs, r.change.net,
      ...COLLECTION_KEYS.map((c) => r.change.collections[c]), ...COST_KEYS.map((c) => r.change.costsBy[c]),
      grocery.storeEquivalent, grocery.spending, grocery.litres, grocery.litres / CONTAINER_L.wine,
      sumOf(r, "proposed", "wine", "litres") - sumOf(r, "baseline", "wine", "litres"),
      sumOf(r, "proposed", "beer", "litres") - sumOf(r, "baseline", "beer", "litres"),
      sumOf(r, "proposed", "heavy_beer", "litres") - sumOf(r, "baseline", "heavy_beer", "litres"),
      sumOf(r, "proposed", "spirits", "litres") - sumOf(r, "baseline", "spirits", "litres"),
      r.alcohol.inUtah, r.alcohol.outsideUtah, r.alcohol.total, k.totalAlcoholUnchanged,
      r.spending.inUtah, r.spending.outsideUtah,
      r.change.deposits.countsGrocerSales, r.change.deposits.excludesGrocerSales, r.reconciles, assumptionIds(x, k.arrangement), WINE_FLOWS_METHOD, commit,
    ]);
  }

  // ----- before-and-after components ------------------------------------------------------------------------------------
  const compRows: Cell[][] = [["arrangement_id", "scenario_id", "kind", "component_id", "component", "government", "before_usd", "after_usd", "change_usd", "counted_in_net", "method", "revision"]];
  for (const k of runs) {
    const r = k.result;
    const row = (kind: string, id: string, label: string, b: number, a: number, counted: boolean) => compRows.push([k.arrangement.id, k.scenario.id, kind, id, label, "state", b, a, a - b, counted, WINE_FLOWS_METHOD, commit]);
    for (const c of COLLECTION_KEYS) row("collection", c, COLLECTION_WORDS[c], r.baseline.collections[c], r.proposed.collections[c], true);
    row("total", "gross_collections", "Gross state collections (sum of the collections)", r.baseline.gross, r.proposed.gross, true);
    for (const c of COST_KEYS) row("cost", c, COST_WORDS[c], r.baseline.costs[c], r.proposed.costs[c], true);
    row("total", "state_costs", "State costs modelled (sum of the costs)", r.baseline.costTotal, r.proposed.costTotal, true);
    row("total", "net_fiscal_contribution", "Net fiscal contribution: gross collections less costs", r.baseline.net, r.proposed.net, true);
    for (const [reading, key] of [["counting DABS's sales to grocers", "countsGrocerSales"], ["not counting them", "excludesGrocerSales"]] as const) {
      const b = r.baseline.deposits[key];
      const a = r.proposed.deposits[key];
      row("allocation", `school_deposit_${key}`, `School-meals deposit (10% of DABS gross revenue), ${reading}: an allocation, not added`, b.school, a.school, false);
      row("allocation", `enforcement_deposit_${key}`, `Enforcement deposit (1.695%), ${reading}: an allocation, not added`, b.enforcement, a.enforcement, false);
    }
  }

  // ----- decomposition ------------------------------------------------------------------------------------------------
  const lineRows: Cell[][] = [["arrangement_id", "scenario_id", "line_id", "line", "collections_gained_on_wine_usd", "collections_lost_on_what_it_replaces_usd", "net_change_usd", "method", "revision"]];
  for (const k of runs) for (const l of k.result.lines) lineRows.push([k.arrangement.id, k.scenario.id, l.id, l.label, l.wineGained, l.displacedLost, l.value, WINE_FLOWS_METHOD, commit]);

  const originRows: Cell[][] = [
    [
      "arrangement_id", "scenario_id", "origin_id", "origin", "grocery_usd_at_state_store_prices", "grocery_consumer_spending_usd", "grocery_litres", "grocery_bottles_750ml", "grocery_pure_alcohol_litres",
      "dabs_usd", "dabs_litres", "dabs_pure_alcohol_litres", "method", "revision",
    ],
  ];
  for (const k of runs) {
    for (const o of k.result.origins) {
      originRows.push([
        k.arrangement.id, k.scenario.id, o.id, o.label, o.grocery.storeEquivalent, o.grocery.spending, o.grocery.litres, o.grocery.litres / CONTAINER_L.wine, o.grocery.pureAlcoholLitres,
        o.dabs.storeEquivalent, o.dabs.litres, o.dabs.pureAlcoholLitres, WINE_FLOWS_METHOD, commit,
      ]);
    }
  }

  // ----- beverages by channel and buyer -------------------------------------------------------------------------------
  const bevRows: Cell[][] = [
    [
      "arrangement_id", "scenario_id", "beverage", "channel", "buyers", "litres_before", "litres_after", "litres_change", "pure_alcohol_litres_before", "pure_alcohol_litres_after", "pure_alcohol_litres_change",
      "spending_usd_before", "spending_usd_after", "spending_usd_change", "containers_change", "container", "method", "revision",
    ],
  ];
  const CHANNEL_WORDS: Record<string, string> = { dabs_store: "DABS stores and package agencies", grocery: "grocery stores", outside_utah: "outside Utah" };
  const B = FLOW_BASE;
  const licensee = { wine: B.wine.value * (1 - B.wine.household), spirits: B.spirits.value * (1 - B.spirits.household), heavy_beer: B.heavyBeer.value * (1 - B.heavyBeer.household) } as const;
  const priceOf = { wine: B.wine.price, spirits: B.spirits.price, heavy_beer: B.heavyBeer.price } as const;
  const abvOf = { wine: B.wine.abv, spirits: B.spirits.abv, heavy_beer: B.heavyBeer.abv, beer: B.beer.abv } as const;
  const containerOf = { wine: CONTAINER_L.wine, spirits: CONTAINER_L.spirits, heavy_beer: CONTAINER_L.beer, beer: CONTAINER_L.beer } as const;
  const containerWord = { wine: "750 ml bottles", spirits: "750 ml bottles", heavy_beer: "12-ounce cans", beer: "12-ounce cans" } as const;
  for (const k of runs) {
    const r = k.result;
    for (const before of r.baseline.cells) {
      const after = r.proposed.cells.find((c) => c.beverage === before.beverage && c.channel === before.channel)!;
      const bv = before.beverage;
      const push = (buyers: string, lb: number, la: number, pb: number, pa: number, sb: number, sa: number) =>
        bevRows.push([k.arrangement.id, k.scenario.id, bv, CHANNEL_WORDS[before.channel], buyers, lb, la, la - lb, pb, pa, pa - pb, sb, sa, sa - sb, (la - lb) / containerOf[bv], containerWord[bv], WINE_FLOWS_METHOD, commit]);
      if (before.channel === "dabs_store" && bv !== "beer") {
        // Licensees keep buying from DABS: their purchases are the same before and after.
        const lic = licensee[bv];
        const ll = lic / priceOf[bv];
        push("licensees (bars, restaurants, clubs)", ll, ll, ll * abvOf[bv], ll * abvOf[bv], lic, lic);
        push("households", before.litres - ll, after.litres - ll, before.pureAlcoholLitres - ll * abvOf[bv], after.pureAlcoholLitres - ll * abvOf[bv], before.spending - lic, after.spending - lic);
      } else if (bv === "beer") {
        push("all buyers outside DABS (households and licensees)", before.litres, after.litres, before.pureAlcoholLitres, after.pureAlcoholLitres, before.spending, after.spending);
      } else {
        push("households", before.litres, after.litres, before.pureAlcoholLitres, after.pureAlcoholLitres, before.spending, after.spending);
      }
    }
    const outL = r.alcohol.outsideUtah / B.wine.abv;
    bevRows.push([k.arrangement.id, k.scenario.id, "wine", CHANNEL_WORDS.outside_utah, "households", null, null, outL, null, null, r.alcohol.outsideUtah, null, null, r.spending.outsideUtah, outL / CONTAINER_L.wine, containerWord.wine, WINE_FLOWS_METHOD, commit]);
  }

  // ----- grids --------------------------------------------------------------------------------------------------------
  const subRows: Cell[][] = [
    ["arrangement_id", "beverage", "conversion_basis", "share_replaced_pct", "net_change_usd", "collections_gained_on_wine_usd", "collections_lost_on_replaced_beverage_usd", "wine_litres_bought_instead", "replaced_litres", "pure_alcohol_total_change_litres", "migration_pct", "method", "revision"],
    ...substitutionGrid().map((p) => [p.arrangement, p.beverage, p.basis, pct(p.share), p.net, p.wineGained, p.displacedLost, p.wineLitres, p.displacedLitres, p.alcoholChange, pct(DEFAULT_FLOWS.migration), WINE_FLOWS_METHOD, commit]),
  ];
  const priceRows: Cell[][] = [
    ["arrangement_id", "grocery_premium_pct", "convenience_limit_premium_pct", "migration_at_equal_prices_pct", "migration_used_pct", "net_change_usd", "grocer_margin_pct_of_its_price", "grocer_below_acquisition_cost", "state_collection_per_dollar", "shelf_price_per_dollar", "declined_purchases", "method", "revision"],
    ...migrationPriceGrid().map((p) => [
      p.arrangement, pct(p.premium), p.limit === null ? "none (fixed share)" : pct(p.limit), pct(p.migrationAtParity), pct(p.migrationUsed), p.net, pct(p.grocerMargin), p.grocerMargin !== null && p.grocerMargin < 0, p.stateCollection, p.shelf,
      "bought at DABS", WINE_FLOWS_METHOD, commit,
    ]),
  ];
  const migRows: Cell[][] = [
    ["arrangement_id", "household_share_pct", "migration_pct", "net_change_usd", "gross_collections_change_usd", "method", "revision"],
    ...migrationGrid().map((p) => [p.arrangement, pct(p.household), pct(p.migration), p.net, p.gross, WINE_FLOWS_METHOD, commit]),
  ];
  const beRows: Cell[][] = [
    ["arrangement_id", "context_scenario_id", "lever", "lever_meaning", "effect_on_alcohol", "status", "status_words", "break_even_pct", "net_change_at_context_usd", "net_change_lever_at_zero_usd", "net_change_lever_at_top_usd", "tested_top_pct", "net_change_at_break_even_usd", "method", "revision"],
    ...breakEvenTable().map((b) => [
      b.arrangement, b.context, b.lever, LEVER_WORDS[b.lever], LEVER_ALCOHOL[b.lever], b.status, STATUS_WORDS[b.status], pct(b.value), b.netAtContext, b.atLow, b.atHigh, pct(b.high), b.check, WINE_FLOWS_METHOD, commit,
    ]),
  ];
  const frontierRows: Cell[][] = [
    ["family", "arrangement_id", "x_kind", "x_value", "lever_setting_pct", "lever", "effect_on_alcohol", "status", "break_even_pct", "migration_pct", "method", "revision"],
    ...[...migrationFrontier(), ...collectionFrontier()].map((p) => [
      p.family, p.arrangement, p.xKind, p.xKind === "migration" ? pct(p.x) : p.x, pct(p.setting), p.lever, LEVER_ALCOHOL[p.lever], p.status, pct(p.value), p.xKind === "migration" ? pct(p.x) : pct(DEFAULT_FLOWS.migration), WINE_FLOWS_METHOD, commit,
    ]),
  ];
  const sensRows: Cell[][] = [
    ["arrangement_id", "context_scenario_id", "parameter_id", "parameter", "assumption_id", "low", "high", "net_change_base_usd", "net_change_at_low_usd", "net_change_at_high_usd", "swing_usd", "applies", "method", "revision"],
    ...sensitivityTable().map((s) => [
      s.arrangement, s.context, s.param.id, s.param.label, s.param.assumption, s.param.low, s.param.high, s.base, s.low, s.high, s.low === null || s.high === null ? null : Math.abs(s.high - s.low), s.low !== null, WINE_FLOWS_METHOD, commit,
    ]),
  ];
  const assumptionRows: Cell[][] = [
    ["assumption_id", "label", "value", "evidence", "source", "tested_range", "note"],
    ...FLOW_ASSUMPTIONS.map((a) => [a.id, a.label, a.value, a.evidence, a.source, a.range, a.note]),
  ];
  const paPerBottle = CONTAINER_L.wine * B.wine.abv;
  const conversionRows: Cell[][] = [
    ["quantity", "value", "unit", "source"],
    ["litres per US gallon", L_PER_GALLON, "litres", "definition"],
    ["litres per 9-litre case", 9, "litres", "definition"],
    ["wine bottle", CONTAINER_L.wine, "litres", "standard 750 ml"],
    ["beer can", CONTAINER_L.beer, "litres", "12 US fluid ounces"],
    ["wine ABV", B.wine.abv, "share", "NIAAA 2024, Utah"],
    ["beer ABV", B.beer.abv, "share", "NIAAA 2024, Utah"],
    ["spirits ABV", B.spirits.abv, "share", "NIAAA 2024, Utah"],
    ["heavy beer ABV", B.heavyBeer.abv, "share", "placeholder (F12)"],
    ["wine price at a state store", B.wine.price, "$ per litre before sales tax", "DABS FY2026 monthly reports (F02)"],
    ["spirits price at a state store", B.spirits.price, "$ per litre before sales tax", "DABS FY2026 monthly reports (F05)"],
    ["heavy beer price at a state store", B.heavyBeer.price, "$ per litre before sales tax", "DABS FY2026 monthly reports (F06)"],
    ["grocery beer price", B.beer.price, "$ per litre before sales tax", "placeholder (F09)"],
    ["beer excise", B.beer.excisePerLitre, "$ per litre", "placeholder (F10)"],
    ["pure alcohol in one bottle of wine", paPerBottle, "litres", "750 ml x wine ABV"],
    ["beer cans with the same pure alcohol as one bottle of wine", paPerBottle / (CONTAINER_L.beer * B.beer.abv), "cans", "derived"],
    ["spirits bottles with the same pure alcohol as one bottle of wine", paPerBottle / (CONTAINER_L.spirits * B.spirits.abv), "bottles", "derived"],
    ["wine litres per litre of beer at constant pure alcohol", B.beer.abv / B.wine.abv, "litres", "derived"],
    ["wine litres per litre of spirits at constant pure alcohol", B.spirits.abv / B.wine.abv, "litres", "derived"],
  ];

  const json = {
    generated_at: new Date().toISOString(),
    project_commit: commit,
    method: WINE_FLOWS_METHOD,
    base_year: baseYear,
    question:
      "Where would wine sold in Utah grocery stores come from (wine households now buy at DABS, beer, spirits, purchases made outside Utah, additional purchases), and what does each source do to the state's collections, costs and net fiscal contribution?",
    standing:
      "Arithmetic on stated inputs. The shares of switching, recapture and additional buying have no Utah source: the scenarios and grids are illustrative ranges, not forecasts or confidence intervals. The arithmetic being checked does not validate any behavioural assumption.",
    units: {
      money: "US dollars a year, nominal FY2025",
      wine_at_state_store_prices: "dollars of wine valued at today's state-store shelf price before sales tax (the alternatives' unit)",
      spending: "consumer spending before sales tax at the price actually paid",
      litres: "litres of beverage a year",
      pure_alcohol: "litres of pure (ethanol) alcohol a year: litres x ABV",
      per_dollar: "per $1 of today's state-store shelf price before sales tax",
      shares: "percent in CSV files; fractions in this JSON",
    },
    sign_convention: "change = proposed - baseline; positive means more for the state",
    government_scope: "State of Utah only. Local sales tax and local licensing are not modelled.",
    data: FLOW_DATA,
    placeholders: FLOW_PLACEHOLDERS,
    base: FLOW_BASE,
    containers_litres: CONTAINER_L,
    litres_per_gallon: L_PER_GALLON,
    cost_lines_per_dollar: COST_LINES,
    restructuring_per_dollar: RESTRUCTURING_PER_DOLLAR,
    handling_high_per_dollar: HANDLING_HIGH,
    arrangements,
    default_inputs: DEFAULT_FLOWS,
    standing_words: STANDING_WORDS,
    scenarios: NAMED_SCENARIOS.map((s) => ({ id: s.id, label: s.label, standing: s.standing, note: s.note, inputs: s.inputs })),
    results: runs.map((k) => ({
      arrangement: k.arrangement.id,
      scenario: k.scenario.id,
      migration_used: k.result.migrationUsed,
      premium: k.result.premium,
      change: k.result.change,
      baseline_net: k.result.baseline.net,
      proposed_net: k.result.proposed.net,
      lines: k.result.lines,
      origins: k.result.origins,
      displaced: k.result.displaced,
      alcohol: k.result.alcohol,
      spending: k.result.spending,
      total_alcohol_unchanged: k.totalAlcoholUnchanged,
      reconciles: k.result.reconciles,
    })),
    grids: {
      substitution_shares: SUBSTITUTION_SHARES,
      price_premiums: PRICE_PREMIUMS,
      convenience_limits: CONVENIENCE_LIMITS,
      parity_migrations: PARITY_MIGRATIONS,
      break_even_contexts: BREAK_EVEN_CONTEXTS,
    },
    break_even_status_words: STATUS_WORDS,
    lever_words: LEVER_WORDS,
    lever_alcohol: LEVER_ALCOHOL,
    assumptions: FLOW_ASSUMPTIONS,
    survey_note:
      "S01: 23% of beer-preferring U.S. respondents aged 21-39 already drink wine weekly or more (Wine Opinions, July 2022, n = 631). This is existing overlap, not a Utah figure, not a switching rate, not an effect of grocery availability and not a share of beer sales. It is cited, not used as a parameter.",
    not_modelled: [
      "Local sales tax and local licensing",
      "Health, safety and enforcement outcomes beyond the stated administration cost",
      "Licensee (bar and restaurant) purchases: they stay with DABS in every flow",
      "Competitive price responses by DABS, and changes in the mix of wines bought",
      "Any estimated channel-choice or substitution model: none exists for Utah",
    ],
  };

  return {
    "flows.json": JSON.stringify(json, null, 1),
    "flows_arrangements.csv": csvText(arrRows),
    "flows_scenarios.csv": csvText(scenarioRows),
    "flows_components.csv": csvText(compRows),
    "flows_lines.csv": csvText(lineRows),
    "flows_origins.csv": csvText(originRows),
    "flows_beverages.csv": csvText(bevRows),
    "flows_substitution_grid.csv": csvText(subRows),
    "flows_migration_price_grid.csv": csvText(priceRows),
    "flows_migration_grid.csv": csvText(migRows),
    "flows_break_even.csv": csvText(beRows),
    "flows_break_even_frontier.csv": csvText(frontierRows),
    "flows_sensitivity.csv": csvText(sensRows),
    "flows_assumptions.csv": csvText(assumptionRows),
    "flows_conversions.csv": csvText(conversionRows),
  };
}

/** Problems that must stop the export: any scenario that does not reconcile. */
export function flowProblems(): string[] {
  return scenarioRuns()
    .filter((k) => !k.result.reconciles)
    .map((k) => `${k.arrangement.id}/${k.scenario.id}`);
}
