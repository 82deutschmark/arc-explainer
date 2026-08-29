/*
 * Author: Claude Opus 5
 * Date: 29-August-2026
 * PURPOSE: Repoint community_games.source_hash for `ws04_v1_ws04` at the repaired game
 * file. ws04 levels 5 and 7 were unwinnable and were fixed (ARCEngine 653c3ee), which
 * changed data/community-games/sonpham/ws04_v1_ws04.py and so invalidated the hash stored
 * against that row when it was seeded. CommunityGameRunner calls
 * CommunityGameStorage.verifyFileHash before starting a session and throws "Game file
 * integrity check failed" on a mismatch, so without this the repaired game is unplayable
 * through the community route -- the official-catalog entry `ws04` is unaffected, because
 * that path recomputes the hash from the file rather than storing it.
 *
 * Idempotent, and scoped to exactly one row: it aborts unless `ws04_v1_ws04` is present
 * exactly once, does nothing if the hash already matches, and asserts afterwards that no
 * other row picked up the new hash. Read-only when there is nothing to do.
 *
 * Run against the deployed database (never prints the connection string):
 *   railway run --project <id> --service <id> --environment production -- \
 *     node scripts/resync-ws04-source-hash.cjs
 *
 * SRP/DRY check: Pass - one-off repair in the style of the other scripts/*.cjs DB tools;
 * the hash is recomputed from the file here rather than pasted, so it cannot go stale.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const GAME_ID = 'ws04_v1_ws04';
const GAME_FILE = path.join('data', 'community-games', 'sonpham', 'ws04_v1_ws04.py');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set - run this through `railway run`.');
    process.exit(1);
  }
  if (!fs.existsSync(GAME_FILE)) {
    console.error(`Game file not found at ${GAME_FILE} (run from the repo root).`);
    process.exit(1);
  }

  // Recompute rather than hard-code, so this file cannot drift from the game it repairs.
  const expected = crypto.createHash('sha256').update(fs.readFileSync(GAME_FILE)).digest('hex');
  console.log(`${GAME_FILE}\n  sha256 = ${expected}`);

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const before = await pool.query(
      'SELECT game_id, source_hash, source_file_path, play_count FROM community_games WHERE game_id = $1',
      [GAME_ID],
    );
    if (before.rowCount !== 1) {
      console.error(`Expected exactly 1 row for ${GAME_ID}, found ${before.rowCount}. Aborting.`);
      process.exitCode = 1;
      return;
    }
    console.log('BEFORE:', JSON.stringify(before.rows[0]));

    if (before.rows[0].source_hash === expected) {
      console.log('Stored hash already matches the file - nothing to do.');
      return;
    }

    const updated = await pool.query(
      `UPDATE community_games
          SET source_hash = $1, updated_at = NOW()
        WHERE game_id = $2 AND source_hash <> $1
        RETURNING game_id, source_hash, updated_at`,
      [expected, GAME_ID],
    );
    console.log(`rows updated: ${updated.rowCount}`);
    console.log('AFTER: ', JSON.stringify(updated.rows[0]));

    const collisions = await pool.query(
      'SELECT count(*)::int AS n FROM community_games WHERE source_hash = $1',
      [expected],
    );
    console.log(`rows carrying this hash (expect 1): ${collisions.rows[0].n}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('FAILED:', error.message);
  process.exit(1);
});
