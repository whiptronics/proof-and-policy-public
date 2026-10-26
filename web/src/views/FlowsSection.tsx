// Where grocery wine would come from: the purchase-flow model (lib/wineFlows.ts, lib/wineFlowScenarios.ts) on the
// initiative page. Every number is computed here from the model; nothing is copied from the graph package.
import { useMemo } from "react";
import { FLOW_ASSUMPTIONS, WINE_FLOWS_METHOD, arrangementTerms, type FlowArrangementId } from "../lib/wineFlows";
import { breakEvenTable, scenarioRuns, type ScenarioRun } from "../lib/wineFlowScenarios";

const millions = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : `${v < -5e4 ? "−" : v > 5e4 ? "+" : ""}$${(Math.abs(v) / 1e6).toFixed(1)}M`);
const pct = (v: number | null | undefined, digits = 1) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : `${(v * 100).toFixed(digits)}%`);

const DESIGNS: FlowArrangementId[] = ["preserved_dabs", "preserved_private", "dabs_discount_20", "private_tax_20"];
const ROWS: { id: string; label: string }[] = [
  { id: "accounting_30", label: "30% of household wine moves at any price; nothing else changes" },
  { id: "channel_60", label: "Channel choice: none move at a 60% grocery premium; the rest stay at DABS" },
  { id: "channel_30", label: "Channel choice: none move at a 30% premium" },
  { id: "beer_2", label: "Wine replaces 2% of households' beer, same alcohol" },
  { id: "beer_5", label: "Wine replaces 5% of households' beer, same alcohol" },
  { id: "spirits_5", label: "Wine replaces 5% of households' spirits, same alcohol" },
  { id: "recapture_2", label: "Wine now bought in other states, 2% of household DABS wine, bought here" },
  { id: "additional_2", label: "Additional wine, 2% of household DABS wine (more alcohol)" },
  { id: "migrant_response", label: "Exploratory: the old price response (a market-wide elasticity on one channel)" },
];
const LEVERS = [
  { id: "beer", words: "of households' beer replaced" },
  { id: "spirits", words: "of their spirits replaced" },
  { id: "additional", words: "more wine (or wine brought back from other states)" },
] as const;

export function FlowsSection() {
  const runs = useMemo(() => scenarioRuns(DESIGNS), []);
  const be = useMemo(() => breakEvenTable(), []);
  const at = (a: string, s: string): ScenarioRun => runs.find((r) => r.arrangement.id === a && r.scenario.id === s)!;
  const terms = DESIGNS.map((id) => arrangementTerms(id));
  const s01 = FLOW_ASSUMPTIONS.find((a) => a.id === "S01")!;
  const beWords = (a: FlowArrangementId) =>
    LEVERS.map((l) => {
      const r = be.find((k) => k.arrangement === a && k.context === "accounting_30" && k.lever === l.id)!;
      if (r.status === "found") return `${pct(r.value)} ${l.words}`;
      if (r.status === "already_above") return `none needed (${l.id})`;
      if (r.status === "wrong_direction") return l.id === "spirits" ? "not by replacing spirits, which lowers receipts" : `not by ${l.id}`;
      return `not within the tested range (${l.id})`;
    }).join("; ");
  const presAbove = be.filter((k) => k.arrangement.startsWith("preserved") && k.context === "accounting_30" && k.lever !== "migration").every((k) => k.status === "already_above");
  const b5 = at("preserved_dabs", "beer_5").result;
  const wineL = b5.origins.find((o) => o.id === "B")!.grocery.litres;
  return (
    <section className="panel" aria-labelledby="in-flows">
      <h3 id="in-flows">Where grocery wine would come from</h3>
      <p>
        The comparison above moves existing wine purchases from state stores to grocers and nothing else. Grocery wine could also replace beer
        or spirits bought on the same trip, bring home wine now bought in other states, or add to what households buy. This section keeps those
        sources apart and computes the state's collections and costs before and after. <strong>Moving a bottle costs the state money only when
        the arrangement collects less on it than DABS's markup.</strong> Whether that happens, and what else changes, is what the designs and
        scenarios below differ on.
      </p>
      <p className="small muted">
        "Preserved" designs keep the state's markup on every grocery bottle, through DABS as wholesaler or a per-gallon charge on private
        supply. That is a proposed design, not current law, and it does not keep the price: paying a grocer 28% puts grocery wine{" "}
        {pct(terms[0].consumerRatio - 1, 0)} (DABS) or {pct(terms[1].consumerRatio - 1, 0)} (private) above the state store. Substitution holds
        pure alcohol constant. Every share of switching, recapture or additional buying is illustrative: no Utah evidence gives any of them.
        Method {WINE_FLOWS_METHOD}; FY2025, all state funds together, $ a year.
      </p>
      <div className="table-wrap">
        <table className="data initiative-table">
          <thead>
            <tr>
              <th scope="col">Scenario</th>
              {terms.map((t) => (
                <th key={t.id} scope="col" className="num">
                  {t.short} (grocery price {t.consumerRatio > 1 + 1e-9 ? `+${pct(t.consumerRatio - 1, 0)}` : "unchanged"})
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.id}>
                <th scope="row" className="small">
                  {row.label}
                </th>
                {DESIGNS.map((a) => (
                  <td key={a} className="num">
                    {millions(at(a, row.id).result.change.net)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="small source-list">
        <li>
          <strong>Break-even at 30% moving, one source at a time.</strong>{" "}
          {presAbove ? "The preserved designs need none: they are already at or above today's receipts. " : ""}DABS 20% discount:{" "}
          {beWords("dabs_discount_20")}. Private 20% tax: {beWords("private_tax_20")}.
        </li>
        <li>
          <strong>More wine sold is not more alcohol.</strong> Replacing 5% of households' beer at the same alcohol means about{" "}
          {(wineL / 1e6).toFixed(1)} million more litres of wine a year and less beer, with the same pure alcohol. Equal litres of wine for
          beer, or additional wine, would add alcohol.
        </li>
        <li>
          <strong>Overlap is not switching.</strong> A 2022 survey of 631 U.S. drinkers aged 21–39 (Wine Opinions) found that {s01.value} of
          those who prefer beer already drink wine weekly or more. That overlap exists today. It is not a Utah figure, a switching rate or an
          effect of grocery availability, and the model does not use it.
        </li>
        <li>
          <strong>The old price response is exploratory.</strong> It applied a market-wide elasticity to the grocery price as if every wine
          price had risen, and counted bottles not bought at grocers as gone from Utah, though DABS still sells them at today's price. In the
          channel-choice rows, shoppers who decline the grocery price keep buying at DABS; the straight lines are an assumption, not an
          estimated model.
        </li>
        <li>
          <strong>What is verified.</strong> An independent script recomputes every scenario, grid point and break-even with separate closed
          forms. That verifies the arithmetic, not any behavioural assumption. Tennessee's receipts rose after grocery wine, but there wine and
          spirits were already sold by private licensees, so it does not show how much of Utah's grocery wine would be switching, recapture or
          new purchases.
        </li>
      </ul>
    </section>
  );
}
