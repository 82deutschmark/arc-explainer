/**
 * Author: GPT-6 / Codex (reasoning effort not exposed); GPT-6 / Codex; Claude Sonnet 5.5 (30-Oct-2026 rewrite for the binder and card-page rebuild)
 * Date: 03-November-2026; 02-November-2026
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
import NewsCards, { Detail, UncardedCast } from '../client/src/pages/NewsCards';
import { getNewsCollection } from '../server/services/news/newsCollection';
import { getNewsIndex } from '../server/services/news/newsStore';
import { uncardedCast } from '../shared/cardCast';

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

it('shows both actual faces together for individual and team cards', () => {
  for (const id of ['person-jean-francois-puget-2026', 'team-turducken-2026']) {
    const { card, html } = renderDetail(id);
    expect(html).toContain(`aria-label="${card.name} card front and back"`);
    expect(html).toContain(`/api/news/cards/${card.id}/thumb.webp?side=front`);
    expect(html).toContain(`/api/news/cards/${card.id}/thumb.webp?side=back`);
    expect(html).toContain(`href="/api/news/cards/${card.id}/image.png?side=back"`);
  }
});

it('keeps Tufa identities and the verified account avatar on their own cards', () => {
  const cards = prepare().cards;
  expect(cards.find(card => card.personId === 'dlorah')?.name).toBe('Harold Bessis');
  for (const id of ['mohamed-osman', 'jerome-sieber']) expect(cards.some(card => card.personId === id)).toBe(true);
  const flamingo = cards.find(card => card.personId === 'infinitecreativity')!;
  expect(flamingo.name).toBe('Michal Tešnar');
  expect(flamingo.art?.src).toBe('/news-images/people/2026-11-02-infinitecreativity-kaggle-avatar.jpg');
  for (const id of ['dries-smit', 'jeroen-cottaar', 'isaiahp', 'stefano-viel', 'dlorah', 'mohamed-osman', 'jerome-sieber']) {
    expect(cards.find(card => card.personId === id)?.art?.src, id).toBeTruthy();
  }
  expect(cards.find(card => card.personId === 'dlorah')?.career?.rows.map(row => row.medal)).toEqual(['silver', 'bronze']);
  expect(cards.find(card => card.personId === 'mohamed-osman')?.career?.rows[0]).toMatchObject({ competition: 'ARC Prize 2025', rank: 3, medal: 'gold' });
});

it('names each of a person’s competition editions in the card shelf', () => {
  const collection = prepare();
  const person = collection.cards.find(card => card.id === 'person-jean-francois-puget-2026')!;
  const other = { ...person, id: 'fixture-second-edition', cardUrl: '/news/cards/fixture-second-edition', setId: 'fixture-set' };
  const sets = [...(collection.sets ?? []), { id: 'fixture-set', name: 'Fixture Competition 2026', season: '2026', competitionIds: [] }];
  const html = renderToStaticMarkup(createElement(Router, { ssrPath: person.cardUrl, children: createElement(Detail, { card: person, all: [person, other], sets }) }));
  expect(html).toContain('Fixture Competition 2026');
  expect(html).toContain('href="/news/cards/fixture-second-edition"');
});

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

it('nobody is a player: competitors and teams are named in Kaggle\'s words, and the set holds only competitors and teams', () => {
  const cards = prepare().cards;
  expect(cards.some(card => card.id === 'person-mike-knoop-2026')).toBe(false); // Current editorial omission.
  expect(cards.some(card => card.id === 'person-francois-chollet-2026')).toBe(false); // Boss, 5 Nov 2026: not a competitor or a team.
  expect(cards.every(card => card.role !== 'sponsor')).toBe(true);
  expect(cards.filter(card => card.kind === 'team').every(card => card.role === 'team')).toBe(true);
  for (const id of ['person-ivan-sorokin-2026', 'team-turducken-2026']) {
    const { card, html: page } = renderDetail(id);
    // The Digest's own story headlines are quoted as they were printed; everything else is ours.
    const html = card.highlights.reduce((text, fact) => text.split(fact.text).join(''), card.stories.reduce((text, story) => text.split(story.headline).join(''), page));
    expect(html).not.toMatch(/\bplayers?\b/i);
    expect(html).not.toMatch(/provisional|observed|checked/i);
  }
});

it('a team page with no fresh roster links readers to the actual Kaggle entry', () => {
  const collection = prepare();
  const original = collection.cards.find(item => item.id === 'team-turducken-2026')!;
  const card = { ...original, entries: original.entries.map(entry => ({ ...entry, status: 'unavailable' as const, rank: null, score: null, members: [] })) };
  const html = renderToStaticMarkup(createElement(Router, { ssrPath: card.cardUrl, children: createElement(Detail, { card, all: collection.cards }) }));
  for (const entry of card.entries) expect(html).toContain(entry.sourceUrl!.replaceAll('&', '&amp;'));
  expect(html).toContain('current standings at Kaggle');
});

it('the Cabinet page is a binder and a checklist with every tier named, starting with the cards', () => {
  const html = renderPage('/news/cards', '/news/cards');
  expect(html).toContain('ARC Prize');
  for (const tier of ['Grandmaster', 'Master', 'Expert']) expect(html).toContain(tier);
  expect(html).not.toContain('Competition sponsor');   // Boss, 5 Nov 2026: the set holds only competitors and teams
  // 30-Oct-2026 (Claude Sonnet 5.5 Medium): the redesigned Cabinet list no longer links the Hall of Fame itself (only each card's page
  // does, under "Everything else"). The link is checked on a card page; whether the list should link it too is for the page's owner.
  expect(renderPage('/news/cards/person-jean-francois-puget-2026', '/news/cards/:cardId')).toContain('href="/hall-of-fame"');
  expect(html).not.toMatch(/\bplayers?\b/i);
  expect(html).toContain('<h1>Kaggle card catalog</h1>');
  expect((html.match(/class="cb-tile /g) ?? []).length).toBe(24);
  expect(html).toContain('Individual card');
  expect(html).toContain('Card pages');
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
  expect(html).toContain('Browse the card catalog');
});

it('finds uncarded people and teams without duplicating issued identities', () => {
  const collection = prepare();
  const index = getNewsIndex();
  const person = (index.people ?? []).find(item => !collection.cards.some(card => card.personId === item.id))!;
  expect(person).toBeTruthy();
  const renderCast = (needle: string, role: 'all' | 'competitor' | 'team' = 'all') => renderToStaticMarkup(createElement(Router, { ssrPath: '/news/cards', children: createElement(UncardedCast, { index, cards: collection.cards, needle, role, contest: 'all', season: 'all', filtered: false }) }));
  expect(renderCast(person.name.toLocaleLowerCase())).toContain(`/news/people/${person.id}`);
  const carded = collection.cards.find(card => card.personId)!;
  expect(renderCast(carded.name.toLocaleLowerCase())).not.toContain(`/news/people/${carded.personId}`);
  const team = uncardedCast(index, collection.cards).teams[0];
  expect(team).toBeTruthy();
  expect(renderCast(team.teamId, 'team')).toContain(`/news/competitors/${team.id}`);
});

it('puts linked source facts on the card without changing its issued address', () => {
  const { card, html } = renderDetail('person-ivan-sorokin-2026');
  expect(card.highlights.length).toBeGreaterThan(0);
  expect(html).toContain('On the record');
  expect(html).toContain(card.highlights[0].sourceUrl.replaceAll('&', '&amp;'));
  expect(html).toContain('href="/news/cards"');
});

it('folds only verified solo entries into their person', () => {
  const index = getNewsIndex();
  const collection = prepare();
  const entries = uncardedCast(index, collection.cards).teams;
  const solo = index.competitors.find(team => team.members.length === 1 && (index.people ?? []).some(person => person.accounts.some(account => account.platform === 'kaggle' && account.handle.toLowerCase() === team.members[0].toLowerCase()) && person.memberships.some(member => member.competition === team.competition && member.teamId === team.teamId && member.memberHandle.toLowerCase() === team.members[0].toLowerCase())));
  expect(solo).toBeTruthy();
  expect(entries.some(team => team.id === solo!.id)).toBe(false);
});
