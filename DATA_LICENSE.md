# Data license

The code license (MIT, `LICENSE`) does **not** apply to upstream data. Rights are recorded per asset in
`metadata/rights_registry.csv`; this file summarizes them.

## Upstream sources

| Source | Status | Basis | Raw files redistributed? |
|---|---|---|---|
| U.S. Census Bureau (population estimates, State Government Tax Collections) | Public domain | Work of the U.S. federal government, 17 U.S.C. 105; Census open data policy | Allowed; not bundled in releases (size) |
| NIAAA apparent consumption data files | Public domain | U.S. federal government work (NIH) | Allowed; not bundled |
| CDC BRFSS Prevalence 2011+ (data.cdc.gov `dttw-5yxu`) | Public domain | data.cdc.gov license field "Public Domain" | Allowed; not bundled |
| CDC BRFSS Prevalence 2010 and prior (`y4ft-s73h`) | Open Data Commons Attribution 1.0 | data.cdc.gov license field "ODC-BY" | Allowed with attribution (THIRD_PARTY_NOTICES.md) |
| BLS CPI-U | Public domain | U.S. federal government work | Allowed; not bundled |
| BEA state personal income (SAINC) | Public domain | U.S. federal government work | Allowed; not bundled (size) |
| Census County Business Patterns; Census government finances (liquor stores) | Public domain | U.S. federal government work | Allowed; not bundled (size) |
| CDC YRBSS high school (data.cdc.gov `svam-8dhg`) | Public domain | data.cdc.gov license field "Public Domain" | Allowed; not bundled |
| NHTSA FARS files and state alcohol-impaired-driving report | Public domain | U.S. federal government work | Allowed; not bundled (size) |
| CDC Chronic Disease Indicators (`hksd-2xuw`) | **In local builds only; release gated** | data.cdc.gov license field "ODbL" (share-alike), checked 2026-10-09 | No. `alcohol-data package` refuses a release containing it until the owner decides on the release license |
| BEA personal consumption expenditures by state (SAPCE) | Public domain | U.S. federal government work | Allowed; not bundled (size) |
| Census Monthly State Retail Sales; Census 2017 Economic Census | Public domain | U.S. federal government work | Allowed; not bundled (size) |
| Utah DABS monthly Sales Analysis Reports | Facts with citation | State agency publication; redistribution of the spreadsheets not cleared | **No.** Only totals by beverage type are published |
| Utah State Tax Commission Publication 25 | Facts with citation | State agency publication | **No.** One rate, with its page citation |
| us-atlas state outlines (`states-albers-10m.json`, used to draw the map) | ISC license; boundaries from public-domain Census files | Package license (rights_evidence_url in the source file) | Allowed; the file is copied into the dashboard export as SVG paths |
| Utah Code, Utah enrolled bills, Tennessee bill records and public chapters | Not copyrightable | Government edicts (statutes and legislative records) | Allowed |
| Utah DABS annual reports | Facts with citation | State agency publication; redistribution of the PDFs not cleared | **No.** Only transcribed figures and page citations are published |

Government-hosted pages can contain third-party material (images, quoted reports). Only the specific data
fields listed in the registry are used.

## Original compilation

The project's own contributions (curated policy codings and evidence, manual extractions, crosswalks,
measure definitions, derived values, and the structure of the compiled tables) are released under the
Creative Commons Attribution 4.0 International license (CC BY 4.0). This choice is the default set at
creation and can be changed by the repository owner before first publication.

Attribute as: "Proof & Policy: Alcohol Policy and Revenue Open Data, release <version>", plus the original sources for any
upstream values you use.
