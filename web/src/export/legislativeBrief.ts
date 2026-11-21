// Writes the two-page legislative briefing (lib/legislativeBrief.ts) as HTML and prints it to PDF with headless Edge,
// locally and free. Run: npm run brief:legislative. EDGE_PATH overrides the browser.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { legislativeBriefHtml } from "../lib/legislativeBrief";

const ROOT = resolve(__dirname, "..", "..", "..", "..");
const DIR = join(ROOT, "docs", "briefings", "utah-grocery-wine");
const html = join(DIR, "legislative-briefing.html");
const pdf = join(DIR, "legislative-briefing.pdf");
const EDGE = process.env.EDGE_PATH ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

writeFileSync(html, legislativeBriefHtml());
console.log(`wrote ${html}`);
const profile = mkdtempSync(join(tmpdir(), "pp-brief-"));
try {
  execFileSync(EDGE, ["--headless", "--disable-gpu", "--no-first-run", `--user-data-dir=${profile}`, "--no-pdf-header-footer", `--print-to-pdf=${pdf}`, pathToFileURL(html).href], { stdio: "inherit" });
} finally {
  rmSync(profile, { recursive: true, force: true, maxRetries: 5 });
}
console.log(`wrote ${pdf}`);
