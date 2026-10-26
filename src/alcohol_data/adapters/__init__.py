"""Source adapters. Importing this package registers every adapter in ADAPTERS."""

from alcohol_data.adapters import (  # noqa: F401
    bea_regional,
    bea_sapce,
    bls_cpi,
    cdc_brfss,
    cdc_cdi,
    cdc_yrbs,
    census_cbp,
    census_econ,
    census_govfin,
    census_msrs,
    census_pep,
    census_stc,
    census_trade_margins,
    dabs_sales_analysis,
    nhtsa_fars,
    niaaa_pcyr,
    tn_dor_collections,
)
from alcohol_data.adapters.base import ADAPTERS, Rejected, Staged

__all__ = ["ADAPTERS", "Rejected", "Staged"]
