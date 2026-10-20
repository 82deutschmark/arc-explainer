/*
Author: Claude Opus 5.5 Low
Date: 2026-10-19
PURPOSE: The site's team sign-in, the first login ARC Explainer has had. It guards the
         team-only Kaggle runs record (routes/teamRuns.ts); everything else on the site stays
         public, as before.

         GOOGLE SIGN-IN, LIKE THE ARENA. The Boss, 19-Oct-2026: "we're using Google OAuth the
         same way we did on the AutoResearchArena." So: a Google account, checked against a
         list of team emails (`TEAM_EMAILS`, comma-separated, like the arena's
         ARENA_ADMIN_EMAILS). The Google round trip lives in routes/teamAuth.ts; this file owns
         the session it ends in. (A shared passphrase was the first version, the same day;
         replaced before anyone used it.)

         THE SESSION is an httpOnly cookie holding the person's email, name and an expiry,
         signed with an HMAC keyed by `TEAM_SESSION_SECRET`. No session table: nothing to
         clean up, and rotating the secret signs everyone out. The email is checked against
         TEAM_EMAILS on every request, so taking someone off the list locks them out at once,
         cookie or not.

         CLOSED BY DEFAULT, like arc3AdminToken.ts: without the Google client, the session
         secret and at least one team email, nobody can sign in and every guarded route
         answers 503.

         The cookie is SameSite=Lax and scoped to /api, so another site cannot make a
         signed-in browser post a note.
SRP/DRY check: Pass - session issuing and checking only. The constant-time compare is
         tokenMatches from arc3AdminToken.ts; the Mini's machine writes keep using that file's
         admin token.
*/

import type { Request, Response, NextFunction } from 'express';
import { createHmac } from 'node:crypto';
import { tokenMatches } from './arc3AdminToken';
import { formatResponse } from '../utils/responseFormatter';

export const TEAM_COOKIE = 'arc_team';
const COOKIE_PATH = '/api';
const SESSION_DAYS = 30;

export interface TeamUser {
  email: string;
  name: string;
}

/** The team list, lowercased. Read per call so a Railway variable change needs no code change. */
export function teamEmails(): Set<string> {
  return new Set((process.env.TEAM_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean));
}

function sessionSecret(): string | null {
  const value = process.env.TEAM_SESSION_SECRET?.trim();
  return value && value.length >= 32 ? value : null;
}

export function teamLoginConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && sessionSecret() && teamEmails().size);
}

/** HMAC of a payload with the session secret, for the session cookie and the OAuth state cookie. */
export function signValue(payload: string): string | null {
  const secret = sessionSecret();
  return secret ? createHmac('sha256', secret).update(payload).digest('base64url') : null;
}

/** A cookie's value from the raw header (there is no cookie parser on this server). */
export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const at = part.indexOf('=');
    if (at > 0 && part.slice(0, at).trim() === name) return decodeURIComponent(part.slice(at + 1).trim());
  }
  return null;
}

export function cookieAttributes(req: Request, path: string, maxAgeSeconds: number): string {
  // trust proxy is on (server/index.ts), so req.secure is true behind Railway's HTTPS.
  return `Path=${path}; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${req.secure ? '; Secure' : ''}`;
}

/** The signed-in team member, or null. Checks the signature, the expiry and the team list. */
export function teamUser(req: Request): TeamUser | null {
  const value = readCookie(req, TEAM_COOKIE);
  if (!value) return null;
  const [payload, mac] = value.split('.');
  const expected = payload ? signValue(payload) : null;
  if (!payload || !mac || !expected || !tokenMatches(mac, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { e?: string; n?: string; x?: number };
    const email = (data.e ?? '').toLowerCase();
    if (!email || typeof data.x !== 'number' || data.x < Date.now() || !teamEmails().has(email)) return null;
    return { email, name: data.n || email };
  } catch {
    return null;
  }
}

/** Sets the session cookie for someone Google has vouched for. False if they aren't on the team. */
export function startTeamSession(req: Request, res: Response, user: TeamUser): boolean {
  const email = user.email.trim().toLowerCase();
  if (!teamEmails().has(email)) return false;
  const payload = Buffer.from(JSON.stringify({ e: email, n: user.name.slice(0, 80), x: Date.now() + SESSION_DAYS * 86_400_000 }))
    .toString('base64url');
  const mac = signValue(payload);
  if (!mac) return false;
  res.append('Set-Cookie', `${TEAM_COOKIE}=${payload}.${mac}; ${cookieAttributes(req, COOKIE_PATH, SESSION_DAYS * 86_400)}`);
  return true;
}

export function endTeamSession(req: Request, res: Response): void {
  res.append('Set-Cookie', `${TEAM_COOKIE}=; ${cookieAttributes(req, COOKIE_PATH, 0)}`);
}

/** Express middleware for team-only routes: 503 when sign-in isn't set up, 401 without a session. */
export function requireTeamSession(req: Request, res: Response, next: NextFunction) {
  if (!teamLoginConfigured()) {
    return res.status(503).json(formatResponse.error('team_login_disabled', 'Team sign-in is not configured on this deployment.'));
  }
  const user = teamUser(req);
  if (!user) {
    return res.status(401).json(formatResponse.error('team_sign_in_required', 'Sign in with a team Google account first.'));
  }
  res.locals.teamUser = user;
  res.set('Cache-Control', 'private, no-store');
  return next();
}
