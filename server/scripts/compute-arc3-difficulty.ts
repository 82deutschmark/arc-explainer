/**
 * Author: Claude Sonnet 5
 * Date: 2026-09-12
 * PURPOSE: One-off script -- ranks each official ARC-AGI-3 game's difficulty from the
 *          real signal we have: the ARC Prize human leaderboard's action counts, not a
 *          guess. Everyone in the top 10 scores 100, so score can't rank anything; the
 *          fewest-actions number and how far the rest of the top 10 spreads out from it
 *          can. A wide spread means the "obvious" route still leaves a lot of room to
 *          play worse; a reset sitting in the top 10 means even a top player needed a
 *          do-over to get there.
 *          Run with: npx tsx server/scripts/compute-arc3-difficulty.ts
 *          Prints a table; does not write any files. Apply the results to
 *          shared/arc3Games/*.ts by hand after reviewing them.
 * SRP/DRY check: Pass -- reuses getHumanLeaderboard() and the shared game registry
 *          rather than re-implementing the fetch. rankDifficulty() is exported so the
 *          same rule can be reused later instead of re-deriving it.
 */

import { getAllGames } from '../../shared/arc3Games';
import { getHumanLeaderboard, type HumanLeaderboard } from '../services/arc3/arcPrizeLeaderboardService';

export interface DifficultySignal {
  fewestActions: number;
  topSpread: number;
  relativeSpread: number;
  tiedAtFewest: number;
  resetsInTop: number;
  sampleSize: number;
}

/**
 * Easy/medium/hard from the top of the human leaderboard alone -- deliberately just two
 * numbers, not a weighted model. `relativeSpread` compares the top entry to the worst of
 * the sampled top-10 as a fraction of the fewest-actions count, since raw action counts
 * scale with how long a game is; a reset anywhere in that top 10 bumps the result up a
 * tier on its own, since a do-over from a top player is a stronger tell than a wide
 * spread with clean runs.
 */
export function rankDifficulty(signal: DifficultySignal): 'easy' | 'medium' | 'hard' {
  const hasResets = signal.resetsInTop > 0;
  if (signal.relativeSpread >= 0.5 || signal.resetsInTop >= 2) return 'hard';
  if (signal.relativeSpread >= 0.15 || hasResets) return 'medium';
  return 'easy';
}

export function signalFromLeaderboard(board: HumanLeaderboard): DifficultySignal | null {
  const wins = board.entries.filter((e) => e.actions > 0);
  if (wins.length === 0 || board.fewestActions === null) return null;
  const top = wins.slice(0, 10);
  const actions = top.map((e) => e.actions);
  return {
    fewestActions: board.fewestActions,
    topSpread: Math.max(...actions) - Math.min(...actions),
    relativeSpread: (Math.max(...actions) - Math.min(...actions)) / board.fewestActions,
    tiedAtFewest: top.filter((e) => e.actions === board.fewestActions).length,
    resetsInTop: top.filter((e) => e.resets > 0).length,
    sampleSize: top.length,
  };
}

async function main() {
  const games = getAllGames();
  const rows: string[] = [];
  for (const game of games) {
    const board = await getHumanLeaderboard(game.gameId);
    if (!board) {
      rows.push(`${game.gameId.padEnd(6)} no leaderboard data`);
      continue;
    }
    const signal = signalFromLeaderboard(board);
    if (!signal) {
      rows.push(`${game.gameId.padEnd(6)} no winning runs`);
      continue;
    }
    const difficulty = rankDifficulty(signal);
    rows.push(
      `${game.gameId.padEnd(6)} fewest=${String(signal.fewestActions).padStart(4)}  ` +
        `spread=${String(signal.topSpread).padStart(4)}  ` +
        `relSpread=${(signal.relativeSpread * 100).toFixed(0).padStart(3)}%  ` +
        `tied=${signal.tiedAtFewest}  resetsInTop=${signal.resetsInTop}  n=${signal.sampleSize}  ` +
        `-> ${difficulty}` +
        `  (current: ${game.humanDifficulty})`,
    );
  }
  console.log(rows.join('\n'));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
