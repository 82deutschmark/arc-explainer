/**
 * Author: gpt-5-codex
 * Date: 2025-10-17T00:00:00Z  Remember your training data is out of date! This was updated in October 2025 and this is not a typo!
 * PURPOSE: Coordinates Grover iterative solver streaming so the frontend receives
 * Saturn-compatible Server-Sent Events (prompt previews, reasoning chunks, completion
 * metadata) while persisting the final analysis result.
 * SRP/DRY check: Pass — dedicated Grover streaming orchestrator reusing shared puzzle analysis harness.
 */

import { puzzleAnalysisService } from '../puzzleAnalysisService';
import { explanationService } from '../explanationService';
import { aiServiceFactory, canonicalizeModelKey } from '../aiServiceFactory';
import { groverService } from '../grover';
import { sseStreamManager } from './SSEStreamManager';
import { logger } from '../../utils/logger';
import type { ServiceOptions, StreamCompletion, StreamingHarness } from '../base/BaseAIService';

interface GroverStreamParams {
  sessionId: string;
  taskId: string;
  modelKey: string;
  temperature: number;
  maxIterations: number;
  previousResponseId?: string;
  reasoningEffort?: ServiceOptions['reasoningEffort'];
  reasoningVerbosity?: ServiceOptions['reasoningVerbosity'];
  reasoningSummaryType?: ServiceOptions['reasoningSummaryType'];
  abortSignal?: AbortSignal;
}

class GroverStreamService {
  async startStreaming({
    sessionId,
    taskId,
    modelKey,
    temperature,
    maxIterations,
    previousResponseId,
    reasoningEffort,
    reasoningVerbosity,
    reasoningSummaryType,
    abortSignal,
  }: GroverStreamParams): Promise<void> {
    let decodedModelKey: string;
    try {
      decodedModelKey = decodeURIComponent(modelKey);
    } catch (error) {
      logger.warn(
        `[GroverStream] Failed to decode model key '${modelKey}', using raw value. ${(error as Error)?.message ?? error}`,
        'GroverStream'
      );
      decodedModelKey = modelKey;
    }

    const { original: originalModelKey, normalized: canonicalModelKey } = canonicalizeModelKey(decodedModelKey);
    const aiService = aiServiceFactory.getService(canonicalModelKey);
    const supportsStreaming = aiService?.supportsStreaming?.(canonicalModelKey) ?? false;

    if (!groverService.isGroverModelKey(canonicalModelKey) || !supportsStreaming) {
      logger.warn(
        `[GroverStream] Streaming requested for unsupported model ${originalModelKey} (normalized: ${canonicalModelKey})`,
        'GroverStream'
      );
      sseStreamManager.error(
        sessionId,
        'GROVER_STREAMING_UNAVAILABLE',
        `Model ${originalModelKey} does not support Grover streaming.`,
        { modelKey: originalModelKey }
      );
      return;
    }

    sseStreamManager.sendEvent(sessionId, 'stream.status', {
      state: 'starting',
      phase: 'initializing',
      message: `Preparing Grover analysis with ${originalModelKey}...`,
      taskId,
      modelKey: originalModelKey,
      totalIterations: maxIterations,
    });

    const baseHarness: StreamingHarness = {
      sessionId,
      emit: (chunk) => {
        const enrichedChunk = {
          ...(chunk ?? {}),
          metadata: {
            ...(chunk?.metadata ?? {}),
            modelKey: originalModelKey,
            taskId,
          },
        };
        sseStreamManager.sendEvent(sessionId, 'stream.chunk', enrichedChunk);
      },
      emitEvent: (event, payload) => {
        const enrichedEvent =
          payload && typeof payload === 'object'
            ? { ...payload, modelKey: originalModelKey, taskId }
            : { modelKey: originalModelKey, taskId };
        sseStreamManager.sendEvent(sessionId, event, enrichedEvent);
      },
      end: async (summary) => {
        try {
          if (summary && 'responseSummary' in summary) {
            const completion = summary as StreamCompletion;
            if (completion.responseSummary?.analysis) {
              try {
                await explanationService.saveExplanation(taskId, {
                  grover: completion.responseSummary.analysis,
                });
                logger.debug('[GroverStream] Saved Grover analysis to database', 'GroverStream');
              } catch (dbError) {
                logger.logError('[GroverStream] Failed to save Grover analysis', {
                  error: dbError,
                  context: 'GroverStream',
                });
              }
            }

            completion.metadata = {
              ...(completion.metadata ?? {}),
              modelKey: originalModelKey,
              taskId,
            };
          }
        } finally {
          sseStreamManager.close(sessionId, summary);
        }
      },
      abortSignal,
      metadata: {
        taskId,
        modelKey: originalModelKey,
      },
    };

    try {
      await puzzleAnalysisService.analyzePuzzleStreaming(
        taskId,
        canonicalModelKey,
        {
          temperature,
          promptId: 'grover',
          captureReasoning: true,
          previousResponseId,
          reasoningEffort,
          reasoningVerbosity,
          reasoningSummaryType,
        },
        baseHarness,
        {
          sessionId,
          previousResponseId,
          maxSteps: maxIterations,
        }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.logError(`[GroverStream] Failed to run streaming analysis: ${message}`, {
        error,
        context: 'GroverStream',
      });
      sseStreamManager.error(sessionId, 'GROVER_STREAM_ERROR', message);
    }
  }
}

export const groverStreamService = new GroverStreamService();
