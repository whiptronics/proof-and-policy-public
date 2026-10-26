// View 1 — Data coverage: a jurisdiction-by-year matrix for one metric or one family of metrics.
import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { CODE_STYLE, Empty, ErrorNote, Go, Legend, Loading, RecordLink, SourceRef, StateBadge, Swatch } from "../components/common";
import { downloadBundle } from "../lib/bundle";
import { saveFile, toCsv } from "../lib/csv";
import { decodeMetric, load, useData } from "../lib/data";
import { formatValue, PERIOD_KIND_LABELS, unitLabel, words } from "../lib/format";
import { countCodes, queue } from "../lib/research";
import type { Coverage, Geography, Manifest, MetricFile, MetricsIndex, Research, SourcesData } from "../lib/types";
import { navigate, pickInt, pickOne, useParams } from "../lib/url";

const FAMILY_ORDER = ["fiscal", "policy", "behavior", "consumption", "safety", "population", "context"];
const METRIC_CODES = ["S", "D", "U", "R", "0", "C", "W", "M", "N", ".", "-"];
const POLICY_CODES = ["K", "P", "?", "L", "F", "-"];

function famCode(have: number, defined: number): string {
  if (defined === 0) return " ";
  if (have === defined) return "K";
  return have > 0 ? "P" : "?";
}

export function CoverageView() {
  const params = useParams();
  const cov = useData<Coverage>("coverage.json");
  const idx = useData<MetricsIndex>("metrics.json");
  const geos = useData<Geography[]>("geographies.json");
  const res = useData<Research>("research.json");
  const err = cov.error ?? idx.error ?? geos.error ?? res.error;
  if (err) return <ErrorNote error={err} />;
  if (!cov.data || !idx.data || !geos.data || !res.data) return <Loading what="coverage" />;

  const families = FAMILY_ORDER.filter((f) => cov.data!.families[f]);
  const fam = pickOne(params.get("fam"), families, "fiscal");
  const famCov = cov.data.families[fam];
  const metricIds = famCov.metrics;
  const m = pickOne(params.get("m"), ["all", ...metricIds], "all");
  const span = m === "all" ? famCov : cov.data.metrics[m];
  const asOfYear = Math.max(...Object.values(cov.data.families).map((f) => f.last_year));
  const lvl = pickOne(params.get("lvl"), ["state", "other"] as const, "state");
  const y0 = pickInt(params.get("y0"), span.first_year, span.last_year, Math.max(span.first_year, 1990));
  const y1 = pickInt(params.get("y1"), y0, span.last_year, span.last_year);
  const cell = params.get("cell");
  const [cellGeo, cellYearS] = cell?.split("|") ?? [];
  const cellYear = cellYearS ? Number(cellYearS) : undefined;

  const rows = geos.data.filter((g) => (lvl === "state" ? g.geo_level === "state" : g.geo_level !== "state"));
  const years: number[] = [];
  for (let y = y0; y <= y1; y++) years.push(y);
  const metaOf = (id: string) => idx.data!.metrics.find((x) => x.metric_id === id);
  const label = (id: string) => (id.startsWith("policy:") ? cov.data!.metrics[id].label ?? id : metaOf(id)?.label ?? id);
  const metricLabel = (id: string) => {
    const meta = metaOf(id);
    if (!meta) return label(id);
    const others = idx.data!.metrics.filter((x) => x.measure_id === meta.measure_id).length;
    return others > 1 ? `${meta.label} — ${PERIOD_KIND_LABELS[meta.period_kind] ?? meta.period_kind}` : meta.label;
  };

  const codeAt = (geo: string, y: number): string => {
    if (m === "all") {
      const r = famCov.rows[geo];
      if (!r || y < famCov.first_year || y > famCov.last_year) return "-";
      const i = y - famCov.first_year;
      return famCode(r.have[i], r.defined[i]);
    }
    const c = cov.data!.metrics[m];
    const row = c.rows[geo];
    if (!row) return "-";
    if (y < c.first_year || y > c.last_year) return " ";
    return row[y - c.first_year];
  };
  const titleAt = (g: Geography, y: number, code: string): string => {
    if (m === "all") {
      const r = famCov.rows[g.geo_id];
      if (!r || y < famCov.first_year || y > famCov.last_year) return `${g.name} ${y}: no metric in this family covers this jurisdiction`;
      const i = y - famCov.first_year;
      const extra = [r.unreviewed[i] ? `${r.unreviewed[i]} transcribed and unreviewed` : "", r.conflict[i] ? `${r.conflict[i]} in conflict` : ""]
        .filter(Boolean)
        .join("; ");
      return r.defined[i]
        ? `${g.name} ${y}: ${r.have[i]} of ${r.defined[i]} metrics with a value${extra ? `; ${extra}` : ""}`
        : `${g.name} ${y}: no metric in this family exists for this year`;
    }
    return `${g.name} ${y}: ${cov.data!.states[code]?.label ?? code}`;
  };

  return (
    <div className="layout-split">
      <section className="panel" aria-labelledby="cov-h">
        <h2 id="cov-h">Data coverage</h2>
        <p className="small muted">
          What the dataset holds, by jurisdiction and year. Pick a family to see how many of its metrics have a value
          in each cell, or one metric to see each value's state. Select a cell for the values, sources, legal days
          and the research gaps that touch it.
        </p>
        <div className="controls">
          <label>
            Family
            <select value={fam} onChange={(e) => navigate({ fam: e.target.value, m: null, cell: null, y0: null, y1: null })}>
              {families.map((f) => (
                <option key={f} value={f}>
                  {idx.data!.families[f]?.label ?? f}
                </option>
              ))}
            </select>
          </label>
          <label>
            Metric
            <select value={m} onChange={(e) => navigate({ m: e.target.value === "all" ? null : e.target.value, y0: null, y1: null })}>
              <option value="all">All metrics in this family (counts)</option>
              {metricIds.map((id) => (
                <option key={id} value={id}>
                  {metricLabel(id)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Jurisdictions
            <select value={lvl} onChange={(e) => navigate({ lvl: e.target.value === "state" ? null : e.target.value, cell: null })}>
              <option value="state">States and DC</option>
              <option value="other">United States and Census regions</option>
            </select>
          </label>
          <label>
            From
            <input type="number" value={y0} min={span.first_year} max={y1} onChange={(e) => navigate({ y0: e.target.value }, { replace: true })} />
          </label>
          <label>
            To
            <input type="number" value={y1} min={y0} max={span.last_year} onChange={(e) => navigate({ y1: e.target.value }, { replace: true })} />
          </label>
        </div>
        <p className="small">{idx.data.families[fam]?.description}</p>
        <Summary m={m} fam={fam} cov={cov.data} idx={idx.data} rows={rows} y0={y0} y1={y1} />
        {m === "all" ? <FamilyLegend /> : <Legend codes={fam === "policy" ? POLICY_CODES : METRIC_CODES} />}
        <Matrix
          rows={rows}
          years={years}
          codeAt={codeAt}
          titleAt={titleAt}
          selected={cell}
          onSelect={(geo, y) => navigate({ cell: `${geo}|${y}` })}
          caption={`${m === "all" ? idx.data.families[fam]?.label : metricLabel(m)}, ${y0}–${y1}`}
        />
        <div className="row-actions">
          <button type="button" onClick={() => downloadCoverage(m, fam, rows, years, codeAt, cov.data!)}>
            Download this matrix (CSV)
          </button>
          {m !== "all" && !m.startsWith("policy:") && (
            <DownloadMetric metricId={m} rows={rows.map((g) => g.geo_id)} y0={y0} y1={y1} />
          )}
        </div>
        <p className="small muted">
          Year columns are reference years: calendar year, survey year, July 1 estimate year or the year a state fiscal
          year ends, depending on the metric. Open a cell for its exact period. {asOfYear} may be incomplete.
        </p>
      </section>
      <aside className="detail" aria-label="Cell details and research queue">
        {cellGeo && cellYear !== undefined ? (
          <CellDetail fam={fam} m={m} geoId={cellGeo} year={cellYear} code={codeAt(cellGeo, cellYear)} />
        ) : (
          <div className="panel">
            <h3>Cell details</h3>
            <p className="small muted">Select a cell (click, or arrow keys and Enter) to see its values and sources.</p>
          </div>
        )}
        <div className="panel">
          <h3>Research queue</h3>
          <p className="small muted">
            Ordered by what they block for the current question: missing fiscal pieces for the worked example first,
            then policy dates, comparison data and historical extension. Showing items for this family
            {cellGeo ? " and cell" : ""}.
          </p>
          <ol className="queue">
            {queue(res.data.gaps, { family: fam, geoId: cellGeo, year: cellYear, measureId: m === "all" ? null : metaOf(m)?.measure_id }).map((g) => (
              <li key={g.gap_id}>
                <RecordLink rec={`gap:${g.gap_id}`}>{g.title}</RecordLink>{" "}
                <span className="tag">{res.data!.categories[g.category]}</span>
                <span className="tag">{words(g.status)}</span>
                <div className="small">Blocks: {g.blocks}</div>
                <div className="small muted">Next: {g.next_action}</div>
              </li>
            ))}
          </ol>
          <p className="small">
            <Go to={{ v: "sources", kind: "leads" }} reset>
              All sources not yet held
            </Go>
          </p>
        </div>
      </aside>
    </div>
  );
}

function FamilyLegend() {
  return (
    <div className="legend" aria-label="Legend">
      <span className="item">
        <Swatch code="K" /> Every defined metric has a value
      </span>
      <span className="item">
        <Swatch code="P" /> Some do (select the cell for the count)
      </span>
      <span className="item">
        <Swatch code="?" /> None do
      </span>
      <span className="item">
        <Swatch code=" " /> No metric in the family exists for that year
      </span>
      <span className="item">
        <Swatch code="-" /> Not covered by any metric in the family
      </span>
    </div>
  );
}

function Summary({
  m,
  fam,
  cov,
  idx,
  rows,
  y0,
  y1,
}: {
  m: string;
  fam: string;
  cov: Coverage;
  idx: MetricsIndex;
  rows: Geography[];
  y0: number;
  y1: number;
}) {
  if (m === "all") {
    const f = cov.families[fam];
    let have = 0,
      defined = 0,
      unrev = 0;
    for (const g of rows) {
      const r = f.rows[g.geo_id];
      if (!r) continue;
      for (let y = Math.max(y0, f.first_year); y <= Math.min(y1, f.last_year); y++) {
        have += r.have[y - f.first_year];
        defined += r.defined[y - f.first_year];
        unrev += r.unreviewed[y - f.first_year];
      }
    }
    return (
      <p className="small">
        In the shown range: <strong>{have.toLocaleString("en-US")}</strong> metric-values present out of{" "}
        <strong>{defined.toLocaleString("en-US")}</strong> defined metric-jurisdiction-years
        {unrev ? `; ${unrev} of them transcribed and unreviewed` : ""}. <span className="muted">{cov.denominator_rule}</span>
      </p>
    );
  }
  const c = cov.metrics[m];
  const counts: Record<string, number> = {};
  for (const g of rows) {
    const row = c.rows[g.geo_id];
    if (!row) continue;
    const part = countCodes(row, Math.max(y0, c.first_year) - c.first_year, Math.min(y1, c.last_year) - c.first_year);
    for (const [k, v] of Object.entries(part)) counts[k] = (counts[k] ?? 0) + v;
  }
  const n = (codes: string[]) => codes.reduce((s, k) => s + (counts[k] ?? 0), 0);
  const covered = Object.entries(counts).filter(([k]) => k !== " ").reduce((s, [, v]) => s + v, 0);
  const meta = idx.metrics.find((x) => x.metric_id === m);
  const notCovered = rows.filter((g) => !c.rows[g.geo_id]).length;
  if (m.startsWith("policy:")) {
    return (
      <p className="small">
        Jurisdiction-years with legal status known every day: <strong>{n(["K", "L"])}</strong>; partly known:{" "}
        <strong>{n(["P"])}</strong>; unknown: <strong>{n(["?"])}</strong>; year not over: {n(["F"])} — out of {covered}{" "}
        coded jurisdiction-years. {notCovered} of {rows.length} jurisdictions shown are not coded at all.
      </p>
    );
  }
  return (
    <p className="small">
      In the shown range, out of <strong>{covered.toLocaleString("en-US")}</strong> jurisdiction-years this series covers:{" "}
      <strong>{n(["S", "D", "U", "R", "0"]).toLocaleString("en-US")}</strong> with a value (including {n(["0"])} observed
      zeros; {n(["U"])} transcribed and unreviewed), {n(["W"])} suppressed by the source, {n(["M", "N"])} missing with another reason,{" "}
      {n(["C"])} in conflict,{" "}
      {n(["."])} with no record. {notCovered} of {rows.length} jurisdictions shown are not in this series.
      {meta && (
        <span className="muted">
          {" "}
          Whole series: {meta.rows.toLocaleString("en-US")} rows, {meta.values.toLocaleString("en-US")} values,{" "}
          {meta.geo_count} jurisdictions, {meta.first_year}–{meta.last_year}; unit: {unitLabel(meta.unit)}.
        </span>
      )}
    </p>
  );
}

function Matrix({
  rows,
  years,
  codeAt,
  titleAt,
  selected,
  onSelect,
  caption,
}: {
  rows: Geography[];
  years: number[];
  codeAt: (geo: string, y: number) => string;
  titleAt: (g: Geography, y: number, code: string) => string;
  selected: string | null;
  onSelect: (geo: string, y: number) => void;
  caption: string;
}) {
  const [focus, setFocus] = useState<[number, number]>([0, Math.max(0, years.length - 1)]);
  const ref = useRef<HTMLTableElement>(null);
  const r0 = Math.min(focus[0], rows.length - 1);
  const c0 = Math.min(focus[1], years.length - 1);
  const move = (e: KeyboardEvent, r: number, c: number) => {
    const delta: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
      Home: [0, -c],
      End: [0, years.length - 1 - c],
    };
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(rows[r].geo_id, years[c]);
      return;
    }
    const d = delta[e.key];
    if (!d) return;
    e.preventDefault();
    const nr = Math.max(0, Math.min(rows.length - 1, r + d[0]));
    const nc = Math.max(0, Math.min(years.length - 1, c + d[1]));
    setFocus([nr, nc]);
    requestAnimationFrame(() => (ref.current?.querySelector(`[data-rc="${nr}-${nc}"]`) as HTMLElement | null)?.focus());
  };
  return (
    <div className="matrix-wrap">
      <table className="matrix" ref={ref} role="grid" aria-label={caption}>
        <thead>
          <tr>
            <th className="corner" scope="col">
              Year
            </th>
            {years.map((y) => (
              <th key={y} scope="col">
                {y % 5 === 0 || years.length < 15 ? y : <span className="visually-hidden">{y}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((g, r) => (
            <tr key={g.geo_id}>
              <th scope="row" title={g.name}>
                {g.abbreviation ?? g.name}
              </th>
              {years.map((y, c) => {
                const code = codeAt(g.geo_id, y);
                const isSel = selected === `${g.geo_id}|${y}`;
                return (
                  <td
                    key={y}
                    data-rc={`${r}-${c}`}
                    className={CODE_STYLE[code]?.cls ?? "st-space"}
                    tabIndex={r === r0 && c === c0 ? 0 : -1}
                    title={titleAt(g, y, code)}
                    aria-label={titleAt(g, y, code)}
                    aria-selected={isSel}
                    onClick={() => {
                      setFocus([r, c]);
                      onSelect(g.geo_id, y);
                    }}
                    onKeyDown={(e) => move(e, r, c)}
                  >
                    {CODE_STYLE[code]?.sym ?? ""}
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

function CellDetail({ fam, m, geoId, year, code }: { fam: string; m: string; geoId: string; year: number; code: string }) {
  const cov = useData<Coverage>("coverage.json");
  const idx = useData<MetricsIndex>("metrics.json");
  const geos = useData<Geography[]>("geographies.json");
  const meta = m !== "all" && !m.startsWith("policy:") ? idx.data?.metrics.find((x) => x.metric_id === m) : undefined;
  const file = useData<MetricFile>(meta ? meta.file : null);
  if (!cov.data || !idx.data || !geos.data) return <Loading what="the cell" />;
  const g = geos.data.find((x) => x.geo_id === geoId);
  if (!g) return <Empty>Unknown jurisdiction in the link.</Empty>;
  const legal = Object.entries(cov.data.metrics)
    .filter(([id, c]) => id.startsWith("policy:") && c.days?.[geoId])
    .map(([id, c]) => {
      const d = c.days![geoId].find((x) => x[0] === year);
      return { id, label: c.label ?? id, d };
    })
    .filter((x) => x.d);
  const obs = meta && file.data ? decodeMetric(file.data).obs.filter((o) => o.geo_id === geoId && o.year === year) : [];
  return (
    <div className="panel" aria-live="polite">
      <h3>
        {g.name}, {year}
      </h3>
      {m === "all" ? (
        <>
          <p className="small">{cov.data.families[fam].rows[geoId] ? "Each metric in this family for this cell:" : "No metric in this family covers this jurisdiction."}</p>
          <ul className="small source-list">
            {cov.data.families[fam].metrics.map((id) => {
              const c = cov.data!.metrics[id];
              const row = c.rows[geoId];
              const cd = !row ? "-" : year < c.first_year || year > c.last_year ? " " : row[year - c.first_year];
              const lab = id.startsWith("policy:") ? c.label : idx.data!.metrics.find((x) => x.metric_id === id)?.label;
              return (
                <li key={id}>
                  <Swatch code={cd} /> <Go to={{ m: id }}>{lab ?? id}</Go> — {cov.data!.states[cd]?.label}
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <>
          <StateBadge code={code} />
          <p className="small muted">{cov.data.states[code]?.description}</p>
          {meta && file.loading && <Loading what="values" />}
          {obs.map((o) => (
            <div className="obs-card" key={o.observation_id}>
              <div className="value">
                {o.value === null ? `No value (${words(o.missing_reason)})` : formatValue(o.value, meta!.unit)}
              </div>
              <div className="small">
                {o.period_label}: {o.period_start} to {o.period_end} · {words(o.estimate_type)}
                {o.ci_low !== null && o.ci_high !== null && (
                  <>
                    {" "}
                    · 95% CI {formatValue(o.ci_low, meta!.unit)}–{formatValue(o.ci_high, meta!.unit)}
                  </>
                )}
              </div>
              <SourceRef assetId={o.asset_id} locator={o.source_locator} page={o.open_page} />
              <RecordLink rec={`obs:${meta!.metric_id}:${o.observation_id}`}>Full record</RecordLink>
            </div>
          ))}
          {meta && (
            <p className="small">
              <strong>Definition.</strong> {meta.definition}
            </p>
          )}
        </>
      )}
      <h4>Legal status known in calendar {year}</h4>
      {meta && meta.period_kind !== "calendar_year" && (
        <p className="small muted">
          Legal days are counted by calendar year; this value's own period is shown above. The Policy timeline gives
          exact dates.
        </p>
      )}
      {legal.length ? (
        <ul className="small source-list">
          {legal.map((l) => (
            <li key={l.id}>
              {l.label}: {l.d![1]} of {l.d![2]} days verified
              {l.d![3] ? ` (${l.d![3]} days after the as-of date)` : ""}
              {l.d![4] ? `; ${l.d![4]} under a local option whose adoption is unknown` : ""}
            </li>
          ))}
        </ul>
      ) : (
        <p className="small muted">No legal status is coded for {g.name}.</p>
      )}
    </div>
  );
}

function downloadCoverage(
  m: string,
  fam: string,
  rows: Geography[],
  years: number[],
  codeAt: (geo: string, y: number) => string,
  cov: Coverage,
) {
  type R = { geo: Geography; year: number; code: string };
  const out: R[] = [];
  for (const g of rows) for (const y of years) out.push({ geo: g, year: y, code: codeAt(g.geo_id, y) });
  const csv = toCsv<R>(
    [
      { key: "family", kind: "text", get: () => fam },
      { key: "metric_id", kind: "text", get: () => m },
      { key: "geo_id", kind: "text", get: (r) => r.geo.geo_id },
      { key: "geo_name", kind: "text", get: (r) => r.geo.name },
      { key: "year", kind: "number", get: (r) => r.year },
      { key: "state_code", kind: "text", get: (r) => r.code },
      {
        key: "state_label",
        kind: "text",
        get: (r) =>
          m === "all"
            ? { K: "every defined metric has a value", P: "some metrics have a value", "?": "no metric has a value", " ": "no metric exists for this year", "-": "not covered" }[r.code]
            : cov.states[r.code]?.label,
      },
    ],
    out,
  );
  saveFile(`coverage_${fam}_${m.replace(/[^a-z0-9_]+/gi, "_")}.csv`, csv, "text/csv");
}

function DownloadMetric({ metricId, rows, y0, y1 }: { metricId: string; rows: string[]; y0: number; y1: number }) {
  const [busy, setBusy] = useState(false);
  const idx = useData<MetricsIndex>("metrics.json");
  const meta = useMemo(() => idx.data?.metrics.find((x) => x.metric_id === metricId), [idx.data, metricId]);
  if (!meta) return null;
  const go = async () => {
    setBusy(true);
    try {
      const [file, geos, sources, man] = await Promise.all([
        load<MetricFile>(meta.file),
        load<Geography[]>("geographies.json"),
        load<SourcesData>("sources.json"),
        load<Manifest>("manifest.json"),
      ]);
      const set = new Set(rows);
      const obs = decodeMetric(file).obs.filter((o) => set.has(o.geo_id) && o.year >= y0 && o.year <= y1);
      downloadBundle({
        name: `observations_${meta.measure_id}_${y0}_${y1}`,
        title: `${meta.label} (${meta.period_kind}), ${y0}-${y1}`,
        rows: obs.map((o) => ({ meta, obs: o })),
        geos,
        sources,
        manifest: man,
        filters: { view: "coverage", metric_id: metricId, years: `${y0}-${y1}`, jurisdictions: rows.join("|") },
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" onClick={go} disabled={busy}>
      {busy ? "Preparing…" : "Download these observations (CSV bundle)"}
    </button>
  );
}
