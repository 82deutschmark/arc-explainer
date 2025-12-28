/**
 * Author: Claude Code using Haiku 4.5
 * Date: 2025-12-19
 * PURPOSE: Resolve replay assets for games using smart fallback strategy.
 *          Local files → DB replay_path → remote URLs (Railway backend, GitHub raw).
 * SRP/DRY check: Pass — isolated replay resolution, single source of truth for loading.
 */

import fs from 'fs';
import path from 'path';
import type { SnakeBenchGameSummary } from '../../shared/types.js';
import { repositoryService } from '../../repositories/RepositoryService.ts';
import { logger } from '../../utils/logger.ts';
import { fetchJsonFromUrl } from './utils/httpClient.ts';
import { GameIndexManager } from './persistence/gameIndexManager.ts';

export class SnakeBenchReplayResolver {
  private readonly gameIndexManager: GameIndexManager;

  constructor(private readonly backendDir: string) {
    const completedDir = path.join(backendDir, 'completed_games');
    this.gameIndexManager = new GameIndexManager(completedDir);
  }

  /**
   * Resolve replay for a given gameId with smart fallbacks.
   * Resolution order:
   * 1. Local file from database replay_path
   * 2. Local file at standard path (completed_games/snake_game_<id>.json)
   * 3. Remote URL from database replay_path (fetched server-side)
   * 4. Railway backend fallback (fetched server-side)
   * 5. GitHub raw fallback (fetched server-side)
   *
   * Always returns {data} directly (server-side fetch, no CORS issues).
   */
  async getReplay(gameId: string): Promise<{ data: any }> {
    if (!gameId) {
      throw new Error('gameId is required');
    }

    const completedDir = path.join(this.backendDir, 'completed_games');

    // Build list of candidate paths and URLs
    const candidatePaths: string[] = [];
    const remoteUrls: string[] = [];

    // 1. Check database for replay_path (could be local path or remote URL)
    try {
      const dbReplay = await repositoryService.gameRead.getReplayPath(gameId);
      const replayPath = dbReplay?.replayPath;
      if (replayPath) {
        if (/^https?:\/\//i.test(replayPath)) {
          remoteUrls.push(replayPath);
        } else {
          const resolved = path.isAbsolute(replayPath)
            ? replayPath
            : path.join(this.backendDir, replayPath);
          candidatePaths.push(resolved);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(
        `SnakeBenchReplayResolver.getReplay: failed to fetch replay_path from DB for ${gameId}: ${msg}`,
        'snakebench-service'
      );
    }

    // 2. Standard filename in completed_games
    let filename = `snake_game_${gameId}.json`;
    let candidate = path.join(completedDir, filename);

    // 3. Check game_index.json for alternate filename
    if (!fs.existsSync(candidate)) {
      const indexFilename = await this.gameIndexManager.findGameFilename(gameId);
      if (indexFilename) {
        filename = indexFilename;
        candidate = path.join(completedDir, filename);
      }
    }
    candidatePaths.push(candidate);

    // Try local files first
    const uniquePaths = Array.from(new Set(candidatePaths));
    for (const localPath of uniquePaths) {
      if (fs.existsSync(localPath)) {
        try {
          const raw = await fs.promises.readFile(localPath, 'utf8');
          const parsed = JSON.parse(raw);
          logger.info(
            `SnakeBenchReplayResolver.getReplay: loaded replay for ${gameId} from local file ${localPath}`,
            'snakebench-service'
          );
          return { data: parsed };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          logger.warn(
            `SnakeBenchReplayResolver.getReplay: failed to read/parse replay for ${gameId} from ${localPath}: ${message}`,
            'snakebench-service'
          );
        }
      }
    }

    // No local file found - fetch from remote URLs server-side (no CORS issues)
    // Add fallback URLs
    const upstreamBackend =
      process.env.SNAKEBENCH_UPSTREAM_BACKEND_URL ||
      'https://backend-production-fc22.up.railway.app';
    remoteUrls.push(`${upstreamBackend}/api/matches/${gameId}`);

    const rawBase =
      process.env.SNAKEBENCH_REPLAY_RAW_BASE ||
      'https://raw.githubusercontent.com/VoynichLabs/SnakeBench/main/backend/completed_games';
    remoteUrls.push(`${rawBase}/snake_game_${gameId}.json`);

    // Try each remote URL server-side
    const uniqueUrls = Array.from(new Set(remoteUrls));
    let lastError = '';
    for (const url of uniqueUrls) {
      try {
        const parsed = await fetchJsonFromUrl(url);
        logger.info(
          `SnakeBenchReplayResolver.getReplay: fetched replay for ${gameId} from remote URL ${url}`,
          'snakebench-service'
        );
        return { data: parsed };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        lastError = msg;
        logger.warn(
          `SnakeBenchReplayResolver.getReplay: failed to fetch replay for ${gameId} from ${url}: ${msg}`,
          'snakebench-service'
        );
      }
    }

    throw new Error(
      `Replay not found for ${gameId}. Tried ${uniquePaths.length} local paths and ${uniqueUrls.length} remote URLs. Last error: ${lastError || 'unknown'}`
    );
  }

  /**
   * Check whether a replay asset exists locally or remotely for a given game.
   * Used to keep greatest-hits entries playable and to filter game listings.
   *
   * Returns true if:
   * 1. There's an HTTP URL in the DB (getReplay() can fetch it)
   * 2. There's a local file path that exists
   */
  async replayExists(gameId: string): Promise<boolean> {
    const candidatePaths: string[] = [];

    // Check database for alternate replay_path (e.g., from ingestion or remote URL)
    try {
      const dbReplay = await repositoryService.gameRead.getReplayPath(gameId);
      if (dbReplay?.replayPath) {
        // If it's an HTTP URL, consider it as existing (getReplay() can fetch it)
        if (/^https?:\/\//i.test(dbReplay.replayPath)) {
          return true;
        }
        // Otherwise it's a local path - add to candidates
        const resolved = path.isAbsolute(dbReplay.replayPath)
          ? dbReplay.replayPath
          : path.join(this.backendDir, dbReplay.replayPath);
        candidatePaths.push(resolved);
      }
    } catch {
      // DB lookup failed, continue to default path
    }

    // Check bundled replay location (primary source)
    candidatePaths.push(
      path.join(this.backendDir, 'completed_games', `snake_game_${gameId}.json`)
    );

    // Return true if any candidate path exists locally
    return candidatePaths.some((p) => fs.existsSync(p));
  }

  /**
   * Filter a list of games down to only those with available replays.
   * Concurrency is intentionally small to avoid spamming remote replay endpoints.
   * Returns original order preserved.
   */
  async filterGamesWithAvailableReplays(
    games: SnakeBenchGameSummary[]
  ): Promise<SnakeBenchGameSummary[]> {
    if (!Array.isArray(games) || games.length === 0) return [];

    const MAX_CONCURRENCY = 5;
    const results: SnakeBenchGameSummary[] = [];

    // Simple in-process concurrency limiter
    let index = 0;
    const worker = async () => {
      while (index < games.length) {
        const current = index;
        index += 1;

        const game = games[current];
        const gameId = String(game?.gameId ?? '').trim();
        if (!gameId) {
          continue;
        }

        try {
          const available = await this.replayExists(gameId);
          if (available) {
            results.push(game);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.warn(
            `SnakeBenchReplayResolver.filterGamesWithAvailableReplays: replayExists check failed for ${gameId}: ${msg}`,
            'snakebench-service'
          );
        }
      }
    };

    const workers = Array.from({ length: Math.min(MAX_CONCURRENCY, games.length) }, () =>
      worker()
    );
    await Promise.all(workers);

    // Preserve the original ordering from the input list
    const allowed = new Set(results.map((g) => g.gameId));
    return games.filter((g) => allowed.has(g.gameId));
  }
}
