/**
 * Author: Codex (GPT-5)
 * Date: 2025-12-20
 * PURPOSE: Thin orchestrator facade for SnakeBench service with model insights report formatting
 *          and OpenAI summary generation for the Worm Arena model insights report.
 * SRP/DRY check: Pass - delegation, report formatting, and summary wiring only.
 */

import type {
  SnakeBenchRunMatchRequest,
  SnakeBenchRunMatchResult,
  SnakeBenchRunBatchRequest,
  SnakeBenchRunBatchResult,
  SnakeBenchGameSummary,
  SnakeBenchHealthResponse,
  SnakeBenchArcExplainerStats,
  SnakeBenchModelRating,
  SnakeBenchModelMatchHistoryEntry,
  SnakeBenchTrueSkillLeaderboardEntry,
  WormArenaGreatestHitGame,
  SnakeBenchMatchSearchQuery,
  SnakeBenchMatchSearchRow,
  WormArenaStreamStatus,
  WormArenaFrameEvent,
  WormArenaModelInsightsReport,
  WormArenaModelInsightsSummary,
  WormArenaModelInsightsFailureMode,
  WormArenaModelInsightsOpponent,
} from '../../shared/types.js';
import { repositoryService } from '../repositories/RepositoryService.ts';
import { logger } from '../utils/logger.ts';
import { openAIClient } from './openai/client.js';
import { normalizeResponse } from './openai/responseParser.js';

// Import from new modules
import { SnakeBenchMatchRunner } from './snakeBench/SnakeBenchMatchRunner.ts';
import { SnakeBenchStreamingRunner } from './snakeBench/SnakeBenchStreamingRunner.ts';
import { SnakeBenchReplayResolver } from './snakeBench/SnakeBenchReplayResolver.ts';
import { snakeBenchPythonBridge } from './snakeBench/SnakeBenchPythonBridge.ts';
import { PersistenceCoordinator } from './snakeBench/persistence/persistenceCoordinator.ts';
import { GameIndexManager } from './snakeBench/persistence/gameIndexManager.ts';
import { getSnakeBenchAllowedModels } from './snakeBench/helpers/modelAllowlist.ts';
import { filterReplayableGames, getWormArenaGreatestHitsFiltered } from './snakeBench/helpers/replayFilters.ts';
import { suggestMatchups } from './snakeBench/helpers/matchupSuggestions.ts';
import { MODELS } from '../config/models.ts';
import path from 'path';
import fs from 'fs';

// Use a direct OpenAI model for the LLM summary step.
const INSIGHTS_SUMMARY_MODEL = 'gpt-5-nano-2025-08-07';

// Normalize model slugs so ":free" suffixes do not split report data.
const normalizeModelSlug = (modelSlug: string): string => modelSlug.trim().replace(/:free$/i, '');

// Format a ratio as a percent string for report text.
const formatPercent = (value: number): string => `${(value * 100).toFixed(1)}%`;

// Format a number with a fallback when data is missing.
const formatOptionalNumber = (value: number | null, digits: number): string =>
  value == null || Number.isNaN(value) ? '-' : value.toFixed(digits);

// Format a cost value for report text.
const formatCost = (value: number | null): string =>
  value == null || Number.isNaN(value) ? '-' : `$${value.toFixed(4)}`;

// Convert snake death reason values into human-readable labels.
const formatReasonLabel = (reason: string): string => reason.replace(/_/g, ' ').trim();

// Build the prompt used to request a short LLM summary for the report.
const buildInsightsSummaryPrompt = (
  modelSlug: string,
  summary: WormArenaModelInsightsSummary,
  failureModes: WormArenaModelInsightsFailureMode[],
  lossOpponents: WormArenaModelInsightsOpponent[],
): string => {
  const failureLines = failureModes.length
    ? failureModes
        .slice(0, 4)
        .map(mode => `${formatReasonLabel(mode.reason)} (${formatPercent(mode.percentOfLosses)})`)
        .join(', ')
    : 'None';

  const opponentLines = lossOpponents.length
    ? lossOpponents
        .slice(0, 4)
        .map(opponent => `${opponent.opponentSlug} (${formatPercent(opponent.lossRate)})`)
        .join(', ')
    : 'None';

  const avgRounds = formatOptionalNumber(summary.averageRounds, 1);
  const avgScore = formatOptionalNumber(summary.averageScore, 2);
  const costPerLoss = formatCost(summary.costPerLoss);
  const lossCoverage = formatPercent(summary.lossDeathReasonCoverage);
  const earlyLossRate = formatPercent(summary.earlyLossRate);

  return [
    'Write one short paragraph (max 80 words).',
    'No bullets, no headings, no disclaimers.',
    'Focus on why the model loses and one practical next step.',
    `Model: ${modelSlug}`,
    `Games: ${summary.gamesPlayed}, Wins: ${summary.wins}, Losses: ${summary.losses}, Win rate: ${formatPercent(summary.winRate)}`,
    `Average rounds: ${avgRounds}, Average score: ${avgScore}, Cost per loss: ${costPerLoss}`,
    `Early loss rate: ${earlyLossRate}, Loss reason coverage: ${lossCoverage}`,
    `Top failure modes: ${failureLines}`,
    `Tough opponents by loss rate: ${opponentLines}`,
  ].join('\n');
};

// Extract the text summary from a Responses API payload with reasoning fallback.
const extractInsightsSummaryText = (response: any): string | null => {
  const normalized = normalizeResponse(response, { modelKey: INSIGHTS_SUMMARY_MODEL });
  const text = typeof normalized.output_text === 'string' ? normalized.output_text.trim() : '';
  if (text) {
    return text.replace(/\s+/g, ' ').trim();
  }

  const reasoning = normalized.output_reasoning?.summary;
  if (typeof reasoning === 'string' && reasoning.trim().length > 0) {
    return reasoning.replace(/\s+/g, ' ').trim();
  }

  if (Array.isArray(reasoning)) {
    const joined = reasoning
      .map(item => (typeof item === 'string' ? item : ''))
      .filter(Boolean)
      .join(' ');
    if (joined.trim().length > 0) {
      return joined.replace(/\s+/g, ' ').trim();
    }
  }

  if (reasoning && typeof reasoning === 'object' && typeof (reasoning as any).text === 'string') {
    const summaryText = (reasoning as any).text.trim();
    return summaryText.length > 0 ? summaryText.replace(/\s+/g, ' ').trim() : null;
  }

  return null;
};

// Call OpenAI directly to generate the model insights summary text.
const requestInsightsSummary = async (
  modelSlug: string,
  summary: WormArenaModelInsightsSummary,
  failureModes: WormArenaModelInsightsFailureMode[],
  lossOpponents: WormArenaModelInsightsOpponent[],
): Promise<string | null> => {
  // Build a compact prompt from the aggregated stats for the LLM.
  const prompt = buildInsightsSummaryPrompt(modelSlug, summary, failureModes, lossOpponents);

  // Prepare a Responses API payload tailored for a short, single-paragraph summary.
  // Use the simple input format that works with the OpenAI SDK
  const requestBody = {
    model: INSIGHTS_SUMMARY_MODEL,
    input: [
      {
        id: `msg_${Date.now()}_summary_${Math.random().toString(16).slice(2)}`,
        role: 'user',
        type: 'message',
        content: [
          {
            type: 'input_text',
            text: prompt,
          },
        ],
      },
    ],
    instructions: 'You are a concise analytics reporter for game model performance.',
    reasoning: {
      effort: 'medium',
      summary: 'auto',
    },
    text: {
      verbosity: 'high',
    },
    max_output_tokens: 600,
  };

  try {
    // Execute the OpenAI request and extract the summary text from the response.
    // Type assertion to bypass TypeScript checking since the runtime format is correct
    const response = await openAIClient.responses.create(requestBody as any);
    return extractInsightsSummaryText(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`SnakeBenchService.requestInsightsSummary failed: ${message}`, 'snakebench-service');
    return null;
  }
};

// Build the markdown version of the model insights report.
const buildInsightsMarkdown = (
  modelSlug: string,
  generatedAt: string,
  summary: WormArenaModelInsightsSummary,
  failureModes: WormArenaModelInsightsFailureMode[],
  lossOpponents: WormArenaModelInsightsOpponent[],
  llmSummary: string | null,
): string => {
  const lines: string[] = [];
  const knownLosses = Math.max(summary.losses - summary.unknownLosses, 0);

  lines.push('# Worm Arena Model Insights');
  lines.push(`Model: ${modelSlug}`);
  lines.push(`Generated: ${generatedAt}`);
  lines.push('');
  // Include the LLM summary near the top for quick scanning.
  lines.push('LLM Summary');
  lines.push(llmSummary && llmSummary.trim().length > 0 ? llmSummary : 'Summary unavailable.');
  lines.push('');
  lines.push('Summary');
  lines.push(`- Games played: ${summary.gamesPlayed}`);
  lines.push(`- Win rate (decided): ${formatPercent(summary.winRate)}`);
  lines.push(`- Total cost: ${formatCost(summary.totalCost)}`);
  lines.push(`- Cost per game: ${formatCost(summary.costPerGame)}`);
  lines.push(`- Cost per win: ${formatCost(summary.costPerWin)}`);
  lines.push(`- Cost per loss: ${formatCost(summary.costPerLoss)}`);
  lines.push(`- Average rounds: ${formatOptionalNumber(summary.averageRounds, 1)}`);
  lines.push(`- Average score: ${formatOptionalNumber(summary.averageScore, 2)}`);
  lines.push(`- Average loss round: ${formatOptionalNumber(summary.averageDeathRoundLoss, 1)}`);
  lines.push(`- Early losses (round <= 5): ${summary.earlyLosses} (${formatPercent(summary.earlyLossRate)})`);
  lines.push('');
  lines.push('Failure modes (losses)');
  if (failureModes.length === 0) {
    lines.push('- No losses recorded.');
  } else {
    failureModes.forEach((mode) => {
      const reasonLabel = formatReasonLabel(mode.reason);
      const avgRound = formatOptionalNumber(mode.averageDeathRound, 1);
      lines.push(
        `- ${reasonLabel}: ${mode.losses} (${formatPercent(mode.percentOfLosses)}), avg round ${avgRound}`,
      );
    });
  }
  lines.push('');
  lines.push('Tough opponents (by losses)');
  if (lossOpponents.length === 0) {
    lines.push('- No opponents recorded.');
  } else {
    lossOpponents.forEach((opponent) => {
      const lastPlayed = opponent.lastPlayedAt ?? '-';
      lines.push(
        `- ${opponent.opponentSlug}: ${opponent.losses} losses out of ${opponent.gamesPlayed} games, last played ${lastPlayed}`,
      );
    });
  }
  lines.push('');
  lines.push('Data quality');
  lines.push(
    `- Losses with death reason: ${formatPercent(summary.lossDeathReasonCoverage)} (${knownLosses} of ${summary.losses})`,
  );
  lines.push(`- Losses without death reason: ${summary.unknownLosses}`);

  return lines.join('\n');
};

// Build a concise tweet for sharing the report.
const buildInsightsTweet = (
  modelSlug: string,
  summary: WormArenaModelInsightsSummary,
  failureModes: WormArenaModelInsightsFailureMode[],
): string => {
  const topFailure = failureModes[0];
  const topReason = topFailure ? formatReasonLabel(topFailure.reason) : 'none';
  const topReasonPct = topFailure ? formatPercent(topFailure.percentOfLosses) : '0.0%';
  const avgRounds = summary.averageRounds != null ? summary.averageRounds.toFixed(0) : 'n/a';
  const costPerLoss =
    summary.costPerLoss != null ? `$${summary.costPerLoss.toFixed(4)}` : 'n/a';

  const tweet = `Worm Arena insights for ${modelSlug}: win rate ${formatPercent(
    summary.winRate,
  )}, top loss ${topReason} (${topReasonPct}), avg rounds ${avgRounds}, cost per loss ${costPerLoss}. #WormArena`;

  return tweet.length > 260 ? `${tweet.slice(0, 257)}...` : tweet;
};

export interface StreamingHandlers {
  onStatus?: (status: WormArenaStreamStatus) => void;
  onFrame?: (frame: WormArenaFrameEvent) => void;
  onChunk?: (chunk: any) => void;
  onComplete?: (result: SnakeBenchRunMatchResult) => void;
  onError?: (err: Error) => void;
}

class SnakeBenchService {
  private readonly matchRunner: SnakeBenchMatchRunner;
  private readonly streamingRunner: SnakeBenchStreamingRunner;
  private readonly replayResolver: SnakeBenchReplayResolver;
  private readonly persistenceCoordinator: PersistenceCoordinator;
  private readonly gameIndexManager: GameIndexManager;

  constructor() {
    const backendDir = path.join(process.cwd(), 'external', 'SnakeBench', 'backend');
    const completedDir = path.join(backendDir, 'completed_games');

    this.gameIndexManager = new GameIndexManager(completedDir);
    this.persistenceCoordinator = new PersistenceCoordinator(this.gameIndexManager);
    this.matchRunner = new SnakeBenchMatchRunner(this.persistenceCoordinator);
    this.streamingRunner = new SnakeBenchStreamingRunner(this.persistenceCoordinator);
    this.replayResolver = new SnakeBenchReplayResolver(backendDir);
  }

  /**
   * Run a single match between two models.
   * Non-blocking persistence (queued for async DB writes).
   */
  async runMatch(request: SnakeBenchRunMatchRequest): Promise<SnakeBenchRunMatchResult> {
    const allowedModels = await getSnakeBenchAllowedModels();
    return this.matchRunner.runMatch(request, allowedModels);
  }

  /**
   * Run streaming match with live status/frame events.
   */
  async runMatchStreaming(
    request: SnakeBenchRunMatchRequest,
    handlers: StreamingHandlers = {}
  ): Promise<SnakeBenchRunMatchResult> {
    const allowedModels = await getSnakeBenchAllowedModels();
    return this.streamingRunner.runMatchStreaming(request, handlers, allowedModels);
  }

  /**
   * Run multiple matches sequentially (batch mode).
   */
  async runBatch(request: SnakeBenchRunBatchRequest): Promise<SnakeBenchRunBatchResult> {
    const allowedModels = await getSnakeBenchAllowedModels();
    return this.matchRunner.runBatch(request, allowedModels);
  }

  /**
   * Get replay for a given gameId (server-side, no CORS).
   */
  async getGame(gameId: string): Promise<{ data: any }> {
    return this.replayResolver.getReplay(gameId);
  }

  /**
   * Get replay for a given gameId (alias for backward compatibility).
   */
  async getGameProxy(gameId: string): Promise<{ data: any }> {
    return this.replayResolver.getReplay(gameId);
  }

  /**
   * List recent games with available replays.
   */
  async listGames(limit: number = 20): Promise<{ games: SnakeBenchGameSummary[]; total: number }> {
    const safeLimit = Math.max(1, Math.min(limit ?? 20, 100));

    // Prefer database-backed summaries, but gracefully fall back to filesystem index
    try {
      const { games, total } = await repositoryService.snakeBench.getRecentGames(safeLimit);
      if (total > 0 && games.length > 0) {
        const replayable = filterReplayableGames(games);
        const available = await this.replayResolver.filterGamesWithAvailableReplays(replayable);

        // Get global total from stats (all matches ever, not just this batch)
        let globalTotal = total;
        try {
          const stats = await repositoryService.snakeBench.getArcExplainerStats();
          globalTotal = stats.totalGames;
        } catch {
          // Fall back to recent games total if stats fetch fails
          globalTotal = total;
        }

        return { games: available, total: globalTotal };
      }
    } catch (dbErr) {
      const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
      logger.warn(
        `SnakeBenchService.listGames: DB-backed recent games failed, falling back to filesystem: ${msg}`,
        'snakebench-service'
      );
    }

    // Fallback to filesystem index
    const backendDir = path.join(process.cwd(), 'external', 'SnakeBench', 'backend');
    const completedDir = path.join(backendDir, 'completed_games');
    const indexPath = path.join(completedDir, 'game_index.json');

    try {
      if (!fs.existsSync(indexPath)) {
        return { games: [], total: 0 };
      }

      const raw = await fs.promises.readFile(indexPath, 'utf8');
      const entries: any[] = JSON.parse(raw);
      const total = Array.isArray(entries) ? entries.length : 0;

      if (!Array.isArray(entries) || entries.length === 0) {
        return { games: [], total: 0 };
      }

      entries.sort((a, b) => {
        const at = new Date(a.start_time ?? a.startTime ?? 0).getTime();
        const bt = new Date(b.start_time ?? b.startTime ?? 0).getTime();
        return bt - at;
      });

      const slice = entries.slice(0, safeLimit);

      const games: SnakeBenchGameSummary[] = slice.map((entry) => {
        const gameId = String(entry.game_id ?? entry.gameId ?? '');
        const filename = String(entry.filename ?? `snake_game_${gameId}.json`);
        const startedAt = String(entry.start_time ?? entry.startTime ?? '');
        const totalScore = Number(entry.total_score ?? entry.totalScore ?? 0);
        const roundsPlayed = Number(entry.actual_rounds ?? entry.actualRounds ?? 0);
        const filePath = path.join(completedDir, filename);

        return {
          gameId,
          filename,
          startedAt,
          totalScore,
          roundsPlayed,
          path: filePath,
        };
      });

      const replayable = filterReplayableGames(games);
      const available = await this.replayResolver.filterGamesWithAvailableReplays(replayable);
      // Return filesystem total (all indexed games), not just available ones
      return { games: available, total };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to list SnakeBench games: ${message}`, 'snakebench-service');
      throw new Error('Failed to list SnakeBench games');
    }
  }

  /**
   * Search matches with filters.
   */
  async searchMatches(
    query: SnakeBenchMatchSearchQuery
  ): Promise<{ rows: SnakeBenchMatchSearchRow[]; total: number }> {
    return repositoryService.snakeBench.searchMatches(query);
  }

  /**
   * Get greatest hits (playable games only).
   */
  async getWormArenaGreatestHits(limitPerDimension: number = 5): Promise<WormArenaGreatestHitGame[]> {
    return getWormArenaGreatestHitsFiltered(limitPerDimension, (gameId) =>
      this.replayResolver.replayExists(gameId)
    );
  }

  /**
   * Get TrueSkill leaderboard.
   */
  async getTrueSkillLeaderboard(
    limit: number = 150,
    minGames: number = 3
  ): Promise<SnakeBenchTrueSkillLeaderboardEntry[]> {
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 150)) : 150;
    const safeMinGames = Number.isFinite(minGames) ? Math.max(1, minGames) : 3;
    return repositoryService.snakeBench.getTrueSkillLeaderboard(safeLimit, safeMinGames);
  }

  /**
   * Get basic leaderboard.
   */
  async getBasicLeaderboard(
    limit: number = 10,
    sortBy: 'gamesPlayed' | 'winRate' = 'gamesPlayed'
  ): Promise<Array<{ modelSlug: string; gamesPlayed: number; wins: number; losses: number; ties: number; winRate?: number }>> {
    return repositoryService.snakeBench.getBasicLeaderboard(limit, sortBy);
  }

  /**
   * Get ARC explainer stats.
   */
  async getArcExplainerStats(): Promise<SnakeBenchArcExplainerStats> {
    return repositoryService.snakeBench.getArcExplainerStats();
  }

  /**
   * Get model rating.
   */
  async getModelRating(modelSlug: string): Promise<SnakeBenchModelRating | null> {
    return repositoryService.snakeBench.getModelRating(modelSlug);
  }

  /**
   * Get model match history (limited).
   */
  async getModelMatchHistory(
    modelSlug: string,
    limit?: number
  ): Promise<SnakeBenchModelMatchHistoryEntry[]> {
    const safeLimit = limit != null && Number.isFinite(limit) ? Number(limit) : 50;
    return repositoryService.snakeBench.getModelMatchHistory(modelSlug, safeLimit);
  }

  /**
   * Get ALL match history for a model (unbounded).
   * Used by the Model Match History page to show every game a model has ever played.
   */
  async getModelMatchHistoryUnbounded(modelSlug: string): Promise<SnakeBenchModelMatchHistoryEntry[]> {
    return repositoryService.snakeBench.getModelMatchHistoryUnbounded(modelSlug);
  }

  /**
   * Build the actionable insights report for a specific model.
   */
  async getModelInsightsReport(modelSlug: string): Promise<WormArenaModelInsightsReport | null> {
    // Normalize the slug before querying to keep report results consistent.
    const normalizedSlug = normalizeModelSlug(modelSlug);
    if (!normalizedSlug) {
      return null;
    }

    const data = await repositoryService.snakeBench.getModelInsightsData(normalizedSlug);
    if (!data) {
      return null;
    }

    const generatedAt = new Date().toISOString();
    // Request the LLM summary, but do not fail the report if it is unavailable.
    const llmSummary = await requestInsightsSummary(
      normalizedSlug,
      data.summary,
      data.failureModes,
      data.lossOpponents,
    );
    const markdownReport = buildInsightsMarkdown(
      normalizedSlug,
      generatedAt,
      data.summary,
      data.failureModes,
      data.lossOpponents,
      llmSummary,
    );
    const tweetText = buildInsightsTweet(normalizedSlug, data.summary, data.failureModes);

    return {
      modelSlug: normalizedSlug,
      generatedAt,
      summary: data.summary,
      failureModes: data.failureModes,
      lossOpponents: data.lossOpponents,
      // LLM summary paragraph when available.
      llmSummary,
      // Model used for the LLM summary when available.
      llmModel: llmSummary ? INSIGHTS_SUMMARY_MODEL : null,
      markdownReport,
      tweetText,
    };
  }

  /**
   * Get all models that have actually played games.
   * Used for the Model Match History page picker.
   */
  async getModelsWithGames(): Promise<
    Array<{
      modelSlug: string;
      gamesPlayed: number;
      wins: number;
      losses: number;
      ties: number;
      winRate?: number;
    }>
  > {
    return repositoryService.snakeBench.getModelsWithGames();
  }

  /**
   * Get recent activity.
   */
  async getRecentActivity(days: number = 7): Promise<{ days: number; gamesPlayed: number; uniqueModels: number }> {
    return repositoryService.snakeBench.getRecentActivity(days);
  }

  /**
   * Suggest matchups.
   */
  async suggestMatchups(
    mode: 'ladder' | 'entertainment' = 'ladder',
    limit: number = 20,
    minGames: number = 3
  ): Promise<{
    mode: 'ladder' | 'entertainment';
    matchups: Array<{
      modelA: { modelSlug: string; mu: number; sigma: number; exposed: number; gamesPlayed: number };
      modelB: { modelSlug: string; mu: number; sigma: number; exposed: number; gamesPlayed: number };
      history: { matchesPlayed: number; lastPlayedAt: string | null };
      score: number;
      reasons: string[];
    }>;
    totalCandidates: number;
  }> {
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 50)) : 20;
    const safeMinGames = Number.isFinite(minGames) ? Math.max(1, minGames) : 3;

    // Get the leaderboard and pairing history
    const leaderboard = await this.getTrueSkillLeaderboard(150, safeMinGames);
    const pairingHistory = await repositoryService.snakeBench.getPairingHistory();

    // Filter to only approved OpenRouter models
    const approvedModels = new Set(
      MODELS
        .filter((m: any) => m.provider === 'OpenRouter' && !m.premium)
        .map((m: any) => (m.apiModelName || m.key) as string)
    );

    return suggestMatchups(mode, safeLimit, safeMinGames, leaderboard, pairingHistory, approvedModels as Set<string>);
  }

  /**
   * Health check.
   */
  async healthCheck(): Promise<SnakeBenchHealthResponse> {
    const backendDir = snakeBenchPythonBridge.resolveBackendDir();
    const runnerPath = snakeBenchPythonBridge.resolveRunnerPath();

    const backendDirExists = fs.existsSync(backendDir);
    const runnerExists = fs.existsSync(runnerPath);

    const pythonBin = snakeBenchPythonBridge.resolvePythonBin();
    let pythonAvailable = false;
    try {
      const { spawnSync } = require('child_process');
      const result = spawnSync(pythonBin, ['--version'], { encoding: 'utf8' });
      pythonAvailable = result.status === 0;
    } catch {
      pythonAvailable = false;
    }

    let status: SnakeBenchHealthResponse['status'] = 'ok';
    let message: string | undefined;

    if (!backendDirExists || !runnerExists || !pythonAvailable) {
      if (!backendDirExists || !runnerExists) {
        status = 'error';
      } else {
        status = 'degraded';
      }

      const problems: string[] = [];
      if (!backendDirExists) problems.push('SnakeBench backend directory missing');
      if (!runnerExists) problems.push('snakebench_runner.py missing');
      if (!pythonAvailable) problems.push('Python binary not available');
      message = problems.join('; ');
    }

    return {
      success: status === 'ok',
      status,
      pythonAvailable,
      backendDirExists,
      runnerExists,
      message,
      timestamp: Date.now(),
    };
  }

  /**
   * Get run length distribution for models with minimum games threshold.
   * Delegates to repository method.
   */
  async getRunLengthDistribution(minGames: number = 5) {
    return repositoryService.snakeBench.getRunLengthDistribution(minGames);
  }
}

export const snakeBenchService = new SnakeBenchService();
export type { SnakeBenchRunMatchRequest, SnakeBenchRunMatchResult } from '../../shared/types.js';

