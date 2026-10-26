// Explore: any measures, jurisdictions and years, with a coded policy shown underneath. Each measure gets
// its own chart, so two measures never share an axis. The policy is shown as its verified status by
// calendar year; a dated snapshot appears only in the year it was observed. The selection lives in the
// URL, so a link reproduces it, and saved analyses (worked-example panels, checked starting points, and
// selections saved in this browser or to a file) reopen it.
import { useRef } from "react";
import { Empty, ErrorNote, Go, Loading, RecordLink, SourceRef } from "../components/common";
import { PolicyByYear } from "../components/PolicyByYear";
import { SaveBar } from "../components/SaveBar";
import { TrendChart, type ChartPoint } from "../components/TrendChart";
import { MAX_GEOS, MAX_METRICS, SHOWN, analysisPatch, caseAnalyses, fromConfig, readAnalysis, sameAnalysis, statusChanges, type Allowed, type Analysis } from "../lib/analysis";
import type { ObsRow } from "../lib/bundle";
import { compatible } from "../lib/compare";
import { toCsv, type Column } from "../lib/csv";
import { decodeMetric, useData, useMany } from "../lib/data";
import { CONVERSION_LABELS, PERIOD_KIND_LABELS, formatValue, geoName, unitLabel, words } from "../lib/format";
import { buildSeries, changeAnnotations, type BuiltSeries } from "../lib/series";
import type { CaseStudy, Geography, Manifest, MetricFile, MetricMeta, MetricsIndex, PolicyData, SavedAnalysisConfig } from "../lib/types";
import { navigate, useParams, type Patch } from "../lib/url";
import { DownloadRows } from "./RevenueView";

const DEFAULT: Analysis = {
  metrics: ["niaaa_ethanol_per_capita_21plus_wine@calendar_year"],
  geos: ["state:49", "state:47"],
  from: 2000,
  to: 2024,
  shown: "nominal",
  base: null,
  policy: "ordinary_grocery_wine_authorization",
};

const PERIOD_SHORT: Record<string, string> = {
  point_in_time: "single date",
  calendar_year: "calendar year",
  state_fiscal_year: "state fiscal year",
  survey_year: "survey year",
  month: "month",
  pooled_years: "pooled years",
};
const LEVEL_LABELS: Record<string, string> = { state: "States", census_region: "Census regions", nation: "United States" };

interface Origin {
  id: string;
  title: string;
  question: string | null;
  notes: string[];
  cannotShow: string[];
  missing: string[];
  caseId: string | null;
  analysis: Analysis;
}

interface Panel {
  meta: MetricMeta;
  built: { geo: string; b: BuiltSeries }[];
}

function allowedFor(idx: MetricsIndex, geos: Geography[], pol: PolicyData): Allowed {
  const coded = new Set([
    ...pol.segments.filter((s) => s.state !== "unknown").map((s) => s.policy_dimension),
    ...pol.snapshots.map((s) => s.policy_dimension),
  ]);
  return {
    metrics: idx.metrics.map((m) => m.metric_id),
    geos: geos.map((g) => g.geo_id),
    policies: Object.keys(pol.dimensions).filter((d) => coded.has(d)),
    yearMin: Math.min(...idx.metrics.map((m) => m.first_year)),
    yearMax: Math.max(Number(pol.as_of_date.slice(0, 4)), ...idx.metrics.map((m) => m.last_year)),
  };
}

export function ExploreView() {
  const params = useParams();
  const idx = useData<MetricsIndex>("metrics.json");
  const geos = useData<Geography[]>("geographies.json");
  const pol = useData<PolicyData>("policy.json");
  const cases = useData<{ cases: CaseStudy[] }>("cases.json");
  const saved = useData<{ analyses: SavedAnalysisConfig[] }>("analyses.json");
  const man = useData<Manifest>("manifest.json");
  const addMetric = useRef<HTMLSelectElement>(null);
  const addGeo = useRef<HTMLSelectElement>(null);
  const allowed = idx.data && geos.data && pol.data ? allowedFor(idx.data, geos.data, pol.data) : null;
  const a = allowed ? readAnalysis(params, allowed, DEFAULT) : null;
  const metas = a && idx.data ? a.metrics.map((id) => idx.data!.metrics.find((m) => m.metric_id === id)!) : [];
  const files = useMany<MetricFile>(metas.map((m) => m.file));
  const err = idx.error ?? geos.error ?? pol.error ?? cases.error ?? saved.error ?? man.error ?? files.error;
  if (err) return <ErrorNote error={err} />;
  if (!idx.data || !geos.data || !pol.data || !cases.data || !saved.data || !man.data || !a || !allowed) return <Loading what="the explorer" />;
  const G = geos.data;
  const P = pol.data;
  const name = (g: string) => geoName(g, G);
  const set = (patch: Patch, replace = false) => navigate(patch, { replace });
  const focusLater = (el: { current: HTMLElement | null }) => setTimeout(() => el.current?.focus(), 0);

  // Where this selection came from, when it was opened from a saved analysis.
  const sid = params.get("a");
  let origin: Origin | null = null;
  if (sid?.startsWith("case:")) {
    for (const c of cases.data.cases) {
      const x = caseAnalyses(c, idx.data.metrics, P.events).find((y) => y.id === sid);
      if (x) origin = { id: x.id, title: `${c.title}: ${x.title}`, question: c.question, notes: [x.note], cannotShow: [], missing: [], caseId: c.case_id, analysis: x.analysis };
    }
  } else if (sid) {
    const c = saved.data.analyses.find((x) => x.analysis_id === sid);
    if (c) origin = { id: c.analysis_id, title: c.title, question: c.question, notes: c.notes, cannotShow: c.cannot_show, missing: c.metrics_without_data, caseId: null, analysis: fromConfig(c) };
  }

  const panels: Panel[] = files.data
    ? metas.map((m, i) => ({ meta: m, built: a.geos.map((g) => ({ geo: g, b: buildSeries(m, decodeMetric(files.data![i]), g, a.shown, idx.data!, a.base ?? undefined) })) }))
    : [];
  const allRows: ObsRow[] = panels.flatMap((p) => p.built.flatMap((x) => x.b.rows.filter((r) => r.obs.year >= a.from && r.obs.year <= a.to)));
  const families = Object.keys(idx.data.families);
  const codedGeos = (d: string) =>
    new Set([...P.segments.filter((s) => s.policy_dimension === d && s.state !== "unknown").map((s) => s.geo_id), ...P.snapshots.filter((s) => s.policy_dimension === d).map((s) => s.geo_id)]);
  const byCategory = new Map<string, string[]>();
  for (const d of allowed.policies) {
    const cat = P.dimensions[d]?.category ?? "other";
    byCategory.set(cat, [...(byCategory.get(cat) ?? []), d]);
  }
  const levels = [...new Set(G.map((g) => g.geo_level))];

  return (
    <>
      <section className="panel" aria-labelledby="ex-h">
        <h2 id="ex-h">Explore</h2>
        <p className="small muted">
          Choose up to {MAX_METRICS} measures, up to {MAX_GEOS} jurisdictions and a span of years; a coded policy can be shown
          underneath. Each measure gets its own chart. Lines break at a missing year or a change of definition, and every
          point opens its record. The address bar holds the whole selection, so a link reproduces it. Descriptive only:
          nothing here estimates an effect.
        </p>
        <div className="controls">
          <div className="field">
            Measures
            <div className="row-actions" style={{ margin: 0 }}>
              {metas.length === 0 && <span className="muted small">none chosen</span>}
              {metas.map((m) => (
                <button
                  type="button"
                  key={m.metric_id}
                  aria-label={`Remove ${m.label} (${PERIOD_SHORT[m.period_kind] ?? m.period_kind})`}
                  onClick={() => {
                    set({ m: a.metrics.filter((x) => x !== m.metric_id).join(",") || "none" });
                    focusLater(addMetric);
                  }}
                >
                  {m.label} ✕
                </button>
              ))}
            </div>
          </div>
          {a.metrics.length < MAX_METRICS && (
            <label>
              Add a measure
              <select ref={addMetric} value="" onChange={(e) => e.target.value && set({ m: [...a.metrics, e.target.value].join(",") })}>
                <option value="">Choose…</option>
                {families.map((f) => {
                  const ms = idx.data!.metrics.filter((m) => m.family === f && !a.metrics.includes(m.metric_id)).sort((x, y) => x.label.localeCompare(y.label));
                  if (!ms.length) return null;
                  return (
                    <optgroup key={f} label={idx.data!.families[f].label}>
                      {ms.map((m) => (
                        <option key={m.metric_id} value={m.metric_id}>
                          {m.label} — {PERIOD_SHORT[m.period_kind] ?? m.period_kind}, {m.first_year}–{m.last_year}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            </label>
          )}
        </div>
        <div className="controls">
          <div className="field">
            Jurisdictions
            <div className="row-actions" style={{ margin: 0 }}>
              {a.geos.length === 0 && <span className="muted small">none chosen</span>}
              {a.geos.map((g) => (
                <button
                  type="button"
                  key={g}
                  aria-label={`Remove ${name(g)}`}
                  onClick={() => {
                    set({ g: a.geos.filter((x) => x !== g).join(",") || "none" });
                    focusLater(addGeo);
                  }}
                >
                  {name(g)} ✕
                </button>
              ))}
            </div>
          </div>
          {a.geos.length < MAX_GEOS && (
            <label>
              Add a jurisdiction
              <select ref={addGeo} value="" onChange={(e) => e.target.value && set({ g: [...a.geos, e.target.value].join(",") })}>
                <option value="">Choose…</option>
                {levels.map((lv) => (
                  <optgroup key={lv} label={LEVEL_LABELS[lv] ?? words(lv)}>
                    {G.filter((g) => g.geo_level === lv && !a.geos.includes(g.geo_id)).map((g) => (
                      <option key={g.geo_id} value={g.geo_id}>
                        {g.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
          )}
        </div>
        <div className="controls">
          <label>
            From
            <input type="number" value={a.from} min={allowed.yearMin} max={a.to} onChange={(e) => set({ y0: e.target.value, y1: a.to }, true)} />
          </label>
          <label>
            To
            <input type="number" value={a.to} min={a.from} max={allowed.yearMax} onChange={(e) => set({ y0: a.from, y1: e.target.value }, true)} />
          </label>
          <label>
            Show values as
            <select value={a.shown} onChange={(e) => set({ tf: e.target.value === "nominal" ? null : e.target.value, base: null })}>
              {SHOWN.map((s) => (
                <option key={s} value={s}>
                  {s === "nominal" ? "As published" : CONVERSION_LABELS[s]}
                </option>
              ))}
            </select>
            <span className="help">Constant dollars and per-resident values apply to dollar amounts only; a measure without them says why.</span>
          </label>
          {a.shown === "index" && (
            <label>
              Base year
              <input type="number" value={a.base ?? a.from} min={a.from} max={a.to} onChange={(e) => set({ base: e.target.value }, true)} />
              <span className="help">Each state's value in this year = 100.</span>
            </label>
          )}
          <label>
            Policy shown underneath
            <select value={a.policy ?? "none"} onChange={(e) => set({ pd: e.target.value })}>
              <option value="none">None</option>
              {[...byCategory.entries()].map(([cat, ds]) => (
                <optgroup key={cat} label={P.categories[cat] ?? words(cat)}>
                  {ds.map((d) => (
                    <option key={d} value={d}>
                      {P.dimensions[d]?.label ?? d} ({codedGeos(d).size} jurisdictions)
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <span className="help">Shown as verified days per year under the charts; unknown years stay unknown.</span>
          </label>
        </div>
        {origin && <OriginNote origin={origin} same={sameAnalysis(origin.analysis, a)} />}
      </section>

      {metas.length === 0 || a.geos.length === 0 ? (
        <section className="panel">
          <Empty>Choose at least one measure and one jurisdiction, or open a saved analysis below.</Empty>
        </section>
      ) : !files.data ? (
        <section className="panel">
          <Loading what="the chosen series" />
        </section>
      ) : (
        panels.map((p) => <MetricPanel key={p.meta.metric_id} panel={p} a={a} idx={idx.data!} geos={G} pol={P} />)
      )}

      {a.policy && a.geos.length > 0 && <PolicyByYear a={a} pol={P} geos={G} release={man.data.dataset.release_label} />}

      {allRows.length > 0 && (
        <section className="panel">
          <DownloadRows
            rows={allRows}
            name="explore"
            title="Explore selection"
            filters={{
              view: "explore",
              metrics: a.metrics.join("|"),
              geos: a.geos.join("|"),
              years: `${a.from}-${a.to}`,
              shown: a.shown,
              base_year: a.base === null ? "" : String(a.base),
              policy: a.policy ?? "",
              saved_analysis: sid ?? "",
            }}
            notes={["One row per measure, jurisdiction and year shown. shown_as and shown_value give the values as charted."]}
          />
        </section>
      )}

      {panels.length > 0 && a.geos.length > 0 && (
        <ExploreReport a={a} panels={panels} geos={G} pol={P} origin={origin && sameAnalysis(origin.analysis, a) ? origin : null} man={man.data} />
      )}

      <SaveBar
        view="explore"
        method={null}
        inputs={{ ...analysisPatch(a, sid), base: a.base }}
        manifest={man.data}
        defaultName={origin && sameAnalysis(origin.analysis, a) ? origin.title : `Explore ${a.geos.map((g) => geoName(g, G)).join(", ")} ${a.from}-${a.to}`}
        csv={{
          name: `explore_${a.from}_${a.to}.csv`,
          make: () => {
            type R = { metric: string; label: string; state: string; geo_id: string; year: number; period: string; value: number | null; unit: string; shown_as: string; observation_id: string };
            const rows: R[] = allRows.map((r) => ({
              metric: r.meta.metric_id,
              label: r.meta.label,
              state: geoName(r.obs.geo_id, G),
              geo_id: r.obs.geo_id,
              year: r.obs.year,
              period: `${r.obs.period_start} to ${r.obs.period_end}`,
              value: r.shown ? r.shown.value : r.obs.value,
              unit: r.shown ? r.shown.unit : r.meta.unit,
              shown_as: r.shown ? r.shown.kind : "nominal",
              observation_id: r.obs.observation_id,
            }));
            const cols: Column<R>[] = (["metric", "label", "state", "geo_id", "year", "period", "value", "unit", "shown_as", "observation_id"] as const).map((k) => ({
              key: k,
              kind: k === "value" || k === "year" ? "number" : "text",
              get: (r: R) => r[k],
            }));
            return `# Explore selection; dataset ${man.data!.dataset.release_label}. Observations as charted.\r\n` + toCsv(cols, rows);
          },
        }}
      />

      <SavedAnalyses cases={cases.data.cases} configs={saved.data.analyses} metas={idx.data.metrics} pol={P} />
    </>
  );
}

function OriginNote({ origin, same }: { origin: Origin; same: boolean }) {
  return (
    <div className={same ? "note small" : "warn small"} role="note">
      {same ? (
        <div>
          Saved analysis: <strong>{origin.title}</strong>
        </div>
      ) : (
        <div>
          Changed since you opened <strong>{origin.title}</strong>.{" "}
          <Go to={analysisPatch(origin.analysis, origin.id)} reset>
            Restore it
          </Go>
        </div>
      )}
      {origin.question && <p style={{ margin: "6px 0" }}>{origin.question}</p>}
      {origin.notes.length > 0 && (
        <ul className="source-list">
          {origin.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
      {origin.cannotShow.length > 0 && (
        <>
          <strong>What this selection cannot show</strong>
          <ul className="source-list">
            {origin.cannotShow.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </>
      )}
      {origin.missing.length > 0 && <div>Not in this build: {origin.missing.join(", ")}.</div>}
      {origin.caseId && (
        <div>
          What the observations show and cannot establish is set out in{" "}
          <Go to={{ v: "case", case: origin.caseId }} reset>
            the worked example
          </Go>
          .
        </div>
      )}
    </div>
  );
}

function MetricPanel({ panel, a, idx, geos, pol }: { panel: Panel; a: Analysis; idx: MetricsIndex; geos: Geography[]; pol: PolicyData }) {
  const m = panel.meta;
  const name = (g: string) => geoName(g, geos);
  const unavailable = panel.built[0]?.b.unavailable ?? null;
  const unit = panel.built[0]?.b.unit ?? m.unit;
  const inRange = (y: number) => y >= a.from && y <= a.to;
  const noValues = panel.built.filter((x) => !x.b.points.some((p) => inRange(p.year) && p.value !== null)).map((x) => name(x.geo));
  const levelNotes = new Set<string>();
  const first = { ...m, geo_id: a.geos[0], geo_level: geos.find((g) => g.geo_id === a.geos[0])?.geo_level ?? "state" };
  for (const g of a.geos.slice(1)) {
    const v = compatible(first, { ...m, geo_id: g, geo_level: geos.find((x) => x.geo_id === g)?.geo_level ?? "state" });
    if (!v.ok) for (const r of v.reasons) levelNotes.add(r);
  }
  const dimLabel = a.policy ? (pol.dimensions[a.policy]?.label ?? a.policy) : "";
  const annotations = a.policy
    ? a.geos.flatMap((g) =>
        changeAnnotations(
          statusChanges(pol.segments, g, a.policy!).map((c) => ({ day: c.day, label: `${name(g)}, ${dimLabel}: ${words(c.from)} → ${words(c.to)} from ${c.day}` })),
          g,
          m.period_kind,
          idx.fiscal_year_rules,
          [a.from, a.to],
        ),
      )
    : [];
  const years: number[] = [];
  for (let y = a.from; y <= a.to; y++) if (panel.built.some((x) => x.b.points.some((p) => p.year === y))) years.push(y);
  const cellOf = (geo: string, y: number): ChartPoint | undefined => panel.built.find((x) => x.geo === geo)?.b.points.find((p) => p.year === y);

  return (
    <section className="panel" aria-labelledby={`ex-${m.metric_id}`}>
      <h3 id={`ex-${m.metric_id}`}>{m.label}</h3>
      <p className="small muted">
        {a.shown === "nominal" ? unitLabel(m.unit) : `${CONVERSION_LABELS[a.shown]}${a.shown === "index" ? `, ${a.base} = 100` : ""}`} ·{" "}
        {PERIOD_KIND_LABELS[m.period_kind] ?? m.period_kind} · data {m.first_year}–{m.last_year}
      </p>
      <details className="small">
        <summary>Definition and notes</summary>
        <p>{m.definition}</p>
        {m.overlap_note && <p>{m.overlap_note}</p>}
        {m.notes && <p className="muted">{m.notes}</p>}
        <p className="muted">
          Source series: {m.source_series.join(", ")}. Comparability groups: {m.comparability_groups.length}.
        </p>
      </details>
      {unavailable ? (
        <Empty>
          Not available as {CONVERSION_LABELS[a.shown]?.toLowerCase() ?? a.shown}: {unavailable}
        </Empty>
      ) : (
        <>
          {levelNotes.size > 0 && (
            <p className="warn small">
              Read with care: {[...levelNotes].join("; ")}.
            </p>
          )}
          {noValues.length > 0 && (
            <p className="small muted">
              No value in {a.from}–{a.to} for {noValues.join(", ")}.
            </p>
          )}
          <TrendChart
            series={panel.built.map((x) => ({ key: x.geo, label: name(x.geo), points: x.b.points }))}
            unit={unit}
            domain={[a.from, a.to]}
            annotations={annotations}
            title={`${m.label}, ${a.geos.map(name).join(", ")}, ${a.from}–${a.to}`}
          />
          {a.policy && annotations.length === 0 && (
            <p className="small muted">No verified change of “{dimLabel}” falls in these years for these jurisdictions (see the policy table).</p>
          )}
          <details className="small">
            <summary>Values (table)</summary>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Period</th>
                    {a.geos.map((g) => (
                      <th key={g} className="num">
                        {name(g)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {years.map((y) => (
                    <tr key={y}>
                      <th scope="row">{y}</th>
                      {a.geos.map((g) => {
                        const p = cellOf(g, y);
                        return (
                          <td key={g} className="num">
                            {!p ? (
                              <span className="muted">no record</span>
                            ) : (
                              <RecordLink rec={p.rec}>{p.value === null ? `— ${words(p.note)}` : formatValue(p.value, unit)}</RecordLink>
                            )}
                            {p && p.low !== null && p.low !== undefined && p.high !== null && p.high !== undefined && (
                              <div className="muted">
                                CI {formatValue(p.low, unit)}–{formatValue(p.high, unit)}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}

function SavedAnalyses({ cases, configs, metas, pol }: { cases: CaseStudy[]; configs: SavedAnalysisConfig[]; metas: MetricMeta[]; pol: PolicyData }) {
  return (
    <section className="panel no-print" aria-labelledby="sa-h">
      <h2 id="sa-h">Saved analyses: worked examples and starting points</h2>
      <div className="grid-2">
        <div>
          <h3>Worked examples</h3>
          {cases.length === 0 && <p className="small muted">None configured.</p>}
          {cases.map((c) => (
            <div key={c.case_id}>
              <p className="small">
                <strong>{c.title}</strong> —{" "}
                <Go to={{ v: "case", case: c.case_id }} reset>
                  read the example
                </Go>
                . Each chart opens here with the same measures, states, years and conversion:
              </p>
              <ul className="small source-list">
                {caseAnalyses(c, metas, pol.events).map((x) => (
                  <li key={x.id}>
                    <Go to={analysisPatch(x.analysis, x.id)} reset>
                      {x.title}
                    </Go>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div>
          <h3>Starting points</h3>
          <p className="small muted">Selections for common questions, each checked against this release. They state no findings.</p>
          <ul className="small source-list">
            {configs.map((c) => (
              <li key={c.analysis_id}>
                <Go to={analysisPatch(fromConfig(c), c.analysis_id)} reset>
                  {c.title}
                </Go>
                <div className="muted">{c.question}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/** The report for an Explore selection: question, inputs, coverage, method, sources and limits. */
function ExploreReport({ a, panels, geos, pol, origin, man }: { a: Analysis; panels: Panel[]; geos: Geography[]; pol: PolicyData; origin: Origin | null; man: Manifest }) {
  const name = (g: string) => geoName(g, geos);
  const question =
    origin?.question ??
    `How did these measures compare across ${a.geos.map(name).join(", ")} in ${a.from}–${a.to}?`;
  const assets = [...new Set(panels.flatMap((p) => p.built.flatMap((x) => x.b.rows.filter((r) => r.obs.year >= a.from && r.obs.year <= a.to).map((r) => r.obs.asset_id))))].sort();
  return (
    <section className="panel report" aria-labelledby="ex-rep">
      <h2 id="ex-rep">Report</h2>
      <p>
        <strong>{question}</strong>
      </p>
      <dl className="kv">
        <dt>Jurisdictions</dt>
        <dd>{a.geos.map(name).join(", ")}</dd>
        <dt>Years</dt>
        <dd>
          {a.from}–{a.to}
        </dd>
        <dt>Values shown as</dt>
        <dd>{a.shown === "index" ? `index, ${a.base} = 100` : (CONVERSION_LABELS[a.shown] ?? a.shown)}</dd>
        <dt>Policy</dt>
        <dd>{a.policy ? (pol.dimensions[a.policy]?.label ?? a.policy) : "none"}</dd>
        <dt>Dataset</dt>
        <dd className="small">{man.dataset.release_label}</dd>
      </dl>
      <div className="table-wrap">
        <table className="data">
          <caption className="small">Coverage: years with a value in {a.from}–{a.to}</caption>
          <thead>
            <tr>
              <th scope="col">Measure</th>
              {a.geos.map((g) => (
                <th scope="col" key={g} className="num">
                  {name(g)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {panels.map((p) => (
              <tr key={p.meta.metric_id}>
                <th scope="row">{p.meta.label}</th>
                {p.built.map((x) => {
                  const ys = x.b.points.filter((pt) => pt.year >= a.from && pt.year <= a.to && pt.value !== null).length;
                  return (
                    <td key={x.geo} className="num">
                      {x.b.unavailable ? "not available" : `${ys} of ${a.to - a.from + 1}`}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="small source-list">
        <li>Method: values as published, or the dataset's own conversions (CPI-U fiscal-year averages; Census July 1 population); an index divides each value by the same state's base-year value. Missing years are never filled; lines break at missing years and definition changes.</li>
        <li>Descriptive only: differences between states or years are not policy effects.</li>
        {panels.flatMap((p) => (p.meta.overlap_note || p.meta.notes ? [<li key={p.meta.metric_id}>{p.meta.label}: {[p.meta.overlap_note, p.meta.notes].filter(Boolean).join(" ")}</li>] : []))}
      </ul>
      <details className="small">
        <summary>Source files ({assets.length})</summary>
        {assets.map((x) => (
          <div key={x} style={{ marginBottom: 8 }}>
            <SourceRef assetId={x} />
          </div>
        ))}
      </details>
    </section>
  );
}
