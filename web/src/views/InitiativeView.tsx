// A focused initiative page (lib/initiatives.ts, INITIATIVE_METHOD): one proposed change in one state as a short brief.
// The advocate's goal is shown apart from the analysis; the figures come from the scenario tool's models and the worked
// proposal's own inputs, so they match the tool and the briefing script. Works without the dataset's metric files;
// prints as a brief.
import { useMemo } from "react";
import { Go } from "../components/common";
import { ARRANGEMENTS_METHOD, type BreakEven } from "../lib/arrangements";
import { INITIATIVES, INITIATIVE_METHOD, ROBUSTNESS_METHOD, initiativeById, initiativeFigures, type Initiative, type InitiativeFigures, type SizeRow } from "../lib/initiatives";
import { SUBSTITUTION_METHOD } from "../lib/substitution";
import { ASSUMPTIONS, MISSING_CAPABILITIES, WINE_ALTERNATIVES_METHOD, alternativesReport, type AltResult } from "../lib/wineAlternatives";
import { useParams } from "../lib/url";
import { FlowsSection } from "./FlowsSection";
import { PriceShareSection } from "./PriceShareSection";

const money = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : `${v < 0 ? "−" : ""}$${Math.round(Math.abs(v)).toLocaleString("en-US")}`);
const millions = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : `${v < 0 ? "−" : v > 0 ? "+" : ""}$${(Math.abs(v) / 1e6).toFixed(1)}M`);
const pct = (v: number | null | undefined, digits = 1) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : `${(v * 100).toFixed(digits)}%`);
const amount = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : `$${(Math.abs(v) / 1e6).toFixed(1)}M`);
const cents = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : `${(v * 100).toFixed(1)}¢`);

function breakEvenText(b: BreakEven, kind: "tax" | "discount"): string {
  if (b.status === "found" && b.value !== null) return kind === "tax" ? `a ${pct(b.value)} tax on the sellers' price` : `a discount of at most ${pct(b.value)}`;
  if (b.status === "not_needed") return "none needed";
  if (b.status === "none_in_range") return "none in the supported range";
  return "not computable";
}

/** A tested range's ends, in the row's own units. */
function rangeText(r: SizeRow): string {
  if (r.format === "money") return `${money(r.low)} to ${money(r.high)}`;
  if (r.format === "scale") return `${pct(r.low)} to ${pct(r.high)} of the modelled wine`;
  return `${pct(r.low)} to ${pct(r.high)}`;
}

function enteredText(r: SizeRow): string {
  if (r.format === "money") return money(r.entered);
  if (r.format === "scale") return "all DABS wine classes";
  return pct(r.entered);
}

const BASIS_WORDS: Record<SizeRow["basis"], string> = {
  evidence: "from saved sources",
  statute: "statutory reference points",
  illustrative: "illustrative",
};

const STANDING_WORDS: Record<SizeRow["standing"], string> = {
  observed: "observed",
  derived: "derived from a source",
  chosen: "chosen assumption",
  policy: "policy choice",
};

const span = (a: number, b: number) => `${millions(Math.max(a, b))} to ${millions(Math.min(a, b))}`;

export function InitiativeView() {
  const params = useParams();
  const init = initiativeById(params.get("i")) ?? INITIATIVES[0];
  const f = useMemo(() => initiativeFigures(init), [init]);
  const c = f.comparison;
  const P = c.private;
  const Wh = c.wholesale;
  // Arrangement 3 on the private structure, channel shift (the worked example's guarantee).
  const g1 = c.guarantees[0]?.cases.find((e) => e.basis === "shift") ?? null;
  const s1 = f.substitution.private;
  const s2 = f.substitution.wholesale;
  const deposits = f.school + f.enforcement;
  // Arrangement 2 without a guarantee: if DABS's sales to grocers carry the deposits, the funds lose the deposits on the discount only.
  const d = Wh.x.discount ?? 0;
  const schoolLossIfApplies = init.worked.rates.school * d * f.moved;

  return (
    <article className="initiative" aria-labelledby="in-h">
      {INITIATIVES.length > 1 && (
        <nav className="no-print small" aria-label="Initiatives">
          {INITIATIVES.map((i) => (
            <Go key={i.id} to={{ v: "initiative", i: i.id }} reset>
              {i.title}
            </Go>
          ))}
        </nav>
      )}
      <header className="panel">
        <h2 id="in-h">{init.title}</h2>
        <p className="warn">
          <strong>Draft.</strong> {init.status}
        </p>
        <p className="small muted">
          This is an independent, personal research project. It is not a government agency, a nonprofit or an institution with
          staff, and no agency has reviewed it. Figures are computed on this page from the scenario tool's model ({ARRANGEMENTS_METHOD}
          ; {SUBSTITUTION_METHOD}; page {INITIATIVE_METHOD}, text as of {init.asOf}).
        </p>
      </header>

      <div className="initiative-split">
        <section className="panel advocacy" aria-labelledby="in-goal">
          <h3 id="in-goal">Advocacy goal</h3>
          <p>
            {init.advocacy.who} {init.advocacy.goal}
          </p>
        </section>
        <section className="panel" aria-labelledby="in-prop">
          <h3 id="in-prop">The proposed change</h3>
          <ul>
            {init.proposal.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
      </div>

      <section className="panel" aria-labelledby="in-find">
        <h3 id="in-find">What the analysis finds</h3>
        <ul className="findings">
          <li>
            <strong>In the brief's two reference cases both structures lower state revenue:</strong> {millions(P.lines?.net)} a year with
            private wholesalers and a 20% replacement tax, {millions(Wh.lines?.net)} with DABS as wholesaler at a 20% discount, against{" "}
            {amount(f.baseline)} the state collects on wine today. These are conditional on those levers and assumptions, with only existing wine
            purchases moving. Other arrangements keep state revenue whole at fixed volume (<a href="#in-alt">policy alternatives</a>), by
            changing who pays the grocer, and the result also turns on where grocery wine comes from (<a href="#in-flows">purchase flows</a>).
          </li>
          <li>
            <strong>The reason is structural.</strong> At today's prices the state and private sellers split the same margin. The state
            breaks even only if sellers keep about {cents(P.sellersAtBreakEven?.perDollar)} of each dollar of today's price, a gross margin of{" "}
            {pct(Wh.sellersAtBreakEven?.margin)} to {pct(P.sellersAtBreakEven?.margin)} on their own price. Nationally, grocery stores keep about{" "}
            {Math.round((f.settings.grocerMargin ?? NaN) * 100)} cents of each dollar of their own sales, and alcohol wholesalers about{" "}
            {Math.round((f.settings.wholesalerMargin ?? NaN) * 100)} cents of theirs.
          </li>
          <li>
            <strong>With the 20% tax or 20% discount held fixed, the loss holds across every input range tested.</strong> No single input
            moved within its tested range, and no combination of the documented bounds, brings either to break even; a smaller discount
            or a larger tax does (see the alternatives in the graph package, wine-alternatives@1.0). It would take sellers keeping about{" "}
            {cents(f.robustness.keepAtBreakEven)} a dollar, grocery wine priced {pct((Wh.viability?.shift.shelf ?? NaN) - 1, 0)} (DABS supply)
            to {pct((P.viability?.shift.shelf ?? NaN) - 1, 0)} (private) above state stores, or an untested switch from beer (
            <a href="#in-be">what would have to be true</a>).
          </li>
          <li>
            <strong>Protecting school meals is a different, smaller goal.</strong> Keeping the school-meals and enforcement funds whole
            costs about {amount(deposits)} a year. Either structure's proceeds can pay it, but the General Fund and other state funds still
            bear the whole loss.
          </li>
          <li>
            <strong>Beer-to-wine switching is an untested hypothesis.</strong> To offset the loss with no change in total alcohol, Utah would
            have to buy {pct(s2.threshold.swap, 0)} (DABS wholesale) to {pct(s1.threshold.swap, 0)} (private) more wine in place of beer. No study
            measures this. The purchase-flow section restates it per design and separates spirits, which carry DABS's markup today.
          </li>
        </ul>
      </section>

      <section className="panel" aria-labelledby="in-cmp">
        <h3 id="in-cmp">The worked example, FY2025, per year</h3>
        <p className="small">
          {money(f.moved)} of wine (30% of household purchases) moves to grocers at today's prices. State government only; all state funds
          together, so transfers between funds are not revenue.
        </p>
        <div className="table-wrap">
          <table className="data initiative-table">
            <thead>
              <tr>
                <th scope="col">Per year</th>
                <th scope="col" className="num">Today</th>
                <th scope="col" className="num">Private wholesale, 20% replacement tax</th>
                <th scope="col" className="num">DABS wholesale, 20% discount to grocers</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">State revenue from wine</th>
                <td className="num">{money(f.baseline)}</td>
                <td className="num">{money(P.lines?.proposedRevenue)}</td>
                <td className="num">{money(Wh.lines?.proposedRevenue)}</td>
              </tr>
              <tr>
                <th scope="row">State margin given up on the wine that moves</th>
                <td className="num">—</td>
                <td className="num">{money(P.lines?.marginDisplaced)}</td>
                <td className="num">{money(Wh.lines?.marginDisplaced)}</td>
              </tr>
              <tr>
                <th scope="row">Collected instead (tax, or DABS's remaining margin)</th>
                <td className="num">—</td>
                <td className="num">{money(P.lines?.replacement)}</td>
                <td className="num">{money(Wh.lines?.replacement)}</td>
              </tr>
              <tr>
                <th scope="row">Store costs avoided, less new licensing and enforcement costs (assumed)</th>
                <td className="num">—</td>
                <td className="num">{money((P.lines?.costsAvoided ?? 0) - (P.lines?.newCosts ?? 0))}</td>
                <td className="num">{money((Wh.lines?.costsAvoided ?? 0) - (Wh.lines?.newCosts ?? 0))}</td>
              </tr>
              <tr className="total">
                <th scope="row">Net change in state revenue</th>
                <td className="num">—</td>
                <td className="num">
                  <strong>{money(P.lines?.net)}</strong>
                </td>
                <td className="num">
                  <strong>{money(Wh.lines?.net)}</strong>
                </td>
              </tr>
              <tr>
                <th scope="row">School-meals fund, with no guarantee (current law as read)</th>
                <td className="num">{money(f.school)} on this wine</td>
                <td className="num">{money(-f.school)}</td>
                <td className="num">
                  {money(-schoolLossIfApplies)} if DABS's sales to grocers carry the deposit; {money(-f.school)} if not
                </td>
              </tr>
              <tr>
                <th scope="row">What sellers keep per dollar</th>
                <td className="num">—</td>
                <td className="num">{cents(P.sellers?.perDollar)}, shared by wholesaler and grocer</td>
                <td className="num">{cents(Wh.sellers?.perDollar)} to the grocer</td>
              </tr>
              <tr>
                <th scope="row">Local sales tax</th>
                <td className="num" colSpan={3}>
                  Not modelled
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <AlternativesSection />
      <FlowsSection />

      <PriceShareSection />

      <section className="panel" aria-labelledby="in-two">
        <h3 id="in-two">Two different goals</h3>
        <div className="initiative-split">
          <div>
            <h4>Keep total state revenue unchanged</h4>
            <ul className="small">
              <li>Private structure: {breakEvenText(P.breakEven, "tax")}.</li>
              <li>DABS wholesale: {breakEvenText(Wh.breakEven, "discount")}.</li>
              <li>
                At today's prices these are arithmetic break-evens, not arrangements shown to be workable: sellers keep far less than national
                average margins, which are references rather than minimums (next section)
                {P.sellersAtBreakEven?.grocer && P.sellersAtBreakEven.grocer.perDollar < 0
                  ? `, and under the private structure the grocer would sell below its acquisition cost if the wholesaler kept its assumed ${pct(f.settings.wholesalerMargin)}`
                  : ""}
                .
              </li>
            </ul>
          </div>
          <div>
            <h4>Keep the school-meals and enforcement funds whole</h4>
            <ul className="small">
              <li>
                Guarantee: {money(f.school)} school meals + {money(f.enforcement)} enforcement = {money(deposits)} a year.
              </li>
              <li>
                Private structure: the {money(P.lines?.replacement)} tax covers it, leaving {money(g1?.remainder)} for the General Fund and other
                uses, which bear the whole {money(P.lines?.net)}. The tax must be at least {pct(g1?.coverLever?.value)} to cover it.
              </li>
              <li>DABS wholesale: its {money(Wh.lines?.replacement)} margin covers it; the other funds bear {money(Wh.lines?.net)}.</li>
              <li>
                A fixed guarantee is owed even if fewer sales move; any shortfall falls on other state money. A proportional one follows the
                sales actually lost. Either way, money moves between funds and none is created.
              </li>
            </ul>
          </div>
        </div>
      </section>

      <BreakEvenSection init={init} f={f} />

      <section className="panel" aria-labelledby="in-sub">
        <h3 id="in-sub">What if drinkers bought wine instead of beer?</h3>
        <p className="small">
          An untested hypothesis, shown as a threshold, not a forecast. Total alcohol is held constant: a gallon of wine replaces{" "}
          {s1.perGallon?.beerPerWine.toFixed(2)} gallons of beer. The beer price (${init.worked.swap.beerPrice} a gallon) is a placeholder with no
          source.
        </p>
        <div className="table-wrap">
          <table className="data initiative-table">
            <thead>
              <tr>
                <th scope="col">Per gallon of wine bought instead of beer</th>
                <th scope="col" className="num">Private</th>
                <th scope="col" className="num">DABS wholesale</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">State revenue from the wine</th>
                <td className="num">${s1.perGallon?.wine.toFixed(2)}</td>
                <td className="num">${s2.perGallon?.wine.toFixed(2)}</td>
              </tr>
              <tr>
                <th scope="row">Beer excise and sales tax given up</th>
                <td className="num">−${s1.perGallon?.beer.toFixed(2)}</td>
                <td className="num">−${s2.perGallon?.beer.toFixed(2)}</td>
              </tr>
              <tr className="total">
                <th scope="row">Wine needed in place of beer to offset the loss</th>
                <td className="num">
                  {Math.round(s1.threshold.wineGallons ?? 0).toLocaleString("en-US")} gal ({pct(s1.threshold.swap, 0)} more wine)
                </td>
                <td className="num">
                  {Math.round(s2.threshold.wineGallons ?? 0).toLocaleString("en-US")} gal ({pct(s2.threshold.swap, 0)} more wine)
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="small muted">
          After full retail privatization elsewhere, sales of the privatized drink rose by a median 44% and sales of other drinks fell by a
          median 2% (Hahn et al. 2012, as summarised in the project's model audit). Ending state retail sales is a bigger change than
          licensing grocers beside state stores, so these studies do not show how large a Utah effect would be.
        </p>
      </section>

      <section className="panel" aria-labelledby="in-assume">
        <h3 id="in-assume">Assumptions in the worked example</h3>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th scope="col">Input</th>
                <th scope="col">Value</th>
                <th scope="col">Standing</th>
              </tr>
            </thead>
            <tbody>
              {init.worked.assumptions.map((a) => (
                <tr key={a.item}>
                  <th scope="row">{a.item}</th>
                  <td>{a.value}</td>
                  <td>{a.basis === "source" ? "From a source (not yet reviewed)" : a.basis === "policy" ? "A policy choice" : "Assumption"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="initiative-split">
        <section className="panel" aria-labelledby="in-choices">
          <h3 id="in-choices">Choices for a sponsor</h3>
          <ul className="small">
            {init.choices.map((q) => (
              <li key={q.question}>
                <strong>{q.question}</strong> {q.options}
              </li>
            ))}
          </ul>
        </section>
        <section className="panel" aria-labelledby="in-ask">
          <h3 id="in-ask">Questions for DABS and legislative staff</h3>
          <ul className="small">
            {init.questions.map((q) => (
              <li key={q.ask}>
                <strong>{q.who}:</strong> {q.ask}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="panel" aria-labelledby="in-open">
        <h3 id="in-open">Unresolved</h3>
        <ul className="small">
          {init.unresolved.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </section>

      <section className="panel" aria-labelledby="in-src">
        <h3 id="in-src">Tools and sources</h3>
        <p className="no-print">
          <Go to={{ v: "scenario", ...f.values, eg: init.worked.proposalId }} reset className="button primary-link">
            Open the worked example in the scenario tool
          </Go>{" "}
          <Go to={{ v: "utah" }} reset className="button">
            Utah at a glance
          </Go>{" "}
          <Go to={{ v: "sources" }} reset className="button">
            All sources
          </Go>
        </p>
        <ul className="small source-list">
          {init.sources.map((s) => (
            <li key={s.label}>
              {s.url ? <a href={s.url}>{s.label}</a> : s.label}, {s.where}
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}

/** "What would have to be true for this to break even?": one assumption at a time, then the documented bounds together,
 * each labelled by what kind of result it is (initiative-robustness@1.0). */
function BreakEvenSection({ init, f }: { init: Initiative; f: InitiativeFigures }) {
  const r = f.robustness;
  const P = f.comparison.private;
  const Wh = f.comparison.wholesale;
  const set = f.settings;
  const x = f.inputs;
  const need = 1 - (1 - (set.wholesalerMargin ?? 0)) * (1 - (set.grocerMargin ?? 0));
  const pv = P.viability;
  const wv = Wh.viability;
  const zero = (id: string) => r.rows.find((z) => z.id === id)?.zero ?? { private: null, wholesale: null };
  const avoid = zero("avoidable");
  const margin = zero("margin");
  const s1 = f.substitution.private;
  const s2 = f.substitution.wholesale;
  const joint = (id: string) => r.joint.find((j) => j.id === id);
  const fav = joint("favourable");
  const unfav = joint("unfavourable");
  const ceil = joint("ceiling");
  const share = r.rows.find((z) => z.id === "share");
  return (
    <section className="panel" aria-labelledby="in-be">
      <h3 id="in-be">What would have to be true for this to break even?</h3>
      <p className="small">
        In the worked example every dollar of wine that moves to grocers costs the state {cents(-r.perDollar.private)} with private supply
        and {cents(-r.perDollar.wholesale)} with DABS supply, before the {money(x.newCosts)} of new costs. Moving more or less wine changes
        the size of the loss, not its sign. At today's shelf prices the state breaks even only if sellers keep no more than{" "}
        {cents(r.keepAtBreakEven)} of each dollar: the {cents(x.avoidableCost)} of store costs avoided, less the new costs spread over the
        wine that moves.
      </p>

      <h4>Where each structure would break even, one assumption at a time</h4>
      <div className="table-wrap">
        <table className="data initiative-table stack">
          <thead>
            <tr>
              <th scope="col">Assumption (worked example)</th>
              <th scope="col" className="num">Private supply</th>
              <th scope="col" className="num">DABS supply</th>
              <th scope="col">What kind of result</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Replacement tax, a policy choice ({pct(set.taxRate, 0)})</th>
              <td data-label="Private supply" className="num">at least {pct(P.breakEven.value)}</td>
              <td data-label="DABS supply" className="num">not used</td>
              <td data-label="Result">
                Arithmetic only. Sellers would keep {cents(P.sellersAtBreakEven?.perDollar)} of each dollar of today's price, a{" "}
                {pct(P.sellersAtBreakEven?.margin)} gross margin on their own price, where national averages come to about {pct(need, 0)} for
                wholesaler and grocer together (a reference, not a minimum).
                {P.sellersAtBreakEven?.grocer && P.sellersAtBreakEven.grocer.perDollar < 0
                  ? ` If the wholesaler kept its assumed ${pct(set.wholesalerMargin)}, the grocer would sell below its acquisition cost (a ${pct(P.sellersAtBreakEven.grocer.margin)} gross margin), so this is not a workable arrangement as specified.`
                  : ""}
              </td>
            </tr>
            <tr>
              <th scope="row">DABS discount to grocers, a policy choice ({pct(set.discount, 0)})</th>
              <td data-label="Private supply" className="num">not used</td>
              <td data-label="DABS supply" className="num">at most {pct(Wh.breakEven.value)}</td>
              <td data-label="Result">
                Arithmetic only. The grocer's gross margin would be {pct(Wh.sellersAtBreakEven?.margin)}, against about {pct(set.grocerMargin, 0)}{" "}
                for grocery stores nationally (a reference, not a minimum). Current law's 88.5% minimum wine markup leaves room for a discount of at most{" "}
                {pct(r.lawfulDiscount)} at this margin (a legal reading, not reviewed), so even this needs the statute changed.
              </td>
            </tr>
            <tr>
              <th scope="row">Store cost avoided per dollar, an assumption ({cents(x.avoidableCost)})</th>
              <td data-label="Private supply" className="num">at least {cents(avoid.private)}</td>
              <td data-label="DABS supply" className="num">at least {cents(avoid.wholesale)}</td>
              <td data-label="Result">
                Outside the tested range. It is more than all of DABS's operating expenses in FY{init.worked.data.fy}, {cents(r.bounds.avoidCeiling)} per
                dollar of sales, the most store savings could reach. Depreciation and interest are not costs that stop when sales move (appendix).
              </td>
            </tr>
            <tr>
              <th scope="row">Gross margin on wine, DABS's all-product figure ({pct(x.grossMargin)})</th>
              <td data-label="Private supply" className="num">at most {pct(margin.private)}</td>
              <td data-label="DABS supply" className="num">{margin.wholesale === null ? "no effect" : `at most ${pct(margin.wholesale)}`}</td>
              <td data-label="Result">
                Outside the tested range: below the {pct(r.statuteMargins.smallMaker)} margin that even the 49% small-maker markup implies. With
                DABS supply the margin cancels at today's prices.
              </td>
            </tr>
            <tr>
              <th scope="row">Grocery shelf price, sellers earning national average margins (example: the state-store price)</th>
              <td data-label="Private supply" className="num">
                {pct(pv?.shift.shelf)} of today's price, with a {pct(pv?.shift.lever)} tax
              </td>
              <td data-label="DABS supply" className="num">
                {pct(wv?.shift.shelf)}, with a discount of at most {pct(wv?.shift.lever)}
              </td>
              <td data-label="Result">
                Conditional. It assumes the same {pct(x.shift, 0)} of household purchases still moves to grocers charging that much more than
                state stores, which nothing measures. With the {String(x.elasticity).replace("-", "−")} price response, {pv?.all?.status === "found" ? `${pct(pv.all.shelf)} (private)` : "none (private)"}
                {" "}and {wv?.all?.status === "found" ? `${pct(wv.all.shelf)} (DABS)` : "no break-even with DABS supply"}.
              </td>
            </tr>
            <tr>
              <th scope="row">Wine bought instead of beer, a hypothesis (none)</th>
              <td data-label="Private supply" className="num">{pct(s1.threshold.swap, 0)} more wine</td>
              <td data-label="DABS supply" className="num">{pct(s2.threshold.swap, 0)} more wine</td>
              <td data-label="Result">Untested. No study measures it for Utah (next section).</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h4>How far the loss moves within the tested ranges</h4>
      <p className="small muted">
        Net change in state revenue, $ a year, each input moved alone with the others as in the example; then the documented bounds
        together. "Illustrative" ranges have no evidence behind them and are shown only to see how far the result moves. None is a
        probability.
      </p>
      <div className="table-wrap">
        <table className="data initiative-table stack">
          <thead>
            <tr>
              <th scope="col">Assumption and its standing</th>
              <th scope="col">Example</th>
              <th scope="col">Tested range</th>
              <th scope="col" className="num">Private supply</th>
              <th scope="col" className="num">DABS supply</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Worked example</th>
              <td data-label="Example">as above</td>
              <td data-label="Tested range">—</td>
              <td data-label="Private supply" className="num">{millions(r.net.private)}</td>
              <td data-label="DABS supply" className="num">{millions(r.net.wholesale)}</td>
            </tr>
            {r.rows.map((z) => (
              <tr key={z.id}>
                <th scope="row">
                  {z.label}
                  <span className="muted"> ({STANDING_WORDS[z.standing]})</span>
                </th>
                <td data-label="Example">{enteredText(z)}</td>
                <td data-label="Tested range">
                  {rangeText(z)} <span className="muted">({BASIS_WORDS[z.basis]}).</span> <span className="small muted">{z.why}</span>
                </td>
                <td data-label="Private supply" className="num">{span(z.atLow.private, z.atHigh.private)}</td>
                <td data-label="DABS supply" className="num">{span(z.atLow.wholesale, z.atHigh.wholesale)}</td>
              </tr>
            ))}
            {fav && unfav && (
              <tr className="total">
                <th scope="row">Store cost and margin at both ends of DABS's documented bounds together</th>
                <td data-label="Example">—</td>
                <td data-label="Tested range">
                  Cost avoided {pct(r.bounds.avoidLow)} to {pct(r.bounds.avoidHigh)} (with delivery, {pct(r.bounds.delivery)}, for private supply);
                  margin {pct(r.bounds.marginHigh)} to {pct(r.bounds.marginLow)}, the range DABS reported.
                </td>
                <td data-label="Private supply" className="num">{span(unfav.net.private, fav.net.private)}</td>
                <td data-label="DABS supply" className="num">{span(unfav.net.wholesale, fav.net.wholesale)}</td>
              </tr>
            )}
            {ceil && (
              <tr>
                <th scope="row">Every operating expense avoidable, no new costs (arithmetic only)</th>
                <td data-label="Example">—</td>
                <td data-label="Tested range">All operating expenses, {pct(r.bounds.avoidCeiling)} of sales (income statement, p. 30; the p. 32 summary labels the same total operating and non-operating), margin {pct(r.bounds.marginLow)}. No evidence supports it.</td>
                <td data-label="Private supply" className="num">{millions(ceil.net.private)}</td>
                <td data-label="DABS supply" className="num">{millions(ceil.net.wholesale)}</td>
              </tr>
            )}
            {ceil && (
              <tr>
                <th scope="row">Extreme arithmetic comparison, not a saving: depreciation and interest also treated as avoidable</th>
                <td data-label="Example">—</td>
                <td data-label="Tested range">
                  Adds the DABS report's non-operating depreciation and bond interest (p. 30), {pct(r.ceilingAllExpenses.avoid)} of sales; otherwise as above.
                  Depreciation is not a cash cost and interest is owed on existing debt, so neither stops when wine moves; the audited ACFR reports
                  different amounts (appendix). Not evidence that the proposal nearly pays for itself.
                </td>
                <td data-label="Private supply" className="num">{millions(r.ceilingAllExpenses.net.private)}</td>
                <td data-label="DABS supply" className="num">{millions(r.ceilingAllExpenses.net.wholesale)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h4>What does not change the net result</h4>
      <ul className="small">
        <li>
          The state sales tax rate, and whether DABS's sales to bars and restaurants are taxed: with grocery prices matched to state stores,
          sales tax on the wine that moves is the same either way, as long as the replacement tax is part of the price sales tax applies to
          (appendix). Untaxed licensee sales would lower today's revenue level by about{" "}
          {amount((x.salesTax ?? 0) * (1 - (x.eligible ?? 1)) * (x.wineSales ?? 0))}, and every arrangement's level by the same amount.
        </li>
        <li>
          Using FY2026's wine share for FY2025: across {share ? rangeText(share) : "the tested range"} the loss moves by less than{" "}
          {share ? amount(Math.max(Math.abs(share.atLow.private - r.net.private), Math.abs(share.atHigh.private - r.net.private))) : "—"}.
        </li>
        <li>The price response, because prices do not change at matched prices, and the wine margin under DABS supply.</li>
        <li>
          Protecting school meals: it changes which funds bear the loss, not its size (above). Its own break-even is a tax of at least{" "}
          {pct(f.comparison.guarantees[0]?.cases.find((e) => e.basis === "shift")?.coverLever?.value)} with private supply.
        </li>
      </ul>

      <h4>Evidence that would most narrow this</h4>
      <ul className="small">
        <li>What margin grocers would accept on wine, or what they would charge for it: the break-even depends on sellers keeping under {cents(r.keepAtBreakEven)} a dollar at today's prices, and no source measures either.</li>
        <li>DABS's operating costs that would actually stop per dollar of wine sales leaving the stores: it sets that {cents(r.keepAtBreakEven)}.</li>
        <li>DABS wine sales by customer type, and how much household buying would move: these set the size of the loss.</li>
      </ul>
      <p className="no-print small">
        <Go to={{ v: "scenario", ...f.values, eg: init.worked.proposalId, sx: "avoidableCost" }} reset>
          See the sensitivity chart in the scenario tool
        </Go>{" "}
        <span className="muted">
          ({ROBUSTNESS_METHOD}; every figure from the scenario tool's model on the worked example's inputs)
        </span>
      </p>
    </section>
  );
}

const GROUP_WORDS: Record<AltResult["def"]["group"], string> = {
  reference: "Reference cases (the brief's original examples, 5¢ illustrative savings)",
  A: "A. DABS keeps supplying and keeps its per-bottle take",
  B: "B. DABS supplies grocers at a discount",
  C: "C. Private supply with an explicit state charge",
};

/** The policy alternatives (lib/wineAlternatives.ts), computed here by the same code the graph export runs. */
function AlternativesSection() {
  const rep = useMemo(() => alternativesReport(), []);
  const u07 = ASSUMPTIONS.find((a) => a.id === "U07")!;
  const u11 = ASSUMPTIONS.find((a) => a.id === "U11")!;
  const at = rep.results.find((r) => r.def.id === "A_target")!;
  const ct = rep.results.find((r) => r.def.id === "C_take")!;
  const atPrice = at.demand.find((d) => d.id === "price_constant")!;
  const atReturn = at.demand.find((d) => d.id === "return_to_stores")!;
  const legal = [...new Map(rep.results.flatMap((r) => r.legal.filter((l) => l.status !== "consistent with current law")).map((l) => [l.item, l])).values()];
  const groups = (["reference", "A", "B", "C"] as const).map((g) => ({ g, rows: rep.results.filter((r) => r.def.group === g) }));
  const savingsWords = (r: AltResult) => (r.def.savings === "reference" ? "5¢ (illustrative)" : `${cents(r.built.x.avoidableCost)} (source-based assumption)`);
  const margin = (r: AltResult) =>
    r.retailer.marginShare === null
      ? "not split"
      : r.retailer.arithmeticOnly
        ? `${pct(r.retailer.marginShare)} if the wholesaler keeps 29.5%: below acquisition cost (together ${cents(r.retailer.sellersTogether)})`
        : `${pct(r.retailer.marginShare)}${r.def.supply === "private" ? " (after a 29.5% wholesaler)" : ""}`;
  const arithmetic = rep.results.filter((r) => r.retailer.arithmeticOnly);
  const parts = (r: AltResult) => {
    const s = r.reconciliation.sources;
    return `checkout tax ${millions(s.checkoutTax)}, assumed savings ${millions(s.savings)}, new costs ${millions(s.newCosts)}; DABS margin and charge together ${millions(s.marginAndCharge)}`;
  };
  return (
    <section className="panel" aria-labelledby="in-alt">
      <h3 id="in-alt">Policy alternatives: who pays the grocer, and what the state keeps</h3>
      <p>
        Two points are easy to miss. <strong>Keeping the state's take per bottle moves the cost of the grocer's margin to someone else:</strong>{" "}
        shoppers pay a higher grocery price, or the grocer accepts a thinner margin. And <strong>keeping the take per bottle does not keep the
        annual total:</strong> if a higher grocery price means fewer bottles are bought, the state collects on fewer bottles.
      </p>
      <p className="small muted">
        Fixed volume unless a column says otherwise: the same {money(rep.movedDollars)} of household wine moves to grocers in every row. All
        state funds together; school-meal and enforcement deposits are allocations inside the DABS margin, shown in the graph package and
        not added again. Gross margin is the seller's price less what it pays, before its own costs: it is not profit, and the 28% grocery
        figure is a national reference, not a known minimum for grocery wine. A row that leaves a seller 0% or 1¢ is arithmetic, not a claim
        that any business would accept it. Method {WINE_ALTERNATIVES_METHOD}.
      </p>
      <div className="table-wrap">
        <table className="data initiative-table">
          <thead>
            <tr>
              <th scope="col">Arrangement</th>
              <th scope="col" className="num">Grocery price vs state store</th>
              <th scope="col" className="num">State change, fixed volume</th>
              <th scope="col" className="num">Same, no avoidable savings</th>
              <th scope="col" className="num">Exploratory: old price response</th>
              <th scope="col" className="num">Grocer's gross margin, share of its price</th>
              <th scope="col">Savings assumption</th>
            </tr>
          </thead>
          {groups.map(({ g, rows }) => (
            <tbody key={g}>
              <tr>
                <th scope="rowgroup" colSpan={7} className="small">
                  {GROUP_WORDS[g]}
                </th>
              </tr>
              {rows.map((r) => (
                <tr key={r.def.id}>
                  <th scope="row" className="small">
                    {r.def.label.replace(/^[ABC]\. /, "").replace(/^Reference \d \(brief\): /, "")}
                  </th>
                  <td className="num">{pct(r.fixed.stack.consumerChange)}</td>
                  <td className="num">
                    <strong>{millions(r.fixed.ledger.net)}</strong>
                  </td>
                  <td className="num">{millions(r.zeroSavings.net)}</td>
                  <td className="num">{r.def.pricing === "matched" ? "no price change" : millions(r.demand.find((d) => d.id === "price_constant")!.net)}</td>
                  <td className="num">{margin(r)}</td>
                  <td className="small">{savingsWords(r)}</td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
      <ul className="small source-list">
        <li>
          <strong>Why the take-preserving rows gain.</strong> Keeping DABS's margin ({at.def.short}) or replacing it with an equal charge (
          {ct.def.short}) leaves the state's take per bottle where it is; the gains come from elsewhere. A: {parts(at)}. C: {parts(ct)}. With
          no avoidable savings A is {millions(at.zeroSavings.net)} and C {millions(ct.zeroSavings.net)}.
        </li>
        <li>
          <strong>The price response is exploratory, not a central case.</strong> It applies a market-wide elasticity of −0.46 to the wine
          that moves, at its grocery price, as though every wine price had risen. Purchases no longer made at grocers are assumed to leave the
          Utah market, not return to DABS, though DABS still sells them at today's price: for A that gives {millions(atPrice.net)}. If those
          buyers went back to state stores instead, A would be {millions(atReturn.net)}. The purchase-flow section replaces this with channel
          choice.
        </li>
        {arithmetic.map((r) => (
          <li key={r.def.id}>
            <strong>{r.def.short}: arithmetic only, not a workable arrangement as shown.</strong> {r.retailer.note}
          </li>
        ))}
        <li>
          <strong>Savings.</strong> {u07.label}: {u07.value}. {u07.note}
        </li>
        <li>
          <strong>Handling.</strong> {u11.label}: {u11.value}. {u11.note}
        </li>
        <li>
          <strong>Unresolved legal and funding assumptions</strong> (none is settled law; proposed allocations are the bill's choice, not current
          law): {legal.map((l) => `${l.item} (${l.status})`).join("; ")}.
        </li>
        <li>
          <strong>Not modelled:</strong> {MISSING_CAPABILITIES.join(" ")}
        </li>
      </ul>
    </section>
  );
}
