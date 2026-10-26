"""Deterministic identifiers."""

from __future__ import annotations

import hashlib
from datetime import date


def natural_key(
    geo_id: str, measure_id: str, start: date, end: date, subgroup: str, series: str, vintage: str
) -> str:
    """Natural key of an observation: geography, measure, period, subgroup, source series and edition."""
    return "|".join([geo_id, measure_id, start.isoformat(), end.isoformat(), subgroup, series, vintage])


def observation_id(nk: str) -> str:
    return "obs_" + hashlib.sha256(nk.encode("utf-8")).hexdigest()[:20]


def cell_key(geo_id: str, measure_id: str, start: date, end: date, subgroup: str) -> str:
    return "|".join([geo_id, measure_id, start.isoformat(), end.isoformat(), subgroup])
