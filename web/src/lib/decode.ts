// Decoding a metric file's compact rows into objects: pure (no React, no fetch), so the graph exports in src/export
// can use it outside the browser. lib/data.ts re-exports it for the views.
import type { Alternate, Conversion, ConversionKind, MetricFile, Obs } from "./types";

export interface DecodedMetric {
  metric_id: string;
  obs: Obs[];
  byId: Map<string, Obs>;
  alternates: Map<string, Alternate[]>;
  conversions: Map<string, Map<ConversionKind, Conversion>>;
}

const decoded = new WeakMap<MetricFile, DecodedMetric>();

/** Turn the compact row arrays of a metric file into objects (memoised per file). */
export function decodeMetric(file: MetricFile): DecodedMetric {
  const hit = decoded.get(file);
  if (hit) return hit;
  const toObj = <T>(cols: string[], row: unknown[]) =>
    Object.fromEntries(cols.map((c, i) => [c, row[i] ?? null])) as T;
  const obs = file.rows.map((r) => toObj<Obs>(file.columns, r));
  for (const o of obs) o.input_ids = o.input_ids ?? [];
  const alternates = new Map<string, Alternate[]>();
  for (const [id, rows] of Object.entries(file.alternates)) {
    alternates.set(
      id,
      rows.map((r) => toObj<Alternate>(file.alternate_columns, r)),
    );
  }
  const conversions = new Map<string, Map<ConversionKind, Conversion>>();
  for (const [id, rows] of Object.entries(file.conversions)) {
    const m = new Map<ConversionKind, Conversion>();
    for (const r of rows) {
      const c = toObj<Conversion>(file.conversion_columns, r);
      c.inputs = c.inputs ?? [];
      m.set(c.kind, c);
    }
    conversions.set(id, m);
  }
  const out: DecodedMetric = {
    metric_id: file.metric_id,
    obs,
    byId: new Map(obs.map((o) => [o.observation_id, o])),
    alternates,
    conversions,
  };
  decoded.set(file, out);
  return out;
}
