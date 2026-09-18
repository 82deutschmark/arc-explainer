/*
Author: Claude Opus 5
Date: 2026-09-18
PURPOSE: The one shared-secret guard for the few arc3 routes that must not be open to the
         internet. Moved here from server/routes/kaggle.ts (where it guarded the leaderboard
         push) when the game dataset route became its second user, so both routes check the
         token the same way and a fix to one is a fix to both.

         THE CREDENTIAL. `ARC3_COMMUNITY_ADMIN_TOKEN`, sent as the `X-ARC3-Admin-Token`
         header (`x-api-key` is accepted too). It is this repo's documented convention for
         security-sensitive arc3 endpoints (docs/reference/api/EXTERNAL_API.md). On the Mac
         Mini the same value sits in the login keychain under service
         `arc3-community-admin-token`, which is where the arc-3 fetch script and the Kaggle
         pusher read it from.

         CLOSED BY DEFAULT. With no token configured the route answers 503 and serves
         nothing. A missing secret is the state a fresh deploy is in, and the safe reading of
         "no credential configured" is "accept nothing".

         Deliberately NOT middleware/apiKeyAuth.ts: that file ships three hardcoded default
         keys in the repo source, so anything it guards is guarded by a published password.
SRP/DRY check: Pass -- token checking only. Before this it lived inline in kaggle.ts, the
         only guarded route; the dataset route would otherwise have been a second copy.
*/

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { formatResponse } from '../utils/responseFormatter';
import { logger } from '../utils/logger.js';

/**
 * Length-independent comparison. timingSafeEqual throws on a length mismatch, and that
 * throw is itself an oracle for the secret's length, so a wrong-length guess burns a
 * comparison and returns false instead.
 */
export function tokenMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

interface Arc3AdminTokenOptions {
  /** Names the guarded thing in the 503 message and the logs, e.g. "Leaderboard push". */
  label: string;
  /** Logger context tag. */
  logContext: string;
  /** Error code for the not-configured 503. Kept per route so existing callers see no change. */
  disabledCode?: string;
  /** Extra env var accepted when ARC3_COMMUNITY_ADMIN_TOKEN is unset (Kaggle's split-later escape hatch). */
  fallbackEnv?: string;
}

/** Express middleware: 503 when no secret is configured, 401 on a missing or wrong token. */
export function requireArc3AdminToken(options: Arc3AdminTokenOptions): RequestHandler {
  const { label, logContext, disabledCode = 'not_configured', fallbackEnv } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const expected =
      process.env.ARC3_COMMUNITY_ADMIN_TOKEN || (fallbackEnv ? process.env[fallbackEnv] : undefined);

    if (!expected) {
      logger.warn(`${label} rejected: ARC3_COMMUNITY_ADMIN_TOKEN is not set.`, logContext);
      return res
        .status(503)
        .json(formatResponse.error(disabledCode, `${label} is not configured on this deployment.`));
    }

    const header = req.headers['x-arc3-admin-token'] ?? req.headers['x-api-key'];
    const provided = typeof header === 'string' ? header : '';

    if (!provided || !tokenMatches(provided, expected)) {
      logger.warn(`${label} rejected: bad or missing token.`, logContext);
      return res
        .status(401)
        .json(formatResponse.error('unauthorized', 'A valid X-ARC3-Admin-Token header is required.'));
    }

    return next();
  };
}
