"""Version ledger for non-Utah statutes: markup reading, day coverage, and the curated Kentucky intervals."""

from __future__ import annotations

import csv
import json
from datetime import date
from pathlib import Path

import pytest

from alcohol_data import paths
from alcohol_data.legal import version_ledger as vl

ROOT = paths.ROOT
PINS = ROOT / "config" / "builds" / "preview.pins.json"
AS_OF = date(2026, 10, 6)


def V(vid, section, a, b, basis="plain"):  # noqa: N802 - a tiny constructor for tests
    return vl.Version(
        vid,
        "state:99",
        section,
        date.fromisoformat(a),
        date.fromisoformat(b) if b else None,
        basis,
        "x",
        "",
        "",
        "",
        "",
        "",
    )


def test_coverage_finds_gaps_and_overlaps_per_section():
    ok = [V("a", "S", "2000-01-01", "2009-12-31"), V("b", "S", "2010-01-01", "")]
    assert vl.coverage_gaps(ok, date(2000, 1, 1), AS_OF, AS_OF) == []
    gap = [V("a", "S", "2000-01-01", "2009-12-30"), V("b", "S", "2010-01-01", "")]
    assert vl.coverage_gaps(gap, date(2000, 1, 1), AS_OF, AS_OF) == [
        "S: no version in force 2009-12-31 to 2009-12-31"
    ]
    lap = [V("a", "S", "2000-01-01", "2010-01-05"), V("b", "S", "2010-01-01", "")]
    assert vl.coverage_gaps(lap, date(2000, 1, 1), AS_OF, AS_OF) == [
        "S: versions overlap 2010-01-01 to 2010-01-05"
    ]
    short = [V("a", "S", "2001-01-01", "")]
    assert vl.coverage_gaps(short, date(2000, 1, 1), AS_OF, AS_OF) == [
        "S: no version in force 2000-01-01 to 2000-12-31"
    ]
    two_sections = ok + [V("c", "T", "2000-01-01", "2015-06-30")]
    assert vl.coverage_gaps(two_sections, date(2000, 1, 1), AS_OF, AS_OF) == [
        "T: no version in force 2015-07-01 to 2026-10-06"
    ]


def test_region_needs_its_anchors():
    text = "Section 1. Old rule. Section 2. Next rule."
    assert vl.region(text, "Section 1.", "Section 2.") == "Section1.Oldrule."
    assert vl.region(text, "Section 9.", "") is None
    assert vl.region(text, "Section 1.", "Section 9.") is None


def _asset_paths():
    pins = json.loads(PINS.read_text(encoding="utf-8"))
    out = {}
    for v in vl.load_versions().values():
        pin = pins.get(v.asset_id)
        if not pin:
            continue
        hits = [
            p
            for p in (ROOT / "data" / "raw" / v.asset_id).glob(f"{pin['sha256'][:16]}-*")
            if not p.name.endswith(".meta.json")
        ]
        if hits:
            out[v.asset_id] = hits[0]
    return out


def _events():
    with open(ROOT / "data" / "curated" / "policy_events.csv", encoding="utf-8", newline="") as f:
        rows = {r["policy_id"]: r for r in csv.DictReader(f)}
    for r in rows.values():
        for k in ("effective_start", "known_in_effect_from", "known_in_effect_through", "effective_end"):
            r[k] = date.fromisoformat(r[k]) if r[k] else None
    return rows


@pytest.fixture(scope="module")
def assets():
    found = _asset_paths()
    needed = {v.asset_id for v in vl.load_versions().values()}
    if needed - set(found):
        pytest.skip(f"pinned assets not in data/raw: {sorted(needed - set(found))}")
    return found


def test_every_ledger_check_holds_and_every_interval_day_is_covered(assets):
    events = _events()
    checked = {c["policy_id"] for c in vl.load_checks()}
    results, problems = vl.verify(assets, AS_OF, events={k: v for k, v in events.items() if k in checked})
    assert results and all(r["found"] for r in results)
    assert problems == []


def test_kentucky_markup_is_read_both_ways(assets):
    """The 2013 act inserted 'quota' (bold italic); the text before it has no 'quota', the text after does."""
    versions = vl.load_versions()
    before = vl.version_text(versions["ky_243_230_1998"], assets["ky_acts_2013_ch121"])
    after = vl.version_text(versions["ky_243_230_2013"], assets["ky_acts_2013_ch121"])
    assert "(5)Noretailpackageordrinklicense" in before and "quota" not in before.split("(5)No", 1)[1][:40]
    assert "(7)Noquotaretailpackagelicense" in after


def test_a_missing_version_is_a_gap(assets, tmp_path: Path):
    """Remove the 2014 version: the verifier must report the uncovered days, not pass quietly."""
    src = vl.VERSIONS_CSV.read_text(encoding="utf-8").splitlines()
    kept = [line for line in src if not line.startswith("ky_243_230_2014,")]
    assert len(kept) == len(src) - 1
    mutated = tmp_path / "versions.csv"
    mutated.write_text("\n".join(kept) + "\n", encoding="utf-8")
    checks = [
        line
        for line in vl.CHECKS_CSV.read_text(encoding="utf-8").splitlines()
        if ",ky_243_230_2014," not in line
    ]
    mchecks = tmp_path / "checks.csv"
    mchecks.write_text("\n".join(checks) + "\n", encoding="utf-8")
    events = {k: v for k, v in _events().items() if k.startswith("ky_")}
    _, problems = vl.verify(assets, AS_OF, events=events, versions_csv=mutated, checks_csv=mchecks)
    assert any("no version in force 2014-07-15 to 2014-12-31" in p for p in problems)


GENERAL_LICENSE = (
    "Retail off-premises wine and beer licenses, which shall authorize the licensee to sell wine and beer in "
    "closed containers for off-premises consumption"
)


def test_virginia_markup_is_read_both_ways(assets):
    """2001 ch. 361 inserted 'A.' (in <i>); 2020 ch. 1113 struck the license out of § 4.1-209 (in <s>)."""
    before, after = vl.markup_texts(assets["va_acts_2001_ch361"], [], "va_lis_html_italic_strike")
    assert "A.TheBoardmaygrant" not in vl.squash(before) and "A.TheBoardmaygrant" in vl.squash(after)
    versions = vl.load_versions()
    rebuilt = vl.version_text(versions["va_4_1_209_1997"], assets["va_acts_2001_ch361"])
    assert rebuilt.startswith(vl.squash("§ 4.1-209. Wine and beer licenses. The Board may grant"))
    before, after = vl.markup_texts(assets["va_acts_2020_ch1113"], [], "va_lis_html_italic_strike")
    head = "§ 4.1-209. Wine and beer license privileges"
    assert vl.squash(GENERAL_LICENSE) in vl.region(before, head, "§ 4.1-209.1.")
    assert vl.squash(GENERAL_LICENSE) not in vl.region(after, head, "§ 4.1-209.1.")


def test_a_missing_virginia_emergency_version_is_a_gap(assets, tmp_path: Path):
    """Remove the version made by 2006 ch. 153 (an emergency act): its days must be reported uncovered."""
    src = vl.VERSIONS_CSV.read_text(encoding="utf-8").splitlines()
    kept = [line for line in src if not line.startswith("va_4_1_209_2006e,")]
    assert len(kept) == len(src) - 1
    mutated = tmp_path / "versions.csv"
    mutated.write_text("\n".join(kept) + "\n", encoding="utf-8")
    checks = [
        line
        for line in vl.CHECKS_CSV.read_text(encoding="utf-8").splitlines()
        if ",va_4_1_209_2006e," not in line
    ]
    mchecks = tmp_path / "checks.csv"
    mchecks.write_text("\n".join(checks) + "\n", encoding="utf-8")
    events = {k: v for k, v in _events().items() if k.startswith("va_")}
    _, problems = vl.verify(assets, AS_OF, events=events, versions_csv=mutated, checks_csv=mchecks)
    assert any("no version in force 2006-03-23 to 2006-06-30" in p for p in problems)


def test_a_value_version_needs_dates(tmp_path: Path):
    header = vl.VERSIONS_CSV.read_text(encoding="utf-8").splitlines()[0]
    versions = tmp_path / "versions.csv"
    versions.write_text(header + "\nx_undated,state:99,S,,,plain,none,,,,,\n", encoding="utf-8")
    checks = tmp_path / "checks.csv"
    checks.write_text(
        "policy_id,version_id,role,requirement,phrase\np,x_undated,value,r,phrase\n", encoding="utf-8"
    )
    events = {"p": {"effective_start": date(2000, 1, 1), "known_in_effect_through": AS_OF}}
    _, problems = vl.verify({}, AS_OF, events=events, versions_csv=versions, checks_csv=checks)
    assert "p: value version x_undated has no in_force_from" in problems
