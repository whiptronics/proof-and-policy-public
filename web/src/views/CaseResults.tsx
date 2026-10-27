// Results of the worked example's pre-specified before-and-after comparison (lib/caseResults, case-results@1.0;
// docs/analyses/tn-2016-grocery-wine/specification.md and results.md). Every figure is computed on the page by the
// dashboard's existing tools (before-after@1.2 and comparison-finder@1.1). Descriptive only: no effect is estimated,
// and nothing here feeds the Utah fiscal scenario.
import { useMemo } from "react";
import { ErrorNote, Go, Loading } from "../components/common";
import { TrendChart } from "../components/TrendChart";
import { CHANGE_METHOD } from "../lib/change";
import { CASE_RESULTS_METHOD, caseResultsFor, computeCaseResults, metricsNeeded, substitutionRows, summarize, type CaseResults, type History, type Run } from "../lib/caseResults";
import { decodeMetric, useMany } from "../lib/data";
import { FINDER_METHOD } from "../lib/finder";
import { geoName } from "../lib/format";
import { buildSeries, policyAnnotations } from "../lib/series";
import type { Geography, MetricFile, MetricsIndex, PolicyEvent } from "../lib/types";
import { TN_EXAMPLE, changePatch } from "./ChangeView";

const HISTORY_WORDS: Record<History, string> = {
  verified_unchanged: "verified unchanged 2011-2019",
  verified_one_day: "verified on one day only",
  not_coded: "history not coded",
};

const num = (v: number | null | undefined, d = 3) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : `${v < 0 ? "−" : ""}${Math.abs(v).toFixed(d)}`);
const signed = (v: number | null | undefined, d = 3) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : `${v < 0 ? "−" : "+"}${Math.abs(v).toFixed(d)}`);
const pts = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : `${v < 0 ? "−" : "+"}${Math.abs(v).toFixed(1)}`);
const money = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : `${v < 0 ? "−" : ""}$${(Math.abs(v) / 1e6).toFixed(1)}M`);
const pct = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : `${v < 0 ? "−" : "+"}${Math.abs(v).toFixed(1)}%`);
const years = (ys: number[], fiscal: boolean) => (ys.length ? `${fiscal ? "FY" : ""}${ys[0]}–${fiscal ? "FY" : ""}${ys[ys.length - 1]}` : "—");

function value(run: Run, v: number | null | undefined) {
  return run.outcome.group === "revenue" && run.shown === "real_cy2024" ? money(v) : num(v);
}

export function CaseResultsSection({ caseId, idx, geos, events }: { caseId: string; idx: MetricsIndex; geos: Geography[]; events: PolicyEvent[] }) {
  const s = caseResultsFor(caseId);
  const metas = s ? metricsNeeded(s).map((id) => idx.metrics.find((m) => m.metric_id === id)).filter((m) => m !== undefined) : [];
  const files = useMany<MetricFile>(s ? metas.map((m) => m!.file) : []);
  const res = useMemo<CaseResults | null>(() => {
    if (!s || !files.data) return null;
    const map = new Map(metas.map((m, i) => [m!.metric_id, files.data![i]]));
    const states = geos.filter((g) => g.geo_level === "state").map((g) => g.geo_id);
    return computeCaseResults(s, { idx, files: map, states, name: (g) => geoName(g, geos) });
    // metas follows from s and idx, which are fixed for the page.
  }, [s, files.data, idx, geos]);
  if (!s) return null;
  if (files.error) return <ErrorNote error={files.error} />;
  if (!res) return <Loading what="the planned comparison" />;
  const name = (g: string) => geoName(g, geos);
  const mainPool = res.pools[s.mainPool];
  const beverages = res.main.filter((r) => r.outcome.group === "beverage");
  const revenue = res.main.filter((r) => r.outcome.group === "revenue");
  const sub = substitutionRows(res);
  const wine = summarize(res.main.find((r) => r.outcome.id === "B1")!);
  const beer = summarize(res.main.find((r) => r.outcome.id === "B2")!);
  const all = summarize(res.main.find((r) => r.outcome.id === "B4")!);
  const t10 = res.main.find((r) => r.outcome.id === "R1")!;
  const t10s = summarize(t10);
  const allPlacebo = res.main.find((r) => r.outcome.id === "B4")!.placebo?.pooled ?? null;
  const beerPlacebo = res.main.find((r) => r.outcome.id === "B2")!.placebo?.pooled ?? null;
  const linkPool = res.pools.P3;
  const toChange = (outcomes: { metric: string; shown: Run["shown"] }[]) =>
    changePatch({ ...TN_EXAMPLE, comparisons: linkPool, outcomes, before: s.main.before, after: s.main.after.calendar_year, includeTransition: false });

  return (
    <section className="panel" aria-labelledby="cr-h">
      <h3 id="cr-h">6. {s.title}</h3>
      <div className="note small">
        Planned before any of these results were computed: <span className="mono">{s.specDoc}</span> (windows, outcomes, comparison
        states, exclusions and sensitivity checks fixed from policy history and pre-2016 data). Results and their reading:{" "}
        <span className="mono">{s.resultsDoc}</span>. Descriptive comparisons of changes; no effect is estimated, and the gated
        synthetic-control protocol is not run. Methods: {CASE_RESULTS_METHOD}, {CHANGE_METHOD}, {FINDER_METHOD}.
      </div>

      <h4>What is compared</h4>
      <ul className="small source-list">
        <li>
          Change date {s.date}, by local option: licenses issued only where a referendum passed, so every Tennessee figure averages
          places that adopted it and places that did not. Calendar 2016 is the transition year: charted, left out of every average.
          Tennessee's fiscal year starts July 1, so FY2017 is the first after year; each other state keeps its own fiscal year.
        </li>
        <li>
          Before: 2011–2015 (FY2012–FY2016). After: 2017–2019 (FY2017–FY2019), stopping before the pandemic, so follow-up is only three
          years; longer follow-up is a sensitivity check below. Every average needs every year to have a value, and a year one state
          lacks is dropped for all (for example FY2016, which straddles the date in Alabama's October–September year).
        </li>
        <li>
          Beverage outcomes are NIAAA apparent consumption, gallons of ethanol per resident 21+: sales and shipments, which include
          visitors' and cross-border purchases and the stocking of a new channel. They are purchases, not measured drinking, and
          being in one unit (ethanol) they can be compared across beverages. Beverage gallons are never added together.
        </li>
        <li>
          Main comparison: all eight bordering states, equally weighted (
          {mainPool.map((g) => `${name(g)}: ${HISTORY_WORDS[s.history[g]]}`).join("; ")}). No state is excluded: none has a verified
          grocery-wine change in 2011–2019. Utah is not a comparison state.
        </li>
      </ul>

      <h4>Raw trends</h4>
      <p className="small muted">Tennessee and the eight bordering states, before any averaging. The numbered marker is the change date.</p>
      <div className="grid-2">
        {res.main.map((r) => (
          <RawTrend key={r.outcome.id} run={r} idx={idx} files={files.data!} metas={metas} geos={geos} events={events} target={s.target} />
        ))}
      </div>

      <h4>Comparison of changes, main specification</h4>
      <div className="table-wrap">
        <table className="data">
          <caption className="small">
            Tennessee's change between the window averages, beside the bordering states' average change. Log points = 100 × ln(after ÷
            before); the difference in log points is symmetric between states. None of these series has a published sampling interval,
            so no confidence interval is shown; the last three columns show how large ordinary variation is instead, and none of them is
            a probability interval.
          </caption>
          <thead>
            <tr>
              <th>Outcome</th>
              <th className="num">Tennessee, before → after</th>
              <th className="num">Tennessee change</th>
              <th className="num">Neighbours' average change (log points)</th>
              <th className="num">Difference (log points)</th>
              <th className="num">Leave one state out</th>
              <th>Tennessee inside the neighbours' range of changes?</th>
              <th>Placebo dates: typical gap; share as large</th>
            </tr>
          </thead>
          <tbody>
            {res.main.map((r) => {
              const x = summarize(r);
              const fiscal = r.periodKind === "state_fiscal_year";
              const p = r.placebo?.pooled ?? null;
              const poolLog = x.tnLog !== null && x.diffLog !== null ? x.tnLog - x.diffLog : null;
              return (
                <tr key={r.outcome.id}>
                  <th scope="row">
                    {r.outcome.label}
                    <div className="small muted">{r.outcome.treatedOnly ? "Tennessee only: no comparison-state equivalent" : `${years(x.beforeYears, fiscal)} vs ${years(x.afterYears, fiscal)}`}</div>
                  </th>
                  <td className="num">
                    {value(r, x.tnBefore)} → {value(r, x.tnAfter)}
                  </td>
                  <td className="num">
                    {r.outcome.group === "revenue" ? money(x.tnChange) : signed(x.tnChange)} ({pct(x.tnPct)}; {pts(x.tnLog)} pts)
                  </td>
                  <td className="num">{r.outcome.treatedOnly ? "—" : pts(poolLog)}</td>
                  <td className="num">
                    <strong>{r.outcome.treatedOnly ? "—" : pts(x.diffLog)}</strong>
                  </td>
                  <td className="num">{x.looLogRange ? `${pts(x.looLogRange[0])} to ${pts(x.looLogRange[1])}` : "—"}</td>
                  <td className="small">{x.spread ? (x.spread.targetInside ? "Yes" : "No: outside every neighbour's change") : "—"}</td>
                  <td className="small">
                    {p && p.enough
                      ? `${r.outcome.group === "revenue" ? money(p.typical) : num(p.typical)} (actual ${r.outcome.group === "revenue" ? money(p.actual) : num(p.actual)}); ${Math.round((p.share ?? 0) * 100)}% of ${p.n} earlier dates`
                      : r.outcome.treatedOnly
                        ? "—"
                        : (r.placebo?.why ?? "too few placebo dates")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="small muted">
        Placebo dates repeat the comparison at July 1 of earlier years whose windows end before 2016; the typical gap is the median
        absolute pooled difference in changes there, in the outcome's own units, and "share as large" counts the real one. Windows
        overlap, so the share is a rough guide. These checks do not cover the comparison states' own policy changes (unknown for six
        of eight), the unknown local exposure, cross-border buying, reclassification between beverages or errors in the source data.
      </p>
      {res.main
        .filter((r) => !r.outcome.treatedOnly && r.result?.computable)
        .map((r) => (
          <details key={r.outcome.id} className="small">
            <summary>
              {r.outcome.label}: each state, and what before-period trends alone would give
            </summary>
            <StateTable run={r} name={name} history={s.history} />
          </details>
        ))}
      <p className="small">
        Open the beverage outcomes in{" "}
        <Go to={toChange(beverages.map((r) => ({ metric: r.metric, shown: r.shown })))} reset>
          Before &amp; after
        </Go>{" "}
        or the T10 receipts there (
        <Go to={toChange(revenue.filter((r) => !r.outcome.treatedOnly).map((r) => ({ metric: r.metric, shown: r.shown })))} reset>
          link
        </Go>
        ), with the worked example's four-state shortlist: that view holds at most five comparison states, so the eight-state main
        comparison is computed on this page with the same functions.
      </p>

      <h4>Sensitivity checks</h4>
      <div className="table-wrap">
        <table className="data">
          <caption className="small">Difference in log points between Tennessee's change and the comparison pool's average change, with the leave-one-out range. A sensitivity result is reported beside the main one; none replaces it.</caption>
          <thead>
            <tr>
              <th>Specification</th>
              {[...beverages, ...revenue.filter((r) => !r.outcome.treatedOnly)].map((r) => (
                <th key={r.outcome.id} className="num">
                  {r.outcome.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <SensitivityRow label="Main: eight bordering states, 2011–2015 vs 2017–2019" runs={res.main} ids={[...beverages, ...revenue].filter((r) => !r.outcome.treatedOnly).map((r) => r.outcome.id)} />
            {res.sensitivity.map((v) => (
              <SensitivityRow
                key={v.variant.id}
                label={`${v.variant.id}: ${v.variant.label}${v.variant.pool === "P4" ? ` (${res.pools.P4.map(name).join(", ")})` : ""}`}
                runs={v.runs}
                ids={[...beverages, ...revenue].filter((r) => !r.outcome.treatedOnly).map((r) => r.outcome.id)}
              />
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted">
        S2 runs past Tennessee's unexplained FY2022 jump in T10 (+39% nominal). S6 is total gallons, so population growth is not removed.
        The finder pool (P4) ranks the bordering states on the finder's default characteristics over 2011–2015 only.
      </p>

      <h4>What this suggests about substitution</h4>
      <div className="table-wrap">
        <table className="data">
          <caption className="small">Main specification, gallons of ethanol per resident 21+ (one unit for every beverage)</caption>
          <thead>
            <tr>
              <th>Beverage</th>
              <th className="num">Tennessee change</th>
              <th className="num">Neighbours' average change</th>
              <th className="num">Difference</th>
            </tr>
          </thead>
          <tbody>
            {sub.map((x) => (
              <tr key={x.id}>
                <th scope="row">{x.label}</th>
                <td className="num">{signed(x.tn)}</td>
                <td className="num">{signed(x.pool)}</td>
                <td className="num">
                  <strong>{signed(x.diff)}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="small source-list">
        <li>
          Wine purchases rose more in Tennessee than in every bordering state ({signed(wine.diffChange)} gallons of ethanol per adult
          against the neighbours' average, {pts(wine.diffLog)} log points), and no earlier placebo date shows a gap that large. Most of
          the rise came as a step in 2016, the year grocery licenses began, and the level then held.
        </li>
        <li>
          Tennessee's beer purchases fell, but about as much as the neighbours' ({signed(beer.diffChange)} gallons against their average;
          typical placebo gap {num(beerPlacebo?.typical ?? null)}). Wine rose and beer declined; the comparison does not establish that
          grocery wine caused people to switch beverages, and under the reading rule fixed in the specification the wine increase was
          not matched by a relative fall in beer or spirits.
        </li>
        <li>
          Total ethanol rose relative to the neighbours ({signed(all.diffChange)} gallons, {pts(all.diffLog)} log points), by about as
          much as wine and spirits together. That gap is not unusual for these states: earlier placebo
          dates give a typical gap of {num(allPlacebo?.typical ?? null)} and {Math.round((allPlacebo?.share ?? 0) * 100)}% of them are as
          large, and Tennessee's spirits were already rising faster before 2016.
        </li>
        <li>
          These are aggregate purchases in a state. They cannot show whether the same people switched beverages, whether drinking (as
          opposed to purchases) changed, or that grocery wine caused any of it: cross-border buying, stocking of the new channel, the
          minimum-price law that began the same day and a possible reclassification of strong beer (account 11002's FY2018 relabelling)
          could each move these series.
        </li>
      </ul>

      <h4>Revenue</h4>
      <ul className="small source-list">
        <li>
          Census T10 (all beverages, constant 2024 dollars) rose {pct(t10s.tnPct)} in Tennessee between FY2012–FY2015 and FY2017–FY2019,{" "}
          {pts(t10s.diffLog)} log points more than the neighbours. But Tennessee's T10 was already rising by about{" "}
          {money(t10.result?.states[0].slope ?? null)} a year before the change. Extending that trend in a straight line covers most of
          the gap against the four states where the "trends only" figure's interval excludes zero (per-state table above); this is
          arithmetic, not a measure of what the change caused. T10 cannot isolate wine
          or grocery stores.
        </li>
        <li>
          Tennessee's wine-tax account (all channels, constant 2024 dollars) averaged {money(summarize(res.main.find((r) => r.outcome.id === "R2")!).tnBefore)} in
          FY2012–FY2016 and {money(summarize(res.main.find((r) => r.outcome.id === "R2")!).tnAfter)} in FY2017, its only year before the
          account also took in high-alcohol beer. It had already risen in FY2016, before any grocery license. The wine enforcement tax
          rose {pct(summarize(res.main.find((r) => r.outcome.id === "R3")!).tnPct)} on the same windows. Neither has a comparison-state
          equivalent here.
        </li>
      </ul>

      <h4>What this cannot establish about Utah</h4>
      <ul className="small source-list">
        <li>
          Tennessee's change is a local-option reform in a state whose spirits and wine are sold by private licensees; Utah sells both
          through state stores and agencies, so its revenue arrives as store profit, which T10 does not measure.
        </li>
        <li>
          It is a description of purchases relative to neighbours, not an effect estimate, so it is not carried into the Utah fiscal
          scenario's demand assumptions. It does not show what Utah households would buy, or whether beer-to-wine switching would offset
          any revenue loss there.
        </li>
        <li>It does weaken, for this one case, the idea that grocery wine mainly replaces beer: no relative fall in beer appears.</li>
      </ul>

      <h4>Missing evidence that most limits the reading</h4>
      <ol className="small source-list">
        <li>Which Tennessee localities adopted grocery wine, when, and how many stores were licensed (the share of the state exposed).</li>
        <li>The statutory basis of account 11002's FY2018 relabelling and whether NIAAA's Tennessee beer and wine series changed classification.</li>
        <li>Grocery-wine and alcohol-tax histories for six of the eight neighbours (only Kentucky and Virginia are verified).</li>
        <li>Monthly sales around July 2016, to separate stocking from sustained purchases, and any measure of cross-border buying.</li>
        <li>Household purchase panels or surveys that follow the same people, the only data that could show switching between beverages.</li>
      </ol>
    </section>
  );
}

function RawTrend({ run, idx, files, metas, geos, events, target }: { run: Run; idx: MetricsIndex; files: MetricFile[]; metas: (MetricsIndex["metrics"][number] | undefined)[]; geos: Geography[]; events: PolicyEvent[]; target: string }) {
  const i = metas.findIndex((m) => m?.metric_id === run.metric);
  const meta = metas[i];
  if (!meta) return null;
  const dm = decodeMetric(files[i]);
  const fiscal = meta.period_kind === "state_fiscal_year";
  const domain: [number, number] = fiscal ? [2008, Math.min(meta.last_year ?? 2025, 2025)] : [2006, meta.last_year ?? 2024];
  const geoList = [target, ...run.geos];
  const built = geoList.map((g) => ({ g, b: buildSeries(meta, dm, g, run.shown, idx) }));
  const ann = policyAnnotations(events.filter((e) => e.policy_id === "tn_ordinary_grocery_wine_local_option_2016"), target, meta.period_kind, idx.fiscal_year_rules, domain);
  return (
    <div>
      <h5>{run.outcome.label}</h5>
      <p className="small muted">{run.outcome.note}</p>
      <TrendChart
        series={built.map((x) => ({ key: `${run.outcome.id}|${x.g}`, label: geoName(x.g, geos), points: x.b.points }))}
        unit={built[0]?.b.unit ?? meta.unit}
        domain={domain}
        annotations={ann}
        title={run.outcome.label}
      />
    </div>
  );
}

function StateTable({ run, name, history }: { run: Run; name: (g: string) => string; history: Record<string, History> }) {
  const r = run.result!;
  const diffs = new Map(r.diffs.map((d) => [d.geo, d]));
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>State</th>
            <th>Grocery-wine history</th>
            <th className="num">Before</th>
            <th className="num">After</th>
            <th className="num">Change (log points)</th>
            <th className="num">Tennessee minus this state</th>
            <th className="num">If before trends had continued</th>
          </tr>
        </thead>
        <tbody>
          {r.states.map((st, k) => {
            const d = diffs.get(st.geo);
            return (
              <tr key={st.geo}>
                <th scope="row">{name(st.geo)}</th>
                <td className="small">{k === 0 ? "the reform state" : HISTORY_WORDS[history[st.geo]]}</td>
                <td className="num">{value(run, st.beforeMean)}</td>
                <td className="num">{value(run, st.afterMean)}</td>
                <td className="num">{pts(st.logChange === null ? null : 100 * st.logChange)}</td>
                <td className="num">{k === 0 ? "—" : run.outcome.group === "revenue" ? money(d?.diffChange) : signed(d?.diffChange)}</td>
                <td className="num">
                  {k === 0 ? "—" : run.outcome.group === "revenue" ? money(d?.trendOnly) : signed(d?.trendOnly)}
                  {k > 0 && d?.trendReliable === true ? " (interval excludes zero)" : ""}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SensitivityRow({ label, runs, ids }: { label: string; runs: Run[]; ids: string[] }) {
  return (
    <tr>
      <th scope="row" className="small">
        {label}
      </th>
      {ids.map((id) => {
        const r = runs.find((x) => x.outcome.id === id);
        if (!r) return <td key={id} className="num muted">·</td>;
        const x = summarize(r);
        return (
          <td key={id} className="num">
            {pts(x.diffLog)}
            {x.looLogRange && <div className="small muted">{`${pts(x.looLogRange[0])} to ${pts(x.looLogRange[1])}`}</div>}
          </td>
        );
      })}
    </tr>
  );
}
