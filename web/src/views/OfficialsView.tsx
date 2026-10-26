// Officials and committees — a reference directory of who the source records as holding (or having held) office,
// and which committees it lists them on. It is separate from the observations and the scenario tool, and it is a
// directory, not an analysis: nothing here scores, ranks or contacts anyone.
//
// Rules the page keeps (see docs/research-dashboard/officials.md):
// * "Current in source" is the archive's own listing at its snapshot date; it is never shown as confirmed.
// * Contact details exist only for records current in the source (the export drops them for everyone else).
// * A chosen date uses role dates only; committee membership has no dates and is never date-filtered.
// * Serving, sponsoring, voting and referral are different things; only the first can be read from this data.
import { useMemo, useState } from "react";
import { Empty, ErrorNote, Go, Loading } from "../components/common";
import { saveFile, toCsv, type Column } from "../lib/csv";
import { useData } from "../lib/data";
import { bytes, words } from "../lib/format";
import {
  committeeChamberLabel,
  filterRecords,
  govLabel,
  isRealDate,
  membershipsByPerson,
  options,
  placeLabel,
  SERVICE_NOTE,
  STATUS_LABELS,
  termText,
  typeLabel,
  type Committee,
  type Filters,
  type Hit,
  type JurisdictionFile,
  type OfficialRecord,
  type OfficialsIndex,
  type RegisterRow,
} from "../lib/officials";
import { navigate, pickOne, useParams } from "../lib/url";

const PAGE = 100;
const COMMITTEE_PAGE = 60;

/** The source writes some addresses with empty segments ("PO Box 1; ; Salt Lake City"); collapse them for reading. */
function tidy(s: string): string {
  return s.replace(/(\s*;\s*){2,}/g, "; ").replace(/\s+/g, " ").trim();
}

function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function OfficialsView() {
  const params = useParams();
  const idx = useData<OfficialsIndex>("officials.json");
  if (idx.error)
    return (
      <>
        <ErrorNote error={idx.error} />
        <p className="small muted">
          This view needs the officials archive. Import it once with{" "}
          <span className="mono">alcohol-data import-asset openstates_people_officials_2026_10_08 ..\people-main-officials-only.zip</span>,
          then run <span className="mono">alcohol-data dashboard export</span>.
        </p>
      </>
    );
  if (!idx.data) return <Loading what="officials and committees" />;
  const codes = idx.data.jurisdictions.map((j) => j.code);
  const jur = pickOne(params.get("jur"), codes, codes.includes("ut") ? "ut" : codes[0]);
  return <Directory index={idx.data} jur={jur} />;
}

function Directory({ index, jur }: { index: OfficialsIndex; jur: string }) {
  const params = useParams();
  const file = useData<JurisdictionFile>(`officials/${jur}.json`);
  const entry = index.jurisdictions.find((j) => j.code === jur)!;
  const snapshot = index.source.snapshot_date;

  const day = isRealDate(params.get("on")) && params.get("on")! <= snapshot ? params.get("on")! : "";
  const svc = pickOne(params.get("svc"), ["current", "former", "all"] as const, day ? "all" : "current");
  const unclear = params.get("unclear") === "1";
  const q = (params.get("q") ?? "").slice(0, 80);
  const set = (patch: Record<string, string | null>) => navigate(patch, { replace: "q" in patch });

  return (
    <>
      <section className="panel" aria-labelledby="off-h">
        <h2 id="off-h">Officials and committees</h2>
        <p className="small muted">
          A reference directory: who the source records as holding or having held office in {entry.name}, and the committees it lists them
          on. It is kept apart from the alcohol data and the revenue scenarios, and it says nothing about how anyone voted, what they
          sponsored or what they think. Nothing here scores, ranks or contacts anyone.
        </p>
        <p className="warn">
          <strong>“Current in source” is the source’s own listing as of {snapshot}.</strong> It has not been checked against an official
          roster, and a missing end date does not by itself mean someone still holds the office. Records not marked current are historical.
          Review status: <strong>{words(index.review_status)}</strong>.
        </p>
        <p className="small">
          Source: {index.source.publisher} (officials-only copy, snapshot {snapshot}), license {index.source.license ?? "not recorded"}.{" "}
          <a href="#officials-source">Citation, license and limits ↓</a>
        </p>

        <div className="controls" role="group" aria-label="Filters">
          <label>
            Jurisdiction
            <select value={jur} onChange={(e) => set({ jur: e.target.value === "ut" ? null : e.target.value, ch: null, gov: null, dist: null, com: null })}>
              {index.jurisdictions.map((j) => (
                <option key={j.code} value={j.code}>
                  {j.name} ({j.current_in_source} current, {j.records} records)
                </option>
              ))}
            </select>
          </label>
          <label>
            Show
            <select value={svc} onChange={(e) => set({ svc: e.target.value === (day ? "all" : "current") ? null : e.target.value })}>
              <option value="current">Current in source</option>
              <option value="former">Former or ended</option>
              <option value="all">All records</option>
            </select>
          </label>
          {file.data && <FileControls file={file.data} jur={jur} index={index} svc={svc} day={day} unclear={unclear} q={q} set={set} />}
          {!file.data && (
            <label>
              Name
              <input type="search" value={q} onChange={(e) => set({ q: e.target.value || null })} placeholder="name or other name" />
            </label>
          )}
          <label>
            On this date
            <input
              type="date"
              value={day}
              max={snapshot}
              onChange={(e) => set({ on: isRealDate(e.target.value) ? e.target.value : null })}
              aria-describedby="off-date-help"
            />
          </label>
          <div className="row-actions">
            <Go to={{ v: "officials", jur: jur === "ut" ? null : jur }} reset>
              Clear filters
            </Go>
          </div>
        </div>
        <span id="off-date-help" className="help">
          Uses the role dates in the source only. Records with no start date, or with dates that contradict each other, cannot say.
        </span>
      </section>

      {file.error && <ErrorNote error={file.error} />}
      {!file.data && !file.error && <Loading what={`${entry.name} records`} />}
      {file.data && <Results index={index} file={file.data} jur={jur} svc={svc} day={day} unclear={unclear} q={q} snapshot={snapshot} />}
      {file.data && <CommitteePanel index={index} file={file.data} jur={jur} />}
      <PolicyPanel index={index} jur={jur} day={day} />
      <SourcePanel index={index} />
    </>
  );
}

type Setter = (patch: Record<string, string | null>) => void;

function useFilters(file: JurisdictionFile, svc: Filters["svc"], day: string, unclear: boolean, q: string) {
  const params = useParams();
  const base = options(file.records, { chamber: "", gov: "" });
  const ch = pickOne(params.get("ch"), ["", ...base.types], "");
  const gov = pickOne(params.get("gov"), ["", ...base.govs], "");
  const opts = options(file.records, { chamber: ch, gov });
  const dist = pickOne(params.get("dist"), ["", ...opts.districts], "");
  const com = pickOne(params.get("com"), ["", ...file.committees.map((c) => c.id)], "");
  const filters: Filters = { svc, chamber: ch, gov, district: dist, committee: com, q, day, unclear };
  return { filters, base, opts };
}

function FileControls({
  file,
  svc,
  day,
  unclear,
  q,
  set,
}: {
  file: JurisdictionFile;
  jur: string;
  index: OfficialsIndex;
  svc: Filters["svc"];
  day: string;
  unclear: boolean;
  q: string;
  set: Setter;
}) {
  const { filters, base, opts } = useFilters(file, svc, day, unclear, q);
  const committees = [...file.committees].sort(
    (a, b) => a.chamber.localeCompare(b.chamber) || a.name.localeCompare(b.name),
  );
  return (
    <>
      <label>
        Chamber or office
        <select value={filters.chamber} onChange={(e) => set({ ch: e.target.value || null, dist: null })}>
          <option value="">Any</option>
          {base.types.map((t) => (
            <option key={t} value={t}>
              {typeLabel(t)}
            </option>
          ))}
        </select>
      </label>
      {base.govs.length > 1 && (
        <label>
          Government
          <select value={filters.gov} onChange={(e) => set({ gov: e.target.value || null, dist: null })}>
            <option value="">Any</option>
            {base.govs.map((g) => (
              <option key={g} value={g}>
                {govLabel(g)}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        District
        <select value={filters.district} onChange={(e) => set({ dist: e.target.value || null })}>
          <option value="">Any</option>
          {opts.districts.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </label>
      <label>
        Committee (members as of the snapshot)
        <select value={filters.committee} onChange={(e) => set({ com: e.target.value || null })}>
          <option value="">Any</option>
          {committees.map((c) => (
            <option key={c.id} value={c.id}>
              {committeeChamberLabel(c.chamber)}: {c.name} ({c.members.length})
            </option>
          ))}
        </select>
      </label>
      <label>
        Name
        <input type="search" value={q} onChange={(e) => set({ q: e.target.value || null })} placeholder="name or other name" />
      </label>
      {day && (
        <label className="check">
          <input type="checkbox" checked={unclear} onChange={(e) => set({ unclear: e.target.checked ? "1" : null })} />
          <span>Also show records whose dates cannot say</span>
        </label>
      )}
    </>
  );
}

function Results({
  index,
  file,
  jur,
  svc,
  day,
  unclear,
  q,
  snapshot,
}: {
  index: OfficialsIndex;
  file: JurisdictionFile;
  jur: string;
  svc: Filters["svc"];
  day: string;
  unclear: boolean;
  q: string;
  snapshot: string;
}) {
  const { filters } = useFilters(file, svc, day, unclear, q);
  const memberOf = useMemo(() => membershipsByPerson(file.committees), [file]);
  const hits = filterRecords(file.records, file.committees, filters);
  const key = useParams().toString();
  const [more, setMore] = useState<{ key: string; n: number }>({ key: "", n: PAGE });
  const limit = more.key === key ? more.n : PAGE;
  const withUnclear = day && !unclear ? filterRecords(file.records, file.committees, { ...filters, unclear: true }).length - hits.length : 0;
  const committee = file.committees.find((c) => c.id === filters.committee);
  const unresolved = committee?.members.filter((m) => m.unresolved) ?? [];
  const jurName = index.jurisdictions.find((j) => j.code === jur)!.name;
  const byStatus = (s: OfficialRecord["status"]) => hits.filter((h) => h.rec.status === s).length;

  return (
    <section className="panel" aria-labelledby="off-res">
      <h3 id="off-res">
        {hits.length.toLocaleString()} of {file.records.length.toLocaleString()} records in {jurName}
      </h3>
      <p className="small muted" role="status">
        {byStatus("current_in_source")} current in source · {byStatus("ended_in_current_files")} ended but filed with current officials ·{" "}
        {byStatus("former_in_source")} former. Source snapshot {snapshot}.
      </p>
      {day && (
        <p className="note">
          Showing records with a role whose recorded dates support service on <strong>{day}</strong>
          {unclear ? ", plus those whose dates cannot say (marked)" : ""}.
          {withUnclear > 0 && ` ${withUnclear} more record${withUnclear === 1 ? " has" : "s have"} a role whose dates cannot say (no start date, or contradictory dates); tick “Also show records whose dates cannot say” to see them.`}
          {committee ? " Committee membership has no dates in the source, so it is not filtered by this date and may not match who sat on the committee then." : ""}
        </p>
      )}
      {committee && (
        <p className="small">
          Members of <strong>{committee.name}</strong> ({committeeChamberLabel(committee.chamber)}) as listed in the source snapshot. Membership is undated.
          {unresolved.length > 0 && (
            <>
              {" "}
              Listed on the committee but with no officeholder record in the archive (not matched by name):{" "}
              {unresolved.map((m) => `${m.name} (${m.pid})`).join("; ")}.
            </>
          )}
        </p>
      )}
      <div className="row-actions no-print">
        <button type="button" onClick={() => saveFile(`officials_${jur}.csv`, toCsv(CSV_COLUMNS(memberOf), hits), "text/csv")} disabled={!hits.length}>
          Download these {hits.length} records (CSV, no contact details)
        </button>
      </div>
      {!hits.length ? (
        <Empty>
          No records match. {svc === "current" ? "Current-in-source is the default; try “All records” for historical service. " : ""}
          {day ? "A date only matches roles with a recorded start date; try “Also show records whose dates cannot say”. " : ""}
        </Empty>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Name</th>
                <th>Party</th>
                <th>Role, district and term dates (as recorded)</th>
                <th>Committees (undated, as of snapshot)</th>
                <th>Official links and contact</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {hits.slice(0, limit).map((h) => (
                <Row key={`${h.rec.group}/${h.rec.id}`} hit={h} memberships={memberOf.get(h.rec.id) ?? []} snapshot={snapshot} day={day} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {hits.length > limit && (
        <div className="row-actions no-print">
          <button type="button" onClick={() => setMore({ key, n: limit + PAGE })}>
            Show {Math.min(PAGE, hits.length - limit)} more ({hits.length - limit} not shown)
          </button>
        </div>
      )}
    </section>
  );
}

const CSV_COLUMNS = (memberOf: ReturnType<typeof membershipsByPerson>): Column<Hit>[] => [
  { key: "name", kind: "text", get: (h) => h.rec.name },
  { key: "person_id", kind: "text", get: (h) => h.rec.id },
  { key: "service_status_in_source", kind: "text", get: (h) => h.rec.status },
  { key: "party", kind: "list", get: (h) => (h.rec.parties ?? []).map((p) => p.name) },
  { key: "roles", kind: "list", get: (h) => h.roles.map((r) => `${r.role.type}${r.role.place ? `:${r.role.place}` : ""}${r.role.district ? ` district ${r.role.district}` : ""}; ${termText(r.role)}${r.cover === "unknown" ? "; dates cannot say" : ""}`) },
  { key: "committees", kind: "list", get: (h) => (memberOf.get(h.rec.id) ?? []).map((m) => `${m.committee.name} (${m.role})`) },
  { key: "snapshot_note", kind: "text", get: () => "Current in source = the source's own listing at its snapshot date; not independently confirmed" },
];

function Row({ hit, memberships, snapshot, day }: { hit: Hit; memberships: ReturnType<typeof membershipsByPerson> extends Map<string, infer V> ? V : never; snapshot: string; day: string }) {
  const rec = hit.rec;
  const parties = [...new Set((rec.parties ?? []).map((p) => p.name))];
  const current = rec.status === "current_in_source";
  const ids = Object.entries(rec.identifiers ?? {});
  const links = rec.links ?? [];
  const sortedMem = [...memberships].sort((a, b) => a.committee.chamber.localeCompare(b.committee.chamber) || a.committee.name.localeCompare(b.committee.name));
  return (
    <tr>
      <td>
        <strong>{rec.name}</strong>
        {rec.aka && rec.aka.length > 0 && <div className="small muted">Also: {rec.aka.slice(0, 3).join("; ")}{rec.aka.length > 3 ? `; +${rec.aka.length - 3}` : ""}</div>}
        <div>
          <span className={current ? "tag" : "tag tag-assumption"}>{STATUS_LABELS[rec.status]}</span>
        </div>
        <details className="small">
          <summary>Identifiers</summary>
          <div className="mono">{rec.id}</div>
          {ids.map(([scheme, vals]) => (
            <div key={scheme}>
              {words(scheme)}: <span className="mono">{vals.join(", ")}</span>
            </div>
          ))}
        </details>
      </td>
      <td>{parties.length ? parties.join(", ") : <span className="muted">not recorded</span>}</td>
      <td>
        {hit.roles.map(({ role, cover }, i) => (
          <div key={i} style={{ marginBottom: 4 }}>
            <strong>{typeLabel(role.type)}</strong>
            {role.place ? ` · ${placeLabel(role.place)}` : ""}
            {role.district ? ` · district ${role.district}` : ""}
            <div className="small">
              {termText(role)}
              {role.end_reason ? ` (ended: ${role.end_reason})` : ""}
              {!role.end && role.start && current && <span className="muted"> — open in the source, not confirmed</span>}
            </div>
            {day && cover === "unknown" && <span className="tag tag-assumption">dates cannot say for {day}</span>}
          </div>
        ))}
        {hit.committeeRole && <div className="small">On the selected committee as: {hit.committeeRole}</div>}
      </td>
      <td>
        {sortedMem.length === 0 ? (
          <span className="muted">none listed</span>
        ) : (
          <>
            {sortedMem.slice(0, 4).map((m) => (
              <div key={m.committee.id} className="small">
                <Go to={{ com: m.committee.id }}>{m.committee.name}</Go> ({committeeChamberLabel(m.committee.chamber).toLowerCase()}; {m.role})
              </div>
            ))}
            {sortedMem.length > 4 && (
              <details className="small">
                <summary>{sortedMem.length - 4} more</summary>
                {sortedMem.slice(4).map((m) => (
                  <div key={m.committee.id}>
                    <Go to={{ com: m.committee.id }}>{m.committee.name}</Go> ({committeeChamberLabel(m.committee.chamber).toLowerCase()}; {m.role})
                  </div>
                ))}
              </details>
            )}
          </>
        )}
      </td>
      <td>
        {links.length === 0 ? (
          <span className="muted">no official links retained</span>
        ) : (
          <>
            {links.slice(0, 3).map((l) => (
              <div key={l.url} className="small">
                <a href={l.url} target="_blank" rel="noreferrer noopener">
                  {l.note ? words(l.note) : "Official page"}
                </a>{" "}
                <span className="muted">{host(l.url)}</span>
              </div>
            ))}
            {links.length > 3 && (
              <details className="small">
                <summary>{links.length - 3} more links</summary>
                {links.slice(3).map((l) => (
                  <div key={l.url}>
                    <a href={l.url} target="_blank" rel="noreferrer noopener">
                      {l.note ? words(l.note) : "Official page"}
                    </a>{" "}
                    <span className="muted">{host(l.url)}</span>
                  </div>
                ))}
              </details>
            )}
          </>
        )}
        {current && rec.contact && (
          <details className="small">
            <summary>Official contact (as of {snapshot}, not re-checked)</summary>
            {rec.contact.email && <div>E-mail: {rec.contact.email}</div>}
            {(rec.contact.offices ?? []).map((o, i) => (
              <div key={i}>
                {o.classification === "capitol-mail" ? "Mailing" : "Capitol office"}: {[o.address && tidy(o.address), o.voice && `phone ${o.voice}`, o.fax && `fax ${o.fax}`].filter(Boolean).join("; ")}
              </div>
            ))}
          </details>
        )}
      </td>
      <td className="small">
        <div>
          Filed under <span className="mono">{rec.group}</span>, snapshot {snapshot}
        </div>
        <div className="muted">{current ? SERVICE_NOTE : "Historical; old links are not current contact details."}</div>
        <div className="muted">Review: not reviewed</div>
        {rec.also_in && rec.also_in.length > 0 && <div className="muted">Same id also appears in: {rec.also_in.join("; ")} (not merged)</div>}
      </td>
    </tr>
  );
}

function relevanceFor(index: OfficialsIndex, c: Committee): RegisterRow | undefined {
  return index.committee_register.find((r) => r.committee_ids.includes(c.id));
}

function CommitteePanel({ index, file, jur }: { index: OfficialsIndex; file: JurisdictionFile; jur: string }) {
  const [all, setAll] = useState(false);
  const rows = [...file.committees]
    .map((c) => ({ c, rel: relevanceFor(index, c) }))
    .sort((a, b) => Number(!!b.rel) - Number(!!a.rel) || a.c.chamber.localeCompare(b.c.chamber) || a.c.name.localeCompare(b.c.name));
  const shown = all ? rows : rows.slice(0, COMMITTEE_PAGE);
  if (!rows.length) return null;
  const nameOf = (id: string) => file.committees.find((c) => c.id === id)?.name;
  return (
    <section className="panel" aria-labelledby="off-com">
      <h3 id="off-com">Committees in {index.jurisdictions.find((j) => j.code === jur)!.name} ({rows.length})</h3>
      <p className="small muted">
        Membership is one undated list per committee, as of the snapshot; the source does not say which committees are still active. The
        two relevance columns are kept apart on purpose: a committee can look relevant to wine or alcohol law by its name without any
        record that a particular bill was sent to it.
      </p>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Committee</th>
              <th>Chamber</th>
              <th className="num">Members</th>
              <th>General subject relevance (wine and alcohol law)</th>
              <th>Documented bill referral</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.map(({ c, rel }) => (
              <tr key={c.id}>
                <td>
                  {c.name}
                  {c.parent && <div className="small muted">subcommittee of {nameOf(c.parent) ?? "a committee not in this file"}</div>}
                </td>
                <td>{committeeChamberLabel(c.chamber)}</td>
                <td className="num">{c.members.length}</td>
                <td className="small">
                  {rel ? (
                    <>
                      <span className="tag tag-assumption">{rel.subject_relevance}</span> {rel.relevance_basis}
                    </>
                  ) : (
                    <span className="muted">not assessed</span>
                  )}
                </td>
                <td className="small">
                  {rel ? (
                    rel.referral_status === "documented" ? (
                      <>
                        Documented: {rel.referral_bill}{" "}
                        {rel.referral_evidence_url && (
                          <a href={rel.referral_evidence_url} target="_blank" rel="noreferrer noopener">
                            evidence ↗
                          </a>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="tag tag-assumption">unverified</span> No bill referral is documented in this project.
                      </>
                    )
                  ) : (
                    <span className="muted">not assessed</span>
                  )}
                  {rel && <div className="muted">Review: {words(rel.review_status)}</div>}
                </td>
                <td className="no-print">
                  <Go to={{ com: c.id }}>Show members</Go>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > COMMITTEE_PAGE && (
        <div className="row-actions no-print">
          <button type="button" onClick={() => setAll(!all)}>
            {all ? "Show fewer committees" : `Show all ${rows.length} committees`}
          </button>
        </div>
      )}
    </section>
  );
}

function PolicyPanel({ index, jur, day }: { index: OfficialsIndex; jur: string; day: string }) {
  const dates = index.policy_dates.filter((d) => d.state === jur);
  const onDay = dates.filter((d) => d.date === day);
  return (
    <section className="panel" aria-labelledby="off-pol">
      <h3 id="off-pol">Linking officials to laws</h3>
      <table className="data">
        <thead>
          <tr>
            <th>Relationship</th>
            <th>What this data can show</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Held a seat on a date a law was enacted</td>
            <td className="small">
              Yes, where the source gives role dates: choose the enactment date below. It shows who was recorded in a seat, nothing more.
            </td>
          </tr>
          <tr>
            <td>Sponsored a bill</td>
            <td className="small">Not in this data. No sponsor is recorded for any policy record.</td>
          </tr>
          <tr>
            <td>Voted for or against a bill</td>
            <td className="small">Not in this data. Party and committee membership are not evidence of a vote.</td>
          </tr>
          <tr>
            <td>Committee reviewed or received a bill</td>
            <td className="small">Unverified. No referral is documented; see the committee table for which committees look relevant by name only.</td>
          </tr>
        </tbody>
      </table>
      {dates.length === 0 ? (
        <p className="small muted">No policy record for this jurisdiction carries an enactment date, so there is no date to pick here.</p>
      ) : (
        <>
          <h4>Enactment dates in the project’s policy records ({dates.length})</h4>
          <ul className="plain-list">
            {dates.map((d) => (
              <li key={d.policy_id}>
                <Go to={{ on: d.date, svc: null, unclear: null }}>{d.date}</Go> — {words(d.dimension)}: {words(d.value)}
                {d.beverage ? ` (${d.beverage})` : ""} · <Go to={{ rec: `policy:${d.policy_id}` }}>policy record</Go>
              </li>
            ))}
          </ul>
        </>
      )}
      {onDay.length > 0 && (
        <p className="note">
          {day} is the enactment date recorded for {onDay.map((d) => d.policy_id).join(", ")}. The list above shows who held a seat on that
          day; it does not show who sponsored, voted for or reviewed the law.
        </p>
      )}
    </section>
  );
}

function SourcePanel({ index }: { index: OfficialsIndex }) {
  const s = index.source;
  const c = index.counts;
  return (
    <section className="panel" id="officials-source" aria-labelledby="off-src">
      <h3 id="off-src">Source, license and limits</h3>
      <dl className="kv">
        <dt>Citation</dt>
        <dd>{s.citation}</dd>
        <dt>License</dt>
        <dd>
          {s.license ?? "not recorded"} ({s.license_text ?? "license file not found"}).{" "}
          {s.rights_evidence_url && (
            <a href={s.rights_evidence_url} target="_blank" rel="noreferrer noopener">
              License text ↗
            </a>
          )}
        </dd>
        <dt>Archive</dt>
        <dd>
          <span className="mono">{s.archive_name}</span>, {bytes(s.archive_bytes)}, SHA-256 <span className="mono">{s.archive_sha256?.slice(0, 16)}…</span>
        </dd>
        <dt>Snapshot</dt>
        <dd>
          {s.snapshot_date} ({s.snapshot_date_basis}). Cleaned copy made {s.copy_made_on ?? "on an unrecorded date"}.
        </dd>
        <dt>Documents kept</dt>
        <dd>{Object.entries(s.documents_present).map(([k, v]) => `${k}: ${v ? "present" : "missing"}`).join("; ")}</dd>
        <dt>Counts</dt>
        <dd>
          {c.records.toLocaleString()} officeholder records ({c.distinct_person_ids.toLocaleString()} distinct person ids;{" "}
          {Object.entries(c.by_group).map(([g, n]) => `${n.toLocaleString()} ${g}`).join(", ")}), {c.roles.toLocaleString()} roles,{" "}
          {c.committees.toLocaleString()} committees, {c.memberships.toLocaleString()} committee memberships.
        </dd>
        <dt>Relationships not resolved</dt>
        <dd>
          {c.memberships_unresolved} committee member(s) have no officeholder record in the archive (kept by name and id, not matched);{" "}
          {c.memberships_of_former_records} membership(s) belong to people the source files as former;{" "}
          {index.person_ids_in_several_files.length} person id(s) appear in more than one file (kept as separate records).
        </dd>
      </dl>
      <details>
        <summary>What the cleaned copy kept and removed</summary>
        <p className="small">Kept:</p>
        <ul className="plain-list small">
          {s.sanitization_kept.map((k) => (
            <li key={k}>{k}</li>
          ))}
        </ul>
        <p className="small">Removed before it reached this project:</p>
        <ul className="plain-list small">
          {s.sanitization_removed.map((k) => (
            <li key={k}>{k}</li>
          ))}
        </ul>
      </details>
      <details>
        <summary>Limits</summary>
        <ul className="plain-list small">
          {Object.entries(index.definitions).map(([k, v]) => (
            <li key={k}>
              <strong>{words(k)}.</strong> {v}
            </li>
          ))}
          <li>
            Contact details are shown only for records current in the source, as the source gave them at the snapshot. Links on historical records are old
            pages, not current contact points.
          </li>
          <li>The checks on this data test counts, ids, committee links and the absence of removed field names and hosts. They do not show that the source is right.</li>
        </ul>
      </details>
    </section>
  );
}
