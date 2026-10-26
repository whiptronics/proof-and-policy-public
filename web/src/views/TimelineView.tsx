// View 2 — Policy timeline. Pick a policy (any dimension in the catalog) and see every coded jurisdiction.
// Lanes come from verified day runs (policy_segments): a coded value is drawn only on days the evidence
// covers; every other day is unknown. Dated snapshots are drawn as markers on their day and never
// stretched. Jurisdictions with nothing coded are listed, not hidden.
import type { KeyboardEvent } from "react";
import { ErrorNote, Loading, RecordLink } from "../components/common";
import { useData } from "../lib/data";
import { SUPPORT_LABELS, geoName, words } from "../lib/format";
import type { Geography, LedgerRun, PolicyData, PolicyEvent, Segment, Snapshot } from "../lib/types";
import { navigate, pickInt, pickOne, useParams } from "../lib/url";

const DAY = 86400000;
const t = (d: string) => Date.parse(`${d}T00:00:00Z`);
const W = 1000;
const LANE_H = 30;
const SUB_H = 12;
const VALUE_COLORS = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)", "var(--series-6)"];
const TEMPORAL_FILL: Record<string, string> = {
  anchored: "var(--st-K)",
  reconciled: "var(--st-P)",
  reconstructed: "var(--st-U)",
  unresolved: "var(--st-M)",
};

interface Lane {
  geo: string;
  dim: string;
  segments: Segment[];
  events: PolicyEvent[];
  runs: LedgerRun[];
  snapshots: Snapshot[];
}

export function TimelineView() {
  const params = useParams();
  const pol = useData<PolicyData>("policy.json");
  const geos = useData<Geography[]>("geographies.json");
  if (pol.error ?? geos.error) return <ErrorNote error={(pol.error ?? geos.error)!} />;
  if (!pol.data || !geos.data) return <Loading what="policy records" />;
  const P = pol.data;
  const states = geos.data.filter((g) => g.geo_level === "state");
  const coded = (dim: string) =>
    new Set([...P.segments.filter((s) => s.policy_dimension === dim).map((s) => s.geo_id), ...P.snapshots.filter((s) => s.policy_dimension === dim).map((s) => s.geo_id)]);
  const dims = Object.keys(P.dimensions).filter((d) => coded(d).size > 0);
  const geoIds = states.map((g) => g.geo_id);
  const geo = pickOne(params.get("geo"), ["all", ...geoIds], "all");
  const dimDefault = dims.includes("ordinary_grocery_wine_authorization") ? "ordinary_grocery_wine_authorization" : dims[0];
  const dim = pickOne(params.get("dim"), geo === "all" ? dims : ["all", ...dims], geo === "all" ? dimDefault : "all");
  const asOfYear = Number(P.as_of_date.slice(0, 4));
  const y0 = pickInt(params.get("y0"), 1985, asOfYear, 1988);
  const y1 = pickInt(params.get("y1"), y0, asOfYear + 1, asOfYear + 1);
  const from = t(`${y0}-01-01`);
  const to = t(`${y1}-12-31`) + DAY;
  const x = (ms: number) => ((Math.min(Math.max(ms, from), to) - from) / (to - from)) * W;

  const laneFor = (g: string, d: string): Lane => {
    const events = P.events.filter((e) => e.geo_id === g && e.policy_dimension === d);
    const claims = new Set(events.flatMap((e) => e.ledger_claims));
    return {
      geo: g,
      dim: d,
      segments: P.segments.filter((s) => s.geo_id === g && s.policy_dimension === d),
      events,
      runs: P.ledger_runs.filter((r) => claims.has(r.claim_id)),
      snapshots: P.snapshots.filter((s) => s.geo_id === g && s.policy_dimension === d),
    };
  };
  const lanes: Lane[] = [];
  if (geo === "all") {
    const c = coded(dim);
    for (const g of geoIds) if (c.has(g)) lanes.push(laneFor(g, dim));
  } else {
    for (const d of dim === "all" ? dims : [dim]) if (coded(d).has(geo)) lanes.push(laneFor(geo, d));
  }
  const uncoded = geo === "all" ? states.filter((g) => !coded(dim).has(g.geo_id)) : [];
  const ticks: number[] = [];
  for (let y = y0; y <= y1; y++) ticks.push(y);
  const step = y1 - y0 > 30 ? 5 : y1 - y0 > 12 ? 2 : 1;
  const asOf = t(P.as_of_date);
  const shownEvents = P.events.filter((e) => (geo === "all" || e.geo_id === geo) && (dim === "all" || e.policy_dimension === dim));
  const shownSnaps = P.snapshots.filter((s) => (geo === "all" || s.geo_id === geo) && (dim === "all" || s.policy_dimension === dim));
  const byDomain = new Map<string, string[]>();
  for (const d of dims) {
    const dom = P.dimensions[d]?.category ?? "other";
    byDomain.set(dom, [...(byDomain.get(dom) ?? []), d]);
  }

  return (
    <>
      <section className="panel" aria-labelledby="tl-h">
        <h2 id="tl-h">Policy timeline</h2>
        <p className="small muted">
          Pick a policy to see every jurisdiction where it is coded, or a jurisdiction to see all its coded policies. A
          colored run is a value verified for those days; a hatched run is unknown. A diamond is a dated snapshot: the
          status a source shows on that day only. Utah's thin bar underneath shows what its dates rest on. Select any run
          or marker for the proposition, section, source and review state.
        </p>
        <div className="controls">
          <label>
            Policy
            <select value={dim} onChange={(e) => navigate({ dim: e.target.value })}>
              {geo !== "all" && <option value="all">All coded policies</option>}
              {[...byDomain.entries()].map(([dom, ds]) => (
                <optgroup key={dom} label={P.categories[dom] ?? words(dom)}>
                  {ds.map((d) => (
                    <option key={d} value={d}>
                      {P.dimensions[d]?.label ?? d} ({coded(d).size})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label>
            Jurisdiction
            <select value={geo} onChange={(e) => navigate({ geo: e.target.value === "all" ? null : e.target.value, dim: e.target.value === "all" ? dimDefault : "all" })}>
              <option value="all">Every coded jurisdiction</option>
              {states.map((g) => (
                <option key={g.geo_id} value={g.geo_id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            From
            <input type="number" value={y0} min={1985} max={y1} onChange={(e) => navigate({ y0: e.target.value }, { replace: true })} />
          </label>
          <label>
            To
            <input type="number" value={y1} min={y0} max={asOfYear + 1} onChange={(e) => navigate({ y1: e.target.value }, { replace: true })} />
          </label>
        </div>
        <TimelineLegend />
        {uncoded.length > 0 && (
          <p className="warn small">
            {uncoded.length} of {states.length} jurisdictions have nothing coded for this policy, so their status is unknown for every
            year: {uncoded.map((g) => g.abbreviation ?? g.name).join(", ")}.
          </p>
        )}
        {lanes.length === 0 ? (
          <div className="empty">Nothing is coded for this selection.</div>
        ) : (
          lanes.map((lane, li) => (
            <LaneSvg key={lane.geo + lane.dim} lane={lane} index={li} P={P} geos={geos.data!} x={x} from={from} to={to} ticks={ticks} step={step} asOf={asOf} label={geo === "all" ? geoName(lane.geo, geos.data!) : P.dimensions[lane.dim]?.label ?? lane.dim} />
          ))
        )}
        <p className="small muted">
          Dashed vertical line: the build's as-of date ({P.as_of_date}, {P.as_of_timezone}); days after it are not observations.
        </p>
      </section>
      <section className="panel" aria-labelledby="tl-table">
        <h2 id="tl-table">Intervals (table)</h2>
        {shownEvents.length === 0 ? (
          <p className="small muted">No verified interval for this selection.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Jurisdiction</th>
                  <th>Policy</th>
                  <th>Value</th>
                  <th>Enacted</th>
                  <th>Legal start</th>
                  <th>End</th>
                  <th>Verified window</th>
                  <th>Dates rest on</th>
                  <th>Review</th>
                  <th>Evidence</th>
                </tr>
              </thead>
              <tbody>
                {shownEvents.map((e) => (
                  <tr key={e.policy_id}>
                    <td>{geoName(e.geo_id, geos.data!)}</td>
                    <td>{e.dimension_label}</td>
                    <td>
                      <RecordLink rec={`policy:${e.policy_id}`}>{words(e.policy_value)}</RecordLink>
                      {e.requires_local_adoption && <div className="small muted">local option</div>}
                    </td>
                    <td>{e.enactment_date ?? "—"}</td>
                    <td>{e.effective_start ?? <span className="muted">unknown</span>}</td>
                    <td>{e.effective_end ?? <span className="muted">{words(e.end_status)}</span>}</td>
                    <td className="small">
                      {e.known_in_effect_from ?? e.effective_start} → {e.known_in_effect_through ?? (e.effective_end ? `before ${e.effective_end}` : "?")}
                    </td>
                    <td>{words(e.temporal_status)}</td>
                    <td>{words(e.legal_review_status)}</td>
                    <td className="num">{e.evidence.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="panel" aria-labelledby="tl-snaps">
        <h2 id="tl-snaps">Dated snapshots (table)</h2>
        <p className="small muted">Each row is the status one source shows on one day. It says nothing about other days.</p>
        {shownSnaps.length === 0 ? (
          <p className="small muted">No snapshot for this selection.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Jurisdiction</th>
                  <th>Policy</th>
                  <th>Value</th>
                  <th>Observed</th>
                  <th>Basis</th>
                  <th>Source</th>
                  <th>Evidence</th>
                  <th>Support</th>
                  <th>Review</th>
                </tr>
              </thead>
              <tbody>
                {shownSnaps.map((s) => (
                  <tr key={s.snapshot_id}>
                    <td>{geoName(s.geo_id, geos.data!)}</td>
                    <td>{P.dimensions[s.policy_dimension]?.label ?? s.policy_dimension}</td>
                    <td>
                      <RecordLink rec={`snapshot:${s.snapshot_id}`}>{words(s.policy_value)}</RecordLink>
                    </td>
                    <td>{s.observed_on ?? `${s.observed_year} (year only)`}</td>
                    <td className="small">{words(s.observed_basis)}</td>
                    <td className="small">{s.citation}</td>
                    <td className="small">{words(s.evidence_strength)}</td>
                    <td className="small" title={SUPPORT_LABELS[s.support_basis]?.long}>
                      {SUPPORT_LABELS[s.support_basis]?.short ?? words(s.support_basis)}
                    </td>
                    <td className="small">{words(s.legal_review_status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function LaneSvg({
  lane,
  index,
  P,
  geos,
  x,
  from,
  to,
  ticks,
  step,
  asOf,
  label,
}: {
  lane: Lane;
  index: number;
  P: PolicyData;
  geos: Geography[];
  x: (ms: number) => number;
  from: number;
  to: number;
  ticks: number[];
  step: number;
  asOf: number;
  label: string;
}) {
  const values = [...new Set([...lane.segments.filter((s) => s.state !== "unknown").map((s) => s.state), ...lane.snapshots.map((s) => s.policy_value)])];
  const color = (v: string) => VALUE_COLORS[values.indexOf(v) % VALUE_COLORS.length];
  const h = LANE_H + (lane.runs.length ? SUB_H + 4 : 0) + 18;
  const hatch = `hatch-${index}`;
  const press = (rec: string) => (e: KeyboardEvent) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), navigate({ rec }));
  return (
    <div style={{ marginBottom: 12 }}>
      <div className="lane-label">
        <strong>{label}</strong> <span className="muted small">({P.dimensions[lane.dim]?.outlet ? words(P.dimensions[lane.dim]?.outlet) : ""})</span>
      </div>
      <svg className="timeline" viewBox={`0 0 ${W} ${h}`} width="100%" role="group" aria-label={`${geoName(lane.geo, geos)}: ${P.dimensions[lane.dim]?.label}`}>
        <defs>
          <pattern id={hatch} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="var(--surface-2)" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--line-strong)" strokeWidth="1.5" />
          </pattern>
        </defs>
        {ticks.map((y) => (
          <line key={y} x1={x(t(`${y}-01-01`))} x2={x(t(`${y}-01-01`))} y1={0} y2={LANE_H} stroke="var(--line)" strokeWidth={y % 5 === 0 ? 1 : 0.4} />
        ))}
        {lane.segments.length === 0 && (
          <g>
            <title>No verified days: unknown for every day shown</title>
            <rect x={0} y={4} width={W} height={LANE_H - 8} fill={`url(#${hatch})`} />
          </g>
        )}
        {lane.segments.map((s) => {
          const a = t(s.segment_start);
          const b = t(s.segment_end) + DAY;
          if (b <= from || a >= to) return null;
          const unknown = s.state === "unknown" || s.state === "disputed";
          const pid = s.policy_ids.split("|").filter((p) => p !== "-")[0];
          const text = unknown
            ? `Unknown, ${s.segment_start} to ${s.segment_end} (${s.days.toLocaleString("en-US")} days): no verified legal status`
            : `${words(s.state)}, verified ${s.segment_start} to ${s.segment_end} (${s.days.toLocaleString("en-US")} days)`;
          const wpx = x(b) - x(a);
          return (
            <g key={s.segment_start} className="seg" role={pid ? "button" : "img"} tabIndex={pid ? 0 : -1} aria-label={text} onClick={() => pid && navigate({ rec: `policy:${pid}` })} onKeyDown={pid ? press(`policy:${pid}`) : undefined}>
              <title>{text}</title>
              <rect x={x(a)} y={4} width={Math.max(wpx, 2)} height={LANE_H - 8} fill={unknown ? `url(#${hatch})` : color(s.state)} stroke="var(--surface)" strokeWidth={0.5} />
              {wpx > 70 && (
                <text x={x(a) + 4} y={LANE_H / 2 + 4} style={{ fill: unknown ? "var(--text-2)" : "var(--st-ink-dark)", fontSize: 11 }}>
                  {unknown ? "unknown" : words(s.state).slice(0, Math.floor(wpx / 6.5))}
                </text>
              )}
            </g>
          );
        })}
        {lane.events.flatMap((e) => {
          const marks: { d: string; sym: string; what: string }[] = [];
          if (e.enactment_date) marks.push({ d: e.enactment_date, sym: "◆", what: "enacted" });
          if (e.effective_start) marks.push({ d: e.effective_start, sym: "▲", what: "legal effective start" });
          if (e.operational_start && e.operational_start !== e.effective_start) marks.push({ d: e.operational_start, sym: "●", what: "operational start" });
          return marks
            .filter((m) => t(m.d) >= from && t(m.d) <= to)
            .map((m) => (
              <g key={e.policy_id + m.what} className="seg" role="button" tabIndex={0} aria-label={`${words(e.policy_value)}: ${m.what} ${m.d}`} onClick={() => navigate({ rec: `policy:${e.policy_id}` })} onKeyDown={press(`policy:${e.policy_id}`)}>
                <title>{`${words(e.policy_value)}: ${m.what} ${m.d}`}</title>
                <text x={x(t(m.d)) - 5} y={LANE_H + 1} style={{ fontSize: 11, fill: "var(--text)" }}>
                  {m.sym}
                </text>
              </g>
            ));
        })}
        {lane.snapshots.map((s) => {
          const day = s.observed_on;
          const a = day ? t(day) : t(`${s.observed_year}-01-01`);
          const b = day ? a + DAY : t(`${s.observed_year}-12-31`) + DAY;
          if (b <= from || a >= to) return null;
          const text = `Snapshot ${day ?? `${s.observed_year} (year only)`}: ${words(s.policy_value)} — ${s.citation}. Says nothing about other days.`;
          const cx = (x(a) + x(b)) / 2;
          return (
            <g key={s.snapshot_id} className="seg" role="button" tabIndex={0} aria-label={text} onClick={() => navigate({ rec: `snapshot:${s.snapshot_id}` })} onKeyDown={press(`snapshot:${s.snapshot_id}`)}>
              <title>{text}</title>
              {day ? (
                <path d={`M ${cx} 2 L ${cx + 7} ${LANE_H / 2} L ${cx} ${LANE_H - 2} L ${cx - 7} ${LANE_H / 2} Z`} fill={color(s.policy_value)} stroke="var(--text)" strokeWidth={1.2} />
              ) : (
                <rect x={x(a)} y={1} width={Math.max(x(b) - x(a), 4)} height={LANE_H - 2} fill="none" stroke="var(--text)" strokeWidth={1.5} strokeDasharray="3 2" />
              )}
              <text x={Math.min(cx + 9, W - 90)} y={LANE_H + 12} style={{ fontSize: 10 }}>
                ◇ {day ?? s.observed_year}: {words(s.policy_value)}
              </text>
            </g>
          );
        })}
        {lane.runs.map((r) => {
          const a = t(r.verified_from);
          const b = t(r.verified_through) + DAY;
          if (b <= from || a >= to) return null;
          return (
            <g key={r.claim_id + r.verified_from}>
              <title>{`Dates ${words(r.temporal_status)}, ${r.verified_from} to ${r.verified_through} (claim ${r.claim_id})`}</title>
              <rect x={x(a)} y={LANE_H + 4} width={Math.max(x(b) - x(a), 1)} height={SUB_H - 2} fill={TEMPORAL_FILL[r.temporal_status] ?? "var(--st-M)"} stroke="var(--surface)" strokeWidth={0.5} />
            </g>
          );
        })}
        {asOf >= from && asOf <= to && <line x1={x(asOf + DAY)} x2={x(asOf + DAY)} y1={0} y2={h - 16} stroke="var(--text)" strokeDasharray="2 2" strokeWidth={1} />}
        {ticks
          .filter((y) => y % step === 0)
          .map((y) => (
            <text key={y} x={x(t(`${y}-01-01`)) + 1} y={h - 3}>
              {y}
            </text>
          ))}
      </svg>
    </div>
  );
}

function TimelineLegend() {
  return (
    <div className="legend" aria-label="Legend">
      <span className="item">
        <span className="sw" style={{ background: "var(--series-1)" }} aria-hidden="true" /> Verified value (one color per value)
      </span>
      <span className="item">
        <span className="sw st-dash" aria-hidden="true" /> Unknown (not verified)
      </span>
      <span className="item">◆ Enacted</span>
      <span className="item">▲ Legal effective start</span>
      <span className="item">● Operational start (when established)</span>
      <span className="item">◇ Dated snapshot (that day only; dashed box = year only)</span>
      <span className="item">
        <span className="sw" style={{ background: TEMPORAL_FILL.anchored }} aria-hidden="true" /> anchored
      </span>
      <span className="item">
        <span className="sw" style={{ background: TEMPORAL_FILL.reconciled }} aria-hidden="true" /> reconciled
      </span>
      <span className="item">
        <span className="sw" style={{ background: TEMPORAL_FILL.reconstructed }} aria-hidden="true" /> reconstructed
      </span>
    </div>
  );
}
