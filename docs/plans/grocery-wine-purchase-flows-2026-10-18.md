# Grocery-wine purchase flows: plan (2026-10-18)

Ethan's brief of 2026-10-18 (night): review and revise the grocery-wine revenue models so that they test beer, spirits,
out-of-state and additional purchases alongside moved DABS sales, show preserved-collection designs explicitly, make
channel choice and price response consistent, and regenerate every graph and dataset. Local only.

## What the review found (code at 2dd77bf)

- **Engine:** `web/src/lib/scenario.ts` (`utah-wine-scenario@1.6`). Scenario A moves household wine from state stores
  to grocers at fixed volume. Scenario B adds extra wine from access, recapture and a price response, and can subtract
  beer, but only for the access wine.
- **Alternatives:** `web/src/lib/wineAlternatives.ts` (`wine-alternatives@1.0`) is named input sets on that engine.
  `A_target` and `A_matched` (DABS keeps its margin) and `C_take` / `C_gallon` (charge equal to DABS's margin) already
  preserve the state's collection per bottle, but the presentation framed every result as "moving sales loses money".
- **Price response (the main defect):** the engine applies a market-wide elasticity (−0.46) to the grocery price as
  though all wine prices rose. It treats every bottle not bought at a grocer as leaving the market, never as bought at
  a state store instead. That is how preserved-collection designs showed −$2.0M to −$2.6M.
- **Beer substitution:** `lib/substitution.ts` (beer threshold, U8) holds pure alcohol constant. Beer price $12/gal is a
  placeholder. The beer excise $13.35/barrel is the FY2025 statutory rate (Utah Code 59-15-101, dataset policy event
  `ut_beer_tax_1335`; first noted here as unsourced, corrected 2026-10-19). Heavy beer and spirits are not modelled.
- **Evidence already in the dataset:**
  - DABS FY2026 sales and 9-litre cases by category (spirits, wine, heavy beer).
  - NIAAA 2024 Utah gallons and ABV for beer, wine and spirits.
  - Statutory markups (wine and spirits 88.5%, heavy beer 66.5%).
  - Census margins (now parsed).
- **Not available:** Utah beer prices, wine-specific DABS costs, a household share for wine or beer, any measure of
  switching, recapture or added purchases.
- **Survey:** `Under_Age_40_Wine_Behaviors.pdf` (Wine Opinions, July 2022, n = 631, U.S. ages 21–39) is in Downloads.
  Its 23% is existing overlap among beer-preferring respondents, not a switching rate.

## Plan

1. **Model:** new `web/src/lib/wineFlows.ts` (`wine-purchase-flows@1.0`).
   - **Totals and identity:** before and after totals by beverage and channel, in litres, litres of pure alcohol and
     dollars. Change = after − before. The flow decomposition by origin reconciles to the change.
   - **Arrangement terms:** read from the existing alternatives' price stacks, so the per-bottle collection is not
     re-derived.
   - **Purchase flows:**
     - Migration at parity, falling with the grocery premium under a stated convenience scenario. Declined grocery
       purchases split explicitly between staying at DABS (default), other beverage, out of state, and none.
     - Beer and spirits substitution as participation × intensity × relative purchase weight, on a stated conversion
       basis (constant pure alcohol by default).
     - Recapture and additional purchases, each with a channel split.
   - **Costs:** variable DABS store costs, handling, administration, license receipts, an explicit restructuring case.
   - **Earmarks:** reported as allocations under both readings, never added.
   - **Break-even solvers:** additional purchases, beer share, spirits share. Plus scenario grids.
2. **Tests:** focused vitest file covering every accounting risk in the brief. The existing alternatives must reproduce
   unchanged.
3. **Export:** flows outputs added to `export:grocery-wine`. The independent Python check recomputes representative
   scenarios from the exported inputs with its own closed forms.
4. **Source:** register the survey PDF (pinned, not redistributed). Cite the 23% only as overlap.
5. **Presentation:** qualify the old price-response results as exploratory. Revise dashboard text, the appendix, the
   deck and the summaries. Remove universal claims.
6. **Bundle:**
   - Archive the current package with a date.
   - Regenerate everything from local data: dataset export, dashboard data, grocery-wine, Tennessee, all graphs, new
     flow graphs, deck.
   - Add a manifest, data dictionary, source and assumption register, change log, README and provenance.

## Status (2026-10-19)

Steps 1 to 6 done; see docs/progress.md, entry of 2026-10-19, and CHANGELOG.md. Not done: `brief.pdf` (reportlab is not
installed here) and compiling the deck (no TeX here).
