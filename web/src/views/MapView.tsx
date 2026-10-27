// Nationwide map: pick a measure, year (or month), beverage where it applies and how values are shown;
// the map, the ranked bars, the table and the downloads all come from one list of rows. Clicking a state
// opens its values, trend, sources and limits, with links to add it to an analysis.
import { useMemo, useRef } from "react";
import { ErrorNote, Go, Loading, RecordLink, SourceNote, SourceRef } from "../components/common";
import { ControlBadge, ControlSelect, ControlSummary, assessAll } from "../components/ControlFilter";
import { criterionById, verdictSymbol, verdictText } from "../lib/control";
import { metricSourceIds, monthlySourceIds, sourceLine, sourcesById } from "../lib/sources";
import { MapLegend, USMap, fillFor } from "../components/USMap";
import { TrendChart } from "../components/TrendChart";
import { snapshotsFor, yearStatuses } from "../lib/analysis";
import { saveFile, toCsv, type Column } from "../lib/csv";
import { decodeMetric, useData, type DecodedMetric } from "../lib/data";
import { CONVERSION_LABELS, geoName, mapLabel, precise, unitLabel, words } from "../lib/format";
import { MAP_MEASURES, MAP_TOPICS, measureById, type MapMeasure } from "../lib/mapMeasures";
import { cellKind, changeBetween, domainOf, gradientStops, JUMP_PCT, largestJump, rankCells, type Jump, type MapCell, type RankedCell } from "../lib/mapdata";
import { RANKS_METHOD, rankRangeText } from "../lib/ranks";
import { buildSeries, type Shown } from "../lib/series";
import { intervalKind, intervalPhrase, seFromInterval } from "../lib/stats";
import type { Geography, Manifest, MapShapes, MetricFile, MetricMeta, MetricsIndex, MonthlyFile, MonthlyMeta, PolicyData, SourcesData } from "../lib/types";
import { navigate, pickOne, useParams } from "../lib/url";

type Row = { geo: string; period: string; se?: number | null; est?: string | null; value: number | null; missing: string | null; rec: string | null; group: string | null; asset: string | null; locator: string | null; start: string; end: string };

/** The comparison states of the Tennessee 2016 grocery-wine example (TN_EXAMPLE in ChangeView, kept out of
 * this chunk): Virginia, Georgia, Arkansas and Kentucky. */
const EXAMPLE_COMPARISONS = ["state:51", "state:13", "state:05", "state:21"];

const SHOWN_TEXT: Record<string, string> = {
  nominal: "as published",
  per_resident: "per resident",
  per_resident_21plus: "per resident aged 21+",
  real_cy2024: "in constant 2024 dollars",
};

/** Every state's value in every period, for the chosen measure and way of showing it. */
function annualRows(meta: MetricMeta, dm: DecodedMetric, geos: string[], shown: Shown, idx: MetricsIndex): Row[] {
  const out: Row[] = [];
  for (const g of geos) {
    for (const r of buildSeries(meta, dm, g, shown, idx).rows) {
      const v = r.shown && shown !== "nominal" ? r.shown.value : r.obs.value;
      // A value the source withheld or never published keeps the source's reason in every way of showing it.
      const missing = r.obs.value === null ? r.obs.missing_reason : r.shown && shown !== "nominal" ? r.shown.missing : null;
      out.push({
        geo: g,
        period: String(r.obs.year),
        // The published interval belongs to the published value only, not to a per-resident or other derived form.
        se: shown === "nominal" ? seFromInterval(r.obs.ci_low, r.obs.ci_high, r.obs.ci_level, r.obs.value) : null,
        est: r.obs.estimate_type,
        value: v,
        missing: v === null ? (missing ?? "missing") : null,
        rec: `obs:${meta.metric_id}:${r.obs.observation_id}`,
        group: r.obs.comparability_group,
        asset: r.obs.asset_id,
        locator: r.obs.source_locator,
        start: r.obs.period_start,
        end: r.obs.period_end,
      });
    }
  }
  return out;
}

function monthlyRows(file: MonthlyFile, geos: string[]): Row[] {
  const c = Object.fromEntries(file.columns.map((k, i) => [k, i]));
  const keep = new Set(geos);
  return file.rows
    .filter((r) => keep.has(r[c.geo_id] as string))
    .map((r) => ({
      geo: r[c.geo_id] as string,
      period: r[c.period_label] as string,
      value: r[c.value] as number | null,
      missing: (r[c.missing_reason] as string | null) ?? (r[c.value] === null ? "missing" : null),
      rec: null,
      group: r[c.comparability_group] as string,
      asset: r[c.asset_id] as string,
      locator: r[c.source_locator] as string,
      start: r[c.period_start] as string,
      end: r[c.period_end] as string,
    }));
}

export function MapView() {
  const params = useParams();
  const idx = useData<MetricsIndex>("metrics.json");
  const geos = useData<Geography[]>("geographies.json");
  const pol = useData<PolicyData>("policy.json");
  const man = useData<Manifest>("manifest.json");
  const shapes = useData<MapShapes>("map.json");
  const monthlyIdx = useData<{ series: MonthlyMeta[] }>("monthly.json");
  const srcData = useData<SourcesData>("sources.json");
  const measure = measureById(params.get("mm"));
  const variant = measure.variants ? (measure.variants.find((v) => v.key === params.get("bv")) ?? measure.variants[0]) : null;
  const metricId = variant?.metric ?? measure.metric ?? null;
  const meta = metricId ? idx.data?.metrics.find((m) => m.metric_id === metricId) : undefined;
  const mmeta = measure.monthly ? monthlyIdx.data?.series.find((s) => s.measure_id === measure.monthly) : undefined;
  const file = useData<MetricFile>(meta ? meta.file : null);
  const mfile = useData<MonthlyFile>(mmeta ? mmeta.file : null);
  const svgRef = useRef<HTMLDivElement>(null);
  const err = idx.error ?? geos.error ?? pol.error ?? man.error ?? shapes.error ?? monthlyIdx.error ?? srcData.error ?? file.error ?? mfile.error;
  const states = (geos.data ?? []).filter((g) => g.geo_level === "state");
  const stateIds = states.map((g) => g.geo_id);
  const shownOptions: Shown[] = meta ? (["nominal", ...meta.conversions] as Shown[]) : ["nominal"];
  const shown = pickOne(params.get("sh"), shownOptions, (measure.defaultShown && shownOptions.includes(measure.defaultShown) ? measure.defaultShown : "nominal") as Shown);
  const rows = useMemo(() => {
    if (meta && file.data && idx.data) return annualRows(meta, decodeMetric(file.data), [...stateIds, "nation:us"], shown, idx.data);
    if (mfile.data) return monthlyRows(mfile.data, [...stateIds, "nation:us"]);
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, file.data, mfile.data, idx.data, shown, stateIds.join()]);
  if (err) return <ErrorNote error={err} />;
  if (!idx.data || !geos.data || !pol.data || !man.data || !shapes.data || !monthlyIdx.data || !srcData.data) return <Loading what="the map" />;
  // Checked before waiting for rows: a measure missing from this build never loads, so the page would wait forever.
  if (metricId && !meta) return <ErrorNote error={new Error(`Measure ${metricId} is not in this build.`)} />;
  if (!rows) return <Loading what="the map's data" />;

  const G = geos.data;
  const name = (g: string) => geoName(g, G);
  const abbr = (g: string) => G.find((x) => x.geo_id === g)?.abbreviation ?? g;
  const periods = [...new Set(rows.map((r) => r.period))].sort();
  const counts = new Map(periods.map((p) => [p, rows.filter((r) => r.period === p && r.geo.startsWith("state:") && r.value !== null).length]));
  const usable = periods.filter((p) => (counts.get(p) ?? 0) >= 25);
  const period = pickOne(params.get("y"), periods, usable[usable.length - 1] ?? periods[periods.length - 1]);
  const base = measure.diverging ? null : pickOne(params.get("ch"), periods.filter((p) => p < period), "" as string) || null;
  const fit = params.get("sc") === "fit" || base !== null;
  const outlineUtah = params.get("ut") !== "0";
  const selected = pickOne(params.get("sel"), stateIds, "" as string) || null;
  const diverging = Boolean(measure.diverging) || base !== null;
  const unit = base ? "percent_change" : (measure.monthly ? (mmeta?.unit ?? "percent_change") : unitOfShown(meta!.unit, shown));
  const byKey = new Map(rows.map((r) => [`${r.geo}|${r.period}`, r]));

  const cellFor = (g: string, p: string): MapCell => {
    const r = byKey.get(`${g}|${p}`);
    if (base) {
      const b = byKey.get(`${g}|${base}`);
      if (b && r && b.group !== r.group) return { geo: g, value: null, kind: "missing", why: "the definition changed between the two periods", rec: r.rec, period: p };
      const ch = changeBetween(b?.value ?? null, r?.value ?? null);
      return { geo: g, value: ch.value, kind: ch.value === null ? "missing" : cellKind(ch.value, null), why: ch.why, rec: r?.rec ?? null, period: p };
    }
    if (!r) return { geo: g, value: null, kind: "missing", why: "no record for this period", rec: null, period: p };
    return { geo: g, value: r.value, kind: cellKind(r.value, r.missing), why: r.missing, rec: r.rec, period: p, se: r.se ?? null };
  };
  const cells = stateIds.map((g) => cellFor(g, period));
  const ranked = rankCells(cells, name);
  const cellMap = new Map(ranked.map((c) => [c.geo, c]));
  const allValues = fit ? cells.map((c) => c.value).filter((v): v is number => v !== null) : rows.filter((r) => r.geo.startsWith("state:") && r.value !== null).map((r) => r.value!);
  const domain = domainOf(allValues, diverging, !fit);
  const barMax = Math.max(0, ...cells.map((c) => (c.value === null ? 0 : Math.abs(c.value))));
  const barMin = Math.min(0, ...cells.map((c) => (c.value === null ? 0 : c.value)));
  const fmt = (v: number | null) => (v === null ? "—" : unit === "percent_change" ? `${v > 0 ? "+" : ""}${v.toFixed(1)}%` : precise(v, unit));
  const jumps = new Map<string, Jump>();
  if (base)
    for (const g of stateIds) {
      const j = largestJump(rows.filter((r) => r.geo === g), base, period);
      if (j && cellMap.get(g)?.value !== null) jumps.set(g, j);
    }
  const jumpText = (j: Jump) => `${j.pct > 0 ? "+" : ""}${j.pct.toFixed(0)}% from ${j.from} to ${j.to}`;
  const short = (c: RankedCell) =>
    c.kind === "suppressed"
      ? "suppr."
      : c.kind === "zero"
        ? "0"
        : c.value === null
          ? "n/a"
          : `${unit === "percent_change" ? fmt(c.value) : mapLabel(c.value, unit)}${jumps.has(c.geo) ? "†" : ""}`;
  const valued = ranked.filter((c) => c.rank !== null).length;
  const hasRanges = ranked.some((c) => c.rankLow !== undefined);
  // What the published intervals behind the rank ranges describe: survey sampling error, or chance variation in a count of deaths.
  const withSe = rows.find((r) => r.se !== null && r.se !== undefined);
  const ivWhat = intervalPhrase(intervalKind({ estimate_type: withSe?.est ?? null, comparability_group: withSe?.group ?? null }));
  const rangeOf = (c: RankedCell) => (c.rankLow !== undefined ? rankRangeText(c.rankLow, c.rankHigh!) : null);
  // Liquor-control comparison for this period, each state over its own period dates (fiscal years differ).
  const criterion = criterionById(params.get("ca"));
  const onlyVerified = criterion !== null && params.get("cv") === "1";
  const periodRows = rows.filter((r) => r.period === period && r.start && r.end);
  const commonPeriod = (() => {
    const counts = new Map<string, number>();
    for (const r of periodRows) counts.set(`${r.start}|${r.end}`, (counts.get(`${r.start}|${r.end}`) ?? 0) + 1);
    const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    return best ? { from: best.split("|")[0], to: best.split("|")[1] } : null;
  })();
  const periodOf = (g: string) => {
    const r = periodRows.find((x) => x.geo === g);
    return r ? { from: r.start, to: r.end } : commonPeriod!;
  };
  const control = criterion && commonPeriod ? assessAll(pol.data, criterion, stateIds, "state:49", periodOf) : null;
  const isRef = (g: string) => criterion?.id === "same_as_target" && g === "state:49";
  const ctlText = (g: string) => (isRef(g) ? "reference state" : control?.get(g) ? verdictText(control.get(g)!) : null);
  const controlClass = (g: string) => {
    const v = control?.get(g)?.verdict;
    return v === "no" ? "ctl-no" : v === "unknown" ? "ctl-unknown" : v === "yes" ? "ctl-yes" : "";
  };
  const describe = (c: RankedCell | undefined, g: string) =>
    (!c
      ? `${name(g)}: no data`
      : c.value !== null
        ? `${name(g)}: ${fmt(c.value)}${c.rank ? `, rank ${c.rank} of ${valued}${rangeOf(c) ? ` (rank range ${rangeOf(c)} allowing for ${ivWhat})` : ""}` : ""}${jumps.has(g) ? `; includes a one-year change of ${jumpText(jumps.get(g)!)}` : ""}`
        : `${name(g)}: ${c.kind === "suppressed" ? "suppressed by the source" : `no data (${words(c.why)})`}`) +
    (ctlText(g) ? `; liquor control: ${ctlText(g)}` : "");
  const us = cellFor("nation:us", period);
  const variantText = variant && variant.key !== "all" ? ` — ${variant.label.toLowerCase()}` : "";
  const periodText = measure.monthly ? period : meta?.period_kind === "state_fiscal_year" ? `fiscal year ${period}` : period;
  const modeText = base ? `percent change from ${base} to ${period}` : `${SHOWN_TEXT[shown] ?? shown}, ${periodText}`;
  const title = `${measure.label}${variantText}: ${modeText}`;
  const unitWords = base ? `Percent change, computed from values ${SHOWN_TEXT[shown] ?? shown} (${unitLabel(unitOfShown(meta?.unit ?? "", shown))})` : unitLabel(unit);
  // It opens a sentence wherever it is shown (subtitle, legend, image, CSV).
  const unitText = unitWords.charAt(0).toUpperCase() + unitWords.slice(1);
  const fixedText = fit ? "The color scale is fitted to this map only." : `The color scale is the same for every ${measure.monthly ? "month" : "year"} of this measure.`;
  // Who published what is drawn: the measure's own files, a derived value's inputs, and the population or
  // price series a per-person or constant-dollar form divides by.
  const lookup = { metrics: idx.data.metrics, monthly: monthlyIdx.data.series, sources: srcData.data };
  const sourceIds = meta ? metricSourceIds(meta, shown, lookup) : mmeta ? monthlySourceIds(mmeta, lookup) : [];
  const computed = meta?.method_family === "derived" || (!measure.monthly && shown !== "nominal") || base !== null;
  const sourceText = sourceLine(sourcesById(sourceIds, srcData.data), computed);
  const mapCredit = sourceLine(sourcesById(["us_atlas"], srcData.data), false).replace(/^Source: /, "Map outlines: ");
  // The same legend as the page, drawn into the image.
  const pngLegend: PngLegend | undefined = domain
    ? {
        stops: gradientStops(domain),
        ends: [`${domain.clipped?.low ? "≤ " : ""}${fmt(domain.min)}`, ...(domain.diverging ? ["0"] : []), `${domain.clipped?.high ? "≥ " : ""}${fmt(domain.max)}`],
        caption: [
          `${unitText}. ${domain.diverging ? "Orange = fell, blue = rose, white = no change." : "Darker = higher value, which is not by itself better or worse."} ${fixedText}${domain.clipped ? ` ${domain.clipped.note}` : ""}`,
          "Hatched = no data; cross-hatched = suppressed by the source; white with a dark border = reported zero; orange outline = Utah." +
            (jumps.size ? ` † = the series moves ${JUMP_PCT}% or more in a single year between ${base} and ${period}.` : ""),
        ],
      }
    : undefined;
  const set = (patch: Record<string, string | number | null>) => navigate(patch, { replace: false });
  const selectState = (g: string) => set({ sel: g === selected ? null : g });
  // Only measures this build holds (a public build leaves some sources out).
  const inBuild = (m: MapMeasure) => !m.metric || idx.data!.metrics.some((x) => x.metric_id === m.metric);
  const byTopic = Object.entries(MAP_TOPICS).map(([k, label]) => [label, MAP_MEASURES.filter((m) => m.topic === k && inBuild(m))] as const).filter(([, ms]) => ms.length);

  const csv = () => {
    type R = RankedCell & { name: string };
    const cols: Column<R>[] = [
      { key: "rank", kind: "number", get: (r) => r.rank },
      ...(hasRanges
        ? ([
            { key: "rank_low_5th_pct", kind: "number", get: (r: R) => r.rankLow ?? null },
            { key: "rank_high_95th_pct", kind: "number", get: (r: R) => r.rankHigh ?? null },
          ] as Column<R>[])
        : []),
      { key: "state", kind: "text", get: (r) => r.name },
      { key: "geo_id", kind: "text", get: (r) => r.geo },
      { key: "value", kind: "number", get: (r) => r.value },
      { key: "unit", kind: "text", get: () => unitText },
      { key: "period", kind: "text", get: () => (base ? `${base} to ${period}` : period) },
      { key: "status", kind: "text", get: (r) => (r.kind === "value" ? "value" : r.kind === "zero" ? "reported zero" : r.kind) },
      { key: "reason_if_no_value", kind: "text", get: (r) => (r.value === null ? r.why : null) },
      ...(base ? [{ key: "largest_one_year_change_if_50pct_or_more", kind: "text", get: (r: R) => (jumps.has(r.geo) ? jumpText(jumps.get(r.geo)!) : null) } as Column<R>] : []),
      ...(control
        ? [{ key: `liquor_control_${criterion!.id}`, kind: "text", get: (r: R) => ctlText(r.geo) } as Column<R>]
        : []),
      { key: "record", kind: "text", get: (r) => r.rec },
    ];
    const head = `# ${title}\r\n# ${sourceText}\r\n# Dataset ${man.data!.dataset.release_label}. Missing and suppressed values are blank, never zero; ranks count only states with a value.${hasRanges ? ` rank_low/high are the 5th and 95th percentile of a state's rank when every state's value is redrawn within its published 95% interval (${RANKS_METHOD}); blank where a state has no published interval.` : ""}\r\n`;
    saveFile(`map_${measure.id}_${variant?.key ?? ""}_${base ? `${base}-` : ""}${period}.csv`, head + toCsv(cols, ranked.map((r) => ({ ...r, name: name(r.geo) }))), "text/csv;charset=utf-8");
  };

  return (
    <>
      <section className="panel" aria-labelledby="map-h">
        <h2 id="map-h">Nationwide map</h2>
        <p className="small">
          Choose what to map. Each state shows its value; the bars and the table below rank the same numbers. Click or press Enter on a state for
          its trend, sources and limits. Utah is outlined.
        </p>
        <form className="controls" onSubmit={(e) => e.preventDefault()} aria-label="Map settings">
          <label>
            Measure
            <select value={measure.id} onChange={(e) => set({ mm: e.target.value, bv: null, sh: null, y: null, ch: null })}>
              {byTopic.map(([label, ms]) => (
                <optgroup key={label} label={label}>
                  {ms.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <span className="help">{measure.help}</span>
          </label>
          {measure.variants && (
            <fieldset className="radios">
              <legend>Beverage</legend>
              {measure.variants.map((v) => (
                <label className="check" key={v.key}>
                  <input type="radio" name="bv" checked={variant?.key === v.key} onChange={() => set({ bv: v.key })} />
                  {v.label}
                </label>
              ))}
            </fieldset>
          )}
          <label>
            {measure.monthly ? "Month" : "Year"}
            <select value={period} onChange={(e) => set({ y: e.target.value })}>
              {[...periods].reverse().map((p) => (
                <option key={p} value={p}>
                  {p} ({counts.get(p) ?? 0} states with values)
                </option>
              ))}
            </select>
          </label>
          {!measure.monthly && (
            <label>
              Show
              <select value={shown} onChange={(e) => set({ sh: e.target.value })}>
                {(["nominal", "per_resident", "per_resident_21plus", "real_cy2024"] as Shown[]).map((s) => (
                  <option key={s} value={s} disabled={!shownOptions.includes(s)}>
                    {s === "nominal" ? "As published" : CONVERSION_LABELS[s]}
                    {shownOptions.includes(s) ? "" : " (not available)"}
                  </option>
                ))}
              </select>
              <span className="help">
                {shownOptions.length > 1
                  ? "Per resident divides by the Census July 1 population (all ages or 21+); constant dollars adjusts for inflation with the CPI-U."
                  : (meta?.conversions_unavailable_reason ?? "Shown as published.")}
              </span>
            </label>
          )}
          {!measure.diverging && (
            <label>
              Change since
              <select value={base ?? ""} onChange={(e) => set({ ch: e.target.value || null })}>
                <option value="">No: show the level</option>
                {periods
                  .filter((p) => p < period)
                  .reverse()
                  .map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
              </select>
              <span className="help">Percent change for each state between two years, in the way chosen above.</span>
            </label>
          )}
          <label className="check">
            <input type="checkbox" checked={!fit} disabled={base !== null} onChange={(e) => set({ sc: e.target.checked ? null : "fit" })} />
            Same color scale for every {measure.monthly ? "month" : "year"}
            <span className="help">
              {base !== null
                ? "A change map is always fitted to its own values."
                : `Keeps colors comparable when you change the ${measure.monthly ? "month" : "year"}.`}
            </span>
          </label>
          <label className="check">
            <input type="checkbox" checked={outlineUtah} onChange={(e) => set({ ut: e.target.checked ? null : "0" })} />
            Outline Utah
          </label>
          <ControlSelect
            value={criterion?.id ?? null}
            onChange={(v) => set({ ca: v, cv: v ? (params.get("cv") ?? null) : null })}
            onlyVerified={onlyVerified}
            onOnlyVerified={(v) => set({ cv: v ? "1" : null })}
            targetName="Utah"
          />
        </form>
      </section>

      <section className="panel report" aria-labelledby="map-title">
        <h3 id="map-title">{title}</h3>
        <p className="small muted">
          {unitText}. United States:{" "}
          {us.value !== null
            ? fmt(us.value)
            : shown !== "nominal" && !measure.monthly
              ? "not shown this way (per-person and constant-dollar conversions are computed for states only)"
              : `no national value (${words(us.why)})`}
          . {valued} of {stateIds.length} states have a value
          {ranked.some((c) => c.kind === "suppressed") ? `; ${ranked.filter((c) => c.kind === "suppressed").length} suppressed` : ""}.
        </p>
        {measure.caution && <p className="warn small">{measure.caution}</p>}
        {criterion && control && (
          <>
            <ControlSummary c={criterion} as={control} target="state:49" period={periodText} targetName="Utah" />
            <p className="small muted">On the map, states verified to differ are faded and states that cannot be assessed have a dashed outline.</p>
          </>
        )}
        {jumps.size > 0 && (
          <p className="warn small">
            † {jumps.size === 1 ? "This state's series moves" : "These states' series move"} by {JUMP_PCT}% or more in a single year between {base} and {period}:{" "}
            {[...jumps.entries()]
              .sort((a, b) => name(a[0]).localeCompare(name(b[0])))
              .map(([g, j]) => `${name(g)} (${jumpText(j)})`)
              .join("; ")}
            . A one-year move that large often reflects a change in what the source counts rather than in the activity itself, so check the source before
            reading the two-year change as a trend. Where the values carry published intervals (surveys, and deaths counted by FARS), a move that stays within
            chance variation is not flagged.
          </p>
        )}
        <div ref={svgRef} className="map-and-bars">
          <USMap
            shapes={shapes.data}
            cells={cellMap}
            domain={domain}
            abbr={abbr}
            name={name}
            format={short}
            selected={selected}
            outlineUtah={outlineUtah}
            onSelect={selectState}
            title={title}
            describe={describe}
            extraClass={control ? controlClass : undefined}
          />
          <MapLegend domain={domain} format={(v) => fmt(v)} unitText={unitText} fixed={fixedText} />
        </div>
        <SourceNote ids={sourceIds} derived={computed} />
        <SourceNote ids={["us_atlas"]} label="Map outline" />
        <div className="row-actions no-print">
          <button type="button" onClick={csv}>
            Download these values (CSV)
          </button>
          <button type="button" onClick={() => svgRef.current && downloadPng(svgRef.current, title, `map_${measure.id}_${period}.png`, [sourceText, mapCredit], pngLegend)}>
            Download the map image (PNG)
          </button>
          <button type="button" onClick={() => window.print()}>
            Print
          </button>
        </div>
      </section>

      {selected && (
        <StateDetails
          geo={selected}
          measure={measure}
          meta={meta}
          rows={rows}
          shown={shown}
          period={period}
          cell={cellMap.get(selected)}
          fmt={fmt}
          unit={unit}
          idx={idx.data}
          pol={pol.data}
          name={name}
          dm={file.data ? decodeMetric(file.data) : undefined}
        />
      )}

      <section className="panel" aria-labelledby="bars-h">
        <h3 id="bars-h">Ranked: {title}</h3>
        <p className="small muted">Highest first. Equal values share a rank. States without a value are listed at the end with the reason.</p>
        {hasRanges && (
          <p className="small muted">
            Rank ranges in the table below allow for {ivWhat}: the 5th to 95th percentile of each state's rank when every state's value is redrawn within its published 95% interval ({RANKS_METHOD}). A wide range means the ranking
            is not known that precisely; states without a published interval are held at their value and show no range.
          </p>
        )}
        <div className="rank-wrap">
        {onlyVerified && (
          <p className="small">
            Listing only states verified to match ({ranked.filter((c) => control?.get(c.geo)?.verdict === "yes").length}). Ranks are still among
            all {valued} states with a value.
          </p>
        )}
        <ol className="rank-bars">
          {ranked.filter((c) => !onlyVerified || control?.get(c.geo)?.verdict === "yes").map((c) => {
            // Bar lengths fit this period's values (a ranking within one map); colors follow the map's scale.
            const w = c.value === null ? 0 : diverging ? (50 * Math.abs(c.value)) / (barMax || 1) : (100 * (c.value - barMin)) / (barMax - barMin || 1);
            return (
              <li key={c.geo} className={`${c.geo === "state:49" ? "utah" : ""}${c.geo === selected ? " selected" : ""}`}>
                <button type="button" onClick={() => selectState(c.geo)} aria-label={describe(c, c.geo)}>
                  <span className="rank-no">{c.rank ?? "–"}</span>
                  <span className="rank-name">
                    {name(c.geo)}
                    {control?.get(c.geo) && !isRef(c.geo) && (
                      <span className={`ctl-mark v-${control.get(c.geo)!.verdict}`} aria-hidden="true">
                        {" "}
                        {verdictSymbol(control.get(c.geo)!.verdict)}
                      </span>
                    )}
                  </span>
                  <span className={`rank-track${diverging ? " diverging" : ""}`} aria-hidden="true">
                    {c.value !== null && (
                      <span
                        className="rank-bar"
                        style={{
                          width: `${Math.max(w, c.value === 0 ? 0 : 0.5)}%`,
                          background: fillFor(c, domain),
                          ...(diverging ? (c.value < 0 ? { right: "50%" } : { left: "50%" }) : {}),
                        }}
                      />
                    )}
                  </span>
                  <span className="rank-value">
                    {c.value !== null ? `${fmt(c.value)}${jumps.has(c.geo) ? "†" : ""}` : c.kind === "suppressed" ? "suppressed" : `no data: ${words(c.why)}`}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        </div>
        <SourceNote ids={sourceIds} derived={computed} />
      </section>

      <section className="panel" aria-labelledby="tbl-h">
        <h3 id="tbl-h">Table</h3>
        <details>
          <summary>Every state's value, period and source record ({ranked.length} rows)</summary>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th scope="col">Rank</th>
                  {hasRanges && <th scope="col">Rank range (5th–95th)</th>}
                  <th scope="col">State</th>
                  <th scope="col" className="num">
                    Value
                  </th>
                  <th scope="col">Status</th>
                  {control && <th scope="col">Liquor control ({criterion!.id === "same_as_target" ? "same as Utah" : criterion!.label.toLowerCase()})</th>}
                  <th scope="col">Record</th>
                </tr>
              </thead>
              <tbody>
                {ranked.filter((c) => !onlyVerified || control?.get(c.geo)?.verdict === "yes").map((c) => (
                  <tr key={c.geo}>
                    <td className="num">{c.rank ?? "–"}</td>
                    {hasRanges && <td className="num">{rangeOf(c) ?? "–"}</td>}
                    <th scope="row">{name(c.geo)}</th>
                    <td className="num">{c.value === null ? "—" : `${fmt(c.value)}${jumps.has(c.geo) ? "†" : ""}`}</td>
                    <td className="small">{c.kind === "value" ? "" : c.kind === "zero" ? "reported zero" : c.kind === "suppressed" ? "suppressed by the source" : words(c.why)}</td>
                    {control && (
                      <td className="small">
                        <ControlBadge a={control.get(c.geo)} reference={isRef(c.geo)} />
                      </td>
                    )}
                    <td className="small">{c.rec ? <RecordLink rec={c.rec}>open</RecordLink> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <CoveragePanel rows={rows} periods={periods} stateIds={stateIds} name={name} period={period} metricId={metricId} />
    </>
  );
}

function unitOfShown(unit: string, shown: Shown): string {
  if (shown === "real_cy2024") return "usd_constant_cy2024";
  if (shown === "per_resident" || shown === "per_resident_21plus") return "usd_nominal_per_person";
  return unit;
}

function StateDetails({
  geo,
  measure,
  meta,
  rows,
  shown,
  period,
  cell,
  fmt,
  unit,
  idx,
  pol,
  name,
  dm,
}: {
  geo: string;
  measure: MapMeasure;
  meta: MetricMeta | undefined;
  rows: Row[];
  shown: Shown;
  period: string;
  cell: RankedCell | undefined;
  fmt: (v: number | null) => string;
  unit: string;
  idx: MetricsIndex;
  pol: PolicyData;
  name: (g: string) => string;
  dm: DecodedMetric | undefined;
}) {
  const row = rows.find((r) => r.geo === geo && r.period === period);
  const ivWhat = intervalPhrase(intervalKind({ estimate_type: row?.est ?? null, comparability_group: row?.group ?? null }));
  const year = Number(period.slice(0, 4));
  const wine = "ordinary_grocery_wine_authorization";
  const ys = yearStatuses(pol.segments, geo, wine, year, year, pol.as_of_date)[0];
  const snaps = snapshotsFor(pol.snapshots, geo, wine);
  const snap = snaps[snaps.length - 1];
  const compareGeos = [...new Set([geo, "state:49", "nation:us"])];
  const trend =
    meta && dm
      ? compareGeos.map((g) => ({ key: g, label: name(g), points: buildSeries(meta, dm, g, shown, idx).points }))
      : compareGeos.map((g) => ({
          key: g,
          label: name(g),
          points: rows
            .filter((r) => r.geo === g)
            .map((r) => ({ year: Number(r.period.slice(0, 4)) + (Number(r.period.slice(5, 7)) - 1) / 12, value: r.value, comparability_group: r.group ?? "", rec: r.rec ?? "", period_label: r.period })),
        }));
  const charted = trend.filter((s) => s.points.some((p) => p.value !== null));
  return (
    <section className="panel" aria-labelledby="sd-h">
      <h3 id="sd-h">{name(geo)}</h3>
      <p>
        {cell?.value !== null && cell?.value !== undefined ? (
          <>
            <strong>{fmt(cell.value)}</strong> in {period}
            {cell.rank ? `, rank ${cell.rank}${cell.rankLow !== undefined ? ` (range ${rankRangeText(cell.rankLow, cell.rankHigh!)} allowing for ${ivWhat})` : ""}` : ""}.
          </>
        ) : (
          <>No value in {period}: {cell?.kind === "suppressed" ? "suppressed by the source" : words(cell?.why)}.</>
        )}{" "}
        {row?.start && row.end && <span className="small muted">Period {row.start} to {row.end}.</span>}
      </p>
      {!charted.length ? (
        <p className="small muted">Nothing to chart: none of {trend.map((s) => s.label).join(", ")} has a value for this measure, shown this way, in any period.</p>
      ) : meta && dm ? (
        <TrendChart series={charted} unit={unitOfShown(meta.unit, shown)} domain={[Math.max(meta.first_year, 1990), meta.last_year]} title={`${measure.label}, ${name(geo)} with Utah and the United States`} height={240} />
      ) : (
        <MonthlyLines series={charted} fmt={fmt} />
      )}
      {charted.length > 0 && charted.length < trend.length && (
        <p className="small muted">
          No line for {trend.filter((s) => !charted.includes(s)).map((s) => s.label).join(" or ")}: no value in any period
          {shown !== "nominal" && trend.some((s) => s.key === "nation:us" && !charted.includes(s)) ? " (per-person and constant-dollar conversions are computed for states only)" : ""}.
        </p>
      )}
      <ul className="small source-list">
        <li>
          Grocery-store wine law in {year}: {ys.kind === "not_coded" ? "no verified history in the dataset" : ys.kind === "unknown" ? "unknown (no verified day)" : `${ys.values.map(words).join(" → ")} (${ys.knownDays} of ${ys.days} days verified)`}
          {snap && (
            <>
              ; most recent dated snapshot: <RecordLink rec={`snapshot:${snap.snapshot_id}`}>{words(snap.policy_value)}</RecordLink> on {snap.observed_on ?? snap.observed_year} (that day only)
            </>
          )}
          .
        </li>
        {meta?.overlap_note && <li>{meta.overlap_note}</li>}
        {meta?.notes && <li>{meta.notes}</li>}
        <li>Unit: {unitLabel(unit)}.</li>
      </ul>
      {row?.asset && (
        <details className="small" open>
          <summary>Source of this value</summary>
          <SourceRef assetId={row.asset} locator={row.locator} />
        </details>
      )}
      <div className="row-actions no-print">
        <Go to={{ v: "change", cs: [geo, ...EXAMPLE_COMPARISONS].filter((g, i, a) => g !== "state:47" && a.indexOf(g) === i).slice(0, 5).join(",") }} reset>
          {geo === "state:47" || EXAMPLE_COMPARISONS.includes(geo) ? "Open" : `Add ${name(geo)} to`} the Tennessee 2016 before-and-after example
        </Go>
        {meta && (
          <Go to={{ v: "explore", g: compareGeos.join(","), m: meta.metric_id, tf: shown === "nominal" ? null : shown, y0: Math.max(meta.first_year, 1990), y1: meta.last_year, pd: "ordinary_grocery_wine_authorization" }} reset>
            Compare with Utah over time in Explore
          </Go>
        )}
        <Go to={{ v: "compare", st: [geo, "state:49"].filter((g, i, a) => a.indexOf(g) === i).join(","), y: year }} reset>
          Side by side with Utah in Compare
        </Go>
      </div>
    </section>
  );
}

/** A small line chart for monthly series (TrendChart is built for yearly periods). */
function MonthlyLines({ series, fmt }: { series: { key: string; label: string; points: { year: number; value: number | null; period_label: string }[] }[]; fmt: (v: number | null) => string }) {
  const all = series.flatMap((s) => s.points).filter((p) => p.value !== null);
  if (!all.length) return <p className="small muted">No monthly values.</p>;
  const x0 = Math.min(...all.map((p) => p.year));
  const x1 = Math.max(...all.map((p) => p.year));
  const v0 = Math.min(0, ...all.map((p) => p.value!));
  const v1 = Math.max(0, ...all.map((p) => p.value!));
  const X = (x: number) => 40 + ((x - x0) / (x1 - x0 || 1)) * 540;
  const Y = (v: number) => 10 + (1 - (v - v0) / (v1 - v0 || 1)) * 150;
  const colors = ["var(--series-1)", "var(--series-2)", "var(--series-3)"];
  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox="0 0 600 180" width="100%" role="img" aria-label={`Monthly values for ${series.map((s) => s.label).join(", ")}`}>
        <line x1={40} x2={580} y1={Y(0)} y2={Y(0)} stroke="var(--line-strong)" />
        <text x={2} y={Y(v1) + 4} fontSize="10" fill="var(--text-2)">
          {fmt(v1)}
        </text>
        <text x={2} y={Y(v0)} fontSize="10" fill="var(--text-2)">
          {fmt(v0)}
        </text>
        {series.map((s, i) => {
          const segs: string[] = [];
          let cur = "";
          for (const p of [...s.points].sort((a, b) => a.year - b.year)) {
            if (p.value === null) {
              if (cur) segs.push(cur);
              cur = "";
              continue;
            }
            cur += `${cur ? "L" : "M"}${X(p.year).toFixed(1)},${Y(p.value).toFixed(1)}`;
          }
          if (cur) segs.push(cur);
          return segs.map((d, j) => <path key={`${s.key}${j}`} d={d} fill="none" stroke={colors[i % 3]} strokeWidth={1.6} />);
        })}
        <text x={40} y={176} fontSize="10" fill="var(--text-2)">
          {Math.floor(x0)}
        </text>
        <text x={560} y={176} fontSize="10" fill="var(--text-2)">
          {Math.floor(x1)}
        </text>
      </svg>
      <figcaption className="legend">
        {series.map((s, i) => (
          <span className="item" key={s.key}>
            <span className="sw" style={{ background: colors[i % 3] }} aria-hidden="true" /> {s.label}
          </span>
        ))}
        <span className="item muted">Gaps are months without a value.</span>
      </figcaption>
    </figure>
  );
}

function CoveragePanel({ rows, periods, stateIds, name, period, metricId }: { rows: Row[]; periods: string[]; stateIds: string[]; name: (g: string) => string; period: string; metricId: string | null }) {
  const at = (p: string) => {
    const r = rows.filter((x) => x.period === p && x.geo.startsWith("state:"));
    return {
      values: r.filter((x) => x.value !== null && x.value !== 0).length,
      zeros: r.filter((x) => x.value === 0).length,
      suppressed: r.filter((x) => x.value === null && x.missing === "suppressed").length,
      missing: r.filter((x) => x.value === null && x.missing !== "suppressed").length,
      none: stateIds.length - r.length,
    };
  };
  const now = rows.filter((x) => x.period === period && x.geo.startsWith("state:"));
  const lacking = stateIds.filter((g) => !now.some((r) => r.geo === g && r.value !== null));
  const shownPeriods = periods.length > 14 ? periods.slice(-14) : periods;
  return (
    <section className="panel" aria-labelledby="cov-h">
      <h3 id="cov-h">Coverage of this measure</h3>
      <div className="table-wrap">
        <table className="data">
          <caption className="small">States (of {stateIds.length}) by period{periods.length > 14 ? `; last 14 of ${periods.length} periods` : ""}</caption>
          <thead>
            <tr>
              <th scope="col">Period</th>
              <th scope="col" className="num">
                Value
              </th>
              <th scope="col" className="num">
                Reported zero
              </th>
              <th scope="col" className="num">
                Suppressed
              </th>
              <th scope="col" className="num">
                Missing (reason given)
              </th>
              <th scope="col" className="num">
                No record
              </th>
            </tr>
          </thead>
          <tbody>
            {shownPeriods.map((p) => {
              const c = at(p);
              return (
                <tr key={p} className={p === period ? "selected-row" : undefined}>
                  <th scope="row">{p}</th>
                  <td className="num">{c.values}</td>
                  <td className="num">{c.zeros}</td>
                  <td className="num">{c.suppressed}</td>
                  <td className="num">{c.missing}</td>
                  <td className="num">{c.none}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {lacking.length > 0 && (
        <p className="small">
          No value in {period}: {lacking.map(name).join(", ")}.
        </p>
      )}
      <p className="small muted">
        Policy history is a separate kind of coverage: see the{" "}
        <Go to={{ v: "matrix" }} reset>
          Policy matrix
        </Go>
        {metricId && (
          <>
            {" "}
            and the{" "}
            <Go to={{ v: "coverage", m: metricId }} reset>
              full coverage grid for this measure
            </Go>
          </>
        )}
        .
      </p>
    </section>
  );
}

/** Save the map (and its legend) as a PNG: colors are copied from the page, so the image matches it. */
/** Split text into lines that fit `width` pixels in the context's current font. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export interface PngLegend {
  stops: { offset: number; color: string }[];
  ends: string[];
  caption: string[];
}

async function downloadPng(container: HTMLElement, title: string, filename: string, footer: string[] = [], legend?: PngLegend) {
  const svg = container.querySelector("svg.us-map") as SVGSVGElement | null;
  if (!svg) return;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const src = svg.querySelectorAll("*");
  const dst = clone.querySelectorAll("*");
  // Paint order and joins too: a label's halo is a stroke drawn under its fill, and without paint-order the
  // halo is drawn over the text in the state's own color, hiding it.
  const PROPS = ["fill", "stroke", "stroke-width", "stroke-linejoin", "paint-order", "font-size", "font-weight", "font-family"];
  src.forEach((el, i) => {
    const cs = getComputedStyle(el);
    const d = dst[i] as SVGElement;
    for (const prop of PROPS) d.style.setProperty(prop, cs.getPropertyValue(prop));
  });
  const [, , w, h] = (svg.getAttribute("viewBox") ?? "0 0 1060 610").split(" ").map(Number);
  clone.setAttribute("width", String(w * 1.5));
  clone.setAttribute("height", String(h * 1.5));
  const data = new XMLSerializer().serializeToString(clone);
  const img = new Image();
  const url = URL.createObjectURL(new Blob([data], { type: "image/svg+xml" }));
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error("image"));
    img.src = url;
  });
  const canvas = document.createElement("canvas");
  canvas.width = w * 1.5;
  // The legend and the source lines go under the map, so a copied image can be read on its own and always
  // says where its numbers come from.
  const measure = document.createElement("canvas").getContext("2d")!;
  measure.font = "15px system-ui, sans-serif";
  const LINE = 21;
  const capLines = legend ? legend.caption.filter(Boolean).flatMap((t) => wrap(measure, t, canvas.width - 32)) : [];
  const legendH = legend ? 18 + 24 + capLines.length * LINE + 10 : 0;
  const footLines = footer.filter(Boolean).flatMap((t) => wrap(measure, t, canvas.width - 32));
  const mapBottom = h * 1.5 + 50;
  // 8 px above the legend and 12 px of margin under the last line.
  canvas.height = mapBottom + 8 + legendH + (footLines.length ? footLines.length * LINE + 16 : 0) + 12;
  const ctx = canvas.getContext("2d")!;
  // Same background and ink as the page, so labels copied from the page stay readable in either theme.
  const page = getComputedStyle(document.body);
  const ink = page.color || "#111111";
  ctx.fillStyle = page.backgroundColor || "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = ink;
  ctx.font = "bold 20px system-ui, sans-serif";
  ctx.fillText(title.length > 110 ? `${title.slice(0, 107)}...` : title, 16, 30);
  ctx.drawImage(img, 0, 50);
  let y = mapBottom + 8;
  if (legend) {
    const barW = 360;
    const grad = ctx.createLinearGradient(16, 0, 16 + barW, 0);
    for (const s of legend.stops) grad.addColorStop(s.offset, s.color);
    ctx.fillStyle = grad;
    ctx.fillRect(16, y, barW, 16);
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1;
    ctx.strokeRect(16.5, y + 0.5, barW, 16);
    ctx.fillStyle = ink;
    ctx.font = "15px system-ui, sans-serif";
    legend.ends.forEach((t, i) => {
      const x = 16 + (legend.ends.length === 1 ? 0 : (i / (legend.ends.length - 1)) * barW);
      ctx.textAlign = i === 0 ? "left" : i === legend.ends.length - 1 ? "right" : "center";
      ctx.fillText(t, x, y + 16 + 20);
    });
    ctx.textAlign = "left";
    y += 18 + 24;
    capLines.forEach((l) => {
      y += LINE;
      ctx.fillText(l, 16, y - 5);
    });
    y += 10;
  }
  ctx.font = "15px system-ui, sans-serif";
  footLines.forEach((l, i) => ctx.fillText(l, 16, y + 16 + (i + 1) * LINE - 5));
  URL.revokeObjectURL(url);
  canvas.toBlob((b) => b && saveBlob(b, filename), "image/png");
}

function saveBlob(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

