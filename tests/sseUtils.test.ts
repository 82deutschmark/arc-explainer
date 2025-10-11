import { strict as assert } from "node:assert";
import test from "node:test";
import { parseSseEvent } from "../server/services/streaming/sseUtils.ts";

test("parseSseEvent parses JSON payloads", () => {
  const raw = "event: response.output_text.delta\ndata: {\"delta\":\"hi\"}";
  const parsed = parseSseEvent(raw);
  assert.equal(parsed?.event, "response.output_text.delta");
  assert.deepEqual(parsed?.data, { delta: "hi" });
});

test("parseSseEvent returns done event for [DONE]", () => {
  const parsed = parseSseEvent("data: [DONE]");
  assert.equal(parsed?.event, "done");
});

test("parseSseEvent returns plain string data when JSON fails", () => {
  const raw = "event: response.reasoning_text.delta\ndata: not-json";
  const parsed = parseSseEvent(raw);
  assert.equal(parsed?.event, "response.reasoning_text.delta");
  assert.equal(parsed?.data, "not-json");
});


