// What a chart's tooltip says, and where it goes (components/ChartTip.tsx shows it). Pure, so the tests can run it.
import { minus } from "./format";

export type Cell = string | number | boolean | null | undefined;
/** What one mark shows: an optional heading, then "column: value" lines. */
export interface Tip {
  title?: string;
  rows: [string, string][];
  /** A closing line, such as what a click does. */
  note?: string;
}

/** A table cell's text: every "Show the numbers" table prints its cells with this. A negative number takes a minus sign
 * ("−1.1"), as everywhere in the prose; the CSV download keeps the number itself (export/csv.ts). */
export const cellText = (v: Cell) => (v === null || v === undefined ? "—" : typeof v === "number" ? minus(String(v)) : String(v));

/** A table row as a tooltip: each column, in the table's order, with the table's text. */
export const rowTip = (row: Record<string, Cell>, title?: string): Tip => ({ title, rows: Object.entries(row).map(([k, v]) => [k, cellText(v)]) });

/** The attribute a mark carries; spread it onto the <rect>, <path> or <g>. */
export const tipAttr = (tip: Tip) => ({ "data-tip": JSON.stringify(tip) });

/** One line of text per entry: the SVG download's <title> and the sweep's comparison with the table. */
export const tipText = (tip: Tip) => [...(tip.title ? [tip.title] : []), ...tip.rows.map(([k, v]) => `${k}: ${v}`), ...(tip.note ? [tip.note] : [])].join("\n");

export function readTip(el: Element): Tip | null {
  try {
    const t = JSON.parse(el.getAttribute("data-tip") ?? "null") as Tip | null;
    return t && Array.isArray(t.rows) ? t : null;
  } catch {
    return null;
  }
}

const GAP = 8; // between the mark and the tooltip
const EDGE = 8; // from the viewport's edges
const MIN_H = 72; // the shortest scrolling tooltip worth showing beside the mark rather than over it

/** Where the tooltip goes: above the mark, else below, else right, else left; the first that fits on screen. Too tall
 * for any of them (big text on a small screen), it takes the roomier of above and below and scrolls (`maxHeight`).
 * `sides: false` is for a plot's column, where the pointer can be anywhere across the plot: above or below only. */
export function placeTip(r: DOMRect, w: number, h: number, vw: number, vh: number, sides = true): { left: number; top: number; fits: boolean; maxHeight?: number } {
  const clampX = (x: number) => Math.max(EDGE, Math.min(x, vw - EDGE - w));
  const clampY = (y: number) => Math.max(EDGE, Math.min(y, vh - EDGE - h));
  const cx = clampX(r.left + r.width / 2 - w / 2);
  const cy = clampY(r.top + r.height / 2 - h / 2);
  const options = [
    { left: cx, top: r.top - GAP - h, fits: r.top - GAP - h >= EDGE && w <= vw - 2 * EDGE },
    { left: cx, top: r.bottom + GAP, fits: r.bottom + GAP + h <= vh - EDGE && w <= vw - 2 * EDGE },
    { left: r.right + GAP, top: cy, fits: sides && r.right + GAP + w <= vw - EDGE && h <= vh - 2 * EDGE },
    { left: r.left - GAP - w, top: cy, fits: sides && r.left - GAP - w >= EDGE && h <= vh - 2 * EDGE },
  ];
  const ok = options.find((o) => o.fits);
  if (ok) return ok;
  const above = r.top - GAP - EDGE;
  const below = vh - EDGE - r.bottom - GAP;
  if (w <= vw - 2 * EDGE && Math.max(above, below) >= MIN_H)
    return above > below ? { left: cx, top: EDGE, fits: true, maxHeight: above } : { left: cx, top: r.bottom + GAP, fits: true, maxHeight: below };
  // No room at all (the mark fills the screen): kept on screen, over the mark.
  return above > below ? { left: cx, top: clampY(r.top - GAP - h), fits: false } : { left: cx, top: clampY(r.bottom + GAP), fits: false };
}
