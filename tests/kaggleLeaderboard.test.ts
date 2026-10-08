/**
 * Author: GPT-6 / Codex
 * Date: 2026-10-07
 * PURPOSE: Guard competition query/cache separation, saved watchlist isolation and pin
 *          retention, and honest first-snapshot rendering on the shared leaderboard page.
 * SRP/DRY check: Pass — exercises the actual hooks/page with in-memory query cache data.
 */
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { Router } from 'wouter';
import { afterEach, expect, test, vi } from 'vitest';
import { KAGGLE_COMPETITIONS, type KaggleCompetitionKey } from '../shared/kaggleCompetitions';
import { useWatchlist } from '../client/src/components/kaggleLeaderboard/useWatchlist';
import { useKaggleBoard } from '../client/src/components/kaggleLeaderboard/boardData';
import KaggleLeaderboard from '../client/src/pages/KaggleLeaderboard';
import type { KaggleBoardPayload } from '../shared/types';

// A deliberately minimal first capture exercises missing baselines/history, not score math.
function firstCapture(key: KaggleCompetitionKey): KaggleBoardPayload {
  const competition = KAGGLE_COMPETITIONS[key];
  return {
    competition: competition.slug,
    latest: {
      fetched: '2026-10-07T18:00:00Z', teams: 100,
      medalRanks: { gold: 1, silver: 2, bronze: 3 },
      ourTeamId: competition.pinnedTeamIds[0],
      rows: competition.pinnedTeamIds.concat(['leader', 'third']).map((id, i) => [i + 1, id, `${key} team ${id}`, '2026-10-07T16:00:00Z', 40 - i, 1, '', null, null]),
    },
    history: { snaps: [{ t: '2026-10-07T18:00:00Z', teams: 100, top: 40, gold: 40, silver: 39, bronze: 38 }], trails: {} },
    events: [],
  };
}
function client() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  for (const key of ['arc-2', 'arc-3'] as const) {
    const slug = KAGGLE_COMPETITIONS[key].slug;
    client.setQueryData(['kaggle-board', slug], firstCapture(key));
    client.setQueryData(['kaggle-board-backfill', slug], null);
  }
  return client;
}
afterEach(() => vi.unstubAllGlobals());

test('competition queries select the matching cache and preserve isolated stars with mandatory pins', () => {
  vi.stubGlobal('localStorage', { getItem: (key: string) => JSON.stringify(key === 'kaggle-lb-watch' ? ['arc3-star'] : ['arc2-star']) });
  function Probe({ board }: { board: KaggleCompetitionKey }) {
    const competition = KAGGLE_COMPETITIONS[board];
    const { model } = useKaggleBoard(competition);
    const watch = useWatchlist(model, competition.slug);
    return `${model?.latest.rows[0][2]}|${watch.ids.join(',')}`;
  }
  for (const board of ['arc-2', 'arc-3'] as const) {
    const html = renderToStaticMarkup(createElement(QueryClientProvider, { client: client() }, createElement(Probe, { board })));
    expect(html).toContain(`${board} team`);
    expect(html).toContain(board === 'arc-2' ? 'arc2-star' : 'arc3-star');
    expect(html).not.toContain(board === 'arc-2' ? 'arc3-star' : 'arc2-star');
    for (const id of KAGGLE_COMPETITIONS[board].pinnedTeamIds) expect(html).toContain(id);
  }
});

test('a first ARC-2 snapshot shows unknown comparisons and ARC-2 metadata, never invented trends', () => {
  vi.stubGlobal('React', React);
  const html = renderToStaticMarkup(createElement(QueryClientProvider, { client: client() },
    createElement(HelmetProvider, {}, createElement(Router, { ssrPath: '/kaggle-leaderboard/arc-2', children: createElement(KaggleLeaderboard, { competitionKey: 'arc-2' }) }))));
  expect(html).toContain('ARC-AGI-2 Kaggle leaderboard');
  expect(html).toContain('Daily changes will appear once a previous-day snapshot is available.');
  expect(html).toContain('Weekly comparisons will appear after a week of saved history.');
  expect(html).toContain('Rank change unavailable');
  expect(html).not.toContain('Rank unchanged today');
  expect(html).not.toContain('arc3.huikang.dev');
  expect(html).not.toContain('Gold line, past week');
});
