// The grocery price premium x grocery share comparison on the initiative page (lib/winePriceShare.ts,
// PRICE_SHARE_METHOD). Every number on it comes from priceShareReport(), the same report the graph export writes, so
// the page, the CSVs and the charts cannot disagree.
import { useMemo, useState } from "react";
import { colorFor, gradientStops, inkFor, type Domain } from "../lib/mapdata";
import { COST_LINES, ELASTICITY, RETAILER_TARGET, WHOLESALER_MARGIN } from "../lib/wineAlternatives";
import {
  AXES,
  GRID_ARRANGEMENTS,
  POSITION_WORDS,
  PREMIUMS,
  PREMIUM_SEARCH_MAX,
  PRICE_SHARE_METHOD,
  ROLES,
  SHARES,
  WORKED_SHARE,
  priceShareReport,
  type GridArrangement,
  type GridCell,
  type PriceShareReport,
  type SavingsCase,
  type SellerPosition,
  type VolumeBasis,
} from "../lib/winePriceShare";

const pct = (v: number | null | undefined, d = 1) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : `${v < 0 ? "−" : ""}${Math.abs(v * 100).toFixed(d)}%`);
/** $ millions to one decimal, or two under $0.095M, so a small loss or gain never reads as "−0.0" or "+0.0". */
const mDigits = (v: number) => (Math.abs(v) / 1e6 < 0.095 ? 2 : 1);
/** $ millions with a sign, no unit (the table and chart say "$M a year"). */
const m1 = (v: number) => `${v < 0 ? "−" : "+"}${(Math.abs(v) / 1e6).toFixed(mDigits(v))}`;
const money = (v: number) => `${v < 0 ? "−" : "+"}$${(Math.abs(v) / 1e6).toFixed(mDigits(v))}M`;
const dollars = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;
const cents = (v: number) => `${(v * 100).toFixed(2)}¢`;

const SHORT_POSITION: Record<SellerPosition, string> = {
  below_cost: "below cost",
  at_cost: "at cost",
  below_reference: "under 28%",
  reference_or_above: "28% or more",
  not_split: "not split",
};

function find(rep: PriceShareReport, a: GridArrangement, p: number, s: number, sv: SavingsCase, vb: VolumeBasis): GridCell {
  return rep.cells.find((k) => k.arrangement === a.id && Math.abs(k.premium - p) < 1e-12 && k.share === s && k.savings === sv && k.volume === vb)!;
}
const priceAt = (rep: PriceShareReport, a: GridArrangement, p: number) => rep.prices.find((k) => k.arrangement === a.id && Math.abs(k.premium - p) < 1e-12)!;
const breakEvenAt = (rep: PriceShareReport, a: GridArrangement, p: number, sv: SavingsCase, vb: VolumeBasis) =>
  rep.shareBreakEvens.find((b) => b.arrangement === a.id && Math.abs(b.premium - p) < 1e-12 && b.savings === sv && b.volume === vb)!;
const markersOf = (rep: PriceShareReport, a: GridArrangement) => rep.markers.find((k) => k.arrangement === a.id)!;
const rangesOf = (rep: PriceShareReport, a: GridArrangement, sv: SavingsCase, vb: VolumeBasis) => rep.preserved.find((k) => k.arrangement === a.id && k.savings === sv && k.volume === vb)!.ranges;

function breakEvenWords(rep: PriceShareReport, a: GridArrangement, p: number, sv: SavingsCase, vb: VolumeBasis): string {
  const b = breakEvenAt(rep, a, p, sv, vb);
  if (b.status === "never") return "none";
  if (b.status === "not_reachable") return b.share === null ? "none ≤100%" : `${pct(b.share, 0)}`;
  return pct(b.share, 0);
}

/** The premiums that keep receipts whole at 30%, in words, with the grocer's margin at the start of each range. */
function rangeWords(rep: PriceShareReport, a: GridArrangement, sv: SavingsCase, vb: VolumeBasis): string {
  const rs = rangesOf(rep, a, sv, vb);
  if (!rs.length) return `at no premium up to ${pct(PREMIUM_SEARCH_MAX, 0)}`;
  return rs
    .map((r) => {
      const span = r.to === null ? (r.from === 0 ? `at every premium from 0% to ${pct(PREMIUM_SEARCH_MAX, 0)}` : `from a ${pct(r.from)} premium`) : `from ${r.from === 0 ? "0%" : `a ${pct(r.from)} premium`} to ${pct(r.to)}`;
      const g = r.fromPoint;
      const at = `the grocer's gross margin is ${pct(g.grocerMargin)}${a.supply === "private" ? ` after the wholesaler's assumed ${pct(WHOLESALER_MARGIN)}` : ""} (${POSITION_WORDS[g.position]})`;
      const end = r.toPoint ? `, ${pct(r.toPoint.grocerMargin)} at the upper end` : "";
      return `${span}; at ${r.from === 0 ? "0%" : "the start"} ${at}${end}`;
    })
    .join("; ");
}

// ----- the heatmap -------------------------------------------------------------------------------------------------------

const CW = 44;
const RH = 30;
const L = 58;
const T = 26;
const PLOT_W = CW * PREMIUMS.length;
const PLOT_H = RH * SHARES.length;
const VB_W = L + PLOT_W + 12;
const VB_H = T + PLOT_H + 46;
const STEP = PREMIUMS[1] - PREMIUMS[0];
const SHARE_STEP = SHARES[1] - SHARES[0];
const xOf = (p: number) => L + (p / STEP + 0.5) * CW;
const yOf = (s: number) => T + PLOT_H - (s / SHARE_STEP + 0.5) * RH;
const clampX = (x: number) => Math.min(L + PLOT_W, Math.max(L, x));
/** Lines drawn over the cells, and their outline: fixed in both themes because the cell colours are. */
const CELL_INK = "#111111";
const CELL_HALO = "#ffffff";

function GridChart({ rep, a, domain, refs }: { rep: PriceShareReport; a: GridArrangement; domain: Domain; refs: { n: number; premium: number; share: number; label: string }[] }) {
  const mk = markersOf(rep, a);
  const contour = PREMIUMS.map((p) => {
    const b = breakEvenAt(rep, a, p, "source_based", "fixed_volume");
    return b.status === "within_grid" || b.status === "beyond_grid" ? { x: xOf(p), y: Math.max(T, yOf(b.share!)) } : null;
  });
  const segments: { x: number; y: number }[][] = [];
  let cur: { x: number; y: number }[] = [];
  for (const c of contour) {
    if (c) cur.push(c);
    else if (cur.length) {
      segments.push(cur);
      cur = [];
    }
  }
  if (cur.length) segments.push(cur);
  // Hatched only where a grid premium is below the grocer's acquisition cost; at exactly 0 the grocer is at cost, not below.
  const cost = mk.grocerCost !== null && mk.grocerCost > 1e-9 ? clampX(xOf(mk.grocerCost)) : null;
  const ref = mk.reference !== null && mk.reference >= -STEP / 2 && mk.reference <= PREMIUMS[PREMIUMS.length - 1] + STEP / 2 ? xOf(mk.reference) : null;
  const pid = `ps-hatch-${a.id}`;
  // The cell colours are the same in both themes (light near zero), so the lines over them use a fixed dark ink with a
  // white outline, never the page's text colour, which is light in dark mode and vanished on pale cells.
  return (
    <svg className="ps-chart" viewBox={`0 0 ${VB_W} ${VB_H}`} role="img" aria-labelledby={`ps-ct-${a.id}`}>
      <title id={`ps-ct-${a.id}`}>
        {`${a.label}: state annual change, $M, by grocery price premium and share of household purchases moving (fixed volume, source-based savings). The line marks where the state breaks even.`}
      </title>
      <defs>
        <pattern id={pid} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="7" stroke={CELL_INK} strokeWidth="1.3" strokeOpacity="0.55" />
        </pattern>
      </defs>
      {PREMIUMS.map((p, i) =>
        SHARES.map((s, j) => {
          const k = find(rep, a, p, s, "source_based", "fixed_volume");
          const fill = colorFor(k.net, domain);
          const pt = priceAt(rep, a, p);
          return (
            <g key={`${i}-${j}`}>
              <rect x={L + i * CW + 1} y={T + (SHARES.length - 1 - j) * RH + 1} width={CW - 2} height={RH - 2} rx="2" fill={fill}>
                <title>{`Premium ${pct(p, 0)}, ${pct(s, 0)} of household purchases moving: ${money(k.net)} a year (no avoidable savings: ${money(find(rep, a, p, s, "none", "fixed_volume").net)}). Grocer's gross margin ${pct(pt.grocerMargin)}, ${POSITION_WORDS[pt.position]}.`}</title>
              </rect>
            </g>
          );
        }),
      )}
      {cost !== null && cost > L && (
        <g>
          <rect x={L} y={T} width={cost - L} height={PLOT_H} fill={`url(#${pid})`} />
          <text x={L + 2} y={T - 6} fontSize="10" fill="var(--text)">
            grocer below acquisition cost
          </text>
        </g>
      )}
      {ref !== null && (
        <g>
          <line x1={ref} x2={ref} y1={T - 2} y2={T + PLOT_H} stroke={CELL_HALO} strokeWidth="3.5" />
          <line x1={ref} x2={ref} y1={T - 2} y2={T + PLOT_H} stroke={CELL_INK} strokeWidth="1.5" strokeDasharray="5 3" />
          <text x={ref + 3} y={T - 6} fontSize="10" fill="var(--text)">
            grocer {pct(RETAILER_TARGET, 0)}
          </text>
        </g>
      )}
      {segments.map((seg, i) => (
        <g key={i}>
          <polyline points={seg.map((c) => `${c.x},${c.y}`).join(" ")} fill="none" stroke={CELL_HALO} strokeWidth="5" strokeLinejoin="round" />
          <polyline points={seg.map((c) => `${c.x},${c.y}`).join(" ")} fill="none" stroke={CELL_INK} strokeWidth="2.5" strokeLinejoin="round" />
        </g>
      ))}
      {/* Values over the lines, each on a box of its own cell's colour: a line never strikes a number out, and a minus
          sign can never merge into a line that runs flat through the row. */}
      {PREMIUMS.map((p, i) =>
        SHARES.map((s, j) => {
          const k = find(rep, a, p, s, "source_based", "fixed_volume");
          const fill = colorFor(k.net, domain);
          const label = m1(k.net);
          const cx = L + i * CW + CW / 2;
          const cy = T + (SHARES.length - 1 - j) * RH + RH / 2;
          const w = label.length * 5.8 + 4;
          return (
            <g key={`t${i}-${j}`} aria-hidden="true">
              <rect x={cx - w / 2} y={cy - 7} width={w} height={14} fill={fill} />
              <text x={cx} y={cy + 3.5} textAnchor="middle" fontSize="10" fill={inkFor(fill)}>
                {label}
              </text>
            </g>
          );
        }),
      )}
      {/* Each existing alternative sits in the top of its row, above the cell values, at its own premium. */}
      {refs.map((r) => (
        <g key={r.n}>
          <circle cx={xOf(r.premium)} cy={yOf(r.share) - 9} r="5.5" fill="var(--surface)" stroke="var(--text)" strokeWidth="1.3" />
          <text x={xOf(r.premium)} y={yOf(r.share) - 6.2} textAnchor="middle" fontSize="8" fontWeight="700" fill="var(--text)">
            {r.n}
          </text>
          <title>{r.label}</title>
        </g>
      ))}
      {PREMIUMS.filter((_, i) => i % 2 === 0).map((p) => (
        <text key={p} x={xOf(p)} y={T + PLOT_H + 14} textAnchor="middle" fontSize="10" fill="var(--text-2)">
          {pct(p, 0)}
        </text>
      ))}
      {SHARES.map((s) => (
        <text key={s} x={L - 6} y={yOf(s) + 3.5} textAnchor="end" fontSize="10" fill="var(--text-2)">
          {pct(s, 0)}
        </text>
      ))}
      <text x={L + PLOT_W / 2} y={T + PLOT_H + 32} textAnchor="middle" fontSize="10.5" fill="var(--text)">
        Grocery price premium over the state store (consumer price, state sales tax included)
      </text>
      <text x={12} y={T + PLOT_H / 2} textAnchor="middle" fontSize="10.5" fill="var(--text)" transform={`rotate(-90 12 ${T + PLOT_H / 2})`}>
        Household purchases moving
      </text>
    </svg>
  );
}

// ----- the margin companion -------------------------------------------------------------------------------------------

const MH = 118;
const MT = 10;
const M_LO = -0.2;
const M_HI = 0.6;
const yM = (g: number) => MT + ((M_HI - Math.max(M_LO, Math.min(M_HI, g))) / (M_HI - M_LO)) * (MH - MT - 18);

function MarginChart({ rep, a }: { rep: PriceShareReport; a: GridArrangement }) {
  const pts = PREMIUMS.map((p) => ({ p, g: priceAt(rep, a, p).grocerMargin ?? 0 }));
  const pid = `ps-mhatch-${a.id}`;
  return (
    <svg className="ps-chart" viewBox={`0 0 ${VB_W} ${MH}`} role="img" aria-labelledby={`ps-mt-${a.id}`}>
      <title id={`ps-mt-${a.id}`}>{`${a.label}: the grocer's gross margin at each grocery price premium. It does not depend on the share that moves.`}</title>
      <defs>
        <pattern id={pid} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="7" stroke="var(--text)" strokeWidth="1.3" strokeOpacity="0.4" />
        </pattern>
      </defs>
      <rect x={L} y={yM(0)} width={PLOT_W} height={yM(M_LO) - yM(0)} fill={`url(#${pid})`} />
      <line x1={L} x2={L + PLOT_W} y1={yM(0)} y2={yM(0)} stroke="var(--text)" strokeWidth="1.2" />
      <line x1={L} x2={L + PLOT_W} y1={yM(RETAILER_TARGET)} y2={yM(RETAILER_TARGET)} stroke="var(--text)" strokeWidth="1.5" strokeDasharray="5 3" />
      {/* Top left, where no arrangement's line reaches: every line is under 40% up to a 30% premium, the label's extent. */}
      <text x={L + 4} y={yM(0.5)} fontSize="9.5" fill="var(--text-2)">
        Dashed: {pct(RETAILER_TARGET, 0)}, a national grocery reference (not a minimum)
      </text>
      <text x={L + PLOT_W - 2} y={yM(0) + 11} textAnchor="end" fontSize="9.5" fill="var(--text-2)">
        below acquisition cost
      </text>
      <polyline points={pts.map((q) => `${xOf(q.p)},${yM(q.g)}`).join(" ")} fill="none" stroke="var(--series-1)" strokeWidth="2" />
      {pts.map((q) => (
        <circle key={q.p} cx={xOf(q.p)} cy={yM(q.g)} r="4" fill="var(--series-1)" stroke="var(--surface)" strokeWidth="2">
          <title>{`Premium ${pct(q.p, 0)}: grocer's gross margin ${pct(q.g)}`}</title>
        </circle>
      ))}
      {[M_LO, 0, 0.2, 0.4, M_HI].map((g) => (
        <text key={g} x={L - 6} y={yM(g) + 3.5} textAnchor="end" fontSize="10" fill="var(--text-2)">
          {pct(g, 0)}
        </text>
      ))}
      {PREMIUMS.filter((_, i) => i % 2 === 0).map((p) => (
        <text key={p} x={xOf(p)} y={MH - 3} textAnchor="middle" fontSize="10" fill="var(--text-2)">
          {pct(p, 0)}
        </text>
      ))}
    </svg>
  );
}

function Legend({ domain }: { domain: Domain }) {
  const stops = gradientStops(domain, 9);
  return (
    <div className="ps-legend small">
      <span className="ps-scale">
        <span className="ps-bar" style={{ background: `linear-gradient(to right, ${stops.map((s) => `${s.color} ${s.offset * 100}%`).join(", ")})` }} aria-hidden="true" />
        <span className="ps-scale-labels">
          <span>{money(domain.min)}</span>
          <span>0</span>
          <span>{money(domain.max)}</span>
        </span>
      </span>
      <span>
        <svg width="26" height="10" aria-hidden="true">
          <line x1="0" y1="5" x2="26" y2="5" stroke={CELL_HALO} strokeWidth="5" />
          <line x1="0" y1="5" x2="26" y2="5" stroke={CELL_INK} strokeWidth="2.5" />
        </svg>{" "}
        state breaks even
      </span>
      <span>
        <svg width="26" height="10" aria-hidden="true">
          <line x1="13" y1="0" x2="13" y2="10" stroke={CELL_HALO} strokeWidth="3.5" />
          <line x1="13" y1="0" x2="13" y2="10" stroke={CELL_INK} strokeWidth="1.5" strokeDasharray="3 2" />
        </svg>{" "}
        grocer's margin reaches 28% (a reference, not a constraint)
      </span>
      <span>
        <svg width="16" height="12" aria-hidden="true">
          <rect width="16" height="12" fill="#f4f4f2" stroke="var(--text)" />
          <path d="M0,12 L12,0 M4,12 L16,0" stroke={CELL_INK} strokeOpacity="0.6" />
        </svg>{" "}
        grocer below acquisition cost
      </span>
      <span>
        <svg width="14" height="14" aria-hidden="true">
          <circle cx="7" cy="7" r="6" fill="var(--surface)" stroke="var(--text)" />
        </svg>{" "}
        existing alternative (numbered below)
      </span>
    </div>
  );
}

// ----- the numeric table ---------------------------------------------------------------------------------------------------

function GridTable({ rep, a }: { rep: PriceShareReport; a: GridArrangement }) {
  return (
    <div className="ps-table-block">
    {/* The description sits above the scrolling frame: inside it, a caption is laid out at the table's width and a phone
        cuts every line off. The caption itself stays, hidden, so the table keeps its name for screen readers. */}
    <p className="small ps-table-note">
      <strong>State annual change, $ millions a year (all state funds), at fixed volume.</strong> Each cell: <strong>with the source-based savings</strong>,
      and below it with no avoidable savings. Rows: share of covered household purchases moving. Columns: grocery price premium.
    </p>
    <div className="table-wrap">
      <table className="data initiative-table ps-table">
        <caption className="visually-hidden">{`${a.label}: state annual change by share moving and grocery price premium`}</caption>
        <thead>
          <tr>
            <th scope="col">Premium</th>
            {PREMIUMS.map((p) => (
              <th scope="col" key={p} className="num">
                {pct(p, 0)}
              </th>
            ))}
          </tr>
          <tr>
            <th scope="row" className="small">
              Grocer's gross margin
            </th>
            {PREMIUMS.map((p) => (
              <td key={p} className="num small">
                {pct(priceAt(rep, a, p).grocerMargin)}
              </td>
            ))}
          </tr>
          <tr>
            <th scope="row" className="small">
              Seller position
            </th>
            {PREMIUMS.map((p) => {
              const pos = priceAt(rep, a, p).position;
              return (
                <td key={p} className={`num small ps-pos-${pos}`}>
                  {SHORT_POSITION[pos]}
                </td>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {SHARES.map((s) => (
            <tr key={s} className={s === WORKED_SHARE ? "ps-worked" : undefined}>
              <th scope="row">
                {pct(s, 0)}
                {s === WORKED_SHARE && <span className="small muted"> (worked)</span>}
              </th>
              {PREMIUMS.map((p) => {
                const k = find(rep, a, p, s, "source_based", "fixed_volume");
                const z = find(rep, a, p, s, "none", "fixed_volume");
                return (
                  <td key={p} className={`num${priceAt(rep, a, p).position === "below_cost" ? " ps-belowcost" : ""}`}>
                    <strong>{m1(k.net)}</strong>
                    <span className="small muted ps-zero">{m1(z.net)}</span>
                  </td>
                );
              })}
            </tr>
          ))}
          <tr>
            <th scope="row" className="small">
              Break-even share, source-based savings
            </th>
            {PREMIUMS.map((p) => (
              <td key={p} className="num small">
                {breakEvenWords(rep, a, p, "source_based", "fixed_volume")}
              </td>
            ))}
          </tr>
          <tr>
            <th scope="row" className="small">
              Break-even share, no avoidable savings
            </th>
            {PREMIUMS.map((p) => (
              <td key={p} className="num small">
                {breakEvenWords(rep, a, p, "none", "fixed_volume")}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
    </div>
  );
}

// ----- the section -------------------------------------------------------------------------------------------------------

export function PriceShareSection() {
  const rep = useMemo(() => priceShareReport(), []);
  const [sel, setSel] = useState<GridArrangement["id"]>(GRID_ARRANGEMENTS[0].id);
  const domain: Domain = { min: -rep.colourLimit, max: rep.colourLimit, diverging: true };
  const at = (id: string) => GRID_ARRANGEMENTS.find((x) => x.id === id)!;
  const perTen = (id: string) => find(rep, at(id), 0.1, WORKED_SHARE, "source_based", "fixed_volume").net - find(rep, at(id), 0, WORKED_SHARE, "source_based", "fixed_volume").net;
  let n = 0;
  const refsByArr = new Map(
    GRID_ARRANGEMENTS.map((a) => [
      a.id,
      rep.references
        .filter((r) => r.arrangement === a.id)
        .map((r) => ({ n: ++n, premium: r.premium, share: r.share, label: `${n}. ${r.short}: ${pct(r.premium)} premium, ${pct(r.share, 0)} moving, ${money(r.net)} a year` })),
    ]),
  );
  const fundsWords = (a: GridArrangement) => {
    const k = find(rep, a, 0, WORKED_SHARE, "source_based", "fixed_volume");
    return a.supply === "dabs"
      ? `${money(k.funds)} if DABS's sales to grocers carry the deposits, ${money(k.fundsOtherReading ?? NaN)} if they do not`
      : money(k.funds);
  };
  const handling = rep.handlingCost === 0;
  return (
    <section className="panel ps" aria-labelledby="in-ps">
      <h3 id="in-ps">Grocery price and grocery share: what the state and sellers get</h3>
      <p>
        How do the state's annual fiscal change and what sellers keep vary with the grocery price premium and with the share of household wine purchases
        that moves to grocers? Each cell below is the scenario engine's result for one combination, with the policy's discount or charge held fixed. This
        is a <strong>conditional sensitivity analysis</strong>: not a forecast, the combinations carry no probabilities, and nothing here says shoppers
        would pay a premium or that any share would move at one.
      </p>
      <ul className="findings">
        <li>
          <strong>With no purchases moving the state is {money(-rep.newCosts).slice(1)} a year worse off in every arrangement:</strong> the new
          licensing and enforcement cost (U10, an illustration) is paid whatever moves.
        </li>
        <li>
          <strong>With DABS supplying at a fixed discount, a higher grocery price goes to the grocer.</strong> The state gains only the state sales tax on
          the premium: {money(perTen("dabs_0"))} a year per 10 points at {pct(WORKED_SHARE, 0)}. With a charge on the grocery price the state's take rises
          with the price: {money(perTen("private_20"))} ({at("private_20").short}) and {money(perTen("private_take"))} ({at("private_take").short}) per 10
          points.
        </li>
        <li>
          <strong>
            Which combinations keep state receipts whole at {pct(WORKED_SHARE, 0)}, at fixed volume with the source-based savings:
          </strong>{" "}
          {GRID_ARRANGEMENTS.map((a) => `${a.short}: ${rangeWords(rep, a, "source_based", "fixed_volume")}`).join(". ")}.
        </li>
        <li>
          <strong>With no avoidable savings:</strong> {GRID_ARRANGEMENTS.map((a) => `${a.short}: ${rangeWords(rep, a, "none", "fixed_volume")}`).join(". ")}.
        </li>
        <li>
          <strong>Exploratory, with the old price response:</strong>{" "}
          {GRID_ARRANGEMENTS.map((a) => `${a.short}: ${rangeWords(rep, a, "source_based", "price_response")}`).join(". ")}.
        </li>
      </ul>

      <h4>What is chosen, what is assumed and what follows</h4>
      <p className="small">
        Price, the grocer's margin, DABS's discount and the state charge cannot all be chosen. Here the policy fixes the discount or the charge, the
        grid chooses the price and the share, and the margins and the state's change follow. The {pct(RETAILER_TARGET, 0)} grocery margin is
        therefore a reference line, not a constraint on the grid.
      </p>
      <ul className="small source-list">
        {ROLES.map((r) => (
          <li key={r.quantity}>
            <strong>{r.quantity}</strong>: {r.role}. {r.note}
          </li>
        ))}
      </ul>

      <h4>Axes and assumptions</h4>
      <ul className="small source-list">
        <li>
          <strong>Share moving</strong>: {AXES.share.definition} That base is {dollars(rep.denominator.coveredHousehold)} a year ({dollars(rep.denominator.wineSales)} ×{" "}
          {pct(rep.denominator.householdShare, 0)}). {AXES.share.rationale}
        </li>
        <li>
          <strong>Grocery price premium</strong>: {AXES.premium.definition} {AXES.premium.rationale}
        </li>
        <li>
          <strong>Volume</strong>: fixed. Existing household purchases move between DABS and grocers; total wine bought does not change; state stores stay
          open with their fixed costs. A separate table below adds the engine's price response.
        </li>
        <li>
          <strong>Savings</strong>: two cases, shown side by side: the source-based assumption of {cents(COST_LINES.shortRun)} of store cost avoided per
          $1 that leaves (U07: card fees, package-agency contracts and bags, an allocation of accounting expense lines, not a measured saving), and none.
        </li>
        <li className={handling ? "warn" : undefined}>
          <strong>Extra wholesale handling cost of supplying grocers: unknown, set to zero</strong> (U11). Zero is a placeholder, not an estimate; any
          real cost lowers every DABS-supply cell.
        </li>
        <li>
          <strong>Protected funds</strong>: the school-meals and enforcement deposits are allocations inside the totals and never added to them. At
          fixed volume they do not depend on the price; at {pct(WORKED_SHARE, 0)} moving they change by:{" "}
          {GRID_ARRANGEMENTS.map((a) => `${a.short} ${fundsWords(a)}`).join("; ")}.
        </li>
        <li>
          Gross margin is a seller's price less what it pays, before its own costs: not profit. Private supply assumes a wholesaler keeping{" "}
          {pct(WHOLESALER_MARGIN)} of its own price (U13); the grocer's share follows, and what wholesaler and grocer keep together does not depend on
          that split. Method {PRICE_SHARE_METHOD}; data in the graph package (<code>price_share_*.csv</code>).
        </li>
      </ul>

      <fieldset className="no-print ps-pick">
        <legend className="small">Arrangement shown (all four print)</legend>
        {GRID_ARRANGEMENTS.map((a) => (
          <label key={a.id} className="small">
            <input type="radio" name="ps-arr" value={a.id} checked={sel === a.id} onChange={() => setSel(a.id)} /> {a.short}
          </label>
        ))}
      </fieldset>

      {GRID_ARRANGEMENTS.map((a) => {
        const refs = refsByArr.get(a.id)!;
        const mk = markersOf(rep, a);
        return (
          <div key={a.id} className={`ps-arr${a.id === sel ? "" : " ps-off"}`}>
            <figure className="ps-figure">
              <figcaption>
                <strong>{a.label}.</strong> <span className="small">The policy fixes {a.lever.words}. {a.marginRule}</span>
              </figcaption>
              <div className="ps-chart-wrap">
                <GridChart rep={rep} a={a} domain={domain} refs={refs} />
              </div>
              <p className="small ps-subhead">The grocer's gross margin at each premium (the same for every share):</p>
              <div className="ps-chart-wrap">
                <MarginChart rep={rep} a={a} />
              </div>
              <Legend domain={domain} />
              <p className="small">
                State annual change at fixed volume with the source-based savings; one colour scale for all four arrangements.{" "}
                {mk.grocerCost !== null && mk.grocerCost > 0
                  ? `Below a ${pct(mk.grocerCost)} premium the grocer would sell below its acquisition cost if the wholesaler kept ${pct(WHOLESALER_MARGIN)}. `
                  : mk.grocerCost !== null && Math.abs(mk.grocerCost) < 1e-9
                    ? "At a 0% premium the grocer sells at its acquisition cost (no margin). "
                    : ""}
                {mk.reference !== null ? `The grocer's margin reaches ${pct(RETAILER_TARGET, 0)} at a ${pct(mk.reference)} premium. ` : ""}
                Existing alternatives on this grid: {refs.length ? refs.map((r) => r.label).join("; ") : "none"}.
              </p>
            </figure>
            <GridTable rep={rep} a={a} />
          </div>
        );
      })}

      <h4>Exploratory: with the old price response</h4>
      <p className="small">
        The engine's price response (elasticity {String(ELASTICITY).replace("-", "−")}, U15) applied after the share is assigned: the {pct(WORKED_SHARE, 0)} that moves is
        bought at the grocery price, in a smaller quantity when that price is higher. Purchases no longer made at grocers leave the Utah market; they are
        not returned to DABS, so no purchase is counted both as lost and as a return. That treats a higher grocery price as if every wine price had risen,
        though DABS still sells the same bottles at today's price, so it is kept only as exploration. The share does not respond to the premium here,
        and no substitution or cross-border recapture is added; the purchase-flow section adds both. $ millions a year, source-based savings.
      </p>
      <div className="table-wrap">
        <table className="data initiative-table ps-table">
          <thead>
            <tr>
              <th scope="col">At {pct(WORKED_SHARE, 0)} moving</th>
              {PREMIUMS.map((p) => (
                <th scope="col" key={p} className="num">
                  {pct(p, 0)}
                </th>
              ))}
            </tr>
          </thead>
          {GRID_ARRANGEMENTS.map((a) => (
            <tbody key={a.id}>
              <tr>
                <th scope="rowgroup" colSpan={PREMIUMS.length + 1} className="small">
                  {a.label}
                </th>
              </tr>
              {(["fixed_volume", "price_response"] as const).map((vb) => (
                <tr key={vb}>
                  <th scope="row" className="small">
                    {vb === "fixed_volume" ? "Fixed volume" : "With price response"}
                  </th>
                  {PREMIUMS.map((p) => (
                    <td key={p} className="num small">
                      {m1(find(rep, a, p, WORKED_SHARE, "source_based", vb).net)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
      <p className="small muted">
        What this cannot say: whether shoppers would pay any premium, what share of purchases would move at any price, what margin grocers would accept on
        wine, and which DABS costs would actually stop. Each is an input here, not a result.
      </p>
    </section>
  );
}
