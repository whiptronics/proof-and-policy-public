"""The Legislature's Title 32A code pages, as captured by the Internet Archive (2008 and 2010).

Each page (le.utah.gov/~code/TITLE32A/htm/32A12_020200.htm) shows one section as the code database held it:
its text, its history note ("Renumbered and Amended by Chapter 23, 1990 General Session") and a "Last
revised" date. A capture is an official print of the section on the capture date. It serves two purposes:

* a check on the Title 32A text rebuilt from session laws: the state in force on the capture date must
  read the same;
* the only text available for sections no 2003-2010 bill printed (32A-12-202, 32A-3-104).
"""

from __future__ import annotations

import html
import re
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path

from alcohol_data import paths

SOURCE_YAML = paths.SOURCES_DIR / "utah_archived_code_pages.yaml"


@dataclass
class Capture:
    asset_id: str
    section: str
    captured: date
    text: str  # plain text of the section, heading to history note
    history: str
    last_revised: date | None


def parse_page(raw: str) -> tuple[str, str, date | None]:
    """(section text, history note, last revised) from one code page."""
    body = re.sub(r"<script.*?</script>", " ", raw, flags=re.S | re.I)
    body = re.sub(r"<!--.*?-->", " ", body, flags=re.S)
    text = html.unescape(re.sub(r"<[^>]+>", " ", body)).replace("\xa0", " ")
    text = re.sub(r"\s+", " ", text).strip()
    hist = re.search(
        r"((?:(?:Enacted|Amended|Renumbered and Amended|Repealed and Reenacted|Repealed) by Chapter \d+, \d{4} "
        r"[A-Za-z ]*?Session\s*)+)",
        text,
    )
    revised = re.search(r"Last revised: \w+, (\w+ \d{1,2}, \d{4})", text)
    start = text.find("Utah Code Section")
    head = text[start + len("Utah Code Section") :] if start >= 0 else text
    head = head.split("Download Code Section")[0]
    return (
        head.strip(),
        hist.group(1).strip() if hist else "",
        datetime.strptime(revised.group(1), "%B %d, %Y").date() if revised else None,
    )


def load_captures(pins: dict[str, dict], raw_dir: Path | None = None) -> list[Capture]:
    import yaml

    raw_dir = raw_dir or paths.RAW_DIR
    if not SOURCE_YAML.is_file():
        return []
    doc = yaml.safe_load(SOURCE_YAML.read_text(encoding="utf-8"))
    out = []
    for a in doc["assets"]:
        pin = pins.get(a["asset_id"])
        if not pin:
            continue
        p = raw_dir / a["asset_id"] / f"{pin['sha256'][:16]}-{a['filename']}"
        if not p.is_file():
            continue
        ts = re.search(r"/web/(\d{8})\d*id_/", pin.get("url") or a["url"])
        captured = datetime.strptime(ts.group(1), "%Y%m%d").date()
        section = a["options"]["section"]
        text, history, revised = parse_page(p.read_text(encoding="utf-8", errors="replace"))
        # The 2008 pages repeat the number: "32A-12-202 32A-12-202 . Unauthorized sale or supply."
        text = re.sub(rf"^{re.escape(section)}\s+(?={re.escape(section)})", "", text)
        out.append(Capture(a["asset_id"], section, captured, text, history, revised))
    return out
