-- Convenience views created at the end of every build. They select from the
-- canonical tables; nothing here changes a value.

-- One preferred value per state x measure x period, with labels and units.
-- Long format on purpose: fiscal years, calendar years, survey years and July 1
-- estimates are different periods and are never forced into one column.
CREATE OR REPLACE VIEW state_year_long AS
SELECT
  p.geo_id, g.abbreviation AS state, g.name AS state_name,
  p.measure_id, m.label AS measure_label, m.unit, m.beverage, m.age_universe, m.method_family,
  p.period_kind, p.period_label, p.period_start, p.period_end, p.year,
  p.value, p.missing_reason, p.estimate_type, p.extraction_method,
  p.comparability_group, p.quality_flags, p.review_status,
  p.source_series, p.source_vintage, p.asset_id, p.observation_id, p.candidate_count
FROM preferred_observations p
JOIN geographies g USING (geo_id)
JOIN measures m USING (measure_id)
WHERE g.geo_level = 'state' AND p.period_kind <> 'month';

-- Finance components, side by side, with what each one is and what it overlaps.
-- Deliberately no total: components overlap (e.g. net profit is after the
-- separately listed transfers), so adding rows double counts.
CREATE OR REPLACE VIEW fiscal_components AS
SELECT
  p.geo_id, p.period_label, p.period_start, p.period_end, p.year,
  m.fiscal_component, p.measure_id, m.label AS measure_label, m.government_level, m.accounting_basis,
  m.costs_subtracted, m.overlap_note, p.value, p.missing_reason, m.unit,
  p.source_series, p.source_vintage, p.review_status, p.observation_id
FROM preferred_observations p
JOIN measures m USING (measure_id)
WHERE m.fiscal_component IS NOT NULL AND p.geo_id LIKE 'state:%';
