"""Filesystem locations. Everything resolves from the repository root."""

from __future__ import annotations

import os
from pathlib import Path


def repo_root() -> Path:
    """Find the checkout root: the nearest parent holding this project's pyproject.toml."""
    override = os.environ.get("ALCOHOL_DATA_REPO")
    if override:
        return Path(override).resolve()
    here = Path(__file__).resolve()
    for parent in here.parents:
        candidate = parent / "pyproject.toml"
        if candidate.is_file() and "alcohol-policy-revenue-data" in candidate.read_text(encoding="utf-8"):
            return parent
    return Path.cwd().resolve()


ROOT = repo_root()
DATA_HOME = Path(os.environ.get("ALCOHOL_DATA_HOME") or ROOT).resolve()

CONFIG_DIR = ROOT / "config"
SOURCES_DIR = CONFIG_DIR / "sources"
BUILDS_DIR = CONFIG_DIR / "builds"
METADATA_DIR = ROOT / "metadata"
CURATED_DIR = ROOT / "data" / "curated"
SQL_DIR = ROOT / "sql"
DOCS_DIR = ROOT / "docs"

RAW_DIR = DATA_HOME / "data" / "raw"
STAGING_DIR = DATA_HOME / "data" / "staging"
PROCESSED_DIR = DATA_HOME / "data" / "processed"
DIST_DIR = DATA_HOME / "dist"

DATABASE_PATH = PROCESSED_DIR / "alcohol_data.duckdb"
ACQUISITION_LOG = RAW_DIR / "acquisition_log.jsonl"


def ensure_dirs() -> None:
    for d in (RAW_DIR, STAGING_DIR, PROCESSED_DIR, DIST_DIR):
        d.mkdir(parents=True, exist_ok=True)


def rel(path: Path) -> str:
    """Repository-relative POSIX path for manifests (never an absolute, user-specific path)."""
    try:
        return Path(path).resolve().relative_to(ROOT).as_posix()
    except ValueError:
        try:
            return Path(path).resolve().relative_to(DATA_HOME).as_posix()
        except ValueError:
            return Path(path).name
