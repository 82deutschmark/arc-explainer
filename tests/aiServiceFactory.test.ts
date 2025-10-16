/**
 * Author: gpt-5-codex
 * Date: 2025-10-16T00:00:00Z
 * PURPOSE: Ensures aiServiceFactory canonicalizes OpenAI-prefixed model keys and
 *          routes them to the OpenAI provider while leaving other models intact.
 *          Guards against regressions when new providers are added to the routing table.
 * SRP/DRY check: Pass — isolates canonicalization behaviour without duplicating provider tests.
 */

import test from "node:test";
import { strict as assert } from "node:assert";

import { aiServiceFactory, canonicalizeModelKey } from "../server/services/aiServiceFactory.ts";

test("canonicalizeModelKey strips openai prefix", () => {
  const key = canonicalizeModelKey("openai/gpt-5-2025-08-07");
  assert.deepEqual(key, {
    original: "openai/gpt-5-2025-08-07",
    normalized: "gpt-5-2025-08-07",
  });
});

test("canonicalizeModelKey leaves non-prefixed models unchanged", () => {
  const key = canonicalizeModelKey("meta-llama/llama-401b");
  assert.deepEqual(key, {
    original: "meta-llama/llama-401b",
    normalized: "meta-llama/llama-401b",
  });
});

test("aiServiceFactory routes openai-prefixed model to OpenAI service", (t) => {
  const originalOpenai = (aiServiceFactory as any).openaiService;
  const originalOpenrouter = (aiServiceFactory as any).openrouterService;

  const fakeOpenai = { name: "openai" };
  const fakeOpenrouter = { name: "openrouter" };

  (aiServiceFactory as any).openaiService = fakeOpenai;
  (aiServiceFactory as any).openrouterService = fakeOpenrouter;

  t.after(() => {
    (aiServiceFactory as any).openaiService = originalOpenai;
    (aiServiceFactory as any).openrouterService = originalOpenrouter;
  });

  const routed = aiServiceFactory.getService("openai/gpt-5-mini");
  assert.equal(routed, fakeOpenai);
});
