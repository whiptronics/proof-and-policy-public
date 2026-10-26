"""NIAAA apparent per capita alcohol consumption data file (pcyr1970-YYYY.txt).

The file header documents a fixed-width layout, but the population fields are
one column wider than documented (e.g. columns 32-41, not 32-40), so slicing at
the documented positions truncates every population. Each data line has exactly
14 whitespace-separated tokens with '.' for missing; this adapter parses tokens,
rejects any line that does not have 14, and checks that the published per
capita value equals ethanol / population to within rounding.
"""

from __future__ import annotations

import re
from datetime import date
from functools import partial
from pathlib import Path

from alcohol_data.adapters.base import NATION, Rejected, Staged, region_geo, register, state_geo
from alcohol_data.config import AssetConfig

BEVERAGES = {"1": "spirits", "2": "wine", "3": "beer", "4": "all"}
REGIONS = {"91": 1, "92": 2, "93": 3, "94": 4}  # NIAAA region codes -> Census regions (same membership)
DATA_LINE = re.compile(r"^\d{4} ")
FIELDS = (
    "year",
    "geo",
    "bev",
    "gal_beverage",
    "gal_ethanol",
    "pop14",
    "pc14",
    "decile14",
    "pop21",
    "pc21",
    "decile21",
    "source_type",
    "abv_tv",
    "gal_ethanol_tv",
)
SOURCE_TYPES = {
    "1": "state_monthly_sales_volume",
    "2": "state_monthly_sales_tax",
    "3": "state_annual_sales_volume",
    "4": "state_annual_sales_tax",
    "5": "nabca_monthly_sales_volume",
    "6": "nabca_annual_sales_volume",
    "7": "industry",
}


def _num(tok: str) -> float | None:
    return None if tok == "." else float(tok)


def _geo(code: str) -> str | None:
    if code == "99":
        return NATION
    if code in REGIONS:
        return region_geo(REGIONS[code])
    if code.isdigit() and 1 <= int(code) <= 56:
        return state_geo(code.zfill(2))
    return None


def _row(
    ctx, measure, value, raw, mult, unit, code, *, missing=None, extra_flags=(), est="reported_count"
) -> Staged:
    return Staged(
        geo_id=ctx["geo"],
        measure_id=measure,
        period_start=ctx["start"],
        period_end=ctx["end"],
        period_kind="calendar_year",
        period_label=str(ctx["year"]),
        year=ctx["year"],
        value=value,
        missing_reason=missing if value is None else None,
        source_locator=f"{ctx['loc']}, field {code}",
        estimate_type=est,
        extraction_method="fixed_width_parser",
        comparability_group=f"niaaa_apparent_consumption|{measure}",
        quality_flags=ctx["flags"] + list(extra_flags),
        source_code=code,
        raw_value=raw,
        raw_unit=unit,
        multiplier=mult,
        extra=ctx["extra"],
    )


@register("niaaa_pcyr", "1.0")
def parse(asset: AssetConfig, path: Path):
    text = path.read_text(encoding="latin-1")
    edition = asset.source_vintage
    pop_seen: set[tuple[str, int]] = set()
    for lineno, line in enumerate(text.splitlines(), start=1):
        if not DATA_LINE.match(line):
            continue
        toks = line.split()
        loc = f"line {lineno}"
        if len(toks) != 14:
            yield Rejected(loc, f"expected 14 tokens, found {len(toks)}", raw_value=line[:90])
            continue
        f = dict(zip(FIELDS, toks, strict=True))
        year = int(f["year"])
        geo = _geo(f["geo"])
        bev = BEVERAGES.get(f["bev"])
        if geo is None or bev is None:
            yield Rejected(loc, f"unknown geography {f['geo']} or beverage {f['bev']}", raw_value=line[:90])
            continue
        start, end = date(year, 1, 1), date(year, 12, 31)
        extra = {
            "decile_14plus": f["decile14"] if f["decile14"] != "." else None,
            "decile_21plus": f["decile21"] if f["decile21"] != "." else None,
            "data_source_type": SOURCE_TYPES.get(f["source_type"]) if f["source_type"] != "." else None,
        }
        flags = []
        eth, pop14, pc14 = _num(f["gal_ethanol"]), _num(f["pop14"]), _num(f["pc14"])
        if eth is not None and pop14 and pc14 is not None and abs(eth / pop14 * 10000 - pc14) > 0.51:
            flags.append("per_capita_inconsistent_with_components")

        ctx = {
            "geo": geo,
            "start": start,
            "end": end,
            "year": year,
            "loc": loc,
            "flags": flags,
            "extra": extra,
        }
        row = partial(_row, ctx)

        # Beverage gallons are not published for "all beverages" (would add unlike volumes).
        if bev != "all":
            v = _num(f["gal_beverage"])
            yield row(
                f"niaaa_beverage_gallons_{bev}",
                v,
                f["gal_beverage"],
                1.0,
                "us_gallons",
                "gallons_of_beverage",
                missing="not_published",
            )
        v = _num(f["gal_ethanol"])
        yield row(
            f"niaaa_ethanol_gallons_{bev}",
            v,
            f["gal_ethanol"],
            1.0,
            "us_gallons_ethanol",
            "gallons_of_ethanol",
            missing="not_published",
        )
        for tok, age in (("pc14", "14plus"), ("pc21", "21plus")):
            raw = f[tok]
            v = _num(raw)
            yield row(
                f"niaaa_ethanol_per_capita_{age}_{bev}",
                None if v is None else v / 10000.0,
                raw,
                0.0001,
                "us_gallons_ethanol_per_person_x10000",
                f"gallons_ethanol_per_capita_age_{age}",
                missing="not_published",
            )
        abv = _num(f["abv_tv"])
        if bev != "all":
            yield row(
                f"niaaa_time_varying_abv_{bev}",
                None if abv is None else abv / 1000.0,
                f["abv_tv"],
                0.001,
                "abv_x1000",
                "time_varying_abv",
                missing="not_published",
            )
        tv = _num(f["gal_ethanol_tv"])
        yield row(
            f"niaaa_ethanol_gallons_time_varying_abv_{bev}",
            tv,
            f["gal_ethanol_tv"],
            1.0,
            "us_gallons_ethanol",
            "gallons_of_ethanol_time_varying_abv",
            missing="not_published",
        )

        # NIAAA's own denominators, kept as a separate calendar-year series of the population measures.
        key = (geo, year)
        if key not in pop_seen:
            pop_seen.add(key)
            for tok, measure, code in (
                ("pop14", "pop_age14plus_resident", "population_age_14_plus"),
                ("pop21", "pop_age21plus_resident", "population_age_21_plus"),
            ):
                v = _num(f[tok])
                r = row(
                    measure, v, f[tok], 1.0, "persons", code, missing="not_published", est="official_estimate"
                )
                r.comparability_group = f"niaaa_denominator|{edition}"
                r.extra = None
                yield r
