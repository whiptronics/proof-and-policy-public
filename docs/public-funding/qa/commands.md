# Commands and results: baseline and final

Run on this PC (Windows 11, Git Bash) in the research worktree `alcohol-policy-revenue-data-devplan`, branch
`devplan/2026-11-19`. Machine-run; nobody has reviewed it.

## Setup

The worktree borrows the main checkout's virtual environment and raw cache:

```sh
cmd //c "mklink /J data\\raw ..\\alcohol-policy-revenue-data\\data\\raw"   # link the raw cache (removed before committing)
export ALCOHOL_DATA_HOME="$(cd ../alcohol-policy-revenue-data && pwd -W)"
export PYTHONPATH="$(pwd -W)/src"
PY=../alcohol-policy-revenue-data/.venv/Scripts/python.exe
```

## Baseline (before the Public Funding work, on `9986619`)

| Command | Result |
| --- | --- |
| `$PY -m pytest` | 432 passed |
| `cd web && node_modules/.bin/vitest run` | 544 passed |

## Final (2026-11-20, after the gap-closing pass)

| Command | Result |
| --- | --- |
| `$PY -X utf8 -m pytest -q -p no:cacheprovider` | 438 passed, 0 failed (432 + 6 in `tests/test_public_funding.py`). The project's `addopts = "-q"` hides the summary line, so the count is the result characters in the log. |
| `cd web && node_modules/.bin/tsc --noEmit -p .` | clean (exit 0) |
| `cd web && node_modules/.bin/vitest run` | 45 files, 589 passed (544 + 45 new across `publicFunding.test.ts` 43 and the wording test's two new cases) |
| `cd web && npm run build` | built; `FundingView` chunk 116.6 kB (34.6 kB gzip) |
| `$PY -X utf8 scripts/public_funding.py --check` | `publicFunding.generated.ts matches` |
| `$PY -X utf8 scripts/public_funding_audit.py` | 23 assets, 30 citations, 0 problems; exits 1 when a pin is corrupted (shown in memory, no file touched) |
| `cd web && npm run docs:framework` | no diff |
| `cd web && npm run brief:legislative` | PDF bytes changed, text identical page for page (pypdf), so the committed PDF was restored with `git checkout --` |
| `ruff check` and `ruff format --check` on `scripts/public_funding.py`, `scripts/public_funding_audit.py`, `tests/test_public_funding.py` | clean |
| `alcohol-data fetch --only usda_nslp_rates_sy2024_25 --only usbe_current_expenditure_per_pupil_fy2024` | both acquired and pinned (see [external-fetches.md](external-fetches.md)) |

## PPF-407 (Tennessee and Colorado, later the same night)

| Command | Result |
| --- | --- |
| `alcohol-data fetch --only tn_dor_alcoholic_beverage_taxes_page` | HTTP 403 from tn.gov's tax overview page; the asset was replaced by the manual below |
| `alcohol-data fetch --only tn_dor_alcohol_tax_manual_2025_06` | acquired and pinned, 832,628 bytes, sha256 0d82842bdb5e3193 |
| `alcohol-data sources audit` | registries for 45 sources / 450 assets |
| `$PY -X utf8 scripts/public_funding.py` then `--check` | written; `publicFunding.generated.ts matches` |
| `$PY -X utf8 scripts/public_funding_audit.py` | 41 assets, 48 citations, 0 problems |
| `$PY -X utf8 -m pytest -o addopts="" -q -p no:cacheprovider` | 438 passed (the drift test now also needs the Tennessee, Colorado and NIAAA files) |
| `cd web && node_modules/.bin/tsc --noEmit -p .` | clean |
| `cd web && node_modules/.bin/vitest run` | 45 files, 595 passed (589 + 6) |
| `cd web && npm run build` | built |
| Browser pane, `?v=funding`, text doubled two ways at 320, 375, 768 and 1280 px | no sideways scroll in any of the eight cases |

## Browser checks (Claude desktop app's browser pane, `vite preview --port 4371`, `?v=funding`)

| Check | Result |
| --- | --- |
| Text doubled two ways (root font-size 200%; body zoom 2) at 320, 375, 768 and 1280 px | no sideways scroll in any of the eight cases; `documentElement.scrollWidth` equals the viewport each time |
| Accessibility pass, contrast, focus | see [accessibility.md](accessibility.md) |
| Chart label overlap at 320 and 375 px | map axis fixed; remaining box overlaps checked by screenshot (accessibility.md) |

## Screenshots

Full-length PNGs from headless Edge (`msedge --headless --hide-scrollbars --window-size=W,H --screenshot`). The
system was in dark mode, so they show the dark theme. At 1.2 to 1.7 MB each they are kept outside the repository, in the session
notes folder `funding-screenshots/`:

| File | Width × height (px) | Bytes |
| --- | --- | --- |
| funding-320.png | 320 × 35,000 | 1,199,627 |
| funding-375.png | 375 × 31,100 | 1,328,419 |
| funding-768.png | 768 × 18,000 | 1,746,314 |
| funding-1280.png | 1280 × 13,500 | 1,632,974 |
| funding-1680.png | 1680 × 13,300 | 1,650,911 |

Heights were set from each width's measured page height; headless Edge lays the page out with a viewport that
tall, so the bottom can hold empty space. The earlier print PDF (`funding-print.pdf`, 15 pages) predates this pass.
