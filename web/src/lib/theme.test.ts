import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyTheme, readTheme, THEME_COLOR, THEME_KEY, writeTheme } from "./theme";

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
const css = read("../styles.css");

const tokens = (block: string) => Object.fromEntries([...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
const grab = (re: RegExp) => {
  const m = css.match(re);
  if (!m) throw new Error(`styles.css: no block ${re}`);
  return tokens(m[1]);
};
const light = grab(/\n:root,\n\[data-theme="light"\] \{\n([\s\S]*?)\n\}/);
const darkDevice = grab(/@media screen and \(prefers-color-scheme: dark\) \{\n {2}:root:not\(\[data-theme="light"\]\) \{\n([\s\S]*?)\n {2}\}/);
const darkChosen = grab(/@media screen \{\n {2}\[data-theme="dark"\] \{\n([\s\S]*?)\n {2}\}/);

// WCAG 2.x relative luminance and contrast; translucent colors are composited over their backdrop first.
type RGB = [number, number, number];
const hex = (h: string): RGB => {
  const m = h.match(/^#([0-9a-f]{6})$/i);
  if (!m) throw new Error(`not a 6-digit hex color: ${h}`);
  return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) as RGB;
};
const lin = (c: number) => (c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const lum = (c: RGB) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const contrast = (a: RGB, b: RGB) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const over = (fg: RGB, alpha: number, bg: RGB) => fg.map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha))) as RGB;
// OKLab distance, with deuteranopia and protanopia simulated (Machado 2009, full severity).
const oklab = (c: RGB) => {
  const [r, g, b] = c.map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
};
const CVD: Record<string, number[][] | null> = {
  normal: null,
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
};
const simulate = (c: RGB, m: number[][] | null): RGB => {
  if (!m) return c;
  const v = c.map(lin);
  return m.map((row) => {
    const x = Math.min(1, Math.max(0, row[0] * v[0] + row[1] * v[1] + row[2] * v[2]));
    return Math.round(255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055));
  }) as RGB;
};
const distance = (a: RGB, b: RGB) => Math.hypot(...oklab(a).map((v, i) => v - oklab(b)[i]));

describe("appearances in styles.css", () => {
  it("every token has a value in every appearance, and the two dark copies are identical", () => {
    expect(Object.keys(light).length).toBeGreaterThan(60);
    expect(Object.keys(darkDevice).sort()).toEqual(Object.keys(light).sort());
    expect(darkChosen).toEqual(darkDevice);
  });

  for (const [name, t] of [["light", light], ["dark", darkDevice]] as const) {
    const c = (k: string) => hex(t[k]);
    it(`${name}: text and marks meet WCAG contrast`, () => {
      const fails: string[] = [];
      const need = (label: string, a: RGB, b: RGB, min: number) => {
        const r = contrast(a, b);
        if (r < min) fails.push(`${label} ${r.toFixed(2)} < ${min}`);
      };
      const text = (fg: string, bgs: string[], min = 4.5) => bgs.forEach((bg) => need(`${fg} on ${bg}`, c(fg), c(bg), min));
      text("text", ["bg", "surface", "surface-2", "note-bg", "warn-bg"]);
      text("text-2", ["bg", "surface", "surface-2", "note-bg", "warn-bg"]);
      text("accent", ["bg", "surface", "surface-2", "note-bg"]); // links
      need("accent-text on accent", c("accent-text"), c("accent"), 4.5);
      text("warn-line", ["surface", "warn-bg"]); // also a text color (.control-badge)
      text("map-utah", ["surface"]); // Utah's name in rank lists
      text("ok", ["surface", "bg"]);
      text("focus", ["bg", "surface", "surface-2"], 3);
      text("line-strong", ["surface", "bg"], 3); // control borders
      for (const s of ["S", "D", "R", "K", "P", "C", "L"]) need(`st-ink-dark on st-${s}`, c("st-ink-dark"), c(`st-${s}`), 4.5);
      for (const s of ["0", "M", "N", "F", "Q", "none"]) need(`st-ink-light on st-${s}`, c("st-ink-light"), c(`st-${s}`), 4.5);
      need("fixed ink on st-U", hex("#1d1f22"), c("st-U"), 4.5);
      need("text-2 on st-dot", c("text-2"), c("st-dot"), 4.5);
      for (const k of ["gain", "loss", "total", "c-state", "c-tax", "c-wholesaler"]) need(`bar-ink on ${k}`, c("bar-ink"), c(k), 4.5);
      need("c-supplier-ink on c-supplier", c("c-supplier-ink"), c("c-supplier"), 4.5);
      need("c-grocer-ink on c-grocer", c("c-grocer-ink"), c("c-grocer"), 4.5);
      const marks = ["series-1", "series-2", "series-3", "series-4", "series-5", "series-6", "bev-beer", "bev-wine", "bev-spirits", "bev-other", "gain", "loss", "total", "c-state", "c-tax", "c-wholesaler", "map-utah"];
      for (const k of marks) need(`${k} on surface`, c(k), c("surface"), 3);
      // Public Funding: map symbols in --text over a cell filled at 0.4 opacity; other states' bars at 0.75.
      for (const k of ["series-1", "series-3", "series-6", "line-strong"]) need(`text on ${k} at 0.4`, c("text"), over(c(k), 0.4, c("surface")), 4.5);
      need("series-1 at 0.75 on surface", over(c("series-1"), 0.75, c("surface")), c("surface"), 3);
      expect(fails).toEqual([]);
    });

    it(`${name}: the six chart series stay apart, including under red-green color blindness`, () => {
      const keys = [1, 2, 3, 4, 5, 6].map((i) => `series-${i}`);
      const floor: Record<string, number> = { normal: 0.07, deutan: 0.025, protan: 0.025 };
      for (const [kind, m] of Object.entries(CVD)) {
        let min = Infinity;
        for (let i = 0; i < keys.length; i++)
          for (let j = i + 1; j < keys.length; j++) min = Math.min(min, distance(simulate(c(keys[i]), m), simulate(c(keys[j]), m)));
        expect(min, `${kind}`).toBeGreaterThanOrEqual(floor[kind]);
      }
    });

    it(`${name}: each color a chart caption names is that color`, () => {
      // Captions in BottleBreakdown, Briefing, Designs, Funding, Map and SamePrice say "teal is the state", "Utah is red"...
      const NAMED: Record<string, string[]> = {
        teal: ["series-1", "c-state", "c-tax"],
        red: ["series-2", "map-utah"],
        blue: ["series-3"],
        purple: ["series-6"],
        orange: ["c-wholesaler", "c-grocer"],
        gray: ["c-supplier", "total"],
      };
      const HUES: [string, number, number][] = [["red", 10, 40], ["orange", 45, 80], ["teal", 170, 205], ["blue", 230, 270], ["purple", 290, 330]];
      const hueOf = (k: string) => {
        const [, a, b] = oklab(c(k));
        if (Math.hypot(a, b) < 0.05) return "gray";
        const h = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
        return HUES.find(([, lo, hi]) => h >= lo && h <= hi)?.[0] ?? `hue ${Math.round(h)}`;
      };
      const wrong = Object.entries(NAMED).flatMap(([word, ks]) => ks.filter((k) => hueOf(k) !== word).map((k) => `${k} is ${hueOf(k)}; captions say ${word}`));
      expect(wrong).toEqual([]);
    });
  }

  it("theme-color is each appearance's header color", () => {
    expect(THEME_COLOR.light).toBe(light.surface);
    expect(THEME_COLOR.dark).toBe(darkDevice.surface);
  });
});

describe("saved appearance (lib/theme.ts)", () => {
  const store = (v: string | null, throws = false) => ({
    getItem: (k: string) => {
      if (throws) throw new Error("blocked");
      return k === THEME_KEY ? v : null;
    },
  });
  it("reads only the three choices; missing, junk or blocked storage is Match my device", () => {
    expect(readTheme(store("dark"))).toBe("dark");
    expect(readTheme(store("light"))).toBe("light");
    expect(readTheme(store(null))).toBe("system");
    expect(readTheme(store("purple"))).toBe("system");
    expect(readTheme(store("dark", true))).toBe("system");
    expect(readTheme(null)).toBe("system");
  });
  it("Match my device removes the key; a refusing browser is reported, not thrown", () => {
    const kept = new Map<string, string>();
    const s = { setItem: (k: string, v: string) => void kept.set(k, v), removeItem: (k: string) => void kept.delete(k) };
    expect(writeTheme(s, "dark")).toBe(true);
    expect(kept.get(THEME_KEY)).toBe("dark");
    expect(writeTheme(s, "system")).toBe(true);
    expect(kept.size).toBe(0);
    const refuses = { setItem: () => { throw new Error("quota"); }, removeItem: () => {} };
    expect(writeTheme(refuses, "light")).toBe(false);
    expect(writeTheme(null, "light")).toBe(false);
  });

  // A stand-in document with <html> and the two theme-color metas, enough for applyTheme and public/theme.js.
  const fakeDoc = () => {
    const attrs = new Map<string, string>();
    const meta = (media: string) => {
      const a = new Map([["media", media], ["content", ""]]);
      return { getAttribute: (k: string) => a.get(k) ?? null, setAttribute: (k: string, v: string) => void a.set(k, v) };
    };
    const metas = [meta("(prefers-color-scheme: light)"), meta("(prefers-color-scheme: dark)")];
    return {
      attrs,
      metas,
      documentElement: { setAttribute: (k: string, v: string) => void attrs.set(k, v), removeAttribute: (k: string) => void attrs.delete(k) },
      querySelectorAll: () => metas,
    };
  };
  const contents = (d: ReturnType<typeof fakeDoc>) => d.metas.map((m) => m.getAttribute("content"));

  it("applyTheme sets data-theme and the address-bar color; Match my device restores each meta's own", () => {
    const d = fakeDoc();
    applyTheme(d as unknown as Document, "dark");
    expect(d.attrs.get("data-theme")).toBe("dark");
    expect(contents(d)).toEqual([THEME_COLOR.dark, THEME_COLOR.dark]);
    applyTheme(d as unknown as Document, "system");
    expect(d.attrs.has("data-theme")).toBe(false);
    expect(contents(d)).toEqual([THEME_COLOR.light, THEME_COLOR.dark]);
  });

  it("public/theme.js (the before-paint script) agrees with lib/theme.ts", () => {
    const src = read("../../public/theme.js");
    const run = (saved: string | null, throws = false) => {
      const d = fakeDoc();
      new Function("window", "document", src)({ localStorage: store(saved, throws) }, d);
      return d;
    };
    for (const t of ["light", "dark"] as const) {
      const d = run(t);
      expect(d.attrs.get("data-theme")).toBe(t);
      expect(contents(d)).toEqual([THEME_COLOR[t], THEME_COLOR[t]]);
    }
    for (const d of [run(null), run("system"), run("<script>"), run("dark", true)]) {
      expect(d.attrs.has("data-theme")).toBe(false);
      expect(contents(d)).toEqual(["", ""]);
    }
  });
});
