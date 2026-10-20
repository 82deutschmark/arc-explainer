/**
 * Author: Claude Opus 5.5 Low
 * Date: 2026-10-19
 * PURPOSE: Guards the team sign-in, the site's first login (Google, like the
 *          AutoResearchArena): the session cookie works for a team email and only for one,
 *          taking someone off TEAM_EMAILS locks them out at once, tampered or expired cookies
 *          are refused, rotating the secret signs everyone out, and an unconfigured site is
 *          closed (503). The Google callback (server/routes/teamAuth.ts) is driven end to end
 *          with Google's two endpoints stubbed: a team account gets a cookie, an outsider and
 *          a token issued to another app don't, and a forged state is rejected.
 * SRP/DRY check: Pass - exercises the real middleware and router with minimal stand-ins.
 */
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { Request, Response } from 'express';
import { requireTeamSession, startTeamSession, teamUser } from '../server/middleware/teamSession';
import teamAuthRouter from '../server/routes/teamAuth';

const SECRET = 'x'.repeat(48);

function fakeRes() {
  const headers: Record<string, string[]> = {};
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    redirectedTo: undefined as string | undefined,
    locals: {} as Record<string, unknown>,
    append(name: string, value: string) { (headers[name] ??= []).push(value); return res; },
    set() { return res; },
    status(code: number) { res.statusCode = code; return res; },
    json(body: unknown) { res.body = body; return res; },
    redirect(to: string) { res.redirectedTo = to; return res; },
  };
  return { res, headers };
}

const req = (cookie?: string, query: Record<string, string> = {}) =>
  ({ headers: cookie ? { cookie } : {}, secure: true, query, protocol: 'https', get: () => 'arc.example' } as unknown as Request);

function signIn(email: string, name = 'Jack'): string {
  const { res, headers } = fakeRes();
  expect(startTeamSession(req(), res as unknown as Response, { email, name })).toBe(true);
  const set = headers['Set-Cookie'][0];
  expect(set).toContain('HttpOnly');
  expect(set).toContain('SameSite=Lax');
  expect(set).toContain('Secure');
  return set.split(';')[0];
}

beforeEach(() => {
  vi.stubEnv('GOOGLE_CLIENT_ID', 'our-client.apps.googleusercontent.com');
  vi.stubEnv('GOOGLE_CLIENT_SECRET', 'client-secret');
  vi.stubEnv('TEAM_SESSION_SECRET', SECRET);
  vi.stubEnv('TEAM_EMAILS', 'boss@example.com, Jack@Example.com');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

test('a team email gets a cookie that signs the browser in', () => {
  const cookie = signIn('jack@example.com');
  expect(teamUser(req(`other=1; ${cookie}`))).toEqual({ email: 'jack@example.com', name: 'Jack' });
});

test('an email off the team list gets no cookie', () => {
  const { res, headers } = fakeRes();
  expect(startTeamSession(req(), res as unknown as Response, { email: 'stranger@example.com', name: 'S' })).toBe(false);
  expect(headers['Set-Cookie']).toBeUndefined();
});

test('taking someone off the list locks them out at once', () => {
  const cookie = signIn('jack@example.com');
  vi.stubEnv('TEAM_EMAILS', 'boss@example.com');
  expect(teamUser(req(cookie))).toBeNull();
});

test('a tampered cookie is refused', () => {
  const cookie = signIn('jack@example.com');
  const [name, value] = cookie.split('=');
  const [, mac] = value.split('.');
  const forged = Buffer.from(JSON.stringify({ e: 'boss@example.com', n: 'Boss', x: Date.now() + 1e9 })).toString('base64url');
  expect(teamUser(req(`${name}=${forged}.${mac}`))).toBeNull();
});

test('rotating the session secret signs everyone out', () => {
  const cookie = signIn('jack@example.com');
  vi.stubEnv('TEAM_SESSION_SECRET', 'y'.repeat(48));
  expect(teamUser(req(cookie))).toBeNull();
});

test('an expired cookie is refused', () => {
  const cookie = signIn('jack@example.com');
  vi.useFakeTimers();
  vi.setSystemTime(Date.now() + 31 * 86_400_000);
  expect(teamUser(req(cookie))).toBeNull();
});

test('an unconfigured site is closed, and a signed-out request gets 401', () => {
  const next = vi.fn();
  vi.stubEnv('TEAM_EMAILS', '');
  const closed = fakeRes();
  requireTeamSession(req(), closed.res as unknown as Response, next);
  expect(closed.res.statusCode).toBe(503);
  vi.stubEnv('TEAM_EMAILS', 'boss@example.com');
  const out = fakeRes();
  requireTeamSession(req(), out.res as unknown as Response, next);
  expect(out.res.statusCode).toBe(401);
  expect(next).not.toHaveBeenCalled();
});

// ── the Google round trip ───────────────────────────────────────────────────────────────

type Handler = (req: Request, res: Response, next: () => void) => unknown;
function handler(path: string): Handler {
  const layer = (teamAuthRouter as unknown as { stack: Array<{ route?: { path: string; stack: Array<{ handle: Handler }> } }> })
    .stack.find((l) => l.route?.path === path);
  const stack = layer!.route!.stack;
  return stack[stack.length - 1].handle;   // skip the rate limiter
}

/** Start sign-in, returning the state cookie and the state Google would echo back. */
function startGoogle(): { cookie: string; state: string } {
  const { res, headers } = fakeRes();
  handler('/google')(req(undefined, { next: '/team/arc2-runs/123' }), res as unknown as Response, () => {});
  const state = new URL(res.redirectedTo!).searchParams.get('state')!;
  return { cookie: headers['Set-Cookie'][0].split(';')[0], state };
}

function stubGoogle(info: Record<string, unknown>) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) =>
    String(url) === 'https://oauth2.googleapis.com/token'
      ? new Response(JSON.stringify({ id_token: 'tok' }), { status: 200 })
      : new Response(JSON.stringify(info), { status: 200 })));
}

async function callback(cookie: string, query: Record<string, string>) {
  const { res, headers } = fakeRes();
  // asyncHandler doesn't hand back its promise, so wait until the handler has answered.
  await new Promise<void>((resolve, reject) => {
    const settle = () => (res.redirectedTo ? resolve() : setTimeout(settle, 1));
    handler('/google/callback')(req(cookie, query), res as unknown as Response, (err?: unknown) => reject(err));
    settle();
  });
  return { res, headers };
}

test('a team Google account is signed in and sent on to the page it asked for', async () => {
  const { cookie, state } = startGoogle();
  stubGoogle({ aud: 'our-client.apps.googleusercontent.com', email: 'jack@example.com', email_verified: 'true', name: 'Jack Cole' });
  const { res, headers } = await callback(cookie, { code: 'c', state });
  expect(res.redirectedTo).toBe('/team/arc2-runs/123');
  const session = headers['Set-Cookie'].find((c) => c.startsWith('arc_team='))!.split(';')[0];
  expect(teamUser(req(session))?.name).toBe('Jack Cole');
});

test('an outsider, an unverified email, or a token for another app gets no session', async () => {
  for (const [info, reason] of [
    [{ aud: 'our-client.apps.googleusercontent.com', email: 'stranger@example.com', email_verified: 'true' }, 'not_on_team'],
    [{ aud: 'our-client.apps.googleusercontent.com', email: 'jack@example.com', email_verified: 'false' }, 'unverified'],
    [{ aud: 'someone-elses-app', email: 'jack@example.com', email_verified: 'true' }, 'google_failed'],
  ] as const) {
    const { cookie, state } = startGoogle();
    stubGoogle(info);
    const { res, headers } = await callback(cookie, { code: 'c', state });
    expect(res.redirectedTo).toBe(`/team/login?error=${reason}`);
    expect(headers['Set-Cookie'].some((c) => c.startsWith('arc_team=') && !c.startsWith('arc_team=;'))).toBe(false);
  }
});

test('a callback whose state does not match the browser that started is rejected', async () => {
  const { cookie } = startGoogle();
  stubGoogle({ aud: 'our-client.apps.googleusercontent.com', email: 'jack@example.com', email_verified: 'true' });
  const { res } = await callback(cookie, { code: 'c', state: 'forged-state' });
  expect(res.redirectedTo).toBe('/team/login?error=expired');
});
