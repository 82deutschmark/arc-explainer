/**
 * Author: Gemini 3 Flash High
 * Date: 2025-12-27
 * PURPOSE: Orchestrate streaming match execution with live frame polling.
 *          Parses stdout for JSON events, emits status/frame/chunk to handlers.
 *          Coordinates persistence on completion.
 * SRP/DRY check: Pass — streaming orchestration only, delegates to bridge and persistence.
 */

import type {
  SnakeBenchRunMatchRequest,
  SnakeBenchRunMatchResult,
  WormArenaStreamStatus,
  WormArenaFrameEvent,
  WormArenaPlayerTiming,
  WormArenaRoundTiming,
} from '../../../shared/types.js';
import { snakeBenchPythonBridge } from './SnakeBenchPythonBridge.ts';
import { PersistenceCoordinator } from './persistence/persistenceCoordinator.ts';
import { prepareRunMatch } from './helpers/validators.ts';
import { repositoryService } from '../../repositories/RepositoryService.ts';
import { logger } from '../../utils/logger.ts';

export interface StreamingHandlers {
  onStatus?: (status: WormArenaStreamStatus) => void;
  onFrame?: (frame: WormArenaFrameEvent) => void;
  onChunk?: (chunk: any) => void;
  onComplete?: (result: SnakeBenchRunMatchResult) => void;
  onError?: (err: Error) => void;
}

/**
 * Internal helper for live frame polling from database.
 * Polls public.games.current_state every 700ms during match execution.
 */
class LiveFramePoller {
  private pollHandle: NodeJS.Timeout | null = null;
  private pollInFlight = false;
  private lastRoundSent = 0;
  private pollErrorReported = false;
  private pollMissingReported = false;
  private pollNoStateReported = false;

  start(
    gameId: string,
    width: number,
    height: number,
    maxRounds: number,
    onFrame: (frame: WormArenaFrameEvent) => void,
    onStatus: (status: WormArenaStreamStatus) => void
  ): void {
    if (this.pollHandle || !repositoryService.isConnected() || !repositoryService.db) return;

    this.pollHandle = setInterval(async () => {
      if (this.pollInFlight) return;
      this.pollInFlight = true;
      try {
        const pool = repositoryService.db;
        if (!pool) return;
        const { rows } = await pool.query(
          'SELECT current_state, rounds FROM public.games WHERE id = $1',
          [gameId]
        );
        const row = rows?.[0];
        if (!row) {
          if (!this.pollMissingReported) {
            this.pollMissingReported = true;
            const msg = `Live frame polling: no row found in public.games for gameId=${gameId}`;
            logger.warn(msg, 'snakebench-service');
            onStatus({ state: 'in_progress', message: msg });
          }
          return;
        }

        if (!row.current_state) {
          if (!this.pollNoStateReported) {
            this.pollNoStateReported = true;
            const msg = `Live frame polling: public.games.current_state is empty for gameId=${gameId}`;
            logger.warn(msg, 'snakebench-service');
            onStatus({ state: 'in_progress', message: msg });
          }
          return;
        }

        const stateRaw = row.current_state;
        const state = typeof stateRaw === 'string' ? JSON.parse(stateRaw) : stateRaw;
        const roundNumber = Number(state?.round_number ?? row.rounds ?? 0);
        if (!Number.isFinite(roundNumber) || roundNumber <= this.lastRoundSent) {
          return;
        }

        this.lastRoundSent = roundNumber;
        const snakes = state?.snake_positions ?? state?.snakes ?? {};
        const apples = state?.apples ?? [];

        onFrame({
          round: roundNumber,
          frame: {
            state: {
              width,
              height,
              apples,
              snakes,
              maxRounds,
            },
          },
          timestamp: Date.now(),
        });
      } catch (err) {
        if (!this.pollErrorReported) {
          this.pollErrorReported = true;
          const msg = err instanceof Error ? err.message : String(err);
          logger.warn(
            `Live frame polling error for gameId=${gameId}: ${msg}`,
            'snakebench-service'
          );
          onStatus({
            state: 'in_progress',
            message: `Live frame polling error: ${msg}`,
          });
        }
      } finally {
        this.pollInFlight = false;
      }
    }, 700);
  }

  stop(): void {
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
  }
}

export class SnakeBenchStreamingRunner {
  constructor(private readonly persistenceCoordinator: PersistenceCoordinator) {}

  /**
   * Run a streaming match with live status/frame/chunk events.
   * Parses stdout line-by-line, emitting JSON events and text status messages.
   * Optionally polls database for live frames during execution.
   */
  async runMatchStreaming(
    request: SnakeBenchRunMatchRequest,
    handlers: StreamingHandlers,
    allowedModels: string[]
  ): Promise<SnakeBenchRunMatchResult> {
    // Validate and prepare
    const prepared = prepareRunMatch(request, {
      enableLiveDb: true,
      enableStdoutEvents: true,
      allowedModels,
    });

    const poller = new LiveFramePoller();
    const matchStartedAt = Date.now();
    let lastMoveAt: number | null = null;

    // Timing state
    const playerTiming: Record<string, WormArenaPlayerTiming> = {};
    const roundTiming: WormArenaRoundTiming[] = [];
    let currentRoundStart: number | null = null;

    const emitStatus = (status: WormArenaStreamStatus) => {
      handlers.onStatus?.({
        ...status,
        matchStartedAt,
        lastMoveAt: lastMoveAt ?? undefined,
      });
    };

    const emitFrame = (frame: WormArenaFrameEvent) => {
      const timestamp = Number.isFinite(frame.timestamp) ? frame.timestamp : Date.now();
      lastMoveAt = timestamp;
      handlers.onFrame?.({
        ...frame,
        timestamp,
        matchStartedAt,
        lastMoveAt,
      });
    };

    try {
      emitStatus({ state: 'starting', message: 'Launching match...' });

      let discoveredGameId: string | null = null;
      const stdoutEventsEnabled =
        String(prepared.spawnOpts.env?.ARC_EXPLAINER_STDOUT_EVENTS ?? '').trim() === '1';

      // Spawn streaming Python runner
      const { stdout, stderr, code } = await snakeBenchPythonBridge.spawnMatchStreaming(
        prepared.payload,
        prepared.spawnOpts,
        prepared.timeoutMs,
        (line: string) => {
          // Process stdout line
          if (!line) return;

          // Provider error detection
          if (
            line.includes('Provider error') ||
            line.includes('No cookie auth credentials found') ||
            line.includes('cookie auth')
          ) {
            logger.warn(`SnakeBench engine: ${line}`, 'snakebench-service');
          }

          // Discover game ID from output
          if (!discoveredGameId) {
            const inserted = line.match(/Inserted initial game record\s+([0-9a-fA-F-]+)/);
            const gameIdLine = line.match(/^Game ID:\s*([0-9a-fA-F-]+)\s*$/);
            const discovered = inserted?.[1] ?? gameIdLine?.[1];
            if (discovered) {
              discoveredGameId = discovered;
              poller.start(
                discoveredGameId,
                prepared.width,
                prepared.height,
                prepared.maxRounds,
                (frame) => emitFrame(frame),
                (status) => emitStatus(status)
              );
            }
          }

          // Parse finished round status
          const finishedRound = line.match(/Finished round\s+(\d+)/i);
          if (finishedRound?.[1]) {
            const round = Number(finishedRound[1]);
            if (Number.isFinite(round)) {
              // Record round timing
              if (currentRoundStart) {
                const roundCompletedAt = Date.now();
                const durationMs = roundCompletedAt - currentRoundStart;
                roundTiming.push({
                  round,
                  startedAt: currentRoundStart,
                  completedAt: roundCompletedAt,
                  durationMs,
                });
              }
              // Start next round timing
              currentRoundStart = Date.now();
              emitStatus({
                state: 'in_progress',
                message: line,
                round,
              });
              return;
            }
          }

          // Try to parse as JSON event
          if (line.startsWith('{') && line.endsWith('}')) {
            try {
              const evt = JSON.parse(line);
              if (evt?.type === 'frame' && handlers.onFrame) {
                emitFrame({
                  round: Number(evt.round ?? 0),
                  frame: evt.frame ?? evt,
                  timestamp: Date.now(),
                });
                return;
              }
              if (evt?.type === 'chunk' && handlers.onChunk) {
                handlers.onChunk(evt.chunk ?? evt);
                return;
              }
              if (evt?.type === 'timing') {
                // Handle timing events from Python runner
                if (evt.playerId && evt.responseTimeMs !== undefined) {
                  const pid = String(evt.playerId);
                  if (!playerTiming[pid]) {
                    playerTiming[pid] = {
                      playerId: pid,
                      moveCount: 0,
                      totalResponseTimeMs: 0,
                      avgResponseTimeMs: 0,
                      lastResponseTimeMs: 0,
                      totalApiLatencyMs: 0,
                      avgApiLatencyMs: 0,
                    };
                  }
                  const timing = playerTiming[pid];
                  timing.moveCount++;
                  timing.totalResponseTimeMs += evt.responseTimeMs;
                  timing.avgResponseTimeMs = timing.totalResponseTimeMs / timing.moveCount;
                  timing.lastResponseTimeMs = evt.responseTimeMs;
                  if (evt.apiLatencyMs !== undefined) {
                    timing.totalApiLatencyMs += evt.apiLatencyMs;
                    timing.avgApiLatencyMs = timing.totalApiLatencyMs / timing.moveCount;
                  }
                }
                return;
              }
              if (evt?.type === 'game.init') {
                if (!discoveredGameId && typeof evt.gameId === 'string' && evt.gameId.trim().length > 0) {
                  const gameId = evt.gameId.trim();
                  discoveredGameId = gameId;
                  poller.start(
                    gameId,
                    prepared.width,
                    prepared.height,
                    prepared.maxRounds,
                    (frame) => emitFrame(frame),
                    (status) => emitStatus(status)
                  );
                }
                return;
              }
              if (evt?.type === 'status') {
                emitStatus({
                  state: 'in_progress',
                  message: evt.message ?? line,
                  round: evt.round,
                });
                return;
              }
            } catch {
              // Fall through to generic log handling
            }
          }

          // Generic status message
          emitStatus({ state: 'in_progress', message: line });
        },
        (line: string) => {
          // Process stderr line (if needed)
          if (line) {
            logger.warn(`SnakeBench stderr: ${line}`, 'snakebench-service');
          }
        }
      );

      poller.stop();

      // Check for subprocess failure
      if (code !== 0) {
        const errSnippet = (stderr || stdout).trim().slice(0, 500);
        logger.error(
          `SnakeBench runner failed (exit code ${code ?? 'null'}): ${errSnippet}`,
          'snakebench-service'
        );
        throw new Error(`SnakeBench runner failed (exit code ${code ?? 'null'})`);
      }

      // Parse final result from stdout
      const lines = stdout
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      if (lines.length === 0) {
        throw new Error('SnakeBench runner produced no output');
      }

      const lastLine = lines[lines.length - 1];
      let parsed: any;
      try {
        parsed = JSON.parse(lastLine);
      } catch (err) {
        logger.error(
          `SnakeBench runner output was not valid JSON: ${lastLine.slice(0, 200)}`,
          'snakebench-service'
        );
        throw new Error('Failed to parse SnakeBench runner output');
      }

      if (parsed && typeof parsed === 'object' && parsed.error) {
        throw new Error(String(parsed.error));
      }

      const result: SnakeBenchRunMatchResult = {
        gameId: parsed.game_id ?? parsed.gameId ?? '',
        modelA: parsed.modelA,
        modelB: parsed.modelB,
        scores: parsed.scores ?? {},
        results: parsed.results ?? {},
        completedGamePath: parsed.completed_game_path ?? parsed.completedGamePath,
        playerTiming,
        roundTiming,
      };

      // Fire-and-forget persistence
      await this.persistenceCoordinator.enqueueMatch(
        result,
        prepared.width,
        prepared.height,
        prepared.numApples,
        { modelA: prepared.modelA, modelB: prepared.modelB }
      );

      handlers.onComplete?.(result);
      return result;
    } catch (err) {
      poller.stop();
      const error = err instanceof Error ? err : new Error(String(err));
      handlers.onError?.(error);
      throw error;
    }
  }
}
