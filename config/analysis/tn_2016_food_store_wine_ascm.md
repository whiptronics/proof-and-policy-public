# Protocol: augmented synthetic control, Tennessee food-store wine (effective 2016-07-01)

- **Protocol ID:** `tn_2016_food_store_wine_ascm`, version 1 (draft)
- **Written:** 2026-10-12 by Claude (AI assistant) at Ethan Whipple's request. Not reviewed by a person.
- **Status:** draft, **not adopted, not approved to run, and not run**. Committing this file, on its own or
  in a routine commit with other work, neither adopts it nor approves running it. It is adopted only when
  Ethan Whipple records in writing, in section 12 and in `config/analysis/README.md`, that it is adopted and
  may be run, with the date; the preconditions in section 11 must hold as well. This file contains no effect
  estimate and the analysis directory contains no code that makes one. Nothing about outcomes after 2016
  was examined to write it.
- **Gate:** `analysis/causal/README.md` (items 1 to 5). Section 11 lists what must be true before it may run.

## 0. What has and has not been seen

Stated first because it limits what "specified in advance" can mean here.

1. The project's descriptive worked example for Tennessee (`config/dashboard/cases/tn_2016_food_store_wine.yaml`,
   `docs/research-dashboard/case-study-selection.md`) already displays Tennessee's and four neighbours'
   post-2016 series for apparent wine consumption, reported drinking and tax receipts, and its text says
   which way they moved. The author of this protocol read that text before writing it. The protocol therefore
   cannot be blind to the direction of the raw movement in the primary outcome. What it can do, and does, is
   fix every choice below from pre-2016 data and from rules, and require the diagnostics in section 8 to be
   reported whatever they show.
2. To write the protocol the author checked only which years and states the primary outcome covers, and the
   status fields of the policy records, with no value after 2015 retrieved or looked at.
3. The comparison states in the worked example (Virginia, Georgia, Arkansas, Kentucky) were chosen by a
   rule using pre-2016 tax receipts. They play no role here; section 5 defines this protocol's own donor
   rule.

## 1. Question and estimand

**Question.** Did apparent wine consumption per resident aged 21 and over in Tennessee change after the
state allowed retail food stores to hold wine licenses where voters approved, compared with how it would
have moved without that change?

**Estimand.** The effect on the treated state in each year t after the law (average treatment effect on the
treated, one treated unit): `tau_t = Y_TN,t(law) - Y_TN,t(no law)` for t = 2017, 2018, 2019, and their mean.
Reported separately, with the pandemic caveat and not pooled with the above: t = 2020 to 2022; later years
only as an extension.

**What the estimand is.** An intent-to-treat effect of the statewide law, which let food stores apply for
licenses only in jurisdictions whose voters had approved. The share of Tennessee residents actually exposed,
and when, is not in the dataset (`grocery_wine_local_adoption_share` is uncoded). It is the effect of the
bundle that began on 2016-07-01: the same day, the Unfair Wine Sales Law (a minimum markup,
`tn_unfair_wine_sales_law_2016`) took effect, and the protocol cannot separate them.

## 2. Outcome

**Primary and only outcome for inference:**

| | |
|---|---|
| Measure | `niaaa_ethanol_per_capita_21plus_wine` (gallons of ethanol from wine per resident aged 21+) |
| Comparability group | `niaaa_apparent_consumption\|niaaa_ethanol_per_capita_21plus_wine` |
| Vintage | NIAAA Surveillance Report #124 (`sr124`), the preferred edition in the dataset; Report #122 only in the sensitivity run of section 8 |
| Period | calendar year, 1970 to 2024 in the dataset |
| Coverage | all 51 states have a value in every year 1990 to 2015 (checked 2026-10-12; years after 2015 not examined) |

It is apparent consumption from sales, shipments or tax receipts, not observed drinking: tourist purchases,
cross-border shopping and inventory changes enter it. Per-capita values use NIAAA's own population
denominators, kept as published.

**Not used for inference** (descriptive only, as in the worked example): BRFSS prevalence (one comparability
group from 2011 gives five pre-2016 years, too few for this method), Census T10 receipts (all alcohol,
state governments only), Tennessee Department of Revenue wine-tax collections (no donor states).

## 3. Treatment definition and timing

- Policy IDs: `tn_ordinary_grocery_wine_not_authorized_before_2016` (to 2016-07-01) and
  `tn_ordinary_grocery_wine_local_option_2016` (from 2016-07-01; enacted 2014-03-20; `requires_local_adoption`
  true). Both are `checked_against_original`, `machine_assisted_review`, with no reviewer.
- The calendar year 2016 is a **transition year** (half before, half after) and is dropped: neither fitted
  as pre-period nor counted as post-period. Nothing is prorated.
- First affected year: 2017. Outcomes are annual, so anticipation before 2016 (the law was enacted in March
  2014) is examined in section 8, not assumed away.

## 4. Unit and periods

- Unit: state. Treated: Tennessee (`state:47`). Donors: section 5.
- Fit (pre-period): 2000 to 2015. Chosen because the dataset's policy coding starts around 2000 and NIAAA's
  denominators match Census exactly for 2000 to 2009. Alternatives are in section 8: 1990 to 2015 and
  2005 to 2015.
- Excluded: 2016.
- Post-period: 2017 onward, reported as in section 1.

## 5. Donor pool (decided from pre-policy information and legal rules only)

Start from the 50 states and DC. Remove, in this order, counting how many each rule removes:

1. Tennessee.
2. The eight states bordering Tennessee (Alabama, Arkansas, Georgia, Kentucky, Mississippi, Missouri,
   North Carolina, Virginia): cross-border purchases make their consumption respond to Tennessee's law.
   They return in the sensitivity run of section 8.
3. Any state whose grocery-store wine authorization (`ordinary_grocery_wine_authorization`) changed between
   2005-01-01 and the last outcome year used, or whose status on any day in that window is not **verified**
   in the dataset. A state whose history is unknown is removed, not assumed unchanged. As of 2026-10-12 only
   five states have verified history, so this rule alone leaves too few donors: the protocol cannot run until
   donor histories are coded (section 11).
4. Any state in which the state itself sells wine at retail at any time in the window (the dataset records
   Utah and Pennsylvania; the rule needs the full list), because the treated state's channel is private
   retail. Needs verified wine retail-structure history for every candidate.
5. Any state with a concurrent change to wine pricing law, wine taxes or off-premises wine channels in
   2011 to 2019 that the policy catalog records (including Pennsylvania's 2016 act and Colorado's 2023
   change, if the window reaches it). A change recorded after the fact does not return a state to the pool.

The pool is then fixed and listed in the results before any estimate, with the reason each state left.
If the pool has fewer than 19 states, the permutation inference of section 7 cannot reach a p-value of
0.05 (the smallest possible is 1 / (donors + 1)); the analysis may still be run, but must say so.

## 6. Covariates

Primary: none beyond the outcome itself. All 16 pre-period outcome values are the predictors (the standard
setting for the augmented estimator, which corrects the weights' imbalance in these). Sensitivity runs may add
BEA per capita personal income (`bea_per_capita_personal_income`) and the share of the population aged 21+.
No covariate measured after 2015 is used. Nothing that could be a mediator (other alcohol outcomes, tax
receipts from the law's own sales) is conditioned on.

## 7. Estimator and inference

- **Primary: augmented synthetic control** (Ben-Michael, Feller and Rothstein 2021): synthetic control weights
  (non-negative, summing to one, chosen to match the pre-period outcome path) plus a ridge outcome-model
  correction for the remaining imbalance. The ridge penalty is chosen by the cross-validation in the
  maintained implementation (the R package `augsynth`); its version, R's version and every option are
  recorded with the results. If a Python reimplementation is used, it must reproduce `augsynth` on a fixture
  before it is used.
- **Reference estimates, same donors and window, reported beside the primary one and never instead of it:**
  plain synthetic control (Abadie, Diamond and Hainmueller 2010; Abadie 2021 for practice), and the mean
  difference between Tennessee's change and the donors' mean change (the descriptive estimate).
- **Inference with one treated state:** conformal inference for synthetic controls (Chernozhukov, Wuthrich
  and Zhu 2021) for the per-year and average effects, 95% and 80%, as implemented in the package; and the
  placebo-in-space rank of Tennessee's post-to-pre fit ratio among the donors, reported with its resolution.
  Neither is a sampling-based confidence interval for a population; both are conditional on the donor pool
  and the assumptions below, and the report says so.
- **Assumptions to state in the report:** no anticipation of the treatment in the fit window; no spillover
  into donors (hence the border rule); the donors' consumption is not changed by the same cause as
  Tennessee's; the weights extrapolate acceptably (the augmented estimator may use negative weights, and the
  report gives their size).
- Seeds: recorded for any step that uses random numbers (cross-validation folds). Same seed, same results.

## 8. Diagnostics, all reported whatever they show

1. **Pre-treatment fit:** RMSPE over 2000 to 2015, the largest single-year gap, and a plot of Tennessee, the
   synthetic path and the donors. If the fit is poor (RMSPE above the 90th percentile of the donors' own
   pre-period RMSPE in a leave-one-out fit), the estimate is labelled unreliable, not dropped.
2. **Placebo in time:** the same procedure with the treatment date moved to 2010, 2012 and 2013, using
   only data before 2016; any "effect" found there is the method's noise level. The dashboard's Before &
   after placebo check is the descriptive counterpart.
3. **Placebo in space:** the procedure applied to every donor as if treated, with the same rules.
4. **Leave-one-donor-out**, and the donor weights.
5. **Alternative pre-periods** (1990 to 2015; 2005 to 2015) and **donor pools** (borders included; drop the
   largest-weight donor).
6. **Anticipation:** fit with 2014 and 2015 left out of the pre-period (the law was enacted 2014-03-20).
7. **Concurrent changes:** the Unfair Wine Sales Law (same day, inseparable); package-store beer from
   2014-07-01 (`tn_package_store_beer_2014`), inside the pre-period; any other change in Tennessee or a donor
   that the policy catalog records in 2011 to 2019. Each is listed beside the estimate.
8. **Spillovers and border effects:** the border-included run; Tennessee residents buying wine in
   neighbouring states is not observable in the dataset.
9. **COVID:** effects for 2017 to 2019 reported apart from 2020 onward; a run ending in 2019.
10. **Composition and boundary changes:** none expected for states; population denominators are NIAAA's.
11. **Vintage:** the primary run on Report #124; a run on Report #122 to show the revisions' size.
12. **Few-cluster honesty:** one treated unit. A non-significant result does not show "no effect".

## 9. Missingness and exclusions

- A donor must have a value in every fitted year; a missing value removes the donor, and nothing is
  interpolated or imputed. Missing stays missing, never zero.
- 2016 is excluded as the transition year; no other year is dropped. No outlier is removed; a state-year with a
  data problem is reported and the analysis re-run with it flagged, not silently changed.
- Series breaks are kept: the pinned vintage's values only, no splicing across editions.

## 10. Reporting rules

- Say whether a result is an association, an estimated effect under the assumptions above, or a Utah
  extrapolation. This protocol estimates the first or second for Tennessee only.
- It says nothing about Utah, which sells wine through state stores. Any statement about Utah uses the
  simulator's historical predictive evaluation (milestone 7), which keeps evaluation cases apart from
  calibration cases, and says how far Tennessee's setting differs.
- Revenue and consumption evidence alone do not establish net social benefit or harm. No health outcome
  is estimated.
- Report the estimate whether it is positive, negative or null.

## 11. Before this may run

All of these, in the results' preamble, each with the date it became true:

1. A maintainer has set the two Tennessee policy intervals (and the donors' coded intervals) to `reviewed`.
   As of v0.1 none are.
2. Donor histories for `ordinary_grocery_wine_authorization` and wine retail structure are coded and
   verified day by day, 2005-01-01 to the last outcome year, for every state in the starting pool.
3. Ethan Whipple has recorded in section 12, with the date, that this protocol is adopted and may be run.
   A commit is not that record. Any change after adoption goes in section 12 with its date and reason, and
   the results say that it was made after adoption.
4. `augsynth` and R versions are pinned and recorded; a fixture reproduces a published example.
5. The dataset build and vintage are recorded (build ID, pins hash).

## 12. Adoption and later changes

Not adopted. (Add dated entries here, the adoption record first; do not edit the sections above.)

## References

- Abadie, A., Diamond, A., and Hainmueller, J. (2010). Synthetic control methods for comparative case studies:
  estimating the effect of California's tobacco control program. *Journal of the American Statistical
  Association* 105(490): 493-505.
- Abadie, A. (2021). Using synthetic controls: feasibility, data requirements, and methodological aspects.
  *Journal of Economic Literature* 59(2): 391-425.
- Ben-Michael, E., Feller, A., and Rothstein, J. (2021). The augmented synthetic control method. *Journal of
  the American Statistical Association* 116(536): 1789-1803.
- Chernozhukov, V., Wuthrich, K., and Zhu, Y. (2021). An exact and robust conformal inference method for
  counterfactual and synthetic controls. *Journal of the American Statistical Association* 116(536): 1849-1864.
