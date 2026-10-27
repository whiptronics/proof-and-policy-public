// Utah at a glance: how Utah sells alcohol (verified law), Utah's latest value and rank on each supported
// measure (ranked only among states with a value for the same year, definition and form), and a few
// comparison candidates chosen by the comparison finder's own scoring, with why they were chosen, how they
// differ and what the dataset cannot yet say about them. Everything links into the detailed tools.
import { ErrorNote, Go, Loading, RecordLink, SourceNote } from "../components/common";
import { ControlDims, assessAll } from "../components/ControlFilter";
import { TrendChart } from "../components/TrendChart";
import { analysisPatch, fromConfig, snapshotsFor, yearStatuses } from "../lib/analysis";
import { CONTROL_DIMS, criterionById, verdictText } from "../lib/control";
import { decodeMetric, useData, useMany } from "../lib/data";
import { CHARACTERISTICS, FINDER_METHOD, characteristicData, rankCandidates, similarityWord, type CharData } from "../lib/finder";
import { geoName, precise, unitAfter, unitLabel, words } from "../lib/format";
import { standing, type GlancePoint } from "../lib/glance";
import { rankRangeText } from "../lib/ranks";
import { buildSeries, type Shown } from "../lib/series";
import { intervalKind, intervalPhrase, seFromInterval } from "../lib/stats";
import { metricSourceIds } from "../lib/sources";
import type { Geography, Manifest, MetricFile, MetricMeta, MetricsIndex, PolicyData, SavedAnalysisConfig, SourcesData } from "../lib/types";
import { navigate, pickOne, useParams, type Patch } from "../lib/url";
import { ReconciliationPanel } from "../components/ReconciliationPanel";

const UT = "state:49";
const WINE = "ordinary_grocery_wine_authorization";
/** The finder's default baseline, so "Open in the finder" reproduces this list exactly. */
const BASE_FROM = 2015;
const BASE_TO = 2019;
/** States whose governments also wholesale spirits under current law, coded in batch 10 from statute text. */
const CONTROL_PEERS = ["state:51", "state:42", "state:16", "state:41"];

interface Measure {
  id: string;
  metric: string;
  shown: Shown;
  label: string;
  /** The label on its own, where the table row's "…" would not make sense. */
  full?: string;
  map: Patch;
  note?: string;
}

const MEASURES: Measure[] = [
  { id: "alcohol", metric: "niaaa_ethanol_per_capita_21plus_all@calendar_year", shown: "nominal", label: "Pure alcohol sold per resident 21+", map: { mm: "alcohol_per_adult" } },
  { id: "wine", metric: "niaaa_ethanol_per_capita_21plus_wine@calendar_year", shown: "nominal", label: "… from wine", full: "Pure alcohol sold per resident 21+, from wine", map: { mm: "alcohol_per_adult", bv: "wine" } },
  { id: "beer", metric: "niaaa_ethanol_per_capita_21plus_beer@calendar_year", shown: "nominal", label: "… from beer", full: "Pure alcohol sold per resident 21+, from beer", map: { mm: "alcohol_per_adult", bv: "beer" } },
  { id: "spirits", metric: "niaaa_ethanol_per_capita_21plus_spirits@calendar_year", shown: "nominal", label: "… from spirits", full: "Pure alcohol sold per resident 21+, from spirits", map: { mm: "alcohol_per_adult", bv: "spirits" } },
  { id: "spending", metric: "bea_pce_off_premises_alcohol@calendar_year", shown: "per_resident_21plus", label: "Take-home alcohol spending per resident 21+", map: { mm: "alcohol_spending" } },
  {
    id: "taxes",
    metric: "stc_alcoholic_beverages_sales_tax@state_fiscal_year",
    shown: "per_resident_21plus",
    label: "State alcohol taxes per resident 21+",
    map: { mm: "alcohol_taxes", sh: "per_resident_21plus" },
    note: "Excludes state-store profit, which is most of Utah's alcohol money; Census's Utah series breaks in FY2018.",
  },
  { id: "drinking", metric: "brfss_drank_any_past_30d_pct@survey_year", shown: "nominal", label: "Adults who drank in the past 30 days", map: { mm: "adults_drinking" } },
  { id: "binge", metric: "brfss_binge_5m_4f_pct@survey_year", shown: "nominal", label: "Adults who binge drank", map: { mm: "adults_binge" } },
  { id: "binge_aa", metric: "brfss_binge_age_adjusted_pct@survey_year", shown: "nominal", label: "… age-adjusted", full: "Adults who binge drank, age-adjusted", map: { mm: "adults_binge_age_adjusted" } },
  { id: "students", metric: "yrbs_current_alcohol_use_hs_pct@survey_year", shown: "nominal", label: "High school students who drank", map: { mm: "students_drinking" } },
  {
    id: "liver",
    metric: "cdi_chronic_liver_disease_mortality_age_adjusted_rate@calendar_year",
    shown: "nominal",
    label: "Chronic liver disease deaths per 100,000",
    map: { mm: "liver_deaths" },
    note: "Not only alcohol-related.",
  },
  { id: "driving", metric: "fars_alcohol_impaired_driving_deaths_per_100k@calendar_year", shown: "nominal", label: "Alcohol-impaired-driving deaths per 100,000", map: { mm: "impaired_driving_deaths" } },
  { id: "income", metric: "bea_per_capita_personal_income@calendar_year", shown: "nominal", label: "Personal income per person", map: { mm: "income" } },
];

export function UtahView() {
  const params = useParams();
  const idx = useData<MetricsIndex>("metrics.json");
  const geos = useData<Geography[]>("geographies.json");
  const pol = useData<PolicyData>("policy.json");
  const man = useData<Manifest>("manifest.json");
  const src = useData<SourcesData>("sources.json");
  const saved = useData<{ analyses: SavedAnalysisConfig[] }>("analyses.json");
  const chars = CHARACTERISTICS.filter((c) => c.defaultOn);
  const ids = [...new Set([...MEASURES.map((m) => m.metric), ...chars.map((c) => c.metric)])];
  const metas = ids.map((id) => idx.data?.metrics.find((m) => m.metric_id === id));
  const files = useMany<MetricFile>(idx.data ? metas.filter((m): m is MetricMeta => Boolean(m)).map((m) => m.file) : []);
  const err = idx.error ?? geos.error ?? pol.error ?? man.error ?? src.error ?? saved.error ?? files.error;
  if (err) return <ErrorNote error={err} />;
  if (!idx.data || !geos.data || !pol.data || !man.data || !src.data || !saved.data || !files.data) return <Loading what="Utah at a glance" />;

  const G = geos.data;
  const name = (g: string) => geoName(g, G);
  const states = G.filter((g) => g.geo_level === "state").map((g) => g.geo_id);
  const present = metas.filter((m): m is MetricMeta => Boolean(m));
  const fileOf = new Map(present.map((m, i) => [m.metric_id, files.data![i]]));
  const metaOf = (id: string) => present.find((m) => m.metric_id === id);
  const lookup = { metrics: idx.data.metrics, monthly: [], sources: src.data };

  // ----- measures: Utah's latest value and its standing among comparable states
  const rows = MEASURES.flatMap((m) => {
    const meta = metaOf(m.metric);
    const file = fileOf.get(m.metric);
    if (!meta || !file) return [];
    const dm = decodeMetric(file);
    const unit = unitAfter(meta.unit, m.shown);
    const pointsOf = (g: string): GlancePoint[] =>
      buildSeries(meta, dm, g, m.shown, idx.data!).rows.map((r) => ({
        year: r.obs.year,
        value: m.shown === "nominal" ? r.obs.value : (r.shown?.value ?? null),
        group: r.obs.comparability_group,
        // The published interval belongs to the published value only, not to a per-resident or other derived form.
        se: m.shown === "nominal" ? seFromInterval(r.obs.ci_low, r.obs.ci_high, r.obs.ci_level, r.obs.value) : null,
      }));
    const byGeo = new Map([...states, "nation:us"].map((g) => [g, pointsOf(g)]));
    const st = standing(byGeo, UT);
    const ut = byGeo.get(UT)!.filter((p) => p.value !== null);
    const us = "year" in st ? byGeo.get("nation:us")!.find((p) => p.year === st.year && p.value !== null) : undefined;
    // What the intervals behind the rank range describe: survey sampling error, or chance variation in a count of deaths.
    const withSe = buildSeries(meta, dm, UT, "nominal", idx.data!).rows.find((r) => r.obs.ci_low !== null && r.obs.ci_high !== null);
    const ivWhat = intervalPhrase(intervalKind(withSe ? withSe.obs : {}));
    return [{ m, meta, unit, st, ut, us, ivWhat }];
  });
  const measureSources = [...new Set(rows.flatMap((r) => metricSourceIds(r.meta, r.m.shown, lookup)))];

  // ----- comparison candidates: the comparison finder's scoring with its defaults
  const cd: CharData[] = chars.map((c) => characteristicData(c, metaOf(c.metric), fileOf.get(c.metric), { target: UT, from: BASE_FROM, to: BASE_TO }, states, idx.data!));
  const pool = states.filter((g) => g !== UT);
  const { used, ranked, diffOf } = rankCandidates(cd, UT, pool, name, {}, 1);
  const eligible = ranked.filter((r) => r.eligible);
  const top = eligible.slice(0, 5).map((r) => r.item);
  const rankOf = new Map(eligible.map((r, i) => [r.item, { rank: i + 1, score: r.score }]));
  const control = assessAll(pol.data, criterionById("same_as_target")!, states, UT, () => ({ from: `${BASE_FROM}-01-01`, to: `${BASE_TO}-12-31` }));
  const utNow = assessAll(pol.data, criterionById("same_as_target")!, [UT], UT, () => ({ from: pol.data!.as_of_date, to: pol.data!.as_of_date })).get(UT)!;
  const charSources = [...new Set(used.flatMap((x) => (x.meta ? metricSourceIds(x.meta, x.c.shown, lookup) : [])))];

  const wineStatus = (g: string) => {
    const ys = yearStatuses(pol.data!.segments, g, WINE, BASE_FROM, BASE_TO, pol.data!.as_of_date);
    const vals = [...new Set(ys.flatMap((y) => y.values))];
    if (ys.every((y) => y.kind === "known") && vals.length === 1) return { verified: true, text: `${words(vals[0])} (verified ${BASE_FROM}–${BASE_TO})` };
    const snap = snapshotsFor(pol.data!.snapshots, g, WINE).pop();
    return { verified: false, text: `not verified for ${BASE_FROM}–${BASE_TO}${snap ? `; current law: ${words(snap.policy_value)} (${snap.observed_on ?? snap.observed_year})` : ""}` };
  };
  const why = (g: string) => {
    const parts = used.map((x) => ({ x, d: diffOf(x, g) }));
    const sim = parts.filter((p) => similarityWord(p.d, p.x.c.kind) === "similar").map((p) => p.x.c.label.toLowerCase());
    const mid = parts.filter((p) => similarityWord(p.d, p.x.c.kind) === "in between").map((p) => p.x.c.label.toLowerCase());
    const diff = parts.filter((p) => similarityWord(p.d, p.x.c.kind) === "different").map((p) => p.x.c.label.toLowerCase());
    return { sim, mid, diff };
  };
  const controlDiffs = (g: string) => {
    const a = control.get(g)!;
    const out: string[] = [];
    for (const d of CONTROL_DIMS) {
      const mine = a.dims.find((x) => x.dim === d.dim)!;
      const utah = utNow.dims.find((x) => x.dim === d.dim)!;
      const theirs = mine.value ?? mine.snapshots[0]?.policy_value ?? null;
      if (theirs && utah.value && theirs !== utah.value) out.push(`${d.short.toLowerCase()}: ${words(theirs)}${mine.value ? "" : " (current law)"}`);
    }
    return out;
  };

  const chartMeasure = MEASURES.find((m) => m.id === pickOne(params.get("gm"), MEASURES.map((x) => x.id), "alcohol"))!;
  const chartMeta = metaOf(chartMeasure.metric);
  const chartGeos = [UT, ...top.slice(0, 3), ...(chartMeasure.shown === "nominal" ? ["nation:us"] : [])];
  const chartSeries =
    chartMeta && fileOf.get(chartMeasure.metric)
      ? chartGeos.map((g) => ({ key: g, label: name(g), points: buildSeries(chartMeta, decodeMetric(fileOf.get(chartMeasure.metric)!), g, chartMeasure.shown, idx.data!).points }))
      : [];
  // Every supported measure is zero or more, so the chart starts at zero rather than exaggerating gaps.
  const chartValues = chartSeries.flatMap((s) => s.points.map((p) => p.value)).filter((v): v is number => v !== null);
  const chartTop = chartValues.length && Math.min(...chartValues) >= 0 ? Number((Math.max(...chartValues) * 1.05).toPrecision(2)) : 0;
  const analyses = saved.data.analyses.filter((a) => a.analysis_id.startsWith("utah_and_liquor_control_peers"));
  const fmtPoint = (v: number | null, unit: string) => (v === null ? "—" : precise(v, unit));

  return (
    <>
      <section className="panel" aria-labelledby="ut-h">
        <h2 id="ut-h">Utah at a glance</h2>
        <p>
          Where Utah stands on each measure the dataset supports, how Utah sells alcohol, and which states are reasonable places to start comparing.
          Every number is descriptive: a rank says where Utah's value falls, not whether it is good or bad, and not why.
        </p>
      </section>

      <section className="panel report" aria-labelledby="ut-law">
        <h3 id="ut-law">How Utah sells alcohol</h3>
        <ControlDims a={utNow} />
        <p className="small">
          Verified in every version of the Utah Code: the department is the only wholesaler of liquor (spirits and wine) from 2003-05-05, and state
          stores and contract package agencies are the retail channel from 2011-07-01; grocery stores may not sell wine under an ordinary license
          (from 2003-05-05). Earlier days are unknown in the dataset, not assumed. Beer up to the legal strength limit is sold privately.{" "}
          <Go to={{ v: "timeline", geo: UT }} reset>
            All of Utah's coded law
          </Go>
          .
        </p>
        <SourceNote ids={["utah_code_history", "utah_session_laws"]} label="Law source" />
      </section>

      <section className="panel report" aria-labelledby="ut-m">
        <h3 id="ut-m">Utah's latest values</h3>
        <p className="small muted">
          Rank 1 = the highest value. Each rank counts only states with a value for Utah's latest year, under the same definition and in the same
          form, so it never mixes years. The year and the number of states ranked are shown on every row. Where the source publishes a 95% interval for each state, the
          rank range is the 5th to 95th percentile of Utah's rank when every state's value is redrawn within its interval. For survey measures the interval is
          sampling error; for deaths (FARS) it is chance variation in the yearly count, since FARS lists every fatal crash. Either way it is an approximate range
          for this one state, not a joint statement about all ranks.
        </p>
        <div className="table-wrap">
          <table className="data">
            <caption className="visually-hidden">Utah's latest value, comparison year, rank among comparable states, and the U.S. value</caption>
            <thead>
              <tr>
                <th scope="col" className="wide-col">Measure</th>
                <th scope="col" className="num">
                  Utah
                </th>
                <th scope="col">Year</th>
                <th scope="col">Rank among states and DC</th>
                <th scope="col" className="num">
                  United States
                </th>
                <th scope="col">Utah over time</th>
                <th scope="col" className="no-print">
                  Explore
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ m, meta, unit, st, ut, us, ivWhat }) => {
                const first = ut.find((p) => p.year >= ("year" in st ? st.year - 14 : 0));
                return (
                  <tr key={m.id}>
                    <th scope="row">
                      {m.label}
                      <div className="small muted">
                        {unitLabel(unit)}
                        {m.note ? `. ${m.note}` : ""}
                      </div>
                    </th>
                    <td className="num">{"year" in st ? fmtPoint(st.value, unit) : "—"}</td>
                    <td>{"year" in st ? (meta.period_kind === "state_fiscal_year" ? `FY${st.year}` : st.year) : "—"}</td>
                    <td className="small">
                      {"year" in st ? (
                        <>
                          <strong>{st.rank}</strong> of {st.n}
                          {st.rankRange && (
                            <div className="muted">
                              rank range {rankRangeText(st.rankRange.low, st.rankRange.high)} allowing for {ivWhat}
                              {st.rankRange.withMargins < st.n ? ` (${st.rankRange.withMargins} of ${st.n} states have a published interval; the rest are held fixed)` : ""}
                            </div>
                          )}
                          {st.laterElsewhere > 0 && <div className="muted">{st.laterElsewhere} states have later values, not compared</div>}
                          {st.otherDefinition > 0 && <div className="muted">{st.otherDefinition} under another definition, left out</div>}
                        </>
                      ) : (
                        <span className="muted">{st.why}</span>
                      )}
                    </td>
                    <td className="num">{us ? fmtPoint(us.value, unit) : <span className="muted small">{m.shown === "nominal" ? "no value" : "states only"}</span>}</td>
                    <td className="small">
                      <Sparkline points={ut.filter((p) => !first || p.year >= first.year)} />
                      {first && "year" in st && first.year !== st.year ? ` ${first.year}: ${fmtPoint(first.value, unit)} → ${st.year}: ${fmtPoint(st.value, unit)}` : ""}
                    </td>
                    <td className="small no-print">
                      <Go to={{ v: "map", ...m.map, sel: UT }} reset>
                        map
                      </Go>{" "}
                      ·{" "}
                      <Go to={{ v: "explore", m: m.metric, g: [UT, "nation:us"].join(","), tf: m.shown === "nominal" ? null : m.shown }} reset>
                        trend
                      </Go>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <SourceNote ids={measureSources} derived />
      </section>

      <section className="panel report" aria-labelledby="ut-c">
        <h3 id="ut-c">States to compare with Utah: candidates</h3>
        <p className="small">
          The five states most like Utah in {BASE_FROM}–{BASE_TO} on {used.map((x) => x.c.label.toLowerCase()).join(", ")}, scored by the comparison
          finder (method {FINDER_METHOD}, its default characteristics and weights, with no state left out for its grocery-wine law, so a state
          whose law changed in these years can appear; the finder's own default leaves such states out), and four states whose governments also wholesale spirits under current law. They are
          candidates for a comparison, not matched controls: each differs from Utah in ways listed here and in many not measured.
        </p>
        <div className="table-wrap">
          <table className="data">
            <caption className="visually-hidden">Comparison candidates for Utah: why each was chosen, how it differs, and what is not yet known</caption>
            <thead>
              <tr>
                <th scope="col">State</th>
                <th scope="col" className="wide-col">Why it is a candidate</th>
                <th scope="col" className="wide-col">Important differences</th>
                <th scope="col" className="wide-col">Gaps in policy history</th>
              </tr>
            </thead>
            <tbody>
              {[...top.map((g) => ({ g, group: "similar" })), ...CONTROL_PEERS.filter((g) => !top.includes(g)).map((g) => ({ g, group: "control" }))].map(({ g, group }) => {
                const w = why(g);
                const r = rankOf.get(g);
                const cdiff = controlDiffs(g);
                const wine = wineStatus(g);
                const a = control.get(g)!;
                return (
                  <tr key={g}>
                    <th scope="row">
                      {name(g)}
                      <div className="small muted">
                        {r ? `finder rank ${r.rank} of ${eligible.length}` : "not scored"}
                        {group === "control" ? "; liquor-control peer" : ""}
                      </div>
                    </th>
                    <td className="small">
                      {group === "control" ? "The state wholesales spirits under current law. " : ""}
                      {w.sim.length ? `Similar (under 0.5 SD) on ${w.sim.join(", ")}.` : "Not within 0.5 SD on any default characteristic."}
                      {w.mid.length > 0 && ` Somewhat different (0.5 to 1 SD) on ${w.mid.join(", ")}.`}
                      {r && r.score !== null && ` Overall score ${r.score.toFixed(2)} (0 = identical).`}
                    </td>
                    <td className="small">
                      {w.diff.length > 0 && <div>Different (over 1 SD) on {w.diff.join(", ")}.</div>}
                      {cdiff.length > 0 && <div>Liquor control: {cdiff.join("; ")}.</div>}
                      {!w.diff.length && !cdiff.length && <span className="muted">None found among the measured characteristics and coded law.</span>}
                    </td>
                    <td className="small">
                      <div>Liquor control {BASE_FROM}–{BASE_TO}: {verdictText(a)}.</div>
                      <div>Grocery-store wine: {wine.text}.</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="small">
          <Go to={{ v: "finder", t: UT, y0: BASE_FROM, y1: BASE_TO, ex: "none", ca: "same_as_target" }} reset>
            Open these settings in the comparison finder
          </Go>{" "}
          to change the characteristics, weights or years, or to rank only states verified to share Utah's arrangement.
        </p>
        <SourceNote ids={[...charSources, "state_alcohol_law", "utah_code_history"]} derived />
      </section>

      <section className="panel report" aria-labelledby="ut-g">
        <h3 id="ut-g">Utah and the top candidates over time</h3>
        <label className="no-print">
          Measure{" "}
          <select value={chartMeasure.id} onChange={(e) => navigate({ gm: e.target.value }, { replace: true })}>
            {MEASURES.filter((m) => metaOf(m.metric)).map((m) => (
              <option key={m.id} value={m.id}>
                {m.full ?? m.label}
              </option>
            ))}
          </select>
        </label>
        {chartMeta && chartSeries.length > 0 ? (
          <TrendChart
            series={chartSeries}
            unit={unitAfter(chartMeta.unit, chartMeasure.shown)}
            domain={[Math.max(chartMeta.first_year, 2000), chartMeta.last_year]}
            yDomain={chartTop > 0 ? [0, chartTop] : undefined}
            title={`${chartMeasure.full ?? chartMeasure.label}: Utah and ${top.slice(0, 3).map(name).join(", ")}`}
            height={260}
          />
        ) : (
          <p className="small muted">This measure is not in this build.</p>
        )}
        {chartMeta && <SourceNote ids={metricSourceIds(chartMeta, chartMeasure.shown, lookup)} derived={chartMeasure.shown !== "nominal"} />}
      </section>

      <ReconciliationPanel />

      <section className="panel no-break" aria-labelledby="ut-s">
        <h3 id="ut-s">Starting points</h3>
        <ul className="source-list">
          {analyses.map((a) => (
            <li key={a.analysis_id}>
              <Go to={analysisPatch(fromConfig(a), a.analysis_id)} reset>
                {a.title}
              </Go>
              <div className="small muted">{a.cannot_show[0]}</div>
            </li>
          ))}
          <li>
            <Go to={{ v: "map", mm: "alcohol_per_adult", bv: "wine", ca: "same_as_target", sel: UT }} reset>
              Map: wine sold per adult, with each state's liquor-control arrangement compared to Utah's
            </Go>
          </li>
          <li>
            <Go to={{ v: "fiscal", ca: "spirits_retail_government" }} reset>
              Revenue by state, with the states whose governments sell spirits marked
            </Go>
          </li>
          <li>
            <Go to={{ v: "change" }} reset>
              Before &amp; after: Tennessee's 2016 grocery-store wine
            </Go>
          </li>
          <li>
            <Go to={{ v: "scenario" }} reset>
              Utah revenue scenarios
            </Go>
          </li>
        </ul>
        <p className="small muted">
          Dataset {man.data.dataset.release_label}. Policy records are machine-checked, not reviewed by a person (for example,{" "}
          <RecordLink rec={`policy:ut_spirits_retail_state_stores_and_agencies`}>Utah's spirits retail record</RecordLink>).
        </p>
      </section>
    </>
  );
}

/** A small trend line for a table row; the row's text carries the values. */
function Sparkline({ points }: { points: GlancePoint[] }) {
  const pts = points.filter((p) => p.value !== null);
  if (pts.length < 2) return null;
  const xs = pts.map((p) => p.year);
  const ys = pts.map((p) => p.value!);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const X = (x: number) => 2 + ((x - x0) / (x1 - x0 || 1)) * 76;
  const Y = (y: number) => 18 - ((y - y0) / (y1 - y0 || 1)) * 16;
  // Break the line where a year is missing or the definition changes.
  let d = "";
  pts.forEach((p, i) => {
    const prev = pts[i - 1];
    const join = prev && p.year - prev.year <= 2 && prev.group === p.group;
    d += `${join ? "L" : "M"}${X(p.year).toFixed(1)},${Y(p.value!).toFixed(1)}`;
  });
  return (
    <svg width="80" height="20" viewBox="0 0 80 20" aria-hidden="true" className="sparkline">
      <path d={d} fill="none" stroke="var(--series-1)" strokeWidth="1.5" />
    </svg>
  );
}
