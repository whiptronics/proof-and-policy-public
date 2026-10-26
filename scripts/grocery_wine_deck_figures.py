"""Plain-language figures for the grocery-wine slide deck, drawn only from the project's exported files.

Reads data/processed/grocery-wine (alternatives_price_stack.csv, alternatives_summary.csv, demand_sensitivity.csv,
and the purchase-flow tables flows_scenarios.csv, flows_break_even.csv, flows_arrangements.csv, flows_conversions.csv
and flows.json) and data/processed/tennessee-2016. Writes a PDF and a PNG of each figure to <out>/figures and the
numbers the deck quotes to <out>/figures/numbers.json, so the slide text can be checked against them. Needs matplotlib
(on this PC: ParaView's pvpython).

    pvpython -B scripts/grocery_wine_deck_figures.py "<deck folder>"
"""

from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib.patches import Patch  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
GW = ROOT / "data" / "processed" / "grocery-wine"
TN = ROOT / "data" / "processed" / "tennessee-2016"

INK, INK2, GRID = "#1d1f22", "#55585e", "#dcdcd6"
COST, STATE, SELLERS = "#b9b6ae", "#2a6fd8", "#e8743b"
SAME, LESS = "#1f4e8c", "#8fb3e0"
BEER, SPIRITS, NEW = "#d99a00", "#c4508a", "#1a9c6e"
TNC, NBC = "#2a6fd8", "#9a978f"

plt.rcParams.update(
    {
        "font.family": "DejaVu Sans",
        "font.size": 14,
        "axes.edgecolor": "#b8b6ae",
        "axes.labelcolor": INK2,
        "xtick.color": INK2,
        "ytick.color": INK,
        "axes.spines.top": False,
        "axes.spines.right": False,
        "savefig.dpi": 200,
        "pdf.fonttype": 42,
        "figure.facecolor": "white",
    }
)

# The four options the deck explains, in its order: (alternative id, label for the chart)
OPTIONS = [
    ("B20_matched", "DABS sells to grocers at 20% off;\nsame price as a state store"),
    ("C20_matched", "Private wholesalers, 20% state tax;\nsame price as a state store"),
    ("A_target", "DABS keeps its full markup;\nthe grocer adds its own"),
    ("C_gallon", "Private wholesalers; a state charge\nper gallon equal to DABS's markup"),
]
# The purchase-flow design that uses each option's per-bottle terms (web/src/lib/wineFlows.ts).
FLOW_ID = {
    "B20_matched": "dabs_discount_20",
    "C20_matched": "private_tax_20",
    "A_target": "preserved_dabs",
    "C_gallon": "preserved_private",
}


def rows(path: Path) -> list[dict]:
    with open(path, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def save(fig, out: Path, name: str) -> None:
    out.mkdir(parents=True, exist_ok=True)
    fig.savefig(out / f"{name}.pdf", bbox_inches="tight", pad_inches=0.08)
    fig.savefig(out / f"{name}.png", bbox_inches="tight", pad_inches=0.08)
    plt.close(fig)


def money(v: float) -> str:
    return f"{'−' if v < 0 else '+'}${abs(v) / 1e6:.1f}M"


def main() -> int:
    out = Path(sys.argv[1]) / "figures"
    stack = {(r["alternative_id"], r["column"], r["row"]): float(r["per_dollar_of_todays_pretax_price"] or 0) for r in rows(GW / "alternatives_price_stack.csv")}
    summ = {r["alternative_id"]: r for r in rows(GW / "alternatives_summary.csv")}
    dem = {
        (r["alternative_id"], r["case_id"]): float(r["state_change_usd"])
        for r in rows(GW / "demand_sensitivity.csv")
    }
    flows = {
        (r["arrangement_id"], r["scenario_id"]): float(r["net_change_usd"])
        for r in rows(GW / "flows_scenarios.csv")
    }
    be = {
        (r["arrangement_id"], r["lever"]): r
        for r in rows(GW / "flows_break_even.csv")
        if r["context_scenario_id"] == "accounting_30"
    }
    arr = {r["arrangement_id"]: r for r in rows(GW / "flows_arrangements.csv")}
    conv = {r["quantity"]: float(r["value"]) for r in rows(GW / "flows_conversions.csv")}
    fl = json.loads((GW / "flows.json").read_text(encoding="utf-8"))
    b5 = next(r for r in fl["results"] if r["arrangement"] == "preserved_dabs" and r["scenario"] == "beer_5")
    s01 = next(a for a in fl["assumptions"] if a["id"] == "S01")
    nums: dict = {
        "options": {},
        "method": fl["method"],
        "project_commit": fl["project_commit"],
        "designs": {
            k: {
                "collection_per_dollar": float(v["state_collection_per_dollar_of_todays_price"]),
                "price_change_pct": float(v["consumer_price_change_pct_vs_state_store"]),
                "grocer_margin_pct": None
                if v["grocer_margin_pct_of_its_price"] == ""
                else float(v["grocer_margin_pct_of_its_price"]),
            }
            for k, v in arr.items()
        },
        "beer_5": {
            "wine_litres_added": next(o for o in b5["origins"] if o["id"] == "B")["grocery"]["litres"],
            "beer_litres_replaced": b5["displaced"]["beerLitres"],
            "pure_alcohol_change": b5["alcohol"]["total"],
            "household_wine_litres": fl["base"]["wine"]["litres"] * fl["base"]["wine"]["household"],
        },
        "cans_per_bottle": conv["beer cans with the same pure alcohol as one bottle of wine"],
        "survey_overlap": s01["value"],
        "admin": fl["default_inputs"]["costs"]["admin"],
    }

    # 1. Where the money from $1 of wine goes (shelf price before sales tax, per $1 of today's state-store price)
    bars = [("Today: a state store", "B20_matched", "today")] + [(lab, aid, "after") for aid, lab in OPTIONS]
    fig, ax = plt.subplots(figsize=(11.5, 5.6))
    for i, (_lab, aid, col) in enumerate(bars):
        y = len(bars) - 1 - i
        cost = stack[(aid, col, "acquisition")]
        state = stack[(aid, col, "dabsMargin")] + stack[(aid, col, "chargeInPrice")]
        sellers = stack[(aid, col, "wholesaleMargin")] + stack[(aid, col, "retailerMargin")]
        left = 0.0
        for v, c in ((cost, COST), (state, STATE), (sellers, SELLERS)):
            if v > 1e-9:
                ax.barh(y, v * 100, left=left * 100, color=c, height=0.62, edgecolor="white", linewidth=2)
                ax.text((left + v / 2) * 100, y, f"{v * 100:.0f}¢", ha="center", va="center", fontsize=13, color="white" if c != COST else INK, fontweight="bold")
            left += v
        ax.text(left * 100 + 1.5, y, f"shelf price {left * 100:.0f}¢", va="center", fontsize=12, color=INK2)
        nums.setdefault("price_stack", {})[f"{aid}:{col}"] = {"cost": cost, "state": state, "sellers": sellers, "shelf": left}
    ax.axvline(100, color=INK, lw=1.2, ls=(0, (4, 3)))
    ax.set_yticks(range(len(bars)), [b[0] for b in bars][::-1])
    ax.tick_params(axis="y", length=0)
    ax.set_xlim(0, 182)
    ax.set_xticks([0, 25, 50, 75, 100, 125, 150])
    ax.set_xticklabels([f"{v}¢" for v in [0, 25, 50, 75, 100, 125, 150]])
    ax.set_xlabel("Cents per $1 of today's state-store price, before sales tax")
    ax.grid(axis="x", color=GRID, lw=0.8)
    ax.set_axisbelow(True)
    ax.legend(
        handles=[Patch(color=COST, label="What the wine costs DABS"), Patch(color=STATE, label="The state's share (markup or tax)"), Patch(color=SELLERS, label="Grocer and any private wholesaler")],
        loc="lower center", bbox_to_anchor=(0.45, 1.0), ncol=3, frameon=False, fontsize=12,
    )
    save(fig, out, "fig1_where_the_dollar_goes")

    # 2. State revenue for each option: 30% moving at any price, and channel choice (fewer move at a higher grocery
    # price; the rest keep buying at DABS). From the purchase-flow model (flows_scenarios.csv).
    fig, ax = plt.subplots(figsize=(11.5, 5.4))
    h = 0.36
    for i, (aid, _lab) in enumerate(OPTIONS):
        y = len(OPTIONS) - 1 - i
        fid = FLOW_ID[aid]
        same = flows[(fid, "accounting_30")]
        fewer = flows[(fid, "channel_60")]
        price = float(summ[aid]["consumer_price_change_pct_vs_state_store"])
        nums["options"][aid] = {
            "label": summ[aid]["label"],
            "flow_design": fid,
            "price_change_pct": price,
            "same_purchases": same,
            "fewer_move_rest_at_dabs": fewer,
            "nobody_moves": flows[(fid, "channel_30")],
            "old_price_response_exploratory": dem[(aid, "price_constant")],
            "no_store_savings": float(summ[aid]["state_change_no_avoidable_cost_usd"]),
            "funds_deposits_on_grocer_sales": float(summ[aid]["funds_change_usd_deposits_on_grocer_sales"]),
            "funds_no_deposits": float(summ[aid]["funds_change_usd_no_deposits_on_grocer_sales"]),
        }
        for v, dy, c in ((same, h / 2, SAME), (fewer, -h / 2, LESS)):
            ax.barh(y + dy, v / 1e6, height=h, color=c, edgecolor="white", linewidth=1.5)
            ax.text(v / 1e6 + (0.25 if v >= 0 else -0.25), y + dy, money(v), va="center", ha="left" if v >= 0 else "right", fontsize=12, color=INK)
        ax.text(5.6, y, "same price" if abs(price) < 0.05 else f"price +{price:.0f}%", va="center", fontsize=12, color=INK2)
    ax.axvline(0, color=INK, lw=1.3)
    ax.set_yticks(range(len(OPTIONS)), [lab for _, lab in OPTIONS][::-1], fontsize=12.5)
    ax.tick_params(axis="y", length=0)
    ax.set_xlim(-16.5, 8.2)
    ax.set_xticks([-15, -10, -5, 0, 5])
    ax.set_xticklabels(["−$15M", "−$10M", "−$5M", "$0", "+$5M"])
    ax.text(5.6, len(OPTIONS) - 0.42, "Grocery price\nvs state store", fontsize=11, color=INK2, va="bottom")
    ax.set_xlabel("Change in state revenue, $ a year")
    ax.grid(axis="x", color=GRID, lw=0.8)
    ax.set_axisbelow(True)
    ax.legend(
        handles=[
            Patch(color=SAME, label="30% of household wine moves, whatever the price"),
            Patch(
                color=LESS, label="Fewer move as the price rises (none at +60%); the rest keep buying at DABS"
            ),
        ],
        loc="lower center",
        bbox_to_anchor=(0.42, 1.0),
        ncol=1,
        frameon=False,
        fontsize=12,
    )
    save(fig, out, "fig2_state_revenue_by_option")

    # 3. Break-even by source for the two same-price options (the full-markup options need none).
    sources = [
        ("beer", "Wine replaces beer\n(same alcohol)", BEER),
        ("spirits", "Wine replaces spirits\n(same alcohol)", SPIRITS),
        ("additional", "Additional wine, or wine\nbought back from other states", NEW),
    ]
    fig, ax = plt.subplots(figsize=(11.5, 5.4))
    w = 0.26
    opts = OPTIONS[:2]
    for i, (aid, _lab) in enumerate(opts):
        y = len(opts) - 1 - i
        for k, (lever, _slab, c) in enumerate(sources):
            r = be[(FLOW_ID[aid], lever)]
            yy = y + (1 - k) * w
            nums.setdefault("break_even", {})[f"{aid}:{lever}"] = {
                "status": r["status"],
                "share_pct": None if r["break_even_pct"] in ("", None) else float(r["break_even_pct"]),
            }
            if r["status"] == "found":
                v = float(r["break_even_pct"])
                ax.barh(yy, v, height=w * 0.92, color=c, edgecolor="white", linewidth=1)
                ax.text(v + 0.6, yy, f"{v:.1f}%", va="center", fontsize=12.5, color=INK)
            else:
                ax.text(
                    0.6,
                    yy,
                    "none: replacing spirits lowers revenue here" if lever == "spirits" else r["status"],
                    va="center",
                    fontsize=12,
                    color=INK2,
                )
    for aid in (a for a, _ in OPTIONS[2:]):
        for lever, _s, _c in sources:
            r = be[(FLOW_ID[aid], lever)]
            nums.setdefault("break_even", {})[f"{aid}:{lever}"] = {
                "status": r["status"],
                "share_pct": None if r["break_even_pct"] in ("", None) else float(r["break_even_pct"]),
            }
    ax.set_yticks(range(len(opts)), [lab for _, lab in opts][::-1], fontsize=12.5)
    ax.tick_params(axis="y", length=0)
    ax.set_xlim(0, 50)
    ax.set_xticks([0, 10, 20, 30, 40, 50])
    ax.set_xticklabels([f"{v}%" for v in [0, 10, 20, 30, 40, 50]])
    ax.set_xlabel(
        "Needed to break even: share of households' beer or spirits, or more wine as a share of household wine"
    )
    ax.grid(axis="x", color=GRID, lw=0.8)
    ax.set_axisbelow(True)
    ax.legend(
        handles=[Patch(color=c, label=s.replace("\n", " ")) for _, s, c in sources],
        loc="lower center",
        bbox_to_anchor=(0.42, 1.0),
        ncol=3,
        frameon=False,
        fontsize=11.5,
    )
    save(fig, out, "fig3_break_even_by_source")

    # 5. What each source of grocery wine does to state revenue, per option (on top of 30% moving).
    cases = [
        ("accounting_30", "Only existing wine moves", SAME),
        ("beer_5", "Plus: wine replaces 5% of\nhouseholds' beer", BEER),
        ("spirits_5", "Plus: wine replaces 5% of\nhouseholds' spirits", SPIRITS),
        ("additional_2", "Plus: 2% more wine\n(new or from other states)", NEW),
    ]
    fig, ax = plt.subplots(figsize=(11.5, 6.0))
    w = 0.2
    for i, (aid, _lab) in enumerate(OPTIONS):
        y = len(OPTIONS) - 1 - i
        for k, (sc, _clab, c) in enumerate(cases):
            v = flows[(FLOW_ID[aid], sc)]
            yy = y + (1.5 - k) * w
            ax.barh(yy, v / 1e6, height=w * 0.9, color=c, edgecolor="white", linewidth=1)
            ax.text(
                v / 1e6 + (0.3 if v >= 0 else -0.3),
                yy,
                money(v),
                va="center",
                ha="left" if v >= 0 else "right",
                fontsize=10.5,
                color=INK,
            )
            nums.setdefault("sources", {})[f"{aid}:{sc}"] = v
    ax.axvline(0, color=INK, lw=1.3)
    ax.set_yticks(range(len(OPTIONS)), [lab for _, lab in OPTIONS][::-1], fontsize=12.5)
    ax.tick_params(axis="y", length=0)
    ax.set_xlim(-20, 20)
    ax.set_xticks([-15, -10, -5, 0, 5, 10, 15])
    ax.set_xticklabels(["−$15M", "−$10M", "−$5M", "$0", "+$5M", "+$10M", "+$15M"])
    ax.set_xlabel("Change in state revenue, $ a year (30% of household wine moves in every bar)")
    ax.grid(axis="x", color=GRID, lw=0.8)
    ax.set_axisbelow(True)
    ax.legend(
        handles=[Patch(color=c, label=lab.replace("\n", " ")) for _, lab, c in cases],
        loc="lower center",
        bbox_to_anchor=(0.42, 1.0),
        ncol=2,
        frameon=False,
        fontsize=11.5,
    )
    save(fig, out, "fig5_sources_of_grocery_wine")

    # 4. Tennessee after grocery wine (July 2016): Tennessee against its eight neighbouring states
    main = {r["outcome_id"]: r for r in rows(TN / "tennessee_results_main_and_sensitivity.csv") if r["specification"] == "main"}
    by = rows(TN / "tennessee_main_by_state.csv")
    groups = [("B1", "Wine bought per adult (21+)\n2011–15 to 2017–19"), ("R1", "State alcohol tax receipts, after inflation\nFY2012–15 to FY2017–19")]
    fig, ax = plt.subplots(figsize=(11.5, 5.0))
    for i, (oid, lab) in enumerate(groups):
        nb = [float(r["pct_change"]) for r in by if r["outcome_id"] == oid and r["geo_id"] != "state:47"]
        tn = float(main[oid]["tn_pct_change"])
        avg = sum(nb) / len(nb)
        x0 = i * 3
        ax.bar(x0, tn, width=0.9, color=TNC)
        ax.bar(x0 + 1, avg, width=0.9, color=NBC)
        ax.errorbar(x0 + 1, avg, yerr=[[avg - min(nb)], [max(nb) - avg]], color=INK, capsize=8, lw=1.4)
        ax.text(x0, tn + 1, f"+{tn:.1f}%", ha="center", fontsize=14, fontweight="bold", color=INK)
        ax.text(x0 + 1.12, avg + 0.8, f"+{avg:.1f}% average", ha="left", fontsize=12, color=INK)
        ax.text(x0 + 0.5, -14, lab, ha="center", va="top", fontsize=12.5, color=INK)
        nums.setdefault("tennessee", {})[oid] = {"tn_pct": tn, "neighbours_avg_pct": avg, "neighbours_min_pct": min(nb), "neighbours_max_pct": max(nb), "n_neighbours": len(nb), "diff_log_points": float(main[oid]["diff_log_points"])}
    ax.axhline(0, color=INK, lw=1.2)
    ax.set_xticks([])
    ax.set_ylim(-12, 40)
    ax.set_yticks([-10, 0, 10, 20, 30, 40])
    ax.set_yticklabels(["−10%", "0%", "+10%", "+20%", "+30%", "+40%"])
    ax.set_ylabel("Change, before to after")
    ax.spines["bottom"].set_visible(False)
    ax.legend(handles=[Patch(color=TNC, label="Tennessee"), Patch(color=NBC, label="Its 8 neighbouring states (bar: average; line: lowest to highest)")], loc="lower left", bbox_to_anchor=(0.0, 1.0), ncol=2, frameon=False, fontsize=12)
    save(fig, out, "fig4_tennessee")

    (out / "numbers.json").write_text(json.dumps(nums, indent=1), encoding="utf-8")
    print(f"figures written to {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
