/**
 * Author: GPT-6.1 Terra / Codex (reasoning effort not exposed); GPT-6 / Codex; Claude Opus 5.5 Medium
 * Date: 27-November-2026
 * 27-Nov-2026 (Claude Opus 5.5 Medium, card rule): the Keith card-face check now tests the shared storyCast() rule (the
 *          approved design replaced hand-picked faces, so his career card leads and the labels are name and set); new
 *          checks run the rule over every published story, the Franzen board and the opening board.
 * 27-Nov-2026 (Claude Opus 5.5 Medium): the music feature check follows the 13 Nov removal of its production gallery.
 * 27-Nov-2026 (Claude Opus 5.5 Medium, ARC archive): the server front-page order check uses frontPageCompetitions, since
 *          ARC Prize 2026 is in storage and its desks no longer lead while current coverage exists; a new check covers the
 *          archive page's server HTML.
 * 25-Nov-2026 (GPT-6 / Codex): verify dated Kaggle profile totals and selected card faces in the story.
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
import { storyCast, STORY_CAST_TILE_LIMIT, type StoryCastSource } from '../shared/storyCast';
import { catalogCardVisible, catalogSet } from '../shared/cardCatalog';
import { publishedCompetitionOrder, competitionStories, editionFeature } from '../shared/news';
import { ARC_2026_ARCHIVE, arc2026Stories, frontPageCompetitions } from '../shared/newsSeasons';

it('accepts a directory competition outside the legacy ARC desks', () => {
  const competition = Object.keys(KAGGLE_COMPETITIONS).find(key => !key.startsWith('arc-'))!;
  expect(newsDispatchSchema.safeParse({ id: 'fixture-only', competition, publishedAt: '2026-11-02T12:00:00Z',
    headline: 'Fixture only', sections: [{ text: 'Fixture.', sourceIds: ['source'] }],
    sources: [{ id: 'source', title: 'Fixture', url: KAGGLE_COMPETITIONS[competition].path, accessedAt: '2026-11-02T12:00:00Z' }] }).success).toBe(true);
});
it('exports dated career evidence and keeps contest standings outside the wiki', () => {
  const wiki = loadWikiInputs('content/news')!;
  expect(wiki.registry.snapshots).toEqual([]);
  const datedProfiles = Object.values(wiki.careers).filter(career => career.rank || career.medals);
  expect(datedProfiles.length).toBeGreaterThan(0);
  expect(datedProfiles.every(career => career.profileUrl && Number.isFinite(Date.parse(career.checkedAt)))).toBe(true);
  expect(wiki.registry.cards.length).toBeGreaterThan(80);
});
describe('In this story: one card rule for every story', () => {
  const index = getNewsIndex(), cabinet = getNewsCollection();
  const sets = cabinet.sets ?? [];
  const visible = cabinet.cards.filter(card => catalogCardVisible(card));
  // Each published story read the way its page reads it: a front-page feature together with its edition.
  const stories = [
    ...(index.dispatches ?? []).map(dispatch => ({ id: dispatch.id, sources: [dispatch] as StoryCastSource[] })),
    ...index.articles.map(article => { const feature = editionFeature(article, index.dispatches); return { id: article.id, sources: (feature ? [feature, article] : [article]) as StoryCastSource[] }; }),
  ];
  const slugsOf = (sources: StoryCastSource[]) => new Set(sources.flatMap(story => [story.competition, ...(story.competitions ?? [])]).map(key => KAGGLE_COMPETITIONS[key]?.slug));
  const issued = (id: string) => Date.parse(visible.find(card => card.id === id)?.issuedAt ?? '') || 0;

  it('shows every card the subject holds and puts each person’s newest card before their older ones', () => {
    expect(stories.length).toBeGreaterThan(100);
    for (const { id, sources } of stories) {
      const { tiles } = storyCast(cabinet, sources);
      const subject = sources.flatMap(story => story.personIds ?? []).find(person => visible.some(card => card.personId === person));
      if (subject) {
        const shown = new Set(tiles.map(tile => tile.cardId));
        const missing = visible.filter(card => card.personId === subject && !shown.has(card.id)).map(card => card.id);
        expect(missing, `${id}: subject ${subject}`).toEqual([]);
        expect(tiles[0].personId, `${id}: the subject leads`).toBe(subject);
      }
      expect(tiles.filter(tile => tile.lead).length, `${id}: one lead`).toBe(tiles.length ? 1 : 0);
      const slugs = slugsOf(sources);
      for (const person of new Set(tiles.map(tile => tile.personId).filter(Boolean))) {
        const fronts = tiles.filter(tile => tile.personId === person && tile.kind === 'card' && tile.side === 'front').map(tile => tile.cardId!);
        const lead = visible.find(card => card.id === fronts[0])!;
        const newest = Math.max(...visible.filter(card => card.personId === person).map(card => issued(card.id)));
        // The lead is their newest card, unless it is the newest special edition or a card for this story's own contest.
        const leadScope = catalogSet(lead, sets)?.competitionIds ?? [];
        expect(issued(lead.id) === newest || (!!lead.setId && leadScope.length === 0) || leadScope.some(slug => slugs.has(slug)), `${id}: ${person} lead ${lead.id}`).toBe(true);
        const rest = fronts.slice(1).map(issued);
        expect(rest, `${id}: ${person} older cards newest first`).toEqual([...rest].sort((a, b) => b - a));
        // Hall of Fame cards come after the person's own cards.
        const kinds = tiles.filter(tile => tile.personId === person).map(tile => tile.kind);
        expect(kinds.indexOf('hall-of-fame') === -1 || kinds.lastIndexOf('card') < kinds.indexOf('hall-of-fame'), `${id}: ${person} Hall of Fame last`).toBe(true);
      }
    }
  });
  it('shows Franzen’s career card first, then his older cards and the other carded people on his board', () => {
    const story = index.dispatches!.find(item => item.id === 'daniel-franzen-arcade-entrance')!;
    // The corrected story lists both of his cards with their backs; the rule still decides the order.
    expect(new Set(story.cardFaces?.map(face => face.cardId))).toEqual(new Set(['person-daniel-franzen-kaggleverse-2026', 'person-daniel-franzen-2026']));
    const { tiles } = storyCast(cabinet, [story]);
    const own = tiles.filter(tile => tile.personId === 'daniel-franzen' || tile.kind === 'hall-of-fame').map(tile => tile.cardId ?? tile.kind);
    expect(own[0]).toBe('person-daniel-franzen-kaggleverse-2026');
    expect(own.indexOf('person-daniel-franzen-kaggleverse-2026')).toBeLessThan(own.indexOf('person-daniel-franzen-2026'));
    expect(tiles[0].lead).toBe(true);
    // Board order after the subject: Keith Tyser, then Dries @ Tufa Labs (the corrected board stops at fifth;
    // Mevlana Yalçın and Pay-to-Compute hold no card).
    expect([...new Set(tiles.map(tile => tile.personId).filter(id => id && id !== 'daniel-franzen'))].slice(0, 2)).toEqual(['keith-tyser', 'dries-smit']);
    expect(tiles.map(tile => tile.set)).toContain('Kaggleverse 2026');
  });
  it('shows Keith’s career card, then his Generalist Gaming, ARC-AGI-3 and ARC Prize cards, in the browser rule and the server HTML', () => {
    const story = index.dispatches!.find(item => item.id === 'keith-tyser-arcade')!;
    const { tiles } = storyCast(cabinet, [story]);
    expect(tiles.map(tile => tile.cardId)).toEqual(['person-keith-tyser-kaggleverse-2026', 'person-keith-tyser-generalist-gaming-agent-2026', 'person-keith-tyser-arc-3-2026', 'person-keith-tyser-2026']);
    const body = resolveNewsMeta('/news/keith-tyser-arcade')!.tags.bodyHtml!;
    const locations = tiles.map(tile => body.indexOf(tile.src.replaceAll('&', '&amp;')));
    expect(locations.every(at => at > -1)).toBe(true);
    expect([...locations].sort((a, b) => a - b)).toEqual(locations);
    expect(body).toContain('data-lead="true"');
  });
  it('fills a story with no listed cast from its board, and lists the rest by name past the card budget', () => {
    const story = index.dispatches!.find(item => item.id === 'generalist-gaming-opening-board')!;
    expect(story.personIds).toEqual([]);
    const { tiles, more } = storyCast(cabinet, [story]);
    // The newer of its two printed reads leads: Wednesday's #1, Keith Tyser, then the opening-day leader.
    expect(tiles[0].cardId).toBe('person-keith-tyser-kaggleverse-2026');
    expect([...tiles.map(tile => tile.name), ...more.map(item => item.name)]).toContain('Tong Hui Kang');
    expect(tiles.length).toBeLessThanOrEqual(STORY_CAST_TILE_LIMIT);
    expect(more.length).toBeGreaterThan(0);
    // A bare first name in the text ("Jack builds from scratch") is not evidence for a card called "Jack".
    expect(tiles.filter(tile => tile.cardId === 'person-jackvd-generalist-gaming-agent-2026').length + more.filter(item => item.name === 'Jack').length).toBeLessThanOrEqual(1);
  });
});

it('uses a corrected wiki briefing on the rendered card model', () => {
  const collection = getNewsCollection(), card = collection.cards[0];
  const corrected = { ...card, biography: 'A durable corrected biography.' };
  expect(cardFaceModel(corrected, { ...collection, cards: collection.cards.map(c => c.id === card.id ? corrected : c) }).model.bio).toBe(corrected.biography);
});
it('orders the server front page by the same published competition leads', () => {
  const { articles, dispatches = [] } = getNewsIndex();
  const html = resolveNewsMeta('/news')!.tags.bodyHtml!;
  // 27-Nov-2026: the front page runs the current contest first and keeps stored ARC Prize 2026 desks off it.
  const heads = frontPageCompetitions(articles, dispatches).map(key => {
    const first = competitionStories(articles, dispatches, key)[0];
    return 'article' in first ? first.article.headline : first.dispatch.headline;
  });
  // Source links inside one lead can mention another story before its own lead.
  const positions = frontPageCompetitions(articles, dispatches).map(key => html.indexOf(`data-news-lead="${competitionStories(articles, dispatches, key)[0].id}"`));
  expect(heads.length).toBeGreaterThan(0); expect(positions.every(p => p >= 0)).toBe(true);
  expect([...positions].sort((a, b) => a - b)).toEqual(positions);
});
it('serves the ARC Prize 2026 archive page with its boards and every ARC story in the server HTML', () => {
  const { articles, dispatches = [] } = getNewsIndex();
  const page = resolveNewsMeta(ARC_2026_ARCHIVE.path)!;
  const html = page.tags.bodyHtml!;
  expect(page.status).toBe(200);
  expect(html).toContain(`<h1>${ARC_2026_ARCHIVE.heading}</h1>`);
  expect(html).toContain('href="/kaggle-leaderboard#medal-race"');
  const stories = arc2026Stories(articles, dispatches);
  expect(stories.length).toBeGreaterThan(0);
  for (const story of stories) expect(html).toContain(`href="/news/${story.id}"`);
  // Nothing from the current contest is filed in the archive.
  expect(stories.every(story => story.competition !== 'generalist-gaming-agent')).toBe(true);
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


it('keeps the music feature, credits and a link to the complete scene book', () => {
  const html = resolveNewsMeta('/news/on-the-private')!.tags.bodyHtml!;
  expect(html).toContain('GPT-6.1 Terra / Codex');
  expect(html).toContain('Lyria 3 Pro');
  // 13-Nov-2026: the Boss had the production stills and the expanding iframe taken off the page (Son reported them
  // flooding it); the stills stay on file and in the standalone scene book behind one link.
  expect(html).not.toContain('Inside the nightclub');
  expect(html).not.toContain('<iframe');
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
