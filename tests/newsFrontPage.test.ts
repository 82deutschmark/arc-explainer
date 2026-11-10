/**
 * Author: GPT-6 / Codex (reasoning effort not exposed); GPT-6.1 Terra / Codex (reasoning effort not exposed); GPT-6 / Codex (reasoning effort not exposed); GPT-6.1 Sol / Codex; Claude Opus 5.5; GPT-6 Astra Extra high
 * Date: 09-November-2026
 * Special-report permalink regression: GPT-6 / Codex, 2026-11-01.
 * 09-Nov-2026: Verified Tufa cast regression by GPT-6.1 Sol / Codex (effort inherited).
 * 09-Nov-2026 (GPT-6 / Codex): verified story casts and per-contest team card evidence.
 * PURPOSE: Verify the full reserved feature and cover on edition permalinks, and render
 *          the rebuilt ARC Daily Digest front page and wire page with the committed news
 *          archive and a populated market digest, so every live section (ticker, board, movers,
 *          past winners, What's News, profile columns) runs against real-shaped data; and render
 *          it again with no digest to prove a board outage leaves the reporting standing.
 *          Public source-column hierarchy and full archive rendering use committed source data.
 *          15-Oct-2026 (Claude Opus 5.5 Max): the illustration test's article is dated now, so it
 *          still leads the desk after later editions are published.
 *          16-Oct-2026 (Claude Opus 5.5 Medium): the Kaggle-threads check expects the front page's
 *          three most recent threads, matching the column's cap, not every thread in the archive.
 * SRP/DRY check: Pass — production pages, production digest builder, seeded query cache.
 */
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { Router, Route } from 'wouter';
import { afterEach, expect, test, vi } from 'vitest';
import News from '../client/src/pages/News';
import NewsArticle from '../client/src/pages/NewsArticle';
import NewsWire from '../client/src/pages/NewsWire';
import NewsCommunity from '../client/src/pages/NewsCommunity';
import { NewsFrontPage } from '../client/src/components/news/NewsFrontPage';
import { ArticleArchive, EditionLabel } from '../client/src/components/news/NewsDesk';
import { newsArticleMeta, resolveNewsMeta } from '../server/services/news/newsPresentation';
import fs from 'node:fs';
import { getNewsCollection } from '../server/services/news/newsCollection';
import { getNewsIndex } from '../server/services/news/newsStore';
import { buildMarketBoard, type MarketsPayload } from '../shared/newsMarkets';
import { recentDiscussions, type NewsIndex, type NewsWireStory } from '../shared/news';
import { reportedPeople, displayPortrait } from '../shared/news';
import { newsDiscussionSchema, newsPersonSchema } from '../server/services/news/newsStore';
import type { KaggleBoardRow } from '../shared/types';

// Inline sporting spans preserve readable source values and words.
const readable = (html: string) => html.replace(/<[^>]*>/g, '').replaceAll('&amp;', '&').replace(/(\d)(?:st|nd|rd|th)\b/g, '$1').replaceAll('#', '');
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
  client.setQueryData(['/api/news/cards'], getNewsCollection());
  if (path.startsWith('/news/')) client.setQueryData(['/api/news/stories', path.split('/').pop()], index);
  if (payload) client.setQueryData(['/api/news/markets'], payload);
  return renderToStaticMarkup(createElement(QueryClientProvider, { client },
    createElement(HelmetProvider, {}, createElement(Router, { ssrPath: path, children: page === NewsArticle ? createElement(Route, { path: "/news/:articleId", component: page }) : createElement(page) }))));
}

afterEach(() => vi.unstubAllGlobals());

test('the lead precedes social and wire in reading order with or without a market board', () => {
  vi.stubGlobal('React', React);
  const index = getNewsIndex();
  for (const marketData of [markets(index), undefined]) {
    const html = render(() => createElement(NewsFrontPage, { index, markets: marketData }), '/news', index, marketData);
    const lead = html.indexOf('aria-label="Lead stories"');
    const social = html.indexOf('aria-label="From X"');
    const wire = html.indexOf('aria-label="What&#x27;s news"');
    expect(lead).toBeGreaterThanOrEqual(0);
    expect(social).toBeGreaterThan(lead);
    expect(wire).toBeGreaterThan(social);
  }
});

test('a cross-competition report uses its editorial labels on the front page, article and archive', () => {
  vi.stubGlobal('React', React);
  const index = getNewsIndex();
  const legacy = index.articles.find(article => article.id === '2026-11-02-evening-arc-3')!;
  const article = { ...legacy, headline: 'The bell has rung', publishedAt: new Date().toISOString(),
    competitionDisplay: 'ARC-AGI-2 & ARC-AGI-3', editionDisplay: 'Closing report', frontPageFeatureId: undefined };
  const input = { ...index, articles: [article], dispatches: [] };
  const expectedKicker = '<div class="news-kicker"><span>ARC-AGI-2 &amp; ARC-AGI-3</span><span>Closing report</span></div>';
  const front = render(() => createElement(NewsFrontPage, { index: input }), '/news', input);
  const page = render(NewsArticle, `/news/${article.id}`, input);
  expect(front).toContain(expectedKicker);
  expect(page).toContain(expectedKicker);
  const archive = render(() => createElement(ArticleArchive, { articles: [article] }), '/news', input);
  expect(archive).toContain('Closing report · ARC-AGI-2 &amp; ARC-AGI-3');
  const oldKicker = render(() => createElement(EditionLabel, { article: legacy }), '/news', index);
  expect(oldKicker).toContain('<span>ARC-AGI-3</span><span>Late edition</span>');
});

test('the lead renders section illustrations and standings and highlights teams from either table', () => {
  vi.stubGlobal('React', React);
  const index = getNewsIndex();
  const base = index.articles.find(article => article.competition === 'arc-3')!;
  const article = { ...base, publishedAt: new Date().toISOString(), frontPageFeatureId: undefined, stats: [], verifiedTeamNames: ['Unranked Runners'],
    sections: [
      { text: 'The contest has closed.', sourceIds: ['board'] },
      { heading: 'The public field', text: 'infinity holds a ledge. Unranked Runners watch.', sourceIds: ['board'],
        image: { src: '/news-images/2026-11-02-infinity-lightning-leap-v1.webp', alt: 'A storm and cat', caption: 'An illustrated field' },
        standings: { caption: 'Standings fixture for the field', observedAt: '2026-11-03T00:16:20Z',
          rows: [{ teamId: '15494354', name: 'infinity', rank: 9, score: 53.12 }] } },
    ] };
  const input = { ...index, articles: [article], dispatches: [] };
  const html = render(() => createElement(NewsFrontPage, { index: input }), '/news', input);
  expect(html).toContain('alt="A storm and cat"');
  expect(html).toContain('Standings fixture for the field');
  expect(html).toContain('<strong class="news-team-name">infinity</strong>');
  expect(html).toContain('<strong class="news-team-name">Unranked Runners</strong>');
  const paragraph = html.indexOf('infinity</strong> holds a ledge.');
  const table = html.indexOf('Standings fixture for the field');
  expect(paragraph).toBeGreaterThanOrEqual(0);
  expect(table).toBeGreaterThan(paragraph);
});

test('a newer ARC2 special leads with its full reserved feature and illustration', () => {
  vi.stubGlobal('React', React);
  const index = getNewsIndex();
  const special = JSON.parse(fs.readFileSync('content/news/articles/2026-10-30-evening-arc-2-preview.json', 'utf8'));
  const feature = JSON.parse(fs.readFileSync(`content/news/dispatches/${special.frontPageFeatureId}.json`, 'utf8'));
  const earlier = { ...special, id: 'earlier-arc3', competition: 'arc-3' as const, publishedAt: '2026-10-30T10:00:00Z', frontPageFeatureId: undefined, headline: 'Earlier ARC3 report' };
  const input = { ...index, articles: [earlier, special], dispatches: [feature] };
  const html = render(() => createElement(NewsFrontPage, { index: input }), '/news', input);
  const lead = html.split('aria-label="Lead stories"')[1];
  expect(lead.indexOf(feature.headline)).toBeLessThan(lead.indexOf(earlier.headline));
  expect(lead.slice(0, lead.indexOf(earlier.headline))).toContain(feature.image.src);
  expect(readable(lead)).toContain(readable(feature.sections.at(-1).text));
});

test('equally timed routine editions keep ARC3 first', () => {
  vi.stubGlobal('React', React);
  const index = getNewsIndex();
  const base = index.articles[0];
  const articles = (['arc-2', 'arc-3'] as const).map(competition => ({ ...base, competition, id: `same-time-${competition}`, headline: `Routine ${competition}`, frontPageFeatureId: undefined }));
  const input = { ...index, articles, dispatches: [] };
  const html = render(() => createElement(NewsFrontPage, { index: input }), '/news', input);
  const lead = html.split('aria-label="Lead stories"')[1];
  expect(lead.indexOf('Routine arc-3')).toBeLessThan(lead.indexOf('Routine arc-2'));
});

test('the front page runs every live section against a populated digest', () => {
  vi.stubGlobal('React', React);
  const index = getNewsIndex();
  const html = render(News, '/news', index, markets(index));
  for (const text of ['What’s news', 'The board', 'Market movers', 'Where the past winners stand', 'Inside', 'Cards', 'Every edition',
    'Gold line · 5 places', 'Into gold:', 'Leader · <span class="news-ticker-name">Yi-Chia Chen</span>', 'NEW', 'ARC Prize 2025 champion · NVARC'])
    expect(html).toContain(text);
  // A newer afternoon dispatch can lead; a reserved feature gets the full treatment for its edition.
  const newest = [...index.articles, ...(index.dispatches ?? [])]
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || b.id.localeCompare(a.id))[0];
  const feature = 'frontPageFeatureId' in newest ? index.dispatches?.find(story => story.id === newest.frontPageFeatureId) : undefined;
  const lead = feature ?? newest;
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
  expect(readable(html)).toContain(readable(index.articles[0].headline.slice(0, 30)));
  for (const text of ['news-ticker', 'Market movers', 'Where the past winners stand', 'The board<']) expect(html).not.toContain(text);
});

test('Kaggle threads follow the prominent X strip and the wire, with original links', () => {
  vi.stubGlobal('React', React);
  const index = getNewsIndex();
  // The real archived thread may have aged out of the live seven-day feed.
  index.discussions = [newsDiscussionSchema.parse(JSON.parse(fs.readFileSync('content/news/discussions.json', 'utf8'))[0])];
  const html = render(News, '/news', index, markets(index));
  expect(html.indexOf('aria-label="From X"')).toBeLessThan(html.indexOf('aria-label="From the Kaggle boards"'));
  expect(html.indexOf('What’s news')).toBeLessThan(html.indexOf('aria-label="From the Kaggle boards"'));
  // The front-page column links to the original threads.
  for (const thread of recentDiscussions(index.discussions!).slice(0, 3)) expect(html).toContain(`href="${thread.url}"`);
  expect(html).toContain('href="/news/community">Story archive</a>');
  expect(html).not.toContain('/news/community#');
});

test('story archive links to every published edition and dispatch in newest-first order', () => {
  vi.stubGlobal('React', React);
  const index = getNewsIndex();
  const html = render(NewsCommunity, '/news/community', index);
  const stories = [...index.articles, ...index.dispatches!].sort((a, b) =>
    Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || a.id.localeCompare(b.id));
  const links = [...html.matchAll(/<h3><a href="([^"]+)">/g)].map(match => match[1]);
  expect(links).toEqual(stories.map(story => `/news/${story.id}`));
  expect(html).toContain('Search stories');
  expect(html).toContain('All competitions');
  for (const competition of new Set(stories.map(story => story.competition))) {
    expect(html).toContain(`<option value="${competition}">`);
  }
  expect(html).not.toContain('tweet-archive');
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
  expect(front).toContain(displayPortrait(index.people!.find(person => person.id === 'yi-chia-chen')!)!.src);
  const page = render(NewsWire, '/news/wire', index);
  expect(page).toContain('id="2026-10-09-2020-arc-3-chen-takes-the-lead"');
  expect(page).toContain('Yi-Chia Chen gained 3.40 points to 59.17% and moved to 1st.');
  expect(page).toContain('/api/news/wire/2026-10-09-2020-arc-3-chen-takes-the-lead/evidence');
});

test('an edition-bound illustration runs with its headline and dated caption', () => {
  vi.stubGlobal('React', React);
  const index = getNewsIndex();
  const art = JSON.parse(fs.readFileSync('content/news/artwork/2026-10-12-evening-arc-3-preview-dc154a9777.json', 'utf8'));
  // Published "now" so it leads the ARC-3 desk however many editions have run since this artwork.
  const article = { ...index.articles.find(story => story.competition === 'arc-3')!, id: art.articleId,
    headline: art.headline, publishedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), dataAsOf: art.dataAsOf, frontPageFeatureId: undefined, image: art.image };
  index.articles = [article, ...index.articles];
  const front = render(News, '/news', index, markets(index));
  for (const html of [front, newsArticleMeta(article).bodyHtml!]) {
    expect(html).toContain(`src="${art.image.src}"`);
    expect(html).toContain(art.headline);
    expect(html).toContain(art.image.caption);
  }
});


test('the evening permalink includes its complete feature and cover before the closing recap', () => {
  vi.stubGlobal('React', React);
  const index = getNewsIndex();
  const article = index.articles.find(item => item.id === '2026-10-28-evening-arc-3')!;
  const feature = index.dispatches!.find(item => item.id === article.frontPageFeatureId)!;
  expect(feature.image).toBeDefined();
  const html = render(NewsArticle, `/news/${article.id}`, index);
  expect(html).toContain(`src="${feature.image!.src}"`);
  expect(html).toContain(feature.image!.caption);
  // Every feature section and original source must survive the actual linked page, not just /news.
  for (const section of feature.sections) expect(html).toContain(section.text.slice(0, 40).replace(/&/g, '&amp;').replace(/'/g, '&#x27;'));
  for (const source of feature.sources) expect(html).toContain(`href="${source.url}"`);
  expect(readable(html)).toContain(readable(article.sections[1].text.slice(0, 40)));
  expect(readable(html).indexOf(readable(feature.sections.at(-1)!.text.slice(0, 40))))
    .toBeLessThan(readable(html).indexOf(readable(article.sections[1].text.slice(0, 40))));
  expect(html.match(new RegExp(`id="${feature.id}"`, 'g'))).toHaveLength(1);
});

test('missing or unrelated reserved features leave the ordinary edition readable', () => {
  vi.stubGlobal('React', React);
  const index = getNewsIndex();
  const original = index.articles.find(item => item.id === '2026-10-28-evening-arc-3')!;
  const feature = index.dispatches!.find(item => item.id === original.frontPageFeatureId)!;
  for (const replacement of [undefined, { ...feature, competition: 'arc-2' as const }]) {
    const input = { ...index, articles: [original], dispatches: replacement ? [replacement] : [] };
    const html = render(NewsArticle, `/news/${original.id}`, input);
    expect(readable(html)).toContain(readable(original.sections[1].text.slice(0, 40)));
    expect(html).not.toContain(`id="${feature.id}"`);
    expect(html).not.toContain('Dispatch not found');
  }
});

test('the morning cast row links xz and Chen to their wiki-backed cards after the opening', () => {
  vi.stubGlobal('React', React);
  const index = getNewsIndex();
  const article = index.articles.find(item => item.id === '2026-10-29-morning-arc-3')!;
  const subjects = reportedPeople([article], index.people!);
  expect(subjects.map(person => person.id)).toEqual(expect.arrayContaining(['xz', 'yi-chia-chen']));
  const html = render(NewsArticle, `/news/${article.id}`, index);
  const sidebar = html.match(/<section class="news-story-people"[\s\S]*?<\/section>/)![0];
  for (const subject of subjects) {
    const card = getNewsCollection().cards.find(c => c.personId === subject.id);
    expect(sidebar).toContain(card?.cardUrl ?? `/news/people/${subject.id}`);
  }
  expect(html.indexOf('class="news-story-people"')).toBeGreaterThan(html.indexOf(article.sections[0].text.slice(0, 40)));
  expect(sidebar).not.toContain('/news/people/dries-smit');
  const initialHtml = newsArticleMeta(article, [], index.people).bodyHtml!;
  for (const subject of subjects) expect(initialHtml).toContain(`/news/people/${subject.id}`);
  const chen = subjects.find(subject => subject.id === 'yi-chia-chen')!;
  expect(newsPersonSchema.safeParse(chen).success).toBe(true);
  expect(newsPersonSchema.safeParse({ ...chen, editorialPortrait: { ...chen.editorialPortrait!, sourceUrl: 'https://www.kaggle.com/xiaoz259' } }).success).toBe(false);
});

test('the commissioned four o’clock special is an early evening edition in browser and initial HTML', () => {
  vi.stubGlobal('React', React);
  const index = getNewsIndex();
  const article = { ...index.articles.find(item => item.id === '2026-10-29-morning-arc-3')!, id: '2026-10-29-special-early-evening-xz', edition: 'evening' as const };
  const html = render(NewsArticle, `/news/${article.id}`, { ...index, articles: [article] });
  expect(html).toContain('Early evening edition');
  expect(newsArticleMeta(article).bodyHtml).toContain('Early evening edition');
  expect(html).not.toContain('Launch preview');
});

test('all reported subjects survive deduplication across a feature and recap, without a face cap', () => {
  vi.stubGlobal('React', React);
  const index = getNewsIndex();
  const people = index.people!.slice(0, 8);
  const original = index.articles.find(item => item.id === '2026-10-28-evening-arc-3')!;
  const article = { ...original, personIds: people.map(person => person.id), headline: 'The field', dek: 'A closing report', sections: [{ text: 'The field is moving.', sourceIds: people.map(person => `person-${person.id}-identity-0`) }] };
  const feature = { ...index.dispatches!.find(item => item.id === original.frontPageFeatureId)!, headline: 'The contenders', personIds: [people[0].id], sections: [{ text: 'Their approaches.', sourceIds: [`person-${people[0].id}-identity-0`] }] };
  expect(reportedPeople([feature, article], index.people!).map(person => person.id)).toEqual(people.map(person => person.id));
  const { personIds: _cast, ...unverified } = { ...article, headline: 'Progress by itself' };
  expect(reportedPeople([unverified], index.people!)).toEqual([]);
  expect(reportedPeople([{ ...unverified, personIds: [] }], index.people!)).toEqual([]);
  const html = render(NewsArticle, `/news/${article.id}`, { ...index, articles: [article], dispatches: [feature] });
  const cast = html.match(/<section class="news-story-people"[\s\S]*?<\/section>/)![0];
  for (const person of people) {
    const card = getNewsCollection().cards.find(c => c.personId === person.id);
    expect(cast).toContain(card?.cardUrl ?? `/news/people/${person.id}`);
  }
});

// GPT-6 / Codex, 2026-11-01: previously shared special-report URLs must render directly.
test('every special report opens at its permanent URL with its full text and artwork', () => {
  vi.stubGlobal('React', React);
  const index = getNewsIndex();
  for (const dispatch of index.dispatches ?? []) {
    const html = render(NewsArticle, `/news/${dispatch.id}`, index);
    expect(html).not.toContain('Dispatch not found');
    expect(html).toContain(dispatch.id);
    if (dispatch.image) expect(html).toContain(dispatch.image.src);
    expect(html).toContain('news-dispatch-text');
  }
});

test('includes the sourced cast of the lead team, scoped to its competition', () => {
  const index = getNewsIndex();
  const article = index.articles.find(a => a.id === '2026-11-02-morning-arc-2')!;
  const ids = reportedPeople([article], index.people!).map(p => p.id);
  for (const id of ['dries-smit', 'jeroen-cottaar', 'isaiahp', 'stefano-viel']) expect(ids).toContain(id);
  expect(ids[0]).toBe('dries-smit');
});

test('the Tufa report shows only its six credited authors in both article renders', () => {
  vi.stubGlobal('React', React);
  const path = '/news/tufa-general-approaches';
  const people = ['dries-smit', 'jeroen-cottaar', 'isaiahp', 'stefano-viel', 'dlorah', 'infinitecreativity'];
  const cards = getNewsCollection().cards;
  const expected = people.map(id => cards.find(card => card.personId === id)!.cardUrl);
  const clientHtml = render(NewsArticle, path, getNewsIndex());
  const serverHtml = resolveNewsMeta(path)?.tags.bodyHtml;
  const rows = [
    clientHtml.match(/<section class="news-story-people"[\s\S]*?<\/section>/)?.[0],
    serverHtml?.match(/<aside aria-label="In this story"[\s\S]*?<\/aside>/)?.[0],
  ];
  for (const row of rows) {
    expect(row).toBeDefined();
    expect([...row!.matchAll(/href="(\/news\/cards\/[^"]+)"/g)].map(match => match[1])).toEqual(expected);
  }
});

test('archive cast corrections drop incidental aliases and keep people with real roster evidence', () => {
  const index = getNewsIndex();
  const dispatch = index.dispatches!.find(story => story.id === '2026-11-06-fit-the-whale-in')!;
  expect(reportedPeople([dispatch], index.people!).map(person => person.id))
    .toEqual(['bushi-liu', 'mutian-hong', 'yi-chia-chen']);
  const decline = index.dispatches!.find(story => story.id === '2026-10-30-special-arc-deadline-no-extension')!;
  expect(resolveNewsMeta(`/news/${decline.id}`)?.tags.bodyHtml).not.toContain('aria-label="In this story"');
  const actualProgress = index.articles.find(story => story.id === '2026-11-02-evening-arc-2')!;
  expect(reportedPeople([actualProgress], index.people!).map(person => person.id))
    .toEqual(expect.arrayContaining(['tran-m-tien', 'van-phuc-huynh']));
});

test('each team card is tied to one contest and the old Tufa link lists both contest cards', () => {
  const cards = getNewsCollection().cards.filter(card => card.kind === 'team');
  expect(cards.every(card => card.entries.length === 1)).toBe(true);
  const group = resolveNewsMeta('/news/cards/team-tufa-labs-2026');
  expect(group?.status).toBe(200);
  for (const [contest, teamId, count] of [['arc-2', '16756524', 4], ['arc-3', '15486995', 6]] as const) {
    const card = cards.find(item => item.id === `team-tufa-labs-${contest}-2026`)!;
    expect(group?.tags.bodyHtml).toContain(card.cardUrl);
    expect(card.entries[0].teamId).toBe(teamId);
    expect(card.entries[0].members).toHaveLength(count);
    expect(card.entries[0].members.some(member => member.personId === 'dlorah')).toBe(contest === 'arc-3');
  }
});
