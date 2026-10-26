"""Independent check of the grocery-wine purchase flows (web/src/lib/wineFlows.ts, wine-purchase-flows@1.0).

The TypeScript export (``npm --prefix web run export:grocery-wine``) writes data/processed/grocery-wine/flows.json
with the base year, each arrangement's per-bottle terms, every named scenario's inputs and results, and the flows_*.csv
tables. This script recomputes the results from those inputs with closed forms written separately from the
TypeScript: each state collection and cost is changed component by component, not built from before-and-after totals
as the TypeScript does. It then checks:

* every named scenario (net, gross, each collection and cost, deposits, alcohol, the origin split);
* the CSV tables against the JSON and against the identities (collections add to gross, gross less costs is net,
  allocations are not added, lines add to the net change);
* the substitution, migration and price grids;
* every break-even value, from the closed form's own linear solution (the net change is linear in each lever);
* the sensitivity rows that change only stated inputs or the base year.

It also checks the closed forms on small examples worked by hand. A passing check verifies the arithmetic only: it
says nothing about whether any behavioural assumption is right.

Run:  python3 -B scripts/grocery_wine_flows_check.py [path/to/flows.json]
Exit 1 on any mismatch.
"""

from __future__ import annotations

import csv
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT = ROOT / "data" / "processed" / "grocery-wine" / "flows.json"
TOL = 0.01  # dollars
L_GAL = 3.785411784


def _f(v):
    return None if v in ("", None) else float(v)


def changes(base: dict, a: dict, x: dict) -> dict:
    """Changes in state collections, costs and quantities for one arrangement under one set of flow inputs."""
    w, s, hb, br = base["wine"], base["spirits"], base["heavyBeer"], base["beer"]
    t = base["salesTax"]
    active = a["supply"] != "none"
    H = w["value"] * w["household"]
    prem = a["consumerRatio"] - 1
    m0 = x["migration"] if active else 0.0
    lim = x["convenienceLimit"]
    if not active:
        m = 0.0
    elif lim is None or prem <= 0:
        m = m0
    else:
        m = m0 * min(1.0, max(0.0, 1 - prem / lim))
    declined = (m0 - m) * H
    keep = 1.0 if (not active or x["migrantResponse"] is None) else a["shelf"] ** x["migrantResponse"]
    from_dabs = m * H * keep  # origin A at grocers

    def sub(k):
        f = x[k]
        if not active:
            return 0.0, f
        return f["participation"] * f["intensity"] * f["weight"], f

    rb, fb = sub("beer")
    rs, fs = sub("spirits")
    beer_pa = rb * br["litres"] * br["household"] * br["abv"]
    heavy_l = beer_pa * x["beer"]["heavyShare"] / hb["abv"]
    beer_l = beer_pa * (1 - x["beer"]["heavyShare"]) / br["abv"]
    spirits_pa = rs * s["litres"] * s["household"] * s["abv"]
    spirits_l = spirits_pa / s["abv"]

    def wine_litres(pa, litres, spend, f):
        if f["basis"] == "pure_alcohol":
            return pa / w["abv"]
        if f["basis"] == "volume":
            return litres
        g = f["grocery"]
        return spend / (w["price"] * (g * a["shelf"] + 1 - g))

    WB = wine_litres(beer_pa, beer_l + heavy_l, beer_l * br["price"] + heavy_l * hb["price"], fb) * w["price"]
    WC = wine_litres(spirits_pa, spirits_l, spirits_l * s["price"], fs) * w["price"]
    WD = x["recapture"]["share"] * H if active else 0.0
    WE = x["additional"]["share"] * H if active else 0.0
    gb, gs, gd, ge = fb["grocery"], fs["grocery"], x["recapture"]["grocery"], x["additional"]["grocery"]
    grocery = from_dabs + gb * WB + gs * WC + gd * WD + ge * WE
    d_store = (
        -m0 * H
        + declined * x["declined"]["dabs"]
        + (1 - gb) * WB
        + (1 - gs) * WC
        + (1 - gd) * WD
        + (1 - ge) * WE
    )
    d_spirits = -spirits_l * s["price"]
    d_heavy = -heavy_l * hb["price"]
    declined_beer_l = declined * x["declined"]["beer"] / w["price"] * w["abv"] / br["abv"]
    d_beer_l = -beer_l + declined_beer_l
    dabs_supply = a["supply"] == "dabs"
    c = a["stateCollection"]
    col = {
        "dabsWineMarkup": w["margin"] * d_store + (c * grocery if dabs_supply else 0.0),
        "replacementCharge": c * grocery if a["supply"] == "private" else 0.0,
        "dabsSpiritsMarkup": s["margin"] * d_spirits,
        "dabsHeavyBeerMarkup": hb["margin"] * d_heavy,
        "beerExcise": br["excisePerLitre"] * (d_beer_l - heavy_l),  # the excise covers heavy beer too
        "salesTax": t
        * (d_store + a["salesTaxBase"] * grocery + d_spirits + d_heavy + d_beer_l * br["price"]),
        "licenseReceipts": x["costs"]["licenseReceipts"] if active else 0.0,
    }
    d_dabs_sales = d_store + d_spirits + d_heavy
    cst = {
        "dabsVariableStoreCosts": x["costs"]["variable"] * d_dabs_sales,
        "handling": x["costs"]["handling"] * grocery if dabs_supply else 0.0,
        "admin": x["costs"]["admin"] if active else 0.0,
        "restructuringSavings": -x["costs"]["restructuring"] * max(0.0, -d_dabs_sales) if active else 0.0,
    }
    gross = sum(col.values())
    costs = sum(cst.values())
    rate = base["rates"]["school"] + base["rates"]["enforcement"]
    dep_counts = rate * (d_dabs_sales + (a["dabsRevenuePerDollar"] * grocery if dabs_supply else 0.0))
    dep_excl = rate * d_dabs_sales
    wine_pa = (d_store + grocery) / w["price"] * w["abv"]
    pa_in = wine_pa + d_beer_l * br["abv"] - heavy_l * hb["abv"] - spirits_l * s["abv"]
    pa_out = (-WD + declined * x["declined"]["outOfState"]) / w["price"] * w["abv"]
    origins = {
        "A": (from_dabs, 0.0),
        "B": (gb * WB, (1 - gb) * WB),
        "C": (gs * WC, (1 - gs) * WC),
        "D": (gd * WD, (1 - gd) * WD),
        "E": (ge * WE, (1 - ge) * WE),
    }
    return {
        "migration_used": m,
        "collections": col,
        "costs_by": cst,
        "gross": gross,
        "costs": costs,
        "net": gross - costs,
        "deposits": {"countsGrocerSales": dep_counts, "excludesGrocerSales": dep_excl},
        "grocery": grocery,
        "alcohol": {"inUtah": pa_in, "outsideUtah": pa_out, "total": pa_in + pa_out},
        "origins": origins,
    }


def set_lever(x: dict, lever: str, v: float) -> dict:
    y = json.loads(json.dumps(x))
    if lever in ("additional", "recapture"):
        y[lever]["share"] = v
    elif lever == "migration":
        y["migration"] = v
    else:
        y[lever].update({"participation": 1.0, "intensity": v, "weight": 1.0})
    return y


def break_even(base: dict, a: dict, x: dict, lever: str, high: float = 1.0) -> tuple[str, float | None]:
    """Status and value from the linear closed form: net(v) = n0 + (n1 - n0) v / high."""
    n0 = changes(base, a, set_lever(x, lever, 0.0))["net"]
    n1 = changes(base, a, set_lever(x, lever, high))["net"]
    if n0 >= -0.005:
        return "already_above", 0.0
    if abs(n1 - n0) < 0.005:
        return "no_effect", None
    if n1 <= n0:
        return "wrong_direction", None
    if n1 < 0:
        return "unattainable_in_range", None
    return "found", -n0 / (n1 - n0) * high


def hand_examples() -> list[str]:
    errs: list[str] = []

    def want(name, got, exp, tol=1e-9):
        if abs(got - exp) > tol:
            errs.append(f"hand example {name}: got {got}, expected {exp}")

    base = {
        "wine": {"value": 100.0, "litres": 10.0, "price": 10.0, "abv": 0.1, "household": 0.5, "margin": 0.5},
        "spirits": {"value": 0.0, "litres": 0.0, "price": 20.0, "abv": 0.4, "household": 0.5, "margin": 0.5},
        "heavyBeer": {
            "value": 0.0,
            "litres": 0.0,
            "price": 5.0,
            "abv": 0.07,
            "household": 0.5,
            "margin": 0.4,
        },
        "beer": {
            "value": 200.0,
            "litres": 100.0,
            "price": 2.0,
            "abv": 0.05,
            "household": 1.0,
            "margin": 0.0,
            "excisePerLitre": 0.1,
        },
        "salesTax": 0.05,
        "rates": {"school": 0.1, "enforcement": 0.0},
    }
    a = {
        "supply": "dabs",
        "stateCollection": 0.5,
        "shelf": 1.4,
        "salesTaxBase": 1.4,
        "consumerRatio": 1.4,
        "dabsRevenuePerDollar": 1.0,
    }
    none = {"participation": 0.0, "intensity": 0.0, "weight": 1.0, "basis": "pure_alcohol", "grocery": 1.0}
    x = {
        "migration": 0.2,
        "convenienceLimit": None,
        "declined": {"dabs": 1.0, "beer": 0.0, "outOfState": 0.0, "none": 0.0},
        "beer": {**none, "heavyShare": 0.0},
        "spirits": dict(none),
        "recapture": {"share": 0.0, "grocery": 1.0},
        "additional": {"share": 0.0, "grocery": 1.0},
        "costs": {
            "variable": 0.02,
            "handling": 0.0,
            "admin": 1.0,
            "licenseReceipts": 0.0,
            "restructuring": 0.0,
        },
        "migrantResponse": None,
    }
    # 10 of wine moves (100 x 0.5 x 0.2): the markup is kept (0), sales tax on a 40% higher price gains 0.05 x 4 = 0.2,
    # store costs fall 0.2, administration costs 1: net -0.6. Deposits counting DABS's sales to grocers: 10% x 0 = 0.
    r = changes(base, a, x)
    want("preserved markup", r["collections"]["dabsWineMarkup"], 0.0)
    want("sales tax", r["collections"]["salesTax"], 0.2)
    want("net", r["net"], -0.6)
    want("deposits (counting)", r["deposits"]["countsGrocerSales"], 0.0)
    want("deposits (not counting)", r["deposits"]["excludesGrocerSales"], -1.0)
    # Beer replaced: 10% of 100 litres at 5% = 0.5 litres of pure alcohol = 5 litres of wine = $50 at state-store
    # prices. Gained 50 x (0.5 + 0.05 x 1.4) = 28.5; lost 10 litres x (0.1 + 0.05 x 2) = 2. Net -0.6 + 26.5 = 25.9.
    xb = set_lever(x, "beer", 0.1)
    r = changes(base, a, xb)
    want("beer net", r["net"], 25.9)
    want("beer alcohol unchanged", r["alcohol"]["total"], 0.0)
    # Break-even additional wine with markup cut to 0.3 (a discount design at today's price): moving 10 costs
    # 10 x (0.5 - 0.3) = 2 in markup, saves 0.2 in store costs, admin 1: net -2.8. Each $ of additional grocery wine
    # brings 0.3 + 0.05 = 0.35, so 2.8 / 0.35 = 8, which is 8 / 50 = 16% of household wine.
    d = {**a, "stateCollection": 0.3, "shelf": 1.0, "salesTaxBase": 1.0, "consumerRatio": 1.0}
    want("discount net", changes(base, d, x)["net"], -2.8)
    st, v = break_even(base, d, x, "additional")
    if st != "found":
        errs.append(f"hand example break-even: status {st}")
    else:
        want("break-even additional", v, 0.16)
    # A convenience limit of 0.2 at a 40% premium: nobody moves; declined purchases stay at DABS: net = -admin.
    xc = dict(x, convenienceLimit=0.2)
    want("nobody moves", changes(base, a, xc)["net"], -1.0)
    return errs


def _rows(path: Path) -> list[dict]:
    with path.open(encoding="utf-8", newline="") as fh:
        return list(csv.DictReader(fh))


def check(path: Path) -> tuple[list[str], dict]:
    errs: list[str] = []
    data = json.loads(path.read_text(encoding="utf-8"))
    d = path.parent
    base = data["base"]
    arrs = {a["id"]: a for a in data["arrangements"]}
    scen = {s["id"]: s for s in data["scenarios"]}
    counts = {"scenarios": 0, "grid points": 0, "break-evens": 0, "sensitivity rows": 0}

    def close(tag, got, exp, tol=TOL):
        if got is None or exp is None or not math.isfinite(got) or abs(got - exp) > tol:
            errs.append(f"{tag}: export {got}, closed form {exp}")

    # Arrangements: the tax base and the consumer price follow the shelf price (state and local tax on both sides).
    for a in data["arrangements"]:
        close(f"{a['id']} tax base", a["salesTaxBase"], a["shelf"], 1e-9)
        close(f"{a['id']} consumer ratio", a["consumerRatio"], a["shelf"], 1e-9)
        if a["preservesCollection"] and a["supply"] != "none":
            close(f"{a['id']} collection", a["stateCollection"], base["wine"]["margin"], 1e-9)

    # Named scenarios.
    for res in data["results"]:
        tag = f"{res['arrangement']}/{res['scenario']}"
        a = arrs[res["arrangement"]]
        r = changes(base, a, scen[res["scenario"]]["inputs"])
        counts["scenarios"] += 1
        close(f"{tag} net", res["change"]["net"], r["net"])
        close(f"{tag} gross", res["change"]["gross"], r["gross"])
        close(f"{tag} costs", res["change"]["costs"], r["costs"])
        for k, v in r["collections"].items():
            close(f"{tag} {k}", res["change"]["collections"][k], v)
        for k, v in r["costs_by"].items():
            close(f"{tag} {k}", res["change"]["costsBy"][k], v)
        for k, v in r["deposits"].items():
            close(f"{tag} deposits {k}", res["change"]["deposits"][k], v)
        for k, v in r["alcohol"].items():
            close(f"{tag} alcohol {k}", res["alcohol"][k], v, 0.01)
        close(f"{tag} migration used", res["migration_used"], r["migration_used"], 1e-12)
        for o in res["origins"]:
            g, dd = r["origins"][o["id"]]
            close(f"{tag} origin {o['id']} grocery", o["grocery"]["storeEquivalent"], g)
            close(f"{tag} origin {o['id']} dabs", o["dabs"]["storeEquivalent"], dd)
        close(f"{tag} lines add to the net", sum(line["value"] for line in res["lines"]), r["net"])
        if res["total_alcohol_unchanged"] != (abs(r["alcohol"]["total"]) < 1):
            errs.append(f"{tag}: total_alcohol_unchanged flag disagrees with the closed form")
        if not res["reconciles"]:
            errs.append(f"{tag}: the export says it does not reconcile")

    # The scenario CSV matches the JSON; the components add up; allocations are not added.
    by_key = {(r["arrangement"], r["scenario"]): r for r in data["results"]}
    for row in _rows(d / "flows_scenarios.csv"):
        res = by_key[(row["arrangement_id"], row["scenario_id"])]
        close(
            f"csv {row['arrangement_id']}/{row['scenario_id']} net",
            _f(row["net_change_usd"]),
            res["change"]["net"],
        )
        if row["reconciles"] != "true":
            errs.append(f"csv {row['arrangement_id']}/{row['scenario_id']} does not reconcile")
    comp: dict[tuple, dict] = {}
    for row in _rows(d / "flows_components.csv"):
        k = (row["arrangement_id"], row["scenario_id"])
        comp.setdefault(k, {"collection": 0.0, "cost": 0.0, "totals": {}, "allocation_counted": False})
        ch = _f(row["change_usd"])
        close(
            f"components {k} {row['component_id']} after - before",
            _f(row["after_usd"]) - _f(row["before_usd"]),
            ch,
        )
        if row["kind"] in ("collection", "cost"):
            comp[k][row["kind"]] += ch
        elif row["kind"] == "total":
            comp[k]["totals"][row["component_id"]] = ch
        elif row["kind"] == "allocation" and row["counted_in_net"] != "false":
            comp[k]["allocation_counted"] = True
    for k, c in comp.items():
        close(f"components {k} collections add to gross", c["collection"], c["totals"]["gross_collections"])
        close(f"components {k} costs add to the total", c["cost"], c["totals"]["state_costs"])
        close(
            f"components {k} gross less costs is net",
            c["totals"]["gross_collections"] - c["totals"]["state_costs"],
            c["totals"]["net_fiscal_contribution"],
        )
        close(
            f"components {k} net is the scenario's",
            c["totals"]["net_fiscal_contribution"],
            by_key[k]["change"]["net"],
        )
        if c["allocation_counted"]:
            errs.append(f"components {k}: a deposit allocation is counted in the net")

    # Substitution grid: on top of the accounting case.
    acc = scen["accounting_30"]["inputs"]
    for row in _rows(d / "flows_substitution_grid.csv"):
        x = set_lever(acc, row["beverage"], _f(row["share_replaced_pct"]) / 100)
        x[row["beverage"]]["basis"] = row["conversion_basis"]
        r = changes(base, arrs[row["arrangement_id"]], x)
        counts["grid points"] += 1
        close(
            f"substitution {row['arrangement_id']} {row['beverage']} {row['conversion_basis']} {row['share_replaced_pct']}",
            _f(row["net_change_usd"]),
            r["net"],
        )
        close(
            f"substitution alcohol {row['arrangement_id']} {row['beverage']} {row['conversion_basis']} {row['share_replaced_pct']}",
            _f(row["pure_alcohol_total_change_litres"]),
            r["alcohol"]["total"],
            0.01,
        )

    # Price grid: the per-bottle terms at each premium are exported; the tax base and consumer price follow the shelf.
    for row in _rows(d / "flows_migration_price_grid.csv"):
        a = dict(arrs[row["arrangement_id"]])
        sh = _f(row["shelf_price_per_dollar"])
        a.update(
            stateCollection=_f(row["state_collection_per_dollar"]),
            shelf=sh,
            salesTaxBase=sh,
            consumerRatio=sh,
        )
        close(
            f"price grid {row['arrangement_id']} premium", _f(row["grocery_premium_pct"]) / 100, sh - 1, 1e-9
        )
        lim = row["convenience_limit_premium_pct"]
        x = dict(
            acc,
            migration=_f(row["migration_at_equal_prices_pct"]) / 100,
            convenienceLimit=None if lim.startswith("none") else _f(lim) / 100,
        )
        r = changes(base, a, x)
        counts["grid points"] += 1
        close(
            f"price grid {row['arrangement_id']} {row['grocery_premium_pct']} {lim} {row['migration_at_equal_prices_pct']}",
            _f(row["net_change_usd"]),
            r["net"],
        )

    # Migration grid with three household shares.
    for row in _rows(d / "flows_migration_grid.csv"):
        h = _f(row["household_share_pct"]) / 100
        b = json.loads(json.dumps(base))
        for k in ("wine", "spirits", "heavyBeer"):
            b[k]["household"] = h
        r = changes(b, arrs[row["arrangement_id"]], dict(acc, migration=_f(row["migration_pct"]) / 100))
        counts["grid points"] += 1
        close(
            f"migration grid {row['arrangement_id']} {row['household_share_pct']} {row['migration_pct']}",
            _f(row["net_change_usd"]),
            r["net"],
        )

    # Break-even table and frontiers.
    for row in _rows(d / "flows_break_even.csv"):
        st, v = break_even(
            base, arrs[row["arrangement_id"]], scen[row["context_scenario_id"]]["inputs"], row["lever"]
        )
        counts["break-evens"] += 1
        tag = f"break-even {row['arrangement_id']}/{row['context_scenario_id']}/{row['lever']}"
        if st != row["status"]:
            errs.append(f"{tag}: export {row['status']}, closed form {st}")
        elif st == "found":
            close(tag, _f(row["break_even_pct"]) / 100, v, 1e-6)
    M = base["wine"]["margin"]
    for row in _rows(d / "flows_break_even_frontier.csv"):
        tag = f"frontier {row['family']} {row['arrangement_id']} {row['x_value']} {row['lever']}"
        if row["family"] == "migration":
            a = arrs[row["arrangement_id"]]
            x = dict(acc, migration=_f(row["x_value"]) / 100)
        else:
            setting = _f(row["lever_setting_pct"]) / 100
            coll = M - setting if row["family"] == "dabs_discount" else setting / (1 + setting)
            close(f"{tag} collection", _f(row["x_value"]), coll, 1e-9)
            a = dict(arrs[row["arrangement_id"]])
            a.update(
                stateCollection=coll,
                shelf=1.0,
                salesTaxBase=1.0,
                consumerRatio=1.0,
                dabsRevenuePerDollar=1 - setting if row["family"] == "dabs_discount" else 0.0,
            )
            x = acc
        st, v = break_even(base, a, x, row["lever"])
        counts["break-evens"] += 1
        if st != row["status"]:
            errs.append(f"{tag}: export {row['status']}, closed form {st}")
        elif st == "found":
            close(tag, _f(row["break_even_pct"]) / 100, v, 1e-6)

    # Sensitivity rows that change only stated inputs or the base year (the grocer-margin rows need the engine's
    # price stack and are checked in the TypeScript tests instead).
    def base_with(**c):
        b = json.loads(json.dumps(base))
        if "household" in c:
            for k in ("wine", "spirits", "heavyBeer"):
                b[k]["household"] = c["household"]
        if "beer_household" in c:
            b["beer"]["household"] = c["beer_household"]
        if "beer_price" in c:
            b["beer"]["price"] = c["beer_price"] / L_GAL
        if "beer_excise" in c:
            b["beer"]["excisePerLitre"] = c["beer_excise"] / 31 / L_GAL
        if "wine_price" in c:
            b["wine"]["price"] = c["wine_price"]
        return b

    def cost(x, **c):
        y = json.loads(json.dumps(x))
        y["costs"].update(c)
        return y

    hand = base["wine"]["price"]
    runs = {
        "household": lambda x, lo: (base_with(household=0.67 if lo else 0.97), x),
        "migration": lambda x, lo: (base, dict(x, migration=0.1 if lo else 0.5)),
        "variable_costs": lambda x, lo: (base, cost(x, variable=0.0 if lo else 0.05)),
        "admin": lambda x, lo: (base, cost(x, admin=250_000 if lo else 1_000_000)),
        "license": lambda x, lo: (base, cost(x, licenseReceipts=0 if lo else 500_000)),
        "restructuring": lambda x, lo: (
            base,
            cost(x, restructuring=0.0 if lo else data["restructuring_per_dollar"]),
        ),
        "handling": lambda x, lo: (base, cost(x, handling=0.0 if lo else data["handling_high_per_dollar"])),
        "beer_price": lambda x, lo: (base_with(beer_price=8 if lo else 20), x),
        "beer_excise": lambda x, lo: (base_with(beer_excise=13.1 if lo else 13.85), x),
        "beer_household": lambda x, lo: (base_with(beer_household=0.7 if lo else 0.9), x),
        "wine_price": lambda x, lo: (base_with(wine_price=14.8 if lo else hand), x),
    }
    for row in _rows(d / "flows_sensitivity.csv"):
        p = row["parameter_id"]
        if p not in runs or row["applies"] != "true":
            continue
        a = arrs[row["arrangement_id"]]
        x = scen[row["context_scenario_id"]]["inputs"]
        close(
            f"sensitivity {row['arrangement_id']}/{row['context_scenario_id']} base",
            _f(row["net_change_base_usd"]),
            changes(base, a, x)["net"],
        )
        for side, col in ((True, "net_change_at_low_usd"), (False, "net_change_at_high_usd")):
            b, y = runs[p](x, side)
            counts["sensitivity rows"] += 1
            close(
                f"sensitivity {row['arrangement_id']}/{row['context_scenario_id']}/{p}/{col}",
                _f(row[col]),
                changes(b, a, y)["net"],
            )
    return errs, counts


def main() -> int:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT
    errs = hand_examples()
    if not path.exists():
        print(f"{path} not found: run `npm --prefix web run export:grocery-wine` first")
        return 1
    more, counts = check(path)
    errs += more
    if errs:
        print("\n".join(errs[:60]))
        print(f"FAILED: {len(errs)} mismatches")
        return 1
    data = json.loads(path.read_text(encoding="utf-8"))
    what = ", ".join(f"{v} {k}" for k, v in counts.items())
    print(
        f"hand examples OK; {what} recomputed independently and agree with the export ({data['method']}, commit {data['project_commit']})"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
