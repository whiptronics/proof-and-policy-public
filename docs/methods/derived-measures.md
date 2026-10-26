# Derived measures

Code: `src/alcohol_data/transforms/derive.py`. Every derived value has `estimate_type = derived`,
`asset_id = project_derivations`, and a `lineage` row listing the exact observation IDs used.

| Measure | Formula | Inputs | Missing when |
|---|---|---|---|
| `stc_alcoholic_beverages_sales_tax_per_capita` | T10 / population | preferred T10 for the state fiscal year; preferred Census July 1 total population for the July 1 inside that fiscal year | T10 missing, or no Census July 1 estimate |
| `stc_alcoholic_beverages_sales_tax_per_resident_21plus` | T10 / population 21+ | as above with the 21+ population | as above (no 21+ before 2000) |
| `stc_alcoholic_beverages_sales_tax_real_cy2024usd` | T10 x CPI(2024 average) / CPI(fiscal-year average) | T10; the 12 monthly CPI-U values covering the state's fiscal year; the 12 months of 2024 | any of those 24 months missing |

Derivations run for state fiscal years that contain a July 1 from 1990 onward (the population coverage).
NIAAA's calendar-year denominators are never used for these ratios, and no age universe is mixed. The
deflator is matched to the fiscal year's months, not approximated by a calendar-year average.
