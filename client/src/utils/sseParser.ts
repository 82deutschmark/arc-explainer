/**
 * sseParser.ts
 *
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-12-28
 * PURPOSE: Generic Server-Sent Events (SSE) parsing utilities.
 *          Parses SSE text stream into discriminated union event objects.
 *          Application-agnostic parser with type narrowing support.
 *          Throws SSEParseError on malformed events for explicit error handling.
 * SRP/DRY check: Pass - Single responsibility: SSE text parsing
 */

/**
 * Base SSE event structure with discriminated union support.
 * Events have a `type` field for narrowing and `data` payload.
 *
 * @example
 * ```ts
 * type MyEvents =
 *   | { type: 'progress'; data: { current: number; total: number } }
 *   | { type: 'complete'; data: { score: number } }
 *   | { type: 'error'; data: { message: string } };
 *
 * const events = parseSSEEvents<MyEvents>(text);
 * for (const event of events) {
 *   if (event.type === 'progress') {
 *     // TypeScript knows event.data is { current: number; total: number }
 *     console.log(event.data.current);
 *   }
 * }
 * ```
 */
export type SSEEvent<T extends { type: string; data: any } = { type: string; data: any }> = T;

/**
 * Custom error thrown when SSE event parsing fails.
 * Contains detailed information about the malformed event for debugging.
 */
export class SSEParseError extends Error {
  /** The event type that failed to parse */
  public readonly eventType: string;
  /** The raw data line that failed JSON parsing */
  public readonly dataLine: string;
  /** Line number in the SSE stream where the error occurred */
  public readonly lineNumber: number;
  /** The underlying JSON parse error */
  public readonly cause: Error;

  constructor(eventType: string, dataLine: string, lineNumber: number, cause: Error) {
    super(
      `Failed to parse SSE event "${eventType}" at line ${lineNumber}: ${cause.message}\nData: ${dataLine.slice(0, 100)}${dataLine.length > 100 ? '...' : ''}`
    );
    this.name = 'SSEParseError';
    this.eventType = eventType;
    this.dataLine = dataLine;
    this.lineNumber = lineNumber;
    this.cause = cause;
  }
}

/**
 * Parses SSE formatted text into discriminated union event objects.
 *
 * Handles the standard SSE format:
 * ```
 * event: eventType
 * data: {"json":"payload"}
 *
 * event: anotherEvent
 * data: {"more":"data"}
 * ```
 *
 * Features:
 * - Skips empty lines
 * - Throws SSEParseError on malformed JSON in data lines
 * - Returns all successfully parsed events
 * - Supports discriminated union type narrowing
 *
 * @param text - Raw SSE text to parse (can be partial stream)
 * @returns Array of parsed events with type narrowing support
 * @throws {SSEParseError} When event data contains malformed JSON
 *
 * @example Basic usage
 * ```ts
 * const text = 'event: progress\ndata: {"current":5,"total":10}\n\n';
 * const events = parseSSEEvents(text);
 * // events = [{ type: 'progress', data: { current: 5, total: 10 } }]
 * ```
 *
 * @example With error handling
 * ```ts
 * try {
 *   const events = parseSSEEvents(text);
 *   // Process events...
 * } catch (err) {
 *   if (err instanceof SSEParseError) {
 *     console.error('Malformed SSE event:', err.eventType, err.dataLine);
 *   }
 * }
 * ```
 *
 * @example With discriminated unions
 * ```ts
 * type ReArcEvent =
 *   | { type: 'progress'; data: { current: number; total: number } }
 *   | { type: 'complete'; data: { type: 'score'; score: number } }
 *   | { type: 'error'; data: { message: string } };
 *
 * const events = parseSSEEvents<ReArcEvent>(text);
 * for (const event of events) {
 *   if (event.type === 'progress') {
 *     console.log(event.data.current); // TypeScript knows the shape
 *   }
 * }
 * ```
 */
export function parseSSEEvents<T extends { type: string; data: any } = { type: string; data: any }>(
  text: string
): SSEEvent<T>[] {
  const events: SSEEvent<T>[] = [];
  const lines = text.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip empty lines
    if (!line.trim()) {
      i++;
      continue;
    }

    // Look for event line
    if (line.startsWith('event: ')) {
      const eventType = line.slice(7).trim();
      const dataLine = lines[i + 1];

      // Ensure we have a matching data line
      if (!dataLine?.startsWith('data: ')) {
        i++;
        continue;
      }

      try {
        const data = JSON.parse(dataLine.slice(6));

        events.push({
          type: eventType,
          data,
        } as SSEEvent<T>);
      } catch (parseErr) {
        // Throw detailed error for malformed SSE events
        throw new SSEParseError(
          eventType,
          dataLine,
          i + 2, // Line number (1-indexed, +2 because data is on next line)
          parseErr instanceof Error ? parseErr : new Error(String(parseErr))
        );
      }

      // Skip both event and data lines
      i += 2;
    } else {
      i++;
    }
  }

  return events;
}
