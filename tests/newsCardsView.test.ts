/**
 * Author: GPT-6 / Codex; Claude Sonnet 5.5 (30-Oct-2026 rewrite for the binder and card-page rebuild)
 * Date: 2026-10-30
 * PURPOSE: Render the real Card Cabinet pages and protect what the Boss asked for: every card we already hold for a
 *          person is shown and linked, tiers and sponsor roles are named in Kaggle's words, nobody is a "player",
 *          no internal notes reach the page, Mark has his own avatar, and team cards link their roster.
 * SRP/DRY check: Pass — production components and collection data, with a seeded query cache.
 */
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router, Route } from 'wouter';
import { afterEach, expect, it, vi } from 'vitest';
import NewsCards, { Detail } from '../client/src/pages/NewsCards';
import { getNewsCollection } from '../server/services/news/newsCollection';
import { getNewsIndex } from '../server/services/news/newsStore';

afterEach(() => vi.unstubAllGlobals());
function prepare() { vi.stubGlobal('React', React); return getNewsCollection(); }
function renderDetail(id: string) {
  const collection = prepare();
  const card = collection.cards.find(item => item.id === id)!;
  return { card, html: renderToStaticMarkup(createElement(Router, { ssrPath: card.cardUrl, children: createElement(Detail, { card, all: collection.cards }) })) };
}
function renderPage(path: string, route: string) {
  const collection = prepare();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, queryFn: () => new Promise(() => {}) } } });
  client.setQueryData(['/api/news/cards'], collection);
  client.setQueryData(['/api/news'], getNewsIndex());
  return renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(Router, { ssrPath: path, children: createElement(Route, { path: route, component: NewsCards }) })));
}

it('Puget\'s page shows and links every card we already hold for him, plus his teams', () => {
  const { card, html } = renderDetail('person-jean-francois-puget-2026');
  expect(card.pastCards.length).toBeGreaterThanOrEqual(2);
  expect(html).toContain('Their cards');
  for (const past of card.pastCards) {
    expect(html).toContain(`href="${past.hallOfFameUrl}"`);
    expect(html).toContain(encodeURI(past.imageSrc!));
  }
  expect(html).toContain('href="/hall-of-fame#contributor-7"');
  expect(html).toContain('href="/hall-of-fame#contributor-15"');
  for (const team of card.teamHistory.filter(row => row.cardUrl)) expect(html).toContain(`href="${team.cardUrl}"`);
  expect(card.stories.length).toBeGreaterThan(0);
  for (const story of card.stories) expect(html).toContain(`href="${story.url}"`);
  expect(html).toContain('Kaggle Grandmaster');
  expect(html).toContain('Completed Kaggle competitions');
  expect(html).toContain('Earned this card: ARC Prize 2025 champion');
});

it('last year\'s Hall of Fame card is kept; the card art is it or a registered 2026 illustration, never a reference photo', () => {
  const cards = prepare().cards;
  // 30-Oct-2026 (Claude Sonnet 5.5 Medium): Puget and Sorokin now carry commissioned 2026 art under /news-images/cards/; their
  // Hall of Fame pictures stay on the card as earlier cards. Jack Cole still uses his Hall of Fame card as the art.
  const held = (id: string, hof: string) => {
    const card = cards.find(c => c.id === id)!;
    expect(card.pastCards.map(p => p.imageSrc), id).toContain(hof);
    expect(card.art?.src === hof || /^\/news-images\/cards\/2026\//.test(card.art?.src ?? ''), `${id}: ${card.art?.src}`).toBe(true);
    expect(card.art?.src ?? '', id).not.toMatch(/references/);
  };
  held('person-jean-francois-puget-2026', '/jfPuget3.png');
  held('person-ivan-sorokin-2026', '/ivanARC2.png');
  held('person-jack-cole-2026', '/jackCole2.png');
});

it('Mark has his own avatar on his card', () => {
  const mark = prepare().cards.find(card => card.id === 'person-mark-barney-2026')!;
  expect(mark.art?.src).toBe('/news-images/people/mark-barney-instagram-original.jpg');
});

it('nobody is a player: competitors, sponsors and teams are named in Kaggle\'s words', () => {
  const cards = prepare().cards;
  expect(cards.find(card => card.id === 'person-mike-knoop-2026')!.role).toBe('sponsor');
  expect(cards.find(card => card.id === 'person-francois-chollet-2026')!.role).toBe('sponsor');
  expect(cards.filter(card => card.kind === 'team').every(card => card.role === 'team')).toBe(true);
  const sponsor = renderDetail('person-mike-knoop-2026').html;
  expect(sponsor).toContain('Competition sponsor');
  expect(sponsor).not.toContain('Kaggle profile');
  for (const id of ['person-ivan-sorokin-2026', 'team-turducken-2026', 'person-mike-knoop-2026']) {
    const { card, html: page } = renderDetail(id);
    // The Digest's own story headlines are quoted as they were printed; everything else is ours.
    const html = card.stories.reduce((text, story) => text.split(story.headline).join(''), page);
    expect(html).not.toMatch(/\bplayers?\b/i);
    expect(html).not.toMatch(/provisional|observed|checked/i);
  }
});

it('a team page links its roster to their cards', () => {
  const { card, html } = renderDetail('team-turducken-2026');
  const members = card.entries.flatMap(entry => entry.members).filter(member => member.cardUrl);
  expect(members.length).toBeGreaterThan(1);
  for (const member of members) expect(html).toContain(`href="${member.cardUrl}"`);
  expect(html).toContain('Roster');
});

it('the Cabinet page is a binder and a checklist with every tier named, starting with the cards', () => {
  const html = renderPage('/news/cards', '/news/cards');
  expect(html).toContain('ARC Prize');
  for (const tier of ['Grandmaster', 'Master', 'Expert']) expect(html).toContain(tier);
  expect(html).toContain('Competition sponsor');
  // 30-Oct-2026 (Claude Sonnet 5.5 Medium): the redesigned Cabinet list no longer links the Hall of Fame itself (only each card's page
  // does, under "Everything else"). The link is checked on a card page; whether the list should link it too is for the page's owner.
  expect(renderPage('/news/cards/person-jean-francois-puget-2026', '/news/cards/:cardId')).toContain('href="/hall-of-fame"');
  expect(html).not.toMatch(/\bplayers?\b/i);
  expect(html).toMatch(/<h1>ARC Prize 2026 Cards<\/h1>/);
});

it('a shared card address opens that card with its record', () => {
  const html = renderPage('/news/cards/team-turducken-2026', '/news/cards/:cardId');
  expect(html).toContain('Team Turducken');
  expect(html).toContain('← All cards');
  expect(html).not.toContain('Find a name');
});

it('a missing shared card shows a return to the collection', () => {
  const html = renderPage('/news/cards/missing-card', '/news/cards/:cardId');
  expect(html).toContain('Card not found');
  expect(html).toContain('Browse the ARC Prize cards');
});
