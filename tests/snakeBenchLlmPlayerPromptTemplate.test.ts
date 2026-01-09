/**
 * Author: GPT-5 Codex
 * Date: 2026-01-08T20:25:33-05:00
 * PURPOSE: Regression coverage for Worm Arena prompt template alignment.
 * SRP/DRY check: Pass - Focused prompt bundle checks only.
 */

import { test } from 'vitest';
import { strict as assert } from 'node:assert';

import {
  loadWormArenaPromptTemplateBundle,
  getCanonicalFixedLines,
} from '../server/services/snakeBench/SnakeBenchLlmPlayerPromptTemplate.ts';

test('Worm Arena LLM prompt template bundle loads and contains expected fields', async () => {
  const bundle = await loadWormArenaPromptTemplateBundle();

  // Sanity checks for B1 (live python).
  assert.equal(typeof bundle.pythonSourcePath, 'string');
  assert.ok(bundle.pythonSourcePath.length > 0);
  assert.equal(typeof bundle.pythonSource, 'string');
  assert.ok(bundle.pythonSource.includes('class LLMPlayer'));
  assert.equal(typeof bundle.pythonPromptBuilderBlock, 'string');
  assert.ok(bundle.pythonPromptBuilderBlock.includes('prompt = ('));
  assert.ok(bundle.pythonPromptBuilderBlock.includes('Rules and win conditions:'));

  // Sanity checks for B2 (canonical TS template).
  assert.equal(typeof bundle.canonicalTemplate, 'string');
  assert.ok(bundle.canonicalTemplate.includes('Rules and win conditions:'));
  assert.ok(bundle.canonicalTemplate.includes('{APPLE_TARGET}'));

  // Apple target should be readable from SnakeBench constants in dev.
  // If the upstream file is missing in certain deployment contexts, null is acceptable.
  if (bundle.appleTarget !== null) {
    assert.equal(typeof bundle.appleTarget, 'number');
    assert.ok(Number.isFinite(bundle.appleTarget));
    assert.ok(bundle.appleTarget > 0);
  }
});

test('Canonical fixed prompt lines appear in SnakeBench Python source (drift detector)', async () => {
  const bundle = await loadWormArenaPromptTemplateBundle();
  const fixedLines = getCanonicalFixedLines();

  // IMPORTANT: We validate against the full python source, not just the extracted block,
  // to be robust against minor slicing mistakes.
  fixedLines.forEach((line) => {
    assert.ok(
      bundle.pythonSource.includes(line),
      `Expected python source to include canonical fixed line: ${line}`,
    );
  });

  // Ensure the output contract is present (this is the most critical integration rule).
  assert.ok(
    bundle.pythonSource.includes(
      'The final non-empty line of your response must be exactly one word: UP, DOWN, LEFT, or RIGHT.',
    ),
    'Expected output contract to be present in python prompt',
  );
});
