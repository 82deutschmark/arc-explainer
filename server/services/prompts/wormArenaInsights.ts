/**
 * Author: Cascade
 * Date: 2025-12-29
 * PURPOSE: Centralized prompt construction logic for Worm Arena model insights reports.
 *          Moves logic out of SnakeBenchService for better SRP and easier auditing.
 *          Includes detailed performance metrics and competitive context.
 * 
 * SRP/DRY check: Pass - focused exclusively on prompt template building and formatting.
 */

import type {
  WormArenaModelInsightsSummary,
  WormArenaModelInsightsFailureMode,
  WormArenaModelInsightsOpponent,
} from '../../../shared/types.js';
import {
  formatPercent,
  formatUsd,
  formatOptionalNumber,
  formatReasonLabel,
} from '../../../shared/utils/formatters.ts';

// --- Prompt Builders ---

/**
 * Build the data-rich context prompt for the LLM model insights summary.
 * 
 * FIX (Responses API): This prompt now focuses purely on providing raw data context.
 * Narrative instructions and formatting constraints are moved to the Responses API
 * 'instructions' and 'json_schema' fields to avoid conflicting instructions.
 */
export const buildInsightsSummaryPrompt = (
  modelSlug: string,
  summary: WormArenaModelInsightsSummary,
  failureModes: WormArenaModelInsightsFailureMode[],
  lossOpponents: WormArenaModelInsightsOpponent[],
): string => {
  const failureLines = failureModes.length
    ? failureModes
        .slice(0, 5)
        .map(mode => `${formatReasonLabel(mode.reason)} (${formatPercent(mode.percentOfLosses)})`)
        .join(', ')
    : 'None';

  const opponentLines = lossOpponents.length
    ? lossOpponents
        .slice(0, 5)
        .map(opponent => `${opponent.opponentSlug} (${formatPercent(opponent.lossRate)})`)
        .join(', ')
    : 'None';

  const avgRounds = formatOptionalNumber(summary.averageRounds, 1);
  const minRounds = formatOptionalNumber(summary.minRounds, 1);
  const maxRounds = formatOptionalNumber(summary.maxRounds, 1);
  const maxScore = formatOptionalNumber(summary.maxScore, 2);
  const minScore = formatOptionalNumber(summary.minScore, 2);
  const medianScore = formatOptionalNumber(summary.medianScore, 2);
  const p25Score = formatOptionalNumber(summary.p25Score, 2);
  const p75Score = formatOptionalNumber(summary.p75Score, 2);
  
  const totalCost = formatUsd(summary.totalCost);
  const costPerGame = formatUsd(summary.costPerGame);
  const costPerWin = formatUsd(summary.costPerWin);
  const costPerLoss = formatUsd(summary.costPerLoss);
  
  const avgDeathRound = formatOptionalNumber(summary.averageDeathRoundLoss, 1);
  const lossCoverage = formatPercent(summary.lossDeathReasonCoverage);
  const earlyLossRate = formatPercent(summary.earlyLossRate);
  
  const trueSkillNote = summary.trueSkillExposed != null
    ? `TrueSkill exposed: ${Math.round(summary.trueSkillExposed)} (mu: ${Number(summary.trueSkillMu || 0).toFixed(1)}, sigma: ${Number(summary.trueSkillSigma || 0).toFixed(1)})`
    : 'TrueSkill: unrated';

  const leaderboardNote = summary.leaderboardRank != null && summary.totalModelsRanked != null
    ? `Leaderboard: Rank #${summary.leaderboardRank} of ${summary.totalModelsRanked} models (by TrueSkill)`
    : 'Leaderboard: Ranking unavailable';

  return [
    `# MODEL PERFORMANCE DATA: ${modelSlug}`,
    '',
    `## COMPETITIVE RECORD`,
    `- Total Games: ${summary.gamesPlayed}`,
    `- Match Record: ${summary.wins}W / ${summary.losses}L / ${summary.ties}T`,
    `- Win Rate (ties excluded): ${formatPercent(summary.winRate)}`,
    `- ${leaderboardNote}`,
    `- ${trueSkillNote}`,
    '',
    `## SURVIVAL & SCORING`,
    `- Rounds Played: Min ${minRounds} / Avg ${avgRounds} / Max ${maxRounds}`,
    `- Apple Count: Min ${minScore} / 25th %ile ${p25Score} / Median ${medianScore} / 75th %ile ${p75Score} / Max ${maxScore}`,
    `- Total Apples Eaten: ${summary.totalApples}`,
    '',
    `## LOSS ANALYSIS`,
    `- Avg Death Round (when losing): ${avgDeathRound}`,
    `- Early Loss Rate (round <= 5): ${earlyLossRate}`,
    `- Unknown Losses (no reason): ${summary.unknownLosses}`,
    `- Loss Reason Coverage: ${lossCoverage}`,
    `- Top Failure Modes: ${failureLines}`,
    `- Toughest Opponents: ${opponentLines}`,
    '',
    `## COST EFFICIENCY`,
    `- Total API Spend: ${totalCost}`,
    `- Cost per Game: ${costPerGame}`,
    `- Cost per Win: ${costPerWin}`,
    `- Cost per Loss: ${costPerLoss}`,
  ].join('\n');
};
