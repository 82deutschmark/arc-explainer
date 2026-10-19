/*
Author: Claude Opus 5.5 Low
Date: 2026-10-19
PURPOSE: The site's team sign-in, the first login ARC Explainer has had. It guards the
         team-only Kaggle runs record (routes/teamRuns.ts); everything else on the site stays
         public, as before.

         THE CREDENTIAL. One shared team passphrase, `ARC2_TEAM_PASSPHRASE`, set on Railway.
         The Boss chose a team login (19-Oct-2026) for a handful of people; a shared phrase
         is the smallest thing that does it. Signing in posts the phrase once; the server
         answers with an httpOnly cookie holding an expiry and an HMAC of it, so nothing
         secret sits in the browser and no session table is needed.

         ROTATING SIGNS EVERYONE OUT. The HMAC key is derived from the passphrase, so
         changing the phrase on Railway invalidates every cookie at once. That is the
         revocation story: there are no per-person sessions to revoke.

         CLOSED BY DEFAULT, like arc3AdminToken.ts: with no passphrase configured nobody can
         sign in and every guarded route answers 503.

         The cookie is SameSite=Lax and scoped to /api/team, so another site cannot make a
         signed-in browser post a note, and the cookie never rides along on public routes.
SRP/DRY check: Pass - sign-in checking only. The constant-time compare is tokenMatches from
         arc3AdminToken.ts; the Mini's machine writes keep using that file's admin token.
*/

import type { Request, Response, NextFunction } from 'express';
import { createHash, createHmac } from 'node:crypto';
import { tokenMatches } from './arc3AdminToken';
import { formatResponse } from '../utils/responseFormatter';

export const TEAM_COOKIE = 'arc_team';
const COOKIE_PATH = '/api/team';
const SESSION_DAYS = 60;

function passphrase(): string | null {
  const value = process.env.ARC2_TEAM_PASSPHRASE?.trim();
  return value ? value : null;
}

function signingKey(phrase: string): Buffer {
  return createHash('sha256').update(`arc-explainer team session v1\0${phrase}`).digest();
}

function sign(phrase: string, expires: number): string {
  return createHmac('sha256', signingKey(phrase)).update(`v1.${expires}`).digest('base64url');
}

/** The cookie's value from the raw header (there is no cookie parser on this server). */
function readCookie(req: Request): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const at = part.indexOf('=');
    if (at > 0 && part.slice(0, at).trim() === TEAM_COOKIE) return decodeURIComponent(part.slice(at + 1).trim());
  }
  return null;
}

export function teamLoginConfigured(): boolean {
  return passphrase() !== null;
}

/** True when the request carries an unexpired cookie signed with the current passphrase. */
export function hasTeamSession(req: Request): boolean {
  const phrase = passphrase();
  const value = readCookie(req);
  if (!phrase || !value) return false;
  const [version, expiresText, mac] = value.split('.');
  const expires = Number(expiresText);
  if (version !== 'v1' || !Number.isFinite(expires) || !mac || expires < Date.now()) return false;
  return tokenMatches(mac, sign(phrase, expires));
}

function cookieAttributes(req: Request, maxAgeSeconds: number): string {
  // trust proxy is on (server/index.ts), so req.secure is true behind Railway's HTTPS.
  return `Path=${COOKIE_PATH}; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${req.secure ? '; Secure' : ''}`;
}

/** Checks the phrase; on a match sets the session cookie. Returns false on a wrong phrase. */
export function startTeamSession(req: Request, res: Response, provided: string): boolean {
  const phrase = passphrase();
  if (!phrase || !tokenMatches(provided.trim(), phrase)) return false;
  const expires = Date.now() + SESSION_DAYS * 86_400_000;
  res.append('Set-Cookie', `${TEAM_COOKIE}=v1.${expires}.${sign(phrase, expires)}; ${cookieAttributes(req, SESSION_DAYS * 86_400)}`);
  return true;
}

export function endTeamSession(req: Request, res: Response): void {
  res.append('Set-Cookie', `${TEAM_COOKIE}=; ${cookieAttributes(req, 0)}`);
}

/** Express middleware for team-only routes: 503 when no passphrase is set, 401 without a session. */
export function requireTeamSession(req: Request, res: Response, next: NextFunction) {
  if (!teamLoginConfigured()) {
    return res.status(503).json(formatResponse.error('team_login_disabled', 'Team sign-in is not configured on this deployment.'));
  }
  if (!hasTeamSession(req)) {
    return res.status(401).json(formatResponse.error('team_sign_in_required', 'Sign in with the team passphrase first.'));
  }
  res.set('Cache-Control', 'private, no-store');
  return next();
}
