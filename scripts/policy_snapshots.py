"""Build dated policy snapshots from batch specifications (data/curated/policy_baseline/*.yaml).

A batch names, for each jurisdiction and policy dimension, the official page that shows the status, the
exact phrase that supports it, and the citation. The pages are pinned like every other source, and each
snapshot's excerpt is cut from the pinned bytes. A phrase that is not found verbatim stops the run, so an
excerpt can never drift from its source.

    python scripts/policy_snapshots.py sync   # add the batches' pages to config/sources/state_alcohol_law.yaml
    alcohol-data fetch --only <asset> ...     # pin them (sync prints the command)
    python scripts/policy_snapshots.py rows   # write their rows into data/curated/policy_snapshots.csv

observed_on is the day the page was retrieved, in the build's as-of time zone (a current-law page shows
the law of the day it was read), unless the entry gives a currency date the source states itself.
"""

from __future__ import annotations

import csv
import html
import json
import logging
import re
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import yaml

ROOT = Path(__file__).resolve().parents[1]
BATCH_DIR = ROOT / "data" / "curated" / "policy_baseline"
SOURCE_CFG = ROOT / "config" / "sources" / "state_alcohol_law.yaml"
PINS = ROOT / "config" / "builds" / "preview.pins.json"
BUILD = ROOT / "config" / "builds" / "preview.yaml"
SNAPSHOTS = ROOT / "data" / "curated" / "policy_snapshots.csv"
RAW = ROOT / "data" / "raw"

SOURCE_HEADER = {
    "source_id": "state_alcohol_law",
    "publisher": "State legislatures and state alcohol beverage control agencies",
    "title": "Current state alcohol statutes, rules and agency license pages (nationwide policy baseline)",
    "landing_url": "https://www.ttb.gov/wine/state-alcohol-beverage-control-agencies",
    "citation": "Statutes, administrative rules and license pages of each state, as cited per snapshot "
    "(data/curated/policy_snapshots.csv).",
    "update_frequency": "Changes with each legislative session; pages are dated by retrieval",
    "source_family": "policy",
    "rights_status": "government_edict",
    "notes": "Pages cited by dated policy snapshots. Statutes and rules are government edicts; agency guidance "
    "pages are cited for facts with short excerpts and are not redistributed.",
    "host_min_interval_seconds": 3,
}
COLUMNS = [
    "snapshot_id",
    "geo_id",
    "policy_dimension",
    "policy_value",
    "value_detail",
    "observed_on",
    "observed_year",
    "observed_precision",
    "observed_basis",
    "asset_id",
    "citation",
    "locator",
    "excerpt",
    "evidence_strength",
    "support_basis",
    "extraction_status",
    "legal_review_status",
    "extracted_by",
    "extracted_on",
    "reviewed_by",
    "reviewed_on",
    "policy_id",
    "notes",
]


def load_batches() -> list[tuple[dict, dict]]:
    out = []
    for p in sorted(BATCH_DIR.glob("*.yaml")):
        b = yaml.safe_load(p.read_text(encoding="utf-8"))
        for e in b["entries"]:
            out.append((b, e))
    ids = [e["id"] for _, e in out]
    dupes = sorted({i for i in ids if ids.count(i) > 1})
    if dupes:
        sys.exit(f"duplicate snapshot ids: {dupes}")
    return out


def assets_from(batches) -> dict[str, dict]:
    assets: dict[str, dict] = {}
    for _, e in batches:
        a = e.get("asset")
        if isinstance(a, dict) and a.get("external"):
            continue  # an asset pinned by another source config; not written to state_alcohol_law.yaml
        if isinstance(a, dict):
            if a["asset_id"] in assets and assets[a["asset_id"]] != a:
                sys.exit(f"asset {a['asset_id']} defined twice with different fields")
            assets[a["asset_id"]] = a
    for _, e in batches:
        if isinstance(e["asset"], dict) and e["asset"].get("external"):
            continue
        aid = e["asset"]["asset_id"] if isinstance(e["asset"], dict) else e["asset"]
        if aid not in assets:
            sys.exit(f"{e['id']}: asset {aid} is not defined in any batch")
    return assets


def sync() -> None:
    batches = load_batches()
    assets = assets_from(batches)
    cfg = dict(SOURCE_HEADER)
    cfg["assets"] = []
    for aid in sorted(assets):
        a = assets[aid]
        entry = {
            "asset_id": aid,
            "url": a["url"],
            "edition": a["edition"],
            "source_series": "state_alcohol_law_pages",
            "source_vintage": "retrieved_2026",
            "format": a.get("format", "html"),
            "priority": 20,
            "redistribute_raw": bool(
                a.get("redistribute_raw", a.get("rights_status", "government_edict") == "government_edict")
            ),
            "rights_status": a.get("rights_status", "government_edict"),
        }
        for k in ("filename", "options", "notes"):
            if a.get(k):
                entry[k] = a[k]
        cfg["assets"].append(entry)
    SOURCE_CFG.write_text(
        "# Generated by scripts/policy_snapshots.py sync from data/curated/policy_baseline/*.yaml; edit the batches.\n"
        + yaml.safe_dump(cfg, sort_keys=False, allow_unicode=True, width=110),
        encoding="utf-8",
        newline="\n",
    )
    pins = json.loads(PINS.read_text(encoding="utf-8"))
    todo = [aid for aid in sorted(assets) if aid not in pins]
    print(f"wrote {SOURCE_CFG.relative_to(ROOT)} with {len(assets)} assets; {len(todo)} not yet pinned")
    if todo:
        print("alcohol-data fetch " + " ".join(f"--only {a}" for a in todo))


def page_text(path: Path) -> str:
    if path.suffix.lower() == ".pdf":
        import pypdf

        logging.getLogger("pypdf").setLevel(logging.ERROR)
        text = " ".join((p.extract_text() or "") for p in pypdf.PdfReader(str(path)).pages)
    else:
        data = path.read_bytes()
        try:
            raw = data.decode("utf-8")
        except UnicodeDecodeError:
            raw = data.decode("cp1252", errors="replace")  # some official sites still serve Windows-1252
        raw = re.sub(r"(?is)<(script|style|noscript)\b.*?</\1>", " ", raw)
        raw = re.sub(r"(?s)<!--.*?-->", " ", raw)
        raw = re.sub(r"(?i)<br\s*/?>|</(p|div|li|tr|h\d|td|th|section|article)>", "\n", raw)
        text = html.unescape(re.sub(r"<[^>]+>", " ", raw))
    return normalize(text)


def normalize(s: str) -> str:
    s = s.replace(" ", " ").replace("’", "'").replace("‘", "'")
    s = s.replace("“", '"').replace("”", '"').replace("–", "-").replace("—", "-")
    s = s.replace("­", "")
    return re.sub(r"\s+", " ", s).strip()


def excerpt_for(text: str, phrase: str, limit: int = 600) -> str | None:
    p = normalize(phrase)
    i = text.find(p)
    if i < 0:
        return None
    # Start at the sentence the phrase sits in, but never more than 150 characters before it: pages without
    # sentence punctuation (menus, numbered rules) would otherwise drag unrelated text into the excerpt.
    dot = text.rfind(". ", 0, i)
    start = dot + 2 if dot >= 0 and i - (dot + 2) <= 150 else i
    end_dot = text.find(". ", i + len(p))
    cap = i + len(p) + 300
    if end_dot >= 0 and end_dot + 1 <= cap:
        out = text[start : end_dot + 1].strip()
    elif cap >= len(text):
        out = text[start:].strip()
    else:
        # No sentence end within reach: stop at a word boundary and mark the cut, never mid-word.
        cut = text.rfind(" ", i + len(p), cap)
        out = text[start : cut if cut > 0 else cap].strip() + " …"
    if len(out) > limit:
        out = p
    return out


def section_region(text: str, after: str | None, before: str | None) -> tuple[str | None, str | None]:
    """The part of a page between two anchors (for codes that print several dated versions of a section).

    Returns (region, problem). `after` must be found; `before` is searched for after it and, when given, must
    be found too, so a version boundary can never be silently skipped.
    """
    a = 0
    if after:
        a = text.find(normalize(after))
        if a < 0:
            return None, f"anchor not found: {after!r}"
    b = len(text)
    if before:
        b = text.find(normalize(before), a + 1)
        if b < 0:
            return None, f"end anchor not found after {after!r}: {before!r}"
    return text[a:b], None


def pinned_file(aid: str, pin: dict) -> Path | None:
    d = RAW / aid
    if not d.is_dir():
        return None
    hits = [p for p in d.glob(f"{pin['sha256'][:16]}-*") if not p.name.endswith(".meta.json")]
    return hits[0] if hits else None


def rows() -> None:
    batches = load_batches()
    assets_from(batches)  # validates that every referenced asset is defined
    pins = json.loads(PINS.read_text(encoding="utf-8"))
    tz = ZoneInfo(yaml.safe_load(BUILD.read_text(encoding="utf-8"))["as_of_timezone"])
    texts: dict[str, str] = {}
    built, problems = [], []
    for b, e in batches:
        aid = e["asset"]["asset_id"] if isinstance(e["asset"], dict) else e["asset"]
        pin = pins.get(aid)
        if not pin:
            problems.append(f"{e['id']}: asset {aid} not pinned (run sync, then fetch)")
            continue
        path = pinned_file(aid, pin)
        if path is None:
            problems.append(f"{e['id']}: pinned bytes for {aid} not in data/raw")
            continue
        if aid not in texts:
            texts[aid] = page_text(path)
        finds = e["find"] if isinstance(e["find"], list) else [e["find"]]
        parts = []
        for f in finds:
            # A find is a phrase, or {text, after, before} to search only one dated version of a section.
            phrase, region = (f, texts[aid]) if isinstance(f, str) else (f["text"], None)
            if region is None:
                region, problem = section_region(texts[aid], f.get("after"), f.get("before"))
                if problem:
                    problems.append(f"{e['id']}: {problem} in {aid}")
                    parts = None
                    break
            ex = excerpt_for(region, phrase)
            if ex is None:
                problems.append(f"{e['id']}: phrase not found in {aid}: {phrase!r}")
                parts = None
                break
            if not any(normalize(phrase) in done for done in parts):  # already inside an earlier excerpt
                parts.append(ex)
        if parts is None:
            continue
        if e.get("observed_year") and not e.get("observed_on"):
            # The source states only a year (an annual code edition): no day is invented.
            observed, year, precision = "", str(e["observed_year"]), "year"
            basis = e.get("observed_basis", "currency_statement")
        elif e.get("observed_on"):
            observed, basis = e["observed_on"], e.get("observed_basis", "currency_statement")
            year, precision = observed[:4], "day"
        else:
            got = datetime.fromisoformat(pin["retrieved_at"].replace("Z", "+00:00")).astimezone(tz).date()
            observed, basis = got.isoformat(), "retrieval_date"
            year, precision = observed[:4], "day"
        support = e.get("support", "explicit_text")
        if support not in ("explicit_text", "no_outlet_restriction", "indirect"):
            problems.append(f"{e['id']}: unknown support {support!r}")
            continue
        built.append(
            {
                "snapshot_id": e["id"],
                "geo_id": e["geo_id"],
                "policy_dimension": e["dimension"],
                "policy_value": e["value"],
                "value_detail": e.get("detail", ""),
                "observed_on": observed,
                "observed_year": year,
                "observed_precision": precision,
                "observed_basis": basis,
                "asset_id": aid,
                "citation": e["citation"],
                "locator": e["locator"],
                "excerpt": " … ".join([x.removesuffix(" …") for x in parts[:-1]] + parts[-1:]),
                "evidence_strength": e["evidence_strength"],
                "support_basis": support,
                "extraction_status": "checked_against_original",
                "legal_review_status": "machine_assisted_review",
                "extracted_by": b.get("extracted_by", "Claude (AI assistant)"),
                "extracted_on": b["extracted_on"],
                "reviewed_by": "",
                "reviewed_on": "",
                "policy_id": e.get("policy_id", ""),
                "notes": e.get("notes", ""),
            }
        )
    if problems:
        print("\n".join(problems))
        sys.exit(f"{len(problems)} problems; nothing written")
    with open(SNAPSHOTS, encoding="utf-8", newline="") as f:
        existing = [r for r in csv.DictReader(f)]
    ours = {r["snapshot_id"] for r in built}
    keep = [r for r in existing if r["snapshot_id"] not in ours and not r["snapshot_id"].startswith("base_")]
    out = sorted(
        keep + built, key=lambda r: (r["geo_id"], r["policy_dimension"], r["observed_year"], r["snapshot_id"])
    )
    with open(SNAPSHOTS, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS, lineterminator="\n")
        w.writeheader()
        w.writerows(out)
    print(f"wrote {len(built)} baseline snapshots ({len(out)} in all) to {SNAPSHOTS.relative_to(ROOT)}")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "sync":
        sync()
    elif cmd == "rows":
        rows()
    else:
        sys.exit(__doc__)
