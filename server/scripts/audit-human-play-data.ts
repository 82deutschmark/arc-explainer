/**
 * audit-human-play-data.ts
 *
 * Author: Claude Opus 5
 * Date: 2026-09-01
 * PURPOSE: Read-only audit of the anonymous human-play telemetry — community_game_events,
 *          community_human_sessions and community_game_feedback — before deciding what to
 *          retire. Everything recorded before 01-Sep-2026 was collected while the play
 *          surface and the recorder were both faulty (score held the level, click
 *          coordinates were dropped, action_count counted resets, and "Next task" did not
 *          work so a run's tail events were lost), which makes it unusable as a human
 *          baseline and dangerous to average with anything collected after.
 *
 *          Reports counts, date ranges and each specific fault signature. Decides nothing
 *          and changes nothing.
 *
 * SRP/DRY check: Pass — audit and report only; any retirement lives in its own script.
 *
 * SAFETY: READ-ONLY. Runs no INSERT, UPDATE, DELETE or DDL.
 *
 * Usage:
 *   node --import tsx server/scripts/audit-human-play-data.ts
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPool, initializeDatabase } from '../repositories/base/BaseRepository.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const TABLES = ['community_game_events', 'community_human_sessions', 'community_game_feedback'];

async function main() {
  await initializeDatabase();
  const pool = getPool();
  if (!pool) {
    console.error('No database pool — DATABASE_URL is not configured.');
    process.exit(1);
  }

  const exists = await pool.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ANY($1)`,
    [TABLES],
  );
  const present = new Set(exists.rows.map((r) => r.table_name));
  console.log('\n=== tables present ===');
  for (const t of TABLES) console.log(`  ${present.has(t) ? 'yes' : 'MISSING'}  ${t}`);

  if (present.has('community_game_events')) {
    const c = await pool.query(
      `SELECT count(*)::int AS rows,
              count(DISTINCT session_guid)::int AS sessions,
              min(created_at) AS first, max(created_at) AS last
         FROM community_game_events`,
    );
    console.log('\n=== community_game_events ===');
    console.table(c.rows);

    const byDay = await pool.query(
      `SELECT created_at::date AS day, count(*)::int AS rows,
              count(DISTINCT session_guid)::int AS sessions
         FROM community_game_events GROUP BY 1 ORDER BY 1 DESC LIMIT 20`,
    );
    console.log('-- by day (most recent 20)');
    console.table(byDay.rows);

    // Fault signatures. Each was a real defect fixed on 01-Sep; a row showing one cannot
    // be trusted even if the rest of the row looks sane.
    const faults = await pool.query(
      `SELECT
         count(*) FILTER (WHERE x_coord IS NULL AND action = 'ACTION6')::int AS clicks_without_coords,
         count(*) FILTER (WHERE score IS NOT NULL AND level IS NOT NULL AND score = level)::int AS score_equals_level,
         count(*) FILTER (WHERE action = 'RESET')::int AS resets,
         count(*) FILTER (WHERE action IN ('BLUR','FOCUS'))::int AS idle_markers
       FROM community_game_events`,
    );
    console.log('-- fault signatures');
    console.table(faults.rows);
  }

  if (present.has('community_human_sessions')) {
    const s = await pool.query(
      `SELECT count(*)::int AS rows,
              count(*) FILTER (WHERE outcome = 'in_progress')::int AS still_in_progress,
              count(*) FILTER (WHERE action_count = 0)::int AS zero_action,
              count(DISTINCT game_id)::int AS distinct_games,
              min(started_at) AS first, max(started_at) AS last
         FROM community_human_sessions`,
    );
    console.log('\n=== community_human_sessions ===');
    console.table(s.rows);

    const byDay = await pool.query(
      `SELECT started_at::date AS day, count(*)::int AS sessions,
              count(*) FILTER (WHERE outcome <> 'in_progress')::int AS finished
         FROM community_human_sessions GROUP BY 1 ORDER BY 1 DESC LIMIT 20`,
    );
    console.log('-- by day (most recent 20)');
    console.table(byDay.rows);

    // A session row whose events are gone, or events whose session row is gone: either
    // way the pair cannot be reconstructed into a run.
    const orphans = await pool.query(
      `SELECT
         (SELECT count(*) FROM community_human_sessions s
            WHERE NOT EXISTS (SELECT 1 FROM community_game_events e
                               WHERE e.session_guid = s.session_guid))::int AS sessions_without_events,
         (SELECT count(DISTINCT e.session_guid) FROM community_game_events e
            WHERE NOT EXISTS (SELECT 1 FROM community_human_sessions s
                               WHERE s.session_guid = e.session_guid))::int AS events_without_session`,
    );
    console.log('-- orphans');
    console.table(orphans.rows);
  }

  if (present.has('community_game_feedback')) {
    const f = await pool.query(
      `SELECT count(*)::int AS rows, count(DISTINCT game_id)::int AS games,
              count(*) FILTER (WHERE note <> '')::int AS with_note,
              min(created_at) AS first, max(created_at) AS last
         FROM community_game_feedback`,
    );
    console.log('\n=== community_game_feedback ===');
    console.table(f.rows);
  }

  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
