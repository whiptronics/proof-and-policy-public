// The policy pages' content, built on the design model (policyDesigns.ts) and the change matrix (statutes.ts): the
// proposed framework, safeguards checked against current Utah law, monitoring indicators, other states' evidence,
// business impacts and the hard questions. Every number comes from the model at its defaults; nothing here is enacted
// law, legal advice or attorney-reviewed, and nothing has been reviewed by a person.
import { defaultDesignsReport, type DesignId, type DesignResult, type PolicyDesignsReport, UTAH_GROCERY_ESTABLISHMENTS } from "./policyDesigns";
import { typicalGrocer } from "./packageAgency";
import { samePriceHeadline } from "./samePrice";
import { amendmentsFor, openQuestionsFor } from "./statutes";

export const FRAMEWORK_METHOD = "grocery-wine-framework@1.0";

const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;
const usdM = (v: number) => `${v < -0.5 ? "−" : v > 0.5 ? "+" : ""}$${(Math.abs(v) / 1e6).toFixed(2)} million`;
const usd0 = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;

export const design = (r: PolicyDesignsReport, id: DesignId): DesignResult => r.results.find((x) => x.def.id === id)!;
export const caseNet = (d: DesignResult, savings: "none" | "allocated" | "longer_run", limit: number | null) => d.cases.find((c) => c.savings === savings && c.limit === limit)!;

/** The headline numbers every page and the briefing quote, in one place. */
export function headline(r: PolicyDesignsReport = defaultDesignsReport()) {
  const B = design(r, "B");
  const C = design(r, "C");
  const grocerB = B.flows.after.find((f) => f.party === "grocer")!.annual;
  return {
    B,
    C,
    bFixed: caseNet(B, "none", null).net,
    b60: caseNet(B, "none", 0.6).net,
    b30: caseNet(B, "none", 0.3).net,
    b30Fees: caseNet(B, "none", 0.3).netWithFees,
    bAllocated: caseNet(B, "allocated", null).net,
    cFixed: caseNet(C, "none", null).net,
    admin: r.terms.admin,
    moved: r.terms.moved,
    fee: r.licenseFeePerGroceryStore,
    grocerMarginPerStore: grocerB / UTAH_GROCERY_ESTABLISHMENTS.count,
  };
}

// ----- the framework (plan section 8) --------------------------------------------------------------------------------------

export interface FrameworkPoint {
  n: number;
  title: string;
  proposal: string;
  /** Change-matrix rows or evidence it rests on. */
  basis: string;
}

export function frameworkPoints(r: PolicyDesignsReport = defaultDesignsReport()): FrameworkPoint[] {
  const h = headline(r);
  const s = samePriceHeadline();
  const cost = (v: number) => usdM(v).replace("+", "");
  return [
    { n: 1, title: "Eligible stores", proposal: `Grocery stores only in a first phase: an off-premise beer retailer whose main business is food, by a test the bill sets (share of sales from food, or floor area). Utah had ${UTAH_GROCERY_ESTABLISHMENTS.count} grocery establishments in ${UTAH_GROCERY_ESTABLISHMENTS.year} (Census County Business Patterns, NAICS 445110). Convenience stores would wait for the review in point 12.`, basis: "M01, M02; Colorado converted every beer retailer, convenience stores included; about half of Pennsylvania's wine permits are held by convenience stores (Other States)" },
    { n: 2, title: "Products", proposal: "Sealed wine for consumption off the premises. No spirits, no on-site drinking, and a container limit set in the bill (beer's is 2 liters).", basis: "M01, M11" },
    { n: 3, title: "Licensing", proposal: "A grocery wine license issued by the commission after a department investigation, with the local authority's written consent, a floor plan of the wine display, and fees set to cover the new administration.", basis: "M02, M10" },
    { n: 4, title: "Supply", proposal: `DABS sells wine to licensed grocers below its shelf price and delivers it; the gap is the grocer's margin (Pennsylvania's licensees buy at 10% below retail). DABS's price to grocers is the bill's main fiscal setting: at ${pct(s.priceToGrocers, 0)} of the shelf price, with fees covering the administration, the state gives up ${cost(s.cost.none)} a year if DABS saves nothing and ${cost(s.cost.longerRun)} if its wages fall with sales (Same shelf price). A retail-level charge with licensed private wholesale (C) is the alternative if the Legislature prefers private distribution. Direct producer supply (D) waits until delivery costs and the federal permit question are answered.`, basis: "M03, M04; Pennsylvania Liquor Code 305(b); Same shelf price; M05 to M07 for C; M06, M16 for D" },
    { n: 5, title: "Revenue collection", proposal: `The state's take stays inside DABS's price to grocers, so no new tax is needed. The bill sets that price apart from the 88.5% markup floor (32B-2-304(2)(b)), which today would keep it at ${pct(s.lowestLawfulPrice, 2)} of the shelf price or more, and states whether DABS's sales to grocers count toward the dedicated deposits.`, basis: "M04, M09; 32B-2-304" },
    { n: 6, title: "Retail prices", proposal: "Grocers sell wine at the price the commission fixes, the state-store price, as state stores and package agencies must (32B-2-503(2), 32B-2-605(7)), so a bottle costs the same in either store. Pennsylvania instead lets grocers set their own prices, never below cost, and the one report found says they charge a little more.", basis: "32B-2-503, 32B-2-605 (pinned); Other States" },
    { n: 7, title: "Enforcement", proposal: "DABS licenses and disciplines; the Department of Public Safety's compliance-check reimbursement and the commission's violation records extend to grocery wine; local police run the checks.", basis: "M15" },
    { n: 8, title: "Public-health safeguards", proposal: "Training before anyone sells wine; ID checked on every sale, electronically at the register; a seller's minimum age the bill sets (beer allows 16 under supervision; Pennsylvania requires an 18-year-old trained cashier at a designated register); a wine display rule; local distance rules.", basis: "M10 to M13; Safeguards" },
    { n: 9, title: "State stores", proposal: `State stores keep the full wine range and every spirit. DABS's warehouse still handles every bottle; its stores lose up to ${pct(h.B.dabsVolumeLost.fixed)} of DABS's wine sales if 30% of household purchases move.`, basis: "Economics, business impacts" },
    { n: 10, title: "Package agencies", proposal: "DABS pays package agencies a fixed amount a year from a published grid, by bottles sold and average bottle price; the bill could keep or adjust their terms where a grocer nearby is licensed. A grocer could take some of an agency's wine sales; the effect is not estimated.", basis: "32B-2-601, -605 (pinned); DABS compensation grid FY27 (pinned)" },
    { n: 11, title: "Implementation costs", proposal: `The model's ${usdM(h.admin).replace("+", "")} a year of new administration is a placeholder: no estimate exists. Covered by fees, it is ${usd0(h.fee)} a year per store if all ${UTAH_GROCERY_ESTABLISHMENTS.count} grocery establishments were licensed. One-time costs (rules, systems, training) are not estimated.`, basis: "Business impacts" },
    { n: 12, title: "Review and reporting", proposal: "DABS reports each year on licenses by county, wine sold to grocers, compliance-check results and revenue; a fiscal review after three years decides whether to continue, change or extend the program.", basis: "Monitoring indicators" },
    { n: 13, title: "Effective dates", proposal: "Licenses issued no earlier than a year after enactment, once rules, training and the supply contract are ready; existing beer licensees apply, with no automatic conversion.", basis: "Colorado's automatic conversion drew the objection of no local review (Blue Book argument against)" },
    { n: 14, title: "Modification or suspension", proposal: "Triggers set in rule (a compliance-check failure rate, or wine revenue below the baseline) require a review and allow the commission to pause new licenses; the program ends unless reauthorized.", basis: "Monitoring indicators" },
  ];
}

export const PHASING = {
  options: [
    { name: "Grocery-only first phase", benefit: "Starts with the stores that fit the proposal's purpose and the smallest number of new outlets.", cost: "Draws a line between grocery and convenience stores that the bill must define and DABS must police." },
    { name: "A cap or pilot by county", benefit: "Gives a comparison group for evaluation.", cost: "Unequal access by place, and a cap can make licenses valuable and contested." },
    { name: "A statutory review and sunset", benefit: "Forces the indicators to be collected and read.", cost: "Uncertainty for stores deciding whether to invest in a wine section." },
  ],
  verdict: "A grocery-only first phase with a three-year review is the simplest staged design. A pilot by county would make evaluation stronger but treats residents unequally; whether that is lawful was not checked.",
};

// ----- safeguards against current law (plan section 7) ---------------------------------------------------------------------

export type SafeguardStatus = "required_for_beer" | "partly" | "new";

export interface Safeguard {
  name: string;
  /** Current Utah law for off-premise beer, read from the code. */
  today: string;
  cite: string;
  status: SafeguardStatus;
  proposal: string;
}

export const SAFEGUARDS: Safeguard[] = [
  { name: "A state-issued license", today: "Off-premise beer needs a commission-issued state license (since July 1, 2018) and a local license.", cite: "32B-7-401, -402; 32B-7-201", status: "required_for_beer", proposal: "The same for wine, as its own license (M02)." },
  { name: "ID checks", today: "Proof of age before every sale, and an interdiction check on Utah licenses. Electronic verification only for designated-stall pickup.", cite: "32B-7-202(12); 32B-1-407", status: "partly", proposal: "Electronic verification on every wine sale (M13)." },
  { name: "Staff training", today: "Managers and staff complete an alcohol training seminar before starting work; managers take the department's program within 30 days.", cite: "32B-1-703, -704", status: "required_for_beer", proposal: "Extend to wine staff (M12)." },
  { name: "Compliance checks", today: "Public Safety reimburses local police for alcohol compliance checks at off-premise beer retailers and reports on them yearly.", cite: "32B-7-305", status: "required_for_beer", proposal: "Extend and fund from license fees (M15)." },
  { name: "Penalties for sales to minors", today: "Class B misdemeanor if negligent or reckless, class A if knowing; repeat violations within 36 months require retraining; the commission records each violation.", cite: "32B-4-403; 32B-1-704(5); 32B-1-705", status: "required_for_beer", proposal: "Applies to anyone already; records and retraining extend with M12 and M15." },
  { name: "Suspension and revocation", today: "A local authority may suspend a beer license if training lapses; the commission disciplines state licensees, and a master license answers for its locations' violations.", cite: "32B-1-702(3); 32B-7-202(1); 32B-7-408(6)", status: "required_for_beer", proposal: "The same disciplinary path for wine licenses." },
  { name: "Display and storage", today: "Beer shown in no more than two places, apart from soft drinks, with a set warning sign.", cite: "32B-7-202(6)", status: "partly", proposal: "A wine display rule in the bill (M11)." },
  { name: "Who may sell", today: "A minor of 16 or older may sell beer under supervision of someone 21 or older.", cite: "32B-7-202(5)", status: "partly", proposal: "A minimum seller's age for wine is the bill's choice (Pennsylvania: 18, trained, at a designated register)." },
  { name: "Limits on eligible stores", today: "None by store type for beer.", cite: "32B-7", status: "new", proposal: "A grocery-only first phase (framework point 1)." },
  { name: "Distance and density rules", today: "Local authorities may set proximity rules for beer outlets near community locations.", cite: "32B-7-201(1)(c)", status: "partly", proposal: "The same local power for wine (M10). The Community Guide recommends regulating outlet density." },
  { name: "Promotional practices", today: "Federal law bars suppliers' tied-house inducements to retailers in interstate commerce. No state rule on grocers' wine promotions was read.", cite: "27 U.S.C. 205(b)", status: "new", proposal: "No below-cost sales; rules on supplier-paid displays for wine." },
  { name: "Reporting", today: "Public Safety reports compliance checks each October 1.", cite: "32B-7-305(2)", status: "partly", proposal: "An annual DABS report on the program (framework point 12)." },
];

export const SAFEGUARD_STATUS_LABEL: Record<SafeguardStatus, string> = {
  required_for_beer: "Already required for off-premise beer",
  partly: "Partly in place",
  new: "New",
};

export interface Indicator {
  name: string;
  source: string;
  note: string;
}

export const INDICATORS: Indicator[] = [
  { name: "Compliance-check failure rate", source: "Department of Public Safety reports under 32B-7-305", note: "Compare grocery wine licensees with beer retailers in the same years." },
  { name: "Licenses and where they are", source: "DABS license records", note: "By county and by distance to the nearest state store or package agency." },
  { name: "Alcohol-related crashes and injuries", source: "NHTSA FARS (already in this dataset); state injury data", note: "Trends only: a change after the law does not show the law caused it." },
  { name: "Wine and pure-alcohol volume", source: "DABS sales; NIAAA apparent consumption", note: "Wine by channel, and total ethanol, so substitution from beer or spirits can be seen." },
  { name: "DABS revenue", source: "DABS annual reports", note: "Wine margin from stores and from grocers, before and after." },
  { name: "Dedicated funds", source: "32B-2-304(5), -305(4) deposits", note: "School-lunch and other deposits each year." },
  { name: "State stores and package agencies", source: "DABS store and agency sales", note: "Sales by store, so the effect on rural agencies is measured rather than assumed." },
];

// ----- other states (plan section 6) ----------------------------------------------------------------------------------------

export type EvidenceStrength = "causal_estimate" | "descriptive" | "legal_text" | "press_report" | "industry_commissioned" | "not_read";

export const STRENGTH_LABEL: Record<EvidenceStrength, string> = {
  causal_estimate: "Peer-reviewed estimate (model-based)",
  descriptive: "Descriptive trend (not causal)",
  legal_text: "Law and official figures only",
  press_report: "Press report (no prices measured)",
  industry_commissioned: "Industry-commissioned report",
  not_read: "Not read",
};

export interface StateEvidence {
  label: string;
  strength: EvidenceStrength;
  text: string;
  source: string;
  url: string;
}

export interface StateCase {
  id: string;
  state: string;
  change: string;
  date: string;
  legal: string;
  evidence: StateEvidence[];
  concurrent: string;
  applies: string;
}

export const STATE_CASES: StateCase[] = [
  {
    id: "tn",
    state: "Tennessee",
    change: "Food stores licensed to sell wine",
    date: "July 1, 2016",
    legal: "A license state: private wholesalers and retailers, with a wine excise tax. Grocery wine sales began with licenses from July 1, 2016.",
    evidence: [
      { label: "Sun, Caputo, Staples and Vassilopoulos, American Journal of Agricultural Economics 108(5), 1255-1281 (online Dec. 7, 2025; open access)", strength: "causal_estimate", text: "Synthetic control and synthetic difference-in-differences, on NielsenIQ data and official statistics. The abstract reports no statistically significant change in the number of liquor stores, higher wine excise-tax revenue, and mixed evidence of a short-term fall in liquor-store employment whose significance depends on the method. Only the abstract and Crossref record were read: the publisher's page refused automated access, so the effect sizes, donor states, funding and conflict-of-interest statements were not read.", source: "Crossref record and abstract, read 2026-11-19", url: "https://doi.org/10.1111/ajae.70033" },
      { label: "Caputo, Assessing the Impact of Wine Sale Reform: A Case Study of Tennessee (2024)", strength: "industry_commissioned", text: "Released by FMI, the food retailers' trade association; it reports no significant rise in liquor-store closures and higher sales-tax revenue. Its relation to the journal article (one author is shared) was not checked.", source: "FMI news release, July 15, 2024, read 2026-11-19", url: "https://www.fmi.org/newsroom/news-archive/view/2024/07/15/new-fmi-study-assesses-benefits-of-selling-wine-at-grocery" },
      { label: "This project's before-and-after comparison (2026-10-17)", strength: "descriptive", text: "Wine ethanol per adult rose 26% from 2011-2015 to 2017-2019, 16.3 log points more than the neighbors' average; beer fell about as much as in the neighbors; total ethanol rose 4.5 log points relative to them, a gap that is ordinary for these states.", source: "docs/analyses/tn-2016-grocery-wine/results.md", url: "?v=case" },
    ],
    concurrent: "A minimum wine price (no retail wine below cost plus 20%) began the same day, July 1, 2016; package stores could sell beer from July 1, 2014; from FY2018 the state's wine tax account also carries high-alcohol beer.",
    applies: "Tennessee's wine excise receipts rose because more wine was sold under a tax that grocery sales also pay. Utah has no wine excise: its revenue is DABS's markup, and under designs C and D a grocery bottle carries none of it. A Tennessee percentage is not transferable to Utah without a bridge from excise receipts to monopoly margin, which nothing here supplies.",
  },
  {
    id: "co",
    state: "Colorado",
    change: "Beer retailer licenses converted to beer-and-wine licenses",
    date: "March 1, 2023",
    legal: "Proposition 125 (statutory initiative) automatically converted every fermented malt beverage retailer license (grocery and convenience stores) to allow wine and tastings. 1,819 such licensees held licenses on June 30, 2021, against 1,592 retail liquor stores.",
    evidence: [
      { label: "Colorado Secretary of State, 2022 general election, Proposition 125", strength: "legal_text", text: "Yes 1,228,404 (50.58%), No 1,200,219 (49.42%).", source: "historicalelectiondata.coloradosos.gov, read 2026-11-19", url: "https://historicalelectiondata.coloradosos.gov/contest/25866" },
      { label: "Legislative Council, 2022 State Ballot Information Booklet", strength: "legal_text", text: "Fiscal impact: Department of Revenue workload to convert about 1,820 licenses, including $5,000 of one-time programming. Argument against: the conversion would more than double the stores selling wine with no community or government review.", source: "Blue Book, pages 36-37, read 2026-11-19", url: "https://content.leg.colorado.gov/sites/default/files/images/blue_book_2022_english_for_web.pdf" },
      { label: "Post-reform prices, sales, closures and tax revenue", strength: "not_read", text: "The Department of Revenue's liquor pages refused automated access, and no government or peer-reviewed evaluation of the 2023 change was found. Retailer accounts and industry claims are not used.", source: "sbg.colorado.gov (HTTP 403), 2026-11-19", url: "https://sbg.colorado.gov/liquor" },
    ],
    concurrent: "2016 legislation phased in more locations for liquor-licensed drugstores and let beer retailers sell full-strength beer; Proposition 124 (more liquor-store locations) was on the same 2022 ballot.",
    applies: "A license state with private wholesale and an excise tax, like Tennessee. Its automatic conversion is the opposite of the licensing this framework proposes, and its observation period is short.",
  },
  {
    id: "pa",
    state: "Pennsylvania",
    change: "Wine expanded permits (Act 39 of 2016)",
    date: "Approved June 8, 2016; permit requests from August 8, 2016",
    legal: "A control state that is still the wholesaler and runs about 560 state stores. Restaurant and hotel licensees (including grocery and convenience stores holding restaurant licenses) may sell up to 3 liters of wine to go per sale, bought from state stores or limited wineries, at a designated register staffed by a trained cashier 18 or older, never below their purchase price. A $2,000 application fee and a renewal fee of 2% of wine bought from the state.",
    evidence: [
      { label: "PLCB annual report, FY2024-25", strength: "legal_text", text: "Permits on June 30, 2025: 980 convenience stores, 559 grocery stores, 296 restaurants, 62 hotels, 9 mass merchants. Total PLCB sales $3.16 billion with taxes; liquor tax (18%) $444.4 million. No estimate of the permits' effect on revenue.", source: "PLCB annual report FY2024-25, read 2026-11-19", url: "https://www.pa.gov/agencies/lcb/about-us/reports-and-publications/annual-reports" },
      { label: "PLCB, Frequently Asked Questions: Wine Expanded Permits (October 4, 2016)", strength: "legal_text", text: "Eligibility, the 3-liter limit, hours, the designated register, scanning ID of patrons who appear under 35, and the price floor.", source: "PLCB Office of Chief Counsel, read 2026-11-19", url: "https://www.pa.gov/agencies/lcb/shop-wine-spirits/wholesale-wine-and-spirits-sales/wine-expanded-permits" },
      { label: "Marnie Old, Philadelphia Inquirer (May 6, 2020)", strength: "press_report", text: "A wine columnist's account: grocers stock mostly the national brands state stores sell, and those wines \"typically cost a little more\" in grocery stores, because grocers buy from the PLCB at only 10% below retail. No prices were measured, and no measured comparison of grocery and state-store prices was found.", source: "inquirer.com, read 2026-11-20", url: "https://www.inquirer.com/food/drink/what-wines-to-buy-at-grocery-stores-20200506.html" },
      { label: "Liquor Code section 305(b), as printed in HB 1690 (PN 2653)", strength: "legal_text", text: "State stores sell to licensees at the retail price less 10%. Whether every permit purchase is at that price was not confirmed.", source: "palegis.us, read 2026-11-19", url: "https://www.palegis.us/legislation/bills/2015/hb1690" },
    ],
    concurrent: "Act 39 also changed direct wine shipping, state-store hours and beer licensing; a 2024-25 cocktail permit shifted permit holders' purchases.",
    applies: "The closest structure to design B: the state stays the wholesaler and private stores resell its wine, bought at 10% below retail. Pennsylvania lets grocers set their own prices (never below cost), and the one report found says they charge a little more than state stores. Utah's package agencies already sell at the state's price, so a Utah bill could require the same shelf price instead. No causal estimate exists.",
  },
  {
    id: "control",
    state: "Other control states",
    change: "How the state's wholesale and retail roles are split",
    date: "Current",
    legal: "Mississippi's ABC is the state's wholesaler of spirits and wine and licenses about 1,700 package and on-premises retailers; Wyoming's Department of Revenue runs wholesale distribution; Montgomery County, Maryland wholesales, runs 25 stores and shares retail with about 1,100 license holders; Idaho's division controls beverages over 16% alcohol.",
    evidence: [
      { label: "NABCA control-state directory", strength: "legal_text", text: "Agency profiles in the agencies' own words. They do not say, for most states, which beverages are controlled at wholesale or retail, or where wine may be sold.", source: "nabca.org, read 2026-11-19", url: "https://www.nabca.org/control-state-directory-and-info" },
    ],
    concurrent: "—",
    applies: "Mississippi and Wyoming show a state wholesaler of wine supplying private retailers, as in design B, but whether grocery stores there sell wine, and at what margin, was not read. They are structure, not evidence of effects.",
  },
];

// ----- business impacts (plan section 9) ------------------------------------------------------------------------------------

export interface FeeBurden {
  label: string;
  /** Share of the average store's wine sales. */
  scale: number;
  grossMargin: number;
  feeShare: number;
}

/** A fee that covers the administration, against the wine gross margin of stores of different sizes (B, fixed share). */
export function feeBurden(r: PolicyDesignsReport = defaultDesignsReport()): FeeBurden[] {
  const h = headline(r);
  return [
    { label: "Average store", scale: 1 },
    { label: "A quarter of the average", scale: 0.25 },
    { label: "A tenth of the average", scale: 0.1 },
  ].map((s) => ({ ...s, grossMargin: h.grocerMarginPerStore * s.scale, feeShare: h.fee / (h.grocerMarginPerStore * s.scale) }));
}

export interface Impact {
  who: string;
  effect: string;
  evidence: "computed" | "assessed" | "unknown";
}

export function businessImpacts(r: PolicyDesignsReport = defaultDesignsReport()): Impact[] {
  const h = headline(r);
  const fb = feeBurden(r);
  return [
    { who: "DABS stores", effect: `Lose up to ${pct(h.B.dabsVolumeLost.fixed)} of DABS's wine sales if 30% of household purchases move; none if price-sensitive households stay. Under B, DABS's warehouse still handles every bottle.`, evidence: "computed" },
    { who: "Rural package agencies", effect: "Paid by contract; a nearby licensed grocer could take sales. Pay terms were not read, so the effect is not estimated.", evidence: "unknown" },
    { who: "DABS employees", effect: "No staffing change is modeled. Wages fall only in the illustrative longer-run case, and no staffing plan exists.", evidence: "assessed" },
    { who: "Utah wineries and small producers", effect: "Under B they reach grocers through DABS listings, as now; under D they could sell to grocers directly but carry delivery and permit costs.", evidence: "assessed" },
    { who: "Existing alcohol retailers", effect: "Off-premise beer retailers that are not grocery stores would be outside a grocery-only first phase. Utah has no independent liquor stores: wine is sold only at state stores and contract package agencies.", evidence: "assessed" },
    { who: "Grocery chains", effect: `Gross margin on wine of about ${usd0(h.grocerMarginPerStore)} a year for an average store under B if 30% of household purchases move, before their own costs (shelf space, inventory, shrinkage, compliance), which nothing here measures.`, evidence: "computed" },
    { who: "Independent grocery stores", effect: `A fee of ${usd0(h.fee)} a year is ${pct(fb[0].feeShare)} of the average store's wine gross margin, ${pct(fb[1].feeShare)} at a quarter of its sales and ${pct(fb[2].feeShare)} at a tenth. Flat fees fall hardest on small stores; a fee scaled to purchases from DABS (as Pennsylvania's 2% renewal fee is) would not.`, evidence: "computed" },
    { who: "Wholesalers and distributors", effect: "None under B. Under C a new licensed wine wholesale trade would exist; under D producers' delivery replaces it.", evidence: "assessed" },
  ];
}

// ----- the hard questions (plan section 12) ---------------------------------------------------------------------------------

export interface Question {
  q: string;
  a: string;
  /** Where the calculation or source is. */
  see: string;
}

export function hardQuestions(r: PolicyDesignsReport = defaultDesignsReport()): Question[] {
  const h = headline(r);
  const ref = r.frontierAtReference;
  const s = samePriceHeadline();
  const cost = (v: number) => usdM(v).replace("+", "");
  return [
    { q: "Would Utah lose alcohol revenue?", a: `It depends on DABS's price to grocers and on what DABS saves, which nobody has measured. With wine at today's shelf price and DABS selling to grocers at ${pct(s.priceToGrocers, 0)} of it, the state gives up ${cost(s.cost.none)} a year if DABS saves nothing and ${cost(s.cost.longerRun)} if its wages fall with sales, with license fees covering the administration; household wine purchases ${pct(s.neededNone)} higher would cover the first. If grocers set their own prices instead (design B), the state is ${usdM(h.bFixed)} a year ahead if 30% of household purchases move.`, see: "?v=sameprice" },
    { q: "How much would wine cost in grocery stores?", a: "The same as at a state store. Under the framework grocers sell at the price the commission fixes, as state stores and package agencies must (point 6). If a bill let grocers set their own prices instead, the price would depend on the margin they keep; the five designs page models that option.", see: "?v=sameprice" },
    { q: "Would grocery stores actually be willing to sell it?", a: `Not known. A grocer's margin is the gap between DABS's price to it and the shelf price. Pennsylvania's licensees buy at 10% below retail and 559 grocery stores hold its wine permits. Utah's own package agency grid would pay a typical grocery store's wine volume about ${pct(typicalGrocer(s.moved).rate, 0)} of its sales, and large stores less.`, see: "?v=sameprice" },
    { q: "Could the state collect the same revenue without distributing the wine?", a: `Yes in arithmetic: a retail-level charge equal to DABS's margin collects it (designs C and D). But a private wholesaler's margin then sits on top, so the grocery price rises ${pct(h.C.premium)}. A retail-level charge with distribution that cost nothing would break even at ${pct(ref.retailChargeNoDistribution)}.`, see: "?v=designs" },
    { q: "Could direct producer-to-grocery distribution work?", a: `Only if delivery is cheap: D beats B's price only if delivery costs less than ${pct(r.distributionToMatchB)} of the price to grocers, which nothing measures. It also needs new state authority and an answer on federal wholesaler permits.`, see: "?v=framework" },
    { q: "Would wine consumption increase?", a: "Probably somewhat: more outlets usually mean more buying. Tennessee's wine purchases rose clearly faster than its neighbors' after 2016, though total alcohol's rise was within the usual range. The revenue model counts no added drinking in its main case.", see: "?v=safeguards" },
    { q: "Would this make underage purchases easier?", a: "More outlets mean more places to try. Utah's beer rules (ID before every sale, training, compliance checks, penalties) would extend to wine; how well they work at grocers is what the compliance-check failure rate would measure.", see: "?v=safeguards" },
    { q: "What happens to DABS employees?", a: "No layoffs are modeled. Under B, DABS still buys, stores and delivers every bottle. Store staffing would change only if store sales fall, and no staffing plan exists.", see: "?v=framework" },
    { q: "What happens to rural package agencies?", a: "Not estimated. DABS pays each one a fixed amount a year from a published grid, by bottles sold and average bottle price. A licensed grocer in an agency's town could take some of its wine sales, and with them its place on the grid; the framework leaves the agency terms to the bill.", see: "?v=sameprice" },
    { q: "Could local wineries benefit?", a: "Possibly, through grocery shelves under any design, and directly under D. Neither effect is measured.", see: "?v=framework" },
    { q: "What would happen to existing state stores?", a: `They would keep spirits and the full wine range. Their wine sales fall by up to ${pct(h.B.dabsVolumeLost.fixed)} of DABS's total if 30% of household purchases move.`, see: "?v=designs" },
    { q: "Would expanded access hurt independent retailers?", a: `Utah has no independent liquor stores: wine is sold only at state stores and contract package agencies. Small grocers could be priced out by flat fees: ${usd0(h.fee)} a year is ${pct(feeBurden(r)[2].feeShare)} of the wine gross margin of a store selling a tenth of the average.`, see: "?v=framework" },
    { q: "How would licensing and enforcement be funded?", a: `By license fees set to cover the administration, ${usd0(h.fee)} a year per store if all ${UTAH_GROCERY_ESTABLISHMENTS.count} grocery establishments were licensed (the cost itself is a placeholder).`, see: "?v=framework" },
    { q: "What can Tennessee teach Utah?", a: "That grocery wine did not significantly change the number of liquor stores there and raised wine tax receipts, by a peer-reviewed estimate. Tennessee taxes wine by excise; Utah earns a monopoly margin, so the revenue result does not carry over.", see: "?v=states" },
    { q: "Why might Colorado's experience differ?", a: "Colorado converted every beer retailer's license automatically, convenience stores included, and has private wholesalers and an excise tax. Its first years have no government evaluation yet.", see: "?v=states" },
    { q: "Could the change affect funding for education or other programs?", a: "Yes, through the dedicated deposits figured on DABS's liquor sales. Under B it depends on whether sales to grocers count; under C and D the bill must allocate part of the charge to keep them whole.", see: "?v=framework" },
    { q: "Why not allow grocery stores to sell all distilled spirits too?", a: "Spirits are outside this proposal and nothing here analyzes them. The Community Guide recommends against further privatization of retail alcohol sales where government controls them, on strong evidence that it raises per capita consumption; grocery wine is a partial step of that kind, and spirits would be a larger one.", see: "?v=safeguards" },
    { q: "What evidence would undermine the proposal?", a: "Grocers needing margins that push prices far above state stores; very few households switching (so fees, not revenue, carry the program); compliance-check failures above beer's; or a measured rise in alcohol harms where grocery wine began.", see: "?v=designs" },
    { q: "What assumptions are still unverified?", a: "Every number is software-transcribed and unreviewed. The share that would switch, DABS's avoidable costs, the administration cost, grocers' margins and delivery costs are assumptions or placeholders.", see: "?v=methods" },
    { q: "What laws must change?", a: `Design B needs ${amendmentsFor("B").length} amendments and leaves ${openQuestionsFor("B").length} legal questions open; C needs ${amendmentsFor("C").length}, D ${amendmentsFor("D").length} and E ${amendmentsFor("E").length}. The change matrix lists each with its current text.`, see: "?v=framework" },
  ];
}
