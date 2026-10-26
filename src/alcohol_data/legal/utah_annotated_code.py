"""Historical Utah Code Annotated volumes (University of Utah digital collection), imported by hand.

The 1992 Title 59 volume (asset uca_1992_title59_ch15_21) prints section 59-15-101 with its history and
amendment notes. Its text is compared with the text that 2003 S.B. 66 replaced. The comparison is recorded;
it grants no days by itself. The sessions between 1992 and 2002 S4 are not inventoried, and two equal texts
at either end do not show that nothing changed in between.
"""

from __future__ import annotations

import logging
import re
from pathlib import Path

ASSET_ID = "uca_1992_title59_ch15_21"


def section_59_15_101(pdf_path: Path) -> tuple[str, str] | None:
    """(statute text, history note) of 59-15-101 in the 1992 volume, from its text layer."""
    import pypdf

    logging.getLogger("pypdf").setLevel(logging.ERROR)
    text = " ".join((p.extract_text() or "") for p in pypdf.PdfReader(str(pdf_path)).pages)
    text = text.replace("\xad", "").replace("‑", "-")
    m = re.search(
        r"(\(1\) A tax is imposed at the rate of .*?)History:(.*?)(?:Amendment Notes|COLLATERAL)", text, re.S
    )
    if not m:
        return None
    return re.sub(r"\s+", " ", m.group(1)).strip(), re.sub(r"\s+", " ", m.group(2)).strip()


def annotate(states: dict, pdf_path: Path) -> None:
    """Record, on the 59-15-101 state that 2003 S.B. 66 replaced (start unknown), whether the 1992
    volume prints the same text. The state keeps its unknown start: no days are verified from this."""
    from alcohol_data.legal.utah_session_laws import body_words, diff_summary

    found = section_59_15_101(pdf_path)
    target = next((s for s in states.get("59-15-101", []) if s.in_force_from is None and s.words), None)
    if not found or target is None:
        return
    text, history = found
    vol = body_words(text, "59-15-101")
    mine = target.words[target.words.index("(1)") :] if "(1)" in target.words else target.words
    label = f"Utah Code Annotated 1992 ({ASSET_ID}; history: {history})"
    result = f"identical to {label}" if vol == mine else f"differs from {label}: {diff_summary(mine, vol)}"
    target.verified_against = " | ".join(x for x in (target.verified_against, ASSET_ID) if x)
    target.verification = (
        result if target.verification == "no independent text" else f"{target.verification}; {result}"
    )
    target.notes.append(
        "start still unknown: the 1992 amendments took effect 1992-04-27 (the volume's amendment notes), but "
        "the sessions from 1993 to 2002 S3 are not inventoried"
    )
