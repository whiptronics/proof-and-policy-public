# Better denominators and deflators (plan; one part built, three blocked on downloads)

Requested 2026-10-12 as item 15 of the statistical-approximations pass. Nothing here changes the dataset yet.
The rates and real-dollar values in the dataset use two stand-ins: **residents** as the denominator for
traffic deaths, and the **national all-items CPI-U** as the deflator for every state's dollars. Both are
wrong in known directions. This note says what would replace them, what was done, what is blocked, and what
the one analysis that could be run says.

## Status

| Part | Replaces | Status |
|---|---|---|
| A. Age-adjusted death rates | crude per-resident rates | statistics written and tested (`src/alcohol_data/age_adjust.py`); **explored on pinned FARS and Census files and found to matter little** (below); not wired into the dataset |
| B. Deaths per 100 million vehicle miles | deaths per 100,000 residents | blocked: FHWA files not reachable from the session that wrote this |
| C. State price levels (BEA regional price parities, real personal income) | nominal state income and spending read side by side | blocked: BEA SARPP and SARPI files not reachable |
| D. An alcohol price index | all-items CPI-U as the deflator for alcohol dollars | blocked: BLS API not reachable |

"Not reachable" means HTTPS to fhwa.dot.gov, bea.gov, bls.gov, cdc.gov and census.gov was refused from both
the cloud workspace and the linked computer's shell on 2026-10-12 (only the package index answered; WebFetch
reached a few state statute pages, which is not a route to pinned files). The project's rule is that a value
enters only from a pinned file with a hash, so nothing was typed in from memory or from a web summary.

## A. Age-adjusted rates

**Statistics.** `alcohol_data.age_adjust`: direct standardization to the year 2000 U.S. standard population
(18 five-year groups, the standard behind the age-adjusted rates already loaded from CDC Chronic Disease
Indicators), variance from Poisson age-group counts, Fay-Feuer (1997) gamma interval, deaths of unknown age
shared across known groups in proportion. 18 tests, checked against an independent scipy calculation to
12 digits.

**Exploration.** `scripts/age_adjusted_fars_check.py` reads the pinned FARS person files (fatal injuries,
INJ_SEV 4, by state and age) and Census PEP single-year-of-age estimates (sc-est2020int-alldata6 for 2010-2019,
sc-est2025-alldata6 for 2020 on; both sexes, all origins, all races). Inputs are pinned (FARS 2013
`9c34182f...`, 2019 `0974abb9...`, 2022 `989448d7...`). The person-file count of fatal injuries equals the
accident file's FATALS for every state in all three years. Results for the 51 jurisdictions:

| Year | Rank correlation, crude vs adjusted | Median change in rate | Utah crude -> adjusted per 100,000 (95% interval) | Utah rank, crude -> adjusted |
|---|---|---|---|---|
| 2013 | 0.997 | 2.3% | 7.56 -> 8.28 (7.20 to 9.49) | 42 -> 37 |
| 2019 | 0.998 | 3.1% | 7.67 -> 7.96 (6.99 to 9.05) | 40 -> 38 |
| 2022 | 0.996 | 2.6% | 9.40 -> 9.53 (8.49 to 10.66) | 42 -> 41 |

Reading: Utah's crude rate understates its age-adjusted rate, by about 10% in 2013 and 1-4% in 2019 and 2022,
because the state is young. That is smaller than the chance variation in a year's count, and no state moves
more than five places. **Decision recorded:** do not add an age-adjusted FARS measure now. If it is wanted
later, the build is: (1) FARS person-file adapter emitting deaths by age group (new measure, `subgroup` =
age group; the dashboard export must exclude non-`all` subgroups from the metric files); (2) the four PEP
adapters emitting five-year age-group populations; (3) a derived rate measure named for its standard
(`..._age_adjusted_us2000_per_100k`) with `ci_low`/`ci_high` from `age_adjust`. This is large for a change
the numbers say is small.

## B. Vehicle miles traveled (the denominator that matters more)

Deaths per resident mixes how much people drive with how dangerous driving is. FHWA's state vehicle-miles
of travel (Highway Statistics, table VM-2 and the historical state VMT tables) give deaths per 100 million
vehicle miles. To do:

1. Download the state VMT table(s) for 2000 on; record the exact table names and URLs from FHWA's Highway
   Statistics page (not confirmed from here); pin with `alcohol-data import-asset` (manual import) or
   `fetch`. Record FHWA's own notes on methodology changes; each is a series break and stays one.
2. New source `fhwa_highway_statistics`, adapter emitting `fhwa_vehicle_miles_traveled` (millions of miles,
   state, calendar year, all roads). Missing stays missing.
3. Derived `fars_traffic_deaths_per_100m_vmt` in `transforms/derive.py` beside `fars_rates`, with the
   interval from the count interval (VMT treated as exact, as population is; FHWA publishes no error for it,
   and the note must say VMT is itself an estimate).
4. Tests: adapter on a small fixture from the real file's layout; derived rate and interval by hand.

## C. State price levels

BEA's regional price parities (table SARPP) compare price levels across states **within a year** (U.S. = 100).
BEA's own guidance is that they are not a time series of each state's inflation: for real income over time it
publishes real personal income (SARPI), which combines the parities with the price deflator. So the useful
addition is real personal income and real per capita personal income by state (2008 on), not a deflator for
state alcohol dollars. To do: pin SARPP.zip and SARPI.zip; adapter mirrors `bea_sapce.py` (same CSV layout,
`Last updated` release line kept); measures for the parity (all items) and for real per capita personal income;
the "real" conversion in the dashboard keeps using the CPI deflator and says so. The adapter must reject any
line it does not expect, as the SAPCE one does.

## D. An alcohol price index

The BLS CPI-U component for alcoholic beverages (U.S. city average, series id believed to be CUUR0000SAF116;
the adapter must reject any other id) would let the dashboard deflate alcohol revenue and spending by
alcohol prices instead of all prices. The existing `bls_cpi_api` adapter reads the same JSON shape, so this is
a series added to `SERIES` plus four assets in `config/sources/bls_cpi.yaml` (the keyless API allows 10 years
per request), a measure, and a second deflator key in `dashboard/transforms.py` with the choice shown on every
converted value. Regional alcohol indices (which BLS publishes for some regions and areas) would also not be
a state deflator.

## What the next session on Ethan's machine should do

1. Run `alcohol-data fetch` for the BLS series after adding it (D), and download SARPP.zip, SARPI.zip (C) and
   the FHWA tables (B) into the downloads folder; say which, and the work in B and C can start from pinned files.
2. Keep A as is unless a use for age-adjusted rates appears (for example comparing Utah with an older state).
