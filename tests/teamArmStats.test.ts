/**
 * Author: Claude Opus 5.5
 * Date: 2026-10-21
 * PURPOSE: Guards the figures on the runs API's speed / kernel / profile pages
 *          (client/src/components/teamEvals/armStats.ts): metric labels and directions (the run's
 *          own metricInfo over the documented names over a suffix guess), the metric rows in
 *          first-reported order, the best arm per row (only arms that ran, no winner on a tie),
 *          the baseline arm, the profile rows by family, ratios, number text and the list's
 *          headline metric.
 * SRP/DRY check: Pass - pure functions over hand-made arms, as tests/teamEvalStats.test.ts does.
 */
import { expect, test } from 'vitest';
import type { RunArm } from '../client/src/components/teamEvals/teamEvalsApi';
import {
  baselineIndex, bestIndex, headlineMetric, metricInfo, metricRows, metricText, profileRows, ratio, rowDigits,
} from '../client/src/components/teamEvals/armStats';

const arms: RunArm[] = [
  { name: 'marlin', metrics: { genTokS: 448.4, stepMs: 75.8, kvTokens: 1123853 },
    profile: { spanMsPerIter: 80, gpuBusyFrac: 0.912, familiesMs: { moe: 30.1, dense_int8: 12.5, attn: 8 } } },
  { name: 'triton', status: 'ok', metrics: { genTokS: 471.2, stepMs: 72.2, denseMsPerStep: 9.1 },
    profile: { spanMsPerIter: 76, gpuBusyFrac: 0.93, familiesMs: { moe: 30.0, dense_int8: 9.4, attn: 8 } } },
  { name: 'humming', status: 'failed', error: 'kernel check failed', metrics: { genTokS: 500 } },
];

test('metric info: the run\'s own over the documented names over the suffix', () => {
  expect(metricInfo('genTokS')).toMatchObject({ label: 'decode tok/s', better: 'higher' });
  expect(metricInfo('stepMs')).toMatchObject({ better: 'lower', unit: 'ms' });
  expect(metricInfo('denseMsPerStep.m17')).toMatchObject({ label: 'denseMsPerStep · m=17', unit: 'ms', better: 'lower' });
  expect(metricInfo('gdn_in_qkvz.m4096Us')).toMatchObject({ label: 'gdn_in_qkvz · m=4096', unit: 'µs', better: 'lower' });
  expect(metricInfo('kvUsageMax').better).toBeUndefined();
  expect(metricInfo('numMsgs').better).toBeUndefined();
  expect(metricInfo('dense.m17Ms')).toMatchObject({ better: 'lower', unit: 'ms' });
  expect(metricInfo('gemmUs.m1')).toMatchObject({ better: 'lower' });
  expect(metricInfo('batchTokS')).toMatchObject({ better: 'higher' });
  expect(metricInfo('lanes').better).toBeUndefined();
  expect(metricInfo('genTokS', { genTokS: { label: 'tok/s (window)' } })).toMatchObject({ label: 'tok/s (window)', better: 'higher' });
});

test('metric rows: every metric any arm reports, first-reported order, best among arms that ran', () => {
  const rows = metricRows(arms);
  expect(rows.map((r) => r.key)).toEqual(['genTokS', 'stepMs', 'kvTokens', 'denseMsPerStep']);
  const tok = rows[0];
  expect(tok.values).toEqual([448.4, 471.2, 500]);
  expect(tok.best).toBe(1);                             // the failed arm's 500 is not ranked
  expect(rows[1].best).toBe(1);                         // lower step ms wins
  expect(rows[2].best).toBeNull();                      // one arm only: nothing to rank
  expect(bestIndex([5, 5], [{ name: 'a' }, { name: 'b' }], 'higher')).toBeNull();
  expect(bestIndex([5, 7], [{ name: 'a' }, { name: 'b' }], undefined)).toBeNull();
});

test('baseline: the named arm, else the first that ran', () => {
  expect(baselineIndex(arms, 'triton')).toBe(1);
  expect(baselineIndex(arms, 'nope')).toBe(0);
  expect(baselineIndex([{ name: 'x', status: 'failed' }, { name: 'y' }])).toBe(1);
  expect(baselineIndex([{ name: 'x', status: 'skipped' }])).toBe(-1);
});

test('profile rows: span, GPU busy as a percent, then families by the baseline\'s time', () => {
  const rows = profileRows(arms, 0);
  expect(rows.map((r) => r.key)).toEqual(['spanMsPerIter', 'gpuBusyPct', 'family:moe', 'family:dense_int8', 'family:attn']);
  expect(rows[1].values).toEqual([91.2, 93, null]);
  expect(rows[3].best).toBe(1);
  expect(rows[4].best).toBeNull();                      // a tie
  expect(profileRows([{ name: 'a', metrics: { genTokS: 1 } }], 0)).toEqual([]);
});

test('ratios, number text and the headline metric', () => {
  expect(ratio(471.2, 448.4)).toBeCloseTo(1.0508, 3);
  expect(ratio(null, 1)).toBeNull();
  expect(ratio(1, 0)).toBeNull();
  expect(metricText(1123853)).toBe('1,123,853');
  expect(metricText(448.44)).toBe('448.4');
  expect(metricText(75.844)).toBe('75.84');
  expect(metricText(0.8521)).toBe('0.852');
  expect(metricText(34)).toBe('34');
  expect(metricText(null)).toBe('—');
  expect(metricText(30, 2)).toBe('30.00');
  expect(rowDigits([30.1, 30, null])).toBe(2);
  expect(rowDigits([8, 8])).toBe(0);
  expect(rowDigits([448.4, 3012.44])).toBe(0);
  expect(rowDigits([null])).toBe(0);
  expect(headlineMetric(arms)).toBe('genTokS');
  expect(headlineMetric(arms, 'stepMs')).toBe('stepMs');
  expect(headlineMetric(arms, 'missing')).toBe('genTokS');
  expect(headlineMetric([{ metrics: { denseMsPerStep: 9 } }])).toBe('denseMsPerStep');
  expect(headlineMetric([{ metrics: null }])).toBeNull();
});
