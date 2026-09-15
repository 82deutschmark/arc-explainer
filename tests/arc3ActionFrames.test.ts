/*
Author: Codex (GPT-6)
Date: 2026-09-12
PURPOSE: Verify presentation animation preserves engine observations and native frames.
SRP/DRY check: Pass — tests public playback contract rather than pixel styling details.
*/
import { describe, expect, it } from 'vitest';
import { actionPlayback } from '../shared/arc3ActionFrames';

const board = () => Array.from({ length: 64 }, () => Array(64).fill(5));
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
