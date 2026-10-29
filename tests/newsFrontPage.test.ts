/**
 * Author: GPT-6.1 Sol / Codex; Claude Opus 5.5
 * Date: 2026-10-29
 * PURPOSE: Verify the full reserved feature and cover on edition permalinks, and render
 *          the rebuilt ARC Daily Digest front page and wire page with the committed news
 *          archive and a populated market digest, so every live section (ticker, board, movers,
 *          past winners, What's News, notebook columns) runs against real-shaped data; and render
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
import { newsArticleMeta } from '../server/services/news/newsPresentation';
import fs from 'node:fs';
import { getNewsIndex } from '../server/services/news/newsStore';
import { buildMarketBoard, type MarketsPayload } from '../shared/newsMarkets';
import { recentDiscussions, type NewsIndex, type NewsWireStory } from '../shared/news';
import { reportedPeople, featuredPerson, displayPortrait } from '../shared/news';
import { newsPersonSchema } from '../server/services/news/newsStore';
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
    createElement(HelmetProvider, {}, createElement(Router, { ssrPath: path, children: page === NewsArticle ? createElement(Route, { path: "/news/:articleId", component: page }) : createElement(page) }))));
}

afterEach(() => vi.unstubAllGlobals());

test('the front page runs every live section against a populated digest', () => {
  vi.stubGlobal('React', React);
  const index = getNewsIndex();
  const html = render(News, '/news', index, markets(index));
  for (const text of ['What’s news', 'The board', 'Market movers', 'Where the past winners stand', 'Inside', 'The competitor notebook', 'Every edition',
    'Gold line · 5 places', 'Into gold:', 'Leader · <span class="news-ticker-name">Yi-Chia Chen</span>', 'NEW', 'ARC Prize 2025 champion · NVARC'])
    expect(html).toContain(text);
  // A newer afternoon dispatch can lead; a reserved feature gets the full treatment for its edition.
  const newest = [...index.articles, ...(index.dispatches ?? [])].filter(story => story.competition === 'arc-3')
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
  expect(html).toContain(index.articles[0].headline.replace(/&/g, '&amp;').replace(/'/g, '&#x27;').slice(0, 30));
  for (const text of ['news-ticker', 'Market movers', 'Where the past winners stand', 'The board<']) expect(html).not.toContain(text);
});

test('Kaggle threads follow the prominent X strip and the wire, with original links', () => {
  vi.stubGlobal('React', React);
  const index = getNewsIndex();
  const html = render(News, '/news', index, markets(index));
  expect(html.indexOf('aria-label="From X"')).toBeLessThan(html.indexOf('aria-label="From the Kaggle boards"'));
  expect(html.indexOf('What’s news')).toBeLessThan(html.indexOf('aria-label="From the Kaggle boards"'));
  // The front-page column is capped at the three most recent threads; the community page carries the rest.
  for (const thread of recentDiscussions(index.discussions!).slice(0, 3)) expect(html).toContain(`href="${thread.url}"`);
  expect(html).toContain('/news/community#tweet-archive');
});

test('community archive retains collected posts omitted from the curated strip', () => {
  vi.stubGlobal('React', React);
  const index = getNewsIndex();
  const html = render(NewsCommunity, '/news/community', index);
  expect(index.socialArchive!.length).toBeGreaterThan(index.social!.length);
  for (const post of index.socialArchive!) expect(html).toContain(`id="post-${post.id}"`);
  expect(html).toContain('Search collected tweets');
  expect(html).toContain('Filter tweets by competition');
  expect(html).toContain('id="kaggle-boards"');
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
  expect(html).toContain(article.sections[1].text.slice(0, 40));
  expect(html.indexOf(feature.sections.at(-1)!.text.slice(0, 40)))
    .toBeLessThan(html.indexOf(article.sections[1].text.slice(0, 40)));
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
    expect(html).toContain(original.sections[1].text.slice(0, 40));
    expect(html).not.toContain(`id="${feature.id}"`);
    expect(html).not.toContain('Dispatch not found');
  }
});

test('the morning sidebar includes xz and Chen with the correct sourced portraits', () => {
  vi.stubGlobal('React', React);
  const index = getNewsIndex();
  const article = index.articles.find(item => item.id === '2026-10-29-morning-arc-3')!;
  expect(featuredPerson(article, index.people!)?.id).toBe('xz');
  const subjects = reportedPeople([article], index.people!);
  expect(subjects.map(person => person.id)).toEqual(['xz', 'yi-chia-chen']);
  const html = render(NewsArticle, `/news/${article.id}`, index);
  const sidebar = html.match(/<section class="news-story-people"[\s\S]*?<\/section>/)![0];
  expect(sidebar).toContain('/news-images/people/xz.webp');
  expect(sidebar).toContain('/news-images/people/yi-chia-chen-editorial-v1.webp');
  expect(sidebar).toContain('AI editorial portrait');
  expect(sidebar).not.toContain('/news/people/dries-smit');
  const initialHtml = newsArticleMeta(article, [], index.people).bodyHtml!;
  for (const subject of subjects) expect(initialHtml).toContain(`/news/people/${subject.id}`);
  const chen = subjects[1];
  expect(newsPersonSchema.safeParse(chen).success).toBe(true);
  expect(newsPersonSchema.safeParse({ ...chen, editorialPortrait: { ...chen.editorialPortrait!, sourceUrl: 'https://www.kaggle.com/xiaoz259' } }).success).toBe(false);
});

test('all reported subjects survive deduplication across a feature and recap, without a face cap', () => {
  vi.stubGlobal('React', React);
  const index = getNewsIndex();
  const people = index.people!.slice(0, 8);
  const original = index.articles.find(item => item.id === '2026-10-28-evening-arc-3')!;
  const article = { ...original, headline: 'The field', dek: 'A closing report', sections: [{ text: 'The field is moving.', sourceIds: people.map(person => `person-${person.id}-identity-0`) }] };
  const feature = { ...index.dispatches!.find(item => item.id === original.frontPageFeatureId)!, headline: 'The contenders', sections: [{ text: 'Their approaches.', sourceIds: [`person-${people[0].id}-identity-0`] }] };
  expect(reportedPeople([feature, article], index.people!).map(person => person.id)).toEqual(people.map(person => person.id));
  expect(reportedPeople([{ headline: 'axzonal results', sections: [] }], index.people!)).toEqual([]);
  const html = render(NewsArticle, `/news/${article.id}`, { ...index, articles: [article], dispatches: [feature] });
  const sidebar = html.match(/<aside class="news-sidebar"[\s\S]*?<\/aside>/)![0];
  for (const person of people) expect(sidebar).toContain(`href="/news/people/${person.id}" class="news-subject-card"`);
});
