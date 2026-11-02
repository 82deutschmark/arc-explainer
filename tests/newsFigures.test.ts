/**
 * Author: GPT-6 / Codex (reasoning effort not exposed)
 * Date: 02-November-2026
 * PURPOSE: Guard sporting semantics, native precision and unrelated quantities.
 * SRP/DRY check: Pass — test the shared browser/server run classifier.
 */
import { expect, it } from 'vitest';
import { figureRuns, figuresHtml, statScores } from '../shared/newsFigures';
it('distinguishes explicit places and scores from dates, money, versions and counts', () => {
  const text = 'On November 2, 2026, model v3.8 cost $50,000 for 8 teams and 1.5 hours. It reached 14th with a score of 0.123456789.';
  const figures = figureRuns(text, [3.8, 8, 1.5, 0.123456789]).filter(run => run.kind);
  expect(figures.map(run => [run.kind, run.text])).toEqual([['place', '#14'], ['score', '0.123456789']]);
});
it('binds current and earlier score text to the dated box score without rounding it', () => {
  const values = statScores([{ score: 55.14, scoreChange: 18.2 }]);
  expect(figureRuns('It rises from 36.94 to 55.14; 55 teams use 4 GPUs.', values).filter(run => run.kind).map(run => run.text)).toEqual(['36.94', '55.14']);
});
it('preserves quoted wording, missing values and unknown decimals', () => {
  const runs = figureRuns('“We were 14th” in November, with 2.345 hours left. Score not available.');
  expect(runs.every(run => !run.kind)).toBe(true);
  expect(figureRuns('A model version goes from 3.8 to 4.0 and a run takes from 1.5 to 2.0 hours.', [88.06, 3.8, 4.0]).every(run => !run.kind)).toBe(true);
  expect(figureRuns("He said 'I'm 14th' yesterday.").every(run => !run.kind)).toBe(true);
});
it('uses matching semantics in the server page and keeps unsafe prose escaped', () => {
  const html = figuresHtml('Place 491, score 18.99 <img>', s => s.replaceAll('<', '&lt;').replaceAll('>', '&gt;'));
  expect(html).toContain('class="pl">#491'); expect(html).toContain('class="sc">18.99'); expect(html).toContain('&lt;img&gt;');
});
