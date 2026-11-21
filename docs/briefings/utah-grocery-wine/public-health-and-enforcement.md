# Public health, underage sales and enforcement

- **Status:** a proposal for review by qualified legal and fiscal experts. Not enacted law, not legal advice, not attorney-reviewed, and not reviewed by a person. Written with AI assistance (Claude) for Ethan Whipple.
- **Generated** from `web/src/lib/framework.ts` by `npm run docs:framework` (in `web/`); edit the data, not this file. Methods: statute-matrix@1.0, policy-designs@1.0.

## What the research says

- **Outlet density.** The Community Preventive Services Task Force recommends using regulatory authority, such as licensing and zoning, to limit alcohol outlet density, on sufficient evidence (February 2007; 39 studies through November 2006). Policies that increased density were associated with more excessive drinking and related harms. ([finding](https://thecommunityguide.cdc.gov/findings/alcohol-excessive-consumption-regulation-alcohol-outlet-density.html), read 2026-11-19)
- **Privatization.** The Task Force recommends against further privatization of retail alcohol sales where government controls them, on strong evidence that privatization raises per capita consumption (April 2011; median rise of 44.4% in per capita sales of the privatized beverage across 18 studies). A grocery wine license privatizes part of wine retail. ([finding](https://thecommunityguide.cdc.gov/findings/alcohol-excessive-consumption-privatization-retail-alcohol-sales.html), read 2026-11-19)
- **Tennessee.** This project's descriptive comparison found wine purchases rising faster than in neighboring states after 2016 and total alcohol rising by an amount ordinary for those states; it is not a causal estimate.

More grocery outlets are not harmless. Under the framework grocery prices equal state-store prices, so no price gap damps the availability effect; if grocers set their own prices (the model's +39% under B), a higher price would damp it by an amount not measured.

## Safeguards against current law

Checked against the Utah Code read on 2026-11-19 (see the matrix's sources) before calling anything new.

| Safeguard | Current law for off-premise beer | Citation | Status | Proposal for wine |
|---|---|---|---|---|
| A state-issued license | Off-premise beer needs a commission-issued state license (since July 1, 2018) and a local license. | 32B-7-401, -402; 32B-7-201 | Already required for off-premise beer | The same for wine, as its own license (M02). |
| ID checks | Proof of age before every sale, and an interdiction check on Utah licenses. Electronic verification only for designated-stall pickup. | 32B-7-202(12); 32B-1-407 | Partly in place | Electronic verification on every wine sale (M13). |
| Staff training | Managers and staff complete an alcohol training seminar before starting work; managers take the department's program within 30 days. | 32B-1-703, -704 | Already required for off-premise beer | Extend to wine staff (M12). |
| Compliance checks | Public Safety reimburses local police for alcohol compliance checks at off-premise beer retailers and reports on them yearly. | 32B-7-305 | Already required for off-premise beer | Extend and fund from license fees (M15). |
| Penalties for sales to minors | Class B misdemeanor if negligent or reckless, class A if knowing; repeat violations within 36 months require retraining; the commission records each violation. | 32B-4-403; 32B-1-704(5); 32B-1-705 | Already required for off-premise beer | Applies to anyone already; records and retraining extend with M12 and M15. |
| Suspension and revocation | A local authority may suspend a beer license if training lapses; the commission disciplines state licensees, and a master license answers for its locations' violations. | 32B-1-702(3); 32B-7-202(1); 32B-7-408(6) | Already required for off-premise beer | The same disciplinary path for wine licenses. |
| Display and storage | Beer shown in no more than two places, apart from soft drinks, with a set warning sign. | 32B-7-202(6) | Partly in place | A wine display rule in the bill (M11). |
| Who may sell | A minor of 16 or older may sell beer under supervision of someone 21 or older. | 32B-7-202(5) | Partly in place | A minimum seller's age for wine is the bill's choice (Pennsylvania: 18, trained, at a designated register). |
| Limits on eligible stores | None by store type for beer. | 32B-7 | New | A grocery-only first phase (framework point 1). |
| Distance and density rules | Local authorities may set proximity rules for beer outlets near community locations. | 32B-7-201(1)(c) | Partly in place | The same local power for wine (M10). The Community Guide recommends regulating outlet density. |
| Promotional practices | Federal law bars suppliers' tied-house inducements to retailers in interstate commerce. No state rule on grocers' wine promotions was read. | 27 U.S.C. 205(b) | New | No below-cost sales; rules on supplier-paid displays for wine. |
| Reporting | Public Safety reports compliance checks each October 1. | 32B-7-305(2) | Partly in place | An annual DABS report on the program (framework point 12). |

## Monitoring and evaluation

| Indicator | Source | Note |
|---|---|---|
| Compliance-check failure rate | Department of Public Safety reports under 32B-7-305 | Compare grocery wine licensees with beer retailers in the same years. |
| Licenses and where they are | DABS license records | By county and by distance to the nearest state store or package agency. |
| Alcohol-related crashes and injuries | NHTSA FARS (already in this dataset); state injury data | Trends only: a change after the law does not show the law caused it. |
| Wine and pure-alcohol volume | DABS sales; NIAAA apparent consumption | Wine by channel, and total ethanol, so substitution from beer or spirits can be seen. |
| DABS revenue | DABS annual reports | Wine margin from stores and from grocers, before and after. |
| Dedicated funds | 32B-2-304(5), -305(4) deposits | School-lunch and other deposits each year. |
| State stores and package agencies | DABS store and agency sales | Sales by store, so the effect on rural agencies is measured rather than assumed. |

A change after the law starts does not show the law caused it: crashes, sales and compliance all move for other reasons. The indicators are for review against a comparison (beer retailers, other years, or other states), not for crediting or blaming the program.
