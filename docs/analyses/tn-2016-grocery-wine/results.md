# Results: Tennessee food-store wine (2016), a descriptive before-and-after comparison

- **Computed:** 2026-10-17 by Claude (AI assistant) for Ethan Whipple, from the specification in `specification.md`,
  which was committed (fee519d) before any result was computed. Nothing was changed from that specification. Not
  reviewed by a person.
- **Data:** dashboard export `0.2.0-preview`, build `preview-cc3d8a301d37` (web/public/data). NIAAA apparent
  consumption (sales and shipments, not drinking), Census T10 and Tennessee Department of Revenue collections, all
  transcribed or parsed by software and unreviewed.
- **Tools:** `case-results@1.0` (`web/src/lib/caseResults.ts`), which runs the dashboard's existing `before-after@1.2`
  and `comparison-finder@1.1`. Shown on the worked-example page (`?v=case`, section 6). Descriptive only: no effect is
  estimated, and the gated synthetic-control protocol was not run.
- **Verification status (2026-10-17):** the TypeScript type check is clean, and the new data test
  (`web/src/lib/caseResults.data.test.ts`), which recomputes every figure below from the export, passes under a Node
  development harness in the Linux workspace on Ethan's PC. That harness is not vitest. **Not yet done:** the real
  vitest run, the production build and a browser check of the new section on Windows. The command is in
  docs/progress.md (entry "first empirical policy-results analysis").

## Short answer

1. **Wine purchases rose clearly more in Tennessee than in its neighbours.** Gallons of ethanol from wine per resident
   21+ rose 26% between 2011-2015 and 2017-2019, against −0.4% to +13.9% in the bordering states: 16.3 log points more than
   their average, outside every neighbour's change, and larger than the gap at any of 17 earlier placebo dates. Most of
   it arrived as a step in 2016, the year licenses began, and the level then held through 2024. Every sensitivity check
   gives 16 to 19 log points.
2. **Beer fell, by about as much as in the neighbours.** Tennessee's beer fell 8.2%; the neighbours' average fell about
   as much. The difference (−1.1 log points, −0.009 gallons) is inside the neighbours' range and smaller than the
   typical placebo gap, and stays between −2.4 and +1.6 log points in every sensitivity check.
3. **Total ethanol rose relative to the neighbours, not fell** (+0.104 gallons per adult, 4.5 log points; 2.3 to 7.5
   across the checks), by about as much as wine and spirits together. A gap that size is ordinary for these states: 5
   of 17 earlier placebo dates show one as large, and Tennessee's spirits were already rising faster before 2016.
4. **Substitution.** Wine rose and beer declined, but the comparison does not establish that grocery wine caused people
   to switch beverages. By the reading rule fixed in advance, the wine increase was not matched by a relative fall in
   beer or spirits (corrected wording, 2026-10-17: "the pattern of added purchases" overstated what this shows). It is an aggregate pattern of
   purchases in one state and does not establish what any person did or that grocery wine caused it.
5. **Revenue.** Tennessee's all-beverage T10 rose 31.6% in constant dollars (22.6 log points more than the
   neighbours), but it was already rising by about $9.2 million a year before 2016; extending that trend arithmetically covers
   roughly two-thirds of the gap against the four states where the comparison can tell. Tennessee's wine-tax account
   (all channels) was 31% above its FY2012-FY2016 average in FY2017, its only comparable year, after rising 9% already
   in FY2016.
6. **Utah.** None of this is a transferable estimate for Utah, and it is not used in the Utah fiscal scenario. For this
   one case it weakens the idea that grocery wine mainly replaces beer.

## 1. Raw trends

Gallons of ethanol per resident 21+ (NIAAA). Neighbours' average = the simple average of the eight bordering states.
2016 is the transition year (licenses from July 1).

| Year | Wine: Tennessee | Wine: neighbours' average | Beer: Tennessee | Beer: neighbours' average | Spirits: Tennessee | Spirits: neighbours' average | All: Tennessee | All: neighbours' average |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 2008 | 0.231 | 0.287 | 1.243 | 1.352 | 0.644 | 0.723 | 2.118 | 2.361 |
| 2009 | 0.234 | 0.289 | 1.193 | 1.319 | 0.643 | 0.731 | 2.070 | 2.339 |
| 2010 | 0.255 | 0.301 | 1.176 | 1.289 | 0.696 | 0.733 | 2.126 | 2.322 |
| 2011 | 0.276 | 0.311 | 1.280 | 1.254 | 0.744 | 0.745 | 2.300 | 2.311 |
| 2012 | 0.281 | 0.316 | 1.207 | 1.258 | 0.765 | 0.760 | 2.253 | 2.334 |
| 2013 | 0.283 | 0.322 | 1.177 | 1.234 | 0.784 | 0.769 | 2.244 | 2.325 |
| 2014 | 0.286 | 0.328 | 1.163 | 1.213 | 0.814 | 0.779 | 2.264 | 2.320 |
| 2015 | 0.300 | 0.338 | 1.161 | 1.215 | 0.849 | 0.811 | 2.309 | 2.364 |
| 2016 | 0.365 | 0.340 | 1.146 | 1.195 | 0.886 | 0.822 | 2.397 | 2.357 |
| 2017 | 0.355 | 0.343 | 1.105 | 1.169 | 0.903 | 0.840 | 2.363 | 2.352 |
| 2018 | 0.359 | 0.347 | 1.098 | 1.143 | 0.937 | 0.850 | 2.394 | 2.339 |
| 2019 | 0.364 | 0.347 | 1.095 | 1.124 | 0.986 | 0.897 | 2.444 | 2.369 |
| 2020 | 0.391 | 0.368 | 1.090 | 1.142 | 1.095 | 0.987 | 2.576 | 2.497 |
| 2021 | 0.393 | 0.370 | 1.139 | 1.152 | 1.188 | 1.040 | 2.720 | 2.561 |
| 2022 | 0.377 | 0.352 | 1.138 | 1.101 | 1.196 | 1.041 | 2.711 | 2.494 |
| 2023 | 0.370 | 0.338 | 1.069 | 1.043 | 1.196 | 1.043 | 2.635 | 2.424 |
| 2024 | 0.356 | 0.324 | 1.033 | 1.002 | 1.153 | 1.049 | 2.542 | 2.375 |

Tennessee, constant 2024 dollars (millions). The wine-tax account is printed "Wine Tax" through FY2017 and "Wine Tax &
High Alcohol Beer" from FY2018; the two are separate series and are not joined.

| Fiscal year | T10 | Wine tax (11002, 'Wine Tax') | Account 11002, 'Wine Tax & High Alcohol Beer' | Wine enforcement tax (11018) |
|---|---:|---:|---:|---:|
| FY2010 | 170.1 | 15.2 | — | 0.70 |
| FY2011 | 174.9 | 15.9 | — | 0.76 |
| FY2012 | 183.4 | 16.3 | — | 0.77 |
| FY2013 | 189.9 | 16.4 | — | 0.77 |
| FY2014 | 197.3 | 16.6 | — | 0.79 |
| FY2015 | 211.8 | 16.9 | — | 0.81 |
| FY2016 | 229.5 | 18.4 | — | 0.83 |
| FY2017 | 241.9 | 22.1 | — | 1.04 |
| FY2018 | 255.0 | — | 20.5 | 0.97 |
| FY2019 | 275.1 | — | 21.0 | 0.96 |
| FY2020 | 260.8 | — | 21.3 | 0.99 |
| FY2021 | 251.2 | — | 22.0 | 1.01 |
| FY2022 | 325.3 | — | 20.3 | 0.94 |
| FY2023 | 334.5 | — | 18.7 | 0.87 |
| FY2024 | 331.8 | — | 18.1 | 0.85 |
| FY2025 | 327.5 | — | 16.9 | 0.79 |

## 2. Comparison of changes, main specification

Before 2011-2015 (FY2012-FY2015 for T10: Alabama's FY2016 straddles the date, so FY2016 is dropped for every state);
transition 2016 left out; after 2017-2019 (FY2017-FY2019). Main pool: all eight bordering states, equal weights.
"Inside?" asks whether Tennessee's change lies within the range of the eight neighbours' changes.

| Outcome | Tennessee before → after | Tennessee change | Neighbours' average change | Difference | Difference, log points (leave one out) | Inside? | Placebo: typical gap; earlier dates as large |
|---|---:|---:|---:|---:|---:|---|---|
| Wine | 0.285 → 0.359 | +0.074 (+26.0%) | +0.023 | **+0.052** | **+16.3** (15.2 to 17.2) | No (neighbours −0.001 to +0.055) | 0.009; none of 17 |
| Beer | 1.198 → 1.099 | −0.098 (−8.2%) | −0.090 | **−0.009** | **−1.1** (−1.5 to −0.3) | Yes (−0.148 to −0.017) | 0.043; 16 of 17 |
| Spirits | 0.791 → 0.942 | +0.150 (+19.0%) | +0.090 | **+0.061** | **+6.6** (5.6 to 7.6) | Yes (+0.027 to +0.160) | 0.010; 3 of 17 |
| All beverages | 2.274 → 2.400 | +0.126 (+5.6%) | +0.023 | **+0.104** | **+4.5** (3.9 to 5.1) | No (−0.072 to +0.120) | 0.063; 5 of 17 |
| T10, constant 2024 $ | $195.6M → $257.3M | +$61.7M (+31.6%) | (in dollars, not comparable across state sizes) | — | **+22.6** (20.8 to 23.9) | Yes in dollars | $5.9M against $46.4M; none of 18 |
| Tennessee wine tax (11002) | $16.9M → $22.1M (FY2017 only) | +$5.2M (+30.6%) | no equivalent | — | — | — | — |
| Tennessee wine enforcement tax | $0.80M → $0.99M | +$0.19M (+24.4%) | no equivalent | — | — | — | — |

Beverage changes in gallons of ethanol per resident 21+. Per-state detail is in the page's state tables. Points worth
knowing:

- **Wine:** Tennessee minus each neighbour is positive in all eight (+0.019 against North Carolina to +0.075 against
  Georgia). Before-period trends do not explain it: the "if trends had continued" figure is near zero or negative
  except against Georgia (+0.031).
- **Beer:** Tennessee's own 2011 value (1.280) is its highest of 2008-2016 and raises its before average, which makes
  its decline look larger; even so no relative decline appears.
- **Spirits:** Tennessee's before-period trend (+0.026 a year) is steeper than most neighbours'. Against the five
  neighbours where the "trends only" figure can be told from zero, trends alone give 60% to 120% of the observed gap.
- **T10:** Tennessee's before-period trend is +$9.2M a year. Against Arkansas, Georgia, Mississippi and Missouri, where
  the "trends only" figure's interval excludes zero, a straight-line extension of earlier trends covers $37-45M of the $57-66M differences (arithmetic, not a cause). The placebo check is
  in dollars, and Tennessee's earlier windows had smaller dollar growth, so it overstates how unusual the gap is.

## 3. Sensitivity checks

Difference in log points between Tennessee's change and the pool's average change.

| Specification | Wine | Beer | Spirits | All beverages | T10 |
|---|---:|---:|---:|---:|---:|
| Main: eight bordering states, 2011-2015 vs 2017-2019 | +16.3 | −1.1 | +6.6 | +4.5 | +22.6 |
| S1: follow-up through 2021 / FY2021 (pandemic) | +17.0 | −0.7 | +8.2 | +5.6 | +19.1 |
| S2: follow-up through 2024 / FY2025 | +18.6 | +1.6 | +9.4 | +7.5 | +31.6 |
| S3: 2016 added to the after window | +17.1 | −1.2 | +6.3 | +4.4 | · |
| S4: P2, Kentucky and Virginia (verified histories) | +18.1 | −2.4 | +3.4 | +2.3 | +21.7 |
| S4: P3, the worked example's shortlist | +17.5 | −1.0 | +7.1 | +4.6 | +21.2 |
| S4: P4, the finder's closest (Alabama, Kentucky, Mississippi, Missouri) | +16.6 | −0.5 | +4.6 | +4.2 | +23.6 |
| S5: residents 14+ | +16.4 | −1.0 | +6.7 | +4.6 | · |
| S6: total gallons, time-varying ABV | · | · | · | +6.2 | · |
| S7: T10 per resident 21+, nominal | · | · | · | · | +21.2 |

- The wine result barely moves (16.3 to 18.6). The beer result stays near zero (−2.4 to +1.6).
- Total ethanol stays positive (2.3 to 7.5), smallest with the two verified-history states, where leaving one out spans
  −0.1 to +4.8.
- T10's highest figure (S2) runs past Tennessee's unexplained FY2022 jump (+39% nominal) and should not be read as
  growth from wine.
- S6 is total gallons, so Tennessee's population growth is not removed.

## 4. What this suggests about the substitution hypothesis

The hypothesis is that grocery wine would move existing drinkers from beer to wine without more drinking. In
Tennessee's aggregate purchases:

| Main specification, gallons of ethanol per resident 21+ | Tennessee | Neighbours' average | Difference |
|---|---:|---:|---:|
| Wine | +0.074 | +0.023 | +0.052 |
| Beer | −0.098 | −0.090 | −0.009 |
| Spirits | +0.150 | +0.090 | +0.061 |
| All beverages | +0.126 | +0.023 | +0.104 |

- The relative fall in beer (0.009 gallons) is about a sixth of the relative rise in wine (0.052) and smaller than an
  ordinary year's gap. Under the rule fixed in the specification this is not the substitution pattern; the comparison does
  not show whether people switched beverages.
- Total ethanol did not fall relative to the neighbours. It rose, though by an amount ordinary years also produce.
- **What this cannot show:** whether the same people switched, whether drinking changed (these are purchases), or that
  grocery wine caused any of it. Cross-border buying into Tennessee, stocking of the new channel, the minimum-price law
  that began the same day and a possible reclassification of strong beer (account 11002's FY2018 relabelling) could
  each move these series. Total ethanol is immune to the last of these.

## 5. What this cannot establish about Utah

- Tennessee's reform was a local option in a state whose spirits and wine are sold by private licensees. Utah sells
  both through state stores and agencies, so its revenue arrives as store profit, which T10 does not measure.
- This describes purchases relative to neighbours; it is not an effect estimate. It is therefore not carried into the
  Utah fiscal scenario, and it does not say what Utah households would buy or whether switching would offset a revenue
  loss there. The Utah brief already treats beer-to-wine switching as unverified; this result is consistent with that
  caution, and the brief is not changed.

## 6. Missing evidence that most limits the reading

1. Which Tennessee localities adopted grocery wine, when, and how many stores were licensed: without it, every figure
   averages exposed and unexposed places and understates any local change.
2. The statutory basis of account 11002's FY2018 relabelling, and whether NIAAA's Tennessee beer and wine series
   changed classification.
3. Grocery-wine and alcohol-tax histories for six of the eight neighbours (only Kentucky and Virginia are verified).
4. Monthly sales around July 2016, to separate stocking from sustained purchases, and any measure of cross-border
   buying.
5. Household purchase panels or surveys that follow the same people: the only data that could show switching.

## 7. What the uncertainty measures cover

None of these series has a published sampling interval, so no confidence interval is reported and none is invented.
The leave-one-out ranges show how much the pooled result depends on one neighbour. The neighbours' range shows how much
states' changes differ. The placebo dates show how large a difference in changes is at earlier dates chosen without
regard to any law; their windows overlap, so the share is a rough guide. None is a probability interval. None covers the
comparison states' own policy changes, the unknown local exposure, cross-border buying, reclassification between
beverages or errors in the source data.

## 8. Reproduce

- Page: the dashboard's worked example (`cd web && npm run dev`, then `?v=case`), section 6.
- Figures: `npm --prefix web test` runs `web/src/lib/caseResults.data.test.ts`, which recomputes the comparison from
  web/public/data and pins every number quoted here.
- Full check: `scripts\verify.bat` on Windows.
