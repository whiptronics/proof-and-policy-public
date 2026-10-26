// One chart panel: series that share a unit and period kind. Lines break at missing years and at
// comparability-group changes (trendSegments), never interpolate, and every point opens its record.
import { Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { trendSegments } from "../lib/compare";
import { formatAxis, formatValue } from "../lib/format";
import { percentChange } from "../lib/formulas";
import { navigate } from "../lib/url";

export interface ChartPoint {
  year: number;
  value: number | null;
  low?: number | null;
  high?: number | null;
  comparability_group: string;
  rec: string;
  period_label: string;
  note?: string;
}

export interface ChartSeries {
  key: string;
  label: string;
  points: ChartPoint[];
}

export interface Annotation {
  year: number;
  label: string;
  kind: "transition" | "line";
}

export const SERIES_COLORS = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)", "var(--series-6)"];

export function TrendChart({
  series,
  unit,
  domain,
  annotations = [],
  height = 300,
  title,
  yDomain,
}: {
  series: ChartSeries[];
  unit: string;
  domain: [number, number];
  annotations?: Annotation[];
  height?: number;
  title: string;
  /** A fixed value axis, so panels drawn side by side share one scale; automatic when absent. */
  yDomain?: [number, number];
}) {
  const rows = new Map<number, Record<string, unknown>>();
  for (let y = domain[0]; y <= domain[1]; y++) rows.set(y, { year: y });
  const lines: { dataKey: string; color: string; seriesKey: string; first: boolean }[] = [];
  const bands: { dataKey: string; color: string }[] = [];
  series.forEach((s, i) => {
    const color = SERIES_COLORS[i % SERIES_COLORS.length];
    const pts = s.points.filter((p) => p.year >= domain[0] && p.year <= domain[1]);
    trendSegments(pts).forEach((seg, j) => {
      const dk = `${s.key}__${j}`;
      for (const p of seg) {
        const row = rows.get(p.year)!;
        row[dk] = p.value;
        row[`${dk}__p`] = p;
      }
      lines.push({ dataKey: dk, color, seriesKey: s.key, first: j === 0 });
    });
    // Confidence bands break wherever the line breaks (a method change or a missing year).
    trendSegments(pts).forEach((seg, j) => {
      if (!seg.some((p) => p.low !== undefined && p.low !== null)) return;
      const bk = `${s.key}__ci${j}`;
      for (const p of seg) {
        if (p.low !== null && p.low !== undefined && p.high !== null && p.high !== undefined) rows.get(p.year)![bk] = [p.low, p.high];
      }
      bands.push({ dataKey: bk, color });
    });
  });
  const data = [...rows.values()];
  const colorOf = (key: string) => SERIES_COLORS[series.findIndex((s) => s.key === key) % SERIES_COLORS.length];
  return (
    <figure className="chart-panel" style={{ margin: 0 }}>
      <figcaption className="visually-hidden">{title}. The table below lists every value shown.</figcaption>
      <div className="chart-box" style={{ height }} aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 16, right: 16, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="2 3" />
            <XAxis dataKey="year" type="number" domain={domain} allowDecimals={false} tickCount={Math.min(12, domain[1] - domain[0] + 1)} />
            <YAxis tickFormatter={(v: number) => formatAxis(v, unit)} width={72} domain={yDomain ?? ["auto", "auto"]} allowDataOverflow={false} />
            {annotations.map((a, i) =>
              a.kind === "transition" ? (
                <ReferenceArea key={`a${i}`} x1={a.year - 0.5} x2={a.year + 0.5} fill="var(--transition)" stroke="var(--series-2)" strokeDasharray="3 3" label={{ value: String(i + 1), position: "insideTop", fontSize: 11 }} />
              ) : (
                <ReferenceLine key={`a${i}`} x={a.year - 0.5} stroke="var(--text-2)" strokeDasharray="4 3" label={{ value: String(i + 1), position: "insideTopRight", fontSize: 11 }} />
              ),
            )}
            {bands.map((b) => (
              <Area key={b.dataKey} dataKey={b.dataKey} stroke="none" fill={b.color} fillOpacity={0.15} connectNulls={false} isAnimationActive={false} activeDot={false} />
            ))}
            {lines.map((l) => (
              <Line
                key={l.dataKey}
                dataKey={l.dataKey}
                stroke={l.color}
                strokeWidth={2}
                connectNulls={false}
                isAnimationActive={false}
                dot={(props: { cx?: number; cy?: number; payload?: Record<string, unknown>; index?: number }) => {
                  const p = props.payload?.[`${l.dataKey}__p`] as ChartPoint | undefined;
                  if (!p || props.cx === undefined || props.cy === undefined) return <g key={`${l.dataKey}-${props.index}`} />;
                  return (
                    <circle
                      key={`${l.dataKey}-${props.index}`}
                      cx={props.cx}
                      cy={props.cy}
                      r={3.5}
                      fill={p.value === 0 ? "var(--surface)" : l.color}
                      stroke={l.color}
                      strokeWidth={1.5}
                      style={{ cursor: "pointer" }}
                      onClick={() => navigate({ rec: p.rec })}
                    />
                  );
                }}
                activeDot={false}
                legendType={l.first ? "line" : "none"}
              />
            ))}
            <Tooltip
              cursor={{ stroke: "var(--line-strong)" }}
              content={({ active, label }) => {
                if (!active || label === undefined) return null;
                const row = rows.get(Number(label));
                if (!row) return null;
                return (
                  <div className="tip">
                    <strong>{label}</strong>
                    {series.map((s) => {
                      const key = Object.keys(row).find((k) => k.startsWith(`${s.key}__`) && k.endsWith("__p"));
                      const p = key ? (row[key] as ChartPoint) : undefined;
                      return (
                        <div key={s.key} style={{ color: colorOf(s.key) }}>
                          {s.label}: {p ? `${formatValue(p.value, unit)} (${p.period_label})` : "no value"}
                        </div>
                      );
                    })}
                    <div className="muted">Click a point to open its record.</div>
                  </div>
                );
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="legend">
        {series.map((s, i) => (
          <span className="item" key={s.key}>
            <span className="sw" style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} aria-hidden="true" /> {s.label}
          </span>
        ))}
        <span className="item muted">Hollow point = observed zero. Breaks = missing year or definition change.</span>
      </div>
      {annotations.length > 0 && (
        <ol className="small source-list" aria-label="Policy markers on this chart">
          {annotations.map((a, i) => (
            <li key={i}>
              {a.label} — {a.kind === "transition" ? "shaded: the change took effect part-way through this period" : "dashed line: the change took effect on the first day of this period"}
            </li>
          ))}
        </ol>
      )}
      <LargeChanges series={series} domain={domain} />
    </figure>
  );
}

/** One-year changes of 50% or more inside an unbroken segment: shown so a break is checked, not read. */
function LargeChanges({ series, domain }: { series: ChartSeries[]; domain: [number, number] }) {
  const notes: string[] = [];
  for (const s of series) {
    for (const seg of trendSegments(s.points.filter((p) => p.year >= domain[0] && p.year <= domain[1]))) {
      for (let i = 1; i < seg.length; i++) {
        const pc = percentChange(seg[i - 1].value, seg[i].value);
        if (pc !== undefined && Math.abs(pc) >= 50) {
          notes.push(`${s.label}: ${pc > 0 ? "+" : ""}${pc.toFixed(0)}% from ${seg[i - 1].period_label} to ${seg[i].period_label}`);
        }
      }
    }
  }
  if (!notes.length) return null;
  return (
    <div className="warn small">
      Large one-year changes (50% or more). Check the source and the series notes before reading them as real changes; the
      dataset records no explanation for them:
      <ul className="source-list">
        {notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </div>
  );
}
