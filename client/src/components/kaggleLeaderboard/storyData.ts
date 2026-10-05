/**
 * Author: Claude Opus 5.5
 * Date: 2026-10-05
 * PURPOSE: The "leaderboard drama", computed from the board at render time: who is rocketing
 *          up, who is sinking (and whether they have stopped submitting), who is grinding up
 *          one improvement at a time, the biggest single jumps, new faces in the top 100,
 *          how long the leader has held first place, who sits just under the gold line, and
 *          how much ground teams lose by standing still while the field improves.
 *
 *          NOTHING HERE IS WRITTEN BY HAND. Every story is a pure function of the BoardModel,
 *          so it is as fresh as the last save and needs no editing when the board moves. The
 *          arc3 landing page has a long record of hand-written claims going stale (see the
 *          header of SyntheticLanding.tsx); this is the opposite of that.
 *
 *          CADENCE. Trails mix one point a day (the backfill, before 4 Oct 2026) with
 *          half-hourly points (our own saves). Every measure here is either a rank or score
 *          difference between two moments, or a count of score INCREASES, so the density of
 *          points cannot fake a signal; at worst two same-day improvements in the backfill
 *          count as one.
 *
 *          COVERAGE. Trails are kept for the top 300 and us, so rank-change stories cover
 *          teams that were in the top 300 at both ends of the window. Teams that arrived
 *          from further down show up under "New faces" instead.
 * SRP/DRY check: Pass - pure functions over BoardModel, shared by the leaderboard page and
 *          the arc3 landing page through Storylines.tsx and OurStandingCard.tsx; no fetching, no rendering.
 */

import { DAY_MS, snapNearest, trailAt, type BoardModel } from './boardData';
import type { KaggleBoardRow } from '@shared/types';

export interface StoryItem {
  row: KaggleBoardRow;
  /** The headline figure, e.g. "▲ 214". */
  value: string;
  /** A short qualifier, e.g. "#402 → #188". */
  detail?: string;
}

export interface Story {
  key: string;
  title: string;
  /** One sentence saying what the list measures. */
  blurb: string;
  items: StoryItem[];
}

const LIMIT = 5;
const fmt2 = (n: number) => n.toFixed(2);
const daysAgo = (iso: string, now: number) => Math.floor((now - Date.parse(iso.replace(' ', 'T') + (iso.includes('Z') ? '' : 'Z'))) / DAY_MS);

/** Rank and score now and at `t`, for every current team with a trail point at or before `t`. */
function changesSince(model: BoardModel, t: number) {
  const out: Array<{ row: KaggleBoardRow; rankThen: number; scoreThen: number }> = [];
  for (const [id, trail] of Object.entries(model.history.trails)) {
    const row = model.byId.get(id);
    if (!row || !trail.pts.length) continue;
    const then = trailAt(model.history, id, t);
    if (then) out.push({ row, rankThen: then[2], scoreThen: then[1] });
  }
  return out;
}

export function computeStories(model: BoardModel): Story[] {
  const now = Date.parse(model.latest.fetched);
  const weekAgo = now - 7 * DAY_MS;
  const twoWeeks = now - 14 * DAY_MS;
  const month = now - 30 * DAY_MS;
  const rows = model.latest.rows;
  const { gold } = model.latest.medalRanks;
  const stories: Story[] = [];

  // ── Rocketing up: biggest rank gains over the week.
  const week = changesSince(model, weekAgo);
  stories.push({
    key: 'risers',
    title: 'Rocketing up',
    blurb: 'Most places gained in the past week.',
    items: week
      .filter((c) => c.rankThen > c.row[0])
      .sort((a, b) => b.rankThen - b.row[0] - (a.rankThen - a.row[0]))
      .slice(0, LIMIT)
      .map((c) => ({ row: c.row, value: `▲ ${c.rankThen - c.row[0]}`, detail: `#${c.rankThen} → #${c.row[0]}` })),
  });

  // ── Sinking: biggest rank losses over the week, with how long since they last submitted.
  stories.push({
    key: 'sinkers',
    title: 'Sinking',
    blurb: 'Most places lost in the past week. Mostly teams that have gone quiet while everyone else kept submitting.',
    items: week
      .filter((c) => c.row[0] > c.rankThen)
      .sort((a, b) => b.row[0] - b.rankThen - (a.row[0] - a.rankThen))
      .slice(0, LIMIT)
      .map((c) => {
        const quiet = daysAgo(c.row[3], now);
        return {
          row: c.row,
          value: `▼ ${c.row[0] - c.rankThen}`,
          detail: `#${c.rankThen} → #${c.row[0]}${quiet >= 2 ? ` · quiet ${quiet} days` : ''}`,
        };
      }),
  });

  // ── Grinding: the most separate score improvements in a month. Steady, not lucky.
  const grind: Array<{ row: KaggleBoardRow; ups: number; gain: number }> = [];
  for (const [id, trail] of Object.entries(model.history.trails)) {
    const row = model.byId.get(id);
    if (!row) continue;
    let prev = trailAt(model.history, id, month)?.[1] ?? null;
    let ups = 0;
    const start = prev;
    for (const p of trail.pts) {
      if (Date.parse(p[0]) <= month) continue;
      if (prev != null && p[1] > prev + 0.004) ups++;
      prev = p[1];
    }
    if (ups >= 3) grind.push({ row, ups, gain: row[4] - (start ?? 0) });
  }
  stories.push({
    key: 'grinders',
    title: 'Grinding up',
    blurb: 'Most separate score improvements in the past month: steady work, not one lucky run.',
    items: grind
      .sort((a, b) => b.ups - a.ups || b.gain - a.gain)
      .slice(0, LIMIT)
      .map((g) => ({ row: g.row, value: `${g.ups} steps`, detail: `+${fmt2(g.gain)} to ${fmt2(g.row[4])}` })),
  });

  // ── Biggest single jumps in two weeks, from the feed of score changes.
  const best = new Map<string, { gain: number; t: string; from: number; to: number }>();
  for (const e of model.events) {
    if (e.from == null || Date.parse(e.t) < twoWeeks) continue;
    const gain = e.to - e.from;
    const cur = best.get(e.id);
    if (gain > 0 && (!cur || gain > cur.gain)) best.set(e.id, { gain, t: e.t, from: e.from, to: e.to });
  }
  stories.push({
    key: 'jumps',
    title: 'Biggest single jumps',
    blurb: 'Largest score gain from one save to the next in the past two weeks.',
    items: [...best.entries()]
      .map(([id, b]) => ({ row: model.byId.get(id), b }))
      .filter((x): x is { row: KaggleBoardRow; b: { gain: number; t: string; from: number; to: number } } => !!x.row)
      .sort((a, b) => b.b.gain - a.b.gain)
      .slice(0, LIMIT)
      .map(({ row, b }) => ({
        row,
        value: `+${fmt2(b.gain)}`,
        detail: `${fmt2(b.from)} → ${fmt2(b.to)} · ${new Date(b.t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
      })),
  });

  // ── New faces: teams in the top 100 now whose first kept trail point is within two weeks.
  stories.push({
    key: 'new',
    title: 'New faces',
    blurb: 'In the top 100 now, and nowhere near it two weeks ago.',
    items: rows
      .filter((r) => r[0] <= 100)
      .map((r) => ({ r, then: trailAt(model.history, r[1], twoWeeks) }))
      .filter(({ then }) => !then || then[2] > 300)
      .slice(0, LIMIT)
      .map(({ r, then }) => ({ row: r, value: `#${r[0]}`, detail: then ? `was #${then[2]}` : 'outside the top 300' })),
  });

  // ── On the bubble: just outside gold, closest to the line.
  const goldLine = rows[gold - 1][4];
  stories.push({
    key: 'bubble',
    title: 'On the bubble',
    blurb: `Just below the gold line (${fmt2(goldLine)}). One good submission away.`,
    items: rows
      .slice(gold, gold + LIMIT)
      .map((r) => ({ row: r, value: `−${fmt2(goldLine - r[4])}`, detail: `#${r[0]} · ${fmt2(r[4])}` })),
  });

  return stories.filter((s) => s.items.length > 0);
}

export interface Headlines {
  /** The leader and how long they have held first place without a break. */
  leader: { row: KaggleBoardRow; since: string | null; leadBy: number };
  /** Gold line now and a week ago. */
  goldNow: number;
  goldWeekAgo: number | null;
  /** Teams that joined the board in the past week. */
  newTeamsWeek: number | null;
  /** How many places a team that has not moved its score in a week has lost, at the median. */
  standStill: number | null;
}

export function computeHeadlines(model: BoardModel): Headlines {
  const now = Date.parse(model.latest.fetched);
  const weekAgo = now - 7 * DAY_MS;
  const rows = model.latest.rows;
  const leader = rows[0];

  // Walk the leader's trail back while they stayed at #1.
  let since: string | null = null;
  const pts = model.history.trails[leader[1]]?.pts ?? [];
  for (let i = pts.length - 1; i >= 0 && pts[i][2] === 1; i--) since = pts[i][0];

  const snapThen = snapNearest(model.history.snaps, weekAgo);
  const stillDrops = changesSince(model, weekAgo)
    .filter((c) => Math.abs(c.row[4] - c.scoreThen) < 0.004)
    .map((c) => c.row[0] - c.rankThen)
    .sort((a, b) => a - b);

  return {
    leader: { row: leader, since, leadBy: leader[4] - (rows[1]?.[4] ?? leader[4]) },
    goldNow: rows[model.latest.medalRanks.gold - 1][4],
    goldWeekAgo: snapThen?.gold ?? null,
    newTeamsWeek: snapThen ? model.latest.teams - snapThen.teams : null,
    standStill: stillDrops.length >= 5 ? stillDrops[Math.floor(stillDrops.length / 2)] : null,
  };
}

/** Our own line: now, a week ago, best ever (with when). */
export function computeOurs(model: BoardModel) {
  const ours = model.ourRow;
  const trail = model.history.trails[model.latest.ourTeamId];
  if (!ours) return null;
  const week = trailAt(model.history, model.latest.ourTeamId, Date.parse(model.latest.fetched) - 7 * DAY_MS);
  const best = trail?.pts.reduce<[string, number, number] | null>((a, p) => (!a || p[2] < a[2] ? p : a), null) ?? null;
  return { row: ours, weekAgo: week, best };
}
