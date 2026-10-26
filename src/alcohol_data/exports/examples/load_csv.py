"""Read the release CSVs with only the Python standard library.

Usage (after unzipping csv.zip next to this file):
    python load_csv.py path/to/alcohol-policy-revenue-data-<version>-csv

Prints Utah and Tennessee apparent wine consumption (gallons of ethanol per
resident age 21+, NIAAA) and Census T10 alcohol taxes for the same years.
Geographic IDs are read as text so state FIPS codes keep their leading zero.
"""

import csv
import sys
from pathlib import Path

folder = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(".")
rows = []
with open(folder / "state_year_long.csv", encoding="utf-8", newline="") as f:
    for r in csv.DictReader(f):
        if (
            r["state"] in ("UT", "TN")
            and r["measure_id"]
            in (
                "niaaa_ethanol_per_capita_21plus_wine",
                "stc_alcoholic_beverages_sales_tax",
            )
            and 2010 <= int(r["year"]) <= 2024
        ):
            rows.append(r)

for r in sorted(rows, key=lambda r: (r["measure_id"], r["state"], r["year"])):
    value = r["value"] if r["value"] != "" else f"missing ({r['missing_reason']})"
    print(f"{r['measure_id']:<45} {r['state']} {r['period_label']:<22} {value:>18} {r['unit']}")

print()
print("Note: NIAAA values are calendar years; Census T10 values are state fiscal years.")
print("They are different periods and different concepts (sales-based consumption vs. tax receipts).")
