/**
 * Feature Flag Helper Tests
 *
 * Author: gpt-5-codex
 * Date: 2025-02-17T00:00:00Z
 * PURPOSE: Ensure environment flag normalization recognises common truthy values across server and client usage.
 * SRP/DRY check: Pass — focused regression coverage for shared helper only.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { isFeatureFlagEnabled } from '../shared/utils/featureFlags.ts';

test('isFeatureFlagEnabled accepts uppercase TRUE', () => {
  assert.equal(isFeatureFlagEnabled('TRUE'), true);
});

test('isFeatureFlagEnabled accepts numeric 1', () => {
  assert.equal(isFeatureFlagEnabled('1'), true);
});

test('isFeatureFlagEnabled treats other values as disabled', () => {
  assert.equal(isFeatureFlagEnabled('nope'), false);
  assert.equal(isFeatureFlagEnabled(''), false);
  assert.equal(isFeatureFlagEnabled(undefined), false);
});
