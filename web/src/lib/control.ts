// Liquor-control arrangements, compared across states. Four separate dimensions (spirits and wine; wholesale
// and retail) are read from verified day runs only. A dated current-law snapshot is reported beside the
// verdict, labelled as such, and never decides it: a snapshot says nothing about any other day.
import type { Segment, Snapshot } from "./types";

export interface ControlDim {
  dim: string;
  label: string;
  short: string;
}

export const CONTROL_DIMS: ControlDim[] = [
  { dim: "spirits_wholesale_system", label: "Who wholesales spirits", short: "Spirits wholesale" },
  { dim: "spirits_off_premise_retail_system", label: "Who sells spirits to take home", short: "Spirits retail" },
  { dim: "wine_wholesale_system", label: "Who wholesales wine", short: "Wine wholesale" },
  { dim: "wine_off_premise_retail_system", label: "Who sells wine to take home", short: "Wine retail" },
];

/** Retail values in which the government sells: its own stores, its contract agencies, or both. */
export const GOVERNMENT_RETAIL = ["state_operated_stores", "state_stores_and_contract_agencies", "state_contract_agencies_only"];
/** Retail values in which the government runs stores staffed by its own employees. */
export const GOVERNMENT_STORES = ["state_operated_stores", "state_stores_and_contract_agencies"];

export type CriterionId = "same_as_target" | "spirits_wholesale_state" | "spirits_retail_government" | "spirits_retail_state_stores" | "wine_retail_government_only";

export interface Criterion {
  id: CriterionId;
  label: string;
  help: string;
  /** Dimension -> allowed values; null means "the same value as the target state". */
  rules: { dim: string; allowed: string[] | null }[];
}

export const CRITERIA: Criterion[] = [
  {
    id: "same_as_target",
    label: "Same arrangement as the chosen state on all four",
    help: "Spirits and wine, wholesale and retail, each verified for the whole period and equal to the chosen state's.",
    rules: CONTROL_DIMS.map((d) => ({ dim: d.dim, allowed: null })),
  },
  {
    id: "spirits_wholesale_state",
    label: "The state wholesales spirits",
    help: "The state government is the wholesaler of spirits.",
    rules: [{ dim: "spirits_wholesale_system", allowed: ["state_operated"] }],
  },
  {
    id: "spirits_retail_government",
    label: "The state sells spirits at retail (own stores or contract agencies)",
    help: "Spirits to take home are sold by state-run stores, by state-contract agencies, or both.",
    rules: [{ dim: "spirits_off_premise_retail_system", allowed: GOVERNMENT_RETAIL }],
  },
  {
    id: "spirits_retail_state_stores",
    label: "The state runs its own spirits stores",
    help: "Spirits to take home are sold in stores the state runs with its own employees (contract agencies may also exist).",
    rules: [{ dim: "spirits_off_premise_retail_system", allowed: GOVERNMENT_STORES }],
  },
  {
    id: "wine_retail_government_only",
    label: "Only the state sells wine at retail",
    help: "Wine to take home is sold only by state stores or state-contract agencies, with no private wine retailers.",
    rules: [{ dim: "wine_off_premise_retail_system", allowed: GOVERNMENT_RETAIL }],
  },
];

export function criterionById(id: string | null): Criterion | null {
  return CRITERIA.find((c) => c.id === id) ?? null;
}

const DAY = 86_400_000;
const ms = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
const KNOWN = (state: string) => state !== "unknown" && state !== "disputed" && state !== "";

export interface DimStatus {
  dim: string;
  /** The value verified on every day of the period, or null. */
  value: string | null;
  /** Days of the period with a verified value, and days in the period. */
  knownDays: number;
  days: number;
  /** Values verified on some day of the period (more than one means it changed). */
  values: string[];
  policyIds: string[];
  /** Latest dated current-law snapshots for this dimension (same day), if any. */
  snapshots: Snapshot[];
}

/** Verified value of one dimension for every day of [from, to] (ISO dates, inclusive). Days after the build's
 * as-of date cannot be verified, so a period reaching past it is never fully verified. */
export function dimStatus(segments: Segment[], snapshots: Snapshot[], geo: string, dim: string, from: string, to: string, asOf: string): DimStatus {
  const a = ms(from);
  const b = ms(to);
  const days = Math.round((b - a) / DAY) + 1;
  const lane = segments.filter((s) => s.geo_id === geo && s.policy_dimension === dim);
  const cap = Math.min(b, ms(asOf));
  let knownDays = 0;
  const values: string[] = [];
  const policyIds: string[] = [];
  for (const s of lane) {
    if (!KNOWN(s.state)) continue;
    const lo = Math.max(a, ms(s.segment_start));
    const hi = Math.min(cap, ms(s.segment_end));
    if (hi < lo) continue;
    knownDays += Math.round((hi - lo) / DAY) + 1;
    if (!values.includes(s.state)) values.push(s.state);
    for (const id of s.policy_ids.split("|").filter((x) => x && x !== "-")) if (!policyIds.includes(id)) policyIds.push(id);
  }
  const mine = snapshots.filter((s) => s.geo_id === geo && s.policy_dimension === dim && s.observed_on);
  const latestDay = mine.map((s) => s.observed_on!).sort().pop();
  return {
    dim,
    value: knownDays === days && values.length === 1 ? values[0] : null,
    knownDays,
    days,
    values,
    policyIds,
    snapshots: latestDay ? mine.filter((s) => s.observed_on === latestDay) : [],
  };
}

/** The value the latest snapshots agree on, or null when they disagree or none exist. */
export function snapshotValue(st: DimStatus): string | null {
  const vals = [...new Set(st.snapshots.map((s) => s.policy_value))];
  return vals.length === 1 ? vals[0] : null;
}

export type Verdict = "yes" | "no" | "unknown";

export interface Assessment {
  verdict: Verdict;
  /** Plain-language reasons, one per rule that decided or blocked the verdict. */
  reasons: string[];
  dims: DimStatus[];
  /** The same test applied to current-law snapshots only; null when no snapshot covers every rule. */
  currentLaw: { verdict: Exclude<Verdict, "unknown">; date: string } | null;
}

const words = (v: string) => v.replaceAll("_", " ");

function combine(parts: Verdict[]): Verdict {
  if (parts.some((p) => p === "no")) return "no";
  return parts.every((p) => p === "yes") ? "yes" : "unknown";
}

/** Assess one state against a criterion over [from, to]. `target` holds the reference state's statuses for
 * the same period (needed only for "same as the chosen state"). */
export function assess(c: Criterion, own: DimStatus[], target: DimStatus[] | null, labelOf: (dim: string) => string): Assessment {
  const byDim = new Map(own.map((d) => [d.dim, d]));
  const tByDim = new Map((target ?? []).map((d) => [d.dim, d]));
  const parts: Verdict[] = [];
  const snapParts: (Verdict | null)[] = [];
  const reasons: string[] = [];
  const dates: string[] = [];
  for (const r of c.rules) {
    const d = byDim.get(r.dim)!;
    const label = labelOf(r.dim);
    const allowed = r.allowed ?? (tByDim.get(r.dim)?.value ? [tByDim.get(r.dim)!.value!] : null);
    if (allowed === null) {
      parts.push("unknown");
      reasons.push(`${label}: the chosen state's arrangement is not verified for the whole period`);
    } else if (d.value !== null) {
      const ok = allowed.includes(d.value);
      parts.push(ok ? "yes" : "no");
      reasons.push(`${label}: ${words(d.value)} (verified every day)`);
    } else {
      parts.push("unknown");
      reasons.push(
        d.knownDays === 0
          ? `${label}: no verified history for this period`
          : d.values.length > 1
            ? `${label}: changed during the period (${d.values.map(words).join(" → ")})`
            : `${label}: verified on ${d.knownDays} of ${d.days} days only`,
      );
    }
    // Current law: the target's reference is its own snapshot or, failing that, its value verified on the as-of day.
    const sv = snapshotValue(d);
    const tRef = r.allowed ?? (() => {
      const t = tByDim.get(r.dim);
      const v = t ? (snapshotValue(t) ?? t.value) : null;
      return v ? [v] : null;
    })();
    if (sv === null || tRef === null) snapParts.push(null);
    else {
      snapParts.push(tRef.includes(sv) ? "yes" : "no");
      dates.push(d.snapshots[0].observed_on!);
    }
  }
  const currentLaw =
    snapParts.length && snapParts.every((p) => p !== null)
      ? { verdict: (combine(snapParts as Verdict[]) === "yes" ? "yes" : "no") as "yes" | "no", date: dates.sort()[0] }
      : null;
  return { verdict: combine(parts), reasons, dims: own, currentLaw };
}

/** Words for a verdict, with the current-law hint where the verdict is unknown. */
export function verdictText(a: Assessment): string {
  if (a.verdict === "yes") return "verified to match";
  if (a.verdict === "no") return "verified to differ";
  if (a.currentLaw) return `cannot be assessed (current law ${a.currentLaw.verdict === "yes" ? "matches" : "differs"}, dated ${a.currentLaw.date}; history not verified)`;
  return "cannot be assessed (no verified history)";
}

export function verdictSymbol(v: Verdict): string {
  return v === "yes" ? "✓" : v === "no" ? "✗" : "?";
}

/** Counts for a summary line. */
export function tally(as: Assessment[]): { yes: number; no: number; unknown: number; unknownCurrentYes: number } {
  return {
    yes: as.filter((a) => a.verdict === "yes").length,
    no: as.filter((a) => a.verdict === "no").length,
    unknown: as.filter((a) => a.verdict === "unknown").length,
    unknownCurrentYes: as.filter((a) => a.verdict === "unknown" && a.currentLaw?.verdict === "yes").length,
  };
}
