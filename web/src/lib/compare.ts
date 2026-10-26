// Port of src/alcohol_data/compare.py, so the dashboard refuses the same comparisons the Python code
// refuses, with the same reasons. compare.vectors.json is generated from the Python module
// (scripts/make_compare_vectors.py) and compare.test.ts checks this port against it.

export interface Series {
  geo_id: string;
  geo_level: string;
  measure_id: string;
  unit: string;
  age_universe: string;
  beverage: string;
  period_kind: string;
  method_family: string;
  causal_outcome_eligible?: boolean;
}

export interface Verdict {
  ok: boolean;
  reasons: string[];
  label: string | null;
}

export function compatible(
  a: Series,
  b: Series,
  opts: { allowGeoLevelMismatch?: boolean; mismatchLabel?: string | null } = {},
): Verdict {
  const reasons: string[] = [];
  if (a.geo_level !== b.geo_level) {
    if (!opts.allowGeoLevelMismatch) {
      reasons.push(
        `different geography levels (${a.geo_level} ${a.geo_id} vs ${b.geo_level} ${b.geo_id}); ` +
          "a city, county, metro area and state are different populations",
      );
    } else if (!opts.mismatchLabel) {
      reasons.push("geography-level mismatch allowed only with an explicit label");
    }
  }
  if (a.measure_id !== b.measure_id) reasons.push(`different measures (${a.measure_id} vs ${b.measure_id})`);
  if (a.unit !== b.unit) reasons.push(`different units (${a.unit} vs ${b.unit})`);
  if (a.age_universe !== b.age_universe) reasons.push(`different age universes (${a.age_universe} vs ${b.age_universe})`);
  if (a.beverage !== b.beverage) reasons.push(`different beverages (${a.beverage} vs ${b.beverage})`);
  if (a.period_kind !== b.period_kind) {
    reasons.push(
      `different period kinds (${a.period_kind} vs ${b.period_kind}); fiscal and calendar years are not the same period`,
    );
  }
  const ok = reasons.length === 0;
  return { ok, reasons, label: ok && a.geo_level !== b.geo_level ? (opts.mismatchLabel ?? null) : null };
}

export interface TrendPoint {
  year: number;
  value: number | null;
  comparability_group: string;
}

/** Split a series wherever the comparability group changes or a year is missing. Never interpolates. */
export function trendSegments<T extends TrendPoint>(points: T[]): T[][] {
  const segments: T[][] = [];
  let current: T[] = [];
  for (const p of [...points].sort((x, y) => x.year - y.year)) {
    if (p.value === null) {
      if (current.length) segments.push(current);
      current = [];
      continue;
    }
    const last = current[current.length - 1];
    if (last && (p.comparability_group !== last.comparability_group || p.year !== last.year + 1)) {
      segments.push(current);
      current = [];
    }
    current.push(p);
  }
  if (current.length) segments.push(current);
  return segments;
}

/** Can these series share one chart panel (same axis)? Different measures may share a panel only when
 * unit, period kind, age universe and beverage scope agree; otherwise they get separate panels. */
export function panelKey(s: Pick<Series, "unit" | "period_kind" | "age_universe">): string {
  return `${s.unit}|${s.period_kind}|${s.age_universe}`;
}

export function ratioAllowed(numerator: Series, denominator: Series): Verdict {
  const reasons: string[] = [];
  if (numerator.method_family === "apparent_consumption" && denominator.unit === "percent") {
    reasons.push(
      "dividing per capita consumption by a drinking prevalence does not give consumption per drinker " +
        "(different sources, age universes and concepts)",
    );
  }
  if (
    numerator.age_universe !== denominator.age_universe &&
    numerator.age_universe !== "not_applicable" &&
    denominator.age_universe !== "not_applicable"
  ) {
    reasons.push(`age universes differ (${numerator.age_universe} vs ${denominator.age_universe})`);
  }
  if (numerator.geo_id !== denominator.geo_id) reasons.push("numerator and denominator are different geographies");
  return { ok: reasons.length === 0, reasons, label: null };
}
