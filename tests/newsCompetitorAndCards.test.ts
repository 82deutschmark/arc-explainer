/**
 * Author: Claude Opus 5.5
 * Date: 14-Nov-2026
 * PURPOSE: Render coverage for pieces of The Loose Goose that had none: a competitor profile for a
 *          real committed team with three or more verified members (byline and roster cards), the
 *          CardPair front/back viewer for a real collection card, and the font route serving every
 *          font that news.css loads (the newsFonts.ts allowlist must cover each one).
 * SRP/DRY check: Pass — production pages, components, routes and committed news archive; the query
 *              cache is seeded with the same production data the API serves.
 */
import React, { createElement } from 'react';
import fs from 'node:fs';
import { once } from 'node:events';
import express from 'express';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { Route, Router } from 'wouter';
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import NewsCompetitor from '../client/src/pages/NewsCompetitor';
import { CardPair, cardFaceThumb } from '../client/src/components/news/CardPair';
import { getNewsIndex } from '../server/services/news/newsStore';
import { getNewsCollection } from '../server/services/news/newsCollection';
import { mountNews } from '../server/routes/news';
import { peopleForTeam } from '../shared/news';
import { escapeHtml } from '../shared/seo';

afterEach(() => vi.unstubAllGlobals());

/** Seeded data only: any query left unseeded stays pending, as a slow network would. */
function renderCompetitorPage(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, queryFn: () => new Promise(() => {}) } } });
  client.setQueryData(['/api/news'], getNewsIndex());
  client.setQueryData(['/api/news/cards'], getNewsCollection());
  return renderToStaticMarkup(createElement(QueryClientProvider, { client },
    createElement(HelmetProvider, {}, createElement(Router, { ssrPath: path, children: createElement(Route, { path: '/news/competitors/:competitorId', component: NewsCompetitor }) }))));
}

it('a competitor profile for a team of three or more names every verified member once and shows each roster card', () => {
  vi.stubGlobal('React', React);
  const index = getNewsIndex();
  const people = index.people ?? [];
  const team = index.competitors.find(record => record.members.length >= 3 && peopleForTeam(people, record).length >= 3);
  expect(team, 'the committed archive has a team with three or more verified members').toBeDefined();
  const names = peopleForTeam(people, team!).map(person => person.name);
  const html = renderCompetitorPage(`/news/competitors/${team!.id}`);
  expect(html).toContain(`<h1>${escapeHtml(team!.name)}</h1>`);
  const byline = html.match(/<p class="cp-byline">([^<]*)<\/p>/)?.[1];
  expect(byline).toBeDefined();
  for (const name of names) expect(byline!.split(escapeHtml(name)).length - 1, name).toBe(1);
  // A list of three or more reads "A, B, and C", never "A and B and C".
  expect(byline!.match(/ and /g) ?? []).toHaveLength(1);
  const roster = html.match(/<ul class="cp-roster"[\s\S]*?<\/ul>/)?.[0];
  expect(roster).toBeDefined();
  expect(roster!.match(/<li>/g)).toHaveLength(team!.members.length);
  for (const name of names) expect(roster).toContain(escapeHtml(name));
});

it('CardPair shows both faces of a real card with keyboard-reachable enlarge controls and no open dialog', () => {
  vi.stubGlobal('React', React);
  const card = getNewsCollection().cards.find(item => item.kind === 'person' && item.art);
  expect(card).toBeDefined();
  const html = renderToStaticMarkup(createElement(CardPair, { card: card! }));
  expect(html).toContain(`aria-label="${escapeHtml(card!.name)} card front and back"`);
  for (const face of ['front', 'back'] as const) {
    expect(html).toContain(`src="${escapeHtml(cardFaceThumb(card!, face, 560))}"`);
    expect(html).toContain(`alt="${escapeHtml(`${card!.name}, card ${face}`)}"`);
    expect(html).toContain(`<button type="button" aria-label="${escapeHtml(`Enlarge ${face} of ${card!.name}’s card`)}"`);
  }
  expect(html.match(/<figure>/g)).toHaveLength(2);
  // The enlarged view is a dialog that opens only on demand.
  expect(html).not.toContain('card-pair-dialog');
  expect(html).not.toContain('/image.png');
});

const fontApp = express(); mountNews(fontApp);
const fontServer = fontApp.listen(0, '127.0.0.1');
beforeAll(async () => { if (!fontServer.listening) await once(fontServer, 'listening'); });
afterAll(() => new Promise<void>((resolve, reject) => fontServer.close(error => error ? reject(error) : resolve())));

it('every font that news.css loads is served by the font route, and unlisted files are refused', async () => {
  const css = fs.readFileSync('client/src/components/news/news.css', 'utf8');
  const fonts = [...new Set([...css.matchAll(/url\(['"]?(\/api\/news\/fonts\/[^'")]+)['"]?\)/g)].map(match => match[1]))];
  expect(fonts.length).toBeGreaterThan(0);
  const address = fontServer.address();
  if (!address || typeof address === 'string') throw Error('Missing font test server');
  const base = `http://127.0.0.1:${address.port}`;
  for (const font of fonts) {
    const response = await fetch(`${base}${font}`);
    expect(response.status, font).toBe(200);
    expect((await response.arrayBuffer()).byteLength, font).toBeGreaterThan(1000);
  }
  expect((await fetch(`${base}/api/news/fonts/not-a-font.ttf`)).status).toBe(404);
});
