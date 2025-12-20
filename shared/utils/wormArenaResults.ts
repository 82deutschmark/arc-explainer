/**
 * Author: Cascade (Claude Sonnet 4)
 * Date: 2025-12-19
 * PURPOSE: Shared utilities for Worm Arena match result formatting and summarization.
 *          Extracts game outcome logic from WormArena.tsx for reusability.
 * SRP/DRY check: Pass - pure result/summary formatting functions only.
 */

import { formatInt, formatUsd } from './formatters.ts';

/**
 * Determine the result label for a snake in a match.
 * Checks multiple data sources in priority order.
 *
 * @param replayData - Full replay data object
 * @param snakeId - The snake ID to check
 * @param finalScores - Final scores object (fallback source)
 * @returns 'won' | 'lost' | 'tied' | null
 */
export function getSnakeResultLabel(
  replayData: any,
  snakeId: string,
  finalScores: Record<string, number> | null | undefined,
): 'won' | 'lost' | 'tied' | null {
  // Check explicit result field first
  const raw = replayData?.players?.[snakeId]?.result;
  if (raw === 'won' || raw === 'lost' || raw === 'tied') return raw;

  // Try player final_score comparison
  const myFinalScore = replayData?.players?.[snakeId]?.final_score;
  if (typeof myFinalScore === 'number') {
    const otherId = Object.keys(replayData?.players ?? {}).find((id) => id !== snakeId);
    const otherFinalScore = otherId ? replayData?.players?.[otherId]?.final_score : undefined;

    if (typeof otherFinalScore === 'number') {
      if (myFinalScore > otherFinalScore) return 'won';
      if (myFinalScore < otherFinalScore) return 'lost';
      return 'tied';
    }
  }

  // Fallback to finalScores object
  const myScore = finalScores?.[snakeId];
  if (typeof myScore === 'number') {
    const otherId = Object.keys(finalScores ?? {}).find((id) => id !== snakeId);
    const otherScore = otherId ? finalScores?.[otherId] : undefined;

    if (typeof otherScore === 'number') {
      if (myScore > otherScore) return 'won';
      if (myScore < otherScore) return 'lost';
      return 'tied';
    }
  }

  return null;
}

/**
 * Build a detailed final summary for a single player in a match.
 * Includes result, scores, death info, token usage, and game metadata.
 *
 * @param replayData - Full replay data object
 * @param snakeId - The snake ID to summarize
 * @param framesLength - Number of frames in the replay
 * @param finalScores - Final scores object for result calculation
 * @returns Multi-line summary string
 */
export function buildFinalSummary(
  replayData: any,
  snakeId: string,
  framesLength: number,
  finalScores: Record<string, number> | null | undefined,
): string {
  if (!snakeId) return '';

  const player = replayData?.players?.[snakeId];
  const game = replayData?.game;
  const maxRounds = game?.max_rounds ?? replayData?.metadata?.max_rounds;
  const rounds = game?.rounds_played ?? replayData?.metadata?.actual_rounds ?? framesLength;
  const boardW = game?.board?.width;
  const boardH = game?.board?.height;
  const numApples = game?.board?.num_apples;

  const resultLabel = getSnakeResultLabel(replayData, snakeId, finalScores);
  const outcome = (resultLabel ?? 'unknown').toUpperCase();

  const lines: string[] = [];

  lines.push(`Final result: ${outcome}`);

  if (typeof player?.name === 'string' && player.name.trim().length > 0) {
    lines.push(`Model: ${player.name}`);
  }

  if (typeof player?.model_id === 'string' && player.model_id.trim().length > 0) {
    lines.push(`Model id: ${player.model_id}`);
  }

  if (typeof player?.final_score === 'number' && Number.isFinite(player.final_score)) {
    lines.push(`Final score: ${formatInt(player.final_score)}`);
  }

  if (player?.death) {
    const reason = typeof player.death?.reason === 'string' && player.death.reason.trim().length > 0 ? player.death.reason : 'unknown';
    const round = typeof player.death?.round === 'number' && Number.isFinite(player.death.round) ? ` (round ${formatInt(player.death.round)})` : '';
    lines.push(`Death: ${reason}${round}`);
  } else {
    lines.push('Death: none');
  }

  const inTok = player?.totals?.input_tokens;
  const outTok = player?.totals?.output_tokens;
  const cost = player?.totals?.cost;

  if (typeof inTok === 'number' && Number.isFinite(inTok)) {
    lines.push(`Input tokens: ${formatInt(inTok)}`);
  } else {
    lines.push('Input tokens: N/A');
  }

  if (typeof outTok === 'number' && Number.isFinite(outTok)) {
    lines.push(`Output tokens: ${formatInt(outTok)}`);
  } else {
    lines.push('Output tokens: N/A');
  }

  const totalTok = (typeof inTok === 'number' && Number.isFinite(inTok) ? inTok : 0) + (typeof outTok === 'number' && Number.isFinite(outTok) ? outTok : 0);
  if (totalTok > 0) {
    lines.push(`Total tokens: ${formatInt(totalTok)}`);
  } else {
    lines.push('Total tokens: N/A');
  }

  lines.push(`Cost: ${formatUsd(cost)} (raw: ${typeof cost === 'number' && Number.isFinite(cost) ? cost : 'N/A'})`);

  if (typeof rounds === 'number' && Number.isFinite(rounds) && rounds > 0) {
    if (totalTok > 0) {
      lines.push(`Avg tokens/round: ${formatInt(totalTok / rounds)}`);
    }
    if (typeof cost === 'number' && Number.isFinite(cost)) {
      lines.push(`Avg cost/round: ${formatUsd(cost / rounds)}`);
    }
  }

  if (typeof game?.id === 'string' && game.id.trim().length > 0) {
    lines.push(`Game id: ${game.id}`);
  }
  if (typeof game?.game_type === 'string' && game.game_type.trim().length > 0) {
    lines.push(`Game type: ${game.game_type}`);
  }
  if (typeof game?.started_at === 'string' && game.started_at.trim().length > 0) {
    lines.push(`Started at: ${game.started_at}`);
  }
  if (typeof game?.ended_at === 'string' && game.ended_at.trim().length > 0) {
    lines.push(`Ended at: ${game.ended_at}`);
  }
  if (typeof rounds === 'number' && Number.isFinite(rounds)) {
    lines.push(`Rounds played: ${formatInt(rounds)}`);
  }
  if (typeof maxRounds === 'number' && Number.isFinite(maxRounds)) {
    lines.push(`Max rounds: ${formatInt(maxRounds)}`);
  }
  if (typeof boardW === 'number' && Number.isFinite(boardW) && typeof boardH === 'number' && Number.isFinite(boardH)) {
    lines.push(`Board: ${formatInt(boardW)}x${formatInt(boardH)}`);
  }
  if (typeof numApples === 'number' && Number.isFinite(numApples)) {
    lines.push(`Apples per round: ${formatInt(numApples)}`);
  }

  return lines.join('\n');
}

/**
 * Build a match-wide totals summary showing aggregate stats for both players.
 * Includes winner, total tokens, total cost, and per-round averages.
 *
 * @param replayData - Full replay data object
 * @param framesLength - Number of frames in the replay
 * @param finalScores - Final scores object
 * @param playerLabels - Map of snake ID to display name
 * @returns Multi-line summary string
 */
export function buildMatchTotalsSummary(
  replayData: any,
  framesLength: number,
  finalScores: Record<string, number> | null | undefined,
  playerLabels: Record<string, string>,
): string {
  const totals = replayData?.totals;
  if (!totals) return '';

  const game = replayData?.game;
  const rounds = game?.rounds_played ?? replayData?.metadata?.actual_rounds ?? framesLength;

  const matchIn = totals?.input_tokens;
  const matchOut = totals?.output_tokens;
  const matchCost = totals?.cost;
  const matchTok =
    (typeof matchIn === 'number' && Number.isFinite(matchIn) ? matchIn : 0) +
    (typeof matchOut === 'number' && Number.isFinite(matchOut) ? matchOut : 0);

  const lines: string[] = [];

  // Add winner information
  const playerIds = Object.keys(finalScores ?? {});
  if (playerIds.length >= 2) {
    const playerAId = playerIds[0];
    const playerBId = playerIds[1];
    const playerAScore = finalScores?.[playerAId] ?? 0;
    const playerBScore = finalScores?.[playerBId] ?? 0;

    const playerAName = playerLabels[playerAId] ?? 'Player A';
    const playerBName = playerLabels[playerBId] ?? 'Player B';

    let winnerText = '';
    if (playerAScore > playerBScore) {
      winnerText = `${playerAName} won (${formatInt(playerAScore)} - ${formatInt(playerBScore)})`;
    } else if (playerBScore > playerAScore) {
      winnerText = `${playerBName} won (${formatInt(playerBScore)} - ${formatInt(playerAScore)})`;
    } else {
      winnerText = `Tie game (${formatInt(playerAScore)} - ${formatInt(playerBScore)})`;
    }

    lines.push(`Result: ${winnerText}`);
    lines.push('');
  }

  lines.push('Match totals:');
  lines.push(`Input tokens: ${formatInt(matchIn)}`);
  lines.push(`Output tokens: ${formatInt(matchOut)}`);
  lines.push(`Total tokens: ${matchTok > 0 ? formatInt(matchTok) : 'N/A'}`);
  lines.push(
    `Cost: ${formatUsd(matchCost)} (raw: ${typeof matchCost === 'number' && Number.isFinite(matchCost) ? matchCost : 'N/A'})`,
  );
  if (typeof rounds === 'number' && Number.isFinite(rounds) && rounds > 0) {
    if (matchTok > 0) {
      lines.push(`Avg tokens/round: ${formatInt(matchTok / rounds)}`);
    }
    if (typeof matchCost === 'number' && Number.isFinite(matchCost)) {
      lines.push(`Avg cost/round: ${formatUsd(matchCost / rounds)}`);
    }
  }

  return lines.join('\n');
}

/**
 * Append final result summary to reasoning text if on final frame.
 *
 * @param isFinalFrame - Whether currently on the final frame
 * @param snakeId - Snake ID to build summary for
 * @param reasoning - Current reasoning text
 * @param replayData - Full replay data object
 * @param framesLength - Number of frames
 * @param finalScores - Final scores object
 * @returns Reasoning with appended summary if on final frame
 */
export function appendFinalResultIfNeeded(
  isFinalFrame: boolean,
  snakeId: string,
  reasoning: string,
  replayData: any,
  framesLength: number,
  finalScores: Record<string, number> | null | undefined,
): string {
  if (!isFinalFrame || !snakeId) return reasoning;
  const finalSummary = buildFinalSummary(replayData, snakeId, framesLength, finalScores);
  const prefix = reasoning?.trim()?.length ? `${reasoning.trim()}\n\n` : '';
  return finalSummary ? `${prefix}${finalSummary}` : reasoning;
}
