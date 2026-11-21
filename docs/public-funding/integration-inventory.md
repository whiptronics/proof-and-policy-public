# Public Funding: integration inventory (G0)

- **Status:** written 2026-11-20 by Claude (AI) while building the Public Funding & Public Value Lab from the devplan
  `Proof_and_Policy_Public_Funding_Claude_Devplan.zip` (29 files). Not reviewed by a person.
- **Boundary:** local only. Nothing pushed, published, deployed or sent anywhere; no paid service, account or tracker.

## Where the work is

| | Path | Branch | Base commit |
|---|---|---|---|
| Research repository (this one) | `researchtools/politics/alcohol-policy-revenue-data-devplan` (a worktree) | `devplan/2026-11-19` | `9986619` (same shelf price leads) |
| Website repository | `proof-and-policy/pp-devplan-1119` (a worktree) | its devplan branch | `035870d` |
| Raw cache and Python environment | `../alcohol-policy-revenue-data` (`data/raw`, `.venv`) | `nationwide-expansion` | not changed |

The website builds from a tagged export of this repository (`research.lock.json`, `scripts/build.mjs`); its text pages
at `/read/<view>/` are captured from the built site by `scripts/prerender.mjs`. A new view reaches the site only through
a new research release, which is the maintainer's decision.

## Baseline before this feature

| Check | Command | Result at `9986619` |
|---|---|---|
| Web tests | `web/node_modules/.bin/vitest run` | 544 passed |
| Python tests | `pytest` with `data/raw` linked to the main checkout's raw cache | 432 passed |
| Types | `web/node_modules/.bin/tsc --noEmit -p web` | clean |
| Build | `npm --prefix web run build` | built |
| Generated docs | `npm --prefix web run docs:framework`, `npm --prefix web run brief:legislative` (2-page PDF) | no diff |

## What the feature reuses

- **Routing and navigation:** `web/src/lib/url.ts` (`VIEWS`, `useParams`, `navigate`), `web/src/lib/nav.ts` (groups and
  descriptions), `web/src/App.tsx` (lazy views).
- **Models, unchanged:** `web/src/lib/policyDesigns.ts` (`policy-designs@1.0`: `terms()`, `netPerDollar`,
  `SAVINGS_CASES`, `whatIfDesigns`), `web/src/lib/wineAlternatives.ts` (`RETAILER_TARGET`), `web/src/lib/samePrice.ts`
  (cross-checked in tests). The funding ledger is an adapter over these; it adds equations, it does not fork them.
- **Components:** `ChartFigure` (title, reading, limits, source, PNG/SVG/CSV export, table), `HowWeKnow`, `Go`; the
  `table.data`, `fieldset.radios`, `panel`, `tag` classes; `saveFile` from `lib/csv.ts`; `AI_DISCLOSURE`.
- **Source pipeline:** `config/sources/*.yaml` → `alcohol-data fetch` (pins in `config/builds/preview.pins.json`) →
  `sources audit` (rewrites `metadata/source_registry.csv` and `rights_registry.csv`) → a script that writes a
  `*.generated.ts` with a `--check` mode and a pytest drift test that skips without raw data.

## What the feature adds

| Piece | Files |
|---|---|
| Sources (17 assets) | `config/sources/utah_code_fiscal_earmarks.yaml`, `utah_school_meals_2026.yaml`, `census_school_finances.yaml`, `naep_2024.yaml`; `config/builds/preview.yaml`, `preview.pins.json`; both registries |
| Hand-recorded bill status | `metadata/legal_history/utah_sb180_2026_status.csv` (read from le.utah.gov, whose page is drawn by JavaScript) |
| Observed data | `scripts/public_funding.py` → `web/src/lib/publicFunding.generated.ts`; `tests/test_public_funding.py` |
| Model adapter (`public-funding@1.0`) | `web/src/lib/publicFunding.ts`; `publicFunding.test.ts`; `publicFunding.vectors.json` (the devplan's synthetic vectors, copied) |
| Page (`?v=funding`) | `web/src/views/FundingView.tsx`; registrations in `url.ts`, `nav.ts`, `App.tsx`; `pageWording.test.ts` covers it |
| Website | `site/public/sitemap.xml` and the no-script summary in `site/index.html` (website repository) |

## Data gaps found at the start (and how the page treats them)

- **No wine-only DABS public receipts.** DABS reports all liquor. The page labels every DABS amount "all liquor" and the
  lab uses the existing wine terms (FY2026 wine sales; FY2025 all-product margin applied to wine, as before).
- **No measured share of wine that would move, no measured new demand, no measured avoidable DABS cost.** These stay
  inputs; documented-input-only mode removes them and the result becomes per dollar, or undetermined.
- **No school-meal cost per meal.** The legislative brief gives prices families pay, not costs; the comparator shows
  "Not available".
- **No district apportionment of alcohol money.** District cards show Census finances only and say "Not estimable".
- **USBE district data** was not used at first; Census's FY2024 individual-unit file supplies the district rows. The
  gap-closing pass (same day) added USBE's own FY2024 per-pupil figure beside Census's for every district
  (`qa/independent-comparison.md`), and the federal free-lunch reimbursement as a comparator, labeled as a rate.
- **Tennessee and Colorado (PPF-407)** reuse what the project already held: the Other States record (`STATE_CASES` in
  `web/src/lib/framework.ts`), Tennessee's collections and NIAAA's consumption file through their existing adapters,
  the 2014 act and the 2024 Colorado statutes. One file was added: Tennessee's Alcohol Tax Manual (June 2025), because
  the department's tax page refused automated access. Where Tennessee's wine tax goes was not found in it.
