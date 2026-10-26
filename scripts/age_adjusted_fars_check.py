"""Does age adjustment change what a state's traffic death rate says? An exploration, not a dataset build.

Reads two sets of pinned files that are already in data/raw:

* FARS person files (data/raw/fars_national_<year>): fatal injuries (INJ_SEV 4) by state and age;
* Census PEP state estimates by single year of age (sc-est2020int-alldata6 for 2010-2019, sc-est2025-alldata6
  for 2020 on), summed over race for both sexes and all origins.

and prints, for each year asked for, every state's crude traffic death rate per 100,000 residents, its
age-adjusted rate (year 2000 U.S. standard, Fay-Feuer interval; see alcohol_data/age_adjust.py) and the rank of
each. Nothing is written to the dataset: the result is a reason to decide whether the plan in
docs/plans/denominators-and-deflators.md is worth building, and it can be re-run to check any later claim.

Checks it makes and reports: the person file's fatal-injury count against the sum of FATALS in ACCIDENT.CSV for
every state (they should be equal), and the share of deaths of unknown age (spread in proportion across the
known groups).

    python scripts/age_adjusted_fars_check.py --years 2013 2019 2022 [--csv out.csv]
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import sys
import zipfile
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from alcohol_data import age_adjust as aa  # noqa: E402

RAW = ROOT / "data" / "raw"
UNKNOWN_AGE = {998, 999}


def pinned(asset_dir: str, pattern: str) -> Path:
    hits = sorted((RAW / asset_dir).glob(pattern))
    if not hits:
        raise SystemExit(f"no file {pattern} in {asset_dir}")
    return hits[0]


def rows_of(z: zipfile.ZipFile, name: str):
    """DictReader over a FARS member; some years start with a byte-order mark, which is stripped from the first heading."""
    reader = csv.DictReader(io.TextIOWrapper(z.open(name), encoding="latin-1", newline=""))
    reader.fieldnames = [h.replace("\u00ef\u00bb\u00bf", "").lstrip("\ufeff").strip() for h in (reader.fieldnames or [])]
    return reader


def fars(year: int):
    """(fatal injuries by state and five-year age group, unknown-age deaths by state, FATALS by state)."""
    z = zipfile.ZipFile(pinned(f"fars_national_{year}", "*.zip"))
    names = {n.lower().split("/")[-1]: n for n in z.namelist()}
    by_group: dict[str, list[float]] = defaultdict(lambda: [0.0] * len(aa.GROUPS))
    unknown: dict[str, float] = defaultdict(float)
    for r in rows_of(z, names["person.csv"]):
        if r["INJ_SEV"].strip() != "4":
            continue
        st = f"state:{int(r['STATE']):02d}"
        age = int(r["AGE"])
        if age in UNKNOWN_AGE:
            unknown[st] += 1
        else:
            by_group[st][aa.five_year_group(age)] += 1
    fatals: dict[str, int] = defaultdict(int)
    for r in rows_of(z, names["accident.csv"]):
        fatals[f"state:{int(r['STATE']):02d}"] += int(r["FATALS"])
    return by_group, unknown, fatals


def pep(year: int):
    """State population by five-year age group, July 1, both sexes, all origins, all races."""
    if year >= 2020:
        path, col = pinned("census_pep_v2025_alldata6", "*.csv"), f"POPESTIMATE{year}"
    else:
        path, col = pinned("census_pep_icen_2010s_alldata6", "*.csv"), f"POPESTIMATE{year}"
    out: dict[str, list[float]] = defaultdict(lambda: [0.0] * len(aa.GROUPS))
    with open(path, encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            if r["SUMLEV"] != "040" or r["SEX"] != "0" or r["ORIGIN"] != "0":
                continue
            out[f"state:{int(r['STATE']):02d}"][aa.five_year_group(int(r["AGE"]))] += float(r[col])
    return out


def rank_desc(values: dict[str, float]) -> dict[str, int]:
    order = sorted(values, key=lambda k: -values[k])
    return {k: i + 1 for i, k in enumerate(order)}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--years", type=int, nargs="+", default=[2013, 2019, 2022])
    ap.add_argument("--csv", type=Path)
    args = ap.parse_args()
    rows = []
    for year in args.years:
        deaths, unknown, fatals = fars(year)
        pop = pep(year)
        results = {}
        for st in sorted(set(deaths) & set(pop)):
            known = sum(deaths[st])
            unk = unknown.get(st, 0.0)
            if known + unk != fatals.get(st, -1):
                print(f"  check: {year} {st}: person file {known + unk:.0f} fatal injuries, ACCIDENT FATALS {fatals.get(st)}", file=sys.stderr)
            d = aa.spread_unknown(deaths[st], unk) if known > 0 else deaths[st]
            results[st] = (aa.age_adjust(d, pop[st]), unk / (known + unk) if known + unk else 0.0)
        crude_rank = rank_desc({s: r.crude for s, (r, _) in results.items()})
        adj_rank = rank_desc({s: r.rate for s, (r, _) in results.items()})
        for st, (r, unk_share) in sorted(results.items()):
            rows.append(
                {
                    "year": year,
                    "geo_id": st,
                    "deaths": int(r.deaths),
                    "unknown_age_share": round(unk_share, 4),
                    "population": int(r.population),
                    "crude_per_100k": round(r.crude, 2),
                    "age_adjusted_per_100k": round(r.rate, 2),
                    "ci_low": round(r.ci_low, 2),
                    "ci_high": round(r.ci_high, 2),
                    "crude_rank": crude_rank[st],
                    "adjusted_rank": adj_rank[st],
                }
            )
    cols = list(rows[0])
    out = csv.DictWriter(sys.stdout, fieldnames=cols, lineterminator="\n")
    out.writeheader()
    out.writerows(rows)
    if args.csv:
        with open(args.csv, "w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=cols, lineterminator="\n")
            w.writeheader()
            w.writerows(rows)
    meta = {
        "standard": aa.STANDARD_NAME,
        "method": aa.AGE_ADJUST_METHOD,
        "fars": {y: json.loads(next((RAW / f"fars_national_{y}").glob("*.meta.json")).read_text())["sha256"] for y in args.years},
    }
    print("# " + json.dumps(meta), file=sys.stderr)


if __name__ == "__main__":
    main()
