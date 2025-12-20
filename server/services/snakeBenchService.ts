/**
 * Author: Claude Code using Haiku 4.5
 * Date: 2025-12-19
 * PURPOSE: Thin orchestrator facade for SnakeBench service.
 *          Delegates to specialized modules: MatchRunner, StreamingRunner, ReplayResolver, etc.
 *          Maintains backward compatibility (all 19 public methods with original signatures).
 * SRP/DRY check: Pass — pure delegation, orchestration only. All implementation in focused modules.
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
} from '../../shared/types.js';
import { repositoryService } from '../repositories/RepositoryService.ts';
import { logger } from '../utils/logger.ts';

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
        return { games: available, total: available.length };
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
      return { games: available, total: available.length };
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
}

export const snakeBenchService = new SnakeBenchService();
export type { SnakeBenchRunMatchRequest, SnakeBenchRunMatchResult } from '../../shared/types.js';
