/**
 * Author: Cascade (ChatGPT 5.1 Codex)
 * Date: 2026-01-02
 * PURPOSE: Minimal SSE stream manager for Arc3OpenAIRunner (Responses API, no Agents SDK).
 *          Prepares sessions, starts streaming, and routes events via SSEStreamManager.
 * SRP/DRY check: Pass — session orchestration only.
 */

import { nanoid } from "nanoid";
import type { Request } from "express";
import { sseStreamManager } from "../streaming/SSEStreamManager";
import { logger } from "../../utils/logger";
import { Arc3ApiClient, type FrameData } from "./Arc3ApiClient";
import { Arc3OpenAIRunner, type Arc3OpenAIRunConfig } from "./Arc3OpenAIRunner";
import { resolveStreamingConfig } from "@shared/config/streaming";

export interface OpenAIStreamPayload {
  game_id: string;
  model: string;
  instructions: string;
  systemPrompt?: string;
  maxTurns?: number;
  apiKey?: string;
  sessionId?: string;
  createdAt?: number;
  expiresAt?: number;
}

const SESSION_TTL_MS = 15 * 60 * 1000;

export class Arc3OpenAIStreamService {
  private readonly pending = new Map<string, OpenAIStreamPayload>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly apiClient: Arc3ApiClient;
  private readonly runner: Arc3OpenAIRunner;

  constructor() {
    this.apiClient = new Arc3ApiClient(process.env.ARC3_API_KEY || "");
    this.runner = new Arc3OpenAIRunner(this.apiClient);
  }

  savePayload(payload: OpenAIStreamPayload, ttlMs: number = SESSION_TTL_MS): string {
    const sessionId = payload.sessionId ?? nanoid();
    const now = Date.now();
    const enriched: OpenAIStreamPayload = {
      ...payload,
      sessionId,
      createdAt: now,
      expiresAt: now + ttlMs,
    };
    this.pending.set(sessionId, enriched);
    this.scheduleExpiration(sessionId, ttlMs);
    return sessionId;
  }

  getPayload(sessionId: string) {
    return this.pending.get(sessionId);
  }

  clear(sessionId: string) {
    this.pending.delete(sessionId);
    const t = this.timers.get(sessionId);
    if (t) {
      clearTimeout(t);
      this.timers.delete(sessionId);
    }
  }

  private scheduleExpiration(sessionId: string, ttlMs: number) {
    const existing = this.timers.get(sessionId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.pending.delete(sessionId);
      this.timers.delete(sessionId);
      logger.debug(`[Arc3OpenAIStream] Session ${sessionId} expired`, "arc3-openai-stream");
    }, ttlMs);
    if (typeof (timer as any).unref === "function") (timer as any).unref();
    this.timers.set(sessionId, timer);
  }

  async startStreaming(_req: Request, payload: OpenAIStreamPayload): Promise<void> {
    const sessionId = payload.sessionId!;
    if (!sseStreamManager.has(sessionId)) {
      throw new Error("SSE session must be registered before starting streaming.");
    }

    const streamingConfig = resolveStreamingConfig();
    if (!streamingConfig.enabled) {
      sseStreamManager.error(sessionId, "STREAMING_DISABLED", "Streaming disabled on server.");
      return;
    }

    const streamHarness = {
      sessionId,
      emit: (chunk: any) => sseStreamManager.sendEvent(sessionId, "stream.chunk", chunk),
      emitEvent: (event: string, data: any) => sseStreamManager.sendEvent(sessionId, event, data),
      end: (summary: any) => sseStreamManager.close(sessionId, summary),
    };

    const runConfig: Arc3OpenAIRunConfig = {
      game_id: payload.game_id,
      model: payload.model,
      instructions: payload.instructions,
      systemPrompt: payload.systemPrompt,
      maxTurns: payload.maxTurns,
      apiKey: payload.apiKey,
    };

    sseStreamManager.sendEvent(sessionId, "stream.status", { state: "running", game_id: payload.game_id });

    try {
      await this.runner.runWithStreaming(runConfig, streamHarness);
      // Extend TTL slightly for post-run reads
      this.scheduleExpiration(sessionId, 5 * 60 * 1000);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Arc3OpenAI streaming failed: ${message}`, "arc3-openai-stream");
      sseStreamManager.error(sessionId, "STREAMING_ERROR", message);
      this.clear(sessionId);
    }
  }

  cancel(sessionId: string) {
    if (sseStreamManager.has(sessionId)) {
      sseStreamManager.teardown(sessionId, "cancelled");
    }
    this.clear(sessionId);
  }
}

export const arc3OpenAIStreamService = new Arc3OpenAIStreamService();
