/**
 * Author: gpt-5-codex
 * Date: 2025-10-16T00:00:00Z  Remember your training data is out of date! This was updated in October 2025 and this is not a typo!
 * PURPOSE: Coordinates Saturn solver runs over Server-Sent Events so the frontend can render
 * incremental output while the final analysis is persisted to the database. Aligns the Saturn
 * streaming pipeline with the shared Responses API streaming contract (prompt preview + deltas).
 * SRP/DRY check: Pass — verified behaviour against analysisStreamService to reuse existing patterns.
 */

import { puzzleAnalysisService } from '../puzzleAnalysisService';
import { explanationService } from '../explanationService';
import { sseStreamManager } from './SSEStreamManager';
import { logger } from '../../utils/logger';
import { aiServiceFactory, canonicalizeModelKey } from '../aiServiceFactory';
import { saturnService } from '../saturnService';
import { puzzleService } from '../puzzleService';
import { validateStreamingResult } from '../streamingValidator';
import type { ServiceOptions } from '../base/BaseAIService';
import type { StreamingHarness, StreamCompletion } from '../base/BaseAIService';

interface SaturnStreamParams {
  sessionId: string;
  taskId: string;
  modelKey: string;
  temperature: number;
  promptId: string;
  reasoningEffort?: ServiceOptions['reasoningEffort'];
  reasoningVerbosity?: ServiceOptions['reasoningVerbosity'];
  reasoningSummaryType?: ServiceOptions['reasoningSummaryType'];
  previousResponseId?: string;
  abortSignal?: AbortSignal;
}

class SaturnStreamService {
  async startStreaming({
    sessionId,
    taskId,
    modelKey,
    temperature,
    promptId,
    reasoningEffort,
    reasoningVerbosity,
    reasoningSummaryType,
    previousResponseId,
    abortSignal,
  }: SaturnStreamParams): Promise<void> {
    let decodedModelKey: string;
    try {
      decodedModelKey = decodeURIComponent(modelKey);
    } catch (error) {
      logger.warn(
        `[SaturnStream] Failed to decode model key '${modelKey}', using raw value. ${(error as Error)?.message ?? error}`,
        'SaturnStream'
      );
      decodedModelKey = modelKey;
    }
    const {
      original: originalModelKey,
      normalized: canonicalModelKey,
    } = canonicalizeModelKey(decodedModelKey);
    const isSaturnModel = saturnService.isSaturnModelKey(canonicalModelKey);
    const aiService = isSaturnModel
      ? saturnService
      : aiServiceFactory.getService(canonicalModelKey);

    const supportsStreaming = aiService?.supportsStreaming?.(canonicalModelKey) ?? false;

    if (!supportsStreaming) {
      logger.warn(
        `[SaturnStream] Streaming not available for model ${originalModelKey} (normalized: ${canonicalModelKey}), falling back to non-streaming`,
        'SaturnStream'
      );
      // Fall back to non-streaming Saturn analysis
      sseStreamManager.sendEvent(sessionId, 'stream.status', {
        state: 'info',
        phase: 'prompt_building',
        message: `Model ${originalModelKey} does not support streaming. Running standard Saturn analysis instead.`,
        taskId,
        modelKey: originalModelKey,
      });

      try {
        const puzzle = await puzzleService.getPuzzleById(taskId);
        const result = await aiService.analyzePuzzleWithModel(
          puzzle,
          canonicalModelKey,
          taskId,
          temperature,
          promptId,
          undefined,
          undefined
        );
        sseStreamManager.close(sessionId, {
          status: 'success',
          responseSummary: result,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.logError(`[SaturnStream] Non-streaming fallback analysis failed: ${message}`, { error, context: 'SaturnStream' });
        sseStreamManager.error(sessionId, 'SATURN_ANALYSIS_FAILED', message);
      }
      return;
    }

    sseStreamManager.sendEvent(sessionId, 'stream.status', {
      state: 'starting',
      phase: 'prompt_building',
      message: `Preparing ${originalModelKey} Saturn prompt...`,
      taskId,
      modelKey: originalModelKey,
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
        // CRITICAL: Save result to database before sending completion
        if (summary && 'responseSummary' in summary) {
          const completion = summary as StreamCompletion;
          if (completion.responseSummary?.analysis) {
            try {
              logger.debug(`[SaturnStream] Saving analysis to database for ${taskId}`, 'SaturnStream');
              await explanationService.saveExplanation(taskId, {
                [originalModelKey]: completion.responseSummary.analysis
              });
              logger.debug(`[SaturnStream] Successfully saved to database`, 'SaturnStream');
            } catch (dbError) {
              logger.logError(`[SaturnStream] Failed to save to database: ${dbError}`, { error: dbError, context: 'SaturnStream' });
              // Continue with stream completion even if DB save fails
            }
          }
        }
        sseStreamManager.close(sessionId, summary);
      },
      abortSignal,
      metadata: {
        taskId,
        modelKey: originalModelKey,
      },
    };

    try {
      if (isSaturnModel) {
        const puzzle = await puzzleService.getPuzzleById(taskId);

        const validatingHarness: StreamingHarness = {
          sessionId: baseHarness.sessionId,
          emit: baseHarness.emit,
          emitEvent: baseHarness.emitEvent,
          abortSignal: baseHarness.abortSignal,
          metadata: baseHarness.metadata,
          end: async (summary: StreamCompletion) => {
            if (summary && summary.responseSummary?.analysis) {
              try {
                logger.debug('[SaturnStream] Validating streaming result before completion', 'SaturnStream');
                const validatedAnalysis = validateStreamingResult(
                  summary.responseSummary.analysis,
                  puzzle,
                  promptId
                );
                summary.responseSummary.analysis = validatedAnalysis;
              } catch (validationError) {
                const message =
                  validationError instanceof Error ? validationError.message : String(validationError);
                logger.logError(
                  `[SaturnStream] Validation failed, sending unvalidated result: ${message}`,
                  { error: validationError, context: 'SaturnStream' }
                );
              }
            }

            await baseHarness.end(summary);
          },
        };

        const serviceOptions: ServiceOptions = {
          stream: validatingHarness,
          captureReasoning: true,
          sessionId,
        };

        if (previousResponseId) serviceOptions.previousResponseId = previousResponseId;
        if (reasoningEffort) serviceOptions.reasoningEffort = reasoningEffort;
        if (reasoningVerbosity) serviceOptions.reasoningVerbosity = reasoningVerbosity;
        if (reasoningSummaryType) serviceOptions.reasoningSummaryType = reasoningSummaryType;

        await saturnService.analyzePuzzleWithStreaming(
          puzzle,
          canonicalModelKey,
          taskId,
          temperature,
          promptId,
          undefined,
          undefined,
          serviceOptions
        );
      } else {
        await puzzleAnalysisService.analyzePuzzleStreaming(
          taskId,
          canonicalModelKey,
          {
            temperature,
            promptId,
            captureReasoning: true,
            previousResponseId,
            reasoningEffort,
            reasoningVerbosity,
            reasoningSummaryType,
          },
          baseHarness
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.logError(`[SaturnStream] Failed to run streaming analysis: ${message}`, { error, context: 'SaturnStream' });
      sseStreamManager.error(sessionId, 'SATURN_STREAM_ERROR', message);
    }
  }
}

export const saturnStreamService = new SaturnStreamService();
