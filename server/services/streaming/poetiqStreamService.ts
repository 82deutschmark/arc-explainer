/**
 * Author: Cascade
 * Date: 2025-12-03
 * PURPOSE: Coordinates Poetiq solver runs over Server-Sent Events for real-time frontend updates.
 * Replaces WebSocket-based streaming with SSE for consistency with Saturn and Beetree solvers.
 * Manages Python subprocess events, token/cost tracking, and expert progress.
 * SRP/DRY check: Pass — reuses streaming patterns from saturnStreamService and beetreeStreamService.
 */

import { sseStreamManager } from './SSEStreamManager.js';
import { logger } from '../../utils/logger.js';
import { poetiqService } from '../poetiq/poetiqService.js';
import { puzzleLoader } from '../puzzleLoader.js';
import type { PoetiqBridgeEvent, PoetiqOptions, PoetiqResult } from '../poetiq/poetiqService.js';

interface PoetiqStreamParams {
  sessionId: string;
  taskId: string;
  options: PoetiqOptions;
  abortSignal?: AbortSignal;
}

interface PoetiqStreamState {
  sessionId: string;
  taskId: string;
  startTime: number;
  lastEventTime: number;
  isComplete: boolean;
  totalCost: number;
  currentPhase: string;
  currentIteration: number;
  currentExpert?: number;
  expertStates: Map<number, {
    iteration: number;
    status: string;
    passCount: number;
    failCount: number;
    tokens: { input: number; output: number; total: number };
    cost: number;
  }>;
  error?: string;
}

class PoetiqStreamService {
  private activeStreams = new Map<string, PoetiqStreamState>();

  async startStreaming({
    sessionId,
    taskId,
    options,
    abortSignal,
  }: PoetiqStreamParams): Promise<PoetiqResult | null> {
    const streamKey = `poetiq-${sessionId}`;
    
    console.log(`[poetiqStreamService] startStreaming called with sessionId=${sessionId}, taskId=${taskId}`);

    // Load puzzle
    const task = await puzzleLoader.loadPuzzle(taskId);
    if (!task) {
      sseStreamManager.error(streamKey, 'PUZZLE_NOT_FOUND', `Puzzle ${taskId} not found`);
      return null;
    }

    // Initialize stream state
    const streamState: PoetiqStreamState = {
      sessionId,
      taskId,
      startTime: Date.now(),
      lastEventTime: Date.now(),
      isComplete: false,
      totalCost: 0,
      currentPhase: 'initializing',
      currentIteration: 0,
      expertStates: new Map(),
    };

    this.activeStreams.set(streamKey, streamState);

    // Send initial stream status
    sseStreamManager.sendEvent(streamKey, 'stream.status', {
      state: 'starting',
      phase: 'initializing',
      message: `Starting Poetiq solver for ${taskId}...`,
      taskId,
      config: {
        model: options.model,
        numExperts: options.numExperts,
        maxIterations: options.maxIterations,
        temperature: options.temperature,
      },
      timestamp: Date.now(),
    });

    try {
      // Run solver with event callback that forwards to SSE
      const result = await poetiqService.solvePuzzle(
        taskId,
        task,
        { ...options, sessionId }, // Include sessionId for internal tracking
        (event: PoetiqBridgeEvent) => {
          this.handleBridgeEvent(streamKey, streamState, event);
        }
      );

      // Mark stream as complete
      streamState.isComplete = true;
      streamState.lastEventTime = Date.now();

      // Send completion event
      sseStreamManager.sendEvent(streamKey, 'stream.complete', {
        sessionId,
        taskId,
        success: result.success,
        isPredictionCorrect: result.isPredictionCorrect,
        accuracy: result.accuracy,
        iterationCount: result.iterationCount,
        bestTrainScore: result.bestTrainScore,
        generatedCode: result.generatedCode,
        elapsedMs: result.elapsedMs,
        totalCost: streamState.totalCost,
        tokenUsage: (result as any).tokenUsage,
        cost: (result as any).cost,
        expertBreakdown: (result as any).expertBreakdown,
        duration: Date.now() - streamState.startTime,
        timestamp: Date.now(),
      });

      logger.info(`Poetiq stream ${streamKey} completed successfully`, 'poetiq-stream');

      return result;

    } catch (error) {
      streamState.error = error instanceof Error ? error.message : String(error);
      streamState.isComplete = true;
      streamState.lastEventTime = Date.now();

      // Send error event
      sseStreamManager.sendEvent(streamKey, 'stream.error', {
        sessionId,
        taskId,
        code: 'SOLVER_ERROR',
        message: streamState.error,
        timestamp: Date.now(),
      });

      logger.error(`Poetiq stream ${streamKey} failed: ${streamState.error}`, 'poetiq-stream');
      return null;

    } finally {
      // Clean up stream after delay
      setTimeout(() => {
        this.cleanupStream(streamKey);
      }, 5000);
    }
  }

  private handleBridgeEvent(
    streamKey: string,
    streamState: PoetiqStreamState,
    event: PoetiqBridgeEvent
  ): void {
    streamState.lastEventTime = Date.now();
    const timestamp = Date.now();

    switch (event.type) {
      case 'start':
        sseStreamManager.sendEvent(streamKey, 'solver.start', {
          message: `Poetiq solver starting...`,
          metadata: (event as any).metadata,
          timestamp,
        });
        break;

      case 'progress': {
        streamState.currentPhase = event.phase;
        streamState.currentIteration = event.iteration;
        if (event.expert !== undefined) {
          streamState.currentExpert = event.expert;
        }

        // Update expert state if we have expert data
        if (event.expert !== undefined) {
          const expertId = event.expert;
          const existing = streamState.expertStates.get(expertId) || {
            iteration: 0,
            status: 'idle',
            passCount: 0,
            failCount: 0,
            tokens: { input: 0, output: 0, total: 0 },
            cost: 0,
          };

          // Update from event data
          existing.iteration = event.iteration;
          existing.status = event.phase;

          if ((event as any).tokenUsage) {
            const tu = (event as any).tokenUsage;
            existing.tokens = {
              input: tu.input_tokens || 0,
              output: tu.output_tokens || 0,
              total: tu.total_tokens || 0,
            };
          }

          if ((event as any).cost?.total) {
            existing.cost = (event as any).cost.total;
          }

          if (event.trainResults) {
            existing.passCount = event.trainResults.filter((r: any) => r.success).length;
            existing.failCount = event.trainResults.filter((r: any) => !r.success).length;
          }

          streamState.expertStates.set(expertId, existing);
        }

        // Update total cost
        if ((event as any).globalCost?.total) {
          streamState.totalCost = (event as any).globalCost.total;
        }

        // Send progress event with all relevant data
        sseStreamManager.sendEvent(streamKey, 'solver.progress', {
          phase: event.phase,
          iteration: event.iteration,
          expert: event.expert,
          message: event.message,
          code: event.code,
          reasoning: event.reasoning,
          reasoningSummary: event.reasoningSummary,
          trainResults: event.trainResults,
          promptData: event.promptData,
          tokenUsage: (event as any).tokenUsage,
          cost: (event as any).cost,
          expertCumulativeTokens: (event as any).expertCumulativeTokens,
          expertCumulativeCost: (event as any).expertCumulativeCost,
          globalTokens: (event as any).globalTokens,
          globalCost: (event as any).globalCost,
          // Expert states snapshot
          expertStates: Object.fromEntries(
            Array.from(streamState.expertStates.entries()).map(([id, state]) => [
              id,
              {
                expertId: id,
                ...state,
              },
            ])
          ),
          timestamp: (event as any).timestamp || timestamp,
        });
        break;
      }

      case 'log':
        sseStreamManager.sendEvent(streamKey, 'solver.log', {
          level: event.level,
          message: event.message,
          timestamp,
        });
        break;

      case 'error':
        streamState.error = event.message;
        sseStreamManager.sendEvent(streamKey, 'solver.error', {
          message: event.message,
          traceback: event.traceback,
          timestamp,
        });
        break;

      case 'final':
        // Final event handled by the main try block
        break;
    }
  }

  private cleanupStream(streamKey: string): void {
    const streamState = this.activeStreams.get(streamKey);
    if (streamState) {
      logger.info(`Cleaning up Poetiq stream ${streamKey}`, 'poetiq-stream');
      this.activeStreams.delete(streamKey);
    }
  }

  getStreamState(sessionId: string): PoetiqStreamState | null {
    return this.activeStreams.get(`poetiq-${sessionId}`) || null;
  }

  getActiveStreams(): PoetiqStreamState[] {
    return Array.from(this.activeStreams.values());
  }

  hasActiveStream(sessionId: string): boolean {
    return sseStreamManager.has(`poetiq-${sessionId}`);
  }

  registerConnection(sessionId: string, res: import('express').Response): void {
    const streamKey = `poetiq-${sessionId}`;
    sseStreamManager.register(streamKey, res);
  }
}

export const poetiqStreamService = new PoetiqStreamService();
