/**
 * Author: Claude Opus 5.5
 * Date: 2026-10-05
 * PURPOSE: Data layer for the public /kaggle-leaderboard page. Fetches the full ARC-AGI-3
 *          Kaggle board (GET /api/kaggle/:competition/board) and its static pre-history
 *          (GET .../board/backfill), merges the two the way the original arc-3 page did,
 *          and exposes the small lookups every section shares: medal of a rank, our row,
 *          the snapshot nearest a time, a team's score at a time, and plain-English "ago".
 *
 *          Ported from docs/static/js/leaderboard.js in the arc-3 repo, where this page
 *          lived behind a sign-in until 05-Oct-2026.
 * SRP/DRY check: Pass - data and pure helpers only; every section component renders from
 *          the BoardModel returned here and none of them fetch on their own.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type {
  KaggleBoardBackfill,
  KaggleBoardEvent,
  KaggleBoardHistory,
  KaggleBoardLatest,
  KaggleBoardPayload,
  KaggleBoardRow,
  KaggleBoardSnap,
} from '@shared/types';

export const COMPETITION = 'arc-prize-2026-arc-agi-3';
export const KAGGLE_URL = `https://www.kaggle.com/competitions/${COMPETITION}/leaderboard`;
/** Competition close; medals are settled on the private board then. */
export const CLOSE_MS = Date.parse('2026-11-02T00:00:00Z');
const DAY_MS = 864e5;

export type Medal = 'gold' | 'silver' | 'bronze';

/** Solid medal colours, chosen to read on both the light and the dark theme. */
export const MEDAL_COLOR: Record<Medal, string> = {
  gold: '#c9971c',
  silver: '#8b95a7',
  bronze: '#b0703f',
};
/** Our team, everywhere. The site's primary blue, so it follows the theme. */
export const US_COLOR = 'var(--primary)';
/**
 * Lines for other watched teams: slots 2-8 of the validated categorical palette (slot 1,
 * blue, is ours). Defined as CSS variables on .kaggle-lb in index.css with their own dark
 * steps. Seven slots, so at most seven other teams are drawn at once.
 */
export const SERIES = ['--kl-2', '--kl-3', '--kl-4', '--kl-5', '--kl-6', '--kl-7', '--kl-8'].map((v) => `var(${v})`);

/**
 * Colour follows the team, not its position in the list: each team hashes to a preferred
 * slot and takes the next free one on a clash, so starring or removing one team does not
 * repaint the others.
 */
export function seriesColors(ids: string[], ourId: string): Map<string, string> {
  const out = new Map<string, string>();
  const used = new Set<number>();
  for (const id of ids) {
    if (id === ourId) { out.set(id, US_COLOR); continue; }
    let h = 0;
    for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    let slot = h % SERIES.length;
    for (let k = 0; k < SERIES.length && used.has(slot); k++) slot = (slot + 1) % SERIES.length;
    used.add(slot);
    out.set(id, SERIES[slot]);
  }
  return out;
}

/** Kaggle's medal cut ranks for a board of n teams (same rule as the snapshot script). */
export function medalRanksFor(n: number) {
  return { gold: Math.min(n, 10 + Math.floor(n * 0.002)), silver: Math.max(1, Math.floor(n * 0.05)), bronze: Math.max(1, Math.floor(n * 0.1)) };
}

/** A Kaggle user's public profile. */
export const profileUrl = (username: string) => `https://www.kaggle.com/${encodeURIComponent(username)}`;
export const membersOf = (row: KaggleBoardRow | undefined) => (row ? row[6].split(',').map((m) => m.trim()).filter(Boolean) : []);

export interface BoardModel {
  latest: KaggleBoardLatest;
  history: KaggleBoardHistory;
  /** Oldest first. */
  events: KaggleBoardEvent[];
  ourRow: KaggleBoardRow | null;
  byId: Map<string, KaggleBoardRow>;
  medalOf: (rank: number) => Medal | null;
}

export const fmt = (n: number) => n.toFixed(2);

export function ago(iso: string): string {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (m < 2) return 'just now';
  if (m < 90) return `${m} minutes ago`;
  if (m < 2880) return `${Math.round(m / 60)} hours ago`;
  return `${Math.round(m / 1440)} days ago`;
}

/** Backfill events are stamped at 23:59 UTC of their day: show the day, not "n days ago". */
export function whenText(iso: string): string {
  if (iso.endsWith('T23:59:00Z')) {
    return new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  return ago(iso);
}

export const shortDate = (t: number) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/** The saved snapshot whose time is closest to `t`. */
export function snapNearest(snaps: KaggleBoardSnap[], t: number): KaggleBoardSnap | null {
  if (!snaps.length) return null;
  return snaps.reduce((a, b) => (Math.abs(Date.parse(b.t) - t) < Math.abs(Date.parse(a.t) - t) ? b : a));
}

/** A team's last trail point at or before `t`: [time, score, rank], or null. */
export function trailAt(history: KaggleBoardHistory, id: string, t: number): [string, number, number] | null {
  let found: [string, number, number] | null = null;
  for (const p of history.trails[id]?.pts ?? []) {
    if (Date.parse(p[0]) <= t) found = p;
    else break;
  }
  return found;
}

export const weekAgoMs = () => Date.now() - 7 * DAY_MS;
export { DAY_MS };

/**
 * Past days come from the backfill; our own half-hourly snapshots take over from the first
 * one we saved. Same rule for snaps, each trail, and the events feed.
 */
function mergeBackfill(history: KaggleBoardHistory, events: KaggleBoardEvent[], back: KaggleBoardBackfill | null) {
  if (!back) return { history, events };
  const own0 = history.snaps[0]?.t ?? '9999';
  const snaps = back.snaps.filter((s) => s.t < own0).concat(history.snaps);
  const trails = { ...history.trails };
  for (const [id, tr] of Object.entries(back.trails)) {
    const mine = trails[id] ?? { name: tr.name, pts: [] };
    const first = mine.pts[0]?.[0] ?? '9999';
    trails[id] = { name: mine.name, pts: tr.pts.filter((p) => p[0] < first).concat(mine.pts) };
  }
  const ownE = events[0]?.t ?? '9999';
  return { history: { snaps, trails }, events: back.events.filter((e) => e.t < ownE).concat(events) };
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export interface BoardQuery {
  model: BoardModel | null;
  isLoading: boolean;
  error: Error | null;
  /** True when the request worked but nothing has been pushed yet. */
  isEmpty: boolean;
}

export function useKaggleBoard(): BoardQuery {
  const board = useQuery({
    queryKey: ['kaggle-board', COMPETITION],
    queryFn: () => getJson<KaggleBoardPayload>(`/api/kaggle/${COMPETITION}/board`),
    staleTime: 5 * 60 * 1000,
    // The job saves every 30 minutes; checking every 10 keeps an open tab honest.
    refetchInterval: 10 * 60 * 1000,
  });
  const backfill = useQuery({
    queryKey: ['kaggle-board-backfill', COMPETITION],
    queryFn: () => getJson<KaggleBoardBackfill | null>(`/api/kaggle/${COMPETITION}/board/backfill`),
    staleTime: Infinity,
  });

  const model = useMemo<BoardModel | null>(() => {
    const data = board.data;
    if (!data?.latest) return null;
    const latest = data.latest;
    const merged = mergeBackfill(
      data.history ?? { snaps: [], trails: {} },
      data.events ?? [],
      // The backfill is a nicety; if it failed, the page still works from our own saves.
      backfill.data ?? null,
    );
    const byId = new Map(latest.rows.map((r) => [r[1], r] as const));
    const { gold, silver, bronze } = latest.medalRanks;
    return {
      latest,
      history: merged.history,
      events: merged.events,
      ourRow: byId.get(latest.ourTeamId) ?? null,
      byId,
      medalOf: (rank) => (rank <= gold ? 'gold' : rank <= silver ? 'silver' : rank <= bronze ? 'bronze' : null),
    };
  }, [board.data, backfill.data]);

  return {
    model,
    // Wait for the backfill too (or its failure), so the charts do not redraw from a
    // short history to a long one a moment after the page appears.
    isLoading: board.isLoading || backfill.isLoading,
    error: board.error as Error | null,
    isEmpty: !!board.data && !board.data.latest,
  };
}

/** The one time window shared by every over-time chart on the page. */
export type TimeRange = 'week' | 'month' | 'since-aug' | 'all';
export const TIME_RANGES: Array<[TimeRange, string]> = [
  ['week', 'Past week'],
  ['month', 'Past month'],
  ['since-aug', 'Since August'],
  ['all', 'Whole contest'],
];

/**
 * [start, end] in ms for a window. Short windows end at the latest save; long ones run on
 * to the close so the remaining runway shows.
 */
export function rangeBounds(range: TimeRange, model: BoardModel): [number, number] {
  const now = Date.parse(model.latest.fetched);
  const first = model.history.snaps.length ? Date.parse(model.history.snaps[0].t) : now - 30 * DAY_MS;
  switch (range) {
    case 'week': return [now - 7 * DAY_MS, now];
    case 'month': return [now - 30 * DAY_MS, now];
    case 'since-aug': return [Date.parse('2026-08-01T00:00:00Z'), Math.max(now, CLOSE_MS)];
    case 'all': return [first, Math.max(now, CLOSE_MS)];
  }
}

/** Date ticks across a window, five of them. */
export function timeTicks(t0: number, t1: number, x: (t: number) => number): Array<[number, string, 'start' | 'middle' | 'end']> {
  return [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const t = t0 + f * (t1 - t0);
    return [x(t), shortDate(t), f === 0 ? 'start' : f === 1 ? 'end' : 'middle'];
  });
}
