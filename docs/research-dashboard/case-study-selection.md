# Worked example: selecting a grocery-wine reform

Date: 2026-10-07. Author: Claude (AI assistant). This is not a review by a person.

**The question.** When grocery stores gain permission to sell wine, what happens to government revenue,
consumption and purchasing? What can that evidence say about Utah?

**What this selects.** One reform to describe before and after, as far as the evidence held supports. It is
a descriptive example. It does not estimate an effect.

The configuration is in `config/dashboard/cases/tn_2016_food_store_wine.yaml`. The dashboard shows it under
"Worked example".

## Criteria

These follow the dashboard plan, and were fixed before the comparison windows:

1. **Relevance to the Utah proposal.** Ordinary retail food stores get to sell wine. A broad privatization
   that changes several beverage markets and taxes at once ranks lower.
2. **Date certainty from primary evidence.** The enacted text, with effective-date clauses, held in the
   dataset.
3. **Fiscal definitions.** Which receipts exist, and whether any of them isolate wine.
4. **Pre and post years.** At least five complete annual observations on each side, where they exist.
5. **Concurrent changes.** Other laws starting in the same window.
6. **Plausible comparison jurisdictions,** with data on the same definitions.

The choice was not based on the direction of any post-reform revenue change.

**Disclosure.** During the repository audit, before this selection was written, I saw Tennessee's Census T10
values for every year. The windows below follow the plan's five-year rule, not those values.

## Candidates

| | Tennessee, 2014 Pub. Ch. 554 (licenses from 2016-07-01) | Pennsylvania, Act 39 of 2016 (effective 2016-08-08) | Colorado, Proposition 125 (from 2023-03-01) |
|---|---|---|---|
| **What changed** | Retail food stores may get wine licenses, but only where a local referendum passed. | Restaurant and hotel licensees, including some connected to grocery or convenience stores, may sell limited wine to go. | Stores licensed to sell beer for off-premises use may also sell wine. |
| **Relevance to Utah** | High: ordinary food-store retail. | High on the fiscal side, because Pennsylvania is also a state-store (control) state. Lower on the channel: it runs through restaurant licenses, with per-sale limits. | High: grocery and convenience stores. |
| **Date evidence held** | Enacted text, imported and checked against page images; bill record. | Liquor Control Board summary page only (read 2026-10-07; not imported). | Filed initiative text (seen in search) and a Department of Revenue bulletin (HTTP 403 to an automated fetch); not imported. |
| **Fiscal data** | <ul><li>Census T10 (all alcohol).</li><li>Department of Revenue wine-tax collections, FY2010-FY2025 (added for this example).</li><li>Spirits and wine are sold by privately licensed retailers (the 2014 act's 57-3-204 package-store licensees); whether the state runs any stores itself is not recorded in the dataset.</li></ul> | Census T10 only. State-store revenue (Liquor Control Board reports, Census liquor-store revenue) is not loaded. | Census T10 only. |
| **Pre / post annual observations** | <ul><li>T10: FY2012-16 and FY2017-21 (5 / 5).</li><li>NIAAA: 2011-15 and 2017-21.</li><li>BRFSS: 2011-15 and 2017-21.</li></ul> | 5 / 5 possible from T10. | Post period too short: FY2024 and FY2025 are the only full fiscal years after; 2024 is the only full calendar year in NIAAA. |
| **Concurrent changes** | <ul><li>Unfair Wine Sales Law (minimum markup) on the same day.</li><li>Package-store beer from 2014-07-01.</li><li>Local adoption unknown.</li><li>Pandemic in the post window.</li></ul> | Many, from the same act: Sunday hours, store pricing flexibility, direct wine shipping, lottery sales, casino licenses, license auctions. | 2019 full-strength beer in grocery stores (an earlier law); pandemic recovery. |
| **Comparison jurisdictions** | Eight bordering states, all in the dataset with T10, NIAAA and BRFSS. | Bordering states; but a fair fiscal comparison needs control-state enterprise data. | Bordering states. |

## Decision

**Selected: Tennessee 2016.**
- It is the most relevant channel: ordinary food stores.
- Its dates rest on the enacted text held in the dataset.
- It has five complete years each side in every series family.
- Its spirits and wine are sold by privately licensed retailers, so its state receipts are taxes and fees rather than state-store profit, as far as the held evidence shows.
- A wine-tax series could be added from the Department of Revenue.

The limits stay in the example:
- local option, so the share of the state exposed is unknown;
- a minimum-price law beginning the same day;
- legal status verified only on 2016-07-01.

**Excluded for now:**
- **Pennsylvania.** Its many concurrent changes would be attributed to wine sales. The fiscal side that makes
  it interesting (state-store profit) is not in the dataset. It is the strongest second example once
  Census liquor-store revenue or Liquor Control Board reports are loaded and the enacted text is imported.
- **Colorado.** The post-reform period is too short for a five-year window; revisit around 2028. Its
  primary texts would need importing first.

## Comparison shortlist

**Rule.** Of the eight states bordering Tennessee, the four whose pre-reform Census T10 per resident (mean of
FY2012-FY2016) is closest to Tennessee's. The rule uses only pre-reform values. It is a documented
starting point: the Compare view lets readers pick any states. Utah is added as a reference, not as a
control. No similarity score is computed.

| State | T10 per resident, FY2012-16 mean ($) | Difference from Tennessee | Wine ethanol per resident 21+, 2011-15 mean (gal) | Adults drinking in past 30 days, 2011-15 mean (%) |
|---|---|---|---|---|
| Tennessee | 23.17 | — | 0.285 | 38.9 |
| **Virginia** | 27.46 | +4.29 | 0.526 | 53.3 |
| **Georgia** | 18.26 | −4.91 | 0.284 | 48.3 |
| **Arkansas** | 17.56 | −5.61 | 0.230 | 40.8 |
| **Kentucky** | 29.00 | +5.82 | 0.231 | 40.0 |
| Mississippi | 14.13 | −9.04 | 0.184 | 39.3 |
| North Carolina | 35.44 | +12.27 | 0.448 | 46.1 |
| Alabama (fiscal year ends Sep 30) | 38.09 | +14.91 | 0.278 | 40.5 |
| Missouri | 5.93 | −17.24 | 0.403 | 49.3 |

**Caveats.**
- The comparison states' alcohol-tax laws are **not coded**. Any of them may have changed something in
  2011-2021.
- Grocery-wine law (updated 2026-10-09, expansion step 4): Virginia is verified as authorized and Kentucky
  as not authorized on every day of 2011-2021. Arkansas is verified on one day (authorized, 2017-10-01) and
  Georgia on none. The worked example's checked claims hold these four statements.
- Virginia's T10 rises 23% in FY2015 and falls 18% in FY2017 (constant dollars). The dataset has no
  explanation for either change.

## Windows and periods

| Series | Before | Transition | After |
|---|---|---|---|
| Fiscal-year series (Tennessee FY = July-June) | FY2012-FY2016 | none: FY2017 begins on the legal start day, though the sales ramp-up within it is unknown | FY2017-FY2021 |
| Calendar-year series (NIAAA) | 2011-2015 | 2016 (shaded, never prorated) | 2017-2021 |
| Survey-year series (BRFSS) | 2011-2015 | 2016 | 2017-2021 |

**What the post windows contain.**
- They include the pandemic years.
- They stop before Tennessee's unexplained +39% (nominal) T10 jump in FY2022. The charts still show it.
- Window means require every year to have a value.

## What the example found (descriptive, machine-checked)

Every sentence on the example page under "Show" is tied to a claim in the configuration. Each claim is
re-checked against the database by `tests/test_dashboard_export.py`.

**In brief.**
- In FY2017, Tennessee's wine tax collections rose 22%, and its wine enforcement tax rose 27%. Both are above
  any year-on-year change from FY2011 to FY2016.
- In calendar 2016, Tennessee's apparent wine consumption rose by about a fifth, and the share of
  Tennessee adults reporting any drinking rose by about 5 points. Neither change appears in the four
  comparison states.
- Tennessee's all-alcohol T10 shows no separate step at the reform: it was already rising every year.

**What none of this shows.**
- That the reform caused these changes.
- That the FY2017 level lasted. FY2018 collections, under a wider account label, were about 5% lower.
- Anything about Utah, whose alcohol money arrives mainly as state-store profit.

## Smallest remaining tasks to finish the example

1. The Tennessee Alcoholic Beverage Commission's list of adopting localities, with dates, and license counts.
   This gives the exposure share.
2. The statutory basis of Department of Revenue account 11002's FY2018 relabelling, and monthly collections
   around July 2016 (stocking versus sales).
3. Primary-law coding of grocery-wine and alcohol-tax status for Virginia, Georgia, Arkansas and Kentucky,
   2011-2021.
4. Census's explanation of the T10 breaks: Tennessee FY2022, Virginia FY2015 and FY2017.
