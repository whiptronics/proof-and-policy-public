// Evidence classes (lib/evidence.ts) on the page: a badge that carries a symbol and a word (never color alone), a key,
// and the worked example's assumption register, which says for each input where it comes from, whether a person has
// reviewed it, and how far its tested range moves the result.
import { EVIDENCE, EVIDENCE_ORDER, REVIEW_STATUS, type EvidenceClass } from "../lib/evidence";
import type { Initiative, InitiativeFigures } from "../lib/initiatives";

const millions = (v: number) => `${v < 0 ? "−" : v > 0 ? "+" : ""}$${(Math.abs(v) / 1e6).toFixed(1)}M`;

export function EvidenceBadge({ cls }: { cls: EvidenceClass }) {
  const e = EVIDENCE[cls];
  return (
    <span className={`ev ev-${cls}`} title={e.help}>
      <span className="ev-sym" aria-hidden="true">
        {e.symbol}
      </span>
      {e.label}
    </span>
  );
}

export function EvidenceKey({ only }: { only?: EvidenceClass[] }) {
  return (
    <dl className="ev-key small">
      {EVIDENCE_ORDER.filter((c) => !only || only.includes(c)).map((c) => (
        <div key={c}>
          <dt>
            <EvidenceBadge cls={c} />
          </dt>
          <dd>{EVIDENCE[c].help}</dd>
        </div>
      ))}
    </dl>
  );
}

export function AssumptionRegister({ init, f }: { init: Initiative; f: InitiativeFigures }) {
  const rows = init.worked.assumptions;
  const used = [...new Set(rows.map((a) => a.basis))];
  return (
    <>
      <div className="table-wrap">
        <table className="data register">
          <caption className="visually-hidden">Inputs of the worked example, what each rests on, and how far its tested range moves the net change</caption>
          <thead>
            <tr>
              <th scope="col">Input</th>
              <th scope="col">Value, definition and source</th>
              <th scope="col">What it rests on</th>
              <th scope="col">Net change across its tested range</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const r = a.range ? f.robustness.rows.find((x) => x.id === a.range) : undefined;
              return (
                <tr key={a.item}>
                  <th scope="row">{a.item}</th>
                  <td>{a.value}</td>
                  <td>
                    <EvidenceBadge cls={a.basis} />
                    {(a.basis === "source" || a.basis === "calculated") && <div className="small muted">{REVIEW_STATUS}</div>}
                  </td>
                  <td className="small">
                    {r ? (
                      <>
                        Private {millions(Math.min(r.atLow.private, r.atHigh.private))} to {millions(Math.max(r.atLow.private, r.atHigh.private))}; DABS{" "}
                        {millions(Math.min(r.atLow.wholesale, r.atHigh.wholesale))} to {millions(Math.max(r.atLow.wholesale, r.atHigh.wholesale))}
                      </>
                    ) : a.basis === "policy" ? (
                      "A lever, not tested as a range: see the policy alternatives"
                    ) : (
                      "Not tested as a range"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <EvidenceKey only={used} />
    </>
  );
}
