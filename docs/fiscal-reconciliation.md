# Fiscal reconciliation

Public alcohol revenue comes in pieces that differ by government level, accounting basis and whether
costs are already netted out. This file says what each piece in the dataset is, how the pieces overlap,
and which reconciliations pass or fail. The `fiscal_components` view lists the pieces side by side and
deliberately has no total.

## Census State Government Tax Collections (all states)

- **T10, Alcoholic Beverages Sales Tax**: "Taxes on sale of alcoholic beverages, whether collected through
  government-operated liquor stores or through private outlets" (Government Finance and Employment
  Classification Manual, 2006, code T10).
- **T20, Alcoholic Beverages License**: licenses for manufacturing, importing, wholesaling and retailing.
- **Excluded from both**: revenue and profits of government-operated liquor stores. The manual classifies
  these as liquor store revenue, a separate sector ("Excludes: Sales and license taxes on alcoholic
  beverages collected through these stores (report at ... T10 ... or ... T20)").
- **State government only**, not state plus local. Thousands of current dollars, each state's own fiscal
  year (June 30 except NY Mar 31, TX Aug 31, AL and MI Sep 30; DC Sep 30, not yet verified against an
  official source).
- **General sales tax on alcohol** is inside T09 (general sales tax), not T10, and cannot be separated
  from other general sales tax in these files.
- **Not wine-specific.** No Census item isolates wine.

Reconciliations (from `alcohol-data validate`, rerun on every build):

| Check | Result |
|---|---|
| U.S. row = sum of 50 states | Holds within rounding for every year except 1955-1959 (Alaska and Hawaii statehood era). The "US" figure excludes DC: in the FY2023-FY2025 flat files the 51-jurisdiction sum exceeds "US" by exactly DC's amount. |
| Historical database (2025 release) vs FY2023-FY2025 flat files | Identical for every state value they share. |

## Census liquor store revenue and expenditure (state governments)

Source `census_govfin`, added 2026-10-08. It is the other half of the T10 picture: what a state's own
liquor monopoly takes in and spends. Census definitions (Glossary of Government Finances, 1992, shipped in
the IndFin zip):

- **Liquor stores**: "Alcoholic beverage distribution facilities operated by governments maintaining
  alcoholic beverage monopoly systems."
- **Revenue (A90)**: "Amounts received from sale of liquor and other miscellaneous revenue of government
  maintained alcoholic beverage monopoly systems. Excludes any taxes collected by the system for its own
  or other governments."
- **Expenditure**: "Expenditure for purchase of liquor for resale and provision and operation of
  government-maintained alcoholic beverage monopoly systems." It excludes law enforcement and licensing.

| Measure | Census item | Notes |
|---|---|---|
| `census_liquor_stores_revenue` | A90 | State liquor-store receipts, gross: before the cost of liquor and before operating costs |
| `census_liquor_stores_expenditure` | -90 (total) | Current operations plus capital outlay; never add it to them |
| `census_liquor_stores_current_operations` | E90 | Includes the purchase of liquor for resale, so it is not only operating cost |
| `census_liquor_stores_capital_outlay` | F90 + G90 | Construction plus other capital outlay (F90 alone from FY2022, when the files have no G item) |

**Years.**
- FY1972 and FY1977-FY2012 come from the IndFin historical database (`_IndFin_1967-2012.zip`). It has no
  state government records for FY1967, FY1970-FY1971 or FY1973-FY1976.
- FY2008-FY2015 come from the yearly state-by-type files. Where both cover a year, IndFin is preferred.
- FY2015-FY2024 come from the Individual Unit Files, parsed since 2026-10-13 ("After FY2015", below). For
  FY2015 the state-by-type file (Census's 2017 release) stays preferred and the unit file's 2020 release is
  kept as a competing candidate.
- Nothing is loaded before FY1972 (the Access database would need pyodbc) or after FY2024.

**Which file prints what.** IndFin prints the total and capital outlay, so current operations is
computed by Census's formula (E90 = total minus capital outlay). The state-by-type files and the unit files
print E90, F90 and G90 (no G item from FY2022), so the total and capital outlay are their sums. Each computed
value is flagged `census_formula` and carries its inputs; a unit-file total that counts an absent item as zero
lists it in `absent_items_counted_as_zero`.

**Absent is not zero.** IndFin (FY1972-FY2012) prints a zero for every state government without liquor
stores. The state-by-type files (FY2009-FY2015) and the unit files list only items that exist, so from FY2013 a
state government with no liquor-store item has no value at all: not a zero, and not a measured absence of a
system. No absent item is ever turned into a zero value.

**What these values do not say.**
- *Who runs retail stores.* Census counts wholesale-only monopolies as liquor stores. Seventeen state
  governments have liquor store revenue in the loaded years: AL, IA, ID, ME, MI, MS, MT, NH, OH, OR, PA,
  UT, VA, VT, WA (to FY2012), WV and WY. The current-law snapshots (2024-2026 sources) code spirits retail
  as private in Iowa, Michigan, West Virginia and Wyoming, which all have FY2015 values. The two say
  different things about different years, and neither is evidence for the other. Retail systems are coded
  from law only.
- *Profit or transfers.* Census publishes neither for liquor stores. The IndFin readme says the data "do
  not represent an accounting statement", and a revenue-minus-expenditure difference "does not necessarily
  indicate a 'budget' surplus or deficit". Nothing here computes one. Profit and transfers stay with the
  states' own reports, such as Utah's DABS figures below.
- *Local stores.* Municipal and county liquor stores (for example North Carolina's local ABC boards and
  Minnesota's municipal stores) are local governments and are not loaded.

**Breaks to read as breaks.** Maine's revenue is $86.2 million in FY2003, $166.0 million in FY2004,
$51.6 million in FY2005, $25,000-$33,000 a year from FY2006 to FY2016, and $179.0 million again from FY2017.
Its expenditure falls from $61.9 million to $6.3 million and then to about zero, and returns in FY2017. These
files do not say why. A change of that size should be read as a change in how the system is run or recorded,
never as a market change. Washington has no value from FY2013. Two breaks are coded as comparability groups,
so charts and comparisons do not join across them: capital outlay and total expenditure from FY2022
(`...|no_g_item_from_fy2022`), and Oregon's current operations and total expenditure from the unit files
(`...|oregon_unit_files`).

Reconciliations (from `alcohol-data validate`):

| Check | Result |
|---|---|
| IndFin vs state-by-type files, FY2008-FY2012 (`reconcile_census_liquor_store_files`, a warning if it fails) | Identical in all 425 cells present in both. A state-by-type file lists only items that are not zero (FY2009-FY2015), so a missing line counts as zero. |
| Sum of the 50 states vs the U.S. state-government line, FY2012 revenue | $7,114.248 million both ways (checked once, 2026-10-08; the U.S. line is not loaded). |

**Utah: DABS sales, the statutory deposits, Census receipts and the audited fund (audited 2026-10-14; the DABC
reports, the FY2024-FY2025 ACFRs and the Pennsylvania audits saved, pinned and checked the same day).** This
replaces the note of 2026-10-13, which overstated what was shown (see "Corrected" at the end). The bridge is
computed by `src/alcohol_data/fiscal_bridge.py` (`utah-liquor-bridge@1.0`), checked by
`compare_utah_census_receipts_vs_dabs_sales` (pinned years) and shown on Utah at a glance ("Why Utah's
liquor-sales figures differ", from `reconciliation.json`). Each statement below carries one of five labels:
*documented* (a saved, checksummed source states it), *documented, read online* (a source states it but is not yet
saved), *reconciles numerically*, *inferred*, *unresolved*.

*What the law requires (documented, then documented read online).* Utah law takes two percentages of "the total
gross revenue from sales of liquor": 10% deposited with the Uniform School Fund for school lunch, now school meals
(§ 32B-2-304), and after it a share deposited with the Alcoholic Beverage Control Act Enforcement Fund for the
Department of Public Safety (§ 32B-2-305). Both took effect on 2011-07-01: the pinned enrolled texts of 2010 S.B. 167
(lines 2631-2634) and 2011 S.B. 314 (lines 1236-1238) give 10% and 1%. Read online and not yet saved: the 10% is
unchanged in 2012 H.B. 354, in the text 2020 H.B. 16 amended, and in the versions from 2024-05-01 and 2026-03-13; the
enforcement share stays 1% in 2012 H.B. 354 (lines 160-163) and 2013 H.B. 399 (lines 366-369), is 0.875% in the
text 2022 S.B. 201 amended, and 1.695% from 2023-07-01 (2023 H.B. 223, enrolled). Not read: the enforcement rate's
text for FY2015-FY2020 (the enactment inventory ends with the 2013 session; inferred 1% from DABS's amounts) and the
act that set 0.875% (inferred from FY2021; 2020 H.B. 208 and H.B. 399, read online, do not amend § 32B-2-305). The schedule is `metadata/legal_history/utah_liquor_deposit_rates.csv`. 2012 H.B. 354
also routed the markup through the State Tax Commission into a Markup Holding Fund that paid the 10% deposit (fund
5481: a $14,998,002 transfer in FY2013, a zero balance after FY2014; read online), so the deposit's paying fund
changed in those years.

*How DABS reports them (documented).* DABS's sales line is before both deposits: the five-year summaries subtract
"Less School Lunch Program" and "Less Transfer to SBI" (the State Bureau of Investigation is in Public Safety) on the
way to net profit, and the FY2012-FY2016 operations summary groups the two as "Profit Transfers". FY2020-FY2025 come
from the saved FY2024 and FY2025 reports; FY2012-FY2019 from the 81st (FY2016), 84th (FY2019) and 86th (FY2021)
reports, saved and pinned on 2026-10-14 (assets `utah_dabs_annual_report_fy2016`, `_fy2019`, `_fy2021`). Their
five-year summaries were first read online; each of those 168 readings was then found in the right row and year
column of the saved PDF's text layer (the 81st report's statement of operation by reading the page, which is page 20,
not 21 as the online reading had it), and all are now manual observations (`extracted_unreviewed`). Where editions
overlap the later report is preferred (priorities 4, 6, 8, then 10 and 20 for the FY2024 and FY2025 reports). The
reports' own summaries miss their printed net profit by $0.05-0.08 million in FY2013-FY2015 (both reports, so the
report, not the reading).

*The bridge (reconciles numerically).* Two variants, never merged: deposits at the statutory rate times DABS's
sales, and deposits as DABS printed them. Thousands of dollars; "Left over" is DABS's sales less the deposits, minus
Census's receipts (FY2025: the audited fund's sales in the FY2025 ACFR, because Census has not published FY2025).

| FY | DABS sales | Rates (school + enforcement) | Deposits, statutory | Deposits, reported | Census (or audited) | Left over, statutory | Left over, reported |
|---|---:|---|---:|---:|---:|---:|---:|
| 2012 | 304,884 | 10% + 1% | 30,488 + 3,049 | 32,055 + 3,205 | 269,638 | 1,708 | −15 |
| 2013 | 328,912 | 10% + 1% | 32,891 + 3,289 | 34,687 + 3,469 | 290,757 | 1,975 | 0 |
| 2014 | 348,453 | 10% + 1% | 34,845 + 3,485 | 34,858 + 3,486 | 310,228 | −104 | −118 |
| 2015 | 376,239 | 10% + 1% | 37,624 + 3,762 | 37,624 + 3,762 | 334,840 | 13 | 13 |
| 2016 | 405,911 | 10% + 1% | 40,591 + 4,059 | 40,643 + 4,064 | 361,199 | 62 | 5 |
| 2017 | 427,606 | 10% + 1% | 42,761 + 4,276 | 42,747 + 4,275 | 380,544 | 25 | 40 |
| 2018 | 453,689 | 10% + 1% | 45,369 + 4,537 | 45,427 + 4,543 | 403,667 | 116 | 52 |
| 2019 | 479,324 | 10% + 1% | 47,932 + 4,793 | 47,926 + 4,792 | 426,588 | 10 | 18 |
| 2020 | 500,212 | 10% + 1% | 50,021 + 5,002 | 50,022 + 5,002 | 445,208 | −19 | −20 |
| 2021 | 517,390 | 10% + 0.875% | 51,739 + 4,527 | 51,747 + 4,527 | 461,147 | −23 | −31 |
| 2022 | 557,452 | 10% + 0.875% | 55,745 + 4,878 | 54,498 + 4,769 | 496,883 | −54 | 1,302 |
| 2023 | 579,050 | 10% + 0.875% | 57,905 + 5,067 | 57,914 + 5,067 | 517,153 | −1,075 | −1,084 |
| 2024 | 578,856 or 583,836 | 10% + 1.695% | 57,886 + 9,812 (or 58,384 + 9,896) | 67,706 + 9,812 | 493,645 | 17,514 (or 21,911) | 7,693 (or 12,673) |
| 2025 | 551,346 | 10% + 1.695% | 55,135 + 9,345 | 56,897 + 9,600 | 486,942 (audited) | −76 | −2,093 |

Every figure is from a saved, pinned document (DABS reports and the ACFR transcribed by hand, not yet reviewed by a
person). Twelve of the fourteen years are within $0.15 million on at least one variant (FY2013
to the thousand). FY2012-FY2013 reconcile only on the reported deposits, which are 10.51-10.55% and 1.05% of sales
net of taxes, as if computed on sales plus DABS's sales-tax line (within $0.07 million in FY2013, $1.4 million in
FY2012); from FY2014 they are 10.00% and 1.000% of sales net of taxes. FY2022 and FY2025 reconcile only at the
statutory rates: DABS's two reported FY2022 deposits are both 97.8% of the statutory amounts, and its FY2025 ones
are 10.32% and 1.741%. The tolerance is a numerical statement, not a test of accounting.

*Census and the audited fund (reconciles numerically).* Census's Utah FY2024 receipts equal the audited fund's FY2024
sales in the FY2024 ACFR's proprietary funds statement ($493,645 thousand), and Census's Pennsylvania FY2023 and
FY2024 receipts equal the Auditor General's audited State Stores Fund "sales net of taxes" (2,513,588 and 2,545,114
thousand). Census's Utah FY2023 receipts (517,153) do not match the audited fund, whose whole operating revenue that
year was 506,492; they track DABS's own figures. Census does not always take the same figure for Utah.

*Where the deposits go (school meals documented; enforcement inferred).* The saved ACFRs keep the school-meals deposit
out of the Alcoholic Beverage Services Fund's sales. The fund's statement of cash flows pays "Sales Tax and School
Lunch Collections" among its operating cash flows but outside its revenues and expenses: 55,135 in FY2025 (exactly
10% of DABS's 551,346) and 67,575 in FY2024 (FY2025 ACFR p. 51, FY2024 ACFR p. 51, printed pages). The Income Tax
Fund books the money as its own revenue, "Liquor Sales Allocated for School Lunch": 57,887 in FY2024 (10% of DABS's
578,856) and 56,898 in FY2025 (governmental funds statement, p. 44). The enforcement deposit appears nowhere in the
fund's statements: its expenses have no such line, and its FY2025 transfers out (108,132) are 105,364 to the General
Fund, 1,750 to the Income Tax Fund and 1,018 to nonmajor funds (note 14). That the audited sales are also net of the
enforcement deposit therefore rests on the arithmetic (FY2025 within $0.08 million), and is inferred. Only these two
enter the bridge because the law computes them on gross revenue and pays them to other state funds; Parents
Empowered, underage drinking prevention and "other programs" are fixed amounts or appropriations and are not
subtracted, whatever that would do to the residual.

*The audited revenue series (reconciles numerically to FY2022 and in FY2025; FY2023-FY2024 unresolved).* The ACFRs'
statistical section gives the fund's operating revenue ("Liquor Retail Sales", charges for services; sales plus fees
and other operating revenue) for ten years per edition (FY2016-FY2025 in the FY2025 ACFR, FY2015-FY2024 in the FY2024
ACFR; the editions agree where they overlap). Set beside DABS's sales less the two statutory deposits plus DABS's
other income (thousands; where DABS prints two other-income figures, the lower):

| FY | DABS sales | Statutory deposits | DABS other income | DABS-based revenue | Audited operating revenue | Audited minus DABS-based | Census receipts |
|---|---:|---:|---:|---:|---:|---:|---:|
| 2015 | 376,239 | 41,386 | 3,521 | 338,374 | 338,039 | −335 | 334,840 |
| 2016 | 405,911 | 44,650 | 3,598 | 364,859 | 364,482 | −377 | 361,199 |
| 2017 | 427,606 | 47,037 | 3,777 | 384,346 | 384,009 | −337 | 380,544 |
| 2018 | 453,689 | 49,906 | 4,355 | 408,138 | 407,694 | −444 | 403,667 |
| 2019 | 479,324 | 52,726 | 4,622 | 431,220 | 430,829 | −391 | 426,588 |
| 2020 | 500,212 | 55,023 | 5,388 | 450,577 | 449,760 | −817 | 445,208 |
| 2021 | 517,390 | 56,266 | 5,278 | 466,402 | 466,012 | −390 | 461,147 |
| 2022 | 557,452 | 60,623 | 6,578 | 503,407 | 501,496 | −1,911 | 496,883 |
| 2023 | 579,050 | 62,972 | 6,899 | 522,977 | 506,492 | **−16,485** | 517,153 |
| 2024 | 578,856 | 67,697 | 4,454 | 515,613 | 499,666 | **−15,947** | 493,645 |
| 2025 | 551,346 | 64,480 | 6,569 | 493,435 | 493,437 | 2 | — |

Through FY2022 and again in FY2025 the audited revenue is DABS's sales less the deposits plus other income, within
$0.9 million (FY2022: $1.9 million). In FY2023 and FY2024 it is about $16 million lower. Those are the first years of
DABS's new accounting system: the FY2024 ACFR (p. 22, printed) says DABS "discovered a $19.380 million allocation error
from fiscal year 2023 due to a new accounting system failing to properly expense costs of goods sold", which had
overstated the profit transferred to the General Fund, and the FY2025 ACFR's note 2 corrects FY2024 inventory ($9.312
million) and liquor returns ($0.438 million). Neither note mentions sales, and no document saved says why the audited
revenue is lower (unresolved). Census took figures close to DABS's for FY2023 and the audited figure for FY2024, which
is why the bridge shows $1.07 million in FY2023 and $17.5 million in FY2024 for what looks like one two-year gap.

*FY2023 (unresolved).* Census is $1.07 million above DABS's sales less the deposits on either variant. DABS's FY2024
report has a second view of FY2023 that is not yet transcribed: its income statement (p. 20, a page image, read on
2026-10-14) gives FY2023 a combined "School Lunch, Uniform School Fund and Public Safety" transfer of 67,062, which
is 4,081 above the five-year summary's two lines (57,914 + 5,067 = 62,981), and a net liquor profit of 136,265
against the summary's 136,557. Neither difference is explained.

*FY2024, separately (unresolved; arithmetic checked 2026-10-14).* Every figure for the FY2024 gap given so far comes
from one equation, residual = DABS sales − deposits − Census receipts, with Census's receipts at 493,645 (Individual
Unit File, pinned; equal to the audited fund's sales in the FY2024 ACFR's proprietary funds statement). They differ only in which
sales figure and which deposits enter it. Thousands of dollars:

| Deposits taken as | Sales 578,856: deposits | residual | Sales 583,836: deposits | residual | Standing |
|---|---|---|---|---|---|
| The rates in law, 10% + 1.695% | 57,886 + 9,812 = 67,697 | **17,514** | 58,384 + 9,896 = 68,280 | **21,911** | the bridge's basis; on 578,856 equal to what DABS printed (reconciles numerically) |
| DABS's one combined transfer (income statement) | 67,699 | 17,512 | 67,699 | 22,492 | documented: FY2024 report p. 20, FY2025 report p. 30 |
| The five-year summary's two lines | 67,706 + 9,812 = 77,518 | 7,693 | 77,518 | 12,673 | counts 9,812 twice if the school line includes it (inferred) |
| The school-meals deposit alone | 57,886 | 27,325 | 58,384 | 31,807 | superseded: the 2026-10-13 figure, which left out § 32B-2-305 |

So the "$27-32 million" of 2026-10-13 left out the enforcement deposit; the "$7.7-12.7 million" of the year-by-year
table (2026-10-14) is its "reported" variant, which subtracts both printed lines; and "$17.5-21.9 million" takes the
deposits at the rates in law, which on 578,856 equal DABS's printed combined transfer. The change is the enforcement
transfer, counted not at all, twice, or once; no source revision is involved. `fiscal_bridge.deposit_bases` computes
every row from the build, and the panel on Utah at a glance shows them with links to each record.

Why the summary's school line is taken to contain the enforcement transfer (inferred): the line (67,706) is 11.7% of
sales against 9.8-10.0% in FY2020-FY2023; it equals the combined transfer within $7 thousand; and the summary's own
lines (264,279 less 3,302, 1,750, 78,183, 9,812 and 67,706) fall 9,821 short of its printed net profit (113,347),
but only 9 short without the separate enforcement line, whereas the same lines add up exactly in FY2023. Against it:
the operations summary on the same page counts the two separately and reaches 113,347, but its salaries and other
expenses (71,663) are 9,822 below the first table's expenses and Parents Empowered (81,485); in FY2023 the two tables
agree. The report is not consistent with itself.

Two sales figures, both in DABS's own FY2024 report: 578,856 in the five-year summary (p. 22) and 583,836 as
"Operating Revenue (Note B)" in the income statement (p. 20, a page image; repeated on p. 30 of the FY2025 report).
Note B is not printed. The income statement also does not add up for FY2024: net operating income (192,737) plus the
non-operating total (−71,981) is 120,756, against a printed net liquor profit of 113,347 (equal to the summary and to
the liquor profit transfer in the FY2024 ACFR's management's discussion); its FY2023 and FY2025 columns add up.

The audited FY2024 fund (FY2024 ACFR, proprietary funds statement, printed p. 50): sales 493,645; total operating
revenues 499,666; operating expenses 364,271 (purchases for resale 287,363, against DABS's cost of liquor sold of
317,370); operating income 135,395; transfers in 140,000 (store construction) and out 134,905. The FY2025 ACFR's
note 2 (printed p. 75) explains its $9.750 million reduction of the fund's beginning net position: inventory
overstated by $9.312 million at the end of FY2024 and a $0.438 million error in reporting liquor returns. It restates
FY2024 operating expenses to 374,021 (MD&A) and government-wide liquor expenses to 377,684 (against 367,934 first
published), the same 9,750 in each case. Both corrections are costs. The sales gap is the FY2023-FY2024 gap of the
audited revenue series above; DABS's 87th and 88th reports, the FY2023 ACFR, or an account from DABS or the State
Auditor could settle it.

*Two formulas, one gap (2026-10-14, night; `fiscal_bridge.formula_change`).* Two calculations of the same day show the
FY2023-FY2024 difference with different sizes, and FY2023's appears to jump from $1.07 million to $16.5 million. Neither
moved because a source changed. They differ in the comparator and in one term, and the earlier table printed the
second one with the opposite sign. With one sign (DABS-based minus the comparator) and the same deposits (the rates in
law times DABS's sales; where DABS prints two figures, the lower), in thousands of dollars:

- the bridge (`utah-liquor-bridge@1.0`, the morning): DABS sales − deposits − C, where C is Census's receipts (FY2025:
  the audited fund's sales);
- the revenue series (the evening): DABS sales − deposits + DABS other income − A, where A is the audited fund's
  operating revenue in the ACFRs' statistical section;
- so bridge − series = (A − C) − DABS other income, exactly.

| FY | DABS sales | Deposits | Other income | C (kind) | A | Bridge | Series | A − C | Bridge − series |
|---|---:|---:|---:|---|---:|---:|---:|---:|---:|
| 2021 | 517,390 | 56,266 | 5,278 | 461,147 (Census) | 466,012 | −23 | 390 | 4,865 | −413 |
| 2022 | 557,452 | 60,623 | 6,578 | 496,883 (Census) | 501,496 | −54 | 1,911 | 4,613 | −1,965 |
| 2023 | 579,050 | 62,972 | 6,899 | 517,153 (Census) | 506,492 | −1,075 | **16,485** | **−10,661** | −17,560 |
| 2024 | 578,856 | 67,697 | 4,454 | 493,645 (Census = audited sales) | 499,666 | **17,514** | **15,947** | 6,021 | 1,567 |
| 2025 | 551,346 | 64,480 | 6,569 | 486,942 (audited sales) | 493,437 | −76 | −2 | 6,495 | −74 |

In every other year A exceeds C by $3-6.5 million, about the other income, so the two formulas agree within $2
million. In FY2023 Census's receipts are $10.7 million *above* the audited operating revenue the later ACFRs print,
which is why the bridge shows almost nothing that year and the series shows $16.5 million. The FY2023 gap is not
small; it is hidden in the bridge by a Census figure that follows DABS. (The revenue-series table above prints
"audited minus DABS-based", so its −16,485 and −15,947 are the 16,485 and 15,947 here.) Test:
`test_the_two_formulas_differ_only_by_the_comparator_and_the_other_income`.

*Narrowing the FY2023-FY2024 gap (2026-10-14, night; still unresolved).* A bounded look at what is saved, and at the
FY2023 ACFR's opening pages through a web reader (the four documents that could settle it, DABS's 87th and 88th
reports and the FY2022 and FY2023 ACFRs, are not saved; their addresses are in the leads). Revenue and costs are kept
apart.

1. *The gap is on the revenue side, and in FY2024 it is in cash too (reconciles numerically).* The FY2024 fund
   received $567,475 thousand from customers and paid out $67,575 thousand of collections (statement of cash flows,
   FY2024 ACFR p. 53, printed 51; both transcribed, `ut_abs_fund_receipts_from_customers` is new): 499,900, within
   $234 thousand of its operating revenue (499,666) and $15.7 million below DABS's sales less the deposits plus other
   income (515,613). A difference of accrual timing would show in receivables, not in cash received. In FY2025 the
   receipts (550,289) are within $1.1 million of DABS's sales (551,346).
2. *FY2023 was printed differently the first time (read online at the time; now saved and confirmed, see below).* The FY2023 ACFR's management's discussion
   (p. 31) gives the fund's net profit as $142.096 million, $7.270 million above FY2022's $134.826 million, "as retail
   sales increased 4.08 percent" (the web reader's wording). 4.08% is Census's FY2023 receipts over FY2022's
   (517,153 / 496,883 = 1.0408); it fits no other pair in the dataset (DABS's sales 1.0387; the later editions' operating
   revenue 1.0100). That suggests (inferred) that the FY2023 ACFR printed FY2023 sales near 517,153, as Census reports,
   and that the 506,492 of the later editions is a revision. The government-wide "Liquor Retail Sales" expenses for
   FY2023 are 383,789 in the FY2023 ACFR (p. 25, read online) and 364,409 in the FY2024 and FY2025 editions: 19,380
   less, exactly the "$19.380 million allocation error" in cost of goods sold that the FY2024 ACFR (p. 22) describes.
   The FY2025 edition marks its FY2023 and FY2024 columns restated (GASB 100).
3. *Costs are not revenue.* The $19.380 million FY2023 cost-of-goods error and the FY2025 note 2's $9.750 million
   (inventory $9.312 million, liquor returns $0.438 million) are corrections of costs and inventory. They change profit,
   not the revenue gap, and are not evidence about its cause. Only the $0.438 million of returns could touch revenue,
   and it is a fortieth of the gap.
4. *Two clues that do not add up yet.* The FY2024 ACFR (p. 33, printed 31) puts the FY2024 profit transfer ($113.347
   million) $3.537 million below "the prior year (adjusted for accounting corrections)", that is $116.884 million,
   "despite a 2.98 percent increase in retail sales"; 2.98% matches no pair of sales figures in the dataset. DABS's own
   FY2024 report gives FY2023 operating revenue as 579,050 (p. 20, read again 2026-10-14), the five-year summary's
   figure, so DABS did not revise FY2023 in its next report.
5. *The enforcement deposit (still inferred).* In FY2024 the fund's "Payments of Sales Tax and School Lunch
   Collections" (67,575) are within $122 thousand of both statutory deposits together (67,697), as if the enforcement
   deposit passed through them; in FY2025 the same line is the school-meals deposit alone (55,135). No saved page names
   the enforcement deposit.

What stays: the residual is kept as it falls (FY2023 16,485 and FY2024 15,947 in the series; −1,075 and 17,514 in the
bridge) and stays *unresolved*. The question is now narrower: what DABS's FY2023-FY2024 sales count that the audited
fund's sales and cash receipts do not, and whether the FY2023 ACFR's first FY2023 figure agrees with Census. The 88th
DABS report and the FY2023 ACFR's fund statements should answer the second part. The scenario comparison does not wait
for it: it uses FY2025, which reconciles.

*First-published FY2023 figures largely agree; later restatement remains unexplained (2026-10-14, night, after the
four FY2022-FY2023 documents were saved; heading reworded 2026-10-15 from "Settled with the FY2022-FY2023
documents", which overstated it: the comparison as first published is clarified, but the revised audited amount still
needs an explanation).* DABS's 87th
and 88th reports and the FY2022 and FY2023 ACFRs were downloaded through the desktop app's browser (the bytes the sites
served, SHA-256 checked in the page and on disk), saved in `../Repeal Title 32B Utah` and pinned
(`utah_dabs_annual_report_fy2022`, `_fy2023`; `utah_acfr_fy2022`, `_fy2023`). 110 values were transcribed by hand
(`extracted_unreviewed`); every ACFR and 87th-report value was found in the PDF's text layer, and the 88th report's
image pages were read from rendered pages and checked by their own subtotals. All six online readings match the saved
pages and now point to records; none is left unchecked.

- **FY2023 as first printed largely agrees.** The FY2023 ACFR gives the fund FY2023 sales of 517,153 (the figure Census
  reports, so Census followed the audited figure in FY2023 as in FY2024), operating revenue of 523,992 and income
  before transfers of 142,096 (its MD&A's "net profit"). Against DABS's sales less the two deposits plus other income
  (522,977) the first printing is 1,015 higher, as close as FY2015-FY2022. DABS's 88th report prints the FY2023 figures
  its 89th and 90th reports reprint (sales 579,050, deposits 57,914 and 5,067, net profit 136,557; income statement
  net liquor profit 136,265). So the FY2023 "gap" is a revision between ACFR editions, not a difference between DABS and
  the audited statements as published for that year.
- **The revision is not explained in what was read.** The FY2024 and FY2025 editions print FY2023's liquor revenue
  17,500 lower (506,492) and its expenses 19,380 lower (364,409). The FY2024 ACFR's schedule of corrections books the
  19,380 DABS correction in the General Fund (governmental activities) and shows no DABS line under business-type
  activities; neither change to the liquor line is explained. The cost correction is not taken as the reason for the
  revenue change.
- **FY2024 differs in its own first printing** (499,666 against DABS-based 515,613; −15,947), in cash receipts too.
  FY2025 agrees again (+2). Unresolved: what the FY2024 figures and the FY2023 restatement leave out that DABS's sales
  include.
- **Which version each calculation uses.** The build prefers the latest edition (FY2025 ACFR) where editions overlap,
  so the revenue series shows FY2023 restated (16,485); `fiscal_bridge.formula_change` now returns the year's own first
  printing beside it (FY2023: −1,015). The bridge compares DABS with Census, whose FY2023 figure equals the first
  printing. The scenario comparison uses FY2025, which agrees on every version.
- **The enforcement deposit.** The fund's "Payments of Sales Tax and School Lunch Collections" equal both statutory
  deposits within $6 thousand in FY2022 (60,617 against 60,623) and $122 thousand in FY2024, and are $702 thousand
  above them in FY2023; FY2025's line is the school-meals deposit alone. Still inferred, with numerical support.
- **New inconsistencies in DABS's reports (not used).** The 87th report's Note B gives the sales tax excluded as
  "FY 2021 $1.091 million and FY 2022 $826 thousand", against its own sales-tax line (30,614 and 31,232) and the 88th
  report's Note B ("FY 2022 $31.2 million and FY 2023 $32.0 million"). Both reports' Note A give the markup as 88%,
  against 88.5% in the code versions read for FY2025-FY2026.

*Census T10 (unresolved, open).* Utah's T10 falls from $50.0 million in FY2017 to $8.0 million in FY2018. The fall is
close to the two deposits ($47.0 million in FY2017), which would fit Census counting them as alcohol taxes until
FY2017, but T10 less the deposits is not steady before then ($10.5 million in FY2012, $10.1 million in FY2013-FY2014,
$9.8 million in FY2015, $6.9 million in FY2016, $3.0 million in FY2017), and receipts were net of the deposits
throughout. A question for Census (`gap_stc_series_breaks`), not a finding.

*What it means for the simulator.* DABS's annual sales are the right base for a markup-and-deposit model; Census's
receipts and the audited fund's sales already exclude the school-meals deposit (documented) and, by the arithmetic,
the enforcement deposit (inferred), so a scenario must not take a deposit off them again. The two deposits are paid out of the gross margin on every dollar of DABS liquor
sales, so they are already inside the margin the scenarios use. On wine that would move to grocery stores they are
today's allocation of that margin to the Uniform School Fund and the enforcement fund; whether those funds keep that
money depends on how the law treats the new arrangement. The Utah revenue scenarios show them that way, inside the
margin and not as extra losses, and keep the total across state funds apart from who receives it.

*Corrected (2026-10-14).* The note of 2026-10-13 said the gap "is the statutory 10% school-meals deposit" and that
the remainder matched Parents Empowered and underage drinking prevention, leaving $27-32 million in FY2024. The
remainder is the enforcement deposit, which the earlier reading of the FY2016-FY2021 summaries had missed; the
fixed-amount earmarks do not belong in the bridge; exclusion from Census receipts is inferred, not shown; and FY2024's
residual after both statutory deposits is $17.5 million (or $21.9 million).

*Corrected (2026-10-14, later, after the documents were saved).* "That Census and the auditors leave the deposits out
is inferred" is now documented for the school-meals deposit (the fund pays it out as collections; the Income Tax Fund
books it) and still inferred for the enforcement deposit. "FY2024 does not follow the pattern" was too narrow: the
audited fund's revenue is about $16 million below DABS's figures in FY2023 too, and the FY2024 residual is large
because Census followed the audited figure that year only. The annual series' tax basis, previously "documented,
read online", rests on DABS's Note B in three saved reports.

**After FY2015: the Individual Unit Files (parsed 2026-10-13).** Census published no state-by-type file after
FY2015 on its own; the later years come in the yearly Individual Unit Files. Ethan saved all ten zips (FY2015 to
FY2024) into `../Repeal Title 32B Utah`, and they were matched by contents and imported as
`census_govfin_unit_fy2015` to `census_govfin_unit_fy2024` on 2026-10-12. The parser `census_unit_liquor_stores`
1.0 reads them. What the files hold, read from them and their Technical Documentation:

- *Contents.* Each zip has the unit file (`<year>FinEstDAT_*.txt`: one record per government and item, amount
  in thousands of dollars, year of data and an item flag), the government directory (`Fin_GID_<year>.txt` to
  FY2016, `Fin_PID_<year>.txt` from FY2017: name, FIPS codes, population, fiscal-year end), the state-by-level
  file (`<yy>statetypepu.txt`, the 35-character layout already read for FY2008-FY2015, now documented: level 1
  state and local, 2 state government, 3 local, 5-9 county to school district), the Technical Documentation
  and a disclaimer. FY2017-FY2021 add `Finance_Aggregate_Lines_<year>.xlsx`, whose "Liquor store expenditure"
  line is E90, F90, G90.
- *Layout change at FY2017.* FY2015-FY2016: Census state codes (Alabama 01 ... Wyoming 51), 14-character IDs,
  34-character records. From FY2017: FIPS state codes (Alabama 01, Arizona 04 ... Wyoming 56), 12-character
  IDs, 32-character records. The state-by-level files switch to FIPS codes at the same time, so the parser for
  FY2008-FY2015 (`census_state_type_liquor_stores`, Census codes) must not be pointed at a later file. The
  FY2024 documentation says 33-character records with a two-character flag; the file has 32.
- *State governments.* The type digit (third character of the ID) is 0 for a state government. Every year has
  exactly 50 such records, one per state (no District of Columbia), each named as its state in the directory,
  and every directory fiscal-year end agrees with metadata/fiscal_years.csv. The ID is `SS000000000000` to
  FY2016 and a unit number from FY2017 (Alabama `010000226085`). The level 2 lines of the state-by-level file
  equal the state government's unit records item for item, every year.
- *Items.* A90, E90, F90 and G90 are listed FY2015-FY2021. From FY2022 the item list and the files have no G
  (other capital outlay) item at all, and F90 is still labelled "Liquor Stores-Construction". Virginia's F90
  is 2,389 to 4,255 thousand in FY2022-FY2024 against 10 to 357 before, which suggests F90 now carries other
  capital outlay too, but nothing documents it: capital outlay and total expenditure from FY2022 are a new
  comparability group, not a continuation.
- *Flags and zeros.* Every state government liquor item is flagged R (reported). The flags documented are R,
  I (imputed), A (analyst correction), S (alternative source), M (unknown) and, in FY2019 only, N (not
  applicable). Zero amounts are rare but do occur (9 to 3,406 records a year out of 0.5 to 1.7 million, none
  of them a state government liquor item), so the file mostly leaves a zero item out but does not say so.
- *Which states.* Sixteen state governments have A90 in every year: AL, IA, ID, ME, MI, MS, MT, NH, OH, OR, PA,
  UT, VA, VT, WV and WY. Kentucky has E90 and G90 but no A90 in FY2015-FY2016 (5,134 and 5,557 thousand of
  current operations). The other state governments (33 in FY2015-FY2016, 34 from FY2017) have no liquor store
  item: no value, not a zero.

**How the parser reads them** (`src/alcohol_data/adapters/census_govfin.py`, `parse_unit`; tests in
`tests/test_census_govfin_unit.py`). It picks the layout by fiscal year and requires the members to fit it (a
`Fin_PID` directory in an FY2016 archive rejects the year). It requires exactly 50 state governments (type 0);
each must be named as its state in the directory under that year's code system (this is what catches a Census-
and FIPS-code mix-up), carry the fiscal-year end and survey year of `fiscal_period_for`, and, to FY2016, the
directory's FIPS state code. For those IDs it reads A90, E90, F90 and G90: year of data equal to the fiscal year,
amount a non-negative whole number, a readable flag, no duplicate ID and item, and no G item from FY2022. Every
item flag is kept (`extra.item_flags`; a flag other than R also becomes the quality flag `census_item_flag_<X>`).
The level 2 lines must equal the unit records item for item. A state that fails any check is rejected whole,
with the reason, and nothing from it is loaded. The measure rules are those of the state-by-type parser: a
measure only from items present (no A90, no revenue), and a total that counts an absent component as zero is
flagged `census_formula` and names the item. Two flags mark values that do not measure both items:
`census_expenditure_without_revenue` (Kentucky FY2015-FY2016) and `census_expenditure_equals_revenue`
(Mississippi FY2020-FY2024, on revenue, current operations and total expenditure).

**Result (build of 2026-10-13).** All ten files read with no rejection: 506 observations, 50 to 52 a year.

| Fiscal year | Receipts (A90) | Current operations (E90) | Capital outlay | Total expenditure | State governments with no liquor-store item | Preferred values from |
|---|---:|---:|---:|---:|---:|---|
| FY2015 | 16 | 16 | 4 | 16 | 33 | the 2017 state-by-type release; the unit file only where that release has no value (Kentucky) |
| FY2016 | 16 | 16 | 4 | 16 | 33 | unit file |
| FY2017-FY2018 | 16 | 16 | 3 | 16 | 34 | unit file |
| FY2019-FY2021 | 16 | 16 | 2 | 16 | 34 | unit file |
| FY2022-FY2024 | 16 | 16 | 2 (F90 only) | 16 | 34 | unit file |

Counts are states with a reported value. Kentucky (FY2015-FY2016) has current operations, capital outlay and
total expenditure but no receipts; Maine (FY2015-FY2016) has receipts of 33 thousand and no expenditure item.
A state government with no liquor-store item has no value in any of the four measures.

**The FY2015 overlap.** The FY2015 zip carries a later Census release of FY2015 (`15statetypepu.txt` dated
2020-03-04 and a unit file named `..._10162019modp_pu.txt`) than the state-by-type file loaded since 2026-10-08
(dated 2017-09-06). Their state government liquor items agree for ten states (IA, ID, ME, MI, MS, MT, PA, UT, VT,
WV) and differ for seven, in thousands of dollars:

| State | Item | 2017 release (loaded) | 2020 release (unit zip) | Difference |
|---|---|---:|---:|---:|
| Alabama | G90 | 3,675 | none | -3,675 |
| Kentucky | E90 | none | 5,134 | +5,134 |
| Kentucky | G90 | none | 70 | +70 |
| New Hampshire | A90 | 631,280 | 631,095 | -185 |
| Ohio | A90 | 1,079,367 | 982,337 | -97,030 |
| Ohio | E90 | 755,964 | 755,412 | -552 |
| Oregon | A90 | 544,756 | 1,087,630 | +542,874 |
| Oregon | E90 | 266,726 | 669,510 | +402,784 |
| Oregon | F90 | 86 | 25 | -61 |
| Oregon | G90 | 185 | 833 | +648 |
| Virginia | A90 | 703,504 | 704,141 | +637 |
| Virginia | E90 | 564,751 | 571,328 | +6,577 |
| Virginia | G90 | 3,056 | 2,152 | -904 |
| Wyoming | A90 | 112,634 | 110,208 | -2,426 |
| Wyoming | E90 | 97,827 | 95,540 | -2,287 |

Neither documentation mentions a revision. Oregon's 2020-release revenue is 2.1 times FY2014 (518,659) and 1.9
times FY2016 (568,119), while the 2017 release sits on the trend; Oregon's current operations per revenue
dollar are 0.49 to 0.51 in every loaded year FY2008-FY2015 and 0.62 to 0.75 in the unit files FY2015-FY2024. So
the 2017 release stays preferred for FY2015 (the unit FY2015 asset has the lower priority), the 2020 release is
kept as a competing candidate, and Oregon's current operations and total expenditure from the unit files are
a separate comparability group. Ohio's 2020-release revenue is 9% lower; its FY2016 value (1,051,438) does not
settle which FY2015 figure is right.

As measures, from the built database (validation check `compare_census_fy2015_releases`, which lists exactly
these 20 cells and counts 33 that agree), in thousands of dollars:

| State | Measure | 2017 release (loaded) | 2020 release (unit file) | Difference | Why | Preferred |
|---|---|---:|---:|---:|---|---|
| Alabama | capital outlay | 3,675 | absent item | | G90 only in the 2017 release | 2017 |
| Alabama | total expenditure | 289,408 | 285,733 | -3,675 | the same G90 | 2017 |
| Kentucky | current operations | absent item | 5,134 | | E90 only in the 2020 release | 2020 (only value) |
| Kentucky | capital outlay | absent item | 70 | | G90 only in the 2020 release | 2020 (only value) |
| Kentucky | total expenditure | absent item | 5,204 | | E90 + G90 | 2020 (only value) |
| New Hampshire | receipts | 631,280 | 631,095 | -185 | revised A90 | 2017 |
| Ohio | receipts | 1,079,367 | 982,337 | -97,030 | revised A90 | 2017 |
| Ohio | current operations | 755,964 | 755,412 | -552 | revised E90 | 2017 |
| Ohio | total expenditure | 755,964 | 755,412 | -552 | revised E90 | 2017 |
| Oregon | receipts | 544,756 | 1,087,630 | +542,874 | revised A90 (doubles) | 2017 |
| Oregon | current operations | 266,726 | 669,510 | +402,784 | revised E90; separate group | 2017 |
| Oregon | capital outlay | 271 | 858 | +587 | revised F90 and G90 | 2017 |
| Oregon | total expenditure | 266,997 | 670,368 | +403,371 | all three; separate group | 2017 |
| Virginia | receipts | 703,504 | 704,141 | +637 | revised A90 | 2017 |
| Virginia | current operations | 564,751 | 571,328 | +6,577 | revised E90 | 2017 |
| Virginia | capital outlay | 3,066 | 2,162 | -904 | revised G90 (F90 10 in both) | 2017 |
| Virginia | total expenditure | 567,817 | 573,490 | +5,673 | E90 and G90 | 2017 |
| Wyoming | receipts | 112,634 | 110,208 | -2,426 | revised A90 | 2017 |
| Wyoming | current operations | 97,827 | 95,540 | -2,287 | revised E90 | 2017 |
| Wyoming | total expenditure | 97,827 | 95,540 | -2,287 | revised E90 | 2017 |

The other 33 FY2015 measure cells agree to the thousand (every measure of Idaho, Iowa, Maine, Michigan,
Mississippi, Montana, Pennsylvania, Utah, Vermont and West Virginia; Alabama's receipts and current operations;
New Hampshire's current operations and total), and the 33 state governments with no liquor-store item in either
release have no value in either. Kentucky is the one
place where the 2017 release cannot stay preferred: it has no Kentucky line, which under that file's own
convention (only items that are not zero are printed) means zero, but an absent line is never loaded as a zero,
so the 2020 release's values are the only candidates for those three cells and are preferred, flagged
`census_expenditure_without_revenue`. What Census classified as Kentucky state government liquor-store spending
in FY2015-FY2016 is not documented, and, as everywhere, a value never codes a retail system.

**Still unexplained, kept and flagged rather than corrected.** Mississippi's E90 equals its A90 to the thousand
in FY2020-FY2024 (an expenditure set equal to revenue is not a measurement of either; flagged). Some values
repeat the previous year exactly in the unit files (validation check `census_unit_file_repeats_and_equal_items`,
10 cells): Michigan FY2016 = FY2015 and FY2024 = FY2023 (receipts, current operations, total), Wyoming's FY2024
current operations (and total), Maine's FY2016 receipts (33, as in FY2013-FY2015) and Pennsylvania's FY2016
capital outlay. Alabama's FY2024 E90 (656,569) exceeds its A90 (530,387), against 0.92 to 0.99 of revenue in
earlier years. Vermont's revenue rises 28% in FY2020 and 29% in FY2021. The loaded IndFin years have exact
repeats too (Alabama FY1995 receipts; Idaho FY2000, Iowa FY2011 and West Virginia FY1990 in every item); they
were in the series before and stay in the shown store-cost estimate.

**Checks each later year passed before joining the series:** the FY2015 bridge (above); item definitions
(unchanged in the documentation FY2015-FY2021; the G items end in FY2022, a separate group); units (thousands of
dollars throughout); which government (type digit 0, matched to the directory by name); fiscal-year ends (all
agree); missing values (absent items stay absent; no state government liquor item is an explicit zero); retail
versus wholesale (Census's "liquor stores" still include wholesale-only monopolies, so a value never says who
runs retail stores); revisions (each year is its own pinned asset; the FY2015 release pair is kept).

**Store-cost regression.** The exploratory regression (`store-cost@1.0`) reads every preferred revenue and
current-operations value, so it is held at FY2015 in code (`store_cost.DISPLAY_LAST_YEAR`, passed by the
dashboard export): the estimate shown is unchanged, 666 state-years, FY1972 and FY1977-FY2015. The same model
with FY2016-FY2024 added is written beside it (`cost_model.json`, `extension_check`), leaving out the 8 added
state-years that are flagged or carried forward (Mississippi FY2020-FY2024, Michigan FY2016 and FY2024, Wyoming
FY2024) and the 6 differences that cross Oregon's break (FY2015 to FY2016 at one year; FY2011-FY2015 to
FY2016-FY2020 at five): 801 state-years, still 17 states.

| Changes over | Weighting | FY1972-FY2015 (shown) | With FY2016-FY2024 | Outside the other's interval? |
|---|---|---|---|---|
| 1 year | dollars | 0.675 (0.455 to 0.895) | 0.826 (0.675 to 0.977) | the shown slope sits at the lower edge of the extended interval (0.67495 against 0.67501) |
| 1 year | each state alike | 0.135 (-0.032 to 0.303) | 0.249 (0.031 to 0.468) | no |
| 5 years | dollars | 0.832 (0.625 to 1.039) | 0.867 (0.810 to 0.925) | no |
| 5 years | each state alike | 0.434 (0.195 to 0.673) | 0.584 (0.353 to 0.815) | no |

All four slopes rise, none leaves the shown interval, and only the one-year dollar-weighted shown slope falls
(by 0.00006) outside the narrower extended interval. On FY2016-FY2024 alone the one-year dollar slope is 0.94
(0.79 to 1.09; 120 changes, 16 states), so the later years lean higher, and leaving out Alabama's FY2024 as well
changes the extended one-year dollar slope only to 0.824. The shown estimate is not extended: E90 keeps its
definition, but the later values come from a later Census release that revises FY2015 current operations for
four of the fifteen states with E90 in both releases (Oregon by 151%) without explanation, Mississippi's E90 is
not a measurement from FY2020, and Alabama's FY2024 is unexplained, so expenditure after FY2015 is not shown to
be comparable with the series the estimate rests on. More years of receipts would not, in any case, make
historical spending changes a measure of the costs a grocery-wine change would avoid.


**Census receipts against the peers' own statements (read 2026-10-13, not pinned).** Milestone 2 (c) starts from
what each Census figure corresponds to (research gap `gap_peer_store_finances`; the files to save are in
docs/sources/download-checklist-2026-10-13.md):

| State | Census FY2024 receipts (thousands) | The system's own statement | Match |
|---|---:|---|---|
| Pennsylvania | 2,545,114 | Auditor General's audit of the State Stores Fund: sales net of taxes, FY2024, 2,545,114 (FY2025: 2,530,583) | exact |
| Utah | 493,645 | State of Utah ACFR: Alcoholic Beverage Services Fund sales revenues, FY2024, $493.645 million | exact |
| Idaho | 253,697 | Idaho State Liquor Division FY2024 annual report: total sales $319,165,200 (no auditor's report) | 0.79; not explained. Census's current operations (203,035) are 0.3% below the report's cost of sales plus operating expenses |
| Virginia | 1,203,832 | Virginia ABC ACFR (FY2025 read, introduction only): store net sales after spirits and wine taxes $1,191.7 million, FY2025 | different years; FY2024 statements not read |
| Oregon | 832,412 | OLCC reports not reached | none |

Pennsylvania matches in FY2023 as well (2,513,588). Where they can be traced, Census's liquor-store receipts are
the audited enterprise fund's sales, net of taxes and, in Utah, of the two statutory deposits (school meals
documented, enforcement inferred, above), though Census's Utah FY2023 figure follows DABS instead. That makes them
comparable as receipts; it says nothing about what each system keeps. The Utah-Pennsylvania comparison on Utah at a
glance (rows in `config/dashboard/reconciliation/utah_liquor_sales.yaml`) sets the statements' lines side by side for
FY2023-FY2025 and labels each row comparable, partly comparable or not comparable. Pennsylvania's lines come from the
two saved audits (`pa_ag_plcb_audit_fy2025`, `pa_ag_plcb_audit_fy2024`), transcribed as manual observations
(`pa_plcb_ssf_*`, extracted_unreviewed); every reading was found in its row and year column, and every subtotal of
the statement recomputes exactly.

## Utah: why T10 is a small part of the picture

Utah is a control state: the Department of Alcoholic Beverage Services (DABS) sells all liquor (spirits,
wine, heavy beer) off premises through state stores and package agencies. Its markup earnings are
liquor store revenue, so they are **not** in Census T10. For FY2025 (July 2024 - June 2025):

| Component (FY2025, thousands of dollars) | Value | Source | Notes |
|---|---:|---|---|
| Census T10 alcoholic beverage taxes | 19,086 | Census STC | Beer and other alcohol taxes collected by the state |
| Census T20 alcohol licenses | 0 | Census STC | Published as zero for recent years |
| DABS revenue from liquor sales | 551,346 | DABS FY2025 report p. 32 | Gross sales, not revenue to government |
| DABS net profit for transfer to the General Fund | 100,465 | p. 32 and p. 30 | After expenses and after the earmarked transfers below |
| DABS transfer to School Lunch / Uniform School Fund | 56,897 | p. 32 | Deducted before net profit; additive to it |
| DABS Parents Empowered; underage drinking prevention; SBI | 3,421; 1,750; 9,600 | p. 32 | Deducted before net profit |
| DABS "Sales Tax" | 32,403 | p. 32 | Scope unresolved (see below); not part of DABS profit |

Adding rows of this table double counts unless each overlap is removed. Examples:

- Net profit already has the earmarked transfers subtracted; adding the transfers back is legitimate only
  if the goal is "all DABS earnings directed to government", and then net profit and the transfers must
  come from the same table of the same report.
- The income statement's "Transfer to School Lunch, Uniform School Fund and Public Safety" (66,542 for
  FY2025) is a wider category than the summary's "School Lunch/Uniform School Fund" (56,897); they are
  different measures and must not be combined.
- Sales tax collected on DABS sales is a tax, not DABS earnings. The FY2025 report's letter says local
  municipalities received $32.4 million in sales tax and "the state of Utah received $172.1 million"; the
  $172.1 million equals the General Fund transfer plus the earmarked transfers (100.46 + 56.89 + 9.6 +
  3.4 + 1.75), not a sales tax amount. Whether the 32,403 line is all sales tax on DABS sales or only the
  local share is unresolved and is part of draft data request 1.

No net Utah alcohol revenue total is published here. A defensible total needs audited Liquor Control Fund
statements, the sales tax scope, and Census liquor store revenue on the same basis.

## Utah DABS: internal reconciliation failures

The figures below are transcribed exactly as printed (manual extraction, not yet reviewed by a
maintainer). The annual reports label the statements unaudited. The build recomputes each table's own
arithmetic:

| Report | Table | Fiscal year | Printed components give | Printed total |
|---|---|---|---:|---:|
| FY2025 and FY2024 | Summary Financial Information | FY2022 | gross profit + other income = 261,082 | total revenue 260,082 |
| FY2025 and FY2024 | Summary Financial Information | FY2022 | total revenue - deductions = 133,672 | net profit 134,672 |
| FY2025 and FY2024 | Operations Summary | FY2022 | total revenue - deductions = 134,591 | net profit 134,672 |
| FY2025 and FY2024 | Summary Financial Information | FY2024 | total revenue - deductions = 103,526 | net profit 113,347 |
| FY2025 | Operations Summary | FY2025 | total revenue - deductions = 107,543 | net profit 100,465 |
| FY2025 | Summary Financial Information | FY2025 | total revenue - deductions = 113,280 | net profit 100,465 |
| FY2025 | Income Statement | FY2024 | net operating income + non-operating = 120,756 | net liquor profit 113,347 |

FY2022 total revenue is printed as 260,082 in one table and 260,821 in the other; only 261,082 (gross
profit plus other income) makes the FY2022 deductions reach the printed net profit, which suggests both
printed totals are typographical errors. The dataset does not correct them. Where tables of the same
report disagree, the cell is an **unresolved conflict**: every candidate is kept in `observations`, and
`preferred_observations` shows the cell as missing with `missing_reason = unresolved_conflict`
(6 cells: liquor sales revenue FY2024, other income FY2024 and FY2025, total revenue FY2022, FY2024 and
FY2025). FY2021 and FY2023 reconcile exactly.

## Utah DABS monthly Sales Analysis Reports (source `utah_dabs_sales_analysis`)

Sixteen monthly reports, May 2025 to August 2026, list every product sold with its class code, gross
sales and 9-liter cases. The adapter groups products by `metadata/dabs_class_beverage_map.csv` and
requires each report's rows to add up to its two printed totals (to the cent and to 0.001 case); all 16
do. Fiscal-year sums (`ut_dabs_fy_*`, formula `dabs_fy_sum`) exist only for a fiscal year with all twelve
reports, so only FY2026 (July 2025 to June 2026):

| FY2026 | Gross sales | Share | 9-liter cases |
|---|---:|---:|---:|
| Spirits | 302,995,274.82 | 55.7% | 1,389,659.85 |
| Wine | 182,331,954.71 | 33.5% | 1,291,694.77 |
| Beer (heavy beer and malt drinks) | 32,101,654.42 | 5.9% | 529,830.99 |
| Premixed drinks | 22,336,528.04 | 4.1% | 218,706.79 |
| Cider | 3,875,021.12 | 0.7% | 52,675.72 |
| Other (special orders, supplies) | 41,744.48 | 0.0% | 431.12 |
| All products | 543,682,177.59 | | 3,482,999.24 |

These are gross sales, not revenue to government: the cost of the product, operating costs and transfers
come out of them. They are not the annual report's "Revenue from Liquor Sales" (551,346 thousand for
FY2025), which is a different line for a different year, and the two are never added. What "gross sales"
includes is the next section.

## What DABS "gross sales" include (checked 2026-10-11)

The question: do the monthly reports' "Gross Sales" and the annual report's "Revenue from Liquor Sales"
include the sales tax charged on DABS sales? A tax-exclusive dollar baseline for a scenario needs the
answer. **Partly settled.** The monthly figures are statewide shelf prices times bottles. Whether the
shelf prices include sales tax is not established. Research gap `gap_ut_dabs_sales_basis`.

**Settled: monthly gross sales are statewide shelf prices times bottles.**

- Validation check `dabs_monthly_gross_sales_at_shelf_prices` (profile computed by the adapter,
  `shelf_price_profile`). For each product with at least 10 bottles in a month, gross sales divided by
  bottles is tested for a whole number of cents. 72,650 of 82,161 such product-months pass (88.4%), and
  every month is between 85.0% and 91.5%.
  - Products with 10-99 bottles pass 98% of the time.
  - Products with 100 or more bottles pass less often, because a price change or a temporary price
    allowance during the month mixes two shelf prices.
  - If each store's local sales tax were folded into the totals, or taken out of them, a product would
    pass only by chance: about one time in the number of bottles.
- The bottle column agrees with 9-liter cases and bottle size (cases x 9,000 ml = bottles x ml) for all
  96,525 product-months.
- Three products were checked by hand against DABS's August 2026 price lists (new prices effective
  2026-08-01; read online on 2026-10-11, not pinned, lead `lead_ut_dabs_price_lists`). These are tests in
  tests/test_dabs_sales_analysis.py.

| Product (August 2026) | Gross sales | Bottles | Gross / bottles | Price list |
|---|---:|---:|---:|---|
| Crown Royal Regal Apple 750ml (010807) | 136,034.64 | 4,536 | 29.99 | $29.99 |
| 1800 Silver Tequila 750ml (087510) | 113,223.05 | 4,195 | 26.99 | $26.99 (new; was $29.99) |
| Aperol 750ml (064147) | 111,640.35 | 4,465 | 25.0034 | $24.99 (new; was $29.99): 4,453 x 24.99 + 12 x 29.99 = 111,640.35 |

What this rules out: totals with each store's sales tax added at the register, and totals with sales tax
taken out after the sale. What it does not rule out: shelf prices that already include sales tax.

**DABS's own definition of the annual series (documented, saved 2026-10-14).** Each saved report defines the line in
its Note B: "Sales are reported at published prices; sales taxes excluded" (FY2016 report, p. 22; FY2019 report,
p. 22, "Operating Revenue") and "Sales are reported; sales taxes are liabilities, not revenues, so are therefore
excluded" (FY2021 report, p. 21). The FY2016 statement of operation adds military sales to retail sales to give the
summary's figure (404,939,933 + 971,451 = 405,911,384). The five-year financial summaries of
DABC's FY2016 and FY2019 annual reports label the first line "SALES NET OF TAXES" (FY2012-FY2016) and "Sales net of
Taxes" (FY2015-FY2019), with "Sales Tax" on a separate line below net profit. The FY2021 report's summary
("Sales") continues the same values (427,606; 453,689; 479,324 for FY2017-FY2019) into FY2020 (500,212) and
FY2021 (517,390), the figures the FY2024 and FY2025 reports print as "Revenue from Liquor Sales" and the income
statement calls "Operating Revenue (Note B)". So the annual figure is, by DABS's own definition, sales before sales
tax; the FY2024 and FY2025 reports cite Note B without printing it, so for FY2022-FY2025 the definition is carried by
the unbroken series and that citation. The notes also say sales are recorded "at published prices", which points to
published prices being before tax; it does not define the monthly reports' column.
The Utah revenue scenarios now say "before sales tax" on that basis for the annual series only. Whether the monthly
shelf-price totals are on the same basis is a separate question and stays open (the FY2026 annual figure against
the monthly sums would test it). In FY2012-FY2013 DABS's two deposits were about 10% and 1% of sales *plus* its
sales-tax line, and from FY2014 exactly 10% and 1% of sales net of taxes ("Utah: DABS sales, the statutory
deposits ...", above): what "total gross revenue" included seems to have changed, which the statutes read do not
explain (unresolved).

**Consistent with tax-exclusive figures, but not a definition.**

- DABS's own "gross sales" is the annual "Revenue from Liquor Sales" line. The FY2025 annual report
  (unaudited) prints "Wages % of Gross Sales", which is salaries and wages divided by that line: 41,432 /
  551,346 = 7.51% for FY2025 and 22,945 / 517,390 = 4.43% for FY2021, as printed. The income statement
  calls the same 551,346 "Operating Revenue".
- No sales tax is deducted on the way to profit. The income statement runs from Operating Revenue
  (551,346) through cost of liquor sold, other income, operating expenses and non-operating items to Net
  Liquor Profit (100,465). The five-year summary lists "Sales Tax" (32,403) below net profit, as an amount
  for governments. If sales tax were inside Operating Revenue, net profit would contain tax owed to the Tax
  Commission.
- A DABC memo to the legislative auditors (12 May 2010, printed in report ILR 2010-B, *A Limited Review of
  the Effects of DABC Budget Cuts on State Revenue*, p. 11) estimates lost sales tax as 4% of lost sales
  "due to non-taxable licensee sales". There the tax is computed on top of sales, and sales to licensees
  (bars and restaurants buying for resale) are untaxed.
- The reported margin is nearer the before-tax reading (checked 2026-10-12, `web/src/lib/wineMargin.ts`). The pricing
  statute sets wine, liquor and flavored malt beverages at not less than 88.5% above landed case cost and
  heavy beer at not less than 66.5% (Utah Code § 32B-2-304(2)). Applied to each beverage's share of FY2026
  gross sales (spirits 55.7%, wine 33.5%, beer 5.9%, the rest 4.8%) the floors imply an all-product gross
  margin of 46.5%. DABS reports 47.2% for FY2025 ($260.289 million of gross profit on $551.346 million).
  If gross sales included the state's 4.85% sales tax on top of those shelf prices the floors would imply
  about 49.0% (the state rate alone; local rates would push it higher); the reported figure is 1.8 points from
  that and 0.7 from the no-tax figure. This is consistent with a tax-exclusive definition, not proof of one:
  reduced markups (small producers who apply, military installations, discontinued items) pull the actual
  margin below the floors, prices set above the floor (and, from 2026-03-13, rounding under § 32B-2-213)
  push it above, cost of liquor sold may leave out some landed costs (inbound shipping and case handling are
  in landed case cost), and the mix is from FY2026 while the margin is from FY2025. The statute was read
  through the legislature's page reader from the PDFs of the versions effective 2024-05-01 and 2026-03-13;
  both should be saved into the project's sources.
- Neither the pricing statute nor DABS's price lists mention sales tax. Section 32B-2-304, as reprinted
  in S.B. 180 (2026 General Session), sets prices as markups on landed case cost. DABS's price lists and
  its price-list policy page are silent on the point.

**Against the tax-exclusive reading, or unexplained.**

- The same 2010 audit (p. 3, Figure 1) divides FY2009 "gross sales and fees" of $269.307 million into cost
  of liquor sold, net profit, total expenses, the school lunch transfer and sales tax ($13.995 million;
  the five amounts add to $269.204 million).
  There, sales tax sits inside the gross figure. Either the presentation has changed since FY2009 or the
  auditors combined amounts from different tables; the report does not say which.
- The audited FY2025 State of Utah ACFR (MD&A, p. 32) gives the Alcoholic Beverage Services Fund's sales
  revenues as $486.942 million (FY2024: $493.645 million, Census's FY2024 receipts exactly). That is $64.4
  million below DABS's $551.346 million. DABS's sales less the two statutory deposits (10% and 1.695%) come to
  $486.866 million, $0.08 million from the audited figure, so the gap is the deposits, not sales tax (reconciles
  numerically; the exclusion itself is inferred), and it no longer counts against the tax-exclusive reading.
  FY2024's residual after both deposits, $17.5 million, is unexplained. The fund statements and notes that would
  confirm the treatment could not be read (lead `lead_ut_audited_lcf`). Until they are, the audited and unaudited
  sales figures are different measures and are never combined.

**What would settle it.** The ACFR's fund statements and Note 1 (revenue recognition; sales tax collected
for other governments) once saved, or an answer from DABS (draft request 1 (e) in coverage-audit.md, not
sent). When the FY2026 annual report is held, its revenue line can be compared with the twelve monthly sums
($543,682,177.59). Agreement would show the two are on the same basis, not what the basis is.

**How the dataset uses DABS sales meanwhile.**

- Values are stored as printed. Nothing is grossed up or netted down for sales tax.
- The Utah revenue scenarios take wine's share of monthly gross sales and apply it to the annual "Revenue
  from Liquor Sales". The share is nearly unaffected by the question: the same tax rate applies to every
  beverage, though licensee sales are untaxed and the licensee share may differ by beverage. The tool
  shows the resulting baseline as DABS-reported sales, treated as before sales tax with that treatment
  marked unconfirmed, and points to its sensitivity table for a lower baseline.

## What a Utah grocery-wine revenue estimate would need

Following the plan, any Utah scenario must be relative to the status quo and kept in a scenario
configuration with uncertainty ranges: wine sales shifted from DABS stores to grocers, genuinely
incremental sales, the margin DABS would no longer earn on shifted sales, grocer compensation,
distribution and enforcement costs, and one-time implementation costs. Higher grocery-store sales alone
do not imply new tax revenue.

What exists now (2026-10-14): the Utah revenue scenarios (`?v=scenario`) and, in them, a comparison of three
arrangements on one baseline (`utah-wine-arrangements@1.0`; docs/research-dashboard/README.md, "Comparing
arrangements"). The baseline is FY2025: DABS's sales (before sales tax by its Note B), checked against the audited fund
after the two deposits, never replaced by it. Everything that no source measures (the share moving, prices, avoidable
costs, the access and recapture effects, the replacement tax and the discount) is the reader's assumption, labelled.
One-time implementation costs, grocers' and private wholesalers' profits and local sales tax are still outside it.
These are arithmetic on stated assumptions, not estimates.

## Tennessee

Tennessee wine-in-food-store revenue is not isolated. Census T10 for Tennessee is all alcohol taxes.

The Department of Revenue's June Summary of Collections reports collections by account for the fiscal
year to date (`tennessee_dor_collections`, FY2010-FY2025). The dataset keeps the wine accounts as printed:

| Account | Label as printed | Measure |
|---|---|---|
| 11002 | "Wine Tax" (through FY2017) | `tn_dor_wine_tax_collections` |
| 11002 | "Wine Tax & High Alcohol Beer" (from FY2018) | `tn_dor_account_11002_with_high_alcohol_beer` |
| 11013 | "Wine Tax" / "Wine Tax (Winery)" | `tn_dor_winery_wine_tax_collections` |
| 11018 | "Wine Enforcement Tax" | `tn_dor_wine_enforcement_tax_collections` |
| class TOTAL | ALCOHOLIC BEVERAGES | `tn_dor_alcoholic_beverages_class_total` |

These are collections received July-June, before any distribution to local governments. They cover every
sales channel, so none of them is food-store revenue. How they map into Census T10 is not documented here.

**What is not known yet:**
- the statutory basis of each account;
- why account 11002 was relabelled in FY2018.

Draft data request 2 (not sent) still asks for food-store wine taxes and fees.
