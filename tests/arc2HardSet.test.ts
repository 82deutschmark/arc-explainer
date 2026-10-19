/**
 * Author: Claude Fable 5.1 High
 * Date: 19-October-2026
 * PURPOSE: Guards the shared ARC-AGI-2 hard-set constants: the solve-count buckets, and that every
 *          Dr. Fable solve note points at a real ARC2 public-eval task and keeps the Boss's shape
 *          (a handful of plain bullets, an honest confidence level).
 * SRP/DRY check: Pass — exercises shared/arc2HardSet.ts against the shipped dataset files, no database.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from 'vitest';
import {
  ARC2_HARD_SET_MAX_SOLVES,
  ARC2_HARD_SET_NOTES,
  ARC2_HARD_SET_CONFIDENCE_LABELS,
  bucketForSolves,
} from '../shared/arc2HardSet';

test('solve counts map onto never / once / twice and nothing past the threshold', () => {
  expect(bucketForSolves(0)).toBe('never');
  expect(bucketForSolves(1)).toBe('once');
  expect(bucketForSolves(2)).toBe('twice');
  expect(bucketForSolves(ARC2_HARD_SET_MAX_SOLVES + 1)).toBeNull();
  expect(bucketForSolves(-1)).toBeNull();
  expect(bucketForSolves(1.5)).toBeNull();
});

test('every solve note names a shipped ARC2 evaluation task and keeps the plain-bullet shape', () => {
  const ids = Object.keys(ARC2_HARD_SET_NOTES);
  expect(ids.length).toBeGreaterThan(0);
  for (const id of ids) {
    const note = ARC2_HARD_SET_NOTES[id];
    expect(note.id).toBe(id);
    expect(id).toMatch(/^[0-9a-f]{8}$/);
    expect(existsSync(join(process.cwd(), 'data', 'evaluation2', `${id}.json`))).toBe(true);
    expect(note.bullets.length).toBeGreaterThanOrEqual(3);
    expect(note.bullets.length).toBeLessThanOrEqual(10);
    expect(ARC2_HARD_SET_CONFIDENCE_LABELS[note.confidence]).toBeTruthy();
    // A 'partial' note must say so in its own words; that honesty is the point of the field.
    if (note.confidence === 'partial') {
      expect(note.bullets.some((line) => /honest note/i.test(line))).toBe(true);
    }
  }
});
