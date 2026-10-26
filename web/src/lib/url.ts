// Filter state lives in the URL query string, so links reproduce a view and Back/Forward restore it.
// Every value read from the URL is validated; anything unknown falls back to a documented default.
import { useSyncExternalStore } from "react";

export const VIEWS = [
  "start",
  "initiative",
  "utah",
  "change",
  "finder",
  "scenario",
  "map",
  "beverages",
  "fiscal",
  "coverage",
  "explore",
  "timeline",
  "matrix",
  "compare",
  "revenue",
  "sources",
  "officials",
  "case",
  "methods",
  "downloads",
] as const;
export type View = (typeof VIEWS)[number];

const listeners = new Set<() => void>();
let current = typeof window === "undefined" ? "" : window.location.search;

function notify() {
  current = window.location.search;
  for (const l of listeners) l();
}

if (typeof window !== "undefined") window.addEventListener("popstate", notify);

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export type Patch = Record<string, string | number | null | undefined>;

/** Apply a patch to a query string: null/undefined/"" removes a key. Keys are kept in sorted order. */
export function applyPatch(search: string, patch: Patch, reset = false): string {
  const p = new URLSearchParams(reset ? "" : search);
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === undefined || v === "") p.delete(k);
    else p.set(k, String(v));
  }
  const sorted = new URLSearchParams([...p.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  const s = sorted.toString();
  return s ? `?${s}` : "";
}

export function navigate(patch: Patch, opts: { replace?: boolean; reset?: boolean } = {}) {
  const next = applyPatch(window.location.search, patch, opts.reset);
  if (next === window.location.search) return;
  const url = window.location.pathname + next + window.location.hash;
  if (opts.replace) window.history.replaceState(null, "", url);
  else window.history.pushState(null, "", url);
  notify();
}

/** The current query parameters; re-renders on navigation and on Back/Forward. */
export function useParams(): URLSearchParams {
  const s = useSyncExternalStore(subscribe, () => current, () => "");
  return new URLSearchParams(s);
}

export function hrefFor(patch: Patch, reset = true): string {
  return applyPatch(typeof window === "undefined" ? "" : window.location.search, patch, reset) || "?";
}

// ----- validation -------------------------------------------------------------------------------

export function pickOne<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

export function pickInt(value: string | null, min: number, max: number, fallback: number): number {
  if (value === null || !/^-?\d+$/.test(value)) return fallback;
  const n = Number(value);
  return n >= min && n <= max ? n : fallback;
}

/** Comma-separated list restricted to allowed values, de-duplicated, at most `max` items. */
export function pickList(value: string | null, allowed: readonly string[], max: number, fallback: string[]): string[] {
  if (value === null) return fallback;
  const set = new Set(allowed);
  const out: string[] = [];
  for (const v of value.split(",")) {
    if (set.has(v) && !out.includes(v)) out.push(v);
    if (out.length >= max) break;
  }
  return out.length ? out : fallback;
}

/** A year range, swapped into order and clamped to [min, max]. */
export function pickRange(
  from: string | null,
  to: string | null,
  min: number,
  max: number,
  fallback: [number, number],
): [number, number] {
  let a = pickInt(from, min, max, fallback[0]);
  let b = pickInt(to, min, max, fallback[1]);
  if (a > b) [a, b] = [b, a];
  return [a, b];
}
