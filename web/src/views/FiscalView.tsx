// Revenue by state: the pieces of alcohol money the dataset holds for every state, one column each, never
// added together. Store receipts are turnover, taxes and fees are revenue the state keeps, and residents'
// spending is neither; a total across them would double-count and mix kinds, so there is none, and sorting
// ranks one column at a time.
import { ErrorNote, Go, Loading, RecordLink, SourceNote } from "../components/common";
import { ControlBadge, ControlDims, ControlSelect, ControlSummary, assessAll } from "../components/ControlFilter";
import { CONTROL_DIMS, CRITERIA, criterionById, verdictText } from "../lib/control";
import { saveFile, toCsv, type Column } from "../lib/csv";
import { decodeMetric, useData, useMany, type DecodedMetric } from "../lib/data";
import { formatValue, geoName, words } from "../lib/format";
import { metricSourceIds, sourceLine, sourcesById } from "../lib/sources";
import type { Geography, Manifest, MetricFile, MetricsIndex, PolicyData, SourcesData } from "../lib/types";
import { navigate, pickInt, pickOne, useParams } from "../lib/url";

type Shown = "nominal" | "per_resident_21plus";
interface Col {
  key: string;
  metric: string;
  label: string;
  kind: string;
  /** Last year the source covers, when it stops before the chosen year. */
  capYear?: boolean;
}

const COLS: Col[] = [
  { key: "t10", metric: "stc_alcoholic_beverages_sales_tax@state_fiscal_year", label: "Alcohol taxes", kind: "Revenue the state keeps (Census T10: excise and similar taxes on alcohol)" },
  { key: "t20", metric: "stc_alcoholic_beverages_license_tax@state_fiscal_year", label: "Alcohol license fees", kind: "Revenue the state keeps (Census T20)" },
  {
    key: "a90",
    metric: "census_liquor_stores_revenue@state_fiscal_year",
    label: "State liquor-store receipts",
    kind: "Turnover, not profit: what customers paid state-run stores or wholesale (Census, FY1972 and FY1977-FY2024)",
    capYear: true,
  },
  {
    key: "dabs",
    metric: "ut_dabs_net_profit_general_fund@state_fiscal_year",
    label: "State-store profit to the General Fund",
    kind: "Revenue the state keeps from its stores (agency reports; Utah only in this dataset)",
    capYear: true,
  },
  {
    key: "bea",
    metric: "bea_pce_off_premises_alcohol@calendar_year",
    label: "Residents' spending on take-home alcohol",
    kind: "Not government money: what residents paid every kind of store (BEA, calendar year)",
  },
];

interface Cell {
  v: number | null;
  why: string | null;
  rec: string | null;
  year: number | null;
}

export function FiscalView() {
  const params = useParams();
  const idx = useData<MetricsIndex>("metrics.json");
  const geos = useData<Geography[]>("geographies.json");
  const pol = useData<PolicyData>("policy.json");
  const man = useData<Manifest>("manifest.json");
  const srcData = useData<SourcesData>("sources.json");
  const metas = COLS.map((c) => idx.data?.metrics.find((m) => m.metric_id === c.metric));
  const missing = idx.data ? COLS.find((_, i) => !metas[i]) : undefined;
  const files = useMany<MetricFile>(idx.data && !missing ? metas.map((m) => m!.file) : []);
  const err = idx.error ?? geos.error ?? pol.error ?? man.error ?? srcData.error ?? files.error;
  if (err) return <ErrorNote error={err} />;
  if (missing) return <ErrorNote error={new Error(`Measure ${missing.metric} is not in this build.`)} />;
  if (!idx.data || !geos.data || !pol.data || !man.data || !srcData.data || !files.data || files.data.length !== COLS.length) return <Loading what="revenue by state" />;

  const G = geos.data;
  const name = (g: string) => geoName(g, G);
  const states = G.filter((g) => g.geo_level === "state").map((g) => g.geo_id);
  const dms = new Map<string, DecodedMetric>(COLS.map((c, i) => [c.key, decodeMetric(files.data![i])]));
  const lastOf = (key: string) => Math.max(...dms.get(key)!.obs.filter((o) => o.value !== null).map((o) => o.year));
  const yMax = lastOf("t10");
  const y = pickInt(params.get("y"), 1990, yMax, yMax);
  const shown = pickOne(params.get("sh"), ["nominal", "per_resident_21plus"] as Shown[], "nominal");
  const sortKey = pickOne(params.get("so"), ["name", ...COLS.map((c) => c.key)], "name");
  const yearFor = (c: Col) => (c.capYear ? Math.min(y, lastOf(c.key)) : y);
  const set = (patch: Record<string, string | number | null>) => navigate(patch);
  const lookup = { metrics: idx.data.metrics, monthly: [], sources: srcData.data };
  const colSources = (c: Col) => metricSourceIds(metas[COLS.indexOf(c)]!, shown, lookup);
  const allSources = [...new Set(COLS.flatMap(colSources))];

  const cellOf = (c: Col, g: string): Cell => {
    const year = yearFor(c);
    const o = dms.get(c.key)!.obs.find((x) => x.geo_id === g && x.year === year);
    if (!o) return { v: null, why: c.key === "dabs" ? "not collected in this dataset" : "no record", rec: null, year };
    const rec = `obs:${c.metric}:${o.observation_id}`;
    if (o.value === null) return { v: null, why: o.missing_reason ?? "missing", rec, year };
    if (shown === "nominal") return { v: o.value, why: null, rec, year };
    const conv = dms.get(c.key)!.conversions.get(o.observation_id)?.get(shown);
    return { v: conv?.value ?? null, why: conv ? conv.missing : "no conversion exported for this row", rec, year };
  };
  // Liquor-control arrangement in each state's own fiscal year y (dates from its T10 row), against Utah's.
  const criterion = criterionById(params.get("ca"));
  const onlyVerified = criterion !== null && params.get("cv") === "1";
  const periodOf = (g: string) => {
    const o = dms.get("t10")!.obs.find((x) => x.geo_id === g && x.year === y);
    return o ? { from: o.period_start, to: o.period_end } : { from: `${y - 1}-07-01`, to: `${y}-06-30` };
  };
  const control = assessAll(pol.data, criterion ?? CRITERIA[0], states, "state:49", periodOf);
  const rows = states.map((g) => ({ g, cells: Object.fromEntries(COLS.map((c) => [c.key, cellOf(c, g)])) as Record<string, Cell> }));
  const sorted = [...rows].filter((r) => !onlyVerified || control.get(r.g)?.verdict === "yes").sort((a, b) => {
    if (sortKey === "name") return name(a.g).localeCompare(name(b.g));
    const va = a.cells[sortKey].v;
    const vb = b.cells[sortKey].v;
    if (va === null && vb === null) return name(a.g).localeCompare(name(b.g));
    if (va === null) return 1;
    if (vb === null) return -1;
    return vb - va || name(a.g).localeCompare(name(b.g));
  });
  const unit = shown === "nominal" ? "usd_nominal" : "usd_nominal_per_person";
  const fmt = (c: Cell) => (c.v === null ? "—" : c.v === 0 ? "0" : formatValue(c.v, unit));
  const count = (key: string) => rows.filter((r) => r.cells[key].v !== null).length;
  const zeros = (key: string) => rows.filter((r) => r.cells[key].v === 0).length;
  const a90Year = yearFor(COLS[2]);
  const withStores = rows.filter((r) => (r.cells.a90.v ?? 0) > 0).length;

  const csv = () => {
    type R = (typeof rows)[number];
    const cols: Column<R>[] = [
      { key: "state", kind: "text", get: (r) => name(r.g) },
      { key: "geo_id", kind: "text", get: (r) => r.g },
      ...CONTROL_DIMS.flatMap((d) => [
        { key: d.dim, kind: "text", get: (r: R) => {
          const st = control.get(r.g)?.dims.find((x) => x.dim === d.dim);
          return st?.value ?? st?.snapshots[0]?.policy_value ?? null;
        } } as Column<R>,
        { key: `${d.dim}_basis`, kind: "text", get: (r: R) => {
          const st = control.get(r.g)?.dims.find((x) => x.dim === d.dim);
          return st?.value ? `verified for FY${y}` : st?.snapshots[0] ? `current law on ${st.snapshots[0].observed_on}; history not verified` : "not recorded";
        } } as Column<R>,
      ]),
      ...(criterion ? [{ key: `liquor_control_${criterion.id}`, kind: "text", get: (r: R) => (criterion.id === "same_as_target" && r.g === "state:49" ? "reference state" : verdictText(control.get(r.g)!)) } as Column<R>] : []),
      ...COLS.flatMap((c) => [
        { key: `${c.key}_value`, kind: "number", get: (r: R) => r.cells[c.key].v } as Column<R>,
        { key: `${c.key}_year`, kind: "number", get: (r: R) => r.cells[c.key].year } as Column<R>,
        { key: `${c.key}_reason_if_no_value`, kind: "text", get: (r: R) => (r.cells[c.key].v === null ? r.cells[c.key].why : null) } as Column<R>,
      ]),
    ];
    const head = `# Alcohol money by state, components side by side (never summed). ${shown === "nominal" ? "US dollars, nominal" : "US dollars per resident aged 21+"}. t10 = Census alcohol taxes; t20 = Census alcohol license fees; a90 = Census state liquor-store receipts (turnover); dabs = state-store profit to the General Fund (Utah only); bea = residents' take-home alcohol spending (not government money).\r\n# ${COLS.map((c) => `${c.key}: ${sourceLine(sourcesById(colSources(c), srcData.data!), false).replace(/^Sources?: /, "")}`).join(" ")}${shown === "nominal" ? "" : " Per-resident values computed by this project."} Liquor-control columns: verified intervals or dated current-law snapshots, each from the statute or agency page it cites; a snapshot is not history.\r\n# Dataset ${man.data!.dataset.release_label}.\r\n`;
    saveFile(`revenue_components_${y}_${shown}.csv`, head + toCsv(cols, sorted), "text/csv;charset=utf-8");
  };

  return (
    <>
      <section className="panel" aria-labelledby="fis-h">
        <h2 id="fis-h">Alcohol money, state by state</h2>
        <p className="small">
          Each column is a different kind of money, from a different source. They are shown side by side and never added: store receipts are what
          customers paid state-run stores (before the cost of the liquor and of running the stores), taxes and fees are what the state keeps, and
          residents' spending is what they paid every seller. A total would count some dollars twice and mix revenue with sales. Sorting ranks one
          column at a time.
        </p>
        <form className="controls" onSubmit={(e) => e.preventDefault()} aria-label="Revenue table settings">
          <label>
            Year
            <select value={y} onChange={(e) => set({ y: e.target.value })}>
              {Array.from({ length: yMax - 1990 + 1 }, (_, i) => yMax - i).map((yy) => (
                <option key={yy} value={yy}>
                  {yy}
                </option>
              ))}
            </select>
            <span className="help">State fiscal years (most end June 30) for government money; calendar year for spending.</span>
          </label>
          <label>
            Show
            <select value={shown} onChange={(e) => set({ sh: e.target.value === "nominal" ? null : e.target.value })}>
              <option value="nominal">Dollars, as published</option>
              <option value="per_resident_21plus">Dollars per resident aged 21+</option>
            </select>
          </label>
          <label>
            Sort by
            <select value={sortKey} onChange={(e) => set({ so: e.target.value === "name" ? null : e.target.value })}>
              <option value="name">State name</option>
              {COLS.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label} (highest first)
                </option>
              ))}
            </select>
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

      <section className="panel note" aria-labelledby="why-h">
        <h3 id="why-h">Why a state without liquor stores still has alcohol sales and alcohol revenue</h3>
        <p className="small">
          In most states private licensed stores sell beer, wine and spirits. The state still collects <strong>alcohol taxes</strong> (excise
          taxes on beer, wine and spirits), <strong>license fees</strong> from sellers, and its <strong>general sales tax</strong> on purchases.
          Residents buy alcohol everywhere, as the spending column shows. States that sell or wholesale spirits themselves (often called control
          states) collect the same kinds of taxes and fees, plus whatever their stores earn; Census counts store receipts apart from taxes. For
          fiscal {a90Year}, the Census files held record liquor-store receipts for {withStores} states; the others have no liquor-store figure at
          all, shown as "—" rather than zero. Some states on that list only wholesale spirits to private stores, which is why a state can show
          store receipts and private retail at the same time.
        </p>
        <p className="small">
          <strong>General sales tax on alcohol is in no column:</strong> Census does not separate it from other sales-tax receipts in any state. For
          Utah, the dataset holds the state's own part of the sales-tax rate from the Tax Commission's Publication 25 (pages marked "draft pending
          public meeting"); the{" "}
          <Go to={{ v: "scenario" }} reset>
            Utah revenue scenarios
          </Go>{" "}
          tool offers it as an input and combines it with the stores' figures under your own assumptions.
        </p>
      </section>

      <section className="panel report" aria-labelledby="fis-t">
        <h3 id="fis-t">
          {shown === "nominal" ? "Dollars" : "Dollars per resident aged 21+"}, {y}
          {COLS.some((c) => yearFor(c) !== y) ? " (or the latest year a source covers, as marked)" : ""}
        </h3>
        {criterion && <ControlSummary c={criterion} as={control} target="state:49" period={`fiscal year ${y}`} targetName="Utah" />}
        <ol className="small col-defs">
          <li>
            Liquor control in fiscal year {y}: who wholesales and who sells spirits and wine to take home. "Verified" means coded law covers every
            day of that fiscal year; "current law" is a dated snapshot that says nothing about {y}. Each entry opens its record and source.
          </li>
          {COLS.map((c) => (
            <li key={c.key}>
              {c.label}
              {yearFor(c) !== y ? ` (${c.key === "bea" ? "" : "FY"}${yearFor(c)}, the latest held)` : ""}: {c.kind}.{" "}
              <SourceNote inline ids={colSources(c)} derived={shown !== "nominal"} />
            </li>
          ))}
        </ol>
        <div className="table-wrap">
          <table className="data fiscal-table">
            <caption className="visually-hidden">Alcohol money by state, one component per column, not summed</caption>
            <thead>
              <tr>
                <th scope="col">State</th>
                <th scope="col" className="spirits-col">(1) Liquor control, FY{y}</th>
                {COLS.map((c, i) => (
                  <th scope="col" className="num" key={c.key} aria-sort={sortKey === c.key ? "descending" : undefined}>
                    ({i + 2}) {c.label}
                    {yearFor(c) !== y ? `, ${c.key === "bea" ? "" : "FY"}${yearFor(c)}` : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const a = control.get(r.g)!;
                return (
                  <tr key={r.g} className={r.g === "state:49" ? "selected-row" : undefined}>
                    <th scope="row">
                      <Go to={{ v: "revenue", geo: r.g }} reset>
                        {name(r.g)}
                      </Go>
                    </th>
                    <td className="small">
                      <ControlDims a={a} compact />
                      {criterion && <ControlBadge a={a} reference={criterion.id === "same_as_target" && r.g === "state:49"} />}
                    </td>
                    {COLS.map((c) => {
                      const cell = r.cells[c.key];
                      return (
                        <td className="num" key={c.key}>
                          {cell.rec ? <RecordLink rec={cell.rec}>{fmt(cell)}</RecordLink> : fmt(cell)}
                          {cell.v === null && cell.why && cell.why !== "not collected in this dataset" && cell.why !== "no record" && <div className="why">{words(cell.why)}</div>}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="small muted">
          States with a value: {COLS.map((c, i) => `(${i + 2}) ${count(c.key)} of ${states.length}${zeros(c.key) ? ` (${zeros(c.key)} reported zero)` : ""}`).join("; ")}. "—" means no value, never zero:
          for the profit column the dataset holds only Utah's reports, and the Census liquor-store files held end in FY{lastOf("a90")}. "0" is a zero the
          source reported. Utah's row is shaded. Click a state for its revenue over time.
        </p>
        <SourceNote ids={allSources} derived={shown !== "nominal"} />
        <p className="small">
          For state laws, see the{" "}
          <Go to={{ v: "matrix" }} reset>
            policy matrix
          </Go>
          , where each coded cell links to its record and the source it was read from.
        </p>
        <div className="row-actions no-print">
          <button type="button" onClick={csv}>
            Download this table (CSV)
          </button>
          <Go to={{ v: "map", mm: "alcohol_taxes", y }} reset>
            Alcohol taxes on the map
          </Go>
          <Go to={{ v: "map", mm: "liquor_store_revenue", y: Math.min(y, a90Year) }} reset>
            Liquor-store receipts on the map
          </Go>
        </div>
      </section>
    </>
  );
}
