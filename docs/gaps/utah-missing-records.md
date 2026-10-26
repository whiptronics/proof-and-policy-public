# Utah: missing records and draft requests

What stops the Utah legal history from going further back, and the exact records that would close each
gap. The requests below are **drafts. Nothing has been sent.** Sending any of them, and accepting any fee,
is the maintainer's decision.

Status as of 2026-10-07 (legal history); 2026-10-15 (fiscal records, draft request C).

## What is established, and where it stops

| Claim | Verified from | What stops it going earlier |
|---|---|---|
| Ordinary grocery-wine authorization (not authorized), package-agency channel | 2003-05-05 (Title 32A, with 32A-12-202 and 32A-3-104 from the Legislature's 2008 and 2010 code pages kept by the Internet Archive) | Sessions before 2002 S4 are not inventoried; Title 32A as of 1990 not obtained (records 3-5) |
| Beer definition, 4% ABV or 3.2% ABW ceiling | 2003-05-05 (Title 32A-1-105 rebuilt from 2003-2009 bills) | Earlier text: 32A-1-105 "last amended by Chapter 161, Laws of Utah 2002"; start not verified |
| Beer tax ($12.80 from 2003-07-01; $11 from 2003-05-05 to 2003-06-30) | 2003-05-05 (2003 S.B. 66, ch. 307) | The flat $11 text that S.B. 66 replaced was "last amended by Chapters 30 and 66, Laws of Utah 1992"; its start date and its continuity from 1992 to 2003 are not verified |

The session inventory (`metadata/legal_history/utah_session_inventory.csv`) covers every general and
special session from 2002 S4 to 2013 S2. Digests of Legislation for 2001 and 2002 are online but print
without word spaces, so they are not parsed yet. Digests before 2001 were not found at the Legislature's
usual address (`/session/<year>/pdfdoc/Digest<year>.pdf` answers 404 for 1990-1999).

## Records needed

| # | Record | Closes | Route |
|---|---|---|---|
| 1 | ~~Utah Code Annotated, Title 59 Chapters 15-21 (Michie, 1992)~~ **Obtained 2026-10-07** (downloaded by the maintainer, imported) | Its 59-15-101 is word for word the text 2003 S.B. 66 replaced. History: enacted by L. 1985 ch. 175; amended 1986 ch. 53; renumbered 1987 ch. 2; 1987 ch. 3; 1992 chs. 30 and 66 (effective 1992-04-27, neither touching the rate). It does not show when $11 began, and it cannot show that nothing changed between 1993 and 2002 | Done. The collection has no Title 32A volumes |
| 2 | Laws of Utah 1985 ch. 175, 1986 ch. 53 and 1987 chs. 2 and 3 (and 1992 chs. 30 and 66, optional) | When the $11 rate began (the 1992 volume's history names these chapters; its amendment notes cover only 1992) | A law library, or HeinOnline's session laws through a Utah public library card |
| 3 | Laws of Utah 1990, chapter 23, including its effective-date clause and affected-sections table | The 1990 starting point for Title 32A (the plan's lead; not inspected) | Law library or Utah State Archives |
| 4 | Utah Code Annotated Title 32A as in force on 1990-01-01: the volume and its supplement, sections on definitions (32A-1-105), beer retailer licensing (Chapter 10) and the general prohibitions | A Title 32A baseline for 1990 | University of Utah collection (check which volumes are present) or a law library |
| 5 | Digests of Legislation 1990-2000 (Office of Legislative Research and General Counsel), or the "Utah Code Sections Affected" tables of Laws of Utah 1990-2000 | A complete session inventory for 1990-2002, as already exists for 2002-2013. This is what would let the 1992 text count from 1992-04-27 to 2003-05-04 | Not at the Legislature's site (checked 2026-10-07 under three file-name spellings). The Office of Legislative Research and General Counsel, a law library, or HeinOnline through a Utah public library card. The 2001 and 2002 digests are online |
| 6 | A dated printed edition of Utah Code 32A-12-202 and 32A-3-104 between 2003 and 2010 | Optional: a second, printed anchor for two sections now taken from archived web pages | A law library (the Internet Archive captures of 2008-07-10 and 2010-07-29 are pinned and used) |

## Draft request A: law library (records 1-4)

> Subject: Request for historical Utah Code and session-law pages (alcohol and beer tax)
>
> I am compiling a public, source-cited dataset of Utah alcohol law, and I am looking for the following
> historical materials. If scans exist, please tell me whether they may be redistributed, or only cited.
>
> 1. Utah Code Annotated, Title 59, Chapters 15-21 (Michie, 1992): the pages for section 59-15-101 with its
>    history note, the volume's title and copyright pages, and any pocket-part update for that section.
> 2. Laws of Utah 1992, chapters 30 and 66: the pages amending section 59-15-101, and each chapter's
>    effective-date provision.
> 3. Laws of Utah 1990, chapter 23: the full chapter or, at least, its title, affected-sections list and
>    effective-date provision.
> 4. Utah Code Annotated, Title 32A, as in force on January 1, 1990 (the 1990 volume or the 1989
>    replacement volume and supplement): sections 32A-1-105 and the provisions of Chapter 10 on beer
>    retailer licences.
> 5. Utah Code sections 32A-12-202 (unauthorized sale or supply) and 32A-3-104 (duties before
>    establishing a package agency) as printed in any edition or supplement between 2003 and 2010, with
>    the edition's currency date.
>
> I can work from PDF scans or photocopies, and I will cite the library as the source. Please let me know
> of any copying fee before any copies are made.

## Draft request B: Office of Legislative Research and General Counsel (record 5)

> Subject: Digests of Legislation 1990-2000
>
> The Digests of Legislation from 2001 onward are online. Are the digests for the 1990-2000 general and
> special sessions available in electronic form, or could you tell me where printed copies are held? I am
> using them to list, for each session, the bills that amended particular Utah Code sections (Title 32A
> and section 59-15-101).

## Fiscal records needed (2026-10-15)

Two questions the published documents cannot answer, and on which the grocery-wine comparison turns. Both are
narrower than the general DABS request drafted in `docs/coverage-audit.md` (draft data request 1, not sent), which
remains as it was.

| # | Record | Why it matters | What is held meanwhile |
|---|---|---|---|
| 7 | Wine sales by customer type: households (purchases at state stores and package agencies for use elsewhere) apart from licensees and permittees (bars, restaurants, clubs and others buying to serve), by fiscal year | Only household purchases could move to grocery stores; licensees would keep buying from DABS. The comparison needs the household share of *wine* sales, which no published DABS document gives. Until it is held, the comparison asks for it as an uncertain input | DABS's FY2025 annual report (p. 18, a chart: `ut_dabs_off_premise_sales_share`, transcribed 2026-10-15, not reviewed) puts off-premise sales at 82% and on-premise sales at 18% of its sales: all products, whole percents, as of June 30, 2025, without saying whether the shares are of dollars or volume. No earlier report prints the chart, and none splits wine. The comparison uses 82% for wine as an assumption, with a ±15-point range |
| 8 | Why the State's financial reports print two different FY2023 figures for the Alcoholic Beverage Services Fund, and what separates the fund's FY2024 revenue from DABS's FY2024 sales | The FY2023 figures first published largely agree with DABS (within $1.0 million); the later editions lower FY2023's revenue by $17.5 million without an explanation found in what was read. FY2024 differs in its own first printing by $15.9 million. FY2025 agrees | `docs/fiscal-reconciliation.md`, "First-published FY2023 figures largely agree; later restatement remains unexplained" and "Two formulas, one gap" |

## Draft request C: DABS records officer (records 7 and 8)

**Not sent.** Prepared for the maintainer's review on 2026-10-15. Sending it, the contact details, any fee limit and
any fee-waiver request are the maintainer's decisions.

How a request is made (checked 2026-10-15 against the Utah State Archives' 2025 GRAMA request form and its "no records
to provide" notice, not against the Code itself): a written request must give the requester's name, mailing address
and daytime telephone number (and an email address if the requester will take replies by email) and describe the
records with reasonable specificity (Utah Code § 63G-2-204(1)); agencies respond within 10 business days, 5 for an
expedited response (§ 63G-2-204(4)(b)); and an agency is not required to create a record or to compile, summarize,
tailor or reformat information in response to a request (§ 63G-2-201(8), which the notice also cites as
§ 63G-2-204(8)). Requests to state agencies can go through the Open Records Portal (openrecords.utah.gov) or to the
agency's records officer. So the request asks for records that should already exist (the figures behind a chart DABS
published) and accepts the nearest existing record. Part 2 concerns figures the Division of Finance publishes; if
DABS holds no such records, Part 2 can go to the Division of Finance unchanged.

> Subject: GRAMA request: wine sales by customer type (FY2023-FY2026) and the fund's FY2023-FY2024 revenue figures
>
> Under the Government Records Access and Management Act, I request copies of the existing records described
> below, in electronic form (spreadsheet preferred, otherwise PDF). I am compiling a public, source-cited
> dataset on Utah alcohol revenue. I am not asking the Department to create a new record: if a record is not
> kept in the form described, please provide the existing record that comes closest, or tell me that none
> exists. Please tell me the estimated fee before any work that would incur one.
>
> Part 1. Sales by type of customer
>
> 1. The data or report behind the chart "On-Premise vs. Off-Premise Sales" on page 18 of the Department's FY2025
>    annual report (on-premise 18%, off-premise 82%), with the amounts the percentages were computed from, and the
>    same figures for fiscal years 2023, 2024 and 2026 if they exist.
> 2. Any existing report or data extract that divides the Department's wine sales by type of customer for any of
>    fiscal years 2023 to 2026: at least sales to licensees and permittees separately from sales to the public, in
>    dollars and, where recorded, in liters or cases. If the same report divides sales by outlet (state stores,
>    package agencies, licensee stores), please include that division.
> 3. The definitions used in those records for "on-premise" and "off-premise" (or for each customer type), for
>    "wine" (for example, whether it includes sparkling and fortified wine, sake, cider or wine-based flavored
>    beverages), and whether the shares are of dollars, volume or units.
>
> Part 2. FY2023 and FY2024 revenue figures for the Alcoholic Beverage Services Fund
>
> 4. Any reconciliation, adjusting or correcting entry, memorandum or correspondence with the Division of Finance
>    that explains why the State's Annual Comprehensive Financial Reports print different FY2023 figures for the
>    fund: the FY2023 report gives operating revenues of $523.992 million (statistical section, printed p. 232;
>    sales $517.153 million, p. 50), while the FY2024 and FY2025 reports give FY2023 operating revenues of
>    $506.492 million (printed pp. 244 and 248), $17.500 million less, and FY2023 "Liquor Retail Sales" expenses
>    of $364.409 million against $383.789 million first reported. In particular, whether the $17.500 million
>    revenue change is related to the $19.380 million cost-of-goods-sold allocation correction described in the
>    FY2024 report (p. 22), and in which fund each change was recorded.
> 5. Any reconciliation between the Department's FY2024 sales as printed in its FY2024 annual report ($578.856
>    million in the five-year summary, p. 22; $583.836 million as "Operating Revenue (Note B)" in the income
>    statement, p. 20) and the fund's FY2024 operating revenues in the FY2024 report ($499.666 million; sales
>    $493.645 million, p. 50), and the text of Note B, which the income statement refers to but the report does not
>    print. After the school-meals and enforcement deposits and other income, the two differ by about $15.9 million;
>    for FY2025 they agree within $0.1 million.
>
> Requester: [name], [mailing address], [daytime telephone], [email].

What each answer would change:

- Item 1 or 2 replaces the assumed household share of wine sales (82%, an all-product figure) with a measured one;
  item 1 alone also says what the 82% is a share of. A split for all products would still need a wine assumption.
- Items 4-5 decide whether the FY2023 and FY2024 residuals in the revenue series are a restatement, a difference of
  scope, or an error. The comparison does not depend on them: it uses FY2025, which agrees on every version.

Checked before drafting: the figures cited in items 4 and 5 against the saved pages (the FY2024 report's p. 20 is a
page image, read rendered); the GRAMA provisions against the State Archives' forms named above. A draft of this
request saved on 2026-10-14 leaned on DABS's "Sales Tax" line as indirect evidence that licensee purchases are
untaxed; that reading was not confirmed (no saved page says how licensee purchases are taxed) and is dropped now that
DABS's own on-/off-premise chart is held.

## Not gaps

The following were checked and are not missing:

- 2010 S.B. 167's effective date is in the enacted text (sec. 384).
- 2012 S.B. 66 and 2012 S4 S.B. 4001 were inventoried and amend no tracked section.
- The three 2013 S1 bills the 2014 Digest omits were read from their enrolled text.
- The text of 32A-12-202 and 32A-3-104, which no 2003-2010 bill prints, is on the Legislature's code pages
  as captured by the Internet Archive on 2008-07-10 and 2010-07-29 (pinned; the Archive refused one
  burst of requests with HTTP 429 and was later queried ten seconds apart).
