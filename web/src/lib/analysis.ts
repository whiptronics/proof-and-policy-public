// Explore selections and saved analyses. A selection (measures, jurisdictions, years, how values are shown
// and a policy shown underneath) lives in the URL; a saved analysis is a named selection. Three kinds reopen
// in Explore: worked-example panels (derived here from cases.json; the worked example draws its charts from
// the same derivation, so the two cannot disagree), starting points checked by the export (analyses.json),
// and selections saved in this browser or to a file.
//
// The policy helpers read verified day runs (policy_segments) only. A dated snapshot is reported on its own
// day or year and is never stretched over other days.
import type { Shown } from "./series";
import type { CaseMetric, CaseStudy, MetricMeta, PolicyEvent, SavedAnalysisConfig, Segment, Snapshot } from "./types";
import { pickInt, pickList, pickOne, pickRange, type Patch } from "./url";

export const SHOWN: readonly Shown[] = ["nominal", "real_cy2024", "per_resident", "per_resident_21plus", "index"];
export const MAX_METRICS = 4;
export const MAX_GEOS = 6;

export interface Analysis {
  metrics: string[];
  geos: string[];
  from: number;
  to: number;
  shown: Shown;
  /** Base year when values are shown as an index; null otherwise. */
  base: number | null;
  /** Policy dimension shown under the charts; null for none. */
  policy: string | null;
}

export interface Allowed {
  metrics: readonly string[];
  geos: readonly string[];
  policies: readonly string[];
  yearMin: number;
  yearMax: number;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);

/** The URL patch that opens an analysis in Explore; `id` names the saved analysis it came from. */
export function analysisPatch(a: Analysis, id: string | null = null): Patch {
  return {
    v: "explore",
    m: a.metrics.length ? a.metrics.join(",") : "none",
    g: a.geos.length ? a.geos.join(",") : "none",
    y0: a.from,
    y1: a.to,
    tf: a.shown === "nominal" ? null : a.shown,
    base: a.shown === "index" ? a.base : null,
    pd: a.policy ?? "none",
    a: id,
  };
}

/** Read the selection from the URL. Every value is checked against this release; anything unknown falls
 * back to the default ("none" clears a list or the policy). */
export function readAnalysis(params: URLSearchParams, allowed: Allowed, fallback: Analysis): Analysis {
  const list = (key: string, values: readonly string[], max: number, fb: string[]) =>
    params.get(key) === "none" ? [] : pickList(params.get(key), values, max, fb.filter((x) => values.includes(x)).slice(0, max));
  const metrics = list("m", allowed.metrics, MAX_METRICS, fallback.metrics);
  const geos = list("g", allowed.geos, MAX_GEOS, fallback.geos);
  const [from, to] = pickRange(params.get("y0"), params.get("y1"), allowed.yearMin, allowed.yearMax, [
    clamp(fallback.from, allowed.yearMin, allowed.yearMax),
    clamp(fallback.to, allowed.yearMin, allowed.yearMax),
  ]);
  const shown = pickOne(params.get("tf"), SHOWN, "nominal");
  const base = shown === "index" ? pickInt(params.get("base"), from, to, clamp(fallback.base ?? from, from, to)) : null;
  const pd = params.get("pd");
  const policy =
    pd === "none"
      ? null
      : pd !== null && allowed.policies.includes(pd)
        ? pd
        : fallback.policy !== null && allowed.policies.includes(fallback.policy)
          ? fallback.policy
          : null;
  return { metrics, geos, from, to, shown, base, policy };
}

export function sameAnalysis(a: Analysis, b: Analysis): boolean {
  return (
    a.metrics.join(",") === b.metrics.join(",") &&
    a.geos.join(",") === b.geos.join(",") &&
    a.from === b.from &&
    a.to === b.to &&
    a.shown === b.shown &&
    (a.shown === "index" ? a.base === b.base : true) &&
    a.policy === b.policy
  );
}

export function fromConfig(c: SavedAnalysisConfig): Analysis {
  return {
    metrics: c.metrics,
    geos: c.geos,
    from: c.years[0],
    to: c.years[1],
    shown: pickOne(c.shown, SHOWN, "nominal"),
    base: c.base_year,
    policy: c.policy_dimension,
  };
}

// ----- worked examples as saved analyses ------------------------------------------------------------

export interface CasePanelAnalysis {
  /** case:<case_id>:<panel index> */
  id: string;
  title: string;
  note: string;
  analysis: Analysis;
}

/** The policy dimension a worked example is about: the dimension of its reform intervals. */
export function caseDimension(c: CaseStudy, events: PolicyEvent[]): string | null {
  return events.find((e) => c.reform_policy_ids.includes(e.policy_id))?.policy_dimension ?? null;
}

/** One worked-example panel as a saved analysis. The worked example draws the panel from this spec (its
 * years are the chart's x axis and its jurisdictions the chart's lines), so Explore reopens exactly what the
 * example shows. Null when none of the panel's metrics is in this build. The export refuses a panel that
 * mixes conversions or exceeds the Explore limits. */
export function casePanelAnalysis(c: CaseStudy, index: number, metas: MetricMeta[], policy: string | null): CasePanelAnalysis | null {
  const p = c.panels[index];
  if (!p) return null;
  const pms = p.metrics
    .map((pm) => ({ pm, meta: metas.find((m) => m.metric_id === pm.metric_id) }))
    .filter((x): x is { pm: CaseMetric; meta: MetricMeta } => x.meta !== undefined);
  if (!pms.length) return null;
  const kind = pms[0].meta.period_kind;
  const ws = Object.values(c.windows).filter((w) => w.period_kind === kind);
  const lastYear = Math.max(...pms.map((x) => x.meta.last_year));
  const from = ws.length ? Math.min(...ws.map((w) => w.from)) - 1 : 2005;
  const to = ws.length ? Math.min(lastYear, Math.max(...ws.map((w) => w.to)) + 1) : lastYear;
  const geos = p.treated_only
    ? [c.treated_geo]
    : [c.treated_geo, ...c.comparison_geos.map((g) => g.geo_id), ...c.reference_geos.map((g) => g.geo_id)];
  return {
    id: `case:${c.case_id}:${index}`,
    title: p.title,
    note: p.note,
    analysis: { metrics: pms.map((x) => x.pm.metric_id), geos, from, to, shown: pms[0].pm.conversion ?? "nominal", base: null, policy },
  };
}

export function caseAnalyses(c: CaseStudy, metas: MetricMeta[], events: PolicyEvent[]): CasePanelAnalysis[] {
  const dim = caseDimension(c, events);
  return c.panels.map((_, i) => casePanelAnalysis(c, i, metas, dim)).filter((x): x is CasePanelAnalysis => x !== null);
}

// ----- policy status from verified day runs -----------------------------------------------------------

const DAY = 86400000;
const ms = (d: string) => Date.parse(`${d}T00:00:00Z`);
const isKnown = (state: string) => state !== "unknown" && state !== "disputed";
const idsOf = (s: Segment) => s.policy_ids.split("|").filter((x) => x && x !== "-");

function lane(segments: Segment[], geo: string, dim: string): Segment[] {
  return segments
    .filter((s) => s.geo_id === geo && s.policy_dimension === dim)
    .sort((a, b) => (a.segment_start < b.segment_start ? -1 : a.segment_start > b.segment_start ? 1 : 0));
}

export type YearKind = "known" | "partial" | "changed" | "unknown" | "not_coded" | "after_as_of";

export interface YearStatus {
  year: number;
  kind: YearKind;
  /** Verified values in date order (consecutive repeats merged). */
  values: string[];
  policyIds: string[];
  knownDays: number;
  /** Days of the calendar year up to the as-of date. */
  days: number;
}

/** Status by calendar year: how many days are verified and with which values. Days after the build's
 * as-of date are not counted; a year with no verified day is unknown, never filled from a neighbour. */
export function yearStatuses(segments: Segment[], geo: string, dim: string, from: number, to: number, asOf: string): YearStatus[] {
  const segs = lane(segments, geo, dim);
  const end = ms(asOf);
  const out: YearStatus[] = [];
  for (let y = from; y <= to; y++) {
    const a = ms(`${y}-01-01`);
    const b = Math.min(ms(`${y}-12-31`), end);
    if (b < a) {
      out.push({ year: y, kind: "after_as_of", values: [], policyIds: [], knownDays: 0, days: 0 });
      continue;
    }
    const days = (b - a) / DAY + 1;
    if (!segs.length) {
      out.push({ year: y, kind: "not_coded", values: [], policyIds: [], knownDays: 0, days });
      continue;
    }
    let knownDays = 0;
    const values: string[] = [];
    const policyIds: string[] = [];
    for (const s of segs) {
      const lo = Math.max(a, ms(s.segment_start));
      const hi = Math.min(b, ms(s.segment_end));
      if (hi < lo || !isKnown(s.state)) continue;
      knownDays += (hi - lo) / DAY + 1;
      if (values[values.length - 1] !== s.state) values.push(s.state);
      for (const id of idsOf(s)) if (!policyIds.includes(id)) policyIds.push(id);
    }
    const kind: YearKind = knownDays === 0 ? "unknown" : new Set(values).size > 1 ? "changed" : knownDays === days ? "known" : "partial";
    out.push({ year: y, kind, values, policyIds, knownDays, days });
  }
  return out;
}

export interface YearRun {
  from: number;
  to: number;
  status: YearStatus;
}

/** Merge consecutive years that read the same. Partial and changed years keep their own day counts, so
 * they merge only with years verified on the same number of days. */
export function yearRuns(statuses: YearStatus[]): YearRun[] {
  const sig = (s: YearStatus) =>
    `${s.kind}|${s.values.join(">")}|${s.kind === "partial" || s.kind === "changed" ? `${s.knownDays}/${s.days}` : ""}`;
  const runs: YearRun[] = [];
  for (const s of statuses) {
    const last = runs[runs.length - 1];
    if (last && sig(last.status) === sig(s) && last.to === s.year - 1) last.to = s.year;
    else runs.push({ from: s.year, to: s.year, status: s });
  }
  return runs;
}

export type DayStatus =
  | { kind: "known"; value: string; policyIds: string[]; segment: Segment }
  | { kind: "unknown"; why: string }
  | { kind: "not_coded" };

/** Verified status on one day. Snapshots are not consulted: a snapshot is not a verified day run. */
export function statusOnDay(segments: Segment[], geo: string, dim: string, day: string, asOf: string): DayStatus {
  const segs = lane(segments, geo, dim);
  if (!segs.length) return { kind: "not_coded" };
  if (day > asOf) return { kind: "unknown", why: "after the build's as-of date" };
  const s = segs.find((x) => x.segment_start <= day && day <= x.segment_end);
  if (!s) return { kind: "unknown", why: "outside the coded period" };
  if (s.state === "disputed") return { kind: "unknown", why: "sources disagree on this day" };
  if (!isKnown(s.state)) return { kind: "unknown", why: "no verified status on this day" };
  return { kind: "known", value: s.state, policyIds: idsOf(s), segment: s };
}

export interface StatusChange {
  day: string;
  from: string;
  to: string;
  policyIds: string[];
}

/** Days on which one verified status gives way to a different verified status the next day. The first
 * verified day after unknown days is not a change, and neither is a new legal basis for the same value. */
export function statusChanges(segments: Segment[], geo: string, dim: string): StatusChange[] {
  const segs = lane(segments, geo, dim);
  const out: StatusChange[] = [];
  for (let i = 1; i < segs.length; i++) {
    const p = segs[i - 1];
    const s = segs[i];
    if (isKnown(p.state) && isKnown(s.state) && p.state !== s.state && ms(s.segment_start) === ms(p.segment_end) + DAY) {
      out.push({ day: s.segment_start, from: p.state, to: s.state, policyIds: idsOf(s) });
    }
  }
  return out;
}

/** Sort key for snapshots: a dated snapshot sorts after a year-only one from the same year. */
export function snapshotKey(s: Snapshot): string {
  return s.observed_on ?? `${s.observed_year}-00-00`;
}

export function snapshotsFor(snapshots: Snapshot[], geo: string, dim: string): Snapshot[] {
  return snapshots
    .filter((s) => s.geo_id === geo && s.policy_dimension === dim)
    .sort((a, b) => (snapshotKey(a) < snapshotKey(b) ? -1 : snapshotKey(a) > snapshotKey(b) ? 1 : a.snapshot_id < b.snapshot_id ? -1 : 1));
}

/** Does verified history cover a snapshot's day, and if so does it agree? Year-only snapshots name no day. */
export function snapshotCheck(segments: Segment[], s: Snapshot, asOf: string): "agrees" | "differs" | "no_history" {
  if (!s.observed_on) return "no_history";
  const st = statusOnDay(segments, s.geo_id, s.policy_dimension, s.observed_on, asOf);
  if (st.kind !== "known") return "no_history";
  return st.value === s.policy_value ? "agrees" : "differs";
}

// ----- saving: this browser and files -------------------------------------------------------------------

export const FILE_FORMAT = "alcohol-dashboard-analysis@1";
const STORE_KEY = "alcohol-dashboard.saved-analyses.v1";

export interface SavedEntry {
  name: string;
  saved_at: string;
  analysis: Analysis;
}

export function isAnalysisShape(v: unknown): v is Analysis {
  if (typeof v !== "object" || v === null) return false;
  const a = v as Record<string, unknown>;
  const strings = (x: unknown) => Array.isArray(x) && x.every((s) => typeof s === "string");
  return (
    strings(a.metrics) &&
    strings(a.geos) &&
    Number.isInteger(a.from) &&
    Number.isInteger(a.to) &&
    typeof a.shown === "string" &&
    (a.base === null || Number.isInteger(a.base)) &&
    (a.policy === null || typeof a.policy === "string")
  );
}

/** Selections saved in this browser. Storage can be missing or blocked; then the list is empty. */
export function readStored(storage: Pick<Storage, "getItem"> | null): SavedEntry[] {
  try {
    const raw = storage?.getItem(STORE_KEY);
    if (!raw) return [];
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.filter(
      (e): e is SavedEntry =>
        typeof e === "object" && e !== null && typeof e.name === "string" && typeof e.saved_at === "string" && isAnalysisShape(e.analysis),
    );
  } catch {
    return [];
  }
}

export function writeStored(storage: Pick<Storage, "setItem"> | null, entries: SavedEntry[]): boolean {
  try {
    if (!storage) return false;
    storage.setItem(STORE_KEY, JSON.stringify(entries));
    return true;
  } catch {
    return false;
  }
}

export function browserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function analysisFile(a: Analysis, title: string, release: string, savedFrom: string | null): string {
  return JSON.stringify({ format: FILE_FORMAT, title, release, saved_from: savedFrom, analysis: a }, null, 1) + "\n";
}

/** Read an analysis file. Ids this release does not hold are dropped and named; years outside the
 * release's range are clamped and named. Anything malformed is refused with the reason. */
export function parseAnalysisFile(text: string, allowed: Allowed): { analysis: Analysis; title: string; dropped: string[] } {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    throw new Error("The file is not JSON.");
  }
  const f = v as Record<string, unknown> | null;
  if (typeof f !== "object" || f === null || f.format !== FILE_FORMAT) throw new Error(`The file is not a saved analysis (format ${FILE_FORMAT}).`);
  if (!isAnalysisShape(f.analysis)) throw new Error("The file's analysis is incomplete or malformed.");
  const a = f.analysis;
  if (!(SHOWN as readonly string[]).includes(a.shown)) throw new Error(`Unknown way of showing values: ${a.shown}.`);
  const dropped: string[] = [];
  const keep = (ids: string[], ok: readonly string[], max: number, what: string) => {
    const out: string[] = [];
    for (const id of ids) {
      if (!ok.includes(id)) dropped.push(`${what} ${id} (not in this release)`);
      else if (out.includes(id)) continue;
      else if (out.length >= max) dropped.push(`${what} ${id} (more than ${max})`);
      else out.push(id);
    }
    return out;
  };
  const metrics = keep(a.metrics, allowed.metrics, MAX_METRICS, "measure");
  const geos = keep(a.geos, allowed.geos, MAX_GEOS, "jurisdiction");
  let policy = a.policy;
  if (policy !== null && !allowed.policies.includes(policy)) {
    dropped.push(`policy ${policy} (not coded in this release)`);
    policy = null;
  }
  let [from, to] = a.from <= a.to ? [a.from, a.to] : [a.to, a.from];
  const [cf, ct] = [clamp(from, allowed.yearMin, allowed.yearMax), clamp(to, allowed.yearMin, allowed.yearMax)];
  if (cf !== from || ct !== to) dropped.push(`years ${from}-${to} narrowed to ${cf}-${ct}`);
  [from, to] = [cf, ct];
  const shown = a.shown as Shown;
  const base = shown === "index" ? clamp(a.base ?? from, from, to) : null;
  if (shown === "index" && a.base !== null && base !== a.base) dropped.push(`base year ${a.base} moved to ${base}`);
  const title = typeof f.title === "string" && f.title.trim() ? f.title.trim() : "Saved analysis";
  return { analysis: { metrics, geos, from, to, shown, base, policy }, title, dropped };
}
