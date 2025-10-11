/**
 * Author: Codex using GPT-5-high
 * Date: 2025-10-09T00:00:00Z
 * PURPOSE: Shared helpers for parsing Server-Sent Event payloads from the Responses API streams.
 * SRP/DRY check: Pass — extracted from Grok streaming service for reuse and unit testing.
 * shadcn/ui: Pass — backend utility.
 */

export interface ParsedSseEvent<T = unknown> {
  event: string;
  data?: T;
}

export function parseSseEvent(rawEvent: string): ParsedSseEvent | null {
  const lines = rawEvent.split(/\r?\n/);
  let eventType = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      eventType = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }

  const dataString = dataLines.join("\n");
  if (!dataString) {
    return { event: eventType };
  }

  if (dataString === "[DONE]") {
    return { event: "done" };
  }

  try {
    return { event: eventType, data: JSON.parse(dataString) };
  } catch {
    return { event: eventType, data: dataString };
  }
}

