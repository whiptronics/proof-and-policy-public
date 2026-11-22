// One bottle of wine, built up from what it costs DABS to land (lib/bottle.ts): the statute's minimum markup, what DABS
// actually earns, who receives each part of the price today and under three designs, and where DABS's markup went in
// FY2025. The designs' splits are the alternatives report's price stacks at bottle scale (lib/briefing.ts designSplit);
// every part is labeled with its basis: the reader's input, an observation, a statutory rate, an assumption or a policy
// choice.
import { useMemo, useState } from "react";
import { BOTTLE_METHOD, bottleScale, dabsDollar, statutoryFloor } from "../lib/bottle";
import { BRIEFING_METHOD, designSplit, type FlowColumn } from "../lib/briefing";
import { INITIATIVES } from "../lib/initiatives";
import { WINE_ALTERNATIVES_METHOD, alternativesReport, type AltResult } from "../lib/wineAlternatives";
import { SplitChart, SplitLegend } from "./BriefCharts";
import { Go } from "./common";
import { ChartFigure, type Row } from "./ChartFigure";

const usd = (v: number) => `$${v.toFixed(2)}`;
const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;

const DESIGNS: { id: string; label: string; law: string }[] = [
  { id: "A_target", label: "DABS design: DABS sells to grocers at today's price; the grocer adds a 28% margin", law: "Needs a grocery wine license; the markup law stays as it is" },
  { id: "C_take", label: "Private design: a wholesaler, a state charge equal to DABS's markup, and the grocer", law: "Needs a grocery wine license, private wholesale and the new charge" },
  { id: "B20_matched", label: "Lowers state revenue: DABS sells to grocers at 80% and grocers must match the state-store price", law: "Needs a grocery wine license and a markup below the legal minimum" },
];

function basisOf(seg: string, r: AltResult | null): string {
  switch (seg) {
    case "supplier":
      return "Your input: the landed cost";
    case "dabs_margin":
      if (!r) return "Observed: DABS's FY2025 margin, all products, applied to wine; smaller where DABS sells to grocers below its shelf price";
      return typeof r.def.discount === "number" && r.def.discount > 0
        ? `Policy choice: DABS's observed margin, with DABS selling to grocers at ${Math.round((1 - r.def.discount) * 100)}% of its shelf price`
        : "Observed: DABS's FY2025 margin, all products, applied to wine";
    case "state_charge":
      return "Policy choice: sized to DABS's markup per bottle";
    case "wholesaler":
      return "Assumption: national alcohol-wholesaler gross margin";
    case "grocer":
      return r?.def.pricing === "matched" ? "Arithmetic: what is left at the state-store price" : "Assumption: national grocery gross margin, 28%";
    case "sales_tax":
      return "Statutory rate: state portion only (local not modeled)";
    default:
      return "";
  }
}

export function BottleBreakdown() {
  const [text, setText] = useState("10.00");
  const parsed = Number(text);
  const valid = Number.isFinite(parsed) && parsed >= 1 && parsed <= 500;
  const [landed, setLanded] = useState(10);
  const data = INITIATIVES[0].worked.data;
  const alt = useMemo(() => alternativesReport(), []);
  const results = DESIGNS.map((d) => alt.results.find((r) => r.def.id === d.id)!);
  const today = results[0].fixed.stack.today;
  const k = bottleScale(today, landed);
  const cols: FlowColumn[] = designSplit(
    DESIGNS.map((d, i) => ({ ...d, stack: results[i].fixed.stack })),
    { label: "Today: state liquor store", law: "Current law" },
    k,
  );
  const floor = statutoryFloor(landed);
  const margin = data.grossProfit / data.sales;
  const shelfToday = cols[0].shelf;
  const dollar = dabsDollar(data);
  const part = (id: string) => dollar.find((p) => p.id === id)!.share * shelfToday;
  const resultOf = (c: FlowColumn) => results.find((r) => r.def.id === c.id) ?? null;
  const segIds = ["supplier", "dabs_margin", "state_charge", "wholesaler", "grocer", "sales_tax"].filter((id) => cols.some((c) => c.segments.some((s) => s.id === id)));
  const segLabel = (id: string) => cols.flatMap((c) => c.segments).find((s) => s.id === id)!.label;
  const methods = `${BOTTLE_METHOD} · ${BRIEFING_METHOD} · ${WINE_ALTERNATIVES_METHOD}`;
  const rows: Row[] = cols.flatMap((c) =>
    c.segments.map((s) => ({ design: c.label, part: s.label, receives: s.to, basis: basisOf(s.id, resultOf(c)), usd: Math.round(s.amount * 100) / 100 })),
  );

  return (
    <div className="bottle">
      <p>
        <label htmlFor="bottle-landed">What the bottle costs DABS to land (product, inbound shipping and handling), $ </label>
        <input
          id="bottle-landed"
          inputMode="decimal"
          value={text}
          aria-describedby="bottle-landed-note"
          aria-invalid={!valid}
          onChange={(e) => {
            setText(e.target.value);
            const v = Number(e.target.value);
            if (Number.isFinite(v) && v >= 1 && v <= 500) setLanded(v);
          }}
        />{" "}
        <span id="bottle-landed-note" className="small muted">
          {valid ? "An illustration: any value from $1 to $500." : `Enter a value from $1 to $500; showing ${usd(landed)}.`}
        </span>
      </p>

      <ul className="findings">
        <li>
          <strong>The law sets a floor, not a price.</strong> DABS must mark wine up at least 88.5% over its landed cost (Utah Code §
          32B-2-304(2)(b)): {usd(floor.landed)} + {usd(floor.markup)} = <strong>{usd(floor.price)}</strong> before sales tax.
        </li>
        <li>
          <strong>What DABS actually earns is a little above that floor.</strong> Across all products in FY{data.fy}, DABS kept {pct(margin)} of
          its sales (a markup of {pct(margin / (1 - margin))} on cost), and the model uses that for wine: {usd(landed)} becomes{" "}
          {usd(shelfToday)} on the state-store shelf, plus {usd(cols[0].segments.find((s) => s.id === "sales_tax")!.amount)} of state sales tax.
        </li>
        <li>
          <strong>The markup is part of the price, not a tax, and not profit.</strong> DABS charges it as the seller; sales tax is the tax,
          added at the register. Out of the markup DABS pays its stores, staff and warehouse, then the school-meals and other transfers, and
          what is left reaches the General Fund as net profit.
        </li>
      </ul>

      <ChartFigure
        id="bottle-split"
        title={`One bottle that costs ${usd(landed)} to land: who receives each part of the price`}
        subtitle={`Dollars per bottle; DABS's FY${data.fy} margin; designs from the policy alternatives report; same purchases, nothing else changes`}
        reading={
          <>
            Each bar adds up to what the shopper pays for the same bottle. The supplier's part is the same in every bar. Teal is the state:
            solid for DABS's markup income, hatched for a state charge and for sales tax.
          </>
        }
        readingText="Each bar adds up to what the shopper pays for the same bottle; the supplier's part is the same in every bar. Teal is the state: solid for DABS's markup income, hatched for a state charge and sales tax."
        limits={
          <>
            Shares, not a forecast: the wholesaler's and grocer's margins are national averages, not Utah grocery wine; whether grocers would
            stock wine at these prices, or shoppers buy it there, is not measured. DABS's markup income is before its operating costs.
          </>
        }
        limitsText="Shares, not a forecast: the wholesaler's and grocer's margins are national averages; whether grocers would stock wine at these prices is not measured. DABS's markup income is before its operating costs."
        source="DABS FY2025 annual report (sales, gross profit, income statement); Utah Code § 32B-2-304; Utah State Tax Commission Publication 25; Census 2022 wholesale and retail trade surveys (national margins)"
        methods={methods}
        filename="utah_wine_one_bottle"
        explore={
          <>
            Every design, including producer-direct supply, is in <Go to={{ v: "initiative" }}>the full analysis</Go>.
          </>
        }
        csv={{
          columns: [
            { key: "design", kind: "text", get: (r) => r.design },
            { key: "part", kind: "text", get: (r) => r.part },
            { key: "receives", kind: "text", get: (r) => r.receives },
            { key: "basis", kind: "text", get: (r) => r.basis },
            { key: "usd_per_bottle", kind: "number", get: (r) => r.usd },
          ],
          rows,
        }}
        legend={<SplitLegend />}
        table={
          <div className="table-wrap" tabIndex={0} role="region" aria-label="One bottle, part by part">
            <table className="data">
              <caption>Dollars per bottle that costs {usd(landed)} to land</caption>
              <thead>
                <tr>
                  <th scope="col">Part of the price</th>
                  {cols.map((c) => (
                    <th key={c.id} scope="col" className="num">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {segIds.map((id) => (
                  <tr key={id}>
                    <th scope="row">
                      {segLabel(id)}
                      <br />
                      <span className="small muted">{basisOf(id, null)}</span>
                    </th>
                    {cols.map((c) => {
                      const s = c.segments.find((g) => g.id === id);
                      return (
                        <td key={c.id} className="num" data-label={c.label}>
                          {s ? usd(s.amount) : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr>
                  <th scope="row">The shopper pays</th>
                  {cols.map((c) => (
                    <td key={c.id} className="num" data-label={c.label}>
                      <strong>{usd(c.consumer)}</strong>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        }
      >
        {(w) => <SplitChart cols={cols} width={w} label={`One bottle that costs ${usd(landed)} to land, today and under three designs`} />}
      </ChartFigure>

      <h4>Where DABS's markup went in FY{data.fy}</h4>
      <p>
        On DABS's income statement, all products together, each {usd(shelfToday)} of state-store sales paid for:
      </p>
      <div className="table-wrap" tabIndex={0} role="region" aria-label="Where a state-store sale went in FY2025">
        <table className="data">
          <tbody>
            <tr>
              <th scope="row">The product, landed</th>
              <td className="num">{usd(part("cost"))}</td>
            </tr>
            <tr>
              <th scope="row">DABS's operating expenses (stores, staff, warehouse, card fees)</th>
              <td className="num">{usd(part("operating"))}</td>
            </tr>
            <tr>
              <th scope="row">School-meals and other program transfers, and non-operating items, net</th>
              <td className="num">{usd(part("transfers"))}</td>
            </tr>
            <tr>
              <th scope="row">Net profit to the General Fund</th>
              <td className="num">{usd(part("net_profit"))}</td>
            </tr>
            <tr>
              <th scope="row">Less DABS's other income, which also pays for these</th>
              <td className="num">−{usd(-part("other_income"))}</td>
            </tr>
            <tr>
              <th scope="row">The state-store price</th>
              <td className="num">
                <strong>{usd(dollar.reduce((t, p) => t + p.share, 0) * shelfToday)}</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="small muted">
        Averages over every product DABS sold in FY{data.fy}, from its unaudited income statement (annual report p. 30), not an accounting of
        wine alone. That statement adds up line by line; the report's five-year summary (p. 32) prints other income as $
        {(data.statement.otherIncomeSummary / 1e6).toFixed(1)} million instead of ${(data.statement.otherIncome / 1e6).toFixed(1)} million, and its
        own totals do not reach the printed net profit. The dataset keeps both figures and resolves neither (Sources: fiscal reconciliation).
      </p>
    </div>
  );
}
