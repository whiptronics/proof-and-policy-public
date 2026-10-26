"""Graphs and data for the Utah grocery-wine models and the Tennessee 2016 comparison.

Draws only what the exports contain; it computes no policy results of its own:
  * data/processed/grocery-wine/      from `npm --prefix web run export:grocery-wine`
                                      (wine-alternatives@1.0, wine-price-share@1.0, wine-purchase-flows@1.0)
  * data/processed/tennessee-2016/    from `npm --prefix web run export:tennessee`      (case-results@1.0)
Before drawing it runs scripts/grocery_wine_alternatives_check.py and scripts/grocery_wine_flows_check.py (independent
closed forms) and checks every title against its data (scripts/grocery_wine_chart_text.py). Then it writes each chart
as PNG and PDF with the exact values it plotted (graphs/<chart>.csv, read back from the drawn figure), copies the
export tables into data/, and writes manifest.json and manifest.csv (chart -> data -> model -> command).

Needs matplotlib, which is not a project dependency. On Ethan's PC it runs locally under ParaView's Python
(ParaView 6.1.0's pvpython.exe under C:/Program Files, matplotlib 3.7.2). Mathtext is switched off, so "$" is always a
dollar sign. The purchase-flow charts (F1-F11) are drawn by scripts/grocery_wine_flow_graphs.py.

Run:  pvpython -B scripts/grocery_wine_graphs.py "<output folder>"
"""

from __future__ import annotations

import itertools
import json
import shutil
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import matplotlib.transforms  # noqa: E402
import numpy as np  # noqa: E402
from matplotlib.lines import Line2D  # noqa: E402
from matplotlib.patches import Patch  # noqa: E402

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import grocery_wine_alternatives_check as gwc  # noqa: E402
import grocery_wine_chart_text as ct  # noqa: E402
import grocery_wine_flow_graphs as fg  # noqa: E402
import grocery_wine_flows_check as gfc  # noqa: E402

SURFACE, INK, INK2, MUTED, GRID, AXIS = "#fcfcfb", "#0b0b0b", "#52514e", "#898781", "#e1e0d9", "#c3c2b7"
BLUE, ORANGE, AQUA, YELLOW, MAGENTA = "#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"
RED, CONTEXT, SHADE = "#e34948", "#c3c2b7", "#f0efec"
plt.rcParams.update(
    {
        "text.parse_math": False,
        "figure.facecolor": SURFACE,
        "axes.facecolor": SURFACE,
        "savefig.facecolor": SURFACE,
        "font.family": "DejaVu Sans",
        "font.size": 9.5,
        "text.color": INK,
        "axes.labelcolor": INK2,
        "axes.edgecolor": AXIS,
        "axes.titlesize": 10,
        "axes.titleweight": "bold",
        "axes.titlelocation": "left",
        "axes.spines.top": False,
        "axes.spines.right": False,
        "axes.grid": True,
        "grid.color": GRID,
        "grid.linewidth": 0.8,
        "axes.axisbelow": True,
        "xtick.color": INK2,
        "ytick.color": INK2,
        "xtick.major.size": 0,
        "ytick.major.size": 0,
        "lines.linewidth": 2,
        "legend.frameon": False,
        "legend.fontsize": 8.5,
        "pdf.fonttype": 42,
    }
)
LOG: list[str] = []


def m_fmt(x, _=None):
    """Millions, with a decimal whenever the tick is not a whole million (so -2.5M never reads "-$2M")."""
    v = abs(x) / 1e6
    body = f"{v:,.0f}" if abs(v - round(v)) < 0.05 else f"{v:,.1f}"
    return f"{'−' if x < -5e3 else ''}${body}M"


def year_ticks(ax, start: int, stop: int, step: int = 5) -> None:
    ax.set_xticks(range(start, stop + 1, step))
    ax.xaxis.set_major_formatter(lambda v, _: f"{v:.0f}")


def minus(s: str) -> str:
    return s.replace("-", "−")


def wrap_to(fig, text: str, size: float, weight: str, max_px: float) -> list[str]:
    """Greedy word wrap measured with the renderer, so a line never runs past the image."""
    r = fig.canvas.get_renderer()
    probe = fig.text(0, 0, "", fontsize=size, fontweight=weight)
    lines, cur = [], ""
    for w in text.split():
        trial = f"{cur} {w}".strip()
        probe.set_text(trial)
        if cur and probe.get_window_extent(r).width > max_px:
            lines.append(cur)
            cur = w
        else:
            cur = trial
    if cur:
        lines.append(cur)
    probe.remove()
    return lines


def head(fig, title: str, sub: str, note: str, legend_in: float = 0.0, below_in: float = 0.62) -> None:
    """Title, subtitle and source note, measured; then the plot area is fitted between them."""
    fig.canvas.draw()
    W, H = fig.get_figwidth(), fig.get_figheight()
    max_px = (W - 0.3) * fig.dpi
    y = 0.12
    for line in wrap_to(fig, title, 12, "bold", max_px):
        fig.text(0.15 / W, 1 - y / H, line, ha="left", va="top", fontsize=12, fontweight="bold", color=INK)
        y += 0.215
    y += 0.05
    for line in wrap_to(fig, sub, 9, "normal", max_px):
        fig.text(0.15 / W, 1 - y / H, line, ha="left", va="top", fontsize=9, color=INK2)
        y += 0.165
    notes = wrap_to(fig, note, 7.5, "normal", max_px)
    for k, line in enumerate(notes[::-1]):
        fig.text(0.15 / W, (0.08 + k * 0.135) / H, line, ha="left", va="bottom", fontsize=7.5, color=MUTED)
    top = 1 - (y + 0.2 + legend_in) / H
    bottom = (0.08 + len(notes) * 0.135 + below_in) / H
    fig.subplots_adjust(top=top, bottom=bottom)


def drawn_texts(fig):
    fig.canvas.draw()
    ticks, drawn = set(), []
    for ax in fig.axes:
        for axis in (ax.xaxis, ax.yaxis):
            for tk in axis.get_major_ticks() + axis.get_minor_ticks():
                ticks.update((id(tk.label1), id(tk.label2)))
            for tk in axis._update_ticks():
                drawn += [lab for lab in (tk.label1, tk.label2) if lab.get_visible() and tk.get_visible()]
    out = [t for t in fig.findobj(matplotlib.text.Text) if id(t) not in ticks] + drawn
    return [t for t in out if t.get_visible() and t.get_text().strip()]


def layout_problems(fig) -> list[str]:
    r = fig.canvas.get_renderer()
    W, H = fig.bbox.width, fig.bbox.height
    boxes, probs = [], []
    for t in drawn_texts(fig):
        b = matplotlib.text.Text.get_window_extent(t, r)
        if b.width == 0:
            continue
        if b.x0 < -1 or b.y0 < -1 or b.x1 > W + 1 or b.y1 > H + 1:
            probs.append(f"outside: {t.get_text()[:40]!r}")
        boxes.append((t, b))
    for (t1, b1), (t2, b2) in itertools.combinations(boxes, 2):
        ow, oh = min(b1.x1, b2.x1) - max(b1.x0, b2.x0), min(b1.y1, b2.y1) - max(b1.y0, b2.y0)
        if ow > 1.5 and oh > 1.5:
            probs.append(f"overlap: {t1.get_text()[:30]!r} / {t2.get_text()[:30]!r}")
    return probs


def _tick_label(axis, v: float) -> str:
    """The category label at a data position, when the position is a tick of a categorical axis."""
    for loc, lab in zip(axis.get_majorticklocs(), axis.get_majorticklabels(), strict=False):
        if abs(loc - v) < 1e-6:
            return lab.get_text().replace("\n", " ")
    return ""


def plotted_rows(fig) -> list[list]:
    """Every value drawn on the figure, read back from its artists: lines and markers, bars, spans, image cells,
    collections and value labels, in data coordinates, with the axis titles and the category at each tick."""
    import matplotlib.collections as mc
    import matplotlib.image as mi
    import matplotlib.patches as mp

    rows = []
    for i, ax in enumerate(fig.axes):
        head_ = [
            i + 1,
            ax.get_title().replace("\n", " "),
            ax.get_xlabel().replace("\n", " "),
            ax.get_ylabel().replace("\n", " "),
        ]
        bar_label = {}
        for c in ax.containers:
            for patch in getattr(c, "patches", []):
                bar_label[id(patch)] = c.get_label() if not str(c.get_label()).startswith("_") else ""
        for ln in ax.lines:
            data = ln.get_transform() == ax.transData
            label = "" if str(ln.get_label()).startswith("_") else ln.get_label()
            kind = (
                ("line" if ln.get_linestyle() not in ("None", "", " ") else "marker")
                if data
                else "reference_line"
            )
            for x, y in zip(
                np.asarray(ln.get_xdata(), dtype=float), np.asarray(ln.get_ydata(), dtype=float), strict=False
            ):
                rows.append(
                    [
                        *head_,
                        kind,
                        label,
                        x,
                        y,
                        "",
                        "",
                        # A reference line spans the axes: its other coordinate is a fraction, not a category.
                        _tick_label(ax.xaxis, x) if data else "",
                        _tick_label(ax.yaxis, y) if data else "",
                        "",
                    ]
                )
        for patch in ax.patches:
            if isinstance(patch, mp.Rectangle) and patch.get_transform() == ax.transData:
                x, y, w, h = patch.get_x(), patch.get_y(), patch.get_width(), patch.get_height()
                rows.append(
                    [
                        *head_,
                        "bar",
                        bar_label.get(id(patch), ""),
                        x,
                        y,
                        w,
                        h,
                        _tick_label(ax.xaxis, x + w / 2),
                        _tick_label(ax.yaxis, y + h / 2),
                        "",
                    ]
                )
            elif isinstance(patch, mp.Polygon | mp.Rectangle):
                verts = patch.get_xy() if isinstance(patch, mp.Polygon) else patch.get_bbox().get_points()
                xs, ys = np.asarray(verts)[:, 0], np.asarray(verts)[:, 1]
                rows.append(
                    [
                        *head_,
                        "span",
                        "",
                        float(xs.min()),
                        float(ys.min()),
                        float(xs.max() - xs.min()),
                        float(ys.max() - ys.min()),
                        "",
                        "",
                        "",
                    ]
                )
        for col in ax.collections:
            label = "" if str(col.get_label()).startswith("_") else col.get_label()
            if isinstance(col, mc.LineCollection):
                for seg in col.get_segments():
                    for x, y in seg:
                        rows.append(
                            [
                                *head_,
                                "segment",
                                label,
                                float(x),
                                float(y),
                                "",
                                "",
                                "",
                                _tick_label(ax.yaxis, float(y)),
                                "",
                            ]
                        )
            elif isinstance(col, mc.PolyCollection):
                for path in col.get_paths():
                    for x, y in path.vertices:
                        rows.append([*head_, "band_vertex", label, float(x), float(y), "", "", "", "", ""])
            else:
                for x, y in np.asarray(col.get_offsets(), dtype=float).reshape(-1, 2):
                    rows.append(
                        [
                            *head_,
                            "point",
                            label,
                            x,
                            y,
                            "",
                            "",
                            _tick_label(ax.xaxis, x),
                            _tick_label(ax.yaxis, y),
                            "",
                        ]
                    )
        for im in ax.images:
            if not isinstance(im, mi.AxesImage):
                continue
            z = np.ma.asarray(im.get_array())
            x0, x1, y0, y1 = im.get_extent()
            ny, nx = z.shape[:2]
            for r in range(ny):
                for c in range(nx):
                    v = z[r, c]
                    if np.ma.is_masked(v):
                        continue
                    rows.append(
                        [
                            *head_,
                            "cell",
                            "",
                            x0 + (c + 0.5) * (x1 - x0) / nx,
                            y0 + (r + 0.5) * (y1 - y0) / ny,
                            (x1 - x0) / nx,
                            (y1 - y0) / ny,
                            "",
                            "",
                            float(v),
                        ]
                    )
        for t in ax.texts:
            if t.get_transform() != ax.transData or not t.get_text().strip():
                continue
            x, y = t.get_position()
            rows.append(
                [
                    *head_,
                    "value_label",
                    "",
                    float(x),
                    float(y),
                    "",
                    "",
                    "",
                    "",
                    t.get_text().replace("\n", " "),
                ]
            )
    return rows


PLOTTED_HEADER = [
    "axes",
    "axes_title",
    "x_axis_label",
    "y_axis_label",
    "mark",
    "series",
    "x",
    "y",
    "width",
    "height",
    "x_category",
    "y_category",
    "value_or_text",
]


def write_plotted(fig, out: Path, name: str) -> None:
    import csv
    import io

    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(PLOTTED_HEADER)
    for r in plotted_rows(fig):
        w.writerow(
            ["" if v is None else (repr(float(v)) if isinstance(v, float | np.floating) else v) for v in r]
        )
    (out / name.replace(".png", ".csv")).write_text(buf.getvalue(), encoding="utf-8")


def save(fig, out: Path, name: str) -> None:
    import io
    import time

    probs = layout_problems(fig)
    write_plotted(fig, out, name)
    buf = io.BytesIO()
    fig.savefig(buf, dpi=200, format="png")
    pdf = io.BytesIO()
    fig.savefig(pdf, format="pdf")
    plt.close(fig)
    for target, data in ((out / name, buf), (out / name.replace(".png", ".pdf"), pdf)):
        for attempt in range(20):  # a viewer or Explorer's thumbnailer can hold the file for a moment on Windows
            try:
                target.write_bytes(data.getvalue())
                break
            except OSError:
                if attempt == 19:
                    raise
                time.sleep(0.5)
    LOG.append(f"{name}: {'text layout OK' if not probs else 'TEXT LAYOUT: ' + '; '.join(probs)}")


# ----- Utah ---------------------------------------------------------------------------------------------------------
NOTE_U = "Model: project scripts, web/src/lib/wineAlternatives.ts (wine-alternatives@1.0) on scenario.ts; FY2025, $ a year; fixed volume unless stated; inputs U01-U18 in assumptions.csv, none reviewed by a person."
COMP = [
    ("dabs_trading_margin", "DABS trading margin", BLUE),
    ("state_charge", "Explicit state charge", ORANGE),
    ("state_sales_tax", "State sales tax", AQUA),
    ("savings", "Store costs avoided", YELLOW),
    ("new_costs", "New administration and handling", MAGENTA),
]


def comps(a: dict) -> dict:
    v = {k["id"]: (k["value"] or 0.0) for k in a["ledger_fixed"]["lines"]}
    return {
        "dabs_trading_margin": v["dabs_trading_margin"],
        "state_charge": v["state_charge"],
        "state_sales_tax": v["state_sales_tax"],
        "savings": v["savings_short_run"] + v["savings_conditional"],
        "new_costs": v["new_administration"] + v["new_handling"],
    }


def u1_waterfall(d, out, titles):
    fig, axes = plt.subplots(1, 2, figsize=(13.5, 6.4), sharey=True)
    fig.subplots_adjust(left=0.08, right=0.98, wspace=0.08)
    for ax, aid in zip(axes, ["R1", "R2"], strict=True):
        a = ct.alt(d, aid)
        v = {k["id"]: (k["value"] or 0.0) for k in a["ledger_fixed"]["lines"]}
        steps = [
            ("DABS\nmargin", v["dabs_trading_margin"]),
            ("New\ncharge", v["state_charge"]),
            ("State\nsales tax", v["state_sales_tax"]),
            ("Short-run\nsavings", v["savings_short_run"]),
            ("Savings\nto 5¢", v["savings_conditional"]),
            ("New\nadmin.", v["new_administration"]),
        ]
        cum = 0.0
        for i, (lab, val) in enumerate(steps):
            col = BLUE if val > 0 else RED if val < 0 else CONTEXT
            ax.bar(i, val if val else 0.0, bottom=cum, color=col, width=0.62, edgecolor=SURFACE, linewidth=2)
            txt = ct.money(val) if abs(val) > 0.05e6 else "0 (retained)" if "sales" in lab else "0"
            ytxt = cum + val + (0.45e6 if val >= 0 else -0.45e6)
            ax.text(i, ytxt, txt, ha="center", va="bottom" if val >= 0 else "top", fontsize=8.5, color=INK)
            if i < len(steps) - 1:
                ax.plot([i + 0.31, i + 0.69], [cum + val, cum + val], color=MUTED, lw=0.8)
            cum += val
        ax.bar(len(steps), cum, color=INK2, width=0.62)
        ax.text(len(steps), cum - 0.45e6, ct.money(cum), ha="center", va="top", fontsize=9, fontweight="bold", color=INK)
        ax.axhline(0, color=INK, lw=1)
        ax.set_xticks(range(len(steps) + 1), [s[0] for s in steps] + ["Net\nchange"], fontsize=8)
        ax.grid(axis="x", visible=False)
        ax.set_title({"R1": "Reference 1: private supply, 20% tax", "R2": "Reference 2: DABS supply, 20% discount"}[aid], fontsize=9.5)
        ax.yaxis.set_major_formatter(m_fmt)
    axes[0].set_ylabel("Change from today, $ a year")
    axes[0].set_ylim(-25e6, 11e6)
    head(fig, *titles["U1"], NOTE_U + " 'DABS margin' in Reference 2 is the 20% discount given up; DABS keeps the rest of its margin.", below_in=0.75)
    save(fig, out, "U1_references_change_from_today.png")


def u2_components(d, out, titles):
    ids = ct.MAIN
    fig, ax = plt.subplots(figsize=(12.5, 7.6))
    fig.subplots_adjust(left=0.33, right=0.97)
    y = np.arange(len(ids))[::-1]
    for yi, aid in zip(y, ids, strict=True):
        a = ct.alt(d, aid)
        c = comps(a)
        pos = neg = 0.0
        for key, _, col in COMP:
            val = c[key]
            if val > 0:
                ax.barh(yi, val, left=pos, color=col, height=0.62, edgecolor=SURFACE, linewidth=1.5)
                pos += val
            elif val < 0:
                ax.barh(yi, val, left=neg, color=col, height=0.62, edgecolor=SURFACE, linewidth=1.5)
                neg += val
        net = a["ledger_fixed"]["net"]
        ax.plot([a["zero_savings_net"]], [yi], "D", color=INK, ms=7, mfc=SURFACE, mew=1.2, zorder=4)
        ax.plot([net], [yi], "D", color=INK, ms=7, mec=SURFACE, mew=1.5, zorder=5)
        ax.text(max(pos, 0) + 0.6e6, yi, f"net {ct.money(net)} ({ct.money(a['zero_savings_net'])} without savings)", va="center", fontsize=8.5, color=INK)
    ax.axvline(0, color=INK, lw=1)
    ax.set_yticks(y, [ct.alt(d, a)["short"] + (" (arithmetic only*)" if ct.alt(d, a)["retailer"]["arithmeticOnly"] else "") for a in ids], fontsize=8.5)
    ax.grid(axis="y", visible=False)
    ax.set_xlim(-25e6, 42e6)
    ax.xaxis.set_major_formatter(m_fmt)
    ax.set_xlabel("Change from today, $ a year (fixed volume)")
    handles = [Patch(color=col, label=lab) for _, lab, col in COMP] + [Line2D([], [], marker="D", color=INK, ls="none", label="Net change"), Line2D([], [], marker="D", color=INK, mfc=SURFACE, ls="none", label="Net, no avoidable cost")]
    ax.legend(handles=handles, loc="lower left", bbox_to_anchor=(-0.5, 1.0), ncol=4, fontsize=8.5)
    w, t, _ = split_facts(d)
    head(fig, *titles["U2"], NOTE_U + f" *The grocer would sell below its acquisition cost if the wholesaler kept its assumed {w} (together they keep {t} per $1): a state break-even, not a workable arrangement as specified.", legend_in=0.55)
    save(fig, out, "U2_change_by_component.png")


def u3_panel(d, out, titles):
    ids = ct.MAIN
    fig, axes = plt.subplots(1, 4, figsize=(15, 7.6), sharey=True)
    fig.subplots_adjust(left=0.2, right=0.985, wspace=0.12)
    y = np.arange(len(ids))[::-1]
    A = [ct.alt(d, a) for a in ids]
    cons = [a["price_stack"]["consumerChange"] * 100 for a in A]
    net = [a["ledger_fixed"]["net"] for a in A]
    pc = [next(x for x in a["demand"] if x["id"] == "price_constant")["net"] for a in A]
    ret = [a["retailer"]["marginShare"] * 100 if a["retailer"]["marginShare"] is not None else np.nan for a in A]
    f1 = [a["ledger_fixed"]["allocations"]["funds"] for a in A]
    f2 = [(a["ledger_fixed_no_deposits_on_grocer_sales"] or a["ledger_fixed"])["allocations"]["funds"] for a in A]
    ax = axes[0]
    ax.barh(y, cons, color=BLUE, height=0.6)
    for yi, v in zip(y, cons, strict=True):
        ax.text(v + 1.2, yi, f"{v:+.1f}%" if abs(v) > 0.05 else "0%", va="center", fontsize=8, color=INK)
    ax.set_xlim(0, 75)
    ax.set_title("Grocery price vs a state store", fontsize=9.5)
    ax.set_xlabel("% change, with state sales tax")
    ax = axes[1]
    ax.barh(y, net, color=[BLUE if v >= -0.5 else RED for v in net], height=0.6)
    zs = [a["zero_savings_net"] for a in A]
    ax.plot(zs, y, "x", color=INK, ms=6, mew=1.4, label="no avoidable cost")
    ax.plot(pc, y, "o", color=INK, ms=5, mfc=SURFACE, mew=1.2, label="with the price response")
    for yi, v in zip(y, net, strict=True):
        ax.text(14.5e6, yi, ct.money(v), va="center", ha="right", fontsize=8, color=INK)
    ax.axvline(0, color=INK, lw=1)
    ax.set_xlim(-16e6, 15e6)
    ax.set_xticks([-10e6, 0, 10e6])
    ax.xaxis.set_major_formatter(m_fmt)
    ax.set_title("State revenue change", fontsize=9.5)
    ax.set_xlabel("$ a year; bar fixed volume")
    ax.legend(loc="lower left", fontsize=7.5, ncol=2, columnspacing=1.0, handletextpad=0.3, borderaxespad=0.2)
    ax = axes[2]
    ax.barh(y, [0 if np.isnan(v) else v for v in ret], color=[BLUE if (not np.isnan(v) and v >= 28 - 1e-6) else ORANGE for v in ret], height=0.6)
    ax.axvline(28, color=INK2, lw=1, ls="--")
    ax.text(28.6, y[0] + 0.55, "28% reference", fontsize=7.5, color=INK2)
    below = [a["retailer"]["arithmeticOnly"] for a in A]
    for yi, v, b in zip(y, ret, below, strict=True):
        label = "n/a" if np.isnan(v) else f"{v:.1f}%".replace("-", "−") + (" below cost*" if b else "")
        ax.text(max(v, 0) + 1 if not np.isnan(v) else 1, yi, label, va="center", fontsize=8, color=INK)
    ax.set_xlim(-45, 45)
    ax.axvline(0, color=INK, lw=1)
    ax.set_title("Grocer's gross margin", fontsize=9.5)
    ax.set_xlabel("% of its selling price")
    ax = axes[3]
    for yi, a, b in zip(y, f1, f2, strict=True):
        lo, hi = min(a, b), max(a, b)
        ax.hlines(yi, lo, hi, color=BLUE, lw=5)
        ax.plot([a, b], [yi, yi], "|", color=BLUE, ms=9)
        ax.text(0.4e6, yi, ct.money(lo) if abs(hi - lo) < 1e3 else f"{ct.money(lo)} to {ct.money(hi)}", va="center", fontsize=8, color=INK)
    ax.axvline(0, color=INK, lw=1)
    ax.set_xlim(-6.5e6, 5.5e6)
    ax.set_xticks([-6e6, -4e6, -2e6, 0])
    ax.xaxis.set_major_formatter(m_fmt)
    ax.set_title("School-meal and enforcement funds", fontsize=9.5)
    ax.set_xlabel("$ a year, current law as read")
    axes[0].set_yticks(y, [a["short"] for a in A], fontsize=8.5)
    axes[0].set_ylim(-1.6, len(ids) - 0.4)
    for ax in axes:
        ax.grid(axis="y", visible=False)
    w, t, _ = split_facts(d)
    head(fig, *titles["U3"], NOTE_U + f" Orange grocer bars: below the 28% reference. Private supply: the grocer's margin after a wholesaler keeping {w} (U13). *Below acquisition cost under that split, so the state result in that row is arithmetic only; wholesaler and grocer together keep {t} per $1 there.")
    save(fig, out, "U3_alternatives_price_revenue_margin_funds.png")


def sweep_xy(rows, key):
    return np.array([r["v"] * 100 for r in rows]), np.array([np.nan if r[key] is None else r[key] for r in rows], dtype=float)


def first_crossing(rows, key):
    """Where a sweep's column first changes sign (linear interpolation), as the lever's value (0-1)."""
    pts = [(r["v"], r[key]) for r in rows if r[key] is not None]
    for (va, a), (vb, b) in zip(pts, pts[1:], strict=False):
        if a == 0:
            return va
        if (a > 0) != (b > 0):
            return va + (vb - va) * a / (a - b)
    return None


def split_facts(d):
    """The arithmetic-only case (C_matched_be), from the export: the wholesaler's assumed margin and what both sellers keep."""
    a = ct.alt(d, "C_matched_be")
    ps = a["price_stack"]
    return f"{ps['wholesaleMarginShare'] * 100:.1f}%", f"{a['retailer']['sellersTogether'] * 100:.1f}¢", ps["after"]["wholesaleMargin"]


def split_plot(ax, x, y, col, cut, label=None):
    """Solid up to `cut` (lever %, or None), dashed beyond it."""
    if cut is None:
        ax.plot(x, y, color=col, label=label)
        return
    yc = float(np.interp(cut, x, y))
    ok = x <= cut
    ax.plot(np.append(x[ok], cut), np.append(y[ok], yc), color=col, label=label)
    ax.plot(np.insert(x[~ok], 0, cut), np.insert(y[~ok], 0, yc), color=col, ls=(0, (4, 3)), lw=1.6)


def u4_discount(d, out, titles):
    sm, st = d["sweeps"]["discount_matched"], d["sweeps"]["discount_target"]
    fig, axes = plt.subplots(3, 1, figsize=(11, 10.5), sharex=True, gridspec_kw={"height_ratios": [2.2, 1, 1]})
    fig.subplots_adjust(left=0.1, right=0.74, hspace=0.3)
    for rows, col, lab in ((sm, BLUE, "Grocers charge today's price"), (st, ORANGE, "Grocers price for a 28% margin")):
        x, y = sweep_xy(rows, "net")
        axes[0].plot(x, y, color=col, label=lab)
        be = ct.crossing(rows)
        if be is not None:
            axes[0].plot([be * 100], [0], "o", color=col, ms=7, mec=SURFACE, mew=1.5)
        x, y = sweep_xy(rows, "consumerChange")
        axes[1].plot(x, y * 100, color=col)
        x, y = sweep_xy(rows, "retailerShare")
        axes[2].plot(x, y * 100, color=col)
    be_m, be_t = ct.crossing(sm), ct.crossing(st)
    axes[0].annotate(f"break-even {be_m * 100:.1f}% (today's prices)", (be_m * 100, 0), (6, 3.4e6), fontsize=8.5, color=INK, va="center", arrowprops=dict(arrowstyle="-", color=MUTED, lw=0.8, relpos=(0, 0.5)))
    axes[0].annotate(f"break-even {be_t * 100:.1f}% (grocer prices for 28%)", (be_t * 100, 0), (6, 1.3e6), fontsize=8.5, color=INK, va="center", arrowprops=dict(arrowstyle="-", color=MUTED, lw=0.8, relpos=(0, 0.5)))
    r2 = ct.alt(d, "B20_matched")["ledger_fixed"]["net"]
    axes[0].plot([20], [r2], "s", color=BLUE, ms=6, mec=SURFACE)
    axes[0].text(21.5, r2 + 2.6e6, f"20% at today's prices: {ct.money(r2)}", fontsize=8.5, color=INK)
    axes[0].axhline(0, color=INK, lw=1)
    axes[0].yaxis.set_major_formatter(m_fmt)
    axes[0].set_ylim(-24e6, 6e6)
    axes[0].set_title("State revenue change, fixed volume", fontsize=9.5)
    axes[0].legend(loc="upper left", bbox_to_anchor=(1.01, 1.0))
    axes[1].set_title("Grocery price vs a state store (% change)", fontsize=9.5)
    axes[1].axhline(0, color=INK, lw=1, zorder=1.5)
    axes[2].set_title("Grocer's gross margin (% of its selling price)", fontsize=9.5)
    axes[2].axhline(28, color=INK2, lw=1, ls="--")
    axes[2].text(50.5, 28, "28% reference", va="center", fontsize=8, color=INK2)
    axes[2].set_xlabel("DABS's discount to grocers (% of today's shelf price)")
    axes[2].set_xlim(0, 50)
    head(fig, *titles["U4"], NOTE_U + " Short-run savings 2.28¢ per $; Reference 2's 5¢ gives a 3.9% break-even at today's prices.")
    save(fig, out, "U4_dabs_discount_sweep.png")


def u5_charge(d, out, titles):
    sm, st = d["sweeps"]["charge_matched"], d["sweeps"]["charge_target"]
    fig, axes = plt.subplots(3, 1, figsize=(11, 10.5), sharex=True, gridspec_kw={"height_ratios": [2.2, 1, 1]})
    fig.subplots_adjust(left=0.1, right=0.74, hspace=0.3)
    # Today's price: above this charge the grocer's margin after the wholesaler's assumed share is negative (dashed).
    w, _, wm = split_facts(d)
    xc = first_crossing(sm, "retailerShare")
    cut = None if xc is None else xc * 100
    for rows, col, lab, c in ((sm, BLUE, "Grocers charge today's price", cut), (st, ORANGE, "Sellers price for national margins", None)):
        x, y = sweep_xy(rows, "net")
        split_plot(axes[0], x, y, col, c, lab)
        be = ct.crossing(rows)
        if be is not None:
            axes[0].plot([be * 100], [0], "o", color=col, ms=7, mec=SURFACE, mew=1.5)
            extra = "\narithmetic only: grocer below acquisition cost*" if c is not None and be * 100 > c else ""
            axes[0].annotate(f"break-even {be * 100:.1f}% of the sellers' price\n= {be / (1 + be) * 100:.1f}% of the price incl. the charge{extra}", (be * 100, 0), (55, -10.5e6) if col == BLUE else (2, 30e6), fontsize=8, color=INK, va="center", arrowprops=dict(arrowstyle="-", color=MUTED, lw=0.8))
        x, y = sweep_xy(rows, "consumerChange")
        split_plot(axes[1], x, y * 100, col, c)
        x, y = sweep_xy(rows, "sellersPerDollar")
        split_plot(axes[2], x, y * 100, col, c)
    if cut is not None:
        axes[0].plot([], [], color=BLUE, ls=(0, (4, 3)), lw=1.6, label=f"Today's price, charge above {cut:.1f}%:\nthe grocer sells below its acquisition\ncost if the wholesaler keeps {w}*")
        axes[2].axhline(wm * 100, color=MUTED, lw=1, ls=":")
        axes[2].text(99, wm * 100 + 3, f"the wholesaler's assumed {w} of its price: {wm * 100:.1f}¢", ha="right", va="bottom", fontsize=8, color=INK2)
    r = ct.alt(d, "C20_matched")["ledger_fixed"]["net"]
    axes[0].plot([20], [r], "s", color=BLUE, ms=6, mec=SURFACE)
    axes[0].text(22, r - 5.5e6, f"20% (16.7% of the price incl. the charge): {ct.money(r)}", fontsize=8.5, color=INK)
    take = ct.alt(d, "C_take")
    axes[0].plot([take["lever"]["charge"] * 100], [take["ledger_fixed"]["net"]], "s", color=ORANGE, ms=6, mec=SURFACE)
    axes[0].annotate(f"charge = DABS's margin per bottle ({take['lever']['charge'] * 100:.1f}%): {ct.money(take['ledger_fixed']['net'])}", (take["lever"]["charge"] * 100, take["ledger_fixed"]["net"]), (47, 31e6), fontsize=8.5, color=INK, va="center", arrowprops=dict(arrowstyle="-", color=MUTED, lw=0.8, relpos=(0, 0.5)))
    axes[0].axhline(0, color=INK, lw=1)
    axes[0].yaxis.set_major_formatter(m_fmt)
    axes[0].set_ylim(-24e6, 40e6)
    axes[0].set_title("State revenue change, fixed volume", fontsize=9.5)
    axes[0].legend(loc="upper left", bbox_to_anchor=(1.01, 1.0))
    axes[1].set_title("Grocery price vs a state store (% change)", fontsize=9.5)
    axes[1].axhline(0, color=INK, lw=1, zorder=1.5)
    axes[2].set_title("What the wholesaler and grocer keep together (¢ per $1 of today's price)", fontsize=9.5)
    axes[2].axhline(0, color=INK, lw=1)
    axes[2].set_xlabel("Charge rate on the grocery price before the charge (%); the engine accepts rates up to 100%")
    axes[2].set_xlim(0, 100)
    note = NOTE_U + " Private sellers are assumed to pay suppliers DABS's landed cost (U14)."
    if cut is not None:
        note += f" *Dashed blue: above a {cut:.1f}% charge at today's price, the wholesaler and grocer together keep less than the wholesaler's assumed {w} margin ({wm * 100:.1f}¢ per $1), so the grocer would sell below its acquisition cost; the break-even there is arithmetic, not a workable arrangement as specified. National margins are references, not minimums."
    head(fig, *titles["U5"], note)
    save(fig, out, "U5_private_charge_sweep.png")


def u6_demand(d, out, titles):
    ids = ["A_target", "A_net", "B20_target", "C_take", "C_break_even", "C_take_outside", "A_matched", "B20_matched", "C20_matched"]
    kinds = [
        ("fixed", "Fixed volume", "D", INK, True),
        ("price_constant", "Exploratory: constant elasticity", "o", BLUE, True),
        ("price_linear", "Exploratory: straight-line demand", "o", BLUE, False),
        ("return_to_stores", "Read as buyers returning to state stores", "s", ORANGE, True),
        ("recapture", "Recapture 2% (illustrative)", "^", AQUA, True),
        ("access", "Access +4.5% (exploratory)", "v", AQUA, False),
    ]
    fig, ax = plt.subplots(figsize=(12.5, 7.0))
    fig.subplots_adjust(left=0.24, right=0.75)
    y = np.arange(len(ids))[::-1]
    for yi, aid in zip(y, ids, strict=True):
        a = ct.alt(d, aid)
        vals = {x["id"]: x["net"] for x in a["demand"]}
        drawn = [vals[k] for k, *_ in kinds]
        ax.hlines(yi, min(drawn), max(drawn), color=GRID, lw=1.5, zorder=1)
        for k, _, mk, col, filled in kinds:
            ax.plot([vals[k]], [yi], mk, color=col, ms=7 if k != "fixed" else 8, mfc=col if filled else SURFACE, mec=col if not filled else SURFACE, mew=1.3, zorder=5 if k == "fixed" else 3)
    ax.axvline(0, color=INK, lw=1)
    ax.set_yticks(y, [ct.alt(d, a)["short"] for a in ids], fontsize=8.5)
    ax.grid(axis="y", visible=False)
    ax.xaxis.set_major_locator(matplotlib.ticker.MultipleLocator(2e6))
    ax.xaxis.set_major_formatter(m_fmt)
    ax.set_xlabel("State revenue change, $ a year (where marks coincide, the fixed-volume diamond is on top)")
    handles = [Line2D([], [], marker=mk, color=col, ls="none", mfc=col if f else SURFACE, mec=col if not f else SURFACE, label=lab, ms=7) for _, lab, mk, col, f in kinds]
    ax.legend(handles=handles, loc="upper left", bbox_to_anchor=(1.01, 1.0), fontsize=8)
    head(
        fig,
        *titles["U6"],
        NOTE_U
        + " Elasticity −0.46 (Nelson 2013), market-wide, applied to one channel. The share that moves does not respond to price in this model; the purchase-flow model lets it (F5). The case with all three mechanisms together is in demand_sensitivity.csv (case all), not drawn.",
    )
    save(fig, out, "U6_demand_sensitivity.png")


def u7_costs(d, out, titles):
    ids = ["A_target", "B20_matched", "B20_target", "C_take", "C20_matched"]
    fig, axes = plt.subplots(1, len(ids), figsize=(16, 6.8), sharey=True)
    fig.subplots_adjust(left=0.25, right=0.99, wspace=0.12)
    labels = []
    for c in d["cost_cases"]["C_take"]:
        if c["id"] != "short_run":  # equal to "as defined" for every alternative here
            labels.append((c["id"], c["label"]))
    extra = [c for c in d["cost_cases"]["A_target"] if c["id"] == "handling"]
    labels += [(c["id"], c["label"]) for c in extra]
    y = {cid: i for i, (cid, _) in enumerate(labels[::-1])}
    for ax, aid in zip(axes, ids, strict=True):
        cases = d["cost_cases"][aid]
        for c in [c for c in cases if c["id"] in y]:
            ax.plot([c["net"]], [y[c["id"]]], "o", color=BLUE if c["net"] >= 0 else RED, ms=6.5, mec=SURFACE, mew=1)
        base = next(c for c in cases if c["id"] == "as_defined")["net"]
        ax.axvline(base, color=INK2, lw=1, ls="--")
        ax.axvline(0, color=INK, lw=1)
        ax.set_title("\n".join(wrap_to(fig, ct.alt(d, aid)["short"], 8.5, "bold", 2.2 * fig.dpi)), fontsize=8.5)
        ax.xaxis.set_major_formatter(m_fmt)
        ax.locator_params(axis="x", nbins=3)
        ax.grid(axis="y", visible=False)
    axes[0].set_yticks(list(y.values()), ["\n".join(wrap_to(fig, lab, 8, "normal", 3.7 * fig.dpi)) for _, lab in labels[::-1]], fontsize=8)
    head(fig, *titles["U7"], NOTE_U + " Dashed line: the alternative as defined. Not every case applies to every alternative (handling: DABS supply; delivery: private supply).", legend_in=0.3)
    save(fig, out, "U7_cost_cases.png")


def u8_beer(d, out, titles):
    ids = [a for a in ct.MAIN if ct.alt(d, a)["ledger_fixed"]["net"] < -0.5]
    fig, ax = plt.subplots(figsize=(11, 5.4))
    fig.subplots_adjust(left=0.3, right=0.95)
    y = np.arange(len(ids))[::-1]
    for yi, aid in zip(y, ids, strict=True):
        th = ct.alt(d, aid)["beer_threshold"]
        v = th["swap"] * 100 if th["swap"] is not None else np.nan
        ax.barh(yi, 0 if np.isnan(v) else v, color=BLUE, height=0.6)
        ax.text((0 if np.isnan(v) else v) + 1, yi, "not reached" if np.isnan(v) else f"{v:.0f}%", va="center", fontsize=8.5, color=INK)
    ax.set_yticks(y, [ct.alt(d, a)["short"] for a in ids], fontsize=8.5)
    ax.grid(axis="y", visible=False)
    ax.set_xlim(0, max(60, ax.get_xlim()[1]))
    ax.set_xlabel("Extra wine bought instead of beer, % of 2024 wine gallons")
    head(fig, *titles["U8"], NOTE_U + " Beer price $12 a gallon is a placeholder; beer replaced is taken to be grocery beer (excise and sales tax only).")
    save(fig, out, "U8_beer_to_wine_threshold.png")


# ----- Tennessee ------------------------------------------------------------------------------------------------------
NOTE_T = "Observed: dataset 0.2.0-preview (NIAAA apparent consumption; Census T10; TN Dept. of Revenue), unreviewed; engine before-after@1.2 via web/src/export/tennessee.ts. Descriptive, not an effect estimate."
TN = "state:47"


def series(tn, oid, geo):
    pts = sorted((int(r["year"]), float(r["value"])) for r in tn["raw"] if r["outcome_id"] == oid and r["geo_id"] == geo)
    return np.array([p[0] for p in pts]), np.array([p[1] for p in pts])


def neighbours(tn, oid):
    return sorted({r["geo_id"] for r in tn["raw"] if r["outcome_id"] == oid and r["geo_id"] != TN})


def shade(ax, before, after, law):
    ax.axvspan(before[0] - 0.5, before[1] + 0.5, color=SHADE, zorder=0)
    ax.axvspan(after[0] - 0.5, after[1] + 0.5, color=SHADE, zorder=0)
    ax.axvline(law, color=MUTED, lw=1, ls="--", zorder=1)


def t1(tn, out, titles):
    fig, ax = plt.subplots(figsize=(11, 6))
    fig.subplots_adjust(left=0.08, right=0.76)
    idx = {}
    for g in [TN, *neighbours(tn, "R1")]:
        x, v = series(tn, "R1", g)
        keep = x >= 2005
        x, v = x[keep], v[keep]
        idx[g] = (x, 100 * v / v[(x >= 2012) & (x <= 2015)].mean())
    for i, g in enumerate(neighbours(tn, "R1")):
        ax.plot(*idx[g], color=CONTEXT, lw=1, label="Each bordering state" if i == 0 else None)
    xs = idx[TN][0]
    avg = np.mean([np.interp(xs, *idx[g]) for g in neighbours(tn, "R1")], axis=0)
    ax.plot(xs, avg, color=ORANGE, label="Bordering states' average")
    ax.plot(*idx[TN], color=BLUE, label="Tennessee")
    shade(ax, (2012, 2015), (2017, 2019), 2016.5)
    ax.axhline(100, color=INK2, lw=0.8)
    ax.set_xticks(range(2005, 2026, 5))
    ax.set_xlim(2004.5, 2026.8)
    ax.set_ylabel("Index, FY2012–15 average = 100")
    ax.set_xlabel("State fiscal year (dashed: grocery-wine licences from July 2016, the start of Tennessee's FY2017)")
    ax.text(idx[TN][0][-1] + 0.3, idx[TN][1][-1], f"TN {idx[TN][1][-1]:.0f}", va="center", fontsize=8.5)
    ax.annotate("FY2022 jump: not explained,\noutside the comparison windows", (2022, float(idx[TN][1][idx[TN][0] == 2022][0])), (2016.2, 158), ha="right", fontsize=8, color=INK2, arrowprops=dict(arrowstyle="-", color=MUTED, lw=0.8))
    ax.text(xs[-1] + 0.3, avg[-1], f"avg {avg[-1]:.0f}", va="center", fontsize=8.5)
    ax.legend(loc="upper left", bbox_to_anchor=(1.01, 1.0))
    head(fig, *titles["T1"], NOTE_T)
    save(fig, out, "T1_tennessee_alcohol_tax_receipts_vs_neighbours.png")
    return xs, idx, avg


def t2(tn, out, titles):
    x, v = series(tn, "R1", TN)
    row = next(r for r in tn["by_state"] if r["outcome_id"] == "R1" and r["geo_id"] == TN)
    slope, bmean = float(row["pre_trend_slope_per_year"]), float(row["before_mean"])
    trend = lambda yy: bmean + slope * (np.asarray(yy, float) - 2013.5)  # noqa: E731
    after = np.array([2017, 2018, 2019])
    above = float(np.mean([v[x == yy][0] for yy in after]) - trend(after).mean())
    rise = float(np.mean([v[x == yy][0] for yy in after]) - bmean)
    titles["T2"] = ct.tn_titles(tn, above)["T2"]
    fig, ax = plt.subplots(figsize=(11, 5.8))
    fig.subplots_adjust(left=0.1, right=0.97)
    keep = x >= 2005
    ax.plot(x[keep], v[keep], color=BLUE, label="Tennessee, actual")
    yy = np.arange(2012, 2020)
    ax.plot(yy, trend(yy), color=ORANGE, ls="--", label="Straight-line continuation of FY2012–15")
    shade(ax, (2012, 2015), (2017, 2019), 2016.5)
    for a in after:
        ax.plot([a, a], [trend(a), v[x == a][0]], color=MUTED, lw=1)
    ax.text(2015.8, 262e6, f"FY2017–19: {ct.money(above)} a year above the\nline on average; total rise {ct.money(rise)}", ha="right", va="center", fontsize=8.5, color=INK)
    ax.yaxis.set_major_formatter(m_fmt)
    ax.set_xlim(2004.5, 2025.8)
    year_ticks(ax, 2005, 2025)
    ax.set_ylabel("Alcohol tax receipts (T10), constant 2024 $")
    ax.set_xlabel("Tennessee fiscal year (dashed vertical: grocery-wine licences from July 2016)")
    ax.legend(loc="upper left")
    head(fig, *titles["T2"], NOTE_T)
    save(fig, out, "T2_tennessee_receipts_vs_earlier_trend.png")
    return {"rise": rise, "above_trend": above, "trend_part": rise - above}


def t3(tn, out, titles):
    x1, w1 = series(tn, "R2", TN)
    x2, w2 = series(tn, "R2b", TN)
    xe, en = series(tn, "R3", TN)
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(12.5, 5.6))
    fig.subplots_adjust(left=0.08, right=0.98, wspace=0.25)
    a1.plot(x1, w1, color=BLUE, marker="o", ms=5, label="'Wine Tax' (to FY2017)")
    a1.plot(x2, w2, color=BLUE, ls=":", marker="o", ms=5, mfc=SURFACE, label="Relabelled 'Wine Tax &\nHigh Alcohol Beer'")
    pre = w1[(x1 >= 2012) & (x1 <= 2016)].mean()
    a1.hlines(pre, 2011.6, 2016.4, color=INK2, lw=1)
    a1.text(2011.6, pre + 0.35e6, f"FY2012–16\naverage {ct.money(pre)[1:]}", fontsize=8, color=INK2, va="bottom")
    v17 = w1[x1 == 2017][0]
    a1.annotate(f"FY2017 {ct.money(v17)[1:]}\n({(v17 / pre - 1) * 100:+.1f}% on that average)", (2017, v17), (2018.3, 24.0e6), fontsize=8.5, va="center", arrowprops=dict(arrowstyle="-", color=MUTED, lw=0.8, shrinkB=5))
    a1.axvline(2016.5, color=MUTED, lw=1, ls="--")
    a1.set_ylim(12e6, 25.5e6)
    a1.set_xlim(2009.4, 2025.6)
    a1.yaxis.set_major_formatter(m_fmt)
    a1.legend(loc="upper left", fontsize=7.5, handlelength=1.6)
    a1.set_title("Wine tax account", fontsize=9.5)
    a2.plot(xe, en, color=BLUE, marker="o", ms=5)
    a2.axvline(2016.5, color=MUTED, lw=1, ls="--")
    a2.set_ylim(0.6e6, 1.1e6)
    a2.yaxis.set_major_formatter(lambda v, _: f"${v / 1e6:,.2f}M")
    a2.set_title("Wine enforcement tax (account 11018)", fontsize=9.5)
    for a in (a1, a2):
        a.set_xlabel("Tennessee fiscal year (dashed: licences from July 2016)")
    a1.set_ylabel("Constant 2024 $")
    head(fig, *titles["T3"], NOTE_T)
    save(fig, out, "T3_tennessee_wine_tax_accounts.png")


def t4(tn, out, titles):
    names = {"B1": "Wine", "B2": "Beer", "B3": "Spirits", "B4": "All alcohol"}
    fig, axes = plt.subplots(2, 2, figsize=(12.5, 8.4))
    fig.subplots_adjust(left=0.08, right=0.98, hspace=0.42, wspace=0.18)
    for ax, oid in zip(axes.flat, names, strict=True):
        nb = neighbours(tn, oid)
        for i, g in enumerate(nb):
            x, v = series(tn, oid, g)
            k = x >= 2003
            ax.plot(x[k], v[k], color=CONTEXT, lw=1, label="Each bordering state" if i == 0 else None)
        x, v = series(tn, oid, TN)
        k = x >= 2003
        avg = np.mean([np.interp(x[k], *series(tn, oid, g)) for g in nb], axis=0)
        ax.plot(x[k], avg, color=ORANGE, label="Bordering states' average")
        ax.plot(x[k], v[k], color=BLUE, label="Tennessee")
        shade(ax, (2011, 2015), (2017, 2019), 2016)
        own = ct.tn_value(tn, "main", oid, "tn_pct_change")
        rel = ct.tn_value(tn, "main", oid, "diff_log_points")
        ax.set_title(minus(f"{names[oid]}: TN {own:+.1f}%; {rel:+.1f} log pts vs neighbours' average"), fontsize=9)
        ax.set_xlim(2002.5, 2024.8)
        year_ticks(ax, 2005, 2020)
    for ax in axes[:, 0]:
        ax.set_ylabel("Gallons of ethanol per resident 21+")
    for ax in axes[1]:
        ax.set_xlabel("Calendar year (shaded: 2011–15 and 2017–19; dashed: 2016)")
    head(fig, *titles["T4"], NOTE_T, legend_in=0.45)
    h, lab = axes[0, 0].get_legend_handles_labels()
    fig.legend(h[::-1], lab[::-1], loc="lower left", bbox_to_anchor=(0.008, fig.subplotpars.top + 0.045), ncol=3, fontsize=8.5)
    save(fig, out, "T4_tennessee_purchases_by_beverage.png")


def t5(tn, out, titles):
    lab = {"B1": "Wine", "B2": "Beer", "B3": "Spirits", "B4": "All alcohol", "R1": "Alcohol tax receipts"}
    fig, axes = plt.subplots(5, 1, figsize=(11, 8.6))
    fig.subplots_adjust(left=0.2, right=0.8, hspace=1.0)
    counts = {}
    for ax, oid in zip(axes, lab, strict=True):
        rows = [r for r in tn["placebo"] if r["outcome_id"] == oid]
        act = float(next(r for r in rows if r["kind"] == "actual")["pooled_difference_in_changes"])
        p = np.array([float(r["pooled_difference_in_changes"]) for r in rows if r["kind"] == "placebo" and r["pooled_difference_in_changes"] not in ("", None)])
        k = int((np.abs(p) >= abs(act)).sum())
        counts[oid] = (k, len(p))
        ax.axvline(0, color=INK2, lw=0.8)
        ax.plot(p, np.zeros_like(p), "o", color=MUTED, ms=7, alpha=0.75, mec=SURFACE, label="Earlier dates (no law change)" if oid == "B1" else None)
        ax.plot([act], [0], "D", color=BLUE, ms=9, mec=SURFACE, label="July 2016" if oid == "B1" else None)
        ax.set_yticks([0], [lab[oid]])
        ax.grid(axis="y", visible=False)
        ax.set_ylim(-1, 1)
        span = max(abs(act), np.abs(p).max()) * 1.15
        ax.set_xlim(-span, span)
        if oid == "R1":
            ax.xaxis.set_major_formatter(m_fmt)
            ax.set_xlabel("Tennessee's change minus the neighbours' average change (constant 2024 $)", fontsize=8)
        else:
            ax.set_xlabel("Difference in changes, gallons of ethanol per resident 21+", fontsize=8)
        ax.text(1.02, 0.5, f"{k} of {len(p)} earlier\ndates as large", transform=ax.transAxes, va="center", fontsize=8.5)
    axes[0].legend(loc="lower left", bbox_to_anchor=(0.0, 1.2), ncol=2, fontsize=8.5)
    head(fig, *titles["T5"], NOTE_T, legend_in=0.3)
    save(fig, out, "T5_tennessee_placebo_dates.png")
    return counts


def t6(tn, out, titles):
    order = ["R1", "B4", "B3", "B2", "B1"]
    lab = {"B1": "Wine", "B2": "Beer", "B3": "Spirits", "B4": "All alcohol", "R1": "Alcohol tax receipts"}
    fig, ax = plt.subplots(figsize=(11, 5.8))
    fig.subplots_adjust(left=0.2, right=0.78)
    for yi, oid in enumerate(order):
        rows = [r for r in tn["results"] if r["outcome_id"] == oid and r["diff_log_points"] not in ("", None)]
        main = next(r for r in rows if r["specification"] == "main")
        others = np.array([float(r["diff_log_points"]) for r in rows if r["specification"] != "main"])
        ax.plot(others, np.full_like(others, yi), "o", color=MUTED, ms=7, alpha=0.8, mec=SURFACE, label="Other specifications" if yi == 0 else None)
        ax.hlines(yi, float(main["leave_one_out_low_log_points"]), float(main["leave_one_out_high_log_points"]), color=BLUE, lw=3, label="Main: leave one neighbour out" if yi == 0 else None)
        ax.plot([float(main["diff_log_points"])], [yi], "D", color=BLUE, ms=9, mec=SURFACE, label="Main specification" if yi == 0 else None)
        allv = [float(r["diff_log_points"]) for r in rows]
        lo1, hi1 = float(main["leave_one_out_low_log_points"]), float(main["leave_one_out_high_log_points"])
        ax.text(36.5, yi, minus(f"main {float(main['diff_log_points']):+.1f}\nspecifications {min(allv):+.1f} to {max(allv):+.1f}\nleave one out {lo1:+.1f} to {hi1:+.1f}"), va="center", fontsize=8, linespacing=1.25)
    ax.axvline(0, color=INK, lw=1)
    ax.set_yticks(range(len(order)), [lab[o] for o in order])
    ax.grid(axis="y", visible=False)
    ax.set_xlim(-6, 35)
    ax.set_xlabel("Tennessee's change minus the neighbours' average change (log points, about %)")
    ax.legend(loc="lower left", bbox_to_anchor=(0.0, 1.0), ncol=3, fontsize=8.5)
    head(fig, *titles["T6"], NOTE_T, legend_in=0.3)
    save(fig, out, "T6_tennessee_sensitivity_ranges.png")


def s0(d, tn, trend, out, titles):
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(14, 6.4))
    fig.subplots_adjust(left=0.17, right=0.98, wspace=0.75)
    x1, w1 = series(tn, "R2", TN)
    wine_gain = w1[x1 == 2017][0] - w1[(x1 >= 2012) & (x1 <= 2016)].mean()
    rows = [("Alcohol tax receipts (T10):\nFY2012–15 to FY2017–19", trend["rise"], BLUE), ("of which a straight-line\ncontinuation of FY2012–15", trend["trend_part"], CONTEXT), ("of which above that line", trend["above_trend"], BLUE), ("Wine-tax account: FY2017 vs\nits FY2012–16 average", wine_gain, BLUE)]
    for i, (_lab, val, col) in enumerate(rows[::-1]):
        a1.barh(i, val, color=col, height=0.55)
        a1.text(val + 1e6, i, ct.money(val), va="center", fontsize=9)
    a1.set_yticks(range(len(rows)), [r[0] for r in rows[::-1]], fontsize=8.5)
    a1.set_xlim(0, 80e6)
    a1.set_xticks([0, 20e6, 40e6, 60e6])
    a1.xaxis.set_major_formatter(m_fmt)
    a1.grid(axis="y", visible=False)
    a1.set_title("Observed: Tennessee, private licensees (2016)", fontsize=9.5)
    a1.set_xlabel("Change a year, constant 2024 $ (descriptive)")
    ids = ["R1", "R2", "B20_target", "A_target", "C_take", "C_break_even"]
    y = np.arange(len(ids))[::-1]
    for yi, aid in zip(y, ids, strict=True):
        a = ct.alt(d, aid)
        n = a["ledger_fixed"]["net"]
        a2.barh(yi, n, color=BLUE if n >= -0.5 else RED, height=0.55)
        cons = a["price_stack"]["consumerChange"]
        a2.text(max(n, 0) + 0.5e6, yi, f"{ct.money(n)}; price {cons * 100:+.0f}%", va="center", ha="left", fontsize=8.5)
    a2.set_yticks(y, [ct.alt(d, a)["short"] for a in ids], fontsize=8.5)
    a2.axvline(0, color=INK, lw=1)
    a2.set_xlim(-22e6, 14e6)
    a2.set_xticks([-15e6, -10e6, -5e6, 0, 5e6])
    a2.xaxis.set_major_formatter(m_fmt)
    a2.grid(axis="y", visible=False)
    a2.set_title("Model: Utah, state stores open (fixed volume)", fontsize=9.5)
    a2.set_xlabel("State revenue change, $ a year; grocery price vs a state store")
    head(fig, *titles["S0"], "Left: before-and-after description, not an effect estimate, not applied to Utah. Right: project model, conditional on inputs U01-U18; Ref. 1 and 2 are the brief's original cases (5¢ savings). Separate panels and axes.")
    save(fig, out, "00_summary.png")


# ----- Utah: grocery price x grocery share (wine-price-share@1.0) -------------------------------------------------------
NOTE_PS = (
    "Model: project scripts, web/src/lib/winePriceShare.ts (wine-price-share@1.0) on the scenario engine; FY2025 $ a year; "
    "households 82% of wine purchases (U03); new administration $0.5M a year (U10), paid even when nothing moves; extra "
    "wholesale handling cost unknown, set to zero (U11); inputs and every cell in price_share.json and price_share_grid.csv; "
    "none reviewed by a person."
)
ARR_COL = {"dabs_0": BLUE, "dabs_20": AQUA, "private_20": ORANGE, "private_take": MAGENTA}
LOSS_GAIN = matplotlib.colors.LinearSegmentedColormap.from_list("loss_gain", [RED, "#f6f5f1", BLUE])


def ps_fmt(v: float) -> str:
    """$ millions with a sign; two decimals under $0.1M, so a small loss or gain never reads as zero."""
    a = abs(v) / 1e6
    body = f"{a:.2f}" if a < 0.095 else f"{a:.1f}"
    return ("−" if v < 0 else "+" if v > 0 else "") + body


def ink_on(rgba) -> str:
    r, g, b = [c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4 for c in rgba[:3]]
    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    return INK if (lum + 0.05) / 0.05 > 1.05 / (lum + 0.05) else "#ffffff"


def ps_refs(ps: dict) -> list[dict]:
    """The existing alternatives on the grids, numbered once for the whole package."""
    out = []
    for a in ps["arrangements"]:
        for r in ps["references"]:
            if r["arrangement"] == a["id"]:
                out.append({**r, "n": len(out) + 1})
    return out


def ps_grid(ps, out, titles, savings: str, key: str, name: str) -> None:
    P = ps["axes"]["premium"]["values"]
    S = ps["axes"]["share"]["values"]
    dp, ds = (P[1] - P[0]) * 100, (S[1] - S[0]) * 100
    lim = ps["colour_limit_usd"]
    norm = matplotlib.colors.Normalize(vmin=-lim, vmax=lim)
    refs = ps_refs(ps)
    fig, axes = plt.subplots(2, 2, figsize=(14, 11.2))
    fig.subplots_adjust(left=0.09, right=0.985, hspace=0.36, wspace=0.1)
    for k, (ax, a) in enumerate(zip(axes.flat, ps["arrangements"], strict=True)):
        left_col = k % 2 == 0
        Z = np.array([[ct.ps_cell(ps, a["id"], pp, ss, savings, "fixed_volume")["net"] for pp in P] for ss in S])
        ext = [P[0] * 100 - dp / 2, P[-1] * 100 + dp / 2, S[0] * 100 - ds / 2, S[-1] * 100 + ds / 2]
        ax.imshow(Z, origin="lower", extent=ext, aspect="auto", cmap=LOSS_GAIN, norm=norm, interpolation="nearest", zorder=1)
        for i in range(len(P) + 1):
            ax.axvline(ext[0] + i * dp, color=SURFACE, lw=2, zorder=2)
        for j in range(len(S) + 1):
            ax.axhline(ext[2] + j * ds, color=SURFACE, lw=2, zorder=2)
        for j, ss in enumerate(S):
            for i, pp in enumerate(P):
                z = Z[j, i]
                fill = LOSS_GAIN(norm(z))
                # A box in the cell's own colour masks any line behind the number, so a minus sign never merges into a line running flat through the row.
                ax.text(pp * 100, ss * 100, ps_fmt(z), ha="center", va="center", fontsize=7.4, color=ink_on(fill), zorder=9, bbox=dict(boxstyle="square,pad=0.12", fc=fill, ec="none"))
        mk = next(m for m in ps["markers"] if m["arrangement"] == a["id"])
        if mk["grocerCost"] is not None and mk["grocerCost"] > 1e-9:
            ax.axvspan(ext[0], min(mk["grocerCost"] * 100, ext[1]), facecolor="none", edgecolor=INK, hatch="////", lw=0, alpha=0.5, zorder=4)
        if mk["reference"] is not None and ext[0] <= mk["reference"] * 100 <= ext[1]:
            ax.axvline(mk["reference"] * 100, color=INK, lw=1.4, ls=(0, (5, 3)), zorder=4)
        be = [b for b in ps["share_break_evens"] if b["arrangement"] == a["id"] and b["savings"] == savings and b["volume"] == "fixed_volume"]
        bx = [b["premium"] * 100 for b in be]
        by = [np.nan if b["share"] is None else b["share"] * 100 for b in be]
        ax.plot(bx, by, color=INK, lw=2.4, zorder=5, solid_capstyle="round")
        for r in [r for r in refs if r["arrangement"] == a["id"]]:
            x, y = r["premium"] * 100, r["share"] * 100 + 0.34 * ds
            ax.plot([x], [y], "o", ms=12, mfc=SURFACE, mec=INK, mew=1.3, zorder=7)
            ax.text(x, y, str(r["n"]), ha="center", va="center", fontsize=7.5, fontweight="bold", color=INK, zorder=8)
        ax.set_xlim(ext[0], ext[1])
        ax.set_ylim(ext[2], ext[3])
        ax.set_xticks([v * 100 for v in P[::2]], [f"{v * 100:.0f}%" for v in P[::2]])
        ax.set_yticks([v * 100 for v in S], [f"{v * 100:.0f}%" + (" (worked)" if left_col and abs(v - 0.3) < 1e-9 else "") for v in S])
        ax.grid(False)
        ax.set_title(a["label"], fontsize=9.5)
        ax.set_xlabel("Grocery price premium over a state store (consumer price, state sales tax included)", fontsize=8.5)
        if left_col:
            ax.set_ylabel("Covered household purchases moving", fontsize=8.5)
    head(fig, *titles[key], NOTE_PS + " Numbered circles, existing alternatives on these grids: " + "; ".join(f"{r['n']} {r['short']} ({r['premium'] * 100:.1f}%, {ct.money(r['net' if savings == 'source_based' else 'zeroSavingsNet'])})" for r in refs) + ".", legend_in=0.62)
    sp = fig.subplotpars
    H = fig.get_figheight()
    cax = fig.add_axes([sp.left, sp.top + 0.36 / H, 0.26, 0.13 / H])
    cb = fig.colorbar(matplotlib.cm.ScalarMappable(norm=norm, cmap=LOSS_GAIN), cax=cax, orientation="horizontal")
    cb.set_ticks([-lim, -lim / 2, 0, lim / 2, lim])
    cb.ax.xaxis.set_major_formatter(m_fmt)
    cb.ax.tick_params(labelsize=8)
    cb.outline.set_visible(False)
    cb.set_label("State annual change: red lowers receipts, blue raises them", fontsize=8.5, labelpad=2)
    cb.ax.xaxis.set_label_position("top")
    handles = [
        Line2D([], [], color=INK, lw=2.4, label="Break-even share: at or above the line the state keeps today's receipts"),
        Line2D([], [], color=INK, lw=1.4, ls=(0, (5, 3)), label="Grocer's gross margin reaches the 28% reference (not a constraint)"),
        Patch(facecolor="none", edgecolor=INK, hatch="////", label="Grocer below acquisition cost (arithmetic only)"),
    ]
    fig.legend(handles=handles, loc="lower left", bbox_to_anchor=(sp.left + 0.29, sp.top + 0.22 / H), ncol=1, fontsize=8.3)
    save(fig, out, name)


def ps_margins(ps, out, titles) -> None:
    fig, ax = plt.subplots(figsize=(12, 6.6))
    fig.subplots_adjust(left=0.08, right=0.72)
    for a in ps["arrangements"]:
        pts = sorted((q for q in ps["prices"] if q["arrangement"] == a["id"]), key=lambda q: q["premium"])
        x = np.array([q["premium"] * 100 for q in pts])
        y = np.array([q["grocerMargin"] * 100 for q in pts])
        col = ARR_COL[a["id"]]
        ax.plot(x, y, color=col, lw=2, zorder=3)
        below = np.array([q["position"] == "below_cost" for q in pts])
        ax.plot(x[~below], y[~below], "o", color=col, ms=6.5, mec=SURFACE, mew=1.2, zorder=4)
        ax.plot(x[below], y[below], "o", color=col, ms=6.5, mfc=SURFACE, mew=1.6, zorder=4)
        ax.text(1.01, y[-1], f"{a['short']}: {y[-1]:.1f}% at 60%".replace("-", "−"), transform=matplotlib.transforms.blended_transform_factory(ax.transAxes, ax.transData), va="center", fontsize=8.5, color=INK)
    ax.axhspan(-30, 0, color=SHADE, zorder=0)
    ax.axhline(0, color=INK, lw=1.2)
    ax.axhline(28, color=INK2, lw=1.3, ls=(0, (5, 3)))
    ax.text(1.01, 26.6, "28% (dashed): national average for\ngrocery stores, all products (a\nreference, not a minimum)", transform=matplotlib.transforms.blended_transform_factory(ax.transAxes, ax.transData), fontsize=8, color=INK2, va="top")
    ax.text(1.01, -6, "Shaded, below 0%: the grocer would\nsell below what it pays (acquisition\ncost): arithmetic only", transform=matplotlib.transforms.blended_transform_factory(ax.transAxes, ax.transData), fontsize=8, color=INK2, va="center")
    ax.set_xlim(-1.5, 61.5)
    ax.set_ylim(-14, 56)
    ax.set_xticks(range(0, 61, 10), [f"{v}%" for v in range(0, 61, 10)])
    ax.yaxis.set_major_formatter(lambda v, _: f"{v:.0f}%".replace("-", "−"))
    ax.set_xlabel("Grocery price premium over a state store (consumer price, state sales tax included)")
    ax.set_ylabel("Grocer's gross margin, % of its own selling price")
    handles = [Line2D([], [], color=ARR_COL[a["id"]], marker="o", label=a["label"]) for a in ps["arrangements"]] + [
        Line2D([], [], color=INK2, marker="o", mfc=SURFACE, ls="none", label="Hollow: grocer below acquisition cost")
    ]
    ax.legend(handles=handles, loc="upper left", fontsize=8)
    head(fig, *titles["U11"], NOTE_PS + " DABS supply: the grocer pays DABS today's shelf price less the discount. Private supply: the charge is taken off the shelf price first; the wholesaler's 29.5% (U13) is an assumed split, and what wholesaler and grocer keep together does not depend on it.")
    save(fig, out, "U11_price_share_grocer_margin.png")


def ps_response(ps, out, titles) -> None:
    P = ps["axes"]["premium"]["values"]
    fig, axes = plt.subplots(2, 2, figsize=(13, 9.4))
    fig.subplots_adjust(left=0.08, right=0.985, hspace=0.42, wspace=0.2)
    for ax, a in zip(axes.flat, ps["arrangements"], strict=True):
        col = ARR_COL[a["id"]]
        x = [pp * 100 for pp in P]
        f = [ct.ps_cell(ps, a["id"], pp, 0.3, "source_based", "fixed_volume")["net"] for pp in P]
        r = [ct.ps_cell(ps, a["id"], pp, 0.3, "source_based", "price_response")["net"] for pp in P]
        ax.plot(x, f, color=col, lw=2, marker="o", ms=4.5, mec=SURFACE, label="Fixed volume")
        ax.plot(
            x,
            r,
            color=col,
            lw=2,
            ls=(0, (5, 3)),
            marker="o",
            ms=4.5,
            mfc=SURFACE,
            label="Exploratory: with the old price response",
        )
        ax.axhline(0, color=INK, lw=1)
        for vals, va in ((f, "bottom"), (r, "top")):
            ax.annotate(ct.money(vals[-1]), (x[-1], vals[-1]), (4, 6 if va == "bottom" else -6), textcoords="offset points", fontsize=8, va=va, color=INK)
        ax.set_xlim(-2, 68)
        ax.set_xticks(range(0, 61, 10), [f"{v}%" for v in range(0, 61, 10)])
        ax.yaxis.set_major_formatter(m_fmt)
        lo, hi = min(min(f), min(r), 0), max(max(f), max(r), 0)
        pad = (hi - lo) * 0.18 + 0.2e6
        ax.set_ylim(lo - pad, hi + pad)
        ax.set_title("\n".join(wrap_to(fig, a["label"], 9.5, "bold", 4.9 * fig.dpi)), fontsize=9.5)
        ax.set_xlabel("Grocery price premium over a state store", fontsize=8.5)
        ax.set_ylabel("State annual change, 30% moving", fontsize=8.5)
    axes[0, 0].legend(
        handles=[
            Line2D([], [], color=INK2, lw=2, marker="o", ms=4.5, mec=SURFACE, label="Fixed volume"),
            Line2D(
                [],
                [],
                color=INK2,
                lw=2,
                ls=(0, (5, 3)),
                marker="o",
                ms=4.5,
                mfc=SURFACE,
                label="Exploratory: with the old price response",
            ),
        ],
        loc="lower left",
        fontsize=8,
        handlelength=3.2,
    )
    head(
        fig,
        *titles["U12"],
        NOTE_PS
        + " Source-based savings (2.28¢, U07). Each panel has its own vertical scale. Elasticity −0.46 (Nelson 2013) is a market-wide estimate applied to one channel; here the share that moves does not respond to the price, and substitution and cross-border recapture are not added; the purchase-flow charts F5, F6 and F10 add them.",
    )
    save(fig, out, "U12_price_share_price_response.png")


def ps_funds(ps, out, titles) -> None:
    S = ps["axes"]["share"]["values"]
    fig, ax = plt.subplots(figsize=(11.5, 6.0))
    fig.subplots_adjust(left=0.1, right=0.6)
    x = [ss * 100 for ss in S]
    # Every case as a series; cases with identical values are drawn once and named together.
    series: list[tuple[str, str, list[float]]] = []
    for a in ps["arrangements"]:
        cells = [ct.ps_cell(ps, a["id"], 0, ss, "source_based", "fixed_volume") for ss in S]
        if a["supply"] == "private":
            series.append((a["short"], a["id"], [c["funds"] for c in cells]))
        else:
            series.append((f"{a['short']}, deposits on its sales to grocers", a["id"], [c["funds"] for c in cells]))
            series.append((f"{a['short']}, no deposits on them", a["id"], [c["fundsOtherReading"] for c in cells]))
    groups: list[tuple[list[str], set[str], list[float]]] = []
    for name, aid, y in series:
        for g in groups:
            if all(abs(u - v) < 1 for u, v in zip(y, g[2], strict=True)):
                g[0].append(name)
                g[1].add(aid)
                break
        else:
            groups.append(([name], {aid}, y))
    beside = matplotlib.transforms.blended_transform_factory(ax.transAxes, ax.transData)
    for names, aids, y in sorted(groups, key=lambda g: -g[2][-1]):
        col = ARR_COL[next(iter(aids))] if len(aids) == 1 else INK2
        ax.plot(x, y, color=col, lw=2.2, marker="o", ms=5, mec=SURFACE, zorder=3)
        label = "\n".join(names)
        ax.text(1.02, y[-1], f"{ct.money(y[-1]) if abs(y[-1]) > 0.05e6 else 'no change'} at 50%:\n{label}", transform=beside, va="center", fontsize=8.2, color=INK)
    ax.axhline(0, color=INK, lw=1, zorder=2)
    ax.set_xlim(-2, 51)
    ax.set_xticks(x, [f"{v:.0f}%" for v in x])
    ax.yaxis.set_major_formatter(m_fmt)
    ax.set_xlabel("Covered household wine purchases moving to grocers")
    ax.set_ylabel("Change for the two funds together, $ a year")
    head(fig, *titles["U13"], NOTE_PS + " Deposits: 10% (school meals) and 1.695% (enforcement) of total gross revenue from liquor sales (U06); the statewide totals already include them. Lines that coincide are drawn once and labelled with every case they cover (grey: more than one arrangement). Guarantees to the funds are not modelled here.")
    save(fig, out, "U13_price_share_protected_funds.png")


# Files whose uncommitted state changes the exported numbers or the graphs: the engine and exports, and these scripts.
FEEDS = ("web/src/lib/", "web/src/export/", "scripts/grocery_wine_")
# Configuration, curated data, the Python package and the registries generated from them: read by the database build or
# the dashboard export (so they can move the dataset build id and the Tennessee export), but not grocery-wine code.
BUILD = ("config/", "metadata/", "src/", "data/curated/")


def uncommitted_note(status: list[str]) -> str:
    """Says, from `git status`, whether the package comes from committed code, and which uncommitted files matter."""
    paths = [line[3:].strip().strip('"') for line in status]
    feeds = [p for p in paths if p.startswith(FEEDS)]
    build = [p for p in paths if p.startswith(BUILD)]
    rest = [p for p in paths if p not in feeds and p not in build]
    if not paths:
        return "Clean committed revision: no uncommitted changes."
    parts = []
    if feeds:
        parts.append("Not a clean committed revision: these uncommitted files change the exported numbers or the graphs: " + ", ".join(feeds) + ".")
    else:
        parts.append("The engine, the exports and the graph scripts are committed at this revision.")
    if build:
        parts.append("Uncommitted configuration, data or registry files, read by the database build or the dashboard export (they can move the dataset build id and the Tennessee export): " + ", ".join(build) + "; compare the Tennessee data files with the previous package before reading a change into them.")
    if rest:
        parts.append("Other uncommitted files, which neither the exports nor the graphs read: " + ", ".join(rest) + ".")
    return " ".join(parts)


def provenance(out: Path) -> dict:
    """Code revision, working tree, generation time, inputs and commands, recorded with the package."""
    import datetime
    import hashlib
    import platform
    import subprocess

    root = HERE.parent

    def git(*args: str) -> str:
        return subprocess.run(["git", *args], cwd=root, capture_output=True, text=True, check=False).stdout

    status = git("status", "--porcelain").splitlines()
    diff = hashlib.sha256(git("diff", "HEAD", "--binary").encode("utf-8"))
    untracked = sorted(line[3:] for line in status if line.startswith("??"))
    for rel in untracked:
        f = root / rel
        if f.is_file():
            diff.update(rel.encode("utf-8") + b"\0" + f.read_bytes())
    exports = {}
    for name, f in (("grocery_wine", ct.UTAH), ("price_share", ct.PRICE_SHARE), ("purchase_flows", ct.FLOWS)):
        j = json.loads(f.read_text(encoding="utf-8"))
        exports[name] = {"file": f.name, "generated_at": j.get("generated_at"), "project_commit": j.get("project_commit"), "methods": j.get("methods") or j.get("methods_used"), "method": j.get("method")}
    tn = json.loads((ct.TENN / "tennessee_provenance.json").read_text(encoding="utf-8"))
    manifest = json.loads((root / "web" / "public" / "data" / "manifest.json").read_text(encoding="utf-8"))
    pins = root / "config" / "builds" / "preview.pins.json"
    return {
        "generated_at": datetime.datetime.now().astimezone().isoformat(timespec="seconds"),
        "code_revision": git("rev-parse", "HEAD").strip(),
        "branch": git("rev-parse", "--abbrev-ref", "HEAD").strip(),
        "working_tree_clean": not status,
        "working_tree_status": status,
        "uncommitted_changes_sha256": diff.hexdigest(),
        "uncommitted_note": uncommitted_note(status),
        "dataset": manifest["dataset"],
        "input_pins_sha256": hashlib.sha256(pins.read_bytes()).hexdigest(),
        "exports": exports,
        "tennessee_export": tn,
        "plotting": {"python": platform.python_version(), "executable": sys.executable, "matplotlib": matplotlib.__version__, "numpy": np.__version__},
        "commands": [
            "scripts\\verify.bat   (rebuilds the database and the dashboard data, runs every check and both exports)",
            "npm --prefix web run export:grocery-wine",
            "npm --prefix web run export:tennessee",
            ".venv\\Scripts\\python.exe scripts\\grocery_wine_alternatives_check.py",
            ".venv\\Scripts\\python.exe scripts\\grocery_wine_flows_check.py",
            '"C:\\Program Files\\ParaView 6.1.0\\bin\\pvpython.exe" -B scripts\\grocery_wine_graphs.py "..\\..\\graphs and data"   (any Python with matplotlib and numpy)',
        ],
    }


# Which export tables each chart is drawn from, the model behind them and the inputs that configure them.
ALT = ("alternatives.json", "alternatives_summary.csv", "alternatives_ledger.csv", "assumptions.csv")
PS = ("price_share.json", "price_share_grid.csv", "price_share_prices.csv")
FLW = ("flows.json", "flows_assumptions.csv", "flows_arrangements.csv")
TNF = ("tennessee_results_main_and_sensitivity.csv", "tennessee_raw_series.csv", "tennessee_provenance.json")
CHART_SOURCES = {
    "U1": (
        "U1_references_change_from_today",
        ALT,
        "wine-alternatives@1.0",
        "observed inputs, modelled result",
    ),
    "U2": ("U2_change_by_component", ALT, "wine-alternatives@1.0", "modelled"),
    "U3": (
        "U3_alternatives_price_revenue_margin_funds",
        (*ALT, "alternatives_price_stack.csv", "demand_sensitivity.csv"),
        "wine-alternatives@1.0",
        "modelled",
    ),
    "U4": (
        "U4_dabs_discount_sweep",
        (*ALT, "sweep_discount_matched.csv", "sweep_discount_retailer_target.csv"),
        "wine-alternatives@1.0",
        "modelled",
    ),
    "U5": (
        "U5_private_charge_sweep",
        (*ALT, "sweep_charge_matched.csv", "sweep_charge_sellers_margins.csv"),
        "wine-alternatives@1.0",
        "modelled",
    ),
    "U6": (
        "U6_demand_sensitivity",
        (*ALT, "demand_sensitivity.csv"),
        "wine-alternatives@1.0",
        "modelled, exploratory (old price treatment)",
    ),
    "U7": ("U7_cost_cases", (*ALT, "cost_cases.csv"), "wine-alternatives@1.0", "modelled"),
    "U8": ("U8_beer_to_wine_threshold", ALT, "wine-alternatives@1.0 (substitution threshold)", "modelled"),
    "U9": ("U9_price_share_fiscal_grid", PS, "wine-price-share@1.0", "modelled, conditional grid"),
    "U10": (
        "U10_price_share_fiscal_grid_no_savings",
        PS,
        "wine-price-share@1.0",
        "modelled, conditional grid",
    ),
    "U11": (
        "U11_price_share_grocer_margin",
        (*PS, "price_share_markers.csv"),
        "wine-price-share@1.0",
        "modelled",
    ),
    "U12": (
        "U12_price_share_price_response",
        PS,
        "wine-price-share@1.0",
        "modelled, exploratory (old price treatment)",
    ),
    "U13": ("U13_price_share_protected_funds", PS, "wine-price-share@1.0", "modelled"),
    "F1": (
        "F1_grocery_wine_by_source",
        (*FLW, "flows_origins.csv", "flows_scenarios.csv"),
        "wine-purchase-flows@1.0",
        "modelled, illustrative shares",
    ),
    "F2": (
        "F2_collections_and_costs_by_design",
        (*FLW, "flows_components.csv"),
        "wine-purchase-flows@1.0",
        "modelled",
    ),
    "F3": (
        "F3_revenue_gained_vs_displaced",
        (*FLW, "flows_lines.csv"),
        "wine-purchase-flows@1.0",
        "modelled, illustrative shares",
    ),
    "F4": (
        "F4_beverage_litres_and_pure_alcohol",
        (*FLW, "flows_beverages.csv", "flows_conversions.csv"),
        "wine-purchase-flows@1.0",
        "modelled, illustrative shares",
    ),
    "F5": (
        "F5_price_and_channel_choice",
        (*FLW, "flows_migration_price_grid.csv"),
        "wine-purchase-flows@1.0",
        "modelled, illustrative channel choice",
    ),
    "F6": (
        "F6_break_even_by_source",
        (*FLW, "flows_break_even.csv"),
        "wine-purchase-flows@1.0",
        "modelled thresholds",
    ),
    "F7": (
        "F7_break_even_frontiers",
        (*FLW, "flows_break_even_frontier.csv"),
        "wine-purchase-flows@1.0",
        "modelled thresholds",
    ),
    "F8": (
        "F8_sensitivity",
        (*FLW, "flows_sensitivity.csv"),
        "wine-purchase-flows@1.0",
        "modelled, tested ranges",
    ),
    "F9": (
        "F9_all_named_scenarios",
        (*FLW, "flows_scenarios.csv"),
        "wine-purchase-flows@1.0",
        "modelled, illustrative and exploratory scenarios",
    ),
    "F10": (
        "F10_substitution_grid",
        (*FLW, "flows_substitution_grid.csv"),
        "wine-purchase-flows@1.0",
        "modelled, illustrative shares",
    ),
    "F11": ("F11_share_moving", (*FLW, "flows_migration_grid.csv"), "wine-purchase-flows@1.0", "modelled"),
    "T1": (
        "T1_tennessee_alcohol_tax_receipts_vs_neighbours",
        TNF,
        "before-after@1.2",
        "observed, descriptive",
    ),
    "T2": ("T2_tennessee_receipts_vs_earlier_trend", TNF, "before-after@1.2", "observed, arithmetic trend"),
    "T3": ("T3_tennessee_wine_tax_accounts", TNF, "before-after@1.2", "observed"),
    "T4": (
        "T4_tennessee_purchases_by_beverage",
        (*TNF, "tennessee_main_by_state.csv"),
        "before-after@1.2",
        "observed, descriptive",
    ),
    "T5": (
        "T5_tennessee_placebo_dates",
        (*TNF, "tennessee_placebo_dates.csv"),
        "before-after@1.2",
        "observed, descriptive diagnostic",
    ),
    "T6": ("T6_tennessee_sensitivity_ranges", TNF, "before-after@1.2", "observed, sensitivity ranges"),
    "S0": (
        "00_summary",
        (*ALT, *TNF),
        "wine-alternatives@1.0 and before-after@1.2",
        "observed and modelled side by side",
    ),
}
EXPORT_COMMAND = {
    "wine": "npm --prefix web run export:grocery-wine",
    "tennessee": "npm --prefix web run export:tennessee",
}


def chart_manifest(titles: dict, graphs: Path, data_out: Path) -> dict:
    charts = []
    for key, (stem, sources, model, standing) in CHART_SOURCES.items():
        files = {ext: f"graphs/{stem}.{ext}" for ext in ("png", "pdf", "csv")}
        missing = [f for f in files.values() if not (graphs.parent / f).exists()] + [
            f"data/{s}" for s in sources if not (data_out / s).exists()
        ]
        if missing:
            raise FileNotFoundError(f"{key}: missing {missing}")
        tn = key.startswith("T") or key == "S0"
        charts.append(
            {
                "chart": key,
                "title": titles[key][0],
                "subtitle": titles[key][1],
                "standing": standing,
                "files": files,
                "plotted_values": files["csv"],
                "data": [f"data/{s}" for s in sources],
                "model": model,
                "configuration": "data/flows_assumptions.csv and data/flows.json (inputs)"
                if key.startswith("F")
                else "data/assumptions.csv (U01-U18)"
                if key[0] in "US"
                else "data/tennessee_provenance.json (specifications)",
                "commands": [
                    EXPORT_COMMAND["wine"],
                    *([EXPORT_COMMAND["tennessee"]] if tn else []),
                    "pvpython -B scripts/grocery_wine_graphs.py <output folder>",
                ],
            }
        )
    return {"charts": charts}


def write_manifest_csv(manifest: dict, path: Path) -> None:
    import csv

    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(
            [
                "chart",
                "title",
                "standing",
                "png",
                "pdf",
                "plotted_values_csv",
                "data_files",
                "model",
                "configuration",
                "commands",
            ]
        )
        for c in manifest["charts"]:
            w.writerow(
                [
                    c["chart"],
                    c["title"],
                    c["standing"],
                    c["files"]["png"],
                    c["files"]["pdf"],
                    c["files"]["csv"],
                    "; ".join(c["data"]),
                    c["model"],
                    c["configuration"],
                    " && ".join(c["commands"]),
                ]
            )


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    out = Path(sys.argv[1]).resolve()
    graphs, data_out = out / "graphs", out / "data"
    graphs.mkdir(parents=True, exist_ok=True)
    data_out.mkdir(parents=True, exist_ok=True)
    errs = (
        gwc.hand_examples()
        + gwc.check(ct.UTAH)
        + gwc.grid_hand_examples()
        + gwc.check_grid(ct.PRICE_SHARE, ct.UTAH)
    )
    flow_errs, flow_counts = gfc.check(ct.FLOWS)
    errs += gfc.hand_examples() + flow_errs
    if errs:
        print("\n".join(errs[:60]))
        return 1
    d, tn = ct.load_utah(), ct.load_tn()
    ps = ct.load_price_share()
    fl = ct.load_flows()
    titles = {**ct.utah_titles(d), **ct.tn_titles(tn), **ct.price_share_titles(ps), **ct.flow_titles(fl)}
    u1_waterfall(d, graphs, titles)
    u2_components(d, graphs, titles)
    u3_panel(d, graphs, titles)
    u4_discount(d, graphs, titles)
    u5_charge(d, graphs, titles)
    u6_demand(d, graphs, titles)
    u7_costs(d, graphs, titles)
    u8_beer(d, graphs, titles)
    t1(tn, graphs, titles)
    trend = t2(tn, graphs, titles)
    t3(tn, graphs, titles)
    t4(tn, graphs, titles)
    counts = t5(tn, graphs, titles)
    t6(tn, graphs, titles)
    s0(d, tn, trend, graphs, titles)
    ps_grid(ps, graphs, titles, "source_based", "U9", "U9_price_share_fiscal_grid.png")
    ps_grid(ps, graphs, titles, "none", "U10", "U10_price_share_fiscal_grid_no_savings.png")
    ps_margins(ps, graphs, titles)
    ps_response(ps, graphs, titles)
    ps_funds(ps, graphs, titles)
    fg.draw(fl, graphs, titles, sys.modules[__name__])
    bad = ct.check_titles(titles)
    if bad:
        print("\n".join(bad))
        return 1
    # Copy only the files the grocery-wine export wrote in its last run (export_files.json), never a leftover from an
    # older version of the export; leftovers are listed in the log.
    listed = [*json.loads((ct.UTAH.parent / "export_files.json").read_text(encoding="utf-8"))["files"], "export_files.json"]
    leftovers = sorted(p.name for p in ct.UTAH.parent.iterdir() if p.is_file() and p.name not in listed)
    for src in [*(ct.UTAH.parent / name for name in listed), *ct.TENN.glob("*.csv"), *ct.TENN.glob("*.json")]:
        shutil.copy2(src, data_out / src.name)
    LOG.append(
        "not copied (not written by the last grocery-wine export): " + (", ".join(leftovers) or "none")
    )
    (data_out / "chart_titles.json").write_text(
        json.dumps(
            {"titles": titles, "tennessee_trend_arithmetic": trend, "tennessee_placebo_counts": counts},
            indent=1,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    (out / "logs").mkdir(exist_ok=True)
    cells = len(ps["cells"])
    what = ", ".join(f"{v} {k}" for k, v in flow_counts.items())
    (out / "logs" / "independent_check.txt").write_text(
        f"hand examples OK; {len(d['alternatives'])} alternatives and {cells} price-and-share cells recomputed independently and agree with the export (commit {d['project_commit']})\n"
        f"purchase flows ({fl['method']}): hand examples OK; {what} recomputed independently and agree with the export (commit {fl['project_commit']})\n"
        "These checks verify arithmetic only: they say nothing about whether any behavioural assumption is right.\n",
        encoding="utf-8",
    )
    manifest = chart_manifest(titles, graphs, data_out)
    (out / "manifest.json").write_text(json.dumps(manifest, indent=1, ensure_ascii=False), encoding="utf-8")
    write_manifest_csv(manifest, out / "manifest.csv")
    (out / "provenance.json").write_text(
        json.dumps(provenance(out), indent=1, ensure_ascii=False), encoding="utf-8"
    )
    (out / "logs" / "graph_text_layout_check.txt").write_text(
        "Automated check for overlapping text and text outside the image (not a visual review)\n"
        + "\n".join(LOG)
        + "\n",
        encoding="utf-8",
    )
    print("\n".join(LOG))
    return 0


if __name__ == "__main__":
    sys.exit(main())
