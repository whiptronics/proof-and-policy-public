# Public Funding: delivery report

Filled from `03_quality/DELIVERY_REPORT_TEMPLATE.md` of the devplan after building and testing, on 2026-11-20, by
Claude (AI), and updated the same evening after a gap-closing pass approved by Ethan ("Yes, finish them") and again for
PPF-407 at his request ("Add the Tennessee and Colorado comparators too"), and on 2026-11-21 for PPF-404 ("Yes, add
them": five public-value comparators, release 0.6.1). Not reviewed by a person. The pass's evidence is in [qa/](qa/): commands and results, accessibility, contrary-evidence search,
independent comparison, provenance audit, legal as-of checks and the external fetch list.

## Summary

- **Implemented:** the Public Funding & Public Value Lab, `?v=funding` ("Where the Money Goes", nav "Public Funding"),
  with all eight chapters and the advanced pieces: single-bottle ledger, price and revenue map, budget bridge (the page
  30 income statement plus the existing DABS savings cases), stress test, documented-inputs-only mode, bill
  completeness checklist, permalink (`fs=`), print report, CSV/JSON downloads, limits and open questions.
- **Where:** research worktree `alcohol-policy-revenue-data-devplan`, branch `devplan/2026-11-19`, on top of
  `9986619`; website worktree `pp-devplan-1119` on top of `035870d`. Both committed locally with this report
  (`git log -1` in each); nothing pushed.
- **Added in the gap-closing pass:** a "What cuts the other way?" panel (four published findings, each read on its
  source, the searches that found nothing, and the page's own limits in one list); the federal free-lunch
  reimbursement as a comparator, labeled a reimbursement rate and not a cost; USBE's own per-pupil figure beside
  Census's for every district; the Utah Code versions in force during FY2025; tests for F04, F15, F16, F20, E04, E08
  and the devplan's adversarial cases; an accessibility pass with contrast and reflow fixes.
- **Added for PPF-407:** a chapter "What happened in Tennessee and Colorado?" (nav "Other States"). It sets Utah beside
  the two states on who sells wine to stores and shoppers, how each state takes its share (Utah's markup; Tennessee's
  $1.21 a gallon; Colorado's 7.33 cents a liter), what that is on one bottle, whether it depends on which store sells
  it, where the money goes (Colorado: 85% to the old age pension fund; Tennessee: not read) and wine bought per adult.
  Tennessee's wine-tax account is shown FY2012-FY2025 under its two printed labels, kept apart; Colorado has no tax
  receipts (no evaluation found, pages refused automated access) and only NIAAA's figures beside the national ones.
  A list says what the comparisons cannot show; nothing from either state enters the model.
- **Added for PPF-404 (2026-11-21, release 0.6.1):** five rows on the public-value scale, each read from a newly
  pinned file and checked against its printed words: the full cost of one school lunch, $5.55 (USDA's School
  Nutrition and Meal Cost Study, national, school year 2014-15, weighted by lunches; not adjusted for inflation); a
  Utah teacher's average total compensation, $116,031.57 (Transparent Utah, FY2025, 25,773 teachers, benefits
  included; teaching pay alone and USBE's salary-only average are in the note); the $500 a year Utah Code
  53F-2-527(2) sets for one K-6 classroom teacher's supplies; one Highway Patrol trooper's ongoing $135,300 a year
  (the patrol's own July 2022 estimate); and one new district elementary school, $31M (the middle of three in USBE's
  2023 and 2024 capital outlay reports; a one-time cost, so the page reads it as one school every so many years).
- **Still not implemented, and why:** a school-meal cost later than school year 2014-15 (USDA's 2022-23 follow-up
  published none); wine-only DABS receipts (not published); the 32B-2-301 wording in force from 2022-06-01 to 2025-05-06 (not
  found online); where Tennessee's wine tax goes (its revenue department's manual gives the rate and who pays, not the
  distribution); Colorado tax receipts since 2023 (the Department of Revenue's pages refused automated access).
- **Deployment performed?** For 0.6.0, yes: live on proofandpolicy.us on 2026-11-21, on Ethan's go
  (`docs/progress.md`). For 0.6.1 (PPF-404), no: prepared on this PC; nothing pushed, published or released.
- **Local-only boundary upheld?** Yes. Source files were fetched from their official public hosts (le.utah.gov,
  census.gov, nationsreportcard.gov, api.bls.gov, abs.utah.gov, in the gap pass govinfo.gov and schools.utah.gov, and
  for PPF-407 tn.gov, for PPF-404 fns-prod.azureedge.us, le.utah.gov and schools.utah.gov, and the teacher-pay CSV
  from transparent.utah.gov's dashboard in the browser pane) into the local raw cache, and four research pages were read for the contrary-evidence panel; no project file, data,
  screenshot or log was sent to any other service ([qa/external-fetches.md](qa/external-fetches.md)).

## Implementation inventory

| File/feature | Changed? | Purpose | Model/source compatibility |
|---|---|---|---|
| Routing / navigation | `url.ts`, `nav.ts`, `App.tsx` | adds the `funding` view after `sameprice`, lazy-loaded | existing views unchanged |
| Source registry/data pipeline | 4 new `config/sources` files, `preview.yaml`, pins, both registries | 17 pinned assets | existing assets unchanged |
| Fiscal ledger adapter | `lib/publicFunding.ts` (new) | `public-funding@1.0` over `policy-designs@1.0` | engine not edited; agreement tested |
| School education series | `scripts/public_funding.py`, `publicFunding.generated.ts` | Census FY2019–2024 per pupil, NAEP 2024, CPI-U | new |
| DABS data and law ledger | same | FY2025 page 30 and 32 figures; 7 Utah Code rules with quotes | reads the existing curated DABS transcription |
| Revenue neutrality / same-bottle price model | `lib/publicFunding.ts` | conditions, map, stress test, receipt | matches `?v=sameprice` (−$4.54M) and the designs report |
| Funding protection / bill checker | `FundingView.tsx`, `CHECKLIST` | per-program ledger, 13-item checklist, S.B. 180 status | new |
| Public-value and district context | same | comparators; Census district finances | unavailable comparators say so |
| Evidence + exports + static fallback | same; site sitemap and no-script summary | source table with fingerprints; 4 downloads; `/read/funding/` at release | text page is written by the site's prerender at release |
| Docs and tests | `docs/public-funding/*`, `docs/limitations.md`, CHANGELOG, progress; 43 + 6 tests | | `pageWording.test.ts` covers the page |
| Gap pass: sources | `config/sources/usda_school_meal_rates.yaml`, `usbe_school_finance.yaml`, two FY2025 law versions in `utah_code_fiscal_earmarks.yaml`; pins and registries | 21 assets pinned for this page in all (the page also cites 2 older ones) | existing assets unchanged |
| Gap pass: page | `FundingView.tsx`, `publicFunding.ts` (`CONTRARY`, `bottleReceipt`, `grocerCondition`, `lawIsStale`), `styles.css` (`.tick-label`) | counter-evidence chapter, FY2025 law column, stale-law notice, map marks "?" and "×", free-lunch and USBE rows, captions and live summary | the map, receipt and conditions use the same engine terms as before |
| Gap pass: evidence | `scripts/public_funding_audit.py`, `docs/public-funding/qa/*` | provenance audit and independent comparison are generated | new |
| PPF-407: Tennessee and Colorado | `config/sources/tennessee_dor_alcohol_taxes.yaml` (1 new asset); `states()` in `scripts/public_funding.py` reusing the project's Tennessee-collections and NIAAA adapters; `stateComparison()` in `publicFunding.ts`; `STATE_CASES` reused from `framework.ts` | chapter "Other States"; 18 more cited assets (17 already pinned) | context only: no state figure enters `fundingScenario()` |
| PPF-404: five comparators | 6 new `config/sources` files (7 assets), `preview.yaml`, `public.yaml`, pins; `teacher_pay()` and `comparators()` in `scripts/public_funding.py`; five `COMPARATORS` rows and `compareWords()` in `publicFunding.ts`; the table in `FundingView.tsx` | the public-value scale; a one-time cost reads "one every N years" | the two rows that said "Not available" now carry sourced figures; no model changed |

## Fiscal and law review

- **DABS:** FY2025 (90th Annual Report), unaudited, hand-transcribed, not reviewed. Page 30 closes exactly with a
  $19.609M unitemized nonoperating remainder shown as unreconciled. Page 32 prints other income $1.668M lower; both
  kept. The six destinations sum to $204.5M, labeled as a sum including sales tax buyers paid.
- **Law:** Utah Code 32B-2-301(6)(a), -304(2)(b), (5), (6)(a), (8), -305(4), -306(3), the versions current when read
  on 2026-11-20 (effective 2024-05-01 to 2026-05-06); each quote is checked against the saved text. Each quote is also
  checked against the version in force during FY2025: the 2024-05-01 versions of -304 and -306 (superseded in 2026)
  carry the same words, and -305 is unchanged. 32B-2-301's current version took effect 2025-05-07, inside FY2025, and
  the version before it was not found, so July 2024 to May 6, 2025 is not checked for that rule
  ([qa/legal-as-of.md](qa/legal-as-of.md)). No human review.
- **Tennessee and Colorado (PPF-407):** Tennessee's rate, payer and "state tax only" are quoted from the Department of
  Revenue's Alcohol Tax Manual (June 2025), not the Tennessee Code; the food-store license date and local-option rule
  from Public Chapter 554 (2014). Colorado's rates, payer and 85% pension allocation are quoted from the 2024 printed
  Colorado Revised Statutes, 44-3-502(1)(a) and 44-3-503(1). Neither was checked for amendments after those editions.
- **Wine coverage:** DABS reports all liquor; the lab uses the existing wine terms (FY2026 wine sales; the FY2025
  all-product margin applied to wine). The share that moves, new purchases, avoidable cost and margins are inputs.
- **Model versions:** `policy-designs@1.0` unchanged (all 544 earlier web tests still pass); new `public-funding@1.0`.
- **What reverses the results:** under DABS wholesale at today's price, the state is behind by the grocer's margin per
  $ that moves unless avoided DABS costs or new purchases cover it (the longer-run savings case nearly does at 10%;
  about 7% more household purchases would). Under private distribution, the wholesaler's and grocer's margins decide.
- **Undetermined on the page:** annual totals when the share is unknown; the grocer condition between 0 and the
  grocery average; program protection with new purchases and unknown share; whether DABS's sales to grocers count
  toward the deposits as written ("Cannot be determined"); district-level alcohol money ("Not estimable").

## Executed local tests

| Command | Result | Details / artifact |
|---|---|---|
| Existing Python tests | pytest: 438 passed | 432 before plus 6 new; raw cache linked by a junction, then removed. PPF-404: the same 438, the drift test now reading the 7 new files |
| Existing web tests | vitest: 608 passed in 45 files | 544 before; 589 after the gap pass; 6 more for PPF-407; 602 in release 0.6.0; 6 more for PPF-404; `tsc --noEmit` clean |
| Existing scenario export/check | `npm run docs:framework`, `npm run brief:legislative` | no diff; PDF still two pages |
| New fiscal invariant tests | `publicFunding.test.ts` | F01–F20, conservation, engine agreement, adversarial cases, duplicated-charge reconciliation |
| New education and legal tests | same; `tests/test_public_funding.py` | E01–E09; L01–L09; quote check; FY2025 law versions; drift test; USBE agreement bound |
| Provenance audit | `scripts/public_funding_audit.py` | 48 assets, 55 citations, 0 problems (41 and 48 before PPF-404; 23 and 30 before PPF-407); red on a corrupted pin |
| Build/static export | `npm run build` | built; `FundingView` chunk 116.6 kB (34.6 kB gzip). Site `check.mjs` not run: it needs a research release |
| Screenshot/accessibility review | headless Edge, browser pane | see Visual quality |

## Visual quality

- **Screenshots:** full-length PNGs at 320, 375, 768, 1280 and 1680 px (retaken after the gap pass, dark theme; 1.2 to
  1.7 MB each) and an earlier printed PDF (15 pages), kept outside the repository in the session notes folder
  `funding-screenshots/`; sizes and widths in [qa/commands.md](qa/commands.md).
- **Interactive behavior verified:** arrangement and slider changes, documented-inputs mode, share link round trip, a
  malformed link (notice shown, default scenario), the wholesaler margin moving the map (−30.4¢ at 29.5%, −12.4¢ at
  10%), print (controls hidden; inputs, methods and scenario code printed).
- **JS-disabled and reduced motion:** the page adds no animation. Without JavaScript, readers get the no-script
  summary (which now links `/read/funding/`) and, after a release, the prerendered text page.
- **Accessibility remaining:** the destination bars are clickable in the chart and duplicated as `aria-pressed`
  buttons; sliders, radios and the checklist selects are labeled; every chart has a title, reading, limits and a
  table. With text doubled (root font 200%, and separately page zoom 200%) there is no sideways scroll at 320, 375, 768
  or 1280 px. The gap pass added a machine-assisted screen-reader pass (names, table captions, live summary, focus
  after pressing) and measured the map's translucent cells after compositing them over the panel in both themes. It
  fixed chart text that was black in dark mode (map symbols 2.49:1, now at least 5.00:1), map symbols that vanished at
  320 px, overlapping axis labels and a label over bars ([qa/accessibility.md](qa/accessibility.md)). The PPF-407
  chapter adds three captioned tables and no chart; the eight-case sweep was repeated after it, with no sideways
  scroll. Not done: a run with a real screen reader, and forced-colors mode.

## Data/source coverage

| Source/metric | Official citation | Year | Observed/proxy/illustrative | Human reviewed? | Gap |
|---|---|---|---|---|---|
| DABS gross sales | DABS 90th Annual Report, p. 30 | FY2025 | observed (unaudited) | No | transcription not reviewed |
| DABS public distributions | same, p. 32 | FY2025 | observed; sum is calculated | No | p. 30/32 conflict kept |
| Wine-specific sales/contribution | DABS FY2026 wine sales (existing terms) | FY2026 | margin is a proxy (all products) | No | no wine-only receipts |
| Census spending per pupil | 2024 Annual Survey of School System Finances, Tables 8, 11, 20 | FY2019–2024 | observed | No | no cost adjustment |
| NAEP outcomes | NAEP Data Service, 2024 math and reading, grades 4 and 8 | 2024 | observed, NCES tests | No | |
| USBE local district | USBE Superintendent's Annual Report FY2024, current expenditures per pupil; beside the Census unit file | FY2024 (July 2023 to June 2024) | observed | No | a second measure, not the same number; median 3.6% above Census |
| Free-lunch reimbursement | 89 FR 56720 (July 10, 2024), Sections 4 and 11 | SY2024-25 | observed rate | No | a reimbursement rate, not a cost |
| Full cost of one school lunch | USDA FNS, School Nutrition and Meal Cost Study, Volume 3 summary (April 2019), p. 1 | SY2014-15 | observed (national study estimate) | No | not Utah's; not adjusted for inflation; no later study with costs |
| Teacher total compensation | Office of the State Auditor, Transparent Utah Teacher Compensation Dashboard CSV; USBE average salaries 2024-25 | FY2025 | observed (the dashboard's mean reproduced) | No | includes benefits and some non-teaching pay; the CSV names people, so it is not redistributed |
| Teacher supplies amount | Utah Code 53F-2-527(2) and (3), version effective 2025-07-01 | FY2026 on | observed text (amount set in law) | No | may be reduced in proportion; not attorney-reviewed |
| Trooper ongoing cost | Utah Highway Patrol, Bangerter Highway - Mountain View Corridor Resource Analysis (2022), pp. 2-3 | July 2022 prices | agency estimate | No | not audited; one-time costs left out |
| New elementary school cost | USBE School Plant Capital Outlay Reports 2023 and 2024 | FY2023-24 | district estimates (SP-4 forms) | No | not final costs; three schools only; one-time |
| Current Utah Code | 32B-2-301, -304, -305, -306 | as of 2026-11-20 | observed text | No | not attorney-reviewed |
| Utah Code in force in FY2025 | 2024-05-01 versions of -304, -306; -305 unchanged | FY2025 | observed text | No | -301 before 2025-05-07 not found |
| Tennessee wine tax and payer | Tennessee Department of Revenue, Alcohol Tax Manual (June 2025), ch. 3, p. 20 | June 2025 | observed text (agency guidance) | No | not the Code itself; distribution not stated |
| Tennessee food-store wine licenses | Public Chapter 554 (2014), 57-3-801 and the license section | from 2016-07-01 | observed text | No | which places voted yes not read |
| Tennessee account 11002 | Summary of Collections, June editions FY2012-FY2025, fiscal-year-to-date page | FY2012-FY2025 | observed (collections basis) | No | label changes in FY2018; no food-store account |
| Colorado wine excise and allocation | C.R.S. 2024 (uncertified printout), 44-3-502(1)(a), 44-3-503(1) | 2024 edition | observed text | No | no receipts since 2023 |
| Wine and all alcohol per resident 21+ | NIAAA Surveillance Report #124 data file | 2015, 2017, 2022, 2024 | observed (sales and shipments) | No | purchases, not drinking |
| Contrary findings | Community Guide (2011); Kerr et al. (2015); Evans and Zhang (2007); Washington S.B. 5389 (2025) | as published | read, not pinned | No | Pennsylvania results and a Utah consumption estimate not found |

## Remaining risks, release conditions and owner action

1. **Before public release:** a person checks the DABS transcription (pages 30 and 32), the seven law quotes, the
   FY2025 law versions, the four contrary findings, the S.B. 180 status table, the Tennessee and Colorado readings and the five PPF-404 comparator figures.
2. **Source-gated:** wine-only DABS receipts (DABS's wine sales by customer type are the subject of request C,
   `docs/gaps/utah-missing-records.md`, drafted, not sent); which DABS costs are avoidable; the 32B-2-301 wording in force from 2022-06-01 to 2025-05-06.
3. **Owner decisions:** where the page sits in the navigation. Release 0.6.0 is live (2026-11-21); the
   PPF-404 rows are in release 0.6.1, prepared locally and not pushed.
4. **To inspect locally:** in `web/`, `npm run build`, then `node_modules/.bin/vite preview --port 4371` and open
   `http://localhost:4371/?v=funding`.
5. **Deploy later, only with permission:** as in the earlier release entries of `docs/progress.md` (0.4.0, 0.5.1):
   export and tag a research release, point the site's `research.lock.json` at it, then in the site
   `node scripts/build.mjs`, `node scripts/prerender.mjs`, `node scripts/build.mjs` again and `npm run check`; the
   push to the site's main branch is the deploy.

## Final status per backlog

Counted against the 48 items (PPF-000 to PPF-508) in `01_plans/PHASES_AND_TASK_BACKLOG.md`:

- **Done: 45.** PPF-000 to 004, 100, 101, 104 to 107, 200 to 206, 300 to 310, 400 to 403, 405 to 407 and 500 to
  508. PPF-406 is done as the backlog allows: no allocation rule supports district or store figures, so
  the page says "Not estimable". PPF-407 (added later the same night) shows Tennessee and Colorado with their caveats
  and attributes nothing to either change; where Tennessee's wine tax goes and Colorado's receipts are marked not
  read.
- **Done except a source-gated part: 2.** PPF-102 (no wine-only DABS receipts, so DABS figures are all liquor and
  labeled so); PPF-103 (32B-2-301's wording before 2025-05-07 not found).
- **Done on this PC, not deployed: 1.** PPF-404 (Ethan, 2026-11-21: "Yes, add them"): the five comparators are in
  release 0.6.1, prepared locally; they go live only on his go. PPF-505 (Cloudflare static hosting check) moved to
  done when 0.6.0 went live on 2026-11-21: all 268 served files matched the build and `/read/funding/` answered. The
  page itself makes no external requests and adds no paid dependency.
- **Not done: 0.**
- **Human review:** none. Nothing on the page or in these documents is marked reviewed by a person.
- **Existing tests newly failing:** none.
- **Unrelated changes avoided:** yes; only the files listed above.
