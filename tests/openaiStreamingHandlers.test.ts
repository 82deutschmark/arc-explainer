/**
 * Author: gpt-5-codex
 * Date: 2025-02-14T00:00:00Z
 * PURPOSE: Regression tests for OpenAI streaming event handling to ensure emitted SSE chunks mirror provider deltas.
 * SRP/DRY check: Pass — exercises existing streaming aggregation helper without duplicating logic elsewhere.
 * DaisyUI: Pass — backend-focused test with no UI components.
 */

import { strict as assert } from "node:assert";
import test from "node:test";

process.env.OPENAI_API_KEY ??= "test-key";

const {
  createStreamAggregates,
  handleStreamEvent
} = await import("../server/services/openai/streaming.ts");

test("OpenAI streaming handler emits text chunk deltas", () => {
  const aggregates = createStreamAggregates(false);

  const emitted: any[] = [];
  const harness = {
    sessionId: "session-test",
    emit: (chunk: any) => emitted.push(chunk),
    end: () => undefined,
    emitEvent: () => undefined
  };

  const event = {
    type: "response.output_text.delta",
    delta: "Hello",
    snapshot: "Hello",
    sequence_number: 1,
    output_index: 0
  } as any;

  handleStreamEvent(event, aggregates, {
    emitChunk: chunk => harness.emit(chunk),
    emitEvent: () => undefined
  });

  assert.equal(aggregates.text, "Hello");
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].type, "text");
  assert.equal(emitted[0].delta, "Hello");
  assert.equal(emitted[0].content, "Hello");
});

test("OpenAI streaming handler aggregates reasoning, JSON, and refusal deltas", () => {
  const aggregates = createStreamAggregates(true);

  const emitted: any[] = [];
  const harness = {
    sessionId: "session-test",
    emit: (chunk: any) => emitted.push(chunk),
    end: () => undefined,
    emitEvent: () => undefined
  };

  const reasoningEvent = { type: "response.reasoning_text.delta", delta: "Think", sequence_number: 2 } as any;
  const jsonEvent = {
    type: "response.output_text.delta",
    delta: "{\"key\":",
    sequence_number: 3,
    output_index: 0
  } as any;
  const jsonEventPart2 = {
    type: "response.output_text.delta",
    delta: "\"value\"}",
    sequence_number: 4,
    output_index: 0
  } as any;
  const refusalEvent = { type: "response.refusal.delta", delta: "No", sequence_number: 5 } as any;

  handleStreamEvent(reasoningEvent, aggregates, {
    emitChunk: chunk => harness.emit(chunk),
    emitEvent: () => undefined
  });
  handleStreamEvent(jsonEvent, aggregates, {
    emitChunk: chunk => harness.emit(chunk),
    emitEvent: () => undefined
  });
  handleStreamEvent(jsonEventPart2, aggregates, {
    emitChunk: chunk => harness.emit(chunk),
    emitEvent: () => undefined
  });
  handleStreamEvent(refusalEvent, aggregates, {
    emitChunk: chunk => harness.emit(chunk),
    emitEvent: () => undefined
  });

  assert.equal(aggregates.reasoning, "Think");
  assert.equal(aggregates.parsed, "{\"key\":\"value\"}");
  assert.equal(aggregates.refusal, "No");

  const reasoningChunk = emitted.find(chunk => chunk.type === "reasoning");
  assert.ok(reasoningChunk);
  assert.equal(reasoningChunk.delta, "Think");
  assert.equal(reasoningChunk.content, "Think");

  const jsonChunks = emitted.filter(chunk => chunk.type === "json");
  assert.equal(jsonChunks.length, 2);
  assert.equal(jsonChunks[1].content, "{\"key\":\"value\"}");

  const refusalChunk = emitted.find(chunk => chunk.type === "refusal");
  assert.ok(refusalChunk);
  assert.equal(refusalChunk.delta, "No");
  assert.equal(refusalChunk.content, "No");
});

test("OpenAI streaming handler surfaces output text annotations", () => {
  const aggregates = createStreamAggregates(false);

  const emitted: any[] = [];
  const harness = {
    sessionId: "session-test",
    emit: (chunk: any) => emitted.push(chunk),
    end: () => undefined,
    emitEvent: () => undefined
  };

  const annotationPayload = {
    type: "response.output_text.annotation.added",
    annotation: { type: "citation", url: "https://example.com" },
    annotation_index: 0,
    content_index: 0,
    item_id: "msg_123",
    output_index: 0,
    sequence_number: 6
  } as any;

  handleStreamEvent(annotationPayload, aggregates, {
    emitChunk: chunk => harness.emit(chunk),
    emitEvent: () => undefined
  });

  assert.equal(aggregates.annotations.length, 1);
  assert.deepEqual(aggregates.annotations[0].annotation, { type: "citation", url: "https://example.com" });
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].type, "annotation");
  assert.equal(emitted[0].metadata.annotationIndex, 0);
  assert.equal(emitted[0].metadata.itemId, "msg_123");
  assert.equal(typeof emitted[0].content, "string");
});

test("OpenAI streaming handler prioritizes output_parsed deltas over fallback text", () => {
  const aggregates = createStreamAggregates(true);

  const emitted: any[] = [];
  const harness = {
    sessionId: "session-test",
    emit: (chunk: any) => emitted.push(chunk),
    end: () => undefined,
    emitEvent: () => undefined
  };

  const fallbackText = {
    type: "response.output_text.delta",
    delta: "{\"answer\":\"",
    sequence_number: 1,
    output_index: 0
  } as any;

  const parsedDelta = {
    type: "response.output_parsed.delta",
    delta: { answer: { value: { append: "blue" } } },
    parsed_output: { answer: "blue" },
    sequence_number: 2,
    output_index: 0
  } as any;

  handleStreamEvent(fallbackText, aggregates, {
    emitChunk: chunk => harness.emit(chunk),
    emitEvent: () => undefined
  });

  handleStreamEvent(parsedDelta, aggregates, {
    emitChunk: chunk => harness.emit(chunk),
    emitEvent: () => undefined
  });

  assert.equal(aggregates.receivedParsedJsonDelta, true);
  assert.equal(aggregates.parsed, JSON.stringify({ answer: "blue" }));

  const jsonChunks = emitted.filter(chunk => chunk.type === "json");
  assert.ok(jsonChunks.length >= 1);
  assert.equal(jsonChunks[jsonChunks.length - 1].metadata?.source, "parsed");
  assert.equal(jsonChunks[jsonChunks.length - 1].content, JSON.stringify({ answer: "blue" }));
});
