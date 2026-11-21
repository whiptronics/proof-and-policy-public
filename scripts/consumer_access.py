"""How far Utahns live from a place that sells wine today, and from a grocery store.

Writes web/src/lib/consumerAccess.generated.ts from three pinned sources:
  - DABS's store locator: every state liquor store and package agency it lists, with the hours DABS posts;
  - USDA's SNAP retailer locations: Utah stores of FNS types Supermarket, Super Store and Grocery Store;
  - the 2020 Census centers of population by block group (population and a point for each of Utah's block groups).

Distance is straight-line (great-circle) miles from each block group's center of population to the nearest store,
weighted by the block group's population. Travel distance, travel time and store hours other than DABS's are not
measured. A grocery store that does not accept SNAP is missing; so is a package agency the locator does not list.

Run:  python -B scripts/consumer_access.py          (write the file)
      python -B scripts/consumer_access.py --check  (exit 1 if the committed file differs)
The raw files are found under ALCOHOL_DATA_HOME/data/raw (default: this checkout).
"""

from __future__ import annotations

import csv
import json
import math
import re
import statistics
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from alcohol_data.paths import RAW_DIR  # noqa: E402

OUT = ROOT / "web" / "src" / "lib" / "consumerAccess.generated.ts"
STATE_STORES = "utah_dabs_state_stores_2026_11"
AGENCIES = "utah_dabs_package_agencies_2026_11"
SNAP = "usda_snap_retailers_ut_grocery_2026_11"
CENPOP = "census_cenpop2020_bg_ut"
LOCATOR_LIMIT = 100  # the max_results each locator request asks for
GROCERY_TYPES = ("Supermarket", "Super Store", "Grocery Store")
THRESHOLDS = (1, 3, 5, 10, 20)
DAYS = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
UTAH_BOX = (36.9, 42.1, -114.1, -109.0)  # lat min, lat max, lng min, lng max (a check, not a boundary)


def _one(raw: Path, asset: str) -> Path:
    files = [p for p in (raw / asset).iterdir() if not p.name.endswith(".meta.json")]
    if len(files) != 1:
        raise FileNotFoundError(f"{asset}: expected one file in {raw / asset}, found {len(files)}")
    return files[0]


def _in_utah(lat: float, lng: float, what: str) -> tuple[float, float]:
    if not (UTAH_BOX[0] <= lat <= UTAH_BOX[1] and UTAH_BOX[2] <= lng <= UTAH_BOX[3]):
        raise ValueError(f"{what}: ({lat}, {lng}) is outside Utah")
    return lat, lng


def weekly_hours(hours_html: str) -> tuple[float, bool]:
    """Hours open a week and whether the store opens on Sunday, from the locator's hours table."""
    cells = dict(re.findall(r"<td>(\w+day)</td>\s*<td>(.*?)</td>", hours_html, re.S))
    if set(cells) != set(DAYS):
        raise ValueError(f"hours table lists {sorted(cells)}, not the seven days")
    total = 0.0
    for day in DAYS:
        times = re.findall(r'datetime="(\d\d):(\d\d)"', cells[day])
        if len(times) % 2:
            raise ValueError(f"{day}: an opening time without a closing time")
        for (h1, m1), (h2, m2) in zip(times[::2], times[1::2], strict=True):
            total += (int(h2) * 60 + int(m2) - int(h1) * 60 - int(m1)) / 60
    sunday = bool(re.search(r"datetime=", cells["Sunday"]))
    return total, sunday


def dabs(raw: Path, asset: str) -> list[dict]:
    rows = json.loads(_one(raw, asset).read_text(encoding="utf-8"))
    if not rows or len(rows) >= LOCATOR_LIMIT:
        raise ValueError(f"{asset}: {len(rows)} records; at the request's limit the list may be cut short")
    out = []
    for r in rows:
        hours, sunday = weekly_hours(r["hours"])
        out.append(
            {"pt": _in_utah(float(r["lat"]), float(r["lng"]), r["store"]), "hours": hours, "sunday": sunday}
        )
    return out


def grocery(raw: Path) -> list[dict]:
    payload = json.loads(_one(raw, SNAP).read_text(encoding="utf-8"))
    if payload.get("exceededTransferLimit"):
        raise ValueError(f"{SNAP}: the response says records were left out")
    out = []
    for f in payload["features"]:
        a = f["attributes"]
        if a["Store_Type"] not in GROCERY_TYPES:
            raise ValueError(f"{SNAP}: unexpected store type {a['Store_Type']!r}")
        out.append({"pt": _in_utah(a["Latitude"], a["Longitude"], a["Store_Name"]), "type": a["Store_Type"]})
    return out


def blocks(raw: Path) -> list[tuple[int, tuple[float, float]]]:
    with _one(raw, CENPOP).open(encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    if any(r["STATEFP"] != "49" for r in rows):
        raise ValueError(f"{CENPOP}: a block group outside Utah")
    return [(int(r["POPULATION"]), (float(r["LATITUDE"]), float(r["LONGITUDE"]))) for r in rows]


def miles(a: tuple[float, float], b: tuple[float, float]) -> float:
    la1, lo1, la2, lo2 = map(math.radians, (*a, *b))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * 3958.8 * math.asin(math.sqrt(h))


def summary(dist: list[tuple[int, float]]) -> dict:
    """Population-weighted median and mean distance, and the share of people within each threshold."""
    total = sum(p for p, _ in dist)
    acc, median = 0, None
    for p, d in sorted(dist, key=lambda x: x[1]):
        acc += p
        if median is None and acc * 2 >= total:
            median = d
    return {
        "median": round(median, 2),
        "mean": round(sum(p * d for p, d in dist) / total, 2),
        "within": [round(sum(p for p, d in dist if d <= t) / total, 4) for t in THRESHOLDS],
    }


def measure(raw: Path = RAW_DIR) -> dict:
    stores, agencies, groc, bgs = dabs(raw, STATE_STORES), dabs(raw, AGENCIES), grocery(raw), blocks(raw)
    kinds = {
        "stateStore": [s["pt"] for s in stores],
        "dabsOutlet": [s["pt"] for s in stores + agencies],
        "grocery": [g["pt"] for g in groc],
        "supermarket": [g["pt"] for g in groc if g["type"] != "Grocery Store"],
    }
    near = {k: [(p, min(miles(c, s) for s in pts)) for p, c in bgs] for k, pts in kinds.items()}
    pop = sum(p for p, _ in bgs)
    closer = sum(p for (p, g), (_, d) in zip(near["grocery"], near["dabsOutlet"], strict=True) if g < d)
    far = [(p, g) for (p, g), (_, s) in zip(near["grocery"], near["stateStore"], strict=True) if s > 10]
    return {
        "population": pop,
        "blockGroups": len(bgs),
        "outlets": {
            "stateStores": len(stores),
            "packageAgencies": len(agencies),
            "grocery": len(groc),
            "groceryByType": {t: sum(g["type"] == t for g in groc) for t in GROCERY_TYPES},
        },
        "hours": {
            "stateStoresOpenSunday": sum(s["sunday"] for s in stores),
            "agenciesOpenSunday": sum(s["sunday"] for s in agencies),
            "stateStoreWeeklyHoursMedian": statistics.median(s["hours"] for s in stores),
            "agencyWeeklyHoursMedian": statistics.median(s["hours"] for s in agencies),
        },
        "distance": {k: summary(v) for k, v in near.items()},
        "groceryCloserThanDabs": round(closer / pop, 4),
        "over10FromStateStore": {
            "people": sum(p for p, _ in far),
            "groceryWithin10": sum(p for p, g in far if g <= 10),
        },
    }


def render(m: dict) -> str:
    def ts(v) -> str:
        return re.sub(r'"(\w+)":', r"\1:", json.dumps(v, ensure_ascii=False))

    ids = ", ".join(f'"{a}"' for a in (STATE_STORES, AGENCIES, SNAP, CENPOP))
    lines = [f"  {k}: {ts(v)}," for k, v in m.items()]
    return (
        "// Generated by scripts/consumer_access.py from DABS's store locator, USDA SNAP retailer locations and the 2020\n"
        "// Census centers of population; do not edit by hand. tests/test_consumer_access.py fails when this file differs.\n"
        "export const CONSUMER_ACCESS = {\n"
        f"  sources: [{ids}],\n"
        f"  thresholds: {ts(list(THRESHOLDS))},\n" + "\n".join(lines) + "\n} as const;\n"
    )


def main(argv: list[str]) -> int:
    text = render(measure())
    if "--check" in argv:
        same = OUT.read_text(encoding="utf-8") == text
        print("consumerAccess.generated.ts " + ("matches" if same else "DIFFERS from the raw files"))
        return 0 if same else 1
    OUT.write_text(text, encoding="utf-8", newline="\n")
    print(f"wrote {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
