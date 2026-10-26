# Downloads reviewed 2026-10-09

Ethan downloaded 115 files into `../Repeal Title 32B Utah` (outside the repository; the originals were not
changed). Every file is listed, with its size, SHA-256 and what the dataset did with it, in
[`downloads-2026-10-09.csv`](downloads-2026-10-09.csv). This page summarises that list and records how
each new file was compared with what the dataset already held.

| Status | Files | Meaning |
| --- | ---: | --- |
| imported | 22 | Pinned (`alcohol-data import-asset`, which records the original file name and hash) and read by an adapter or by hand |
| already in the dataset | 4 | Byte-identical to a file already pinned: nothing new |
| documentation | 7 | Read for definitions and methods; no values taken |
| duplicate copy | 1 | A browser's second copy of another file in the folder |
| not imported | 81 | Out of scope for a state-level alcohol dataset, or kept for later; the reason is in the CSV |

## Imported

| Source | Files | What the dataset reads | Geography and periods | Unit |
| --- | ---: | --- | --- | --- |
| Utah DABS Sales Analysis Report | 16 | Gross sales and 9-liter cases by beverage type (spirits, wine, beer, cider, premixed, other, total) | Utah; months May 2025 to August 2026 (fiscal 2025 periods 11-12, all of fiscal 2026, fiscal 2027 periods 1-2) | dollars; 9-liter cases |
| CDC Chronic Disease Indicators (`export.csv`) | 1 | Alcohol topic, Overall break-out: chronic liver disease deaths (age-adjusted and crude rates, counts), adult binge drinking age-adjusted, binge frequency and intensity medians, high school drinking and binge drinking | States, DC, US; single years 2019-2023 (liver deaths 2019-2022) | per 100,000; percent; occasions; drinks |
| Census Monthly State Retail Sales (`state_retail_yy.csv`) | 1 | Percent change from a year earlier: total retail sales excluding nonstore retailers, and food and beverage stores (NAICS 445) | States, DC, US; months January 2019 to June 2026 | percent change |
| Census 2017 Economic Census (`EC1700BASIC.zip`, `EC1700COMP.zip`) | 2 | NAICS 445310 beer, wine and liquor stores: establishments and sales | US and whole states; 2012 and 2017 | establishments; dollars ($1,000 in the file) |
| BEA personal consumption expenditures by state (`SAPCE.zip`) | 1 | SAPCE3 line 28, alcohol bought for off-premises consumption | States, DC, US; calendar years 1997-2025 | dollars (millions in the file) |
| Utah State Tax Commission Publication 25 (`pub-25.pdf`) | 1 | One fact read by hand: the state's own part of the sales and use tax rate, 4.85% (page 6, Chart 2) | Utah; the publication's revision of September 2026 | percent |

Each adapter rejects rather than guesses: a DABS report whose products do not add up to its printed
totals, or that holds a class code the beverage map does not list, is rejected whole; a CDI row seen twice
for one cell is rejected; a BEA or Census line whose words or unit differ from what is expected is
rejected. Missing, suppressed and not-applicable cells are stored with their reason and never as zero:
CDI's `****` and `~`, MSRS's `S`, the Economic Census's `D` (which the files print as 0) and BEA's `(D)`
become suppressed; CDI's `##` is a reported zero. The tests in `tests/test_dabs_sales_analysis.py`,
`tests/test_cdc_cdi.py`, `tests/test_census_retail.py` and `tests/test_bea_sapce.py` cover each rule, and
each was seen to fail when its rule was removed.

## Compared with what the dataset already held

**New datasets.** DABS monthly sales by beverage, CDI liver-disease mortality and the age-adjusted binge
measures, MSRS, the Economic Census and BEA spending by state were not in the dataset before.

**Additional years.** CDI supplies high school drinking and binge drinking for 2019, 2021 and 2023; the
dataset's YRBS files end in 2017. The CDI rows carry their own comparability group, so charts break the
line between the two sources rather than joining them.

**Repeated values (duplicates).** Four files are byte-identical to pinned files (DABS annual report
FY2025, NIAAA's 1970-2024 data file, BEA SAINC, the Census STC database); the STC zip's spreadsheet is the
same file again. Two CDI items repeat sources the dataset already holds and were loaded at a lower priority
(5, against 20 for the original publishers) so the originals stay preferred:

- adult binge drinking (crude), from BRFSS: check `reconcile_cdi_vs_brfss_binge` finds 0 of 251 shared
  cells more than 0.1 point apart;
- per capita consumption ages 14+, from NIAAA: check `compare_cdi_vs_niaaa_per_capita` lists 22 cells
  more than 5% apart (for example California 2021, 2.72 in CDI against 2.84 in NIAAA's current file). CDI
  appears to repeat an earlier NIAAA edition, rounded; NIAAA's own figures are preferred.

**Revisions.** No value was overwritten. Every file is a separate pinned asset; where two candidates
exist for one cell, the higher-priority one is preferred and both stay in the database, and differing
candidates of equal priority are flagged as conflicts. BEA's release line ("Last updated: ...") is stored
with every BEA value, because each BEA release revises earlier years. The MSRS file is one vintage (data
through June 2026); a later file may revise earlier months and would be pinned as a new asset.

**Internal arithmetic.** DABS monthly beverage groups add up to each report's printed total in all 16
months (`reconcile_dabs_monthly_beverages_sum_to_total`); the two Economic Census files agree on 2017
(`reconcile_economic_census_2017_files`, 0 of 104 cells differ); BEA's states add up to the US within
rounding in every year (`reconcile_bea_alcohol_spending_states_sum_to_us`).

## Checked against the original files

| Value | Original | Dataset |
| --- | --- | --- |
| Utah, retail sales change, June 2026 (MSRS) | 7.5 (also on the Census map) | 7.5 |
| Alaska, Louisiana, Wyoming, DC, June 2026 (MSRS) | -7.6, 11.3, 4.3, 0.2 | the same |
| Utah, off-premises alcohol spending 2024 (BEA) | $1,455.2 million | $1,455,200,000 |
| Tennessee, the same | $3,721.1 million | $3,721,100,000 |
| Pennsylvania, NAICS 445310 sales 2017 / 2012 (Economic Census) | $3,352,946K / $2,987,219K | $3,352,946,000 / $2,987,219,000 |
| Utah, NAICS 445310 sales 2017 and 2012 | withheld (D) | suppressed, no value |
| Utah, chronic liver disease deaths, age-adjusted, 2019-2022 (CDI) | 8.8, 10.3, 11.6, 10.3 | the same |
| Utah, high school students who drank, 2019 / 2021 / 2023 (CDI) | 10.0 / 8.1 / 6.4 | the same |
| Utah, DABS gross sales FY2026, all products (sum of 12 reports) | $543,682,177.59 | $543,682,177.59 |
| of which wine / spirits | $182,331,954.71 / $302,995,274.82 | the same |
| Utah, DABS wine FY2026, 9-liter cases | 1,291,694.77 | the same |
| Utah, state sales and use tax rate (Publication 25, page 6) | 4.85% | 4.85 |

## Not imported, and why

- **National accounts** (32 NIPA section workbooks, the Q2 2026 GDP release and its source files): national
  only. The dataset's state spending measure comes from SAPCE.
- **County tables** (12 CAGDP and CAINC zips): the dataset is state level.
- **Other state tables** (SAGDP, SAGDP_SIC, SQGDP, SQINC, SASUMMARY): GDP, quarterly income and headline
  totals that the current tools do not use; candidates if a comparison later needs GDP.
- **Regional price parities** (SARPP, MARPP, PARPP): could put dollar amounts on a common price level
  across states. Not used yet, so no tool implies it.
- **Territories** (TASUMMARY, PRGDP): outside the dataset's panel of states, DC and the US.
- **2022 Economic Census First Look** (20 sector files) and **2017 franchise statistics**: national
  totals only, and the First Look figures are preliminary.
- **CDI map layers** (`export.kml`, `export.kmz`): the same dataset with a point per location; the CSV was
  imported instead.

## Waiting on a decision

- **CDI licence.** data.cdc.gov gives the Chronic Disease Indicators' licence as the Open Database License
  (checked 2026-10-09). The source carries a `release_gate`, so `alcohol-data package` refuses to build a
  release containing it until Ethan decides; local builds and the dashboard are unaffected.
- **Publication 25 is marked "draft pending public meeting"** on every page. The 4.85% figure is flagged
  `draft_publication` and labelled as a draft wherever it is shown.
