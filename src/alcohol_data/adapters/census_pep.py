"""Census Bureau Population Estimates Program (PEP) adapters.

Produces July 1 resident population for states (and the nation where the file
publishes it): all ages, and ages 14+, 18+ and 21+ where the file has single
years of age. Different vintages and intercensal series are kept as separate
candidates; preferred_observations chooses between them by documented priority.
"""

from __future__ import annotations

import csv
import io
from collections import defaultdict
from pathlib import Path

from alcohol_data.adapters.base import NATION, Rejected, Staged, july1, register, state_geo
from alcohol_data.config import AssetConfig

AGE_CUTS = {
    "pop_total_resident": 0,
    "pop_age14plus_resident": 14,
    "pop_age18plus_resident": 18,
    "pop_age21plus_resident": 21,
}


def _row(
    asset: AssetConfig, geo: str, measure: str, year: int, value: int, locator: str, flags=None, code=None
) -> Staged:
    d = july1(year)
    return Staged(
        geo_id=geo,
        measure_id=measure,
        period_start=d,
        period_end=d,
        period_kind="point_in_time",
        period_label=f"{year}-07-01",
        year=year,
        value=float(value),
        source_locator=locator,
        estimate_type="official_estimate",
        extraction_method="csv_parser" if asset.format == "csv" else "fixed_width_parser",
        comparability_group=f"census_pep|{asset.source_series}",
        quality_flags=list(flags or []),
        source_code=code,
        raw_value=str(value),
        raw_unit="persons",
        multiplier=1.0,
    )


@register("census_pep_icen_1990s", "1.0")
def parse_icen_1990s(asset: AssetConfig, path: Path):
    """STCH-icen19XX.txt: county x age group x race-sex x Hispanic origin, July 1.

    State totals are the sum of the state's county rows. Five-year age groups do
    not allow 14+, 18+ or 21+ totals, so only all-ages population is produced.
    """
    expected_year = int(asset.options["year"])
    totals: dict[str, int] = defaultdict(int)
    lines: dict[str, int] = defaultdict(int)
    with open(path, encoding="latin-1") as f:
        for lineno, line in enumerate(f, start=1):
            parts = line.split()
            if not parts:
                continue
            if len(parts) != 6 or not all(p.isdigit() for p in parts):
                yield Rejected(
                    f"line {lineno}",
                    "unexpected field count or non-numeric field",
                    raw_value=line.strip()[:80],
                )
                continue
            yy, fips5, agegrp, racesex, hisp, pop = parts
            if 1900 + int(yy) != expected_year:
                yield Rejected(f"line {lineno}", f"year code {yy} does not match asset year {expected_year}")
                continue
            if (
                len(fips5) != 5
                or not (0 <= int(agegrp) <= 18)
                or not (1 <= int(racesex) <= 8)
                or hisp not in ("1", "2")
            ):
                yield Rejected(
                    f"line {lineno}", "code outside documented layout", raw_value=line.strip()[:80]
                )
                continue
            st = fips5[:2]
            totals[st] += int(pop)
            lines[st] += 1
    for st in sorted(totals):
        yield _row(
            asset,
            state_geo(st),
            "pop_total_resident",
            expected_year,
            totals[st],
            f"sum of {lines[st]} county/age/race/sex/origin lines with state FIPS {st}",
            flags=["aggregated_from_county_rows"],
            code="POP",
        )


@register("census_pep_st_agesex_2000s", "1.0")
def parse_st_agesex_2000s(asset: AssetConfig, path: Path):
    """st-est00int-agesex.csv: state x sex x single year of age (85 = 85+), AGE 999 = total."""
    text = path.read_text(encoding="latin-1")
    reader = csv.DictReader(io.StringIO(text))
    years = [int(c.replace("POPESTIMATE", "")) for c in reader.fieldnames if c.startswith("POPESTIMATE")]
    by_state: dict[str, dict[int, dict[int, int]]] = defaultdict(lambda: defaultdict(dict))
    names: dict[str, str] = {}
    for r in reader:
        if r["SEX"] != "0":
            continue
        st = r["STATE"].strip().zfill(2)  # the file drops leading zeros ("1" = Alabama)
        names[st] = r["NAME"]
        age = int(r["AGE"])
        for y in years:
            by_state[st][y][age] = int(r[f"POPESTIMATE{y}"])
    for st in sorted(by_state):
        geo = NATION if st == "00" else state_geo(st)
        for y in years:
            ages = by_state[st][y]
            total_published = ages.get(999)
            single = {a: v for a, v in ages.items() if a != 999}
            if sorted(single) != list(range(0, 86)):
                yield Rejected(f"STATE={st} POPESTIMATE{y}", "single-year ages 0..85 incomplete", geo_id=geo)
                continue
            if total_published is not None and sum(single.values()) != total_published:
                yield Rejected(
                    f"STATE={st} POPESTIMATE{y}", "single years do not sum to AGE=999 total", geo_id=geo
                )
                continue
            for measure, cut in AGE_CUTS.items():
                if cut == 0 and total_published is not None:
                    yield _row(
                        asset,
                        geo,
                        measure,
                        y,
                        total_published,
                        f"STATE={st},SEX=0,AGE=999,column POPESTIMATE{y}",
                        code="POPESTIMATE",
                    )
                else:
                    v = sum(n for a, n in single.items() if a >= cut)
                    yield _row(
                        asset,
                        geo,
                        measure,
                        y,
                        v,
                        f"sum STATE={st},SEX=0,AGE>={cut} (85=85+),column POPESTIMATE{y}",
                        code="POPESTIMATE",
                    )


@register("census_pep_alldata6", "1.0")
def parse_alldata6(asset: AssetConfig, path: Path):
    """SC-EST20XX(int)-ALLDATA6: state x sex x origin x 6 race groups x single age (85 = 85+).

    Totals use SEX=0 (both sexes) and ORIGIN=0 (total), summed over the six race groups.
    """
    text = path.read_text(encoding="latin-1")
    reader = csv.DictReader(io.StringIO(text))
    years = [int(c.replace("POPESTIMATE", "")) for c in reader.fieldnames if c.startswith("POPESTIMATE")]
    acc: dict[str, dict[int, dict[int, int]]] = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
    races: dict[str, set] = defaultdict(set)
    for r in reader:
        if r["SUMLEV"] != "040" or r["SEX"] != "0" or r["ORIGIN"] != "0":
            continue
        st = r["STATE"].strip().zfill(2)
        races[st].add(r["RACE"])
        age = int(r["AGE"])
        for y in years:
            acc[st][y][age] += int(r[f"POPESTIMATE{y}"])
    for st in sorted(acc):
        if races[st] != {"1", "2", "3", "4", "5", "6"}:
            yield Rejected(
                f"STATE={st}", f"expected race groups 1-6, found {sorted(races[st])}", geo_id=state_geo(st)
            )
            continue
        for y in years:
            ages = acc[st][y]
            if sorted(ages) != list(range(0, 86)):
                yield Rejected(
                    f"STATE={st} POPESTIMATE{y}", "single-year ages 0..85 incomplete", geo_id=state_geo(st)
                )
                continue
            for measure, cut in AGE_CUTS.items():
                v = sum(n for a, n in ages.items() if a >= cut)
                yield _row(
                    asset,
                    state_geo(st),
                    measure,
                    y,
                    v,
                    f"sum SUMLEV=040,STATE={st},SEX=0,ORIGIN=0,RACE=1..6,AGE>={cut} (85=85+),column POPESTIMATE{y}",
                    code="POPESTIMATE",
                )
