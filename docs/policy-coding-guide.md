# Policy coding guide

Policy data live in two version-controlled files:

- `data/curated/policy_events.csv`: one row per interval in which one jurisdiction's law sets one value of
  one policy dimension.
- `data/curated/policy_evidence.csv`: one or more rows per interval citing the document, locator and a
  short excerpt or paraphrase, and saying what the evidence supports.

The build expands intervals into `policy_exposure` for calendar years and state fiscal years.

## Rules

1. **Intervals are half-open**: `[effective_start, effective_end)`. A value that takes effect on
   November 1 has `effective_start = YYYY-11-01`; the previous value has `effective_end = YYYY-11-01`.
2. **Unknown is never a value.** If the start date has not been traced, `effective_start` is empty and
   `effective_start_precision = unknown`. Never fill it with a guess, and never treat an unknown period as
   "not permitted".
3. **Evidence windows.** When the start is unknown, `known_in_effect_from` records the earliest date the
   evidence establishes (e.g. the signing date of a bill whose struck text shows the old law). For open
   intervals, `known_in_effect_through` records the latest date the evidence establishes (e.g. the
   retrieval date of the current code). Exposure is computed only for days inside these windows.
4. **Carry-forward only inside a verified interval.** An interval verified at both ends (enacted start,
   still in current code) is treated as continuous; this assumption is written in `notes`.
5. **Adoption, effective date and implementation are different.** `enactment_date` is signing or
   approval; `effective_start` is when the legal value applies. Retail implementation (stores actually
   selling) is not coded in v0.1.
6. **State authority and local adoption.** A state provision that only applies where a locality adopts it
   has `requires_local_adoption = true`. Without local adoption data, exposure is `local_option_unknown`,
   never statewide exposure.
7. **Conflicts.** Two verified values on the same day for the same jurisdiction and dimension fail
   validation; those days count as unknown in exposure.
8. **Status fields are independent.** `extraction_status` (`parsed | checked_against_original |
   uncertain`), `temporal_status` (`unresolved | anchored | reconstructed | reconciled`),
   `legal_review_status` (`unreviewed | machine_assisted_review | maintainer_reviewed | expert_reviewed`)
   and `claim_status` (`supported | contradicted | incomplete | ambiguous`). An interval's `temporal_status`
   is the weakest basis among the days it claims (`reconstructed` < `reconciled` < `anchored`). Text checks and Claude's reading
   are `machine_assisted_review`, never a human review. `maintainer_reviewed` and `expert_reviewed` need a
   named human `reviewer`, a `review_date` and a reviewer on at least one evidence row; validation rejects an
   AI or machine recorded as reviewer. An expert review is recorded only when it really happened.
9. **As-of date.** The build's `as_of_date` and `as_of_timezone` define the last day of history. Days after
   it are future (`future_days`), never treated as observed, and `period_not_complete` periods carry
   minimum/maximum exposure bounds.
10. **Narrow claims and special channels.** A value answers one stated question for one channel. Special
   channels (for example Utah package agencies) get their own dimension; exceptions examined for a claim are
   listed in `data/curated/utah/claim_exceptions.csv` and the provisions it depends on, with reasoning, in
   `claim_dependencies.csv`.

## Evidence strength

| Value | Meaning |
|---|---|
| `enacted_text` | The enacted bill or public chapter text |
| `current_code` | A dated version of the codified statute |
| `legislative_record_summary` | Bill status pages, captions, summaries |
| `inference` | A conclusion drawn from other evidence; must be labelled and reviewed |

## Policy catalog

Every coded policy dimension is defined in `metadata/policy_catalog.csv` (released as the
`policy_dimensions` table). The allowed values of categorical dimensions, each with a definition, are in
`metadata/policy_catalog_values.csv` (table `policy_dimension_values`). The validation check
`policy_catalog_conformance` rejects a coding whose dimension is not catalogued, or whose value does not
fit the dimension's rule. New dimensions are added to the catalog first.

**Domains.**

| Domain | What it covers |
|---|---|
| `retail_permission` | Which outlet types may sell which beverage under an ordinary license |
| `local_implementation` | Local take-up of statewide options |
| `retail_structure`, `wholesale_structure` | Who sells and who wholesales: state, state contract, local government, private, or mixed |
| `special_channel` | State-contract agencies and similar channels |
| `tax`, `markup` | Excise rates and control-state markups |
| `pricing` | Minimum price rules |
| `product_definition` | For example, the legal strength ceiling of "beer" |
| `sunday_sales`, `sales_hours` | When sales may happen |
| `delivery` | Retailer delivery and direct shipping |

**Value formats.**
- Numeric values carry their unit: `usd_13.10`, `pct_88.0`.
- Shares are written `share_0.412`.

**Statewide permission and local implementation stay separate.**
- A state that lets localities opt in to grocery wine is coded
  `ordinary_grocery_wine_authorization = authorized_local_option` (layer `state`).
- Which localities did so is `grocery_wine_local_adoption_share` (layer `local`). It is recorded only from a
  dated list, never estimated.
- Likewise, `local_prohibition_option` (the state lets localities go dry) is separate from
  `dry_population_share` (how many did).

**A retail system is coded from law, never from data.** A state's retail system is never inferred from the
presence or absence of a revenue value, such as Census liquor-store revenue.

## Dated snapshots and the nationwide baseline

A snapshot (`policy_snapshots`) records what one source shows on one day, or in one year when the source
gives only a year. It never becomes an interval, never fills a day of exposure, and never counts as
verified history in `docs/policy-coverage.md`. The nationwide baseline is built from snapshots.

**Where they come from.** Each baseline batch is a file in `data/curated/policy_baseline/`. An entry names
the page, the exact phrases that support the value, the citation and the locator.
`scripts/policy_snapshots.py` does three things:

- `sync` adds the pages to the `state_alcohol_law` source;
- `alcohol-data fetch --only ...` pins them;
- `rows` cuts each excerpt from the pinned bytes.

A phrase that is not found verbatim stops `rows`, so an excerpt cannot drift from its source.

**Which day.** The observed date is chosen in this order:

- **Retrieval day** (`retrieval_date`), when the page presents itself as current law, read on that day in
  the build's time zone.
- **Stated date** (`currency_statement`), when the source says what it is current to. Example: New Mexico's
  agency compilation, "current through" the 2025 session, effective 2025-07-01.
- **Year only** (`observed_precision = year`), when the source gives only a year, such as an annual
  printout like Colorado's 2024 statutes. No day is invented.
- **Document date** (`document_date`), for a dated print or brief.

When a code prints several dated versions of a section, each find names the version heading it must
follow (`after`, with `before` for the next version), so the excerpt comes from the version in force on
the observed day. A missing anchor stops the run.

An online code that lags a session is checked against the legislature's own table of amended sections
before the retrieval day is used. Oregon's 2025 edition was checked against the 2026 table this way. The
check is recorded in the notes.

**How the text supports the value (`support_basis`).**

| Value | Meaning | Shown as |
|---|---|---|
| `explicit_text` | The excerpt names the outlet type or the arrangement. Example: Virginia's license "may be granted to ... grocery store". | stated |
| `no_outlet_restriction` | The source creates a general retail license and names no outlet type. That a grocery store qualifies is inferred from the absence of a restriction. Examples: California's off-sale licenses "issued to retail stores"; New Mexico's retailer's license. | general license, `*` in the matrix |
| `indirect` | The text implies the status without stating it. Examples: Georgia's delivery guidance listing grocery stores among beer and wine retailers; Montana's agency stores, where "no state-run stores" follows from the statute providing only agency stores. | implied, `~` in the matrix |

A general license is coded `authorized` because the catalog's definition asks whether state law lets the
outlet type be licensed. Quotas, size floors and local licensing go in `value_detail` or `notes`. Examples:
Wyoming's population quota, and Washington's spirits licenses limited to stores of 10,000 square feet or
more.

**Local option.** When a state's local option covers all alcohol sales, a grocery permission is still
`authorized`. The general option is `local_prohibition_option`. New Mexico's local option districts are an
example.

`authorized_local_option` is reserved for a permission that localities adopt for this channel. Examples:
Tennessee's food-store wine referendum, and Idaho's county option for retail wine.

`chains_and_supermarkets_barred` (added 2026-10-09) is for a state that bars chain stores and
supermarkets from the ordinary license while other stores of the type may hold it. Example: Maryland
§ 4-205, which keeps Class A licenses away from chain stores, supermarkets and discount houses unless the
establishment already held one. Neither `not_authorized` ("anywhere in the state") nor `authorized`
describes that.

## Version ledger for other states

Utah's history comes from the Legislature's own archive of every section version. Most states keep no such
archive. Their history is rebuilt from session laws that reprint each amended section with markup.

- `metadata/legal_history/state_section_versions.csv` lists each version of a section: the days it was in
  force, the pinned act and pages that carry its text, and how that text is read.
- `metadata/legal_history/state_claim_checks.csv` lists, for each interval, the phrase each version must
  contain.

`alcohol_data.legal.version_ledger` reads the markup mechanically. For Kentucky, insertions are in bold
italic and deletions are struck through in square brackets:

- the text *after* an act keeps its insertions and drops its deletions;
- the text *before* the act drops its insertions and restores its deletions. This is how a version that
  survives nowhere else is rebuilt.

The rules are strict:

- **Coverage.** The `value` versions of each section must cover every day of the interval, one version per
  day. A gap or an overlap fails `tests/test_version_ledger.py`.
- **Cross-checks.** `anchor` rows are independent checks: the next act's print of the earlier text, and the
  current code's history note, which dates every version. They do not count toward coverage.
- **Mutation tests.** The tests go red if a version is removed or if insertions are not recognised.

**Kentucky, the first case.** The bar on liquor and wine package licenses at grocery premises is verified
in every version of KRS 243.230 in force since 1998-07-15:

| Version | How its text was obtained |
|---|---|
| In force from 1998 | Rebuilt from the 2013 act |
| 2013 | 2013 act |
| 2014 | 2014 act, ch. 22 |
| 2015 | 2014 act, ch. 92 |
| 2017 | 2017 act |

Days before 1998-07-15 stay unknown.

**Virginia, the second case.** Virginia's Acts of Assembly chapters on the Legislative Information System
are HTML: insertions in `<i>`, deletions in `<s>` (convention `va_lis_html_italic_strike`). The
grocery-wine claim moves between two sections:

| Days | Section | What the text says | Support |
|---|---|---|---|
| 1997-07-01 to 2021-06-30 | § 4.1-209 (subdivision 2, A 2 from 2001) | a general retail off-premises wine and beer license, no outlet type named | general license (inferred eligibility) |
| from 2021-07-01 | § 4.1-206.3 C 1 | the same license "may be granted to a ... grocery store" | stated |

Reading Virginia needed four more rules:

- **Each version's text is an official print.** For each period, the next amending act's print of the
  section (its text before the act) is the version, because several acts of one session amend the same
  pre-session text and the merged result is printed only by the next session's act. The text after each
  act is kept as a cross-check.
- **Chain and merge checks find missing acts.** Each act's print of the earlier text must equal the text
  after the act before it. Where a session had several acts, every insertion must reach the next print and
  nothing else may change. Both checks were run (2026-10-09). They caught the six 2017 chapters, which the
  archived history note (March 2017) predates and the current page lists; the remaining differences were
  catchlines, punctuation, quote marks, split italics and a renumbered cross-reference.
- **Emergency acts start on approval.** 2006 ch. 153 and 2008 ch. 179 were "in force from passage", so
  each makes a short version, read from its own text.
- **Dated versions in force at once.** From 2022 the Code often prints § 4.1-206.3 twice ("Effective until
  July 1, 2024" and "Effective July 1, 2024"), and acts set later effective dates in their enactment clauses
  (2020 ch. 1113 to 2021-07-01; 2024 ch. 105 to 2026-07-01). The version in force is chosen by those
  clauses. Every printed version in every act from 2020 to 2024 names grocery stores. The 2024-2026 version
  comes from the Internet Archive's 2024-08-08 copy of the official page, and the 2026-07-01 start of the
  current text from the Code's 2026 updates list.

An undated row is allowed only as a cross-check; a `value` version without dates is an error.

## Dimensions coded in v0.1

| Dimension | Meaning | Values |
|---|---|---|
| `ordinary_grocery_wine_authorization` | May an ordinary grocery retailer, under its ordinary off-premise retail authorization, sell sealed wine to the public? | `authorized`, `not_authorized`, `authorized_local_option`, `conditional_or_special_channel` (e.g. a state-contract agency in the store), `unknown`, `disputed` |
| `state_contract_package_agency_channel` | Is the state-contract package agency channel (private premises, state prices) available? A special channel, not grocery authorization | `available` |
| `beer_definition_max_alcohol` | Statutory ceiling on "beer", the only alcohol Utah grocery and convenience stores may sell | `max_4.0pct_abv_or_3.2pct_abw`, `max_5.0pct_abv_or_4.0pct_abw` |
| `beer_excise_tax_per_31gal_barrel` | Utah state beer excise rate | `usd_12.80` ... `usd_13.85` |
| `liquor_store_beer_sales` | May package (liquor) stores sell beer? | `permitted` |
| `wine_minimum_retail_price_rule` | Statutory floor on retail wine prices | `no_sales_below_cost_plus_20pct` |

## What is coded

| Jurisdiction | Intervals | Status |
|---|---|---|
| Utah | Ordinary grocery wine `not_authorized` (off-premise beer retailer authority is beer-only), verified every day 2014-01-01 to 2026-10-06 against all versions of 32B-1-102, 32B-7-201 and 32B-4-402; package agencies coded separately as a special channel; before 2014 unknown | machine_assisted_review |
| Utah | Beer ceiling 4% ABV until 2019-11-01, 5% ABV from 2019-11-01 (2019 S.B. 132); each verified in every 32B-1-102 version from 2014-01-01 | machine_assisted_review |
| Utah | Beer tax $12.80 -> $13.10 on 2019-11-01 (same bill), then $13.35, $13.60, $13.85 each July 1 from 2024; verified in every 59-15-101 version from 2014-01-01 | machine_assisted_review |
| Kentucky | Ordinary grocery wine and spirits `not_authorized` (no retail package license at premises where staple groceries are a substantial part of sales), verified every day from 1998-07-15 in every version of KRS 243.230 | machine_assisted_review |
| Virginia | Ordinary grocery wine `authorized` under the general retail off-premises wine and beer license (§ 4.1-209), verified every day 1997-07-01 to 2021-06-30; eligibility inferred from the absence of an outlet restriction | machine_assisted_review |
| Virginia | Ordinary grocery wine `authorized`, § 4.1-206.3 C 1 naming grocery stores, verified every day from 2021-07-01 | machine_assisted_review |
| Arkansas | Grocery store wine permit (Act 508 of 2017, § 3-5-1802) from 2017-10-01: wet counties as of 2017-01-01, at most 20% alcohol sales, small farm winery wine stocked; status after that day not yet verified | machine_assisted_review |
| Tennessee | Food-store wine not permitted before 2016-07-01: enacted 57-3-803(a), "prior to that date no retail food store may sell wine", in force from signing (2014-03-20) | machine_assisted_review |
| Tennessee | Food-store wine permitted by local referendum from 2016-07-01 (licenses from that date; wine up to 18% ABV; stores with at least 20% food sales and 1,200 sq. ft.; jurisdictions that already passed a package-store or liquor-by-the-drink referendum and have full-time law enforcement); status after that day not yet verified | machine_assisted_review |
| Tennessee | Package (liquor) stores may sell beer from 2014-07-01 (same act, section 10) | machine_assisted_review |
| Tennessee | Unfair Wine Sales Law from 2016-07-01: no wine retail sales below cost plus 20% (same act, section 30) | machine_assisted_review |
| Utah | Spirits and wine wholesale `state_operated`: wine is liquor, liquor enters the state only through the department, and manufacturers and industry representatives sell liquor only to the department (32B-1-102, 32B-4-401, 32B-11-208, 32B-11-608; Title 32A counterparts before 2011), verified every day from 2003-05-05. Not checked separately: that retail licensees buy only from the department. Beer is wholesaled privately and not coded | machine_assisted_review |
| Utah | Spirits and wine retail `state_stores_and_contract_agencies`: state stores staffed by state employees (32B-2-501), package agencies under contract (32B-2-601), no sale other than as the title authorizes (32B-4-402), verified every day from 2011-07-01; before that unknown, because the Title 32A state-store section (32A-2-101) is not inventoried | machine_assisted_review |

Utah intervals are checked day by day against the Legislature's historical code versions; see
[methods/legal-history.md](methods/legal-history.md). `tests/test_legal_history.py` fails if an interval
claims a day the version texts do not support. Kentucky and Virginia intervals are checked the same way
against the version ledger (`tests/test_version_ledger.py`).

Concurrent changes matter for any later analysis:

- **Utah, 2019-11-01:** the beer ceiling and the beer tax changed on the same day.
- **Tennessee, 2016-07-01:** food-store wine sales and the Unfair Wine Sales Law (a minimum markup binding
  food stores and package stores) start on the same day. On 2014-07-01 the same act let package stores
  sell beer.

Tennessee excerpts come from a scanned PDF with an OCR text layer. Each was checked against the rendered
page image, and `tests/test_policy_evidence.py` checks that distinctive fragments appear in the pinned
documents.

Dated snapshots of current law (not intervals) are listed state by state in
[policy-coverage.md](policy-coverage.md). They cover 47 jurisdictions for grocery wine or the spirits
retail system after baseline batches 1 to 9. Batch 10 (2026-10-10) adds the four liquor-control
dimensions for Utah's peers Virginia, Pennsylvania, Idaho and Oregon, from statute text; where the text
gives powers rather than an exclusive phrase (Pennsylvania's Board as the only wholesaler, Virginia's and
Idaho's spirits wholesale), the snapshot is marked `indirect`.

**Liquor control is four dimensions, never one label.** `spirits_wholesale_system`,
`wine_wholesale_system`, `spirits_off_premise_retail_system` and `wine_off_premise_retail_system` are
coded separately, so a state that wholesales spirits but leaves retail private, one that runs its own
stores, one that contracts agencies, and one that treats wine unlike spirits all stay distinguishable.
The dashboard compares states on them only over verified days (docs/research-dashboard/README.md,
"Liquor-control comparison").

## Not yet coded

- **No snapshot yet:** 4 jurisdictions, each with a source lead: AK, AL, IN and NJ. Their codes load by
  script or answer 403, so each needs a person to save the pages from a browser.
- **Agency guidance only:** TX, PA, NY and MS for grocery sales. Their statute text is still wanted
  (Pennsylvania's liquor-control arrangement now rests on the Liquor Code itself).
- **Not coded for any state:** Sunday sales, hours, license limits, delivery, beverage tax rates other than
  Utah beer, and markups.
- **Intervals:**
  - Colorado's 2023-03-01 change. There are only 2024 snapshots so far.
  - Tennessee's status after 2016-07-01, which needs later public chapters or the current code. The
    Secretary of State's host refuses automated requests; the manual step is in `lead_tn_code_after_2016`.
  - Arkansas after 2017-10-01 and before it (small farm winery wine in grocery stores).
  - Georgia history (no free official code or session-law route found yet; `lead_ga_title3_history`).
  - Virginia's spirits retail system (§ 4.1-119, about 45 amending chapters since 2000) by the same ledger.
  - Liquor-control history for every state but Utah: Virginia (§§ 4.1-103, 4.1-119), Pennsylvania (Liquor
    Code §§ 207, 301, 415), Idaho (Title 23) and Oregon (ORS chapter 471) first, then the other control
    jurisdictions. Oregon's current spirits retail arrangement is not coded from statute: the statute does
    not say that no store is state-run, so the 2012 legislative brief remains its only basis.
  - Utah retail before 2011-07-01 (32A-2-101).
  - Local referendum results in Tennessee.
