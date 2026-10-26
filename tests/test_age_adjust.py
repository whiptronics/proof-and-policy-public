"""Direct age standardization (src/alcohol_data/age_adjust.py).

Reference values were computed independently with scipy.stats.chi2 from the Fay-Feuer formulas.
"""

import math

import pytest

from alcohol_data import age_adjust as aa

POP = [
    410000,
    430000,
    440000,
    420000,
    400000,
    380000,
    390000,
    400000,
    380000,
    350000,
    330000,
    290000,
    240000,
    190000,
    140000,
    100000,
    60000,
    45000,
]
DEATHS = [12, 10, 22, 95, 120, 98, 80, 75, 70, 66, 70, 60, 48, 40, 35, 34, 25, 30]


def test_the_standard_has_eighteen_groups_summing_to_a_million():
    assert len(aa.STANDARD_2000_US) == len(aa.GROUPS) == 18
    assert sum(aa.STANDARD_2000_US) == 1_000_000
    # 0-4 is the NCHS under-1 (13,818) plus 1-4 (55,317).
    assert aa.STANDARD_2000_US[0] == 13818 + 55317


@pytest.mark.parametrize(
    ("age", "group"), [(0, 0), (4, 0), (5, 1), (19, 3), (64, 12), (84, 16), (85, 17), (100, 17)]
)
def test_five_year_group(age, group):
    assert aa.five_year_group(age) == group


def test_a_negative_age_is_refused():
    with pytest.raises(ValueError):
        aa.five_year_group(-1)


def test_adjusted_equals_crude_when_the_state_has_the_standard_age_structure():
    pop = [w * 7 for w in aa.STANDARD_2000_US]
    deaths = [p * 0.0002 for p in pop]  # the same rate at every age
    r = aa.age_adjust(deaths, pop)
    assert r.rate == pytest.approx(r.crude, rel=1e-12)
    assert r.rate == pytest.approx(20.0, rel=1e-12)


def test_matches_the_fay_feuer_interval_computed_independently():
    r = aa.age_adjust(DEATHS, POP)
    assert r.rate == pytest.approx(19.186029707249258, rel=1e-10)
    assert r.se == pytest.approx(0.6225130661561881, rel=1e-10)
    assert r.ci_low == pytest.approx(17.985168488610995, rel=1e-8)
    assert r.ci_high == pytest.approx(20.461504057951217, rel=1e-8)
    assert r.crude == pytest.approx(18.35032437442076, rel=1e-12)
    assert r.deaths == 990 and r.population == sum(POP)


def test_the_interval_brackets_the_rate_and_is_close_to_normal_for_many_deaths():
    r = aa.age_adjust([d * 400 for d in DEATHS], [p * 400 for p in POP])
    assert r.ci_low < r.rate < r.ci_high
    assert (r.ci_high - r.ci_low) / 2 == pytest.approx(1.96 * r.se, rel=0.01)


def test_zero_deaths_give_a_zero_rate_and_a_one_sided_interval():
    r = aa.age_adjust([0] * 18, POP)
    assert r.rate == 0 and r.ci_low == 0
    assert r.ci_high == pytest.approx(0.127126983498668, rel=1e-8)


def test_other_levels_and_scales():
    r90 = aa.age_adjust(DEATHS, POP, level=0.90)
    r95 = aa.age_adjust(DEATHS, POP)
    assert r90.ci_low > r95.ci_low and r90.ci_high < r95.ci_high
    per_million = aa.age_adjust(DEATHS, POP, per=1_000_000)
    assert per_million.rate == pytest.approx(r95.rate * 10, rel=1e-12)


def test_unknown_age_is_spread_in_proportion():
    spread = aa.spread_unknown([10, 30, 60], 10)
    assert spread == pytest.approx([11, 33, 66])
    assert sum(spread) == pytest.approx(110)
    assert aa.spread_unknown([1, 2], 0) == [1, 2]
    with pytest.raises(ValueError):
        aa.spread_unknown([0, 0], 3)


def test_bad_input_is_refused():
    with pytest.raises(ValueError, match="18 age groups"):
        aa.age_adjust([1, 2], [10, 20])
    with pytest.raises(ValueError, match="positive population"):
        aa.age_adjust(DEATHS, POP[:-1] + [0])
    with pytest.raises(ValueError, match="negative"):
        aa.age_adjust([-1] + DEATHS[1:], POP)


def test_chi_square_quantile_matches_the_table():
    assert aa.chi2_quantile(0.975, 2) == pytest.approx(7.377758908227871, rel=1e-10)
    assert aa.chi2_quantile(0.025, 7) == pytest.approx(1.689869180677355, rel=1e-10)
    assert math.isfinite(aa.chi2_quantile(0.5, 30))
