# Consumption and behavior methods

## Apparent consumption (NIAAA)

Adapter: `src/alcohol_data/adapters/niaaa_pcyr.py`. One data line per year x geography x beverage
(spirits, wine, beer, all). Stored per line:

- gallons of beverage (not for "all beverages", which would add unlike volumes);
- gallons of ethanol (fixed conversion factors) and gallons of ethanol by the time-varying ABV method,
  as separate measures;
- ethanol per capita for ages 14+ and 21+ (published x 10,000, stored in gallons);
- the time-varying ABV (published x 1,000, stored as a fraction);
- NIAAA's own 14+ and 21+ populations, as a separate `calendar_year` series of the population measures.

The decile ranks and the data-source type (state sales, tax data, NABCA or industry) are kept in
`observation_details.extra`. `.` in the file is stored as missing (`not_published`), never zero.

**Layout.** The documented fixed-width columns are one character too narrow for the populations; the
adapter splits each line into its 14 whitespace-separated tokens, rejects any line without exactly 14,
and verifies per capita = ethanol / population on every line.

## Drinking behavior (BRFSS)

Adapter: `src/alcohol_data/adapters/cdc_brfss.py`; crosswalk:
`metadata/variable_crosswalks/brfss_alcohol.csv`.

- Source: published state crude prevalence (Overall break-out) from data.cdc.gov. Only the positive
  response ("Yes" or "Meet criteria for heavy drinking") is stored; the complement is redundant.
- Each published calculated variable maps to one measure. Variables with the same definition across
  versions (e.g. `_RFBING5` and `_RFBING6`) share a measure; the first year of a new version is flagged
  `variable_version_change`. A definition change is a new measure.
- `comparability_group` ends in `1995_2010` or `2011_onward`. Do not draw one line across the two.
- Confidence limits are stored with `ci_level = 0.95`. `sample_size` is BRFSS's published count of
  unweighted respondents in the response category.
- Not loaded: "US" and "UW" (medians of states), territories, demographic break-outs, and age-adjusted
  prevalence.
- Microdata estimation is out of scope for v0.1. If it is added, it must use the complex survey design
  (strata, PSU, weights) with a validated survey package, and respondent microdata stay out of releases.
