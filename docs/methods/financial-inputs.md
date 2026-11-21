# Financial inputs: grocery-wine model

- **Status:** a proposal for review by qualified legal and fiscal experts. Not enacted law, not legal advice, not attorney-reviewed, and not reviewed by a person. Written with AI assistance (Claude) for Ethan Whipple.
- **Generated** from `web/src/lib/wineAlternatives.ts` (`ASSUMPTIONS`) and `web/src/lib/policyDesigns.ts` by `npm run docs:framework` (in `web/`); edit the data, not this file. Methods: statute-matrix@1.0, policy-designs@1.0.

Every input behind the grocery-wine results, classed as the development plan of 2026-11-19 asks (section 14). **No value has been reviewed by a person**: official figures were transcribed or parsed by software and checked by an AI assistant, which is not a human review. Agreement between the TypeScript model and the independent Python checks verifies arithmetic, not inputs.

| Id | Input | Value | Class | Source or note |
|---|---|---|---|---|
| U01 | Wine sales, FY2025, at state-store prices before sales tax | $184.7M (33.5% of DABS's $551.3M) | Calculated from source data | DABS FY2025 liquor sales times wine's share of gross sales in the twelve FY2026 monthly reports. |
| U02 | Gross margin on wine (DABS trading margin as a share of its selling price) | 47.21% | Model assumption | DABS's FY2025 all-product gross profit over sales, applied to wine. The 88.5% minimum markup on landed cost implies 46.95%. |
| U03 | Households' share of wine purchases | 82% | Model assumption | DABS's FY2025 all-product off-premise share, applied to wine; licensees keep buying from DABS. |
| U04 | Household wine purchases that move to grocers | 30% | Illustrative scenario | No source. Not price-dependent in the engine: the same share moves whatever the grocery price. |
| U05 | State sales tax | 4.85% | Official source; that it applies to FY2025 is an assumption | State portion only (Publication 25). Local sales tax is not modeled: whether state-store sales carry it as grocery sales would is unresolved. |
| U06 | School-meals and enforcement deposits | 10% and 1.695% of total gross revenue from liquor sales | Official source (law as read online) | Utah Code §§ 32B-2-304(5), 32B-2-305(4). Whether DABS's sales to grocers count is unresolved; both readings are shown. |
| U07 | Short-run avoidable store cost per $ that leaves (stores stay open): a source-based assumption | 2.28¢ | Model assumption | FY2025 card fees, package-agency contracts and bags divided by all-product sales: an allocation of accounting expense categories, not a measured marginal cost or demonstrated saving. Every alternative is also shown with no avoidable cost. Costs that remain while the stores stay open and DABS keeps supplying wine: store rent and occupancy, staff unless cut, systems, purchasing, warehouse and delivery, depreciation and interest. |
| U08 | Conditional longer-run reductions | wages 7.51¢; delivery 1.05¢ (private supply only) | Model assumption | Only if staffing, or DABS's delivery runs, fall in proportion to the sales that leave. Not in the main cases. |
| U09 | Rent, systems, depreciation and interest | not avoidable | Model assumption | The stores stay open, so these do not fall with sales. |
| U10 | New licensing, enforcement and administration | $500,000 a year | Illustrative scenario | No estimate exists. |
| U11 | Additional wholesale handling or distribution cost of supplying grocers | unknown: zero is a placeholder in the main cases; 1.05¢ per $ as a sensitivity | Model assumption | DABS keeps buying, storing and delivering the wine, so its existing wholesale costs remain (not saved). Any extra cost of serving many grocery stores (order handling, more delivery stops) is unmeasured; private supply's distribution costs are inside the private margins. |
| U12 | Retailer gross-margin target | 28.0% | Reference point, not measured for this use | Census ARTS 2022, grocery stores (NAICS 4451), national, all products: a reference point, not a proven minimum for grocery wine. |
| U13 | Private wholesaler gross margin | 29.5% | Reference point, not measured for this use | Census AWTS 2022, beer, wine and spirits merchant wholesalers (NAICS 4248), national. |
| U14 | Private sellers' acquisition cost | 52.79% of today's price | Model assumption | Private wholesalers pay suppliers what DABS pays (its landed cost). |
| U15 | Price elasticity of wine demand | -0.46 | External scholarly estimate | Nelson (2013), a meta-analysis of market-level studies. Applying it to one channel's price is the assumption. |
| U16 | Wine gallons and average price per gallon | 3.30M gallons; $56.00 a gallon | Calculated from source data | NIAAA 2024 Utah wine gallons; wine sales over gallons (both include licensees). |
| U17 | Historical reference cases | 5¢ avoided cost; 20% replacement tax; DABS at 80% of the shelf price; matched prices | Reference point, not measured for this use | The brief's worked example of 2026-10-17, kept unchanged for comparison. |
| U18 | Recapture and access in the demand sensitivity | recapture 2%; access +4.5% | Illustrative scenario | Recapture has no source. Access is the lower quartile after full retail privatization elsewhere, not grocery licensing in Utah. Neither is a probability. |
| P01 | Convenience limits (price-sensitive cases) | 60%, 30%, 15% | Illustrative scenario | The grocery premium at which no household moves; from the purchase-flow model (F20), no source. |
| P02 | Hybrid: DABS's share of grocery wine | 50% | Illustrative scenario | No design specifies the split. |
| P03 | Hybrid: second collection system | 50% of the administration | Illustrative scenario | No estimate exists. |
| P04 | Illustrative bottles, landed cost | $5, $8, $12, $20 | Illustrative scenario | Price points, not products; no product's procurement cost is in the dataset. |
| P05 | Utah grocery establishments | 411 (2023) | Official source, transcribed by software | Census County Business Patterns, NAICS 445110; used only to size a license fee. |
| P06 | Largest competitive grocery premium | 10% | Policy choice | A threshold for the classification, not a source; changing it changes only the verdicts. |
| P07 | Smallest viable grocer margin | 28% | Reference point, not measured for this use | U12, used as a threshold. |
| P08 | Direct supply: delivery cost and producer price grid | 0.0%, 10.0%, 20.0%, 29.5% × 0%, 10%, 20% | Illustrative scenario | Neither is measured; D is reported across the grid. |

**Unavailable or unknown:** DABS's avoidable costs by store, delivery cost to grocers, how households choose a channel at a given price difference, grocers' margins on wine in Utah, package-agency contract terms, and the cost of licensing and enforcement. Each appears above as an assumption or an illustrative value, never as a measurement.
