// View 3 — State comparison. State-level only. For each panel, a table of the selected states' values for
// one year and an availability table saying why each comparison holds, is limited, or is disabled.
import { Empty, ErrorNote, Go, Loading, RecordLink } from "../components/common";
import { TrendChart } from "../components/TrendChart";
import type { ObsRow } from "../lib/bundle";
import { compatible, type Series } from "../lib/compare";
import { decodeMetric, useData, useMany, type DecodedMetric } from "../lib/data";
import { PERIOD_KIND_LABELS, formatValue, geoName, unitLabel, words } from "../lib/format";
import { buildSeries } from "../lib/series";
import { pairwiseContrasts, seFromInterval } from "../lib/stats";
import type { CaseStudy, Coverage, Geography, MetricMeta, MetricsIndex, MetricFile, PolicyData, Research } from "../lib/types";
import { navigate, pickInt, pickList, useParams } from "../lib/url";
import { DownloadRows } from "./RevenueView";

const STORE_REVENUE = "census_liquor_stores_revenue@state_fiscal_year";

/** State liquor-store money for one state and year: the state's own accounts (Utah's DABS reports) and
 * the Census value for that fiscal year, if any. */
interface StoreMoney {
  own: boolean;
  /** none_listed: the Census files cover the year but list no item for this state government (no value, not a zero). */
  census: "positive" | "zero" | "none_listed" | "unknown";
  span: string;
}

interface PanelDef {
  id: string;
  title: string;
  metrics: string[];
  note: string;
  gap?: string;
  policy?: string[];
}

const PANELS: PanelDef[] = [
  {
    id: "population",
    title: "Population and age",
    metrics: ["pop_total_resident@point_in_time", "pop_age21plus_resident@point_in_time", "pop_age18plus_resident@point_in_time"],
    note: "Census July 1 estimates. Ages 18+ and 21+ exist from 2000.",
  },
  {
    id: "income",
    title: "Income",
    metrics: ["bea_per_capita_personal_income@calendar_year"],
    note: "BEA per capita personal income, current dollars (not adjusted for prices). Each BEA release revises earlier years; this is the September 2026 release.",
  },
  {
    id: "business",
    title: "Alcohol retail and drinking places (private establishments)",
    metrics: [
      "cbp_establishments_naics_445310@calendar_year",
      "cbp_establishments_naics_722410@calendar_year",
      "cbp_establishments_naics_445110@calendar_year",
    ],
    note: "County Business Patterns counts private employers only. State-run liquor stores are not in the liquor-store count, and grocery stores that sell alcohol are counted as grocery stores, so the counts are not numbers of alcohol outlets.",
  },
  {
    id: "behavior",
    title: "Drinking prevalence (adults 18+, survey estimates)",
    metrics: ["brfss_drank_any_past_30d_pct@survey_year", "brfss_binge_5m_4f_pct@survey_year", "brfss_heavy_14m_7f_per_week_pct@survey_year"],
    note: "Share of adults reporting the behavior, with 95% confidence intervals. The table tests each gap between states against sampling noise (not by whether the intervals overlap, which is not a test) and says where a gap is within it.",
  },
  {
    id: "youth",
    title: "Youth drinking (high school students, YRBS)",
    metrics: ["yrbs_current_alcohol_use_hs_pct@survey_year", "yrbs_first_drink_before_13_hs_pct@survey_year"],
    note: "School-based survey of grades 9-12, odd years 1991-2017; a state appears only in years it ran a survey with weighted results. Not comparable with the adult BRFSS figures.",
  },
  {
    id: "safety",
    title: "Traffic deaths (FARS)",
    metrics: ["fars_traffic_fatalities@calendar_year", "fars_alcohol_impaired_driving_fatalities@calendar_year"],
    note: "Deaths in the state where the crash happened. Alcohol-impaired driving means a driver at .08 g/dL or more, using NHTSA's imputed BACs; it does not say alcohol caused the crash. Counts, not rates: divide by population before comparing states.",
  },
  {
    id: "consumption",
    title: "Apparent consumption (gallons of ethanol per resident 21+)",
    metrics: [
      "niaaa_ethanol_per_capita_21plus_all@calendar_year",
      "niaaa_ethanol_per_capita_21plus_wine@calendar_year",
      "niaaa_ethanol_per_capita_21plus_beer@calendar_year",
      "niaaa_ethanol_per_capita_21plus_spirits@calendar_year",
    ],
    note: "Sales-based; includes visitors' purchases, cross-border buying and stock changes. Not the same as drinking prevalence.",
  },
  {
    id: "fiscal",
    title: "Fiscal outcomes",
    metrics: [
      "stc_alcoholic_beverages_sales_tax_per_capita@state_fiscal_year",
      "stc_alcoholic_beverages_sales_tax_per_resident_21plus@state_fiscal_year",
      "stc_alcoholic_beverages_license_tax@state_fiscal_year",
      STORE_REVENUE,
    ],
    note: "Census T10 is alcohol selective sales taxes; it excludes the profits of state-run liquor stores, so it measures different things in states that sell liquor themselves. State liquor-store receipts (Census A90, FY1972 and FY1977-FY2024) are what a state monopoly took in, wholesale or retail: not a profit, not total alcohol sales, and not a sign of who runs the retail stores.",
  },
  {
    id: "retail",
    title: "Retail structure (coded law)",
    metrics: [],
    policy: ["ordinary_grocery_wine_authorization", "state_contract_package_agency_channel", "beer_definition_max_alcohol"],
    note: "Status on July 1 of the selected year, from verified day runs only. History is verified for Utah, Kentucky and Virginia and anchored for single days in Tennessee and Arkansas; other states have dated snapshots, which are not history and are not shown here.",
    gap: "gap_comparison_policy_status",
  },
  { id: "tourism", title: "Tourism", metrics: [], note: "No tourism measure is loaded yet.", gap: "gap_tourism" },
];

export function CompareView() {
  const params = useParams();
  const idx = useData<MetricsIndex>("metrics.json");
  const cov = useData<Coverage>("coverage.json");
  const geos = useData<Geography[]>("geographies.json");
  const pol = useData<PolicyData>("policy.json");
  const res = useData<Research>("research.json");
  const cases = useData<{ cases: CaseStudy[] }>("cases.json");
  const states = (geos.data ?? []).filter((g) => g.geo_level === "state");
  const st = pickList(params.get("st"), states.map((g) => g.geo_id), 6, ["state:49", "state:47"]);
  const year = pickInt(params.get("y"), 1990, 2026, 2019);
  const chart = params.get("cm");
  const metas = PANELS.flatMap((p) => p.metrics)
    .map((id) => idx.data?.metrics.find((m) => m.metric_id === id))
    .filter((m): m is MetricMeta => Boolean(m));
  const files = useMany<MetricFile>(idx.data ? metas.map((m) => m.file) : []);
  const err = idx.error ?? cov.error ?? geos.error ?? pol.error ?? res.error ?? files.error;
  if (err) return <ErrorNote error={err} />;
  if (!idx.data || !cov.data || !geos.data || !pol.data || !res.data || !files.data) return <Loading what="comparison data" />;
  const dec = new Map<string, DecodedMetric>(metas.map((m, i) => [m.metric_id, decodeMetric(files.data![i])]));
  const shortlist = cases.data?.cases[0];
  // What the dataset holds about state liquor-store money in this state and year. The IndFin years (FY1972-FY2012)
  // carry a row for every state, often zero; from FY2013 a state government with no item has no row. So having
  // rows says nothing; only the year's value does, or its absence in a year other states have.
  const storeMeta = metas.find((m) => m.metric_id === STORE_REVENUE);
  const storeObs = dec.get(STORE_REVENUE)?.obs ?? [];
  const stores = (geo: string): StoreMoney => {
    const own = idx.data!.metrics.some(
      (m) => m.fiscal_component?.startsWith("enterprise") && m.accounting_basis !== "census_classification" && cov.data!.metrics[m.metric_id]?.rows[geo],
    );
    const o = storeObs.find((x) => x.geo_id === geo && x.year === year);
    // A year the Census files cover (some state has a value) but with no record for this state: no item listed.
    const census = o && o.value !== null ? (o.value > 0 ? "positive" : "zero") : storeObs.some((x) => x.year === year && x.value !== null) ? "none_listed" : "unknown";
    return { own, census, span: storeMeta ? `FY${storeMeta.first_year}–FY${storeMeta.last_year}, with gaps` : "not loaded" };
  };
  const add = (g: string) => g && navigate({ st: [...st, g].slice(0, 6).join(",") });
  const remove = (g: string) => navigate({ st: st.filter((x) => x !== g).join(",") || null });
  const chartMeta = metas.find((m) => m.metric_id === chart);
  const rows: ObsRow[] = [];
  for (const m of metas)
    for (const g of st) {
      const o = dec.get(m.metric_id)!.obs.find((x) => x.geo_id === g && x.year === year);
      if (o) rows.push({ meta: m, obs: o });
    }

  return (
    <>
      <section className="panel" aria-labelledby="cmp-h">
        <h2 id="cmp-h">Compare states</h2>
        <p className="small muted">
          State-level values side by side for one year. Utah is shown as a reference, not as an untreated control. These
          are state figures; none of them describes Salt Lake City or any county.
        </p>
        <div className="controls">
          <div className="field">
            States (up to 6)
            <div className="row-actions" style={{ margin: 0 }}>
              {st.map((g) => (
                <button type="button" key={g} onClick={() => remove(g)} aria-label={`Remove ${geoName(g, geos.data!)}`}>
                  {geoName(g, geos.data!)} ✕
                </button>
              ))}
            </div>
          </div>
          {st.length < 6 && (
            <label>
              Add a state
              <select value="" onChange={(e) => add(e.target.value)}>
                <option value="">Choose…</option>
                {states
                  .filter((g) => !st.includes(g.geo_id))
                  .map((g) => (
                    <option key={g.geo_id} value={g.geo_id}>
                      {g.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <label>
            Year
            <input type="number" value={year} min={1990} max={2026} onChange={(e) => navigate({ y: e.target.value }, { replace: true })} />
          </label>
          {shortlist && (
            <button
              type="button"
              onClick={() =>
                navigate({ st: [shortlist.treated_geo, ...shortlist.comparison_geos.map((c) => c.geo_id)].slice(0, 6).join(",") })
              }
            >
              Use the worked example's shortlist
            </button>
          )}
        </div>
        {shortlist && (
          <p className="small muted">
            The shortlist ({shortlist.title}) is documented with reasons in{" "}
            <Go to={{ v: "case" }} reset>
              the worked example
            </Go>
            ; it is a starting point, not a ranking. No similarity score is computed.
          </p>
        )}
      </section>
      {PANELS.map((p) => (
        <section className="panel" key={p.id} aria-labelledby={`p-${p.id}`}>
          <h3 id={`p-${p.id}`}>{p.title}</h3>
          <p className="small muted">{p.note}</p>
          {p.metrics.length === 0 && !p.policy && (
            <Empty>
              Not in the dataset.{" "}
              {p.gap && <RecordLink rec={`gap:${p.gap}`}>{res.data!.gaps.find((g) => g.gap_id === p.gap)?.title}</RecordLink>}
            </Empty>
          )}
          {p.metrics.length > 0 && (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Metric ({year})</th>
                    {st.map((g) => (
                      <th key={g}>{geoName(g, geos.data!)}</th>
                    ))}
                    <th>Comparability</th>
                  </tr>
                </thead>
                <tbody>
                  {p.metrics.map((id) => {
                    const m = metas.find((x) => x.metric_id === id);
                    if (!m) return null;
                    const d = dec.get(id)!;
                    const cells = st.map((g) => d.obs.find((o) => o.geo_id === g && o.year === year));
                    const v = verdict(m, cells, st, year, stores, (g) => geoName(g, geos.data!));
                    return (
                      <tr key={id}>
                        <th scope="row">
                          {m.label}
                          <div className="small muted">
                            {unitLabel(m.unit)} · {PERIOD_KIND_LABELS[m.period_kind]}
                          </div>
                          <button type="button" className="link small" onClick={() => navigate({ cm: chart === id ? null : id })}>
                            {chart === id ? "Hide trend" : "Show trend"}
                          </button>
                        </th>
                        {cells.map((o, i) => (
                          <td key={st[i]} className="num">
                            {o ? (
                              <RecordLink rec={`obs:${id}:${o.observation_id}`}>
                                {o.value === null ? `— ${words(o.missing_reason)}` : formatValue(o.value, m.unit)}
                              </RecordLink>
                            ) : (
                              <span className="muted">no record</span>
                            )}
                            {o && o.ci_low !== null && o.ci_high !== null && (
                              <div className="small muted">
                                CI {formatValue(o.ci_low, m.unit)}–{formatValue(o.ci_high, m.unit)}
                              </div>
                            )}
                            {o && <div className="small muted">{o.period_start} to {o.period_end}</div>}
                          </td>
                        ))}
                        <td className="small">
                          <strong>{v.status}</strong>
                          <ul className="source-list" style={{ paddingLeft: 16, margin: 0 }}>
                            {v.reasons.map((r) => (
                              <li key={r}>{r}</li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {chartMeta && p.metrics.includes(chartMeta.metric_id) && (
            <TrendChart
              series={st.map((g) => ({
                key: g,
                label: geoName(g, geos.data!),
                points: buildSeries(chartMeta, dec.get(chartMeta.metric_id)!, g, "nominal", idx.data!).points,
              }))}
              unit={chartMeta.unit}
              domain={[Math.max(chartMeta.first_year, 1990), chartMeta.last_year]}
              title={`${chartMeta.label} by state`}
            />
          )}
          {p.policy && <RetailTable dims={p.policy} states={st} year={year} pol={pol.data!} geos={geos.data!} />}
        </section>
      ))}
      <section className="panel">
        <DownloadRows
          rows={rows}
          name={`compare_${year}`}
          title={`State comparison, ${year}`}
          filters={{ view: "compare", states: st.join("|"), year: String(year) }}
          notes={["One row per state and metric for the selected year. Fiscal years differ by state; see period_start and period_end."]}
        />
      </section>
    </>
  );
}

function verdict(
  m: MetricMeta,
  cells: (ReturnType<DecodedMetric["obs"]["find"]>)[],
  st: string[],
  year: number,
  stores: (geo: string) => StoreMoney,
  name: (geo: string) => string,
): { status: string; reasons: string[] } {
  const reasons: string[] = [];
  let disabled = false;
  let limited = false;
  const present = cells.filter((o) => o && o.value !== null);
  cells.forEach((o, i) => {
    if (!o) {
      reasons.push(`${name(st[i])}: no record for ${year}`);
      disabled = true;
    } else if (o.value === null) {
      reasons.push(`${name(st[i])}: ${words(o.missing_reason)}`);
      disabled = true;
    }
  });
  const series = (g: string): Series => ({ ...m, geo_id: g, geo_level: "state" });
  for (let i = 1; i < st.length; i++) {
    const v = compatible(series(st[0]), series(st[i]));
    if (!v.ok) {
      reasons.push(...v.reasons);
      disabled = true;
    }
  }
  const groups = new Set(present.map((o) => o!.comparability_group));
  if (groups.size > 1) {
    reasons.push("different comparability groups (definition or method differs between these values)");
    disabled = true;
  }
  const periods = new Set(present.map((o) => `${o!.period_start}..${o!.period_end}`));
  if (periods.size > 1) {
    reasons.push(`periods differ: ${[...periods].join(" vs ")} (state fiscal years end on different dates)`);
    limited = true;
  }
  if (m.fiscal_component === "tax") {
    const s = new Map(st.map((g) => [g, stores(g)]));
    const own = st.filter((g) => s.get(g)!.own);
    if (own.length) {
      reasons.push(`${own.map(name).join(", ")}: the dataset holds the state's own liquor-store accounts; their profit is outside this tax measure`);
      limited = true;
    }
    const positive = st.filter((g) => s.get(g)!.census === "positive");
    if (positive.length) {
      reasons.push(
        `${positive.map(name).join(", ")}: Census reports state liquor-store receipts for FY${year} (what a state monopoly took in, wholesale or retail); any profit from them is outside this tax measure`,
      );
      limited = true;
    }
    const zero = st.filter((g) => s.get(g)!.census === "zero");
    if (zero.length) reasons.push(`${zero.map(name).join(", ")}: Census reports zero state liquor-store receipts for FY${year}`);
    const none = st.filter((g) => s.get(g)!.census === "none_listed");
    if (none.length) reasons.push(`${none.map(name).join(", ")}: the Census files for FY${year} list no state liquor-store receipts item for the state government (no value, which is not a zero)`);
    const unknown = st.filter((g) => s.get(g)!.census === "unknown" && !s.get(g)!.own);
    if (unknown.length) {
      reasons.push(
        `${unknown.map(name).join(", ")}: whether the state government had liquor-store receipts in FY${year} is not in the dataset (Census liquor-store receipts: ${s.get(unknown[0])!.span})`,
      );
      limited = true;
    }
  }
  if (m.unit === "percent" && present.length > 1) {
    // Test each gap, not whether the two intervals overlap: the error of a difference is sqrt(se_a^2 + se_b^2),
    // smaller than the two half-widths added, so intervals can overlap while the gap is still larger than
    // sampling noise. A missing interval is "cannot test", never "overlaps".
    const est = cells.flatMap((o, i) => (o && o.value !== null ? [{ id: name(st[i]), value: o.value, se: seFromInterval(o.ci_low, o.ci_high, o.ci_level, o.value) }] : []));
    const unknown = est.filter((e) => e.se === null).map((e) => e.id);
    if (unknown.length) reasons.push(`no confidence interval for ${unknown.join(", ")}, so its gap to the others cannot be tested against sampling noise`);
    const noise = pairwiseContrasts(est).filter((p) => p.contrast.verdict === "within_noise");
    if (noise.length) {
      const shown = noise
        .slice(0, 4)
        .map((p) => `${p.a.id} and ${p.b.id}, gap ${Math.abs(p.contrast.diff).toFixed(1)} points${p.contrast.z === null ? "" : ` (z = ${Math.abs(p.contrast.z).toFixed(1)})`}`)
        .join("; ");
      reasons.push(`within sampling noise (each pair tested on its gap at 95%, not by whether the intervals overlap): ${shown}${noise.length > 4 ? ` and ${noise.length - 4} more` : ""}`);
    }
  }
  return {
    status: disabled ? "Comparison disabled for this year" : limited ? "Comparable with limits" : "Same measure, period and definition",
    reasons: reasons.length ? reasons : ["same measure, unit, age universe, period dates and comparability group"],
  };
}

function RetailTable({ dims, states, year, pol, geos }: { dims: string[]; states: string[]; year: number; pol: PolicyData; geos: Geography[] }) {
  const day = `${year}-07-01`;
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>Dimension (status on {day})</th>
            {states.map((g) => (
              <th key={g}>{geoName(g, geos)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dims.map((d) => (
            <tr key={d}>
              <th scope="row">{pol.dimensions[d]?.label ?? d}</th>
              {states.map((g) => {
                const segs = pol.segments.filter((s) => s.geo_id === g && s.policy_dimension === d);
                if (!segs.length) return <td key={g} className="muted">not coded</td>;
                const s = segs.find((x) => x.segment_start <= day && day <= x.segment_end);
                if (!s) return <td key={g} className="muted">outside the coded period</td>;
                const pid = s.policy_ids.split("|").find((x) => x !== "-");
                return (
                  <td key={g}>
                    {s.state === "unknown" ? <span className="muted">unknown (not verified)</span> : pid ? <RecordLink rec={`policy:${pid}`}>{words(s.state)}</RecordLink> : words(s.state)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
