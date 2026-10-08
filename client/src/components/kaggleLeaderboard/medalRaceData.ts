/**
 * Author: GPT-6 Codex
 * Date: 2026-10-07
 * PURPOSE: Select honest rank windows and score bounds for the medal-race chart; locate
 *          observed teams and cutoff gaps without clipping scores or inventing missing ranks.
 * SRP/DRY check: Pass — pure presentation calculations over the existing board snapshot.
 */
import type { KaggleBoardLatest, KaggleBoardRow } from '@shared/types';

export type MedalRaceView = 'gold' | 'medals' | 'all';

export function nearestRankIndex(rows: readonly KaggleBoardRow[], rank: number): number {
  if (!rows.length) return -1;
  let lo = 0;
  let hi = rows.length - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (rows[mid][0] < rank) lo = mid + 1;
    else hi = mid;
  }
  return lo > 0 && Math.abs(rows[lo - 1][0] - rank) <= Math.abs(rows[lo][0] - rank) ? lo - 1 : lo;
}

export function medalRaceWindow(latest: KaggleBoardLatest, view: MedalRaceView) {
  const rows = latest.rows.filter((row) => Number.isFinite(row[0]) && row[0] >= 1 && Number.isFinite(row[4]))
    .slice().sort((a, b) => a[0] - b[0]);
  if (!rows.length) return null;
  const first = rows[0][0];
  const last = rows[rows.length - 1][0];
  const gold = Number.isFinite(latest.medalRanks.gold) ? latest.medalRanks.gold : first;
  let from = first;
  let to = last;
  if (view === 'gold') {
    // Focus near the cutoff rather than flattening it beneath runaway leaders.
    const pivot = rows[nearestRankIndex(rows, gold)][0];
    from = Math.max(first, pivot - Math.max(5, Math.ceil(gold / 2)));
    to = Math.min(last, pivot + Math.max(8, Math.ceil(gold * 0.75)));
  } else if (view === 'medals') {
    const medalEnd = Math.max(...Object.values(latest.medalRanks).filter(Number.isFinite), first);
    to = Math.min(last, Math.ceil(medalEnd * 1.08));
  }
  const shown = rows.filter((row) => row[0] >= from && row[0] <= to);
  const minScore = Math.min(...shown.map((row) => row[4]));
  const maxScore = Math.max(...shown.map((row) => row[4]));
  const margin = Math.max((maxScore - minScore) * 0.08, 0.05);
  return {
    rows, shown,
    rankMin: shown[0][0] - 0.5,
    rankMax: shown[shown.length - 1][0] + 0.5,
    scoreMin: minScore >= 0 ? Math.max(0, minScore - margin) : minScore - margin,
    scoreMax: maxScore + margin,
  };
}

export function medalBoundary(rows: readonly KaggleBoardRow[], cutoffRank: number) {
  const cutoff = rows.find((row) => row[0] === cutoffRank) ?? null;
  const outside = rows.find((row) => row[0] === cutoffRank + 1) ?? null;
  return { cutoff, outside, gap: cutoff && outside ? cutoff[4] - outside[4] : null };
}

export function rankTickValues(first: number, last: number, count: number): number[] {
  const steps = Math.max(1, Math.floor(count) - 1);
  return [...new Set(Array.from({ length: steps + 1 }, (_, i) => Math.round(first + (last - first) * i / steps)))];
}
