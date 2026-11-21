// The Utah grocery-wine briefing: the initiative page's central result in about two minutes. It leads with the same-shelf-
// price design (lib/samePrice.ts: shoppers pay today's price), then charts the two designs where grocers set their own
// prices and the state keeps its share of each bottle (headline with no store savings). A presentation of the same models, not a second analysis: every figure is
// computed from the policy alternatives report and initiativeFigures (the worked example), as the full page computes
// them, and lib/briefing.ts lays them out (checked by briefing.test.ts).
import { useMemo } from "react";
import { BottleBreakdown } from "../components/BottleBreakdown";
import { BridgeChart, SplitChart, SplitLegend, millions } from "../components/BriefCharts";
import { ChartFigure, type Row } from "../components/ChartFigure";
import { Go } from "../components/common";
import { AssumptionRegister } from "../components/Evidence";
import { BOTTLE_METHOD, dabsAccountsBridge } from "../lib/bottle";
import { BRIEFING_METHOD, designBridge, designSplit, whatIf } from "../lib/briefing";
import { headline } from "../lib/framework";
import { INITIATIVES, initiativeFigures } from "../lib/initiatives";
import { CONSUMER_ACCESS as A } from "../lib/consumerAccess.generated";
import { defaultDesignsReport } from "../lib/policyDesigns";
import { defaultSamePriceReport } from "../lib/samePrice";
import { WINE_ALTERNATIVES_METHOD, alternativesReport } from "../lib/wineAlternatives";
import { useData } from "../lib/data";
import type { Manifest } from "../lib/types";
import { navigate, pickOne, useParams } from "../lib/url";

const pct = (v: number | null | undefined, d = 0) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : `${(v * 100).toFixed(d)}%`);
const amount = (v: number) => `$${(Math.abs(v) / 1e6).toFixed(1)}M`;
const signed = (v: number) => `${v < -0.5 ? "−" : v > 0.5 ? "+" : ""}$${(Math.abs(v) / 1e6).toFixed(2)}M`;
const usd = (v: number) => `${v < 0 ? "−" : ""}$${Math.round(Math.abs(v)).toLocaleString("en-US")}`;

const DESIGNS = ["dabs", "private"] as const;
type Design = (typeof DESIGNS)[number];
const DESIGN_IDS: Record<Design, string> = { dabs: "A_target", private: "C_take" };
const DESIGN_WORDS: Record<Design, string> = {
  dabs: "DABS design: DABS sells to grocers at today's price",
  private: "Private design: a state charge equal to DABS's markup",
};
/** The same, in the middle of a sentence. */
const DESIGN_MID: Record<Design, string> = { dabs: "the DABS design", private: "the private design" };

const SOURCE =
  "DABS FY2025 annual report (sales, gross profit, expense lines) and FY2026 monthly sales reports; Utah Code §§ 32B-2-304, 32B-2-305; Utah State Tax Commission Publication 25; Census 2022 wholesale and retail trade surveys (national margins)";

export function BriefingView() {
  const params = useParams();
  const des = pickOne(params.get("bs"), DESIGNS, "dabs");
  const init = INITIATIVES[0];
  const f = useMemo(() => initiativeFigures(init), [init]);
  const alt = useMemo(() => alternativesReport(), []);
  const get = (id: string) => alt.results.find((r) => r.def.id === id)!;
  const keepA = get("A_target");
  const keepC = get("C_take");
  const trapB = get("B20_matched");
  const R = get(DESIGN_IDS[des]);
  const c = f.comparison;
  const demand = (r: typeof keepA, id: string) => r.demand.find((d) => d.id === id)!.net;
  // The exploratory case where the higher grocery price means less wine bought in total, both demand shapes.
  const fewer = [keepA, keepC].flatMap((r) => [demand(r, "price_constant"), demand(r, "price_linear")]);
  const steps = designBridge(R.fixed.ledger, R.def.supply);
  const split = designSplit(
    [
      { id: "dabs", label: "Grocery wine, DABS design: DABS sells to grocers at today's price", law: "Needs a grocery wine license; the markup law stays as it is", stack: keepA.fixed.stack },
      { id: "private", label: "Grocery wine, private design: a state charge equal to DABS's markup", law: "Needs a grocery wine license, private wholesale and the new charge", stack: keepC.fixed.stack },
      { id: "matched_80", label: "Same shelf price: DABS sells to grocers at 80% and grocers charge today's price", law: "Needs a grocery wine license and a grocer price below the markup floor", stack: trapB.fixed.stack },
    ],
    { label: "Today: state liquor store", law: "Current law" },
  );
  const bars = whatIf(R);
  const ahead = bars.filter((b) => b.value > 0).length;
  const net = R.fixed.ledger.net;
  const fundsNeed = -keepC.fixed.ledger.allocations.funds;
  const methods = `${BRIEFING_METHOD}; ${WINE_ALTERNATIVES_METHOD}`;
  const fy = init.worked.data.fy;
  const hd = useMemo(() => headline(defaultDesignsReport()), []);
  const sp = defaultSamePriceReport();
  const man = useData<Manifest>("manifest.json");

  // Two copies (one per chart), each its own radio group: a shared name would let the browser uncheck one copy.
  const pick = (name: string) => (
    <fieldset className="structure-pick no-print">
      <legend>Show the design</legend>
      {DESIGNS.map((s) => (
        <label key={s} className="check">
          <input type="radio" name={name} checked={des === s} onChange={() => navigate({ bs: s === "dabs" ? null : s }, { replace: true })} /> {DESIGN_WORDS[s]}
        </label>
      ))}
    </fieldset>
  );

  const bridgeRows: Row[] = steps.map((s) => ({ step: s.label, kind: s.kind, change_usd_per_year: s.value, running_total_usd_per_year: s.to, design: DESIGN_WORDS[des] }));
  const splitRows: Row[] = split.flatMap((k) => k.segments.map((s) => ({ arrangement: k.label, law: k.law, recipient: s.to, item: s.label, kind: s.kind, usd_per_100_today: s.amount })));
  const whatIfRows: Row[] = bars.map((b) => ({ design: DESIGN_WORDS[des], case: b.label, basis: b.basis, net_usd_per_year: b.value }));
  const accounts = dabsAccountsBridge(init.worked.data);
  const accountRows: Row[] = accounts.map((s) => ({ step: s.label, kind: s.kind, usd: s.value, running_total_usd: s.to, note: s.note }));

  return (
    <article className="briefing" aria-labelledby="br-h">
      <header className="panel briefing-head">
        <p className="kicker">Utah research briefing · about two minutes</p>
        <h2 id="br-h">Grocery-store wine in Utah: the same price, closer to home</h2>
        <p className="lede">
          Wine could be sold in grocery stores at exactly today's state-store price: DABS stays the wholesaler and sells to grocers below its shelf price,
          as Pennsylvania does, and most Utahns live far closer to a grocery store than to a state store. The state's cost is the grocer's margin,
          less what DABS stops spending. Here is how it works, what it costs, what covers it, and what nobody has measured yet.
        </p>
        <p className="small muted">
          Draft. Every figure here is computed by the project's models on FY{fy} figures. No person has reviewed the source values, and nothing here
          is a fiscal note. The maintainer supports grocery-store wine; the figures are the model's, favorable and unfavorable alike: what the same
          price costs the state, which designs keep the state ahead, and what could change the numbers.{" "}
          <Go to={{ v: "initiative" }} reset>
            Full analysis
          </Go>{" "}
          ·{" "}
          <Go to={{ v: "scenario", ...f.values, eg: init.worked.proposalId }} reset>
            Change the assumptions
          </Go>
        </p>
      </header>

      <section className="panel" aria-labelledby="br-what">
        <h3 id="br-what">What is being proposed?</h3>
        <p>
          Licensed grocery stores that meet set standards could sell <strong>sealed wine to take home</strong>. State liquor stores and package
          agencies would keep selling everything they sell now. Beer, spirits, bars and restaurants would not change.
        </p>
        <p>
          A bill would also decide <strong>who supplies the grocers and how the state is paid</strong>: DABS (Utah's Department of Alcoholic
          Beverage Services) as the wholesaler, or private wholesalers paying the state a charge. That choice, more than the sale itself, decides
          what happens to state revenue. Under the framework, DABS supplies grocers below its shelf price and grocers charge the state-store price, so a
          bottle costs the same in either store.
        </p>
      </section>

      <section className="panel" aria-labelledby="br-short">
        <h3 id="br-short">What the research shows</h3>
        <p className="finding">
          <strong>Shoppers need not pay more.</strong> If DABS sells to grocers below its shelf price and grocers charge the state-store price, a bottle
          costs the same in either store, as Utah already requires of its state stores and package agencies. The state's cost is the grocer's
          margin, less what DABS stops spending: at a {pct(sp.margin)} margin, from {amount(sp.cover.longer_run.stateShare)} to{" "}
          <strong>{amount(sp.cover.none.stateShare)} a year</strong>, with license fees covering the new administration.
        </p>
        <ul className="findings">
          <li>
            <strong>Closer to home.</strong> Half of Utahns live within {A.distance.grocery.median.toFixed(2)} miles of a grocery store and{" "}
            {A.distance.stateStore.median.toFixed(2)} miles of a state store; {pct(A.groceryCloserThanDabs)} live closer to a grocery store than
            to any DABS outlet. By law no state store may sell on a Sunday.
          </li>
          <li>
            <strong>The margin is the bill's choice.</strong> Pennsylvania's state stores sell to licensees at 10% below retail. A smaller margin
            costs the state less; if DABS's wages fall with its sales, the state breaks even at a margin of about{" "}
            {pct(sp.breakEvenMargin.longer_run.fees, 1)}.
          </li>
          <li>
            <strong>What closes the rest is not measured.</strong> Household wine purchases {pct(sp.needed.none.additional.value, 1)} higher in
            Utah, new or brought back from other states, would cover the case where DABS saves nothing.
          </li>
          <li>
            <strong>If grocers set their own prices instead,</strong> the state keeps its whole share of each bottle and is about{" "}
            {signed(hd.bFixed)} a year ahead with DABS as the wholesaler if 30% of household purchases move ({signed(hd.cFixed)} with private
            wholesale), but grocery wine then costs more than at a state store, and if few shoppers switch the state is {signed(hd.b30)}.
          </li>
        </ul>
        <p className="small muted">
          Headline figures count no store savings; the charts below include the allocated savings and say so. Conditional results, not
          forecasts. For the designs where grocers set their own prices, in one exploratory case with the allocated savings,
          where the higher grocery price means Utahns buy less wine in total rather than going back to state stores, they come out about{" "}
          {amount(Math.max(...fewer))} to {amount(Math.min(...fewer))} a year short instead. Method {WINE_ALTERNATIVES_METHOD};{" "}
          <Go to={{ v: "initiative" }}>every design, with its grocer margin and price, is in the full analysis</Go>.
        </p>
      </section>

      <section className="panel" aria-labelledby="br-same">
        <h3 id="br-same">Same shelf price: what the state gives up, and what covers it</h3>
        <p>
          At today's price the grocer's margin comes out of the state's share of the bottle, less what DABS stops spending. At a {pct(sp.margin)}{" "}
          margin, with license fees covering the new administration, the state gives up <strong>{amount(sp.cover.none.stateShare)} a year</strong> if
          DABS saves nothing, {amount(sp.cover.allocated.stateShare)} if its card fees and agency contracts fall with sales, and{" "}
          {amount(sp.cover.longer_run.stateShare)} if its wages fall too. Household wine purchases {pct(sp.needed.none.additional.value, 1)} higher
          would cover the first; none of these is measured.
        </p>
        <p>
          For shoppers the gain is access: {pct(A.distance.grocery.within[0])} of Utahns live within a mile of a grocery store, against{" "}
          {pct(A.distance.stateStore.within[0])} for a state store.{" "}
          <Go to={{ v: "sameprice" }} reset>
            The same-shelf-price design in full
          </Go>
        </p>
      </section>

      <section className="panel" aria-labelledby="br-why">
        <h3 id="br-why">The alternative: grocers set their own prices</h3>
        <p>
          If the bill let grocers set their own prices instead, the state could keep its whole share of every bottle. Utah does not mainly{" "}
          <em>tax</em> wine; it <em>sells</em> it. On a bottle sold in a state store the state keeps DABS's markup income as
          well as sales tax. In both designs the state keeps that share of every bottle, and the grocer's margin is added on top of it instead of
          being taken out of it.
        </p>
        <ChartFigure
          id="br-split"
          title="If grocers set their own prices, the state keeps its share of every bottle"
          subtitle={`Dollars of a bottle that costs $100 at a state store today, before sales tax; at the grocery price each design implies; FY${fy}`}
          reading={
            <>
              Each bar adds up to what the shopper pays. Blue is the state: solid for DABS's markup income, hatched for the state charge and sales
              tax. In both designs the state's part is at least as large as today, and the grocer's margin is added on top. The last bar is the
              same-shelf-price design at a 20% margin: the price stays the same, so the grocer's margin comes out of the state's part.
            </>
          }
          readingText="Each bar adds up to what the shopper pays. Solid blue is DABS's markup income (before its store costs, not profit); hatched blue is the state charge and sales tax; orange shades are the sellers' gross margins; gray is the cost of the wine. In both designs the state's part is at least today's; in the last bar it shrinks."
          limits={
            <>
              The cost of the wine is DABS's all-product average, and private wholesalers are assumed to pay suppliers what DABS pays. Grocers
              price for the {pct(c.settings.grocerMargin)} national grocery gross margin, a reference point, not a known figure for wine. Margins are
              gross, not profit. Local sales tax is not modeled.
            </>
          }
          limitsText="The cost of the wine is DABS's all-product average; private wholesalers are assumed to pay what DABS pays. Grocers price for the national grocery gross margin, a reference point. Margins are gross, not profit. Local sales tax is not modeled."
          source={SOURCE}
          methods={methods}
          filename="utah_grocery_wine_split_per_100"
          explore={
            <>
              Price one bottle yourself in the next section, or see <Go to={{ v: "initiative" }}>every design's price split in the full analysis</Go>.
            </>
          }
          legend={<SplitLegend />}
          csv={{
            columns: [
              { key: "arrangement", kind: "text", get: (r) => r.arrangement },
              { key: "law", kind: "text", get: (r) => r.law },
              { key: "recipient", kind: "text", get: (r) => r.recipient },
              { key: "item", kind: "text", get: (r) => r.item },
              { key: "kind", kind: "text", get: (r) => r.kind },
              { key: "usd_per_100_today", kind: "number", get: (r) => r.usd_per_100_today },
            ],
            rows: splitRows,
          }}
          table={
            <div className="table-wrap">
              <table className="data">
                <caption className="visually-hidden">Where the money from a bottle that costs $100 at a state store today goes, dollars</caption>
                <thead>
                  <tr>
                    <th scope="col">Where it is sold</th>
                    <th scope="col">Goes to</th>
                    <th scope="col" className="num">
                      $
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {split.flatMap((k) =>
                    k.segments.map((s, i) => (
                      <tr key={`${k.id}-${s.id}`}>
                        {i === 0 && (
                          <th scope="rowgroup" rowSpan={k.segments.length}>
                            {k.label}
                            <div className="small muted">{k.law}</div>
                          </th>
                        )}
                        <td>{s.label}</td>
                        <td className="num">${s.amount.toFixed(2)}</td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          }
        >
          {(w) => <SplitChart cols={split} width={w} label="Where the money from a $100 bottle goes today, under the two designs, and under a design that lowers state revenue" />}
        </ChartFigure>
      </section>

      <section className="panel" aria-labelledby="br-bottle">
        <h3 id="br-bottle">One bottle, from what DABS pays to what the shopper pays</h3>
        <p>
          Enter what a bottle costs DABS to land and see the statute's minimum markup, the price DABS's actual margin gives, who receives each
          part under each design, and where DABS's markup went last year. Each part says what it rests on: your input, an observed figure, a
          statutory rate, an assumption or a policy choice.
        </p>
        <BottleBreakdown />
      </section>

      <section className="panel" aria-labelledby="br-finds">
        <h3 id="br-finds">How the numbers add up</h3>
        <p>
          The state keeps its full take on every bottle, collects sales tax on the higher grocery price, and DABS's stores handle fewer bottles.
          That is with 30% of household wine purchases ({amount(f.moved)} a year) moving to grocers and no other change in what people buy: a
          conditional result, not a forecast.
        </p>
        {pick("bs-bridge")}
        <ChartFigure
          id="br-bridge"
          title={`How the state comes out ${amount(net)} a year ${net >= 0 ? "ahead" : "behind"} under ${DESIGN_MID[des]}`}
          subtitle={`$ millions a year, all state funds, against today; FY${fy}`}
          reading={
            <>
              Read from the top. Each bar starts where the one above ended. "No change" on the first row means the state keeps its full take on
              every bottle. Solid bars are revenue; hatched bars are cost changes, which are not revenue. Gray bars are running totals.
            </>
          }
          readingText="Read from the top; each bar starts where the one above ended. 'No change' on the first row means the state keeps its full take on every bottle. Solid bars are revenue, hatched bars are cost changes (not revenue), gray bars are running totals."
          limits={
            <>
              Store savings are an allocation of DABS expense lines and new licensing costs an illustration; neither is measured. Local sales tax is
              not modeled. The same purchases move and nothing else changes; the next chart shows other cases.
            </>
          }
          limitsText="Store savings are an allocation of DABS expense lines and new licensing costs an illustration; neither is measured. Local sales tax is not modeled. Fixed volume; the next chart shows other cases."
          source={SOURCE}
          methods={methods}
          filename={`utah_grocery_wine_bridge_${des}`}
          explore={
            <Go to={{ v: "scenario", ...f.values, eg: init.worked.proposalId }} reset>
              Change the assumptions in the revenue calculator
            </Go>
          }
          csv={{
            columns: [
              { key: "design", kind: "text", get: (r) => r.design },
              { key: "step", kind: "text", get: (r) => r.step },
              { key: "kind", kind: "text", get: (r) => r.kind },
              { key: "change_usd_per_year", kind: "number", get: (r) => r.change_usd_per_year },
              { key: "running_total_usd_per_year", kind: "number", get: (r) => r.running_total_usd_per_year },
            ],
            rows: bridgeRows,
          }}
          table={
            <div className="table-wrap">
              <table className="data">
                <caption className="visually-hidden">Annual change in state revenue and costs, step by step</caption>
                <thead>
                  <tr>
                    <th scope="col">Step</th>
                    <th scope="col">Kind</th>
                    <th scope="col" className="num">
                      $ a year
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {steps.map((s) => (
                    <tr key={s.id}>
                      <th scope="row">{s.label}</th>
                      <td>{s.kind === "revenue" ? "Revenue" : s.kind === "cost" ? "Cost change" : "Running total"}</td>
                      <td className="num">{usd(s.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="small muted">Today's state revenue on wine, for scale: {usd(f.baseline)} a year (DABS's markup income on wine plus state sales tax).</p>
            </div>
          }
        >
          {(w) => <BridgeChart steps={steps} width={w} label={`Annual change in state revenue and costs under ${DESIGN_MID[des]}: net ${millions(net)}`} />}
        </ChartFigure>

        <h4>The accounts these changes are measured against</h4>
        <p>
          The chart above is a change against DABS's accounts today. Those accounts run from{" "}
          {amount(init.worked.data.sales)} of sales to {amount(init.worked.data.statement.netProfit)} of net profit: gross collections are not
          net revenue.
        </p>
        <ChartFigure
          id="br-accounts"
          title={`DABS's FY${fy} accounts, from sales to net profit`}
          subtitle={`$ millions, all products (not wine alone); FY${fy} income statement, unaudited`}
          reading={
            <>
              Read from the top. Solid bars bring money in; hatched bars are costs and transfers; gray bars are totals as DABS prints them. Gross
              profit is what the markup brings in; DABS's own costs and the statutory transfers come out of it before net profit reaches the
              General Fund.
            </>
          }
          readingText="Read from the top. Solid bars bring money in; hatched bars are costs and transfers; gray bars are totals as DABS prints them. DABS's costs and the statutory transfers come out of gross profit before net profit reaches the General Fund."
          limits={
            <>
              All products together, from the unaudited annual report (p. 30); it is not an accounting of wine. The report's five-year summary
              (p. 32) prints other income as {amount(init.worked.data.statement.otherIncomeSummary)} instead of{" "}
              {amount(init.worked.data.statement.otherIncome)} and does not reproduce this net profit; the dataset keeps both and resolves
              neither.
            </>
          }
          limitsText="All products together, from the unaudited annual report (p. 30), not an accounting of wine. The five-year summary (p. 32) prints a different other-income figure and does not reproduce the net profit; the dataset keeps both and resolves neither."
          source={`DABS FY${fy} annual report, income statement (p. 30) and five-year summary (p. 32)`}
          methods={`${BOTTLE_METHOD}; ${BRIEFING_METHOD}`}
          filename={`utah_dabs_accounts_fy${fy}`}
          explore={
            <>
              <Go to={{ v: "sources" }}>Sources</Go> lists the annual report; docs/fiscal-reconciliation.md in the public research repository
              records every printed total that does not add up.
            </>
          }
          csv={{
            columns: [
              { key: "step", kind: "text", get: (r) => r.step },
              { key: "kind", kind: "text", get: (r) => r.kind },
              { key: "usd", kind: "number", get: (r) => r.usd },
              { key: "running_total_usd", kind: "number", get: (r) => r.running_total_usd },
              { key: "note", kind: "text", get: (r) => r.note },
            ],
            rows: accountRows,
          }}
          table={
            <div className="table-wrap">
              <table className="data">
                <caption className="visually-hidden">DABS's accounts from sales to net profit, dollars</caption>
                <thead>
                  <tr>
                    <th scope="col">Line</th>
                    <th scope="col" className="num">
                      $
                    </th>
                    <th scope="col">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((s) => (
                    <tr key={s.id}>
                      <th scope="row">{s.label}</th>
                      <td className="num">{usd(s.value)}</td>
                      <td className="small">{s.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          }
        >
          {(w) => <BridgeChart steps={accounts} width={w} label={`DABS's FY${fy} accounts from ${amount(init.worked.data.sales)} of sales to ${amount(init.worked.data.statement.netProfit)} of net profit`} />}
        </ChartFigure>
      </section>

      <section className="panel" aria-labelledby="br-work">
        <h3 id="br-work">What each design requires</h3>
        <ul className="findings">
          <li>
            <strong>The state's share of each bottle is kept.</strong> DABS selling to grocers at today's price, or a private-supply charge equal to
            DABS's markup. Whether grocers would stock wine at the price that implies, and how many shoppers would buy it there, is not yet
            measured.
          </li>
          <li>
            <strong>Prices.</strong> In these two designs grocers set their own prices and state stores keep today's. Under the same-shelf-price
            design grocers charge the state-store price, which needs a grocer price below the markup floor.
          </li>
          <li>
            <strong>School-meals funding.</strong> In the DABS design, if DABS's sales to grocers count toward the school-meals and
            enforcement deposits, those funds do not change. In the private design, they stay whole if {amount(fundsNeed)} a year of the{" "}
            {amount(keepC.reconciliation.taxes.charge)} charge goes to them; the state as a whole is still {amount(keepC.fixed.ledger.net)} ahead.
          </li>
          <li>
            <strong>A grocery wine license.</strong> Today a beer license gives a grocer no authority to sell wine. The private design also
            needs new authority for private wine wholesale and for the charge.
          </li>
        </ul>
        <p className="small">
          A third route, producers selling to grocers directly with the same charge, comes out like the private design: the charge keeps the
          state's share of each bottle, and cheaper direct delivery would lower the grocery price, and the sales tax on it, rather than raise the
          state's take. It needs new authority
          for producers to sell to grocers, and its federal questions are unresolved.{" "}
          <Go to={{ v: "initiative" }} reset>
            Producer-direct supply in the full analysis
          </Go>
          .
        </p>
      </section>

      <section className="panel" aria-labelledby="br-unc">
        <h3 id="br-unc">What could change the numbers</h3>
        <p>
          The chart shows the state's result in each case the model can test. Only the two readings where shoppers buy less wine come out short,
          and they assume those shoppers leave Utah's wine market even though state stores still sell the same bottle at today's price.
        </p>
        {pick("bs-whatif")}
        <ChartFigure
          id="br-whatif"
          title={`The state stays ahead in ${ahead} of ${bars.length} cases under ${DESIGN_MID[des]}`}
          subtitle={`Net change in state revenue, $ millions a year; FY${fy}; each bar is a separate case, drawn from zero`}
          reading={
            <>
              The gray bar is the main case. Bars to the right of $0 leave the state ahead; bars to the left leave it short. Cases marked
              exploratory or illustrative are not measured for Utah.
            </>
          }
          readingText="The gray bar is the main case. Bars to the right of $0 leave the state ahead; bars to the left leave it short. Cases marked exploratory or illustrative are not measured for Utah."
          limits={
            <>
              None of these cases is measured for Utah, and they are not probabilities. Exploratory cases borrow measures from other changes (a
              market-wide price response; full privatization elsewhere); illustrative ones have no source.
            </>
          }
          limitsText="None of these cases is measured for Utah, and they are not probabilities. Exploratory cases borrow measures from other changes; illustrative ones have no source."
          source={SOURCE}
          methods={methods}
          filename={`utah_grocery_wine_cases_${des}`}
          explore={
            <>
              Every case for every design, with its ledger, is in <Go to={{ v: "initiative" }}>the full analysis</Go>.
            </>
          }
          csv={{
            columns: [
              { key: "design", kind: "text", get: (r) => r.design },
              { key: "case", kind: "text", get: (r) => r.case },
              { key: "basis", kind: "text", get: (r) => r.basis },
              { key: "net_usd_per_year", kind: "number", get: (r) => r.net_usd_per_year },
            ],
            rows: whatIfRows,
          }}
          table={
            <div className="table-wrap">
              <table className="data">
                <caption className="visually-hidden">Net change in state revenue in each case</caption>
                <thead>
                  <tr>
                    <th scope="col">Case</th>
                    <th scope="col" className="num">
                      $ a year
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {bars.map((b) => (
                    <tr key={b.id}>
                      <th scope="row">{b.label}</th>
                      <td className="num">{usd(b.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          }
          legend={
            <ul className="chart-legend small">
              <li>
                <span className="swatch-box b-total" aria-hidden="true" />
                Main case
              </li>
              <li>
                <span className="swatch-box b-gain" aria-hidden="true" />
                State ahead
              </li>
              <li>
                <span className="swatch-box b-loss" aria-hidden="true" />
                State short
              </li>
            </ul>
          }
        >
          {(w) => <BridgeChart steps={bars} width={w} connect={false} label={`Net change in state revenue in each case under ${DESIGN_MID[des]}: ahead in ${ahead} of ${bars.length}`} />}
        </ChartFigure>
        <h4>Not measured anywhere yet</h4>
        <ul className="small source-list">
          <li>What margin grocers would accept on wine, or what they would charge for it.</li>
          <li>How many purchases would move to grocers at any price.</li>
          <li>Which DABS store costs would actually stop when sales leave.</li>
          <li>DABS wine sales by customer type (households against bars and restaurants).</li>
        </ul>
        <h4>What this analysis measures, and what it does not</h4>
        <div className="table-wrap">
          <table className="data scope-table">
            <caption className="visually-hidden">What the model covers</caption>
            <tbody>
              <tr>
                <th scope="row">State revenue, all state funds</th>
                <td>Modeled: the results above.</td>
              </tr>
              <tr>
                <th scope="row">School-meals and enforcement funds</th>
                <td>Modeled as allocations inside the state total, never added to it.</td>
              </tr>
              <tr>
                <th scope="row">Local government (local sales tax)</th>
                <td>Not modeled.</td>
              </tr>
              <tr>
                <th scope="row">Shoppers' prices</th>
                <td>Each design's grocery price is computed; state stores keep today's prices.</td>
              </tr>
              <tr>
                <th scope="row">Grocer and wholesaler profitability</th>
                <td>Gross margins only; their own costs and profits are not known.</td>
              </tr>
              <tr>
                <th scope="row">DABS operations</th>
                <td>Store savings are an allocation of DABS expense lines; stores stay open.</td>
              </tr>
              <tr>
                <th scope="row">How much people drink, and public health</th>
                <td>
                  Not modeled here. The <Go to={{ v: "change" }}>before-and-after tool</Go> and the data views show other states' measures,
                  descriptively.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel" aria-labelledby="br-assume">
        <h3 id="br-assume">What the figures assume</h3>
        <p className="small">
          The worked example's inputs, what each rests on and how far it moves that example's result. The two designs share its wine sales, wine
          margin, households' share, the 30% that moves and the tax and deposit rates; their own inputs (a {pct(c.settings.grocerMargin)} grocer
          margin, a {pct(c.settings.wholesalerMargin, 1)} wholesaler margin and store savings of 2.3¢ per dollar) are listed with every design in
          the full analysis. A published source can still have been transcribed wrongly: none of these values has yet been checked by a person.
        </p>
        <AssumptionRegister init={init} f={f} />
        <h4>How current the figures are</h4>
        <ul className="small source-list">
          <li>
            DABS's accounts: the FY{fy} annual report (the year to June 30, {fy}; unaudited). The FY{fy + 1} annual report is not in the dataset
            yet.
          </li>
          <li>Wine's share of DABS's sales: the monthly Sales Analysis Reports, July {fy} to June {fy + 1}.</li>
          <li>Utah law: the statutes as read on {man.data?.dataset.law_as_of_date ?? "the dataset's law date"}; a later session can change them.</li>
          <li>Wine gallons: NIAAA, 2024. National wholesaler and grocery margins: Census trade surveys, 2022.</li>
          <li>
            Data release {man.data?.dataset.release_version ?? "—"}, build {man.data?.dataset.build_id ?? "—"}.{" "}
            <Go to={{ v: "coverage" }}>Coverage and missing data</Go> gives every dataset's period.
          </li>
        </ul>
      </section>

      <section className="panel" aria-labelledby="br-more">
        <h3 id="br-more">Explore the full model</h3>
        <ul className="more-links">
          <li>
            <Go to={{ v: "initiative" }}>The full analysis</Go>: every design, the purchase flows, the price-and-share grid and the questions for
            DABS and legislative staff.
          </li>
          <li>
            <Go to={{ v: "scenario", ...f.values, eg: init.worked.proposalId }}>The revenue calculator</Go>, opened on the October worked example, to
            change any input.
          </li>
          <li>
            <Go to={{ v: "methods" }}>Definitions and methods</Go>, <Go to={{ v: "sources" }}>sources</Go> and{" "}
            <Go to={{ v: "downloads" }}>downloadable data</Go>.
          </li>
        </ul>
      </section>
    </article>
  );
}
