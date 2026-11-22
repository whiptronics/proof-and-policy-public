// Economics: the same-shelf-price design (lib/samePrice.ts). Grocers sell wine at today's state-store price and DABS
// sells to them below it, so shoppers pay what they pay today; the page shows how much closer Utahns live to a grocery
// store (lib/consumerAccess.generated.ts), who covers the grocer's margin, what closes the rest, and the Utah and
// Pennsylvania precedents. Every figure is the purchase-flow model's or a pinned source's.
import { useId, useMemo, useState, type ReactNode } from "react";
import { ChartFigure, type Row } from "../components/ChartFigure";
import { Go } from "../components/common";
import { HowWeKnow } from "../components/HowWeKnow";
import { CONSUMER_ACCESS as A } from "../lib/consumerAccess.generated";
import { DABS_WINE_BOTTLES } from "../lib/dabsWineBottles.generated";
import { STATE_CASES } from "../lib/framework";
import { agencyRates, typicalGrocer } from "../lib/packageAgency";
import { PACKAGE_AGENCY_GRID } from "../lib/packageAgencyGrid.generated";
import { SAVINGS_CASES, type SavingsCase } from "../lib/policyDesigns";
import { PA_LICENSEE_MARGIN, SAME_PRICE_METHOD, coverAt, defaultSamePriceReport, samePriceCase } from "../lib/samePrice";
import { RETAILER_TARGET } from "../lib/wineAlternatives";
import { DEFAULT_FLOWS } from "../lib/wineFlows";

const pct = (v: number, d = 0) => `${(v * 100).toFixed(d)}%`;
const m = (v: number, d = 2) => `${v < -5e3 ? "−" : v > 5e3 ? "+" : ""}$${(Math.abs(v) / 1e6).toFixed(d)}M`;
const usd0 = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;
const n0 = (v: number) => Math.round(v).toLocaleString("en-US");
const mi = (v: number) => `${v.toFixed(2)} mi`;

const SOURCE_MONEY =
  "DABS FY2025 annual report and FY2026 monthly sales reports; Utah Code § 32B-2-304; Pennsylvania Liquor Code § 305(b); Census County Business Patterns 2023 (grocery establishments)";
const SOURCE_ACCESS =
  "DABS store locator (state liquor stores and package agencies, read 2026-11-20); USDA FNS SNAP retailer locations (Utah supermarkets, super stores and grocery stores, read 2026-11-20); 2020 Census centers of population by block group";
const SOURCE_AGENCY = "DABS, Type 2 / Type 3 Package Agency Compensation Grid (FY27, rev. 07-2026); DABS FY2026 monthly sales reports (wine bottles and sales)";
const SAVINGS_SHORT: Record<SavingsCase, string> = { none: "DABS saves nothing", allocated: "Card fees and agency contracts fall", longer_run: "Wages fall too" };
const CASES = SAVINGS_CASES.map((s) => s.id);
const KINDS = [
  { id: "stateStore", label: "State liquor store", color: "var(--series-2)" },
  { id: "dabsOutlet", label: "Any DABS outlet (store or package agency)", color: "var(--series-6)" },
  { id: "grocery", label: "Grocery store", color: "var(--series-1)" },
] as const;

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

function tableOf(rows: Row[]): ReactNode {
  return (
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
}
const csvOf = (rows: Row[]) => ({ columns: Object.keys(rows[0] ?? {}).map((k) => ({ key: k, kind: (typeof rows[0][k] === "number" ? "number" : "text") as "number" | "text", get: (r: Row) => r[k] })), rows });

/** Share of Utahns within each distance of each kind of store: one group of bars per distance. */
function AccessChart({ width }: { width: number }) {
  const shown = A.thresholds.slice(0, 4).map((t, i) => ({ t, v: KINDS.map((k) => A.distance[k.id].within[i]) }));
  const padL = 64;
  const padR = 46;
  const barH = 14;
  const groupH = KINDS.length * (barH + 3) + 14;
  const top = 6;
  const H = top + shown.length * groupH + 24;
  const x = (v: number) => padL + v * (width - padL - padR);
  return (
    <svg className="chart" width={width} height={H} viewBox={`0 0 ${width} ${H}`} role="img" aria-label="Share of Utahns living within 1, 3, 5 and 10 miles of a state liquor store, any DABS outlet and a grocery store">
      {[0, 0.25, 0.5, 0.75, 1].map((g) => (
        <g key={g}>
          <line x1={x(g)} x2={x(g)} y1={top} y2={H - 22} className={g === 0 ? "axis-zero" : "grid"} />
          <text x={x(g)} y={H - 6} textAnchor={g === 0 ? "start" : g === 1 ? "end" : "middle"} className="tick">
            {pct(g)}
          </text>
        </g>
      ))}
      {shown.map((s, gi) => {
        const y0 = top + gi * groupH;
        return (
          <g key={s.t}>
            <text x={padL - 8} y={y0 + (KINDS.length * (barH + 3)) / 2 + 4} textAnchor="end" className="row-label strong">
              {s.t === 1 ? "1 mile" : `${s.t} miles`}
            </text>
            {s.v.map((v, k) => (
              <g key={k}>
                <rect x={x(0)} y={y0 + k * (barH + 3)} width={x(v) - x(0)} height={barH} fill={KINDS[k].color}>
                  <title>{`${KINDS[k].label}: ${pct(v, 1)} of Utahns within ${s.t} mi`}</title>
                </rect>
                <text x={x(v) + 4} y={y0 + k * (barH + 3) + barH - 3} className="bar-value">
                  {pct(v)}
                </text>
              </g>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

/** Where the grocer's margin comes from, one bar per savings case: DABS costs that fall, and the state's share. */
function CoverChart({ width, rows }: { width: number; rows: { label: string; avoided: number; state: number }[] }) {
  const wide = width >= 560;
  const labelW = wide ? 200 : 0;
  const padL = wide ? labelW + 10 : 6;
  const padR = 64;
  const rowH = wide ? 34 : 50;
  const top = 6;
  const H = top + rows.length * rowH + 6;
  const max = Math.max(...rows.map((r) => r.avoided + Math.max(0, r.state))) || 1;
  const x = (v: number) => padL + (v / max) * (width - padL - padR);
  return (
    <svg className="chart" width={width} height={H} viewBox={`0 0 ${width} ${H}`} role="img" aria-label="Who covers the grocer's margin, by savings case">
      {rows.map((r, i) => {
        const y = top + i * rowH + (wide ? 4 : 20);
        const state = Math.max(0, r.state);
        return (
          <g key={r.label}>
            <text x={wide ? padL - 8 : padL} y={wide ? y + 14 : y - 6} textAnchor={wide ? "end" : "start"} className="row-label">
              {r.label}
            </text>
            <rect x={x(0)} y={y} width={x(r.avoided) - x(0)} height={20} fill="var(--series-3)">
              <title>{`DABS costs that fall: ${m(r.avoided)}`}</title>
            </rect>
            <rect x={x(r.avoided)} y={y} width={x(r.avoided + state) - x(r.avoided)} height={20} fill="var(--series-2)">
              <title>{`The state's share: ${m(state)}`}</title>
            </rect>
            <text x={x(r.avoided + state) + 4} y={y + 15} className="bar-value">
              {r.state < 0 ? `state +${m(-r.state).slice(1)}` : m(-r.state)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Net change for the state at today's shelf price, by grocer margin, one line per savings case. */
function MarginChart({ width, rows }: { width: number; rows: { margin: number; nets: number[] }[] }) {
  const padL = 50;
  const padR = 12;
  const top = 10;
  const H = 280;
  const bottom = H - 34;
  const ys = rows.flatMap((r) => r.nets);
  const lo = Math.floor(Math.min(0, ...ys) / 2e6) * 2e6;
  const hi = Math.ceil(Math.max(0, ...ys) / 2e6) * 2e6 || 2e6;
  const x = (g: number) => padL + (g / RETAILER_TARGET) * (width - padL - padR);
  const y = (v: number) => top + ((hi - v) / (hi - lo)) * (bottom - top);
  const ticks: number[] = [];
  for (let v = lo; v <= hi; v += 2e6) ticks.push(v);
  const colors = ["var(--series-2)", "var(--series-3)", "var(--series-1)"];
  return (
    <svg className="chart" width={width} height={H} viewBox={`0 0 ${width} ${H}`} role="img" aria-label="Net change in state revenue at today's shelf price, by grocer margin">
      {ticks.map((v) => (
        <g key={v}>
          <line x1={padL} x2={width - padR} y1={y(v)} y2={y(v)} className={v === 0 ? "axis-zero" : "grid"} />
          <text x={padL - 6} y={y(v) + 4} textAnchor="end" className="tick">
            {v === 0 ? "$0" : `${v < 0 ? "−" : "+"}$${Math.abs(v / 1e6)}M`}
          </text>
        </g>
      ))}
      {[0, 0.05, 0.1, 0.15, 0.2, 0.25].map((g) => (
        <text key={g} x={x(g)} y={H - 16} textAnchor={g === 0 ? "start" : "middle"} className="tick">
          {pct(g)}
        </text>
      ))}
      <line x1={x(PA_LICENSEE_MARGIN.value)} x2={x(PA_LICENSEE_MARGIN.value)} y1={top} y2={bottom} className="ref-line" />
      <text x={x(PA_LICENSEE_MARGIN.value) + 4} y={top + 10} className="ref-label">
        Pennsylvania 10%
      </text>
      {SAVINGS_CASES.map((s, k) => (
        <polyline key={s.id} fill="none" stroke={colors[k]} strokeWidth={2.5} strokeDasharray={k === 0 ? undefined : k === 1 ? "6 4" : "2 3"} points={rows.map((r) => `${x(r.margin)},${y(r.nets[k])}`).join(" ")}>
          <title>{SAVINGS_SHORT[s.id]}</title>
        </polyline>
      ))}
      <text x={padL} y={H - 2} className="tick">
        Grocer&rsquo;s margin (share of today&rsquo;s shelf price)
      </text>
    </svg>
  );
}

export function SamePriceView() {
  const rep = useMemo(() => defaultSamePriceReport(), []);
  const [margin, setMargin] = useState<number>(PA_LICENSEE_MARGIN.value);
  const [fees, setFees] = useState<"fees" | "none">("fees");
  const cases = CASES;
  const pa = STATE_CASES.find((c) => c.id === "pa")!;
  const householdWine = rep.moved / DEFAULT_FLOWS.migration;
  const at10 = Object.fromEntries(cases.map((s) => [s, samePriceCase(PA_LICENSEE_MARGIN.value, s, true).net])) as Record<SavingsCase, number>;
  const typical = typicalGrocer(rep.moved);
  const rates = agencyRates();

  const cover = useMemo(() => CASES.map((s) => ({ s, c: coverAt(margin, s) })), [margin]);
  const curve = useMemo(
    () =>
      Array.from({ length: 29 }, (_, i) => i / 100).map((g) => ({
        margin: g,
        nets: CASES.map((s) => samePriceCase(g, s, fees === "fees").net),
      })),
    [fees],
  );

  const accessRows: Row[] = A.thresholds.map((t, i) => ({
    within_miles: t,
    state_liquor_store_pct: Number((A.distance.stateStore.within[i] * 100).toFixed(1)),
    any_dabs_outlet_pct: Number((A.distance.dabsOutlet.within[i] * 100).toFixed(1)),
    grocery_store_pct: Number((A.distance.grocery.within[i] * 100).toFixed(1)),
    supermarket_or_super_store_pct: Number((A.distance.supermarket.within[i] * 100).toFixed(1)),
  }));
  const coverRows: Row[] = cover.map(({ s, c }) => ({
    savings_case: SAVINGS_SHORT[s],
    grocer_margin_pct: Number((margin * 100).toFixed(0)),
    grocer_income_usd: Math.round(c.grocerIncome),
    dabs_costs_that_fall_usd: Math.round(c.dabsCostsAvoided),
    state_share_usd: Math.round(c.stateShare),
  }));
  const curveRows: Row[] = curve
    .filter((_, i) => i % 2 === 0)
    .map((r) => ({ grocer_margin_pct: Math.round(r.margin * 100), ...Object.fromEntries(cases.map((s, k) => [`net_usd_${s}`, Math.round(r.nets[k])])) }));

  return (
    <>
      <section className="panel" aria-labelledby="sp-h">
        <p className="finding-tag">The design</p>
        <h2 id="sp-h">Wine at the grocery store, at today&rsquo;s state-store price</h2>
        <p className="lede">
          A bottle would cost the same at a grocery store as it does at a state liquor store today. DABS stays the only wholesaler and sells to
          licensed grocers below its shelf price; the difference is the grocer&rsquo;s margin. Shoppers pay nothing more. Pennsylvania&rsquo;s state
          stores sell to licensees at {pct(PA_LICENSEE_MARGIN.value)} below retail, and Utah already pays its package agencies, private businesses
          that include stores run alongside a convenience store, to sell at the state&rsquo;s price.
        </p>
        <ul className="finding-cards">
          <li>
            <h3>The same price</h3>
            <p>
              State stores and package agencies may sell only at the price the commission fixes (Utah Code §§ 32B-2-503(2), 32B-2-605(7)). The bill
              would hold grocers to the same price.
            </p>
          </li>
          <li>
            <h3>Closer to home</h3>
            <p>
              Half of Utahns live within {mi(A.distance.grocery.median)} of a grocery store, against {mi(A.distance.stateStore.median)} of a state store.{" "}
              {pct(A.distance.grocery.within[0])} live within a mile of one, against {pct(A.distance.stateStore.within[0])}.
            </p>
          </li>
          <li>
            <h3>Closed on Sundays</h3>
            <p>
              By law a state store may not sell on a Sunday or a state or federal holiday, nor may most package agencies (§§ 32B-2-503(5),
              32B-2-605(13)). None of the {A.outlets.stateStores} state stores or {A.outlets.packageAgencies} listed agencies opens on Sunday; the median
              state store is open {A.hours.stateStoreWeeklyHoursMedian} hours a week.
            </p>
          </li>
          <li>
            <h3>The state&rsquo;s side</h3>
            <p>
              At a {pct(PA_LICENSEE_MARGIN.value)} margin, with license fees covering the new administration, the state gives up {m(-at10.none).slice(1)} a
              year if DABS saves nothing and {m(-at10.longer_run).slice(1)} if its wages fall with sales. Household wine purchases{" "}
              {pct(rep.needed.none.additional.value ?? 0, 1)} higher would cover the first.
            </p>
          </li>
        </ul>
        <HowWeKnow
          claim="the same-price design"
          inputs={`DABS FY2025 wine sales and margin; ${pct(DEFAULT_FLOWS.migration)} of household DABS wine (${m(rep.moved).slice(1)} a year) moving to grocers at today's price; Pennsylvania's licensee price (${pct(PA_LICENSEE_MARGIN.value)} below retail); ${A.outlets.stateStores + A.outlets.packageAgencies} DABS outlets, ${A.outlets.grocery} SNAP grocery stores and ${n0(A.population)} Utahns in ${n0(A.blockGroups)} Census block groups.`}
          assumptions={`License fees equal to the new administration ($${(rep.admin / 1e6).toFixed(2)}M a year, a placeholder; ${usd0(rep.feePerStore)} a store across ${n0(rep.admin / rep.feePerStore)} grocery establishments). Savings beyond none are illustrative allocations, not measured.`}
          calculation="The purchase-flow model (wineFlows.ts) with DABS selling to grocers below its shelf price and grocers charging today's price; checked equal to the alternatives engine at every margin (samePrice.test.ts). Distances are straight-line miles from each block group's center of population, weighted by population."
          output={`${m(at10.none)} a year at 10% with nothing saved; ${m(at10.longer_run)} with wages falling. A typical Utahn is ${mi(A.distance.grocery.median)} from a grocery store and ${mi(A.distance.stateStore.median)} from a state store.`}
          period="FY2025 dollars, a year; locations read 2026-11-20"
          limits="Conditional scenarios, not forecasts. Inputs are software-transcribed and unreviewed. Travel distance, travel time and grocery store hours are not measured."
          reproduce="python scripts/consumer_access.py --check; npm test in web/ (samePrice.test.ts, packageAgency.test.ts)"
        />
      </section>

      <section className="panel" aria-labelledby="sp-access">
        <h2 id="sp-access">Closer to home</h2>
        <p>
          {pct(A.groceryCloserThanDabs)} of Utahns live closer to a grocery store than to any DABS outlet, package agencies included. Of the{" "}
          {n0(A.over10FromStateStore.people)} who live more than 10 miles from a state store, {n0(A.over10FromStateStore.groceryWithin10)} (
          {pct(A.over10FromStateStore.groceryWithin10 / A.over10FromStateStore.people)}) live within 10 miles of a grocery store.
        </p>
        <ChartFigure
          id="sp-access-chart"
          title={`${pct(A.distance.grocery.within[0])} of Utahns live within a mile of a grocery store; ${pct(A.distance.stateStore.within[0])} live within a mile of a state store`}
          subtitle={`Share of Utah's ${n0(A.population)} residents (2020 Census) within each straight-line distance of the nearest store of each kind`}
          reading={<>Each group is a distance; each bar is the share of Utahns who live that close to the nearest store of that kind. Teal is grocery stores, red state liquor stores, purple any DABS outlet including package agencies.</>}
          readingText="Each group is a distance; each bar is the share of Utahns who live that close to the nearest store of that kind. Teal is grocery stores, red state liquor stores, purple any DABS outlet including package agencies."
          limits={<>Straight-line distance from each block group&rsquo;s center of population, not travel distance or time. Grocery stores are USDA&rsquo;s SNAP-authorized supermarkets, super stores and grocery stores ({A.outlets.grocery}); a store that does not accept SNAP is missing. DABS outlets are those its store locator lists.</>}
          limitsText="Straight-line distance from each block group's center of population, not travel distance or time. Grocery stores are USDA's SNAP-authorized supermarkets, super stores and grocery stores; a store that does not accept SNAP is missing. DABS outlets are those its store locator lists."
          source={SOURCE_ACCESS}
          methods="consumer-access@1.0 (scripts/consumer_access.py)"
          filename="utah_wine_access_distance"
          legend={
            <ul className="chart-legend small">
              {KINDS.map((k) => (
                <li key={k.id}>
                  <span aria-hidden="true" style={{ color: k.color }}>
                    ■
                  </span>{" "}
                  {k.label}
                </li>
              ))}
            </ul>
          }
          csv={csvOf(accessRows)}
          table={tableOf(accessRows)}
        >
          {(width) => <AccessChart width={width} />}
        </ChartFigure>
        <div className="table-wrap">
          <table className="data">
            <caption>Stores and hours</caption>
            <thead>
              <tr>
                <th scope="col">Kind</th>
                <th scope="col">Stores in Utah</th>
                <th scope="col">Open on Sunday</th>
                <th scope="col">Median distance</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">State liquor stores</th>
                <td>{A.outlets.stateStores}</td>
                <td>{A.hours.stateStoresOpenSunday}</td>
                <td>{mi(A.distance.stateStore.median)}</td>
              </tr>
              <tr>
                <th scope="row">Package agencies (listed)</th>
                <td>{A.outlets.packageAgencies}</td>
                <td>{A.hours.agenciesOpenSunday}</td>
                <td>{mi(A.distance.dabsOutlet.median)} (any DABS outlet)</td>
              </tr>
              <tr>
                <th scope="row">Grocery stores (SNAP)</th>
                <td>{A.outlets.grocery}</td>
                <td>not measured</td>
                <td>{mi(A.distance.grocery.median)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel" aria-labelledby="sp-cover">
        <h2 id="sp-cover">Who covers the grocer&rsquo;s margin?</h2>
        <p>
          At today&rsquo;s price the shopper pays the same, so the grocer&rsquo;s margin comes from DABS&rsquo;s side of the bottle: partly from costs
          DABS no longer has when it sells less at its own stores, and the rest from the state&rsquo;s share. License fees are set to cover the new
          administration.
        </p>
        <div className="controls">
          <label>
            Grocer&rsquo;s margin {pct(margin)}
            <input type="range" min={0} max={RETAILER_TARGET} step={0.01} value={margin} onChange={(e) => setMargin(Number(e.target.value))} />
          </label>
        </div>
        <ChartFigure
          id="sp-cover-chart"
          title={`At a ${pct(margin)} margin grocers keep ${m(cover[0].c.grocerIncome).slice(1)} a year`}
          subtitle={`$ millions a year on the ${m(rep.moved).slice(1)} of wine that moves, at today's shelf price; license fees cover the administration`}
          reading={<>Each bar is the grocers&rsquo; income at this margin. Blue is what DABS stops spending; red is the state&rsquo;s share. The number is the change for the state.</>}
          readingText="Each bar is the grocers' income at this margin. Blue is what DABS stops spending; red is the state's share. The number is the change for the state."
          limits={<>DABS&rsquo;s costs that fall are illustrative allocations of its FY2025 expenses by sales, not measured savings. The wine that moves is a fixed {pct(DEFAULT_FLOWS.migration)} of household purchases.</>}
          limitsText="DABS's costs that fall are illustrative allocations of its FY2025 expenses by sales, not measured savings. The wine that moves is a fixed share of household purchases."
          source={SOURCE_MONEY}
          methods={SAME_PRICE_METHOD}
          filename="utah_same_price_margin_cover"
          legend={
            <ul className="chart-legend small">
              <li>Blue: DABS costs that fall</li>
              <li>Red: the state&rsquo;s share</li>
            </ul>
          }
          csv={csvOf(coverRows)}
          table={tableOf(coverRows)}
        >
          {(width) => <CoverChart width={width} rows={cover.map(({ s, c }) => ({ label: SAVINGS_SHORT[s], avoided: c.dabsCostsAvoided, state: c.stateShare }))} />}
        </ChartFigure>
        <p className="small">
          The state breaks even at a grocer margin of {pct(Math.max(0, rep.breakEvenMargin.allocated.fees), 1)} if card fees and agency contracts fall
          with sales, and {pct(rep.breakEvenMargin.longer_run.fees, 1)} if wages fall too. With nothing saved, any margin costs the state its full amount.
        </p>
      </section>

      <section className="panel" aria-labelledby="sp-margin">
        <h2 id="sp-margin">The smaller the margin, the closer the state is to even</h2>
        <Toggle
          label="License fees"
          value={fees}
          options={[
            ["fees", "Cover the new administration"],
            ["none", "None"],
          ]}
          set={setFees}
        />
        <ChartFigure
          id="sp-margin-chart"
          title="At today's shelf price, the state's change depends on the grocer's margin and on DABS's savings"
          subtitle={`Net change in state revenue against today, $ a year, by grocer margin; ${fees === "fees" ? "license fees cover the administration" : "no license fees"}; shoppers pay today's price throughout`}
          reading={<>Each line is a savings case. Where a line crosses $0 the state breaks even. The grocer&rsquo;s margin is the design&rsquo;s main setting: it is the bill&rsquo;s choice, not the shopper&rsquo;s price.</>}
          readingText="Each line is a savings case. Where a line crosses $0 the state breaks even. The grocer's margin is the bill's choice, not the shopper's price."
          limits={<>No extra purchases are counted. Savings beyond none are illustrative. Not a forecast.</>}
          limitsText="No extra purchases are counted. Savings beyond none are illustrative. Not a forecast."
          source={SOURCE_MONEY}
          methods={SAME_PRICE_METHOD}
          filename="utah_same_price_by_margin"
          legend={
            <ul className="chart-legend small">
              <li>Solid red: DABS saves nothing</li>
              <li>Dashed blue: card fees and agency contracts fall</li>
              <li>Dotted teal: wages fall too</li>
            </ul>
          }
          csv={csvOf(curveRows)}
          table={tableOf(curveRows)}
        >
          {(width) => <MarginChart width={width} rows={curve} />}
        </ChartFigure>
      </section>

      <section className="panel" aria-labelledby="sp-close">
        <h2 id="sp-close">What closes the rest</h2>
        <p>
          The model above counts no new purchases. If wine where people shop is bought by some who do not buy it now, or replaces wine Utahns buy in
          other states, the state collects DABS&rsquo;s margin on it. These are the amounts that would make the state whole at a{" "}
          {pct(PA_LICENSEE_MARGIN.value)} margin with license fees, whether new purchases or wine now bought out of state (the model counts the
          two the same); none is measured.
        </p>
        <div className="table-wrap">
          <table className="data">
            <caption>Wine bought in Utah that would cover the state&rsquo;s share (share of household DABS wine, {m(householdWine).slice(1)} a year)</caption>
            <thead>
              <tr>
                <th scope="col">Savings case</th>
                <th scope="col">State change at {pct(PA_LICENSEE_MARGIN.value)}</th>
                <th scope="col">Extra wine bought in Utah needed</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((s) => {
                const n = rep.needed[s];
                const cell = (b: typeof n.additional) =>
                  b.status === "already_above" ? "none needed" : b.value === null ? "not reached in range" : `${pct(b.value, 1)} (${m(b.value * householdWine).slice(1)})`;
                return (
                  <tr key={s}>
                    <th scope="row">{SAVINGS_SHORT[s]}</th>
                    <td>{m(at10[s])}</td>
                    <td>{cell(n.additional)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel" aria-labelledby="sp-prec">
        <h2 id="sp-prec">Utah and Pennsylvania already have private stores sell the state&rsquo;s wine</h2>
        <p>
          <b>Utah.</b> DABS pays each package agency a fixed amount a year, by bottles sold and average bottle price, to sell at the state&rsquo;s prices
          (grid revision {PACKAGE_AGENCY_GRID.revision}). If the wine that moves were shared evenly by Utah&rsquo;s grocery stores, a typical store would
          sell about {n0(typical.bottles)} bottles a year ({usd0(typical.sales)} at DABS&rsquo;s average of ${DABS_WINE_BOTTLES.all.averagePrice.toFixed(2)}),
          and the grid would pay it {usd0(typical.pay)}, {pct(typical.rate)} of its sales. Large stores cost less: at {n0(rates[rates.length - 1].bottles)}{" "}
          bottles the grid pays {pct(rates[rates.length - 1].rate, 1)}.
        </p>
        <div className="table-wrap">
          <table className="data">
            <caption>What DABS&rsquo;s package agency grid would pay for wine alone, at DABS&rsquo;s FY2026 average wine bottle price</caption>
            <thead>
              <tr>
                <th scope="col">Wine bottles a year</th>
                <th scope="col">Sales</th>
                <th scope="col">Grid cell</th>
                <th scope="col">DABS pays</th>
                <th scope="col">Share of sales</th>
              </tr>
            </thead>
            <tbody>
              {rates.map((r) => (
                <tr key={r.bottles}>
                  <th scope="row">{n0(r.bottles)}</th>
                  <td>{usd0(r.sales)}</td>
                  <td>
                    step {r.step}, class {r.priceClass}
                  </td>
                  <td>{usd0(r.pay)}</td>
                  <td>{pct(r.rate, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small">
          Package agencies sell every product DABS stocks, and the grid pays on all of it; applying it to wine alone is this page&rsquo;s assumption.
          A package agency sells DABS&rsquo;s inventory; under this design grocers would buy theirs. Source: {SOURCE_AGENCY}.
        </p>
        <p>
          <b>Pennsylvania.</b> State stores sell to licensees at {pct(PA_LICENSEE_MARGIN.value)} below retail, and{" "}
          {pa.evidence[0].text.match(/(\d+) grocery stores/)![1]} grocery stores held wine permits on June 30, 2025. Pennsylvania lets grocers set
          their own prices, and the one report found says they charge a little more than state stores. Utah&rsquo;s design would set the price instead.{" "}
          <Go to={{ v: "states" }}>What happened elsewhere</Go>
        </p>
      </section>

      <section className="panel" aria-labelledby="sp-law">
        <h2 id="sp-law">What the law would need</h2>
        <ul>
          <li>
            A wholesale price for grocers. DABS must mark wine up at least 88.5% over landed cost (Utah Code § 32B-2-304(2)(b)); at its current margin that
            lets DABS sell to grocers at no less than {pct(1 - rep.lawfulDiscount, 2)} of its shelf price. A price of{" "}
            {pct(1 - PA_LICENSEE_MARGIN.value)} needs the bill to set a separate price for licensed grocers.
          </li>
          <li>A rule that grocers sell at the price the commission fixes, as state stores and package agencies must (§§ 32B-2-503(2), 32B-2-605(7)).</li>
          <li>A grocery wine license, with the fees, training, ID checks and local consent the framework sets out.</li>
        </ul>
        <p className="small">
          Price rises are one option, not part of this design: if grocers set their own prices, as in Pennsylvania, prices could rise. The{" "}
          <Go to={{ v: "designs" }}>five designs</Go> page models those cases.
        </p>
      </section>
    </>
  );
}
