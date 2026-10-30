/**
 * Author: GPT-6.1 Sol / Codex; GPT-6 Sol / Codex; Claude Opus 5.5 (Bubba); Claude Opus 5.5 Low
 * Date: 2026-10-30 (Claude Sonnet 5.5: slow archive walks get a 60 s limit; faces from the web, Jack's own Kaggle picture); 2026-10-29 (card path assertion supports specials without a box score); 2026-10-28 (reserved feature permalink regression)
 * PURPOSE: Verify complete illustrated feature delivery through permanent edition URLs,
 *          public news delivery, search-readable articles, evidence and rejection
 *          of missing identities and invalid citations using the committed launch issues.
 *          RSS checks cover the newest 40 editions; the sitemap checks the whole archive,
 *          so normal archive growth does not produce a false publication failure.
 *          Unified masthead replaces the former methods page and uses the editor portrait.
 *          08-Oct-2026: share cards (size, real drawn content, cache headers, 404s), the
 *          per-article og/twitter/JSON-LD image, CollectionPage, lastmod and RSS additions.
 *          Social dispatch validation, people/artwork routes and public-only source discovery protect dated contender updates.
 *          09-Oct-2026 (Claude Opus 5.5): every ledger portrait is a committed file traced to the
 *          person's own source; profiles lead with face and honors; stories pick cited faces first.
 *          Later the same day: the market digest route, the wire page and the wire story contract.
 *          10-Oct-2026 (Claude Sonnet 5.5): the front-page card's versioned address, freshness rule and
 *          ARC puzzle figure; the /news sitemap date now counts wire stories like the code does.
 *          Public source archives and discussion selection reject unread, restricted and misdirected sources.
 *          15-Oct-2026 (Claude Opus 5.5 Max): the content check (every committed file loads, nothing
 *          left out) and the store leaving out one bad edition, dispatch or ledger record, with
 *          /api/news/health reporting it, instead of failing the whole paper.
 * SRP/DRY check: Pass — exercises production store, routes and metadata middleware.
 */
import { beforeAll, afterAll, it, expect } from 'vitest';
import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import { mountNews } from '../../server/routes/news';
import { getNewsIndex, loadNewsArchive, newsArticleSchema, newsDispatchSchema, competitorSchema, newsPersonSchema, newsWireSchema, newsDiscussionSchema } from '../../server/services/news/newsStore';
import { metaTagInjector, seoRouting } from '../../server/middleware/metaTagInjector';
import { SITE_ORIGIN, escapeHtml } from '../../shared/seo';
import sharp from 'sharp';
import { articleCardPath, articleTitle, easternDay, NEWS_CARD_FRESH_MS, NEWS_SECTION_CARD_PATH, sectionCardArticles, sectionCardPath, TITLE_BUDGET, citedPeople, storyPeople, NEWS_EDITION_WRITERS, NEWS_WIRE_WRITERS, WRITER_CREDITS } from '../../shared/news';
import { ARC_COLORS_TUPLES } from '../../shared/config/colors';
import { articleCardSvg, cardText, renderArticleCard, renderSectionCard } from '../../server/services/news/newsCardImage';
import { puzzleOfTheDay } from '../../server/services/news/newsCardPuzzle';
const metaContent = (html: string, key: string) => html.match(new RegExp(`(?:property|name)="${key}" content="([^"]*)"`))?.[1];
const unescape = (value = '') => value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
/** A blank or flat image passes a size check; a drawn card has many distinct shades. */
async function expectDrawnCard(png: Buffer) {
  const image = sharp(png);
  const meta = await image.metadata();
  expect([meta.width, meta.height]).toEqual([1200, 630]);
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const shades = new Set<number>();
  let ink = 0;
  for (let index = 0; index < data.length; index += info.channels) {
    shades.add((data[index] << 16) | (data[index + 1] << 8) | data[index + 2]);
    if (data[index] < 80 && data[index + 1] < 80 && data[index + 2] < 80) ink++;
  }
  expect(shades.size).toBeGreaterThan(50);
  expect(ink / (data.length / info.channels)).toBeGreaterThan(0.02);
}
let server: Server;
let base: string;
beforeAll(async () => {
  const app = express();
  mountNews(app);
  app.use(seoRouting);
  app.use(metaTagInjector);
  await new Promise<void>(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  if (!address || typeof address === 'string') throw Error('Missing listener');
  base = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });
it('publishes full article text and real NewsArticle schema before JavaScript runs', async () => {
  const index = getNewsIndex();
  expect(index.articles.length).toBeGreaterThanOrEqual(2);
  expect(await (await fetch(`${base}/api/news`)).json()).toEqual(index);
  for (const article of index.articles) {
    const response = await fetch(`${base}/news/${article.id}`);
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain(escapeHtml(article.headline));
    expect(html).toContain(escapeHtml(article.sections[0].text.split(/\n\n+/)[0]));
    expect(html).toContain(`href="${SITE_ORIGIN}/news/${article.id}"`);
    expect(html).not.toContain('content="noindex');
    const schema = JSON.parse(html.match(/id="page-structured-data" type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]);
    const story = schema['@graph'].find((node: Record<string, unknown>) => node['@type'] === 'NewsArticle');
    expect(story.headline).toBe(article.headline);
    expect(story.datePublished).toBe(article.publishedAt);
    expect(story.citation).toEqual([...new Set(article.sources.map(source => source.url))]);
    const card = `${SITE_ORIGIN}${articleCardPath(article)}`;
    expect(story.image[0]).toMatchObject({ url: card, width: 1200, height: 630 });
    expect(story.publisher.logo.url).toBe(`${SITE_ORIGIN}/android-chrome-512x512.png`);
    expect(unescape(metaContent(html, 'og:image'))).toBe(card);
    expect(unescape(metaContent(html, 'twitter:image'))).toBe(card);
    expect(metaContent(html, 'og:image:width')).toBe('1200');
    expect(metaContent(html, 'article:published_time')).toBe(article.publishedAt);
    expect(metaContent(html, 'og:image:alt')).toContain(escapeHtml(article.headline));
    expect(html.match(/<title>([^<]*)<\/title>/)![1].length).toBeLessThanOrEqual(Math.max(TITLE_BUDGET, escapeHtml(article.headline).length));
    expect(articleTitle(article).length).toBeLessThanOrEqual(Math.max(TITLE_BUDGET, article.headline.length));
    expect(metaContent(html, 'description')!.length).toBeLessThanOrEqual(Math.max(160, escapeHtml(article.dek).length));
    const evidence = await fetch(`${base}/api/news/${article.id}/evidence`);
    expect(evidence.status).toBe(200);
    expect(evidence.headers.get('content-type')).toContain('json');
  }
});
it('serves the full public tweet archive and rejects unread or restricted board leads', async () => {
  const index = getNewsIndex();
  const html = await (await fetch(`${base}/news/community`)).text();
  for (const post of index.socialArchive!) {
    expect(post.visibility).toBe('public');
    expect(html).toContain(`id="post-${post.id}"`);
  }
  for (const thread of index.discussions!) expect(html).toContain(thread.url);
  const thread = index.discussions![0];
  for (const invalid of [{ bodyRead: false }, { visibility: 'unknown' }, { decision: 'watch-only' },
    { postedAt: null, latestActivityAt: null }, { url: 'https://www.kaggle.com/competitions/other/discussion/748593' }]) {
    expect(newsDiscussionSchema.safeParse({ ...thread, ...invalid }).success).toBe(false);
  }
});
it('discovers every archived article and separate competitor identity through the sitemap', async () => {
  const index = getNewsIndex();
  const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
  for (const article of index.articles) {
    expect(sitemap).toContain(`${SITE_ORIGIN}/news/${article.id}`);
    expect(sitemap).toContain(`<loc>${SITE_ORIGIN}/news/${article.id}</loc><lastmod>${article.publishedAt}</lastmod>`);
  }
  for (const record of index.competitors) {
    expect(sitemap).toContain(`/news/competitors/${record.id}`);
    const response = await fetch(`${base}/news/competitors/${record.id}`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain(escapeHtml(record.name));
  }
}, 60_000); // the archive keeps growing; each of these walks all of it
it('serves the newest 40 editions in RSS order without including older archive entries', async () => {
  const articles = getNewsIndex().articles;
  const rss = await fetch(`${base}/news/feed.xml`);
  expect(rss.headers.get('content-type')).toContain('application/rss+xml');
  const xml = await rss.text();
  const recent = articles.slice(0, 40);
  const itemLinks = [...xml.matchAll(/<guid isPermaLink="true">([^<]+)<\/guid>/g)].map(match => match[1]);
  expect(itemLinks).toEqual(recent.map(article => `${SITE_ORIGIN}/news/${article.id}`));
  expect(recent.map(article => Date.parse(article.publishedAt))).toEqual(
    recent.map(article => Date.parse(article.publishedAt)).sort((a, b) => b - a),
  );
  for (const article of recent) {
    expect(xml).toContain(escapeHtml(article.headline));
    expect(xml).toContain(escapeHtml(`${SITE_ORIGIN}${articleCardPath(article)}`));
  }
  expect(xml).toContain(`<atom:link href="${SITE_ORIGIN}/news/feed.xml" rel="self"`);
  expect(xml).toContain(`<lastBuildDate>${new Date(articles[0].publishedAt).toUTCString()}</lastBuildDate>`);
});
it('returns real 404s for unknown articles, competitors and evidence', async () => {
  for (const path of ['/news/not-an-issue', '/news/competitors/arc-3-0', '/api/news/not-an-issue/evidence', '/api/news/og-image/not-an-issue.png']) {
    expect((await fetch(`${base}${path}`)).status).toBe(404);
  }
});
it('rejects invented citation IDs and competitors assigned to the wrong competition', () => {
  const article = structuredClone(getNewsIndex().articles[0]);
  article.sections[0].sourceIds = ['invented'];
  expect(newsArticleSchema.safeParse(article).success).toBe(false);
  const record = structuredClone(getNewsIndex().competitors[0]);
  record.id = `arc-9-${record.teamId}`;
  expect(competitorSchema.safeParse(record).success).toBe(false);
});
it('serves a drawn 1200x630 card for every article and the front page', async () => {
  for (const article of getNewsIndex().articles) {
    const response = await fetch(`${base}${articleCardPath(article)}`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('cache-control')).toContain('immutable');
    await expectDrawnCard(Buffer.from(await response.arrayBuffer()));
  }
  const section = await fetch(`${base}${NEWS_SECTION_CARD_PATH}`);
  expect(section.status).toBe(200);
  expect(section.headers.get('cache-control')).not.toContain('immutable');
  await expectDrawnCard(Buffer.from(await section.arrayBuffer()));
}, 60_000);
it('gives the front page and notebook the newspaper card and list structured data', async () => {
  for (const [path, type] of [['/news', 'CollectionPage'], ['/news/competitors', 'CollectionPage']]) {
    const html = await (await fetch(`${base}${path}`)).text();
    expect(metaContent(html, 'og:image')).toBe(`${SITE_ORIGIN}${sectionCardPath(getNewsIndex().articles)}`);
    const schema = JSON.parse(html.match(/id="page-structured-data" type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]);
    const page = schema['@graph'].find((node: Record<string, unknown>) => node['@type'] === type);
    expect(page.mainEntity.itemListElement.length).toBeGreaterThan(0);
    expect((html.match(/<h1[\s>]/g) ?? []).length).toBe(1);
  }
});
it('advertises the front-page card under an address that changes with the day and the editions it shows', () => {
  const { articles } = getNewsIndex();
  const now = Date.parse(articles[0].publishedAt) + 3_600_000;
  expect(sectionCardArticles(articles, now).length).toBeGreaterThan(0);
  expect(sectionCardArticles(articles, now).every(article => now - Date.parse(article.publishedAt) <= NEWS_CARD_FRESH_MS)).toBe(true);
  expect(sectionCardPath(articles, now)).toMatch(/^\/api\/news\/og-image\.png\?v=[a-z0-9]+$/);
  // The same editions on the same day always give the same address, whatever order they arrive in.
  expect(sectionCardPath([...articles].reverse(), now)).toBe(sectionCardPath(articles, now));
  // A newer edition, the next day, or the editions going stale each give a new address, so a service that kept the old picture fetches the new one.
  const newer = [{ ...articles[0], id: `${articles[0].id}-next`, headline: 'A newer headline', publishedAt: new Date(now).toISOString() }, ...articles];
  expect(sectionCardPath(newer, now)).not.toBe(sectionCardPath(articles, now));
  expect(sectionCardPath(articles, now + 86_400_000)).not.toBe(sectionCardPath(articles, now));
  const stale = Date.parse(articles[0].publishedAt) + NEWS_CARD_FRESH_MS + 3_600_000;
  expect(sectionCardArticles(articles, stale)).toEqual([]);
  expect(sectionCardPath(articles, stale)).not.toBe(sectionCardPath(articles, now));
});
it('gives every ARC Daily page that shares the front-page card its current address, and that address serves a card', async () => {
  const { articles, competitors } = getNewsIndex();
  const expected = `${SITE_ORIGIN}${sectionCardPath(articles)}`;
  for (const route of ['/news', '/news/wire', '/news/competitors', '/news/people', '/news/community', `/news/competitors/${competitors[0].id}`]) {
    const html = await (await fetch(`${base}${route}`)).text();
    expect(metaContent(html, 'og:image'), route).toBe(expected);
    expect(metaContent(html, 'twitter:image'), route).toBe(expected);
  }
  const card = await fetch(expected);
  expect(card.status).toBe(200);
  expect(card.headers.get('content-type')).toBe('image/png');
  await expectDrawnCard(Buffer.from(await card.arrayBuffer()));
});
it('picks a real small training puzzle for each Eastern day, the same one all day', async () => {
  const today = await puzzleOfTheDay('2026-10-10');
  expect(today).not.toBeNull();
  expect(await puzzleOfTheDay('2026-10-10')).toEqual(today);
  expect((await puzzleOfTheDay('2026-10-11'))?.id).not.toBe(today!.id);
  for (const grid of [today!.input, today!.output]) {
    expect(Math.max(grid.length, grid[0].length)).toBeLessThanOrEqual(10);
    expect(grid.flat().every(cell => Number.isInteger(cell) && cell >= 0 && cell <= 9)).toBe(true);
  }
  expect(await puzzleOfTheDay('not-a-day')).toBeNull();
});
it('draws the front-page card with an ARC puzzle in the ARC colours, and says what the paper is once no edition is fresh', async () => {
  const { articles } = getNewsIndex();
  const now = Date.parse(articles[0].publishedAt) + 3_600_000;
  const stale = now + 7 * 86_400_000;
  const puzzle = await puzzleOfTheDay(easternDay(now));
  const fresh = await renderSectionCard(articles, puzzle, now);
  const evergreen = await renderSectionCard(articles, puzzle, stale);
  await expectDrawnCard(fresh);
  await expectDrawnCard(evergreen);
  expect(fresh.equals(evergreen)).toBe(false);
  // The puzzle is drawn in ARC's own palette: at least one exact ARC colour (other than black) appears.
  const { data, info } = await sharp(fresh).raw().toBuffer({ resolveWithObject: true });
  const palette = ARC_COLORS_TUPLES.slice(1);
  let arcPixels = 0;
  for (let index = 0; index < data.length; index += info.channels) {
    if (palette.some(([red, green, blue]) => data[index] === red && data[index + 1] === green && data[index + 2] === blue)) arcPixels++;
  }
  expect(arcPixels).toBeGreaterThan(100);
  await expectDrawnCard(await renderSectionCard(articles, null, stale));
});
it('draws card text as paths, so the container needs no system fonts', async () => {
  const svg = await articleCardSvg(getNewsIndex().articles[0]);
  expect(svg).not.toMatch(/<text|font-family/);
  // Specials without score rows legitimately have fewer text runs than the routine editions.
  expect(svg).toMatch(/<path[^>]+d="[^"]+"/);
});
it('serves sourced dispatches and their artwork in front-page API and crawler text', async () => {
  const index = getNewsIndex();
  const dispatch = index.dispatches!.find(story => story.image)!;
  expect(dispatch).toBeDefined();
  const html = await (await fetch(`${base}/news`)).text();
  expect(html).toContain(escapeHtml(dispatch.headline));
  for (const paragraph of dispatch.sections[0].text.split(/\n\n+/)) expect(html).toContain(escapeHtml(paragraph));
  expect(html).toContain(dispatch.image!.src);
  for (const source of dispatch.sources) expect(html).toContain(escapeHtml(source.url));
  const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
  const latest = [...index.articles, ...index.dispatches!, ...(index.wire ?? [])].map(story => story.publishedAt).sort().at(-1);
  expect(sitemap).toContain(`<loc>${SITE_ORIGIN}/news</loc><lastmod>${latest}</lastmod>`);
  const changed = structuredClone(dispatch);
  changed.sections[0].sourceIds = ['invented'];
  expect(newsDispatchSchema.safeParse(changed).success).toBe(false);
  changed.sections[0].sourceIds = dispatch.sections[0].sourceIds;
  changed.image!.src = '/news-images/../../private.png';
  expect(newsDispatchSchema.safeParse(changed).success).toBe(false);
});
it('keeps cards drawable for names and headlines outside the card fonts', async () => {
  expect(cardText('the last dance 🕺')).toBe('the last dance');
  expect(cardText('復活の混テキスト')).toBe('');
  const article = structuredClone(getNewsIndex().articles[0]);
  article.headline = `${'A very long headline about the ARC-AGI-3 race '.repeat(5)}🎉`;
  article.stats = [{ teamId: '1', name: '復活の混テキスト', rank: 1, score: 1, rankChange: null, scoreChange: null }];
  await expectDrawnCard(await renderArticleCard(article));
});

it('publishes verified people, historical artwork and public community branches', async () => {
  const index = getNewsIndex();
  const keith = index.people!.find(person => person.id === 'keith-tyser')!;
  expect(new Set(keith.memberships.map(member => member.competition))).toEqual(new Set(['arc-2', 'arc-3']));
  for (const route of ['/news/people', '/news/people/keith-tyser', '/news/community', '/news/staff']) {
    const response = await fetch(`${base}${route}`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain(`href="${SITE_ORIGIN}${route}"`);
  }
  const cpmp = await (await fetch(`${base}/news/people/jean-francois-puget`)).text();
  expect(cpmp).toContain('/jfPuget3.png');
  expect(cpmp).toContain('/hall-of-fame#contributor-7');
  const roster = await (await fetch(`${base}/news/competitors/arc-2-15526034`)).text();
  expect(roster).toContain('/news/people/keith-tyser');
  expect(index.social!.every(post => post.visibility === 'public')).toBe(true);
  expect((await fetch(`${base}/news/people/missing-person`)).status).toBe(404);
});

it('gives people faces from their own sources and puts cited people first in a story', async () => {
  const index = getNewsIndex();
  const people = index.people!;
  for (const person of people.filter(item => item.portrait)) {
    expect(fs.existsSync(path.join(process.cwd(), 'client/public', person.portrait!.src))).toBe(true);
  }
  const jack = people.find(person => person.id === 'jack-cole')!;
  expect(jack.portrait?.kind).toBe('kaggle');
  const profile = await (await fetch(`${base}/news/people/jack-cole`)).text();
  expect(profile).toContain(jack.portrait!.src);
  // Each ARC Prize founder has an individual picture from a public page that names them, never the shared two-man image.
  for (const id of ['francois-chollet', 'mike-knoop']) {
    const founder = people.find(person => person.id === id)!;
    expect(founder.portrait?.kind).toBe('web');
    expect(founder.portrait?.src).not.toContain('arc-founders');
  }
  const stranger = people.find(person => person.id === 'mike-knoop')!;
  expect(newsPersonSchema.safeParse({ ...stranger, name: 'Someone Else' }).success).toBe(false);
  expect(profile).toContain(escapeHtml('ARC Prize 2025 third place · MindsAI & Tufa Labs'));
  expect((await fetch(`${base}/news/people/ivan-sorokin`)).status).toBe(200);
  // A Kaggle picture may only come from the person's own verified account.
  const jan = people.find(person => person.id === 'jan-disselhoff')!;
  expect(newsPersonSchema.safeParse({ ...jan, portrait: { ...jan.portrait!, sourceUrl: 'https://www.kaggle.com/dvhrtm' } }).success).toBe(false);
  // Cited people lead; team members follow; uncited brief sources add nobody.
  const article = { ...index.articles.find(item => item.competition === 'arc-3')!, teamIds: ['15770880'], sections: [{ text: 'NVARC3 moved.', sourceIds: ['person-ivan-sorokin-fact-0', 'person-ivan-sorokin-archive-0'] }] };
  expect(citedPeople(article.sections, people).map(person => person.id)).toEqual(['ivan-sorokin']);
  // The ledger keeps verifying NVARC3 teammates, so check the order and the roster rule, not a fixed list.
  const faces = storyPeople(article, people, index.competitors);
  expect(faces.slice(0, 2).map(person => person.id)).toEqual(['ivan-sorokin', 'jean-francois-puget']);
  const roster = index.competitors.find(record => record.competition === 'arc-3' && record.teamId === '15770880')!;
  for (const person of faces.slice(1)) expect(person.accounts.some(account => account.platform === 'kaggle' && roster.members.includes(account.handle))).toBe(true);
});
it('serves the market digest and the wire, and holds wire stories to their contract', async () => {
  // No database in tests: the digest answers with no boards rather than failing the front page.
  const markets = await fetch(`${base}/api/news/markets`);
  expect(markets.status).toBe(200);
  expect(await markets.json()).toMatchObject({ boards: {} });
  const page = await fetch(`${base}/news/wire`);
  expect(page.status).toBe(200);
  const html = await page.text();
  expect(html).toContain('<h1>The wire</h1>');
  expect(html).toContain(`href="${SITE_ORIGIN}/news/wire"`);
  for (const story of getNewsIndex().wire ?? []) expect(html).toContain(escapeHtml(story.headline));
  expect((await fetch(`${base}/api/news/wire/2026-10-09-2020-arc-3-missing/evidence`)).status).toBe(404);
  const story = {
    id: '2026-10-09-2020-arc-3-chen-takes-the-lead', competition: 'arc-3', publishedAt: '2026-10-10T00:20:00Z', dataAsOf: '2026-10-09T23:54:00Z',
    since: '2026-10-08T23:51:00Z', headline: 'Yi-Chia Chen takes the ARC-AGI-3 lead from Tufa Labs',
    sections: [{ text: 'Yi-Chia Chen gained 3.40 points to 59.17% and moved to 1st.', sourceIds: ['board-arc-3'] }],
    sources: [{ id: 'board-arc-3', title: 'ARC-AGI-3 public leaderboard', url: 'https://arc.markbarney.net/kaggle-leaderboard', accessedAt: '2026-10-10T00:10:00Z' }],
    teamIds: ['15499660'], personIds: ['yi-chia-chen'],
    visual: { src: '/news-images/people/yi-chia-chen.webp', alt: 'Yi-Chia Chen’s Kaggle profile picture', href: '/news/people/yi-chia-chen' },
    generatedBy: 'gpt-6-luna',
  };
  expect(newsWireSchema.safeParse(story).success).toBe(true);
  expect(newsWireSchema.safeParse({ ...story, id: '2026-10-09-2020-arc-2-chen-takes-the-lead' }).success).toBe(false);
  expect(newsWireSchema.safeParse({ ...story, sections: [{ text: 'Uncited.', sourceIds: ['made-up'] }] }).success).toBe(false);
  expect(newsWireSchema.safeParse({ ...story, visual: { ...story.visual, src: 'https://example.com/face.png' } }).success).toBe(false);
  expect(newsWireSchema.safeParse({ ...story, generatedBy: 'gpt-6-sol' }).success).toBe(false);
  // A malformed wire file is left out instead of breaking the archive.
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wire-'));
  fs.mkdirSync(path.join(directory, 'wire'));
  fs.writeFileSync(path.join(directory, 'wire', `${story.id}.json`), JSON.stringify(story));
  fs.writeFileSync(path.join(directory, 'wire', '2026-10-09-2021-arc-3-broken.json'), JSON.stringify({ ...story, id: '2026-10-09-2021-arc-3-broken', headline: '' }));
  fs.writeFileSync(path.join(directory, 'wire', 'not-json.json'), '{');
  // The index carries the past week; older files stay on disk.
  const old = { ...story, id: '2020-01-01-0900-arc-3-old-news', publishedAt: '2020-01-01T14:00:00Z', dataAsOf: '2020-01-01T13:54:00Z', since: '2019-12-31T13:51:00Z' };
  fs.writeFileSync(path.join(directory, 'wire', `${old.id}.json`), JSON.stringify(old));
  const recent = { ...story, publishedAt: new Date(Date.now() - 3_600_000).toISOString().replace(/\.\d{3}Z$/, 'Z'), dataAsOf: new Date(Date.now() - 7_200_000).toISOString().replace(/\.\d{3}Z$/, 'Z'), since: null };
  fs.writeFileSync(path.join(directory, 'wire', `${story.id}.json`), JSON.stringify(recent));
  expect(getNewsIndex(directory).wire?.map(item => item.id)).toEqual([story.id]);
  fs.rmSync(directory, { recursive: true, force: true });
});
it('credits every writer the newsroom tools may publish as (one list in shared/newsWriters.json)', () => {
  for (const id of new Set([...NEWS_EDITION_WRITERS, ...NEWS_WIRE_WRITERS])) expect(WRITER_CREDITS[id], id).toBeTruthy();
  expect(NEWS_EDITION_WRITERS).toContain('claude-sonnet-5-5');
  expect(NEWS_WIRE_WRITERS).toContain('claude-sonnet-5-5');
  expect(NEWS_WIRE_WRITERS).toContain('claude-haiku-5-5');
});
// The content check: run before pushing news changes. The live site would leave out anything listed here.
it('loads every committed news file and ledger record without leaving anything out', async () => {
  const { skipped } = loadNewsArchive();
  expect(skipped).toEqual([]);
  const health = await (await fetch(`${base}/api/news/health`)).json();
  expect(health).toMatchObject({ status: 'ok', skipped: [] });
  expect(health.counts.articles).toBe(getNewsIndex().articles.length);
});
it('leaves out one bad edition, dispatch or ledger record and keeps the rest of the paper', () => {
  const live = getNewsIndex();
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'news-'));
  const write = (file: string, value: unknown) => {
    fs.mkdirSync(path.dirname(path.join(directory, file)), { recursive: true });
    fs.writeFileSync(path.join(directory, file), typeof value === 'string' ? value : JSON.stringify(value));
  };
  const good = live.articles[0];
  write(`articles/${good.id}.json`, good);
  write('articles/2026-10-15-morning-arc-3.json', { ...good, id: '2026-10-15-morning-arc-3', headline: '' });
  write('articles/2026-10-15-evening-arc-3.json', '{');
  write('articles/renamed-copy.json', good);
  const dispatch = live.dispatches![0];
  write(`dispatches/${dispatch.id}.json`, dispatch);
  write('dispatches/broken-dispatch.json', { ...dispatch, id: 'broken-dispatch', sources: [] });
  const [first, second] = live.people!;
  // A duplicate ID and a second person claiming an already verified account are each left out.
  write('people.json', [first, { ...second, accounts: [...second.accounts, first.accounts[0]] }, { ...first }, { id: 'no-accounts' }]);
  write('competitors.json', [live.competitors[0], { ...live.competitors[1], id: 'wrong-id' }]);
  write('social.json', '[not json');
  const { index, skipped } = loadNewsArchive(directory);
  expect(index.articles.map(article => article.id)).toEqual([good.id]);
  expect(index.dispatches!.map(item => item.id)).toEqual([dispatch.id]);
  expect(index.people!.map(person => person.id)).toEqual([first.id]);
  expect(index.competitors.map(record => record.id)).toEqual([live.competitors[0].id]);
  expect(index.social).toEqual([]);
  expect(skipped.map(entry => `${entry.file}${entry.record ? `#${entry.record}` : ''}`).sort()).toEqual([
    'articles/2026-10-15-evening-arc-3.json', 'articles/2026-10-15-morning-arc-3.json', 'articles/renamed-copy.json',
    `competitors.json#wrong-id`, 'dispatches/broken-dispatch.json',
    `people.json#${first.id}`, 'people.json#no-accounts', `people.json#${second.id}`, 'social.json',
  ].sort());
  fs.rmSync(directory, { recursive: true, force: true });
});


it('serves the reserved evening feature and cover in the permanent edition’s initial HTML', async () => {
  const index = getNewsIndex();
  const article = index.articles.find(item => item.id === '2026-10-28-evening-arc-3')!;
  const feature = index.dispatches!.find(item => item.id === article.frontPageFeatureId)!;
  const response = await fetch(`${base}/news/${article.id}`);
  expect(response.status).toBe(200);
  const html = await response.text();
  expect(html).toContain(`src="${feature.image!.src}"`);
  expect(html).toContain(escapeHtml(feature.image!.caption));
  for (const section of feature.sections) {
    for (const paragraph of section.text.split(/\n\n+/)) expect(html).toContain(escapeHtml(paragraph));
  }
  for (const source of feature.sources) expect(html).toContain(`href="${escapeHtml(source.url)}"`);
  expect(html).toContain(escapeHtml(article.sections[1].text));
  expect(html.indexOf(escapeHtml(feature.sections.at(-1)!.text.split(/\n\n+/)[0])))
    .toBeLessThan(html.indexOf(escapeHtml(article.sections[1].text)));
});
