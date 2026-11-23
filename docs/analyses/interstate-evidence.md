# What happened in other states?

- **Status:** a proposal for review by qualified legal and fiscal experts. Not enacted law, not legal advice, not attorney-reviewed, and not reviewed by a person. Written with AI assistance (Claude) for Ethan Whipple.
- **Generated** from `web/src/lib/framework.ts` by `npm run docs:framework` (in `web/`); edit the data, not this file. Methods: statute-matrix@1.0, policy-designs@1.0.

Each finding carries its evidence strength. A **peer-reviewed estimate** uses a model to build a comparison; a **descriptive trend** compares before and after without one; **law and official figures** say what changed, not what it caused; a **press report** is a journalist's account with no prices measured; **industry-commissioned** work is labeled as such; **not read** means the source refused access or none was found.

## Why before-and-after is not an experiment

A state that changes its law is not chosen at random, and other things change at the same time: prices, tastes, other laws, the economy. Comparing the same state before and after, or against neighbors, shows what happened, not what the law caused. Synthetic-control methods build a weighted mix of other states that tracked the treated state before the change; they are stronger than a raw comparison but still rest on that mix being a fair stand-in. No example here was chosen for a favorable trend.

## Tennessee: Food stores licensed to sell wine (July 1, 2016)

**Law.** A license state: private wholesalers and retailers, with a wine excise tax. Grocery wine sales began with licenses from July 1, 2016.

- **Peer-reviewed estimate (model-based).** [Sun, Caputo, Staples and Vassilopoulos, American Journal of Agricultural Economics 108(5), 1255-1281 (online Dec. 7, 2025; open access)](https://doi.org/10.1111/ajae.70033): Synthetic control and synthetic difference-in-differences, on NielsenIQ data and official statistics. The abstract reports no statistically significant change in the number of liquor stores, higher wine excise-tax revenue, and mixed evidence of a short-term fall in liquor-store employment whose significance depends on the method. Only the abstract and Crossref record were read: the publisher's page refused automated access, so the effect sizes, donor states, funding and conflict-of-interest statements were not read. *(Crossref record and abstract, read 2026-11-19)*
- **Industry-commissioned report.** [Caputo, Assessing the Impact of Wine Sale Reform: A Case Study of Tennessee (2024)](https://www.fmi.org/newsroom/news-archive/view/2024/07/15/new-fmi-study-assesses-benefits-of-selling-wine-at-grocery): Released by FMI, the food retailers' trade association; it reports no significant rise in liquor-store closures and higher sales-tax revenue. Its relation to the journal article (one author is shared) was not checked. *(FMI news release, July 15, 2024, read 2026-11-19)*
- **Descriptive trend (not causal).** [This project's before-and-after comparison (2026-10-17)](https://proofandpolicy.us/?v=case): Wine ethanol per adult rose 26% from 2011-2015 to 2017-2019, 16.3 log points more than the neighbors' average; beer fell about as much as in the neighbors; total ethanol rose 4.5 log points relative to them, a gap that is ordinary for these states. *(docs/analyses/tn-2016-grocery-wine/results.md)*

**At the same time.** A minimum wine price (no retail wine below cost plus 20%) began the same day, July 1, 2016; package stores could sell beer from July 1, 2014; from FY2018 the state's wine tax account also carries high-alcohol beer.

**For Utah.** Tennessee's wine excise receipts rose because more wine was sold under a tax that grocery sales also pay. Utah has no wine excise: its revenue is DABS's markup, and under designs C and D a grocery bottle carries none of it. A Tennessee percentage is not transferable to Utah without a bridge from excise receipts to monopoly margin, which nothing here supplies.

## Colorado: Beer retailer licenses converted to beer-and-wine licenses (March 1, 2023)

**Law.** Proposition 125 (statutory initiative) automatically converted every fermented malt beverage retailer license (grocery and convenience stores) to allow wine and tastings. 1,819 such licensees held licenses on June 30, 2021, against 1,592 retail liquor stores.

- **Law and official figures only.** [Colorado Secretary of State, 2022 general election, Proposition 125](https://historicalelectiondata.coloradosos.gov/contest/25866): Yes 1,228,404 (50.58%), No 1,200,219 (49.42%). *(historicalelectiondata.coloradosos.gov, read 2026-11-19)*
- **Law and official figures only.** [Legislative Council, 2022 State Ballot Information Booklet](https://content.leg.colorado.gov/sites/default/files/images/blue_book_2022_english_for_web.pdf): Fiscal impact: Department of Revenue workload to convert about 1,820 licenses, including $5,000 of one-time programming. Argument against: the conversion would more than double the stores selling wine with no community or government review. *(Blue Book, pages 36-37, read 2026-11-19)*
- **Not read.** [Post-reform prices, sales, closures and tax revenue](https://sbg.colorado.gov/liquor): The Department of Revenue's liquor pages refused automated access, and no government or peer-reviewed evaluation of the 2023 change was found. Retailer accounts and industry claims are not used. *(sbg.colorado.gov (HTTP 403), 2026-11-19)*

**At the same time.** 2016 legislation phased in more locations for liquor-licensed drugstores and let beer retailers sell full-strength beer; Proposition 124 (more liquor-store locations) was on the same 2022 ballot.

**For Utah.** Colorado is a license state with private wholesale and an excise tax, like Tennessee. Its automatic conversion is the opposite of the licensing this framework proposes, and its observation period is short.

## Pennsylvania: Wine expanded permits (Act 39 of 2016) (Approved June 8, 2016; permit requests from August 8, 2016)

**Law.** A control state that is still the wholesaler and runs about 560 state stores. Restaurant and hotel licensees (including grocery and convenience stores holding restaurant licenses) may sell up to 3 liters of wine to go per sale, bought from state stores or limited wineries, at a designated register staffed by a trained cashier 18 or older, never below their purchase price. The permit carries a $2,000 application fee and a renewal fee of 2% of wine bought from the state.

- **Law and official figures only.** [PLCB annual report, FY2024-25](https://www.pa.gov/agencies/lcb/about-us/reports-and-publications/annual-reports): Permits on June 30, 2025: 980 convenience stores, 559 grocery stores, 296 restaurants, 62 hotels, 9 mass merchants. Total PLCB sales $3.16 billion with taxes; liquor tax (18%) $444.4 million. No estimate of the permits' effect on revenue. *(PLCB annual report FY2024-25, read 2026-11-19)*
- **Law and official figures only.** [PLCB, Frequently Asked Questions: Wine Expanded Permits (October 4, 2016)](https://www.pa.gov/agencies/lcb/shop-wine-spirits/wholesale-wine-and-spirits-sales/wine-expanded-permits): Eligibility, the 3-liter limit, hours, the designated register, scanning ID of patrons who appear under 35, and the price floor. *(PLCB Office of Chief Counsel, read 2026-11-19)*
- **Press report (no prices measured).** [Marnie Old, Philadelphia Inquirer (May 6, 2020)](https://www.inquirer.com/food/drink/what-wines-to-buy-at-grocery-stores-20200506.html): A wine columnist's account: grocers stock mostly the national brands state stores sell, and those wines "typically cost a little more" in grocery stores, because grocers buy from the PLCB at only 10% below retail. No prices were measured, and no measured comparison of grocery and state-store prices was found. *(inquirer.com, read 2026-11-20)*
- **Law and official figures only.** [Liquor Code section 305(b), as printed in HB 1690 (PN 2653)](https://www.palegis.us/legislation/bills/2015/hb1690): State stores sell to licensees at the retail price less 10%. Whether every permit purchase is at that price was not confirmed. *(palegis.us, read 2026-11-19)*

**At the same time.** Act 39 also changed direct wine shipping, state-store hours and beer licensing; a 2024-25 cocktail permit shifted permit holders' purchases.

**For Utah.** The closest structure to design B: the state stays the wholesaler and private stores resell its wine, bought at 10% below retail. Pennsylvania lets grocers set their own prices (never below cost), and the one report found says they charge a little more than state stores. Utah's package agencies already sell at the state's price, so a Utah bill could require the same shelf price instead. No causal estimate exists.

## Other control states: How the state's wholesale and retail roles are split (Current)

**Law.** Mississippi's ABC is the state's wholesaler of spirits and wine and licenses about 1,700 package and on-premises retailers; Wyoming's Department of Revenue runs wholesale distribution; Montgomery County, Maryland wholesales, runs 25 stores and shares retail with about 1,100 license holders; Idaho's division controls beverages over 16% alcohol.

- **Law and official figures only.** [NABCA control-state directory](https://www.nabca.org/control-state-directory-and-info): Agency profiles in the agencies' own words. They do not say, for most states, which beverages are controlled at wholesale or retail, or where wine may be sold. *(nabca.org, read 2026-11-19)*

**For Utah.** Mississippi and Wyoming show a state wholesaler of wine supplying private retailers, as in design B, but whether grocery stores there sell wine, and at what margin, was not read. They are structure, not evidence of effects.
