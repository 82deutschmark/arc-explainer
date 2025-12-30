/**
 * Author: gpt-5-codex
 * Date: 2025-10-16T00:00:00Z
 * PURPOSE: Provides reusable helpers for handling OpenAI Responses API streaming events and
 *          aggregating incremental deltas before the final response arrives.
 * SRP/DRY check: Pass — consolidates event handling in a single helper used by OpenAI services.
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
  ResponseStreamEvent,
} from "openai/resources/responses/responses";
import type { StreamChunk } from "../base/BaseAIService.js";

export interface OpenAIStreamAggregates {
  text: string;
  parsed: string;
  parsedObject: Record<string, unknown> | Array<unknown> | null;
  reasoning: string;
  reasoningSummary: string;
  summary: string;
  refusal: string;
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
  usedFallbackJson: boolean;
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
    reasoningSummary: "",
    summary: "",
    refusal: "",
    annotations: [],
    expectingJson,
    receivedAnnotatedJsonDelta: false,
    receivedParsedJsonDelta: false,
    usedFallbackJson: false,
  };
}

function mergeStructuredDelta(
  existing: Record<string, unknown> | undefined,
  delta: Record<string, unknown>,
): Record<string, unknown> {
  const base: Record<string, unknown> = existing ? { ...existing } : {};

  for (const [key, value] of Object.entries(delta)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const current = base[key];
      base[key] = mergeStructuredDelta(
        current && typeof current === "object" && !Array.isArray(current)
          ? (current as Record<string, unknown>)
          : undefined,
        value as Record<string, unknown>,
      );
    } else {
      base[key] = value;
    }
  }

  return base;
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
  parsedOutput: unknown,
): void {
  if (parsedOutput === undefined || parsedOutput === null) {
    return;
  }

  if (typeof parsedOutput === "string") {
    if (parsedOutput) {
      aggregates.parsed = parsedOutput;
      aggregates.parsedObject = null;
    }
    return;
  }

  if (Array.isArray(parsedOutput)) {
    aggregates.parsedObject = parsedOutput;
  } else if (typeof parsedOutput === "object") {
    const previous =
      aggregates.parsedObject && !Array.isArray(aggregates.parsedObject)
        ? (aggregates.parsedObject as Record<string, unknown>)
        : undefined;
    aggregates.parsedObject = mergeStructuredDelta(previous, parsedOutput as Record<string, unknown>);
  }

  try {
    const source = aggregates.parsedObject ?? parsedOutput;
    aggregates.parsed = JSON.stringify(source);
  } catch {
    aggregates.parsed = stringifyStructuredDelta(parsedOutput);
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

function handleParsedDelta(
  event: Record<string, unknown>,
  aggregates: OpenAIStreamAggregates,
  callbacks: StreamCallbacks,
  sequenceNumber: number | undefined,
  source: "parsed" | "parsed.annotated",
  annotated: boolean,
): void {
  const isFirstDelta = !aggregates.receivedParsedJsonDelta;
  const deltaPayload = (event as { delta?: unknown }).delta;
  const deltaText = stringifyStructuredDelta(deltaPayload);

  aggregates.receivedParsedJsonDelta = true;
  if (annotated) {
    aggregates.receivedAnnotatedJsonDelta = true;
  }

  if (isFirstDelta) {
    aggregates.parsed = "";
    aggregates.parsedObject = null;
    aggregates.usedFallbackJson = false;
  }

  const parsedOutput = extractParsedOutput(event);
  if (parsedOutput !== undefined) {
    updateParsedAggregate(aggregates, parsedOutput);
  } else if (deltaText) {
    aggregates.parsed += deltaText;
  }

  callbacks.emitChunk({
    type: "json",
    delta: deltaText,
    content: aggregates.parsed,
    metadata: {
      sequence: sequenceNumber,
      expectingJson: aggregates.expectingJson,
      source,
      annotated,
      fallback: false,
    },
  });
}

export function handleStreamEvent(
  event: ResponseStreamEvent | { type: string; [key: string]: unknown },
  aggregates: OpenAIStreamAggregates,
  callbacks: StreamCallbacks,
): void {
  const eventType = (event as { type: string }).type;
  const sequenceNumber =
    typeof (event as { sequence_number?: number }).sequence_number === "number"
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
        step: (event as { step?: string }).step,
      });
      break;
    }
    case "response.completed": {
      callbacks.emitEvent("stream.status", { state: "completed" });
      break;
    }
    case "response.failed":
    case "error": {
      const message = (event as { error?: { message?: string } }).error?.message ?? "Streaming failed";
      callbacks.emitEvent("stream.status", { state: "failed", message });
      break;
    }
    case "response.reasoning_summary_text.delta": {
      const delta = (event as ResponseReasoningSummaryTextDeltaEvent).delta ?? "";
      aggregates.reasoningSummary = `${aggregates.reasoningSummary}${delta}`;
      callbacks.emitChunk({
        type: "reasoning",
        delta,
        content: aggregates.reasoningSummary,
        metadata: { sequence: sequenceNumber },
      });
      break;
    }
    case "response.reasoning_summary_text.done": {
      const doneEvent = event as ResponseReasoningSummaryTextDoneEvent;
      aggregates.reasoningSummary = doneEvent.text ?? aggregates.reasoningSummary;
      aggregates.summary = aggregates.reasoningSummary;
      callbacks.emitEvent("stream.chunk", {
        type: "reasoning.summary",
        content: aggregates.reasoningSummary,
        sequence: sequenceNumber,
      });
      break;
    }
    case "response.reasoning_summary_part.added": {
      const part = (event as ResponseReasoningSummaryPartAddedEvent).part;
      const text = (part as { text?: string; content?: string })?.text ?? (part as { content?: string })?.content ?? "";
      if (text) {
        aggregates.reasoning = `${aggregates.reasoning}${text}`;
        aggregates.summary = `${aggregates.summary}${text}`;
        callbacks.emitChunk({
          type: "reasoning",
          delta: text,
          content: aggregates.reasoning,
          metadata: { sequence: sequenceNumber },
        });
      }
      break;
    }
    case "response.reasoning_summary_part.done": {
      const donePart = event as ResponseReasoningSummaryPartDoneEvent;
      const text = (donePart.part as { text?: string })?.text ?? "";
      if (text) {
        aggregates.summary = `${aggregates.summary}${text}`;
      }
      break;
    }
    case "response.reasoning_text.delta": {
      const delta = (event as ResponseReasoningTextDeltaEvent).delta ?? "";
      aggregates.reasoning = `${aggregates.reasoning}${delta}`;
      callbacks.emitChunk({
        type: "reasoning",
        delta,
        content: aggregates.reasoning,
        metadata: {
          sequence: sequenceNumber,
          contentIndex: (event as ResponseReasoningTextDeltaEvent).content_index,
        },
      });
      break;
    }
    case "response.reasoning_text.done": {
      const doneEvent = event as ResponseReasoningTextDoneEvent;
      const text = doneEvent.text ?? aggregates.reasoning;
      aggregates.reasoning = text;
      callbacks.emitEvent("stream.chunk", {
        type: "reasoning.done",
        content: text,
        sequence: sequenceNumber,
      });
      break;
    }
    case "response.output_parsed.delta": {
      handleParsedDelta(event as Record<string, unknown>, aggregates, callbacks, sequenceNumber, "parsed", false);
      break;
    }
    case "response.output_parsed.delta.annotated": {
      handleParsedDelta(event as Record<string, unknown>, aggregates, callbacks, sequenceNumber, "parsed.annotated", true);
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
        sequenceNumber,
      });

      let annotationContent = "";
      try {
        annotationContent = JSON.stringify(annotationEvent.annotation);
      } catch {
        annotationContent = String(annotationEvent.annotation);
      }

      callbacks.emitChunk({
        type: "annotation",
        content: annotationContent,
        raw: annotationEvent,
        metadata: {
          sequence: sequenceNumber,
          annotationIndex: annotationEvent.annotation_index,
          contentIndex: annotationEvent.content_index,
          itemId: annotationEvent.item_id,
          outputIndex: annotationEvent.output_index,
          source: "parsed",
        },
      });
      break;
    }
    case "response.output_parsed.done": {
      const parsedEvent = event as Record<string, unknown>;
      aggregates.receivedParsedJsonDelta = true;
      aggregates.receivedAnnotatedJsonDelta = true;

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
          source: "parsed",
          fallback: false,
        },
        expectingJson: aggregates.expectingJson,
        fallback: false,
      });
      break;
    }
    case "response.output_text.delta": {
      const delta = (event as { delta?: string }).delta ?? "";
      aggregates.text = `${aggregates.text}${delta}`;
      callbacks.emitChunk({
        type: "text",
        delta,
        content: aggregates.text,
        metadata: { sequence: sequenceNumber },
      });

      if (aggregates.expectingJson && !aggregates.receivedParsedJsonDelta) {
        aggregates.parsed = `${aggregates.parsed}${delta}`;
        aggregates.usedFallbackJson = true;
        callbacks.emitChunk({
          type: "json",
          delta,
          content: aggregates.parsed,
          metadata: {
            sequence: sequenceNumber,
            expectingJson: aggregates.expectingJson,
            fallback: true,
          },
        });
      }
      break;
    }
    case "response.output_text.done": {
      if (aggregates.expectingJson && aggregates.usedFallbackJson && !aggregates.receivedParsedJsonDelta) {
        try {
          aggregates.parsedObject = aggregates.parsed ? (JSON.parse(aggregates.parsed) as Record<string, unknown> | Array<unknown>) : null;
        } catch {
          aggregates.parsedObject = null;
        }
        callbacks.emitEvent("stream.chunk", {
          type: "json.done",
          content: aggregates.parsed,
          sequence: sequenceNumber,
          expectingJson: aggregates.expectingJson,
          fallback: true,
        });
      }

      callbacks.emitEvent("stream.chunk", {
        type: "text.done",
        content: aggregates.text,
        sequence: sequenceNumber,
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
        sequenceNumber,
      });

      let annotationContent = "";
      try {
        annotationContent = JSON.stringify(annotationEvent.annotation);
      } catch {
        annotationContent = String(annotationEvent.annotation);
      }

      callbacks.emitChunk({
        type: "annotation",
        content: annotationContent,
        raw: annotationEvent,
        metadata: {
          sequence: sequenceNumber,
          annotationIndex: annotationEvent.annotation_index,
          contentIndex: annotationEvent.content_index,
          itemId: annotationEvent.item_id,
          outputIndex: annotationEvent.output_index,
          source: "text",
        },
      });
      break;
    }
    case "response.content_part.added": {
      const contentEvent = event as ResponseContentPartAddedEvent;
      const text = (contentEvent.part as { text?: string })?.text ?? "";
      if (text) {
        aggregates.text = `${aggregates.text}${text}`;
        callbacks.emitChunk({
          type: "text",
          delta: text,
          content: aggregates.text,
          metadata: { sequence: sequenceNumber },
        });
      }
      break;
    }
    case "response.refusal.delta": {
      const delta = (event as { delta?: string }).delta ?? "";
      aggregates.refusal = `${aggregates.refusal}${delta}`;
      callbacks.emitChunk({
        type: "refusal",
        delta,
        content: aggregates.refusal,
        metadata: { sequence: sequenceNumber },
      });
      break;
    }
    case "response.refusal.done": {
      aggregates.refusal = aggregates.refusal || "";
      break;
    }
    default: {
      if (!eventType?.startsWith("response.")) {
        // eslint-disable-next-line no-console
        console.log(`[OpenAI-Streaming] Unhandled event type: ${eventType}`);
      }
      break;
    }
  }
}
