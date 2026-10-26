// View 4 — Revenue and consumption trends for one state. Fiscal components stay separate (no total),
// conversions are offered only where their inputs exist, and different units get different panels.
import { useState } from "react";
import { Empty, ErrorNote, Go, Loading, RecordLink } from "../components/common";
import { TrendChart, type ChartSeries } from "../components/TrendChart";
import { downloadBundle, type ObsRow } from "../lib/bundle";
import { panelKey } from "../lib/compare";
import { decodeMetric, load, useData, useMany } from "../lib/data";
import { CONVERSION_LABELS, PERIOD_KIND_LABELS, formatValue, geoName, unitLabel, words } from "../lib/format";
import { percentChange, undefinedReason } from "../lib/formulas";
import { buildSeries, policyAnnotations, type Shown } from "../lib/series";
import type { Coverage, Geography, Manifest, MetricFile, MetricMeta, MetricsIndex, PolicyData, SourcesData } from "../lib/types";
import { navigate, pickInt, pickList, pickOne, useParams } from "../lib/url";

const SHOWN: Shown[] = ["nominal", "real_cy2024", "per_resident", "per_resident_21plus", "index"];
const COMPONENT_LABELS: Record<string, string> = {
  tax: "Alcohol taxes",
  license: "Alcohol licenses",
  enterprise_gross_sales: "State-store sales (commercial turnover — not government revenue)",
  enterprise_gross_profit: "State-store gross profit and revenue",
  enterprise_other_income: "State-store other income",
  enterprise_expense: "State-store expenses",
  enterprise_net_income: "State-store operating income",
  enterprise_nonoperating: "State-store non-operating items",
  enterprise_net_transfer: "State-store profit transferred to the General Fund",
  earmarked_transfer: "Earmarked transfers from state-store revenue",
  sales_tax_on_enterprise_sales: "Sales tax reported on state-store sales",
  context_total: "Context totals (all state taxes, or several alcohol accounts together)",
};
const CONSUMPTION = [
  "niaaa_ethanol_per_capita_21plus_all@calendar_year",
  "niaaa_ethanol_per_capita_21plus_wine@calendar_year",
];
const BEHAVIOR = [
  "brfss_drank_any_past_month_question_pct@survey_year",
  "brfss_drank_any_past_30d_pct@survey_year",
  "brfss_binge_5plus_any_sex_pct@survey_year",
  "brfss_binge_5m_4f_pct@survey_year",
];

export function RevenueView() {
  const params = useParams();
  const idx = useData<MetricsIndex>("metrics.json");
  const cov = useData<Coverage>("coverage.json");
  const geos = useData<Geography[]>("geographies.json");
  const pol = useData<PolicyData>("policy.json");
  const states = (geos.data ?? []).filter((g) => g.geo_level === "state");
  const geo = pickOne(params.get("geo"), states.map((g) => g.geo_id), "state:49");
  const fiscal = (idx.data?.metrics ?? []).filter(
    (m) => m.family === "fiscal" && m.method_family !== "derived" && cov.data?.metrics[m.metric_id]?.rows[geo],
  );
  const defaults =
    geo === "state:49"
      ? ["stc_alcoholic_beverages_sales_tax@state_fiscal_year", "ut_dabs_net_profit_general_fund@state_fiscal_year", "ut_dabs_gross_profit@state_fiscal_year"]
      : ["stc_alcoholic_beverages_sales_tax@state_fiscal_year", "stc_alcoholic_beverages_license_tax@state_fiscal_year"];
  const ms =
    params.get("ms") === "none"
      ? []
      : pickList(params.get("ms"), fiscal.map((m) => m.metric_id), 8, defaults.filter((d) => fiscal.some((m) => m.metric_id === d)));
  const shown = pickOne(params.get("tf"), SHOWN, "nominal");
  const y0 = pickInt(params.get("y0"), 1942, 2026, 2005);
  const y1 = pickInt(params.get("y1"), y0, 2026, 2025);
  const base = pickInt(params.get("base"), y0, y1, Math.min(Math.max(2016, y0), y1));
  const cf = pickInt(params.get("cf"), y0, y1, y0);
  const ct = pickInt(params.get("ct"), y0, y1, y1);
  const showCons = params.get("cons") !== "0";
  const showBeh = params.get("beh") !== "0";
  const metas = (idx.data?.metrics ?? []).filter((m) => ms.includes(m.metric_id));
  const extra = (idx.data?.metrics ?? []).filter(
    (m) => (showCons && CONSUMPTION.includes(m.metric_id)) || (showBeh && BEHAVIOR.includes(m.metric_id)),
  );
  const files = useMany<MetricFile>([...metas, ...extra].map((m) => m.file));
  const err = idx.error ?? cov.error ?? geos.error ?? pol.error ?? files.error;
  if (err) return <ErrorNote error={err} />;
  if (!idx.data || !cov.data || !geos.data || !pol.data) return <Loading what="revenue data" />;

  const byComponent = new Map<string, MetricMeta[]>();
  for (const m of fiscal) {
    const k = m.fiscal_component ?? "other";
    byComponent.set(k, [...(byComponent.get(k) ?? []), m]);
  }
  const decoded = files.data ? files.data.map(decodeMetric) : [];
  const decOf = (m: MetricMeta) => decoded[[...metas, ...extra].indexOf(m)];
  const fiscalBuilt = files.data ? metas.map((m) => ({ meta: m, built: buildSeries(m, decOf(m), geo, shown, idx.data!, base) })) : [];
  const panels = new Map<string, { unit: string; period_kind: string; items: typeof fiscalBuilt }>();
  for (const f of fiscalBuilt) {
    if (f.built.unavailable) continue;
    const key = panelKey({ unit: f.built.unit, period_kind: f.meta.period_kind, age_universe: f.meta.age_universe });
    const p = panels.get(key) ?? { unit: f.built.unit, period_kind: f.meta.period_kind, items: [] };
    p.items.push(f);
    panels.set(key, p);
  }
  const rangeEvents = pol.data.events;
  const fyAnn = policyAnnotations(rangeEvents, geo, "state_fiscal_year", idx.data.fiscal_year_rules, [y0, y1]);
  const calAnn = policyAnnotations(rangeEvents, geo, "calendar_year", idx.data.fiscal_year_rules, [y0, y1]);
  const allRows: ObsRow[] = fiscalBuilt.flatMap((f) => f.built.rows.filter((r) => r.obs.year >= y0 && r.obs.year <= y1));
  const toggle = (id: string) => navigate({ ms: (ms.includes(id) ? ms.filter((x) => x !== id) : [...ms, id]).join(",") || "none" });
  const extraBuilt = files.data ? extra.map((m) => ({ meta: m, built: buildSeries(m, decOf(m), geo, "nominal", idx.data!) })) : [];

  return (
    <div className="layout-split">
      <section className="panel" aria-labelledby="rev-h">
        <h2 id="rev-h">Revenue and consumption trends — {geoName(geo, geos.data)}</h2>
        <div className="note">
          Descriptive only. A line rising or falling after a policy change does not show the policy caused it: taxes,
          prices, tourism, the pandemic and other laws change at the same time. Each component is a different kind of
          money; they overlap and are never added into a total here.
        </div>
        <div className="controls">
          <label>
            State
            <select value={geo} onChange={(e) => navigate({ geo: e.target.value, ms: null })}>
              {states.map((g) => (
                <option key={g.geo_id} value={g.geo_id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Show values as
            <select value={shown} onChange={(e) => navigate({ tf: e.target.value === "nominal" ? null : e.target.value })}>
              {SHOWN.map((s) => (
                <option key={s} value={s}>
                  {CONVERSION_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          {shown === "index" && (
            <label>
              Base year
              <input type="number" value={base} min={y0} max={y1} onChange={(e) => navigate({ base: e.target.value }, { replace: true })} />
            </label>
          )}
          <label>
            From
            <input type="number" value={y0} min={1942} max={y1} onChange={(e) => navigate({ y0: e.target.value }, { replace: true })} />
          </label>
          <label>
            To
            <input type="number" value={y1} min={y0} max={2026} onChange={(e) => navigate({ y1: e.target.value }, { replace: true })} />
          </label>
        </div>
        {shown !== "nominal" && <ConversionNote shown={shown} idx={idx.data} base={base} />}
        {files.loading && <Loading what="series" />}
        {fiscalBuilt
          .filter((f) => f.built.unavailable)
          .map((f) => (
            <p className="warn small" key={f.meta.metric_id}>
              <strong>{f.meta.label}</strong> is not shown as {CONVERSION_LABELS[shown].toLowerCase()}: {f.built.unavailable}
            </p>
          ))}
        {metas.length === 0 && <Empty>Select at least one fiscal component on the right.</Empty>}
        {[...panels.values()].map((p, i) => {
          const series: ChartSeries[] = p.items.map((f) => ({ key: f.meta.metric_id, label: seriesLabel(f.meta), points: f.built.points }));
          return (
            <div key={i}>
              <h3>
                {unitLabel(p.unit)} · {PERIOD_KIND_LABELS[p.period_kind]}
              </h3>
              <TrendChart series={series} unit={p.unit} domain={[y0, y1]} annotations={p.period_kind === "state_fiscal_year" ? fyAnn : calAnn} title={`${geoName(geo, geos.data!)} fiscal components`} />
              <ValueTable items={p.items.map((f) => ({ meta: f.meta, rows: f.built.rows }))} unit={p.unit} y0={y0} y1={y1} />
              <ChangeReadout items={p.items.map((f) => ({ meta: f.meta, rows: f.built.rows }))} cf={cf} ct={ct} y0={y0} y1={y1} />
            </div>
          );
        })}
        {fyAnn.some((a) => a.kind === "transition") && (
          <p className="small muted">
            Shaded years are transition periods: the change took effect part-way through the fiscal year, so that year mixes
            both regimes. Values are never prorated.
          </p>
        )}
        {(showCons || showBeh) && files.data && (
          <>
            <h3>Consumption and drinking (not revenue)</h3>
            <p className="small muted">
              Apparent consumption is gallons of ethanol sold per resident 21+, by calendar year; it includes visitors'
              purchases and stock changes. Drinking prevalence is the share of adults 18+ who report drinking, by survey
              year, with 95% confidence bands; BRFSS changed method in 2011 and redefined measures, so lines break there.
              They are different measures and are drawn in separate panels.
            </p>
            {showCons && (
              <TrendChart
                series={extraBuilt.filter((e) => CONSUMPTION.includes(e.meta.metric_id)).map((e) => ({ key: e.meta.metric_id, label: e.meta.label, points: e.built.points }))}
                unit="us_gallons_ethanol_per_person"
                domain={[y0, y1]}
                annotations={calAnn}
                title="Apparent consumption"
              />
            )}
            {showBeh && (
              <TrendChart
                series={extraBuilt.filter((e) => BEHAVIOR.includes(e.meta.metric_id)).map((e) => ({ key: e.meta.metric_id, label: e.meta.label, points: e.built.points }))}
                unit="percent"
                domain={[y0, y1]}
                annotations={calAnn}
                title="Drinking prevalence"
              />
            )}
            <ValueTable items={extraBuilt.map((e) => ({ meta: e.meta, rows: e.built.rows }))} unit="" y0={y0} y1={y1} perMetricUnit />
          </>
        )}
        <DownloadRows
          rows={[...allRows, ...extraBuilt.flatMap((e) => e.built.rows.filter((r) => r.obs.year >= y0 && r.obs.year <= y1))]}
          name={`revenue_${geo.replace(":", "")}_${y0}_${y1}`}
          title={`Revenue and consumption, ${geoName(geo, geos.data)}, ${y0}-${y1}`}
          filters={{ view: "revenue", geo, metrics: ms.join("|"), shown, base: String(base), years: `${y0}-${y1}` }}
        />
      </section>
      <aside className="detail" aria-label="Series selection">
        <div className="panel">
          <h3>Fiscal components</h3>
          <p className="small muted">Only components this dataset holds for {geoName(geo, geos.data)} are listed.</p>
          {[...byComponent.entries()].map(([k, list]) => (
            <fieldset key={k} style={{ marginBottom: 8 }}>
              <legend>{COMPONENT_LABELS[k] ?? words(k)}</legend>
              <div className="checks">
                {list.map((m) => (
                  <label key={m.metric_id}>
                    <input type="checkbox" checked={ms.includes(m.metric_id)} onChange={() => toggle(m.metric_id)} />
                    <span>
                      {m.label}
                      <span className="why">
                        {words(m.government_level)} · {words(m.accounting_basis)} · {m.beverage === "all_alcohol" ? "all beverages" : words(m.beverage)}
                        {m.costs_subtracted ? " · after costs" : ""}
                        {m.overlap_note ? ` · ${m.overlap_note}` : ""}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <div className="checks" style={{ marginTop: 8 }}>
            <label>
              <input type="checkbox" checked={showCons} onChange={() => navigate({ cons: showCons ? "0" : null })} /> Apparent consumption panel
            </label>
            <label>
              <input type="checkbox" checked={showBeh} onChange={() => navigate({ beh: showBeh ? "0" : null })} /> Drinking prevalence panel
            </label>
          </div>
        </div>
        <div className="panel">
          <h3>Not available here</h3>
          <ul className="small source-list">
            <li>Wine-only receipts: only Tennessee's wine tax account (FY2010-FY2017, every sales channel); none for other states, and none for food stores.</li>
            <li>General sales tax attributable to alcohol: not reported by the sources held.</li>
            <li>Local (city or county) receipts: not collected.</li>
            <li>A reconciled total: the components overlap; see the overlap notes.</li>
          </ul>
          <p className="small">
            <Go to={{ v: "coverage", fam: "fiscal" }} reset>
              Fiscal coverage and research queue
            </Go>
          </p>
        </div>
      </aside>
    </div>
  );
}

function seriesLabel(m: MetricMeta) {
  return m.label;
}

function ConversionNote({ shown, idx, base }: { shown: Shown; idx: MetricsIndex; base: number }) {
  if (shown === "index") {
    return (
      <p className="note small">
        Index = 100 × value ÷ value in {base}, per series, on nominal values. Undefined (gap) when the {base} value is
        missing or zero.
      </p>
    );
  }
  return (
    <p className="note small">
      {idx.conversion_methods[shown as keyof MetricsIndex["conversion_methods"]]}. Fiscal years keep their own months:
      the deflator is the CPI-U average of the fiscal year's 12 months; the denominator is the Census July 1 estimate
      inside the fiscal year (ages 21+ exist from 2000 only).
    </p>
  );
}

function ValueTable({
  items,
  unit,
  y0,
  y1,
  perMetricUnit = false,
}: {
  items: { meta: MetricMeta; rows: ObsRow[] }[];
  unit: string;
  y0: number;
  y1: number;
  perMetricUnit?: boolean;
}) {
  const years = [...new Set(items.flatMap((i) => i.rows.map((r) => r.obs.year)))].filter((y) => y >= y0 && y <= y1).sort((a, b) => a - b);
  if (!items.length) return null;
  return (
    <details>
      <summary>Table of these values ({years.length} periods)</summary>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Year</th>
              {items.map((i) => (
                <th key={i.meta.metric_id}>
                  {i.meta.label}
                  {perMetricUnit && <div className="small muted">{unitLabel(i.meta.unit)}</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {years.map((y) => (
              <tr key={y}>
                <th scope="row">{y}</th>
                {items.map((i) => {
                  const r = i.rows.find((x) => x.obs.year === y);
                  if (!r) return <td key={i.meta.metric_id} className="muted">no record</td>;
                  const v = r.shown?.value ?? null;
                  const u = perMetricUnit ? i.meta.unit : unit;
                  return (
                    <td key={i.meta.metric_id} className="num">
                      <RecordLink rec={`obs:${i.meta.metric_id}:${r.obs.observation_id}`}>
                        {v === null ? `— ${words(r.shown?.missing ?? r.obs.missing_reason)}` : formatValue(v, u)}
                      </RecordLink>
                      <div className="small muted">
                        {r.obs.period_label}
                        {r.obs.cell === "U" ? " · unreviewed" : ""}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function ChangeReadout({ items, cf, ct, y0, y1 }: { items: { meta: MetricMeta; rows: ObsRow[] }[]; cf: number; ct: number; y0: number; y1: number }) {
  return (
    <div className="small" style={{ margin: "6px 0 14px" }}>
      <span className="controls" style={{ display: "inline-flex", margin: 0 }}>
        <label>
          Percent change from
          <input type="number" value={cf} min={y0} max={y1} onChange={(e) => navigate({ cf: e.target.value }, { replace: true })} />
        </label>
        <label>
          to
          <input type="number" value={ct} min={y0} max={y1} onChange={(e) => navigate({ ct: e.target.value }, { replace: true })} />
        </label>
      </span>
      <ul className="source-list">
        {items.map((i) => {
          const a = i.rows.find((r) => r.obs.year === cf)?.shown?.value;
          const b = i.rows.find((r) => r.obs.year === ct)?.shown?.value;
          const pc = percentChange(a, b);
          return (
            <li key={i.meta.metric_id}>
              {i.meta.label}: {pc === undefined ? `undefined — ${undefinedReason(a, b)}` : `${pc >= 0 ? "+" : ""}${pc.toFixed(1)}%`}{" "}
              <span className="muted">(100 × (later − earlier) ÷ earlier; a description, not an effect)</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function DownloadRows({ rows, name, title, filters, notes }: { rows: ObsRow[]; name: string; title: string; filters: Record<string, string>; notes?: string[] }) {
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try {
      const [geos, sources, man] = await Promise.all([
        load<Geography[]>("geographies.json"),
        load<SourcesData>("sources.json"),
        load<Manifest>("manifest.json"),
      ]);
      downloadBundle({ name, title, rows, geos, sources, manifest: man, filters, notes });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="row-actions">
      <button type="button" className="primary" onClick={go} disabled={busy || rows.length === 0}>
        {busy ? "Preparing…" : `Download the ${rows.length} values shown (CSV bundle)`}
      </button>
    </div>
  );
}
