"""Read the officials-only copy of Open States People (CC0 1.0) into plain tables.

The archive is the source artifact; this module never writes to it and never fetches anything. Output is
deterministic: no clock is read, files are visited in sorted order, and every table row is a plain dict.

What the archive is (see its SANITIZATION.md): one YAML file per officeholder record, under
``people-main/data/<state>/<group>/``, where group is ``legislature``, ``executive``, ``municipalities`` or
``retired``, plus committee files under ``committees/``. The upstream README says the first three folders hold
people "currently serving" and ``retired`` holds people "not currently serving any tracked roles". That folder
placement is the only basis this module has for "current in this source". It is not a confirmation of anyone's
service: a missing end date does not make a person current, and nothing here is checked against an official
roster.

Records are per source file. A person id that appears in two files stays two records with the same
``person_id`` (the stable id is the join key; names are never used to merge or match).

Allow-lists below make an uncleaned archive fail loudly. They test field names, link hosts, e-mail domains and
office classifications; they cannot prove that free text (names, addresses, ``extras``) holds no personal detail.
"""

from __future__ import annotations

import hashlib
import re
import zipfile
from datetime import date
from pathlib import Path

import yaml

ROOT = "people-main"
PERSON_GROUPS = ("legislature", "executive", "municipalities", "retired")
CURRENT_GROUPS = ("legislature", "executive", "municipalities")
DOCUMENTS = ("README.md", "LICENSE", "CITATION.cff", "schema.md", "SANITIZATION.md")

ALLOWED_PERSON_KEYS = {
    "id",
    "name",
    "given_name",
    "family_name",
    "middle_name",
    "suffix",
    "other_names",
    "party",
    "roles",
    "email",
    "offices",
    "links",
    "sources",
    "other_identifiers",
    "extras",
}
ALLOWED_ROLE_KEYS = {"type", "jurisdiction", "district", "start_date", "end_date", "end_reason"}
ALLOWED_PARTY_KEYS = {"name", "start_date", "end_date"}
ALLOWED_OFFICE_KEYS = {"classification", "address", "voice", "fax"}
ALLOWED_OFFICE_CLASSES = {"capitol", "capitol-mail"}
ALLOWED_LINK_KEYS = {"url", "note"}
ALLOWED_ID_SCHEMES = {
    "legacy_openstates",
    "openstates",
    "bioguide",
    "fec",
    "govtrack",
    "opensecrets",
    "icpsr",
    "maplight",
    "thomas",
    "house_history",
    "followthemoney",
    "lis",
}
ALLOWED_EXTRAS = {
    "counties represented",
    "title",
    "elected status",
    "Seat Number",
    "towns represented",
    "represented counties",
    "representing parishes",
    "City/Town Represented",
}
ALLOWED_COMMITTEE_KEYS = {
    "id",
    "jurisdiction",
    "classification",
    "name",
    "chamber",
    "other_names",
    "members",
    "sources",
    "links",
    "parent",
}
ALLOWED_MEMBER_KEYS = {"name", "role", "person_id"}

# Field names that SANITIZATION.md lists as removed. Seeing one means the archive was not cleaned.
REMOVED_KEYS = {
    "birth_date",
    "death_date",
    "gender",
    "image",
    "biography",
    "summary",
    "contact_details",
    "ids",
    "occupation",
    "education",
    "religion",
    "spouse",
    "veteran",
    "cell",
    "mobile",
    "home",
    "phone",
    "twitter",
    "facebook",
    "instagram",
    "youtube",
    "linkedin",
    "staff",
    "assistant",
}
# Hosts that SANITIZATION.md lists as removed (profile, encyclopedia, social and party sites).
BLOCKED_HOSTS = (
    "linkedin.com",
    "facebook.com",
    "twitter.com",
    "x.com",
    "instagram.com",
    "youtube.com",
    "wikipedia.org",
    "wikidata.org",
    "ballotpedia.org",
    "votesmart.org",
    "vote-smart.org",
)
CONSUMER_MAIL = (
    "gmail.com",
    "yahoo.com",
    "hotmail.com",
    "outlook.com",
    "aol.com",
    "icloud.com",
    "msn.com",
    "live.com",
    "me.com",
    "comcast.net",
    "sbcglobal.net",
    "att.net",
    "verizon.net",
    "protonmail.com",
)

ISO_DAY = re.compile(r"^\d{4}-\d{2}-\d{2}$")
RECORD_PATH = re.compile(
    r"^people-main/data/([a-z]{2})/(legislature|executive|municipalities|retired)/([^/]+)\.yml$"
)
COMMITTEE_PATH = re.compile(r"^people-main/data/([a-z]{2})/committees/([^/]+)\.yml$")
UUID = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")


class ArchiveError(ValueError):
    """The archive is missing something the importer depends on, or was not cleaned."""


def _loader():
    return getattr(yaml, "CSafeLoader", yaml.SafeLoader)


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


# ---------------------------------------------------------------- jurisdictions and dates


def parse_jurisdiction(ocd: str) -> dict:
    """Split an ``ocd-jurisdiction/...`` id into its parts.

    scope: federal | state | territory | district | county | place. ``state`` is the postal-style code of the
    state, territory or district ("us" for the federal government); ``place`` is the county or place slug.
    """
    parts = ocd.split("/")
    if (
        len(parts) < 3
        or parts[0] != "ocd-jurisdiction"
        or parts[-1] != "government"
        or parts[1] != "country:us"
    ):
        raise ArchiveError(f"unrecognised jurisdiction id {ocd!r}")
    kv = []
    for p in parts[2:-1]:
        k, _, v = p.partition(":")
        if not v:
            raise ArchiveError(f"unrecognised jurisdiction id {ocd!r}")
        kv.append((k, v))
    out = {"jurisdiction": ocd, "scope": "federal", "state": "us", "place": None}
    for k, v in kv:
        if k in ("state", "territory", "district"):
            out["scope"], out["state"] = k, v
        elif k in ("county", "place"):
            out["scope"], out["place"] = k, v
        else:
            raise ArchiveError(f"unrecognised jurisdiction id {ocd!r}")
    return out


def place_label(slug: str | None) -> str | None:
    return slug.replace("_", " ").title() if slug else None


def iso_day(value, issues: list, where: str) -> str | None:
    """A YAML date (or string) as 'YYYY-MM-DD'; anything else is reported and dropped, never guessed."""
    if value is None:
        return None
    if isinstance(value, date):
        return value.isoformat()
    s = str(value).strip()
    if ISO_DAY.match(s):
        return s
    issues.append(_issue("unreadable_date", "warning", where, f"date {s!r} is not YYYY-MM-DD; left empty"))
    return None


def role_open_at(start: str | None, end: str | None, day: str) -> bool:
    """True when the role's recorded dates do not rule out ``day`` (a missing bound does not rule it out)."""
    return (start is None or start <= day) and (end is None or end >= day)


def role_covers(start: str | None, end: str | None, day: str, record_is_current: bool) -> str:
    """Whether a role's recorded dates support service on ``day``: 'yes', 'no' or 'unknown'.

    Boundaries are inclusive, so a handover day can match two roles. A role needs a recorded start date to give
    'yes'. A role with no end date counts as ongoing only for a record that is current in the source; for a
    former record a missing end date proves nothing. 'unknown' means the dates cannot say, including when
    the start date is later than the end date.
    """
    if start is not None and end is not None and start > end:
        return "unknown"  # the source's own dates contradict each other
    if start is not None and day < start:
        return "no"
    if end is not None and day > end:
        return "no"
    if start is None:
        return "unknown"
    if end is None:
        return "yes" if record_is_current else "unknown"
    return "yes"


def service_status(group: str, roles: list[dict], snapshot: str) -> str:
    """current_in_source | ended_in_current_files | former_in_source (never 'confirmed')."""
    if group not in CURRENT_GROUPS:
        return "former_in_source"
    if any(role_open_at(r["start_date"], r["end_date"], snapshot) for r in roles):
        return "current_in_source"
    return "ended_in_current_files"


def _issue(kind: str, severity: str, where: str, detail: str) -> dict:
    return {"kind": kind, "severity": severity, "where": where, "detail": detail}


# ---------------------------------------------------------------- provenance


def _host(url: str) -> str:
    m = re.match(r"^[a-z][a-z0-9+.-]*://([^/:?#]+)", url.strip(), re.I)
    return m.group(1).lower() if m else ""


def blocked_host(url: str) -> bool:
    h = _host(url)
    return any(h == b or h.endswith("." + b) for b in BLOCKED_HOSTS)


def read_provenance(zf: zipfile.ZipFile, archive: Path | None = None) -> dict:
    names = set(zf.namelist())
    docs = {d: f"{ROOT}/{d}" in names for d in DOCUMENTS}
    missing = [d for d, ok in docs.items() if not ok]
    if f"{ROOT}/SANITIZATION.md" not in names:
        raise ArchiveError("SANITIZATION.md is missing: this is not the cleaned officials-only copy")
    san = zf.read(f"{ROOT}/SANITIZATION.md").decode("utf-8")
    snap = re.search(r"snapshot dated (\d{4}-\d{2}-\d{2})", san)
    if not snap:
        raise ArchiveError("SANITIZATION.md does not state a snapshot date")
    made = re.search(r"\(made (\d{4}-\d{2}-\d{2})\)", san)
    counts = re.search(
        r"([\d,]+) officeholder records \(([\d,]+) legislature, ([\d,]+) executive, ([\d,]+) municipal, "
        r"([\d,]+) former\) and\s+([\d,]+) committees",
        san,
    )
    stated = None
    if counts:
        n = [int(x.replace(",", "")) for x in counts.groups()]
        stated = {
            "records": n[0],
            "legislature": n[1],
            "executive": n[2],
            "municipalities": n[3],
            "retired": n[4],
            "committees": n[5],
        }
    citation = {}
    if docs["CITATION.cff"]:
        cff = yaml.safe_load(zf.read(f"{ROOT}/CITATION.cff").decode("utf-8")) or {}
        citation = {
            "title": cff.get("title"),
            "authors": [
                " ".join(x for x in (a.get("given-names"), a.get("family-names")) if x)
                for a in cff.get("authors", [])
            ],
            "repository": cff.get("repository-code"),
            "license": cff.get("license"),
            "abstract": " ".join(str(cff.get("abstract", "")).split()),
        }
    license_head = ""
    if docs["LICENSE"]:
        text = zf.read(f"{ROOT}/LICENSE").decode("utf-8")
        license_head = "CC0 1.0 Universal" if "CC0 1.0 Universal" in text else text.strip().splitlines()[0]
    kept = re.search(r"Kept \(whitelist.*?\):\n(.*?)\nRemoved:", san, re.S)
    removed = re.search(r"Removed:\n(.*?)\nCounts:", san, re.S)

    def bullets(m):
        return [" ".join(x.split()) for x in re.split(r"\n- ", "\n" + m.group(1).strip())[1:]] if m else []

    prov = {
        "archive_name": archive.name if archive else None,
        "archive_sha256": sha256_file(archive) if archive else None,
        "archive_bytes": archive.stat().st_size if archive else None,
        "snapshot_date": snap.group(1),
        "snapshot_date_basis": "stated in SANITIZATION.md; the retained files carry no upstream commit hash",
        "copy_made_on": made.group(1) if made else None,
        "documents_present": docs,
        "documents_missing": missing,
        "license": citation.get("license") or None,
        "license_text": license_head or None,
        "citation": citation,
        "stated_counts": stated,
        "sanitization_kept": bullets(kept),
        "sanitization_removed": bullets(removed),
    }
    return prov


# ---------------------------------------------------------------- reading records


def _check_keys(obj: dict, allowed: set, where: str, what: str, issues: list) -> None:
    for k in sorted(set(obj) - allowed):
        kind = "removed_field_present" if k in REMOVED_KEYS else "unexpected_field"
        issues.append(_issue(kind, "error", where, f"{what} has field {k!r}"))


def _record(
    path: str, state: str, group: str, d: dict, snapshot: str, issues: list
) -> tuple[dict, list[dict]]:
    where = path.replace(f"{ROOT}/data/", "")
    pid = d.get("id")
    if not isinstance(pid, str) or not pid.startswith("ocd-person/"):
        raise ArchiveError(f"{where}: missing or malformed person id")
    if not path.endswith(pid.split("/", 1)[1] + ".yml"):
        issues.append(_issue("filename_id_mismatch", "warning", where, f"file name does not end with {pid}"))
    _check_keys(d, ALLOWED_PERSON_KEYS, where, "record", issues)

    roles = []
    for i, r in enumerate(d.get("roles") or []):
        _check_keys(r, ALLOWED_ROLE_KEYS, where, f"role {i}", issues)
        jur = parse_jurisdiction(r["jurisdiction"])
        roles.append(
            {
                "record_key": f"{state}/{group}/{pid.split('/', 1)[1]}",
                "seq": i,
                "type": r.get("type"),
                "jurisdiction": jur["jurisdiction"],
                "scope": jur["scope"],
                "state": jur["state"],
                "place": jur["place"],
                "district": None if r.get("district") is None else str(r["district"]),
                "start_date": iso_day(r.get("start_date"), issues, where),
                "end_date": iso_day(r.get("end_date"), issues, where),
                "end_reason": r.get("end_reason"),
            }
        )
    for r in roles:
        if r["start_date"] and r["end_date"] and r["start_date"] > r["end_date"]:
            issues.append(
                _issue("role_dates_reversed", "warning", where, f"role {r['seq']} starts after it ends")
            )

    parties = []
    for p in d.get("party") or []:
        _check_keys(p, ALLOWED_PARTY_KEYS, where, "party", issues)
        parties.append(
            {
                "name": p.get("name"),
                "start_date": iso_day(p.get("start_date"), issues, where),
                "end_date": iso_day(p.get("end_date"), issues, where),
            }
        )

    links = []
    for lk in d.get("links") or []:
        _check_keys(lk, ALLOWED_LINK_KEYS, where, "link", issues)
        if blocked_host(lk["url"]):
            issues.append(_issue("blocked_link_host", "error", where, f"link to {_host(lk['url'])}"))
        links.append({"url": lk["url"], "note": lk.get("note")})

    email = d.get("email")
    if email and email.rsplit("@", 1)[-1].lower() in CONSUMER_MAIL:
        issues.append(_issue("consumer_mail_domain", "error", where, "e-mail at a consumer mail domain"))
    offices = []
    for o in d.get("offices") or []:
        _check_keys(o, ALLOWED_OFFICE_KEYS, where, "office", issues)
        if o.get("classification") not in ALLOWED_OFFICE_CLASSES:
            issues.append(
                _issue("office_class", "error", where, f"office classification {o.get('classification')!r}")
            )
        offices.append({k: o.get(k) for k in ("classification", "address", "voice", "fax")})

    idents = []
    for o in d.get("other_identifiers") or []:
        if o.get("scheme") not in ALLOWED_ID_SCHEMES:
            issues.append(
                _issue("identifier_scheme", "error", where, f"identifier scheme {o.get('scheme')!r}")
            )
        idents.append({"scheme": o.get("scheme"), "identifier": str(o.get("identifier"))})

    extras = dict(d.get("extras") or {})
    for k in sorted(set(extras) - ALLOWED_EXTRAS):
        issues.append(_issue("unexpected_extra", "error", where, f"extras has key {k!r}"))

    rec = {
        "record_key": f"{state}/{group}/{pid.split('/', 1)[1]}",
        "person_id": pid,
        "state": state,
        "group": group,
        "name": d.get("name"),
        "given_name": d.get("given_name"),
        "family_name": d.get("family_name"),
        "middle_name": d.get("middle_name"),
        "suffix": d.get("suffix"),
        "other_names": [x.get("name") for x in (d.get("other_names") or []) if x.get("name")],
        "parties": parties,
        "email": email,
        "offices": offices,
        "links": links,
        "n_sources": len(d.get("sources") or []),
        "identifiers": idents,
        "extras": extras,
        "status": service_status(group, roles, snapshot),
        "path": where,
    }
    return rec, roles


def _committee(path: str, state: str, d: dict, issues: list) -> dict:
    where = path.replace(f"{ROOT}/data/", "")
    _check_keys(d, ALLOWED_COMMITTEE_KEYS, where, "committee", issues)
    for lk in d.get("links") or []:
        if blocked_host(lk["url"]):
            issues.append(_issue("blocked_link_host", "error", where, f"link to {_host(lk['url'])}"))
    jur = parse_jurisdiction(d["jurisdiction"])
    return {
        "committee_id": d["id"],
        "state": state,
        "jurisdiction": jur["jurisdiction"],
        "scope": jur["scope"],
        "name": d["name"],
        "chamber": d["chamber"],
        "classification": d["classification"],
        "parent_id": d.get("parent"),
        "other_names": [x.get("name") for x in (d.get("other_names") or []) if x.get("name")],
        "links": [{"url": x["url"], "note": x.get("note")} for x in (d.get("links") or [])],
        "n_sources": len(d.get("sources") or []),
        "n_members_in_file": len(d.get("members") or []),
        "path": where,
    }


class Officials:
    """Parsed tables plus provenance. ``issues`` lists every oddity found; errors mean the archive is unfit."""

    def __init__(self, provenance, records, roles, committees, memberships, issues):
        self.provenance = provenance
        self.records = records
        self.roles = roles
        self.committees = committees
        self.memberships = memberships
        self.issues = issues

    @property
    def snapshot(self) -> str:
        return self.provenance["snapshot_date"]

    def errors(self) -> list[dict]:
        return [i for i in self.issues if i["severity"] == "error"]

    def issue_counts(self) -> dict:
        out: dict[str, int] = {}
        for i in self.issues:
            out[i["kind"]] = out.get(i["kind"], 0) + 1
        return dict(sorted(out.items()))

    def counts(self) -> dict:
        by_group = {g: sum(1 for r in self.records if r["group"] == g) for g in PERSON_GROUPS}
        by_status = {}
        for r in self.records:
            by_status[r["status"]] = by_status.get(r["status"], 0) + 1
        return {
            "records": len(self.records),
            "by_group": by_group,
            "by_status": dict(sorted(by_status.items())),
            "distinct_person_ids": len({r["person_id"] for r in self.records}),
            "roles": len(self.roles),
            "committees": len(self.committees),
            "memberships": len(self.memberships),
            "memberships_unresolved": sum(1 for m in self.memberships if not m["resolved"]),
            "memberships_of_former_records": sum(
                1 for m in self.memberships if m["person_group"] == "retired"
            ),
        }


def load_officials(archive: Path) -> Officials:
    archive = Path(archive)
    issues: list[dict] = []
    loader = _loader()
    with zipfile.ZipFile(archive) as zf:
        prov = read_provenance(zf, archive)
        snapshot = prov["snapshot_date"]
        for d in prov["documents_missing"]:
            issues.append(
                _issue(
                    "document_missing", "warning", d, "attribution or documentation file not in the archive"
                )
            )
        records, roles, committees = [], [], []
        raw_members: list[tuple[dict, dict]] = []
        for info in sorted(zf.infolist(), key=lambda i: i.filename):
            name = info.filename
            if info.is_dir() or not name.endswith(".yml"):
                continue
            m = RECORD_PATH.match(name)
            c = COMMITTEE_PATH.match(name)
            if m:
                d = yaml.load(zf.read(name), Loader=loader)
                rec, rr = _record(name, m.group(1), m.group(2), d, snapshot, issues)
                records.append(rec)
                roles.extend(rr)
            elif c:
                d = yaml.load(zf.read(name), Loader=loader)
                com = _committee(name, c.group(1), d, issues)
                committees.append(com)
                for mem in d.get("members") or []:
                    _check_keys(mem, ALLOWED_MEMBER_KEYS, com["path"], "member", issues)
                    raw_members.append((com, mem))
            elif not name.endswith("/municipalities.yml"):
                issues.append(
                    _issue("unclassified_file", "info", name, "YAML file outside the known layout; ignored")
                )

    # Person ids appearing more than once: kept as separate records, reported.
    by_id: dict[str, list[dict]] = {}
    for r in records:
        by_id.setdefault(r["person_id"], []).append(r)
    for pid, rs in sorted(by_id.items()):
        if len(rs) > 1:
            issues.append(
                _issue(
                    "person_id_in_several_files",
                    "info",
                    pid,
                    "same id in "
                    + ", ".join(r["path"] for r in rs)
                    + "; kept as separate records, not merged",
                )
            )
    committee_ids = {c["committee_id"] for c in committees}
    for c in committees:
        if c["parent_id"] and c["parent_id"] not in committee_ids:
            issues.append(
                _issue("parent_committee_not_in_archive", "warning", c["path"], f"parent {c['parent_id']}")
            )

    memberships = []
    for com, mem in raw_members:
        pid = mem.get("person_id")
        hits = by_id.get(pid) if pid else None
        resolved = bool(hits)
        row = {
            "committee_id": com["committee_id"],
            "state": com["state"],
            "person_id": pid,
            "name_in_committee_file": mem.get("name"),
            "role": mem.get("role") or "member",
            "resolved": resolved,
            "person_group": None,
        }
        if resolved:
            groups = sorted({h["group"] for h in hits})
            row["person_group"] = (
                "retired" if groups == ["retired"] else next(g for g in groups if g != "retired")
            )
            if row["person_group"] == "retired":
                issues.append(
                    _issue(
                        "member_is_former_in_source",
                        "info",
                        com["path"],
                        f"{mem.get('name')} ({pid}) is listed as a committee member but sits in the retired folder",
                    )
                )
        else:
            issues.append(
                _issue(
                    "member_not_in_archive",
                    "warning",
                    com["path"],
                    f"{mem.get('name')} ({pid}) is a committee member with no officeholder record in the archive",
                )
            )
        memberships.append(row)
    return Officials(prov, records, roles, committees, memberships, issues)


# ---------------------------------------------------------------- checks


def check_officials(archive: Path, off: Officials | None = None) -> list[tuple[str, bool, str]]:
    """Independent checks of the parsed tables against the archive. Returns (name, passed, detail).

    What they test: record, committee and member counts against a separate pass over the zip listing and
    against the counts SANITIZATION.md states; person ids; committee-to-person links; and that no removed field
    name, blocked link host, consumer e-mail domain or non-capitol office is present. What they do not test:
    whether names, addresses or free text hold anything personal, or whether anything in the source is true.
    """
    off = off or load_officials(archive)
    out: list[tuple[str, bool, str]] = []

    def add(name: str, ok: bool, detail: str):
        out.append((name, bool(ok), detail))

    with zipfile.ZipFile(archive) as zf:
        names = [i.filename for i in zf.infolist() if not i.is_dir()]
        n_rec = sum(1 for n in names if RECORD_PATH.match(n))
        n_com = sum(1 for n in names if COMMITTEE_PATH.match(n))
        n_mem = 0
        for n in names:
            if COMMITTEE_PATH.match(n):
                n_mem += len(re.findall(rb"^\s*person_id:", zf.read(n), re.M))
    add(
        "record files = parsed records",
        n_rec == len(off.records),
        f"{n_rec} files, {len(off.records)} records",
    )
    add(
        "committee files = parsed committees",
        n_com == len(off.committees),
        f"{n_com} files, {len(off.committees)}",
    )
    add(
        "member person_id lines = membership rows",
        n_mem == len(off.memberships),
        f"{n_mem} person_id lines in committee files, {len(off.memberships)} rows",
    )
    stated = off.provenance["stated_counts"]
    c = off.counts()
    if stated:
        add(
            "counts match SANITIZATION.md",
            stated["records"] == c["records"]
            and stated["committees"] == c["committees"]
            and all(stated[g] == c["by_group"][g] for g in PERSON_GROUPS),
            f"stated {stated}; parsed {c['records']} records {c['by_group']} and {c['committees']} committees",
        )
    else:
        add("counts match SANITIZATION.md", False, "SANITIZATION.md states no counts in the expected form")
    resolved = sum(1 for m in off.memberships if m["resolved"])
    add(
        "every membership resolved or flagged",
        resolved + c["memberships_unresolved"] == len(off.memberships),
        f"{resolved} resolved, {c['memberships_unresolved']} flagged unresolved",
    )
    keys = [r["record_key"] for r in off.records]
    add("record keys unique", len(keys) == len(set(keys)), f"{len(keys)} records")
    ids_ok = all(re.fullmatch(r"ocd-person/" + UUID.pattern, r["person_id"]) for r in off.records)
    add("person ids are ocd-person UUIDs", ids_ok, f"{c['distinct_person_ids']} distinct ids")
    add(
        "every role belongs to a record",
        {r["record_key"] for r in off.roles} <= set(keys),
        f"{len(off.roles)} roles",
    )
    bad = [i for i in off.issues if i["severity"] == "error"]
    add(
        "no removed field, blocked host, consumer e-mail or non-capitol office", not bad, f"{len(bad)} errors"
    )
    add(
        "attribution and license documents present",
        not off.provenance["documents_missing"],
        "missing: " + (", ".join(off.provenance["documents_missing"]) or "none"),
    )
    retired_open = [
        r["record_key"] for r in off.records if r["group"] == "retired" and r["status"] != "former_in_source"
    ]
    add("no retired record is treated as current", not retired_open, f"{len(retired_open)} violations")
    return out
