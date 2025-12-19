/**
 * Author: gpt-5-codex
 * Date: 2025-11-02T00:00:00Z
 * PURPOSE: Express controller exposing Saturn audio narration endpoints backed by
 * ElevenLabs streaming. Provides status discovery and audio proxying with robust
 * validation and logging.
 * SRP/DRY check: Pass — controller delegates to ElevenLabs service and response formatter.
 */

import type { Request, Response } from 'express';
import { elevenLabsService } from '../services/audio/elevenLabsService.ts';
import { formatResponse } from '../utils/responseFormatter.ts';
import { logger } from '../utils/logger.ts';

class AudioController {
  status = async (_req: Request, res: Response) => {
    const configured = elevenLabsService.isConfigured();

    return res.json(
      formatResponse.success({
        enabled: configured,
        voiceId: configured ? elevenLabsService.getVoiceId() : null,
        modelId: configured ? elevenLabsService.getModelId() : null,
      }),
    );
  };

  narrate = async (req: Request, res: Response) => {
    if (!elevenLabsService.isConfigured()) {
      return res
        .status(503)
        .json(formatResponse.error('service_unavailable', 'ElevenLabs API key not configured for Saturn audio narration.'));
    }

    const { text, voiceId, modelId } = req.body ?? {};

    if (typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json(formatResponse.error('bad_request', 'text is required for narration.'));
    }

    try {
      const { stream, contentType } = await elevenLabsService.streamText(text, { voiceId, modelId });
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Transfer-Encoding', 'chunked');

      return stream.pipe(res);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to stream audio';
      logger.logError(`[SaturnAudio] Narration request failed: ${message}`, { error, context: 'SaturnAudio' });
      if (!res.headersSent) {
        return res.status(502).json(formatResponse.error('bad_gateway', message));
      }
      res.end();
      return undefined;
    }
  };
}

export const audioController = new AudioController();
