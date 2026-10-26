"""Count intervals, Rubin's rules for imputed counts, and the interval carried into FARS rates."""

from __future__ import annotations

import math
import zipfile
from datetime import date

import duckdb
import pytest

from alcohol_data.adapters.base import Rejected, Staged
from alcohol_data.adapters.nhtsa_fars import parse_fars
from alcohol_data.transforms import db, prefer
from alcohol_data.transforms.build import DERIVE_INPUT_SQL
from alcohol_data.transforms.derive import fars_rates
from alcohol_data.uncertainty import (
    count_interval,
    difference_z,
    gamma_quantile,
    imputed_count_interval,
    poisson_interval,
    rate_interval,
    realized_total_interval,
    rubin_df,
    t_cdf,
    t_critical,
    t_quantile,
    z_for_level,
)
from tests.test_nhtsa_fars import ACCIDENT, MIACC, MIDRVACC, _asset

# Exact (Garwood) 95% limits for a Poisson count, from the standard tables.
GARWOOD = {
    0: (0.0, 3.6889),
    1: (0.0253, 5.5716),
    2: (0.2422, 7.2247),
    5: (1.6235, 11.6683),
    10: (4.7954, 18.3904),
    100: (81.364, 121.627),
}


@pytest.mark.parametrize("count", sorted(GARWOOD))
def test_poisson_interval_matches_the_published_tables(count):
    low, high = poisson_interval(count)
    assert low == pytest.approx(GARWOOD[count][0], abs=6e-4)
    assert high == pytest.approx(GARWOOD[count][1], abs=6e-4)


def test_poisson_interval_is_wider_at_higher_confidence_and_handles_fractions():
    assert poisson_interval(10, 0.99)[1] > poisson_interval(10, 0.95)[1] > poisson_interval(10, 0.90)[1]
    low, high = poisson_interval(0.3)  # a mean of ten imputed versions can be fractional
    assert 0 < low < 0.3 < high
    with pytest.raises(ValueError):
        poisson_interval(-1)
    with pytest.raises(ValueError):
        poisson_interval(float("nan"))


def test_gamma_quantile_inverts_the_exponential_case():
    # Gamma with shape 1 is exponential: the p quantile is -ln(1 - p).
    assert gamma_quantile(0.975, 1.0) == pytest.approx(-math.log(0.025), rel=1e-9)
    assert z_for_level(0.95) == pytest.approx(1.959964, abs=1e-6)


def test_count_interval_for_a_plain_count_has_no_imputation_part():
    iv = count_interval(25)
    assert (iv.estimate, iv.m, iv.imputation_se) == (25, 1, 0.0)
    assert iv.se == pytest.approx(5.0) and iv.count_se == pytest.approx(5.0)
    assert iv.low < 25 < iv.high


def test_one_version_is_a_plain_count():
    assert imputed_count_interval([40.0]) == count_interval(40.0)


def test_identical_imputations_add_nothing():
    iv = imputed_count_interval([300.0] * 10)
    low, high = poisson_interval(300.0)
    assert (iv.low, iv.high) == pytest.approx((low, high))
    assert iv.imputation_se == 0.0


def test_spread_between_imputations_widens_the_interval_by_rubins_rules():
    versions = [300, 310, 290, 305, 295, 300, 301, 299, 310, 290]
    iv = imputed_count_interval(versions)
    m = len(versions)
    mean = sum(versions) / m
    between = sum((v - mean) ** 2 for v in versions) / (m - 1)
    assert iv.estimate == mean
    assert iv.imputation_se == pytest.approx(math.sqrt((1 + 1 / m) * between))
    assert iv.se == pytest.approx(math.sqrt(mean + (1 + 1 / m) * between))  # T = W + (1 + 1/m) B
    plain = poisson_interval(mean)
    assert iv.low < plain[0] and iv.high > plain[1]
    # As the count grows the combination approaches estimate +/- t_nu sqrt(T), Rubin's interval; at 300
    # deaths the exact Poisson part is about 2% wider than the normal one, at 30,000 about 0.2%.
    assert (iv.high - iv.low) / 2 == pytest.approx(t_critical(0.95, iv.df) * iv.se, rel=0.03)
    big = imputed_count_interval([30000 + d for d in (-90, 40, 10, -60, 100, -20, 70, -30, 0, -20)])
    assert (big.high - big.low) / 2 == pytest.approx(t_critical(0.95, big.df) * big.se, rel=0.005)


def test_deaths_in_multi_death_crashes_are_compound_poisson():
    # 3 crashes with 2, 1 and 1 deaths: 4 deaths, variance 2^2 + 1 + 1 = 6 rather than 4.
    iv = count_interval(4, sum_sq=6)
    assert iv.se == pytest.approx(math.sqrt(6)) and iv.count_se == iv.se
    phi = 6 / 4
    low, high = poisson_interval(4 / phi)
    assert (iv.low, iv.high) == pytest.approx((phi * low, phi * high))
    plain = count_interval(4)
    assert iv.low < plain.low and iv.high > plain.high
    # One death per crash is the plain Poisson interval.
    assert count_interval(10, sum_sq=10) == count_interval(10)
    assert count_interval(0, sum_sq=0).high == pytest.approx(poisson_interval(0)[1])


def test_within_imputation_variance_is_the_mean_sum_of_squares():
    versions = [6.0] * 5 + [4.0] * 5
    sums_sq = [14.0] * 5 + [10.0] * 5  # e.g. a 2-death crash impaired in half the imputations
    iv = imputed_count_interval(versions, sums_sq=sums_sq)
    m = 10
    mean = 5.0
    between = sum((v - mean) ** 2 for v in versions) / (m - 1)
    assert iv.count_se == pytest.approx(math.sqrt(12.0))
    assert iv.se == pytest.approx(math.sqrt(12.0 + (1 + 1 / m) * between))
    assert iv.low < iv.estimate < iv.high
    assert imputed_count_interval([7.0], sums_sq=[11.0]) == count_interval(7.0, sum_sq=11.0)
    with pytest.raises(ValueError):
        imputed_count_interval([1.0, 2.0], sums_sq=[1.0])


# ----- 1.2: Rubin's degrees of freedom, and the two targets ---------------------------------------------------
#
# Reference values below were computed independently of this package, with SciPy 1.x (scipy.stats.chi2.ppf
# for the Garwood limits, scipy.stats.t.ppf for t) and NumPy, from the formulas in Rubin (1987) and NHTSA's
# report on the FARS imputations (Subramanian 2002, DOT HS 809 403, which uses nu = (m - 1)(1 + 1/r)^2 and t).

REF_Q = [12, 15, 9, 14, 10, 13, 11, 16, 8, 12]  # ten imputed counts
REF_U = [20, 25, 15, 24, 16, 21, 17, 26, 12, 20]  # each one's compound-Poisson variance


def test_rubin_degrees_of_freedom_and_their_limits():
    assert math.isinf(rubin_df(10.0, 0.0, 10))  # imputations agree: no t correction at all
    assert rubin_df(0.0, 4.0, 10) == 9.0  # no count noise: m - 1
    assert rubin_df(4.0, 4.0, 10) == pytest.approx(36.0)  # r = 1: 9 * 2^2
    assert rubin_df(400.0, 4.0, 10) == pytest.approx(9 * 101**2)  # count noise dominates: nearly normal
    with pytest.raises(ValueError):
        rubin_df(1.0, 1.0, 1)


def test_independent_reference_example_for_the_expected_count():
    iv = imputed_count_interval(REF_Q, sums_sq=REF_U)
    assert iv.estimate == 12.0
    assert iv.count_se**2 == pytest.approx(19.6)
    assert iv.imputation_se**2 == pytest.approx(1.1 * 6.666666666666667)
    assert iv.se**2 == pytest.approx(26.933333333333337)
    assert iv.df == pytest.approx(121.40033057851237, rel=1e-9)
    assert iv.low == pytest.approx(3.090305838907849, rel=1e-6)
    assert iv.high == pytest.approx(25.550192721176487, rel=1e-6)


def test_independent_reference_example_for_the_realized_total():
    rt = realized_total_interval(REF_Q)
    assert (rt.estimate, rt.df, rt.m) == (12.0, 9.0, 10)
    assert rt.se == pytest.approx(2.7080128015453204, rel=1e-9)
    assert rt.low == pytest.approx(5.87404944403502, rel=1e-6)
    assert rt.high == pytest.approx(18.12595055596498, rel=1e-6)
    assert (rt.high - rt.estimate) / rt.se == pytest.approx(2.262157162798205, rel=1e-6)  # t_9, not 1.96


def test_small_between_imputation_spread_barely_changes_the_expected_count_interval():
    versions = [300, 301, 299, 300, 300, 301, 299, 300, 300, 300]
    iv = imputed_count_interval(versions)
    assert iv.df > 1e5
    z = z_for_level(0.95)
    low_p, high_p = poisson_interval(iv.estimate)
    z_high = iv.estimate + math.hypot(high_p - iv.estimate, z * iv.imputation_se)  # the 1.1 interval
    assert iv.high == pytest.approx(z_high, rel=1e-4)


def test_large_between_imputation_spread_uses_t_with_few_degrees_of_freedom():
    versions = [2, 9, 4, 12, 1, 7, 10, 3, 8, 4]  # one death per crash, so W is the mean count
    iv = imputed_count_interval(versions)
    assert iv.df == pytest.approx(17.536691290924573, rel=1e-9)
    assert iv.low == 0.0
    assert iv.high == pytest.approx(17.16371229625446, rel=1e-6)


def test_as_count_noise_vanishes_the_expected_count_interval_becomes_the_realized_one():
    rt = realized_total_interval(REF_Q)
    near = imputed_count_interval(REF_Q, sums_sq=[0.01] * 10)
    assert near.df == pytest.approx(9.0, rel=0.01)
    assert (near.low, near.high) == pytest.approx((rt.low, rt.high), rel=2e-3)


def test_the_realized_total_has_no_interval_without_imputation_spread_and_respects_its_bounds():
    for versions in ([300.0] * 10, [7.0]):
        rt = realized_total_interval(versions)
        assert rt.low == rt.high == rt.estimate and rt.se == 0.0 and math.isinf(rt.df)
    rt = realized_total_interval([0, 0, 0, 0, 0, 0, 0, 0, 1, 5], upper=4.0)
    assert rt.low == 0.0 and rt.high == 4.0  # an imputed subset cannot exceed the deaths, nor go below zero
    with pytest.raises(ValueError):
        realized_total_interval([])


def test_the_interval_never_goes_below_zero_and_keeps_small_counts_exact():
    iv = imputed_count_interval([2, 2, 2, 2, 2, 0, 0, 0, 0, 0])
    assert iv.estimate == 1.0 and iv.low == 0.0 and iv.high > poisson_interval(1.0)[1]
    assert imputed_count_interval([0.0] * 10).high == pytest.approx(poisson_interval(0)[1])
    with pytest.raises(ValueError):
        imputed_count_interval([])


def test_rate_interval_scales_by_the_denominator():
    rate, low, high = rate_interval(count_interval(50), 2_000_000)
    assert rate == pytest.approx(2.5)
    iv = count_interval(50)
    assert (low, high) == pytest.approx((iv.low * 5e-2, iv.high * 5e-2))
    with pytest.raises(ValueError):
        rate_interval(iv, 0)


def test_difference_z_uses_both_errors():
    assert difference_z(10, 3, 4, 4) == pytest.approx(6 / 5)
    assert difference_z(1, 0, 1, 0) is None


# ----- the FARS adapter carries the interval -------------------------------------------------------------------


def _zip(tmp_path):
    p = tmp_path / "FARS2020NationalCSV.zip"
    with zipfile.ZipFile(p, "w") as z:
        z.writestr("FARS2020NationalCSV/accident.csv", ACCIDENT)
        z.writestr("FARS2020NationalCSV/MIDRVACC.CSV", MIDRVACC)
        z.writestr("FARS2020NationalCSV/MIACC.CSV", MIACC)
    return p


def _staged(tmp_path):
    items = list(parse_fars(_asset(), _zip(tmp_path)))
    assert not [i for i in items if isinstance(i, Rejected)]
    return {(s.geo_id, s.measure_id): s for s in items if isinstance(s, Staged)}


def test_every_fars_count_has_an_interval_that_contains_it(tmp_path):
    got = _staged(tmp_path)
    for s in got.values():
        assert s.ci_low is not None and s.ci_high is not None and s.ci_level == 0.95
        assert 0 <= s.ci_low <= s.value <= s.ci_high
        assert s.standard_error is not None and s.standard_error > 0
        assert s.extra["interval_basis"] in ("count_noise", "count_noise_and_imputation")


def test_traffic_deaths_carry_count_noise_only_and_imputed_deaths_carry_both(tmp_path):
    got = _staged(tmp_path)
    ut_all = got[("state:49", "fars_traffic_fatalities")]
    assert ut_all.extra["interval_basis"] == "count_noise"
    # Utah's crashes kill 2, 1 and 1: compound Poisson variance 6, not 4.
    assert ut_all.extra["sum_sq_deaths_per_crash"] == 6
    want = count_interval(4, sum_sq=6)
    assert (ut_all.ci_low, ut_all.ci_high) == pytest.approx(
        (round(want.low, 3), round(want.high, 3)), abs=1e-9
    )
    assert ut_all.standard_error == pytest.approx(round(math.sqrt(6), 4))
    ut = got[("state:49", "fars_alcohol_impaired_driving_fatalities")]
    assert ut.extra["interval_basis"] == "count_noise_and_imputation"
    assert ut.extra["imputation_se"] > 0  # Utah's one impaired crash is impaired in 5 of 10 imputations
    assert ut.ci_high > round(poisson_interval(1.0)[1], 3)
    # The two targets: t with Rubin's df behind ci_low/ci_high, and the deaths that occurred apart.
    assert ut.extra["rubin_df"] is not None and ut.extra["rubin_df"] >= 9
    rt = ut.extra["realized_total"]
    assert rt["df"] == 9 and rt["ci_level"] == 0.95
    assert 0 <= rt["ci_low"] <= ut.value <= rt["ci_high"] <= ut_all.value  # never more than all deaths
    assert rt["ci_high"] - rt["ci_low"] < ut.ci_high - ut.ci_low  # no count noise in the realized total
    tn = got[("state:47", "fars_alcohol_impaired_driving_fatalities")]
    assert tn.extra["imputation_se"] == 0  # every imputation agrees, so only count noise remains
    assert tn.extra["rubin_df"] is None
    assert tn.extra["realized_total"]["ci_low"] == tn.extra["realized_total"]["ci_high"] == tn.value
    # One crash with 3 deaths: the 3 deaths stand or fall together (variance 9).
    want = count_interval(3, sum_sq=9)
    assert (tn.ci_low, tn.ci_high) == pytest.approx((round(want.low, 3), round(want.high, 3)), abs=1e-9)


def test_the_national_row_pools_the_imputations_across_states(tmp_path):
    got = _staged(tmp_path)
    us = got[("nation:us", "fars_alcohol_impaired_driving_fatalities")]
    assert us.value == 4.0 and us.ci_low <= 4.0 <= us.ci_high


# ----- the interval reaches the per-100,000 rate ----------------------------------------------------------------

DEATHS = {
    "measure_id": "fars_alcohol_impaired_driving_fatalities",
    "period_kind": "calendar_year",
    "geo_id": "state:49",
    "year": 2023,
    "value": 63.1,
    "missing_reason": None,
    "observation_id": "d1",
    "period_start": date(2023, 1, 1),
    "period_end": date(2023, 12, 31),
    "period_label": "2023",
    "subgroup": "all",
}
POP = {("pop_total_resident", "state:49", date(2023, 7, 1)): {"value": 3449259.0, "observation_id": "p1"}}


def test_rate_interval_is_the_count_interval_per_100k():
    deaths = {
        **DEATHS,
        "ci_low": 48.0,
        "ci_high": 80.0,
        "ci_level": 0.95,
        "standard_error": 8.1,
        "interval_basis": "count_noise_and_imputation",
    }
    ((row, _, _),) = fars_rates([deaths], POP)
    scale = 100000.0 / 3449259.0
    assert row["ci_low"] == pytest.approx(48.0 * scale) and row["ci_high"] == pytest.approx(80.0 * scale)
    assert row["standard_error"] == pytest.approx(8.1 * scale) and row["ci_level"] == 0.95
    assert row["ci_low"] < row["value"] < row["ci_high"]
    assert row["extra"] == {
        "interval_basis": "count_noise_and_imputation",
        "population_treated_as_exact": True,
    }


def test_no_interval_without_one_on_the_deaths_or_without_a_population():
    ((row, _, _),) = fars_rates([DEATHS], POP)
    assert "ci_low" not in row
    ((row, _, _),) = fars_rates([{**DEATHS, "year": 2024, "ci_low": 1.0, "ci_high": 2.0}], POP)
    assert row["value"] is None and "ci_low" not in row


def test_the_build_query_hands_the_interval_to_the_derivations():
    """observation_details -> preferred observations -> fars_rates, through the same SQL the build uses."""
    con = duckdb.connect()
    db.create_schema(con)
    base = {
        "geo_id": "state:49",
        "period_start": date(2023, 1, 1),
        "period_end": date(2023, 12, 31),
        "period_kind": "calendar_year",
        "period_label": "2023",
        "year": 2023,
        "subgroup": "all",
        "estimate_type": "modeled_estimate",
        "extraction_method": "csv_parser",
        "asset_id": "fars_2023",
        "source_locator": "x",
        "source_series": "nhtsa_fars",
        "source_vintage": "v",
        "comparability_group": "g",
    }
    obs = [
        {
            **base,
            "observation_id": "d1",
            "measure_id": "fars_alcohol_impaired_driving_fatalities",
            "value": 63.1,
        }
    ]
    det = [
        {
            "observation_id": "d1",
            "ci_low": 48.0,
            "ci_high": 80.0,
            "ci_level": 0.95,
            "standard_error": 8.1,
            "extra": '{"interval_basis": "count_noise_and_imputation"}',
        }
    ]
    db.insert_rows(con, "observations", obs)
    db.insert_rows(con, "observation_details", det)
    db.insert_rows(
        con,
        "preferred_selection",
        [
            {
                "cell_key": "k",
                "observation_id": "d1",
                "rank": 1,
                "candidate_count": 1,
                "reason": "single candidate",
            }
        ],
    )
    con.execute(prefer.PREFERRED_VIEW)
    cols = [d[0] for d in con.execute(DERIVE_INPUT_SQL + " LIMIT 0").description]
    rows = [dict(zip(cols, r, strict=True)) for r in con.execute(DERIVE_INPUT_SQL).fetchall()]
    assert rows[0]["ci_low"] == 48.0 and rows[0]["interval_basis"] == "count_noise_and_imputation"
    ((row, _, _),) = fars_rates(rows, POP)
    assert row["ci_high"] == pytest.approx(80.0 * 100000.0 / 3449259.0)
    assert row["extra"]["interval_basis"] == "count_noise_and_imputation"


@pytest.mark.parametrize(
    ("df", "crit"),
    # Standard table values of t(0.975, df).
    [(1, 12.7062), (2, 4.3027), (5, 2.5706), (10, 2.2281), (16, 2.1199), (30, 2.0423), (120, 1.9799)],
)
def test_t_critical_matches_the_table(df, crit):
    assert t_critical(0.95, df) == pytest.approx(crit, abs=5e-5)


def test_t_approaches_the_normal_and_is_symmetric():
    assert t_critical(0.95, 100000) == pytest.approx(1.95996, abs=1e-3)
    assert t_quantile(0.1, 5) == pytest.approx(-t_quantile(0.9, 5))
    assert t_quantile(0.5, 7) == 0.0
    assert t_cdf(0.0, 3) == pytest.approx(0.5)
    assert t_cdf(t_quantile(0.8, 9), 9) == pytest.approx(0.8, abs=1e-12)
