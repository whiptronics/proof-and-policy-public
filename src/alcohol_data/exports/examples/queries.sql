-- Example queries for alcohol_data.duckdb.
-- Run with the DuckDB CLI:   duckdb alcohol_data.duckdb < queries.sql
-- or in Python:              import duckdb; duckdb.connect("alcohol_data.duckdb", read_only=True).sql("...")

-- 1. What does this release cover? (declared denominators, gaps listed explicitly)
SELECT source_series, measure_id, geo_level, first_year, last_year, observed_cells, expected_cells, interior_gap_years
FROM coverage WHERE measure_id IN ('pop_age21plus_resident', 'niaaa_ethanol_per_capita_21plus_wine',
                                   'brfss_binge_5m_4f_pct', 'stc_alcoholic_beverages_sales_tax')
ORDER BY measure_id, source_series;

-- 2. Binge drinking prevalence with confidence intervals, Utah vs Tennessee.
--    Note the comparability_group: 1995-2010 and 2011+ estimates must not be joined into one line.
SELECT o.geo_id, o.year, o.value AS pct, d.ci_low, d.ci_high, o.comparability_group
FROM preferred_observations o JOIN observation_details d USING (observation_id)
WHERE o.measure_id = 'brfss_binge_5m_4f_pct' AND o.geo_id IN ('state:49', 'state:47')
ORDER BY o.geo_id, o.year;

-- 3. Every candidate for one cell and why one was preferred (Utah population, July 1, 2010).
SELECT o.source_series, o.source_vintage, o.value, s.rank, s.reason
FROM observations o JOIN preferred_selection s USING (observation_id)
WHERE o.geo_id = 'state:49' AND o.measure_id = 'pop_total_resident' AND o.period_start = DATE '2010-07-01'
ORDER BY s.rank;

-- 4. Utah DABS finance components side by side (no totals: components overlap).
SELECT period_label, fiscal_component, measure_id, value, missing_reason, review_status
FROM fiscal_components WHERE geo_id = 'state:49' AND measure_id LIKE 'ut_dabs%'
ORDER BY period_start, fiscal_component, measure_id;

-- 5. Policy exposure: legal time exposed per fiscal year (unknown days are never treated as exposed).
SELECT geo_id, policy_dimension, policy_value, year, covered_days, unknown_days, exposure_fraction, exposure_status
FROM policy_exposure WHERE period_kind = 'state_fiscal_year' AND year BETWEEN 2014 AND 2026
ORDER BY geo_id, policy_dimension, policy_value, year;

-- 6. Trace a derived value back to its inputs.
SELECT l.output_id, l.transform_id, l.input_ids
FROM lineage l JOIN observations o ON o.observation_id = l.output_id
WHERE o.measure_id = 'stc_alcoholic_beverages_sales_tax_per_resident_21plus' AND o.geo_id = 'state:47' AND o.year = 2017;
