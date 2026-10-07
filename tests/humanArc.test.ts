/**
 * Author: Codex
 * Date: 2026-10-07
 * PURPOSE: Verify that the Human ARC mount isolates page fallbacks, missing assets, and the host app.
 * SRP/DRY check: Pass — exercises the production middleware over HTTP, with no duplicated routing logic.
 */
import { afterAll, beforeAll, expect, test } from 'vitest';
import express from 'express';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import { mountHumanArc } from '../server/middleware/humanArc';

let server: Server;
let base: string;
const directory = mkdtempSync(path.join(tmpdir(), 'human-arc-routes-'));
beforeAll(async () => {
  mkdirSync(path.join(directory, 'assets'));
  writeFileSync(path.join(directory, 'index.html'), '<title>Human ARC</title>');
  writeFileSync(path.join(directory, 'assets/app-abc.js'), 'console.log("Human ARC")');
  const app = express();
  mountHumanArc(app, directory);
  app.get('*', (_req, res) => res.send('ARC Explainer'));
  server = await new Promise<Server>((resolve, reject) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    listener.once('error', reject);
  });
  base = `http://127.0.0.1:${(server.address() as {port: number}).port}`;
});
afterAll(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  rmSync(directory, { recursive: true });
});
test('root redirects once, preserves query, and nested refresh stays in Human ARC', async () => {
  const redirect = await fetch(`${base}/human-arc?ref=nav`, { redirect: 'manual' });
  expect(redirect.status).toBe(308);
  expect(redirect.headers.get('location')).toBe('/human-arc/?ref=nav');
  for (const route of ['/human-arc/', '/human-arc/assessment', '/human-arc/puzzles/solve/007bbfb7']) {
    const page = await fetch(base + route);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('<title>Human ARC</title>');
    expect(page.headers.get('cache-control')).toBe('no-cache');
  }
});
test('missing assets never return either SPA and unsupported methods fail', async () => {
  for (const route of ['/human-arc/assets/missing.js', '/human-arc/missing.png']) {
    expect((await fetch(base + route)).status).toBe(404);
  }
  expect((await fetch(`${base}/human-arc/assessment`, { method: 'POST' })).status).toBe(404);
  const asset = await fetch(`${base}/human-arc/assets/app-abc.js`);
  expect(asset.headers.get('cache-control')).toContain('immutable');
  expect(await asset.text()).toContain('console.log');
});
test('host routes and similarly named prefixes remain in ARC Explainer', async () => {
  for (const route of ['/puzzles', '/analytics', '/arc3/games', '/human-arcade']) {
    expect(await (await fetch(base + route)).text()).toBe('ARC Explainer');
  }
});
