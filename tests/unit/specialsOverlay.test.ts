/**
 * Author: Claude Opus 5.5 Low
 * Date: 07-November-2026
 * PURPOSE: Path-safety and round-trip tests for fast special-page publishing
 *          (services/specialsOverlay.ts, routes/specialsPublish.ts, middleware/specialsOverlay.ts).
 *          Proves traversal tricks are refused, nested article paths are accepted, the write route
 *          is token-guarded, and a pushed file is served byte for byte ahead of the baked copy.
 * SRP/DRY check: Pass - tests only; drives the real router and middleware on a throwaway port.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import http, { type Server } from 'node:http';
import { resolveSpecialPath, overlayDir } from '../../server/services/specialsOverlay';

const ROOT = '/srv/overlay';

describe('resolveSpecialPath', () => {
  it('accepts a top-level page and a nested article asset', () => {
    expect(resolveSpecialPath(ROOT, '2026-11-06-arc3-solution-draft.html')).toBe(
      path.join(ROOT, '2026-11-06-arc3-solution-draft.html'),
    );
    expect(resolveSpecialPath(ROOT, 'arc3-solution-draft/charts/original/delta2.png')).toBe(
      path.join(ROOT, 'arc3-solution-draft/charts/original/delta2.png'),
    );
  });

  it('accepts an uppercase allowed extension', () => {
    expect(resolveSpecialPath(ROOT, 'img/PHOTO.PNG')).toBe(path.join(ROOT, 'img/PHOTO.PNG'));
  });

  it.each([
    ['dot-dot segment', '../secrets.json'],
    ['nested dot-dot', 'arc3-solution-draft/../../etc/passwd.txt'],
    ['percent-encoded dot-dot', '%2e%2e/escape.html'],
    ['double-encoded dot-dot', '%252e%252e/escape.html'],
    ['leading slash', '/etc/hosts.txt'],
    ['backslash', '..\\escape.html'],
    ['null byte', 'page.html\0.png'],
    ['dotfile', '.env.json'],
    ['current-dir segment', './page.html'],
    ['empty segment', 'a//b.html'],
    ['disallowed extension', 'run.js'],
    ['no extension', 'README'],
    ['empty', ''],
    ['not a string', ['a.html']],
    ['overlong', `${'a'.repeat(400)}.html`],
  ])('refuses %s', (_label, input) => {
    expect(resolveSpecialPath(ROOT, input)).toBeNull();
  });
});

describe('specials publish round trip', () => {
  const TOKEN = 'test-token-not-a-secret';
  const saved = { ...process.env };
  let server: Server;
  let base: string;
  let tmp: string;

  beforeAll(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'specials-overlay-'));
    process.env.SPECIALS_OVERLAY_ROOT = tmp;
    process.env.ARC3_COMMUNITY_ADMIN_TOKEN = TOKEN;
    delete process.env.RAILWAY_DEPLOYMENT_ID;
    const { default: router } = await import('../../server/routes/specialsPublish');
    const { specialsOverlay } = await import('../../server/middleware/specialsOverlay');
    const app = express();
    app.use(express.json({ limit: '50mb' })); // same global parser as server/index.ts
    app.use('/api/specials', router);
    app.use('/specials', specialsOverlay);
    app.use('/specials', (_req, res) => res.status(200).send('baked'));
    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tmp, { recursive: true, force: true });
    process.env = saved;
  });

  const put = (p: string, body: Buffer, token: string | null = TOKEN) =>
    fetch(`${base}/api/specials/file?path=${encodeURIComponent(p)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream', ...(token ? { 'X-ARC3-Admin-Token': token } : {}) },
      body,
    });

  it('refuses a missing or wrong token', async () => {
    expect((await put('page.html', Buffer.from('x'), null)).status).toBe(401);
    expect((await put('page.html', Buffer.from('x'), 'wrong')).status).toBe(401);
  });

  it('refuses a traversal path and writes nothing outside the overlay', async () => {
    const res = await put('../escape.html', Buffer.from('x'));
    expect(res.status).toBe(400);
    expect(fs.existsSync(path.join(tmp, 'escape.html'))).toBe(false);
  });

  it('serves the baked copy until a file is pushed, then the pushed bytes', async () => {
    expect(await (await fetch(`${base}/specials/arc3-solution-draft/charts/a.png`)).text()).toBe('baked');

    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0x10]);
    const res = await put('arc3-solution-draft/charts/a.png', bytes);
    expect(res.status).toBe(200);
    expect(fs.existsSync(path.join(overlayDir()!, 'arc3-solution-draft/charts/a.png'))).toBe(true);

    const live = await fetch(`${base}/specials/arc3-solution-draft/charts/a.png`);
    expect(live.headers.get('cache-control')).toBe('no-cache');
    expect(Buffer.from(await live.arrayBuffer()).equals(bytes)).toBe(true);
  });

  it('falls back to the baked copy after the overlay file is deleted', async () => {
    await put('page.html', Buffer.from('<p>pushed</p>'));
    expect(await (await fetch(`${base}/specials/page.html`)).text()).toBe('<p>pushed</p>');
    const del = await fetch(`${base}/api/specials/file?path=page.html`, {
      method: 'DELETE',
      headers: { 'X-ARC3-Admin-Token': TOKEN },
    });
    expect(del.status).toBe(200);
    expect(await (await fetch(`${base}/specials/page.html`)).text()).toBe('baked');
  });

  it('does not serve an encoded traversal from the read side', async () => {
    // fetch() would normalise the dots away, so send the raw request line with node:http.
    fs.writeFileSync(path.join(tmp, 'outside.txt'), 'secret');
    const body = await new Promise<string>((resolve, reject) => {
      http.get(`${base}/specials/..%2f..%2foutside.txt`, (res) => {
        let text = '';
        res.on('data', (chunk) => (text += chunk));
        res.on('end', () => resolve(text));
      }).on('error', reject);
    });
    expect(body).toBe('baked');
  });
});
