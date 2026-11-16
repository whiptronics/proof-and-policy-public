# Website audit, 2026-11-15

Phase 1 of the November 2026 audit-and-improvement plan for proofandpolicy.us. Done by Claude (AI assistant) on the
maintainer's computer against release 0.4.0 (live since 2026-11-15, data build `public-f6566661a5dd`, law as of
2026-10-06). **Not reviewed by a person.** It records what exists and should be kept, what the numbers rest on, and
what the plan asks for that is missing, in the plan's priority order.

## What exists and is kept

- **Site:** 20 views in five groups (Overview: Start here, Utah briefing; Utah research: full analysis, revenue
  scenarios, Utah at a glance; Compare states: before & after, comparison finder, worked example; Explore data: map,
  beverages, revenue by state, explore, compare, revenue over time, policy timeline, policy matrix, officials; Methods &
  data: definitions & methods, sources, coverage, downloads). Officials is left off the website.
- **Revenue model** (all TypeScript in `web/src/lib`, one engine): `scenario.ts` (the engine), `arrangements.ts` (DABS
  wholesale, private supply with a replacement charge, earmarking), `wineAlternatives.ts` (13 named designs, fixed-volume
  first, demand cases after), `wineAccounting.ts` (one price stack per $1 of today's shelf price and an incremental
  annual ledger), `wineFlows.ts` (where grocery wine comes from), `winePriceShare.ts` (price × share grids),
  `substitution.ts`, `costEvidence.ts`, `wineMargin.ts` (the statutory markup checked against DABS's margin).
  It already keeps apart: landed (acquisition) cost; DABS's trading margin, called gross margin and never profit;
  operating expenses, split into those that move with sales (card fees, package-agency contracts, bags), conditional
  longer-run ones (staff, delivery) and fixed ones (rent, systems, depreciation, interest); the statutory school-meals
  and enforcement deposits, which are inside the margin and never subtracted twice; state sales tax, apart from the
  margin; wholesaler and grocer gross margins; new licensing and enforcement costs; local sales tax, not modeled.
- **Checks:** pytest 423; vitest 469 in 36 files; independent Python recomputations with separately written closed
  forms (`grocery_wine_alternatives_check.py`, `grocery_wine_flows_check.py`, `grocery_wine_briefing_example.py`,
  `grocery_wine_robustness_check.py`, `age_adjusted_fars_check.py`); `scripts/verify.bat` (21 steps); release
  validation (0 errors; 2 warnings that say 595 hand-entered values and 23 policy intervals are unreviewed); the
  website's `check.mjs` (234 files); `tests/test_versions.py`. `briefing.test.ts` pins every figure the briefing and the
  two-page brief state.
- **Repositories:** this working repository (local) → `scripts/export_public.py` (exclusion list and a scan for private
  text) → the public repository, tagged per release → the website, which overlays its own frame on the public tag
  pinned in `research.lock.json`; release files are GitHub release assets; a push to the website's `main` deploys.
- **Disclosure:** chart frames (title, units, settings, how to read, what it cannot show, sources, release and method
  versions, numbers as a table, PNG/SVG/CSV) on the briefing and the price × share grids; six evidence classes; the AI
  disclosure in the footer and every download; review status stated as "not reviewed by a person".
- **Tennessee 2016:** a specification committed before results; implementation date 2016-07-01 and the act that
  created the licenses; concurrent changes (the below-cost wine-pricing rule, beer in package stores, the FY2018
  account relabeling); neighbors, 17 placebo dates and sensitivity checks; descriptive, with the synthetic-control
  protocol gated and not run.
- **Legal notes per design** with citations: grocery retail needs a new license (32B-1-102, 32B-7-201/202); DABS's
  price to grocers against the 88.5% floor (32B-2-304(2)(b)); private supply needs new authority (32B-11-208,
  32B-4-401(2)); a state charge needs new taxing authority (no wine excise found; 59-15-101 is beer); sales-tax base,
  deposits on DABS's sales to grocers and local sales tax marked unresolved.
- **Search:** robots.txt allows all and names the sitemap (20 URLs); each view sets its own title, description and
  canonical from script; a `<noscript>` summary links every page.

## Numbers and reconciliation

- **DABS statements** (docs/fiscal-reconciliation.md): 7 printed-arithmetic failures across the FY2024 and FY2025
  reports and 6 cells left as unresolved conflicts (total revenue FY2022, FY2024, FY2025; other income FY2024, FY2025;
  liquor sales revenue FY2024). Nothing in the source data is corrected.
- **What the grocery-wine results depend on:** FY2025 liquor sales, gross profit and expense lines, none of which is an
  unresolved cell. The historical margin range leaves FY2024 out (its sales are unresolved). Non-operating expenses
  differ between the annual report and the audited fund statements; neither enters a result (both are fixed costs).
- **No computational error was found** in this audit: the checks above pass at 0.4.0, and the briefing's figures are
  model results pinned by tests.

## What the plan asks for that is missing (in its priority order)

1. **Neutral wording (priority 1).** 0.4.0 leads with the designs that keep state revenue whole. That is the answer to
   the plan's own question (can Utah allow grocery wine while preserving public revenue?) and stays. But a few labels
   are advocacy rather than description: "The trap to avoid", "To avoid:", "which design to avoid", "What the bill
   needs". They become descriptive ("Designs that lower state revenue", "Requirements of each design").
2. **Markup is not a tax and not profit (1).** No single place says that the 88.5% is a statutory price floor on landed
   case cost, that the margin it yields pays DABS's operating costs and the statutory deposits before anything reaches
   other funds, and that it is collected through prices, not levied as a tax. It goes with item 4.
3. **DABS's own accounts, gross to net (1, plan 5.3).** The bridge chart starts from the change; nothing shows FY2025
   liquor sales → cost of product → gross profit → operating and non-operating expenses → net profit → the deposits and
   transfers, with the printed discrepancies shown as discrepancies.
4. **Bottle-level breakdown (2, plan 3.1).** The $100 split chart shows shares of a shelf price. Missing: a bottle built
   up from its landed cost (e.g. $10 → +88.5% floor → $18.85 → sales tax), with who receives each part under each
   design and each value labeled statutory, observed or assumed.
5. **Homepage (2, plan phase 2).** The start page introduces a nationwide resource. The plan asks for "Wine in Utah
   Grocery Stores", four questions, and the sequence proposal → economics → evidence → tradeoffs → explore, with the
   nationwide areas kept below.
6. **Producer-direct supply, scenario D (3).** Not modeled. Current law: change needed (32B-11-208; 32B-4-401(2)).
   Federal permit questions are not in the saved sources and are marked unresolved, not guessed. It can be modeled as
   private supply without a wholesaler, with the producer's own delivery, receiving and administration costs as an
   illustrative input (removing the wholesaler removes its margin, not the work).
7. **Sensitivity (3).** Present: share moving, household share, additional sales from three named sources, beer
   substitution, retailer and wholesaler margins, DABS's price to grocers, the charge, avoidable costs, new costs, price
   response with two curve shapes, break-evens. Missing: the producer price and delivery cost for scenario D.
8. **Chart frames on the other charts (4).** The map, timeline, beverages, Utah reconciliation, arrangement comparison
   and trend charts lack the full frame. The plan's four headings (What this shows, What matters, What it does not
   establish, Explore further) map onto the frame's fields.
9. **Link previews (4).** Per-view titles and descriptions are set by script, so a shared `?v=briefing` link previews
   as the home page; there is no preview image. Distinct static heads need path URLs or an edge script; to decide.
10. **Data freshness (5).** DABS monthly reports end August 2026; the FY2026 annual report is not in the dataset;
    statutes are as of 2026-10-06 (the 2027 General Session starts in January 2027).

## Needs the maintainer

- A person's review of the wording, charts and results (none has been reviewed).
- The go-ahead to deploy: a push to the website's `main` publishes.
- Whether to have producer-direct supply's federal questions read beyond the saved sources.
