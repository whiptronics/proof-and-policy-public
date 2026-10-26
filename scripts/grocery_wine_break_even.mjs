// How much new wine buying each grocery-wine alternative needs before the state breaks even, run on the project's
// compiled engine (data/processed/export-build, written by `npm --prefix web run export:grocery-wine`); no formula is
// copied here. The engine's "easier access" mechanism adds new purchases equal to a share g of all DABS wine sales,
// bought at grocers; this finds the g at which the state's annual change is zero, at fixed volume and with the
// conditional price response. Writes data/processed/grocery-wine/break_even_new_sales.csv.
// Usage: node scripts/grocery_wine_break_even.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const lib = (m) => import(pathToFileURL(join(repo, "data", "processed", "export-build", "lib", m)).href);
const W = await lib("wineAlternatives.js");
const S = await lib("scenario.js");
const A = await lib("arrangements.js");

/** The state's annual change for one alternative with new purchases g (share of all DABS wine sales). */
function net(id, g, priceResponse) {
  const b = W.evaluateFixed(W.alternativeById(id)).built;
  const from = { ...b.base, extra: true, growth: g, extraGrocery: 1, recapture: null, elasticity: priceResponse ? W.ELASTICITY : null, demandForm: "constant" };
  const r = S.compute(A.withMechanisms(A.arrangementInputs(b.base, b.set, b.id), { access: g !== 0, price: priceResponse }, from));
  return r.netB ?? r.netA;
}

function breakEven(id, priceResponse) {
  const f = (g) => net(id, g, priceResponse);
  // The break-even alternatives sit at zero up to floating-point residue (about 1e-9 dollars): already even.
  if (f(0) >= -0.5) return 0;
  let lo = 0;
  let hi = 2;
  if (f(hi) < 0) return null;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) >= 0) hi = mid;
    else lo = mid;
  }
  return hi;
}

const report = W.alternativesReport();
const ids = report.results.map((a) => a.def.id);
const wine = W.evaluateFixed(W.alternativeById(ids[0])).built.base.wineSales;
// The engine's own exploratory access case must come out the same through this route, or the query is wrong.
for (const id of ids) {
  const own = report.results.find((a) => a.def.id === id).demand.find((d) => d.id === "access").net;
  const here = net(id, W.ACCESS_EXPLORATORY, false);
  if (Math.abs(own - here) > 0.01) throw new Error(`${id}: access case ${here} here, ${own} in the engine`);
}
const rows = [["alternative_id", "label", "volume_basis", "state_change_with_no_new_sales_usd", "break_even_new_sales_share_of_dabs_wine_sales", "break_even_new_sales_usd", "dabs_wine_sales_usd", "state_change_at_break_even_usd", "method"]];
for (const id of ids) {
  const label = W.alternativeById(id).label;
  for (const pr of [false, true]) {
    const g = breakEven(id, pr);
    rows.push([id, label, pr ? "price_response" : "fixed_volume", net(id, 0, pr), g ?? "", g === null ? "" : g * wine, wine, g === null ? "" : net(id, g, pr), "engine access mechanism, bisection; new purchases bought at grocers"]);
  }
}
const csv = rows.map((r) => r.map((v) => (typeof v === "string" && /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : String(v))).join(",")).join("\n") + "\n";
const out = join(repo, "data", "processed", "grocery-wine", "break_even_new_sales.csv");
writeFileSync(out, csv, "utf-8");
console.log(`break-even new sales: ${rows.length - 1} rows written to ${out}`);
