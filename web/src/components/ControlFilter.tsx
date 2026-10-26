// The liquor-control comparison used by the map, the revenue table, the finder and Utah at a glance: pick a
// criterion, see which states are verified to meet it for the period shown, which are verified not to, and
// which cannot be assessed. Current law is shown beside an unknown verdict and never decides it.
import { CONTROL_DIMS, CRITERIA, assess, dimStatus, tally, verdictSymbol, verdictText, type Assessment, type Criterion } from "../lib/control";
import type { PolicyData } from "../lib/types";
import { Go, RecordLink } from "./common";

const labelOf = (dim: string) => CONTROL_DIMS.find((d) => d.dim === dim)?.short ?? dim;

/** Assess every state for one period. `periodOf` gives each state's own period dates (fiscal years differ). */
export function assessAll(
  pol: PolicyData,
  c: Criterion,
  geos: string[],
  target: string,
  periodOf: (geo: string) => { from: string; to: string },
): Map<string, Assessment> {
  const statuses = (geo: string, p: { from: string; to: string }) =>
    CONTROL_DIMS.map((d) => dimStatus(pol.segments, pol.snapshots, geo, d.dim, p.from, p.to, pol.as_of_date));
  const out = new Map<string, Assessment>();
  for (const g of geos) {
    const p = periodOf(g);
    out.set(g, assess(c, statuses(g, p), statuses(target, p), labelOf));
  }
  return out;
}

export function ControlSelect({
  value,
  onChange,
  onlyVerified,
  onOnlyVerified,
  targetName,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  onlyVerified?: boolean;
  onOnlyVerified?: (v: boolean) => void;
  targetName: string;
}) {
  const c = CRITERIA.find((x) => x.id === value) ?? null;
  return (
    <>
      <label>
        Liquor-control arrangement
        <select value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
          <option value="">Don't compare</option>
          {CRITERIA.map((x) => (
            <option key={x.id} value={x.id}>
              {x.id === "same_as_target" ? `Same arrangement as ${targetName} (all four)` : x.label}
            </option>
          ))}
        </select>
        <span className="help">
          {c
            ? `${c.help} Only verified history counts; states without it are shown as "cannot be assessed".`
            : "Wholesale and retail, spirits and wine, from coded law: verified history counts, current law is shown as a hint."}
        </span>
      </label>
      {c && onOnlyVerified && (
        <label className="check">
          <input type="checkbox" checked={Boolean(onlyVerified)} onChange={(e) => onOnlyVerified(e.target.checked)} />
          List only states verified to match
          <span className="help">The others stay on the map, faded; their reasons are in the table.</span>
        </label>
      )}
    </>
  );
}

export function ControlSummary({ c, as, target, period, targetName }: { c: Criterion; as: Map<string, Assessment>; target: string; period: string; targetName: string }) {
  // The reference state is never counted as its own match.
  const others = [...as.entries()].filter(([g]) => c.id !== "same_as_target" || g !== target).map(([, a]) => a);
  const t = tally(others);
  return (
    <p className="small control-summary" role="status">
      <strong>{c.id === "same_as_target" ? `Same liquor-control arrangement as ${targetName}` : c.label}</strong>, {period}
      {c.id === "same_as_target" ? ` (${targetName} itself not counted)` : ""}: {t.yes} verified to match,{" "}
      {t.no} verified to differ, {t.unknown} cannot be assessed
      {t.unknownCurrentYes ? ` (${t.unknownCurrentYes} of them match under current law, which says nothing about ${period})` : ""}. Few states have
      verified history of these arrangements yet;{" "}
      <Go to={{ v: "matrix" }} reset>
        see what is coded
      </Go>
      .
    </p>
  );
}

export function ControlBadge({ a, reference = false }: { a: Assessment | undefined; reference?: boolean }) {
  if (!a) return null;
  if (reference) return <span className="control-badge">reference state</span>;
  return (
    <span className={`control-badge v-${a.verdict}`} title={a.reasons.join("; ")}>
      <span aria-hidden="true">{verdictSymbol(a.verdict)}</span> {verdictText(a)}
    </span>
  );
}

/** One line per dimension: verified value, or current law with its date, or "not recorded". `compact` is for table cells. */
export function ControlDims({ a, compact = false }: { a: Assessment; compact?: boolean }) {
  if (compact && a.dims.every((d) => !d.value && !d.snapshots[0] && !d.knownDays)) return <div className="small muted">nothing coded</div>;
  return (
    <ul className="plain-list small">
      {a.dims.map((d) => {
        const lab = labelOf(d.dim);
        const snap = d.snapshots[0];
        return (
          <li key={d.dim}>
            {lab}:{" "}
            {d.value ? (
              <>
                {d.policyIds[0] ? <RecordLink rec={`policy:${d.policyIds[0]}`}>{d.value.replaceAll("_", " ")}</RecordLink> : d.value.replaceAll("_", " ")}{" "}
                <span className="muted">(verified)</span>
              </>
            ) : snap ? (
              <>
                <RecordLink rec={`snapshot:${snap.snapshot_id}`}>{snap.policy_value.replaceAll("_", " ")}</RecordLink>{" "}
                <span className="muted">{compact ? `(current law, ${snap.observed_on})` : `(current law, ${snap.observed_on}; history not verified)`}</span>
              </>
            ) : d.knownDays ? (
              <span className="muted">verified on {d.knownDays} of {d.days} days only</span>
            ) : (
              <span className="muted">not recorded</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
