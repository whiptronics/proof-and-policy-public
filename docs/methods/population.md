# Population methods

Source: Census Bureau Population Estimates Program. Adapter: `src/alcohol_data/adapters/census_pep.py`.

| Series | File(s) | Years (July 1) | Ages | Preference |
|---|---|---|---|---|
| Intercensal 1990-2000 | `stch-icen1990..1999.txt` | 1990-1999 | all ages only (5-year groups) | 20 |
| Intercensal 2000-2010 | `st-est00int-agesex.csv` | 2000-2010 | single years, 85 = 85+ | 20 |
| Intercensal 2010-2020 | `sc-est2020int-alldata6.csv` | 2010-2019 | single years | 30 |
| Vintage 2025 | `sc-est2025-alldata6.csv` | 2020-2025 | single years | 20 |

- **Age universes.** 14+, 18+ and 21+ are sums of single years of age (85+ included). They are separate
  measures and are never substituted for one another.
- **State totals for the 1990s** are sums of all county rows for the state in the intercensal
  characteristics file (flagged `aggregated_from_county_rows`). Five-year age groups (15-19, 20-24)
  straddle 18 and 21, so no age-specific 1990s denominators are produced.
- **Leading zeros.** The 2000s file publishes state codes without leading zeros ("1" = Alabama); the
  adapter pads them. CSV exports keep them.
- **Vintages are not spliced silently.** The 1990s postcensal files (with 18+ and 21+) are not loaded
  because they disagree with the intercensal series by up to several percent (Utah 1999: 2,133,658
  postcensal Vintage 2000 vs 2,203,482 intercensal).
- **Overlap.** July 1, 2010 appears in both the 2000s and 2010s intercensal files (Utah: 2,776,469 vs
  2,776,212). Both are stored; the 2010-2020 series is preferred because it is consistent with the 2020
  census.
- **Boundary vintage.** State boundaries are stable over the period; `boundary_vintage = current`.
