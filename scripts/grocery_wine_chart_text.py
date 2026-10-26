"""Chart titles for the grocery-wine graph package, written from the exported numbers (no plotting here).

Every claim a title makes is computed from the data it sits over, so a title cannot call a gain a loss or say "every
design loses" when one does not. ``check_titles`` is used by scripts/grocery_wine_graphs.py before it saves anything
and by tests/test_grocery_wine_chart_text.py. Utah titles begin "Model"; Tennessee titles begin "Observed".
"""

from __future__ import annotations

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
UTAH = ROOT / "data" / "processed" / "grocery-wine" / "alternatives.json"
TENN = ROOT / "data" / "processed" / "tennessee-2016"
PRICE_SHARE = ROOT / "data" / "processed" / "grocery-wine" / "price_share.json"

# Wordings the correction of 2026-10-17 removed; none may appear in a title or subtitle.
FORBIDDEN = [
    "could only add",
    "only added tax",
    "without buying less beer",
    "no substitution",
    "explained by",
    "accounts for",
    "every tested design",
    "every design",
    "not distinguishable",
    "every expense disappears",
    "all expenses",
    "commercially unworkable",
    "will lose",
    # Universal claims the 2026-10-18 brief asked to remove.
    "necessarily costs",
    "only pays for itself",
    "no option that preserves",
    "always loses",
]
MAIN = ["R1", "R2", "C20_matched", "B20_matched", "B20_target", "A_matched", "A_target", "A_net", "C_take", "C_gallon", "C_take_outside", "C_break_even", "C_matched_be"]


def money(x: float, digits: int = 1) -> str:
    sign = "−" if x < -0.05e6 else "+" if x > 0.05e6 else ""
    return f"{sign}${abs(x) / 1e6:,.{digits}f}M"


def pct(x: float, digits: int = 1) -> str:
    return f"{x * 100:.{digits}f}%"


def verb(net: float, tol: float = 0.5) -> str:
    """The same rule as wineAccounting.ts signWords."""
    return "raises" if net > tol else "lowers" if net < -tol else "leaves unchanged"


def load_utah(path: Path = UTAH) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def load_tn(folder: Path = TENN) -> dict:
    def rows(name):
        with open(folder / name, encoding="utf-8", newline="") as f:
            return list(csv.DictReader(f))

    return {
        "results": rows("tennessee_results_main_and_sensitivity.csv"),
        "raw": rows("tennessee_raw_series.csv"),
        "by_state": rows("tennessee_main_by_state.csv"),
        "placebo": rows("tennessee_placebo_dates.csv"),
    }


def load_price_share(path: Path = PRICE_SHARE) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def ps_cell(ps: dict, arr: str, premium: float, share: float, savings: str, volume: str) -> dict:
    return next(
        c
        for c in ps["cells"]
        if c["arrangement"] == arr
        and abs(c["premium"] - premium) < 1e-9
        and abs(c["share"] - share) < 1e-9
        and c["savings"] == savings
        and c["volume"] == volume
    )


def price_share_titles(ps: dict) -> dict[str, tuple[str, str]]:
    """Titles for the price-and-share graphs (U9-U13); every claim is computed from price_share.json."""
    n_arr = len(ps["arrangements"])
    worked = 0.3
    premiums = ps["axes"]["premium"]["values"]
    shares = ps["axes"]["share"]["values"]
    base = ps["denominator"]["covered_household_purchases_usd"]

    def whole_somewhere(savings: str) -> list[str]:
        return [
            a["short"]
            for a in ps["arrangements"]
            if any(
                c["net"] >= 0
                for c in ps["cells"]
                if c["arrangement"] == a["id"] and c["savings"] == savings and c["volume"] == "fixed_volume"
            )
        ]

    src, none = whole_somewhere("source_based"), whole_somewhere("none")
    zero_share = {round(c["net"]) for c in ps["cells"] if c["share"] == 0}
    if len(zero_share) != 1:
        raise ValueError("the zero-share cells differ: the titles' administration-cost claim does not hold")
    admin = -zero_share.pop()
    below = [m for m in ps["markers"] if m["grocerCost"] is not None and m["grocerCost"] > 1e-9]
    # Does the price response leave every positive-premium cell at 30% at or below its fixed-volume value?
    lower = all(
        ps_cell(ps, a["id"], p, worked, "source_based", "price_response")["net"]
        <= ps_cell(ps, a["id"], p, worked, "source_based", "fixed_volume")["net"] + 0.5
        for a in ps["arrangements"]
        for p in premiums
        if p > 0
    )
    spread = max(
        max(c["funds"] for c in grp) - min(c["funds"] for c in grp)
        for grp in (
            [c for c in ps["cells"] if c["arrangement"] == a["id"] and c["share"] == s and c["savings"] == "source_based" and c["volume"] == "fixed_volume"]
            for a in ps["arrangements"]
            for s in shares
        )
    )
    common = (
        f"Each cell: the state's annual change, all state funds together, FY2025 $ (millions). Rows: share of covered household wine purchases moving to grocers (base {money(base)[1:]} a year: DABS wine sales times the 82% household share). "
        "Columns: consumer price at a grocer against the same bottle at a state store, state sales tax included. Conditional sensitivity, not a forecast: no combination is predicted or given a probability."
    )
    t = {
        "U9": (
            f"Model, grocery price x grocery share at fixed volume, source-based savings: {len(src)} of {n_arr} arrangements keep state receipts whole somewhere on the grid",
            common + " Savings: 2.28¢ of store cost avoided per $1 that leaves (U07, an assumption).",
        ),
        "U10": (
            f"Model, the same grid with no avoidable store savings: {len(none)} of {n_arr} arrangements keep state receipts whole somewhere on it",
            common + " No store cost is avoided.",
        ),
        "U11": (
            "Model: the grocer's gross margin at each grocery price, with the discount or charge held fixed",
            "Gross margin: the grocer's selling price less what it pays, as a share of its own price, before its own costs (not profit). It does not depend on the share that moves. "
            f"Private supply: after a wholesaler assumed to keep {pct(ps['wholesaler_margin'])} of its price. 28% is a national grocery reference, not a minimum.",
        ),
        "U12": (
            "Model, exploratory demand case at 30% moving (the old treatment; F5 replaces it): with a market-wide elasticity on the grocery price, the state's change is "
            + (
                "at or below the fixed-volume result at every positive premium"
                if lower
                else "not always below the fixed-volume result"
            ),
            "Price response (elasticity −0.46, U15) applied after the share is assigned; purchases no longer made at grocers are counted as leaving Utah, though DABS still sells the same bottles at today's price. F5 lets them stay at DABS. A sensitivity, not a forecast.",
        ),
        "U13": (
            "Model, fixed volume: the school-meal and enforcement funds change with the share that moves and with how DABS's sales to grocers are treated, "
            + ("not with the grocery price" if spread < 1 else "and also with the grocery price"),
            "Allocations inside the statewide totals of U9 and U10, never added to them. DABS supply: two readings of whether its sales to grocers carry the deposits (current law unresolved).",
        ),
    }
    t["_facts"] = (f"admin={admin}", f"below_cost_arrangements={','.join(m['arrangement'] for m in below)}")
    return t


def alt(data: dict, aid: str) -> dict:
    return next(a for a in data["alternatives"] if a["id"] == aid)


def crossing(rows: list[dict]) -> float | None:
    """Where a sweep's net change first changes sign (linear interpolation), as the lever's value (0-1)."""
    for a, b in zip(rows, rows[1:], strict=False):
        if a["net"] == 0:
            return a["v"]
        if (a["net"] > 0) != (b["net"] > 0):
            return a["v"] + (b["v"] - a["v"]) * a["net"] / (a["net"] - b["net"])
    return None


def utah_titles(data: dict) -> dict[str, tuple[str, str]]:
    r1, r2 = alt(data, "R1"), alt(data, "R2")
    n1, n2 = r1["ledger_fixed"]["net"], r2["ledger_fixed"]["net"]
    sales_tax_on_moved = data["moved_dollars"] * alt(data, "R1")["inputs"]["state_sales_tax"]
    main = [alt(data, a) for a in MAIN]
    whole = [a for a in main if a["ledger_fixed"]["net"] >= -0.5]
    priced = [a["price_stack"]["consumerChange"] for a in whole if a["price_stack"]["consumerChange"] > 1e-9]
    flat = [a["retailer"]["marginShare"] for a in whole if a["price_stack"]["consumerChange"] <= 1e-9 and a["retailer"]["marginShare"] is not None]
    sw = data["sweeps"]
    be_m, be_t = crossing(sw["discount_matched"]), crossing(sw["discount_target"])
    ch_m, ch_t = crossing(sw["charge_matched"]), crossing(sw["charge_target"])
    at = alt(data, "A_target")
    at_pc = next(d for d in at["demand"] if d["id"] == "price_constant")["net"]
    losing = [a for a in main if a["ledger_fixed"]["net"] < -0.5]
    t = {
        "U1": (
            f"Model, historical references at fixed volume: Reference 1 {verb(n1)} state revenue by {money(n1)[1:]} a year, Reference 2 by {money(n2)[1:]}",
            f"Change from today. Both keep the {money(sales_tax_on_moved)[1:]} of state sales tax on the wine that moves; the change is the DABS margin given up, the tax or margin collected instead, and costs.",
        ),
        "U2": (
            f"Model, fixed volume: {len(losing)} of {len(main)} alternatives lower state revenue; the result depends on who pays the grocer's margin",
            "Change from today by component, $ a year. Filled diamond: the sum; hollow diamond: the same with no avoidable cost. The 2.28¢ avoidable cost is a source-based assumption (allocated FY2025 expense lines), not a measured saving.",
        ),
        "U3": (
            "Model, fixed volume: price, state revenue, grocer margin and the school-meal and enforcement funds, for each alternative",
            "Gross margin (before the grocer's own costs; not profit) as a share of its selling price; 28% is a national reference, not a minimum. Revenue: bar with the assumed 2.28¢ savings, x with none, o with the exploratory price response (the old treatment; see F5). Fund ranges: two readings of current law.",
        ),
        "U4": (
            f"Model, DABS supply: the state's fixed-volume change is positive below a {pct(be_m, 1)} discount at today's prices, or {pct(be_t, 1)} when grocers price for 28%",
            "Discount off today's shelf price at which DABS sells to grocers. At today's prices the grocer's margin is the discount; with a 28% target, the price carries it.",
        ),
        "U5": (
            (
                f"Model, private supply: a {pct(ch_t, 1)} charge on the sellers' price keeps state revenue whole when they price for national margins; the {pct(ch_m, 0)} break-even at today's price would put the grocer below its acquisition cost"
                if alt(data, "C_matched_be")["retailer"]["arithmeticOnly"]
                else f"Model, private supply: the charge that keeps state revenue whole is {pct(ch_m, 0)} of the sellers' price at today's prices ({pct(ch_m / (1 + ch_m), 1)} of the price including it), or {pct(ch_t, 1)} with sellers' margins"
            ),
            "A charge on the grocery price before the charge (its base), inside the sales-tax base. A rate on that base is a smaller share of the price that includes it: rate / (1 + rate).",
        ),
        "U6": (
            f"Model, exploratory demand cases (the old treatment; F5 and F9 replace it): if a market-wide elasticity is applied to the grocery price and lost bottles leave Utah, keeping DABS's margin per bottle {verb(at_pc)} state revenue ({money(at_pc)} a year)",
            "Kept for comparison only: it treats a higher grocery price as if every wine price had risen, though DABS still sells at today's price; squares read the same bottles as bought at DABS instead. Recapture and access values are illustrative.",
        ),
        "U7": (
            "Model, cost cases: how the fixed-volume result moves with what the state stops paying",
            "One change at a time from each alternative as defined. Proportional cases are arithmetic bounds: the stores stay open in every case.",
        ),
        "U8": (
            "Model, beer-to-wine threshold: extra wine replacing beer needed to offset each loss at fixed volume",
            "Share of 2024 Utah wine gallons, holding total alcohol constant. A threshold, not a forecast: no study measures this switching. F6 and F10 restate it with beer and spirits separated.",
        ),
        "S0": (
            "Tennessee's alcohol tax receipts rose after grocery wine; in Utah's model, keeping revenue whole when only existing wine purchases move needs higher grocery prices or very thin grocer margins",
            (
                f"Utah alternatives that keep revenue at or above today's at fixed volume raise the grocery price {pct(min(priced), 0)}–{pct(max(priced), 0)}, or keep today's price and leave the grocer {pct(max(flat), 0)} of its price or less (the break-even charge would need sales below cost). If some grocery wine replaced beer or came back from other states, less is needed (F6)."
                if priced and flat
                else "See U2."
            ),
        ),
    }
    return t


def tn_value(tn: dict, spec: str, oid: str, col: str) -> float:
    row = next(r for r in tn["results"] if r["specification"] == spec and r["outcome_id"] == oid)
    return float(row[col]) if row[col] not in ("", None) else float("nan")


def tn_titles(tn: dict, trend_above: float | None = None) -> dict[str, tuple[str, str]]:
    wine_pct = tn_value(tn, "main", "B1", "tn_pct_change") / 100
    beer_pct = tn_value(tn, "main", "B2", "tn_pct_change") / 100
    beer_rel = tn_value(tn, "main", "B2", "diff_log_points")
    wine_rel = tn_value(tn, "main", "B1", "diff_log_points")
    t10 = tn_value(tn, "main", "R1", "tn_pct_change") / 100
    t10_rel = tn_value(tn, "main", "R1", "diff_log_points")
    wt = tn_value(tn, "main", "R2", "tn_pct_change") / 100
    beer_word = "fell" if beer_pct < 0 else "rose"
    t = {
        "T1": (
            f"Observed: Tennessee's alcohol tax receipts rose {pct(t10)} after inflation, {t10_rel:.1f} log points more than its neighbours' average",
            "Census T10, constant 2024 dollars, FY2012–15 to FY2017–19. A before-and-after comparison, not an effect estimate.",
        ),
        "T2": (
            "Observed, arithmetic comparison: Tennessee's receipts against a straight-line continuation of its FY2012–15 trend"
            + (f" ({money(trend_above)} a year above it in FY2017–19)" if trend_above is not None else ""),
            "The dashed line extends the earlier trend; the gap is arithmetic, not a measure of what grocery wine caused.",
        ),
        "T3": (
            f"Observed: Tennessee's wine-tax account was {pct(wt)} above its FY2012–16 average in FY2017, the first year of grocery wine",
            "Collections from every seller, not only grocers. FY2016 had already risen; the account's label changed in FY2018, so later years are not joined.",
        ),
        "T4": (
            f"Observed: Tennessee's wine purchases rose {pct(wine_pct, 0)} and its beer purchases {beer_word} {pct(abs(beer_pct), 0)} (2011–15 to 2017–19); the comparison does not show that people switched",
            f"Relative to the neighbours' average: wine {wine_rel:+.1f} log points, beer {beer_rel:+.1f}. Purchases (sales and shipments), not drinking.".replace("-", "−"),
        ),
        "T5": (
            "Observed, descriptive diagnostic: the July 2016 gap beside the same comparison at earlier dates when no law changed",
            "Not a significance test: the earlier windows overlap, so the count is a rough guide to how unusual a gap is.",
        ),
        "T6": (
            "Observed: sensitivity ranges across the pre-registered specifications (not confidence intervals)",
            "Each grey dot is another window, data choice or comparison pool fixed before the results were computed.",
        ),
    }
    return t


# ----- purchase flows (wine-purchase-flows@1.0) -----------------------------------------------------------------------
FLOWS = ROOT / "data" / "processed" / "grocery-wine" / "flows.json"
PRESERVED = ["preserved_dabs", "preserved_private", "preserved_dabs_matched"]
REDUCED = ["dabs_discount_20", "private_tax_20"]
# The fixed-30% scenarios drawn in F1; their sources do not depend on the design (checked in flow_titles).
F1_SCENARIOS = ["accounting_30", "beer_2", "beer_5", "spirits_2", "spirits_5", "recapture_2", "additional_2"]


def load_flows(path: Path = FLOWS) -> dict:
    """flows.json plus the flows_*.csv tables beside it (numbers parsed where they parse)."""

    def num(v: str):
        if v in ("", None):
            return None
        try:
            return float(v)
        except ValueError:
            return v

    fl = json.loads(path.read_text(encoding="utf-8"))
    tables = (
        "break_even",
        "break_even_frontier",
        "sensitivity",
        "substitution_grid",
        "migration_price_grid",
        "migration_grid",
        "components",
        "beverages",
        "scenarios",
    )
    for name in tables:
        with open(path.parent / f"flows_{name}.csv", encoding="utf-8", newline="") as f:
            fl[f"csv_{name}"] = [{k: num(v) for k, v in r.items()} for r in csv.DictReader(f)]
    return fl


def flow_result(fl: dict, arr: str, sc: str) -> dict:
    return next(r for r in fl["results"] if r["arrangement"] == arr and r["scenario"] == sc)


def flow_arr(fl: dict, arr: str) -> dict:
    return next(a for a in fl["arrangements"] if a["id"] == arr)


def flow_line(fl: dict, arr: str, sc: str, line: str) -> dict:
    return next(x for x in flow_result(fl, arr, sc)["lines"] if x["id"] == line)


def flow_net(fl: dict, arr: str, sc: str) -> float:
    return flow_result(fl, arr, sc)["change"]["net"]


def lower_first(s: str) -> str:
    """Lower-cases the first letter only, so acronyms such as DABS keep their capitals."""
    return s[:1].lower() + s[1:]


def money_range(xs: list[float]) -> str:
    return f"{money(min(xs))} to {money(max(xs))}"


def flow_titles(fl: dict) -> dict[str, tuple[str, str]]:
    """Titles for the purchase-flow graphs (F1-F11); every claim is computed from flows.json and its tables."""
    admin = fl["default_inputs"]["costs"]["admin"]
    every = PRESERVED + REDUCED
    # F1: the sources of grocery wine at a fixed 30% are the same under every design.
    for s in F1_SCENARIOS:
        ref = flow_result(fl, "preserved_dabs", s)["origins"]
        for a in every:
            for o, r in zip(flow_result(fl, a, s)["origins"], ref, strict=True):
                if abs(o["grocery"]["storeEquivalent"] - r["grocery"]["storeEquivalent"]) > 1:
                    raise ValueError(f"F1: sources differ between designs in {s}")
    moved = flow_result(fl, "preserved_dabs", "accounting_30")["origins"][0]["grocery"]["storeEquivalent"]
    # F2
    pres = [flow_net(fl, a, "accounting_30") for a in PRESERVED]
    paid = [
        flow_arr(fl, a)["consumerRatio"] - 1
        for a in PRESERVED
        if (flow_arr(fl, a)["grocerMarginShare"] or 0) > 1e-9
    ]
    # F3: per source, gained against lost.
    beer_up = [a for a in every if flow_line(fl, a, "beer_5", "beer_to_wine")["value"] > 0]
    spirits_up = [a for a in every if flow_line(fl, a, "spirits_5", "spirits_to_wine")["value"] > 0]
    # F4: quantities under beer 5%.
    b5 = flow_result(fl, "preserved_dabs", "beer_5")
    origin_b = next(o for o in b5["origins"] if o["id"] == "B")
    wine_l = origin_b["grocery"]["litres"] + origin_b["dabs"]["litres"]
    beer_l = b5["displaced"]["beerLitres"]
    if abs(b5["alcohol"]["total"]) >= 1:
        raise ValueError("F4: the constant-alcohol case changes alcohol")
    # F5: with nobody moving, the state is out only the administration cost.
    grid = fl["csv_migration_price_grid"]
    for r in grid:
        lim = r["convenience_limit_premium_pct"]
        if (
            isinstance(lim, float)
            and r["grocery_premium_pct"] >= lim - 1e-6
            and abs(r["net_change_usd"] + admin) > 1
        ):
            raise ValueError("F5: a cell with nobody moving is not the administration cost")
    pres_gain = any(
        r["net_change_usd"] > 0
        for r in grid
        if str(r["arrangement_id"]).startswith("preserved") and r["migration_at_equal_prices_pct"] == 30
    )
    # F6
    be = {(r["arrangement_id"], r["context_scenario_id"], r["lever"]): r for r in fl["csv_break_even"]}

    def be_words(a: str) -> str:
        parts = []
        for lever, what in (
            ("beer", "of households' beer"),
            ("spirits", "of their spirits"),
            ("additional", "more wine"),
        ):
            r = be[(a, "accounting_30", lever)]
            if r["status"] == "found":
                parts.append(f"{r['break_even_pct']:.1f}% {what}")
            elif r["status"] == "wrong_direction":
                parts.append(
                    "not by replacing spirits (that lowers receipts)"
                    if lever == "spirits"
                    else f"not by {lever}"
                )
            elif r["status"] == "unattainable_in_range":
                parts.append(f"not by {lever} within the tested range")
        return ", ".join(parts)

    pres_above = all(
        be[(a, "accounting_30", lv)]["status"] == "already_above"
        for a in PRESERVED
        for lv in ("beer", "spirits", "recapture", "additional")
    )
    # F8: largest swing.
    sens = [
        r
        for r in fl["csv_sensitivity"]
        if r["context_scenario_id"] == "accounting_30" and r["swing_usd"] is not None
    ]
    top = max(sens, key=lambda r: r["swing_usd"])
    top_pres = max((r for r in sens if r["arrangement_id"] in PRESERVED), key=lambda r: r["swing_usd"])
    top_red = max((r for r in sens if r["arrangement_id"] in REDUCED), key=lambda r: r["swing_usd"])
    # F9
    unchanged = sorted(
        {
            r["scenario_id"]
            for r in fl["csv_scenarios"]
            if r["total_alcohol_unchanged"] == "true" and r["arrangement_id"] in REDUCED + ["preserved_dabs"]
        }
    )
    unchanged_everywhere = sorted(
        s["id"]
        for s in fl["scenarios"]
        if all(flow_result(fl, a, s["id"])["total_alcohol_unchanged"] for a in every)
    )
    n_sc = len(fl["scenarios"])
    up = {a: sum(1 for s in fl["scenarios"] if flow_net(fl, a, s["id"]) > 0.5) for a in every}
    # F10: change per percentage point of substitution (constant pure alcohol).
    sub = fl["csv_substitution_grid"]

    def slope(bev: str) -> list[float]:
        out = []
        for a in every:
            pts = {
                r["share_replaced_pct"]: r["net_change_usd"]
                for r in sub
                if r["arrangement_id"] == a
                and r["beverage"] == bev
                and r["conversion_basis"] == "pure_alcohol"
            }
            out.append(pts[1.0] - pts[0.0])
        return out

    sb, ss = slope("beer"), slope("spirits")
    # F11: per 10 points of migration.
    mg = fl["csv_migration_grid"]
    hh = fl["base"]["wine"]["household"] * 100

    def per10(a: str) -> float:
        pts = {
            r["migration_pct"]: r["net_change_usd"]
            for r in mg
            if r["arrangement_id"] == a and abs(r["household_share_pct"] - hh) < 1e-6
        }
        return pts[20.0] - pts[10.0]

    p10 = {a: per10(a) for a in every}
    t = {
        "F1": (
            f"Model, illustrative: where grocery wine would come from; in the accounting case all {money(moved)[1:]} a year is wine households already buy at DABS",
            "Wine bought at grocers a year, valued at today's state-store prices, by source: A moved from DABS, B replacing beer, C replacing spirits, D now bought outside Utah, E additional. "
            "B to E are illustrative shares (no Utah evidence gives them); 30% of household DABS wine moves in every row. The sources do not depend on the design in these rows.",
        ),
        "F2": (
            f"Model, 30% moving at any price and nothing else changing: designs that preserve the state's collection change receipts by {money_range(pres)} a year; "
            f"the 20% DABS discount by {money(flow_net(fl, 'dabs_discount_20', 'accounting_30'))}, the 20% tax by {money(flow_net(fl, 'private_tax_20', 'accounting_30'))}",
            "Change in each state collection and cost, FY2025 $ a year; diamond: the net. Preserving the collection is a proposed design, not current law; "
            f"paying grocers then needs grocery prices {pct(min(paid), 0)}–{pct(max(paid), 0)} above the state store's. At today's price it leaves the grocer nothing (diagnostic).",
        ),
        "F3": (
            f"Model, per source: wine replacing beer at the same alcohol brings the state more than the beer it replaces under {len(beer_up)} of {len(every)} designs; "
            f"wine replacing spirits, under {len(spirits_up)} of {len(every)}",
            "Collections gained on the wine and lost on what it replaces, $ a year: 5% of households' beer or spirits replaced (same pure alcohol); "
            "wine equal to 2% of household DABS wine brought back from other states or added. Illustrative shares, not estimates.",
        ),
        "F4": (
            f"Model: more wine sold is not more alcohol; with 5% of households' beer replaced at the same alcohol, wine rises {wine_l / 1e6:.1f}M litres a year, "
            f"beer falls {beer_l / 1e6:.1f}M litres and pure alcohol does not change",
            "Change in litres of beverage and of pure alcohol bought by Utah households, by beverage, under four illustrative scenarios. "
            "Equal litres of wine for beer, or additional wine, do add alcohol.",
        ),
        "F5": (
            "Model, channel choice (illustrative straight lines): with the collection preserved the state gains while shoppers still move at the grocery price"
            + (
                f"; once none do, it is out only the {money(admin)[1:]} administration cost"
                if pres_gain
                else ""
            ),
            "State's annual change against the grocery price premium, 30% moving at equal prices. Each line: the premium at which nobody would move (none = a fixed 30%). "
            "Purchases that do not move are still made at DABS. Dashed: each design's own price.",
        ),
        "F6": (
            "Model, break-even at 30% moving: "
            + ("designs that preserve the collection need no change in purchases; " if pres_above else "")
            + f"the 20% DABS discount breaks even with {be_words('dabs_discount_20')}; the 20% tax with {be_words('private_tax_20')}",
            "Each lever alone, others at the accounting case. Beer and spirits replaced at the same pure alcohol (no more alcohol); recapture moves purchases into Utah; "
            "additional wine adds alcohol. Break-evens are thresholds, not forecasts.",
        ),
        "F7": (
            "Model: the less the state collects per bottle, and the more wine moves, the more substitution or new buying is needed to break even",
            "Break-even share, each lever alone. Left: DABS sells to grocers at a discount and grocers charge today's price (no discount keeps the full markup; the grocer's margin is the discount). "
            "Right: the 20% DABS discount with more or less moving.",
        ),
        "F8": (
            f"Model, sensitivity at 30% moving: for the preserved designs the result moves most with {lower_first(top_pres['parameter'])} (up to {money(top_pres['swing_usd'])[1:]}); "
            f"for the 20% designs with {lower_first(top_red['parameter'])} (up to {money(top_red['swing_usd'])[1:]})",
            "One stated input at a time at its low and high tested values (ranges, not confidence intervals); others at the accounting case. Inputs that do not apply to a design are left out.",
        ),
        "F9": (
            f"Model, every named scenario: the DABS-supplied preserved design raises receipts in {up['preserved_dabs']} of {n_sc}, the 20% DABS discount in {up['dabs_discount_20']}, the 20% tax in {up['private_tax_20']}",
            f"State's annual change. Filled marks: households buy the same total alcohol ({len(unchanged_everywhere)} scenarios, whatever the design); hollow: alcohol changes. "
            "Exploratory rows keep the old treatment (a market-wide elasticity on one channel; declined purchases not made) only to show its effect.",
        ),
        "F10": (
            f"Model: each 1% of households' beer replaced by wine at the same alcohol changes receipts by {money_range(sb)} a year; each 1% of their spirits by {money_range(ss)}",
            "On top of 30% moving. Wine collects the state's markup or charge and sales tax; beer only the excise and sales tax; spirits DABS's markup. "
            "Utah's rate of switching is not known: the lines show what each rate would mean.",
        ),
        "F11": (
            f"Model, the 30% share is not a forecast: each further 10 points moving changes receipts by {money_range([p10[a] for a in PRESERVED])} under preserved designs "
            f"and {money_range([p10[a] for a in REDUCED])} under the 20% designs",
            "Accounting case (nothing else changes) at every share moving; band: households' share of DABS purchases from 67% to 97% (82% assumed).",
        ),
    }
    t["_flow_facts"] = (f"admin={admin}; top_sensitivity={top['parameter_id']}", f"unchanged={unchanged}")
    return t


def check_titles(titles: dict[str, tuple[str, str]]) -> list[str]:
    errs = []
    for k, (a, b) in titles.items():
        if k.startswith("_"):
            continue
        text = f"{a} {b}".lower()
        errs += [f"{k}: forbidden wording {p!r}" for p in FORBIDDEN if p in text]
        if k[0] in "UF" and not a.startswith("Model"):
            errs.append(f"{k}: a Utah title must say it is a model")
        if k.startswith("T") and not a.startswith("Observed"):
            errs.append(f"{k}: a Tennessee title must say it is observed")
    return errs
