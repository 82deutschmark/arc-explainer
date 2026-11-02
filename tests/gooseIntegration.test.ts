/**
 * Author: GPT-6 / Codex (reasoning effort not exposed)
 * Date: 02-November-2026
 * PURPOSE: Verify directory-based publishing, source freshness and the staged
 * premiere gate against production boundaries. Fictional rows remain in tests.
 * SRP/DRY check: Pass — use the real schemas, decoder, compiler output and gate.
 */
import { describe, expect, it } from 'vitest';
import config from '../shared/newsBrand.json';
import { newsBrandAt, type NewsBrandConfig } from '../shared/newsBrand';
import { KAGGLE_COMPETITIONS } from '../shared/kaggleCompetitions';
import { newsDispatchSchema } from '../server/services/news/newsStore';
import { loadWikiInputs } from '../server/services/news/wikiInputs';
import { boardFreshAt, snapshotsFromBoard } from '../server/services/news/cardBoards';
import { cardFaceModel } from '../server/services/news/cardFace';
import { getNewsCollection } from '../server/services/news/newsCollection';
import { resolveNewsMeta } from '../server/services/news/newsPresentation';
import { getNewsIndex } from '../server/services/news/newsStore';
import { publishedCompetitionOrder, competitionStories } from '../shared/news';

it('accepts a directory competition outside the legacy ARC desks', () => {
  const competition = Object.keys(KAGGLE_COMPETITIONS).find(key => !key.startsWith('arc-'))!;
  expect(newsDispatchSchema.safeParse({ id: 'fixture-only', competition, publishedAt: '2026-11-02T12:00:00Z',
    headline: 'Fixture only', sections: [{ text: 'Fixture.', sourceIds: ['source'] }],
    sources: [{ id: 'source', title: 'Fixture', url: KAGGLE_COMPETITIONS[competition].path, accessedAt: '2026-11-02T12:00:00Z' }] }).success).toBe(true);
});
it('exports source-linked identities and no wiki standings or global rank copy', () => {
  const wiki = loadWikiInputs('content/news')!;
  expect(wiki.registry.snapshots).toEqual([]);
  expect(Object.values(wiki.careers).every(career => career.rank == null && career.medals == null)).toBe(true);
  expect(wiki.registry.cards.length).toBeGreaterThan(80);
});
it('uses a corrected wiki briefing on the rendered card model', () => {
  const collection = getNewsCollection(), card = collection.cards[0];
  const corrected = { ...card, description: 'A durable corrected biography.' };
  expect(cardFaceModel(corrected, { ...collection, cards: collection.cards.map(c => c.id === card.id ? corrected : c) }).model.bio).toBe(corrected.description);
});
it('orders the server front page by the same published competition leads', () => {
  const { articles, dispatches = [] } = getNewsIndex();
  const html = resolveNewsMeta('/news')!.tags.bodyHtml!;
  const heads = publishedCompetitionOrder(articles, dispatches).map(key => {
    const first = competitionStories(articles, dispatches, key)[0];
    return 'article' in first ? first.article.headline : first.dispatch.headline;
  });
  // Escaping does not alter these article identities or canonical URLs.
  const positions = publishedCompetitionOrder(articles, dispatches).map(key => html.indexOf(competitionStories(articles, dispatches, key)[0].id));
  expect(heads.length).toBeGreaterThan(0); expect(positions.every(p => p >= 0)).toBe(true);
  expect([...positions].sort((a, b) => a - b)).toEqual(positions);
});
describe('fresh source boundary', () => {
  const now = Date.parse('2026-11-02T20:00:00Z'), close = '2026-11-02T23:59:00Z';
  it('rejects stale and future readings, tightening freshness near the close', () => {
    expect(boardFreshAt('2026-11-02T19:30:00Z', close, now)).toBe(true);
    expect(boardFreshAt('2026-11-02T19:20:00Z', close, now)).toBe(false);
    expect(boardFreshAt('2026-11-02T20:01:00Z', close, now)).toBe(false);
    expect(boardFreshAt('2026-11-02T19:20:00Z', null, now)).toBe(true);
  });
  it('keeps native precision and rejects wrong competitions and duplicate team rows', () => {
    const latest = { competition: KAGGLE_COMPETITIONS['arc-3'].slug, fetched: '2026-11-02T19:30:00Z', rows: [[900, '123', 'Fixture', '', .123456789, 1, 'fixture']] };
    const rows = snapshotsFromBoard('arc-3', latest, new Set(['123']), now);
    expect(rows[0]).toMatchObject({ rank: 900, score: .123456789, members: ['fixture'] });
    expect(rows[0].sourceUrl).toContain('teamId=123');
    expect(snapshotsFromBoard('arc-2', latest, new Set(['123']), now)).toEqual([]);
    expect(snapshotsFromBoard('arc-3', { ...latest, rows: [...latest.rows, ...latest.rows] }, new Set(['123']), now)).toEqual([]);
  });
});
it('holds the prepared identity until time and every official closing check pass', () => {
  const value: NewsBrandConfig = { ...config, enabled: true, closeChecks: config.requiredCompetitions.map(competition => ({ competition, status: 'closed',
    sourceUrl: `https://www.kaggle.com/competitions/${competition}/overview`, closeAt: '2026-11-02T23:59:00Z', checkedAt: '2026-11-03T00:01:00Z' })) };
  expect(newsBrandAt(Date.parse('2026-11-02T23:59:00Z'), value).goose).toBe(false);
  expect(newsBrandAt(Date.parse('2026-11-03T00:02:00Z'), { ...value, closeChecks: [] }).goose).toBe(false);
  expect(newsBrandAt(Date.parse('2026-11-03T00:02:00Z'), value).goose).toBe(true);
  value.closeChecks[0].sourceUrl = `https://www.kaggle.com/competitions/${value.requiredCompetitions[0]}-spoof`;
  expect(newsBrandAt(Date.parse('2026-11-03T00:02:00Z'), value).goose).toBe(false);
});
