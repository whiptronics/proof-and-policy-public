// The only arithmetic the dashboard does itself: comparisons against a base the user chooses.
// Constant-dollar and per-person values are computed in Python (alcohol_data.dashboard.transforms)
// and arrive with their inputs; they are not recomputed here.
//
//   percent change = 100 x (later - earlier) / earlier     undefined when earlier is 0 or missing
//   index          = 100 x value / base value              undefined when the base is 0 or missing

export const FORMULA_VERSION = "dashboard-ui-formulas@1.0";

export function percentChange(earlier: number | null | undefined, later: number | null | undefined): number | undefined {
  if (earlier === null || earlier === undefined || later === null || later === undefined) return undefined;
  if (!Number.isFinite(earlier) || !Number.isFinite(later) || earlier === 0) return undefined;
  return (100 * (later - earlier)) / earlier;
}

export function indexToBase(value: number | null | undefined, base: number | null | undefined): number | undefined {
  if (value === null || value === undefined || base === null || base === undefined) return undefined;
  if (!Number.isFinite(value) || !Number.isFinite(base) || base === 0) return undefined;
  return (100 * value) / base;
}

/** Why a percent change or index is undefined, in words (undefined when it is defined). */
export function undefinedReason(base: number | null | undefined, other: number | null | undefined): string | undefined {
  if (base === null || base === undefined) return "the base value is missing";
  if (base === 0) return "the base value is zero, so a ratio to it is undefined";
  if (other === null || other === undefined) return "the compared value is missing";
  return undefined;
}

/** Mean of the annual values in [from, to]. Undefined unless every year in the window has a value, so a
 * gap never shrinks the window silently; the missing years are returned. */
export function windowMean(
  points: { year: number; value: number | null }[],
  from: number,
  to: number,
): { mean: number | undefined; years: number; missing: number[] } {
  const missing: number[] = [];
  let sum = 0;
  for (let y = from; y <= to; y++) {
    const p = points.find((x) => x.year === y);
    if (!p || p.value === null || !Number.isFinite(p.value)) missing.push(y);
    else sum += p.value;
  }
  const years = to - from + 1;
  return { mean: missing.length || years <= 0 ? undefined : sum / years, years, missing };
}
