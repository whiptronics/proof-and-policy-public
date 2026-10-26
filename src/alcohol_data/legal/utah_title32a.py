"""Title 32A (before 2011-07-01) to Title 32B: the provision crosswalk.

Source: the Office of Legislative Research and General Counsel's summary table for 2010 S.B. 167, "Old
Title 32A -> New Title 32B" (pinned as ut_2010_title32a_recod_table). For every Title 32A section in effect
on 2009-07-01 it lists the Title 32B sections into which "a significant portion" of it was incorporated,
or that it was repealed. The table says it is "not a comprehensive analysis of the recodification": it is
a finding aid. A row here says where to look, never that the old and new texts mean the same thing; each
mapping stays `finding_aid_unreviewed` until the texts are compared.
"""

from __future__ import annotations

import csv
import re
from pathlib import Path

from alcohol_data.legal import utah_code as uc

ASSET_ID = "ut_2010_title32a_recod_table"
CROSSWALK_CSV = uc.LEDGER_DIR / "utah_title32a_crosswalk.csv"
OLD = r"32A-\d+[a-z]?-\d+(?:\.\d+)?"
NEW = r"32B-\d+[a-z]?-\d+(?:\.\d+)?"

# What each tracked section contributes to a claim (data/curated/utah/claim_dependencies.csv has the
# reasoning); copied onto the crosswalk rows that lead to it.
POLICY_CONCEPTS = {
    "32B-1-102": "definitions: wine is liquor; liquor excludes beer; off-premise beer retailer; beer strength",
    "32B-7-201": "affirmative authority: local license to sell beer for off-premise consumption",
    "32B-4-402": "general rule: sell only as the title authorizes",
    "32B-4-401": "corroborating: liquor enters the state only through the department",
    "32B-11-208": "corroborating: manufacturers sell liquor only to the department",
    "32B-11-608": "corroborating: industry representatives sell liquor only to the department",
    "32B-2-501": "retail arrangement: state stores staffed by state employees",
    "32B-2-601": "special channel: package agency contract authority",
    "32B-2-603": "special channel: host business considered for a package agency",
}

BOILERPLATE = (
    "Title 32A Cite Title 32B Cite",
    "(G) = General licensing",
    "* For more detailed information",
    "Prepared by the Office of Legislative Research",
    "SB 167, ALCOHOLIC BEVERAGE CONTROL ACT",
    "SUMMARY  TABLE",
    "SUMMARY TABLE",
    "effect July 1, 2011. The table",
    "summaries. Because some Title 32A",
    "incorporated. This is not a comprehensive",
)
ROW = re.compile(rf"^({OLD})(?: to ({OLD}))?\.\s*(.*)$")
TARGET = re.compile(rf"({NEW}|Chapter \d+[a-z]?, Part \d+|Chapter \d+[a-z]?)(\s*\(G\))?")


def parse_crosswalk(pages: list[str]) -> list[dict]:
    """One row per (Title 32A section, Title 32B destination), or one 'repealed' row."""
    rows: list[dict] = []
    cur: dict | None = None
    for page_index, page in enumerate(pages):
        for raw_line in page.split("\n"):
            line = raw_line.strip()
            if not line or line.startswith(BOILERPLATE) or re.match(r"^(CHAPTER|Part) \d", line):
                continue
            m = ROW.match(line)
            if m:
                cur = {
                    "old_section": m.group(1),
                    "old_section_to": m.group(2) or "",
                    "text": m.group(3),
                    "targets": [],
                    "comment": "",
                    "page_index": page_index,
                }
                rows.append(cur)
                _absorb(cur)
            elif cur is not None:
                if re.match(rf"^({NEW}|Chapter \d)", line) or not cur["targets"] and not _repealed(cur):
                    cur["text"] += " " + line
                    _absorb(cur)
                else:
                    cur["comment"] = (cur["comment"] + " " + line).strip()
    out = []
    sources: dict[str, set[str]] = {}
    for r in rows:
        for target, _ in r["targets"]:
            sources.setdefault(target, set()).add(r["old_section"])
    for r in rows:
        heading = r["heading"].strip(" .")
        base = {
            "old_title": "32A",
            "old_section": r["old_section"],
            "old_section_range_end": r["old_section_to"],
            "old_heading": heading,
            "new_title": "32B",
            "effective_date": "2011-07-01",
            "mapping_source_asset": ASSET_ID,
            "locator": f"pdf page_index {r['page_index']}",
            "comment": re.sub(r"^C\s+", "", r["comment"]).strip(),
            "mapping_review_status": "finding_aid_unreviewed",
        }
        if _repealed(r) or not r["targets"]:
            relation = "repealed" if _repealed(r) else "unresolved"
            out.append(
                {
                    **base,
                    "new_section": "",
                    "general_requirement": "",
                    "relation_type": relation,
                    "policy_concept": "",
                }
            )
            continue
        for target, general in r["targets"]:
            # The plan's vocabulary. None of these says the substance is unchanged.
            if len(r["targets"]) > 1:
                relation = "split"
            elif len(sources.get(target, ())) > 1:
                relation = "merged"
            else:
                relation = "renumbered"
            out.append(
                {
                    **base,
                    "new_section": target,
                    "general_requirement": "yes" if general else "",
                    "relation_type": relation,
                    "policy_concept": POLICY_CONCEPTS.get(target, ""),
                }
            )
    for i, r in enumerate(out, 1):
        r["mapping_id"] = f"ut32a_{i:04d}"
    return out


def _repealed(r: dict) -> bool:
    return bool(re.search(r"\b(Previously )?Repealed\b", r["text"]))


def _absorb(r: dict) -> None:
    """Split accumulated row text into heading, destination cites and comment."""
    text = r["text"]
    first = TARGET.search(text)
    rep = re.search(r"\b(Previously )?Repealed\b", text)
    cut = min([m.start() for m in (first, rep) if m] or [len(text)])
    r["heading"] = text[:cut]
    targets = []
    pos = cut
    while True:
        m = TARGET.match(text, pos)
        if not m:
            break
        targets.append((m.group(1), bool(m.group(2))))
        pos = m.end()
        while pos < len(text) and text[pos] == " ":
            pos += 1
    r["targets"] = targets
    rest = text[pos:].strip()
    if rest and not rep:
        r["comment"] = (rest + " " + r["comment"]).strip() if rest not in r["comment"] else r["comment"]
    elif rep:
        r["comment"] = text[rep.end() :].strip(" -") or r["comment"]


def predecessors(rows: list[dict], section: str) -> list[str]:
    """Title 32A sections the table maps into a Title 32B section."""
    return sorted({r["old_section"] for r in rows if r["new_section"] == section})


def write_crosswalk(rows: list[dict]) -> Path:
    cols = [
        "mapping_id",
        "old_title",
        "old_section",
        "old_section_range_end",
        "old_heading",
        "new_title",
        "new_section",
        "general_requirement",
        "relation_type",
        "policy_concept",
        "effective_date",
        "mapping_source_asset",
        "locator",
        "comment",
        "mapping_review_status",
    ]
    CROSSWALK_CSV.parent.mkdir(parents=True, exist_ok=True)
    with open(CROSSWALK_CSV, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols, lineterminator="\n")
        w.writeheader()
        w.writerows(rows)
    return CROSSWALK_CSV
