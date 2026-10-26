// Before and after a policy change: guided inputs, then a report with annual values, window averages,
// changes, a descriptive difference in changes against comparison states, pre-period trends, the exact
// observations used, and the limits of what it shows. Calculations: lib/change.ts (CHANGE_METHOD).
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Empty, ErrorNote, Go, Loading, RecordLink, SourceRef } from "../components/common";
import { PolicyByYear } from "../components/PolicyByYear";
import { BuildNotice, SaveBar } from "../components/SaveBar";
import { TrendChart, type Annotation, type ChartPoint } from "../components/TrendChart";
import { statusChanges } from "../lib/analysis";
import type { ObsRow } from "../lib/bundle";
import {
  CHANGE_METHOD,
  PLACEBO_MIN_RUNS,
  analyzeChange,
  eventTime,
  placeboInTime,
  type ChangeSpec,
  type DiffResult,
  type OutcomeResult,
  type PlaceboResult,
  type PlaceboSummary,
  type PooledResult,
} from "../lib/change";
import { toCsv, type Column } from "../lib/csv";
import { decodeMetric, useData, useMany } from "../lib/data";
import { PERIOD_KIND_LABELS, formatValue, geoName, precise, unitLabel, words } from "../lib/format";
import { METRIC_HELP, PERIOD_SHORT, SHOWN_HELP, SHOWN_LABELS, formatsFor, groupedMetrics } from "../lib/outcomes";
import { buildSeries, type Shown } from "../lib/series";
import { intervalKind, intervalPhrase, tCritical95, zForLevel } from "../lib/stats";
import type { Geography, Manifest, MetricFile, MetricMeta, MetricsIndex, PolicyData, PolicyEvent } from "../lib/types";
import { navigate, pickInt, pickList, pickOne, useParams, type Patch } from "../lib/url";
import { DownloadRows } from "./RevenueView";

const WINE = "ordinary_grocery_wine_authorization";
const MAX_OUTCOMES = 4;
const MAX_COMPARISONS = 5;
const SHOWN_CHOICES: Shown[] = ["nominal", "real_cy2024", "per_resident", "per_resident_21plus"];

export interface ChangeInputs {
  target: string;
  policy: string;
  date: string;
  comparisons: string[];
  outcomes: { metric: string; shown: Shown }[];
  before: number;
  after: number;
  includeTransition: boolean;
  yearSet: "common" | "own";
  eventChart: boolean;
  relative: boolean;
}

/** The first working example: Tennessee's food-store wine licenses from 2016-07-01. */
export const TN_EXAMPLE: ChangeInputs = {
  target: "state:47",
  policy: WINE,
  date: "2016-07-01",
  comparisons: ["state:51", "state:13", "state:05", "state:21"],
  outcomes: [
    { metric: "stc_alcoholic_beverages_sales_tax@state_fiscal_year", shown: "real_cy2024" },
    { metric: "niaaa_ethanol_per_capita_21plus_wine@calendar_year", shown: "nominal" },
    { metric: "brfss_drank_any_past_30d_pct@survey_year", shown: "nominal" },
  ],
  before: 5,
  after: 5,
  includeTransition: false,
  yearSet: "common",
  eventChart: true,
  relative: false,
};

export const AR_EXAMPLE: Patch = {
  v: "change",
  t: "state:05",
  d: "2017-10-01",
  cs: "state:29,state:28,state:22",
  m: "niaaa_ethanol_per_capita_21plus_wine@calendar_year~nominal,stc_alcoholic_beverages_sales_tax@state_fiscal_year~per_resident_21plus",
};

export function changePatch(c: ChangeInputs): Patch {
  return {
    v: "change",
    t: c.target,
    pd: c.policy === WINE ? null : c.policy,
    d: c.date || "none",
    cs: c.comparisons.length ? c.comparisons.join(",") : "none",
    m: c.outcomes.length ? c.outcomes.map((o) => `${o.metric}~${o.shown}`).join(",") : "none",
    b: c.before === 5 ? null : c.before,
    af: c.after === 5 ? null : c.after,
    tr: c.includeTransition ? 1 : null,
    ys: c.yearSet === "own" ? "own" : null,
    et: c.eventChart ? null : 0,
    er: c.relative ? 1 : null,
  };
}

function readInputs(params: URLSearchParams, idx: MetricsIndex, geos: Geography[], pol: PolicyData): ChangeInputs {
  const states = geos.filter((g) => g.geo_level === "state").map((g) => g.geo_id);
  const fresh = params.get("t") === null && params.get("m") === null;
  const base = fresh ? TN_EXAMPLE : { ...TN_EXAMPLE, comparisons: [], outcomes: [] };
  const target = pickOne(params.get("t"), states, base.target);
  const policy = pickOne(params.get("pd"), Object.keys(pol.dimensions), WINE);
  const d = params.get("d");
  const verified = statusChanges(pol.segments, target, policy);
  const date = d === "none" ? "" : d && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d)) ? d : (verified[0]?.day ?? (fresh ? base.date : ""));
  const comparisons =
    params.get("cs") === "none" ? [] : pickList(params.get("cs"), states.filter((s) => s !== target), MAX_COMPARISONS, base.comparisons.filter((s) => s !== target));
  const ids = new Set(idx.metrics.map((m) => m.metric_id));
  let outcomes = base.outcomes;
  const m = params.get("m");
  if (m === "none") outcomes = [];
  else if (m) {
    outcomes = [];
    for (const part of m.split(",")) {
      const [metric, sh] = part.split("~");
      if (!ids.has(metric) || outcomes.some((o) => o.metric === metric) || outcomes.length >= MAX_OUTCOMES) continue;
      const meta = idx.metrics.find((x) => x.metric_id === metric)!;
      const shown = pickOne(sh ?? null, SHOWN_CHOICES, "nominal");
      outcomes.push({ metric, shown: formatsFor(meta).find((f) => f.shown === shown)?.available ? shown : "nominal" });
    }
  }
  return {
    target,
    policy,
    date,
    comparisons,
    outcomes,
    before: pickInt(params.get("b"), 1, 15, 5),
    after: pickInt(params.get("af"), 1, 15, 5),
    includeTransition: params.get("tr") === "1",
    yearSet: params.get("ys") === "own" ? "own" : "common",
    eventChart: params.get("et") !== "0",
    relative: params.get("er") === "1",
  };
}

const sameInputs = (a: ChangeInputs, b: ChangeInputs) => JSON.stringify(a) === JSON.stringify(b);

export function ChangeView() {
  const params = useParams();
  const idx = useData<MetricsIndex>("metrics.json");
  const geos = useData<Geography[]>("geographies.json");
  const pol = useData<PolicyData>("policy.json");
  const man = useData<Manifest>("manifest.json");
  const ready = idx.data && geos.data && pol.data;
  const applied = ready ? readInputs(params, idx.data!, geos.data!, pol.data!) : null;
  const metas = applied ? applied.outcomes.map((o) => idx.data!.metrics.find((m) => m.metric_id === o.metric)!) : [];
  const files = useMany<MetricFile>(metas.map((m) => m.file));
  const err = idx.error ?? geos.error ?? pol.error ?? man.error ?? files.error;
  if (err) return <ErrorNote error={err} />;
  if (!idx.data || !geos.data || !pol.data || !man.data || !applied) return <Loading what="the before-and-after tool" />;
  return (
    <>
      <section className="panel" aria-labelledby="chg-h">
        <h2 id="chg-h">Before and after a policy change</h2>
        <p className="small">
          Pick a state, the date its law changed and the outcomes to look at. The tool averages each outcome over the years before
          and after the change, shows the same years for comparison states, and lists every value it used. It describes what
          happened; it cannot say what caused it.
        </p>
        <BuildNotice manifest={man.data} method={CHANGE_METHOD} />
        <ChangeForm applied={applied} idx={idx.data} geos={geos.data} pol={pol.data} />
      </section>
      {!files.data ? (
        <section className="panel">
          <Loading what="the chosen outcomes" />
        </section>
      ) : (
        <ChangeResults c={applied} metas={metas} files={files.data} idx={idx.data} geos={geos.data} pol={pol.data} man={man.data} />
      )}
    </>
  );
}

function ChangeForm({ applied, idx, geos, pol }: { applied: ChangeInputs; idx: MetricsIndex; geos: Geography[]; pol: PolicyData }) {
  const [draft, setDraft] = useState<ChangeInputs>(applied);
  const appliedKey = JSON.stringify(applied);
  useEffect(() => setDraft(JSON.parse(appliedKey) as ChangeInputs), [appliedKey]);
  const addOutcomeRef = useRef<HTMLButtonElement>(null);
  const addStateRef = useRef<HTMLSelectElement>(null);
  const states = geos.filter((g) => g.geo_level === "state");
  const name = (g: string) => geoName(g, geos);
  const verified = statusChanges(pol.segments, draft.target, draft.policy);
  const isVerified = verified.some((v) => v.day === draft.date);
  const dims = Object.keys(pol.dimensions).filter((d) => pol.segments.some((s) => s.policy_dimension === d && s.state !== "unknown"));
  const withChanges = states.filter((g) => statusChanges(pol.segments, g.geo_id, draft.policy).length > 0);
  const groups = groupedMetrics(idx.metrics, idx.families);
  const dirty = !sameInputs(draft, applied);
  const problems: string[] = [];
  if (!draft.date) problems.push("Enter the date the law changed (or pick a verified date).");
  if (!draft.outcomes.length) problems.push("Add at least one outcome.");
  const set = (p: Partial<ChangeInputs>) => setDraft((d) => ({ ...d, ...p }));
  const run = (e: FormEvent) => {
    e.preventDefault();
    if (problems.length) return;
    navigate(changePatch(draft), { reset: true });
  };
  const metaOf = (id: string) => idx.metrics.find((m) => m.metric_id === id);

  return (
    <form onSubmit={run} aria-label="Inputs">
      <div className="row-actions no-print">
        <span className="small muted">Examples:</span>
        <Go to={changePatch(TN_EXAMPLE)} reset>
          Tennessee, July 2016 (verified date)
        </Go>
        <Go to={AR_EXAMPLE} reset>
          Arkansas, October 2017 (date entered as an assumption)
        </Go>
      </div>
      <fieldset className="inputs">
        <legend>1. The change</legend>
        <div className="controls">
          <label>
            State
            <select
              value={draft.target}
              onChange={(e) => {
                const t = e.target.value;
                set({ target: t, date: statusChanges(pol.segments, t, draft.policy)[0]?.day ?? "", comparisons: draft.comparisons.filter((x) => x !== t) });
              }}
            >
              {states.map((g) => (
                <option key={g.geo_id} value={g.geo_id}>
                  {g.name}
                </option>
              ))}
            </select>
            <span className="help">The state whose law changed.</span>
          </label>
          <label>
            Policy
            <select value={draft.policy} onChange={(e) => set({ policy: e.target.value, date: statusChanges(pol.segments, draft.target, e.target.value)[0]?.day ?? "" })}>
              {dims.map((d) => (
                <option key={d} value={d}>
                  {pol.dimensions[d].label}
                </option>
              ))}
            </select>
            <span className="help">The coded law that changed.</span>
          </label>
          <label>
            Date the change took effect
            <input type="date" value={draft.date} min="1950-01-01" max="2030-12-31" onChange={(e) => set({ date: e.target.value })} required />
            <span className="help">
              {isVerified ? (
                <strong>Verified: the coded law changes on this day.</strong>
              ) : draft.date ? (
                <strong>Assumption: no verified change of this policy on this date.</strong>
              ) : (
                "Required."
              )}
            </span>
          </label>
        </div>
        {verified.length > 0 ? (
          <div className="small">
            Verified changes for {name(draft.target)}:{" "}
            {verified.map((v) => (
              <button type="button" className="link" key={v.day} onClick={() => set({ date: v.day })}>
                {v.day} ({words(v.from)} → {words(v.to)})
              </button>
            ))}
          </div>
        ) : (
          <p className="small muted">
            No verified change of “{pol.dimensions[draft.policy]?.label}” for {name(draft.target)} in this dataset, so any date you enter is
            an assumption.{" "}
            {withChanges.length > 0 && <>States with a verified change of this policy: {withChanges.map((g) => g.name).join(", ")}.</>}
          </p>
        )}
      </fieldset>

      <fieldset className="inputs">
        <legend>2. Comparison states</legend>
        <p className="help">
          Shown for the same years. They are not controls: their own laws may differ or change, and the report lists what is known.
        </p>
        <div className="controls">
          <div className="field">
            <span>Chosen ({draft.comparisons.length} of {MAX_COMPARISONS})</span>
            <div className="row-actions" style={{ margin: 0 }}>
              {draft.comparisons.length === 0 && <span className="muted small">none</span>}
              {draft.comparisons.map((g) => (
                <button
                  type="button"
                  key={g}
                  aria-label={`Remove ${name(g)}`}
                  onClick={() => {
                    set({ comparisons: draft.comparisons.filter((x) => x !== g) });
                    setTimeout(() => addStateRef.current?.focus(), 0);
                  }}
                >
                  {name(g)} ✕
                </button>
              ))}
            </div>
          </div>
          {draft.comparisons.length < MAX_COMPARISONS && (
            <label>
              Add a state
              <select ref={addStateRef} value="" onChange={(e) => e.target.value && set({ comparisons: [...draft.comparisons, e.target.value] })}>
                <option value="">Choose…</option>
                {states
                  .filter((g) => g.geo_id !== draft.target && !draft.comparisons.includes(g.geo_id))
                  .map((g) => (
                    <option key={g.geo_id} value={g.geo_id}>
                      {g.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <Go
            to={{ v: "finder", t: draft.target, d: draft.date || null, from: new URLSearchParams(Object.entries(changePatch(draft)).filter(([, v]) => v !== null && v !== undefined).map(([k, v]) => [k, String(v)])).toString() }}
            reset
          >
            Find comparison states
          </Go>
        </div>
      </fieldset>

      <fieldset className="inputs">
        <legend>3. Outcomes</legend>
        <p className="help">Each outcome is compared separately, in the format you choose. Measures with different units never share a chart.</p>
        {draft.outcomes.map((o, i) => {
          const meta = metaOf(o.metric)!;
          const formats = formatsFor(meta);
          const unavailable = formats.filter((f) => !f.available);
          return (
            <div className="outcome-row" key={o.metric}>
              <label>
                Outcome {i + 1}
                <select
                  value={o.metric}
                  onChange={(e) => set({ outcomes: draft.outcomes.map((x, j) => (j === i ? { metric: e.target.value, shown: "nominal" } : x)) })}
                >
                  {groups.map((g) => (
                    <optgroup key={g.label} label={g.label}>
                      {g.metrics
                        .filter((m) => m.metric_id === o.metric || !draft.outcomes.some((x) => x.metric === m.metric_id))
                        .map((m) => (
                          <option key={m.metric_id} value={m.metric_id}>
                            {m.label} ({PERIOD_SHORT[m.period_kind] ?? m.period_kind})
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              <label>
                Shown as
                <select value={o.shown} onChange={(e) => set({ outcomes: draft.outcomes.map((x, j) => (j === i ? { ...x, shown: e.target.value as Shown } : x)) })}>
                  {formats.map((f) => (
                    <option key={f.shown} value={f.shown} disabled={!f.available}>
                      {SHOWN_LABELS[f.shown]}
                      {f.available ? "" : " (not available)"}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="link small"
                aria-label={`Remove outcome ${i + 1}: ${meta.label}`}
                onClick={() => {
                  set({ outcomes: draft.outcomes.filter((_, j) => j !== i) });
                  setTimeout(() => addOutcomeRef.current?.focus(), 0);
                }}
              >
                remove
              </button>
              <p className="help">
                {METRIC_HELP[o.metric] ?? meta.definition} Unit: {unitLabel(meta.unit)}; {PERIOD_KIND_LABELS[meta.period_kind]?.toLowerCase()}; data {meta.first_year}–
                {meta.last_year}. {SHOWN_HELP[o.shown]}
                {unavailable.length > 0 && ` Other formats are not available: ${unavailable[0].why}`}
              </p>
            </div>
          );
        })}
        {draft.outcomes.length < MAX_OUTCOMES && (
          <button
            type="button"
            ref={addOutcomeRef}
            onClick={() => {
              const next = groups.flatMap((g) => g.metrics).find((m) => !draft.outcomes.some((o) => o.metric === m.metric_id));
              if (next) set({ outcomes: [...draft.outcomes, { metric: next.metric_id, shown: "nominal" }] });
            }}
          >
            Add an outcome
          </button>
        )}
      </fieldset>

      <fieldset className="inputs">
        <legend>4. Years and averaging</legend>
        <div className="controls">
          <label>
            Years before
            <input type="number" min={1} max={15} value={draft.before} onChange={(e) => set({ before: Math.min(15, Math.max(1, Number(e.target.value) || 1)) })} />
            <span className="help">Full years before the change.</span>
          </label>
          <label>
            Years after
            <input type="number" min={1} max={15} value={draft.after} onChange={(e) => set({ after: Math.min(15, Math.max(1, Number(e.target.value) || 1)) })} />
            <span className="help">Full years after it.</span>
          </label>
          <label className="check">
            <input type="checkbox" checked={draft.includeTransition} onChange={(e) => set({ includeTransition: e.target.checked })} />
            Count the transition year as “after”
            <span className="help">A year the law changed part-way through. Left out by default, because it is partly before and partly after.</span>
          </label>
        </div>
        <fieldset className="radios">
          <legend>Years used for the averages</legend>
          <label className="check">
            <input type="radio" name="ys" checked={draft.yearSet === "common"} onChange={() => set({ yearSet: "common" })} />
            The same years for every state (recommended)
            <span className="help">A year one state lacks is dropped for all, so every average covers the same years. The report lists dropped years.</span>
          </label>
          <label className="check">
            <input type="radio" name="ys" checked={draft.yearSet === "own"} onChange={() => set({ yearSet: "own" })} />
            Each state's own available years
            <span className="help">Keeps more data, but then the states' averages cover different years, so no difference between states is calculated.</span>
          </label>
        </fieldset>
        <div className="controls">
          <label className="check">
            <input type="checkbox" checked={draft.eventChart} onChange={(e) => set({ eventChart: e.target.checked })} />
            Also show an event-time chart
            <span className="help">Lines up the years around the change: year 0 is the year it took effect.</span>
          </label>
          {draft.eventChart && (
            <label className="check">
              <input type="checkbox" checked={draft.relative} onChange={(e) => set({ relative: e.target.checked })} />
              …as a percent of each state's before average
              <span className="help">Puts states of different sizes on one scale (100 = the state's own before average).</span>
            </label>
          )}
        </div>
      </fieldset>

      {problems.length > 0 && (
        <ul className="warn small" role="alert">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      <div className="row-actions run-bar">
        <button type="submit" className="primary" disabled={problems.length > 0}>
          {dirty ? "Update results" : "Run"}
        </button>
        <button type="button" onClick={() => setDraft(applied)} disabled={!dirty}>
          Undo unapplied edits
        </button>
        <button type="button" onClick={() => navigate({ v: "change" }, { reset: true })}>
          Reset to the example
        </button>
        {dirty && <span className="small warn-inline">You have edits that are not in the results yet.</span>}
      </div>
    </form>
  );
}

interface OutcomeRun {
  meta: MetricMeta;
  shown: Shown;
  unit: string;
  unavailable: string | null;
  series: { geo: string; rows: ObsRow[]; points: ChartPoint[] }[];
  result: OutcomeResult | null;
  /** The same comparison at earlier dates chosen without regard to any law (a diagnostic); null when there is nothing to compare. */
  placebo: PlaceboResult | null;
}

const sign = (v: number) => (v > 0 ? "+" : v < 0 ? "−" : "");
const signed = (v: number | null, unit: string) =>
  v === null ? "—" : unit === "percent" ? `${sign(v)}${Math.abs(v).toFixed(1)} points` : `${sign(v)}${precise(Math.abs(v), unit)}`;
const pct = (v: number | null) => (v === null ? "—" : `${sign(v)}${Math.abs(v).toFixed(1)}%`);
/** The size of a gap or a spread (no sign): percentage points for shares, the measure's own unit otherwise. */
const gapSize = (v: number, unit: string) => (unit === "percent" ? `${Math.abs(v).toFixed(1)} points` : precise(Math.abs(v), unit));
const Z95 = zForLevel(0.95);
/** "± 1.2 points" / "± 3.4 dollars": the half-width of a 95% interval from a standard error. */
const plusMinus = (se: number | null, unit: string) => (se === null ? null : unit === "percent" ? `± ${(Z95 * se).toFixed(1)} points` : `± ${precise(Z95 * se, unit)}`);
const intervalText = (iv: [number, number] | null, unit: string) => (iv === null ? "—" : `${signed(iv[0], unit)} to ${signed(iv[1], unit)}`);
const pText = (p: number | null) => (p === null ? "—" : p < 0.001 ? "p < 0.001" : `p = ${p.toFixed(3)}`);
const logPts = (v: number | null) => (v === null ? null : `${sign(v)}${Math.abs(100 * v).toFixed(1)} log points`);
const yearsText = (ys: number[]) => (ys.length ? (ys.length > 2 && ys[ys.length - 1] - ys[0] === ys.length - 1 ? `${ys[0]}–${ys[ys.length - 1]}` : ys.join(", ")) : "none");

function ChangeResults({
  c,
  metas,
  files,
  idx,
  geos,
  pol,
  man,
}: {
  c: ChangeInputs;
  metas: MetricMeta[];
  files: MetricFile[];
  idx: MetricsIndex;
  geos: Geography[];
  pol: PolicyData;
  man: Manifest;
}) {
  const name = (g: string) => geoName(g, geos);
  if (!c.date || !c.outcomes.length) {
    return (
      <section className="panel">
        <Empty>Fill in the inputs above and press Run.</Empty>
      </section>
    );
  }
  const allGeos = [c.target, ...c.comparisons];
  const spec: ChangeSpec = { date: c.date, before: c.before, after: c.after, includeTransition: c.includeTransition, yearSet: c.yearSet };
  const verified = statusChanges(pol.segments, c.target, c.policy).find((v) => v.day === c.date);
  const dimLabel = pol.dimensions[c.policy]?.label ?? c.policy;
  const reform = verified ? pol.events.find((e) => verified.policyIds.includes(e.policy_id)) : undefined;
  const runs: OutcomeRun[] = metas.map((meta, i) => {
    const shown = c.outcomes[i].shown;
    const dm = decodeMetric(files[i]);
    const built = allGeos.map((g) => ({ geo: g, b: buildSeries(meta, dm, g, shown, idx) }));
    const unavailable = built[0].b.unavailable;
    const series = built.map((x) => ({ geo: x.geo, rows: x.b.rows, points: x.b.points }));
    const result = unavailable ? null : analyzeChange(series, spec, meta.period_kind, idx.fiscal_year_rules);
    return {
      meta,
      shown,
      unit: built[0].b.unit,
      unavailable,
      series,
      result,
      placebo: result && result.computable && c.comparisons.length ? placeboInTime(series, spec, meta.period_kind, idx.fiscal_year_rules) : null,
    };
  });
  const years = runs.flatMap((r) => (r.result ? [r.result.beforeWindow[0] - 1, r.result.afterWindow[r.result.afterWindow.length - 1]] : []));
  const spanFrom = years.length ? Math.min(...years) : Number(c.date.slice(0, 4)) - c.before;
  const spanTo = years.length ? Math.max(...years) : Number(c.date.slice(0, 4)) + c.after;
  const others: PolicyEvent[] = pol.events
    .filter(
      (e) =>
        allGeos.includes(e.geo_id) &&
        e.effective_start &&
        e.effective_start >= `${spanFrom}-01-01` &&
        e.effective_start <= `${spanTo}-12-31` &&
        !(reform && e.policy_id === reform.policy_id),
    )
    .sort((a, b) => (a.effective_start! < b.effective_start! ? -1 : 1));
  const usedRows = runs.flatMap((r) => (r.result ? r.result.states.flatMap((s) => s.cells.filter((x) => x.status === "used").map((x) => x.row!)) : []));
  const covid = runs.some((r) => r.result && r.result.afterWindow.some((y) => y >= 2020 && y <= 2022));
  const question = `What changed in ${name(c.target)} after ${c.date}, when ${dimLabel.toLowerCase()} changed${verified ? ` (${words(verified.from)} → ${words(verified.to)})` : " (date assumed)"}?`;

  const csv = () => {
    type Row = Record<string, string | number | null>;
    const out: Row[] = [];
    for (const r of runs) {
      if (!r.result) continue;
      for (const s of r.result.states) {
        out.push({
          row_type: "state",
          outcome: r.meta.metric_id,
          outcome_label: r.meta.label,
          shown_as: r.shown,
          unit: r.unit,
          state: name(s.geo),
          geo_id: s.geo,
          role: s.geo === c.target ? "target" : "comparison",
          included: s.included ? "yes" : `no: ${s.excludedWhy}`,
          before_years: s.beforeYears.join("|"),
          before_average: s.beforeMean,
          after_years: s.afterYears.join("|"),
          after_average: s.afterMean,
          change: s.change,
          change_se: s.changeSE,
          percent_change: s.pctChange,
          percent_change_note: s.pctWhy,
          log_change: s.logChange,
          pre_period_trend_per_year: s.slope,
          pre_period_trend_se: s.slopeSE,
          note: s.notComparableWhy,
        });
      }
      for (const d of r.result.diffs) {
        out.push({
          row_type: "difference_in_changes",
          outcome: r.meta.metric_id,
          outcome_label: r.meta.label,
          shown_as: r.shown,
          unit: r.unit,
          state: `${name(c.target)} minus ${name(d.geo)}`,
          geo_id: d.geo,
          role: "descriptive difference, not an effect",
          change: d.diffChange,
          change_se: d.diffChangeSE,
          interval_low: d.diffInterval ? d.diffInterval[0] : null,
          interval_high: d.diffInterval ? d.diffInterval[1] : null,
          p_value: d.diffP,
          percent_change: d.diffPct,
          log_change: d.diffLog,
          pre_period_trend_per_year: d.slopeDiff,
          pre_period_trend_se: d.slopeDiffSE,
          trend_only_difference: d.trendOnly,
          trend_only_reliable: d.trendReliable === null ? null : d.trendReliable ? "yes" : "no",
          note: d.why,
        });
      }
      const pl = r.result.pooled;
      if (pl && pl.geos.length > 1) {
        out.push({
          row_type: "pooled_difference_in_changes",
          outcome: r.meta.metric_id,
          outcome_label: r.meta.label,
          shown_as: r.shown,
          unit: r.unit,
          state: `${name(c.target)} minus the pool of ${pl.geos.map(name).join(", ")}`,
          role: "descriptive difference, not an effect",
          change: pl.diffChange,
          change_se: pl.diffChangeSE,
          interval_low: pl.diffInterval ? pl.diffInterval[0] : null,
          interval_high: pl.diffInterval ? pl.diffInterval[1] : null,
          p_value: pl.diffP,
          log_change: pl.diffLog,
          note: pl.why ?? (pl.range ? `leaving each state out in turn gives ${pl.range[0].toPrecision(4)} to ${pl.range[1].toPrecision(4)}` : null),
        });
      }
      const placeboRows = r.placebo ? [...r.placebo.summaries, ...(r.placebo.pooled ? [r.placebo.pooled] : [])] : [];
      for (const p of placeboRows) {
        out.push({
          row_type: "placebo_in_time",
          outcome: r.meta.metric_id,
          outcome_label: r.meta.label,
          shown_as: r.shown,
          unit: r.unit,
          state: p.geo === "pooled" ? "pool of all comparison states" : `${name(c.target)} minus ${name(p.geo)}`,
          geo_id: p.geo === "pooled" ? null : p.geo,
          role: "earlier dates chosen without regard to any law; a diagnostic, not an effect",
          change: p.actual,
          placebo_dates: p.n,
          placebo_typical_gap: p.typical,
          placebo_share_as_large: p.enough ? p.share : null,
          note: p.enough ? null : `only ${p.n} usable placebo dates (needs ${PLACEBO_MIN_RUNS})`,
        });
      }
    }
    const keys = ["row_type", "outcome", "outcome_label", "shown_as", "unit", "state", "geo_id", "role", "included", "before_years", "before_average", "after_years", "after_average", "change", "percent_change", "percent_change_note", "pre_period_trend_per_year", "pre_period_trend_se", "trend_only_difference", "trend_only_reliable", "change_se", "interval_low", "interval_high", "p_value", "log_change", "placebo_dates", "placebo_typical_gap", "placebo_share_as_large", "note"];
    const nums = new Set(["before_average", "after_average", "change", "change_se", "percent_change", "log_change", "pre_period_trend_per_year", "pre_period_trend_se", "trend_only_difference", "interval_low", "interval_high", "p_value", "placebo_dates", "placebo_typical_gap", "placebo_share_as_large"]);
    const cols: Column<Row>[] = keys.map((k) => ({ key: k, kind: nums.has(k) ? "number" : "text", get: (r) => r[k] ?? null }));
    const head = [
      `# ${question}`,
      `# Inputs: date ${c.date} (${verified ? "verified" : "assumption"}); comparison states ${c.comparisons.map(name).join(", ") || "none"}; ${c.before} years before, ${c.after} after; transition year ${c.includeTransition ? "counted as after" : "left out"}; years used: ${c.yearSet === "common" ? "the same for every state" : "each state's own"}.`,
      `# Dataset ${man.dataset.release_label}; method ${CHANGE_METHOD}. Descriptive only: a difference in changes is not an effect estimate.`,
    ].join("\r\n");
    return head + "\r\n" + toCsv(cols, out);
  };

  return (
    <>
      <section className="panel report" aria-labelledby="res-h">
        <h2 id="res-h">Results</h2>
        <p>
          <strong>{question}</strong>
        </p>
        <dl className="kv">
          <dt>State</dt>
          <dd>{name(c.target)}</dd>
          <dt>Change</dt>
          <dd>
            {dimLabel} on {c.date}:{" "}
            {verified ? (
              <>
                <span className="tag">verified date</span>{" "}
                {verified.policyIds.length > 0 && <RecordLink rec={`policy:${verified.policyIds[0]}`}>coded record</RecordLink>}
              </>
            ) : (
              <span className="tag tag-assumption">assumption: no verified change of this policy on this date</span>
            )}
          </dd>
          <dt>Comparison states</dt>
          <dd>{c.comparisons.length ? c.comparisons.map(name).join(", ") : "none"}</dd>
          <dt>Years</dt>
          <dd>
            {c.before} before and {c.after} after; the transition year is {c.includeTransition ? "counted as after" : "left out"}; averages use{" "}
            {c.yearSet === "common" ? "the same years for every state" : "each state's own years"}.
          </dd>
          <dt>Dataset</dt>
          <dd className="small">
            {man.dataset.release_label}; method {CHANGE_METHOD}; law as of {man.dataset.law_as_of_date}
          </dd>
        </dl>
        <div className="note small">
          A before-and-after difference describes what happened, not why. Prices, taxes, the economy, tourism, other laws and the
          pandemic change too, and comparison states differ from {name(c.target)} in many ways. “Difference in changes” below is
          descriptive arithmetic, not an estimate of the policy's effect.
          {c.target !== "state:49" && ` Nothing here transfers to Utah directly: Utah's state-run liquor stores collect most alcohol money as store profit, not as taxes.`}
        </div>
      </section>

      {runs.map((r, i) => (
        <OutcomeBlock key={r.meta.metric_id} n={i + 1} run={r} c={c} geos={geos} verified={Boolean(verified)} />
      ))}

      <PolicyByYear
        a={{ metrics: [], geos: allGeos, from: spanFrom, to: Math.min(spanTo, Number(pol.as_of_date.slice(0, 4))), shown: "nominal", base: null, policy: c.policy }}
        pol={pol}
        geos={geos}
        release={man.dataset.release_label}
      />

      <section className="panel" aria-labelledby="lim-h">
        <h2 id="lim-h">Limitations of this result</h2>
        <ul className="small source-list">
          {!verified && <li>The change date {c.date} is your assumption. The dataset has no verified change of this policy on that date.</li>}
          {reform?.requires_local_adoption && (
            <li>
              The change applied only where localities opted in ({words(reform.policy_value)}). Which places and how many stores is not in the dataset, so
              the share of {name(c.target)} actually exposed is unknown.
            </li>
          )}
          <li>
            The policy table above shows how many days of each state's status are verified in these years. Unknown years may hide further changes,
            including in {name(c.target)} after {c.date}.
          </li>
          {others.length > 0 && (
            <li>
              Other coded law changes in these states and years:{" "}
              {others.map((e, j) => (
                <span key={e.policy_id}>
                  {j > 0 && "; "}
                  <RecordLink rec={`policy:${e.policy_id}`}>
                    {name(e.geo_id)}, {e.dimension_label.toLowerCase()} → {words(e.policy_value)} from {e.effective_start}
                  </RecordLink>
                </span>
              ))}
              . Any of them could move the same outcomes.
            </li>
          )}
          {covid && <li>The after years include 2020–2022: the pandemic shifted alcohol sales, drinking and travel everywhere.</li>}
          {runs.some((r) => r.result?.states.some((s) => !s.included)) && <li>Some comparison states had no values on one side and are left out of those outcomes (see each outcome).</li>}
          {runs.flatMap((r) => (r.meta.notes || r.meta.overlap_note ? [<li key={r.meta.metric_id}>{r.meta.label}: {[r.meta.overlap_note, r.meta.notes].filter(Boolean).join(" ")}</li>] : []))}
          <li>Only coded, verified law is used. Policy records are machine-assisted, not reviewed by a person.</li>
        </ul>
      </section>

      <section className="panel" aria-labelledby="meth-h">
        <h2 id="meth-h">How this was calculated ({CHANGE_METHOD})</h2>
        <ul className="small source-list">
          <li>Each value is placed by its own period dates: before (ends before {c.date}), after (starts on or after it) or transition (straddles it). Fiscal years keep each state's own boundaries.</li>
          <li>Year 0 is {name(c.target)}'s period containing {c.date}, or the period starting on it. Before years are the {c.before} years before year 0; after years the {c.after} years from the first full period after the change.</li>
          <li>Average = sum of the values used ÷ number of years used. Missing years are never filled.</li>
          <li>Change = after average − before average. Percent change = 100 × change ÷ before average, shown only when the before average is above zero. For percentages (survey shares) the change is in percentage points.</li>
          <li>Difference in changes = {name(c.target)}'s change − the comparison state's change, over the same years. It is descriptive and not an effect estimate.</li>
          <li>Pre-period trend = least-squares slope of the before values against the year (units per year), from three or more before years. Different trends before the change mean the states were already moving apart. The slope's standard error comes from the scatter around the line, so a trend through few or noisy points is shown with a wide ±. A difference in trends that cannot be told from zero is not evidence that the trends were parallel.</li>
          <li>
            Published intervals: for survey measures (BRFSS, YRBS) the interval is sampling error; for FARS deaths it is chance variation in the yearly count (FARS lists every
            fatal crash, so it is not a sample) plus, for alcohol-impaired-driving deaths, the spread across NHTSA's imputed blood-alcohol readings. Each year's standard error is the
            larger side of its published 95% interval ÷ 1.96 (for most survey years the two sides agree). An average of n years has error √(sum of squares) ÷ n; a change combines
            its two averages, and a difference in changes combines the two states. This treats years and states as independent (separate annual samples and separate years of
            deaths); no source publishes a covariance between them. It covers only what the published intervals cover, and only where the source publishes one.
          </li>
          <li>Pooled comparison = the equally weighted average of the comparison states' changes; the leave-one-out range repeats it with each state removed. Its interval, like the others, covers only the published intervals; how far the comparison states' own changes spread is shown beside it, because states' changes differ by more than that. Log points = 100 × ln(after average ÷ before average); the difference in log points is symmetric between states where percent changes are not.</li>
          <li>Placebo check: the same calculation at the same month and day one, two, … years earlier, keeping only dates whose whole window ends before the real change and has as many usable years as the real one. The dates are chosen without regard to any law; it is a diagnostic, not proof that nothing else changed in those years. Neighbouring windows overlap, so the dates are not independent. The share is (1 + number of placebo gaps at least as large as the real gap) ÷ (1 + number of placebo dates), and is quoted only with {PLACEBO_MIN_RUNS} or more dates.</li>
          <li>Values in constant dollars or per resident come from the dataset's own conversions (CPI-U fiscal-year averages; Census July 1 population).</li>
        </ul>
      </section>

      <section className="panel" aria-labelledby="src-h">
        <h2 id="src-h">Sources</h2>
        <details className="small">
          <summary>Source files for the {usedRows.length} values used</summary>
          {[...new Set(usedRows.map((r) => r.obs.asset_id))].sort().map((a) => (
            <div key={a} style={{ marginBottom: 8 }}>
              <SourceRef assetId={a} />
            </div>
          ))}
        </details>
        <DownloadRows
          rows={usedRows}
          name={`before_after_${c.target.replace(":", "")}_${c.date}`}
          title={question}
          filters={{ view: "change", ...Object.fromEntries(Object.entries(changePatch(c)).map(([k, v]) => [k, v === null || v === undefined ? "" : String(v)])), method: CHANGE_METHOD }}
          notes={["Only the values used in the averages are included. Transition, missing and dropped years are listed on the page."]}
        />
      </section>

      <SaveBar
        view="change"
        method={CHANGE_METHOD}
        manifest={man}
        defaultName={`${name(c.target)} ${c.date}`}
        inputs={{ ...changePatch(c), pd: c.policy, b: c.before, af: c.after, tr: c.includeTransition ? 1 : 0, ys: c.yearSet, et: c.eventChart ? 1 : 0, er: c.relative ? 1 : 0 }}
        csv={{ name: `before_after_${c.target.replace(":", "")}_${c.date}.csv`, make: csv }}
        results={() => ({
          kind: "observations",
          question,
          outcomes: runs.map((r) => ({
            outcome: r.meta.metric_id,
            shown_as: r.shown,
            unit: r.unit,
            used_before: r.result?.usedBefore,
            used_after: r.result?.usedAfter,
            states: r.result?.states.map((s) => ({ geo: s.geo, before: s.beforeMean, after: s.afterMean, change: s.change, pct: s.pctChange })),
            differences: r.result?.diffs,
          })),
        })}
      />
    </>
  );
}

function trendNote(d: DiffResult, target: string, other: string, unit: string): string {
  if (d.diffChange === null || d.trendOnly === null) return "";
  if (d.trendReliable === false) {
    return `The before-period trends are too uncertain to say how much of this difference they would produce (trend-only figure ${signed(d.trendOnly, unit)}, 95% interval ${intervalText(d.trendOnlyInterval, unit)}, which includes zero). That does not show the trends were parallel: with few years a real difference in trends can go undetected.`;
  }
  const share = d.diffChange !== 0 ? d.trendOnly / d.diffChange : null;
  if (share === null) return "";
  const of = `${signed(d.trendOnly, unit)} of the ${signed(d.diffChange, unit)}`;
  // Arithmetic on straight lines, not attribution: the lines are an assumption about what would have happened.
  if (share >= 0.8) return `Straight-line before-period trends, carried forward, would by themselves give most of this difference between ${target} and ${other} (${of}). A straight line is an assumption, not a forecast.`;
  if (share >= 0.2) return `Straight-line before-period trends, carried forward, would give part of this difference (${of}).`;
  if (share > -0.2) return `Carried forward, the before-period trends would give little of this difference (${signed(d.trendOnly, unit)}).`;
  return `The difference runs against the before-period trends, which carried forward would give ${signed(d.trendOnly, unit)}.`;
}

/** The t value for a slope's 95% interval (see lib/stats tCritical95), kept here so the table can show ± beside a trend. */
function tTrend(df: number): number {
  return tCritical95(df) ?? 0;
}

function PooledBlock({ pooled, run, target, name, ivWhat }: { pooled: PooledResult; run: OutcomeRun; target: string; name: (g: string) => string; ivWhat: string }) {
  if (pooled.why || pooled.diffChange === null) {
    return <p className="small muted">All comparison states pooled: not computed ({pooled.why}).</p>;
  }
  const w = pooled.weights.every((x) => Math.abs(x - pooled.weights[0]) < 1e-9) ? "equal weights" : "weighted";
  return (
    <div className="table-wrap">
      <table className="data">
        <caption className="small">
          All comparison states pooled ({pooled.geos.map(name).join(", ")}; {w}). Not an effect estimate.
          {pooled.spread &&
            ` The comparison states' own changes ran from ${signed(pooled.spread.min, run.unit)} to ${signed(pooled.spread.max, run.unit)}${pooled.spread.sd !== null ? ` (standard deviation ${gapSize(pooled.spread.sd, run.unit)})` : ""}; ${target}'s change is ${pooled.spread.targetInside ? "inside" : "outside"} that span. The interval covers ${ivWhat} only, not how much states' changes differ from one another.`}
        </caption>
        <thead>
          <tr>
            <th scope="col">Pooled comparison</th>
            <th scope="col" className="num">
              Their average change
            </th>
            <th scope="col" className="num">
              {target}'s change minus it
            </th>
            <th scope="col" className="num">
              95% interval, {ivWhat} only
            </th>
            <th scope="col" className="num">
              In log points
            </th>
            <th scope="col">Leaving each state out in turn</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">{pooled.geos.length} states</th>
            <td className="num">{signed(pooled.comparisonChange, run.unit)}</td>
            <td className="num">{signed(pooled.diffChange, run.unit)}</td>
            <td className="num">
              {intervalText(pooled.diffInterval, run.unit)}
              {pooled.diffP !== null && <div className="small muted">{pText(pooled.diffP)}</div>}
            </td>
            <td className="num">{logPts(pooled.diffLog) ?? "—"}</td>
            <td className="small">
              {pooled.range ? (
                <>
                  {signed(pooled.range[0], run.unit)} to {signed(pooled.range[1], run.unit)}:{" "}
                  {pooled.leaveOneOut.map((x, i) => (
                    <span key={x.dropped}>
                      {i > 0 && "; "}
                      without {name(x.dropped)} {signed(x.diffChange, run.unit)}
                    </span>
                  ))}
                </>
              ) : (
                "—"
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function placeboSentence(p: PlaceboSummary, unit: string): string {
  if (p.actual === null) return "no real difference to compare";
  if (!p.enough) return `only ${p.n} usable date${p.n === 1 ? "" : "s"} (a share needs ${PLACEBO_MIN_RUNS}); the placebo gaps are listed, not summarized`;
  if (p.typical === 0 || p.ratio === null) return p.share !== null && p.share <= 0.1 ? "larger than the placebo gaps (which were all about zero)" : "no larger than the placebo gaps";
  return p.share !== null && p.share <= 0.1
    ? `larger than most placebo gaps (${p.ratio.toFixed(1)} × the typical gap of ${gapSize(p.typical!, unit)})`
    : `not unusual: placebo gaps this large are common (${p.ratio.toFixed(1)} × the typical gap of ${gapSize(p.typical!, unit)})`;
}

function PlaceboBlock({ pl, run, target, name }: { pl: PlaceboResult; run: OutcomeRun; target: string; name: (g: string) => string }) {
  if (pl.why) {
    return (
      <p className="small muted">
        <strong>Placebo check</strong> (the same comparison at earlier dates chosen without regard to any law): not run — {pl.why}.
      </p>
    );
  }
  const rows: PlaceboSummary[] = [...(pl.pooled ? [pl.pooled] : []), ...pl.summaries];
  return (
    <div className="table-wrap">
      <table className="data">
        <caption className="small">
          Placebo check: {target}'s “difference in changes” recomputed at {pl.runs.length} earlier date{pl.runs.length === 1 ? "" : "s"} chosen without regard to any law ({pl.runs.map((r) => r.date).join(", ")}).
          A diagnostic, not proof that nothing else changed then: other laws, prices and the economy moved in those years too. Windows overlap, so the dates are not independent. A real gap no larger than the placebo gaps does not stand out from ordinary movement; a larger one is unusual for these states and years, which is not the same as caused by the change.
        </caption>
        <thead>
          <tr>
            <th scope="col">Compared with</th>
            <th scope="col" className="num">
              Real difference
            </th>
            <th scope="col" className="num">
              Placebo gaps
            </th>
            <th scope="col" className="num">
              Typical placebo gap
            </th>
            <th scope="col" className="num">
              Share of placebo gaps as large
            </th>
            <th scope="col">Reading</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.geo}>
              <th scope="row">{p.geo === "pooled" ? "Pool of all comparison states" : name(p.geo)}</th>
              <td className="num">{signed(p.actual, run.unit)}</td>
              <td className="num">
                {p.n}
                {p.sd !== null && <div className="small muted">sd {gapSize(p.sd, run.unit)}</div>}
              </td>
              <td className="num">{p.typical === null ? "—" : gapSize(p.typical, run.unit)}</td>
              <td className="num">{p.enough && p.share !== null ? p.share.toFixed(2) : "—"}</td>
              <td className="small">{placeboSentence(p, run.unit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OutcomeBlock({ n, run, c, geos, verified }: { n: number; run: OutcomeRun; c: ChangeInputs; geos: Geography[]; verified: boolean }) {
  const name = (g: string) => geoName(g, geos);
  const r = run.result;
  const m = run.meta;
  const id = `out-${n}`;
  const shownLabel = run.shown === "per_resident_21plus" ? "US dollars per resident aged 21+ (nominal)" : unitLabel(run.unit);
  if (run.unavailable || !r) {
    return (
      <section className="panel" aria-labelledby={id}>
        <h3 id={id}>
          Outcome {n}: {m.label}
        </h3>
        <Empty>Not available as {SHOWN_LABELS[run.shown].toLowerCase()}: {run.unavailable}</Empty>
      </section>
    );
  }
  const first = r.beforeWindow[0];
  const last = r.afterWindow[r.afterWindow.length - 1];
  const domain: [number, number] = [Math.max(m.first_year, first - 2), Math.min(m.last_year, last + 2)];
  const mark: Annotation = {
    year: r.year0,
    kind: r.transitionYear !== null ? "transition" : "line",
    label: `${verified ? "Verified" : "Assumed"} change date ${c.date}`,
  };
  const target = r.states[0];
  const kAfterEnd = r.transitionYear !== null ? c.after : c.after - 1;
  const eventSeries = run.series.map((s, i) => ({
    key: s.geo,
    label: name(s.geo),
    points: eventTime(s.rows, r.year0, r.states[i].beforeMean, c.relative)
      .filter((p) => p.k >= -c.before && p.k <= kAfterEnd)
      .map(
        (p): ChartPoint => ({
          year: p.k,
          value: p.value,
          comparability_group: p.row.obs.comparability_group,
          rec: `obs:${m.metric_id}:${p.row.obs.observation_id}`,
          period_label: p.row.obs.period_label,
        }),
      ),
  }));
  const comparisons = r.states.slice(1);
  // What the published intervals of this outcome describe (survey sampling error, or chance variation in a count of deaths).
  const ivRow = r.states.flatMap((s) => s.cells).find((x) => x.se !== null && x.row);
  const ivWhat = intervalPhrase(intervalKind(ivRow?.row?.obs ?? {}));
  return (
    <section className="panel" aria-labelledby={id}>
      <h3 id={id}>
        Outcome {n}: {m.label}
      </h3>
      <p className="small muted">
        {shownLabel} · {PERIOD_KIND_LABELS[m.period_kind]} · data {m.first_year}–{m.last_year}. Year 0 is {r.year0}
        {r.transitionYear !== null ? ` (a transition year: the change took effect part-way through it)` : ` (the first full period under the change)`}. Before:{" "}
        {yearsText(r.beforeWindow)}; after: {yearsText(r.afterWindow)}.
      </p>
      {!r.computable && <p className="warn small">No change is computed for {name(c.target)}: {r.whyNot}.</p>}

      <TrendChart
        series={run.series.map((s) => ({ key: s.geo, label: name(s.geo), points: s.points }))}
        unit={run.unit}
        domain={domain}
        annotations={[mark]}
        title={`${m.label} by year, ${[c.target, ...c.comparisons].map(name).join(", ")}`}
      />

      {r.computable && (
        <div className="table-wrap">
          <table className="data">
            <caption className="small">Averages and changes. Years used are listed; every average for a state uses the years shown in its row.</caption>
            <thead>
              <tr>
                <th scope="col">State</th>
                <th scope="col">Before: years</th>
                <th scope="col" className="num">
                  Before average
                </th>
                <th scope="col">After: years</th>
                <th scope="col" className="num">
                  After average
                </th>
                <th scope="col" className="num">
                  Change
                </th>
                <th scope="col" className="num">
                  % change
                </th>
                <th scope="col" className="num">
                  Trend before (per year)
                </th>
              </tr>
            </thead>
            <tbody>
              {r.states.map((s) => (
                <tr key={s.geo}>
                  <th scope="row">
                    {name(s.geo)}
                    {s.geo === c.target && <div className="small muted">changed its law</div>}
                  </th>
                  {!s.included || !s.comparable ? (
                    <td colSpan={7} className="small muted">
                      Not compared: {s.excludedWhy ?? s.notComparableWhy}
                    </td>
                  ) : (
                    <>
                      <td className="small">{yearsText(s.beforeYears)}</td>
                      <td className="num">{precise(s.beforeMean, run.unit)}</td>
                      <td className="small">{yearsText(s.afterYears)}</td>
                      <td className="num">{precise(s.afterMean, run.unit)}</td>
                      <td className="num">
                        {signed(s.change, run.unit)}
                        {s.changeSE !== null && <div className="small muted" title={`95% interval from the published intervals: ${ivWhat} only`}>{plusMinus(s.changeSE, run.unit)}</div>}
                      </td>
                      <td className="num" title={s.pctWhy ?? undefined}>
                        {s.pctChange === null ? <span className="small muted">{s.pctWhy ? "undefined" : "—"}</span> : pct(s.pctChange)}
                      </td>
                      <td className="num">
                        {s.slope === null ? <span className="small muted" title="a trend needs three before years">—</span> : signed(s.slope, run.unit)}
                        {s.slopeSE !== null && s.slopeDf !== null && <div className="small muted" title={`standard error ${s.slopeSE.toPrecision(2)} on ${s.slopeDf} degrees of freedom`}>{plusMinus(s.slopeSE * (tTrend(s.slopeDf)), run.unit)}</div>}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {r.computable && target.pctWhy && <p className="small muted">Percent change for {name(c.target)}: {target.pctWhy}.</p>}

      {r.computable && comparisons.length > 0 && (
        <div className="table-wrap">
          <table className="data">
            <caption className="small">
              Descriptive difference in changes: {name(c.target)}'s change minus each comparison state's change over the same years. Not an effect estimate.
            </caption>
            <thead>
              <tr>
                <th scope="col">Compared with</th>
                <th scope="col" className="num">
                  Difference in changes
                </th>
                <th scope="col" className="num">
                  95% interval, {ivWhat} only
                </th>
                <th scope="col" className="num">
                  Difference in % changes
                </th>
                <th scope="col" className="num">
                  Difference in trends before
                </th>
                <th scope="col" className="num">
                  If before trends had continued
                </th>
                <th scope="col">Note</th>
              </tr>
            </thead>
            <tbody>
              {r.diffs.map((d) => (
                <tr key={d.geo}>
                  <th scope="row">{name(d.geo)}</th>
                  <td className="num">{signed(d.diffChange, run.unit)}</td>
                  <td className="num">
                    {intervalText(d.diffInterval, run.unit)}
                    {d.diffP !== null && <div className="small muted">{pText(d.diffP)}</div>}
                  </td>
                  <td className="num">
                    {d.diffPct === null ? "—" : `${sign(d.diffPct)}${Math.abs(d.diffPct).toFixed(1)} points`}
                    {d.diffLog !== null && <div className="small muted">{logPts(d.diffLog)}</div>}
                  </td>
                  <td className="num">{d.slopeDiff === null ? "—" : `${signed(d.slopeDiff, run.unit)} a year`}</td>
                  <td className="num">{signed(d.trendOnly, run.unit)}</td>
                  <td className="small">{d.why ?? trendNote(d, name(c.target), name(d.geo), run.unit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {r.computable && comparisons.length > 0 && (
        <p className="small muted">
          “If before trends had continued” is the difference in changes the two states' before-period trends alone would produce (difference in
          trends × the years between the middles of the before and after years). When it is close to the actual difference, the before-and-after
          comparison adds little beyond trends already under way; when the trends are too uncertain (a trend needs three before years and, with
          few, is very noisy), the note says so instead.
        </p>
      )}
      {r.computable && comparisons.length > 0 && (
        <p className="small muted">
          {r.diffs.some((d) => d.diffChangeSE !== null)
            ? `The interval covers ${ivWhat} only (each year's published interval, combined across years and states, which are treated as independent). It says nothing about bias, other laws or the pandemic, and a gap outside it is not evidence that the change caused anything. Log points: 100 × the difference in ln(after ÷ before); unlike percent changes they are symmetric between states.`
            : "This measure has no published confidence intervals, so no interval can be shown. The placebo check below shows how large a difference in changes is at earlier dates chosen without regard to any law."}
        </p>
      )}
      {r.computable && r.pooled && r.pooled.geos.length > 1 && <PooledBlock pooled={r.pooled} run={run} target={name(c.target)} name={name} ivWhat={ivWhat} />}
      {run.placebo && <PlaceboBlock pl={run.placebo} run={run} target={name(c.target)} name={name} />}

      {r.dropped.length > 0 && (
        <p className="small">
          <strong>Years dropped so every state uses the same years:</strong>{" "}
          {r.dropped.map((d) => `${d.year} (${d.window}: ${d.why.replace(/state:\d\d/g, (g) => name(g))})`).join("; ")}.
        </p>
      )}
      {r.transitionYear !== null && !c.includeTransition && (
        <p className="small muted">The transition year {r.transitionYear} is shown in the charts but left out of the averages.</p>
      )}

      {c.eventChart && (
        <>
          <h4>Event time: years before and after the change (year 0 = {r.year0})</h4>
          <TrendChart
            series={eventSeries}
            unit={c.relative ? "index_before_average" : run.unit}
            domain={[-c.before, kAfterEnd]}
            annotations={[{ ...mark, year: 0 }]}
            title={`${m.label} in event time`}
            height={240}
          />
          <p className="small muted">
            {c.relative ? "100 = each state's own before average (not shown for a state whose before average is zero or below). " : ""}
            The x axis counts years from the change; hover a point to see its actual period.
          </p>
        </>
      )}

      <details className="small">
        <summary>Every value considered ({r.states.reduce((a, s) => a + s.cells.length, 0)} cells) and why it was used or not</summary>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th scope="col">State</th>
                <th scope="col">Year</th>
                <th scope="col">Period</th>
                <th scope="col" className="num">
                  Value
                </th>
                <th scope="col">Window</th>
                <th scope="col">Used?</th>
              </tr>
            </thead>
            <tbody>
              {r.states.flatMap((s) =>
                s.cells.map((x) => (
                  <tr key={`${s.geo}-${x.year}`}>
                    <td>{name(s.geo)}</td>
                    <td>{x.year}</td>
                    <td>{x.row ? `${x.row.obs.period_start} to ${x.row.obs.period_end}` : "—"}</td>
                    <td className="num">
                      {x.row ? <RecordLink rec={`obs:${m.metric_id}:${x.row.obs.observation_id}`}>{formatValue(x.value, run.unit)}</RecordLink> : "—"}
                    </td>
                    <td>{x.window}</td>
                    <td>{x.status === "used" ? "yes" : `no: ${x.why ?? words(x.status)}`}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
