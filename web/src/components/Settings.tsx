// Settings: a gear at the top right of the header opens a dialog with the appearance choice (lib/theme.ts). The
// dialog is a native modal <dialog>: Escape closes it and focus stays inside while open. Focus starts on the chosen
// option and returns to the gear on close. The site's text pages drop all of this (prerender removes .app-settings).
import { useRef, useState } from "react";
import { browserStorage } from "../lib/analysis";
import { applyTheme, readTheme, THEME_KEY, THEME_LABELS, THEMES, writeTheme, type Theme } from "../lib/theme";

/** A preview drawn with that appearance's own tokens (data-theme on the tile), so it shows what it offers. */
function Tile({ t }: { t: "light" | "dark" }) {
  return (
    <span className="theme-tile" data-theme={t}>
      <span className="theme-tile-card">
        Aa
        <span className="theme-tile-dot" />
      </span>
    </span>
  );
}

export function Settings() {
  const dialog = useRef<HTMLDialogElement>(null);
  const gear = useRef<HTMLButtonElement>(null);
  const [theme, setTheme] = useState<Theme>(() => readTheme(browserStorage()));
  const [kept, setKept] = useState(true);

  const open = () => {
    dialog.current?.showModal();
    dialog.current?.querySelector<HTMLInputElement>("input:checked")?.focus();
  };
  const choose = (t: Theme) => {
    setTheme(t);
    applyTheme(document, t);
    setKept(writeTheme(browserStorage(), t));
  };

  return (
    <div className="app-settings">
      <button ref={gear} type="button" className="gear" aria-label="Settings" aria-haspopup="dialog" aria-controls="settings" onClick={open}>
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z"
          />
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
            d="M19.1 13.9a1.5 1.5 0 0 0 .3 1.65l.05.05a1.8 1.8 0 1 1-2.55 2.55l-.05-.05a1.5 1.5 0 0 0-1.65-.3 1.5 1.5 0 0 0-.91 1.37V19.5a1.8 1.8 0 1 1-3.6 0v-.1a1.5 1.5 0 0 0-.98-1.37 1.5 1.5 0 0 0-1.65.3l-.05.05A1.8 1.8 0 1 1 4.46 15.8l.05-.05a1.5 1.5 0 0 0 .3-1.65 1.5 1.5 0 0 0-1.37-.91H3.3a1.8 1.8 0 1 1 0-3.6h.1a1.5 1.5 0 0 0 1.37-.98 1.5 1.5 0 0 0-.3-1.65l-.05-.05A1.8 1.8 0 1 1 7 4.36l.05.05a1.5 1.5 0 0 0 1.65.3h.07a1.5 1.5 0 0 0 .91-1.37V3.3a1.8 1.8 0 1 1 3.6 0v.1a1.5 1.5 0 0 0 .91 1.37 1.5 1.5 0 0 0 1.65-.3l.05-.05a1.8 1.8 0 1 1 2.55 2.55l-.05.05a1.5 1.5 0 0 0-.3 1.65v.07a1.5 1.5 0 0 0 1.37.91h.2a1.8 1.8 0 1 1 0 3.6h-.1a1.5 1.5 0 0 0-1.37.91Z"
          />
        </svg>
      </button>
      <dialog
        ref={dialog}
        id="settings"
        className="settings"
        aria-labelledby="settings-h"
        onClose={() => gear.current?.focus()}
        onClick={(e) => e.target === dialog.current && dialog.current.close()}
      >
        <div className="settings-in">
          <div className="settings-head">
            <h2 id="settings-h">Settings</h2>
            <button type="button" className="settings-close" aria-label="Close settings" onClick={() => dialog.current?.close()}>
              <span aria-hidden="true">×</span>
            </button>
          </div>
          <fieldset className="theme-choice">
            <legend>Appearance</legend>
            {THEMES.map((t) => (
              <label key={t} className="theme-option">
                <input type="radio" name="theme" value={t} checked={theme === t} onChange={() => choose(t)} />
                <span className="theme-tiles" aria-hidden="true">
                  {t === "system" ? (
                    <>
                      <Tile t="light" />
                      <Tile t="dark" />
                    </>
                  ) : (
                    <Tile t={t} />
                  )}
                </span>
                {THEME_LABELS[t]}
              </label>
            ))}
          </fieldset>
          <p className="small muted">
            A choice other than Match my device is kept in this browser only, under <span className="mono">{THEME_KEY}</span>.
            The text versions of pages have no script, so they always match your device.
          </p>
          {!kept && (
            <p className="small warn" role="status">
              This browser would not save the choice, so it lasts until you leave this page.
            </p>
          )}
        </div>
      </dialog>
    </div>
  );
}
