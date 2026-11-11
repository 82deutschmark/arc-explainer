/**
 * Author: GPT-6.1 Sol
 * Date: 11-November-2026
 * PURPOSE: Exercise draft retirement over HTTP before a simulated stale overlay/SPA, including
 * encoded URLs, HEAD, retired comment excerpts and unrelated evidence/assets.
 * SRP/DRY check: Pass — integration at the middleware boundary using the real manifest.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import retiredFiles from '../../server/data/retiredArcDrafts.json';
import { retiredArcDrafts } from '../../server/middleware/retiredArcDrafts';

let server: Server;
let origin: string;
beforeAll(async () => {
  const app = express();
  app.use(retiredArcDrafts);
  app.use((_req, res) => res.send('stale overlay or live asset'));
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));

describe('retired ARC drafts', () => {
  it('returns Gone for every removed page/source rather than stale content', async () => {
    for (const file of retiredFiles) {
      const response = await fetch(`${origin}/specials/${file}?cached=1`);
      expect(response.status, file).toBe(410);
      expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
      expect(await response.text()).not.toContain('stale overlay');
    }
  });
  it('handles HEAD, encoded names and trailing slash without leaking content', async () => {
    for (const url of ['/specials/%61rc-drafts.html', '/specials/arc-drafts.html/', '/SPECIALS/ARC-DRAFTS.HTML']) {
      const response = await fetch(origin + url, { method: 'HEAD' });
      expect(response.status).toBe(410);
      expect(await response.text()).toBe('');
    }
  });
  it('retires the old review API and writes without disrupting another document', async () => {
    for (const suffix of ['', '/threads', '/threads/example/replies']) {
      expect((await fetch(`${origin}/api/review-comments/turducken-2026-11-06${suffix}`, {method: 'POST'})).status).toBe(410);
    }
    expect((await fetch(`${origin}/api/review-comments/another-document`)).status).toBe(200);
  });
  it('preserves evidence, charts, games and unrelated specials', async () => {
    for (const url of ['/specials/arc-paper-evidence.html', '/specials/arc-paper-sk48-trace-note.html', '/specials/arc3-solution-draft/charts/turn-sk48.mp4', '/specials/2026-11-02-the-duck-that-launched-a-thousand-ships.html', '/arc3']) {
      expect((await fetch(origin + url)).status, url).toBe(200);
    }
  });
});
