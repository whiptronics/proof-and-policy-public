// Public Funding: "Where the Money Goes" (?v=funding). Ten chapters: what DABS reported for FY2025 and where it went,
// Utah's school spending and results against the nation, a revenue lab wired to the policy-designs engine through
// lib/publicFunding.ts, the law that protects each program, a public-value scale, district context, Tennessee and
// Colorado beside Utah (context only), the evidence that cuts the other way and the evidence vault.
// Observed figures come from lib/publicFunding.generated.ts (scripts/public_funding.py, pinned sources only); scenario
// figures from fundingScenario(). No number on this page is typed by hand.
import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { wrapWords } from "../components/BriefCharts";
import { ChartFigure, RowsTable, type Row } from "../components/ChartFigure";
import { rowTip, tipAttr } from "../lib/tip";
import { Go } from "../components/common";
import { HowWeKnow } from "../components/HowWeKnow";
import { saveFile, type Column } from "../lib/csv";
import { AI_DISCLOSURE } from "../lib/disclosure";
import { PUBLIC_FUNDING as PF } from "../lib/publicFunding.generated";
import {
  ARRANGEMENTS,
  BOUNDS,
  bottleReceipt,
  lawIsStale,
  CHECKLIST,
  COMPARATORS,
  CONTRARY,
  DEFAULT_INPUTS,
  DEFAULT_SHARE,
  MAP_MARGINS,
  MAP_PRICES,
  PACKAGE_AGENCY_REMITTANCE,
  PUBLIC_FUNDING_METHOD,
  ROUTINGS,
  STATE_NAME,
  T,
  compareWords,
  decodeScenario,
  documentedOnly,
  educationCsv,
  encodeScenario,
  fundingScenario,
  inFy2024Dollars,
  lawCsv,
  observedCsv,
  openQuestions,
  priceRevenueMap,
  scenarioJson,
  spendingRanks,
  stateComparison,
  stressTest,
  type Arrangement,
  type ChecklistAnswer,
  type Condition,
  type FundingInputs,
  type Jurisdictions,
  type MapPoint,
  type Region,
} from "../lib/publicFunding";
import { STATE_CASES } from "../lib/framework";
import { POLICY_DESIGNS_METHOD, SAVINGS_CASES, type SavingsCase } from "../lib/policyDesigns";
import { RETAILER_TARGET } from "../lib/wineAlternatives";
import { navigate, useParams } from "../lib/url";
import { lowerFirst, minus } from "../lib/format";

const pct = (v: number, d = 0) => `${minus((v * 100).toFixed(d))}%`;
const musd = (v: number, d = 1) => `$${(v / 1e6).toFixed(d)}M`;
const signed = (v: number | null, d = 2) => (v === null ? "Undetermined" : `${v < -5e3 ? "−" : v > 5e3 ? "+" : ""}$${(Math.abs(v) / 1e6).toFixed(d)}M`);
const usd0 = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;
const cents = (v: number) => {
  const c = Math.abs(v * 100).toFixed(1);
  return `${c === "0.0" ? "" : v < 0 ? "−" : "+"}${c}¢`;
};
const n0 = (v: number) => Math.round(v).toLocaleString("en-US");
const lowerOrHigher = (v: number) => `${Math.abs(v * 100).toFixed(1)}% ${v < 0 ? "lower" : "higher"}`;
const cons = PF.states.consumption.byState;
const lastYear = PF.states.consumption.years[PF.states.consumption.years.length - 1];
const tnYear = (fy: number) => PF.states.tennessee.account11002.find((a) => a.fy === fy)!;
const [tnFy2015, tnFy2016, tnFy2017] = [tnYear(2015), tnYear(2016), tnYear(2017)];

const DABS_SRC = `DABS, ${PF.dabs.source.edition}, ${PF.dabs.source.locator} (transcribed by hand; unaudited; not reviewed by a person)`;
const CENSUS_SRC = `U.S. Census Bureau, ${PF.education.source.edition}, ${PF.education.source.locator}`;
type NaepKey = keyof typeof PF.education.naep;
const naepAll = Object.values(PF.education.naep);
const naepHigher = naepAll.filter((a) => a.byJurisdiction.UT.vsNation === "higher").length;
const NAEP_SRC = "NCES, NAEP 2024 reading and mathematics, NAEP Data Service (scores and NCES's significance tests)";
const SAV_SHORT: Record<SavingsCase, string> = { none: "DABS saves nothing", allocated: "Card fees and agency contracts fall", longer_run: "Wages fall too" };

const COND: Record<Condition, { sym: string; label: string; cls: string }> = {
  satisfied: { sym: "✓", label: "Met under these inputs", cls: "tag" },
  not_satisfied: { sym: "✗", label: "Not met under these inputs", cls: "tag tag-assumption" },
  undetermined: { sym: "?", label: "Cannot be determined", cls: "tag tag-assumption" },
};

function Chip({ c }: { c: Condition }) {
  return (
    <span className={COND[c].cls}>
      <span aria-hidden="true">{COND[c].sym}</span> {COND[c].label}
    </span>
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

function Slider({ label, value, min, max, step, show, set, disabled }: { label: string; value: number; min: number; max: number; step: number; show: (v: number) => string; set: (v: number) => void; disabled?: boolean }) {
  return (
    <label>
      <span>
        {label}: <strong>{show(value)}</strong>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} disabled={disabled} aria-valuetext={show(value)} onChange={(e) => set(Number(e.target.value))} />
    </label>
  );
}

function tableOf(rows: Row[], caption?: string): ReactNode {
  return <RowsTable rows={rows} caption={caption} />;
}

function csvOf(rows: Row[]): { columns: Column<Row>[]; rows: Row[] } {
  const keys = Object.keys(rows[0] ?? {});
  return { columns: keys.map((k) => ({ key: k, kind: typeof rows[0]?.[k] === "number" ? "number" : "text", get: (r: Row) => r[k] })), rows };
}

// ----- charts ---------------------------------------------------------------------------------------------------------------

type Dest = (typeof PF.dabs.destinations)[number];

function DestinationBars({ width, selected, pick, tips }: { width: number; selected: string; pick: (id: string) => void; tips: Row[] }) {
  const rows = PF.dabs.destinations as readonly Dest[];
  // Same layout as BriefCharts' BridgeChart: full labels wrapped at the fixed-size row-label, never cut short.
  const wide = width >= 560;
  const labelW = wide ? Math.min(250, Math.round(width * 0.36)) : 0;
  const padL = wide ? labelW + 12 : 8;
  const padR = 70;
  const barH = 18;
  const lines = rows.map((r) => (wide ? wrapWords(r.label, Math.floor(labelW / 7)) : [r.label.split(" (")[0]]));
  const rowH = wide ? Math.max(30, Math.max(...lines.map((l) => l.length)) * 15 + 8) : 48;
  const H = rows.length * rowH + 10;
  const max = Math.max(...rows.map((r) => r.amount));
  const x = (v: number) => padL + (v / max) * (width - padL - padR);
  return (
    <svg className="chart" width={width} height={H} viewBox={`0 0 ${width} ${H}`} role="img" aria-label="FY2025 amounts DABS lists as going to each destination">
      {rows.map((r, i) => {
        const y = i * rowH + (wide ? (rowH - barH) / 2 + 5 : 22);
        const on = r.id === selected;
        const words = lines[i];
        const ly = wide ? y + barH / 2 + 4.5 - ((words.length - 1) * 15) / 2 : y - 6;
        return (
          <g key={r.id} onClick={() => pick(r.id)} style={{ cursor: "pointer" }} {...tipAttr(rowTip(tips[i]))}>
            <text x={wide ? labelW : padL} y={ly} textAnchor={wide ? "end" : "start"} className="row-label">
              {words.map((l, k) => (
                <tspan key={k} x={wide ? labelW : padL} dy={k === 0 ? 0 : 15}>
                  {l}
                </tspan>
              ))}
            </text>
            <rect x={x(0)} y={y} width={Math.max(1, x(r.amount) - x(0))} height={barH} fill={r.restricted ? "var(--series-1)" : "var(--series-2)"} stroke={on ? "var(--text)" : "none"} strokeWidth={2} />
            <text x={x(r.amount) + 6} y={y + barH / 2 + 4.5} className="bar-value">
              {musd(r.amount)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function SpendingBars({ width, rows, us, year, tips }: { width: number; rows: { usps: string; name: string; value: number | null }[]; us: number | null; year: string; tips: Row[] }) {
  const H = 260;
  const padL = 44;
  const padB = 34;
  const max = Math.max(...rows.map((r) => r.value ?? 0), us ?? 0) * 1.05;
  const bw = (width - padL - 8) / rows.length;
  const y = (v: number) => H - padB - (v / max) * (H - padB - 10);
  const ticks = [0, 10_000, 20_000, 30_000].filter((t) => t <= max);
  return (
    <svg className="chart" width={width} height={H} viewBox={`0 0 ${width} ${H}`} role="img" aria-label={`Current spending per pupil by state, fiscal year ${year}, highest first; Utah highlighted`}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={width - 8} y1={y(t)} y2={y(t)} className={t === 0 ? "axis-zero" : "grid"} />
          <text x={padL - 4} y={y(t) + 4} textAnchor="end" className="tick-label">
            {t === 0 ? "$0" : `$${t / 1000}k`}
          </text>
        </g>
      ))}
      {rows.map((r, i) =>
        r.value === null ? null : (
          <rect key={r.usps} x={padL + i * bw + 1} y={y(r.value)} width={Math.max(1, bw - 2)} height={y(0) - y(r.value)} fill={r.usps === "UT" ? "var(--series-2)" : "var(--series-1)"} opacity={r.usps === "UT" ? 1 : 0.75} />
        ),
      )}
      {us !== null && (
        <g>
          <line x1={padL} x2={width - 8} y1={y(us)} y2={y(us)} stroke="var(--text)" strokeDasharray="4 3" />
          <text x={width - 10} y={y(us) - 4} textAnchor="end" className="tick-label">
            United States {usd0(us)}
          </text>
        </g>
      )}
      {rows.map((r, i) =>
        r.usps === "UT" ? (
          <text key="ut" x={padL + i * bw + bw / 2} y={H - padB + 14} textAnchor="middle" className="tick-label">
            UT
          </text>
        ) : null,
      )}
      {/* Each state's whole column answers the pointer: a bar is about 5px wide on a phone. */}
      {rows.map((r, i) => (
        <rect key={`tip-${r.usps}`} x={padL + i * bw} y={10} width={bw} height={y(0) - 10} fill="transparent" {...tipAttr(rowTip(tips[i]))} />
      ))}
      <text x={padL} y={H - 6} className="tick-label">
        Highest
      </text>
      <text x={width - 8} y={H - 6} textAnchor="end" className="tick-label">
        Lowest
      </text>
    </svg>
  );
}

const REGION: Record<Region, { sym: string; label: string; fill: string }> = {
  both: { sym: "✓", label: "Shoppers pay no more and the state is no worse off", fill: "var(--series-1)" },
  price_only: { sym: "P", label: "Shoppers pay no more; the state is behind", fill: "var(--series-3)" },
  revenue_only: { sym: "R", label: "The state is no worse off; shoppers pay more", fill: "var(--series-6)" },
  neither: { sym: "–", label: "Shoppers pay more and the state is behind", fill: "var(--line-strong)" },
};

// Both tests met says nothing about the grocer: at 0% it earns nothing, and below the grocery average no measure
// shows it can sell wine at that margin.
const UNPROVEN = { sym: "?", label: "Shoppers pay no more and the state is no worse off, at a grocer margin no measure shows is workable", fill: "var(--series-1)" };
const NO_MARGIN = { sym: "×", label: "Both tests met only because the grocer earns nothing: not a workable design", fill: "var(--line-strong)" };
const cellMark = (p: MapPoint) => (p.region !== "both" ? REGION[p.region] : p.grocer === "not_satisfied" ? NO_MARGIN : p.grocer === "undetermined" ? UNPROVEN : REGION.both);
/** One map cell as a table row: the table lists some cells, and every cell's tooltip is this row. */
const mapRow = (p: MapPoint): Row => ({ "Price vs today": pct(p.price - 1), "Grocer margin": pct(p.grocerMargin), "State per $ that moves": cents(p.netPerDollar), Region: cellMark(p).label });

function FeasibilityMap({ width, a, savings, mark }: { width: number; a: "B" | "C"; savings: SavingsCase; mark: { price: number; grocerMargin: number; distribution: number } }) {
  const pts = priceRevenueMap(a, savings, mark.distribution);
  const padL = 48;
  const padB = 40;
  const cw = (width - padL - 8) / MAP_PRICES.length;
  const ch = 26;
  const H = MAP_MARGINS.length * ch + padB + 6;
  return (
    <svg className="chart" width={width} height={H} viewBox={`0 0 ${width} ${H}`} role="img" aria-label="Which combinations of shelf price and grocer margin keep the shopper's price and the state's revenue">
      {pts.map((p) => {
        const i = MAP_PRICES.indexOf(p.price);
        const j = MAP_MARGINS.indexOf(p.grocerMargin);
        const xx = padL + i * cw;
        const yy = 6 + (MAP_MARGINS.length - 1 - j) * ch;
        return (
          <g key={`${p.price}-${p.grocerMargin}`} {...tipAttr(rowTip(mapRow(p)))}>
            <rect x={xx + 1} y={yy + 1} width={cw - 2} height={ch - 2} fill={cellMark(p).fill} opacity={0.4} />
            {/* Always drawn: without the symbol a narrow map says its result by color alone. */}
            <text x={xx + cw / 2} y={yy + ch / 2 + 4} textAnchor="middle" className="tick-label" fontSize={cw > 22 ? undefined : 10} style={{ stroke: "none" }} aria-hidden="true">
              {cellMark(p).sym}
            </text>
          </g>
        );
      })}
      {(() => {
        const i = MAP_PRICES.findIndex((p) => Math.abs(p - mark.price) < 0.026);
        const j = MAP_MARGINS.findIndex((g) => Math.abs(g - mark.grocerMargin) < 0.026);
        if (i < 0 || j < 0) return null;
        return <rect x={padL + i * cw + 1} y={6 + (MAP_MARGINS.length - 1 - j) * ch + 1} width={cw - 2} height={ch - 2} fill="none" stroke="var(--text)" strokeWidth={2.5} />;
      })()}
      {MAP_MARGINS.map((g, j) => (
        <text key={g} x={padL - 4} y={6 + (MAP_MARGINS.length - 1 - j) * ch + ch / 2 + 4} textAnchor="end" className="tick-label">
          {pct(g)}
        </text>
      ))}
      {MAP_PRICES.map((p, i) =>
        // Narrow cells fit a label every fourth column; "today" (column 2) always keeps one.
        (cw > 22 ? i % 2 === 0 : (i - 2) % 4 === 0) ? (
          <text key={p} x={padL + i * cw + cw / 2} y={H - padB + 16} textAnchor="middle" className="tick-label">
            {p === 1 ? "today" : `${p > 1 ? "+" : "−"}${Math.round(Math.abs(p - 1) * 100)}%`}
          </text>
        ) : null,
      )}
      <text x={padL} y={H - 6} className="tick-label">
        {width < 420 ? "Shelf price vs. today →" : "Shelf price against today's state-store price →"}
      </text>
    </svg>
  );
}

// ----- the page -------------------------------------------------------------------------------------------------------------------

const CHAPTERS: [string, string][] = [
  ["pf-overview", "Overview"],
  ["pf-dollar", "Follow the Dollar"],
  ["pf-education", "Utah vs. America"],
  ["pf-lab", "Revenue Lab"],
  ["pf-protect", "Protect the Funding"],
  ["pf-value", "Public Value"],
  ["pf-local", "Local Impact"],
  ["pf-states", "Other States"],
  ["pf-against", "Counter-Evidence"],
  ["pf-evidence", "Evidence Vault"],
];

export function FundingView() {
  const params = useParams();
  const fromUrl = decodeScenario(params.get("fs"));
  const [x, setX] = useState<FundingInputs>(fromUrl ?? DEFAULT_INPUTS);
  const [documented, setDocumented] = useState(false);
  const [dest, setDest] = useState<string>("school_meals");
  const [jur, setJur] = useState<Jurisdictions>("states");
  const [year, setYear] = useState("2024");
  const [real, setReal] = useState(false);
  const [assessment, setAssessment] = useState<NaepKey>("math8");
  const [amount, setAmount] = useState(5_000_000);
  const [answers, setAnswers] = useState<Record<string, ChecklistAnswer>>({});
  const [district, setDistrict] = useState<string>(PF.districts.systems[0].ncesId);
  const [copied, setCopied] = useState("");
  const [linkBad] = useState(() => params.get("fs") !== null && fromUrl === null); // decided on arrival: the URL is rewritten at once

  const set = (p: Partial<FundingInputs>) => setX((o) => ({ ...o, ...p }));
  const shown = documented ? documentedOnly(x) : x;
  const r = useMemo(() => fundingScenario(shown), [shown]);
  const stress = useMemo(() => (documented ? [] : stressTest(x)), [x, documented]);
  const code = encodeScenario(shown);

  useEffect(() => {
    if (params.get("fs") !== code) navigate({ fs: code }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const school = PF.dabs.destinations.find((d) => d.id === "school_meals")!;
  const ut = spendingRanks("states").find((s) => s.usps === "UT")!;
  const utDc = spendingRanks("states_dc").find((s) => s.usps === "UT")!;
  const selected = PF.dabs.destinations.find((d) => d.id === dest)!;
  const selectedLaw = PF.law.find((l) => l.rule_id === selected.statute);
  const fy306 = PF.law.find((l) => l.rule_id === "UT-32B-2-306-3")?.fy2025;

  const ranks = spendingRanks(jur);
  const series = (s: { series: Record<string, number | null> }) => {
    const v = s.series[year] ?? null;
    return real ? inFy2024Dollars(v, year) : v;
  };
  const yearRows = ranks
    .map((s) => ({ usps: s.usps, name: s.name, value: series(s as unknown as { series: Record<string, number | null> }) }))
    .sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
  const usYear = real ? inFy2024Dollars((PF.education.us.series as Record<string, number | null>)[year] ?? null, year) : ((PF.education.us.series as Record<string, number | null>)[year] ?? null);
  const covered = yearRows.filter((r) => r.value !== null).length;
  const utYearRank = yearRows.filter((r) => r.value !== null).findIndex((r) => r.usps === "UT") + 1;
  const naep = PF.education.naep[assessment];
  const naepBy = naep.byJurisdiction as Record<string, { score: number; vsNation: string | null }>;
  const utSeries = PF.education.states.find((s) => s.usps === "UT")!.series as Record<string, number | null>;
  const usSeries = PF.education.us.series as Record<string, number | null>;

  const sys = PF.districts.systems.find((d) => d.ncesId === district)!;
  const arrangementDef = ARRANGEMENTS.find((a) => a.id === x.arrangement)!;
  const rec = bottleReceipt(shown);
  const recTotal = rec.reduce((a, b) => a + b.v, 0);
  const questions = openQuestions(answers);

  const destRows: Row[] = PF.dabs.destinations.map((d) => ({ Destination: d.label, "FY2025 ($M)": Number((d.amount / 1e6).toFixed(3)), Restricted: d.restricted ? "yes" : "no", Statute: d.statute ? PF.law.find((l) => l.rule_id === d.statute)?.citation ?? d.statute : "not identified" }));
  const bridgeRows: Row[] = PF.dabs.bridge.map((b) => ({ Step: b.label, "$M": Number((b.amount / 1e6).toFixed(3)), Kind: b.kind }));
  const spendRows: Row[] = yearRows.map((s, i) => ({ Rank: s.value === null ? "—" : i + 1, State: s.name, [`FY${year} per pupil ($${real ? ", FY2024 dollars" : ""})`]: s.value === null ? null : Math.round(s.value) }));
  const programRows: Row[] = r.programs.map((p) => ({ Program: p.label, "Per $ that moves": cents(p.perDollar), "Today ($M)": p.baseline === null ? "Undetermined" : Number((p.baseline / 1e6).toFixed(2)), "After ($M)": p.after === null ? "Undetermined" : Number((p.after / 1e6).toFixed(2)), Change: signed(p.delta), "Kept whole": COND[p.financiallyProtected].label, "Routing specified": COND[p.legallySpecified].label }));
  const mapRows: Row[] = x.arrangement === "A" ? [] : priceRevenueMap(x.arrangement, shown.savings, shown.distribution).filter((p) => p.grocerMargin === 0.1 || p.grocerMargin === 0.25 || p.price === 1).map(mapRow);

  const copyLink = async () => {
    const url = `${location.origin}${location.pathname}?v=funding&fs=${code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied("Link copied.");
    } catch {
      setCopied(`Copy this link: ${url}`);
    }
  };

  return (
    <article className="funding">
      <section className="panel" aria-labelledby="pf-overview">
        <p className="finding-tag">Public Funding</p>
        <h2 id="pf-overview">What does a bottle of wine fund?</h2>
        <p className="lede">
          Follow Utah's alcohol revenue from the shelf to public programs, and explore what different wine retail systems could change.
        </p>
        <p className="small muted">
          The financial baseline below describes all of DABS's liquor sales (spirits, wine and heavy beer). The Revenue Lab examines changes
          to the wine retail channel only. These are different totals and are labeled separately throughout.
        </p>
        <ul className="finding-cards">
          <li>
            <h3>State liquor sales</h3>
            <p>
              <strong>{musd(PF.dabs.sales, 2)}</strong> in FY{PF.dabs.fiscalYear}, as DABS reported it (all liquor; unaudited).
            </p>
          </li>
          <li>
            <h3>Six listed destinations</h3>
            <p>
              <strong>{musd(PF.dabs.destinationsSum, 1)}</strong>: the sum of the six amounts DABS lists, including {musd(PF.dabs.destinations.find((d) => d.id === "sales_tax")!.amount)} of sales tax its buyers paid. Not a profit figure.
            </p>
          </li>
          <li>
            <h3>School meals</h3>
            <p>
              <strong>{musd(school.amount, 1)}</strong> deposited for school meals in FY2025. By law 10% of DABS's gross liquor revenue goes to the
              Uniform School Fund for the school meals program (Utah Code 32B-2-304(5)).
            </p>
          </li>
          <li>
            <h3>School spending</h3>
            <p>
              <strong>{usd0(ut.ppcs)}</strong> current spending per pupil in FY2024: {ut.rank}th of {ut.of} states (Census). A spending measure, not a
              ranking of school quality.
            </p>
          </li>
        </ul>
        <p className="small muted">Source years differ because public-finance and education data are released on different schedules.</p>
        <nav aria-label="Chapters" className="no-print">
          <ol className="inline-list">
            {CHAPTERS.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`}>{label}</a>
              </li>
            ))}
          </ol>
        </nav>
      </section>

      <section className="panel" aria-labelledby="pf-dollar">
        <h2 id="pf-dollar">Where does the money go?</h2>
        <p>
          State alcohol revenue is not one tax. Utah's system combines retail sales, markups, statutory deposits, operating costs and transfers
          to public accounts. Select a destination to see its source and legal restrictions.
        </p>
        <p className="small">
          <strong>Markup vs. tax.</strong> A markup is the difference between selling price and acquisition cost. Utah's minimum wine markup is
          88.5% <em>on landed cost</em>, which is a {pct(0.885 / 1.885, 1)} margin on the selling price; it is not net profit, and it is not a sales tax.
        </p>
        <ChartFigure
          id="pf-dest-chart"
          title={`DABS lists ${musd(PF.dabs.destinationsSum)} going to six destinations in FY2025; the General Fund's ${musd(PF.dabs.destinations[0].amount)} is the largest`}
          subtitle="$ millions, fiscal year 2025 (July 2024 to June 2025), all liquor; teal restricted to a purpose, red unrestricted or collected for the Tax Commission"
          reading={<>Each bar is one amount from DABS's Summary Financial Information. The amounts are listed side by side, not as shares of a whole: sales tax is paid by buyers on top of prices, and the others come out of DABS's revenue.</>}
          readingText="Each bar is one amount from DABS's Summary Financial Information. The amounts are listed side by side, not as shares of a whole: sales tax is paid by buyers on top of prices, and the others come out of DABS's revenue."
          limits={<>Unaudited; transcribed by hand and not reviewed by a person. All liquor, not wine. The enforcement and school-meals amounts DABS reports differ from the statutory rates times its sales (below).</>}
          limitsText="Unaudited; transcribed by hand and not reviewed by a person. All liquor, not wine. The enforcement and school-meals amounts DABS reports differ from the statutory rates times its sales."
          source={DABS_SRC}
          methods={`${PUBLIC_FUNDING_METHOD} (scripts/public_funding.py)`}
          filename="dabs_fy2025_destinations"
          csv={csvOf(destRows)}
          table={tableOf(destRows, "FY2025 amounts DABS lists as going to each destination")}
        >
          {(width) => <DestinationBars width={width} selected={dest} pick={setDest} tips={destRows} />}
        </ChartFigure>
        <div className="row-actions no-print" role="group" aria-label="Choose a destination">
          {PF.dabs.destinations.map((d) => (
            <button key={d.id} type="button" aria-pressed={d.id === dest} onClick={() => setDest(d.id)}>
              {d.label}
            </button>
          ))}
        </div>
        <div className="callout" aria-live="polite">
          <h3>{selected.label}</h3>
          <p>
            <strong>{musd(selected.amount, 3)}</strong> in FY2025 ({selected.locator}). {selected.restricted ? "Restricted to its purpose." : "Not restricted by the deposit sections."}{" "}
            {selectedLaw ? (
              <>
                {selectedLaw.citation} ({selectedLaw.title}, version effective {selectedLaw.effective_from}): &ldquo;{selectedLaw.quote}&rdquo;
              </>
            ) : selected.id === "sales_tax" ? (
              "Sales tax DABS collects from its buyers and remits; it is set by the sales tax statutes (Title 59, Chapter 12), not by the liquor deposit sections, which this ledger did not read."
            ) : (
              "The statute behind this transfer was not identified in this ledger; it is shown as DABS reports it."
            )}
          </p>
          {selected.id === "school_meals" && (
            <p className="small">
              10% of FY2025 sales is {musd(0.1 * PF.dabs.sales, 2)}; DABS reports {musd(selected.amount, 2)}. The difference is not explained on these
              pages. School meals have other funding too: in FY2024 Utah received {PF.meals.fy2024.federalWords} in federal school-meal funds, and the
              Legislature appropriated {PF.meals.fy2024.liquorWords} from liquor revenue. Liquor money does not pay for all school meals.
            </p>
          )}
          {selected.id === "enforcement" && <p className="small">1.695% of FY2025 sales is {musd(0.01695 * PF.dabs.sales, 2)}; DABS reports {musd(selected.amount, 2)}.</p>}
          {selected.id === "parents_empowered" && (
            <p className="small">
              The current section deposits 0.6% of liquor revenue from two fiscal years earlier: 0.6% of FY2023 sales is {musd(0.006 * PF.dabs.sales2023, 3)}; DABS reports {musd(selected.amount, 3)}. The version in force through FY2025 (effective {fy306?.effective_from}, superseded {fy306?.superseded}) has the same subsection (3).
            </p>
          )}
        </div>
        <h3>The FY2025 income statement, step by step</h3>
        <p>
          DABS's page 30 statement closes exactly: sales less the cost of liquor, plus other income, less operating expenses and nonoperating
          items, leaves the net profit transferred to the General Fund. {musd(-PF.dabs.bridge.find((b) => b.id === "nonop_rest")!.amount)} of nonoperating
          items is not itemized in this transcription; it is left unassigned rather than labeled a cost.
        </p>
        {tableOf(bridgeRows, `Income statement, FY2025 (${PF.dabs.bridgeLocator})`)}
        {PF.dabs.conflicts.length > 0 && (
          <p className="small">
            <strong>Two printings differ.</strong>{" "}
            {PF.dabs.conflicts.map((c) => `${c.label}: ${musd(c.page30, 3)} on page 30, ${musd(c.page32, 3)} on page 32`).join("; ")}. Both are kept; neither is
            corrected.
          </p>
        )}
      </section>

      <section className="panel" aria-labelledby="pf-education">
        <h2 id="pf-education">Utah versus America</h2>
        <p className="lede">Funding measures and student outcomes tell different parts of the story.</p>
        <p>
          In FY2024 Utah ranked {ut.rank}th of {ut.of} states in current public-school spending per pupil ({usd0(ut.ppcs)} against {usd0(PF.education.us.ppcs)}{" "}
          for the nation), according to the Census Bureau; counting the District of Columbia, as Census's own ranking table does, it is {utDc.rank}th of{" "}
          {utDc.of}. This is a spending comparison, not an overall school-quality ranking.
        </p>
        <div className="controls no-print">
          <Toggle label="Jurisdictions" value={jur} options={[["states", "50 states"], ["states_dc", "50 states and D.C."]]} set={setJur} />
          <Toggle label="Fiscal year" value={year} options={Object.keys(utSeries).map((y) => [y, y] as [string, string])} set={setYear} />
          <Toggle label="Dollars" value={real ? "real" : "nominal"} options={[["nominal", "As reported"], ["real", "FY2024 dollars (CPI-U)"]]} set={(v) => setReal(v === "real")} />
        </div>
        <ChartFigure
          id="pf-spend-chart"
          title={`Utah is ${utYearRank}th of ${covered} in current spending per pupil in FY${year}`}
          subtitle={`$ per enrolled pupil, ${real ? "in FY2024 dollars" : "as reported (nominal)"}, public elementary-secondary school systems; ${jur === "states" ? "50 states" : "50 states and D.C."}, highest first`}
          reading={<>Each bar is a {jur === "states" ? "state" : "state or D.C."}; Utah is red; the dashed line is the national figure.</>}
          readingText="Each bar is a state (or D.C.); Utah is red; the dashed line is the national figure."
          limits={<>Not adjusted for differences in costs between states. Current spending excludes buildings and debt. Spending is an input, not a result; it does not show how much a dollar more would change learning. {PF.education.enrollmentNote}</>}
          limitsText={`Not adjusted for differences in costs between states. Current spending excludes buildings and debt. Spending is an input, not a result. ${PF.education.enrollmentNote}`}
          source={`${CENSUS_SRC}${real ? `; BLS CPI-U ${PF.education.cpi.basis}` : ""}`}
          methods={`${PUBLIC_FUNDING_METHOD}`}
          filename={`per_pupil_spending_fy${year}`}
          csv={csvOf(spendRows)}
          table={tableOf(spendRows, "Current spending per pupil by state, fiscal year 2024, highest first")}
        >
          {(width) => <SpendingBars width={width} rows={yearRows} us={usYear} year={year} tips={spendRows} />}
        </ChartFigure>
        {tableOf(
          Object.keys(utSeries).map((y) => ({ "Fiscal year": y, "Utah ($)": utSeries[y] === null ? null : Math.round(utSeries[y]!), "United States ($)": usSeries[y] === null ? null : Math.round(usSeries[y]!), "Utah as a share of the nation": utSeries[y] && usSeries[y] ? pct(utSeries[y]! / usSeries[y]!, 1) : null })),
          "Utah and the nation, current spending per pupil, as reported (Census Table 20)",
        )}
        <h3>Student results: NAEP 2024</h3>
        <p>
          Utah's public-school students scored significantly higher than the national public-school average on{" "}
          {naepHigher === naepAll.length ? "every one of the" : `${naepHigher} of the ${naepAll.length}`} 2024 assessments below, by NCES's own
          significance tests. Spending and scores are separate measures: neither, alone or together, shows how an additional dollar would change
          achievement.
        </p>
        {tableOf(
          Object.entries(PF.education.naep).map(([, a]) => {
            const b = a.byJurisdiction as Record<string, { score: number; vsNation: string | null }>;
            return { Assessment: a.label, Utah: b.UT.score, "National public": b.NP.score, "NCES test": b.UT.vsNation === "higher" ? "Utah higher" : b.UT.vsNation === "lower" ? "Utah lower" : "Not significantly different" };
          }),
          "Average scale scores, public school students, 2024",
        )}
        <p className="small muted">Source: {NAEP_SRC}.</p>
        <details>
          <summary>Every state on one assessment</summary>
          <div className="controls no-print">
            <Toggle label="Assessment" value={assessment} options={Object.entries(PF.education.naep).map(([k, a]) => [k as NaepKey, a.label] as [NaepKey, string])} set={setAssessment} />
          </div>
          {tableOf(
            PF.education.states
              .filter((s) => jur === "states_dc" || s.isState)
              .map((s) => ({ State: s.name, Score: naepBy[s.usps]?.score ?? null, "Against the nation (NCES test)": naepBy[s.usps]?.vsNation === "higher" ? "higher" : naepBy[s.usps]?.vsNation === "lower" ? "lower" : naepBy[s.usps] ? "not different" : "not available" }))
              .sort((a, b) => (b.Score ?? 0) - (a.Score ?? 0)),
            `${naep.label}, 2024 (national public ${naepBy.NP.score})`,
          )}
        </details>
      </section>

      <section className="panel lab" aria-labelledby="pf-lab">
        <h2 id="pf-lab">Could changing the retail channel preserve public funding?</h2>
        <p>
          Explore the tradeoffs among net public receipts, grocery margins and the final price paid for the same bottle. Every figure comes from the
          project's design engine ({POLICY_DESIGNS_METHOD}); this page adds the per-program ledger. The wine that moves is valued at today's
          state-store prices.
        </p>
        {linkBad && <p className="callout">The scenario in this link was not valid, so the page shows the default scenario.</p>}
        <div className="controls no-print">
          <Toggle label="Arrangement" value={x.arrangement} options={ARRANGEMENTS.map((a) => [a.id, `${a.label} (${a.status})`] as [Arrangement, string])} set={(v) => set({ arrangement: v })} />
          {x.arrangement !== "A" && (
            <>
              <Slider label="Shelf price against today" value={x.price} min={BOUNDS.price[0]} max={1.5} step={0.01} show={(v) => (Math.abs(v - 1) < 1e-9 ? "the same as today" : `${v > 1 ? "+" : "−"}${pct(Math.abs(v - 1))}`)} set={(v) => set({ price: v })} />
              <Slider label="Grocer's gross margin" value={x.grocerMargin} min={0} max={0.4} step={0.01} show={(v) => pct(v)} set={(v) => set({ grocerMargin: v })} />
              {x.arrangement === "C" && <Slider label="Private wholesaler's margin" value={x.distribution} min={0} max={0.4} step={0.005} show={(v) => pct(v, 1)} set={(v) => set({ distribution: v })} />}
              <Slider label="Household wine purchases that move to grocers" value={x.share ?? DEFAULT_SHARE} min={0} max={1} step={0.01} show={(v) => pct(v)} set={(v) => set({ share: v })} disabled={documented} />
              <Slider label="New purchases in Utah (share of household wine)" value={x.additional} min={0} max={0.15} step={0.005} show={(v) => pct(v, 1)} set={(v) => set({ additional: v })} disabled={documented} />
              <Toggle label="DABS costs saved" value={x.savings} options={SAVINGS_CASES.map((s) => [s.id, SAV_SHORT[s.id]] as [SavingsCase, string])} set={(v) => set({ savings: v })} />
              <Toggle label="Earmarked deposits on the wine that moves" value={x.routing} options={ROUTINGS.map((o) => [o.id, o.label] as [typeof o.id, string])} set={(v) => set({ routing: v })} />
              <label className="check">
                <input type="checkbox" checked={x.fees} onChange={(e) => set({ fees: e.target.checked })} /> License fees cover the new administration
              </label>
            </>
          )}
          <label className="check">
            <input type="checkbox" checked={documented} onChange={(e) => setDocumented(e.target.checked)} /> Show documented inputs only
          </label>
          <button type="button" onClick={() => { setX(DEFAULT_INPUTS); setDocumented(false); }}>
            Reset
          </button>
        </div>
        <p className="small">
          <strong>{arrangementDef.label}.</strong> {arrangementDef.text} {x.arrangement !== "A" && ROUTINGS.find((o) => o.id === x.routing)!.text}
          {documented && " Documented inputs only: no store savings, no new purchases, and the share that moves is left unknown, because none of them is measured for Utah."}
        </p>
        {x.arrangement !== "A" && (
          <p className="small print-only">
            Inputs: shelf price {pct(shown.price - 1)} against today; grocer margin {pct(shown.grocerMargin)}
            {shown.arrangement === "C" && `; private wholesaler margin ${pct(shown.distribution, 1)}`}; share that moves{" "}
            {shown.share === null ? "unknown" : pct(shown.share)}; new purchases {pct(shown.additional, 1)}; {SAV_SHORT[shown.savings]};{" "}
            {ROUTINGS.find((o) => o.id === shown.routing)!.label.toLowerCase()}; license fees {shown.fees ? "cover" : "do not cover"} the new
            administration. Methods {PUBLIC_FUNDING_METHOD}, {POLICY_DESIGNS_METHOD}; scenario code {code}.
          </p>
        )}
        <div className="table-wrap">
          <table className="data">
            <caption>Conditions, {documented ? "documented inputs only" : "these inputs"}</caption>
            <tbody>
              <tr>
                <th scope="row">State revenue, all accounts</th>
                <td>
                  <Chip c={r.conditions.revenue} />
                </td>
                <td>{r.net === null ? `${cents(r.netPerDollar)} per $ that moves` : `${signed(r.net)} a year (${cents(r.netPerDollar)} per $ that moves)`}</td>
              </tr>
              <tr>
                <th scope="row">Shoppers pay no more than today</th>
                <td>
                  <Chip c={r.conditions.price} />
                </td>
                <td>{Math.abs(shown.price - 1) < 1e-9 ? "The same shelf price" : `${shown.price > 1 ? "+" : "−"}${pct(Math.abs(shown.price - 1))} against a state store`}</td>
              </tr>
              <tr>
                <th scope="row">Every earmarked program kept whole</th>
                <td>
                  <Chip c={r.conditions.programs} />
                </td>
                <td>School meals, enforcement and the underage drinking campaign, each tested on its own</td>
              </tr>
              <tr>
                <th scope="row">Grocer's margin</th>
                <td>
                  <Chip c={r.conditions.grocer} />
                </td>
                <td>{pct(shown.grocerMargin)} gross; grocery stores average about {pct(RETAILER_TARGET)} on all they sell (Census)</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="visually-hidden" aria-live="polite">
          {`State revenue: ${COND[r.conditions.revenue].label}${r.net === null ? "" : `, ${signed(r.net)} a year`}. Shoppers pay no more: ${COND[r.conditions.price].label}. Programs kept whole: ${COND[r.conditions.programs].label}. Grocer's margin: ${COND[r.conditions.grocer].label}.`}
        </p>
        {r.missing.length > 0 && (
          <ul className="small">
            {r.missing.map((m) => (
              <li key={m}>We cannot evaluate this fully: {lowerFirst(m)}</li>
            ))}
          </ul>
        )}
        <h3>One bottle: who gets each part of the price</h3>
        {tableOf(
          rec.map((p) => ({ "Part of the price": p.who, "Per $1 of today's price": `$${p.v.toFixed(3)}` })).concat([{ "Part of the price": "The shopper pays", "Per $1 of today's price": `$${recTotal.toFixed(3)}` }]),
          `${arrangementDef.label}: per $1 of today's state-store price before tax, with sales tax at ${pct(T.salesTax, 2)}`,
        )}
        <h3>What each program receives on the wine that moves</h3>
        {tableOf(programRows, "Earmarked deposits, today and under the scenario")}
        <p className="small">
          The programs' changes and the rest (the General Fund and other accounts, {signed(r.rest)}) add up to the state's net change: routing
          money to a program moves it between state accounts and adds none. The underage drinking campaign's deposit follows sales two years later.
          A private seller's sales do not pay the deposits unless a bill says so; 32B-2-304(6)(a) already makes package agencies at a
          manufacturing facility remit {pct(PACKAGE_AGENCY_REMITTANCE, 3)} of their revenue to the same three accounts.
        </p>
        {x.arrangement !== "A" && (
          <ChartFigure
            id="pf-map"
            title={x.arrangement === "B" ? "With DABS as the wholesaler, the same shelf price costs the state the grocer's margin unless savings or new sales cover it" : "With private distribution, the state's charge is what is left of the shelf price after the wholesaler's and grocer's margins"}
            subtitle={`Shelf price against today (across) by grocer gross margin (up); ${SAV_SHORT[shown.savings]}${x.arrangement === "C" ? `; private wholesaler margin ${pct(shown.distribution, 1)}` : ""}; license fees cover the new administration; no new purchases`}
            reading={<>Each cell is one price and margin. ✓: shoppers pay no more and the state is no worse off. P: shoppers pay no more, the state is behind. R: the state is no worse off, shoppers pay more. –: neither. ?: both met, at a grocer margin below the grocery-store average, which no measure shows a grocer can live on. ×: both met only because the grocer earns nothing. The outlined cell is the scenario.</>}
            readingText="Each cell is one price and margin. Check: shoppers pay no more and the state is no worse off. P: shoppers pay no more, the state is behind. R: the state is no worse off, shoppers pay more. Dash: neither. Question mark: both met, at a grocer margin below the grocery-store average, which no measure shows a grocer can live on. Cross: both met only because the grocer earns nothing. The outlined cell is the scenario."
            limits={<>Per dollar of wine that moves; new purchases, which the lab adds separately, would shift the boundary. Each cell is computed by the same tests as the conditions above.</>}
            limitsText="Per dollar of wine that moves; new purchases would shift the boundary. Each cell is computed by the same tests as the conditions above."
            source="Proof & Policy design engine; DABS FY2025 margin and FY2026 wine sales; Utah state sales tax"
            methods={`${PUBLIC_FUNDING_METHOD}; ${POLICY_DESIGNS_METHOD}`}
            filename={`price_revenue_map_${x.arrangement}`}
            csv={csvOf(mapRows)}
            table={tableOf(mapRows, "Shelf price and grocer margin: state revenue per dollar that moves, and which tests are met")}
            legend={
              <ul className="chart-legend small">
                {[...(Object.keys(REGION) as Region[]).map((k) => REGION[k]), UNPROVEN, NO_MARGIN].map((m) => (
                  <li key={m.sym}>
                    <span aria-hidden="true">{m.sym}</span> {m.label}
                  </li>
                ))}
              </ul>
            }
          >
            {(width) => <FeasibilityMap width={width} a={x.arrangement as "B" | "C"} savings={shown.savings} mark={shown} />}
          </ChartFigure>
        )}
        {stress.length > 0 && x.arrangement !== "A" && (
          <>
            <h3>Stress test</h3>
            <p className="small">
              The state's net change at this price and margin when the unmeasured inputs vary: the share that moves from 5% to 60% and new purchases
              from 0% to 5%. Range endpoints are conditional sensitivity results, not statistically estimated confidence intervals.
            </p>
            {tableOf(stress.map((s) => ({ "DABS costs saved": SAV_SHORT[s.savings], "License fees cover administration": s.fees ? "yes" : "no", Lowest: signed(s.min), "at (share, new)": `${pct(s.minAt.share)}, ${pct(s.minAt.additional, 1)}`, Highest: signed(s.max), "at (share, new) ": `${pct(s.maxAt.share)}, ${pct(s.maxAt.additional, 1)}` })), "State net change a year as the share that moves and new purchases vary")}
          </>
        )}
        <HowWeKnow
          claim="what each design does to the state's revenue and to each earmarked program, at the inputs chosen."
          inputs="DABS's FY2025 gross margin on all liquor (applied to wine), DABS's FY2026 wine sales, the state sales tax rate, the deposit rates in Utah Code 32B-2-304(5), -305(4) and -306(3)."
          assumptions="The share that moves, new purchases, DABS savings, the grocer and wholesaler margins and the routing of the deposits are choices or assumptions, not measurements."
          calculation="The design engine's closed form gives the state's net change per $ that moves; each program receives its rate times its base (DABS's sales, the grocery sale, or nothing); the rest is the difference."
          output="Net change a year, per-program change, four conditions."
          period="FY2025 and FY2026 inputs; law as read 2026-11-20."
          limits="Not a forecast or a fiscal note; nothing here estimates how many shoppers would move. Legal readings are not legal advice."
          reproduce="web/src/lib/publicFunding.ts (fundingScenario), tested in publicFunding.test.ts against the purchase-flow engine and the designs report."
        />
        <div className="row-actions no-print">
          <button type="button" onClick={copyLink}>
            Copy share link
          </button>
          <button type="button" onClick={() => saveFile("funding_scenarios.json", scenarioJson(shown), "application/json")}>
            Download this scenario (JSON)
          </button>
          <button type="button" onClick={() => window.print()}>
            Print report
          </button>
          <span aria-live="polite" className="small">
            {copied}
          </span>
        </div>
      </section>

      <section className="panel" aria-labelledby="pf-protect">
        <h2 id="pf-protect">What happens to programs that already depend on the proceeds?</h2>
        <p>
          Existing Utah laws specify transfers from DABS liquor sales. If qualifying grocery sales bypass that transaction, a replacement would need to be
          identified and evaluated. The tool checks whether a proposal specifies key collection and protection provisions; it does not determine legal
          validity.
        </p>
        {lawIsStale(PF.law[0].as_of, new Date()) && (
          <p className="callout">
            This law ledger was read on {PF.law[0].as_of}, more than six months ago. Check the Utah Code for later changes before relying on it.
          </p>
        )}
        <div className="table-wrap">
          <table className="data">
            <caption>Law ledger: current law as read on {PF.law[0].as_of} (machine-assisted; not reviewed by a person)</caption>
            <thead>
              <tr>
                <th scope="col">Section</th>
                <th scope="col">What it does</th>
                <th scope="col">Base and rate</th>
                <th scope="col">Account</th>
                <th scope="col">Status</th>
                <th scope="col">In force during FY2025</th>
              </tr>
            </thead>
            <tbody>
              {PF.law.map((l) => (
                <tr key={l.rule_id}>
                  <td>
                    <a href={l.source.url} rel="noreferrer">
                      {l.citation}
                    </a>
                    <br />
                    <span className="small muted">effective {l.effective_from}</span>
                  </td>
                  <td>
                    {l.title}. <span className="small">&ldquo;{l.quote}&rdquo;</span>
                  </td>
                  <td>
                    {l.calculation_base}
                    {l.rate !== null && `: ${pct(l.rate, 3)} (${l.rate_basis})`}
                  </td>
                  <td>{l.beneficiary}</td>
                  <td>
                    <span className="tag">Current law</span>
                    <br />
                    <span className="small muted">as read {l.as_of}</span>
                  </td>
                  <td className="small">
                    {l.fy2025 ? (
                      <>
                        Same words in the{" "}
                        <a href={l.fy2025.source.url} rel="noreferrer">
                          version effective {l.fy2025.effective_from}
                        </a>
                        {l.fy2025.superseded ? `, superseded ${l.fy2025.superseded}` : ", still current"}
                      </>
                    ) : (
                      `This version took effect ${l.effective_from}, inside FY2025; the earlier version was not found, so FY2025 before that date is not checked.`
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3>A recent bill: {PF.meals.sb180.bill}</h3>
        <p>
          <span className="tag tag-assumption">Not enacted</span> {PF.meals.sb180.summary} Status read from the{" "}
          <a href={PF.meals.sb180.readFrom} rel="noreferrer">
            legislature's bill page
          </a>{" "}
          on {PF.meals.sb180.readOn}. Its fiscal note says the FY2027 base appropriation for school meals from liquor sales is {musd(PF.meals.fy2027LiquorBase)}.
        </p>
        {tableOf(PF.meals.sb180.timeline.map((t) => ({ Date: t.date, Action: t.action, Where: t.location, Vote: t.vote || "—" })), "S.B. 180 (2026) history")}
        <h3>Bill completeness checklist</h3>
        <p className="small">
          Mark each item for a proposal you are reading. The result is a list of questions to ask a drafter, not a legal verdict and not bill language.
        </p>
        <div className="table-wrap">
          <table className="data">
            <caption className="visually-hidden">Bill completeness checklist</caption>
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Answer</th>
              </tr>
            </thead>
            <tbody>
              {CHECKLIST.map((c) => (
                <tr key={c.id}>
                  <th scope="row">
                    {c.item}
                    <br />
                    <span className="small muted">{c.ask}</span>
                  </th>
                  <td>
                    <select aria-label={`${c.item}: answer`} value={answers[c.id] ?? ""} onChange={(e) => setAnswers((a) => ({ ...a, [c.id]: e.target.value as ChecklistAnswer }))}>
                      <option value="">Not answered</option>
                      <option value="specified">Specified</option>
                      <option value="missing">Missing</option>
                      <option value="ambiguous">Ambiguous</option>
                      <option value="not_applicable">Not applicable</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          <strong>{questions.length} open questions</strong>
          {questions.length > 0 && ":"}
        </p>
        <ol className="small">
          {questions.map((q) => (
            <li key={q.id}>
              {q.ask} <span className="muted">({q.answer.replace("_", " ")})</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="panel" aria-labelledby="pf-value">
        <h2 id="pf-value">Put a dollar amount in context</h2>
        <p>
          Compare a hypothetical annual change in net receipts with the scale of selected public programs. The comparison is not a forecast, commitment or
          new appropriation, and the amount is not necessarily legally available for that purpose.
        </p>
        <div className="controls no-print">
          <Slider label="Hypothetical amount a year" value={amount} min={0} max={25_000_000} step={250_000} show={(v) => musd(v, 2)} set={setAmount} />
          <label>
            Or type an amount ($){" "}
            <input type="number" min={0} max={25_000_000} step={1000} value={amount} onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v >= 0 && v <= 25_000_000) setAmount(v); }} />
          </label>
        </div>
        {tableOf(
          COMPARATORS.map((c) => ({ Comparator: c.label, Year: c.year, "Base amount": c.amount === null ? "Not available" : c.unit === "units" ? (c.amount < 100 ? `$${c.amount.toFixed(2)}` : usd0(c.amount)) : musd(c.amount, 1), [`${musd(amount, 2)} is`]: compareWords(amount, c), Note: c.note, Source: c.source })),
          `${musd(amount, 2)} a year against sourced amounts`,
        )}
      </section>

      <section className="panel" aria-labelledby="pf-local">
        <h2 id="pf-local">What does public funding look like in your community?</h2>
        <p>
          District-level school finances from Census's FY2024 survey. Statewide alcohol revenues are not assigned to a particular school or county
          unless an actual funding allocation rule establishes that connection.
        </p>
        <div className="controls no-print">
          <label>
            School district{" "}
            <select value={district} onChange={(e) => setDistrict(e.target.value)}>
              {PF.districts.systems.map((d) => (
                <option key={d.ncesId} value={d.ncesId}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {tableOf(
          [
            { Measure: "Fall enrollment", Value: n0(sys.enrollment) },
            { Measure: "Current spending", Value: musd(sys.currentSpending, 1) },
            { Measure: "Current spending per pupil (computed)", Value: sys.perPupil === null ? "—" : usd0(sys.perPupil) },
            { Measure: "Current expenditures per pupil, USBE's own measure", Value: "usbePerPupil" in sys ? usd0(sys.usbePerPupil) : "Not reported by USBE" },
            { Measure: "Revenue: federal", Value: `${musd(sys.revenue.federal, 1)} (${pct(sys.revenue.federal / sys.revenue.total)})` },
            { Measure: "Revenue: state", Value: `${musd(sys.revenue.state, 1)} (${pct(sys.revenue.state / sys.revenue.total)})` },
            { Measure: "Revenue: local", Value: `${musd(sys.revenue.local, 1)} (${pct(sys.revenue.local / sys.revenue.total)})` },
            { Measure: "Alcohol revenue attributable to this district", Value: "Not estimable" },
          ],
          `${sys.name}, FY2024 (Census county code ${sys.countyFips})`,
        )}
        <p className="small">
          A district-specific alcohol-revenue impact cannot be estimated from the available data: the local wine sales and apportionment rules it would need
          are not verified. Small districts have high fixed costs, so per-pupil spending is not comparable across districts of very different size.{" "}
          {PF.districts.note} {PF.districts.usbe.note}
        </p>
      </section>

      <section className="panel" aria-labelledby="pf-states">
        <h2 id="pf-states">What happened in Tennessee and Colorado?</h2>
        <p>
          Both states let grocery stores sell wine: Tennessee in 2016 and Colorado in 2023. Both are license states, where private wholesalers sell wine to
          stores and the state taxes each gallon or liter. Utah's money arrives another way, so this compares how the systems work and what was
          measured afterward. Nothing here estimates an effect of either change, and nothing from these states enters the Revenue Lab.
        </p>
        {tableOf(
          stateComparison().map((r) => ({ Measure: r.label, Utah: r.values.UT, Tennessee: r.values.TN, Colorado: r.values.CO, Source: r.source })),
          "Utah, Tennessee and Colorado: how wine reaches shoppers and how each state takes its share",
        )}
        {STATE_CASES.filter((s) => s.id === "tn" || s.id === "co").map((s) => (
          <div key={s.id}>
            <h3>
              {s.state}, {s.date}: {s.change.charAt(0).toLowerCase() + s.change.slice(1)}
            </h3>
            {s.id === "tn" ? (
              <>
                <p>
                  Tennessee's wine-tax account took in {musd(tnFy2017.amount, 1)} in FY2017, the first full year of food-store licenses:{" "}
                  {pct(PF.states.tennessee.fy2017OverAverage, 1)} above its FY2012&ndash;FY2016 average, in dollars of each year. It had already risen{" "}
                  {pct(tnFy2016.amount / tnFy2015.amount - 1, 1)} in FY2016, before the first license. From FY2018 the same account also carries high-alcohol
                  beer, so later years are a different measure and are not joined to the earlier ones.
                </p>
                {tableOf(
                  PF.states.tennessee.account11002.map((a) => ({ "Fiscal year": `FY${a.fy}`, "Account 11002, as printed": a.label, Collections: musd(a.amount, 2) })),
                  "Tennessee account 11002 collections by fiscal year (July to June), as printed in each June Summary of Collections",
                )}
                <p className="small">
                  Collections are cash received in each fiscal year, before any distribution to local governments, from wine sold by every kind of store; no
                  account separates wine sold by food stores. The <Go to={{ v: "case" }} reset>Tennessee worked example</Go> compares these years in
                  constant dollars and against the neighboring states.
                </p>
              </>
            ) : (
              <p>
                No government or peer-reviewed evaluation of Colorado's change was found, and the Department of Revenue's liquor pages refused
                automated access, so no tax receipts are shown. NIAAA's figures put wine bought per Colorado resident 21+ at{" "}
                {cons.CO[2022].wine.toFixed(3)} gallons of ethanol in 2022 and {cons.CO[2024].wine.toFixed(3)} in 2024, {lowerOrHigher(cons.CO[2024].wine / cons.CO[2022].wine - 1)};
                the national figure was {lowerOrHigher(cons.US[2024].wine / cons.US[2022].wine - 1)} over the same years. Two years, with no comparison states,
                cannot separate the change from the national trend.
              </p>
            )}
            <p className="small">
              <strong>Also changed at the same time:</strong> {s.concurrent}
            </p>
            <p className="small">
              <strong>Why it does not transfer to Utah:</strong> {s.applies}
            </p>
          </div>
        ))}
        {tableOf(
          (["UT", "TN", "CO", "US"] as const).map((k) => ({
            Place: STATE_NAME[k],
            ...Object.fromEntries(PF.states.consumption.years.map((y) => [String(y), cons[k][y].wine.toFixed(3)])),
          })),
          "Wine bought per resident 21+, gallons of ethanol (NIAAA apparent consumption: sales and shipments, not drinking)",
        )}
        <h3>What these comparisons cannot show</h3>
        <ul className="small">
          <li>Whether either change caused anything. Both states chose to change, other laws changed at the same time, and nothing here holds the rest equal.</li>
          <li>
            What Utah would collect. Tennessee and Colorado tax each gallon or liter whoever sells it; Utah's revenue is DABS's margin on the wine
            DABS sells. A rise in their receipts says nothing about what Utah keeps when a bottle leaves DABS; the Revenue Lab computes that from Utah's
            own terms.
          </li>
          <li>
            How much wine would move in Utah. Utah adults bought {cons.UT[lastYear].wine.toFixed(3)} gallons of wine ethanol each in {lastYear}, against{" "}
            {cons.US[lastYear].wine.toFixed(3)} nationally, so a percentage seen elsewhere starts from a different base, and drinking habits differ too.
          </li>
          <li>What people drank. NIAAA counts sales and shipments in each state, so buying across a state line moves the count too.</li>
        </ul>
        <p className="small">
          Published studies of both states, labeled by the strength of their evidence, are on the <Go to={{ v: "states" }} reset>Other States</Go> page.
        </p>
      </section>

      <section className="panel" aria-labelledby="pf-against">
        <h2 id="pf-against">What cuts the other way?</h2>
        <p>
          Published findings that point against this page's results, and the limits it states elsewhere, in one place. Each finding was read from its
          source on the date shown; none has been reviewed by a person.
        </p>
        <ol>
          {CONTRARY.map((c) => (
            <li key={c.id}>
              <p>{c.finding}</p>
              <p className="small">
                <strong>What it cuts against:</strong> {c.against}
              </p>
              <p className="small">
                <strong>How it differs from the designs here:</strong> {c.differs}
              </p>
              <p className="small">
                <a href={c.url}>{c.source}</a> (read {c.read})
              </p>
            </li>
          ))}
        </ol>
        <h3>Searched for and not found</h3>
        <ul className="small">
          <li>A measured account, in any state, of what happened to school money earmarked from liquor sales after a privatization.</li>
          <li>
            Results from Pennsylvania's 2016 wine permits, under which grocers buy their wine from the state: no grocery-channel revenue, volume or price
            comparison was found, though it is the closest working case of a state staying the wholesaler.
          </li>
          <li>A Utah estimate of how much drinking would change if grocers sold wine.</li>
        </ul>
        <h3>Limits this page states elsewhere</h3>
        <ul className="small">
          <li>It is not a forecast or a fiscal note; nothing here estimates how many shoppers would move.</li>
          <li>A grocer margin below the grocery average (about {pct(RETAILER_TARGET)}) is not shown to be workable: where both tests are otherwise met, the map marks it &ldquo;?&rdquo;.</li>
          <li>New purchases count as new drinking; beer revenue lost if some replace beer is subtracted only on the scenario page.</li>
          <li>The wording of 32B-2-301 in force before 2025-05-07 was not found, so that part of FY2025 is not checked.</li>
          <li>Legal readings are machine-assisted, not legal advice, and not reviewed by a person.</li>
          <li>No alcohol revenue can be assigned to a particular school district.</li>
        </ul>
      </section>

      <section className="panel" aria-labelledby="pf-evidence">
        <h2 id="pf-evidence">Every conclusion has a source, a method and a limit</h2>
        <p>
          Open any source to see its edition and fingerprint, or download the underlying tables. The project is independently maintained. {AI_DISCLOSURE}{" "}
          The modeling is not a government fiscal note and does not forecast outcomes.
        </p>
        <div className="row-actions no-print">
          <button type="button" onClick={() => saveFile("funding_observed.csv", observedCsv(), "text/csv")}>
            Observed figures (CSV)
          </button>
          <button type="button" onClick={() => saveFile("funding_source_ledger.csv", lawCsv(), "text/csv")}>
            Law ledger (CSV)
          </button>
          <button type="button" onClick={() => saveFile("education_metrics.csv", educationCsv(), "text/csv")}>
            Education measures (CSV)
          </button>
          <button type="button" onClick={() => saveFile("funding_scenarios.json", scenarioJson(shown), "application/json")}>
            This scenario (JSON)
          </button>
        </div>
        {tableOf(
          [PF.dabs.source, PF.education.source, PF.districts.source, PF.districts.usbe.source, PF.education.cpi.source, PF.meals.brief, PF.meals.fiscalNote, PF.meals.freeLunchReimbursement.source, PF.meals.sb180.text, ...Object.values(PF.education.naep).flatMap((a) => [a.source, a.sigSource]), ...PF.law.map((l) => l.source), ...PF.law.flatMap((l) => (l.fy2025 ? [l.fy2025.source] : [])), PF.states.tennessee.taxSource, PF.states.tennessee.actSource, ...PF.states.tennessee.account11002.map((a) => a.source), PF.states.colorado.source, PF.states.consumption.source]
            .filter((s, i, all) => all.findIndex((o) => o.asset === s.asset) === i)
            .map((s) => ({ Source: s.edition, Where: s.locator, Retrieved: s.retrieved, "SHA-256 (first 16)": s.sha16, Review: "Machine-assisted; not reviewed by a person" })),
          "Sources used on this page",
        )}
        <h3>Questions this page leaves open</h3>
        <ul className="small">
          <li>What share of DABS's public receipts comes from wine rather than all liquor?</li>
          <li>Which DABS operating costs would really be avoided if some wine sales moved?</li>
          <li>Which collection mechanism would replace the earmarked deposits, and would it hold if volumes were lower than expected?</li>
          <li>Can a grocer cover its costs with no increase in the shelf price?</li>
          <li>What would change these results under less favorable assumptions?</li>
        </ul>
        <p className="small">
          See also <Go to={{ v: "sameprice" }} reset>Same shelf price</Go>, <Go to={{ v: "designs" }} reset>Five designs compared</Go> and{" "}
          <Go to={{ v: "methods" }} reset>Definitions &amp; methods</Go>.
        </p>
      </section>
    </article>
  );
}
