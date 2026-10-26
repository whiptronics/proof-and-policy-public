// Utah wine revenue scenarios. The reader states the assumptions the dataset cannot supply; sourced and
// derived values are labelled as such; the model (lib/scenario.ts, SCENARIO_METHOD) keeps margins, taxes
// and costs apart and never counts shifted sales as new demand. Not a forecast.
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ErrorNote, Go, Loading, RecordLink } from "../components/common";
import { ArrangementComparison, type BaselineRow } from "../components/ArrangementComparison";
import { BuildNotice, SaveBar } from "../components/SaveBar";
import { statusOnDay } from "../lib/analysis";
import { toCsv, type Column } from "../lib/csv";
import { decodeMetric, useData, useMany, type DecodedMetric } from "../lib/data";
import { words } from "../lib/format";
import { SCENARIO_EXAMPLES as EXAMPLES, SCENARIO_METHOD, WORKED_PROPOSALS as PROPOSALS, breakEvenLever, compute, movedShare, stepsA, type BridgeStep, type Component, type DepositRates, type Lever, type ScenarioInputs, type WorkedProposal } from "../lib/scenario";
import { RANGES_METHOD, combinedScenarios, sensitivity, type Combined, type RangeFormat, type RangeOverrides, type Sensitivity } from "../lib/scenarioRanges";
import { ARRANGEMENTS_METHOD, SWEEPS, compare, settingsFromFields, type Bounds, type SweepKey } from "../lib/arrangements";
import { STATUTE_NOTE, WINE_MARGIN_METHOD, crossCheck, marginOfMarkup, STATUTORY_MARKUP } from "../lib/wineMargin";
import { WEIGHTING_LABEL, evidenceRanges, extensionSummary, impliedRows, impliedSpan, marginSpreadOf, type CostModel, type EvidenceInputs } from "../lib/costEvidence";
import type { Manifest, MetricFile, MetricMeta, MetricsIndex, MonthlyFile, MonthlyMeta, Obs, PolicyData, Reconciliation } from "../lib/types";
import { navigate, useParams, type Patch } from "../lib/url";

const UT = "state:49";
const M = {
  sales: "ut_dabs_liquor_sales_revenue@state_fiscal_year",
  gp: "ut_dabs_gross_profit@state_fiscal_year",
  opex: "ut_dabs_operating_nonoperating_expenses@state_fiscal_year",
  net: "ut_dabs_net_profit_general_fund@state_fiscal_year",
  dabsTax: "ut_dabs_sales_tax_reported@state_fiscal_year",
  gallons: "niaaa_beverage_gallons_wine@calendar_year",
  abvWine: "niaaa_time_varying_abv_wine@calendar_year",
  abvBeer: "niaaa_time_varying_abv_beer@calendar_year",
  t10: "stc_alcoholic_beverages_sales_tax@state_fiscal_year",
  audited: "ut_abs_fund_sales_revenue@state_fiscal_year",
  card: "ut_dabs_credit_card_fees@state_fiscal_year",
  delivery: "ut_dabs_delivery_to_stores@state_fiscal_year",
  agency: "ut_dabs_package_agency_contracts@state_fiscal_year",
  bags: "ut_dabs_liquor_bags@state_fiscal_year",
  wages: "ut_dabs_salaries_wages@state_fiscal_year",
  offPremise: "ut_dabs_off_premise_sales_share@state_fiscal_year",
} as const;
type Key = keyof typeof M;

/** Every input lives in the address as text, so a link or saved file restores it exactly. */
const FIELDS = ["fy", "wr", "w", "ws", "pg", "gal", "gm", "st", "vc", "nc", "s", "hh", "r", "rm", "rho", "exc", "av", "dc", "b", "g", "q", "sub", "k", "bas", "pb", "bt", "aw", "ab", "pt", "el", "rc", "ev", "eg", "cmp", "pc", "rt", "rtv", "rtp", "vw", "eb", "er", "ea", "gw", "gg", "sx"] as const;
type Field = (typeof FIELDS)[number];
type Draft = Record<Field, string>;


function blankDraft(): Draft {
  return Object.fromEntries(FIELDS.map((f) => [f, ""])) as Draft;
}

function readDraft(params: URLSearchParams): Draft {
  const d = blankDraft();
  for (const f of FIELDS) d[f] = params.get(f) ?? "";
  if (!["share", "gallons", "enter"].includes(d.wr)) d.wr = "share";
  if (!["keep", "excise", "percent", "combo", "wholesale"].includes(d.rm)) d.rm = "keep";
  if (!["", "spending", "volume", "ethanol"].includes(d.bas)) d.bas = "";
  if (!["percent", "excise"].includes(d.rt)) d.rt = "percent";
  if (!["private", "wholesale"].includes(d.eb)) d.eb = "private";
  // "today" (before 1.1) is the fixed guarantee.
  if (d.er === "today") d.er = "fixed";
  if (!["fixed", "proportional", "amount", "share"].includes(d.er)) d.er = "fixed";
  if (!["", "matched", "entered"].includes(d.pc)) d.pc = "";
  if (d.sx && !(d.sx in SWEEPS)) d.sx = "";
  return d;
}

const num = (s: string): number | null => {
  if (s.trim() === "") return null;
  const v = Number(s.replace(/[$,\s]/g, ""));
  return Number.isFinite(v) ? v : null;
};
const pctIn = (s: string) => {
  const v = num(s);
  return v === null ? null : v / 100;
};

interface Facts {
  fy: number;
  fyOptions: { fy: number; ok: boolean; why: string | null }[];
  sales: Obs | undefined;
  gp: Obs | undefined;
  opex: Obs | undefined;
  net: Obs | undefined;
  dabsTax: Obs | undefined;
  t10: Obs | undefined;
  /** The audited fund's sales (State of Utah ACFR): a cross-check of the baseline, never an input. */
  audited: Obs | undefined;
  cal: number | null;
  gallons: Obs | undefined;
  abvWine: Obs | undefined;
  abvBeer: Obs | undefined;
  beerTax: { value: number; day: string; policyId: string | null } | null;
  /** What the dataset can say about the ranges of two inputs (section 3), used when the reader asks for evidence-based ranges. */
  evidence: EvidenceInputs;
  /** The base year's documented bounds for the comparison's joint scenarios (null when an expense line is missing). */
  bounds: Bounds | null;
  /** DABS's off-premise share of its sales (all products, percent), the base year's or the nearest year's. */
  offPremise: Obs | undefined;
}

function facts(dec: Map<Key, DecodedMetric>, fyParam: string, pol: PolicyData): Facts {
  const ut = (k: Key) => (dec.get(k)?.obs ?? []).filter((o) => o.geo_id === UT);
  const sales = ut("sales");
  const gp = ut("gp");
  const years = [...new Set([...sales, ...gp].map((o) => o.year))].sort((a, b) => b - a);
  const fyOptions = years.map((fy) => {
    const s = sales.find((o) => o.year === fy);
    const g = gp.find((o) => o.year === fy);
    const ok = Boolean(s && s.value !== null && g && g.value !== null);
    const why = ok ? null : `${!s || s.value === null ? `liquor sales ${s ? words(s.missing_reason) : "not transcribed"}` : ""}${!g || g.value === null ? `${!s || s.value === null ? "; " : ""}gross profit ${g ? words(g.missing_reason) : "not transcribed"}` : ""}`;
    return { fy, ok, why };
  });
  const fy = fyOptions.find((o) => String(o.fy) === fyParam && o.ok)?.fy ?? fyOptions.find((o) => o.ok)?.fy ?? years[0];
  const at = (k: Key, y: number) => ut(k).find((o) => o.year === y && o.value !== null);
  // NIAAA is calendar-year: use the latest year that ends inside the fiscal year or before it.
  const calYears = ut("gallons").filter((o) => o.value !== null && o.year <= fy).map((o) => o.year);
  const cal = calYears.length ? Math.max(...calYears) : null;
  const day = `${fy - 1}-07-01`;
  const st = statusOnDay(pol.segments, UT, "beer_excise_tax_per_31gal_barrel", day, pol.as_of_date);
  const beerTax = st.kind === "known" && /^usd_[\d.]+$/.test(st.value) ? { value: Number(st.value.slice(4)), day, policyId: st.policyIds[0] ?? null } : null;
  return {
    fy,
    fyOptions,
    sales: at("sales", fy),
    gp: at("gp", fy),
    opex: at("opex", fy),
    net: at("net", fy),
    dabsTax: at("dabsTax", fy),
    t10: at("t10", fy),
    audited: at("audited", fy),
    cal,
    gallons: cal === null ? undefined : at("gallons", cal),
    abvWine: cal === null ? undefined : at("abvWine", cal),
    abvBeer: cal === null ? undefined : at("abvBeer", cal),
    beerTax,
    evidence: {
      opexShare: at("opex", fy)?.value != null && at("sales", fy)?.value ? at("opex", fy)!.value! / at("sales", fy)!.value! : null,
      marginSpread: marginSpreadOf(years.map((year) => ({ year, sales: sales.find((o) => o.year === year)?.value ?? null, gp: gp.find((o) => o.year === year)?.value ?? null }))),
    },
    bounds: boundsFor(fy, at, marginSpreadOf(years.map((year) => ({ year, sales: sales.find((o) => o.year === year)?.value ?? null, gp: gp.find((o) => o.year === year)?.value ?? null })))),
    offPremise: nearest(ut("offPremise"), fy),
  };
}

/** The observation for the base year, or else for the nearest year that has one (the later year on a tie). */
function nearest(obs: Obs[], fy: number): Obs | undefined {
  const ok = obs.filter((o) => o.value !== null);
  return ok.sort((a, b) => Math.abs(a.year - fy) - Math.abs(b.year - fy) || b.year - a.year)[0];
}

/** DABS's own accounts for the base year, as shares of its sales: the lines that move with sales (card fees, agency
 * contracts, bags), the same plus every salary, all operating expenses, delivery, and the range of reported margins. */
function boundsFor(fy: number, at: (k: Key, y: number) => Obs | undefined, spread: { low: number; high: number } | null): Bounds | null {
  const v = (k: Key) => at(k, fy)?.value ?? null;
  const sales = v("sales");
  const parts = [v("card"), v("agency"), v("bags"), v("wages"), v("delivery"), v("opex")];
  if (!sales || parts.some((p) => p === null) || !spread) return null;
  const [card, agency, bags, wages, delivery, opex] = parts as number[];
  return {
    avoidLow: (card + agency + bags) / sales,
    avoidHigh: (card + agency + bags + wages) / sales,
    avoidCeiling: opex / sales,
    delivery: delivery / sales,
    marginLow: spread.low,
    marginHigh: spread.high,
  };
}

type Basis = "sourced" | "derived" | "user" | "example" | "proposal";

const HOUSEHOLD_NOTE =
  "Only purchases for home could move to grocers; licensees (bars, restaurants, clubs) keep buying from DABS. DABS publishes no wine sales by customer type (a records request is drafted in docs/gaps/utah-missing-records.md, not sent).";

/** The annual DABS series is before sales tax by DABS's own Note B (FY2016, FY2019 and FY2021 reports, saved; the FY2025
 * report lists sales tax separately from sales without repeating the sentence), and the
 * audited and Census figures sit below it by the two statutory deposits (the school-meals deposit documented in the
 * ACFRs, the enforcement deposit inferred; docs/fiscal-reconciliation.md, reconciliation.json). The monthly shelf-price
 * totals are a separate question. */
const DABS_TAX_NOTE =
  "Before sales tax: DABS's reports say so in their Note B (\"Sales are reported at published prices; sales taxes excluded\", FY2016 and FY2019 reports; FY2021 report likewise). The FY2025 report lists sales tax separately from sales but does not repeat that sentence. The audited state report's lower figure is DABS's sales less the statutory school-meals deposit, which the state books in another fund, and the enforcement deposit (see Utah at a glance), not a sign that sales include tax.";
interface InputRow {
  label: string;
  value: number | null;
  unit: string;
  basis: Basis;
  source: ReactNode;
  note?: string;
}

function toInputs(d: Draft, f: Facts): { x: ScenarioInputs; rows: InputRow[] } {
  const user: Basis = PROPOSALS.some((p) => p.id === d.eg) ? "proposal" : d.eg ? "example" : "user";
  const rows: InputRow[] = [];
  const obsLink = (key: Key, o: Obs | undefined, label: string) =>
    o ? <RecordLink rec={`obs:${M[key]}:${o.observation_id}`}>{label}</RecordLink> : "not in the dataset";
  const G = num(d.gal) ?? f.gallons?.value ?? null;
  rows.push(
    num(d.gal) !== null
      ? { label: "Wine gallons sold per year", value: G, unit: "gallons", basis: user, source: "entered" }
      : { label: "Wine gallons sold per year", value: G, unit: "gallons", basis: "sourced", source: obsLink("gallons", f.gallons, `NIAAA, Utah, calendar ${f.cal}`), note: `Calendar ${f.cal}; the fiscal year is July ${f.fy - 1} to June ${f.fy}.` },
  );
  let W: number | null = null;
  if (d.wr === "enter") {
    W = num(d.w);
    rows.push({ label: "Baseline wine sales (state stores, before sales tax)", value: W, unit: "$ per year", basis: user, source: "entered" });
  } else if (d.wr === "share") {
    const share = pctIn(d.ws);
    rows.push({ label: "Wine's share of DABS liquor sales", value: share, unit: "share", basis: user, source: "entered; the dataset has no wine-only DABS sales" });
    W = share !== null && f.sales?.value != null ? share * f.sales.value : null;
    rows.push({
      label: "Baseline wine sales (state stores, as DABS reports sales)",
      value: W,
      unit: "$ per year",
      basis: "derived",
      source: <>share × {obsLink("sales", f.sales, `DABS liquor sales FY${f.fy}`)}</>,
      note: DABS_TAX_NOTE,
    });
  } else {
    const price = num(d.pg);
    rows.push({ label: "Average state-store price of wine", value: price, unit: "$ per gallon", basis: user, source: "entered" });
    W = price !== null && G !== null ? price * G : null;
    rows.push({ label: "Baseline wine sales (state stores, before sales tax)", value: W, unit: "$ per year", basis: "derived", source: "gallons × price per gallon" });
  }
  const derivedMargin = f.sales?.value && f.gp?.value != null ? f.gp.value / f.sales.value : null;
  const gm = pctIn(d.gm);
  rows.push(
    gm !== null
      ? { label: "Gross margin on wine", value: gm, unit: "share", basis: user, source: "entered" }
      : {
          label: "Gross margin on wine",
          value: derivedMargin,
          unit: "share",
          basis: "derived",
          source: <>{obsLink("gp", f.gp, `DABS gross profit`)} ÷ {obsLink("sales", f.sales, "liquor sales")}, FY{f.fy}</>,
          note: "All products (spirits, wine, heavy beer); wine's own margin may differ.",
        },
  );
  const m = gm ?? derivedMargin;
  const push = (label: string, value: number | null, unit: string) => rows.push({ label, value, unit, basis: user, source: value === null ? "needed" : "entered" });
  const t = pctIn(d.st);
  push("State sales tax rate on the shelf price", t, "share");
  const v = pctIn(d.vc);
  push("Avoidable state operating cost per $ of state-store sales", v, "share");
  const nc = num(d.nc);
  push("New state costs of licensing and enforcement", nc, "$ per year");
  const s = pctIn(d.s);
  push("Share of household wine purchases moving to grocery stores", s, "share");
  const hhEntered = pctIn(d.hh);
  const hhData = f.offPremise?.value != null ? f.offPremise.value / 100 : null;
  const hh = hhEntered ?? hhData;
  rows.push(
    hhEntered !== null
      ? { label: "Household share of wine sales (could move to grocers)", value: hh, unit: "share", basis: user, source: "entered", note: HOUSEHOLD_NOTE }
      : {
          label: "Household share of wine sales (could move to grocers)",
          value: hh,
          unit: "share",
          basis: hh === null ? user : "derived",
          source:
            hh === null ? (
              "needed"
            ) : (
              <>
                DABS's off-premise share of its sales, {obsLink("offPremise", f.offPremise, `annual report FY${f.offPremise!.year}, p. 18`)}
                {f.offPremise!.year !== f.fy ? ` (the only year published; the base year is FY${f.fy})` : ""}
              </>
            ),
          note: `All products, applied to wine: an assumption. ${HOUSEHOLD_NOTE}`,
        },
  );
  const r = pctIn(d.r);
  push("Grocery shelf price compared with the state store", r, "ratio");
  const pt = pctIn(d.pt);
  if (pt !== null) rows.push({ label: "Pass-through of the price gap to the shelf", value: pt, unit: "share", basis: user, source: "entered", note: "Scales the gap between the grocery and state-store price; blank counts all of it." });
  const mode = d.rm as ScenarioInputs["revenueMode"];
  const rho = pctIn(d.rho);
  const exc = num(d.exc);
  const av = pctIn(d.av);
  if (mode === "keep" || mode === "combo") push("Share of each grocery sales dollar the state keeps", rho, "share");
  if (mode === "excise" || mode === "combo") push("Excise on grocery wine", exc, "$ per gallon");
  if (mode === "percent" || mode === "combo") push("Tax on the grocery shelf price", av, "share");
  const dc = pctIn(d.dc);
  if (mode === "wholesale") push("Discount DABS gives grocers off its shelf price", dc, "share");
  const extra = d.b === "1";
  const sub = extra && d.sub === "1";
  const g = pctIn(d.g);
  const q = pctIn(d.q);
  const k = pctIn(d.k);
  const pb = num(d.pb);
  const el = num(d.el);
  const rc = pctIn(d.rc);
  if (extra) {
    push("Increase in total wine purchases from easier access (volume)", g, "share");
    push("Share of the extra wine bought in grocery stores", q, "share");
    if (el !== null) rows.push({ label: "Price elasticity of wine demand", value: el, unit: "elasticity", basis: user, source: "entered", note: "Nelson (2013), a meta-analysis: wine −0.46 after correcting for publication bias (95% CI −0.54 to −0.38; the abstract rounds it to −0.45); the uncorrected random-effects mean is −0.58." });
    if (rc !== null) rows.push({ label: "Cross-border recapture", value: rc, unit: "share", basis: user, source: "entered", note: "Share of baseline volume now bought outside Utah." });
  }
  const bt = num(d.bt) ?? f.beerTax?.value ?? null;
  const aw = pctIn(d.aw) ?? f.abvWine?.value ?? null;
  const ab = pctIn(d.ab) ?? f.abvBeer?.value ?? null;
  if (sub) {
    push("Share of the extra wine that replaces beer", k, "share");
    rows.push({ label: "What the substitution holds constant", value: null, unit: d.bas || "needed", basis: user, source: d.bas ? "chosen" : "needed" });
    push("Beer shelf price", pb, "$ per gallon");
    rows.push(
      num(d.bt) !== null
        ? { label: "Utah beer excise", value: bt, unit: "$ per barrel", basis: user, source: "entered" }
        : {
            label: "Utah beer excise",
            value: bt,
            unit: "$ per barrel",
            basis: "sourced",
            source: f.beerTax?.policyId ? <RecordLink rec={`policy:${f.beerTax.policyId}`}>coded Utah law in force {f.beerTax.day}</RecordLink> : "not verified for this date",
          },
    );
    if (d.bas === "ethanol") {
      rows.push(pctIn(d.aw) !== null ? { label: "Wine alcohol content", value: aw, unit: "share", basis: user, source: "entered" } : { label: "Wine alcohol content", value: aw, unit: "share", basis: "sourced", source: obsLink("abvWine", f.abvWine, `NIAAA ABV, calendar ${f.cal}`) });
      rows.push(pctIn(d.ab) !== null ? { label: "Beer alcohol content", value: ab, unit: "share", basis: user, source: "entered" } : { label: "Beer alcohol content", value: ab, unit: "share", basis: "sourced", source: obsLink("abvBeer", f.abvBeer, `NIAAA ABV, calendar ${f.cal}`) });
    }
  }
  const x: ScenarioInputs = {
    wineSales: W,
    wineGallons: G,
    grossMargin: m,
    salesTax: t,
    avoidableCost: v,
    newCosts: nc,
    shift: s,
    eligible: hh,
    priceRatio: r,
    revenueMode: mode,
    retained: rho,
    excise: exc,
    adValorem: av,
    discount: dc,
    extra,
    growth: g,
    extraGrocery: q,
    substitution: sub,
    replaces: k,
    basis: (d.bas || null) as ScenarioInputs["basis"],
    beerPrice: pb,
    beerTax: bt,
    wineAbv: aw,
    beerAbv: ab,
    elasticity: extra ? el : null,
    passThrough: pt,
    recapture: extra ? rc : null,
  };
  return { x, rows };
}

const money = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${v < 0 ? "−" : ""}$${Math.round(Math.abs(v)).toLocaleString("en-US")}`);
const showVal = (r: InputRow) =>
  r.value === null
    ? r.unit === "needed" || r.source === "needed"
      ? "needed"
      : r.unit
    : r.unit === "share"
      ? `${(r.value * 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`
      : r.unit === "elasticity"
        ? r.value.toFixed(2)
        : r.unit === "ratio"
        ? `${(r.value * 100).toLocaleString("en-US", { maximumFractionDigits: 1 })}% of the state-store price`
        : r.unit.startsWith("$")
          ? `${money(r.value)}${r.unit === "$ per year" ? " a year" : r.unit === "$ per gallon" ? " a gallon" : " a barrel"}`
          : `${r.value.toLocaleString("en-US")} ${r.unit}`;

export function ScenarioView() {
  const params = useParams();
  const idx = useData<MetricsIndex>("metrics.json");
  const pol = useData<PolicyData>("policy.json");
  const man = useData<Manifest>("manifest.json");
  const keys = Object.keys(M) as Key[];
  const metas = keys.map((k) => idx.data?.metrics.find((m) => m.metric_id === M[k]));
  const files = useMany<MetricFile>(idx.data ? metas.filter((m): m is MetricMeta => Boolean(m)).map((m) => m.file) : []);
  const err = idx.error ?? pol.error ?? man.error ?? files.error;
  if (err) return <ErrorNote error={err} />;
  if (!idx.data || !pol.data || !man.data || !files.data) return <Loading what="the Utah scenario tool" />;
  const present = keys.filter((_, i) => metas[i]);
  const dec = new Map<Key, DecodedMetric>(present.map((k, i) => [k, decodeMetric(files.data![i])]));
  const applied = readDraft(params);
  const f = facts(dec, applied.fy, pol.data);
  return (
    <>
      <section className="panel" aria-labelledby="sc-h">
        <h2 id="sc-h">Utah wine revenue scenarios</h2>
        <p className="small">
          What would different assumptions mean for Utah state revenue from wine if grocery stores could sell it? Today all wine sold
          for home use in Utah goes through state stores and package agencies, so the state keeps a markup on it. This tool shows what
          your assumptions imply, one year at a time. It is not a forecast, and it says nothing about health or safety.
        </p>
        <BuildNotice manifest={man.data} method={SCENARIO_METHOD} />
        <ScenarioForm applied={applied} f={f} />
      </section>
      <ScenarioResults d={applied} f={f} man={man.data} />
    </>
  );
}

function Basis({ b }: { b: Basis }) {
  const text = { sourced: "from the data", derived: "derived", user: "your assumption", example: "example value", proposal: "the proposal's assumption" }[b];
  return <span className={`input-basis ${b === "example" || b === "proposal" ? "user" : b}`}>{text}</span>;
}

/** Wine's share of DABS gross sales in the latest complete fiscal year of the monthly Sales Analysis Reports,
 * offered (never filled in) with both records. The share barely depends on whether gross sales include
 * sales tax (one rate for every beverage; only untaxed licensee sales could tilt it); it is from a
 * different year than the annual-report sales. */
function WineShareHelp({ salesText, set }: { salesText: string; set: (p: Partial<Draft>) => void }) {
  const idx = useData<MetricsIndex>("metrics.json");
  const ids = ["ut_dabs_fy_gross_sales_wine@state_fiscal_year", "ut_dabs_fy_gross_sales_total@state_fiscal_year"];
  const metas = ids.map((id) => idx.data?.metrics.find((m) => m.metric_id === id));
  const files = useMany<MetricFile>(metas.every(Boolean) ? metas.map((m) => m!.file) : []);
  if (!files.data || files.data.length !== 2) return <>{salesText}</>;
  const [wine, total] = files.data.map((f) => decodeMetric(f).obs.filter((o) => o.geo_id === UT && o.value !== null).sort((a, b) => b.year - a.year)[0]);
  if (!wine || !total || wine.year !== total.year || !total.value) return <>{salesText}</>;
  const share = Math.round((1000 * wine.value!) / total.value) / 10;
  return (
    <>
      {salesText} In DABS's monthly Sales Analysis Reports, <RecordLink rec={`obs:${ids[0]}:${wine.observation_id}`}>wine sales</RecordLink> were{" "}
      {share}% of <RecordLink rec={`obs:${ids[1]}:${total.observation_id}`}>all gross sales in FY{total.year}</RecordLink>, a different year from the
      sales above.{" "}
      <button type="button" className="link" onClick={() => set({ ws: String(share) })}>
        Use {share}%
      </button>
    </>
  );
}

/** The state's own sales-tax rate the dataset holds for Utah: the latest value with its period label. */
function useUtahStateTaxRate(): { value: number; label: string } | null | undefined {
  const idx = useData<{ series: MonthlyMeta[] }>("monthly.json");
  const meta = idx.data?.series.find((s) => s.measure_id === "state_sales_tax_rate_state_portion");
  const f = useData<MonthlyFile>(meta ? meta.file : null);
  if (!f.data) return undefined;
  const c = Object.fromEntries(f.data.columns.map((k, i) => [k, i]));
  const row = f.data.rows
    .filter((r) => r[c.geo_id] === UT && r[c.value] !== null)
    .sort((a, b) => (String(a[c.period_start]) < String(b[c.period_start]) ? 1 : -1))[0];
  return row ? { value: row[c.value] as number, label: String(row[c.period_label]) } : null;
}

/** The state's own sales-tax rate the dataset holds for Utah, offered with its source and never filled in
 * silently: the reader presses the button to use it. */
function SalesTaxHelp({ set }: { set: (p: Partial<Draft>) => void }) {
  const rate = useUtahStateTaxRate();
  const base = "The state's share only; local sales tax is outside this tool.";
  if (rate === undefined) return <>{base}</>;
  if (rate === null) return <>{base} The dataset holds no rate for Utah.</>;
  return (
    <>
      {base} The dataset holds {rate.value}% for {rate.label}, read from the Utah State Tax Commission's Publication 25, whose pages are
      marked "draft pending public meeting".{" "}
      <button type="button" className="link" onClick={() => set({ st: String(rate.value) })}>
        Use {rate.value}%
      </button>
    </>
  );
}

const FY_GROUPS = ["spirits", "wine", "beer", "cider", "premixed", "other"] as const;

/** Wine's own margin from Utah's pricing statute, offered (never filled in) with the check against DABS's
 * reported margin. The floor is a minimum markup, not a measured margin on wine. */
function WineMarginHelp({ reported, set }: { reported: number | null; set: (p: Partial<Draft>) => void }) {
  const idx = useData<MetricsIndex>("metrics.json");
  const ids = FY_GROUPS.map((g) => `ut_dabs_fy_gross_sales_${g}@state_fiscal_year`);
  const metas = ids.map((id) => idx.data?.metrics.find((m) => m.metric_id === id));
  const files = useMany<MetricFile>(metas.every(Boolean) ? metas.map((m) => m!.file) : []);
  const tax = useUtahStateTaxRate();
  const floor = marginOfMarkup(STATUTORY_MARKUP.wine);
  const floorPct = Math.round(floor * 10000) / 100;
  const lead = (
    <>
      A scenario assumption, not a measured margin: the statute sets a floor. Wine is marked up not less than {STATUTORY_MARKUP.wine * 100}% above the department's landed case cost,
      which is a margin of {floorPct}% of the shelf price ({STATUTE_NOTE}) Some wine sells below the floor (49% for small makers who apply, 17% to military installations, discontinued
      items) and some may sell above it (prices set above the floor, and from 2026-03-13 rounding); the dataset has no wine-specific cost figure to say which way the average falls.{" "}
      <button type="button" className="link" onClick={() => set({ gm: String(floorPct) })}>
        Use {floorPct}% as an assumption
      </button>
    </>
  );
  if (!files.data || files.data.length !== ids.length) return lead;
  const latest = files.data.map((f) => decodeMetric(f).obs.filter((o) => o.geo_id === UT && o.value !== null));
  // The latest fiscal year in which both spirits and wine have a sum; a group with none that year stays out of the mix.
  const common = [...new Set(latest[0].map((o) => o.year))].filter((y) => latest[1].some((o) => o.year === y));
  if (!common.length) return lead;
  const fy = Math.max(...common);
  const by = Object.fromEntries(FY_GROUPS.map((g, i) => [g, latest[i].find((o) => o.year === fy)?.value ?? null]));
  const check = crossCheck({ salesByGroup: by, reportedMargin: reported, taxRate: tax ? tax.value / 100 : null });
  if (check.mixFloor === null) return lead;
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
  return (
    <>
      {lead}
      <br />
      Check ({WINE_MARGIN_METHOD}): the same floors applied to each beverage's share of FY{fy} DABS gross sales imply {pct(check.mixFloor)} for all products together
      (heavy beer's floor is lower). DABS's reported all-product margin is {reported === null ? "not available" : pct(reported)}
      {check.gap === null ? "" : `, ${(Math.abs(check.gap) * 100).toFixed(1)} points ${check.gap >= 0 ? "above" : "below"} it`}.
      {check.ifTaxIncluded ? ` If gross sales included the state's ${check.ifTaxIncluded.rate * 100}% sales tax, the floors would imply about ${pct(check.ifTaxIncluded.margin)} (the state's rate alone; local rates would push it higher).` : ""}
      {check.closer === "excludes_tax" ? " The reported figure is nearer the no-tax reading. That is consistent with, not proof of, a tax-exclusive definition: reduced markups pull the actual margin below the floors, higher or rounded prices push it above, cost of liquor sold may leave out some landed costs, and the years differ." : ""}
      {check.closer === "includes_tax" ? " The reported figure is nearer the tax-inclusive reading. That is consistent with, not proof of, sales that include tax, for the same reasons in reverse." : ""}
    </>
  );
}

/** What Census state liquor-store finance says about the operating cost that moves with sales. The regression is run
 * in the export (store_cost.py); here its slopes are turned into an operating-cost share using the margin the reader
 * is using, and shown with their disagreement. Never filled into the field. */
function CostEvidenceHelp({ margin, opexShare }: { margin: number | null; opexShare: number | null }) {
  const cm = useData<CostModel>("cost_model.json");
  if (!cm.data || margin === null) return null;
  const rows = impliedRows(cm.data, margin);
  if (!rows.length) return null;
  const span = impliedSpan(rows);
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
  const s = cm.data.sample;
  return (
    <details className="small" style={{ marginTop: 6 }}>
      <summary>Exploratory: what Census store finance says ({cm.data.method})</summary>
      <p>
        Across {s.states.length} states that ran liquor stores ({s.first_year}-{s.last_year}, {s.state_years} state-years), the change in a state's store expenditure on the change in its store revenue, over the same
        number of years, with an intercept for each year to take out shocks common to all states. Expenditure includes buying the liquor. If these states' cost of goods were {pct(1 - margin)} of
        sales, as your margin of {pct(margin)} implies for Utah, the rest of each slope would be operating cost that moves with sales; their own margins differ and are not in the dataset.
      </p>
      <div className="table-wrap">
        <table className="data">
          <caption className="small">Expenditure per revenue dollar (95% interval), and the operating cost that implies</caption>
          <thead>
            <tr>
              <th scope="col">Changes over</th>
              <th scope="col">Weighting</th>
              <th scope="col" className="num">Slope</th>
              <th scope="col" className="num">Operating cost, % of sales, if cost of goods were {pct(1 - margin)}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.spec.horizon_years}-${r.spec.weighting}`}>
                <th scope="row">{r.spec.horizon_years === 1 ? "1 year (short run)" : `${r.spec.horizon_years} years (longer run)`}</th>
                <td>{WEIGHTING_LABEL[r.spec.weighting]}</td>
                <td className="num">
                  {r.spec.beta.toFixed(2)} ({r.spec.ci_low.toFixed(2)} to {r.spec.ci_high.toFixed(2)})
                </td>
                <td className="num">
                  {pct(r.value)} ({pct(r.low)} to {pct(r.high)}){r.floored ? " — slope is below the cost of goods alone" : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        The two weightings disagree by more than either interval, and the equal-weight slopes are below the cost of goods alone, so the data do not pin this down: across all four the implied figure runs from {span ? pct(span.low) : "—"} to{" "}
        {span ? pct(span.high) : "—"} of sales.
        {opexShare !== null ? ` DABS's total operating expenses were ${pct(opexShare)} of its sales: a ceiling on the operating cost that could leave with sales, not an estimate of savings.` : ""} Seventeen states is few clusters,
        the Census figures cover each state's whole system rather than one beverage, and inflation moves costs and revenue together, which pushes slopes toward the average cost ratio rather than the
        cost that would actually go. An association in past data, not an effect, and not filled into the scenario.
      </p>
      {cm.data.extension_check ? <p>{extensionSummary(cm.data.extension_check)}</p> : null}
    </details>
  );
}

function NumField({
  label,
  name,
  draft,
  set,
  unit,
  help,
  placeholder,
  required = true,
}: {
  label: string;
  name: Field;
  draft: Draft;
  set: (p: Partial<Draft>) => void;
  unit: string;
  help: ReactNode;
  placeholder?: string;
  required?: boolean;
}) {
  const empty = draft[name].trim() === "";
  const bad = !empty && num(draft[name]) === null;
  return (
    <label className={required && empty ? "needs-input" : undefined}>
      <span>
        {label} <span className="muted">({unit})</span>
      </span>
      <input type="text" inputMode="decimal" value={draft[name]} placeholder={placeholder ?? (required ? "needed" : "")} onChange={(e) => set({ [name]: e.target.value, eg: "" })} aria-invalid={bad || undefined} />
      <span className="help">
        {bad ? <strong>Not a number. </strong> : null}
        {help}
      </span>
    </label>
  );
}

function ScenarioForm({ applied, f }: { applied: Draft; f: Facts }) {
  const [draft, setDraft] = useState(applied);
  const key = JSON.stringify(applied);
  useEffect(() => setDraft(JSON.parse(key) as Draft), [key]);
  const set = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));
  const dirty = JSON.stringify(draft) !== key;
  const run = (e: FormEvent) => {
    e.preventDefault();
    const patch: Patch = { v: "scenario" };
    for (const k of FIELDS) patch[k] = draft[k] || null;
    navigate(patch, { reset: true });
  };
  const margin = f.sales?.value && f.gp?.value != null ? f.gp.value / f.sales.value : null;
  const opexShare = f.sales?.value && f.opex?.value != null ? f.opex.value / f.sales.value : null;
  const p = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(1)}%`);
  const unreviewed = "transcribed from the unaudited DABS annual report; not reviewed by a person";
  return (
    <form onSubmit={run} aria-label="Inputs">
      <div className="row-actions no-print">
        {PROPOSALS.map((x) => (
          <Go key={x.id} to={{ v: "scenario", ...x.values, eg: x.id }} reset>
            {x.label}
          </Go>
        ))}
        <span className="small muted">Examples (illustrative values, not estimates):</span>
        {EXAMPLES.map((x) => (
          <Go key={x.id} to={{ v: "scenario", ...x.values, eg: x.id }} reset>
            {x.label}
          </Go>
        ))}
      </div>
      <fieldset className="inputs">
        <legend>1. Base year and what the data say</legend>
        <div className="controls">
          <label>
            Base fiscal year
            <select value={String(f.fy)} onChange={(e) => set({ fy: e.target.value })}>
              {f.fyOptions.map((o) => (
                <option key={o.fy} value={o.fy} disabled={!o.ok}>
                  FY{o.fy} (July {o.fy - 1} to June {o.fy}){o.ok ? "" : ` — unavailable: ${o.why}`}
                </option>
              ))}
            </select>
            <span className="help">Utah's fiscal year. Dollars are that year's, not adjusted for inflation.</span>
          </label>
        </div>
        <div className="table-wrap">
          <table className="data">
            <caption className="small">From the dataset, FY{f.fy} (DABS figures are {unreviewed})</caption>
            <tbody>
              <tr>
                <th scope="row">DABS liquor sales (spirits, wine, heavy beer)</th>
                <td className="num">{money(f.sales?.value)}</td>
                <td className="small">
                  Gross sales, not government revenue. Before sales tax (earlier reports' Note B; the FY2025 report lists sales tax separately), and before the statutory school-meals and enforcement deposits, which the
                  audited state report books outside DABS's fund and Census leaves out (see{" "}
                  <Go to={{ v: "utah" }} reset>
                    why the figures differ
                  </Go>
                  ).
                </td>
              </tr>
              <tr>
                <th scope="row">DABS gross profit</th>
                <td className="num">{money(f.gp?.value)}</td>
                <td className="small">Sales minus the cost of the products: {p(margin)} of sales. Not profit: costs and transfers come out of it.</td>
              </tr>
              <tr>
                <th scope="row">DABS operating expenses (labelled operating and non-operating in its five-year summary)</th>
                <td className="num">{money(f.opex?.value)}</td>
                <td className="small">{p(opexShare)} of sales, all products, fixed and variable together.</td>
              </tr>
              <tr>
                <th scope="row">DABS net profit to the General Fund</th>
                <td className="num">{money(f.net?.value)}</td>
                <td className="small">After expenses and earmarked transfers. Shown for context; not used (it would double count the margin).</td>
              </tr>
              <tr>
                <th scope="row">DABS “sales tax” line</th>
                <td className="num">{money(f.dabsTax?.value)}</td>
                <td className="small">Not used: whether it is the state's or only the local share is unresolved.</td>
              </tr>
              <tr>
                <th scope="row">Census alcohol taxes, Utah (T10)</th>
                <td className="num">{money(f.t10?.value)}</td>
                <td className="small">Beer and other alcohol taxes. Not comparable with store receipts; context only.</td>
              </tr>
              <tr>
                <th scope="row">Wine shipped to Utah (NIAAA), calendar {f.cal}</th>
                <td className="num">{f.gallons?.value != null ? `${Math.round(f.gallons.value).toLocaleString("en-US")} gal` : "—"}</td>
                <td className="small">All wine, including what restaurants buy. A calendar year, not the fiscal year.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </fieldset>

      <fieldset className="inputs">
        <legend>2. Baseline wine sales</legend>
        <p className="help">The dataset has no wine-only DABS sales figure, so choose how to supply it.</p>
        <fieldset className="radios">
          <legend className="visually-hidden">How to supply baseline wine sales</legend>
          {(
            [
              ["share", "Wine's share of DABS liquor sales"],
              ["gallons", "Wine gallons × an average price per gallon"],
              ["enter", "Enter the dollar amount"],
            ] as [string, string][]
          ).map(([v, label]) => (
            <label className="check" key={v}>
              <input type="radio" name="wr" checked={draft.wr === v} onChange={() => set({ wr: v, eg: "" })} />
              {label}
            </label>
          ))}
        </fieldset>
        <div className="controls">
          {draft.wr === "share" && (
            <NumField label="Wine's share of DABS sales" name="ws" draft={draft} set={set} unit="%" help={<WineShareHelp salesText={`Of ${money(f.sales?.value)} in FY${f.fy}.`} set={set} />} />
          )}
          {draft.wr === "gallons" && (
            <NumField label="Average state-store price" name="pg" draft={draft} set={set} unit="$ per gallon" help="Shelf price before sales tax, averaged over all wine sold. A 750 ml bottle is 0.198 gallons." />
          )}
          {draft.wr === "enter" && <NumField label="Baseline wine sales" name="w" draft={draft} set={set} unit="$ per year" help="State stores and package agencies, before sales tax." />}
          <NumField
            label="Wine gallons (optional override)"
            name="gal"
            draft={draft}
            set={set}
            unit="gallons"
            required={false}
            placeholder={f.gallons?.value != null ? `${Math.round(f.gallons.value)} from NIAAA` : ""}
            help="Leave blank to use NIAAA's figure. Needed for an excise per gallon or for volume-based substitution."
          />
        </div>
      </fieldset>

      <fieldset className="inputs">
        <legend>3. State-store economics and costs</legend>
        <div className="controls">
          <NumField
            label="Gross margin on wine"
            name="gm"
            draft={draft}
            set={set}
            unit="% of sales"
            required={false}
            placeholder={margin === null ? "" : `${(margin * 100).toFixed(1)} derived`}
            help={
              <>
                Share of each wine sales dollar left after paying for the wine. Blank uses DABS's all-product figure ({p(margin)}). A markup is not a profit.{" "}
                <WineMarginHelp reported={margin} set={set} />
              </>
            }
          />
          <NumField
            label="Avoidable operating cost"
            name="vc"
            draft={draft}
            set={set}
            unit="% of shifted sales"
            help={
              <>
                Costs the state would stop paying per dollar of sales that leaves its stores. All DABS expenses were {p(opexShare)} of sales, but stores, systems and staff do not all shrink with sales.
                <CostEvidenceHelp margin={num(draft.gm) !== null ? num(draft.gm)! / 100 : margin} opexShare={opexShare} />
              </>
            }
          />
          <NumField label="State sales tax rate" name="st" draft={draft} set={set} unit="% of shelf price" help={<SalesTaxHelp set={set} />} />
          <NumField label="New state costs" name="nc" draft={draft} set={set} unit="$ per year" help="Licensing, inspection and enforcement for grocery sellers. Enter 0 if none." />
        </div>
        <label className="check">
          <input type="checkbox" checked={draft.ev === "1"} onChange={(e) => set({ ev: e.target.checked ? "1" : "" })} />
          Use the bounds the dataset gives instead of conventions
          <span className="help">
            Replaces the conventional ranges in the sensitivity tables for gross margin (the lowest and highest all-product margin DABS reported across years) and for avoidable operating cost (none to all of DABS's operating expenses,
            an accounting ceiling rather than a savings estimate). Off by default; it changes the ranges only, never your entered values.
          </span>
        </label>
      </fieldset>

      <fieldset className="inputs">
        <legend>4. Scenario A: some wine purchases move to grocery stores</legend>
        <p className="help">The same wine is bought; only where it is bought changes. Nothing here is new demand.</p>
        <div className="controls">
          <NumField label="Share moving to grocery stores" name="s" draft={draft} set={set} unit="% of household purchases" help="Of the wine households now buy from state stores and agencies. Restaurants' and bars' purchases do not move." />
          <NumField
            label="Household share of wine sales"
            name="hh"
            draft={draft}
            set={set}
            unit="% of wine sales"
            required={false}
            placeholder={f.offPremise?.value != null ? `${f.offPremise.value} DABS, all products` : "needed"}
            help={
              <>
                Purchases for home, the only ones that could move; licensees keep buying from DABS. Blank uses DABS's off-premise share of all its sales
                {f.offPremise?.value != null ? ` (${f.offPremise.value}%, FY${f.offPremise.year} annual report)` : ""}; wine's own split is not published, so this is uncertain.
              </>
            }
          />
          <NumField label="Grocery price compared with the state store" name="r" draft={draft} set={set} unit="% (100 = same)" help="For the same wine. Lower prices mean less sales tax per bottle." />
          <NumField
            label="Pass-through of that price gap"
            name="pt"
            draft={draft}
            set={set}
            unit="% (blank = 100)"
            required={false}
            help="Share of the gap above that reaches the shelf. Less than 100 means sellers keep part of it: a 90% price with 50% pass-through is a 95% price."
          />
        </div>
        <fieldset className="radios">
          <legend>How would the state collect revenue on grocery wine?</legend>
          {(
            [
              ["keep", "The state keeps a share of each grocery sale (for example as the wholesaler)"],
              ["excise", "An excise tax per gallon"],
              ["percent", "An extra tax on the shelf price"],
              ["combo", "A combination of these"],
              ["wholesale", "DABS stays the wholesaler and sells to grocers at its shelf price less a discount"],
            ] as [string, string][]
          ).map(([v, label]) => (
            <label className="check" key={v}>
              <input type="radio" name="rm" checked={draft.rm === v} onChange={() => set({ rm: v, eg: "" })} />
              {label}
            </label>
          ))}
        </fieldset>
        <div className="controls">
          {(draft.rm === "keep" || draft.rm === "combo") && (
            <NumField label="Share the state keeps" name="rho" draft={draft} set={set} unit="% of grocery sales" help="What the state retains from each grocery wine sales dollar (wholesale markup net of its cost, or a fee)." />
          )}
          {(draft.rm === "excise" || draft.rm === "combo") && <NumField label="Excise" name="exc" draft={draft} set={set} unit="$ per gallon" help="On wine sold by grocery stores." />}
          {(draft.rm === "percent" || draft.rm === "combo") && <NumField label="Tax on the shelf price" name="av" draft={draft} set={set} unit="%" help="On top of sales tax." />}
          {draft.rm === "wholesale" && (
            <NumField
              label="Discount DABS gives grocers"
              name="dc"
              draft={draft}
              set={set}
              unit="% off its shelf price"
              help="DABS sells the wine to grocers at its shelf price less this discount, keeping its gross margin less the discount on each dollar that moves."
            />
          )}
        </div>
      </fieldset>

      <fieldset className="inputs">
        <legend>5. Scenario B (optional): more wine bought in total</legend>
        <label className="check">
          <input type="checkbox" checked={draft.b === "1"} onChange={(e) => set({ b: e.target.checked ? "1" : "", eg: "" })} />
          Also model an increase in total wine purchases
          <span className="help">Kept separate from scenario A, so shifted sales are never counted as new demand.</span>
        </label>
        {draft.b === "1" && (
          <>
            <div className="controls">
              <NumField label="Increase in total wine purchases (easier access)" name="g" draft={draft} set={set} unit="% of baseline volume" help="Extra wine bought because it is easier to buy. Enter 0 for none; the price response and recapture below are separate sources." />
              <NumField label="Share of the extra wine bought in grocery stores" name="q" draft={draft} set={set} unit="%" help="The rest is bought from state stores. Applies to the access and recapture wine; wine bought because of the price is bought in grocery stores." />
            </div>
            <div className="controls">
              <NumField
                label="Price elasticity of wine demand"
                name="el"
                draft={draft}
                set={set}
                unit="negative, e.g. −0.46"
                required={false}
                help={
                  <>
                    Makes the wine that moves respond to its new price. Blank: quantity ignores price. Nelson (2013), a meta-analysis: wine −0.46 after correcting for publication bias (95% CI −0.54 to −0.38; the abstract rounds it to −0.45); the uncorrected random-effects mean is −0.58.{" "}
                    <button type="button" className="link" onClick={() => set({ el: "-0.46", eg: "" })}>
                      Use −0.46
                    </button>
                  </>
                }
              />
              <NumField
                label="Cross-border recapture"
                name="rc"
                draft={draft}
                set={set}
                unit="% of baseline volume"
                required={false}
                help="Wine Utahns now buy in other states that they would buy in Utah instead. New to Utah's tax base but not new drinking, so it never replaces beer. Blank: none."
              />
            </div>
            <label className="check">
              <input type="checkbox" checked={draft.sub === "1"} onChange={(e) => set({ sub: e.target.checked ? "1" : "", eg: "" })} />
              Some of the extra wine replaces beer
              <span className="help">The beer no longer bought takes its excise and sales tax with it.</span>
            </label>
            {draft.sub === "1" && (
              <>
                <div className="controls">
                  <NumField label="Share of extra wine replacing beer" name="k" draft={draft} set={set} unit="%" help="Of the extra wine." />
                  <NumField label="Beer shelf price" name="pb" draft={draft} set={set} unit="$ per gallon" help="Average, before sales tax. A 12-ounce can is 0.094 gallons." />
                  <NumField
                    label="Beer excise (override)"
                    name="bt"
                    draft={draft}
                    set={set}
                    unit="$ per 31-gallon barrel"
                    required={false}
                    placeholder={f.beerTax ? `${f.beerTax.value} coded law` : "needed"}
                    help={f.beerTax ? `Blank uses Utah's coded rate in force on ${f.beerTax.day}.` : "No verified rate for this year: enter one."}
                  />
                </div>
                <fieldset className="radios">
                  <legend>What does the substitution hold constant?</legend>
                  {(
                    [
                      ["spending", "Spending: each dollar spent on extra wine is a dollar not spent on beer"],
                      ["volume", "Volume: each gallon of extra wine replaces a gallon of beer"],
                      ["ethanol", "Pure alcohol: the extra wine replaces beer containing the same alcohol"],
                    ] as [string, string][]
                  ).map(([v, label]) => (
                    <label className="check" key={v}>
                      <input type="radio" name="bas" checked={draft.bas === v} onChange={() => set({ bas: v, eg: "" })} />
                      {label}
                    </label>
                  ))}
                </fieldset>
                {draft.bas === "ethanol" && (
                  <div className="controls">
                    <NumField label="Wine alcohol (override)" name="aw" draft={draft} set={set} unit="% ABV" required={false} placeholder={f.abvWine?.value != null ? `${(f.abvWine.value * 100).toFixed(1)} NIAAA` : ""} help="Blank uses NIAAA's average." />
                    <NumField label="Beer alcohol (override)" name="ab" draft={draft} set={set} unit="% ABV" required={false} placeholder={f.abvBeer?.value != null ? `${(f.abvBeer.value * 100).toFixed(1)} NIAAA` : ""} help="Blank uses NIAAA's average." />
                  </div>
                )}
              </>
            )}
          </>
        )}
      </fieldset>
      <fieldset className="inputs">
        <legend>6. Compare three arrangements (optional)</legend>
        <label className="check">
          <input type="checkbox" checked={draft.cmp === "1"} onChange={(e) => set({ cmp: e.target.checked ? "1" : "", pc: e.target.checked && !draft.pc ? "matched" : draft.pc, eg: "" })} />
          Compare three ways the state could collect on grocery wine, on the inputs above
          <span className="help">
            The same baseline, costs, share moving and grocery price (sections 1 to 4) and any purchase changes in section 5, with a different arrangement in each column. Proposed arrangements,
            not current law. Beer substitution is left out of the comparison.
          </span>
        </label>
        {draft.cmp === "1" && (
          <>
            <fieldset className="radios">
              <legend>Grocery prices in the comparison</legend>
              {(
                [
                  ["matched", "Matched consumer prices (the reference): grocers charge what a state store charges, any replacement tax inside that price"],
                  ["entered", "The grocery price entered in section 4, with the share of the replacement tax entered below added to it"],
                ] as [string, string][]
              ).map(([v, label]) => (
                <label className="check" key={v}>
                  <input type="radio" name="pc" checked={(draft.pc || "entered") === v} onChange={() => set({ pc: v, eg: "" })} />
                  {label}
                </label>
              ))}
            </fieldset>
            <fieldset className="radios">
              <legend>1. Private retail: grocers buy from private wholesalers and the state levies a replacement tax</legend>
              {(
                [
                  ["percent", "A tax on the grocery price before tax"],
                  ["excise", "An excise per gallon"],
                ] as [string, string][]
              ).map(([v, label]) => (
                <label className="check" key={v}>
                  <input type="radio" name="rt" checked={draft.rt === v} onChange={() => set({ rt: v, eg: "" })} />
                  {label}
                </label>
              ))}
            </fieldset>
            <div className="controls">
              <NumField
                label={draft.rt === "excise" ? "Replacement excise" : "Replacement tax"}
                name="rtv"
                draft={draft}
                set={set}
                unit={draft.rt === "excise" ? "$ per gallon" : "% of the grocery price before tax"}
                help="A policy choice. Ordinary state sales tax applies on top, to the shelf price. The comparison reports the rate at which revenue would be unchanged."
              />
              <NumField
                label="Share of the tax in the shelf price"
                name="rtp"
                draft={draft}
                set={set}
                unit="% (blank = 100)"
                required={false}
                help="How much of the tax grocers add to the shelf price; the rest comes out of their margin. Blank: all of it, an assumption. With an elasticity in section 5, a higher price means less wine bought."
              />
              <NumField
                label="Wholesaling costs the state also stops"
                name="vw"
                draft={draft}
                set={set}
                unit="% of the sales that move (blank = 0)"
                required={false}
                help="Only arrangement 1 takes the wine out of DABS's warehouse and trucks. Added to the avoidable store cost of section 3. Blank counts none: no source measures it."
              />
            </div>
            <div className="controls">
              <NumField
                label="Margin a private wholesaler needs"
                name="gw"
                draft={draft}
                set={set}
                unit="% of its selling price (optional)"
                required={false}
                help="Arrangement 1's wholesaler: gross margin on its own price. An assumption: no source measures it for wine in Utah. Census's national average for beer, wine and spirits merchant wholesalers was 29.5% of sales in 2022 (Annual Wholesale Trade Survey, all products; in this dataset)."
              />
              <NumField
                label="Margin a grocer needs"
                name="gg"
                draft={draft}
                set={set}
                unit="% of its selling price (optional)"
                required={false}
                help="Gross margin on the grocer's own price before tax. An assumption. Census's national averages in 2022: grocery stores 28.0%, beer, wine and liquor stores 31.1% of sales (Annual Retail Trade Survey, all products; in this dataset). A grocer adding wine to shelves it already runs may accept less."
              />
            </div>
            <div className="controls">
              <NumField
                label="2. State wholesale: discount DABS gives grocers"
                name="dc"
                draft={draft}
                set={set}
                unit="% off its shelf price"
                help="DABS stays the only wholesaler and sells to grocers at its shelf price less this discount. The grocer keeps the difference between its shelf price (section 4) and what it pays DABS."
              />
            </div>
            <fieldset className="radios">
              <legend>3. An explicit allocation to school meals and enforcement, paid from the proceeds of</legend>
              {(
                [
                  ["private", "arrangement 1 (the replacement tax)"],
                  ["wholesale", "arrangement 2 (DABS's margin on its sales to grocers)"],
                ] as [string, string][]
              ).map(([v, label]) => (
                <label className="check" key={v}>
                  <input type="radio" name="eb" checked={draft.eb === v} onChange={() => set({ eb: v, eg: "" })} />
                  {label}
                </label>
              ))}
            </fieldset>
            <fieldset className="radios">
              <legend>How much the two funds receive</legend>
              {(
                [
                  ["fixed", "A fixed guarantee: today's deposit rates on the sales this scenario moves, set once (the proportional guarantee is shown beside it)"],
                  ["proportional", "A proportional guarantee: today's deposit rates on the state-store sales actually lost (the fixed one is shown beside it)"],
                  ["amount", "A fixed amount a year"],
                  ["share", "A share of the proceeds"],
                ] as [string, string][]
              ).map(([v, label]) => (
                <label className="check" key={v}>
                  <input type="radio" name="er" checked={draft.er === v} onChange={() => set({ er: v, eg: "" })} />
                  {label}
                </label>
              ))}
            </fieldset>
            {(draft.er === "amount" || draft.er === "share") && (
              <div className="controls">
                <NumField
                  label={draft.er === "amount" ? "Amount for the two funds" : "Share of the proceeds"}
                  name="ea"
                  draft={draft}
                  set={set}
                  unit={draft.er === "amount" ? "$ per year" : "%"}
                  help="Split between school meals and enforcement in today's statutory proportion. An allocation moves money between funds; it does not add any."
                />
              </div>
            )}
          </>
        )}
      </fieldset>
      <div className="row-actions run-bar">
        <button type="submit" className="primary">
          {dirty ? "Update results" : "Run"}
        </button>
        <button type="button" onClick={() => setDraft(applied)} disabled={!dirty}>
          Undo unapplied edits
        </button>
        <button type="button" onClick={() => navigate({ v: "scenario" }, { reset: true })}>
          Clear all assumptions
        </button>
        {dirty && <span className="small warn-inline">You have edits that are not in the results yet.</span>}
      </div>
    </form>
  );
}

/** Where to fill in each missing assumption. */
function missingLabel(m: string, route: string): string {
  if (m === "baseline wine sales")
    return route === "share" ? "wine's share of DABS liquor sales (section 2)" : route === "gallons" ? "average state-store price per gallon (section 2)" : "baseline wine sales (section 2)";
  if (m === "wine gallons sold") return "wine gallons (section 2)";
  if (["gross margin on wine", "avoidable operating cost", "state sales tax rate", "new state costs of licensing and enforcement"].includes(m)) return `${m} (section 3)`;
  if (["share of wine moving to grocery stores", "grocery price compared with the state store", "share of grocery sales the state keeps", "excise per gallon", "tax on the grocery shelf price", "discount DABS gives grocers"].includes(m)) return `${m} (section 4)`;
  return `${m} (section 5)`;
}

const fmtSetting = (v: number, f: RangeFormat) =>
  f === "percent" ? `${(v * 100).toFixed(1)}%` : f === "money" ? money(v) : f === "money2" ? `$${v.toFixed(2)}` : f === "gallons" ? `${Math.round(v).toLocaleString("en-US")} gal` : v.toFixed(2);

/** Every assumption at once at the end of its range that lowers, then raises, the net change: sensitivity scenarios,
 * not a probability interval (lib/scenarioRanges combinedScenarios). */
function CombinedBlock({ x, ranges }: { x: ScenarioInputs; ranges: RangeOverrides }) {
  const a = combinedScenarios(x, "A", ranges);
  const b = x.extra ? combinedScenarios(x, "B", ranges) : null;
  if (!a) return null;
  const settings = (c: Combined["low"]) => (c.settings.length ? c.settings.map((z) => `${z.label} ${fmtSetting(z.value, z.format)}`).join("; ") : "no assumption varies");
  const row = (name: string, c: Combined) => (
    <tr key={name}>
      <th scope="row">{name}</th>
      <td className="num">{money(c.low.net)}</td>
      <td className="num">{money(c.high.net)}</td>
    </tr>
  );
  return (
    <section className="panel" aria-labelledby="scr-mc">
      <h3 id="scr-mc">If every assumption leaned the same way</h3>
      <p className="small">
        Every assumption in the tables above set at once to the end of its range that lowers the net change, and then to the end that raises it, the direction for each taken from the
        one-at-a-time table. These are deliberately extreme combinations that bracket the table, not likely outcomes, and no probability is attached to them: only the elasticity range rests on a
        published source, and the others are conventions.
      </p>
      <div className="table-wrap">
        <table className="data">
          <caption className="small">Net change in state revenue from wine, per year, in the two combined scenarios</caption>
          <thead>
            <tr>
              <th scope="col">Scenario</th>
              <th scope="col" className="num">
                Every assumption at its lowering end
              </th>
              <th scope="col" className="num">
                Every assumption at its raising end
              </th>
            </tr>
          </thead>
          <tbody>
            {row("A: purchases move", a)}
            {b && row("B: plus extra purchases", b)}
          </tbody>
        </table>
      </div>
      <details className="small">
        <summary>The settings used</summary>
        <p>A, lowering: {settings(a.low)}.</p>
        <p>A, raising: {settings(a.high)}.</p>
        {b && <p>B, lowering: {settings(b.low)}.</p>}
        {b && <p>B, raising: {settings(b.high)}.</p>}
      </details>
    </section>
  );
}

function ScenarioResults({ d, f, man }: { d: Draft; f: Facts; man: Manifest }) {
  const rates = useDepositRates(f.fy);
  const { x, rows } = toInputs(d, f);
  const res = compute(x);
  const example = EXAMPLES.find((e) => e.id === d.eg);
  const proposal = PROPOSALS.find((p) => p.id === d.eg);
  if (res.missing.length || res.invalid.length) {
    return (
      <section className="panel" aria-labelledby="scr-h">
        <h2 id="scr-h">Results</h2>
        {res.invalid.length > 0 && (
          <ul className="warn small" role="alert">
            {res.invalid.map((p) => (
              <li key={p}>{p}.</li>
            ))}
          </ul>
        )}
        {res.missing.length > 0 && (
          <div className="note small">
            <p style={{ marginTop: 0 }}>
              The calculator needs these assumptions, which the dataset cannot supply. Fill them in above and press Run, or try an example.
            </p>
            <ul className="source-list">
              {res.missing.map((m) => (
                <li key={m}>{missingLabel(m, d.wr)}</li>
              ))}
            </ul>
          </div>
        )}
      </section>
    );
  }
  const ranges: RangeOverrides = d.ev === "1" ? evidenceRanges(f.evidence) : {};
  const sensA = sensitivity(x, "A", ranges);
  const sensB = x.extra ? sensitivity(x, "B", ranges) : [];
  const steps = stepsA(x, res, rates);
  const leverA = breakEvenLever(x, "A");
  const leverB = x.extra ? breakEvenLever(x, "B") : null;
  const combA = combinedScenarios(x, "A", ranges);
  const revenueA = res.a.filter((c) => c.kind === "revenue");
  const extraRevenue = res.b?.filter((c) => c.kind === "revenue") ?? [];
  const sum = (cs: Component[]) => cs.reduce((a, c) => a + c.value, 0);
  const pctOf = (v: number) => (res.baselineTotal ? `${v >= 0 ? "+" : "−"}${Math.abs((100 * v) / res.baselineTotal).toFixed(1)}%` : "—");
  const maxAbs = Math.max(Math.abs(res.netA), Math.abs(res.netB ?? 0), 1);
  const question = `What would these assumptions mean for Utah state revenue from wine in FY${f.fy}?`;
  const comparison = d.cmp === "1" ? compare(x, settingsFromFields((k) => (d as Record<string, string>)[k] ?? ""), rates, f.evidence.opexShare) : null;
  const csv = () => {
    type Row = { row_type: string; item: string; baseline: number | null; scenario_a: number | null; scenario_b: number | null; unit: string; basis: string };
    const out: Row[] = rows.map((r) => ({ row_type: "input", item: r.label, baseline: r.value, scenario_a: null, scenario_b: null, unit: r.unit, basis: r.basis === "example" ? "user (example value)" : r.basis }));
    for (const c of res.baseline) out.push({ row_type: "baseline_revenue", item: c.label, baseline: c.value, scenario_a: null, scenario_b: null, unit: "$ per year", basis: "calculated" });
    for (const c of res.a) out.push({ row_type: `scenario_a_${c.kind}`, item: c.label, baseline: null, scenario_a: c.value, scenario_b: null, unit: "$ per year", basis: "calculated" });
    for (const c of res.b ?? []) out.push({ row_type: `scenario_b_extra_${c.kind}`, item: c.label, baseline: null, scenario_a: null, scenario_b: c.value, unit: "$ per year", basis: "calculated" });
    for (const st of steps)
      out.push({ row_type: st.part === "of" ? "scenario_a_step_of_which (not added)" : `scenario_a_step_${st.part}`, item: `${st.label} [${st.formula}]`, baseline: null, scenario_a: st.value, scenario_b: null, unit: "$ per year", basis: "calculated" });
    out.push({ row_type: "net_change", item: "Net change in state revenue from wine (after avoided and new costs)", baseline: null, scenario_a: res.netA, scenario_b: res.netB, unit: "$ per year", basis: "calculated" });
    for (const s of [...sensA.map((z) => ({ ...z, sc: "A" })), ...sensB.map((z) => ({ ...z, sc: "B" }))])
      out.push({ row_type: `sensitivity_${s.sc}`, item: `${s.label}: ${s.low} to ${s.high} [range: ${s.evidence}]`, baseline: null, scenario_a: s.sc === "A" ? s.netLow : null, scenario_b: s.sc === "B" ? s.netLow : null, unit: `net at low; at high ${Math.round(s.netHigh)}`, basis: "calculated" });
    for (const [sc, cb] of [["a", combinedScenarios(x, "A", ranges)], ["b", x.extra ? combinedScenarios(x, "B", ranges) : null]] as const) {
      if (!cb) continue;
      for (const [item, v] of [
        ["every assumption at its lowering end", cb.low.net],
        ["every assumption at its raising end", cb.high.net],
      ] as [string, number][])
        out.push({ row_type: `combined_sensitivity_${sc}`, item: `Net change with ${item} (an extreme combination, not a probability)`, baseline: null, scenario_a: sc === "a" ? v : null, scenario_b: sc === "b" ? v : null, unit: "$ per year", basis: "calculated" });
    }
    if (comparison && !comparison.missing.length && !comparison.invalid.length) {
      for (const a of [comparison.private, comparison.wholesale]) {
        const l = a.lines!;
        for (const [item, v] of [
          ["gross margin displaced", l.marginDisplaced],
          ["replacement revenue", l.replacement],
          ["change in state sales tax", l.salesTaxChange],
          ["operating costs avoided", l.costsAvoided],
          ["new costs", -l.newCosts],
          ["net change", l.net],
        ] as [string, number][])
          out.push({ row_type: `comparison_${a.id}`, item: `${a.label}: ${item} (channel shift only; ${ARRANGEMENTS_METHOD})`, baseline: null, scenario_a: v, scenario_b: item === "net change" ? a.netAll : null, unit: "$ per year", basis: "calculated" });
        out.push({ row_type: `comparison_${a.id}`, item: `${a.label}: break-even ${a.breakEven.lever} (${a.breakEven.basis}; ${a.breakEven.status})`, baseline: null, scenario_a: a.breakEven.value, scenario_b: null, unit: a.breakEven.lever === "discount" || a.x.revenueMode === "percent" ? "share" : "$ per gallon", basis: "calculated" });
        for (const [item, k] of [
          ["sellers keep per $ of state-store price, at the lever entered", a.sellers],
          ["sellers keep per $ of state-store price, at the state's break-even lever", a.sellersAtBreakEven],
        ] as const)
          if (k) out.push({ row_type: `comparison_${a.id}_sellers`, item: `${a.label}: ${item} (${comparison.priceCase} prices; gross margin on their own price ${(k.margin * 100).toFixed(1)}%)`, baseline: null, scenario_a: k.perDollar, scenario_b: null, unit: "$ per $1 of state-store price", basis: "calculated" });
        if (a.viability)
          for (const [sc, v] of [["a", a.viability.shift], ["b", a.viability.all]] as const)
            if (v && v.shelf !== null)
              out.push({ row_type: `comparison_${a.id}_viability`, item: `${a.label}: shelf price at which the state breaks even and sellers earn the margins entered (lever ${v.lever})`, baseline: null, scenario_a: sc === "a" ? v.shelf : null, scenario_b: sc === "b" ? v.shelf : null, unit: "share of today's state-store price, before sales tax", basis: "calculated" });
      }
      for (const g of comparison.guarantees)
        for (const e of g.cases)
          for (const [item, v] of [
            ["state-store sales lost", e.lostSales],
            ["allocation to the two funds", e.allocation.total],
            ["proceeds it is paid from", e.proceeds],
            ["funding requirement on other state money", e.requirement],
            ["change for the two funds", e.fundsChange],
            ["change for every other state fund", e.othersChange],
          ] as [string, number][])
            out.push({
              row_type: "comparison_earmarked",
              item: `3. Arrangement ${e.base === "private" ? "1" : "2"} with a ${e.rule} guarantee (${e.basis === "shift" ? "channel shift only" : e.basis === "all" ? "with the purchase changes" : "exploratory: buyers return to state stores"}): ${item}`,
              baseline: null,
              scenario_a: e.basis === "shift" ? v : null,
              scenario_b: e.basis !== "shift" ? v : null,
              unit: "$ per year",
              basis: "calculated",
            });
    }
    const cols: Column<Row>[] = (["row_type", "item", "baseline", "scenario_a", "scenario_b", "unit", "basis"] as const).map((k) => ({
      key: k,
      kind: k === "baseline" || k === "scenario_a" || k === "scenario_b" ? "number" : "text",
      get: (r: Row) => r[k],
    }));
    const head = [
      `# ${question}`,
      `# Scenario arithmetic on stated assumptions (method ${SCENARIO_METHOD}; ranges and simulation ${RANGES_METHOD}); not a forecast and not an observation. basis=sourced/derived rows come from dataset ${man.dataset.release_label}; basis=user rows are assumptions.`,
      example ? `# Example values in use (${example.label}): illustrations, not estimates.` : "",
      proposal ? `# ${proposal.label}: ${proposal.proposal.map((q) => `${q.item}: ${q.text}`).join(" ")}` : "",
    ]
      .filter(Boolean)
      .join("\r\n");
    return head + "\r\n" + toCsv(cols, out);
  };
  const row = (label: string, base: number | null, a: number | null, b: number | null, strong = false) => (
    <tr key={label}>
      <th scope="row">{strong ? <strong>{label}</strong> : label}</th>
      <td className="num">{base === null ? "" : strong ? <strong>{money(base)}</strong> : money(base)}</td>
      <td className="num">{a === null ? "" : strong ? <strong>{money(a)}</strong> : money(a)}</td>
      {res.b && <td className="num">{b === null ? "" : strong ? <strong>{money(b)}</strong> : money(b)}</td>}
    </tr>
  );
  const fmtRange = (v: number, f: RangeFormat) =>
    f === "percent" ? `${(v * 100).toFixed(1)}%` : f === "money" ? money(v) : f === "money2" ? `$${v.toFixed(2)}` : f === "gallons" ? `${Math.round(v).toLocaleString("en-US")} gal` : v.toFixed(2);
  const evidenceText = { published: "published", data: "from data", convention: "convention" } as const;
  const sensTable = (s: typeof sensA, which: string) => (
    <div className="table-wrap">
      <table className="data">
        <caption className="small">
          Scenario {which}: net change when one assumption moves to the low or high end of its documented range, the others held; largest effect first
        </caption>
        <thead>
          <tr>
            <th scope="col">Assumption and the basis of its range</th>
            <th scope="col" className="num">
              Lower value
            </th>
            <th scope="col" className="num">
              Net change
            </th>
            <th scope="col" className="num">
              Higher value
            </th>
            <th scope="col" className="num">
              Net change
            </th>
            <th scope="col" className="num">
              Net change is zero at
            </th>
          </tr>
        </thead>
        <tbody>
          {s.map((z) => (
            <tr key={z.input}>
              <th scope="row">
                {z.label}
                <div className="muted small">
                  <strong>{evidenceText[z.evidence]}.</strong> {z.basis}
                </div>
              </th>
              <td className="num">{fmtRange(z.low, z.format)}</td>
              <td className="num">{money(z.netLow)}</td>
              <td className="num">{fmtRange(z.high, z.format)}</td>
              <td className="num">{money(z.netHigh)}</td>
              <td className="num">{z.zero === null ? "—" : z.zero.inRange ? <strong>{fmtRange(z.zero.value, z.format)}</strong> : `${fmtRange(z.zero.value, z.format)} (outside the range)`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <section className="panel report" aria-labelledby="scr-h">
        <h2 id="scr-h">Results</h2>
        {example && (
          <p className="warn" role="note">
            <strong>Example values in use ({example.label}).</strong> They are round numbers chosen to show how the calculator works, not estimates for Utah.
            Replace them with values you can source.
          </p>
        )}
        {proposal && <ProposalBox p={proposal} />}
        <p>
          <strong>{question}</strong>
        </p>
        <p className="small">
          Per year, FY{f.fy} dollars, state government only. Every number below is arithmetic on the inputs listed: values from the dataset are
          observations; everything marked as your assumption is not.
        </p>
        <div className="table-wrap">
          <table className="data">
            <caption className="small">Inputs used</caption>
            <thead>
              <tr>
                <th scope="col">Input</th>
                <th scope="col" className="num">
                  Value
                </th>
                <th scope="col">Basis</th>
                <th scope="col">Source or formula</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label}>
                  <th scope="row">{r.label}</th>
                  <td className="num">{r.label === "What the substitution holds constant" ? words(r.unit) : showVal(r)}</td>
                  <td>
                    <Basis b={r.basis} />
                  </td>
                  <td className="small">
                    {r.source}
                    {r.note && <div className="muted">{r.note}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {d.cmp === "1" && (
        <ArrangementComparison
          x={x}
          get={(k) => (d as Record<string, string>)[k] ?? ""}
          fy={f.fy}
          rates={rates}
          rateStatus={rates ? `${statusWords(rates.schoolStatus)}; ${statusWords(rates.enforcementStatus)}` : "not available"}
          baseline={baselineRows(f, x, d, rates)}
          baselineNote={baseYearNote(f.fy)}
          opexShare={f.evidence.opexShare}
          sweepKey={(d.sx || "avoidableCost") as SweepKey}
          bounds={f.bounds}
        />
      )}

      <section className="panel" aria-labelledby="scr-t">
        <h3 id="scr-t">State revenue from wine, per year</h3>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th scope="col">Component</th>
                <th scope="col" className="num">
                  Today
                </th>
                <th scope="col" className="num">
                  Scenario A: purchases move
                </th>
                {res.b && (
                  <th scope="col" className="num">
                    Scenario B: plus extra purchases
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {row("State-store gross margin on wine", res.baseline[0].value, revenueA.find((c) => c.id === "store_margin")!.value, revenueA.find((c) => c.id === "store_margin")!.value + (extraRevenue.find((c) => c.id === "extra_store_margin")?.value ?? 0))}
              {revenueA
                .filter((c) => !["store_margin", "sales_tax"].includes(c.id))
                .map((c) => row(c.label, 0, c.value, c.value + (extraRevenue.find((e) => e.id === `extra_${c.id}`)?.value ?? 0)))}
              {row("State sales tax on wine", res.baseline[1].value, revenueA.find((c) => c.id === "sales_tax")!.value, revenueA.find((c) => c.id === "sales_tax")!.value + (extraRevenue.find((c) => c.id === "extra_sales_tax")?.value ?? 0))}
              {row("State revenue from wine", res.baselineTotal, res.aRevenue, res.aRevenue + sum(extraRevenue), true)}
              {row("Operating costs avoided (+)", null, res.a.find((c) => c.id === "cost_saved")!.value, res.a.find((c) => c.id === "cost_saved")!.value)}
              {row("New licensing and enforcement costs (−)", null, -res.a.find((c) => c.id === "new_costs")!.value, -res.a.find((c) => c.id === "new_costs")!.value)}
              {res.b && row("Operating costs of extra state-store sales (−)", null, null, -(res.b.find((c) => c.id === "extra_cost")?.value ?? 0))}
              {res.b && res.beer && row("Beer excise and sales tax lost (−)", null, null, -sum(res.b.filter((c) => c.kind === "revenue_lost")))}
              {row("Net change compared with today", null, res.netA, res.netB, true)}
            </tbody>
          </table>
        </div>
        <StepsTable steps={steps} />
        <div className="small" aria-hidden="true" style={{ marginTop: 8 }}>
          {[
            ["Scenario A", res.netA],
            ...(res.netB !== null ? [["Scenario B", res.netB] as [string, number]] : []),
          ].map(([label, v]) => (
            <div className="bar-cell" key={label as string}>
              <span style={{ width: "6.5rem" }}>{label}</span>
              <span className="bar" style={{ width: `${Math.max(2, (160 * Math.abs(v as number)) / maxAbs)}px`, background: (v as number) < 0 ? "var(--series-2)" : "var(--series-1)" }} />
              {money(v as number)} ({pctOf(v as number)} of today's wine revenue)
            </div>
          ))}
        </div>
        <ul className="small source-list" style={{ marginTop: 10 }}>
          <li>
            Scenario A changes state revenue by <strong>{money(res.netA)}</strong> a year ({pctOf(res.netA)}): {money(res.perShiftedDollar * 100)} for each $100 of today's sales that moves, before the{" "}
            {money(x.newCosts)} of new costs.
          </li>
          <FundsNote x={x} rates={rates} fy={f.fy} proposal={Boolean(proposal)} />
          {res.breakEvenDiscount.value !== null && (
            <li>
              Break-even discount: {res.breakEvenDiscount.value < 0 ? res.breakEvenDiscount.note : `${(res.breakEvenDiscount.value * 100).toFixed(1)}% — ${res.breakEvenDiscount.note}`}
            </li>
          )}
          <li hidden={x.revenueMode === "wholesale"}>
            Break-even: {res.breakEvenRetained.value === null ? res.breakEvenRetained.note : `${res.breakEvenRetained.value <= 0 ? "" : `${(res.breakEvenRetained.value * 100).toFixed(1)}% — `}${res.breakEvenRetained.note}`}
          </li>
          {(x.revenueMode === "excise" || x.revenueMode === "combo") && res.breakEvenExcise.value !== null && (
            <li>
              Break-even excise:{" "}
              {res.breakEvenExcise.value <= 0 ? res.breakEvenExcise.note : `$${res.breakEvenExcise.value.toFixed(2)} a gallon — ${res.breakEvenExcise.note}`}
            </li>
          )}
          <li>
            Share of wine that must move:{" "}
            {res.breakEvenShift.value === null || res.breakEvenShift.value === 0 ? res.breakEvenShift.note : `${(res.breakEvenShift.value * 100).toFixed(1)}% — ${res.breakEvenShift.note}`}
          </li>
          <SignNote netA={res.netA} sens={sensA} comb={combA} lever={leverA} opexShare={f.evidence.opexShare} fy={f.fy} />
          {res.netB !== null && leverB && (
            <li>
              With the extra purchases of scenario B{x.elasticity != null && res.demandFactor !== null ? ", including the price response" : ""}, state revenue stays unchanged at {leverText(leverB.lever, leverB.value)} (other inputs as entered).
            </li>
          )}
          {res.netB !== null && (
            <li>
              Scenario B adds extra purchases: <strong>{money(res.netB)}</strong> a year in total. The difference from A ({money(res.netB - res.netA)}) comes only from the extra wine
              {res.beer ? ` and the beer it replaces (${Math.round(res.beer.gallons).toLocaleString("en-US")} gallons, ${money(res.beer.dollars)} of beer, holding ${res.beer.basis === "ethanol" ? "pure alcohol" : res.beer.basis} constant)` : ""}.
            </li>
          )}
          {x.passThrough != null && res.priceRatioUsed !== null && (
            <li>
              Pass-through: a grocery price of {((x.priceRatio ?? 1) * 100).toFixed(1)}% of the state-store price with {(x.passThrough * 100).toFixed(0)}% pass-through puts the shelf price at {(res.priceRatioUsed * 100).toFixed(1)}%. Scenario A and scenario B both use that price.
            </li>
          )}
          {res.demandFactor !== null && res.priceRatioUsed !== null && x.elasticity != null && (
            <li>
              Price response: at {(res.priceRatioUsed * 100).toFixed(1)}% of the state-store price and an elasticity of {x.elasticity.toFixed(2)}, the wine that moves is bought at {(res.demandFactor * 100).toFixed(1)}% of its current quantity.
              That is a change in how much is bought, not in where, so it appears in scenario B only.
            </li>
          )}
        </ul>
        {res.extraStreams && (
          <div className="table-wrap">
            <table className="data">
              <caption className="small">Scenario B: where the extra wine comes from, kept separate (at state-store prices; a negative amount is less wine bought)</caption>
              <thead>
                <tr>
                  <th scope="col">Source</th>
                  <th scope="col" className="num">
                    Wine, $ a year
                  </th>
                  <th scope="col" className="num">
                    Gallons
                  </th>
                </tr>
              </thead>
              <tbody>
                {res.extraStreams.map((e) => (
                  <tr key={e.id}>
                    <th scope="row">{e.label}</th>
                    <td className="num">{money(e.dollars)}</td>
                    <td className="num">{x.wineGallons === null ? "" : Math.round(e.gallons).toLocaleString("en-US")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel" aria-labelledby="scr-s">
        <h3 id="scr-s">Which assumptions matter most</h3>
        {sensTable(sensA, "A")}
        {sensB.length > 0 && sensTable(sensB, "B")}
      </section>

      <CombinedBlock x={x} ranges={ranges} />

      <section className="panel" aria-labelledby="scr-l">
        <h2 id="scr-l">
          How this was calculated, and its limits ({SCENARIO_METHOD}; ranges {RANGES_METHOD})
        </h2>
        <ul className="small source-list">
          <li>Today: state revenue from wine = gross margin × wine sales + sales tax rate × wine sales.</li>
          <li>
            Scenario A: margin on the wine still sold by the state + the state's share or taxes on grocery wine + sales tax on all wine at its new shelf price; then add the
            operating costs avoided and subtract new costs. Total wine bought does not change.
          </li>
          <li>Scenario B: scenario A plus the margin, share, taxes and costs on the extra wine only, minus the beer excise and sales tax on any beer it replaces.</li>
          <li>
            Wholesale arrangement: DABS sells the wine to grocers at its shelf price less the discount, so the state keeps the gross margin less the discount on each dollar that
            moves, whatever the grocer charges. With an unchanged shelf price the margin cancels: per dollar that moves the state gives up the discount and saves the avoidable cost.
          </li>
          <li>
            Gross margin (markup earnings) is not net profit: operating costs, earmarked transfers and capital costs come out of it. DABS's net profit to the General Fund is shown above for
            context and is not added, because it already contains the margin.
          </li>
          <li>State-store receipts are not comparable with tax revenue: gross sales include the cost of the product, which is why only the margin enters here.</li>
          <li>
            DABS's annual sales are before sales tax: earlier reports' Note B says sales are reported at published prices with sales taxes excluded, and the FY2025 report lists sales tax separately. The audited state report's lower
            figure is DABS's sales less the two statutory deposits, not tax (the school-meals deposit is documented in the state's report; the enforcement deposit is inferred). The
            monthly reports' gross sales are shelf prices times bottles, and whether those shelf prices include tax is unresolved; the calculator uses only wine's share of them,
            which one tax rate on every beverage would not change.
          </li>
          <li>
            Utah law deposits 10% of the state stores' gross liquor revenue with the Uniform School Fund for school meals and a further share with the alcohol enforcement fund
            (Utah Code §§ 32B-2-304 and -305). Both come out of the gross margin used here, so they are already inside today's revenue and inside what moves. The step-by-step table shows
            them as today's allocation of the margin that moves and never subtracts them again; the net change is the total across state funds, and who receives it depends on how
            the law would treat the new arrangement.
          </li>
          <li>
            DABS figures are transcribed from unaudited annual reports and not reviewed by a person; some years conflict between tables (FY2024 sales). The default gross margin is for all
            products, not wine alone; the margin field offers wine's statutory floor (Utah Code § 32B-2-304) as a one-click alternative, which is a minimum markup and not a measured margin.
          </li>
          <li>
            Scenario B has three sources of extra wine, never merged: easier access (your percentage), the price response of the wine that moves (a constant-elasticity demand curve at your
            elasticity, with the state-store price held fixed and no beer offset), and cross-border recapture (wine now bought outside Utah, which adds to Utah's tax base but not to drinking). Only
            the elasticity has a published source; the access effect and recapture are assumptions no dataset here measures.
          </li>
          <li>
            Every range in the tables is a low and a high value around your entered value. Only the elasticity range has a published basis; the others are conventions, labelled as such. The
            results are sensitivity scenarios: one assumption at a time, then all of them leaning the same way. No probability is given, because the ranges do not rest on evidence that would
            support one.
          </li>
          <li>Not included: local governments' sales tax, grocers' and distributors' profits, one-time implementation costs, purchases across state lines other than any recapture you enter, and any change in drinking, health or safety. This calculator says nothing about health outcomes.</li>
          <li>One year at a time, in that year's dollars. No inflation, growth or timing of the change.</li>
        </ul>
        <p className="small">
          For what happened elsewhere after grocery wine was allowed, see{" "}
          <Go to={{ v: "change" }} reset>
            Before &amp; after
          </Go>{" "}
          (Tennessee 2016). For how Utah compares, see{" "}
          <Go to={{ v: "finder" }} reset>
            Find comparison states
          </Go>
          .
        </p>
      </section>

      <SaveBar
        view="scenario"
        method={SCENARIO_METHOD}
        manifest={man}
        defaultName={proposal ? `${proposal.label}, FY${f.fy}` : example ? `Utah scenario (${example.label}, example values)` : `Utah scenario FY${f.fy}`}
        inputs={{ v: "scenario", ...Object.fromEntries(Object.entries(d).filter(([, val]) => val !== "")), fy: String(f.fy) }}
        csv={{ name: `utah_wine_scenario_FY${f.fy}.csv`, make: csv }}
        results={() => ({
          kind: "scenario (assumptions, not observations)",
          question,
          inputs: rows.map((r) => ({ input: r.label, value: r.value, unit: r.unit, basis: r.basis })),
          baseline_total: res.baselineTotal,
          net_change_a: res.netA,
          net_change_b: res.netB,
          break_even_retained_share: res.breakEvenRetained.value,
          break_even_discount: res.breakEvenDiscount.value,
          break_even_lever_b: leverB,
          steps_a: steps,
          proposal: proposal ? { id: proposal.id, label: proposal.label, proposal: proposal.proposal } : null,
          comparison:
            comparison && !comparison.missing.length && !comparison.invalid.length
              ? {
                  method: ARRANGEMENTS_METHOD,
                  headline: comparison.headline,
                  price_case: comparison.priceCase,
                  arrangements: [comparison.private, comparison.wholesale].map((a) => ({
                    id: a.id,
                    label: a.label,
                    lines: a.lines,
                    net_with_purchase_changes: a.netAll,
                    net_buyers_return_exploratory: a.channelReturn?.net ?? null,
                    mechanisms: a.mechanisms,
                    volume: a.volumeAll ?? a.volumeShift,
                    price: a.price,
                    break_even: a.breakEven,
                    sellers: a.sellers,
                    sellers_at_break_even: a.sellersAtBreakEven,
                    viability: a.viability,
                  })),
                  earmarked: comparison.earmarked,
                  earmarked_with_purchase_changes: comparison.earmarkedAll,
                  earmarked_buyers_return_exploratory: comparison.earmarkedReturn,
                  guarantees: comparison.guarantees.map((g) => ({ rule: g.rule, cases: g.cases })),
                  note: "Proposed arrangements, not current law; state government only; arithmetic on stated assumptions, not a forecast.",
                }
              : null,
          ranges_method: RANGES_METHOD,
          ranges_from_evidence: d.ev === "1",
          sensitivity_scenarios: {
            note: "Each input at the end of its range that lowers or raises the net change, all at once; an extreme combination, not a probability interval.",
            a: combinedScenarios(x, "A", ranges),
            b: x.extra ? combinedScenarios(x, "B", ranges) : null,
          },
        })}
      />
    </>
  );
}

interface RatesNow extends DepositRates {
  schoolStatus: string;
  enforcementStatus: string;
}

/** The comparison's baseline: each figure with its source, year, units, coverage and standing (task: a defensible
 * baseline). The audited fund's sales are a cross-check and never an input; the monthly reports' tax basis stays out. */
function baselineRows(f: Facts, x: ScenarioInputs, d: Draft, rates: RatesNow | null): BaselineRow[] {
  const pct = (v: number | null | undefined, k = 1) => (v === null || v === undefined ? "—" : `${(v * 100).toFixed(k)}%`);
  const unrev = "transcribed by hand, not reviewed by a person";
  const link = (key: Key, o: Obs | undefined, label: string) => (o ? <RecordLink rec={`obs:${M[key]}:${o.observation_id}`}>{label}</RecordLink> : "not in the dataset");
  const rows: BaselineRow[] = [
    {
      input: "DABS liquor sales",
      value: money(f.sales?.value),
      units: "$ a year",
      source: link("sales", f.sales, `DABS annual report, FY${f.fy}`),
      coverage: "All products, all customers (state stores, package agencies, licensees); before sales tax (earlier reports' Note B; FY2025 lists it separately) and before the two statutory deposits",
      status: `Observation, ${unrev}; used through the wine share`,
    },
  ];
  if (d.wr === "share")
    rows.push({
      input: "Wine's share of DABS sales",
      value: pct(num(d.ws) === null ? null : num(d.ws)! / 100),
      units: "share of gross sales",
      source: "Entered; the tool offers wine's share in DABS's twelve FY2026 monthly Sales Analysis Reports",
      coverage: "Wine over all products at shelf prices; a later fiscal year than the sales",
      status: "The reader's choice (the monthly reports are parsed, not reviewed); a ratio, so their unresolved tax basis barely matters",
    });
  rows.push(
    {
      input: "Wine sales at state-store prices (used)",
      value: money(x.wineSales),
      units: "$ a year",
      source: d.wr === "share" ? "Derived: share × DABS liquor sales" : d.wr === "gallons" ? "Derived: gallons × an entered price per gallon" : "Entered",
      coverage: "All wine customers, including restaurants and bars, which would not move to grocers; the household share below limits what can move",
      status: d.wr === "enter" ? "The reader's assumption" : "Derived",
    },
    {
      input: "Household share of wine sales (used)",
      value: x.eligible === undefined || x.eligible === null ? "—" : pct(x.eligible, 0),
      units: "share of sales",
      source:
        num(d.hh) !== null ? (
          "Entered"
        ) : f.offPremise ? (
          <>
            DABS's off-premise share of its sales ({link("offPremise", f.offPremise, `annual report FY${f.offPremise.year}, p. 18`)}): {f.offPremise.value}%
          </>
        ) : (
          "Not in the dataset"
        ),
      coverage: "All products in DABS's chart (stores and package agencies against licensees); no wine split is published, so applying it to wine is an assumption",
      status: num(d.hh) !== null ? "The reader's assumption" : `Observation (read from a chart's printed labels, ${unrev}); uncertain for wine`,
    },
    {
      input: "Gross margin (used)",
      value: pct(x.grossMargin),
      units: "share of sales",
      source: num(d.gm) !== null ? "Entered" : <>DABS gross profit ÷ liquor sales, FY{f.fy} ({link("gp", f.gp, "gross profit")})</>,
      coverage: "All products; wine's own margin is not in the data (the statutory minimum markup gives 46.95%)",
      status: num(d.gm) !== null ? "The reader's assumption" : `Derived from observations (${unrev}); applying it to wine is an assumption`,
    },
    ...(f.bounds
      ? [
          {
            input: "Expense lines that could move with sales (context for the avoidable cost)",
            value: `${pct(f.bounds.avoidLow)} to ${pct(f.bounds.avoidHigh)}`,
            units: "share of sales",
            source: `DABS annual report, FY${f.fy}, schedule of operating expenses`,
            coverage: "Card fees, package agency contracts and bags; the upper figure adds every salary and wage (stores, warehouse and offices). Delivery to stores is a further " + pct(f.bounds.delivery) + ", which stops only if the state stops wholesaling the wine. All products.",
            status: "Observations (transcribed, not reviewed); which part of them would actually stop is the avoidable-cost assumption",
          } as BaselineRow,
        ]
      : []),
    {
      input: "Operating expenses (context, not used)",
      value: pct(f.evidence.opexShare),
      units: "share of sales",
      source: link("opex", f.opex, `DABS annual report, FY${f.fy}`),
      coverage: "All products, fixed and variable together",
      status: "Context only: how much of it would stop is the avoidable-cost assumption",
    },
  );
  if (f.audited?.value != null && f.sales?.value != null && rates) {
    const dabsNet = f.sales.value * (1 - rates.school - rates.enforcement);
    rows.push({
      input: "Audited cross-check (not used)",
      value: money(f.audited.value),
      units: "$ a year",
      source: link("audited", f.audited, `State of Utah ACFR, FY${f.fy}: the Alcoholic Beverage Services Fund's sales`),
      coverage: "The fund's sales, which leave out the school-meals deposit (documented) and the enforcement deposit (inferred)",
      status: `Audited (transcribed, not reviewed). DABS's sales less both deposits at the rates in law are ${money(dabsNet)}; the audited figure differs by ${money(f.audited.value - dabsNet)}: a check on the baseline, not a substitute for it`,
    });
  }
  rows.push(
    {
      input: "State sales tax rate (used)",
      value: pct(x.salesTax, 2),
      units: "% of the shelf price",
      source: "Entered; the tool offers Utah State Tax Commission Publication 25 (pages marked draft)",
      coverage: "The state's portion only; local sales tax is not modelled",
      status: `The reader's assumption: the dataset does not establish the rate for FY${f.fy}`,
    },
    {
      input: "Statutory deposit rates (allocation rows only)",
      value: rates ? `${pct(rates.school, 0)} + ${pct(rates.enforcement, 3)}` : "—",
      units: "% of gross liquor revenue",
      source: "Utah Code §§ 32B-2-304 (school meals) and 32B-2-305 (enforcement)",
      coverage: `In force in FY${f.fy}; paid out of the gross margin, so already inside it`,
      status: rates ? `Law: ${statusWords(rates.schoolStatus)}; ${statusWords(rates.enforcementStatus)} (a legal reading by Claude, not reviewed)` : "Not available",
    },
    {
      input: "Monthly gross sales (not used)",
      value: "—",
      units: "$",
      source: "DABS monthly Sales Analysis Reports",
      coverage: "Shelf prices times bottles",
      status: "Whether shelf prices include sales tax is unresolved, so their dollar totals stay out of the baseline",
    },
  );
  if (x.wineGallons !== null)
    rows.push({
      input: "Wine gallons (an excise and the volume rows only)",
      value: `${Math.round(x.wineGallons).toLocaleString("en-US")}`,
      units: "gallons a year",
      source: num(d.gal) !== null ? "Entered" : link("gallons", f.gallons, `NIAAA, calendar ${f.cal}`),
      coverage: "All wine shipped to Utah, restaurants included; a calendar year",
      status: num(d.gal) !== null ? "The reader's assumption" : "Observation (published series)",
    });
  return rows;
}

/** Why the base year is or is not a good one for the comparison (docs/fiscal-reconciliation.md). */
function baseYearNote(fy: number): string {
  if (fy === 2025)
    return "Why FY2025: it is the latest year with a single DABS sales figure, and DABS's sales less the two statutory deposits match the audited fund's sales within $0.08 million. FY2024 has two DABS sales figures, and FY2023-FY2024 carry an unexplained gap of about $16 million against the audited fund. The wine share is from FY2026, the only complete year of monthly reports.";
  if (fy === 2023 || fy === 2024)
    return `Caution: FY${fy} sits in the unexplained FY2023-FY2024 gap of about $16 million between DABS's figures and the audited fund${fy === 2024 ? ", and DABS prints two FY2024 sales figures" : ""}. FY2025 is the better base year for the comparison.`;
  return `FY${fy} reconciles with Census's receipts after the two deposits, but it is older than FY2025, and the wine share offered is from FY2026. FY2025 is the better base year for the comparison.`;
}

/** The two statutory deposit rates in force in the base year (reconciliation.json), with their evidence status. */
function useDepositRates(fy: number): RatesNow | null {
  const rec = useData<Reconciliation>("reconciliation.json");
  const rates = rec.data?.deposit_rates ?? [];
  const at = (dep: "school_meals" | "enforcement_fund") => rates.find((r) => r.deposit === dep && r.fiscal_year_from <= fy && fy <= r.fiscal_year_to) ?? null;
  const school = at("school_meals");
  const enf = at("enforcement_fund");
  return school && enf ? { school: school.rate, enforcement: enf.rate, schoolStatus: school.status, enforcementStatus: enf.status } : null;
}

const statusWords = (s: string) => (s === "documented" ? "documented" : s === "documented_provisional" ? "documented, read online" : s === "inferred" ? "inferred" : s);

/** Scenario A from today's revenue to the net change (lib/scenario stepsA). */
function StepsTable({ steps }: { steps: BridgeStep[] }) {
  if (!steps.length) return null;
  return (
    <div className="table-wrap">
      <table className="data">
        <caption className="small">
          Scenario A step by step, $ per year. The steps add up to the net change. The “of which” rows split the first step by today's allocation of that margin and are not added again.
        </caption>
        <thead>
          <tr>
            <th scope="col">Step</th>
            <th scope="col" className="num">
              Change in state revenue
            </th>
            <th scope="col">How it is calculated</th>
          </tr>
        </thead>
        <tbody>
          {steps.map((st) => (
            <tr key={st.id}>
              <th scope="row" style={st.part === "of" ? { paddingLeft: "1.5rem", fontWeight: "normal" } : undefined}>
                {st.part === "total" ? <strong>{st.label}</strong> : st.label}
              </th>
              <td className="num">{st.part === "of" ? <span className="muted">({money(st.value)})</span> : st.part === "total" ? <strong>{money(st.value)}</strong> : money(st.value)}</td>
              <td className="small">{st.formula}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The total across state funds versus who receives it. The deposits are today's allocation of the margin that moves. */
function FundsNote({ x, rates, fy, proposal }: { x: ScenarioInputs; rates: RatesNow | null; fy: number; proposal: boolean }) {
  if (!rates || !x.wineSales || !x.shift) return null;
  const shifted = x.wineSales * movedShare(x);
  const pct = (v: number) => `${Number((v * 100).toFixed(3))}%`;
  const d = x.revenueMode === "wholesale" ? (x.discount ?? null) : null;
  return (
    <li>
      Total and distribution: the net change counts all state funds together. Of the margin on the sales that move, {money(rates.school * shifted)} ({pct(rates.school)}) is today's allocation to the
      Uniform School Fund for school meals and {money(rates.enforcement * shifted)} ({pct(rates.enforcement)}) to the alcohol enforcement fund (FY{fy} rates in law: {statusWords(rates.schoolStatus)};{" "}
      {statusWords(rates.enforcementStatus)}). They are part of the margin already counted, not extra losses. Whether those funds keep that money depends on how the law treats the new
      arrangement, which {proposal ? "the proposal" : "this scenario"} does not decide; moving money between funds does not change the total.
      {d !== null &&
        ` If DABS's sales to grocers carried the deposits at the same rates, on its price to grocers (${pct(1 - d)} of the shelf price), they would be ${money(rates.school * (1 - d) * shifted)} and ${money(rates.enforcement * (1 - d) * shifted)}.`}
    </li>
  );
}

const LEVER_LABEL: Record<Lever, string> = {
  retained: "a share kept of",
  discount: "a discount to grocers of",
  excise: "an excise of",
  adValorem: "an extra tax on the shelf price of",
};

function leverText(lever: Lever, v: number): string {
  return `${LEVER_LABEL[lever]} ${lever === "excise" ? `$${v.toFixed(2)} a gallon` : `${(v * 100).toFixed(1)}%`}`;
}

/** Whether the sign of scenario A's result could reverse, and what it would take. */
function SignNote({ netA, sens, comb, lever, opexShare, fy }: { netA: number; sens: Sensitivity[]; comb: Combined | null; lever: { lever: Lever; value: number } | null; opexShare: number | null; fy: number }) {
  const sign = netA < 0 ? "a loss" : netA > 0 ? "a gain" : "no change";
  const within = sens.filter((z) => z.zero?.inRange);
  const outside = sens.filter((z) => z.zero && !z.zero.inRange);
  const lc = (t: string) => (/^[A-Z][a-z]/.test(t) ? t[0].toLowerCase() + t.slice(1) : t);
  const fmt = (z: Sensitivity) => `${lc(z.label)} at ${fmtSetting(z.zero!.value, z.format)}`;
  const cost = sens.find((z) => z.input === "avoidableCost" && z.zero);
  const other = netA < 0 ? comb?.high.net : comb?.low.net;
  return (
    <li>
      Could the result reverse? Scenario A is {sign}.{" "}
      {within.length ? `One assumption at a time, it reverses within its documented range: ${within.map(fmt).join("; ")}.` : "No single assumption reverses it within its documented range."}{" "}
      {outside.length ? `Outside those ranges it would take ${outside.map(fmt).join("; ")}, others as entered.` : ""}{" "}
      {other !== undefined && Math.sign(other) !== Math.sign(netA) && netA !== 0
        ? `Every assumption leaning the other way at once gives ${money(other)}.`
        : other !== undefined
          ? `Even every assumption leaning the other way at once gives ${money(other)}.`
          : ""}{" "}
      {lever ? `The arrangement breaks even at ${leverText(lever.lever, lever.value)}.` : ""}{" "}
      {cost && opexShare !== null
        ? `For scale: all of DABS's operating expenses were ${(opexShare * 100).toFixed(1)}% of its sales in FY${fy} (its income statement lists depreciation and interest separately), an accounting ceiling for the whole business, not an estimate of what moving wine would save.`
        : ""}
    </li>
  );
}

/** The worked proposal: the policy, each assumption's standing, what it shows and what it cannot. */
function ProposalBox({ p }: { p: WorkedProposal }) {
  const tag = { data: "from the data", assumption: "assumption", policy: "the policy" } as const;
  return (
    <div className="note" role="note">
      <p style={{ marginTop: 0 }}>
        <strong>{p.label}.</strong> One explicit policy worked through with the dataset's figures and stated assumptions: an illustration of how such a proposal would change state finances, not a bill and not a forecast. Change any input above and
        press Run to try your own; this description then no longer applies.
      </p>
      <div className="table-wrap">
        <table className="data">
          <caption className="small">The proposal and the standing of each part</caption>
          <tbody>
            {p.proposal.map((q) => (
              <tr key={q.item}>
                <th scope="row">{q.item}</th>
                <td className="small">{q.text}</td>
                <td>
                  <span className={`input-basis ${q.basis === "data" ? "sourced" : "user"}`}>{tag[q.basis]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small" style={{ marginBottom: 0 }}>
        <strong>What it shows.</strong>
      </p>
      <ul className="small source-list">
        {p.demonstrates.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <p className="small" style={{ marginBottom: 0 }}>
        <strong>What it cannot establish.</strong>
      </p>
      <ul className="small source-list">
        {p.cannotEstablish.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </div>
  );
}
