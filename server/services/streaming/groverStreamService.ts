/**
 * Author: Codex using GPT-5-high
 * Date: 2025-10-10T00:00:00Z
 * PURPOSE: Coordinates Grover iterative solver runs over Server-Sent Events, mirroring the
 * Saturn streaming orchestrator so the frontend can display live iteration updates.
 * SRP/DRY check: Pass — dedicated streaming coordinator for Grover.
 * shadcn/ui: Pass — backend logic only.
 */

import { puzzleAnalysisService } from '../puzzleAnalysisService';
import { sseStreamManager } from './SSEStreamManager';
import { logger } from '../../utils/logger';
import type { ServiceOptions } from '../base/BaseAIService';
import type { StreamingHarness } from '../base/BaseAIService';

interface GroverStreamParams {
  sessionId: string;
  taskId: string;
  modelKey: string;
  temperature: number;
  maxIterations: number;
  previousResponseId?: string;
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
    abortSignal,
  }: GroverStreamParams): Promise<void> {
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
          promptId: 'grover',
          captureReasoning: true,
          previousResponseId,
          maxSteps: maxIterations,
        },
        harness,
        {
          sessionId,
          previousResponseId,
          maxSteps: maxIterations,
        }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[GroverStream] Failed to run streaming analysis: ${message}`, error);
      sseStreamManager.error(sessionId, 'GROVER_STREAM_ERROR', message);
    }
  }
}

export const groverStreamService = new GroverStreamService();
