// Worked example: one grocery-wine reform, as far as the held evidence supports it. The text comes from the
// case configuration (config/dashboard/cases/*.yaml); every number on the page comes from the exported data.
import { Empty, ErrorNote, Go, Loading, RecordLink } from "../components/common";
import { TrendChart } from "../components/TrendChart";
import { analysisPatch, caseDimension, casePanelAnalysis } from "../lib/analysis";
import type { ObsRow } from "../lib/bundle";
import { saveFile } from "../lib/csv";
import { decodeMetric, useData, useMany } from "../lib/data";
import { CONVERSION_LABELS, PERIOD_KIND_LABELS, formatValue, geoName, unitLabel, words } from "../lib/format";
import { percentChange, windowMean } from "../lib/formulas";
import { buildSeries, policyAnnotations } from "../lib/series";
import type { CaseStudy, Geography, Manifest, MetricFile, MetricMeta, MetricsIndex, PolicyData, Research } from "../lib/types";
import { pickOne, useParams } from "../lib/url";
import { CaseResultsSection } from "./CaseResults";
import { DownloadRows } from "./RevenueView";

export function CaseView() {
  const params = useParams();
  const cases = useData<{ cases: CaseStudy[] }>("cases.json");
  const idx = useData<MetricsIndex>("metrics.json");
  const geos = useData<Geography[]>("geographies.json");
  const pol = useData<PolicyData>("policy.json");
  const res = useData<Research>("research.json");
  const man = useData<Manifest>("manifest.json");
  const list = cases.data?.cases ?? [];
  const id = pickOne(params.get("case"), list.map((c) => c.case_id), list[0]?.case_id ?? "");
  const c = list.find((x) => x.case_id === id);
  const metas = (c?.metrics ?? []).map((m) => idx.data?.metrics.find((x) => x.metric_id === m)).filter((m) => m !== undefined);
  const files = useMany<MetricFile>(idx.data && c ? metas.map((m) => m!.file) : []);
  const err = cases.error ?? idx.error ?? geos.error ?? pol.error ?? res.error ?? files.error;
  if (err) return <ErrorNote error={err} />;
  if (!cases.data || !idx.data || !geos.data || !pol.data || !res.data || !man.data) return <Loading what="the worked example" />;
  if (!c) {
    return (
      <section className="panel">
        <h2>Worked example</h2>
        <Empty>No worked example is configured. See docs/research-dashboard/case-study-selection.md.</Empty>
      </section>
    );
  }
  if (!files.data) return <Loading what="the example's series" />;
  const dec = new Map(metas.map((m, i) => [m!.metric_id, decodeMetric(files.data![i])]));
  const known = metas.filter((m): m is MetricMeta => m !== undefined);
  const dim = caseDimension(c, pol.data.events);
  const reforms = pol.data.events.filter((e) => c.reform_policy_ids.includes(e.policy_id));
  const concurrent = pol.data.events.filter((e) => c.concurrent_policy_ids.includes(e.policy_id));
  const allRows: ObsRow[] = [];

  return (
    <>
      <section className="panel" aria-labelledby="case-h">
        <h2 id="case-h">{c.title}</h2>
        <p className="small">
          <span className="tag">{words(c.status)}</span> {c.question}
        </p>
        <div className="note small">
          Descriptive before-and-after view. It does not estimate the reform's effect: the comparison states are not shown
          to be unchanged, Tennessee's reform applied only where localities opted in, and other changes happened on the
          same day. Selection and exclusions: <span className="mono">{c.selection_doc}</span>.
        </div>
      </section>
      <section className="panel" aria-labelledby="s1">
        <h3 id="s1">1. What changed, for which stores and beverages, and when</h3>
        <ul className="small source-list">
          {c.what_changed.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Interval</th>
                <th>Enacted</th>
                <th>Legal start</th>
                <th>Operational start</th>
                <th>Verified in force</th>
                <th>Review</th>
              </tr>
            </thead>
            <tbody>
              {[...reforms, ...concurrent].map((e) => (
                <tr key={e.policy_id}>
                  <td>
                    <RecordLink rec={`policy:${e.policy_id}`}>
                      {e.dimension_label}: {words(e.policy_value)}
                    </RecordLink>
                    {concurrent.includes(e) && <div className="small muted">concurrent change</div>}
                  </td>
                  <td>{e.enactment_date ?? "—"}</td>
                  <td>{e.effective_start ?? "unknown"}</td>
                  <td className="small">{e.operational_start ?? "not established"}</td>
                  <td className="small">
                    {e.known_in_effect_from ?? e.effective_start} → {e.known_in_effect_through ?? (e.effective_end ? `before ${e.effective_end}` : "?")}
                  </td>
                  <td className="small">{words(e.legal_review_status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted">{c.transition_note}</p>
      </section>
      <section className="panel" aria-labelledby="s2">
        <h3 id="s2">2. What was collected and what is missing</h3>
        <div className="grid-2">
          <div>
            <h4>Collected</h4>
            <ul className="small source-list">
              {c.collected.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4>Missing</h4>
            <ul className="small source-list">
              {c.missing.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <ul className="small source-list">
              {res.data.gaps
                .filter((g) => g.affected_geos.includes(c.treated_geo) || (g.affected_geos.includes("multi") && g.category === "comparison_data"))
                .map((g) => (
                  <li key={g.gap_id}>
                    <RecordLink rec={`gap:${g.gap_id}`}>{g.title}</RecordLink>
                  </li>
                ))}
            </ul>
          </div>
        </div>
      </section>
      <section className="panel" aria-labelledby="s3">
        <h3 id="s3">3. Before and after</h3>
        <p className="small muted">
          Windows (five years each side): {Object.entries(c.windows).map(([k, w]) => `${k.startsWith("pre") ? "before" : "after"}, ${(PERIOD_KIND_LABELS[w.period_kind] ?? w.period_kind).toLowerCase()}: ${w.from}–${w.to}`).join("; ")}.
          Policy markers are numbered on each chart and listed under it.
        </p>
        {c.panels.map((p, pi) => {
          const pms = p.metrics.map((pm) => ({ pm, meta: metas.find((m) => m!.metric_id === pm.metric_id)! })).filter((x) => x.meta);
          // The panel's years and jurisdictions are its saved analysis, so "Open in Explore" shows this chart.
          const spec = casePanelAnalysis(c, pi, known, dim);
          if (!pms.length || !spec) return null;
          const first = pms[0];
          const kind = first.pm.conversion ?? "nominal";
          const domain: [number, number] = [spec.analysis.from, spec.analysis.to];
          const ann = policyAnnotations(reforms, c.treated_geo, first.meta.period_kind, idx.data!.fiscal_year_rules, domain);
          const panelGeos = spec.analysis.geos;
          const built = pms.flatMap(({ pm, meta }) =>
            panelGeos.map((g) => ({ g, meta, b: buildSeries(meta!, dec.get(meta!.metric_id)!, g, pm.conversion ?? "nominal", idx.data!) })),
          );
          for (const x of built) allRows.push(...x.b.rows.filter((r) => r.obs.year >= domain[0] && r.obs.year <= domain[1]));
          const pre = Object.entries(c.windows).find(([k, x]) => k.startsWith("pre") && x.period_kind === first.meta.period_kind)?.[1];
          const post = Object.entries(c.windows).find(([k, x]) => k.startsWith("post") && x.period_kind === first.meta.period_kind)?.[1];
          return (
            <div key={p.title} style={{ marginBottom: 18 }}>
              <h4>{p.title}</h4>
              <p className="small muted">
                {pms.map((x) => x.meta.label).join("; ")} — {kind !== "nominal" ? CONVERSION_LABELS[kind] : unitLabel(first.meta.unit)}. {p.note}
              </p>
              <TrendChart
                series={built.map((x) => ({ key: `${x.meta!.metric_id}|${x.g}`, label: p.treated_only ? x.meta!.label : `${geoName(x.g, geos.data!)}${pms.length > 1 ? ` — ${x.meta!.label}` : ""}`, points: x.b.points }))}
                unit={built[0]?.b.unit ?? first.meta.unit}
                domain={domain}
                annotations={ann}
                title={p.title}
              />
              <p className="small">
                <Go to={analysisPatch(spec.analysis, spec.id)} reset>
                  Open this chart in Explore
                </Go>{" "}
                to change the states, years or the way values are shown.
              </p>
              {pre && post && (
                <div className="table-wrap">
                  <table className="data">
                    <caption className="small">
                      Window means (every year must have a value) and the change between them — a description, not an effect
                    </caption>
                    <thead>
                      <tr>
                        <th>Series</th>
                        <th className="num">
                          Before {pre.from}–{pre.to}
                        </th>
                        <th className="num">
                          After {post.from}–{post.to}
                        </th>
                        <th className="num">Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {built.map((x) => {
                        const a = windowMean(x.b.points, pre.from, pre.to);
                        const b = windowMean(x.b.points, post.from, post.to);
                        const pc = percentChange(a.mean, b.mean);
                        const u = x.b.unit;
                        return (
                          <tr key={`${x.meta!.metric_id}|${x.g}`}>
                            <th scope="row">
                              {geoName(x.g, geos.data!)}
                              {pms.length > 1 && <div className="small muted">{x.meta!.label}</div>}
                            </th>
                            <td className="num">{a.mean === undefined ? `— missing ${a.missing.join(", ")}` : formatValue(a.mean, u)}</td>
                            <td className="num">{b.mean === undefined ? `— missing ${b.missing.join(", ")}` : formatValue(b.mean, u)}</td>
                            <td className="num">{pc === undefined ? "undefined" : `${pc >= 0 ? "+" : ""}${pc.toFixed(1)}%`}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </section>
      <section className="panel" aria-labelledby="s4">
        <h3 id="s4">4. Comparison jurisdictions and why they are included</h3>
        <ul className="small source-list">
          {c.comparison_geos.map((g) => (
            <li key={g.geo_id}>
              <strong>{geoName(g.geo_id, geos.data!)}</strong>: {g.reason}
            </li>
          ))}
          {c.reference_geos.map((g) => (
            <li key={g.geo_id}>
              <strong>{geoName(g.geo_id, geos.data!)}</strong> (reference): {g.reason}
            </li>
          ))}
        </ul>
        <p className="small">
          <Go to={{ v: "compare", st: [c.treated_geo, ...c.comparison_geos.map((x) => x.geo_id)].slice(0, 6).join(","), y: String(Object.entries(c.windows).find(([k]) => k.startsWith("pre"))?.[1].to ?? 2015) }} reset>
            Open these states in Compare
          </Go>
        </p>
      </section>
      <section className="panel" aria-labelledby="s5">
        <h3 id="s5">5. What the observations show, what they cannot establish, what would improve them</h3>
        <div className="grid-2">
          <div>
            <h4>Show (descriptively)</h4>
            <ul className="small source-list">
              {c.shows.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4>Cannot establish</h4>
            <ul className="small source-list">
              {c.cannot_establish.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4>Would improve the analysis</h4>
            <ul className="small source-list">
              {c.would_improve.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4>Possible confounders</h4>
            <ul className="small source-list">
              {c.confounders.map((x) => (
                <li key={x.name}>
                  <strong>{x.name}</strong> <span className="tag">{words(x.status)}</span> {x.note}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
      <CaseResultsSection caseId={c.case_id} idx={idx.data} geos={geos.data} events={pol.data.events} />
      <section className="panel" aria-labelledby="s6">
        <h3 id="s6">7. Reproduce this example</h3>
        <p className="small">
          Configuration: <span className="mono">{c.config_file}</span>; dataset {man.data.dataset.release_label}; conversions per
          panel as labelled; window means and changes use the page formulas. The download includes every value charted
          above with its source and inputs.
        </p>
        <div className="row-actions">
          <button
            type="button"
            onClick={() =>
              saveFile(
                `${c.case_id}_configuration.json`,
                JSON.stringify({ release: man.data!.dataset.release_label, export: man.data!.export, case: c }, null, 1) + "\n",
                "application/json",
              )
            }
          >
            Download the configuration (JSON)
          </button>
        </div>
        <DownloadRows
          rows={allRows}
          name={`${c.case_id}_data`}
          title={c.title}
          filters={{ view: "case", case: c.case_id, config: c.config_file }}
          notes={["Values are shown as each panel shows them (see shown_as and shown_method)."]}
        />
      </section>
    </>
  );
}
