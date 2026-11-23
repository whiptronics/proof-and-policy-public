// The review copies of the policy pages, rendered as Markdown from the same data the pages use (statutes.ts,
// framework.ts, policyDesigns.ts). `npm run docs:framework` writes them under docs/; frameworkDocs.test.ts fails when a
// committed copy differs from what the data renders.
import { INDICATORS, PHASING, SAFEGUARDS, SAFEGUARD_STATUS_LABEL, STATE_CASES, STRENGTH_LABEL, businessImpacts, feeBurden, frameworkPoints, headline, hardQuestions } from "./framework";
import {
  BASKET,
  CONVENIENCE_LIMITS,
  HYBRID_DABS_SHARE,
  HYBRID_EXTRA_ADMIN_SHARE,
  POLICY_DESIGNS_METHOD,
  SAVINGS_CASES,
  UTAH_GROCERY_ESTABLISHMENTS,
  defaultDesignsReport,
  type PolicyDesignsReport,
} from "./policyDesigns";
import { DIRECT_COST_SHARES, PRODUCER_PREMIUMS } from "./producerDirect";
import { ASSUMPTIONS, RETAILER_TARGET, WHOLESALER_MARGIN, type Standing } from "./wineAlternatives";
import { LAW_SOURCES, STATUTES_METHOD, STATUTE_ROWS, amendmentsFor, openQuestionsFor, type RowKind } from "./statutes";
import { minus } from "./format";

const esc = (s: string) => s.replace(/\|/g, "\\|");
const pct = (v: number, d = 1) => `${minus((v * 100).toFixed(d))}%`;
const usd0 = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;

const STATUS = (what: string) =>
  [
    `- **Status:** a proposal for review by qualified legal and fiscal experts. Not enacted law, not legal advice, not attorney-reviewed, and not reviewed by a person. Written with AI assistance (Claude) for Ethan Whipple.`,
    `- **Generated** from ${what} by \`npm run docs:framework\` (in \`web/\`); edit the data, not this file. Methods: ${STATUTES_METHOD}, ${POLICY_DESIGNS_METHOD}.`,
  ].join("\n");

const KIND: Record<RowKind, string> = { amendment: "change", unresolved: "open", current_law: "none" };

export function matrixDoc(): string {
  const k = (v: RowKind | undefined) => (v ? KIND[v] : "—");
  return [
    "# Statutory change matrix: grocery wine in Utah",
    "",
    STATUS("`web/src/lib/statutes.ts`"),
    "",
    "Each row is a provision a grocery-wine bill would touch. **Current effect** is read from the official text listed under Sources; **change** is what a bill would do. In the design columns, *change* means the bill must change or decide it, *open* means a legal question the text read does not answer, *none* means current law already works, and — means the design is not affected. Design A (today) needs none.",
    "",
    "| Row | Existing provision | Current legal effect | Proposed change | Purpose | Dependencies | B | C | D | E |",
    "|---|---|---|---|---|---|---|---|---|---|",
    ...STATUTE_ROWS.map((x) => `| ${x.id} | ${esc(x.provision)} (${esc(x.cite)}) | ${esc(x.effect)} | ${esc(x.change)} | ${esc(x.purpose)} | ${esc(x.dependencies)} | ${k(x.by.B)} | ${k(x.by.C)} | ${k(x.by.D)} | ${k(x.by.E)} |`),
    "",
    "## Count by design",
    "",
    "| Design | Changes | Open questions |",
    "|---|---:|---:|",
    ...(["B", "C", "D", "E"] as const).map((d) => `| ${d} | ${amendmentsFor(d).length} | ${openQuestionsFor(d).length} |`),
    "",
    "The counts are criterion 10 of the design comparison. They count provisions, not pages of bill text, and weigh a definition the same as a new tax.",
    "",
    "## Federal law",
    "",
    "Federal law does not, in the text read, require a three-tier system: 27 U.S.C. 203 requires basic permits of importers, producers and those buying for resale at wholesale, and exempts state agencies; 27 U.S.C. 205 restricts what industry members may give or require of retailers in interstate commerce. Whether a producer selling to grocers needs a wholesaler's basic permit turns on 27 CFR part 1, which was not read (row M16).",
    "",
    "## Sources",
    "",
    "| Source | Version read | Read | SHA-256 (first 16) |",
    "|---|---|---|---|",
    ...LAW_SOURCES.map((s) => `| [${esc(s.title)}](${s.url}) | ${esc(s.version)} | ${s.read} | ${s.sha16 ?? "fetch tool, no file"} |`),
    "",
  ].join("\n");
}

export function frameworkDoc(r: PolicyDesignsReport = defaultDesignsReport()): string {
  return [
    "# Proposed Utah grocery-wine framework",
    "",
    STATUS("`web/src/lib/framework.ts`"),
    "",
    `None of the four alternatives to today (B to E) meets all three constraints (the state breaking even with no savings under every convenience limit, a grocery price within ${pct(r.constraints.maxPremium, 0)} of a state store, and a grocer margin of at least ${pct(r.constraints.minGrocerMargin, 0)}). The framework is built on design B, the best-supported one, and says what would have to be true for it to work: ${r.selected.whatWouldNeedToChange.length} conditions, listed at the end.`,
    "",
    "## The fourteen points",
    "",
    ...frameworkPoints(r).flatMap((p) => [`${p.n}. **${p.title}.** ${p.proposal} *Basis: ${p.basis}.*`]),
    "",
    "## Phased implementation",
    "",
    "| Option | Benefit | Cost |",
    "|---|---|---|",
    ...PHASING.options.map((o) => `| ${o.name} | ${o.benefit} | ${o.cost} |`),
    "",
    PHASING.verdict,
    "",
    "## What would need to change for a design to meet every constraint",
    "",
    ...r.selected.whatWouldNeedToChange.map((w) => `- ${w}`),
    "",
    "The legal changes each point needs are in `statutory-change-matrix.md`.",
    "",
  ].join("\n");
}

export function safeguardsDoc(r: PolicyDesignsReport = defaultDesignsReport()): string {
  return [
    "# Public health, underage sales and enforcement",
    "",
    STATUS("`web/src/lib/framework.ts`"),
    "",
    "## What the research says",
    "",
    "- **Outlet density.** The Community Preventive Services Task Force recommends using regulatory authority, such as licensing and zoning, to limit alcohol outlet density, on sufficient evidence (February 2007; 39 studies through November 2006). Policies that increased density were associated with more excessive drinking and related harms. ([finding](https://thecommunityguide.cdc.gov/findings/alcohol-excessive-consumption-regulation-alcohol-outlet-density.html), read 2026-11-19)",
    "- **Privatization.** The Task Force recommends against further privatization of retail alcohol sales where government controls them, on strong evidence that privatization raises per capita consumption (April 2011; median rise of 44.4% in per capita sales of the privatized beverage across 18 studies). A grocery wine license privatizes part of wine retail. ([finding](https://thecommunityguide.cdc.gov/findings/alcohol-excessive-consumption-privatization-retail-alcohol-sales.html), read 2026-11-19)",
    "- **Tennessee.** This project's descriptive comparison found wine purchases rising faster than in neighboring states after 2016 and total alcohol rising by an amount ordinary for those states; it is not a causal estimate.",
    "",
    `More grocery outlets are not harmless. Under the framework grocery prices equal state-store prices, so no price gap damps the availability effect; if grocers set their own prices (the model's +${pct(headline(r).B.premium, 0)} under B), a higher price would damp it by an amount not measured.`,
    "",
    "## Safeguards against current law",
    "",
    "Checked against the Utah Code as read on 2026-11-19 (see the matrix's sources) before anything here was called new.",
    "",
    "| Safeguard | Current law for off-premise beer | Citation | Status | Proposal for wine |",
    "|---|---|---|---|---|",
    ...SAFEGUARDS.map((s) => `| ${s.name} | ${esc(s.today)} | ${esc(s.cite)} | ${SAFEGUARD_STATUS_LABEL[s.status]} | ${esc(s.proposal)} |`),
    "",
    "## Monitoring and evaluation",
    "",
    "| Indicator | Source | Note |",
    "|---|---|---|",
    ...INDICATORS.map((i) => `| ${i.name} | ${esc(i.source)} | ${esc(i.note)} |`),
    "",
    "A change after the law starts does not show the law caused it: crashes, sales and compliance all move for other reasons. The indicators are for review against a comparison (beer retailers, other years, or other states), not for crediting or blaming the program.",
    "",
  ].join("\n");
}

export function impactsDoc(r: PolicyDesignsReport = defaultDesignsReport()): string {
  const h = headline(r);
  return [
    "# Effects on existing businesses and the public",
    "",
    STATUS("`web/src/lib/framework.ts`"),
    "",
    `Figures are design B at the fixed share (30% of household wine purchases moving), with no store costs counted as saved. Average figures divide the grocer's total margin among all ${UTAH_GROCERY_ESTABLISHMENTS.count} grocery establishments (CBP ${UTAH_GROCERY_ESTABLISHMENTS.year}); real stores differ widely.`,
    "",
    "| Who | Likely effect | Basis |",
    "|---|---|---|",
    ...businessImpacts(r).map((i) => `| ${i.who} | ${esc(i.effect)} | ${i.evidence} |`),
    "",
    "## Would fees exclude small stores?",
    "",
    `A flat fee that covers the ${usd0(h.admin)} a year of administration (a placeholder) is ${usd0(h.fee)} per store if all ${UTAH_GROCERY_ESTABLISHMENTS.count} are licensed. Against each store's wine gross margin before its own costs:`,
    "",
    "| Store | Wine gross margin a year | Fee as a share of it |",
    "|---|---:|---:|",
    ...feeBurden(r).map((f) => `| ${f.label} | ${usd0(f.grossMargin)} | ${pct(f.feeShare)} |`),
    "",
    "Inventory carrying costs, shelf space, spoilage and shrinkage, minimum order quantities and compliance overhead are not measured; each falls harder on small stores. If fewer stores apply, a fee that covers the same cost rises.",
    "",
  ].join("\n");
}

export function statesDoc(): string {
  return [
    "# What happened in other states?",
    "",
    STATUS("`web/src/lib/framework.ts`"),
    "",
    "Each finding carries its evidence strength. A **peer-reviewed estimate** uses a model to build a comparison; a **descriptive trend** compares before and after without one; **law and official figures** say what changed, not what it caused; a **press report** is a journalist's account with no prices measured; **industry-commissioned** work is labeled as such; **not read** means the source refused access or none was found.",
    "",
    "## Why before-and-after is not an experiment",
    "",
    "A state that changes its law is not chosen at random, and other things change at the same time: prices, tastes, other laws, the economy. Comparing the same state before and after, or against neighbors, shows what happened, not what the law caused. Synthetic-control methods build a weighted mix of other states that tracked the treated state before the change; they are stronger than a raw comparison but still rest on that mix being a fair stand-in. No example here was chosen for a favorable trend.",
    "",
    ...STATE_CASES.flatMap((c) => [
      `## ${c.state}: ${c.change} (${c.date})`,
      "",
      `**Law.** ${c.legal}`,
      "",
      ...c.evidence.flatMap((e) => [`- **${STRENGTH_LABEL[e.strength]}.** [${esc(e.label)}](${e.url.startsWith("?") ? `https://proofandpolicy.us/${e.url}` : e.url}): ${e.text} *(${e.source})*`]),
      "",
      ...(c.concurrent === "—" ? [] : [`**At the same time.** ${c.concurrent}`, ""]),
      `**For Utah.** ${c.applies}`,
      "",
    ]),
  ].join("\n");
}

export function questionsDoc(r: PolicyDesignsReport = defaultDesignsReport()): string {
  return [
    "# Hard questions",
    "",
    STATUS("`web/src/lib/framework.ts`"),
    "",
    ...hardQuestions(r).flatMap((q, i) => [`${i + 1}. **${q.q}** ${q.a}`]),
    "",
  ].join("\n");
}

/** The technical appendix for the five designs: every formula the model uses, with its inputs and results. */
export function methodsDoc(r: PolicyDesignsReport = defaultDesignsReport()): string {
  const t = r.terms;
  const m = (v: number) => `${v < -0.5 ? "−" : v > 0.5 ? "+" : ""}$${(Math.abs(v) / 1e6).toFixed(2)}M`;
  const p = (v: number | null | undefined, d = 1) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : pct(v, d));
  const lim = (l: number | null) => (l === null ? "fixed 30% share" : `limit ${pct(l, 0)}`);
  const designs = r.results.filter((x) => x.def.id !== "A");
  const sales = (P: number) => t.salesTax * (P - 1);
  return [
    "# Five grocery-wine designs: derivations",
    "",
    STATUS("`web/src/lib/policyDesigns.ts`"),
    "",
    `The technical appendix for the design comparison on \`?v=designs\`, the two-page briefing (\`legislative-briefing.pdf\`) and the policy pages. Every number below is computed by the same code the site runs. \`scripts/policy_designs_check.py\` recomputes them in Python from the export, with closed forms written separately. Conditional results, not forecasts or a fiscal note. The older sections of \`docs/briefings/utah-grocery-wine/technical-appendix.md\` count allocated store savings in their headlines; this comparison does not.`,
    "",
    "## Units and terms",
    "",
    "Money is per $1 of today's state-store shelf price before sales tax, or FY2025 dollars a year. Sales tax applies to the state store and the grocer at the same rate, so a price ratio before tax is the same after it. The terms are read from the engine (`terms()`), never retyped:",
    "",
    "| Symbol | Term | Value |",
    "|---|---|---|",
    `| W | DABS wine sales, all buyers, at state-store prices | ${m(t.wine).replace("+", "")} a year |`,
    `| H | Households' share of DABS wine | ${pct(t.household)} |`,
    `| s₀ | Share of household purchases that moves at equal prices | ${pct(t.shift)} |`,
    `| M | Wine that moves at s₀ (W × H × s₀) | ${m(t.moved).replace("+", "")} a year |`,
    `| L | DABS's landed cost per $ | ${pct(t.landed)} |`,
    `| μ | DABS's gross margin per $ (L + μ = 1) | ${pct(t.margin)} |`,
    `| τ | State sales tax rate | ${pct(t.salesTax, 2)} |`,
    `| A | New administration, $ a year (a placeholder; no estimate exists) | ${m(t.admin).replace("+", "")} |`,
    `| g | Grocer gross margin on its own price (reference: Census ARTS 2022, grocery stores, NAICS 4451, national, all products) | ${pct(RETAILER_TARGET)} |`,
    `| w | Wholesaler margin on its own price (reference: Census AWTS 2022, beer, wine and spirits merchant wholesalers, NAICS 4248, national) | ${pct(WHOLESALER_MARGIN)} |`,
    "",
    "## Consumer price",
    "",
    "*P* is the grocery price per $1 of today's state-store price; the premium is *P* − 1.",
    "",
    "- **B, DABS wholesale at today's shelf price.** The grocer pays DABS $1 and prices for margin *g*: *P* = 1 / (1 − *g*).",
    "- **C, private wholesale with a state charge equal to DABS's margin.** The wholesaler buys at *L* and prices for *w*, the grocer prices for *g*, and the charge μ is added: *Q* = *L* / ((1 − *w*)(1 − *g*)), *P* = *Q* + μ.",
    "- **D, direct supply.** A producer's delivery cost and price to grocers take the wholesaler's place; neither is measured, so D is shown across a grid (below). At the reference inputs its results equal C's.",
    `- **E, hybrid.** DABS supplies ${pct(HYBRID_DABS_SHARE, 0)} of grocery wine on B's terms and private supply the rest on C's; a second collection system adds ${pct(HYBRID_EXTRA_ADMIN_SHARE, 0)} of *A*. Both shares are illustrative.`,
    "",
    "## Net change for the state per dollar that moves",
    "",
    "With *s* the DABS cost avoided per $ that moves (zero in every headline), *a* = *A* / *M* the administration per $, and *h* any extra cost of supplying grocers (zero):",
    "",
    "- Take inside DABS's price to grocers (B): *N* = *P*(1 − *g*) − *L* − μ + τ(*P* − 1) + *s* − *h* − *a*.",
    "- Take as a charge on the sellers' price (C, D): *N* = *P* − *Q* − μ + τ(*P* − 1) + *s* − *a*.",
    "",
    `Each wine dollar that moves takes DABS's margin μ out of today's receipts. B and C put exactly μ back, so with no savings each design's gain is the sales tax on the higher price, τ(*P* − 1): ${pct(sales(1 + r.results.find((x) => x.def.id === "B")!.premium), 2)} per $ under B and ${pct(sales(1 + r.results.find((x) => x.def.id === "C")!.premium), 2)} under C, before the administration.`,
    "",
    "## Who moves",
    "",
    `The share of household purchases that moves is s₀ at equal prices. In the price-sensitive cases it falls in a straight line to zero at a convenience limit λ: share = s₀ × min(1, max(0, 1 − (*P* − 1) / λ)), with λ in {${CONVENIENCE_LIMITS.map((l) => pct(l, 0)).join(", ")}}. The limits come from the purchase-flow model and have no source. The wine that moves is *V* = *M* × share / s₀, and the annual result is *N* × *V* − *A* (the engine counts *A* once, whatever moves).`,
    "",
    "## Break-even conditions",
    "",
    "- **Share that must move** (the engine is linear in the share): *s*\\* = min(1, −Net(0) / slope), where Net(0) is the result when nothing moves (−*A*) and the slope is the change per unit of share.",
    "- **Highest grocer margin at price *P*.** B: *g*\\* = 1 − (*L* + μ − τ(*P* − 1) − *s* + *h* + *a*) / *P*. C, D: *g*\\* = 1 − *L* / ((1 − *w*)(*P* − μ + τ(*P* − 1) + *s* − *a*)).",
    "- **Lowest price at margin *g*.** B: *P*\\* = (*L* + μ + τ − *s* + *h* + *a*) / (1 − *g* + τ). C, D: *P*\\* = (*Q* + μ + τ − *s* + *a*) / (1 + τ).",
    "- **Highest distribution margin at price *P* and margin *g*** (C, D): *w*\\* = 1 − *L* / ((1 − *g*)(*P* − μ + τ(*P* − 1) + *s* − *a*)).",
    "",
    "Every solution is bounded: a share in [0, 1], a margin below 1, a price to grocers no lower than DABS's landed cost. No break-even is found by adding demand.",
    "",
    "| Design | Share that must move, no savings / allocated | Lowest premium at a 28% grocer margin, no savings / allocated | Grocer margin at a 10% premium, no savings (negative: no margin works) | Savings per $ needed at its own lever |",
    "|---|---|---|---|---|",
    ...designs
      .filter((x) => x.def.id !== "E")
      .map((x) => {
        const b = x.breakEven;
        return `| ${x.def.label} | ${p(b.minShift.none)} / ${p(b.minShift.allocated)} | ${p(b.minPremiumAtReference.none)} / ${p(b.minPremiumAtReference.allocated)} | ${p(b.grocerMarginAt10)} | ${(b.savingsNeeded * 100).toFixed(2)}¢ |`;
      }),
    "",
    `At a ${pct(RETAILER_TARGET, 0)} grocer margin with no savings, the state breaks even at a premium of ${pct(r.frontierAtReference.wholesalePrice)} with the take in DABS's price, ${pct(r.frontierAtReference.retailChargeReference)} with a retail-level charge and a ${pct(WHOLESALER_MARGIN)} wholesaler, and ${pct(r.frontierAtReference.retailChargeNoDistribution)} if delivery cost nothing. A charge design matches B's lowest premium only if delivery costs less than ${pct(r.distributionToMatchB)} of the price to grocers.`,
    "",
    "## Results",
    "",
    "Net change in state revenue against today, FY2025 dollars a year. The savings cases are illustrative and never in a headline:",
    "",
    ...SAVINGS_CASES.map((s) => `- **${s.label}.** ${s.note}`),
    "",
    `| Design | Premium | Savings case | ${[null, ...CONVENIENCE_LIMITS].map(lim).join(" | ")} |`,
    `|---|---|---|${[null, ...CONVENIENCE_LIMITS].map(() => "---").join("|")}|`,
    ...designs.flatMap((x) =>
      SAVINGS_CASES.map((s) => `| ${x.def.short} | ${pct(x.premium)} | ${s.id.replace("_", " ")} | ${[null, ...CONVENIENCE_LIMITS].map((l) => m(x.cases.find((c) => c.savings === s.id && c.limit === l)!.net)).join(" | ")} |`),
    ),
    "",
    `License fees that cover the administration exactly add ${m(t.admin)} to every case (${m(t.admin * (1 + HYBRID_EXTRA_ADMIN_SHARE))} for E): about ${usd0(r.licenseFeePerGroceryStore)} a year for each of ${UTAH_GROCERY_ESTABLISHMENTS.count} grocery establishments (Census County Business Patterns ${UTAH_GROCERY_ESTABLISHMENTS.year}). That is a design choice, not a result.`,
    "",
    "## Direct supply across its unmeasured inputs (no savings)",
    "",
    "| Delivery cost, share of the price to grocers | Producer's price over DABS's landed cost | Premium | Fixed share | Limit 30% |",
    "|---|---|---|---|---|",
    ...r.direct.map((x) => `| ${pct(x.costShare)} | ${pct(x.producerPremium, 0)} | ${pct(x.premium)} | ${m(x.net)} | ${m(x.netLimit30)} |`),
    "",
    "## What is measured and what is not",
    "",
    "- **From sources (software-transcribed, not reviewed by a person):** W (DABS's FY2025 sales times wine's share in its monthly reports), the grocery establishments (Census CBP), and *g* and *w* as national references (Census 2022 retail and wholesale trade, all products), not measured for wine in Utah.",
    "- **Assumed:** μ and L (DABS's FY2025 all-product gross margin, applied to wine); H (DABS's FY2025 off-premise share of all its sales, read from a chart, applied to wine); τ (the state portion in Tax Commission Publication 25, taken as FY2025's rate); s₀, the convenience limits, *A* and the hybrid's shares (illustrative); that grocers price for *g* on wine; and that state-store prices stay as they are.",
    "- **Not modeled:** drinking more or less, beer or spirits switching (see the purchase-flow section of the technical appendix), out-of-state purchases, rural package agencies' contracts, delivery to grocers under B, enforcement costs beyond *A*.",
    "- Every input with its provenance class: [`financial-inputs.md`](financial-inputs.md).",
    "",
    "## Reproduce",
    "",
    "In `web/`: `npm run export:grocery-wine` writes `data/processed/grocery-wine/policy_designs.json` and `policy_designs_*.csv`; `npm run docs:framework` rewrites this file; `npm run brief:legislative` rewrites the two-page briefing. Then `python -B scripts/policy_designs_check.py` recomputes every figure, and `npx vitest run src/lib/policyDesigns.test.ts` checks the closed forms against the engine. A passing check verifies arithmetic only.",
    "",
  ].join("\n");
}

// The plan's provenance classes (section 14). Nothing here is "human reviewed": no person has reviewed any value.
const CLASS: Record<Standing, string> = {
  source: "Official source, transcribed by software",
  derived: "Calculated from source data",
  statute: "Official source (law as read online)",
  reference: "Reference point, not measured for this use",
  assumption: "Model assumption",
  illustrative: "Illustrative scenario",
  policy: "Policy choice",
};
const CLASS_BY_ID: Record<string, string> = {
  U05: "Official source; that it applies to FY2025 is an assumption",
  U15: "External scholarly estimate",
};

/** Every financial input behind the grocery-wine results, with its provenance class. */
export function inputsDoc(r: PolicyDesignsReport = defaultDesignsReport()): string {
  const design: { id: string; label: string; value: string; cls: string; note: string }[] = [
    { id: "P01", label: "Convenience limits (price-sensitive cases)", value: CONVENIENCE_LIMITS.map((l) => pct(l, 0)).join(", "), cls: CLASS.illustrative, note: "The grocery premium at which no household moves; from the purchase-flow model (F20), no source." },
    { id: "P02", label: "Hybrid: DABS's share of grocery wine", value: pct(HYBRID_DABS_SHARE, 0), cls: CLASS.illustrative, note: "No design specifies the split." },
    { id: "P03", label: "Hybrid: second collection system", value: `${pct(HYBRID_EXTRA_ADMIN_SHARE, 0)} of the administration`, cls: CLASS.illustrative, note: "No estimate exists." },
    { id: "P04", label: "Illustrative bottles, landed cost", value: BASKET.map((b) => `$${b.landed}`).join(", "), cls: CLASS.illustrative, note: "Price points, not products; no product's procurement cost is in the dataset." },
    { id: "P05", label: "Utah grocery establishments", value: `${UTAH_GROCERY_ESTABLISHMENTS.count} (${UTAH_GROCERY_ESTABLISHMENTS.year})`, cls: CLASS.source, note: "Census County Business Patterns, NAICS 445110; used only to size a license fee." },
    { id: "P06", label: "Largest competitive grocery premium", value: pct(r.constraints.maxPremium, 0), cls: CLASS.policy, note: "A threshold for the classification, not a source; changing it changes only the verdicts." },
    { id: "P07", label: "Smallest viable grocer margin", value: pct(r.constraints.minGrocerMargin, 0), cls: CLASS.reference, note: "U12, used as a threshold." },
    { id: "P08", label: "Direct supply: delivery cost and producer price grid", value: `${DIRECT_COST_SHARES.map((v) => pct(v)).join(", ")} × ${PRODUCER_PREMIUMS.map((v) => pct(v, 0)).join(", ")}`, cls: CLASS.illustrative, note: "Neither is measured; D is reported across the grid." },
  ];
  const row = (id: string, label: string, value: string, cls: string, note: string) => `| ${id} | ${esc(label)} | ${esc(value)} | ${cls} | ${esc(note)} |`;
  return [
    "# Financial inputs: grocery-wine model",
    "",
    STATUS("`web/src/lib/wineAlternatives.ts` (`ASSUMPTIONS`) and `web/src/lib/policyDesigns.ts`"),
    "",
    "Every input behind the grocery-wine results, classed as the development plan of 2026-11-19 asks (section 14). **No value has been reviewed by a person**: official figures were transcribed or parsed by software and checked by an AI assistant, which is not a human review. Agreement between the TypeScript model and the independent Python checks verifies arithmetic, not inputs.",
    "",
    "| Id | Input | Value | Class | Source or note |",
    "|---|---|---|---|---|",
    ...ASSUMPTIONS.map((a) => row(a.id, a.label, a.value, CLASS_BY_ID[a.id] ?? CLASS[a.standing], a.note)),
    ...design.map((d) => row(d.id, d.label, d.value, d.cls, d.note)),
    "",
    "**Unavailable or unknown:** DABS's avoidable costs by store, delivery cost to grocers, how households choose a channel at a given price difference, grocers' margins on wine in Utah, package-agency contract terms, and the cost of licensing and enforcement. Each appears above as an assumption or an illustrative value, never as a measurement.",
    "",
  ].join("\n");
}

/** Path under the repository root → contents. */
export function frameworkDocs(): Record<string, string> {
  return {
    "docs/methods/policy-designs.md": methodsDoc(),
    "docs/methods/financial-inputs.md": inputsDoc(),
    "docs/briefings/utah-grocery-wine/statutory-change-matrix.md": matrixDoc(),
    "docs/briefings/utah-grocery-wine/proposed-framework.md": frameworkDoc(),
    "docs/briefings/utah-grocery-wine/public-health-and-enforcement.md": safeguardsDoc(),
    "docs/briefings/utah-grocery-wine/stakeholder-impacts.md": impactsDoc(),
    "docs/briefings/utah-grocery-wine/hard-questions.md": questionsDoc(),
    "docs/analyses/interstate-evidence.md": statesDoc(),
  };
}
