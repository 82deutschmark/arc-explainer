/**
 * Author: Claude Sonnet 5
 * Date: 2026-09-12
 * PURPOSE: One-off script -- ranks each official ARC-AGI-3 game's difficulty from the
 *          real signal we have: the ARC Prize human leaderboard's action counts, not a
 *          guess. Everyone in the top 10 scores 100, so score can't rank anything; the
 *          fewest-actions number and how far the rest of the top 10 spreads out from it
 *          can.
 *          Run with: npx tsx server/scripts/compute-arc3-difficulty.ts
 *          Prints a table; does not write any files. Apply the results to
 *          shared/arc3Games/*.ts by hand after reviewing them.
 *          2026-09-16 (Claude Opus 5): the rule moved to shared/arc3Games/humanDifficulty.ts
 *          and this script now only prints it. Two changes came with the move: the reset
 *          rule is gone (a reset in the top 10 no longer bumps a game up a tier -- it is
 *          what made tu93 "hard" while five of its top 10 tie at 185 actions). The table
 *          also prints Boss's rating from his own scorecards (humanPlay.generated.json).
 *          2026-09-18: no date cutoff any more; every row on the board counts. The old exports
 *          rankDifficulty() and signalFromLeaderboard() are removed; nothing imported them.
 * SRP/DRY check: Pass -- reuses getHumanLeaderboard() (which carries the top-10 stats), top10Difficulty() and getOwnerGameRating() from
 *          shared/arc3Games/humanDifficulty.ts; no rating logic lives here any more.
 */

import { getPublicDemoGameIdsInOrder, getGameById } from '../../shared/arc3Games';
import { getOwnerGameRating, top10Difficulty } from '../../shared/arc3Games/humanDifficulty';
import { getHumanLeaderboard } from '../services/arc3/arcPrizeLeaderboardService';

function formatNumber(value: number | null, width: number): string {
  return (value === null ? '-' : String(Math.round(value * 10) / 10)).padStart(width);
}

async function main() {
  const rows: string[] = [];
  for (const gameId of getPublicDemoGameIdsInOrder()) {
    const current = getGameById(gameId)?.humanDifficulty ?? 'unknown';
    const owner = getOwnerGameRating(gameId);
    const ownerText = `boss=${owner.rating}${owner.summary ? '' : ' (not played yet)'}`;
    const board = await getHumanLeaderboard(gameId);
    if (!board) {
      rows.push(`${gameId.padEnd(6)} no leaderboard data  ${ownerText}  (current: ${current})`);
      continue;
    }
    const { stats } = board;
    rows.push(
      `${gameId.padEnd(6)} rows=${stats.totalRows}  wins=${stats.wins}  ` +
        `score=${stats.scoreMin ?? '-'}..${stats.scoreMax ?? '-'}  ` +
        `fewest=${formatNumber(stats.fewestActions, 4)}  median=${formatNumber(stats.medianActions, 6)}  ` +
        `most=${formatNumber(stats.mostActions, 4)}  ` +
        `relSpread=${stats.relativeSpread === null ? '  -' : `${(stats.relativeSpread * 100).toFixed(0).padStart(3)}%`}  ` +
        `-> top10=${top10Difficulty(stats)}  ${ownerText}  (current: ${current})`,
    );
  }
  console.log(rows.join('\n'));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
