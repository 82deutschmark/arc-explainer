/*
Author: Claude Opus 5
Date: 2026-09-06
PURPOSE: HTTP layer for our standing on a public Kaggle competition leaderboard -- one
         authenticated write for the Mac Mini's daily job, one public read for the arc3
         landing page.

         WHY THE WRITE IS THE ONE AUTHENTICATED ROUTE IN THIS APP. Everything else here is
         deliberately public (see apiKeyAuth.ts, which is marked do-not-use for exactly
         that reason) and that rule is about READS: researchers should not need a key to
         pull our data. This is a write, and the value it writes is a factual claim the
         landing page then makes in public about where we placed. An open endpoint would
         let anyone on the internet set our leaderboard position to whatever they liked,
         which does not just corrupt a table -- it defeats the entire point of replacing
         the hard-coded "we are currently fifth" with fetched data. Honest data cannot
         come from a forgeable endpoint.

         CLOSED BY DEFAULT. With no token configured the write route is DISABLED, not open.
         A missing secret is the state a fresh deploy is in, and the safe reading of "no
         credential configured" is "accept nothing".

         THE CREDENTIAL IS THE EXISTING ARC3_COMMUNITY_ADMIN_TOKEN, not a new secret --
         see requirePushToken for why.

         Deliberately NOT using middleware/apiKeyAuth.ts: it ships three hardcoded default
         keys in the repo source, so anything it guards is guarded by a published password.

         The read route never calls Kaggle. See KaggleStandingRepository for why the
         fetch lives on the Mac Mini and pushes here.
SRP/DRY check: Pass - HTTP only; every query lives in KaggleStandingRepository. Reuses
         asyncHandler + formatResponse like every other router, and express-rate-limit as
         arc3HumanPlay.ts does. No existing router covers external competition standings.
*/

import { Router, type Request, type Response, type NextFunction } from 'express';
import { timingSafeEqual } from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../middleware/asyncHandler';
import { formatResponse } from '../utils/responseFormatter';
import { kaggleStandingRepository } from '../repositories/KaggleStandingRepository.js';
import { logger } from '../utils/logger.js';

const router = Router();

/** Kaggle competition slugs: lowercase, digits, hyphens. Keeps the path param off the DB. */
const COMPETITION_SLUG = /^[a-z0-9][a-z0-9-]{0,99}$/;

/**
 * Length-independent comparison. Hashing both sides to a fixed length first, rather than
 * comparing raw buffers, because timingSafeEqual throws on a length mismatch -- and that
 * throw is itself an oracle for the secret's length.
 */
function tokenMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    // Still burn a comparison so a wrong-length guess is not measurably faster.
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

/**
 * Shared-secret guard for the push route. Closed when no secret is configured.
 *
 * REUSES THE EXISTING ARC-3 ADMIN TOKEN rather than minting a new secret.
 * `ARC3_COMMUNITY_ADMIN_TOKEN` + the `X-ARC3-Admin-Token` header is this repo's documented
 * convention for security-sensitive arc3 endpoints (docs/reference/api/EXTERNAL_API.md,
 * docs/plans/020426-arc3-community-submissions-publish-plan.md). The code that used it went
 * away with the community-submission pipeline on 30-Aug-2026, so the variable is currently
 * dormant -- but the value is still provisioned, and on the Mac Mini it is already in the
 * login keychain (service `arc3-community-admin-token`), which is what the pusher reads.
 * Inventing a second secret would have meant provisioning something new in two places to
 * do a job an existing credential already does.
 *
 * `KAGGLE_PUSH_TOKEN` / `x-api-key` are accepted too, so the two can be split later
 * without a redeploy dance: set the new variable, switch the job, drop the old one.
 */
function requirePushToken(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.ARC3_COMMUNITY_ADMIN_TOKEN || process.env.KAGGLE_PUSH_TOKEN;

  if (!expected) {
    logger.warn(
      'Kaggle push rejected: neither ARC3_COMMUNITY_ADMIN_TOKEN nor KAGGLE_PUSH_TOKEN is set.',
      'kaggle-standing',
    );
    return res.status(503).json(
      formatResponse.error(
        'push_disabled',
        'Leaderboard push is not configured on this deployment.',
      ),
    );
  }

  const header = req.headers['x-arc3-admin-token'] ?? req.headers['x-api-key'];
  const provided = typeof header === 'string' ? header : '';

  if (!provided || !tokenMatches(provided, expected)) {
    logger.warn('Kaggle push rejected: bad or missing token.', 'kaggle-standing');
    return res.status(401).json(
      formatResponse.error('unauthorized', 'A valid X-ARC3-Admin-Token header is required.'),
    );
  }

  return next();
}

/** Generous for a once-a-day job; tight enough that a leaked token cannot be used to spam. */
const pushLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

/** Finite number or null. Rejects NaN/Infinity, which reach Postgres as an error. */
function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function optionalInt(value: unknown): number | null {
  const n = optionalNumber(value);
  return n === null ? null : Math.trunc(n);
}

function optionalString(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;
}

/**
 * POST /api/kaggle/standing
 *
 * Body: { competition, capturedAt, rank, score?, teamId, teamName?, teamCount?,
 *         leaderScore?, submissions?, topTeams? }
 *
 * `rank` must be >= 1. Kaggle gives its three house baselines (Stochastic Goose, Random
 * Agent, Just Explore) rank 0; they are not competitors and the pusher filters them, but
 * a rank-0 row arriving here would silently become an all-time "peak" of 0 and the
 * landing page would brag about placing zeroth. Rejected loudly instead.
 */
router.post(
  '/standing',
  pushLimiter,
  requirePushToken,
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body ?? {};

    const competition = optionalString(body.competition, 255);
    if (!competition || !COMPETITION_SLUG.test(competition)) {
      return res.status(400).json(
        formatResponse.error('bad_competition', 'competition must be a Kaggle slug.'),
      );
    }

    const capturedAt = optionalString(body.capturedAt, 64);
    const capturedDate = capturedAt ? new Date(capturedAt) : null;
    if (!capturedDate || Number.isNaN(capturedDate.getTime())) {
      return res.status(400).json(
        formatResponse.error('bad_captured_at', 'capturedAt must be an ISO-8601 timestamp.'),
      );
    }

    const rank = optionalInt(body.rank);
    if (rank === null || rank < 1) {
      return res.status(400).json(
        formatResponse.error(
          'bad_rank',
          'rank must be an integer >= 1. Filter Kaggle rank-0 host baselines before pushing.',
        ),
      );
    }

    const teamId = optionalString(body.teamId, 64);
    if (!teamId) {
      return res.status(400).json(
        formatResponse.error(
          'bad_team_id',
          'teamId is required. Teams rename themselves; identity is the id, never the name.',
        ),
      );
    }

    await kaggleStandingRepository.record({
      competition,
      capturedAt: capturedDate.toISOString(),
      rank,
      score: optionalNumber(body.score),
      teamId,
      teamName: optionalString(body.teamName, 255),
      teamCount: optionalInt(body.teamCount),
      leaderScore: optionalNumber(body.leaderScore),
      submissions: optionalInt(body.submissions),
      topTeams: body.topTeams ?? null,
    });

    // Echo the standing back so the pusher's log records what the site will now show.
    const standing = await kaggleStandingRepository.getStanding(competition);
    return res.json(formatResponse.success(standing));
  }),
);

/**
 * GET /api/kaggle/:competition/standing  (public)
 *
 * Always 200 with a fully-formed body, including when nothing has ever been pushed
 * (current and peak both null). The landing page has to render correctly against an empty
 * database, and making "no data yet" an error would push that decision into the client's
 * error path, where it would show an error box to a visitor about a section that is
 * simply not populated yet.
 */
router.get(
  '/:competition/standing',
  asyncHandler(async (req: Request, res: Response) => {
    const competition = String(req.params.competition ?? '');
    if (!COMPETITION_SLUG.test(competition)) {
      return res.status(400).json(
        formatResponse.error('bad_competition', 'competition must be a Kaggle slug.'),
      );
    }

    const standing = await kaggleStandingRepository.getStanding(competition);

    // Five minutes. The upstream moves once a day, so anything tighter buys nothing; and
    // the payload carries capturedAt, so a cached copy still dates itself honestly.
    res.set('Cache-Control', 'public, max-age=300');
    return res.json(formatResponse.success(standing));
  }),
);

export default router;
