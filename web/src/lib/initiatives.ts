// Focused initiative pages (view `initiative`): one policy change in one state, presented as a short brief. Each
// initiative is data: the proposal, the advocate's stated goal kept apart from the analysis, the worked example's
// inputs, and the open questions. The figures are computed from the same models as the scenario tool
// (lib/arrangements.ts, lib/substitution.ts), and the scenario inputs are read from the worked proposal's own address
// fields (lib/scenario.ts WORKED_PROPOSALS), as the tool reads them. The page runs without the metric files, so the
// few base-year dataset values it needs are copied into `worked.data`; initiatives.data.test.ts checks them against
// the exported dataset whenever web/public/data is present. Other states are added by adding an entry here; the view
// reads nothing state-specific.
import {
  arrangementInputs,
  compare,
  enteredMechanisms,
  settingsFromFields,
  solveLever,
  withMechanisms,
  type ArrangementSettings,
  type Bounds,
  type Comparison,
  type JointRow,
} from "./arrangements";
import { compute, WORKED_PROPOSALS, type DepositRates, type ScenarioInputs } from "./scenario";
import { substitution, type SubstitutionInputs, type SubstitutionResult } from "./substitution";
import { marginOfMarkup, STATUTORY_MARKUP } from "./wineMargin";

export const INITIATIVE_METHOD = "initiative-brief@1.0";

export interface SourceRef {
  label: string;
  /** Where in the source: page, table, row or section. */
  where: string;
  url?: string;
}

export interface Initiative {
  id: string;
  state: string;
  title: string;
  /** Last reviewed date of the page's text (not of its figures, which are computed). */
  asOf: string;
  status: string;
  /** The advocate's goal, in the advocate's name: not an analytical finding. */
  advocacy: { who: string; goal: string };
  proposal: string[];
  /** The worked example: the worked proposal whose address fields give the scenario inputs and the comparison's
   * settings, the base year's dataset values, deposit rates, and the substitution what-if. */
  worked: {
    proposalId: string;
    data: WorkedData;
    rates: DepositRates;
    swap: SubstitutionInputs;
    assumptions: { item: string; value: string; basis: "source" | "assumption" | "policy" }[];
  };
  choices: { question: string; options: string }[];
  questions: { who: string; ask: string }[];
  unresolved: string[];
  sources: SourceRef[];
}

/** Base-year values from the exported dataset that the scenario tool reads for the worked proposal (ScenarioView
 * facts and boundsFor), copied because the page runs without the metric files. All transcribed, not reviewed. */
export interface WorkedData {
  fy: number;
  /** DABS liquor sales and gross profit (ut_dabs_liquor_sales_revenue, ut_dabs_gross_profit). */
  sales: number;
  grossProfit: number;
  /** NIAAA wine gallons, the latest calendar year ending in or before the fiscal year. */
  wineGallons: number;
  wineGallonsYear: number;
  /** DABS expense lines in the base year ($): card fees, package agency contracts, bags, salaries and wages, delivery to
   * stores, and total operating expenses (income statement, p. 30; the p. 32 five-year summary labels the same figure
   * "Operating and Non-Operating Expenses", hence the dataset's ut_dabs_operating_nonoperating_expenses). They give the
   * documented bounds of the avoidable cost. `nonOperating` is the income statement's non-operating expenses,
   * amortization and depreciation plus interest on bonds and notes (p. 30). It is not in the exported dataset, so the
   * data test cannot check it (transcribed 2026-10-17, not reviewed), and the audited ACFR reports different amounts
   * for the fund (depreciation 5,331 and interest 2,422 thousand). Neither is a cost that stops when sales move. */
  expenses: { card: number; agency: number; bags: number; wages: number; delivery: number; total: number; nonOperating: number };
  /** Lowest and highest all-product gross margin DABS reported over the dataset's years. */
  marginRange: { low: number; high: number; lowYear: number; highYear: number };
  /** Wine's composition in DABS's twelve FY2026 monthly Sales Analysis Reports, as shares of the wine classes'
   * gross sales (scripts/dabs_wine_class_mix.py): red, white, rosé and small-package still wine; and hard cider, which
   * the model keeps out of wine but Utah Code § 32B-1-102(143) counts as wine. */
  wineMix: { stillTable: number; ciderOverWine: number };
}

const FY2025_SALES = 551_346_000;
const FY2025_GROSS_PROFIT = 260_289_000;

export const INITIATIVES: Initiative[] = [
  {
    id: "ut_grocery_wine",
    state: "state:49",
    title: "Utah: sealed wine in qualifying grocery stores",
    asOf: "2026-10-17",
    status: "Draft for review. Scripts recompute the arithmetic, and an AI assistant checked the source values against the documents cited; no person has reviewed them yet, and nothing here is a fiscal note.",
    advocacy: {
      who: "Ethan Whipple, who maintains this project,",
      goal: "supports changing Utah Code Title 32B so that qualifying grocery stores may sell sealed wine to take home. The analysis below is kept separate from that goal and reports results that weaken the case as well as results that help it.",
    },
    proposal: [
      "Licensed grocery stores that meet set standards could sell sealed wine to take home. State liquor stores and package agencies would keep selling everything they sell now.",
      "The bill would have to choose who supplies the wine to grocers and how the state collects on it. The two structures the model compares are private wholesalers with a state replacement tax, and DABS as the only wholesaler selling to grocers at a discount. DABS supply would also need a change to the 88.5% minimum wine markup in Utah Code § 32B-2-304(2).",
      "Beer, spirits, restaurants and bars are unchanged.",
    ],
    worked: {
      proposalId: "compare_fy2025",
      data: {
        fy: 2025,
        sales: FY2025_SALES,
        grossProfit: FY2025_GROSS_PROFIT,
        wineGallons: 3_297_940,
        wineGallonsYear: 2024,
        expenses: { card: 8_403_000, agency: 3_474_000, bags: 680_000, wages: 41_432_000, delivery: 5_767_000, total: 81_910_000, nonOperating: 17_469_000 + 602_000 },
        marginRange: { low: 235_239_000 / 517_390_000, high: FY2025_GROSS_PROFIT / FY2025_SALES, lowYear: 2021, highYear: 2025 },
        wineMix: { stillTable: 141_949_120.54 / 182_331_954.71, ciderOverWine: 3_875_021.12 / 182_331_954.71 },
      },
      rates: { school: 0.1, enforcement: 0.01695 },
      swap: { swap: 0, grocery: 1, beerPrice: 12, beerTax: 13.35, wineAbv: 0.118, beerAbv: 0.048, beerGallons: 26_660_000 },
      assumptions: [
        { item: "DABS liquor sales, FY2025", value: "$551.3 million, listed separately from sales tax (annual report, p. 32)", basis: "source" },
        { item: "Gross margin", value: "47.2%: DABS's all-product gross profit over sales, applied to wine", basis: "assumption" },
        { item: "Wine's share of sales", value: "33.5%, summed by product class from the FY2026 monthly reports; the FY2025 report shows 33% ($184.1 million)", basis: "source" },
        { item: "Households' share of wine purchases", value: "82%, DABS's FY2025 all-product off-premise share (annual report, p. 18)", basis: "assumption" },
        { item: "Household purchases that move to grocers", value: "30%", basis: "assumption" },
        { item: "Grocery prices", value: "the same as state-store prices (matched)", basis: "assumption" },
        { item: "Replacement tax (private structure)", value: "20% of the sellers' price", basis: "policy" },
        { item: "DABS discount to grocers (wholesale structure)", value: "20% off the shelf price", basis: "policy" },
        { item: "Store cost avoided", value: "5 cents per dollar that moves", basis: "assumption" },
        { item: "New licensing and enforcement cost", value: "$500,000 a year", basis: "assumption" },
        { item: "School-meals and enforcement deposits", value: "10% and 1.695% of total gross revenue from liquor sales (Utah Code §§ 32B-2-304(5), 32B-2-305(4))", basis: "source" },
        { item: "Sellers' average margins", value: "28.0% for grocers and 29.5% for alcohol wholesalers, of their own sales (Census, 2022, national, all products)", basis: "assumption" },
      ],
    },
    choices: [
      { question: "Who supplies grocers?", options: "Private wholesalers with a replacement tax, or DABS as the only wholesaler." },
      { question: "What should the bill protect?", options: "Only the school-meals and enforcement funds, or total state revenue as well." },
      { question: "How is a school-meals guarantee paid for?", options: "From the new wine proceeds, with the General Fund covering any shortfall; fixed or tied to the sales actually lost." },
      { question: "Which stores qualify?", options: "Size, licensing, staff training and compliance standards." },
    ],
    questions: [
      { who: "DABS", ask: "Wine sales to bars and restaurants versus other buyers, wherever the sale is made, FY2023-FY2025." },
      { who: "DABS", ask: "The realized markup and gross margin on wine alone, not all products." },
      { who: "DABS", ask: "Which operating costs would fall for each dollar of wine sales that leaves state stores." },
      { who: "Legislative General Counsel", ask: "Would DABS's sales to grocers count as \"total gross revenue from sales of liquor\" for the school-meals and enforcement deposits, and would DABS supply need the 88.5% markup floor changed?" },
      { who: "Legislative Fiscal Analyst", ask: "Liquor money's share of school-meal funding, by year and with its denominator." },
      { who: "Legislative Fiscal Analyst", ask: "How a fiscal note would treat sales moving between channels, price responses and substitution." },
      { who: "Tax Commission", ask: "Whether local sales tax is collected on state-store sales as it would be at grocers, and whether DABS's sales to bars and restaurants carry sales tax." },
    ],
    unresolved: [
      "No wine-specific margin, customer split or avoidable-cost figure has been published; each is an assumption above.",
      "DABS's FY2025 report lists sales separately from sales tax but, unlike earlier reports, has no note saying sales exclude it. The model applies the 4.85% state sales tax to all DABS wine sales; if sales to bars and restaurants are untaxed, today's revenue from wine is about $1.6 million lower and the net changes are the same.",
      "The audited fund's FY2023-FY2024 revenue sits about $16 million below DABS's figures. It is unexplained and does not enter the FY2025 example.",
      "The claim that alcohol pays for half of school lunch is not supported by the sources found: in FY2024 liquor money was about $50 million against over $322 million of federal money, about 13% of the two combined. It appears to be nearly all of the state's own share.",
      "Whether total drinking would change, and whether people would buy wine instead of beer, is unmeasured for Utah.",
    ],
    sources: [
      { label: "DABS 90th Annual Report (FY2025)", where: "p. 32, Five Year Financial Summary; p. 18, on-/off-premise chart; p. 19, sales by type" },
      { label: "DABS monthly Sales Analysis Reports", where: "July 2025 to June 2026, total gross sales and wine classes" },
      { label: "Utah Code § 32B-2-304 (version effective 2026-03-13)", where: "(2)(b) wine markup; (5) school-meals deposit", url: "https://le.utah.gov/xcode/Title32B/Chapter2/C32B-2-S304_2026031320260313.pdf" },
      { label: "Utah Code § 32B-2-305 (version effective 2024-05-01)", where: "(4) enforcement deposit" },
      { label: "Utah State Tax Commission, Publication 25 and combined rate tables", where: "Pub. 25 p. 6, Chart 2; FY2025 quarterly rate tables (state rate 4.85%)" },
      { label: "Office of Legislative Research and General Counsel, School Meals Programs (rev. 2025-01-16)", where: "pp. 2 and 6", url: "https://le.utah.gov/interim/2025/pdf/School_Meals_Programs.pdf" },
      { label: "Legislative Fiscal Analyst, fiscal note on 1st Sub. S.B. 180 (2026)", where: "state school-meal funding comes from liquor sales", url: "https://pf.utleg.gov/public-web/sessions/2026GS/fiscal-notes/SB0180S01.fn.html" },
      { label: "NIAAA Surveillance Report 124 data", where: "Utah wine and beer gallons and ABV, 2024" },
      { label: "Census Annual Wholesale and Retail Trade Surveys, 2022", where: "gross margin as a percent of sales, NAICS 4248 and 4451" },
      { label: "Nelson (2013), Health Economics Review 3:17", where: "wine price elasticity −0.46" },
      { label: "Hahn et al. (2012), American Journal of Preventive Medicine 42(4)", where: "retail privatization review" },
    ],
  },
];

export function initiativeById(id: string | null | undefined): Initiative | null {
  return INITIATIVES.find((i) => i.id === id) ?? null;
}

export interface InitiativeFigures {
  /** The worked proposal's address fields: the scenario tool opens the example from them. */
  values: Record<string, string>;
  settings: ArrangementSettings;
  /** The scenario inputs the tool would build from those fields and the base year's dataset values. */
  inputs: ScenarioInputs;
  comparison: Comparison;
  /** Today's state revenue from wine (margin plus state sales tax) and the wine that moves, $ a year. */
  baseline: number;
  moved: number;
  /** The two funds' deposits on the wine that moves today. */
  school: number;
  enforcement: number;
  substitution: { private: SubstitutionResult; wholesale: SubstitutionResult };
  /** What would have to be true for each structure to break even (initiative-robustness@1.0). */
  robustness: Robustness;
}

/** A worked proposal's scenario inputs, read from its address fields as the scenario tool reads them (ScenarioView,
 * wine as a share of DABS sales), with the base year's dataset values for what the fields leave out. */
export function proposalInputs(values: Record<string, string>, data: WorkedData): ScenarioInputs {
  const num = (k: string): number | null => {
    const s = values[k] ?? "";
    if (s.trim() === "") return null;
    const v = Number(s.replace(/[$,\s]/g, ""));
    return Number.isFinite(v) ? v : null;
  };
  const pct = (k: string) => {
    const v = num(k);
    return v === null ? null : v / 100;
  };
  const extra = values.b === "1";
  const share = pct("ws");
  return {
    wineSales: share === null ? null : share * data.sales,
    wineGallons: num("gal") ?? data.wineGallons,
    grossMargin: pct("gm") ?? data.grossProfit / data.sales,
    salesTax: pct("st"),
    avoidableCost: pct("vc"),
    newCosts: num("nc"),
    shift: pct("s"),
    eligible: pct("hh"),
    priceRatio: pct("r"),
    revenueMode: (values.rm || "keep") as ScenarioInputs["revenueMode"],
    retained: pct("rho"),
    excise: num("exc"),
    adValorem: pct("av"),
    discount: pct("dc"),
    extra,
    growth: pct("g"),
    extraGrocery: pct("q"),
    substitution: false,
    replaces: null,
    basis: null,
    beerPrice: null,
    beerTax: null,
    wineAbv: null,
    beerAbv: null,
    elasticity: extra ? num("el") : null,
    passThrough: pct("pt"),
    recapture: extra ? pct("rc") : null,
  };
}

/** The base year's documented bounds (ScenarioView boundsFor), from the copied expense lines. */
export function workedBounds(data: WorkedData): Bounds {
  const e = data.expenses;
  return {
    avoidLow: (e.card + e.agency + e.bags) / data.sales,
    avoidHigh: (e.card + e.agency + e.bags + e.wages) / data.sales,
    avoidCeiling: e.total / data.sales,
    delivery: e.delivery / data.sales,
    marginLow: data.marginRange.low,
    marginHigh: data.marginRange.high,
  };
}

/** The worked example's figures, from the scenario tool's own models. */
export function initiativeFigures(init: Initiative): InitiativeFigures {
  const p = WORKED_PROPOSALS.find((w) => w.id === init.worked.proposalId);
  if (!p) throw new Error(`Unknown worked proposal ${init.worked.proposalId}`);
  const settings = settingsFromFields((k) => p.values[k]);
  const x = proposalInputs(p.values, init.worked.data);
  const comparison = compare(x, settings, init.worked.rates, init.worked.data.expenses.total / init.worked.data.sales);
  const moved = (x.wineSales ?? 0) * (x.eligible ?? 1) * (x.shift ?? 0);
  const sub = {
    private: substitution(x, settings, "private", init.worked.swap, init.worked.rates),
    wholesale: substitution(x, settings, "wholesale", init.worked.swap, init.worked.rates),
  };
  return {
    values: p.values,
    settings,
    inputs: x,
    comparison,
    baseline: comparison.private.lines?.baselineRevenue ?? NaN,
    moved,
    school: init.worked.rates.school * moved,
    enforcement: init.worked.rates.enforcement * moved,
    substitution: sub,
    robustness: robustness(init, x, settings),
  };
}

// ----- what would have to be true (initiative-robustness@1.0) ---------------------------------------------------------
//
// One input moved at a time, the others as in the worked example; then the comparison's own joint scenarios on the
// documented bounds. Every value comes from the scenario tool's model (lib/scenario compute through the comparison's
// arrangement inputs, lib/arrangements compare and jointScenarios). Ranges are labelled by what supports them:
// "evidence" (saved sources or the dataset), "statute" (a legal reference point, not a measured value) or
// "illustrative" (no evidence; the scenario tool's convention or a stated policy span, shown to see how far the
// result moves). No probabilities: nothing here says how likely a value is.

export const ROBUSTNESS_METHOD = "initiative-robustness@1.0";

/** The small-maker markup in Utah Code § 32B-2-304(3)(c) (49% above landed case cost, for makers who apply). */
export const SMALL_MAKER_MARKUP = 0.49;

export type RangeBasis = "evidence" | "statute" | "illustrative";
export type Standing = "observed" | "derived" | "chosen" | "policy";

export interface Pair {
  private: number;
  wholesale: number;
}

/** One input over a tested range: the net change at each end, in each structure. */
export interface SizeRow {
  id: string;
  label: string;
  standing: Standing;
  entered: number;
  low: number;
  high: number;
  basis: RangeBasis;
  why: string;
  format: "percent" | "money" | "scale";
  atLow: Pair;
  atHigh: Pair;
  /** Where the net change would reach zero as this input alone moves (null: never, in either direction). */
  zero: { private: number | null; wholesale: number | null };
}

export interface JointNet {
  id: "favourable" | "unfavourable" | "ceiling";
  standing: JointRow["standing"];
  net: Pair;
  /** The lever at which each structure breaks even in that scenario: the replacement tax, the DABS discount. */
  breakEven: { private: number | null; wholesale: number | null };
}

export interface Robustness {
  /** The worked example's net change, and what sellers may keep for the state to break even at matched prices. */
  net: Pair;
  keepAtBreakEven: number;
  /** Net change per $1 of state-store sales that moves, before the fixed new costs: the sign of the result. */
  perDollar: Pair;
  rows: SizeRow[];
  /** Arrangement 2 under current law: the largest discount that keeps DABS's price to grocers at or above the 88.5%
   * minimum wine markup, at the example's margin (a legal reading by Claude, not reviewed). */
  lawfulDiscount: number;
  /** Three of the comparison's joint scenarios (lib/arrangements jointScenarios: the documented bounds at each end,
   * and every operating expense avoidable), computed the same way without the full comparison per row. */
  joint: JointNet[];
  /** An extreme arithmetic comparison, not an attainable saving: the ceiling row again with the income statement's
   * non-operating depreciation and interest also treated as avoidable (`expenses.nonOperating`). The avoidable cost per
   * dollar of sales and the net change in each structure. */
  ceilingAllExpenses: { avoid: number; net: Pair };
  /** The margin implied by the 88.5% minimum markup and by the 49% small-maker markup. */
  statuteMargins: { floor: number; smallMaker: number };
  bounds: Bounds;
}

function nets(x: ScenarioInputs, set: ArrangementSettings): Pair {
  const on = enteredMechanisms(x);
  const one = (id: "private" | "wholesale") => {
    const r = compute(withMechanisms(arrangementInputs(x, set, id), on, x));
    return r.netB ?? r.netA;
  };
  return { private: one("private"), wholesale: one("wholesale") };
}

/** The favourable, unfavourable and ceiling rows of jointScenarios (same inputs; initiatives.test.ts checks they agree). */
export function jointNets(x: ScenarioInputs, set: ArrangementSettings, b: Bounds): JointNet[] {
  const one = (id: JointNet["id"], standing: JointNet["standing"], bx: ScenarioInputs, sx: ArrangementSettings): JointNet => ({
    id,
    standing,
    net: nets(bx, sx),
    breakEven: {
      private: solveLever((v) => nets(bx, { ...sx, taxRate: v }).private, 0, 1).root,
      wholesale: solveLever((v) => nets(bx, { ...sx, discount: v }).wholesale, 0, bx.grossMargin ?? 0).root,
    },
  });
  return [
    one("favourable", "documented bounds", { ...x, avoidableCost: b.avoidHigh, grossMargin: b.marginLow }, { ...set, wholesaleCost: b.delivery }),
    one("unfavourable", "documented bounds", { ...x, avoidableCost: b.avoidLow, grossMargin: b.marginHigh }, { ...set, wholesaleCost: 0 }),
    one("ceiling", "mathematical only", { ...x, avoidableCost: b.avoidCeiling, grossMargin: b.marginLow, newCosts: 0 }, { ...set, wholesaleCost: 0 }),
  ];
}

function zeroOf(f: (v: number) => number, lo: number, hi: number): number | null {
  return solveLever(f, lo, hi).root;
}

function robustness(init: Initiative, x: ScenarioInputs, set: ArrangementSettings): Robustness {
  const data = init.worked.data;
  const b = workedBounds(data);
  const m = x.grossMargin ?? 0;
  const S = (x.wineSales ?? 0) * (x.eligible ?? 1) * (x.shift ?? 0);
  const base = nets(x, set);
  const per = nets({ ...x, newCosts: 0 }, set);
  const perDollar = { private: per.private / S, wholesale: per.wholesale / S };
  const W = x.wineSales ?? 0;
  const row = (r: Omit<SizeRow, "atLow" | "atHigh" | "zero">, apply: (v: number) => ScenarioInputs, zeroSpan: [number, number] | null): SizeRow => {
    const zp = zeroSpan ? zeroOf((v) => nets(apply(v), set).private, zeroSpan[0], zeroSpan[1]) : null;
    const zw = zeroSpan ? zeroOf((v) => nets(apply(v), set).wholesale, zeroSpan[0], zeroSpan[1]) : null;
    return { ...r, atLow: nets(apply(r.low), set), atHigh: nets(apply(r.high), set), zero: { private: zp, wholesale: zw } };
  };
  const share = W / data.sales;
  const rows: SizeRow[] = [
    row(
      { id: "shift", label: "Household wine purchases that move to grocers", standing: "chosen", entered: x.shift ?? 0, low: 0.2, high: 0.4, basis: "illustrative", why: "No source measures it; ±10 points, the scenario tool's convention.", format: "percent" },
      (v) => ({ ...x, shift: v }),
      [0.001, 1],
    ),
    row(
      { id: "eligible", label: "Households' share of wine purchases", standing: "derived", entered: x.eligible ?? 1, low: 0.67, high: 0.97, basis: "illustrative", why: "82% is DABS's off-premise share of all products, applied to wine; wine's own split is not published. ±15 points, the scenario tool's convention.", format: "percent" },
      (v) => ({ ...x, eligible: v }),
      [0.001, 1],
    ),
    row(
      { id: "scope", label: "Which wines the bill covers (scale of the modelled wine)", standing: "policy", entered: 1, low: data.wineMix.stillTable, high: 1 + data.wineMix.ciderOverWine, basis: "evidence", why: "From still table wine only to DABS wine plus hard cider, which Utah law counts as wine (FY2026 monthly reports by class; § 32B-1-102(143)).", format: "scale" },
      (v) => ({ ...x, wineSales: W * v }),
      [0.001, 3],
    ),
    row(
      { id: "share", label: "Wine's share of DABS sales", standing: "derived", entered: share, low: 0.33, high: 0.34, basis: "evidence", why: "33.5% is FY2026. The FY2025 report's p. 19 chart gives $184.1M of $550.9M, 33.4%; $550.9M is the sum of its five categories, and the report does not explain why it differs from the $551.3M of sales on pp. 30 and 32 (the model uses $551.3M). The span also covers a tax-basis bias of up to half a point (appendix).", format: "percent" },
      (v) => ({ ...x, wineSales: data.sales * v }),
      [0.001, 1],
    ),
    row(
      { id: "avoidable", label: "State-store cost avoided per dollar that moves", standing: "chosen", entered: x.avoidableCost ?? 0, low: b.avoidLow, high: b.avoidHigh, basis: "evidence", why: "DABS's FY2025 expense lines that could move with sales: card fees, agency contracts and bags, up to the same plus every salary. Accounting bounds, not measured savings.", format: "percent" },
      (v) => ({ ...x, avoidableCost: v }),
      [0, 1],
    ),
    row(
      { id: "margin", label: "Gross margin on wine", standing: "derived", entered: m, low: marginOfMarkup(SMALL_MAKER_MARKUP), high: b.marginHigh, basis: "statute", why: "47.2% is DABS's all-product margin. The 88.5% minimum wine markup implies 46.95%; if all wine carried the 49% small-maker markup, 32.9%. Legal reference points, not measured wine margins.", format: "percent" },
      (v) => ({ ...x, grossMargin: v }),
      [0, 0.99],
    ),
    row(
      { id: "newCosts", label: "New licensing and enforcement costs", standing: "chosen", entered: x.newCosts ?? 0, low: 0, high: 2 * (x.newCosts ?? 0), basis: "illustrative", why: "No estimate exists; none to double the example.", format: "money" },
      (v) => ({ ...x, newCosts: v }),
      null,
    ),
  ];
  const allExpenses = (data.expenses.total + data.expenses.nonOperating) / data.sales;
  const ceilingAll = jointNets(x, set, { ...b, avoidCeiling: allExpenses }).find((j) => j.id === "ceiling")!;
  return {
    net: base,
    keepAtBreakEven: (x.avoidableCost ?? 0) - (x.newCosts ?? 0) / S,
    perDollar,
    rows,
    lawfulDiscount: Math.max(0, 1 - (1 + STATUTORY_MARKUP.wine) * (1 - m)),
    joint: jointNets(x, set, b),
    ceilingAllExpenses: { avoid: allExpenses, net: ceilingAll.net },
    statuteMargins: { floor: marginOfMarkup(STATUTORY_MARKUP.wine), smallMaker: marginOfMarkup(SMALL_MAKER_MARKUP) },
    bounds: b,
  };
}
