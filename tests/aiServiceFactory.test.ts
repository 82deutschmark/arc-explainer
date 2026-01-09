/**
 * Author: GPT-5 Codex
 * Date: 2026-01-08T20:25:33-05:00
 * PURPOSE: Verify aiServiceFactory canonicalization and routing for provider-prefixed
 *          model keys without invoking real providers.
 * SRP/DRY check: Pass - Focused routing behavior only.
 */


import { test, expect } from 'vitest';

import { aiServiceFactory, canonicalizeModelKey } from "../server/services/aiServiceFactory.ts";

test('canonicalizeModelKey strips openai prefix', () => {
  const key = canonicalizeModelKey('openai/gpt-5-2025-08-07');
  expect(key).toEqual({
    original: 'openai/gpt-5-2025-08-07',
    normalized: 'gpt-5-2025-08-07',
  });
});

test('canonicalizeModelKey leaves non-prefixed models unchanged', () => {
  const key = canonicalizeModelKey('meta-llama/llama-401b');
  expect(key).toEqual({
    original: 'meta-llama/llama-401b',
    normalized: 'meta-llama/llama-401b',
  });
});

test('aiServiceFactory routes openai-prefixed model to OpenAI service', () => {
  const originalOpenai = (aiServiceFactory as any).openaiService;
  const originalOpenrouter = (aiServiceFactory as any).openrouterService;

  const fakeOpenai = { name: 'openai' };
  const fakeOpenrouter = { name: 'openrouter' };

  (aiServiceFactory as any).openaiService = fakeOpenai;
  (aiServiceFactory as any).openrouterService = fakeOpenrouter;

  try {
    const routed = aiServiceFactory.getService('openai/gpt-5-mini');
    expect(routed).toBe(fakeOpenai);
  } finally {
    (aiServiceFactory as any).openaiService = originalOpenai;
    (aiServiceFactory as any).openrouterService = originalOpenrouter;
  }
});
