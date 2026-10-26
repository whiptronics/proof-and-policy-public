// Loading the exported files. Each file is fetched once and cached; metric files load on demand.
import { useEffect, useState } from "react";

const BASE = `${import.meta.env.BASE_URL}data/`;
const cache = new Map<string, Promise<unknown>>();

export class MissingExportError extends Error {}

export function load<T>(path: string): Promise<T> {
  let p = cache.get(path);
  if (!p) {
    p = fetch(BASE + path).then(async (r) => {
      if (!r.ok) {
        throw new MissingExportError(
          `Could not load data/${path} (HTTP ${r.status}). Run \`alcohol-data dashboard export\` and reload.`,
        );
      }
      return r.json();
    });
    p.catch(() => cache.delete(path));
    cache.set(path, p);
  }
  return p as Promise<T>;
}

export interface Loaded<T> {
  data: T | undefined;
  error: Error | undefined;
  loading: boolean;
}

/** Load one exported file (or nothing when path is null). Data from a previous path is never returned
 * for a new one: the state remembers which path it belongs to. */
export function useData<T>(path: string | null): Loaded<T> {
  const [state, setState] = useState<{ key: string | null; data?: T; error?: Error }>({ key: null });
  useEffect(() => {
    if (path === null) return;
    let live = true;
    load<T>(path).then(
      (data) => live && setState({ key: path, data }),
      (error: Error) => live && setState({ key: path, error }),
    );
    return () => {
      live = false;
    };
  }, [path]);
  if (path === null) return { data: undefined, error: undefined, loading: false };
  const current = state.key === path;
  return { data: current ? state.data : undefined, error: current ? state.error : undefined, loading: !current };
}

/** Load several files at once; data is undefined until all of the current list have arrived. */
export function useMany<T>(paths: string[]): Loaded<T[]> {
  const key = paths.join("\n");
  const [state, setState] = useState<{ key: string | null; data?: T[]; error?: Error }>({ key: null });
  useEffect(() => {
    let live = true;
    const list = key ? key.split("\n") : [];
    Promise.all(list.map((p) => load<T>(p))).then(
      (data) => live && setState({ key, data }),
      (error: Error) => live && setState({ key, error }),
    );
    return () => {
      live = false;
    };
  }, [key]);
  const current = state.key === key;
  return { data: current ? state.data : undefined, error: current ? state.error : undefined, loading: !current };
}

export { decodeMetric, type DecodedMetric } from "./decode";

export function metricPath(file: string): string {
  return file;
}
