// Export of the Tennessee 2016 grocery-wine comparison for the graph package (Node only; not part of the dashboard
// bundle). Every number comes from the dashboard's own engine (lib/caseResults.ts: before-after@1.2 and
// comparison-finder@1.1) on the exported dataset in web/public/data; this file only writes the results out.
//
// Run from web/:  npm run export:tennessee [-- <extra output folder>]
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { TN_2016_RESULTS, computeCaseResults, metricsNeeded, summarize } from "../lib/caseResults";
import { decodeMetric } from "../lib/decode";
import { buildSeries } from "../lib/series";
import type { MetricFile, MetricsIndex } from "../lib/types";
import { csvText, writeAll, type Cell } from "./csv";

const WEB = resolve(__dirname, "..", "..", "..", "..", "web");
const ROOT = resolve(WEB, "..");
const D = join(WEB, "public", "data");
const OUT = [join(ROOT, "data", "processed", "tennessee-2016"), ...process.argv.slice(2).map((p) => resolve(p))];
const read = <T>(f: string): T => JSON.parse(readFileSync(join(D, f), "utf8")) as T;

const idx = read<MetricsIndex>("metrics.json");
const geos = read<{ geo_id: string; name: string; geo_level: string }[]>("geographies.json");
const manifest = read<{ dataset?: { release_label?: string }; export?: { build_id?: string; exported_from_commit?: string } }>("manifest.json");
const name = (g: string) => geos.find((x) => x.geo_id === g)?.name ?? g;
const files = new Map<string, MetricFile>();
for (const id of metricsNeeded(TN_2016_RESULTS)) {
  const meta = idx.metrics.find((m) => m.metric_id === id);
  if (meta) files.set(id, read<MetricFile>(meta.file));
}
const states = geos.filter((g) => g.geo_level === "state").map((g) => g.geo_id);
const res = computeCaseResults(TN_2016_RESULTS, { idx, files, states, name });
const S = TN_2016_RESULTS;

// Raw series as each outcome is shown, Tennessee and its eight neighbours.
const raw: Cell[][] = [["outcome_id", "outcome", "metric_id", "shown_as", "unit", "period_kind", "geo_id", "state", "year", "value"]];
const extra = [{ id: "R2b", label: "Tennessee account 11002 'Wine Tax & High Alcohol Beer' (constant 2024 $)", metric: "tn_dor_account_11002_with_high_alcohol_beer@state_fiscal_year", shown: "real_cy2024", treatedOnly: true }];
const outs = [...S.outcomes.map((o) => ({ id: o.id, label: o.label, metric: o.metric, shown: o.shown, treatedOnly: !!o.treatedOnly })), ...extra];
for (const o of outs) {
  const meta = idx.metrics.find((m) => m.metric_id === o.metric);
  if (!meta) continue;
  const file = files.get(o.metric) ?? read<MetricFile>(meta.file);
  const dm = decodeMetric(file);
  for (const g of o.treatedOnly ? [S.target] : [S.target, ...S.borders]) {
    const b = buildSeries(meta, dm, g, o.shown as never, idx);
    for (const p of b.points) if (p.value !== null && p.year >= 2000) raw.push([o.id, o.label, o.metric, o.shown, b.unit, meta.period_kind, g, name(g), p.year, p.value]);
  }
}
// Main and sensitivity results.
const sum: Cell[][] = [["specification", "specification_label", "pool", "outcome_id", "outcome", "before_years", "after_years", "tn_before", "tn_after", "tn_change", "tn_pct_change", "tn_log_points", "pool_avg_change", "diff_change", "diff_log_points", "leave_one_out_low_log_points", "leave_one_out_high_log_points", "neighbours_change_min", "neighbours_change_max", "tn_change_within_neighbours_range", "placebo_dates", "placebo_typical_gap", "placebo_share_as_large", "note"]];
const add = (spec: string, label: string, r: (typeof res.main)[number]) => {
  const s = summarize(r);
  const p = r.placebo?.pooled ?? null;
  sum.push([spec, label, r.pool ?? "Tennessee only", r.outcome.id, r.label, s.beforeYears.join(" "), s.afterYears.join(" "), s.tnBefore, s.tnAfter, s.tnChange, s.tnPct, s.tnLog, s.poolChange, s.diffChange, s.diffLog, s.looLogRange?.[0], s.looLogRange?.[1], s.spread?.min, s.spread?.max, s.spread?.targetInside, p?.n, p?.typical, p?.share, s.why ?? r.unavailable ?? ""]);
};
for (const r of res.main) add("main", "Main: eight bordering states, 2011-2015 vs 2017-2019", r);
for (const v of res.sensitivity) for (const r of v.runs) add(v.variant.id, v.variant.label, r);
// Each state, with its before-period trend.
const st: Cell[][] = [["outcome_id", "outcome", "geo_id", "state", "before_mean", "after_mean", "change", "pct_change", "log_points", "pre_trend_slope_per_year", "pre_trend_slope_se", "tn_minus_state", "tn_minus_state_log_points", "if_trends_had_continued_difference", "if_trends_had_continued_se"]];
for (const r of res.main) {
  if (!r.result) continue;
  const dm = new Map(r.result.diffs.map((d) => [d.geo, d]));
  for (const s of r.result.states) {
    const d = dm.get(s.geo);
    st.push([r.outcome.id, r.label, s.geo, name(s.geo), s.beforeMean, s.afterMean, s.change, s.pctChange, s.logChange === null ? null : 100 * s.logChange, s.slope, s.slopeSE, d?.diffChange, d?.diffLog == null ? null : 100 * d.diffLog, d?.trendOnly, d?.trendOnlySE]);
  }
}
const pl: Cell[][] = [["outcome_id", "outcome", "kind", "date", "pooled_difference_in_changes"]];
for (const r of res.main) {
  if (!r.placebo) continue;
  pl.push([r.outcome.id, r.label, "actual", S.date, r.placebo.pooled?.actual]);
  for (const x of r.placebo.runs) pl.push([r.outcome.id, r.label, "placebo", x.date, x.pooled]);
}
writeAll(OUT, {
  "tennessee_raw_series.csv": csvText(raw),
  "tennessee_results_main_and_sensitivity.csv": csvText(sum),
  "tennessee_main_by_state.csv": csvText(st),
  "tennessee_placebo_dates.csv": csvText(pl),
  "tennessee_finder_ranking.csv": csvText([["geo_id", "state", "score", "eligible", "in_pool_P4"], ...res.finder.ranked.map((x) => [x.geo, name(x.geo), x.score, x.eligible, res.pools.P4.includes(x.geo)])]),
  "tennessee_provenance.json": JSON.stringify({ generated_at: new Date().toISOString(), dataset: manifest.dataset?.release_label ?? null, build: manifest.export?.build_id ?? null, exported_from_commit: manifest.export?.exported_from_commit ?? null, methods: [res.method, "before-after@1.2", "comparison-finder@1.1"], specification: "docs/analyses/tn-2016-grocery-wine/specification.md (commit fee519d)", descriptive_only: true }, null, 1),
});
console.log(`tennessee export: ${raw.length - 1} raw points, ${sum.length - 1} result rows, written to ${OUT.join(" and ")}`);
