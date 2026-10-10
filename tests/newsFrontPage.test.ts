/**
 * Author: Claude Opus 5.5
 * Date: 2026-10-09
 * PURPOSE: Render the rebuilt ARC Daily Digest front page and wire page with the committed news
 *          archive and a populated market digest, so every live section (ticker, board, movers,
 *          past winners, What's News, notebook columns) runs against real-shaped data; and render
 *          it again with no digest to prove a board outage leaves the reporting standing.
 * SRP/DRY check: Pass — production pages, production digest builder, seeded query cache.
 */
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { Router } from 'wouter';
import { afterEach, expect, test, vi } from 'vitest';
import News from '../client/src/pages/News';
import NewsWire from '../client/src/pages/NewsWire';
import { getNewsIndex } from '../server/services/news/newsStore';
import { buildMarketBoard, type MarketsPayload } from '../shared/newsMarkets';
import type { NewsIndex, NewsWireStory } from '../shared/news';
import type { KaggleBoardRow } from '../shared/types';

const NOW = '2026-10-09T23:54:00Z';
const DAY_AGO = '2026-10-08T23:51:00Z';
const row = (rank: number, id: string, name: string, score: number, members: string): KaggleBoardRow => [rank, id, name, '2026-10-09 12:00:00', score, 9, members, null, null];

/** A small ARC-3 board using real team IDs, so the notebook and the people ledger connect to it. */
function markets(index: NewsIndex): MarketsPayload {
  const rows = [row(1, '15499660', 'Yi-Chia Chen', 59.17, 'threerabbits'), row(2, '15486995', 'Tufa Labs', 56.52, 'driessmit1,jeroencottaar,pressman1'),
    row(3, '16153655', 'mtg', 44.32, 'michaeltgao'), row(4, '15770880', 'NVARC3', 40.97, 'cpmpml,sorokin'), row(5, '16958599', 'Majkel1337', 40.5, 'majkel1337'),
    row(6, '15605182', 'Son & Mark & Ronen', 35.45, 'markbarney')];
  const watch = (index.people ?? []).flatMap(person => person.memberships.map(member => member.teamId)).concat(index.competitors.map(record => record.teamId));
  const board = buildMarketBoard('arc-3', { fetched: NOW, teams: 4067, ourTeamId: 'none', medalRanks: { gold: 5, silver: 50, bronze: 100 }, rows },
    { snaps: [{ t: DAY_AGO, teams: 4005, top: 55.89, gold: 39.9, silver: 30, bronze: 29 }, { t: NOW, teams: 4067, top: 59.17, gold: 40.5, silver: 30.9, bronze: 29.5 }],
      trails: { '15486995': { name: 'Tufa Labs', pts: [['2026-10-08T10:00:00Z', 55.89, 1], ['2026-10-09T10:00:00Z', 56.52, 2]] } } },
    [{ t: '2026-10-09T03:51:00Z', id: '15499660', name: 'Yi-Chia Chen', from: 55.77, to: 59.17, rankFrom: 2, rankTo: 1 },
      { t: '2026-10-09T08:00:00Z', id: '16153655', name: 'mtg', from: 38.33, to: 44.32, rankFrom: 7, rankTo: 3 },
      { t: '2026-10-09T09:00:00Z', id: '15770880', name: 'NVARC3', from: 37.51, to: 40.97, rankFrom: 9, rankTo: 4 },
      { t: '2026-10-09T09:30:00Z', id: '16958599', name: 'Majkel1337', from: null, to: 40.5, rankFrom: null, rankTo: 5 }], watch)!;
  return { generatedAt: NOW, boards: { 'arc-3': board } };
}

function render(page: React.ComponentType, path: string, index: NewsIndex, payload?: MarketsPayload) {
  // Seeded data only: anything unseeded stays pending, as a slow network would.
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, queryFn: () => new Promise(() => {}) } } });
  client.setQueryData(['/api/news'], index);
  if (payload) client.setQueryData(['/api/news/markets'], payload);
  return renderToStaticMarkup(createElement(QueryClientProvider, { client },
    createElement(HelmetProvider, {}, createElement(Router, { ssrPath: path, children: createElement(page) }))));
}

afterEach(() => vi.unstubAllGlobals());

test('the front page runs every live section against a populated digest', () => {
  vi.stubGlobal('React', React);
  const index = getNewsIndex();
  const html = render(News, '/news', index, markets(index));
  for (const text of ['What’s news', 'The board', 'Market movers', 'Where the past winners stand', 'Inside', 'The competitor notebook', 'Every edition',
    'Gold line · 5 places', 'Into gold:', 'Leader · <span class="news-ticker-name">Yi-Chia Chen</span>', 'NEW', 'ARC Prize 2025 champion · NVARC'])
    expect(html).toContain(text);
  // The lead report runs in full and the masthead names the edition.
  const lead = [...index.articles].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).find(article => article.competition === 'arc-3')!;
  expect(html).toContain(lead.sections.at(-1)!.text.slice(0, 40).replace(/&/g, '&amp;').replace(/'/g, '&#x27;'));
  expect(html).toMatch(/(Early|Late) edition/);
  expect(html).not.toContain('The people behind the puzzles');
  expect(html).not.toContain('Explore the contests');
});

test('without the digest the reporting still leads and the market sections stay out', () => {
  vi.stubGlobal('React', React);
  const index = getNewsIndex();
  const html = render(News, '/news', index);
  expect(html).toContain('What’s news');
  expect(html).toContain(index.articles[0].headline.replace(/&/g, '&amp;').replace(/'/g, '&#x27;').slice(0, 30));
  for (const text of ['news-ticker', 'Market movers', 'Where the past winners stand', 'The board<']) expect(html).not.toContain(text);
});

test('wire stories run in What’s News and in full on the wire page', () => {
  vi.stubGlobal('React', React);
  const story: NewsWireStory = {
    id: '2026-10-09-2020-arc-3-chen-takes-the-lead', competition: 'arc-3', publishedAt: '2026-10-10T00:20:00Z', dataAsOf: NOW, since: DAY_AGO,
    headline: 'Yi-Chia Chen takes the ARC-AGI-3 lead from Tufa Labs',
    sections: [{ text: 'Yi-Chia Chen gained 3.40 points to 59.17% and moved to 1st.', sourceIds: ['board-arc-3'] }],
    sources: [{ id: 'board-arc-3', title: 'ARC-AGI-3 public leaderboard', url: 'https://arc.markbarney.net/kaggle-leaderboard', accessedAt: '2026-10-10T00:10:00Z' }],
    teamIds: ['15499660'], personIds: ['yi-chia-chen'], generatedBy: 'gpt-6-luna',
  };
  const index = { ...getNewsIndex(), wire: [story] };
  const front = render(News, '/news', index, markets(index));
  expect(front).toContain('href="/news/wire#2026-10-09-2020-arc-3-chen-takes-the-lead"');
  expect(front).toContain('/news-images/people/yi-chia-chen.webp');
  const page = render(NewsWire, '/news/wire', index);
  expect(page).toContain('id="2026-10-09-2020-arc-3-chen-takes-the-lead"');
  expect(page).toContain('Yi-Chia Chen gained 3.40 points to 59.17% and moved to 1st.');
  expect(page).toContain('/api/news/wire/2026-10-09-2020-arc-3-chen-takes-the-lead/evidence');
});
