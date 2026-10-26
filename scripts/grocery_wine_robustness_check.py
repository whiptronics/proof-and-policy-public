"""What would have to be true for the Utah grocery-wine example to break even, recomputed by hand.

An independent check of the "What would have to be true" section of the Utah initiative page
(web/src/lib/initiatives.ts, initiative-robustness@1.0) and of the technical appendix's robustness section. It takes
the worked example's inputs from scripts/grocery_wine_briefing_example.py, moves one input at a time over the page's
tested ranges, and solves each break-even in closed form, standard library only. Each figure is asserted against the
value the TypeScript model gives.

    python scripts/grocery_wine_robustness_check.py

At matched consumer prices, per dollar of state-store sales that moves to grocers, before the fixed new costs N:
    private supply with a replacement tax a on the sellers' price   -m + a/(1+a) + v
    DABS supply at a discount d to grocers                          v - d
where m is DABS's gross margin and v the store cost avoided. The sales tax rate drops out of both. Ranges are labelled
by what supports them: evidence, a statute reference point, or illustrative (no evidence; shown only to see how far
the result moves). No probabilities: nothing here says how likely a value is.
"""

from __future__ import annotations

import grocery_wine_briefing_example as base

# ----- inputs (see grocery_wine_briefing_example.py for their sources; none reviewed by a person) -----------------------
SALES = base.DABS_SALES
m = base.m
v = base.AVOIDABLE
N = base.NEW_COSTS
a = base.TAX
d = base.DISCOUNT
t = base.SALES_TAX
W = base.W
S = base.S
# DABS FY2025 annual report, operating expenses (transcribed, not reviewed): the lines that could move with sales.
CARD = 8_403_000
AGENCY = 3_474_000
BAGS = 680_000
WAGES = 41_432_000
DELIVERY = 5_767_000
# Total operating expenses (income statement, p. 30). The p. 32 five-year summary labels the same figure "Operating and
# Non-Operating Expenses", but p. 30 lists non-operating depreciation and bond interest separately (NON_OPERATING).
ALL_EXPENSES = 81_910_000
NON_OPERATING = 17_469_000 + 602_000  # amortization and depreciation; interest on bonds and notes (p. 30)
# The audited State of Utah ACFR FY2025 (p. 50, Alcoholic Beverage Services) reports different amounts for the fund:
# depreciation and amortization 5,331 (inside its operating expenses) and interest expense 2,422 ($ thousands).
NON_OPERATING_ACFR = 5_331_000 + 2_422_000
MARGIN_FY2021 = 235_239_000 / 517_390_000  # the lowest gross margin in the dataset's DABS series (FY2021)
# DABS FY2026 monthly Sales Analysis Reports, item rows by class (scripts/dabs_wine_class_mix.py).
WINE_FY2026 = 182_331_954.71
STILL_TABLE_FY2026 = 141_949_120.54
CIDER_FY2026 = 3_875_021.12
# FY2025 annual report p. 19 chart: wines over the sum of its five categories ($550.92M; the chart prints no total, and the
# report does not reconcile it with the $551.346M of sales on pp. 30 and 32).
WINE_FY2025_REPORT = 184_100_000 / 550_900_000
WINE_MARKUP, SMALL_MAKER_MARKUP = 0.885, 0.49  # Utah Code 32B-2-304(2)(b) and (3)(c), as read online

tax_per_dollar = a / (1 + a)
per1 = -m + tax_per_dollar + v
per2 = v - d


def net1(S_: float = S, m_: float = m, v_: float = v, N_: float = N) -> float:
    return S_ * (-m_ + tax_per_dollar + v_) - N_


def net2(S_: float = S, v_: float = v, N_: float = N) -> float:
    return S_ * (v_ - d) - N_  # the margin cancels: DABS keeps m - d


# ----- one input at a time ----------------------------------------------------------------------------------------------
scale = {
    # illustrative
    "shift": (0.2 / base.SHIFT, 0.4 / base.SHIFT),
    "eligible": (0.67 / base.HOUSEHOLD_SHARE, 0.97 / base.HOUSEHOLD_SHARE),
    # evidence: which wines a bill covers; the year of the share and the tax-basis bias below
    "scope": (STILL_TABLE_FY2026 / WINE_FY2026, 1 + CIDER_FY2026 / WINE_FY2026),
    "share": (0.33 / base.WINE_SHARE, 0.34 / base.WINE_SHARE),
}
# These four only scale the wine that moves: net = k*S*per - N, negative for every k > 0 when per < 0. No break-even.
scale_nets = {k: [(net1(S * x), net2(S * x)) for x in ends] for k, ends in scale.items()}

avoid_low = (CARD + AGENCY + BAGS) / SALES
avoid_high = avoid_low + WAGES / SALES
avoid_ceiling = ALL_EXPENSES / SALES
avoid_all = (ALL_EXPENSES + NON_OPERATING) / SALES  # every expense, the non-operating ones included
avoid_all_acfr = (ALL_EXPENSES + NON_OPERATING_ACFR) / SALES  # the same with the ACFR's depreciation and interest
delivery = DELIVERY / SALES
avoid_zero1 = m - tax_per_dollar + N / S  # store cost avoided per dollar at which each structure breaks even
avoid_zero2 = d + N / S

margin_floor = WINE_MARKUP / (1 + WINE_MARKUP)  # the margin a price at exactly the minimum markup gives
margin_small = SMALL_MAKER_MARKUP / (1 + SMALL_MAKER_MARKUP)
margin_zero1 = tax_per_dollar + v - N / S  # private only: DABS supply's result does not depend on the margin

# ----- break-even levers and the retailer check -------------------------------------------------------------------------
keep = v - N / S  # what sellers may keep per dollar of today's price, either structure
own1 = 1 - (m - keep)  # private sellers' own price per dollar of today's price at the break-even tax
margin_on_own1 = keep / own1
# Wholesaler and grocer together at national average margins.
need1 = 1 - (1 - base.WHOLESALER_MARGIN) * (1 - base.GROCER_MARGIN)
margin_on_own2 = keep  # the grocer sells at today's price
# The largest discount that leaves DABS's price to grocers at or above the minimum wine markup, at this margin.
lawful_discount = max(0.0, 1 - (1 + WINE_MARKUP) * (1 - m))


# ----- the comparison's joint rows (documented bounds at each end; every operating expense avoidable) -------------------
def tax_at(k: float) -> float:
    return k / (1 - k)  # the tax whose share of the shelf price is k


joint = {
    # favourable: every salary avoidable; private supply also stops delivery; the lowest reported margin
    "favourable": (
        net1(m_=MARGIN_FY2021, v_=avoid_high + delivery),
        net2(v_=avoid_high),
        tax_at(MARGIN_FY2021 - avoid_high - delivery + N / S),
        avoid_high - N / S,
    ),
    "unfavourable": (
        net1(v_=avoid_low),
        net2(v_=avoid_low),
        tax_at(m - avoid_low + N / S),
        avoid_low - N / S,
    ),
    # every operating expense avoidable and no new costs: an accounting ceiling, not a saving
    "ceiling": (
        net1(m_=MARGIN_FY2021, v_=avoid_ceiling, N_=0),
        net2(v_=avoid_ceiling, N_=0),
        tax_at(MARGIN_FY2021 - avoid_ceiling),
        avoid_ceiling,
    ),
}
# An extreme arithmetic comparison, not a saving: the same ceiling with depreciation and interest also avoidable.
ceiling_all = (net1(m_=MARGIN_FY2021, v_=avoid_all, N_=0), net2(v_=avoid_all, N_=0))
ceiling_all_acfr = (net1(m_=MARGIN_FY2021, v_=avoid_all_acfr, N_=0), net2(v_=avoid_all_acfr, N_=0))

# ----- sales tax ----------------------------------------------------------------------------------------------------------
# At matched prices the rate drops out of the net change. If DABS's sales to licensees carry no sales tax, today's
# revenue and every alternative are lower by the same amount, so the change is unchanged.
licensee_untaxed_level = t * W * (1 - base.HOUSEHOLD_SHARE)
# The replacement tax inside the sales-tax base is a design choice. If sales tax is charged on the sellers' price only
# and the shelf price before sales tax is still today's, consumers pay slightly less and the state collects less:
outside1 = S * ((a + t) / (1 + a) - t - m + v) - N
K = t + m - v + N / S  # what the state must collect per dollar that moves: (a + t) / (1 + a) = K
outside_tax_break_even = (K - t) / (1 - K)


# The FY2026 monthly share times FY2025 annual sales. Shelf-price totals may or may not include sales tax. A tax
# embedded at rate k on household sales only biases wine's share by (1 + k h_w) / (1 + k h), where h_w is wine's
# household share and h the all-product share. It cancels only when wine's tax-weighted base matches the average: no
# tax embedded, the same rate on every sale, or the same customer mix (h_w = h). Illustrative: k = 10%, h_w = 67-97%.
def share_bias(k: float, h_w: float, h: float = base.HOUSEHOLD_SHARE) -> float:
    return (1 + k * h_w) / (1 + k * h) - 1


bias = (share_bias(0.10, 0.67), share_bias(0.10, 0.97))
bias_on_nets = [(abs(b) * S * per1, abs(b) * S * per2) for b in bias]
year_gap = WINE_FY2025_REPORT / base.WINE_SHARE - 1  # FY2025's printed share against the FY2026 share used
year_gap_nets = (year_gap * S * per1, year_gap * S * per2)

# ----- school meals and enforcement: a separate goal, the same money ----------------------------------------------------
# The deposits are inside DABS's margin, so they are counted once, in m. Guaranteeing them moves money between funds and
# leaves the state's total change as it was; whatever the funds keep, the General Fund and other state funds give up.
guarantee = base.guarantee
by_fund_private = {"school_meals_and_enforcement": 0.0, "general_and_other": net1()}  # with the guarantee
assert abs(sum(by_fund_private.values()) - net1()) < 1e-6
# Revenue counted line by line, deposits shown separately, gives the same change: nothing is counted twice.
today = m * W + t * W
after1 = m * (W - S) + t * W + tax_per_dollar * S + v * S - N
deposits_today = (base.SCHOOL_RATE + base.ENFORCEMENT_RATE) * W
assert abs((after1 - today) - net1()) < 1e-6
assert abs(((after1 - deposits_today + guarantee) - (today - deposits_today + guarantee)) - net1()) < 1e-6

# ----- the TypeScript model's values (web/src/lib/initiatives.ts, 2026-10-17), to agree within a dollar or 1e-6 -------
EXPECTED = {
    "per1": -0.2554307096,
    "per2": -0.15,
    "keep": 0.0389956128,
    "lawful_discount": 0.0049035542,
    "margin_floor": 0.4694960212,
    "margin_small": 0.3288590604,
    "avoid_zero1": 0.3164350967,
    "avoid_zero2": 0.2110043872,
    "margin_zero1": 0.2056622795,
    "margin_on_own1": 0.0687876771,
    "margin_on_own2": 0.0389956128,
    "shift_high_1": -15_974_477.32,
    "shift_low_2": -5_043_642.39,
    "eligible_low_1": -9_982_835.18,
    "scope_low_1": -9_535_395.56,
    "scope_high_2": -7_460_309.64,
    "share_low_1": -11_932_636.23,
    "share_high_2": -7_417_186.92,
    "avoid_high_2": -5_138_051.28,
    "margin_small_1": -5_597_621.16,
    "favourable_1": -8_661_111.46,
    "favourable_2": -5_138_051.28,
    "favourable_tax": 0.5559047011,
    "favourable_discount": 0.0869177887,
    "unfavourable_1": -13_342_856.81,
    "unfavourable_tax": 0.8529725275,
    "unfavourable_discount": 0.0117707849,
    "ceiling_1": -6_335_400.32,
    "ceiling_2": -2_337_081.67,
    "ceiling_tax": 0.4411320531,
    "ceiling_discount": 0.1485636968,
    "ceiling_all_avoid": 0.1813398483,
    "ceiling_all_1": -4_846_169.21,
    "ceiling_all_2": -847_850.56,
}


def got() -> dict[str, float]:
    return {
        "per1": per1,
        "per2": per2,
        "keep": keep,
        "lawful_discount": lawful_discount,
        "margin_floor": margin_floor,
        "margin_small": margin_small,
        "avoid_zero1": avoid_zero1,
        "avoid_zero2": avoid_zero2,
        "margin_zero1": margin_zero1,
        "margin_on_own1": margin_on_own1,
        "margin_on_own2": margin_on_own2,
        "shift_high_1": scale_nets["shift"][1][0],
        "shift_low_2": scale_nets["shift"][0][1],
        "eligible_low_1": scale_nets["eligible"][0][0],
        "scope_low_1": scale_nets["scope"][0][0],
        "scope_high_2": scale_nets["scope"][1][1],
        "share_low_1": scale_nets["share"][0][0],
        "share_high_2": scale_nets["share"][1][1],
        "avoid_high_2": net2(v_=avoid_high),
        "margin_small_1": net1(m_=margin_small),
        "favourable_1": joint["favourable"][0],
        "favourable_2": joint["favourable"][1],
        "favourable_tax": joint["favourable"][2],
        "favourable_discount": joint["favourable"][3],
        "unfavourable_1": joint["unfavourable"][0],
        "unfavourable_tax": joint["unfavourable"][2],
        "unfavourable_discount": joint["unfavourable"][3],
        "ceiling_1": joint["ceiling"][0],
        "ceiling_2": joint["ceiling"][1],
        "ceiling_tax": joint["ceiling"][2],
        "ceiling_discount": joint["ceiling"][3],
        "ceiling_all_avoid": avoid_all,
        "ceiling_all_1": ceiling_all[0],
        "ceiling_all_2": ceiling_all[1],
    }


def check() -> None:
    base.check()
    g = got()
    for k, want in EXPECTED.items():
        tol = 1.0 if abs(want) > 1000 else 1e-6
        assert abs(g[k] - want) <= tol, f"{k}: {g[k]} != {want}"
    # Every tested end and joint row loses money in both structures.
    for ends in scale_nets.values():
        assert all(x < 0 for pair in ends for x in pair)
    assert all(row[0] < 0 and row[1] < 0 for row in joint.values())
    assert ceiling_all[0] < 0 and ceiling_all[1] < 0
    assert ceiling_all_acfr[1] < 0 and avoid_ceiling < avoid_all_acfr < avoid_all
    # The break-evens lie outside what the evidence or the law allows.
    assert avoid_zero2 > avoid_all > avoid_ceiling and avoid_zero1 > avoid_all
    assert margin_zero1 < margin_small
    assert margin_on_own1 < need1 and margin_on_own2 < base.GROCER_MARGIN
    assert lawful_discount < keep


def money(x: float) -> str:
    return f"-${-x / 1e6:,.2f}M" if x < 0 else f"${x / 1e6:,.2f}M"


def main() -> None:
    check()
    print("Per dollar that moves, before new costs: private", f"{per1:+.4f}", "DABS", f"{per2:+.4f}")
    print(
        f"Sellers may keep {keep * 100:.2f} cents of each dollar of today's price for the state to break even"
    )
    print(
        f"  as a gross margin on their own price: private {margin_on_own1:.1%} (needs {need1:.1%} at national"
        f" averages), DABS supply {margin_on_own2:.1%} (grocers average {base.GROCER_MARGIN:.0%})"
    )
    print(f"  largest DABS discount under the 88.5% minimum markup, at this margin: {lawful_discount:.2%}")
    print("\nOne input at a time (net change a year, private / DABS):")
    for k, ends in scale_nets.items():
        lo, hi = ends
        print(
            f"  {k:<9} {money(lo[0])} / {money(lo[1])}  to  {money(hi[0])} / {money(hi[1])}  (no break-even)"
        )
    print(
        f"  avoidable {avoid_low:.1%} to {avoid_high:.1%}: {money(net1(v_=avoid_low))} / {money(net2(v_=avoid_low))}"
        f" to {money(net1(v_=avoid_high))} / {money(net2(v_=avoid_high))};"
        f" break-even at {avoid_zero1:.1%} / {avoid_zero2:.1%}, above the {avoid_ceiling:.1%} of operating expenses"
        f" and the {avoid_all:.1%} with depreciation and interest"
    )
    print(
        f"  margin {margin_small:.1%} to {m:.1%}: private {money(net1(m_=margin_small))} to {money(net1())};"
        f" break-even at {margin_zero1:.1%}; DABS supply unchanged"
    )
    print(
        f"  new costs $0 to $1M: {money(net1(N_=0))} / {money(net2(N_=0))} to {money(net1(N_=2 * N))} / {money(net2(N_=2 * N))}"
    )
    print("\nJoint rows (net change; break-even tax / discount):")
    for k, (n1, n2, tx, dc) in joint.items():
        print(f"  {k:<12} {money(n1)} / {money(n2)}; {tx:.1%} / {dc:.1%}")
    print(
        f"  extreme comparison, depreciation and interest also avoidable (not a saving): DABS report"
        f" {avoid_all:.1%}, {money(ceiling_all[0])} / {money(ceiling_all[1])}; ACFR amounts {avoid_all_acfr:.1%},"
        f" {money(ceiling_all_acfr[0])} / {money(ceiling_all_acfr[1])}"
    )
    print("\nSales tax:")
    print(
        f"  licensee sales untaxed: every revenue level {money(-licensee_untaxed_level)}, net change unchanged"
    )
    print(
        f"  replacement tax outside the sales-tax base: private {money(outside1)},"
        f" break-even tax {outside_tax_break_even:.1%}"
    )
    print(
        f"  tax-basis bias of the share (illustrative k = 10%): {bias[0]:+.2%} to {bias[1]:+.2%},"
        f" up to {money(max(abs(x) for p in bias_on_nets for x in p))} on the nets"
    )
    print(
        f"  FY2025's p. 19 chart share instead of FY2026's: {year_gap:+.2%}, {money(year_gap_nets[0])} / {money(year_gap_nets[1])}"
    )
    print(
        f"\nGuarantee to the two funds {money(guarantee)}; the state's total change is the same with or without it."
    )
    print("\nAll figures agree with the TypeScript model.")


if __name__ == "__main__":
    main()
