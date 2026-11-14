/**
 * Author: Claude Opus 5.5
 * Date: 14-Nov-2026
 * PURPOSE: Failure handling of the market digest (server/services/news/newsMarkets.ts, GET /api/news/markets):
 *          one board's failed query or corrupt saved document leaves only that board out, a failed rebuild
 *          serves the last good digest, and readers arriving together after expiry share one rebuild.
 *          The board repository (database) is replaced with a controllable stand-in; the digest builder,
 *          news store and cache are production code.
 * SRP/DRY check: Pass — reuses buildMarketBoard via the production service; no duplicate digest logic.
 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { KAGGLE_COMPETITIONS } from '../shared/kaggleCompetitions';
import type { KaggleBoardLatest } from '../shared/types';

type Doc = { name: string; capturedAt: string; body: string };
const control = vi.hoisted(() => ({
  calls: 0,
  documents: (_slug: string): Promise<Doc[]> => Promise.resolve([]),
  failIndex: false,
}));
vi.mock('../server/repositories/KaggleBoardRepository.js', () => ({
  kaggleBoardRepository: { getDocuments: (slug: string) => { control.calls++; return control.documents(slug); } },
}));
vi.mock('../server/services/news/newsStore', async importOriginal => {
  const actual = await importOriginal<typeof import('../server/services/news/newsStore')>();
  return { ...actual, getNewsIndex: () => { if (control.failIndex) throw new Error('simulated store failure'); return actual.getNewsIndex(); } };
});

const fetched = '2026-11-14T12:00:00Z';
const latest = (team: string): KaggleBoardLatest => ({
  fetched, teams: 10, ourTeamId: 'none', medalRanks: { gold: 1, silver: 2, bronze: 3 },
  rows: [[1, team, `${team} team`, '2026-11-14 10:00:00', 50, 3, `${team}-member`, null, null]],
});
const docs = (team: string): Doc[] => [{ name: 'latest', capturedAt: fetched, body: JSON.stringify(latest(team)) }];
const slug = (competition: 'arc-2' | 'arc-3') => KAGGLE_COMPETITIONS[competition].slug;

async function freshService() {
  vi.resetModules();
  return import('../server/services/news/newsMarkets');
}
beforeEach(() => { control.calls = 0; control.failIndex = false; control.documents = board => Promise.resolve(docs(board)); });
afterEach(() => { vi.useRealTimers(); });

it('leaves out only the board whose query fails or whose saved document is corrupt', async () => {
  const { buildMarkets } = await freshService();
  control.documents = board => board === slug('arc-3') ? Promise.reject(new Error('relation does not exist')) : Promise.resolve(docs('two'));
  expect(Object.keys((await buildMarkets()).boards)).toEqual(['arc-2']);
  control.documents = board => Promise.resolve(board === slug('arc-2') ? [{ name: 'latest', capturedAt: fetched, body: '{not json' }] : docs('three'));
  expect(Object.keys((await buildMarkets()).boards)).toEqual(['arc-3']);
});

it('serves the last good digest when a rebuild fails after the cache expires', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(Date.parse('2026-11-14T12:00:00Z'));
  const { marketsResponse } = await freshService();
  const good = await marketsResponse();
  vi.setSystemTime(Date.parse('2026-11-14T12:05:00Z'));
  control.failIndex = true;
  expect((await marketsResponse()).raw.equals(good.raw)).toBe(true);
  // With nothing cached yet, the failure is still reported.
  const { marketsResponse: cold } = await freshService();
  await expect(cold()).rejects.toThrow('simulated store failure');
});

it('shares one in-flight rebuild between readers that arrive together', async () => {
  const { marketsResponse } = await freshService();
  const [first, second, third] = await Promise.all([marketsResponse(), marketsResponse(), marketsResponse()]);
  expect(control.calls).toBe(2); // one query per board, once
  expect(second).toBe(first);
  expect(third).toBe(first);
});
