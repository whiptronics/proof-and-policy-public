"""Shared types for source adapters.

An adapter is a pure function from (asset configuration, pinned local bytes) to
staged rows. Adapters never touch the network, so every parse can be rerun on
the exact bytes recorded in a release manifest.
"""

from __future__ import annotations

import json
from collections.abc import Callable, Iterator
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Any

from alcohol_data.config import AssetConfig


@dataclass
class Staged:
    geo_id: str
    measure_id: str
    period_start: date
    period_end: date
    period_kind: str
    period_label: str
    year: int
    value: float | None
    source_locator: str
    estimate_type: str
    extraction_method: str
    subgroup: str = "all"
    missing_reason: str | None = None
    comparability_group: str | None = None
    quality_flags: list[str] = field(default_factory=list)
    review_status: str | None = None
    # details
    source_code: str | None = None
    raw_value: str | None = None
    raw_unit: str | None = None
    multiplier: float | None = None
    ci_low: float | None = None
    ci_high: float | None = None
    ci_level: float | None = None
    standard_error: float | None = None
    sample_size: int | None = None
    suppression_flag: str | None = None
    footnote: str | None = None
    fiscal_year_end: date | None = None
    extra: dict[str, Any] | None = None

    def extra_json(self) -> str | None:
        return json.dumps(self.extra, sort_keys=True) if self.extra else None


@dataclass
class Rejected:
    source_locator: str
    reason: str
    measure_id: str | None = None
    geo_id: str | None = None
    period_label: str | None = None
    raw_value: str | None = None


ParseResult = Iterator[Staged | Rejected]
Adapter = Callable[[AssetConfig, Path], ParseResult]

ADAPTERS: dict[str, tuple[Adapter, str]] = {}


def register(name: str, version: str):
    def deco(fn: Adapter) -> Adapter:
        ADAPTERS[name] = (fn, version)
        return fn

    return deco


def state_geo(fips2: str) -> str:
    if len(fips2) != 2 or not fips2.isdigit():
        raise ValueError(f"state FIPS must be two digits, got {fips2!r}")
    return f"state:{fips2}"


NATION = "nation:us"


def region_geo(code: int) -> str:
    return f"census_region:{code}"


def july1(year: int) -> date:
    return date(year, 7, 1)


def parse_number(token: str) -> float | None:
    t = token.strip().replace(",", "")
    if t in ("", ".", "-", "X", "x", "N/A", "NA"):
        return None
    return float(t)
