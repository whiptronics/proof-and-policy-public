"""Turn the parsed officials tables into the dashboard's files (pure: no database, no clock).

  officials.json        index: source and license, definitions, jurisdictions, policy dates, committee register
  officials/<code>.json one file per archive folder (state, "dc", "pr" or "us"): records and committees

Rules enforced here, because the view relies on them:
* "current in source" comes from the archive's folder and an open role (importer.service_status); it is never
  upgraded to "confirmed", and review_status stays "not_reviewed".
* Contact details (official e-mail, capitol office) are written only for records that are current in the source;
  historical and ended records carry none, so old contact details cannot be shown as current.
* Nothing is merged by name. A person id that sits in two files keeps two records, each pointing at the other.
"""

from __future__ import annotations

import csv
import re
from pathlib import Path

from alcohol_data.officials.importer import (
    PERSON_GROUPS,
    ArchiveError,
    Officials,
)

SCHEMA = "officials@1"
REVIEW_STATUS = "not_reviewed"

JURISDICTION_NAMES = {
    "al": "Alabama",
    "ak": "Alaska",
    "az": "Arizona",
    "ar": "Arkansas",
    "ca": "California",
    "co": "Colorado",
    "ct": "Connecticut",
    "de": "Delaware",
    "dc": "District of Columbia",
    "fl": "Florida",
    "ga": "Georgia",
    "hi": "Hawaii",
    "id": "Idaho",
    "il": "Illinois",
    "in": "Indiana",
    "ia": "Iowa",
    "ks": "Kansas",
    "ky": "Kentucky",
    "la": "Louisiana",
    "me": "Maine",
    "md": "Maryland",
    "ma": "Massachusetts",
    "mi": "Michigan",
    "mn": "Minnesota",
    "ms": "Mississippi",
    "mo": "Missouri",
    "mt": "Montana",
    "ne": "Nebraska",
    "nv": "Nevada",
    "nh": "New Hampshire",
    "nj": "New Jersey",
    "nm": "New Mexico",
    "ny": "New York",
    "nc": "North Carolina",
    "nd": "North Dakota",
    "oh": "Ohio",
    "ok": "Oklahoma",
    "or": "Oregon",
    "pa": "Pennsylvania",
    "pr": "Puerto Rico",
    "ri": "Rhode Island",
    "sc": "South Carolina",
    "sd": "South Dakota",
    "tn": "Tennessee",
    "tx": "Texas",
    "us": "United States (federal)",
    "ut": "Utah",
    "vt": "Vermont",
    "va": "Virginia",
    "wa": "Washington",
    "wv": "West Virginia",
    "wi": "Wisconsin",
    "wy": "Wyoming",
}

DEFINITIONS = {
    "current_in_source": (
        "Filed by the source in its legislature, executive or municipalities folder with at least one role whose "
        "dates do not end before the snapshot date. This is the source's own listing, taken as of the snapshot. It "
        "is not confirmed against an official roster, and a missing end date does not by itself show that someone "
        "still holds the office."
    ),
    "ended_in_current_files": (
        "Filed in a current-service folder, but every recorded role ended before the snapshot date. Treated as "
        "historical here."
    ),
    "former_in_source": "Filed by the source in its retired folder (not serving any tracked role).",
    "committee_membership": (
        "One undated list per committee, as of the snapshot. It does not say who sat on a committee at any earlier "
        "date, and the source does not mark which committees are still active."
    ),
    "serving_on_date": (
        "Only the role dates in the source are used: a record shows for a chosen date when one of its roles has a "
        "recorded start on or before that date and has not ended. It says nothing about sponsoring, voting on or "
        "reviewing any bill."
    ),
}

RELEVANCE_COLUMNS = [
    "jurisdiction",
    "chamber",
    "committee_name",
    "subject_relevance",
    "relevance_basis",
    "referral_status",
    "referral_bill",
    "referral_evidence_url",
    "review_status",
    "notes",
]
REFERRAL_STATUSES = ("unverified", "documented")
REVIEW_STATUSES = ("not_reviewed", "human_reviewed")


def read_relevance(path: Path) -> list[dict]:
    """The curated committee register. A referral may be called 'documented' only with a bill and a URL."""
    with open(path, encoding="utf-8", newline="") as f:
        rd = csv.DictReader(f)
        if rd.fieldnames != RELEVANCE_COLUMNS:
            raise ArchiveError(f"{path}: columns must be {RELEVANCE_COLUMNS}")
        rows = list(rd)
    for i, r in enumerate(rows, start=2):
        if r["referral_status"] not in REFERRAL_STATUSES:
            raise ArchiveError(f"{path} line {i}: referral_status {r['referral_status']!r}")
        if r["referral_status"] == "documented" and not (r["referral_bill"] and r["referral_evidence_url"]):
            raise ArchiveError(
                f"{path} line {i}: a documented referral needs referral_bill and referral_evidence_url"
            )
        if r["review_status"] not in REVIEW_STATUSES:
            raise ArchiveError(f"{path} line {i}: review_status {r['review_status']!r}")
    return rows


def _url_key(url: str) -> str:
    """http/https, www and a trailing slash do not make a different page."""
    return re.sub(r"^https?://(www\.)?", "", url.strip(), flags=re.I).rstrip("/").lower()


def _links(links: list[dict]) -> list[dict]:
    seen, out = set(), []
    for lk in links:
        k = _url_key(lk["url"])
        if k in seen:
            continue
        seen.add(k)
        out.append(_prune({"url": lk["url"], "note": lk["note"]}))
    return out


def _prune(d: dict) -> dict:
    return {k: v for k, v in d.items() if v not in (None, "", [], {})}


def _record(r: dict, roles: list[dict], also_in: list[str]) -> dict:
    links = _links(r["links"])
    ids: dict[str, list[str]] = {}
    for x in r["identifiers"]:
        ids.setdefault(x["scheme"], [])
        if x["identifier"] not in ids[x["scheme"]]:
            ids[x["scheme"]].append(x["identifier"])
    aka = []
    for n in r["other_names"]:
        if n != r["name"] and n not in aka:
            aka.append(n)
    out = {
        "id": r["person_id"],
        "name": r["name"],
        "aka": aka,
        "parties": [
            _prune({"name": p["name"], "start": p["start_date"], "end": p["end_date"]}) for p in r["parties"]
        ],
        "group": r["group"],
        "status": r["status"],
        "roles": [
            _prune(
                {
                    "type": x["type"],
                    "scope": x["scope"],
                    "place": x["place"],
                    "district": x["district"],
                    "start": x["start_date"],
                    "end": x["end_date"],
                    "end_reason": x["end_reason"],
                    "conflict": bool(x["start_date"] and x["end_date"] and x["start_date"] > x["end_date"]),
                }
            )
            for x in roles
        ],
        "links": links,
        "identifiers": ids,
        "seat": r["extras"],
        "also_in": also_in,
    }
    if r["status"] == "current_in_source" and (r["email"] or r["offices"]):
        out["contact"] = _prune(
            {
                "email": r["email"],
                "offices": [_prune(o) for o in r["offices"]],
            }
        )
    return _prune(out)


def build_files(
    off: Officials,
    policy_dates: list[dict],
    relevance: list[dict],
    source: dict,
) -> dict[str, object]:
    """Return {relative path: JSON-able object}. ``source`` carries asset and citation text from the config."""
    roles_by_record: dict[str, list[dict]] = {}
    for x in off.roles:
        roles_by_record.setdefault(x["record_key"], []).append(x)
    paths_by_id: dict[str, list[str]] = {}
    for r in off.records:
        paths_by_id.setdefault(r["person_id"], []).append(r["path"])

    records_by_state: dict[str, list[dict]] = {}
    for r in off.records:
        others = [p for p in paths_by_id[r["person_id"]] if p != r["path"]]
        records_by_state.setdefault(r["state"], []).append(
            _record(r, roles_by_record.get(r["record_key"], []), others)
        )

    group_of: dict[tuple[str, str], str] = {}
    for m in off.memberships:
        if m["resolved"]:
            group_of[(m["committee_id"], m["person_id"])] = m["person_group"]
    members_by_committee: dict[str, list[dict]] = {}
    for m in off.memberships:
        row: dict = {"pid": m["person_id"], "role": m["role"]}
        if not m["resolved"]:
            row.update({"unresolved": True, "name": m["name_in_committee_file"]})
        elif m["person_group"] == "retired":
            row["former"] = True
        members_by_committee.setdefault(m["committee_id"], []).append(_prune(row))
    committees_by_state: dict[str, list[dict]] = {}
    for c in off.committees:
        committees_by_state.setdefault(c["state"], []).append(
            _prune(
                {
                    "id": c["committee_id"],
                    "name": c["name"],
                    "chamber": c["chamber"],
                    "class": c["classification"],
                    "parent": c["parent_id"],
                    "scope": c["scope"],
                    "links": _links(c["links"]),
                    "members": members_by_committee.get(c["committee_id"], []),
                }
            )
        )

    files: dict[str, object] = {}
    jurisdictions = []
    for code in sorted(set(records_by_state) | set(committees_by_state)):
        recs = records_by_state.get(code, [])
        coms = committees_by_state.get(code, [])
        files[f"officials/{code}.json"] = {"code": code, "records": recs, "committees": coms}
        status = {"current_in_source": 0, "ended_in_current_files": 0, "former_in_source": 0}
        for r in recs:
            status[r["status"]] += 1
        jurisdictions.append(
            {
                "code": code,
                "name": JURISDICTION_NAMES.get(code, code.upper()),
                "file": f"officials/{code}.json",
                "records": len(recs),
                "current_in_source": status["current_in_source"],
                "ended_in_current_files": status["ended_in_current_files"],
                "former_in_source": status["former_in_source"],
                "committees": len(coms),
            }
        )
    jurisdictions.sort(key=lambda j: j["name"])

    register = []
    for row in relevance:
        match = [
            c["committee_id"]
            for c in off.committees
            if c["state"] == row["jurisdiction"]
            and c["chamber"] == row["chamber"]
            and c["name"] == row["committee_name"]
        ]
        register.append({**row, "committee_ids": match})

    unresolved = [
        _prune(
            {
                "committee_id": m["committee_id"],
                "state": m["state"],
                "name": m["name_in_committee_file"],
                "person_id": m["person_id"],
            }
        )
        for m in off.memberships
        if not m["resolved"]
    ]
    multi = sorted(
        {
            r["person_id"]: paths_by_id[r["person_id"]]
            for r in off.records
            if len(paths_by_id[r["person_id"]]) > 1
        }.items()
    )
    prov = off.provenance
    files["officials.json"] = {
        "schema": SCHEMA,
        "review_status": REVIEW_STATUS,
        "source": {
            **source,
            "archive_name": source.get("archive_name") or prov["archive_name"],
            "archive_sha256": prov["archive_sha256"],
            "archive_bytes": prov["archive_bytes"],
            "snapshot_date": prov["snapshot_date"],
            "snapshot_date_basis": prov["snapshot_date_basis"],
            "copy_made_on": prov["copy_made_on"],
            "license": prov["license"],
            "license_text": prov["license_text"],
            "cff": prov["citation"],
            "documents_present": prov["documents_present"],
            "sanitization_kept": prov["sanitization_kept"],
            "sanitization_removed": prov["sanitization_removed"],
        },
        "definitions": DEFINITIONS,
        "groups": list(PERSON_GROUPS),
        "counts": off.counts(),
        "jurisdictions": jurisdictions,
        "policy_dates": policy_dates,
        "committee_register": register,
        "unresolved_memberships": unresolved,
        "person_ids_in_several_files": [{"person_id": pid, "paths": ps} for pid, ps in multi],
        "issue_counts": off.issue_counts(),
    }
    return files
