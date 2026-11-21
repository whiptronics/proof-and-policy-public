# Verification report: development plan of 2026-11-19

Branch `devplan/2026-11-19` of this repository (local, not pushed, not released), on top of 646c8c6, and branch
`devplan/2026-11-19` of the website repository on top of 230a591 (local, not pushed). Prepared by Claude under the
maintainer's direction; **not reviewed by a person**. Agreement between scripts is arithmetic verification, never
human verification, and nothing here changes any value's review status.

## What was run

| Check | Result |
|---|---|
| `scripts/verify.bat`, 22 steps (log `verify-windows-20261120-092955-16097.log`) | all 22 steps exit 0: validate 0 errors and the usual 2 warnings; pytest 423 passed; ruff clean; vitest 42 files, 529 tests; build; both exports; the three independent checks agree. The five reports the report steps regenerate (a preview build's stamps and release-gated rows) were restored |
| `npx tsc --noEmit` in `web/` | clean |
| `npx vitest run` | 42 files, 529 tests pass, again after the two edits made after the verify run (below) |
| `npm run build` | passes |
| `scripts/policy_designs_check.py` (independent Python closed forms over `policy_designs.json`) | 597 checks, 0 failed |
| Generated documents (`frameworkDocs.test.ts`, `legislativeBrief.test.ts`) | every committed copy equals what the model renders |
| Legislative briefing PDF (pypdf page count; read page by page) | exactly 2 pages, Letter; no missing values |
| Hand recomputation of the headline | B: 0.0485 × 0.3889 × $45.44M − $0.50M = +$0.36M; at the 60% limit the share is 30% × (1 − 0.3889/0.6) = 10.6%, giving −$0.20M; C: 0.0485 × 0.5122 × $45.44M − $0.50M = +$0.63M |
| Browser, desktop width (local preview of the research build) | designs (5 charts), states, safeguards, framework, questions, start and briefing render; no console errors, no NaN, no sideways scroll |
| Phone width at doubled text (scratch website build, headless Edge) | 282 checks (25 interactive pages and 22 text pages, at 320 and 375 px, normal text, root font doubled and browser setting doubled, every disclosure open), 0 with sideways scroll; before the fix below, `designs` scrolled up to 1,110 px |
| Website `scripts/check.mjs` on the scratch build | 262 files ok; the sitemap lists exactly the shown views and text pages; all 22 text pages written, none with NaN or undefined |

`verify.bat` ran in this worktree with the main checkout's `.venv` and `data/raw` linked in as directory junctions
and `PYTHONPATH` set to this worktree's `src` (checked: `alcohol_data` imported from this worktree). This branch changes
no Python package code or tests; it adds `scripts/policy_designs_check.py`.

Exports against the main checkout's run of 2026-11-19 20:25 (stamped "3b69765 (with uncommitted changes)": 646c8c6's
change before it was committed): every grocery-wine file is identical apart from the commit stamp and time, except the
federal legal note in `producer_direct.json` (its 13 cases, text and cite) and the eight new `policy_designs*` files.

## Found and fixed during verification

- `?v=designs` scrolled sideways on phones at every text size (459 px at 320 px): its chart data tables, opened by the
  sweep, were not in a `.table-wrap`, and their snake_case column names cannot wrap. Wrapped like the briefing's.
- The briefing's page description began "The two-minute case for grocery-store wine"; it now reads "Grocery-store
  wine in Utah in two minutes", so the description does not argue a side.

Both edits came after the verify run; `tsc`, `vitest` and `npm run build` were re-run on them and the website sweep
ran on a build that includes them.

## Not verified

- Any value by a person, any legal reading by an attorney, any fiscal figure by DABS or legislative fiscal staff.
- The website with a real research release: the scratch build carries this branch's code under the 0.5.1 lock.
- Desktop layout of the changed existing pages (start, briefing, initiative) against 0.5.1, element by element; they
  were read at desktop width in the browser and changed in content, so a box-for-box comparison does not apply.
- The PDF is not byte-reproducible (Edge stamps the time); its HTML is, and is tested.

## Plan section 21, item by item

| Deliverable | Status | Where, and what is missing |
|---|---|---|
| Reproducible baseline fiscal calculations | Done | `terms()` reads the engine; `docs/methods/policy-designs.md`; Python recomputation |
| Corrected, fully reconciled public revenue model | Done for the comparison | Net = DABS margin and charges + sales tax + savings − administration, against today; gross receipts apart. Deposits under B are an open legal question (M09) |
| Five arrangements evaluated | Done | A to E; D across an unmeasured delivery-cost grid; E's split illustrative |
| Realistic retailer and consumer price modeling | Done, on national references | 28% grocer and 29.5% wholesaler margins are Census national all-product figures; bottle basket is price points, not products. Real product prices: not sourced (no product's procurement cost is in the dataset) |
| Price-sensitive channel choice | Done, illustrative | Straight line to convenience limits 60/30/15%; no Utah measurement exists |
| Revenue-neutrality and break-even analysis | Done | Share that must move, lowest premium, highest grocer margin, highest distribution margin, frontier |
| Transparent policy-design comparison | Done | 10 criteria, Pareto set, classification with stated thresholds, no single score |
| Audit of DABS operating-savings assumptions | Done | `docs/review/devplan-2026-11-19-audit.md`: the $1.03M is 2.28¢ a dollar of card fees, agency contracts and bags allocated by sales; zero in every headline |
| Tennessee research integration | Done, abstract only | Sun et al. (2025) read through Crossref; the publisher refused automated access, so effect sizes were not read |
| Colorado and other states | Done, partial evidence | Colorado's vote and Blue Book read; Department of Revenue pages refused access; no evaluation found. Pennsylvania from PLCB documents |
| Public health and safeguards | Done | `?v=safeguards`; Community Guide recommendations; 12 safeguards by status |
| Utah statutory change matrix | Done | 17 rows from the Utah Code read 2026-11-19; 27 CFR part 1 and Title 59 Chapter 12 not read |
| Proposed framework | Done | 14 points and phasing; a proposal for expert review |
| Existing retailer and producer impacts | Done, partly unquantified | Package agencies' contracts and rural effects not estimated |
| Redesigned homepage | Done | Sections A to H |
| Two-minute briefing | Done | `?v=briefing` |
| Flow and bottle-price visualizations | Done | `?v=designs` charts 1 and 2 |
| Sensitivity and break-even visualizations | Done | charts 3 to 5 and the what-if panel |
| Objections and FAQ | Done | 20 hard questions |
| Printable legislative briefing | Done | `docs/briefings/utah-grocery-wine/legislative-briefing.pdf`, 2 pages, from the model |
| Detailed technical appendix | Done | `docs/methods/policy-designs.md` (generated) plus the existing technical appendix, with a dated pointer |
| Traceable assumptions and sources | Done | `docs/methods/financial-inputs.md`, provenance classes from plan section 14 |
| AI transparency and verification status | Kept | No value marked human-reviewed |
| Full automated test suite | Passing | |
| No regressions | None found | |
| Repository documentation | Done in the private repository | README, CHANGELOG (Unreleased), reproduction, limitations, fiscal reconciliation, progress log. The public repository changes only with a research release |
| Website and data release metadata reconciled | Prepared, not released | The site branch lists the five new pages in `sitemap.xml` and the no-script summary; it passes `check.mjs` only with a research release that contains them and a lock bump (Ethan's call) |
| Final verification report | This file | |

## Rollback

Every model change is additive: `policyDesigns.ts`, `statutes.ts`, `framework.ts` and the views are new; the engine
(`wineAlternatives.ts`) changed only the federal legal note's wording, and its exports are byte-identical apart from
that note. The headline change is presentation (which figure leads). Reverting this branch's commits restores 0.5.1's
pages; the website keeps 0.5.1 until its lock is bumped.
