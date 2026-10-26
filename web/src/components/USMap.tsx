// A U.S. state map (Albers USA outlines from the export). Every state is a keyboard-focusable control; its
// label gives the value, and missing, suppressed and zero each have their own fill so none can pass for
// another. Small Northeastern states are labelled to the side with leader lines, as on Census maps.
import { useState, type KeyboardEvent, type ReactNode } from "react";
import { colorFor, inkFor, type Domain, type RankedCell } from "../lib/mapdata";
import type { MapShapes } from "../lib/types";

export const CALLOUTS = ["state:50", "state:33", "state:25", "state:44", "state:09", "state:34", "state:10", "state:24", "state:11"];
const WIDTH = 1060;

export function fillFor(c: RankedCell | undefined, d: Domain | null): string {
  if (!c) return "url(#map-missing)";
  if (c.kind === "zero") return "var(--map-zero)";
  if (c.kind === "suppressed") return "url(#map-suppressed)";
  if (c.kind !== "value" || c.value === null || !d) return "url(#map-missing)";
  return colorFor(c.value, d);
}

export function MapPatterns() {
  return (
    <defs>
      <pattern id="map-missing" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="6" height="6" fill="var(--map-missing-bg)" />
        <line x1="0" y1="0" x2="0" y2="6" stroke="var(--map-missing-line)" strokeWidth="1.4" />
      </pattern>
      <pattern id="map-suppressed" width="6" height="6" patternUnits="userSpaceOnUse">
        <rect width="6" height="6" fill="var(--map-missing-bg)" />
        <path d="M0,0 L6,6 M6,0 L0,6" stroke="var(--map-suppressed-line)" strokeWidth="1" />
      </pattern>
    </defs>
  );
}

export function USMap({
  shapes,
  cells,
  domain,
  abbr,
  name,
  format,
  selected,
  outlineUtah,
  onSelect,
  title,
  describe,
  showValues = true,
  extraClass,
}: {
  shapes: MapShapes;
  cells: Map<string, RankedCell>;
  domain: Domain | null;
  abbr: (geo: string) => string;
  name: (geo: string) => string;
  format: (c: RankedCell) => string;
  selected: string | null;
  outlineUtah: boolean;
  onSelect: (geo: string) => void;
  title: string;
  describe: (c: RankedCell | undefined, geo: string) => string;
  showValues?: boolean;
  /** Extra class per state (for example the liquor-control comparison: faded or dashed). */
  extraClass?: (geo: string) => string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const geos = Object.keys(shapes.states);
  const callouts = CALLOUTS.filter((g) => shapes.states[g]).sort((a, b) => shapes.states[a].label[1] - shapes.states[b].label[1]);
  const calloutY = new Map(callouts.map((g, i) => [g, 150 + i * 30]));
  const press = (g: string) => (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(g);
    }
  };
  const focus = hover ?? selected;
  const label = (g: string): ReactNode => {
    const c = cells.get(g);
    const [x, y] = shapes.states[g].label;
    const fill = fillFor(c, domain);
    const ink = fill.startsWith("#") ? inkFor(fill) : "var(--text)";
    // A halo in the state's own color keeps a label readable where it runs past a narrow state's edge.
    const halo = fill.startsWith("#") ? fill : "var(--surface)";
    const text = c ? format(c) : "no data";
    if (calloutY.has(g)) {
      const ly = calloutY.get(g)!;
      return (
        <g key={`l-${g}`} aria-hidden="true">
          <line x1={x} y1={y} x2={985} y2={ly - 4} stroke="var(--text-2)" strokeWidth={0.7} />
          <text x={990} y={ly} className="map-callout">
            <tspan fontWeight={600}>{abbr(g)}</tspan> {showValues ? text : ""}
          </text>
        </g>
      );
    }
    return (
      <text key={`l-${g}`} x={x} y={y} textAnchor="middle" className="map-label" style={{ fill: ink, stroke: halo }} aria-hidden="true">
        <tspan x={x} dy={showValues ? -2 : 4} fontWeight={600}>
          {abbr(g)}
        </tspan>
        {showValues && (
          <tspan x={x} dy={12}>
            {text}
          </tspan>
        )}
      </text>
    );
  };
  return (
    <div className="map-wrap">
      <svg viewBox={`0 0 ${WIDTH} 610`} className="us-map" role="group" aria-label={title}>
        <MapPatterns />
        {geos.map((g) => {
          const c = cells.get(g);
          const isUtah = g === "state:49";
          return (
            <path
              key={g}
              d={shapes.states[g].path}
              fill={fillFor(c, domain)}
              className={`map-state${selected === g ? " selected" : ""}${isUtah && outlineUtah ? " utah" : ""}${c?.kind === "zero" ? " zero" : ""}${extraClass ? ` ${extraClass(g)}` : ""}`}
              tabIndex={0}
              role="button"
              aria-label={describe(c, g)}
              aria-pressed={selected === g}
              onClick={() => onSelect(g)}
              onKeyDown={press(g)}
              onMouseEnter={() => setHover(g)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(g)}
              onBlur={() => setHover(null)}
            >
              <title>{describe(c, g)}</title>
            </path>
          );
        })}
        {/* Draw Utah's and the selected state's outline on top so neither is hidden by neighbours. */}
        {outlineUtah && shapes.states["state:49"] && <path d={shapes.states["state:49"].path} className="map-utah-outline" aria-hidden="true" />}
        {selected && shapes.states[selected] && <path d={shapes.states[selected].path} className="map-selected-outline" aria-hidden="true" />}
        {geos.map(label)}
      </svg>
      <div className="map-tip" role="status" aria-live="polite">
        {focus ? describe(cells.get(focus), focus) : "Point at or tab to a state for its value; press Enter or click for details."}
      </div>
      <span className="visually-hidden">{name("state:49")} is outlined so it is easy to find.</span>
    </div>
  );
}

export function MapLegend({ domain, format, unitText, fixed }: { domain: Domain | null; format: (v: number) => string; unitText: string; fixed: string }) {
  const stops = 9;
  return (
    <div className="map-legend" aria-label="Legend">
      {domain ? (
        <div>
          <svg viewBox="0 0 240 34" width="240" height="34" aria-hidden="true">
            <defs>
              <linearGradient id="map-grad">
                {Array.from({ length: stops }, (_, i) => (
                  <stop key={i} offset={i / (stops - 1)} stopColor={colorFor(domain.min + (i / (stops - 1)) * (domain.max - domain.min), domain)} />
                ))}
              </linearGradient>
            </defs>
            <rect x="0" y="2" width="240" height="14" fill="url(#map-grad)" stroke="var(--line-strong)" />
          </svg>
          <div className="map-legend-ends">
            <span>
              {domain.clipped?.low ? "≤ " : ""}
              {format(domain.min)}
            </span>
            {domain.diverging && <span>0</span>}
            <span>
              {domain.clipped?.high ? "≥ " : ""}
              {format(domain.max)}
            </span>
          </div>
          <div className="small muted">
            {unitText}. {domain.diverging ? "Orange = fell, blue = rose, white = no change." : "Darker = higher value, which is not by itself better or worse."} {fixed}
            {domain.clipped ? ` ${domain.clipped.note}` : ""}
          </div>
        </div>
      ) : (
        <p className="small muted">No values to color.</p>
      )}
      <div className="legend">
        <span className="item">
          <svg width="16" height="12" aria-hidden="true">
            <rect width="16" height="12" fill="var(--map-zero)" stroke="var(--text)" />
          </svg>{" "}
          Reported zero
        </span>
        <span className="item">
          <svg width="16" height="12" aria-hidden="true">
            <rect width="16" height="12" fill="url(#map-missing)" stroke="var(--line-strong)" />
          </svg>{" "}
          No data (not published, not collected or not applicable)
        </span>
        <span className="item">
          <svg width="16" height="12" aria-hidden="true">
            <rect width="16" height="12" fill="url(#map-suppressed)" stroke="var(--line-strong)" />
          </svg>{" "}
          Suppressed by the source
        </span>
        <span className="item">
          <svg width="16" height="12" aria-hidden="true">
            <rect width="16" height="12" fill="none" stroke="var(--map-utah)" strokeWidth="3" />
          </svg>{" "}
          Utah
        </span>
      </div>
    </div>
  );
}
