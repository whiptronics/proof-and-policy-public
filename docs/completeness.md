# Completeness by metric, jurisdiction, year and definition

Generated from build `preview-bb1cb7f77ec1` (code 8a8e3be11a8a1235646c62968045e71a12f979cc). Regenerate with
`alcohol-data report completeness`. Machine-readable detail: `metadata/completeness.csv` (one row per
metric and jurisdiction, with year ranges) and `metadata/series_breaks.csv`.

How to read it:

- The **span** of a series is the set of years in which any jurisdiction has a row. A jurisdiction
  inside the series is complete only if it has a value in every span year.
- **Missing** means a row exists with a published reason (e.g. not published, suppressed).
- **Absent** means the series has rows that year for other jurisdictions but none for this one.
- A jurisdiction with no row at all is **not in the series**. That is coverage, not missingness.
- Definition changes are listed under each concept and are never joined into one trend.

States and DC: 51. Only state-level and national rows are summarized here; regional
rows are in the CSV.

## Definition changes and series breaks

| Concept | Year | Kind | From | To | Jurisdictions | Note |
|---|---|---|---|---|---|---|
| brfss_any_drinking | 2001 | definition change | brfss_drank_any_past_month_question_pct (1995-1999 questionnaire item (past month), to 1999) | brfss_drank_any_past_30d_pct (2001 on: calculated variable (past 30 days)) | all in series | Not the same item as 1995-1999. A further method break in 2011 (weighting, cell phones) is a separate comparability group. |
| brfss_any_drinking | 2011 | comparability group change | brfss_drank_any_past_30d_pct\|brfss_1995_2010 | brfss_drank_any_past_30d_pct\|brfss_2011_onward | all in series |  |
| brfss_binge_drinking | 2006 | definition change | brfss_binge_5plus_any_sex_pct (1995-2005: 5+ drinks on one occasion, all adults, to 2005) | brfss_binge_5m_4f_pct (2006 on: 5+ drinks (men) / 4+ (women)) | all in series | Threshold for women lowered in 2006; method break in 2011 is a separate comparability group. |
| brfss_binge_drinking | 2011 | comparability group change | brfss_binge_5m_4f_pct\|brfss_1995_2010 | brfss_binge_5m_4f_pct\|brfss_2011_onward | all in series |  |
| brfss_heavy_drinking | 2015 | definition change | brfss_heavy_2m_1f_per_day_pct (2001-2014: more than 2 (men) / 1 (women) drinks per day, to 2014) | brfss_heavy_14m_7f_per_week_pct (2015 on: more than 14 (men) / 7 (women) drinks per week) | all in series | Wording changed from per day to per week. |
| brfss_heavy_drinking | 2011 | comparability group change | brfss_heavy_2m_1f_per_day_pct\|brfss_1995_2010 | brfss_heavy_2m_1f_per_day_pct\|brfss_2011_onward | all in series |  |
| cbp_employment_naics_445310 | 2007 | comparability group change | cbp\|naics_445310\|employment\|withheld_cells_no_noise | cbp\|naics_445310\|employment\|noise_and_withheld_cells | all in series |  |
| cbp_employment_naics_445310 | 2017 | comparability group change | cbp\|naics_445310\|employment\|noise_and_withheld_cells | cbp\|naics_445310\|employment\|noise_only | all in series |  |
| cbp_employment_naics_722410 | 2007 | comparability group change | cbp\|naics_722410\|employment\|withheld_cells_no_noise | cbp\|naics_722410\|employment\|noise_and_withheld_cells | all in series |  |
| cbp_employment_naics_722410 | 2017 | comparability group change | cbp\|naics_722410\|employment\|noise_and_withheld_cells | cbp\|naics_722410\|employment\|noise_only | all in series |  |
| census_liquor_stores_capital_outlay | 2022 | comparability group change | census_govfin\|state_government\|liquor_stores | census_govfin\|state_government\|liquor_stores\|no_g_item_from_fy2022 | all in series |  |
| census_liquor_stores_current_operations | 2016 | comparability group change | census_govfin\|state_government\|liquor_stores | census_govfin\|state_government\|liquor_stores\|oregon_unit_files | all in series |  |
| census_liquor_stores_expenditure | 2016 | comparability group change | census_govfin\|state_government\|liquor_stores | census_govfin\|state_government\|liquor_stores\|oregon_unit_files | all in series |  |
| census_liquor_stores_expenditure | 2022 | comparability group change | census_govfin\|state_government\|liquor_stores | census_govfin\|state_government\|liquor_stores\|no_g_item_from_fy2022 | all in series |  |
| census_liquor_stores_expenditure | 2022 | comparability group change | census_govfin\|state_government\|liquor_stores\|oregon_unit_files | census_govfin\|state_government\|liquor_stores\|oregon_unit_files\|no_g_item_from_fy2022 | all in series |  |
| pop_age14plus_resident | 2010 | comparability group change | census_pep\|census_pep_intercensal_2000_2010 | census_pep\|census_pep_intercensal_2010_2020 | all in series |  |
| pop_age14plus_resident | 2020 | comparability group change | census_pep\|census_pep_intercensal_2010_2020 | census_pep\|census_pep_vintage_2025 | all in series |  |
| pop_age18plus_resident | 2010 | comparability group change | census_pep\|census_pep_intercensal_2000_2010 | census_pep\|census_pep_intercensal_2010_2020 | all in series |  |
| pop_age18plus_resident | 2020 | comparability group change | census_pep\|census_pep_intercensal_2010_2020 | census_pep\|census_pep_vintage_2025 | all in series |  |
| pop_age21plus_resident | 2010 | comparability group change | census_pep\|census_pep_intercensal_2000_2010 | census_pep\|census_pep_intercensal_2010_2020 | all in series |  |
| pop_age21plus_resident | 2020 | comparability group change | census_pep\|census_pep_intercensal_2010_2020 | census_pep\|census_pep_vintage_2025 | all in series |  |
| pop_total_resident | 2000 | comparability group change | census_pep\|census_pep_intercensal_1990_2000 | census_pep\|census_pep_intercensal_2000_2010 | all in series |  |
| pop_total_resident | 2010 | comparability group change | census_pep\|census_pep_intercensal_2000_2010 | census_pep\|census_pep_intercensal_2010_2020 | all in series |  |
| pop_total_resident | 2020 | comparability group change | census_pep\|census_pep_intercensal_2010_2020 | census_pep\|census_pep_vintage_2025 | all in series |  |
| tn_dor_account_11002 | 2018 | definition change | tn_dor_wine_tax_collections (FY2010-FY2017: printed 'Wine Tax', to 2017) | tn_dor_account_11002_with_high_alcohol_beer (FY2018 on: printed 'Wine Tax & High Alcohol Beer') | all in series | Not wine-only; the statutory reason for the relabelling is not recorded yet. |
| tn_dor_winery_wine_tax_collections | 2018 | comparability group change | tn_dor_collections\|tn_dor_winery_wine_tax_collections\|Wine Tax | tn_dor_collections\|tn_dor_winery_wine_tax_collections\|Wine Tax (Winery) | all in series |  |
| ut_dabs_gross_profit | 2020 | comparability group change | utah_dabs_annual_report:five_year_summary_financial_information\|ut_dabs_gross_profit | utah_dabs_annual_report:five_year_operations_summary\|ut_dabs_gross_profit | all in series | preferred value comes from a different table of the same report |
| ut_dabs_gross_profit | 2021 | comparability group change | utah_dabs_annual_report:five_year_operations_summary\|ut_dabs_gross_profit | utah_dabs_annual_report:five_year_summary_financial_information\|ut_dabs_gross_profit | all in series | preferred value comes from a different table of the same report |
| ut_dabs_gross_profit | 2023 | comparability group change | utah_dabs_annual_report:five_year_summary_financial_information\|ut_dabs_gross_profit | utah_dabs_annual_report:five_year_operations_summary\|ut_dabs_gross_profit | all in series | preferred value comes from a different table of the same report |
| ut_dabs_gross_profit | 2024 | comparability group change | utah_dabs_annual_report:five_year_operations_summary\|ut_dabs_gross_profit | utah_dabs_annual_report:five_year_summary_financial_information\|ut_dabs_gross_profit | all in series | preferred value comes from a different table of the same report |
| ut_dabs_gross_profit | 2025 | comparability group change | utah_dabs_annual_report:five_year_summary_financial_information\|ut_dabs_gross_profit | utah_dabs_annual_report:five_year_operations_summary\|ut_dabs_gross_profit | all in series | preferred value comes from a different table of the same report |
| ut_dabs_liquor_sales_revenue | 2022 | comparability group change | utah_dabs_annual_report:five_year_summary_financial_information\|ut_dabs_liquor_sales_revenue | utah_dabs_annual_report:five_year_operations_summary\|ut_dabs_liquor_sales_revenue | all in series | preferred value comes from a different table of the same report |
| ut_dabs_liquor_sales_revenue | 2023 | comparability group change | utah_dabs_annual_report:five_year_operations_summary\|ut_dabs_liquor_sales_revenue | utah_dabs_annual_report:five_year_summary_financial_information\|ut_dabs_liquor_sales_revenue | all in series | preferred value comes from a different table of the same report |
| ut_dabs_liquor_sales_revenue | 2024 | comparability group change | utah_dabs_annual_report:five_year_summary_financial_information\|ut_dabs_liquor_sales_revenue | utah_dabs_annual_report:five_year_operations_summary\|ut_dabs_liquor_sales_revenue | all in series | preferred value comes from a different table of the same report |
| ut_dabs_liquor_sales_revenue | 2025 | comparability group change | utah_dabs_annual_report:five_year_operations_summary\|ut_dabs_liquor_sales_revenue | utah_dabs_annual_report:five_year_summary_financial_information\|ut_dabs_liquor_sales_revenue | all in series | preferred value comes from a different table of the same report |
| ut_dabs_net_profit_general_fund | 2020 | comparability group change | utah_dabs_annual_report:five_year_summary_financial_information\|ut_dabs_net_profit_general_fund | utah_dabs_annual_report:five_year_operations_summary\|ut_dabs_net_profit_general_fund | all in series | preferred value comes from a different table of the same report |
| ut_dabs_net_profit_general_fund | 2022 | comparability group change | utah_dabs_annual_report:five_year_operations_summary\|ut_dabs_net_profit_general_fund | utah_dabs_annual_report:five_year_summary_financial_information\|ut_dabs_net_profit_general_fund | all in series | preferred value comes from a different table of the same report |
| ut_dabs_net_profit_general_fund | 2024 | comparability group change | utah_dabs_annual_report:five_year_summary_financial_information\|ut_dabs_net_profit_general_fund | utah_dabs_annual_report:five_year_operations_summary\|ut_dabs_net_profit_general_fund | all in series | preferred value comes from a different table of the same report |
| ut_dabs_net_profit_general_fund | 2025 | comparability group change | utah_dabs_annual_report:five_year_operations_summary\|ut_dabs_net_profit_general_fund | utah_dabs_annual_report:five_year_summary_financial_information\|ut_dabs_net_profit_general_fund | all in series | preferred value comes from a different table of the same report |
| ut_dabs_other_income | 2021 | comparability group change | utah_dabs_annual_report:five_year_summary_financial_information\|ut_dabs_other_income | utah_dabs_annual_report:five_year_operations_summary\|ut_dabs_other_income | all in series | preferred value comes from a different table of the same report |
| ut_dabs_other_income | 2025 | comparability group change | utah_dabs_annual_report:five_year_operations_summary\|ut_dabs_other_income | utah_dabs_annual_report:income_statement\|ut_dabs_other_income | all in series | preferred value comes from a different table of the same report |
| ut_dabs_total_revenue | 2020 | comparability group change | utah_dabs_annual_report:five_year_summary_financial_information\|ut_dabs_total_revenue | utah_dabs_annual_report:five_year_operations_summary\|ut_dabs_total_revenue | all in series | preferred value comes from a different table of the same report |
| ut_dabs_total_revenue | 2021 | comparability group change | utah_dabs_annual_report:five_year_operations_summary\|ut_dabs_total_revenue | utah_dabs_annual_report:five_year_summary_financial_information\|ut_dabs_total_revenue | all in series | preferred value comes from a different table of the same report |
| ut_dabs_total_revenue | 2022 | comparability group change | utah_dabs_annual_report:five_year_summary_financial_information\|ut_dabs_total_revenue | utah_dabs_annual_report:five_year_operations_summary\|ut_dabs_total_revenue | all in series | preferred value comes from a different table of the same report |
| ut_dabs_total_revenue | 2024 | comparability group change | utah_dabs_annual_report:five_year_operations_summary\|ut_dabs_total_revenue | utah_dabs_annual_report:income_statement\|ut_dabs_total_revenue | all in series | preferred value comes from a different table of the same report |
| ut_dabs_total_revenue | 2025 | comparability group change | utah_dabs_annual_report:income_statement\|ut_dabs_total_revenue | utah_dabs_annual_report:five_year_operations_summary\|ut_dabs_total_revenue | all in series | preferred value comes from a different table of the same report |
| yrbs_binge_drinking_hs_pct | 2019 | comparability group change | yrbs_high_school\|yrbs_binge_drinking_hs_pct | cdi\|ALC07\|Crude Prevalence | all in series |  |
| yrbs_current_alcohol_use_hs_pct | 2019 | comparability group change | yrbs_high_school\|yrbs_current_alcohol_use_hs_pct | cdi\|ALC01\|Crude Prevalence | all in series |  |

## Metrics

### Spending on alcohol bought to take away (BEA PCE by state)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `bea_pce_off_premises_alcohol` | calendar year | 1997-2025 (29 yrs) | 51 | 51 | 0 | 0 | 1,479 / 1,479 | 0 | 0 |

### Per capita personal income (BEA SAINC1)

Note: Each annual BEA release revises earlier years; a pinned file is one vintage.

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `bea_per_capita_personal_income` | calendar year | 1929-2025 (97 yrs) | 51 | 49 | 2 | 0 | 4,905 / 4,947 | 42 not published | 0 |

Gaps inside the span (state level):

- `bea_per_capita_personal_income` AK: missing 1929-1949
- `bea_per_capita_personal_income` HI: missing 1929-1949

### Personal income (BEA SAINC1)

Note: Each annual BEA release revises earlier years; a pinned file is one vintage.

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `bea_personal_income` | calendar year | 1929-2025 (97 yrs) | 51 | 49 | 2 | 0 | 4,905 / 4,947 | 42 not published | 0 |

Gaps inside the span (state level):

- `bea_personal_income` AK: missing 1929-1949
- `bea_personal_income` HI: missing 1929-1949

### Adults who drank any alcohol in the past 30 days (BRFSS)

- `brfss_drank_any_past_month_question_pct`: 1995-1999 questionnaire item (past month). The data.cdc.gov 1995-2010 table has no alcohol rows at all for 2000.
- `brfss_drank_any_past_30d_pct`: 2001 on: calculated variable (past 30 days). Not the same item as 1995-1999. A further method break in 2011 (weighting, cell phones) is a separate comparability group.

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `brfss_drank_any_past_month_question_pct` | survey year | 1995-1999 (3 yrs) | 51 | 50 | 1 | 0 | 152 / 153 | 0 | 1 |
| `brfss_drank_any_past_30d_pct` | survey year | 2001-2025 (25 yrs) | 51 | 42 | 9 | 0 | 1,266 / 1,275 | 0 | 9 |

Gaps inside the span (state level):

- `brfss_drank_any_past_month_question_pct` DC: absent 1995
- `brfss_drank_any_past_30d_pct` CA: absent 2025
- `brfss_drank_any_past_30d_pct` FL: absent 2021
- `brfss_drank_any_past_30d_pct` HI: absent 2004
- `brfss_drank_any_past_30d_pct` KY: absent 2023
- `brfss_drank_any_past_30d_pct` MS: absent 2025
- `brfss_drank_any_past_30d_pct` NV: absent 2025
- `brfss_drank_any_past_30d_pct` NJ: absent 2019
- `brfss_drank_any_past_30d_pct` PA: absent 2023
- `brfss_drank_any_past_30d_pct` TN: absent 2024

### Binge drinking, adults, age-adjusted (CDC CDI)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `brfss_binge_age_adjusted_pct` | survey year | 2019-2023 (5 yrs) | 51 | 47 | 4 | 0 | 251 / 255 | 4 unavailable | 0 |

Gaps inside the span (state level):

- `brfss_binge_age_adjusted_pct` FL: missing 2021
- `brfss_binge_age_adjusted_pct` KY: missing 2023
- `brfss_binge_age_adjusted_pct` NJ: missing 2019
- `brfss_binge_age_adjusted_pct` PA: missing 2023

### Adults who binge drank (BRFSS)

- `brfss_binge_5plus_any_sex_pct`: 1995-2005: 5+ drinks on one occasion, all adults.
- `brfss_binge_5m_4f_pct`: 2006 on: 5+ drinks (men) / 4+ (women). Threshold for women lowered in 2006; method break in 2011 is a separate comparability group.

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `brfss_binge_5plus_any_sex_pct` | survey year | 1995-2005 (8 yrs) | 51 | 49 | 2 | 0 | 406 / 408 | 0 | 2 |
| `brfss_binge_5m_4f_pct` | survey year | 2006-2025 (20 yrs) | 51 | 43 | 8 | 0 | 1,012 / 1,020 | 0 | 8 |

Gaps inside the span (state level):

- `brfss_binge_5plus_any_sex_pct` DC: absent 1995
- `brfss_binge_5plus_any_sex_pct` HI: absent 2004
- `brfss_binge_5m_4f_pct` CA: absent 2025
- `brfss_binge_5m_4f_pct` FL: absent 2021
- `brfss_binge_5m_4f_pct` KY: absent 2023
- `brfss_binge_5m_4f_pct` MS: absent 2025
- `brfss_binge_5m_4f_pct` NV: absent 2025
- `brfss_binge_5m_4f_pct` NJ: absent 2019
- `brfss_binge_5m_4f_pct` PA: absent 2023
- `brfss_binge_5m_4f_pct` TN: absent 2024

### Binge episodes in the past 30 days, median among adults who binge drink (CDC CDI)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `brfss_binge_frequency_median` | survey year | 2019-2023 (5 yrs) | 51 | 47 | 4 | 0 | 251 / 255 | 4 unavailable | 0 |

Gaps inside the span (state level):

- `brfss_binge_frequency_median` FL: missing 2021
- `brfss_binge_frequency_median` KY: missing 2023
- `brfss_binge_frequency_median` NJ: missing 2019
- `brfss_binge_frequency_median` PA: missing 2023

### Largest number of drinks on one occasion, median among adults who binge drink (CDC CDI)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `brfss_binge_intensity_median` | survey year | 2019-2023 (5 yrs) | 51 | 47 | 4 | 0 | 251 / 255 | 4 unavailable | 0 |

Gaps inside the span (state level):

- `brfss_binge_intensity_median` FL: missing 2021
- `brfss_binge_intensity_median` KY: missing 2023
- `brfss_binge_intensity_median` NJ: missing 2019
- `brfss_binge_intensity_median` PA: missing 2023

### Chronic drinking, more than 60 drinks in the past month

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `brfss_chronic_60plus_per_month_pct` | survey year | 1995-1999 (3 yrs) | 50 | 49 | 1 | 1 | 149 / 150 | 0 | 1 |

Gaps inside the span (state level):

- `brfss_chronic_60plus_per_month_pct` DC: absent 1995

### Adults who drank heavily (BRFSS)

- `brfss_heavy_2m_1f_per_day_pct`: 2001-2014: more than 2 (men) / 1 (women) drinks per day. Method break in 2011 is a separate comparability group.
- `brfss_heavy_14m_7f_per_week_pct`: 2015 on: more than 14 (men) / 7 (women) drinks per week. Wording changed from per day to per week.

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `brfss_heavy_2m_1f_per_day_pct` | survey year | 2001-2014 (14 yrs) | 51 | 50 | 1 | 0 | 713 / 714 | 0 | 1 |
| `brfss_heavy_14m_7f_per_week_pct` | survey year | 2015-2025 (11 yrs) | 51 | 43 | 8 | 0 | 553 / 561 | 0 | 8 |

Gaps inside the span (state level):

- `brfss_heavy_2m_1f_per_day_pct` HI: absent 2004
- `brfss_heavy_14m_7f_per_week_pct` CA: absent 2025
- `brfss_heavy_14m_7f_per_week_pct` FL: absent 2021
- `brfss_heavy_14m_7f_per_week_pct` KY: absent 2023
- `brfss_heavy_14m_7f_per_week_pct` MS: absent 2025
- `brfss_heavy_14m_7f_per_week_pct` NV: absent 2025
- `brfss_heavy_14m_7f_per_week_pct` NJ: absent 2019
- `brfss_heavy_14m_7f_per_week_pct` PA: absent 2023
- `brfss_heavy_14m_7f_per_week_pct` TN: absent 2024

### Beer, wine and liquor stores: employment (CBP, NAICS 445310)

Note: NAICS code unchanged across the NAICS 1997-2017 editions used in 2000-2023; the edition is recorded with each value. Employment disclosure method changes in 2007 and 2017.

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `cbp_employment_naics_445310` | point in time | 2000-2023 (24 yrs) | 51 | 42 | 9 | 0 | 1,165 / 1,224 | 59 suppressed | 0 |

Gaps inside the span (state level):

- `cbp_employment_naics_445310` AL: missing 2004
- `cbp_employment_naics_445310` HI: missing 2009
- `cbp_employment_naics_445310` ID: missing 2005, 2007-2014
- `cbp_employment_naics_445310` MT: missing 2003
- `cbp_employment_naics_445310` NH: missing 2003-2014, 2016-2017
- `cbp_employment_naics_445310` UT: missing 2000, 2003-2014, 2016-2017
- `cbp_employment_naics_445310` VT: missing 2003, 2009-2013
- `cbp_employment_naics_445310` VA: missing 2007-2014
- `cbp_employment_naics_445310` WV: missing 2000, 2003-2005

### Drinking places (alcoholic beverages): employment (CBP, NAICS 722410)

Note: NAICS code unchanged across the NAICS 1997-2017 editions used in 2000-2023; the edition is recorded with each value. Employment disclosure method changes in 2007 and 2017.

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `cbp_employment_naics_722410` | point in time | 2000-2023 (24 yrs) | 51 | 49 | 2 | 0 | 1,222 / 1,224 | 2 suppressed | 0 |

Gaps inside the span (state level):

- `cbp_employment_naics_722410` DE: missing 2004
- `cbp_employment_naics_722410` WY: missing 2004

### Supermarkets and other grocery stores: establishments (CBP, NAICS 445110)

Note: NAICS code unchanged across the NAICS 1997-2017 editions used in 2000-2023; the edition is recorded with each value. Employment disclosure method changes in 2007 and 2017.

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `cbp_establishments_naics_445110` | calendar year | 2000-2023 (24 yrs) | 51 | 51 | 0 | 0 | 1,224 / 1,224 | 0 | 0 |

### Beer, wine and liquor stores: establishments (CBP, NAICS 445310)

Note: NAICS code unchanged across the NAICS 1997-2017 editions used in 2000-2023; the edition is recorded with each value. Employment disclosure method changes in 2007 and 2017.

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `cbp_establishments_naics_445310` | calendar year | 2000-2023 (24 yrs) | 51 | 51 | 0 | 0 | 1,224 / 1,224 | 0 | 0 |

### Drinking places (alcoholic beverages): establishments (CBP, NAICS 722410)

Note: NAICS code unchanged across the NAICS 1997-2017 editions used in 2000-2023; the edition is recorded with each value. Employment disclosure method changes in 2007 and 2017.

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `cbp_establishments_naics_722410` | calendar year | 2000-2023 (24 yrs) | 51 | 51 | 0 | 0 | 1,224 / 1,224 | 0 | 0 |

### Chronic liver disease deaths (CDC CDI)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `cdi_chronic_liver_disease_deaths` | calendar year | 2019-2022 (4 yrs) | 51 | 51 | 0 | 0 | 204 / 204 | 0 | 0 |

### Chronic liver disease deaths per 100,000, age-adjusted (CDC CDI)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `cdi_chronic_liver_disease_mortality_age_adjusted_rate` | calendar year | 2019-2022 (4 yrs) | 51 | 51 | 0 | 0 | 204 / 204 | 0 | 0 |

### Chronic liver disease deaths per 100,000, crude (CDC CDI)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `cdi_chronic_liver_disease_mortality_crude_rate` | calendar year | 2019-2022 (4 yrs) | 51 | 51 | 0 | 0 | 204 / 204 | 0 | 0 |

### State liquor store expenditure, capital outlay (Census F90 + G90)

Note: The 2005 classification redesign left the liquor store items unchanged (2006 Classification Manual, Appendix 1.6.2). No state government records for FY1973-FY1976.

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `census_liquor_stores_capital_outlay` | state fiscal year | 1972-2024 (49 yrs) | 50 | 2 | 48 | 1 | 1,887 / 2,450 | 0 | 563 |

Gaps inside the span (state level):

- `census_liquor_stores_capital_outlay` AL: absent 2016-2024
- `census_liquor_stores_capital_outlay` AK: absent 2013-2024
- `census_liquor_stores_capital_outlay` AZ: absent 2013-2024
- `census_liquor_stores_capital_outlay` AR: absent 2013-2024
- `census_liquor_stores_capital_outlay` CA: absent 2013-2024
- `census_liquor_stores_capital_outlay` CO: absent 2013-2024
- `census_liquor_stores_capital_outlay` CT: absent 2013-2024
- `census_liquor_stores_capital_outlay` DE: absent 2013-2024
- `census_liquor_stores_capital_outlay` FL: absent 2013-2024
- `census_liquor_stores_capital_outlay` GA: absent 2013-2024
- `census_liquor_stores_capital_outlay` HI: absent 2013-2024
- `census_liquor_stores_capital_outlay` ID: absent 2013-2024
- `census_liquor_stores_capital_outlay` IL: absent 2013-2024
- `census_liquor_stores_capital_outlay` IN: absent 2013-2024
- `census_liquor_stores_capital_outlay` IA: absent 2013-2024
- `census_liquor_stores_capital_outlay` KS: absent 2013-2024
- `census_liquor_stores_capital_outlay` KY: absent 2013-2014, 2017-2024
- `census_liquor_stores_capital_outlay` LA: absent 2013-2024
- `census_liquor_stores_capital_outlay` ME: absent 2013-2024
- `census_liquor_stores_capital_outlay` MD: absent 2013-2024
- `census_liquor_stores_capital_outlay` MA: absent 2013-2024
- `census_liquor_stores_capital_outlay` MI: absent 2013-2024
- `census_liquor_stores_capital_outlay` MN: absent 2013-2024
- `census_liquor_stores_capital_outlay` MS: absent 2013-2024
- `census_liquor_stores_capital_outlay` MO: absent 2013-2024
- … 23 more in metadata/completeness.csv

### State liquor store expenditure, current operations (Census E90)

Note: The 2005 classification redesign left the liquor store items unchanged (2006 Classification Manual, Appendix 1.6.2). No state government records for FY1973-FY1976.

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `census_liquor_stores_current_operations` | state fiscal year | 1972-2024 (49 yrs) | 50 | 15 | 35 | 1 | 2,040 / 2,450 | 0 | 410 |

Gaps inside the span (state level):

- `census_liquor_stores_current_operations` AK: absent 2013-2024
- `census_liquor_stores_current_operations` AZ: absent 2013-2024
- `census_liquor_stores_current_operations` AR: absent 2013-2024
- `census_liquor_stores_current_operations` CA: absent 2013-2024
- `census_liquor_stores_current_operations` CO: absent 2013-2024
- `census_liquor_stores_current_operations` CT: absent 2013-2024
- `census_liquor_stores_current_operations` DE: absent 2013-2024
- `census_liquor_stores_current_operations` FL: absent 2013-2024
- `census_liquor_stores_current_operations` GA: absent 2013-2024
- `census_liquor_stores_current_operations` HI: absent 2013-2024
- `census_liquor_stores_current_operations` IL: absent 2013-2024
- `census_liquor_stores_current_operations` IN: absent 2013-2024
- `census_liquor_stores_current_operations` KS: absent 2013-2024
- `census_liquor_stores_current_operations` KY: absent 2013-2014, 2017-2024
- `census_liquor_stores_current_operations` LA: absent 2013-2024
- `census_liquor_stores_current_operations` ME: absent 2013-2016
- `census_liquor_stores_current_operations` MD: absent 2013-2024
- `census_liquor_stores_current_operations` MA: absent 2013-2024
- `census_liquor_stores_current_operations` MN: absent 2013-2024
- `census_liquor_stores_current_operations` MO: absent 2013-2024
- `census_liquor_stores_current_operations` NE: absent 2013-2024
- `census_liquor_stores_current_operations` NV: absent 2013-2024
- `census_liquor_stores_current_operations` NJ: absent 2013-2024
- `census_liquor_stores_current_operations` NM: absent 2013-2024
- `census_liquor_stores_current_operations` NY: absent 2013-2024
- … 10 more in metadata/completeness.csv

### State liquor store expenditure, total (Census -90)

Note: The 2005 classification redesign left the liquor store items unchanged (2006 Classification Manual, Appendix 1.6.2). No state government records for FY1973-FY1976.

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `census_liquor_stores_expenditure` | state fiscal year | 1972-2024 (49 yrs) | 50 | 15 | 35 | 1 | 2,040 / 2,450 | 0 | 410 |

Gaps inside the span (state level):

- `census_liquor_stores_expenditure` AK: absent 2013-2024
- `census_liquor_stores_expenditure` AZ: absent 2013-2024
- `census_liquor_stores_expenditure` AR: absent 2013-2024
- `census_liquor_stores_expenditure` CA: absent 2013-2024
- `census_liquor_stores_expenditure` CO: absent 2013-2024
- `census_liquor_stores_expenditure` CT: absent 2013-2024
- `census_liquor_stores_expenditure` DE: absent 2013-2024
- `census_liquor_stores_expenditure` FL: absent 2013-2024
- `census_liquor_stores_expenditure` GA: absent 2013-2024
- `census_liquor_stores_expenditure` HI: absent 2013-2024
- `census_liquor_stores_expenditure` IL: absent 2013-2024
- `census_liquor_stores_expenditure` IN: absent 2013-2024
- `census_liquor_stores_expenditure` KS: absent 2013-2024
- `census_liquor_stores_expenditure` KY: absent 2013-2014, 2017-2024
- `census_liquor_stores_expenditure` LA: absent 2013-2024
- `census_liquor_stores_expenditure` ME: absent 2013-2016
- `census_liquor_stores_expenditure` MD: absent 2013-2024
- `census_liquor_stores_expenditure` MA: absent 2013-2024
- `census_liquor_stores_expenditure` MN: absent 2013-2024
- `census_liquor_stores_expenditure` MO: absent 2013-2024
- `census_liquor_stores_expenditure` NE: absent 2013-2024
- `census_liquor_stores_expenditure` NV: absent 2013-2024
- `census_liquor_stores_expenditure` NJ: absent 2013-2024
- `census_liquor_stores_expenditure` NM: absent 2013-2024
- `census_liquor_stores_expenditure` NY: absent 2013-2024
- … 10 more in metadata/completeness.csv

### State liquor-store receipts (Census A90)

Note: The 2005 classification redesign left the liquor store items unchanged (2006 Classification Manual, Appendix 1.6.2). No state government records for FY1973-FY1976.

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `census_liquor_stores_revenue` | state fiscal year | 1972-2024 (49 yrs) | 50 | 16 | 34 | 1 | 2,042 / 2,450 | 0 | 408 |

Gaps inside the span (state level):

- `census_liquor_stores_revenue` AK: absent 2013-2024
- `census_liquor_stores_revenue` AZ: absent 2013-2024
- `census_liquor_stores_revenue` AR: absent 2013-2024
- `census_liquor_stores_revenue` CA: absent 2013-2024
- `census_liquor_stores_revenue` CO: absent 2013-2024
- `census_liquor_stores_revenue` CT: absent 2013-2024
- `census_liquor_stores_revenue` DE: absent 2013-2024
- `census_liquor_stores_revenue` FL: absent 2013-2024
- `census_liquor_stores_revenue` GA: absent 2013-2024
- `census_liquor_stores_revenue` HI: absent 2013-2024
- `census_liquor_stores_revenue` IL: absent 2013-2024
- `census_liquor_stores_revenue` IN: absent 2013-2024
- `census_liquor_stores_revenue` KS: absent 2013-2024
- `census_liquor_stores_revenue` KY: absent 2013-2024
- `census_liquor_stores_revenue` LA: absent 2013-2024
- `census_liquor_stores_revenue` MD: absent 2013-2024
- `census_liquor_stores_revenue` MA: absent 2013-2024
- `census_liquor_stores_revenue` MN: absent 2013-2024
- `census_liquor_stores_revenue` MO: absent 2013-2024
- `census_liquor_stores_revenue` NE: absent 2013-2024
- `census_liquor_stores_revenue` NV: absent 2013-2024
- `census_liquor_stores_revenue` NJ: absent 2013-2024
- `census_liquor_stores_revenue` NM: absent 2013-2024
- `census_liquor_stores_revenue` NY: absent 2013-2024
- `census_liquor_stores_revenue` NC: absent 2013-2024
- … 9 more in metadata/completeness.csv

### Beer, wine and liquor stores: establishments (Economic Census, NAICS 445310)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `ec_establishments_naics_445310` | calendar year | 2012-2017 (2 yrs) | 51 | 47 | 2 | 0 | 96 / 102 | 6 suppressed | 0 |

Gaps inside the span (state level):

- `ec_establishments_naics_445310` GA: missing 2012
- `ec_establishments_naics_445310` NH: missing 2012, 2017
- `ec_establishments_naics_445310` NM: missing 2017
- `ec_establishments_naics_445310` UT: missing 2012, 2017

### Beer, wine and liquor store sales (Economic Census, NAICS 445310)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `ec_sales_naics_445310` | calendar year | 2012-2017 (2 yrs) | 51 | 47 | 2 | 0 | 96 / 102 | 6 suppressed | 0 |

Gaps inside the span (state level):

- `ec_sales_naics_445310` GA: missing 2012
- `ec_sales_naics_445310` NH: missing 2012, 2017
- `ec_sales_naics_445310` NM: missing 2017
- `ec_sales_naics_445310` UT: missing 2012, 2017

### Alcohol-impaired-driving deaths per 100,000 residents (FARS)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `fars_alcohol_impaired_driving_deaths_per_100k` | calendar year | 2000-2023 (24 yrs) | 51 | 51 | 0 | 0 | 1,224 / 1,224 | 0 | 0 |

### Alcohol-impaired-driving fatalities (FARS, NHTSA definition)

Note: One definition; values can differ between FARS file versions (annual report file and final file).

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `fars_alcohol_impaired_driving_fatalities` | calendar year | 2000-2023 (24 yrs) | 51 | 51 | 0 | 0 | 1,224 / 1,224 | 0 | 0 |

### Traffic deaths per 100,000 residents (FARS)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `fars_traffic_deaths_per_100k` | calendar year | 2000-2023 (24 yrs) | 51 | 51 | 0 | 0 | 1,224 / 1,224 | 0 | 0 |

### Traffic fatalities (FARS)

Note: One definition; values can differ between FARS file versions (annual report file and final file).

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `fars_traffic_fatalities` | calendar year | 2000-2023 (24 yrs) | 51 | 51 | 0 | 0 | 1,224 / 1,224 | 0 | 0 |

### Alcohol-impaired-driving fatalities as published by NHTSA (state estimates report)

Note: One definition; values can differ between FARS file versions (annual report file and final file).

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `nhtsa_published_alcohol_impaired_driving_fatalities` | calendar year | 2013-2022 (2 yrs) | 51 | 51 | 0 | 0 | 102 / 102 | 0 | 0 |

### Traffic fatalities as published by NHTSA (state estimates report)

Note: One definition; values can differ between FARS file versions (annual report file and final file).

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `nhtsa_published_traffic_fatalities` | calendar year | 2013-2022 (2 yrs) | 51 | 51 | 0 | 0 | 102 / 102 | 0 | 0 |

### Apparent consumption, gallons of beer (beverage volume)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `niaaa_beverage_gallons_beer` | calendar year | 1970-2024 (55 yrs) | 51 | 51 | 0 | 0 | 2,805 / 2,805 | 0 | 0 |

### Apparent consumption, gallons of distilled spirits (beverage volume)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `niaaa_beverage_gallons_spirits` | calendar year | 1970-2024 (55 yrs) | 51 | 51 | 0 | 0 | 2,805 / 2,805 | 0 | 0 |

### Apparent consumption, gallons of wine (beverage volume)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `niaaa_beverage_gallons_wine` | calendar year | 1970-2024 (55 yrs) | 51 | 51 | 0 | 0 | 2,805 / 2,805 | 0 | 0 |

### Apparent consumption, gallons of ethanol from all alcoholic beverages

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `niaaa_ethanol_gallons_all` | calendar year | 1970-2024 (55 yrs) | 51 | 51 | 0 | 0 | 2,805 / 2,805 | 0 | 0 |

### Apparent consumption, gallons of ethanol from beer

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `niaaa_ethanol_gallons_beer` | calendar year | 1970-2024 (55 yrs) | 51 | 51 | 0 | 0 | 2,805 / 2,805 | 0 | 0 |

### Apparent consumption, gallons of ethanol from distilled spirits

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `niaaa_ethanol_gallons_spirits` | calendar year | 1970-2024 (55 yrs) | 51 | 51 | 0 | 0 | 2,805 / 2,805 | 0 | 0 |

### Gallons of ethanol from all alcoholic beverages, time-varying ABV method

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `niaaa_ethanol_gallons_time_varying_abv_all` | calendar year | 1970-2024 (55 yrs) | 51 | 0 | 51 | 0 | 2,448 / 2,805 | 357 not published | 0 |

Gaps inside the span (state level):

- `niaaa_ethanol_gallons_time_varying_abv_all` AL: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_all` AK: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_all` AZ: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_all` AR: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_all` CA: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_all` CO: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_all` CT: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_all` DE: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_all` DC: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_all` FL: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_all` GA: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_all` HI: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_all` ID: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_all` IL: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_all` IN: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_all` IA: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_all` KS: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_all` KY: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_all` LA: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_all` ME: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_all` MD: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_all` MA: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_all` MI: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_all` MN: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_all` MS: missing 1970-1976
- … 26 more in metadata/completeness.csv

### Gallons of ethanol from beer, time-varying ABV method

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `niaaa_ethanol_gallons_time_varying_abv_beer` | calendar year | 1970-2024 (55 yrs) | 51 | 0 | 51 | 0 | 2,448 / 2,805 | 357 not published | 0 |

Gaps inside the span (state level):

- `niaaa_ethanol_gallons_time_varying_abv_beer` AL: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_beer` AK: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_beer` AZ: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_beer` AR: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_beer` CA: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_beer` CO: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_beer` CT: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_beer` DE: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_beer` DC: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_beer` FL: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_beer` GA: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_beer` HI: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_beer` ID: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_beer` IL: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_beer` IN: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_beer` IA: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_beer` KS: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_beer` KY: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_beer` LA: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_beer` ME: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_beer` MD: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_beer` MA: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_beer` MI: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_beer` MN: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_beer` MS: missing 1970-1976
- … 26 more in metadata/completeness.csv

### Gallons of ethanol from distilled spirits, time-varying ABV method

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `niaaa_ethanol_gallons_time_varying_abv_spirits` | calendar year | 1970-2024 (55 yrs) | 51 | 0 | 51 | 0 | 2,448 / 2,805 | 357 not published | 0 |

Gaps inside the span (state level):

- `niaaa_ethanol_gallons_time_varying_abv_spirits` AL: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_spirits` AK: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_spirits` AZ: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_spirits` AR: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_spirits` CA: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_spirits` CO: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_spirits` CT: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_spirits` DE: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_spirits` DC: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_spirits` FL: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_spirits` GA: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_spirits` HI: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_spirits` ID: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_spirits` IL: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_spirits` IN: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_spirits` IA: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_spirits` KS: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_spirits` KY: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_spirits` LA: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_spirits` ME: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_spirits` MD: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_spirits` MA: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_spirits` MI: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_spirits` MN: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_spirits` MS: missing 1970-1976
- … 26 more in metadata/completeness.csv

### Gallons of ethanol from wine, time-varying ABV method

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `niaaa_ethanol_gallons_time_varying_abv_wine` | calendar year | 1970-2024 (55 yrs) | 51 | 0 | 51 | 0 | 2,448 / 2,805 | 357 not published | 0 |

Gaps inside the span (state level):

- `niaaa_ethanol_gallons_time_varying_abv_wine` AL: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_wine` AK: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_wine` AZ: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_wine` AR: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_wine` CA: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_wine` CO: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_wine` CT: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_wine` DE: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_wine` DC: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_wine` FL: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_wine` GA: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_wine` HI: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_wine` ID: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_wine` IL: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_wine` IN: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_wine` IA: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_wine` KS: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_wine` KY: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_wine` LA: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_wine` ME: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_wine` MD: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_wine` MA: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_wine` MI: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_wine` MN: missing 1970-1976
- `niaaa_ethanol_gallons_time_varying_abv_wine` MS: missing 1970-1976
- … 26 more in metadata/completeness.csv

### Apparent consumption, gallons of ethanol from wine

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `niaaa_ethanol_gallons_wine` | calendar year | 1970-2024 (55 yrs) | 51 | 51 | 0 | 0 | 2,805 / 2,805 | 0 | 0 |

### Apparent consumption per capita age 14 and older, gallons of ethanol (all alcoholic beverages)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `niaaa_ethanol_per_capita_14plus_all` | calendar year | 1970-2024 (55 yrs) | 51 | 51 | 0 | 0 | 2,805 / 2,805 | 0 | 0 |

### Apparent consumption per capita age 14 and older, gallons of ethanol (beer)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `niaaa_ethanol_per_capita_14plus_beer` | calendar year | 1970-2024 (55 yrs) | 51 | 51 | 0 | 0 | 2,805 / 2,805 | 0 | 0 |

### Apparent consumption per capita age 14 and older, gallons of ethanol (distilled spirits)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `niaaa_ethanol_per_capita_14plus_spirits` | calendar year | 1970-2024 (55 yrs) | 51 | 51 | 0 | 0 | 2,805 / 2,805 | 0 | 0 |

### Apparent consumption per capita age 14 and older, gallons of ethanol (wine)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `niaaa_ethanol_per_capita_14plus_wine` | calendar year | 1970-2024 (55 yrs) | 51 | 51 | 0 | 0 | 2,805 / 2,805 | 0 | 0 |

### Apparent consumption per capita age 21 and older, gallons of ethanol (all alcoholic beverages)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `niaaa_ethanol_per_capita_21plus_all` | calendar year | 1970-2024 (55 yrs) | 51 | 51 | 0 | 0 | 2,805 / 2,805 | 0 | 0 |

### Apparent consumption per capita age 21 and older, gallons of ethanol (beer)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `niaaa_ethanol_per_capita_21plus_beer` | calendar year | 1970-2024 (55 yrs) | 51 | 51 | 0 | 0 | 2,805 / 2,805 | 0 | 0 |

### Apparent consumption per capita age 21 and older, gallons of ethanol (distilled spirits)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `niaaa_ethanol_per_capita_21plus_spirits` | calendar year | 1970-2024 (55 yrs) | 51 | 51 | 0 | 0 | 2,805 / 2,805 | 0 | 0 |

### Apparent consumption per capita age 21 and older, gallons of ethanol (wine)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `niaaa_ethanol_per_capita_21plus_wine` | calendar year | 1970-2024 (55 yrs) | 51 | 51 | 0 | 0 | 2,805 / 2,805 | 0 | 0 |

### Time-varying alcohol by volume used for beer

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `niaaa_time_varying_abv_beer` | calendar year | 1970-2024 (55 yrs) | 51 | 0 | 51 | 0 | 2,448 / 2,805 | 357 not published | 0 |

Gaps inside the span (state level):

- `niaaa_time_varying_abv_beer` AL: missing 1970-1976
- `niaaa_time_varying_abv_beer` AK: missing 1970-1976
- `niaaa_time_varying_abv_beer` AZ: missing 1970-1976
- `niaaa_time_varying_abv_beer` AR: missing 1970-1976
- `niaaa_time_varying_abv_beer` CA: missing 1970-1976
- `niaaa_time_varying_abv_beer` CO: missing 1970-1976
- `niaaa_time_varying_abv_beer` CT: missing 1970-1976
- `niaaa_time_varying_abv_beer` DE: missing 1970-1976
- `niaaa_time_varying_abv_beer` DC: missing 1970-1976
- `niaaa_time_varying_abv_beer` FL: missing 1970-1976
- `niaaa_time_varying_abv_beer` GA: missing 1970-1976
- `niaaa_time_varying_abv_beer` HI: missing 1970-1976
- `niaaa_time_varying_abv_beer` ID: missing 1970-1976
- `niaaa_time_varying_abv_beer` IL: missing 1970-1976
- `niaaa_time_varying_abv_beer` IN: missing 1970-1976
- `niaaa_time_varying_abv_beer` IA: missing 1970-1976
- `niaaa_time_varying_abv_beer` KS: missing 1970-1976
- `niaaa_time_varying_abv_beer` KY: missing 1970-1976
- `niaaa_time_varying_abv_beer` LA: missing 1970-1976
- `niaaa_time_varying_abv_beer` ME: missing 1970-1976
- `niaaa_time_varying_abv_beer` MD: missing 1970-1976
- `niaaa_time_varying_abv_beer` MA: missing 1970-1976
- `niaaa_time_varying_abv_beer` MI: missing 1970-1976
- `niaaa_time_varying_abv_beer` MN: missing 1970-1976
- `niaaa_time_varying_abv_beer` MS: missing 1970-1976
- … 26 more in metadata/completeness.csv

### Time-varying alcohol by volume used for distilled spirits

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `niaaa_time_varying_abv_spirits` | calendar year | 1970-2024 (55 yrs) | 51 | 0 | 51 | 0 | 2,448 / 2,805 | 357 not published | 0 |

Gaps inside the span (state level):

- `niaaa_time_varying_abv_spirits` AL: missing 1970-1976
- `niaaa_time_varying_abv_spirits` AK: missing 1970-1976
- `niaaa_time_varying_abv_spirits` AZ: missing 1970-1976
- `niaaa_time_varying_abv_spirits` AR: missing 1970-1976
- `niaaa_time_varying_abv_spirits` CA: missing 1970-1976
- `niaaa_time_varying_abv_spirits` CO: missing 1970-1976
- `niaaa_time_varying_abv_spirits` CT: missing 1970-1976
- `niaaa_time_varying_abv_spirits` DE: missing 1970-1976
- `niaaa_time_varying_abv_spirits` DC: missing 1970-1976
- `niaaa_time_varying_abv_spirits` FL: missing 1970-1976
- `niaaa_time_varying_abv_spirits` GA: missing 1970-1976
- `niaaa_time_varying_abv_spirits` HI: missing 1970-1976
- `niaaa_time_varying_abv_spirits` ID: missing 1970-1976
- `niaaa_time_varying_abv_spirits` IL: missing 1970-1976
- `niaaa_time_varying_abv_spirits` IN: missing 1970-1976
- `niaaa_time_varying_abv_spirits` IA: missing 1970-1976
- `niaaa_time_varying_abv_spirits` KS: missing 1970-1976
- `niaaa_time_varying_abv_spirits` KY: missing 1970-1976
- `niaaa_time_varying_abv_spirits` LA: missing 1970-1976
- `niaaa_time_varying_abv_spirits` ME: missing 1970-1976
- `niaaa_time_varying_abv_spirits` MD: missing 1970-1976
- `niaaa_time_varying_abv_spirits` MA: missing 1970-1976
- `niaaa_time_varying_abv_spirits` MI: missing 1970-1976
- `niaaa_time_varying_abv_spirits` MN: missing 1970-1976
- `niaaa_time_varying_abv_spirits` MS: missing 1970-1976
- … 26 more in metadata/completeness.csv

### Time-varying alcohol by volume used for wine

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `niaaa_time_varying_abv_wine` | calendar year | 1970-2024 (55 yrs) | 51 | 0 | 51 | 0 | 2,448 / 2,805 | 357 not published | 0 |

Gaps inside the span (state level):

- `niaaa_time_varying_abv_wine` AL: missing 1970-1976
- `niaaa_time_varying_abv_wine` AK: missing 1970-1976
- `niaaa_time_varying_abv_wine` AZ: missing 1970-1976
- `niaaa_time_varying_abv_wine` AR: missing 1970-1976
- `niaaa_time_varying_abv_wine` CA: missing 1970-1976
- `niaaa_time_varying_abv_wine` CO: missing 1970-1976
- `niaaa_time_varying_abv_wine` CT: missing 1970-1976
- `niaaa_time_varying_abv_wine` DE: missing 1970-1976
- `niaaa_time_varying_abv_wine` DC: missing 1970-1976
- `niaaa_time_varying_abv_wine` FL: missing 1970-1976
- `niaaa_time_varying_abv_wine` GA: missing 1970-1976
- `niaaa_time_varying_abv_wine` HI: missing 1970-1976
- `niaaa_time_varying_abv_wine` ID: missing 1970-1976
- `niaaa_time_varying_abv_wine` IL: missing 1970-1976
- `niaaa_time_varying_abv_wine` IN: missing 1970-1976
- `niaaa_time_varying_abv_wine` IA: missing 1970-1976
- `niaaa_time_varying_abv_wine` KS: missing 1970-1976
- `niaaa_time_varying_abv_wine` KY: missing 1970-1976
- `niaaa_time_varying_abv_wine` LA: missing 1970-1976
- `niaaa_time_varying_abv_wine` ME: missing 1970-1976
- `niaaa_time_varying_abv_wine` MD: missing 1970-1976
- `niaaa_time_varying_abv_wine` MA: missing 1970-1976
- `niaaa_time_varying_abv_wine` MI: missing 1970-1976
- `niaaa_time_varying_abv_wine` MN: missing 1970-1976
- `niaaa_time_varying_abv_wine` MS: missing 1970-1976
- … 26 more in metadata/completeness.csv

### Pennsylvania State Stores Fund cost of goods sold (audited)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `pa_plcb_ssf_cost_of_goods_sold` | state fiscal year | 2023-2025 (3 yrs) | 1 | 1 | 0 | 50 | 3 / 3 | 0 | 0 |

### Pennsylvania State Stores Fund gross profit from sales (audited)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `pa_plcb_ssf_gross_profit` | state fiscal year | 2023-2025 (3 yrs) | 1 | 1 | 0 | 50 | 3 / 3 | 0 | 0 |

### Pennsylvania State Stores Fund operating expenses (audited)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `pa_plcb_ssf_operating_expenses` | state fiscal year | 2023-2025 (3 yrs) | 1 | 1 | 0 | 50 | 3 / 3 | 0 | 0 |

### Pennsylvania State Stores Fund sales net of taxes (audited)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `pa_plcb_ssf_sales_net_of_taxes` | state fiscal year | 2023-2025 (3 yrs) | 1 | 1 | 0 | 50 | 3 / 3 | 0 | 0 |

### Pennsylvania State Stores Fund total operating income (audited)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `pa_plcb_ssf_total_operating_income` | state fiscal year | 2023-2025 (3 yrs) | 1 | 1 | 0 | 50 | 3 / 3 | 0 | 0 |

### Pennsylvania State Stores Fund transfer to drug and alcohol programs (audited)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `pa_plcb_ssf_transfer_drug_alcohol_programs` | state fiscal year | 2023-2025 (3 yrs) | 1 | 1 | 0 | 50 | 3 / 3 | 0 | 0 |

### Pennsylvania State Stores Fund transfer to the General Fund (audited)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `pa_plcb_ssf_transfer_general_fund` | state fiscal year | 2023-2025 (3 yrs) | 1 | 1 | 0 | 50 | 3 / 3 | 0 | 0 |

### Pennsylvania State Stores Fund transfer for Pennsylvania State Police enforcement (audited)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `pa_plcb_ssf_transfer_psp_enforcement` | state fiscal year | 2023-2025 (3 yrs) | 1 | 1 | 0 | 50 | 3 / 3 | 0 | 0 |

### Resident population age 14 and older

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `pop_age14plus_resident` | calendar year | 1970-2024 (55 yrs) | 51 | 51 | 0 | 0 | 2,805 / 2,805 | 0 | 0 |
| `pop_age14plus_resident` | point in time | 2000-2025 (26 yrs) | 51 | 51 | 0 | 0 | 1,326 / 1,326 | 0 | 0 |

### Resident population age 18 and older

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `pop_age18plus_resident` | point in time | 2000-2025 (26 yrs) | 51 | 51 | 0 | 0 | 1,326 / 1,326 | 0 | 0 |

### Resident population age 21 and older

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `pop_age21plus_resident` | calendar year | 1970-2024 (55 yrs) | 51 | 51 | 0 | 0 | 2,805 / 2,805 | 0 | 0 |
| `pop_age21plus_resident` | point in time | 2000-2025 (26 yrs) | 51 | 51 | 0 | 0 | 1,326 / 1,326 | 0 | 0 |

### Resident population, all ages

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `pop_total_resident` | point in time | 1990-2025 (36 yrs) | 51 | 51 | 0 | 0 | 1,836 / 1,836 | 0 | 0 |

### State alcoholic beverage license taxes (Census T20)

Note: Census changed its classification of state government finance statistics effective FY2005 (State_Govt_Fin readme); whether this item was affected has not been checked. Large unexplained one-year changes are listed in the research queue (gap_stc_series_breaks).

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `stc_alcoholic_beverages_license_tax` | state fiscal year | 1941-2025 (85 yrs) | 51 | 0 | 51 | 0 | 3,943 / 4,335 | 40 not applicable | 352 |

Gaps inside the span (state level):

- `stc_alcoholic_beverages_license_tax` AL: absent 1942, 1944, 1946, 1948, 1955
- `stc_alcoholic_beverages_license_tax` AK: absent 1941-1956
- `stc_alcoholic_beverages_license_tax` AZ: absent 1941, 1943, 1945, 1947, 1949
- `stc_alcoholic_beverages_license_tax` AR: absent 1941, 1943, 1945, 1947, 1949
- `stc_alcoholic_beverages_license_tax` CA: absent 1941, 1943, 1945, 1947, 1949
- `stc_alcoholic_beverages_license_tax` CO: absent 1941, 1943, 1945, 1947, 1949
- `stc_alcoholic_beverages_license_tax` CT: absent 1941, 1943, 1945, 1947, 1949
- `stc_alcoholic_beverages_license_tax` DE: absent 1941, 1943, 1945, 1947, 1949
- `stc_alcoholic_beverages_license_tax` DC: absent 1941-2022
- `stc_alcoholic_beverages_license_tax` FL: absent 1941, 1943, 1945, 1947, 1949
- `stc_alcoholic_beverages_license_tax` GA: absent 1941, 1943, 1945, 1947, 1949
- `stc_alcoholic_beverages_license_tax` HI: missing 2015-2025; absent 1941-1954
- `stc_alcoholic_beverages_license_tax` ID: absent 1941, 1943, 1945, 1947, 1949
- `stc_alcoholic_beverages_license_tax` IL: absent 1941, 1943, 1945, 1947, 1949
- `stc_alcoholic_beverages_license_tax` IN: absent 1941, 1943, 1945, 1947, 1949
- `stc_alcoholic_beverages_license_tax` IA: absent 1941, 1943, 1945, 1947, 1949
- `stc_alcoholic_beverages_license_tax` KS: absent 1941, 1943, 1945, 1947, 1949
- `stc_alcoholic_beverages_license_tax` KY: absent 1941, 1943, 1945, 1947, 1949
- `stc_alcoholic_beverages_license_tax` LA: missing 2015-2020; absent 1942-1943, 1945, 1947, 1949
- `stc_alcoholic_beverages_license_tax` ME: absent 1941, 1943, 1945, 1947, 1949
- `stc_alcoholic_beverages_license_tax` MD: absent 1942-1943, 1945, 1947, 1949
- `stc_alcoholic_beverages_license_tax` MA: absent 1942-1943, 1945, 1947, 1949
- `stc_alcoholic_beverages_license_tax` MI: absent 1941, 1943, 1945, 1947, 1949
- `stc_alcoholic_beverages_license_tax` MN: absent 1941, 1943, 1945, 1947, 1949
- `stc_alcoholic_beverages_license_tax` MS: absent 1941, 1943, 1945, 1947, 1949
- … 26 more in metadata/completeness.csv

### State alcoholic beverage sales taxes (Census T10)

Note: Census changed its classification of state government finance statistics effective FY2005 (State_Govt_Fin readme); whether this item was affected has not been checked. Large unexplained one-year changes are listed in the research queue (gap_stc_series_breaks).

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `stc_alcoholic_beverages_sales_tax` | state fiscal year | 1941-2025 (85 yrs) | 51 | 0 | 51 | 0 | 3,983 / 4,335 | 0 | 352 |

Gaps inside the span (state level):

- `stc_alcoholic_beverages_sales_tax` AL: absent 1942, 1944, 1946, 1948, 1955
- `stc_alcoholic_beverages_sales_tax` AK: absent 1941-1956
- `stc_alcoholic_beverages_sales_tax` AZ: absent 1941, 1943, 1945, 1947, 1949
- `stc_alcoholic_beverages_sales_tax` AR: absent 1941, 1943, 1945, 1947, 1949
- `stc_alcoholic_beverages_sales_tax` CA: absent 1941, 1943, 1945, 1947, 1949
- `stc_alcoholic_beverages_sales_tax` CO: absent 1941, 1943, 1945, 1947, 1949
- `stc_alcoholic_beverages_sales_tax` CT: absent 1941, 1943, 1945, 1947, 1949
- `stc_alcoholic_beverages_sales_tax` DE: absent 1941, 1943, 1945, 1947, 1949
- `stc_alcoholic_beverages_sales_tax` DC: absent 1941-2022
- `stc_alcoholic_beverages_sales_tax` FL: absent 1941, 1943, 1945, 1947, 1949
- `stc_alcoholic_beverages_sales_tax` GA: absent 1941, 1943, 1945, 1947, 1949
- `stc_alcoholic_beverages_sales_tax` HI: absent 1941-1954
- `stc_alcoholic_beverages_sales_tax` ID: absent 1941, 1943, 1945, 1947, 1949
- `stc_alcoholic_beverages_sales_tax` IL: absent 1941, 1943, 1945, 1947, 1949
- `stc_alcoholic_beverages_sales_tax` IN: absent 1941, 1943, 1945, 1947, 1949
- `stc_alcoholic_beverages_sales_tax` IA: absent 1941, 1943, 1945, 1947, 1949
- `stc_alcoholic_beverages_sales_tax` KS: absent 1941, 1943, 1945, 1947, 1949
- `stc_alcoholic_beverages_sales_tax` KY: absent 1941, 1943, 1945, 1947, 1949
- `stc_alcoholic_beverages_sales_tax` LA: absent 1942-1943, 1945, 1947, 1949
- `stc_alcoholic_beverages_sales_tax` ME: absent 1941, 1943, 1945, 1947, 1949
- `stc_alcoholic_beverages_sales_tax` MD: absent 1942-1943, 1945, 1947, 1949
- `stc_alcoholic_beverages_sales_tax` MA: absent 1942-1943, 1945, 1947, 1949
- `stc_alcoholic_beverages_sales_tax` MI: absent 1941, 1943, 1945, 1947, 1949
- `stc_alcoholic_beverages_sales_tax` MN: absent 1941, 1943, 1945, 1947, 1949
- `stc_alcoholic_beverages_sales_tax` MS: absent 1941, 1943, 1945, 1947, 1949
- … 26 more in metadata/completeness.csv

### State alcoholic beverage sales taxes per resident (derived)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `stc_alcoholic_beverages_sales_tax_per_capita` | state fiscal year | 1990-2025 (36 yrs) | 51 | 3 | 48 | 0 | 1,756 / 1,836 | 0 | 80 |

Gaps inside the span (state level):

- `stc_alcoholic_beverages_sales_tax_per_capita` AK: absent 1990
- `stc_alcoholic_beverages_sales_tax_per_capita` AZ: absent 1990
- `stc_alcoholic_beverages_sales_tax_per_capita` AR: absent 1990
- `stc_alcoholic_beverages_sales_tax_per_capita` CA: absent 1990
- `stc_alcoholic_beverages_sales_tax_per_capita` CO: absent 1990
- `stc_alcoholic_beverages_sales_tax_per_capita` CT: absent 1990
- `stc_alcoholic_beverages_sales_tax_per_capita` DE: absent 1990
- `stc_alcoholic_beverages_sales_tax_per_capita` DC: absent 1990-2022
- `stc_alcoholic_beverages_sales_tax_per_capita` FL: absent 1990
- `stc_alcoholic_beverages_sales_tax_per_capita` GA: absent 1990
- `stc_alcoholic_beverages_sales_tax_per_capita` HI: absent 1990
- `stc_alcoholic_beverages_sales_tax_per_capita` ID: absent 1990
- `stc_alcoholic_beverages_sales_tax_per_capita` IL: absent 1990
- `stc_alcoholic_beverages_sales_tax_per_capita` IN: absent 1990
- `stc_alcoholic_beverages_sales_tax_per_capita` IA: absent 1990
- `stc_alcoholic_beverages_sales_tax_per_capita` KS: absent 1990
- `stc_alcoholic_beverages_sales_tax_per_capita` KY: absent 1990
- `stc_alcoholic_beverages_sales_tax_per_capita` LA: absent 1990
- `stc_alcoholic_beverages_sales_tax_per_capita` ME: absent 1990
- `stc_alcoholic_beverages_sales_tax_per_capita` MD: absent 1990
- `stc_alcoholic_beverages_sales_tax_per_capita` MA: absent 1990
- `stc_alcoholic_beverages_sales_tax_per_capita` MN: absent 1990
- `stc_alcoholic_beverages_sales_tax_per_capita` MS: absent 1990
- `stc_alcoholic_beverages_sales_tax_per_capita` MO: absent 1990
- `stc_alcoholic_beverages_sales_tax_per_capita` MT: absent 1990
- … 23 more in metadata/completeness.csv

### State alcoholic beverage sales taxes per resident age 21+ (derived)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `stc_alcoholic_beverages_sales_tax_per_resident_21plus` | state fiscal year | 1990-2025 (36 yrs) | 51 | 0 | 51 | 0 | 1,256 / 1,836 | 500 unavailable | 80 |

Gaps inside the span (state level):

- `stc_alcoholic_beverages_sales_tax_per_resident_21plus` AL: missing 1990-1999
- `stc_alcoholic_beverages_sales_tax_per_resident_21plus` AK: missing 1991-2000; absent 1990
- `stc_alcoholic_beverages_sales_tax_per_resident_21plus` AZ: missing 1991-2000; absent 1990
- `stc_alcoholic_beverages_sales_tax_per_resident_21plus` AR: missing 1991-2000; absent 1990
- `stc_alcoholic_beverages_sales_tax_per_resident_21plus` CA: missing 1991-2000; absent 1990
- `stc_alcoholic_beverages_sales_tax_per_resident_21plus` CO: missing 1991-2000; absent 1990
- `stc_alcoholic_beverages_sales_tax_per_resident_21plus` CT: missing 1991-2000; absent 1990
- `stc_alcoholic_beverages_sales_tax_per_resident_21plus` DE: missing 1991-2000; absent 1990
- `stc_alcoholic_beverages_sales_tax_per_resident_21plus` DC: absent 1990-2022
- `stc_alcoholic_beverages_sales_tax_per_resident_21plus` FL: missing 1991-2000; absent 1990
- `stc_alcoholic_beverages_sales_tax_per_resident_21plus` GA: missing 1991-2000; absent 1990
- `stc_alcoholic_beverages_sales_tax_per_resident_21plus` HI: missing 1991-2000; absent 1990
- `stc_alcoholic_beverages_sales_tax_per_resident_21plus` ID: missing 1991-2000; absent 1990
- `stc_alcoholic_beverages_sales_tax_per_resident_21plus` IL: missing 1991-2000; absent 1990
- `stc_alcoholic_beverages_sales_tax_per_resident_21plus` IN: missing 1991-2000; absent 1990
- `stc_alcoholic_beverages_sales_tax_per_resident_21plus` IA: missing 1991-2000; absent 1990
- `stc_alcoholic_beverages_sales_tax_per_resident_21plus` KS: missing 1991-2000; absent 1990
- `stc_alcoholic_beverages_sales_tax_per_resident_21plus` KY: missing 1991-2000; absent 1990
- `stc_alcoholic_beverages_sales_tax_per_resident_21plus` LA: missing 1991-2000; absent 1990
- `stc_alcoholic_beverages_sales_tax_per_resident_21plus` ME: missing 1991-2000; absent 1990
- `stc_alcoholic_beverages_sales_tax_per_resident_21plus` MD: missing 1991-2000; absent 1990
- `stc_alcoholic_beverages_sales_tax_per_resident_21plus` MA: missing 1991-2000; absent 1990
- `stc_alcoholic_beverages_sales_tax_per_resident_21plus` MI: missing 1990-1999
- `stc_alcoholic_beverages_sales_tax_per_resident_21plus` MN: missing 1991-2000; absent 1990
- `stc_alcoholic_beverages_sales_tax_per_resident_21plus` MS: missing 1991-2000; absent 1990
- … 26 more in metadata/completeness.csv

### State alcoholic beverage sales taxes, constant 2024 dollars (derived)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `stc_alcoholic_beverages_sales_tax_real_cy2024usd` | state fiscal year | 1990-2025 (36 yrs) | 51 | 3 | 48 | 0 | 1,756 / 1,836 | 0 | 80 |

Gaps inside the span (state level):

- `stc_alcoholic_beverages_sales_tax_real_cy2024usd` AK: absent 1990
- `stc_alcoholic_beverages_sales_tax_real_cy2024usd` AZ: absent 1990
- `stc_alcoholic_beverages_sales_tax_real_cy2024usd` AR: absent 1990
- `stc_alcoholic_beverages_sales_tax_real_cy2024usd` CA: absent 1990
- `stc_alcoholic_beverages_sales_tax_real_cy2024usd` CO: absent 1990
- `stc_alcoholic_beverages_sales_tax_real_cy2024usd` CT: absent 1990
- `stc_alcoholic_beverages_sales_tax_real_cy2024usd` DE: absent 1990
- `stc_alcoholic_beverages_sales_tax_real_cy2024usd` DC: absent 1990-2022
- `stc_alcoholic_beverages_sales_tax_real_cy2024usd` FL: absent 1990
- `stc_alcoholic_beverages_sales_tax_real_cy2024usd` GA: absent 1990
- `stc_alcoholic_beverages_sales_tax_real_cy2024usd` HI: absent 1990
- `stc_alcoholic_beverages_sales_tax_real_cy2024usd` ID: absent 1990
- `stc_alcoholic_beverages_sales_tax_real_cy2024usd` IL: absent 1990
- `stc_alcoholic_beverages_sales_tax_real_cy2024usd` IN: absent 1990
- `stc_alcoholic_beverages_sales_tax_real_cy2024usd` IA: absent 1990
- `stc_alcoholic_beverages_sales_tax_real_cy2024usd` KS: absent 1990
- `stc_alcoholic_beverages_sales_tax_real_cy2024usd` KY: absent 1990
- `stc_alcoholic_beverages_sales_tax_real_cy2024usd` LA: absent 1990
- `stc_alcoholic_beverages_sales_tax_real_cy2024usd` ME: absent 1990
- `stc_alcoholic_beverages_sales_tax_real_cy2024usd` MD: absent 1990
- `stc_alcoholic_beverages_sales_tax_real_cy2024usd` MA: absent 1990
- `stc_alcoholic_beverages_sales_tax_real_cy2024usd` MN: absent 1990
- `stc_alcoholic_beverages_sales_tax_real_cy2024usd` MS: absent 1990
- `stc_alcoholic_beverages_sales_tax_real_cy2024usd` MO: absent 1990
- `stc_alcoholic_beverages_sales_tax_real_cy2024usd` MT: absent 1990
- … 23 more in metadata/completeness.csv

### State total taxes (Census C105)

Note: Census changed its classification of state government finance statistics effective FY2005 (State_Govt_Fin readme); whether this item was affected has not been checked. Large unexplained one-year changes are listed in the research queue (gap_stc_series_breaks).

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `stc_total_taxes` | state fiscal year | 1941-2025 (85 yrs) | 50 | 0 | 50 | 1 | 3,980 / 4,250 | 0 | 270 |

Gaps inside the span (state level):

- `stc_total_taxes` AL: absent 1942, 1944, 1946, 1948, 1955
- `stc_total_taxes` AK: absent 1941-1956
- `stc_total_taxes` AZ: absent 1941, 1943, 1945, 1947, 1949
- `stc_total_taxes` AR: absent 1941, 1943, 1945, 1947, 1949
- `stc_total_taxes` CA: absent 1941, 1943, 1945, 1947, 1949
- `stc_total_taxes` CO: absent 1941, 1943, 1945, 1947, 1949
- `stc_total_taxes` CT: absent 1941, 1943, 1945, 1947, 1949
- `stc_total_taxes` DE: absent 1941, 1943, 1945, 1947, 1949
- `stc_total_taxes` FL: absent 1941, 1943, 1945, 1947, 1949
- `stc_total_taxes` GA: absent 1941, 1943, 1945, 1947, 1949
- `stc_total_taxes` HI: absent 1941-1954
- `stc_total_taxes` ID: absent 1941, 1943, 1945, 1947, 1949
- `stc_total_taxes` IL: absent 1941, 1943, 1945, 1947, 1949
- `stc_total_taxes` IN: absent 1941, 1943, 1945, 1947, 1949
- `stc_total_taxes` IA: absent 1941, 1943, 1945, 1947, 1949
- `stc_total_taxes` KS: absent 1941, 1943, 1945, 1947, 1949
- `stc_total_taxes` KY: absent 1941, 1943, 1945, 1947, 1949
- `stc_total_taxes` LA: absent 1942-1943, 1945, 1947, 1949
- `stc_total_taxes` ME: absent 1941, 1943, 1945, 1947, 1949
- `stc_total_taxes` MD: absent 1942-1943, 1945, 1947, 1949
- `stc_total_taxes` MA: absent 1942-1943, 1945, 1947, 1949
- `stc_total_taxes` MI: absent 1941, 1943, 1945, 1947, 1949
- `stc_total_taxes` MN: absent 1941, 1943, 1945, 1947, 1949
- `stc_total_taxes` MS: absent 1941, 1943, 1945, 1947, 1949
- `stc_total_taxes` MO: absent 1942, 1944-1945, 1947, 1949
- … 25 more in metadata/completeness.csv

### Tennessee Department of Revenue account 11002

- `tn_dor_wine_tax_collections`: FY2010-FY2017: printed 'Wine Tax'.
- `tn_dor_account_11002_with_high_alcohol_beer`: FY2018 on: printed 'Wine Tax & High Alcohol Beer'. Not wine-only; the statutory reason for the relabelling is not recorded yet.

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `tn_dor_wine_tax_collections` | state fiscal year | 2010-2017 (8 yrs) | 1 | 1 | 0 | 50 | 8 / 8 | 0 | 0 |
| `tn_dor_account_11002_with_high_alcohol_beer` | state fiscal year | 2018-2025 (8 yrs) | 1 | 1 | 0 | 50 | 8 / 8 | 0 | 0 |

### Tennessee ALCOHOLIC BEVERAGES class total (Department of Revenue)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `tn_dor_alcoholic_beverages_class_total` | state fiscal year | 2010-2025 (16 yrs) | 1 | 1 | 0 | 50 | 16 / 16 | 0 | 0 |

### Tennessee wine enforcement tax collections (account 11018)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `tn_dor_wine_enforcement_tax_collections` | state fiscal year | 2010-2025 (16 yrs) | 1 | 1 | 0 | 50 | 16 / 16 | 0 | 0 |

### Tennessee winery wine tax collections (account 11013)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `tn_dor_winery_wine_tax_collections` | state fiscal year | 2010-2025 (16 yrs) | 1 | 1 | 0 | 50 | 16 / 16 | 0 | 0 |

### Beer, wine and liquor stores' gross margin, percent of sales (Census ARTS, NAICS 4453)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `us_retail_gross_margin_pct_alcohol_stores` | calendar_year | 1993-2022 | 0 | 0 | 0 | 51 | — | — | — |

### Food and beverage stores' gross margin, percent of sales (Census ARTS, NAICS 445)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `us_retail_gross_margin_pct_food_beverage_stores` | calendar_year | 1993-2022 | 0 | 0 | 0 | 51 | — | — | — |

### Grocery stores' gross margin, percent of sales (Census ARTS, NAICS 4451)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `us_retail_gross_margin_pct_grocery_stores` | calendar_year | 1993-2022 | 0 | 0 | 0 | 51 | — | — | — |

### Retail gross margin, percent of sales (Census ARTS, all retail)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `us_retail_gross_margin_pct_total` | calendar_year | 1993-2022 | 0 | 0 | 0 | 51 | — | — | — |

### Warehouse clubs' and supercenters' gross margin, percent of sales (Census ARTS, NAICS 452311)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `us_retail_gross_margin_pct_warehouse_clubs_supercenters` | calendar_year | 1993-2022 | 0 | 0 | 0 | 51 | — | — | — |

### Beer, wine and spirits wholesalers' gross margin, percent of sales (Census AWTS, NAICS 4248)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `us_wholesale_gross_margin_pct_alcohol_beverages` | calendar_year | 1992-2022 | 0 | 0 | 0 | 51 | — | — | — |

### Grocery wholesalers' gross margin, percent of sales (Census AWTS, NAICS 4244)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `us_wholesale_gross_margin_pct_grocery` | calendar_year | 1992-2022 | 0 | 0 | 0 | 51 | — | — | — |

### Merchant wholesalers' gross margin, percent of sales (Census AWTS, NAICS 42)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `us_wholesale_gross_margin_pct_total` | calendar_year | 1992-2022 | 0 | 0 | 0 | 51 | — | — | — |

### Utah Alcoholic Beverage Services Fund income before transfers (audited)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `ut_abs_fund_income_before_transfers` | state fiscal year | 2022-2025 (4 yrs) | 1 | 1 | 0 | 50 | 4 / 4 | 0 | 0 |

### Utah Alcoholic Beverage Services Fund operating expenses (audited)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `ut_abs_fund_operating_expenses` | state fiscal year | 2022-2025 (4 yrs) | 1 | 1 | 0 | 50 | 4 / 4 | 0 | 0 |

### Utah Alcoholic Beverage Services Fund operating income (audited)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `ut_abs_fund_operating_income` | state fiscal year | 2022-2025 (4 yrs) | 1 | 1 | 0 | 50 | 4 / 4 | 0 | 0 |

### Utah Alcoholic Beverage Services Fund operating revenues (audited)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `ut_abs_fund_operating_revenues` | state fiscal year | 2013-2025 (13 yrs) | 1 | 1 | 0 | 50 | 13 / 13 | 0 | 0 |

### Utah Alcoholic Beverage Services Fund cash receipts from customers (audited)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `ut_abs_fund_receipts_from_customers` | state fiscal year | 2022-2025 (4 yrs) | 1 | 1 | 0 | 50 | 4 / 4 | 0 | 0 |

### Utah Alcoholic Beverage Services Fund sales revenue (audited)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `ut_abs_fund_sales_revenue` | state fiscal year | 2022-2025 (4 yrs) | 1 | 1 | 0 | 50 | 4 / 4 | 0 | 0 |

### Utah liquor retail sales expenses, government-wide (audited)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `ut_abs_govwide_liquor_expenses` | state fiscal year | 2013-2025 (13 yrs) | 1 | 1 | 0 | 50 | 13 / 13 | 0 | 0 |

### Utah liquor profit transfer to the General Fund (ACFR text)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `ut_abs_liquor_profit_transfer` | state fiscal year | 2024-2025 (2 yrs) | 1 | 1 | 0 | 50 | 2 / 2 | 0 | 0 |

### Utah Alcoholic Beverage Services Fund payments of sales tax and school lunch collections (audited)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `ut_abs_school_lunch_collections_paid` | state fiscal year | 2022-2025 (4 yrs) | 1 | 1 | 0 | 50 | 4 / 4 | 0 | 0 |

### DABS total cases sold

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `ut_dabs_cases_sold` | state fiscal year | 2020-2025 (6 yrs) | 1 | 1 | 0 | 50 | 6 / 6 | 0 | 0 |

### DABS cost of liquor sold

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `ut_dabs_cost_of_liquor_sold` | state fiscal year | 2015-2025 (6 yrs) | 1 | 1 | 0 | 50 | 6 / 6 | 0 | 0 |

### DABS credit card fees

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `ut_dabs_credit_card_fees` | state fiscal year | 2024-2025 (2 yrs) | 1 | 1 | 0 | 50 | 2 / 2 | 0 | 0 |

### DABS delivery to stores

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `ut_dabs_delivery_to_stores` | state fiscal year | 2024-2025 (2 yrs) | 1 | 1 | 0 | 50 | 2 / 2 | 0 | 0 |

### DABS sales in 9-liter cases, fiscal year: beer

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `ut_dabs_fy_cases_9l_beer` | state fiscal year | 2026-2026 (1 yrs) | 1 | 1 | 0 | 50 | 1 / 1 | 0 | 0 |

### DABS sales in 9-liter cases, fiscal year: cider

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `ut_dabs_fy_cases_9l_cider` | state fiscal year | 2026-2026 (1 yrs) | 1 | 1 | 0 | 50 | 1 / 1 | 0 | 0 |

### DABS sales in 9-liter cases, fiscal year: other

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `ut_dabs_fy_cases_9l_other` | state fiscal year | 2026-2026 (1 yrs) | 1 | 1 | 0 | 50 | 1 / 1 | 0 | 0 |

### DABS sales in 9-liter cases, fiscal year: premixed

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `ut_dabs_fy_cases_9l_premixed` | state fiscal year | 2026-2026 (1 yrs) | 1 | 1 | 0 | 50 | 1 / 1 | 0 | 0 |

### DABS sales in 9-liter cases, fiscal year: spirits

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `ut_dabs_fy_cases_9l_spirits` | state fiscal year | 2026-2026 (1 yrs) | 1 | 1 | 0 | 50 | 1 / 1 | 0 | 0 |

### DABS sales in 9-liter cases, fiscal year: total

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `ut_dabs_fy_cases_9l_total` | state fiscal year | 2026-2026 (1 yrs) | 1 | 1 | 0 | 50 | 1 / 1 | 0 | 0 |

### DABS sales in 9-liter cases, fiscal year: wine

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `ut_dabs_fy_cases_9l_wine` | state fiscal year | 2026-2026 (1 yrs) | 1 | 1 | 0 | 50 | 1 / 1 | 0 | 0 |

### DABS gross sales, fiscal year: beer

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `ut_dabs_fy_gross_sales_beer` | state fiscal year | 2026-2026 (1 yrs) | 1 | 1 | 0 | 50 | 1 / 1 | 0 | 0 |

### DABS gross sales, fiscal year: cider

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `ut_dabs_fy_gross_sales_cider` | state fiscal year | 2026-2026 (1 yrs) | 1 | 1 | 0 | 50 | 1 / 1 | 0 | 0 |

### DABS gross sales, fiscal year: other

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `ut_dabs_fy_gross_sales_other` | state fiscal year | 2026-2026 (1 yrs) | 1 | 1 | 0 | 50 | 1 / 1 | 0 | 0 |

### DABS gross sales, fiscal year: premixed

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `ut_dabs_fy_gross_sales_premixed` | state fiscal year | 2026-2026 (1 yrs) | 1 | 1 | 0 | 50 | 1 / 1 | 0 | 0 |

### DABS gross sales, fiscal year: spirits

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `ut_dabs_fy_gross_sales_spirits` | state fiscal year | 2026-2026 (1 yrs) | 1 | 1 | 0 | 50 | 1 / 1 | 0 | 0 |

### DABS gross sales, fiscal year: total

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `ut_dabs_fy_gross_sales_total` | state fiscal year | 2026-2026 (1 yrs) | 1 | 1 | 0 | 50 | 1 / 1 | 0 | 0 |

### DABS gross sales, fiscal year: wine

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `ut_dabs_fy_gross_sales_wine` | state fiscal year | 2026-2026 (1 yrs) | 1 | 1 | 0 | 50 | 1 / 1 | 0 | 0 |

### DABS gross profit

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `ut_dabs_gross_profit` | state fiscal year | 2012-2025 (14 yrs) | 1 | 1 | 0 | 50 | 14 / 14 | 0 | 0 |

### DABS liquor bags

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `ut_dabs_liquor_bags` | state fiscal year | 2024-2025 (2 yrs) | 1 | 1 | 0 | 50 | 2 / 2 | 0 | 0 |

### DABS revenue from liquor sales

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `ut_dabs_liquor_sales_revenue` | state fiscal year | 2012-2025 (14 yrs) | 1 | 0 | 1 | 50 | 13 / 14 | 1 unresolved conflict | 0 |

Gaps inside the span (state level):

- `ut_dabs_liquor_sales_revenue` UT: missing 2024

### DABS net operating income

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `ut_dabs_net_operating_income` | state fiscal year | 2022-2025 (4 yrs) | 1 | 1 | 0 | 50 | 4 / 4 | 0 | 0 |

### DABS net profit for transfer to the General Fund

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `ut_dabs_net_profit_general_fund` | state fiscal year | 2012-2025 (14 yrs) | 1 | 1 | 0 | 50 | 14 / 14 | 0 | 0 |

### DABS off-premise sales, share of its sales

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `ut_dabs_off_premise_sales_share` | state fiscal year | 2025-2025 (1 yrs) | 1 | 1 | 0 | 50 | 1 / 1 | 0 | 0 |

### DABS on-premise sales, share of its sales

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `ut_dabs_on_premise_sales_share` | state fiscal year | 2025-2025 (1 yrs) | 1 | 1 | 0 | 50 | 1 / 1 | 0 | 0 |

### DABS operating expenses (five-year summary row printed as operating and non-operating)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `ut_dabs_operating_nonoperating_expenses` | state fiscal year | 2012-2025 (14 yrs) | 1 | 1 | 0 | 50 | 14 / 14 | 0 | 0 |

### DABS other expenses net of revenues (operations summary)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `ut_dabs_other_expenses_net` | state fiscal year | 2020-2025 (6 yrs) | 1 | 1 | 0 | 50 | 6 / 6 | 0 | 0 |

### DABS other income

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `ut_dabs_other_income` | state fiscal year | 2012-2025 (14 yrs) | 1 | 0 | 1 | 50 | 12 / 14 | 2 unresolved conflict | 0 |

Gaps inside the span (state level):

- `ut_dabs_other_income` UT: missing 2024-2025

### DABS other program transfers (operations summary)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `ut_dabs_other_program_transfers` | state fiscal year | 2020-2025 (6 yrs) | 1 | 1 | 0 | 50 | 6 / 6 | 0 | 0 |

### DABS transfer to other programs

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `ut_dabs_other_programs_transfer` | state fiscal year | 2017-2025 (9 yrs) | 1 | 1 | 0 | 50 | 9 / 9 | 0 | 0 |

### DABS package agency contracts

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `ut_dabs_package_agency_contracts` | state fiscal year | 2024-2025 (2 yrs) | 1 | 1 | 0 | 50 | 2 / 2 | 0 | 0 |

### DABS Parents Empowered deduction

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `ut_dabs_parents_empowered` | state fiscal year | 2012-2025 (14 yrs) | 1 | 1 | 0 | 50 | 14 / 14 | 0 | 0 |

### DABS salaries and wages

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `ut_dabs_salaries_wages` | state fiscal year | 2020-2025 (6 yrs) | 1 | 1 | 0 | 50 | 6 / 6 | 0 | 0 |

### Sales tax reported by DABS

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `ut_dabs_sales_tax_reported` | state fiscal year | 2012-2025 (14 yrs) | 1 | 1 | 0 | 50 | 14 / 14 | 0 | 0 |

### DABS transfer to SBI

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `ut_dabs_sbi_transfer` | state fiscal year | 2012-2025 (14 yrs) | 1 | 1 | 0 | 50 | 14 / 14 | 0 | 0 |

### DABS transfer to School Lunch / Uniform School Fund

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `ut_dabs_school_lunch_transfer` | state fiscal year | 2012-2025 (14 yrs) | 1 | 1 | 0 | 50 | 14 / 14 | 0 | 0 |

### DABS transfer to School Lunch, Uniform School Fund and Public Safety

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `ut_dabs_school_lunch_usf_public_safety_transfer` | state fiscal year | 2022-2025 (4 yrs) | 1 | 1 | 0 | 50 | 4 / 4 | 0 | 0 |

### DABS total non-operating revenue / (expenses)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `ut_dabs_total_nonoperating_net` | state fiscal year | 2022-2025 (4 yrs) | 1 | 1 | 0 | 50 | 4 / 4 | 0 | 0 |

### DABS total operating expenses

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `ut_dabs_total_operating_expenses` | state fiscal year | 2022-2025 (4 yrs) | 1 | 1 | 0 | 50 | 4 / 4 | 0 | 0 |

### DABS total revenue

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `ut_dabs_total_revenue` | state fiscal year | 2012-2025 (14 yrs) | 1 | 0 | 1 | 50 | 11 / 14 | 3 unresolved conflict | 0 |

Gaps inside the span (state level):

- `ut_dabs_total_revenue` UT: missing 2022, 2024-2025

### DABS transfer to Underage Drinking Prevention Program

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `ut_dabs_underage_drinking_prevention_transfer` | state fiscal year | 2017-2025 (9 yrs) | 1 | 1 | 0 | 50 | 9 / 9 | 0 | 0 |

### Utah liquor sales allocated for school lunch (audited)

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `ut_liquor_sales_allocated_school_lunch` | state fiscal year | 2024-2025 (2 yrs) | 1 | 1 | 0 | 50 | 2 / 2 | 0 | 0 |

### Current binge drinking, high school students (YRBS, 2017 definition)

Note: Question wording as published in YRBSS for the year; states without weighted results for a year are absent, not zero.

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `yrbs_binge_drinking_hs_pct` | survey year | 2017-2023 (4 yrs) | 51 | 21 | 24 | 0 | 151 / 204 | 38 unavailable | 15 |

Gaps inside the span (state level):

- `yrbs_binge_drinking_hs_pct` AL: missing 2021, 2023; absent 2017
- `yrbs_binge_drinking_hs_pct` AK: missing 2021
- `yrbs_binge_drinking_hs_pct` AZ: missing 2023
- `yrbs_binge_drinking_hs_pct` CA: missing 2021, 2023
- `yrbs_binge_drinking_hs_pct` CO: missing 2023
- `yrbs_binge_drinking_hs_pct` DE: missing 2019
- `yrbs_binge_drinking_hs_pct` DC: absent 2017
- `yrbs_binge_drinking_hs_pct` FL: missing 2023
- `yrbs_binge_drinking_hs_pct` GA: missing 2023; absent 2017
- `yrbs_binge_drinking_hs_pct` ID: missing 2023
- `yrbs_binge_drinking_hs_pct` IL: missing 2023
- `yrbs_binge_drinking_hs_pct` IN: missing 2019; absent 2017
- `yrbs_binge_drinking_hs_pct` IA: missing 2023
- `yrbs_binge_drinking_hs_pct` KS: missing 2023
- `yrbs_binge_drinking_hs_pct` LA: missing 2023
- `yrbs_binge_drinking_hs_pct` ME: missing 2019, 2021, 2023; absent 2017
- `yrbs_binge_drinking_hs_pct` MN: missing 2019, 2021, 2023; absent 2017
- `yrbs_binge_drinking_hs_pct` MS: absent 2017
- `yrbs_binge_drinking_hs_pct` NH: absent 2017
- `yrbs_binge_drinking_hs_pct` NJ: absent 2017
- `yrbs_binge_drinking_hs_pct` NY: missing 2023
- `yrbs_binge_drinking_hs_pct` NC: missing 2023
- `yrbs_binge_drinking_hs_pct` OH: absent 2017
- `yrbs_binge_drinking_hs_pct` OR: missing 2019, 2021, 2023; absent 2017
- `yrbs_binge_drinking_hs_pct` SC: missing 2023
- … 5 more in metadata/completeness.csv

### Current alcohol use, high school students (YRBS)

Note: Question wording as published in YRBSS for the year; states without weighted results for a year are absent, not zero.

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `yrbs_current_alcohol_use_hs_pct` | survey year | 1991-2023 (17 yrs) | 51 | 0 | 48 | 0 | 549 / 867 | 30 unavailable | 288 |

Gaps inside the span (state level):

- `yrbs_current_alcohol_use_hs_pct` AL: missing 2023; absent 2007, 2017
- `yrbs_current_alcohol_use_hs_pct` AK: missing 2021; absent 1991, 1993, 1997, 1999, 2001, 2005
- `yrbs_current_alcohol_use_hs_pct` AZ: missing 2023; absent 1991, 1993, 1995, 1997, 1999, 2001
- `yrbs_current_alcohol_use_hs_pct` AR: absent 1991, 1993, 2003
- `yrbs_current_alcohol_use_hs_pct` CA: missing 2021, 2023; absent 1991, 1993, 1995, 1997, 1999, 2001, 2003, 2005, 2007, 2009, 2011, 2013
- `yrbs_current_alcohol_use_hs_pct` CO: missing 2023; absent 1991, 1993, 1995, 1997, 1999, 2001, 2003, 2007, 2013, 2015
- `yrbs_current_alcohol_use_hs_pct` CT: absent 1991, 1993, 1995, 1999, 2001, 2003
- `yrbs_current_alcohol_use_hs_pct` DE: missing 2019; absent 1991, 1993, 1995, 1997
- `yrbs_current_alcohol_use_hs_pct` DC: absent 1991, 1993, 1995, 1997, 1999, 2001, 2003, 2005, 2007, 2009, 2011, 2013, 2015, 2017
- `yrbs_current_alcohol_use_hs_pct` FL: missing 2023; absent 1991, 1993, 1995, 1997, 1999
- `yrbs_current_alcohol_use_hs_pct` GA: missing 2023; absent 1995, 1997, 1999, 2001, 2015, 2017
- `yrbs_current_alcohol_use_hs_pct` HI: absent 1991, 2001, 2003
- `yrbs_current_alcohol_use_hs_pct` ID: missing 2023; absent 1995, 1997, 1999
- `yrbs_current_alcohol_use_hs_pct` IL: absent 1991, 1997, 1999, 2001, 2003, 2005
- `yrbs_current_alcohol_use_hs_pct` IN: missing 2019; absent 1991, 1993, 1995, 1997, 1999, 2001, 2013, 2017
- `yrbs_current_alcohol_use_hs_pct` IA: missing 2023; absent 1991, 1993, 1995, 1999, 2001, 2003, 2009, 2013, 2015
- `yrbs_current_alcohol_use_hs_pct` KS: missing 2023; absent 1991, 1993, 1995, 1997, 1999, 2001, 2003, 2015
- `yrbs_current_alcohol_use_hs_pct` KY: absent 1991, 1993, 1995, 1999, 2001
- `yrbs_current_alcohol_use_hs_pct` LA: missing 2023; absent 1991, 1993, 1995, 1999, 2001, 2003, 2005, 2015
- `yrbs_current_alcohol_use_hs_pct` ME: absent 1991, 1993, 1999
- `yrbs_current_alcohol_use_hs_pct` MD: absent 1991, 1993, 1995, 1997, 1999, 2001, 2003
- `yrbs_current_alcohol_use_hs_pct` MA: absent 1991
- `yrbs_current_alcohol_use_hs_pct` MI: absent 1991, 1993, 1995
- `yrbs_current_alcohol_use_hs_pct` MN: missing 2019, 2021, 2023; absent 1991, 1993, 1995, 1997, 1999, 2001, 2003, 2005, 2007, 2009, 2011, 2013, 2015, 2017
- `yrbs_current_alcohol_use_hs_pct` MS: absent 1991, 2005, 2017
- … 26 more in metadata/completeness.csv

### First drink before age 13, high school students (YRBS)

Note: Question wording as published in YRBSS for the year; states without weighted results for a year are absent, not zero.

| Measure | Period | Span | States in series | Complete states | Partial states | Not in series | Value-years / possible | Missing (reasons) | Absent |
|---|---|---|---|---|---|---|---|---|---|
| `yrbs_first_drink_before_13_hs_pct` | survey year | 1991-2017 (14 yrs) | 47 | 0 | 47 | 4 | 422 / 658 | 0 | 236 |

Gaps inside the span (state level):

- `yrbs_first_drink_before_13_hs_pct` AL: absent 2007, 2017
- `yrbs_first_drink_before_13_hs_pct` AK: absent 1991, 1993, 1997, 1999, 2001, 2005
- `yrbs_first_drink_before_13_hs_pct` AZ: absent 1991, 1993, 1995, 1997, 1999, 2001
- `yrbs_first_drink_before_13_hs_pct` AR: absent 1991, 1993, 2003
- `yrbs_first_drink_before_13_hs_pct` CA: absent 1991, 1993, 1995, 1997, 1999, 2001, 2003, 2005, 2007, 2009, 2011, 2013
- `yrbs_first_drink_before_13_hs_pct` CO: absent 1991, 1993, 1995, 1997, 1999, 2001, 2003, 2007, 2013, 2015
- `yrbs_first_drink_before_13_hs_pct` CT: absent 1991, 1993, 1995, 1999, 2001, 2003
- `yrbs_first_drink_before_13_hs_pct` DE: absent 1991, 1993, 1995, 1997
- `yrbs_first_drink_before_13_hs_pct` FL: absent 1991, 1993, 1995, 1997, 1999
- `yrbs_first_drink_before_13_hs_pct` GA: absent 1995, 1997, 1999, 2001, 2015, 2017
- `yrbs_first_drink_before_13_hs_pct` HI: absent 1991, 2001, 2003
- `yrbs_first_drink_before_13_hs_pct` ID: absent 1995, 1997, 1999
- `yrbs_first_drink_before_13_hs_pct` IL: absent 1991, 1997, 1999, 2001, 2003, 2005
- `yrbs_first_drink_before_13_hs_pct` IN: absent 1991, 1993, 1995, 1997, 1999, 2001, 2013, 2017
- `yrbs_first_drink_before_13_hs_pct` IA: absent 1991, 1993, 1995, 1999, 2001, 2003, 2009, 2013, 2015
- `yrbs_first_drink_before_13_hs_pct` KS: absent 1991, 1993, 1995, 1997, 1999, 2001, 2003, 2015
- `yrbs_first_drink_before_13_hs_pct` KY: absent 1991, 1993, 1995, 1999, 2001
- `yrbs_first_drink_before_13_hs_pct` LA: absent 1991, 1993, 1995, 1999, 2001, 2003, 2005, 2015
- `yrbs_first_drink_before_13_hs_pct` ME: absent 1991, 1993, 1995, 1999
- `yrbs_first_drink_before_13_hs_pct` MD: absent 1991, 1993, 1995, 1997, 1999, 2001, 2003
- `yrbs_first_drink_before_13_hs_pct` MA: absent 1991, 2013, 2017
- `yrbs_first_drink_before_13_hs_pct` MI: absent 1991, 1993, 1995
- `yrbs_first_drink_before_13_hs_pct` MS: absent 1991, 2005, 2017
- `yrbs_first_drink_before_13_hs_pct` MO: absent 1991, 1993, 2011
- `yrbs_first_drink_before_13_hs_pct` MT: absent 1991
- … 22 more in metadata/completeness.csv

