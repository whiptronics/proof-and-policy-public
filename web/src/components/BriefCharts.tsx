// The Utah briefing's charts (data from lib/briefing.ts), drawn as SVG at the width they are given: the revenue bridge
// (also used, without connectors, for the what-if bars) and the split of a $100 purchase. Colors are tokens
// (styles.css, .chart); meaning is always also in words on the chart: signs on every value, labels on every row, and
// patterns for cost items and taxes.
import { useId } from "react";
import type { BridgeStep, FlowColumn } from "../lib/briefing";

export const millions = (v: number, sign = true) => `${v < 0 ? "−" : sign && v > 0 ? "+" : ""}$${(Math.abs(v) / 1e6).toFixed(1)}M`;
const dollars = (v: number) => `$${v.toFixed(2)}`;

function niceStep(span: number, count: number): number {
  const raw = span / Math.max(1, count);
  const p = 10 ** Math.floor(Math.log10(raw));
  const n = raw / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

function ticks(lo: number, hi: number, count: number): number[] {
  const step = niceStep(hi - lo, count);
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.abs(v) < step / 1e6 ? 0 : v);
  return out;
}

/** Words into lines of at most `max` characters (an approximation of width that holds for these fonts). */
export function wrapWords(text: string, max: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const w of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${w}` : w;
    if (next.length > max && line) {
      out.push(line);
      line = w;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

/** A tick label centered on its tick unless that would cut it off at either edge (about 6.5px a character). */
function tickAnchor(at: number, text: string, width: number): "start" | "middle" | "end" {
  const half = (text.length * 6.5) / 2;
  return at - half < 1 ? "start" : at + half > width - 1 ? "end" : "middle";
}

/** Hatching for cost items and taxes: the pattern carries the meaning a color alone would not. */
function Hatch({ id, cls }: { id: string; cls: string }) {
  return (
    <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="6" height="6" className={cls} />
      <line x1="0" y1="0" x2="0" y2="6" className="hatch-line" strokeWidth="2.2" />
    </pattern>
  );
}

const W_BREAK = 560;

/** Placement of a value label at a bar: inside when it fits, else outside on the roomier side. */
function labelAt(x0: number, x1: number, text: string, left: number, right: number, inside: boolean) {
  const need = text.length * 7.2 + 10;
  if (inside && x1 - x0 >= need) return { x: (x0 + x1) / 2, anchor: "middle" as const, inside: true };
  const roomR = right - x1;
  const roomL = x0 - left;
  return roomR >= need || roomR >= roomL ? { x: x1 + 6, anchor: "start" as const, inside: false } : { x: x0 - 6, anchor: "end" as const, inside: false };
}

/** `connect` draws the line from each bar's end to the next bar: on for a running total, off for bars that are
 * alternatives drawn from zero. */
export function BridgeChart({ steps, width, label, connect = true }: { steps: BridgeStep[]; width: number; label: string; connect?: boolean }) {
  const uid = useId().replace(/:/g, "");
  const wide = width >= W_BREAK;
  const labelW = wide ? Math.min(250, Math.round(width * 0.36)) : 0;
  const padL = wide ? labelW + 12 : 8;
  const padR = 12;
  const rowH = wide ? 38 : 56;
  const barH = 22;
  const top = 8;
  const H = top + steps.length * rowH + 30;
  const vals = [0, ...steps.flatMap((s) => [s.from, s.to])];
  const span = Math.max(...vals) - Math.min(...vals) || 1;
  const lo = Math.min(...vals) - span * 0.2;
  const hi = Math.max(...vals) + span * 0.2;
  const x = (v: number) => padL + ((v - lo) / (hi - lo)) * (width - padL - padR);
  const barY = (i: number) => top + i * rowH + (wide ? (rowH - barH) / 2 : 22);
  const fillOf = (s: BridgeStep) => {
    if (s.kind === "subtotal" || s.kind === "total") return { className: "b-total" };
    const dir = s.value < 0 ? "loss" : "gain";
    return s.kind === "cost" ? { style: { fill: `url(#${uid}-${dir})` } } : { className: `b-${dir}` };
  };
  return (
    <svg className="chart" width={width} height={H} viewBox={`0 0 ${width} ${H}`} role="img" aria-label={label}>
      <title>{label}</title>
      <defs>
        <Hatch id={`${uid}-loss`} cls="b-loss" />
        <Hatch id={`${uid}-gain`} cls="b-gain" />
      </defs>
      {ticks(lo, hi, wide ? 6 : 4).map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={top} y2={H - 26} className={t === 0 ? "axis-zero" : "grid"} />
          <text x={x(t)} y={H - 10} textAnchor={tickAnchor(x(t), t === 0 ? "$0" : millions(t), width)} className="tick">
            {t === 0 ? "$0" : millions(t)}
          </text>
        </g>
      ))}
      {steps.map((s, i) => {
        const y = barY(i);
        const x0 = x(Math.min(s.from, s.to));
        const x1 = x(Math.max(s.from, s.to));
        const zero = x1 - x0 < 1.5;
        const text = zero ? "no change" : millions(s.value);
        const total = s.kind === "subtotal" || s.kind === "total";
        const at = labelAt(x0, x1, text, padL, width - padR, !zero && s.kind !== "cost");
        const next = steps[i + 1];
        const words = wrapWords(s.label, Math.max(12, Math.floor((wide ? labelW : width - 16) / 7)));
        const ly = wide ? y + barH / 2 + 4.5 - ((words.length - 1) * 15) / 2 : y - 7 - (words.length - 1) * 15;
        return (
          <g key={s.id}>
            <text x={wide ? labelW : padL} y={ly} textAnchor={wide ? "end" : "start"} className={total ? "row-label strong" : "row-label"}>
              {words.map((l, k) => (
                <tspan key={k} x={wide ? labelW : padL} dy={k === 0 ? 0 : 15}>
                  {l}
                </tspan>
              ))}
            </text>
            {zero ? <line x1={x0} x2={x0} y1={y} y2={y + barH} className="axis-zero" strokeWidth={3} /> : <rect x={x0} y={y} width={x1 - x0} height={barH} rx={2} {...fillOf(s)} />}
            <text x={at.x} y={y + barH / 2 + 4.5} textAnchor={at.anchor} className={at.inside ? "bar-value inside" : total ? "bar-value strong" : "bar-value"}>
              {text}
            </text>
            {connect && next && <line x1={x(s.to)} x2={x(s.to)} y1={y + barH} y2={barY(i + 1)} className="connector" />}
          </g>
        );
      })}
    </svg>
  );
}

const SEG_CLASS: Record<string, string> = {
  supplier: "s-supplier",
  dabs_margin: "s-state",
  state_charge: "s-state",
  sales_tax: "s-tax",
  wholesaler: "s-wholesaler",
  grocer: "s-grocer",
};

export function SplitChart({ cols, width, label }: { cols: FlowColumn[]; width: number; label: string }) {
  const uid = useId().replace(/:/g, "");
  const padL = 8;
  const padR = 8;
  const barH = 28;
  const max = Math.max(...cols.map((c) => c.consumer));
  const x = (v: number) => padL + (v / max) * (width - padL - padR);
  const hatched = (id: string) => id === "state_charge" || id === "sales_tax";
  // Labels and notes wrap to the drawn width (about 7.5px a character at 13px), so a phone never cuts them off.
  const fit = Math.max(16, Math.floor((width - padL - padR) / 7.5));
  const rows = cols.map((c) => {
    const parts = [
      `State ${dollars(c.state)}`,
      `sellers ${dollars(c.segments.filter((s) => s.to === "sellers").reduce((t, s) => t + s.amount, 0))}`,
      `supplier ${dollars(c.segments.find((s) => s.to === "supplier")?.amount ?? 0)}`,
      `shopper pays ${dollars(c.consumer)}`,
    ];
    const note: string[] = [];
    for (const p of parts) {
      const last = note.length - 1;
      // Notes are 11.5px, about 6.8px a character.
      if (last >= 0 && `${note[last]} · ${p}`.length * 6.8 <= width - padL - padR) note[last] += ` · ${p}`;
      else note.push(p);
    }
    const title = wrapWords(c.label, fit);
    const law = wrapWords(c.law, Math.floor((width - padL - padR) / 6.8));
    return { title, note, law, h: title.length * 16 + barH + note.length * 15 + law.length * 15 + 26 };
  });
  const offsets = rows.map((_, i) => rows.slice(0, i).reduce((t, r) => t + r.h, 0));
  const H = rows.reduce((t, r) => t + r.h, 0) + 4;
  return (
    <svg className="chart" width={width} height={H} viewBox={`0 0 ${width} ${H}`} role="img" aria-label={label}>
      <title>{label}</title>
      <defs>
        <Hatch id={`${uid}-s-state`} cls="s-state" />
        <Hatch id={`${uid}-s-tax`} cls="s-tax" />
      </defs>
      {cols.map((c, i) => {
        const r = rows[i];
        const y0 = offsets[i] + r.title.length * 16 + 4;
        const ny = y0 + barH + 17;
        let at = 0;
        return (
          <g key={c.id}>
            <text x={padL} y={offsets[i] + 14} className="row-label strong">
              {r.title.map((l, k) => (
                <tspan key={k} x={padL} dy={k === 0 ? 0 : 16}>
                  {l}
                </tspan>
              ))}
            </text>
            {c.segments.map((s) => {
              const a = x(at);
              at += s.amount;
              const b = x(at);
              const cls = SEG_CLASS[s.id] ?? "s-supplier";
              const fill = hatched(s.id) ? { style: { fill: `url(#${uid}-${cls})` } } : { className: cls };
              const t = dollars(s.amount);
              return (
                <g key={s.id}>
                  <rect x={a} y={y0} width={Math.max(0, b - a - 1.5)} height={barH} {...fill}>
                    <title>{`${s.label}: ${t}`}</title>
                  </rect>
                  {b - a >= t.length * 7.4 + 8 && (
                    <text x={(a + b) / 2} y={y0 + barH / 2 + 4.5} textAnchor="middle" className={`seg-label ${cls}`}>
                      {t}
                    </text>
                  )}
                </g>
              );
            })}
            <text x={padL} y={ny} className="row-note">
              {r.note.map((l, k) => (
                <tspan key={k} x={padL} dy={k === 0 ? 0 : 15}>
                  {l}
                </tspan>
              ))}
            </text>
            <text x={padL} y={ny + r.note.length * 15 + 1} className="row-note muted">
              {r.law.map((l, k) => (
                <tspan key={k} x={padL} dy={k === 0 ? 0 : 15}>
                  {l}
                </tspan>
              ))}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function SplitLegend() {
  const items: [string, string, string][] = [
    ["s-supplier", "", "Supplier: the cost of the wine"],
    ["s-state", "", "State: DABS markup income (before DABS's operating costs; not profit)"],
    ["s-state", "hatched", "State: charge on grocery wine (private design)"],
    ["s-tax", "hatched", "State: sales tax, paid on top of the shelf price"],
    ["s-wholesaler", "", "Private wholesaler's gross margin"],
    ["s-grocer", "", "Grocer's gross margin"],
  ];
  return (
    <ul className="chart-legend small">
      {items.map(([cls, h, text]) => (
        <li key={text}>
          <span className={`swatch-box ${cls} ${h}`} aria-hidden="true" />
          {text}
        </li>
      ))}
    </ul>
  );
}
