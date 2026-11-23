// One tooltip for every chart: what is under the pointer, in the words and number format of that chart's table.
//
// A mark carries tipAttr(rowTip(row)) (lib/tip.ts): the same row, built by the same function, that the chart's table
// prints, and cellText formats it exactly as those tables do, so the tooltip and the table cannot disagree. Charts drawn
// by Recharts hand over their hovered category through RechartsTip, with rows built the same way.
//
// WCAG 1.4.13: the pointer can move onto the tooltip and it stays, even across neighboring marks on the way (another mark
// takes over only after SWITCH ms); Escape dismisses it without moving anything; it stays until the pointer leaves the
// mark and the tooltip. A tap shows it on a touch screen; a tap elsewhere closes it. It is
// placed beside the mark, never over it, and inside the viewport. It adds no tab stop: keyboard and screen-reader
// readers have the tables, so the tooltip is aria-hidden. The SVG download gets each mark's text as a <title>.
import { useEffect } from "react";
import { placeTip, readTip, type Tip } from "../lib/tip";

// ----- the one tooltip element and its behavior ---------------------------------------------------------------------

const GRACE = 250; // ms to cross from the mark to the tooltip
const SWITCH = 120; // ms before another mark takes over a shown tooltip: the pointer may only be crossing it

let el: HTMLDivElement | null = null;
let anchor: (() => DOMRect | null) | null = null;
let beside = true; // may it go to the anchor's right or left (not for a plot's column)
let shownKey: string | null = null;
let dismissedKey: string | null = null; // Escape: hidden until a different mark is pointed at
let hideTimer: ReturnType<typeof setTimeout> | undefined;
let switchTimer: ReturnType<typeof setTimeout> | undefined;
let switchKey: string | null = null;
let installed = false;

function element(): HTMLDivElement {
  if (el) return el;
  el = document.createElement("div");
  el.className = "chart-tip no-print";
  el.setAttribute("role", "tooltip");
  el.setAttribute("aria-hidden", "true");
  el.hidden = true;
  el.addEventListener("pointerenter", () => {
    clearTimeout(hideTimer);
    cancelSwitch();
  });
  el.addEventListener("pointerleave", (e) => {
    if (!(e.relatedTarget instanceof Element && e.relatedTarget.closest("[data-tip]"))) hideTip(true);
  });
  document.body.appendChild(el);
  new ResizeObserver(() => position()).observe(el); // a late font or a text-size change re-places it
  return el;
}

function position() {
  const t = el;
  const r = anchor?.();
  if (!t || t.hidden) return;
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  // Gone, or scrolled out of sight: a tooltip pinned to the screen's edge would point at nothing.
  if (!r || (r.width === 0 && r.height === 0) || r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) return hideTip();
  const scrolled = t.scrollTop;
  t.style.maxHeight = ""; // measure it whole, then shorten it only if it must scroll
  const p = placeTip(r, t.offsetWidth, t.offsetHeight, vw, vh, beside);
  t.style.maxHeight = p.maxHeight ? `${Math.floor(p.maxHeight)}px` : "";
  t.scrollTop = scrolled;
  t.style.left = `${Math.round(p.left)}px`;
  t.style.top = `${Math.round(p.top)}px`;
}

/** Show `tip` beside the rectangle `at` returns (asked again on scroll and resize). `key` names the mark. */
export function showTip(at: () => DOMRect | null, tip: Tip, key: string, sides = true) {
  if (key === dismissedKey) return;
  dismissedKey = null;
  clearTimeout(hideTimer);
  const t = element();
  if (key !== shownKey) {
    t.replaceChildren();
    if (tip.title) {
      const s = document.createElement("strong");
      s.textContent = tip.title;
      t.append(s);
    }
    for (const [k, v] of tip.rows) {
      const line = document.createElement("div");
      const name = document.createElement("span");
      name.className = "chart-tip-k";
      name.textContent = k;
      line.append(name, ` ${v}`);
      t.append(line);
    }
    if (tip.note) {
      const n = document.createElement("div");
      n.className = "chart-tip-note";
      n.textContent = tip.note;
      t.append(n);
    }
  }
  anchor = at;
  beside = sides;
  shownKey = key;
  t.hidden = false;
  position();
}

function cancelSwitch() {
  clearTimeout(switchTimer);
  switchKey = null;
}

/** From the pointer: with a tooltip already shown, another mark takes over only after a moment, so a pointer crossing
 * neighboring marks on its way to the tooltip (a grid, a dense bar chart) does not drag it away (WCAG 1.4.13). */
export function showTipSoon(at: () => DOMRect | null, tip: Tip, key: string, sides = true) {
  cancelSwitch();
  if (!el || el.hidden || shownKey === null || key === shownKey) return showTip(at, tip, key, sides);
  switchKey = key;
  switchTimer = setTimeout(() => {
    switchKey = null;
    showTip(at, tip, key, sides);
  }, SWITCH);
}

/** Hide now, or after the grace period that lets the pointer reach the tooltip. */
export function hideTip(soon = false) {
  cancelSwitch();
  clearTimeout(hideTimer);
  if (soon) {
    hideTimer = setTimeout(() => hideTip(), GRACE);
    return;
  }
  if (el) el.hidden = true;
  anchor = null;
  shownKey = null;
}

/** Hide only if the tooltip shown belongs to the chart `id` (charts on one page share the element). */
export function hideTipOf(id: string, soon = false) {
  if (switchKey?.startsWith(`${id}:`)) cancelSwitch();
  if (shownKey?.startsWith(`${id}:`)) hideTip(soon);
  if (dismissedKey?.startsWith(`${id}:`)) dismissedKey = null;
}

const keys = new WeakMap<Element, string>();
let nextKey = 0;
const markKey = (m: Element) => {
  if (!keys.has(m)) keys.set(m, `mark${nextKey++}:`);
  return keys.get(m)!;
};
const markOf = (t: EventTarget | null) => (t instanceof Element ? t.closest("[data-tip]") : null);
const showMark = (m: Element, soon = false) => {
  const tip = readTip(m);
  if (tip) (soon ? showTipSoon : showTip)(() => (m.isConnected ? m.getBoundingClientRect() : null), tip, markKey(m));
};

function install() {
  if (installed || typeof document === "undefined") return;
  installed = true;
  // A tap (touch or pen) shows a mark's tooltip when the finger lifts where it went down. Not on click: iOS sends no
  // click for a tap on a plain SVG shape. A scroll cancels the pointer before it lifts, so scrolling opens nothing.
  let down: Element | null = null;
  document.addEventListener("pointerdown", (e) => (down = e.pointerType !== "mouse" && e.target instanceof Element ? e.target : null), true);
  document.addEventListener("pointerup", (e) => {
    const t = down;
    down = null;
    if (e.pointerType === "mouse" || !t || el?.contains(t)) return;
    dismissedKey = null;
    const m = markOf(t);
    if (m) return showMark(m);
    // Recharts answers a hover, not a tap: it is handed the tap as the pointer movement it knows.
    if (t.closest("[data-tip-box]")) return t.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: e.clientX, clientY: e.clientY }));
    hideTip();
    // and the plots let go of the category they were tapped on, so tapping it again shows it again.
    for (const s of document.querySelectorAll("[data-tip-box] .recharts-surface")) s.dispatchEvent(new MouseEvent("mouseout", { bubbles: true, relatedTarget: null }));
  });
  document.addEventListener("pointerover", (e) => {
    if (e.pointerType !== "mouse") return; // a tap is handled on pointerup
    const m = markOf(e.target);
    if (m) showMark(m, true);
  });
  document.addEventListener("pointerout", (e) => {
    const from = markOf(e.target);
    if (e.pointerType !== "mouse" || !from) return;
    const to = e.relatedTarget;
    if (to instanceof Node && (el?.contains(to) || markOf(to) === from)) return;
    if (dismissedKey === markKey(from)) dismissedKey = null; // after Escape, pointing at it again shows it again
    hideTip(true);
  });
  document.addEventListener("focusin", (e) => {
    const m = markOf(e.target);
    if (m) showMark(m);
  });
  document.addEventListener("focusout", (e) => {
    if (markOf(e.target)) hideTip();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && el && !el.hidden) {
      dismissedKey = shownKey;
      hideTip();
    }
  });
  window.addEventListener("scroll", (e) => e.target !== el && position(), { capture: true, passive: true }); // not its own scrolling
  window.addEventListener("resize", position);
}

/** App calls this once: the listeners serve every chart on every page. */
export function useChartTips() {
  useEffect(install, []);
}

/** Recharts' Tooltip content: hands the hovered category to the shared tooltip, above or below the plot's column at
 * that position (never over that category's points), and draws nothing itself. `box` is the element around the
 * chart; it carries data-tip-box. */
export function RechartsTip({ active, label, coordinate, box, build, id }: { active?: boolean; label?: unknown; coordinate?: { x?: number }; box: { current: HTMLElement | null }; build: (label: unknown) => Tip | null; id: string }) {
  const key = active && label !== undefined && label !== null ? `${id}:${String(label)}` : null;
  const x = coordinate?.x;
  useEffect(() => () => hideTipOf(id), [id]);
  useEffect(() => {
    if (key === null || x === undefined) return hideTipOf(id, true);
    const tip = build(label);
    if (!tip) return hideTipOf(id, true);
    showTipSoon(
      () => {
        const b = box.current;
        if (!b?.isConnected) return null;
        // Recharts measures x from its own wrapper. The anchor is the plot's whole column there, so the tooltip never
        // sits under the pointer, which would take the hover away from Recharts and make it flicker.
        const r = (b.querySelector(".recharts-wrapper") ?? b).getBoundingClientRect();
        const plot = b.querySelector(".recharts-cartesian-grid")?.getBoundingClientRect() ?? r;
        return new DOMRect(r.left + x - 1, plot.top, 2, plot.height);
      },
      tip,
      key,
      false, // the pointer can be anywhere across the plot: above or below it only
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, x]);
  return null;
}
