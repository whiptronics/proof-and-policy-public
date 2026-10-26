# Utah Alcohol Policy Data: Historical Source Expansion and Verification

## Claude development plan — extend the existing implementation

> **Status (2026-10-11).** Packages 1-6 are done as far as free records reach (docs/progress.md, log
> entries of 2026-10-07). Every Utah claim is verified day by day from 2003-05-05 (Title 32A to
> 2011-06-30, Title 32B after), except the retail liquor-control arrangement, verified from 2011-07-01
> (added 2026-10-10 with 32B-2-501; its Title 32A predecessor, 32A-2-101, is not inventoried). Before
> 2003 waits on the records in docs/gaps/utah-missing-records.md (draft requests, none sent). This plan is
> kept as the record of what was asked; current work follows docs/plans/nationwide-expansion.md.

Prepared October 6, 2026, America/Denver. Scope: historical Utah alcohol law, especially 1990–2013, with supporting tax and fiscal records. Intended repository: the user's existing alcohol-policy-data project; confirm its actual path and remote. This document supplements the earlier general open-data plan and responds specifically to the attached implementation report.

## 1. Objective and current-state boundary

Extend the existing Utah legal-history pipeline backward from its reported January 1, 2014 starting point. Build an auditable account of grocery wine authorization, grocery beer strength limits, and beer excise taxes. Preserve source documents, enacted amendments, effective dates, and the reasoning connecting them to each policy observation.

The supplied report describes six tracked sections, 28 downloaded versions, 12 policy intervals awaiting review, and 84 passing tests. Those are reported implementation facts, not independently inspected repository facts. First inspect the actual code, tests, source manifests, and generated outputs. Do not recreate a working subsystem unnecessarily, claim those tests were independently run, or mark the pending intervals reviewed merely because the report says the parser passed.

Existing sections reported:

- 32B-1-102: definitions.
- 32B-4-401 and 32B-4-402: sale-related provisions whose applicability must be distinguished.
- 32B-11-208 and 32B-11-608: manufacturing/industry provisions.
- 59-15-101: beer tax.

The six-section list is a starting inventory, not a proof that all relevant authorizations and exceptions have been examined. Expand the dependency set to the actual off-premise beer, state-store, package-agency, importation, and other relevant provisions discovered in each historical edition.

### Concrete first target

Reconstruct July 1, 2011–December 31, 2013 and compare the resulting January 1, 2014 state against the existing historical-code snapshot. Then reconstruct Title 32A backward through 1990, including the law in force before any 1990 recodification. Track the tax history separately: Title 59 does not automatically change legal identity when Title 32A becomes Title 32B.

Do not promise complete 1990 coverage until the source chain exists. Publish verified subintervals and precise gaps as work progresses.

## 2. Findings established during preparation

### Confirmed recodification anchor

The Utah Legislature's official status page for **2010 S.B. 167, Alcoholic Beverage Control Act Recodification**, identifies Chapter 276, governor signature on March 29, 2010, and effective date **July 1, 2011**. Source: https://le.utah.gov/~2010/bills/static/SB0167.html

Therefore, do not assign Title 32B to the whole of calendar 2010. The enacted text and coordinating amendments must establish the operative provisions at the 2011 transition. A bill can be enacted, amended before commencement, and never operate in its original form.

### Older records exist beyond the historical-code interface

The January 2014 boundary described in the report is an interface boundary, not proof that earlier laws cannot be obtained. The Utah State Archives offers an online Laws of Utah collection described as 2001–2023. The University of Utah hosts a historical annotated-code collection and a specific **1992 Title 59, Chapters 15–21** item that includes beer-tax material. Links and retrieval status appear below.

### Two important limitations

1. I did not locate and verify a freely downloadable 1990 Title 32A baseline in this research. The University collection's broad date range does not establish that this particular volume or all pocket parts are present.
2. Several official file links return access errors through automated retrieval. They are listed accurately as download candidates or catalog-confirmed files, not as successfully downloaded and reviewed legal evidence.

## 3. Source register: free PDFs, official files, and access routes

### Status legend

- **R — Readable:** page or PDF content was returned during this research. Not a statement that every provision has been legally reviewed.
- **C — Catalog/index confirmed:** the institution lists the resource or its direct link, but the underlying file was not fully retrieved here.
- **B — Retrieval blocked/error:** an attempted link returned an access error, size limit, or similar issue. Use its official landing page/manual import route; do not bypass restrictions.
- **D — Discovery resource:** a research guide, archive, or index to find exact files; not itself sufficient evidence of a policy value.

All status observations are as of this plan's preparation. Recheck during implementation. Free access and permission to redistribute full files are separate questions, especially for publisher annotations and library-licensed databases.

### A. Recodification and immediate amendments

| ID | Resource and links | Status | What Claude should do |
|---|---|---|---|
| UT-2010-SB167-STATUS | [Official status](https://le.utah.gov/~2010/bills/static/SB0167.html) | R | Save enactment, chapter, and effective-date evidence; verify those fields against the enacted effective-date clause |
| UT-2010-SB167-PDF | [Enrolled PDF](https://le.utah.gov/~2010/bills/sbillenr/sb0167.pdf) | C/B | Core recodification file. Official indexed link, but direct retrieval returned a rejection here; obtain through the official bill page or manual download |
| UT-2010-SB167-HTML | [Enrolled HTML](https://le.utah.gov/~2010/bills/sbillenr/sb0167.htm) | C/B | Official text indexed; this research tool encountered a size limit. Use a permitted local download and bounded parser; do not equate a tool size limit with missing law |
| UT-RECODIFICATION-INDEX | [Legislature recodification index](https://le.utah.gov/lrgc/recodification.htm) | C/B | Indexed entry identifies Title 32A recodification and July 1, 2011 transition. Inspect for a conversion table; no alcohol-specific downloadable crosswalk was verified here |
| UT-2011-SB12 | [Enrolled PDF](https://le.utah.gov/~2011/bills/sbillenr/SB0012.pdf), [status](https://le.utah.gov/~2011/bills/static/SB0012.html) | R | PDF returned as 103 pages. Extract relevant changes and effective/coordination clauses. Do not substitute the introduced bill for the enrolled text |
| UT-2011-SB314 | [Enrolled PDF](https://le.utah.gov/~2011/bills/sbillenr/SB0314.pdf), [status](https://le.utah.gov/~2011/bills/static/SB0314.html) | R | PDF returned as 197 pages. Status identifies Chapter 334 and July 1, 2011 effective date; reconcile amendments at the recodification boundary |
| UT-2013-HB228 | [Enrolled PDF](https://le.utah.gov/~2013/bills/hbillenr/hb0228.pdf), [status landing](https://le.utah.gov/~2013/bills/static/HB0228.html) | PDF R; status B | PDF returned as 44 pages. Candidate for definitions and accounting/fund provisions. Resolve chapter and operative dates before adding intervals |
| UT-2012S4-SB4001 | [Enrolled PDF](https://le.utah.gov/~2012S4/bills/sbillenr/sb4001.pdf), [status landing](https://le.utah.gov/~2012S4/bills/static/SB4001.html) | C/B | Official indexed special-session bill. Inspect delayed dates and revisor instructions. Demonstrates why a general-session-only search is incomplete |

These bills are a seed list, not an exhaustive amendment inventory. The 2011 S.B. 12 and S.B. 314 files must be read for their exact affected sections and coordination, not merely their titles.

### B. Older-code and session-law collections

| ID | Resource and links | Status | Intended use |
|---|---|---|---|
| UT-UCA-COLLECTION | [University of Utah annotated-code collection](https://dc.law.utah.edu/uca/) | R/D | Browse editions, title-specific files, replacement volumes, tables, and supplements. Collection title says 1943–1995; verify actual title/year coverage |
| UT-UCA-TAX1992 | [1992 Title 59 Chapters 15–21 item](https://dc.law.utah.edu/uca/283/) | R/C | Specific cataloged historical beer-tax source, not a generic archive pointer |
| UT-UCA-TAX1992-PDF | [Direct download linked by that item](https://dc.law.utah.edu/cgi/viewcontent.cgi?article=1311&context=uca) | B | Returned 403 here. Use the item page's Download link manually if permitted. Do not pretend the tax rate was read from this file |
| UT-UCA-INDEX2 | [Collection page containing 1992 tax volumes](https://dc.law.utah.edu/uca/index.2.html) | R/D | Also links Chapters 11–12 on sales tax and the Title 59 tables; capture exact item/download URLs from the page |
| UT-LAW-LIBRARY-GUIDE | [University legal-materials guide](https://www.law.utah.edu/library/laws-legislative-materials-for-the-state-of-utah/) | R/D | Official university gateway to historical statutes and annotated codes; useful if collection links move |
| UT-SESSION-ARCHIVE | [State Archives Laws of Utah](https://archives.utah.gov/research/digital/laws-utah/) | R/D | Archive describes 2001–2023 online volumes; open each volume for full-text search and downloads |
| UT-SESSION-VIEWER | [Laws of Utah collection viewer](https://images.archives.utah.gov/digital/collection/p17010coll78/search) | C/D | Viewer did not expose substantive volume text in this tool; use supported public download links or permitted manual downloads |
| UT-SESSION-LIBRARY | [Public-library access to Utah session laws](https://onlinelibrary.utah.gov/library-resource/lehipl/heinonline/) | R/D | Describes 1851–present access supplied to Utah public libraries. This is a library-mediated route; verify eligibility, login, and download terms. It is not an anonymous bulk API |
| UT-ARCHIVES-GUIDE | [Archives legislative-records guide](https://archives.utah.gov/research/guides/legislative/) | R/D | Explains code history citations and session-law research |
| UT-STATUTES-INVENTORY | [Archives Series 1052 inventory](https://archives.utah.gov/research/inventories/series/1052/) | C/D | Identifies physical/microfilm code holdings; inventory entries do not imply downloadable scans |
| UT-BYU-GUIDE | [BYU historical-code guide](https://lawlibrary.byu.edu/information/historical-utah-codes/) | C/D | Additional library route for missing editions and supplements; identifies University of Utah digitization work |

For 1990–2000, prioritize a contemporaneous code baseline plus the complete relevant session-law chain. The accessible Archives collection beginning in 2001 does not cover the entire earlier period by itself. Do not purchase a subscription; use available free institutional access or request the exact missing pages from the library when needed. Draft requests first; do not send messages automatically.

### C. Rules and legal-research PDFs

| ID | Resource and links | Status | Intended use |
|---|---|---|---|
| UT-LEGAL-RESEARCH-PDF | [Utah Legislative History Resources PDF](https://www.utcourts.gov/content/dam/lawlibrary/docs/legislative_website.pdf) | R | Three-page State Law Library guide, revised June 2020. Use its archive descriptions, while checking old links and current access conditions |
| UT-RULES-INDEX2012 | [2012 Administrative Rules Index of Changes PDF](https://rules.utah.gov/wp-content/uploads/2012index.pdf) | R | 199-page index returned here. Locate R81 changes and their rule-file numbers/effective dates |
| UT-RULES-BULLETIN2012 | [December 1, 2012 Bulletin PDF](https://www.rules.utah.gov/wp-content/uploads/b20121201.pdf) | C | Indexed official PDF containing rule activity and effective-date information; inspect actual pages before coding |
| UT-RULES-MAY2012 | [May 15, 2012 Bulletin PDF](https://rules.utah.gov/publicat/bull-pdf/2012/b20120515.pdf) | C/B | Linked by official rule notices, but retrieval failed here. Proposals need later adoption/effective-date verification |
| UT-RULES-SB66-LEAD | [Official rule notice DAR 36114, R81-7](https://rules.utah.gov/publicat/bulletin/2012/20120515/36114.htm) | C | Describes implementation of 2012 S.B. 66; discovery evidence to resolve the bill's final enacted version, not a substitute for enacted statutory text |
| UT-RULES-2002 | [March 1, 2002 Bulletin PDF](https://www.rules.utah.gov/wp-content/uploads/b20020301.pdf) | C | Indexed historical R81 material referencing Title 32A. Use to locate contemporary definitions/implementation rules, not to assume every proposal took effect |
| UT-RULES-PUBLICATIONS | [Office of Administrative Rules publications](https://rules.utah.gov/publications/) | C/D | Find historical code editions, bulletins, and annual change indexes |

Do not confuse a proposed rule's earliest possible effective date with its actual effective date. Record adopted, withdrawn, expired, emergency, and amended rule status separately. Maintain statutes and administrative rules as distinct source types.

### D. Supporting fiscal files

| ID | Resource and links | Status | Intended use |
|---|---|---|---|
| UT-TAX-FY1990 | [Tax Commission FY1990 annual report PDF](https://files.tax.utah.gov/tax/commission/reports/fy1990annualreport.pdf) | C/B | Indexed official report; retrieval hit a roughly 29.6 MB tool limit. Look for beer-tax tables and legislative summaries; they corroborate but do not replace operative law |
| UT-SB66-FISCAL | [2012 S.B. 66 fiscal note HTML](https://le.utah.gov/lfa/fnotes/2012/SB0066.fn.htm) | C | Official fiscal-note lead. Keep projected impacts distinct from observed receipts and match the note to the bill version |
| UT-DABS-REPORTS | [DABS annual-report archive](https://abs.utah.gov/about-dabs/news/annual-reports/) | D | Earlier project source; discover exact historical agency reports and record actual available years |
| UT-TAX-SALES | [Tax Commission sales reports](https://tax.utah.gov/commission/econstats/sales/) | D | Earlier project source; tax collections and taxable sales remain separate measures |

Do not infer a statutory rate by dividing receipts by apparent consumption. Exemptions, timing, product definitions, inventories, tax base, and imports can differ. A fiscal note estimates effects; it is not a before/after evaluation.

## 4. Immediate corrections to confidence and scope

### A. Separate parser success from legal verification

The current phrase-removal tests are useful regression tests. They establish that the code responds to selected text. They do not establish that the selected provisions govern ordinary grocery sales or that all exceptions were considered.

Add independent fields:

```text
retrieval_status: discovered | fetched | blocked | missing
extraction_status: unparsed | parsed | checked_against_original | uncertain
temporal_status: unresolved | anchored | reconstructed | reconciled
legal_review_status: unreviewed | machine_assisted_review | maintainer_reviewed | expert_reviewed
claim_status: supported | contradicted | incomplete | ambiguous
```

A claim can be textually supported but not yet independently reviewed. Show those facts honestly. Do not call machine-assisted review independent legal review. Store reviewer identity/type only when real; never invent a lawyer or institutional approval.

### B. Narrow the grocery-wine claim

Use a clearly defined research question: may an ordinary grocery retailer, under the applicable ordinary off-premise retail authorization, sell sealed table wine to the public? Explicitly define wine and relevant alcohol-content category for each period.

Review separately:

- Ordinary off-premise beer retailer authority and scope.
- State stores and package-agency arrangements, including possible business co-location.
- Manufacturing or other special authorizations.
- Import, military, sacramental, personal-use, or other exceptions if relevant to the supporting chain.
- On-premise licenses that do not answer the grocery-retail question.

Do not repeat an absolute statement that every legal liquor supply route passes through the state unless all applicable exceptions and the intended scope actually support it. A narrow grocery-authorization finding may be supportable even when the broad statement is not. Do not extrapolate personal import or military exceptions into grocery-sale permission either.

### C. Preserve partial fiscal-year knowledge

FY2014 is not wholly unknowable simply because July–December 2013 is unverified. Keep its verified January–June 2014 subinterval and report the unknown portion separately. Preserve existing conservative analysis exclusions until full coverage is established.

Output total days, supported days, unknown days, disputed days, and policy-state days. Do not assign a known state's value to an entire fiscal year or silently discard its known portion. Annual minimum/maximum exposure bounds may be derived from known and unknown days, explicitly labeled as bounds.

### D. Use an explicit observation cutoff

The pasted report uses dates through October 7 while the user's local date is October 6. Configure `as_of_date` explicitly with its timezone and date semantics. Store document retrieval timestamps in UTC. Distinguish future scheduled law from already-operative law. A future effective provision is not a historical observation.

## 5. Inspection and preservation tasks

1. Read project instructions, README, `docs/progress.md`, and `docs/methods/legal-history.md`.
2. Locate current history discovery, parsing, claims, policy-exposure, source-refresh, and packaging modules using repository search.
3. Run the documented existing tests once and record real baseline results and commit ID.
4. Capture current generated row counts and policy intervals in a regression snapshot outside ordinary committed binary artifacts.
5. Create a source-expansion branch or other existing project workflow. Preserve user edits; do not force-reset.
6. Inventory all 12 reported pending review intervals. Do not automatically approve them.
7. Add this source plan to project documentation and adapt module names to the existing architecture.

The implementation should extend existing CLI and schemas, not introduce a competing database or a second canonical law ledger.

## 6. Acquisition and source pinning

Add source descriptors for the specific links in Section 3. Source descriptors must distinguish official bill landing pages, enrolled texts, session-law volumes, historical code editions, supplements, rules, and fiscal reports.

Required metadata:

```text
asset_id; source_family; publisher; title; jurisdiction
session_year; session_type; session_number; bill_number; bill_version
chapter_number; document_kind; edition_or_supplement
landing_url; download_url; resolved_url
retrieved_at_utc; byte_length; sha256; detected_format
access_status; access_error; rights_status; local_path
coverage_start; coverage_end; coverage_basis
parser_version; extraction_status; original_page_count
```

Date fields may be null when unresolved. Do not manufacture coverage dates from publication year. A PDF uploaded recently can contain a decades-old law; upload date is not enactment or commencement.

Fetch conservatively using the project's existing rate limiter. Use bounded retries for transient errors. Treat 403/rejection pages as blocked access; do not switch identities, evade controls, or hammer URL variants. An allowed manual download can be imported with its original URL and checksum. For a tool size limit, use an ordinary permitted local file download if available. Keep credentials out of manifests and logs.

Check actual bytes and MIME type: `.pdf` URLs can return HTML rejection pages with HTTP 200. Quarantine those responses and record the error instead of counting them as statutory evidence.

Raw source files should remain immutable in a local cache. Publicly redistribute only files whose applicable terms permit it. A scanned annotated volume includes editorial material that needs separate treatment from enacted statutory text. Do not bundle all annotations under the project's software license.

## 7. Build a complete session inventory

The seed bill list is not enough to establish continuity. For each covered year, enumerate general and special sessions from official indexes. Retain the session index itself as evidence of the search universe.

For each session:

1. Locate enacted-law/bill indexes, chapter tables, code-sections-affected tables, and relevant session-law volumes.
2. Search section numbers and historical predecessors, not just bill titles containing alcohol.
3. Search affected definitions and referenced authorization sections recursively.
4. Record all candidate bills, including false positives and excluded introduced/substituted/vetoed bills.
5. Resolve the final version and legal disposition from official status and chapter records.
6. Capture all effective-date, delayed-operation, coordination, repeal, and revisor clauses.
7. Record reviewed sessions with no relevant changes and the evidence supporting that conclusion.

Suggested discovery terms include `32A`, `32B`, `59-15`, `beer`, `heavy beer`, `wine`, `liquor`, `off-premise`, `package agency`, `manufacturer`, `import`, `effective`, `coordination`, `renumbered`, and every dependency section number.

Search hits are candidate evidence only. No hits from a web search do not prove no amendment. Record search coverage as `complete_for_declared_dependencies`, `partial`, or `unresolved`, with the actual reviewed index/volume IDs.

### Specific trap: 2012 S.B. 66

Search results for an early version describe a substituted bill, while official administrative-rule notices describe implementing S.B. 66. Resolve the entire version chain from official session records rather than accepting a third-party status label. The final enrolled file was not retrieved during this plan. Track it as a discovery task. Never mark the law dead merely because an original version was superseded, or enacted merely because a proposal exists.

### Specific trap: the 1990 starting point

The 2010 recodification's indexed history references a 1990 Chapter 23 renumbering for older sections. This is a research lead, not an inspected 1990 act. Locate the chapter, identify its commencement, and find the law operating on January 1, 1990. A 1990 replacement statute effective later that year cannot establish the first months of 1990.

## 8. Parse legislative documents without losing amendments

Maintain three representations where the source supports them:

1. Original bytes and page images/HTML.
2. Extracted text preserving subsection and page/line locators.
3. Reviewed operative section text for the relevant effective interval.

Never strip all bracketed content or all underlining blindly. Legislative deletion/addition conventions must be detected for that document family. Plain PDF text can lose strike-through, underline, and layout. Validate reconstruction against the original page, HTML markup, or the published session law. A removed numeric tax rate must not survive alongside its replacement as two live rates.

Store both printed page numbers and zero-based or one-based PDF page indexes with the indexing convention named. Save line numbers when printed in bill text. Strip recurring headers only through tested rules. Preserve `not`, `except`, numerical inequalities, alcohol measurement basis, and actor scope.

Use embedded PDF text before OCR. For scans, retain OCR confidence and page references. Manual/OCR transcription of critical dates, rates, or negation requires original-page checking. No extracted snippet becomes canonical simply because a model recognizes likely language.

## 9. Reconstruct July 2011 through January 2014

### Algorithm

1. Parse 2010 S.B. 167 as an enacted future code, with its documented commencement.
2. Discover all amendments to its relevant provisions passed before commencement, including 2011 general and special sessions as applicable.
3. Apply effective-date and coordination rules to derive the section state at July 1, 2011. Do not expose a never-operative intermediate version as law in force.
4. Walk all relevant enactments through 2012 and 2013, splitting intervals at each operative change.
5. Resolve multiple acts affecting the same section using explicit legal coordination/revisor evidence. Do not use bill-number order, download order, or a universal last-signature-wins shortcut.
6. Compare the reconstruction against the first available 2014 code version at the boundary.
7. Emit exact normalized-text diffs plus substantive differences. Normalize whitespace and layout only; never normalize away negation, dates, actor definitions, or numeric values.
8. Resolve mismatches or quarantine the affected claim interval.

Equality with the 2014 endpoint is a valuable check, but cannot prove that no temporary intervening change occurred. Session completeness evidence is still required.

### Half-open intervals

Represent operative periods as `[start_date, end_date)`. Store commencement and cessation evidence independently. Distinguish metadata interpretations: `effective until`, `superseded`, and effective-on dates may need source-specific normalization. Do not assume the date semantics without checking the official convention.

Keep archival versions and operative versions separate. A future version superseded before commencement can remain in the archival ledger with `never_operative`, but creates no operative interval. Repeal or absence of a provision is an explicit state; a gap-free test must not pressure the system into inventing a replacement.

## 10. Reconstruct Title 32A, 1990–June 2011

### Build a provision crosswalk

Create many-to-many mappings between historical provisions and policy concepts. A recodification can split or combine sections, so do not assume one old section maps to one new section.

```text
mapping_id; old_title; old_section; old_subsection
new_title; new_section; new_subsection
policy_concept; relation_type
effective_date; mapping_source_asset; locator
text_change_summary; mapping_review_status
```

Allowed relationships: renumbered, split, merged, repealed, substantially rewritten, and unresolved. Label unchanged-in-substance only after checking the relevant text, not because the bill title says recodification.

### Establish historical anchors

For each desired baseline, acquire the volume's title/copyright page, statutory text, history notes, and applicable pocket parts/supplements. Record the actual through-date. A 1992 book is not necessarily complete through December 31, 1992.

Start from whichever verified anchor has the shortest complete path to the desired interval. Forward reconstruction from an earlier code plus enacted amendments is preferred. Backward reconstruction can be used only where old/deleted text and the full change chain make it defensible; record the method and validate against another anchor. Later history notes guide discovery but do not by themselves prove continuous earlier wording.

### Missing-source fallback

If no free public scan resolves the 1990 baseline, write a specific request draft for the University of Utah law library or State Law Library:

- Code volume and supplement containing Title 32A at the beginning of 1990.
- Relevant pages of Laws of Utah 1990, Chapter 23, including the effective-date clause and affected-section table.
- Historical Title 59-15-101 text and relevant predecessor sections/supplements.
- Citation/edition details and whether scans may be publicly redistributed.

Do not send the request or agree to fees without the user's instruction. Keep developing the 2011–2013 module while older scans are unresolved. Maintain targeted missing-record tasks, not a vague instruction to find all old Utah laws.

## 11. Claim dependency graph and exception register

Represent each policy conclusion as a claim with required supporting provisions, applicable definitions, and reviewed exceptions. A supported conclusion requires temporal overlap across every indispensable dependency.

For the grocery-wine question, record:

- Product definition for the beverage being studied.
- Applicable retailer/license/permit category.
- Affirmative authority and its product limits.
- Relevant general prohibition and authorized exceptions.
- Special channels that could change the meaning of grocery access.
- Geographic scope and any relevant local conditions.

Do not infer the absence of all grocery authorization solely from manufacturer/representative supply restrictions. Inspect the retail authorization system itself.

Add `exceptions.csv` with claim ID, provision, actor, transaction, product, geography, dates, relevance decision, evidence, and review status. Maintain plain-language reasoning that another researcher can audit. Regex and keyword functions may locate text; the reviewed claim specification must state why the text answers the question.

### State classification

Prefer an expressive classification over a misleading universal Boolean:

```text
ordinary_grocery_wine_authorization:
  authorized | not_authorized | conditional_or_special_channel | unknown | disputed
```

Define each class in the dictionary. If the existing dataset needs a Boolean, derive it only for rows where the target transaction and channel are unambiguous. Keep special-channel findings in separate measures rather than silently collapsing them.

## 12. Beer strength and tax schedules

Maintain distinct metrics for beer definition, ordinary off-premise strength ceiling, beer/heavy-beer tax rate, and other alcohol taxes/markups. An upstream product definition is not automatically the retail authorization rule.

Required numeric metadata:

- Original value and unit.
- Alcohol by weight versus alcohol by volume, explicitly preserved.
- Inclusive/exclusive threshold.
- Product category and any lower threshold.
- Statutory barrel/container definition and volume units.
- Tax base, taxpayer, exemptions, and collection period.
- Effective interval of each scheduled rate, separate from the law's overall effective date.

Do not silently convert 3.2% ABW to 4% ABV as an exact legal equivalence. Preserve statutory language and any separately supplied ABV value. Do not infer a beer tax as a wine tax or a liquor markup.

The supplied report says a 2024 law contains later scheduled beer-tax steps. Parse each scheduled commencement independently; May enactment/commencement does not mean every scheduled rate starts in May. Validate the existing 2019 and 2024 schedule boundaries against enacted sources during implementation rather than treating this plan as independent verification of those amounts.

For annual descriptive outputs, a day-weighted statutory rate can be provided with an explicit label. It is not the effective tax paid per barrel unless sales volumes and timing justify that calculation. Keep total tax receipts and inferred effects out of this legal-history module.

## 13. Schema extensions and repository integration

Adapt these logical tables to the repository's existing source and policy schema:

| Table/file | Purpose |
|---|---|
| `legal_assets` | Links existing source assets to session, bill version, chapter, edition, and access status |
| `session_inventory` | General/special sessions and completeness evidence |
| `enactment_events` | Enactment, amendment, repeal, coordination, and commencement events |
| `section_versions` | Archival text, operative intervals, predecessor/successor relationships |
| `provision_crosswalk` | Many-to-many Title 32A/32B mapping |
| `claim_dependencies` | Required provision and definition relationships |
| `claim_exceptions` | Reviewed exclusions and special channels |
| `claim_assessments` | Policy conclusion, evidence status, reviewer status, supported window |
| `coverage_segments` | Known, unknown, and disputed intervals without forced filling |
| `historical_validation_report` | Boundary reconciliations, conflicts, pending reviews, and source gaps |

Suggested additional paths, only if compatible with the project:

```text
config/sources/utah_session_laws.yaml
config/sources/utah_historical_code.yaml
config/sources/utah_administrative_rules.yaml
data/curated/utah/session_inventory.csv
data/curated/utah/provision_crosswalk.csv
data/curated/utah/claim_dependencies.csv
data/curated/utah/claim_exceptions.csv
docs/sources/utah-historical-source-catalog.md
docs/methods/utah-pre2014-reconstruction.md
docs/review/utah-policy-review-packet.md
docs/gaps/utah-missing-records.md
```

Do not add downloaded binaries to normal Git history without checking project policy, size, and rights. Keep redistributable release assets and source manifests linked, with hashes for reproducibility.

## 14. Proposed CLI behavior

Extend the actual existing command namespace; the following syntax is illustrative until implemented:

```bash
alcohol-data legal inventory --state UT --from 1990 --through 2013
alcohol-data legal fetch --source-set utah-pre2014
alcohol-data legal import-file --asset-id <catalog-id> --path <downloaded-file>
alcohol-data legal extract --state UT --from 2010 --through 2013
alcohol-data legal reconstruct --state UT --from 2011-07-01 --until 2014-01-01
alcohol-data legal reconcile --state UT --at 2014-01-01
alcohol-data legal coverage --state UT --fiscal-years 1990:2026
alcohol-data legal review-packet --state UT
alcohol-data validate --profile release
```

Explicit options must include offline mode, pinned source manifest, as-of date, and whether unreviewed rows may appear in exploratory output. Production exports should label review status or exclude unresolved claims according to the repository's documented policy. Keep local import usable without modifying source code or requiring an external API key.

## 15. Tests that address real remaining risks

Preserve the existing tests and add fixtures targeting new risks. Use small permitted excerpts or synthetic fixtures for unit tests, and documented full assets for optional integration checks.

| Test | Required behavior |
|---|---|
| Enacted in 2010, effective July 2011 | Does not assign Title 32B to 2010 operating law |
| Amendment before first commencement | Emits only the operative combined version |
| Superseded before effective date | Retains archive record, creates no live interval |
| Introduced/substituted versus enacted | Original draft cannot become policy merely because it contains matching text |
| Special-session change | Is included in discovery and changes the correct interval |
| Coordination clause | Produces documented merged state or a blocking conflict, never an arbitrary ordering |
| Negation and exception | A change in actor or exception can invalidate a conclusion even when its keyword remains |
| Retail licensee category | On-premise provision alone cannot support ordinary grocery restriction |
| Package-agency channel | Does not silently equate a special authorization with ordinary grocery permission |
| PDF strike-through or brackets | Deleted rates/phrases do not survive as operative text |
| ABW/ABV | Preserves distinct units; refuses silent exact conversion |
| Tax schedule | Separates statute commencement from later rate steps |
| 2014 reconciliation | Reports meaningful text differences and unresolved claims |
| Incomplete FY2014 | Exposes known and unknown days; no fabricated full-year status |
| Source failure | HTML rejection page cannot be registered as parsed PDF evidence |
| Review independence | Machine checks cannot silently set human/expert review flags |
| Source completeness | Missing special-session inventory prevents a claim of complete session review |
| As-of cutoff | Future operative dates stay scheduled, not historical |

Boundary tests should examine the day before, the day of, and the day after each transition, plus fiscal-year and leap-day behavior. Tests should not require the entire desired 1990–present range to be gap-free: gaps may be the correct research result. Require no unjustified overlap within a resolved claim and explicit representation of unresolved periods.

## 16. Review packet and publishable outputs

Generate a human-readable packet for every claim interval with:

1. Exact claim and transaction/channel scope.
2. Start/end dates and why those dates were chosen.
3. Effective law versions and dependency diagram or concise dependency table.
4. Source URLs, hashes, edition, page/line locators, and short relevant excerpts.
5. Enactment/amendment sequence and coordination decisions.
6. Exception findings and remaining ambiguity.
7. Text extraction checks versus legal review status.
8. Changes from the prior release and downstream affected fiscal-year rows.

Public downloads should include source inventory, provision crosswalk, enactment timeline, policy intervals, annual coverage, and missing-record log. Include reusable CSV/Parquet exports through the existing packaging system. This can be useful even before 1990 reconstruction is complete.

The public status should say, for example, which claims have reconstructed evidence for which periods and which await review. Do not say all Utah alcohol law is verified every day when only selected policy dimensions and dependencies were evaluated.

## 17. Ordered work packages and completion gates

### Package 1 — Audit the existing claims

- Inspect repository state and actual tests.
- Preserve current source pins and outputs.
- Add separate extraction, temporal, and legal-review fields.
- Narrow the grocery-wine claim and enumerate authorization/exception dependencies.
- Repair overbroad documentation before expanding it backward.

Gate: the current results' exact scope and pending review are explicit.

### Package 2 — Pin the recodification anchor

- Register S.B. 167 status and enrolled-file candidates.
- Acquire the enacted text through a permitted route.
- Extract Chapter 276 and effective-date evidence.
- Discover 2011 pre-commencement amendments and coordination clauses.

Gate: a source-backed July 1, 2011 initial operative state, or clearly bounded unresolved dependencies.

### Package 3 — Close 2011–2013

- Build the complete session/affected-section inventory.
- Process relevant general and special session acts, including seed bills in this plan.
- Reconcile with the 2014 snapshot.
- Update FY2012–FY2014 coverage only for supported claims.

Gate: no unexplained boundary differences and no claim of continuity based solely on endpoint equality.

### Package 4 — Extend through Title 32A

- Build the provision crosswalk.
- Locate baseline volumes and supplements.
- Obtain and inspect the 1990 Chapter 23 lead; determine the opening-1990 law.
- Reconstruct supported intervals with complete relevant amendment searches.
- Produce targeted missing-record requests for unresolved spans.

Gate: individually evidenced historical intervals; no backfilled guesses.

### Package 5 — Reconstruct tax history independently

- Obtain the 1992 beer-tax volume through its catalog/download route.
- Follow its history notes to session laws and earlier baseline text.
- Reconcile rate schedules against tax reports as supporting context.
- Keep numeric rates, tax bases, and receipts separate.

Gate: every rate row has original units, statute evidence, and effective dates.

### Package 6 — Validate, document, and release

- Run the meaningful tests above and current project gates.
- Generate source catalog, review packet, coverage, and release diff.
- Update progress and method documentation.
- Package through the existing build with the actual commit and as-of date.
- Publish only through the repository's already-authorized workflow; otherwise finish the reviewable work and identify the unresolved publication step.

Gate: an independent user can trace each published historical value to a document and understand remaining gaps.

## 18. Claude continuation prompt

> Continue the existing alcohol-policy-data repository using this historical-source expansion plan. First read the current legal-history implementation, source manifests, progress log, and tests. Preserve the functioning 2014-onward work, but audit the scope of its grocery-wine conclusion and keep machine validation separate from legal review. Start by anchoring 2010 S.B. 167 / Chapter 276 to its July 1, 2011 commencement, combine pre-commencement amendments, inventory general and special sessions, and reconstruct through the January 2014 boundary. Use the specific free official PDFs and university catalog links in this document; record blocked retrieval honestly and support manual local-file import. Then build a many-to-many Title 32A/32B crosswalk and extend supported intervals toward 1990, investigating the opening-1990 baseline and Chapter 23 lead. Reconstruct Title 59 beer-tax history separately using the specific 1992 code volume and session laws. Do not treat bill titles, keyword matches, missing search results, or passing tests as complete legal proof. Keep partial fiscal-year knowledge, uncertain intervals, exceptions, and review status visible. Continue unblocked work without repeatedly asking permission for routine implementation choices. Finish with tested exports, a source catalog, exact coverage, a review packet, and a precise list of missing records rather than claiming complete history prematurely.

