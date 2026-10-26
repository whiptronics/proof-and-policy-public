// Definitions and methods. Vocabularies come from the export; the prose explains how the pages use them.
import { ErrorNote, Loading, StateBadge } from "../components/common";
import { useData } from "../lib/data";
import { FORMULA_VERSION } from "../lib/formulas";
import { words } from "../lib/format";
import type { Coverage, MetricsIndex, PolicyData } from "../lib/types";

export function MethodsView() {
  const cov = useData<Coverage>("coverage.json");
  const idx = useData<MetricsIndex>("metrics.json");
  const pol = useData<PolicyData>("policy.json");
  if (cov.error ?? idx.error ?? pol.error) return <ErrorNote error={(cov.error ?? idx.error ?? pol.error)!} />;
  if (!cov.data || !idx.data || !pol.data) return <Loading what="definitions" />;
  return (
    <div className="grid-2">
      <section className="panel">
        <h2>Coverage states</h2>
        <p className="small">Every coverage cell carries one state, shown with a symbol and words as well as a color.</p>
        <div className="table-wrap">
          <table className="data">
            <tbody>
              {Object.entries(cov.data.states).map(([code, s]) => (
                <tr key={code}>
                  <td>
                    <StateBadge code={code} />
                  </td>
                  <td className="small">{s.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small">
          A reviewed survey estimate is still an estimate: review status says a person checked the transcription, not that
          the value is certain. Family views count metrics with explicit denominators. {cov.data.denominator_rule}
        </p>
      </section>
      <section className="panel">
        <h2>Legal status vocabularies</h2>
        {Object.entries(pol.data.statuses).map(([k, v]) => (
          <div key={k}>
            <h3>{words(k)} status</h3>
            <dl className="kv">
              {Object.entries(v).map(([code, d]) => (
                <div key={code} style={{ display: "contents" }}>
                  <dt className="mono">{code}</dt>
                  <dd className="small">{d}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
        <p className="small">
          A <strong>snapshot</strong> proves that a version was printed on a date. A <strong>verified interval</strong>{" "}
          also needs evidence that nothing changed in between (for Utah, an inventory of every session that could have
          amended the section). Timeline days outside verified intervals are drawn as unknown; a snapshot is never
          stretched over missing years. Legal effective dates, enactment dates and operational (first-sale) dates are
          kept apart, and an unknown date stays unknown — no January 1 is filled in.
        </p>
      </section>
      <section className="panel">
        <h2>Conversions and formulas</h2>
        <p className="small">Computed by the Python export ({Object.values(idx.data.conversion_methods)[0]?.split(":")[0]}) and shipped with their inputs:</p>
        <ul className="small source-list">
          {Object.entries(idx.data.conversion_methods).map(([k, v]) => (
            <li key={k}>
              <span className="mono">{v}</span>
            </li>
          ))}
        </ul>
        <p className="small">
          <strong>Fiscal-year alignment.</strong> A fiscal-year amount is deflated by the CPI-U (U.S. city average, all
          items, not seasonally adjusted) averaged over that fiscal year's own 12 months, rebased to the calendar-2024
          average; if any month is missing (October 2025 was not published) the converted value is missing. Per-person
          values divide by the Census July 1 estimate falling inside the fiscal year, all ages or ages 21+ (21+ exists from
          2000). Fiscal years are never relabelled as calendar years; NIAAA's calendar-year denominators are never used for
          fiscal amounts.
        </p>
        <p className="small">
          Computed in the page ({FORMULA_VERSION}), because the reader picks the base: percent change = 100 × (later −
          earlier) ÷ earlier; index = 100 × value ÷ base-year value. Both are undefined, not zero or infinite, when the
          base is zero or missing.
        </p>
        <p className="small">
          <strong>Transition periods.</strong> A change that takes effect part-way through a fiscal or calendar year is
          shaded as a transition period. No value is prorated to imitate a full year under either regime.
        </p>
      </section>
      <section className="panel">
        <h2>Comparisons</h2>
        <ul className="small source-list">
          <li>
            Series share a chart panel only when unit, period kind and age universe agree; otherwise they get separate
            panels. Lines break at missing years and at comparability-group changes (e.g. BRFSS 2011), never interpolate.
          </li>
          <li>Different geography levels (city, county, metro, state) are never compared without an explicit label.</li>
          <li>Per capita consumption is never divided by a drinking prevalence ("consumption per drinker").</li>
          <li>
            Fiscal components overlap (net profit is after the listed transfers; gross profit is part of sales), so no
            total is computed. Wine-only and all-alcohol amounts are never joined into one series.
          </li>
          <li>Comparison states are chosen by the reader or from a documented shortlist. No similarity score is computed.</li>
          <li>Nothing here estimates a causal effect; there is no effect calculator.</li>
        </ul>
        <p className="small">The rules are a port of src/alcohol_data/compare.py and are tested against vectors generated from it.</p>
      </section>
      <section className="panel">
        <h2>Downloads and CSV convention</h2>
        <p className="small">
          UTF-8, CRLF line ends, RFC 4180 quoting. Text fields beginning with = + - @ TAB or CR are prefixed with an
          apostrophe so spreadsheets do not execute them; number fields are never altered, so −5 stays −5, an empty field is
          missing and 0 is an observed zero. Each bundle has observations.csv, measures.csv, sources.csv, filters.json and a
          README explaining the joins.
        </p>
      </section>
      <section className="panel">
        <h2>Metric families</h2>
        <ul className="small source-list">
          {Object.entries(idx.data.families).map(([k, f]) => (
            <li key={k}>
              <strong>{f.label}.</strong> {f.description}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
