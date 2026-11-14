/**
 * Author: Claude Opus 5.5
 * Date: 14-Nov-2026
 * PURPOSE: Regression checks for the archive and Card Cabinet server fixes (findings 1, 2, 5 and 6 of the 14-Nov-2026
 *          server review): loadNewsArchive and getNewsCollection memos (file changes and the TTL still invalidate,
 *          a Cabinet memo hit reads no story folder), the board generation moving only on changed rows, a duplicate
 *          team row dropping only that team, named board failures, bad artwork and unverified cards left out and
 *          recorded, a broken goose-wiki.json reported in one line and served from the last good build, pages and
 *          the sitemap rendering without a Cabinet, and /api/news/health turning "degraded" on Cabinet problems.
 * SRP/DRY check: Pass — exercises the real store, collection, board decoder, presentation and routes against copies of
 *          the committed content in temporary directories; only the board data store and the Cabinet health/lookup
 *          seams are replaced where a failure has to be forced.
 */
import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KAGGLE_COMPETITIONS } from '../shared/kaggleCompetitions';
import { loadNewsArchive, getNewsIndex } from '../server/services/news/newsStore';
import { loadWikiInputs } from '../server/services/news/wikiInputs';
import { cardBoardCache, cardBoardStatus, snapshotsFromBoard } from '../server/services/news/cardBoards';
import { kaggleBoardRepository } from '../server/repositories/KaggleBoardRepository';
import * as collectionModule from '../server/services/news/newsCollection';
import { getNewsCollection, newsCollectionHealth, tryNewsCollection } from '../server/services/news/newsCollection';
import { newsSitemapEntries, resolveNewsMeta } from '../server/services/news/newsPresentation';
import { mountNews } from '../server/routes/news';

const LIVE = path.join(process.cwd(), 'content/news');
const roots: string[] = [];
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  roots.splice(0).forEach(root => fs.rmSync(root, { recursive: true, force: true }));
});
function tempDirectory(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'news-resilience-'));
  roots.push(root);
  return root;
}
const write = (directory: string, file: string, value: unknown) => {
  fs.mkdirSync(path.dirname(path.join(directory, file)), { recursive: true });
  fs.writeFileSync(path.join(directory, file), typeof value === 'string' ? value : JSON.stringify(value));
};
const liveWiki = () => JSON.parse(fs.readFileSync(path.join(LIVE, 'goose-wiki.json'), 'utf8'));

describe('archive memo', () => {
  it('returns the same archive until a file changes or the TTL passes', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const directory = tempDirectory();
    const live = getNewsIndex();
    write(directory, 'people.json', [live.people![0]]);
    const first = loadNewsArchive(directory);
    expect(loadNewsArchive(directory)).toBe(first);
    write(directory, 'people.json', [live.people![0], live.people![1]]);
    const changed = loadNewsArchive(directory);
    expect(changed).not.toBe(first);
    expect(changed.index.people).toHaveLength(2);
    // A new story file is seen at once, not after the TTL.
    write(directory, `articles/${live.articles[0].id}.json`, live.articles[0]);
    const withStory = loadNewsArchive(directory);
    expect(withStory.index.articles.map(article => article.id)).toEqual([live.articles[0].id]);
    vi.setSystemTime(Date.now() + 31_000);
    expect(loadNewsArchive(directory)).not.toBe(withStory);
  });

  it('reports goose-wiki.json rows by id, in one line, under the file they came from', () => {
    const directory = tempDirectory();
    const wiki = liveWiki();
    const [ledgerOwner, broken] = wiki.people as { id: string; accounts: unknown[] }[];
    // The ledger claims the first wiki person's account first, so that wiki person is the conflicting row.
    write(directory, 'people.json', [{ ...ledgerOwner, id: 'ledger-claimant' }]);
    wiki.people = [ledgerOwner, { ...broken, accounts: [] }];
    write(directory, 'goose-wiki.json', wiki);
    const { skipped } = loadNewsArchive(directory);
    const invalid = skipped.find(entry => entry.record === `person ${broken.id}`);
    expect(invalid).toMatchObject({ file: 'goose-wiki.json' });
    expect(invalid!.reason).not.toMatch(/^\[|"code"/);
    expect(invalid!.reason.length).toBeLessThan(200);
    expect(skipped).toContainEqual(expect.objectContaining({ file: 'goose-wiki.json', record: ledgerOwner.id, reason: expect.stringMatching(/already belongs/) }));
  });

  it('reports an unreadable goose-wiki.json in one line', () => {
    const directory = tempDirectory();
    write(directory, 'goose-wiki.json', { ...liveWiki(), version: 2 });
    const entry = loadNewsArchive(directory).skipped.find(item => item.file === 'goose-wiki.json')!;
    expect(entry.reason).toMatch(/^unreadable: version/);
    expect(entry.reason.length).toBeLessThan(200);
  });
});

describe('contest boards', () => {
  const now = Date.parse('2026-11-02T20:00:00Z');
  const slug = KAGGLE_COMPETITIONS['arc-3'].slug;

  it('drops only a duplicated team, keeping the rest of the contest', () => {
    const latest = { competition: slug, fetched: '2026-11-02T19:30:00Z', rows: [
      [1, '1', 'Duplicated', '', 0.5, 3, 'a'], [2, '2', 'Unique', '', 0.4, 2, 'b'], [3, '1', 'Duplicated again', '', 0.3, 1, 'a'],
    ] };
    expect(snapshotsFromBoard('arc-3', latest, new Set(['1', '2']), now).map(row => row.teamId)).toEqual(['2']);
  });

  it('moves the generation only when the rows change, and names a failed contest', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const wiki = loadWikiInputs(LIVE)!;
    const directory = 'fixture-board-generation';
    let teamName = 'Tufa Labs';
    let arc2Fails = false;
    const fetched = new Date().toISOString();
    vi.spyOn(kaggleBoardRepository, 'getDocuments').mockImplementation(async competition => {
      if (competition === KAGGLE_COMPETITIONS['arc-2'].slug && arc2Fails) throw new Error('Fixture board failure');
      if (competition !== slug) return [];
      return [{ name: 'latest', capturedAt: fetched, body: JSON.stringify({ competition: slug, fetched,
        rows: [[2, '15486995', teamName, '', 70.24, 180, 'driessmit1,jeroencottaar']] }) }];
    });
    const read = async () => { await cardBoardCache(directory, wiki.registry, getNewsIndex()).pending; return cardBoardStatus(directory); };
    const first = await read();
    vi.setSystemTime(Date.now() + 61_000);
    expect((await read()).generation).toBe(first.generation);
    teamName = 'Tufa Labs renamed';
    vi.setSystemTime(Date.now() + 61_000);
    expect((await read()).generation).toBe(first.generation! + 1);
    arc2Fails = true;
    vi.setSystemTime(Date.now() + 61_000);
    expect((await read()).error).toMatch(/arc-2: Fixture board failure/);
  });
});

describe('Card Cabinet', () => {
  it('serves a memo hit without reading the story folders', () => {
    getNewsCollection();
    const readdir = vi.spyOn(fs, 'readdirSync');
    getNewsCollection();
    expect(readdir).not.toHaveBeenCalled();
  });

  it('leaves out and records a card whose artwork fails its digest, keeping the others', () => {
    const directory = tempDirectory();
    const wiki = liveWiki();
    const target = (wiki.registry.cards as { id: string; art?: { src: string } }[]).find(card => card.art && wiki.assetDigests[card.art.src])!;
    wiki.assetDigests[target.art!.src] = '0'.repeat(64);
    write(directory, 'goose-wiki.json', wiki);
    const collection = getNewsCollection(directory);
    expect(collection.cards.length).toBeGreaterThan(0);
    expect(collection.cards.some(card => card.id === target.id)).toBe(false);
    // No remaining card links to the card that was left out.
    expect(JSON.stringify(collection.cards)).not.toContain(`/news/cards/${target.id}"`);
    expect(newsCollectionHealth(directory).skipped).toContainEqual({ file: 'goose-wiki.json', record: target.id, reason: `artwork digest mismatch for ${target.art!.src}` });
  });

  it('serves the last good Cabinet when goose-wiki.json breaks, and reports the failure', () => {
    const directory = tempDirectory();
    const wiki = liveWiki();
    write(directory, 'goose-wiki.json', wiki);
    const good = getNewsCollection(directory);
    write(directory, 'goose-wiki.json', '{ broken');
    expect(getNewsCollection(directory)).toBe(good);
    const health = newsCollectionHealth(directory);
    expect(health.error).toMatch(/^The Card Cabinet could not be built: goose-wiki\.json: /);
    expect(health.error!.length).toBeLessThan(300);
  });

  it('returns null from tryNewsCollection when there has never been a good build', () => {
    const directory = tempDirectory();
    write(directory, 'goose-wiki.json', { ...liveWiki(), version: 2 });
    expect(tryNewsCollection(directory)).toBeNull();
    expect(() => getNewsCollection(directory)).toThrow(/goose-wiki\.json: version/);
  });
});

describe('pages without a Cabinet', () => {
  it('renders the front page, person pages and the sitemap', () => {
    vi.spyOn(collectionModule, 'tryNewsCollection').mockReturnValue(null);
    const front = resolveNewsMeta('/news')!;
    expect(front.status).toBe(200);
    expect(front.tags.bodyHtml).not.toContain('/thumb.webp');
    const person = getNewsIndex().people!.find(item => item.role !== 'sponsor')!;
    const profile = resolveNewsMeta(`/news/people/${person.id}`)!;
    expect(profile.status).toBe(200);
    expect(profile.tags.bodyHtml).not.toContain('Their cards');
    const urls = newsSitemapEntries().map(entry => entry.url);
    expect(urls.some(url => url.endsWith('/news/cards'))).toBe(true);
    expect(urls.some(url => /\/news\/cards\/./.test(url))).toBe(false);
    expect(urls.some(url => url.includes('/news/people/'))).toBe(true);
  });
});

describe('/api/news/health and story caching', () => {
  async function withServer(run: (base: string) => Promise<void>) {
    const app = express();
    mountNews(app);
    const server = app.listen(0, '127.0.0.1');
    if (!server.listening) await once(server, 'listening');
    const address = server.address();
    try {
      if (!address || typeof address === 'string') throw Error('Missing test server');
      await run(`http://127.0.0.1:${address.port}`);
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  }

  it('turns degraded when the Cabinet leaves a card out or a board read fails', async () => {
    const left = { file: 'goose-wiki.json', record: 'person-fixture-2026', reason: 'card has no verified person (fixture)' };
    vi.spyOn(collectionModule, 'newsCollectionHealth').mockReturnValue({ skipped: [left], boards: 'Contest board unavailable (arc-2: down)' });
    await withServer(async base => {
      const health = await (await fetch(`${base}/api/news/health`)).json();
      expect(health.status).toBe('degraded');
      expect(health.skipped).toContainEqual(left);
      expect(health.problems).toEqual(['Contest board unavailable (arc-2: down)']);
    });
  });

  it('caches a published story for a minute and never a miss', async () => {
    await withServer(async base => {
      const hit = await fetch(`${base}/api/news/stories/${getNewsIndex().articles[0].id}`);
      expect(hit.status).toBe(200);
      expect(hit.headers.get('cache-control')).toBe('public, max-age=60');
      const miss = await fetch(`${base}/api/news/stories/does-not-exist`);
      expect(miss.status).toBe(404);
      expect(miss.headers.get('cache-control')).toBe('no-store');
    });
  });
});
