/**
 * Author: GPT-6 / Codex (reasoning effort not exposed)
 * Date: 03-November-2026
 * PURPOSE: Render the news ticker, standings and movers against decimal score differences,
 *          catching visible floating-point tails while retaining score/difference semantics,
 *          integer team counts and unknown comparisons.
 * SRP/DRY check: Pass — production components and the production market digest builder.
 */
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Router } from 'wouter';
import { afterEach, expect, test, vi } from 'vitest';
import { BoardTable, Change, MarketTicker, MoversBand } from '../client/src/components/news/NewsMarkets';
import { buildMarketBoard, type MarketsPayload } from '../shared/newsMarkets';

afterEach(() => vi.unstubAllGlobals());

const links = { competitors: [], people: [] };
const NOW = '2026-11-03T00:16:35Z';
const THEN = '2026-11-02T00:16:35Z';

function digest(): MarketsPayload {
  const board = buildMarketBoard('arc-2', {
    fetched: NOW, teams: 1234, ourTeamId: 'none', medalRanks: { gold: 1, silver: 2, bronze: 3 },
    rows: [
      [1, '16756524', 'Tufa Labs', NOW, 88.06, 9, 'driessmit1', null, null],
      [2, '15501171', 'Yi-Chia Chen @ Fields Model', NOW, 87.22, 9, 'threerabbits', null, null],
      [3, '16373916', 'Majkel1337', NOW, 40.5, 9, 'majkel1337', null, null],
      [4, '4', 'Precision entry', NOW, 0.123456789012345, 9, 'precision', null, null],
    ],
  }, {
    snaps: [{ t: THEN, teams: 1200, top: 87.22, gold: 87.22, silver: 87, bronze: 40.5 }],
    trails: {
      '16756524': { name: 'Tufa Labs', pts: [[THEN, 87.22, 1]] },
      '15501171': { name: 'Yi-Chia Chen @ Fields Model', pts: [[THEN, 87, 2]] },
      '4': { name: 'Precision entry', pts: [[THEN, 0.1, 4]] },
    },
  }, [])!;
  return { generatedAt: NOW, boards: { 'arc-2': board } };
}

function render(child: React.ReactElement) {
  vi.stubGlobal('React', React);
  return renderToStaticMarkup(createElement(Router, { ssrPath: '/news', children: child }));
}

test('score changes round binary subtraction tails, preserving signs and difference typography', () => {
  const gain = render(createElement(Change, { value: 88.06 - 87.22 }));
  const loss = render(createElement(Change, { value: 87.22 - 88.06 }));
  expect(gain).toContain('news-chg sd is-up');
  expect(gain).toContain('>▲</span>+0.84</span>');
  expect(loss).toContain('news-chg sd is-down');
  expect(loss).toContain('>▼</span>−0.84</span>');
  expect(gain + loss).not.toMatch(/\d\.\d{3,}/);
});

test('integer counts, unchanged changes and missing comparisons keep their distinct displays', () => {
  expect(render(createElement(Change, { value: 1234, integer: true }))).toContain('+1,234</span>');
  expect(render(createElement(Change, { value: 0 }))).toContain('title="Unchanged">–</span>');
  expect(render(createElement(Change, { value: null }))).toBe('');
});

test('ticker and standings preserve source score precision and clean derived changes', () => {
  const markets = digest();
  const board = markets.boards['arc-2']!;
  const ticker = render(createElement(MarketTicker, { markets }));
  const table = render(createElement(BoardTable, { board, links }));
  expect(ticker).toContain('<b class="sc">88.06</b>');
  expect(ticker).toContain('<b class="sc">40.5</b>');
  expect(ticker).toContain('>+0.84<');
  expect(ticker).toContain('<b>1,234</b>');
  expect(table).toContain('<td class="num sc">40.5</td>');
  expect(table).toContain('<td class="num sc">0.123456789012345</td>');
  expect(table).toContain('>+0.023456789012345<');
  expect(table).toContain('>+0.84<');
  expect(ticker + table).not.toContain('0.840000000000');
});

test('movers render both gains and gold-line gaps without decimal artifacts', () => {
  const html = render(createElement(MoversBand, { markets: digest(), links }));
  expect(html).toContain('>+0.84<');
  expect(html).toContain('<span class="sd">−0.84</span>');
  expect(html).toContain('<span class="sc">88.06</span>');
  expect(html).not.toContain('0.840000000000');
});

test('already-derived changes lose only arithmetic noise, retaining precise and tiny metrics', () => {
  expect(render(createElement(Change, { value: 0.149999999999999 }))).toContain('>+0.15<');
  for (const value of [0.123456789, 0.123456789012345, 0.000123456789]) {
    expect(render(createElement(Change, { value }))).toContain(`>+${value}<`);
  }
});
