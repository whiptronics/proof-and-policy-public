// "How we know": the basis of a major figure, inline and closed by default (plan section 14's publication standard:
// inputs, assumptions, calculation, output, units and period, limits, and how to reproduce it).
import { Fragment } from "react";
export interface HowWeKnowProps {
  claim: string;
  inputs: string;
  assumptions: string;
  calculation: string;
  output: string;
  period: string;
  limits: string;
  reproduce: string;
}

export function HowWeKnow(p: HowWeKnowProps) {
  const rows: [string, string][] = [
    ["Source inputs", p.inputs],
    ["Assumptions", p.assumptions],
    ["Calculation", p.calculation],
    ["Result", p.output],
    ["Units and period", p.period],
    ["Limits", p.limits],
    ["Reproduce it", p.reproduce],
  ];
  return (
    <details className="how-we-know">
      <summary>How we know: {p.claim}</summary>
      <dl className="kv">
        {rows.map(([k, v]) => (
          <Fragment key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </Fragment>
        ))}
      </dl>
    </details>
  );
}
