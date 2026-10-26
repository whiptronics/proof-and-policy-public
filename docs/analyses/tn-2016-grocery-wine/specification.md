# Analysis specification: Tennessee food-store wine (2016), a descriptive before-and-after comparison

- **Written:** 2026-10-17, by Claude (AI assistant) at Ethan Whipple's request, before any result below was
  computed. Not reviewed by a person. Human-review statuses in the dataset are unchanged.
- **Kind:** descriptive. It compares how Tennessee's series changed with how comparison states' series changed. It
  estimates no effect. It is **not** the augmented synthetic-control protocol in
  `config/analysis/tn_2016_food_store_wine_ascm.md`, which is a draft, not approved to run, and not run here.
- **Engine:** the dashboard's existing tools only: `before-after@1.2` (`web/src/lib/change.ts`: window means,
  changes, differences in changes, pooled comparison with leave-one-out, pre-period trends, placebo-in-time) and
  `comparison-finder@1.1` (`web/src/lib/finder.ts`). No new estimator.
- **Results:** `results.md` in this folder and the "Before and after: results" section of the worked-example page
  (`?v=case`), both computed by `web/src/lib/caseResults.ts` from the exported dataset.

## 0. What had been seen before this was written

Disclosed because it limits what "specified in advance" can mean.

1. The worked example (`config/dashboard/cases/tn_2016_food_store_wine.yaml`, `docs/research-dashboard/case-study-selection.md`)
   already says which way some post-2016 series moved: Tennessee's apparent wine consumption rose by about a fifth in
   calendar 2016; its wine tax collections rose 22% in FY2017 and were about 5% lower in FY2018 under a wider account
   label; its all-alcohol Census T10 showed no separate step. The author read that text.
2. No post-2016 value of beer, spirits or all-beverage ethanol, of T10 against the comparison states, or of any
   comparison state's beverage series was looked at before this specification was written. Only coverage (first and
   last years), comparability groups and the policy records were checked.
3. Every choice below is fixed by policy history, the series' definitions and pre-2016 information.

## 1. Question

After grocery wine became available in Tennessee, how did wine, beer, spirits and total alcohol purchases, and the
relevant state alcohol-tax receipts, change relative to Tennessee's own earlier pattern and to suitable comparison
states?

"Purchases" here means NIAAA apparent consumption: sales and shipments into a state, divided by its residents. It is
not measured drinking. It includes purchases by visitors and cross-border buyers, and the stocking of a new retail
channel. Reported drinking (BRFSS) is a different quantity and is not an outcome of this analysis.

## 2. The policy date and partial implementation

- **Verified:** 2014 Tenn. Pub. Acts ch. 554 (signed 2014-03-20) created retail food store wine licenses. Ordinary
  grocery wine is verified *not authorized* from 2014-03-20 to 2016-06-30 and *authorized by local option* on
  2016-07-01 (policy records `tn_ordinary_grocery_wine_not_authorized_before_2016`,
  `tn_ordinary_grocery_wine_local_option_2016`; machine-assisted review only). Later days are unknown in the
  dataset.
- **Change date:** 2016-07-01.
- **Partial implementation.** Licenses issue only where a local referendum passed. Which localities adopted it, when
  stores began selling, and how many stores were licensed are not in the dataset, so the share of Tennessee exposed
  is unknown. Every Tennessee result is a whole-state average over exposed and unexposed places.
- **Partial year.** Calendar 2016 straddles the date: it is the transition year, shown in the trends and **left out
  of every average** in the main specification (it is added to the "after" window only in sensitivity S3).
  Tennessee's fiscal year runs July to June, so FY2017 starts on the date and is the first "after" fiscal year.
  Each comparison state's fiscal years keep their own boundaries (Alabama's ends September 30).

## 3. Other changes in or near the windows

- The Unfair Wine Sales Law (no retail wine below cost plus 20%) began the same day, 2016-07-01.
- Package stores could sell beer from 2014-07-01, inside the "before" window.
- From FY2018 Tennessee's account 11002 is printed "Wine Tax & High Alcohol Beer" instead of "Wine Tax"; the
  statutory reason is not recorded. It suggests a change in how some strong beer is taxed or classified. Whether
  NIAAA's Tennessee beer and wine series are affected is not known. Total ethanol is unaffected by any such
  reclassification between beverages, which is one reason it is reported.
- Alcohol-tax rate changes are not coded for Tennessee or any comparison state in the saved data.
- Unexplained breaks in Census T10 (already recorded): Tennessee FY2022 (+39% nominal), Virginia FY2015 and FY2017.
- The pandemic: from March 2020 (calendar 2020, FY2020 onward).

## 4. Outcomes

Primary beverage outcomes, calendar years, NIAAA Surveillance Report 124 data (1970-2024, one comparability group
each), gallons of ethanol per resident aged 21 and older:

| Id | Outcome | Metric |
|---|---|---|
| B1 | Wine | `niaaa_ethanol_per_capita_21plus_wine@calendar_year` |
| B2 | Beer | `niaaa_ethanol_per_capita_21plus_beer@calendar_year` |
| B3 | Spirits | `niaaa_ethanol_per_capita_21plus_spirits@calendar_year` |
| B4 | All beverages (total alcohol in ethanol) | `niaaa_ethanol_per_capita_21plus_all@calendar_year` |

All four are in one unit, gallons of ethanol, so their changes can be set side by side. Beverage gallons are never
added across beverages: a gallon of beer and a gallon of wine hold different amounts of alcohol.

Revenue outcomes, state fiscal years:

| Id | Outcome | Metric and conversion | Scope |
|---|---|---|---|
| R1 | State alcohol selective sales taxes (Census T10), constant 2024 dollars | `stc_alcoholic_beverages_sales_tax@state_fiscal_year`, `real_cy2024` (CPI-U fiscal-year averages) | All beverages, state government only; excludes general sales tax, license taxes and any state-store profit |
| R2 | Tennessee wine tax, account 11002 printed "Wine Tax" | `tn_dor_wine_tax_collections@state_fiscal_year`, constant 2024 dollars | Tennessee only; all channels; FY2010-FY2017 only (the FY2018 relabelling makes a separate series that is not joined) |
| R3 | Tennessee wine enforcement tax, account 11018 | `tn_dor_wine_enforcement_tax_collections@state_fiscal_year`, constant 2024 dollars | Tennessee only; all channels |

R2 and R3 have no comparison-state equivalent in the dataset, so they get Tennessee's own before-and-after only.
A combined "real and per resident" conversion is not available; R1 per resident aged 21+ (nominal) is sensitivity
S7.

## 5. Windows

| Series | Before | Transition | After (main) | After (S1, longer) | After (S2, latest) |
|---|---|---|---|---|---|
| Calendar years (B1-B4) | 2011-2015 | 2016, left out | 2017-2019 | 2017-2021 | 2017-2024 |
| Fiscal years (R1-R3) | FY2012-FY2016 | none | FY2017-FY2019 | FY2017-FY2021 | FY2017-FY2025 |

The main "after" window stops before the pandemic, which leaves only three years of follow-up; that limit is
reported, not hidden. Longer follow-up is a separate sensitivity analysis. Averages use the same years for every
state (the tool's "common years" rule) and need every year to have a value. R2 can only use FY2017 after the
change (its series ends there).

## 6. Comparison states

**Eligibility rule.** The eight states bordering Tennessee (Alabama, Arkansas, Georgia, Kentucky, Mississippi,
Missouri, North Carolina, Virginia). Neighbours share regional trends and most of Tennessee's cross-border trade.
Exclusion rule: a state is excluded if the dataset verifies a change in its ordinary grocery-wine authorization
during 2011-2019. None is verified, so none is excluded.

**Policy histories differ and are reported state by state:**

| History in the dataset, 2011-2019 | States |
|---|---|
| Verified unchanged | Kentucky (not authorized every day), Virginia (authorized every day) |
| Verified on one day only | Arkansas (authorized on 2017-10-01; every other day unknown) |
| Not coded | Alabama, Georgia, Mississippi, Missouri, North Carolina |

**Pools** (fixed now; equal weights):

| Pool | States | Role |
|---|---|---|
| P1 | All eight bordering states | Main |
| P2 | Kentucky and Virginia | Sensitivity: verified histories only |
| P3 | Virginia, Georgia, Arkansas, Kentucky | Sensitivity: the worked example's shortlist (chosen 2026-10-07 on pre-reform T10 per resident) |
| P4 | The four bordering states the comparison finder ranks closest to Tennessee | Sensitivity: finder defaults (population, income per person, adults who drink, wine and all-alcohol consumption), baseline 2011-2015, scaled across all states, Mahalanobis distance, full coverage required |

Cross-border spillover is a known weakness of neighbours: if Tennessee grocers drew buyers from across the border,
neighbours' apparent consumption would fall and Tennessee's would rise for that reason alone. It cannot be measured
with these data. Utah is not a comparison state.

## 7. Calculations and what each uncertainty measure covers

For each outcome and state (`analyzeChange`): before average, after average, change (after minus before), percent
change and log change (100 × ln(after ÷ before)). Against the pool: Tennessee's change minus the pool's average
change (absolute) and the difference in log changes (symmetric between states), with every leave-one-state-out
result, the range of those results, and the spread of the comparison states' own changes. Pre-period trend: the
least-squares slope of each state's before values, and the "if before trends had continued" figure.

None of these outcomes has a published sampling interval, so the tool reports no confidence interval and none is
invented. Three diagnostics take its place, and none is a probability interval:

- **Spread of comparison states' changes** (lowest, highest, SD): how much states' changes differ from one another,
  and whether Tennessee's change lies inside that range.
- **Leave-one-out range:** how much the pooled difference depends on any single comparison state.
- **Placebo-in-time** (`placeboInTime`, up to 20 earlier dates, at least 5 usable): the same difference in changes
  at earlier dates chosen without regard to any law. The typical placebo gap shows how large differences in changes
  are in ordinary years; the share of placebo gaps at least as large as the real one is a rough guide only (windows
  overlap, so dates are not independent).

They do not cover bias from the comparison states' own policy changes, the unknown local exposure, cross-border
buying, reclassification between beverages, or measurement error in the source data.

## 8. Reading rule for the substitution hypothesis (fixed now)

Changes are compared in gallons of ethanol per resident 21+, relative to the main pool.

- "Consistent with substitution" only if Tennessee's wine rises, beer (or spirits) falls by a comparable amount of
  ethanol, and total ethanol rises by clearly less than wine did.
- "Consistent with added purchases" if wine rises and the other beverages do not fall, so total ethanol rises by
  about as much as wine.
- Otherwise "no clear pattern".
- Even the first reading would be an aggregate pattern. It would not show that the same people switched beverages,
  that drinking (as opposed to purchases) changed, or that grocery wine caused it.

## 9. Planned sensitivity checks

| Id | Change from the main specification |
|---|---|
| S1 | Longer follow-up, through 2021 / FY2021 (pandemic included) |
| S2 | Latest follow-up, through 2024 / FY2025 |
| S3 | Calendar 2016 added to the "after" window |
| S4 | Pools P2, P3 and P4 in place of P1 |
| S5 | Residents 14+ in place of 21+ (beverage outcomes) |
| S6 | Total ethanol by NIAAA's time-varying ABV method (gallons, not per resident) |
| S7 | R1 per resident aged 21+ (nominal) in place of constant dollars |

A sensitivity result that differs from the main one is reported as such; none replaces it.

## 10. What this analysis will not do

It will not estimate an effect, run the gated synthetic-control protocol, or use any other causal estimator. It will
not carry Tennessee's observed change into the Utah fiscal scenario: Tennessee's change is a local-option reform in
a state where private licensees sell spirits and wine, measured in purchases, and is not a transferable estimate of
what Utah households would do.
