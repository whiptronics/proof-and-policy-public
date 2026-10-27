# Technical appendix: grocery-store wine in Utah

**Draft, 2026-10-17.** This appendix documents the Utah grocery-wine analysis (published with the project; the private two-page brief it
once accompanied is not part of the public repository). Every source value below
was transcribed by an AI assistant or parsed by a script, and an AI assistant checked it against the cited document.
Those are AI-assisted source checks, not a human review: no person has reviewed the values yet. Every other input is a
stated assumption. Nothing here is a forecast or a fiscal note. The same figures appear on the local page
`?v=initiative` and are recomputed by `python scripts/grocery_wine_briefing_example.py`; the robustness section is
recomputed by `python scripts/grocery_wine_robustness_check.py`. Those scripts check the arithmetic and its agreement
with the page's model, not the source values or how they were read (see "Verification of these figures").

## The question

The questions examined:

- whether grocery wine could bring in as much as the current state-store system, where the state is the only seller of
  wine to take home;
- how school-meal funding, part of which comes from liquor money, would be affected;
- what evidence a bill would need.

The project's maintainer suggested that existing drinkers might buy wine instead of beer without drinking more. That is
examined below as a hypothesis.

## Short answer

**Updated 2026-10-19.** The points below are about existing wine purchases moving to grocers and nothing else. The
purchase-flow section near the end adds beer, spirits, out-of-state and additional purchases, and designs that
preserve the state's collection. Its main changes:

- Moving a bottle costs the state money only when the arrangement collects less per bottle than DABS's markup. With
  the collection preserved (a proposed design), 30% moving changes receipts by +$0.5M to +$1.7M a year. Paying grocers
  then needs grocery prices 39% to 51% higher.
- The −$2.0M to −$2.6M "price response" results for those designs came from applying a market-wide elasticity to one
  channel's price. They are now exploratory.
- With a 20% DABS discount, the state breaks even if wine replaces 6.1% of households' beer at the same alcohol, or
  with 17.6% more wine. Under a 20% private tax the figures are 15.3% and 40.9%; replacing spirits lowers receipts
  there. Nothing measures any of these shares for Utah.

1. **Under the brief's reference assumptions, both reference arrangements lower state revenue.** The loss is $12.1 million a
   year with private wholesalers and a 20% replacement tax, and $7.3 million with DABS as the wholesaler and a 20% discount
   to grocers. That is 13% and 8% of the state's $96.2 million from wine today.
2. **The cause is structural.** When grocers charge what a state store charges, the state and the private sellers split
   the same margin. The state breaks even only if sellers keep no more than **3.9 cents per dollar** of today's shelf
   price, a gross margin of 3.9% to 6.9% on their own price. Nationally, grocery stores keep about 28 cents of each
   dollar of their own sales, and alcohol wholesalers about 30 cents of theirs (Census, 2022, all products).
3. **Protecting school meals is cheaper than protecting total revenue, and they are different goals.** Keeping the
   school-meals and enforcement funds whole costs about **$5.3 million a year**. Either arrangement's own proceeds can
   pay it. But a guarantee only moves money between funds: the General Fund and other state funds absorb the whole
   loss.
4. **Beer-to-wine switching could offset the loss only at scale.** To cover the loss with no change in total alcohol, Utah
   would have to buy **14% more wine** (DABS-wholesale design) or **38% more wine** (private design) in place of beer. No
   study found measures this kind of switching after grocery wine. The closest evidence, full retail privatization
   elsewhere, found sales of the privatized drink up by a median 44% and other drinks down by a median 2%; ending state
   retail is a bigger change than licensing grocers, and that evidence does not show the size of a Utah effect.
5. **The "alcohol pays 50% of school lunch" figure is not supported by the sources found.** In FY2024 about $50
   million of liquor money and over $322 million of federal money went to school meals, so liquor was about 13% of the
   two combined. A 2026 fiscal note says the state's own school-meal funding comes from liquor sales, so liquor money
   appears to be nearly all of the *state's* share, not half of the total.
6. **With the 20% tax or discount held fixed, the loss persists across every input range tested.** Moving each input
   across its tested range, and DABS's documented cost and margin bounds together, never brings either reference
   structure to break even; other levers and arrangements do (item 7). Store savings cannot close
   it, and the wine margin would have to fall below what even the small-winery markup implies. What remains is sellers
   keeping about 4 cents a dollar, higher grocery prices with the same wine still moving, or untested beer-to-wine
   switching (see "How robust is the loss?").
7. **Other arrangements keep revenue whole only by changing who pays the grocer** ("Policy alternatives"). At fixed
   volume, DABS supplying at today's price with grocers pricing for a 28% margin raises the grocery price 38.9% and the
   state's revenue by $1.4M ($0.4M without the assumed savings); a private charge equal to DABS's margin per bottle: 51.2%
   and $1.7M ($0.6M). Fewer bottles bought at the higher price could make the first −$2.0M (a conditional sensitivity).

## How the state earns money on wine today (FY2025)

| Item | Value | Standing |
|---|---:|---|
| DABS liquor sales, all products | $551.3 million | DABS 90th annual report, p. 32, "Revenue from Liquor Sales", FY2025 (unaudited). Sales tax ($32.4M) is a separate row. The FY2025 report has no notes; DABS's FY2016, FY2019 and FY2021 reports (Note B) say sales taxes are excluded from sales |
| Wine's share of sales | 33.5% → **$184.7 million** | Summed by product class from DABS's monthly Sales Analysis Reports, FY2026 (a later year): wine $182,331,954.71 of $543,682,177.59. It counts sake, fortified wine and special-order wine, not wine coolers. The FY2025 report's p. 19 chart gives wines $184.10 (labelled "in thousands" but plainly millions), 33% |
| Gross margin (sales less the cost of the goods) | **47.2%** | **Measured for all products** (gross profit $260.3M ÷ sales); applied to wine as an assumption |
| Wine's statutory minimum markup | 88.5% on landed case cost = **46.95% margin** | Utah Code § 32B-2-304(2)(b) (versions effective 2024-05-01 and 2026-03-13); a floor for standard wine, not an observed wine margin. Small-manufacturer wine is marked up a fixed 49% (§ 32B-2-304(3)(c)) and sales to military installations at least 17% ((3)(a)) |
| Operating expenses | 14.9% of sales | Same report, p. 30: total operating expenses $81.9M, fifteen lines that sum to it, none of them depreciation or interest (those are listed separately as non-operating, $17.5M and $0.6M). The p. 32 summary labels the $81.9M "Operating and Non-Operating Expenses". The audited ACFR gives different depreciation and interest for the same fund (see "Which DABS costs could fall when wine moves"). Gross margin is not profit |
| School-meals deposit | 10% of "the total gross revenue from sales of liquor": ~$55 million computed, ~$18.5 million of it from wine | § 32B-2-304(5) (version effective 2026-03-13; same wording since 2024); paid out of the margin. DABS reports $56.9M transferred in FY2025 (10.32% of sales, p. 32); the difference is unexplained |
| Enforcement deposit | 1.695% of the same, to the Alcoholic Beverage Control Act Enforcement Fund (Department of Public Safety; it also funds drug enforcement) | § 32B-2-305(4) (version effective 2024-05-01; rate set by 2023 H.B. 223 from 2023-07-01). DABS's FY2025 "Transfer to SBI" is $9.6M, 1.741% of sales; unexplained |
| State sales tax | 4.85% | Tax Commission combined rate tables, July 2024 to April 2025 (state rate 4.85% all of FY2025); Publication 25 (Rev. 9/26, a draft), p. 6, Chart 2. Applied to all DABS wine sales; see the note below |

A markup is charged on cost and a margin is measured on price: an 88.5% markup is a 47% margin. The measured
all-product margin and the wine floor happen to agree, but they are on different bases (heavy beer's floor is only
66.5%, and DABS's cost of goods may not equal landed case cost), and no wine-specific margin has been measured. Gross
margin also differs from net profit, because store operating costs come out of it.

**Sales tax on licensee purchases.** The model applies 4.85% to all $184.7M of DABS wine sales. DABS's reported FY2025
sales tax ($32.4M) is 5.88% of sales, below the lowest combined rate anywhere in Utah (6.35%), which suggests some of
its sales, likely those to bars and restaurants as sales for resale, are untaxed. If the 18% on-premise share is
untaxed, today's state revenue from wine is about $1.6 million lower ($94.5M) and each arrangement's level falls by
the same amount. The net changes do not, because the wine that moves is household wine, taxed before and after.

## Three arrangements on one baseline

The reference case uses **matched prices** (a bottle costs the same at a grocer as at a state store). It moves 30% of
household wine purchases to grocers, which is $45.4 million (24.6% of wine sales). Restaurants and bars keep buying
from DABS. It assumes 5 cents of avoided store cost per dollar moved and $500,000 a year of new licensing and
enforcement cost. Figures
are per year, for state government only, with all state funds together, so transfers between funds are never counted
as revenue.

| | Today | 1. Private wholesale + grocery, 20% replacement tax | 2. DABS wholesales to grocers at a 20% discount |
|---|---:|---:|---:|
| **Net change for the state (revenue, plus store costs avoided, less new costs)** | — | **−$12.1M** | **−$7.3M** |
| State margin given up on wine that moves | — | −$21.5M | −$21.5M |
| What the state collects instead | — | +$7.6M (tax) | +$12.4M (DABS's remaining margin) |
| Store costs avoided / new costs | — | +$2.3M / −$0.5M | +$2.3M / −$0.5M |
| School-meals fund, no guarantee | — | −$4.5M | −$0.9M if DABS's sales to grocers carry the deposit; −$4.5M if not |
| What sellers keep per $1 (their gross margin) | — | 30.5¢ shared by wholesaler and grocer; grocer ~8.5¢ after a 29.5% wholesaler | grocer 20¢ |
| Local sales tax | not modelled | not modelled | not modelled |

If grocers instead add the tax on top of today's price, arrangement 1 loses $10.2 million, or $11.1 million once fewer
bottles are bought at the higher price (elasticity −0.46).

**Arrangement 2 needs a statute change either way.** § 32B-2-304(2)(b) requires wine "sold by the department within the
state" to be marked up not less than 88.5% above landed case cost, and its only discount authority is for
discontinued items ((7)(a)). A 20% discount to grocers would leave a markup of about 51%. The same bill could say
whether those sales carry the school-meals and enforcement deposits. Today's wording, "total gross revenue from sales
of liquor", is not limited to retail sales, and DABS already sells to licensees and military installations under it.
Private wholesale and grocer sales are not DABS revenue, so arrangement 1 loses the deposits unless the bill adds a
levy like the one on manufacturer package agencies in § 32B-2-304(6)(a).

## Two different goals: total revenue vs. school meals

**Preserving total state revenue** (break-even):

- At matched prices, sellers may keep at most 3.9¢ per dollar. That means a 76% replacement tax in arrangement 1, or a
  DABS discount of no more than 3.9% in arrangement 2. Sellers who need national-average margins could not operate at
  either.
- If sellers earn those averages and the state still breaks even, grocery wine would have to cost **45% more** (private)
  or **31% more** (DABS wholesale) than the same bottle at a state store. With the exploratory price response (the old
  treatment; see the purchase-flow section), arrangement 2 has no break-even at all.
- **Within these assumptions (only existing wine purchases move; no substitution, recapture or new purchases), no
  arrangement keeps today's prices and today's state revenue while sellers earn margins anywhere near the national
  averages.** "How robust is the loss?" tests what would change this.

**Protecting school-meal funding** (keep the two funds whole):

- The two funds get about $5.3 million a year from the wine that moves: $4.54M for school meals, $0.77M for enforcement.
- In arrangement 1, the $7.6M replacement tax covers the guarantee and leaves $2.3M for the General Fund. The tax must
  be at least 13.2% of the sellers' price to cover it. The General Fund and other funds bear the full −$12.1 million.
- In arrangement 2, DABS's remaining margin ($12.4M) covers the guarantee at any discount up to 35.5%. The other funds
  bear the full −$7.3 million.
- **Who pays when receipts fall short.** A fixed guarantee is owed even if fewer sales move or the tax raises less. The
  shortfall is then a draw on the General Fund or other state money. A proportional guarantee pays today's rates on
  the sales actually lost, so it falls when the loss falls. A guarantee cannot make the state as a whole better off.

Calling an arrangement "school-lunch-safe" is accurate only for those two funds, and only if the bill names the funding
source and says what happens in a shortfall.

## The beer-to-wine what-if

*Restated in the purchase-flow section, which separates beer from spirits and applies each arrangement's own
collection; its break-evens supersede the table below.* Here the total amount of alcohol stays the same. A gallon of wine at 11.8% alcohol replaces 2.46 gallons of beer at
4.8% (NIAAA 2024 averages). The state gains its take on the wine and loses the beer excise ($13.35 a barrel in FY2025,
Utah Code 59-15-101) and the sales tax on the beer. The calculation covers switching only: it excludes channel shift, cross-border purchases and
more drinking, so nothing is counted twice.

| Per gallon of wine bought instead of beer, all at grocers | Arr. 1 | Arr. 2 |
|---|---:|---:|
| State revenue from the wine | $12.05 | $17.96 |
| Beer excise and sales tax given up | −$2.49 | −$2.49 |
| **Net** | **$9.56** | **$15.47** |
| Switching needed to offset the loss | 1.27M gal: **38% more wine**, 12% of beer | 473k gal: **14% more wine**, 4% of beer |

The beer price is a placeholder ($12 a gallon, no source); $8 or $16 moves the threshold by about 5%. The calculation
assumes the displaced beer is grocery beer. Displacing heavy beer from state stores would cost the state its markup too.

**What the evidence says.** The model audit (section 8 of docs/review/grocery-wine-model-audit.md) found no study that
measures beer-to-wine switching after grocery wine. The closest evidence is full retail privatization elsewhere. As that
audit records the Community Guide review (Hahn et al. 2012; 17 studies of 12 privatizations; the paper itself is not
saved in the project), per-capita sales of the privatized drink rose by a median 44.4% (interquartile range 4.5% to
122.5%) and sales of other drinks fell by a median 2.2%. Other drinks did decline, by much less in percentage terms
than the privatized drink rose. The medians come from different studies and are not converted to total alcohol here,
so they do not by themselves give the net change in drinking. The studies are of states ending state retail sales of a
drink, mostly decades ago, a bigger change than licensing grocers beside state stores, so they do not establish the
size of a Utah effect in either direction. A 14% rise in wine with an equal drop in beer alcohol would be a large,
unmeasured effect, and it is shown here as a threshold only. The same switch at a state store would earn the state more ($26 per wine gallon, net of beer, $23.9), so this
revenue does not depend on grocery wine.

## The "50% of school lunch" claim

| Source | What it says |
|---|---|
| Utah Office of Legislative Research, *School Meals Programs* (rev. 2025-01-16), pp. 2 and 6 | FY2024: over $322 million federal and about $50 million appropriated from the liquor tax. FY2025: the Child Nutrition line item was $374 million, $322.8 million of it federal, the rest income tax and liquor tax |
| Legislative Fiscal Analyst, fiscal note for 1st Sub. S.B. 180 (2026), 2026-02-25 | "State funding comes from revenue generated by the sale of liquor. The FY 2027 base appropriation is $50.1 million" |
| FOX 13 (2024-05-08), DABS spokesperson | DABS turned over $60 million to the school lunch fund "last year" |
| Utah Code § 32B-2-304(5) | 10% of gross liquor sales revenue goes to school meals |

In the same year (FY2024), liquor money was about 13% of federal and liquor funding combined ($50M of about $372M).
In FY2025 the non-federal part of the $374 million line item was about $51 million, income tax and liquor tax
together, so liquor was at most about 14%. The share of total school-meal spending is lower still, because student
payments are outside the line item. The 2026 fiscal note supports the reading that liquor money is nearly all of the
state's own contribution. DABS's deposits (computed ~$55M; reported $56.9M in FY2025) are not the same as the
Legislature's appropriations (~$50M), so the two should not be mixed. **The 50% figure is unresolved;** do not repeat
it until its year, denominator and scope are known. Legislative fiscal staff can settle it.

## How robust is the loss?

*Added 2026-10-17.* The local page computes this in its section "What would have to be true for this to break even?"
(method `initiative-robustness@1.0`) from the scenario tool's own model, and `python
scripts/grocery_wine_robustness_check.py` recomputes every figure below in closed form. One input moves at a time with
the others as in the worked example; then DABS's documented cost and margin bounds move together. No probabilities are
attached: a tested range shows how far the result moves, not how likely any value is. Ranges marked *illustrative*
have no evidence behind them.

**Why the sign is hard to change.** At matched prices each dollar of wine that moves changes state revenue by
−m + a/(1+a) + v with private supply and by v − d with DABS supply, before the fixed new costs (m the gross margin,
a the replacement tax on the sellers' price, d the discount, v the store cost avoided). In the example that is
−25.5¢ and −15.0¢. How much wine moves only multiplies this, so the share that moves, the household share, the wine
share and the scope of "wine" change the size of the loss, never its sign. The sales tax rate drops out. Only the
margin, the avoided cost, the two levers and prices can change the sign.

### Inputs by standing

| Input | Example | Standing | Range tested (basis) |
|---|---:|---|---|
| DABS FY2025 sales, gross profit, expense lines | $551.3M; $260.3M | Observed (transcribed, not reviewed) | not varied |
| Gross margin on wine | 47.2% | Derived: all-product margin applied to wine | 32.9% to 47.2% (small-winery markup to the FY2025 margin) |
| Wine's share of DABS sales | 33.5% | Derived: FY2026 monthly reports applied to FY2025 | 33% to 34% (FY2025 report; tax-basis bias) |
| Households' share of wine purchases | 82% | Derived: all-product off-premise share applied to wine | 67% to 97% (illustrative, ±15 points) |
| Which wines a bill covers | all DABS wine classes | Policy choice | 77.9% to 102.1% of the modelled wine (class mix) |
| Household purchases that move | 30% | Chosen | 20% to 40% (illustrative, ±10 points) |
| Store cost avoided per dollar | 5¢ | Chosen | 2.3¢ to 9.8¢ (DABS expense lines; accounting bounds) |
| New licensing and enforcement cost | $500,000 | Chosen | $0 to $1M (illustrative) |
| Replacement tax; DABS discount | 20%; 20% | Policy choices | solved for break-even |
| Sellers' margins (retailer check) | 29.5% and 28.0% | Chosen benchmark: Census, national, all products | used only to judge feasibility |
| State sales tax | 4.85% | Observed rate; treatment of licensee sales assumed | treatment tested below |

### Results, net change in state revenue a year

| Moved alone, others as in the example | Private supply | DABS supply |
|---|---:|---:|
| Worked example | −$12.1M | −$7.3M |
| Share that moves, 20% to 40% | −$8.2M to −$16.0M | −$5.0M to −$9.6M |
| Household share, 67% to 97% | −$10.0M to −$14.2M | −$6.1M to −$8.6M |
| Scope: still table wine only, to wine plus hard cider | −$9.5M to −$12.4M | −$5.8M to −$7.5M |
| Wine share, 33% to 34% | −$11.9M to −$12.3M | −$7.2M to −$7.4M |
| Store cost avoided, 2.3¢ to 9.8¢ | −$13.3M to −$9.9M | −$8.6M to −$5.1M |
| Gross margin, 32.9% to 47.2% | −$5.6M to −$12.1M | −$7.3M (no effect) |
| New costs, $0 to $1M | −$11.6M to −$12.6M | −$6.8M to −$7.8M |
| Documented bounds together: cost 2.3¢ to 9.8¢ (plus 1.0¢ of delivery for private supply), margin 47.2% to 45.5% | −$13.3M to −$8.7M | −$8.6M to −$5.1M |
| Every operating expense avoidable (14.9¢), margin 45.5%, no new costs: arithmetic only | −$6.3M | −$2.3M |
| Extreme arithmetic comparison, not a saving: as above, with the DABS report's depreciation and interest also treated as avoidable (18.1¢) | −$4.8M | −$0.8M |

Every tested value and combination loses money in both reference structures when only existing wine purchases move. The last row is an extreme arithmetic
comparison, not an attainable saving and not a sign that the proposal nearly pays for itself: depreciation is not a
cash cost that stops when sales move, interest is owed on existing debt, and every operating expense would fall only
if the whole business shrank with the wine. With the audited ACFR's depreciation and interest in place of the DABS
report's, that comparison is 16.3¢ and the losses are −$5.7M and −$1.7M. The size moves most with the margin (private
supply only), the share that moves, the household share and the store cost avoided. The year of the wine share, the
scope at the cider end and the new costs barely matter.

### Break-even thresholds: arithmetic, commercial and legal

| Lever | Private | DABS | What kind of result |
|---|---:|---:|---|
| Replacement tax | ≥ 76.4% (43.3% of the price including it) | — | Algebraic. Wholesaler and grocer together would keep 3.9¢ of today's dollar, a 6.9% gross margin on their own price, against about 49% at national averages (a reference, not a minimum). Any tax needs the bill. |
| DABS discount | — | ≤ 3.9% | Algebraic. The grocer's margin would be 3.9% against about 28%. Current law's 88.5% minimum wine markup allows a discount of at most about 0.5% at a 47.2% margin, and none if wine sits at the floor (a legal reading, not reviewed). |
| Store cost avoided | ≥ 31.6¢ | ≥ 21.1¢ | Outside the tested range and beyond all of DABS's operating expenses (14.9¢ per dollar of sales), the most store savings could reach. Even counting non-cash depreciation and interest (16.3¢ or 18.1¢, depending on the statement) falls short. Not achievable from store savings. |
| Wine margin | ≤ 20.6% | no effect | Outside the tested range: below the 32.9% that even the 49% small-winery markup implies; the standard floor implies 46.95%. Only sales to military installations carry a lower markup (at least 17%). |
| Grocery shelf price, sellers at national margins | 145.1% of today's (39.5% tax) | 131.4% (discount ≤ 5.4%) | Conditional: assumes the same 30% of household purchases still moves at the higher price. With the −0.46 price response, 155.5% (private) and no break-even with DABS supply. |
| Wine bought instead of beer | 38% more wine | 14% more wine | Conditional on equal total alcohol and untested; no study measures it. |

"Algebraic" means the model's arithmetic reaches zero there. The commercial comparison sets what sellers would keep
beside national average gross margins (Census 2022, all products, not wine in Utah), which are reference points, not
known minimums; a wine-specific grocer margin could be lower, but it would have to be near 4% to 7%. Whether a business
would accept that is not established here. "Under current law" is a reading of Utah Code
§ 32B-2-304 as read online, not reviewed by counsel.

### The assumptions examined

1. **The all-product margin applied to wine.** DABS's FY2025 gross margin is 47.2% across all products; its reported
   margin ranged from 45.5% (FY2021) to 47.2% (FY2025). The 88.5% minimum wine markup implies 46.95% for wine sold at
   the floor; small-producer wine carries a 49% markup (32.9%), and only sales to military installations carry less
   (at least 17%). With DABS supply the margin cancels at matched prices, because the state keeps m − d instead of m
   on each dollar that moves. With private supply a lower wine margin
   shrinks the loss, but it would have to fall to 20.6% to break even. A wine margin from DABS would settle this.
2. **The all-product household share applied to wine.** 82% is DABS's off-premise share of all products (FY2025 report,
   p. 18, read from a chart). Its definitions overlap: on-premise is defined by where the drink is consumed and
   off-premise by where it is bought, and licensees also buy at state stores. Wine's share could be higher or lower;
   it only scales the loss.
3. **The FY2026 wine share applied to FY2025 sales.** The FY2025 report's p. 19 chart ("Sales by Type", "As of June
   30, 2025") gives five categories: distilled spirits $330.80, wines $184.10, heavy beer $28.53, flavored malt
   beverages $3.89 and cider $3.60, labelled "in thousands" but plainly millions (read from the chart image, not
   reviewed). They sum to $550.92M, so wine is 33.4%; the chart prints no total. Pages 30 and 32 give $551.346M of
   sales ("Operating Revenue" and "Revenue from Liquor Sales"). The chart calls its categories shares of "DABS total
   retail sales", a term the report does not define, and nothing in the saved report explains the $0.43M (0.08%)
   difference, so the reason is unknown. The model uses $551.3M (p. 32) for sales and the gross margin, and the FY2026
   monthly reports' 33.5% for wine's share (their class rows sum to 33.54%); the p. 19 figures serve only as this
   cross-check. Using p. 19's 33.4% instead moves the loss by about $0.03M; the 33% to 34% range moves it by under
   $0.2M.
4. **Whether a share sidesteps the monthly sales-tax question.** The monthly reports' gross sales are shelf prices
   times bottles, and whether those prices include sales tax is unresolved. A share cancels the question only under
   specific conditions. If tax at rate k is embedded in household sales only, the measured share equals the true
   share times (1 + k·h_w) / (1 + k·h), where h_w is wine's household share and h the all-product share. That ratio is
   1 when no tax is embedded, when every sale carries the same rate, or when h_w = h; otherwise it is not. At an
   illustrative k of 10% and h_w from 67% to 97%, the share is off by up to ±1.4% (about half a point), up to $0.16M
   on the nets. The ambiguity does not cancel by itself, but it is too small to change the conclusion.
5. **Whether the modelled wine matches what a bill would permit.** The model's "wine" is every DABS class mapped to
   wine (FY2026 monthly reports; `python scripts/dabs_wine_class_mix.py`): still table wine 77.9% of wine sales (red
   40.1%, white 32.0%, rosé and blush 5.0%, small packages 0.8%), sparkling 13.2%, gift sets and special orders 4.8%,
   fruit wine, sangria and sake 2.6%, fortified and aromatized 1.4%, allocated items 0.2%. Hard cider, which Utah
   Code § 32B-1-102(143) counts as wine (saved copy, version effective 2026-05-06; not reviewed), is kept out of the
   model's wine and equals 2.1% of it. A bill limited to still table wine would cover about 78% of the modelled
   wine; one adding cider about 102%. Either only scales the loss.
6. **Retailer margins, avoidable costs and the wholesale discount.** See the thresholds table. The Census averages are
   a benchmark, not a requirement. Avoidable costs are bounded by DABS's own expense lines; even all of them fall
   short of the 21.1¢ to 31.6¢ needed. The 20% discount is a policy choice; at the break-even 3.9% the grocer keeps
   3.9%.
7. **Sales tax.** At matched prices the 4.85% state sales tax is collected on the same shelf price before and after,
   so the rate drops out of the net change. That holds because the model puts the replacement tax inside the price
   that sales tax applies to, a design choice. If a bill kept the replacement tax outside the sales-tax base while
   the shelf price before sales tax stayed at today's, consumers would pay slightly less, the private loss would be
   −$12.47M and the break-even tax 83.5%. If DABS's sales to licensees carry no sales tax, every revenue level is
   $1.6M lower and the changes are the same.

### Which DABS costs could fall when wine moves

*Added 2026-10-17, from the saved FY2025 statements; AI-assisted reading, not reviewed.* **What the three figures are.**
The DABS 90th report's income statement (p. 30, unaudited) lists fifteen operating expense lines that sum exactly to
its total operating expenses, $81.910M; none is depreciation or interest. Below operating income it lists
amortization and depreciation ($17.469M) and interest on bonds and notes ($0.602M) as non-operating, and its
arithmetic closes to the $100.465M net profit. So the $81.9M excludes depreciation and interest, and adding the two
counts nothing twice within that statement. The p. 32 five-year summary prints the same $81.910M as "Operating and
Non-Operating Expenses"; for these two years the label does not fit the figure, and older reports (81st) print the row as "Less
Operating Expenses". The audited State of Utah ACFR (FY2025, printed p. 50, Statement of Revenues, Expenses and
Changes in Fund Net Position, Alcoholic Beverage Services column) classifies the fund differently: depreciation and
amortization of $5.331M inside operating expenses, interest expense of $2.422M as nonoperating, and purchases for
resale of $296.827M ($5.770M above DABS's cost of liquor sold, about its $5.767M delivery line). Its depreciation and
interest do not match the DABS report's, and nothing saved explains the difference, so the figures from the two
statements are not combined line by line here.

**What would have to happen for each to fall** (FY2025, $ thousands, DABS report p. 30). The wine that moves is 8.2%
of DABS's sales.

| Cost | $K | In the model | When sales leave, nothing else changing | Longer run: what would have to happen |
|---|---:|---|---|---|
| Card fees 8,403; bags 680; package agency contracts 3,474 | 12,557 | Low end of the tested range (2.3¢) | Card fees and bags fall roughly with the sales that leave; agency contracts only if paid by volume and the wine leaves agencies (not checked) | The same |
| Salaries, wages and benefits | 41,432 | Added at the high end (9.8¢) | Little, unless hours and staffing are cut | Staffing, store hours or the number of stores reduced to match the lower volume |
| Delivery to stores | 5,767 | Added for private supply only (1.0¢) | Partly, with cases shipped; with DABS supply DABS still delivers to grocers, so the cost moves rather than falls | Fewer delivery routes or warehouse shifts |
| Maintenance and supplies 4,959; data processing 7,168; professional services 3,456; rentals and leases 1,155; telephone, insurance, postage, travel and other 1,786 | 18,524 | Operating-expense ceiling only (14.9¢, every operating line) | Essentially fixed | Stores closed, leases ended, systems scaled down |
| Parents Empowered | 3,630 | Operating-expense ceiling only | A prevention campaign, not a store cost | Only if its funding rule ties it to sales (not checked) |
| Amortization and depreciation (ACFR: 5,331) | 17,469 | Extreme comparison only (18.1¢) | No cash saving: it spreads past spending on stores and equipment | The saving would be capital spending avoided (stores or warehouse capacity not built or replaced), which this line does not measure |
| Interest on bonds and notes (ACFR: 2,422) | 602 | Extreme comparison only | None: owed on existing debt | Debt repaid early, or future borrowing for stores avoided |

**Another assumption: all-product ratios.** Every per-dollar cost here is DABS's expense over all its sales, spirits,
wine and beer, household and licensee alike. Applying it to the household wine that moves assumes a dollar of that wine
costs DABS as much to sell as an average dollar. That is not measured. It could differ in either direction: card fees
follow dollars, while bags, delivery and staff time follow transactions, bottles and cases.

### Guarantees and double counting

- **Nothing is counted twice.** The school-meals (10%) and enforcement (1.695%) deposits are paid out of DABS's gross
  margin. The model counts the margin once, as state revenue; the deposits are transfers inside state government and
  are never added to it. Store costs avoided are counted once per dollar that moves, new costs once as a fixed amount,
  the replacement tax once on the wine that moves, and sales tax on both sides at the same price. The Python check
  recomputes the private result line by line, with and without the deposits shown as separate transfers, and both
  equal the closed form.
- **Every guarantee has a funding source.** With private supply the $5.3M guarantee comes from the $7.6M replacement
  tax, leaving $2.3M; the tax must be at least 13.2% to cover it. With DABS supply it comes from DABS's remaining
  $12.4M margin. Either way the General Fund and other state funds bear the whole loss (−$12.1M or −$7.3M): a
  guarantee moves money between funds and creates none. A fixed guarantee is owed even if less wine moves, and any
  shortfall falls on the General Fund or other state money; a proportional one shrinks with the sales actually lost.
- **School meals and total revenue are separate tests.** Within these assumptions both structures can keep the two
  funds whole. Neither keeps total state revenue whole.

### Evidence that would most reduce the uncertainty

1. What grocers would charge for wine and what margin they would accept. The sign depends on sellers keeping under
   3.9¢ per dollar at today's prices, or on prices rising with the same wine still moving.
2. DABS's operating cost that would actually stop per dollar of wine sales leaving the stores. It sets that 3.9¢.
3. DABS's wine sales by customer type, and any evidence on how much household buying would move. These set the size.
4. DABS's realized margin on wine. It changes the size with private supply.
5. Whether the monthly shelf-price totals include sales tax, and whether licensee sales are taxed. Both are small.

### Verification of these figures

Three different kinds of check stand behind this appendix. Only the first has been done in full.

- **Automated calculation checks.** They confirm the arithmetic and that the page, the scenario tool and the scripts
  agree. They say nothing about whether the source values were read correctly. Latest full run: `scripts\verify.bat`
  on Windows, 2026-10-17 16:31-16:37, with the project's own Windows environment, on the working tree that became
  the expense-definition checkpoint: data build `preview-cc3d8a301d37`, release validation (0 errors; 2 warnings,
  both about records awaiting human review), every report and both exports, pytest (all passed, including
  `tests/test_expense_labels.py`), ruff format and lint, vitest (23 files, 321 tests passed, including the guard
  that compares the page's copied FY2025 values with the freshly exported dataset) and the production build. The
  three Python scripts also agree with the TypeScript model. Log: `data\processed\verify\verify-windows.log`
  (gitignored).
- **Browser.** The page's layout at desktop and phone width was last checked in Chromium earlier on 2026-10-17, on a
  copy of the source in a cloud workspace, before the corrections of that evening. A check of the current build in a
  browser is recorded in the project's release notes when it is done.
- **AI-assisted source checks.** An AI assistant located each source value in its document and compared it (details
  in a review packet kept with the maintainer's private records). Such checks can miss a misread figure or a wrong reading of a passage. The statute and
  legislative texts were read through a web tool, not from saved copies.
- **Human review.** None yet. Every value stays unreviewed until a named reviewer records a check.

## Policy alternatives (added 2026-10-17)

The brief's two arrangements are kept as **reference cases** (Ref. 1 and Ref. 2, with the illustrative 5¢ saving). The
alternatives below change who supplies the wine, how grocers are paid and how the state collects, with the state stores
open. Every figure is computed by `web/src/lib/wineAlternatives.ts` (`wine-alternatives@1.0`) on the scenario engine,
exported by `npm --prefix web run export:grocery-wine` and recomputed independently by
`scripts/grocery_wine_alternatives_check.py`; this table is generated from that export. Plan and findings:
`docs/plans/grocery-wine-correction-2026-10-17.md`.

**What each alternative preserves.** *A* keeps DABS's **gross trading margin** per bottle (DABS sells to grocers at today's
shelf price): 47.2¢ per $1 of today's price, before operating expenses. *C (charge = DABS margin)* replaces that margin
with an **explicit state charge** of the same amount per bottle; it is a tax, a different legal mechanism, not DABS
revenue. *A (net contribution)* and *C (break-even)* preserve the **net fiscal contribution**: the statewide change is zero
at fixed volume. These are three different quantities.

**Fixed volume, FY2025, $ a year** (the same 30% of household wine moves; short-run avoidable cost 2.28¢ per $, a
source-based assumption; new administration $0.5M; handling for DABS supply set to zero, unknown). Columns: price vs a
state store with state sales tax; the change split into DABS trading margin, state taxes (charge plus sales tax),
avoidable operating costs and new costs; the total; the same with **no** avoidable cost; two conditional demand
readings; the grocer's gross margin as a share of its own selling price, under private supply after a wholesaler
keeping its assumed 29.5% (and, in brackets, what the grocer and any private wholesaler keep together per $1 of today's
price, which does not depend on that split); and the change for the school-meal and enforcement funds
(DABS supply: deposits on its sales to grocers / no deposits on them, two readings of current law; not added to the
total).

| Arrangement | Price | DABS margin | State taxes | Avoidable costs | New costs | Total | No savings | Fewer bottles | Buyers return to DABS | Grocer's gross margin (wholesaler and grocer together, per $1) | Funds |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Ref. 1: private, 20% tax | 0% | −$21.5M | +$7.6M | +$2.3M | −$0.5M | **−$12.1M** | −$14.4M | — | — | 10.1% (together 30.5¢) | −$5.3M |
| Ref. 2: DABS, 20% discount | 0% | −$9.1M | $0.0M | +$2.3M | −$0.5M | **−$7.3M** | −$9.6M | — | — | 20.0% (together 20.0¢) | −$1.1M / −$5.3M |
| A: DABS keeps margin, grocer 28% | +38.9% | $0.0M | +$0.9M | +$1.0M | −$0.5M | **+$1.4M** | +$0.4M | −$2.0M | +$1.1M | 28.0% (together 38.9¢) | $0.0M / −$5.3M |
| A: DABS keeps margin, matched price | 0% | $0.0M | $0.0M | +$1.0M | −$0.5M | **+$0.5M** | −$0.5M | — | — | 0.0% (together 0.0¢) | $0.0M / −$5.3M |
| A: net contribution kept, grocer 28% | +34.9% | −$1.3M | +$0.8M | +$1.0M | −$0.5M | **$0.0M** | −$1.0M | −$3.0M | −$0.1M | 28.0% (together 37.8¢) | −$0.2M / −$5.3M |
| B: 20% discount, matched | 0% | −$9.1M | $0.0M | +$1.0M | −$0.5M | **−$8.6M** | −$9.6M | — | — | 20.0% (together 20.0¢) | −$1.1M / −$5.3M |
| B: 20% discount, grocer 28% | +11.1% | −$9.1M | +$0.2M | +$1.0M | −$0.5M | **−$8.3M** | −$9.3M | −$9.0M | −$7.9M | 28.0% (together 31.1¢) | −$1.1M / −$5.3M |
| C: charge = DABS margin, sellers' margins | +51.2% | −$21.5M | +$22.6M | +$1.0M | −$0.5M | **+$1.7M** | +$0.6M | −$2.6M | +$1.3M | 28.0% (together 51.2¢) | −$5.3M |
| C: per-gallon charge at wholesaler | +51.2% | −$21.5M | +$22.6M | +$1.0M | −$0.5M | **+$1.7M** | +$0.6M | −$2.6M | +$1.3M | 19.3% (together 51.2¢) | −$5.3M |
| C: charge outside sales-tax base | +49.0% | −$21.5M | +$21.5M | +$1.0M | −$0.5M | **+$0.6M** | −$0.4M | −$3.5M | +$0.4M | 28.0% (together 51.2¢) | −$5.3M |
| C: break-even charge, sellers' margins | +47.7% | −$21.5M | +$20.9M | +$1.0M | −$0.5M | **$0.0M** | −$1.0M | −$3.8M | −$0.1M | 28.0% (together 51.2¢) | −$5.3M |
| C: break-even charge, matched | 0% | −$21.5M | +$20.9M | +$1.0M | −$0.5M | **$0.0M** | −$1.0M | — | — | −38.8% if the wholesaler keeps 29.5%: below acquisition cost, arithmetic only (together 1.2¢) | −$5.3M |
| C: 20% charge, matched | 0% | −$21.5M | +$7.6M | +$1.0M | −$0.5M | **−$13.3M** | −$14.4M | — | — | 10.1% (together 30.5¢) | −$5.3M |

- **Why the take-preserving rows gain.** A's +$1.4M is sales tax on the 38.9% higher
  price (+$0.9M) plus the assumed savings (+$1.0M) less new costs (−$0.5M); the
  DABS margin is unchanged. C's +$1.7M is the same pattern (+$1.1M,
  +$1.0M, −$0.5M); its charge exactly replaces the margin given up. Keeping the take per bottle
  does not by itself produce a gain.
- **Savings evidence.** The 2.28¢ is FY2025 card fees, package-agency contracts and bags divided by all-product sales: an
  allocation of accounting expense categories, not a measured marginal cost. With the stores open and DABS still
  supplying the wine, store rent and occupancy, staff (unless cut), systems, purchasing, warehousing and delivery,
  depreciation and interest remain. Any extra cost of serving many grocery stores is unknown and shown as zero; a
  1.05¢ sensitivity is in `cost_cases.csv`.
- **Demand readings are conditional sensitivities, not forecasts.** The elasticity (−0.46, Nelson 2013, market-wide)
  applies only to the wine that moves, at its grocery price. "Fewer bottles": the purchases no longer made at grocers
  leave the Utah market and do not return to DABS, while DABS's avoided store cost is still counted on all the wine that
  left its stores. "Buyers return to DABS": the same response read as those purchases staying at state stores at today's
  price. In both, the 30% share is fixed whatever the premium; the model has no channel-choice capability, and none was
  built.
- **Selling below cost is a constraint; national margins are not.** The break-even charge at today's price leaves the
  wholesaler and grocer together 1.2¢ per $1 of today's price (2.2% of their price before the charge). If the wholesaler
  kept its assumed 29.5%, the grocer would sell 20.9¢ below its acquisition cost (a −38.8% gross margin). That state
  break-even is therefore arithmetic only, not a workable arrangement as specified; it would need the wholesaler to take
  far less than 29.5%, and whether any seller would accept about 1¢ is not established. On the charge sweep at today's
  price (chart U5, dashed), the same split puts the grocer below its acquisition cost for any charge above about 33.5% of
  the sellers' price, where the two sellers together keep less than the wholesaler's assumed 22.1¢.
- **Margins are not profit.** A gross margin is the seller's price less what it pays, before its own costs. The 28% grocery
  figure is a national, all-product reference (Census 2022), not a known minimum for grocery wine; a row leaving a seller
  0% or 1.2¢ is an arithmetic result, not a claim that a business would accept it.
- **Legal and funding (unresolved).** New grocery licence authority (wine is liquor; 32B-1-102, 32B-7-201/-202); private
  supply needs new wholesale authority (32B-11-208, 32B-4-401(2)) and new taxing authority for a charge (no wine excise
  was found in the saved sources); a DABS discount above about 0.5% needs the 88.5% markup floor changed (32B-2-304(2)(b));
  whether DABS's sales to grocers carry the deposits is unresolved; whether a charge enters the sales-tax base depends
  on Title 59 definitions not saved. A guarantee or allocation of a charge to the funds would be the bill's choice, not
  current law.
- **Still uncertain in every row:** the wine-specific margin (47.2% is all products), the household share (82% is all
  products), local sales tax (not modelled), and how many purchases would move at a premium.

## Grocery price and grocery share (added 2026-10-18)

The alternatives above each fix one grocery price and one share moving. This section varies both, with the policy's
discount or charge held fixed, to show where the state's receipts and the grocer's margin stand across the range. It is
a **conditional sensitivity analysis**: no combination is predicted or given a probability. Every figure is computed by
`web/src/lib/winePriceShare.ts` (`wine-price-share@1.0`) through the same engine, exported to `price_share.json` and
`price_share_*.csv` by `npm --prefix web run export:grocery-wine`, and recomputed independently, cell by cell, by
`scripts/grocery_wine_alternatives_check.py`. The dashboard shows it on `?v=initiative`; graphs U9–U13 in the graph
package draw it.

**The grid** (1,248 cells). Grocery price premium over the same bottle at a state store, consumer price with the 4.85%
state sales tax on both sides: 0% to 60% in steps of 5. Share moving: 0% to 50% of **covered household purchases**,
$151,454,746 a year (FY2025 DABS wine sales, $184,700,910, times the 82% household share); purchases by bars,
restaurants and other licensees are not in the base. Four arrangements: DABS supplies grocers at today's price; DABS at a
20% discount; private supply with a 20% state charge; private supply with a 45.4% charge (the rate that collects DABS's
margin per bottle when sellers price for their reference margins). Two savings cases (2.28¢ source-based, or none) and
two volume bases (fixed volume, or the price response with the share assigned first and lost purchases leaving the
market). Administration costs $0.5M a year whatever moves, so every 0% row is −$0.5M; handling for DABS supply is the
zero placeholder. The grid reproduces the six named alternatives that lie on it exactly.

**Where receipts stay whole at the worked 30% share** (premiums searched up to 100%):

| Arrangement | Fixed volume, 2.28¢ savings | Fixed volume, no savings | Price response, 2.28¢ savings | Price response, no savings |
|---|---|---|---|---|
| DABS, today's price | every premium from 0%; the grocer is at cost (0%) at 0% and reaches 28% at 38.9% | from 22.7% (grocer 18.5%) | 0% to 6.5% only (grocer 0% to 6.1%) | nowhere |
| DABS, 20% discount | nowhere | nowhere | nowhere | nowhere |
| Private, 20% charge | nowhere | nowhere | nowhere | nowhere |
| Private, 45.4% charge | from 41.1% (grocer 22.8%) | from 47.4% (grocer 26.1%) | from 89.1% (grocer 42.4%), beyond the drawn grid | nowhere |

- **Fiscal break-even and seller margins are different constraints.** With DABS supplying at today's price, the state
  keeps its receipts at low premiums only because the grocer keeps almost nothing: it is at acquisition cost at 0% and
  below the 28% reference until a 38.9% premium. Under the 45.4% charge the grocer sells below its acquisition cost
  below an 8.9% premium (after the wholesaler's assumed 29.5%); those cells are arithmetic only.
- **Exploratory: the old price response lowers every positive-premium result.** At 30% moving and a 60% premium, DABS
  at today's price goes from +$1.9M to −$3.0M a year and the 45.4% charge from +$3.1M to −$2.0M. It counts purchases
  not made at grocers as leaving Utah, though DABS still sells the same bottles. The share does not respond to the
  premium in this grid; the purchase-flow section adds channel choice, in which declined purchases stay at DABS.
- **The 20% discount and the 20% charge lose everywhere shown:** about −$3M to −$5M a year at 10% moving and −$12M to
  −$24M at 50%, with or without savings.
- **Protected funds** depend on the share moving and the legal reading, not the price. At 30% moving: $0 for DABS at
  today's price if its sales to grocers carry the deposits; −$1.1M for the 20% discount on that reading; −$5.3M on the
  other reading and under private supply.
- **Not modelled:** a channel-choice response, substitution or cross-border recapture in the grid, guarantees to the
  funds, and local sales tax.

## Purchase flows: where grocery wine would come from (added 2026-10-19)

The sections above move existing DABS wine to grocers and nothing else. That answers one question: what happens to
state receipts when the same bottles are sold through a different store. It does not test the hypothesis that started
this work: that a shopper buying beer at a grocer might pick up wine on the same trip. This section adds that test. The
model is `web/src/lib/wineFlows.ts` (`wine-purchase-flows@1.0`). Its scenarios, grids and break-evens are exported to
`flows_*.csv` and recomputed independently by `scripts/grocery_wine_flows_check.py`.

**What changed from the earlier model:**

- **Five sources of grocery wine, kept apart.** A: wine households already buy at DABS. B: replacing beer. C: replacing
  spirits. D: wine now bought outside Utah. E: additional wine that replaces nothing. B to E may also be bought at DABS
  (a channel split each). The sources add up to the grocery total, and the lines explaining the state's change add up to
  it (both checked).
- **Before-and-after totals.** Receipts are computed for today and for the proposal from quantities by beverage and
  channel, in litres, litres of pure alcohol and dollars. The change is the difference. School-meals and enforcement
  deposits are reported as allocations under both legal readings and never added to the totals.
- **Preserved collection is an explicit, proposed design.** In the "preserved" designs the state collects today's
  markup on every grocery bottle: through DABS as wholesaler, or through a per-gallon charge equal to DABS's average
  markup. That is not current law. It does not preserve the consumer price: paying a grocer 28% takes the grocery price
  39% (DABS supply) or 51% (private supply) above the state store's. A third version holds both the markup and today's
  price; it leaves the grocer nothing and is a diagnostic only.
- **Channel choice replaces the old price response.** Earlier results applied a market-wide elasticity (−0.46) to the
  grocery price, as if every wine price had risen. They counted bottles not bought at a grocer as gone from Utah, though
  DABS still sells them at today's price. That treatment is now exploratory. In the channel-choice scenarios, 30% would
  move at equal prices and fewer move as the premium rises, in a straight line to none at a stated premium (15%, 30% or
  60%). Purchases that do not move stay at DABS unless a scenario says otherwise. This is an assumption, not an
  estimated model.
- **Beer and spirits are separated.** Wine replacing beer gains the state its markup or charge and sales tax on the
  wine. It loses the beer excise ($13.35 a barrel in FY2025, Utah Code 59-15-101; it also covers heavy beer since 2024)
  and the sales tax on the beer. Wine replacing spirits loses DABS's markup on the spirits. Substitution is participation
  (share of buyers who change) × intensity (share of their purchases replaced) × a purchase weight. It is held at
  constant pure alcohol by default, with equal-litre and equal-spending versions as checks. One 750 ml bottle of wine
  holds 88.5 ml of pure alcohol, as much as 5.2 twelve-ounce cans of beer or a third of a bottle of spirits.

**30% of household wine moving at any price, nothing else changing** (FY2025, $ a year):

| Design | State collects per $ of wine | Grocery price | Change |
|---|---:|---:|---:|
| Preserved, DABS wholesale (grocer 28%) | 47.2¢ | +39% | **+$1.4M** |
| Preserved, private supply and per-gallon charge | 47.2¢ | +51% | **+$1.7M** |
| Preserved at today's price (grocer 0%, diagnostic) | 47.2¢ | 0% | **+$0.5M** |
| DABS sells at a 20% discount (Reference 2) | 27.2¢ | 0% | **−$8.6M** |
| Private supply, 20% tax (Reference 1, with documented savings) | 16.7¢ | 0% | **−$13.3M** |

With the collection preserved, moving a bottle costs the state nothing in markup. The gains are sales tax on the higher
price and DABS store costs that fall with sales (2.28¢ a dollar, an estimate), less $0.5M of new administration (a
placeholder). The 20% designs reproduce the alternatives above exactly.

**Named scenarios** (every share below is illustrative; no Utah evidence gives any of them):

| Scenario | Preserved, DABS | Preserved, private | DABS 20% | Private 20% |
|---|---:|---:|---:|---:|
| Channel choice, none move at a 60% premium | +$0.2M | −$0.2M | −$8.6M | −$13.3M |
| Channel choice, none move at a 30% premium | −$0.5M | −$0.5M | −$8.6M | −$13.3M |
| Wine replaces 2% of households' beer (same alcohol) | +$6.4M | +$6.7M | −$5.7M | −$11.6M |
| Wine replaces 5% of households' beer (same alcohol) | +$13.9M | +$14.3M | −$1.5M | −$9.0M |
| Wine replaces 5% of households' spirits (same alcohol) | +$8.1M | +$8.5M | −$7.1M | −$14.4M |
| Wine from other states equal to 2% of household DABS wine | +$3.0M | +$3.3M | −$7.6M | −$12.7M |
| Additional wine equal to 2% of household DABS wine | +$3.0M | +$3.3M | −$7.6M | −$12.7M |
| DABS cuts wages and delivery with its lost sales (longer run) | +$5.3M | +$5.6M | −$4.7M | −$9.5M |
| Exploratory: the old price response | −$2.0M | −$2.6M | −$8.6M | −$13.3M |
| Exploratory: purchases that do not move (30% limit) are not bought at all | −$23.1M | −$23.1M | −$8.6M | −$13.3M |

The matched-price designs do not change with the grocery price, so channel choice leaves them where they are. All 21
scenarios, with every input and component, are in `flows_scenarios.csv`. Chart F9 draws them.

**Break-even at 30% moving, one source at a time:**

| Source | Preserved designs | DABS 20% discount | Private 20% tax |
|---|---|---:|---:|
| Beer replaced (same alcohol), share of households' beer | not needed | 6.1% | 15.3% |
| Spirits replaced (same alcohol), share of households' spirits | not needed | 29.2% | none: lowers receipts |
| Wine from other states, share of household DABS wine | not needed | 17.6% | 40.9% |
| Additional wine (more alcohol), share of household DABS wine | not needed | 17.6% | 40.9% |

Under channel choice with a 30% limit, nobody moves at the preserved designs' prices. The state is then out only the
$0.5M administration cost, and 0.2% of households' beer, or 0.6% more wine, would cover it. The break-even rises
steeply as the state's collection per bottle falls (chart F7). At today's price with a DABS discount, beer must replace
0.8% of households' beer at a 5% discount, 6.1% at 20% and 23.7% at 35%. Replacing spirits gives no break-even beyond a
22.5% discount.

**How large these shares are.** Wine replacing 5% of households' beer at the same alcohol means 1.6 million more
litres of wine a year (3.9 million fewer litres of beer). That is about 17% more than households buy at DABS today.
Replacing 5% of their spirits means 1.5 million litres. These are large changes in the wine market. Nothing measures
whether they would happen.

**What the evidence on switching says.** The only survey at hand (Wine Opinions, *Wine Behaviors of Age 21-39 Beverage
Alcohol Consumers*, July 2022, 631 U.S. respondents aged 21-39, screened to drink alcohol at least 2-3 times a month)
found that 23% of those who prefer beer already drink wine weekly or more often (p. 3). That is overlap that exists
today among surveyed U.S. drinkers under 40. It is not a Utah figure, not a switching rate, not an effect of grocery
availability and not a share of beer sales. It is not used as a parameter. Current overlap is not new demand.

**What these results do and do not show.**

- **More wine sold is not more alcohol.** At constant pure alcohol, wine sales rise and beer or spirits sales fall by
  the same alcohol. Equal litres of wine for beer, or additional wine, do add alcohol (chart F4).
- **Whether grocery wine raises or lowers state receipts depends on two things.** One is how much the state collects
  per grocery bottle. The other is where the wine comes from. Moving existing purchases does not cost the state money in
  itself: it does so only when the arrangement collects less per bottle than DABS's markup. An arrangement does not need
  new drinking to pay for itself. It can keep receipts with a preserved collection, or offset a reduced one through
  substitution or recapture. But no evidence says how much of either would happen.
- **Price and receipts.** Preserving both the state's collection and today's consumer price leaves no margin for the
  grocer. Within these assumptions, every design that pays grocers a national-average margin either raises the grocery
  price or collects less per bottle.
- **The arithmetic is verified; the behaviour is not.** The independent check recomputes every scenario, grid point and
  break-even with separate closed forms. That shows the numbers follow from the inputs, not that any behavioural input
  is right.
- **Tennessee is not a direct comparison.** Its receipts rose after grocery wine. But wine and spirits there were
  already sold by private licensees, grocery wine was a local option, and its wine-tax account covers every seller. The
  before-and-after comparison is descriptive. It cannot tell how much of Utah's grocery wine would be switching,
  recapture or new purchases.

## What the evidence supports, what is assumed, what is unknown

- **Supported (from documents; AI-assisted source checks only, not reviewed by a person):** DABS's FY2025 sales and gross profit; the wine share; the statutory
  markup and deposit rates; the beer excise; NIAAA volumes and alcohol content; the school-meals funding figures above.
- **Assumed:** 30% of household purchases move; households buy 82% of wine (DABS's FY2025 off-premise share of
  all-product sales, p. 18; the chart does not say whether it measures dollars or volume); 5¢ avoided cost
  per dollar; $500,000 new licensing and enforcement cost; the all-product margin applies to wine; matched prices; the sellers' margins (national,
  all products); the beer price; in the purchase-flow model, every share of switching, recapture and additional buying
  and the straight-line convenience limits (illustrative, never estimated).
- **Unknown:** what grocers would charge and accept; DABS's wine sales by customer type; DABS's marginal operating
  cost; whether DABS's sales to grocers would carry the deposits; whether DABS's sales to licensees carry sales tax;
  local sales tax effects; whether grocery wine would replace beer, spirits or out-of-state purchases, or add to them;
  how many shoppers would buy at a grocer at a given premium; any change in total drinking; an unexplained ~$16 million gap in the audited FY2023–FY2024 fund revenue (it does not affect FY2025).
- **What would most change the result:** where grocery wine comes from (beer, spirits, other states or nothing) and
  how much the state collects per grocery bottle; for the reference arrangements, what sellers keep per dollar
  (grocers accepting margins near 4%) or higher grocery prices. Store savings cannot reverse it within DABS's own expenses, and the wine margin only below what
  even the small-winery markup implies ("How robust is the loss?"). The dashboard's sensitivity chart shows each
  input's effect.

## Questions to put to DABS or legislative fiscal staff

1. DABS: wine sales to licensees vs. other buyers, wherever the sale is made, FY2023–FY2025. (A request is drafted:
   docs/gaps/utah-missing-records.md, request C, not sent.)
2. DABS: the realized average markup and gross margin on wine, not all products.
3. DABS: which operating costs would actually fall per dollar of wine sales lost.
4. Legislative General Counsel: would DABS's wholesale sales to grocers count as "total gross revenue from sales of
   liquor" under §§ 32B-2-304(5) and -305(4)? Would arrangement 2 need § 32B-2-304(2)(b)'s 88.5% markup floor amended?
5. Legislative Fiscal Analyst: the share of school-meal funding from liquor money, by year, and the denominator behind
   any "50%" figure.
6. Legislative Fiscal Analyst: how a fiscal note would treat channel shift, price response and substitution.
7. Tax Commission: is local sales tax collected on state-store sales the same way it would be at grocers?

Organizations that may help, not yet contacted or researched: grocers' and retailers' trade groups in Utah, the Food
Industry Association (it released a 2024 Tennessee grocery-wine study), and nonpartisan legislative staff.

## Worked example (reproducible)

- Dashboard: `alcohol-data dashboard export`, then `cd web && npm run dev`, then open `?v=initiative` (this brief as a
  page) or `?v=scenario&eg=compare_fy2025` (the full tool; method `utah-wine-arrangements@1.1`).
- By hand: `python scripts/grocery_wine_briefing_example.py` recomputes every figure in this briefing with closed-form
  arithmetic and checks it against the TypeScript model; `python scripts/grocery_wine_robustness_check.py` does the
  same for the robustness section, and `python scripts/dabs_wine_class_mix.py` reproduces the wine class mix from the
  saved monthly reports.
- Substitution: `web/src/lib/substitution.ts` (method `beer-wine-substitution@1.0`), tests in `substitution.test.ts`.
- Purchase flows: `web/src/lib/wineFlows.ts` and `wineFlowScenarios.ts` (method `wine-purchase-flows@1.0`), tests in
  `wineFlows.test.ts` and `wineFlowScenarios.test.ts`; exported by `npm --prefix web run export:grocery-wine`
  (`flows_*.csv`, `flows.json`) and recomputed by `python scripts/grocery_wine_flows_check.py`.
- Input-by-input sources: docs/review/utah-grocery-wine-comparison-packet.md. Equations and evidence:
  docs/review/grocery-wine-model-audit.md.

## Sources

- DABS 90th Annual Report (FY2025); DABS monthly Sales Analysis Reports (July 2025 – June 2026); State of Utah ACFR
  FY2025. Saved and pinned in the project.
- Utah Code § 32B-1-102 (version effective 2026-05-06), § 32B-2-304 (versions effective 2024-05-01 and 2026-03-13),
  § 32B-2-305 (version effective 2024-05-01), § 59-15-101 and § 59-12-103 (le.utah.gov). Tax Commission combined
  sales tax rate tables, FY2025 quarters.
- NIAAA Surveillance Report 124 data file (per-capita and volume series, 2024).
- Utah Office of Legislative Research and General Counsel, *School Meals Programs* (revised 2025-01-16):
  https://le.utah.gov/interim/2025/pdf/School_Meals_Programs.pdf
- Office of the Legislative Fiscal Analyst, fiscal note, 1st Sub. S.B. 180, School Nutrition Amendments (2026-02-25):
  https://pf.utleg.gov/public-web/sessions/2026GS/fiscal-notes/SB0180S01.fn.html
- FOX 13, "How state-controlled alcohol sales provide some free meals for children in need" (2024-05-08):
  https://www.fox13now.com/news/politics/how-state-controlled-alcohol-sales-provide-some-free-meals-for-children-in-need
- Census Annual Wholesale Trade Survey table 4 (NAICS 4248, 2022r, cell E73) and Annual Retail Trade Survey gross
  margins (NAICS 4451, 2022r, cell C16); local copies appear to be the August 2026 revised releases.
- Nelson (2013), Health Economics Review 3:17; Hahn et al. (2012), Am J Prev Med 42(4):418-427.
- Wine Opinions, *Wine Behaviors of Age 21-39 Beverage Alcohol Consumers* (report on a July 2022 survey of 631 U.S.
  consumers aged 21-39), p. 3. A local copy was read; where it was obtained is not recorded (source lead
  `lead_wine_opinions_under40_2022`). Cited for existing overlap only.
