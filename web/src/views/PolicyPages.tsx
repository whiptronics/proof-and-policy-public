// The policy pages: other states, public health and safeguards, the proposed framework with its change matrix, and the
// hard questions. Their content is data (lib/framework.ts, lib/statutes.ts) that docs/ also renders, so the pages and the
// review copies say the same thing. One lazy module for all four.
import { useMemo } from "react";
import { Go } from "../components/common";
import { INDICATORS, PHASING, SAFEGUARDS, SAFEGUARD_STATUS_LABEL, STATE_CASES, STRENGTH_LABEL, businessImpacts, feeBurden, frameworkPoints, hardQuestions, type EvidenceStrength } from "../lib/framework";
import { defaultDesignsReport } from "../lib/policyDesigns";
import { LAW_SOURCES, STATUTE_ROWS, amendmentsFor, openQuestionsFor, type RowKind } from "../lib/statutes";
import type { View } from "../lib/url";

const STATUS_NOTE = "A proposal for review by qualified legal and fiscal experts: not enacted law, not legal advice, not attorney-reviewed. Written with AI assistance and not reviewed by a person.";
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const usd0 = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;

/** An internal "?v=..." link or an external URL. */
function Ref({ url, children }: { url: string; children: string }) {
  if (url.startsWith("?v=")) return <Go to={{ v: url.slice(3) as View }} reset>{children}</Go>;
  return (
    <a href={url} rel="noopener">
      {children}
    </a>
  );
}

const STRENGTH_CLASS: Record<EvidenceStrength, string> = {
  causal_estimate: "tag",
  descriptive: "tag",
  legal_text: "tag",
  press_report: "tag tag-assumption",
  industry_commissioned: "tag tag-assumption",
  not_read: "tag tag-assumption",
};

function StatesPage() {
  return (
    <>
      <section className="panel" aria-labelledby="ps-h">
        <h2 id="ps-h">What happened in other states?</h2>
        <p className="lede">
          Three states that let stores sell wine, and how other control states split wholesale from retail. Every finding is labeled by the strength
          of its evidence; none was chosen for a favorable trend.
        </p>
        <details>
          <summary>Why a before-and-after comparison is not an experiment</summary>
          <p className="small">
            A state that changes its law is not chosen at random, and prices, tastes, other laws and the economy change at the same time. Comparing a
            state with itself, or with its neighbors, shows what happened, not what the law caused. Synthetic-control methods build a weighted mix of
            other states that tracked the treated state beforehand; they are stronger than a raw comparison but still rest on that mix being a fair
            stand-in.
          </p>
        </details>
        <div className="table-wrap">
          <table className="data">
            <caption>When each change took effect</caption>
            <thead>
              <tr>
                <th scope="col">State</th>
                <th scope="col">Change</th>
                <th scope="col">Date</th>
                <th scope="col">Strongest evidence read</th>
              </tr>
            </thead>
            <tbody>
              {STATE_CASES.map((c) => (
                <tr key={c.id}>
                  <th scope="row">
                    <a href={`#ps-${c.id}`}>{c.state}</a>
                  </th>
                  <td>{c.change}</td>
                  <td>{c.date}</td>
                  <td>{STRENGTH_LABEL[c.evidence[0].strength]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {STATE_CASES.map((c) => (
        <section key={c.id} className="panel" aria-labelledby={`ps-${c.id}`}>
          <h2 id={`ps-${c.id}`}>
            {c.state}: {c.change}
          </h2>
          <p className="small muted">{c.date}</p>
          <p>{c.legal}</p>
          <ul className="findings">
            {c.evidence.map((e) => (
              <li key={e.label}>
                <span className={STRENGTH_CLASS[e.strength]}>{STRENGTH_LABEL[e.strength]}</span> <Ref url={e.url}>{e.label}</Ref>. {e.text}{" "}
                <span className="small muted">({e.source})</span>
              </li>
            ))}
          </ul>
          <p>
            <strong>At the same time.</strong> {c.concurrent}
          </p>
          <p>
            <strong>For Utah.</strong> {c.applies}
          </p>
          {c.id === "tn" && (
            <Go to={{ v: "case" }} reset className="button">
              Tennessee before and after, with its comparison states
            </Go>
          )}
        </section>
      ))}
    </>
  );
}

function SafeguardsPage() {
  const r = useMemo(() => defaultDesignsReport(), []);
  const premium = r.results.find((x) => x.def.id === "B")!.premium;
  return (
    <>
      <section className="panel" aria-labelledby="sg-h">
        <h2 id="sg-h">Public health and safeguards</h2>
        <p className="lede">More places selling wine is not harmless. What the research says, what Utah already requires for beer, and how to tell whether it works.</p>
        <ul className="findings">
          <li>
            <strong>Outlet density.</strong> The Community Preventive Services Task Force recommends using licensing and zoning to limit alcohol outlet
            density (sufficient evidence, 2007): policies that increased density were associated with more excessive drinking and related harms.{" "}
            <a href="https://thecommunityguide.cdc.gov/findings/alcohol-excessive-consumption-regulation-alcohol-outlet-density.html" rel="noopener">
              Finding
            </a>
          </li>
          <li>
            <strong>Privatization.</strong> It recommends against further privatization of retail alcohol sales where government controls them (strong
            evidence that per capita consumption rises, 2011). Grocery wine privatizes part of wine retail.{" "}
            <a href="https://thecommunityguide.cdc.gov/findings/alcohol-excessive-consumption-privatization-retail-alcohol-sales.html" rel="noopener">
              Finding
            </a>
          </li>
          <li>
            <strong>Price.</strong> Grocery prices about {pct(premium)} above state stores under DABS wholesale would damp the effect of easier access; by
            how much is not measured.
          </li>
        </ul>
      </section>
      <section className="panel" aria-labelledby="sg-t">
        <h2 id="sg-t">Safeguards, checked against current law</h2>
        <p className="small muted">Read from the Utah Code on 2026-11-19 before calling anything new.</p>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th scope="col">Safeguard</th>
                <th scope="col">Off-premise beer today</th>
                <th scope="col">Status</th>
                <th scope="col">For wine</th>
              </tr>
            </thead>
            <tbody>
              {SAFEGUARDS.map((s) => (
                <tr key={s.name}>
                  <th scope="row">{s.name}</th>
                  <td>
                    {s.today} <span className="small muted">{s.cite}</span>
                  </td>
                  <td>
                    <span className={s.status === "new" ? "tag tag-assumption" : "tag"}>{SAFEGUARD_STATUS_LABEL[s.status]}</span>
                  </td>
                  <td>{s.proposal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel" aria-labelledby="sg-m">
        <h2 id="sg-m">Monitoring and evaluation</h2>
        <ul className="findings">
          {INDICATORS.map((i) => (
            <li key={i.name}>
              <strong>{i.name}</strong> ({i.source}). {i.note}
            </li>
          ))}
        </ul>
        <p className="small">
          A change after the law starts does not show the law caused it. The indicators are for comparison with beer retailers, earlier years or other
          states, not for crediting or blaming the program.
        </p>
      </section>
    </>
  );
}

const KIND_LABEL: Record<RowKind, string> = { amendment: "change", unresolved: "open", current_law: "none" };

function FrameworkPage() {
  const r = useMemo(() => defaultDesignsReport(), []);
  const points = frameworkPoints(r);
  return (
    <>
      <section className="panel" aria-labelledby="fw-h">
        <h2 id="fw-h">Proposed Utah framework</h2>
        <p className="lede">
          None of the four alternatives meets every constraint, so the framework builds on the best-supported one, DABS wholesale, and says what
          would have to be true for it to work.
        </p>
        <p className="small muted">{STATUS_NOTE}</p>
        <ol className="findings">
          {points.map((p) => (
            <li key={p.n}>
              <strong>{p.title}.</strong> {p.proposal} <span className="small muted">Basis: {p.basis}.</span>
            </li>
          ))}
        </ol>
        <h3>Phased implementation</h3>
        <ul className="findings">
          {PHASING.options.map((o) => (
            <li key={o.name}>
              <strong>{o.name}.</strong> {o.benefit} Cost: {o.cost}
            </li>
          ))}
        </ul>
        <p>{PHASING.verdict}</p>
        <h3>What would need to change</h3>
        <ul className="findings">
          {r.selected.whatWouldNeedToChange.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      </section>
      <section className="panel" aria-labelledby="fw-m">
        <h2 id="fw-m">Statutory change matrix</h2>
        <p className="small">
          <em>Change</em>: the bill must change or decide it. <em>Open</em>: a legal question the text read does not answer. <em>None</em>: current law
          already works. Counts: B {amendmentsFor("B").length} changes and {openQuestionsFor("B").length} open; C {amendmentsFor("C").length} and{" "}
          {openQuestionsFor("C").length}; D {amendmentsFor("D").length} and {openQuestionsFor("D").length}; E {amendmentsFor("E").length} and{" "}
          {openQuestionsFor("E").length}.
        </p>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th scope="col">Row</th>
                <th scope="col">Provision</th>
                <th scope="col">Current effect</th>
                <th scope="col">Proposed change</th>
                <th scope="col">B</th>
                <th scope="col">C</th>
                <th scope="col">D</th>
                <th scope="col">E</th>
              </tr>
            </thead>
            <tbody>
              {STATUTE_ROWS.map((x) => (
                <tr key={x.id}>
                  <th scope="row">{x.id}</th>
                  <td>
                    {x.provision} <span className="small muted">{x.cite}</span>
                  </td>
                  <td>{x.effect}</td>
                  <td>{x.change}</td>
                  {(["B", "C", "D", "E"] as const).map((d) => (
                    <td key={d}>{x.by[d] ? KIND_LABEL[x.by[d]!] : "—"}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <details>
          <summary>Sources read</summary>
          <ul className="small source-list">
            {LAW_SOURCES.map((s) => (
              <li key={s.id}>
                <a href={s.url} rel="noopener">
                  {s.title}
                </a>
                , {s.version}; read {s.read}
                {s.sha16 ? `; SHA-256 ${s.sha16}…` : ""}
              </li>
            ))}
          </ul>
        </details>
      </section>
      <section className="panel" aria-labelledby="fw-b">
        <h2 id="fw-b">Economic and business impacts</h2>
        <ul className="findings">
          {businessImpacts(r).map((i) => (
            <li key={i.who}>
              <strong>{i.who}</strong> <span className="tag">{i.evidence}</span> {i.effect}
            </li>
          ))}
        </ul>
        <div className="table-wrap">
          <table className="data">
            <caption>A flat fee covering the administration, against stores' wine gross margin (DABS wholesale, 30% of household purchases moving)</caption>
            <thead>
              <tr>
                <th scope="col">Store</th>
                <th scope="col" className="num">
                  Wine gross margin a year
                </th>
                <th scope="col" className="num">
                  Fee share
                </th>
              </tr>
            </thead>
            <tbody>
              {feeBurden(r).map((f) => (
                <tr key={f.label}>
                  <th scope="row">{f.label}</th>
                  <td className="num">{usd0(f.grossMargin)}</td>
                  <td className="num">{pct(f.feeShare)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted">Before stores' own costs: shelf space, inventory, shrinkage and compliance are not measured.</p>
      </section>
    </>
  );
}

function QuestionsPage() {
  const qs = useMemo(() => hardQuestions(defaultDesignsReport()), []);
  return (
    <section className="panel" aria-labelledby="hq-h">
      <h2 id="hq-h">Hard questions</h2>
      <p className="lede">Direct answers, including where the answer depends on the design and what would undermine the case.</p>
      <ol className="findings">
        {qs.map((q) => (
          <li key={q.q}>
            <h3>{q.q}</h3>
            <p>
              {q.a} <Ref url={q.see}>The basis</Ref>
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function PolicyPages({ view }: { view: "states" | "safeguards" | "framework" | "questions" }) {
  if (view === "states") return <StatesPage />;
  if (view === "safeguards") return <SafeguardsPage />;
  if (view === "framework") return <FrameworkPage />;
  return <QuestionsPage />;
}
