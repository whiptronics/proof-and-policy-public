// One frame for every major chart: a title that says what matters, units and settings, the chart, what it shows, what it
// does not establish, where to explore further, its sources and release, the plotted numbers as a table, and downloads
// (PNG, SVG, CSV) that carry the same information.
// The chart is drawn at the frame's measured width, so labels keep their size on a phone instead of shrinking.
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { downloadPng, downloadSvg, type ChartMeta } from "../lib/chartExport";
import { saveFile, toCsv, type Column } from "../lib/csv";
import { useData } from "../lib/data";
import type { Manifest } from "../lib/types";

export type Row = Record<string, string | number | boolean | null>;

export interface ChartFigureProps {
  id: string;
  title: string;
  /** Units, period and the scenario's settings. */
  subtitle: string;
  /** What this shows: how to read it, in one or two sentences. */
  reading: ReactNode;
  /** What it does not establish. */
  limits: ReactNode;
  /** Explore further: links to the analysis or tool behind the chart. */
  explore?: ReactNode;
  /** The same two as plain text, for the downloads. */
  readingText: string;
  limitsText: string;
  source: string;
  /** Method versions the figures come from. */
  methods: string;
  filename: string;
  csv: { columns: Column<Row>[]; rows: Row[] };
  /** The plotted values as a table (shown on request; always available to screen readers). */
  table: ReactNode;
  legend?: ReactNode;
  children: (width: number) => ReactNode;
}

function useWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = () => setW(Math.round(el.clientWidth));
    set();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

export function releaseText(man: Manifest | undefined, methods: string): string {
  const d = man?.dataset;
  const where = typeof window !== "undefined" && window.location.protocol === "https:" ? ` · ${window.location.href}` : "";
  return `Proof & Policy${d ? ` · data release ${d.release_version}, build ${d.build_id}, law as of ${d.law_as_of_date}` : ""} · ${methods}${where}`;
}

export interface ChartDownloadsProps {
  title: string;
  subtitle: string;
  /** Paragraphs printed under the chart in the image downloads (reading, limits). */
  notes: string[];
  source: string;
  methods: string;
  filename: string;
  csv: { columns: Column<Row>[]; rows: Row[] };
  /** The drawn chart, looked up when a button is pressed. */
  svg: () => SVGSVGElement | null;
}

/** PNG, SVG and CSV downloads of one chart, each carrying its title, settings, notes, sources and release. */
export function ChartDownloads(p: ChartDownloadsProps) {
  const man = useData<Manifest>("manifest.json");
  const [msg, setMsg] = useState("");
  const release = releaseText(man.data, p.methods);
  const meta = (): ChartMeta => ({ title: p.title, subtitle: p.subtitle, notes: p.notes, source: p.source, release, filename: p.filename });
  const run = async (what: "png" | "svg" | "csv") => {
    try {
      if (what === "csv") {
        const cols: Column<Row>[] = [...p.csv.columns, { key: "source", kind: "text", get: () => p.source }, { key: "release", kind: "text", get: () => release }];
        saveFile(`${p.filename}.csv`, toCsv(cols, p.csv.rows), "text/csv;charset=utf-8");
      } else {
        const s = p.svg();
        if (!s) throw new Error("the chart is not drawn yet");
        if (what === "svg") downloadSvg(s, meta());
        else await downloadPng(s, meta());
      }
      setMsg(`Saved ${p.filename}.${what}`);
    } catch (e) {
      setMsg(`Could not save: ${(e as Error).message}`);
    }
  };
  return (
    <div className="chart-tools no-print" role="group" aria-label={`Download: ${p.title}`}>
      <button type="button" onClick={() => run("png")}>
        Image (PNG)
      </button>
      <button type="button" onClick={() => run("svg")}>
        Vector (SVG)
      </button>
      <button type="button" onClick={() => run("csv")}>
        Data (CSV)
      </button>
      <span className="small muted" role="status">
        {msg}
      </span>
    </div>
  );
}

export function ChartFigure(p: ChartFigureProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const man = useData<Manifest>("manifest.json");
  const release = releaseText(man.data, p.methods);
  return (
    <figure className="chart-figure" aria-labelledby={`${p.id}-t`} id={p.id}>
      <figcaption>
        <h4 id={`${p.id}-t`} className="chart-title">
          {p.title}
        </h4>
        <p className="chart-sub">{p.subtitle}</p>
      </figcaption>
      <div ref={ref} className="chart-body">
        {width > 0 && p.children(width)}
      </div>
      {p.legend}
      <div className="chart-notes">
        <p>
          <strong>What this shows.</strong> {p.reading}
        </p>
        <p>
          <strong>What it does not establish.</strong> {p.limits}
        </p>
        {p.explore && (
          <p>
            <strong>Explore further.</strong> {p.explore}
          </p>
        )}
        <p className="small muted">
          Source: {p.source}. <span className="chart-release">{release}</span>
        </p>
      </div>
      <details className="chart-data">
        <summary>Show the numbers</summary>
        {p.table}
      </details>
      <ChartDownloads
        title={p.title}
        subtitle={p.subtitle}
        notes={[p.readingText, p.limitsText]}
        source={p.source}
        methods={p.methods}
        filename={p.filename}
        csv={p.csv}
        svg={() => ref.current?.querySelector<SVGSVGElement>("svg.chart") ?? null}
      />
    </figure>
  );
}
