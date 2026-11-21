# Public Funding: methods and reconciliation (public-funding@1.0)

- **Status:** written 2026-11-20 by Claude (AI) for Ethan Whipple. Machine-assisted; **not reviewed by a person**; not a
  fiscal note, not legal advice. Every value is `human_reviewed: false`.
- **Code:** observed figures, `scripts/public_funding.py` → `web/src/lib/publicFunding.generated.ts`; scenario figures,
  `web/src/lib/publicFunding.ts`; page, `web/src/views/FundingView.tsx` (`?v=funding`).
- **Engine:** the adapter calls `netPerDollar` and `terms()` from `policy-designs@1.0`, which it does not change.

## 1. Observed figures and how each is checked

| Figure | Source and locator | How the script checks it |
|---|---|---|
| DABS FY2025 sales, cost, other income, operating expenses, transfers, net profit | DABS 90th Annual Report, page 30 (unaudited), from the curated transcription | The page 30 identities must close within $1,000 (sales − cost = gross profit; + other income − operating expenses = net operating income; − transfers − nonoperating = net profit) |
| Six destinations (General Fund, school meals, sales tax, enforcement, Parents Empowered, other underage) | same report, page 32 | Read from the transcription; their sum is labeled "the sum of six amounts", never a DABS total |
| Utah Code deposit rates and the wine markup floor | Utah Code 32B-2-301, -304, -305, -306, the versions current when read on 2026-11-20 | Each rule's quoted sentence must appear in the saved statute text, or the script stops |
| The same rules as in force during FY2025 | The 2024-05-01 versions of 32B-2-304 and -306 (superseded 2026); -305 unchanged; -301's pre-2025-05-07 version not found | Each quote must also appear in the FY2025 version, and each version page must print its "Superseded" date (`qa/legal-as-of.md`) |
| Federal reimbursement for one free lunch, SY2024-25 | 89 FR 56720 (July 10, 2024), Sections 4 and 11, contiguous states | Five sentences of the notice must appear in the saved text; shown as a reimbursement rate, not a cost |
| USBE current expenditures per pupil, FY2024, by district | USBE Superintendent's Annual Report FY2024 | All 41 district rows must parse and match a Census row by name; agreement with the Census-derived figure is tested (`qa/independent-comparison.md`) |
| Census FY2024 current spending per pupil, states and nation; district finances | 2024 Annual Survey of School System Finances, Tables 8, 11, 20 and the individual-unit file | The four press-release values (US 17,619; UT 11,347; ID 11,060; AZ 12,003) must match |
| NAEP 2024 scores and comparisons | NAEP Data Service, `type=data` and `type=sigacrossjuris`, national public plus 51 jurisdictions | Comparisons are NCES's own significance tests, never a score difference |
| CPI-U fiscal-year averages | BLS series CUUR0000SA0, July–June | A fiscal year with a missing month raises; October 2025 (not published) is skipped as a month |
| Tennessee's wine tax ($1.21 a gallon, a state tax only, generally paid by wholesalers) and its 2014 food-store wine act | Tennessee Department of Revenue, Alcohol Tax Manual (June 2025), chapter 3; Public Chapter 554 (2014) | Four sentences of the manual and two of the act must appear in the saved text |
| Tennessee account 11002, FY2012-FY2025 | Summary of Collections, June editions (fiscal-year-to-date page) | Read by the project's own adapter (`tn_dor_collections`), whose account lines must add up to the printed class total; exactly one account 11002 value per year, and FY2017 must still be printed "Wine Tax". The two printed labels stay separate series; amounts are in dollars of each year |
| Colorado's wine excise (7.33 cents a liter), wine development fee (1.0 cent) and the 85% allocation to the old age pension fund | C.R.S. 2024, 44-3-502(1)(a) and 44-3-503(1)(a), (c)(I), pages 100-101 of the printout | Four sentences must appear in the text of those two pages |
| Wine and all-beverage ethanol per resident 21+, Utah, Tennessee, Colorado, United States | NIAAA Surveillance Report #124 data file, 2015, 2017, 2022, 2024 | Read by the project's own adapter (`niaaa_pcyr`); every place and year must have both values |
| School-meal funding context; S.B. 180 (2026) | Office of Legislative Research brief (2025-01-16); the bill's introduced text and fiscal note; the bill page (status recorded by hand in `metadata/legal_history/utah_sb180_2026_status.csv`) | Quotes checked against the saved text; the status table is hand-recorded and marked so |

### Reconciliation audit

- **Page 30 closes exactly.** $551.346M sales − $291.057M cost = $260.289M; + $8.237M other income − $81.910M operating
  expenses = $186.616M; − $66.542M transfers − $19.609M other nonoperating items = $100.465M to the General Fund. The
  $19.609M is not itemized in the transcription and is shown as **unreconciled**, not labeled a cost.
- **Two printings differ.** Other income is $8.237M on page 30 and $6.569M on page 32, so total revenue is $268.526M and
  $266.858M. Both are kept; neither is corrected.
- **Reported deposits are not the statutory rate times sales.** 10% of FY2025 sales is $55.13M; DABS reports $56.90M for
  school meals. 1.695% is $9.35M against $9.6M reported. The page shows both and says the difference is not explained.
- **The $204.5M is not a profit or a tax.** It adds sales tax buyers paid ($32.4M, collected for the Tax Commission) to
  amounts paid out of DABS revenue. The chart says the amounts are listed side by side, not as shares of a whole.
- **All liquor, not wine.** No DABS figure on the page is wine-specific. The lab uses the existing wine terms instead.

## 2. The scenario ledger

Terms come from `terms()` (policy-designs@1.0): L landed cost per $ (52.8%), μ DABS's gross margin per $ (47.2%,
FY2025 all products, applied to wine), τ state sales tax (4.85%), household wine H·W, and the wine that moves at the
reference share M = W·H·s₀.

Inputs: arrangement A (today), B (DABS wholesale to grocers) or C (private wholesale with a state charge); shelf price P
against today; grocer gross margin g; private wholesaler margin d (C only); share s of household wine that moves (or
unknown); new purchases n as a share of household wine; the DABS savings case v (none, allocated, longer run); whether
license fees cover the new administration; and how the earmarked deposits are routed.

- Wine that moves: moved = M·s/s₀ (unknown when s is unknown). New purchases: N = n·H·W.
- State change per $ that moves (the engine's closed form). B: P(1 − g) − 1 + τ(P − 1) + v. C: (P − Q) + τP − (μ + τ) + v,
  where the wholesaler pays Q = L / ((1 − d)(1 − g)). At P = 1, g = 10%, v = 0: B −10.0¢, C (d = 29.5%) −30.4¢.
- New purchases displace nothing at DABS, so the state keeps its whole take on them and saves nothing:
  perNew = per(v = 0) + μ + τ.
- Net a year: net = per·moved + perNew·N − (license fees ? 0 : the engine's fixed administration).
- Programs: school meals 10% (32B-2-304(5)), enforcement 1.695% (32B-2-305(4)), underage campaign 0.6% two years later
  (32B-2-306(3)). Rates are read from the law ledger. Each program's base per $ is 1 today; under B with the sections
  as written, P(1 − g) (DABS's revenue on its sale to the grocer, *assumed* to count); under C as written, 0; with a bill
  that applies the rates to the grocery sale, P. Baseline = rate·moved; after = rate·base·(moved + N).
- Conservation: the programs' changes plus the rest (General Fund and other accounts) equal the net change. Routing
  moves money between state accounts and adds none (tested).

### Conditions

Each is satisfied, not satisfied or **undetermined**; an unknown never reads as success.

- **Revenue:** net ≥ 0. With the share unknown, the per-dollar sign decides if fees cover administration and there are no
  new purchases; otherwise undetermined.
- **Price:** P ≤ today's state-store price.
- **Programs:** each program's change ≥ 0, tested separately from revenue (a program can be whole while the state is
  behind, and the reverse).
- **Grocer:** satisfied at or above the Census grocery-store average gross margin (about 28%); not satisfied at 0;
  undetermined between, because no measure says whether grocers would sell wine at that margin.

### Map, stress test and documented-input-only mode

- **Map:** every price (−10% to +50%) and margin (0–40%) cell is classified by the same revenue and price tests, per $
  that moves, with fees covering administration and no new purchases. The private wholesaler margin is the user's.
- **Stress test:** at the chosen price and margin, the share that moves runs 5–60% and new purchases 0–5%, for each
  savings case with and without fees. The range ends are conditional sensitivity results, not confidence intervals.
- **Documented inputs only:** share unknown, no new purchases, no savings. What still has an answer is what the
  per-dollar arithmetic decides.

### What reverses the conditional results

At today's price under B, the state is behind by the grocer's margin per $ that moves unless DABS's avoided costs or
new purchases cover it. The longer-run savings case (wages fall with sales) nearly covers a 10% margin; new household
purchases of about 7% would cover it with no savings (`?v=sameprice`). Neither is measured. Under C at today's price
the state charge is what is left after both private margins, so the result turns on d and g.

## 3. Tests

- `web/src/lib/publicFunding.test.ts` (49; 6 for PPF-407: the Tennessee and Colorado figures and sources, the two
  account labels kept apart, the per-bottle arithmetic, every comparison row filled, and a check that the chapter
  states its limits and uses no causal wording, a check shown to fail on "led to"): the devplan's test-matrix rows F01–F20, E01–E09, L01–L09 and U09.
  F04 checks the tax base against the closed form (one tax line; the receipt sums to P(1 + τ)). F15 and F16 point to
  the scenario page's tests for beer substitution and per-gallon excise and assert this page says it leaves both out.
  E04 reads the page's copy for quality claims; E08 checks that every measure keeps its own year and population.
  Also covered: the devplan's adversarial cases (a grocer earning nothing shown as feasible, revenue up while a
  program falls, stale law, malformed links, zero and negative inputs); agreement with the purchase-flow engine and
  the designs report; conservation; the free-lunch comparator and the USBE agreement bound; the contrary-evidence
  list. E04 and F04 were proven red by breaking the code and then restored.
- `tests/test_public_funding.py` (6): the generated file matches the pinned raw files; amounts read as printed; a quote
  missing from the saved text fails; the DABS figures and conflicts come from the curated transcription; a duplicated
  charge fails the page 30 reconciliation while rounding does not; the FY2025 law versions cover the whole fiscal year.
- `scripts/public_funding_audit.py` writes `qa/provenance-audit.md` (every cited asset's pin, URL and file hash) and
  `qa/independent-comparison.md`; it exits non-zero on any provenance problem, which was shown by feeding it a
  corrupted pin.
- `web/src/lib/pageWording.test.ts` covers the page and the adapter (no "discount" wording).

## 4. Limits

Not a forecast or a fiscal note; nothing estimates how many shoppers would move. Spending per pupil is an input, not a
result, and is not adjusted for cost differences; NAEP comparisons do not show what an added dollar would do. Statewide
alcohol money is not assigned to any district. Legal readings are machine-assisted and not reviewed by an attorney.
Published findings that cut against the page, and the searches that found nothing, are on the page ("What cuts the
other way?") and in `qa/contrary-evidence.md`. Tennessee and Colorado are context only: no figure from either state
enters the ledger, and the chapter says what the comparisons cannot show (cause, what Utah would collect, how much wine
would move in Utah, drinking).
