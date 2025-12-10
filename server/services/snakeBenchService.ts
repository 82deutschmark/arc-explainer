/**
 * server/services/snakeBenchService.ts
 *
 * Author: Cascade
 * Date: 2025-12-02
 * PURPOSE: Orchestrate single SnakeBench matches via a Python runner
 *          (server/python/snakebench_runner.py) and return a compact
 *          summary suitable for HTTP APIs and frontend usage.
 * SRP/DRY check: Pass — dedicated to SnakeBench subprocess handling and
 *                result shaping; reuses existing logging patterns.
 */

import { spawn, spawnSync, type SpawnOptions } from 'child_process';
import fs from 'fs';
import path from 'path';
import https from 'https';

import type {
  SnakeBenchRunMatchRequest,
  SnakeBenchRunMatchResult,
  SnakeBenchRunBatchRequest,
  SnakeBenchRunBatchResult,
  SnakeBenchGameSummary,
  SnakeBenchHealthResponse,
} from '../../shared/types.js';
import { logger } from '../utils/logger.ts';
import { repositoryService } from '../repositories/RepositoryService.ts';
import { snakeBenchIngestQueue } from './snakeBenchIngestQueue.ts';
import { MODELS } from '../config/models.ts';

const MIN_BOARD_SIZE = 4;
const MAX_BOARD_SIZE = 50;
const MIN_MAX_ROUNDS = 10;
const MAX_MAX_ROUNDS = 500;
const MIN_NUM_APPLES = 1;
const MAX_NUM_APPLES = 20;
const MAX_BATCH_COUNT = 10;
const DEFAULT_SNAKEBENCH_TIMEOUT_MS = 4 * 60 * 60 * 1000; // 4 hours (safe for 2+ hour matches)

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function parseCostStringToNumber(cost: string | undefined | null): number {
  if (!cost) return 0;
  const cleaned = cost.replace(/\$/g, "").trim();
  const firstPart = cleaned.split(/-|–|—/)[0]?.trim() ?? "";
  const match = firstPart.match(/[0-9]*\.?[0-9]+/);
  if (!match) return 0;
  const value = parseFloat(match[0]);
  return Number.isFinite(value) ? value : 0;
}

export class SnakeBenchService {
  private resolvePythonBin(): string {
    if (process.env.PYTHON_BIN) {
      return process.env.PYTHON_BIN;
    }
    return process.platform === 'win32' ? 'python' : 'python3';
  }

  private resolveRunnerPath(): string {
    return path.join(process.cwd(), 'server', 'python', 'snakebench_runner.py');
  }

  private resolveBackendDir(): string {
    return path.join(process.cwd(), 'external', 'SnakeBench', 'backend');
  }

  private resolveCompletedDir(): string {
    return path.join(this.resolveBackendDir(), 'completed_games');
  }

  private async upsertGameIndex(completedGamePath: string | undefined, fallbackGameId: string, models: { modelA: string; modelB: string }): Promise<void> {
    if (!completedGamePath) return;

    const completedDir = this.resolveCompletedDir();
    const indexPath = path.join(completedDir, 'game_index.json');

    try {
      await fs.promises.mkdir(completedDir, { recursive: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`SnakeBenchService.upsertGameIndex: failed to ensure completed_games directory: ${msg}`, 'snakebench-service');
      return;
    }

    let payload: any = null;
    try {
      const raw = await fs.promises.readFile(completedGamePath, 'utf8');
      payload = JSON.parse(raw);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`SnakeBenchService.upsertGameIndex: failed to read ${completedGamePath}: ${msg}`, 'snakebench-service');
      return;
    }

    const gameBlock = payload?.game ?? payload?.metadata ?? {};
    const metadata = payload?.metadata ?? {};
    const totals = payload?.totals ?? {};

    const gameId: string = gameBlock.id ?? metadata.game_id ?? fallbackGameId ?? '';
    if (!gameId) return;

    const filename = path.basename(completedGamePath);
    const startedAt = metadata.start_time ?? gameBlock.started_at ?? '';
    const endTime = metadata.end_time ?? gameBlock.ended_at ?? '';
    const actualRounds = Number(metadata.actual_rounds ?? gameBlock.rounds_played ?? 0) || 0;

    const scoreSource = metadata.final_scores ?? totals.scores ?? {};
    const totalScore = Object.values(scoreSource).reduce<number>((acc, val) => {
      const num = typeof val === 'number' ? val : Number(val);
      return acc + (Number.isFinite(num) ? num : 0);
    }, 0);

    const entry = {
      game_id: gameId,
      filename,
      start_time: startedAt,
      end_time: endTime,
      total_score: totalScore,
      actual_rounds: actualRounds,
      model_a: models.modelA,
      model_b: models.modelB,
    };

    let existing: any[] = [];
    try {
      if (fs.existsSync(indexPath)) {
        const rawIndex = await fs.promises.readFile(indexPath, 'utf8');
        const parsed = JSON.parse(rawIndex);
        if (Array.isArray(parsed)) existing = parsed;
      }
    } catch {
      existing = [];
    }

    const filtered = existing.filter((e) => (e.game_id ?? e.gameId) !== gameId);
    filtered.push(entry);

    filtered.sort((a, b) => {
      const at = new Date(a.start_time ?? a.startTime ?? 0).getTime();
      const bt = new Date(b.start_time ?? b.startTime ?? 0).getTime();
      return bt - at;
    });

    try {
      await fs.promises.writeFile(indexPath, JSON.stringify(filtered, null, 2), 'utf8');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`SnakeBenchService.upsertGameIndex: failed to write index: ${msg}`, 'snakebench-service');
    }
  }

  async runMatch(request: SnakeBenchRunMatchRequest): Promise<SnakeBenchRunMatchResult> {
    const { modelA, modelB } = request;

    if (!modelA || !modelB) {
      throw new Error('modelA and modelB are required');
    }

    // NEW: Validate models against project's canonical MODELS list (source of truth)
    const snakeBenchModels = MODELS
      .filter((m) => m.provider === 'OpenRouter')
      .map((m) => m.apiModelName || m.key);

    if (!snakeBenchModels.includes(modelA)) {
      throw new Error(
        `Model '${modelA}' not available for SnakeBench. ` +
        `Available models: ${snakeBenchModels.join(', ')}`
      );
    }
    if (!snakeBenchModels.includes(modelB)) {
      throw new Error(
        `Model '${modelB}' not available for SnakeBench. ` +
        `Available models: ${snakeBenchModels.join(', ')}`
      );
    }

    const widthRaw = request.width ?? 10;
    const heightRaw = request.height ?? 10;
    const maxRoundsRaw = request.maxRounds ?? 150;
    const numApplesRaw = request.numApples ?? 5;

    const width = clamp(widthRaw, MIN_BOARD_SIZE, MAX_BOARD_SIZE);
    const height = clamp(heightRaw, MIN_BOARD_SIZE, MAX_BOARD_SIZE);
    const maxRounds = clamp(maxRoundsRaw, MIN_MAX_ROUNDS, MAX_MAX_ROUNDS);
    const numApples = clamp(numApplesRaw, MIN_NUM_APPLES, MAX_NUM_APPLES);

    const findModelConfig = (slug: string) =>
      MODELS.find(
        (m) =>
          m.provider === 'OpenRouter' &&
          ((m.apiModelName && m.apiModelName === slug) || m.key === slug),
      );

    const configA = findModelConfig(modelA);
    const configB = findModelConfig(modelB);

    const pricingInputA = configA ? parseCostStringToNumber(configA.cost.input) : 0;
    const pricingOutputA = configA ? parseCostStringToNumber(configA.cost.output) : 0;
    const pricingInputB = configB ? parseCostStringToNumber(configB.cost.input) : 0;
    const pricingOutputB = configB ? parseCostStringToNumber(configB.cost.output) : 0;

    const payload = {
      modelA: String(modelA),
      modelB: String(modelB),
      width,
      height,
      maxRounds,
      numApples,
      pricingInputA,
      pricingOutputA,
      pricingInputB,
      pricingOutputB,
    };

    const pythonBin = this.resolvePythonBin();
    const runnerPath = this.resolveRunnerPath();
    const backendDir = this.resolveBackendDir();

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PYTHONIOENCODING: 'utf-8',
      PYTHONUTF8: '1',
    };

    // BYO API key handling (Poetiq-style)
    if (request.apiKey && request.provider) {
      switch (request.provider) {
        case 'openrouter':
          env.OPENROUTER_API_KEY = request.apiKey;
          break;
        case 'openai':
          env.OPENAI_API_KEY = request.apiKey;
          break;
        case 'anthropic':
          env.ANTHROPIC_API_KEY = request.apiKey;
          break;
        case 'xai':
          env.XAI_API_KEY = request.apiKey;
          break;
        case 'gemini':
          env.GEMINI_API_KEY = request.apiKey;
          break;
        default:
          logger.warn(
            `SnakeBench runMatch: unsupported provider "${request.provider}" for BYO key; falling back to server keys`,
            'snakebench-service',
          );
      }
    } else if (request.apiKey || request.provider) {
      logger.warn(
        `SnakeBench runMatch: both apiKey and provider must be provided together; using server keys`,
        'snakebench-service',
      );
    }

    const spawnOpts: SpawnOptions = {
      cwd: backendDir,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    };

    return new Promise<SnakeBenchRunMatchResult>((resolve, reject) => {
      const child = spawn(pythonBin, [runnerPath], spawnOpts);

      if (!child.stdout || !child.stderr || !child.stdin) {
        return reject(new Error('Python process streams not available for SnakeBench runner'));
      }

      // NEW: Add configurable timeout to prevent hung processes (default 4 hours, safe for 2+ hour matches)
      const timeoutMs = process.env.SNAKEBENCH_TIMEOUT_MS
        ? parseInt(process.env.SNAKEBENCH_TIMEOUT_MS, 10)
        : DEFAULT_SNAKEBENCH_TIMEOUT_MS;

      const timeoutHandle = setTimeout(() => {
        child.kill('SIGTERM');
        const mins = Math.round(timeoutMs / (60 * 1000));
        logger.error(
          `SnakeBench runner timeout (${mins} minutes exceeded). Process killed. ` +
          `Configure via SNAKEBENCH_TIMEOUT_MS env var if longer matches are needed.`,
          'snakebench-service',
        );
        reject(new Error(
          `SnakeBench runner timeout (${mins} minutes exceeded). ` +
          `For longer matches, set SNAKEBENCH_TIMEOUT_MS environment variable.`
        ));
      }, timeoutMs);

      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');

      let stdoutBuf = '';
      let stderrBuf = '';

      child.stdout.on('data', (chunk: Buffer | string) => {
        stdoutBuf += chunk.toString();
      });

      child.stderr.on('data', (chunk: Buffer | string) => {
        stderrBuf += chunk.toString();
      });

      child.on('close', (code: number | null) => {
        clearTimeout(timeoutHandle);
        if (code !== 0) {
          const errSnippet = (stderrBuf || stdoutBuf).trim().slice(0, 500);
          logger.error(
            `SnakeBench runner failed (exit code ${code ?? 'null'}): ${errSnippet}`,
            'snakebench-service',
          );
          return reject(new Error(`SnakeBench runner failed (exit code ${code ?? 'null'})`));
        }

        const lines = stdoutBuf
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter((l) => l.length > 0);

        if (lines.length === 0) {
          return reject(new Error('SnakeBench runner produced no output'));
        }

        const lastLine = lines[lines.length - 1];
        let parsed: any;
        try {
          parsed = JSON.parse(lastLine);
        } catch (err) {
          logger.error(
            `SnakeBench runner output was not valid JSON: ${lastLine.slice(0, 200)}`,
            'snakebench-service',
          );
          return reject(new Error('Failed to parse SnakeBench runner output'));
        }

        if (parsed && typeof parsed === 'object' && parsed.error) {
          return reject(new Error(String(parsed.error)));
        }

        const result: SnakeBenchRunMatchResult = {
          gameId: parsed.game_id ?? parsed.gameId ?? '',
          modelA: parsed.modelA,
          modelB: parsed.modelB,
          scores: parsed.scores ?? {},
          results: parsed.results ?? {},
          completedGamePath: parsed.completed_game_path ?? parsed.completedGamePath,
        };

        // Fire-and-forget persistence via the ingest queue (no lossy fallbacks).
        try {
          snakeBenchIngestQueue.enqueue({
            result,
            width,
            height,
            numApples,
            gameType: 'arc-explainer',
          });
        } catch (persistErr) {
          const msg = persistErr instanceof Error ? persistErr.message : String(persistErr);
          logger.warn(`SnakeBenchService.runMatch: failed to enqueue DB persistence: ${msg}`, 'snakebench-service');
        }

        // Fire-and-forget filesystem index update to mirror upstream game_index.json expectations.
        void this.upsertGameIndex(result.completedGamePath, result.gameId, { modelA, modelB });

        resolve(result);
      });

      child.on('error', (err) => {
        clearTimeout(timeoutHandle);
        logger.error(
          `Failed to spawn SnakeBench runner: ${err instanceof Error ? err.message : String(err)}`,
          'snakebench-service',
        );
        reject(err);
      });

      try {
        child.stdin.setDefaultEncoding('utf8');
        child.stdin.write(JSON.stringify(payload));
        child.stdin.end();
      } catch (err) {
        clearTimeout(timeoutHandle);
        logger.error(
          `Failed to send payload to SnakeBench runner: ${err instanceof Error ? err.message : String(err)}`,
          'snakebench-service',
        );
        child.kill();
        reject(err);
      }
    });
  }

  async runBatch(request: SnakeBenchRunBatchRequest): Promise<SnakeBenchRunBatchResult> {
    const countRaw = request.count;
    const count = Number.isFinite(countRaw) ? Math.floor(countRaw) : 0;

    if (count <= 0) {
      throw new Error('count must be a positive integer');
    }
    if (count > MAX_BATCH_COUNT) {
      throw new Error(`count must be <= ${MAX_BATCH_COUNT} for safety`);
    }

    const results: SnakeBenchRunMatchResult[] = [];
    const errors: { index: number; error: string }[] = [];

    for (let i = 0; i < count; i += 1) {
      try {
        const result = await this.runMatch(request);
        results.push(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push({ index: i, error: message });
      }
    }

    return {
      results,
      errors: errors.length ? errors : undefined,
    };
  }

  async listGames(limit: number = 20): Promise<{ games: SnakeBenchGameSummary[]; total: number }> {
    const safeLimit = Math.max(1, Math.min(limit ?? 20, 100));

    // Prefer database-backed summaries when available (Phase II/III),
    // but gracefully fall back to filesystem index if DB is unavailable
    // or has no SnakeBench rows yet.
    try {
      const { games, total } = await repositoryService.snakeBench.getRecentGames(safeLimit);
      if (total > 0 && games.length > 0) {
        return { games, total };
      }
    } catch (dbErr) {
      const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
      logger.warn(
        `SnakeBenchService.listGames: DB-backed recent games failed, falling back to filesystem: ${msg}`,
        'snakebench-service',
      );
    }

    const backendDir = this.resolveBackendDir();
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

      return { games, total };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to list SnakeBench games: ${message}`, 'snakebench-service');
      throw new Error('Failed to list SnakeBench games');
    }
  }

  async getGame(gameId: string): Promise<any> {
    if (!gameId) {
      throw new Error('gameId is required');
    }

    const backendDir = this.resolveBackendDir();
    const completedDir = path.join(backendDir, 'completed_games');

    let filename = `snake_game_${gameId}.json`;
    let candidate = path.join(completedDir, filename);

    // Prefer a replay_path from the database (covers freshly completed games
    // after a restart where the index/filename lookup may not be populated).
    const candidatePaths: string[] = [];
    let remoteReplayUrl: string | null = null;
    try {
      const dbReplay = await repositoryService.snakeBench.getReplayPath(gameId);
      const replayPath = dbReplay?.replayPath;
      if (replayPath) {
        if (/^https?:\/\//i.test(replayPath)) {
          remoteReplayUrl = replayPath;
        } else {
          const resolved = path.isAbsolute(replayPath) ? replayPath : path.join(backendDir, replayPath);
          candidatePaths.push(resolved);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(
        `SnakeBenchService.getGame: failed to fetch replay_path from DB for ${gameId}: ${message}`,
        'snakebench-service',
      );
    }

    if (!fs.existsSync(candidate)) {
      const indexPath = path.join(completedDir, 'game_index.json');
      if (fs.existsSync(indexPath)) {
        try {
          const raw = await fs.promises.readFile(indexPath, 'utf8');
          const entries: any[] = JSON.parse(raw);
          const entry = entries.find((e) => (e.game_id ?? e.gameId) === gameId);
          if (entry?.filename) {
            filename = String(entry.filename);
            candidate = path.join(completedDir, filename);
          }
        } catch {
          // continue to error below
        }
      }
    }

    candidatePaths.push(candidate);

    const uniquePaths = Array.from(new Set(candidatePaths));
    const existingPath = uniquePaths.find((p) => fs.existsSync(p));

    if (existingPath) {
      try {
        const raw = await fs.promises.readFile(existingPath, 'utf8');
        return JSON.parse(raw);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`Failed to read SnakeBench game ${gameId}: ${message}`, 'snakebench-service');
        throw new Error(`Failed to read game ${gameId}`);
      }
    }

    // Remote fetch fallback (e.g., Supabase public URL stored in replay_path)
    if (remoteReplayUrl) {
      try {
        const payload = await this.fetchJsonFromUrl(remoteReplayUrl);
        return payload;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(
          `Failed to fetch remote replay for SnakeBench game ${gameId} from ${remoteReplayUrl}: ${message}`,
          'snakebench-service',
        );
      }
    }

    // GitHub raw fallback for committed replay assets (matches submodule repo structure)
    const rawBase =
      process.env.SNAKEBENCH_REPLAY_RAW_BASE ||
      'https://raw.githubusercontent.com/VoynichLabs/SnakeBench/main/backend/completed_games';
    const rawUrl = `${rawBase}/snake_game_${gameId}.json`;
    try {
      const payload = await this.fetchJsonFromUrl(rawUrl);
      return payload;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(
        `Failed to fetch GitHub raw replay for SnakeBench game ${gameId} from ${rawUrl}: ${message}`,
        'snakebench-service',
      );
    }

    throw new Error(`Game not found: ${gameId}`);
  }

  /**
   * Lightweight HTTPS JSON fetcher to retrieve remote replay assets (e.g., Supabase public URLs).
   */
  private async fetchJsonFromUrl(url: string): Promise<any> {
    return await new Promise((resolve, reject) => {
      const req = https.get(url, (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on('end', () => {
          try {
            const raw = Buffer.concat(chunks).toString('utf8');
            const parsed = JSON.parse(raw);
            resolve(parsed);
          } catch (err) {
            reject(err);
          }
        });
      });

      req.on('error', (err) => reject(err));
      req.setTimeout(15_000, () => {
        req.destroy(new Error('timeout'));
      });
    });
  }

  async getRecentActivity(days: number = 7): Promise<{ days: number; gamesPlayed: number; uniqueModels: number }> {
    return await repositoryService.snakeBench.getRecentActivity(days);
  }

  async getBasicLeaderboard(limit: number = 10, sortBy: 'gamesPlayed' | 'winRate' = 'gamesPlayed'): Promise<Array<{ modelSlug: string; gamesPlayed: number; wins: number; losses: number; ties: number; winRate?: number }>> {
    return await repositoryService.snakeBench.getBasicLeaderboard(limit, sortBy);
  }

  async healthCheck(): Promise<SnakeBenchHealthResponse> {
    const backendDir = this.resolveBackendDir();
    const runnerPath = this.resolveRunnerPath();

    const backendDirExists = fs.existsSync(backendDir);
    const runnerExists = fs.existsSync(runnerPath);

    const pythonBin = this.resolvePythonBin();
    let pythonAvailable = false;
    try {
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
