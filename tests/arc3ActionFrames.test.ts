/*
Author: Codex (GPT-6)
Date: 2026-09-16
PURPOSE: Verify presentation animation preserves engine observations and native frames.
SRP/DRY check: Pass — tests public playback contract rather than pixel styling details.
*/
import { describe, expect, it } from 'vitest';
import { actionPlayback, usesNativeTranslation } from '../shared/arc3ActionFrames';

const board = () => Array.from({ length: 64 }, () => Array(64).fill(5));
describe('feedback-revised movement', () => {
  it('uses the revised scope through canonical and public names', () => {
    expect(usesNativeTranslation('g136')).toBe(true);
    expect(usesNativeTranslation('AK36')).toBe(true);
    expect(usesNativeTranslation('g006')).toBe(false);
    expect(usesNativeTranslation('bp35')).toBe(false);
    expect(usesNativeTranslation(undefined)).toBe(false);
  });
  it('plays every rigid movement frame at the approved pace', () => {
    const frames = Array.from({ length: 5 }, (_, i) => {
      const grid = board();
      grid[10][10+i] = 8; grid[10][11+i] = 9; grid[11][10+i] = 0;
      return grid;
    });
    const saved = JSON.stringify(frames);
    const playback = actionPlayback(board(), frames, true, false, true);
    expect(playback.frames).toBe(frames);
    expect(playback.intervalMs).toBe(40);
    expect(JSON.stringify(frames)).toBe(saved);
  });
  it('does not invent pixels for blocked moves, waits or state-only frames', () => {
    const before = board(), after = board();
    after[10][10] = 8;
    for (const last of [before, after]) {
      const playback = actionPlayback(before, [last], true, false, true);
      expect(playback.frames).toEqual([last]);
      expect(playback.frames[0]).toBe(last);
    }
  });
  it('respects reduced motion, reset and undo', () => {
    const frames = [board(), board(), board()];
    expect(actionPlayback(board(), frames, false, false, true).frames).toEqual([frames[2]]);
    expect(actionPlayback(board(), frames, true, true, true).frames).toEqual([frames[2]]);
  });
});

describe('community action playback', () => {
  it('animates an instant move without changing its exact final observation or inputs', () => {
    const before = board(), after = board();
    before[10][10] = 8; after[10][16] = 8;
    const saved = JSON.stringify([before, after]);
    const result = actionPlayback(before, [after], true);
    expect(result.frames.length).toBeGreaterThan(1);
    expect(result.frames.at(-1)).toBe(after);
    expect(result.frames.slice(0, -1).some(g => g[10].slice(11, 16).includes(8))).toBe(true);
    expect(JSON.stringify([before, after])).toBe(saved);
    expect(result.intervalMs * (result.frames.length - 1)).toBeLessThanOrEqual(200);
  });
  it('preserves every native water/wakeup frame and its order', () => {
    const frames = Array.from({ length: 45 }, board);
    const result = actionPlayback(board(), frames, true);
    expect(result.frames).toBe(frames);
    expect(result.intervalMs).toBeLessThan(65);
  });
  it('settles immediately for reset, undo, load and reduced motion', () => {
    const frames = [board(), board()];
    expect(actionPlayback(board(), frames, false).frames).toEqual([frames[1]]);
    expect(actionPlayback(board(), frames, true, true).frames).toEqual([frames[1]]);
  });
  it('handles empty replies, changed geometry and unchanged actions', () => {
    expect(actionPlayback(board(), [], true).frames).toEqual([]);
    const small = [[1]];
    expect(actionPlayback(board(), [small], true).frames).toEqual([small]);
    const after = board();
    const result = actionPlayback(after, [after], true);
    expect(result.frames.at(-1)).toBe(after);
    expect(result.frames[0]).not.toEqual(after);
  });
});
