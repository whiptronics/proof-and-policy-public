# Public-release audit, 2026-10-27

An audit of https://proofandpolicy.us, this repository and the public repository after the 0.3.0 release, looking for
wrong calculations, misleading conclusions, unsupported claims, contradictions and factual slips. Done by an AI agent
(Claude) on the maintainer's computer; **not reviewed by a person**. Corrections are in release 0.3.1 (CHANGELOG).

## What was published when the audit started

- Live site = website commit 9a868f4, research code v0.3.0 (587abfd), data build `public-e3edb88f8ecd`. All 203 built
  files served at proofandpolicy.us were byte-identical to a local build; `/release/*` redirects to the v0.3.0 GitHub
  release, whose `manifest.json` matches its checksum; officials and CDC CDI files return 404 as intended.
- The working repository differed from the exported commit (e88b2df) only in the private progress log.

## What was checked

| Area | How | Result |
|---|---|---|
| Rendered text of all 19 public views | Read from the live site; scanned for counts next to "states"/"jurisdictions", "nationwide", "all states", causal and certainty words | No impossible counts; two count labels corrected (DC as a state; U.S. total and regions as jurisdictions) |
| Grocery-wine worked example | Every row recomputed by hand from DABS FY2025 sales $551,346K, gross profit $260,289K (47.21%), wine 33.5%, households 82%, 30% moving, 4.85% state tax, 5¢ avoided, $500,000 new costs | All figures reproduce: moved $45,436,424; margin lost $21,450,416; tax $7,572,737 (P/6); DABS remainder $12,363,132; net −$12,105,858 and −$7,315,464; break-even 3.9¢; 76.4% tax; 6.9% and −32.1% margins; 31.6¢/21.1¢ cost; 20.6% margin; 13.2% tax for the funds; 0.5% discount room under the 88.5% floor |
| Inputs against primary sources | DABS 90th Annual Report (text and rendered pp. 18-19, 32); Utah Code 32B-2-304 (2026-03-13) and 32B-2-305 (2024-05-01) on le.utah.gov; Census ARTS gross-margin table (4451, 2022: 28.0) and AWTS table 4 (4248, 2022: 29.5); NIAAA pcyr1970-2024 (Utah 2024 wine 0.1770, 3,297,940 gal, ABV 11.8% and beer 4.8%) | All match |
| Literature citations | Nelson (2013) full text; Hahn et al. (2012) via the Community Guide | −0.46 is Nelson's cumulative estimate (Table 4; the abstract's average is −0.45); Hahn's medians are +44.4% and −2.2% |
| Scenario engine | Boundary probes: no shift, no savings, no new costs, 100% shift, 0% and 100% discount, discount above margin, zero margin, invalid shares, zero price, oversize excise, growth to −100% and below | Correct, except two silent combinations (fixed below) |
| Live calculator | Worked preset; share moving 0%, 30%, 100% | Matches the grocery-wine page and the engine (−$500,000 at 0%; −$23,218,212 DABS at 100%) |
| Tennessee before-after | Recomputed from the published metric files | Wine 0.2852 → 0.3726 (+30.7%); wine tax +22.5% FY2016-FY2017; nominal FY2012-16 mean $12,612,147; T10 differences and pooled gap reproduce |
| Utah reconciliation | Statutory deposits for FY2025 (55,135 + 9,345) | Match |
| Links and downloads | Every external link on the main pages; release redirects and checksum | One dead link (TTB, fixed); CDC, NHTSA and DABS refuse scripted requests (403) and Census timed out, so those four were not confirmed |
| Mobile | 375 px wide, seven heaviest views | No horizontal page scroll |

## Issues found and corrected

| # | Severity | Where | Issue | Correction |
|---|---|---|---|---|
| 1 | High (broken public feature) | Map | Choosing either CDC CDI measure left the page on "Loading the map's data" forever: the "not in this build" check came after the loading return | Check first; list only measures in the build (also Utah at a glance); Start here no longer offers liver-disease deaths |
| 2 | Medium (misleading label) | Grocery-wine worked example | "Net change in state revenue" (−$12.1M/−$7.3M) includes $1.77M of assumed avoided costs, while the revenue row above falls by $13.9M/$9.1M | Relabelled "Net change for the state (revenue change, plus store costs avoided, less new costs)"; finding reworded; appendix table likewise |
| 3 | Medium (overstated review) | Site footer | "most have not yet been reviewed": no value or legal coding is reviewed by a person | "as of this release none has", plus the AI disclosure |
| 4 | Medium (contradiction) | Definitions & methods | "No similarity score is computed" while the comparison finder computes one | Rewritten |
| 5 | Medium (contradiction) | Utah at a glance vs finder | "default settings" but no policy exclusions, so Arkansas ranks 3rd of 50 there and is left out of the finder's default 48 | States exactly what is run |
| 6 | Medium (unit unstated) | Tennessee worked example | Wine-tax averages $16.9M/$22.1M are constant 2024 dollars, unlabelled; the panel above shows $12.6M nominal for the same window | Unit stated in the text and the panel note |
| 7 | Medium (unpublished reference) | Grocery-wine page | Three pointers to the "graph package", which is not public | Pointed to the page's own sections and the public export command |
| 8 | Low-medium (validation) | Scenario tool | A fall in purchases larger than a channel sells gave negative purchases silently | Rejected with a reason (test added) |
| 9 | Low-medium (validation) | Scenario tool | A DABS discount above its gross margin (selling below cost) was computed silently | Flagged in the results; still computed, because the sensitivity searches scan discounts and an invalid input would read as a break-even |
| 10 | Low (states vs jurisdictions) | Utah at a glance; Sources | "Rank among states" counts DC; "52 jurisdictions" counts the U.S. total, "56" also Census regions | "states and DC"; "50 states and DC, the U.S. total, 4 Census regions" (test added) |
| 11 | Low (display) | Tennessee worked example | Literal "undefined" in a table | "not computed (a window is incomplete)" |
| 12 | Low (dead link) | Sources (state law) | TTB's list of state authorities moved (404) | New TTB address; registry regenerated |
| 13 | Low (stale docs) | README | "13 measures" (11 in the public build); "reviewed by a person other than its extractor" implied a human extractor | Corrected |

## Checked and left as it is

- The two beer-switching break-evens on the grocery-wine page (14% more wine; 6.1% of households' beer) differ because
  they use different savings (5¢ illustrative, 2.28¢ documented) and bases (all wine, households' beer); both are labelled.
- Utah's Census T10 series breaks in FY2018 (−84%, then +75-78%); every page that shows it flags the break, and the
  Tennessee page's Utah window change (−59.7%) spans it. Not explained by any source read.
- DABS's FY2025 "sales tax" line ($32.4M) is described in the same report as local governments' share, which looks too
  large for the local rate alone; the tool does not use it and says its scope is unresolved.
- The export summary on Downloads still counts officials records that the website leaves out (site_changes in the
  website's lock file); harmless, not changed.

## Not verified

- No person has checked any value or legal coding; this audit is AI-assisted.
- Utah's other hand-transcribed DABS values beyond FY2025's sales, gross profit, wine and off-premise shares; the
  Pennsylvania audit transcriptions; the 179 current-law snapshots; Tennessee Department of Revenue parsing.
- Every per-state table cell, the finder's Mahalanobis scores, placebo distributions and the purchase-flow grid beyond
  the existing independent scripts (`grocery_wine_flows_check.py`, `grocery_wine_robustness_check.py`).
- CDC, NHTSA, Census and DABS links that refused or timed out for scripted requests.
