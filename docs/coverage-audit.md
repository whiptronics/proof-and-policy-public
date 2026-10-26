# Phase 0 coverage audit

Audit date: 2026-10-06. Auditor: Claude (AI assistant), working from the project plan
(`../../alcohol-policy-revenue-open-data-dev-plan.md`, outside this repository). Every statement below
was checked against the live source or the downloaded file on that date. The machine-readable versions are
`metadata/source_registry.csv`, `metadata/rights_registry.csv` and `metadata/coverage.csv`.

Status vocabulary: `not_investigated`, `verified_available`, `acquired`, `parsed`, `reviewed`,
`blocked_access`, `rights_unresolved`, `not_published`, `not_applicable`.

## A. Population and demographics

| Source | Status | What was found |
|---|---|---|
| Census PEP 1990-2000 intercensal (`stch-icen1990..1999.txt`) | parsed | County x 5-year age group x race-sex x origin, July 1. Summed to state totals. 5-year groups cannot give 14+/18+/21+. 10 files, 23 MB each. |
| Census PEP 1990s postcensal (`st-99-3`, `st-99-9`, `CO-2000-8`) | verified_available | Have 18+ and 21+ for 1990-1999 but are Vintage 1999/2000 postcensal: Utah 1999 is 2,133,658 in CO-2000-8 vs 2,203,482 intercensal (3.2% lower). Not loaded; splicing them with intercensal totals would mix vintages. |
| Census PEP 2000-2010 intercensal (`st-est00int-agesex.csv`) | parsed | Single year of age; state codes published without leading zeros. |
| Census PEP 2010-2020 intercensal (`sc-est2020int-alldata6.csv`) | parsed | Single year of age x 6 races x origin x sex. Preferred over the 2000s file for July 1, 2010. |
| Census PEP Vintage 2025 (`sc-est2025-alldata6.csv`) | parsed | 2020-2025. Postcensal; will be revised. |
| ACS, income, urbanization | not_investigated | Later covariates. ACS 5-year estimates are pooled periods and will be stored as such. |
| County / place / metro population | not_investigated | Needed before any Salt Lake City or county comparison. |

## B. Drinking prevalence and behavior

| Source | Status | What was found |
|---|---|---|
| BRFSS Prevalence 2011+ (data.cdc.gov `dttw-5yxu`) | parsed | State crude prevalence with 95% CIs, 2011-2025. License field: Public Domain. |
| BRFSS Prevalence 2010 and prior (`y4ft-s73h`) | parsed | 1995-2010. License field: ODC-BY 1.0 (attribution). |
| www.cdc.gov BRFSS pages (questionnaires, methodology) | blocked_access | HTTP 403 to automated requests. Needed for per-year questionnaire citations; read manually. |
| BRFSS SMART metro data (`j32a-sa6u`) | verified_available | On data.cdc.gov; not loaded (needs MMSA geography crosswalk). |
| CDC PLACES | verified_available | On data.cdc.gov. Not loaded. If added, it is flagged `modeled_small_area` and excluded from causal outcomes. |

Measure definitions change several times: binge drinking was 5+ drinks for everyone through 2005 and
5 (men) / 4 (women) from 2006; heavy drinking switched from per-day to per-week wording in 2015;
"any drinking" was a raw questionnaire item in 1995-1999 and a calculated variable from 2001. Each
definition is its own measure (`metadata/variable_crosswalks/brfss_alcohol.csv`). The "US" and "UW"
rows are medians of state estimates, not national estimates, and are not loaded.

## C. Beverage sales and apparent consumption

| Source | Status | What was found |
|---|---|---|
| NIAAA Surveillance Report #124 data file (`pcyr1970-2024_final.txt`) | parsed | 1970-2024 rows, states, regions and U.S. |
| NIAAA Surveillance Report #122 data file (`pcyr1970-2023.txt`) | parsed | Prior edition; 224 population and per capita cells were revised in #124. |

**Report vs file discrepancy (plan's verification note).** On 2026-10-06 the NIAAA index lists Report
#124 as covering 1977-2024 and says "Data for 1970-2023 from this report can be found in one data file",
but the linked file's own header says 1970 through 2024 and it contains 2024 rows. Coverage is taken
from the parsed rows: 1970-2024.

**Layout discrepancy.** The file's documented layout puts the populations in columns 32-40 and 52-60;
the actual fields are one column wider, so slicing at the documented positions truncates every
population (Utah 2016: 232,066 instead of 2,320,667). The adapter parses the 14 whitespace-separated
tokens instead and checks per capita = ethanol / population on every line (all agree within rounding).

## D. Fiscal data

| Source | Status | What was found |
|---|---|---|
| Census STC historical database (`STC-Historical-DB.xlsx`, 2025 release) | parsed | 1902-2025 (states from 1942). Thousands of dollars. No DC rows. `X` = not applicable; `-11111` = not available in early national rows. |
| Census STC FY2023-FY2025 flat files | parsed | Include DC. The "US" column excludes DC (sum of 50 states). |
| Census STC technical documentation 2025 | acquired (read) | T10 = taxes on sale of alcoholic beverages whether collected through government stores or private outlets; profits of government liquor stores are classified as liquor store revenue, not tax. |
| Utah DABS annual reports (77th-90th) | acquired (FY2024, FY2025) | PDFs; tables scramble in text extraction; transcribed by hand from rendered pages. Unaudited and internally inconsistent in FY2022, FY2024 and FY2025 (see fiscal-reconciliation.md). A second automated download the same day got HTTP 403 (robots.txt crawl delay was honored); treat as manual-download for re-checks. |
| Utah Tax Commission taxable sales, Utah Division of Finance, State Auditor | Division of Finance acquired (2026-10-14) | The FY2025 and FY2024 State of Utah ACFRs are saved and pinned (`utah_acfr_fy2025`, `utah_acfr_fy2024`). The Alcoholic Beverage Services Fund's audited sales (493,645 thousand in FY2024, equal to Census's receipts; 486,942 in FY2025), operating revenues FY2015-FY2025, expenses, school-lunch collections and the Income Tax Fund's liquor school-lunch revenue are transcribed (`ut_abs_*`, `ut_liquor_sales_allocated_school_lunch`). The school-meals deposit is documented as outside the fund's sales; the fund's FY2023-FY2024 revenue is about $16 million below DABS's figures, unexplained. The FY2022 and FY2023 ACFRs are not saved. Tax Commission taxable sales not investigated. See fiscal-reconciliation.md. |
| Tennessee Department of Revenue collections | parsed (2026-10-07) | June Summary of Collections, FY2010-FY2025, parsed from the fiscal-year-to-date page; every ALCOHOLIC BEVERAGES class sums to its printed TOTAL. Wine accounts 11002 ("Wine Tax", from FY2018 "Wine Tax & High Alcohol Beer"), 11013, 11018. No food-store account. |
| Census State Government Finances (liquor store revenue A90; expenditure E90, F90, G90) | parsed (2026-10-08) | Source `census_govfin`. The keyless IndFin historical database (`_IndFin_1967-2012.zip`, comma-delimited text) gives every state government for FY1972 and FY1977-FY2012; the yearly state-by-type files give FY2008-FY2015 and agree with it in all 425 shared cells. Not loaded: FY1942-FY1971 (Access .mdb, needs pyodbc). FY2015-FY2024 Individual Unit Files: saved by hand and imported 2026-10-12 (`census_govfin_unit_fy2015` to `_fy2024`), parsed 2026-10-13 (`census_unit_liquor_stores`); sixteen state governments with receipts every year; FY2015 bridge, FY2017 code change, FY2022 classification break and flags in fiscal-reconciliation.md. |

## E. Laws and effective dates

| Source | Status | What was found |
|---|---|---|
| NIAAA APIS | blocked_access | Homepage answered 200 but topic pages returned 403 to automated requests. Not relied on. |
| Utah Code (le.utah.gov) | acquired | Every Historical Code version (records from 2014-01-01) of 32B-1-102, 32B-4-401, 32B-4-402, 32B-11-208, 32B-11-608 and 59-15-101: 28 version files, each pinned (config/sources/utah_code_history.yaml); plus the current 32B-7-202. Version pages state their own effective and end dates. No historical versions before 2014 on the site. Server omits its intermediate TLS certificate; the fetcher verifies against the OS trust store. |
| Utah session laws 2002-2013 (le.utah.gov) | acquired | Digests of Legislation 2003-2014 (PDF), passed-bill indexes for 33 sessions (2002 S4-2013 S2), 2003 S.B. 66 (ch. 307, the 2003 beer-tax schedule), and enrolled bills: 2010 S.B. 167 (ch. 276, Title 32B, effective 2011-07-01), 2011 S.B. 12 (ch. 307), S.B. 314 (ch. 334), 2011 S2 S.B. 2002 (ch. 2), 2013 H.B. 228 (ch. 349), and three 2013 S1 bills the digest omits. Digest and index agree session by session; enrolled bills mark insertions and struck deletions, so text before and after each amendment can be read. 54 files pinned
(config/sources/utah_session_laws.yaml). Digests 2001-2002 are online but print without word spaces (not
parsed); none found for 1990-2000. |
| Title 32A to 32B recodification table (le.utah.gov, 2010) | acquired | Staff finding aid for 2010 S.B. 167: every Title 32A section in effect 2009-07-01 and the Title 32B sections it went into; parsed into metadata/legal_history/utah_title32a_crosswalk.csv. Also the outline of Title 32B. Plus the 12 enrolled 2003-2009 bills that amended the tracked sections' Title 32A predecessors. |
| Utah Code Title 32A pages, 2008 and 2010 (Internet Archive captures of le.utah.gov) | acquired | 16 captures of the Legislature's own section pages for the eight Title 32A predecessors (config/sources/utah_archived_code_pages.yaml). Every rebuilt text matches them; they supply 32A-12-202 and 32A-3-104. The Archive answered HTTP 429 or "temporarily offline" to quick successive requests; ten-second spacing worked. |
| Utah Code Annotated 1992, Title 59 ch. 15-21 (University of Utah) | acquired (manual import 2026-10-07) | Item page answers; the PDF download returns HTTP 403 with a Cloudflare challenge to automated requests. Registered for manual import (config/sources/utah_code_annotated_historical.yaml); publisher annotations, so not redistributed. |
| Utah 2019 S.B. 132 (enrolled) | acquired | Beer definition 4% ABV -> 5% ABV and beer tax $12.80 -> $13.10 per barrel, both effective 2019-11-01. |
| Tennessee 2014 Public Chapter 554 (SOS PDF) | acquired (manual import) | HTTP 403 to automated requests; downloaded in a browser by the maintainer and imported on 2026-10-06. 17 scanned pages with an OCR layer. Section 1 (new part 8, food-store wine) effective on signing; licenses begin 2016-07-01 and "prior to that date no retail food store may sell wine"; section 30 (Unfair Wine Sales Law) effective 2016-07-01; all other sections, including package-store beer sales, 2014-07-01. |
| Tennessee bill record (HB0610 / SB0837, 108th GA) | acquired | Chapter 554, signed 2014-03-20, effective dates 03/20/2014, 07/01/2014, 07/01/2016; caption describes the local referendum structure. |
| Colorado (2022 Proposition 125; 2016 SB16-197) | verified_available | 2026-10-07: filed initiative text (via search) and a Department of Revenue bulletin (HTTP 403 to an automated fetch) date wine sales by beer retailers from 2023-03-01. Not imported; post period too short for the worked example. |
| Pennsylvania (Act 39 of 2016) | verified_available | 2026-10-07: the Liquor Control Board's page dates the act 2016-06-08 (signed) and 2016-08-08 (effective), with wine-to-go permits for restaurant and hotel licensees among many other changes. Not imported. |

## F. Context

| Source | Status | What was found |
|---|---|---|
| BLS CPI-U (API v1) | parsed | Monthly 1987-2026. October 2025 is published as unavailable ("Data unavailable due to the 2025 lapse in appropriations"); stored as missing. download.bls.gov bulk files returned 403. |
| BEA, SAMHSA, FARS, CDC WONDER | not_investigated | Later modules. |

## Feasibility matrix

| Proposed analysis | Feasible now? | Why / what is missing |
|---|---|---|
| Descriptive state trends in apparent wine consumption (UT, TN, all states) | Yes | NIAAA 1970-2024 by beverage. |
| Descriptive drinking prevalence, UT vs TN | Yes, by segment | BRFSS; trends split at 2011 and at each definition change. |
| State alcohol tax receipts over time | Yes | Census T10/T20, nominal, per capita and constant dollars. |
| Revenue effect of grocery wine on **wine-specific** revenue | No | No source isolates wine taxes for Tennessee or wine profits for Utah DABS in this preview. Minimum request: Tennessee DOR collections by tax type (wine-in-food-store fees and taxes); Utah DABS sales and margin by product category. |
| Utah total alcohol revenue (taxes + DABS earnings + licenses) | Partly | Components exist but overlap; DABS figures are unaudited and do not reconcile internally. Needs audited Liquor Control Fund statements and the scope of the DABS "Sales Tax" line. |
| Effect on local (city/county) revenue | No | No local alcohol-specific receipts collected; general sales tax cannot be attributed to wine. |
| Difference-in-differences / synthetic control for Tennessee 2016 | Not yet | Treatment start is now from enacted text (2016-07-01), but local adoption coverage (which jurisdictions passed referendums) is unknown, so statewide treatment intensity is unknown; status after 2016-07-01 is unverified; and the Unfair Wine Sales Law began the same day, so its effect cannot be separated without further design. A protocol must be committed first (analysis/causal/README.md). |
| Salt Lake City vs comparable cities | No | No city-level drinking or revenue series loaded; PLACES is modeled and not usable for policy effects. |

## Draft data requests (not sent; no fees incurred)

1. **Utah DABS**: (a) audited Liquor Control Fund statements FY2012-FY2025; (b) sales and gross margin by
   product category (wine, spirits, heavy beer) by fiscal year; (c) definition of the five-year summary's
   "Sales Tax" line (state, local or both) and of "SBI"; (d) explanation of the FY2022 total revenue
   figures (260,082 vs 260,821 vs gross profit + other income 261,082, in thousands); (e) whether shelf
   prices, the monthly Sales Analysis Reports' "Gross Sales" and the annual "Revenue from Liquor Sales"
   include sales tax; whether the audited fund's sales leave out the school-meals and enforcement deposits
   (FY2025: $486.942 million against the annual report's $551.346 million, which the two deposits account for
   within $0.08 million); and what separates the FY2024 figures ($17.5 million after both deposits).
2. **Tennessee Department of Revenue**: annual collections of taxes and fees specific to wine sold in retail
   food stores since FY2016, and the statutory basis of each.
3. **Tennessee ABC**: list of jurisdictions authorizing wine in retail food stores with referendum dates,
   and annual counts of retail food store wine licenses since 2016.
4. **Utah Legislature, Office of Legislative Research and General Counsel**: historical versions of Utah
   Code 32B-1-102, 32B-7 and Title 32A provisions governing which retailers may sell wine, 1990-2026.

## Exit gate

Met for a small real end-to-end dataset: all four core categories (population, consumption/behavior,
finance, policy) have traceable real series. Gaps are listed above and in `docs/progress.md`.
