/**
 * export-arc3-feedback.ts
 *
 * Author: Claude Sonnet 5
 * Date: 2026-09-05 (revised 2026-09-06: current-version snapshot)
 * PURPOSE: Close the gap identified in docs/2026-09-02-arc3-game-feedback-synthesis.md —
 *          player note text on ARC-3 tasks has never left this database. Counts already
 *          flow out through /api/arc3-play/feedback-summary and /promoted; the note text
 *          (the actual "why" — the thing revision decisions are made from) is deliberately
 *          write-only there, "read it with SQL." This IS that SQL, run daily on a Mac Mini
 *          launchd job (see docs/ARC3-FEEDBACK-EXPORT.md), writing straight into the
 *          authoring repo instead of a one-off synthesis doc someone hand-writes each time.
 *
 *          Appends only. Watermarked on the exported table's own `id`, read back from the
 *          destination file itself — no separate state file to lose or fall out of sync.
 *          Every run is safe to repeat; already-exported rows are never rewritten.
 *
 *          Writes to a sibling checkout of sonpham-org/autoresearch-arena, next to
 *          revisions.jsonl, so a revision entry there can sit beside the feedback that
 *          motivated it.
 *
 *          VERSIONING, because these games get revised repeatedly and a stale join here
 *          is exactly how "praised g012" becomes worthless (see the sourceVersion warning
 *          in Arc3FeedbackRepository.ts). Each feedback row already carries the
 *          `sourceVersion` it was recorded against (a content hash, stamped client-side at
 *          submit time — null for anything predating 04-Sep-2026, per that same file).
 *          That alone answers "which build this note is about." It does NOT answer "is
 *          that build still the one being served" — that fact changes the moment someone
 *          publishes a revision, so baking a `current: true/false` flag into a feedback row
 *          would go stale the day after export and silently lie from then on.
 *
 *          So freshness is a SEPARATE snapshot, not a per-row flag: game-versions.json,
 *          written beside feedback.jsonl and fully OVERWRITTEN every run (never appended —
 *          only the latest state is meaningful), mapping every gameId that has ever
 *          received feedback to whatever Arc3MirrorCatalog is serving for it right now.
 *          Refreshed unconditionally, even on a day with zero new feedback rows, because a
 *          revision with no feedback yet is exactly the case a stale snapshot would hide.
 *          A reader joins the two at READ time — row.sourceVersion === the snapshot's
 *          current entry — the same comparison Arc3Promotion.ts already makes for the
 *          in-app promotion signal; this script does not reimplement that logic, only
 *          reuses Arc3MirrorCatalog.getSource() the same way Arc3Promotion.ts does.
 *
 * SRP/DRY check: Pass — reads community_game_feedback and Arc3MirrorCatalog only; neither
 *          table schema nor version-hashing is duplicated here.
 *
 * SAFETY: READ-ONLY against the arc-explainer database. Runs no INSERT, UPDATE, DELETE or
 *          DDL. The only writes are the two destination files below.
 *
 * Usage:
 *   node --import tsx server/scripts/export-arc3-feedback.ts
 *   node --import tsx server/scripts/export-arc3-feedback.ts --out /path/to/feedback.jsonl
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPool, initializeDatabase } from '../repositories/base/BaseRepository.js';
import { Arc3MirrorCatalog } from '../services/arc3Mirror/Arc3MirrorCatalog.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Sibling checkout on the same machine this repo already assumes (see CLAUDE.md: Mac
// Mini, zsh). Override with --out for a different layout or a CI checkout path.
const DEFAULT_OUT = path.resolve(
  __dirname, '../../../autoresearch-arena/arc3games/feedback.jsonl',
);

interface FeedbackRow {
  // pg returns bigint/bigserial as a string to avoid precision loss (same note in
  // Arc3FeedbackRepository.ts's getVerdictsByBuild). Cast at the one place it is read.
  id: string;
  game_id: string;
  source_version: string | null;
  flags: string[];
  note: string;
  reached_level: number | null;
  outcome: string | null;
  created_at: string;
}

function resolveOutPath(): string {
  const flagIndex = process.argv.indexOf('--out');
  const arg = flagIndex >= 0 ? process.argv[flagIndex + 1] : undefined;
  return arg ? path.resolve(arg) : DEFAULT_OUT;
}

/** Sibling of feedback.jsonl, same directory, whatever --out points at. */
function versionsPath(outPath: string): string {
  return path.join(path.dirname(outPath), 'game-versions.json');
}

/** Highest `id` already sitting in the destination file, so a rerun only appends what's
 *  new. Zero when the file is absent or empty — every row is new on a first run. */
function readWatermark(outPath: string): number {
  if (!fs.existsSync(outPath)) return 0;
  const lines = fs.readFileSync(outPath, 'utf-8').split('\n').filter(Boolean);
  let max = 0;
  for (const line of lines) {
    try {
      const row = JSON.parse(line) as { id?: number };
      if (typeof row.id === 'number' && row.id > max) max = row.id;
    } catch {
      // A malformed line here means someone hand-edited the ledger; skip rather than
      // crash the export over one bad row.
    }
  }
  return max;
}

/** Every distinct gameId that appears anywhere in the destination file, old and new rows
 *  alike — the snapshot has to cover a game even on a run that adds no feedback for it. */
function allGameIds(outPath: string): string[] {
  if (!fs.existsSync(outPath)) return [];
  const ids = new Set<string>();
  for (const line of fs.readFileSync(outPath, 'utf-8').split('\n').filter(Boolean)) {
    try {
      const row = JSON.parse(line) as { gameId?: string };
      if (row.gameId) ids.add(row.gameId);
    } catch {
      // Same tolerance as readWatermark: skip a hand-edited line rather than abort.
    }
  }
  return [...ids];
}

/** What Arc3MirrorCatalog is serving for each id right now, resolved the same way
 *  Arc3Promotion.ts resolves it for the in-app promotion signal — reused, not reimplemented. */
async function currentVersions(gameIds: string[]): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {};
  for (const id of gameIds) {
    try {
      const source = await Arc3MirrorCatalog.getSource(id);
      out[id] = source?.sourceVersion ?? null;
    } catch (error) {
      logger.warn(`export-arc3-feedback: could not resolve current build for ${id} - ${error instanceof Error ? error.message : String(error)}`);
      out[id] = null;
    }
  }
  return out;
}

async function main() {
  const outPath = resolveOutPath();
  const destDir = path.dirname(outPath);
  if (!fs.existsSync(destDir)) {
    console.error(`Destination directory does not exist: ${destDir}`);
    console.error('Pass --out to point at a real checkout of sonpham-org/autoresearch-arena.');
    process.exit(1);
  }

  await initializeDatabase();
  const pool = getPool();
  if (!pool) {
    console.error('No database pool — DATABASE_URL is not configured.');
    process.exit(1);
  }

  const watermark = readWatermark(outPath);

  // Note text included on purpose: this script IS the authorized reader the table's own
  // comments say to use SQL directly for. It is never served over HTTP.
  const result = await pool.query<FeedbackRow>(
    `SELECT id, game_id, source_version, flags, note, reached_level, outcome, created_at
       FROM community_game_feedback
      WHERE id > $1
      ORDER BY id ASC`,
    [watermark],
  );

  if (result.rows.length > 0) {
    const lines = result.rows.map((row) => JSON.stringify({
      id: Number(row.id),
      gameId: row.game_id,
      sourceVersion: row.source_version,
      flags: row.flags,
      note: row.note,
      reachedLevel: row.reached_level,
      outcome: row.outcome,
      createdAt: row.created_at,
    }));
    fs.appendFileSync(outPath, lines.join('\n') + '\n', 'utf-8');
    console.log(`Appended ${result.rows.length} row(s) (id ${watermark + 1}-${result.rows[result.rows.length - 1].id}) to ${outPath}`);
  } else {
    console.log(`Nothing new since id ${watermark}.`);
  }

  // Unconditional: a revision published today with zero feedback so far is exactly the
  // case a snapshot skipped on "no new rows" would miss until someone happens to play it.
  const ids = allGameIds(outPath);
  const versions = await currentVersions(ids);
  const versionsFile = versionsPath(outPath);
  fs.writeFileSync(
    versionsFile,
    JSON.stringify({
      _README: 'Current sourceVersion per gameId, as of generatedAt. Overwritten every '
        + 'run — join a feedback.jsonl row by comparing its own sourceVersion against '
        + 'this map\'s entry for the same gameId: equal means the note is about what is '
        + 'live now, unequal means it is about a build that has since been revised.',
      generatedAt: new Date().toISOString(),
      versions,
    }, null, 1) + '\n',
    'utf-8',
  );
  console.log(`Refreshed ${versionsFile} (${ids.length} game(s)).`);
  process.exit(0);
}

main().catch((error) => {
  console.error('export-arc3-feedback failed:', error);
  process.exit(1);
});
