/**
 * Author: Claude Opus 5.5
 * Date: 2026-10-09
 * PURPOSE: The ARC Daily Digest's market digest: a compact, dated summary of one Kaggle board
 *          for the newspaper's ticker, standings and movers tables, and the evidence the wire
 *          desk's reporters write from (scripts/newsroom_wire.py reads GET /api/news/markets).
 *          Built on the server from the saved board documents (latest, history, events), so the
 *          front page downloads a few kilobytes instead of both full boards.
 *
 *          Every comparison looks back one day, to the last saved snapshot at or before that time
 *          (within 90 minutes). A team's earlier rank or score is filled only when the saved
 *          history supports it, under the reporting desk's rule (scripts/newsroom.py
 *          observation()): a change-only trail point is trusted when the team was inside the
 *          tracked top 300 then and now and no later jump could hide an exit; otherwise the team's
 *          first score change in the window (the top-500 feed) gives the score and rank before its
 *          move. Anything else stays null, which the page prints as unknown, never as zero.
 * SRP/DRY check: Pass — pure functions over the documents typed in shared/types.ts. It overlaps
 *          client/src/components/kaggleLeaderboard/storyData.ts on purpose rather than moving
 *          that file: the leaderboard page wants UTC-day and weekly views without these evidence
 *          rules, the newspaper wants rolling one-day windows with them.
 */
import { KAGGLE_COMPETITIONS } from './kaggleCompetitions';
import type { NewsCompetition } from './news';
import type { KaggleBoardEvent, KaggleBoardHistory, KaggleBoardLatest, KaggleBoardRow, KaggleBoardSnap, KaggleBoardTrail } from './types';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
/** Same tolerance as scripts/newsroom.py boundary(): a snapshot farther from its target is not used. */
const MATCH_MS = 90 * 60_000;
/** The snapshot job's coverage (arc-3 scripts/leaderboard_snapshot.py): trails for the top 300, score changes for the top 500. */
const TRAIL_TOP = 300;
const EVENT_RANK = 500;
const STANDINGS = 25;
const LIST = 6;
/** Gainers and climbers are drawn from the teams now in the top 100. */
const MOVER_RANK = 100;
const WATCH_LIMIT = 160;

export interface MarketRow {
  rank: number; teamId: string; name: string; score: number; submissions: number;
  /** Kaggle usernames on the team, in board order. */
  members: string[];
  /** Rank and score at the comparison snapshot (or, for rank, just before the team's first move in the window). Null is unknown. */
  rankThen: number | null; scoreThen: number | null;
  /** First seen on the board inside the window. */
  isNew: boolean;
}
/** A medal line or the top score: the cut rank, its score now, a day ago and a week ago. */
export interface MarketLine { rank: number; now: number | null; then: number | null; weekAgo: number | null }
export interface MarketBoard {
  competition: NewsCompetition; label: string; boardPath: string;
  /** Latest saved board. */
  fetched: string;
  /** The snapshot the past-day comparisons use, or null when none was saved near that time. */
  since: string | null;
  /** The snapshot the week-ago medal lines use, or null. */
  weekSince: string | null;
  closeAt: string | null;
  teams: number; teamsThen: number | null;
  medalRanks: { gold: number; silver: number; bronze: number };
  lines: { top: MarketLine; gold: MarketLine; silver: MarketLine; bronze: MarketLine };
  leader: {
    row: MarketRow;
    /** Points ahead of second place. */
    leadBy: number | null;
    /** First save of the current unbroken reign at #1, or null when it began before the saved history. */
    heldSince: string | null;
    /** The team that led at the comparison snapshot, when it was someone else. */
    previous: MarketRow | null;
  };
  standings: MarketRow[];
  gainers: MarketRow[]; climbers: MarketRow[]; newcomers: MarketRow[];
  intoGold: MarketRow[]; outOfGold: MarketRow[]; bubble: MarketRow[];
  /** Teams now in the top 500 that raised their score in the window. */
  improved: number;
  /** Teams new to the board in the window that already sit in the top 500. */
  newcomerCount: number;
  /** Rows for the notebook, ledger and featured teams, whatever their rank. */
  watch: MarketRow[];
}
export interface MarketsPayload { generatedAt: string; boards: Partial<Record<NewsCompetition, MarketBoard>> }

const ms = (iso: string) => Date.parse(iso);

/** The last saved snapshot at or before `target`, when it is within 90 minutes of it. */
export function snapshotAt(snaps: KaggleBoardSnap[], target: number): KaggleBoardSnap | null {
  let found: KaggleBoardSnap | null = null;
  for (const snap of snaps) {
    const at = ms(snap.t);
    if (at <= target && (!found || at > ms(found.t))) found = snap;
  }
  return found && target - ms(found.t) <= MATCH_MS ? found : null;
}

/**
 * A team's [time, score, rank] at `target` from its change-only trail: an exact point, or the last
 * point before `target` when the team sits inside the tracked top 300 then and now and the next
 * point does not jump the score after a long silence (which could hide an exit and a return).
 */
export function trailObservation(trail: KaggleBoardTrail | undefined, rankNow: number, target: number): [string, number, number] | null {
  let last: [string, number, number] | null = null;
  let next: [string, number, number] | null = null;
  for (const point of trail?.pts ?? []) {
    const at = ms(point[0]);
    if (at <= target) { if (!last || at >= ms(last[0])) last = point; }
    else if (!next || at < ms(next[0])) next = point;
  }
  if (!last) return null;
  if (ms(last[0]) === target) return last;
  const possibleGap = !!next && next[1] !== last[1] && ms(next[0]) - ms(last[0]) > MATCH_MS;
  return rankNow <= TRAIL_TOP && last[2] <= TRAIL_TOP && !possibleGap ? last : null;
}

/** Score gained over the window, or null when unknown or new. */
export const marketGain = (row: MarketRow) => row.isNew || row.scoreThen == null ? null : row.score - row.scoreThen;
/** Places gained over the window (negative when fallen), or null when unknown or new. */
export const marketClimb = (row: MarketRow) => row.isNew || row.rankThen == null ? null : row.rankThen - row.rank;

export function buildMarketBoard(competition: NewsCompetition, latest: KaggleBoardLatest, history: KaggleBoardHistory | null,
  events: KaggleBoardEvent[] | null, watchIds: Iterable<string> = []): MarketBoard | null {
  const rows = latest.rows;
  if (!rows.length || !Number.isFinite(ms(latest.fetched))) return null;
  const now = ms(latest.fetched);
  const snaps = history?.snaps ?? [];
  const trails = history?.trails ?? {};
  const sinceSnap = snapshotAt(snaps, now - DAY_MS);
  const weekSnap = snapshotAt(snaps, now - 7 * DAY_MS);
  const since = sinceSnap ? ms(sinceSnap.t) : null;

  // Each team's first score change inside the window, and who raised a score at all.
  const firstMove = new Map<string, KaggleBoardEvent>();
  const raised = new Set<string>();
  if (since != null) {
    for (const event of [...(events ?? [])].sort((a, b) => ms(a.t) - ms(b.t))) {
      const at = ms(event.t);
      if (at <= since || at > now) continue;
      if (!firstMove.has(event.id)) firstMove.set(event.id, event);
      if (event.from != null && event.to > event.from) raised.add(event.id);
    }
  }

  const toRow = (row: KaggleBoardRow): MarketRow => {
    const base = { rank: row[0], teamId: row[1], name: row[2], score: row[4], submissions: row[5],
      members: row[6].split(',').map(member => member.trim()).filter(Boolean) };
    if (since == null) return { ...base, rankThen: null, scoreThen: null, isNew: false };
    const move = firstMove.get(row[1]);
    const isNew = !!move && move.from == null;
    const seen = trailObservation(trails[row[1]], row[0], since);
    if (seen) return { ...base, rankThen: seen[2], scoreThen: seen[1], isNew };
    if (move) return { ...base, rankThen: move.rankFrom, scoreThen: move.from, isNew };
    // No score change in the window: a team now in the top 500 would have been recorded if it had moved.
    return { ...base, rankThen: null, scoreThen: row[0] <= EVENT_RANK ? row[4] : null, isNew };
  };

  const covered = rows.filter(row => row[0] <= EVENT_RANK).map(toRow);
  const byId = new Map(covered.map(row => [row.teamId, row]));
  const rowFor = (row: KaggleBoardRow) => byId.get(row[1]) ?? toRow(row);
  const { gold, silver, bronze } = latest.medalRanks;
  const top100 = covered.filter(row => row.rank <= MOVER_RANK);

  let previous: MarketRow | null = null;
  if (since != null) {
    const ledThen = rows.slice(0, 50).find(row => trailObservation(trails[row[1]], row[0], since)?.[2] === 1);
    if (ledThen && ledThen[1] !== rows[0][1]) previous = rowFor(ledThen);
  }
  // Walk the leader's trail back while it stayed first; a reign reaching the first save has no known start.
  const leaderPoints = trails[rows[0][1]]?.pts ?? [];
  let heldSince: string | null = null;
  for (let index = leaderPoints.length - 1; index >= 0 && leaderPoints[index][2] === 1; index--) {
    heldSince = index === 0 && snaps.length && leaderPoints[0][0] <= snaps[0].t ? null : leaderPoints[index][0];
  }

  const scoreAt = (rank: number) => rows[rank - 1]?.[4] ?? null;
  const line = (rank: number, key: 'top' | 'gold' | 'silver' | 'bronze'): MarketLine =>
    ({ rank, now: scoreAt(rank), then: sinceSnap?.[key] ?? null, weekAgo: weekSnap?.[key] ?? null });
  const wanted = new Set(watchIds);
  const info = KAGGLE_COMPETITIONS[competition];

  return {
    competition, label: info.label, boardPath: info.path, fetched: latest.fetched,
    since: sinceSnap?.t ?? null, weekSince: weekSnap?.t ?? null, closeAt: info.closeAt,
    teams: latest.teams, teamsThen: sinceSnap?.teams ?? null,
    medalRanks: { gold, silver, bronze },
    lines: { top: line(1, 'top'), gold: line(gold, 'gold'), silver: line(silver, 'silver'), bronze: line(bronze, 'bronze') },
    leader: { row: rowFor(rows[0]), leadBy: rows[1] ? rows[0][4] - rows[1][4] : null, heldSince, previous },
    standings: rows.slice(0, STANDINGS).map(rowFor),
    gainers: top100.filter(row => (marketGain(row) ?? 0) > 0.005)
      .sort((a, b) => marketGain(b)! - marketGain(a)! || a.rank - b.rank).slice(0, LIST),
    climbers: top100.filter(row => (marketClimb(row) ?? 0) > 0)
      .sort((a, b) => marketClimb(b)! - marketClimb(a)! || a.rank - b.rank).slice(0, LIST),
    newcomers: covered.filter(row => row.isNew).slice(0, LIST),
    intoGold: covered.filter(row => row.rank <= gold && !row.isNew && row.rankThen != null && row.rankThen > gold),
    outOfGold: covered.filter(row => row.rank > gold && row.rankThen != null && row.rankThen <= gold),
    bubble: rows.slice(gold, gold + 5).map(rowFor),
    improved: [...raised].filter(id => byId.has(id)).length,
    newcomerCount: covered.filter(row => row.isNew).length,
    watch: rows.filter(row => wanted.has(row[1])).slice(0, WATCH_LIMIT).map(rowFor),
  };
}

/** Whole days left before a board closes, from its latest save; null when the close is unknown. */
export function daysToClose(board: Pick<MarketBoard, 'closeAt' | 'fetched'>): number | null {
  if (!board.closeAt) return null;
  return Math.max(0, Math.ceil((ms(board.closeAt) - ms(board.fetched)) / DAY_MS));
}
