"""Choose one preferred observation per cell, keeping every candidate and the reason.

A cell is geography x measure x period x subgroup. Candidates come from different
source series and editions. Rules, in order:

1. higher configured asset priority wins (e.g. intercensal over postcensal, the
   newest report edition over an older one);
2. among candidates tied on priority, identical values (or all missing) are
   equivalent and the lowest observation_id is listed first;
3. tied candidates with different values are an unresolved conflict: the cell's
   preferred value is NULL with missing_reason 'unresolved_conflict' until a
   documented rule or a reviewer settles it.
"""

from __future__ import annotations

from collections import defaultdict

RULE_VERSION = "prefer@1.0"


def _same(a, b, tol=1e-9) -> bool:
    if a is None or b is None:
        return a is None and b is None
    return abs(a - b) <= tol * max(1.0, abs(a), abs(b))


def rank_cells(obs: list[dict], priority: dict[str, int]) -> list[dict]:
    cells: dict[str, list[dict]] = defaultdict(list)
    for o in obs:
        cells[o["cell_key"]].append(o)
    out = []
    for ck in sorted(cells):
        cands = cells[ck]
        cands.sort(key=lambda o: (-priority.get(o["asset_id"], 0), o["observation_id"]))
        top_p = priority.get(cands[0]["asset_id"], 0)
        tied = [o for o in cands if priority.get(o["asset_id"], 0) == top_p]
        conflict = any(not _same(t["value"], tied[0]["value"]) for t in tied[1:])
        n = len(cands)
        for i, o in enumerate(cands, start=1):
            p = priority.get(o["asset_id"], 0)
            if n == 1:
                reason = "single candidate"
            elif conflict and p == top_p:
                reason = f"unresolved_conflict: {len(tied)} candidates share priority {top_p} and report different values"
            elif i == 1:
                reason = f"highest priority ({p}) among {n} candidates" + (
                    f"; {len(tied) - 1} tied candidate(s) report the same value" if len(tied) > 1 else ""
                )
            else:
                reason = (
                    f"lower priority ({p}) than preferred ({top_p})"
                    if p < top_p
                    else "tied priority, same value; listed after first"
                )
            out.append(
                {
                    "cell_key": ck,
                    "observation_id": o["observation_id"],
                    "rank": i,
                    "candidate_count": n,
                    "reason": reason,
                }
            )
    return out


PREFERRED_VIEW = """
CREATE OR REPLACE VIEW preferred_observations AS
SELECT
  o.observation_id, o.geo_id, o.measure_id, o.period_start, o.period_end, o.period_kind, o.period_label, o.year,
  o.subgroup,
  CASE WHEN ps.reason LIKE 'unresolved_conflict%' THEN NULL ELSE o.value END AS value,
  CASE WHEN ps.reason LIKE 'unresolved_conflict%' THEN 'unresolved_conflict' ELSE o.missing_reason END AS missing_reason,
  o.estimate_type, o.extraction_method, o.asset_id, o.source_locator, o.source_series, o.source_vintage,
  o.comparability_group, o.quality_flags, o.review_status, ps.candidate_count, ps.reason AS selection_reason
FROM observations o
JOIN preferred_selection ps ON ps.observation_id = o.observation_id AND ps.rank = 1;
"""
