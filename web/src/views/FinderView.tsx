// Find comparison states: which states resembled a target state in a baseline period, on characteristics
// the reader picks, with every value behind each score on screen. Results are candidates, not validated
// controls. Calculations: lib/finder.ts (FINDER_METHOD).
import { useEffect, useState, type FormEvent } from "react";
import { Empty, ErrorNote, Go, Loading, RecordLink, SourceRef } from "../components/common";
import { ControlBadge, ControlDims, assessAll } from "../components/ControlFilter";
import { BuildNotice, SaveBar } from "../components/SaveBar";
import { CRITERIA, criterionById, verdictText, type CriterionId } from "../lib/control";
import { snapshotsFor, statusChanges, statusOnDay, yearStatuses } from "../lib/analysis";
import { toCsv, type Column } from "../lib/csv";
import { useData, useMany } from "../lib/data";
import {
  CHARACTERISTICS,
  FINDER_METHOD,
  DEFAULT_DISTANCE,
  characteristicData,
  finderWarnings,
  rankCandidates,
  similarityWord,
  trendPercent,
  type CharData,
  type Distance,
} from "../lib/finder";
import { geoName, precise, words } from "../lib/format";
import type { Geography, Manifest, MetricFile, MetricMeta, MetricsIndex, PolicyData } from "../lib/types";
import { navigate, pickInt, pickOne, useParams, type Patch } from "../lib/url";

const WINE = "ordinary_grocery_wine_authorization";
const EXCLUSIONS = ["changed", "allowed", "notallowed", "unknown"] as const;
type Exclusion = (typeof EXCLUSIONS)[number];
const WEIGHTS = [0.5, 1, 2, 3];
const DISTANCES = ["mahalanobis", "rms"] as const;

/** A baseline value in the characteristic's own units; trends as a percent change per year. */
const fmtChar = (x: CharData, v: number | null | undefined) =>
  v === null || v === undefined ? "—" : x.c.kind === "binary" ? (v ? "yes" : "no") : x.c.trend ? `${trendPercent(v).toFixed(1)}% a year` : precise(v, x.meta?.unit ?? "");

interface FinderInputs {
  target: string;
  from: number;
  to: number;
  chars: string[];
  weights: Record<string, number>;
  minCoverage: number;
  /** How differences on several characteristics are combined into a score. */
  distance: Distance;
  exclude: Exclusion[];
  checkTo: number;
  changeDate: string | null;
  policy: string;
  /** Liquor-control criterion (lib/control.ts), and what to do with candidates that fail or cannot be assessed. */
  control: CriterionId | null;
  controlMode: ControlMode;
}

const CONTROL_MODES = ["mark", "exclude", "require"] as const;
type ControlMode = (typeof CONTROL_MODES)[number];

function defaults(asOfYear: number): FinderInputs {
  return {
    target: "state:49",
    from: 2015,
    to: 2019,
    chars: CHARACTERISTICS.filter((c) => c.defaultOn).map((c) => c.id),
    weights: {},
    minCoverage: 1,
    distance: DEFAULT_DISTANCE,
    exclude: ["changed"],
    checkTo: asOfYear,
    changeDate: null,
    policy: WINE,
    control: null,
    controlMode: "mark",
  };
}

function finderPatch(f: FinderInputs, from: string | null): Patch {
  return {
    v: "finder",
    t: f.target,
    y0: f.from,
    y1: f.to,
    ch: f.chars.join(",") || "none",
    w: Object.entries(f.weights)
      .filter(([k, v]) => v !== 1 && f.chars.includes(k))
      .map(([k, v]) => `${k}:${v}`)
      .join(",") || null,
    mc: f.minCoverage === 1 ? null : Math.round(f.minCoverage * 100),
    dm: f.distance === DEFAULT_DISTANCE ? null : f.distance,
    ex: f.exclude.join(",") || "none",
    ct: f.checkTo,
    d: f.changeDate,
    ca: f.control,
    cm: f.control && f.controlMode !== "mark" ? f.controlMode : null,
    from,
  };
}

function readInputs(params: URLSearchParams, states: string[], pol: PolicyData): FinderInputs {
  const asOfYear = Number(pol.as_of_date.slice(0, 4));
  const base = defaults(asOfYear);
  const d = params.get("d");
  const changeDate = d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
  const target = pickOne(params.get("t"), states, base.target);
  // With a change date the baseline ends the year before it, so a match never uses post-change outcomes.
  const latest = changeDate ? Number(changeDate.slice(0, 4)) - 1 : asOfYear;
  const defTo = changeDate ? latest : base.to;
  let to = pickInt(params.get("y1"), 1970, latest, Math.min(defTo, latest));
  let from = pickInt(params.get("y0"), 1970, latest, Math.min(changeDate ? latest - 4 : base.from, to));
  if (from > to) [from, to] = [to, from];
  const ids = CHARACTERISTICS.map((c) => c.id);
  const ch = params.get("ch");
  const chars = ch === "none" ? [] : ch ? ch.split(",").filter((x, i, a) => ids.includes(x) && a.indexOf(x) === i) : base.chars;
  const weights: Record<string, number> = {};
  for (const part of (params.get("w") ?? "").split(",")) {
    const [k, v] = part.split(":");
    if (ids.includes(k) && WEIGHTS.includes(Number(v))) weights[k] = Number(v);
  }
  const ex = params.get("ex");
  return {
    target,
    from,
    to,
    chars,
    weights,
    minCoverage: [50, 75, 100].includes(Number(params.get("mc"))) ? Number(params.get("mc")) / 100 : 1,
    distance: pickOne(params.get("dm"), DISTANCES, DEFAULT_DISTANCE),
    exclude: ex === "none" ? [] : ex ? (ex.split(",").filter((x) => (EXCLUSIONS as readonly string[]).includes(x)) as Exclusion[]) : base.exclude,
    checkTo: pickInt(params.get("ct"), from, asOfYear, asOfYear),
    changeDate,
    policy: pickOne(params.get("pd"), Object.keys(pol.dimensions), WINE),
    control: criterionById(params.get("ca"))?.id ?? null,
    controlMode: pickOne(params.get("cm"), CONTROL_MODES, "mark"),
  };
}

interface PolicyNote {
  status: string;
  knownDays: number;
  days: number;
  values: string[];
  changes: { day: string; text: string; verified: boolean; policyId: string | null }[];
  snapshot: string | null;
  snapshotId: string | null;
}

function policyNote(pol: PolicyData, geo: string, f: FinderInputs): PolicyNote {
  const ys = yearStatuses(pol.segments, geo, f.policy, f.from, f.to, pol.as_of_date);
  const knownDays = ys.reduce((a, y) => a + y.knownDays, 0);
  const days = ys.reduce((a, y) => a + y.days, 0);
  const values = [...new Set(ys.flatMap((y) => y.values))];
  const coded = ys.some((y) => y.kind !== "not_coded");
  const status = !coded
    ? "not coded (no verified day)"
    : knownDays === 0
      ? "unknown (no verified day in the baseline)"
      : knownDays === days && values.length === 1
        ? `${words(values[0])}, verified every day`
        : `${values.map(words).join(" → ")} on ${knownDays.toLocaleString("en-US")} of ${days.toLocaleString("en-US")} days`;
  const lo = `${f.from}-01-01`;
  const hi = `${f.checkTo}-12-31`;
  const changes: PolicyNote["changes"] = [];
  for (const c of statusChanges(pol.segments, geo, f.policy)) {
    if (c.day >= lo && c.day <= hi) changes.push({ day: c.day, text: `${words(c.from)} → ${words(c.to)} (verified)`, verified: true, policyId: c.policyIds[0] ?? null });
  }
  for (const e of pol.events) {
    if (e.geo_id !== geo || !e.effective_start || e.effective_start < lo || e.effective_start > hi) continue;
    if (changes.some((c) => c.day === e.effective_start && e.policy_dimension === f.policy)) continue;
    const prev = new Date(Date.parse(`${e.effective_start}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
    const before = statusOnDay(pol.segments, geo, e.policy_dimension, prev, pol.as_of_date);
    if (before.kind === "known" && before.value === e.policy_value) continue; // a new legal basis for the same value
    const dimLabel = pol.dimensions[e.policy_dimension]?.label ?? e.policy_dimension;
    changes.push({
      day: e.effective_start,
      text:
        e.policy_dimension === f.policy
          ? `a coded interval (${words(e.policy_value)}) starts; the status before it is unknown`
          : `${dimLabel}: ${words(e.policy_value)}${before.kind === "known" ? ` (was ${words(before.value)})` : " (earlier status unknown)"}`,
      verified: false,
      policyId: e.policy_id,
    });
  }
  changes.sort((a, b) => (a.day < b.day ? -1 : 1));
  const snaps = snapshotsFor(pol.snapshots, geo, f.policy);
  const s = snaps[snaps.length - 1];
  return {
    status,
    knownDays,
    days,
    values,
    changes,
    snapshot: s ? `${words(s.policy_value)} (current-law snapshot dated ${s.observed_on ?? s.observed_year}; says nothing about the baseline)` : null,
    snapshotId: s?.snapshot_id ?? null,
  };
}

function exclusionReason(n: PolicyNote, ex: Exclusion[], policyLabel: string): string | null {
  const own = n.changes.filter((c) => c.verified || c.text.startsWith("a coded interval"));
  if (ex.includes("changed") && own.length) return `${policyLabel} changed or may have changed on ${own.map((c) => c.day).join(", ")}`;
  if (ex.includes("allowed") && n.values.some((v) => v.startsWith("authorized"))) return "verified to allow it during the baseline";
  if (ex.includes("notallowed") && n.values.includes("not_authorized")) return "verified not to allow it during the baseline";
  if (ex.includes("unknown") && n.knownDays === 0) return "no verified status in the baseline";
  return null;
}

export function FinderView() {
  const params = useParams();
  const idx = useData<MetricsIndex>("metrics.json");
  const geos = useData<Geography[]>("geographies.json");
  const pol = useData<PolicyData>("policy.json");
  const man = useData<Manifest>("manifest.json");
  const metas = CHARACTERISTICS.map((c) => idx.data?.metrics.find((m) => m.metric_id === c.metric));
  const files = useMany<MetricFile>(idx.data ? metas.filter((m): m is MetricMeta => Boolean(m)).map((m) => m.file) : []);
  const err = idx.error ?? geos.error ?? pol.error ?? man.error ?? files.error;
  if (err) return <ErrorNote error={err} />;
  if (!idx.data || !geos.data || !pol.data || !man.data || !files.data) return <Loading what="the comparison finder" />;
  const states = geos.data.filter((g) => g.geo_level === "state").map((g) => g.geo_id);
  const applied = readInputs(params, states, pol.data);
  const fileOf = new Map(metas.filter((m): m is MetricMeta => Boolean(m)).map((m, i) => [m.metric_id, files.data![i]]));
  const charData = (f: FinderInputs) => CHARACTERISTICS.map((c, i) => characteristicData(c, metas[i], fileOf.get(c.metric), f, states, idx.data!));
  return (
    <>
      <section className="panel" aria-labelledby="fd-h">
        <h2 id="fd-h">Find comparison states</h2>
        <p className="small">
          Which states looked most like a chosen state before any change you want to study? Pick the characteristics and years to
          compare. Every score shows the values behind it. The results are candidates to look at, not proof that a state is a fair
          comparison.
        </p>
        <BuildNotice manifest={man.data} method={FINDER_METHOD} />
        <FinderForm applied={applied} geos={geos.data} pol={pol.data} charData={charData} returnTo={params.get("from")} />
      </section>
      <FinderResults f={applied} cd={charData(applied)} geos={geos.data} pol={pol.data} man={man.data} returnTo={params.get("from")} />
    </>
  );
}

function FinderForm({
  applied,
  geos,
  pol,
  charData,
  returnTo,
}: {
  applied: FinderInputs;
  geos: Geography[];
  pol: PolicyData;
  charData: (f: FinderInputs) => CharData[];
  returnTo: string | null;
}) {
  const [draft, setDraft] = useState(applied);
  const key = JSON.stringify(applied);
  useEffect(() => setDraft(JSON.parse(key) as FinderInputs), [key]);
  const set = (p: Partial<FinderInputs>) => setDraft((d) => ({ ...d, ...p }));
  const states = geos.filter((g) => g.geo_level === "state");
  const asOfYear = Number(pol.as_of_date.slice(0, 4));
  const latest = draft.changeDate ? Number(draft.changeDate.slice(0, 4)) - 1 : asOfYear;
  const cd = charData(draft);
  const dirty = JSON.stringify(draft) !== key;
  const problems: string[] = [];
  if (draft.from > draft.to) problems.push("The baseline must start before it ends.");
  if (draft.to > latest) problems.push(`The baseline must end by ${latest}, the year before the change on ${draft.changeDate}.`);
  if (!draft.chars.length) problems.push("Pick at least one characteristic.");
  const policyLabel = pol.dimensions[draft.policy]?.label.toLowerCase() ?? draft.policy;
  const run = (e: FormEvent) => {
    e.preventDefault();
    if (problems.length) return;
    navigate(finderPatch(draft, returnTo), { reset: true });
  };
  return (
    <form onSubmit={run} aria-label="Inputs">
      <div className="row-actions no-print">
        <span className="small muted">Examples:</span>
        <Go to={{ v: "finder" }} reset>
          Utah, 2015–2019
        </Go>
        <Go to={{ v: "finder", t: "state:47", y0: 2011, y1: 2015, d: "2016-07-01" }} reset>
          Tennessee before its 2016 change
        </Go>
      </div>
      <fieldset className="inputs">
        <legend>1. State and baseline years</legend>
        <div className="controls">
          <label>
            State to match
            <select value={draft.target} onChange={(e) => set({ target: e.target.value })}>
              {states.map((g) => (
                <option key={g.geo_id} value={g.geo_id}>
                  {g.name}
                </option>
              ))}
            </select>
            <span className="help">The state you want comparisons for.</span>
          </label>
          <label>
            Baseline from
            <input type="number" min={1970} max={latest} value={draft.from} onChange={(e) => set({ from: Number(e.target.value) || draft.from })} />
          </label>
          <label>
            to
            <input type="number" min={1970} max={latest} value={draft.to} onChange={(e) => set({ to: Number(e.target.value) || draft.to })} />
            <span className="help">Characteristics are averaged over these years.</span>
          </label>
        </div>
        <p className="help">
          {draft.changeDate
            ? `Matching for a change on ${draft.changeDate}: the baseline must end by ${latest}, so states are never chosen for how they did afterwards.`
            : "Choose years before any change you plan to study, so states are never chosen for how their outcomes moved afterwards."}
        </p>
      </fieldset>

      <fieldset className="inputs">
        <legend>2. Characteristics to compare</legend>
        <p className="help">Each is put on a common scale (standard deviations across states). The weight says how much it counts.</p>
        <ul className="source-list" style={{ listStyle: "none", paddingLeft: 0 }}>
          {cd.map((x) => {
            const on = draft.chars.includes(x.c.id);
            const tv = x.values.get(draft.target);
            return (
              <li key={x.c.id} style={{ marginBottom: 8 }}>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) => set({ chars: e.target.checked ? [...draft.chars, x.c.id] : draft.chars.filter((c) => c !== x.c.id) })}
                  />
                  <span>
                    {x.c.label}{" "}
                    {on && (
                      <select
                        aria-label={`Weight for ${x.c.label}`}
                        value={draft.weights[x.c.id] ?? 1}
                        onChange={(e) => set({ weights: { ...draft.weights, [x.c.id]: Number(e.target.value) } })}
                      >
                        {WEIGHTS.map((w) => (
                          <option key={w} value={w}>
                            weight {w}
                          </option>
                        ))}
                      </select>
                    )}
                  </span>
                  <span className="help">
                    {x.c.help} {x.scale.n} states have baseline values;{" "}
                    {x.scale.usable ? (
                      <>
                        {geoName(draft.target, geos)}: {fmtChar(x, tv?.value)}.
                      </>
                    ) : (
                      <strong>cannot be used for these years: {x.scale.why}.</strong>
                    )}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        <fieldset className="radios">
          <legend>Minimum coverage</legend>
          {[1, 0.75, 0.5].map((m) => (
            <label className="check" key={m}>
              <input type="radio" name="mc" checked={draft.minCoverage === m} onChange={() => set({ minCoverage: m })} />
              {m === 1 ? "A state needs every chosen characteristic (recommended)" : `A state needs at least ${m * 100}% of them`}
            </label>
          ))}
          <span className="help">States with missing values are always ranked after states with complete values; missing data never counts as a match.</span>
        </fieldset>
        <fieldset className="radios">
          <legend>How differences are combined</legend>
          <label className="check">
            <input type="radio" name="dm" checked={draft.distance === "mahalanobis"} onChange={() => set({ distance: "mahalanobis" })} />
            Allow for characteristics that move together (recommended): a state that differs the way the others usually differ counts as closer than one that differs against it, and characteristics that
            repeat each other are not counted twice
          </label>
          <label className="check">
            <input type="radio" name="dm" checked={draft.distance === "rms"} onChange={() => set({ distance: "rms" })} />
            Plain: every characteristic counts separately, so closely related ones count more than once
          </label>
        </fieldset>
      </fieldset>

      <fieldset className="inputs">
        <legend>3. Policy exclusions</legend>
        <p className="help">From the coded {policyLabel} law. Few states have verified history; for most the status in the baseline is unknown.</p>
        {(
          [
            ["changed", `Leave out states whose ${policyLabel} status changed, or may have changed, between the baseline start and`],
            ["allowed", "Leave out states verified to allow it during the baseline"],
            ["notallowed", "Leave out states verified not to allow it during the baseline"],
            ["unknown", "Leave out states with no verified status in the baseline"],
          ] as [Exclusion, string][]
        ).map(([k, text]) => (
          <label className="check" key={k}>
            <input
              type="checkbox"
              checked={draft.exclude.includes(k)}
              onChange={(e) => set({ exclude: e.target.checked ? [...draft.exclude, k] : draft.exclude.filter((x) => x !== k) })}
            />
            <span>
              {text}
              {k === "changed" && (
                <>
                  {" "}
                  <input
                    type="number"
                    aria-label="Last year checked for policy changes"
                    min={draft.from}
                    max={asOfYear}
                    value={draft.checkTo}
                    onChange={(e) => set({ checkTo: Number(e.target.value) || draft.checkTo })}
                  />
                </>
              )}
            </span>
          </label>
        ))}
      </fieldset>

      <fieldset className="inputs">
        <legend>4. Liquor-control arrangement</legend>
        <p className="help">
          Who wholesales and who sells spirits and wine, from coded law. Only history verified for every day of the baseline counts; few states
          have it yet, so most candidates cannot be assessed. Current law is shown beside them and never decides.
        </p>
        <label>
          Compare on
          <select value={draft.control ?? ""} onChange={(e) => set({ control: criterionById(e.target.value)?.id ?? null })}>
            <option value="">Don't compare</option>
            {CRITERIA.map((x) => (
              <option key={x.id} value={x.id}>
                {x.id === "same_as_target" ? "Same arrangement as the target state (all four)" : x.label}
              </option>
            ))}
          </select>
          <span className="help">{criterionById(draft.control)?.help ?? ""}</span>
        </label>
        {draft.control && (
          <fieldset className="radios">
            <legend>What to do with the result</legend>
            {(
              [
                ["mark", "Mark each candidate; leave everyone in"],
                ["exclude", "Leave out candidates verified to differ"],
                ["require", "Rank only candidates verified to match; list the ones that cannot be assessed separately"],
              ] as [ControlMode, string][]
            ).map(([k, text]) => (
              <label className="check" key={k}>
                <input type="radio" name="cm" checked={draft.controlMode === k} onChange={() => set({ controlMode: k })} />
                {text}
              </label>
            ))}
          </fieldset>
        )}
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
        <button type="button" onClick={() => navigate({ v: "finder", from: returnTo }, { reset: true })}>
          Reset
        </button>
        {dirty && <span className="small warn-inline">You have edits that are not in the results yet.</span>}
      </div>
    </form>
  );
}

function FinderResults({ f, cd, geos, pol, man, returnTo }: { f: FinderInputs; cd: CharData[]; geos: Geography[]; pol: PolicyData; man: Manifest; returnTo: string | null }) {
  const [checked, setChecked] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);
  const name = (g: string) => geoName(g, geos);
  const states = geos.filter((g) => g.geo_level === "state").map((g) => g.geo_id);
  const chosen = cd.filter((x) => f.chars.includes(x.c.id));
  const used = chosen.filter((x) => x.scale.usable);
  const unusable = chosen.filter((x) => !x.scale.usable);
  const policyLabel = pol.dimensions[f.policy]?.label ?? f.policy;
  if (!used.length) {
    return (
      <section className="panel">
        <Empty>None of the chosen characteristics can be used for {name(f.target)} in {f.from}–{f.to}. Pick others or change the years.</Empty>
      </section>
    );
  }
  const notes = new Map(states.map((g) => [g, policyNote(pol, g, f)]));
  // Liquor control over the whole baseline, against the target's own verified arrangement.
  const crit = criterionById(f.control);
  const control = crit ? assessAll(pol, crit, states, f.target, () => ({ from: `${f.from}-01-01`, to: `${f.to}-12-31` })) : null;
  const excluded: { geo: string; why: string }[] = [];
  const unassessable: string[] = [];
  const pool = states.filter((g) => {
    if (g === f.target) return false;
    const why = exclusionReason(notes.get(g)!, f.exclude, policyLabel.toLowerCase());
    if (why) {
      excluded.push({ geo: g, why });
      return false;
    }
    const a = control?.get(g);
    if (a && f.controlMode !== "mark" && a.verdict === "no") {
      excluded.push({ geo: g, why: `liquor control verified to differ: ${a.reasons.join("; ")}` });
      return false;
    }
    if (a && f.controlMode === "require" && a.verdict === "unknown") {
      unassessable.push(g);
      return false;
    }
    return true;
  });
  const weight = (id: string) => f.weights[id] ?? 1;
  // The finder's scoring lives in one place (lib/finder.ts), shared with Utah at a glance.
  const res = rankCandidates(used, f.target, pool, name, f.weights, f.minCoverage, { distance: f.distance });
  const { ranked, diffOf } = res;
  const warnings = finderWarnings(res, f.target, name);
  const eligible = ranked.filter((r) => r.eligible);
  // Characteristics on which the target is unlike every candidate: no choice of state fixes that.
  const outliers = used
    .filter((x) => x.c.kind === "numeric")
    .flatMap((x) => {
      const best = pool
        .map((g) => ({ geo: g, d: diffOf(x, g) }))
        .filter((p): p is { geo: string; d: number } => p.d !== null)
        .sort((a, b) => a.d - b.d)[0];
      return best && best.d > 1 ? [{ label: x.c.label, geo: best.geo, d: best.d }] : [];
    });
  const notScored = ranked.filter((r) => !r.eligible);
  const shown = showAll ? eligible : eligible.slice(0, 12);
  const maxScore = Math.max(...eligible.map((r) => r.score ?? 0), 0.0001);
  const fmt = fmtChar;
  const targetNote = notes.get(f.target)!;
  const question = `Which states most resembled ${name(f.target)} in ${f.from}–${f.to} on ${used.map((x) => x.c.label.toLowerCase()).join(", ")}?`;
  const toggle = (g: string) => setChecked((c) => (c.includes(g) ? c.filter((x) => x !== g) : [...c, g].slice(-5)));
  const pick = checked.length ? checked : eligible.slice(0, 4).map((r) => r.item);
  const useInChange = () => {
    if (returnTo) {
      const p = new URLSearchParams(returnTo);
      const existing = (p.get("cs") ?? "").split(",").filter((x) => x && x !== "none");
      p.set("cs", [...new Set([...existing, ...pick])].filter((g) => g !== p.get("t")).slice(0, 5).join(","));
      p.set("v", "change");
      navigate(Object.fromEntries(p.entries()), { reset: true });
    } else {
      navigate({ v: "change", t: f.target, cs: pick.join(","), d: f.changeDate ?? "none", m: "niaaa_ethanol_per_capita_21plus_wine@calendar_year~nominal" }, { reset: true });
    }
  };
  const csv = () => {
    type Row = Record<string, string | number | null>;
    const rows: Row[] = [];
    rows.push({ rank: null, state: name(f.target), geo_id: f.target, role: "target", score: null, coverage: null, grocery_wine_baseline: targetNote.status, ...Object.fromEntries(used.map((x) => [x.c.id, x.values.get(f.target)!.value])) });
    eligible.forEach((r, i) =>
      rows.push({
        rank: i + 1,
        state: name(r.item),
        geo_id: r.item,
        role: "candidate",
        score: r.score,
        coverage: r.coverage,
        grocery_wine_baseline: notes.get(r.item)!.status,
        changes_in_period: notes.get(r.item)!.changes.map((c) => `${c.day}: ${c.text}`).join("|"),
        liquor_control: control?.get(r.item) ? verdictText(control.get(r.item)!) : null,
        ...Object.fromEntries(used.map((x) => [x.c.id, x.values.get(r.item)!.value])),
        ...Object.fromEntries(used.map((x) => [`${x.c.id}_sd_diff`, diffOf(x, r.item)])),
      }),
    );
    for (const r of notScored) rows.push({ state: name(r.item), geo_id: r.item, role: "not scored: below minimum coverage", coverage: r.coverage });
    for (const e of excluded) rows.push({ state: name(e.geo), geo_id: e.geo, role: `excluded: ${e.why}` });
    for (const g of unassessable) rows.push({ state: name(g), geo_id: g, role: "not ranked: liquor control cannot be assessed", liquor_control: verdictText(control!.get(g)!) });
    const keys = ["rank", "state", "geo_id", "role", "score", "coverage", ...used.flatMap((x) => [x.c.id, `${x.c.id}_sd_diff`]), "grocery_wine_baseline", "changes_in_period", ...(control ? ["liquor_control"] : [])];
    const cols: Column<Row>[] = keys.map((k) => ({ key: k, kind: ["rank", "score", "coverage"].includes(k) || used.some((x) => k.startsWith(x.c.id)) ? "number" : "text", get: (r) => r[k] ?? null }));
    const head = [
      `# ${question}`,
      `# Baseline ${f.from}-${f.to}; weights ${used.map((x) => `${x.c.id}=${weight(x.c.id)}`).join(", ")}; minimum coverage ${f.minCoverage * 100}%; exclusions ${f.exclude.join(", ") || "none"}${crit ? `; liquor control: ${crit.id} (${f.controlMode}; verified history only)` : ""}.`,
      `# Score = ${
        res.decorrelation
          ? `sqrt(weighted squared Mahalanobis distance in standard deviations / total weight), correlations between characteristics shrunk toward independence (lambda ${res.decorrelation.lambda.toFixed(2)})`
          : "sqrt(weighted mean of squared differences in standard deviations)"
      }; lower is more similar. Candidates, not validated controls. Dataset ${man.dataset.release_label}; method ${FINDER_METHOD}.`,
      ...warnings.map((w) => `# Caution: ${w.text}`),
    ].join("\r\n");
    return head + "\r\n" + toCsv(cols, rows);
  };

  return (
    <>
      <section className="panel report" aria-labelledby="fr-h">
        <h2 id="fr-h">Results: candidate comparison states</h2>
        <p>
          <strong>{question}</strong>
        </p>
        <dl className="kv">
          <dt>State</dt>
          <dd>
            {name(f.target)}. {policyLabel}: {targetNote.status}.
          </dd>
          <dt>Baseline</dt>
          <dd>{f.from}–{f.to}</dd>
          <dt>Characteristics</dt>
          <dd>{used.map((x) => `${x.c.label} (weight ${weight(x.c.id)})`).join("; ")}</dd>
          <dt>Distance</dt>
          <dd>
            {res.decorrelation
              ? `allows for characteristics that move together (Mahalanobis; correlations shrunk ${Math.round(res.decorrelation.lambda * 100)}% toward independence)`
              : "plain: every characteristic counts separately"}
          </dd>
          <dt>Coverage rule</dt>
          <dd>{f.minCoverage === 1 ? "every chosen characteristic" : `at least ${f.minCoverage * 100}% of them`}</dd>
          <dt>Left out</dt>
          <dd>{excluded.length ? `${excluded.length} states (listed below)` : "none"}</dd>
          {crit && control && (
            <>
              <dt>Liquor control</dt>
              <dd>
                {crit.id === "same_as_target" ? `same arrangement as ${name(f.target)}` : crit.label.toLowerCase()} (
                {f.controlMode === "mark" ? "marked only" : f.controlMode === "exclude" ? "verified differences left out" : "verified matches only"}).{" "}
                {name(f.target)}:
                <ControlDims a={control.get(f.target)!} />
              </dd>
            </>
          )}
          <dt>Dataset</dt>
          <dd className="small">
            {man.dataset.release_label}; method {FINDER_METHOD}
          </dd>
        </dl>
        {unusable.length > 0 && (
          <p className="warn small">
            Not used: {unusable.map((x) => `${x.c.label} (${x.scale.why})`).join("; ")}.
          </p>
        )}
        {outliers.length > 0 && (
          <p className="warn small">
            {outliers.map((o) => `No candidate is within 1 SD of ${name(f.target)} on ${o.label.toLowerCase()} (closest: ${name(o.geo)}, ${o.d.toFixed(2)} SD).`).join(" ")}{" "}
            Comparisons on {outliers.length > 1 ? "these measures" : "this measure"} are weak whichever state is chosen.
          </p>
        )}
        {warnings.map((w) => (
          <p key={w.id} className="warn small" role="note">
            {w.text}
          </p>
        ))}
        <div className="note small">
          These are candidates: states that looked similar on the chosen measures in {f.from}–{f.to}. They are not validated controls. Similar
          states still differ in law, prices, tourism and many things not measured here, and their own laws may change later.
        </div>
      </section>

      <section className="panel" aria-labelledby="fr-c">
        <h3 id="fr-c">Ranking ({eligible.length} candidates scored)</h3>
        <p className="small muted">
          Score 0 means identical on every chosen characteristic. Each cell shows the state's baseline value and, in brackets, how far it is from{" "}
          {name(f.target)} in standard deviations. Tick states to use them in an analysis (up to five).
        </p>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th scope="col" className="no-print">
                  Use
                </th>
                <th scope="col">Rank</th>
                <th scope="col">State</th>
                <th scope="col">Score</th>
                {used.map((x) => (
                  <th scope="col" key={x.c.id} className="num">
                    {x.c.label}
                  </th>
                ))}
                <th scope="col">{policyLabel} in the baseline</th>
                {control && <th scope="col">Liquor control, {f.from}–{f.to}</th>}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="no-print" />
                <td />
                <th scope="row">{name(f.target)} (target)</th>
                <td>—</td>
                {used.map((x) => (
                  <td key={x.c.id} className="num">
                    {fmt(x, x.values.get(f.target)!.value)}
                  </td>
                ))}
                <td className="small">{targetNote.status}</td>
                {control && <td className="small">reference</td>}
              </tr>
              {shown.map((r, i) => {
                const n = notes.get(r.item)!;
                return (
                  <tr key={r.item}>
                    <td className="no-print">
                      <input type="checkbox" aria-label={`Use ${name(r.item)}`} checked={checked.includes(r.item)} onChange={() => toggle(r.item)} />
                    </td>
                    <td className="num">{i + 1}</td>
                    <th scope="row">
                      {name(r.item)}
                      {r.missing > 0 && <div className="small warn-inline">missing {r.missing}</div>}
                    </th>
                    <td>
                      <div className="bar-cell">
                        <span className="bar" style={{ width: `${Math.max(2, 60 * ((r.score ?? 0) / maxScore))}px` }} aria-hidden="true" />
                        {r.score === null ? "—" : r.score.toFixed(2)}
                      </div>
                    </td>
                    {used.map((x) => {
                      const v = x.values.get(r.item)!;
                      const d = diffOf(x, r.item);
                      return (
                        <td key={x.c.id} className="num" title={v.why ?? undefined}>
                          {v.value === null ? <span className="muted">missing</span> : fmt(x, v.value)}
                          {d !== null && <div className="small muted">({x.c.kind === "binary" ? (d ? "differs" : "same") : `${d.toFixed(2)} SD`})</div>}
                        </td>
                      );
                    })}
                    <td className="small">
                      {n.status}
                      {n.changes.length > 0 && <div className="warn-inline">changes: {n.changes.map((c) => c.day).join(", ")}</div>}
                    </td>
                    {control && (
                      <td className="small">
                        <ControlBadge a={control.get(r.item)} />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {eligible.length > 12 && (
          <button type="button" className="link small" onClick={() => setShowAll(!showAll)}>
            {showAll ? "Show the first 12" : `Show all ${eligible.length}`}
          </button>
        )}
        {!eligible.length && (
          <p className="warn small" role="status">
            No candidate could be scored.
            {unassessable.length > 0 &&
              ` ${unassessable.length} states were held back because their liquor-control history for ${f.from}–${f.to} is not verified (listed below). To rank them anyway and see each one's status, choose "Mark each candidate" under 4.`}
          </p>
        )}
        {pick.length > 0 && (
          <div className="row-actions no-print">
            <button type="button" className="primary" onClick={useInChange}>
              {returnTo ? "Add" : "Use"} {checked.length ? `the ${checked.length} ticked` : `the top ${pick.length}`} in a before-and-after comparison
            </button>
            <Go
              to={{
                v: "explore",
                g: [f.target, ...pick].slice(0, 6).join(","),
                m: used.slice(0, 4).map((x) => x.c.metric).join(","),
                y0: Math.max(1990, f.from - 5),
                y1: Number(pol.as_of_date.slice(0, 4)),
                pd: f.policy,
              }}
              reset
            >
              Open {checked.length ? "the ticked states" : `the top ${pick.length}`} in Explore
            </Go>
            <Go to={{ v: "compare", st: [f.target, ...pick].slice(0, 6).join(","), y: f.to }} reset>
              …or side by side in Compare
            </Go>
          </div>
        )}
      </section>

      <section className="panel" aria-labelledby="fr-why">
        <h3 id="fr-why">Why each candidate ranks where it does</h3>
        <ul className="small source-list">
          {shown.slice(0, 8).map((r) => {
            const n = notes.get(r.item)!;
            const parts = used.map((x) => ({ x, d: diffOf(x, r.item) }));
            const word = (p: (typeof parts)[number]) => similarityWord(p.d, p.x.c.kind);
            const sim = parts.filter((p) => word(p) === "similar").map((p) => p.x.c.label.toLowerCase());
            const mid = parts.filter((p) => word(p) === "in between").map((p) => p.x.c.label.toLowerCase());
            const diff = parts.filter((p) => word(p) === "different");
            const miss = parts.filter((p) => p.d === null).map((p) => `${p.x.c.label.toLowerCase()} (${p.x.values.get(r.item)!.why ?? "no value"})`);
            return (
              <li key={r.item}>
                <strong>{name(r.item)}</strong>: similar (under 0.5 SD) on {sim.join(", ") || "none of them"}
                {mid.length > 0 && `; somewhat different (0.5 to 1 SD) on ${mid.join(", ")}`}
                {diff.length > 0 &&
                  `; different (over 1 SD) on ${diff.map((p) => `${p.x.c.label.toLowerCase()} (${fmt(p.x, p.x.values.get(r.item)!.value)} vs ${fmt(p.x, p.x.values.get(f.target)!.value)})`).join(", ")}`}
                {miss.length > 0 && `; missing ${miss.join(", ")}`}. {policyLabel}: {n.status}.
                {control?.get(r.item) && ` Liquor control: ${verdictText(control.get(r.item)!)}.`}
                {n.snapshot && (
                  <>
                    {" "}
                    Now: <RecordLink rec={`snapshot:${n.snapshotId}`}>{n.snapshot}</RecordLink>.
                  </>
                )}
                {n.changes.length > 0 && (
                  <>
                    {" "}
                    Coded changes {f.from}–{f.checkTo}:{" "}
                    {n.changes.map((c, j) => (
                      <span key={c.day + j}>
                        {j > 0 && "; "}
                        {c.policyId ? <RecordLink rec={`policy:${c.policyId}`}>{`${c.day}: ${c.text}`}</RecordLink> : `${c.day}: ${c.text}`}
                      </span>
                    ))}
                    .
                  </>
                )}
              </li>
            );
          })}
        </ul>
        {notScored.length > 0 && (
          <p className="small">
            <strong>Not scored (below the minimum coverage):</strong> {notScored.map((r) => `${name(r.item)} (${Math.round(r.coverage * 100)}% of characteristics)`).join(", ")}.
          </p>
        )}
        {excluded.length > 0 && (
          <p className="small">
            <strong>Left out by the policy exclusions:</strong> {excluded.map((e) => `${name(e.geo)} (${e.why})`).join("; ")}.
          </p>
        )}
        {unassessable.length > 0 && (
          <div className="small">
            <strong>Not ranked: liquor control cannot be assessed for {f.from}–{f.to}</strong> ({unassessable.length} states). Neither eligible nor
            ruled out; verified history would decide.
            <ul className="source-list">
              {[
                ...unassessable
                  .reduce((m, g) => m.set(verdictText(control!.get(g)!), [...(m.get(verdictText(control!.get(g)!)) ?? []), g]), new Map<string, string[]>())
                  .entries(),
              ].map(([why, gs]) => (
                <li key={why}>
                  {why}: {gs.map(name).join(", ")}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="panel" aria-labelledby="fr-cov">
        <h3 id="fr-cov">The characteristics behind the scores</h3>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th scope="col">Characteristic</th>
                <th scope="col" className="num">
                  {name(f.target)}
                </th>
                <th scope="col" className="num">
                  States with values
                </th>
                <th scope="col" className="num">
                  Average across states
                </th>
                <th scope="col" className="num">
                  1 SD
                </th>
                <th scope="col">Years and definition</th>
              </tr>
            </thead>
            <tbody>
              {chosen.map((x) => {
                const tv = x.values.get(f.target)!;
                const back = (v: number | null) => (v === null ? null : x.c.scale === "log10" ? 10 ** v : v);
                return (
                  <tr key={x.c.id}>
                    <th scope="row">
                      {x.c.label}
                      <div className="small muted">{x.c.help}</div>
                    </th>
                    <td className="num">
                      {fmt(x, tv.value)}
                      {tv.why && <div className="small muted">{tv.why}</div>}
                    </td>
                    <td className="num">{x.scale.n}</td>
                    <td className="num">{x.c.kind === "binary" ? "—" : fmt(x, back(x.scale.mean))}</td>
                    <td className="num">{x.c.kind === "binary" ? "yes/no" : x.scale.sd === null ? "—" : x.c.trend ? `${(100 * x.scale.sd).toFixed(2)} points a year` : x.c.scale === "log10" ? `×${(10 ** x.scale.sd).toFixed(2)}` : precise(x.scale.sd, x.meta?.unit ?? "")}</td>
                    <td className="small">
                      {x.scale.usable ? `${f.from}–${f.to}, averaged; ${x.group ? `comparability group ${x.group}` : ""}` : `Not used: ${x.scale.why}`}
                      {x.meta && (
                        <>
                          {" "}
                          · data {x.meta.first_year}–{x.meta.last_year}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="small muted">For population, the average and SD are on a log scale: the average shown is the geometric mean, and 1 SD is a multiplicative factor.</p>
      </section>

      <section className="panel" aria-labelledby="fr-lim">
        <h2 id="fr-lim">Method and limitations ({FINDER_METHOD})</h2>
        <ul className="small source-list">
          <li>Baseline value: the average of a state's values in {f.from}–{f.to}, within one definition (comparability group). A state needs values in at least half of those years; otherwise it is missing.</li>
          <li>Scale: each characteristic is converted to standard deviations across every state with a value (population on a log scale). Difference = the gap between a candidate and {name(f.target)} in those units; for a yes/no characteristic, 0 if the same and 1 if not.</li>
          <li>
            Score: square root of the weighted squared distance divided by the total weight, over the characteristics a candidate has.{" "}
            {res.decorrelation
              ? `The distance is Mahalanobis: differences are decorrelated using the correlations between the numeric characteristics across states (shrunk ${Math.round(res.decorrelation.lambda * 100)}% toward independence, the Schaefer-Strimmer weight, never below 5%), so characteristics that move together are not counted twice. Yes/no characteristics are added outside the decorrelation. With uncorrelated characteristics this is the plain weighted root-mean-square difference.`
              : "The plain distance counts each characteristic separately, so characteristics that move together (all alcohol and wine consumption, income and spending) count more than once."}{" "}
            Candidates are ranked first by how many characteristics they lack, then by score, so missing data never makes a state look closer.
          </li>
          <li>Trend characteristics are the slope of the log of a state's yearly values over the baseline years, shown as a percent change per year. They need at least three baseline years, so states can be matched on where they were heading, not only where they stood. A slope from a few years is noisy, and the score treats it as exact.</li>
          <li>The cautions above compare the best match with how close states usually are to their own nearest neighbour (the 90th percentile), with an average difference of 1 SD, and with the spread of the states on each characteristic (2 SD).</li>
          <li>Only baseline values are used. No outcome after a change enters the ranking.</li>
          <li>Similar here means similar on these numbers. A lower score, under either distance, means closer on the chosen characteristics and nothing more. It does not make a state a valid control: unmeasured differences, later law changes and data problems remain. Use the candidates as a starting point and check the policy column.</li>
          <li>{policyLabel} status is verified for few states. For most, the baseline status is unknown; a current-law snapshot describes one recent day only.</li>
          {f.target === "state:49" && <li>Utah's alcohol money arrives mainly as state-store profit, not as Census T10 taxes, so tax-based characteristics put Utah far from most states for that reason alone.</li>}
          <li>Policy records are machine-assisted and not reviewed by a person.</li>
        </ul>
        <details className="small">
          <summary>Sources for {name(f.target)}'s baseline values</summary>
          {[...new Set(used.flatMap((x) => x.values.get(f.target)!.rows.map((r) => r.obs.asset_id)))].sort().map((a) => (
            <div key={a} style={{ marginBottom: 8 }}>
              <SourceRef assetId={a} />
            </div>
          ))}
        </details>
      </section>

      <SaveBar
        view="finder"
        method={FINDER_METHOD}
        manifest={man}
        defaultName={`Comparisons for ${name(f.target)}, ${f.from}-${f.to}`}
        inputs={{
          ...finderPatch(f, returnTo),
          pd: f.policy,
          w: used.map((x) => `${x.c.id}:${weight(x.c.id)}`).join(","),
          mc: Math.round(f.minCoverage * 100),
        }}
        csv={{ name: `comparison_candidates_${f.target.replace(":", "")}_${f.from}_${f.to}.csv`, make: csv }}
        results={() => ({
          kind: "observations",
          question,
          candidates: eligible.map((r) => ({ geo: r.item, score: r.score, coverage: r.coverage })),
          excluded,
        })}
      />
      {checked.length > 0 && <p className="small muted no-print">Ticked: {checked.map(name).join(", ")}</p>}
    </>
  );
}
