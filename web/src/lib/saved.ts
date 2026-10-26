// Saved analyses for every tool. A saved analysis is the tool's address (its inputs, all in the query
// string) plus the dataset build and calculation-method version it was made with, so it can be restored
// exactly and a later build can say that its numbers may differ. Files can also carry a snapshot of the
// results, kept apart from the inputs.
import { analysisPatch, isAnalysisShape, readStored } from "./analysis";
import { applyPatch } from "./url";

export const SAVED_FORMAT = "alcohol-dashboard-saved@2";
const STORE_KEY = "alcohol-dashboard.saved.v2";

export interface SavedRecord {
  format: typeof SAVED_FORMAT;
  name: string;
  saved_at: string;
  /** The tool (view) the inputs belong to. */
  view: string;
  /** The tool's query string, without "?". */
  params: string;
  build_id: string;
  release: string;
  /** Calculation-method version, when the tool computes something beyond the published values. */
  method: string | null;
  /** Files only: what the tool showed when saved. Observations and scenario assumptions are kept apart. */
  results?: unknown;
}

function isRecord(v: unknown): v is SavedRecord {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    r.format === SAVED_FORMAT &&
    typeof r.name === "string" &&
    typeof r.saved_at === "string" &&
    typeof r.view === "string" &&
    typeof r.params === "string" &&
    typeof r.build_id === "string" &&
    typeof r.release === "string" &&
    (r.method === null || typeof r.method === "string")
  );
}

/** Strip the keys that only describe a saved copy, so they never pile up. */
export function cleanParams(search: string): string {
  const p = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  for (const k of ["sb", "sm", "rec", "a"]) p.delete(k);
  return p.toString();
}

/** The address that restores a record, carrying the build and method it was saved with. */
export function restoreSearch(r: Pick<SavedRecord, "params" | "build_id" | "method">): string {
  const p = new URLSearchParams(r.params);
  if (r.build_id) p.set("sb", r.build_id);
  if (r.method) p.set("sm", r.method);
  return `?${p.toString()}`;
}

/** All analyses saved in this browser, including Explore selections saved before format 2. */
export function readSaved(storage: Pick<Storage, "getItem"> | null): SavedRecord[] {
  let out: SavedRecord[] = [];
  try {
    const raw = storage?.getItem(STORE_KEY);
    const v: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(v)) out = v.filter(isRecord);
  } catch {
    out = [];
  }
  const legacy = readStored(storage).map(
    (e): SavedRecord => ({
      format: SAVED_FORMAT,
      name: e.name,
      saved_at: e.saved_at,
      view: "explore",
      params: applyPatch("", analysisPatch(e.analysis)).slice(1),
      build_id: "",
      release: "",
      method: null,
    }),
  );
  return [...out, ...legacy.filter((l) => !out.some((o) => o.name === l.name && o.view === "explore"))];
}

export function writeSaved(storage: Pick<Storage, "setItem"> | null, records: SavedRecord[]): boolean {
  try {
    if (!storage) return false;
    storage.setItem(STORE_KEY, JSON.stringify(records.map(({ results: _r, ...rest }) => rest)));
    return true;
  } catch {
    return false;
  }
}

export function recordFile(r: SavedRecord): string {
  return JSON.stringify(r, null, 1) + "\n";
}

/** Read a saved-analysis file (format 2, or an Explore file from format 1). Unknown tools are refused. */
export function parseRecordFile(text: string, views: readonly string[]): SavedRecord {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    throw new Error("The file is not JSON.");
  }
  if (isRecord(v)) {
    if (!views.includes(v.view)) throw new Error(`The file is for a tool this dashboard does not have (${v.view}).`);
    return v;
  }
  const f = v as Record<string, unknown> | null;
  if (f && f.format === "alcohol-dashboard-analysis@1" && isAnalysisShape(f.analysis)) {
    return {
      format: SAVED_FORMAT,
      name: typeof f.title === "string" ? f.title : "Explore selection",
      saved_at: "",
      view: "explore",
      params: applyPatch("", analysisPatch(f.analysis)).slice(1),
      build_id: "",
      release: typeof f.release === "string" ? f.release : "",
      method: null,
    };
  }
  throw new Error(`The file is not a saved analysis (format ${SAVED_FORMAT}).`);
}
