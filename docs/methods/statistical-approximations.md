# Statistical approximations in the dashboard

What each interval, range and score in the descriptive tools covers, what it assumes and what it leaves out.
Checked 2026-10-12 against the code and a full build. Nothing here estimates the effect of a policy: a gap
that is larger than an interval allows is a detectable descriptive difference, not a cause. Method versions
are named so a saved result can be matched to the rules that made it.

## 1. Published intervals as standard errors (`stats-helpers@1.1`, `web/src/lib/stats.ts`)

Used by Before & after, Compare, Utah at a glance, the map's rank ranges and the map's one-year-jump flag.

- **Rule.** With the estimate inside its published interval, the standard error is the larger of the two
  one-sided distances to the 95% limits divided by 1.96; otherwise half the width divided by z. A missing
  level is read as 95%, the level the CDC sources publish.
- **When this is justified.** Exactly, when the interval is the estimate plus or minus z standard errors on
  the scale shown, as BRFSS and YRBS prevalence intervals nearly are away from 0% and 100%. Approximately,
  for skewed intervals (the CDC binge frequency and intensity medians, death rates from small counts, FARS
  intervals for small states): the larger side never makes a gap look more certain than either side of the
  published interval allows, but a normal test on a skewed estimate is still an approximation.
- **Where it is not used.** A value converted by the project (per resident, constant dollars, an index) has no
  interval of its own and gets no error. A missing interval makes a test "cannot be tested", never "within
  noise". Modeled small-area estimates are not used for inference anywhere.
- **Independence.** Years are separate annual (BRFSS) or biennial (YRBS) samples, states are separate
  samples, and FARS years are separate counts, so errors are combined as independent. No source in the
  dataset publishes a covariance between years or states, so none can be used. The national figure contains
  every state; no tool tests a state against the nation, and if one did, independent errors would overstate
  the error of the gap.
- **Combining.** An average of n years has error sqrt(sum of squared errors) / n; a change combines its two
  averages; a difference in changes combines the two states; the test is two-sided at 5%. Pairwise tests in
  Compare are not corrected for multiple comparisons, which the page says.

## 2. FARS deaths (`uncertainty@1.2`, FARS parser 1.2, `src/alcohol_data/uncertainty.py`)

Two kinds of uncertainty are kept apart and stored separately (`extra.count_se`, `extra.imputation_se`).
They serve two different statistical targets, and each target gets its own interval.

- **Count noise: modelled variability in underlying crash risk.** FARS lists every fatal crash, so the deaths
  in a final year are a fact, not a sample. Comparing years or states needs the underlying expected number
  that the year's crashes are one draw of. Crashes are treated as Poisson events and the deaths in each crash
  as given, so the deaths are compound Poisson with variance equal to the sum over crashes of the squared
  deaths per crash. The interval is a scaled Garwood interval, `phi * Garwood(count / phi)` with
  `phi = variance / count`, which stays sensible for the small counts of small states.
- **Imputation noise: missing alcohol measurements.** For alcohol-impaired-driving deaths NHTSA supplies ten
  imputations of an unreported driver BAC, giving ten versions of the count. Rubin's rules: the estimate is
  their mean, the within-imputation variance W is the mean over the ten versions of each version's
  compound-Poisson variance (the sum of squared deaths over that version's impaired crashes), the
  between-imputation variance B is the sample variance of the ten versions, and the imputation part of the
  variance is I = (1 + 1/m) B with m = 10.
- **Target 1: the underlying expected number (`ci_low`, `ci_high`).** The interval to use when comparing
  years or states, and the only one the map, Compare and Before & after use. Total variance T = W + I. The
  reference distribution is Student's t on Rubin's (1987) degrees of freedom,
  `nu = (m - 1) * (1 + W / I)^2`, the rule NHTSA applies to its own FARS imputations (Subramanian 2002,
  *Transitioning to Multiple Imputation*, DOT HS 809 403). W is a model variance rather than a variance
  estimated from a sample, so the complete-data degrees of freedom are infinite and the Barnard and Rubin
  (1999) small-sample form reduces to the same `nu`. Each side of the interval is
  `(t_nu / z) * sqrt(d^2 + z^2 * I)`, where d is that side's distance in the scaled Garwood interval and z is
  the normal 97.5% point. With no imputation part (B = 0, `nu` infinite) this is the Garwood interval; with no
  count part (W = 0, `nu` = m - 1) it is target 2's interval. `nu` is stored as `extra.rubin_df`.
- **Target 2: the deaths that actually happened (`extra.realized_total`).** Once a year's file is final the
  total is fixed and only the missing BAC readings are uncertain, so W = 0, the variance is I, and the
  reference is t on m - 1 = 9 degrees of freedom. The interval is cut at zero and at the year's total traffic
  deaths. A state-year whose ten imputations agree gets a zero-width interval at the reported count. Traffic
  fatalities are counted, not imputed, and have no such interval. The record drawer shows it as a separate
  sentence; nothing compares years or states with it, because the underlying risk is what a comparison needs.
- **The earlier "about 15% narrow" note, checked (2026-10-12).** uncertainty@1.1 used z for target 1 and gave
  no interval for target 2, only `extra.imputation_se`. The ratio `t_9 / z = 1.154` is the size of the error
  only where imputation is the whole variance, which is target 2. For target 1 the data never come close: over
  the FARS years held (2000 to 2023, 50 states, DC and the nation, 1,248 state-years) the imputation part is
  at most 56% of T (the nation in 2023, `nu` = 28.6, `t_nu / z` = 1.044) and 11% for the median state-year
  (`t_nu / z` = 1.002). The 1.2 intervals for target 1 are wider by exactly those factors; no blanket widening
  was applied. Target 2's interval is narrower than target 1's in every state-year (median 38% of its width).
  The tests in `tests/test_uncertainty.py` check both against an example computed independently with SciPy,
  and check the limits (B = 0, W near 0, agreeing imputations, m = 1).
- **Not covered.** Coding errors, deaths found late, NHTSA's final-file revisions, the choice of the .08
  threshold (Utah's per se limit is .05 from 2018-12-30), the convention of counting by crash state, and any
  error in NHTSA's imputation model itself (the ten versions are taken as proper imputations).
- **Rates.** Per-100,000 rates divide target 1's interval by the Census July 1 population, treated as exact.
  Rates carry no target 2 interval.

## 3. Before & after (`before-after@1.2`, `web/src/lib/change.ts`)

- **Interval of a difference in changes:** section 1, naming what the published intervals cover (sampling
  error for surveys, chance variation in the yearly count for FARS).
- **Pooled comparison.** The equally weighted mean of the comparison states' changes, its error from the
  states' errors, and every leave-one-state-out result. Its interval treats the comparison states' changes as
  fixed apart from noise in the published values, so it leaves out how much states' changes differ from one
  another. The page therefore shows the comparison states' own spread (lowest, highest, standard deviation)
  and whether the target's change falls inside it.
- **Log changes.** 100 x the difference in ln(after / before), symmetric between states where percent changes
  are not.
- **Pre-period trends.** Least squares on three or more before years; the slope's error comes from the
  scatter around the line, with Student's t on n - 2 degrees of freedom (the smaller of the two states' for a
  difference). "If before trends had continued" is the difference in slopes times the years between the
  middles of the before and after windows: arithmetic on straight lines, an assumption rather than a forecast.
  A trend difference that cannot be told from zero is not evidence of parallel trends: with three to five
  points a real difference usually goes undetected.
- **Placebo-in-time.** The same calculation at the same month and day one, two, ... years earlier, keeping only
  dates whose whole window ends before the real change and uses as many years as the real one. The share is
  (1 + placebo gaps at least as large) / (1 + placebo dates), quoted only with five or more dates. The dates
  are chosen without regard to any law, which makes the check a diagnostic: other laws, prices and the economy
  moved in those years too, neighbouring windows overlap, and the comparison states are the same in every run.
  A real gap no larger than the placebo gaps does not stand out; a larger one is unusual for these states and
  years, which is not the same as caused by the change.

## 4. Rank ranges (`rank-intervals@1.0`, `web/src/lib/ranks.ts`)

2,000 seeded redraws, each state's value drawn independently from a normal distribution with the error of
section 1; the range is the 5th to 95th percentile of the state's rank. A state without a published interval
is held at its value and the range says it leaves out that state's own error. The redraws are centred on the
published values, so the range describes how precisely the ranking is known given those values, not bias. It
is a range for one state at a time, not a joint statement about all ranks.

## 5. Comparison finder (`comparison-finder@1.1`, `web/src/lib/finder.ts`)

Each characteristic is put in standard deviations across states; the default distance decorrelates the
numeric characteristics with their correlation matrix shrunk toward independence (Schaefer and Strimmer,
weight at least 5%), and a plain root-mean-square distance remains as an option. Trend characteristics are
least-squares slopes of log values over three or more baseline years, treated as exact although a slope from
a few years is noisy. Warnings flag a best match at 1 SD or more, a best match farther than 90% of states are
from their own nearest neighbour, and a target 2 SD or more from the state average. A lower score under either
distance means closer on the chosen characteristics and nothing more: it does not check outcome trends,
unmeasured differences, spillovers or later law changes, and it does not make a state a valid control.

## 6. Utah wine scenarios (`utah-wine-scenario@1.2`, `scenario-ranges@1.2`)

- **Accounting.** State-store money enters as gross margin, never gross sales; sales tax is on the shelf
  price; avoided operating cost is the avoidable share times the sales that move; scenario B adds only extra
  wine, from three named sources never merged (access, the price response of the wine that moves, cross-border
  recapture); only access wine can replace beer. Tests check each identity (`web/src/lib/scenario.test.ts`).
- **Wholesale arrangement (1.2).** DABS stays the wholesaler and sells to grocers at its shelf price less a
  retailer discount d, so on each dollar that moves the state keeps m − d (m the gross margin), whatever the
  grocer charges; sales tax follows the grocery price. With the grocery price equal to the state store's, the net
  change per dollar that moves is −d plus the avoidable cost, and the margin cancels. Break-even discount:
  d + net A ÷ sales that move.
- **Step by step and earmarks (1.2).** Scenario A is also shown as steps that add up to the net change: the margin
  the stores no longer earn, the revenue kept or replaced on grocery wine, the change in sales tax, the costs
  avoided and the new costs. The statutory school-meals and enforcement deposits are paid out of the gross margin,
  so they appear only as "of which" rows of the first step (today's allocation of the sales that move, at the
  base year's rates in law) and are never subtracted again. The net change is the total across state funds; how it
  is shared among funds depends on how the law would treat the new arrangement, which the scenario does not decide.
- **Break-even lever (1.2).** For a single-lever arrangement (share kept, discount, excise or extra tax), the lever
  value at which scenario A or B is unchanged, found from two evaluations because every scenario is linear in its
  lever (scenario B's price response depends on the shelf price, not the lever) and checked by a third.
- **Ranges.** Every varied input has a low and a high value with a stated basis. Only the price elasticity
  has a published source: Nelson (2013, Health Economics Review 3:17) reports wine at -0.46 after correcting
  for publication bias (95% CI -0.54 to -0.38; the abstract rounds it to -0.45) and an uncorrected
  random-effects mean of -0.58. The +/-0.15 width around the entered value is a convention. Every other range
  is a convention and is labelled as one. An option replaces two of them with bounds the dataset gives: the
  lowest and highest all-product margin DABS reported across years, and avoidable cost from none to all of
  DABS's operating expenses, an accounting ceiling rather than a savings estimate.
- **Where the sign changes (1.2).** For each varied input, the value at which the net change reaches zero with
  the others held, searched from the entered value towards the input's limits (shares: 0-100%; amounts and
  ratios: four range-widths either side) and marked as inside or outside its documented range. A value is a
  switching point, not a likelihood.
- **What is shown.** A one-at-a-time sensitivity table, and two combined scenarios with every input at the end
  of its range that lowers, then raises, the net change (direction from the one-at-a-time table). These
  bracket the table; they are not likely outcomes and carry no probability. They ignore that some inputs
  would move together (a cheaper grocery price with a bigger shift), which can only make the brackets wider
  than a joint distribution would.
- **Worked proposal (1.2).** `WORKED_PROPOSALS` in `web/src/lib/scenario.ts`, opened from the scenario page: one
  explicit policy (grocery wine with DABS as wholesaler at a 20% discount, 30% of wine moving, prices unchanged,
  5% avoidable cost, $500,000 of new costs), every input marked as data, derived, or the proposal's assumption, with
  what it shows and what it cannot establish. Its FY2025 result is checked by hand in
  `web/src/lib/scenarioProposal.test.ts`.
- **What is not shown.** The library keeps a seeded Monte Carlo with a Gaussian copula, but it is not on the
  page: with one range resting on a published source and every distribution, percentile and correlation a
  convention, its percentiles and share of runs above zero would read as probabilities nothing supports.

## 7. Wine margin from the pricing statute (`wine-margin@1.0`, `web/src/lib/wineMargin.ts`)

Utah Code section 32B-2-304(2)(b) sets wine at not less than 88.5% above landed case cost (product cost plus
inbound shipping and case handling), a margin of 46.95% of the shelf price. Read on 2026-10-12, through the
legislature's page reader, from the PDFs of the version effective 2024-05-01 (superseded 2026-03-13) and the
version effective 2026-03-13; both cover FY2025 and FY2026 and agree on the rates. Exceptions below the floor:
49% for makers of under 20,000 gallons a year (620,000 for hard cider) who apply, 17% on sales to military
installations, discounts on discontinued items. Possibly above it: prices set above the floor and, in the
2026 version only, rounding under section 32B-2-213. The figure is offered as a scenario assumption, never
filled in, because no wine-specific cost or profit figure is in the dataset. The check against DABS's reported
all-product margin (46.5% at the floors on the FY2026 mix against 47.2% reported for FY2025, and about 49.0%
if sales included the state's 4.85% sales tax, local rates left out) is nearer the before-tax reading but
cannot settle it. The PDFs are not yet saved into the project's sources.

## 8. Census store-cost regression, exploratory (`store-cost@1.0`, `src/alcohol_data/store_cost.py`)

- **Data.** Census state government finance for the 17 states that ran liquor stores (Utah among them),
  FY1972 and FY1977 to FY2015, 666 state-years: revenue (A90) and current-operations expenditure (E90), which
  includes buying the liquor. Nominal dollars. Maine from FY2005 is left out (expenditure under 30% of
  revenue: the business was no longer state-run).
- **Model.** The change over k = 1 or 5 years in expenditure on the change in revenue, an intercept per end
  year (by demeaning), errors clustered by state with the CR1 small-sample factor, and Student's t on 16
  degrees of freedom. Two weightings: dollars as published, and each state scaled by its mean revenue.
- **Result.** The weightings disagree by more than their intervals: 0.675 (0.455 to 0.895) against 0.135
  (-0.032 to 0.303) at one year, 0.832 against 0.434 at five years. Subtracting a cost-of-goods share to get an
  operating share assumes the other states' margins equal the one the reader uses, which the dataset cannot
  check. Seventeen clusters is few for cluster-robust errors, and inflation moving costs and revenue together
  pushes slopes toward the average cost ratio.
- **Use.** Shown beside the avoidable-cost input as an exploration, never filled in. It is not an estimate of
  Utah's avoidable operating cost, and total operating expenses are a ceiling, not attainable savings.
- **Which years (2026-10-13).** The Census files now reach FY2024, but the shown estimate stays on FY1972 and
  FY1977-FY2015: `run` takes a last year and the dashboard export passes `DISPLAY_LAST_YEAR` (2015), so the
  numbers above are unchanged. `compare_extension` runs the same model with FY2016-FY2024 added, after leaving
  out state-years flagged `census_expenditure_equals_revenue` or `census_expenditure_without_revenue`, added
  state-years that repeat the previous year's revenue or expenditure exactly, and differences whose ends sit in
  different comparability groups (Oregon's unit-file current operations): 801 state-years, 17 states. Every slope
  rises (one year: 0.826 and 0.249; five years: 0.867 and 0.584), none leaves the shown interval, and only the
  shown one-year dollar slope sits, by 0.00006, outside the narrower extended interval (0.675 to 0.977). It is
  written to `cost_model.json` as `extension_check` and summarized in one sentence under the scenario's cost
  evidence; it does not replace the shown estimate, because expenditure after FY2015 comes from a later Census
  release that revises FY2015 current operations for four states without explanation (details and the full
  table in docs/fiscal-reconciliation.md, "Store-cost regression").

## 9. Age-adjusted rates and other denominators (`age-adjust@1.0`), not wired in

Direct standardization to the 2000 US standard population with the Fay and Feuer (1997) gamma interval is
written and tested (`src/alcohol_data/age_adjust.py`). An exploratory run on all FARS traffic deaths for
2013, 2019 and 2022 (`scripts/age_adjusted_fars_check.py`) moved states by less than one rank on average and at
most five (Utah from 42nd to 37th in 2013, two places or fewer in the other years). Vehicle miles (FHWA), regional price
parities (BEA) and an alcohol price index (BLS) are planned in docs/plans/denominators-and-deflators.md; their
files could not be downloaded from this environment, so none is in the dataset.

## 10. Causal analysis

`config/analysis/tn_2016_food_store_wine_ascm.md` is a draft protocol. It is not adopted, not approved to run
and has not been run; committing it is not approval (config/analysis/README.md). No effect estimate exists.
