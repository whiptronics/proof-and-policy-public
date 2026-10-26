"""Human review packet and source catalog for the Utah legal history.

`alcohol-data legal review-packet-utah` writes:

* docs/review/utah-policy-review-packet.md: one section per Utah policy interval. It gives the question
  and value, the dates and why, the verified days and the law texts behind them, the evidence with
  document hashes and locators, the dependencies and exceptions, the fiscal years affected, the change
  from the previous release, and an empty checklist for the reviewer.
* docs/sources/utah-historical-source-catalog.md: every Utah legal source the project pins, with its URL,
  hash and status.

Both are generated from committed files (and the built database for fiscal-year exposure). Nothing here
records a review: a maintainer marks intervals reviewed in data/curated/policy_events.csv.
"""

from __future__ import annotations

import csv
import io
import zipfile
from pathlib import Path

from alcohol_data import paths
from alcohol_data.legal import utah_code as uc
from alcohol_data.legal import utah_session_laws as sl

PACKET_MD = paths.DOCS_DIR / "review" / "utah-policy-review-packet.md"
CATALOG_MD = paths.DOCS_DIR / "sources" / "utah-historical-source-catalog.md"
UTAH_SOURCES = (
    "utah_code_history",
    "utah_session_laws",
    "utah_archived_code_pages",
    "utah_legislature",
    "utah_code_annotated_historical",
)


def _csv(path: Path) -> list[dict]:
    with open(path, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def _md(text: str) -> str:
    return (text or "").replace("|", "\\|").replace("\n", " ")


def _known(e: dict) -> str:
    """The days an interval claims to know (as transforms.policy.known_window reads them)."""
    start = e["known_in_effect_from"] or e["effective_start"] or "unknown"
    if e["known_in_effect_through"]:
        end = f"{e['known_in_effect_through']} (inclusive)"
    elif e["effective_end"]:
        end = f"{e['effective_end']} (exclusive)"
    else:
        end = "open"
    return f"{start} to {end}"


def _prior_events(prior: Path | None) -> tuple[str, dict[str, dict]] | None:
    """Policy intervals in a previous release (its csv.zip), keyed by policy_id."""
    if prior is None:
        return None
    z = prior / "csv.zip"
    if not z.is_file():
        return None
    with zipfile.ZipFile(z) as zf:
        name = next((n for n in zf.namelist() if n.endswith("/policy_events.csv")), None)
        if name is None:
            return None
        rows = list(csv.DictReader(io.TextIOWrapper(zf.open(name), encoding="utf-8")))
    return prior.name, {r["policy_id"]: r for r in rows}


def _exposure(policy_id: str) -> tuple[list[int], list[int]] | None:
    """(fully covered fiscal years, partly covered fiscal years) from the built database."""
    if not paths.DATABASE_PATH.is_file():
        return None
    import duckdb

    con = duckdb.connect(str(paths.DATABASE_PATH), read_only=True)
    try:
        rows = con.execute(
            "SELECT year, covered_days, days_in_period FROM policy_exposure "
            "WHERE period_kind = 'state_fiscal_year' AND list_contains(string_split(policy_ids, '|'), ?) "
            "AND covered_days > 0 ORDER BY year",
            [policy_id],
        ).fetchall()
    except duckdb.Error:
        return None
    finally:
        con.close()
    full = [y for y, c, n in rows if c == n]
    part = [y for y, c, n in rows if c < n]
    return full, part


def _years(ys: list[int]) -> str:
    if not ys:
        return "none"
    runs, start, prev = [], ys[0], ys[0]
    for y in ys[1:]:
        if y != prev + 1:
            runs.append((start, prev))
            start = y
        prev = y
    runs.append((start, prev))
    return ", ".join(f"FY{a}" if a == b else f"FY{a}-FY{b}" for a, b in runs)


def _sections_of(claims: list[str]) -> list[str]:
    out: list[str] = []
    for c in claims:
        for reqs in [uc.CLAIMS.get(c, [])] + ([uc.CLAIMS_32A[c]] if c in uc.CLAIMS_32A else []):
            for section, *_ in reqs:
                if section not in out:
                    out.append(section)
    return out


def review_packet(prior: Path | None = None) -> Path:
    from alcohol_data.acquisition.fetch import load_pins
    from alcohol_data.config import load_all_sources

    events = [e for e in _csv(paths.CURATED_DIR / "policy_events.csv") if e["geo_id"] == "state:49"]
    evidence = _csv(paths.CURATED_DIR / "policy_evidence.csv")
    deps = _csv(paths.CURATED_DIR / "utah" / "claim_dependencies.csv")
    excs = _csv(paths.CURATED_DIR / "utah" / "claim_exceptions.csv")
    claims = _csv(uc.CLAIMS_CSV)
    states = _csv(sl.STATES_CSV)
    versions = _csv(uc.VERSIONS_CSV)
    assets = {a.asset_id: a for s in load_all_sources().values() for a in s.assets}
    pins = load_pins(paths.BUILDS_DIR / "preview.pins.json")
    previous = _prior_events(prior)
    as_of = claims[0]["as_of_date"] if claims else ""

    out = [
        "# Utah policy intervals: review packet",
        "",
        f"Generated by `alcohol-data legal review-packet-utah`; history as of {as_of} (America/Denver). One "
        "section per Utah interval in `data/curated/policy_events.csv`. Every interval is "
        "`machine_assisted_review`: the checks and this packet are the project's reading, not a review. A "
        "maintainer who checks an interval records `reviewer` and `review_date` there (and `reviewed_by` on "
        "its evidence rows); validation rejects an AI or machine as reviewer.",
        "",
        "Method: docs/methods/legal-history.md. Gaps and draft record requests: docs/gaps/utah-missing-records.md.",
        "",
        "| Interval | Value | Known in effect | Temporal status | Legal review |",
        "|---|---|---|---|---|",
    ]
    for e in events:
        out.append(
            f"| `{e['policy_id']}` | {e['policy_value']} | {_known(e)} | {e['temporal_status']} | "
            f"{e['legal_review_status']} |"
        )
    out.append("")
    not_verified = [
        c
        for c in uc.CLAIMS_32A
        if not any(
            r["claim_id"] == c and r["verified_from"] and r["verified_from"] < "2011-07-01" for r in claims
        )
    ]
    if not_verified:
        out += [
            "**Not verified before 2011-07-01:** "
            + ", ".join(f"`{c}`" for c in not_verified)
            + ". The Title 32A texts they need are not in any pinned record (see the gaps document).",
            "",
        ]

    for e in events:
        pid = e["policy_id"]
        covering = uc.INTERVAL_CLAIMS.get(pid, [])
        out += [f"## `{pid}`", "", f"**{e['policy_dimension']} = {e['policy_value']}** ({e['beverage']})", ""]
        out += [f"{_md(e['value_detail'])}", ""]
        start = e["effective_start"] or "unknown"
        out += [
            f"- **Effective:** {start} ({e['effective_start_precision']}) to "
            f"{e['effective_end'] or 'open'} ({e['end_status']}); enacted {e['enactment_date'] or 'unknown'}.",
            f"- **Known in effect:** {_known(e)}.",
            f"- **Status:** extraction `{e['extraction_status']}`, temporal `{e['temporal_status']}`, legal review "
            f"`{e['legal_review_status']}`, claim `{e['claim_status']}`.",
            f"- **Why these dates:** {_md(e['notes'])}",
            "",
        ]
        runs = [r for r in claims if r["claim_id"] in covering and r["verified_from"]]
        if runs:
            out += [
                "**Verified days** (metadata/legal_history/utah_code_claims.csv)",
                "",
                "| Claim | From | Through | Days | Temporal status | Texts used |",
                "|---|---|---|---:|---|---|",
            ]
            for r in runs:
                texts = r["versions"].split("|")
                shown = ", ".join(texts[:4]) + (f" and {len(texts) - 4} more" if len(texts) > 4 else "")
                out.append(
                    f"| {r['claim_id']} | {r['verified_from']} | {r['verified_through']} | {r['days']} | "
                    f"{r['temporal_status']} | {_md(shown)} |"
                )
            out.append("")
        sections = _sections_of(covering)
        pre = [
            s for s in states if s["section"] in sections and s["operative"] == "yes" and s["in_force_from"]
        ]
        if pre:
            out += [
                "**Text before 2014, state by state** (metadata/legal_history/utah_reconstructed_versions.csv)",
                "",
                "| Section | In force | Status | Basis | Checked against |",
                "|---|---|---|---|---|",
            ]
            for s in pre:
                out.append(
                    f"| {s['section']} | {s['in_force_from']} to {s['in_force_until_exclusive']} | "
                    f"{s['temporal_status']} | {_md(s['basis'])[:220]} | {_md(s['verification'])[:160]} |"
                )
            out.append("")
        later = [v for v in versions if v["section"] in sections and v["status"] != "never_in_force"]
        if later:
            counts = {
                sec: sum(1 for v in later if v["section"] == sec) for sec in sections if sec in uc.SECTIONS
            }
            out += [
                "**From 2014:** Historical Code versions "
                + "; ".join(f"{sec}: {n}" for sec, n in counts.items())
                + " (metadata/legal_history/utah_code_versions.csv).",
                "",
            ]
        cdeps = [d for d in deps if d["claim_id"] in covering]
        if cdeps:
            out += ["**Dependencies** (data/curated/utah/claim_dependencies.csv)", ""]
            out += [
                f"- {d['provision']} ({d['role']}, {'indispensable' if d['indispensable'] == 'true' else 'corroborating'}): {_md(d['reasoning'])}"
                for d in cdeps
            ]
            out.append("")
        cexc = [x for x in excs if x["claim_id"] in covering or x["claim_id"] == pid]
        if cexc:
            out += ["**Exceptions examined** (data/curated/utah/claim_exceptions.csv)", ""]
            out += [
                f"- {x['provision']}: {_md(x['relevance_decision'])} (examined for {x['dates']})"
                for x in cexc
            ]
            out.append("")
        ev = [x for x in evidence if x["policy_id"] == pid]
        out += [
            "**Evidence**",
            "",
            "| Evidence | Document | Locator | Excerpt or paraphrase | Supports | Strength |",
            "|---|---|---|---|---|---|",
        ]
        for x in ev:
            a = assets.get(x["asset_id"])
            sha = (pins.get(x["asset_id"]) or {}).get("sha256", "")
            doc = f"`{x['asset_id']}`" + (f" [{_md(a.edition)}]({a.url})" if a and a.url else "")
            doc += f" sha256 {sha[:16]}" if sha else " (not pinned)"
            out.append(
                f"| {x['evidence_id']} | {doc} | {_md(x['locator'])} | {_md(x['excerpt_or_paraphrase'])} | "
                f"{x['supports']} | {x['evidence_strength']} |"
            )
        out.append("")
        expo = _exposure(pid)
        if expo is not None:
            full, part = expo
            out += [f"**Fiscal years affected:** fully {_years(full)}; partly {_years(part)}.", ""]
        if previous is not None:
            name, prev = previous
            p = prev.get(pid)
            if p is None:
                out += [f"**Change from {name}:** new interval.", ""]
            else:
                fields = [
                    "policy_value",
                    "effective_start",
                    "effective_end",
                    "known_in_effect_from",
                    "known_in_effect_through",
                ]
                changed = [
                    f"{k} {p.get(k) or '(blank)'} -> {e[k] or '(blank)'}"
                    for k in fields
                    if (p.get(k) or "") != (e[k] or "")
                ]
                out += [
                    f"**Change from {name}:** {'; '.join(changed) if changed else 'dates and value unchanged'}.",
                    "",
                ]
        out += [
            "**For the reviewer** (leave unticked unless done by a person)",
            "",
            "- [ ] Each excerpt read in the cited document at the locator",
            "- [ ] The question and channel stated above are what the value answers",
            "- [ ] Start and end dates follow from the effective-date provisions cited",
            "- [ ] Dependencies and exceptions are complete for this question",
            "",
        ]
    if previous is not None:
        name, prev = previous
        gone = [k for k in prev if k.startswith("ut_") and k not in {e["policy_id"] for e in events}]
        if gone:
            out += ["## Removed since " + name, "", *[f"- `{k}`" for k in gone], ""]
    PACKET_MD.parent.mkdir(parents=True, exist_ok=True)
    PACKET_MD.write_text("\n".join(out).rstrip() + "\n", encoding="utf-8", newline="\n")
    return PACKET_MD


def source_catalog() -> Path:
    from alcohol_data.acquisition.fetch import load_pins
    from alcohol_data.config import load_all_sources

    sources = load_all_sources()
    pins = load_pins(paths.BUILDS_DIR / "preview.pins.json")
    out = [
        "# Utah historical legal sources",
        "",
        "Generated by `alcohol-data legal review-packet-utah` from config/sources/*.yaml and the pinned hashes "
        "in config/builds/preview.pins.json. Every file is fetched by `alcohol-data fetch` unless marked "
        "manual, and parsed (or cited) by the legal-history code; see docs/methods/legal-history.md.",
        "",
    ]
    for sid in UTAH_SOURCES:
        s = sources.get(sid)
        if s is None:
            continue
        pinned = sum(1 for a in s.assets if a.asset_id in pins)
        out += [
            f"## {s.title}",
            "",
            f"`{sid}`: {s.publisher}. Rights: `{s.rights_status}`. {len(s.assets)} files, {pinned} pinned.",
            "",
            "| Asset | Edition | Kind | SHA-256 (first 16) | Retrieved (UTC) | Status |",
            "|---|---|---|---|---|---|",
        ]
        for a in s.assets:
            pin = pins.get(a.asset_id) or {}
            status = (
                "pinned" if pin else ("manual import owed" if a.method == "manual_import" else "not pinned")
            )
            link = f"[{_md(a.edition)}]({a.url})" if a.url else _md(a.edition)
            out.append(
                f"| `{a.asset_id}` | {link} | {a.source_series} | {pin.get('sha256', '')[:16]} | "
                f"{pin.get('retrieved_at', '')} | {status} |"
            )
        out.append("")
    CATALOG_MD.parent.mkdir(parents=True, exist_ok=True)
    CATALOG_MD.write_text("\n".join(out).rstrip() + "\n", encoding="utf-8", newline="\n")
    return CATALOG_MD


def write_all(prior: Path | None = None) -> list[Path]:
    return [review_packet(prior), source_catalog()]
