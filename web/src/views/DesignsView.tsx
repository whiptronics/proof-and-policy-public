// Economics: the five designs compared (lib/policyDesigns.ts), with no store costs counted as saved in the headline.
// Five figures: where the money goes, a bottle's price, state revenue gross and net, the break-even frontier, and a
// what-if panel. Every figure is drawn from the model the export and the briefing use, in ChartFigure frames with
// their data tables and downloads.
import { useId, useMemo, useState } from "react";
import { BridgeChart, SplitChart, SplitLegend } from "../components/BriefCharts";
import { ChartFigure, type Row } from "../components/ChartFigure";
import { Go } from "../components/common";
import { HowWeKnow } from "../components/HowWeKnow";
import { headline } from "../lib/framework";
import type { BridgeStep, FlowColumn, FlowSegment } from "../lib/briefing";
import {
  CONVENIENCE_LIMITS,
  DESIGNS,
  POLICY_DESIGNS_METHOD,
  SAVINGS_CASES,
  defaultDesignsReport,
  whatIfDesigns,
  type DesignId,
  type DesignResult,
  type Flow,
  type SavingsCase,
} from "../lib/policyDesigns";
import { RETAILER_TARGET, WHOLESALER_MARGIN, WINE_ALTERNATIVES_METHOD } from "../lib/wineAlternatives";

const SOURCE =
  "DABS FY2025 annual report and FY2026 monthly sales reports; Utah Code § 32B-2-304; Census 2022 wholesale and retail trade surveys (reference margins); Census County Business Patterns 2023 (grocery establishments)";
const METHODS = `${POLICY_DESIGNS_METHOD}; ${WINE_ALTERNATIVES_METHOD}`;
const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;
const m = (v: number) => `${v < -0.5 ? "−" : v > 0.5 ? "+" : ""}$${(Math.abs(v) / 1e6).toFixed(2)}M`;
const LIMIT_LABEL = (l: number | null) => (l === null ? "30% of household purchases move (fixed share)" : `price-sensitive: nobody moves at a ${pct(l, 0)} premium`);
const ALT: DesignId[] = ["B", "C", "D", "E"];

const SEG: Record<Flow["party"], { id: string; to: FlowSegment["to"]; kind: FlowSegment["kind"] }> = {
  supplier: { id: "supplier", to: "supplier", kind: "cost" },
  dabs: { id: "dabs_margin", to: "state", kind: "markup" },
  distributor: { id: "wholesaler", to: "sellers", kind: "margin" },
  grocer: { id: "grocer", to: "sellers", kind: "margin" },
  state_charge: { id: "state_charge", to: "state", kind: "tax" },
  state_sales_tax: { id: "sales_tax", to: "state", kind: "tax" },
};

/** A design's flows as the briefing's split chart draws them, scaled to a bottle that costs `base` at a state store before tax. */
function column(r: DesignResult, when: "today" | "after", base: number, label: string): FlowColumn {
  const flows = r.flows[when].filter((f) => f.perDollar > 1e-9);
  const segments = flows.map((f) => ({ ...SEG[f.party], label: f.label, amount: f.perDollar * base }));
  const pre = flows.filter((f) => f.party !== "state_sales_tax").reduce((t, f) => t + f.perDollar, 0) * base;
  return {
    id: `${r.def.id}-${when}`,
    label,
    law: when === "today" ? "Current law." : r.def.legalStatus,
    segments,
    shelf: pre,
    consumer: segments.reduce((t, s) => t + s.amount, 0),
    state: flows.filter((f) => f.state).reduce((t, f) => t + f.perDollar, 0) * base,
  };
}

function bars(items: { id: string; label: string; value: number }[]): BridgeStep[] {
  return items.map((i) => ({ id: i.id, label: i.label, kind: "revenue", value: i.value, from: 0, to: i.value, note: "" }));
}

function FrontierChart({ width, rows }: { width: number; rows: { premium: number; series: number[] }[] }) {
  const names = ["Take inside DABS's price (B)", "Retail charge, private wholesale (C)", "Retail charge, delivery free (lower bound)"];
  const padL = 44;
  const padR = 12;
  const top = 10;
  const H = 280;
  const bottom = H - 34;
  const x = (p: number) => padL + (p / 0.6) * (width - padL - padR);
  const y = (g: number) => top + ((0.5 - Math.max(-0.1, Math.min(0.5, g))) / 0.6) * (bottom - top);
  const colors = ["var(--series-1)", "var(--series-2)", "var(--series-3)"];
  return (
    <svg className="chart" width={width} height={H} viewBox={`0 0 ${width} ${H}`} role="img" aria-label="Highest grocer margin at which the state breaks even, by consumer price premium">
      <title>Highest grocer margin at which the state breaks even, by consumer price premium</title>
      {[-0.1, 0, 0.1, 0.2, 0.3, 0.4, 0.5].map((g) => (
        <g key={g}>
          <line x1={padL} x2={width - padR} y1={y(g)} y2={y(g)} className={g === 0 ? "axis-zero" : "grid"} />
          <text x={padL - 6} y={y(g) + 4} textAnchor="end" className="tick">
            {pct(g, 0)}
          </text>
        </g>
      ))}
      {[0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6].map((p) => (
        <text key={p} x={x(p)} y={H - 16} textAnchor={p === 0 ? "start" : p === 0.6 ? "end" : "middle"} className="tick">
          +{pct(p, 0)}
        </text>
      ))}
      <line x1={padL} x2={width - padR} y1={y(RETAILER_TARGET)} y2={y(RETAILER_TARGET)} className="ref-line" />
      <text x={width - padR} y={y(RETAILER_TARGET) - 5} textAnchor="end" className="ref-label">
        28% grocer margin
      </text>
      <line x1={x(0.1)} x2={x(0.1)} y1={top} y2={bottom} className="ref-line" />
      <text x={x(0.1) + 4} y={top + 10} className="ref-label">
        10% premium
      </text>
      {names.map((n, k) => (
        <polyline key={n} fill="none" stroke={colors[k]} strokeWidth={2.5} strokeDasharray={k === 2 ? "6 4" : undefined} points={rows.map((r) => `${x(r.premium)},${y(r.series[k])}`).join(" ")}>
          <title>{n}</title>
        </polyline>
      ))}
      <text x={padL} y={H - 2} className="tick">
        Consumer price against a state store
      </text>
    </svg>
  );
}

function Toggle<T extends string>({ label, value, options, set }: { label: string; value: T; options: [T, string][]; set: (v: T) => void }) {
  const name = useId();
  return (
    <fieldset className="radios">
      <legend>{label}</legend>
      {options.map(([v, l]) => (
        <label key={v} className="check">
          <input type="radio" name={name} checked={value === v} onChange={() => set(v)} /> {l}
        </label>
      ))}
    </fieldset>
  );
}

export function DesignsView() {
  const rep = useMemo(() => defaultDesignsReport(), []);
  const get = (id: DesignId) => rep.results.find((r) => r.def.id === id)!;
  const B = get("B");
  const h = headline(rep);
  const [flowDesign, setFlowDesign] = useState<DesignId>("B");
  const [bottle, setBottle] = useState(B.basket[1].id);
  const [savings, setSavings] = useState<SavingsCase>("none");
  const [limitKey, setLimitKey] = useState<string>("fixed");
  const [view, setView] = useState<"net" | "gross">("net");
  const limit = limitKey === "fixed" ? null : Number(limitKey);
  const [w, setW] = useState({ grocerMargin: RETAILER_TARGET, distribution: WHOLESALER_MARGIN, limit: null as number | null, savings: "none" as SavingsCase, admin: rep.terms.admin, feesCoverAdmin: false });
  const what = whatIfDesigns(rep.terms, w);

  const flowCols = [column(get("A"), "today", 100, "Today: a state store"), column(get(flowDesign), "after", 100, get(flowDesign).def.label)];
  const pick = B.basket.find((b) => b.id === bottle)!;
  const pre = pick.stateStore / (1 + rep.terms.salesTax);
  const bottleCols = [column(get("A"), "today", pre, `${pick.label}: state store`), ...ALT.filter((d) => d !== "D").map((d) => column(get(d), "after", pre, get(d).def.short))];
  const caseOf = (r: DesignResult) => r.cases.find((c) => c.savings === savings && c.limit === limit)!;
  const revenueSteps =
    view === "net"
      ? bars(ALT.map((d) => ({ id: d, label: get(d).def.short, value: caseOf(get(d)).net })))
      : bars(ALT.flatMap((d) => [{ id: `${d}-g`, label: `${get(d).def.short}: state receipts on the moved wine, change`, value: caseOf(get(d)).gross.after - caseOf(get(d)).gross.today }]));
  const frontierRows = rep.frontier.map((f) => ({ premium: f.premium, series: [f.wholesalePrice, f.retailChargeReference, f.retailChargeNoDistribution] }));
  const flowRows: Row[] = flowCols.flatMap((c) => c.segments.map((s) => ({ column: c.label, item: s.label, recipient: s.to, usd_per_100_today: Number(s.amount.toFixed(4)) })));
  const tableOf = (rows: Row[]) => (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            {Object.keys(rows[0] ?? {}).map((k) => (
              <th key={k} scope="col">
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {Object.values(r).map((v, j) => (
                <td key={j}>{String(v)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  const csvOf = (rows: Row[]) => ({ columns: Object.keys(rows[0] ?? {}).map((k) => ({ key: k, kind: (typeof rows[0][k] === "number" ? "number" : "text") as "number" | "text", get: (r: Row) => r[k] })), rows });

  const bottleRows: Row[] = bottleCols.map((c) => ({ design: c.label, shelf_usd: Number(c.shelf.toFixed(2)), with_sales_tax_usd: Number(c.consumer.toFixed(2)), state_usd: Number(c.state.toFixed(2)) }));
  const revRows: Row[] = revenueSteps.map((s) => ({ design: s.label, usd_per_year: Math.round(s.value) }));
  const frRows: Row[] = frontierRows.filter((_, i) => i % 5 === 0).map((f) => ({ premium_pct: Number((f.premium * 100).toFixed(0)), b_max_grocer_margin_pct: Number((f.series[0] * 100).toFixed(1)), c_max_grocer_margin_pct: Number((f.series[1] * 100).toFixed(1)), free_delivery_max_grocer_margin_pct: Number((f.series[2] * 100).toFixed(1)) }));
  const wiRows: Row[] = (["B", "C"] as const).map((d) => ({ design: d, premium_pct: Number((what[d].premium * 100).toFixed(1)), share_moving_pct: Number((what[d].share * 100).toFixed(1)), net_usd_per_year: Math.round(what[d].net) }));

  return (
    <>
      <section className="panel" aria-labelledby="ds-h">
        <h2 id="ds-h">Five designs compared</h2>
        <p>
          In these designs grocers set their own prices on top of the state&rsquo;s share of each bottle. The framework&rsquo;s own design keeps the
          shelf price where it is instead: <Go to={{ v: "sameprice" }}>Same shelf price</Go>.
        </p>
        <p className="lede">
          Who supplies the grocers, and where the state's take sits, decide the result. With no store costs counted as saved, none of the four
          alternatives meets every constraint at once: the state ahead in every switching case, a grocery price within{" "}
          {pct(rep.constraints.maxPremium, 0)} of a state store, and a grocer margin of {pct(rep.constraints.minGrocerMargin, 0)}. DABS wholesale (B)
          is the best-supported.
        </p>
        <div className="table-wrap">
          <table className="data">
            <caption>Comparison at the model's defaults (FY2025 dollars a year)</caption>
            <thead>
              <tr>
                <th scope="col">Criterion</th>
                {DESIGNS.map((d) => (
                  <th key={d.id} scope="col">
                    {d.short}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rep.criteria.map((c) => (
                <tr key={c.id}>
                  <th scope="row">
                    {c.label} <span className={c.kind === "assessed" ? "tag tag-assumption" : "tag"}>{c.kind}</span>
                  </th>
                  {DESIGNS.map((d) => (
                    <td key={d.id}>{c.cells[d.id]}</td>
                  ))}
                </tr>
              ))}
              <tr>
                <th scope="row">Verdict against the constraints</th>
                {DESIGNS.map((d) => (
                  <td key={d.id}>{rep.classification[d.id].verdict.replace(/_/g, " ")}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <HowWeKnow
          claim="the comparison"
          inputs={`DABS FY2025 wine sales (${m(rep.terms.wine).replace("+", "")}), its gross margin (${pct(rep.terms.margin)}), the household share (${pct(rep.terms.household, 0)}), state sales tax (${pct(rep.terms.salesTax, 2)}).`}
          assumptions={`A 28% grocer margin and a ${pct(WHOLESALER_MARGIN)} private wholesale margin (Census national references); 30% of household purchases moving in the fixed case; $0.50M a year of new administration (a placeholder); no DABS costs saved in the headline.`}
          calculation="The design engine's price stack and ledger (wineAlternatives.ts), checked against closed forms in policyDesigns.ts and an independent Python check."
          output={`B ${m(h.bFixed)}; C ${m(h.cFixed)} a year at the fixed share; B ${m(h.b30)} if price-sensitive households stay (30% limit).`}
          period="FY2025 dollars, a year"
          limits="Conditional scenarios, not forecasts. Inputs are software-transcribed and unreviewed. Assessed rows are judgments, labeled as such."
          reproduce="npm run export:grocery-wine in web/; python scripts/policy_designs_check.py"
        />
      </section>

      <section className="panel" aria-labelledby="ds-flow">
        <h2 id="ds-flow">Where does the money go?</h2>
        <Toggle label="Design" value={flowDesign} options={ALT.map((d) => [d, get(d).def.short])} set={setFlowDesign} />
        <ChartFigure
          id="ds-flows"
          title={`Of $100 spent at a state store today, where it goes under ${get(flowDesign).def.short}`}
          subtitle="Dollars per $100 of today's state-store price before sales tax; the grocery price the design implies; FY2025 inputs"
          reading={<>Each bar adds up to what the shopper pays. Blue is what the state keeps: DABS's markup income, a charge, sales tax. A transfer between the state and a seller is not new revenue.</>}
          readingText="Each bar adds up to what the shopper pays. Blue is what the state keeps (DABS markup income, a charge, sales tax). A transfer between the state and a seller is not new revenue."
          limits={<>DABS's markup income is before its operating costs, not profit. Seller margins are gross. Local sales tax is not modeled.</>}
          limitsText="DABS's markup income is before its operating costs, not profit. Seller margins are gross. Local sales tax is not modeled."
          source={SOURCE}
          methods={METHODS}
          filename={`utah_grocery_wine_flows_${flowDesign}`}
          legend={<SplitLegend />}
          csv={csvOf(flowRows)}
          table={tableOf(flowRows)}
        >
          {(width) => <SplitChart cols={flowCols} width={width} label="Split of $100 at a state store, today and under the chosen design" />}
        </ChartFigure>
        <p className="small">
          A year on the wine that moves (fixed share): suppliers{" "}
          {m(get(flowDesign).flows.after.find((f) => f.party === "supplier")!.annual).replace("+", "")}, sellers{" "}
          {m(get(flowDesign).flows.after.filter((f) => f.party === "grocer" || f.party === "distributor").reduce((t, f) => t + f.annual, 0)).replace("+", "")},
          the state {m(get(flowDesign).flows.after.filter((f) => f.state).reduce((t, f) => t + f.annual, 0)).replace("+", "")} against{" "}
          {m(get("A").flows.today.filter((f) => f.state).reduce((t, f) => t + f.annual, 0)).replace("+", "")} today.
        </p>
      </section>

      <section className="panel" aria-labelledby="ds-bottle">
        <h2 id="ds-bottle">What happens to a bottle's price?</h2>
        <Toggle label="Bottle (illustrative price points)" value={bottle} options={B.basket.map((b) => [b.id, b.label])} set={setBottle} />
        <ChartFigure
          id="ds-bottles"
          title={`A ${pick.label.toLowerCase()} bottle if grocers set their own price, by design`}
          subtitle={`Dollars, a bottle landing at $${pick.landed.toFixed(2)}; state store against each design (D's main case equals C's)`}
          reading={<>Gray is the wine's cost; blue the state's take and sales tax; orange the sellers' margins. The total is the shelf price with sales tax.</>}
          readingText="Gray is the wine's cost; blue the state's take and sales tax; orange the sellers' margins. The total is the shelf price with sales tax."
          limits={<>Price points, not products: real prices vary by product and store. Grocers set their own prices.</>}
          limitsText="Price points, not products: real prices vary by product and store. Grocers set their own prices."
          source={SOURCE}
          methods={METHODS}
          filename={`utah_grocery_wine_bottle_${bottle}`}
          legend={<SplitLegend />}
          csv={csvOf(bottleRows)}
          table={tableOf(bottleRows)}
        >
          {(width) => <SplitChart cols={bottleCols} width={width} label="A bottle's price split, state store against each design" />}
        </ChartFigure>
      </section>

      <section className="panel" aria-labelledby="ds-rev">
        <h2 id="ds-rev">Public revenue before and after</h2>
        <Toggle label="Show" value={view} options={[["net", "Net change for the state"], ["gross", "Gross receipts on the moved wine"]]} set={setView} />
        <Toggle label="Store costs saved" value={savings} options={SAVINGS_CASES.map((s) => [s.id, s.id === "none" ? "None (headline)" : s.id === "allocated" ? "Allocated (illustrative)" : "Longer run (illustrative)"])} set={setSavings} />
        <Toggle label="Who switches" value={limitKey} options={[["fixed", "30% fixed"], ...CONVENIENCE_LIMITS.map((l) => [String(l), `limit ${pct(l, 0)}`] as [string, string])]} set={setLimitKey} />
        <ChartFigure
          id="ds-revenue"
          title={view === "net" ? "Net change in state revenue against today, by design" : "Change in the state's gross receipts on the wine that moves"}
          subtitle={`$ millions a year, FY2025; ${LIMIT_LABEL(limit)}; ${SAVINGS_CASES.find((s) => s.id === savings)!.label}`}
          reading={
            view === "net" ? (
              <>Net counts what the state keeps on the moved wine, minus what it no longer collects and the new administration. Losses come from margin given to sellers and from fixed costs when few switch; gains from sales tax on a higher price.</>
            ) : (
              <>Gross is receipts before DABS's costs and the new administration: it is not net revenue.</>
            )
          }
          readingText="Net counts what the state keeps on the moved wine, minus what it no longer collects and the new administration. Gross is receipts before costs."
          limits={<>Each bar is a separate scenario, not a forecast. The administration ($0.50M a year) is a placeholder; savings beyond none are illustrative allocations.</>}
          limitsText="Each bar is a separate scenario, not a forecast. The administration is a placeholder; savings beyond none are illustrative."
          source={SOURCE}
          methods={METHODS}
          filename="utah_grocery_wine_state_revenue_by_design"
          csv={csvOf(revRows)}
          table={tableOf(revRows)}
        >
          {(width) => <BridgeChart steps={revenueSteps} width={width} connect={false} label="State revenue change by design" />}
        </ChartFigure>
      </section>

      <section className="panel" aria-labelledby="ds-front">
        <h2 id="ds-front">The revenue-neutrality frontier</h2>
        <p>
          Each line is the highest grocer margin at which the state still breaks even (no savings) for a given grocery price. Above a line the state
          loses. Collecting the take as a retail charge, with free delivery, would break even at {pct(rep.frontierAtReference.retailChargeNoDistribution)}{" "}
          at a 28% margin, against {pct(rep.frontierAtReference.wholesalePrice)} for B.
        </p>
        <ChartFigure
          id="ds-frontier"
          title="If grocers set their own prices: the highest margin at which the state breaks even, by grocery price"
          subtitle="Highest grocer gross margin (share of its price) at which the state breaks even, by consumer price premium; no savings; fixed share"
          reading={<>Where a line crosses the 28% reference is the lowest break-even premium for that structure. At a 10% premium every line sits far below 28%.</>}
          readingText="Where a line crosses the 28% reference is the lowest break-even premium for that structure. At a 10% premium every line sits far below 28%."
          limits={<>The dashed line assumes delivery to grocers costs nothing, a lower bound nothing measures.</>}
          limitsText="The dashed line assumes delivery to grocers costs nothing, a lower bound nothing measures."
          source={SOURCE}
          methods={METHODS}
          filename="utah_grocery_wine_frontier"
          legend={
            <ul className="chart-legend small">
              <li>Solid blue: take inside DABS's price (B)</li>
              <li>Solid orange: retail charge with a private wholesaler (C)</li>
              <li>Dashed green: retail charge, delivery free</li>
            </ul>
          }
          csv={csvOf(frRows)}
          table={tableOf(frRows)}
        >
          {(width) => <FrontierChart width={width} rows={frontierRows} />}
        </ChartFigure>
      </section>

      <section className="panel" aria-labelledby="ds-wi">
        <h2 id="ds-wi">What if the assumptions are wrong?</h2>
        <div className="controls">
          <label>
            Grocer margin {pct(w.grocerMargin, 0)}
            <input type="range" min={0.1} max={0.35} step={0.01} value={w.grocerMargin} onChange={(e) => setW({ ...w, grocerMargin: Number(e.target.value) })} />
          </label>
          <label>
            Private distribution margin (C) {pct(w.distribution, 0)}
            <input type="range" min={0} max={0.4} step={0.01} value={w.distribution} onChange={(e) => setW({ ...w, distribution: Number(e.target.value) })} />
          </label>
          <label>
            New administration ${(w.admin / 1e6).toFixed(2)}M a year
            <input type="range" min={0} max={1500000} step={50000} value={w.admin} onChange={(e) => setW({ ...w, admin: Number(e.target.value) })} />
          </label>
          <label>
            <input type="checkbox" checked={w.feesCoverAdmin} onChange={(e) => setW({ ...w, feesCoverAdmin: e.target.checked })} /> License fees cover the administration
          </label>
        </div>
        <Toggle label="Who switches" value={w.limit === null ? "fixed" : String(w.limit)} options={[["fixed", "30% fixed"], ...CONVENIENCE_LIMITS.map((l) => [String(l), `limit ${pct(l, 0)}`] as [string, string])]} set={(v) => setW({ ...w, limit: v === "fixed" ? null : Number(v) })} />
        <Toggle label="Store costs saved" value={w.savings} options={SAVINGS_CASES.map((s) => [s.id, s.id === "none" ? "None" : s.id === "allocated" ? "Allocated" : "Longer run"])} set={(v) => setW({ ...w, savings: v })} />
        <ChartFigure
          id="ds-whatif"
          title={`At these settings: B ${m(what.B.net)}, C ${m(what.C.net)} a year`}
          subtitle={`Net change in state revenue, $ a year; B at +${pct(what.B.premium)}, C at +${pct(what.C.premium)} against a state store`}
          reading={<>Lower demand (a tighter limit) shrinks the moved wine; higher distribution costs raise C's price; a lower grocer margin lowers B's price; savings and fees add back.</>}
          readingText="Lower demand shrinks the moved wine; higher distribution costs raise C's price; a lower grocer margin lowers B's price; savings and fees add back."
          limits={<>Closed forms of the same model (tested equal to the engine at the defaults). Not a forecast.</>}
          limitsText="Closed forms of the same model, tested equal to the engine at the defaults. Not a forecast."
          source={SOURCE}
          methods={METHODS}
          filename="utah_grocery_wine_what_if"
          csv={csvOf(wiRows)}
          table={tableOf(wiRows)}
        >
          {(width) => <BridgeChart steps={bars((["B", "C"] as const).map((d) => ({ id: d, label: `${get(d).def.short}: ${pct(what[d].share, 0)} of households move`, value: what[d].net })))} width={width} connect={false} label="What-if state revenue change" />}
        </ChartFigure>
        <p className="small">
          See also <Go to={{ v: "scenario" }}>the scenario calculator</Go> and <Go to={{ v: "initiative" }}>the full analysis</Go>.
        </p>
      </section>
    </>
  );
}
