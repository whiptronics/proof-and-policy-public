# Coverage report

Generated from build `public-d7d0d23a49d9` (code db3e5246d6b7e53b4cbe8e5610d5b5eff9bc97a2, release label 0.3.0).
Regenerate with `alcohol-data report coverage`. The declared denominator for each series is
geographies with any value x years from its first to last year with a value; cells outside that
range are outside the source's scope, not missing.

## Table row counts

| Table | Rows |
|---|---:|
| sources | 33 |
| source_assets | 421 |
| geographies | 56 |
| geography_relationships | 55 |
| measures | 158 |
| observations | 218,196 |
| observation_details | 218,196 |
| quarantine | 0 |
| preferred_selection | 218,196 |
| policy_events | 23 |
| policy_evidence | 118 |
| policy_exposure | 1,628 |
| policy_segments | 42 |
| claim_dependencies | 15 |
| claim_exceptions | 9 |
| policy_snapshots | 179 |
| policy_dimensions | 28 |
| policy_dimension_values | 29 |
| measure_concepts | 158 |
| lineage | 218,196 |
| coverage | 260 |

## Preferred values by measure family and geography level

| Family | Geography level | Measures | Geographies with values | First year | Last year | Values | Missing (with reason) |
|---|---|---:|---:|---:|---:|---:|---:|
| behavior | nation | 3 | 1 | 1991 | 2017 | 29 | 0 |
| behavior | state | 10 | 51 | 1991 | 2025 | 5,135 | 0 |
| consumption | census_region | 22 | 4 | 1970 | 2024 | 4,644 | 196 |
| consumption | nation | 23 | 1 | 1970 | 2025 | 1,190 | 49 |
| consumption | state | 24 | 51 | 1970 | 2025 | 60,696 | 2,499 |
| context | nation | 15 | 1 | 1929 | 2026 | 1,093 | 4 |
| context | state | 11 | 51 | 1929 | 2026 | 25,220 | 178 |
| finance | nation | 3 | 1 | 1902 | 2025 | 258 | 9 |
| finance | state | 88 | 51 | 1941 | 2026 | 25,266 | 546 |
| population | census_region | 2 | 4 | 1970 | 2024 | 440 | 0 |
| population | nation | 4 | 1 | 1970 | 2024 | 154 | 0 |
| population | state | 4 | 51 | 1970 | 2025 | 11,424 | 0 |
| safety | nation | 6 | 1 | 2000 | 2023 | 74 | 26 |
| safety | state | 6 | 51 | 2000 | 2023 | 5,100 | 0 |

## Policy exposure status counts

| Jurisdiction | Dimension | Period kind | Status | Periods | First | Last |
|---|---|---|---|---:|---:|---:|
| state:05 | ordinary_grocery_wine_authorization | calendar_year | period_not_complete | 1 | 2026 | 2026 |
| state:05 | ordinary_grocery_wine_authorization | calendar_year | unknown | 36 | 1990 | 2025 |
| state:05 | ordinary_grocery_wine_authorization | state_fiscal_year | unknown | 37 | 1990 | 2026 |
| state:21 | ordinary_grocery_spirits_authorization | calendar_year | exposed_full | 27 | 1999 | 2025 |
| state:21 | ordinary_grocery_spirits_authorization | calendar_year | period_not_complete | 1 | 2026 | 2026 |
| state:21 | ordinary_grocery_spirits_authorization | calendar_year | unknown | 9 | 1990 | 1998 |
| state:21 | ordinary_grocery_spirits_authorization | state_fiscal_year | exposed_full | 27 | 2000 | 2026 |
| state:21 | ordinary_grocery_spirits_authorization | state_fiscal_year | unknown | 10 | 1990 | 1999 |
| state:21 | ordinary_grocery_wine_authorization | calendar_year | exposed_full | 27 | 1999 | 2025 |
| state:21 | ordinary_grocery_wine_authorization | calendar_year | period_not_complete | 1 | 2026 | 2026 |
| state:21 | ordinary_grocery_wine_authorization | calendar_year | unknown | 9 | 1990 | 1998 |
| state:21 | ordinary_grocery_wine_authorization | state_fiscal_year | exposed_full | 27 | 2000 | 2026 |
| state:21 | ordinary_grocery_wine_authorization | state_fiscal_year | unknown | 10 | 1990 | 1999 |
| state:47 | liquor_store_beer_sales | calendar_year | period_not_complete | 1 | 2026 | 2026 |
| state:47 | liquor_store_beer_sales | calendar_year | unknown | 36 | 1990 | 2025 |
| state:47 | liquor_store_beer_sales | state_fiscal_year | unknown | 37 | 1990 | 2026 |
| state:47 | ordinary_grocery_wine_authorization | calendar_year | exposed_full | 1 | 2015 | 2015 |
| state:47 | ordinary_grocery_wine_authorization | calendar_year | local_option_unknown | 1 | 2016 | 2016 |
| state:47 | ordinary_grocery_wine_authorization | calendar_year | not_exposed | 1 | 2015 | 2015 |
| state:47 | ordinary_grocery_wine_authorization | calendar_year | period_not_complete | 2 | 2026 | 2026 |
| state:47 | ordinary_grocery_wine_authorization | calendar_year | unknown | 69 | 1990 | 2025 |
| state:47 | ordinary_grocery_wine_authorization | state_fiscal_year | exposed_full | 2 | 2015 | 2016 |
| state:47 | ordinary_grocery_wine_authorization | state_fiscal_year | local_option_unknown | 1 | 2017 | 2017 |
| state:47 | ordinary_grocery_wine_authorization | state_fiscal_year | not_exposed | 2 | 2015 | 2016 |
| state:47 | ordinary_grocery_wine_authorization | state_fiscal_year | unknown | 69 | 1990 | 2026 |
| state:47 | wine_minimum_retail_price_rule | calendar_year | period_not_complete | 1 | 2026 | 2026 |
| state:47 | wine_minimum_retail_price_rule | calendar_year | unknown | 36 | 1990 | 2025 |
| state:47 | wine_minimum_retail_price_rule | state_fiscal_year | unknown | 37 | 1990 | 2026 |
| state:49 | beer_definition_max_alcohol | calendar_year | exposed_full | 21 | 2004 | 2025 |
| state:49 | beer_definition_max_alcohol | calendar_year | exposed_partial | 2 | 2019 | 2019 |
| state:49 | beer_definition_max_alcohol | calendar_year | not_exposed | 21 | 2004 | 2025 |
| state:49 | beer_definition_max_alcohol | calendar_year | period_not_complete | 2 | 2026 | 2026 |
| state:49 | beer_definition_max_alcohol | calendar_year | unknown | 28 | 1990 | 2003 |
| state:49 | beer_definition_max_alcohol | state_fiscal_year | exposed_full | 22 | 2004 | 2026 |
| state:49 | beer_definition_max_alcohol | state_fiscal_year | exposed_partial | 2 | 2020 | 2020 |
| state:49 | beer_definition_max_alcohol | state_fiscal_year | not_exposed | 22 | 2004 | 2026 |
| state:49 | beer_definition_max_alcohol | state_fiscal_year | unknown | 28 | 1990 | 2003 |
| state:49 | beer_excise_tax_per_31gal_barrel | calendar_year | exposed_full | 19 | 2004 | 2023 |
| state:49 | beer_excise_tax_per_31gal_barrel | calendar_year | exposed_partial | 6 | 2019 | 2025 |
| state:49 | beer_excise_tax_per_31gal_barrel | calendar_year | not_exposed | 107 | 2004 | 2025 |
| state:49 | beer_excise_tax_per_31gal_barrel | calendar_year | period_not_complete | 6 | 2026 | 2026 |
| state:49 | beer_excise_tax_per_31gal_barrel | calendar_year | unknown | 84 | 1990 | 2003 |
| state:49 | beer_excise_tax_per_31gal_barrel | state_fiscal_year | exposed_full | 22 | 2004 | 2026 |
| state:49 | beer_excise_tax_per_31gal_barrel | state_fiscal_year | exposed_partial | 2 | 2020 | 2020 |
| state:49 | beer_excise_tax_per_31gal_barrel | state_fiscal_year | not_exposed | 114 | 2004 | 2026 |
| state:49 | beer_excise_tax_per_31gal_barrel | state_fiscal_year | unknown | 84 | 1990 | 2003 |
| state:49 | ordinary_grocery_wine_authorization | calendar_year | exposed_full | 22 | 2004 | 2025 |
| state:49 | ordinary_grocery_wine_authorization | calendar_year | period_not_complete | 1 | 2026 | 2026 |
| state:49 | ordinary_grocery_wine_authorization | calendar_year | unknown | 14 | 1990 | 2003 |
| state:49 | ordinary_grocery_wine_authorization | state_fiscal_year | exposed_full | 23 | 2004 | 2026 |
| state:49 | ordinary_grocery_wine_authorization | state_fiscal_year | unknown | 14 | 1990 | 2003 |
| state:49 | spirits_off_premise_retail_system | calendar_year | exposed_full | 14 | 2012 | 2025 |
| state:49 | spirits_off_premise_retail_system | calendar_year | period_not_complete | 1 | 2026 | 2026 |
| state:49 | spirits_off_premise_retail_system | calendar_year | unknown | 22 | 1990 | 2011 |
| state:49 | spirits_off_premise_retail_system | state_fiscal_year | exposed_full | 15 | 2012 | 2026 |
| state:49 | spirits_off_premise_retail_system | state_fiscal_year | unknown | 22 | 1990 | 2011 |
| state:49 | spirits_wholesale_system | calendar_year | exposed_full | 22 | 2004 | 2025 |
| state:49 | spirits_wholesale_system | calendar_year | period_not_complete | 1 | 2026 | 2026 |
| state:49 | spirits_wholesale_system | calendar_year | unknown | 14 | 1990 | 2003 |
| state:49 | spirits_wholesale_system | state_fiscal_year | exposed_full | 23 | 2004 | 2026 |
| state:49 | spirits_wholesale_system | state_fiscal_year | unknown | 14 | 1990 | 2003 |
| state:49 | state_contract_package_agency_channel | calendar_year | exposed_full | 22 | 2004 | 2025 |
| state:49 | state_contract_package_agency_channel | calendar_year | period_not_complete | 1 | 2026 | 2026 |
| state:49 | state_contract_package_agency_channel | calendar_year | unknown | 14 | 1990 | 2003 |
| state:49 | state_contract_package_agency_channel | state_fiscal_year | exposed_full | 23 | 2004 | 2026 |
| state:49 | state_contract_package_agency_channel | state_fiscal_year | unknown | 14 | 1990 | 2003 |
| state:49 | wine_off_premise_retail_system | calendar_year | exposed_full | 14 | 2012 | 2025 |
| state:49 | wine_off_premise_retail_system | calendar_year | period_not_complete | 1 | 2026 | 2026 |
| state:49 | wine_off_premise_retail_system | calendar_year | unknown | 22 | 1990 | 2011 |
| state:49 | wine_off_premise_retail_system | state_fiscal_year | exposed_full | 15 | 2012 | 2026 |
| state:49 | wine_off_premise_retail_system | state_fiscal_year | unknown | 22 | 1990 | 2011 |
| state:49 | wine_wholesale_system | calendar_year | exposed_full | 22 | 2004 | 2025 |
| state:49 | wine_wholesale_system | calendar_year | period_not_complete | 1 | 2026 | 2026 |
| state:49 | wine_wholesale_system | calendar_year | unknown | 14 | 1990 | 2003 |
| state:49 | wine_wholesale_system | state_fiscal_year | exposed_full | 23 | 2004 | 2026 |
| state:49 | wine_wholesale_system | state_fiscal_year | unknown | 14 | 1990 | 2003 |
| state:51 | ordinary_grocery_wine_authorization | calendar_year | exposed_full | 28 | 1998 | 2025 |
| state:51 | ordinary_grocery_wine_authorization | calendar_year | period_not_complete | 1 | 2026 | 2026 |
| state:51 | ordinary_grocery_wine_authorization | calendar_year | unknown | 8 | 1990 | 1997 |
| state:51 | ordinary_grocery_wine_authorization | state_fiscal_year | exposed_full | 29 | 1998 | 2026 |
| state:51 | ordinary_grocery_wine_authorization | state_fiscal_year | unknown | 8 | 1990 | 1997 |

## Coverage by series, measure and geography level

| Series | Measure | Level | Geos | First | Last | Expected | Observed | Missing w/ reason | Absent | Missing reasons | Gap years |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| bea_sainc | bea_per_capita_personal_income | nation | 1 | 1929 | 2025 | 97 | 97 | 0 | 0 |  |  |
| bea_sainc | bea_per_capita_personal_income | state | 51 | 1929 | 2025 | 4,947 | 4,905 | 42 | 0 | not_published:42 |  |
| bea_sainc | bea_personal_income | nation | 1 | 1929 | 2025 | 97 | 97 | 0 | 0 |  |  |
| bea_sainc | bea_personal_income | state | 51 | 1929 | 2025 | 4,947 | 4,905 | 42 | 0 | not_published:42 |  |
| bea_sapce | bea_pce_off_premises_alcohol | nation | 1 | 1997 | 2025 | 29 | 29 | 0 | 0 |  |  |
| bea_sapce | bea_pce_off_premises_alcohol | state | 51 | 1997 | 2025 | 1,479 | 1,479 | 0 | 0 |  |  |
| bls_cpi_u | bls_cpi_u_us_all_items_nsa | nation | 1 | 1987 | 2026 | 40 | 40 | 0 | 0 | unavailable:1 |  |
| cdc_brfss_prevalence_1995_2010 | brfss_binge_5m_4f_pct | state | 51 | 2006 | 2010 | 255 | 255 | 0 | 0 |  |  |
| cdc_brfss_prevalence_1995_2010 | brfss_binge_5plus_any_sex_pct | state | 51 | 1995 | 2005 | 561 | 406 | 0 | 155 |  | 1996,1998,2000 |
| cdc_brfss_prevalence_1995_2010 | brfss_chronic_60plus_per_month_pct | state | 50 | 1995 | 1999 | 250 | 149 | 0 | 101 |  | 1996,1998 |
| cdc_brfss_prevalence_1995_2010 | brfss_drank_any_past_30d_pct | state | 51 | 2001 | 2010 | 510 | 509 | 0 | 1 |  |  |
| cdc_brfss_prevalence_1995_2010 | brfss_drank_any_past_month_question_pct | state | 51 | 1995 | 1999 | 255 | 152 | 0 | 103 |  | 1996,1998 |
| cdc_brfss_prevalence_1995_2010 | brfss_heavy_2m_1f_per_day_pct | state | 51 | 2001 | 2010 | 510 | 509 | 0 | 1 |  |  |
| cdc_brfss_prevalence_2011_present | brfss_binge_5m_4f_pct | state | 51 | 2011 | 2025 | 765 | 757 | 0 | 8 |  |  |
| cdc_brfss_prevalence_2011_present | brfss_drank_any_past_30d_pct | state | 51 | 2011 | 2025 | 765 | 757 | 0 | 8 |  |  |
| cdc_brfss_prevalence_2011_present | brfss_heavy_14m_7f_per_week_pct | state | 51 | 2015 | 2025 | 561 | 553 | 0 | 8 |  |  |
| cdc_brfss_prevalence_2011_present | brfss_heavy_2m_1f_per_day_pct | state | 51 | 2011 | 2014 | 204 | 204 | 0 | 0 |  |  |
| cdc_yrbs_high_school | yrbs_binge_drinking_hs_pct | nation | 1 | 2017 | 2017 | 1 | 1 | 0 | 0 |  |  |
| cdc_yrbs_high_school | yrbs_binge_drinking_hs_pct | state | 36 | 2017 | 2017 | 36 | 36 | 0 | 0 |  |  |
| cdc_yrbs_high_school | yrbs_current_alcohol_use_hs_pct | nation | 1 | 1991 | 2017 | 27 | 14 | 0 | 13 |  | 1992,1994,1996,1998,2000,2002,2004,2006,2008,2010,2012,2014,2016 |
| cdc_yrbs_high_school | yrbs_current_alcohol_use_hs_pct | state | 47 | 1991 | 2017 | 1,269 | 426 | 0 | 843 |  | 1992,1994,1996,1998,2000,2002,2004,2006,2008,2010,2012,2014,2016 |
| cdc_yrbs_high_school | yrbs_first_drink_before_13_hs_pct | nation | 1 | 1991 | 2017 | 27 | 14 | 0 | 13 |  | 1992,1994,1996,1998,2000,2002,2004,2006,2008,2010,2012,2014,2016 |
| cdc_yrbs_high_school | yrbs_first_drink_before_13_hs_pct | state | 47 | 1991 | 2017 | 1,269 | 422 | 0 | 847 |  | 1992,1994,1996,1998,2000,2002,2004,2006,2008,2010,2012,2014,2016 |
| census_arts_gmper | us_retail_gross_margin_pct_alcohol_stores | nation | 1 | 1993 | 2022 | 30 | 30 | 0 | 0 |  |  |
| census_arts_gmper | us_retail_gross_margin_pct_food_beverage_stores | nation | 1 | 1993 | 2022 | 30 | 30 | 0 | 0 |  |  |
| census_arts_gmper | us_retail_gross_margin_pct_grocery_stores | nation | 1 | 1993 | 2022 | 30 | 30 | 0 | 0 |  |  |
| census_arts_gmper | us_retail_gross_margin_pct_total | nation | 1 | 1993 | 2022 | 30 | 30 | 0 | 0 |  |  |
| census_arts_gmper | us_retail_gross_margin_pct_warehouse_clubs_supercenters | nation | 1 | 1993 | 2022 | 30 | 30 | 0 | 0 |  |  |
| census_awts_table4 | us_wholesale_gross_margin_pct_alcohol_beverages | nation | 1 | 1993 | 2022 | 30 | 30 | 0 | 0 | unavailable:1 |  |
| census_awts_table4 | us_wholesale_gross_margin_pct_grocery | nation | 1 | 1993 | 2022 | 30 | 30 | 0 | 0 | unavailable:1 |  |
| census_awts_table4 | us_wholesale_gross_margin_pct_total | nation | 1 | 1993 | 2022 | 30 | 30 | 0 | 0 | unavailable:1 |  |
| census_cbp_state | cbp_employment_naics_445310 | state | 51 | 2000 | 2023 | 1,224 | 1,165 | 59 | 0 | suppressed:59 |  |
| census_cbp_state | cbp_employment_naics_722410 | state | 51 | 2000 | 2023 | 1,224 | 1,222 | 2 | 0 | suppressed:2 |  |
| census_cbp_state | cbp_establishments_naics_445110 | state | 51 | 2000 | 2023 | 1,224 | 1,224 | 0 | 0 |  |  |
| census_cbp_state | cbp_establishments_naics_445310 | state | 51 | 2000 | 2023 | 1,224 | 1,224 | 0 | 0 |  |  |
| census_cbp_state | cbp_establishments_naics_722410 | state | 51 | 2000 | 2023 | 1,224 | 1,224 | 0 | 0 |  |  |
| census_ec2017_basic | ec_establishments_naics_445310 | nation | 1 | 2017 | 2017 | 1 | 1 | 0 | 0 |  |  |
| census_ec2017_basic | ec_establishments_naics_445310 | state | 48 | 2017 | 2017 | 48 | 48 | 3 | 0 | suppressed:3 |  |
| census_ec2017_basic | ec_sales_naics_445310 | nation | 1 | 2017 | 2017 | 1 | 1 | 0 | 0 |  |  |
| census_ec2017_basic | ec_sales_naics_445310 | state | 48 | 2017 | 2017 | 48 | 48 | 3 | 0 | suppressed:3 |  |
| census_ec2017_comp | ec_establishments_naics_445310 | nation | 1 | 2012 | 2017 | 6 | 2 | 0 | 4 |  | 2013,2014,2015,2016 |
| census_ec2017_comp | ec_establishments_naics_445310 | state | 49 | 2012 | 2017 | 294 | 96 | 6 | 192 | suppressed:6 | 2013,2014,2015,2016 |
| census_ec2017_comp | ec_sales_naics_445310 | nation | 1 | 2012 | 2017 | 6 | 2 | 0 | 4 |  | 2013,2014,2015,2016 |
| census_ec2017_comp | ec_sales_naics_445310 | state | 49 | 2012 | 2017 | 294 | 96 | 6 | 192 | suppressed:6 | 2013,2014,2015,2016 |
| census_govfin_indfin | census_liquor_stores_capital_outlay | state | 50 | 1972 | 2012 | 2,050 | 1,850 | 0 | 200 |  | 1973,1974,1975,1976 |
| census_govfin_indfin | census_liquor_stores_current_operations | state | 50 | 1972 | 2012 | 2,050 | 1,850 | 0 | 200 |  | 1973,1974,1975,1976 |
| census_govfin_indfin | census_liquor_stores_expenditure | state | 50 | 1972 | 2012 | 2,050 | 1,850 | 0 | 200 |  | 1973,1974,1975,1976 |
| census_govfin_indfin | census_liquor_stores_revenue | state | 50 | 1972 | 2012 | 2,050 | 1,850 | 0 | 200 |  | 1973,1974,1975,1976 |
| census_govfin_state_type | census_liquor_stores_capital_outlay | state | 50 | 2008 | 2015 | 400 | 91 | 0 | 309 |  |  |
| census_govfin_state_type | census_liquor_stores_current_operations | state | 50 | 2008 | 2015 | 400 | 160 | 0 | 240 |  |  |
| census_govfin_state_type | census_liquor_stores_expenditure | state | 50 | 2008 | 2015 | 400 | 160 | 0 | 240 |  |  |
| census_govfin_state_type | census_liquor_stores_revenue | state | 50 | 2008 | 2015 | 400 | 166 | 0 | 234 |  |  |
| census_govfin_unit | census_liquor_stores_capital_outlay | state | 4 | 2015 | 2024 | 40 | 26 | 0 | 14 |  |  |
| census_govfin_unit | census_liquor_stores_current_operations | state | 17 | 2015 | 2024 | 170 | 160 | 0 | 10 |  |  |
| census_govfin_unit | census_liquor_stores_expenditure | state | 17 | 2015 | 2024 | 170 | 160 | 0 | 10 |  |  |
| census_govfin_unit | census_liquor_stores_revenue | state | 16 | 2015 | 2024 | 160 | 160 | 0 | 0 |  |  |
| census_msrs_yy | msrs_food_beverage_stores_yoy_pct | nation | 1 | 2019 | 2026 | 8 | 8 | 0 | 0 |  |  |
| census_msrs_yy | msrs_food_beverage_stores_yoy_pct | state | 51 | 2019 | 2026 | 408 | 407 | 1 | 0 | suppressed:21 |  |
| census_msrs_yy | msrs_total_retail_yoy_pct | nation | 1 | 2019 | 2026 | 8 | 8 | 0 | 0 |  |  |
| census_msrs_yy | msrs_total_retail_yoy_pct | state | 51 | 2019 | 2026 | 408 | 408 | 0 | 0 |  |  |
| census_pep_intercensal_1990_2000 | pop_total_resident | state | 51 | 1990 | 1999 | 510 | 510 | 0 | 0 |  |  |
| census_pep_intercensal_2000_2010 | pop_age14plus_resident | nation | 1 | 2000 | 2010 | 11 | 11 | 0 | 0 |  |  |
| census_pep_intercensal_2000_2010 | pop_age14plus_resident | state | 51 | 2000 | 2010 | 561 | 561 | 0 | 0 |  |  |
| census_pep_intercensal_2000_2010 | pop_age18plus_resident | nation | 1 | 2000 | 2010 | 11 | 11 | 0 | 0 |  |  |
| census_pep_intercensal_2000_2010 | pop_age18plus_resident | state | 51 | 2000 | 2010 | 561 | 561 | 0 | 0 |  |  |
| census_pep_intercensal_2000_2010 | pop_age21plus_resident | nation | 1 | 2000 | 2010 | 11 | 11 | 0 | 0 |  |  |
| census_pep_intercensal_2000_2010 | pop_age21plus_resident | state | 51 | 2000 | 2010 | 561 | 561 | 0 | 0 |  |  |
| census_pep_intercensal_2000_2010 | pop_total_resident | nation | 1 | 2000 | 2010 | 11 | 11 | 0 | 0 |  |  |
| census_pep_intercensal_2000_2010 | pop_total_resident | state | 51 | 2000 | 2010 | 561 | 561 | 0 | 0 |  |  |
| census_pep_intercensal_2010_2020 | pop_age14plus_resident | state | 51 | 2010 | 2019 | 510 | 510 | 0 | 0 |  |  |
| census_pep_intercensal_2010_2020 | pop_age18plus_resident | state | 51 | 2010 | 2019 | 510 | 510 | 0 | 0 |  |  |
| census_pep_intercensal_2010_2020 | pop_age21plus_resident | state | 51 | 2010 | 2019 | 510 | 510 | 0 | 0 |  |  |
| census_pep_intercensal_2010_2020 | pop_total_resident | state | 51 | 2010 | 2019 | 510 | 510 | 0 | 0 |  |  |
| census_pep_vintage_2025 | pop_age14plus_resident | state | 51 | 2020 | 2025 | 306 | 306 | 0 | 0 |  |  |
| census_pep_vintage_2025 | pop_age18plus_resident | state | 51 | 2020 | 2025 | 306 | 306 | 0 | 0 |  |  |
| census_pep_vintage_2025 | pop_age21plus_resident | state | 51 | 2020 | 2025 | 306 | 306 | 0 | 0 |  |  |
| census_pep_vintage_2025 | pop_total_resident | state | 51 | 2020 | 2025 | 306 | 306 | 0 | 0 |  |  |
| census_stc | stc_alcoholic_beverages_license_tax | nation | 1 | 1942 | 2025 | 84 | 80 | 0 | 4 | unavailable:9 | 1943,1945,1947,1949 |
| census_stc | stc_alcoholic_beverages_license_tax | state | 51 | 1941 | 2025 | 4,335 | 3,943 | 40 | 352 | not_applicable:49 |  |
| census_stc | stc_alcoholic_beverages_sales_tax | nation | 1 | 1902 | 2025 | 124 | 89 | 0 | 35 |  | 1903,1904,1905,1906,1907,1908,1909,1910,1911,1912,1914,1915,1916,1917,1918,1919,1920,1921,1923,1924,1925,1926,1928,1929,1930,1931,1933,1935,1937,1939,1941,1943,1945,1947,1949 |
| census_stc | stc_alcoholic_beverages_sales_tax | state | 51 | 1941 | 2025 | 4,335 | 3,983 | 0 | 352 |  |  |
| census_stc | stc_total_taxes | nation | 1 | 1902 | 2025 | 124 | 89 | 0 | 35 |  | 1903,1904,1905,1906,1907,1908,1909,1910,1911,1912,1914,1915,1916,1917,1918,1919,1920,1921,1923,1924,1925,1926,1928,1929,1930,1931,1933,1935,1937,1939,1941,1943,1945,1947,1949 |
| census_stc | stc_total_taxes | state | 50 | 1941 | 2025 | 4,250 | 3,980 | 0 | 270 |  |  |
| nhtsa_fars | fars_alcohol_impaired_driving_fatalities | nation | 1 | 2000 | 2023 | 24 | 24 | 0 | 0 |  |  |
| nhtsa_fars | fars_alcohol_impaired_driving_fatalities | state | 51 | 2000 | 2023 | 1,224 | 1,224 | 0 | 0 |  |  |
| nhtsa_fars | fars_traffic_fatalities | nation | 1 | 2000 | 2023 | 24 | 24 | 0 | 0 |  |  |
| nhtsa_fars | fars_traffic_fatalities | state | 51 | 2000 | 2023 | 1,224 | 1,224 | 0 | 0 |  |  |
| nhtsa_state_ai_report | nhtsa_published_alcohol_impaired_driving_fatalities | nation | 1 | 2013 | 2022 | 10 | 2 | 0 | 8 |  | 2014,2015,2016,2017,2018,2019,2020,2021 |
| nhtsa_state_ai_report | nhtsa_published_alcohol_impaired_driving_fatalities | state | 51 | 2013 | 2022 | 510 | 102 | 0 | 408 |  | 2014,2015,2016,2017,2018,2019,2020,2021 |
| nhtsa_state_ai_report | nhtsa_published_traffic_fatalities | nation | 1 | 2013 | 2022 | 10 | 2 | 0 | 8 |  | 2014,2015,2016,2017,2018,2019,2020,2021 |
| nhtsa_state_ai_report | nhtsa_published_traffic_fatalities | state | 51 | 2013 | 2022 | 510 | 102 | 0 | 408 |  | 2014,2015,2016,2017,2018,2019,2020,2021 |
| niaaa_apparent_consumption | niaaa_beverage_gallons_beer | census_region | 4 | 1970 | 2024 | 220 | 220 | 0 | 0 |  |  |
| niaaa_apparent_consumption | niaaa_beverage_gallons_beer | nation | 1 | 1970 | 2024 | 55 | 55 | 0 | 0 |  |  |
| niaaa_apparent_consumption | niaaa_beverage_gallons_beer | state | 51 | 1970 | 2024 | 2,805 | 2,805 | 0 | 0 |  |  |
| niaaa_apparent_consumption | niaaa_beverage_gallons_spirits | census_region | 4 | 1970 | 2024 | 220 | 220 | 0 | 0 |  |  |
| niaaa_apparent_consumption | niaaa_beverage_gallons_spirits | nation | 1 | 1970 | 2024 | 55 | 55 | 0 | 0 |  |  |
| niaaa_apparent_consumption | niaaa_beverage_gallons_spirits | state | 51 | 1970 | 2024 | 2,805 | 2,805 | 0 | 0 |  |  |
| niaaa_apparent_consumption | niaaa_beverage_gallons_wine | census_region | 4 | 1970 | 2024 | 220 | 220 | 0 | 0 |  |  |
| niaaa_apparent_consumption | niaaa_beverage_gallons_wine | nation | 1 | 1970 | 2024 | 55 | 55 | 0 | 0 |  |  |
| niaaa_apparent_consumption | niaaa_beverage_gallons_wine | state | 51 | 1970 | 2024 | 2,805 | 2,805 | 0 | 0 |  |  |
| niaaa_apparent_consumption | niaaa_ethanol_gallons_all | census_region | 4 | 1970 | 2024 | 220 | 220 | 0 | 0 |  |  |
| niaaa_apparent_consumption | niaaa_ethanol_gallons_all | nation | 1 | 1970 | 2024 | 55 | 55 | 0 | 0 |  |  |
| niaaa_apparent_consumption | niaaa_ethanol_gallons_all | state | 51 | 1970 | 2024 | 2,805 | 2,805 | 0 | 0 |  |  |
| niaaa_apparent_consumption | niaaa_ethanol_gallons_beer | census_region | 4 | 1970 | 2024 | 220 | 220 | 0 | 0 |  |  |
| niaaa_apparent_consumption | niaaa_ethanol_gallons_beer | nation | 1 | 1970 | 2024 | 55 | 55 | 0 | 0 |  |  |
| niaaa_apparent_consumption | niaaa_ethanol_gallons_beer | state | 51 | 1970 | 2024 | 2,805 | 2,805 | 0 | 0 |  |  |
| niaaa_apparent_consumption | niaaa_ethanol_gallons_spirits | census_region | 4 | 1970 | 2024 | 220 | 220 | 0 | 0 |  |  |
| niaaa_apparent_consumption | niaaa_ethanol_gallons_spirits | nation | 1 | 1970 | 2024 | 55 | 55 | 0 | 0 |  |  |
| niaaa_apparent_consumption | niaaa_ethanol_gallons_spirits | state | 51 | 1970 | 2024 | 2,805 | 2,805 | 0 | 0 |  |  |
| niaaa_apparent_consumption | niaaa_ethanol_gallons_time_varying_abv_all | census_region | 4 | 1977 | 2024 | 192 | 192 | 0 | 0 | not_published:56 |  |
| niaaa_apparent_consumption | niaaa_ethanol_gallons_time_varying_abv_all | nation | 1 | 1977 | 2024 | 48 | 48 | 0 | 0 | not_published:14 |  |
| niaaa_apparent_consumption | niaaa_ethanol_gallons_time_varying_abv_all | state | 51 | 1977 | 2024 | 2,448 | 2,448 | 0 | 0 | not_published:714 |  |
| niaaa_apparent_consumption | niaaa_ethanol_gallons_time_varying_abv_beer | census_region | 4 | 1977 | 2024 | 192 | 192 | 0 | 0 | not_published:56 |  |
| niaaa_apparent_consumption | niaaa_ethanol_gallons_time_varying_abv_beer | nation | 1 | 1977 | 2024 | 48 | 48 | 0 | 0 | not_published:14 |  |
| niaaa_apparent_consumption | niaaa_ethanol_gallons_time_varying_abv_beer | state | 51 | 1977 | 2024 | 2,448 | 2,448 | 0 | 0 | not_published:714 |  |
| niaaa_apparent_consumption | niaaa_ethanol_gallons_time_varying_abv_spirits | census_region | 4 | 1977 | 2024 | 192 | 192 | 0 | 0 | not_published:56 |  |
| niaaa_apparent_consumption | niaaa_ethanol_gallons_time_varying_abv_spirits | nation | 1 | 1977 | 2024 | 48 | 48 | 0 | 0 | not_published:14 |  |
| niaaa_apparent_consumption | niaaa_ethanol_gallons_time_varying_abv_spirits | state | 51 | 1977 | 2024 | 2,448 | 2,448 | 0 | 0 | not_published:714 |  |
| niaaa_apparent_consumption | niaaa_ethanol_gallons_time_varying_abv_wine | census_region | 4 | 1977 | 2024 | 192 | 192 | 0 | 0 | not_published:56 |  |
| niaaa_apparent_consumption | niaaa_ethanol_gallons_time_varying_abv_wine | nation | 1 | 1977 | 2024 | 48 | 48 | 0 | 0 | not_published:14 |  |
| niaaa_apparent_consumption | niaaa_ethanol_gallons_time_varying_abv_wine | state | 51 | 1977 | 2024 | 2,448 | 2,448 | 0 | 0 | not_published:714 |  |
| niaaa_apparent_consumption | niaaa_ethanol_gallons_wine | census_region | 4 | 1970 | 2024 | 220 | 220 | 0 | 0 |  |  |
| niaaa_apparent_consumption | niaaa_ethanol_gallons_wine | nation | 1 | 1970 | 2024 | 55 | 55 | 0 | 0 |  |  |
| niaaa_apparent_consumption | niaaa_ethanol_gallons_wine | state | 51 | 1970 | 2024 | 2,805 | 2,805 | 0 | 0 |  |  |
| niaaa_apparent_consumption | niaaa_ethanol_per_capita_14plus_all | census_region | 4 | 1970 | 2024 | 220 | 220 | 0 | 0 |  |  |
| niaaa_apparent_consumption | niaaa_ethanol_per_capita_14plus_all | nation | 1 | 1970 | 2024 | 55 | 55 | 0 | 0 |  |  |
| niaaa_apparent_consumption | niaaa_ethanol_per_capita_14plus_all | state | 51 | 1970 | 2024 | 2,805 | 2,805 | 0 | 0 |  |  |
| niaaa_apparent_consumption | niaaa_ethanol_per_capita_14plus_beer | census_region | 4 | 1970 | 2024 | 220 | 220 | 0 | 0 |  |  |
| niaaa_apparent_consumption | niaaa_ethanol_per_capita_14plus_beer | nation | 1 | 1970 | 2024 | 55 | 55 | 0 | 0 |  |  |
| niaaa_apparent_consumption | niaaa_ethanol_per_capita_14plus_beer | state | 51 | 1970 | 2024 | 2,805 | 2,805 | 0 | 0 |  |  |
| niaaa_apparent_consumption | niaaa_ethanol_per_capita_14plus_spirits | census_region | 4 | 1970 | 2024 | 220 | 220 | 0 | 0 |  |  |
| niaaa_apparent_consumption | niaaa_ethanol_per_capita_14plus_spirits | nation | 1 | 1970 | 2024 | 55 | 55 | 0 | 0 |  |  |
| niaaa_apparent_consumption | niaaa_ethanol_per_capita_14plus_spirits | state | 51 | 1970 | 2024 | 2,805 | 2,805 | 0 | 0 |  |  |
| niaaa_apparent_consumption | niaaa_ethanol_per_capita_14plus_wine | census_region | 4 | 1970 | 2024 | 220 | 220 | 0 | 0 |  |  |
| niaaa_apparent_consumption | niaaa_ethanol_per_capita_14plus_wine | nation | 1 | 1970 | 2024 | 55 | 55 | 0 | 0 |  |  |
| niaaa_apparent_consumption | niaaa_ethanol_per_capita_14plus_wine | state | 51 | 1970 | 2024 | 2,805 | 2,805 | 0 | 0 |  |  |
| niaaa_apparent_consumption | niaaa_ethanol_per_capita_21plus_all | census_region | 4 | 1970 | 2024 | 220 | 220 | 0 | 0 |  |  |
| niaaa_apparent_consumption | niaaa_ethanol_per_capita_21plus_all | nation | 1 | 1970 | 2024 | 55 | 55 | 0 | 0 |  |  |
| niaaa_apparent_consumption | niaaa_ethanol_per_capita_21plus_all | state | 51 | 1970 | 2024 | 2,805 | 2,805 | 0 | 0 |  |  |
| niaaa_apparent_consumption | niaaa_ethanol_per_capita_21plus_beer | census_region | 4 | 1970 | 2024 | 220 | 220 | 0 | 0 |  |  |
| niaaa_apparent_consumption | niaaa_ethanol_per_capita_21plus_beer | nation | 1 | 1970 | 2024 | 55 | 55 | 0 | 0 |  |  |
| niaaa_apparent_consumption | niaaa_ethanol_per_capita_21plus_beer | state | 51 | 1970 | 2024 | 2,805 | 2,805 | 0 | 0 |  |  |
| niaaa_apparent_consumption | niaaa_ethanol_per_capita_21plus_spirits | census_region | 4 | 1970 | 2024 | 220 | 220 | 0 | 0 |  |  |
| niaaa_apparent_consumption | niaaa_ethanol_per_capita_21plus_spirits | nation | 1 | 1970 | 2024 | 55 | 55 | 0 | 0 |  |  |
| niaaa_apparent_consumption | niaaa_ethanol_per_capita_21plus_spirits | state | 51 | 1970 | 2024 | 2,805 | 2,805 | 0 | 0 |  |  |
| niaaa_apparent_consumption | niaaa_ethanol_per_capita_21plus_wine | census_region | 4 | 1970 | 2024 | 220 | 220 | 0 | 0 |  |  |
| niaaa_apparent_consumption | niaaa_ethanol_per_capita_21plus_wine | nation | 1 | 1970 | 2024 | 55 | 55 | 0 | 0 |  |  |
| niaaa_apparent_consumption | niaaa_ethanol_per_capita_21plus_wine | state | 51 | 1970 | 2024 | 2,805 | 2,805 | 0 | 0 |  |  |
| niaaa_apparent_consumption | niaaa_time_varying_abv_beer | census_region | 4 | 1977 | 2024 | 192 | 192 | 0 | 0 | not_published:56 |  |
| niaaa_apparent_consumption | niaaa_time_varying_abv_beer | nation | 1 | 1977 | 2024 | 48 | 48 | 0 | 0 | not_published:14 |  |
| niaaa_apparent_consumption | niaaa_time_varying_abv_beer | state | 51 | 1977 | 2024 | 2,448 | 2,448 | 0 | 0 | not_published:714 |  |
| niaaa_apparent_consumption | niaaa_time_varying_abv_spirits | census_region | 4 | 1977 | 2024 | 192 | 192 | 0 | 0 | not_published:56 |  |
| niaaa_apparent_consumption | niaaa_time_varying_abv_spirits | nation | 1 | 1977 | 2024 | 48 | 48 | 0 | 0 | not_published:14 |  |
| niaaa_apparent_consumption | niaaa_time_varying_abv_spirits | state | 51 | 1977 | 2024 | 2,448 | 2,448 | 0 | 0 | not_published:714 |  |
| niaaa_apparent_consumption | niaaa_time_varying_abv_wine | census_region | 4 | 1977 | 2024 | 192 | 192 | 0 | 0 | not_published:56 |  |
| niaaa_apparent_consumption | niaaa_time_varying_abv_wine | nation | 1 | 1977 | 2024 | 48 | 48 | 0 | 0 | not_published:14 |  |
| niaaa_apparent_consumption | niaaa_time_varying_abv_wine | state | 51 | 1977 | 2024 | 2,448 | 2,448 | 0 | 0 | not_published:714 |  |
| niaaa_apparent_consumption | pop_age14plus_resident | census_region | 4 | 1970 | 2024 | 220 | 220 | 0 | 0 |  |  |
| niaaa_apparent_consumption | pop_age14plus_resident | nation | 1 | 1970 | 2024 | 55 | 55 | 0 | 0 |  |  |
| niaaa_apparent_consumption | pop_age14plus_resident | state | 51 | 1970 | 2024 | 2,805 | 2,805 | 0 | 0 |  |  |
| niaaa_apparent_consumption | pop_age21plus_resident | census_region | 4 | 1970 | 2024 | 220 | 220 | 0 | 0 |  |  |
| niaaa_apparent_consumption | pop_age21plus_resident | nation | 1 | 1970 | 2024 | 55 | 55 | 0 | 0 |  |  |
| niaaa_apparent_consumption | pop_age21plus_resident | state | 51 | 1970 | 2024 | 2,805 | 2,805 | 0 | 0 |  |  |
| pa_ag_plcb_audit:ssf_revenues_expenses | pa_plcb_ssf_cost_of_goods_sold | state | 1 | 2023 | 2025 | 3 | 3 | 0 | 0 |  |  |
| pa_ag_plcb_audit:ssf_revenues_expenses | pa_plcb_ssf_gross_profit | state | 1 | 2023 | 2025 | 3 | 3 | 0 | 0 |  |  |
| pa_ag_plcb_audit:ssf_revenues_expenses | pa_plcb_ssf_operating_expenses | state | 1 | 2023 | 2025 | 3 | 3 | 0 | 0 |  |  |
| pa_ag_plcb_audit:ssf_revenues_expenses | pa_plcb_ssf_sales_net_of_taxes | state | 1 | 2023 | 2025 | 3 | 3 | 0 | 0 |  |  |
| pa_ag_plcb_audit:ssf_revenues_expenses | pa_plcb_ssf_total_operating_income | state | 1 | 2023 | 2025 | 3 | 3 | 0 | 0 |  |  |
| pa_ag_plcb_audit:ssf_revenues_expenses | pa_plcb_ssf_transfer_drug_alcohol_programs | state | 1 | 2023 | 2025 | 3 | 3 | 0 | 0 |  |  |
| pa_ag_plcb_audit:ssf_revenues_expenses | pa_plcb_ssf_transfer_general_fund | state | 1 | 2023 | 2025 | 3 | 3 | 0 | 0 |  |  |
| pa_ag_plcb_audit:ssf_revenues_expenses | pa_plcb_ssf_transfer_psp_enforcement | state | 1 | 2023 | 2025 | 3 | 3 | 0 | 0 |  |  |
| project_derived | fars_alcohol_impaired_driving_deaths_per_100k | nation | 1 | 2000 | 2010 | 11 | 11 | 0 | 0 | unavailable:13 |  |
| project_derived | fars_alcohol_impaired_driving_deaths_per_100k | state | 51 | 2000 | 2023 | 1,224 | 1,224 | 0 | 0 |  |  |
| project_derived | fars_traffic_deaths_per_100k | nation | 1 | 2000 | 2010 | 11 | 11 | 0 | 0 | unavailable:13 |  |
| project_derived | fars_traffic_deaths_per_100k | state | 51 | 2000 | 2023 | 1,224 | 1,224 | 0 | 0 |  |  |
| project_derived | stc_alcoholic_beverages_sales_tax_per_capita | state | 51 | 1990 | 2025 | 1,836 | 1,756 | 0 | 80 |  |  |
| project_derived | stc_alcoholic_beverages_sales_tax_per_resident_21plus | state | 51 | 2000 | 2025 | 1,326 | 1,256 | 47 | 23 | unavailable:500 |  |
| project_derived | stc_alcoholic_beverages_sales_tax_real_cy2024usd | state | 51 | 1990 | 2025 | 1,836 | 1,756 | 0 | 80 |  |  |
| project_derived | ut_dabs_fy_cases_9l_beer | state | 1 | 2026 | 2026 | 1 | 1 | 0 | 0 |  |  |
| project_derived | ut_dabs_fy_cases_9l_cider | state | 1 | 2026 | 2026 | 1 | 1 | 0 | 0 |  |  |
| project_derived | ut_dabs_fy_cases_9l_other | state | 1 | 2026 | 2026 | 1 | 1 | 0 | 0 |  |  |
| project_derived | ut_dabs_fy_cases_9l_premixed | state | 1 | 2026 | 2026 | 1 | 1 | 0 | 0 |  |  |
| project_derived | ut_dabs_fy_cases_9l_spirits | state | 1 | 2026 | 2026 | 1 | 1 | 0 | 0 |  |  |
| project_derived | ut_dabs_fy_cases_9l_total | state | 1 | 2026 | 2026 | 1 | 1 | 0 | 0 |  |  |
| project_derived | ut_dabs_fy_cases_9l_wine | state | 1 | 2026 | 2026 | 1 | 1 | 0 | 0 |  |  |
| project_derived | ut_dabs_fy_gross_sales_beer | state | 1 | 2026 | 2026 | 1 | 1 | 0 | 0 |  |  |
| project_derived | ut_dabs_fy_gross_sales_cider | state | 1 | 2026 | 2026 | 1 | 1 | 0 | 0 |  |  |
| project_derived | ut_dabs_fy_gross_sales_other | state | 1 | 2026 | 2026 | 1 | 1 | 0 | 0 |  |  |
| project_derived | ut_dabs_fy_gross_sales_premixed | state | 1 | 2026 | 2026 | 1 | 1 | 0 | 0 |  |  |
| project_derived | ut_dabs_fy_gross_sales_spirits | state | 1 | 2026 | 2026 | 1 | 1 | 0 | 0 |  |  |
| project_derived | ut_dabs_fy_gross_sales_total | state | 1 | 2026 | 2026 | 1 | 1 | 0 | 0 |  |  |
| project_derived | ut_dabs_fy_gross_sales_wine | state | 1 | 2026 | 2026 | 1 | 1 | 0 | 0 |  |  |
| tn_dor_summary_of_collections_june | tn_dor_account_11002_with_high_alcohol_beer | state | 1 | 2018 | 2025 | 8 | 8 | 0 | 0 |  |  |
| tn_dor_summary_of_collections_june | tn_dor_alcoholic_beverages_class_total | state | 1 | 2010 | 2025 | 16 | 16 | 0 | 0 |  |  |
| tn_dor_summary_of_collections_june | tn_dor_wine_enforcement_tax_collections | state | 1 | 2010 | 2025 | 16 | 16 | 0 | 0 |  |  |
| tn_dor_summary_of_collections_june | tn_dor_wine_tax_collections | state | 1 | 2010 | 2017 | 8 | 8 | 0 | 0 |  |  |
| tn_dor_summary_of_collections_june | tn_dor_winery_wine_tax_collections | state | 1 | 2010 | 2025 | 16 | 16 | 0 | 0 |  |  |
| utah_acfr:governmental_funds_revenues | ut_liquor_sales_allocated_school_lunch | state | 1 | 2024 | 2025 | 2 | 2 | 0 | 0 |  |  |
| utah_acfr:management_discussion | ut_abs_liquor_profit_transfer | state | 1 | 2024 | 2025 | 2 | 2 | 0 | 0 |  |  |
| utah_acfr:management_discussion_changes_in_net_position | ut_abs_govwide_liquor_expenses | state | 1 | 2021 | 2023 | 3 | 3 | 0 | 0 |  |  |
| utah_acfr:proprietary_funds_cash_flows | ut_abs_fund_receipts_from_customers | state | 1 | 2022 | 2025 | 4 | 4 | 0 | 0 |  |  |
| utah_acfr:proprietary_funds_cash_flows | ut_abs_school_lunch_collections_paid | state | 1 | 2022 | 2025 | 4 | 4 | 0 | 0 |  |  |
| utah_acfr:proprietary_funds_revenues_expenses | ut_abs_fund_income_before_transfers | state | 1 | 2022 | 2025 | 4 | 4 | 0 | 0 |  |  |
| utah_acfr:proprietary_funds_revenues_expenses | ut_abs_fund_operating_expenses | state | 1 | 2022 | 2025 | 4 | 4 | 0 | 0 |  |  |
| utah_acfr:proprietary_funds_revenues_expenses | ut_abs_fund_operating_income | state | 1 | 2022 | 2025 | 4 | 4 | 0 | 0 |  |  |
| utah_acfr:proprietary_funds_revenues_expenses | ut_abs_fund_sales_revenue | state | 1 | 2022 | 2025 | 4 | 4 | 0 | 0 |  |  |
| utah_acfr:statistical_changes_in_net_position | ut_abs_fund_operating_revenues | state | 1 | 2013 | 2025 | 13 | 13 | 0 | 0 |  |  |
| utah_acfr:statistical_changes_in_net_position | ut_abs_govwide_liquor_expenses | state | 1 | 2013 | 2025 | 13 | 13 | 0 | 0 |  |  |
| utah_dabs_annual_report:five_year_operations_summary | ut_dabs_cases_sold | state | 1 | 2020 | 2025 | 6 | 6 | 0 | 0 |  |  |
| utah_dabs_annual_report:five_year_operations_summary | ut_dabs_gross_profit | state | 1 | 2020 | 2025 | 6 | 6 | 0 | 0 |  |  |
| utah_dabs_annual_report:five_year_operations_summary | ut_dabs_liquor_sales_revenue | state | 1 | 2020 | 2025 | 6 | 6 | 0 | 0 |  |  |
| utah_dabs_annual_report:five_year_operations_summary | ut_dabs_net_profit_general_fund | state | 1 | 2020 | 2025 | 6 | 6 | 0 | 0 |  |  |
| utah_dabs_annual_report:five_year_operations_summary | ut_dabs_other_expenses_net | state | 1 | 2020 | 2025 | 6 | 6 | 0 | 0 |  |  |
| utah_dabs_annual_report:five_year_operations_summary | ut_dabs_other_income | state | 1 | 2020 | 2025 | 6 | 6 | 0 | 0 |  |  |
| utah_dabs_annual_report:five_year_operations_summary | ut_dabs_other_program_transfers | state | 1 | 2020 | 2025 | 6 | 6 | 0 | 0 |  |  |
| utah_dabs_annual_report:five_year_operations_summary | ut_dabs_salaries_wages | state | 1 | 2020 | 2025 | 6 | 6 | 0 | 0 |  |  |
| utah_dabs_annual_report:five_year_operations_summary | ut_dabs_total_revenue | state | 1 | 2020 | 2025 | 6 | 6 | 0 | 0 |  |  |
| utah_dabs_annual_report:five_year_summary_financial_information | ut_dabs_gross_profit | state | 1 | 2012 | 2025 | 14 | 14 | 0 | 0 |  |  |
| utah_dabs_annual_report:five_year_summary_financial_information | ut_dabs_liquor_sales_revenue | state | 1 | 2012 | 2025 | 14 | 14 | 0 | 0 |  |  |
| utah_dabs_annual_report:five_year_summary_financial_information | ut_dabs_net_profit_general_fund | state | 1 | 2012 | 2025 | 14 | 14 | 0 | 0 |  |  |
| utah_dabs_annual_report:five_year_summary_financial_information | ut_dabs_operating_nonoperating_expenses | state | 1 | 2012 | 2025 | 14 | 14 | 0 | 0 |  |  |
| utah_dabs_annual_report:five_year_summary_financial_information | ut_dabs_other_income | state | 1 | 2012 | 2025 | 14 | 14 | 0 | 0 |  |  |
| utah_dabs_annual_report:five_year_summary_financial_information | ut_dabs_other_programs_transfer | state | 1 | 2017 | 2025 | 9 | 9 | 0 | 0 |  |  |
| utah_dabs_annual_report:five_year_summary_financial_information | ut_dabs_parents_empowered | state | 1 | 2012 | 2025 | 14 | 14 | 0 | 0 |  |  |
| utah_dabs_annual_report:five_year_summary_financial_information | ut_dabs_sales_tax_reported | state | 1 | 2012 | 2025 | 14 | 14 | 0 | 0 |  |  |
| utah_dabs_annual_report:five_year_summary_financial_information | ut_dabs_sbi_transfer | state | 1 | 2012 | 2025 | 14 | 14 | 0 | 0 |  |  |
| utah_dabs_annual_report:five_year_summary_financial_information | ut_dabs_school_lunch_transfer | state | 1 | 2012 | 2025 | 14 | 14 | 0 | 0 |  |  |
| utah_dabs_annual_report:five_year_summary_financial_information | ut_dabs_total_revenue | state | 1 | 2012 | 2025 | 14 | 14 | 0 | 0 |  |  |
| utah_dabs_annual_report:five_year_summary_financial_information | ut_dabs_underage_drinking_prevention_transfer | state | 1 | 2017 | 2025 | 9 | 9 | 0 | 0 |  |  |
| utah_dabs_annual_report:income_statement | ut_dabs_cost_of_liquor_sold | state | 1 | 2015 | 2025 | 11 | 6 | 0 | 5 |  | 2017,2018,2019,2020,2021 |
| utah_dabs_annual_report:income_statement | ut_dabs_credit_card_fees | state | 1 | 2024 | 2025 | 2 | 2 | 0 | 0 |  |  |
| utah_dabs_annual_report:income_statement | ut_dabs_delivery_to_stores | state | 1 | 2024 | 2025 | 2 | 2 | 0 | 0 |  |  |
| utah_dabs_annual_report:income_statement | ut_dabs_gross_profit | state | 1 | 2022 | 2023 | 2 | 2 | 0 | 0 |  |  |
| utah_dabs_annual_report:income_statement | ut_dabs_liquor_bags | state | 1 | 2024 | 2025 | 2 | 2 | 0 | 0 |  |  |
| utah_dabs_annual_report:income_statement | ut_dabs_liquor_sales_revenue | state | 1 | 2015 | 2025 | 11 | 6 | 0 | 5 |  | 2017,2018,2019,2020,2021 |
| utah_dabs_annual_report:income_statement | ut_dabs_net_operating_income | state | 1 | 2022 | 2025 | 4 | 4 | 0 | 0 |  |  |
| utah_dabs_annual_report:income_statement | ut_dabs_net_profit_general_fund | state | 1 | 2022 | 2025 | 4 | 4 | 0 | 0 |  |  |
| utah_dabs_annual_report:income_statement | ut_dabs_other_income | state | 1 | 2022 | 2025 | 4 | 4 | 0 | 0 |  |  |
| utah_dabs_annual_report:income_statement | ut_dabs_package_agency_contracts | state | 1 | 2024 | 2025 | 2 | 2 | 0 | 0 |  |  |
| utah_dabs_annual_report:income_statement | ut_dabs_school_lunch_usf_public_safety_transfer | state | 1 | 2022 | 2025 | 4 | 4 | 0 | 0 |  |  |
| utah_dabs_annual_report:income_statement | ut_dabs_total_nonoperating_net | state | 1 | 2022 | 2025 | 4 | 4 | 0 | 0 |  |  |
| utah_dabs_annual_report:income_statement | ut_dabs_total_operating_expenses | state | 1 | 2022 | 2025 | 4 | 4 | 0 | 0 |  |  |
| utah_dabs_annual_report:income_statement | ut_dabs_total_revenue | state | 1 | 2022 | 2025 | 4 | 4 | 0 | 0 |  |  |
| utah_dabs_annual_report:on_off_premise_sales | ut_dabs_off_premise_sales_share | state | 1 | 2025 | 2025 | 1 | 1 | 0 | 0 |  |  |
| utah_dabs_annual_report:on_off_premise_sales | ut_dabs_on_premise_sales_share | state | 1 | 2025 | 2025 | 1 | 1 | 0 | 0 |  |  |
| utah_dabs_sales_analysis | ut_dabs_monthly_cases_9l_beer | state | 1 | 2025 | 2026 | 2 | 2 | 0 | 0 |  |  |
| utah_dabs_sales_analysis | ut_dabs_monthly_cases_9l_cider | state | 1 | 2025 | 2026 | 2 | 2 | 0 | 0 |  |  |
| utah_dabs_sales_analysis | ut_dabs_monthly_cases_9l_other | state | 1 | 2025 | 2026 | 2 | 2 | 0 | 0 |  |  |
| utah_dabs_sales_analysis | ut_dabs_monthly_cases_9l_premixed | state | 1 | 2025 | 2026 | 2 | 2 | 0 | 0 |  |  |
| utah_dabs_sales_analysis | ut_dabs_monthly_cases_9l_spirits | state | 1 | 2025 | 2026 | 2 | 2 | 0 | 0 |  |  |
| utah_dabs_sales_analysis | ut_dabs_monthly_cases_9l_total | state | 1 | 2025 | 2026 | 2 | 2 | 0 | 0 |  |  |
| utah_dabs_sales_analysis | ut_dabs_monthly_cases_9l_wine | state | 1 | 2025 | 2026 | 2 | 2 | 0 | 0 |  |  |
| utah_dabs_sales_analysis | ut_dabs_monthly_gross_sales_beer | state | 1 | 2025 | 2026 | 2 | 2 | 0 | 0 |  |  |
| utah_dabs_sales_analysis | ut_dabs_monthly_gross_sales_cider | state | 1 | 2025 | 2026 | 2 | 2 | 0 | 0 |  |  |
| utah_dabs_sales_analysis | ut_dabs_monthly_gross_sales_other | state | 1 | 2025 | 2026 | 2 | 2 | 0 | 0 |  |  |
| utah_dabs_sales_analysis | ut_dabs_monthly_gross_sales_premixed | state | 1 | 2025 | 2026 | 2 | 2 | 0 | 0 |  |  |
| utah_dabs_sales_analysis | ut_dabs_monthly_gross_sales_spirits | state | 1 | 2025 | 2026 | 2 | 2 | 0 | 0 |  |  |
| utah_dabs_sales_analysis | ut_dabs_monthly_gross_sales_total | state | 1 | 2025 | 2026 | 2 | 2 | 0 | 0 |  |  |
| utah_dabs_sales_analysis | ut_dabs_monthly_gross_sales_wine | state | 1 | 2025 | 2026 | 2 | 2 | 0 | 0 |  |  |
| utah_tc_pub25:chart2 | state_sales_tax_rate_state_portion | state | 1 | 2026 | 2026 | 1 | 1 | 0 | 0 |  |  |
