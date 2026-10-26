// The status of one coded policy, year by year, for the jurisdictions on screen. From verified day runs
// only: unknown days stay unknown, and a dated snapshot is listed only for its own year.
import { Go, RecordLink } from "./common";
import { saveFile, toCsv, type Column } from "../lib/csv";
import { SUPPORT_LABELS, geoName, words } from "../lib/format";
import { snapshotsFor, yearRuns, yearStatuses, type Analysis, type YearStatus } from "../lib/analysis";
import type { Geography, PolicyData } from "../lib/types";

export function runText(s: YearStatus, from: number, to: number, asOf: string): string {
  const span = from === to ? String(from) : `${from}–${to}`;
  switch (s.kind) {
    case "known":
      return `${span}: ${words(s.values[0])}, verified every day`;
    case "partial":
      return `${span}: ${words(s.values[0])} on ${s.knownDays} of ${s.days} days${from === to ? "" : " each year"}; other days unknown`;
    case "changed":
      return `${span}: ${s.values.map(words).join(" → ")} (${s.knownDays} of ${s.days} days verified)`;
    case "unknown":
      return `${span}: unknown (no verified day)`;
    case "after_as_of":
      return `${span}: after the build's as-of date (${asOf})`;
    default:
      return `${span}: not coded (no verified day in any year)`;
  }
}

export const RUN_SYMBOL: Record<string, string> = { known: "■", partial: "◧", changed: "◧", unknown: "?", not_coded: "·", after_as_of: "" };

export function PolicyByYear({ a, pol, geos, release }: { a: Analysis; pol: PolicyData; geos: Geography[]; release: string }) {
  const dim = a.policy!;
  const label = pol.dimensions[dim]?.label ?? dim;
  const rows = a.geos.map((g) => {
    const geo = geos.find((x) => x.geo_id === g);
    const isState = geo?.geo_level === "state";
    const statuses = isState ? yearStatuses(pol.segments, g, dim, a.from, a.to, pol.as_of_date) : [];
    const snaps = isState ? snapshotsFor(pol.snapshots, g, dim) : [];
    return { g, isState, statuses, runs: yearRuns(statuses), inside: snaps.filter((s) => s.observed_year >= a.from && s.observed_year <= a.to), outside: snaps.filter((s) => s.observed_year < a.from || s.observed_year > a.to) };
  });
  const download = () => {
    type Row = { g: string; s: YearStatus };
    const cols: Column<Row>[] = [
      { key: "geo_id", kind: "text", get: (r) => r.g },
      { key: "geo_name", kind: "text", get: (r) => geoName(r.g, geos) },
      { key: "policy_dimension", kind: "text", get: () => dim },
      { key: "calendar_year", kind: "number", get: (r) => r.s.year },
      { key: "status_kind", kind: "text", get: (r) => r.s.kind },
      { key: "verified_values", kind: "list", get: (r) => r.s.values },
      { key: "verified_days", kind: "number", get: (r) => r.s.knownDays },
      { key: "days_through_as_of", kind: "number", get: (r) => r.s.days },
      { key: "policy_ids", kind: "list", get: (r) => r.s.policyIds },
      {
        key: "snapshots_this_year",
        kind: "list",
        get: (r) =>
          snapshotsFor(pol.snapshots, r.g, dim)
            .filter((s) => s.observed_year === r.s.year)
            .map((s) => `${s.snapshot_id}:${s.policy_value}@${s.observed_on ?? s.observed_year}`),
      },
    ];
    const data = rows.flatMap((r) => r.statuses.map((s) => ({ g: r.g, s })));
    const head =
      `# ${label}: verified status by calendar year. Release ${release}; law as of ${pol.as_of_date}.\r\n` +
      "# Counts come from verified day runs only; a snapshot is listed in the year it was observed and covers that day only.\r\n";
    saveFile(`policy_by_year_${dim}_${a.from}_${a.to}.csv`, head + toCsv(cols, data), "text/csv;charset=utf-8");
  };
  return (
    <section className="panel" aria-labelledby="ex-pol">
      <h3 id="ex-pol">Policy: {label}, by calendar year</h3>
      <p className="small muted">
        From verified day runs only. A year counts as verified when every day of it is; days after the build's as-of date (
        {pol.as_of_date}) are not counted. Unknown means no source in the dataset establishes the status on those days. A dated
        snapshot is the status one source shows on one day and is listed only for its own year. Charts above mark a verified
        change from one value to another, never the first verified day.
      </p>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Jurisdiction</th>
              <th>Verified status</th>
              <th>Dated snapshots in these years</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.g}>
                <th scope="row">{geoName(r.g, geos)}</th>
                <td className="small">
                  {!r.isState ? (
                    <span className="muted">Policy is coded for states only.</span>
                  ) : (
                    <ul className="source-list" style={{ margin: 0, paddingLeft: 16 }}>
                      {r.runs.map((run) => (
                        <li key={run.from}>
                          <span aria-hidden="true">{RUN_SYMBOL[run.status.kind]} </span>
                          {run.status.policyIds.length > 0 ? (
                            <RecordLink rec={`policy:${run.status.policyIds[run.status.policyIds.length - 1]}`}>{runText(run.status, run.from, run.to, pol.as_of_date)}</RecordLink>
                          ) : (
                            runText(run.status, run.from, run.to, pol.as_of_date)
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="small">
                  {r.inside.length === 0 && <span className="muted">none</span>}
                  <ul className="source-list" style={{ margin: 0, paddingLeft: 16 }}>
                    {r.inside.map((s) => (
                      <li key={s.snapshot_id}>
                        ◇{" "}
                        <RecordLink rec={`snapshot:${s.snapshot_id}`}>
                          {s.observed_on ?? `${s.observed_year} (year only)`}: {words(s.policy_value)}
                        </RecordLink>{" "}
                        <span className="muted">({SUPPORT_LABELS[s.support_basis]?.short ?? words(s.support_basis)}; that day only)</span>
                      </li>
                    ))}
                  </ul>
                  {r.outside.length > 0 && (
                    <div className="muted">
                      {r.outside.length} more outside these years ({r.outside.map((s) => s.observed_on ?? s.observed_year).join(", ")})
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row-actions">
        <button type="button" onClick={download}>
          Download this table (CSV, one row per jurisdiction and year)
        </button>
        <Go to={{ v: "timeline", dim }} reset>
          Open this policy in the timeline
        </Go>
      </div>
    </section>
  );
}
