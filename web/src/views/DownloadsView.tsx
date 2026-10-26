// Downloads: the packaged release (when built locally), and register-level CSVs.
import { Empty, ErrorNote, Go, Loading } from "../components/common";
import { saveFile, toCsv } from "../lib/csv";
import { useData } from "../lib/data";
import { bytes } from "../lib/format";
import type { Gap, Manifest, PolicyData, PolicyEvent, Research, SourcesData } from "../lib/types";

export function DownloadsView({ manifest }: { manifest: Manifest }) {
  const src = useData<SourcesData>("sources.json");
  const res = useData<Research>("research.json");
  const pol = useData<PolicyData>("policy.json");
  if (src.error ?? res.error ?? pol.error) return <ErrorNote error={(src.error ?? res.error ?? pol.error)!} />;
  if (!src.data || !res.data || !pol.data) return <Loading what="downloads" />;
  const rel = src.data.release;
  return (
    <div className="grid-2">
      <section className="panel">
        <h2>Full release</h2>
        {!rel ? (
          <Empty>
            No packaged release found for {manifest.dataset.release_version}. Build one with{" "}
            <span className="mono">alcohol-data package --version {manifest.dataset.release_version}</span>.
          </Empty>
        ) : (
          <>
            {!rel.matches_current_build && (
              <p className="warn small">
                The local package ({rel.release_id}, build {rel.build_id}) was made from an earlier database build than the one
                this dashboard shows ({manifest.dataset.build_id}). Re-run <span className="mono">alcohol-data package</span> to
                match.
              </p>
            )}
            <p className="small">
              Release <span className="mono">{rel.release_id}</span>, from commit <span className="mono">{rel.code_commit?.slice(0, 12)}</span>.
              Locally the files are served by the development server; a hosted copy serves the ones listed here.
            </p>
            <ul className="small source-list">
              {rel.files.map((f) => (
                <li key={f.name}>
                  <a href={`/release/${f.name}`}>{f.name}</a> ({bytes(f.bytes)})
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="small muted">
          Code is MIT-licensed; data follow each source's terms (DATA_LICENSE.md, THIRD_PARTY_NOTICES.md). Files whose
          redistribution is not cleared are listed with links, never bundled.
        </p>
      </section>
      <section className="panel">
        <h2>Filtered downloads</h2>
        <p className="small">
          Every view offers a download of exactly what it shows: <Go to={{ v: "coverage" }} reset>Coverage</Go> (the matrix and
          a metric's observations), <Go to={{ v: "revenue" }} reset>Revenue</Go> (the values and conversions charted),{" "}
          <Go to={{ v: "compare" }} reset>Compare</Go> (the year shown) and <Go to={{ v: "sources" }} reset>Sources</Go> (the
          filtered source and lead records). Bundles carry measures.csv, sources.csv, filters.json and a README explaining
          the joins.
        </p>
        <div className="row-actions">
          <button type="button" onClick={() => saveFile("research_gaps.csv", gapsCsv(res.data!.gaps), "text/csv")}>
            Research gaps (CSV)
          </button>
          <button type="button" onClick={() => saveFile("policy_intervals_and_evidence.csv", policyCsv(pol.data!.events), "text/csv")}>
            Policy intervals with evidence (CSV)
          </button>
        </div>
      </section>
      <section className="panel">
        <h2>This export</h2>
        <dl className="kv">
          <dt>Schema</dt>
          <dd className="mono">{manifest.schema_version}</dd>
          <dt>Dataset</dt>
          <dd>{manifest.dataset.release_label}</dd>
          <dt>Database built</dt>
          <dd>
            {manifest.dataset.built_at} from <span className="mono">{manifest.dataset.built_from_commit}</span>
          </dd>
          <dt>Sources retrieved</dt>
          <dd>
            {manifest.dataset.source_retrieval_first} to {manifest.dataset.source_retrieval_last}
          </dd>
          <dt>Exported</dt>
          <dd>
            {manifest.export.generated_at} from <span className="mono">{manifest.export.exported_from_commit}</span>
          </dd>
        </dl>
        <table className="data">
          <tbody>
            {Object.entries(manifest.counts).map(([k, v]) => (
              <tr key={k}>
                <th scope="row">{k.replaceAll("_", " ")}</th>
                <td className="num">{v.toLocaleString("en-US")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function gapsCsv(gaps: Gap[]) {
  return toCsv<Gap>(
    [
      { key: "gap_id", kind: "text", get: (g) => g.gap_id },
      { key: "priority", kind: "number", get: (g) => g.priority },
      { key: "category", kind: "text", get: (g) => g.category },
      { key: "title", kind: "text", get: (g) => g.title },
      { key: "affected_measures", kind: "list", get: (g) => g.affected_measures },
      { key: "affected_geos", kind: "list", get: (g) => g.affected_geos },
      { key: "affected_periods", kind: "text", get: (g) => g.affected_periods },
      { key: "why_it_matters", kind: "text", get: (g) => g.why_it_matters },
      { key: "blocks", kind: "text", get: (g) => g.blocks },
      { key: "lead_ids", kind: "list", get: (g) => g.lead_ids },
      { key: "next_action", kind: "text", get: (g) => g.next_action },
      { key: "access_obstacle", kind: "text", get: (g) => g.access_obstacle },
      { key: "status", kind: "text", get: (g) => g.status },
      { key: "owner", kind: "text", get: (g) => g.owner },
      { key: "updated_on", kind: "date", get: (g) => g.updated_on },
    ],
    gaps,
  );
}

function policyCsv(events: PolicyEvent[]) {
  type R = { e: PolicyEvent; i: number };
  const rows: R[] = events.flatMap((e) => (e.evidence.length ? e.evidence.map((_, i) => ({ e, i })) : [{ e, i: -1 }]));
  const ev = (r: R) => (r.i >= 0 ? r.e.evidence[r.i] : undefined);
  return toCsv<R>(
    [
      { key: "policy_id", kind: "text", get: (r) => r.e.policy_id },
      { key: "geo_id", kind: "text", get: (r) => r.e.geo_id },
      { key: "policy_dimension", kind: "text", get: (r) => r.e.policy_dimension },
      { key: "policy_value", kind: "text", get: (r) => r.e.policy_value },
      { key: "enactment_date", kind: "date", get: (r) => r.e.enactment_date },
      { key: "effective_start", kind: "date", get: (r) => r.e.effective_start },
      { key: "effective_start_precision", kind: "text", get: (r) => r.e.effective_start_precision },
      { key: "effective_end", kind: "date", get: (r) => r.e.effective_end },
      { key: "end_status", kind: "text", get: (r) => r.e.end_status },
      { key: "known_in_effect_from", kind: "date", get: (r) => r.e.known_in_effect_from },
      { key: "known_in_effect_through", kind: "date", get: (r) => r.e.known_in_effect_through },
      { key: "operational_start", kind: "date", get: (r) => r.e.operational_start },
      { key: "temporal_status", kind: "text", get: (r) => r.e.temporal_status },
      { key: "legal_review_status", kind: "text", get: (r) => r.e.legal_review_status },
      { key: "evidence_id", kind: "text", get: (r) => ev(r)?.evidence_id },
      { key: "asset_id", kind: "text", get: (r) => ev(r)?.asset_id },
      { key: "citation", kind: "text", get: (r) => ev(r)?.citation },
      { key: "locator", kind: "text", get: (r) => ev(r)?.locator },
      { key: "supports", kind: "text", get: (r) => ev(r)?.supports },
      { key: "excerpt_or_paraphrase", kind: "text", get: (r) => ev(r)?.excerpt_or_paraphrase },
    ],
    rows,
  );
}
