"""Section version ledger for states other than Utah: which text of a statute was in force on which days.

Utah has its own parser (legal/utah_code.py) because the Legislature publishes every historical version of
every section. Most states do not. Their history is rebuilt from session laws that reprint each amended
section with markup, plus the current code page. This module checks such a ledger mechanically:

* metadata/legal_history/state_section_versions.csv lists each version of a section: the days it was in
  force, the pinned asset and pages that carry its text, and how the text is read from them;
* metadata/legal_history/state_claim_checks.csv lists, for each interval in policy_events, the phrase each
  version must contain for the coded value to hold. Rows with role ``value`` must together cover every day
  of the interval, one version per section per day; rows with role ``anchor`` are independent cross-checks
  (another print of the same text, the code's history note) and do not count toward coverage.

Text bases:

* ``plain``: the pages are the version's own text (a code page, or an act that prints the section in full);
* ``markup_after``: an amending act's markup read as the text after the act (insertions kept, bracketed
  deletions dropped);
* ``markup_before``: the same markup read as the text before the act (insertions dropped, bracketed
  deletions restored). This is how a version that no longer exists anywhere is rebuilt.

Markup conventions are publisher-specific:

* ``ky_bold_italic_brackets``: the Kentucky Acts PDFs (insertions in bold italic, deletions struck through
  inside square brackets), read from the PDF's fonts;
* ``va_lis_html_italic_strike``: the Virginia Acts of Assembly chapters on the Legislative Information
  System (HTML; insertions in ``<i>``, deletions in ``<s>``).

A ``plain`` HTML page (a code page, or an archived copy of one) is read as its text with the tags removed.

Phrases are compared with all whitespace removed, because PDF text layers split words ("gasol ine").
"""

from __future__ import annotations

import csv
import logging
import re
from dataclasses import dataclass
from datetime import date, timedelta
from html.parser import HTMLParser
from pathlib import Path

from alcohol_data import paths

VERSIONS_CSV = paths.METADATA_DIR / "legal_history" / "state_section_versions.csv"
CHECKS_CSV = paths.METADATA_DIR / "legal_history" / "state_claim_checks.csv"
PDF_CONVENTIONS = {"ky_bold_italic_brackets"}
HTML_CONVENTIONS = {"va_lis_html_italic_strike"}
CONVENTIONS = PDF_CONVENTIONS | HTML_CONVENTIONS
BASES = {"plain", "markup_after", "markup_before"}


@dataclass(frozen=True)
class Version:
    version_id: str
    geo_id: str
    section: str
    in_force_from: date | None  # None only for cross-check prints; a 'value' version must have dates
    in_force_through: date | None  # None: still in force on the day the current text was read
    text_basis: str
    asset_id: str
    pages: str
    anchor_after: str
    anchor_before: str
    markup_convention: str
    notes: str

    def days(self, through_default: date) -> tuple[date, date]:
        return self.in_force_from, self.in_force_through or through_default


def squash(s: str) -> str:
    return re.sub(r"\s+", "", s)


def _page_range(spec: str) -> list[int]:
    a, _, b = spec.partition("-")
    return list(range(int(a) - 1, int(b or a)))


def _runs(path: Path, pages: list[int]) -> list[tuple[str, str]]:
    """(text, font name) runs from the given zero-based pages, in reading order."""
    import pypdf

    logging.getLogger("pypdf").setLevel(logging.ERROR)
    reader = pypdf.PdfReader(str(path))
    out: list[tuple[str, str]] = []
    for i in pages:
        page_runs: list[tuple[str, str]] = []

        def visit(text, _cm, _tm, font, _size, sink=page_runs):
            sink.append((text, str(font.get("/BaseFont", "")) if font else ""))

        reader.pages[i].extract_text(visitor_text=visit)
        out.extend(page_runs)
        out.append(("\n", ""))
    return out


class _HtmlMarkup(HTMLParser):
    """Text of an HTML page in two readings: before an act (insertions dropped) and after it (deletions
    dropped). With no markup tags in play both readings are the page's plain text."""

    BLOCK = {"p", "br", "div", "li", "tr", "td", "center", "h1", "h2", "h3", "h4", "h5", "h6", "table"}
    SKIP = {"script", "style", "head", "title"}

    def __init__(self, insert_tags: set[str], delete_tags: set[str]):
        super().__init__(convert_charrefs=True)
        self.insert_tags, self.delete_tags = insert_tags, delete_tags
        self.inserted = self.deleted = self.skipped = 0
        self.before: list[str] = []
        self.after: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self.skipped += 1
        elif tag in self.insert_tags:
            self.inserted += 1
        elif tag in self.delete_tags:
            self.deleted += 1
        if tag in self.BLOCK:
            self.before.append("\n")
            self.after.append("\n")

    def handle_endtag(self, tag):
        if tag in self.SKIP:
            self.skipped = max(0, self.skipped - 1)
        elif tag in self.insert_tags:
            self.inserted = max(0, self.inserted - 1)
        elif tag in self.delete_tags:
            self.deleted = max(0, self.deleted - 1)

    def handle_data(self, data):
        if self.skipped:
            return
        if not self.inserted:
            self.before.append(data)
        if not self.deleted:
            self.after.append(data)


def _decode(raw: bytes) -> str:
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        return raw.decode("cp1252", errors="replace")  # the Virginia chapter pages are Windows-1252


def html_texts(path: Path, convention: str | None = None) -> tuple[str, str]:
    """(text before the act, text after the act) of an HTML page; plain text twice without a convention."""
    if convention is None:
        parser = _HtmlMarkup(set(), set())
    elif convention == "va_lis_html_italic_strike":
        parser = _HtmlMarkup({"i"}, {"s", "strike"})
    else:
        raise ValueError(f"unknown HTML markup convention {convention!r}")
    parser.feed(_decode(path.read_bytes()))
    parser.close()
    return "".join(parser.before), "".join(parser.after)


def _is_html(path: Path) -> bool:
    head = path.read_bytes()[:2048].lower()
    return b"<html" in head or b"<!doctype html" in head


def markup_texts(path: Path, pages: list[int], convention: str) -> tuple[str, str]:
    """(text before the act, text after the act) from an amending act's marked-up pages."""
    if convention in HTML_CONVENTIONS:
        return html_texts(path, convention)
    if convention not in PDF_CONVENTIONS:
        raise ValueError(f"unknown markup convention {convention!r}")
    before, after, depth = [], [], 0
    for text, font in _runs(path, pages):
        inserted = "Bold" in font and "Italic" in font
        for ch in text:
            if ch == "[" and not inserted:
                depth += 1
                continue
            if ch == "]" and not inserted and depth:
                depth -= 1
                continue
            if inserted:
                after.append(ch)
            elif depth:
                before.append(ch)
            else:
                before.append(ch)
                after.append(ch)
    return "".join(before), "".join(after)


def plain_text(path: Path, pages: list[int] | None) -> str:
    if path.suffix.lower() != ".pdf":
        if _is_html(path):
            return html_texts(path)[1]
        return path.read_text(encoding="utf-8", errors="replace")
    import pypdf

    logging.getLogger("pypdf").setLevel(logging.ERROR)
    reader = pypdf.PdfReader(str(path))
    idx = pages if pages is not None else range(len(reader.pages))
    return "\n".join(reader.pages[i].extract_text() or "" for i in idx)


def region(text: str, after: str, before: str) -> str | None:
    """The squashed text between two anchors (both optional); None if an anchor given is not found."""
    s = squash(text)
    a = 0
    if after:
        a = s.find(squash(after))
        if a < 0:
            return None
    b = len(s)
    if before:
        b = s.find(squash(before), a + 1)
        if b < 0:
            return None
    return s[a:b]


def load_versions(path: Path = VERSIONS_CSV) -> dict[str, Version]:
    out = {}
    with open(path, encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            out[r["version_id"]] = Version(
                version_id=r["version_id"],
                geo_id=r["geo_id"],
                section=r["section"],
                in_force_from=date.fromisoformat(r["in_force_from"]) if r["in_force_from"] else None,
                in_force_through=date.fromisoformat(r["in_force_through"]) if r["in_force_through"] else None,
                text_basis=r["text_basis"],
                asset_id=r["asset_id"],
                pages=r["pages"],
                anchor_after=r["anchor_after"],
                anchor_before=r["anchor_before"],
                markup_convention=r["markup_convention"],
                notes=r["notes"],
            )
    return out


def load_checks(path: Path = CHECKS_CSV) -> list[dict]:
    with open(path, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def version_text(v: Version, asset_path: Path) -> str | None:
    """The squashed text of version v's section (between its anchors), or None if an anchor is missing."""
    pages = _page_range(v.pages) if v.pages else None
    if v.text_basis == "plain":
        text = plain_text(asset_path, pages)
    else:
        before, after = markup_texts(asset_path, pages or [], v.markup_convention)
        text = before if v.text_basis == "markup_before" else after
    return region(text, v.anchor_after, v.anchor_before)


def coverage_gaps(versions: list[Version], start: date, end: date, through_default: date) -> list[str]:
    """For each section, days in [start, end] not covered by exactly one of its versions (empty when covered)."""
    problems = []
    one_day = timedelta(days=1)
    by_section: dict[str, list[tuple[date, date]]] = {}
    for v in versions:
        by_section.setdefault(v.section, []).append(v.days(through_default))
    for section, spans in sorted(by_section.items()):
        spans.sort()
        for (_a1, b1), (a2, b2) in zip(spans, spans[1:], strict=False):
            if a2 <= b1:
                problems.append(f"{section}: versions overlap {a2} to {min(b1, b2)}")
        cursor = start
        for a, b in spans:
            if b < cursor:
                continue
            if a > cursor:
                problems.append(f"{section}: no version in force {cursor} to {a - one_day}")
            cursor = max(cursor, b + one_day)
            if cursor > end:
                break
        if cursor <= end:
            problems.append(f"{section}: no version in force {cursor} to {end}")
    return problems


def verify(
    asset_paths: dict[str, Path],
    through_default: date,
    events: dict[str, dict] | None = None,
    versions_csv: Path = VERSIONS_CSV,
    checks_csv: Path = CHECKS_CSV,
) -> tuple[list[dict], list[str]]:
    """Run every claim check; return (results, problems). Problems are anything that should stop a release."""
    versions = load_versions(versions_csv)
    checks = load_checks(checks_csv)
    texts: dict[str, str | None] = {}
    results, problems = [], []
    for v in versions.values():
        if v.text_basis not in BASES:
            problems.append(f"{v.version_id}: unknown text basis {v.text_basis}")
        if v.text_basis != "plain" and v.markup_convention not in CONVENTIONS:
            problems.append(f"{v.version_id}: markup basis needs a known convention")
    for c in checks:
        v = versions.get(c["version_id"])
        if v is None:
            problems.append(f"{c['policy_id']}: unknown version {c['version_id']}")
            continue
        if v.version_id not in texts:
            p = asset_paths.get(v.asset_id)
            texts[v.version_id] = version_text(v, p) if p else None
        text = texts[v.version_id]
        if text is None:
            found = False
            problems.append(f"{v.version_id}: asset {v.asset_id} missing or an anchor not found")
        else:
            found = squash(c["phrase"]) in text
            if not found:
                problems.append(f"{c['policy_id']} / {v.version_id}: phrase not found: {c['phrase'][:80]!r}")
        results.append({**c, "found": found})
    if events is not None:
        by_policy: dict[str, list[Version]] = {}
        for c in checks:
            # Only 'value' versions carry the claim day by day; 'anchor' rows are independent cross-checks.
            if c["version_id"] in versions and c.get("role", "value") == "value":
                if versions[c["version_id"]].in_force_from is None:
                    problems.append(f"{c['policy_id']}: value version {c['version_id']} has no in_force_from")
                    continue
                by_policy.setdefault(c["policy_id"], [])
                if versions[c["version_id"]] not in by_policy[c["policy_id"]]:
                    by_policy[c["policy_id"]].append(versions[c["version_id"]])
        for pid, vs in by_policy.items():
            ev = events.get(pid)
            if ev is None:
                problems.append(f"{pid}: checks name an interval that is not in policy_events")
                continue
            start = ev.get("effective_start") or ev.get("known_in_effect_from")
            end = ev.get("known_in_effect_through") or (
                ev["effective_end"] - timedelta(days=1) if ev.get("effective_end") else None
            )
            if start is None or end is None:
                problems.append(f"{pid}: interval has no verifiable window")
                continue
            for gap in coverage_gaps(vs, start, end, through_default):
                problems.append(f"{pid}: {gap}")
    return results, problems
