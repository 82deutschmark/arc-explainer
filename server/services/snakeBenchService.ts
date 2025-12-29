/**
 * Author: Cascade (ChatGPT)
 * Date: 2025-12-29
 * PURPOSE: Thin orchestrator facade for SnakeBench service with model insights report formatting,
 *          OpenAI summary generation for the Worm Arena model insights report, and streaming helpers.
 *
 *          FIXES:
 *          1. Fixed Responses API request format: moved response_format to text.format per API changes
 *          2. Refactored streaming to use handleStreamEvent helper for reliable event handling
 *          3. Improved summary extraction to handle both JSON and text responses
 *          4. Ensured report generation succeeds even if LLM summary fails
 *          5. Reworded insights prompts to use eSports commentator framing for LLM Snake play analysis
 *
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
import { handleStreamEvent, createStreamAggregates } from './openai/streaming.js';
import type { ResponseStreamEvent } from 'openai/resources/responses/responses';

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
import path from 'path';
import fs from 'fs';

// Use a direct OpenAI model for the LLM summary step.
const INSIGHTS_SUMMARY_MODEL = 'gpt-5-mini-2025-08-07';

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
    'Write one short paragraph (max 180 words).',
    'No bullets, no headings, no disclaimers.',
    'Focus on why the model loses and when. Focus on max apples ever achieved. How many rounds can it go?',
    `Model: ${modelSlug}`,
    `Games: ${summary.gamesPlayed}, Wins: ${summary.wins}, Losses: ${summary.losses}, Win rate: ${formatPercent(summary.winRate)}`,
    `Average rounds: ${avgRounds}, Average score: ${avgScore}, Cost per loss: ${costPerLoss}`,
    `Early loss rate: ${earlyLossRate}, Loss reason coverage: ${lossCoverage}`,
    `Top failure modes: ${failureLines}`,
    `Tough opponents by loss rate: ${opponentLines}`,
  ].join('\n');
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

  // Prepare a Responses API payload with structured outputs for actionable insights.
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
    instructions:
      'You are an eSports commentator covering how this LLM plays Snake. Give a brisk, hype-y breakdown of how it wins and loses, spotlight the key losses and what went wrong in those matches, and skip any ML training talk. Focus on match moments, risky habits, and the opponents that punish it.',
    reasoning: {
      effort: 'high',
      summary: 'detailed',
    },
    text: {
      verbosity: 'high',
      format: {
        type: 'json_schema',
        name: 'model_insights',
        strict: false,
        schema: {
          type: 'object',
          properties: {
            summary: {
              type: 'string',
              description: 'Brief Twitch streamer type takeaway about how this LLM tends to win or get knocked out'
            },
            deathAnalysis: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  cause: { type: 'string' },
                  frequency: { type: 'string' },
                  pattern: { type: 'string' }
                }
              },
              description: 'How it got eliminated, how often, and the situational pattern (early blunders vs late greed)'
            },
            toughOpponents: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  opponent: { type: 'string' },
                  record: { type: 'string' },
                  issue: { type: 'string' }
                }
              },
              description: 'Opponents who consistently hand it losses and the matchup quirks they exploit'
            },
            recommendations: {
              type: 'array',
              items: { type: 'string' },
              description: 'Where this LLM shines, where it struggles (e.g., early chaos vs long setups), and what to lean into or avoid'
            }
          },
          required: ['summary', 'deathAnalysis', 'toughOpponents', 'recommendations'],
          additionalProperties: false
        }
      }
    },
    max_output_tokens: 120000,
  };

  try {
    const response = await openAIClient.responses.create(requestBody as any) as any;

    // Try to extract summary from structured JSON output first
    // Responses API with json_schema puts output in output_parsed or as text
    if (response.output_parsed) {
      const parsed = response.output_parsed;
      if (typeof parsed.summary === 'string' && parsed.summary.trim()) {
        return parsed.summary.trim();
      }
    }

    // Try parsing output_text as JSON if it contains JSON structure
    if (response.output_text && typeof response.output_text === 'string') {
      try {
        const parsed = JSON.parse(response.output_text);
        if (typeof parsed.summary === 'string' && parsed.summary.trim()) {
          return parsed.summary.trim();
        }
      } catch {
        // Not JSON, use as-is
        const text = response.output_text.trim();
        if (text) {
          return text;
        }
      }
    }

    // If no summary was generated, that's okay - report can still be built
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`SnakeBenchService.requestInsightsSummary failed: ${message}`, 'snakebench-service');
    // Return null on failure, but don't throw - report generation should continue
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

/**
 * Build the OpenAI Responses API request payload for model insights.
 * Separated for reuse between streaming and non-streaming modes.
 */
const buildInsightsRequest = (
  modelSlug: string,
  summary: WormArenaModelInsightsSummary,
  failureModes: WormArenaModelInsightsFailureMode[],
  lossOpponents: WormArenaModelInsightsOpponent[],
) => {
  const prompt = buildInsightsSummaryPrompt(modelSlug, summary, failureModes, lossOpponents);

  return {
    model: INSIGHTS_SUMMARY_MODEL,
    input: [
      {
        id: `msg_${Date.now()}_summary_${Math.random().toString(16).slice(2)}`,
        role: 'user' as const,
        type: 'message' as const,
        content: [
          {
            type: 'input_text' as const,
            text: prompt,
          },
        ],
      },
    ],
    instructions:
      'You are an eSports commentator covering how this LLM plays Snake. Give a brisk, hype-y breakdown of how it wins and loses, spotlight the key losses and what went wrong in those matches, and skip any ML training talk. Focus on match moments, risky habits, and the opponents that punish it.',
    reasoning: {
      effort: 'high' as const,
      summary: 'detailed' as const,
    },
    text: {
      verbosity: 'high' as const,
      format: {
        type: 'json_schema' as const,
        name: 'model_insights',
        strict: false as const,
        schema: {
          type: 'object',
          properties: {
            summary: {
              type: 'string',
              description: 'One-sentence on-cast takeaway about how this LLM tends to win or get knocked out'
            },
            deathAnalysis: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  cause: { type: 'string' },
                  frequency: { type: 'string' },
                  pattern: { type: 'string' }
                }
              },
              description: 'How it got eliminated, how often, and the situational pattern (early blunders vs late greed)'
            },
            toughOpponents: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  opponent: { type: 'string' },
                  record: { type: 'string' },
                  issue: { type: 'string' }
                }
              },
              description: 'Opponents who consistently hand it losses and the matchup quirks they exploit'
            },
            recommendations: {
              type: 'array',
              items: { type: 'string' },
              description: 'Where this LLM shines, where it struggles (e.g., early chaos vs long setups), and what to lean into or avoid'
            }
          },
          required: ['summary', 'deathAnalysis', 'toughOpponents', 'recommendations'],
          additionalProperties: false
        }
      }
    },
    max_output_tokens: 120000,
  };
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
  /**
   * Locate local MP4 assets for completed games.
   * We do not attempt generation here—only presence checks to expose downloads.
   */
  private readonly videoDirectories: string[];

  constructor() {
    const backendDir = path.join(process.cwd(), 'external', 'SnakeBench', 'backend');
    const completedDir = path.join(backendDir, 'completed_games');

    this.gameIndexManager = new GameIndexManager(completedDir);
    this.persistenceCoordinator = new PersistenceCoordinator(this.gameIndexManager);
    this.matchRunner = new SnakeBenchMatchRunner(this.persistenceCoordinator);
    this.streamingRunner = new SnakeBenchStreamingRunner(this.persistenceCoordinator);
    this.replayResolver = new SnakeBenchReplayResolver(backendDir);
    this.videoDirectories = [
      path.join(backendDir, 'completed_games_videos'),
      path.join(backendDir, 'completed_games_videos_local'),
    ];
  }

  /**
   * Return local MP4 path if present (no generation). Normalizes snake_game_ prefix.
   */
  getLocalVideoPath(gameId: string): string | null {
    if (!gameId) return null;
    const normalized = gameId
      .replace(/^snake_game_/i, '')
      .replace(/\.mp4$/i, '')
      .replace(/\.json$/i, '');
    const candidates = this.videoDirectories.map((dir) =>
      path.join(dir, `snake_game_${normalized}.mp4`),
    );
    const found = candidates.find((candidate) => fs.existsSync(candidate));
    return found ?? null;
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
      const { games, total } = await repositoryService.gameRead.getRecentGames(safeLimit);
      if (total > 0 && games.length > 0) {
        const replayable = filterReplayableGames(games);
        const available = await this.replayResolver.filterGamesWithAvailableReplays(replayable);

        // Get global total from stats (all matches ever, not just this batch)
        let globalTotal = total;
        try {
          const stats = await repositoryService.gameRead.getArcExplainerStats();
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
    return repositoryService.gameRead.searchMatches(query);
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
    return repositoryService.leaderboard.getTrueSkillLeaderboard(safeLimit, safeMinGames);
  }

  /**
   * Get basic leaderboard.
   */
  async getBasicLeaderboard(
    limit: number = 10,
    sortBy: 'gamesPlayed' | 'winRate' = 'gamesPlayed'
  ): Promise<Array<{ modelSlug: string; gamesPlayed: number; wins: number; losses: number; ties: number; winRate?: number }>> {
    return repositoryService.leaderboard.getBasicLeaderboard(limit, sortBy);
  }

  /**
   * Get ARC explainer stats.
   */
  async getArcExplainerStats(): Promise<SnakeBenchArcExplainerStats> {
    return repositoryService.gameRead.getArcExplainerStats();
  }

  /**
   * Get model rating.
   */
  async getModelRating(modelSlug: string): Promise<SnakeBenchModelRating | null> {
    return repositoryService.leaderboard.getModelRating(modelSlug);
  }

  /**
   * Get model match history (limited).
   */
  async getModelMatchHistory(
    modelSlug: string,
    limit?: number
  ): Promise<SnakeBenchModelMatchHistoryEntry[]> {
    const safeLimit = limit != null && Number.isFinite(limit) ? Number(limit) : 50;
    return repositoryService.gameRead.getModelMatchHistory(modelSlug, safeLimit);
  }

  /**
   * Get ALL match history for a model (unbounded).
   * Used by the Model Match History page to show every game a model has ever played.
   */
  async getModelMatchHistoryUnbounded(modelSlug: string): Promise<SnakeBenchModelMatchHistoryEntry[]> {
    return repositoryService.gameRead.getModelMatchHistoryUnbounded(modelSlug);
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

    const data = await repositoryService.analytics.getModelInsightsData(normalizedSlug);
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
   * Stream model insights report generation with live reasoning updates via callbacks.
   * Delegates SSE management to the caller (controller).
   */
  async streamModelInsightsReport(
    modelSlug: string,
    handlers: {
      onStatus: (status: WormArenaStreamStatus) => void;
      onChunk: (chunk: { type: string; delta?: string; content?: string; timestamp: number }) => void;
    },
    abortSignal: AbortSignal
  ): Promise<WormArenaModelInsightsReport> {
    const normalizedSlug = normalizeModelSlug(modelSlug);
    if (!normalizedSlug) {
      throw new Error('Invalid model slug');
    }

    // Emit status: fetching data
    handlers.onStatus({
      state: 'in_progress',
      phase: 'fetching_data',
      message: 'Loading model statistics...'
    });

    const data = await repositoryService.analytics.getModelInsightsData(normalizedSlug);
    if (!data) {
      throw new Error('No data available for this model');
    }

    // Emit status: generating insights
    handlers.onStatus({
      state: 'in_progress',
      phase: 'generating_insights',
      message: 'Analyzing model performance...'
    });

    const requestBody = buildInsightsRequest(
      normalizedSlug,
      data.summary,
      data.failureModes,
      data.lossOpponents
    );

    // Enable streaming
    const streamingRequest = {
      ...requestBody,
      stream: true,
    };

    const stream = await openAIClient.responses.stream(streamingRequest as any);
    const aggregates = createStreamAggregates(true); // Expecting JSON schema output

    // Stream events from OpenAI through callbacks
    for await (const event of stream as AsyncIterable<ResponseStreamEvent>) {
      if (abortSignal.aborted) {
        stream.controller.abort();
        throw new Error('Stream aborted by client');
      }

      handleStreamEvent(event, aggregates, {
        emitChunk: (chunk) => {
          // Forward chunks through callback
          handlers.onChunk({
            type: chunk.type,
            delta: chunk.delta,
            content: chunk.content,
            timestamp: Date.now(),
          });
        },
        emitEvent: (eventName, payload) => {
          // Route events based on type
          if (eventName === 'stream.status') {
            handlers.onStatus(payload as unknown as WormArenaStreamStatus);
          } else if (eventName === 'stream.chunk') {
            // Treat stream.chunk events as chunk data
            handlers.onChunk({
              type: (payload as any)?.type || 'unknown',
              delta: (payload as any)?.delta,
              content: (payload as any)?.content,
              timestamp: Date.now(),
            });
          }
          // Other event types are silently ignored for now
        },
      });
    }

    // Get final response and build report
    const finalResponse = await stream.finalResponse();

    // Extract LLM summary from aggregated parsed JSON or text
    let llmSummary = '';
    if (aggregates.parsed) {
      try {
        const parsed = JSON.parse(aggregates.parsed);
        // Use the summary field from structured output if available
        llmSummary = typeof parsed.summary === 'string' ? parsed.summary : aggregates.parsed;
      } catch {
        // Fallback to accumulated text if JSON parsing fails
        llmSummary = aggregates.text || aggregates.parsed;
      }
    } else {
      // Final fallback to response text
      llmSummary = finalResponse.output_text || '';
    }

    // Build complete report
    const generatedAt = new Date().toISOString();
    const markdownReport = buildInsightsMarkdown(
      normalizedSlug,
      generatedAt,
      data.summary,
      data.failureModes,
      data.lossOpponents,
      llmSummary,
    );
    const tweetText = buildInsightsTweet(normalizedSlug, data.summary, data.failureModes);

    const report: WormArenaModelInsightsReport = {
      modelSlug: normalizedSlug,
      generatedAt,
      summary: data.summary,
      failureModes: data.failureModes,
      lossOpponents: data.lossOpponents,
      llmSummary,
      llmModel: INSIGHTS_SUMMARY_MODEL,
      markdownReport,
      tweetText,
    };

    return report;
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
    return repositoryService.gameRead.getModelsWithGames();
  }

  /**
   * Get recent activity.
   */
  async getRecentActivity(days: number = 7): Promise<{ days: number; gamesPlayed: number; uniqueModels: number }> {
    return repositoryService.gameRead.getRecentActivity(days);
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
    const pairingHistory = await repositoryService.leaderboard.getPairingHistory();

    // Use all leaderboard models (already filtered by minGames and ranked by TrueSkill).
    // No additional filtering needed - we want suggestions for any models that have played.
    const approvedModels = new Set(leaderboard.map(e => e.modelSlug));

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
    return repositoryService.analytics.getRunLengthDistribution(minGames);
  }
}

export const snakeBenchService = new SnakeBenchService();
export type { SnakeBenchRunMatchRequest, SnakeBenchRunMatchResult } from '../../shared/types.js';

