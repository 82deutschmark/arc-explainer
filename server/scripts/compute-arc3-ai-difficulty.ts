/**
 * Author: Claude Sonnet 5
 * Date: 2026-09-13
 * PURPOSE: One-off script -- ranks each official ARC-AGI-3 public-demo game's difficulty
 *          from real AI agent performance instead of a guess or the human leaderboard.
 *          Source is the arc3_game_scores table in the ARC3/Arena competition Postgres DB
 *          (a separate Railway project from this app's own DB -- see the arc-3 repo's
 *          railway/catalog_schema.sql), which has one row per (run, game): score,
 *          levels_completed, levels_total, actions. This script averages
 *          levels_completed/levels_total per game across every published run, then ranks
 *          the 25 public-demo games against each other and splits into quartiles
 *          (bottom 7 = 'very-hard', next 6 = 'hard', next 6 = 'medium', top 6 = 'easy').
 *          Quartiles rather than fixed cutoffs because the whole set skews hard for AI --
 *          the best average clear rate across all 25 games is under 50% -- so a fixed
 *          threshold (as compute-arc3-difficulty.ts uses for humans) would call almost
 *          everything "very-hard" and say nothing. Ranking against the rest of the set is
 *          also what "one of the seven hardest" (how this gets talked about informally)
 *          actually means, so the bottom-7 cutoff makes that phrase precise instead of
 *          rhetorical.
 *          THIS IS A SNAPSHOT, NOT A LIVE FEED. Run data keeps accumulating from ongoing
 *          competition runs; this script is meant to be re-run by hand occasionally, not
 *          wired into a build or a page load. Whatever it prints on a given day reflects
 *          whatever models and harnesses were being run at that time, not "AI" in general.
 *          Requires DATABASE_PUBLIC_URL in the environment (the ARC3/Arena Railway
 *          Postgres public proxy URL -- not this app's own DATABASE_URL).
 *          Run with: DATABASE_PUBLIC_URL=... npx tsx server/scripts/compute-arc3-ai-difficulty.ts
 *          Prints a table; does not write any files. Apply the results to
 *          shared/arc3Games/*.ts (the `aiDifficulty` field) by hand after reviewing them.
 * SRP/DRY check: Pass -- reuses the shared game registry for the public-25 id list and the
 *          DifficultyRating type; rankAiDifficulty() is exported so the same rule can be
 *          reused later instead of re-deriving it.
 */

import { Client } from 'pg';
import { getPublicDemoGameIdsInOrder, type DifficultyRating } from '../../shared/arc3Games';

export interface AiDifficultySignal {
  gameId: string;
  runCount: number;
  levelsTotal: number;
  avgClearFraction: number;
  fullClears: number;
  neverClearedLevel1: number;
  avgScore: number;
  avgActions: number;
}

/**
 * Bottom 7 of 25 by avgClearFraction -> 'very-hard', next 6 -> 'hard', next 6 -> 'medium',
 * top 6 -> 'easy'. Ties broken by input order (stable sort), which only matters for games
 * sitting exactly on a quartile boundary.
 */
export function rankAiDifficulty(signals: AiDifficultySignal[]): Map<string, DifficultyRating> {
  const sorted = [...signals].sort((a, b) => a.avgClearFraction - b.avgClearFraction);
  const result = new Map<string, DifficultyRating>();
  sorted.forEach((signal, index) => {
    const rating: DifficultyRating =
      index < 7 ? 'very-hard' : index < 13 ? 'hard' : index < 19 ? 'medium' : 'easy';
    result.set(signal.gameId, rating);
  });
  return result;
}

async function main() {
  const databaseUrl = process.env.DATABASE_PUBLIC_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_PUBLIC_URL is required (the ARC3/Arena Railway Postgres URL, not this app\'s DATABASE_URL)');
  }
  const publicIds = new Set(getPublicDemoGameIdsInOrder());

  const client = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 10_000 });
  await client.connect();
  try {
    const { rows } = await client.query<{
      game_id: string;
      score: string;
      levels_completed: number;
      levels_total: number;
      actions: number;
    }>(
      `SELECT gs.game_id, gs.score, gs.levels_completed, gs.levels_total, gs.actions
       FROM arc3_game_scores gs
       JOIN arc3_runs r ON r.run_id = gs.run_id
       WHERE r.status = 'published'`,
    );

    const byGame = new Map<string, { score: number; lc: number; lt: number; actions: number }[]>();
    for (const row of rows) {
      const baseId = row.game_id.split('-')[0];
      if (!publicIds.has(baseId)) continue;
      if (!row.levels_total || row.levels_total <= 0) continue;
      const list = byGame.get(baseId) ?? [];
      list.push({ score: Number(row.score), lc: row.levels_completed, lt: row.levels_total, actions: row.actions });
      byGame.set(baseId, list);
    }

    const signals: AiDifficultySignal[] = [];
    for (const [gameId, entries] of byGame) {
      const n = entries.length;
      signals.push({
        gameId,
        runCount: n,
        levelsTotal: entries[0].lt,
        avgClearFraction: entries.reduce((sum, e) => sum + e.lc / e.lt, 0) / n,
        fullClears: entries.filter((e) => e.lc >= e.lt).length,
        neverClearedLevel1: entries.filter((e) => e.lc === 0).length,
        avgScore: entries.reduce((sum, e) => sum + e.score, 0) / n,
        avgActions: entries.reduce((sum, e) => sum + e.actions, 0) / n,
      });
    }

    const ratings = rankAiDifficulty(signals);
    signals.sort((a, b) => a.avgClearFraction - b.avgClearFraction);

    const missing = [...publicIds].filter((id) => !byGame.has(id));

    const header = `${'game'.padEnd(6)} ${'n'.padStart(4)} ${'levels'.padStart(6)} ${'avgClear'.padStart(9)} ${'fullClr'.padStart(7)} ${'never1'.padStart(6)} ${'avgScore'.padStart(8)} ${'avgActions'.padStart(10)}  rating`;
    const lines = signals.map((s) => {
      const rating = ratings.get(s.gameId);
      return (
        `${s.gameId.padEnd(6)} ${String(s.runCount).padStart(4)} ${String(s.levelsTotal).padStart(6)} ` +
        `${(s.avgClearFraction * 100).toFixed(1).padStart(8)}% ${String(s.fullClears).padStart(7)} ` +
        `${String(s.neverClearedLevel1).padStart(6)} ${s.avgScore.toFixed(2).padStart(8)} ${s.avgActions.toFixed(1).padStart(10)}  -> ${rating}`
      );
    });

    console.log(header);
    console.log(lines.join('\n'));
    if (missing.length > 0) {
      console.log(`\nno AI run data at all for: ${missing.join(', ')}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
