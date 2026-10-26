// CSV downloads.
//
// Safe-export convention (also stated in the bundle README):
// * RFC 4180 quoting: a field is quoted when it contains a comma, quote, CR or LF, or has leading or
//   trailing spaces; quotes inside are doubled. Lines end with CRLF. UTF-8 without a byte-order mark.
// * Text columns only: a value that starts with = + - @ TAB or CR is prefixed with an apostrophe (')
//   so spreadsheet programs do not run it as a formula. The apostrophe is visible in a text editor.
// * Number columns are written as plain JavaScript numbers (full precision, no thousands separators)
//   and are never prefixed, so -5 stays -5. A missing value is an empty field; a zero is 0.
// * Dates are ISO 8601 (YYYY-MM-DD). Booleans are true/false.
import { strToU8, zipSync } from "fflate";

export type ColumnKind = "text" | "number" | "date" | "bool" | "list";

export interface Column<T> {
  key: string;
  kind: ColumnKind;
  get: (row: T) => unknown;
}

const FORMULA_START = /^[=+\-@\t\r]/;

export function neutralize(text: string): string {
  return FORMULA_START.test(text) ? `'${text}` : text;
}

export function quote(field: string): string {
  return /[",\r\n]/.test(field) || /^\s|\s$/.test(field) ? `"${field.replaceAll('"', '""')}"` : field;
}

export function cell(value: unknown, kind: ColumnKind): string {
  if (value === null || value === undefined) return "";
  switch (kind) {
    case "number":
      return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
    case "bool":
      return value ? "true" : "false";
    case "date":
      return quote(String(value));
    case "list":
      return quote(neutralize((value as unknown[]).join("|")));
    default:
      return quote(neutralize(String(value)));
  }
}

export function toCsv<T>(columns: Column<T>[], rows: T[]): string {
  const lines = [columns.map((c) => quote(c.key)).join(",")];
  for (const r of rows) lines.push(columns.map((c) => cell(c.get(r), c.kind)).join(","));
  return lines.join("\r\n") + "\r\n";
}

export function zip(files: { name: string; text: string }[]): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const f of files) entries[f.name] = strToU8(f.text);
  // A fixed timestamp keeps the archive bytes identical for identical content.
  return zipSync(entries, { level: 6, mtime: new Date("2000-01-01T00:00:00Z") });
}

export function saveFile(name: string, data: string | Uint8Array, type: string) {
  const part: BlobPart = typeof data === "string" ? data : new Uint8Array(data);
  const url = URL.createObjectURL(new Blob([part], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
