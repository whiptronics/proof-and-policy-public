// Beer, wine and spirits side by side. Part 1: pure alcohol per resident aged 21+ (NIAAA apparent
// consumption) for a state, an optional second state and the United States, three panels on one scale,
// with each beverage's share. Part 2: what Utah's state liquor stores sold, by beverage and month (DABS
// Sales Analysis Reports), next to all alcohol shipped into Utah for scale. Nothing here is measured drinking.
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ErrorNote, Go, Loading, RecordLink, SourceNote } from "../components/common";
import { metricSourceIds, monthlySourceIds, sourceLine, sourcesById } from "../lib/sources";
import { SERIES_COLORS, TrendChart, type ChartSeries } from "../components/TrendChart";
import {
  ALL_PER_ADULT,
  BEVERAGES,
  DABS_GROUPS,
  DABS_LABELS,
  GALLONS_PER_9L_CASE,
  change,
  sameMonthChanges,
  sharesOf,
  type BevKey,
  type DabsGroup,
} from "../lib/beverages";
import { saveFile, toCsv, type Column } from "../lib/csv";
import { decodeMetric, useData, useMany, type DecodedMetric } from "../lib/data";
import { formatAxis, formatValue, geoName } from "../lib/format";
import { buildSeries } from "../lib/series";
import type { Geography, Manifest, MetricFile, MetricsIndex, MonthlyFile, MonthlyMeta, SourcesData } from "../lib/types";
import { navigate, pickInt, pickOne, useParams } from "../lib/url";

const pct = (v: number | null) => (v === null ? "n/a" : `${v > 0 ? "+" : ""}${v.toFixed(1)}%`);
const gal = (v: number | null | undefined) => (v === null || v === undefined ? "—" : v.toFixed(2));
const millions = (v: number) => `${(v / 1e6).toFixed(2)} million`;

export function BeveragesView() {
  const params = useParams();
  const idx = useData<MetricsIndex>("metrics.json");
  const geos = useData<Geography[]>("geographies.json");
  const man = useData<Manifest>("manifest.json");
  const monthlyIdx = useData<{ series: MonthlyMeta[] }>("monthly.json");
  const srcData = useData<SourcesData>("sources.json");
  const ids = [BEVERAGES.map((b) => b.perAdult), ALL_PER_ADULT, BEVERAGES.map((b) => b.gallons)].flat();
  const metas = ids.map((id) => idx.data?.metrics.find((m) => m.metric_id === id));
  const missingMetric = idx.data ? ids.find((_, i) => !metas[i]) : undefined;
  const files = useMany<MetricFile>(idx.data && !missingMetric ? metas.map((m) => m!.file) : []);
  const err = idx.error ?? geos.error ?? man.error ?? monthlyIdx.error ?? srcData.error ?? files.error;
  if (err) return <ErrorNote error={err} />;
  if (missingMetric) return <ErrorNote error={new Error(`Measure ${missingMetric} is not in this build.`)} />;
  if (!idx.data || !geos.data || !man.data || !monthlyIdx.data || !srcData.data || !files.data || files.data.length !== ids.length) return <Loading what="beverage data" />;
  const lookup = { metrics: idx.data.metrics, monthly: monthlyIdx.data.series, sources: srcData.data };
  const niaaaIds = [...new Set(metas.flatMap((m) => metricSourceIds(m!, "nominal", lookup)))];

  const G = geos.data;
  const name = (g: string) => geoName(g, G);
  const states = G.filter((g) => g.geo_level === "state");
  const choices = ["nation:us", ...states.map((g) => g.geo_id)];
  const geo = pickOne(params.get("g"), choices, "state:49");
  const other = pickOne(params.get("c"), ["", ...choices.filter((g) => g !== geo && g !== "nation:us")], "") || null;
  const shownGeos = [...new Set([geo, ...(other ? [other] : []), "nation:us"])];
  const dms = new Map(ids.map((id, i) => [id, decodeMetric(files.data![i])]));
  const metaOf = (id: string) => metas[ids.indexOf(id)]!;
  const last = metaOf(ALL_PER_ADULT).last_year;
  const first = metaOf(ALL_PER_ADULT).first_year;
  const y0 = pickInt(params.get("y0"), first, last - 1, Math.max(first, 1990));
  const y1 = pickInt(params.get("y1"), y0 + 1, last, last);
  const set = (patch: Record<string, string | number | null>) => navigate(patch);

  const valueAt = (metric: string, g: string, y: number): number | null =>
    dms.get(metric)!.obs.find((o) => o.geo_id === g && o.year === y)?.value ?? null;
  const recAt = (metric: string, g: string, y: number): string | null => {
    const o = dms.get(metric)!.obs.find((x) => x.geo_id === g && x.year === y);
    return o ? `obs:${metric}:${o.observation_id}` : null;
  };
  const seriesFor = (metric: string): ChartSeries[] =>
    shownGeos.map((g) => ({ key: g, label: name(g), points: buildSeries(metaOf(metric), dms.get(metric)!, g, "nominal", idx.data!).points }));
  // One value axis for the three beverage panels, so a taller line means more alcohol in every panel.
  let top = 0;
  for (const b of BEVERAGES)
    for (const g of shownGeos)
      for (const o of dms.get(b.perAdult)!.obs) if (o.geo_id === g && o.year >= y0 && o.year <= y1 && o.value !== null) top = Math.max(top, o.value);
  const yDomain: [number, number] = [0, Math.ceil(top * 10) / 10 || 1];
  let topAll = 0;
  for (const g of shownGeos)
    for (const o of dms.get(ALL_PER_ADULT)!.obs) if (o.geo_id === g && o.year >= y0 && o.year <= y1 && o.value !== null) topAll = Math.max(topAll, o.value);
  const yDomainAll: [number, number] = [0, Math.ceil(topAll * 2) / 2 || 1];
  const at = (g: string, y: number) => Object.fromEntries(BEVERAGES.map((b) => [b.key, valueAt(b.perAdult, g, y)])) as Record<BevKey, number | null>;

  const csv = () => {
    type R = { geo: string; year: number };
    const rows: R[] = shownGeos.flatMap((g) => Array.from({ length: y1 - y0 + 1 }, (_, i) => ({ geo: g, year: y0 + i })));
    const cols: Column<R>[] = [
      { key: "geography", kind: "text", get: (r) => name(r.geo) },
      { key: "geo_id", kind: "text", get: (r) => r.geo },
      { key: "year", kind: "number", get: (r) => r.year },
      ...BEVERAGES.map((b) => ({ key: `${b.key}_gal_ethanol_per_resident_21plus`, kind: "number", get: (r: R) => valueAt(b.perAdult, r.geo, r.year) }) as Column<R>),
      { key: "all_beverages_gal_ethanol_per_resident_21plus", kind: "number", get: (r) => valueAt(ALL_PER_ADULT, r.geo, r.year) },
      ...BEVERAGES.map((b) => ({ key: `${b.key}_share_pct_of_three`, kind: "number", get: (r: R) => sharesOf(at(r.geo, r.year))?.[b.key] ?? null }) as Column<R>),
    ];
    const head = `# Pure alcohol per resident aged 21+, by beverage (NIAAA apparent consumption), ${y0}-${y1}. US gallons of ethanol per person. Shares are of beer + wine + spirits.\r\n# ${sourceLine(sourcesById(niaaaIds, srcData.data!), false)} Shares computed by this project.\r\n# Dataset ${man.data!.dataset.release_label}.\r\n`;
    saveFile(`beverages_${shownGeos.map((g) => g.replace(":", "")).join("_")}_${y0}-${y1}.csv`, head + toCsv(cols, rows), "text/csv;charset=utf-8");
  };

  return (
    <>
      <section className="panel" aria-labelledby="bev-h">
        <h2 id="bev-h">Beer, wine and spirits</h2>
        <p className="small">
          How much pure alcohol was sold per resident aged 21 and older, beverage by beverage. These are NIAAA's <strong>apparent consumption</strong>{" "}
          figures: alcohol sold or shipped into a state, converted to gallons of pure alcohol (ethanol). They count what visitors buy and do not
          measure who drinks; for that, see the survey measures on the <Go to={{ v: "map", mm: "adults_drinking" }} reset>map</Go>.
        </p>
        <form className="controls" onSubmit={(e) => e.preventDefault()} aria-label="Beverage settings">
          <label>
            State
            <select value={geo} onChange={(e) => set({ g: e.target.value, c: e.target.value === other ? null : other })}>
              {choices.map((g) => (
                <option key={g} value={g}>
                  {name(g)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Compare with
            <select value={other ?? ""} onChange={(e) => set({ c: e.target.value || null })}>
              <option value="">Nobody else (the United States is always shown)</option>
              {choices
                .filter((g) => g !== geo && g !== "nation:us")
                .map((g) => (
                  <option key={g} value={g}>
                    {name(g)}
                  </option>
                ))}
            </select>
          </label>
          <label>
            From
            <select value={y0} onChange={(e) => set({ y0: e.target.value })}>
              {Array.from({ length: last - first }, (_, i) => first + i).map((y) => (
                <option key={y} value={y} disabled={y >= y1}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <label>
            To
            <select value={y1} onChange={(e) => set({ y1: e.target.value })}>
              {Array.from({ length: last - first }, (_, i) => first + 1 + i).map((y) => (
                <option key={y} value={y} disabled={y <= y0}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          {geo !== "state:49" && (
            <button type="button" className="link" onClick={() => set({ g: "state:49", c: geo === "nation:us" ? null : geo })}>
              Show Utah
            </button>
          )}
        </form>
      </section>

      <section className="panel report" aria-labelledby="bev-change-h">
        <h3 id="bev-change-h">
          What changed, {y0} to {y1}
        </h3>
        <ul className="change-list">
          {shownGeos.map((g) => {
            const a = at(g, y0);
            const b = at(g, y1);
            const sa = sharesOf(a);
            const sb = sharesOf(b);
            return (
              <li key={g}>
                <strong>{name(g)}:</strong>{" "}
                {BEVERAGES.map((bev, i) => (
                  <span key={bev.key}>
                    {i > 0 ? "; " : ""}
                    {bev.label.toLowerCase()} {gal(a[bev.key])} → {gal(b[bev.key])} gallons ({pct(change(a[bev.key], b[bev.key]))})
                  </span>
                ))}
                .{" "}
                {sa && sb && (
                  <span className="muted">
                    Wine's share of the three went from {sa.wine.toFixed(0)}% to {sb.wine.toFixed(0)}%.
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        <div className="bev-panels">
          {BEVERAGES.map((b) => (
            <div key={b.key}>
              <h4>{b.label}</h4>
              <TrendChart series={seriesFor(b.perAdult)} unit="us_gallons_ethanol_per_person" domain={[y0, y1]} yDomain={yDomain} height={220} title={`${b.label}: gallons of pure alcohol per resident aged 21+`} />
            </div>
          ))}
        </div>
        <p className="small muted">
          The three panels share one scale (0 to {yDomain[1]} gallons of pure alcohol per resident aged 21+), so the heights compare across beverages.
          The figures convert every year's sales at fixed strengths (beer 4.5%, wine 12.9%, spirits 41.1% alcohol), so one gallon of pure alcohol
          is about 22 gallons of beer, 7.8 gallons of wine or 2.4 gallons of spirits. NIAAA also publishes a version with strengths that change over
          time; it is in the dataset (Explore) but not drawn here.
        </p>
        <SourceNote ids={niaaaIds} />
        <h4>All beverages together</h4>
        <TrendChart series={seriesFor(ALL_PER_ADULT)} unit="us_gallons_ethanol_per_person" domain={[y0, y1]} yDomain={yDomainAll} height={240} title="All beverages: gallons of pure alcohol per resident aged 21+" />
        <div className="row-actions no-print">
          <button type="button" onClick={csv}>
            Download these values (CSV)
          </button>
          <Go to={{ v: "map", mm: "alcohol_per_adult", bv: "wine", y: y1 }} reset>
            Every state on the map: wine, {y1}
          </Go>
          <Go to={{ v: "change" }} reset>
            Before & after: Tennessee's 2016 grocery-store wine
          </Go>
        </div>
      </section>

      <section className="panel" aria-labelledby="bev-share-h">
        <h3 id="bev-share-h">Each beverage's share of the pure alcohol</h3>
        <p className="small muted">Shares of beer + wine + spirits in {y0} and {y1}. A shift in shares can come from one beverage growing or from the others shrinking.</p>
        {shownGeos.map((g) => (
          <div key={g} className="share-group">
            <div className="share-name">{name(g)}</div>
            {[y0, y1].map((y) => {
              const s = sharesOf(at(g, y));
              return (
                <div key={y} className="share-row">
                  <span className="share-year">{y}</span>
                  {s ? (
                    <>
                      <span className="share-bar" aria-hidden="true">
                        {BEVERAGES.map((b) => (
                          <span key={b.key} className={`share-seg bev-${b.key}`} style={{ width: `${s[b.key]}%` }} title={`${b.label} ${s[b.key].toFixed(1)}%`} />
                        ))}
                      </span>
                      <span className="share-text">{BEVERAGES.map((b) => `${b.label} ${s[b.key].toFixed(0)}%`).join(" · ")}</span>
                    </>
                  ) : (
                    <span className="muted">Not all three beverages have a value this year.</span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        <div className="legend">
          {BEVERAGES.map((b) => (
            <span className="item" key={b.key}>
              <span className={`sw bev-${b.key}`} aria-hidden="true" /> {b.label}
            </span>
          ))}
        </div>
        <details>
          <summary>Year-by-year values for {name(geo)}</summary>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th scope="col">Year</th>
                  {BEVERAGES.map((b) => (
                    <th scope="col" className="num" key={b.key}>
                      {b.label}
                    </th>
                  ))}
                  <th scope="col" className="num">
                    All beverages (published)
                  </th>
                  <th scope="col" className="num">
                    Wine share
                  </th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: y1 - y0 + 1 }, (_, i) => y1 - i).map((y) => {
                  const v = at(geo, y);
                  const rec = recAt(ALL_PER_ADULT, geo, y);
                  return (
                    <tr key={y}>
                      <th scope="row">{y}</th>
                      {BEVERAGES.map((b) => {
                        const r = recAt(b.perAdult, geo, y);
                        return (
                          <td className="num" key={b.key}>
                            {r ? <RecordLink rec={r}>{gal(v[b.key])}</RecordLink> : "—"}
                          </td>
                        );
                      })}
                      <td className="num">{rec ? <RecordLink rec={rec}>{gal(valueAt(ALL_PER_ADULT, geo, y))}</RecordLink> : "—"}</td>
                      <td className="num">{sharesOf(v) ? `${sharesOf(v)!.wine.toFixed(1)}%` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
        <SourceNote ids={niaaaIds} derived />
      </section>

      <DabsSection idx={idx.data} monthly={monthlyIdx.data.series} lookup={lookup} niaaaIds={niaaaIds} gallons={(b) => valueAt(BEVERAGES.find((x) => x.key === b)!.gallons, "state:49", metaOf(BEVERAGES[0].gallons).last_year)} niaaaYear={metaOf(BEVERAGES[0].gallons).last_year} />
    </>
  );
}

/** Utah only: DABS gross sales or 9-liter cases by beverage, month by month, and the FY2026 mix. */
function DabsSection({
  idx,
  monthly,
  lookup,
  niaaaIds,
  gallons,
  niaaaYear,
}: {
  idx: MetricsIndex;
  monthly: MonthlyMeta[];
  lookup: Parameters<typeof metricSourceIds>[2];
  niaaaIds: string[];
  gallons: (b: BevKey) => number | null;
  niaaaYear: number;
}) {
  const params = useParams();
  const cases = params.get("du") === "cases";
  const prefix = cases ? "ut_dabs_monthly_cases_9l_" : "ut_dabs_monthly_gross_sales_";
  const fyPrefix = cases ? "ut_dabs_fy_cases_9l_" : "ut_dabs_fy_gross_sales_";
  const metas = DABS_GROUPS.map((g) => monthly.find((s) => s.measure_id === `${prefix}${g}`));
  const fyMetas = DABS_GROUPS.map((g) => idx.metrics.find((m) => m.metric_id === `${fyPrefix}${g}@state_fiscal_year`));
  const caseMetas = (["beer", "wine", "spirits"] as const).map((g) => idx.metrics.find((m) => m.metric_id === `ut_dabs_fy_cases_9l_${g}@state_fiscal_year`));
  const ok = metas.every(Boolean) && fyMetas.every(Boolean) && caseMetas.every(Boolean);
  const files = useMany<MonthlyFile>(ok ? metas.map((m) => m!.file) : []);
  const fyFiles = useMany<MetricFile>(ok ? [...fyMetas, ...caseMetas].map((m) => m!.file) : []);
  if (!ok) return <section className="panel"><p className="small muted">The DABS monthly reports are not in this build.</p></section>;
  if (files.error || fyFiles.error) return <ErrorNote error={(files.error ?? fyFiles.error)!} />;
  if (!files.data || !fyFiles.data || files.data.length !== metas.length) return <Loading what="Utah state-store sales" />;
  const dabsIds = [...new Set(metas.flatMap((m) => monthlySourceIds(m!, lookup)))];

  const unit = cases ? "nine_liter_cases" : "usd_nominal";
  const fmt = (v: number | null | undefined) => (v === null || v === undefined ? "—" : cases ? `${Math.round(v).toLocaleString("en-US")} cases` : formatValue(v, "usd_nominal"));
  const byGroup = new Map<DabsGroup, Map<string, { v: number | null }>>();
  DABS_GROUPS.forEach((g, i) => {
    const f = files.data![i];
    const c = Object.fromEntries(f.columns.map((k, j) => [k, j]));
    byGroup.set(g, new Map(f.rows.filter((r) => r[c.geo_id] === "state:49").map((r) => [String(r[c.period_label]).slice(0, 7), { v: r[c.value] as number | null }])));
  });
  const months = [...new Set([...byGroup.values()].flatMap((m) => [...m.keys()]))].sort();
  const lineGroups: DabsGroup[] = ["spirits", "wine", "beer", "premixed", "cider"];
  const chartRows = months.map((m) => ({ month: m, ...Object.fromEntries(lineGroups.map((g) => [g, byGroup.get(g)!.get(m)?.v ?? null])) }));
  const changes = new Map(DABS_GROUPS.map((g) => [g, sameMonthChanges(new Map([...byGroup.get(g)!.entries()].map(([k, x]) => [k, x.v])))]));
  const compared = changes.get("total")!.map((c) => c.month);

  const fy: Record<string, DecodedMetric> = Object.fromEntries([...fyMetas, ...caseMetas].map((m, i) => [m!.metric_id, decodeMetric(fyFiles.data![i])]));
  const fyObs = (metricId: string) => fy[metricId]?.obs.find((o) => o.geo_id === "state:49" && o.value !== null);
  const fyYears = [...new Set(fyMetas.flatMap((m) => fy[m!.metric_id].obs.map((o) => o.year)))].sort();
  const fyYear = fyYears[fyYears.length - 1];
  const totalFy = fyObs(`${fyPrefix}total@state_fiscal_year`);
  const groupFy = DABS_GROUPS.filter((g) => g !== "total").map((g) => ({ g, o: fyObs(`${fyPrefix}${g}@state_fiscal_year`) }));
  const fyMax = Math.max(...groupFy.map((x) => x.o?.value ?? 0));
  const caseGallons = (b: BevKey) => {
    const o = fyObs(`ut_dabs_fy_cases_9l_${b}@state_fiscal_year`);
    return o?.value == null ? null : o.value * GALLONS_PER_9L_CASE;
  };
  const scaleMax = Math.max(...(["beer", "wine", "spirits"] as BevKey[]).flatMap((b) => [gallons(b) ?? 0, caseGallons(b) ?? 0]));

  return (
    <section className="panel" aria-labelledby="dabs-h">
      <h3 id="dabs-h">Utah only: what the state liquor stores sold, by beverage</h3>
      <p className="small">
        Utah's Department of Alcoholic Beverage Services (DABS) publishes a sales report every month, product by product. The dataset holds{" "}
        {months.length} months, {months[0]} to {months[months.length - 1]}. These are <strong>state-store sales</strong>: not all alcohol sold in
        Utah, not tax revenue and not the state's profit. Most beer in Utah is sold by private grocery and convenience stores and is not in these
        reports; the beer here is the stronger beer and malt drinks sold by the state. Gross sales are DABS's shelf prices times bottles sold (checked product by
        product); DABS does not say whether its shelf prices include sales tax, or how much went to restaurants and bars rather than shoppers.
      </p>
      <fieldset className="radios">
        <legend>Show</legend>
        <label className="check">
          <input type="radio" name="du" checked={!cases} onChange={() => navigate({ du: null })} /> Gross sales (dollars)
        </label>
        <label className="check">
          <input type="radio" name="du" checked={cases} onChange={() => navigate({ du: "cases" })} /> Volume (9-liter cases)
        </label>
      </fieldset>

      <h4>
        Fiscal year {fyYear} (July {fyYear - 1} to June {fyYear}), the one complete year held
      </h4>
      <div className="bars-c">
      <ul className="plain-bars">
        {groupFy.map(({ g, o }) => (
          <li key={g}>
            <div className="dabs-row">
              <span className="rank-name">{DABS_LABELS[g]}</span>
              <span className="rank-track" aria-hidden="true">
                {o?.value != null && <span className={`rank-bar dabs-${g}`} style={{ width: `${Math.max(0.5, (100 * o.value) / (fyMax || 1))}%` }} />}
              </span>
              <span className="rank-value">
                {o ? <RecordLink rec={`obs:${fyPrefix}${g}@state_fiscal_year:${o.observation_id}`}>{fmt(o.value)}</RecordLink> : "—"}
                {o?.value != null && totalFy?.value ? ` (${((100 * o.value) / totalFy.value).toFixed(1)}%)` : ""}
              </span>
            </div>
          </li>
        ))}
      </ul>
      </div>
      <p className="small muted">
        All products: {fmt(totalFy?.value)}, the sum of the twelve monthly reports. Each report's product rows add up exactly to its printed total.
      </p>
      <SourceNote ids={dabsIds} derived>
        Products are grouped into beverage types by the dataset's class map, following DABS's own class names.
      </SourceNote>

      <h4>Month by month</h4>
      <div className="chart-box" style={{ height: 260 }} aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartRows} margin={{ top: 12, right: 16, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="2 3" />
            <XAxis dataKey="month" />
            <YAxis tickFormatter={(v: number) => formatAxis(v, unit)} width={72} />
            <Tooltip formatter={(v: unknown, k: unknown) => [fmt(v as number), DABS_LABELS[k as DabsGroup]]} />
            {lineGroups.map((g, i) => (
              <Line key={g} dataKey={g} stroke={SERIES_COLORS[i % SERIES_COLORS.length]} strokeWidth={2} dot={{ r: 2.5 }} connectNulls={false} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="legend">
        {lineGroups.map((g, i) => (
          <span className="item" key={g}>
            <span className="sw" style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} aria-hidden="true" /> {DABS_LABELS[g]}
          </span>
        ))}
      </div>
      <SourceNote ids={dabsIds} />

      {compared.length > 0 && (
        <>
          <h4>Change from the same month a year earlier</h4>
          <p className="small muted">Only months whose year-earlier report is also held ({compared.join(", ")}). Monthly sales swing with holidays and the number of weekends, so a single month is a weak signal.</p>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th scope="col">Month</th>
                  {DABS_GROUPS.filter((g) => g !== "other").map((g) => (
                    <th scope="col" className="num" key={g}>
                      {DABS_LABELS[g]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {compared.map((m) => (
                  <tr key={m}>
                    <th scope="row">{m}</th>
                    {DABS_GROUPS.filter((g) => g !== "other").map((g) => {
                      const c = changes.get(g)!.find((x) => x.month === m);
                      return (
                        <td className="num" key={g} title={c ? `${c.earlier}: ${fmt(c.before)}; ${m}: ${fmt(c.now)}` : undefined}>
                          {c ? pct(c.pct) : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <SourceNote ids={dabsIds} derived />
        </>
      )}

      <h4>For scale: state-store volume next to all alcohol shipped into Utah</h4>
      <p className="small muted">
        Gallons of beverage (not pure alcohol). NIAAA's apparent consumption for calendar {niaaaYear} counts beer, wine and spirits sold in Utah by
        anyone; DABS's fiscal-year {fyYear} volume is what the state stores sold (9-liter cases × 2.378 gallons). Different periods and methods, so
        this is for scale only and is not a market share. NIAAA may count cider with wine and premixed drinks with spirits; DABS lists them apart and
        they are left out here.
      </p>
      <div className="bars-c">
        {(["beer", "wine", "spirits"] as BevKey[]).map((b) => {
          const n = gallons(b);
          const d = caseGallons(b);
          return (
            <div key={b} className="scale-group">
              <div className="share-name">{BEVERAGES.find((x) => x.key === b)!.label}</div>
              <div className="scale-row">
                <span className="scale-label">All sold in Utah (NIAAA, {niaaaYear})</span>
                <span className="rank-track" aria-hidden="true">
                  {n !== null && <span className="rank-bar scale-niaaa" style={{ width: `${(100 * n) / (scaleMax || 1)}%` }} />}
                </span>
                <span className="rank-value">{n === null ? "no value" : `${millions(n)} gal`}</span>
              </div>
              <div className="scale-row">
                <span className="scale-label">State stores (DABS, FY{fyYear})</span>
                <span className="rank-track" aria-hidden="true">
                  {d !== null && <span className="rank-bar scale-dabs" style={{ width: `${Math.max(0.5, (100 * d) / (scaleMax || 1))}%` }} />}
                </span>
                <span className="rank-value">{d === null ? "no value" : `${millions(d)} gal`}</span>
              </div>
            </div>
          );
        })}
      </div>
      <SourceNote ids={[...dabsIds, ...niaaaIds]}>
        State-store gallons computed by this project from the cases (9 liters = 2.378 U.S. gallons).
      </SourceNote>
      <p className="small">
        Why the beer bars differ so much: Utah's grocery and convenience stores sell most of the state's beer, and their sales are not in DABS's
        reports. Grocery stores may not sell wine under an ordinary license (verified in the dataset from 2003 on), and under current law state
        stores and contract package agencies are the outlets for spirits (a dated snapshot, not a history), which is why the wine and spirits bars
        are much closer. See{" "}
        <Go to={{ v: "fiscal" }} reset>
          revenue by state
        </Go>{" "}
        for what the state collects from each channel.
      </p>
      <p className="small">
        <strong>Law sources:</strong>{" "}
        <Go to={{ v: "timeline", geo: "state:49", dim: "ordinary_grocery_wine_authorization" }} reset>
          Utah grocery-store wine, with the statute text for each day
        </Go>
        ;{" "}
        <Go to={{ v: "timeline", geo: "state:49", dim: "spirits_off_premise_retail_system" }} reset>
          who sells spirits in Utah, with the cited Utah Code sections
        </Go>
        .
      </p>
    </section>
  );
}
