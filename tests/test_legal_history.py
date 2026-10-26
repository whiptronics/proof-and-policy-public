"""Utah Code version history: parser, text checks, ledger structure, and curated intervals vs the ledger."""

import csv
from collections import defaultdict
from datetime import date, timedelta

import pytest

from alcohol_data import paths
from alcohol_data.legal import utah_code as uc
from alcohol_data.transforms.policy import known_window
from tests.conftest import FIXTURES

UC = FIXTURES / "utah_code"


def load(name: str, section: str) -> uc.Version:
    return uc.parse_version(section, name, (UC / name).read_text(encoding="utf-8"))


# ---------------------------------------------------------------- parser on real version files


def test_baseline_version_is_in_force_from_records_start():
    v = load("C32B-4-S402_1800010118000101.html", "32B-4-402")
    assert v.baseline and v.effective is None and v.ended is None
    assert v.window(date(2026, 10, 7)) == (uc.RECORDS_BEGIN, date(2026, 10, 8))
    assert uc.evaluate(v) == {"sale_only_as_authorized": "yes"}


def test_effective_until_label_ends_a_version():
    v = load("C59-15-S101_2019051420191101.html", "59-15-101")
    assert (v.effective, v.ended, v.end_label) == (date(2019, 11, 1), date(2024, 5, 1), "Effective until")
    assert uc.evaluate(v)["beer_tax_rate"] == "usd_13.10_on_or_after_2003_07_01"


def test_2024_schedule_version():
    v = load("C59-15-S101_2024050120240501.html", "59-15-101")
    checks = uc.evaluate(v)
    assert checks["beer_tax_rate"] == "usd_13.10_before_2024_07_01_then_schedule"
    assert checks["schedule_2024_to_2027"] == "yes"


def test_checks_fail_when_the_key_provision_is_absent():
    for name, section in (
        ("C32B-4-S402_1800010118000101.html", "32B-4-402"),
        ("C32B-11-S208_1800010118000101.html", "32B-11-208"),
        ("C59-15-S101_2019051420191101.html", "59-15-101"),
    ):
        v = load(name, section)
        before = uc.evaluate(v)
        v.text = (
            v.text.replace("the department", "the state treasurer")
            .replace("as authorized by this title", "as the clerk prefers")
            .replace("$13.10", "$99.99")
            .replace("$11 per", "$77 per")
        )
        after = uc.evaluate(v)
        positive = [k for k, val in before.items() if val not in ("no", "not_found")]
        assert positive, name
        assert all(after[k] != before[k] for k in positive), (name, before, after)


def test_version_superseded_before_it_took_effect_is_never_in_force():
    raw = '<b><i>(Effective 1/1/2026)</i></b> <b><i>(Superseded 11/2/2025)</i></b><div id="secdiv">x</div>'
    v = uc.parse_version("32B-1-102", "C32B-1-S102_2026010120250507.html", raw)
    assert v.window(date(2026, 10, 7)) is None


# ---------------------------------------------------------------- committed ledger


def _versions():
    with open(uc.VERSIONS_CSV, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def _claims():
    with open(uc.CLAIMS_CSV, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def test_each_section_has_contiguous_non_overlapping_versions_from_2014():
    rows = _versions()
    by_section = defaultdict(list)
    for r in rows:
        if r["status"] != "never_in_force":
            by_section[r["section"]].append(
                (date.fromisoformat(r["in_force_from"]), date.fromisoformat(r["in_force_until_exclusive"]))
            )
        assert r["page_and_listing_agree"] == "yes", r["version_file"]
    assert set(by_section) == set(uc.SECTIONS)
    for section, windows in by_section.items():
        windows.sort()
        assert windows[0][0] == uc.RECORDS_BEGIN, section
        for (_, end), (start, _) in zip(windows, windows[1:], strict=False):
            assert end == start, f"{section}: gap or overlap at {end} / {start}"
        assert sum(1 for r in rows if r["section"] == section and r["status"] == "current") == 1, section


def test_ledger_transitions_match_the_enacted_2019_bill():
    claims = {c["claim_id"]: c for c in _claims()}
    assert claims["ut_beer_definition_max_4abv"]["verified_through"] == "2019-10-31"
    assert claims["ut_beer_definition_max_5abv"]["verified_from"] == "2019-11-01"
    assert claims["ut_beer_tax_1280"]["verified_through"] == "2019-10-31"
    assert claims["ut_beer_tax_1310"]["verified_from"] == "2019-11-01"


def _event(policy_id):
    with open(paths.CURATED_DIR / "policy_events.csv", encoding="utf-8", newline="") as f:
        r = next(x for x in csv.DictReader(f) if x["policy_id"] == policy_id)
    for k in ("effective_start", "effective_end", "known_in_effect_from", "known_in_effect_through"):
        r[k] = date.fromisoformat(r[k]) if r[k] else None
    return r


@pytest.mark.parametrize("policy_id,claim_ids", sorted(uc.INTERVAL_CLAIMS.items()))
def test_curated_utah_intervals_lie_inside_verified_days(policy_id, claim_ids):
    ev = _event(policy_id)
    window = known_window(ev)
    start, end = window
    covered = set()
    for c in _claims():
        if c["claim_id"] in claim_ids and c["verified_from"]:
            d, last = date.fromisoformat(c["verified_from"]), date.fromisoformat(c["verified_through"])
            while d <= last:
                covered.add(d)
                d += timedelta(days=1)
    # Every day the interval claims to know must be a verified day of its claims.
    d = start
    missing = []
    while d < end:
        if d not in covered:
            missing.append(d)
        d += timedelta(days=1)
    assert not missing, f"{policy_id}: {len(missing)} claimed days not verified, first {missing[0]}"


def test_package_agency_channel_is_not_ordinary_grocery_authorization():
    with open(paths.CURATED_DIR / "policy_events.csv", encoding="utf-8", newline="") as f:
        events = list(csv.DictReader(f))
    pa = next(e for e in events if e["policy_id"] == "ut_package_agency_channel")
    assert pa["policy_dimension"] != "ordinary_grocery_wine_authorization"
    ut_grocery = [
        e
        for e in events
        if e["geo_id"] == "state:49" and e["policy_dimension"] == "ordinary_grocery_wine_authorization"
    ]
    assert {e["policy_value"] for e in ut_grocery} == {"not_authorized"}


def test_ledger_respects_as_of_and_marks_machine_review_only():
    for c in _claims():
        assert c["legal_review_status"] == "machine_assisted_review"
        if c["verified_through"]:
            assert c["verified_through"] <= c["as_of_date"]


def test_committed_ledger_matches_the_claim_definitions():
    # The ledger is generated. A claim edited in code without regenerating it would leave the curated
    # intervals checked against requirements the code no longer states.
    def text(reqs):
        return "; ".join(f"{s} {c}={e}" for s, c, e in reqs)

    claims = _claims()
    assert {c["claim_id"] for c in claims} == set(uc.CLAIMS)
    for c in claims:
        alternatives = [uc.CLAIMS[c["claim_id"]]] + (
            [uc.CLAIMS_32A[c["claim_id"]]] if c["claim_id"] in uc.CLAIMS_32A else []
        )
        stated = {text(r) for r in alternatives} | {
            " | or before 2011-07-01: ".join(text(r) for r in alternatives)
        }
        assert c["requirements"] in stated, f"{c['claim_id']}: regenerate the Utah ledger"


def test_every_dependency_check_is_a_ledger_check():
    deps = list(
        csv.DictReader(
            open(paths.CURATED_DIR / "utah" / "claim_dependencies.csv", encoding="utf-8", newline="")
        )
    )
    requirements = [c["requirements"] for c in _claims()]  # every run: Title 32A and 32B sets differ
    for d in deps:
        for item in filter(None, (x.strip() for x in d["ledger_check"].split(";"))):
            section, rest = item.split(":", 1)
            assert any(f"{section} {rest}" in req for req in requirements), item
