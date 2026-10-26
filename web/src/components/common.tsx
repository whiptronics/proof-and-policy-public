import type { MouseEvent, ReactNode } from "react";
import { useData } from "../lib/data";
import { words } from "../lib/format";
import { sourcesById } from "../lib/sources";
import type { Asset, Coverage, SourcesData } from "../lib/types";
import { hrefFor, navigate, type Patch } from "../lib/url";

export function Loading({ what }: { what: string }) {
  return (
    <p className="muted" role="status">
      Loading {what}…
    </p>
  );
}

export function ErrorNote({ error }: { error: Error }) {
  return (
    <div className="warn" role="alert">
      <strong>Could not load data.</strong> {error.message}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

/** Symbol and class for each coverage code (see coverage.json "states"). */
export const CODE_STYLE: Record<string, { cls: string; sym: string }> = {
  S: { cls: "st-S", sym: "•" },
  D: { cls: "st-D", sym: "◇" },
  U: { cls: "st-U", sym: "◐" },
  R: { cls: "st-R", sym: "✓" },
  "0": { cls: "st-0", sym: "0" },
  C: { cls: "st-C", sym: "!" },
  W: { cls: "st-W", sym: "⊠" },
  M: { cls: "st-M", sym: "○" },
  N: { cls: "st-N", sym: "×" },
  ".": { cls: "st-dot", sym: "·" },
  "-": { cls: "st-dash", sym: "" },
  " ": { cls: "st-space", sym: "" },
  K: { cls: "st-K", sym: "■" },
  P: { cls: "st-P", sym: "◧" },
  "?": { cls: "st-Q", sym: "?" },
  L: { cls: "st-L", sym: "L" },
  F: { cls: "st-F", sym: "…" },
};

export function Swatch({ code }: { code: string }) {
  const s = CODE_STYLE[code] ?? { cls: "st-space", sym: code };
  return (
    <span className={`sw ${s.cls}`} aria-hidden="true">
      {s.sym}
    </span>
  );
}

/** A coverage state as symbol + words (never color alone). */
export function StateBadge({ code }: { code: string }) {
  const cov = useData<Coverage>("coverage.json");
  const label = cov.data?.states[code]?.label ?? code;
  return (
    <span className="badge" title={cov.data?.states[code]?.description}>
      <Swatch code={code} />
      {label}
    </span>
  );
}

export function Legend({ codes }: { codes: string[] }) {
  const cov = useData<Coverage>("coverage.json");
  if (!cov.data) return null;
  return (
    <div className="legend" aria-label="Legend">
      {codes.map((c) => (
        <span className="item" key={c} title={cov.data!.states[c]?.description}>
          <Swatch code={c} /> {cov.data!.states[c]?.label ?? c}
        </span>
      ))}
    </div>
  );
}

/** In-app link that updates the URL (keeps Back/Forward working). */
export function Go({
  to,
  reset = false,
  children,
  className,
}: {
  to: Patch;
  reset?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const onClick = (e: MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    navigate(to, { reset });
  };
  return (
    <a href={hrefFor(to, reset)} onClick={onClick} className={className}>
      {children}
    </a>
  );
}

/** Open a record in the shared detail drawer. */
export function RecordLink({ rec, children }: { rec: string; children: ReactNode }) {
  return <Go to={{ rec }}>{children}</Go>;
}

export function external(url: string | null | undefined, page?: number | null): string | null {
  if (!url) return null;
  return page ? `${url}#page=${page}` : url;
}

/** Where a value or excerpt came from: asset, locator, links to the original and to the source record. */
/** The "Sources:" line under a chart or table: each publisher with a link to the source's own page, and a
 * link to this source's files in the Sources view. `ids` are source ids (lib/sources.ts finds them). */
export function SourceNote({
  ids,
  derived = false,
  label = "Source",
  inline = false,
  children,
}: {
  ids: string[];
  derived?: boolean;
  label?: string;
  /** Inside a sentence or list item rather than as its own paragraph. */
  inline?: boolean;
  children?: ReactNode;
}) {
  const src = useData<SourcesData>("sources.json");
  if (!src.data || !ids.length) return null;
  const list = sourcesById(ids, src.data);
  if (!list.length) return null;
  const Tag = inline ? "span" : "p";
  return (
    <Tag className={inline ? "source-note" : "small source-note"}>
      <strong>
        {label}
        {list.length > 1 ? "s" : ""}:
      </strong>{" "}
      {list.map((s, i) => (
        <span key={s.source_id}>
          {i > 0 ? "; " : ""}
          {s.publisher},{" "}
          <a href={s.landing_url} target="_blank" rel="noreferrer noopener">
            {s.title}
          </a>{" "}
          (
          <Go to={{ v: "sources", pub: s.publisher }} reset>
            files
          </Go>
          )
        </span>
      ))}
      .{derived ? " Computed by this project from those sources." : ""}
      {children ? <> {children}</> : null}
    </Tag>
  );
}

export function SourceRef({ assetId, locator, page }: { assetId: string; locator?: string | null; page?: number | null }) {
  const src = useData<SourcesData>("sources.json");
  const a: Asset | undefined = src.data?.assets.find((x) => x.asset_id === assetId);
  if (!src.data) return <span className="mono">{assetId}</span>;
  if (!a) return <span className="mono">{assetId} (not in the source register)</span>;
  const source = src.data.sources.find((s) => s.source_id === a.source_id);
  const pdf = a.format === "pdf";
  const open = external(a.url, pdf ? page : null);
  return (
    <div className="small">
      <div>
        <strong>{source?.publisher ?? a.source_id}</strong>: {a.title ?? source?.title} — {a.edition}
      </div>
      {locator && (
        <div>
          Location: <span className="mono">{locator}</span>
        </div>
      )}
      <div className="row-actions">
        {open && (
          <a href={open} target="_blank" rel="noreferrer noopener">
            Open original{pdf && page ? ` at page ${page}` : ""} ↗
          </a>
        )}
        {a.local_copy_servable && (
          <a href={`/local-raw/${a.asset_id}${pdf && page ? `#page=${page}` : ""}`} target="_blank" rel="noreferrer">
            Local copy (development server)
          </a>
        )}
        <RecordLink rec={`asset:${a.asset_id}`}>Source record</RecordLink>
      </div>
      {!a.url && <div className="muted">No public file URL: {words(a.request_method)}.</div>}
      {a.sha256 && (
        <div className="muted">
          SHA-256 <span className="mono">{a.sha256.slice(0, 16)}…</span> · retrieved {a.retrieved_at?.slice(0, 10) ?? "—"}
        </div>
      )}
    </div>
  );
}
