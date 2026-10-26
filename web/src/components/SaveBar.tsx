// Save, share and print for every tool. What is saved is the tool's address (all its inputs) plus the
// dataset build and calculation-method version, so a saved analysis restores exactly and says when the
// data have changed since.
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { browserStorage, readStored, writeStored } from "../lib/analysis";
import { saveFile } from "../lib/csv";
import { cleanParams, parseRecordFile, readSaved, recordFile, restoreSearch, writeSaved, SAVED_FORMAT, type SavedRecord } from "../lib/saved";
import type { Manifest } from "../lib/types";
import { VIEWS, applyPatch, useParams, type Patch } from "../lib/url";

/** Print the page with every collapsed section open, then put them back. */
export function printReport() {
  const closed = [...document.querySelectorAll("main details:not([open])")];
  for (const d of closed) d.setAttribute("open", "");
  window.print();
  for (const d of closed) d.removeAttribute("open");
}

function go(search: string) {
  window.history.pushState(null, "", window.location.pathname + search);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo(0, 0);
}

/** Says when the inputs on screen were saved with a different build or method than the one running. */
export function BuildNotice({ manifest, method }: { manifest: Manifest; method: string | null }) {
  const params = useParams();
  const sb = params.get("sb");
  const sm = params.get("sm");
  const build = manifest.dataset.build_id;
  if (!sb && !sm) return null;
  const otherBuild = sb && sb !== build;
  const otherMethod = sm && method && sm !== method;
  if (!otherBuild && !otherMethod) {
    return (
      <p className="note small" role="note">
        Restored from a saved analysis made with this build ({build}){method ? ` and method ${method}` : ""}; the results should match.
      </p>
    );
  }
  return (
    <p className="warn small" role="note">
      Restored from a saved analysis made with {otherBuild ? `build ${sb}` : `build ${build}`}
      {otherMethod ? ` and method ${sm}` : ""}. You are viewing build {build}
      {method ? ` with method ${method}` : ""}. The inputs are as saved; the values come from this build and may differ.
    </p>
  );
}

export function SaveBar({
  view,
  method,
  manifest,
  defaultName,
  results,
  csv,
  inputs,
}: {
  view: string;
  method: string | null;
  manifest: Manifest;
  defaultName: string;
  /** A snapshot of the results for the downloaded file (observations and assumptions kept apart). */
  results?: () => unknown;
  /** The results table as CSV. */
  csv?: { name: string; make: () => string };
  /** Every input written out, so a saved analysis does not depend on today's defaults. */
  inputs?: Patch;
}) {
  const [stored, setStored] = useState<SavedRecord[]>(() => readSaved(browserStorage()));
  const [label, setLabel] = useState("");
  const [msg, setMsg] = useState("");
  const nameInput = useRef<HTMLInputElement>(null);
  const mine = stored.filter((r) => r.view === view);
  const record = (name: string, withResults: boolean): SavedRecord => ({
    format: SAVED_FORMAT,
    name,
    saved_at: new Date().toISOString(),
    view,
    params: cleanParams(inputs ? applyPatch("", inputs, true) : window.location.search),
    build_id: manifest.dataset.build_id,
    release: manifest.dataset.release_label,
    method,
    ...(withResults && results ? { results: results() } : {}),
  });
  // Records without a build are Explore selections saved before format 2; they live in the old store.
  const current = () => stored.filter((r) => r.build_id !== "");
  const save = (e: FormEvent) => {
    e.preventDefault();
    const name = label.trim() || defaultName;
    const next = [...current().filter((r) => !(r.name === name && r.view === view)), record(name, false)];
    const ok = writeSaved(browserStorage(), next);
    setStored(readSaved(browserStorage()));
    setMsg(ok ? `Saved “${name}” in this browser.` : "This browser would not store it (storage is blocked or full). Download the file instead.");
    setLabel("");
  };
  const remove = (r: SavedRecord) => {
    if (r.build_id === "") writeStored(browserStorage(), readStored(browserStorage()).filter((e) => e.name !== r.name));
    else writeSaved(browserStorage(), current().filter((x) => !(x.name === r.name && x.view === r.view && x.saved_at === r.saved_at)));
    setStored(readSaved(browserStorage()));
    setMsg(`Removed “${r.name}”.`);
    setTimeout(() => nameInput.current?.focus(), 0);
  };
  const copy = () => {
    const url = window.location.origin + window.location.pathname + restoreSearch(record("link", false));
    const fail = () => setMsg(`Could not copy. The link is: ${url}`);
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => setMsg("Link copied. It restores these inputs and names this build."), fail);
    else fail();
  };
  const download = () => {
    const r = record(label.trim() || defaultName, true);
    saveFile(`${view}_analysis.json`, recordFile(r), "application/json");
    setMsg("Downloaded the analysis file. Open it here later with “Open a saved file”.");
  };
  const open = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const r = parseRecordFile(await file.text(), VIEWS);
      go(restoreSearch(r));
      setMsg(`Opened “${r.name}”.`);
    } catch (x) {
      setMsg(`Could not open ${file.name}: ${(x as Error).message}`);
    }
  };

  return (
    <section className="panel no-print" aria-labelledby={`save-${view}`}>
      <h2 id={`save-${view}`}>Save, share or print</h2>
      <p className="small muted">
        Saving keeps every input on this page, the dataset build ({manifest.dataset.build_id}){method ? ` and the calculation method (${method})` : ""}. Restoring
        it later recomputes the results from the data then loaded and warns if the build has changed.
      </p>
      <div className="row-actions">
        {csv && (
          <button type="button" className="primary" onClick={() => saveFile(csv.name, csv.make(), "text/csv;charset=utf-8")}>
            Download results (CSV)
          </button>
        )}
        <button type="button" onClick={printReport}>
          Print or save as PDF
        </button>
        <button type="button" onClick={copy}>
          Copy link
        </button>
        <button type="button" onClick={download}>
          Download analysis file
        </button>
        <label className="file-pick">
          Open a saved file <input type="file" accept="application/json,.json" onChange={open} />
        </label>
      </div>
      <form className="controls" onSubmit={save}>
        <label>
          Name
          <input ref={nameInput} value={label} onChange={(e) => setLabel(e.target.value)} placeholder={defaultName} maxLength={120} />
        </label>
        <button type="submit">Save in this browser</button>
      </form>
      {mine.length > 0 && (
        <>
          <h3 className="small">Saved in this browser</h3>
          <ul className="small source-list">
            {mine.map((r) => (
              <li key={`${r.name}|${r.saved_at}`}>
                <a
                  href={restoreSearch(r)}
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                    e.preventDefault();
                    go(restoreSearch(r));
                  }}
                >
                  {r.name}
                </a>{" "}
                <span className="muted">
                  ({r.saved_at ? r.saved_at.slice(0, 10) : "date not recorded"}
                  {r.build_id ? `, build ${r.build_id}` : ""})
                </span>{" "}
                <button type="button" className="link small" onClick={() => remove(r)} aria-label={`Remove ${r.name} from this browser`}>
                  remove
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="small" role="status">
        {msg}
      </p>
    </section>
  );
}
