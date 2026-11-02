/**
 * Author: GPT-6 / Codex (reasoning effort not exposed)
 * Date: 02-November-2026
 * PURPOSE: Guard team-name identity, sporting semantics, native precision and unrelated quantities.
 * SRP/DRY check: Pass — test the shared browser/server run classifier.
 */
import { expect, it, vi } from 'vitest';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { figureRuns, figuresHtml, statScores, statTeamNames } from '../shared/newsFigures';
import fs from 'node:fs';
import { SportsText } from '../client/src/components/news/SportsText';
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

it('keeps margins and point gains distinct from absolute scores', () => {
  const text = 'Tufa guards a 0.84-point lead on a score of 88.06, just 0.84 ahead of a rival on 87.22. A gain of 21.88 points sends infinity to #6.';
  const runs = figureRuns(text, [88.06, 87.22]).filter(run => run.kind);
  expect(runs.map(run => [run.kind, run.text])).toEqual([['difference', '0.84'], ['score', '88.06'], ['difference', '0.84'], ['score', '87.22'], ['difference', '21.88'], ['place', '#6']]);
  expect(figuresHtml('A 0.84-point lead', x => x)).toContain('class="sd">0.84');
});

it('highlights infinity in its real filed story, preserving its spelling and sporting figures', () => {
  const story = JSON.parse(fs.readFileSync('docs/newsroom/2026-11-02-late-edition-filing/arc-3-article.json', 'utf8'));
  const names = statTeamNames(story.stats);
  const text = story.sections[0].text;
  const runs = figureRuns(text, statScores(story.stats), [], names);
  expect(runs.filter(run => run.kind === 'team').map(run => run.text)).toContain('Infinity');
  expect(runs.map(run => run.text).join('')).toBe(text);
  expect(figuresHtml(text, value => value, statScores(story.stats), [], names)).toContain('<strong class="news-team-name">Infinity</strong>');
});

it('renders the real infinity story identically through React and the server formatter', () => {
  const story = JSON.parse(fs.readFileSync('docs/newsroom/2026-11-02-late-edition-filing/arc-3-article.json', 'utf8'));
  const text = story.sections.map((section: { text: string }) => section.text).join('\n');
  const escaped = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' })[char]!);
  vi.stubGlobal('React', React);
  try {
    const html = renderToStaticMarkup(createElement(SportsText, { text, stats: story.stats }));
    expect(html).toBe(figuresHtml(text, escaped, statScores(story.stats), [], statTeamNames(story.stats)));
    expect(html).toContain('<strong class="news-team-name">Infinity</strong>');
  } finally { vi.unstubAllGlobals(); }
});

it('matches whole verified names, longest first, including Japanese and literal punctuation', () => {
  const names = ['GPU', 'All your GPU are belong to us', '大阪公立大学 & Maciej & Natalia', 'a+b'];
  const text = 'All your GPU are belong to us, 大阪公立大学 & Maciej & Natalia and a+b climb. GPUs and aab do not.';
  expect(figureRuns(text, [], [], names).filter(run => run.kind === 'team').map(run => run.text)).toEqual([
    'All your GPU are belong to us', '大阪公立大学 & Maciej & Natalia', 'a+b',
  ]);
});

it('leaves ordinary words, substrings, URLs and unrelated names alone', () => {
  const text = 'The team made progress at https://infinity.example. Infinite infinitys are not infinity. Progress and Infinity climb; tascj is elsewhere.';
  const runs = figureRuns(text, [], [], ['the', 'team', 'at', 'Progress', 'infinity']);
  expect(runs.filter(run => run.kind === 'team').map(run => run.text)).toEqual(['infinity', 'Progress', 'Infinity']);
  expect(runs.map(run => run.text).join('')).toBe(text);
});

it('keeps a numeric team name intact while rendering separate places and scores', () => {
  const text = 'Team 42 reaches #7 with a score of 42.5. 42 teams entered.';
  const runs = figureRuns(text, [42.5], [], ['Team 42']);
  expect(runs.filter(run => run.kind).map(run => [run.kind, run.text])).toEqual([
    ['team', 'Team 42'], ['place', '#7'], ['score', '42.5'],
  ]);
  expect(figuresHtml('<Team & Co>', value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'), [], [], ['Team & Co']))
    .toBe('&lt;<strong class="news-team-name">Team &amp; Co</strong>&gt;');
});
