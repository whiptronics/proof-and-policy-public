// Small helpers shared by the graph exports (Node only; not part of the dashboard bundle).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type Cell = string | number | boolean | null | undefined;

export function csvText(rows: Cell[][]): string {
  const cell = (v: Cell) => {
    if (v === null || v === undefined) return "";
    if (typeof v === "number") return Number.isFinite(v) ? String(Number(v.toPrecision(12))) : "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(cell).join(",")).join("\n") + "\n";
}

/** Write the same files into every output folder. */
export function writeAll(dirs: string[], files: Record<string, string>): void {
  for (const d of dirs) {
    mkdirSync(d, { recursive: true });
    for (const [name, text] of Object.entries(files)) writeFileSync(join(d, name), text, "utf8");
  }
}
