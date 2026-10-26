"""BLS Consumer Price Index (CPI-U, U.S. city average, all items, not seasonally adjusted).

Monthly index values (1982-84 = 100) from the BLS Public Data API. A month
published as unavailable (e.g. '-' with footnote 'Data unavailable due to the
2025 lapse in appropriations') is stored as missing, never interpolated.
"""

from __future__ import annotations

import json
from calendar import monthrange
from datetime import date
from pathlib import Path

from alcohol_data.adapters.base import NATION, Rejected, Staged, register
from alcohol_data.config import AssetConfig

SERIES = {"CUUR0000SA0": "bls_cpi_u_us_all_items_nsa"}


@register("bls_cpi_api", "1.0")
def parse(asset: AssetConfig, path: Path):
    payload = json.loads(path.read_text(encoding="utf-8"))
    if payload.get("status") != "REQUEST_SUCCEEDED":
        yield Rejected("response", f"BLS status {payload.get('status')}")
        return
    for s_i, series in enumerate(payload["Results"]["series"]):
        sid = series["seriesID"]
        measure = SERIES.get(sid)
        if measure is None:
            yield Rejected(f"series[{s_i}]", f"unexpected series {sid}")
            continue
        for d_i, obs in enumerate(series["data"]):
            period = obs["period"]
            if not (period.startswith("M") and period[1:].isdigit()):
                yield Rejected(f"series[{s_i}].data[{d_i}]", f"unexpected period {period}")
                continue
            m = int(period[1:])
            if m == 13:
                continue  # annual averages are not used; averages are computed over the exact months needed
            y = int(obs["year"])
            raw = obs["value"].strip()
            notes = "; ".join(fn.get("text", "") for fn in obs.get("footnotes", []) if fn and fn.get("text"))
            try:
                value = float(raw)
                missing = None
            except ValueError:
                value, missing = None, "unavailable"
            yield Staged(
                geo_id=NATION,
                measure_id=measure,
                period_start=date(y, m, 1),
                period_end=date(y, m, monthrange(y, m)[1]),
                period_kind="month",
                period_label=f"{y}-{m:02d}",
                year=y,
                value=value,
                missing_reason=missing,
                source_locator=f"Results.series[{s_i}] ({sid}).data[{d_i}] year={y} period={period}",
                estimate_type="official_estimate",
                extraction_method="api",
                comparability_group=f"bls_cpi|{sid}",
                source_code=sid,
                raw_value=raw,
                raw_unit="index_1982_84_eq_100",
                multiplier=1.0,
                footnote=notes or None,
            )
