"""Utah session laws 2010-2013: digest and index parsing, enrolled-bill markup, effective dates, merging,
reconstruction rules, and the committed inventory and reconstruction outputs."""

import csv
import re
from datetime import date

import pytest
import yaml

from alcohol_data.legal import utah_code as uc
from alcohol_data.legal import utah_session_laws as sl
from tests.conftest import FIXTURES

SL = FIXTURES / "utah_session_laws"


# ---------------------------------------------------------------- enrolled-bill markup (synthetic, same markup)


def _line(n: int, html: str) -> str:
    """One printed bill line in the Legislature's enrolled-bill HTML."""
    return (
        "<!-- WP Paired Style On: lineno -->&nbsp;&nbsp;<!-- WP Style End: lineno -->\n"
        f"{n}\n<!-- WP Paired Style Off: lineno -->\n&nbsp;&nbsp;<!-- WP Style End: lineno -->\n"
        f"{html}<br>\n\n"
    )


def _bill(*lines: str, affected: str = "") -> str:
    body = "".join(_line(i + 10, h) for i, h in enumerate(lines))
    return f"<html><body>{affected}<i>Be it enacted by the Legislature of the state of Utah:</i><br>\n{body}[Bill Documents]</body></html>"


SECTION_HEAD = (
    "&nbsp;&nbsp;Section {n}.  \n<!-- WP Paired Style On: bstat -->Section <b> <!-- WP Style End: bstat -->\n"
    "{sec}\n<!-- WP Paired Style Off: bstat --></b><!-- WP Style End: bstat -->\n is {action} to read:"
)

BILL = _bill(
    SECTION_HEAD.format(n=1, sec="32B-1-102 (Effective 07/01/11)", action="amended"),
    "<b> 32B-1-102 (Effective 07/01/11).  </b><b>Definitions.</b>",
    "<u><i>(22)  &quot;Container&quot; means a receptacle.</i></u>",
    "[<strike>(22)</strike>] <u><i>(23)</i></u>  &quot;Convention center&quot; means a facility that is",
    "[<strike>at least 30,000 square feet; and</strike>",
    "<strike>in a county</strike>] <u><i>in total at least 30,000 square feet</i></u>.",
    SECTION_HEAD.format(n=2, sec="32B-4-402", action="enacted"),
    "<u><i>32B-4-402.</i></u> <b>Unauthorized sale.</b>",
    "<u><i>A person may not sell an alcoholic product other than as authorized by this title.</i></u>",
    "&nbsp;&nbsp;Section 3.  <b>Effective date.</b>",
    "(1) Except as provided in Subsection (2), this bill takes effect on July 1, 2011.",
    "(2) The amendments to Section 32B-6-603 (Effective 07/01/11) take effect on November 1, 2011.",
    "&nbsp;&nbsp;Section 4.  <b>Coordinating this S.B. 12 with S.B. 314 -- Technically merging changes.</b>",
    "If this S.B. 12 and S.B. 314 both pass, the changes are merged.",
)


def test_before_and_after_text_follow_the_markup():
    sec = sl.bill_sections(BILL)[0]
    before, after = sl.body_words(sec.before, "32B-1-102"), sl.body_words(sec.after, "32B-1-102")
    assert " ".join(before) == (
        'definitions. (22) "convention center" means a facility that is at least 30,000 square feet; and in a county.'
    )
    assert " ".join(after) == (
        'definitions. (22) "container" means a receptacle. (23) "convention center" means a facility that is '
        "in total at least 30,000 square feet."
    )
    # Brackets belong to the deletion; none survive, and printed line numbers never enter the text.
    assert "[" not in sec.before + sec.after and "]" not in sec.before + sec.after
    assert not any(w.isdigit() for w in before + after)


def test_bill_sections_are_numbered_and_classified():
    secs = sl.bill_sections(BILL)
    assert [s.number for s in secs] == [1, 2, 3, 4]
    assert (secs[0].code_section, secs[0].action, secs[0].version_note) == (
        "32B-1-102",
        "amended",
        "Effective 07/01/11",
    )
    assert (secs[1].code_section, secs[1].action) == ("32B-4-402", "enacted")
    assert secs[0].first_line == "10"
    clauses = sl.special_clauses(secs)
    assert clauses["effective_date"][0].startswith("Effective date. (1) Except as provided")
    assert "S.B. 314" in clauses["coordination"][0]


def test_section_effective_reads_the_clause():
    clause = sl.special_clauses(sl.bill_sections(BILL))["effective_date"]
    general = date(2011, 5, 10)
    assert sl.section_effective(clause, "32B-1-102", general) == (date(2011, 7, 1), "effective_date_clause")
    assert sl.section_effective(clause, "32B-6-603", general)[0] == date(2011, 11, 1)
    assert sl.section_effective([], "32B-1-102", general)[0] == general
    immediate = ["Effective date. This bill takes effect upon approval by the governor."]
    assert sl.section_effective(immediate, "32B-1-102", date(2011, 7, 28))[0] == date(2011, 7, 28)
    odd = ["Effective date. Section 32B-1-102 is effective as the commission directs."]
    assert sl.section_effective(odd, "32B-1-102", general)[0] is None


def test_retrospective_operation():
    clause = [
        "Effective date -- Retrospective operation. (2) The amendments in this bill have retrospective "
        "operation to July 1, 2011, except for the amendments to Section 32B-6-902 (Effective 03/01/12)."
    ]
    assert sl.retrospective_to(clause, "32B-1-102") == date(2011, 7, 1)
    assert sl.retrospective_to(clause, "32B-6-902") is None


AFFECTED = (
    "Utah Code Sections Affected: <br>"
    + _line(1, "AMENDS: ")
    + _line(2, " 32B-1-102 , as last amended by Laws of Utah 2011, Chapters 307 and 334 ")
    + _line(3, " 32B-6-603 (Superseded 11/01/11) , as enacted by Laws of Utah 2010, Chapter 276 ")
    + _line(4, " 59-15-101 , as last amended by Laws of Utah 2009, Chapters 105, 291, 328,")
    + _line(5, " and 353 ")
    + _line(6, "ENACTS: ")
    + _line(7, " 32B-6-902 , Utah Code Annotated 1953 ")
)


def test_sections_affected_and_history_chapters():
    rows = sl.sections_affected(_bill(affected=AFFECTED))
    assert rows[0] == (
        "AMENDS",
        "32B-1-102",
        "",
        "as last amended by Laws of Utah 2011, Chapters 307 and 334",
    )
    assert rows[1][:3] == ("AMENDS", "32B-6-603", "Superseded 11/01/11")
    assert rows[2][3].endswith("328, and 353")
    assert rows[3][:2] == ("ENACTS", "32B-6-902")
    assert sl.history_chapters(rows[0][3]) == {(2011, "GS", 307), (2011, "GS", 334)}
    assert sl.history_chapters(rows[2][3]) == {(2009, "GS", n) for n in (105, 291, 328, 353)}
    assert sl.history_chapters("as last amended by Laws of Utah 2011, Second Special Session, Chapter 2") == {
        (2011, "S2", 2)
    }


# ---------------------------------------------------------------- digest and index (real slices)


def _digest_entries():
    pages = (SL / "digest2011_pages.txt").read_text(encoding="utf-8").split("\f")
    return sl.parse_digest(pages, 2011)


def test_digest_reads_passed_and_veto_override_pages_only():
    entries = _digest_entries()
    bills = {e.bill: e for e in entries}
    sb12 = bills["SB 12"]
    assert (sb12.session, sb12.chapter, sb12.effective) == ("2011GS", 307, date(2011, 7, 1))
    assert ("Amends", "32B-1-102", "Effective 07/01/11", "") in sb12.actions
    assert ("Amends", "32B-11-608", "Effective 07/01/11", "") in sb12.actions
    assert ("Renumbers and Amends", "32B-4-510", "Effective 07/01/11", "32B-1-206") in sb12.actions
    overridden = [e for e in entries if e.veto_override]
    assert {e.bill for e in overridden} == {"SB 229", "HB 328"}
    assert all(e.session == "2011GS" and e.chapter is None for e in overridden)
    # Vetoed and introduced bills on their own pages never become entries.
    assert all(e.chapter or e.veto_override for e in entries)


def test_passed_bills_index():
    rows = sl.parse_passed_bills((SL / "passed_bills_2011gs_rows.html").read_text(encoding="utf-8"))
    by = {r["bill"]: r for r in rows}
    assert by["SB 314"]["chapter"] == 334 and by["SB 314"]["bill_version"] == "SB0314S01"
    assert by["SB 305"]["chapter"] is None  # vetoed
    assert by["HB 328"]["chapter"] == 442


# Pages in the layouts of the 2003-2009 digests (text as pypdf extracts it).
OLDER_DIGEST = [
    "DIGEST OF LEGISLATION\n2003 FIRST SPECIAL SESSION\nof the 55th Legislature\nConvened May 21, 2003",
    # The running header names another part; the part's own heading names the session.
    "2002 Digest of LegislationSummaries by Utah Code Titles\n223\nPASSED LEGISLATION\n2003 FIRST SPECIAL SESSION\n"
    "HB 1001 Amendments to Master Bond Act (Ron Bigelow) This act modifies the Master Bond Act.\n"
    "Amends 63B-1-101\nEffective June 18, 2003 Chapter 1, Laws of Utah 2003, First Special Session",
    # Title and description share a line; the next bill's number is glued to the chapter line.
    "2004 Digest of LegislationPassed Legislation - 2004 General Session\n132\n"
    "SB 66 Beer Tax (A. Sponsor) This act increases the beer tax rate.\n"
    "Amends 32A-1-115, 59-15-101,\n59-15-109\n"
    "Effective May 3, 2004 Chapter 297, Laws of Utah 2004 SB 179\n"
    "Expedited Appeals in Child Welfare Cases (Lyle W. Hillyard)\nThis bill takes effect May 3, 2004.\n"
    "Amends 78-3a-909\nChapter 298, Laws of Utah 2004",
]


def test_older_digest_layouts():
    entries = {e.bill: e for e in sl.parse_digest(OLDER_DIGEST, 2004)}
    assert entries["HB 1001"].session == "2003S1" and entries["HB 1001"].chapter == 1
    sb66 = entries["SB 66"]
    assert sb66.title == "Beer Tax (A. Sponsor)"
    assert [a[1] for a in sb66.actions] == ["32A-1-115", "59-15-101", "59-15-109"]
    assert (sb66.chapter, sb66.effective) == (297, date(2004, 5, 3))
    sb179 = entries["SB 179"]  # chapter on a line of its own, date from the body
    assert (sb179.session, sb179.chapter, sb179.effective) == ("2004GS", 298, date(2004, 5, 3))
    assert sb179.title.startswith("Expedited Appeals")


def test_older_enrolled_bill_format():
    affected = (
        "This act affects sections of Utah Code Annotated 1953 as follows:<br>AMENDS:<br>"
        "<b> &nbsp;&nbsp;59-15-101</b>, as last amended by Chapters 30 and 66, Laws of Utah 1992<br>"
    )
    raw = _bill(
        SECTION_HEAD.format(n=1, sec="59-15-101", action="amended"),
        "<b> 59-15-101.</b>   <b> Tax basis -- Rate.</b>",
        "(1) A tax is imposed at the rate [<strike>of $11 per 31-gallon barrel</strike>] on all beer",
        "<br>\n<center>- 9 -</center>\n\n\n<p><HR>",
        "manufactured in this state.",
        affected=affected,
    )
    rows = sl.sections_affected(raw)
    assert rows == [("AMENDS", "59-15-101", "", "as last amended by Chapters 30 and 66, Laws of Utah 1992")]
    assert sl.history_chapters(rows[0][3]) == {(1992, "GS", 30), (1992, "GS", 66)}
    before = " ".join(sl.body_words(sl.bill_sections(raw)[0].before, "59-15-101"))
    assert before.endswith("rate of $11 per 31-gallon barrel on all beer manufactured in this state.")
    assert "- 9 -" not in before


def test_bill_keys():
    assert sl.bill_key("SB0314S01") == "SB 314"
    assert sl.bill_key("HB1001") == "HB 1001"
    assert sl.session_code("2010 Second Special Session") == "2010S2"
    assert sl.session_code("2012 General Session") == "2012GS"


def _records(digest, index, enrolled=None):
    return sl.Records({2099: ("digest", digest)}, {"2011S1": ("index", index)}, enrolled or {}, [])


def test_inventory_needs_every_chaptered_bill_accounted_for():
    entry = sl.DigestEntry(2099, "2011S1", "HB 1001", "A bill (Sponsor)", 0, date(2011, 5, 25), "", 1)
    entry.actions = [("Amends", "63G-1-101", "", "")]
    index = [
        {"bill": "HB 1001", "chapter": 1, "title": "A bill"},
        {"bill": "HB 1002", "chapter": 2, "title": "Another bill"},
    ]
    sessions, _ = sl.inventory(_records([entry], index))
    row = next(s for s in sessions if s["session"] == "2011S1")
    assert row["coverage"] == "partial" and row["unresolved_bills"] == "HB 1002"
    raw = _bill(affected=AFFECTED)
    sessions, enactments = sl.inventory(_records([entry], index, {("2011S1", "HB 1002"): ("hb1002", raw)}))
    row = next(s for s in sessions if s["session"] == "2011S1")
    assert row["coverage"] == "complete_for_declared_dependencies"
    assert row["bills_touching_tracked_sections"] == "HB 1002"
    assert {e["section"] for e in enactments if e["tracked_section"] == "yes"} == {"32B-1-102", "59-15-101"}


# ---------------------------------------------------------------- merging


def test_merge3_applies_disjoint_edits_and_refuses_overlaps():
    base = "a b c d e".split()
    merged, _ = sl.merge3(base, ["a X c d e".split(), "a b c d Y".split()])
    assert merged == "a X c d Y".split()
    merged, msg = sl.merge3(base, ["a X c d e".split(), "a Z c d e".split()])
    assert merged is None and "conflicting" in msg
    # The same edit from two bills is applied once.
    assert sl.merge3(base, ["a X c d e".split()] * 2)[0] == "a X c d e".split()


def test_definition_merge_sets_numbering_aside():
    base = '(1) "apple" means a fruit. (2) "cider" means juice.'.split()
    bill_a = '(1) "apple" means a fruit. (2) "berry" means a fruit. (3) "cider" means juice.'.split()
    bill_b = '(1) "apple" means a red fruit. (2) "banana" means a fruit. (3) "cider" means juice.'.split()
    assert sl.merge3(base, [bill_a, bill_b])[0] is None  # both insert at "(2)" and renumber cider
    units = sl.merge_units(
        sl.definition_units(sl.neutral_labels(base)),
        [sl.definition_units(sl.neutral_labels(v)) for v in (bill_a, bill_b)],
    )[0]
    printed = '(1) "apple" means a red fruit. (2) "banana" means a fruit. (3) "berry" means a fruit. (4) "cider" means juice.'
    assert units == sl.definition_units(sl.neutral_labels(printed.split()))
    # A wrong print (a definition dropped) does not match.
    assert units != sl.definition_units(
        sl.neutral_labels(printed.replace('(3) "berry" means a fruit. ', "").split())
    )
    # Two bills rewriting the same definition differently cannot be merged silently.
    bill_c = '(1) "apple" means a green fruit. (2) "cider" means juice.'.split()
    assert (
        sl.merge_units(
            sl.definition_units(sl.neutral_labels(base)),
            [sl.definition_units(sl.neutral_labels(v)) for v in (bill_b, bill_c)],
        )[0]
        is None
    )


# ---------------------------------------------------------------- reconstruction rules


def _amendment(bill, chapter, action, effective, text_html, history="", session="2011GS"):
    sec = sl.BillSection(1, "", "1", "32B-4-402", action, "", sl.marked_text("Be it enacted" + text_html))
    return sl.Amendment(session, bill, chapter, action, f"a_{bill}", effective, "test", None, history, sec)


ENACTED = "32B-4-402. <u><i>A person may not sell an alcoholic product other than as authorized by this title.</i></u>"
AMENDED = (
    "32B-4-402. A person may not sell [<strike>an alcoholic product</strike>] <u><i>liquor</i></u> other than "
    "as authorized by this title."
)


def test_amendment_before_commencement_yields_only_the_combined_text():
    enact = _amendment("SB 167", 276, "enacted", date(2011, 7, 1), ENACTED, session="2010GS")
    early = _amendment(
        "SB 12", 307, "amended", date(2011, 5, 10), AMENDED, "as enacted by Laws of Utah 2010, Chapter 276"
    )
    states = sl.reconstruct("32B-4-402", [enact, early], None)
    # The enacted wording is kept as an archive record that never operated: no days, no claims.
    archived, operative = states
    assert archived.never_operative and archived.in_force_from == archived.until == date(2011, 7, 1)
    assert "alcoholic" in archived.words
    assert not any(e.state_id == archived.state_id for e in sl.earlier_states({"32B-4-402": states}))
    assert operative.in_force_from == date(2011, 7, 1) and operative.until == uc.RECORDS_BEGIN
    assert "liquor" in operative.words and "alcoholic" not in operative.words
    assert operative.temporal_status == "reconstructed"  # nothing independent to compare with


REAL_402 = (
    "32B-4-402. A person authorized by this title to sell an alcoholic product and staff of that person may not "
    "sell, offer for sale, or furnish, an alcoholic product in any place, or at any day or time other than as "
    "authorized by this title or the rules of the commission."
)


def test_text_before_amendment_must_match_the_prior_state():
    enact = _amendment(
        "SB 167", 276, "enacted", date(2011, 7, 1), "<u><i>" + REAL_402 + "</i></u>", session="2010GS"
    )
    history = "as enacted by Laws of Utah 2010, Chapter 276"
    # A bill whose text before amendment reads differently where a check looks: something was missed.
    wrong = REAL_402.replace("other than as authorized", "except as authorized") + " <u><i>New.</i></u>"
    later = _amendment("HB 9", 9, "amended", date(2012, 5, 8), wrong, history)
    states = sl.reconstruct("32B-4-402", [enact, later], None)
    assert states[1].temporal_status == "unresolved"
    assert "DIFFERS FROM" in states[1].base_checks[0]
    # A difference no check reads (e.g. a stray letter in the bill's markup) is recorded but not fatal.
    harmless = (
        REAL_402.replace("the rules of the commission.", "the rules of the commission. r")
        + " <u><i>New.</i></u>"
    )
    later = _amendment("HB 9", 9, "amended", date(2012, 5, 8), harmless, history)
    states = sl.reconstruct("32B-4-402", [enact, later], None)
    assert states[1].temporal_status == "reconstructed"
    assert "no check result changes" in states[1].base_checks[0]


def test_same_session_bills_amend_the_session_start_text():
    """2008: H.B. 157 (May 5) and H.B. 171 (July 1) were both drafted against the 2007 text."""
    enact = _amendment("SB 1", 1, "enacted", date(2007, 4, 30), ENACTED, session="2007GS")
    history = "as enacted by Laws of Utah 2007, Chapter 1"
    may = _amendment(
        "HB 157",
        317,
        "amended",
        date(2008, 5, 5),
        "32B-4-402. A person may not sell an alcoholic product other than as authorized by this title<u><i> or rule</i></u>.",
        history,
        session="2008GS",
    )
    july = _amendment(
        "HB 171",
        322,
        "amended",
        date(2008, 7, 1),
        "32B-4-402. A <u><i>licensed</i></u> person may not sell an alcoholic product other than as authorized by this title.",
        history,
        session="2008GS",
    )
    states = sl.reconstruct("32B-4-402", [enact, may, july], None)
    assert [s.in_force_from for s in states] == [date(2007, 4, 30), date(2008, 5, 5), date(2008, 7, 1)]
    assert all("matches" in c for c in states[1].base_checks + states[1].chain_checks)
    may_text, july_text = " ".join(states[1].words), " ".join(states[2].words)
    assert "or rule" in may_text and "licensed" not in may_text
    assert "or rule" in july_text and "licensed" in july_text  # both bills, merged


def test_split_effective_date_by_subsection():
    clause = [
        "Effective date. (1) This bill takes effect on May 12, 2009 except: (a) the amendments in this bill to the "
        "following take effect on July 1, 2009: (i) Section 32A-5-101 ; (x) Subsections 32A-1-105 (12), (23), and "
        "(35); and (xi) Section 32A-1-603 ;"
    ]
    assert sl.section_effective(clause, "32A-1-105", date(2009, 5, 12))[0] == date(2009, 5, 12)
    assert sl.delayed_subsections(clause, "32A-1-105") == (date(2009, 7, 1), "(12), (23), and (35)")
    assert sl.section_effective(clause, "32A-5-101", date(2009, 5, 12))[0] == date(2009, 7, 1)
    assert sl.delayed_subsections(clause, "32A-5-101") is None


def test_endpoint_comparison_distinguishes_differences_the_checks_see():
    enact = _amendment("SB 167", 276, "enacted", date(2011, 7, 1), ENACTED, session="2010GS")
    words = sl.body_words(sl.after_text(sl.marked_text("Be it enacted" + ENACTED)), "32B-4-402")
    assert sl.reconstruct("32B-4-402", [enact], words)[0].temporal_status == "reconciled"
    harmless = [w.replace("person", "Person") if w == "person" else w for w in words] + ["(codified)"]
    assert sl.reconstruct("32B-4-402", [enact], harmless)[0].temporal_status == "reconstructed"
    # Changing the checked phrase ("other than as authorized by this title") must not pass.
    real = sl.body_words(
        "32B-4-402. A person authorized by this title to sell an alcoholic product and staff of that person may not "
        "sell, offer for sale, or furnish, an alcoholic product in any place, or at any day or time other than as "
        "authorized by this title or the rules of the commission.",
        "32B-4-402",
    )
    enact_real = _amendment(
        "SB 167",
        276,
        "enacted",
        date(2011, 7, 1),
        "32B-4-402. <u><i>" + " ".join(real) + "</i></u>",
        session="2010GS",
    )
    assert sl.reconstruct("32B-4-402", [enact_real], real)[0].checks()["sale_only_as_authorized"] == "yes"
    changed = " ".join(real).replace("other than as authorized", "except as authorized").split()
    assert sl.reconstruct("32B-4-402", [enact_real], changed)[0].temporal_status == "unresolved"


@pytest.mark.parametrize(
    "name,section",
    [
        ("C32B-4-S402_1800010118000101.html", "32B-4-402"),
        ("C32B-11-S208_1800010118000101.html", "32B-11-208"),
        ("C59-15-S101_2019051420191101.html", "59-15-101"),
        ("C59-15-S101_2024050120240501.html", "59-15-101"),
    ],
)
def test_checks_agree_on_code_text_and_comparison_words(name, section):
    """The pre-2014 states are checked on normalized words, the code versions on page text: same answers."""
    v = uc.parse_version(section, name, (FIXTURES / "utah_code" / name).read_text(encoding="utf-8"))
    words = sl.body_words(v.text, section)
    assert sl._check_results(section, words) == uc.evaluate(v)


# ---------------------------------------------------------------- committed outputs


def _csv(path):
    with open(path, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def test_every_session_2002_to_2013_is_inventoried():
    rows = {r["session"]: r for r in _csv(sl.INVENTORY_CSV)}
    assert set(rows) == set(sl.SESSIONS)
    for r in rows.values():
        assert r["coverage"] == "complete_for_declared_dependencies", r
        assert not r["unresolved_bills"], r


def test_every_bill_touching_a_tracked_section_is_pinned_enrolled_text():
    doc = yaml.safe_load(sl.SOURCE_YAML.read_text(encoding="utf-8"))
    enrolled = {
        (a["options"]["session"], sl.bill_key(a["options"]["bill"]))
        for a in doc["assets"]
        if a.get("source_series") == "utah_enrolled_bills"
    }
    touching = {(r["session"], r["bill"]) for r in _csv(sl.ENACTMENTS_CSV) if r["tracked_section"] == "yes"}
    assert touching and touching <= enrolled


def test_reconstructed_states_run_to_2014_without_gaps():
    rows = _csv(sl.STATES_CSV)
    for section in uc.SECTIONS:
        states = sorted(
            (
                (date.fromisoformat(r["in_force_from"]), date.fromisoformat(r["in_force_until_exclusive"]), r)
                for r in rows
                if r["section"] == section and r["in_force_from"] and r["operative"] == "yes"
            ),
            key=lambda x: x[:2],
        )
        # Title 32B is never assigned to 2010; the beer tax section is rebuilt from 2003 S.B. 66.
        assert states[0][0] == (date(2003, 5, 5) if section == "59-15-101" else sl.COMMENCEMENT), section
        assert states[-1][1] == uc.RECORDS_BEGIN, section
        for (_, end, _), (start, _, _) in zip(states, states[1:], strict=False):
            assert end == start, section
        for *_, r in states:
            assert r["temporal_status"] in ("reconciled", "reconstructed"), (section, r["state_id"])
            assert r["verification"] != "no independent text", (section, r["state_id"])


def test_last_reconstructed_state_agrees_with_the_2014_version_on_every_check():
    versions = [r for r in _csv(uc.VERSIONS_CSV) if r["version_file"].endswith("_1800010118000101.html")]
    states = _csv(sl.STATES_CSV)
    for v in versions:
        last = next(
            r
            for r in states
            if r["section"] == v["section"] and r["in_force_until_exclusive"] == "2014-01-01"
        )
        checks = {k: val for k, val in v.items() if k.startswith("check_") and val}
        assert {k: last[k] for k in checks} == checks, v["section"]


def test_claims_before_2014_are_never_marked_anchored():
    for c in _csv(uc.CLAIMS_CSV):
        if c["verified_from"] and c["verified_from"] < uc.RECORDS_BEGIN.isoformat():
            assert c["temporal_status"] in ("reconciled", "reconstructed"), c
            assert c["verified_through"] < uc.RECORDS_BEGIN.isoformat(), c


def test_title32a_states_end_at_the_recodification():
    rows = _csv(sl.STATES_CSV)
    for section in uc.CHECKS_32A:
        mine = [r for r in rows if r["section"] == section]
        repeal = [r for r in mine if r["operative"] == "repealed"]
        assert len(repeal) == 1 and repeal[0]["in_force_from"] == "2011-07-01", section
        for r in mine:
            if r["operative"] == "yes" and r["in_force_until_exclusive"]:
                assert r["in_force_until_exclusive"] <= "2011-07-01", (section, r["state_id"])


def test_title32a_split_and_conflict_are_marked_not_reconciled():
    rows = {r["state_id"]: r for r in _csv(sl.STATES_CSV)}
    split = rows["ut_recon_32a_1_105_20090512"]
    assert "split effective date" in split["notes"] and split["temporal_status"] == "reconstructed"
    assert split["check_beer_limit"] == "4abv/3.2abw"  # known although the exact text is not
    # Adopted from the 2009 print because the 2008 bills conflict; then matched to the Legislature's own
    # code page captured 2008-07-10, which is what makes it reconciled.
    conflict = rows["ut_recon_32a_1_105_20080701"]
    assert "no coordination clause" in conflict["basis"]
    assert "identical to the code page captured 2008-07-10" in conflict["verification"]
    assert conflict["temporal_status"] == "reconciled"
    # Days with only some of the 2008 bills in force have no print: reconstructed at best.
    assert rows["ut_recon_32a_1_105_20080505"]["temporal_status"] == "reconstructed"


def test_crosswalk_names_the_predecessors_the_checks_use():
    rows = _csv(sl.uc.LEDGER_DIR / "utah_title32a_crosswalk.csv")
    pairs = {(r["old_section"], r["new_section"]) for r in rows}
    for old, new in [
        ("32A-1-105", "32B-1-102"),
        ("32A-10-101", "32B-7-201"),
        ("32A-12-202", "32B-4-402"),
        ("32A-12-201", "32B-4-401"),
        ("32A-8-106", "32B-11-208"),
        ("32A-8-505", "32B-11-608"),
        ("32A-3-101", "32B-2-601"),
        ("32A-3-104", "32B-2-603"),
    ]:
        assert (old, new) in pairs, (old, new)
    assert all(r["mapping_review_status"] == "finding_aid_unreviewed" for r in rows)
    for claim, reqs in uc.CLAIMS_32A.items():
        for section, *_ in reqs:
            assert section in uc.CHECKS_32A, (claim, section)


# ---------------------------------------------------------------- archived code pages


def _capture(name: str, section: str, captured: date):
    from alcohol_data.legal import utah_archived_code as ac

    text, history, revised = ac.parse_page((SL / name).read_text(encoding="utf-8"))
    text = re.sub(rf"^{re.escape(section)}\s+(?={re.escape(section)})", "", text)
    return ac.Capture(name, section, captured, text, history, revised)


def test_archived_code_pages_read_the_section_and_its_history():
    old = _capture("wayback_32A12_020200_20080710.htm", "32A-12-202", date(2008, 7, 10))
    new = _capture("wayback_32A12_020200_20100729.htm", "32A-12-202", date(2010, 7, 29))
    assert old.history == "Renumbered and Amended by Chapter 23, 1990 General Session"
    assert old.last_revised == date(2008, 5, 1)
    assert "(Repealed 07/01/11)" in new.text  # the 2010 page labels the coming repeal
    # Layout differs (repeated number, the repeal label, a repealer history line); the words do not.
    assert sl.body_words(old.text, "32A-12-202") == sl.body_words(new.text, "32A-12-202")
    assert sl._check_results("32A-12-202", sl.body_words(old.text, "32A-12-202")) == {
        "sale_only_as_authorized": "yes"
    }


def _repeal():
    return sl.Amendment(
        "2010GS", "SB 167", 276, "repealed", "sb167", date(2011, 7, 1), "test", None, "", None
    )


def test_unprinted_section_takes_its_text_from_agreeing_code_pages():
    caps = [
        _capture("wayback_32A12_020200_20080710.htm", "32A-12-202", date(2008, 7, 10)),
        _capture("wayback_32A12_020200_20100729.htm", "32A-12-202", date(2010, 7, 29)),
    ]
    states = sl.apply_captures("32A-12-202", sl.reconstruct("32A-12-202", [_repeal()], None), caps)
    st = states[0]
    assert (st.in_force_from, st.until) == (sl.CAPTURE_TEXT_FROM, date(2011, 7, 1))
    assert st.temporal_status == "reconstructed" and st.checks() == {"sale_only_as_authorized": "yes"}
    assert states[-1].repealed
    # Pages that disagree give no text.
    caps[1].text = caps[1].text.replace("other than as authorized", "except as authorized")
    states = sl.apply_captures("32A-12-202", sl.reconstruct("32A-12-202", [_repeal()], None), caps)
    assert states[0].words is None and states[0].temporal_status == "unresolved"


def test_code_page_confirms_or_contradicts_the_rebuilt_text():
    page = _capture("wayback_32A12_020200_20080710.htm", "32A-12-202", date(2008, 7, 10))
    words = sl.body_words(page.text, "32A-12-202")
    html_text = "32A-12-202. <u><i>" + " ".join(words) + "</i></u>"
    enact = _amendment("SB 1", 1, "enacted", date(2003, 5, 5), html_text, session="2003GS")
    enact.section.code_section = "32A-12-202"

    def rebuilt():
        return sl.reconstruct("32A-12-202", [enact, _repeal()], None)

    assert rebuilt()[0].temporal_status == "reconstructed"  # nothing printed it again before repeal
    st = sl.apply_captures("32A-12-202", rebuilt(), [page])[0]
    assert st.temporal_status == "reconciled" and "identical to the code page" in st.verification
    page.text = page.text.replace("other than as authorized", "except as authorized")
    st = sl.apply_captures("32A-12-202", rebuilt(), [page])[0]
    assert st.temporal_status == "unresolved" and "DIFFERS" in st.verification
