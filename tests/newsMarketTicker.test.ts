/**
 * Author: GPT-6 / Codex (reasoning effort not exposed)
 * Date: 14-Nov-2026 (Claude Opus 5.5); 03-November-2026
 * 14-Nov-2026 (Claude Opus 5.5): the note prints each board's full save date, and a board past the
 *          freshness window says "not updated since" (W4).
 * PURPOSE: Check that the newspaper's board ticker distinguishes an upcoming
 *          submission cutoff from closed submissions at the current UTC deadline,
 *          even when the saved board observation predates the close,
 *          without presenting provisional public standings as final results.
 * SRP/DRY check: Pass — renders the production ticker using its real board builder
 *          and registered competition deadline; synthetic standings stay in tests.
 */
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import { MarketTicker } from '../client/src/components/news/NewsMarkets';
import { KAGGLE_COMPETITIONS } from '../shared/kaggleCompetitions';
import { buildMarketBoard, type MarketBoard } from '../shared/newsMarkets';
import { newsDate } from '../shared/news';

const cutoff = KAGGLE_COMPETITIONS['arc-3'].closeAt!;
const cutoffMs = Date.parse(cutoff);

function boardAt(fetched: string): MarketBoard {
  return buildMarketBoard('arc-3', {
    fetched, teams: 1, ourTeamId: 'none', medalRanks: { gold: 1, silver: 1, bronze: 1 },
    rows: [[1, 'test-team', 'Ticker test team', '2026-11-01 12:00:00', 1, 1, 'testmember', null, null]],
  }, { snaps: [], trails: {} }, [], [])!;
}

function tickerText(board: MarketBoard, currentTime: string): string {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(currentTime));
  vi.stubGlobal('React', React);
  const html = renderToStaticMarkup(createElement(MarketTicker, {
    markets: { generatedAt: board.fetched, boards: { 'arc-3': board } },
  }));
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('keeps the countdown before the registered UTC submission deadline', () => {
  const text = tickerText(boardAt(new Date(cutoffMs - 3_600_000).toISOString()), new Date(cutoffMs - 1).toISOString());
  expect(text).toContain('Close 1 day');
  expect(text).not.toContain('Submissions closed');
});

it.each([cutoff, new Date(cutoffMs + 1).toISOString()])('says submissions closed at or after the cutoff: %s', currentTime => {
  const text = tickerText(boardAt(currentTime), currentTime);
  expect(text).toContain('Submissions closed');
  expect(text).not.toContain('0 days');
  expect(text).toContain('medals settle on the private board');
});

it('uses the absolute deadline when the board observation has an explicit timezone offset', () => {
  const sameInstantWithOffset = new Date(cutoffMs - 5 * 3_600_000).toISOString().replace('Z', '-05:00');
  const text = tickerText(boardAt(sameInstantWithOffset), cutoff);
  expect(text).toContain('Submissions closed');
  expect(text).toContain('23:59 UTC');
});

it('does not invent a closed status when the submission deadline is unknown', () => {
  const text = tickerText({ ...boardAt(cutoff), closeAt: null }, cutoff);
  expect(text).not.toContain('Submissions closed');
  expect(text).not.toContain('0 days');
  expect(text).toContain('Ticker test team');
});

it('closes stale pre-deadline standings using the current clock while preserving their saved time', () => {
  const savedAt = new Date(cutoffMs - 3_600_000).toISOString();
  const board = boardAt(savedAt);
  const text = tickerText(board, new Date(cutoffMs + 60_000).toISOString());
  expect(text).toContain('Submissions closed');
  expect(text).not.toContain('Close 1 day');
  expect(text).toContain(`ARC-AGI-3 saved ${newsDate(savedAt, true)}`);
  expect(text).toContain('22:59 UTC');
  expect(board.fetched).toBe(savedAt);
});

it('dates a board that stopped updating instead of passing it off as current', () => {
  const savedAt = new Date(cutoffMs - 3 * 24 * 3_600_000).toISOString();
  const text = tickerText(boardAt(savedAt), new Date(cutoffMs - 2 * 24 * 3_600_000).toISOString());
  expect(text).toContain(`ARC-AGI-3 not updated since ${newsDate(savedAt, true)}`);
  expect(text).not.toContain('ARC-AGI-3 saved');
});
