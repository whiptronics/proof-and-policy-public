# External fetch list: the gap-closing pass, 2026-11-20

Every request this pass made to a host outside this PC. All are GET requests for public pages, plus web
searches whose queries held only the topic words below. No project file, data, screenshot, log or personal
detail was sent anywhere. Times from the pins are UTC, so they read 2026-11-21 for fetches made on the evening
of 2026-11-20, Mountain time.

## Pinned into the raw cache (`alcohol-data fetch --only …`)

| Asset | URL | Retrieved (UTC) | Bytes | SHA-256 (first 16) |
| --- | --- | --- | --- | --- |
| `law_ut_32b_2_304_v20240501` | https://le.utah.gov/xcode/Title32B/Chapter2/C32B-2-S304_2024050120240501.html | 2026-11-21T04:47:47Z | 16,562 | 3449530c1adb09ad |
| `law_ut_32b_2_306_v20240501` | https://le.utah.gov/xcode/Title32B/Chapter2/C32B-2-S306_2024050120240501.html | 2026-11-21T04:47:48Z | 12,220 | 197ea5728959b87c |
| `usda_nslp_rates_sy2024_25` | https://www.govinfo.gov/content/pkg/FR-2024-07-10/html/2024-15175.htm | 2026-11-21T05:04:06Z | 15,283 | 50c742f8029e7af8 |
| `usbe_current_expenditure_per_pupil_fy2024` | https://www.schools.utah.gov/superintendentannualreport/financialoperations/fy2024/2024%20Total%20Current%20Expenditures%20%20per%20Pupil%20in%20Fall%20Enrollment%20Fiscal%20Year%202020-2024.pdf | 2026-11-21T05:04:07Z | 282,803 | cbba94593d134ae8 |

The 17 assets pinned for the first build are listed with their fingerprints in
[provenance-audit.md](provenance-audit.md).

## Read, not pinned (the contrary-evidence panel)

Read on 2026-11-20 by a fetch tool, which reported each page's own sentences. Not saved into the raw cache.
The page cites each one by URL and read date.

| URL | Used for |
| --- | --- |
| https://thecommunityguide.cdc.gov/findings/alcohol-excessive-consumption-privatization-retail-alcohol-sales.html | Task Force privatization finding |
| https://pmc.ncbi.nlm.nih.gov/articles/PMC4608622/ | Kerr, Williams and Greenfield (2015) |
| https://ideas.repec.org/a/tpr/edfpol/v2y2007i1p40-73.html | Evans and Zhang (2007) |
| https://lawfilesext.leg.wa.gov/biennium/2025-26/Pdf/Bills/Senate%20Bills/5389.pdf | Washington S.B. 5389 (text read from the PDF locally with pdfplumber) |

## Probes (status codes only; see [legal-as-of.md](legal-as-of.md))

Fifteen requests to le.utah.gov, 3 seconds apart: 13 version files of 32B-2-301, -304 and -306, the section
page `32B-2-S301.html`, and `C32B-2-S301_bills.html`.

## PPF-407 (Tennessee and Colorado, later the same night)

| Asset or URL | Result |
| --- | --- |
| https://www.tn.gov/revenue/taxes/alcoholic-beverage-taxes.html | HTTP 403 to the fetch pipeline; nothing saved |
| `tn_dor_alcohol_tax_manual_2025_06`, https://www.tn.gov/content/dam/tn/revenue/documents/tax_manuals/june-2025/Alcohol-Tax-Manual.pdf | pinned, 832,628 bytes, sha256 0d82842bdb5e3193 |

Every other Tennessee, Colorado and NIAAA file the chapter cites was already in the raw cache (pinned in October 2026).
One web search, for the address of Tennessee's tax rates: "Tennessee wine tax $1.21 per gallon Department of Revenue
alcoholic beverage taxes wholesaler".

## PPF-404 (five comparators, 2026-11-21)

The rows were proposed by the parent session, which read the pages first. This session fetched each file into the
raw cache and read every figure from the saved file. GET requests only; nothing was uploaded.

| Asset | URL | Retrieved (UTC) | Bytes | SHA-256 (first 16) |
| --- | --- | --- | --- | --- |
| `usda_snmcs_v3_summary_2019` | https://fns-prod.azureedge.us/sites/default/files/resource-files/SNMCS-Volume3-Summary.pdf | 2026-11-21T19:11:59Z | 155,843 | 2b41815ed734478a |
| `law_ut_53f_2_527_v20250701` | https://le.utah.gov/xcode/Title53F/Chapter2/C53F-2-S527_2025070120250507.html | 2026-11-21T19:11:59Z | 6,664 | 7a8214168e272b14 |
| `ut_interim_2022_00003562` | https://le.utah.gov/interim/2022/pdf/00003562.pdf | 2026-11-21T19:12:02Z | 237,503 | 37346fd89d3790d5 |
| `usbe_school_plant_capital_outlay_2023` | https://www.schools.utah.gov/superintendentannualreport/financialoperations/fy2023/School%20Plant%20Capital%20Outlay%20Report%202023%20sqft.pdf | 2026-11-21T19:12:02Z | 115,672 | 5194c7a3aa4d4f84 |
| `usbe_school_plant_capital_outlay_2024` | https://www.schools.utah.gov/superintendentannualreport/financialoperations/fy2024/School%20Plant%20Capital%20Outlay%20Report%202024%20sqft.pdf | 2026-11-21T19:12:05Z | 156,009 | f5561370de4da456 |
| `usbe_avg_salaries_sy2024_25` | https://www.schools.utah.gov/datastatistics/_datastatisticsfiles_/_reports_/_educators_/2025AverageAdministratorTeacherSalaries.xlsx | 2026-11-21T19:12:08Z | 25,334 | c3080e42d0127fa4 |
| `utah_auditor_teacher_pay_fy2025` | https://transparent.utah.gov/teacher-pay/ (dashboard; no file address) | 2026-11-21T19:12:21Z (imported) | 4,012,740 | 66ba8e95b90dceba |

The teacher-pay file has no address of its own: the dashboard was opened in the browser pane, its default filters
submitted and "Download as CSV" pressed; the saved file was then imported with `alcohol-data import-asset`. It names
individual teachers, so its source file marks it not to be redistributed (`redistribute_raw: false`). No web search
was made for this item.

## Web searches (standard mode)

1. Federal Register 2024 National School Lunch … reimbursement rates July 1 2024 June 30 2025
2. Utah State Board of Education district annual financial report … fiscal year 2024
3. earmarked revenue fungibility state lottery education spending …
4. Washington I-1183 liquor privatization spirits prices … Kerr Greenfield
5. Pennsylvania wine expanded permit grocery stores … PLCB … Act 39
6. state liquor privatization earmarked liquor revenue replaced …
