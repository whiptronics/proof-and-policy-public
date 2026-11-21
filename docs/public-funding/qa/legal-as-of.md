# Legal as-of checks: the Utah Code in force during FY2025

Utah's FY2025 runs from July 1, 2024 to June 30, 2025. The page reads the law as current on 2026-11-20. Two
of the sections it relies on changed after FY2025, so the wording in force during FY2025 had to be read
separately. This is a machine-assisted check, not legal advice, and nobody has reviewed it.

`scripts/public_funding.py` (`FY2025_VERSION`) requires each page quote to appear word for word in the
FY2025 version. It also requires each version's page to carry the stated "Superseded" date. If either check
fails, the build stops. Both versions are pinned in `config/sources/utah_code_fiscal_earmarks.yaml` and
`config/builds/preview.pins.json`. The tests are `test_the_fy2025_versions_cover_the_whole_fiscal_year`
(pytest) and the "stale-law" and "FY2025 same_quote" assertions in `publicFunding.test.ts`.

## Version probes (le.utah.gov, re-run 2026-11-20)

The URL pattern is `https://le.utah.gov/xcode/Title32B/Chapter2/C32B-2-S<section>_<version>.html`. The
dates come from the "Effective" and "Superseded" lines on each page.

| Section | Version file | HTTP | Page says | Role |
| --- | --- | --- | --- | --- |
| 32B-2-304 | 2026031320260313 | 200 | Effective 3/13/2026 | Current; the page's quote |
| 32B-2-304 | 2024050120240501 | 200 | Effective 5/1/2024; Superseded 3/13/2026 | **In force all of FY2025**; same quote (pinned, sha 3449530c1adb09ad) |
| 32B-2-305 | 2024050120240501 | 200 | (current) | Unchanged since before FY2025; same quote |
| 32B-2-306 | 2026050620260506 | 200 | Effective 5/6/2026 | Current; the page's quote |
| 32B-2-306 | 2024050120240501 | 200 | Effective 5/1/2024; Superseded 5/6/2026 | **In force all of FY2025**; same subsection (3) (pinned, sha 197ea5728959b87c) |
| 32B-2-301 | 2025050720250507 | 200 | Effective 5/7/2025 | Current; took effect **inside** FY2025 |
| 32B-2-301 | 2021050520210505 | 200 | Effective 5/5/2021; Superseded 6/1/2022 | Before FY2025 |
| 32B-2-301 | 2022060120220601 | 404 | | Expected successor of the 2021 version; not found |
| 32B-2-301 | 2022050420220504, 2022070120220701, 2023050320230503, 2023070120230701, 2024050120240501, 2024070120240701 | 404 each | | Other likely effective dates; none found |
| 32B-2-301 | section page `32B-2-S301.html` | 200 | Lists only the 2025-05-07 version | No version list |
| 32B-2-301 | `C32B-2-S301_bills.html` | 404 | | No bill-history page at that name |

## Result

- **32B-2-304(2)(b), (5), (6)(a) and (8)** (among them the school meals deposit in (5)), **32B-2-305(4)** and
  **32B-2-306(3)** (Parents Empowered): the page's quoted words appear unchanged in the versions in force
  throughout FY2025. The page's law ledger
  shows "Same words in the version effective 2024-05-01, superseded …" with a link to each version.
- **32B-2-301(6)(a)**: the version in force from 2022-06-01 to 2025-05-06 was not found. FY2025 before
  2025-05-07 (July 1, 2024 to May 6, 2025) is therefore **not checked**. The ledger says so, the page's
  "Limits this page states elsewhere" list says so, and `lawCsv` writes "not checked: earlier version not found".
- The law ledger shows a warning once its "as read" date is more than 180 days old (`lawIsStale`).

## Tennessee and Colorado (PPF-407)

| Statement on the page | Source and edition | Checked how | Not checked |
| --- | --- | --- | --- |
| Tennessee taxes wine at $1.21 a gallon, a state tax only, generally paid by wholesalers, in a three-tier system | Tennessee Department of Revenue, Alcohol Tax Manual, June 2025, chapter 3 (page 20) | Four sentences must appear in the saved PDF text | The Tennessee Code itself (T.C.A. 57-3-302); where the receipts go |
| Tennessee food stores could be licensed from July 1, 2016, only where local voters approved | Public Chapter 554, Acts of 2014 | Two sentences must appear in the saved PDF text | Later amendments; which places voted yes |
| Colorado taxes wine at 7.33 cents a liter plus a 1.0-cent wine development fee, paid by the maker or the first licensee to receive it; 85% of state liquor taxes and fees go to the old age pension fund | Colorado Revised Statutes 2024, Title 44, uncertified printout, 44-3-502(1)(a) and 44-3-503(1)(a), (c)(I) | Four sentences must appear in the text of pages 100-101 | Amendments after the 2024 edition; the 2022 Proposition 125 text itself (the page cites the Other States record) |

## Next step if someone picks this up

The Utah Code Annotated print editions or the session laws (`config/sources/utah_session_laws.yaml`) for the
2022-2025 general sessions would show whether 32B-2-301 was amended in that window. That reading was not done.
