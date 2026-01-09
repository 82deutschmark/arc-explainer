/**
 * Author: GPT-5 Codex
 * Date: 2026-01-08T20:25:33-05:00
 * PURPOSE: Validate Worm Arena placement phase classification and progress tracking
 *          from SnakeBenchModelRating snapshots.
 * SRP/DRY check: Pass - Focused on placement helper behavior only.
 */

import { describe, it, expect } from 'vitest';
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

describe('summarizeWormArenaPlacement', () => {
  it('handles not-started models', () => {
    const rating = makeRating({ gamesPlayed: 0 });
    const summary = summarizeWormArenaPlacement(rating)!;

    expect(summary.phase).toBe('not_started');
    expect(summary.gamesPlayed).toBe(0);
    expect(summary.progress).toBe(0);
  });

  it('marks placement in progress before 9 games with high sigma', () => {
    const rating = makeRating({ gamesPlayed: 3, sigma: 7 });
    const summary = summarizeWormArenaPlacement(rating)!;

    expect(summary.phase).toBe('in_progress');
    expect(summary.progress).toBeGreaterThan(0);
    expect(summary.progress).toBeLessThan(1);
  });

  it('marks placement effectively complete when sigma is low', () => {
    const rating = makeRating({ gamesPlayed: 4, sigma: 2.5 });
    const summary = summarizeWormArenaPlacement(rating)!;

    expect(summary.phase).toBe('effectively_complete');
  });

  it('marks placement complete at or after 9 games', () => {
    const rating = makeRating({ gamesPlayed: 9, sigma: 4 });
    const summary = summarizeWormArenaPlacement(rating)!;

    expect(summary.phase).toBe('complete');
    expect(summary.progress).toBe(1);
  });
});
