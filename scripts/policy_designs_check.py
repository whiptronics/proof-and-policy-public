"""Independent check of the policy design comparison (web/src/lib/policyDesigns.ts, policy-designs@1.0).

The TypeScript export (``npm --prefix web run export:grocery-wine``) writes data/processed/grocery-wine/
policy_designs.json and policy_designs_*.csv next to the alternatives' own files. This script recomputes every number
the design comparison reports. It starts from the base terms in that file (wine sales, household share, the share that
moves, DABS's margin, sales tax and the new administration) and uses closed forms written separately from the
TypeScript. It then checks:

* the base terms are consistent: landed cost plus margin is the shelf price, and moved wine is wine x households x share;
* the fixed-share results of B, C and D against the alternatives' own export (alternatives_summary.csv and
  producer_direct_grid.csv), with and without savings;
* every channel-choice case (straight line to the convenience limit), with fees, from the fixed-share result and the
  engine's linearity in the share that moves;
* the hybrid, from B's and C's parts;
* the break-even participation and the minimum premiums at the reference grocer margin;
* every frontier point, the frontier at the reference margin, and the distribution margin that matches B;
* the bottle basket, the money flows adding up to the consumer price, the classification and the Pareto set.

A passing check verifies the arithmetic only. It says nothing about whether any behavioral input is right: the shares
that move, the convenience limits and the administration cost are illustrative.

Run:  python -B scripts/policy_designs_check.py [path/to/policy_designs.json]
Exit 1 on any mismatch.
"""

from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT = ROOT / "data" / "processed" / "grocery-wine" / "policy_designs.json"
TOL_USD = 0.05
TOL = 1e-9


class Checker:
    def __init__(self) -> None:
        self.n = 0
        self.bad: list[str] = []

    def close(self, what: str, got, want, tol: float) -> None:
        self.n += 1
        if got is None or want is None or abs(got - want) > tol:
            self.bad.append(f"{what}: got {got}, expected {want}")

    def true(self, what: str, ok: bool) -> None:
        self.n += 1
        if not ok:
            self.bad.append(what)


# ----- closed forms (written from the definitions, not from the TypeScript) ---------------------------------------------


def state_change_per_dollar_dabs(P, g, c, M, t, v, a):
    """DABS supply: the grocer pays DABS P(1 - g); DABS keeps that less its landed cost; it kept M before."""
    paid_to_dabs = P * (1 - g)
    return (paid_to_dabs - c) - M + t * (P - 1) + v - a


def max_margin_dabs(P, c, M, t, v, a):
    need = c + M - t * (P - 1) - v + a  # what the grocer must pay DABS for the state to break even
    return 1 - need / P


def max_margin_charge(P, w, c, M, t, v, a):
    q_max = P - M + t * (P - 1) + v - a  # the highest sellers' price before the charge that still covers the state
    return 1 - c / ((1 - w) * q_max) if q_max > 0 else float("-inf")


def min_price_dabs(g, c, M, t, v, a):
    return (c + M + t - v + a) / (1 - g + t)


def min_price_charge(g, w, c, M, t, v, a):
    q = c / ((1 - w) * (1 - g))
    return (q + M + t - v + a) / (1 + t)


def moving(base, premium, limit):
    if limit is None or premium <= 0:
        return base
    return base * min(1.0, max(0.0, 1 - premium / limit))


def hand_examples(ck: Checker) -> None:
    # A $1 bottle with landed cost 0.5 and DABS margin 0.5, no tax, savings or administration: a grocer margin of 1/3
    # at a price of 1.5 leaves DABS exactly its 0.5.
    ck.close("hand: DABS margin at P=1.5", max_margin_dabs(1.5, 0.5, 0.5, 0, 0, 0), 1 / 3, TOL)
    ck.close("hand: DABS price for g=1/3", min_price_dabs(1 / 3, 0.5, 0.5, 0, 0, 0), 1.5, TOL)
    # Retail charge, no distribution: sellers' price 0.5/(1-g); the charge is P less that; break-even at charge = 0.5.
    ck.close("hand: charge margin at P=1.25", max_margin_charge(1.25, 0, 0.5, 0.5, 0, 0, 0), 1 - 0.5 / 0.75, TOL)
    ck.close("hand: charge price for g=1/3", min_price_charge(1 / 3, 0, 0.5, 0.5, 0, 0, 0), 1.25, TOL)
    ck.close("hand: straight-line share", moving(0.3, 0.15, 0.6), 0.225, TOL)


def main() -> int:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT
    folder = path.parent
    d = json.loads(path.read_text(encoding="utf-8"))
    ck = Checker()
    hand_examples(ck)

    T = d["terms"]
    c, M, t, admin = T["landed"], T["margin"], T["salesTax"], T["admin"]
    s0, moved0 = T["shift"], T["moved"]
    ck.close("landed cost + margin = today's shelf price", c + M, 1.0, TOL)
    ck.close("moved = wine x households x share", moved0, T["wine"] * T["household"] * s0, 1e-4 * moved0)
    a = admin / moved0
    cases = {s["id"]: s["perDollar"]["shortRun"] + s["perDollar"]["conditional"] for s in d["savings_cases"]}
    ck.close("no-savings case is zero", cases["none"], 0.0, 0)

    res = {r["def"]["id"]: r for r in d["results"]}

    def case(r, s, limit):
        return next(x for x in r["cases"] if x["savings"] == s and x["limit"] == limit)

    # Fixed-share results against the alternatives' own export.
    summary = {row["alternative_id"]: row for row in csv.DictReader((folder / "alternatives_summary.csv").open(encoding="utf-8"))}
    for des, alt in (("B", "A_target"), ("C", "C_take")):
        row = summary[alt]
        ck.close(f"{des} = {alt}, no savings", case(res[des], "none", None)["net"], float(row["state_change_no_avoidable_cost_usd"]), TOL_USD)
        ck.close(f"{des} = {alt}, allocated savings", case(res[des], "allocated", None)["net"], float(row["state_change_fixed_volume_usd"]), TOL_USD)
        ck.close(f"{des} premium", res[des]["premium"] * 100, float(row["consumer_price_change_pct_vs_state_store"]), 1e-6)
    grid = list(csv.DictReader((folder / "producer_direct_grid.csv").open(encoding="utf-8")))
    main_d = next(g for g in grid if g["main_case"] == "true")
    ck.close("D premium = producer-direct main case", res["D"]["premium"] * 100, float(main_d["consumer_price_change_pct_vs_state_store"]), 1e-6)
    ck.close("D allocated = producer-direct main case", case(res["D"], "allocated", None)["net"], float(main_d["state_change_fixed_volume_usd"]), TOL_USD)
    ck.close("allocated saving per $ = card + agency + bags over sales", cases["allocated"], 12_557_000 / 551_346_000, 1e-12)

    # Channel choice, fees and break-even participation, from linearity in the share that moves.
    for des in ("B", "C", "D"):
        r = res[des]
        for s in cases:
            fixed_net = case(r, s, None)["net"]
            per_share = (fixed_net + admin) / s0
            for limit in [None, *d["convenience_limits"]]:
                x = case(r, s, limit)
                sh = moving(s0, r["premium"], limit)
                ck.close(f"{des} {s} {limit} share", x["shift"], sh, 1e-12)
                ck.close(f"{des} {s} {limit} net", x["net"], per_share * sh - admin, TOL_USD)
                ck.close(f"{des} {s} {limit} net with fees", x["netWithFees"], per_share * sh, TOL_USD)
                ck.close(f"{des} {s} {limit} moved", x["moved"], moved0 * sh / s0, 1e-3)
            want = min(1.0, admin / per_share) if per_share > 0 else None
            got = r["breakEven"]["minShift"][s]
            if want is None:
                ck.true(f"{des} {s} min share is none", got is None)
            else:
                ck.close(f"{des} {s} min share", got, want, 1e-9)
        # Flows add to the consumer price.
        ck.close(f"{des} flows today add to 1 + tax", sum(f["perDollar"] for f in r["flows"]["today"]), 1 + t, 1e-12)
        ck.close(f"{des} flows after add to the consumer price", sum(f["perDollar"] for f in r["flows"]["after"]), (1 + r["premium"]) * (1 + t), 1e-9)
        for b in r["basket"]:
            ck.close(f"{des} basket {b['id']} state store", b["stateStore"], b["landed"] / c * (1 + t), 1e-9)
            ck.close(f"{des} basket {b['id']} grocery", b["grocery"], b["stateStore"] * (1 + r["premium"]), 1e-9)

    # Minimum premiums at the reference grocer margin and the frontier.
    g_ref = 0.28
    w_ref = res["C"]["distribution"]
    for s, v in cases.items():
        ck.close(f"B {s} min premium", res["B"]["breakEven"]["minPremiumAtReference"][s], min_price_dabs(g_ref, c, M, t, v, a) - 1, 1e-9)
        for des in ("C", "D"):
            ck.close(f"{des} {s} min premium", res[des]["breakEven"]["minPremiumAtReference"][s], min_price_charge(g_ref, res[des]["distribution"], c, M, t, v, a) - 1, 1e-9)
    ck.close("B margin at 10%", res["B"]["breakEven"]["grocerMarginAt10"], max_margin_dabs(1.1, c, M, t, 0, a), 1e-9)
    v_alloc = cases["allocated"]
    for p in d["frontier"]:
        P = 1 + p["premium"]
        ck.close(f"frontier {p['premium']:.3f} wholesale", p["wholesalePrice"], max_margin_dabs(P, c, M, t, 0, a), 1e-9)
        ck.close(f"frontier {p['premium']:.3f} charge ref", p["retailChargeReference"], max_margin_charge(P, w_ref, c, M, t, 0, a), 1e-9)
        ck.close(f"frontier {p['premium']:.3f} charge free", p["retailChargeNoDistribution"], max_margin_charge(P, 0, c, M, t, 0, a), 1e-9)
        ck.close(f"frontier {p['premium']:.3f} wholesale alloc", p["wholesalePriceAllocated"], max_margin_dabs(P, c, M, t, v_alloc, a), 1e-9)
        ck.close(f"frontier {p['premium']:.3f} charge ref alloc", p["retailChargeReferenceAllocated"], max_margin_charge(P, w_ref, c, M, t, v_alloc, a), 1e-9)
        # At the frontier the state's change is zero (DABS structure written as a change, not a margin).
        g = p["wholesalePrice"]
        ck.close(f"frontier {p['premium']:.3f} breaks even", state_change_per_dollar_dabs(P, g, c, M, t, 0, a), 0.0, 1e-12)
    ref = d["frontierAtReference"]
    ck.close("frontier at reference, wholesale", ref["wholesalePrice"], min_price_dabs(g_ref, c, M, t, 0, a) - 1, 1e-9)
    ck.close("frontier at reference, charge", ref["retailChargeReference"], min_price_charge(g_ref, w_ref, c, M, t, 0, a) - 1, 1e-9)
    ck.close("frontier at reference, free distribution", ref["retailChargeNoDistribution"], min_price_charge(g_ref, 0, c, M, t, 0, a) - 1, 1e-9)
    P_b = 1 + ref["wholesalePrice"]
    room = P_b - M + t * (P_b - 1) - a
    ck.close("distribution margin that matches B", d["distributionToMatchB"], 1 - c / ((1 - g_ref) * room), 1e-9)

    # Hybrid from its parts.
    h, extra = d["hybrid"]["dabs_share"], d["hybrid"]["extra_admin_share"] * admin
    for s in cases:
        for limit in [None, *d["convenience_limits"]]:
            part = 0.0
            for des, share in (("B", h), ("C", 1 - h)):
                per_share = (case(res[des], s, None)["net"] + admin) / s0
                part += per_share * share * moving(s0, res[des]["premium"], limit)
            ck.close(f"E {s} {limit}", case(res["E"], s, limit)["net"], part - admin - extra, TOL_USD)

    # Classification under the stated constraints, and the Pareto set.
    cons = d["constraints"]
    for des in ("B", "C", "D", "E"):
        r = res[des]
        nos = [x for x in r["cases"] if x["savings"] == "none"]
        fiscal_fixed = case(r, "none", None)["net"] >= -0.5
        fiscal_choice = all(x["net"] >= -0.5 for x in nos)
        fiscal_saved = all(x["net"] >= -0.5 for x in r["cases"] if x["savings"] == "allocated")
        price = r["premium"] <= cons["maxPremium"] + 1e-9
        margin = r["grocerMargin"] is not None and not r["sellersBelowCost"] and r["grocerMargin"] >= cons["minGrocerMargin"] - 1e-9
        if fiscal_choice and price and margin:
            want = "meets"
        elif (fiscal_fixed or fiscal_saved) and price and margin:
            want = "meets_under_assumptions"
        else:
            want = "fails"
        if des == "D":
            ok = [g["premium"] <= cons["maxPremium"] + 1e-9 and g["net"] >= -0.5 for g in d["direct"]]
            if any(ok) and not all(ok):
                want = "cannot_be_determined"
        ck.true(f"{des} classification {d['classification'][des]['verdict']} (expected {want})", d["classification"][des]["verdict"] == want)
    pts = [(k, case(res[k], "none", 0.3)["net"], res[k]["premium"], res[k]["grocerMargin"]) for k in ("B", "C", "D", "E")]

    def beats(p, q):
        ge = p[1] >= q[1] - 0.5 and p[2] <= q[2] + 1e-9 and p[3] >= q[3] - 1e-9
        gt = p[1] > q[1] + 0.5 or p[2] < q[2] - 1e-9 or p[3] > q[3] + 1e-9
        return ge and gt

    front = [p[0] for p in pts if not any(q is not p and beats(q, p) for q in pts)]
    ck.true(f"Pareto set {d['pareto']} (expected {front})", d["pareto"] == front)

    print(f"policy designs check: {ck.n} checks, {len(ck.bad)} failed ({path})")
    for b in ck.bad[:40]:
        print("  FAIL", b)
    return 1 if ck.bad else 0


if __name__ == "__main__":
    sys.exit(main())
