"""Utah session laws, 2010-2013: which bills changed the tracked sections, and the text in force between the
2011-07-01 commencement of Title 32B and 2014-01-01, where the Historical Code begins.

Three kinds of official record, all pinned (config/sources/utah_session_laws.yaml):

* Digests of Legislation (one PDF per year). Every bill enacted in the sessions a digest covers, with its
  code sections affected ("Amends ...; Enacts ...; Renumbers and Amends X to Y"), effective date and
  session-law chapter.
* Passed-bill indexes (one page per session). The same bills with their chapters. A session's inventory
  is complete only when the digest and the index list the same chaptered bills.
* Enrolled bills. Each amended section is reprinted whole, inserted text underlined (<u>) and deleted
  text struck through in brackets ([<strike>...</strike>]), so both the text before and the text after
  the amendment can be read. Also the bill's effective-date, coordination and revisor clauses.

Reconstruction, per tracked section: Title 32B was enacted by 2010 S.B. 167 (ch. 276) to take effect
2011-07-01, and amended before it took effect, so the first operative text is ch. 276 with every
amendment effective on or before that day applied. Each later change starts a new state on its effective
date. Several bills amending one section on the same day are merged word by word against their common
base; overlapping edits are a conflict and leave the state unresolved, never ordered by bill number.
Every state is then compared with an independent official text of the same law: the "before" text of the
next bill that amended the section, or, for the last state, the 2014-01-01 Historical Code version. A
state that matches is `reconciled`; one with nothing to compare against stays `reconstructed`.

Endpoint equality is not proof that nothing changed in between; the inventory (every session, every
chaptered bill, its affected sections) is what supports that, and it is only as complete as the digests'
section lists.
"""

from __future__ import annotations

import csv
import difflib
import hashlib
import html
import logging
import re
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path

from alcohol_data import paths
from alcohol_data.legal import utah_code as uc

SOURCE_ID = "utah_session_laws"
SOURCE_YAML = paths.SOURCES_DIR / "utah_session_laws.yaml"
INVENTORY_CSV = uc.LEDGER_DIR / "utah_session_inventory.csv"
ENACTMENTS_CSV = uc.LEDGER_DIR / "utah_enactments.csv"
STATES_CSV = uc.LEDGER_DIR / "utah_reconstructed_versions.csv"

# 2010 S.B. 167 (Laws of Utah 2010, ch. 276), sec. 384: "This bill takes effect on July 1, 2011".
RECODIFICATION = ("2010GS", "SB 167")
COMMENCEMENT = date(2011, 7, 1)
# Sessions inventoried: every general and special session whose laws could change a tracked section
# between 2003 S.B. 66 (the 2003 beer-tax change, effective 2003-05-05) and 2014-01-01, where the
# Historical Code begins. Special sessions are numbered consecutively within each two-year Legislature
# (54th: ... S4-S6 in 2002; 55th: S1-S2 2003, S3-S4 2004; 56th: S1-S2 2005, S3-S5 2006; 57th: S1 2007,
# S2 2008; 58th: S1 2009, S2 2010; 59th: S1-S3 2011, S4 2012; 60th: S1-S2 2013), so none is missing.
SESSIONS = [
    "2002S4",
    "2002S5",
    "2002S6",
    "2003GS",
    "2003S1",
    "2003S2",
    "2004GS",
    "2004S3",
    "2004S4",
    "2005GS",
    "2005S1",
    "2005S2",
    "2006GS",
    "2006S3",
    "2006S4",
    "2006S5",
    "2007GS",
    "2007S1",
    "2008GS",
    "2008S2",
    "2009GS",
    "2009S1",
    "2010GS",
    "2010S2",
    "2011GS",
    "2011S1",
    "2011S2",
    "2011S3",
    "2012GS",
    "2012S4",
    "2013GS",
    "2013S1",
    "2013S2",
]
# Sessions that the digests name but that passed no bills (no passed-bill index rows).
SESSIONS_WITHOUT_BILLS = {
    "2011 Veto Override Session": "Overrode vetoes of bills already listed under the 2011 General Session.",
    "2013 First House Session": "House-only session; resolutions, no bills.",
}

ORDINALS = {"First": 1, "Second": 2, "Third": 3, "Fourth": 4, "Fifth": 5, "Sixth": 6}
SECTION_ID = r"\d+[A-Z]?-\d+[a-z]?-\d+(?:\.\d+)?"


def session_code(name: str) -> str:
    """'2011 General Session' -> 2011GS; '2010 Second Special Session' -> 2010S2."""
    m = re.fullmatch(r"(\d{4}) General Session", name.strip())
    if m:
        return f"{m.group(1)}GS"
    m = re.fullmatch(r"(\d{4}) (\w+) Special Session", name.strip())
    if m and m.group(2) in ORDINALS:
        return f"{m.group(1)}S{ORDINALS[m.group(2)]}"
    raise ValueError(f"unrecognized session name {name!r}")


def bill_key(raw: str) -> str:
    """'SB0314S01' or 'SB 314' -> 'SB 314'."""
    m = re.match(r"\s*([A-Z]+?)\s*0*(\d+)", raw)
    if not m:
        raise ValueError(f"unrecognized bill number {raw!r}")
    return f"{m.group(1)} {int(m.group(2))}"


# ---------------------------------------------------------------- Digests of Legislation


def digest_pages(pdf_path: Path) -> list[str]:
    """Embedded text of each page (pypdf), minus signs normalized to hyphens."""
    import pypdf

    logging.getLogger("pypdf").setLevel(logging.ERROR)
    reader = pypdf.PdfReader(str(pdf_path))
    return [(p.extract_text() or "").replace("−", "-") for p in reader.pages]


# Running header of a passed-legislation page. Digests from 2010 name the session ("Passed Legislation -
# 2011 General Session"); earlier ones may give only "Passed Legislation - Fourth Special Session", and
# their special-session parts sometimes carry another part's header ("Summaries by Utah Code Titles").
PASSED_HEAD = re.compile(
    r"\A\s*\d{4} D\w*est of Legislation\s*"
    r"(?:Passed Legislation\s*-\s*((?:\d{4} )?[A-Za-z ]+? Session)|Summaries by Utah Code Titles)"
    r"[ \t]*\n(?:\d+[ \t]*\n)?"
)
# The part's own heading on its first page, which wins over the running header:
# "PASSED LEGISLATION 2003 FIRST SPECIAL SESSION". Title pages: "DIGEST OF LEGISLATION 2002 FOURTH
# SPECIAL SESSION". Both name the year.
BODY_SESSION = re.compile(r"PASSED LEGISLATION\s+(\d{4})\s+(GENERAL|\w+\s+SPECIAL)\s+SESSION")
TITLE_SESSION = re.compile(r"DIGEST OF LEGISLATION\s+(\d{4})\s+(GENERAL|\w+\s+SPECIAL)\s+SESSION", re.I)
# Bills that became law when the Legislature overrode a veto are listed on their own page.
VETO_OVERRIDE_HEAD = re.compile(
    r"\A\s*(\d{4}) D\w*est of Legislation\s*Veto Override Session[ \t]*\n(?:\d+[ \t]*\n)?"
)
BILL_HEAD = re.compile(r"^(HB|SB|HJR|SJR|HCR|SCR|HR|SR) (\d{1,4}) (\S.*)$")
EFFECTIVE_LINE = re.compile(
    r"^Effective ([A-Z][a-z]+ \d{1,2}, \d{4})(?: Chapter (\d+),)? Laws of Utah (\d{4})(?:,? (.*))?$"
)
# 2008: when the body states the date ("This bill takes effect May 5, 2008 and has retrospective
# operation ..."), the entry ends with the chapter alone.
CHAPTER_LINE = re.compile(r"^Chapter (\d+), Laws of Utah (\d{4})(?:,? (.*))?$")
BODY_EFFECTIVE = re.compile(r"(?:This|The) (?:bill|act) takes effect (?:on )?([A-Z][a-z]+ \d{1,2}, \d{4})")
# The text layer sometimes glues the next bill's number onto the end of an entry
# ("Effective May 3, 2004 Chapter 297, Laws of Utah 2004 SB 179" / "Expedited Appeals ... (Sponsor)").
GLUED_HEAD = re.compile(
    r"^(.*Laws of Utah \d{4}(?:,? [A-Za-z ]*SESSION)?)\s+((?:HB|SB|HJR|SJR|HCR|SCR|HR|SR) \d{1,4})$", re.I
)
ACTIONS = (
    "Renumbers and Amends",
    "Repeals and Reenacts",
    "Amends",
    "Enacts",
    "Repeals",
    "Renumbers",
)
ACTION_LINE = re.compile(r"^(" + "|".join(ACTIONS) + r")\s+(.*)$")


@dataclass
class DigestEntry:
    digest_year: int
    session: str
    bill: str
    title: str
    page_index: int  # zero-based PDF page index where the entry starts
    effective: date | None = None
    effective_text: str = ""
    chapter: int | None = None
    actions: list[tuple[str, str, str, str]] = field(default_factory=list)  # action, section, note, to
    veto_override: bool = False


def _actions(lines: list[str]) -> list[tuple[str, str, str, str]]:
    groups: list[tuple[str, str]] = []
    current = None
    for line in lines:
        m = ACTION_LINE.match(line)
        if m:
            if current:
                groups.append(current)
            current = (m.group(1), m.group(2))
            if line.rstrip().endswith(";"):
                groups.append(current)
                current = None
        elif current and not EFFECTIVE_LINE.match(line):
            current = (current[0], current[1] + " " + line)
            if line.rstrip().endswith(";"):
                groups.append(current)
                current = None
        elif current:
            groups.append(current)
            current = None
    if current:
        groups.append(current)
    out = []
    for action, text in groups:
        text = re.sub(r"\s+", " ", text)
        if action.startswith("Renumbers"):
            for m in re.finditer(
                rf"({SECTION_ID})(?:\s*\(([^)]*)\))?\s+to\s+({SECTION_ID})(?:\s*\(([^)]*)\))?", text
            ):
                out.append((action, m.group(1), m.group(2) or "", m.group(3)))
        else:
            for m in re.finditer(rf"({SECTION_ID})(?:\s*\(([^)]*)\))?", text):
                out.append((action, m.group(1), m.group(2) or "", ""))
    return out


def parse_digest(pages: list[str], digest_year: int) -> list[DigestEntry]:
    """Every passed-legislation entry, in page order. Only passed-legislation and veto-override pages are
    read, so vetoed, introduced and index pages cannot contribute."""
    lines: list[tuple[str, int, str]] = []  # (session, page_index, line)
    override_pages = set()
    current: str | None = None  # session of the part being read, from its title page or own heading
    for i, page in enumerate(pages):
        t = TITLE_SESSION.search(page[:300])
        if t:
            current = session_code(f"{t.group(1)} {t.group(2).title()} Session")
        m = PASSED_HEAD.match(page)
        if m:
            body = BODY_SESSION.search(page[m.end() : m.end() + 300])
            if body:
                sess = session_code(f"{body.group(1)} {body.group(2).title()} Session")
            elif m.group(1) and m.group(1)[:4].isdigit():
                sess = session_code(m.group(1))
            elif current:
                sess = current
            else:
                raise ValueError(f"page {i}: cannot tell which session its passed legislation belongs to")
            current = sess
        else:
            m = VETO_OVERRIDE_HEAD.match(page)
            if not m:
                continue
            # The page names the session whose vetoes were overridden ("2002 VETO OVERRIDE SESSION").
            y = re.search(r"(\d{4}) VETO OVERRIDE SESSION", page[m.end() : m.end() + 200])
            sess = f"{y.group(1) if y else m.group(1)}GS"
            override_pages.add(i)
        for line in page[m.end() :].split("\n"):
            if line.strip():
                lines.append((sess, i, line.strip()))
    lines = _unglue(lines)
    entries: list[DigestEntry] = []
    cur: DigestEntry | None = None
    body: list[str] = []
    k = 0
    while k < len(lines):
        sess, page_i, line = lines[k]
        head = BILL_HEAD.match(line)
        if head:
            if cur:
                cur.actions = _actions(body)
                entries.append(cur)
            title = head.group(3)
            while ")" not in title and k + 1 < len(lines) and len(title) < 400:
                k += 1
                title += " " + lines[k][2]
            # "SB 66 Alcoholic Beverage ... (Michael G. Waddoups) This act modifies ...": the description
            # after the sponsor is body text.
            close = title.find(")", title.find("("))
            if close >= 0 and title[close + 1 :].strip():
                body_start = title[close + 1 :].strip()
                title = title[: close + 1]
            else:
                body_start = ""
            cur = DigestEntry(
                digest_year,
                sess,
                f"{head.group(1)} {int(head.group(2))}",
                title.strip(),
                page_i,
                veto_override=page_i in override_pages,
            )
            body = [body_start] if body_start else []
        elif cur is not None:
            eff = EFFECTIVE_LINE.match(line)
            chap = CHAPTER_LINE.match(line)
            if eff and not cur.effective_text:
                cur.effective_text = line
                cur.effective = datetime.strptime(eff.group(1), "%B %d, %Y").date()
                cur.chapter = int(eff.group(2)) if eff.group(2) else None
            elif chap and not cur.effective_text:
                cur.effective_text = line
                cur.chapter = int(chap.group(1))
                stated = BODY_EFFECTIVE.search(" ".join(body))
                cur.effective = datetime.strptime(stated.group(1), "%B %d, %Y").date() if stated else None
            elif not cur.effective_text:
                body.append(line)
        k += 1
    if cur:
        cur.actions = _actions(body)
        entries.append(cur)
    return entries


def _unglue(lines: list[tuple[str, int, str]]) -> list[tuple[str, int, str]]:
    out: list[tuple[str, int, str]] = []
    carry = ""
    for sess, page_i, line in lines:
        if carry:
            line, carry = f"{carry} {line}", ""
        g = GLUED_HEAD.match(line)
        if g:
            out.append((sess, page_i, g.group(1)))
            carry = g.group(2)
            continue
        out.append((sess, page_i, line))
    if carry:
        out.append((lines[-1][0], lines[-1][1], carry))
    return out


# ---------------------------------------------------------------- passed-bill indexes


BILL_CELL = re.compile(r"^(?:HB|SB|HJR|SJR|HCR|SCR|HR|SR)\d+")


def parse_passed_bills(raw: str) -> list[dict]:
    out = []
    for row in re.findall(r"<TR>(.*?)</TR>", raw, re.S | re.I):
        cells = [
            html.unescape(re.sub(r"<[^>]+>", "", c)).replace("\xa0", " ").strip()
            for c in re.findall(r"<TD[^>]*>(.*?)</TD>", row, re.S | re.I)
        ]
        if len(cells) < 8 or not BILL_CELL.match(cells[0]):
            continue
        chapter = cells[7].strip()
        out.append(
            {
                "bill": bill_key(cells[0]),
                "bill_version": cells[0],
                "title": cells[1],
                "effective": cells[4],
                "governor_action": cells[5],
                "chapter": int(chapter) if chapter.isdigit() else None,
            }
        )
    return out


# ---------------------------------------------------------------- enrolled bills

LINENO = re.compile(
    r"<!-- WP Paired Style On: lineno -->.*?<!-- WP Style End: lineno -->\s*(\d*)\s*"
    r"<!-- WP Paired Style Off: lineno -->.*?<!-- WP Style End: lineno -->",
    re.S,
)
DEL_OPEN, DEL_CLOSE, INS_OPEN, INS_CLOSE, LINE_MARK = "\x01", "\x02", "\x03", "\x04", "\x05"


def marked_text(raw: str) -> str:
    """Bill body as text with deletion (\\x01..\\x02) and insertion (\\x03..\\x04) markers and printed line
    numbers as \\x05<n>\\x06."""
    start = raw.find("Be it enacted by the Legislature")
    end = raw.find("[Bill Documents]", start if start >= 0 else 0)
    body = raw[start if start >= 0 else 0 : end if end > 0 else len(raw)]
    body = LINENO.sub(lambda m: f"\n{LINE_MARK}{m.group(1)}\x06", body)
    body = re.sub(r"<center>\s*-\s*\d+\s*-\s*</center>", " ", body, flags=re.I)
    body = re.sub(r"<!--.*?-->", "", body, flags=re.S)
    body = re.sub(r"<strike>", DEL_OPEN, body, flags=re.I)
    body = re.sub(r"</strike>", DEL_CLOSE, body, flags=re.I)
    body = re.sub(r"<u>", INS_OPEN, body, flags=re.I)
    body = re.sub(r"</u>", INS_CLOSE, body, flags=re.I)
    body = re.sub(r"<br\s*/?>", "\n", body, flags=re.I)
    body = re.sub(r"<[^>]+>", " ", body)
    body = html.unescape(body).replace("\xa0", " ")
    # The brackets around a deletion belong to the deletion.
    body = re.sub(r"\[(\s*)" + DEL_OPEN, DEL_OPEN, body)
    body = re.sub(DEL_CLOSE + r"(\s*)\]", DEL_CLOSE, body)
    return body


def _strip_marks(t: str) -> str:
    return re.sub(LINE_MARK + r"\d*\x06", " ", t)


def before_text(t: str) -> str:
    """The law as it read before the bill: insertions dropped, deletions kept."""
    t = re.sub(INS_OPEN + ".*?" + INS_CLOSE, " ", t, flags=re.S)
    return _strip_marks(t.replace(DEL_OPEN, "").replace(DEL_CLOSE, ""))


def after_text(t: str) -> str:
    """The law as the bill made it: deletions dropped, insertions kept."""
    t = re.sub(DEL_OPEN + ".*?" + DEL_CLOSE, " ", t, flags=re.S)
    return _strip_marks(t.replace(INS_OPEN, "").replace(INS_CLOSE, ""))


@dataclass
class BillSection:
    number: int
    header: str
    first_line: str  # printed bill line number where the bill section starts
    code_section: str | None
    action: str | None
    version_note: str
    text: str  # marked text after the header

    @property
    def before(self) -> str:
        return before_text(self.text)

    @property
    def after(self) -> str:
        return after_text(self.text)


CODE_HEADER = re.compile(
    rf"^Section\s+({SECTION_ID})(?:\s*\(([^)]*)\))?\s*(?:,\s*which is renumbered from Section\s+{SECTION_ID}"
    rf"(?:\s*\([^)]*\))?\s*,?)?\s*is\s+(amended|enacted|renumbered and amended|repealed and reenacted|repealed)"
    rf"(?:\s+to read)?\s*:?",
    re.S,
)


def bill_sections(raw: str) -> list[BillSection]:
    """Split an enrolled bill into its numbered sections (Section 1., Section 2., ...)."""
    text = marked_text(raw)
    starts = []
    expected = 1
    for m in re.finditer(r"(?:^|\n)[ \t]*Section (\d+)\.\s", text):
        if int(m.group(1)) == expected:
            starts.append((expected, m.start(), m.end()))
            expected += 1
    out = []
    for idx, (n, s, e) in enumerate(starts):
        chunk_end = starts[idx + 1][1] if idx + 1 < len(starts) else len(text)
        chunk = text[e:chunk_end]
        before = text[max(0, s - 40) : s + 1]
        line = re.findall(LINE_MARK + r"(\d+)\x06", before)
        flat = re.sub(r"\s+", " ", _strip_marks(chunk.replace(INS_OPEN, "").replace(INS_CLOSE, ""))).strip()
        m = CODE_HEADER.match(flat)
        if m:
            # Locate the end of the header ("to read:") in the marked chunk.
            hm = re.search(r"to\s+read\s*:|is\s+repealed\.?", chunk)
            body = chunk[hm.end() :] if hm else chunk
            out.append(
                BillSection(
                    n,
                    flat[: m.end()],
                    line[-1] if line else "",
                    m.group(1),
                    m.group(3),
                    m.group(2) or "",
                    body,
                )
            )
        else:
            out.append(BillSection(n, flat[:160], line[-1] if line else "", None, None, "", chunk))
    return out


def special_clauses(sections: list[BillSection]) -> dict[str, list[str]]:
    """Effective-date, coordination and revisor clauses, as plain text."""
    out: dict[str, list[str]] = defaultdict(list)
    for s in sections:
        if s.code_section:
            continue
        plain = re.sub(r"\s+", " ", after_text(s.text)).strip()
        head = s.header.lower()
        if head.startswith("effective date"):
            out["effective_date"].append(plain)
        elif "coordinat" in head:
            out["coordination"].append(plain)
        elif "revisor" in head:
            out["revisor"].append(plain)
    return out


def section_effective(clauses: list[str], section: str, default: date | None) -> tuple[date | None, str]:
    """Effective date of one section's amendment under the bill's effective-date clause.

    Returns (date, basis). A clause naming the section is read for the date that applies to it; any
    phrasing not recognized here leaves the date unresolved rather than guessed.
    """
    if not clauses:
        return default, "digest_effective_date (no effective-date clause; general effective date)"
    text = " ".join(clauses)
    general = re.search(r"(?:this bill|this act) takes effect on (\w+ \d{1,2}, \d{4})", text, re.I)
    if _names_whole_section(text, section):
        m = re.search(
            rf"(?:amendments? to|enactment of)? ?Sections? [^.]*?{re.escape(section)}[^.]*? takes? effect on (\w+ \d{{1,2}}, \d{{4}})",
            text,
        )
        if m:
            return datetime.strptime(m.group(1), "%B %d, %Y").date(), "effective_date_clause (section named)"
        # A list under a dated lead-in: "the amendments in this bill to the following take effect on
        # July 1, 2009: (i) Section 32A-5-101 ; ..." (the nearest lead-in before the section, none between).
        pos = text.find(section)
        leads = list(re.finditer(r"take effect on (\w+ \d{1,2}, \d{4}):", text[:pos]))
        if leads and "." not in text[leads[-1].end() : pos].replace("Sections", "").replace("Section", ""):
            when = datetime.strptime(leads[-1].group(1), "%B %d, %Y").date()
            return when, "effective_date_clause (section listed under a dated lead-in)"
        return None, "unresolved: effective-date clause names this section in an unrecognized form"
    if general:
        return datetime.strptime(general.group(1), "%B %d, %Y").date(), "effective_date_clause"
    if re.search(r"immediate effective date|takes effect upon approval", text, re.I):
        return default, "digest_effective_date (immediate effect)"
    return default, "digest_effective_date (clause did not state a general date)"


def _names_whole_section(text: str, section: str) -> bool:
    """True when the clause names the section itself, not only some of its subsections."""
    return any(
        not re.search(r"Subsections?\s*$", text[max(0, m.start() - 13) : m.start()])
        for m in re.finditer(re.escape(section), text)
    )


def delayed_subsections(clauses: list[str], section: str) -> tuple[date, str] | None:
    """2009 S.B. 187: "the amendments in this bill to the following take effect on July 1, 2009: ...
    (x) Subsections 32A-1-105 (12), (23), (35), and the existing (64) ...". Returns (date, subsections)."""
    text = " ".join(clauses)
    for m in re.finditer(rf"Subsections? {re.escape(section)}\s*([^;]*)", text):
        dates = list(re.finditer(r"take effect on (\w+ \d{1,2}, \d{4})", text[: m.start()]))
        if dates:
            return datetime.strptime(dates[-1].group(1), "%B %d, %Y").date(), m.group(1).strip()
    return None


def retrospective_to(clauses: list[str], section: str) -> date | None:
    """'The amendments in this bill have retrospective operation to July 1, 2011, except for ...'."""
    m = re.search(
        r"retrospective operation to (\w+ \d{1,2}, \d{4})(?:, except for the amendments to ([^.]*))?",
        " ".join(clauses),
    )
    if m and not (m.group(2) and section in m.group(2)):
        return datetime.strptime(m.group(1), "%B %d, %Y").date()
    return None


# ---------------------------------------------------------------- comparing statute texts


def body_words(text: str, section: str) -> list[str]:
    """Normalized words of a section's text: heading number and labels, history notes and navigation
    removed; whitespace, case, quotes and spacing before punctuation normalized. Nothing else changes."""
    t = uc._norm(text)
    t = re.sub(r"\s+([.,;:)])(?=\s|$)", r"\1", t)
    t = re.sub(r"\(\s+", "(", t)
    # Subsection labels: "(23) (b)" in a bill, "(23)(b)" in the code, and the code's table layout puts
    # "(1) (a)" where a bill prints "(1)(a)". Spacing only; no label or word is changed.
    t = re.sub(r"\)\s+\(", ")(", t)
    # Likewise "Section 32B-11-503 (5)" against "32B-11-503(5)".
    t = re.sub(r"(\d+[a-z]?-\d+[a-z]?-\d+(?:\.\d+)?)\s+\(", r"\1(", t)
    # Older bills set a space before a closing quote ('beverages "') and sometimes the period after it
    # ('sample".'); both are typesetting.
    t = re.sub(r'(\w)\s+"(?=[\s.,;:)]|$)', r'\1"', t)
    t = re.sub(r'"([.,;:])(?=\s|$)', r'\1"', t)
    sec = section.lower()
    i = t.find(sec)
    if i >= 0:
        t = t[i + len(sec) :]
        t = re.sub(r"^\s*\((?:effective|superseded|repealed)[^)]*\)", "", t)
        t = re.sub(r"^\s*\.", "", t)
    t = re.split(
        r"\b(?:enacted|amended|renumbered and amended|repealed and reenacted|repealed) by chapter \d+", t
    )[0]
    t = re.split(r"<< previous section|next section \(", t)[0]
    return t.split()


def text_sha(words: list[str]) -> str:
    return hashlib.sha256(" ".join(words).encode("utf-8")).hexdigest()


def diff_summary(a: list[str], b: list[str], limit: int = 6) -> str:
    out = []
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
        if tag == "equal":
            continue
        out.append(f"{tag} [{' '.join(a[i1:i2])[:80]}] -> [{' '.join(b[j1:j2])[:80]}]")
        if len(out) >= limit:
            out.append("...")
            break
    return "; ".join(out)


def merge3(base: list[str], versions: list[list[str]]) -> tuple[list[str] | None, str]:
    """Apply every version's edits (relative to base) to base. Overlapping, differing edits conflict."""
    edits: list[tuple[int, int, tuple[str, ...]]] = []
    for v in versions:
        for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, base, v, autojunk=False).get_opcodes():
            if tag != "equal":
                edits.append((i1, i2, tuple(v[j1:j2])))
    edits = sorted(set(edits))
    for i, (a1, a2, _) in enumerate(edits):
        for b1, b2, _ in edits[i + 1 :]:
            # Intersecting ranges, or two edits starting at the same word (an insertion there has no
            # defined order relative to the other edit).
            if b1 < a2 or b1 == a1:
                return None, f"conflicting edits at words {a1}-{a2} and {b1}-{b2}"
    out, pos = [], 0
    for i1, i2, rep in edits:
        out.extend(base[pos:i1])
        out.extend(rep)
        pos = i2
    out.extend(base[pos:])
    return out, f"merged {len(edits)} non-overlapping edits from {len(versions)} bills"


LABEL_TOKEN = re.compile(r"^(?:\((?:\d+|[a-z]{1,2}|[ivxlc]+)\))+([,;.:]?)$")


def neutral_labels(words: list[str]) -> list[str]:
    """Words with subsection-label tokens ("(23)", "(23)(b),") replaced by "(#)". Two bills that each
    insert a definition renumber the same labels differently; the code database renumbers once. Used
    only to compare a merge with the Legislature's own merged print, never as operative text."""
    return [LABEL_TOKEN.sub(r"(#)\1", w) if LABEL_TOKEN.match(w) else w for w in words]


def definition_units(words: list[str]) -> dict[str, tuple[str, ...]]:
    """Split a section into units keyed by the term a subsection defines ('(#) "package" means ...'),
    in order. Consecutive subsections about the same term stay together; text before the first
    definition is keyed ''. A section without definitions is a single unit."""
    units: list[tuple[str, list[str]]] = [("", [])]
    seen: dict[str, int] = {}
    for i, w in enumerate(words):
        if (
            (w.startswith("(#)") or LABEL_TOKEN.match(w))
            and i + 1 < len(words)
            and words[i + 1].startswith('"')
        ):
            term_words = []
            for t in words[i + 1 : i + 8]:
                term_words.append(t)
                if t.rstrip(",.;:").endswith('"') and (len(term_words) > 1 or len(t.rstrip(",.;:")) > 1):
                    break
            term = " ".join(term_words).strip('",.;: ')
            if term != units[-1][0].split("#")[0]:
                seen[term] = seen.get(term, 0) + 1
                units.append((term if seen[term] == 1 else f"{term}#{seen[term]}", []))
        units[-1][1].append(w)
    return {k: tuple(v) for k, v in units if v or k}


def merge_units(
    base: dict[str, tuple[str, ...]], versions: list[dict[str, tuple[str, ...]]]
) -> tuple[dict[str, tuple[str, ...]] | None, str]:
    """Merge definition by definition: a unit changed by one bill takes that bill's text; a unit changed
    identically by several takes it once; a unit changed differently by several is merged word by word,
    and a conflict there fails the whole merge."""
    keys = list(base)
    for v in versions:
        keys += [k for k in v if k not in keys]
    out: dict[str, tuple[str, ...]] = {}
    changed_units = 0
    for k in keys:
        b = base.get(k)
        variants = {v.get(k) for v in versions} - {b}
        if not variants:
            val = b
        elif len(variants) == 1:
            val = variants.pop()
            changed_units += 1
        else:
            if None in variants:
                return None, f"definition {k!r} deleted by one bill and changed by another"
            merged, msg = merge3(list(b or ()), [list(x) for x in variants])
            if merged is None:
                return None, f"definition {k!r}: {msg}"
            val = tuple(merged)
            changed_units += 1
        if val is not None:
            out[k] = val
    return out, f"merged definition by definition ({changed_units} definitions changed)"


# ---------------------------------------------------------------- an enrolled bill's own affected-sections list

AFFECTED_ACTIONS = (
    "RENUMBERS AND AMENDS",
    "REPEALS AND REENACTS",
    "AMENDS",
    "ENACTS",
    "REPEALS",
    "RENUMBERS",
)


def sections_affected(raw: str) -> list[tuple[str, str, str, str]]:
    """(action, section, note, history) from the bill's 'Utah Code Sections Affected' list, e.g.
    ('AMENDS', '32B-1-102', '', 'as last amended by Laws of Utah 2011, Chapters 307 and 334')."""
    i = raw.find("Utah Code Sections Affected")
    if i < 0:
        i = raw.find("This act affects sections of Utah Code Annotated")
    if i < 0:
        return []
    j = raw.find("Be it enacted", i)
    seg = LINENO.sub("\n", raw[i : j if j > 0 else len(raw)])
    seg = re.sub(r"<!--.*?-->", "", seg, flags=re.S)
    seg = re.sub(r"<br\s*/?>", "\n", seg, flags=re.I)
    seg = html.unescape(re.sub(r"<[^>]+>", " ", seg)).replace("\xa0", " ")
    out: list[list[str]] = []
    action = None
    for line in seg.split("\n"):
        s = re.sub(r"\s+", " ", line).strip()
        if not s or s.startswith(("Utah Code Sections Affected", "This act affects sections")):
            continue
        head = re.match(r"^(" + "|".join(AFFECTED_ACTIONS) + r"):", s)
        if head:
            action = head.group(1)
            continue
        if action is None:
            continue
        m = re.match(rf"^({SECTION_ID})(?:\s*\(([^)]*)\))?\s*,?\s*(.*)$", s)
        if m:
            out.append([action, m.group(1), m.group(2) or "", m.group(3).strip()])
        elif out and out[-1][0] == action:
            out[-1][3] = (out[-1][3] + " " + s).strip()
    return [tuple(x) for x in out]


def history_chapters(history: str) -> set[tuple[int, str, int]]:
    """'as last amended by Laws of Utah 2011, Chapters 307 and 334' -> {(2011, 'GS', 307), (2011, 'GS', 334)}.
    Special sessions: 'Laws of Utah 2011, Second Special Session, Chapter 2' -> {(2011, 'S2', 2)}."""
    out = set()
    for m in re.finditer(
        r"Laws of Utah (\d{4}),(?: (\w+) Special Session,)? Chapters? ([\d, and]+)", history, re.I
    ):
        kind = f"S{ORDINALS[m.group(2).title()]}" if m.group(2) else "GS"
        for ch in re.findall(r"\d+", m.group(3)):
            out.add((int(m.group(1)), kind, int(ch)))
    # Before about 2010: "as last amended by Chapters 30 and 66, Laws of Utah 1992[, Second Special Session]".
    for m in re.finditer(
        r"Chapters? ([\d, and]+?),? Laws of Utah (\d{4})(?:, (\w+) Special Session)?", history, re.I
    ):
        kind = f"S{ORDINALS[m.group(3).title()]}" if m.group(3) else "GS"
        for ch in re.findall(r"\d+", m.group(1)):
            out.add((int(m.group(2)), kind, int(ch)))
    return out


def law_key(session: str, chapter: int) -> tuple[int, str, int]:
    return (int(session[:4]), session[4:], int(chapter))


# ---------------------------------------------------------------- loading pinned records


def _pinned_path(asset: dict, pins: dict[str, dict], raw_dir: Path) -> Path | None:
    pin = pins.get(asset["asset_id"])
    if not pin:
        return None
    from alcohol_data.config import _url_basename, safe_filename

    name = asset.get("filename") or safe_filename(_url_basename(asset.get("url")) or asset["asset_id"])
    p = raw_dir / asset["asset_id"] / f"{pin['sha256'][:16]}-{name}"
    return p if p.is_file() else None


@dataclass
class Records:
    digests: dict[int, tuple[str, list[DigestEntry]]]  # year -> (asset_id, entries)
    indexes: dict[str, tuple[str, list[dict]]]  # session -> (asset_id, rows)
    enrolled: dict[tuple[str, str], tuple[str, str]]  # (session, bill) -> (asset_id, raw html)
    missing: list[str]
    recodification_tables: dict[str, Path] = field(default_factory=dict)  # asset_id -> local PDF


def load_records(pins: dict[str, dict], raw_dir: Path | None = None) -> Records:
    import yaml

    raw_dir = raw_dir or paths.RAW_DIR
    doc = yaml.safe_load(SOURCE_YAML.read_text(encoding="utf-8"))
    rec = Records({}, {}, {}, [])
    for a in doc["assets"]:
        series = a.get("source_series")
        if series not in (
            "utah_digest_of_legislation",
            "utah_passed_bills",
            "utah_enrolled_bills",
            "utah_recodification_table",
        ):
            continue
        p = _pinned_path(a, pins, raw_dir)
        if p is None:
            rec.missing.append(a["asset_id"])
            continue
        opts = a.get("options") or {}
        if series == "utah_recodification_table":
            if a["asset_id"] == "ut_2010_title32a_recod_table":
                rec.recodification_tables[a["asset_id"]] = p
            continue
        if series == "utah_digest_of_legislation":
            year = int(opts["digest_year"])
            rec.digests[year] = (a["asset_id"], parse_digest(digest_pages(p), year))
        elif series == "utah_passed_bills":
            raw = p.read_text(encoding="utf-8", errors="replace")
            rec.indexes[opts["session"]] = (a["asset_id"], parse_passed_bills(raw))
        else:
            raw = p.read_text(encoding="utf-8", errors="replace")
            rec.enrolled[(opts["session"], bill_key(opts["bill"]))] = (a["asset_id"], raw)
    return rec


# ---------------------------------------------------------------- inventory


def _relevant(section: str) -> bool:
    return section.startswith(("32B-", "32A-", "59-15-"))


def _bill_sort(b: str) -> tuple[str, int]:
    kind, num = b.split()
    return (kind, int(num))


def inventory(rec: Records, tracked: set[str] | None = None) -> tuple[list[dict], list[dict]]:
    """Session rows (completeness evidence) and enactment rows (every action on Title 32A/32B or chapter
    59-15 in the sessions, flagged when it touches a tracked section).

    A session is `complete_for_declared_dependencies` when its digest and its passed-bill index agree on the
    chaptered bills, or every chaptered bill missing from the digest had its affected-sections list read
    from the enrolled bill instead.
    """
    tracked = tracked or set(uc.CHECKS)
    entries = [(asset, e) for _, (asset, es) in sorted(rec.digests.items()) for e in es]
    digest_sessions = {e.session for _, e in entries}
    sessions, enactments = [], []
    for sess in SESSIONS:
        dig = {e.bill: (asset, e) for asset, e in entries if e.session == sess}
        idx_asset, idx_rows = rec.indexes.get(sess, ("", []))
        idx = {r["bill"]: r for r in idx_rows if r["chapter"]}
        # A digest entry counts as law when it gives a chapter, sits on the veto-override page, or the
        # index gives the chapter the digest left out (2008 S.B. 245 ends without its chapter line).
        dig_law = {b: ae for b, ae in dig.items() if ae[1].chapter or ae[1].veto_override or b in idx}
        without_chapter = sorted(
            (b for b, (_, e) in dig_law.items() if not e.chapter and not e.veto_override), key=_bill_sort
        )
        both = sorted(set(dig_law) & set(idx), key=_bill_sort)
        chapter_mismatch = [
            b for b in both if dig_law[b][1].chapter and dig_law[b][1].chapter != idx[b]["chapter"]
        ]
        digest_only = sorted(set(dig_law) - set(idx), key=_bill_sort)
        index_only = sorted(set(idx) - set(dig_law), key=_bill_sort)
        from_bill, unresolved = [], []
        lists: dict[str, tuple[str, list[tuple[str, str, str, str]]]] = {}
        for b, (asset, e) in dig_law.items():
            lists[b] = (f"{asset} page_index {e.page_index}", e.actions)
        for b in index_only:
            enr = rec.enrolled.get((sess, b))
            if enr:
                acts = [(a.title(), s, n, "") for a, s, n, _ in sections_affected(enr[1])]
                lists[b] = (f"{enr[0]} (Utah Code Sections Affected)", acts)
                from_bill.append(b)
            else:
                unresolved.append(b)
        touching = set()
        for b, (where, acts) in sorted(lists.items(), key=lambda kv: _bill_sort(kv[0])):
            chapter = idx[b]["chapter"] if b in idx else dig_law[b][1].chapter
            effective = dig_law[b][1].effective if b in dig_law else None
            title = dig_law[b][1].title if b in dig_law else idx[b]["title"]
            for action, section, note, to in acts:
                hit = section in tracked or to in tracked
                if not (_relevant(section) or _relevant(to or "")):
                    continue
                if (sess, b) == RECODIFICATION and not hit:
                    continue  # the recodification enacts all of Title 32B; only tracked rows are listed
                if hit:
                    touching.add(b)
                enactments.append(
                    {
                        "session": sess,
                        "bill": b,
                        "chapter": chapter or "",
                        "title": re.sub(r"\s*\([^)]*\)\s*$", "", title),
                        "bill_effective_digest": effective.isoformat() if effective else "",
                        "action": action.lower(),
                        "section": section,
                        "section_note": note,
                        "renumbered_to": to,
                        "tracked_section": "yes" if hit else "no",
                        "listed_in": where,
                    }
                )
        complete = sess in rec.indexes and sess in digest_sessions and not unresolved
        if not idx and not dig_law and sess in rec.indexes:
            complete = True  # no chaptered bills in either record (resolutions only)
        sessions.append(
            {
                "session": sess,
                "passed_bill_index": idx_asset,
                "index_chaptered_bills": len(idx),
                "digest_chaptered_bills": len(dig_law),
                "in_both": len(both),
                "chapter_mismatches": " ".join(chapter_mismatch),
                "digest_entries_without_chapter": " ".join(without_chapter),
                "digest_only": " ".join(digest_only),
                "index_only": " ".join(index_only),
                "index_only_read_from_enrolled_bill": " ".join(from_bill),
                "unresolved_bills": " ".join(unresolved),
                "bills_touching_tracked_sections": " ".join(sorted(touching, key=_bill_sort)),
                "coverage": "complete_for_declared_dependencies" if complete else "partial",
            }
        )
    return sessions, enactments


# ---------------------------------------------------------------- reconstruction


@dataclass
class Amendment:
    session: str
    bill: str
    chapter: int
    action: str  # enacted | amended | renumbered and amended | repealed and reenacted | repealed
    asset_id: str
    effective: date | None
    effective_basis: str
    retrospective_to: date | None
    history: str  # the bill's own "as last amended by ..." for this section
    section: BillSection | None  # None for a repeal: the bill only lists the section
    delayed: date | None = None  # some subsections take effect on this later date
    delayed_parts: str = ""

    @property
    def label(self) -> str:
        return f"{self.session} {self.bill} (ch. {self.chapter})"


@dataclass
class State:
    section: str
    in_force_from: date | None
    until: date | None  # exclusive
    words: list[str] | None
    amendments: list[Amendment]  # the bills whose change starts this state
    basis: str
    base_checks: list[str] = field(default_factory=list)
    chain_checks: list[str] = field(default_factory=list)
    verified_against: str = ""
    verification: str = "no independent text"
    temporal_status: str = "reconstructed"
    notes: list[str] = field(default_factory=list)
    # Definition-level merge (subsection numbers set aside) awaiting an official print to compare with.
    pending: dict[str, tuple[str, ...]] | None = None
    # Check results when the exact text is not determined but the checks are (split effective dates).
    check_override: dict[str, str] | None = None
    session_last: bool = True  # last state of its session: the next session's bills print its text
    repealed: bool = False
    never_operative: bool = False  # replaced on the day it would have taken effect
    conflict: bool = False  # several bills' edits to the same words could not be merged
    flagged: bool = False  # its session's before-text or history checks failed
    components: list[list[str]] = field(default_factory=list)  # session-start text and each bill's text
    session_final: State | None = None

    @property
    def state_id(self) -> str:
        start = self.in_force_from.strftime("%Y%m%d") if self.in_force_from else "unknown"
        tail = "_repealed" if self.repealed else ("_not_operative" if self.never_operative else "")
        return "ut_recon_" + re.sub(r"[^a-z0-9]+", "_", self.section.lower()) + "_" + start + tail

    def checks(self) -> dict[str, str]:
        if self.check_override is not None:
            return self.check_override
        return {} if self.words is None else _check_results(self.section, self.words)


_SECTIONS_CACHE: dict[str, list[BillSection]] = {}


def _bill_sections_cached(asset_id: str, raw: str) -> list[BillSection]:
    if asset_id not in _SECTIONS_CACHE:
        _SECTIONS_CACHE[asset_id] = bill_sections(raw)
    return _SECTIONS_CACHE[asset_id]


def amendments_for(section: str, rec: Records, enactments: list[dict]) -> list[Amendment]:
    out = []
    seen = set()
    for row in enactments:
        if row["section"] != section and row["renumbered_to"] != section:
            continue
        key = (row["session"], row["bill"])
        if key in seen:
            continue
        seen.add(key)
        enr = rec.enrolled.get(key)
        if enr is None:
            raise LookupError(f"{key[0]} {key[1]} changed {section}; its enrolled text is not pinned")
        asset_id, raw = enr
        secs = _bill_sections_cached(asset_id, raw)
        clauses = special_clauses(secs).get("effective_date", [])
        default = date.fromisoformat(row["bill_effective_digest"]) if row["bill_effective_digest"] else None
        eff, basis = section_effective(clauses, section, default)
        if default and eff and eff != default and "named" not in basis:
            basis += f"; DIGEST SAYS {default.isoformat()}"
        if row["action"] == "repeals":
            out.append(
                Amendment(
                    row["session"],
                    row["bill"],
                    int(row["chapter"]),
                    "repealed",
                    asset_id,
                    eff,
                    basis,
                    None,
                    "",
                    None,
                )
            )
            continue
        bs = next((s for s in secs if s.code_section == section), None)
        if bs is None:
            raise LookupError(f"{asset_id}: no bill section for {section}")
        history = next((h for _, s, _, h in sections_affected(raw) if s == section), "")
        a = Amendment(
            row["session"],
            row["bill"],
            int(row["chapter"]),
            bs.action or row["action"],
            asset_id,
            eff,
            basis,
            retrospective_to(clauses, section),
            history,
            bs,
        )
        split = delayed_subsections(clauses, section)
        if split:
            a.delayed, a.delayed_parts = split
            a.effective_basis += f"; subsections {split[1]} take effect {split[0].isoformat()}"
        out.append(a)
    return out


def _combine(base: list[str] | None, versions: list[list[str]]):
    """(words, message, pending) for base with every version's edits applied."""
    if not versions:
        return base, "", None
    if len(versions) == 1:
        return versions[0], "", None
    if base is None:
        return None, "no base text to merge against", None
    words, msg = merge3(base, versions)
    if words is not None:
        return words, msg, None
    # Typically both bills insert definitions and renumber the same subsections differently.
    pending, nmsg = merge_units(
        definition_units(neutral_labels(base)), [definition_units(neutral_labels(v)) for v in versions]
    )
    return None, f"{msg}; with subsection numbers set aside, {nmsg}", pending


def reconstruct(section: str, amendments: list[Amendment], baseline_words: list[str] | None) -> list[State]:
    """Operative states of one section, from the earliest bill that prints it up to its repeal or
    RECORDS_BEGIN.

    Bills of one session amend the text as it stood when the session began, whatever their effective
    dates; a state starts on each effective date within the session and combines every bill of the
    session in force that day.
    """
    for a in amendments:
        if a.effective is None:
            raise ValueError(f"{a.label}: effective date for {section} unresolved ({a.effective_basis})")
    repeals = [a for a in amendments if a.action == "repealed"]
    changes = [a for a in amendments if a.action != "repealed"]
    enacting = [a for a in changes if a.action == "enacted"]
    start = min((a.effective for a in enacting), default=None)

    def when(a: Amendment) -> date:
        return max(a.effective, start) if start else a.effective

    groups: dict[str, list[Amendment]] = defaultdict(list)
    for a in changes:
        groups[a.session].append(a)
    order = sorted(groups, key=lambda s: (min(when(a) for a in groups[s]), s))
    states: list[State] = []
    current: list[str] | None = None
    prior: set[tuple[int, str, int]] = set()
    if not enacting and changes:
        # Already in force: the first bill's "before" text is the law it changed, from an unknown start.
        a0 = min(groups[order[0]], key=when)
        current = body_words(a0.section.before, section)
        prior = history_chapters(a0.history)
        states.append(
            State(
                section,
                None,
                when(a0),
                current,
                [],
                f"text before {a0.label}; in force from its last amendment ({a0.history}), date not yet traced",
                temporal_status="unresolved",
            )
        )
    for sess in order:
        group = groups[sess]
        ens = [a for a in group if a.action == "enacted"]
        ams = [a for a in group if a.action != "enacted"]
        base_checks: list[str] = []
        chain: list[str] = []
        if ens:
            base = body_words(ens[0].section.after, section)
            prefix = f"enacted by {ens[0].label}"
            prior = {law_key(ens[0].session, ens[0].chapter)}
        else:
            base, prefix = current, ""
        if base is None and ams:
            # The prior state could not be merged word by word (see State.pending); these bills print the
            # law they amend, which is the Legislature's own text of that state.
            befores = [body_words(a.section.before, section) for a in ams]
            if all(b == befores[0] for b in befores):
                base = befores[0]
                base_checks.append(f"prior state's text read from {ams[0].label}'s text before amendment")
        for a in ams:
            before = body_words(a.section.before, section)
            if before == base:
                base_checks.append(f"{a.label} text before amendment matches the prior state")
            elif base is not None and _check_results(section, before) == _check_results(section, base):
                # Recorded, as at the 2014 boundary; e.g. 2004 S.B. 58 struck "o]r", leaving a bare "r"
                # that the code database never carried.
                base_checks.append(
                    f"{a.label} text before amendment differs from the prior state, no check result changes "
                    f"({diff_summary(base, before)})"
                )
            else:
                base_checks.append(
                    f"{a.label} text before amendment DIFFERS FROM the prior state"
                    + ("" if base is None else f" ({diff_summary(base, before)})")
                )
            ok = history_chapters(a.history) == prior
            chain.append(
                f"{a.label}: '{a.history}' {'matches' if ok else 'DOES NOT MATCH'} the prior chapters"
            )
        flagged = any("DIFFERS" in c for c in base_checks) or any("DOES NOT MATCH" in c for c in chain)
        dates = sorted(
            {when(a) for a in group} | {a.delayed for a in ams if a.delayed and a.delayed > when(a)}
        )
        session_states = []
        for i, d in enumerate(dates):
            new = [a for a in group if when(a) == d] + [a for a in ams if a.delayed == d]
            in_force = [a for a in ams if when(a) <= d]
            partial = [a for a in in_force if a.delayed and a.delayed > d]
            full = [a for a in in_force if a not in partial]
            words, msg, pending = _combine(base, [body_words(a.section.after, section) for a in full])
            override = None
            notes = []
            if partial:
                every, _, _ = _combine(base, [body_words(a.section.after, section) for a in in_force])
                notes.append(
                    "split effective date: "
                    + "; ".join(
                        f"{a.label} subsections {a.delayed_parts} wait until {a.delayed}" for a in partial
                    )
                )
                if words is not None and every is not None:
                    without, with_all = _check_results(section, words), _check_results(section, every)
                    if without == with_all:
                        override = without
                        notes.append(
                            "every check gives the same result with and without the delayed subsections"
                        )
                words, pending = None, None
            labels = ", ".join(a.label for a in in_force)
            how = "; ".join(
                x
                for x in (prefix, f"amended by {labels}" + (f": {msg}" if msg else "") if in_force else "")
                if x
            )
            st = State(
                section,
                d,
                None,
                words,
                new,
                how,
                base_checks if i == 0 else [],
                chain if i == 0 else [],
                session_last=False,
            )
            st.pending, st.check_override, st.notes = pending, override, notes
            st.components = [
                w for w in [base] + [body_words(a.section.after, section) for a in in_force] if w
            ]
            if flagged or (words is None and pending is None and override is None):
                st.temporal_status = "unresolved"
            st.flagged = flagged
            st.conflict = words is None and pending is None and not partial and len(full) > 1
            for a in ams:
                if a.retrospective_to and a.retrospective_to < d and a in new:
                    st.notes.append(
                        f"{a.label} took effect {d.isoformat()} with retrospective operation to "
                        f"{a.retrospective_to.isoformat()}"
                    )
            session_states.append(st)
        if session_states:
            session_states[-1].session_last = True
            for st in session_states:
                st.session_final = session_states[-1]
            states.extend(session_states)
            current = session_states[-1].words
        prior = {law_key(a.session, a.chapter) for a in ams} or prior
    # Close the windows and verify each session's last state against the next independent official text.
    operative = [s for s in states if s.in_force_from]
    for s, nxt in zip(operative, operative[1:], strict=False):
        s.until = nxt.in_force_from
        # e.g. 2010 ch. 276's wording of a section that 2011 ch. 307 amended before 2011-07-01: archived,
        # never law in force.
        s.never_operative = s.until == s.in_force_from
    for k, s in enumerate(operative):
        if not s.session_last:
            continue
        nxt = next((x for x in operative[k + 1 :]), None)
        if nxt is not None:
            befores = [
                (a.asset_id, body_words(a.section.before, section))
                for a in nxt.amendments
                if a.action != "enacted" and a.section is not None and a.delayed != nxt.in_force_from
            ]
            _verify(s, befores)
            if s.words is None and s.conflict and not s.flagged and befores:
                _adopt_print(s, befores)
    # Days when some, not all, of a conflicting session's bills were in force: the check results are known
    # only if every text that could be in force reads the same.
    for s in operative:
        if s.words is None and s.check_override is None and s.conflict and s.session_final is not s:
            final = s.session_final.words if s.session_final else None
            texts = s.components + ([final] if final else [])
            results = [_check_results(section, w) for w in texts]
            if final and all(r == results[0] for r in results):
                s.check_override = results[0]
                s.temporal_status = "reconstructed"
                s.notes.append(
                    "the bills' edits conflict and no print shows these days' text; every check gives the same "
                    "result in the session-start text, each bill's text and the next print"
                )
    end = min((a.effective for a in repeals), default=None)
    if operative:
        last = operative[-1]
        last.until = end or uc.RECORDS_BEGIN
        if end is None and baseline_words is not None:
            _verify(last, [("historical code 2014-01-01 version", baseline_words)])
    if end is not None:
        r = min(repeals, key=lambda a: a.effective)
        states.append(
            State(
                section,
                end,
                None,
                None,
                [r],
                f"repealed by {r.label} ({r.effective_basis})",
                verification="",
                temporal_status="anchored",
                repealed=True,
            )
        )
    return states


def _adopt_print(s: State, texts: list[tuple[str, list[str]]]) -> None:
    """Bills that change the same words differently, with no coordination clause: the Legislature's next
    print of the section is the only record of how they were combined. Adopted as the text, never as
    reconciled, and only when every print agrees."""
    if not all(w == texts[0][1] for _, w in texts):
        s.verification = "the bills' edits conflict and the next prints disagree"
        return
    s.words = texts[0][1]
    s.basis += (
        f"; the bills' edits conflict and have no coordination clause; text as printed in {texts[0][0]}"
    )
    s.verified_against = " | ".join(t[0] for t in texts)
    s.verification = "adopted from the next print (no independent merge)"
    s.temporal_status = "reconstructed"


def _verify(s: State, texts: list[tuple[str, list[str]]]) -> None:
    if s.words is None and s.pending is not None:
        # A merge that only differs in numbering: adopt the Legislature's printed text of this state when
        # every independent print agrees with it and, numbering aside, with the merge of the bills' edits.
        printed = definition_units(neutral_labels(texts[0][1])) if texts else None
        if texts and all(w == texts[0][1] for _, w in texts) and printed == s.pending:
            s.words = texts[0][1]
            s.basis += f"; operative text as printed in {texts[0][0]} (text before its amendment)"
            s.verified_against = " | ".join(t[0] for t in texts)
            order = "same order" if list(printed) == list(s.pending) else "definitions re-sorted in the print"
            s.verification = f"every definition identical apart from subsection numbering ({order})"
            if s.temporal_status != "unresolved":
                s.temporal_status = "reconciled"
        else:
            s.temporal_status = "unresolved"
            s.verification = (
                "merge differs from the official print" if texts else "merge without an official print"
            )
            if texts and printed is not None:
                diff = [k for k in set(printed) | set(s.pending) if printed.get(k) != s.pending.get(k)]
                s.verification += f" (definitions: {', '.join(sorted(diff))[:300]})"
        return
    if not texts or s.words is None:
        return
    s.verified_against = " | ".join(t[0] for t in texts)
    diffs = [f"{asset}: {diff_summary(s.words, w)}" for asset, w in texts if w != s.words]
    if diffs:
        # A wording difference the checks do not see (e.g. a codification correction) leaves the state
        # reconstructed; one that changes any check result leaves it unresolved.
        same = all(_check_results(s.section, w) == s.checks() for _, w in texts)
        s.verification = ("differs; every check result identical: " if same else "differs: ") + " || ".join(
            diffs
        )
        s.temporal_status = "reconstructed" if same and s.temporal_status != "unresolved" else "unresolved"
    else:
        s.verification = "identical"
        if s.temporal_status != "unresolved":
            s.temporal_status = "reconciled"


def _check_results(section: str, words: list[str]) -> dict[str, str]:
    text = " ".join(words)
    return {name: fn(text) for name, fn in uc.CHECKS[section].items()}


def baseline_words(section: str, versions: list[uc.Version]) -> list[str] | None:
    v = next((v for v in versions if v.section == section and v.baseline), None)
    return body_words(v.text, section) if v else None


# For a section no inventoried bill printed, the first day its archived code page can stand for: the 2003
# general effective date. Every session from 2002 S4 on is inventoried, and the page's own history note
# shows any later amendment from an earlier session (none for the sections it is used for).
CAPTURE_TEXT_FROM = date(2003, 5, 5)


def reconstruct_all(
    rec: Records, enactments: list[dict], versions: list[uc.Version], captures: list | None = None
) -> dict[str, list[State]]:
    """Every section with checks: the Historical Code sections and their Title 32A predecessors.

    Archived code pages (legal/utah_archived_code.py), when given, are compared with the state in force
    on their capture date, and supply the text of a section that no inventoried bill printed.
    """
    out = {}
    for section in uc.CHECKS:
        states = reconstruct(
            section, amendments_for(section, rec, enactments), baseline_words(section, versions)
        )
        mine = [c for c in captures or [] if c.section == section]
        if mine:
            states = apply_captures(section, states, mine)
        out[section] = states
    return out


def apply_captures(section: str, states: list[State], captures: list) -> list[State]:
    operative = [
        s for s in states if s.in_force_from and s.until and not s.never_operative and not s.repealed
    ]
    if operative:
        for c in captures:
            st = next((s for s in operative if s.in_force_from <= c.captured < s.until), None)
            if st is not None:
                _verify_capture(st, c.asset_id, c.captured, body_words(c.text, section))
        return states
    # No inventoried bill printed this section: its text comes from the code pages alone.
    texts = [body_words(c.text, section) for c in captures]
    repeal = next((s for s in states if s.repealed), None)
    end = repeal.in_force_from if repeal else max(c.captured for c in captures)
    if not all(t == texts[0] for t in texts):
        note = "archived code pages disagree: " + diff_summary(
            texts[0], next(t for t in texts if t != texts[0])
        )
        st = State(section, CAPTURE_TEXT_FROM, end, None, [], note, temporal_status="unresolved")
        return [st, *states]
    dates = ", ".join(sorted({c.captured.isoformat() for c in captures}))
    history = next((c.history for c in captures if c.history), "")
    st = State(
        section,
        CAPTURE_TEXT_FROM,
        end,
        texts[0],
        [],
        f"no bill in any inventoried session (2002 S4-2010 S2) amended it; text of the Legislature's code page "
        f"as captured by the Internet Archive on {dates} (identical); history note: {history}",
        verified_against=" | ".join(c.asset_id for c in captures),
        verification=f"{len(captures)} archived code pages identical",
        temporal_status="reconstructed",
    )
    st.notes.append(
        f"from {CAPTURE_TEXT_FROM.isoformat()}: the first day every session that could amend it is inventoried"
    )
    return [st, *states]


def _verify_capture(s: State, asset_id: str, captured: date, words: list[str]) -> None:
    """An archived code page is an official print of the state in force on its capture date."""
    label = f"code page captured {captured.isoformat()} ({asset_id})"
    s.verified_against = " | ".join(x for x in (s.verified_against, asset_id) if x)
    if s.words is None:
        if s.check_override is not None and _check_results(s.section, words) != s.check_override:
            s.temporal_status = "unresolved"
            s.verification += f"; {label}: check results differ"
        return
    if words == s.words:
        result = f"identical to the {label}"
        if s.temporal_status == "reconstructed" and not s.flagged:
            s.temporal_status = "reconciled"
    elif _check_results(s.section, words) == s.checks():
        result = f"differs from the {label}, no check result changes ({diff_summary(s.words, words)})"
    else:
        result = f"DIFFERS from the {label} ({diff_summary(s.words, words)})"
        s.temporal_status = "unresolved"
    s.verification = (
        result if s.verification in ("", "no independent text") else f"{s.verification}; {result}"
    )


def earlier_states(states: dict[str, list[State]]) -> list[uc.EarlierState]:
    """States with a known window and known check results, for the claim ledger."""
    return [
        uc.EarlierState(s.section, s.in_force_from, s.until, s.state_id, s.checks(), s.temporal_status)
        for sts in states.values()
        for s in sts
        if s.in_force_from
        and s.until
        and not s.repealed
        and not s.never_operative
        and (s.words is not None or s.check_override)
    ]


# ---------------------------------------------------------------- writing


def state_rows(states: dict[str, list[State]]) -> list[dict]:
    rows = []
    for section, sts in states.items():
        for s in sts:
            rows.append(
                {
                    "section": section,
                    "state_id": s.state_id,
                    "in_force_from": s.in_force_from.isoformat() if s.in_force_from else "",
                    "in_force_until_exclusive": s.until.isoformat() if s.until else "",
                    "temporal_status": s.temporal_status,
                    "operative": "repealed" if s.repealed else ("never" if s.never_operative else "yes"),
                    "basis": s.basis,
                    "bills": "; ".join(a.label for a in s.amendments),
                    "assets": "|".join(a.asset_id for a in s.amendments),
                    "bill_lines": "; ".join(
                        f"{a.asset_id} line {a.section.first_line}"
                        if a.section
                        else f"{a.asset_id} (repealer)"
                        for a in s.amendments
                    ),
                    "effective_basis": "; ".join(f"{a.bill}: {a.effective_basis}" for a in s.amendments),
                    "base_checks": "; ".join(s.base_checks),
                    "chain_checks": "; ".join(s.chain_checks),
                    "verified_against": s.verified_against,
                    "verification": s.verification,
                    "text_sha256": text_sha(s.words) if s.words else "",
                    "words": len(s.words) if s.words else 0,
                    "notes": "; ".join(s.notes),
                    **{f"check_{k}": v for k, v in sorted(s.checks().items())},
                }
            )
    return rows


def _write(path: Path, rows: list[dict], first: list[str]) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    cols = first + sorted({k for r in rows for k in r} - set(first))
    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols, lineterminator="\n", restval="")
        w.writeheader()
        w.writerows(rows)
    return path


def write_outputs(sessions: list[dict], enactments: list[dict], states: dict[str, list[State]]) -> list[Path]:
    return [
        _write(INVENTORY_CSV, sessions, list(sessions[0]) if sessions else []),
        _write(ENACTMENTS_CSV, enactments, list(enactments[0]) if enactments else []),
        _write(
            STATES_CSV,
            state_rows(states),
            [
                "section",
                "state_id",
                "in_force_from",
                "in_force_until_exclusive",
                "operative",
                "temporal_status",
                "basis",
            ],
        ),
    ]
