/**
 * Author: Claude Opus 5.5 Low
 * Date: 2026-10-19
 * PURPOSE: Guards the team sign-in (server/middleware/teamSession.ts), the site's first login:
 *          a right passphrase gives a working cookie, a wrong one doesn't, a tampered or
 *          expired cookie is refused, changing the passphrase signs everyone out, and with
 *          no passphrase configured the guarded routes are closed (503), not open.
 * SRP/DRY check: Pass - exercises the real middleware with minimal request/response stand-ins.
 */
import { afterEach, expect, test, vi } from 'vitest';
import type { Request, Response } from 'express';
import { hasTeamSession, requireTeamSession, startTeamSession, TEAM_COOKIE } from '../server/middleware/teamSession';

function fakeRes() {
  const headers: Record<string, string[]> = {};
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    append(name: string, value: string) { (headers[name] ??= []).push(value); return res; },
    set() { return res; },
    status(code: number) { res.statusCode = code; return res; },
    json(body: unknown) { res.body = body; return res; },
  };
  return { res, headers };
}

const req = (cookie?: string) => ({ headers: cookie ? { cookie } : {}, secure: true } as unknown as Request);

function signIn(phrase: string): string {
  const { res, headers } = fakeRes();
  expect(startTeamSession(req(), res as unknown as Response, phrase)).toBe(true);
  const set = headers['Set-Cookie'][0];
  expect(set).toContain('HttpOnly');
  expect(set).toContain('SameSite=Lax');
  expect(set).toContain('Secure');
  return set.split(';')[0];
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

test('the right passphrase gives a cookie that signs the browser in', () => {
  vi.stubEnv('ARC2_TEAM_PASSPHRASE', 'mutant grids at dawn');
  const cookie = signIn('mutant grids at dawn');
  expect(hasTeamSession(req(`other=1; ${cookie}`))).toBe(true);
});

test('a wrong passphrase is refused and sets nothing', () => {
  vi.stubEnv('ARC2_TEAM_PASSPHRASE', 'mutant grids at dawn');
  const { res, headers } = fakeRes();
  expect(startTeamSession(req(), res as unknown as Response, 'mutant grids at dusk')).toBe(false);
  expect(headers['Set-Cookie']).toBeUndefined();
});

test('a tampered cookie is refused', () => {
  vi.stubEnv('ARC2_TEAM_PASSPHRASE', 'mutant grids at dawn');
  const cookie = signIn('mutant grids at dawn');
  const [name, value] = cookie.split('=');
  const [v, expires, mac] = value.split('.');
  // Pushing the expiry out without the key must not work.
  expect(hasTeamSession(req(`${name}=${v}.${Number(expires) + 1}.${mac}`))).toBe(false);
  expect(hasTeamSession(req(`${TEAM_COOKIE}=v1.9999999999999.forged`))).toBe(false);
});

test('changing the passphrase signs everyone out', () => {
  vi.stubEnv('ARC2_TEAM_PASSPHRASE', 'mutant grids at dawn');
  const cookie = signIn('mutant grids at dawn');
  vi.stubEnv('ARC2_TEAM_PASSPHRASE', 'a brand new phrase');
  expect(hasTeamSession(req(cookie))).toBe(false);
});

test('an expired cookie is refused', () => {
  vi.stubEnv('ARC2_TEAM_PASSPHRASE', 'mutant grids at dawn');
  const cookie = signIn('mutant grids at dawn');
  vi.useFakeTimers();
  vi.setSystemTime(Date.now() + 61 * 86_400_000);
  expect(hasTeamSession(req(cookie))).toBe(false);
});

test('with no passphrase configured the guarded routes are closed', () => {
  vi.stubEnv('ARC2_TEAM_PASSPHRASE', '');
  const { res } = fakeRes();
  const next = vi.fn();
  requireTeamSession(req(), res as unknown as Response, next);
  expect(res.statusCode).toBe(503);
  expect(next).not.toHaveBeenCalled();
});

test('a signed-out request to a guarded route gets 401', () => {
  vi.stubEnv('ARC2_TEAM_PASSPHRASE', 'mutant grids at dawn');
  const { res } = fakeRes();
  const next = vi.fn();
  requireTeamSession(req(), res as unknown as Response, next);
  expect(res.statusCode).toBe(401);
  expect(next).not.toHaveBeenCalled();
});
