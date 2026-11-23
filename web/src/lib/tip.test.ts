import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RowsTable } from "../components/ChartFigure";
import { cellText, placeTip, readTip, rowTip, tipAttr, tipText } from "./tip";

const rect = (left: number, top: number, width: number, height: number) =>
  ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect;
const overlaps = (a: { left: number; top: number; right: number; bottom: number }, b: DOMRect) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

describe("chart tooltip text", () => {
  it("formats a cell as the tables do", () => {
    expect(cellText(null)).toBe("—");
    expect(cellText(undefined)).toBe("—");
    expect(cellText(0)).toBe("0");
    expect(cellText(11347)).toBe("11347");
    expect(cellText(-1.1)).toBe("−1.1");
    expect(cellText(-454364)).toBe("−454364");
    expect(cellText(-0)).toBe("0");
    expect(cellText(false)).toBe("false");
    expect(cellText("Utah")).toBe("Utah");
  });

  it("shows a table row's columns in order, with the table's text", () => {
    const row = { Rank: 49, State: "Utah", "FY2024 per pupil ($)": 11347, Note: null };
    expect(rowTip(row, "Utah").rows).toEqual([
      ["Rank", "49"],
      ["State", "Utah"],
      ["FY2024 per pupil ($)", "11347"],
      ["Note", "—"],
    ]);
    // The "Show the numbers" table prints the very same cells.
    const html = renderToStaticMarkup(createElement(RowsTable, { rows: [row] }));
    const cells = [...html.matchAll(/<td>(.*?)<\/td>/g)].map((m) => m[1]);
    expect(cells).toEqual(rowTip(row).rows.map(([, v]) => v));
  });

  it("round-trips through the mark's attribute and reads as lines for the SVG download", () => {
    const tip = { title: "2019", rows: [["Utah", "$1.2 million (FY2019)"]] as [string, string][], note: "Click a point to open its record." };
    const el = { getAttribute: (k: string) => (k === "data-tip" ? tipAttr(tip)["data-tip"] : null) } as unknown as Element;
    expect(readTip(el)).toEqual(tip);
    expect(tipText(tip)).toBe("2019\nUtah: $1.2 million (FY2019)\nClick a point to open its record.");
    expect(readTip({ getAttribute: () => "{not json" } as unknown as Element)).toBeNull();
    expect(readTip({ getAttribute: () => null } as unknown as Element)).toBeNull();
  });
});

describe("chart tooltip placement", () => {
  // Phone and desktop screens, with the tooltip at normal size and at 200% text.
  const screens = [
    [320, 568],
    [375, 812],
    [768, 1024],
    [1280, 900],
  ];
  const sizes = [
    [180, 60],
    [300, 110],
    [304, 220],
  ];
  it("never covers the mark and stays on screen whenever it fits", () => {
    let fitted = 0;
    for (const [vw, vh] of screens)
      for (const [w, h] of sizes)
        for (let x = 0; x < vw; x += 37)
          for (let y = 0; y < vh; y += 41)
            for (const [mw, mh] of [
              [2, 200],
              [12, 12],
              [60, 30],
              [vw - 20, 40],
            ]) {
              const r = rect(Math.min(x, vw - mw), Math.min(y, vh - mh), mw, mh);
              const p = placeTip(r, w, h, vw, vh);
              const box = { left: p.left, top: p.top, right: p.left + w, bottom: p.top + Math.min(h, p.maxHeight ?? h) };
              if (p.fits) {
                fitted++;
                expect(overlaps(box, r)).toBe(false);
                expect(box.left).toBeGreaterThanOrEqual(8);
                expect(box.top).toBeGreaterThanOrEqual(8);
                expect(box.right).toBeLessThanOrEqual(vw - 8);
                expect(box.bottom).toBeLessThanOrEqual(vh - 8);
              } else {
                // Nothing fits whole: it is still kept on screen (as far as its size allows).
                expect(box.top).toBeGreaterThanOrEqual(Math.min(8, vh - 8 - h));
                expect(box.left).toBeGreaterThanOrEqual(Math.min(8, vw - 8 - w));
              }
            }
    expect(fitted).toBeGreaterThan(1000);
  });

  it("too tall to fit whole, it scrolls on the roomier side rather than covering the mark", () => {
    // Six series at 200% text on a 320 x 568 phone: 398 px tall, points between 200 and 330.
    const p = placeTip(rect(100, 200, 60, 130), 304, 398, 320, 568);
    expect(p).toEqual({ left: 8, top: 338, fits: true, maxHeight: 222 });
    expect(p.top + p.maxHeight!).toBeLessThanOrEqual(568 - 8);
    // With no usable room on either side it stays on screen, over the mark, and says it does not fit.
    expect(placeTip(rect(0, 40, 320, 500), 304, 398, 320, 568)).toMatchObject({ fits: false });
  });

  it("for a plot's column (sides off) goes above or below, never beside, where the pointer may be", () => {
    // A 1280 x 900 screen at 200% text: a 704 x 360 tooltip, a plot 250 px tall at y 316.
    const col = rect(415, 316, 2, 250);
    const p = placeTip(col, 704, 360, 1280, 900, false);
    expect(p.top + Math.min(360, p.maxHeight ?? 360) <= col.top || p.top >= col.bottom).toBe(true);
    // With sides allowed, the same column would put it beside, across the plot.
    expect(placeTip(col, 704, 360, 1280, 900).left).toBe(col.right + 8);
  });

  it("goes above the mark first, then below", () => {
    expect(placeTip(rect(100, 400, 20, 20), 150, 50, 1280, 900)).toMatchObject({ top: 400 - 8 - 50, fits: true });
    expect(placeTip(rect(100, 20, 20, 20), 150, 50, 1280, 900)).toMatchObject({ top: 48, fits: true });
  });
});
