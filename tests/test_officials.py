"""Officials and committees reference data: importer rules, dashboard files and the real archive's counts.

The fixture archive is tiny and hand-checkable. Tests against the real pinned archive are skipped when it is
not in the raw cache (a fresh clone before `alcohol-data import-asset`).
"""

from __future__ import annotations

import json
import zipfile
from pathlib import Path

import pytest
import yaml

from alcohol_data import paths
from alcohol_data.officials import dashboard as OD
from alcohol_data.officials.importer import (
    REMOVED_KEYS,
    ArchiveError,
    check_officials,
    load_officials,
    parse_jurisdiction,
    role_covers,
    role_open_at,
    service_status,
)

SNAP = "2026-10-08"
U = "00000000-0000-4000-8000-0000000000"  # + two hex digits
GOV = "ocd-jurisdiction/country:us/state:ut/government"


def pid(n: int) -> str:
    return f"ocd-person/{U}{n:02x}"


SANITIZATION = f"""# Officials-only copy of Open States People (made 2026-10-11)

Source: people-main.zip (Open States People, github.com/openstates/people, snapshot dated {SNAP}), CC0 1.0.

Kept (whitelist; everything else was dropped):
- People: only those in the legislature, executive, municipalities and retired folders.
- Committees: name, chamber, members linked to an officeholder record.

Removed:
- Birth and death dates, gender, photos, biographies.
- Links to LinkedIn, Facebook, Wikipedia.

Counts: 6 officeholder records (2 legislature, 0 executive, 2 municipal, 2 former) and
2 committees.
"""
CFF = """cff-version: 1.2.0
title: Open States People
authors:
  - given-names: Ada
    family-names: Example
repository-code: 'https://github.com/openstates/people'
abstract: >-
  Machine-readable data on US state legislators and committees.
license: CC0-1.0
"""


def person(n, name, roles, **extra):
    d = {"id": pid(n), "name": name, "roles": roles}
    d.update(extra)
    return d


def make_archive(path: Path, edit=None) -> Path:
    ana = person(
        1,
        "Ana Álvarez",
        [
            {
                "type": "upper",
                "jurisdiction": GOV,
                "district": "7",
                "start_date": "2021-01-04",
                "end_date": "2029-01-01",
            }
        ],
        party=[{"name": "Republican"}],
        email="ana@le.utah.gov",
        offices=[{"classification": "capitol", "address": "350 N State St", "voice": "801-555-0100"}],
        links=[
            {"url": "https://senate.utah.gov/ana"},
            {"url": "https://senate.utah.gov/ana", "note": "homepage"},
        ],
        other_identifiers=[{"scheme": "legacy_openstates", "identifier": "UTL000001"}],
        other_names=[{"name": "A. Alvarez"}],
    )
    bo = person(
        2,
        "Bo Brandt",
        [
            {"type": "lower", "jurisdiction": GOV, "district": "52", "start_date": "2023-01-01"},
            {"type": "lower", "jurisdiction": GOV, "district": "6", "end_date": "2023-01-01"},
        ],
    )
    cy = person(
        3,
        "Cy Cole",
        [
            {
                "type": "mayor",
                "jurisdiction": "ocd-jurisdiction/country:us/state:ut/place:ogden/government",
                "end_date": "2020-01-06",
            }
        ],
    )
    dee = person(
        4,
        "Dee Dunn",
        [
            {
                "type": "upper",
                "jurisdiction": GOV,
                "district": "10",
                "start_date": "2011-01-01",
                "end_date": "2016-12-31",
            }
        ],
        email="dee@example-old.gov",
    )
    pat_ca = person(
        5,
        "Pat Park",
        [
            {
                "type": "mayor",
                "jurisdiction": "ocd-jurisdiction/country:us/state:ca/place:oakland/government",
                "start_date": "2023-01-09",
            }
        ],
    )
    pat_us = person(
        5,
        "Pat Park",
        [
            {
                "type": "lower",
                "jurisdiction": "ocd-jurisdiction/country:us/government",
                "district": "CA-12",
                "start_date": "2013-01-03",
                "end_date": "2025-01-02",
            }
        ],
    )
    files = {
        "ut/legislature/Ana-Alvarez-" + ana["id"].split("/")[1] + ".yml": ana,
        "ut/legislature/Bo-Brandt-" + bo["id"].split("/")[1] + ".yml": bo,
        "ut/municipalities/Cy-Cole-" + cy["id"].split("/")[1] + ".yml": cy,
        "ut/retired/Dee-Dunn-" + dee["id"].split("/")[1] + ".yml": dee,
        "ca/municipalities/Pat-Park-" + pat_ca["id"].split("/")[1] + ".yml": pat_ca,
        "us/retired/Pat-Park-" + pat_us["id"].split("/")[1] + ".yml": pat_us,
        "ut/committees/upper-Revenue-and-Taxation-00000000-0000-4000-9000-000000000001.yml": {
            "id": "ocd-organization/00000000-0000-4000-9000-000000000001",
            "jurisdiction": GOV,
            "classification": "committee",
            "name": "Revenue and Taxation",
            "chamber": "upper",
            "other_names": [{"name": "Senate Revenue and Taxation"}],
            "members": [
                {"name": "Ana Álvarez", "role": "chair", "person_id": pid(1)},
                {"name": "Dee Dunn", "role": "member", "person_id": pid(4)},
                {"name": "Gary Daniels", "role": "member", "person_id": pid(0xFF)},
            ],
            "links": [{"url": "https://le.utah.gov/committee/1"}],
        },
        "ut/committees/lower-Revenue-and-Taxation-00000000-0000-4000-9000-000000000002.yml": {
            "id": "ocd-organization/00000000-0000-4000-9000-000000000002",
            "jurisdiction": GOV,
            "classification": "committee",
            "name": "Revenue and Taxation",
            "chamber": "lower",
            "other_names": [],
            "members": [{"name": "Bo Brandt", "role": "vice chair", "person_id": pid(2)}],
        },
    }
    if edit:
        edit(files)
    with zipfile.ZipFile(path, "w") as z:
        for name, text in {
            "SANITIZATION.md": SANITIZATION,
            "CITATION.cff": CFF,
            "LICENSE": "Creative Commons Legal Code\n\nCC0 1.0 Universal\n",
            "README.md": "# Open States People\n",
            "schema.md": "# Person Schema\n",
        }.items():
            z.writestr(f"people-main/{name}", text)
        for name, obj in files.items():
            z.writestr(f"people-main/data/{name}", yaml.safe_dump(obj, allow_unicode=True, sort_keys=False))
    return path


@pytest.fixture()
def archive(tmp_path):
    return make_archive(tmp_path / "people-main-officials-only.zip")


# ----- date and status rules (hand-checkable) ------------------------------------------------------


def test_role_covers_cases():
    # web/src/lib/officials.test.ts::"matches the Python importer on the same cases" uses these exact rows.
    cases = [
        ("2021-01-04", "2029-01-01", "2025-06-01", True, "yes"),
        ("2021-01-04", "2029-01-01", "2021-01-03", True, "no"),
        ("2023-01-01", None, "2025-01-01", True, "yes"),
        ("2005-01-01", None, "2010-01-01", False, "unknown"),
        (None, "2010-12-31", "2009-06-01", False, "unknown"),
        (None, "2010-12-31", "2011-01-01", False, "no"),
        (None, None, "2015-01-01", True, "unknown"),
        ("2023-01-17", "2017-01-21", "2020-01-01", False, "unknown"),
    ]
    for start, end, day, current, want in cases:
        assert role_covers(start, end, day, current) == want, (start, end, day, current)
    # both ends are inclusive
    assert role_covers("2021-01-04", "2029-01-01", "2021-01-04", False) == "yes"
    assert role_covers("2021-01-04", "2029-01-01", "2029-01-01", False) == "yes"


def test_a_missing_end_date_does_not_make_anyone_current():
    open_role = [{"start_date": "2005-01-01", "end_date": None}]
    assert service_status("retired", open_role, SNAP) == "former_in_source"
    assert service_status("legislature", open_role, SNAP) == "current_in_source"
    ended = [{"start_date": None, "end_date": "2020-01-06"}]
    assert service_status("municipalities", ended, SNAP) == "ended_in_current_files"
    assert role_open_at("2021-01-04", "2029-01-01", SNAP)  # a term ending after the snapshot is still open
    assert not role_open_at(None, "2026-10-07", SNAP)
    assert role_open_at("2023-01-01", None, SNAP)
    assert not role_open_at("2026-11-01", None, SNAP)  # starts after the snapshot


def test_jurisdiction_forms():
    assert parse_jurisdiction("ocd-jurisdiction/country:us/government")["scope"] == "federal"
    ut = parse_jurisdiction(GOV)
    assert (ut["scope"], ut["state"], ut["place"]) == ("state", "ut", None)
    og = parse_jurisdiction("ocd-jurisdiction/country:us/state:ut/place:ogden/government")
    assert (og["scope"], og["state"], og["place"]) == ("place", "ut", "ogden")
    assert parse_jurisdiction("ocd-jurisdiction/country:us/territory:pr/government")["state"] == "pr"
    assert parse_jurisdiction("ocd-jurisdiction/country:us/district:dc/government")["scope"] == "district"
    with pytest.raises(ArchiveError):
        parse_jurisdiction("ocd-jurisdiction/country:ca/government")


# ----- importer on the fixture ---------------------------------------------------------------------


def test_fixture_counts_ids_and_relationships(archive):
    off = load_officials(archive)
    assert off.snapshot == SNAP and off.provenance["copy_made_on"] == "2026-10-11"
    assert off.provenance["license"] == "CC0-1.0" and off.provenance["documents_missing"] == []
    assert off.provenance["stated_counts"] == {
        "records": 6,
        "legislature": 2,
        "executive": 0,
        "municipalities": 2,
        "retired": 2,
        "committees": 2,
    }
    c = off.counts()
    assert c["records"] == 6 and c["distinct_person_ids"] == 5 and c["roles"] == 7 and c["committees"] == 2
    assert c["by_status"] == {"current_in_source": 3, "ended_in_current_files": 1, "former_in_source": 2}
    assert (
        c["memberships"] == 4 and c["memberships_unresolved"] == 1 and c["memberships_of_former_records"] == 1
    )
    # the same id in two files stays two records
    pats = [r for r in off.records if r["person_id"] == pid(5)]
    assert sorted(r["record_key"] for r in pats) == [f"ca/municipalities/{U}05", f"us/retired/{U}05"]
    assert any(i["kind"] == "person_id_in_several_files" for i in off.issues)
    # the unresolved member keeps the name the committee file gave and is flagged, not matched by name
    gary = next(m for m in off.memberships if not m["resolved"])
    assert gary["name_in_committee_file"] == "Gary Daniels" and gary["person_id"] == pid(0xFF)
    assert any(i["kind"] == "member_not_in_archive" for i in off.issues)
    assert any(i["kind"] == "member_is_former_in_source" for i in off.issues)
    assert not off.errors()


def test_checks_pass_on_the_fixture_and_fail_when_counts_drift(archive, tmp_path):
    assert all(ok for _, ok, _ in check_officials(archive))
    bad = make_archive(tmp_path / "bad.zip", edit=lambda f: f.pop(next(k for k in f if "Dee-Dunn" in k)))
    results = dict((n, ok) for n, ok, _ in check_officials(bad))
    assert results["counts match SANITIZATION.md"] is False


def test_an_uncleaned_archive_fails_loudly(tmp_path):
    def dirty(files):
        k = next(k for k in files if "Ana-Alvarez" in k)
        files[k]["birth_date"] = "1970-01-01"
        files[k]["links"].append({"url": "https://www.linkedin.com/in/ana"})
        files[k]["email"] = "ana@gmail.com"
        files[k]["offices"].append({"classification": "district", "address": "1 Home St"})
        files[k]["extras"] = {"occupation": "farmer"}

    off = load_officials(make_archive(tmp_path / "dirty.zip", edit=dirty))
    kinds = {i["kind"] for i in off.errors()}
    assert {
        "removed_field_present",
        "blocked_link_host",
        "consumer_mail_domain",
        "office_class",
        "unexpected_extra",
    } <= kinds
    results = dict((n, ok) for n, ok, _ in check_officials(tmp_path / "dirty.zip", off))
    assert results["no removed field, blocked host, consumer e-mail or non-capitol office"] is False


def test_an_archive_without_sanitization_notes_is_refused(tmp_path):
    p = tmp_path / "raw.zip"
    with zipfile.ZipFile(p, "w") as z:
        z.writestr("people-main/README.md", "x")
    with pytest.raises(ArchiveError):
        load_officials(p)


# ----- dashboard files -----------------------------------------------------------------------------


def _files(archive, relevance=None):
    off = load_officials(archive)
    rel = (
        relevance
        if relevance is not None
        else [
            {
                "jurisdiction": "ut",
                "chamber": "upper",
                "committee_name": "Revenue and Taxation",
                "subject_relevance": "possible",
                "relevance_basis": "name only",
                "referral_status": "unverified",
                "referral_bill": "",
                "referral_evidence_url": "",
                "review_status": "not_reviewed",
                "notes": "",
            }
        ]
    )
    return off, OD.build_files(off, [], rel, {"source_id": "openstates_people"})


def test_contact_details_only_for_records_current_in_source(archive):
    _, files = _files(archive)
    ut = {r["name"]: r for r in files["officials/ut.json"]["records"]}
    assert ut["Ana Álvarez"]["contact"]["email"] == "ana@le.utah.gov"
    assert ut["Ana Álvarez"]["contact"]["offices"][0]["voice"] == "801-555-0100"
    assert "contact" not in ut["Dee Dunn"]  # former: the source has an e-mail, but it is not carried over
    assert "contact" not in ut["Cy Cole"] and "contact" not in ut["Bo Brandt"]
    assert (
        ut["Ana Álvarez"]["status"] == "current_in_source"
        and ut["Cy Cole"]["status"] == "ended_in_current_files"
    )


def test_records_are_never_merged_and_point_at_each_other(archive):
    _, files = _files(archive)
    ca = files["officials/ca.json"]["records"][0]
    us = files["officials/us.json"]["records"][0]
    assert (
        ca["id"] == us["id"] == pid(5)
        and ca["status"] == "current_in_source"
        and us["status"] == "former_in_source"
    )
    assert ca["also_in"] == [f"us/retired/Pat-Park-{U}05.yml"] and us["also_in"] == [
        f"ca/municipalities/Pat-Park-{U}05.yml"
    ]
    idx = files["officials.json"]
    assert [x["paths"] for x in idx["person_ids_in_several_files"]][0][0].startswith("ca/")


def test_committee_relationships_are_explicit(archive):
    off, files = _files(archive)
    up = next(c for c in files["officials/ut.json"]["committees"] if c["chamber"] == "upper")
    assert up["members"] == [
        {"pid": pid(1), "role": "chair"},
        {"pid": pid(4), "role": "member", "former": True},
        {"pid": pid(0xFF), "role": "member", "unresolved": True, "name": "Gary Daniels"},
    ]
    idx = files["officials.json"]
    assert idx["unresolved_memberships"] == [
        {"committee_id": up["id"], "state": "ut", "name": "Gary Daniels", "person_id": pid(0xFF)}
    ]
    reg = idx["committee_register"][0]
    assert reg["committee_ids"] == [
        up["id"]
    ]  # matched on state, chamber and name; the lower chamber's twin is not
    assert reg["referral_status"] == "unverified" and idx["review_status"] == "not_reviewed"
    ut = next(j for j in idx["jurisdictions"] if j["code"] == "ut")
    assert (ut["records"], ut["current_in_source"], ut["ended_in_current_files"], ut["former_in_source"]) == (
        4,
        2,
        1,
        1,
    )


def test_a_documented_referral_needs_a_bill_and_a_url(tmp_path):
    head = ",".join(OD.RELEVANCE_COLUMNS)
    ok = tmp_path / "ok.csv"
    ok.write_text(head + "\nut,upper,X,possible,b,unverified,,,not_reviewed,\n", encoding="utf-8")
    assert OD.read_relevance(ok)[0]["referral_status"] == "unverified"
    bad = tmp_path / "bad.csv"
    bad.write_text(head + "\nut,upper,X,possible,b,documented,,,not_reviewed,\n", encoding="utf-8")
    with pytest.raises(ArchiveError):
        OD.read_relevance(bad)
    odd = tmp_path / "odd.csv"
    odd.write_text(head + "\nut,upper,X,possible,b,probably,,,not_reviewed,\n", encoding="utf-8")
    with pytest.raises(ArchiveError):
        OD.read_relevance(odd)


def _keys(obj):
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield k
            yield from _keys(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from _keys(v)


def test_no_removed_field_in_the_exported_files(archive):
    _, files = _files(archive)
    assert not (set(_keys(files)) & REMOVED_KEYS)
    # The index quotes SANITIZATION.md ("Links to LinkedIn, ..."), so scan the record and committee files only.
    text = json.dumps({k: v for k, v in files.items() if k.startswith("officials/")}).lower()
    for needle in ("linkedin", "facebook", "twitter", "birth_date", "@gmail."):
        assert needle not in text


# ----- the real archive ----------------------------------------------------------------------------


def _real_archive() -> Path | None:
    d = paths.ROOT / "data" / "raw" / "openstates_people_officials_2026_10_08"
    zips = sorted(d.glob("*-people-main-officials-only.zip")) if d.is_dir() else []
    return zips[0] if zips else None


needs_real = pytest.mark.skipif(
    _real_archive() is None, reason="officials archive not imported (alcohol-data import-asset)"
)


@needs_real
def test_real_archive_matches_the_pin_the_counts_it_states_and_the_dashboard_files():
    z = _real_archive()
    pin = json.loads((paths.ROOT / "config" / "builds" / "preview.pins.json").read_text(encoding="utf-8"))[
        "openstates_people_officials_2026_10_08"
    ]
    from alcohol_data.officials.importer import sha256_file

    assert sha256_file(z) == pin["sha256"]
    off = load_officials(z)
    results = check_officials(z, off)
    assert all(ok for _, ok, _ in results), [r for r in results if not r[1]]
    c = off.counts()
    assert (c["records"], c["committees"], c["memberships"], c["distinct_person_ids"]) == (
        22692,
        3042,
        38864,
        22691,
    )
    assert c["by_group"] == {"legislature": 7959, "executive": 201, "municipalities": 608, "retired": 13924}
    assert c["memberships_unresolved"] == 2 and off.snapshot == SNAP
    rel = OD.read_relevance(paths.CURATED_DIR / "officials" / "committee_relevance.csv")
    files = OD.build_files(off, [], rel, {"source_id": "openstates_people"})
    ut = files["officials/ut.json"]
    assert len(ut["records"]) == 296 and len(ut["committees"]) == 72
    assert sum(1 for r in ut["records"] if r["status"] == "current_in_source") == sum(
        1 for r in off.records if r["state"] == "ut" and r["status"] == "current_in_source"
    )
    # every register row finds its committee in the archive
    assert all(len(r["committee_ids"]) == 1 for r in files["officials.json"]["committee_register"])
    # no contact details on a record that is not current in the source
    for fname, f in files.items():
        if fname.startswith("officials/"):
            assert all(r["status"] == "current_in_source" for r in f["records"] if "contact" in r)
    assert not (set(_keys(files)) & REMOVED_KEYS)
