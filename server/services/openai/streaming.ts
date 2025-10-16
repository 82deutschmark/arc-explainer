/**
 * Author: gpt-5-codex
 * Date: 2025-10-16T00:00:00Z
 * PURPOSE: Provides reusable helpers for handling OpenAI Responses API streaming events and
 *          aggregating incremental deltas before the final response arrives.
 * SRP/DRY check: Pass — moves event-type branching out of the service class for clarity and reuse.
 */

import type {
  ResponseContentPartAddedEvent,
  ResponseOutputTextAnnotationAddedEvent,
  ResponseReasoningSummaryPartAddedEvent,
  ResponseReasoningSummaryPartDoneEvent,
  ResponseReasoningSummaryTextDeltaEvent,
  ResponseReasoningSummaryTextDoneEvent,
  ResponseReasoningTextDeltaEvent,
  ResponseReasoningTextDoneEvent,
  ResponseStreamEvent
} from "openai/resources/responses/responses";
import type { StreamChunk } from "../base/BaseAIService.js";

export interface OpenAIStreamAggregates {
  text: string;
  parsed: string;
  parsedObject?: Record<string, unknown> | null;
  reasoning: string;
  summary: string;
  refusal: string;
  reasoningSummary?: string;
  annotations: Array<{
    annotation: unknown;
    annotationIndex: number;
    contentIndex: number;
    itemId: string;
    outputIndex: number;
    sequenceNumber?: number;
  }>;
  expectingJson: boolean;
  receivedAnnotatedJsonDelta: boolean;
  receivedParsedJsonDelta: boolean;
}

export interface StreamCallbacks {
  emitChunk: (chunk: StreamChunk) => void;
  emitEvent: (event: string, payload: Record<string, unknown>) => void;
}

export function createStreamAggregates(expectingJson: boolean): OpenAIStreamAggregates {
  return {
    text: "",
    parsed: "",
    parsedObject: null,
    reasoning: "",
    summary: "",
    refusal: "",
    reasoningSummary: "",
    annotations: [],
    expectingJson,
    receivedAnnotatedJsonDelta: false,
    receivedParsedJsonDelta: false
  };
}

function stringifyStructuredDelta(delta: unknown): string {
  if (delta === undefined || delta === null) {
    return "";
  }

  if (typeof delta === "string") {
    return delta;
  }

  try {
    return JSON.stringify(delta);
  } catch {
    return String(delta);
  }
}

function updateParsedAggregate(
  aggregates: OpenAIStreamAggregates,
  parsedOutput: unknown
): void {
  if (parsedOutput === undefined) {
    return;
  }

  const normalized = typeof parsedOutput === "string"
    ? parsedOutput
    : stringifyStructuredDelta(parsedOutput);

  if (normalized) {
    aggregates.parsed = normalized;
  }

  if (parsedOutput && typeof parsedOutput === "object") {
    aggregates.parsedObject = parsedOutput as Record<string, unknown>;
  }
}

function extractParsedOutput(event: Record<string, unknown>): unknown {
  return (
    event.parsed_output ??
    event.parsedOutput ??
    event.output_parsed ??
    event.outputParsed ??
    undefined
  );
}

export function handleStreamEvent(
  event: ResponseStreamEvent | { type: string; [key: string]: unknown },
  aggregates: OpenAIStreamAggregates,
  callbacks: StreamCallbacks
): void {
  const eventType = (event as { type: string }).type;
  const sequenceNumber =
    typeof (event as { sequence_number?: number }).sequence_number === 'number'
      ? (event as { sequence_number?: number }).sequence_number
      : undefined;

  switch (eventType) {
    case "response.created": {
      callbacks.emitEvent("stream.status", { state: "created" });
      break;
    }
    case "response.in_progress": {
      callbacks.emitEvent("stream.status", {
        state: "in_progress",
        step: (event as any).step
      });
      break;
    }
    case "response.completed": {
      callbacks.emitEvent("stream.status", { state: "completed" });
      break;
    }
    case "response.failed":
    case "error": {
      const message = (event as any).error?.message ?? "Streaming failed";
      callbacks.emitEvent("stream.status", {
        state: "failed",
        message
      });
      break;
    }
    case "response.reasoning_summary_text.delta": {
      const delta = (event as ResponseReasoningSummaryTextDeltaEvent).delta || "";
      aggregates.reasoningSummary = (aggregates.reasoningSummary || "") + delta;
      callbacks.emitChunk({
        type: "reasoning", // keep compatibility
        delta,
        content: aggregates.reasoningSummary,
        metadata: { sequence: sequenceNumber }
      });
      break;
    }
    case "response.reasoning_summary_text.done": {
      const doneEvent = event as ResponseReasoningSummaryTextDoneEvent;
      aggregates.reasoningSummary = doneEvent.text || aggregates.reasoningSummary || "";
      aggregates.summary = aggregates.reasoningSummary;
      callbacks.emitEvent("stream.chunk", {
        type: "reasoning.summary",
        content: aggregates.reasoningSummary,
        sequence: sequenceNumber
      });
      break;
    }
    case "response.reasoning_summary_part.added": {
      const part = (event as ResponseReasoningSummaryPartAddedEvent).part;
      const text = (part as any)?.text || (part as any)?.content || "";
      if (text) {
        aggregates.reasoning += text;
        aggregates.summary = `${aggregates.summary}${text}`;
        callbacks.emitChunk({
          type: "reasoning",
          delta: text,
          content: aggregates.reasoning,
          metadata: { sequence: sequenceNumber }
        });
      }
      break;
    }
    case "response.reasoning_summary_part.done": {
      const donePart = event as ResponseReasoningSummaryPartDoneEvent;
      const text = (donePart.part as any)?.text || "";
      if (text) {
        aggregates.summary = `${aggregates.summary}${text}`;
      }
      break;
    }
    case "response.reasoning_text.delta": {
      const delta = (event as ResponseReasoningTextDeltaEvent).delta || "";
      aggregates.reasoning += delta;
      callbacks.emitChunk({
        type: "reasoning",
        delta,
        content: aggregates.reasoning,
        metadata: {
          sequence: sequenceNumber,
          contentIndex: (event as ResponseReasoningTextDeltaEvent).content_index
        }
      });
      break;
    }
    case "response.reasoning_text.done": {
      const doneEvent = event as ResponseReasoningTextDoneEvent;
      const text = doneEvent.text || aggregates.reasoning || "";
      aggregates.reasoning = text;
      callbacks.emitEvent("stream.chunk", {
        type: "reasoning.done",
        content: text,
        sequence: sequenceNumber
      });
      break;
    }
    case "response.output_parsed.delta": {
      const parsedEvent = event as Record<string, unknown>;
      const isFirstParsedDelta = !aggregates.receivedParsedJsonDelta;
      const delta = stringifyStructuredDelta(parsedEvent.delta);

      aggregates.receivedAnnotatedJsonDelta = true;
      aggregates.receivedParsedJsonDelta = true;

      if (isFirstParsedDelta) {
        aggregates.parsed = "";
        aggregates.parsedObject = null;
      }

      const parsedOutput = extractParsedOutput(parsedEvent);
      if (parsedOutput !== undefined) {
        updateParsedAggregate(aggregates, parsedOutput);
      } else if (delta) {
        aggregates.parsed += delta;
      }

      callbacks.emitChunk({
        type: "json",
        delta,
        content: aggregates.parsed,
        metadata: {
          sequence: sequenceNumber,
          expectingJson: aggregates.expectingJson,
          source: "parsed",
          fallback: false
        }
      });
      break;
    }
    case "response.output_parsed.delta.annotated": {
      const parsedEvent = event as Record<string, unknown>;
      const isFirstParsedDelta = !aggregates.receivedParsedJsonDelta;
      const delta = stringifyStructuredDelta(parsedEvent.delta);

      aggregates.receivedAnnotatedJsonDelta = true;
      aggregates.receivedParsedJsonDelta = true;

      if (isFirstParsedDelta) {
        aggregates.parsed = "";
        aggregates.parsedObject = null;
      }

      const parsedOutput = extractParsedOutput(parsedEvent);
      if (parsedOutput !== undefined) {
        updateParsedAggregate(aggregates, parsedOutput);
      } else if (delta) {
        aggregates.parsed += delta;
      }

      callbacks.emitChunk({
        type: "json",
        delta,
        content: aggregates.parsed,
        metadata: {
          sequence: sequenceNumber,
          expectingJson: aggregates.expectingJson,
          source: "parsed.annotated",
          fallback: false,
          annotated: true
        }
      });
      break;
    }
    case "response.output_parsed.annotation.added": {
      const annotationEvent = event as ResponseOutputTextAnnotationAddedEvent;
      aggregates.receivedAnnotatedJsonDelta = true;
      aggregates.receivedParsedJsonDelta = true;
      aggregates.annotations.push({
        annotation: annotationEvent.annotation,
        annotationIndex: annotationEvent.annotation_index,
        contentIndex: annotationEvent.content_index,
        itemId: annotationEvent.item_id,
        outputIndex: annotationEvent.output_index,
        sequenceNumber
      });

      callbacks.emitChunk({
        type: "annotation",
        content: JSON.stringify(annotationEvent.annotation),
        raw: annotationEvent,
        metadata: {
          sequence: sequenceNumber,
          annotationIndex: annotationEvent.annotation_index,
          contentIndex: annotationEvent.content_index,
          itemId: annotationEvent.item_id,
          source: "parsed"
        }
      });
      break;
    }
    case "response.output_parsed.done": {
      const parsedEvent = event as Record<string, unknown>;
      aggregates.receivedAnnotatedJsonDelta = true;
      aggregates.receivedParsedJsonDelta = true;
      const parsedOutput = extractParsedOutput(parsedEvent);
      if (parsedOutput !== undefined) {
        updateParsedAggregate(aggregates, parsedOutput);
      }

      callbacks.emitEvent("stream.chunk", {
        type: "json.done",
        content: aggregates.parsed,
        sequence: sequenceNumber,
        metadata: {
          expectingJson: aggregates.expectingJson,
          source: "parsed"
        }
      });
      break;
    }
    case "response.output_text.delta": {
      const delta = (event as any).delta || "";
      aggregates.text += delta;
      callbacks.emitChunk({
        type: "text",
        delta,
        content: aggregates.text,
        metadata: { sequence: sequenceNumber }
      });
      if (aggregates.expectingJson && !aggregates.receivedAnnotatedJsonDelta) {
        aggregates.parsed += delta;
        callbacks.emitChunk({
          type: "json",
          delta,
          content: aggregates.parsed,
          metadata: {
            sequence: sequenceNumber,
            expectingJson: aggregates.expectingJson,
            fallback: true
          }
        });
      }
      break;
    }
    case "response.output_text.done": {
      callbacks.emitEvent("stream.chunk", {
        type: "text.done",
        content: aggregates.text,
        sequence: sequenceNumber
      });
      break;
    }
    case "response.output_text.delta.annotated": {
      const delta = (event as any).delta || "";
      aggregates.receivedAnnotatedJsonDelta = true;
      aggregates.parsed += delta;
      callbacks.emitChunk({
        type: "json", // indicates structured output delta
        delta,
        content: aggregates.parsed,
        metadata: {
          sequence: sequenceNumber,
          expectingJson: aggregates.expectingJson
        }
      });
      break;
    }
    case "response.output_text.annotation.added": {
      const annotationEvent = event as ResponseOutputTextAnnotationAddedEvent;
      aggregates.annotations.push({
        annotation: annotationEvent.annotation,
        annotationIndex: annotationEvent.annotation_index,
        contentIndex: annotationEvent.content_index,
        itemId: annotationEvent.item_id,
        outputIndex: annotationEvent.output_index,
        sequenceNumber
      });
      callbacks.emitChunk({
        type: "annotation",
        content: JSON.stringify(annotationEvent.annotation),
        raw: annotationEvent,
        metadata: {
          sequence: sequenceNumber,
          annotationIndex: annotationEvent.annotation_index,
          contentIndex: annotationEvent.content_index,
          itemId: annotationEvent.item_id
        }
      });
      break;
    }
    case "response.content_part.added": {
      const contentEvent = event as ResponseContentPartAddedEvent;
      const text = (contentEvent.part as any)?.text || "";
      if (text) {
        aggregates.text += text;
        callbacks.emitChunk({
          type: "text",
          delta: text,
          content: aggregates.text,
          metadata: { sequence: sequenceNumber }
        });
      }
      break;
    }
    case "response.refusal.delta": {
      const delta = (event as any).delta || "";
      aggregates.refusal += delta;
      callbacks.emitChunk({
        type: "refusal",
        delta,
        content: aggregates.refusal,
        metadata: { sequence: sequenceNumber }
      });
      break;
    }
    case "response.refusal.done": {
      aggregates.refusal = aggregates.refusal || "";
      break;
    }
    default: {
      if (!eventType.startsWith('response.')) {
        console.log(`[OpenAI-Streaming] Unhandled event type: ${eventType}`);
      }
      break;
    }
  }
}
