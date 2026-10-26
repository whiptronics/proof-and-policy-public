// Policy matrix: every state against every coded policy dimension, read one of two ways that are never
// mixed. "On one day" shows the verified status on a chosen day, from day runs only. "Dated snapshots"
// shows the latest snapshot in each cell with its own date printed in the cell; a snapshot is the status
// one source shows on that day and is never history.
import { ErrorNote, Go, Loading, RecordLink } from "../components/common";
import { saveFile, toCsv, type Column } from "../lib/csv";
import { useData } from "../lib/data";
import { SUPPORT_LABELS, words } from "../lib/format";
import { snapshotCheck, snapshotsFor, statusOnDay, type DayStatus } from "../lib/analysis";
import type { Geography, Manifest, PolicyData, Snapshot } from "../lib/types";
import { navigate, pickOne, useParams } from "../lib/url";

const MODES = ["snap", "day"] as const;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validDay(v: string | null, max: string, fallback: string): string {
  if (v === null || !DATE_RE.test(v) || v < "1900-01-01" || v > max) return fallback;
  const t = Date.parse(`${v}T00:00:00Z`);
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === v ? v : fallback;
}

interface Cell {
  geo: Geography;
  dim: string;
  day: DayStatus;
  snapshots: Snapshot[];
  latest: Snapshot | undefined;
  check: "agrees" | "differs" | "no_history";
  hasHistory: boolean;
}

export function MatrixView() {
  const params = useParams();
  const pol = useData<PolicyData>("policy.json");
  const geos = useData<Geography[]>("geographies.json");
  const man = useData<Manifest>("manifest.json");
  if (pol.error ?? geos.error ?? man.error) return <ErrorNote error={(pol.error ?? geos.error ?? man.error)!} />;
  if (!pol.data || !geos.data || !man.data) return <Loading what="policy records" />;
  const P = pol.data;
  const states = geos.data.filter((g) => g.geo_level === "state");
  const mode = pickOne(params.get("mode"), MODES, "snap");
  const day = validDay(params.get("d"), P.as_of_date, P.as_of_date);
  const coded = (d: string) => P.segments.some((s) => s.policy_dimension === d && s.state !== "unknown") || P.snapshots.some((s) => s.policy_dimension === d);
  const allDims = Object.keys(P.dimensions).filter(coded);
  const cats = [...new Set(allDims.map((d) => P.dimensions[d].category))];
  const cat = pickOne(params.get("cat"), ["all", ...cats], "all");
  const dims = allDims.filter((d) => cat === "all" || P.dimensions[d].category === cat);

  const cells = new Map<string, Cell>();
  for (const g of states) {
    for (const d of dims) {
      const snapshots = snapshotsFor(P.snapshots, g.geo_id, d);
      const latest = snapshots[snapshots.length - 1];
      cells.set(`${g.geo_id}|${d}`, {
        geo: g,
        dim: d,
        day: statusOnDay(P.segments, g.geo_id, d, day, P.as_of_date),
        snapshots,
        latest,
        check: latest ? snapshotCheck(P.segments, latest, P.as_of_date) : "no_history",
        hasHistory: P.segments.some((s) => s.geo_id === g.geo_id && s.policy_dimension === d && s.state !== "unknown"),
      });
    }
  }
  const all = [...cells.values()];
  const differs = all.filter((c) => mode === "snap" && c.check === "differs");
  const snapDates = all.filter((c) => c.latest).map((c) => c.latest!.observed_on ?? String(c.latest!.observed_year)).sort();
  const sameDaySnaps = (c: Cell) => c.snapshots.filter((s) => s.observed_on === day);
  const records = P.events.length + P.snapshots.length;
  const reviewed = P.events.filter((e) => e.reviewer).length + P.snapshots.filter((s) => s.reviewed_by).length;

  const download = () => {
    const cols: Column<Cell>[] = [
      { key: "geo_id", kind: "text", get: (c) => c.geo.geo_id },
      { key: "geo_name", kind: "text", get: (c) => c.geo.name },
      { key: "policy_dimension", kind: "text", get: (c) => c.dim },
      { key: "dimension_label", kind: "text", get: (c) => P.dimensions[c.dim]?.label },
      ...(mode === "day"
        ? ([
            { key: "day", kind: "date", get: () => day },
            { key: "status_kind", kind: "text", get: (c) => c.day.kind },
            { key: "verified_value", kind: "text", get: (c) => (c.day.kind === "known" ? c.day.value : null) },
            { key: "policy_ids", kind: "list", get: (c) => (c.day.kind === "known" ? c.day.policyIds : []) },
            { key: "unknown_because", kind: "text", get: (c) => (c.day.kind === "unknown" ? c.day.why : null) },
            { key: "snapshots_on_this_day", kind: "list", get: (c) => sameDaySnaps(c).map((s) => `${s.snapshot_id}:${s.policy_value}`) },
          ] as Column<Cell>[])
        : ([
            { key: "snapshot_id", kind: "text", get: (c) => c.latest?.snapshot_id },
            { key: "snapshot_value", kind: "text", get: (c) => c.latest?.policy_value },
            { key: "observed_on", kind: "date", get: (c) => c.latest?.observed_on },
            { key: "observed_year", kind: "number", get: (c) => c.latest?.observed_year },
            { key: "observed_basis", kind: "text", get: (c) => c.latest?.observed_basis },
            { key: "support_basis", kind: "text", get: (c) => c.latest?.support_basis },
            { key: "evidence_strength", kind: "text", get: (c) => c.latest?.evidence_strength },
            { key: "legal_review_status", kind: "text", get: (c) => c.latest?.legal_review_status },
            { key: "citation", kind: "text", get: (c) => c.latest?.citation },
            { key: "earlier_snapshots", kind: "number", get: (c) => Math.max(c.snapshots.length - 1, 0) },
            { key: "verified_history_that_day", kind: "text", get: (c) => (c.latest ? c.check : null) },
          ] as Column<Cell>[])),
    ];
    const head =
      mode === "day"
        ? `# Verified status on ${day}, from verified day runs only. Release ${man.data!.dataset.release_label}; law as of ${P.as_of_date}.\r\n`
        : `# Latest dated snapshot per cell. Each is the status one source shows on its own date and says nothing about other days. Release ${man.data!.dataset.release_label}.\r\n`;
    saveFile(`policy_matrix_${mode === "day" ? day : "snapshots"}_${cat}.csv`, head + toCsv(cols, all), "text/csv;charset=utf-8");
  };

  return (
    <>
      <section className="panel" aria-labelledby="mx-h">
        <h2 id="mx-h">Policy matrix</h2>
        <p className="small muted">
          Every state against every coded policy. Read it one of two ways. <strong>On one day</strong> shows the status verified
          for that day; anything else is unknown. <strong>Dated snapshots</strong> shows, in each cell, the latest status a source
          shows and the date it shows it; dates differ from cell to cell, and a snapshot is never a status for any other day.
          Select a cell for its source, excerpt and review state.{" "}
          {reviewed === 0 ? "None of these records has been reviewed by a person." : `${reviewed} of ${records} records have been reviewed by a person.`}
        </p>
        <div className="controls">
          <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend>Read as</legend>
            <div className="row-actions" style={{ margin: 0 }}>
              {MODES.map((m) => (
                <label key={m} style={{ display: "inline-flex", flexDirection: "row", gap: 4, alignItems: "center", color: "var(--text)" }}>
                  <input type="radio" name="mx-mode" value={m} checked={mode === m} onChange={() => navigate({ mode: m === "snap" ? null : m })} />
                  {m === "snap" ? "Dated snapshots" : "On one day"}
                </label>
              ))}
            </div>
          </fieldset>
          {mode === "day" && (
            <label>
              Day
              <input type="date" value={day} min="1900-01-01" max={P.as_of_date} onChange={(e) => navigate({ d: e.target.value || null }, { replace: true })} />
            </label>
          )}
          <label>
            Policies
            <select value={cat} onChange={(e) => navigate({ cat: e.target.value === "all" ? null : e.target.value })}>
              <option value="all">All coded policies ({allDims.length})</option>
              {cats.map((c) => (
                <option key={c} value={c}>
                  {P.categories[c] ?? words(c)} ({allDims.filter((d) => P.dimensions[d].category === c).length})
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="legend" aria-label="Legend">
          {mode === "day" ? (
            <>
              <span className="item">■ verified on this day</span>
              <span className="item">? unknown on this day</span>
              <span className="item">· nothing verified on any day</span>
              <span className="item">◇ a snapshot taken on exactly this day</span>
            </>
          ) : (
            <>
              <span className="item">◇ latest dated snapshot (its date is in the cell)</span>
              <span className="item">· no snapshot</span>
              <span className="item">stated / general license / implied: how the excerpt supports the value</span>
              <span className="item">history: verified days exist (open the timeline)</span>
            </>
          )}
        </div>
        {mode === "snap" && snapDates.length > 0 && (
          <p className="small muted">
            {snapDates.length} cells have a snapshot, dated {snapDates[0]} to {snapDates[snapDates.length - 1]}.
          </p>
        )}
        {mode === "day" && (
          <p className="small muted">
            Status on {day}. Verified history exists for few states, so most cells are unknown on most days; that is the state of the
            evidence, not a finding about the law.
          </p>
        )}
        {differs.length > 0 && (
          <p className="warn small" role="alert">
            On {differs.length} snapshot day{differs.length > 1 ? "s" : ""}, verified history gives a different value:{" "}
            {differs.map((c) => `${c.geo.abbreviation ?? c.geo.name} ${P.dimensions[c.dim]?.label}`).join("; ")}. Open the cell to compare.
          </p>
        )}
      </section>
      <section className="panel" aria-labelledby="mx-t">
        <h3 id="mx-t" className="visually-hidden">
          Matrix
        </h3>
        <div className="policy-matrix-wrap">
          <table className="data policy-matrix">
            <thead>
              <tr>
                <th scope="col">State</th>
                {dims.map((d) => {
                  const col = all.filter((c) => c.dim === d);
                  const n = mode === "day" ? col.filter((c) => c.day.kind === "known").length : col.filter((c) => c.latest).length;
                  return (
                    <th key={d} scope="col">
                      <Go to={{ v: "timeline", dim: d }} reset>
                        {P.dimensions[d]?.label ?? d}
                      </Go>
                      <div className="small muted">
                        {n} of {states.length} {mode === "day" ? "verified" : "with a snapshot"}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {states.map((g) => (
                <tr key={g.geo_id}>
                  <th scope="row">
                    {g.name} <span className="muted small">{g.abbreviation}</span>
                  </th>
                  {dims.map((d) => {
                    const c = cells.get(`${g.geo_id}|${d}`)!;
                    return <td key={d} className="small">{mode === "day" ? <DayCell c={c} on={day} /> : <SnapCell c={c} />}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="row-actions">
          <button type="button" onClick={download}>
            Download this matrix (CSV)
          </button>
        </div>
      </section>
    </>
  );
}

function DayCell({ c, on }: { c: Cell; on: string }) {
  const same = c.snapshots.filter((s) => s.observed_on === on);
  return (
    <>
      {c.day.kind === "known" ? (
        c.day.policyIds.length ? (
          <RecordLink rec={`policy:${c.day.policyIds[c.day.policyIds.length - 1]}`}>■ {words(c.day.value)}</RecordLink>
        ) : (
          <>■ {words(c.day.value)}</>
        )
      ) : c.day.kind === "unknown" ? (
        <span className="muted" title={c.day.why}>
          ? unknown
        </span>
      ) : (
        <span className="muted">· not coded</span>
      )}
      {same.map((s) => (
        <div key={s.snapshot_id}>
          ◇ <RecordLink rec={`snapshot:${s.snapshot_id}`}>snapshot this day: {words(s.policy_value)}</RecordLink>
        </div>
      ))}
    </>
  );
}

function SnapCell({ c }: { c: Cell }) {
  const s = c.latest;
  const history = c.hasHistory && (
    <div>
      <Go to={{ v: "timeline", geo: c.geo.geo_id, dim: c.dim }} reset>
        history
      </Go>
    </div>
  );
  if (!s)
    return (
      <>
        <span className="muted">· none</span>
        {history}
      </>
    );
  return (
    <>
      ◇ <RecordLink rec={`snapshot:${s.snapshot_id}`}>{words(s.policy_value)}</RecordLink>
      <div className="muted">
        {s.observed_on ?? `${s.observed_year} (year only)`} · {SUPPORT_LABELS[s.support_basis]?.short ?? words(s.support_basis)}
        {c.snapshots.length > 1 && ` · ${c.snapshots.length - 1} earlier`}
      </div>
      {c.check === "differs" && <div className="warn-inline">verified history differs on this day</div>}
      {history}
    </>
  );
}
