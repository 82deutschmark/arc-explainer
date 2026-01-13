/**
 * Author: Cascade
 * Date: 2025-12-29
 * PURPOSE: Thin orchestrator facade for SnakeBench/Worm Arena.
 *          Delegates match execution to specialized runners and report generation
 *          to WormArenaReportService.
 * 
 * SRP/DRY check: Pass - facade only, no business logic or formatting.
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

// Import from new modules
import { SnakeBenchMatchRunner } from './snakeBench/SnakeBenchMatchRunner.ts';
import {
  SnakeBenchStreamingRunner,
  type StreamingHandlers,
} from './snakeBench/SnakeBenchStreamingRunner.ts';
import { SnakeBenchReplayResolver } from './snakeBench/SnakeBenchReplayResolver.ts';
import { snakeBenchPythonBridge } from './snakeBench/SnakeBenchPythonBridge.ts';
import { PersistenceCoordinator } from './snakeBench/persistence/persistenceCoordinator.ts';
import { GameIndexManager } from './snakeBench/persistence/gameIndexManager.ts';
import { getSnakeBenchAllowedModels } from './snakeBench/helpers/modelAllowlist.ts';
import { filterReplayableGames, getWormArenaGreatestHitsFiltered } from './snakeBench/helpers/replayFilters.ts';
import { suggestMatchups } from './snakeBench/helpers/matchupSuggestions.ts';
import {
  wormArenaReportService,
  INSIGHTS_SUMMARY_MODEL,
} from './wormArena/WormArenaReportService.ts';
import path from 'path';
import fs from 'fs';
import { getCompletedGamesAbsolutePath } from './snakeBench/utils/constants.ts';

// Normalize model slugs so ":free" suffixes do not split report data.
const normalizeModelSlug = (modelSlug: string): string => modelSlug.trim().replace(/:free$/i, '');

/**
 * SnakeBenchService - Orchestrator for SnakeBench/Worm Arena operations.
 * Delegates specialized tasks to runners and report services.
 */
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
    const completedDir = getCompletedGamesAbsolutePath(process.cwd());

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
   * Delegates LLM summary generation and formatting to WormArenaReportService.
   */
  async getModelInsightsReport(modelSlug: string): Promise<WormArenaModelInsightsReport | null> {
    const normalizedSlug = normalizeModelSlug(modelSlug);
    if (!normalizedSlug) return null;

    const data = await repositoryService.analytics.getModelInsightsData(normalizedSlug);
    if (!data) return null;

    // Request the LLM summary paragraph
    const llmSummary = await wormArenaReportService.requestInsightsSummary(
      normalizedSlug,
      data.summary,
      data.failureModes,
      data.lossOpponents,
    );

    return wormArenaReportService.buildReportObject(normalizedSlug, data, llmSummary);
  }

  /**
   * Stream model insights report generation with live reasoning updates.
   * Delegates to WormArenaReportService.
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

    handlers.onStatus({
      state: 'in_progress',
      phase: 'fetching_data',
      message: 'Loading model statistics...'
    });

    const data = await repositoryService.analytics.getModelInsightsData(normalizedSlug);
    if (!data) {
      throw new Error('No data available for this model');
    }

    handlers.onStatus({
      state: 'in_progress',
      phase: 'generating_insights',
      message: 'Analyzing model performance...'
    });

    return wormArenaReportService.streamModelInsightsReport(
      normalizedSlug,
      data,
      handlers,
      abortSignal
    );
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

