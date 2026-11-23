// The printable two-page legislative and technical briefing, rendered as HTML from the same model outputs as the site
// (policyDesigns.ts, framework.ts, statutes.ts). `npm run brief:legislative` writes the HTML and prints it to PDF with
// headless Edge; legislativeBrief.test.ts fails when the committed HTML differs from what the model renders.
import { STATE_CASES, STRENGTH_LABEL, headline, type StateCase, type StateEvidence } from "./framework";
import { CONSUMER_ACCESS as AC } from "./consumerAccess.generated";
import { POLICY_DESIGNS_METHOD, SAVINGS_CASES, UTAH_GROCERY_ESTABLISHMENTS, defaultDesignsReport, type DesignId, type PolicyDesignsReport } from "./policyDesigns";
import { samePriceCase, samePriceHeadline } from "./samePrice";
import { STATUTES_METHOD, amendmentsFor, openQuestionsFor } from "./statutes";
import { WINE_ALTERNATIVES_METHOD } from "./wineAlternatives";
import { withArticle, minus } from "./format";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const pct = (v: number, d = 1) => `${minus((v * 100).toFixed(d))}%`;
const m = (v: number) => `${v < -0.5 ? "−" : v > 0.5 ? "+" : ""}$${(Math.abs(v) / 1e6).toFixed(2)}M`;
const sentences = (s: string, from: number, n: number) => s.split(/(?<=\.) /).slice(from, from + n).join(" ");
// One line per state for print: which field and evidence each draws on is chosen here; the words stay in framework.ts.
const STATE_LINE: Record<string, (c: StateCase) => [string, StateEvidence]> = {
  tn: (c) => [sentences(c.evidence[0].text, 1, 1), c.evidence[0]],
  co: (c) => [`${sentences(c.legal, 0, 1)} ${sentences(c.evidence[2].text, 0, 1)}`, c.evidence[2]],
  pa: (c) => [`${sentences(c.legal, 0, 1)} ${sentences(c.evidence[0].text, 0, 1)}`, c.evidence[0]],
};

export function legislativeBriefHtml(r: PolicyDesignsReport = defaultDesignsReport()): string {
  const h = headline(r);
  const d = (id: DesignId) => r.results.find((x) => x.def.id === id)!;
  const net = (id: DesignId, savings: "none" | "allocated", limit: number | null) => d(id).cases.find((c) => c.savings === savings && c.limit === limit)!.net;
  const rows = (["B", "C", "D", "E"] as DesignId[])
    .map(
      (id) =>
        `<tr><th scope="row">${esc(d(id).def.label)}</th><td>+${pct(d(id).premium)}</td><td>${m(net(id, "none", null))}</td><td>${m(net(id, "none", 0.6))}</td><td>${m(net(id, "none", 0.3))}</td><td>${m(net(id, "allocated", null))}</td><td>${amendmentsFor(id).length} / ${openQuestionsFor(id).length}</td></tr>`,
    )
    .join("");
  const s = samePriceHeadline();
  const sameRows = [0.05, 0.1, 0.15, 0.2]
    .map((g) => `<tr><th scope="row">${pct(1 - g, 0)} (grocer keeps ${pct(g, 0)})</th>${SAVINGS_CASES.map((c) => `<td>${m(samePriceCase(g, c.id, true).net)}</td>`).join("")}</tr>`)
    .join("");
  const states = STATE_CASES.filter((c) => STATE_LINE[c.id])
    .map((c) => {
      const [text, ev] = STATE_LINE[c.id](c);
      return `<li><b>${esc(c.state)}: ${esc(c.change[0].toLowerCase() + c.change.slice(1))} (${esc(c.date.replace(/;.*/, ""))}).</b> ${esc(text)} <i>${esc(STRENGTH_LABEL[ev.strength])}.</i></li>`;
    })
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Grocery wine in Utah: legislative and technical briefing (draft)</title>
<style>
@page { size: letter; margin: 0.45in 0.5in; }
body { font: 8.6pt/1.32 "Segoe UI", Arial, sans-serif; color: #1a1a1a; margin: 0; }
h1 { font-size: 14pt; margin: 0 0 2px; }
h2 { font-size: 9.6pt; margin: 7px 0 2px; color: #1f3d66; border-bottom: 1px solid #c8d2e0; }
p, ul { margin: 2px 0 4px; }
ul { padding-left: 14px; }
li { margin: 0 0 2px; }
.status { font-size: 7.6pt; color: #444; border: 1px solid #c9c9c9; padding: 3px 5px; margin: 3px 0 4px; }
table { border-collapse: collapse; width: 100%; font-size: 7.9pt; margin: 2px 0 3px; }
th, td { border-bottom: 1px solid #ddd; padding: 1.5px 4px; text-align: right; vertical-align: top; }
th[scope="row"], thead th:first-child { text-align: left; font-weight: 600; }
thead th { border-bottom: 1.5px solid #888; font-weight: 600; }
.cols { column-count: 2; column-gap: 0.28in; }
.cols h2:first-child { margin-top: 0; }
.note { font-size: 7.4pt; color: #444; }
.page2 { break-before: page; }
</style>
</head>
<body>
<h1>Grocery wine in Utah: design options and fiscal effects</h1>
<p><b>Legislative and technical briefing · Proof &amp; Policy · draft, model ${POLICY_DESIGNS_METHOD}</b></p>
<p class="status">Draft for review by qualified legal and fiscal experts. Computed by the project's models from FY2025 DABS figures that software transcribed and no person has reviewed. Not a fiscal note, not legal advice, not attorney-reviewed; written with AI assistance (Claude). The maintainer supports grocery wine; the analysis reports favorable and unfavorable results alike.</p>
<div class="cols">
<h2>Executive summary</h2>
<ul>
<li>Five designs were compared: today (A), DABS selling to licensed grocers (B), licensed private wholesale with a state charge (C), producers supplying grocers (D), and a hybrid (E). <b>None of B to E meets every constraint</b>: the state breaking even in every switching case with no store savings, a grocery price within ${pct(r.constraints.maxPremium, 0)} of a state store, and ${withArticle(pct(r.constraints.minGrocerMargin, 0))} grocer margin.</li>
<li><b>B is the best-supported design.</b> With no store costs counted as saved, the state is ${m(h.bFixed)} a year ahead if 30% of household wine purchases move; ${m(h.b60)} if price-sensitive shoppers mostly stay; ${m(h.b30)} if almost none move, which is the new administration (a placeholder). Fees that cover the administration remove that loss.</li>
<li><b>Wine can sell at today's price.</b> With DABS selling to grocers at ${pct(s.priceToGrocers, 0)} of its shelf price and grocers charging the state-store price, as state stores and package agencies must (32B-2-503(2), -605(7)), the state gives up ${m(s.cost.none).replace("+", "")} a year if DABS saves nothing and ${m(s.cost.longerRun).replace("+", "")} if its wages fall with sales (fees cover the administration). Half of Utahns live within ${AC.distance.grocery.median.toFixed(1)} miles of a grocery store and ${AC.distance.stateStore.median.toFixed(1)} of a state store.</li>
<li>B needs ${amendmentsFor("B").length} statutory changes and leaves ${openQuestionsFor("B").length} legal questions open; C and D need ${amendmentsFor("C").length}, E ${amendmentsFor("E").length}.</li>
</ul>
<h2>Current law</h2>
<ul>
<li>Wine is liquor under Title 32B; an off-premise beer retailer license (32B-7) covers beer only. Wine is sold to take home only at state stores and contract package agencies.</li>
<li>DABS must mark wine up at least 88.5% over landed case cost (32B-2-304(2)(b)). Utah has no wine excise; the state's revenue is DABS's margin and sales tax.</li>
<li>Manufacturers may sell liquor in Utah only to the department or military installations (32B-11-208); out-of-state sellers ship only to the department (32B-4-401(2)).</li>
<li>Federal law (27 U.S.C. 203, 205) requires basic permits for importers, producers and wholesale buyers and restricts suppliers' inducements to retailers; the text read does not require three tiers.</li>
</ul>
<h2>Proposed legal design (framework: DABS wholesale at today's shelf price)</h2>
<ul>
<li>A commission-issued grocery wine license with local consent, on the pattern of the off-premise beer state license (32B-7-401 to -409); grocery stores only in a first phase (${UTAH_GROCERY_ESTABLISHMENTS.count} grocery establishments in ${UTAH_GROCERY_ESTABLISHMENTS.year}).</li>
<li>DABS sells sealed wine to licensees below its shelf price, at a price the bill sets apart from the markup floor; grocers charge the state-store price.</li>
<li>Beer's safeguards extended to wine: training, ID on every sale (electronic at the register), display rules, compliance checks, penalties; a seller's minimum age set in the bill.</li>
<li>Fees covering the administration ($${Math.round(h.fee).toLocaleString("en-US")} a year per store if all ${UTAH_GROCERY_ESTABLISHMENTS.count} were licensed); yearly DABS reporting; a review after three years.</li>
</ul>
</div>
<h2>Fiscal comparison: change in state revenue against today, FY2025 dollars a year</h2>
<table>
<thead><tr><th>Design</th><th>Price vs state store</th><th>No savings, 30% move</th><th>No savings, limit 60%</th><th>No savings, limit 30%</th><th>Allocated savings, 30% move</th><th>Law: changes / open</th></tr></thead>
<tbody>${rows}</tbody>
</table>
<p class="note">"Limit" cases: shoppers are price-sensitive and nobody moves at a premium of 60% or 30%. "Allocated savings": DABS's FY2025 card fees, agency contracts and bags allocated by sales (2.28¢ a dollar), an allocation, not a measured saving. The new administration ($0.50M a year) is a placeholder; no estimate exists.</p>
<h2>Same shelf price: change in state revenue by DABS's price to grocers, FY2025 dollars a year</h2>
<table>
<thead><tr><th>DABS's price to grocers (share of shelf price)</th><th>No savings</th><th>Allocated savings</th><th>Wages fall too</th></tr></thead>
<tbody>${sameRows}</tbody>
</table>
<p class="note">Shoppers pay today's price in every row; 30% of household wine purchases move; license fees cover the administration. Savings beyond none are illustrative allocations, not measured.</p>
<div class="cols page2">
<h2>Impacts on government revenue</h2>
<ul>
<li>Net change counts DABS's margin and any charge, sales tax, store costs saved (zero in the headline) and the new administration. Gross receipts are not net revenue.</li>
<li>Dedicated deposits are figured on DABS's liquor sales (32B-2-304(5), -305(4)); under B, whether sales to grocers count is open; under C and D a charge must be allocated to keep the funds whole.</li>
<li>Break-even under B with no savings: at least ${pct(h.B.breakEven.minShift.none ?? NaN)} of household wine purchases must move to grocers to cover the administration; at a 10% premium, grocers could keep a margin of only ${pct(h.B.breakEven.grocerMarginAt10)}.</li>
<li>State stores lose up to ${pct(h.B.dabsVolumeLost.fixed)} of DABS's wine sales if 30% of household purchases move; rural package agencies' effect is not estimated.</li>
</ul>
<h2>Public-health and enforcement considerations</h2>
<ul>
<li>The Community Preventive Services Task Force recommends limiting outlet density (2007) and recommends against further privatization of retail sales where government controls them (2011). More outlets are not harmless; prices above state stores damp the effect by an unmeasured amount.</li>
<li>Already required for off-premise beer: a state license, proof of age before every sale, staff training, compliance-check reimbursement, penalties for sales to minors. New for wine: limits on eligible stores, electronic ID at the register, promotion rules, program reporting.</li>
<li>Indicators: compliance-check failure rates, licenses by county, wine and total alcohol volume, crashes and injuries, DABS revenue, dedicated deposits, store and agency sales. A change after adoption does not show the law caused it.</li>
</ul>
<h2>Relevant interstate evidence</h2>
<ul>${states}</ul>
<p class="note">Tennessee and Colorado tax wine by excise and have private wholesale; a Tennessee percentage does not transfer to Utah's monopoly margin. Pennsylvania, where the state stays the wholesaler, is the closest structure to B.</p>
<h2>Legal changes required (design B)</h2>
<ul>${amendmentsFor("B")
    .map((x) => `<li>${x.id} ${esc(x.provision)}. ${esc(x.cite)}.</li>`)
    .join("")}</ul>
<p class="note">Open for B: ${openQuestionsFor("B")
    .map((x) => `${x.id} ${esc(x.provision.toLowerCase())}`)
    .join("; ")}.</p>
<h2>Remaining verification requirements</h2>
<ul>
<li>Human review of every transcribed FY2025 DABS figure and the statute readings.</li>
<li>DABS's avoidable costs, the administration cost, and delivery cost to grocers.</li>
<li>How households choose between a grocer and a state store at a given price difference.</li>
<li>Grocers' margins and willingness to sell wine at them; package-agency contract terms.</li>
<li>27 CFR part 1 (federal wholesaler permits for direct supply); Title 59, Chapter 12 (sales-tax base).</li>
</ul>
<h2>Sources and reproduction</h2>
<p class="note">DABS FY2025 annual report and FY2026 monthly sales; Utah Code Title 32B (read at le.utah.gov, 2026-11-19); 27 U.S.C. 203, 205; Census County Business Patterns 2023; Census 2022 wholesale and retail trade surveys; CDC Community Guide; Sun et al., <i>Am. J. Agric. Econ.</i> 108(5) (doi:10.1111/ajae.70033, abstract only); Colorado 2022 Blue Book and Secretary of State results; PLCB annual report FY2024-25. Methods ${POLICY_DESIGNS_METHOD}, ${WINE_ALTERNATIVES_METHOD}, ${STATUTES_METHOD}. Rebuild: <code>npm run brief:legislative</code> in <code>web/</code>; tables in <code>data/processed/grocery-wine/policy_designs_*.csv</code>; full derivations in <code>docs/methods/policy-designs.md</code> and the technical appendix.</p>
</div>
</body>
</html>
`;
}
