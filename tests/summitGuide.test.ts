/**
 * Author: GPT-6 / Codex
 * Date: 2026-10-22
 * PURPOSE: Check the private guide's real HTTP access boundary, publication validation,
 *          indexing policy and user-facing discovery filters. Test identities are local.
 * SRP/DRY check: Pass - exercises the shared validator and real authentication middleware.
 */
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { startTeamSession } from '../server/middleware/teamSession';
import router from '../server/routes/teamGuide';
import { teamGuideRepository } from '../server/repositories/TeamGuideRepository';
import { summitGuideSchema, selectSummitPeople, type SummitGuide, type SummitSelection } from '../shared/summitGuide';
import { ROUTE_META_TAGS } from '../shared/routes';
import { clientRouteMeta, isDynamicAppRoute } from '../shared/seo';
import { sitemapUrls } from '../server/services/seo/pageContent';

const guide: SummitGuide = {
  version: 1, updatedAt: '2026-10-22T20:00:00Z', title: 'Test guide', intro: 'A local fixture.',
  event: { date: 'October 23', time: 'Afternoon', location: 'Cambridge', url: 'https://example.test/event' },
  people: [{ id: 'person-a', name: 'René Example', role: 'Memory researcher', work: 'Searchable history.', topics: ['Memory'], audience: ['mark'], connection: { mark: 'Human play notes.', son: 'History retrieval.' }, question: 'What surprised you?', followUp: 'Ask for an example.', sources: [{ label: 'Paper', url: 'https://example.test/paper' }], familiar: false, attendance: 'registered', mlst: { kind: 'theme', note: 'A topic, not an appearance.' } }],
  mlst: { intro: 'Context.', sources: [{ label: 'Publisher', url: 'https://example.test/show' }], themes: [{ title: 'Memory', explanation: 'History.', people: ['person-a'] }] },
  ourWork: { introduction: 'Hello.', points: [{ title: 'Work', explanation: 'Evidence.' }], terms: [], sources: [] },
};
const selection: SummitSelection = { search: '', audience: 'all', topic: '', view: 'new', saved: [], met: [] };
let server: Server;
let origin: string;
beforeEach(async () => {
  vi.stubEnv('GOOGLE_CLIENT_ID', 'local-test'); vi.stubEnv('GOOGLE_CLIENT_SECRET', 'local-test');
  vi.stubEnv('TEAM_SESSION_SECRET', 'test-only-signed-session-key-123456789');
  vi.stubEnv('TEAM_EMAILS', 'reader@example.test'); vi.stubEnv('ARC3_COMMUNITY_ADMIN_TOKEN', 'test-only-publisher-token');
  const app = express();
  // Issue the same signed cookie as Google sign-in, without contacting an external service.
  app.get('/test-session', (req, res) => { startTeamSession(req, res, { email: 'reader@example.test', name: 'Test reader' }); res.end(); });
  app.use('/api/team', router);
  server = await new Promise<Server>(resolve => { const listening = app.listen(0, '127.0.0.1', () => resolve(listening)); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test address');
  origin = 'http://127.0.0.1:' + address.port;
});
afterEach(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); vi.restoreAllMocks(); vi.unstubAllEnvs(); });

test('an anonymous reader cannot retrieve or touch the private document', async () => {
  const read = vi.spyOn(teamGuideRepository, 'get');
  const response = await fetch(origin + '/api/team/summit-2026');
  expect(response.status).toBe(401); expect(read).not.toHaveBeenCalled();
  expect(await response.text()).not.toContain('René');
});
test('a signed-in team reader gets the document with private no-store and noindex headers', async () => {
  vi.spyOn(teamGuideRepository, 'get').mockResolvedValue(JSON.stringify(guide));
  const session = await fetch(origin + '/test-session');
  const cookie = session.headers.get('set-cookie')!.split(';')[0];
  const response = await fetch(origin + '/api/team/summit-2026', { headers: { Cookie: cookie } });
  expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(response.headers.get('x-robots-tag')).toContain('noindex');
  expect((await response.json()).data.people[0].name).toBe('René Example');
});
test('publication refuses an unsigned request before writing', async () => {
  const put = vi.spyOn(teamGuideRepository, 'put');
  const response = await fetch(origin + '/api/team/machine/summit-2026', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(guide) });
  expect(response.status).toBe(401); expect(put).not.toHaveBeenCalled();
});
test('publication validates the document and does not claim a database failure succeeded', async () => {
  const put = vi.spyOn(teamGuideRepository, 'put').mockResolvedValue(false);
  const headers = { 'Content-Type': 'application/json', 'X-ARC3-Admin-Token': 'test-only-publisher-token' };
  const invalid = await fetch(origin + '/api/team/machine/summit-2026', { method: 'PUT', headers, body: JSON.stringify({ ...guide, people: [guide.people[0], guide.people[0]] }) });
  expect(invalid.status).toBe(400); expect(put).not.toHaveBeenCalled();
  const unavailable = await fetch(origin + '/api/team/machine/summit-2026', { method: 'PUT', headers, body: JSON.stringify(guide) });
  expect(unavailable.status).toBe(503);
  put.mockResolvedValue(true);
  vi.spyOn(teamGuideRepository, 'ensureShareKey').mockResolvedValue('a'.repeat(43));
  const success = await fetch(origin + '/api/team/machine/summit-2026', { method: 'PUT', headers, body: JSON.stringify(guide) });
  expect(success.status).toBe(200); expect((await success.json()).data).toEqual({ published: true, people: 1, sharePath: '/summit/' + 'a'.repeat(43) });
});
test('source links and cross references must be valid', () => {
  expect(summitGuideSchema.safeParse(guide).success).toBe(true);
  expect(summitGuideSchema.safeParse({ ...guide, people: [{ ...guide.people[0], sources: [{ label: 'Bad', url: 'javascript:alert(1)' }] }] }).success).toBe(false);
  expect(summitGuideSchema.safeParse({ ...guide, mlst: { ...guide.mlst, themes: [{ ...guide.mlst.themes[0], people: ['absent'] }] } }).success).toBe(false);
});
test('search handles accents and multiple terms while respecting the audience and interest', () => {
  expect(selectSummitPeople(guide.people, { ...selection, search: 'rene memory' })).toHaveLength(1);
  expect(selectSummitPeople(guide.people, { ...selection, audience: 'son' })).toHaveLength(0);
  expect(selectSummitPeople(guide.people, { ...selection, topic: 'Planning' })).toHaveLength(0);
});
test('familiar people stay out of new connections and thematic overlap is not an appearance', () => {
  const familiar = [{ ...guide.people[0], familiar: true }];
  expect(selectSummitPeople(familiar, selection)).toHaveLength(0);
  expect(selectSummitPeople(familiar, { ...selection, view: 'all' })).toHaveLength(1);
  expect(selectSummitPeople(guide.people, { ...selection, view: 'mlst' })).toHaveLength(0);
  expect(selectSummitPeople(guide.people, { ...selection, view: 'saved', saved: ['person-a'] })).toHaveLength(1);
});
test('the private route is noindex and absent from the public sitemap', () => {
  expect(ROUTE_META_TAGS['/team/summit-2026'].noindex).toBe(true);
  expect(sitemapUrls()).not.toContain('https://arc.markbarney.net/team/summit-2026');
});

test('a complete share link works without a cookie and does not cache the guide', async () => {
  const shareKey = 'a'.repeat(43);
  vi.spyOn(teamGuideRepository, 'get').mockImplementation(async key => key.endsWith('-share-key') ? shareKey : JSON.stringify(guide));
  const response = await fetch(origin + '/api/team/shared/summit-2026/' + shareKey);
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(response.headers.get('x-robots-tag')).toContain('noindex');
  expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  expect((await response.json()).data.people[0].name).toBe('René Example');
  expect(isDynamicAppRoute('/summit/' + shareKey)).toBe(true);
  expect(clientRouteMeta('/summit/' + shareKey).noindex).toBe(true);
  expect(sitemapUrls().some(url => url.includes('/summit/'))).toBe(false);
});
test('missing, malformed and incorrect share keys do not reveal the document', async () => {
  const read = vi.spyOn(teamGuideRepository, 'get').mockResolvedValue('a'.repeat(43));
  for (const key of ['short', 'b'.repeat(43)]) {
    const response = await fetch(origin + '/api/team/shared/summit-2026/' + key);
    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain('René');
  }
  expect(read.mock.calls.every(([key]) => key === 'summit-2026-share-key')).toBe(true);
  read.mockResolvedValue(null);
  expect((await fetch(origin + '/api/team/shared/summit-2026/' + 'a'.repeat(43))).status).toBe(404);
});
