/**
 * Author: Codex using GPT-5-high
 * Date: 2025-10-10T00:00:00Z
 * PURPOSE: Coordinates Saturn solver runs over Server-Sent Events so the frontend can render
 * incremental output while the final analysis is persisted via the normal pipeline.
 * SRP/DRY check: Pass — dedicated orchestration layer for Saturn streaming.
 * shadcn/ui: Pass — backend logic only.
 */

import { puzzleAnalysisService } from '../puzzleAnalysisService';
import { sseStreamManager } from './SSEStreamManager';
import { logger } from '../../utils/logger';
import type { ServiceOptions } from '../base/BaseAIService';
import type { StreamingHarness } from '../base/BaseAIService';

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
      end: (summary) => sseStreamManager.close(sessionId, summary),
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
      logger.error(`[SaturnStream] Failed to run streaming analysis: ${message}`, error);
      sseStreamManager.error(sessionId, 'SATURN_STREAM_ERROR', message);
    }
  }
}

export const saturnStreamService = new SaturnStreamService();
