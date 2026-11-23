// The start page's Utah overview, in the plan's order: the existing system, the proposed change, what consumers would
// see, public revenue, other states, the risks, the framework, and how to check it all (sections A to H). Loaded on
// demand. Every figure comes from the design model (lib/policyDesigns.ts, through lib/framework.ts) with no store costs
// counted as saved, so the start page cannot drift from the Economics page or the briefing.
import { useMemo } from "react";
import { Go } from "../components/common";
import { HowWeKnow } from "../components/HowWeKnow";
import { dabsDollar, statutoryFloor } from "../lib/bottle";
import { feeBurden, headline } from "../lib/framework";
import { INITIATIVES } from "../lib/initiatives";
import { CONSUMER_ACCESS as AC } from "../lib/consumerAccess.generated";
import { defaultDesignsReport } from "../lib/policyDesigns";
import { samePriceHeadline } from "../lib/samePrice";
import { amendmentsFor } from "../lib/statutes";
import { minus } from "../lib/format";

const m = (v: number) => `${v < -0.5 ? "−" : v > 0.5 ? "+" : ""}$${(Math.abs(v) / 1e6).toFixed(2)}M`;
const pct = (v: number, d = 0) => `${minus((v * 100).toFixed(d))}%`;
const usd = (v: number) => `$${v.toFixed(2)}`;

export default function UtahOverview({ verified }: { verified: string[] }) {
  const r = useMemo(() => defaultDesignsReport(), []);
  const h = headline(r);
  const data = INITIATIVES[0].worked.data;
  const floor = statutoryFloor(10);
  const parts = dabsDollar(data);
  const share = (id: string) => parts.find((p) => p.id === id)!.share;
  const shelf = floor.landed / share("cost");
  const at = (id: string) => share(id) * shelf;
  const s = samePriceHeadline();
  const small = feeBurden(r)[2];

  return (
    <>
      <section className="panel" aria-labelledby="st-a">
        <p className="finding-tag">A · The existing system</p>
        <h2 id="st-a">Grocery stores may sell beer, but not wine</h2>
        <p>
          A Utah grocery store can hold an off-premise beer retailer license. Wine is <em>liquor</em> under Utah law, so it can be bought to take
          home only at a state liquor store or a contract package agency run for DABS, the Department of Alcoholic Beverage Services. DABS is both
          the wholesaler and the retailer.
        </p>
        <p>
          Utah does not mainly tax wine; it sells it. DABS must mark wine up at least 88.5% over what it costs to land (Utah Code §
          32B-2-304(2)(b)). At DABS's FY{data.fy} margin a bottle that costs {usd(floor.landed)} to land sells for {usd(shelf)}: {usd(at("operating"))}{" "}
          pays for stores, staff and the warehouse, {usd(at("transfers"))} for school meals and other transfers, and {usd(at("net_profit"))} reaches the
          General Fund.
        </p>
      </section>

      <section className="panel" aria-labelledby="st-b">
        <p className="finding-tag">B · The proposed change</p>
        <h2 id="st-b">Licensed grocers could sell sealed wine</h2>
        <p>
          Licensed grocery stores could sell sealed wine to take home. What would stay regulated: a state license with local consent, ID checks on
          every sale, staff training, compliance checks and penalties, as off-premise beer has today. State stores keep selling everything,
          spirits stay where they are, and bars and restaurants do not change.
        </p>
        <p>
          The bill would also decide who supplies grocers and how the state is paid: DABS as the wholesaler, licensed private wholesalers paying a
          charge, or producers selling directly. Each changes the law in different places ({amendmentsFor("B").length} provisions for DABS
          wholesale, {amendmentsFor("C").length} for private wholesale).
        </p>
        <Go to={{ v: "framework" }} reset>
          The proposed framework and the change matrix
        </Go>
      </section>

      <section className="panel" aria-labelledby="st-c">
        <p className="finding-tag">C · For shoppers</p>
        <h2 id="st-c">Wine where you buy groceries, at today's price</h2>
        <p>
          Under the framework a bottle costs <strong>the same at a grocery store as at a state store</strong>: DABS sells to grocers below its shelf
          price and grocers charge the price the commission fixes, as state stores and package agencies must. What changes is distance. Half of
          Utahns live within {AC.distance.grocery.median.toFixed(2)} miles of a grocery store and {AC.distance.stateStore.median.toFixed(2)} miles of
          a state store, and by law no state store may sell on a Sunday.
        </p>
        <div className="table-wrap">
          <table className="data">
            <caption className="sr-only">Stores in Utah and the share of Utahns living near one</caption>
            <thead>
              <tr>
                <th scope="col">Store</th>
                <th scope="col">In Utah</th>
                <th scope="col">Utahns within 1 mile</th>
                <th scope="col">Within 5 miles</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">State liquor store</th>
                <td>{AC.outlets.stateStores}</td>
                <td>{pct(AC.distance.stateStore.within[0])}</td>
                <td>{pct(AC.distance.stateStore.within[2])}</td>
              </tr>
              <tr>
                <th scope="row">Grocery store</th>
                <td>{AC.outlets.grocery}</td>
                <td>{pct(AC.distance.grocery.within[0])}</td>
                <td>{pct(AC.distance.grocery.within[2])}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="small muted">
          Straight-line distances from 2020 Census block groups; grocery stores are USDA's SNAP-authorized supermarkets, super stores and
          grocery stores; state stores are those DABS's store locator lists. If a bill let grocers set their own prices instead, prices could
          rise; the five designs page models that option.
        </p>
        <Go to={{ v: "sameprice" }} reset>
          The same-shelf-price design
        </Go>
      </section>

      <section className="panel" aria-labelledby="st-d">
        <p className="finding-tag">D · Public revenue</p>
        <h2 id="st-d">The state's side: a choice of margin</h2>
        <p>
          At today's price the grocer's margin comes out of the state's share of the bottle, less what DABS stops spending. With DABS
          selling to grocers at {pct(s.priceToGrocers)} of its shelf price and license fees covering the new administration, the state gives up{" "}
          <strong>{m(s.cost.none).replace("+", "")} a year</strong> if DABS saves nothing, {m(s.cost.allocated).replace("+", "")} if its card fees and
          agency contracts fall with sales, and {m(s.cost.longerRun).replace("+", "")} if its wages fall too. A rise of{" "}
          {pct(s.neededNone, 1)} in household wine purchases would cover the first. If grocers set their own prices instead, DABS wholesale
          leaves the state {m(Math.abs(h.bFixed)).replace("+", "")} a year {h.bFixed < 0 ? "short" : "ahead"} when 30% of household purchases move.
        </p>
        <HowWeKnow
          claim={`same shelf price at ${pct(s.margin)}: ${m(-s.cost.none)} a year`}
          inputs="DABS FY2025 wine sales and income statement; household share of wine (82%); landed cost share."
          assumptions="30% of household wine purchases move to grocers at today's price; administration $0.50M a year (no estimate exists), covered by license fees; no DABS cost saved in the first figure."
          calculation="The purchase-flow model with DABS selling to grocers below its shelf price and grocers charging today's price: the grocer's margin on the wine that moves, less DABS's costs that fall."
          output={`${m(-s.cost.none)} a year with nothing saved; ${m(-s.cost.allocated)} with card fees and agency contracts falling; ${m(-s.cost.longerRun)} with wages falling too.`}
          period={`FY${data.fy} dollars, a year`}
          limits="Conditional scenarios, not forecasts; every input is software-transcribed and unreviewed."
          reproduce="npm test in web/ (samePrice.test.ts checks the figures against the alternatives engine)."
        />
        <Go to={{ v: "sameprice" }} reset className="button primary-link">
          Explore the numbers
        </Go>
      </section>

      <section className="panel" aria-labelledby="st-e">
        <p className="finding-tag">E · Other states</p>
        <h2 id="st-e">What other states show, and what they cannot</h2>
        <ul className="findings">
          <li>
            <strong>Tennessee, 2016.</strong> A peer-reviewed study finds no significant change in the number of liquor stores and higher wine-tax
            receipts. Tennessee taxes wine by excise; Utah earns a margin, so the revenue result does not carry over.
          </li>
          <li>
            <strong>Colorado, 2023.</strong> Every beer retailer's license was converted automatically; no government evaluation exists yet.
          </li>
          <li>
            <strong>Pennsylvania, 2016.</strong> The state stayed the wholesaler while permit holders, 559 grocery stores among them in 2025, resell
            its wine: the closest structure to DABS wholesale.
          </li>
        </ul>
        <p className="small muted">Grocery-wine law is verified over time for {verified.length} states in this dataset.</p>
        <Go to={{ v: "states" }} reset>
          Other states, with evidence strength
        </Go>
      </section>

      <section className="panel" aria-labelledby="st-f">
        <p className="finding-tag">F · Risks</p>
        <h2 id="st-f">What could go wrong</h2>
        <ul className="findings">
          <li>
            <strong>Fiscal.</strong> Nobody has measured how many households would switch, what DABS could save, or what licensing would cost.
          </li>
          <li>
            <strong>Public health.</strong> More outlets usually mean more drinking; the Community Preventive Services Task Force recommends limiting
            outlet density.
          </li>
          <li>
            <strong>Existing businesses.</strong> Rural package agencies could lose sales; a flat fee that covers the administration is{" "}
            {pct(small.feeShare)} of a small store's wine margin.
          </li>
          <li>
            <strong>Implementation.</strong> Rules, training, delivery to grocers and enforcement all cost money before any revenue arrives.
          </li>
        </ul>
        <Go to={{ v: "safeguards" }} reset>
          Public health and safeguards
        </Go>
      </section>

      <section className="panel" aria-labelledby="st-g">
        <p className="finding-tag">G · The framework</p>
        <h2 id="st-g">Today's price, at the grocery store</h2>
        <p>
          The framework keeps DABS as the wholesaler and the shelf price where it is: DABS sells to licensed grocers below its shelf price and
          grocers charge the state-store price. Around that it sets grocery stores first, a commission license with local consent, beer's
          safeguards extended to wine, fees that cover the cost, yearly reporting and a review after three years. DABS's price to grocers is
          the bill's main fiscal choice.
        </p>
        <Go to={{ v: "framework" }} reset>
          The 14-point framework
        </Go>{" "}
        · <Go to={{ v: "questions" }} reset>Hard questions</Go>
      </section>

      <section className="panel" aria-labelledby="st-h2">
        <p className="finding-tag">H · Verify the research</p>
        <h2 id="st-h2">Check every number</h2>
        <p>
          The model, its inputs and its checks are open: each figure links to its source, the downloads carry the data, and the code is public at
          github.com/whiptronics/proof-and-policy-public. Written with AI assistance and not reviewed by a person.
        </p>
        <div className="row-actions">
          <Go to={{ v: "designs" }} reset>
            The design model
          </Go>
          <Go to={{ v: "methods" }} reset>
            Methods
          </Go>
          <Go to={{ v: "sources" }} reset>
            Sources
          </Go>
          <Go to={{ v: "downloads" }} reset>
            Downloads
          </Go>
        </div>
      </section>
    </>
  );
}
