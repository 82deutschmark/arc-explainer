/**
 * Author: gpt-5-codex
 * Date: 2025-11-02T00:00:00Z
 * PURPOSE: Wraps ElevenLabs text-to-speech streaming so Saturn can narrate reasoning
 * without exposing secrets to the client. Provides status helpers for controllers
 * and streams audio directly to Express responses.
 * SRP/DRY check: Pass — isolates ElevenLabs integration details from controllers.
 */

import { Readable } from 'node:stream';
import { logger } from '../../utils/logger.ts';

const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel
const DEFAULT_MODEL_ID = 'eleven_turbo_v2_5';

export interface ElevenLabsStreamOptions {
  voiceId?: string;
  modelId?: string;
  optimizeLatency?: 0 | 1 | 2 | 3 | 4 | 5;
}

export interface ElevenLabsStreamResult {
  stream: Readable;
  contentType: string;
}

class ElevenLabsService {
  isConfigured(): boolean {
    return Boolean(process.env.ELEVENLABS_API_KEY);
  }

  getVoiceId(): string {
    return process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;
  }

  getModelId(): string {
    return process.env.ELEVENLABS_MODEL_ID || DEFAULT_MODEL_ID;
  }

  private getApiKey(): string {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error('ElevenLabs API key not configured');
    }
    return apiKey;
  }

  async streamText(text: string, opts: ElevenLabsStreamOptions = {}): Promise<ElevenLabsStreamResult> {
    if (!text?.trim()) {
      throw new Error('Text is required for ElevenLabs streaming');
    }

    const apiKey = this.getApiKey();
    const voiceId = opts.voiceId || this.getVoiceId();
    const modelId = opts.modelId || this.getModelId();
    const optimizeLatency = opts.optimizeLatency ?? 3;

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`;

    const body = JSON.stringify({
      text,
      model_id: modelId,
      optimize_streaming_latency: optimizeLatency,
      voice_settings: {
        stability: 0.4,
        similarity_boost: 0.8,
      },
    });

    logger.debug(`Streaming ElevenLabs audio (voice=${voiceId}, model=${modelId}, latency=${optimizeLatency})`, 'ElevenLabs');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
        'xi-api-key': apiKey,
      },
      body,
    });

    if (!response.ok || !response.body) {
      const payload = await response.text().catch(() => '');
      const message = `ElevenLabs request failed (${response.status} ${response.statusText}) ${payload}`;
      logger.error(message, 'ElevenLabs');
      throw new Error(message);
    }

    const nodeStream = Readable.fromWeb(response.body as unknown as ReadableStream<Uint8Array>);

    return {
      stream: nodeStream,
      contentType: response.headers.get('content-type') || 'audio/mpeg',
    };
  }
}

export const elevenLabsService = new ElevenLabsService();
