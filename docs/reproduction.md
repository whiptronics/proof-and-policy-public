# Reproduction

There are two ways to use this project: download a release and use its tables (no code), or rebuild the
tables from the original sources. This page covers rebuilding.

## Requirements

- Python 3.11 or newer. Tested locally on Windows 11 with Python 3.13 and 3.14; the pull-request workflow
  is configured for Ubuntu and Windows with Python 3.11 and 3.13 but has not run yet (no remote).
- About 330 MB of downloads and 1 GB of free disk space.
- No API keys. Optional: `BLS_API_KEY` (BLS API v2; v1 needs no key) and `CENSUS_API_KEY` (not used by
  v0.1). Keys are read from environment variables only and are redacted from logs and manifests. See
  `.env.example`.

## Install

```bash
python -m venv .venv
# Windows PowerShell:  .\.venv\Scripts\Activate.ps1
# macOS / Linux:       . .venv/bin/activate
python -m pip install --require-hashes -r requirements/dev.lock
python -m pip install --no-deps -e .
```

`requirements/runtime.lock` and `requirements/dev.lock` are universal lockfiles with hashes, generated with
`uv pip compile pyproject.toml --universal --generate-hashes --python-version 3.11 [--extra dev]`.

## Rebuild the preview

```bash
alcohol-data fetch --config config/builds/preview.yaml
alcohol-data build --config config/builds/preview.yaml
alcohol-data validate --profile release
alcohol-data export --format csv,parquet,duckdb
alcohol-data report coverage
alcohol-data package --version 0.1.0-preview
```

- `fetch` downloads each input once, checks that the bytes are what the configuration says (an HTML error
  page is rejected as a CSV, a PDF must start with `%PDF`, and so on), stores them under
  `data/raw/<asset_id>/` named by hash, and records the SHA-256 in `config/builds/preview.pins.json`.
  Later runs reuse the cached bytes without touching the network.
- `fetch --refresh` downloads again and reports any input whose bytes changed upstream. The build keeps
  using the pinned bytes until you accept the change with `--refresh --update-pins` and review it with
  `alcohol-data report changes --against dist/<previous>/manifest.json`.
- `build` never uses the network.

## Rebuild a published release exactly

```bash
alcohol-data fetch --config config/builds/preview.yaml
alcohol-data build --config config/builds/preview.yaml --manifest dist/0.1.0-preview/manifest.json
```

With `--manifest`, the build reads the SHA-256 of every input from the release manifest. If the cached
bytes for any input are missing or different, the build stops and says which. Upstream files change
(BRFSS, Census and NIAAA all revise), so the current download may not match an old manifest. Keep
`data/raw/` if you need old releases to be rebuildable offline.

`alcohol-data fetch --offline` verifies that every pinned input is present in the cache and fails clearly
if one is not; it never falls back to the network.

## Files that must be downloaded by hand

Some official hosts refuse automated requests. Download the file in a browser and import it:

```bash
alcohol-data import-asset tn_public_chapter_2014_554 path/to/pc0554.pdf
```

| Asset | Where | Why manual |
|---|---|---|
| `tn_public_chapter_2014_554` | https://publications.tnsosfiles.com/acts/108/pub/pc0554.pdf | HTTP 403 to automated requests; imported by hand on 2026-10-06 |
| `utah_dabs_annual_report_fy2025`, `utah_dabs_annual_report_fy2024` | https://abs.utah.gov/about-dabs/news/annual-reports/ | Downloaded automatically once on 2026-10-06; later requests the same day got HTTP 403 |

All three are pinned. `import-asset` accepts a file only if its SHA-256 matches the pin (pass
`--update-pin` deliberately to accept a different edition). The preview builds without the files: these
documents are cited, not parsed, so when one is missing `fetch` reports it (`manual_required` or
`UNAVAILABLE`, not a failure) and the build records it as `pinned_not_local`, keeping the pinned hash.
Policy evidence and hand-transcribed values stay traceable to that hash and page; re-checking them needs
the file, and `tests/test_policy_evidence.py` verifies the excerpts whenever the documents are present.

## Responses that change on every request

Some inputs carry per-request noise that would make a byte-level pin impossible to match again. Each
asset declares a normalizer, applied before hashing to downloads and manual imports alike:

| Normalizer | Assets | What is removed |
|---|---|---|
| `bls_api_json` | BLS CPI API responses | the `responseTime` field (milliseconds) |
| `strip_html_request_tokens` | Tennessee bill information page | the `__RequestVerificationToken` hidden input value |
| `strip_passed_bills_timestamp` | Utah passed-bill indexes (11 sessions) | the request time in "Bills Passed as of <time>" |
| `strip_lis_page_variants` | Virginia Law Library pages (law.lis.virginia.gov: two code sections, § 4.1-209, the 2026 updates lists) | the request date in the `printDate` block, and the "Virginia Law Library" footer block, which some of the site's servers add and others omit (seen 2026-10-09: one request in five came without it) |

Content changes still change the hash (tested in `tests/test_acquisition.py`).

The two Virginia code pages pinned on 2026-10-07 (§§ 4.1-119 and 4.1-206.3) predate this normalizer. Their
pins were moved to the normalized form of the same bytes, keeping the 2026-10-07 retrieval time, after
checking that a fresh download normalizes to the same hash.

## Verified reproduction (2026-10-06)

A clean clone at commit `15a2bec`, installed from `requirements/dev.lock` on Python 3.13.7 (Windows 11),
downloaded every input from the original hosts and ran
`build --manifest dist/0.1.0-preview/manifest.json`, validate and export. Result: the same build ID
(`preview-2dafb5cc8a58`), 0 validation errors, and 16 of 18 exported CSVs byte-identical to the release,
including `observations`, `preferred_observations`, `lineage` and `policy_exposure`. The two that
differed were `build_info.csv` (build timestamp) and `source_assets.csv`, where only the
`acquisition_status` of the two DABS reports changed (`acquired` -> `pinned_not_local`, because
abs.utah.gov refused the second download).

The first attempt at this test, before the normalizers existed, failed: the BLS and Tennessee pins could
not be matched by a fresh download. That failure is why the normalizers exist.

## Hosts with incomplete certificate chains

le.utah.gov does not send its intermediate TLS certificate. The fetcher verifies certificates against the
operating system's trust store (via `truststore`), which completes the chain on Windows and macOS.
Verification is never disabled. On Linux the system store may not fetch the missing intermediate; if the
Utah legislature downloads fail there, download those pages in a browser and use `import-asset`.

## What is deterministic

- From the same pinned inputs and code, every CSV is byte-identical except `build_info.csv` (it records
  the build time). `tests/test_fixture_build.py` checks this.
- Parquet files and the DuckDB database carry writer metadata and are not guaranteed byte-identical;
  their table contents are identical (also tested).
- Release zips use fixed timestamps and sorted file order.

## Tests

```bash
python -m pytest
```

Tests run offline on small real slices of the sources (`tests/fixtures/`, regenerated with
`python tests/fixtures/make_fixtures.py` after a fetch) and on `config/builds/fixture.yaml`, which builds
the whole pipeline without network access or secrets.

## Full local verification

Before committing a change, run every repository check against the pinned data already in `data/raw/`:

```text
scripts\verify.bat          (Windows: uses .venv\Scripts and npm on PATH)
bash scripts/verify.sh      (Linux or macOS: uses alcohol-data, python and ruff on PATH;
                             override with ALCOHOL_DATA=..., PYTHON=..., RUFF=...)
```

Both run the same 21 steps in this order and keep going after a failure: `build`; `validate --profile release`;
`officials check`; `sources audit`; `report coverage`, `completeness`, `policy-coverage`, `descriptive` and
`dictionary`; `legal review-packet-utah`; `export`; `dashboard export`; `python -m pytest`;
`ruff format --check src tests`; `ruff check .`; `npm test` and `npm run build` in `web/` (the build runs the type
check first); `npm run export:grocery-wine` and `npm run export:tennessee`; and
`scripts/grocery_wine_alternatives_check.py`, which recomputes every alternative and every price-and-share cell
independently; and `scripts/grocery_wine_flows_check.py`, which recomputes every purchase-flow scenario, grid point,
break-even and sensitivity row (`wine-purchase-flows@1.0`) from `flows.json` with its own closed forms.

Each run writes its own log, never overwritten: `data/processed/verify/verify-windows-<yyyyMMdd-HHmmss>-<random>.log`
(`verify-posix-<YYYYmmdd-HHMMSS>-<pid>.log` on Linux or macOS). It records the revision, the working tree at the start
and the end (`git status --short`, which shows any tracked file the report steps rewrote), tool versions, start and end
times, an `exit=` line after each step and a final `=== exit N`. When the run ends, a copy goes to `verify-windows.log`
(`verify-posix.log`), the latest run; while a run is in progress that file says so. The script ends with "All steps
passed" or the list of failed steps (exit code 1). It does not fetch, does not run `npm ci` (run `npm --prefix web ci`
first when `web/package-lock.json` changed) and changes no code.

Formatting is checked on `src` and `tests`, as in the pull-request workflow: `scripts/age_adjusted_fars_check.py` has
never been formatted, so `ruff format --check .` fails on it. The scripts replace `verify-2026-10-11.bat`, which sat
outside the repository and omitted the report, review-packet and export steps.

On Linux the build needs about two minutes and pytest about two; a shell that limits each command's run time can run
the same steps in turn. Record which system ran the checks: a Linux run does not check the Windows `.venv`.

## The grocery-wine graph package

The graphs and data in `../../graphs and data` (outside this repository) are drawn from the two exports by
`scripts/grocery_wine_graphs.py`, which needs matplotlib and numpy. The project's `.venv` has neither; on the
maintainer's PC ParaView 6.1.0's bundled Python has both, so nothing has to be downloaded. Both commands run from any
folder; in PowerShell a quoted path needs `&` in front (replace `<repo>` with this checkout's full path):

```text
& "<repo>\scripts\verify.bat"
& "<repo>\scripts\grocery_wine_package.bat"
```

`verify.bat` rebuilds the dataset and writes both exports. `grocery_wine_package.bat` then runs, in order and stopping
at the first failure, `scripts/grocery_wine_graphs.py`, `scripts/grocery_wine_deck_figures.py` (the deck's figures and
`numbers.json`) and `scripts/grocery_wine_bundle_docs.py` (data dictionary, source and assumption register, dataset
list); it takes the package folder as an optional argument. Each step can also be run alone from the project folder,
for example `& "C:\Program Files\ParaView 6.1.0\bin\pvpython.exe" -B scripts\grocery_wine_graphs.py "..\..\graphs and data"`.

The script reruns the hand examples, the price-and-share check and the purchase-flow check, computes every title from
the data (`scripts/grocery_wine_chart_text.py`), writes each graph as a PNG and a PDF with the exact values it drew
(`graphs/<chart>.csv`, read back from the figure), draws the purchase-flow charts F1-F11
(`scripts/grocery_wine_flow_graphs.py`), writes `manifest.json` and `manifest.csv` (chart, data files, model,
configuration, commands), copies the data files, runs an automated
check for overlapping or clipped text (not a visual review), and writes `provenance.json`: revision, working-tree
status, a hash of uncommitted changes, dataset build, input pins, export metadata and plotting versions. It overwrites
files by name and leaves the package's README and `archive/` alone. Look at every graph after a change; the automated
check has passed graphs whose labels collided.
