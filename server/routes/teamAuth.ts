/*
Author: Claude Opus 5.5 Low
Date: 2026-10-19
PURPOSE: Google sign-in for the team-only pages, mounted at /api/auth. The same flow the
         AutoResearchArena uses (its server/app.py, /api/auth/google and its callback), which
         the Boss asked for by name:

           GET    /google            remember where to go next, then send the browser to Google
           GET    /google/callback   Google sends it back with a code; trade the code for an
                                     ID token, have Google check the token, require a verified
                                     email on TEAM_EMAILS, set the team session cookie
           GET    /session           { configured, signedIn, email, name } for the pages
           DELETE /session           sign out

         The state value that ties the callback to the browser that started it is kept in a
         short-lived signed cookie (the arena keeps it in a Flask session; this server has no
         session store). Someone whose Google account isn't on the team list is sent back to
         /team/login with a plain message and gets no cookie.

         Settings (Railway): GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, TEAM_EMAILS,
         TEAM_SESSION_SECRET, and GOOGLE_REDIRECT_URI (the address registered with Google;
         defaults to this host's /api/auth/google/callback).
         2026-10-21 (Claude Opus 5.5): the page to return to may carry dots and a plain query
         (an eval run's /team/arc2-evals/<key>?o=<output>); "." and ".." segments, empty
         segments and anything else outside the team pages are still refused.
SRP/DRY check: Pass - the Google round trip only. The session itself lives in
         middleware/teamSession.ts; responses via formatResponse and express-rate-limit as
         elsewhere.
*/

import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { randomBytes } from 'node:crypto';
import { asyncHandler } from '../middleware/asyncHandler';
import { formatResponse } from '../utils/responseFormatter';
import { tokenMatches } from '../middleware/arc3AdminToken';
import {
  cookieAttributes, endTeamSession, readCookie, signValue, startTeamSession, teamLoginConfigured, teamUser,
} from '../middleware/teamSession';
import { logger } from '../utils/logger.js';

const router = Router();
const STATE_COOKIE = 'arc_team_oauth';
const STATE_PATH = '/api/auth';
const STATE_MINUTES = 10;

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });

function redirectUri(req: Request): string {
  return process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/auth/google/callback`;
}

/**
 * A team page, with an optional plain query. Each path segment starts with a letter, digit, "_"
 * or "-", so there are no "." / ".." or empty ("//") segments; the query has no "/", ":" or "%".
 * The client's TeamLogin.tsx uses the same pattern.
 */
const TEAM_PAGE = /^\/team(?:\/[A-Za-z0-9_-][A-Za-z0-9._-]*)*\/?(?:\?[A-Za-z0-9=&_.-]*)?$/;

/** Only ever return to a team page, so sign-in can't be used to bounce people elsewhere. */
export function safeNext(value: unknown): string {
  const next = typeof value === 'string' ? value : '';
  return TEAM_PAGE.test(next) ? next : '/team/arc2-runs';
}

const loginPage = (reason: string) => `/team/login?error=${encodeURIComponent(reason)}`;

router.get('/google', authLimiter, (req: Request, res: Response) => {
  if (!teamLoginConfigured()) return res.redirect(loginPage('not_configured'));
  const state = randomBytes(24).toString('base64url');
  const next = safeNext(req.query.next);
  const payload = Buffer.from(JSON.stringify({ s: state, n: next, x: Date.now() + STATE_MINUTES * 60_000 })).toString('base64url');
  res.append('Set-Cookie', `${STATE_COOKIE}=${payload}.${signValue(payload)}; ${cookieAttributes(req, STATE_PATH, STATE_MINUTES * 60)}`);
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? '',
    redirect_uri: redirectUri(req),
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    state,
    prompt: 'select_account',
  });
  return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

/** The state cookie's contents if it is ours, unexpired and matches what Google sent back. */
function checkState(req: Request): { next: string } | null {
  const value = readCookie(req, STATE_COOKIE);
  const returned = typeof req.query.state === 'string' ? req.query.state : '';
  if (!value || !returned) return null;
  const [payload, mac] = value.split('.');
  const expected = payload ? signValue(payload) : null;
  if (!payload || !mac || !expected || !tokenMatches(mac, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { s: string; n: string; x: number };
    if (data.x < Date.now() || !tokenMatches(returned, data.s)) return null;
    return { next: safeNext(data.n) };
  } catch {
    return null;
  }
}

router.get(
  '/google/callback',
  authLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    // The state cookie is single-use whatever happens next.
    res.append('Set-Cookie', `${STATE_COOKIE}=; ${cookieAttributes(req, STATE_PATH, 0)}`);
    if (!teamLoginConfigured()) return res.redirect(loginPage('not_configured'));
    if (typeof req.query.error === 'string') return res.redirect(loginPage('google_declined'));
    const state = checkState(req);
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    if (!state || !code) return res.redirect(loginPage('expired'));

    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID ?? '',
          client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
          redirect_uri: redirectUri(req),
          grant_type: 'authorization_code',
        }),
      });
      if (!tokenRes.ok) throw new Error(`token exchange answered ${tokenRes.status}`);
      const tokens = (await tokenRes.json()) as { id_token?: string };
      // Google checks the ID token's signature and expiry for us, as the arena does.
      const infoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?${new URLSearchParams({ id_token: tokens.id_token ?? '' })}`);
      if (!infoRes.ok) throw new Error(`tokeninfo answered ${infoRes.status}`);
      const info = (await infoRes.json()) as { aud?: string; email?: string; email_verified?: string | boolean; name?: string };
      // The token must have been issued to this site's client, not any Google app.
      if (info.aud !== process.env.GOOGLE_CLIENT_ID) throw new Error('ID token was issued to a different client');
      const email = (info.email ?? '').trim().toLowerCase();
      if (!email || (info.email_verified !== true && info.email_verified !== 'true')) return res.redirect(loginPage('unverified'));
      if (!startTeamSession(req, res, { email, name: info.name || email })) {
        logger.warn(`Team sign-in refused for ${email}: not on TEAM_EMAILS`, 'team-auth');
        return res.redirect(loginPage('not_on_team'));
      }
      logger.info(`Team sign-in: ${email}`, 'team-auth');
      return res.redirect(state.next);
    } catch (error) {
      logger.warn(`Team sign-in failed: ${error instanceof Error ? error.message : String(error)}`, 'team-auth');
      return res.redirect(loginPage('google_failed'));
    }
  }),
);

router.get('/session', (req: Request, res: Response) => {
  res.set('Cache-Control', 'private, no-store');
  const user = teamLoginConfigured() ? teamUser(req) : null;
  res.json(formatResponse.success({ configured: teamLoginConfigured(), signedIn: Boolean(user), email: user?.email ?? null, name: user?.name ?? null }));
});

router.delete('/session', (req: Request, res: Response) => {
  endTeamSession(req, res);
  res.json(formatResponse.success({ signedIn: false }));
});

export default router;
