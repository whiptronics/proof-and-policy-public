// The reader's appearance choice: Match my device (the default), Light or Dark. A choice is data-theme on <html>;
// styles.css holds the palettes. public/theme.js applies a saved choice before the first paint (a same-origin file,
// because the site's Content-Security-Policy allows no inline script); lib/theme.test.ts keeps it in step with this
// file. The /read/ text pages carry no script, so they always follow the device.
export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_LABELS: Record<Theme, string> = { system: "Match my device", light: "Light", dark: "Dark" };

/** The one browser-storage key this choice uses, named like the saved-analysis keys (lib/analysis.ts, lib/saved.ts). */
export const THEME_KEY = "alcohol-dashboard.theme.v1";

/** The header color (--surface) of each appearance, for <meta name="theme-color">; the test checks it against styles.css. */
export const THEME_COLOR = { light: "#ffffff", dark: "#1d3549" } as const;

const isTheme = (v: unknown): v is Theme => typeof v === "string" && (THEMES as readonly string[]).includes(v);

/** The saved choice; anything missing, unknown or unreadable (blocked storage) is "system". */
export function readTheme(storage: Pick<Storage, "getItem"> | null): Theme {
  try {
    const v = storage?.getItem(THEME_KEY);
    return isTheme(v) ? v : "system";
  } catch {
    return "system";
  }
}

/** Save the choice ("system" removes the key). Returns false when the browser refuses; the choice still holds on this page. */
export function writeTheme(storage: Pick<Storage, "setItem" | "removeItem"> | null, t: Theme): boolean {
  try {
    if (!storage) return false;
    if (t === "system") storage.removeItem(THEME_KEY);
    else storage.setItem(THEME_KEY, t);
    return true;
  } catch {
    return false;
  }
}

/** Paint a choice: the attribute, and the address-bar color (each meta keeps its own media query for "system"). */
export function applyTheme(doc: Document, t: Theme) {
  if (t === "system") doc.documentElement.removeAttribute("data-theme");
  else doc.documentElement.setAttribute("data-theme", t);
  for (const m of doc.querySelectorAll('meta[name="theme-color"]')) {
    const own = (m.getAttribute("media") ?? "").includes("dark") ? THEME_COLOR.dark : THEME_COLOR.light;
    m.setAttribute("content", t === "system" ? own : THEME_COLOR[t]);
  }
}
