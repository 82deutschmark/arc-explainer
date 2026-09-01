/**
 * retire-human-play-data.ts
 *
 * Author: Claude Opus 5
 * Date: 2026-09-01
 * PURPOSE: Move human-play telemetry collected before a cutoff out of the live tables and
 *          into `*_retired` copies, so the baseline collected from the cutoff onward is
 *          clean and nothing that was measured is destroyed.
 *
 *          WHY ANY OF IT IS BEING RETIRED. Everything recorded before 01-Sep-2026 was
 *          collected while the surface and the recorder were both wrong, in ways that
 *          cannot be repaired after the fact:
 *            - `score` was filled with the level number, so the score was never recorded
 *              and the two columns cannot be told apart in an old row;
 *            - a click is somewhere, and there was nowhere to put the coordinates, so
 *              every ACTION6 in an old row is missing its argument;
 *            - `action_count` was incremented for every row including RESET, so a
 *              session's move count is inflated by an unknown amount;
 *            - "Next task" did not work, so a reviewer moving on lost the tail of the run
 *              they were leaving -- sessions end mid-run for no behavioural reason;
 *            - the games were served with descriptive ids, so a player could be told the
 *              mechanic before their first move, which makes the run worthless as a
 *              blind baseline whatever else is true of it.
 *          Averaging any of that with clean data silently corrupts the clean data. That is
 *          the whole argument for retiring rather than keeping and filtering.
 *
 *          ARCHIVE, NEVER DELETE. Rows are copied into `<table>_retired` (identical shape,
 *          plus `retired_at` and `retired_reason`) inside one transaction and only then
 *          removed from the live table. Re-running is safe: rows already retired are not
 *          copied twice.
 *
 * SRP/DRY check: Pass — retirement only. The audit that decides whether to run this is
 *          audit-human-play-data.ts; neither script defines schema, which stays owned by
 *          HumanPlayRepository / Arc3FeedbackRepository.
 *
 * SAFETY: Dry run by default — prints what it would move and exits without writing.
 *         `--confirm` is required to make any change. Deletes only rows it has just
 *         copied, in the same transaction.
 *
 * Usage:
 *   node --import tsx server/scripts/retire-human-play-data.ts --before 2026-09-01T00:00:00Z
 *   node --import tsx server/scripts/retire-human-play-data.ts --before 2026-09-01T00:00:00Z --confirm
 *
 *   Against production (this machine has no DATABASE_URL of its own):
 *   railway run node --import tsx server/scripts/retire-human-play-data.ts --before ... --confirm
 *
 *   Run it AFTER the fixed build is live, with a cutoff at the deploy, not at midnight:
 *   anything collected today before the deploy came off the old code and is equally unusable.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import type { PoolClient } from 'pg';
import { getPool, initializeDatabase } from '../repositories/base/BaseRepository.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const REASON = 'collected before the 01-Sep-2026 telemetry and play-surface fixes';

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null;
}

const before = arg('--before');
const confirm = process.argv.includes('--confirm');

/**
 * A run is retired whole. The unit of analysis is a session, not a row, so a session that
 * started before the cutoff takes ALL of its events with it however late they arrived --
 * splitting one run across the boundary would leave a half-run on each side and both would
 * be wrong.
 */
const SESSION_PREDICATE = `started_at < $1`;
const EVENT_PREDICATE = `
  session_guid IN (SELECT session_guid FROM community_human_sessions WHERE started_at < $1)
  OR (created_at < $1
      AND NOT EXISTS (SELECT 1 FROM community_human_sessions s WHERE s.session_guid = community_game_events.session_guid))
`;
const FEEDBACK_PREDICATE = `
  created_at < $1
  OR session_guid IN (SELECT session_guid FROM community_human_sessions WHERE started_at < $1)
`;

const PLAN: { table: string; predicate: string }[] = [
  { table: 'community_game_events', predicate: EVENT_PREDICATE },
  { table: 'community_human_sessions', predicate: SESSION_PREDICATE },
  { table: 'community_game_feedback', predicate: FEEDBACK_PREDICATE },
];

async function tableExists(client: PoolClient, table: string): Promise<boolean> {
  const r = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`,
    [table],
  );
  return r.rowCount! > 0;
}

async function main() {
  if (!before || Number.isNaN(Date.parse(before))) {
    console.error('Required: --before <ISO timestamp>, e.g. --before 2026-09-01T00:00:00Z');
    process.exit(1);
  }

  await initializeDatabase();
  const pool = getPool();
  if (!pool) {
    console.error(
      'No database pool — DATABASE_URL is not configured in this environment.\n' +
      'For the production database run this under `railway run`.',
    );
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    console.log(`\ncutoff: ${new Date(before).toISOString()}`);
    console.log(confirm ? 'mode:   CONFIRMED — rows will be moved\n' : 'mode:   dry run — nothing will be written\n');

    // Counted outside the transaction as well, so a dry run is a plain read.
    for (const { table, predicate } of PLAN) {
      if (!(await tableExists(client, table))) { console.log(`  ${table}: table does not exist, skipping`); continue; }
      const r = await client.query(`SELECT count(*)::int AS n FROM ${table} WHERE ${predicate}`, [before]);
      const total = await client.query(`SELECT count(*)::int AS n FROM ${table}`);
      console.log(`  ${table}: ${r.rows[0].n} of ${total.rows[0].n} rows are before the cutoff`);
    }

    if (!confirm) {
      console.log('\nDry run only. Re-run with --confirm to move these rows into *_retired tables.');
      return;
    }

    await client.query('BEGIN');
    for (const { table, predicate } of PLAN) {
      if (!(await tableExists(client, table))) continue;
      const retired = `${table}_retired`;

      // Same shape as the live table, plus why and when. LIKE keeps this correct if a
      // column is ever added to the live table before this script next runs.
      await client.query(`CREATE TABLE IF NOT EXISTS ${retired} (LIKE ${table} INCLUDING DEFAULTS)`);
      await client.query(`ALTER TABLE ${retired} ADD COLUMN IF NOT EXISTS retired_at TIMESTAMPTZ DEFAULT NOW()`);
      await client.query(`ALTER TABLE ${retired} ADD COLUMN IF NOT EXISTS retired_reason TEXT`);

      const cols = await client.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema='public' AND table_name=$1
          ORDER BY ordinal_position`,
        [table],
      );
      const list = cols.rows.map((c) => `"${c.column_name}"`).join(', ');

      const moved = await client.query(
        `INSERT INTO ${retired} (${list}, retired_reason)
         SELECT ${list}, $2 FROM ${table} WHERE ${predicate}`,
        [before, REASON],
      );
      const removed = await client.query(`DELETE FROM ${table} WHERE ${predicate}`, [before]);
      console.log(`  ${table}: archived ${moved.rowCount}, deleted ${removed.rowCount} -> ${retired}`);

      if (moved.rowCount !== removed.rowCount) {
        throw new Error(
          `${table}: archived ${moved.rowCount} but deleted ${removed.rowCount} — rolling back`,
        );
      }
    }
    await client.query('COMMIT');
    console.log('\nDone. Live tables now hold only data collected from the cutoff onward.');

    for (const { table } of PLAN) {
      if (!(await tableExists(client, table))) continue;
      const r = await client.query(`SELECT count(*)::int AS n FROM ${table}`);
      console.log(`  ${table}: ${r.rows[0].n} rows remain`);
    }
  } catch (e) {
    await client.query('ROLLBACK').catch(() => { /* already rolled back */ });
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
