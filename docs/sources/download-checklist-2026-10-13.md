# Files to save by hand (checklist of 2026-10-13, reordered 2026-10-14, two added 2026-10-15)

This project's download tools cannot reach the sites below (the cloud workspace and the linked computer's
shell are both refused by their hosts or by the network allowlist; nothing was bypassed, and the refused addresses
were not retried on 2026-10-14). Each file was found and, where marked, read through a web reader, which is enough to
know what it holds and to keep provisional notes (`data/curated/research/provisional_figures.csv`, labelled "read
online"), but not to cite it as a saved, checksummed source. Save each file from a browser into
`../Repeal Title 32B Utah` (next to this repository's folder), keeping the name the site gives it. The next session
matches each file to its lead by contents, registers it in `config/sources/`, imports it with
`alcohol-data import-asset` (which pins its SHA-256), checks the provisional figures against it, and only then turns
"documented, read online" into "documented". Values enter the dataset only as hand transcriptions marked
`extracted_unreviewed`, or through a parser with tests.

Already in that folder and not requested again (inventoried 2026-10-14, twice; nothing new since 2026-10-12): DABS's
90th annual report (FY2025), the ten Census Individual Unit Files, the BEA and Economic Census files. Files 1-5 and
10-11 were saved on 2026-10-14 (through the desktop app's browser on the maintainer's computer), imported with
`alcohol-data import-asset` and pinned; every online reading from them was checked against the saved pages and the
ones in use are now manual observations. They are marked "saved" below and not requested again.

One list, in order of what each file settles for the simulator (docs/plans/nationwide-expansion.md, milestone 2).

## 1. Utah: the unresolved years and the provisional figures behind the reconciliation

| # | File | Address | Read? | Unlocks | Lead |
|---|---|---|---|---|---|
| 1 | State of Utah ACFR, FY2025 | https://finance.utah.gov/wp-content/uploads/FY25-ACFR-FINAL-reduced-size.pdf | **saved 2026-10-14, pinned as `utah_acfr_fy2025`** | the Alcoholic Beverage Services Fund statements (about p. 50) and notes: how the fund recognises sales and the two deposits, the $9.750 million adjustment, and so FY2024's $17.5 million residual; pins 10 provisional figures | `lead_ut_audited_lcf` |
| 2 | State of Utah ACFR, FY2024 | https://treasurer.utah.gov/wp-content/uploads/FY24-ACFR-Final.pdf | **saved 2026-10-14, pinned as `utah_acfr_fy2024`** | the FY2024 fund statement as first published (before the FY2025 adjustment) with FY2023 beside it: FY2023's $1.07 million residual and FY2024 | `lead_ut_audited_lcf` |
| 3 | DABC 81st annual report (FY2016) | https://abs.utah.gov/wp-content/uploads/81st_annual.pdf | **saved 2026-10-14, pinned as `utah_dabs_annual_report_fy2016`** | pins 54 provisional figures (FY2012-FY2016), the "Sales net of Taxes" label and the bridge for FY2012-FY2014 | `lead_ut_dabs_reports_fy2012_2019` |
| 4 | DABC 84th annual report (FY2019) | https://abs.utah.gov/wp-content/uploads/84th_annual.pdf | **saved 2026-10-14, pinned as `utah_dabs_annual_report_fy2019`** | pins 54 provisional figures (FY2015-FY2019) | `lead_ut_dabs_reports_fy2012_2019` |
| 5 | DABC 86th annual report (FY2021) | https://abs.utah.gov/wp-content/uploads/86th_annual-1.pdf | **saved 2026-10-14, pinned as `utah_dabs_annual_report_fy2021`** | pins 60 provisional figures (FY2017-FY2021) | `lead_ut_dabs_reports_fy2012_2019` |
| 6 | DABC 87th and 88th annual reports (FY2022, FY2023) | https://abs.utah.gov/wp-content/uploads/87th_Annual_Report.pdf and https://abs.utah.gov/wp-content/uploads/88TH-ANNUAL-REPORT-FINAL-V.2.pdf | **saved 2026-10-14 (night), pinned as `utah_dabs_annual_report_fy2022` and `_fy2023`** | now first: DABS's own FY2022-FY2023 figures as first printed, against the audited fund's revenue, which is about $16 million lower in FY2023 and FY2024; also FY2022's reported deposits (97.8% of the statutory amounts) | `lead_ut_dabs_reports_fy2012_2019` |
| 7 | 2012 H.B. 354, 2013 H.B. 399, 2022 S.B. 201 and 2023 H.B. 223, enrolled | https://le.utah.gov/~2012/bills/hbillenr/hb0354.htm, https://le.utah.gov/~2013/bills/hbillenr/hb0399.htm, https://le.utah.gov/~2022/bills/sbillenr/SB0201.pdf, https://le.utah.gov/~2023/bills/hbillenr/HB0223.pdf | yes | pins the enforcement-fund rates for FY2013-FY2014, FY2022-FY2023 and FY2024-FY2026 (now "read online") | `metadata/legal_history/utah_liquor_deposit_rates.csv` |
| 8 | Utah Code § 32B-2-304, two versions | https://le.utah.gov/xcode/Title32B/Chapter2/C32B-2-S304_2024050120240501.pdf and https://le.utah.gov/xcode/Title32B/Chapter2/C32B-2-S304_2026031320260313.pdf | yes | pins the 10% school-meals deposit (subsection 5) and the markup floors behind the wine-margin input | owed since 2026-10-12 |
| 9 | DABS Numeric price list, August 2026 (and later months) | https://abs.utah.gov/wp-content/uploads/Aug2026NumericPriceList.pdf | yes (three products) | the shelf-price check for every product (the monthly series' tax basis) | `lead_ut_dabs_price_lists` |

The State of Utah ACFRs for FY2023 (https://treasurer.utah.gov/wp-content/uploads/FY23-Annual-Comprehensive-Financial-Rpt.pdf)
and FY2022 (https://treasurer.utah.gov/wp-content/uploads/2022-State-of-Utah-ACFR.pdf) were saved on 2026-10-14
(night) and pinned as `utah_acfr_fy2023` and `utah_acfr_fy2022`; every online reading from them is checked. With item 6
they show that the first-published FY2023 figures largely agree, leave the later restatement unexplained and leave
FY2024 open (docs/fiscal-reconciliation.md, "First-published FY2023 figures largely agree; later restatement remains
unexplained", formerly "Settled with
the FY2022-FY2023 documents").

Still unidentified, so not listed as a file: the act that lowered the enforcement rate from 1% to 0.875% (between
FY2020 and FY2021; 2020 H.B. 208 and H.B. 399 do not), and the 32B-2-305 amendments of 2014-2020 (the enactment
inventory ends with the 2013 session).

## 2. The peers' own finances (milestone 2 (c))

| # | File | Address | Read? | Unlocks | Lead |
|---|---|---|---|---|---|
| 10 | Pennsylvania Auditor General, audit of the PLCB State Stores Fund, FY2025 and FY2024 | https://www.paauditor.gov/wp-content/uploads/fedLCBAuditReport121125.pdf | **saved 2026-10-14, pinned as `pa_ag_plcb_audit_fy2025`** | pins 45 provisional figures behind the Utah-Pennsylvania comparison | `lead_pa_plcb_audited_statements` |
| 11 | The same audit, FY2024 and FY2023 | https://www.paauditor.gov/wp-content/uploads/fedLCBAuditReport121224.pdf | **saved 2026-10-14, pinned as `pa_ag_plcb_audit_fy2024`** | pins 44 provisional figures (FY2023) | `lead_pa_plcb_audited_statements` |
| 12 | Virginia ABC ACFR, FY2025 (RD985) | https://rga.lis.virginia.gov/Published/2025/RD985/PDF | introduction only | Virginia's statement of revenues, expenses and changes in net position: a second peer | `lead_va_abc_acfr` |
| 13 | Virginia ABC ACFR, FY2024 (RD909) | https://rga.lis.virginia.gov/Published/2024/RD909/PDF | no (found by search) | the FY2024 year that Census covers | `lead_va_abc_acfr` |
| 14 | Idaho State Liquor Division annual reports, FY2023-FY2025 | https://liquor.idaho.gov/wp-content/uploads/2025/11/AnnualReport2025.pdf, https://liquor.idaho.gov/pdf/annual-reports/AnnualReport2024.pdf, https://liquor.idaho.gov/pdf/annual-reports/AnnualReport2023.pdf | 2025 and 2024 | Idaho's income statement and distributions; why Census's Idaho receipts are 0.79 of the report's total sales | `lead_id_isld_annual_reports` |
| 15 | OLCC biennial revenue report (latest, 2021-2023) and FY2024 selected financial accounts | links on https://www.oregon.gov/olcc/Pages/where-the-money-goes.aspx ; https://records.sos.state.or.us/ORSOSWebDrawer/Record/10909562 | no | Oregon's figures, read last (FY2015 release conflict and a classification break in Census) | `lead_or_olcc_financials` |

## 2a. Seller margins for the grocery-wine comparison (added 2026-10-15)

**Done 2026-10-18:** both files were saved on 2026-10-15 (`../Repeal Title 32B Utah`), are pinned (`census_arts_gmper_2022`,
`census_awts_table4_2022`) and are parsed into the dataset by `src/alcohol_data/adapters/census_trade_margins.py`
(eight `nation:us` measures, every year printed). Nothing more to download here.

| # | File | Address | Read? | Unlocks | Lead |
|---|---|---|---|---|---|
| 16 | Census Annual Retail Trade Survey, gross margin as a percentage of sales, 2022 benchmarked (`gmper.xlsx`, 18,597 bytes) | https://www2.census.gov/programs-surveys/arts/tables/2022benchmarked/gmper.xlsx | yes, in the desktop app's browser without saving (SHA-256 `e69ca6e3…c67b` of the bytes served) | the grocery-store (28.0%) and beer, wine and liquor store (31.1%) margins the worked comparison assumes grocers need, as saved records | `lead_census_arts_awts_gross_margins` |
| 17 | Census Annual Wholesale Trade Survey, table 4, 2022 revised (`2022_awts_purchmarg_nomsbo_table4.xlsx`, 44,274 bytes) | https://www2.census.gov/programs-surveys/awts/tables/2022revised/2022_awts_purchmarg_nomsbo_table4.xlsx | yes, the same way (SHA-256 `c2ec5dbc…3bbe`) | the beer, wine and spirits wholesalers' margin (29.5%) assumed for a private wholesaler | `lead_census_arts_awts_gross_margins` |

## 3. Grocery-wine histories (milestone 2 (d)), already listed in the research queue

| File | Address | Lead |
|---|---|---|
| Colorado 2025 Beer and Wine Code | https://sbg.colorado.gov/sites/sbg/files/documents/2025_Beer_and_Wine_Code.pdf | `lead_co_prop125` |
| Colorado Proposition 125 (Initiative 120), final text | https://coloradosos.gov/pubs/elections/Initiatives/titleBoard/filings/2021-2022/120Final.pdf | `lead_co_prop125` |
| Pennsylvania Act 39 of 2016 | https://www.legis.state.pa.us/WU01/LI/LI/US/PDF/2016/0/0039..PDF | `lead_pa_act39_2016` |
| Tennessee public chapters after 2016 on food-store wine (2016 ch. 787 and 830; 2023 ch. 178; others named in the current code's history notes) | https://publications.tnsosfiles.com/acts/109/pub/pc0787.pdf, .../acts/109/pub/pc0830.pdf, .../acts/113/pub/pc0178.pdf | `lead_tn_code_after_2016` |

Not listed file by file: the session laws for the peers' liquor-control histories (Virginia § 4.1-119 and
§ 4.1-103, about 45 chapters; Pennsylvania Liquor Code §§ 207, 301 and 415; Idaho Title 23; Oregon ORS chapter
471). The version ledger needs every amending chapter, which is a session's work to list once the legislature
sites can be reached or a person exports them.
