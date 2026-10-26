# Research dashboard

A local, read-only dashboard over the canonical dataset. It opens on **Start here**, which asks which
question you want to answer and opens one of the analysis tools with inputs filled in that you can change.

## Analysis tools

| Tool | Address | What it does | Method |
|---|---|---|---|
| **Start here** | `?v=start` (the default) | Four questions: what changed after a state allowed grocery-store wine; which states compare with Utah; how revenue and consumption compare across states (a short form that opens Explore); what assumptions mean for Utah's wine revenue. Below them, "The whole country at a glance" opens Utah at a glance, the Map, Beer, wine & spirits and Revenue by state. Lists analyses saved in this browser. | none |
| **Utah at a glance** | `?v=utah` | One page: how Utah sells alcohol (its verified liquor-control arrangement, with dates and sources); Utah's latest value on 13 measures with the comparison year, its rank among the states with a value for that year, definition and form, the U.S. value and Utah's first and latest values with a small trend line; nine candidate comparison states (the finder's top five at its default settings, plus Virginia, Pennsylvania, Idaho and Oregon, whose governments also wholesale spirits), each with why it was chosen, how it differs and what the dataset cannot yet say; a chart of Utah and the top candidates; "Why Utah's liquor-sales figures differ", a year-by-year bridge from DABS's sales to Census's receipts and the audited fund's sales (statutory deposits, residual, evidence status per statement, sources, a residual chart, FY2024 on its own, the sales-tax basis by series, the deposit rates by fiscal year, and Utah beside Pennsylvania's audited State Stores Fund for FY2023-FY2025); links into the detailed tools and two saved starting points. Prints as a report. | `web/src/lib/glance.ts` for ranks; the bridge `utah-liquor-bridge@1.0` (`src/alcohol_data/fiscal_bridge.py`, `web/src/lib/reconcile.ts`); with rank ranges (`rank-intervals@1.0`, `web/src/lib/ranks.ts`); candidates from `rankCandidates` in `web/src/lib/finder.ts` (`comparison-finder@1.1`) |
| **Before & after** | `?v=change` | Window averages before and after a change date for a state and up to five comparison states, the change and percent change, a descriptive difference in changes, pre-period trends and what those trends alone would give, an annual chart marking the change, an optional event-time chart, and every value considered with why it was or was not used. Verified dates are offered from the coded law; a typed date is labelled an assumption. First example: Tennessee, 2016-07-01. | `before-after@1.2`, `web/src/lib/change.ts`; standard errors from published intervals, `stats-helpers@1.1` |
| **Find comparison states** | `?v=finder` | Ranks states by similarity to a target state in baseline years, on characteristics the reader picks (population, income, drinking, binge drinking, wine and all-alcohol consumption, alcohol taxes per adult, state liquor-store receipts), with weights, minimum coverage and policy exclusions. Every score shows the values behind it. With a change date, the baseline must end before it. Optionally compares liquor-control arrangements over the baseline (section 4): mark each candidate, leave out those verified to differ, or rank only those verified to match and list the ones that cannot be assessed. Candidates can be sent to Before & after, Explore or Compare. | `comparison-finder@1.1`, `web/src/lib/finder.ts`; liquor control `web/src/lib/control.ts` |
| **Utah revenue scenarios** | `?v=scenario` | State revenue from wine today and if some purchases moved to grocery stores (scenario A), optionally with extra purchases and beer substitution (scenario B). Sourced and derived inputs (DABS sales, gross margin, expenses; NIAAA gallons and alcohol content; Utah's coded beer excise) are labelled; everything else is the reader's assumption and is requested, never filled. Ways for the state to collect on grocery wine include DABS staying the wholesaler at a discount (1.2). Scenario A step by step, with the school-meals and enforcement deposits shown as today's allocation of the margin that moves; break-even values (scenario B's including any price response); sensitivity with the value at which each assumption would reverse the sign; CSV and print. One worked proposal (grocery wine with DABS as wholesaler) opens from the page with every assumption stated. Section 6 (2026-10-14) compares three arrangements on the same inputs, with a worked comparison for FY2025 (below, "Comparing arrangements"). | `utah-wine-scenario@1.4`, `web/src/lib/scenario.ts`; arrangements `utah-wine-arrangements@1.0`, `web/src/lib/arrangements.ts`; ranges `scenario-ranges@1.2`; statutory wine margin `wine-margin@1.0`; exploratory cost evidence `store-cost@1.0` (`cost_model.json`) |

Rules the tools keep:
- **Before & after.** Each value is placed by its own period dates (before, after, or straddling the date),
  so fiscal years keep each state's boundaries. The year the law changed part-way through is left out of
  the averages unless the reader counts it as after. Missing years are never filled; by default every
  state's averages use the same years and dropped years are listed. With each state's own years, no
  difference between states is computed. No change is computed across a definition change. A percent
  change needs a positive before average.
- **Find comparison states.** Baseline value = average over the baseline years within one comparability
  group, needing at least half the years. Each characteristic is scaled to standard deviations across
  states (population on a log scale). Score = root of the weighted mean of squared differences, by default
  with the characteristics decorrelated (Mahalanobis, shrunk toward independence). Candidates
  are ranked first by how many characteristics they lack, so missing data never looks like a match.
  Outcomes after a change are never used. Results are candidates, not validated controls.
- **Liquor-control comparison** (Map, Revenue by state, the finder, Utah at a glance). Four dimensions
  are kept apart: who wholesales spirits, who wholesales wine, who sells spirits to take home and who
  sells wine to take home. A criterion names the values that count (for example state-run stores, state
  contract agencies or both, for "the state sells spirits at retail"), or asks for the chosen state's own
  values on all four. A state's value counts only when coded law is verified on every day of the period
  (days after the build's as-of date are never verified); a change inside the period, partial coverage or
  no history makes the verdict "cannot be assessed", never a match or a mismatch. The chosen state must
  itself be verified. A dated current-law snapshot is shown beside an unknown verdict ("current law
  matches, dated ...") and never decides it. The chosen state is never counted as its own match. Each
  view says how many states were verified to match, verified to differ and could not be assessed.
- **Utah at a glance ranks.** The comparison year is Utah's latest year with a value. A state is ranked
  only with a value for that same year, in the same comparability group and the same form (as published
  or per resident); rank 1 is the highest value and equal values share a rank. States whose latest value
  is later, or whose value for the year has another definition, are left out and counted, never compared
  across years. No rank is given with fewer than two states. The nation is never ranked.
- **Utah revenue scenarios.** State-store money enters as gross margin, never gross sales; operating costs,
  new licensing costs and DABS's net profit stay separate (net profit is shown, not added). DABS's
  "sales tax" line is not used (its scope is unresolved). DABS's annual sales are before sales tax by DABS's
  own Note B (saved FY2016, FY2019 and FY2021 reports). That note says nothing definite about the monthly
  reports' gross sales, whose tax basis stays unresolved, and the scenario does not use them. The audited
  figure's lower sales leave out the school-meals deposit (documented) and the enforcement deposit (inferred;
  docs/fiscal-reconciliation.md). Scenario A's step-by-step table shows the school-meals and
  enforcement deposits at the base year's statutory rates as today's allocation of the margin that moves ("of
  which" rows, never subtracted again); the net change counts all state funds together, and who receives it
  depends on how the law would treat the new arrangement, which the scenario does not decide. Scenario A
  moves existing purchases; scenario B adds only extra purchases; beer replaced by extra wine takes its
  excise and sales tax with it, holding spending, volume or pure alcohol constant as chosen. No health outcome is inferred. Example values are
  labelled as illustrations wherever they appear.
- **Uncertainty (2026-10-12).** Intervals, rank ranges, placebo checks and scenario ranges follow
  docs/methods/statistical-approximations.md: an interval covers only what the published intervals cover
  (sampling error for surveys, chance variation in the count for FARS), years and states are treated as
  independent, and the scenario tool reports sensitivity scenarios, never probabilities.

Every tool's results panel gives the question, the inputs, charts, a numerical table, the method, sources,
coverage and the limitations of that result, and has **Save, share or print**: a link, a saved copy in this
browser, an analysis file (inputs written out in full, the build ID, the method version and a snapshot of
the results, observations and assumptions kept apart), a results CSV and a print layout. Restoring a
saved analysis made with another build says so.

### Utah revenue scenarios: which inputs are sourced (assessed 2026-10-14)

After the fiscal reconciliation (docs/fiscal-reconciliation.md), each input was checked for whether it could move
from the reader's assumption to a sourced or derived default. No default changed and no URL parameter was renamed,
so links, saved copies and analysis files restore as before; a value the reader types still replaces every default.
Later the same day the method became `utah-wine-scenario@1.2`, adding the wholesale arrangement (`rm=wholesale`,
`dc=` the discount), the step-by-step table, the break-even lever and the sign-change column; results for inputs
saved under 1.1 are unchanged (a restored 1.1 analysis says that the method differs). Method 1.3 (2026-10-14) lets a replacement tax reach the
shelf price (`taxToPrice`, used by the arrangement comparison); omitted, results are those of 1.2. Method 1.4 adds a
straight-line demand curve as an alternative to constant elasticity (`demandForm`); omitted, results are those of 1.3.
Method 1.5 (2026-10-15) lets only household purchases move (`hh=`, the household share of wine sales; `eligible` in the
model) and adds matched consumer prices (`matchPrice`). A blank household share now takes DABS's off-premise share of
all its sales (82%, FY2025 report p. 18), so an analysis saved before 1.5 restores with a smaller amount moving and a
smaller result; entering 100 reproduces the earlier figures. The arrangement comparison became
`utah-wine-arrangements@1.1`: a price case (`pc=matched` or `pc=entered`; addresses without it keep the entered price),
what sellers keep and the price at which the state and sellers both hold (`gw=`, `gg=`, the gross margins a private
wholesaler and a grocer need, assumptions), the exploratory return-to-state-stores case labelled as such, and two
guarantee proposals (`er=fixed` or `er=proportional`; the older `er=today` reads as fixed).

| Input | Treatment | Source, year, units, basis | Why |
|---|---|---|---|
| DABS liquor sales (`fy`) | sourced default (unchanged; label corrected) | DABS annual report, the chosen fiscal year, dollars; before sales tax (Note B of the saved reports) and before the two statutory deposits | The audited and Census figures are lower by the deposits (school meals documented, enforcement inferred), not by tax; the label now says so instead of "unconfirmed". |
| School-meals and enforcement deposits | derived, shown in the results only | `metadata/legal_history/utah_liquor_deposit_rates.csv`: 10% and 1.695% for FY2024-FY2026 (documented, read online), percent of total gross liquor revenue | Tells the reader how much of the margin that moves was going to the Uniform School Fund and the enforcement fund. A split of the margin, not a new cost: totals are unchanged. |
| Gross margin on wine (`gm`) | derived default (unchanged) | statutory wine markup, `wine-margin@1.0` | Already derived; the reconciliation does not change it. |
| Wine gallons, wine and beer alcohol content | sourced defaults (unchanged) | NIAAA, calendar year | Unchanged. |
| Utah beer excise (`bt`) | sourced default (unchanged) | coded statute | Unchanged. |
| Wine's share of DABS sales (`ws`) | entered; one click offers DABS's monthly-report share | DABS Sales Analysis Reports, one fiscal year, share of gross sales at shelf prices | A ratio of two series on the same basis, but for a different fiscal year from the annual sales; the reader decides whether it applies. |
| State sales tax rate (`st`) | entered; one click offers the pinned state rate | Utah State Tax Commission Publication 25 (pages marked draft), percent | The state portion only; which state-store sales bear sales tax, and at what combined rate, is not established in this dataset. |
| Avoidable operating cost (`vc`) | the reader's assumption; the exploratory cost regression is shown beside it, never filled in | none | Total operating expenses and the exploratory regression do not identify marginal savings. Pennsylvania's audited operating expenses describe a different system and are not used. |
| Household share of wine sales (`hh`, 2026-10-15) | sourced default for all products, applied to wine as an assumption | DABS annual report FY2025, p. 18, "On-Premise vs. Off-Premise Sales": off-premise 82% (whole percents, all products; dollars or volume not stated) | Only purchases for home could move; licensees keep buying from DABS. No wine split is published (records request C drafted, not sent). |
| New state costs, share moving, grocery price, pass-through, how the state keeps revenue, extra purchases, elasticity, recapture, beer substitution and beer price | the reader's assumptions | none (the elasticity help cites Nelson 2013 without filling it) | Behavioural or policy choices that no reconciled fiscal source settles. |

Sensitivity scenarios stay free of probability statements; Monte Carlo stays hidden.

### Comparing arrangements (2026-10-14)

Section 6 of the Utah revenue scenarios (`cmp=1`) answers one practical question: which ways of letting grocery stores
sell wine could keep Utah's state revenue at today's level, and which assumptions decide it? It is a compact panel in
the existing tool, not a separate application, and it reuses the scenario model, its inputs, its sensitivity ranges,
its CSV, print and saved-analysis paths.

The three arrangements are proposals, not current law:

| # | Arrangement | What the state gives up and collects | Lever |
|---|---|---|---|
| 1 | Private retail with a replacement tax: grocers buy from private wholesalers | The whole gross margin on the wine that moves; collects a tax on the grocery price before tax (or an excise per gallon) plus ordinary state sales tax on the shelf price; also stops the wholesaling (`vw`, blank = none) | the tax (`rt`, `rtv`); its share in the shelf price (`rtp`, blank = all) |
| 2 | State wholesale, grocers retail | DABS sells to grocers at its shelf price less a discount: its receipts and the cost of the wine are shown apart, and the grocer's margin (shelf price less what it pays DABS) apart from the state's; the retail markup does not survive | the discount (`dc`) |
| 3 | Arrangement 1 or 2 (`eb`) with an explicit allocation to school meals and enforcement | The same total; the allocation (today's amounts, a fixed sum or a share of the proceeds: `er`, `ea`) decides which funds bear it, and a guarantee above the proceeds is a funding requirement on other state money | none of its own |

Rules it keeps:
- **One baseline, one scope.** Every column uses the same base year, wine sales, margin, sales tax, costs, share moving
  and grocery price. Both sides count state government revenue only (the gross margin, the state's sales tax, the
  replacement tax or wholesale margin); local sales tax is not modelled, so local and combined revenue are not shown.
- **The baseline and its standing.** A table gives each figure's source, year, units, coverage and standing: DABS's
  liquor sales (before sales tax by Note B; all customers, licensees included), the wine share (FY2026 monthly
  reports), the derived wine sales, the all-product margin (applying it to wine is an assumption), the operating
  expenses (context), the audited fund's sales (a cross-check, never an input: FY2025 matches DABS's sales less both
  deposits within $0.08 million), the sales tax rate (Publication 25, draft pages), the deposit rates (law, read
  online) and the monthly gross sales (left out: tax basis unresolved). FY2025 is the recommended base year; FY2023 and
  FY2024 carry a caution (the unexplained gap, and two FY2024 DABS sales figures).
- **Purchases.** The comparison starts from the channel shift (scenario A: total wine bought unchanged), then adds each
  purchase change entered in section 5 on its own (price response, cross-border recapture, easier access) and all
  together. The model is additive in them, so the parts add up to the whole (tested), and a volume table reconciles
  today's purchases, the shift and each change to the modelled total by channel. Beer substitution is left out of the
  comparison and its two bases (spending, pure alcohol) are described instead.
- **Prices.** In arrangement 1 the tax can reach the shelf price (method 1.3 of the scenario model: `taxToPrice`; the
  tax on the price is levied on the price before it); with an elasticity, a higher price lowers what is bought.
- **Break-even.** Each arrangement's own lever at which state revenue is unchanged, with the purchase changes entered
  (including the price response) and, beside it, for the channel shift alone. Arrangement 1's is solved numerically
  (`solveLever`: a fine scan and bisection) because a tax that raises the price is not linear in its effect; when no
  value in the supported range (a tax up to 100% of the price, an excise up to the state-store price per gallon, a
  discount up to the gross margin) breaks even, it says so and gives the best value reached, never an extrapolation.
  Arrangement 3 also gives the lever at which the proceeds just cover its allocation.
- **What can reverse the result.** One assumption at a time, from the sensitivity ranges: which reverse the sign
  inside their documented range, and at what value the others would. A chart shows the net change of arrangements 1 and
  2 across one chosen assumption (`sx`: avoidable cost, share moving, grocery price, margin, elasticity, or either
  lever), with the entered value, the crossings and, for avoidable cost, DABS's all-expense share as an accounting
  ceiling. Ranges are not probabilities; Monte Carlo stays hidden.
- **Corrected and extended 2026-10-14 (night), after an audit** (docs/review/grocery-wine-model-audit.md): arrangement 3
  is shown in both cases (channel shift only, and with the purchase changes) instead of mixing them, with what its
  guarantee is and the statement that a guarantee redistributes a loss without removing it; a price build-up gives each
  arrangement's shelf price from the cost of the wine (cost, state margin, private margin, replacement tax and its base,
  sales tax; markups on cost apart from margins on price); the price response can also be read as buyers returning to
  state stores (the share moving falls; no wine is lost), because the model otherwise holds the share fixed while
  grocery wine costs more than the same wine in a state store; break-even taxes are also given for a straight-line
  demand curve, with a caution when the tax lies far beyond the price changes behind the elasticity; a joint-scenario
  table moves several assumptions together (documented bounds from DABS's own expense lines and margins, exploratory and
  arithmetic-only rows kept apart, the policy levers as entered); the one-at-a-time reversals say they are one at a time;
  a table says what the model does and does not represent (moving purchases, price response, beverage switching, total
  ethanol, access, cross-border) with the evidence for each.
- **The worked comparison** (`eg=compare_fy2025`) states every part: FY2025 baseline, 30% of purchases move, grocery
  price before tax equal to the state store's, a 20% replacement tax all in the price, a 20% discount, 5 cents of
  avoidable cost per dollar, $500,000 of new costs, the published elasticity −0.46, no recapture or access effect, and
  arrangement 3 guaranteeing today's amounts from the replacement tax. Its results are kept as they fall: both
  arrangements lower state revenue under these assumptions. Its source values and legal readings are in
  docs/review/utah-grocery-wine-comparison-packet.md.

## Data views

The data views show everything the tools use:
- every state at once (**Map**, `?v=map`): a measure, year or month, beverage and form (as published, per
  resident, per resident 21+, constant dollars, or the percent change since a chosen year) drawn on a U.S.
  map, a ranked bar list and a table, all built from one list of rows, so they cannot disagree. Missing,
  suppressed and reported zero each have their own fill. An optional liquor-control criterion outlines the
  states verified to match for the period mapped and fades the rest, or lists only the matches. Clicking or pressing Enter on a state opens its
  value, rank, trend with Utah and the U.S., grocery-wine status for that year, sources and limits, and links
  into Before & after, Explore and Compare. Downloads: CSV and PNG. Details below, "Map";
- beer, wine and spirits side by side (**Beer, wine & spirits**, `?v=beverages`): NIAAA pure alcohol per
  resident 21+ for a state, an optional second state and the U.S., three panels on one scale, each
  beverage's share of the three, and, for Utah only, what the state liquor stores sold by beverage and month
  (DABS) with the same-month change from a year earlier and a for-scale comparison with NIAAA's volumes;
- revenue components for every state (**Revenue by state**, `?v=fiscal`): alcohol taxes, license fees,
  state liquor-store receipts, state-store profit to the General Fund and residents' take-home alcohol
  spending, one column each and never added, with each state's liquor-control arrangement for the fiscal
  year shown (verified history where it exists, otherwise current law with its date and "history not
  verified"), an optional liquor-control criterion, and why a state without liquor stores still collects
  alcohol revenue. Census state liquor-store receipts run to FY2024 (FY2016-FY2024 from the Individual Unit
  Files, parsed 2026-10-13); a state government with no liquor-store item shows "—", never zero;
- what the dataset holds and what is missing (**Coverage**);
- any question the data can describe (**Explore**): up to four measures, six jurisdictions and any span of
  years, shown as published, in constant dollars, per resident or as an index. Each measure gets its own
  chart. A coded policy can be shown underneath as its verified status by calendar year; a dated snapshot
  is listed only in its own year;
- coded law over time (**Policy timeline**). Pick any catalogued policy dimension and any jurisdiction.
  States known only from dated snapshots are drawn as unknown, with a marker on the snapshot day. Each
  snapshot shows whether its text names the outlet type, only creates a general license, or implies the
  status;
- every state against every coded policy (**Policy matrix**), read one of two ways that are never mixed:
  the verified status on one chosen day, or the latest dated snapshot in each cell with its own date;
- states side by side (**Compare**);
- fiscal and consumption series for one state (**Revenue over time**);
- where every value comes from (**Sources**);
- who held office and sat on which committee, from a cleaned Open States snapshot (**Officials &
  committees**, `?v=officials`; docs/research-dashboard/officials.md). Utah and "current in this
  source" by default; former officeholders are kept, apart, for history. A reference list only: it
  links no one to a law without a recorded bill and source, and it is not a score or an outreach list.

There is also a worked grocery-wine example, a definitions page and downloads.

**Map.** Rules, each tested in `web/src/lib/mapdata.test.ts`:
- One color scale for every year or month of a measure, unless the reader ticks it off or maps a change.
  Where at least 100 values share the scale, it stops at the 95th percentile of the size of changes (a
  diverging scale, symmetric around zero, orange for falls and blue for rises) or at the 2nd and 98th
  percentiles of levels (one blue hue: darker is higher, which the legend says is not by itself better or
  worse). Values beyond an end take the end color, keep their true label, and the legend marks the end
  with ≤ or ≥.
- Ranks count only states with a value; equal values share a rank; states without one are listed after,
  with the reason.
- A change map is percent change between two years of one state's own series, undefined from a zero or
  negative base and blank across a definition change. A state whose series moves 50% or more in one year
  inside the span is marked †, with the years, because such a move often reflects what the source counts.
- Small Northeastern states are labelled to the side with leader lines; every state is a focusable control
  with its value in its name, and a live region repeats the value of the state pointed at or focused.
- Bar lengths fit the period shown; colors follow the map's scale.

**Sources on every chart.** The Map, Beer, wine & spirits and Revenue by state views put a "Sources:" line
under each chart and table, linking each publisher's own page and its files in the Sources view. The line
is worked out from what is drawn (`web/src/lib/sources.ts`, tested): the measure's own files; for a value
this project derives (rates per 100,000, fiscal-year sums), the publishers of its inputs, never the project
itself; and for a per-person or constant-dollar form, the Census population or BLS price series it uses. The
same line heads every CSV download and is printed, with the legend, under the map image (PNG). Each state's
details show the file and location of its own value.

**Saved analyses.** An Explore selection lives in the address bar, so a link reproduces it. Three kinds
of saved analysis reopen one:
- worked-example panels. Each chart of a worked example is a saved analysis; the example draws the chart
  from the same specification (`web/src/lib/analysis.ts`), so Explore shows exactly what the example
  shows;
- starting points in `config/dashboard/analyses/*.yaml`. Each is a selection with its question and what it
  cannot show. It states no finding: findings belong in a worked example, tied to checked claims. The
  export checks every id, conversion and year against the build and refuses a `shows` list;
- selections saved in this browser (local storage, this computer only) or downloaded as a JSON file. A
  file opened in a later release keeps what that release holds and names what it dropped.

It is descriptive. It does not estimate effects or forecast revenue, and it is not deployed anywhere.

Other documents in this folder:
- [repository-audit.md](repository-audit.md): what existed before the dashboard, and the choices made.
- [case-study-selection.md](case-study-selection.md): why Tennessee 2016, and the comparison shortlist.

## Commands

Run these from the repository root unless noted. Python steps assume the virtual environment from the main
README.

| Task | Command |
|---|---|
| Build the database (once, or after data changes) | `alcohol-data build` |
| Validate the data | `alcohol-data validate --profile release` |
| Regenerate the dashboard data | `alcohol-data dashboard export` (writes `web/public/data/`, git-ignored) |
| Install the web dependencies (once) | `cd web && npm ci` |
| Run the dashboard | `cd web && npm run dev`, then open http://127.0.0.1:5317 |
| Web tests and type check | `cd web && npm test && npm run typecheck` |
| Python tests | `python -m pytest` |
| Static build (optional, local only) | `cd web && npm run build` (writes `web/dist/`; serve with `npm run preview`) |
| Refresh the comparison test vectors after changing `compare.py` | `python scripts/make_compare_vectors.py` |

**Two routes exist only on the development and preview servers. They are never part of the build output.**
- `/local-raw/<asset_id>` opens the cached copy of a source file. It works only for files whose rights
  allow redistribution: federal public domain, government edicts or open licences.
- `/release/<file>` serves the locally packaged release from `dist/<version>/`.

Restricted files are never served or copied. That covers the 1992 annotated-code volume, the DABS
reports and the Tennessee collection reports.

## How data reaches the page

```
pinned raw files ─▶ alcohol-data build ─▶ DuckDB (canonical)
                                             │
curated registers (data/curated/research/) ──┼─▶ alcohol-data dashboard export ─▶ web/public/data/*.json ─▶ React UI
case configs (config/dashboard/cases/) ──────┤
saved analyses (config/dashboard/analyses/) ─┘
```

- The Python export is the only producer of dashboard data. The UI never edits or re-derives a research
  value. Its arithmetic is limited to reader-chosen comparisons (percent change, index to a base year and
  window means, `web/src/lib/formulas.ts`), the descriptive tools above (`change.ts`, `finder.ts`) and the
  scenario arithmetic on the reader's stated assumptions (`scenario.ts`). Each has hand-checkable tests.
- Constant dollars and per-person values are computed in Python (`src/alcohol_data/dashboard/transforms.py`).
  They use the conventions of the canonical derivations, and a test pins them to the canonical T10 values.
- The comparison rules in `web/src/lib/compare.ts` are a port of `src/alcohol_data/compare.py`. They are
  tested against vectors that Python generates.
- Ordering is deterministic. Re-exporting unchanged inputs changes only the manifest's generation time
  (tested).

## Files the export writes (schema `dashboard-export@1.6`)

| File | Contents |
|---|---|
| `manifest.json` | Schema version, dataset release and build ID, the commit the database was built from, the commit exported from, generation time, the as-of date of the law, the source retrieval date range, row counts, and the SHA-256 of every file. Data retrieval dates are kept apart from export time. |
| `metrics.json` | One entry per measure × period kind, with definition, unit, beverage, age universe, fiscal component, accounting basis, overlap note, conversions available (or why not), the metric files holding a derived value's inputs, and fiscal-year rules. |
| `metrics/<measure>.<period_kind>.json` | Preferred observations, one per cell. Each row carries:<ul><li>value or missing reason;</li><li>coverage state;</li><li>extraction and review status;</li><li>comparability group and quality flags;</li><li>confidence interval and sample size (for FARS alcohol-impaired-driving deaths, also `realized_ci_low` and `realized_ci_high`: the interval for the deaths that occurred, from the imputation part alone; added in 1.4);</li><li>raw value and multiplier;</li><li>asset and locator, plus the PDF page to open;</li><li>input IDs and method, for derived values.</li></ul>The file also holds competing candidates that report a different value, and conversions with their inputs. |
| `coverage.json` | Coverage codes per metric (jurisdiction × year) and per family (value counts with explicit denominators). Policy cells come from verified days. |
| `policy.json` | Intervals, evidence (with page links), verified day runs, Utah ledger runs, snapshots, dependencies, exceptions and status vocabularies. |
| `sources.json` | Sources and held assets (rights, local availability, the records they support), source leads not held, and the local release bundle. |
| `research.json` | The ordered research queue (gaps) and the source leads. |
| `deflators.json` | CPI-U fiscal-year averages, the 2024 base and the monthly observations behind them. |
| `cases.json` | Worked examples from `config/dashboard/cases/*.yaml`. |
| `analyses.json` | Saved analyses (starting points) from `config/dashboard/analyses/*.yaml`, each checked against the build: measures, jurisdictions, years, conversion, policy dimension, question, notes and what it cannot show. |
| `monthly.json`, `monthly/<measure>.json` | Monthly series, kept out of `metrics.json` (whose files hold one value per year): Census MSRS percent changes, Utah DABS monthly gross sales and 9-liter cases by beverage, and Utah's state sales tax rate. The index lists each series' asset ids, so a chart can cite them. Each row: jurisdiction, period, value or missing reason, suppression flag, observation, asset, locator, review status and comparability group. A derived value with monthly inputs names them `monthly:<measure>` in its `input_metrics`. |
| `cost_model.json` | The exploratory Census store-cost regression (`store-cost@1.0`, `src/alcohol_data/store_cost.py`): sample, exclusions and, for 1- and 5-year changes under two weightings, the slope of store expenditure on store revenue with its clustered 95% interval and leave-one-state-out range. Shown beside the scenario's avoidable-cost input; never filled in. Added in 1.3. From 1.5 the sample stops at FY2015 (`sample.last_year_allowed`) and `extension_check` holds the same model with the later Census years added, as a comparison only (`store_cost.compare_extension`). |
| `reconciliation.json` | Why Utah's liquor-sales figures differ (`utah-liquor-bridge@1.0`, `src/alcohol_data/fiscal_bridge.py`, text in `config/dashboard/reconciliation/utah_liquor_sales.yaml`): the statutory deposit rates by fiscal year (`metadata/legal_history/utah_liquor_deposit_rates.csv`), a bridge row per fiscal year FY2012-FY2025 (DABS sales, the two deposits at the statutory rates and as DABS reported them, Census receipts or the audited fund's sales, the residual and whether it is within $0.15 million), findings with an evidence status (documented, documented read online, reconciles numerically, inferred, unresolved; no scores), the FY2024 investigation, the sales-tax basis by series, corrections, the Utah-Pennsylvania comparison and the documents read online. Every source reference is resolved against the registered assets, `data/curated/research/provisional_figures.csv`, the rate schedule and the research registers, and the export stops on an unknown one. Omitted when the build has no Utah DABS sales (fixture builds). Added in 1.6. |
| `map.json` | One SVG outline and label point per state, decoded from the pinned us-atlas TopoJSON (Albers USA, 975 × 610), with its citation. |
| `officials.json`, `officials/<code>.json` | The cleaned Open States People snapshot of 2026-10-08 (`officials@1`): the index (source, license, CITATION.cff authors, definitions, counts, policy enactment dates, committee register with subject relevance and referral status, unresolved memberships, issue counts) and one file per jurisdiction (records with roles, terms, districts, retained official links and committees with members). `status` is `current_in_source`, `ended_in_current_files` or `former_in_source`; e-mail and capitol offices appear only on `current_in_source` records. Every file says `review_status: not_reviewed`. |

## Contracts added for the dashboard

**Curated registers** (`data/curated/research/`, checked by the export and the tests):
- `research_gaps.csv`: gap ID, priority, category, title, affected measures, jurisdictions and years, why it
  matters, what it blocks, source leads, next action, access obstacle, status, owner, updated on.
  Categories follow the plan's order:
  1. missing fiscal pieces for the worked example;
  2. policy dates;
  3. comparison data;
  4. historical extension;
  5. review owed.
- `source_leads.csv`: sources not held. Each gives what was tried, when, and with what result, and what it
  would unblock. A source that cannot be fetched stays visible here.
- Dated snapshots of current law now live in `data/curated/policy_snapshots.csv` (database table
  `policy_snapshots`), built from `data/curated/policy_baseline/*.yaml`. They cover 47 jurisdictions (179
  snapshots) and include the 1992 Utah volume. A snapshot is never stretched into an interval.
- `policy_dates_overlay.csv`: operational (first-sale) dates, kept apart from legal effective dates. Where a
  date is unknown, the reason is recorded.

**Coverage states.**

| Code | Meaning |
|---|---|
| S | sourced (parsed from an official file) |
| D | derived |
| U | transcribed, unreviewed |
| R | reviewed |
| 0 | observed zero |
| C | conflict |
| W | suppressed by the source (withheld for privacy or quality) |
| M | missing, with another reason |
| N | not applicable |
| · | no record |
| – | not in this series |
| blank | outside the series' years |

For policy cells:

| Code | Meaning |
|---|---|
| K | known every day |
| P | partly known |
| ? | unknown |
| L | local option, adoption unknown |
| F | year not over |

Each is shown with a symbol and words, never color alone.

**Family denominators.** A metric counts toward a jurisdiction-year when the dataset has a row for that
jurisdiction in some year, and a row for some jurisdiction in that year. There is no percent-complete score.

**Locator convention.** "page N" is the Nth page of the file, so `#page=N` opens it. "printed page N" is a book's
own page number and is not linked to a file page. This was checked against the Tennessee chapter and the DABS
reports.

**CSV downloads.**
- UTF-8, CRLF line ends, RFC 4180 quoting.
- Text fields that begin with `= + - @` TAB or CR get a leading apostrophe. Number fields are never altered.
- A bundle holds `observations.csv`, `measures.csv`, `sources.csv`, `filters.json` and a `README.txt`
  explaining the joins.

**URL state.** Every filter and the open record (`rec=`) live in the query string. Values are validated, and
unknown values fall back to defaults. Back and Forward restore selections.

## Later verification

The statistical checkpoint and the FARS interval targets (2026-10-12) were checked on Linux and recorded in
docs/progress.md, with the checks not run (nothing under the Windows `.venv`).

## Verification record (2026-10-11, liquor-control comparison and Utah at a glance)

- `python -m pytest`: 277 passed; `npm test`: 110 passed; `npm run build` (type check and build) clean;
  `ruff check` and `ruff format --check` clean. Release validation: 0 errors, 2 warnings (229 hand-entered
  values and 23 intervals awaiting human review).
- Thirteen reintroduced bugs all failed their tests, among them a current-law snapshot deciding a
  verdict, partial coverage counted as a period's value, an unverified chosen state matched to the
  candidate, Utah ranked against other states' later years or other definitions, and a Utah interval
  widened past its verified days.
- No page scrolls sideways at 375 px, at 640 px (200% zoom) or with doubled text: Utah at a glance, the Map
  with two criteria, Revenue by state, the finder in two modes and Start here. The built site's text equals
  the dev server's on the same six pages; no console errors on a fresh tab.
- Utah at a glance printed to PDF from the built site: five pages, table headers repeated on each page, no
  row split across pages (a print rule added for this), the chart and starting points printed, inputs and
  navigation left out.
- Screenshots in headless Edge (the in-app pane draws charts at zero width while hidden); for phone widths
  use device emulation over CDP, because a headless window will not go below about 500 px.

## Verification record (2026-10-07)

**Automated checks.**
- `python -m pytest`: 176 passed. These include the dashboard export, conversions, provenance, the worked
  example's claims, and the Tennessee parser.
- `ruff check` and `ruff format --check`: clean.
- `npm test`: 27 passed (formulas, CSV safety, URL validation, comparison-rule parity, date placement).
- `npm run typecheck` and `npm run build`: clean.
- Release validation: 0 errors and 2 warnings, unchanged (228 unreviewed DABS values; 14 intervals awaiting
  human review).

**Interaction checks.** These ran in headless Edge over CDP, because the in-app pane could not draw. All passed:
- coverage loads real data;
- family and metric filters go to the URL;
- cells carry words;
- a cell opens its value, source, legal days and gaps;
- arrow keys and Enter select cells;
- Back and Forward restore the cell;
- invalid URL parameters fall back without errors;
- a timeline run opens the policy record with proposition, section, locator, review state and a PDF link at
  the cited page;
- Escape closes the drawer;
- a chart point opens its record (source, locator, hash);
- a filtered download saves a bundle;
- no uncaught errors.

**Spot check of the trail.** The downloaded constant-dollar value for Tennessee FY2016 (229,519,985.77) equals
the canonical derived value. Its record points to row 504, column T10, of the Census STC historical
workbook.

**Fixed during review.**
- A loading race could hand a view the previous selection's files, which crashed the Revenue view on first
  load. Data is now tied to the paths that requested it, and views sit behind an error boundary.
- Confidence bands were drawn across method breaks; they now break with the line.
- Overlapping policy labels on charts are now numbered and listed below each chart.
