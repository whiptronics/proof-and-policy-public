# Legal history: verifying a coded legal status day by day

A policy interval says "this law had this value from date A to date B". For Utah, the project checks that
claim against the text of the statutes involved as it stood on each day, not against the current code
alone. From 2014-01-01 that text is every version in the Legislature's Historical Code. Before that it is
reconstructed from the enacted bills: Title 32B from 2011-07-01, and the beer tax section from 2003-05-05.
What this establishes is narrower than it may sound: see "Scope".

Code: `src/alcohol_data/legal/utah_code.py` (Historical Code versions, checks, claims) and
`src/alcohol_data/legal/utah_session_laws.py` (session inventory and the 2011-2013 reconstruction).
Outputs, committed and regenerated from pinned files by `alcohol-data legal ledger-utah`:

| File | Contents |
|---|---|
| `metadata/legal_history/utah_code_versions.csv` | Every Historical Code version of the tracked sections, its window and check results |
| `metadata/legal_history/utah_session_inventory.csv` | Every session from 2002 S4 to 2013 S2: digest vs passed-bill index, and its coverage status |
| `metadata/legal_history/utah_enactments.csv` | Every action on Title 32A/32B or chapter 59-15 in those sessions, tracked sections flagged |
| `metadata/legal_history/utah_reconstructed_versions.csv` | The text in force 2011-07-01 to 2014-01-01, state by state, with its evidence and checks |
| `metadata/legal_history/utah_title32a_crosswalk.csv` | Every Title 32A section and the Title 32B sections it went into (from the Legislature's recodification table) |
| `metadata/legal_history/utah_code_claims.csv` | The days on which each claim is verified, in runs of equal temporal status |

Curated reasoning: `data/curated/utah/claim_dependencies.csv` and `data/curated/utah/claim_exceptions.csv`.
For a reviewer: `alcohol-data legal review-packet-utah` writes `docs/review/utah-policy-review-packet.md`
and `docs/sources/utah-historical-source-catalog.md`.

## From 2014: the Historical Code

The Utah Legislature's Historical Code tool (https://le.utah.gov/UtahCode/historical.jsp) lists every version
of a code section back to January 1, 2014. Earlier records are not available there. That is a limit of the
interface, not proof that older law is unobtainable; see `docs/plans/utah-legal-history-source-expansion.md`. Each
version is a static page that states its own window, for example "(Effective 11/1/2019) ... (Superseded
5/12/2020)" or "(Effective until 5/1/2024)". The oldest version file (ending `_1800010118000101`) carries only
an end date and is the text in force on 2014-01-01.

```bash
alcohol-data legal discover-utah   # list versions; writes config/sources/utah_code_history.yaml (review, commit)
alcohol-data fetch                 # download and pin every version file and session-law record
alcohol-data legal ledger-utah     # inventory, reconstruction, version ledger and claim windows
```

1. **Windows.** Each version is in force from its stated effective date (2014-01-01 for the oldest) up to,
   not including, its stated end date. A version whose effective date is not before its end date never took
   effect (one 2025 version scheduled for 2026-01-01 was replaced in November 2025); it stays in the version
   ledger as `never_in_force` and creates no operative interval. The end date read from each page must equal
   the date in the Legislature's version listing (`page_and_listing_agree`).
2. **As-of cutoff.** The build's `as_of_date` (2026-10-06, America/Denver) is the last day treated as
   history. A current version is known in force through the earlier of the as-of date and the local date its
   page was retrieved (retrieval timestamps are stored in UTC). Later days are future, not observations.
3. **Checks.** Each section has text conditions written as exact phrases from the statute (`CHECKS`), recorded
   per version. They locate text; they do not decide what it means. The reasoning that connects each provision
   to the question lives in `claim_dependencies.csv`.
4. **Claims.** A claim lists the (section, check, expected result) pairs it needs. A day is verified only if,
   for every pair, exactly one text of that section is in force that day and its check has the expected
   result. Verified days are reported as continuous runs, with separate status fields:
   `retrieval_status`, `extraction_status`, `temporal_status`, `legal_review_status`, `claim_status`.
   Every ledger claim is `machine_assisted_review`; only a named person can make it `maintainer_reviewed`, and
   validation rejects an AI or machine recorded as a human reviewer.
5. **Consistency.** `tests/test_legal_history.py` requires every Utah interval in
   `data/curated/policy_events.csv` to lie inside the verified days of its claims, the versions of each
   section to cover every day from 2014-01-01 without gaps or overlaps, and every dependency's ledger check to
   exist.

## 2011-07-01 to 2013-12-31: reconstructed from the session laws

Title 32B was enacted by **2010 S.B. 167**, *Alcoholic Beverage Control Act Recodification* (Laws of Utah
2010, chapter 276), signed 2010-03-29. Its section 384 reads: "This bill takes effect on July 1, 2011,
except the amendments to Section 58-82-102 (Effective 07/01/12) take effect on July 1, 2012." So Title 32B
is never assigned to 2010 or to the first half of 2011. Before 2011-07-01, Title 32A governed (not yet
traced).

**Records** (all official, all pinned; `config/sources/utah_session_laws.yaml`):

- *Digests of Legislation* 2010-2014. Each lists every bill enacted in the sessions it covers, with its
  code sections affected, effective date and session-law chapter.
- *Passed-bill indexes* for each session: the same bills with their chapters.
- *Enrolled bills.* Each amended section is reprinted whole. Inserted text is underlined (`<u>`) and deleted
  text is struck through in brackets (`[<strike>...</strike>]`), so both the text before an amendment and
  the text after it can be read. Each bill also carries its own list of sections affected, with the history
  of each ("as last amended by Laws of Utah 2011, Chapters 307 and 334").

**Inventory.** Every general and special session from 2002 S4 to 2013 S2 is inventoried. That is 33
sessions, from the Digests of Legislation 2003-2014. The span covers the 2010-2013 sessions that can change
Title 32B before 2014 and the earlier sessions back to the 2003 beer-tax change.

Special sessions are numbered consecutively within each two-year Legislature:

| Legislature | Special sessions |
|---|---|
| 54th | S4-S6 (2002) |
| 55th | S1-S2 (2003), S3-S4 (2004) |
| 56th | S1-S2 (2005), S3-S5 (2006) |
| 57th | S1 (2007), S2 (2008) |
| 58th | S1 (2009), S2 (2010) |
| 59th | S1-S3 (2011), S4 (2012) |
| 60th | S1-S2 (2013) |

So no special session in the span is missing. The digests also name veto-override sessions (2002, 2004,
2011) and a 2013 House session, which passed no bills of their own.

The pre-2010 digests head special-session pages without a year and sometimes with another part's running
header. The parser takes the session from the part's own heading or title page instead. For each session
the digest's chaptered bills are compared with the passed-bill index:

- they agree for every session once the veto-override pages are read (e.g. 2011 S.B. 229 and H.B. 328);
- the 2008 digest's entry for S.B. 245 ends without its chapter line; the index gives chapter 40;
- the 2012 digest lists H.B. 237 as chapter 293, while the index shows no chapter; its sections are known
  from the digest;
- the 2014 digest omits three 2013 First Special Session bills (H.B. 1003, H.B. 1004, S.B. 1001); their
  enrolled bills were pinned and their own affected-sections lists read instead.

Every session is therefore `complete_for_declared_dependencies`: every chaptered bill's affected sections
are known. This completeness holds for the tracked sections only. It rests on the digests' section lists
and has not been re-derived from every one of the 4,464 enrolled bills.

Only five bills changed a tracked Title 32B section:

| Bill | Chapter | Effective | Sections |
|---|---|---|---|
| 2010 S.B. 167 | 2010 ch. 276 | 2011-07-01 | enacts every 32B section; amends 59-15-101 |
| 2011 S.B. 12 | 2011 ch. 307 | 2011-07-01 | 32B-1-102, 32B-2-601, 32B-11-608 |
| 2011 S.B. 314 | 2011 ch. 334 | 2011-07-01 | 32B-1-102, 32B-11-608 |
| 2011 S2 S.B. 2002 | 2011 S2 ch. 2 | 2011-07-28, retrospective to 2011-07-01 | 32B-1-102 |
| 2013 H.B. 228 | 2013 ch. 349 | 2013-05-14 | 32B-1-102 |

The plan's other leads were inventoried and touch no tracked section:

- 2012 S.B. 66 (ch. 365, effective 2012-07-01) amends 32B-2-201 to -209, 32B-2-302, 32B-2-605 and others.
- 2012 S4 S.B. 4001 (ch. 1, effective 2012-06-25) amends 32B-2-305 and Chapter 6 licence sections.

**Reconstruction**, per section:

1. *Effective dates.* Each bill's effective-date clause is read for the section. A clause that names the
   section in a form the parser does not recognise leaves the date unresolved; it is never guessed. The
   digest date is used only when the bill has no general date of its own (for example "takes effect upon
   approval").
2. *Amendments before commencement.* S.B. 12 and S.B. 314 amended the not-yet-operative Title 32B, so the
   first operative text on 2011-07-01 is chapter 276 with both applied. The chapter 276 wording of
   32B-1-102 never operated on its own and gets no interval.
3. *Before-text checks.* Each amending bill's text before its amendment must equal the state it amends, and
   its own history note must name the chapters that produced that state. All do.
4. *Same-day amendments.* Several bills amending one section on the same day are merged against their
   common base. The merge never orders them by bill number or signing date. For 32B-11-608 the word-level
   edits do not overlap. For 32B-1-102, S.B. 12 and S.B. 314 each insert definitions and renumber the same
   subsections. That merge is done definition by definition, with subsection numbers set aside, and
   compared with the Legislature's own print of the merged section (S.B. 2002's text before amendment).
   Every definition is identical; the print re-sorts one definition ("opaque") alphabetically. The print
   is then used as the operative text.
5. *Verification.* Each state is compared with the next independent official text of the same law: the next
   amending bill's text before amendment, or the 2014-01-01 Historical Code version. A match makes the state
   `reconciled`. A wording difference that changes no check result leaves it `reconstructed`. Any other
   difference makes it `unresolved`, and an unresolved state verifies nothing. Comparison normalizes only
   whitespace, case, quotation marks, spacing before closing punctuation and spacing between subsection
   labels. Words, numbers and negation are compared exactly.

**Result.** Every tracked section has text for every day from 2011-07-01 to 2013-12-31:

- *Matched exactly.* Eight sections match the 2014-01-01 code word for word. So does 32B-1-102 from
  2011-07-01 to 2013-05-13.
- *Reconstructed.* 32B-1-102 from 2013-05-14 (2013 H.B. 228) is `reconstructed`. The enrolled bill says
  "over consumption" where the 2014 code prints "overconsumption", probably a codification correction; no
  check depends on it.
- *Retrospective operation.* S.B. 2002 took effect 2011-07-28 with retrospective operation to 2011-07-01.
  Both texts of 32B-1-102 give the same result on every check, so the claims do not depend on which governs
  2011-07-01 to 2011-07-27.
- *Beer tax.* For 59-15-101, S.B. 167 changed nothing a check reads (see below).

## 2003-05-05 to 2011-06-30: the beer tax

**2003 S.B. 66**, *Alcoholic Beverage Enforcement and Treatment* (Laws of Utah 2003, chapter 307), was signed
2003-03-24. It has no effective-date clause, so it took effect on the general effective date, 2003-05-05.
It replaced section 59-15-101's single rate, "at the rate of $11 per 31-gallon barrel on all beer", with a
schedule:

- $11 per barrel for beer imported or manufactured before July 1, 2003;
- $12.80 per barrel for beer imported or manufactured on or after July 1, 2003.

No bill in any session from 2003 GS to 2010 S2 amended 59-15-101 again until 2010 S.B. 167. Its own
affected-sections list says the same: "as last amended by Laws of Utah 2003, Chapter 307". S.B. 66's text
matches S.B. 167's print of the section before amendment word for word, so 2003-05-05 to 2011-06-30 is
`reconciled`.

Two dates are kept apart: the statute in force from 2003-05-05, and the $12.80 rate step on 2003-07-01. The
$11 interval is known from 2003-05-05. The flat $11 text before S.B. 66 is cited "as last amended by
Chapters 30 and 66, Laws of Utah 1992". It is kept as a state with an unknown start, because 1992-2002 has
not been inventoried. The 1992 annotated Title 59 volume refuses automated download; see
`docs/gaps/utah-missing-records.md`.

## 2003-05-05 to 2011-06-30: Title 32A

Before 2011-07-01 the alcohol law was Title 32A, which 2010 S.B. 167 repealed on that day.

**Crosswalk.** The Office of Legislative Research and General Counsel's summary table for S.B. 167 lists, for
every Title 32A section in effect on 2009-07-01, the Title 32B sections into which "a significant portion"
of it went. It says it is "not a comprehensive analysis". It is pinned and parsed into
`utah_title32a_crosswalk.csv` (414 mappings for 271 sections). Each mapping is labelled with the plan's
relation types: renumbered, split, merged, repealed or unresolved. All are `finding_aid_unreviewed`: a
mapping says where to look, not that the old and new texts mean the same.

The predecessors of the tracked sections:

| Title 32B | Title 32A |
|---|---|
| 32B-1-102 (definitions) | 32A-1-105 (plus fragments from 32A-1-119.5, 32A-4-401, 32A-5-110, 32A-10-207) |
| 32B-7-201 | 32A-10-101 |
| 32B-4-402 | 32A-12-202 |
| 32B-4-401 | 32A-12-201 |
| 32B-11-208 | 32A-8-106 |
| 32B-11-608 | 32A-8-505 |
| 32B-2-601 | 32A-3-101 |
| 32B-2-603 | 32A-3-104 |
| 32B-2-501 (state stores, tracked from 2026-10-10) | 32A-2-101 (not inventoried, so the retail liquor-control claim starts 2011-07-01) |

**Text.** The 2002 S4 to 2010 S2 inventory finds 12 bills that amended these sections: 2003 S.B. 153 and
H.B. 244; 2004 S.B. 58; 2005 S.B. 65; 2006 S.B. 58; 2007 S.B. 205; 2008 H.B. 157, H.B. 171 and S.B. 211;
2009 S.B. 187, H.B. 250 and H.B. 352. All are pinned. Their texts rebuild each section from 2003 to its
repeal.

**The Legislature's own code pages of the time.** The Internet Archive kept the Legislature's Title 32A
section pages (`le.utah.gov/~code/TITLE32A/htm/...`), captured on 2008-07-10 and 2010-07-29, while Title
32A was in force. Each page gives the section's text, its history note and, in 2008, a "Last revised"
date. In 2010 each also carries the label "(Repealed 07/01/11)". The project pins 16 captures (8 sections,
two dates, `config/sources/utah_archived_code_pages.yaml`), requested one at a time, ten seconds apart, in
their original form. They are used two ways:

- *As a check.* The page is an official print of the state in force on its capture date. Every capture
  matches the text rebuilt from session laws word for word, once the pages' layout is normalized (a
  repeated section number, the repeal label, a repealer history line). That includes the 2008 text
  adopted from the 2009 print and the 2009 final text. Those states become `reconciled`; a contradicting
  page would make the state unresolved.
- *As the only text.* No 2003-2010 bill amended 32A-12-202 (the general rule, "unauthorized sale or
  supply"; history note "Renumbered and Amended by Chapter 23, 1990 General Session") or 32A-3-104
  (package agency issuing duties; "Amended by Chapter 4, 1993 General Session"). Their 2008 and 2010 pages
  agree word for word, and that text stands from 2003-05-05 to the repeal. 2003-05-05 is the first day
  from which every session that could amend them is inventoried, and the page's own history note shows
  no amendment from an earlier session. These states are `reconstructed`, not reconciled: the text is
  printed on two dates and its continuity rests on the inventory.

**Checks** are written separately for Title 32A because the wording differs. For example, '"wine" is
considered "liquor"', and before 2006 there is no "off-premise beer retailer" definition: 32A-10-101
itself lets local authorities license "food stores and other establishments" to sell beer for off-premise
consumption. Claims carry a second set of requirements for the Title 32A days (`CLAIMS_32A`). A day is
verified under whichever set has its texts in force, and the two titles never overlap.

**Rules the older bills needed:**

- *Bills of one session amend the session-start text.* For example, 2008 H.B. 171 (effective 2008-07-01)
  was drafted against the 2007 text, not against the 2008-05-05 state. A state starts on each effective
  date in the session and combines every bill of the session in force that day. Each bill's text before
  amendment must equal the session-start text, and its history note must name the previous session's
  chapters.
- *Conflicts without a coordination clause.* 2008 H.B. 157 and S.B. 211 rewrote the same definitions
  ("beer", "alcoholic beverage", "alcoholic product") in different words, and none of the three 2008 bills
  has a coordination clause. For 2008-07-01 onward, the operative text is taken from the Legislature's
  next print of the section (2009 S.B. 187's text before amendment, "as last amended by ... 2008, Chapters
  317, 322, and 391"). It is labelled `reconstructed`, not reconciled. For 2008-05-05 to 2008-06-30 no
  print shows the text. Those days carry check results only because the session-start text, each bill's
  text and the print all give the same results.
- *Split effective dates.* 2009 S.B. 187 took effect 2009-05-12, except that subsections (12), (23), (35)
  and (64) of 32A-1-105 waited until 2009-07-01. The text for those seven weeks is not reconstructed, but
  every check gives the same result with and without the delayed subsections.
- *Before-text differences no check reads.* 2004 S.B. 58's own markup strikes "o]r", leaving a bare "r".
  2005 S.B. 65's text before amendment does not have it. Such a difference is recorded, and the state is
  `reconstructed` rather than `unresolved`. A difference that changes a check result still makes the
  state unresolved.
- *Never-operative text.* The ch. 276 wording of sections that 2011 bills amended before 2011-07-01 is
  kept as an archived row (`operative = never`) with no days.

**Result.** Every claim is verified for every day from 2003-05-05 to 2011-06-30 under Title 32A:

- the grocery-wine "not authorized" value and the package-agency channel (`reconstructed`, through
  32A-12-202 and 32A-3-104);
- the beer-definition ceiling (`reconciled` except the four short runs named above);
- the corroborating supply-chain provisions (`reconciled`).

Each section's text before its first 2003 amendment is recorded with an unknown start.

## Scope of the grocery-wine claim

The question is narrow: **may an ordinary grocery retailer, under its ordinary off-premise retail
authorization, sell sealed wine to the public?** The coded dimension is
`ordinary_grocery_wine_authorization` (`authorized | not_authorized | conditional_or_special_channel |
unknown | disputed`).

| Role | Provision | Why it matters |
|---|---|---|
| Product definition | 32B-1-102: wine is liquor; liquor does not include beer | Wine is outside any authority limited to beer |
| Retailer category | 32B-1-102: an off-premise beer retailer is a beer retailer engaged in the retail sale of beer | Grocery and convenience stores sell alcohol in this category |
| Affirmative authority | 32B-7-201: local license "to sell beer at retail for off-premise consumption" (plus a beer-only state license from 2018, 32B-7-401, not yet versioned) | The ordinary authorization covers beer |
| General rule | 32B-4-402: a person authorized to sell an alcoholic product may sell only as the title authorizes | Nothing in the ordinary authorization extends to wine |
| Corroborating only | 32B-4-401(2), 32B-11-208, 32B-11-608: liquor shipped into the state goes to the department and listed others; in-state manufacturers and industry representatives sell liquor only to the department or military installations | Consistent with the conclusion, not needed for it |

**Special channels are separate.** A state-contract package agency (32B-2-601, 32B-2-603) lets a private
person sell sealed liquor, wine included, at state prices from premises the state does not own. The host
business type is a factor in issuing one, so an agency could sit inside another business. It is coded as
its own dimension (`state_contract_package_agency_channel`) and is **not** an ordinary grocery
authorization. Whether any agency operates inside a grocery store is an empirical question not answered
here.

Other channels and exceptions are listed in `claim_exceptions.csv` with a relevance decision: state
stores, military installations, special use permits, winery sales, personal importation and on-premise
licenses. Three of them are marked "not examined".

An earlier version of this coding cited 32B-4-401(1). That subsection binds "retail licensees", and a "retail
license" in Title 32B is an on-premise license, so it never supported a grocery conclusion. Validation now
rejects an indispensable dependency that binds only on-premise licensees.

## Claims and results (as of 2026-10-06)

| Claim | Role | Verified | Temporal status by period |
|---|---|---|---|
| `ut_ordinary_grocery_wine_not_authorized` | policy claim | 2003-05-05 to 2026-10-06 | Title 32A reconstructed to 2011-06-30; reconciled to 2013-05-13; reconstructed 2013-05-14 to 2013-12-31; anchored from 2014 |
| `ut_liquor_supply_to_department_corroborating` | corroborating | 2003-05-05 to 2026-10-06 | Title 32A to 2011-06-30 (reconciled, then reconstructed from 2004-05-03); reconciled to 2013-12-31; anchored from 2014 |
| `ut_package_agency_channel_available` | special channel | 2003-05-05 to 2026-10-06 | Title 32A reconstructed to 2011-06-30; reconciled to 2013-12-31; anchored from 2014 |
| `ut_beer_definition_max_4abv` | policy claim (4% ABV or 3.2% ABW, as written) | 2003-05-05 to 2019-10-31 | Title 32A to 2011-06-30 (reconciled and reconstructed runs); as the grocery-wine claim to 2013; anchored from 2014 |
| `ut_beer_definition_max_5abv` | policy claim (5% ABV or 4% ABW, as written) | 2019-11-01 to 2026-10-06 | anchored |
| `ut_beer_tax_2003_schedule` | policy claim ($11 before 2003-07-01, $12.80 from then, as 2003 S.B. 66 wrote it) | 2003-05-05 to 2019-10-31 | reconciled to 2013-12-31; anchored from 2014 |
| `ut_beer_tax_1280` | policy claim | 2003-05-05 to 2019-10-31 | reconciled to 2013-12-31; anchored from 2014 |
| `ut_beer_tax_1310` | policy claim | 2019-11-01 to 2024-04-30 | anchored |
| `ut_beer_tax_2024_schedule` | policy claim ($13.10 before 2024-07-01, then $13.35, $13.60, $13.85 each July 1) | 2024-05-01 to 2026-10-06 | anchored |
| `ut_liquor_wholesale_by_department` (added 2026-10-10) | policy claim (wine is liquor; liquor enters only through the department; manufacturers and industry representatives sell liquor only to the department) | 2003-05-05 to 2026-10-06 | Title 32A to 2011-06-30 (reconciled, with reconstructed runs 2004-05-03 to 2005-05-01, 2008-05-05 to 2008-06-30 and 2009-05-12 to 2009-06-30); reconciled to 2013-05-13; reconstructed 2013-05-14 to 2013-12-31; anchored from 2014 |
| `ut_liquor_retail_state_stores_and_agencies` (added 2026-10-10) | policy claim (state stores staffed by state employees, 32B-2-501; contract package agencies, 32B-2-601; sale only as authorized, 32B-4-402; wine is liquor) | 2011-07-01 to 2026-10-06 | reconstructed to 2013-12-31; anchored from 2014 |

A curated interval's `temporal_status` is the weakest basis among the days it claims
(`reconstructed` < `reconciled` < `anchored`).

The 4% to 5% and $12.80 to $13.10 transitions fall exactly on 2019-11-01, the date in the enacted 2019
S.B. 132, found independently from the version texts. Alcohol-by-weight and alcohol-by-volume limits are kept
as written; neither is converted into the other.

## Limits

- The checks are text matches on cited provisions, not a full legal analysis. All claims await maintainer
  review.
- Completeness of the 2011-2013 inventory is for the tracked sections. A new section enacted in those years
  that changed the answer without amending a tracked section would be missed. The same is true of the
  Historical Code ledger from 2014. Newly enacted Title 32B sections are listed in `utah_enactments.csv` for
  review.
- Nothing before 2003-05-05 is verified. Under Title 32A, the exceptions register was examined only at
  the level of the special channels (state stores, package agencies), not text by text. The source-expansion plan (`docs/plans/`) lays out the
  route, and `docs/gaps/utah-missing-records.md` lists the records needed, with draft requests.
- Calendar year 2011 has 184 verified and 181 unknown days; `policy_exposure` keeps both and reports
  minimum/maximum exposure bounds instead of discarding the known part. Utah fiscal years 2012 onward are
  fully known (FY2012 begins on the day Title 32B commenced).
