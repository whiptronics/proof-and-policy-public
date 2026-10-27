# Proof & Policy: research tool

*Open data on alcohol laws, revenue, and public health.*

A reproducible, source-traceable dataset of U.S. state alcohol policy, population, apparent alcohol
consumption, drinking behavior, and public revenue, with the code that builds it, the models behind the Utah
revenue scenarios, and a local research dashboard. The same data and models power the website
**[proofandpolicy.us](https://proofandpolicy.us)**; this repository runs on its own and needs nothing from the
website.

**Status: research preview, release 0.3.1.** Coverage is partial and declared series by series in
[docs/coverage-report.md](docs/coverage-report.md). Nothing here establishes a causal effect of any
policy. Hand-entered values and policy codings are labelled with who extracted them; none has yet been
reviewed by a person (an AI assistant did the extraction and checks; see the AI disclosure below), and they stay
labelled that way until a named reviewer records a check.

**Quick start without downloading the sources** (about five minutes): see
[Run the example](#run-the-example-no-downloads) below.

**Scope:** the project is broadening into a nationwide resource,
and from there, one small milestone at a time, toward a policy simulator (describe a proposal; estimate
prices, purchases, substitution and net revenue under stated assumptions). It now has the following, but
historical coverage stays thin:

- a catalog of 28 policy dimensions;
- dated current-law snapshots for 47 of 51 jurisdictions;
- a version ledger that verifies history from session laws, and verified history for five states;
- liquor-control arrangements kept as four separate things (who wholesales spirits, who wholesales wine,
  who sells each to take home), verified over time for Utah and dated as current law for its peers;
- descriptive tools that carry the sources' own uncertainty (intervals, rank ranges, sensitivity scenarios
  without probabilities; [docs/methods/statistical-approximations.md](docs/methods/statistical-approximations.md));
- Census state liquor-store receipts and expenditure through FY2024, from the Individual Unit Files parsed on
  2026-10-13, with the FY2015 overlap between two Census releases reconciled and the new classification breaks
  kept apart (see [docs/fiscal-reconciliation.md](docs/fiscal-reconciliation.md)).

Read [docs/policy-coverage.md](docs/policy-coverage.md) before comparing states. The plan, with the
simulator milestones, is [docs/plans/nationwide-expansion.md](docs/plans/nationwide-expansion.md). What changed
in each release is in [CHANGELOG.md](CHANGELOG.md). (Some documents mention `docs/progress.md`: that is the
maintainer's private working log and is not published; the CHANGELOG records the same changes.)

## Run the example (no downloads)

The test fixtures are real but tiny slices of the public sources, redistributable and bundled here
(`tests/fixtures`, `config/builds/fixture.yaml`). They build a small example database and run the dashboard on it.
Labelled **example data**: a few states and years only; use a full build for any real comparison.

```bash
python -m venv .venv
. .venv/bin/activate              # Windows PowerShell: .\.venv\Scripts\Activate.ps1
python -m pip install --require-hashes -r requirements/dev.lock
python -m pip install --no-deps -e .
python -m pytest                  # offline tests on the fixtures
alcohol-data build --config config/builds/fixture.yaml
alcohol-data dashboard export
cd web && npm ci && npm test && npm run dev   # then open http://127.0.0.1:5317
```

The Utah revenue scenarios, the grocery-wine analysis and their checks need no database at all: their inputs are
in `web/src/lib/*.ts` with their sources, so `?v=scenario` and `?v=initiative` show the same results as the website
even on the example build. `python scripts/grocery_wine_briefing_example.py` recomputes the worked example
independently; `npm --prefix web run export:grocery-wine` writes the purchase-flow tables, which
`python scripts/grocery_wine_flows_check.py` then recomputes with separately written closed forms.

The full release tables (CSV, Parquet and DuckDB, with checksums and release notes) are attached to each
[GitHub release](https://github.com/whiptronics/proof-and-policy-public/releases); the website shows release 0.3.1.
They can always be rebuilt from the sources below.

## Why this exists, and what it does not claim

The project started from interest in whether allowing sealed wine sales in qualifying grocery stores
changes public revenue, access, drinking, and related outcomes, especially in Utah and the Salt Lake
area. The data are built to support findings in either direction:

- No filter, comparison, or summary is designed to favor an answer.
- Laws, tax receipts, state liquor-store earnings, and drinking behavior are kept as separate data.
- Missing values stay missing. Unknown legal status stays unknown.
- Contradictions between sources, including inside one source, are published, not smoothed over.

It is an independent project. It is not affiliated with, endorsed by, or reviewed by any government
agency, legislature, or research institution. Values extracted by hand and policy codings are labelled
with who extracted them and whether a maintainer has reviewed them.

## What is in the preview

| Family | Source | Coverage (preferred values) |
|---|---|---|
| Population | Census Population Estimates (intercensal 1990-2000, 2000-2010, 2010-2020; Vintage 2025) | 50 states + DC, July 1, 1990-2025 all ages; ages 14+, 18+, 21+ from 2000 |
| Apparent consumption | NIAAA surveillance report #124 data file (and #122 for revisions) | States, regions, U.S., 1970-2024; beer, wine, spirits, all; per capita 14+ and 21+ |
| Drinking behavior | CDC BRFSS prevalence (data.cdc.gov) | 50 states + DC, 1995-2025; any drinking, binge, heavy, with 95% CIs; 2011 break kept |
| Youth drinking | CDC YRBS (data.cdc.gov, public domain) | High school alcohol use, 1991-2017; 2019-2023 through CDC Chronic Disease Indicators |
| Health and safety | NHTSA FARS; CDC Chronic Disease Indicators | Traffic and alcohol-impaired-driving deaths, 2000-2023 (per 100,000 derived); chronic liver disease mortality, 2019-2022 (CDI is licensed ODbL, so packaging a release is blocked until the owner decides) |
| Income and spending | BEA Regional Economic Accounts (SAINC, SAPCE) | Personal income and income per person, 1929-2025; residents' take-home alcohol spending, 1997-2025 |
| Businesses and retail | Census County Business Patterns; Economic Census; Monthly State Retail Sales | Liquor stores and drinking places 2000-2023 (private employers only); liquor stores 2012 and 2017; monthly retail sales changes 2019-2026 |
| Public finance | Census State Government Tax Collections | State alcohol sales taxes (T10) and licenses (T20), state fiscal years, 1941-2025 |
| Public finance | Census State and Local Government Finances (liquor store items) | State liquor-store receipts (revenue), expenditure, current operations and capital outlay, FY1972 and FY1977-FY2024 (FY2016-FY2024 from the Individual Unit Files; FY2015 from the 2017 release, with the 2020 release kept as a candidate). Capital outlay and total expenditure from FY2022, and Oregon's current operations and total from the unit files, are separate comparability groups |
| Public finance | Utah DABS annual reports (hand-transcribed) and monthly Sales Analysis Reports | Utah liquor sales, profit, transfers, FY2020-FY2025 (unreviewed); gross sales and 9-liter cases by beverage, May 2025 to August 2026 |
| Public finance | Tennessee Department of Revenue, June Summary of Collections | Tennessee wine tax, winery wine tax, wine enforcement tax and the alcoholic-beverages class total, FY2010-FY2025 (parsed from the reports' text layer) |
| Public finance | Utah State Tax Commission, Publication 25 | Utah's state sales tax rate, 4.85% (pages marked draft) |
| Prices | BLS CPI-U | Monthly 1987-2026, for constant-dollar derivations |
| Policy | Utah Code (every version since 2014), the 2002-2013 session laws (2003 S.B. 66 beer tax, 2010 S.B. 167 recodification and its amendments) and 2019 S.B. 132; Tennessee 2014 Public Chapter 554 (enacted text); Kentucky Acts 2013-2017; Virginia Acts 1997-2024; Arkansas Act 508 of 2017 | 23 coded intervals with evidence. Utah is verified day by day from 2003-05-05 (liquor wholesale by the state from 2003-05-05, state stores and contract agencies as the retail channel from 2011-07-01), Kentucky grocery wine and spirits from 1998-07-15, Virginia grocery wine from 1997-07-01. None reviewed by a maintainer yet |
| Policy (current law) | Statutes, codes and licensing-agency pages of each state, pinned (source `state_alcohol_law`) | 179 dated snapshots for 47 jurisdictions (grocery wine, beer and spirits; who wholesales and who sells spirits and wine, for the liquor-control peers). Single days, not history; each records whether the text names the outlet type or only creates a general license |

The tables keep every competing edition of a value (`observations`) and one documented choice per cell
(`preferred_observations`). Every value has a source locator and a lineage row; every input file is
pinned by SHA-256.

## Three ways to use it

### 1. Download the tables (no code needed)

A release contains `csv.zip`, `parquet.zip`, `alcohol_data.duckdb`, `manifest.json`,
`checksums.sha256`, the data dictionary, coverage, limitations, source and rights registries, and
small examples. Start with `state_year_long.csv` (one preferred value per state, measure and period,
with labels and units) and read [docs/limitations.md](docs/limitations.md).

Open CSV geographic codes as text: spreadsheet programs strip the leading zero from codes such as `06`.

### 2. Rebuild it yourself

Requires Python 3.11 or newer. No API key and no paid service are needed.

Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --require-hashes -r requirements/dev.lock
python -m pip install --no-deps -e .
alcohol-data fetch --config config/builds/preview.yaml
alcohol-data build --config config/builds/preview.yaml
alcohol-data validate --profile release
alcohol-data export --format csv,parquet,duckdb
alcohol-data report coverage
```

macOS / Linux:

```bash
python3 -m venv .venv
. .venv/bin/activate
python -m pip install --require-hashes -r requirements/dev.lock
python -m pip install --no-deps -e .
alcohol-data fetch --config config/builds/preview.yaml
alcohol-data build --config config/builds/preview.yaml
alcohol-data validate --profile release
alcohol-data export --format csv,parquet,duckdb
alcohol-data report coverage
```

`fetch` downloads about 330 MB (mostly the 1990s Census county files) and records each file's hash in
`config/builds/preview.pins.json`. `build` never downloads; it reads exactly the pinned bytes.
`python -m pip install -e ".[dev]"` also works if you do not need the hashed lockfile.

See [docs/reproduction.md](docs/reproduction.md) for offline rebuilds from a release manifest, files
that must be downloaded by hand, and what is and is not byte-identical.

### 3. Browse it in the local research dashboard

```bash
alcohol-data dashboard export
cd web
npm ci
npm run dev
```

Then open http://127.0.0.1:5317. It opens on **Start here**, which asks which question you want to
answer: what changed after a state allowed grocery-store wine (**Before & after**), which states compare
with Utah (**Find comparison states**), how revenue and consumption compare across states, or what
assumptions mean for Utah's wine revenue (**Utah revenue scenarios**). Each tool fills in inputs you can
change and reports what its result can and cannot show. Below the questions, **Utah at a glance** and the
nationwide views are one click away.

Utah at a glance (`?v=utah`) is the shortest way in: how Utah sells alcohol, Utah's latest value on 11
measures (13 in a preview build, which adds two CDC Chronic Disease Indicators series) with its rank among the states
and DC that have a value for the same year and definition, and nine
candidate comparison states with why each was chosen, how it differs and what is not yet known.

The Map, Revenue by state and the comparison finder can also compare **liquor-control arrangements**
(for example "the state sells spirits at retail"). A state counts only where coded law is verified for the
whole period; a state without that history is shown as "cannot be assessed", with its dated current law
beside it, never silently included or left out. The data views are:
- Map: any measure for every state, with a ranked list, a table, each state's trend and sources;
- Beer, wine & spirits: the three beverages side by side, and what Utah's state stores sell by month;
- Revenue by state: each kind of alcohol money in its own column, never added, with each state's
  liquor-control arrangement for the year shown;
- Coverage: what is held and what is missing, with a research queue;
- Explore: any measures, jurisdictions and years, with a coded policy shown underneath, and saved analyses;
- Policy timeline;
- Policy matrix: every state against every coded policy, on one day or as dated snapshots;
- state Compare;
- Revenue over time: revenue and consumption trends for one state;
- Sources;
- Officials & committees: who held office and sat on which committee, from a cleaned Open States snapshot
  (a reference list only; no scores, votes or outreach).

It also has a worked grocery-wine example (Tennessee, 2016), whose charts open in Explore as saved analyses. Every value traces to its source location, and
filtered downloads come with a README explaining the joins. It runs locally and makes no causal claims; the
website at proofandpolicy.us is a hosted copy of the same dashboard. See [docs/research-dashboard/README.md](docs/research-dashboard/README.md).

### Commands

| Command | What it does |
|---|---|
| `alcohol-data sources audit` | Regenerate `metadata/source_registry.csv` and `metadata/rights_registry.csv` |
| `alcohol-data fetch [--refresh] [--update-pins] [--offline]` | Make pinned inputs available; `--refresh` re-downloads and reports upstream changes |
| `alcohol-data import-asset <asset_id> <file>` | Import an official file you downloaded by hand |
| `alcohol-data build [--manifest dist/<v>/manifest.json]` | Build the DuckDB database from pinned bytes |
| `alcohol-data validate --profile dev\|release` | Run data checks; exit 1 on any error |
| `alcohol-data export --format csv,parquet,duckdb` | Write deterministic exports |
| `alcohol-data report coverage \| dictionary \| descriptive \| changes --against <manifest>` | Coverage, data dictionary, descriptive outputs, release diffs |
| `alcohol-data report completeness` | Completeness by measure, jurisdiction, year and definition, with series breaks (`docs/completeness.md`) |
| `alcohol-data report policy-coverage` | Policy coverage matrix: verified history, snapshots and nothing coded, by dimension and state (`docs/policy-coverage.md`) |
| `python scripts/policy_snapshots.py sync` / `rows` | Register the pages named in `data/curated/policy_baseline/*.yaml`, then (after `fetch --only ...`) cut each snapshot's excerpt from the pinned bytes |
| `alcohol-data legal discover-utah` / `legal ledger-utah` | List and check every historical version of the tracked Utah Code sections |
| `alcohol-data legal review-packet-utah` | Write the Utah review packet (one section per interval, with an unticked reviewer checklist) and the Utah source catalog |
| `alcohol-data package --version <v>` | Assemble `dist/<v>/` (refuses if release validation fails) |
| `alcohol-data dashboard export` | Write the local research dashboard's data to `web/public/data/` |

## Read before using

- **Census T10 is not wine revenue.** It is all-alcohol state tax, and it excludes the profits of
  state-run liquor stores, which are most of Utah's alcohol revenue. See
  [docs/fiscal-reconciliation.md](docs/fiscal-reconciliation.md).
- **State liquor-store receipts are turnover, not profit.** Census liquor-store revenue is what a state
  monopoly took in, wholesale or retail; it is not total alcohol sales in the state, not net profit, and
  not a sign of who runs the retail stores.
- **Drinking prevalence is not consumption.** BRFSS measures the share of adults who drink; NIAAA
  measures sales-based ethanol per resident. Never divide one by the other.
- **Different ages are different populations.** NIAAA per capita uses residents 14+ and 21+; BRFSS
  covers adults 18+; per capita taxes here use all residents or residents 21+.
- **Fiscal years are not calendar years.** Utah's and Tennessee's run July to June; four states differ.
- **BRFSS changed method in 2011.** Earlier and later estimates are in different comparability groups.
- **"Control state" is not one thing.** A state can wholesale spirits and leave retail to private stores,
  run its own stores, contract agencies to run them, or treat wine differently from spirits. The data keep
  these apart, and a current-law snapshot says nothing about earlier years.
- **Salt Lake City, Salt Lake County, the Salt Lake metro area and Utah are different places.** This
  preview has state-level data only. The comparison rules in `src/alcohol_data/compare.py` refuse
  cross-level comparisons unless they are explicitly labelled.

## Repository layout

```
config/          source definitions (sources/), build configurations and input pins (builds/)
metadata/        measures, crosswalks, fiscal calendars, policy catalog, generated source/rights/coverage registries;
                 legal_history/ (Utah ledger; state_section_versions.csv and state_claim_checks.csv for other states)
data/curated/    hand-made records under version control: policy intervals, evidence, snapshots, manual extractions;
                 policy_baseline/ (current-law snapshot batches), research/ (gaps and source leads)
src/alcohol_data acquisition, adapters (one per source), schemas, transforms, validation, exports
sql/             convenience views
tests/           offline tests on real slices of the sources (tests/fixtures)
docs/            methods, coverage, limitations, reconciliation, policy coding guide, progress log
analysis/        descriptive outputs; causal work is gated (analysis/causal/README.md)
web/             local research dashboard (Vite + React); reads web/public/data/ from `dashboard export`
scripts/         small maintenance scripts (policy snapshots; comparison test vectors for the dashboard;
                 the exploratory age-adjusted FARS check)
```

`data/raw`, `data/processed`, `dist`, `web/node_modules`, `web/dist` and `web/public/data` are generated and
ignored by Git.

## Cite

See [CITATION.cff](CITATION.cff). Cite the exact release (its `release_id` in `manifest.json`) and the
original sources listed in `metadata/source_registry.csv`.

## License

Code: MIT ([LICENSE](LICENSE)). Data: per source; see [DATA_LICENSE.md](DATA_LICENSE.md) and
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Authorship and affiliation

Proof & Policy is an independent project by Ethan Whipple. Every value says how it was produced and whether a
person has reviewed it; as of this release none has. It is not affiliated with, endorsed by, or reviewed by any
government agency, legislature, university, candidate or campaign.

**AI disclosure.** This project was compiled with the assistance of an AI agent (Claude, by Anthropic), working at
the maintainer's direction. The agent located and downloaded most sources, transcribed values from documents,
coded the laws, wrote the data pipeline, models and dashboard, ran the calculations and checks, and drafted most of
the documentation and explanatory text. Automated tests and separately written scripts check the arithmetic and
internal consistency; they do not show that a source was read correctly or that an assumption is reasonable.
`machine_assisted_review` means code and the AI agent checked a record, not a person. Nothing here has been
peer-reviewed, reviewed by a legal or subject-matter expert, or endorsed by any government. AI-generated material
can contain errors. Modeled results depend on the stated assumptions and should be evaluated alongside the cited
sources and methodology. The same disclosure is on the website footer, its Definitions & methods page, printed
pages and every download's README (`web/src/lib/disclosure.ts`).

## Contributing

Corrections are welcome, including ones that weaken the motivating policy argument. See
[CONTRIBUTING.md](CONTRIBUTING.md).
