# Audit of the grocery-wine comparison: inputs, equations, prices, demand and sensitivity

Done 2026-10-14 (night) by Claude for the project, on the worked comparison `compare_fy2025` in the Utah revenue
scenarios (`?v=scenario&eg=compare_fy2025`; `web/src/lib/arrangements.ts`, `utah-wine-arrangements@1.0`, on
`utah-wine-scenario@1.4`). It starts from docs/review/utah-grocery-wine-comparison-packet.md. **This is Claude's
verification, not human review**: no record changes status because of it, and the packet's review column stays
empty for Ethan.

**Corrected again on 2026-10-15** (section 11): only household purchases move, matched consumer prices are the
reference case with what sellers keep shown beside it, the return-to-state-stores reading is labelled exploratory, and
the guarantee is defined as two different proposals. The worked figures in sections 2 to 7 are those of 2026-10-14;
section 11 gives the current ones.

The aim is a defensible analysis, not an argument for grocery wine. Unfavourable results are kept as they fall, and a
negative result for one assumed arrangement is not a verdict on every grocery-wine policy.

## 1. What was wrong, and what was only unclear

| # | Finding | Kind | What changed |
|---|---|---|---|
| 1 | The headline and the last report quoted arrangement 1 with the price response (−$13.4 million) but arrangement 3's tax collections ($11.1 million) and its −$12.3 million from the channel shift alone. The arithmetic was right; the cases were mixed. | Incorrect presentation | Arrangement 3 is now computed and shown in both cases, side by side (`earmarked`, `earmarkedAll`); a test checks that each case uses its own figures. |
| 2 | The worked example holds 30% of purchases at grocers while grocery wine costs 20% more than the same wine in a state store, and reads the price response as less wine bought. With state stores still selling it, buyers could simply go back to them. Applying a market own-price elasticity to one channel's price is a mis-specification for this case. | Incorrect specification (in the example, not in the code) | Both readings are shown: fewer bottles bought (as before) and buyers returning to state stores (`channelReturn`: the share moving falls, no wine is lost). A price-parity case is in the joint scenarios. |
| 3 | "Nothing reverses either sign within its documented range" came from one-at-a-time tests and was reported as if it were a joint result. | Overstated conclusion | Narrowed to "one at a time" on the page and in the documents; a joint-scenario table was added (section 6). |
| 4 | "A 20% tax" without its base. | Unclear | Defined: a retail-level tax of 20% of the grocery price before the tax and before sales tax; sales tax then applies to the price with the tax in it. |
| 5 | What the $6.5 million guarantee is. | Unclear | Explained on the page (section 3 below): today's statutory deposits on the wine that moves, a proposed term, not current law; it redistributes the loss and does not remove it. |
| 6 | Avoidable cost compared with DABS's 14.9% expense ratio. | Unclear | The denominators match (shares of DABS's sales at state-store prices, before sales tax), but 14.9% is an all-product average with fixed costs and Parents Empowered in it; the page now shows the expense lines that could move with sales (2.3% to 9.8%). |
| 7 | The demand curve's form and range. | Unclear | Documented: constant elasticity (q = r^ε); a straight line with the same slope is computed beside it (scenario 1.4, `demandForm`), and the page says when a break-even tax lies far outside the price changes behind the estimate. |

## 2. The load-bearing inputs

Kinds: **observation** (a figure a saved source prints), **transferred estimate** (a published estimate from elsewhere
applied to Utah), **legal interpretation**, **scenario assumption**, **derived** (arithmetic on the others). FY is
Utah's fiscal year (July to June). "All products" means spirits, wine and heavy beer together.

| # | Input (value used) | Kind | Units, year | Coverage | Tax | Wine or all DABS | Finding |
|---|---|---|---|---|---|---|---|
| 1 | DABS liquor sales, 551,346 | observation (unaudited report, transcribed) | thousands of $, FY2025 | state stores, package agencies and licensees | before sales tax (Note B, five saved reports) and before the two deposits | all products | Matches the audited fund after both deposits within $0.08 million (cross-check, row 6). |
| 2 | Gross profit, 260,289 → margin 47.21% | observation → derived | thousands of $, FY2025 | as row 1 | before tax | all products; **applied to wine: an assumption** | DABS's margin ranged 45.5%-47.2% in FY2012-FY2025; wine's statutory minimum (88.5% on landed case cost) gives 46.95%. The FY2022 and FY2023 reports' Note A says 88%. |
| 3 | Operating and non-operating expenses, 81,910 (14.9% of sales) | observation | thousands of $, FY2025 | all operations, including Parents Empowered (3,630) | — | all products | Context only. The schedule of expenses (FY2025 report p. 30, now transcribed) splits it: card fees 1.52%, agency contracts 0.63%, bags 0.12%, delivery 1.05%, salaries 7.51% of sales. |
| 4 | Wine's share, 33.5% (33.536% computed) | derived from parsed monthly reports | share, **FY2026** | gross sales at shelf prices, all customers | ratio: one tax basis on both sides | wine over all products | A later year than rows 1-2; the monthly tax basis is unresolved but cancels in the ratio. |
| 5 | Baseline wine sales, $184,700,910 | derived (row 4 × row 1) | $, FY2025 | **includes restaurants' and bars' purchases** | before sales tax | wine | The share moving is applied to all of it, so 30% of it is more than 30% of retail purchases. No dataset splits DABS's wine sales by customer. |
| 6 | Audited fund sales, 486,942 | observation (audited) | thousands of $, FY2025 | fund's sales after both deposits | before tax | all products | Cross-check only; never an input. |
| 7 | State sales tax rate, 4.85% | observation applied to FY2025 (**assumption on applicability**) | percent | state portion only | — | — | Publication 25 pages are marked draft; local tax is not modelled on either side. |
| 8 | School-meals deposit, 10% of gross liquor revenue | legal interpretation | percent, FY2025 | all liquor sales | — | all products | Read online (§ 32B-2-304(5)), not reviewed. |
| 9 | Enforcement deposit, 1.695% | legal interpretation | percent, FY2025 | all liquor sales | — | all products | Read online (§ 32B-2-305(4), 2023 H.B. 223); DABS's FY2025 transfer is 1.741% of sales (not explained). |
| 10 | Deposits are inside the margin, never subtracted again | interpretation, supported by the accounts | — | — | — | — | School meals documented (paid out as a collection; the Income Tax Fund books it); enforcement: the collections paid equal both deposits within $6 thousand (FY2022) and $122 thousand (FY2024), $702 thousand off in FY2023; FY2025's line is school meals alone. |
| 11 | Price elasticity −0.46 | **transferred estimate** | — | market-level, many countries, 1954-2004 | — | wine overall | Nelson (2013), Table 4: −0.46 corrected for publication bias, 95% CI −0.38 to −0.54 (abstract −0.45; trimmed random-effects mean −0.58). No cross-price, no short- or long-run split. Applied here to one channel's price: see finding 2. |
| 12 | The arrangements are proposals | policy definition | — | — | — | — | None describes current law. |

Scenario assumptions that carry the result (no source; each is labelled on the page):

| Assumption | Value in the example | What it implies | Evidence or bound |
|---|---|---|---|
| Share of purchases moving | 30% of all DABS wine sales | ~$55.4 million of wine at state-store prices | none; see row 5 |
| Grocery price before the replacement tax | 100% of the state-store price | private wholesalers and grocers together keep 47.2% of the price, an 89% markup on the cost of the wine, the same as the state | exploratory alternatives: price parity (83.3%), and the sweep 70%-130% |
| Share of the tax in the shelf price | 100% | shelf price 120% of the state store's | none |
| Replacement tax | 20% of the grocery price before tax (retail level) | $11.1 million collected with the channel shift alone | a policy lever; break-even reported |
| Discount to grocers | 20% off the state-store price | grocer keeps 20% of the shelf price (a 25% markup on what it pays DABS); DABS keeps 27.2% (a 51.5% markup) | a policy lever; break-even reported |
| Avoidable store cost | 5% of the sales that move | $2.8 million a year | documented accounting band 2.3% (card fees, agency contracts, bags) to 9.8% (plus every salary); 14.9% is every operating expense |
| Wholesaling cost the state also stops (arrangement 1) | 0 | conservative against arrangement 1 | delivery to stores is 1.05% of sales; warehouse costs are not separated |
| New licensing and enforcement costs | $500,000 a year | — | none |
| Guarantee (arrangement 3) | today's deposits on the wine that moves | $6.48 million | a proposed term |

Allocations from aggregate figures to wine, all labelled as assumptions: the gross margin (row 2), the avoidable cost
(all-product expense lines), and the share moving applied to all DABS wine customers (row 5).

## 3. The equations, traced with the worked FY2025 figures

Let W = baseline wine sales at state-store prices before sales tax, m = gross margin, t = state sales tax rate, s =
share moving, S = sW, v = avoidable store cost per dollar moved, N = new costs. Dollars a year.

| Quantity | Formula | FY2025 example |
|---|---|---|
| Wine sales | W | 184,700,910 |
| What DABS pays for that wine (procurement) | (1 − m)W | 97,504,095 |
| State margin on wine (deposits inside it) | mW | 87,196,815 |
| State sales tax on wine | tW | 8,957,994 |
| Today's state revenue from wine | (m + t)W | 96,154,809 |
| Wine that moves | S = sW | 55,410,273 |
| Margin displaced | −mS | −26,159,044 |
| Arrangement 1: replacement tax | a · r₀ · S · q | 11,082,055 (q = 1); 10,190,533 with the price response (q = 1.2^−0.46 = 0.9196) |
| Arrangement 1: sales-tax change | t(r − 1)S, r = r₀ + τ · a · r₀ | 537,480 (r = 1.2) |
| Arrangement 2: DABS's receipts from grocers | (1 − d)S | 44,328,218 |
| Arrangement 2: what DABS pays for that wine | (1 − m)S | 29,251,228 |
| Arrangement 2: DABS's margin on it | (m − d)S | 15,076,990 |
| Costs avoided | vS (+ v_w S in arrangement 1) | 2,770,514 |
| New costs | −N | −500,000 |
| Net change, arrangement 1 | −mS + aS + t(r − 1)S + vS − N | −12,268,997 (−13,419,951 with the response) |
| Net change, arrangement 2 | −mS + (m − d)S + vS − N | −8,811,541 |
| Arrangement 3: guarantee | (10% + 1.695%) × S | 6,480,231 |
| Arrangement 3: other funds | net − (guarantee − today's deposits on S) | −12,268,997 (−13,419,951 with the response) |

Transfers between state funds are never counted as revenue: the deposits are part of mS and appear only as "of which"
rows; arrangement 3's guarantee moves money from the replacement tax to two funds, so the funds' change and the other
funds' change always add up to the arrangement's net change (tested). Sales tax is the state's portion, counted once.
"Net change" is revenue change plus cost change, the state's net fiscal effect, all state funds together.

## 4. Arrangement 3, both cases

| | Channel shift only | With the price response |
|---|---:|---:|
| Guarantee: school meals + enforcement | 5,541,027 + 939,204 = 6,480,231 | the same |
| Replacement tax collected (the proceeds) | 11,082,055 | 10,190,533 |
| Funding requirement on other state money | 0 | 0 |
| Left of the proceeds | 4,601,823 | 3,710,302 |
| Change for the two funds | 0 | 0 |
| Change for the General Fund and other funds | −12,268,997 | −13,419,951 |
| Total (= arrangement 1) | −12,268,997 | −13,419,951 |
| Tax at which the proceeds just cover the guarantee | 11.7% | 12.3% |

The guarantee is 11.695% (the FY2025 statutory rates) of $55.4 million, the FY2025 value at state-store prices of the
wine that moves. Utah Code §§ 32B-2-304 and -305 make DABS deposit those percentages of its own gross liquor revenue;
wine DABS no longer sells would not produce them under the current text (a legal reading, not reviewed). The
guarantee is the proposal's term. It keeps those two funds whole and moves the whole loss onto the General Fund and
other funds: it redistributes the loss and does not remove it.

## 5. Prices

The page now builds each shelf price up from the cost of the wine (per $1 of today's state-store price, before sales
tax, channel-shift prices):

| Component | Today | 1. Private retail (example) | 2. State wholesale (example) |
|---|---:|---:|---:|
| Cost of the wine | 52.8% | 52.8% (assumed: private wholesalers pay what DABS pays) | 52.8% |
| State margin | 47.2% | 0 | 27.2% |
| Private wholesale and retail margin | 0 | 47.2% | 20.0% (the grocer) |
| Replacement tax in the price | 0 | 20.0% (base: grocery price before the tax) | 0 |
| Shelf price before sales tax | 100% | 120% | 100% |
| State sales tax | 4.85% | 5.82% | 4.85% |

Markups are on cost and margins on the selling price: DABS's 47.2% margin is an 89.4% markup; the statute's 88.5%
minimum is a markup on landed case cost. The state's margin is counted once in each arrangement. State costs are in
the finance table; private wholesalers' and grocers' costs come out of their margins and are not modelled.

Is the equal-pre-tax-price case plausible? It needs private wholesalers and grocers together to keep the state's
whole markup and then add the tax, so grocery wine costs 20% more than in a state store, and still 30% of purchases
move. That is internally consistent arithmetic but a strong assumption about behaviour; it is kept, labelled. Two
alternatives are shown, both exploratory: price parity (the private chain absorbs the tax: a pre-tax price of 83.3%,
a 58% combined markup; net −$14.7 million, break-even tax 57.6% with the response) and buyers returning to state stores
(net −$11.3 million). Private retail is not assumed to be cheaper: no Utah figure says what private margins would be.

The model's replacement tax is a retail-level ad valorem tax (or a per-gallon excise, if chosen). A tax on the
wholesale price is not modelled.

## 6. Demand

The price response is a constant-elasticity curve, q = r^ε, applied to the wine that moves at its new shelf price;
the state-store price is held. Nelson (2013) pools market-level estimates from ordinary price variation. A 20% price
rise is at the edge of that; the break-even tax with the response (50.6% of the pre-tax price, a 51% price rise) is
well outside it. A straight line with the same slope at today's price (q = 1 + ε(r − 1)) gives a break-even of 57.6%:
the 7-point difference is the cost of extrapolating. Neither curve has a second root in the supported range for
ε = −0.46 (tax revenue a·r₀·q rises over 0-100%), and a steeper elasticity can leave no root at all, which the page then
reports instead of a number.

## 7. Sensitivity

One at a time (each input over its documented range, the others held), no single input reverses the sign of either
arrangement. Jointly (the table on the page; FY2025 example with the price response; the tax and the discount as
entered):

| Scenario | Standing | Arrangement 1 | Break-even tax | Arrangement 2 | Break-even discount |
|---|---|---:|---:|---:|---:|
| As entered | — | −13,419,951 | 50.6% | −8,811,541 | 4.1% |
| Costs and margin at the favourable ends (avoidable 9.8%, delivery 1.0%, margin 45.5%) | documented bounds | −9,219,040 | 40.4% | −6,156,160 | 8.9% |
| At the unfavourable ends (avoidable 2.3%, margin 47.2%) | documented bounds | −14,928,486 | 54.4% | −10,320,076 | 1.4% |
| Favourable bounds, 50% moving, half the new costs | exploratory | −14,781,734 | 39.6% | −9,676,934 | 9.5% |
| Arrangement 1 priced to match the state store | exploratory | −14,653,485 | 57.6% | −8,811,541 | 4.1% |
| Access effect +4.5% (privatization studies' lower quartile) | exploratory | −11,273,911 | 40.9% | −6,146,883 | 10.4% |
| Every operating expense avoidable (14.9%), lowest margin, no new costs | mathematical only | −6,492,563 | 34.1% | −2,850,100 | 14.9% |

At the entered tax and discount none reaches break-even, not even the arithmetic ceiling. Break-even needs the
policy lever to change: arrangement 2 a discount of at most 1.4%-10.4% within these rows (a grocer margin that small is
not documented as viable), arrangement 1 a tax of at least 34%-58%. The access row raises revenue only through extra
drinking. These are not probabilities.

Checks on the break-even values: the tax's base is the price before the tax, and the sales-tax base includes it
(tested); the share moving is held fixed as prices change (finding 2; the channel-return reading shows the
alternative); every reported root lies in the supported range or the page says there is none; the avoidable costs that
would reverse the one-at-a-time result (29.2% for arrangement 1, 20.9% for arrangement 2) exceed DABS's total
operating expenses (14.9% of sales, the same denominator), so operating savings alone cannot produce them.

## 8. Substitution and total drinking (the original question)

What the model represents: existing purchases moving (the share moving), and wine bought changing with its own price.
It does not represent switching between beer, wine and spirits in the comparison, does not compute total ethanol, and
represents access and cross-border effects only as entered assumptions.

Evidence, by mechanism:

- **Switching between beverages.** No credible cross-price estimate fits this change. Nelson (2013) has none. Meng et
  al. (2014, J Health Econ 34:96-103; UK household diaries, 2001-2009) estimate off-trade wine's own price elasticity
  at −0.384 and the off-trade beer-wine cross-price elasticities at 0.096 and −0.040, small and not significant; the
  authors note only 6 of their cross-price estimates are significant. A cross-price elasticity would in any case answer
  a price question, not an access question.
- **Availability changes.** The Community Guide review (Hahn et al. 2012, Am J Prev Med) of 17 studies of 12 retail
  privatizations found per-capita sales of the privatized beverage rose by a median 44.4% (interquartile 4.5% to
  122.5%), while sales of other beverages fell by a median 2.2%, not enough to offset. For Iowa's 1985 wine
  privatization Wagenaar and Holder reported wine up 93% at 44 months with no decrease in spirits or beer; Mulford and
  Fitzgerald, with ARIMA models, found the long-term change not significant after a three-year spike, partly over
  whether wine coolers were counted. These are quasi-experimental time-series designs (causal claims with the usual
  limits of comparison-state and interrupted-series designs), about states leaving retail entirely, mostly decades ago.
  Utah's question is grocery licences beside state stores, a smaller change. A preliminary working paper on Washington's
  2012 spirits privatization (Illanes and Moshary, marked not for citation) reports more spirits bought and no break in
  beer purchases; it is not used as evidence here.
- **Grocery wine specifically.** An FMI-released study of Tennessee after 2016 (Caputo, Michigan State University; a
  synthetic-control comparison) reports no significant rise in liquor-store closures and higher sales-tax revenue; its
  press release gives no consumption figures, and it was released by the grocery trade association. Colorado's 2019
  grocery beer change moved purchases from liquor stores to grocers (Palardy 2022, foot-traffic data): a channel shift,
  not a consumption estimate. No study found here measures beer-to-wine switching or total ethanol after grocery wine.
- **Total ethanol.** Must be counted in pure alcohol: a gallon of wine at 11.8% holds as much ethanol as about 2.5
  gallons of beer at 4.8% (NIAAA averages, calendar 2024). In the worked example the price response removes about $4.46 million of
  wine at state-store prices, about 79,600 gallons or 9,400 gallons of ethanol (at $56 a gallon, W over NIAAA's
  gallons, both including restaurants) — less drinking of wine, not a substitution, and only if the response is read
  as consumption rather than a return to state stores.

Conclusion: the evidence is inadequate to say that grocery access would move purchases from beer to wine without more
drinking. The closest causal evidence (full privatization) points the other way: more of the newly available beverage
and no offsetting fall in the others. That evidence does not transfer directly to Utah, so it is shown as context and
as one exploratory scenario, not as a forecast; no cross-price elasticity is invented.

## 9. Sources (read 2026-10-14)

- Nelson, J.P. (2013). Meta-analysis of alcohol price and income elasticities – with corrections for publication bias.
  Health Economics Review 3:17. https://pmc.ncbi.nlm.nih.gov/articles/PMC3722038
- Hahn, R.A., et al. (2012). Effects of alcohol retail privatization on excessive alcohol consumption and related
  harms: a Community Guide systematic review. American Journal of Preventive Medicine 42(4):418-427.
  https://web.pdx.edu/~nwallace/AHP/Hahn2012.pdf and https://www.thecommunityguide.org/findings/alcohol-excessive-consumption-privatization-retail-alcohol-sales
- Meng, Y., et al. (2014). Estimation of own and cross price elasticities of alcohol demand in the UK. Journal of
  Health Economics 34:96-103. https://eprints.whiterose.ac.uk/id/eprint/78871/1/WRRO_78871.pdf
- Illanes, G., and Moshary, S. (2019). Deregulation through Direct Democracy: Lessons from Liquor Markets
  (preliminary). https://econ.la.psu.edu/wp-content/uploads/sites/5/2023/05/GastonIllanes.pdf
- FMI – The Food Industry Association (2024). New FMI study assesses benefits of selling wine at grocery.
  https://www.fmi.org/newsroom/news-archive/view/2024/07/15/new-fmi-study-assesses-benefits-of-selling-wine-at-grocery
- Palardy, N. (2022). Three essays on horizontal regulation limiting alcohol sales. Ph.D. dissertation, Colorado
  State University. https://mountainscholar.org/items/29565716-2b2a-4534-9102-59fae6db339f
- The DABS annual reports (81st-90th) and State of Utah ACFRs (FY2022-FY2025) as saved and pinned in this project.

## 10. What needs Ethan's judgment

1. Whether the worked example should keep the equal-pre-tax-price case as its main case, or switch to the
   channel-return reading or price parity (all three are on the page).
2. Review of the twelve packet items, starting with rows 1, 2 and 11 (they move the result most).
3. Whether restaurants' and bars' purchases should be taken out of the wine baseline before a share moves, which needs a
   DABS figure the dataset lacks (a records request).
4. The legal readings: whether wine DABS no longer sells would stop generating the two deposits, and whether
   arrangement 3's guarantee is how a bill would be written.

## 11. Corrections of 2026-10-15 (`utah-wine-scenario@1.5`, `utah-wine-arrangements@1.1`)

Ethan's review of the 2026-10-14 results raised five points. What was done about each:

| # | Point | Kind | What changed |
|---|---|---|---|
| 1 | The 30% that moves was applied to all DABS wine sales, including restaurants' and bars' purchases, which would keep buying from DABS. | Incorrect base (finding 2's row 5, now acted on) | A household share is an input (`hh`; `eligible` in the model): only that share of wine sales can move, and the share moving applies to it. DABS's FY2025 report (p. 18, a chart) puts off-premise sales at 82% of all its sales; that all-product figure is the default and the worked value, labelled as an assumption for wine, with a ±15-point convention in the sensitivity table and a sweep from 50% to 100%. Transcribed as `ut_dabs_off_premise_sales_share` and `ut_dabs_on_premise_sales_share` (FY2025, unreviewed). A records request for wine by customer type is drafted (docs/gaps/utah-missing-records.md, request C, not sent). |
| 2 | A price consumers accept is not automatically a price a grocer can sustain. | Missing analysis | Matched consumer prices are the reference case (`pc=matched`): the shelf price is today's, so in arrangement 1 the replacement tax is inside it and sellers bear it. A new table, "Can sellers live with it?", shows what sellers keep after the wine and the tax, at the entered lever and at the state's break-even, and, given the gross margins sellers are assumed to need, the shelf price at which the state breaks even *and* they earn them. The entered grocery price (the old main case) is the alternative, shown in the joint scenarios. |
| 3 | Reading the price response as buyers returning to state stores rests on an elasticity that cannot measure channel switching. | Overstated reading | Labelled exploratory wherever it appears (finance table, arrangement 3, CSV, saved results), with the reason; it arises only when the grocery price differs from the state store's. |
| 4 | Is the $6.5 million guarantee fixed, or does it move with the sales actually displaced? | Unclear definition | Two proposals, both shown in every case: **fixed** (today's deposit rates on the sales the scenario moves, set once) and **proportional** (the same rates on the state-store sales actually lost each year). They agree while the state loses the sales the scenario moves, and part when fewer buyers move (the exploratory return case): the fixed one then overpays the two funds at the other funds' expense. Arrangement 3 now shows the return case too. Older addresses' `er=today` reads as fixed. |
| 5 | "FY2023 now reconciles" overstated the finding. | Overstated wording | Now "first-published figures largely agree; later restatement remains unexplained" in the reconciliation notes, the dashboard's reconciliation text, the checklist and the progress log. |

**Current results** (FY2025; per year; state government only; 30% of household purchases, which are taken to be 82% of
wine sales, so $45,436,424 of wine at state-store prices, 24.6% of wine sales; other inputs as in section 2):

| | Arrangement 1 (20% replacement tax) | Arrangement 2 (20% discount) |
|---|---:|---:|
| Matched prices (reference): net change | −$12,105,858 | −$7,315,464 |
| Replacement revenue collected | $7,572,737 (20% of a sellers' price of 83.3%) | DABS keeps its margin less 20 points |
| What sellers keep per $1 of state-store price (gross margin on their own price) | 30.5¢ (36.7%), wholesalers and grocers together; the grocer 8.5¢ (10.1%) after a wholesaler's 29.5% | 20.0¢ (20.0%) |
| State's break-even lever (matched prices) | a tax of 76.4% of the sellers' price | a discount of at most 3.9% |
| What sellers keep at that lever | 3.9¢ (6.9%) together; a grocer paying a 29.5% wholesaler would sell below cost | 3.9¢ (3.9%) |
| Shelf price at which the state breaks even and sellers earn 29.5% (wholesaler) and 28.0% (grocer), before sales tax | 145.1% of today's (a 39.5% tax on a sellers' price of 104.0%); with the price response read as less wine bought, 155.5% (a 49.5% tax), at which 81.6% of the moved wine is bought | 131.4% of today's (a 5.4% discount); with the price response, no discount works |
| Entered grocery price (alternative): net change, channel shift / with the price response / exploratory return | −$10,150,577 / −$11,094,359 / −$9,374,214 | −$7,315,464 (the price does not change) |

The identity behind the matched-price rows: when grocers charge what a state store charges, the state and the sellers
divide the same margin, so in either arrangement the state breaks even only if sellers keep no more than the operating
cost the state avoids less the new costs, 5% − $500,000 / $45.4 million = 3.9 cents a dollar. Sellers are assumed to
need margins near Census's national averages (29.5% for beer, wine and spirits wholesalers; 28.0% for grocery stores,
31.1% for beer, wine and liquor stores; all products, 2022, read online and not yet saved). Averages pay for
everything a business sells; a grocer adding wine to shelves it already runs may accept less, just as the state's
average cost is not the cost it would avoid. So the matched-price arrangements look commercially hard and the
price-raising ones put grocery wine 31% to 45% above the state-store price; neither establishes that no workable
arrangement exists. What would settle it is what grocers would actually accept, which no source here measures.

Arrangement 3 (on arrangement 1, matched prices): the fixed guarantee is $5,313,790 a year (11.695% of $45.4 million);
the replacement tax collected ($7.57 million) covers it, so there is no funding requirement, and the General Fund and
other funds bear the whole −$12.1 million. Under the entered price, in the exploratory return case only 92% of the
estimated sales leave the state stores; the fixed guarantee then pays the two funds $427,480 more than they lose, and
the proportional one ($4,886,310) pays exactly what they lose.

Joint scenarios at matched prices: none reaches break-even at the entered tax and discount. The arithmetic ceiling
(every DABS operating expense avoidable, the lowest margin, no new costs) still loses $6.3 million in arrangement 1 and
$2.3 million in arrangement 2 (whose break-even discount there is 14.9%).

Checks: `web/src/lib/arrangements.test.ts` ("only household purchases move", "matched consumer prices and what
sellers keep", "the guarantee: fixed or proportional", and the worked comparison's hand-checked FY2025 figures).
