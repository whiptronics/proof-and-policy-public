"""Independent check of the Utah grocery-wine alternatives (web/src/lib/wineAlternatives.ts, wine-alternatives@1.0).

The TypeScript export (``npm --prefix web run export:grocery-wine``) writes data/processed/grocery-wine/
alternatives.json with each alternative's inputs and results. This script recomputes the fixed-volume results, the
price stack shares, the deposit changes and the constant-elasticity price response from those inputs with closed
forms written separately from the TypeScript, and compares. It also checks the closed forms on small examples worked
by hand. It does not compare copied headline numbers: every expected value is recomputed here.

Run:  python3 -B scripts/grocery_wine_alternatives_check.py [path/to/alternatives.json]
Exit 1 on any mismatch.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT = ROOT / "data" / "processed" / "grocery-wine" / "alternatives.json"
DEPOSIT = 0.10 + 0.01695


def closed_form(i: dict) -> dict:
    """Fixed-volume result of one alternative from its inputs (per year, and per $1 of today's pre-tax price)."""
    W, m, t = i["wine_sales"], i["gross_margin"], i["state_sales_tax"]
    S = W * i["household_share"] * i["share_moving"]
    v, N, hc = i["avoided_cost_per_dollar"], i["new_costs"], i["handling_cost_per_dollar"] or 0.0
    c = 1 - m
    w, g = i["wholesaler_margin"], i["retailer_margin_target"]
    matched = i["matched_price"]
    out: dict = {"S": S}
    if i["revenue_mode"] == "wholesale":
        d = i["discount"]
        shelf = 1.0 if matched else (1 - d) / (1 - g)
        base = shelf
        state_take = m - d  # DABS's trading margin per $ after
        out.update(margin_change=-d * S, charge=0.0, retailer_share=(shelf - (1 - d)) / shelf, sellers_together=shelf - (1 - d))
        lost_per_dollar = (m - d) + t * shelf - hc  # what each $ of grocery wine no longer bought takes with it
        out["funds_dabs_reading"] = -DEPOSIT * d * S
        out["funds"] = out["funds_dabs_reading"]
        out["funds_other_reading"] = -DEPOSIT * S
    else:
        own_target = c / ((1 - w) * (1 - g))
        if i["revenue_mode"] == "percent":
            a = i["charge_rate_on_price"]
            own = 1 / (1 + a) if matched else own_target
            per = a * own
            retail_price = own  # the grocer's price before the retail-level charge
        else:
            per = i["charge_per_gallon"] * i["wine_gallons"] / W
            own = 1 - per if matched else own_target
            retail_price = own + per  # a wholesaler-level charge is in the grocer's selling price
        shelf = own + per
        base = shelf if i["charge_in_sales_tax_base"] else own
        state_take = per
        out.update(margin_change=-m * S, charge=per * S, retailer_share=(own - c / (1 - w)) / retail_price, sellers_together=own - c)
        lost_per_dollar = per + t * base
        out["funds"] = -DEPOSIT * S
        out["funds_other_reading"] = None
    out["sales_tax_change"] = t * (base - 1) * S
    out["net"] = out["margin_change"] + out["charge"] + out["sales_tax_change"] + v * S - N - hc * S
    out["shelf"] = shelf
    out["consumer_change"] = (shelf + t * base) / (1 + t) - 1
    out["state_take_per_dollar"] = state_take
    out["lost_per_dollar"] = lost_per_dollar
    return out


def price_response_delta(i: dict, cf: dict, elasticity: float) -> float:
    """Constant elasticity on the wine that moves: (1 - shelf^e) of it is not bought."""
    lost = (1 - cf["shelf"] ** elasticity) * cf["S"]
    return -lost * cf["lost_per_dollar"]


def hand_examples() -> list[str]:
    """Closed forms on $100 of wine, 50% margin, 5% tax, $20 moving, 3 cents avoided, $1 new costs (worked by hand)."""
    base = dict(wine_sales=100, wine_gallons=10, gross_margin=0.5, state_sales_tax=0.05, household_share=1, share_moving=0.2, avoided_cost_per_dollar=0.03, new_costs=1, handling_cost_per_dollar=0, wholesaler_margin=0.2, retailer_margin_target=0.28, charge_in_sales_tax_base=True)
    errs = []

    def want(name, got, exp, tol=1e-9):
        if abs(got - exp) > tol:
            errs.append(f"hand example {name}: {got} != {exp}")

    dabs = closed_form({**base, "revenue_mode": "wholesale", "discount": 0.1, "matched_price": True})
    want("DABS 10% matched", dabs["net"], -2.4)
    want("DABS 10% deposits", dabs["funds"], -0.11695 * 2)
    tgt = closed_form({**base, "revenue_mode": "wholesale", "discount": 0.1, "matched_price": False})
    want("DABS 10%, 28% target: price", tgt["shelf"], 1.25)
    want("DABS 10%, 28% target: net", tgt["net"], -2.15)
    zero = closed_form({**base, "revenue_mode": "wholesale", "discount": 0.0, "matched_price": True})
    want("zero discount", zero["net"], -0.4)
    zz = closed_form({**base, "revenue_mode": "wholesale", "discount": 0.0, "matched_price": True, "avoided_cost_per_dollar": 0})
    want("zero discount, zero savings", zz["net"], -1.0)
    priv = closed_form({**base, "revenue_mode": "percent", "charge_rate_on_price": 0.25, "matched_price": True})
    want("private 25% matched", priv["net"], -6.4)
    out = closed_form({**base, "revenue_mode": "percent", "charge_rate_on_price": 0.25, "matched_price": True, "charge_in_sales_tax_base": False})
    want("private 25% outside base", out["net"], -6.6)
    noshift = closed_form({**base, "revenue_mode": "wholesale", "discount": 0.1, "matched_price": True, "share_moving": 0})
    want("no wine moves", noshift["net"], -1.0)
    want("20% on base is 1/6 of the inclusive price", 0.2 / 1.2, 1 / 6)
    want("88.5% markup is a 46.95% margin", 0.885 / 1.885, 0.46949602, 1e-8)
    return errs


def check(path: Path) -> list[str]:
    data = json.loads(path.read_text(encoding="utf-8"))
    errs: list[str] = []
    el = data["elasticity"]
    for a in data["alternatives"]:
        i, cf = a["inputs"], closed_form(a["inputs"])
        led = a["ledger_fixed"]
        lines = {k["id"]: k["value"] for k in led["lines"]}

        def want(name, got, exp, tol, aid=a["id"]):
            if got is None or exp is None:
                if got is not exp:
                    errs.append(f"{aid} {name}: {got} vs {exp}")
            elif abs(got - exp) > tol:
                errs.append(f"{aid} {name}: export {got:.6f}, closed form {exp:.6f}")

        want("net", led["net"], cf["net"], 1.0)
        want("trading margin", lines["dabs_trading_margin"], cf["margin_change"], 1.0)
        want("state charge", lines["state_charge"], cf["charge"], 1.0)
        want("sales tax", lines["state_sales_tax"], cf["sales_tax_change"], 1.0)
        want("shelf price", a["price_stack"]["after"]["shelf"], cf["shelf"], 1e-9)
        want("consumer price change", a["price_stack"]["consumerChange"], cf["consumer_change"], 1e-9)
        want("retailer share", a["retailer"]["marginShare"], cf["retailer_share"], 1e-9)
        want("sellers together", a["retailer"]["sellersTogether"], cf["sellers_together"], 1e-9)
        if a["retailer"]["arithmeticOnly"] != (cf["retailer_share"] < -1e-9 or cf["sellers_together"] < -1e-9):
            errs.append(f"{a['id']}: below-cost flag disagrees with the closed form")
        want("funds", led["allocations"]["funds"], cf["funds"], 1.0)
        other = a.get("ledger_fixed_no_deposits_on_grocer_sales")
        if cf["funds_other_reading"] is not None:
            want("funds, other reading", other["allocations"]["funds"], cf["funds_other_reading"], 1.0)
        want("funds + others = net", led["allocations"]["funds"] + led["allocations"]["others"], led["net"], 0.01)
        want("no avoidable cost", a["zero_savings_net"], cf["net"] - i["avoided_cost_per_dollar"] * cf["S"], 1.0)
        rc = a["reconciliation"]
        want("reconciliation", rc["tradingMargin"] + rc["taxes"]["total"] + rc["avoidableCosts"] + rc["newCosts"], cf["net"], 1.0)
        pc = next(d for d in a["demand"] if d["id"] == "price_constant")
        want("price response", pc["delta"], price_response_delta(i, cf, el), 1.0)
        if not led["reconciles"]:
            errs.append(f"{a['id']}: the export's ledger does not reconcile")
    for ref, row in data["reference_check"].items():
        if not row["unchanged"]:
            errs.append(f"{ref} no longer reproduces the published result")
    return errs


# ----- the grocery price premium x grocery share grid (wine-price-share@1.0) ------------------------------------------
GRID_DEFAULT = DEFAULT.parent / "price_share.json"


def grid_closed_form(arr: dict, i: dict, premium: float, share: float, avoided: float, elasticity: float | None) -> dict:
    """One grid cell from the alternative's inputs: the lever held fixed, the consumer premium and the share chosen.

    The charge (private supply) is inside the sales-tax base in every grid arrangement, so the shelf price before checkout
    taxes is 1 + premium per $1 of today's price. Elasticity None: fixed volume; a number: constant-elasticity response
    on the wine that moves, the lost purchases leaving the market (not returning to DABS).
    """
    W, m, t, h = i["wine_sales"], i["gross_margin"], i["state_sales_tax"], i["household_share"]
    N, hc, w = i["new_costs"], i["handling_cost_per_dollar"] or 0.0, arr.get("wholesaler_margin", 0.295)
    c = 1 - m
    S = W * h * share
    r = 1 + premium
    lever = arr["lever"]["value"]
    q = 1.0 if elasticity is None else r**elasticity
    if arr["supply"] == "dabs":
        d = lever
        k = -d + t * (r - 1) + avoided - hc
        lost_per_dollar = (m - d) + t * r - hc
        grocer = 1 - (1 - d) / r
        sellers = r - (1 - d)
        sellers_share = sellers / r
        funds = -DEPOSIT * (S - (1 - d) * q * S)
        funds_other = -DEPOSIT * S
    else:
        a = lever
        own = r / (1 + a)
        k = -m + a * own + t * (r - 1) + avoided
        lost_per_dollar = a * own + t * r
        grocer = (own - c / (1 - w)) / own
        sellers = own - c
        sellers_share = sellers / own
        funds = -DEPOSIT * S
        funds_other = None
    net = S * k - N - (1 - q) * S * lost_per_dollar
    breakeven = None if k <= 0 else N / (W * h * k)
    return dict(S=S, net=net, k=k, grocer=grocer, sellers=sellers, sellers_share=sellers_share, funds=funds, funds_other=funds_other, breakeven=breakeven, grocery=q * S)


def grid_position(grocer: float, sellers: float, target: float) -> str:
    if grocer < -1e-9 or sellers < -1e-9:
        return "below_cost"
    if abs(grocer) < 1e-9:
        return "at_cost"
    return "below_reference" if grocer < target - 1e-9 else "reference_or_above"


def grid_hand_examples() -> list[str]:
    """$100 of wine, 50% margin, 5% tax, all purchases household, $1 new costs, 3 cents avoided (worked by hand)."""
    i = dict(wine_sales=100, gross_margin=0.5, state_sales_tax=0.05, household_share=1, new_costs=1, handling_cost_per_dollar=0)
    errs = []

    def want(name, got, exp, tol=1e-9):
        if abs(got - exp) > tol:
            errs.append(f"grid hand example {name}: {got} != {exp}")

    dabs10 = {"supply": "dabs", "lever": {"value": 0.1}}
    g = grid_closed_form(dabs10, i, 0.2, 0.2, 0.03, None)
    want("DABS 10%, 20% premium, 20% share: net", g["net"], 20 * (-0.1 + 0.05 * 0.2 + 0.03) - 1)
    want("DABS 10%, 20% premium: grocer margin", g["grocer"], 1 - 0.9 / 1.2)
    want("DABS 10%: deposits on its sales to grocers", g["funds"], -0.11695 * 0.1 * 20)
    zero = grid_closed_form(dabs10, i, 0.2, 0.0, 0.03, None)
    want("no wine moves: only the new costs", zero["net"], -1.0)
    dabs0 = {"supply": "dabs", "lever": {"value": 0.0}}
    be = grid_closed_form(dabs0, i, 0.2, 0.2, 0.03, None)
    want("DABS at today's price, 20% premium: break-even share", be["breakeven"], 1 / (100 * (0.05 * 0.2 + 0.03)))
    priv = {"supply": "private", "lever": {"value": 0.25}, "wholesaler_margin": 0.2}
    p = grid_closed_form(priv, i, 0.25, 0.2, 0.03, None)
    want("private 25% charge, 25% premium: net", p["net"], 20 * (-0.5 + 0.25 * 1.0 + 0.05 * 0.25 + 0.03) - 1)
    want("private: grocer margin after a 20% wholesaler", p["grocer"], (1.0 - 0.5 / 0.8) / 1.0)
    want("private: sellers together", p["sellers"], 0.5)
    lost = grid_closed_form(dabs0, i, 0.21, 0.2, 0.03, -1.0)
    want("unit elasticity: grocery wine falls to 1/1.21 of what moved", lost["grocery"], 20 / 1.21)
    return errs


def check_grid(path: Path, alternatives: Path) -> list[str]:
    grid = json.loads(path.read_text(encoding="utf-8"))
    alts = {a["id"]: a for a in json.loads(alternatives.read_text(encoding="utf-8"))["alternatives"]}
    errs: list[str] = []
    target = grid["reference_margin"]
    arrs = {a["id"]: {**a, "wholesaler_margin": grid["wholesaler_margin"]} for a in grid["arrangements"]}
    el = None
    for asm in grid["assumptions"]:
        if asm["id"] == "U15":
            el = float(asm["value"])
    if el is None:
        errs.append("price_share.json: no elasticity (U15)")
        return errs
    prices = {(p["arrangement"], round(p["premium"], 9)): p for p in grid["prices"]}
    if grid["handling_cost_per_dollar"] != 0:
        errs.append("handling cost is no longer the zero placeholder: update the check")

    def want(name, got, exp, tol):
        if got is None or exp is None:
            if got is not exp:
                errs.append(f"{name}: {got} vs {exp}")
        elif abs(got - exp) > tol:
            errs.append(f"{name}: export {got:.9f}, closed form {exp:.9f}")

    for c in grid["cells"]:
        arr = arrs[c["arrangement"]]
        i = alts[arr["alt"]]["inputs"]
        avoided = i["avoided_cost_per_dollar"] if c["savings"] == "source_based" else 0.0
        cf = grid_closed_form(arr, i, c["premium"], c["share"], avoided, el if c["volume"] == "price_response" else None)
        tag = f"{c['arrangement']} {c['savings']} {c['volume']} p={c['premium']:.2f} s={c['share']:.1f}"
        want(f"{tag} net", c["net"], cf["net"], 1.0)
        want(f"{tag} moved", c["movedDollars"], cf["S"], 1.0)
        want(f"{tag} grocery wine", c["groceryDollars"], cf["grocery"], 1.0)
        want(f"{tag} funds", c["funds"], cf["funds"], 1.0)
        if cf["funds_other"] is not None:
            want(f"{tag} funds, other reading", c["fundsOtherReading"], cf["funds_other"], 1.0)
        want(f"{tag} funds + others = net", c["funds"] + c["others"], c["net"], 0.01)
        if not c["reconciles"]:
            errs.append(f"{tag}: the ledger does not reconcile")
    for (aid, prem), p in prices.items():
        arr = arrs[aid]
        cf = grid_closed_form(arr, alts[arr["alt"]]["inputs"], prem, 0.3, 0.0, None)
        want(f"{aid} p={prem:.2f} shelf", p["shelf"], 1 + prem, 1e-9)
        want(f"{aid} p={prem:.2f} grocer margin", p["grocerMargin"], cf["grocer"], 1e-9)
        want(f"{aid} p={prem:.2f} sellers together", p["sellersTogether"], cf["sellers"], 1e-9)
        if p["position"] != grid_position(cf["grocer"], cf["sellers"], target):
            errs.append(f"{aid} p={prem:.2f}: position {p['position']} != {grid_position(cf['grocer'], cf['sellers'], target)}")
    for b in grid["share_break_evens"]:
        if b["volume"] != "fixed_volume":
            continue
        arr = arrs[b["arrangement"]]
        i = alts[arr["alt"]]["inputs"]
        avoided = i["avoided_cost_per_dollar"] if b["savings"] == "source_based" else 0.0
        cf = grid_closed_form(arr, i, b["premium"], 0.3, avoided, None)
        tag = f"{b['arrangement']} {b['savings']} p={b['premium']:.2f} break-even share"
        if cf["breakeven"] is None:
            if b["status"] != "never":
                errs.append(f"{tag}: status {b['status']}, closed form: never")
        else:
            want(tag, b["share"], cf["breakeven"], 1e-9)
    for r in grid["references"]:
        if not r["matches"]:
            errs.append(f"reference {r['altId']} is not reproduced on its grid")
        want(f"reference {r['altId']}", r["gridNet"], alts[r["altId"]]["ledger_fixed"]["net"], 0.01)
    for b in grid["receipts_preserved_at_worked_share"]:
        arr = arrs[b["arrangement"]]
        i = alts[arr["alt"]]["inputs"]
        avoided = i["avoided_cost_per_dollar"] if b["savings"] == "source_based" else 0.0
        resp = el if b["volume"] == "price_response" else None
        tag = f"{b['arrangement']} {b['savings']} {b['volume']} receipts preserved"
        for r in b["ranges"]:
            ends = [r["from"]] + ([r["to"]] if r["to"] is not None else [])
            for end in ends:
                net = grid_closed_form(arr, i, end, b["share"], avoided, resp)["net"]
                if end == 0:
                    if net < -1.0:
                        errs.append(f"{tag}: starts at 0% but the closed form loses {net:.2f} there")
                else:
                    want(f"{tag} boundary {end:.4f}", net, 0.0, 1.0)
            mid = (r["from"] + (r["to"] if r["to"] is not None else 1.0)) / 2
            if grid_closed_form(arr, i, mid, b["share"], avoided, resp)["net"] < -1.0:
                errs.append(f"{tag}: the closed form loses inside the range at {mid:.4f}")
        if not b["ranges"]:
            for prem in (0.0, 0.25, 0.5, 0.75, 1.0):
                if grid_closed_form(arr, i, prem, b["share"], avoided, resp)["net"] >= 0:
                    errs.append(f"{tag}: none reported, but the closed form keeps receipts at {prem:.2f}")
    return errs


def main() -> int:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT
    errs = hand_examples() + grid_hand_examples()
    if not path.exists():
        print(f"{path} not found: run `npm --prefix web run export:grocery-wine` first")
        return 1
    errs += check(path)
    data = json.loads(path.read_text(encoding="utf-8"))
    n = len(data["alternatives"])
    grid_path = path.parent / "price_share.json"
    if not grid_path.exists():
        errs.append(f"{grid_path} not found: run `npm --prefix web run export:grocery-wine`")
        cells = 0
    else:
        errs += check_grid(grid_path, path)
        cells = len(json.loads(grid_path.read_text(encoding="utf-8"))["cells"])
    if errs:
        print("\n".join(errs))
        print(f"FAILED: {len(errs)} mismatches")
        return 1
    print(f"hand examples OK; {n} alternatives and {cells} price-and-share cells recomputed independently and agree with the export ({data['methods']['alternatives']}, commit {data['project_commit']})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
