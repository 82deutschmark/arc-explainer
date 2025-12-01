/**
 * Author: Cascade
 * Date: 2025-12-01
 * PURPOSE: Coordinates Beetree solver runs over Server-Sent Events for real-time frontend updates.
 * Manages ensemble solver execution with stage orchestration, cost tracking, and consensus analysis.
 * Aligns with existing streaming patterns while handling Beetree-specific multi-model orchestration.
 * SRP/DRY check: Pass — reuses streaming patterns from saturnStreamService and analysisStreamService.
 */

import { puzzleAnalysisService } from '../puzzleAnalysisService';
import { explanationService } from '../explanationService';
import { sseStreamManager } from './SSEStreamManager';
import { logger } from '../../utils/logger';
import { aiServiceFactory } from '../aiServiceFactory';
import { beetreeService } from '../beetreeService';
import { puzzleService } from '../puzzleService';
import { validateStreamingResult } from '../streamingValidator';
import type { ServiceOptions } from '../base/BaseAIService';
import type { StreamingHarness, StreamCompletion } from '../base/BaseAIService';
import type { BeetreeRunConfig, BeetreeBridgeEvent } from '../../../shared/types';

interface BeetreeStreamParams {
  sessionId: string;
  taskId: string;
  testIndex: number;
  mode: 'testing' | 'production';
  runTimestamp?: string;
  abortSignal?: AbortSignal;
}

interface BeetreeStreamState {
  sessionId: string;
  taskId: string;
  testIndex: number;
  mode: string;
  runTimestamp: string;
  startTime: number;
  lastEventTime: number;
  isComplete: boolean;
  totalCost: number;
  currentStage: string;
  modelPredictions: Array<{
    modelName: string;
    prediction: number[][];
    confidence: number;
    stage: string;
  }>;
  consensusStrength: number;
  diversityScore: number;
  error?: string;
}

class BeetreeStreamService {
  private activeStreams = new Map<string, BeetreeStreamState>();

  async startStreaming({
    sessionId,
    taskId,
    testIndex,
    mode,
    runTimestamp,
    abortSignal,
  }: BeetreeStreamParams): Promise<void> {
    const streamKey = `beetree-${sessionId}`;
    const timestamp = runTimestamp || new Date().toISOString();

    // Initialize stream state
    const streamState: BeetreeStreamState = {
      sessionId,
      taskId,
      testIndex,
      mode,
      runTimestamp: timestamp,
      startTime: Date.now(),
      lastEventTime: Date.now(),
      isComplete: false,
      totalCost: 0,
      currentStage: 'initialization',
      modelPredictions: [],
      consensusStrength: 0,
      diversityScore: 0,
    };

    this.activeStreams.set(streamKey, streamState);

    try {
      // Register SSE stream
      await sseStreamManager.createStream(streamKey, {
        onConnect: (clientId) => {
          logger.info(`Client ${clientId} connected to Beetree stream ${streamKey}`, 'beetree-stream');
          // Send initial state
          sseStreamManager.sendEvent(streamKey, 'stream_start', {
            sessionId,
            taskId,
            testIndex,
            mode,
            timestamp: Date.now(),
          });
        },
        onDisconnect: (clientId) => {
          logger.info(`Client ${clientId} disconnected from Beetree stream ${streamKey}`, 'beetree-stream');
        },
      });

      // Get puzzle data
      const puzzle = await puzzleService.getPuzzleById(taskId);
      if (!puzzle) {
        throw new Error(`Puzzle ${taskId} not found`);
      }

      // Validate test index
      if (testIndex < 0 || testIndex >= puzzle.test.length) {
        throw new Error(`Invalid test index ${testIndex} for puzzle ${taskId}`);
      }

      // Send puzzle validation event
      sseStreamManager.sendEvent(streamKey, 'puzzle_validated', {
        taskId,
        testIndex,
        gridSize: {
          input: puzzle.test[testIndex].input.length,
          output: puzzle.test[testIndex].output?.length || 0,
        },
        timestamp: Date.now(),
      });

      // Configure Beetree run options
      const beetreeConfig: BeetreeRunConfig = {
        taskId,
        testIndex,
        mode,
        runTimestamp: timestamp,
      };

      // Start Beetree analysis with event handling
      await beetreeService.analyzePuzzleWithModel(
        'beetree-ensemble', // Model key for Beetree ensemble
        puzzle,
        {
          testIndex,
          mode,
          runTimestamp: timestamp,
          onProgress: (event: BeetreeBridgeEvent) => {
            this.handleBeetreeEvent(streamKey, streamState, event);
          },
          abortSignal,
        } as ServiceOptions
      );

      // Mark stream as complete
      streamState.isComplete = true;
      streamState.lastEventTime = Date.now();

      // Send completion event
      sseStreamManager.sendEvent(streamKey, 'stream_complete', {
        sessionId,
        taskId,
        testIndex,
        mode,
        totalCost: streamState.totalCost,
        consensusStrength: streamState.consensusStrength,
        diversityScore: streamState.diversityScore,
        duration: Date.now() - streamState.startTime,
        timestamp: Date.now(),
      });

      logger.info(`Beetree stream ${streamKey} completed successfully`, 'beetree-stream');

    } catch (error) {
      streamState.error = error instanceof Error ? error.message : String(error);
      streamState.isComplete = true;
      streamState.lastEventTime = Date.now();

      // Send error event
      sseStreamManager.sendEvent(streamKey, 'stream_error', {
        sessionId,
        taskId,
        testIndex,
        mode,
        error: streamState.error,
        timestamp: Date.now(),
      });

      logger.error(`Beetree stream ${streamKey} failed: ${streamState.error}`, 'beetree-stream');
    } finally {
      // Clean up stream after delay
      setTimeout(() => {
        this.cleanupStream(streamKey);
      }, 5000); // Keep stream alive for 5 seconds for final events
    }
  }

  private handleBeetreeEvent(
    streamKey: string,
    streamState: BeetreeStreamState,
    event: BeetreeBridgeEvent
  ): void {
    streamState.lastEventTime = Date.now();

    switch (event.type) {
      case 'start':
        sseStreamManager.sendEvent(streamKey, 'solver_start', {
          message: event.message,
          metadata: event.metadata,
          timestamp: event.timestamp || Date.now(),
        });
        break;

      case 'progress':
        streamState.currentStage = event.stage;
        
        // Update cost if provided
        if (event.costSoFar !== undefined) {
          streamState.totalCost = event.costSoFar;
        }

        // Handle predictions if provided
        if (event.predictions) {
          // Convert predictions to our internal format
          event.predictions.forEach((prediction, index) => {
            streamState.modelPredictions.push({
              modelName: `model_${index + 1}_${event.stage}`,
              prediction,
              confidence: 0.8, // Default confidence
              stage: event.stage,
            });
          });
        }

        sseStreamManager.sendEvent(streamKey, 'solver_progress', {
          stage: event.stage,
          status: event.status,
          outcome: event.outcome,
          event: event.event,
          costSoFar: streamState.totalCost,
          tokensUsed: event.tokensUsed,
          predictions: event.predictions,
          timestamp: event.timestamp,
        });
        break;

      case 'log':
        sseStreamManager.sendEvent(streamKey, 'solver_log', {
          level: event.level,
          message: event.message,
          timestamp: Date.now(),
        });
        break;

      case 'final':
        if (event.success && event.result) {
          // Update final state from result
          streamState.totalCost = event.result.costBreakdown.total_cost;
          streamState.consensusStrength = event.result.consensus.consensus_strength;
          streamState.diversityScore = event.result.consensus.diversity_score;
          streamState.currentStage = 'completed';

          // Convert final predictions
          if (event.result.predictions) {
            streamState.modelPredictions = event.result.predictions.map((pred, index) => ({
              modelName: `model_${index + 1}_final`,
              prediction: pred,
              confidence: 0.9,
              stage: 'final',
            }));
          }
        }

        sseStreamManager.sendEvent(streamKey, 'solver_complete', {
          success: event.success,
          result: event.result,
          timingMs: event.timingMs,
          timestamp: Date.now(),
        });
        break;

      case 'error':
        streamState.error = event.message;
        sseStreamManager.sendEvent(streamKey, 'solver_error', {
          message: event.message,
          timestamp: Date.now(),
        });
        break;
    }
  }

  private cleanupStream(streamKey: string): void {
    const streamState = this.activeStreams.get(streamKey);
    if (streamState) {
      logger.info(`Cleaning up Beetree stream ${streamKey}`, 'beetree-stream');
      this.activeStreams.delete(streamKey);
      sseStreamManager.closeStream(streamKey);
    }
  }

  getStreamState(sessionId: string): BeetreeStreamState | null {
    return this.activeStreams.get(`beetree-${sessionId}`) || null;
  }

  getActiveStreams(): BeetreeStreamState[] {
    return Array.from(this.activeStreams.values());
  }

  async cancelStream(sessionId: string): Promise<void> {
    const streamKey = `beetree-${sessionId}`;
    const streamState = this.activeStreams.get(streamKey);
    
    if (streamState && !streamState.isComplete) {
      streamState.error = 'Stream cancelled by user';
      streamState.isComplete = true;
      
      sseStreamManager.sendEvent(streamKey, 'stream_cancelled', {
        sessionId,
        timestamp: Date.now(),
      });
      
      this.cleanupStream(streamKey);
      logger.info(`Beetree stream ${streamKey} cancelled by user`, 'beetree-stream');
    }
  }
}

export const beetreeStreamService = new BeetreeStreamService();
