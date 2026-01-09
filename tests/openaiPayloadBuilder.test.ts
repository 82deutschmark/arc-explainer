/**
 * Author: GPT-5 Codex
 * Date: 2026-01-08T20:25:33-05:00
 * PURPOSE: Verify Responses API payload construction for GPT-5 and GPT-4.1 models.
 * SRP/DRY check: Pass - Focused payload builder coverage only.
 */

/**
 * Author: gpt-5-codex
 * Date: 2025-10-18T00:00:00Z
 * PURPOSE: Verifies Responses API payload construction omits unsupported parameters
 *          for GPT-5 models and preserves temperature handling for legacy GPT-4.1 chat models.
 * SRP/DRY check: Pass — focused unit coverage for OpenAI payload temperature gating.
 */

import { test } from 'vitest';
import assert from "node:assert/strict";

import { buildResponsesPayload } from "../server/services/openai/payloadBuilder.ts";
import type { PromptPackage } from "../server/services/promptBuilder.ts";
import type { ServiceOptions } from "../server/services/base/BaseAIService.ts";

const promptPackage: PromptPackage = {
  systemPrompt: "Stay structured",
  userPrompt: "Solve the sample puzzle",
  selectedTemplate: null,
  isAlienMode: false,
  isSolver: true,
};

const emptyServiceOpts = {} as ServiceOptions;

function assertNoTemperature(payload: Record<string, unknown>) {
  assert.equal(
    Object.prototype.hasOwnProperty.call(payload, "temperature"),
    false,
    "temperature field should be omitted for unsupported models",
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(payload, "top_p"),
    false,
    "top_p should also be omitted when temperature is unsupported",
  );
}

test("GPT-5 reasoning models omit temperature", () => {
  const { body } = buildResponsesPayload({
    promptPackage,
    modelKey: "gpt-5-2025-08-07",
    temperature: 0.6,
    serviceOpts: emptyServiceOpts,
    testCount: 1,
  });

  assertNoTemperature(body);
});

test("Provider-prefixed GPT-5 chat omits temperature", () => {
  const { body } = buildResponsesPayload({
    promptPackage,
    modelKey: "openai/gpt-5-chat-latest",
    temperature: 0.4,
    serviceOpts: emptyServiceOpts,
    testCount: 2,
  });

  assertNoTemperature(body);
});

test("GPT-4.1 chat models still forward temperature", () => {
  const { body } = buildResponsesPayload({
    promptPackage,
    modelKey: "gpt-4.1-mini-2025-04-14",
    temperature: 0.3,
    serviceOpts: emptyServiceOpts,
    testCount: 1,
  });

  assert.equal(body.temperature, 0.3);
  assert.equal(body.top_p, 1);
});
