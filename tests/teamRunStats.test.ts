/**
 * Author: Claude Opus 5.5 Low
 * Date: 2026-10-19
 * PURPOSE: Guards the figures and filters on the team's ARC-AGI-2 runs screen
 *          (client/src/components/teamRuns/runStats.ts): which runs set a new team best, the
 *          team and per-person figures, the verdict pulled from Claude's note, search across
 *          notes, and that a filtered view survives the round trip through the address.
 * SRP/DRY check: Pass - pure functions over hand-made rows.
 */
import { expect, test } from 'vitest';
import type { RunRow } from '../client/src/components/teamRuns/teamRunsApi';
import {
  DEFAULT_FILTER, applyFilter, newBestKeys, noteSection, readFilter, teamStats, writeFilter,
} from '../client/src/components/teamRuns/runStats';

const run = (key: string, at: string, who: string, score: number | null, extra: Partial<RunRow> = {}): RunRow => ({
  key, submittedAt: at, submittedBy: who.toLowerCase(), who, description: `run ${key}`,
  status: score == null ? 'error' : 'complete', publicScore: score, kernel: null, proposedBaseline: null,
  output: null, publishedAt: null, summary: null, note: null, ...extra,
});

const rows = [
  run('1', '2026-10-01T00:00:00Z', 'Jack Cole', 30),
  run('2', '2026-10-02T00:00:00Z', 'Son', 28),
  run('3', '2026-10-03T00:00:00Z', 'Jack Cole', 36.94, {
    summary: { state: 'done', markdown: '## Change\nx\n## Verdict\n- Landed as **described**.\n', baselineKey: '1' },
  }),
  run('4', '2026-10-04T00:00:00Z', 'Boss', null),
  run('5', '2026-10-05T00:00:00Z', 'Jack Cole', 36.94),
];

test('new team bests are the runs that beat everything before them', () => {
  expect([...newBestKeys(rows)].sort()).toEqual(['1', '3']);
});

test('team and per-person figures come straight from the rows', () => {
  const s = teamStats(rows, Date.parse('2026-10-06T00:00:00Z'));
  expect(s.best?.key).toBe('3');
  expect(s.latest?.key).toBe('5');
  expect([s.total, s.scoredCount, s.failedCount, s.lastWeek]).toEqual([5, 4, 1, 5]);
  const jack = s.people.find((p) => p.who === 'Jack Cole')!;
  expect([jack.count, jack.best?.key, jack.latest.key]).toEqual([3, '3', '5']);
});

test("the verdict is read out of Claude's note as plain text", () => {
  expect(noteSection(rows[2].summary!.markdown, 'Verdict')).toBe('Landed as described.');
  expect(noteSection(null, 'Verdict')).toBeNull();
});

test('search reaches into notes, and filters combine', () => {
  const best = newBestKeys(rows);
  expect(applyFilter(rows, { ...DEFAULT_FILTER, q: 'landed' }, best).map((r) => r.key)).toEqual(['3']);
  expect(applyFilter(rows, { ...DEFAULT_FILTER, who: 'Jack Cole', show: 'best' }, best).map((r) => r.key)).toEqual(['3', '1']);
  expect(applyFilter(rows, { ...DEFAULT_FILTER, show: 'failed' }, best).map((r) => r.key)).toEqual(['4']);
  expect(applyFilter(rows, { ...DEFAULT_FILTER, sort: 'score' }, best).map((r) => r.key)).toEqual(['5', '3', '1', '2', '4']);
});

test('a filtered view survives the address, and the plain view has a plain address', () => {
  const f = { ...DEFAULT_FILTER, q: 'nvarc', who: 'Son', since: '7d' as const, show: 'scored' as const };
  expect(readFilter(writeFilter(f))).toEqual(f);
  expect(writeFilter(DEFAULT_FILTER)).toBe('');
});
