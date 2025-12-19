/**
 * server/services/snakeBenchService.ts
 *
 * Author: Cascade
 * Date: 2025-12-19
 * PURPOSE: Orchestrate SnakeBench matches via a Python runner
 *          (server/python/snakebench_runner.py) and return a compact
 *          summary suitable for HTTP APIs and frontend usage.
 *
 *          Behavior notes:
 *          - Accept OpenRouter model slugs discovered in our SnakeBench DB (active)
 *            in addition to curated OpenRouter entries in the central MODELS config.
 *          - List endpoints only return matches that have an available replay asset
 *            (local file, DB replay_path URL, or GitHub raw fallback). This prevents
 *            the UI from offering matches that cannot be replayed.
 *          - Replay loading uses "smart fallbacks":
 *            - getGame() returns { data } for local files, or { replayUrl + fallbackUrls }
 *              so the browser can fetch directly when allowed.
 *            - getGameProxy() server-fetches remote replay JSON as a same-origin fallback
 *              for cases where the browser is blocked (most commonly by CORS).
 * SRP/DRY check: Pass — dedicated to SnakeBench subprocess handling and
 *                result shaping; reuses existing logging patterns.
 */

import { spawn, spawnSync, type SpawnOptions } from 'child_process';
import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import { URL } from 'url';

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
  WormArenaStreamStatus,
  WormArenaFrameEvent,
  SnakeBenchMatchSearchQuery,
  SnakeBenchMatchSearchRow,
} from '../../shared/types.js';
import { logger } from '../utils/logger.ts';
import { repositoryService } from '../repositories/RepositoryService.ts';
import { snakeBenchIngestQueue } from './snakeBenchIngestQueue.ts';
import { MODELS } from '../config/models.ts';
import { CURATED_WORM_ARENA_HALL_OF_FAME } from './snakeBenchHallOfFame.ts';

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
  private async getSnakeBenchAllowedModels(): Promise<string[]> {
    const allowed = new Set<string>();

    // Always include curated OpenRouter models from the central config.
    MODELS
      .filter((m) => m.provider === 'OpenRouter')
      .forEach((m) => {
        const raw = m.apiModelName || m.key;
        if (typeof raw !== 'string') return;
        const trimmed = raw.trim();
        if (!trimmed) return;
        allowed.add(trimmed);
      });

    // Option A: also include DB-discovered OpenRouter models marked active.
    // This keeps Worm Arena aligned with the continually-updating OpenRouter catalog.
    if (repositoryService.isInitialized()) {
      try {
        const dbModels = await repositoryService.snakeBench.listModels();
        dbModels
          .filter((m) => (m.provider || '').toLowerCase() === 'openrouter' && (m as any).is_active)
          .forEach((m) => {
            const slug = String((m as any).model_slug ?? '').trim();
            if (!slug) return;
            allowed.add(slug);
          });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn(`SnakeBenchService.getSnakeBenchAllowedModels: failed to load DB models: ${msg}`, 'snakebench-service');
      }
    }

    return Array.from(allowed).sort((a, b) => a.localeCompare(b));
  }

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

  private prepareRunMatch(
    request: SnakeBenchRunMatchRequest,
    opts: { enableLiveDb?: boolean; enableStdoutEvents?: boolean; allowedModels?: string[] } = {},
  ): {
    modelA: string;
    modelB: string;
    width: number;
    height: number;
    maxRounds: number;
    numApples: number;
    payload: Record<string, unknown>;
    pythonBin: string;
    runnerPath: string;
    backendDir: string;
    spawnOpts: SpawnOptions;
    timeoutMs: number;
  } {
    const { modelA, modelB } = request;

    if (!modelA || !modelB) {
      throw new Error('modelA and modelB are required');
    }

    const snakeBenchModels = (opts.allowedModels && opts.allowedModels.length > 0)
      ? opts.allowedModels
      : MODELS
        .filter((m) => m.provider === 'OpenRouter')
        .map((m) => m.apiModelName || m.key)
        .filter((m): m is string => typeof m === 'string' && m.trim().length > 0)
        .map((m) => m.trim());

    if (!snakeBenchModels.includes(modelA)) {
      throw new Error(
        `Model '${modelA}' not available for SnakeBench. ` +
        `Available models: ${snakeBenchModels.join(', ')}`,
      );
    }
    if (!snakeBenchModels.includes(modelB)) {
      throw new Error(
        `Model '${modelB}' not available for SnakeBench. ` +
        `Available models: ${snakeBenchModels.join(', ')}`,
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

    const payload: Record<string, unknown> = {
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
      PYTHONUNBUFFERED: '1',
    };

    // ARC Explainer runs do not use SnakeBench's Supabase DB or Supabase Storage.
    // We persist via our own Postgres + local replay JSON under external/SnakeBench/backend/completed_games.
    // ARC Explainer handles DB persistence via its ingest queue, so disable SnakeBench's internal DB writes.
    if (!opts.enableLiveDb) {
      env.SNAKEBENCH_DISABLE_INTERNAL_DB = '1';
    }

    if (opts.enableStdoutEvents) {
      env.ARC_EXPLAINER_STDOUT_EVENTS = '1';
    }

    const expectedOpenRouterBaseUrl = 'https://openrouter.ai/api/v1';
    const configuredOpenRouterBaseUrl = (env.OPENROUTER_BASE_URL || '').trim();
    if (
      !configuredOpenRouterBaseUrl ||
      configuredOpenRouterBaseUrl === expectedOpenRouterBaseUrl ||
      configuredOpenRouterBaseUrl === `${expectedOpenRouterBaseUrl}/`
    ) {
      env.OPENROUTER_BASE_URL = expectedOpenRouterBaseUrl;
    } else {
      logger.warn(
        `SnakeBench runMatch: overriding OPENROUTER_BASE_URL (${configuredOpenRouterBaseUrl}) with ${expectedOpenRouterBaseUrl} to avoid cookie-auth 401s`,
        'snakebench-service',
      );
      env.OPENROUTER_BASE_URL = expectedOpenRouterBaseUrl;
    }

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

    const timeoutMs = process.env.SNAKEBENCH_TIMEOUT_MS
      ? parseInt(process.env.SNAKEBENCH_TIMEOUT_MS, 10)
      : DEFAULT_SNAKEBENCH_TIMEOUT_MS;

    return {
      modelA,
      modelB,
      width,
      height,
      maxRounds,
      numApples,
      payload,
      pythonBin,
      runnerPath,
      backendDir,
      spawnOpts,
      timeoutMs,
    };
  }

  /**
   * Streaming variant of runMatch.
   * Emits per-round status logs from stdout and, when available, live frames
   * by polling `public.games.current_state` written by the SnakeBench engine.
   *
   * This is used by Worm Arena Live SSE; it does not change match semantics
   * or persistence.
   */
  async runMatchStreaming(
    request: SnakeBenchRunMatchRequest,
    handlers: {
      onStatus?: (status: WormArenaStreamStatus) => void;
      onFrame?: (frame: WormArenaFrameEvent) => void;
      onChunk?: (chunk: any) => void;
      onComplete?: (result: SnakeBenchRunMatchResult) => void;
      onError?: (err: Error) => void;
    } = {},
  ): Promise<SnakeBenchRunMatchResult> {
    const allowedModels = await this.getSnakeBenchAllowedModels();
    const {
      modelA,
      modelB,
      width,
      height,
      numApples,
      payload,
      pythonBin,
      runnerPath,
      backendDir,
      spawnOpts,
      timeoutMs,
    } = this.prepareRunMatch(request, { enableLiveDb: true, enableStdoutEvents: true, allowedModels });

    return await new Promise<SnakeBenchRunMatchResult>((resolve, reject) => {
      const child = spawn(pythonBin, [runnerPath], spawnOpts);

      if (!child.stdout || !child.stderr || !child.stdin) {
        const err = new Error('Python process streams not available for SnakeBench runner');
        handlers.onError?.(err);
        return reject(err);
      }

      const timeoutHandle = setTimeout(() => {
        child.kill('SIGTERM');
        const mins = Math.round(timeoutMs / (60 * 1000));
        const err = new Error(
          `SnakeBench runner timeout (${mins} minutes exceeded). ` +
          `For longer matches, set SNAKEBENCH_TIMEOUT_MS environment variable.`,
        );
        logger.error(
          `SnakeBench runner timeout (${mins} minutes exceeded). Process killed.`,
          'snakebench-service',
        );
        handlers.onError?.(err);
        reject(err);
      }, timeoutMs);

      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');

      let stdoutBuf = '';
      let stderrBuf = '';
      let lineBuf = '';

      let discoveredGameId: string | null = null;
      let livePollHandle: NodeJS.Timeout | null = null;
      let pollInFlight = false;
      let lastRoundSent = 0;
      let pollErrorReported = false;
      let pollMissingReported = false;
      let pollNoStateReported = false;

      const stdoutEventsEnabled =
        String(spawnOpts.env?.ARC_EXPLAINER_STDOUT_EVENTS ?? '').trim() === '1';

      const stopLivePolling = () => {
        if (livePollHandle) {
          clearInterval(livePollHandle);
          livePollHandle = null;
        }
      };

      const startLivePolling = (gameId: string) => {
        if (!handlers.onFrame || livePollHandle) return;
        if (stdoutEventsEnabled) return;
        if (!repositoryService.isConnected() || !repositoryService.db) return;

        livePollHandle = setInterval(async () => {
          if (pollInFlight) return;
          pollInFlight = true;
          try {
            const pool = repositoryService.db;
            if (!pool) return;
            const { rows } = await pool.query(
              'SELECT current_state, rounds FROM public.games WHERE id = $1',
              [gameId],
            );
            const row = rows?.[0];
            if (!row) {
              if (!pollMissingReported) {
                pollMissingReported = true;
                const msg = `Live frame polling: no row found in public.games for gameId=${gameId}`;
                logger.warn(msg, 'snakebench-service');
                handlers.onStatus?.({ state: 'in_progress', message: msg });
              }
              return;
            }

            if (!row.current_state) {
              if (!pollNoStateReported) {
                pollNoStateReported = true;
                const msg = `Live frame polling: public.games.current_state is empty for gameId=${gameId}`;
                logger.warn(msg, 'snakebench-service');
                handlers.onStatus?.({ state: 'in_progress', message: msg });
              }
              return;
            }

            const stateRaw = row.current_state;
            const state =
              typeof stateRaw === 'string' ? JSON.parse(stateRaw) : stateRaw;
            const roundNumber = Number(
              state?.round_number ?? row.rounds ?? 0,
            );
            if (!Number.isFinite(roundNumber) || roundNumber <= lastRoundSent) {
              return;
            }

            lastRoundSent = roundNumber;
            const snakes =
              state?.snake_positions ?? state?.snakes ?? {};
            const apples = state?.apples ?? [];

            handlers.onFrame?.({
              round: roundNumber,
              frame: {
                state: {
                  width,
                  height,
                  apples,
                  snakes,
                  maxRounds: request.maxRounds ?? 150,
                },
              },
              timestamp: Date.now(),
            });
          } catch (err) {
            if (!pollErrorReported) {
              pollErrorReported = true;
              const msg = err instanceof Error ? err.message : String(err);
              logger.warn(
                `Live frame polling error for gameId=${gameId}: ${msg}`,
                'snakebench-service',
              );
              handlers.onStatus?.({
                state: 'in_progress',
                message: `Live frame polling error: ${msg}`,
              });
            }
          } finally {
            pollInFlight = false;
          }
        }, 700);
      };

      handlers.onStatus?.({ state: 'starting', message: 'Launching match...' });

      logger.info(
        `SnakeBench runMatchStreaming: OPENROUTER_BASE_URL=${spawnOpts.env?.OPENROUTER_BASE_URL ?? '(unset)'}`,
        'snakebench-service',
      );

      child.stdout.on('data', (chunk: Buffer | string) => {
        const text = chunk.toString();
        stdoutBuf += text;
        lineBuf += text;

        const lines = lineBuf.split(/\r?\n/);
        lineBuf = lines.pop() ?? '';

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line) continue;

          if (
            line.includes('Provider error') ||
            line.includes('No cookie auth credentials found') ||
            line.includes('cookie auth')
          ) {
            logger.warn(`SnakeBench engine: ${line}`, 'snakebench-service');
          }

          if (!discoveredGameId) {
            const inserted = line.match(/Inserted initial game record\s+([0-9a-fA-F-]+)/);
            const gameIdLine = line.match(/^Game ID:\s*([0-9a-fA-F-]+)\s*$/);
            const discovered = inserted?.[1] ?? gameIdLine?.[1];
            if (discovered) {
              discoveredGameId = discovered;
              startLivePolling(discoveredGameId);
            }
          }

          const finishedRound = line.match(/Finished round\s+(\d+)/i);
          if (finishedRound?.[1]) {
            const round = Number(finishedRound[1]);
            if (Number.isFinite(round)) {
              handlers.onStatus?.({
                state: 'in_progress',
                message: line,
                round,
              });
              continue;
            }
          }

          if (line.startsWith('{') && line.endsWith('}')) {
            try {
              const evt = JSON.parse(line);
              if (evt?.type === 'frame' && handlers.onFrame) {
                handlers.onFrame({
                  round: Number(evt.round ?? 0),
                  frame: evt.frame ?? evt,
                  timestamp: Date.now(),
                });
                continue;
              }
              if (evt?.type === 'chunk' && handlers.onChunk) {
                handlers.onChunk(evt.chunk ?? evt);
                continue;
              }
              if (evt?.type === 'game.init') {
                if (!discoveredGameId && typeof evt.gameId === 'string' && evt.gameId.trim().length > 0) {
                  const gameId = evt.gameId.trim();
                  discoveredGameId = gameId;
                  startLivePolling(gameId);
                }
                continue;
              }
              if (evt?.type === 'status') {
                handlers.onStatus?.({
                  state: 'in_progress',
                  message: evt.message ?? line,
                  round: evt.round,
                });
                continue;
              }
            } catch {
              // Fall through to generic log handling.
            }
          }

          handlers.onStatus?.({ state: 'in_progress', message: line });
        }
      });

      child.stderr.on('data', (chunk: Buffer | string) => {
        stderrBuf += chunk.toString();
      });

      child.on('close', (code: number | null) => {
        clearTimeout(timeoutHandle);
        stopLivePolling();

        if (code !== 0) {
          const errSnippet = (stderrBuf || stdoutBuf).trim().slice(0, 500);
          logger.error(
            `SnakeBench runner failed (exit code ${code ?? 'null'}): ${errSnippet}`,
            'snakebench-service',
          );
          const err = new Error(`SnakeBench runner failed (exit code ${code ?? 'null'})`);
          handlers.onError?.(err);
          return reject(err);
        }

        const lines = stdoutBuf
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter((l) => l.length > 0);

        if (lines.length === 0) {
          const err = new Error('SnakeBench runner produced no output');
          handlers.onError?.(err);
          return reject(err);
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
          const parseErr = new Error('Failed to parse SnakeBench runner output');
          handlers.onError?.(parseErr);
          return reject(parseErr);
        }

        if (parsed && typeof parsed === 'object' && parsed.error) {
          const err = new Error(String(parsed.error));
          handlers.onError?.(err);
          return reject(err);
        }

        const result: SnakeBenchRunMatchResult = {
          gameId: parsed.game_id ?? parsed.gameId ?? '',
          modelA: parsed.modelA,
          modelB: parsed.modelB,
          scores: parsed.scores ?? {},
          results: parsed.results ?? {},
          completedGamePath: parsed.completed_game_path ?? parsed.completedGamePath,
        };

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
          logger.warn(`SnakeBenchService.runMatchStreaming: failed to enqueue DB persistence: ${msg}`, 'snakebench-service');
        }

        void this.upsertGameIndex(result.completedGamePath, result.gameId, { modelA, modelB });

        handlers.onComplete?.(result);
        resolve(result);
      });

      child.on('error', (err) => {
        clearTimeout(timeoutHandle);
        stopLivePolling();
        logger.error(
          `Failed to spawn SnakeBench runner: ${err instanceof Error ? err.message : String(err)}`,
          'snakebench-service',
        );
        const spawnErr = err instanceof Error ? err : new Error(String(err));
        handlers.onError?.(spawnErr);
        reject(spawnErr);
      });

      try {
        child.stdin.setDefaultEncoding('utf8');
        child.stdin.write(JSON.stringify(payload));
        child.stdin.end();
      } catch (err) {
        clearTimeout(timeoutHandle);
        stopLivePolling();
        logger.error(
          `Failed to send payload to SnakeBench runner: ${err instanceof Error ? err.message : String(err)}`,
          'snakebench-service',
        );
        child.kill();
        const sendErr = err instanceof Error ? err : new Error(String(err));
        handlers.onError?.(sendErr);
        reject(sendErr);
      }
    });
  }

  async runMatch(request: SnakeBenchRunMatchRequest): Promise<SnakeBenchRunMatchResult> {
    const allowedModels = await this.getSnakeBenchAllowedModels();
    const {
      modelA,
      modelB,
      width,
      height,
      numApples,
      payload,
      pythonBin,
      runnerPath,
      backendDir,
      spawnOpts,
      timeoutMs,
    } = this.prepareRunMatch(request, { allowedModels });

    return new Promise<SnakeBenchRunMatchResult>((resolve, reject) => {
      const child = spawn(pythonBin, [runnerPath], spawnOpts);

      if (!child.stdout || !child.stderr || !child.stdin) {
        return reject(new Error('Python process streams not available for SnakeBench runner'));
      }

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

      logger.info(
        `SnakeBench runMatch: OPENROUTER_BASE_URL=${spawnOpts.env?.OPENROUTER_BASE_URL ?? '(unset)'}`,
        'snakebench-service',
      );

      child.stdout.on('data', (chunk: Buffer | string) => {
        const text = chunk.toString();
        stdoutBuf += text;

        // Surface provider failures emitted by the SnakeBench engine so we can debug
        // auth issues without forcing users to inspect Python output.
        if (
          text.includes('Provider error') ||
          text.includes('No cookie auth credentials found') ||
          text.includes('cookie auth')
        ) {
          const preview = text.trim().split(/\r?\n/).filter(Boolean).slice(-3).join(' | ');
          logger.warn(`SnakeBench engine stdout (provider issue): ${preview}`, 'snakebench-service');
        }
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
        const replayable = this.filterReplayableGames(games);
        const available = await this.filterGamesWithAvailableReplays(replayable);
        return { games: available, total: available.length };
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

      const replayable = this.filterReplayableGames(games);
      const available = await this.filterGamesWithAvailableReplays(replayable);
      return { games: available, total: available.length };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to list SnakeBench games: ${message}`, 'snakebench-service');
      throw new Error('Failed to list SnakeBench games');
    }
  }

  async searchMatches(
    query: SnakeBenchMatchSearchQuery,
  ): Promise<{ rows: SnakeBenchMatchSearchRow[]; total: number }> {
    return await repositoryService.snakeBench.searchMatches(query);
  }

  /**
   * Resolve replay for a given gameId.
   *
   * Returns EITHER:
   * - { data: <parsed JSON> } when a local file is available
   * - { replayUrl: <string>, fallbackUrls?: <string[]> } when replay must be fetched remotely
   *
   * NOTE: Some deployments / hosts block cross-origin replay JSON fetches (CORS).
   * The frontend should fall back to /api/snakebench/games/:gameId/proxy in that case.
   */
  async getGame(gameId: string): Promise<{ data?: any; replayUrl?: string; fallbackUrls?: string[] }> {
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
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(
        `SnakeBenchService.getGame: failed to fetch replay_path from DB for ${gameId}: ${msg}`,
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
          // continue below
        }
      }
    }

    candidatePaths.push(candidate);

    const uniquePaths = Array.from(new Set(candidatePaths));
    const existingPaths = uniquePaths.filter((p) => fs.existsSync(p));

    // Local file available: return data directly (local dev scenario)
    for (const existingPath of existingPaths) {
      try {
        const raw = await fs.promises.readFile(existingPath, 'utf8');
        const parsed = JSON.parse(raw);
        return { data: parsed };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.warn(
          `SnakeBenchService.getGame: failed to read/parse replay for ${gameId} from ${existingPath}: ${message}`,
          'snakebench-service',
        );
      }
    }

    // No local file: return URL for the client to fetch directly.
    // Priority: DB replay_path URL > snakebench.com upstream > GitHub raw fallback
    if (remoteReplayUrl) {
      logger.info(
        `SnakeBenchService.getGame: returning replayUrl from DB for ${gameId}: ${remoteReplayUrl}`,
        'snakebench-service',
      );
      return { replayUrl: remoteReplayUrl };
    }

    const fallbackUrls: string[] = [];
    const upstreamBase = process.env.SNAKEBENCH_UPSTREAM_URL || 'https://snakebench.com';
    fallbackUrls.push(`${upstreamBase}/api/matches/${gameId}`);

    const rawBase =
      process.env.SNAKEBENCH_REPLAY_RAW_BASE ||
      'https://raw.githubusercontent.com/VoynichLabs/SnakeBench/main/backend/completed_games';
    fallbackUrls.push(`${rawBase}/snake_game_${gameId}.json`);

    logger.info(
      `SnakeBenchService.getGame: returning fallback replayUrls for ${gameId}: ${fallbackUrls.join(', ')}`,
      'snakebench-service',
    );

    return { replayUrl: fallbackUrls[0], fallbackUrls };
  }

  /**
   * Fetch replay JSON server-side as a same-origin fallback.
   *
   * The frontend should ONLY call this if direct replayUrl fetching fails (e.g., CORS).
   */
  async getGameProxy(gameId: string): Promise<{ data: any }> {
    // First, try the normal resolution path (local file, DB replay URL, etc.).
    const base = await this.getGame(gameId);
    if (base.data) {
      return { data: base.data };
    }

    const upstreamBase = process.env.SNAKEBENCH_UPSTREAM_URL || 'https://snakebench.com';
    const rawBase =
      process.env.SNAKEBENCH_REPLAY_RAW_BASE ||
      'https://raw.githubusercontent.com/VoynichLabs/SnakeBench/main/backend/completed_games';

    const urlsToTry = Array.from(
      new Set(
        [
          base.replayUrl,
          ...(base.fallbackUrls ?? []),
          `${upstreamBase}/api/matches/${gameId}`,
          `${rawBase}/snake_game_${gameId}.json`,
        ].filter((v): v is string => typeof v === 'string' && v.trim().length > 0),
      ),
    );

    let lastError = '';
    for (const url of urlsToTry) {
      try {
        const parsed = await this.fetchJsonFromUrl(url);
        logger.info(
          `SnakeBenchService.getGameProxy: fetched remote replay for ${gameId} from ${url}`,
          'snakebench-service',
        );
        return { data: parsed };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        lastError = msg;
        logger.warn(
          `SnakeBenchService.getGameProxy: failed to fetch remote replay for ${gameId} from ${url}: ${msg}`,
          'snakebench-service',
        );
      }
    }

    throw new Error(
      `Replay not found for ${gameId}. Last error: ${lastError || 'unknown error'}`,
    );
  }

  /**
   * Check whether a replay asset exists locally or remotely for a given game.
   * Used to keep greatest-hits entries playable.
   */
  private async replayExists(gameId: string): Promise<boolean> {
    const backendDir = this.resolveBackendDir();
    const completedDir = path.join(backendDir, 'completed_games');
    const replayPath = path.join(completedDir, `snake_game_${gameId}.json`);

    // All replay JSONs are bundled with the project in external/SnakeBench/backend/completed_games/
    // Just check if the file exists locally. No remote fallbacks needed.
    return fs.existsSync(replayPath);
  }

  /**
   * Lightweight HTTPS JSON fetcher to retrieve remote replay assets (e.g., Supabase public URLs).
   */
  private async fetchJsonFromUrl(url: string, redirectDepth: number = 0): Promise<any> {
    // Some hosts (GitHub raw, CDNs) may return 301/302 redirects or require a User-Agent.
    // This helper keeps the replay loading path deterministic across local dev and deployments.
    const maxRedirects = 3;
    if (redirectDepth > maxRedirects) {
      throw new Error(`Too many redirects while fetching ${url}`);
    }

    const timeoutMsRaw = process.env.SNAKEBENCH_REMOTE_FETCH_TIMEOUT_MS;
    const timeoutMsParsed = timeoutMsRaw ? parseInt(timeoutMsRaw, 10) : NaN;
    const timeoutMs = Number.isFinite(timeoutMsParsed) ? Math.max(1_000, timeoutMsParsed) : 15_000;

    const parsedUrl = new URL(url);

    return await new Promise((resolve, reject) => {
      const transport = parsedUrl.protocol === 'http:' ? http : https;
      const req = transport.request(
        {
          protocol: parsedUrl.protocol,
          hostname: parsedUrl.hostname,
          port: parsedUrl.port,
          path: `${parsedUrl.pathname}${parsedUrl.search}`,
          method: 'GET',
          headers: {
            // GitHub may block requests without a UA in some environments.
            'User-Agent': 'arc-explainer',
            Accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
          },
        },
        (res) => {
          const statusCode = res.statusCode ?? 0;

          // Follow redirects (common for signed URLs / CDN rewrites).
          if (statusCode >= 300 && statusCode < 400 && res.headers.location) {
            const nextUrl = new URL(res.headers.location, parsedUrl).toString();
            res.resume();
            void this.fetchJsonFromUrl(nextUrl, redirectDepth + 1).then(resolve).catch(reject);
            return;
          }

          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
          res.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8');

            // Improve failure visibility when upstream returns HTML or a helpful message.
            if (statusCode >= 400) {
              const snippet = raw.length > 200 ? `${raw.slice(0, 200)}...` : raw;
              reject(new Error(`HTTP ${statusCode}${snippet ? ` - ${snippet}` : ''}`));
              return;
            }

            try {
              const parsed = JSON.parse(raw);
              resolve(parsed);
            } catch {
              // Include a tiny snippet so "Unexpected token <" has context.
              const snippet = raw.length > 200 ? `${raw.slice(0, 200)}...` : raw;
              reject(new Error(`Invalid JSON response${snippet ? ` - ${snippet}` : ''}`));
            }
          });
        },
      );

      req.on('error', (err) => reject(err));
      req.setTimeout(timeoutMs, () => {
        req.destroy(new Error('timeout'));
      });
      req.end();
    });
  }

  async getRecentActivity(days: number = 7): Promise<{ days: number; gamesPlayed: number; uniqueModels: number }> {
    return await repositoryService.snakeBench.getRecentActivity(days);
  }

  async getBasicLeaderboard(limit: number = 10, sortBy: 'gamesPlayed' | 'winRate' = 'gamesPlayed'): Promise<Array<{ modelSlug: string; gamesPlayed: number; wins: number; losses: number; ties: number; winRate?: number }>> {
    return await repositoryService.snakeBench.getBasicLeaderboard(limit, sortBy);
  }

  async getArcExplainerStats(): Promise<SnakeBenchArcExplainerStats> {
    return await repositoryService.snakeBench.getArcExplainerStats();
  }

  async getModelRating(modelSlug: string): Promise<SnakeBenchModelRating | null> {
    return await repositoryService.snakeBench.getModelRating(modelSlug);
  }

  async getModelMatchHistory(modelSlug: string, limit?: number): Promise<SnakeBenchModelMatchHistoryEntry[]> {
    const safeLimit = limit != null && Number.isFinite(limit) ? Number(limit) : 50;
    return await repositoryService.snakeBench.getModelMatchHistory(modelSlug, safeLimit);
  }

  async getTrueSkillLeaderboard(
    limit: number = 150,
    minGames: number = 3,
  ): Promise<SnakeBenchTrueSkillLeaderboardEntry[]> {
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 150)) : 150;
    const safeMinGames = Number.isFinite(minGames) ? Math.max(1, minGames) : 3;
    return await repositoryService.snakeBench.getTrueSkillLeaderboard(safeLimit, safeMinGames);
  }

  async getWormArenaGreatestHits(limitPerDimension: number = 5): Promise<WormArenaGreatestHitGame[]> {
    const raw = Number(limitPerDimension);
    const safeLimit = Number.isFinite(raw)
      ? Math.max(1, Math.min(raw, CURATED_WORM_ARENA_HALL_OF_FAME.length))
      : 5;

    const playable: WormArenaGreatestHitGame[] = [];

    for (const game of CURATED_WORM_ARENA_HALL_OF_FAME) {
      if (playable.length >= safeLimit) break;

      const available = await this.replayExists(game.gameId);
      if (available) {
        playable.push(game);
        continue;
      }

      logger.warn(
        `SnakeBenchService.getWormArenaGreatestHits: curated game ${game.gameId} has no available replay asset`,
        'snakebench-service',
      );
    }

    return playable;
  }

  /**
   * Apply a conservative minimum-rounds filter for Worm Arena replays.
   * Very short diagnostic matches (< 20 rounds) are still stored, but
   * we avoid surfacing them as default replays in the UI.
   */
  private filterReplayableGames(games: SnakeBenchGameSummary[]): SnakeBenchGameSummary[] {
    if (!Array.isArray(games) || games.length === 0) return [];

    const MIN_ROUNDS = 20;
    const filtered = games.filter((g) => {
      const rounds = Number.isFinite(g.roundsPlayed) ? Number(g.roundsPlayed) : 0;
      return rounds >= MIN_ROUNDS;
    });

    if (filtered.length > 0) {
      return filtered;
    }

    // Fallback: no games meet the threshold; return original list so the
    // UI can still show "something", but prefer longer matches first.
    return [...games].sort((a, b) => (b.roundsPlayed ?? 0) - (a.roundsPlayed ?? 0));
  }

  /**
   * Filter a candidate list down to matches with an available replay.
   *
   * Notes:
   * - Concurrency is intentionally small to avoid spamming remote replay endpoints.
   * - We keep this inside the service so listGames stays resilient if the DB has
   *   completed matches without persisted replay assets.
   */
  private async filterGamesWithAvailableReplays(games: SnakeBenchGameSummary[]): Promise<SnakeBenchGameSummary[]> {
    if (!Array.isArray(games) || games.length === 0) return [];

    const MAX_CONCURRENCY = 5;
    const results: SnakeBenchGameSummary[] = [];

    // Simple in-process concurrency limiter.
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
            `SnakeBenchService.filterGamesWithAvailableReplays: replayExists check failed for ${gameId}: ${msg}`,
            'snakebench-service',
          );
        }
      }
    };

    const workers = Array.from({ length: Math.min(MAX_CONCURRENCY, games.length) }, () => worker());
    await Promise.all(workers);

    // Preserve the original ordering from the input list.
    const allowed = new Set(results.map((g) => g.gameId));
    return games.filter((g) => allowed.has(g.gameId));
  }

  /**
   * Suggest interesting unplayed matchups using one of two scoring modes:
   *
   * - **ladder**: Maximize ranking information gain (high sigma, close ratings)
   * - **entertainment**: Maximize watchability (close fights, high stakes, novelty)
   *
   * Only includes models with >= minGames played, and only suggests pairs that
   * have never faced each other (matchesPlayed === 0).
   *
   * Returns up to `limit` matchups sorted by score descending, with explanation reasons.
   */
  async suggestMatchups(
    mode: 'ladder' | 'entertainment' = 'ladder',
    limit: number = 20,
    minGames: number = 3,
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

    // 1. Get the leaderboard pool (models with >= minGames)
    let leaderboard = await this.getTrueSkillLeaderboard(150, safeMinGames);

    // Filter to only approved OpenRouter models from config (avoid expensive/unsupported models)
    const openrouterModels = new Set(
      MODELS.filter((m) => m.provider === 'OpenRouter' && !m.premium)
        .map((m) => m.apiModelName || m.key)
    );

    leaderboard = leaderboard.filter((entry) => openrouterModels.has(entry.modelSlug));

    if (leaderboard.length < 2) {
      return { mode, matchups: [], totalCandidates: 0 };
    }

    // Normalize slugs by removing ':free' suffix and prefer free versions
    const normalizedMap = new Map<string, SnakeBenchTrueSkillLeaderboardEntry>();
    for (const entry of leaderboard) {
      const normalizedSlug = entry.modelSlug.replace(/:free$/, '');
      const existing = normalizedMap.get(normalizedSlug);
      if (!existing) {
        normalizedMap.set(normalizedSlug, entry);
      } else {
        // Prefer free version over paid version
        const existingIsFree = existing.modelSlug.includes(':free');
        const currentIsFree = entry.modelSlug.includes(':free');
        if (currentIsFree && !existingIsFree) {
          // Replace with free version
          normalizedMap.set(normalizedSlug, entry);
        } else if (existingIsFree === currentIsFree) {
          // Both same type (both free or both paid), keep the one with more games
          if (entry.gamesPlayed > existing.gamesPlayed) {
            normalizedMap.set(normalizedSlug, entry);
          }
        }
        // If existing is free and current is paid, keep existing
      }
    }
    leaderboard = Array.from(normalizedMap.values());

    // 2. Get pairing history to filter out already-played pairs
    const pairingHistory = await repositoryService.snakeBench.getPairingHistory();

    // Helper to get normalized key for a pair
    const pairKey = (a: string, b: string): string => {
      return a < b ? `${a}|||${b}` : `${b}|||${a}`;
    };

    // 3. Generate all candidate pairs (only unplayed)
    type Candidate = {
      modelA: typeof leaderboard[0];
      modelB: typeof leaderboard[0];
      history: { matchesPlayed: number; lastPlayedAt: string | null };
      score: number;
      reasons: string[];
    };

    const candidates: Candidate[] = [];
    const modelAppearances = new Map<string, number>();

    for (let i = 0; i < leaderboard.length; i++) {
      for (let j = i + 1; j < leaderboard.length; j++) {
        const modelA = leaderboard[i];
        const modelB = leaderboard[j];
        const key = pairKey(modelA.modelSlug, modelB.modelSlug);
        const history = pairingHistory.get(key) ?? { matchesPlayed: 0, lastPlayedAt: null };

        // Hard filter: only unplayed pairs
        if (history.matchesPlayed > 0) {
          continue;
        }

        candidates.push({
          modelA,
          modelB,
          history,
          score: 0,
          reasons: [],
        });
      }
    }

    // 4. Score each candidate based on mode
    for (const c of candidates) {
      const reasons: string[] = [];
      let score = 0;

      // Novelty bonus (always applies since we filter to unplayed)
      reasons.push('Unplayed pairing');
      score += 100;

      const exposedDiff = Math.abs(c.modelA.exposed - c.modelB.exposed);
      const sigmaSum = c.modelA.sigma + c.modelB.sigma;
      const maxExposed = Math.max(c.modelA.exposed, c.modelB.exposed);

      if (mode === 'ladder') {
        // LADDER MODE: prioritize info gain
        // High sigma = high uncertainty = more to learn
        if (sigmaSum > 10) {
          score += 40;
          reasons.push('High combined uncertainty');
        } else if (sigmaSum > 7) {
          score += 25;
          reasons.push('Moderate uncertainty');
        }

        // Close ratings = ordering test (informative)
        if (exposedDiff < 1.5) {
          score += 35;
          reasons.push('Very close ratings (ordering test)');
        } else if (exposedDiff < 3) {
          score += 20;
          reasons.push('Close ratings');
        }

        // Slight bonus for at least one high-sigma model
        if (c.modelA.sigma > 5 || c.modelB.sigma > 5) {
          score += 10;
          reasons.push('Placement model involved');
        }
      } else {
        // ENTERTAINMENT MODE: prioritize watchability
        // Close match = nail-biter potential
        if (exposedDiff < 1.5) {
          score += 45;
          reasons.push('Expected nail-biter');
        } else if (exposedDiff < 3) {
          score += 30;
          reasons.push('Competitive matchup');
        }

        // High stakes = top models involved
        if (maxExposed > 20) {
          score += 35;
          reasons.push('High-stakes (top-tier model)');
        } else if (maxExposed > 15) {
          score += 20;
          reasons.push('Strong models');
        }

        // Upset potential: underdog with decent sigma vs favorite
        const [favorite, underdog] =
          c.modelA.exposed > c.modelB.exposed ? [c.modelA, c.modelB] : [c.modelB, c.modelA];
        if (exposedDiff > 2 && exposedDiff < 6 && underdog.sigma > 4) {
          score += 15;
          reasons.push('Upset potential');
        }
      }

      c.score = score;
      c.reasons = reasons;
    }

    // 5. Sort by score descending
    candidates.sort((a, b) => b.score - a.score);

    // 6. Apply variety penalty: limit how often a single model appears
    const MAX_APPEARANCES = 3;
    const selected: Candidate[] = [];

    for (const c of candidates) {
      if (selected.length >= safeLimit) break;

      const countA = modelAppearances.get(c.modelA.modelSlug) ?? 0;
      const countB = modelAppearances.get(c.modelB.modelSlug) ?? 0;

      if (countA >= MAX_APPEARANCES || countB >= MAX_APPEARANCES) {
        continue;
      }

      selected.push(c);
      modelAppearances.set(c.modelA.modelSlug, countA + 1);
      modelAppearances.set(c.modelB.modelSlug, countB + 1);
    }

    // 7. Transform to response shape
    const matchups = selected.map((c) => ({
      modelA: {
        modelSlug: c.modelA.modelSlug,
        mu: c.modelA.mu,
        sigma: c.modelA.sigma,
        exposed: c.modelA.exposed,
        gamesPlayed: c.modelA.gamesPlayed,
      },
      modelB: {
        modelSlug: c.modelB.modelSlug,
        mu: c.modelB.mu,
        sigma: c.modelB.sigma,
        exposed: c.modelB.exposed,
        gamesPlayed: c.modelB.gamesPlayed,
      },
      history: c.history,
      score: c.score,
      reasons: c.reasons,
    }));

    return {
      mode,
      matchups,
      totalCandidates: candidates.length,
    };
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
