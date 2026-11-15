// Chart downloads that can be read on their own: a standalone SVG (and a PNG drawn from it) carrying the chart's title,
// units and settings, its reading and limits, its sources and the release it was drawn from. Colors are copied from the
// page, so the image matches the theme it was saved in. Browser only.
import { saveFile } from "./csv";

export interface ChartMeta {
  title: string;
  /** Units, period and settings. */
  subtitle: string;
  /** One-line reading and limitations; each is a paragraph under the chart. */
  notes: string[];
  source: string;
  /** Data release, build and method versions. */
  release: string;
  /** File name without an extension. */
  filename: string;
}

/** Split text into lines that fit `width` pixels in the context's current font. */
export function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export function saveBlob(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const PROPS = ["fill", "fill-opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-opacity", "opacity", "font-size", "font-weight", "font-family", "paint-order", "text-anchor", "dominant-baseline"];
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The chart with its computed styles written onto each element, framed by its title above and its notes below. */
export function composeSvg(svg: SVGSVGElement, meta: ChartMeta): { text: string; width: number; height: number } {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const src = svg.querySelectorAll("*");
  const dst = clone.querySelectorAll("*");
  src.forEach((el, i) => {
    const cs = getComputedStyle(el);
    const d = dst[i] as SVGElement;
    for (const p of PROPS) {
      const v = cs.getPropertyValue(p);
      if (v) d.style.setProperty(p, v);
    }
  });
  const box = svg.getBoundingClientRect();
  const vb = svg.viewBox.baseVal;
  const cw = Math.max(320, Math.round(vb && vb.width ? vb.width : box.width));
  const ch = Math.round(vb && vb.height ? vb.height : box.height);
  const width = Math.max(cw, 560) + 32;
  const page = getComputedStyle(document.body);
  const ink = page.color || "#111111";
  const muted = getComputedStyle(document.documentElement).getPropertyValue("--text-2").trim() || ink;
  const bg = page.backgroundColor || "#ffffff";
  const font = "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";
  const measure = document.createElement("canvas").getContext("2d")!;
  const lines = (text: string, size: number, weight = 400) => {
    measure.font = `${weight} ${size}px ${font}`;
    return wrap(measure, text, width - 32);
  };
  const out: string[] = [];
  let y = 16;
  const block = (text: string, size: number, color: string, weight = 400, gap = 4) => {
    for (const l of lines(text, size, weight)) {
      y += size + 4;
      out.push(`<text x="16" y="${y}" font-family="${esc(font)}" font-size="${size}" font-weight="${weight}" fill="${esc(color)}">${esc(l)}</text>`);
    }
    y += gap;
  };
  block(meta.title, 18, ink, 700);
  block(meta.subtitle, 13, muted, 400, 8);
  const chartY = y;
  y += ch + 12;
  for (const n of meta.notes) block(n, 12.5, ink, 400, 2);
  block(`Source: ${meta.source}`, 12, muted, 400, 2);
  block(meta.release, 12, muted, 400, 0);
  const height = Math.ceil(y + 14);
  clone.setAttribute("x", "16");
  clone.setAttribute("y", String(chartY));
  clone.setAttribute("width", String(cw));
  clone.setAttribute("height", String(ch));
  clone.removeAttribute("class");
  const inner = new XMLSerializer().serializeToString(clone);
  const text =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<title>${esc(meta.title)}</title><desc>${esc([meta.subtitle, ...meta.notes, `Source: ${meta.source}`, meta.release].join(" "))}</desc>` +
    `<rect width="100%" height="100%" fill="${esc(bg)}"/>${out.join("")}${inner}</svg>`;
  return { text, width, height };
}

export function downloadSvg(svg: SVGSVGElement, meta: ChartMeta) {
  saveFile(`${meta.filename}.svg`, composeSvg(svg, meta).text, "image/svg+xml");
}

export async function downloadPng(svg: SVGSVGElement, meta: ChartMeta, scale = 2) {
  const { text, width, height } = composeSvg(svg, meta);
  const url = URL.createObjectURL(new Blob([text], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("The chart image could not be drawn."));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, width, height);
    await new Promise<void>((res) => canvas.toBlob((b) => (b && saveBlob(b, `${meta.filename}.png`), res()), "image/png"));
  } finally {
    URL.revokeObjectURL(url);
  }
}
