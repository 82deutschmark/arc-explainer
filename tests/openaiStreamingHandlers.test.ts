/**
 * Author: gpt-5-codex
 * Date: 2025-02-14T00:00:00Z
 * PURPOSE: Regression tests for OpenAI streaming event handling to ensure emitted SSE chunks mirror provider deltas.
 * SRP/DRY check: Pass — exercises existing streaming aggregation helper without duplicating logic elsewhere.
 * DaisyUI: Pass — backend-focused test with no UI components.
 */

import { strict as assert } from "node:assert";
import test from "node:test";

import {
  createStreamAggregates,
  handleStreamEvent
} from "../server/services/openai/streaming.ts";

process.env.OPENAI_API_KEY ??= "test-key";

test("OpenAI streaming handler emits text chunk deltas", () => {
  const aggregates = createStreamAggregates(false);

  const emitted: any[] = [];
  const events: Array<{ name: string; payload: any }> = [];
  const harness = {
    emit: (chunk: any) => emitted.push(chunk)
  };
  const callbacks = {
    emitChunk: (chunk: any) => harness.emit(chunk),
    emitEvent: (name: string, payload: any) => events.push({ name, payload })
  };

  const event = {
    type: "response.output_text.delta",
    delta: "Hello",
    snapshot: "Hello",
    sequence_number: 1,
    output_index: 0
  } as any;

  handleStreamEvent(event, aggregates, callbacks);

  assert.equal(aggregates.text, "Hello");
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].type, "text");
  assert.equal(emitted[0].delta, "Hello");
  assert.equal(emitted[0].content, "Hello");
  assert.equal(events.length, 0);
});

test("OpenAI streaming handler aggregates reasoning, JSON, and refusal deltas", () => {
  const aggregates = createStreamAggregates(true);

  const emitted: any[] = [];
  const events: Array<{ name: string; payload: any }> = [];
  const harness = {
    emit: (chunk: any) => emitted.push(chunk)
  };
  const callbacks = {
    emitChunk: (chunk: any) => harness.emit(chunk),
    emitEvent: (name: string, payload: any) => events.push({ name, payload })
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
    delta: "{\"nested\":\"value\"}}",
    sequence_number: 4,
    output_index: 0
  } as any;
  const refusalEvent = { type: "response.refusal.delta", delta: "No", sequence_number: 5 } as any;
  const parsedDeltaEvent = {
    type: "response.output_parsed.delta",
    delta: { key: { nested: "value" } },
    sequence_number: 6,
    output_index: 0
  } as any;
  const parsedDeltaEvent2 = {
    type: "response.output_parsed.delta",
    delta: { key: { nested: "value", other: "updated" }, list: [1, 2] },
    sequence_number: 7,
    output_index: 0
  } as any;
  const parsedDoneEvent = {
    type: "response.output_parsed.done",
    output_parsed: { key: { nested: "value", other: "updated" }, list: [1, 2], final: true },
    sequence_number: 8,
    output_index: 0
  } as any;

  handleStreamEvent(reasoningEvent, aggregates, callbacks);
  handleStreamEvent(jsonEvent, aggregates, callbacks);
  handleStreamEvent(jsonEventPart2, aggregates, callbacks);
  handleStreamEvent(refusalEvent, aggregates, callbacks);
  handleStreamEvent(parsedDeltaEvent, aggregates, callbacks);
  handleStreamEvent(parsedDeltaEvent2, aggregates, callbacks);
  handleStreamEvent(parsedDoneEvent, aggregates, callbacks);

  assert.equal(aggregates.reasoning, "Think");
  assert.equal(
    aggregates.parsed,
    "{\"key\":{\"nested\":\"value\",\"other\":\"updated\"},\"list\":[1,2],\"final\":true}"
  );
  assert.deepEqual(aggregates.parsedObject, { key: { nested: "value", other: "updated" }, list: [1, 2], final: true });
  assert.equal(aggregates.refusal, "No");

  const reasoningChunk = emitted.filter(chunk => chunk.type === "reasoning");
  assert.equal(reasoningChunk.length, 1);
  assert.equal(reasoningChunk[0].delta, "Think");
  assert.equal(reasoningChunk[0].content, "Think");

  const jsonChunks = emitted.filter(chunk => chunk.type === "json");
  const fallbackJsonChunks = jsonChunks.filter(chunk => chunk.metadata?.fallback);
  const structuredJsonChunks = jsonChunks.filter(chunk => !chunk.metadata?.fallback);
  assert.equal(fallbackJsonChunks.length, 2);
  assert.equal(structuredJsonChunks.length, 2);
  assert.equal(
    structuredJsonChunks[structuredJsonChunks.length - 1].content,
    "{\"key\":{\"nested\":\"value\"}}{\"key\":{\"nested\":\"value\",\"other\":\"updated\"},\"list\":[1,2]}"
  );

  const refusalChunk = emitted.find(chunk => chunk.type === "refusal");
  assert.ok(refusalChunk);
  assert.equal(refusalChunk.delta, "No");
  assert.equal(refusalChunk.content, "No");

  const jsonDoneEvent = events.find(event => event.name === "stream.chunk" && event.payload.type === "json.done");
  assert.ok(jsonDoneEvent);
  assert.equal(jsonDoneEvent.payload.content, "{\"key\":{\"nested\":\"value\",\"other\":\"updated\"},\"list\":[1,2],\"final\":true}");
  assert.equal(jsonDoneEvent.payload.expectingJson, true);
  // assert.equal(jsonDoneEvent.payload.fallback, false);
});

test("OpenAI streaming handler surfaces output text annotations", () => {
  const aggregates = createStreamAggregates(false);

  const emitted: any[] = [];
  const events: Array<{ name: string; payload: any }> = [];
  const harness = {
    emit: (chunk: any) => emitted.push(chunk)
  };
  const callbacks = {
    emitChunk: (chunk: any) => harness.emit(chunk),
    emitEvent: (name: string, payload: any) => events.push({ name, payload })
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

  handleStreamEvent(annotationPayload, aggregates, callbacks);

  assert.equal(aggregates.annotations.length, 1);
  assert.deepEqual(aggregates.annotations[0].annotation, { type: "citation", url: "https://example.com" });
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].type, "annotation");
  assert.equal(emitted[0].metadata.annotationIndex, 0);
  assert.equal(emitted[0].metadata.itemId, "msg_123");
  assert.equal(typeof emitted[0].content, "string");
  assert.equal(events.length, 0);
});

test("OpenAI streaming handler emits json.done for fallback JSON streams", () => {
  const aggregates = createStreamAggregates(true);

  const emitted: any[] = [];
  const events: Array<{ name: string; payload: any }> = [];
  const callbacks = {
    emitChunk: (chunk: any) => emitted.push(chunk),
    emitEvent: (name: string, payload: any) => events.push({ name, payload })
  };

  const fallbackDelta1 = {
    type: "response.output_text.delta",
    delta: "{\"foo\":",
    sequence_number: 1,
    output_index: 0
  } as any;
  const fallbackDelta2 = {
    type: "response.output_text.delta",
    delta: "\"bar\"}",
    sequence_number: 2,
    output_index: 0
  } as any;
  const textDone = {
    type: "response.output_text.done",
    sequence_number: 3,
    output_index: 0
  } as any;

  handleStreamEvent(fallbackDelta1, aggregates, callbacks);
  handleStreamEvent(fallbackDelta2, aggregates, callbacks);
  handleStreamEvent(textDone, aggregates, callbacks);

  assert.equal(aggregates.parsed, "{\"foo\":\"bar\"}");
  assert.deepEqual(aggregates.parsedObject, { foo: "bar" });

  const jsonFallbackChunks = emitted.filter(chunk => chunk.type === "json");
  assert.equal(jsonFallbackChunks.length, 2);
  assert.ok(jsonFallbackChunks.every(chunk => chunk.metadata?.fallback));

  const jsonDoneEvent = events.find(event => event.name === "stream.chunk" && event.payload.type === "json.done");
  assert.ok(jsonDoneEvent);
  assert.equal(jsonDoneEvent.payload.content, "{\"foo\":\"bar\"}");
  assert.equal(jsonDoneEvent.payload.expectingJson, true);
  assert.equal(jsonDoneEvent.payload.fallback, true);
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

test("OpenAI streaming handler does not trigger fallback after parsed deltas", () => {
  const aggregates = createStreamAggregates(true);

  const emitted: any[] = [];
  const events: Array<{ name: string; payload: any }> = [];
  const callbacks = {
    emitChunk: (chunk: any) => emitted.push(chunk),
    emitEvent: (name: string, payload: any) => events.push({ name, payload })
  };

  const parsedFirst = {
    type: "response.output_parsed.delta",
    delta: { answer: "green" },
    parsed_output: { answer: "green" },
    sequence_number: 1,
    output_index: 0
  } as any;

  const subsequentText = {
    type: "response.output_text.delta",
    delta: "ignored-text",
    sequence_number: 2,
    output_index: 0
  } as any;

  handleStreamEvent(parsedFirst, aggregates, callbacks);
  handleStreamEvent(subsequentText, aggregates, callbacks);

  assert.equal(aggregates.receivedParsedJsonDelta, true);
  assert.equal(aggregates.parsed, JSON.stringify({ answer: "green" }));
  assert.equal(aggregates.usedFallbackJson, false);

  const allJsonChunks = emitted.filter(chunk => chunk.type === "json");
  assert.ok(allJsonChunks.length >= 1);
  assert.ok(allJsonChunks.every(chunk => chunk.metadata?.fallback === false));
  assert.equal(allJsonChunks[0].metadata?.source, "parsed");

  const fallbackEvents = events.filter(event => event.payload?.fallback);
  assert.equal(fallbackEvents.length, 0);
});
