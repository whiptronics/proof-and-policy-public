// The arrangement comparison in the Utah scenario tool (lib/arrangements.ts, ARRANGEMENTS_METHOD): the same baseline
// and purchase assumptions, three ways for the state to collect on grocery wine, with the baseline's sources and
// standing, the break-even values and a one-assumption chart. Proposed arrangements, not current law; not a forecast.
import type { ReactNode } from "react";
import { CartesianGrid, Legend, Line, LineChart, ReferenceArea, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ARRANGEMENTS_METHOD, ARRANGEMENT_LABELS, SWEEPS, compare, jointScenarios, priceBuildUp, settingsFromFields, sweep, zerosOf, type ArrangementResult, type Bounds, type BreakEven, type Comparison, type EarmarkCase, type EarmarkResult, type EarmarkRule, type JointRow, type Keep, type SweepKey, type ViabilityCase } from "../lib/arrangements";
import { movedShare, type DepositRates, type ScenarioInputs } from "../lib/scenario";
import type { RangeFormat, Sensitivity } from "../lib/scenarioRanges";
import { navigate } from "../lib/url";

export interface BaselineRow {
  input: string;
  value: string;
  units: string;
  source: ReactNode;
  coverage: string;
  status: string;
}

const money = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : `${v < 0 ? "−" : ""}$${Math.round(Math.abs(v)).toLocaleString("en-US")}`);
const millions = (v: number) => `${v < 0 ? "−" : ""}$${(Math.abs(v) / 1e6).toFixed(1)} million`;
const pct = (v: number, digits = 1) => `${(v * 100).toFixed(digits)}%`;
const fmt = (v: number, f: RangeFormat | "percent" | "plain" | "money2") =>
  f === "percent" ? pct(v) : f === "money" ? money(v) : f === "money2" ? `$${v.toFixed(2)}` : f === "gallons" ? `${Math.round(v).toLocaleString("en-US")} gal` : v.toFixed(2);

const cents = (v: number) => `${v < 0 ? "−" : ""}${Math.abs(v * 100).toFixed(1)}¢`;
const spct = (v: number) => `${v < 0 ? "−" : ""}${pct(Math.abs(v))}`;

function ruleWords(rule: EarmarkRule): string {
  return rule === "fixed"
    ? "a fixed guarantee, set once from this scenario"
    : rule === "proportional"
      ? "a guarantee proportional to the state-store sales actually lost"
      : rule === "amount"
        ? "a fixed amount"
        : "a share of the proceeds";
}

/** What sellers keep per $1 of state-store price, with their gross margin; arrangement 1 adds the grocer's part when a
 * private wholesaler's margin is entered. */
function keepText(k: Keep | null, privateArr: boolean): ReactNode {
  if (!k) return "—";
  const main = (
    <>
      {cents(k.perDollar)} ({spct(k.margin)})
    </>
  );
  const grocer =
    privateArr && k.grocer ? (
      <div className="muted small">
        of which the grocer, after paying a private wholesaler: {cents(k.grocer.perDollar)} ({spct(k.grocer.margin)})
      </div>
    ) : null;
  return k.perDollar < 0 ? (
    <span className="warn-inline">
      {main}: sellers would sell below the cost of the wine{grocer}
    </span>
  ) : (
    <>
      {main}
      {grocer}
    </>
  );
}

function leverValue(be: BreakEven, x: ScenarioInputs, v: number): string {
  if (be.lever === "discount") return `${pct(v)} off the state-store price`;
  return x.revenueMode === "excise" ? `$${v.toFixed(2)} a gallon` : `${pct(v)} of the grocery price before tax`;
}

function breakEvenText(a: ArrangementResult, shiftOnly: ArrangementResult | null): ReactNode {
  const be = a.breakEven;
  const what = be.basis === "all" ? "with the purchase changes entered (including any price response)" : "with the channel shift only";
  if (be.status === "unavailable") return be.note;
  if (be.status === "not_needed") return be.note;
  if (be.status === "none_in_range")
    return (
      <>
        <strong>No break-even in the supported range</strong> ({leverValue(be, a.x, be.range[0])} to {leverValue(be, a.x, be.range[1])}), {what}. {be.note}
        {be.best ? ` The best it reaches is ${money(be.best.value)} a year, at ${leverValue(be, a.x, be.best.at)}.` : ""}
      </>
    );
  const other = shiftOnly && be.basis === "all" && shiftOnly.breakEven.value !== null && shiftOnly.breakEven.status === "found" ? ` (channel shift only: ${leverValue(be, a.x, shiftOnly.breakEven.value)})` : "";
  const lin = a.breakEvenLinear;
  const linText =
    lin && be.lever === "taxRate"
      ? lin.status === "found" && lin.value !== null
        ? ` With a straight-line demand curve of the same slope at today's price instead of constant elasticity: ${leverValue(lin, a.x, lin.value)}.`
        : ` With a straight-line demand curve: ${lin.note}`
      : "";
  const rise = be.lever === "taxRate" && a.x.revenueMode === "percent" && be.value !== null ? be.value * (a.x.taxToPrice ?? 1) : null;
  const caution =
    lin && rise !== null && rise > 0.25
      ? ` That tax raises the grocery price by about ${pct(rise, 0)}, far beyond the ordinary price changes behind the elasticity (Nelson 2013: market data from many countries, 1954-2004), so both curves extrapolate.`
      : "";
  return (
    <>
      {be.lever === "discount" ? "At most " : ""}
      <strong>{leverValue(be, a.x, be.value!)}</strong>, {what}
      {other}. {be.note}
      {linText}
      {caution}
    </>
  );
}

function reversalText(rs: Sensitivity[]): ReactNode {
  const lc = (t: string) => (/^[A-Z][a-z]/.test(t) ? t[0].toLowerCase() + t.slice(1) : t);
  const inside = rs.filter((z) => z.zero!.inRange);
  const outside = rs.filter((z) => !z.zero!.inRange);
  return (
    <>
      {inside.length ? (
        <>
          <strong>Within its documented range:</strong> {inside.map((z) => `${lc(z.label)} at ${fmt(z.zero!.value, z.format)}`).join("; ")}.{" "}
        </>
      ) : (
        "No single assumption reverses it within its documented range. "
      )}
      {outside.length ? `Beyond those ranges: ${outside.map((z) => `${lc(z.label)} at ${fmt(z.zero!.value, z.format)}`).join("; ")}.` : ""}
    </>
  );
}

export function ArrangementComparison({
  x,
  get,
  fy,
  rates,
  rateStatus,
  baseline,
  baselineNote,
  opexShare,
  sweepKey,
  bounds,
}: {
  x: ScenarioInputs;
  get: (k: string) => string;
  fy: number;
  rates: DepositRates | null;
  rateStatus: string;
  baseline: BaselineRow[];
  baselineNote: ReactNode;
  opexShare: number | null;
  sweepKey: SweepKey;
  bounds: Bounds | null;
}) {
  const set = settingsFromFields(get);
  const c: Comparison = compare(x, set, rates, opexShare);
  const shiftOnly = c.headline === "all" ? compare({ ...x, extra: false }, set, rates, opexShare) : null;
  const base3 = set.earmarkBase === "wholesale" ? c.wholesale : c.private;
  return (
    <section className="panel report" aria-labelledby="cmp-h">
      <h3 id="cmp-h">
        Three arrangements compared, FY{fy} ({ARRANGEMENTS_METHOD})
      </h3>
      <p className="small">
        <strong>The question:</strong> which ways of letting grocery stores sell wine could keep Utah's state revenue at today's level, and which assumptions decide it? Each column uses the same
        baseline and the same purchase assumptions (sections 1 to 5) and a different way for the state to collect on the wine that moves. These are proposed arrangements, not a description of what
        current law allows. State government only, per year, FY{fy} dollars. Not a forecast.
      </p>
      <BaselineTable rows={baseline} fy={fy} note={baselineNote} />
      {c.missing.length || c.invalid.length ? (
        <div className="note small" role="note">
          {c.invalid.length > 0 && (
            <ul className="warn small">
              {c.invalid.map((p) => (
                <li key={p}>{p}.</li>
              ))}
            </ul>
          )}
          {c.missing.length > 0 && (
            <>
              <p style={{ marginTop: 0 }}>The comparison needs these, which the dataset cannot supply (section 6 above, or the section named):</p>
              <ul className="source-list">
                {c.missing.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : (
        <>
          <Headline c={c} />
          <FinanceTable c={c} base3={base3} shiftOnly={shiftOnly} rateStatus={rateStatus} />
          <SellersTable c={c} />
          <EarmarkTable c={c} rateStatus={rateStatus} />
          <PriceTable c={c} />
          <VolumeTable c={c} />
          <JointTable x={x} get={get} rates={rates} bounds={bounds} />
          <SweepChart x={x} c={c} sweepKey={sweepKey} get={get} opexShare={opexShare} bounds={bounds} />
          <MechanismTable x={x} c={c} />
          <ul className="small source-list">
            <li>
              <strong>Same scope on both sides.</strong> Today and every arrangement count state government revenue only: the state stores' gross margin, the state's share of sales tax, and any
              replacement tax or wholesale margin. Local sales tax is not modelled (the dataset holds the state rate only, and whether state-store sales carry local tax is unresolved), so local
              and combined government revenue are not shown.
            </li>
            <li>
              <strong>Measured and modelled.</strong> The baseline figures above are observations (transcribed, not yet reviewed by a person) or derived from them; every other number in this section is
              arithmetic on stated assumptions.
            </li>
            <li>
              <strong>Purchases.</strong> The first block moves existing purchases between channels; total wine bought does not change. Each purchase change entered in section 5 is then added on
              its own: the price response changes how much of the moved wine is bought at its new shelf price; recapture is wine Utahns now buy in other states, new to Utah's tax base but not new
              drinking (its size is an assumption); easier access is extra wine bought because it is easier to buy. No purchase is counted in two of them, and the volume table adds them up.
            </li>
            <li>
              <strong>Beer is left out of the comparison.</strong> Scenario B can let extra wine replace beer, for the access wine only, holding spending, volume or pure alcohol constant. Holding
              spending constant removes a dollar of beer per dollar of extra wine; holding pure alcohol constant removes beer with the same alcohol, about {x.wineAbv && x.beerAbv ? (x.wineAbv / x.beerAbv).toFixed(1) : "2.5"} gallons
              of beer per gallon of wine at average strengths. Both are assumptions with no measured basis here, so the comparison does not include them; a demand system for wine, beer and spirits
              is a later milestone.
            </li>
            <li>
              <strong>Ranges are not probabilities.</strong> The sensitivity ranges are conventions (only the elasticity's rests on a published source), and nothing here says how likely any
              value is.
            </li>
          </ul>
        </>
      )}
    </section>
  );
}

function BaselineTable({ rows, fy, note }: { rows: BaselineRow[]; fy: number; note: ReactNode }) {
  return (
    <details open className="small">
      <summary>
        <strong>The baseline and what each figure is</strong> (source, year, units, coverage, standing)
      </summary>
      <div className="table-wrap">
        <table className="data">
          <caption className="small">Base year FY{fy}. Only the rows marked as used enter the calculation; the cross-check and context rows do not.</caption>
          <thead>
            <tr>
              <th scope="col">Figure</th>
              <th scope="col" className="num">
                Value
              </th>
              <th scope="col">Units</th>
              <th scope="col">Source and year</th>
              <th scope="col">Coverage</th>
              <th scope="col">Standing</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.input}>
                <th scope="row">{r.input}</th>
                <td className="num">{r.value}</td>
                <td>{r.units}</td>
                <td>{r.source}</td>
                <td>{r.coverage}</td>
                <td>{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small">{note}</p>
    </details>
  );
}

function Headline({ c }: { c: Comparison }) {
  const e = c.earmarked;
  const n3 = e?.base === "wholesale" ? "2" : "1";
  const any = c.headline === "all";
  const matched = c.priceCase === "matched";
  const x = c.private.x;
  const S = x.wineSales! * movedShare(x);
  return (
    <>
      <p className="small">
        <strong>Prices:</strong>{" "}
        {matched ? (
          <>
            <strong>matched consumer prices</strong>, the reference case: grocers charge what a state store charges for the same wine, so in arrangement 1 the replacement tax is inside that
            price and comes out of what sellers keep. With prices unchanged, no price response follows. The entered grocery price (section 4) is the alternative, in the joint scenarios below.
          </>
        ) : (
          <>
            <strong>the grocery price entered in section 4</strong>
            {c.private.priceMoves ? `, with ${pct(c.settings.taxToPrice ?? 1, 0)} of the replacement tax added to the shelf price in arrangement 1` : ""}. Matched consumer prices, the reference
            case, are a row of the joint scenarios below.
          </>
        )}{" "}
        <strong>Purchases that move:</strong>{" "}
        {x.eligible === undefined ? (
          <span className="warn-inline">all wine sales are treated as eligible, including restaurants' and bars' purchases, which would not move</span>
        ) : (
          <>
            {pct(x.shift!, 0)} of household purchases, which are {pct(x.eligible ?? 1, 0)} of wine sales (an uncertain input): {money(S)} a year at state-store prices, {pct(movedShare(x))} of
            all wine sales. Licensees keep buying from DABS.
          </>
        )}
      </p>
      <p>
        <strong>Channel shift only</strong> (existing purchases move, total wine bought unchanged): arrangement 1 changes state revenue by <strong>{money(c.private.lines!.net)}</strong> a year
        and arrangement 2 by <strong>{money(c.wholesale.lines!.net)}</strong>.{" "}
        {any ? (
          matched && !c.private.priceMoves && !c.entered.recapture && !c.entered.access ? (
            <>The price response entered changes nothing at matched prices. </>
          ) : (
            <>
              <strong>With the purchase changes entered</strong> (section 5): arrangement 1 <strong>{money(c.private.netAll)}</strong>, arrangement 2 <strong>{money(c.wholesale.netAll)}</strong>.{" "}
            </>
          )
        ) : null}
        Arrangement 3 has the total of arrangement {n3} in each case: its allocation changes which state funds bear the result, not its size.
      </p>
    </>
  );
}

function Cell({ v, strong = false, muted = false }: { v: ReactNode; strong?: boolean; muted?: boolean }) {
  const inner = strong ? <strong>{v}</strong> : muted ? <span className="muted">{v}</span> : v;
  return <td className="num">{inner}</td>;
}

function FinanceTable({ c, base3, shiftOnly, rateStatus }: { c: Comparison; base3: ArrangementResult; shiftOnly: Comparison | null; rateStatus: string }) {
  const P = c.private;
  const Wh = c.wholesale;
  const e = c.earmarked!;
  const lp = P.lines!;
  const lw = Wh.lines!;
  const l3 = base3.lines!;
  const n3 = base3.id === "private" ? "1" : "2";
  const row = (label: ReactNode, a: ReactNode, b: ReactNode, three: ReactNode, opts: { strong?: boolean; head?: boolean; same3?: boolean } = {}) => (
    <tr className={opts.head ? "group" : undefined}>
      <th scope="row" style={opts.head ? { paddingTop: 10 } : undefined}>
        {opts.strong ? <strong>{label}</strong> : label}
      </th>
      <Cell v={a} strong={opts.strong} />
      <Cell v={b} strong={opts.strong} />
      <Cell v={three} strong={opts.strong} muted={opts.same3} />
    </tr>
  );
  const head = (label: string) => (
    <tr>
      <th scope="rowgroup" colSpan={4} className="small" style={{ paddingTop: 12 }}>
        {label}
      </th>
    </tr>
  );
  const mech = (id: "price" | "recapture" | "access") => {
    const mp = P.mechanisms.find((m) => m.id === id)!;
    const mw = Wh.mechanisms.find((m) => m.id === id)!;
    const m3 = base3.mechanisms.find((m) => m.id === id)!;
    if (!mp.entered) return row(mp.label, <span className="muted">not entered</span>, <span className="muted">not entered</span>, <span className="muted">not entered</span>);
    return row(`+ ${mp.label}`, money(mp.net), money(mw.net), money(m3.net), { same3: true });
  };
  const any = c.headline === "all";
  return (
    <div className="table-wrap">
      <table className="data cmp-table">
        <caption className="small">State finances from wine, $ a year. Arrangement 3 has the total of arrangement {n3} (grey) and adds who receives it.</caption>
        <thead>
          <tr>
            <th scope="col"> </th>
            <th scope="col" className="num">
              {ARRANGEMENT_LABELS.private}
            </th>
            <th scope="col" className="num">
              {ARRANGEMENT_LABELS.wholesale}
            </th>
            <th scope="col" className="num">
              3. Arrangement {n3} with an explicit allocation to school meals and enforcement
            </th>
          </tr>
        </thead>
        <tbody>
          {head("Measured baseline (observations and figures derived from them)")}
          {row("Wine sales at state-store prices, before sales tax", money(P.x.wineSales), money(Wh.x.wineSales), money(base3.x.wineSales), { same3: true })}
          {P.x.eligible !== undefined &&
            row(
              <>
                of which bought by households, who could buy at grocers (household share {pct(P.x.eligible ?? 1, 0)}, an assumption)
                <div className="muted small">Licensees (bars, restaurants, clubs) keep buying from DABS. DABS publishes no wine sales by customer type; the share is uncertain.</div>
              </>,
              money(P.x.wineSales! * (P.x.eligible ?? 1)),
              money(Wh.x.wineSales! * (Wh.x.eligible ?? 1)),
              money(base3.x.wineSales! * (base3.x.eligible ?? 1)),
              { same3: true },
            )}
          {row("State revenue from wine today: gross margin plus state sales tax", money(lp.baselineRevenue), money(lw.baselineRevenue), money(l3.baselineRevenue), { same3: true })}
          {head("Modelled: existing purchases change channel (total wine bought unchanged)")}
          {row("Gross margin the state stores no longer earn on the wine that moves", money(lp.marginDisplaced), money(lw.marginDisplaced), money(l3.marginDisplaced), { same3: true })}
          {row(
            <>
              Replacement revenue: the replacement tax (1), or DABS's margin on its sales to grocers (2)
              {lw.wholesaleReceipts !== null && (
                <div className="muted small">
                  2 = DABS's receipts from grocers {money(lw.wholesaleReceipts)} less what DABS pays for that wine {money(lw.acquisitionCost)}
                </div>
              )}
            </>,
            money(lp.replacement),
            money(lw.replacement),
            money(l3.replacement),
            { same3: true },
          )}
          {row("Change in state sales tax (the moved wine at its new shelf price)", money(lp.salesTaxChange), money(lw.salesTaxChange), money(l3.salesTaxChange), { same3: true })}
          {row("State revenue from wine under the arrangement", money(lp.proposedRevenue), money(lw.proposedRevenue), money(l3.proposedRevenue), { same3: true })}
          {row("Operating costs the state stops paying (assumption)", money(lp.costsAvoided), money(lw.costsAvoided), money(l3.costsAvoided), { same3: true })}
          {row("New licensing and enforcement costs (assumption)", money(-lp.newCosts), money(-lw.newCosts), money(-l3.newCosts), { same3: true })}
          {row("Net change, all state funds together", money(lp.net), money(lw.net), money(l3.net), { strong: true })}
          {Wh.retainedCosts !== null &&
            row(
              <span className="muted">Context: operating costs the state keeps paying on that wine in arrangement 2 (DABS's all-product average less the avoided part; not a change)</span>,
              "",
              <span className="muted">{money(Wh.retainedCosts)}</span>,
              "",
            )}
          {head(any ? "Purchase changes entered in section 5, each added on its own to the channel shift" : "Purchase changes (section 5): none entered, so total wine bought does not change")}
          {mech("price")}
          {mech("recapture")}
          {mech("access")}
          {any && row("Net change with these purchase changes", money(P.netAll), money(Wh.netAll), money(base3.netAll), { strong: true })}
          {P.channelReturn &&
            row(
              <>
                <span className="input-basis user">exploratory</span> The same if the price response is read as buyers going back to state stores instead of buying less
                <div className="muted small">
                  While state stores sell the same wine, buyers put off by a dearer grocery price could buy it there instead: the share moving would fall (arrangement 1: {pct(P.channelReturn.shareMoving)}{" "}
                  of household purchases instead of {pct(P.x.shift!)}) and no wine would be lost. Sizing that fall with the market-wide −0.46 elasticity is not supported: the elasticity measures
                  how much wine people buy when its price changes everywhere, not how many switch between two channels selling the same bottle. Shown only to bound the reading.
                </div>
              </>,
              money(P.channelReturn.net),
              money(Wh.channelReturn?.net),
              money(base3.channelReturn?.net),
              { same3: true },
            )}
          {head(`Who receives it: the school-meals and enforcement funds (deposit rates in law: ${oneStatus(rateStatus)})`)}
          {row("Today's allocation of the margin on the wine that moves: school meals", money(e.today.school), money(e.today.school), money(e.today.school), { same3: true })}
          {row("Today's allocation: alcohol enforcement", money(e.today.enforcement), money(e.today.enforcement), money(e.today.enforcement), { same3: true })}
          {row(
            "Allocation under the arrangement",
            <span className="muted">not decided by the arrangement</span>,
            <span className="muted">not decided by the arrangement</span>,
            <span>{ruleWords(e.rule)} (the next table, in every case)</span>,
          )}
          {head("Consumer price and purchases (modelled)")}
          {row("Grocery shelf price, % of today's state-store price, before sales tax", pct(P.price!.shelf), pct(Wh.price!.shelf), pct(base3.price!.shelf), { same3: true })}
          {row("The same with state sales tax", pct(P.price!.withSalesTax), pct(Wh.price!.withSalesTax), pct(base3.price!.withSalesTax), { same3: true })}
          {row(
            <>
              What sellers keep per $ of state-store price, after the cost of the wine and the replacement tax
              <div className="muted small">Gross margin on their own price in brackets. Their costs and profit come out of it (the next table).</div>
            </>,
            keepText(P.sellers, true),
            keepText(Wh.sellers, false),
            "",
          )}
          {row("Wine bought in total, % of today", pct((P.volumeAll ?? P.volumeShift)!.index), pct((Wh.volumeAll ?? Wh.volumeShift)!.index), pct((base3.volumeAll ?? base3.volumeShift)!.index), { same3: true })}
          {head("What would need to be true")}
          {row("Break-even: the arrangement's own lever at which state revenue is unchanged", <span className="small">{breakEvenText(P, shiftOnly?.private ?? null)}</span>, <span className="small">{breakEvenText(Wh, shiftOnly?.wholesale ?? null)}</span>, <span className="small">The total breaks even where arrangement {n3}'s does. Where its proceeds cover the allocation is in the next table.</span>)}
          {row(
            <>
              Assumptions that can reverse the sign, <strong>one at a time</strong>
              <div className="muted small">Each assumption moved alone, the others as entered; not a joint result (joint scenarios are in their own table below).</div>
            </>,
            <span className="small">{reversalText(P.reversals)}</span>,
            <span className="small">{reversalText(Wh.reversals)}</span>,
            <span className="small muted">as arrangement {n3}</span>,
          )}
        </tbody>
      </table>
    </div>
  );
}

function VolumeTable({ c }: { c: Comparison }) {
  const cols = [c.private, c.wholesale];
  const part = (a: ArrangementResult, id: "price" | "recapture" | "access") => a.mechanisms.find((m) => m.id === id)!;
  const q = c.private.x.extraGrocery ?? 0;
  type Split = [number | null, number | null];
  const cells = (split: (a: ArrangementResult) => Split, strong = false) =>
    cols.flatMap((a) => {
      const [st, gr] = split(a);
      const tot = st === null || gr === null ? null : st + gr;
      return [st, gr, tot].map((v, k) => (
        <td className="num" key={`${a.id}${k}`}>
          {strong ? <strong>{money(v)}</strong> : money(v)}
        </td>
      ));
    });
  const rows: [string, (a: ArrangementResult) => Split, boolean][] = [
    ["Today (measured)", (a) => [a.volumeShift!.baseline, 0], false],
    ["Channel shift (assumption): moves wine, adds none", (a) => [-a.volumeShift!.grocery, a.volumeShift!.grocery], false],
    ...(["price", "recapture", "access"] as const)
      .filter((id) => part(c.private, id).entered)
      .map((id): [string, (a: ArrangementResult) => Split, boolean] => [
        part(c.private, id).label,
        (a) => (id === "price" ? [0, part(a, id).dollars] : [(1 - q) * (part(a, id).dollars ?? 0), q * (part(a, id).dollars ?? 0)]),
        false,
      ]),
    ["Modelled", (a) => [(a.volumeAll ?? a.volumeShift)!.state, (a.volumeAll ?? a.volumeShift)!.grocery], true],
  ];
  return (
    <div className="table-wrap">
      <table className="data cmp-table">
        <caption className="small">
          Where the wine is bought, $ a year at state-store prices (so channels and arrangements add up). The channel shift moves wine without adding any; each purchase change is its own row;
          the modelled row is the sum of the rows above it.
        </caption>
        <thead>
          <tr>
            <th scope="col" rowSpan={2}>
              Component
            </th>
            <th scope="colgroup" colSpan={3} className="num">
              Arrangement 1
            </th>
            <th scope="colgroup" colSpan={3} className="num">
              Arrangement 2
            </th>
          </tr>
          <tr>
            {cols.flatMap((a) =>
              ["State stores and agencies", "Grocers", "Total"].map((h) => (
                <th scope="col" className="num" key={`${a.id}${h}`}>
                  {h}
                </th>
              )),
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, split, strong]) => (
            <tr key={label}>
              <th scope="row">{strong ? <strong>{label}</strong> : label}</th>
              {cells(split, strong)}
            </tr>
          ))}
          <tr>
            <th scope="row">Wine bought in total, % of today</th>
            {cols.map((a) => (
              <td className="num" colSpan={3} key={a.id}>
                {pct((a.volumeAll ?? a.volumeShift)!.index)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

const oneStatus = (rateStatus: string) => {
  const [a, b] = rateStatus.split("; ");
  return a === b ? a : rateStatus;
};

function EarmarkTable({ c, rateStatus }: { c: Comparison; rateStatus: string }) {
  const sets = c.guarantees.filter((g) => g.cases.length);
  if (!sets.length) return null;
  const e0 = sets[0].cases[0];
  const n = e0.base === "private" ? "1" : "2";
  const baseArr = e0.base === "private" ? c.private : c.wholesale;
  const x = baseArr.x;
  const S = x.wineSales! * movedShare(x);
  const rate = e0.fixed / S;
  const distinctAll = baseArr.priceMoves || c.entered.recapture || c.entered.access;
  const caseIds = sets[0].cases.map((e) => e.basis).filter((b) => b !== "all" || distinctAll);
  const caseLabel = (b: EarmarkCase) =>
    b === "shift" ? "Channel shift only" : b === "all" ? "With the purchase changes entered (less wine bought)" : "Exploratory: buyers go back to state stores instead";
  const pick = (set: (typeof sets)[number], b: EarmarkCase) => set.cases.find((e) => e.basis === b)!;
  const lever = (e: EarmarkResult) =>
    e.basis === "return"
      ? "not solved (exploratory)"
      : e.coverLever === null
        ? "none in the supported range"
        : e.coverLever.lever === "discount"
          ? `a discount of at most ${pct(e.coverLever.value)}`
          : x.revenueMode === "excise"
            ? `an excise of $${e.coverLever.value.toFixed(2)} a gallon`
            : `a tax of ${pct(e.coverLever.value)} of the grocery price before tax`;
  const rowOf = (label: ReactNode, f: (b: EarmarkCase) => ReactNode, strong = false) => (
    <tr>
      <th scope="row">{strong ? <strong>{label}</strong> : label}</th>
      {caseIds.map((b) => (
        <td className="num" key={b}>
          {strong ? <strong>{f(b)}</strong> : f(b)}
        </td>
      ))}
    </tr>
  );
  const group = (label: ReactNode) => (
    <tr>
      <th scope="rowgroup" colSpan={caseIds.length + 1} className="small" style={{ paddingTop: 12 }}>
        {label}
      </th>
    </tr>
  );
  const ruleHead = (rule: EarmarkRule) =>
    rule === "fixed"
      ? `Proposal A, a fixed guarantee: ${money(e0.fixed)} a year, set once from this scenario and paid whatever moves`
      : rule === "proportional"
        ? "Proposal B, a proportional guarantee: today's deposit rates on the state-store sales actually lost, each year"
        : rule === "amount"
          ? "A fixed amount a year, as entered"
          : "A share of the proceeds, as entered";
  return (
    <div className="table-wrap">
      <table className="data cmp-table">
        <caption className="small">
          Arrangement 3: arrangement {n} with a guarantee to school meals and alcohol enforcement, $ a year, in each case.{" "}
          {sets.length > 1 ? "A fixed and a proportional guarantee are different proposals; both are shown." : ""}
        </caption>
        <thead>
          <tr>
            <th scope="col"> </th>
            {caseIds.map((b) => (
              <th scope="col" className="num" key={b}>
                {caseLabel(b)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {group("The same in every proposal")}
          {rowOf("State-store sales lost, at state-store prices", (b) => money(pick(sets[0], b).lostSales))}
          {rowOf(`Proceeds the guarantee is paid from: arrangement ${n}'s own revenue on grocery wine (${n === "1" ? "the replacement tax collected" : "DABS's margin on its sales to grocers"})`, (b) =>
            money(pick(sets[0], b).proceeds),
          )}
          {rowOf(`Total, all state funds together (= arrangement ${n}'s net change)`, (b) => money(pick(sets[0], b).net), true)}
          {sets.map((g) => (
            <GuaranteeRows key={g.rule} head={ruleHead(g.rule)} pick={(b) => pick(g, b)} rowOf={rowOf} group={group} lever={lever} />
          ))}
        </tbody>
      </table>
      <p className="small">
        <strong>What the guarantee is.</strong>{" "}
        {e0.rule === "fixed" || e0.rule === "proportional" ? (
          <>
            Today Utah Code §§ 32B-2-304 and -305 make DABS deposit {pct(rate, 3)} of its gross liquor revenue in the school-meals and enforcement funds (the rates in law for the base year:{" "}
            {oneStatus(rateStatus)}). Wine DABS no longer sells (arrangement 1) would produce no deposits under the current text; that is a legal reading by Claude, not reviewed. A guarantee
            is a term of the proposal, not an existing requirement, and it can be written two ways. <strong>Fixed (A):</strong> {money(e0.fixed)} a year, {pct(rate, 3)} of {money(S)}, the
            sales this scenario moves, set once and paid whatever then happens: if less wine moves than estimated (as in the exploratory return reading), the two funds come out ahead of
            today and the other funds pay for it; if more moves, the two funds fall behind. <strong>Proportional (B):</strong> the same rates on the state-store sales actually lost each
            year, which keeps the two funds where they would have been, but needs that loss measured every year against a baseline no one observes.
          </>
        ) : (
          <>{money(e0.allocation.total)} is the proposal's chosen amount, split between the two funds in today's statutory proportion. It is a term of the proposal, not an existing requirement.</>
        )}{" "}
        <strong>A guarantee redistributes the loss; it does not remove it.</strong> The total is the same with or without it: keeping the two funds whole moves the whole change onto the
        General Fund and the other state funds
        {sets.some((g) => g.cases.some((e) => e.requirement > 0)) ? ", and a guarantee larger than the proceeds needs other state money" : ""}.{" "}
        {!caseIds.includes("return")
          ? baseArr.priceMoves
            ? "The return-to-state-stores reading needs a price response, and none is entered."
            : "No return-to-state-stores case here: the grocery shelf price equals the state store's, so no price gap sends buyers back. It arises in the entered-price alternative (choose it in section 6), where it is shown and labelled exploratory."
          : ""}
      </p>
    </div>
  );
}

function GuaranteeRows({
  head,
  pick,
  rowOf,
  group,
  lever,
}: {
  head: string;
  pick: (b: EarmarkCase) => EarmarkResult;
  rowOf: (label: ReactNode, f: (b: EarmarkCase) => ReactNode, strong?: boolean) => ReactNode;
  group: (label: ReactNode) => ReactNode;
  lever: (e: EarmarkResult) => string;
}) {
  return (
    <>
      {group(head)}
      {rowOf("Guaranteed to school meals and enforcement together", (b) => money(pick(b).allocation.total))}
      {rowOf("Funding requirement on other state money (guarantee above the proceeds)", (b) => money(pick(b).requirement), true)}
      {rowOf("Left of the proceeds for the General Fund and other uses", (b) => money(pick(b).remainder))}
      {rowOf("Change for the two funds against today", (b) => money(pick(b).fundsChange))}
      {rowOf("Change for the General Fund and every other state fund", (b) => money(pick(b).othersChange))}
      {rowOf("The lever at which the proceeds just cover the guarantee", (b) => <span className="small">{lever(pick(b))}</span>)}
    </>
  );
}

function viaText(v: ViabilityCase | null, kind: "tax" | "discount", excise: boolean): ReactNode {
  if (!v) return "—";
  if (v.status === "unavailable") return <span className="small">{v.note}</span>;
  if (v.status === "none_in_range" || v.shelf === null || v.lever === null)
    return (
      <span className="small">
        <strong>None</strong> in the supported range. {v.note}
      </span>
    );
  const lv = kind === "discount" ? `a discount of at most ${pct(v.lever)}` : excise ? `an excise of $${v.lever.toFixed(2)} a gallon` : `a tax of ${pct(v.lever)}`;
  return (
    <span>
      <strong>{pct(v.shelf)}</strong> of the state-store price ({v.shelf >= 1 ? "+" : "−"}
      {pct(Math.abs(v.shelf - 1))}), with {lv}
      {v.demandFactor !== null ? <div className="muted small">At that price the wine that moves is bought at {pct(v.demandFactor)} of its quantity (the price response entered).</div> : null}
    </span>
  );
}

function SellersTable({ c }: { c: Comparison }) {
  const P = c.private;
  const Wh = c.wholesale;
  const set = c.settings;
  const x = P.x;
  const excise = x.revenueMode === "excise";
  const S = x.wineSales! * movedShare(x);
  const identity = (x.avoidableCost ?? 0) - (S > 0 ? (x.newCosts ?? 0) / S : 0);
  const w = set.wholesalerMargin;
  const g = set.grocerMargin;
  const row = (label: ReactNode, a: ReactNode, b: ReactNode) => (
    <tr>
      <th scope="row">{label}</th>
      <td className="num">{a}</td>
      <td className="num">{b}</td>
    </tr>
  );
  const beLabel = (a: ArrangementResult) => {
    const k = a.sellersAtBreakEven;
    if (!k) return <span className="small">no break-even in range</span>;
    return keepText(k, a.id === "private");
  };
  return (
    <div className="table-wrap">
      <table className="data cmp-table">
        <caption className="small">
          Can sellers live with it? What private wholesalers and grocers keep per $1 of today's state-store price on the wine that moves, after paying for the wine and any replacement tax
          (channel shift; gross margin on their own price in brackets, the definition Census uses). Their own costs and profit come out of it.
        </caption>
        <thead>
          <tr>
            <th scope="col"> </th>
            <th scope="col" className="num">
              {ARRANGEMENT_LABELS.private}: wholesalers and grocers together
            </th>
            <th scope="col" className="num">
              {ARRANGEMENT_LABELS.wholesale}: the grocer
            </th>
          </tr>
        </thead>
        <tbody>
          {row(`At the levers entered (${c.priceCase === "matched" ? "matched consumer prices" : "the entered grocery price"})`, keepText(P.sellers, true), keepText(Wh.sellers, false))}
          {row("At the lever where the state just breaks even (channel shift)", beLabel(P), beLabel(Wh))}
          {row(
            <>
              Gross margin sellers need <span className="input-basis user">assumption</span>
              <div className="muted small">Entered in section 6. No source measures what a Utah grocer would need on wine.</div>
            </>,
            w === null || g === null ? <span className="muted">not entered</span> : <span>wholesaler {pct(w)}, grocer {pct(g)} (together {pct(1 - (1 - w) * (1 - g))} of the shelf price before tax)</span>,
            g === null ? <span className="muted">not entered</span> : <>grocer {pct(g)}</>,
          )}
          {row(
            <>
              Shelf price at which the state breaks even <em>and</em> sellers earn those margins, before sales tax
              <div className="muted small">Sellers price to cover the cost of the wine and their margins and add all of any replacement tax; the state's lever is then solved.</div>
            </>,
            P.viability ? viaText(P.viability.shift, "tax", excise) : <span className="muted">needs both margins</span>,
            Wh.viability ? viaText(Wh.viability.shift, "discount", false) : <span className="muted">needs the grocer's margin</span>,
          )}
          {(P.viability?.all || Wh.viability?.all) &&
            row(
              "The same with the purchase changes entered (the price response read as less wine bought)",
              viaText(P.viability?.all ?? null, "tax", excise),
              viaText(Wh.viability?.all ?? null, "discount", false),
            )}
        </tbody>
      </table>
      <p className="small">
        <strong>The trade-off at matched prices.</strong> When grocers charge what a state store charges, the state and the sellers divide the same margin, so whatever the arrangement the state
        breaks even only if sellers keep no more than the operating cost the state avoids less the new costs: {cents(identity)} per dollar here ({pct(x.avoidableCost ?? 0)} avoidable cost less{" "}
        {money(x.newCosts)} spread over {money(S)}). A price consumers already accept is not automatically one a grocer can sustain. Above it, sellers' margins come from consumers, and how
        many buyers would still choose the grocery shelf over the state store is not measured. Gross margins are averages that pay for everything a business sells; a grocer adding wine to
        shelves it already runs may accept less, just as the state's average cost is not the cost it would avoid.
      </p>
    </div>
  );
}

function PriceTable({ c }: { c: Comparison }) {
  const lines = priceBuildUp(c);
  if (!lines.length) return null;
  const cell = (v: number | null, kind: string) => (v === null ? <span className="muted">none</span> : kind === "tax" || kind === "total" ? pct(v, 2) : pct(v));
  return (
    <div className="table-wrap">
      <table className="data cmp-table">
        <caption className="small">
          The price of a bottle, built up: per $1 of today's state-store price before sales tax, at the channel-shift prices (markups are on cost; margins on the selling price).
        </caption>
        <thead>
          <tr>
            <th scope="col">Component</th>
            <th scope="col" className="num">
              Today, state store
            </th>
            <th scope="col" className="num">
              1. Private retail
            </th>
            <th scope="col" className="num">
              2. State wholesale
            </th>
            <th scope="col">Basis</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.id}>
              <th scope="row">{l.kind === "subtotal" || l.kind === "total" ? <strong>{l.label}</strong> : l.kind === "ratio" ? <span className="muted">{l.label}</span> : l.label}</th>
              <td className="num">{cell(l.today, l.kind)}</td>
              <td className="num">{cell(l.private, l.kind)}</td>
              <td className="num">{cell(l.wholesale, l.kind)}</td>
              <td className="small">{l.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="small">
        The state's existing margin is counted once: it stays with the state stores, goes to the replacement tax and private sellers (arrangement 1), or is split between DABS and the grocer
        (arrangement 2). State costs (avoided store costs, new licensing costs) are in the finance table; private wholesalers' and grocers' own costs come out of their margin and are not modelled.
        {c.private.price!.shelf > 1.0001
          ? ` In arrangement 1 the grocery shelf price is ${pct(c.private.price!.shelf)} of the state store's for the same wine, while the state stores keep selling it: holding the share that moves fixed is then a strong assumption (the exploratory channel-return row above, and the matched-price row of the joint scenarios, show the alternatives).`
          : c.priceCase === "matched"
            ? " At matched consumer prices the shelf price is today's in both arrangements; in arrangement 1 the replacement tax is inside it, so the sellers' own price falls by the tax."
            : ""}
      </p>
    </div>
  );
}

function JointTable({ x, get, rates, bounds }: { x: ScenarioInputs; get: (k: string) => string; rates: DepositRates | null; bounds: Bounds | null }) {
  if (!bounds) return <p className="small muted">Joint scenarios need the base year's expense lines and margins, which this year lacks.</p>;
  const set = settingsFromFields(get);
  const rows: JointRow[] = jointScenarios(x, set, rates, bounds);
  const lv = (v: number | null, status: string, kind: "tax" | "discount") =>
    v === null ? (status === "none_in_range" ? "none in range" : "—") : kind === "discount" ? `≤ ${pct(v)}` : set.taxKind === "excise" ? `≥ $${v.toFixed(2)}/gal` : `≥ ${pct(v)}`;
  const reach = rows.filter((r) => (r.private.net ?? -1) >= 0 || (r.wholesale.net ?? -1) >= 0);
  return (
    <div className="table-wrap">
      <table className="data cmp-table">
        <caption className="small">
          Joint scenarios: several assumptions moved together, each labelled by what supports it. The replacement tax and the discount stay as entered; the break-even columns give the lever
          each row would need. Not probabilities.
        </caption>
        <thead>
          <tr>
            <th scope="col">Scenario and standing</th>
            <th scope="col" className="num">
              1: net change
            </th>
            <th scope="col" className="num">
              1: break-even tax
            </th>
            <th scope="col" className="num">
              2: net change
            </th>
            <th scope="col" className="num">
              2: break-even discount
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <th scope="row">
                {r.label} <span className={`input-basis ${r.standing === "documented bounds" ? "sourced" : r.standing === "as entered" ? "derived" : "user"}`}>{r.standing}</span>
                <div className="muted small">{r.what}</div>
              </th>
              <td className="num">{money(r.private.net)}</td>
              <td className="num">{lv(r.private.breakEven, r.private.status, "tax")}</td>
              <td className="num">{money(r.wholesale.net)}</td>
              <td className="num">{lv(r.wholesale.breakEven, r.wholesale.status, "discount")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="small">
        {reach.length
          ? `At the entered tax and discount, these rows reach break-even or better: ${reach.map((r) => r.label.toLowerCase()).join("; ")}.`
          : "At the entered tax and discount, none of these joint scenarios reaches break-even, including the one that is only arithmetically possible."}{" "}
        Documented bounds come from DABS's own accounts for the base year (all products: card fees, agency contracts, bags and salaries as shares of sales; the range of its reported margins).
        They bound an accounting category, not the cost that would actually stop if some wine left the stores. Exploratory rows change assumptions no source measures.
      </p>
    </div>
  );
}

function MechanismTable({ x, c }: { x: ScenarioInputs; c: Comparison }) {
  const abvW = x.wineAbv;
  const abvB = x.beerAbv;
  const rows: [string, string, string][] = [
    [
      "Existing wine purchases move from DABS to grocers",
      "Represented: the share of household purchases moving (an assumption), and the household share of wine sales (an uncertain input; licensees keep buying from DABS). Total wine bought does not change.",
      "No Utah source measures the share moving. DABS's FY2025 report puts off-premise sales (stores and agencies) at 82% of its sales, all products; wine's split by customer type is not published (a records request is drafted, not sent). In Colorado, beer sales moved from liquor stores to grocers after 2019 (Palardy 2022, foot-traffic data), a channel shift, not a consumption estimate.",
    ],
    [
      "Wine bought changes because its price changes",
      `Represented when an elasticity is entered: constant elasticity by default, a straight line as a check.${c.entered.price ? "" : " Not entered now."}`,
      "Nelson (2013): wine −0.46 after correcting for publication bias (95% CI −0.54 to −0.38), market-level studies from many countries, 1954-2004; no cross-price or short- versus long-run split. A transfer to Utah, applied to a channel's price while state stores keep selling the same wine.",
    ],
    [
      "Switching between beer, wine and spirits",
      "Not in the comparison. Scenario B can let extra wine replace beer, but its share is the reader's assumption.",
      "No credible cross-price estimate for this change: Nelson (2013) reports none; Meng et al. (2014, UK household data) find off-trade wine and beer cross-price elasticities of 0.096 and −0.040, small and not significant. After full retail privatization, sales of other beverages fell by a median 2.2%, not enough to offset the privatized beverage's rise (Hahn et al. 2012), and Iowa's wine privatization showed no fall in beer or spirits (Wagenaar and Holder).",
    ],
    [
      "Total ethanol consumed",
      `Not computed as a result. Any claim of unchanged total drinking must be made in pure alcohol: a gallon of wine at ${abvW ? pct(abvW) : "about 12%"} holds as much ethanol as about ${abvW && abvB ? (abvW / abvB).toFixed(1) : "2.6"} gallons of beer at ${abvB ? pct(abvB) : "about 4.5%"}; dollars, bottles and cans are not comparable.`,
      "The studies above measured sales of each beverage; the one review figure for total consumption (Finland, medium-strength beer) rose. No study here shows grocery wine leaving total ethanol unchanged.",
    ],
    [
      "Access and convenience",
      "Represented only as an entered percentage (scenario B), and as one exploratory joint scenario.",
      "Full retail privatization raised per-capita sales of the privatized beverage by a median 44.4% (interquartile 4.5% to 122.5%; Hahn et al. 2012, Community Guide). Those were state exits from retail, mostly decades ago; adding grocery licences beside Utah's stores is a different change, so the size does not transfer.",
    ],
    [
      "Purchases shifting across state borders",
      "Represented only as an entered recapture percentage.",
      "No Utah data. In Iowa, 2% of consumers reported buying more liquor in neighbouring states after privatization (Fitzgerald and Mulford, cited in Hahn et al. 2012); not transferable.",
    ],
  ];
  return (
    <div className="table-wrap">
      <table className="data cmp-table">
        <caption className="small">What the comparison does and does not represent, and the evidence for each mechanism (docs/review/grocery-wine-model-audit.md has the sources).</caption>
        <thead>
          <tr>
            <th scope="col">Mechanism</th>
            <th scope="col">In the model</th>
            <th scope="col">Evidence and its standing</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([a, b, e]) => (
            <tr key={a}>
              <th scope="row">{a}</th>
              <td className="small">{b}</td>
              <td className="small">{e}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="small">
        The original question, whether grocery access could move existing purchases from beer toward wine without more drinking, is not answered by this model: a wine own-price elasticity
        says nothing about beer, and the privatization evidence points to more of the newly available beverage without an offsetting fall in the others. That evidence is about full privatization
        elsewhere and does not settle what grocery wine would do in Utah; it does mean the substitution should not be assumed.
      </p>
    </div>
  );
}

const SWEEP_KEYS: SweepKey[] = ["avoidableCost", "shift", "eligible", "priceRatio", "grossMargin", "elasticity", "taxRate", "discount"];

function SweepChart({ x, c, sweepKey, get, opexShare, bounds }: { x: ScenarioInputs; c: Comparison; sweepKey: SweepKey; get: (k: string) => string; opexShare: number | null; bounds: Bounds | null }) {
  const set = settingsFromFields(get);
  // At matched prices the entered grocery price is not used, and with prices unchanged the elasticity does nothing.
  const keys = SWEEP_KEYS.filter((k) => (k !== "elasticity" || (c.entered.price && c.private.priceMoves)) && (k !== "priceRatio" || c.priceCase === "entered"));
  const key = keys.includes(sweepKey) ? sweepKey : "avoidableCost";
  const sw = sweep(x, set, key);
  const spec = SWEEPS[key];
  const fmtX = (v: number) => (key === "taxRate" && set.taxKind === "excise" ? `$${v.toFixed(0)}` : spec.format === "percent" ? `${Math.round(v * 100)}%` : v.toFixed(2));
  const data = sw.points.map((p) => ({ v: p.v, private: p.private === null ? null : p.private / 1e6, wholesale: p.wholesale === null ? null : p.wholesale / 1e6 }));
  const entered = key === "taxRate" ? set.taxRate : key === "discount" ? set.discount : key === "avoidableCost" ? x.avoidableCost : key === "shift" ? x.shift : key === "eligible" ? (x.eligible ?? null) : key === "priceRatio" ? x.priceRatio : key === "grossMargin" ? x.grossMargin : (x.elasticity ?? null);
  const span = sw.to - sw.from;
  const step = [0.01, 0.02, 0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10, 20, 25, 50, 100].find((st) => span / st <= 7) ?? span / 6;
  const ticks = Array.from({ length: Math.floor(span / step + 1e-9) + 1 }, (_, i) => Number((Math.ceil(sw.from / step - 1e-9) * step + i * step).toFixed(6))).filter((t) => t >= sw.from - 1e-9 && t <= sw.to + 1e-9);
  const zp = zerosOf(sw.points, "private");
  const zw = zerosOf(sw.points, "wholesale");
  const fmtZ = (v: number) => (key === "taxRate" && set.taxKind === "excise" ? `$${v.toFixed(2)} a gallon` : spec.format === "percent" ? pct(v) : v.toFixed(2));
  const zText = (id: string, zs: number[], applies: boolean) =>
    !applies ? `${id} does not use this assumption` : zs.length ? `${id} crosses zero at ${zs.map(fmtZ).join(" and ")}` : `${id} does not cross zero between ${fmtX(sw.from)} and ${fmtX(sw.to)}`;
  return (
    <figure className="chart" aria-label="Net change in state revenue as one assumption moves">
      <figcaption className="small">
        <strong>How the result moves with one assumption</strong>, net change in state revenue, $ millions a year ({c.headline === "all" ? "with the purchase changes entered" : "channel shift only"}), the
        other inputs as entered. The dashed line marks the value entered
        {key === "avoidableCost"
          ? `; the shaded band, DABS's expense lines that could move with sales (${bounds ? `${pct(bounds.avoidLow)} card fees, agency contracts and bags, up to ${pct(bounds.avoidHigh)} with every salary` : "not available"}); the solid line, all of its operating expenses (an accounting ceiling, not a saving). All are shares of DABS's sales at state-store prices, the same denominator as the avoidable cost`
          : ""}
        .{" "}
        <label className="no-print">
          Assumption:{" "}
          <select value={key} onChange={(e) => navigate({ sx: e.target.value }, { replace: true })}>
            {keys.map((k) => (
              <option key={k} value={k}>
                {SWEEPS[k].label}
              </option>
            ))}
          </select>
        </label>
      </figcaption>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="2 3" />
          <XAxis dataKey="v" type="number" domain={[sw.from, sw.to]} ticks={ticks} tickFormatter={fmtX} tick={{ fontSize: 11, fill: "var(--text-2)" }} stroke="var(--line-strong)" />
          <YAxis tick={{ fontSize: 11, fill: "var(--text-2)" }} stroke="var(--line-strong)" width={48} tickFormatter={(v: number) => `${v}`} />
          <ReferenceLine y={0} stroke="var(--line-strong)" />
          {entered !== null && entered !== undefined && <ReferenceLine x={entered} stroke="var(--text-2)" strokeDasharray="4 3" />}
          {key === "avoidableCost" && bounds && <ReferenceArea x1={bounds.avoidLow} x2={bounds.avoidHigh} fill="var(--ci)" stroke="none" ifOverflow="extendDomain" />}
          {key === "avoidableCost" && opexShare !== null && opexShare <= sw.to && (
            <ReferenceLine x={opexShare} stroke="var(--line-strong)" label={{ value: "all DABS expenses", position: "insideTopRight", fontSize: 10, fill: "var(--text-2)" }} />
          )}
          {zp.map((z) => (
            <ReferenceDot key={`p${z}`} x={z} y={0} r={4} fill="var(--series-1)" stroke="var(--surface)" strokeWidth={2} />
          ))}
          {zw.map((z) => (
            <ReferenceDot key={`w${z}`} x={z} y={0} r={4} fill="var(--series-2)" stroke="var(--surface)" strokeWidth={2} />
          ))}
          <Tooltip
            formatter={(v: unknown, name: unknown) => [v === null || v === undefined ? "—" : `$${Number(v).toFixed(2)} million`, String(name)]}
            labelFormatter={(l: unknown) => fmtX(Number(l))}
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--line-strong)", color: "var(--text)", fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="private" name="1. Private retail, replacement tax" stroke="var(--series-1)" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="wholesale" name="2. State wholesale" stroke="var(--series-2)" strokeWidth={2} strokeDasharray="6 3" dot={false} connectNulls={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
      <p className="small" style={{ marginTop: 4 }}>
        {zText("Arrangement 1", zp, key !== "discount")}; {zText("arrangement 2", zw, key !== "taxRate")}. {spec.note} Arrangement 3 has the total of the arrangement it is built on. A crossing is a
        value at which the sign reverses, other inputs held; it is not a likely value.
      </p>
      <details className="small">
        <summary>The chart's numbers</summary>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th scope="col">{spec.label}</th>
                <th scope="col" className="num">
                  Arrangement 1
                </th>
                <th scope="col" className="num">
                  Arrangement 2
                </th>
              </tr>
            </thead>
            <tbody>
              {sw.points
                .filter((_, i) => i % 6 === 0)
                .map((p) => (
                  <tr key={p.v}>
                    <th scope="row">{fmtX(p.v)}</th>
                    <td className="num">{p.private === null ? "—" : millions(p.private)}</td>
                    <td className="num">{p.wholesale === null ? "—" : millions(p.wholesale)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
