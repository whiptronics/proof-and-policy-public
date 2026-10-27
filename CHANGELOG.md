# Changelog

## 0.3.1: corrections from the public-release audit (2026-10-27)

An AI-assisted audit of the live site and both repositories (report: docs/review/public-release-audit-2026-10-27.md).
No model, input or headline figure changed: the worked example is still −$12,105,858 (private, 20% tax) and
−$7,315,464 (DABS, 20% discount) a year, recomputed by hand from the DABS FY2025 report and the statutes. Prepared by
Claude; not reviewed by a person.

- **AI disclosure** (`web/src/lib/disclosure.ts`): on Definitions & methods (fuller), on printed pages, in every
  download's README, in the website footer and in this README.
- **Map hung on measures missing from the build.** Choosing either CDC Chronic Disease Indicators measure (left out of
  the public build) left the map on "Loading" for good. The map now checks the build first and lists only measures
  the build holds; Utah at a glance does the same; Start here no longer advertises liver-disease deaths.
- **Grocery-wine page.** The worked example's last row is "Net change for the state (revenue change, plus store
  costs avoided, less new costs)": it was labelled a change in revenue while the revenue row above it falls by more
  ($13.9M and $9.1M) because the net adds the assumed avoided costs. The findings say "leave the state worse off" for
  the same reason. Three references to the unpublished graph package now point to this page or the public export.
- **Tennessee worked example.** The wine-tax account's averages in "Revenue" are constant 2024 dollars and now say so
  (the panel above shows the same window in nominal dollars, $12.6M against $16.9M). An incomplete window prints "not
  computed" instead of "undefined".
- **Wording that contradicted other pages.** Definitions & methods said no similarity score is computed (the
  comparison finder computes one). Utah at a glance called its finder run "default settings" while leaving no state
  out for its grocery-wine law (the finder's default does, which is why the finder ranks 48 states and Utah at a glance
  50). Ranks are "among states and DC". The Sources table counted the U.S. total and Census regions as jurisdictions
  ("52 jurisdictions"); it now says "50 states and DC, the U.S. total".
- **Scenario tool.** A fall in purchases larger than a channel sells (negative grocery or state-store purchases) is
  rejected; a DABS discount above the gross margin (selling below cost) is computed but flagged.
- **Dead link.** TTB moved its list of state alcohol authorities; the `state_alcohol_law` landing page is updated.
- README: Utah at a glance shows 11 measures in the public build (13 with CDC CDI); review status worded plainly.

## 0.3.0: first public release as Proof & Policy (2026-10-26)

The project is published under the name **Proof & Policy**: this repository (code, curated data, documentation and
the local research dashboard) at github.com/whiptronics/proof-and-policy-public, and a hosted copy of the dashboard at
proofandpolicy.us. Everything in the nationwide-expansion entry below is included. Prepared by Claude; not reviewed
by a person.

- **Public build** `config/builds/public.yaml`: the preview build without CDC Chronic Disease Indicators, whose ODbL
  licence gate is still open (DATA_LICENSE.md). Chronic liver disease mortality is therefore absent from the release
  and the website; local builds with `preview.yaml` still have it.
- **Dashboard framing** (`web/src/App.tsx`): optional title, introduction, hidden views and footer, so a host can
  embed the dashboard without changing its views. The defaults are the local dashboard as before, renamed
  "Proof & Policy research dashboard".
- **Left out of the public repository**: the maintainer's private working log, a draft email and a two-page brief
  prepared privately for one reader, with its review packet. The technical appendix stays, with references to that
  correspondence removed; no figure or method changed.
- No model, input or result changed. Versions: Python package and dashboard 0.3.0.

## Nationwide expansion (2026-10-07 to 2026-10-19; released in 0.3.0)

The project is broadening from the Utah and Tennessee questions into a nationwide resource, and from there
toward a policy simulator (milestones in docs/plans/nationwide-expansion.md). Tennessee stays as a worked
example. Not published.

- **Grocery-wine purchase flows and corrected conclusions** (2026-10-19; by Claude, not reviewed by a person; run on
  Ethan's PC only; nothing pushed or sent). Technical appendix, section "Purchase flows".
  - `web/src/lib/wineFlows.ts` (`wine-purchase-flows@1.0`):
    - **Five sources of grocery wine**, kept apart: wine households already buy at DABS, beer, spirits, wine now bought
      outside Utah, and additional wine. Each of the last four has a channel split, so it can also be bought at DABS.
    - **Before-and-after totals** by beverage and channel, in dollars, litres and pure alcohol. A decomposition by
      source must add back to the change. School and enforcement deposits are allocations under two readings, never
      added.
    - **Preserved-collection designs**, labelled as proposed designs. Their per-bottle terms are read from the
      alternatives' price stacks.
    - **Channel choice:** fewer shoppers move as the grocery premium rises (a straight line). Declined purchases stay
      at DABS unless a scenario says otherwise.
    - **Substitution** as participation × intensity × purchase weight, on a pure-alcohol, volume or spending basis.
    - **Costs:** variable store costs, handling, administration, license receipts, and a restructuring case.
    - **Break-even solvers.**
  - **Price response is now exploratory:** the old market-wide price response is the "migrant_response" case. Its
    results still reproduce the alternatives' price_constant case exactly.
  - `web/src/lib/wineFlowScenarios.ts`:
    - 21 named scenarios: accounting, channel choice, illustrative, exploratory and cost cases.
    - Substitution, price × channel-choice and migration grids.
    - Break-even tables and frontiers (migration; the state's collection per bottle).
    - A one-at-a-time sensitivity table.
  - **Export:** 15 `flows_*` files in `export:grocery-wine`, plus `export_files.json` (what the run wrote).
  - **Independent check:** `scripts/grocery_wine_flows_check.py` recomputes every scenario, grid point, break-even
    (from its own linear solution) and sensitivity row with separate closed forms. It is in `verify.bat` and
    `verify.sh` (now 21 steps).
  - **Graphs:** F1–F11 (`scripts/grocery_wine_flow_graphs.py`).
    - Every chart now also writes the exact values it drew (`graphs/<chart>.csv`, read back from the figure).
    - The package gets `manifest.json`/`.csv`; `scripts/grocery_wine_bundle_docs.py` writes the data dictionary, the
      source and assumption register, and the regenerated-dataset list.
  - **Wording:**
    - U3, U6 and U12 are labelled exploratory. The S0 and U8 subtitles are qualified.
    - Universal claims are forbidden by `check_titles` ("necessarily costs", "only pays for itself", "no option that
      preserves").
    - `brief.md`, the technical appendix, the dashboard (`?v=initiative`: new section "Where grocery wine would come
      from"; the price response relabelled) and the deck are revised.
  - **Evidence:**
    - The beer excise ($13.35 a barrel) was described as unsourced. It is the FY2025 rate in Utah Code 59-15-101 (policy
      event `ut_beer_tax_1335`), which also covers heavy beer.
    - The Wine Opinions under-40 survey is registered as a source lead and cited for overlap only (23%).
    - Four evidence gaps were added (substitution, channel choice, beer market, DABS wine costs).
  - **Results (30% moving, FY2025):**
    - Preserved designs: +$0.5M to +$1.7M. 20% DABS discount: −$8.6M. 20% private tax: −$13.3M.
    - Break-even, 20% discount: 6.1% of households' beer, 29.2% of their spirits, or 17.6% more wine.
    - Break-even, 20% tax: 15.3% of beer, none from spirits (replacing spirits lowers receipts), or 40.9% more wine.
    - No Utah evidence gives any of these shares: the overall result is inconclusive.
  - **Checks:**
    - 38 new vitest tests and 6 new pytest tests.
    - Mutations caught: four model mutations in both the tests and the Python check, one data-guard mutation, one
      check mutation, and three deck mutations.
    - `brief.pdf` was not rerendered (reportlab is not installed here).

- **Census national gross margins in the dataset** (2026-10-18; by Claude, not reviewed by a person; on Ethan's PC).
  - Source `census_trade_margins`: the Annual Retail Trade Survey's gross margin as a percent of sales (2022
    benchmarked, `gmper.xlsx`) and the Annual Wholesale Trade Survey's table 4 (2022 revised), saved 2026-10-15 and
    pinned. New adapter `census_trade_margins.py` parses eight rows by NAICS code, each checked against its label:
    retail total, 445, 4451, 4453, 452311; merchant-wholesale total, 4244, 4248. 243 `nation:us` observations,
    1992/1993-2022, with cell references; "S" suppressed, the 1992 "x" unavailable, never zero.
  - The grocery-wine comparison's 28.0% grocer and 29.5% wholesaler references are now these records (cells C16, E73),
    held there by a test; wording that said "read online, not saved" was corrected on the scenario page, in the
    review packet and in the research queue.
  - Checks: 6 tests, 5 adapter mutations caught, build 0 quarantined, release validation 0 errors.

- **Grocery price × grocery share for the grocery-wine arrangements** (2026-10-18; by Claude, not reviewed by a person;
  run on Ethan's PC only). Technical appendix, section "Grocery price and grocery share".
  - `web/src/lib/winePriceShare.ts` (`wine-price-share@1.0`): four arrangements on a grid of grocery price premiums
    (0–60%, consumer price with state sales tax) and shares of covered household purchases moving (0–50% of
    $151,454,746), with and without the 2.28¢ savings, at fixed volume and with the conditional price response
    (1,248 cells). It runs the existing engine through shared helpers added to `wineAlternatives.ts` (`evaluateFixed`,
    `priceResponse`, a `priceRatio` override); the existing export is unchanged apart from its timestamp and commit.
    Break-even shares, the premiums that keep receipts whole at 30%, the grocer's margin at each price, below-cost and
    28%-reference markers, and the six named alternatives placed on their grids (all reproduced exactly).
  - Exported as `price_share.json` and seven `price_share_*.csv` files; recomputed cell by cell by
    `scripts/grocery_wine_alternatives_check.py`; shown on `?v=initiative` (views/PriceShareSection.tsx) and drawn as
    graphs U9–U13, now with a PDF beside every PNG and a `provenance.json` per package.
  - Results at 30% moving: only DABS supplying at today's price and the 45.4% charge keep receipts whole anywhere; the
    first only with the grocer at or near cost at low premiums; with the price response DABS at today's price is whole
    only up to a 6.5% premium and the 45.4% charge only from 89.1%.
  - Checks: 22 tests in winePriceShare.test.ts; 11 code mutations (10 caught; the 11th is equivalent: below cost
    together always implies the grocer below cost) and 8 corrupted export copies (all caught by the independent check);
    the page at 1300 and 375 px in both colour schemes and in print (headless Edge on the PC).
  - `scripts/verify.bat` and `verify.sh` write one log per run plus a latest-run copy, and run both exports and the
    independent check (20 steps).

- **Grocery-wine comparison: household purchases only, matched prices with sellers' margins, two guarantees; a
  DABS records request drafted** (2026-10-15; by Claude, not reviewed by a person). Audit section 11.
  - Only household purchases move (`utah-wine-scenario@1.5`, `hh=`): DABS's FY2025 report (p. 18, a chart) puts
    off-premise sales at 82% of all its sales; transcribed (`ut_dabs_off_premise_sales_share`,
    `ut_dabs_on_premise_sales_share`; 2 manual observations, 2 measures) and used for wine as an assumption, ±15 points.
    A blank household share now takes it, so analyses saved earlier restore with less wine moving.
  - `utah-wine-arrangements@1.1`: matched consumer prices as the reference case (`pc=matched`); "Can sellers live with
    it?" shows what wholesalers and grocers keep after the wine and the tax, at the entered lever and at the state's
    break-even, and the shelf price at which the state breaks even and sellers earn the margins entered (`gw=`, `gg=`;
    the worked example assumes Census's 2022 national averages, 29.5% and 28.0%, read online and not saved). The
    entered grocery price is the alternative; the return-to-state-stores reading is labelled exploratory.
  - Arrangement 3's guarantee is two proposals, fixed (set once) and proportional (on sales actually lost), both shown in
    every case including the exploratory return case; `er=today` reads as fixed.
  - Wording: "FY2023 settled" became "first-published figures largely agree; later restatement remains unexplained".
  - Draft request C to DABS (docs/gaps/utah-missing-records.md; not sent): the figures behind the on-/off-premise chart
    and wine sales by customer type; the FY2023 restatement and the FY2024 difference.
  - Results (FY2025 worked example, matched prices): arrangement 1 −$12,105,858, arrangement 2 −$7,315,464; at the
    state's break-even, sellers keep 3.9 cents a dollar in either; both hold only at a shelf price 45% (arrangement 1)
    or 31% (arrangement 2) above the state store's. The earlier worked proposal (DABS as wholesaler) is now −$7,315,464
    (was −$8,811,541) because only household purchases move.
  - Checks (Linux, in the cloud workspace): build (220,113 observations), `validate --profile release` 0 errors and 2
    warnings (595 hand-entered values and 23 intervals await review), reports, exports, `pytest` 404 passed, ruff, `npm
    test` 301 passed, `npm run build`, headless Chromium at 1300 and 390 px and in print. No Windows run.

- **The grocery-wine comparison audited and corrected; FY2022-FY2023 documents saved; FY2023's first printing largely agrees** (2026-10-14,
  night, later; by Claude, not reviewed by a person). Audit: docs/review/grocery-wine-model-audit.md.
  - Saved through the desktop app's browser (bytes checked against what the sites served) and pinned: DABS's 87th and
    88th annual reports and the State of Utah ACFRs for FY2022 and FY2023 (`utah_dabs_annual_report_fy2022`, `_fy2023`,
    `utah_acfr_fy2022`, `_fy2023`). 110 manual observations (`extracted_unreviewed`), five new measures
    (`ut_abs_fund_income_before_transfers`; DABS card fees, delivery, agency contracts, bags). All six online readings
    checked; none is left unchecked.
  - FY2023 as first printed largely agrees with DABS (523,992; within $1.0 million); the FY2024 and FY2025 ACFRs restate it
    17,500 lower, unexplained. FY2024 differs in its own first printing (unresolved). `formula_change` returns the first
    printing beside the latest edition. The enforcement deposit's pass-through is supported by FY2022 and FY2024 cash
    lines (still inferred).
  - Incorrect, now fixed: arrangement 3 mixed the channel-shift and purchase-change cases (now shown in both); the
    worked example held the share moving fixed while grocery wine cost more than the same wine in state stores and read
    the price response as less drinking (now also read as a return to state stores; a price-parity case added); "nothing
    reverses the sign" was a one-at-a-time result stated as joint (narrowed; joint scenarios added).
  - Clarified: the replacement tax's base (retail level, on the price before the tax and sales tax); what the $6.5
    million guarantee is (a proposed term; it redistributes the loss); a price build-up for each arrangement (markups
    apart from margins); the avoidable cost beside DABS's own expense lines (2.3%-9.8% of sales) and its 14.9% total;
    a straight-line demand curve beside constant elasticity (scenario model 1.4); what the model does and does not
    represent, with the substitution evidence (no credible cross-price estimate; privatization studies show more of the
    newly available beverage without offsetting falls).
  - Results kept as they fall: under the worked assumptions both arrangements lower state revenue in every case and
    joint scenario shown at the entered tax and discount.
  - Checks (Linux only): `pytest` 404 passed, `vitest` 290 passed, web build, ruff, `validate --profile release` 0
    errors and 2 warnings (593 hand-entered values and 23 intervals await review). No Windows run.

- **Grocery-wine arrangements compared; the FY2023-FY2024 gap narrowed** (2026-10-14, night; by Claude, not reviewed by a person).
  - Utah revenue scenarios, section 6 (`?v=scenario&cmp=1`; `web/src/lib/arrangements.ts`, `utah-wine-arrangements@1.0`):
    three proposed arrangements on one baseline, side by side: (1) private retail with an explicit replacement tax and
    ordinary sales tax, (2) DABS as wholesaler with grocers retailing (receipts, the cost of the wine and the grocer's
    margin apart), (3) either with an explicit allocation to school meals and enforcement (the total unchanged; a
    guarantee above the proceeds shown as a funding requirement). For each: today's and the proposed state revenue,
    the margin displaced, the replacement revenue, sales tax, cost changes, the allocation, the consumer price, the
    volume bought, the break-even lever (solved with the price response when it applies; "no break-even in the
    supported range" when there is none) and the assumptions that reverse the sign. The channel shift comes first and
    each purchase change entered (price response, recapture, access) is added on its own and reconciled by channel. A
    chart moves one chosen assumption across its span. A baseline table gives each figure's source, year, units,
    coverage and standing; the audited fund's sales are a cross-check, never an input.
  - Worked comparison `compare_fy2025` (FY2025; every assumption stated). Its results are kept as they fall: under
    its assumptions both arrangements lower state revenue. Review packet: docs/review/utah-grocery-wine-comparison-packet.md
    (six source values and six readings, each with document, page and where it enters).
  - Scenario model 1.3: a replacement tax can reach the shelf price (`taxToPrice`; omitted, results are those of 1.2).
  - Bounded look at the FY2023-FY2024 gap (docs/fiscal-reconciliation.md): the two formulas of 2026-10-14 reconciled
    term by term (`fiscal_bridge.formula_change`; FY2023's $1.07 million and $16.5 million are one gap against two
    comparators); the gap is on the revenue side and in FY2024 in cash receipts too (two new manual observations,
    `ut_abs_fund_receipts_from_customers`); the FY2023 ACFR's first FY2023 figures read online (`acfr23_*` provisional
    figures: net profit, sales growth 4.08% and liquor expenses 383,789, which the later editions print 19,380 lower);
    cost corrections kept apart from revenue. Unresolved, with its residual kept. Addresses found for DABS's 87th and
    88th reports and the FY2022-FY2023 ACFRs (not downloaded).
  - Checks (Linux only): `pytest` 403 passed, `vitest` 279 passed, web build, ruff, `validate --profile release` 0
    errors and 2 warnings (483 hand-entered values and 23 intervals await review). No Windows run.

- **Seven source documents saved, checked and transcribed** (2026-10-14, evening; by Claude, not reviewed by a person).
  - Saved through the desktop app's browser on the maintainer's computer and pinned: DABC's 81st, 84th and 86th
    annual reports (FY2016, FY2019, FY2021), the State of Utah ACFRs for FY2025 and FY2024, and the Pennsylvania Auditor
    General's State Stores Fund audits for FY2025 and FY2024 (new sources `utah_acfr`, `pa_auditor_general_plcb`).
  - All 270 online readings from them were found in the saved PDFs (259 in the right row and year column, 11 by
    reading the page); none was wrong. `provisional_figures.csv` now records each check and the record that replaces
    it; the three FY2022 ACFR readings stay unchecked.
  - 252 new manual observations (`extracted_unreviewed`): the DABC five-year summaries FY2012-FY2021, the Alcoholic
    Beverage Services Fund in the two ACFRs (16 new measures `ut_abs_*`, `ut_liquor_sales_allocated_school_lunch` and
    `pa_plcb_ssf_*`), and the Pennsylvania State Stores Fund lines. The reconciliation bridge and the Utah-Pennsylvania
    comparison now read only saved records.
  - Findings: DABS's annual sales are before sales tax by its own Note B (documented). The audited fund books the
    school-meals deposit outside its sales (documented: paid out as collections, booked by the Income Tax Fund); the
    enforcement deposit is still inferred. The audited fund's operating revenue matches DABS's sales less the deposits
    plus other income within $0.9 million FY2015-FY2021 and in FY2025 but is about $16 million lower in FY2023 and
    FY2024; Census followed the audited figure only in FY2024, which is why the bridge's FY2024 residual is large
    (cause unresolved).
- **FY2024 residual on every basis; a worked grocery-wine proposal** (2026-10-14, later; `utah-wine-scenario@1.2`,
  `scenario-ranges@1.2`; by Claude, not reviewed by a person).
  - FY2024: the three figures given for the gap ($27-32 million on 2026-10-13, $7.7-12.7 million and $17.5-21.9
    million on 2026-10-14) come from one equation (DABS sales − deposits − Census receipts) with the enforcement
    deposit left out, counted twice (the five-year summary's two printed lines) or counted once (the rates in law,
    which on 578,856 equal DABS's printed combined transfer within $2 thousand). No source revision is involved.
    `fiscal_bridge.deposit_bases` computes every basis from the build; Utah at a glance shows them in the existing
    FY2024 box. Also found in DABS's own FY2024 report (pinned): its income statement prints the 583,836 sales figure
    and does not add up for FY2024 (120,756 against a printed 113,347).
  - Utah revenue scenarios: a wholesale arrangement (DABS sells to grocers at its shelf price less a discount;
    `rm=wholesale`, `dc=`), scenario A step by step (the steps add up to the net change; the school-meals and
    enforcement deposits appear only as today's allocation of the margin that moves, not as losses), the break-even
    lever for scenarios A and B (B including any price response), and the value at which each assumption would
    reverse the sign. Results for inputs saved under 1.1 are unchanged.
  - One worked proposal, opened from the scenario page: grocery wine with DABS as wholesaler at a 20% discount, 30% of
    wine moving, prices unchanged, 5% avoidable cost, $500,000 of new costs, on FY2025 DABS sales and the FY2026
    monthly wine share. Result: −$8.8 million a year (−9.2% of state revenue from wine); break-even discount 4.1%;
    no single assumption reverses the sign within its documented range. Hand-checked in tests.
  - The seven priority downloads had not arrived; no provisional figure was promoted.
- **Why Utah's liquor-sales figures differ; Utah beside Pennsylvania; verification scripts** (2026-10-14; bridge
  `utah-liquor-bridge@1.0`; schema `dashboard-export@1.6`; by Claude, not reviewed by a person).
  - **Correction.** The entry below said the gap between DABS's sales and Utah's Census receipts "is the statutory 10%
    school-meals deposit". That was too definite and incomplete: Utah law takes two percent-of-gross deposits (10% for
    school meals and 1%, 0.875% or 1.695% for the alcohol enforcement fund), the pattern is a numerical
    reconciliation, and that Census and the auditors leave the deposits out is inferred, not documented. FY2024's
    residual is $17.5 million (or $21.9 million), not "$27-32 million", once the enforcement deposit is counted.
  - Statutory deposit rates by fiscal year (`metadata/legal_history/utah_liquor_deposit_rates.csv`), each with its
    evidence: documented from the pinned 2010 S.B. 167 and 2011 S.B. 314 for FY2012; read online for the 10% through
    FY2026 and the enforcement rate for FY2013-FY2014, FY2022-FY2023 and FY2024-FY2026; inferred for FY2015-FY2021.
  - Year-by-year bridge FY2012-FY2025 (`src/alcohol_data/fiscal_bridge.py`): DABS sales, the deposits at the statutory
    rates and as DABS reported them, Census receipts (or the audited fund's sales for FY2025) and the residual. 12 of
    14 years agree within $0.15 million; FY2023 and FY2024 stay unresolved, FY2024 investigated on its own. Fixed
    earmarks are not subtracted. The Census T10 break of FY2018 stays an open question.
  - 273 figures read through a web reader from DABC's 81st, 84th and 86th annual reports, the FY2025, FY2024 and FY2022
    State of Utah ACFRs and the Pennsylvania Auditor General's FY2025 and FY2024 audits
    (`data/curated/research/provisional_figures.csv`): provisional notes with page and line, not pinned and not in the
    database; the printed subtotals are checked and every known printing difference is listed in the tests.
  - Utah at a glance: "Why Utah's liquor-sales figures differ" (`reconciliation.json`): the bridge table and residual
    chart, statements labelled documented, documented read online, reconciles numerically, inferred or unresolved (no
    scores), FY2024, the sales-tax basis by series, the deposit rates, and Utah beside Pennsylvania's State Stores Fund
    for FY2023-FY2025 with each measure marked comparable, partly or not (no single "profit" column).
  - Validation check `compare_utah_census_receipts_vs_dabs_sales` now uses the bridge on pinned years only and says
    the exclusion is inferred.
  - Utah revenue scenarios: the DABS sales label cites DABS's "Sales net of Taxes" for the annual series only (the
    monthly gross sales' tax basis stays unresolved); the results say how much of the margin that moves is the
    school-meals and enforcement deposits (no total changes). Every input assessed for a sourced default (dashboard
    README); none changed, and saved links and analysis files restore as before.
  - `scripts/verify.sh` and `scripts/verify.bat` replace the stale `..\verify-2026-10-11.bat` (outside the repository,
    missing six steps, and checking formatting on a script that was never formatted); docs/reproduction.md.
- **Utah's Census receipts against DABS; peer statements traced; download checklist** (2026-10-13, evening; by
  Claude, not reviewed by a person).
  - Validation info check `compare_utah_census_receipts_vs_dabs_sales`: Utah's Census receipts are 0.890-0.893 of
    DABS's "Revenue from Liquor Sales" in FY2020-FY2023, and the gap is the statutory 10% school-meals deposit (Utah
    Code § 32B-2-304(5)) plus about the Parents Empowered and underage drinking amounts; FY2024 leaves $27-32 million
    unexplained. Census's FY2024 figure equals the audited ACFR's fund sales to the thousand.
  - Read through a web reader, not pinned, and recorded in docs/fiscal-reconciliation.md: DABC's FY2016, FY2019 and
    FY2021 annual reports (the annual sales series is labelled "Sales net of Taxes", and Census's receipts are 0.884-0.890
    of it in FY2012-FY2019); the Pennsylvania Auditor General's audit of the State Stores Fund (FY2024 sales net of
    taxes equal Census's Pennsylvania receipts); the Idaho State Liquor Division's FY2024-FY2025 reports (Census's
    receipts are 0.79 of total sales, unexplained); the introduction of Virginia ABC's FY2025 ACFR. A lead for the
    Utah T10 break of FY2018 (the school-meals deposit) is recorded as a question for Census.
  - Research queue: new gap `gap_peer_store_finances` and leads `lead_pa_plcb_audited_statements`, `lead_va_abc_acfr`,
    `lead_id_isld_annual_reports` and `lead_or_olcc_financials`; `gap_ut_dabs_sales_basis`, `gap_stc_series_breaks`,
    `lead_ut_audited_lcf` and `lead_ut_dabs_reports_fy2012_2019` (title corrected to the 77th-88th reports,
    FY2012-FY2023) updated. docs/sources/download-checklist-2026-10-13.md lists every file to save by hand for
    milestone 2 (a), (c) and (d). No data value, scenario default or review status changed.
- **Census liquor-store receipts FY2016-FY2024 from the Individual Unit Files** (2026-10-13; parser
  `census_unit_liquor_stores` 1.0; schema `dashboard-export@1.5`; by Claude, not reviewed by a person).
  - New parser for the ten unit-file zips: both layouts (Census state codes and 14-character IDs to FY2016, FIPS
    codes and 12-character IDs from FY2017), the 50 state governments (type 0) each checked against its state's
    name in the directory, its fiscal-year end and the state-by-level file's level 2 lines (a state that fails
    is rejected whole), item flags kept, the existing measure rules (a measure only from items present; a total
    counting an absent item as zero is flagged and names it). New flags `census_expenditure_without_revenue`
    (Kentucky FY2015-FY2016) and `census_expenditure_equals_revenue` (Mississippi FY2020-FY2024). New
    comparability groups: capital outlay and total expenditure from FY2022 (no G item), and Oregon's current
    operations and total from the unit files. All ten files read with no rejection: 506 observations (build:
    219,747), sixteen state governments with receipts every year.
  - FY2015: the 2017 state-by-type release stays preferred and the 2020 unit-file release is a competing
    candidate; 33 measure cells agree and 20 differ (Alabama, Kentucky, New Hampshire, Ohio, Oregon, Virginia,
    Wyoming). Kentucky's three cells come only from the 2020 release and are preferred from it, flagged.
  - Validation: info checks `compare_census_fy2015_releases` (the 20 cells) and
    `census_unit_file_repeats_and_equal_items` (10 values repeating the previous year, 5 Mississippi years with
    current operations equal to receipts). `reconcile_census_liquor_store_files` still compares IndFin with the
    state-by-type files only.
  - Store-cost regression: `run` takes a last year and the export holds the shown estimate at FY2015
    (`DISPLAY_LAST_YEAR`; unchanged). `compare_extension` adds FY2016-FY2024 after leaving out flagged and
    carried-forward state-years and changes across a comparability group; every slope rises, none leaves the
    shown interval. Written to `cost_model.json` as `extension_check` and summarized under the scenario's cost
    evidence; not used as the estimate.
  - Dashboard: "through FY2015" texts replaced, the map no longer says "zero where the state runs no liquor
    stores" (true only of FY1972-FY2012), the measure is labelled "State liquor-store receipts (Census A90)"
    everywhere, and Compare says when the Census files cover a year but list no item for a state (no value, not
    a zero). Research gap `gap_census_liquor_store_revenue` closed; lead updated.
- **Census Individual Unit Files acquired; handoff** (2026-10-13; by Claude, not reviewed by a person).
  - Ethan saved the FY2015-FY2024 Individual Unit File zips; they were matched by contents and imported with
    `import-asset` (`census_govfin_unit_fy2015` to `_fy2024`, pinned). Not parsed: no data added.
  - Read from the files and recorded in docs/fiscal-reconciliation.md: state codes become FIPS codes in FY2017,
    the G (other capital outlay) items end in FY2022, and the FY2015 zip is a later Census release that differs
    from the loaded FY2015 file for seven states (Oregon's revenue doubles). FY2015 keeps the 2017 release
    preferred (unit FY2015 priority 15).
  - READMEs, the progress log's current state and the roadmap row updated for handoff; the next steps and the
    parser design are in docs/progress.md (2026-10-13).
- **FARS interval targets; Census acquisition checklist** (2026-10-12; schema `dashboard-export@1.4`; by Claude,
  not reviewed by a person).
  - FARS (`uncertainty@1.2`, parser 1.2): the interval for the underlying expected number uses Student's t on
    Rubin's degrees of freedom, as NHTSA does, instead of the normal z. It is at most 4.4% wider (the nation,
    2023) and 0.2% wider for the median state-year; the "about 15% narrow" figure applied only to the deaths
    that occurred, which had no interval. Those now get one from the imputation spread alone (t on 9 degrees
    of freedom): `extra.realized_total`, exported as `realized_ci_low` and `realized_ci_high`, shown in the
    record drawer and used in no comparison. Method: docs/methods/statistical-approximations.md section 2.
  - Census: the Individual Unit Files for FY2015-FY2024 are registered for manual import
    (`census_govfin_unit_fy2015` to `_fy2024`; no parser). `www2.census.gov` refuses this environment, so no
    year after FY2015 is added. The continuity checks a later year must pass first are in
    docs/fiscal-reconciliation.md. Validation now warns that these 10 assets are not acquired.
- **Statistical approximations checkpoint** (2026-10-12; schema `dashboard-export@1.3`; by Claude, not reviewed
  by a person). Methods and limits: docs/methods/statistical-approximations.md.
  - Before & after (`before-after@1.2`): published intervals become standard errors (the larger side of a
    skewed interval); a z-test of the difference in changes replaces the interval-overlap check; pooled
    comparison with leave-one-state-out results and the comparison states' own spread; log changes; errors on
    pre-period trends (three years minimum); placebo-in-time as a diagnostic. Compare tests each pair's gap.
  - Utah at a glance and the map: rank ranges that name what the intervals cover. The finder
    (`comparison-finder@1.1`): Mahalanobis distance with shrinkage, trend characteristics, match warnings.
  - FARS (`uncertainty@1.1`, parser 1.1): compound-Poisson count noise for the underlying expected number and
    Rubin's-rules imputation spread, stored apart; per-100,000 rates carry the interval; the map's jump flag
    allows for it.
  - Utah scenarios (`utah-wine-scenario@1.1`, `scenario-ranges@1.1`, `wine-margin@1.0`): price elasticity with
    pass-through, and cross-border recapture, as separate inputs; documented ranges; one-at-a-time and combined
    sensitivity scenarios with no probabilities (the library's Monte Carlo is not shown); the statutory wine
    margin offered as an assumption; optional bounds from the data.
  - Export: `cost_model.json`, an exploratory Census store-cost regression (`store-cost@1.0`), shown beside the
    avoidable-cost input and never filled in.
  - Not wired in: age standardization (`age-adjust@1.0`). Draft only: the Tennessee augmented synthetic control
    protocol; committing it is not approval to run it.
- **Officials and committees reference view** (2026-10-12; schema `dashboard-export@1.2`).
  - New source `openstates_people` (CC0 1.0; the cleaned `people-main-officials-only.zip`, pinned and kept as the source artifact). `alcohol-data officials check` reads the archive and checks record, committee and membership counts against SANITIZATION.md, ids, relationships and that no removed field returned.
  - Export writes `officials.json` and `officials/<code>.json`; the dashboard gets one view, "Officials & committees" (`?v=officials`): Utah and current-in-source by default, former officeholders kept apart, filters for jurisdiction, chamber, district, committee and a date, name search.
  - Committees carry subject relevance and documented-referral status separately (`data/curated/officials/committee_relevance.csv`, all unverified). No bills, votes, scores or outreach.
  - 22,692 records (8,438 current in the source, 13,924 former, 330 in current files with no open role), 3,042 committees, 38,864 memberships. See docs/research-dashboard/officials.md.
- **Simulator milestone 2(a): what DABS gross sales include** (2026-10-11).
  - The DABS adapter (parser version 1.1) profiles each monthly report: among products with 10 or more
    bottles, how many divide to a whole number of cents, and whether bottles agree with 9-liter cases and
    bottle size. New validation check `dabs_monthly_gross_sales_at_shelf_prices` (warn) reads the profile:
    72,650 of 82,161 product-months (88.4%) pass, so gross sales are statewide shelf prices times bottles.
  - Whether shelf prices include sales tax stays open. Evidence for and against, including the audited
    FY2025 ACFR's lower fund sales ($486.942 million against DABS's $551.346 million), is in
    docs/fiscal-reconciliation.md. New research gap `gap_ut_dabs_sales_basis`, new lead
    `lead_ut_dabs_price_lists`, `lead_ut_audited_lcf` updated, draft request 1 (e).
  - The Utah revenue scenarios label the DABS-based baseline "as DABS reports sales", treated as before
    sales tax and marked unconfirmed; the Beverages view and the measure notes say what gross sales are.
- **Simulator milestone 1: comparison framework and Utah at a glance** (2026-10-10).
  - **Utah liquor-control history.** Two new ledger claims and four intervals, verified day by day:
    the department is the only wholesaler of spirits and wine from 2003-05-05 (`ut_spirits_wholesale_state`,
    `ut_wine_wholesale_state`), and state stores plus contract package agencies are the retail channel for
    both from 2011-07-01 (`ut_spirits_retail_state_stores_and_agencies`,
    `ut_wine_retail_state_stores_and_agencies`). Utah Code 32B-2-501 (state stores) is pinned in every
    Historical Code version and rebuilt for 2011-2013 from 2010 S.B. 167. 28 evidence rows. Earlier days
    stay unknown.
  - **Peer arrangements, current law.** Baseline batch 10 (`batch_10_control_systems.yaml`, 15 snapshots):
    who wholesales and who sells spirits and wine in Virginia, Pennsylvania, Idaho and Oregon, from
    statute text. Snapshots only; no peer history yet.
  - **Liquor-control comparison** (`web/src/lib/control.ts`) in the Map, Revenue by state and the finder:
    verified on every day of the period, or "cannot be assessed" with current law shown beside it and
    never deciding it. The finder can mark candidates, leave out verified differences, or rank only
    verified matches and list the rest.
  - **Utah at a glance** (`?v=utah`): Utah's arrangement, latest values ranked only among states with a
    value for the same year, definition and form (`web/src/lib/glance.ts`), nine candidate states from the
    finder's own scoring (`rankCandidates`, moved into `web/src/lib/finder.ts`) with why, differences and
    gaps, a chart, links and two new saved starting points. Linked from Start here.
  - **Fixes found on the way:** the finder no longer offers "Use the top 4" when nothing was scored; the
    revenue table's arrangement column is compact; help text wraps at phone width with doubled text (a unit
    id made the Map scroll sideways); printed tables no longer split a row across pages.
  - **Tests:** 7 new web tests; 20 more Python test cases (277), most of them the existing interval and
    evidence checks running over the new records, plus a peer-snapshot export test and
    `test_committed_ledger_matches_the_claim_definitions` (claim code edited without regenerating the
    ledger now fails). 13 reintroduced bugs all failed.

- **Completeness audit.** `alcohol-data report completeness` writes docs/completeness.md,
  metadata/completeness.csv and metadata/series_breaks.csv. They give completeness by measure, jurisdiction, year and definition, with
  series breaks listed. `metadata/measure_concepts.csv` groups measures whose definitions changed, such as
  Tennessee account 11002: wine, then wine plus high-alcohol beer.
- **Policy catalog.** `metadata/policy_catalog.csv` and `policy_catalog_values.csv` define 28 dimensions
  across 12 domains, as the `policy_dimensions` and `policy_dimension_values` tables. Statewide permission
  is kept apart from local implementation. A new check, `policy_catalog_conformance`, enforces the catalog.
- **Dated snapshots.** The new `policy_snapshots` table holds what a source shows on one day, or in one
  year. Snapshots never become intervals and never count as verified history.
  - `scripts/policy_snapshots.py` cuts every excerpt from pinned bytes. A phrase that is not found verbatim
    stops the run.
  - `support_basis` records whether the text names the outlet type, creates a general license, or only
    implies the status.
- **Nationwide baseline**, batches 1 to 9: 163 snapshots covering 47 jurisdictions. The other 4 (AK, AL, IN,
  NJ) have source leads that need a manual download. Batch 9 adds Maryland (§ 4-205) and Oklahoma (37A O.S.
  § 2-109) from statute text, and the catalog value `chains_and_supermarkets_barred`. Finds can be anchored to one dated version of a section. The matrix is
  docs/policy-coverage.md (`alcohol-data report policy-coverage`).
- **Dashboard.** The policy timeline now takes any catalogued dimension and any jurisdiction. Snapshot-only
  states are drawn as unknown, with a dated marker.
- **Version ledger** (`alcohol_data.legal.version_ledger`) rebuilds a statute's versions for states without
  a historical code archive. It reads session-law markup in both directions and checks that every interval
  day is covered by exactly one version. It also cross-checks each rebuilt text against the next act and the
  code's history note. First use: Kentucky grocery wine and spirits, verified from 1998-07-15
  (`kentucky_legislature` source, four acts).
- **Tennessee 2016 interval** recoded from `conditional_or_special_channel` to `authorized_local_option`.
- **State liquor store finances** (expansion step 5). New source `census_govfin`: Census liquor store
  revenue (A90), total expenditure, current operations (E90) and capital outlay (F90 + G90) for every state
  government, FY1972 and FY1977-FY2012 from the keyless IndFin historical text database, and FY2008-FY2015
  from the yearly state-by-type files. Values Census leaves to a formula are computed by that formula and
  flagged `census_formula`. No profit or transfer is computed, and no retail system is read from a value.
  - New check `reconcile_census_liquor_store_files` (warning): the two files agree in all 425 shared cells.
  - New file format `zip` in the download signature check.
  - pyodbc was not needed; the FY1942-FY2008 Access database stays unread.
- **Context data, batch 1** (expansion step 6).
  - **Income:** new source `bea_regional`: BEA SAINC1 personal income and per capita personal income, U.S.,
    50 states and DC, 1929-2025 (release of 2026-09-30). Shown in the Compare view's income panel.
  - **Businesses:** new source `census_cbp`: County Business Patterns state files 2000-2023,
    establishments and employment for NAICS 445310 (beer, wine and liquor stores) and 722410 (drinking
    places), establishments for 445110 (supermarkets). Private employers only, so state-run stores are not
    counted; withheld employment is missing, never zero; the 2007 and 2017 disclosure changes are
    comparability groups. Measure ids carry the NAICS code. Shown in a new Compare panel.
- **Guided analysis tools** (Ethan's request of 2026-10-09; extends step 7).
  - **Start here** is the new first page: four questions, each opening a tool with editable inputs, plus a
    list of analyses saved in this browser.
  - **Before & after** (`?v=change`, method `before-after@1.0`): window averages, changes and percent
    changes for a state and comparison states over the same years, a descriptive difference in changes,
    pre-period trends and the difference those trends alone would give, annual and event-time charts,
    and every value considered with the reason it was or was not used. Verified dates come from the coded
    law; typed dates are labelled assumptions. Tennessee 2016 is the first example; its averages match the
    database recomputed independently.
  - **Find comparison states** (`?v=finder`, method `comparison-finder@1.0`): transparent similarity on
    chosen baseline characteristics with weights, minimum coverage and policy exclusions; missing data is
    ranked last, never counted as a match; outcomes after a change are never used. It says when no state
    is within 1 SD on a characteristic; for Utah in 2015-2019 only West Virginia is that close on adult
    drinking prevalence.
  - **Utah revenue scenarios** (`?v=scenario`, method `utah-wine-scenario@1.0`): channel shift and extra
    purchases kept apart, beer substitution on a stated basis, sourced/derived/assumed labels on every
    input, break-even values where the model has one, sensitivity, CSV and print.
  - **Saving** works the same in every tool: link, browser copy, analysis file with the build ID, method
    version and a results snapshot, results CSV, print layout, and a warning when a saved analysis was made
    with another build. Explore gained the same report panel (question, inputs, coverage, method, sources,
    limits).
  - **Tests:** 43 new web tests with hand-checkable numbers (fiscal-year boundaries, transition years,
    missing years, zero and negative bases, definition changes, incomplete comparison data, scaling,
    missing-data ranking, double counting, shifted versus new demand, three substitution bases), and a
    Python check that every measure the tools name is in the build. Eleven reintroduced bugs all failed.

- **Ethan's downloads of 2026-10-09, and nationwide comparisons** (docs/sources/downloads-2026-10-09.md).
  - **Inventory:** all 115 files listed with size, SHA-256 and outcome: 22 imported, 4 already in the
    dataset (identical bytes), 7 documentation, 1 duplicate copy, 81 not imported with the reason. The
    originals were not changed.
  - **New sources:** `utah_dabs_sales_analysis` (16 monthly reports, gross sales and 9-liter cases by
    beverage through `metadata/dabs_class_beverage_map.csv`; each report must add up to its printed totals;
    fiscal-year sums only for complete years, so FY2026); `cdc_cdi` (liver-disease mortality 2019-2022,
    age-adjusted binge drinking, binge frequency and intensity, YRBS 2019-2023; ODbL, so a new `release_gate`
    makes `alcohol-data package` refuse a release containing it); `census_msrs` (monthly state retail
    sales changes, 2019-2026); `census_economic_census` (NAICS 445310 establishments and sales, 2012 and
    2017); BEA SAPCE3 line 28 in `bea_regional` (residents' take-home alcohol spending, 1997-2025);
    `utah_tax_commission` (state sales tax rate, 4.85%, from a draft publication); `us_atlas` (state
    outlines for the map). Derived FARS deaths per 100,000 residents.
  - **Checks:** five new reconciliations (CDI against BRFSS and NIAAA, the two Economic Census files, DABS
    groups against printed totals, BEA states against the U.S.). CDI copies of other publishers' series are
    staged only where they carry a value, so they never displace or break the original series.
  - **Dashboard:** three new views. **Map** (`?v=map`): any of 14 measures (four beverages for alcohol sold) for every state, by year or
    month and beverage, as published, per resident, per resident 21+, in constant dollars or as a change
    since a chosen year; a ranked bar list and table from the same rows; missing, suppressed and zero drawn
    apart; one scale across periods with extremes trimmed and disclosed; a † on change maps where a series
    jumps 50% or more in one year; state details with trend, sources and links into the tools; CSV, PNG and
    print. **Beer, wine & spirits** (`?v=beverages`). **Revenue by state** (`?v=fiscal`). New export files
    `monthly.json`, `monthly/*.json` and `map.json`, and coverage code W (suppressed by the source). The
    scenario tool offers the sourced sales tax rate; outcome lists and the finder gained the new measures.
  - **Tests:** adapter tests for every new source, the fiscal-year and per-100,000 derivations, the map
    outline decoder, the release gate, the monthly and map exports, and web tests for the map scale, ranks,
    jumps, shares and same-month changes. 26 reintroduced bugs all failed.
  - **Sources on every chart** (Ethan: "make sure to include the sources"): a "Sources:" line under each
    chart and table of the three new views, worked out from what is drawn, including the inputs of derived
    values and the population or price series behind per-person and constant-dollar forms; the same line
    heads every CSV and is printed under the map image with its legend. The map image had lost its in-state
    labels (the label halo was copied without its paint order) and had no legend; both fixed.

- **Explore, policy matrix and saved analyses** (expansion step 7).
  - **Explore view:** any of the 85 metrics (up to four), any jurisdictions (up to six), any years, shown as
    published, in constant dollars, per resident, per resident 21+ or as an index. One chart per measure,
    a values table, a CSV bundle, and a chosen policy shown underneath as its verified status by calendar
    year. Charts mark only a verified change from one value to another, never the first verified day.
  - **Policy matrix view:** 51 jurisdictions against every coded dimension, either as verified status on one
    day or as the latest dated snapshot per cell with its own date. Where verified history covers a
    snapshot's day, the cell says whether they agree (no snapshot in this build falls on a verified day).
    CSV download.
  - **Saved analyses:** worked-example panels open in Explore with the same measures, states, years and
    conversion (one shared specification); four starting points in `config/dashboard/analyses/`, checked by
    the export, which refuses a `shows` list; selections can be saved in the browser or as a JSON file.
    New export file `analyses.json` (schema `dashboard-export@1.1`).
  - **Worked example:** its comparison-state reasons said "Grocery-wine law not coded"; Virginia and Kentucky
    are now verified for every day of 2011-2021, Arkansas on one day and Georgia on none. The sentences
    say so, and five new checked claims (`policy_constant`, `policy_known_days`) hold them.
  - **Fixed:** since step 5, Census liquor store rows exist for every state (often zero), so Compare called
    every state's T10 "limited" because "the dataset holds state liquor-store accounts", California's
    included. It now reads the year's Census value: revenue reported, none reported, or not in the
    dataset. Compare also shows Census liquor store revenue in its fiscal panel.
  - **Fixed:** point-in-time measures were labelled "July 1 estimate", wrong for CBP employment (pay period
    including March 12). Two pages scrolled sideways at 200% text on a phone (the worked example and
    Definitions); both wrap now, and every view was swept at 375 px with normal and doubled text.

- **Context data, batch 2** (expansion step 6).
  - **Youth drinking:** new source `cdc_yrbs`: YRBS high school current alcohol use and first drink before
    13, 1991-2017, and binge drinking (2017 definition), state and national, with confidence limits.
  - **Traffic safety:** new source `nhtsa_fars`: FARS traffic deaths and alcohol-impaired-driving deaths
    (driver BAC .08+, NHTSA's ten imputations averaged), 2000-2023, plus NHTSA's published state table.
    New check `reconcile_fars_vs_nhtsa_state_table`: the 2013 final file reproduces NHTSA's table exactly.
  - **Acquisition:** normalizer `unwrap_multipart_pdf` (crashstats serves PDFs in a multipart envelope);
    unwrapping normalizers run before the file-type check.
  - **Dashboard:** coverage families "Traffic safety" and "Context (prices, income, businesses)" (BEA and
    CBP had been listed under "Prices"); Compare panels for youth drinking and traffic deaths.
  - **Not used:** CDC Chronic Disease Indicators, licensed ODbL (an owner decision; see the lead).
- **History since 2000, batch 2** (expansion step 4).
  - **Virginia grocery wine** is verified for every day from 1997-07-01: under the general retail
    off-premises wine and beer license of `§ 4.1-209` to 2021-06-30 (eligibility inferred; no outlet type
    named), then under `§ 4.1-206.3` C 1, which names grocery stores. 55 Acts of Assembly chapters
    (source `virginia_legislature`) and two Internet Archive copies of official code pages
    (`virginia_archived_code_pages`).
  - **Version ledger:** a new markup convention, `va_lis_html_italic_strike`, reads HTML chapters (`<i>`
    insertions, `<s>` deletions); plain HTML pages are read without tags; a cross-check row may be undated,
    a value version may not.
  - **Arkansas:** the grocery store wine permit (Act 508 of 2017) is anchored on 2017-10-01 (source
    `arkansas_legislature`); later days are not yet verified.
  - **Georgia and Tennessee after 2016:** recorded as leads with the manual steps (no free route for
    Georgia; the Tennessee Secretary of State host still answers 403).
  - **Reproducibility:** new normalizer `strip_lis_page_variants` for Virginia Law Library pages, whose
    request date and footer vary between requests; the two Virginia code-page pins were moved to the
    normalized form of the same bytes.

## Research dashboard (unreleased; branch `research-dashboard`, 2026-10-07)

A local, read-only research dashboard and the data it needed. Not published.

- **Dashboard.** `web/` (Vite, React, TypeScript, Recharts; npm with a lockfile) has five views:
  - Coverage: a jurisdiction-by-year matrix with explicit states and family counts with denominators, plus a
    research queue;
  - Policy timeline: verified day runs only, with snapshots, ledger status and evidence;
  - Compare: state-level comparisons with an availability table that says why each comparison holds, is
    limited, or is disabled;
  - Revenue: separate fiscal components, conversions only where their inputs exist, policy markers and
    transition periods;
  - Sources: held files and leads not held.

  It also has a worked example, a definitions page and filtered CSV bundles with a README.
  See `docs/research-dashboard/README.md`.
- **Export.** `alcohol-data dashboard export` writes deterministic JSON from the built database and the
  curated registers to `web/public/data/` (git-ignored). Constant-dollar and per-person conversions are
  computed in Python with the canonical conventions and carry their input IDs. A test pins them to the
  canonical T10 derivations.
- **New curated registers** (`data/curated/research/`):
  - research gaps, in queue order;
  - source leads not held, with what was tried;
  - policy snapshots (the 1992 volume, never stretched into an interval);
  - operational-date overlay.
- **Tennessee Department of Revenue collections** (new source `tennessee_dor_collections`).
  - June editions FY2010-FY2025, parsed from the fiscal-year-to-date page by `adapters/tn_dor_collections.py`.
    Every ALCOHOLIC BEVERAGES class must add up to its printed TOTAL.
  - Five new measures: wine tax (account 11002 while printed "Wine Tax", FY2010-FY2017), account 11002 as
    "Wine Tax & High Alcohol Beer" (FY2018 on, not wine-only), the winery wine tax, the wine enforcement tax,
    and the class total.
  - 64 observations.
- **Utah Digests of Legislation 2001 and 2002** registered and pinned. They are not parsed and extend
  nothing.
- **Worked example: Tennessee 2016 food-store wine** (`config/dashboard/cases/`). Selection and exclusions
  (Pennsylvania 2016, Colorado 2023) are in `docs/research-dashboard/case-study-selection.md`. Every
  descriptive sentence is tied to a claim that the test suite re-checks against the database.
- 176 Python tests and 27 web tests.

## 0.2.0-preview (unreleased; local build 2026-10-07)

Utah legal history extended before 2014 (source-expansion plan, packages 1-6). Not published.

- Title 32A code pages: the Legislature's own section pages as captured by the Internet Archive
  (2008-07-10, 2010-07-29) are pinned for the eight predecessors. Every Title 32A text rebuilt from session
  laws matches them on the capture date (now `reconciled`), and they supply 32A-12-202 and 32A-3-104, which
  no bill printed. The grocery-wine and package-agency intervals now start 2003-05-05; new Title 32A
  dependency and exception rows.
- Review packet (`docs/review/utah-policy-review-packet.md`) and Utah source catalog
  (`docs/sources/utah-historical-source-catalog.md`), generated by `alcohol-data legal review-packet-utah`
  and shipped in the release docs with the missing-records list.

- Utah source expansion, package 4 (Title 32A). The Legislature's 2010 recodification table is pinned and
  parsed into a provision crosswalk (`utah_title32a_crosswalk.csv`, 414 mappings, all
  `finding_aid_unreviewed`). The 12 bills of 2003-2009 that amended the tracked sections' Title 32A
  predecessors are pinned, and those sections are rebuilt to their 2011-07-01 repeal. Reconstruction now
  treats a session's bills as amending the session-start text, handles subsection-level split effective
  dates, adopts the next official print (as reconstructed) where same-session bills conflict without a
  coordination clause, archives text that never operated, and records before-text differences that change
  no check. New `CHECKS_32A` and `CLAIMS_32A`; claims are verified under whichever title is in force. The
  beer-definition ceiling and the corroborating supply-chain claim are verified from 2003-05-05. The
  grocery-wine and package-agency claims stay unverified before 2011-07-01: no available record prints
  32A-12-202 or 32A-3-104 (added to `docs/gaps/utah-missing-records.md`).
- Utah source expansion, package 5 (beer tax). The session inventory now runs from 2002 S4 to 2013 S2:
  33 sessions, Digests 2003-2014 against the passed-bill indexes. The parser reads the pre-2010 layouts:
  year-less special-session headers, descriptions on the title line, chapter-only lines, glued bill
  numbers, the older "This act affects sections" header and "Chapters N, Laws of Utah YYYY" histories,
  and page markers inside bill text. 2003 S.B. 66 (ch. 307, effective 2003-05-05) is pinned. 59-15-101 is
  rebuilt from it and matches 2010 S.B. 167's print word for word. Beer tax verified from 2003-05-05: new
  interval `ut_beer_tax_1100` ($11, known from 2003-05-05, ended 2003-07-01). `ut_beer_tax_1280` now
  starts 2003-07-01. New claim `ut_beer_tax_2003_schedule` and checks `beer_tax_rate_before_2003_07_01`
  and `beer_tax_flat_rate`. The 1992 annotated Title 59 volume is registered for manual import (automated
  download refused). Records needed for earlier years and draft requests (unsent) are in
  `docs/gaps/utah-missing-records.md`.
- Utah source expansion, packages 2 and 3 (2011-07-01 to 2013-12-31). 2010 S.B. 167 (Laws of Utah 2010
  ch. 276) pinned with its effective-date clause (Title 32B takes effect 2011-07-01). Every 2010-2013
  general and special session is inventoried from the Digests of Legislation and cross-checked against
  the passed-bill indexes; three bills the 2014 digest omits were read from their enrolled text. Five bills
  changed a tracked section. The text in force is reconstructed from the enrolled bills' insertions and
  struck deletions. Pre-commencement amendments are applied before the first operative day. Same-day
  amendments are merged without ordering by bill number: definition by definition with numbering set
  aside where both bills renumber. Each state is checked against the next official print and the
  2014-01-01 code. New `utah_session_laws` source (23 files),
  `metadata/legal_history/utah_session_inventory.csv`, `utah_enactments.csv`,
  `utah_reconstructed_versions.csv`; `legal ledger-utah` writes them and splits claim runs by temporal
  status. Utah grocery-wine, package-agency, beer-ceiling and beer-tax intervals now start 2011-07-01
  (FY2012-FY2014 fully known). pypdf is now a runtime dependency (digest text).
- Utah source expansion, package 1 (audit). Grocery-wine claim narrowed to the ordinary off-premise retail
  authorization (`ordinary_grocery_wine_authorization`: not_authorized / conditional_or_special_channel); its
  indispensable dependencies are 32B-1-102, 32B-7-201 and 32B-4-402, with supply-chain provisions demoted to
  corroboration. Package agencies (32B-2-601, -603) coded as a separate special channel. New curated
  claim_dependencies and claim_exceptions registers. Policy `review_status` replaced by independent
  extraction, temporal, legal-review and claim status fields; validation rejects AI or machine entries
  recorded as human review. Explicit `as_of_date` (2026-10-06, America/Denver); exposure rows gain
  `future_days` and min/max bounds; new `policy_segments` table keeps known, unknown and disputed runs.
  Schema 1.1.0.
- Utah legal history: every Historical Code version since 2014-01-01 of six sections is pinned and checked
  (`alcohol-data legal discover-utah`, `legal ledger-utah`); Utah grocery-wine, beer-ceiling and beer-tax
  intervals are now verified day by day from 2014-01-01 (previously from 2019 or 2026). A test keeps curated
  intervals inside the verified days.
- Corrected Utah grocery-wine evidence: 32B-4-401(1) binds on-premise retail licensees, not grocery stores;
  replaced by the liquor supply-chain provisions (32B-4-401(2), 32B-11-208, 32B-11-608) and 32B-4-402.
- Tennessee 2014 Public Chapter 554 imported (manual download) and all Tennessee intervals recoded from the
  enacted text: food-store wine barred from signing (2014-03-20) until 2016-07-01, then by local option;
  added package-store beer sales (2014-07-01) and the Unfair Wine Sales Law (2016-07-01) as concurrent
  changes. 12 intervals, 31 evidence rows.
- `import-asset` refuses a file whose hash differs from an existing pin unless `--update-pin` is given.
- Pinned, unparsed documents absent from the local cache are recorded `pinned_not_local`.
- New test checks policy evidence excerpts against the pinned documents when present.

## 0.1.0-preview (unreleased; local build 2026-10-06)

First research preview.

- Acquisition with per-host rate limits, retries, format checks, SHA-256 pins, offline mode and manual
  import; OS trust store for TLS.
- Adapters: Census population estimates (four series), NIAAA apparent consumption (reports #124 and #122),
  CDC BRFSS prevalence (1995-2025, alcohol class), Census State Government Tax Collections (historical
  database and FY2023-FY2025 flat files), BLS CPI-U.
- Hand-transcribed Utah DABS financial summaries (FY2020-FY2025), unreviewed.
- Ten policy intervals for Utah and Tennessee with evidence; exposure by calendar and state fiscal year.
- Canonical DuckDB schema, preferred-value selection with every candidate kept, derived per capita and
  constant-dollar tax measures, lineage, coverage, validation (release gates and reconciliations),
  deterministic CSV/Parquet/DuckDB exports, release packaging.
