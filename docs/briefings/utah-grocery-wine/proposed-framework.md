# Proposed Utah grocery-wine framework

- **Status:** a proposal for review by qualified legal and fiscal experts. Not enacted law, not legal advice, not attorney-reviewed, and not reviewed by a person. Written with AI assistance (Claude) for Ethan Whipple.
- **Generated** from `web/src/lib/framework.ts` by `npm run docs:framework` (in `web/`); edit the data, not this file. Methods: statute-matrix@1.0, policy-designs@1.0.

None of the four alternatives to today (B to E) meets all three constraints (the state breaking even with no savings under every convenience limit, a grocery price within 10% of a state store, and a grocer margin of at least 28%). The framework is built on design B, the best-supported one, and says what would have to be true for it to work: 5 conditions, listed at the end.

## The fourteen points

1. **Eligible stores.** Grocery stores only in a first phase: an off-premise beer retailer whose main business is food, by a test the bill sets (share of sales from food, or floor area). Utah had 411 grocery establishments in 2023 (Census County Business Patterns, NAICS 445110). Convenience stores would wait for the review in point 12. *Basis: M01, M02; Colorado converted every beer retailer, convenience stores included; about half of Pennsylvania's wine permits are held by convenience stores (Other States).*
2. **Products.** Sealed wine for consumption off the premises. No spirits, no on-site drinking, and a container limit set in the bill (beer's is 2 liters). *Basis: M01, M11.*
3. **Licensing.** A grocery wine license issued by the commission after a department investigation, with the local authority's written consent, a floor plan of the wine display, and fees set to cover the new administration. *Basis: M02, M10.*
4. **Supply.** DABS sells wine to licensed grocers below its shelf price and delivers it; the gap is the grocer's margin (Pennsylvania's licensees buy at 10% below retail). DABS's price to grocers is the bill's main fiscal setting: at 90% of the shelf price, with fees covering the administration, the state gives up $4.54 million a year if DABS saves nothing and $0.09 million if its wages fall with sales (Same shelf price). A retail-level charge with licensed private wholesale (C) is the alternative if the Legislature prefers private distribution. Direct producer supply (D) waits until delivery costs and the federal permit question are answered. *Basis: M03, M04; Pennsylvania Liquor Code 305(b); Same shelf price; M05 to M07 for C; M06, M16 for D.*
5. **Revenue collection.** The state's take stays inside DABS's price to grocers, so no new tax is needed. The bill sets that price apart from the 88.5% markup floor (32B-2-304(2)(b)), which today would keep it at 99.51% of the shelf price or more, and states whether DABS's sales to grocers count toward the dedicated deposits. *Basis: M04, M09; 32B-2-304.*
6. **Retail prices.** Grocers sell wine at the price the commission fixes, the state-store price, as state stores and package agencies must (32B-2-503(2), 32B-2-605(7)), so a bottle costs the same in either store. Pennsylvania instead lets grocers set their own prices, never below cost, and the one report found says they charge a little more. *Basis: 32B-2-503, 32B-2-605 (pinned); Other States.*
7. **Enforcement.** DABS licenses and disciplines; the Department of Public Safety's compliance-check reimbursement and the commission's violation records extend to grocery wine; local police run the checks. *Basis: M15.*
8. **Public-health safeguards.** Training before anyone sells wine; ID checked on every sale, electronically at the register; a seller's minimum age the bill sets (beer allows 16 under supervision; Pennsylvania requires an 18-year-old trained cashier at a designated register); a wine display rule; local distance rules. *Basis: M10 to M13; Safeguards.*
9. **State stores.** State stores keep the full wine range and every spirit. DABS's warehouse still handles every bottle; its stores lose up to 24.6% of DABS's wine sales if 30% of household purchases move. *Basis: Economics, business impacts.*
10. **Package agencies.** DABS pays package agencies a fixed amount a year from a published grid, by bottles sold and average bottle price; the bill could keep or adjust their terms where a grocer nearby is licensed. A grocer could take some of an agency's wine sales; the effect is not estimated. *Basis: 32B-2-601, -605 (pinned); DABS compensation grid FY27 (pinned).*
11. **Implementation costs.** The model's $0.50 million a year of new administration is a placeholder: no estimate exists. Covered by fees, it is $1,217 a year per store if all 411 grocery establishments were licensed. One-time costs (rules, systems, training) are not estimated. *Basis: Business impacts.*
12. **Review and reporting.** DABS reports each year on licenses by county, wine sold to grocers, compliance-check results and revenue; a fiscal review after three years decides whether to continue, change or extend the program. *Basis: Monitoring indicators.*
13. **Effective dates.** Licenses issued no earlier than a year after enactment, once rules, training and the supply contract are ready; existing beer licensees apply, with no automatic conversion. *Basis: Colorado's automatic conversion drew the objection that it allowed no local review (Blue Book argument against).*
14. **Modification or suspension.** Triggers set in rule (a compliance-check failure rate, or wine revenue below the baseline) require a review and allow the commission to pause new licenses; the program ends unless reauthorized. *Basis: Monitoring indicators.*

## Phased implementation

| Option | Benefit | Cost |
|---|---|---|
| Grocery-only first phase | Starts with the stores that fit the proposal's purpose and the smallest number of new outlets. | Draws a line between grocery and convenience stores that the bill must define and DABS must police. |
| A cap or pilot by county | Gives a comparison group for evaluation. | Unequal access by place, and a cap can make licenses valuable and contested. |
| A statutory review and sunset | Forces the indicators to be collected and read. | Uncertainty for stores deciding whether to invest in a wine section. |

A grocery-only first phase with a three-year review is the simplest staged design. A pilot by county would make evaluation stronger but treats residents unequally; whether that is lawful was not checked.

## What would need to change for a design to meet every constraint

- Collect the state's take as a retail-level charge rather than inside the wholesale price. A percentage grocer margin then does not apply to it: at a 28% grocer margin the lowest break-even premium falls from 37.9% (B) to 20.6% if distribution cost nothing, and rises to 49.9% at the private wholesaler's reference margin.
- Grocers accepting a lower margin on wine than the 28% all-product reference: at a 10% premium the state breaks even (no savings) with a grocer margin of 8.5% under B.
- Cover the fixed administration with license fees so that low participation cannot turn the result negative: $1,217 a year per store if all 411 grocery establishments (CBP 2023) were licensed.
- Measure DABS's avoidable costs. Without them, every saving is illustrative and the headline stays at zero.
- Measure how households choose between a grocer and a state store at a given price difference. The 15%, 30% and 60% convenience limits are scenarios, not estimates.

The legal changes each point needs are in `statutory-change-matrix.md`.
