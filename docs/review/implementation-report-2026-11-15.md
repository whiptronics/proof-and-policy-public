# Implementation report: November 2026 audit and improvement plan

Done by Claude (AI assistant) on 2026-11-15, after release 0.4.0, and released the same day at the maintainer's go, as 0.5.1 (0.5.0 was tagged, then superseded before its files
were attached or the site deployed; CHANGELOG). **Not reviewed by a person.** The
phase 1 audit is
[website-audit-2026-11-15.md](website-audit-2026-11-15.md).

## What changed, by phase

| Phase | Done | Not done |
|---|---|---|
| 1 Audit | Audit of the site, model, checks, repositories and disclosure against the plan. | |
| 2 Homepage | "Wine in Utah Grocery Stores" with the plan's subtitle; four question cards; the proposal, the economics, the evidence and the tradeoffs, main point first and detail in disclosures; the nationwide areas kept below as "Explore the research". Every figure is computed by the briefing's own functions. | |
| 3.1 Bottle | An interactive bottle on the briefing: landed cost in, the statute's floor ($10 + $8.85 = $18.85), DABS's observed margin ($18.94), who receives each part today and under three designs, each part labeled input, observed, statutory, assumption or policy choice; where DABS's markup went in FY2025 (cost, operating expenses, transfers, net profit). | |
| 3.2 Scenarios | The plan's A (today) is every chart's "today" column; its B (DABS wholesale) is the model's A and B designs; its C (private wholesale) is the model's C designs. **D, producer-direct, is new** (producer-direct@1.0): the private design with a charge equal to DABS's markup, with the wholesaler's margin replaced by the producer's delivery cost and any price premium over what DABS pays. Main case assumes no saving (delivery costs what a wholesaler earns). Legal notes: producers selling to grocers needs new authority (32B-11-208; 32B-4-401(2)); federal questions unresolved. | Federal permit and trade-practice rules are not in the saved sources and were not read. |
| 3.3 Sensitivity | D's grid: delivery cost 0-29.5% x producer premium 0-20%. Existing sensitivities unchanged. | Break-evens for D (it is ahead in every cell at fixed volume). |
| 4 Validation | The FY2025 income statement's three identities are checked in code and tested; unresolved cells are left unresolved. The independent Python check now recomputes D's 13 cases with the same closed form and was shown to fail on a tampered copy. New tests: bottle (8), producer-direct (5), income-statement data (1). | |
| 5 Charts | ChartFigure's notes now read "What this shows", "What it does not establish" and "Explore further" (the title says what matters); five framed charts. 5.3: DABS's FY2025 accounts from sales to net profit, under the design's change. | The map, timeline, beverages, Utah reconciliation, arrangement comparison and trend charts still lack the full frame. The palette was not re-audited for color-blind safety in this pass. |
| 6 Tennessee | Already had dates, per-adult and inflation-adjusted measures, concurrent changes, placebo dates and a descriptive caveat; added that grocery-wine licensing is not privatization. | |
| 7 Law | Per-design legal notes on the homepage (every design, DABS, private, producer-direct) and on the full analysis. | |
| 8 A11y/SEO | Static title, description, og: tags and no-script summary follow the new homepage; two British spellings fixed. Phone width (375 px) and doubled text checked on the start, briefing, full-analysis and Tennessee pages: no sideways scroll after one fix to the existing evidence key. | Per-view link previews (a shared `?v=briefing` link still previews as the homepage) and a preview image: static per-view heads need path URLs or an edge script, which is a decision for the maintainer. |
| 9 Freshness | The briefing lists how current each input is: FY2025 annual report (FY2026's not in the dataset), monthly reports July 2025-June 2026, the law date, NIAAA 2024, Census 2022, release and build. | A per-dataset freshness table for all 34 sources (the coverage page gives each dataset's period). |

## Did any published result change?

No. The 13 alternatives, the price-and-share grid and the purchase flows export byte-identical to before apart from
the commit stamp, and every pinned figure still passes. New results only: producer-direct supply (+$1.7M a year in the
main case, the same as private wholesale; +$1.0M to +$2.1M across the grid, grocery wine 21% to 72% above the state
store), and the bottle and accounts views, which rearrange figures already in the model.

## Checks

- **scripts\verify.bat** on ed37091 (Windows, 2026-11-15 20:56): all 21 steps passed. pytest 423 passed; vitest 38
  files, 483 tests; validate 0 errors and the same 2 review-status warnings (hand-entered values and intervals
  unreviewed); the independent grocery-wine check recomputed 13 alternatives, 1,248 price-and-share cells and 13
  producer-direct cases and agreed with the export; the purchase-flow check agreed on 105 scenarios. The report steps
  rewrote completeness.md, coverage-report.md, policy-coverage.md and coverage.csv from the preview build; restored,
  as the release steps say. After the last commit (ce4958e, CSS only): tsc clean, vitest 38 files / 483 tests.
- **The 13 alternatives did not move.** The grocery-wine export before and after these commits differs only in the
  commit stamp (18 files compared with the stamp masked).
- **The new check can fail.** On a copy of producer_direct.json with D's distributor margin altered, the Python check
  reported 12 mismatches; the real file passes.
- **Statement identities.** dabsAccountsBridge throws unless sales − cost of sales + other income − operating expenses
  + non-operating equals the printed net profit within $0.5k; a test proves the throw. The p.32 other-income figure
  ($6,569k against p.30's $8,237k) is left unresolved and noted on the page.
- **Browser** (scratch build of this branch with the site overlay, site check 236 files ok, served on localhost): at
  375 px with normal and doubled (200%) root text, the start, briefing, full-analysis and Tennessee pages have no
  sideways scroll with every disclosure open; the one overflow found (the evidence key, which predates this work) was
  fixed in ce4958e and re-checked.
- **Not checked:** a screen reader pass, the color-blind palette, Lighthouse scores, and the live site (nothing was
  deployed).

## Needs the maintainer

- A person's review of the new wording, charts and scenario D (none is reviewed).
- Whether to keep the "Advocacy goal" panel on the full analysis: the plan asks for neutral, evidence-driven
  analysis; the briefing already discloses that the maintainer supports grocery-store wine.
- Link previews: path URLs or an edge script, or leave as is.
- Whether producer-direct supply's federal questions should be read beyond the saved sources.
