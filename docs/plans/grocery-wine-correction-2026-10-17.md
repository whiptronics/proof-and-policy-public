# Correction milestone: Utah grocery-wine accounting, alternatives and claims (2026-10-17)

Tracked plan for the correction requested by Ethan on 2026-10-17. Scope: the Utah grocery-wine model's policy
assumptions, the conclusions drawn from it, the Tennessee wording, and the graph package in
`../../graphs and data`. Valid calculations and unfavourable findings are kept; nothing is tuned to favour reform.
Census margin-table work (uncommitted) and every human-review status stay as they are.

## What produced the exported results (recovered 2026-10-17)

- Engine: `web/src/lib/scenario.ts` (`utah-wine-scenario@1.5`, `compute`) and `web/src/lib/arrangements.ts`
  (`utah-wine-arrangements@1.1`, `compare`, `priceBuildUp`, `viabilityCase`, `solveLever`); worked inputs in
  `scenario.ts` `WORKED_PROPOSALS.compare_fy2025` read by `web/src/lib/initiatives.ts` (page `?v=initiative`).
- Python mirrors: `scripts/grocery_wine_briefing_example.py` and `scripts/grocery_wine_robustness_check.py`
  (closed forms pinned to the TypeScript values).
- Graph package: `graphs and data/scripts/utah_tests.py` swept the Python mirror's `net1`/`net2`;
  `export_tennessee.ts` ran `caseResults.ts` under a development loader (supplemental, not vitest).

## Findings and classification

| Finding | Kind |
|---|---|
| "Every tested design loses" (graph README, page, brief): false for the discount sweep, which gains below 3.9% | wording / conclusion |
| d = 0 gives +$1.77M (5¢ savings) or −$0.5M (no savings): engine correct; the claim ignored it | conditional, mislabelled |
| Sales tax (~$2.20M on the moved wine) is retained in every reference case: never a loss | wording check |
| 20% and 76.4% replacement taxes are on the sellers' price: 16.7% and 43.3% of the tax-inclusive price | denominator labelling |
| 5¢ avoidable cost is illustrative and above the 2.3¢ of lines that move with sales while stores stay open | policy assumption |
| DABS supply keeps its wholesale costs; the ledger did not show them as retained | presentation |
| Matched prices give grocers whatever the state leaves; a margin target needs a higher price: two modes, not one | policy design |
| No scenario where DABS keeps its per-bottle take; no private charge sized to a defined public take | policy design |
| U1 legend dropped the replacement-tax and savings entries; `$...$` pairs rendered as mathtext (italics, merged words) | graph defect |
| Absolute "state revenue" bars mixed cost savings into revenue | graph defect |
| Tennessee: "without buying less beer", "no substitution", "could only add tax", "trend explains two-thirds" | wording error |
| Within-range comparisons phrased like tests ("not distinguishable") | wording |
| Graph package depended on copies of the model and a loader outside the project | reproducibility |

## Steps

1. Accounting layer `web/src/lib/wineAccounting.ts` on top of `compute()` (no second engine): price stack per $1 of
   today's pre-tax state-store price; incremental ledger (DABS trading margin, state charge, state sales tax, local
   sales tax not modelled, short-run savings, conditional savings, new administration and handling costs); unaffected
   DABS business shown as unchanged; allocations and remaining state resources; reconciliation check.
2. Small engine extensions in `scenario.ts` (1.6), defaults unchanged: `handlingCost` (DABS supply) and
   `chargeInSalesTax` (whether a replacement charge enters the sales-tax base).
3. Alternatives `web/src/lib/wineAlternatives.ts`: references R1/R2 kept as they were; A (DABS keeps its per-bottle
   gross trading margin), B (adjustable discount, matched-price and retailer-margin-target modes), C (private supply with
   an explicit charge: per-gallon at the wholesaler, or retail-level ad valorem; in or out of the sales-tax base);
   short-run savings = documented variable lines; longer-run savings conditional. Demand sensitivity reuses the
   engine's price response, recapture, access and beer threshold; spirits substitution is a missing capability.
4. Tests (vitest) with small hand-computed examples; Python independent closed-form check against the export.
5. Export pipeline: `web/tsconfig.export.json` + `npm run export:grocery-wine` (TypeScript compiler, CommonJS output,
   no custom loader); `decodeMetric` moved to a pure module so the Tennessee export builds the same way.
6. Graphs: `scripts/grocery_wine_graphs.py` (matplotlib, mathtext off) from the export only; waterfall, per-alternative
   panel (consumer price, fiscal change, retailer margin, allocations), sweeps, demand sensitivity, Tennessee charts.
7. Page (`?v=initiative`), Tennessee wording (`results.md`, `caseResults.ts`, `CaseResults.tsx`), brief, appendix,
   review packet, README, handoff; old-vs-new table with the kind of each change.
8. Verification: `tsc --noEmit`, Python checks here; vitest, build and `scripts\verify.bat` on Windows (cannot run in
   the Linux workspace); visual inspection where a viewer is reachable. Local commit of this milestone only.
