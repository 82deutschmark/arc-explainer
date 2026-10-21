/**
 * Author: Claude Opus 5.5
 * Date: 2026-10-21
 * PURPOSE: Guards the figures and checks on the team's ARC-AGI-2 eval run pages
 *          (client/src/components/teamEvals/evalStats.ts): which outputs each filter shows, the
 *          token sort, the per-output reference comparison, grid shapes and wrong cells (only
 *          for a same-shaped answer), and find-in-reasoning (case-insensitive, regex characters
 *          taken literally, capped).
 * SRP/DRY check: Pass - pure functions over hand-made rows, as tests/teamRunStats.test.ts does.
 */
import { expect, test } from 'vitest';
import type { EvalRow } from '../client/src/components/teamEvals/teamEvalsApi';
import {
  duration, findMatches, gridShape, referenceSplit, rowShows, showCounts, visibleRows, wrongCells,
} from '../client/src/components/teamEvals/evalStats';

const row = (outputKey: string, extra: Partial<EvalRow> = {}): EvalRow => ({
  outputKey, task: outputKey.slice(0, 8), testIndex: 0, ran: true, finish: 'stop', completionTokens: 1000,
  parsed: true, correct: false, hasTrace: true, ...extra,
});

const rows = [
  row('aaaaaaaa_0', { correct: true, completionTokens: 3000, refSolved: 0, refRuns: 4 }),
  row('bbbbbbbb_0', { completionTokens: 9000, cellsWrong: 2, sameShape: true, refSolved: 3, refRuns: 4 }),
  row('cccccccc_0', { parsed: false, finish: 'length', completionTokens: 65536, refSolved: 1, refRuns: 4 }),
  row('dddddddd_1', { ran: false, parsed: false, finish: null, completionTokens: null, hasTrace: false }),
  row('eeeeeeee_0', { correct: true, finish: 'length', completionTokens: 65000, refSolved: 4, refRuns: 4 }),
];

test('each filter shows the outputs it names', () => {
  const keys = (show: Parameters<typeof rowShows>[1]) => rows.filter((r) => rowShows(r, show)).map((r) => r.outputKey);
  expect(keys('solved')).toEqual(['aaaaaaaa_0', 'eeeeeeee_0']);
  expect(keys('wrong')).toEqual(['bbbbbbbb_0']);
  expect(keys('none')).toEqual(['cccccccc_0', 'dddddddd_1']);
  expect(keys('cap')).toEqual(['cccccccc_0', 'eeeeeeee_0']);
  expect(showCounts(rows)).toEqual({ all: 5, solved: 2, wrong: 1, none: 2, cap: 2 });
});

test('panel order is kept; the token sort flips and puts unknown counts last', () => {
  expect(visibleRows(rows, 'all', 'panel').map((r) => r.outputKey)).toEqual(rows.map((r) => r.outputKey));
  expect(visibleRows(rows, 'all', 'tokens-desc').map((r) => r.completionTokens)).toEqual([65536, 65000, 9000, 3000, null]);
  expect(visibleRows(rows, 'all', 'tokens-asc').map((r) => r.completionTokens)).toEqual([3000, 9000, 65000, 65536, null]);
  expect(visibleRows(rows, 'cap', 'tokens-asc').map((r) => r.outputKey)).toEqual(['eeeeeeee_0', 'cccccccc_0']);
});

test('against the per-output reference: solved here but never there, and the reverse', () => {
  // aaaaaaaa: we solve, ref 0/4 -> gained. bbbbbbbb and cccccccc: we miss, ref solved -> lost. dddddddd: no ref data.
  expect(referenceSplit(rows)).toEqual({ gained: 1, lost: 2, compared: 4 });
});

test('grid shapes, and wrong cells only when the answer has the expected shape', () => {
  expect(gridShape([[1, 2], [3, 4], [5, 6]])).toEqual([3, 2]);
  expect(gridShape([[1, 2], [3]])).toBeNull();
  expect(gridShape([])).toBeNull();
  expect(gridShape([[]])).toBeNull();
  expect(gridShape(null)).toBeNull();
  expect(gridShape('[[1]]')).toBeNull();

  const expected = [[1, 2], [3, 4]];
  expect(wrongCells(expected, [[1, 0], [3, 9]])).toEqual({ mask: [[false, true], [false, true]], wrong: 2 });
  expect(wrongCells(expected, [[1, 2], [3, 4]])).toEqual({ mask: [[false, false], [false, false]], wrong: 0 });
  expect(wrongCells(expected, [[1, 2, 0], [3, 4, 0]])).toBeNull();
  expect(wrongCells(expected, null)).toBeNull();
  expect(wrongCells(expected, [[1, 2], [3]])).toBeNull();
});

test('find in reasoning: case-insensitive, literal, capped', () => {
  const text = 'Rotate the grid. ROTATE again? (rotate) a.b a+b';
  expect(findMatches(text, 'rotate')).toEqual([0, 17, 32]);
  expect(findMatches(text, '(rotate)')).toEqual([31]);
  expect(findMatches(text, 'a.b')).toEqual([40]);
  expect(findMatches(text, 'a+b')).toEqual([44]);
  expect(findMatches(text, '')).toEqual([]);
  expect(findMatches(text, 'zzz')).toEqual([]);
  expect(findMatches('x'.repeat(50), 'x', 10)).toHaveLength(10);
});

test('durations read the way people say them', () => {
  expect(duration(42)).toBe('42s');
  expect(duration(17 * 60)).toBe('17m');
  expect(duration(2.4 * 3600)).toBe('2.4h');
  expect(duration(null)).toBe('—');
});
