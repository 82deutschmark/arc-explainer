/**
 * Author: GPT-6.1 Terra / Codex (reasoning effort not exposed); GPT-6 / Codex
 * Date: 13-November-2026
 * 09-Nov-2026 (GPT-6 / Codex): contest card evidence and regression checks.
 * PURPOSE: Verify directory-based publishing, source freshness and the staged
 * premiere gate and brand-aware share-card versions against production boundaries.
 * Fictional rows remain in tests.
 * SRP/DRY check: Pass — use the real schemas, decoder, compiler output and gate.
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ON_THE_PRIVATE_ART } from '../shared/onThePrivateArt';
import config from '../shared/newsBrand.json';
import { newsBrandAt, type NewsBrandConfig } from '../shared/newsBrand';
import { KAGGLE_COMPETITIONS } from '../shared/kaggleCompetitions';
import { newsDispatchSchema } from '../server/services/news/newsStore';
import { loadWikiInputs } from '../server/services/news/wikiInputs';
import { boardFreshAt, cardBoardCache, freshCardRows, snapshotsFromBoard } from '../server/services/news/cardBoards';
import { kaggleBoardRepository } from '../server/repositories/KaggleBoardRepository';
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
  const corrected = { ...card, biography: 'A durable corrected biography.' };
  expect(cardFaceModel(corrected, { ...collection, cards: collection.cards.map(c => c.id === card.id ? corrected : c) }).model.bio).toBe(corrected.biography);
});
it('orders the server front page by the same published competition leads', () => {
  const { articles, dispatches = [] } = getNewsIndex();
  const html = resolveNewsMeta('/news')!.tags.bodyHtml!;
  const heads = publishedCompetitionOrder(articles, dispatches).map(key => {
    const first = competitionStories(articles, dispatches, key)[0];
    return 'article' in first ? first.article.headline : first.dispatch.headline;
  });
  // Source links inside one lead can mention another story before its own lead.
  const positions = publishedCompetitionOrder(articles, dispatches).map(key => html.indexOf(`data-news-lead="${competitionStories(articles, dispatches, key)[0].id}"`));
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
  it('keeps the valid contest board when another contest document fails', async () => {
    const fetched = new Date().toISOString();
    const wiki = loadWikiInputs('content/news')!;
    const slug = KAGGLE_COMPETITIONS['arc-3'].slug;
    const loadBoard = vi.spyOn(kaggleBoardRepository, 'getDocuments').mockImplementation(async competition => {
      if (competition === KAGGLE_COMPETITIONS['arc-2'].slug) throw new Error('Fixture board failure');
      if (competition !== slug) return [];
      return [{ name: 'latest', capturedAt: fetched, body: JSON.stringify({
        competition: slug, fetched, rows: [[2, '15486995', 'Tufa Labs', '', 70.24, 180, 'driessmit1,jeroencottaar']],
      }) }];
    });
    try {
      const cache = cardBoardCache('fixture-contest-board-isolation', wiki.registry, getNewsIndex());
      await cache.pending;
      expect(freshCardRows(cache)).toEqual([expect.objectContaining({
        competition: 'arc-3', teamId: '15486995', rank: 2, score: 70.24, members: ['driessmit1', 'jeroencottaar'],
      })]);
    } finally {
      loadBoard.mockRestore();
    }
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

it('serves the tip line through the same metadata route', () => {
  const tips = resolveNewsMeta('/news/tips');
  expect(tips?.status).toBe(200);
  expect(tips?.tags.bodyHtml).toContain('Talk to me, Goose.');
  expect(tips?.tags.bodyHtml).toContain('https://x.com/82deutschmark');
});

it('gives the rebrand new article and front-page image URLs without changing the story', async () => {
  const article = getNewsIndex().articles[0];
  const at = Date.parse(article.publishedAt);
  const versions = async (name: string) => {
    vi.resetModules();
    vi.doMock('../shared/newsBrand', () => ({ NEWS_NAME: name, NEWS_BRAND: { name, goose: name === 'The Loose Goose' } }));
    const news = await import('../shared/news');
    return [news.articleCardVersion(article), news.sectionCardVersion([article], at)];
  };
  try {
    const digest = await versions('The ARC Daily Digest');
    const goose = await versions('The Loose Goose');
    expect(goose[0]).not.toBe(digest[0]);
    expect(goose[1]).not.toBe(digest[1]);
    expect(await versions('The Loose Goose')).toEqual(goose);
  } finally {
    vi.doUnmock('../shared/newsBrand');
    vi.resetModules();
  }
});


it('keeps the music feature, credits and complete scene book together', () => {
  const html = resolveNewsMeta('/news/on-the-private')!.tags.bodyHtml!;
  expect(html).toContain('GPT-6.1 Terra / Codex');
  expect(html).toContain('Lyria 3 Pro');
  expect(html).toContain('Inside the nightclub');
  expect(html).toContain('ensemble-formation.jpg');
  expect(ON_THE_PRIVATE_ART).toHaveLength(10);
  expect(ON_THE_PRIVATE_ART.every(item => existsSync(join(process.cwd(), 'client/public', item.src)))).toBe(true);
  expect(html).toContain('goose-2042ae585076eddc486d.jpg');
  expect(html).toContain('/news-scene-books/on-the-private/index.html');
  const book = join(process.cwd(), 'client/public/news-scene-books/on-the-private');
  const markup = readFileSync(join(book, 'index.html'), 'utf8');
  const images = [...markup.matchAll(/(?:src|href)="(img\/[^"#]+)"/g)].map(match => match[1]);
  expect(images.length).toBeGreaterThan(100);
  expect(images.every(image => existsSync(join(book, image)))).toBe(true);
  expect(markup).toContain('id="s40"');
});
