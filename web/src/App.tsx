import { lazy, Suspense, useEffect, type MouseEvent, type ReactNode } from "react";
import { ErrorNote, Loading } from "./components/common";
import { Drawer } from "./components/Drawer";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useData } from "./lib/data";
import type { Manifest } from "./lib/types";
import { navigate, pickOne, useParams, VIEWS, type View } from "./lib/url";
import { CoverageView } from "./views/CoverageView";
import { DownloadsView } from "./views/DownloadsView";
import { MatrixView } from "./views/MatrixView";
import { MethodsView } from "./views/MethodsView";
import { SourcesView } from "./views/SourcesView";
import { StartView } from "./views/StartView";
import { TimelineView } from "./views/TimelineView";

// Views that draw charts load on demand, so the first page does not wait for the chart library.
const CaseView = lazy(() => import("./views/CaseView").then((m) => ({ default: m.CaseView })));
const ChangeView = lazy(() => import("./views/ChangeView").then((m) => ({ default: m.ChangeView })));
const CompareView = lazy(() => import("./views/CompareView").then((m) => ({ default: m.CompareView })));
const ExploreView = lazy(() => import("./views/ExploreView").then((m) => ({ default: m.ExploreView })));
const MapView = lazy(() => import("./views/MapView").then((m) => ({ default: m.MapView })));
const BeveragesView = lazy(() => import("./views/BeveragesView").then((m) => ({ default: m.BeveragesView })));
const FiscalView = lazy(() => import("./views/FiscalView").then((m) => ({ default: m.FiscalView })));
const InitiativeView = lazy(() => import("./views/InitiativeView").then((m) => ({ default: m.InitiativeView })));
const UtahView = lazy(() => import("./views/UtahView").then((m) => ({ default: m.UtahView })));
const FinderView = lazy(() => import("./views/FinderView").then((m) => ({ default: m.FinderView })));
const RevenueView = lazy(() => import("./views/RevenueView").then((m) => ({ default: m.RevenueView })));
const OfficialsView = lazy(() => import("./views/OfficialsView").then((m) => ({ default: m.OfficialsView })));
const ScenarioView = lazy(() => import("./views/ScenarioView").then((m) => ({ default: m.ScenarioView })));

const TOOLS: [View, string][] = [
  ["start", "Start here"],
  ["initiative", "Utah grocery wine"],
  ["utah", "Utah at a glance"],
  ["change", "Before & after"],
  ["finder", "Find comparison states"],
  ["scenario", "Utah revenue scenarios"],
];
const DATA: [View, string][] = [
  ["map", "Map"],
  ["beverages", "Beer, wine & spirits"],
  ["fiscal", "Revenue by state"],
  ["explore", "Explore"],
  ["compare", "Compare"],
  ["revenue", "Revenue over time"],
  ["coverage", "Coverage"],
  ["timeline", "Policy timeline"],
  ["matrix", "Policy matrix"],
  ["sources", "Sources"],
  ["officials", "Officials & committees"],
];
const SECONDARY: [View, string][] = [
  ["case", "Worked example"],
  ["methods", "Definitions & methods"],
  ["downloads", "Downloads"],
];
const TITLES: Record<View, string> = Object.fromEntries([...TOOLS, ...DATA, ...SECONDARY]) as Record<View, string>;

/** Optional framing for hosts that embed the dashboard (the defaults are the local research dashboard). */
export interface AppProps {
  /** Name in the header and the browser tab. */
  title?: string;
  /** Replaces the local-dashboard notice under the title. */
  intro?: ReactNode;
  /** Views left out of the navigation; their addresses fall back to Start here. */
  hide?: readonly View[];
  /** Shown below every page. */
  footer?: ReactNode;
}

function NavLink({ view, current, children }: { view: View; current: View; children: ReactNode }) {
  const go = (e: MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    navigate({ v: view }, { reset: true });
  };
  return (
    <a href={`?v=${view}`} onClick={go} aria-current={view === current ? "page" : undefined}>
      {children}
    </a>
  );
}

export function App({ title = "Proof & Policy research dashboard", intro, hide = [], footer }: AppProps = {}) {
  const params = useParams();
  const shown = (list: [View, string][]) => list.filter(([v]) => !hide.includes(v));
  const view = pickOne(
    params.get("v"),
    VIEWS.filter((v) => !hide.includes(v)),
    "start",
  );
  const man = useData<Manifest>("manifest.json");

  useEffect(() => {
    document.title = `${TITLES[view]} · ${title}`;
  }, [view, title]);

  return (
    <>
      <a className="skip" href="#content">
        Skip to content
      </a>
      <header className="app">
        <div className="app-title">
          <h1>{title}</h1>
          {man.data && (
            <p className="release" aria-label="Dataset release">
              Data release <strong>{man.data.dataset.release_version}</strong> · build{" "}
              <span className="mono">{man.data.dataset.build_id}</span> · law as of{" "}
              {man.data.dataset.law_as_of_date} ({man.data.dataset.law_as_of_timezone}) · exported{" "}
              {man.data.export.generated_at.slice(0, 10)}
            </p>
          )}
        </div>
        {intro ?? (
          <p className="evolving">
            An evolving research resource, run locally. It shows what the dataset holds, what is missing and where each value
            comes from. Comparisons here are descriptive: nothing on these pages estimates a causal effect. The Utah scenario tool
            shows what your own assumptions imply; it is not a forecast.
          </p>
        )}
        <div className="navs">
          <nav className="main tools" aria-label="Analysis tools">
            {shown(TOOLS).map(([v, label]) => (
              <NavLink key={v} view={v} current={view}>
                {label}
              </NavLink>
            ))}
          </nav>
          <nav className="main" aria-label="Browse the data">
            {shown(DATA).map(([v, label]) => (
              <NavLink key={v} view={v} current={view}>
                {label}
              </NavLink>
            ))}
          </nav>
          <nav className="secondary" aria-label="More">
            {shown(SECONDARY).map(([v, label]) => (
              <NavLink key={v} view={v} current={view}>
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main id="content" tabIndex={-1}>
        {man.error ? (
          <ErrorNote error={man.error} />
        ) : !man.data ? (
          <Loading what="the dataset manifest" />
        ) : (
          <ErrorBoundary resetKey={view}>
            <Suspense fallback={<Loading what="this view" />}>
              {view === "start" && <StartView />}
              {view === "initiative" && <InitiativeView />}
              {view === "utah" && <UtahView />}
              {view === "change" && <ChangeView />}
              {view === "finder" && <FinderView />}
              {view === "scenario" && <ScenarioView />}
              {view === "map" && <MapView />}
              {view === "beverages" && <BeveragesView />}
              {view === "fiscal" && <FiscalView />}
              {view === "coverage" && <CoverageView />}
              {view === "explore" && <ExploreView />}
              {view === "timeline" && <TimelineView />}
              {view === "matrix" && <MatrixView />}
              {view === "compare" && <CompareView />}
              {view === "revenue" && <RevenueView />}
              {view === "sources" && <SourcesView />}
              {view === "officials" && <OfficialsView />}
              {view === "case" && <CaseView />}
              {view === "methods" && <MethodsView />}
              {view === "downloads" && <DownloadsView manifest={man.data} />}
            </Suspense>
          </ErrorBoundary>
        )}
      </main>
      {footer}
      {man.data && params.get("rec") && (
        <ErrorBoundary resetKey={params.get("rec")!}>
          <Drawer rec={params.get("rec")!} />
        </ErrorBoundary>
      )}
    </>
  );
}
