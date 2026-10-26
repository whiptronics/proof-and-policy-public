// Officials and committees: types of the exported files and the pure filtering rules the view uses.
// Reference data only. Nothing here touches observations, estimates or the scenario tool.
//
// The service rules mirror src/alcohol_data/officials/importer.py (role_covers, service_status); both sides are
// tested against the same hand-checked cases.
import { words } from "./format";

export type Status = "current_in_source" | "ended_in_current_files" | "former_in_source";
export type Cover = "yes" | "no" | "unknown";

export interface OfficialRole {
  type: string;
  scope: string;
  place?: string;
  district?: string;
  start?: string;
  end?: string;
  end_reason?: string;
  conflict?: boolean;
}
export interface OfficialOffice {
  classification?: string;
  address?: string;
  voice?: string;
  fax?: string;
}
export interface OfficialRecord {
  id: string;
  name: string;
  aka?: string[];
  parties?: { name: string; start?: string; end?: string }[];
  group: string;
  status: Status;
  roles: OfficialRole[];
  links?: { url: string; note?: string }[];
  identifiers?: Record<string, string[]>;
  seat?: Record<string, unknown>;
  also_in?: string[];
  contact?: { email?: string; offices?: OfficialOffice[] };
}
export interface CommitteeMember {
  pid: string | null;
  role: string;
  unresolved?: boolean;
  name?: string;
  former?: boolean;
}
export interface Committee {
  id: string;
  name: string;
  chamber: string;
  class: string;
  parent?: string;
  scope: string;
  links?: { url: string; note?: string }[];
  members: CommitteeMember[];
}
export interface JurisdictionFile {
  code: string;
  records: OfficialRecord[];
  committees: Committee[];
}
export interface JurisdictionEntry {
  code: string;
  name: string;
  file: string;
  records: number;
  current_in_source: number;
  ended_in_current_files: number;
  former_in_source: number;
  committees: number;
}
export interface PolicyDate {
  policy_id: string;
  state: string;
  date: string;
  dimension: string;
  value: string;
  beverage: string;
  claim_status: string;
}
export interface RegisterRow {
  jurisdiction: string;
  chamber: string;
  committee_name: string;
  subject_relevance: string;
  relevance_basis: string;
  referral_status: "unverified" | "documented";
  referral_bill: string;
  referral_evidence_url: string;
  review_status: string;
  notes: string;
  committee_ids: string[];
}
export interface OfficialsIndex {
  schema: string;
  review_status: string;
  source: {
    source_id: string;
    asset_id: string;
    publisher: string;
    title: string;
    landing_url: string;
    citation: string;
    rights_evidence_url: string | null;
    archive_name: string | null;
    archive_sha256: string | null;
    archive_bytes: number | null;
    snapshot_date: string;
    snapshot_date_basis: string;
    copy_made_on: string | null;
    license: string | null;
    license_text: string | null;
    cff?: { title?: string; authors?: string[]; repository?: string; license?: string; abstract?: string };
    documents_present: Record<string, boolean>;
    sanitization_kept: string[];
    sanitization_removed: string[];
  };
  definitions: Record<string, string>;
  counts: {
    records: number;
    by_group: Record<string, number>;
    by_status: Record<string, number>;
    distinct_person_ids: number;
    roles: number;
    committees: number;
    memberships: number;
    memberships_unresolved: number;
    memberships_of_former_records: number;
  };
  jurisdictions: JurisdictionEntry[];
  policy_dates: PolicyDate[];
  committee_register: RegisterRow[];
  unresolved_memberships: { committee_id: string; state: string; name: string; person_id?: string }[];
  person_ids_in_several_files: { person_id: string; paths: string[] }[];
  issue_counts: Record<string, number>;
}

// ----- labels -------------------------------------------------------------------------------------

const TYPE_LABELS: Record<string, string> = {
  upper: "Upper chamber (Senate)",
  lower: "Lower chamber (House or Assembly)",
  legislature: "Legislature (unicameral or joint)",
  governor: "Governor",
  lt_governor: "Lieutenant governor",
  mayor: "Mayor",
  "attorney general": "Attorney general",
  "secretary of state": "Secretary of state",
  "chief election officer": "Chief election officer",
  auditor: "Auditor",
  treasurer: "Treasurer",
};
// Display order of role types: executive offices, then the chambers, then local offices.
const TYPE_ORDER: Record<string, number> = {
  governor: 0,
  lt_governor: 1,
  "attorney general": 2,
  "secretary of state": 3,
  treasurer: 4,
  auditor: 5,
  "chief election officer": 6,
  upper: 10,
  lower: 11,
  legislature: 12,
  mayor: 20,
};
export function typeLabel(t: string): string {
  return TYPE_LABELS[t] ?? words(t).replace(/^./, (c) => c.toUpperCase());
}
export function committeeChamberLabel(c: string): string {
  return c === "upper" ? "Upper chamber" : c === "lower" ? "Lower chamber" : "Joint or legislature-wide";
}
export function placeLabel(slug: string | undefined): string {
  return slug ? slug.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "";
}
export const STATUS_LABELS: Record<Status, string> = {
  current_in_source: "Current in source",
  ended_in_current_files: "Ended (filed with current officials)",
  former_in_source: "Former",
};
export const SERVICE_NOTE =
  "Not independently confirmed. The source's own listing, taken as of its snapshot date.";

// ----- dates --------------------------------------------------------------------------------------

export function isRealDate(s: string | null | undefined): s is string {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Whether one role's recorded dates support service on `day` (inclusive bounds; see importer.role_covers). */
export function coverRole(r: Pick<OfficialRole, "start" | "end">, day: string, recordIsCurrent: boolean): Cover {
  const { start, end } = r;
  if (start && end && start > end) return "unknown";
  if (start && day < start) return "no";
  if (end && day > end) return "no";
  if (!start) return "unknown";
  if (!end) return recordIsCurrent ? "yes" : "unknown";
  return "yes";
}

export function termText(r: OfficialRole): string {
  const t =
    r.start && r.end
      ? `${r.start} to ${r.end}`
      : r.start
        ? `from ${r.start}; no end date recorded`
        : r.end
          ? `start not recorded; to ${r.end}`
          : "no dates recorded";
  return r.conflict ? `${t} (the source's dates contradict each other)` : t;
}

// ----- filtering ----------------------------------------------------------------------------------

export interface Filters {
  svc: "current" | "former" | "all";
  chamber: string; // role type, "" for any
  gov: string; // "", "state" or "<kind>:<slug>"
  district: string;
  committee: string; // committee id, ""
  q: string;
  day: string; // ISO date or ""
  unclear: boolean; // with a date: also keep records whose dates cannot say
}

export function govOf(r: OfficialRole): string {
  return r.place ? `${r.scope}:${r.place}` : "state";
}
export function govLabel(g: string): string {
  if (g === "state") return "State or national government";
  const [kind, slug] = g.split(":");
  return `${placeLabel(slug)} (${kind})`;
}

export function roleMatches(r: OfficialRole, f: Filters): boolean {
  if (f.chamber && r.type !== f.chamber) return false;
  if (f.gov && govOf(r) !== f.gov) return false;
  if (f.district && (r.district ?? "") !== f.district) return false;
  return true;
}

const strip = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export function nameMatches(rec: Pick<OfficialRecord, "name" | "aka" | "id">, q: string): boolean {
  const tokens = strip(q).split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const hay = strip([rec.name, ...(rec.aka ?? []), rec.id].join(" | "));
  return tokens.every((t) => hay.includes(t));
}

export interface Hit {
  rec: OfficialRecord;
  roles: { role: OfficialRole; cover: Cover | null }[];
  committeeRole?: string;
}

/** Records that pass the filters, each with the roles that matched. Pure; the view only renders the result. */
export function filterRecords(recs: OfficialRecord[], committees: Committee[], f: Filters): Hit[] {
  const members = new Map<string, string>();
  if (f.committee) {
    const c = committees.find((x) => x.id === f.committee);
    for (const m of c?.members ?? []) if (m.pid) members.set(m.pid, m.role);
  }
  const out: Hit[] = [];
  for (const rec of recs) {
    if (f.svc === "current" && rec.status !== "current_in_source") continue;
    if (f.svc === "former" && rec.status === "current_in_source") continue;
    if (f.committee && !members.has(rec.id)) continue;
    if (!nameMatches(rec, f.q)) continue;
    const current = rec.status === "current_in_source";
    const roles = rec.roles
      .filter((r) => roleMatches(r, f))
      .map((role) => ({ role, cover: f.day ? coverRole(role, f.day, current) : null }));
    if (!roles.length) continue;
    if (f.day) {
      const keep = roles.filter((x) => x.cover === "yes" || (f.unclear && x.cover === "unknown"));
      if (!keep.length) continue;
      out.push({ rec, roles: keep, committeeRole: members.get(rec.id) });
    } else {
      out.push({ rec, roles, committeeRole: members.get(rec.id) });
    }
  }
  const rank = (h: Hit) => (h.rec.status === "current_in_source" ? 0 : h.rec.status === "ended_in_current_files" ? 1 : 2);
  const last = (n: string) => {
    const parts = n.replace(/,?\s+(jr\.?|sr\.?|ii|iii|iv)$/i, "").split(/\s+/);
    return strip(parts[parts.length - 1] ?? n);
  };
  const dist = (h: Hit) => h.roles[0]?.role.district ?? "";
  const kind = (h: Hit) => TYPE_ORDER[h.roles[0]?.role.type ?? ""] ?? 15;
  out.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      kind(a) - kind(b) ||
      dist(a).localeCompare(dist(b), undefined, { numeric: true }) ||
      last(a.rec.name).localeCompare(last(b.rec.name)) ||
      a.rec.name.localeCompare(b.rec.name),
  );
  return out;
}

/** Distinct values for a filter, drawn from what is actually in the loaded records. */
export function options(recs: OfficialRecord[], f: Pick<Filters, "chamber" | "gov">) {
  const types = new Set<string>();
  const govs = new Set<string>();
  const districts = new Set<string>();
  for (const rec of recs)
    for (const r of rec.roles) {
      types.add(r.type);
      govs.add(govOf(r));
      if ((!f.chamber || r.type === f.chamber) && (!f.gov || govOf(r) === f.gov) && r.district) districts.add(r.district);
    }
  return {
    types: [...types].sort(),
    govs: [...govs].sort((a, b) => (a === "state" ? -1 : b === "state" ? 1 : a.localeCompare(b))),
    districts: [...districts].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
  };
}

/** Committees each person sits on, by person id (undated: the source's single snapshot). */
export function membershipsByPerson(committees: Committee[]): Map<string, { committee: Committee; role: string; former?: boolean }[]> {
  const out = new Map<string, { committee: Committee; role: string; former?: boolean }[]>();
  for (const c of committees)
    for (const m of c.members) {
      if (!m.pid) continue;
      const list = out.get(m.pid) ?? [];
      list.push({ committee: c, role: m.role, former: m.former });
      out.set(m.pid, list);
    }
  return out;
}
