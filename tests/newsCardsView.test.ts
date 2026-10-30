/**
 * Author: GPT-6 / Codex
 * Date: 2026-10-29
 * PURPOSE: Render real player/team cards and permanent pages to protect roster navigation,
 *          simultaneous teams, complete sourced career records, reverse downloads and missing-card handling.
 * SRP/DRY check: Pass — production components and collection data, with a seeded query cache.
 */
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router, Route } from 'wouter';
import { afterEach, expect, it, vi } from 'vitest';
import NewsCards, { CabinetCard, CardRecord } from '../client/src/pages/NewsCards';
import { getNewsCollection } from '../server/services/news/newsCollection';
import { getNewsIndex } from '../server/services/news/newsStore';

afterEach(() => vi.unstubAllGlobals());
function prepare() { vi.stubGlobal('React', React); return getNewsCollection(); }
function renderCard(element: React.ReactNode) {
  return renderToStaticMarkup(createElement(Router, { ssrPath: '/news/cards', children: element }));
}
function renderPage(path: string) {
  const collection = prepare();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, queryFn: () => new Promise(() => {}) } } });
  client.setQueryData(['/api/news/cards'], collection);
  client.setQueryData(['/api/news'], getNewsIndex());
  return renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(Router, {
    ssrPath: path, children: createElement(Route, { path: '/news/cards/:cardId', component: NewsCards }),
  })));
}

it('puts both of Mark’s teams on his player card and offers a permanent share link', () => {
  const card = prepare().cards.find(card => card.personId === 'mark-barney')!;
  const html = renderCard(createElement(CabinetCard, { card, contest: 'all' }));
  expect(html).toContain('href="/news/cards/team-turducken-2026"');
  expect(html).toContain('href="/news/cards/team-arc-mutants-2026"');
  expect(html).toContain(`href="${card.cardUrl}"`);
  expect(html).toContain('Copy Mark Barney card link');
  expect(html).toContain('Current team');
  expect(html).toContain('Save back PNG');
  expect(html).toContain(`/api/news/cards/${card.id}/image.png?side=back`);
});

it('Mark’s back leads with his sourced Kaggle results and includes both ARC teams', () => {
  const card = prepare().cards.find(card => card.personId === 'mark-barney')!;
  const html = renderCard(createElement(CardRecord, { card, entries: card.entries }));
  for (const text of ['RSNA Knee Abnormality Detection', 'bronze medal', '412th of 6,299', 'Kaggriculture', '1,608th of 10,148', '280th of 3,575', 'ARC Mutants', 'Team Turducken']) expect(html).toContain(text);
  expect(html).toContain('https://www.kaggle.com/markbarney/competitions');
});

it('Son has his own portrait card with sourced silver and bronze results and both teams', () => {
  const card = prepare().cards.find(card => card.personId === 'son-pham')!;
  const front = renderCard(createElement(CabinetCard, { card, contest: 'all' }));
  expect(front).toContain('son-pham-kaggle-original.jpeg');
  expect(front).toContain('href="/news/cards/team-turducken-2026"');
  expect(front).toContain('href="/news/cards/team-arc-mutants-2026"');
  const back = renderCard(createElement(CardRecord, { card, entries: card.entries }));
  for (const text of ['Competitions Expert', 'Orbit Wars', 'silver medal', '119th of 4,729', 'RSNA Knee Abnormality Detection', '412th of 6,299', 'with Mark Barney']) expect(back).toContain(text);
  expect(back).toContain('Previous teams');
  expect(back).toContain('https://www.kaggle.com/sonphamorg/competitions');
});

it('team cards link every known roster member to their player card', () => {
  const collection = prepare();
  const team = collection.cards.find(card => card.id === 'team-turducken-2026')!;
  const html = renderCard(createElement(CabinetCard, { card: team, contest: 'all' }));
  expect(html).toContain('The players');
  const members = team.entries.flatMap(entry => entry.members).filter(member => member.cardUrl);
  expect(members.length).toBeGreaterThan(1);
  for (const member of members) expect(html).toContain(`href="${member.cardUrl}"`);
});

it('the player record shows previous teams and the full sourced career, without a teammate roster', () => {
  const player = prepare().cards.find(card => card.personId === 'jan-disselhoff')!;
  const html = renderCard(createElement(CardRecord, { card: player, entries: player.entries }));
  expect(html).toContain('Current teams');
  expect(html).toContain('Previous teams');
  expect(html).toContain('Kaggle &amp; competition history');
  for (const fact of player.highlights) expect(html).toContain(fact.sourceUrl.replaceAll('&', '&amp;'));
  expect(html).not.toContain('class="news-cabinet-roster"');
});

it('a shared team page opens that card and its complete linked record', () => {
  const html = renderPage('/news/cards/team-turducken-2026');
  expect(html).toContain('id="news-card-title"');
  expect(html).toContain('Team record');
  expect(html).toContain('href="/news/cards/person-mark-barney-2026"');
  expect(html).toContain('← All player &amp; team cards');
  expect(html).not.toContain('Find a card');
});

it('a missing shared card shows a return to the collection', () => {
  const html = renderPage('/news/cards/missing-card');
  expect(html).toContain('Card not found');
  expect(html).toContain('Browse the Card Cabinet');
});
