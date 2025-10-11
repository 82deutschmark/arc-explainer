/**
 * 
 * Author: Codex using GPT-5-high
 * Date: 2025-10-09T00:00:00Z
 * PURPOSE: Manages Server-Sent Event connections for analysis streaming, providing registration, heartbeats, event emission, and cleanup across multiple sessions.
 * SRP/DRY check: Pass — no existing SSE session registry.
 * shadcn/ui: Pass — backend infrastructure only.
 */

import type { Response } from "express";
import { logger } from "../../utils/logger";
import type { StreamCompletion } from "../base/BaseAIService";

export interface SSEStreamConnection {
  sessionId: string;
  response: Response;
  createdAt: number;
  heartbeat?: NodeJS.Timeout;
  closed: boolean;
}

class SSEStreamManager {
  private connections: Map<string, SSEStreamConnection> = new Map();
  private readonly heartbeatIntervalMs = 15000;

  register(sessionId: string, res: Response): SSEStreamConnection {
    const existing = this.connections.get(sessionId);
    if (existing) {
      this.teardown(sessionId, "duplicate-session");
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    if (typeof res.flushHeaders === "function") {
      res.flushHeaders();
    }

    const connection: SSEStreamConnection = {
      sessionId,
      response: res,
      createdAt: Date.now(),
      closed: false,
    };

    connection.heartbeat = setInterval(() => {
      this.sendComment(sessionId, "keep-alive");
    }, this.heartbeatIntervalMs);

    res.on("close", () => {
      this.teardown(sessionId, "client-disconnect");
    });

    this.connections.set(sessionId, connection);
    return connection;
  }

  sendEvent<T>(sessionId: string, event: string, payload: T): void {
    const connection = this.connections.get(sessionId);
    if (!connection || connection.closed) {
      // Silently ignore - this is normal when async operations complete after stream ends
      return;
    }

    try {
      const serialized = JSON.stringify(payload ?? {});
      connection.response.write(`event: ${event}\n`);
      connection.response.write(`data: ${serialized}\n\n`);
    } catch (error) {
      // Connection may have closed between the check and write - this is fine
      logger.debug(`Failed to send event to ${sessionId}: ${error}`, "sse-manager");
    }
  }

  sendChunk(sessionId: string, chunk: string): void {
    const connection = this.connections.get(sessionId);
    if (!connection || connection.closed) {
      // Silently ignore - this is normal when async operations complete after stream ends
      return;
    }
    try {
      connection.response.write(chunk.endsWith("\n\n") ? chunk : `${chunk}\n\n`);
    } catch (error) {
      // Connection may have closed between the check and write - this is fine
      logger.debug(`Failed to send chunk to ${sessionId}: ${error}`, "sse-manager");
    }
  }

  sendComment(sessionId: string, comment: string): void {
    const connection = this.connections.get(sessionId);
    if (!connection || connection.closed) return;
    connection.response.write(`: ${comment}\n\n`);
  }

  teardown(sessionId: string, reason: string): void {
    const connection = this.connections.get(sessionId);
    if (!connection) return;

    if (connection.heartbeat) {
      clearInterval(connection.heartbeat);
    }

    if (!connection.closed) {
      try {
        connection.response.write(`event: stream.end\n`);
        connection.response.write(`data: ${JSON.stringify({ reason })}\n\n`);
        connection.response.end();
      } catch (error) {
        logger.debug(`Failed to finalize SSE session ${sessionId}: ${error}`, "sse-manager");
      }
    }

    connection.closed = true;
    this.connections.delete(sessionId);
  }

  close(sessionId: string, summary?: Record<string, unknown> | StreamCompletion): void {
    const connection = this.connections.get(sessionId);
    if (!connection) return;
    if (summary) {
      this.sendEvent(sessionId, "stream.complete", { ...summary });
    }
    this.teardown(sessionId, "completed");
  }

  error(sessionId: string, code: string, message: string, details?: Record<string, unknown>): void {
    const connection = this.connections.get(sessionId);
    if (!connection || connection.closed) {
      // Session already closed - log for debugging but don't warn
      logger.debug(`Attempted to send error to closed session ${sessionId}: ${code}`, "sse-manager");
      return;
    }
    this.sendEvent(sessionId, "stream.error", { code, message, ...(details ?? {}) });
    this.teardown(sessionId, code);
  }

  has(sessionId: string): boolean {
    const connection = this.connections.get(sessionId);
    return !!connection && !connection.closed;
  }
}

export const sseStreamManager = new SSEStreamManager();
