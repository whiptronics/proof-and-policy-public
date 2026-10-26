import type { Gap } from "./types";

export interface CellContext {
  family?: string;
  measureId?: string | null;
  geoId?: string;
  year?: number;
}

/** Does a research gap bear on this coverage cell (or family / metric when parts are omitted)? */
export function gapMatches(g: Gap, c: CellContext): boolean {
  if (g.status === "done") return false;
  if (c.family && g.families.length && !g.families.includes(c.family)) return false;
  if (c.family && !g.families.length) return false;
  if (c.measureId && g.affected_measures.length && !g.affected_measures.includes(c.measureId)) return false;
  if (c.geoId && g.affected_geos.length && !g.affected_geos.includes("multi") && !g.affected_geos.includes(c.geoId)) {
    return false;
  }
  if (c.year !== undefined) {
    if (g.year_from !== null && c.year < g.year_from) return false;
    if (g.year_to !== null && c.year > g.year_to) return false;
  }
  return true;
}

/** Research queue order: priority, then id. Done items are dropped. */
export function queue(gaps: Gap[], c: CellContext = {}): Gap[] {
  return gaps.filter((g) => gapMatches(g, c)).sort((a, b) => a.priority - b.priority || a.gap_id.localeCompare(b.gap_id));
}

/** Count codes in a coverage row string between two indexes (inclusive). */
export function countCodes(row: string | undefined, from: number, to: number): Record<string, number> {
  const out: Record<string, number> = {};
  if (!row) return out;
  for (let i = Math.max(0, from); i <= Math.min(row.length - 1, to); i++) out[row[i]] = (out[row[i]] ?? 0) + 1;
  return out;
}
