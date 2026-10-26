// Utah at a glance: Utah's latest value on a measure and its rank among states with a comparable value. A
// value is comparable only for the same period, the same definition (comparability group) and the same form
// (as published, per resident, ...), so Utah's latest year is never ranked against other states' later years.

import { rankIntervals, type RankItem } from "./ranks";

export interface GlancePoint {
  year: number;
  value: number | null;
  group: string;
  /** Standard error of the value from its published interval, when there is one. */
  se?: number | null;
}

export interface Standing {
  /** The comparison period: Utah's latest year with a value. */
  year: number;
  value: number;
  group: string;
  /** 1 = highest; states with equal values share a rank. */
  rank: number;
  /** States (including Utah) with a value for the same year and definition. */
  n: number;
  /** States whose latest value is later than the comparison year (left out of this ranking, not compared). */
  laterElsewhere: number;
  /** States with a value for the year under another definition (left out). */
  otherDefinition: number;
  /** How far the rank could move given the states' sampling error (5th to 95th percentile of simulated ranks); null when no ranked state has a published interval. */
  rankRange: { low: number; high: number; /** ranked states with a published interval */ withMargins: number; /** Utah's own value has one */ ownMargin: boolean } | null;
}

/** Utah's standing on one measure, or the reason there is none. */
export function standing(byGeo: Map<string, GlancePoint[]>, target: string): Standing | { why: string } {
  const own = (byGeo.get(target) ?? []).filter((p) => p.value !== null).sort((a, b) => b.year - a.year);
  if (!own.length) return { why: "no value for this state" };
  const { year, group } = own[0];
  const value = own[0].value!;
  const peers: RankItem[] = [];
  let laterElsewhere = 0;
  let otherDefinition = 0;
  for (const [geo, pts] of byGeo) {
    if (!geo.startsWith("state:")) continue;
    const valued = pts.filter((p) => p.value !== null);
    const same = valued.find((p) => p.year === year && p.group === group);
    if (same) peers.push({ id: geo, value: same.value!, se: same.se ?? null });
    else if (valued.some((p) => p.year === year)) otherDefinition += 1;
    if (geo !== target && valued.some((p) => p.year > year)) laterElsewhere += 1;
  }
  if (peers.length < 2) return { why: `only ${peers.length} state with a ${year} value under this definition` };
  const withMargins = peers.filter((p) => p.se).length;
  const iv = withMargins ? rankIntervals(peers).get(target) : undefined;
  const rankRange = iv ? { low: iv.low, high: iv.high, withMargins, ownMargin: iv.hasSe } : null;
  return { year, value, group, rank: 1 + peers.filter((p) => p.value > value).length, n: peers.length, laterElsewhere, otherDefinition, rankRange };
}
