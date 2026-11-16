// The start page's Utah overview: four questions, then the proposal, the economics, the evidence and the tradeoffs, each
// with its main point first and the detail behind a disclosure. Loaded on demand (it pulls in the scenario models), and
// every figure is computed by the functions the briefing and the initiative page use, so the start page cannot drift
// from them.
import { useMemo } from "react";
import { Go } from "../components/common";
import { dabsDollar, statutoryFloor } from "../lib/bottle";
import { INITIATIVES } from "../lib/initiatives";
import { directDef } from "../lib/producerDirect";
import { alternativesReport, evaluate, type AltResult, type LegalNote } from "../lib/wineAlternatives";

const amount = (v: number) => `$${(Math.abs(v) / 1e6).toFixed(1)}M`;
const pct = (v: number) => `${(v * 100).toFixed(0)}%`;
const usd = (v: number) => `$${v.toFixed(2)}`;

function LegalList({ notes }: { notes: LegalNote[] }) {
  return (
    <ul className="small source-list">
      {notes.map((n) => (
        <li key={n.item}>
          <strong>{n.item}</strong> ({n.status}). {n.text} <span className="muted">{n.cite}</span>
        </li>
      ))}
    </ul>
  );
}

export default function UtahOverview({ verified }: { verified: string[] }) {
  const alt = useMemo(() => alternativesReport(), []);
  const get = (id: string) => alt.results.find((r) => r.def.id === id)!;
  const a = get("A_target");
  const c = get("C_take");
  const d = useMemo(() => evaluate(directDef()), []);
  const lower = [get("B20_matched"), get("C20_matched")].map((r) => r.fixed.ledger.net);
  const demand = (r: AltResult, id: string) => r.demand.find((d) => d.id === id)!.net;
  const fewer = [a, c].flatMap((r) => [demand(r, "price_constant"), demand(r, "price_linear")]);
  const data = INITIATIVES[0].worked.data;
  const floor = statutoryFloor(10);
  const parts = dabsDollar(data);
  const share = (id: string) => parts.find((p) => p.id === id)!.share;
  // A $10 bottle at DABS's observed margin, split the way the FY2025 income statement splits a dollar of sales.
  const shelf = floor.landed / share("cost");
  const at = (id: string) => share(id) * shelf;
  const both = a.legal.filter((n) => c.legal.some((m) => m.item === n.item));
  const only = (r: AltResult, other: AltResult) => r.legal.filter((n) => !other.legal.some((m) => m.item === n.item));

  return (
    <>
      <section className="panel" aria-labelledby="st-questions">
        <h2 id="st-questions">Four questions</h2>
        <ol className="finding-cards">
          <li>
            <p className="finding-tag">Question 1 · the proposal</p>
            <h3>What would change if grocery stores could sell wine?</h3>
            <p>
              Licensed grocery stores could sell sealed wine to take home. State liquor stores would keep selling everything they sell now. Every
              design needs a new grocery wine license.
            </p>
            <a href="#st-proposal">The proposal</a>
          </li>
          <li>
            <p className="finding-tag">Question 2 · state revenue</p>
            <h3>What happens to Utah's public revenue?</h3>
            <p>
              It depends on the design. On the model's figures the state is about {amount(a.fixed.ledger.net)} a year ahead with DABS supplying
              grocers at today's price, and {amount(c.fixed.ledger.net)} ahead with private wholesalers paying a charge equal to DABS's markup.
              Making grocers match state-store prices lowers it.
            </p>
            <a href="#st-economics">The economics</a>
          </li>
          <li>
            <p className="finding-tag">Question 3 · other states</p>
            <h3>What can we learn from other states?</h3>
            <p>
              Grocery-wine law is verified over time for {verified.length} states. Before-and-after comparisons, with Tennessee's 2016 change as the
              worked example, describe what happened there; they do not show what the law caused.
            </p>
            <a href="#st-evidence">The evidence</a>
          </li>
          <li>
            <p className="finding-tag">Question 4 · the design</p>
            <h3>How would different distribution and taxation arrangements affect the outcome?</h3>
            <p>
              Who supplies the grocers and how the state is paid decide the result more than the sale itself: DABS, private wholesalers or
              the producers themselves. Each design changes the law in different places and trades revenue, prices and administration
              differently.
            </p>
            <a href="#st-tradeoffs">The tradeoffs</a>
          </li>
        </ol>
      </section>

      <section className="panel" aria-labelledby="st-proposal">
        <h2 id="st-proposal">The proposal</h2>
        <p className="lede">
          Licensed grocery stores that meet set standards could sell <strong>sealed wine to take home</strong>. State liquor stores and package
          agencies would keep selling everything they sell now. Beer, spirits, bars and restaurants would not change.
        </p>
        <p>
          A bill would also decide <strong>who supplies the grocers and how the state is paid</strong>: DABS (Utah's Department of Alcoholic
          Beverage Services) as the wholesaler, private wholesalers paying the state a charge, or producers selling to grocers directly with the
          same charge. Letting grocers sell wine is a smaller change than ending state liquor stores, which these designs do not do.
        </p>
        <details>
          <summary>What current law says, and what would have to change</summary>
          <h3>Every design</h3>
          <LegalList notes={both} />
          <h3>DABS as the wholesaler</h3>
          <LegalList notes={only(a, c)} />
          <h3>Private wholesalers and a state charge</h3>
          <LegalList notes={only(c, a)} />
          <h3>Producers selling to grocers directly</h3>
          <LegalList notes={only(d, c)} />
          <p className="small muted">
            Read from the statutes in the saved sources; "unresolved" means the text does not settle it and both readings are shown. Not legal
            advice, and not reviewed by a person.
          </p>
        </details>
      </section>

      <section className="panel" aria-labelledby="st-economics">
        <h2 id="st-economics">The economics</h2>
        <p className="finding">
          <strong>Utah does not mainly tax wine; it sells it.</strong> DABS must price wine at least 88.5% above what it costs to land (Utah Code §
          32B-2-304(2)(b)): a bottle that costs {usd(floor.landed)} carries at least {usd(floor.markup)} of markup, {usd(floor.price)} before sales
          tax.
        </p>
        <p>
          That markup is part of the price, not a tax, and not profit. At DABS's actual FY{data.fy} margin the same bottle sells for{" "}
          {usd(shelf)}: {usd(at("cost"))} pays for the wine, {usd(at("operating"))} for DABS's stores, staff and warehouse,{" "}
          {usd(at("transfers"))} for school-meals and other transfers, and {usd(at("net_profit"))} reaches the General Fund as net profit.
        </p>
        <ul className="findings">
          <li>
            <strong>DABS as wholesaler, selling to grocers at today's price:</strong> the state about {amount(a.fixed.ledger.net)} a year ahead;
            grocery wine about {pct(a.fixed.stack.consumerChange)} above the state store.
          </li>
          <li>
            <strong>Private wholesalers paying a state charge equal to DABS's markup:</strong> about {amount(c.fixed.ledger.net)} a year ahead;
            grocery wine about {pct(c.fixed.stack.consumerChange)} above the state store.
          </li>
          <li>
            <strong>Producers selling to grocers directly, with the same charge:</strong> about {amount(d.fixed.ledger.net)} a year ahead when
            delivering costs producers what it earns a wholesaler; cheaper delivery would lower the grocery price, not raise the state's take.
          </li>
          <li>
            <strong>Grocers required to match state-store prices:</strong> the grocer's margin comes out of the state's share, {amount(Math.max(...lower))}{" "}
            to {amount(Math.min(...lower))} a year less.
          </li>
        </ul>
        <p className="small muted">
          Model results, at fixed volume with 30% of household wine purchases moving to grocers: conditional, not forecasts. FY{data.fy} figures,
          not reviewed by a person. The $10 bottle is split the way DABS's income statement splits a dollar of all its sales, not wine alone.
        </p>
        <div className="row-actions">
          <Go to={{ v: "briefing" }} reset className="button primary-link">
            The briefing: price a bottle yourself
          </Go>
          <Go to={{ v: "initiative" }} reset>
            Every design, in the full analysis
          </Go>
          <Go to={{ v: "scenario" }} reset>
            Change the assumptions
          </Go>
        </div>
        <details>
          <summary>Gross collections are not net revenue</summary>
          <p className="small">
            What the state collects on a bottle (DABS's markup and sales tax) is gross. DABS pays its operating costs out of the markup, then the
            school-meals and enforcement deposits and other transfers, and only the rest is net profit. So the revenue change for a design counts
            the markup and any charge, sales tax, the store costs DABS saves and the new costs it takes on, never the markup alone.
          </p>
        </details>
      </section>

      <section className="panel" aria-labelledby="st-evidence">
        <h2 id="st-evidence">The evidence</h2>
        <p>
          Grocery-wine law is verified over time for {verified.length} states ({verified.join(", ")}). Before-and-after comparisons show what
          happened there, with comparison states over the same years: they describe, they do not prove cause.
        </p>
        <details>
          <summary>Tennessee, July 2016: the worked example</summary>
          <p className="small">
            Tennessee's grocery stores began selling wine on July 1, 2016. Other things changed around the same time (a rule against selling
            wine below cost, beer sales in package stores, and an accounting relabeling in FY2018), so a before-and-after difference cannot be
            given to the grocery law alone. The analysis plan was written before the results, and the comparison uses neighboring states and
            placebo dates.
          </p>
        </details>
        <div className="row-actions">
          <Go to={{ v: "change" }} reset className="button primary-link">
            Before &amp; after
          </Go>
          <Go to={{ v: "case" }} reset>
            Tennessee worked example
          </Go>
          <Go to={{ v: "finder" }} reset>
            Comparison states for Utah
          </Go>
        </div>
      </section>

      <section className="panel" aria-labelledby="st-tradeoffs">
        <h2 id="st-tradeoffs">The tradeoffs</h2>
        <ul className="findings">
          <li>
            <strong>Regulation.</strong> Every design needs a new grocery wine license and the enforcement to go with it. The model counts new
            licensing, enforcement, administration and supply costs of about {amount(a.reconciliation.newCosts)} a year in the DABS design and{" "}
            {amount(c.reconciliation.newCosts)} in the private design.
          </li>
          <li>
            <strong>Operations.</strong> With DABS as the wholesaler, DABS supplies grocers as well as its own stores. Its stores handle fewer
            bottles, and the model counts about {amount(a.reconciliation.avoidableCosts)} a year of store costs saved. With private wholesalers,
            the wholesalers need licenses and the state needs a way to collect the charge.
          </li>
          <li>
            <strong>Money.</strong> If the higher grocery price sends some shoppers back to state stores, both designs stay ahead (
            {amount(demand(a, "return_to_stores"))} and {amount(demand(c, "return_to_stores"))}). In an exploratory case where Utahns buy less
            wine in total instead, they come out about {amount(Math.max(...fewer))} to {amount(Math.min(...fewer))} a year short.
          </li>
          <li>
            <strong>Prices and convenience.</strong> Shoppers could buy wine where they buy groceries, at about {pct(a.fixed.stack.consumerChange)}{" "}
            to {pct(c.fixed.stack.consumerChange)} above the state store; state stores keep today's prices.
          </li>
          <li>
            <strong>Public health.</strong> The model counts money, not drinking. Measures of drinking and alcohol-related deaths are in the data for
            every state, around each law change too; none of them isolates what a law caused.
          </li>
        </ul>
        <div className="row-actions">
          <Go to={{ v: "briefing" }} reset className="button primary-link">
            The two-minute briefing
          </Go>
          <Go to={{ v: "map", mm: "adults_binge" }} reset>
            Adults who binge drank, by state
          </Go>
        </div>
      </section>
    </>
  );
}
