/**
 * Author: Claude Opus 5.5 Medium
 * Date: 08-November-2026
 * PURPOSE: Tests for shared review comments (services/reviewComments.ts, routes/reviewComments.ts).
 *          Proves the full comment life cycle over HTTP (add, reply, resolve, reopen, delete),
 *          that many reviewers posting at once lose nothing, that a delete only hides (the log
 *          keeps it), that unknown documents and bad input are refused, that the route answers 503
 *          when no storage is configured, and that restoring a backup twice adds nothing.
 * SRP/DRY check: Pass - tests only; drives the real router on a throwaway port, as
 *          tests/unit/specialsOverlay.test.ts does.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

const DOC = 'turducken-2026-11-06';
const anchor = { exact: 'Stuffing the Turducken', prefix: '', suffix: 'Hi everyone', start: 120, heading: '' };

describe('review comments API', () => {
  const saved = { ...process.env };
  let server: Server;
  let base: string;
  let tmp: string;

  beforeAll(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'review-comments-'));
    process.env.REVIEW_COMMENTS_ROOT = tmp;
    const { default: router } = await import('../../server/routes/reviewComments');
    const app = express();
    app.use(express.json({ limit: '50mb' })); // same global parser as server/index.ts
    app.use('/api/review-comments', router);
    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/review-comments`;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tmp, { recursive: true, force: true });
    process.env = saved;
  });

  const call = async (method: string, p: string, body?: unknown) => {
    const res = await fetch(`${base}${p}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, json: await res.json() };
  };

  it('runs a whole comment life cycle', async () => {
    const created = await call('POST', `/${DOC}/threads`, { author: 'Son', body: 'Tighten this.', anchor });
    expect(created.status).toBe(201);
    const id = created.json.data.thread.id;

    const replied = await call('POST', `/${DOC}/threads/${id}/replies`, { author: 'Boss', body: 'Agreed.' });
    expect(replied.json.data.thread.replies).toHaveLength(1);
    const replyId = replied.json.data.thread.replies[0].id;

    const resolved = await call('PATCH', `/${DOC}/threads/${id}`, { author: 'Son', status: 'resolved' });
    expect(resolved.json.data.thread.status).toBe('resolved');
    expect(resolved.json.data.thread.statusBy).toBe('Son');
    expect((await call('PATCH', `/${DOC}/threads/${id}`, { author: 'Son', status: 'open' })).json.data.thread.status).toBe('open');

    expect((await call('DELETE', `/${DOC}/threads/${id}/replies/${replyId}`, { author: 'Boss' })).status).toBe(200);
    let list = await call('GET', `/${DOC}`);
    expect(list.json.data.threads[0].replies).toHaveLength(0);
    expect(list.json.data.threads[0].anchor.exact).toBe('Stuffing the Turducken');

    expect((await call('DELETE', `/${DOC}/threads/${id}`, { author: 'Son' })).status).toBe(200);
    list = await call('GET', `/${DOC}`);
    expect(list.json.data.threads.find((t: { id: string }) => t.id === id)).toBeUndefined();
    // Hidden, not erased: the text is still in the log.
    expect(fs.readFileSync(path.join(tmp, `${DOC}.jsonl`), 'utf8')).toContain('Tighten this.');
  });

  it('keeps every comment when many arrive at once', async () => {
    const before = (await call('GET', `/${DOC}`)).json.data.threads.length;
    await Promise.all(Array.from({ length: 25 }, (_, i) =>
      call('POST', `/${DOC}/threads`, { author: `R${i}`, body: `note ${i}`, anchor })));
    const after = (await call('GET', `/${DOC}`)).json.data.threads;
    expect(after.length).toBe(before + 25);
  });

  it('refuses unknown documents, missing names, empty bodies and bad anchors', async () => {
    expect((await call('GET', '/not-a-doc')).status).toBe(404);
    expect((await call('POST', `/${DOC}/threads`, { author: '', body: 'x', anchor })).status).toBe(400);
    expect((await call('POST', `/${DOC}/threads`, { author: 'Son', body: '   ', anchor })).status).toBe(400);
    expect((await call('POST', `/${DOC}/threads`, { author: 'Son', body: 'x', anchor: { exact: '  ' } })).status).toBe(400);
    expect((await call('POST', `/${DOC}/threads`, { author: 'Son', body: 'x'.repeat(6000), anchor })).status).toBe(400);
    expect((await call('PATCH', `/${DOC}/threads/nope-nope`, { author: 'Son', status: 'resolved' })).status).toBe(404);
    expect((await call('PATCH', `/${DOC}/threads/nope-nope`, { author: 'Son', status: 'maybe' })).status).toBe(400);
  });

  it('skips a log line torn by a crash and keeps the rest', async () => {
    const file = path.join(tmp, `${DOC}.jsonl`);
    fs.appendFileSync(file, '{"type":"thread","at":"2026-11-08T');
    const list = await call('GET', `/${DOC}`);
    expect(list.status).toBe(200);
    const count = list.json.data.threads.length;
    expect(count).toBeGreaterThan(0);
    // The next append starts on a fresh line, so the torn fragment cannot swallow it.
    expect((await call('POST', `/${DOC}/threads`, { author: 'Son', body: 'after the tear', anchor })).status).toBe(201);
    expect((await call('GET', `/${DOC}`)).json.data.threads.length).toBe(count + 1);
  });

  it('restores a backup once, and a second restore adds nothing', async () => {
    const threads = [{
      id: 'local-abc123-xyz', author: 'Son', body: 'from a backup', createdAt: '2026-11-08T10:00:00Z',
      anchor, status: 'resolved', statusBy: 'Son',
      replies: [{ id: 'local-def456-uvw', author: 'Boss', body: 'ok', createdAt: '2026-11-08T10:05:00Z' }],
    }];
    expect((await call('POST', `/${DOC}/import`, { threads })).json.data).toEqual({ added: 1, skipped: 0 });
    expect((await call('POST', `/${DOC}/import`, { threads })).json.data).toEqual({ added: 0, skipped: 1 });
    const restored = (await call('GET', `/${DOC}`)).json.data.threads.find((t: { id: string }) => t.id === 'local-abc123-xyz');
    expect(restored.status).toBe('resolved');
    expect(restored.replies[0].body).toBe('ok');
    expect((await call('POST', `/${DOC}/import`, { threads: [{ ...threads[0], id: '../x' }] })).status).toBe(400);
  });

  it('answers 503 when no storage is configured', async () => {
    delete process.env.REVIEW_COMMENTS_ROOT;
    delete process.env.RAILWAY_VOLUME_MOUNT_PATH;
    try {
      expect((await call('GET', `/${DOC}`)).status).toBe(503);
    } finally {
      process.env.REVIEW_COMMENTS_ROOT = tmp;
    }
  });
});
