# Contrary-evidence search (PPF "evidence that cuts the other way")

Run 2026-11-20. Searches used the web search tool (standard mode), and every finding placed on the page was then
read on its source page. This is a machine-assisted search, not a systematic review, and nobody has reviewed it. The panel is
`CONTRARY` in `web/src/lib/publicFunding.ts`, shown in the "What cuts the other way?" section of `?v=funding`
and checked by the "evidence that cuts the other way" test in `publicFunding.test.ts`.

## Searches

| # | Query | What came back |
| --- | --- | --- |
| 1 | earmarked revenue fungibility, state lottery education spending, does earmarking increase spending | Evans and Zhang (2007); a Stanford SIEPR working paper; a Florida study; Brookings on higher education. Used: Evans and Zhang, read on IDEAS/RePEc. |
| 2 | Washington I-1183 liquor privatization spirits prices, Kerr Greenfield | Kerr, Williams and Greenfield (2015) and follow-ups through 2016. Used: the 2015 paper, read on PubMed Central. |
| 3 | Pennsylvania wine expanded permit, grocers buy wine from PLCB, Act 39 results | How the permits work (PLCB's Act 39 page, law-firm alerts). **Nothing** on grocery-channel revenue, volume or prices. |
| 4 | liquor privatization, earmarked liquor revenue replaced, local distributions after privatization | Washington material (city association pages, OFM's I-1183 analysis, S.B. 5389 of 2025); Idaho's FY2023 distributions (a control state). Used: S.B. 5389's text. |
| — | Community Guide privatization finding | Already cited in `docs/briefings/utah-grocery-wine/public-health-and-enforcement.md` (read 2026-11-19); read again 2026-11-20 for the page. |

## Findings placed on the page (each read on its source)

1. **Community Preventive Services Task Force, privatization of retail alcohol sales (April 2011).** The finding
   recommends against further privatization where government controls retail sales, on strong evidence that
   privatization raises per capita consumption. It reports a 44.4% median rise in per capita sales of the
   privatized beverage (17 studies) and a 2.2% median fall in beverages that stayed in state stores (9 studies),
   from 18 studies with the search running through October 2007.
   <https://thecommunityguide.cdc.gov/findings/alcohol-excessive-consumption-privatization-retail-alcohol-sales.html>
2. **Kerr, Williams and Greenfield (2015), Alcohol and Alcoholism 50(6):654-660, doi:10.1093/alcalc/agv067.**
   Washington spirits prices rose an average of 15.5% (750 ml) and 4.7% (1.75 l) after the 2012 privatization,
   with small changes in Oregon and Idaho. The authors sampled 45 stores of 916 active licenses and built an
   index of about 68 brands. The Discussion says the taxes imposed to replace the control system's revenue
   were largely passed on to buyers. <https://pmc.ncbi.nlm.nih.gov/articles/PMC4608622/>
3. **Evans and Zhang (2007), Education Finance and Policy 2(1):40-73.** The authors reject the idea that school
   spending rises dollar for dollar with earmarked lottery profits; 50 to 70 cents of each earmarked dollar reaches
   school districts. <https://ideas.repec.org/a/tpr/edfpol/v2y2007i1p40-73.html>
4. **Washington S.B. 5389 (2025 regular session).** Sponsored by Senators Wagoner and J. Wilson; read first time
   2025-01-21 and referred to Ways & Means. It is "relating to restoring liquor sales revenue distributions to
   local governments". It would replace the amounts that cities and counties receive under the 2012 law (RCW
   66.24.065, with the remainder going to the general fund) with shares of 10% to counties and 40% to cities and
   towns. The bill's outcome was **not checked**.
   <https://lawfilesext.leg.wa.gov/biennium/2025-26/Pdf/Bills/Senate%20Bills/5389.pdf>

Each entry on the page also says how the finding differs from the designs here: spirits, not wine; a full
exit from state wholesaling; lottery money, not liquor money; and local shares, not a school-meals deposit.

## Searched for and not found

- A measured account, in any state, of what happened to **school** money earmarked from liquor sales after
  a privatization. Search 4 found Washington's local shares and Idaho's pre-privatization split, nothing on schools.
- Pennsylvania's results since 2016. Its grocers buy wine from the PLCB, which makes it the closest working case
  of a state that stays the wholesaler, but no grocery-channel revenue, volume or price comparison turned up.
- A Utah-specific estimate of how much drinking would change if grocers sold wine.

## Considered, not used

- The Stanford SIEPR working paper and the Florida study on lottery earmarks were not used. They point the same way as Evans and Zhang, which is the
  published, peer-reviewed one; one citation is enough for the panel.
- City-association pages about Washington's local shares (advocacy sources). The bill text is the primary
  document, so it is cited instead.
- Washington OFM's January 2015 I-1183 analysis was listed in the search results but not read. It is an open
  lead for the local-share question.
- The follow-up Washington price studies (2014-2016 comparisons with California) were not read; only the 2015
  paper is cited.
