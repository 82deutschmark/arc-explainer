/**
 * sseHelpers.ts
 *
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-12-28
 * PURPOSE: Generic type-safe SSE event sender utilities.
 *          Provides reusable helper for sending Server-Sent Events with TypeScript type safety.
 * SRP/DRY check: Pass - Single responsibility: SSE event formatting and sending
 */

import type { Response } from 'express';

/**
 * Generic type-safe SSE event sender.
 * Works with any event shape that has { type: string; data: any }.
 *
 * @param res - Express Response object configured for SSE
 * @param event - Event object with type and data fields
 * @param options - Optional configuration
 * @param options.logger - Optional logger instance for debugging
 * @param options.forceFlush - Whether to force immediate flush to avoid buffering (default: false)
 *
 * @example
 * ```typescript
 * type MyEvents =
 *   | { type: 'start'; data: { id: string } }
 *   | { type: 'progress'; data: { percent: number } };
 *
 * sendSSEEvent<MyEvents>(res, { type: 'start', data: { id: '123' } });
 * sendSSEEvent<MyEvents>(res, { type: 'progress', data: { percent: 50 } }, { forceFlush: true });
 * sendSSEEvent<MyEvents>(res, { type: 'error', data: { msg: 'fail' } }, { logger, forceFlush: true });
 * ```
 */
export function sendSSEEvent<T extends { type: string; data: any }>(
  res: Response,
  event: T,
  options?: {
    logger?: { debug?: (msg: string) => void; error?: (msg: string) => void };
    forceFlush?: boolean;
  }
): void {
  const { logger, forceFlush = false } = options ?? {};

  if (res.writableEnded) {
    logger?.debug?.(`[SSE] Event ${event.type} dropped: stream already ended`);
    return;
  }

  try {
    res.write(`event: ${event.type}\n`);
    res.write(`data: ${JSON.stringify(event.data)}\n\n`);

    // Force immediate flush to avoid buffering if requested
    if (forceFlush) {
      (res as any).socket?.write('');
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger?.error?.(`[SSE] Failed to write event ${event.type}: ${errorMsg}`);
  }
}
