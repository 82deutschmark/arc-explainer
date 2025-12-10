/**
 * Author: Cascade
 * Date: 2025-12-10
 * PURPOSE: Tests for Worm Arena placement helper to ensure consistent
 *          classification of placement phases and progress based on
 *          SnakeBenchModelRating snapshots.
 * SRP/DRY check: Pass — focused on pure helper behaviour only.
 */

import test from 'node:test';
import { strict as assert } from 'node:assert';

import type { SnakeBenchModelRating } from '../shared/types.ts';
import { summarizeWormArenaPlacement } from '../shared/utils/wormArenaPlacement.ts';

function makeRating(partial: Partial<SnakeBenchModelRating>): SnakeBenchModelRating {
  return {
    modelSlug: 'test/model',
    mu: 25,
    sigma: 8.33,
    exposed: 0,
    displayScore: 0,
    wins: 0,
    losses: 0,
    ties: 0,
    applesEaten: 0,
    gamesPlayed: 0,
    ...partial,
  };
}

test('summarizeWormArenaPlacement handles not-started models', () => {
  const rating = makeRating({ gamesPlayed: 0 });
  const summary = summarizeWormArenaPlacement(rating)!;

  assert.equal(summary.phase, 'not_started');
  assert.equal(summary.gamesPlayed, 0);
  assert.equal(summary.progress, 0);
});

test('summarizeWormArenaPlacement marks placement in progress before 9 games with high sigma', () => {
  const rating = makeRating({ gamesPlayed: 3, sigma: 7 });
  const summary = summarizeWormArenaPlacement(rating)!;

  assert.equal(summary.phase, 'in_progress');
  assert.ok(summary.progress > 0 && summary.progress < 1);
});

test('summarizeWormArenaPlacement marks placement effectively complete when sigma is low', () => {
  const rating = makeRating({ gamesPlayed: 4, sigma: 2.5 });
  const summary = summarizeWormArenaPlacement(rating)!;

  assert.equal(summary.phase, 'effectively_complete');
});

test('summarizeWormArenaPlacement marks placement complete at or after 9 games', () => {
  const rating = makeRating({ gamesPlayed: 9, sigma: 4 });
  const summary = summarizeWormArenaPlacement(rating)!;

  assert.equal(summary.phase, 'complete');
  assert.equal(summary.progress, 1);
});
