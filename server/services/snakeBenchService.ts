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

const MIN_BOARD_SIZE = 4;
const MAX_BOARD_SIZE = 50;
const MIN_MAX_ROUNDS = 10;
const MAX_MAX_ROUNDS = 500;
const MIN_NUM_APPLES = 1;
const MAX_NUM_APPLES = 20;
const MAX_BATCH_COUNT = 10;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
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

  async runMatch(request: SnakeBenchRunMatchRequest): Promise<SnakeBenchRunMatchResult> {
    const { modelA, modelB } = request;

    if (!modelA || !modelB) {
      throw new Error('modelA and modelB are required');
    }

    const widthRaw = request.width ?? 10;
    const heightRaw = request.height ?? 10;
    const maxRoundsRaw = request.maxRounds ?? 150;
    const numApplesRaw = request.numApples ?? 5;

    const width = clamp(widthRaw, MIN_BOARD_SIZE, MAX_BOARD_SIZE);
    const height = clamp(heightRaw, MIN_BOARD_SIZE, MAX_BOARD_SIZE);
    const maxRounds = clamp(maxRoundsRaw, MIN_MAX_ROUNDS, MAX_MAX_ROUNDS);
    const numApples = clamp(numApplesRaw, MIN_NUM_APPLES, MAX_NUM_APPLES);

    const payload = {
      modelA: String(modelA),
      modelB: String(modelB),
      width,
      height,
      maxRounds,
      numApples,
    };

    const pythonBin = this.resolvePythonBin();
    const runnerPath = this.resolveRunnerPath();

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
      cwd: path.dirname(runnerPath),
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    };

    return new Promise<SnakeBenchRunMatchResult>((resolve, reject) => {
      const child = spawn(pythonBin, [runnerPath], spawnOpts);

      if (!child.stdout || !child.stderr || !child.stdin) {
        return reject(new Error('Python process streams not available for SnakeBench runner'));
      }

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

        // Fire-and-forget persistence into SnakeBench-compatible tables.
        try {
          void repositoryService.snakeBench.recordMatchFromResult({
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

        resolve(result);
      });

      child.on('error', (err) => {
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

    if (!fs.existsSync(candidate)) {
      const indexPath = path.join(completedDir, 'game_index.json');
      if (fs.existsSync(indexPath)) {
        try {
          const raw = await fs.promises.readFile(indexPath, 'utf8');
          const entries: any[] = JSON.parse(raw);
          const match = Array.isArray(entries)
            ? entries.find((e) => String(e.game_id ?? e.gameId) === gameId)
            : undefined;
          if (match && match.filename) {
            filename = String(match.filename);
            candidate = path.join(completedDir, filename);
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          logger.error(`Failed to read SnakeBench game_index.json: ${message}`, 'snakebench-service');
        }
      }
    }

    if (!fs.existsSync(candidate)) {
      throw new Error(`SnakeBench game not found for id ${gameId}`);
    }

    const raw = await fs.promises.readFile(candidate, 'utf8');
    return JSON.parse(raw);
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
