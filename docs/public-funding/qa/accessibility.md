# Public Funding page: accessibility pass (U04, U06, PPF-503)

Run on 2026-11-20 against the built page (`npm run build`, preview on port 4371, `?v=funding`) in the
Claude desktop app's browser pane (Chromium). This is a machine-assisted check of the DOM, the computed
styles and keyboard behavior. It is not a test with a screen reader in a person's hands, and nobody has
reviewed it.

## What was checked and what it found

| Check | Method | Result |
| --- | --- | --- |
| Every control has an accessible name | Every `input`, `select`, `textarea` and `button` in `main`: `aria-label`, an associated `<label>`, `aria-labelledby` or text | 0 unnamed (5 sliders, 14 selects, 22 radios, 2 checkboxes, 23 buttons). Sliders also expose `aria-valuetext` with the shown value. |
| Table headers | Every `th` has `scope`; condition and checklist rows use row headers | All 17 tables: every `th` scoped. |
| Table names | Every `table` has a `caption` | **Was 5 unnamed** (three chart data tables behind "Show the numbers", the stress test, the bill checklist). **Fixed**: captions added; the checklist's is visually hidden because its heading sits directly above. |
| Charts | `svg` role and name | All 3 charts are `role="img"` with an `aria-label`, and each has a data table behind "Show the numbers". |
| Live status | `aria-live` and `role="status"` regions | The destination panel is `aria-live="polite"`. **Added**: a visually hidden polite summary of the four conditions (state revenue with its dollar figure, shopper price, programs, grocer margin), so a change to any input is announced. Copy-link outcome is announced, including the fallback that reads the link out when the clipboard is refused (seen in the pane). |
| Focus after pressing (U03) | Real Enter key on the destination buttons, Reset and Copy share link, then `document.activeElement` | Focus stays on the pressed button each time; it never drops to `<body>`. The page has no dialogs or drawers (`dialog`/`role="dialog"`: 0); its five disclosures are native `<details>`, which keep focus on their `<summary>`. |
| Chart text color | Computed `fill` of chart labels | **Was a failure**: the page's SVG labels used a class with no CSS rule, so they rendered black (`rgb(0,0,0)`) in dark mode on a `#1d2024` panel. **Fixed**: `svg.chart .tick-label { fill: var(--text); }` in `web/src/styles.css`. Axis labels now measure 13.33:1 (dark) and 16.52:1 (light). |
| Labels crossing bars | Screenshot at 320 px, dark | **Was a failure**: "United States $17,619" on the state chart is drawn across the bars with no backing, so light text sat on light-blue bars. **Fixed**: `.tick-label` gets the halo the house `.row-label` uses (`paint-order: stroke`, 3 px `var(--surface)`), so the glyphs sit on the panel color. The map's cell symbols opt out (`stroke: none`): they pass without it, and the halo boxed them on the light theme. |
| Overlapping axis labels | Text bounding boxes per chart, then screenshots, at 320 and 375 px | **Was a failure**: the map's price labels ran together at 320 px ("−10%today+10%…"). **Fixed**: in narrow cells only every fourth column is labeled (today, +20%, +40%). Other box overlaps flagged by the measurement (destination names over their values, "UT" over "Lowest") are line-box overlaps; the screenshots show the glyphs apart. |
| Map symbols at narrow widths | Cell width at 320 px | **Was a failure (WCAG 1.4.1)**: cells are 12.9 px wide at 320 px, below the 22 px cutoff, so the symbols were dropped and the map said its result by color alone. **Fixed**: the symbols are always drawn, at 10 px in narrow cells. 117 of 117 drawn at 320 px; none overflows its cell. |

## Map contrast, composited

Each map cell is a fill drawn at partial opacity over the chart panel, so its color on screen is the fill
blended with the panel background (`--surface`: `#ffffff` light, `#1d2024` dark). The symbol is measured
against that composited color, not the token. Ratios are WCAG 2.x relative-luminance contrast.

Before (opacity 0.55, symbols black in dark mode):

The dark column was measured live; the light column is computed from the tokens with `--text` as the ink
(the actual black ink measured slightly higher), so light mode already passed.

| Mark | Light: symbol vs cell | Dark: symbol vs cell |
| --- | --- | --- |
| P (series-3) | 7.08 | 4.70 |
| R (series-6) | 7.58 | 4.92 |
| × and – (line-strong) | 9.92 | **2.49** |

After (opacity 0.4, symbols `var(--text)`), measured live in the page in both color schemes:

| Mark | Fill token | Light cell | Light ratio | Dark cell | Dark ratio |
| --- | --- | --- | --- | --- | --- |
| ✓ and ? | `--series-1` | 165,190,214 | 8.62 | (computed) | 5.78 |
| P | `--series-3` | 189,196,172 | 9.16 | 90,99,70 | 5.19 |
| R | `--series-6` | 208,197,164 | 9.58 | 107,97,66 | 5.00 |
| × and – | `--line-strong` | 215,215,217 | 11.51 | 61,65,70 | 8.36 |

The lowest is 5.00:1 (R, dark), above the 4.5:1 AA threshold for normal text. "✓" did not appear at the
inputs used for the dark-mode run; its fill is the same token as "?", and the dark value above is
computed from the tokens by the same formula (the live light-mode "?" value matched the formula exactly).

The cell fills themselves sit at 1.4–2.7:1 against the panel. They are not what carries the result: every
cell has a text symbol, the legend names each symbol, and the same rows are in the table behind "Show the
numbers". Status never relies on color alone (the house rule at the top of `styles.css`).

State bar chart (bars at 0.75 opacity): other states' bars 3.86:1 (light) and 4.73:1 (dark) against the
panel; Utah's bar is a different hue and also carries a "UT" text label, so it is not marked by color alone.

## The 0.6.2 palette

The figures above were measured with the palette of 0.6.0 and 0.6.1. Release 0.6.2 changed every color token
(the public-value mockup's palette, plus a Settings choice of Light or Dark). The same quantities, computed from the
new tokens by `web/src/lib/theme.test.ts`, which now fails if any of them drops below its minimum:

| Mark | Fill token | Light ratio | Dark ratio |
| --- | --- | --- | --- |
| ✓ and ? | `--series-1` at 0.4 | 8.88 | 5.08 |
| P | `--series-3` at 0.4 | 8.75 | 5.62 |
| R | `--series-6` at 0.4 | 9.78 | 4.90 |
| × and – | `--line-strong` at 0.4 | 10.14 | 6.36 |
| Other states' bars | `--series-1` at 0.75, against the panel | 3.15 | 4.19 |

The lowest is 4.90:1 (R, dark). The dark values apply both when the device is dark and when Dark is chosen in
Settings: the two copies of the dark tokens are checked to be identical.

## Not covered

- No run with NVDA, JAWS, VoiceOver or TalkBack. The live-region wording was read from the DOM, not heard.
- Forced-colors (Windows High Contrast) mode was not checked.
- The 200%-text sweep is in [commands.md](commands.md).
