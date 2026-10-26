"""Expand policy intervals into period exposure and coverage segments.

Rules (docs/policy-coding-guide.md):
* intervals are half-open [start, end);
* a day is covered only if evidence establishes the value on that day. An unknown
  start is never assumed; known_in_effect_from / known_in_effect_through bound what
  the evidence shows when the enactment history has not been traced;
* days with no verified status are unknown, and any period containing an unknown
  day gets no exposure fraction, but keeps its verified days and min/max bounds;
* days after the build's as-of date are future, not historical observations;
* two different values verified for the same day is a conflict; those days count
  as unknown in exposure and as 'disputed' in segments, and validation reports them;
* a state provision that only applies where localities adopt it gives
  local_option_unknown unless local adoption data exist (none yet);
* exposure is legal time exposed, not market penetration or store counts.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta

from alcohol_data.fiscal import fiscal_period_for

DERIVATION_VERSION = "policy_exposure@1.1"
SEGMENTS_FROM = date(1990, 1, 1)


def known_window(ev: dict) -> tuple[date, date] | None:
    """[first, last+1) days the evidence establishes for this interval, or None if no day is established."""
    start = ev.get("effective_start") or ev.get("known_in_effect_from")
    if start is None:
        return None
    if ev["end_status"] == "superseded" and ev.get("effective_end"):
        end = ev["effective_end"]
    elif ev.get("known_in_effect_through"):
        end = ev["known_in_effect_through"] + timedelta(days=1)
        if ev.get("effective_end"):
            end = min(end, ev["effective_end"])
    else:
        return None
    return (start, end) if end > start else None


def _days(a: date, b: date):
    d = a
    while d < b:
        yield d
        d += timedelta(days=1)


def day_status(events: list[dict], as_of: date | None = None):
    """Per day up to as_of: values verified, policy_ids used, and whether the value needs local adoption."""
    values: dict[date, set[str]] = defaultdict(set)
    ids: dict[date, set[str]] = defaultdict(set)
    local: dict[date, bool] = defaultdict(bool)
    for ev in events:
        w = known_window(ev)
        if w is None:
            continue
        end = min(w[1], as_of + timedelta(days=1)) if as_of else w[1]
        for d in _days(w[0], end):
            values[d].add(ev["policy_value"])
            ids[d].add(ev["policy_id"])
            if ev["requires_local_adoption"]:
                local[d] = True
    return values, ids, local


def periods_for(geo_id: str, years: range, kind: str):
    for y in years:
        if kind == "calendar_year":
            yield y, date(y, 1, 1), date(y, 12, 31)
        else:
            p = fiscal_period_for(geo_id, y)
            if p is not None:
                yield y, p[0], p[1]


def _by_dimension(events):
    by_dim: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for ev in events:
        by_dim[(ev["geo_id"], ev["policy_dimension"])].append(ev)
    return by_dim


def expand(events: list[dict], year_range: tuple[int, int], as_of: date) -> list[dict]:
    years = range(year_range[0], year_range[1] + 1)
    out = []
    for (geo_id, dim), evs in sorted(_by_dimension(events).items()):
        values, ids, local = day_status(evs, as_of)
        dim_values = sorted({e["policy_value"] for e in evs})
        for kind in ("calendar_year", "state_fiscal_year"):
            for y, start, end in periods_for(geo_id, years, kind):
                days = list(_days(start, end + timedelta(days=1)))
                for v in dim_values:
                    covered = other = unknown = future = 0
                    used: set[str] = set()
                    local_needed = False
                    for d in days:
                        if d > as_of:
                            future += 1
                            continue
                        vs = values.get(d)
                        if not vs or len(vs) > 1:  # no evidence, or conflicting evidence
                            unknown += 1
                            continue
                        used |= ids[d]
                        if v in vs:
                            covered += 1
                            local_needed |= local[d]
                        else:
                            other += 1
                    n = len(days)
                    if covered and local_needed:
                        status, frac = "local_option_unknown", None
                    elif future:
                        status, frac = "period_not_complete", None
                    elif unknown:
                        status, frac = "unknown", None
                    elif covered == n:
                        status, frac = "exposed_full", 1.0
                    elif covered == 0:
                        status, frac = "not_exposed", 0.0
                    else:
                        status, frac = "exposed_partial", covered / n
                    out.append(
                        {
                            "geo_id": geo_id,
                            "policy_dimension": dim,
                            "policy_value": v,
                            "period_kind": kind,
                            "period_start": start,
                            "period_end": end,
                            "year": y,
                            "days_in_period": n,
                            "covered_days": covered,
                            "known_other_days": other,
                            "unknown_days": unknown,
                            "future_days": future,
                            "exposure_fraction": frac,
                            "exposure_fraction_min": covered / n,
                            "exposure_fraction_max": (covered + unknown + future) / n,
                            "exposure_status": status,
                            "policy_ids": "|".join(sorted(used)) or "-",
                            "derivation_version": DERIVATION_VERSION,
                        }
                    )
    return out


def segments(events: list[dict], as_of: date, start: date = SEGMENTS_FROM) -> list[dict]:
    """Continuous runs per jurisdiction and dimension from `start` to `as_of`: value, unknown, or disputed."""
    out = []
    for (geo_id, dim), evs in sorted(_by_dimension(events).items()):
        values, ids, _ = day_status(evs, as_of)
        run = None
        for d in _days(start, as_of + timedelta(days=1)):
            vs = values.get(d)
            state = "unknown" if not vs else ("disputed" if len(vs) > 1 else next(iter(vs)))
            pids = "|".join(sorted(ids[d])) if vs else "-"
            if run and run["state"] == state and run["policy_ids"] == pids:
                run["segment_end"] = d
                run["days"] += 1
            else:
                if run:
                    out.append(run)
                run = {
                    "geo_id": geo_id,
                    "policy_dimension": dim,
                    "segment_start": d,
                    "segment_end": d,
                    "days": 1,
                    "state": state,
                    "policy_ids": pids,
                    "derivation_version": DERIVATION_VERSION,
                }
        if run:
            out.append(run)
    return out


def conflicts(events: list[dict]) -> list[tuple[str, str, date, list[str]]]:
    """Days on which one jurisdiction/dimension has two different verified values."""
    found = []
    for (geo_id, dim), evs in _by_dimension(events).items():
        values, ids, _ = day_status(evs)
        for d in sorted(values):
            if len(values[d]) > 1:
                found.append((geo_id, dim, d, sorted(ids[d])))
    return found
