// "Why Utah's liquor-sales figures differ": the year-by-year bridge between DABS's sales, the two statutory deposits,
// Census receipts and the audited fund's sales, each line with its evidence status, and the Utah-Pennsylvania
// comparison. Reads reconciliation.json (src/alcohol_data/dashboard/reconciliation.py). Observed figures only: no
// modeled revenue, no assumption. Values read online and not yet saved carry the ◐ mark and link to the page.
import type { ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useData } from "../lib/data";
import { analysisPatch, fromConfig } from "../lib/analysis";
import { STATUS_META, STATUS_ORDER, cellText, ratePct, residualPoints, share, tally, thousands, valueHref } from "../lib/reconcile";
import type { BasisId, BasisRow, BridgeYear, EvidenceStatus, ReconSource, ReconValue, Reconciliation, SavedAnalysisConfig } from "../lib/types";
import { ErrorNote, Go, Loading, RecordLink } from "./common";

export function StatusChip({ status }: { status: EvidenceStatus }) {
  const m = STATUS_META[status];
  return (
    <span className={`badge ev ev-${status}`}>
      <span className="sym" aria-hidden="true">
        {m.sym}
      </span>
      {m.label}
    </span>
  );
}

function Src({ s }: { s: ReconSource }) {
  const text = s.kind === "lead" ? `research lead ${s.id}` : s.kind === "gap" ? `research gap ${s.id}` : s.label;
  const mark = s.provisional ? " ◐" : "";
  if (s.rec) return <RecordLink rec={s.rec}>{text + mark}</RecordLink>;
  if (s.url)
    return (
      <a href={s.page ? `${s.url}#page=${s.page}` : s.url} target="_blank" rel="noreferrer">
        {text + mark}
      </a>
    );
  return <>{text}</>;
}

function Sources({ list }: { list: ReconSource[] }) {
  if (!list.length) return null;
  return (
    <span className="small muted">
      {" "}
      Sources:{" "}
      {list.map((s, i) => (
        <span key={`${s.kind}:${s.id}`}>
          {i ? "; " : ""}
          <Src s={s} />
        </span>
      ))}
      .
    </span>
  );
}

/** A value that opens its record (saved sources) or its page (read online, marked ◐). */
function Val({ v, children }: { v: ReconValue; children?: ReactNode }) {
  const h = valueHref(v);
  const body = children ?? thousands(v.value);
  if (h.rec) return <RecordLink rec={h.rec}>{body}</RecordLink>;
  if (h.url)
    return (
      <a href={h.url} target="_blank" rel="noreferrer" title={`${v.document ?? "Read online"}${v.page ? `, page ${v.page}` : ""}; not yet saved in the project`}>
        {body}
        <span aria-label=" read online, not yet saved"> ◐</span>
      </a>
    );
  return <>{body}</>;
}

function Vals({ list }: { list: ReconValue[] }) {
  if (!list.length) return <>—</>;
  return (
    <>
      {list.map((v, i) => (
        <span key={i}>
          {i ? " or " : ""}
          <Val v={v} />
        </span>
      ))}
    </>
  );
}

function BridgeRows({ r, tol }: { r: BridgeYear; tol: number }) {
  const target = r.compared_with === "census" ? r.census_receipts : r.audited_fund_sales;
  const st = r.statutory_rates;
  const rateText = st.school_meals && st.enforcement_fund ? `${ratePct(st.school_meals.rate)} + ${ratePct(st.enforcement_fund.rate)}` : "rate not coded";
  return (
    <>
      {r.dabs_sales.map((s, i) => {
        const stat = r.variants.find((v) => v.kind === "statutory" && v.sales === s.value);
        const rep = r.variants.find((v) => v.kind === "reported" && v.sales === s.value);
        const res = (v: typeof stat) =>
          v?.residual === null || v === undefined ? (
            "—"
          ) : (
            <span className={Math.abs(v.residual) <= tol ? "" : "strong"}>
              {thousands(v.residual)}
              {Math.abs(v.residual) <= tol ? " =" : ""}
            </span>
          );
        return (
          <tr key={`${r.fiscal_year}-${i}`}>
            {i === 0 && (
              <th scope="row" rowSpan={r.dabs_sales.length}>
                FY{r.fiscal_year}
              </th>
            )}
            <td className="num">
              <Val v={s} />
            </td>
            <td className="num">
              {thousands(stat?.school_meals)} + {thousands(stat?.enforcement_fund)}
              <div className="small muted">{rateText}</div>
            </td>
            <td className="num">
              <Vals list={r.reported_deposits.school_meals} /> + <Vals list={r.reported_deposits.enforcement_fund} />
              <div className="small muted">
                {share(r.reported_share_of_sales.school_meals, 2)} + {share(r.reported_share_of_sales.enforcement_fund, 3)}
              </div>
            </td>
            <td className="num">
              <Vals list={target} />
              <div className="small muted">{r.compared_with === "census" ? "Census" : "audited fund"}</div>
            </td>
            <td className="num">{res(stat)}</td>
            <td className="num">{res(rep)}</td>
            {i === 0 && (
              <td rowSpan={r.dabs_sales.length}>
                <StatusChip status={r.status} />
              </td>
            )}
          </tr>
        );
      })}
      {r.note ? (
        <tr className="recon-note">
          <td />
          <td colSpan={7} className="small muted">
            {r.note}
          </td>
        </tr>
      ) : null}
    </>
  );
}

function ResidualChart({ data, tolM }: { data: ReturnType<typeof residualPoints>; tolM: number }) {
  return (
    <figure className="chart" aria-label="Left over after the two deposits, by fiscal year">
      <figcaption className="small">
        <strong>Left over after the two statutory deposits</strong>, $ millions (DABS sales less the deposits, minus Census receipts or, for FY2025, the audited fund's sales). The shaded
        band is ±${tolM.toFixed(2)} million. * DABS prints two FY2024 sales figures; the chart uses the first, the table shows both.
      </figcaption>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }} barGap={2} barCategoryGap="22%">
          <CartesianGrid stroke="var(--line)" strokeDasharray="2 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-2)" }} stroke="var(--line-strong)" interval={0} angle={-35} textAnchor="end" height={44} />
          <YAxis tick={{ fontSize: 11, fill: "var(--text-2)" }} stroke="var(--line-strong)" width={44} tickFormatter={(v: number) => `${v}`} />
          <ReferenceArea y1={-tolM} y2={tolM} fill="var(--ci)" stroke="none" ifOverflow="extendDomain" />
          <ReferenceLine y={0} stroke="var(--line-strong)" />
          <Tooltip
            formatter={(v: unknown, name: unknown) => [v === null || v === undefined ? "—" : `$${Number(v).toFixed(2)} million`, String(name)]}
            labelFormatter={(l: unknown) => String(l)}
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--line-strong)", color: "var(--text)", fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="statutory" name="Deposits at the statutory rates" fill="var(--series-1)" radius={[2, 2, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="reported" name="Deposits as DABS reported them" fill="var(--series-2)" radius={[2, 2, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
}

const COMPARABLE_TEXT = { yes: "Comparable", partly: "Partly comparable", no: "Not comparable" } as const;

export function ReconciliationPanel() {
  const rec = useData<Reconciliation>("reconciliation.json");
  const saved = useData<{ analyses: SavedAnalysisConfig[] }>("analyses.json");
  if (rec.error) return <ErrorNote error={rec.error} />;
  if (!rec.data) return <Loading what="the reconciliation" />;
  const d = rec.data;
  const t = tally(d.bridge);
  const tolM = d.tolerance_dollars / 1e6;
  const peerAnalysis = d.peer ? saved.data?.analyses.find((a) => a.analysis_id === d.peer!.saved_analysis) : undefined;
  return (
    <section className="panel report recon" aria-labelledby="ut-recon">
      <h3 id="ut-recon">{d.title}</h3>
      <p className="small">{d.question}</p>
      <p>{d.summary}</p>
      <div className="legend small" aria-label="Evidence status">
        {STATUS_ORDER.map((s) => (
          <span className="item" key={s} title={d.statuses[s]}>
            <StatusChip status={s} />
          </span>
        ))}
        <span className="item">◐ read online, not yet saved in the project</span>
      </div>

      <h4>Year by year</h4>
      <p className="small muted">
        {t.reconciled.length} of {d.bridge.length} fiscal years agree within ${tolM.toFixed(2)} million on at least one variant; unresolved: {t.unresolved.map((y) => `FY${y}`).join(", ") || "none"}.
        Only the two deposits Utah law computes on total gross liquor revenue are subtracted. Fixed-amount earmarks (Parents Empowered, underage drinking prevention, other programs)
        are not: nothing computes them on sales.
      </p>
      <ResidualChart data={residualPoints(d.bridge)} tolM={tolM} />
      <div className="table-wrap">
        <table className="data recon-table">
          <caption className="small">
            Thousands of dollars. Deposits are school meals + enforcement fund: “statutory” is the rate in law times DABS's sales, “reported” is what DABS printed. “Left over” is DABS's
            sales less the deposits, minus Census receipts (FY2025: the audited fund's sales); “=” marks ±${tolM.toFixed(2)} million or less. Each figure opens its record or source page.
          </caption>
          <thead>
            <tr>
              <th scope="col">Fiscal year</th>
              <th scope="col" className="num">
                DABS sales
              </th>
              <th scope="col" className="num">
                Deposits, statutory
              </th>
              <th scope="col" className="num">
                Deposits, reported
              </th>
              <th scope="col" className="num">
                Census or audited
              </th>
              <th scope="col" className="num">
                Left over, statutory
              </th>
              <th scope="col" className="num">
                Left over, reported
              </th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {d.bridge.map((r) => (
              <BridgeRows key={r.fiscal_year} r={r} tol={d.tolerance_dollars} />
            ))}
          </tbody>
        </table>
      </div>

      <h4>What is established</h4>
      <ul className="findings">
        {d.findings.map((f) => (
          <li key={f.id}>
            <StatusChip status={f.status} /> {f.text}
            <Sources list={f.sources} />
          </li>
        ))}
      </ul>

      <div className="warn">
        <p>
          <StatusChip status={d.fy2024.status} /> <strong>FY2024, separately.</strong> {d.fy2024.text}
        </p>
        <ul className="findings">
          {d.fy2024.facts.map((f, i) => (
            <li key={i}>
              <StatusChip status={f.status} /> {f.text}
              <Sources list={f.sources} />
            </li>
          ))}
        </ul>
        {d.fy2024.bases && <BasesTable bases={d.fy2024.bases} />}
        <p className="small">{d.fy2024.next}</p>
      </div>

      <h4>Does “sales” include sales tax? Each series separately</h4>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th scope="col">Series</th>
              <th scope="col">Status</th>
              <th scope="col">What the evidence shows</th>
              <th scope="col">Use in the Utah revenue scenarios</th>
            </tr>
          </thead>
          <tbody>
            {d.sales_tax_basis.map((s) => (
              <tr key={s.id}>
                <th scope="row">{s.series}</th>
                <td>
                  <StatusChip status={s.status} />
                </td>
                <td>
                  {s.text}
                  <Sources list={s.sources} />
                </td>
                <td className="small">{s.scenario_use}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h4>The deposit rates in Utah law, fiscal year by fiscal year</h4>
      <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th scope="col">Deposit</th>
                <th scope="col">Fiscal years</th>
                <th scope="col" className="num">
                  Rate
                </th>
                <th scope="col">Text and evidence</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {d.deposit_rates.map((r) => (
                <tr key={r.rate_id}>
                  <th scope="row">{r.deposit === "school_meals" ? "School meals (Uniform School Fund), § 32B-2-304" : "Enforcement fund (Public Safety), § 32B-2-305"}</th>
                  <td>
                    FY{r.fiscal_year_from}
                    {r.fiscal_year_to !== r.fiscal_year_from ? `–FY${r.fiscal_year_to}` : ""}
                  </td>
                  <td className="num">{ratePct(r.rate)}</td>
                  <td className="small">
                    “{r.text}” {r.evidence}. {r.note}
                    <Sources list={r.sources} />
                  </td>
                  <td>
                    <StatusChip status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
      </div>

      {d.peer && (
        <>
          <h4>Utah and {d.peer.name}: what compares</h4>
          <p className="small">{d.peer.structure}</p>
          <div className="table-wrap">
            <table className="data recon-peer">
              <caption className="small">Thousands of dollars or shares of each system's own sales. Never added across rows: receipts, transfers and operating income are different things.</caption>
              <thead>
                <tr>
                  <th scope="col" rowSpan={2}>
                    Measure
                  </th>
                  <th scope="colgroup" colSpan={d.peer.years.length} className="num">
                    Utah
                  </th>
                  <th scope="colgroup" colSpan={d.peer.years.length} className="num">
                    {d.peer.name}
                  </th>
                  <th scope="col" rowSpan={2}>
                    Comparable?
                  </th>
                </tr>
                <tr>
                  {[...d.peer.years, ...d.peer.years].map((y, i) => (
                    <th key={i} scope="col" className="num">
                      FY{y}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.peer.rows.map((row) => (
                  <tr key={row.id}>
                    <th scope="row">
                      {row.label}
                      {row.utah_label || row.peer_label ? (
                        <div className="small muted">
                          {row.utah_label ? `Utah: ${row.utah_label}. ` : ""}
                          {row.peer_label ? `${d.peer!.name}: ${row.peer_label}.` : ""}
                        </div>
                      ) : null}
                    </th>
                    {(["utah", "peer"] as const).flatMap((side) =>
                      d.peer!.years.map((y) => {
                        const vals = row.values[side][String(y)] ?? [];
                        return (
                          <td key={`${side}${y}`} className="num">
                            {vals.length === 0 ? "—" : vals.map((v, i) => (
                              <span key={i}>
                                {i ? " or " : ""}
                                {v.ratio ? (v.provisional ? `${cellText([v])} ◐` : cellText([v])) : <Val v={v} />}
                              </span>
                            ))}
                          </td>
                        );
                      }),
                    )}
                    <td className="small">
                      <strong>{COMPARABLE_TEXT[row.comparable]}.</strong> {row.why}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {peerAnalysis ? (
            <p className="small">
              Over a longer span, per resident aged 21 and over:{" "}
              <Go to={analysisPatch(fromConfig(peerAnalysis), peerAnalysis.analysis_id)} reset>
                {peerAnalysis.title}
              </Go>
              .
            </p>
          ) : null}
        </>
      )}

      {d.corrections.length > 0 && (
        <div className="note small">
          <strong>Corrected here.</strong>{" "}
          {d.corrections.map((c, i) => (
            <span key={i}>
              Earlier ({c.was}) Now ({c.on}): {c.now}{" "}
            </span>
          ))}
        </div>
      )}

      <p className="small muted">
        {d.provisional_documents.length > 0 ? (
          <>
            Read online and not yet saved in the project (◐), so not part of the dataset until saved and checked:{" "}
            {d.provisional_documents.map((p, i) => (
              <span key={p.url}>
                {i ? "; " : ""}
                <a href={p.url} target="_blank" rel="noreferrer">
                  {p.document}
                </a>{" "}
                ({p.figures} figures, read {p.read_on}, <RecordLink rec={`lead:${p.lead_id}`}>lead</RecordLink>)
              </span>
            ))}
            .{" "}
          </>
        ) : (
          <>Every figure here is from a saved, checksummed document; only law texts marked ◐ were read online. </>
        )}
        Method {d.method}; figures from DABS, the state reports and the Pennsylvania audits are hand transcriptions not yet reviewed by a person. Defined in {d.config_file} and
        src/alcohol_data/fiscal_bridge.py.
      </p>
    </section>
  );
}

const BASIS_ORDER: BasisId[] = ["statutory", "combined_transfer", "printed_lines", "school_only"];

/** FY2024: the residual on every accounting basis for the deposits, each term opening its record or rate. */
function BasesTable({ bases }: { bases: NonNullable<Reconciliation["fy2024"]["bases"]> }) {
  const term = (t: BasisRow["deposits"][number]) =>
    t.rec ? (
      <RecordLink rec={t.rec}>{thousands(t.value)}</RecordLink>
    ) : (
      <>
        {thousands(t.value)} <span className="muted">({ratePct(t.rate ?? 0)} × sales)</span>
      </>
    );
  return (
    <div className="table-wrap">
      <table className="data recon-table">
        <caption className="small">{bases.equation} Thousands of dollars.</caption>
        <thead>
          <tr>
            <th scope="col">Deposits taken as</th>
            <th scope="col" className="num">
              DABS sales
            </th>
            <th scope="col" className="num">
              Deposits subtracted
            </th>
            <th scope="col" className="num">
              Census receipts
            </th>
            <th scope="col" className="num">
              Left over
            </th>
            <th scope="col">Standing</th>
          </tr>
        </thead>
        <tbody>
          {BASIS_ORDER.flatMap((b) => {
            const rows = bases.rows.filter((r) => r.basis === b);
            const t = bases.texts[b];
            return rows.map((r, i) => (
              <tr key={`${b}:${r.sales.value}`}>
                {i === 0 && (
                  <th scope="rowgroup" rowSpan={rows.length}>
                    {t.label}
                  </th>
                )}
                <td className="num">
                  <RecordLink rec={r.sales.rec}>{thousands(r.sales.value)}</RecordLink>
                </td>
                <td className="num">
                  {r.deposits.map((x, j) => (
                    <span key={j}>
                      {j ? " + " : ""}
                      {term(x)}
                    </span>
                  ))}
                </td>
                <td className="num">
                  <RecordLink rec={r.census.rec}>{thousands(r.census.value)}</RecordLink>
                </td>
                <td className="num">
                  <strong>{thousands(r.residual)}</strong>
                </td>
                {i === 0 && (
                  <td className="small" rowSpan={rows.length}>
                    {t.status ? <StatusChip status={t.status} /> : <span className="badge ev">superseded</span>} {t.text}
                  </td>
                )}
              </tr>
            ));
          })}
        </tbody>
      </table>
    </div>
  );
}
