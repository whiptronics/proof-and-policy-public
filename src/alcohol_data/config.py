"""Load source and build configurations (YAML)."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Any

import yaml

from alcohol_data import paths
from alcohol_data.schemas.vocab import ACQUISITION_STATUSES, RIGHTS_STATUSES


class ConfigError(ValueError):
    pass


@dataclass
class AuthSpec:
    kind: str  # "query" or "json_body"
    param: str
    env: str
    required: bool = False


@dataclass
class AssetConfig:
    asset_id: str
    source_id: str
    url: str | None
    method: str
    edition: str
    source_series: str
    source_vintage: str
    format: str
    parser: str | None
    filename: str
    priority: int = 0
    redistribute_raw: bool = False
    rights_status: str = "rights_unresolved"
    expected_status: str = "acquired"
    body: dict[str, Any] | None = None
    auth: AuthSpec | None = None
    options: dict[str, Any] = field(default_factory=dict)
    notes: str | None = None
    blockers: str | None = None
    next_action: str | None = None

    @property
    def host(self) -> str:
        if not self.url:
            return ""
        from urllib.parse import urlparse

        return urlparse(self.url).netloc


@dataclass
class SourceConfig:
    source_id: str
    publisher: str
    title: str
    landing_url: str
    citation: str
    source_family: str
    rights_status: str
    rights_evidence_url: str | None
    notes: str | None
    host_min_interval_seconds: float
    assets: list[AssetConfig]
    path: Path
    update_frequency: str | None = None
    # Set when a release must not include this source until the owner decides (e.g. a share-alike license).
    release_gate: str | None = None


@dataclass
class BuildConfig:
    name: str
    release_version: str
    sources: list[str]
    pins_file: Path
    policy_events: Path | None
    policy_evidence: Path | None
    manual_observations: Path | None
    exposure_years: tuple[int, int]
    local_assets: dict[str, Path]
    skip_assets: set[str]
    derived: bool
    path: Path
    as_of_date: date
    as_of_timezone: str
    claim_dependencies: Path | None = None
    claim_exceptions: Path | None = None
    policy_snapshots: Path | None = None
    missing_assets: str = (
        "error"  # error | record (fixture builds record unfetched assets instead of failing)
    )


def _url_basename(url: str | None) -> str | None:
    """Last path segment of a URL, ignoring the query string (which may hold API filters)."""
    if not url:
        return None
    from urllib.parse import urlparse

    return Path(urlparse(url).path).name or None


def safe_filename(name: str) -> str:
    """Keep cache file names portable (Windows rejects ?, *, :, etc.)."""
    import re

    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", name).strip("._")
    return cleaned[:120] or "asset.bin"


def _require(d: dict, key: str, where: str) -> Any:
    if key not in d or d[key] in (None, ""):
        raise ConfigError(f"{where}: missing required key '{key}'")
    return d[key]


def load_source(path: Path) -> SourceConfig:
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    where = paths.rel(path)
    sid = _require(raw, "source_id", where)
    rights = _require(raw, "rights_status", where)
    if rights not in RIGHTS_STATUSES:
        raise ConfigError(f"{where}: unknown rights_status {rights!r}")
    assets = []
    for a in raw.get("assets", []):
        aw = f"{where} asset {a.get('asset_id')}"
        method = a.get("method", "GET")
        url = a.get("url")
        if method != "manual_import" and not url:
            raise ConfigError(f"{aw}: url required unless method is manual_import")
        status = a.get("expected_status", "acquired")
        if status not in ACQUISITION_STATUSES:
            raise ConfigError(f"{aw}: unknown expected_status {status!r}")
        a_rights = a.get("rights_status", rights)
        if a_rights not in RIGHTS_STATUSES:
            raise ConfigError(f"{aw}: unknown rights_status {a_rights!r}")
        auth = None
        if a.get("auth"):
            au = a["auth"]
            auth = AuthSpec(au["kind"], au["param"], au["env"], bool(au.get("required", False)))
        assets.append(
            AssetConfig(
                asset_id=_require(a, "asset_id", aw),
                source_id=sid,
                url=url,
                method=method,
                edition=_require(a, "edition", aw),
                source_series=_require(a, "source_series", aw),
                source_vintage=str(_require(a, "source_vintage", aw)),
                format=_require(a, "format", aw),
                parser=a.get("parser"),
                filename=safe_filename(a.get("filename") or _url_basename(url) or f"{a['asset_id']}.bin"),
                priority=int(a.get("priority", 0)),
                redistribute_raw=bool(a.get("redistribute_raw", False)),
                rights_status=a_rights,
                expected_status=status,
                body=a.get("body"),
                auth=auth,
                options=a.get("options") or {},
                notes=a.get("notes"),
                blockers=a.get("blockers"),
                next_action=a.get("next_action"),
            )
        )
    return SourceConfig(
        source_id=sid,
        publisher=_require(raw, "publisher", where),
        title=_require(raw, "title", where),
        landing_url=_require(raw, "landing_url", where),
        citation=_require(raw, "citation", where),
        source_family=_require(raw, "source_family", where),
        rights_status=rights,
        rights_evidence_url=raw.get("rights_evidence_url"),
        notes=raw.get("notes"),
        host_min_interval_seconds=float(raw.get("host_min_interval_seconds", 1.0)),
        assets=assets,
        path=path,
        update_frequency=raw.get("update_frequency"),
        release_gate=raw.get("release_gate"),
    )


def load_all_sources(directory: Path | None = None) -> dict[str, SourceConfig]:
    directory = directory or paths.SOURCES_DIR
    out: dict[str, SourceConfig] = {}
    for p in sorted(directory.glob("*.yaml")):
        s = load_source(p)
        if s.source_id in out:
            raise ConfigError(f"duplicate source_id {s.source_id} in {p}")
        out[s.source_id] = s
    seen: set[str] = set()
    for s in out.values():
        for a in s.assets:
            if a.asset_id in seen:
                raise ConfigError(f"duplicate asset_id {a.asset_id}")
            seen.add(a.asset_id)
    return out


def _opt_path(v: str | None) -> Path | None:
    return (paths.ROOT / v) if v else None


def load_build(path: Path) -> BuildConfig:
    path = Path(path)
    if not path.is_absolute():
        path = (Path.cwd() / path) if (Path.cwd() / path).exists() else (paths.ROOT / path)
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    where = paths.rel(path)
    yrs = raw.get("exposure_years", [1990, 2026])
    return BuildConfig(
        name=_require(raw, "name", where),
        release_version=str(_require(raw, "release_version", where)),
        sources=list(_require(raw, "sources", where)),
        pins_file=paths.ROOT / _require(raw, "pins_file", where),
        policy_events=_opt_path(raw.get("policy_events")),
        policy_evidence=_opt_path(raw.get("policy_evidence")),
        manual_observations=_opt_path(raw.get("manual_observations")),
        exposure_years=(int(yrs[0]), int(yrs[1])),
        local_assets={k: paths.ROOT / v for k, v in (raw.get("local_assets") or {}).items()},
        skip_assets=set(raw.get("skip_assets") or []),
        derived=bool(raw.get("derived", True)),
        path=path,
        as_of_date=_as_of(raw, where),
        as_of_timezone=str(_require(raw, "as_of_timezone", where)),
        claim_dependencies=_opt_path(raw.get("claim_dependencies")),
        claim_exceptions=_opt_path(raw.get("claim_exceptions")),
        policy_snapshots=_opt_path(raw.get("policy_snapshots")),
        missing_assets=str(raw.get("missing_assets", "error")),
    )


def _as_of(raw: dict, where: str) -> date:
    """The last calendar day (in as_of_timezone) treated as observed history; later days are future."""
    v = _require(raw, "as_of_date", where)
    return v if isinstance(v, date) else date.fromisoformat(str(v))


def build_assets(build: BuildConfig, sources: dict[str, SourceConfig]) -> list[AssetConfig]:
    out = []
    for sid in build.sources:
        if sid not in sources:
            raise ConfigError(f"{paths.rel(build.path)}: unknown source {sid}")
        for a in sources[sid].assets:
            if a.asset_id not in build.skip_assets:
                out.append(a)
    return out
