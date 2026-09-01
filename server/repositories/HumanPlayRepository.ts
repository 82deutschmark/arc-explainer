/**
 * Author: Claude Opus 5
 * Date: 2026-09-01
 * PURPOSE: Per-action human play telemetry for ARC-AGI-3 community tasks, and the
 *          aggregates the human-vs-agent comparison needs.
 *
 *          community_game_sessions already records the OUTCOME of a session -- final
 *          score, frame total, start/end. That answers "did they finish" and nothing
 *          else. It cannot answer the questions the comparison actually rests on:
 *          how many actions a level cost, where people give up, and -- most importantly
 *          -- whether this was the person's first blind attempt. A person can only play
 *          a task blind once, and that run is the only one that speaks to "is this easy
 *          for a human"; pooled with repeat plays it means nothing.
 *
 *          Actions are stored as the harness's own integers (1=Up 2=Down 3=Left 4=Right
 *          5=Action 6=Click 7=Undo) so a human row joins an agent row from
 *          arc3/runner/eval_runner.py directly instead of through a translation layer.
 *
 *          ACTION6 is a CLICK and carries an (x, y). Those coordinates were being dropped
 *          on the floor -- the table had nowhere to put them -- which threw away the only
 *          spatial signal in the whole action space. x_coord/y_coord are added additively
 *          so a deployed table migrates without data loss.
 *
 *          IDLE MARKERS. A 40-second gap between events is either deep thinking or the
 *          player walking away, and until now those were indistinguishable -- which
 *          defeats the think-time signal t_ms exists to provide. The client now emits
 *          BLUR/FOCUS markers from the browser's visibility events. Like RESET they sit
 *          OUTSIDE the harness action space, so they can never be counted as moves.
 *
 *          Anonymous by construction: a random client-minted GUID, coarse desktop/mobile
 *          only, no account, no IP, no PII. A visibility marker records only that
 *          attention left and returned -- not where it went.
 * SRP/DRY check: Pass - searched repositories/; CommunityGameRepository owns games and
 *          session outcomes and is left alone. This owns the event stream and its
 *          aggregates only, and reuses the shared pool via BaseRepository. The action
 *          space (ACTION_INTS) is defined once here and mirrored client-side in
 *          lib/humanPlayTelemetry.ts, which cannot import server code.
 */

import { getPool } from './base/BaseRepository.js';
import { logger } from '../utils/logger.js';

export interface HumanPlayEvent {
  sessionGuid: string;
  seq: number;
  actionInt: number | null;
  action: string;
  level: number | null;
  score: number | null;
  state: string | null;
  levelActions: number | null;
  tMs: number | null;
  /** ACTION6 click target in grid cells. Null for every non-click action. */
  x: number | null;
  y: number | null;
}

let schemaReady = false;

/** Lazily create the event table. Mirrors how the rest of this app bootstraps schema. */
async function ensureSchema(): Promise<void> {
  if (schemaReady) return;
  const pool = getPool();
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS community_game_events (
      id BIGSERIAL PRIMARY KEY,
      session_guid TEXT NOT NULL,
      seq INTEGER NOT NULL,
      action TEXT NOT NULL,
      action_int SMALLINT,
      level INTEGER,
      level_actions INTEGER,
      score INTEGER,
      state TEXT,
      t_ms BIGINT,
      x_coord SMALLINT,
      y_coord SMALLINT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  // Additive, for the table already deployed without them. IF NOT EXISTS makes this a
  // no-op on a fresh CREATE above and a lossless migration on an existing one; there is
  // no backfill because the coordinates of past clicks were never transmitted.
  await pool.query(`ALTER TABLE community_game_events ADD COLUMN IF NOT EXISTS x_coord SMALLINT`);
  await pool.query(`ALTER TABLE community_game_events ADD COLUMN IF NOT EXISTS y_coord SMALLINT`);
  // A retried POST must not double-count an action.
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_cge_session_seq
      ON community_game_events(session_guid, seq)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_cge_session ON community_game_events(session_guid, seq)
  `);
  // A dedicated session table rather than columns on community_game_sessions: that
  // table is tied to a SERVER-run game session, and the play page executes the game in
  // the browser via Pyodide, so most human play never creates one. Human telemetry owns
  // its own identity, minted client-side.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS community_human_sessions (
      session_guid TEXT PRIMARY KEY,
      game_id TEXT NOT NULL,
      is_first_session BOOLEAN NOT NULL DEFAULT FALSE,
      ua_family TEXT NOT NULL DEFAULT '',
      viewport TEXT NOT NULL DEFAULT '',
      action_count INTEGER NOT NULL DEFAULT 0,
      max_level INTEGER NOT NULL DEFAULT 0,
      outcome TEXT NOT NULL DEFAULT 'in_progress',
      started_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_chs_game ON community_human_sessions(game_id)
  `);
  schemaReady = true;
}

/**
 * The harness action space. RESET is deliberately outside it: a reset is not a move, and
 * folding it in would make human and agent action counts incomparable. The BLUR/FOCUS
 * idle markers are outside it for the same reason and by the same precedent -- they are
 * recorded in the event stream, with an action_int of null, and are invisible to every
 * count of moves.
 */
const ACTION_INTS: Record<string, number> = {
  ACTION1: 1, ACTION2: 2, ACTION3: 3, ACTION4: 4, ACTION5: 5, ACTION6: 6, ACTION7: 7,
};

export class HumanPlayRepository {
  static actionInt(action: string): number | null {
    return ACTION_INTS[action?.toUpperCase()] ?? null;
  }

  /** Record one action. Never throws into the request path: losing a telemetry row is
   *  strictly better than failing the move the player just made. */
  static async recordEvent(event: HumanPlayEvent): Promise<void> {
    try {
      await ensureSchema();
      const pool = getPool();
      if (!pool) return;
      await pool.query(
        `INSERT INTO community_game_events
           (session_guid, seq, action, action_int, level, level_actions, score, state,
            t_ms, x_coord, y_coord)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (session_guid, seq) DO NOTHING`,
        [event.sessionGuid, event.seq, event.action, event.actionInt, event.level,
         event.levelActions, event.score, event.state, event.tMs, event.x, event.y],
      );
      // action_count counts MOVES, and only rows inside the harness action space are
      // moves. It previously incremented on every row, which silently included RESET --
      // so a player who reset ten times had ten phantom actions in the average this
      // site's whole human-vs-agent comparison rests on. The idle markers added here
      // would have made that worse (a player tabbing away 20 times, 20x inflated), so
      // the increment is now gated on action_int rather than left to the caller.
      const isMove = event.actionInt !== null;
      await pool.query(
        `UPDATE community_human_sessions
            SET action_count = action_count + $4,
                max_level = GREATEST(max_level, COALESCE($2, 0)),
                outcome = CASE WHEN $3 = 'WIN' THEN 'completed'
                               WHEN $3 = 'GAME_OVER' THEN 'lost'
                               ELSE outcome END,
                updated_at = NOW()
          WHERE session_guid = $1`,
        [event.sessionGuid, event.level ?? 0, event.state ?? '', isMove ? 1 : 0],
      );
    } catch (error) {
      logger.warn(
        `human telemetry write failed: ${error instanceof Error ? error.message : String(error)}`,
        'community-games',
      );
    }
  }

  /** Create the session row on first sight. is_first_session is written once and never
   *  raised afterwards: a run recorded as a repeat cannot be reclassified as blind. */
  static async ensureSession(
    sessionGuid: string, gameId: string, isFirst: boolean,
    uaFamily: string, viewport: string,
  ): Promise<void> {
    try {
      await ensureSchema();
      const pool = getPool();
      if (!pool) return;
      await pool.query(
        `INSERT INTO community_human_sessions
           (session_guid, game_id, is_first_session, ua_family, viewport)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (session_guid) DO UPDATE SET updated_at = NOW()`,
        [sessionGuid, gameId.slice(0, 64), isFirst,
         uaFamily.slice(0, 16), viewport.slice(0, 16)],
      );
    } catch (error) {
      logger.warn(
        `human session upsert failed: ${error instanceof Error ? error.message : String(error)}`,
        'community-games',
      );
    }
  }

  /**
   * Aggregates for the human-vs-agent comparison.
   *
   * Restricted to first blind attempts that actually took an action: a page load is not
   * a failed attempt, and counting it as one deflates the headline rate.
   */
  static async stats(gameId?: string): Promise<unknown> {
    await ensureSchema();
    const pool = getPool();
    if (!pool) return { games: [], levels: [] };

    const where = gameId ? 'AND s.game_id = $1' : '';
    const params = gameId ? [gameId] : [];

    // First blind attempts that actually took an action. A page load is not a failed
    // attempt, and counting it as one deflates the headline rate.
    const games = await pool.query(
      `SELECT s.game_id,
              COUNT(*)                                     AS first_sessions,
              COUNT(*) FILTER (WHERE s.outcome = 'completed') AS completed,
              ROUND(AVG(s.max_level)::numeric, 2)          AS avg_levels_reached,
              ROUND(AVG(s.action_count)::numeric, 1)       AS avg_actions
         FROM community_human_sessions s
        WHERE s.is_first_session AND s.action_count > 0 ${where}
        GROUP BY s.game_id
        ORDER BY s.game_id`, params);

    const levels = await pool.query(
      `SELECT s.game_id, e.level,
              COUNT(DISTINCT e.session_guid)               AS players,
              ROUND(AVG(e.level_actions)::numeric, 1)      AS avg_actions_on_level,
              MAX(e.level_actions)                         AS worst_actions_on_level
         FROM community_game_events e
         JOIN community_human_sessions s ON s.session_guid = e.session_guid
        WHERE s.is_first_session AND e.level IS NOT NULL ${where}
        GROUP BY s.game_id, e.level
        ORDER BY s.game_id, e.level`, params);

    const toNum = (rows: Record<string, unknown>[]) => rows.map((r) => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(r)) out[k] = typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v;
      return out;
    });

    const gameRows = toNum(games.rows).map((r) => ({
      ...r,
      first_play_completion_rate:
        Number(r.first_sessions) > 0
          ? Math.round((Number(r.completed) / Number(r.first_sessions)) * 1000) / 1000
          : null,
    }));

    return { games: gameRows, levels: toNum(levels.rows) };
  }
}
