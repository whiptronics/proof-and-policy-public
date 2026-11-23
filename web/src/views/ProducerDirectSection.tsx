// Producer-direct supply (scenario D) on the initiative page (lib/producerDirect.ts, PRODUCER_DIRECT_METHOD). Every number
// comes from directReport(), the same report the export writes to producer_direct.json and the independent check
// recomputes.
import { useMemo } from "react";
import { DIRECT_COST_SHARES, PRODUCER_DIRECT_METHOD, PRODUCER_PREMIUMS, directReport } from "../lib/producerDirect";
import { WINE_ALTERNATIVES_METHOD } from "../lib/wineAlternatives";
import { minus } from "../lib/format";

const pct = (v: number, d = 0) => `${minus((v * 100).toFixed(d))}%`;
const money = (v: number) => `${v < 0 ? "−" : "+"}$${(Math.abs(v) / 1e6).toFixed(2)}M`;

export function ProducerDirectSection() {
  const rep = useMemo(() => directReport(), []);
  const { main, wholesale, grid } = rep;
  const cell = (c: number, p: number) => grid.find((g) => g.costShare === c && g.producerPremium === p)!;
  const cheapest = cell(0, 0).result;
  const demand = (id: string) => main.demand.find((d) => d.id === id)!.net;
  const nets = grid.map((g) => g.result.zeroSavings.net);
  return (
    <section className="panel" aria-labelledby="in-direct">
      <h3 id="in-direct">Producer-direct supply (scenario D): no wholesaler and no DABS</h3>
      <p>
        Grocers would buy wine straight from producers. The state would collect through a charge equal to DABS's markup per bottle, collected
        from the grocer, as in the private design. Removing the wholesaler removes its margin, not its work: someone still delivers, takes
        orders and does the paperwork. So the main case assumes that work costs producers what it earns a wholesaler today, and the table shows
        what changes if it costs less, or if producers charge grocers more than DABS pays.
      </p>
      <p className="finding">
        <strong>The charge keeps the state's share of each bottle; the supply chain moves the grocery price, and sales tax with it.</strong>{" "}
        With no store costs counted as saved, the main case leaves the state about {money(Math.abs(main.zeroSavings.net)).slice(1)} a year {main.zeroSavings.net < 0 ? "short" : "ahead"}, the same as private
        wholesale ({money(wholesale.zeroSavings.net)}). If direct delivery cost producers nothing, grocery wine would be about{" "}
        {pct(cheapest.fixed.stack.consumerChange)} above the state store instead of {pct(main.fixed.stack.consumerChange)}, and the state would
        collect less sales tax on the lower price: across the table it comes out {money(Math.min(...nets))} to {money(Math.max(...nets))} a
        year{nets.every((n) => n > 0) ? ", ahead in every case" : ""}.
      </p>
      <div className="table-wrap" tabIndex={0} role="region" aria-label="Producer-direct supply: grocery price and state result">
        <table className="data">
          <caption>
            Grocery price against the state store, and the state's annual change, by what direct delivery costs the producer and what producers
            charge grocers
          </caption>
          <thead>
            <tr>
              <th scope="col">Producers charge grocers</th>
              {DIRECT_COST_SHARES.map((c) => (
                <th key={c} scope="col" className="num">
                  Delivery costs {pct(c, c === DIRECT_COST_SHARES[DIRECT_COST_SHARES.length - 1] ? 1 : 0)}
                  {c === DIRECT_COST_SHARES[DIRECT_COST_SHARES.length - 1] ? " (a wholesaler's margin)" : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PRODUCER_PREMIUMS.map((p) => (
              <tr key={p}>
                <th scope="row">{p === 0 ? "What DABS pays" : `${pct(p)} more than DABS pays`}</th>
                {DIRECT_COST_SHARES.map((c) => {
                  const r = cell(c, p).result;
                  const isMain = r.def.id === main.def.id;
                  return (
                    <td key={c} className="num" data-label={`Delivery costs ${pct(c, 1)}`}>
                      {isMain ? <strong>+{pct(r.fixed.stack.consumerChange)} price</strong> : <>+{pct(r.fixed.stack.consumerChange)} price</>}
                      <br />
                      <span className="small">state {money(r.zeroSavings.net)}</span>
                      {isMain && <span className="small muted"> (main case)</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted">
        Delivery cost is a share of the producer's price to the grocer; the grocer prices for the 28% reference margin. Fixed volume, 30% of
        household wine purchases moving, FY2025 figures, no store costs counted as saved: conditional, not a forecast. The allocated store
        savings (card fees, agency contracts and bags, an allocation, not a measured saving) would make the main case{" "}
        {money(main.fixed.ledger.net)}; with them, if the higher grocery price sends some shoppers back to state stores, it is{" "}
        {money(demand("return_to_stores"))}, and in the exploratory case where Utahns buy less wine in total,{" "}
        {money(demand("price_constant"))}. Methods {PRODUCER_DIRECT_METHOD} on {WINE_ALTERNATIVES_METHOD}; the independent check recomputes every
        cell.
      </p>
      <details>
        <summary>What the law would have to change</summary>
        <ul className="small source-list">
          {main.legal.map((n) => (
            <li key={n.item}>
              <strong>{n.item}</strong> ({n.status}). {n.text} <span className="muted">{n.cite}</span>
            </li>
          ))}
        </ul>
      </details>
      <details>
        <summary>What it assumes, and what it does not establish</summary>
        <ul className="small source-list">
          {rep.assumptions.map((a) => (
            <li key={a.id}>
              <strong>
                {a.id} {a.label}
              </strong>{" "}
              ({a.standing}): {a.value}. {a.note}
            </li>
          ))}
          <li>
            Not established: whether producers, especially small and out-of-state ones, would sell to Utah grocers at all; what direct delivery
            actually costs; what federal rules allow; and what registering and auditing many producers would cost beyond the $500,000
            illustration for all new administration.
          </li>
        </ul>
      </details>
    </section>
  );
}
