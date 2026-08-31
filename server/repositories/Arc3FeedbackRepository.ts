/*
Author: Claude Opus 5
Date: 2026-08-31
PURPOSE: Player feedback on ARC-AGI-3 tasks — the qualitative half of the cull decision.

         WHY THIS EXISTS SEPARATELY FROM TELEMETRY. community_human_sessions already
         answers "how far did people get": max_level, outcome, action_count, all per run.
         So "80% of first-time players never cleared level 1 on q412-v1" is already a
         query. What it cannot answer is WHY — impossible, unclear, broken, or simply
         dull — and that distinction is the entire cull decision. This table exists only
         to capture the why, which is why the form behind it is six checkboxes and a note
         rather than a survey.

         reached_level and outcome are SNAPSHOTTED onto the feedback row rather than
         joined at read time. "Said impossible and genuinely never cleared level 1" and
         "said impossible after two moves" are different signals, and the join that
         separates them must not depend on the session row having been written — the
         event flush is fire-and-forget and can lose its race with a submit.

         NOTES ARE WRITE-ONLY. A note is free text from a player who has just worked out
         a task. Someone will eventually write "you have to push the blocks onto the
         switches". Rendering that to another player would be the largest spoiler hole on
         the site, so notes are never returned by any public endpoint — getSummary()
         deliberately returns counts only. Read the text with SQL.

         Anonymous, like the rest of this surface: a browser-minted session GUID, no
         account, no PII. The GUID links feedback to that run's keystroke stream, which is
         what makes the snapshot meaningful.
SRP/DRY check: Pass — owns the feedback table only. Session/event storage stays in
         HumanPlayRepository, which is untouched; both create their own schema lazily the
         way the rest of this app bootstraps.
*/

import { getPool } from './base/BaseRepository';
import { logger } from '../utils/logger';

/** Closed set. Anything not in here is dropped rather than stored, so the column stays
 *  aggregatable and a malicious client cannot write arbitrary strings into it. */
export const FEEDBACK_FLAGS = [
  'solved_it',
  'never_understood',
  'inputs_did_nothing',
  'felt_broken',
  'felt_impossible',
  'enjoyed_it',
] as const;

export type FeedbackFlag = (typeof FEEDBACK_FLAGS)[number];

export interface FeedbackInput {
  sessionGuid: string;
  gameId: string;
  flags: string[];
  note: string;
  reachedLevel: number | null;
  outcome: string | null;
}

/** Notes are for a human reader, not a corpus. Long enough for a real thought. */
export const MAX_NOTE_LENGTH = 1000;

let schemaReady = false;

async function ensureSchema(): Promise<void> {
  if (schemaReady) return;
  const pool = getPool();
  if (!pool) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS community_game_feedback (
      id BIGSERIAL PRIMARY KEY,
      session_guid TEXT NOT NULL,
      game_id TEXT NOT NULL,
      flags TEXT[] NOT NULL DEFAULT '{}',
      note TEXT NOT NULL DEFAULT '',
      reached_level INTEGER,
      outcome TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  // The cull query is "group by game", so that is the index.
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_cgf_game ON community_game_feedback(game_id)`);
  // One submission per session per game: the form can be reopened, and a player who
  // edits and resubmits should correct their answer rather than vote twice.
  await pool.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_cgf_session_game
       ON community_game_feedback(session_guid, game_id)`,
  );
  schemaReady = true;
}

export class Arc3FeedbackRepository {
  /**
   * Record one player's feedback. Upserts on (session_guid, game_id) so reopening the
   * form corrects the answer instead of double-counting it.
   *
   * Never throws into the request path: losing a note is bad, but failing the request a
   * player just made — after they took the trouble to write something — is worse, and
   * the caller answers 200 either way.
   */
  static async record(input: FeedbackInput): Promise<boolean> {
    try {
      await ensureSchema();
      const pool = getPool();
      if (!pool) return false;

      const flags = input.flags.filter((f): f is FeedbackFlag =>
        (FEEDBACK_FLAGS as readonly string[]).includes(f));
      const note = input.note.slice(0, MAX_NOTE_LENGTH).trim();

      // Nothing said is not feedback. Storing it would inflate response counts and make
      // "12 people flagged this as broken" impossible to trust.
      if (flags.length === 0 && !note) return false;

      await pool.query(
        `INSERT INTO community_game_feedback
           (session_guid, game_id, flags, note, reached_level, outcome)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (session_guid, game_id) DO UPDATE
           SET flags = EXCLUDED.flags,
               note = EXCLUDED.note,
               reached_level = EXCLUDED.reached_level,
               outcome = EXCLUDED.outcome,
               created_at = NOW()`,
        [input.sessionGuid, input.gameId, flags, note, input.reachedLevel, input.outcome],
      );
      return true;
    } catch (error) {
      logger.warn(`arc3 feedback write failed: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Per-game flag counts, for deciding what to cull. COUNTS ONLY — never note text; see
   * the header. `notes` is how many notes exist, not what they say.
   */
  static async getSummary(gameId?: string): Promise<unknown> {
    await ensureSchema();
    const pool = getPool();
    if (!pool) return { games: [] };

    const where = gameId ? 'WHERE game_id = $1' : '';
    const params = gameId ? [gameId] : [];

    const rows = await pool.query(
      `SELECT game_id,
              COUNT(*)                                                      AS responses,
              COUNT(*) FILTER (WHERE 'solved_it'          = ANY(flags))     AS solved_it,
              COUNT(*) FILTER (WHERE 'never_understood'   = ANY(flags))     AS never_understood,
              COUNT(*) FILTER (WHERE 'inputs_did_nothing' = ANY(flags))     AS inputs_did_nothing,
              COUNT(*) FILTER (WHERE 'felt_broken'        = ANY(flags))     AS felt_broken,
              COUNT(*) FILTER (WHERE 'felt_impossible'    = ANY(flags))     AS felt_impossible,
              COUNT(*) FILTER (WHERE 'enjoyed_it'         = ANY(flags))     AS enjoyed_it,
              COUNT(*) FILTER (WHERE note <> '')                            AS notes,
              ROUND(AVG(reached_level)::numeric, 2)                         AS avg_reached_level
         FROM community_game_feedback
         ${where}
        GROUP BY game_id
        ORDER BY COUNT(*) FILTER (WHERE 'felt_broken' = ANY(flags)) DESC,
                 COUNT(*) DESC`,
      params,
    );

    const toNum = (r: Record<string, unknown>) => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(r)) {
        out[k] = typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v;
      }
      return out;
    };

    return { games: rows.rows.map(toNum) };
  }
}
