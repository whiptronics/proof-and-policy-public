# Causal analysis (gated)

Nothing in this directory estimates an effect yet, and nothing may until the gate below is passed.

## Gate

1. Commit an analysis protocol in `config/analysis/<name>.md` **before** looking at post-policy outcomes.
   Committing is necessary, not sufficient: a protocol may run only after the maintainer records explicit,
   dated approval in `config/analysis/README.md`. A routine commit of code or drafts is never that approval.
   It must specify: outcome (exact measure IDs and comparability groups), treatment definition and
   timing (policy IDs with reviewed evidence), unit and period, estimand, donor/control pool and how it
   was chosen (pre-policy data only), covariates, exclusions, missingness rules, diagnostics, and the
   inference method appropriate to the number of treated jurisdictions.
2. Policy intervals used for treatment must be `reviewed` by a maintainer. As of v0.1 none are.
3. Choose the estimator from the original methodological papers and maintained implementation
   documentation (for staggered adoption, a method that allows heterogeneous timing and effects rather
   than a naive two-way fixed-effects regression). Record package versions and seeds.
4. Required diagnostics: pre-treatment fit and trends, anticipation, concurrent tax and law changes (for
   example Utah's 2019-11-01 beer tax change; Tennessee's Unfair Wine Sales Law, effective the same day as
   food-store wine on 2016-07-01; Tennessee package-store beer sales from 2014-07-01), spillovers and
   border effects, composition and boundary
   changes, alternative periods and donor pools, COVID sensitivity, and few-cluster inference. Cities in
   one treated state are not independent state policy changes.
5. Never use modeled small-area estimates (CDC PLACES) as outcomes for local policy effects
   (`compare.causal_outcome_allowed` enforces this), never match on post-policy drinking, and never
   control away plausible mediators.

Results must distinguish an association, an estimated effect under stated assumptions, and any Utah
scenario extrapolation. A non-significant result does not show "no effect". Revenue evidence alone does
not establish net social benefit.

## Status

Not started. Blocking items: Tennessee status after 2016-07-01 and local adoption coverage; wine-specific
revenue series; verified policy history for comparison states (grocery wine is verified for five states,
liquor-control arrangements for Utah only). Utah's own law is now verified day by day from 2003-05-05. See
`docs/coverage-audit.md` (feasibility matrix) and the simulator milestones in
`docs/plans/nationwide-expansion.md`; milestone 7 (historical predictive evaluation) is where effect
estimates would first be tested, and it keeps evaluation cases apart from calibration cases.
