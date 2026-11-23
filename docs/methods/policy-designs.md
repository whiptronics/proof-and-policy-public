# Five grocery-wine designs: derivations

- **Status:** a proposal for review by qualified legal and fiscal experts. Not enacted law, not legal advice, not attorney-reviewed, and not reviewed by a person. Written with AI assistance (Claude) for Ethan Whipple.
- **Generated** from `web/src/lib/policyDesigns.ts` by `npm run docs:framework` (in `web/`); edit the data, not this file. Methods: statute-matrix@1.0, policy-designs@1.0.

The technical appendix for the design comparison on `?v=designs`, the two-page briefing (`legislative-briefing.pdf`) and the policy pages. Every number below is computed by the same code the site runs. `scripts/policy_designs_check.py` recomputes them in Python from the export, with closed forms written separately. Conditional results, not forecasts or a fiscal note. The older sections of `docs/briefings/utah-grocery-wine/technical-appendix.md` count allocated store savings in their headlines; this comparison does not.

## Units and terms

Money is per $1 of today's state-store shelf price before sales tax, or FY2025 dollars a year. Sales tax applies to the state store and the grocer at the same rate, so a price ratio before tax is the same after it. The terms are read from the engine (`terms()`), never retyped:

| Symbol | Term | Value |
|---|---|---|
| W | DABS wine sales, all buyers, at state-store prices | $184.70M a year |
| H | Households' share of DABS wine | 82.0% |
| s₀ | Share of household purchases that moves at equal prices | 30.0% |
| M | Wine that moves at s₀ (W × H × s₀) | $45.44M a year |
| L | DABS's landed cost per $ | 52.8% |
| μ | DABS's gross margin per $ (L + μ = 1) | 47.2% |
| τ | State sales tax rate | 4.85% |
| A | New administration, $ a year (a placeholder; no estimate exists) | $0.50M |
| g | Grocer gross margin on its own price (reference: Census ARTS 2022, grocery stores, NAICS 4451, national, all products) | 28.0% |
| w | Wholesaler margin on its own price (reference: Census AWTS 2022, beer, wine and spirits merchant wholesalers, NAICS 4248, national) | 29.5% |

## Consumer price

*P* is the grocery price per $1 of today's state-store price; the premium is *P* − 1.

- **B, DABS wholesale at today's shelf price.** The grocer pays DABS $1 and prices for margin *g*: *P* = 1 / (1 − *g*).
- **C, private wholesale with a state charge equal to DABS's margin.** The wholesaler buys at *L* and prices for *w*, the grocer prices for *g*, and the charge μ is added: *Q* = *L* / ((1 − *w*)(1 − *g*)), *P* = *Q* + μ.
- **D, direct supply.** A producer's delivery cost and price to grocers take the wholesaler's place; neither is measured, so D is shown across a grid (below). At the reference inputs its results equal C's.
- **E, hybrid.** DABS supplies 50% of grocery wine on B's terms and private supply the rest on C's; a second collection system adds 50% of *A*. Both shares are illustrative.

## Net change for the state per dollar that moves

With *s* the DABS cost avoided per $ that moves (zero in every headline), *a* = *A* / *M* the administration per $, and *h* any extra cost of supplying grocers (zero):

- Take inside DABS's price to grocers (B): *N* = *P*(1 − *g*) − *L* − μ + τ(*P* − 1) + *s* − *h* − *a*.
- Take as a charge on the sellers' price (C, D): *N* = *P* − *Q* − μ + τ(*P* − 1) + *s* − *a*.

Each wine dollar that moves takes DABS's margin μ out of today's receipts. B and C put exactly μ back, so with no savings each design's gain is the sales tax on the higher price, τ(*P* − 1): 1.89% per $ under B and 2.48% under C, before the administration.

## Who moves

The share of household purchases that moves is s₀ at equal prices. In the price-sensitive cases it falls in a straight line to zero at a convenience limit λ: share = s₀ × min(1, max(0, 1 − (*P* − 1) / λ)), with λ in {60%, 30%, 15%}. The limits come from the purchase-flow model and have no source. The wine that moves is *V* = *M* × share / s₀, and the annual result is *N* × *V* − *A* (the engine counts *A* once, whatever moves).

## Break-even conditions

- **Share that must move** (the engine is linear in the share): *s*\* = min(1, −Net(0) / slope), where Net(0) is the result when nothing moves (−*A*) and the slope is the change per unit of share.
- **Highest grocer margin at price *P*.** B: *g*\* = 1 − (*L* + μ − τ(*P* − 1) − *s* + *h* + *a*) / *P*. C, D: *g*\* = 1 − *L* / ((1 − *w*)(*P* − μ + τ(*P* − 1) + *s* − *a*)).
- **Lowest price at margin *g*.** B: *P*\* = (*L* + μ + τ − *s* + *h* + *a*) / (1 − *g* + τ). C, D: *P*\* = (*Q* + μ + τ − *s* + *a*) / (1 + τ).
- **Highest distribution margin at price *P* and margin *g*** (C, D): *w*\* = 1 − *L* / ((1 − *g*)(*P* − μ + τ(*P* − 1) + *s* − *a*)).

Every solution is bounded: a share in [0, 1], a margin below 1, a price to grocers no lower than DABS's landed cost. No break-even is found by adding demand.

| Design | Share that must move, no savings / allocated | Lowest premium at a 28% grocer margin, no savings / allocated | Grocer margin at a 10% premium, no savings (negative: no margin works) | Savings per $ needed at its own lever |
|---|---|---|---|---|
| B. DABS wholesale to licensed grocers | 17.5% / 7.9% | 37.9% / 34.9% | 8.5% | 0.00¢ |
| C. Licensed private wholesale | 13.3% / 6.9% | 49.9% / 47.7% | −20.4% | 0.00¢ |
| D. Authorized direct supply | 13.3% / 6.9% | 49.9% / 47.7% | −20.4% | 0.00¢ |

At a 28% grocer margin with no savings, the state breaks even at a premium of 37.9% with the take in DABS's price, 49.9% with a retail-level charge and a 29.5% wholesaler, and 20.6% if delivery cost nothing. A charge design matches B's lowest premium only if delivery costs less than 19.8% of the price to grocers.

## Results

Net change in state revenue against today, FY2025 dollars a year. The savings cases are illustrative and never in a headline:

- **No store costs counted as saved.** No avoidable DABS cost is measured. The plan's rule: zero in the main result, illustrative savings apart.
- **FY2025 card fees, agency contracts and bags, allocated by sales (2.28¢ per $).** An allocation of accounting expense categories by sales share, not a measured or realized saving. Card fees plausibly fall with sales. Agency contracts fall only if the wine that moves came from agencies paid by volume. Bags are small.
- **Plus wages falling in proportion to sales (+7.51¢ per $).** Only if staffing were cut in proportion to the sales that leave, after a transition. No staffing plan exists.

| Design | Premium | Savings case | fixed 30% share | limit 60% | limit 30% | limit 15% |
|---|---|---|---|---|---|---|
| B: DABS wholesale | 38.9% | none | +$0.36M | −$0.20M | −$0.50M | −$0.50M |
| B: DABS wholesale | 38.9% | allocated | +$1.39M | +$0.17M | −$0.50M | −$0.50M |
| B: DABS wholesale | 38.9% | longer run | +$4.81M | +$1.37M | −$0.50M | −$0.50M |
| C: private wholesale | 51.2% | none | +$0.63M | −$0.33M | −$0.50M | −$0.50M |
| C: private wholesale | 51.2% | allocated | +$1.66M | −$0.18M | −$0.50M | −$0.50M |
| C: private wholesale | 51.2% | longer run | +$5.08M | +$0.32M | −$0.50M | −$0.50M |
| D: direct supply | 51.2% | none | +$0.63M | −$0.33M | −$0.50M | −$0.50M |
| D: direct supply | 51.2% | allocated | +$1.66M | −$0.18M | −$0.50M | −$0.50M |
| D: direct supply | 51.2% | longer run | +$5.08M | +$0.32M | −$0.50M | −$0.50M |
| E: hybrid | 45.0% | none | +$0.24M | −$0.52M | −$0.75M | −$0.75M |
| E: hybrid | 45.0% | allocated | +$1.28M | −$0.26M | −$0.75M | −$0.75M |
| E: hybrid | 45.0% | longer run | +$4.69M | +$0.59M | −$0.75M | −$0.75M |

License fees that cover the administration exactly add +$0.50M to every case (+$0.75M for E): about $1,217 a year for each of 411 grocery establishments (Census County Business Patterns 2023). That is a design choice, not a result.

## Direct supply across its unmeasured inputs (no savings)

| Delivery cost, share of the price to grocers | Producer's price over DABS's landed cost | Premium | Fixed share | Limit 30% |
|---|---|---|---|---|
| 0.0% | 0% | 20.5% | −$0.05M | −$0.36M |
| 0.0% | 10% | 27.9% | +$0.11M | −$0.46M |
| 0.0% | 20% | 35.2% | +$0.28M | −$0.50M |
| 10.0% | 0% | 28.7% | +$0.13M | −$0.47M |
| 10.0% | 10% | 36.8% | +$0.31M | −$0.50M |
| 10.0% | 20% | 45.0% | +$0.49M | −$0.50M |
| 20.0% | 0% | 38.9% | +$0.36M | −$0.50M |
| 20.0% | 10% | 48.0% | +$0.56M | −$0.50M |
| 20.0% | 20% | 57.2% | +$0.76M | −$0.50M |
| 29.5% | 0% | 51.2% | +$0.63M | −$0.50M |
| 29.5% | 10% | 61.6% | +$0.86M | −$0.50M |
| 29.5% | 20% | 72.0% | +$1.09M | −$0.50M |

## What is measured and what is not

- **From sources (software-transcribed, not reviewed by a person):** W (DABS's FY2025 sales times wine's share in its monthly reports), the grocery establishments (Census CBP), and *g* and *w* as national references (Census 2022 retail and wholesale trade, all products), not measured for wine in Utah.
- **Assumed:** μ and L (DABS's FY2025 all-product gross margin, applied to wine); H (DABS's FY2025 off-premise share of all its sales, read from a chart, applied to wine); τ (the state portion in Tax Commission Publication 25, taken as FY2025's rate); s₀, the convenience limits, *A* and the hybrid's shares (illustrative); that grocers price for *g* on wine; and that state-store prices stay as they are.
- **Not modeled:** drinking more or less, beer or spirits switching (see the purchase-flow section of the technical appendix), out-of-state purchases, rural package agencies' contracts, delivery to grocers under B, enforcement costs beyond *A*.
- Every input with its provenance class: [`financial-inputs.md`](financial-inputs.md).

## Reproduce

In `web/`: `npm run export:grocery-wine` writes `data/processed/grocery-wine/policy_designs.json` and `policy_designs_*.csv`; `npm run docs:framework` rewrites this file; `npm run brief:legislative` rewrites the two-page briefing. Then `python -B scripts/policy_designs_check.py` recomputes every figure, and `npx vitest run src/lib/policyDesigns.test.ts` checks the closed forms against the engine. A passing check verifies arithmetic only.
