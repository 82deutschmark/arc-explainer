/*
 * Author: Claude Opus 5
 * Date: 29-August-2026
 * PURPOSE: Read-only integrity sweep over community_games. For every row whose
 * source_file_path resolves in this checkout, recompute the sha256 and compare it to the
 * stored source_hash. A mismatch means CommunityGameRunner will refuse to start that game
 * ("Game file integrity check failed"), which is invisible until someone tries to play it
 * -- exactly the failure the ws04 repair introduced and scripts/resync-ws04-source-hash.cjs
 * corrected. Rows whose path is absolute and container-local (e.g. /app/uploads/...) are
 * reported as unresolvable rather than counted as failures.
 *
 * Also prints the human-play counts per game, which is what tells you whether any human
 * baseline exists for a given task.
 *
 * Run:
 *   railway run --project <id> --service <id> --environment production -- \
 *     node scripts/audit-community-game-hashes.cjs
 *
 * SRP/DRY check: Pass - read-only; writes nothing and holds no copy of the file list.
 */

const crypto = require('crypto');
const fs = require('fs');
const { Pool } = require('pg');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set - run this through `railway run`.');
    process.exit(1);
  }
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const games = await pool.query(
      `SELECT game_id, source_file_path, source_hash, status, is_playable, play_count
         FROM community_games ORDER BY game_id`,
    );

    const ok = [];
    const stale = [];
    const unresolved = [];
    for (const row of games.rows) {
      if (!fs.existsSync(row.source_file_path)) {
        unresolved.push(row);
        continue;
      }
      const actual = crypto.createHash('sha256')
        .update(fs.readFileSync(row.source_file_path)).digest('hex');
      (actual === row.source_hash ? ok : stale).push({ ...row, actual });
    }

    console.log(`community_games rows: ${games.rowCount}`);
    console.log(`  hash OK:      ${ok.length}`);
    console.log(`  hash STALE:   ${stale.length}`);
    console.log(`  unresolvable: ${unresolved.length} (path not present in this checkout)`);

    for (const row of stale) {
      console.log(`\n  STALE ${row.game_id}  playable=${row.is_playable} plays=${row.play_count}`);
      console.log(`     stored ${row.source_hash}`);
      console.log(`     actual ${row.actual}`);
      console.log(`     path   ${row.source_file_path}`);
    }
    for (const row of unresolved) {
      console.log(`\n  UNRESOLVED ${row.game_id} -> ${row.source_file_path}`);
    }

    const human = await pool.query(
      `SELECT game_id, count(*)::int AS sessions,
              sum(CASE WHEN is_first_session THEN 1 ELSE 0 END)::int AS blind_first_plays,
              sum(CASE WHEN action_count > 0 THEN 1 ELSE 0 END)::int AS took_an_action,
              max(max_level) AS best_level,
              sum(CASE WHEN outcome = 'completed' THEN 1 ELSE 0 END)::int AS completed
         FROM community_human_sessions GROUP BY game_id ORDER BY game_id`,
    );
    console.log(`\nhuman sessions recorded for ${human.rowCount} game(s):`);
    for (const row of human.rows) console.log('  ', JSON.stringify(row));
    if (human.rowCount === 0) console.log('   (none)');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('FAILED:', error.message);
  process.exit(1);
});
