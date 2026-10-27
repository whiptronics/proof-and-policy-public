// Start here: the guided entry point. A newcomer picks a question; each question opens a tool with
// sensible, editable inputs, or (for the cross-state question) a short form that opens Explore.
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { ErrorNote, Go, Loading } from "../components/common";
import { browserStorage } from "../lib/analysis";
import { useData } from "../lib/data";
import { geoName } from "../lib/format";
import { TOPICS } from "../lib/outcomes";
import { SCENARIO_EXAMPLES } from "../lib/scenario";
import { parseRecordFile, readSaved, restoreSearch, writeSaved, type SavedRecord } from "../lib/saved";
import type { Geography, Manifest, MetricsIndex, PolicyData } from "../lib/types";
import { VIEWS, navigate } from "../lib/url";

const TOOL_NAMES: Record<string, string> = {
  change: "Before & after",
  finder: "Comparison finder",
  scenario: "Utah revenue scenario",
  explore: "Explore",
};

const QUESTION_TOPICS: { id: string; label: string; metrics: string[]; dollars: boolean }[] = [
  { id: "revenue", label: "Government revenue", metrics: ["stc_alcoholic_beverages_sales_tax@state_fiscal_year", "census_liquor_stores_revenue@state_fiscal_year", "stc_alcoholic_beverages_license_tax@state_fiscal_year"], dollars: true },
  {
    id: "consumption",
    label: "Purchases and consumption",
    metrics: ["niaaa_ethanol_per_capita_21plus_wine@calendar_year", "niaaa_ethanol_per_capita_21plus_all@calendar_year", "niaaa_ethanol_per_capita_21plus_beer@calendar_year", "niaaa_ethanol_per_capita_21plus_spirits@calendar_year"],
    dollars: false,
  },
  { id: "drinking", label: "Drinking (surveys)", metrics: ["brfss_drank_any_past_30d_pct@survey_year", "brfss_binge_5m_4f_pct@survey_year", "yrbs_current_alcohol_use_hs_pct@survey_year"], dollars: false },
  { id: "safety", label: "Traffic safety", metrics: ["fars_alcohol_impaired_driving_fatalities@calendar_year", "fars_traffic_fatalities@calendar_year"], dollars: false },
];

const FORMATS: { id: string; label: string; help: string; dollarsOnly: boolean }[] = [
  { id: "nominal", label: "As published", help: "Each source's own unit.", dollarsOnly: false },
  { id: "per_resident_21plus", label: "Per resident 21+", help: "Dollars divided by the population aged 21 and over, so states of different sizes compare.", dollarsOnly: true },
  { id: "per_resident", label: "Per resident", help: "Dollars divided by the whole population.", dollarsOnly: true },
  { id: "real_cy2024", label: "Constant 2024 dollars", help: "Adjusted for inflation.", dollarsOnly: true },
  { id: "index", label: "Index (first year = 100)", help: "Each state's values relative to its own first year: compares trends, hides levels.", dollarsOnly: false },
];

export function StartView() {
  const idx = useData<MetricsIndex>("metrics.json");
  const geos = useData<Geography[]>("geographies.json");
  const pol = useData<PolicyData>("policy.json");
  const man = useData<Manifest>("manifest.json");
  const err = idx.error ?? geos.error ?? pol.error ?? man.error;
  if (err) return <ErrorNote error={err} />;
  if (!idx.data || !geos.data || !pol.data || !man.data) return <Loading what="the start page" />;
  const verifiedStates = geos.data.filter(
    (g) => g.geo_level === "state" && pol.data!.segments.some((s) => s.geo_id === g.geo_id && s.policy_dimension === "ordinary_grocery_wine_authorization" && s.state !== "unknown"),
  );
  return (
    <>
      <section className="panel" aria-labelledby="st-h">
        <h2 id="st-h">Start here</h2>
        <p>
          How does letting grocery stores sell wine relate to government revenue, what people buy and drink, and public health, and what could
          that tell us about Utah? Pick a question. Each opens a tool with inputs filled in that you can change, and every result says what it
          can and cannot show, including results that cut against the idea.
        </p>
        <ul className="question-cards">
          <li>
            <h3>What changed after a state allowed grocery-store wine?</h3>
            <p className="small">
              Averages before and after the change, the same years for comparison states, and every value used. Uses a verified date when the dataset
              has one; Tennessee's July 2016 change is the first example.
            </p>
            <div className="row-actions">
              <Go to={{ v: "change" }} reset className="button primary-link">
                Start with Tennessee 2016
              </Go>
            </div>
          </li>
          <li>
            <h3>Which states are useful comparisons for Utah?</h3>
            <p className="small">
              Ranks states by how much they resembled Utah in years you choose, on population, income, drinking and consumption, with the values behind
              every score. Candidates to examine, not validated controls.
            </p>
            <div className="row-actions">
              <Go to={{ v: "finder" }} reset className="button primary-link">
                Find comparisons for Utah
              </Go>
            </div>
          </li>
          <li>
            <h3>How do revenue and consumption compare across states?</h3>
            <p className="small">Trends for the states you pick, with each state's verified grocery-wine status shown underneath.</p>
            <CrossStateForm idx={idx.data} geos={geos.data} />
          </li>
          <li>
            <h3>What would different assumptions mean for Utah's wine revenue?</h3>
            <p className="small">
              A calculator for state revenue if some wine purchases moved to grocery stores, with optional extra purchases and beer substitution. You
              supply what the data cannot; every input is labelled as data or assumption.
            </p>
            <div className="row-actions">
              <Go to={{ v: "scenario" }} reset className="button primary-link">
                Open the calculator
              </Go>
              <Go to={{ v: "scenario", ...SCENARIO_EXAMPLES[0].values, eg: SCENARIO_EXAMPLES[0].id }} reset>
                See an example
              </Go>
            </div>
          </li>
        </ul>
      </section>

      <section className="panel" aria-labelledby="st-glance">
        <h2 id="st-glance">The whole country at a glance</h2>
        <ul className="question-cards">
          <li>
            <h3>Where does Utah stand, and which states compare?</h3>
            <p className="small">
              Utah's latest value on each measure and its rank among states with a value for the same year, how Utah sells alcohol under verified
              law, and a few comparison candidates with why they were chosen, how they differ and what is not yet known.
            </p>
            <div className="row-actions">
              <Go to={{ v: "utah" }} reset className="button primary-link">
                Utah at a glance
              </Go>
            </div>
          </li>
          <li>
            <h3>Where does a measure stand, state by state?</h3>
            <p className="small">
              A map of the United States with every state's value, a ranked list of the same numbers and a table. Pick drinking, alcohol sold, taxes,
              spending, retail sales or alcohol-impaired-driving deaths; click a state for its trend and sources. Utah is outlined.
            </p>
            <div className="row-actions">
              <Go to={{ v: "map", mm: "alcohol_per_adult", bv: "wine" }} reset className="button primary-link">
                Wine sold per adult
              </Go>
              <Go to={{ v: "map", mm: "retail_change" }} reset>
                Retail sales, change from a year earlier
              </Go>
              <Go to={{ v: "map", mm: "adults_binge" }} reset>
                Adults who binge drank
              </Go>
            </div>
          </li>
          <li>
            <h3>Is wine rising while beer falls?</h3>
            <p className="small">
              Beer, wine and spirits side by side for any state and the nation, on one scale, with each one's share of the pure alcohol; and what
              Utah's state liquor stores sell, month by month.
            </p>
            <div className="row-actions">
              <Go to={{ v: "beverages" }} reset className="button primary-link">
                Beer, wine and spirits
              </Go>
            </div>
          </li>
          <li>
            <h3>Where does each state's alcohol money come from?</h3>
            <p className="small">
              Taxes, license fees, state-store receipts and profit, side by side for every state and never added together, with why states without
              liquor stores still collect alcohol revenue.
            </p>
            <div className="row-actions">
              <Go to={{ v: "fiscal" }} reset className="button primary-link">
                Revenue by state
              </Go>
            </div>
          </li>
        </ul>
      </section>

      <SavedList />

      <section className="panel" aria-labelledby="st-know">
        <h2 id="st-know">Before drawing conclusions</h2>
        <ul className="small source-list">
          <li>Everything here is descriptive. A change after a law took effect is not proof the law caused it; prices, taxes, the economy, tourism and the pandemic move too.</li>
          <li>
            Grocery-wine law is verified over time for only {verifiedStates.length} states ({verifiedStates.map((g) => g.name).join(", ")}). For the rest the dataset has, at most, a
            recent snapshot of current law, which says nothing about earlier years.
          </li>
          <li>Utah sells wine through state stores, so most of its alcohol money is store profit, not tax. Tax figures from other states do not translate directly.</li>
          <li>Policy records and Utah's state-store figures are machine-assisted or hand-transcribed and have not been reviewed by a person.</li>
          <li>
            The data views (Map, Beer, wine & spirits, Revenue by state, Explore, Compare, Coverage, Policy timeline, Policy matrix, Sources) show everything the tools use, with a link from every value to its
            source. Dataset {man.data.dataset.release_label}; law as of {man.data.dataset.law_as_of_date}.
          </li>
        </ul>
      </section>
    </>
  );
}

function CrossStateForm({ idx, geos }: { idx: MetricsIndex; geos: Geography[] }) {
  const states = geos.filter((g) => g.geo_level === "state");
  const [picked, setPicked] = useState<string[]>(["state:49", "state:47", "state:51", "state:21", "state:16"]);
  const [topic, setTopic] = useState("revenue");
  const [format, setFormat] = useState("per_resident_21plus");
  const [from, setFrom] = useState(2005);
  const [to, setTo] = useState(2024);
  const addRef = useRef<HTMLSelectElement>(null);
  const t = QUESTION_TOPICS.find((x) => x.id === topic)!;
  const metrics = t.metrics.filter((m) => idx.metrics.some((x) => x.metric_id === m));
  const fmt = FORMATS.find((x) => x.id === format)!;
  const formatOk = !fmt.dollarsOnly || t.dollars;
  const run = (e: FormEvent, view: "explore" | "compare") => {
    e.preventDefault();
    if (view === "compare") {
      navigate({ v: "compare", st: picked.join(","), y: to }, { reset: true });
      return;
    }
    navigate(
      {
        v: "explore",
        m: metrics.join(","),
        g: picked.join(",") || "none",
        y0: Math.min(from, to),
        y1: Math.max(from, to),
        tf: !formatOk || format === "nominal" ? null : format,
        base: format === "index" ? Math.min(from, to) : null,
        pd: "ordinary_grocery_wine_authorization",
      },
      { reset: true },
    );
  };
  return (
    <form onSubmit={(e) => run(e, "explore")} aria-label="Compare states">
      <div className="field small">
        States ({picked.length} of 6)
        <div className="row-actions" style={{ margin: 0 }}>
          {picked.map((g) => (
            <button
              type="button"
              key={g}
              aria-label={`Remove ${geoName(g, geos)}`}
              onClick={() => {
                setPicked(picked.filter((x) => x !== g));
                setTimeout(() => addRef.current?.focus(), 0);
              }}
            >
              {geoName(g, geos)} ✕
            </button>
          ))}
        </div>
      </div>
      <div className="controls">
        {picked.length < 6 && (
          <label>
            Add a state
            <select ref={addRef} value="" onChange={(e) => e.target.value && setPicked([...picked, e.target.value])}>
              <option value="">Choose…</option>
              {states
                .filter((g) => !picked.includes(g.geo_id))
                .map((g) => (
                  <option key={g.geo_id} value={g.geo_id}>
                    {g.name}
                  </option>
                ))}
            </select>
          </label>
        )}
        <label>
          Topic
          <select value={topic} onChange={(e) => setTopic(e.target.value)}>
            {QUESTION_TOPICS.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </select>
          <span className="help">{TOPICS.find((x) => x.id === topic)?.help}</span>
        </label>
        <label>
          Show values as
          <select value={format} onChange={(e) => setFormat(e.target.value)}>
            {FORMATS.map((x) => (
              <option key={x.id} value={x.id} disabled={x.dollarsOnly && !t.dollars}>
                {x.label}
                {x.dollarsOnly && !t.dollars ? " (dollar amounts only)" : ""}
              </option>
            ))}
          </select>
          <span className="help">{formatOk ? fmt.help : "Not available for this topic: conversions apply to dollar amounts only. Shown as published."}</span>
        </label>
        <label>
          From
          <input type="number" min={1970} max={2026} value={from} onChange={(e) => setFrom(Number(e.target.value) || from)} />
        </label>
        <label>
          To
          <input type="number" min={1970} max={2026} value={to} onChange={(e) => setTo(Number(e.target.value) || to)} />
        </label>
      </div>
      <p className="help">
        Shows: {metrics.map((m) => idx.metrics.find((x) => x.metric_id === m)?.label).join("; ")}. Each gets its own chart.
      </p>
      <div className="row-actions">
        <button type="submit" className="primary" disabled={!picked.length}>
          Show trends
        </button>
        <button type="button" onClick={(e) => run(e as unknown as FormEvent, "compare")} disabled={!picked.length}>
          Side by side for {Math.max(from, to)}
        </button>
      </div>
    </form>
  );
}

function SavedList() {
  const [saved, setSaved] = useState<SavedRecord[]>(() => readSaved(browserStorage()));
  const [msg, setMsg] = useState("");
  const open = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const r = parseRecordFile(await file.text(), VIEWS);
      window.history.pushState(null, "", window.location.pathname + restoreSearch(r));
      window.dispatchEvent(new PopStateEvent("popstate"));
    } catch (x) {
      setMsg(`Could not open ${file.name}: ${(x as Error).message}`);
    }
  };
  const remove = (r: SavedRecord) => {
    writeSaved(
      browserStorage(),
      saved.filter((x) => x.build_id !== "" && !(x.name === r.name && x.view === r.view && x.saved_at === r.saved_at)),
    );
    setSaved(readSaved(browserStorage()));
    setMsg(`Removed “${r.name}”.`);
  };
  return (
    <section className="panel" aria-labelledby="st-saved">
      <h2 id="st-saved">Your saved analyses</h2>
      {saved.length === 0 ? (
        <p className="small muted">Nothing saved in this browser yet. Every tool has a “Save, share or print” section at the bottom.</p>
      ) : (
        <ul className="small source-list">
          {saved.map((r) => (
            <li key={`${r.view}|${r.name}|${r.saved_at}`}>
              <a
                href={restoreSearch(r)}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                  e.preventDefault();
                  window.history.pushState(null, "", window.location.pathname + restoreSearch(r));
                  window.dispatchEvent(new PopStateEvent("popstate"));
                }}
              >
                {r.name}
              </a>{" "}
              <span className="muted">
                ({TOOL_NAMES[r.view] ?? r.view}
                {r.saved_at ? `, ${r.saved_at.slice(0, 10)}` : ""}
                {r.build_id ? `, build ${r.build_id}` : ""})
              </span>{" "}
              {r.build_id !== "" && (
                <button type="button" className="link small" onClick={() => remove(r)} aria-label={`Remove ${r.name}`}>
                  remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <label className="file-pick small">
        Open a saved analysis file <input type="file" accept="application/json,.json" onChange={open} />
      </label>
      <p className="small" role="status">
        {msg}
      </p>
    </section>
  );
}
