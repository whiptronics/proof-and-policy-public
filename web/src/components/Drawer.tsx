// The shared record drawer: one place that shows any record in full. Opened by the URL parameter
// rec=obs:<metric_id>:<observation_id> | policy:<id> | asset:<id> | lead:<id> | gap:<id>,
// so every record has a link and Back closes it.
import { useEffect, useRef } from "react";
import { decodeMetric, useData, useMany } from "../lib/data";
import { CONVERSION_LABELS, PERIOD_KIND_LABELS, SUPPORT_LABELS, bytes, formatValue, geoName, unitLabel, words } from "../lib/format";
import type {
  Deflators,
  Geography,
  MetricFile,
  MetricMeta,
  MetricsIndex,
  MonthlyFile,
  MonthlyMeta,
  PolicyData,
  Research,
  SourcesData,
} from "../lib/types";
import { navigate } from "../lib/url";
import { Empty, ErrorNote, Go, Loading, RecordLink, SourceRef, StateBadge } from "./common";

/** What a value's interval covers. Only a survey's interval is sampling error; the others are not. */
export function intervalNote(o: { estimate_type: string; comparability_group: string }): string {
  if (o.estimate_type === "survey_estimate") return "A survey estimate, not a count.";
  if (o.comparability_group.startsWith("fars|") || o.comparability_group.startsWith("derived|fars_"))
    return "Not a survey: FARS lists every fatal crash. This interval is for the underlying expected number, the one to use when comparing years or states: chance variation in the count (crashes as random events, each crash's deaths taken together) and, for alcohol-impaired-driving deaths, the spread across NHTSA's ten imputed blood-alcohol readings, with Student's t on Rubin's degrees of freedom.";
  return "The source's own interval; the measure's notes say what it covers.";
}

export function Drawer({ rec }: { rec: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [rec]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") navigate({ rec: null });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const [kind, ...rest] = rec.split(":");
  const id = rest.join(":");
  return (
    <div className="drawer" role="dialog" aria-modal="false" aria-labelledby="drawer-title" tabIndex={-1} ref={ref}>
      <div className="drawer-head">
        <span className="muted small">Record</span>
        <button type="button" onClick={() => navigate({ rec: null })} aria-label="Close record">
          Close ✕
        </button>
      </div>
      {kind === "obs" && <ObservationRecord id={id} />}
      {kind === "policy" && <PolicyRecord id={id} />}
      {kind === "asset" && <AssetRecord id={id} />}
      {kind === "lead" && <LeadRecord id={id} />}
      {kind === "gap" && <GapRecord id={id} />}
      {kind === "snapshot" && <SnapshotRecord id={id} />}
      {!["obs", "policy", "asset", "lead", "gap", "snapshot"].includes(kind) && (
        <Empty>
          <h2 id="drawer-title">Unknown record</h2>
          The link names a record type this dashboard does not have.
        </Empty>
      )}
    </div>
  );
}

// ----- observation -------------------------------------------------------------------------------

function ObservationRecord({ id }: { id: string }) {
  const sep = id.lastIndexOf(":");
  const metricId = id.slice(0, sep);
  const obsId = id.slice(sep + 1);
  const idx = useData<MetricsIndex>("metrics.json");
  const geos = useData<Geography[]>("geographies.json");
  const meta = idx.data?.metrics.find((m) => m.metric_id === metricId);
  const file = useData<MetricFile>(meta ? meta.file : null);
  if (idx.error || file.error) return <ErrorNote error={(idx.error ?? file.error)!} />;
  if (!idx.data || !geos.data) return <Loading what="the record" />;
  if (!meta) return <Empty>No metric named {metricId} in this export.</Empty>;
  if (!file.data) return <Loading what={meta.label} />;
  const dm = decodeMetric(file.data);
  const o = dm.byId.get(obsId);
  if (!o) return <Empty>Observation {obsId} is not among the preferred values of {meta.label}.</Empty>;
  const alts = dm.alternates.get(o.observation_id) ?? [];
  const conv = dm.conversions.get(o.observation_id);
  return (
    <article>
      <h2 id="drawer-title">
        {meta.label} — {geoName(o.geo_id, geos.data)}, {o.period_label}
      </h2>
      <div className="obs-card">
        <div className="value">
          {o.value === null ? "No value" : formatValue(o.value, meta.unit)}{" "}
          <span className="muted small">{unitLabel(meta.unit)}</span>
        </div>
        <StateBadge code={o.cell} />
        {o.value === null && (
          <p className="small">
            Missing reason: <strong>{words(o.missing_reason)}</strong>
          </p>
        )}
        {o.ci_low !== null && o.ci_high !== null && (
          <p className="small">
            {Math.round((o.ci_level ?? 0.95) * 100)}% confidence interval {formatValue(o.ci_low, meta.unit)} to{" "}
            {formatValue(o.ci_high, meta.unit)}
            {o.sample_size !== null && <> · sample size {o.sample_size.toLocaleString("en-US")}</>}. {intervalNote(o)}
          </p>
        )}
        {o.realized_ci_low != null && o.realized_ci_high != null && (
          <p className="small">
            For the deaths that actually happened, a fixed number once FARS is final, only the missing blood-alcohol readings are uncertain:{" "}
            {o.realized_ci_low === o.realized_ci_high
              ? "the ten imputations agree, so they add no uncertainty to it."
              : `${Math.round((o.ci_level ?? 0.95) * 100)}% interval ${formatValue(o.realized_ci_low, meta.unit)} to ${formatValue(o.realized_ci_high, meta.unit)} (Student's t with 9 degrees of freedom on the spread of the ten imputations).`}
          </p>
        )}
      </div>
      <dl className="kv">
        <dt>Observation ID</dt>
        <dd className="mono">{o.observation_id}</dd>
        <dt>Period</dt>
        <dd>
          {o.period_start} to {o.period_end} ({PERIOD_KIND_LABELS[meta.period_kind] ?? meta.period_kind})
        </dd>
        <dt>Estimate type</dt>
        <dd>{words(o.estimate_type)}</dd>
        <dt>Extraction</dt>
        <dd>
          {words(o.extraction_method)}
          {o.review_status && <> · {words(o.review_status)}</>}
        </dd>
        {o.raw_value !== null && (
          <>
            <dt>As published</dt>
            <dd>
              {o.raw_value} {words(o.raw_unit)}
              {o.multiplier !== null && o.multiplier !== 1 && <> × {o.multiplier.toLocaleString("en-US")}</>}
            </dd>
          </>
        )}
        <dt>Comparability group</dt>
        <dd className="mono">{o.comparability_group}</dd>
        {o.quality_flags && (
          <>
            <dt>Quality flags</dt>
            <dd>{o.quality_flags.split("|").map(words).join("; ")}</dd>
          </>
        )}
        {o.footnote && (
          <>
            <dt>Footnote</dt>
            <dd>{o.footnote}</dd>
          </>
        )}
        <dt>Series</dt>
        <dd className="mono">
          {o.source_series} · {o.source_vintage}
        </dd>
        <dt>Candidates</dt>
        <dd>
          {o.candidate_count} — {o.selection_reason}
        </dd>
      </dl>
      <h3>Source</h3>
      <SourceRef assetId={o.asset_id} locator={o.source_locator} page={o.open_page} />
      {o.transform_id && (
        <>
          <h3>Derived from</h3>
          <p className="small">
            Method <span className="mono">{o.transform_id}</span>
          </p>
          <InputList meta={meta} ids={o.input_ids} />
        </>
      )}
      {alts.length > 0 && (
        <>
          <h3>Other candidates for this cell</h3>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Value</th>
                  <th>Series / edition</th>
                  <th>Why not preferred</th>
                </tr>
              </thead>
              <tbody>
                {alts.map((a) => (
                  <tr key={a.observation_id}>
                    <td className="num">{a.value === null ? words(a.missing_reason) : formatValue(a.value, meta.unit)}</td>
                    <td>
                      <span className="mono">{a.source_series}</span> {a.source_vintage}
                      <div className="small muted">{a.source_locator}</div>
                    </td>
                    <td className="small">{a.selection_reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {conv && (
        <>
          <h3>Converted values</h3>
          <p className="small muted">Computed by the export from the inputs listed; the published value above is unchanged.</p>
          <div className="table-wrap">
            <table className="data">
              <tbody>
                {[...conv.values()].map((c) => (
                  <tr key={c.kind}>
                    <th scope="row">{CONVERSION_LABELS[c.kind]}</th>
                    <td className="num">
                      {c.value === null ? "—" : formatValue(c.value, c.kind === "real_cy2024" ? "usd_constant_cy2024" : "usd_nominal_per_person")}
                    </td>
                    <td className="small">
                      {c.missing ?? <span className="mono">{c.inputs.join(", ")}</span>}
                      <div className="muted">{idx.data!.conversion_methods[c.kind]}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <h3>Definition</h3>
      <p className="small">{meta.definition}</p>
      {meta.overlap_note && <p className="small">Overlap: {meta.overlap_note}</p>}
      {meta.notes && <p className="small muted">{meta.notes}</p>}
      <p className="small">
        <Go to={{ v: "coverage", fam: meta.family, m: meta.metric_id, cell: `${o.geo_id}|${o.year}` }} reset>
          Show this cell in Coverage
        </Go>
      </p>
    </article>
  );
}

function InputList({ meta, ids }: { meta: MetricMeta; ids: string[] }) {
  const idx = useData<MetricsIndex>("metrics.json");
  const metas = (idx.data?.metrics ?? []).filter((m) => meta.input_metrics.includes(m.metric_id));
  const files = useMany<MetricFile>(metas.map((m) => m.file));
  const defl = useData<Deflators>(meta.input_metrics.includes("deflators") ? "deflators.json" : null);
  // Monthly inputs (the DABS fiscal-year sums) live in monthly/<measure>.json, named "monthly:<measure>".
  const monthlyIds = meta.input_metrics.filter((m) => m.startsWith("monthly:")).map((m) => m.slice("monthly:".length));
  const mIdx = useData<{ series: MonthlyMeta[] }>(monthlyIds.length ? "monthly.json" : null);
  const mMetas = (mIdx.data?.series ?? []).filter((s) => monthlyIds.includes(s.measure_id));
  const mFiles = useMany<MonthlyFile>(mMetas.map((s) => s.file));
  if (files.loading || mFiles.loading || (monthlyIds.length > 0 && !mIdx.data)) return <Loading what="the inputs" />;
  const rows = ids.map((id) => {
    if (defl.data?.months[id]) {
      const m = defl.data.months[id];
      return { id, what: `CPI-U ${m.month}`, value: formatValue(m.value, "index_1982_84_eq_100"), rec: null as string | null };
    }
    for (let i = 0; i < metas.length; i++) {
      const o = files.data ? decodeMetric(files.data[i]).byId.get(id) : undefined;
      if (o) {
        return {
          id,
          what: `${metas[i].label}, ${o.period_label}`,
          value: formatValue(o.value, metas[i].unit),
          rec: `obs:${metas[i].metric_id}:${id}`,
        };
      }
    }
    for (let i = 0; i < mMetas.length; i++) {
      const f = mFiles.data?.[i];
      if (!f) continue;
      const c = Object.fromEntries(f.columns.map((k, j) => [k, j]));
      const r = f.rows.find((x) => x[c.observation_id] === id);
      if (r) {
        return {
          id,
          what: `${mMetas[i].label}, ${String(r[c.period_label])} (${String(r[c.source_locator])})`,
          value: formatValue(r[c.value] as number | null, mMetas[i].unit),
          rec: null,
        };
      }
    }
    return { id, what: "not found among the exported preferred values", value: "", rec: null };
  });
  return (
    <ul className="small source-list">
      {rows.map((r) => (
        <li key={r.id}>
          {r.rec ? <RecordLink rec={r.rec}>{r.what}</RecordLink> : r.what}: {r.value} <span className="mono muted">{r.id}</span>
        </li>
      ))}
    </ul>
  );
}

// ----- policy ------------------------------------------------------------------------------------

function PolicyRecord({ id }: { id: string }) {
  const pol = useData<PolicyData>("policy.json");
  const geos = useData<Geography[]>("geographies.json");
  if (pol.error) return <ErrorNote error={pol.error} />;
  if (!pol.data || !geos.data) return <Loading what="the policy record" />;
  const e = pol.data.events.find((x) => x.policy_id === id);
  if (!e) return <Empty>No policy interval named {id}.</Empty>;
  const runs = pol.data.ledger_runs.filter((r) => e.ledger_claims.includes(r.claim_id));
  const snaps = pol.data.snapshots.filter((s) => s.policy_id === e.policy_id);
  const st = pol.data.statuses;
  return (
    <article>
      <h2 id="drawer-title">
        {geoName(e.geo_id, geos.data)}: {e.dimension_label}
      </h2>
      <p>
        <strong>{words(e.policy_value)}</strong>
        {e.value_detail && <> — {e.value_detail}</>}
      </p>
      <dl className="kv">
        <dt>Applies to</dt>
        <dd>
          {e.outlet}; beverage: {words(e.beverage)}; {words(e.authority_layer)} law
          {e.requires_local_adoption && "; only where a locality adopts it"}
        </dd>
        <dt>Enacted</dt>
        <dd>{e.enactment_date ?? "not recorded"}</dd>
        <dt>Legal effective start</dt>
        <dd>
          {e.effective_start ? `${e.effective_start} (${e.effective_start_precision})` : "unknown (never assumed)"}
        </dd>
        <dt>Operational start</dt>
        <dd>
          {e.operational_start ? `${e.operational_start} (${e.operational_precision})` : "not established"}
          <div className="small muted">{e.operational_note}</div>
        </dd>
        <dt>Ends</dt>
        <dd>
          {e.effective_end ? `${e.effective_end} (exclusive)` : "—"} · {words(e.end_status)}
        </dd>
        <dt>Verified in force</dt>
        <dd>
          {e.known_in_effect_from ?? e.effective_start ?? "?"} to{" "}
          {e.known_in_effect_through ?? (e.effective_end ? `the day before ${e.effective_end}` : "?")}
          <div className="small muted">Days outside this window are shown as unknown, not as this value.</div>
        </dd>
        <dt>Extraction</dt>
        <dd title={st.extraction?.[e.extraction_status]}>{words(e.extraction_status)}</dd>
        <dt>Dates rest on</dt>
        <dd title={st.temporal?.[e.temporal_status]}>
          {words(e.temporal_status)} <span className="small muted">— {st.temporal?.[e.temporal_status]}</span>
        </dd>
        <dt>Legal review</dt>
        <dd>
          {words(e.legal_review_status)} <span className="small muted">— {st.legal_review?.[e.legal_review_status]}</span>
        </dd>
        <dt>Claim</dt>
        <dd>{words(e.claim_status)}</dd>
      </dl>
      {e.notes && <p className="small">{e.notes}</p>}
      {snaps.map((s) => (
        <div className="note" key={s.snapshot_id}>
          <strong>
            Snapshot, {s.observed_on ?? s.observed_year} ({s.observed_precision} precision):
          </strong>{" "}
          {s.notes} <RecordLink rec={`snapshot:${s.snapshot_id}`}>Snapshot record</RecordLink>
        </div>
      ))}
      <h3>Evidence ({e.evidence.length})</h3>
      {e.evidence.map((ev) => (
        <div className="obs-card" key={ev.evidence_id}>
          <div className="small">
            <span className="tag">{words(ev.supports)}</span>
            <span className="tag">{words(ev.evidence_strength)}</span>
            <span className="mono">{ev.evidence_id}</span>
          </div>
          <p className="small">
            <strong>{ev.citation}</strong> — {ev.locator}
          </p>
          <blockquote className="small" style={{ margin: "4px 0 6px 0" }}>
            {ev.excerpt_or_paraphrase}
          </blockquote>
          <div className="small muted">
            Extracted by {ev.extracted_by} on {ev.extracted_on};{" "}
            {ev.reviewed_by ? `reviewed by ${ev.reviewed_by} on ${ev.reviewed_on}` : "not reviewed by a person"}
          </div>
          <SourceRef assetId={ev.asset_id} page={ev.page} />
        </div>
      ))}
      {runs.length > 0 && (
        <>
          <h3>Day-by-day ledger runs</h3>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Claim</th>
                  <th>Verified from</th>
                  <th>Through</th>
                  <th>Days</th>
                  <th>Dates rest on</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.claim_id + r.verified_from}>
                    <td className="mono">{r.claim_id}</td>
                    <td>{r.verified_from}</td>
                    <td>{r.verified_through}</td>
                    <td className="num">{Number(r.days).toLocaleString("en-US")}</td>
                    <td>{words(r.temporal_status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {e.dependencies.length > 0 && (
        <>
          <h3>Provisions the conclusion depends on</h3>
          <ul className="small source-list">
            {e.dependencies.map((d, i) => (
              <li key={i}>
                <strong>{String(d.provision)}</strong> ({words(String(d.role))}
                {d.indispensable ? ", indispensable" : ""}): {String(d.reasoning)}
              </li>
            ))}
          </ul>
        </>
      )}
      {e.exceptions.length > 0 && (
        <>
          <h3>Exceptions and special channels examined</h3>
          <ul className="small source-list">
            {e.exceptions.map((x) => (
              <li key={String(x.exception_id)}>
                <strong>{x.provision}</strong>: {x.transaction} — {x.relevance_decision}
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="small">
        <Go to={{ v: "timeline", geo: e.geo_id, dim: e.policy_dimension }} reset>
          Show on the policy timeline
        </Go>
      </p>
    </article>
  );
}

function SnapshotRecord({ id }: { id: string }) {
  const pol = useData<PolicyData>("policy.json");
  const geos = useData<Geography[]>("geographies.json");
  if (pol.error) return <ErrorNote error={pol.error} />;
  if (!pol.data || !geos.data) return <Loading what="the snapshot" />;
  const s = pol.data.snapshots.find((x) => x.snapshot_id === id);
  if (!s) return <Empty>No snapshot named {id}.</Empty>;
  const dim = pol.data.dimensions[s.policy_dimension];
  return (
    <article>
      <h2 id="drawer-title">
        {geoName(s.geo_id, geos.data)}: {dim?.label ?? s.policy_dimension}
      </h2>
      <p>
        <strong>{words(s.policy_value)}</strong>
        {s.value_detail && <> — {s.value_detail}</>}
      </p>
      <p className="note small">
        A dated snapshot: the status this source shows on {s.observed_on ?? `some day in ${s.observed_year}`}. It says nothing
        about earlier or later days, which stay unknown until other evidence covers them.
      </p>
      <dl className="kv">
        <dt>Observed</dt>
        <dd>
          {s.observed_on ?? `${s.observed_year} (year only)`} · basis: {words(s.observed_basis)}
        </dd>
        <dt>Citation</dt>
        <dd>
          {s.citation} — {s.locator}
        </dd>
        <dt>Evidence</dt>
        <dd>{words(s.evidence_strength)}</dd>
        <dt>Support</dt>
        <dd>{SUPPORT_LABELS[s.support_basis]?.long ?? words(s.support_basis)}</dd>
        <dt>Extraction</dt>
        <dd>{words(s.extraction_status)}</dd>
        <dt>Legal review</dt>
        <dd>
          {words(s.legal_review_status)}
          {s.reviewed_by ? ` by ${s.reviewed_by} on ${s.reviewed_on}` : " (not reviewed by a person)"}
        </dd>
        <dt>Extracted</dt>
        <dd>
          {s.extracted_by}, {s.extracted_on}
        </dd>
        {s.policy_id && (
          <>
            <dt>Interval</dt>
            <dd>
              <RecordLink rec={`policy:${s.policy_id}`}>{s.policy_id}</RecordLink>
            </dd>
          </>
        )}
      </dl>
      <blockquote className="small">{s.excerpt}</blockquote>
      {s.notes && <p className="small">{s.notes}</p>}
      <h3>Source</h3>
      <SourceRef assetId={s.asset_id} locator={s.locator} />
      <p className="small">
        <Go to={{ v: "timeline", dim: s.policy_dimension }} reset>
          This policy in every jurisdiction
        </Go>
      </p>
    </article>
  );
}

// ----- source asset, lead, gap -------------------------------------------------------------------

function AssetRecord({ id }: { id: string }) {
  const src = useData<SourcesData>("sources.json");
  const idx = useData<MetricsIndex>("metrics.json");
  const geos = useData<Geography[]>("geographies.json");
  if (src.error) return <ErrorNote error={src.error} />;
  if (!src.data || !idx.data || !geos.data) return <Loading what="the source record" />;
  const a = src.data.assets.find((x) => x.asset_id === id);
  if (!a) return <Empty>No source asset named {id}.</Empty>;
  const s = src.data.sources.find((x) => x.source_id === a.source_id);
  const measures = Object.entries(a.observations_by_measure);
  return (
    <article>
      <h2 id="drawer-title">{a.title ?? s?.title ?? a.asset_id}</h2>
      <p className="small">
        {s?.publisher} · <span className="mono">{a.asset_id}</span>
      </p>
      <SourceRef assetId={a.asset_id} />
      <dl className="kv">
        <dt>Edition</dt>
        <dd>{a.edition}</dd>
        <dt>Landing page</dt>
        <dd>{a.landing_url ? <a href={a.landing_url} target="_blank" rel="noreferrer noopener">{a.landing_url}</a> : "—"}</dd>
        <dt>File URL</dt>
        <dd className="mono">{a.url ?? "none (manual import)"}</dd>
        <dt>Access</dt>
        <dd>
          {words(a.acquisition_status)} · {a.access_method ?? words(a.request_method)}
          {a.authentication && <> · {a.authentication}</>}
        </dd>
        <dt>Format / size</dt>
        <dd>
          {a.format} · {bytes(a.bytes)}
          {a.pdf_pages ? ` · ${a.pdf_pages} pages` : ""}
        </dd>
        <dt>Retrieved</dt>
        <dd>{a.retrieved_at ?? "—"}</dd>
        <dt>SHA-256</dt>
        <dd className="mono">{a.sha256 ?? "—"}</dd>
        <dt>Rights</dt>
        <dd>
          {words(a.rights_status)} · raw file {a.redistribute_raw ? "may be redistributed" : "is not redistributed"}
          {a.rights_notes && <div className="small muted">{a.rights_notes}</div>}
        </dd>
        <dt>Held locally</dt>
        <dd>{a.local_copy ? (a.local_copy_servable ? "yes (servable in development)" : "yes (not served: rights)") : "no"}</dd>
        <dt>Extraction</dt>
        <dd>
          {a.parser ? `${a.parser} ${a.parser_version ?? ""}` : "—"} {a.extraction_status && <>· {words(a.extraction_status)}</>}
        </dd>
        <dt>Jurisdictions</dt>
        <dd>{a.jurisdictions.map((g) => geoName(g, geos.data!)).join(", ") || "—"}</dd>
        {a.blockers && (
          <>
            <dt>Blockers</dt>
            <dd>{a.blockers}</dd>
          </>
        )}
        {a.next_action && (
          <>
            <dt>Next action</dt>
            <dd>{a.next_action}</dd>
          </>
        )}
      </dl>
      {a.notes && <p className="small">{a.notes}</p>}
      <h3>Records it supports</h3>
      {measures.length === 0 && a.evidence.length === 0 && !a.used_by_legal_ledger && (
        <Empty>No exported record cites this asset.</Empty>
      )}
      {measures.length > 0 && (
        <ul className="small source-list">
          {measures.map(([m, c]) => {
            const metric = idx.data!.metrics.find((x) => x.measure_id === m);
            return (
              <li key={m}>
                {metric ? (
                  <Go to={{ v: "coverage", fam: metric.family, m: metric.metric_id }} reset>
                    {metric.label}
                  </Go>
                ) : (
                  m
                )}
                : {c.rows.toLocaleString("en-US")} rows, {c.values.toLocaleString("en-US")} with a value, {c.first_year}–
                {c.last_year}
              </li>
            );
          })}
        </ul>
      )}
      {a.evidence.length > 0 && (
        <ul className="small source-list">
          {a.evidence.map((e) => (
            <li key={e.evidence_id}>
              Evidence <span className="mono">{e.evidence_id}</span> for{" "}
              <RecordLink rec={`policy:${e.policy_id}`}>{e.policy_id}</RecordLink>
            </li>
          ))}
        </ul>
      )}
      {a.used_by_legal_ledger && (
        <p className="small">Used by the Utah legal-history ledger (metadata/legal_history/).</p>
      )}
    </article>
  );
}

function LeadRecord({ id }: { id: string }) {
  const res = useData<Research>("research.json");
  if (!res.data) return <Loading what="the source lead" />;
  const l = res.data.leads.find((x) => x.lead_id === id);
  if (!l) return <Empty>No source lead named {id}.</Empty>;
  return (
    <article>
      <h2 id="drawer-title">{l.title}</h2>
      <p className="warn small">Not held in the dataset. Listed so the evidence trail shows what is still needed.</p>
      <dl className="kv">
        <dt>Publisher</dt>
        <dd>{l.publisher}</dd>
        <dt>Access</dt>
        <dd>{words(l.access_status)}</dd>
        <dt>Landing page</dt>
        <dd>
          {l.landing_url ? (
            <a href={l.landing_url} target="_blank" rel="noreferrer noopener">
              {l.landing_url}
            </a>
          ) : (
            "Not recorded"
          )}
        </dd>
        {l.direct_url && (
          <>
            <dt>Confirmed file URL</dt>
            <dd className="mono">{l.direct_url}</dd>
          </>
        )}
        <dt>Periods</dt>
        <dd>{l.periods}</dd>
        <dt>Attempted</dt>
        <dd>{l.attempted}</dd>
        <dt>Next action</dt>
        <dd>{l.next_action}</dd>
        <dt>Rights</dt>
        <dd>{l.rights_note}</dd>
      </dl>
      <h3>Needed for</h3>
      <ul className="small source-list">
        {l.needed_for.split("|").filter(Boolean).map((g) => (
          <li key={g}>
            <RecordLink rec={`gap:${g}`}>{res.data!.gaps.find((x) => x.gap_id === g)?.title ?? g}</RecordLink>
          </li>
        ))}
      </ul>
    </article>
  );
}

function GapRecord({ id }: { id: string }) {
  const res = useData<Research>("research.json");
  const geos = useData<Geography[]>("geographies.json");
  if (!res.data || !geos.data) return <Loading what="the research gap" />;
  const g = res.data.gaps.find((x) => x.gap_id === id);
  if (!g) return <Empty>No research gap named {id}.</Empty>;
  return (
    <article>
      <h2 id="drawer-title">{g.title}</h2>
      <p className="small">
        <span className="tag">priority {g.priority}</span>
        <span className="tag">{res.data.categories[g.category]}</span>
        <span className="tag">{words(g.status)}</span>
        <span className="tag">owner: {g.owner}</span>
      </p>
      <dl className="kv">
        <dt>Why it matters</dt>
        <dd>{g.why_it_matters}</dd>
        <dt>Blocks</dt>
        <dd>{g.blocks}</dd>
        <dt>Affects</dt>
        <dd>
          {g.affected_geos.map((x) => (x === "multi" ? "several states" : geoName(x, geos.data!))).join(", ") || "—"};{" "}
          {g.affected_periods}
          {g.affected_measures.length > 0 && <div className="mono small">{g.affected_measures.join(", ")}</div>}
        </dd>
        <dt>Next action</dt>
        <dd>{g.next_action}</dd>
        <dt>Obstacle</dt>
        <dd>{g.access_obstacle}</dd>
        <dt>Updated</dt>
        <dd>{g.updated_on}</dd>
      </dl>
      {g.lead_ids.length > 0 && (
        <>
          <h3>Source leads</h3>
          <ul className="small source-list">
            {g.lead_ids.map((l) => (
              <li key={l}>
                <RecordLink rec={`lead:${l}`}>{res.data!.leads.find((x) => x.lead_id === l)?.title ?? l}</RecordLink>
              </li>
            ))}
          </ul>
        </>
      )}
    </article>
  );
}

