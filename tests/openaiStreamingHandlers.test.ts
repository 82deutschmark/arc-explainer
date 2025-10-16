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

const { OpenAIService } = await import("../server/services/openai.ts");

test("OpenAI streaming handler emits text chunk deltas", () => {
  const service = new OpenAIService();
  const aggregates = {
    text: "",
    parsed: "",
    reasoning: "",
    summary: "",
    refusal: "",
    reasoningSummary: ""
  };

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

  (service as any).handleStreamingEvent(event, harness, aggregates);

  assert.equal(aggregates.text, "Hello");
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].type, "text");
  assert.equal(emitted[0].delta, "Hello");
  assert.equal(emitted[0].content, "Hello");
});

test("OpenAI streaming handler aggregates reasoning, JSON, and refusal deltas", () => {
  const service = new OpenAIService();
  const aggregates = {
    text: "",
    parsed: "",
    reasoning: "",
    summary: "",
    refusal: "",
    reasoningSummary: ""
  };

  const emitted: any[] = [];
  const harness = {
    sessionId: "session-test",
    emit: (chunk: any) => emitted.push(chunk),
    end: () => undefined,
    emitEvent: () => undefined
  };

  const reasoningEvent = { type: "response.reasoning_text.delta", delta: "Think", sequence_number: 2 } as any;
  const jsonEvent = { type: "response.output_json.delta", delta: "{\"key\":", sequence_number: 3 } as any;
  const jsonEventPart2 = { type: "response.output_json.delta", delta: "\"value\"}", sequence_number: 4 } as any;
  const refusalEvent = { type: "response.refusal.delta", delta: "No", sequence_number: 5 } as any;

  (service as any).handleStreamingEvent(reasoningEvent, harness, aggregates);
  (service as any).handleStreamingEvent(jsonEvent, harness, aggregates);
  (service as any).handleStreamingEvent(jsonEventPart2, harness, aggregates);
  (service as any).handleStreamingEvent(refusalEvent, harness, aggregates);

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
