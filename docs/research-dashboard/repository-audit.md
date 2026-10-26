# Research dashboard: repository audit

Audit date: 2026-10-07. Auditor: Claude (AI assistant), working from the dashboard plan Ethan supplied
(`alcohol-policy-research-dashboard-devplan.md`, kept outside the repository). Everything below was
checked in the checkout itself, not taken from the earlier progress notes.

**Baseline.** The baseline is branch `utah-source-expansion` at `983bbc1`, with a clean worktree. The
dashboard work is on branch `research-dashboard`, created from that commit.
- `python -m pytest`: 153 passed.
- `alcohol-data build` (29 s) then `alcohol-data validate --profile release`: 0 errors and 2 warnings.
  - 228 Utah DABS values are `extracted_unreviewed`.
  - 14 policy intervals are `machine_assisted_review`.
- Rebuilt database: build `preview-a1d1ccfb290c`, release version `0.2.0-preview`, law as of
  2026-10-06 (America/Denver).

## Four levels of "we have it"

The dashboard keeps these apart. A source can sit at any level, and a source catalogued in a document
is not the same as a usable time series.

| Level | Meaning | Where it is recorded |
|---|---|---|
| A source exists | Publisher and landing page identified | `docs/coverage-audit.md`, `docs/gaps/utah-missing-records.md`, the source catalog |
| A file was downloaded | Bytes held and pinned by SHA-256 | `source_assets`, `config/builds/preview.pins.json`, `data/raw/` |
| Values were extracted | Rows in `observations` (parsed or transcribed) | `observations`, `observation_details`, `lineage` |
| Values suit comparison | Same measure, unit, age universe, beverage, period kind and comparability group | `measures`, `comparability_group`, `src/alcohol_data/compare.py` |

There are 156 pinned assets (one is a derivation record). Only 28 of them yield observations:
- 25 files or API responses from federal sources (Census PEP 13, Census STC 4, BLS 4, NIAAA 2, BRFSS 2);
- 2 hand-transcribed DABS reports;
- 1 derivation record.

The other 128 assets are legal texts. 32 of them are cited by policy evidence rows, and the rest feed the
Utah legal ledgers. They support policy intervals, not numeric series.

## Audit table

| Audit item | Result |
|---|---|
| Existing application | No UI. Python 3.11+ package `alcohol_data` (typer CLI `alcohol-data`), DuckDB, pyarrow, httpx. Installed with pip from hashed lockfiles (`requirements/*.lock`); no npm anywhere in the repo. Entry points: `fetch`, `import-asset`, `build`, `validate`, `export`, `report`, `legal ...`, `package`. `compare.py` already says it is meant to be shared with "the static explorer" (planned as v0.3 in `docs/progress.md`). |
| Canonical data | `data/processed/alcohol_data.duckdb`, which is generated and git-ignored. Its tables are defined once in `src/alcohol_data/schemas/tables.py` (schema 1.1.0). Row counts: <ul><li>`observations` 175,300</li><li>`preferred_observations` 102,092 (one value per cell)</li><li>`state_year_long` 94,705</li><li>`measures` 61</li><li>`geographies` 56</li><li>`sources` 13, `source_assets` 156</li><li>`policy_events` 14, `policy_evidence` 66, `policy_segments` 24, `policy_exposure` 1,036</li><li>`claim_dependencies` 15, `claim_exceptions` 9</li><li>`lineage` 175,300</li></ul>Hand-made inputs are in `data/curated/` and are under version control. Generated legal ledgers are in `metadata/legal_history/`. |
| Geographic coverage | 50 states + DC, the nation, and 4 Census regions (NIAAA only). No county, city or metro data. Salt Lake City and Utah are kept apart by rule. |
| Temporal coverage and units | <ul><li>Population: Census July 1, 1990-2025; ages 14+/18+/21+ from 2000; persons.</li><li>Consumption: NIAAA, calendar years 1970-2024; US gallons, gallons of ethanol, and ethanol per resident 14+ and 21+.</li><li>Behavior: BRFSS, survey years 1995-2025; percent, with 95% CIs and sample sizes on every row; a break in 2011 and several definition changes.</li><li>Finance: Census STC T10 (alcohol sales taxes) and T20 (licenses), state fiscal years 1941-2025, in nominal USD (published in thousands). Utah DABS, FY2020-FY2025 only, 20 measures, nominal USD, transcribed by hand.</li><li>Prices: CPI-U, monthly 1987-2026.</li></ul> |
| Acquisition | <ul><li>Adapters for Census PEP, NIAAA, BRFSS (data.cdc.gov), Census STC and BLS CPI (API).</li><li>Legal fetchers for Utah Code history, session laws and archived code pages.</li><li>`import-asset` for manual files.</li><li>Blocked or manual:<ul><li>abs.utah.gov (DABS PDFs: HTTP 403 on repeat);</li><li>the Tennessee Secretary of State PDF;</li><li>www.cdc.gov BRFSS pages;</li><li>download.bls.gov;</li><li>NIAAA APIS topic pages;</li><li>University of Utah annotated-code PDFs (403 with a Cloudflare challenge).</li></ul></li></ul>All are documented in `docs/reproduction.md` and `docs/coverage-audit.md`. |
| Evidence status | <ul><li>Parsed by code from official machine-readable files: 169,804 observations. That is all of them except the 228 hand-transcribed and 5,268 derived.</li><li>Hand-transcribed and unreviewed: 228 (DABS).</li><li>Reviewed by a person: 0 observations, 0 policy intervals.</li><li>Derived: 5,268 (T10 per resident, per resident 21+ and constant 2024 dollars), with input IDs in `lineage`.</li><li>Missing with a reason: 6,047 rows (`not_published` 5,488, `unavailable` 510, `not_applicable` 49). The 6 `unresolved_conflict` cells exist only in `preferred_observations`.</li><li>Observed zeros: 163 rows, which stay distinct from missing.</li></ul> |
| Legal coverage | 14 intervals in Utah and Tennessee. Utah has every claim verified day by day from 2003-05-05. The day-level `temporal_status` runs are in `metadata/legal_history/utah_code_claims.csv`.<br>Unknown periods:<ul><li>Utah before 2003-05-05;</li><li>Tennessee before 2014-03-20, and after 2016-07-01 (verified for that one day only);</li><li>every other state (not coded).</li></ul>There are no unresolved contradictions in the policy intervals. The DABS fiscal tables contain 6 unresolved numeric conflicts. |
| Fiscal coverage | **Taxes:** Census T10 (all alcohol, state only; excludes liquor-store profits) and T20, all states. **Sales:** DABS liquor sales revenue (Utah FY2020-25 only). **Profits:** DABS gross and net profit (Utah only). **Transfers:** DABS earmarked transfers (Utah only). **Fees:** T20 licenses. **Missing:**<ul><li>wine-specific taxes anywhere;</li><li>Census liquor-store revenue for control states;</li><li>DABS before FY2020;</li><li>local receipts;</li><li>general sales tax attributable to alcohol.</li></ul>No reconciled government-receipts total exists, by design: the components overlap (see the `fiscal_components` view). |
| Behavioral coverage | BRFSS crude prevalence for adults 18+, past 30 days. Seven measures, because each definition change is its own measure:<ul><li>any drinking: questionnaire item 1995-99, calculated variable from 2001;</li><li>binge drinking: 5+ for everyone through 2005, 5 for men / 4 for women from 2006;</li><li>heavy drinking: per day through 2014, per week from 2015.</li></ul>2011 is a methodology break (separate comparability groups). Every row has 95% CI and sample size; there are no standard errors. Apparent consumption is NIAAA sales-based ethanol per resident 14+ and 21+, which includes tourists and border purchases. |
| Quality gates | `python -m pytest` (153 tests) and `ruff`. `alcohol-data validate --profile dev\|release` checks keys, foreign keys, vocabularies, temporal overlaps, review states, reconciliations and year-over-year jumps. `alcohol-data package` refuses to package if release validation fails. GitHub workflows are written but have never run (there is no remote). |
| Missing capabilities | Smallest set for the dashboard:<ol><li>A deterministic dashboard export (JSON indexes split by metric) that reads the canonical database. It must not copy values by hand.</li><li>Precomputed coverage cells with explicit states, and family counts with denominators.</li><li>Transformation inputs (CPI fiscal-year deflators, July 1 denominators) with input IDs.</li><li>A curated research-gap register and a source-lead register, for sources not held.</li><li>A small static UI.</li></ol>Policy operational dates and observed-as-of snapshots need a small curated overlay; `policy_events` has no column for them. |

## Implementation choices recorded after the audit

- **The Python pipeline stays authoritative.** A new `alcohol-data dashboard export` command reads the
  built DuckDB file, the curated CSVs and the legal ledgers. It writes versioned JSON to
  `web/public/data/` (git-ignored, regenerated), in stable sort order, with a manifest.
  - No research value is typed into the UI.
  - Constant-dollar and per-person values are computed in Python, using the same conventions as
    `derive.py` (CPI-U averaged over the state's fiscal year; the Census July 1 estimate inside the fiscal
    year). A test pins them to the canonical T10 derivations.
- **UI: `web/`, Vite + React + TypeScript, npm with a committed `package-lock.json`.** This is the first
  JavaScript in the repository, so it does not duplicate a package manager.
  - Charts use Recharts 3.10.1 (MIT; supports gaps at nulls, range areas for confidence intervals and
    reference lines for policy dates).
  - Filtered downloads are zipped with fflate 0.8.3 (MIT).
  - Versions were chosen to be at least two weeks old on 2026-10-07.
- **What the UI computes:** only percent change, index-to-baseline and window means, because the reader
  picks the base or the window. All three live in one module (`web/src/lib/formulas.ts`) with tests. The comparison rules are a port of
  `compare.py`, and are checked against test vectors that Python generates.
- **No backend or browser SQL engine.** The largest single metric file is under 1 MB.
- **Source files are not copied into the static assets.**
  - "Open original" links go to the publisher's URL, with `#page=` when the PDF's page labels match its
    page indexes.
  - The development server can also serve the locally cached copy, but only for assets marked
    redistributable.
  - Restricted files (the 1992 annotated-code volume, the DABS PDFs) are never served or copied.

## After the audit

The dashboard work also added data, recorded in the CHANGELOG and docs/progress.md:
- Tennessee Department of Revenue wine-tax collections (FY2010-FY2025);
- the 2001 and 2002 Utah Digests, pinned but not parsed.

The worked example is chosen in [case-study-selection.md](case-study-selection.md). Commands and the
verification record are in [README.md](README.md).
