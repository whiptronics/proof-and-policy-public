"""Utah Code version history (le.utah.gov Historical Code) and the claims it verifies.

The Legislature's Historical Code tool lists every version of a section back to
January 1, 2014. Each version page states its own window, e.g. "(Effective
11/1/2019) ... (Superseded 5/12/2020)"; the oldest version carries only a
superseded date and is the text in force on 2014-01-01. A version whose stated
effective date is on or after its superseded date never took effect (e.g. a
2025 version scheduled for 2026-01-01 and replaced in a 2025 special session).

Workflow:
  1. ``alcohol-data legal discover-utah`` asks the tool for every version of the
     tracked sections and writes config/sources/utah_code_history.yaml (one pinned
     asset per version file). Review and commit it.
  2. ``alcohol-data fetch`` downloads and pins the version files.
  3. ``alcohol-data legal ledger-utah`` parses the pinned versions, checks each
     text condition below, and writes metadata/legal_history/utah_code_versions.csv
     and utah_code_claims.csv: the exact days on which each claim is verified.

Curated policy intervals (data/curated/policy_events.csv) cite the ledger;
tests/test_legal_history.py keeps them inside the verified windows.
"""

from __future__ import annotations

import csv
import html
import re
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path

import yaml

from alcohol_data import paths

HOST = "https://le.utah.gov"
HISTORICAL_ENDPOINT = f"{HOST}/UtahCode/historicalajax.jsp"
RECORDS_BEGIN = date(2014, 1, 1)
SOURCE_ID = "utah_code_history"
SOURCE_YAML = paths.SOURCES_DIR / "utah_code_history.yaml"
LEDGER_DIR = paths.METADATA_DIR / "legal_history"
VERSIONS_CSV = LEDGER_DIR / "utah_code_versions.csv"
CLAIMS_CSV = LEDGER_DIR / "utah_code_claims.csv"

# Section -> directory under /xcode/
SECTIONS: dict[str, str] = {
    "32B-1-102": "Title32B/Chapter1",
    "32B-4-401": "Title32B/Chapter4",
    "32B-4-402": "Title32B/Chapter4",
    "32B-11-208": "Title32B/Chapter11",
    "32B-11-608": "Title32B/Chapter11",
    "32B-7-201": "Title32B/Chapter7",
    "32B-2-501": "Title32B/Chapter2",
    "32B-2-601": "Title32B/Chapter2",
    "32B-2-603": "Title32B/Chapter2",
    "59-15-101": "Title59/Chapter15",
}


def file_stem(section: str) -> str:
    """32B-1-102 -> C32B-1-S102 (the Legislature's version-file prefix)."""
    head, last = section.rsplit("-", 1)
    return f"C{head}-S{last}"


def asset_id_for(version_file: str) -> str:
    stem = version_file.removesuffix(".html").removeprefix("C").lower()
    return "ut_code_hist_" + re.sub(r"[^a-z0-9]+", "_", stem)


# ---------------------------------------------------------------- text conditions


def _norm(text: str) -> str:
    t = text.replace("“", '"').replace("”", '"').replace("’", "'").replace("\xa0", " ")
    return re.sub(r"\s+", " ", t).strip().lower()


def _has(pattern: str) -> Callable[[str], str]:
    rx = re.compile(pattern, re.I)
    return lambda t: "yes" if rx.search(t) else "no"


def _beer_limit(t: str) -> str:
    m = re.search(
        r'"beer" means a product that:? \(i\) contains:? (?:\(a\) )?at least \.5% of alcohol by volume[,;]? '
        r"(?:but|and)? ?(?:\(b\) )?(?:not|no) more than (\d+(?:\.\d+)?)% (?:of )?alcohol by volume or (\d+(?:\.\d+)?)% by weight",
        t,
        re.I,
    )
    return f"{m.group(1)}abv/{m.group(2)}abw" if m else "not_found"


def _beer_tax(t: str) -> str:
    """The rate for beer imported or manufactured on or after July 1, 2003 (pre-2024 wording),
    or the schedule's rate before July 1, 2024 (2024 wording)."""
    m = re.search(
        r"\$(\d+\.\d{2}) per 31-gallon barrel for beer imported or manufactured:? \(a\) on or after july 1, 2003",
        t,
    )
    if m:
        return f"usd_{m.group(1)}_on_or_after_2003_07_01"
    m = re.search(
        r"\$(\d+\.\d{2}) per 31-gallon barrel for beer imported or manufactured before july 1, 2024", t
    )
    if m:
        return f"usd_{m.group(1)}_before_2024_07_01_then_schedule"
    return "not_found"


def _beer_tax_before_2003(t: str) -> str:
    """The rate for beer imported or manufactured before July 1, 2003, in the 2003-2019 wording."""
    m = re.search(
        r"\$(\d+(?:\.\d{2})?) per 31-gallon barrel for beer imported or manufactured:? \(a\) before july 1, 2003",
        t,
    )
    return f"usd_{float(m.group(1)):.2f}_before_2003_07_01" if m else "not_found"


def _beer_tax_flat(t: str) -> str:
    """A single rate for all beer, as before 2003 S.B. 66: "at the rate of $11 per 31-gallon barrel on all beer"."""
    m = re.search(r"at the rate of \$(\d+(?:\.\d{2})?) per 31-gallon barrel on all beer", t)
    return f"usd_{float(m.group(1)):.2f}_all_beer" if m else "not_found"


CHECKS: dict[str, dict[str, Callable[[str], str]]] = {
    "32B-1-102": {
        "wine_is_liquor": lambda t: (
            "yes"
            if ('"wine" is considered liquor' in t or re.search(r'"liquor" includes:? [^.]{0,60}\bwine\b', t))
            else "no"
        ),
        "liquor_excludes_beer": _has(r'"liquor" does not include beer'),
        "off_premise_beer_retailer_is_beer_retailer": _has(
            r'"off-premise beer retailer" means a beer retailer who is:? .{0,160}?engaged in the retail sale of beer'
        ),
        "beer_limit": _beer_limit,
    },
    "32B-4-401": {
        "liquor_enters_state_only_through_department": _has(
            r"liquor from an out-of-state location directly or indirectly into this state except to the extent "
            r"authorized by this title to:? (?:\([a-z0-9]+\) )?the department"
        ),
    },
    "32B-4-402": {
        "sale_only_as_authorized": _has(
            r"may not sell, offer for sale, or furnish,? an alcoholic product in any place, or at any day or time "
            r"other than as authorized by this title"
        ),
    },
    "32B-11-208": {
        "manufacturer_sells_liquor_only_to_department": _has(
            r"manufacturing licensee may not sell liquor within the state except to:? (?:\([a-z0-9]+\) )?the department"
        ),
    },
    "32B-11-608": {
        "supplier_sells_liquor_only_to_department": _has(
            r"may not sell liquor within the state except to:? (?:\([a-z0-9]+\) )?the department"
        ),
    },
    "32B-7-201": {
        "local_license_to_sell_beer_off_premise": _has(
            r"issue, suspend, and revoke a local license to sell beer at retail for off-premise consumption"
        ),
    },
    "32B-2-501": {
        "state_store_authority": _has(
            r"the commission may establish state stores .{0,160}?for the sale of liquor by employees of the state"
        ),
    },
    "32B-2-601": {
        "package_agency_contract_authority": _has(
            r"enter into a package agency agreement with a person to sell, offer for sale, or furnish liquor in "
            r"sealed containers from premises other than those owned or leased by the state"
        ),
    },
    "32B-2-603": {
        "package_agency_host_business_considered": _has(
            r"the type of establishment or business in which the package agency may be located"
        ),
    },
    "59-15-101": {
        "beer_tax_rate": _beer_tax,
        "beer_tax_rate_before_2003_07_01": _beer_tax_before_2003,
        "beer_tax_flat_rate": _beer_tax_flat,
        "schedule_2024_to_2027": _has(
            r"\$13\.35 per 31-gallon barrel for beer imported or manufactured on or after july 1, 2024, and before "
            r"july 1, 2025.{0,40}\$13\.60 per 31-gallon barrel for beer imported or manufactured on or after july 1, "
            r"2025, and before july 1, 2026.{0,40}\$13\.85 per 31-gallon barrel for beer imported or manufactured on "
            r"or after july 1, 2026, and before july 1, 2027"
        ),
    },
}

# ---------------------------------------------------------------- Title 32A (before 2011-07-01)
# Predecessors of the tracked sections, from the recodification table
# (metadata/legal_history/utah_title32a_crosswalk.csv). Their text comes only from the 2003-2009 bills that
# amended them (legal/utah_session_laws.py). Checks are written from that text: wording differs from
# Title 32B (e.g. '"wine" is considered "liquor"'), so they are separate functions with the same names.


def _beer_limit_32a(t: str) -> str:
    """Upper limit in the Title 32A beer definition. The lower bound changed (63/100 of 1% to .5% in
    2009); the ceiling is what the policy value records."""
    m = re.search(
        r'"beer" means (?:all products|any product|a product) that:? (?:\(i\) )?contains?:? .{0,160}?'
        r"but not more than (\d+(?:\.\d+)?)% of alcohol by volume or (\d+(?:\.\d+)?)% by weight",
        t,
    )
    return f"{m.group(1)}abv/{m.group(2)}abw" if m else "not_found"


CHECKS_32A: dict[str, dict[str, Callable[[str], str]]] = {
    "32A-1-105": {
        "wine_is_liquor": _has(r'"wine" is considered "?liquor"? for (?:the )?purposes of this title'),
        "liquor_excludes_beer": _has(r'"liquor" does not include (?:any |a )?beverage defined as a beer'),
        "beer_limit": _beer_limit_32a,
    },
    "32A-10-101": {
        # 2003: "licenses to food stores and other establishments"; 2007: "licenses to businesses".
        "local_license_to_sell_beer_off_premise": _has(
            r"issue, suspend,? and revoke licenses to [a-z ,]{0,60}? to sell beer at retail for off-premise consumption"
        ),
    },
    "32A-12-201": {
        "liquor_enters_state_only_through_department": _has(
            r"liquor from an out-of-state location directly or indirectly into this state except to the extent "
            r"authorized by this title to:? (?:\([a-z0-9]+\) )?the department"
        ),
    },
    "32A-8-106": {
        "manufacturer_sells_liquor_only_to_department": _has(
            r"licensee may not sell any liquor within the state except to the department"
        ),
    },
    "32A-8-505": {
        "supplier_sells_liquor_only_to_department": _has(
            r"may not sell any liquor(?:, wine, or heavy beer)? within the state except to the department"
        ),
    },
    "32A-3-101": {
        "package_agency_contract_authority": _has(
            r"contractual relationships? with (?:a person|persons) to sell liquor in sealed packages from premises "
            r"other than those owned or leased by the state"
        ),
    },
    # No 2003-2010 bill prints these two sections; their text comes from the Legislature's code pages as
    # captured by the Internet Archive in 2008 and 2010 (legal/utah_archived_code.py).
    "32A-12-202": {
        "sale_only_as_authorized": _has(
            r"may not sell, offer (?:to sell|for sale),? or (?:otherwise )?furnish(?: or supply)?,? (?:an|any) "
            r"alcoholic (?:beverage or )?product in any place, or at any day or time other than as authorized by "
            r"this title"
        ),
    },
    "32A-3-104": {
        "package_agency_host_business_considered": _has(
            r"the type of establishment or business in which the (?:package )?agency may be located"
        ),
    },
}
CHECKS.update(CHECKS_32A)

# Claims: every listed (section, check, expected value) must hold in the version in force that day.
CLAIMS: dict[str, list[tuple[str, str, str]]] = {
    # Narrow question: may an ordinary grocery retailer, under its ordinary off-premise retail authorization
    # (the off-premise beer retailer license), sell sealed wine to the public? Indispensable dependencies
    # only; see data/curated/utah/claim_dependencies.csv for the reasoning and claim_exceptions.csv for the
    # special channels (package agencies etc.) that this claim does not cover.
    "ut_ordinary_grocery_wine_not_authorized": [
        ("32B-1-102", "wine_is_liquor", "yes"),
        ("32B-1-102", "liquor_excludes_beer", "yes"),
        ("32B-1-102", "off_premise_beer_retailer_is_beer_retailer", "yes"),
        ("32B-7-201", "local_license_to_sell_beer_off_premise", "yes"),
        ("32B-4-402", "sale_only_as_authorized", "yes"),
    ],
    # Corroborating, not indispensable: lawful liquor supply to sellers in the state runs to the department.
    "ut_liquor_supply_to_department_corroborating": [
        ("32B-4-401", "liquor_enters_state_only_through_department", "yes"),
        ("32B-11-208", "manufacturer_sells_liquor_only_to_department", "yes"),
        ("32B-11-608", "supplier_sells_liquor_only_to_department", "yes"),
    ],
    # Special channel: state-contract package agencies, possibly located in another business.
    "ut_package_agency_channel_available": [
        ("32B-2-601", "package_agency_contract_authority", "yes"),
        ("32B-2-603", "package_agency_host_business_considered", "yes"),
    ],
    # Wholesale control (spirits and wine): wine is liquor, and every lawful supply of liquor into the state
    # runs to the department (imports, manufacturers, industry representatives). The department is therefore
    # the only wholesaler of liquor. Whether licensees then buy only from the department is not checked here.
    "ut_liquor_wholesale_by_department": [
        ("32B-1-102", "wine_is_liquor", "yes"),
        ("32B-4-401", "liquor_enters_state_only_through_department", "yes"),
        ("32B-11-208", "manufacturer_sells_liquor_only_to_department", "yes"),
        ("32B-11-608", "supplier_sells_liquor_only_to_department", "yes"),
    ],
    # Retail arrangement (spirits and wine): the commission may establish state stores staffed by state
    # employees, may contract package agencies, and nobody may sell an alcoholic product except as the title
    # authorizes. It does not enumerate every other authorization (for example sales at a manufacturer).
    "ut_liquor_retail_state_stores_and_agencies": [
        ("32B-1-102", "wine_is_liquor", "yes"),
        ("32B-2-501", "state_store_authority", "yes"),
        ("32B-2-601", "package_agency_contract_authority", "yes"),
        ("32B-4-402", "sale_only_as_authorized", "yes"),
    ],
    "ut_beer_definition_max_4abv": [("32B-1-102", "beer_limit", "4abv/3.2abw")],
    "ut_beer_definition_max_5abv": [("32B-1-102", "beer_limit", "5abv/4abw")],
    # 2003 S.B. 66 (effective 2003-05-05): $11 for beer before July 1, 2003, $12.80 on or after.
    "ut_beer_tax_2003_schedule": [
        ("59-15-101", "beer_tax_rate_before_2003_07_01", "usd_11.00_before_2003_07_01"),
        ("59-15-101", "beer_tax_rate", "usd_12.80_on_or_after_2003_07_01"),
    ],
    "ut_beer_tax_1280": [("59-15-101", "beer_tax_rate", "usd_12.80_on_or_after_2003_07_01")],
    "ut_beer_tax_1310": [("59-15-101", "beer_tax_rate", "usd_13.10_on_or_after_2003_07_01")],
    # The 2024-05-01 version: $13.10 for beer before 2024-07-01, then $13.35 / $13.60 / $13.85 each July 1.
    "ut_beer_tax_2024_schedule": [
        ("59-15-101", "beer_tax_rate", "usd_13.10_before_2024_07_01_then_schedule"),
        ("59-15-101", "schedule_2024_to_2027", "yes"),
    ],
}


# ---------------------------------------------------------------- parsing version files

LABEL = re.compile(
    r"\((Effective until|Effective|Superseded|Repealed|Partial Sunset|Renumbered)\s+(\d{1,2}/\d{1,2}/\d{4})\)"
)
LISTED_END = re.compile(
    r"\((?:Superseded|Repealed|Partial Sunset|Renumbered|Effective until)\s+(\d{1,2}/\d{1,2}/\d{4})\)"
)


@dataclass
class Version:
    section: str
    version_file: str
    asset_id: str
    effective: date | None
    ended: date | None
    end_label: str | None
    text: str
    sha256: str | None = None
    retrieved_at: str | None = None
    listed_end: date | None = None

    @property
    def baseline(self) -> bool:
        return "_18000101" in self.version_file

    def window(self, known_through: date) -> tuple[date, date] | None:
        """[start, end) of days this version was in force, as stated by the Legislature."""
        start = self.effective or (RECORDS_BEGIN if self.baseline else None)
        if start is None:
            return None
        if self.baseline and start < RECORDS_BEGIN:
            start = RECORDS_BEGIN
        end = self.ended or (known_through + timedelta(days=1))
        return (start, end) if end > start else None


def _mdY(s: str) -> date:
    return datetime.strptime(s, "%m/%d/%Y").date()


def parse_version(section: str, version_file: str, raw: str) -> Version:
    head, _, body = raw.partition('<div id="secdiv">')
    labels = LABEL.findall(head)
    effective = next((_mdY(d) for k, d in labels if k == "Effective"), None)
    end = next(((k, _mdY(d)) for k, d in labels if k != "Effective"), None)
    body = body.split("Download Options")[0]
    text = _norm(html.unescape(re.sub(r"<[^>]+>", " ", body)))
    return Version(
        section,
        version_file,
        asset_id_for(version_file),
        effective,
        end[1] if end else None,
        end[0] if end else None,
        text,
    )


def evaluate(v: Version) -> dict[str, str]:
    return {name: fn(v.text) for name, fn in CHECKS[v.section].items()}


# ---------------------------------------------------------------- discovery (network)


def discover(client) -> dict[str, list[tuple[str, str]]]:
    """Return {section: [(version_file, label_text), ...]} including the current version."""
    out: dict[str, list[tuple[str, str]]] = {}
    for section, directory in SECTIONS.items():
        stem = file_stem(section)
        resp = client.request("POST", HISTORICAL_ENDPOINT, form={"section": section, "date": ""})
        resp.raise_for_status()
        found = re.findall(rf"({re.escape(stem)}_\d{{16}}\.html)\"[^>]*>\s*([^<]*)</a>", resp.text)
        page = client.request("GET", f"{HOST}/xcode/{directory}/{stem.removeprefix('C')}.html")
        page.raise_for_status()
        current = re.search(r'versionDefault="([^"]+)"', page.text)
        if current:
            found.append((current.group(1) + ".html", "(current version)"))
        seen, rows = set(), []
        for f, label in found:
            if f not in seen:
                seen.add(f)
                rows.append((f, label.strip()))
        out[section] = sorted(rows)
    return out


def write_source_yaml(found: dict[str, list[tuple[str, str]]], retrieved_on: str) -> Path:
    assets = []
    for section, rows in found.items():
        directory = SECTIONS[section]
        for f, label in rows:
            assets.append(
                {
                    "asset_id": asset_id_for(f),
                    "url": f"{HOST}/xcode/{directory}/{f}",
                    "filename": f,
                    "edition": f"Utah Code {section}, version file {f} {label}".strip(),
                    "source_series": "utah_code_history",
                    "source_vintage": f.removesuffix(".html").split("_")[-1],
                    "format": "html",
                    "priority": 20,
                    "redistribute_raw": True,
                    "options": {"section": section},
                }
            )
    doc = {
        "source_id": SOURCE_ID,
        "publisher": "Utah State Legislature (Office of Legislative Research and General Counsel)",
        "title": "Utah Code historical section versions (Historical Code, records from 2014-01-01)",
        "landing_url": f"{HOST}/UtahCode/historical.jsp",
        "citation": "Utah State Legislature. Utah Code, historical versions of selected sections. https://le.utah.gov/UtahCode/historical.jsp",
        "update_frequency": "Each legislative session (new versions added; current version page labels change when superseded)",
        "source_family": "policy",
        "rights_status": "government_edict",
        "notes": (
            f"GENERATED by 'alcohol-data legal discover-utah' on {retrieved_on}; review diffs before committing. "
            "One asset per version file. Version pages state their own effective and superseded dates; the "
            "oldest file (..._1800010118000101) is the text in force on 2014-01-01, where the Legislature's "
            "historical records begin."
        ),
        "host_min_interval_seconds": 2,
        "assets": assets,
    }
    header = "# GENERATED FILE: alcohol-data legal discover-utah. Edit SECTIONS in src/alcohol_data/legal/utah_code.py instead.\n"
    SOURCE_YAML.write_text(
        header + yaml.safe_dump(doc, sort_keys=False, width=110, allow_unicode=True),
        encoding="utf-8",
        newline="\n",
    )
    return SOURCE_YAML


# ---------------------------------------------------------------- ledger (offline, from pinned bytes)


def load_versions(pins: dict[str, dict], raw_dir: Path | None = None) -> list[Version]:
    raw_dir = raw_dir or paths.RAW_DIR
    doc = yaml.safe_load(SOURCE_YAML.read_text(encoding="utf-8"))
    versions = []
    for a in doc["assets"]:
        pin = pins.get(a["asset_id"])
        if not pin:
            raise FileNotFoundError(f"{a['asset_id']} is not pinned; run 'alcohol-data fetch'")
        p = raw_dir / a["asset_id"] / f"{pin['sha256'][:16]}-{a['filename']}"
        if not p.is_file():
            raise FileNotFoundError(f"pinned bytes for {a['asset_id']} not in {paths.rel(p.parent)}")
        v = parse_version(
            a["options"]["section"], a["filename"], p.read_text(encoding="utf-8", errors="replace")
        )
        v.sha256, v.retrieved_at = pin["sha256"], pin.get("retrieved_at")
        m = LISTED_END.search(a.get("edition", ""))
        v.listed_end = _mdY(m.group(1)) if m else None
        versions.append(v)
    return versions


def local_date(utc_timestamp: str, timezone: str) -> date:
    """Calendar date in `timezone` of a stored UTC retrieval timestamp (e.g. 2026-10-07T01:48:25Z)."""
    from zoneinfo import ZoneInfo

    ts = datetime.fromisoformat(utc_timestamp.replace("Z", "+00:00"))
    return ts.astimezone(ZoneInfo(timezone)).date()


# Weakest first. A verified day takes the weakest status of the texts it used.
TEMPORAL_RANK = {"unresolved": 0, "reconstructed": 1, "reconciled": 2, "anchored": 3}


@dataclass
class EarlierState:
    """Text in force before RECORDS_BEGIN, reconstructed from session laws (legal/utah_session_laws.py)."""

    section: str
    start: date
    end: date  # exclusive
    state_id: str
    checks: dict[str, str]
    temporal_status: str  # reconstructed | reconciled (unresolved states verify nothing)


def ledger(
    versions: list[Version], as_of: date, timezone: str, earlier: list[EarlierState] | None = None
) -> tuple[list[dict], list[dict]]:
    """Version rows and claim windows, cut off at the build's as-of date.

    A current version is known in force through the earlier of the as-of date and the local date its
    page was retrieved; nothing after the as-of date is treated as history. Historical Code versions are
    `anchored`; `earlier` states carry their own reconstruction status, and a claim's verified days are
    split into runs of equal status.
    """
    rows, in_force = [], {}
    for v in sorted(versions, key=lambda v: (v.section, v.effective or date.min, v.version_file)):
        through = min(as_of, local_date(v.retrieved_at, timezone)) if v.retrieved_at else as_of
        w = v.window(through)
        checks = evaluate(v)
        rows.append(
            {
                "section": v.section,
                "asset_id": v.asset_id,
                "version_file": v.version_file,
                "effective": v.effective.isoformat()
                if v.effective
                else ("in force 2014-01-01" if v.baseline else ""),
                "ended": v.ended.isoformat() if v.ended else "",
                "end_label": v.end_label or "",
                "in_force_from": w[0].isoformat() if w else "",
                "in_force_until_exclusive": w[1].isoformat() if w else "",
                "status": "never_in_force" if w is None else ("current" if v.ended is None else "superseded"),
                "sha256": v.sha256 or "",
                "listing_end": v.listed_end.isoformat() if v.listed_end else "",
                "page_and_listing_agree": "yes" if v.listed_end == v.ended else "no",
                **{f"check_{k}": val for k, val in sorted(checks.items())},
            }
        )
        if w:
            in_force.setdefault(v.section, []).append((w, v.asset_id, checks, "anchored"))
    for st in earlier or []:
        if st.temporal_status != "unresolved":
            in_force.setdefault(st.section, []).append(
                ((st.start, st.end), st.state_id, st.checks, st.temporal_status)
            )

    claims = []
    starts = [w[0] for entries in in_force.values() for w, *_ in entries]
    day0, day_end = min([RECORDS_BEGIN, *starts]), as_of + timedelta(days=1)
    for claim, reqs32b in CLAIMS.items():
        alternatives = [reqs32b] + ([CLAIMS_32A[claim]] if claim in CLAIMS_32A else [])
        verified: list[tuple[date, str, frozenset[str], int]] = []
        d = day0
        while d < day_end:
            for k, reqs in enumerate(alternatives):
                ok, used, statuses = True, set(), []
                for section, check, expected in reqs:
                    hit = [(i, c, t) for (s, e), i, c, t in in_force.get(section, []) if s <= d < e]
                    if len(hit) != 1 or hit[0][1].get(check) != expected:
                        ok = False
                        break
                    used.add(hit[0][0])
                    statuses.append(hit[0][2])
                if ok:
                    verified.append((d, min(statuses, key=TEMPORAL_RANK.__getitem__), frozenset(used), k))
                    break
            d += timedelta(days=1)
        status = {
            "role": CLAIM_ROLES.get(claim, "policy_claim"),
            "retrieval_status": "fetched",
            "extraction_status": "parsed",
            "legal_review_status": "machine_assisted_review",
            "as_of_date": as_of.isoformat(),
        }
        texts = ["; ".join(f"{s} {c}={e}" for s, c, e in reqs) for reqs in alternatives]
        for start, end, temporal, used, k in _status_runs(verified):
            reqs_text = texts[k]
            claims.append(
                {
                    "claim_id": claim,
                    "verified_from": start.isoformat(),
                    "verified_through": end.isoformat(),
                    "days": (end - start).days + 1,
                    "claim_status": "supported",
                    **status,
                    "temporal_status": temporal,
                    "requirements": reqs_text,
                    "versions": "|".join(sorted(used)),
                }
            )
        if not verified:
            claims.append(
                {
                    "claim_id": claim,
                    "verified_from": "",
                    "verified_through": "",
                    "days": 0,
                    "claim_status": "incomplete",
                    **status,
                    "temporal_status": "unresolved",
                    "requirements": " | or before 2011-07-01: ".join(texts),
                    "versions": "",
                }
            )
    return rows, claims


# The same claims before 2011-07-01, against the Title 32A predecessors. A day is verified under whichever
# set of requirements has its texts in force (the two titles never overlap).
CLAIMS_32A: dict[str, list[tuple[str, str, str]]] = {
    "ut_ordinary_grocery_wine_not_authorized": [
        ("32A-1-105", "wine_is_liquor", "yes"),
        ("32A-1-105", "liquor_excludes_beer", "yes"),
        ("32A-10-101", "local_license_to_sell_beer_off_premise", "yes"),
        ("32A-12-202", "sale_only_as_authorized", "yes"),
    ],
    "ut_liquor_supply_to_department_corroborating": [
        ("32A-12-201", "liquor_enters_state_only_through_department", "yes"),
        ("32A-8-106", "manufacturer_sells_liquor_only_to_department", "yes"),
        ("32A-8-505", "supplier_sells_liquor_only_to_department", "yes"),
    ],
    "ut_package_agency_channel_available": [
        ("32A-3-101", "package_agency_contract_authority", "yes"),
        ("32A-3-104", "package_agency_host_business_considered", "yes"),
    ],
    "ut_liquor_wholesale_by_department": [
        ("32A-1-105", "wine_is_liquor", "yes"),
        ("32A-12-201", "liquor_enters_state_only_through_department", "yes"),
        ("32A-8-106", "manufacturer_sells_liquor_only_to_department", "yes"),
        ("32A-8-505", "supplier_sells_liquor_only_to_department", "yes"),
    ],
    # No Title 32A counterpart for the retail claim: the state-store section (32A-2-101) is not inventoried,
    # so days before 2011-07-01 stay unverified for it.
    "ut_beer_definition_max_4abv": [("32A-1-105", "beer_limit", "4abv/3.2abw")],
}

# Curated policy interval -> ledger claims whose verified days must cover its known window
# (tests/test_legal_history.py) and that the review packet shows.
INTERVAL_CLAIMS: dict[str, list[str]] = {
    "ut_ordinary_grocery_wine_not_authorized": ["ut_ordinary_grocery_wine_not_authorized"],
    "ut_package_agency_channel": ["ut_package_agency_channel_available"],
    "ut_spirits_wholesale_state": ["ut_liquor_wholesale_by_department"],
    "ut_wine_wholesale_state": ["ut_liquor_wholesale_by_department"],
    "ut_spirits_retail_state_stores_and_agencies": ["ut_liquor_retail_state_stores_and_agencies"],
    "ut_wine_retail_state_stores_and_agencies": ["ut_liquor_retail_state_stores_and_agencies"],
    "ut_beer_definition_max_4abv": ["ut_beer_definition_max_4abv"],
    "ut_beer_definition_max_5abv": ["ut_beer_definition_max_5abv"],
    "ut_beer_tax_1100": ["ut_beer_tax_2003_schedule"],
    "ut_beer_tax_1280": ["ut_beer_tax_1280"],
    "ut_beer_tax_1310": ["ut_beer_tax_1310", "ut_beer_tax_2024_schedule"],
    "ut_beer_tax_1335": ["ut_beer_tax_2024_schedule"],
    "ut_beer_tax_1360": ["ut_beer_tax_2024_schedule"],
    "ut_beer_tax_1385": ["ut_beer_tax_2024_schedule"],
}


# How a claim is used. Machine checks never set a human review status.
CLAIM_ROLES = {
    "ut_ordinary_grocery_wine_not_authorized": "policy_claim",
    "ut_liquor_supply_to_department_corroborating": "corroborating",
    "ut_package_agency_channel_available": "special_channel",
}


def _status_runs(
    days: list[tuple[date, str, frozenset[str], int]],
) -> list[tuple[date, date, str, set[str], int]]:
    """Consecutive verified days with the same temporal status and requirement set, and the texts used."""
    out: list[tuple[date, date, str, set[str], int]] = []
    for d, status, used, k in days:
        if out and d == out[-1][1] + timedelta(days=1) and (status, k) == (out[-1][2], out[-1][4]):
            out[-1] = (out[-1][0], d, status, out[-1][3] | used, k)
        else:
            out.append((d, d, status, set(used), k))
    return out


def _runs(days: list[date]) -> list[tuple[date, date]]:
    out = []
    for d in days:
        if out and d == out[-1][1] + timedelta(days=1):
            out[-1] = (out[-1][0], d)
        else:
            out.append((d, d))
    return out


def write_ledger(rows: list[dict], claims: list[dict]) -> tuple[Path, Path]:
    LEDGER_DIR.mkdir(parents=True, exist_ok=True)
    cols = sorted(
        {k for r in rows for k in r}, key=lambda k: (not k.startswith(("section", "asset", "version")), k)
    )
    base = [
        "section",
        "asset_id",
        "version_file",
        "effective",
        "ended",
        "end_label",
        "in_force_from",
        "in_force_until_exclusive",
        "status",
        "listing_end",
        "page_and_listing_agree",
        "sha256",
    ]
    cols = base + sorted(k for k in {k for r in rows for k in r} if k not in base)
    with open(VERSIONS_CSV, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols, lineterminator="\n", restval="")
        w.writeheader()
        w.writerows(rows)
    with open(CLAIMS_CSV, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(
            f,
            fieldnames=[
                "claim_id",
                "verified_from",
                "verified_through",
                "days",
                "claim_status",
                "role",
                "retrieval_status",
                "extraction_status",
                "temporal_status",
                "legal_review_status",
                "as_of_date",
                "requirements",
                "versions",
            ],
            lineterminator="\n",
        )
        w.writeheader()
        w.writerows(claims)
    return VERSIONS_CSV, CLAIMS_CSV
