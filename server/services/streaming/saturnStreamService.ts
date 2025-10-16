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
import { aiServiceFactory } from '../aiServiceFactory';
import { saturnService } from '../saturnService';
import { puzzleService } from '../puzzleService';
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
    const decodedModelKey = decodeURIComponent(modelKey);
    const isSaturnModel = saturnService.isSaturnModelKey(decodedModelKey);
    const aiService = isSaturnModel
      ? saturnService
      : aiServiceFactory.getService(decodedModelKey);

    if (!aiService?.supportsStreaming?.(decodedModelKey)) {
      logger.warn(
        `[SaturnStream] Streaming requested for unsupported model ${decodedModelKey}`,
        'SaturnStream'
      );
      sseStreamManager.error(
        sessionId,
        'SATURN_STREAMING_UNAVAILABLE',
        `Model ${decodedModelKey} does not support streaming.`
      );
      return;
    }

    sseStreamManager.sendEvent(sessionId, 'stream.status', {
      state: 'starting',
      phase: 'prompt_building',
      message: `Preparing ${decodedModelKey} Saturn prompt...`,
      taskId,
      modelKey: decodedModelKey,
    });

    const harness: StreamingHarness = {
      sessionId,
      emit: (chunk) => sseStreamManager.sendEvent(sessionId, 'stream.chunk', chunk),
      emitEvent: (event, payload) => sseStreamManager.sendEvent(sessionId, event, payload),
      end: async (summary) => {
        // CRITICAL: Save result to database before sending completion
        if (summary && 'responseSummary' in summary) {
          const completion = summary as StreamCompletion;
          if (completion.responseSummary?.analysis) {
            try {
              logger.debug(`[SaturnStream] Saving analysis to database for ${taskId}`, 'SaturnStream');
              await explanationService.saveExplanation(taskId, {
                [decodedModelKey]: completion.responseSummary.analysis
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
        modelKey: decodedModelKey,
      },
    };

    try {
      if (isSaturnModel) {
        const puzzle = await puzzleService.getPuzzleById(taskId);

        const serviceOptions: ServiceOptions = {
          stream: harness,
          captureReasoning: true,
          sessionId,
        };

        if (previousResponseId) serviceOptions.previousResponseId = previousResponseId;
        if (reasoningEffort) serviceOptions.reasoningEffort = reasoningEffort;
        if (reasoningVerbosity) serviceOptions.reasoningVerbosity = reasoningVerbosity;
        if (reasoningSummaryType) serviceOptions.reasoningSummaryType = reasoningSummaryType;

        await saturnService.analyzePuzzleWithStreaming(
          puzzle,
          decodedModelKey,
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
          decodedModelKey,
          {
            temperature,
            promptId,
            captureReasoning: true,
            previousResponseId,
            reasoningEffort,
            reasoningVerbosity,
            reasoningSummaryType,
          },
          harness
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
