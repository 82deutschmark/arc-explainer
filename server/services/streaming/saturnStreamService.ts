/**
 * Author: Cascade
 * Date: 2025-10-15
 * PURPOSE: Coordinates Saturn solver runs over Server-Sent Events so the frontend can render
 * incremental output while the final analysis is persisted to the database.
 * CRITICAL FIX: Now saves streaming results to DB (was missing before!)
 * SRP/DRY check: Pass — dedicated orchestration layer for Saturn streaming.
 * shadcn/ui: Pass — backend logic only.
 */

import { puzzleAnalysisService } from '../puzzleAnalysisService';
import { explanationService } from '../explanationService';
import { sseStreamManager } from './SSEStreamManager';
import { logger } from '../../utils/logger';
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
                [modelKey]: completion.responseSummary.analysis
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
    };

    try {
      await puzzleAnalysisService.analyzePuzzleStreaming(
        taskId,
        modelKey,
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
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.logError(`[SaturnStream] Failed to run streaming analysis: ${message}`, { error, context: 'SaturnStream' });
      sseStreamManager.error(sessionId, 'SATURN_STREAM_ERROR', message);
    }
  }
}

export const saturnStreamService = new SaturnStreamService();
