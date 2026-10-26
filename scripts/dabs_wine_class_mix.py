"""Which wines the model counts, from DABS's twelve FY2026 monthly Sales Analysis Reports (data/raw).

The grocery-wine model's "wine" is every DABS class that metadata/dabs_class_beverage_map.csv maps to wine. A bill
could cover fewer (still table wine only) or more (Utah Code § 32B-1-102(143) counts hard cider as wine; the map keeps
cider apart). This script sums each month's item-level gross sales by class and prints wine's share of all sales and
the composition of wine, so the scope sensitivity on the Utah initiative page (web/src/lib/initiatives.ts, wineMix)
can be reproduced. Item rows only; the report's own total is checked against the sum.

    python scripts/dabs_wine_class_mix.py

Values are parsed from the reports, not reviewed by a person. Whether the reports' shelf prices include sales tax is
unresolved; a share is unaffected only if wine's sales carry the same embedded tax rate as the average sale, for
example when no tax is included, every sale carries the same rate, or wine's customer mix matches the average (see the
technical appendix).
"""

from __future__ import annotations

import csv
import glob
from collections import Counter
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
# Class-code letters within the wine group: still table wine (red P, white K, rose and blush M, small packages R),
# sparkling (I), fortified and aromatized (E), fruit wine, sangria and sake (G), allocated and offers (L), gift sets
# and special orders (Y).
STILL_TABLE = {"P", "K", "M", "R"}
GROUPS = {
    "P": "red",
    "K": "white",
    "M": "rose, blush, orange",
    "R": "small-package still",
    "I": "sparkling",
    "E": "fortified and aromatized",
    "G": "fruit wine, sangria, sake",
    "L": "allocated and offers",
    "Y": "gift sets and special orders",
}


def month_totals(path: str) -> tuple[Counter, Counter, float]:
    ws = openpyxl.load_workbook(path, read_only=True, data_only=True).worksheets[0]
    ws.reset_dimensions()
    with open(ROOT / "metadata/dabs_class_beverage_map.csv", encoding="utf-8") as f:
        beverage = {r["class_code"]: r["beverage_group"] for r in csv.DictReader(f)}
    by_group: Counter = Counter()
    by_letter: Counter = Counter()
    header_total = 0.0
    col: dict[str, int] | None = None
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if col is None:
            if i == 1:
                # the report's gross-sales total, above the first "Total" column
                header_total = float(row[8] or 0)
            if row and "Class Code" in row:
                col = {}
                for j, v in enumerate(row):
                    if v and v not in col:  # the first "Total" is gross sales; the second is 9-litre cases
                        col[v] = j
            continue
        cc, item, total = row[col["Class Code"]], row[col["Item Code"]], row[col["Total"]]
        if not cc or item in (None, "") or not isinstance(total, (int, float)):
            continue
        group = beverage.get(cc, "unmapped")
        by_group[group] += total
        if group == "wine":
            by_letter[cc[0]] += total
    return by_group, by_letter, header_total


def main() -> None:
    groups: Counter = Counter()
    letters: Counter = Counter()
    header = 0.0
    files = sorted(glob.glob(str(ROOT / "data/raw/utah_dabs_sales_analysis_fy2026_p*/*.xlsx")))
    assert len(files) == 12, f"expected twelve FY2026 reports, found {len(files)}"
    for f in files:
        by_group, by_letter, h = month_totals(f)
        groups += by_group
        letters += by_letter
        header += h
    total = sum(groups.values())
    assert abs(total - header) < 1.0, f"item rows {total} do not add up to the reports' totals {header}"
    wine = groups["wine"]
    still = sum(v for k, v in letters.items() if k in STILL_TABLE)
    print(f"All gross sales, FY2026: ${total:,.2f}")
    print(f"Wine classes: ${wine:,.2f} ({wine / total:.4%} of all sales)")
    print(
        f"Hard cider (outside the model's wine): ${groups['cider']:,.2f} ({groups['cider'] / wine:.2%} of wine)"
    )
    print(f"Still table wine: ${still:,.2f} ({still / wine:.2%} of wine)")
    for k in sorted(letters, key=lambda k: -letters[k]):
        print(f"  {k} {GROUPS.get(k, '?'):<30} ${letters[k]:>16,.2f}  {letters[k] / wine:7.2%}")


if __name__ == "__main__":
    main()
