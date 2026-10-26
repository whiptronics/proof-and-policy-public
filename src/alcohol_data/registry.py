"""Generate metadata/source_registry.csv and metadata/rights_registry.csv.

Inputs: the source YAML configs, the pins file (hashes, retrieval dates) and, when a
build exists, the observed coverage of each asset. Nothing here is typed by hand.
"""

from __future__ import annotations

import csv
from pathlib import Path

import duckdb

from alcohol_data import paths
from alcohol_data.acquisition.fetch import load_pins
from alcohol_data.config import load_all_sources, load_build

SOURCE_REGISTRY = paths.METADATA_DIR / "source_registry.csv"
RIGHTS_REGISTRY = paths.METADATA_DIR / "rights_registry.csv"

SOURCE_COLS = [
    "source_id",
    "asset_id",
    "agency",
    "landing_url",
    "asset_url",
    "title",
    "edition",
    "retrieved_at",
    "sha256",
    "bytes",
    "format",
    "access_method",
    "authentication",
    "update_frequency",
    "observed_first_year",
    "observed_last_year",
    "geographies_with_values",
    "measures",
    "rights_status",
    "rights_evidence_url",
    "raw_retention",
    "extraction_status",
    "extraction_method",
    "blockers",
    "next_action",
]
RIGHTS_COLS = [
    "source_id",
    "asset_id",
    "rights_status",
    "redistribute_raw",
    "raw_in_release_bundle",
    "evidence_url",
    "attribution",
    "notes",
]


def _observed(asset_id: str) -> dict:
    if not paths.DATABASE_PATH.exists():
        return {}
    con = duckdb.connect(str(paths.DATABASE_PATH), read_only=True)
    try:
        r = con.execute(
            """SELECT min(year) FILTER (WHERE value IS NOT NULL), max(year) FILTER (WHERE value IS NOT NULL),
                                  count(DISTINCT geo_id) FILTER (WHERE value IS NOT NULL),
                                  string_agg(DISTINCT measure_id, ' ' ORDER BY measure_id),
                                  string_agg(DISTINCT extraction_method, ' ')
                           FROM observations WHERE asset_id = ?""",
            [asset_id],
        ).fetchone()
        st = con.execute(
            "SELECT acquisition_status FROM source_assets WHERE asset_id = ?", [asset_id]
        ).fetchone()
    finally:
        con.close()
    return {
        "observed_first_year": r[0],
        "observed_last_year": r[1],
        "geographies_with_values": r[2] or 0,
        "measures": r[3] or "",
        "extraction_method": r[4] or "",
        "status": st[0] if st else None,
    }


def write_registries(config: str | Path) -> tuple[int, int]:
    build = load_build(Path(config))
    sources = load_all_sources()
    pins = load_pins(build.pins_file)
    src_rows, rights_rows = [], []
    for sid in build.sources:
        s = sources[sid]
        for a in s.assets:
            pin = pins.get(a.asset_id, {})
            obs = _observed(a.asset_id)
            status = obs.get("status") or ("acquired" if pin else a.expected_status)
            if a.method == "manual_import":
                access = "manual download then 'alcohol-data import-asset'"
            elif a.method == "POST":
                access = "HTTP POST (API)"
            else:
                access = "HTTP GET"
            auth = (
                "none required"
                if not a.auth
                else f"optional env {a.auth.env}"
                if not a.auth.required
                else f"required env {a.auth.env}"
            )
            src_rows.append(
                {
                    "source_id": sid,
                    "asset_id": a.asset_id,
                    "agency": s.publisher,
                    "landing_url": s.landing_url,
                    "asset_url": pin.get("url") or a.url or "",
                    "title": s.title,
                    "edition": a.edition,
                    "retrieved_at": pin.get("retrieved_at", ""),
                    "sha256": pin.get("sha256", ""),
                    "bytes": pin.get("bytes", ""),
                    "format": a.format,
                    "access_method": access,
                    "authentication": auth,
                    "update_frequency": s.update_frequency or "",
                    "observed_first_year": obs.get("observed_first_year") or "",
                    "observed_last_year": obs.get("observed_last_year") or "",
                    "geographies_with_values": obs.get("geographies_with_values", ""),
                    "measures": obs.get("measures", ""),
                    "rights_status": a.rights_status,
                    "rights_evidence_url": s.rights_evidence_url or "",
                    "raw_retention": "local cache; redistributable"
                    if a.redistribute_raw
                    else "local cache only; not redistributed",
                    "extraction_status": status,
                    "extraction_method": obs.get("extraction_method", "")
                    or ("none (document evidence)" if not a.parser else ""),
                    "blockers": a.blockers or "",
                    "next_action": a.next_action or "",
                }
            )
            attribution = (
                s.citation
                if a.rights_status in ("open_license", "facts_with_citation")
                else "Citation requested as good practice"
            )
            rights_rows.append(
                {
                    "source_id": sid,
                    "asset_id": a.asset_id,
                    "rights_status": a.rights_status,
                    "redistribute_raw": str(a.redistribute_raw).lower(),
                    "raw_in_release_bundle": "false",
                    "evidence_url": s.rights_evidence_url or "",
                    "attribution": attribution,
                    "notes": a.notes or s.notes or "",
                }
            )
    for path, cols, rows in (
        (SOURCE_REGISTRY, SOURCE_COLS, src_rows),
        (RIGHTS_REGISTRY, RIGHTS_COLS, rights_rows),
    ):
        with open(path, "w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=cols, lineterminator="\n")
            w.writeheader()
            w.writerows(rows)
    return len(build.sources), len(src_rows)
