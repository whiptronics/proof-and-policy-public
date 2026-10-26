# Limitations

This is a research preview. Read this before using any number.

## Scope

- State level only (plus Census regions and the U.S. where a source publishes them). No county, city or
  metro data, so nothing here describes Salt Lake City or Salt Lake County.
- Territories are outside the default panel. BRFSS territory rows and the BRFSS "US"/"UW" median rows
  are not loaded.
- Coverage differs by series; see `docs/coverage-report.md`. A year outside a series' range is out of
  scope, not missing.

## Population

- July 1 estimates from four Census series (1990s, 2000s and 2010s intercensal; Vintage 2025
  postcensal). Where two series give July 1, 2010, the 2010-2020 intercensal series is preferred; both
  are kept.
- 1990s population is all ages only (the intercensal file has 5-year age groups). The 1990s postcensal
  files with 18+ and 21+ are not loaded, to avoid splicing a different vintage.
- Vintage 2025 values for 2020-2025 will be revised.

## Apparent consumption (NIAAA)

- Based on sales, shipments or tax receipts, not observed drinking. Tourist purchases, cross-border
  shopping and inventory changes affect it, and Utah and Tennessee differ in tourism and border access.
- Per capita values use NIAAA's own denominators. For 2010-2019 these differ from the Census 2010-2020
  intercensal estimates by up to 4.3% (New Jersey and New York, 2019); for 2000-2009 they match exactly.
  Recomputing per capita with a different population vintage changes the values.
- Report #124 revised 224 population and per capita cells relative to Report #122; both editions are
  kept.

## Drinking behavior (BRFSS)

- Published crude prevalence only; no microdata. The one age-adjusted series is CDC's own (binge drinking,
  2019-2023, from the Chronic Disease Indicators), kept as a separate measure. CDI's crude binge figures
  repeat BRFSS and are loaded only to cross-check it (0 of 251 shared cells differ by more than 0.1 point).
- 2011 is a methodology break. 1995-2010 and 2011+ estimates are separate comparability groups.
- Binge (2006) and heavy drinking (2015) definitions changed; each definition is a separate measure.
- Prevalence is the share of adults meeting a definition. It is not quantity consumed and cannot be
  combined with NIAAA per capita to give consumption per drinker.

## Finance

- Census T10/T20 are state-government, all-alcohol taxes and licenses. They exclude state liquor store
  profits (most of Utah's alcohol revenue), local taxes, and general sales tax on alcohol. They are not
  wine revenue.
- Utah DABS figures are hand-transcribed from unaudited annual reports, await maintainer review, and do
  not reconcile internally in FY2022, FY2024 and FY2025 (`docs/fiscal-reconciliation.md`). Six cells
  are unresolved conflicts.
- Census liquor-store receipts and expenditure (`census_govfin`) cover state governments only, FY1972 and
  FY1977-FY2024. FY2016-FY2024 come from the Individual Unit Files, whose FY2015 is a later Census release
  that differs for seven states (Oregon's receipts double); the earlier release stays preferred for FY2015, except
  for Kentucky, which only the later release lists. Capital outlay and total expenditure from FY2022 (no G item)
  and Oregon's current operations and total from the unit files are separate comparability groups. Mississippi's
  current operations equal its receipts in FY2020-FY2024 (flagged), and a few values repeat the previous year
  exactly (`docs/fiscal-reconciliation.md`). From FY2013 a state government with no liquor-store item has no value,
  not a zero. Census counts wholesale-only monopolies as liquor stores, so these values say nothing
  about who runs retail stores. Census publishes no liquor store profit or transfer, and revenue minus
  expenditure is not one. Municipal and county liquor stores are not loaded.
- Utah DABS monthly Sales Analysis Reports (May 2025 to August 2026) give gross sales and 9-liter cases by
  product. Gross sales are statewide shelf prices times bottles (checked product by product, 2026-10-11),
  but no DABS document says whether shelf prices include sales tax. The reports do not say how much went to
  restaurants and bars rather than shoppers. They are not the annual report's "Revenue from Liquor Sales";
  the two are never added. Products are grouped into beverage types by `metadata/dabs_class_beverage_map.csv`, which follows
  DABS's class names; cider and premixed drinks are kept apart. Only fiscal 2026 is complete, so it is the
  only fiscal-year sum. Most beer in Utah is sold by private stores and is not in these reports.
- Utah's state sales tax rate (4.85%, the state's own part) is read from Publication 25, whose pages are
  marked "draft pending public meeting"; it is flagged `draft_publication`. Census separates no state's
  general sales tax on alcohol.
- DC fiscal-year dates are not verified against an official source.
- Constant dollars use CPI-U averaged over each state's fiscal-year months, rebased to the 2024
  calendar-year average. A missing CPI month (October 2025 was not published) makes the value missing.

## Context (income and businesses)

- BEA personal income and per capita personal income are current dollars by state of residence. Each BEA
  release revises earlier years (the pinned release, 2026-09-30, revised 2009-2025); per capita values use
  BEA's own population denominator. They are covariates, not alcohol outcomes.
- County Business Patterns counts private employers only. State-run liquor stores are outside its scope, so
  the NAICS 445310 count in a control state is something else: in Pennsylvania, where the state runs the
  wine and spirits stores, it counts private stores such as beer distributors (1,810 in 2023); in Utah, 57
  private stores (2023). Grocery and convenience stores that sell alcohol
  are classified as grocery stores. None of these counts is a count of alcohol outlets or licenses.
- CBP employment is disclosure-protected: cells withheld until 2016 (missing, never zero), noise added from
  2007, noise only from 2017. Each method is its own comparability group.
- The Economic Census (2012, 2017) gives sales of NAICS 445310 beer, wine and liquor stores: private stores
  with payroll only, so not total alcohol sales and not state stores. Utah's figures are withheld in both
  years (stored as suppressed; the files print 0).
- BEA spending on alcohol bought for off-premises consumption (1997-2025) is spending by a state's residents,
  wherever they buy and from any kind of store. Drinks in bars and restaurants are not separated, and each
  BEA release revises earlier years (the release line is kept with each value). It is not tax revenue and
  not store sales.
- Census Monthly State Retail Sales is an experimental product: percent changes from a year earlier only (no
  dollar levels), not seasonally adjusted, and without the significance markers Census prints on its maps.
  The food and beverage stores series mixes supermarkets with liquor stores. A later file may revise earlier
  months.

## Youth drinking and traffic safety

- YRBS covers students in grades 9-12 in school, in odd years: 1991-2017 from CDC's public-domain YRBS
  dataset, which ends there, and 2019-2023 from CDC's Chronic Disease Indicators. The change of source is a
  comparability break, drawn as a gap in every chart. A state appears only in years with weighted results.
  It is not comparable with adult BRFSS.
- FARS counts deaths where the crash happened. Alcohol-impaired-driving deaths are an estimate: NHTSA
  imputes unreported driver BACs ten times and this dataset averages, as NHTSA does. It means a driver at
  .08 or more was involved, not that alcohol caused the crash; Utah's .05 limit (from 2018-12-30) is not
  used. NHTSA replaces each year's annual report file with a final file, so a published figure can differ
  from the file pinned here; for 2013, where both are the final file, they agree exactly.
- FARS deaths carry a 95% interval (uncertainty@1.2) with two parts kept apart. Count noise: crashes are
  treated as Poisson events and the deaths in each crash as given, so the variance is the sum of squared
  deaths per crash (compound Poisson, a scaled Garwood interval). It describes the underlying expected number
  a year's crashes are a draw from, a modelling choice and not a measured error: FARS is a census of fatal
  crashes, so the deaths that actually occurred carry no count noise. Imputation noise (alcohol-impaired
  deaths only): the spread between NHTSA's ten imputations of unreported driver BACs, by Rubin's rules
  (W + (1 + 1/m)B, Student's t on Rubin's degrees of freedom). The interval shown combines both and is the
  one for comparing years or states. The deaths that occurred get a second interval from the imputation
  part alone (t on 9 degrees of freedom, `extra.realized_total`), shown separately in the record drawer and
  used in no comparison. Neither part
  covers coding errors, late-found deaths or the NHTSA final-file revision. Rates divide the interval by the
  population as if the population were exact. The map's "large one-year jump" flag is held back when the
  move stays inside these intervals (95%, z-test of the difference of independent years).
- Intervals in Before & after, Compare, Utah at a glance and the map come from published 95% intervals
  turned into standard errors (the larger side where an interval is skewed) and treat years and states as
  independent, because no source publishes a covariance. They cover only what the published intervals cover
  and say nothing about bias, other laws or the pandemic; a gap outside them is a detectable descriptive
  difference, not an effect. Placebo dates are a diagnostic, not proof that nothing else changed. The Utah
  scenario tool reports sensitivity scenarios, not probabilities. Details: docs/methods/statistical-approximations.md.
- Death rates per 100,000 divide FARS deaths by the state's resident population on July 1 of the same
  year, though visitors die in crashes too. The dataset's national July 1 population ends in 2010, so the
  national rate is missing after 2010.
- Chronic liver disease mortality (2019-2022, by state of residence, age-adjusted and crude) comes from
  CDC's Chronic Disease Indicators. Not every such death is alcohol-related, each reflects many years of
  drinking or illness, and four years cannot show a trend around most policy dates. The dataset is licensed
  ODbL, so `alcohol-data package` refuses a release containing it until the owner decides; longer series
  (CDC WONDER) need a person to accept its terms.

## Policy

- 23 intervals for five states (Utah 14, Tennessee 4, Kentucky 2, Virginia 2, Arkansas 1). None reviewed
  by a maintainer.
- Liquor-control arrangements have verified history for Utah only: the state as the only wholesaler of
  spirits and wine from 2003-05-05, state stores and contract agencies as the retail channel from
  2011-07-01. Every other state's arrangement is a dated current-law snapshot, which says nothing about
  earlier years, so any comparison over a past period shows those states as "cannot be assessed". The
  Utah wholesale claim rests on every lawful supply running to the department; that retail licensees buy
  only from it is not checked separately.
- Utah's ordinary grocery-wine authorization, package-agency channel, beer ceiling and beer tax are verified
  day by day from 2011-07-01, when Title 32B took effect. From 2014-01-01 they are checked against every
  version of the statutes involved. From 2011-07-01 to 2013-12-31 they are checked against text
  reconstructed from the enacted bills, after every 2010-2013 session was inventoried. That text matches
  the 2014 code word for word except one word in 32B-1-102 from 2013-05-14, so those 232 days are
  `reconstructed` rather than `reconciled`. The beer tax is verified from 2003-05-05 (2003 S.B. 66): $11
  for beer before 2003-07-01 and $12.80 from then; the $11 rate's start is not traced. The 4% beer ceiling is
  verified from 2003-05-05 through Title 32A, and so are the grocery-wine and package-agency values; two of
  their Title 32A sections come from the Legislature's 2008 and 2010 code pages kept by the Internet
  Archive, so those days are `reconstructed`. Nothing before 2003-05-05 is verified. The
  checks are text matches on cited provisions, not a full legal analysis, and the inventory is complete
  only for the tracked sections.
- Tennessee intervals rest on the enacted 2014 public chapter. What it establishes: food stores could not
  sell wine from 2014-03-20 to 2016-07-01, and could by local option from 2016-07-01. Status after
  2016-07-01 is not yet verified, so later years are `unknown`, and local referendum coverage is unknown,
  so statewide exposure in 2016 is `local_option_unknown`.
- Tennessee's food-store wine start coincides with a new minimum wine retail price rule (cost plus 20%),
  and package stores could sell beer from 2014-07-01. Both are coded so analyses can account for them.
- Exposure measures legal time, not the number of stores selling wine or market penetration.
- Tennessee Department of Revenue account 11002 isolates wine only while it is printed "Wine Tax" (through
  FY2017). From FY2018 it is "Wine Tax & High Alcohol Beer" and is a separate measure. No account
  separates wine sold by food stores. The amounts are collections received in the fiscal year, before any
  distribution to local governments, and they are parsed from the reports' text layer.

## Officials and committees

- The officials list is one dated snapshot (Open States People, 2026-10-08) in a copy cleaned on 2026-10-11. It is not refreshed. "Current in this source" means the source filed the person in its current folder with a role open on the snapshot date; it is not independently confirmed service.
- A missing end date does not make a role current. Only roles in the current folders count as ongoing, and 119 roles whose start is after their end are treated as unclear.
- Former officeholders are kept for historical questions and shown only on request. A date filter says "cannot say" where a role has no start or end date; 7,972 roles have an end date but no start date and 84 have neither.
- Committee membership is undated: it shows who was on a committee when the source was made, not who served at an earlier date. Two New Hampshire members cannot be matched to a person and three members are in the retired folder; both are listed, not resolved.
- People are never merged by name. One person id appears in two files (listed in the index).
- Contact details are kept only for current records and only e-mail and capitol offices from the cleaned copy. Birth dates, personal phone numbers, social media and personal e-mail were removed before this project received the data and are not restored.
- Nothing links an official or committee to a law, bill, vote or referral. Committee names that might concern alcohol are marked "possible" subject relevance, judged from the name alone, with referral "unverified". Party and committee membership are never used to infer a position.

## Analysis

- No causal analysis is included. Descriptive differences between states or years are not policy effects.
- The Before & after tool's "difference in changes" is descriptive arithmetic over the same years. It does
  not estimate the policy's effect: comparison states are not shown to be unchanged, pre-period trends can
  differ (the tool shows by how much), and verified policy history exists for few states.
- The comparison finder ranks states on baseline characteristics only. Similar states are candidates, not
  validated controls; most states' grocery-wine status in any past year is unknown, and so is every
  state's liquor-control arrangement except Utah's.
- Utah at a glance ranks Utah only among states with a value for Utah's latest year, definition and form,
  so the number of states ranked differs by measure (34 for high school drinking, 51 for alcohol sold),
  and a later value elsewhere is left out rather than compared. A rank is a position, not a judgment, and
  says nothing about why. The four liquor-control peers are shown because their governments also
  wholesale spirits under current law, not because they resemble Utah on the measures.
- The Utah revenue scenarios are arithmetic on the reader's assumptions, one year at a time, for state
  government only. The tool offers the draft Publication 25 sales tax rate as an input. It does not use the
  DABS monthly wine dollars as its baseline. By default the baseline is wine's monthly share times the
  annual "Revenue from Liquor Sales", which is before sales tax by DABS's own Note B (saved FY2016, FY2019 and
  FY2021 reports). The audited state ACFR's lower fund sales leave out the statutory school-meals deposit
  (documented: the fund pays it out as collections and the Income Tax Fund books it) and, by the arithmetic, the
  enforcement deposit (inferred). The audited fund's FY2023 and FY2024 revenue is about $16 million below DABS's
  figures, unexplained (docs/fiscal-reconciliation.md). Whether the monthly reports' shelf prices include sales tax is unresolved. There is no avoidable-cost estimate; the DABS margin used
  by default covers all products and comes from unaudited, unreviewed transcriptions. Local sales tax,
  private profits, one-time costs and any health effect are outside it.
- The arrangement comparison in that tool (`utah-wine-arrangements@1.1`) puts three proposed arrangements on
  one baseline; none describes current law, and none is a forecast. Only household purchases move (since
  2026-10-15), but the household share of *wine* sales is not published: the default is DABS's off-premise share of
  all its sales (82%, read from a chart in the FY2025 report), an all-product figure applied to wine. The reference
  price case holds the consumer price at today's; what private sellers keep is then arithmetic, but what margin a
  Utah grocer would need on wine is not measured, and the margins the worked example assumes are national
  all-product averages read online (Census, 2022), not yet saved. The alternative case assumes a grocery price
  before tax (by default the state-store price) because no private wholesale or retail margin for Utah is in the
  data; the wholesaling cost the state would also stop
  defaults to zero. Arrangement 2's discount and the grocer's resulting margin are policy terms, not
  observations. The allocation in arrangement 3 moves money between state funds and creates none. Purchase
  changes other than the published price response (recapture, easier access) are assumptions with no source,
  and beer substitution is left out. The break-even values hold the other inputs as entered. The share moving is held
  fixed as grocery prices change, so a grocery price above the state store's for the same wine is a strong assumption
  (the page also shows the reading in which buyers return to state stores, labelled exploratory: the market-wide
  elasticity used to size it does not measure switching between two channels). Arrangement 3's guarantee is shown
  as two proposals, fixed and proportional; how a bill would write it, and whether the two deposits stop on wine
  DABS no longer sells, are legal readings not reviewed. The elasticity is a market-level estimate
  from ordinary price variation; break-even taxes far above it are extrapolation under either demand curve. The model
  cannot say whether grocery access would move purchases from beer to wine or change total ethanol: no credible
  cross-price or substitution estimate fits the change, and the privatization studies found more of the newly
  available beverage without an offsetting fall in others (docs/review/grocery-wine-model-audit.md).
- The nationwide map keeps one color scale for every year or month of a measure. Where many periods share
  it, the scale stops at the 95th percentile of the size of changes (or the 2nd and 98th percentiles of
  levels), so a few extreme periods (spring 2020 and 2021 in retail sales) do not wash the rest out; values
  beyond either end take the end color and keep their true labels, and the legend says so. A change map
  marks with † any state whose series moves 50% or more in one year inside the span (Census T10 for Utah
  falls 84% in FY2018), because such a move often reflects a change in what the source counts.
- Per-person and constant-dollar conversions are computed for states only, so the map and the revenue table
  show no national value in those forms.
- Large year-over-year changes are listed for review in the validation report, not removed; real law
  changes produce real discontinuities.
