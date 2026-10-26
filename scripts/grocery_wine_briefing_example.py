"""The worked example in docs/briefings/utah-grocery-wine/ (brief and appendix), recomputed by hand.

An independent check of the dashboard's TypeScript model (web/src/lib/arrangements.ts and substitution.ts): the same
FY2025 inputs, closed-form arithmetic, standard library only. Each figure is asserted against the value the
TypeScript model gives (web/src/lib/substitution.test.ts checks the same identities from the other side).

    python scripts/grocery_wine_briefing_example.py

Every input below is either a transcribed source value (unreviewed by a person) or a stated assumption; the labels say
which. Nothing here is a forecast.
"""

from __future__ import annotations

# ----- inputs ---------------------------------------------------------------------------------------------------------
# Source values (transcribed, not human-reviewed; see docs/review/utah-grocery-wine-comparison-packet.md)
DABS_SALES = 551_346_000  # DABS FY2025 "Revenue from Liquor Sales", 90th annual report p. 32 (row 1)
DABS_GROSS_PROFIT = 260_289_000  # same table, "Gross Profit" (row 2)
WINE_SHARE = 0.335  # wine's share of FY2026 gross sales, DABS monthly Sales Analysis Reports (row 4)
SALES_TAX = 0.0485  # state portion, Tax Commission Publication 25 (row 5)
SCHOOL_RATE = 0.10  # Utah Code 32B-2-304(5) (row 7)
ENFORCEMENT_RATE = 0.01695  # Utah Code 32B-2-305(4) (row 8)
HOUSEHOLD_SHARE = 0.82  # DABS FY2025 off-premise share, all products, read from a chart (row 13)
WINE_GALLONS = 3_297_940  # NIAAA surveillance report 124, Utah wine, calendar 2024
BEER_GALLONS = 26_660_000  # NIAAA, Utah beer, calendar 2024
WINE_ABV = 0.118  # NIAAA time-varying ABV, wine, 2024
BEER_ABV = 0.048  # NIAAA time-varying ABV, beer, 2024
BEER_TAX = 13.35  # $ per 31-gallon barrel, Utah Code 59-15-101, in force 2024-07-01 to 2025-06-30 (FY2025)

# Assumptions (the proposal's terms or unmeasured; none has a Utah source)
SHIFT = 0.30  # share of household wine purchases that move to grocers
AVOIDABLE = 0.05  # state-store operating cost avoided per $ that leaves
NEW_COSTS = 500_000  # licensing and enforcement, $ a year
TAX = 0.20  # arrangement 1: replacement tax on the sellers' price before tax
DISCOUNT = 0.20  # arrangement 2: DABS's discount to grocers
WHOLESALER_MARGIN = 0.295  # Census AWTS 2022, NAICS 4248, national, all products
GROCER_MARGIN = 0.28  # Census ARTS 2022, NAICS 4451, national, all products
BEER_PRICE = 12.0  # $ per gallon before sales tax: an illustration, no source
SWAP_AT_GROCERS = 1.0  # share of the switched wine bought at grocers

# ----- derived ----------------------------------------------------------------------------------------------------------
W = DABS_SALES * WINE_SHARE  # wine at state-store prices, before sales tax
m = DABS_GROSS_PROFIT / DABS_SALES  # all-product gross margin, applied to wine (an assumption)
S = W * HOUSEHOLD_SHARE * SHIFT  # wine that moves, at state-store prices
P = W / WINE_GALLONS  # $ per gallon at state-store prices (both include restaurants' purchases)

# Matched consumer prices: the shelf price stays at today's. Arrangement 1's tax is inside it: sellers' price 1/(1+TAX).
tax_per_dollar = TAX / (1 + TAX)
net1 = S * (-m + tax_per_dollar + AVOIDABLE) - NEW_COSTS
net2 = S * (-DISCOUNT + AVOIDABLE) - NEW_COSTS  # the margin cancels: DABS keeps m - d
keep_at_break_even = (
    AVOIDABLE - NEW_COSTS / S
)  # what sellers may keep for the state to break even, either arrangement
tax_break_even = (m - keep_at_break_even) / (
    1 - (m - keep_at_break_even)
)  # tax on sellers' price leaving them that
discount_break_even = keep_at_break_even

# Both sides hold (no price response): sellers price for their margins, the state's lever solved on top.
own1 = (1 - m) / ((1 - WHOLESALER_MARGIN) * (1 - GROCER_MARGIN))  # sellers' price per $ of today's price
# net = S(-m + a*own + t*(own*(1+a) - 1) + v) - N = 0
a_hold = ((m - AVOIDABLE + NEW_COSTS / S) - SALES_TAX * (own1 - 1)) / (own1 * (1 + SALES_TAX))
shelf1_hold = own1 * (1 + a_hold)
# Arrangement 2: shelf = (1-d)/(1-g); net = S(-d + t*(shelf - 1) + v) - N = 0
d_hold = (AVOIDABLE - NEW_COSTS / S + SALES_TAX * (1 / (1 - GROCER_MARGIN) - 1)) / (
    1 + SALES_TAX / (1 - GROCER_MARGIN)
)
shelf2_hold = (1 - d_hold) / (1 - GROCER_MARGIN)

# School meals and enforcement: today's deposits on the wine that moves, and three readings.
school_today = SCHOOL_RATE * S
enforcement_today = ENFORCEMENT_RATE * S
guarantee = school_today + enforcement_today
proceeds1 = tax_per_dollar * S
proceeds2 = (m - DISCOUNT) * S
# Arrangement 2, if DABS's sales to grocers count as its gross liquor revenue: deposits on (1-d)S instead of S.
school_loss_2_if_deposit_applies = SCHOOL_RATE * DISCOUNT * S
cover_tax = guarantee / S / (1 - guarantee / S)  # tax on sellers' price whose proceeds equal the guarantee
cover_discount = m - guarantee / S

# Substitution: wine bought instead of beer, total ethanol unchanged.
beer_per_wine = WINE_ABV / BEER_ABV
beer_loss = beer_per_wine * (BEER_TAX / 31 + SALES_TAX * BEER_PRICE)
q = SWAP_AT_GROCERS
wine_gain1 = P * (q * (tax_per_dollar + SALES_TAX) + (1 - q) * (m + SALES_TAX - AVOIDABLE))
wine_gain2 = P * (q * (m - DISCOUNT + SALES_TAX) + (1 - q) * (m + SALES_TAX - AVOIDABLE))
per_gallon1 = wine_gain1 - beer_loss
per_gallon2 = wine_gain2 - beer_loss
need1 = -net1 / per_gallon1
need2 = -net2 / per_gallon2

# ----- the TypeScript model's values (web/src/lib, 2026-10-17), to agree within a dollar or a basis point ----------------
EXPECTED = {
    "net1": -12_105_857.99,
    "net2": -7_315_463.58,
    "keep_at_break_even": 0.0389956128,
    "tax_break_even": 0.7639850249,
    "a_hold": 0.3954027906,
    "shelf1_hold": 1.4512151189,
    "d_hold": 0.0542053887,
    "guarantee": 5_313_789.77,
    "proceeds1": 7_572_737.31,
    "proceeds2": 12_363_131.72,
    "cover_tax": 0.1324387068,
    "cover_discount": 0.3551473762,
    "per_gallon1": 9.5609754780,
    "per_gallon2": 15.4656153441,
    "need1": 1_266_173.94,
    "need2": 473_014.71,
}


def check() -> None:
    got = {k: globals()[k] for k in EXPECTED}
    for k, want in EXPECTED.items():
        tol = 1.0 if abs(want) > 1000 else 1e-6
        assert abs(got[k] - want) <= tol, f"{k}: {got[k]} != {want}"


def money(v: float) -> str:
    return f"-${-v:,.0f}" if v < 0 else f"${v:,.0f}"


def main() -> None:
    check()
    rows = [
        ("Wine sales at state-store prices (FY2025)", money(W)),
        ("Gross margin (all products, applied to wine)", f"{m:.2%}"),
        ("Wine that moves (30% of household purchases)", money(S)),
        ("Arrangement 1 net change, matched prices", money(net1)),
        ("Arrangement 2 net change, matched prices", money(net2)),
        ("Sellers may keep, for the state to break even", f"{keep_at_break_even * 100:.1f} cents a dollar"),
        ("Arrangement 1 break-even tax (on sellers' price)", f"{tax_break_even:.1%}"),
        ("Arrangement 2 break-even discount", f"{discount_break_even:.1%}"),
        ("Shelf price where state and sellers both hold, arr. 1", f"{shelf1_hold:.1%} of today's"),
        ("Shelf price where state and sellers both hold, arr. 2", f"{shelf2_hold:.1%} of today's"),
        ("Today's school-meals deposit on the wine that moves", money(school_today)),
        ("Today's enforcement deposit on it", money(enforcement_today)),
        ("Guarantee to keep both funds whole", money(guarantee)),
        ("Arrangement 1 replacement-tax proceeds", money(proceeds1)),
        ("Left for the General Fund after the guarantee, arr. 1", money(proceeds1 - guarantee)),
        ("Lowest tax whose proceeds cover the guarantee", f"{cover_tax:.1%}"),
        (
            "Arr. 2 school-meals loss if deposits apply to DABS's sales to grocers",
            money(-school_loss_2_if_deposit_applies),
        ),
        ("Substitution: beer gallons per wine gallon (same alcohol)", f"{beer_per_wine:.3f}"),
        (
            "Substitution: state revenue per wine gallon, arr. 1 / arr. 2",
            f"${per_gallon1:.2f} / ${per_gallon2:.2f}",
        ),
        (
            "Wine that would have to replace beer to offset arr. 1",
            f"{need1:,.0f} gal ({need1 / WINE_GALLONS:.1%} of wine; {need1 * beer_per_wine / BEER_GALLONS:.1%} of beer)",
        ),
        (
            "Wine that would have to replace beer to offset arr. 2",
            f"{need2:,.0f} gal ({need2 / WINE_GALLONS:.1%} of wine; {need2 * beer_per_wine / BEER_GALLONS:.1%} of beer)",
        ),
    ]
    width = max(len(a) for a, _ in rows)
    for a, b in rows:
        print(f"{a:<{width}}  {b}")
    print("\nAll figures agree with the TypeScript model.")


if __name__ == "__main__":
    main()
