"""State crosswalk lookups (metadata/geography_crosswalks/states.csv)."""

from __future__ import annotations

import csv
from dataclasses import dataclass
from functools import lru_cache

from alcohol_data import paths

STATES_CSV = paths.METADATA_DIR / "geography_crosswalks" / "states.csv"


@dataclass(frozen=True)
class State:
    fips: str
    usps: str
    name: str
    region: int
    division: int
    census_gov_code: str

    @property
    def geo_id(self) -> str:
        return f"state:{self.fips}"


@lru_cache(maxsize=1)
def states() -> tuple[State, ...]:
    with open(STATES_CSV, encoding="utf-8", newline="") as f:
        return tuple(
            State(
                r["fips"],
                r["usps"],
                r["name"],
                int(r["census_region"]),
                int(r["census_division"]),
                r["census_gov_state_code"],
            )
            for r in csv.DictReader(f)
        )


def by_fips(fips: str) -> State | None:
    return next((s for s in states() if s.fips == fips), None)


def by_usps(usps: str) -> State | None:
    return next((s for s in states() if s.usps == usps), None)


def by_census_gov_code(code: str) -> State | None:
    return next((s for s in states() if s.census_gov_code == code), None)
