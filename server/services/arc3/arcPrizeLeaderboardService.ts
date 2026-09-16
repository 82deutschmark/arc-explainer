/*
 * Author: Claude Opus 5
 * Date: 2026-09-12
 * PURPOSE: Reads the official ARC Prize HUMAN leaderboard for one official game, so a
 *          game's page can show what people actually did on it -- the fewest actions a
 *          human needed to win, and who is at the top.
 *
 *          WHY THIS NUMBER AND NOT OURS. Everything else on a game page is our own work:
 *          our write-up, our screenshots, our `difficulty` field (which is 'unknown' for
 *          most of the set and is a guess where it is not). The action count is the one
 *          hard measurement of how hard a game actually is, it comes from ARC Prize, and
 *          it is the reason to link there rather than assert a difficulty ourselves. On
 *          r11l the top ten all score 100 and range from 57 to 69 actions -- that spread
 *          IS the interesting fact, and no field in our registry carries it.
 *
 *          THE ENDPOINT. `POST https://arcprize.org/api/leaderboards/<gameId>` with
 *          `{ai: false, game_id: <gameId>}`, which is what arcprize.org's own leaderboard
 *          page calls (found in its page chunk). Public and unauthenticated. It returns
 *          the top ten as `{user_name, published_at, score, end_state, actions, resets}`,
 *          already ordered best-first. `ai: false` is what makes it the HUMAN board; the
 *          same endpoint with true is the agent one, which is not what this is for.
 *
 *          It is somebody else's undocumented internal API, so it is treated as one: a
 *          short timeout, every field validated rather than trusted, a cache so a page
 *          view is not a request, and a last-good copy served when a refresh fails. A game
 *          page must still render when arcprize.org is down or has moved this endpoint --
 *          the leaderboard card disappears, the write-up does not.
 *
 *          IDS ARE CHECKED AGAINST OUR REGISTRY FIRST. The caller passes a path segment,
 *          and this makes an outbound request shaped by it; only ids that name a game we
 *          actually publish get that far, so this cannot be used to bounce arbitrary
 *          strings off arcprize.org.
 *
 *          2026-09-16 (Claude Opus 5): no old data. Each row now carries `recent` (published
 *          on or after HUMAN_DATA_CUTOFF, 2026-06-18) and the board carries `stats` --
 *          rows kept of 10, score min/max, fewest / median / most actions and relative
 *          spread, all over recent wins only -- from computeTop10Stats() in
 *          shared/arc3Games/humanDifficulty.ts. Old rows stay in `entries` so the page can
 *          grey them out. `fewestActions` is now the recent-wins number too (it used to
 *          include old rows), so the page shows no old number even before it reads `stats`.
 *
 * SRP/DRY check: Pass -- one upstream read plus its cache. HTTP handling is in
 *          server/routes.ts, the leaderboard URL humans click is
 *          arcPrizeLeaderboardUrl() in shared/arc3Games, the recency cut and the stats are
 *          the shared pure functions in shared/arc3Games/humanDifficulty.ts, and no display
 *          logic lives here.
 */

import { getGameById } from '../../../shared/arc3Games';
import {
  computeTop10Stats,
  HUMAN_DATA_CUTOFF,
  isOnOrAfterCutoff,
  type Top10Stats,
} from '../../../shared/arc3Games/humanDifficulty';
import { logger } from '../../utils/logger';

const LEADERBOARD_ENDPOINT = 'https://arcprize.org/api/leaderboards';

/**
 * Six hours. These are human runs published over months -- r11l's top ten span June to
 * September -- so the board moves slowly and a shorter TTL would just add load at
 * somebody else's expense for numbers that have not changed.
 */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

/** Someone else's server, on the render path of our page. Short, and never retried. */
const FETCH_TIMEOUT_MS = 8_000;

export interface HumanLeaderboardEntry {
  userName: string;
  score: number;
  actions: number;
  resets: number;
  endState: string;
  publishedAt: string | null;
  /** Published on or after HUMAN_DATA_CUTOFF. False rows are old: shown greyed out, left out of `stats`. */
  recent: boolean;
}

export interface HumanLeaderboard {
  gameId: string;
  /** Every row the board returned, best first, old ones included (see `recent`). */
  entries: HumanLeaderboardEntry[];
  /** Fewest actions among RECENT winning rows, or null when there are none. Same as stats.fewestActions. */
  fewestActions: number | null;
  /** The recency cutoff the rows were marked against (ISO). */
  recentCutoff: string;
  /** Spread over recent winning rows only. */
  stats: Top10Stats;
  fetchedAt: string;
}

interface CacheEntry {
  value: HumanLeaderboard;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();
/** Dedupes concurrent misses: a cold page view must not fan out one request per reader. */
const inFlight = new Map<string, Promise<HumanLeaderboard | null>>();

/**
 * One row, or null if it is not shaped like a row.
 *
 * Every field is checked because this is an undocumented API that can change without
 * telling us: a silently-renamed field would otherwise surface as `undefined actions` on
 * the page rather than as a row we simply drop.
 */
function normalizeEntry(raw: unknown): HumanLeaderboardEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const userName = typeof row.user_name === 'string' ? row.user_name.trim() : '';
  const score = typeof row.score === 'number' ? row.score : null;
  const actions = typeof row.actions === 'number' ? row.actions : null;
  if (!userName || score === null || actions === null) return null;
  const publishedAt = typeof row.published_at === 'string' ? row.published_at : null;
  return {
    userName,
    score,
    actions,
    resets: typeof row.resets === 'number' ? row.resets : 0,
    endState: typeof row.end_state === 'string' ? row.end_state : 'UNKNOWN',
    publishedAt,
    // An undated row cannot pass the cut, so it counts as old.
    recent: isOnOrAfterCutoff(publishedAt),
  };
}

async function fetchFromArcPrize(gameId: string): Promise<HumanLeaderboard> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(`${LEADERBOARD_ENDPOINT}/${encodeURIComponent(gameId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ai: false, game_id: gameId }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`arcprize.org responded ${response.status}`);

    const payload = await response.json();
    if (!Array.isArray(payload)) throw new Error('leaderboard payload was not an array');

    const entries = payload
      .map(normalizeEntry)
      .filter((entry): entry is HumanLeaderboardEntry => entry !== null)
      // Best first: fewest actions, and a win always beats a non-win. The endpoint already
      // returns them this way; sorting anyway means the page does not depend on that.
      .sort((a, b) => {
        const aWon = a.endState === 'WIN' ? 0 : 1;
        const bWon = b.endState === 'WIN' ? 0 : 1;
        return aWon - bWon || b.score - a.score || a.actions - b.actions;
      });

    const stats = computeTop10Stats(entries, HUMAN_DATA_CUTOFF);
    return {
      gameId,
      entries,
      fewestActions: stats.fewestActions,
      recentCutoff: HUMAN_DATA_CUTOFF,
      stats,
      fetchedAt: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The human leaderboard for one official game, or null when we cannot produce one.
 *
 * Null covers three cases the caller treats identically -- an id we do not publish, an
 * upstream failure with nothing cached, and a game nobody has submitted a run for. In all
 * three the page renders without the card, which is the point: this is an enrichment, and
 * a game's write-up must not depend on a third party being up.
 */
export async function getHumanLeaderboard(gameId: string): Promise<HumanLeaderboard | null> {
  if (!getGameById(gameId)) return null;

  const cached = cache.get(gameId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.value;

  const existing = inFlight.get(gameId);
  if (existing) return existing;

  const request = (async () => {
    try {
      const fresh = await fetchFromArcPrize(gameId);
      cache.set(gameId, { value: fresh, fetchedAt: Date.now() });
      return fresh;
    } catch (error) {
      // An expired copy is still the right answer: these numbers change over months, and
      // showing last week's board beats showing nothing because of one failed request.
      if (cached) {
        logger.warn(
          `arcPrizeLeaderboard: refresh failed for ${gameId}, serving cached copy - ${error instanceof Error ? error.message : String(error)}`,
          'arc3',
        );
        return cached.value;
      }
      logger.warn(
        `arcPrizeLeaderboard: could not read ${gameId} - ${error instanceof Error ? error.message : String(error)}`,
        'arc3',
      );
      return null;
    } finally {
      inFlight.delete(gameId);
    }
  })();

  inFlight.set(gameId, request);
  return request;
}
