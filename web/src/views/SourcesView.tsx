// View 5 — Source explorer. Held files and sources not yet held (leads) stay side by side, so a source
// that cannot be fetched today does not drop out of the evidence trail.
import { ErrorNote, Loading, RecordLink } from "../components/common";
import { saveFile, toCsv } from "../lib/csv";
import { useData } from "../lib/data";
import { bytes, geoName, words } from "../lib/format";
import type { Asset, Geography, Lead, SourcesData } from "../lib/types";
import { navigate, pickInt, pickOne, useParams } from "../lib/url";

type Use = "parsed" | "transcribed" | "legal" | "held";
const USE_LABELS: Record<Use, string> = {
  parsed: "Values parsed by code",
  transcribed: "Values transcribed by hand (unreviewed)",
  legal: "Legal text (machine-assisted review)",
  held: "Held, not cited by any record",
};

function useOf(a: Asset): Use {
  if (a.parser) return "parsed";
  if (Object.keys(a.observations_by_measure).length) return "transcribed";
  if (a.evidence.length || a.used_by_legal_ledger) return "legal";
  return "held";
}

function yearsOf(a: Asset): [number, number] | null {
  const obs = Object.values(a.observations_by_measure);
  if (obs.length) return [Math.min(...obs.map((o) => o.first_year)), Math.max(...obs.map((o) => o.last_year))];
  const ys = [...`${a.edition} ${a.title ?? ""}`.matchAll(/\b(1[89]\d\d|20\d\d)\b/g)].map((m) => Number(m[1]));
  return ys.length ? [Math.min(...ys), Math.max(...ys)] : null;
}

export function SourcesView() {
  const params = useParams();
  const src = useData<SourcesData>("sources.json");
  const geos = useData<Geography[]>("geographies.json");
  if (src.error ?? geos.error) return <ErrorNote error={(src.error ?? geos.error)!} />;
  if (!src.data || !geos.data) return <Loading what="sources" />;
  const S = src.data;
  const publishers = [...new Set(S.sources.map((s) => s.publisher))].sort();
  const families = [...new Set(S.sources.map((s) => s.source_family))].sort();
  const jurs = [...new Set(S.assets.flatMap((a) => a.jurisdictions))].sort();
  const access = [...new Set([...S.assets.map((a) => a.acquisition_status), ...S.leads.map((l) => l.access_status)])].sort();
  const kind = pickOne(params.get("kind"), ["all", "held", "leads"] as const, "all");
  const q = (params.get("q") ?? "").slice(0, 100);
  const pub = pickOne(params.get("pub"), ["", ...publishers], "");
  const fam = pickOne(params.get("fam"), ["", ...families], "");
  const jur = pickOne(params.get("jur"), ["", ...jurs], "");
  const acc = pickOne(params.get("acc"), ["", ...access], "");
  const use = pickOne(params.get("use"), ["", "parsed", "transcribed", "legal", "held"] as const, "");
  const red = pickOne(params.get("red"), ["", "yes", "no"] as const, "");
  const year = params.get("yr") ? pickInt(params.get("yr"), 1800, 2100, 0) : 0;
  const srcOf = new Map(S.sources.map((s) => [s.source_id, s]));
  const text = q.toLowerCase();
  const assets = S.assets.filter((a) => {
    const s = srcOf.get(a.source_id)!;
    if (pub && s.publisher !== pub) return false;
    if (fam && s.source_family !== fam) return false;
    if (jur && !a.jurisdictions.includes(jur)) return false;
    if (acc && a.acquisition_status !== acc) return false;
    if (use && useOf(a) !== use) return false;
    if (red && (red === "yes") !== a.redistribute_raw) return false;
    if (year) {
      const ys = yearsOf(a);
      if (!ys || year < ys[0] || year > ys[1]) return false;
    }
    if (text && !`${a.asset_id} ${a.title} ${a.edition} ${s.publisher} ${a.url ?? ""}`.toLowerCase().includes(text)) return false;
    return true;
  });
  const leads = S.leads.filter((l) => {
    if (pub && !l.publisher.includes(pub)) return false;
    if (jur && !l.jurisdictions.split("|").includes(jur) && l.jurisdictions !== "multi") return false;
    if (acc && l.access_status !== acc) return false;
    if (use || red || fam) return false;
    if (text && !`${l.lead_id} ${l.title} ${l.publisher}`.toLowerCase().includes(text)) return false;
    return true;
  });
  const set = (k: string, v: string) => navigate({ [k]: v || null }, { replace: k === "q" });

  return (
    <>
      <section className="panel" aria-labelledby="src-h">
        <h2 id="src-h">Sources</h2>
        <p className="small muted">
          {S.assets.length} files held (each pinned by SHA-256) from {S.sources.length} sources, and {S.leads.length} sources
          still needed. Open a record for its rights, the values or legal claims it supports, and a link to the original.
          Original files are not copied into this dashboard; restricted files (rights unresolved, or facts-only) are never
          served.
        </p>
        <div className="controls">
          <label>
            Search
            <input type="search" value={q} onChange={(e) => set("q", e.target.value)} placeholder="title, ID, publisher, URL" />
          </label>
          <label>
            Show
            <select value={kind} onChange={(e) => set("kind", e.target.value === "all" ? "" : e.target.value)}>
              <option value="all">Held files and leads</option>
              <option value="held">Held files only</option>
              <option value="leads">Sources not held (leads)</option>
            </select>
          </label>
          <label>
            Publisher
            <select value={pub} onChange={(e) => set("pub", e.target.value)}>
              <option value="">Any</option>
              {publishers.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label>
            Jurisdiction
            <select value={jur} onChange={(e) => set("jur", e.target.value)}>
              <option value="">Any</option>
              {jurs.map((j) => (
                <option key={j} value={j}>
                  {geoName(j, geos.data!)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Type
            <select value={fam} onChange={(e) => set("fam", e.target.value)}>
              <option value="">Any</option>
              {families.map((f) => (
                <option key={f} value={f}>
                  {words(f)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Covers year
            <input type="number" value={year || ""} min={1800} max={2100} onChange={(e) => set("yr", e.target.value)} />
          </label>
          <label>
            Access
            <select value={acc} onChange={(e) => set("acc", e.target.value)}>
              <option value="">Any</option>
              {access.map((a) => (
                <option key={a} value={a}>
                  {words(a)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Review / use
            <select value={use} onChange={(e) => set("use", e.target.value)}>
              <option value="">Any</option>
              {(Object.keys(USE_LABELS) as Use[]).map((u) => (
                <option key={u} value={u}>
                  {USE_LABELS[u]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Raw file redistributable
            <select value={red} onChange={(e) => set("red", e.target.value)}>
              <option value="">Any</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
        </div>
        <div className="row-actions">
          <button type="button" onClick={() => saveFile("sources_filtered.csv", assetsCsv(assets, srcOf), "text/csv")}>
            Download these {assets.length} source records (CSV)
          </button>
          <button type="button" onClick={() => saveFile("source_leads_filtered.csv", leadsCsv(leads), "text/csv")}>
            Download these {leads.length} leads (CSV)
          </button>
        </div>
      </section>
      {kind !== "leads" && (
        <section className="panel" aria-labelledby="held-h">
          <h3 id="held-h">Held files ({assets.length})</h3>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Publisher</th>
                  <th>Jurisdictions</th>
                  <th>Years</th>
                  <th>Use</th>
                  <th>Rights</th>
                  <th>Size</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((a) => {
                  const ys = yearsOf(a);
                  return (
                    <tr key={a.asset_id}>
                      <td>
                        <RecordLink rec={`asset:${a.asset_id}`}>{a.title ?? srcOf.get(a.source_id)?.title}</RecordLink>
                        <div className="small muted">{a.edition}</div>
                      </td>
                      <td className="small">{srcOf.get(a.source_id)?.publisher}</td>
                      <td className="small">{a.jurisdictions.length > 3 ? `${a.jurisdictions.length} jurisdictions` : a.jurisdictions.map((j) => geoName(j, geos.data!)).join(", ") || "—"}</td>
                      <td className="small">{ys ? (ys[0] === ys[1] ? ys[0] : `${ys[0]}–${ys[1]}`) : "—"}</td>
                      <td className="small">{USE_LABELS[useOf(a)]}</td>
                      <td className="small">
                        {words(a.rights_status)}
                        {!a.redistribute_raw && <div className="muted">raw file not redistributed</div>}
                      </td>
                      <td className="small num">{bytes(a.bytes)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {kind !== "held" && (
        <section className="panel" aria-labelledby="leads-h">
          <h3 id="leads-h">Sources not held ({leads.length})</h3>
          <p className="small muted">Each names what was tried, when, and what it would unblock. Nothing has been requested or bought.</p>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Publisher</th>
                  <th>Access</th>
                  <th>Periods</th>
                  <th>Next action</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.lead_id}>
                    <td>
                      <RecordLink rec={`lead:${l.lead_id}`}>{l.title}</RecordLink>
                    </td>
                    <td className="small">{l.publisher}</td>
                    <td className="small">{words(l.access_status)}</td>
                    <td className="small">{l.periods}</td>
                    <td className="small">{l.next_action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

function assetsCsv(assets: Asset[], srcOf: Map<string, { publisher: string }>) {
  return toCsv<Asset>(
    [
      { key: "asset_id", kind: "text", get: (a) => a.asset_id },
      { key: "source_id", kind: "text", get: (a) => a.source_id },
      { key: "publisher", kind: "text", get: (a) => srcOf.get(a.source_id)?.publisher },
      { key: "title", kind: "text", get: (a) => a.title },
      { key: "edition", kind: "text", get: (a) => a.edition },
      { key: "url", kind: "text", get: (a) => a.url },
      { key: "landing_url", kind: "text", get: (a) => a.landing_url },
      { key: "retrieved_at", kind: "text", get: (a) => a.retrieved_at },
      { key: "sha256", kind: "text", get: (a) => a.sha256 },
      { key: "bytes", kind: "number", get: (a) => a.bytes },
      { key: "format", kind: "text", get: (a) => a.format },
      { key: "acquisition_status", kind: "text", get: (a) => a.acquisition_status },
      { key: "rights_status", kind: "text", get: (a) => a.rights_status },
      { key: "redistribute_raw", kind: "bool", get: (a) => a.redistribute_raw },
      { key: "use", kind: "text", get: (a) => useOf(a) },
      { key: "jurisdictions", kind: "list", get: (a) => a.jurisdictions },
      { key: "evidence_ids", kind: "list", get: (a) => a.evidence.map((e) => e.evidence_id) },
      { key: "measures", kind: "list", get: (a) => Object.keys(a.observations_by_measure) },
    ],
    assets,
  );
}

function leadsCsv(leads: Lead[]) {
  const keys: (keyof Lead)[] = ["lead_id", "publisher", "title", "jurisdictions", "source_type", "landing_url", "direct_url", "periods", "access_status", "attempted", "needed_for", "next_action", "rights_note"];
  return toCsv<Lead>(
    keys.map((k) => ({ key: k, kind: "text" as const, get: (l: Lead) => l[k] })),
    leads,
  );
}
