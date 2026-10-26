"""Purchase-flow graphs (F1-F11) for the grocery-wine package: where grocery wine would come from and what each source
does to the state's collections (web/src/lib/wineFlows.ts, wine-purchase-flows@1.0).

Draws only what data/processed/grocery-wine/flows.json and its flows_*.csv tables contain; computes no results. Called
by scripts/grocery_wine_graphs.py, which passes itself in as ``g`` for the shared colours, layout and saving (so the
text-layout log and the plotted-data files are kept in one place). Titles come from grocery_wine_chart_text.flow_titles.
"""

from __future__ import annotations

import grocery_wine_chart_text as ct
import matplotlib
import numpy as np
from matplotlib.lines import Line2D
from matplotlib.patches import Patch

ORDER = ct.PRESERVED + ct.REDUCED


def note(fl: dict) -> str:
    return (
        f"Model: project scripts, web/src/lib/wineFlows.ts ({fl['method']}) on the alternatives' price stacks; FY2025, $ a year; "
        "inputs F01-F23 in flows_assumptions.csv, shares of switching, recapture and additional buying illustrative; none reviewed by a person."
    )


def colours(g) -> dict:
    return {
        "preserved_dabs": g.BLUE,
        "preserved_private": g.AQUA,
        "preserved_dabs_matched": g.YELLOW,
        "dabs_discount_20": g.ORANGE,
        "private_tax_20": g.MAGENTA,
    }


def short(fl: dict, a: str) -> str:
    return ct.flow_arr(fl, a)["short"]


SCEN_SHORT = {
    "accounting_30": "Accounting case: 30% moves",
    "channel_60": "Channel choice, none move at +60%",
    "channel_30": "Channel choice, none move at +30%",
    "channel_15": "Channel choice, none move at +15%",
    "declined_not_bought": "Exploratory: declined not bought",
    "declined_outside_utah": "Exploratory: declined bought outside Utah",
    "migrant_response": "Exploratory: old price response",
    "beer_2": "Beer 2% replaced (same alcohol)",
    "beer_5": "Beer 5% replaced (same alcohol)",
    "beer_5_volume": "Beer 5%, litre for litre",
    "beer_5_spending": "Beer 5%, dollar for dollar",
    "beer_5_split": "Beer 5%, half the wine at DABS",
    "spirits_2": "Spirits 2% replaced (same alcohol)",
    "spirits_5": "Spirits 5% replaced (same alcohol)",
    "recapture_2": "2% brought back from other states",
    "additional_2": "2% additional wine",
    "costs_high": "Cost case: admin $1M, handling",
    "license_fees": "Cost case: $0.5M license fees",
    "restructuring": "Cost case: DABS restructures",
    "combined_illustrative": "Illustrative combination",
    "combined_adverse": "Exploratory combination",
}


def f1_sources(fl, out, titles, g):
    plt = g.plt
    rows = ct.F1_SCENARIOS
    src = [
        ("A", "A. Moved from DABS", g.BLUE),
        ("B", "B. Replaces beer", g.YELLOW),
        ("C", "C. Replaces spirits", g.MAGENTA),
        ("D", "D. Once bought outside Utah", g.AQUA),
        ("E", "E. Additional", g.ORANGE),
    ]
    fig, ax = plt.subplots(figsize=(12, 5.8))
    fig.subplots_adjust(left=0.27, right=0.78)
    y = np.arange(len(rows))[::-1]
    for yi, sid in zip(y, rows, strict=True):
        o = {
            k["id"]: k["grocery"]["storeEquivalent"]
            for k in ct.flow_result(fl, "preserved_dabs", sid)["origins"]
        }
        left = 0.0
        for k, _lab, col in src:
            if o[k] > 0:
                ax.barh(yi, o[k], left=left, color=col, height=0.62, edgecolor=g.SURFACE, linewidth=1.5)
                left += o[k]
        ax.text(left + 0.8e6, yi, ct.money(left)[1:], va="center", fontsize=8.5, color=g.INK)
    ax.set_yticks(y, [SCEN_SHORT[s] for s in rows], fontsize=8.5)
    ax.grid(axis="y", visible=False)
    ax.xaxis.set_major_formatter(g.m_fmt)
    ax.set_xlim(0, ax.get_xlim()[1] * 1.08)
    ax.set_xlabel("Wine bought at grocers, $ a year at today's state-store prices")
    ax.legend(
        handles=[Patch(color=c, label=lab) for _, lab, c in src],
        loc="upper left",
        bbox_to_anchor=(1.01, 1.0),
        fontsize=8.5,
    )
    g.head(
        fig,
        *titles["F1"],
        note(fl)
        + " Under the DABS-supplied preserved design; identical under the others for these rows (checked).",
    )
    g.save(fig, out, "F1_grocery_wine_by_source.png")


COMPONENTS = [
    ("dabsWineMarkup", "DABS wine markup (gross margin)", "collection"),
    ("replacementCharge", "Replacement charge on grocery wine", "collection"),
    ("salesTax", "State sales tax", "collection"),
    ("dabsVariableStoreCosts", "DABS store costs avoided", "cost"),
    ("admin", "New licensing and enforcement", "cost"),
]


def f2_components(fl, out, titles, g):
    plt = g.plt
    col = {
        "dabsWineMarkup": g.BLUE,
        "replacementCharge": g.ORANGE,
        "salesTax": g.AQUA,
        "dabsVariableStoreCosts": g.YELLOW,
        "admin": g.MAGENTA,
    }
    fig, ax = plt.subplots(figsize=(12.5, 6.4))
    fig.subplots_adjust(left=0.27, right=0.97)
    y = np.arange(len(ORDER))[::-1]
    for yi, a in zip(y, ORDER, strict=True):
        ch = ct.flow_result(fl, a, "accounting_30")["change"]
        pos = neg = 0.0
        for key, _, kind in COMPONENTS:
            v = ch["collections"][key] if kind == "collection" else -ch["costsBy"][key]
            if v > 0:
                ax.barh(yi, v, left=pos, color=col[key], height=0.62, edgecolor=g.SURFACE, linewidth=1.5)
                pos += v
            elif v < 0:
                ax.barh(yi, v, left=neg, color=col[key], height=0.62, edgecolor=g.SURFACE, linewidth=1.5)
                neg += v
        ax.plot([ch["net"]], [yi], "D", color=g.INK, ms=7, mec=g.SURFACE, mew=1.5, zorder=5)
        ax.text(max(pos, 0) + 0.6e6, yi, f"net {ct.money(ch['net'])}", va="center", fontsize=8.5, color=g.INK)
    ax.axvline(0, color=g.INK, lw=1)
    labels = []
    for a in ORDER:
        r = ct.flow_arr(fl, a)
        labels.append(
            f"{r['short']}\n(grocery price {'+' if r['consumerRatio'] > 1 + 1e-9 else ''}{(r['consumerRatio'] - 1) * 100:.0f}%)"
        )
    ax.set_yticks(y, labels, fontsize=8.5)
    ax.grid(axis="y", visible=False)
    ax.xaxis.set_major_formatter(g.m_fmt)
    ax.set_xlim(ax.get_xlim()[0], ax.get_xlim()[1] + 4e6)
    ax.set_xlabel("Change from today, $ a year (30% of household wine moves; nothing else changes)")
    handles = [Patch(color=col[k], label=lab) for k, lab, _ in COMPONENTS] + [
        Line2D([], [], marker="D", color=g.INK, ls="none", label="Net change")
    ]
    ax.legend(handles=handles, loc="lower left", bbox_to_anchor=(-0.35, 1.0), ncol=3, fontsize=8.5)
    g.head(
        fig,
        *titles["F2"],
        note(fl)
        + " Costs are drawn as their effect on the net (a cost saved is positive). Deposits to the school and enforcement funds are allocations inside these totals (flows_components.csv), not added.",
        legend_in=0.55,
    )
    g.save(fig, out, "F2_collections_and_costs_by_design.png")


F3_PANELS = [
    ("beer_5", "beer_to_wine", "B. Wine replaces 5% of households' beer"),
    ("spirits_5", "spirits_to_wine", "C. Wine replaces 5% of their spirits"),
    ("recapture_2", "recapture", "D. 2% brought back from other states"),
    ("additional_2", "additional", "E. 2% additional wine"),
]


def f3_gained_lost(fl, out, titles, g):
    plt = g.plt
    fig, axes = plt.subplots(1, 4, figsize=(16, 6.2), sharey=True)
    fig.subplots_adjust(left=0.15, right=0.99, wspace=0.18)
    y = np.arange(len(ORDER))[::-1]
    for ax, (sid, lid, title) in zip(axes, F3_PANELS, strict=True):
        for yi, a in zip(y, ORDER, strict=True):
            ln = ct.flow_line(fl, a, sid, lid)
            ax.barh(yi + 0.17, ln["wineGained"], color=g.BLUE, height=0.32)
            ax.barh(yi - 0.17, -ln["displacedLost"], color=g.ORANGE, height=0.32)
            ax.plot([ln["value"]], [yi], "D", color=g.INK, ms=6.5, mec=g.SURFACE, mew=1.3, zorder=5)
        ax.axvline(0, color=g.INK, lw=1)
        ax.set_title("\n".join(g.wrap_to(fig, title, 9, "bold", 3.2 * fig.dpi)), fontsize=9)
        ax.xaxis.set_major_formatter(g.m_fmt)
        ax.locator_params(axis="x", nbins=4)
        ax.grid(axis="y", visible=False)
    axes[0].set_yticks(y, [short(fl, a) for a in ORDER], fontsize=8.5)
    handles = [
        Patch(color=g.BLUE, label="Collections gained on the wine"),
        Patch(color=g.ORANGE, label="Collections lost on what it replaces"),
        Line2D([], [], marker="D", color=g.INK, ls="none", label="Net for this source"),
    ]
    axes[0].legend(handles=handles, loc="lower left", bbox_to_anchor=(0.0, 1.17), ncol=3, fontsize=8.5)
    g.head(
        fig,
        *titles["F3"],
        note(fl)
        + " Each panel is that source alone (the 30% move's own result is not included). Collections net of the DABS store costs that move with each purchase.",
        legend_in=0.62,
    )
    g.save(fig, out, "F3_revenue_gained_vs_displaced.png")


F4_SCEN = ["beer_5", "beer_5_volume", "spirits_5", "additional_2"]


def f4_quantities(fl, out, titles, g):
    plt = g.plt
    bev = [("wine", "Wine"), ("beer", "Beer (outside DABS)"), ("spirits", "Spirits")]
    cols = [g.BLUE, g.AQUA, g.MAGENTA, g.ORANGE]
    rows = fl["csv_beverages"]

    def change(sid: str, b: str, field: str) -> float:
        return sum(
            r[field]
            for r in rows
            if r["arrangement_id"] == "preserved_dabs"
            and r["scenario_id"] == sid
            and r["beverage"] == b
            and r[field] is not None
        )

    fig, axes = plt.subplots(1, 2, figsize=(13.5, 6.0))
    fig.subplots_adjust(left=0.07, right=0.99, wspace=0.22)
    w = 0.2
    for ax, field, scale, unit in (
        (axes[0], "litres_change", 1e6, "Change in litres of beverage a year (millions)"),
        (axes[1], "pure_alcohol_litres_change", 1e3, "Change in litres of pure alcohol a year (thousands)"),
    ):
        groups = bev + ([("total", "All three")] if field.startswith("pure") else [])
        x = np.arange(len(groups))
        for i, (sid, c) in enumerate(zip(F4_SCEN, cols, strict=True)):
            vals = [
                (sum(change(sid, b, field) for b, _ in bev) if b == "total" else change(sid, b, field))
                / scale
                for b, _ in groups
            ]
            ax.bar(x + (i - 1.5) * w, vals, width=w * 0.92, color=c, label=SCEN_SHORT[sid])
            for xi, v in zip(x + (i - 1.5) * w, vals, strict=True):
                if abs(v) < 0.005:
                    ax.text(xi, 0, "0", ha="center", va="bottom", fontsize=7.5, color=g.INK2)
        ax.axhline(0, color=g.INK, lw=1)
        ax.set_xticks(x, [lab for _, lab in groups], fontsize=8.5)
        ax.grid(axis="x", visible=False)
        ax.set_ylabel(unit, fontsize=8.5)
    axes[0].legend(loc="upper right", fontsize=8.2)
    g.head(
        fig,
        *titles["F4"],
        note(fl)
        + " DABS-supplied preserved design; quantities do not depend on the design in these scenarios. Heavy beer is not replaced here. Pure alcohol = litres x ABV (beer 4.8%, wine 11.8%, spirits 34.9%; NIAAA 2024).",
    )
    g.save(fig, out, "F4_beverage_litres_and_pure_alcohol.png")


LIMITS = [
    ("none (fixed share)", "Fixed 30% (no price limit)"),
    (100.0, "None move at +100%"),
    (60.0, "None move at +60%"),
    (30.0, "None move at +30%"),
    (15.0, "None move at +15%"),
]


def f5_price_migration(fl, out, titles, g):
    plt = g.plt
    lim_col = {"none (fixed share)": g.INK, 100.0: g.BLUE, 60.0: g.AQUA, 30.0: g.ORANGE, 15.0: g.MAGENTA}
    arrs = ["preserved_dabs", "preserved_private", "dabs_discount_20", "private_tax_20"]
    rows = fl["csv_migration_price_grid"]
    fig, axes = plt.subplots(2, 2, figsize=(13, 9.2))
    fig.subplots_adjust(left=0.08, right=0.985, hspace=0.4, wspace=0.2)
    for ax, a in zip(axes.flat, arrs, strict=True):
        for lim, lab in LIMITS:
            pts = sorted(
                (r["grocery_premium_pct"], r["net_change_usd"])
                for r in rows
                if r["arrangement_id"] == a
                and r["migration_at_equal_prices_pct"] == 30
                and r["convenience_limit_premium_pct"] == lim
            )
            ax.plot([p[0] for p in pts], [p[1] for p in pts], color=lim_col[lim], lw=2, label=lab)
        own = (ct.flow_arr(fl, a)["consumerRatio"] - 1) * 100
        ax.axvline(own, color=g.INK2, lw=1, ls=(0, (4, 3)))
        tr = matplotlib.transforms.blended_transform_factory(ax.transData, ax.transAxes)
        right = own > 40
        ax.text(
            own - 0.8 if right else own + 0.8,
            0.96,
            f"its own price: {'+' if own > 0.05 else ''}{own:.0f}%",
            transform=tr,
            fontsize=8,
            color=g.INK2,
            va="top",
            ha="right" if right else "left",
        )
        ax.axhline(0, color=g.INK, lw=1)
        ax.set_xlim(0, 60)
        ax.set_xticks(range(0, 61, 10), [f"+{v}%" if v else "0%" for v in range(0, 61, 10)])
        ax.yaxis.set_major_formatter(g.m_fmt)
        ax.set_title(ct.flow_arr(fl, a)["short"], fontsize=9.5)
        ax.set_xlabel("Grocery price premium over a state store", fontsize=8.5)
        ax.set_ylabel("State annual change", fontsize=8.5)
    axes[0, 0].legend(
        handles=[Line2D([], [], color=lim_col[lim], lw=2, label=lab) for lim, lab in LIMITS],
        loc="lower left",
        bbox_to_anchor=(0.0, 1.1),
        ncol=5,
        fontsize=8.5,
    )
    g.head(
        fig,
        *titles["F5"],
        note(fl)
        + " Each design's collection is held while the grocery price moves (the grocer's margin changes with it). Each panel has its own vertical scale. Not an estimated channel-choice model.",
        legend_in=0.35,
    )
    g.save(fig, out, "F5_price_and_channel_choice.png")


def f6_break_even(fl, out, titles, g):
    plt = g.plt
    col = colours(g)
    levers = [
        ("beer", "Beer replaced (same alcohol)"),
        ("spirits", "Spirits replaced (same alcohol)"),
        ("recapture", "Brought back from other states"),
        ("additional", "Additional wine (more alcohol)"),
    ]
    be = {
        (r["arrangement_id"], r["lever"]): r
        for r in fl["csv_break_even"]
        if r["context_scenario_id"] == "accounting_30"
    }
    fig, ax = plt.subplots(figsize=(12.5, 7.6))
    fig.subplots_adjust(left=0.3, right=0.97)
    rows = [(lv, a) for lv, _ in levers for a in ORDER]
    y = np.arange(len(rows))[::-1]
    words = {
        "already_above": "not needed: already at or above break-even",
        "wrong_direction": "none: this source lowers receipts",
        "unattainable_in_range": "not reached by 100%",
        "no_effect": "no effect",
    }
    for yi, (lv, a) in zip(y, rows, strict=True):
        r = be[(a, lv)]
        if r["status"] == "found":
            v = r["break_even_pct"]
            ax.barh(yi, v, color=col[a], height=0.62)
            ax.text(v + 0.6, yi, f"{v:.1f}%", va="center", fontsize=8.5, color=g.INK)
        else:
            ax.text(0.6, yi, words[r["status"]], va="center", fontsize=8.2, color=g.INK2)
    ax.set_yticks(y, [f"{dict(levers)[lv]}: {short(fl, a)}" for lv, a in rows], fontsize=8)
    for k in range(1, len(levers)):
        ax.axhline(y[k * len(ORDER)] + 0.5, color=g.AXIS, lw=0.8)
    ax.grid(axis="y", visible=False)
    ax.set_xlim(0, 50)
    ax.set_xticks(range(0, 51, 10), [f"{v}%" for v in range(0, 51, 10)])
    ax.set_xlabel(
        "Break-even share: beer or spirits as a share of households' purchases (pure alcohol); wine as a share of household DABS wine"
    )
    ax.legend(
        handles=[
            Patch(color=col[a], label=short(fl, a))
            for a in ORDER
            if any(be[(a, lv)]["status"] == "found" for lv, _ in levers)
        ],
        loc="lower left",
        bbox_to_anchor=(-0.42, 1.0),
        ncol=3,
        fontsize=8.5,
    )
    g.head(
        fig,
        *titles["F6"],
        note(fl)
        + " Recapture and additional wine have the same effect on receipts; only additional wine adds alcohol.",
        legend_in=0.5,
    )
    g.save(fig, out, "F6_break_even_by_source.png")


def f7_frontiers(fl, out, titles, g):
    plt = g.plt
    lev_col = {"beer": g.YELLOW, "spirits": g.MAGENTA, "additional": g.ORANGE}
    lev_lab = {
        "beer": "Beer replaced (same alcohol)",
        "spirits": "Spirits replaced (same alcohol)",
        "additional": "Additional or brought-back wine",
    }
    fr = fl["csv_break_even_frontier"]
    fig, axes = plt.subplots(1, 2, figsize=(13.5, 6.0))
    fig.subplots_adjust(left=0.08, right=0.98, wspace=0.2)
    for lv, c in lev_col.items():
        pts = [
            (
                r["lever_setting_pct"],
                r["break_even_pct"]
                if r["status"] == "found"
                else (0.0 if r["status"] == "already_above" else np.nan),
            )
            for r in fr
            if r["family"] == "dabs_discount" and r["lever"] == lv
        ]
        pts.sort()
        axes[0].plot(
            [p[0] for p in pts],
            [p[1] for p in pts],
            color=c,
            lw=2,
            marker="o",
            ms=4,
            mec=g.SURFACE,
            label=lev_lab[lv],
        )
        pts = sorted(
            (
                r["x_value"],
                r["break_even_pct"]
                if r["status"] == "found"
                else (0.0 if r["status"] == "already_above" else np.nan),
            )
            for r in fr
            if r["family"] == "migration" and r["arrangement_id"] == "dabs_discount_20" and r["lever"] == lv
        )
        axes[1].plot(
            [p[0] for p in pts],
            [p[1] for p in pts],
            color=c,
            lw=2,
            marker="o",
            ms=4,
            mec=g.SURFACE,
            label=lev_lab[lv],
        )
    axes[0].set_xlabel("DABS discount to grocers (the state's markup falls by the same amount)", fontsize=8.5)
    axes[1].set_xlabel("Share of household DABS wine moving to grocers (20% discount)", fontsize=8.5)
    for ax in axes:
        ax.set_ylabel("Break-even share", fontsize=8.5)
        ax.yaxis.set_major_formatter(lambda v, _: f"{v:.0f}%")
        ax.xaxis.set_major_formatter(lambda v, _: f"{v:.0f}%")
        ax.set_ylim(0, 100)
    axes[0].legend(loc="upper left", fontsize=8.5)
    g.head(
        fig,
        *titles["F7"],
        note(fl)
        + " Gaps: no break-even within 100%. At no discount the grocer gets nothing at today's price (diagnostic).",
    )
    g.save(fig, out, "F7_break_even_frontiers.png")


def f8_sensitivity(fl, out, titles, g):
    plt = g.plt
    arrs = ["preserved_dabs", "preserved_private", "dabs_discount_20", "private_tax_20"]
    rows = [
        r
        for r in fl["csv_sensitivity"]
        if r["context_scenario_id"] == "accounting_30" and r["applies"] == "true"
    ]
    fig, axes = plt.subplots(2, 2, figsize=(14, 10))
    fig.subplots_adjust(left=0.2, right=0.98, hspace=0.35, wspace=0.75)
    for ax, a in zip(axes.flat, arrs, strict=True):
        rs = sorted(
            [r for r in rows if r["arrangement_id"] == a and r["swing_usd"] > 0.5],
            key=lambda r: r["swing_usd"],
        )
        base = rs[0]["net_change_base_usd"] if rs else ct.flow_net(fl, a, "accounting_30")
        y = np.arange(len(rs))
        for yi, r in zip(y, rs, strict=True):
            ax.barh(yi, r["net_change_at_low_usd"] - base, left=base, color=g.AQUA, height=0.36, align="edge")
            ax.barh(
                yi - 0.36,
                r["net_change_at_high_usd"] - base,
                left=base,
                color=g.BLUE,
                height=0.36,
                align="edge",
            )
        ax.axvline(base, color=g.INK2, lw=1, ls=(0, (4, 3)))
        ax.axvline(0, color=g.INK, lw=1)
        ax.set_yticks(
            y,
            [
                "\n".join(
                    g.wrap_to(
                        fig, f"{r['parameter']} ({r['low']} / {r['high']})", 7.5, "normal", 2.6 * fig.dpi
                    )
                )
                for r in rs
            ],
            fontsize=7.5,
        )
        ax.grid(axis="y", visible=False)
        ax.xaxis.set_major_formatter(g.m_fmt)
        ax.locator_params(axis="x", nbins=5)
        ax.set_title(f"{short(fl, a)} (base {ct.money(base)})", fontsize=9.5)
    axes[0, 0].legend(
        handles=[
            Patch(color=g.AQUA, label="Low tested value"),
            Patch(color=g.BLUE, label="High tested value"),
        ],
        loc="lower left",
        bbox_to_anchor=(0, 1.08),
        ncol=2,
        fontsize=8.5,
    )
    g.head(
        fig,
        *titles["F8"],
        note(fl)
        + " Dashed: the accounting case. Inputs that change nothing in this case (beer and wine prices, the excise) are left out here; they matter once wine replaces beer (flows_sensitivity.csv, context beer_5).",
        legend_in=0.35,
    )
    g.save(fig, out, "F8_sensitivity.png")


def f9_scenarios(fl, out, titles, g):
    plt = g.plt
    col = colours(g)
    sids = [s["id"] for s in fl["scenarios"]]
    fig, ax = plt.subplots(figsize=(13, 9.0))
    fig.subplots_adjust(left=0.27, right=0.97)
    y = np.arange(len(sids))[::-1]
    for yi, sid in zip(y, sids, strict=True):
        vals = []
        for k, a in enumerate(ORDER):
            r = ct.flow_result(fl, a, sid)
            v = r["change"]["net"]
            vals.append(v)
            filled = r["total_alcohol_unchanged"]
            ax.plot(
                [v],
                [yi + (k - 2) * 0.12],
                "o",
                color=col[a],
                ms=6.5,
                mfc=col[a] if filled else g.SURFACE,
                mec=col[a] if not filled else g.SURFACE,
                mew=1.3,
                zorder=4,
            )
        ax.hlines(yi, min(vals), max(vals), color=g.GRID, lw=1.2, zorder=1)
    ax.axvline(0, color=g.INK, lw=1)
    ax.set_yticks(y, [SCEN_SHORT[s] for s in sids], fontsize=8.2)
    ax.grid(axis="y", visible=False)
    ax.xaxis.set_major_formatter(g.m_fmt)
    ax.set_xlabel("State's annual change, $ a year")
    handles = [Line2D([], [], marker="o", color=col[a], ls="none", ms=6.5, label=short(fl, a)) for a in ORDER]
    handles += [
        Line2D([], [], marker="o", color=g.INK2, ls="none", ms=6.5, label="Same total alcohol"),
        Line2D([], [], marker="o", color=g.INK2, mfc=g.SURFACE, ls="none", ms=6.5, label="Alcohol changes"),
    ]
    ax.legend(handles=handles, loc="lower left", bbox_to_anchor=(-0.36, 1.0), ncol=4, fontsize=8.3)
    g.head(
        fig,
        *titles["F9"],
        note(fl)
        + " Inputs of every scenario: flows_scenarios.csv. Combinations are one illustration each, not forecasts.",
        legend_in=0.55,
    )
    g.save(fig, out, "F9_all_named_scenarios.png")


def f10_substitution(fl, out, titles, g):
    plt = g.plt
    col = colours(g)
    sub = fl["csv_substitution_grid"]
    fig, axes = plt.subplots(1, 2, figsize=(13.5, 6.2), sharey=True)
    fig.subplots_adjust(left=0.08, right=0.8, wspace=0.08)
    for ax, bev, lab in (
        (axes[0], "beer", "Share of households' beer replaced by wine"),
        (axes[1], "spirits", "Share of households' spirits replaced by wine"),
    ):
        for a in ORDER:
            pts = sorted(
                (r["share_replaced_pct"], r["net_change_usd"])
                for r in sub
                if r["arrangement_id"] == a
                and r["beverage"] == bev
                and r["conversion_basis"] == "pure_alcohol"
            )
            ax.plot([p[0] for p in pts], [p[1] for p in pts], color=col[a], lw=2, label=short(fl, a))
        ax.axhline(0, color=g.INK, lw=1)
        ax.set_xlim(0, 20)
        ax.set_xticks(range(0, 21, 5), [f"{v}%" for v in range(0, 21, 5)])
        ax.yaxis.set_major_formatter(g.m_fmt)
        ax.set_xlabel(lab + " (same pure alcohol)", fontsize=8.5)
    axes[0].set_ylabel("State's annual change, with 30% moving", fontsize=8.5)
    axes[1].legend(loc="upper left", bbox_to_anchor=(1.02, 1.0), fontsize=8.5)
    g.head(
        fig,
        *titles["F10"],
        note(fl)
        + " Equal litres or equal spending give other lines (flows_substitution_grid.csv, conversion_basis).",
    )
    g.save(fig, out, "F10_substitution_grid.png")


def f11_migration(fl, out, titles, g):
    plt = g.plt
    col = colours(g)
    mg = fl["csv_migration_grid"]
    hh = sorted({r["household_share_pct"] for r in mg})
    fig, ax = plt.subplots(figsize=(12, 6.2))
    fig.subplots_adjust(left=0.09, right=0.76)
    beside = matplotlib.transforms.blended_transform_factory(ax.transAxes, ax.transData)
    ends = []
    for a in ORDER:

        def line(h, a=a):
            return sorted(
                (r["migration_pct"], r["net_change_usd"])
                for r in mg
                if r["arrangement_id"] == a and abs(r["household_share_pct"] - h) < 1e-6
            )

        lo, mid, hi = line(hh[0]), line(hh[1]), line(hh[2])
        x = [p[0] for p in mid]
        ax.fill_between(x, [p[1] for p in lo], [p[1] for p in hi], color=col[a], alpha=0.18, lw=0)
        ax.plot(x, [p[1] for p in mid], color=col[a], lw=2)
        ends.append((mid[-1][1], f"{short(fl, a)}: {ct.money(mid[-1][1])} at 100%"))
    # Labels beside the right edge, nudged apart so that close end points stay readable.
    lo_y, hi_y = ax.get_ylim()
    gap = (hi_y - lo_y) * 0.05
    placed: list[float] = []
    for yv, text in sorted(ends):
        yp = max(yv, placed[-1] + gap) if placed else yv
        placed.append(yp)
        ax.text(1.02, yp, text, transform=beside, va="center", fontsize=8.2, color=g.INK)
    ax.axvline(30, color=g.INK2, lw=1, ls=(0, (4, 3)))
    ax.axhline(0, color=g.INK, lw=1)
    ax.set_xlim(0, 100)
    ax.xaxis.set_major_formatter(lambda v, _: f"{v:.0f}%")
    ax.yaxis.set_major_formatter(g.m_fmt)
    ax.set_xlabel("Share of household DABS wine moving to grocers (dashed: the 30% accounting case)")
    ax.set_ylabel("State's annual change, $ a year")
    g.head(
        fig,
        *titles["F11"],
        note(fl) + " Labels at right are at 100% moving, which no evidence suggests; they show the slope.",
    )
    g.save(fig, out, "F11_share_moving.png")


def draw(fl: dict, out, titles: dict, g) -> list[str]:
    """Draws F1-F11; returns their file names."""
    for f in (
        f1_sources,
        f2_components,
        f3_gained_lost,
        f4_quantities,
        f5_price_migration,
        f6_break_even,
        f7_frontiers,
        f8_sensitivity,
        f9_scenarios,
        f10_substitution,
        f11_migration,
    ):
        f(fl, out, titles, g)
    return [
        "F1_grocery_wine_by_source.png",
        "F2_collections_and_costs_by_design.png",
        "F3_revenue_gained_vs_displaced.png",
        "F4_beverage_litres_and_pure_alcohol.png",
        "F5_price_and_channel_choice.png",
        "F6_break_even_by_source.png",
        "F7_break_even_frontiers.png",
        "F8_sensitivity.png",
        "F9_all_named_scenarios.png",
        "F10_substitution_grid.png",
        "F11_share_moving.png",
    ]
