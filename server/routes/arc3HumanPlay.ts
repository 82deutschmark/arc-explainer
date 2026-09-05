/*
Author: Claude Opus 5
Date: 2026-09-01
PURPOSE: Anonymous human-play telemetry for the ARC-AGI-3 play surface -- the reason
         arc3.markbarney.net exists. Extracted verbatim (behaviour unchanged) from
         routes/arc3Community.ts when the DB-backed community catalog was removed in
         favour of mirroring arc3.sonpham.net: the catalog was months stale and is no
         longer ours to own, but the telemetry pipeline is this site's whole job and
         had no reason to die with it.

         Accepts, per event, the harness action plus its click coordinates (ACTION6
         only), the level, the score, and t_ms. Browser visibility markers arrive on the
         same stream with an action outside the harness action space, so an idle gap can
         be told apart from a long think without either one counting as a move.

         Both routes are deliberately public and unauthenticated. A login wall would
         kill the sample, and we collect no identifying data -- a browser-minted session
         GUID, a coarse UA family, a viewport string, and the action stream.
         Dependencies: HumanPlayRepository (owns its own tables, created lazily).
SRP/DRY check: Pass -- HTTP layer only; all persistence stays in HumanPlayRepository,
         which is untouched by the catalog removal.
*/

import { Router, type Request, type Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { formatResponse } from '../utils/responseFormatter';
import { HumanPlayRepository } from '../repositories/HumanPlayRepository.js';
import rateLimit from 'express-rate-limit';
import {
  Arc3FeedbackRepository,
  FEEDBACK_FLAGS,
  MAX_NOTE_LENGTH,
} from '../repositories/Arc3FeedbackRepository.js';
import { Arc3Promotion } from '../services/arc3Mirror/Arc3Promotion.js';

const router = Router();

const SESSION_GUID = /^[A-Za-z0-9_-]{8,64}$/;
const GAME_ID = /^[A-Za-z0-9_.-]{1,64}$/;
/** Short hex from Arc3MirrorCatalog.sourceVersionOf. Anything else is stored as null
 *  rather than rejected: a stamp we cannot trust is worse than no stamp, and failing the
 *  write would lose the player's note over a field they did not type. */
const SOURCE_VERSION = /^[0-9a-f]{6,64}$/;

function cleanSourceVersion(value: unknown): string | null {
  const v = typeof value === 'string' ? value : '';
  return SOURCE_VERSION.test(v) ? v : null;
}

/**
 * A click coordinate, or null. Grids are small, but this is a public unauthenticated
 * write: a value outside SMALLINT would throw from the driver and lose the entire batch,
 * so out-of-range is stored as null rather than allowed to reach the insert.
 */
function clampCoord(value: unknown): number | null {
  if (!Number.isFinite(value)) return null;
  const n = Math.trunc(Number(value));
  return n >= -32768 && n <= 32767 ? n : null;
}

/**
 * POST /api/arc3-play/human-events
 * A batch of anonymous play events.
 *
 * The play page runs the game client-side in Pyodide, so actions never reach the server
 * -- per-action server logging would record almost nothing. Events are batched in the
 * browser and posted here instead.
 */
router.post(
  '/human-events',
  asyncHandler(async (req: Request, res: Response) => {
    const sessionGuid = String(req.body?.sessionGuid ?? '');
    if (!SESSION_GUID.test(sessionGuid)) {
      return res.status(400).json(formatResponse.error('BAD_SESSION', 'Invalid sessionGuid'));
    }
    const gameId = String(req.body?.gameId ?? '');
    if (!GAME_ID.test(gameId)) {
      return res.status(400).json(formatResponse.error('BAD_GAME_ID', 'Invalid gameId'));
    }
    const events = Array.isArray(req.body?.events) ? req.body.events.slice(0, 500) : [];
    if (events.length === 0) {
      return res.json(formatResponse.success({ written: 0 }));
    }

    // The session is created from the batch: the browser mints the GUID because it runs
    // the game, and it is the only party that knows whether this is a blind first play.
    await HumanPlayRepository.ensureSession(
      sessionGuid, gameId,
      req.body?.isFirstSession === true,
      typeof req.body?.uaFamily === 'string' ? req.body.uaFamily : '',
      typeof req.body?.viewport === 'string' ? req.body.viewport : '',
      cleanSourceVersion(req.body?.sourceVersion),
    );

    let written = 0;
    for (const raw of events) {
      if (!raw || typeof raw !== 'object') continue;
      const action = String(raw.action ?? '').slice(0, 16);
      if (!action) continue;
      await HumanPlayRepository.recordEvent({
        sessionGuid,
        seq: Number.isFinite(raw.seq) ? Number(raw.seq) : written,
        action,
        actionInt: HumanPlayRepository.actionInt(action),
        level: Number.isFinite(raw.level) ? Number(raw.level) : null,
        levelActions: Number.isFinite(raw.level_actions) ? Number(raw.level_actions) : null,
        // Was `raw.level`, which stored a second copy of the level under the name
        // `score` and left the real score unrecorded. The client now sends both.
        score: Number.isFinite(raw.score) ? Number(raw.score) : null,
        state: typeof raw.state === 'string' ? raw.state.slice(0, 32) : null,
        tMs: Number.isFinite(raw.t_ms) ? Number(raw.t_ms) : null,
        // Click target, present on ACTION6 only. Clamped to SMALLINT range so a client
        // sending nonsense cannot fail the insert for the whole batch.
        x: clampCoord(raw.x),
        y: clampCoord(raw.y),
      });
      written += 1;
    }
    return res.json(formatResponse.success({ written }));
  }),
);

/**
 * GET /api/arc3-play/human-stats
 * First-blind-attempt aggregates, the human half of the human-vs-agent gap.
 * Aggregates only -- never raw event streams.
 */
router.get(
  '/human-stats',
  asyncHandler(async (req: Request, res: Response) => {
    const gameId = typeof req.query.game === 'string' ? req.query.game : undefined;
    if (gameId && !GAME_ID.test(gameId)) {
      return res.status(400).json(formatResponse.error('BAD_GAME_ID', 'Invalid game id'));
    }
    return res.json(formatResponse.success(await HumanPlayRepository.stats(gameId)));
  }),
);

/**
 * A public unauthenticated write that stores free text, so it is the one endpoint here
 * worth rate limiting. Generous enough that a person filling the form on several tasks in
 * a sitting never notices, tight enough that it is not a place to dump text from.
 */
const feedbackLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'RATE_LIMITED', message: 'Too many submissions, try again shortly' },
});

/**
 * POST /api/arc3-play/feedback
 * One player's verdict on one task: a closed set of checkboxes and an optional note.
 *
 * Public and anonymous, like the event stream — a login wall would kill the sample, and
 * this is the qualitative half of deciding which generated tasks to keep.
 *
 * Answers 200 on a storage failure. The player has already written their note; failing
 * the request would lose it either way and only adds an error message they cannot act on.
 */
router.post(
  '/feedback',
  feedbackLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const sessionGuid = String(req.body?.sessionGuid ?? '');
    if (!SESSION_GUID.test(sessionGuid)) {
      return res.status(400).json(formatResponse.error('BAD_SESSION', 'Invalid sessionGuid'));
    }
    const gameId = String(req.body?.gameId ?? '');
    if (!GAME_ID.test(gameId)) {
      return res.status(400).json(formatResponse.error('BAD_GAME_ID', 'Invalid gameId'));
    }

    // Unknown flags are dropped rather than rejected: a client one deploy behind should
    // still have its note and its recognised boxes stored.
    const rawFlags = Array.isArray(req.body?.flags) ? req.body.flags : [];
    const flags = rawFlags
      .map((f: unknown) => String(f))
      .filter((f: string) => (FEEDBACK_FLAGS as readonly string[]).includes(f));

    const note = typeof req.body?.note === 'string' ? req.body.note.slice(0, MAX_NOTE_LENGTH) : '';
    const reachedLevel = Number.isFinite(req.body?.reachedLevel) ? Number(req.body.reachedLevel) : null;
    const outcome = typeof req.body?.outcome === 'string' ? req.body.outcome.slice(0, 32) : null;

    const stored = await Arc3FeedbackRepository.record({
      sessionGuid, gameId, flags, note, reachedLevel, outcome,
      sourceVersion: cleanSourceVersion(req.body?.sourceVersion),
    });
    return res.json(formatResponse.success({ stored }));
  }),
);

/**
 * GET /api/arc3-play/feedback-summary
 * Per-task flag counts, for deciding what to cull. Counts only — never note text, which
 * would hand a mechanic to anyone who read it. Notes are read with SQL.
 */
router.get(
  '/feedback-summary',
  asyncHandler(async (req: Request, res: Response) => {
    const gameId = typeof req.query.game === 'string' ? req.query.game : undefined;
    if (gameId && !GAME_ID.test(gameId)) {
      return res.status(400).json(formatResponse.error('BAD_GAME_ID', 'Invalid game id'));
    }
    return res.json(formatResponse.success(await Arc3FeedbackRepository.getSummary(gameId)));
  }),
);

/**
 * GET /api/arc3-play/promoted
 * Which games a human has validated, on which build, and why the rest did not clear.
 *
 * The selection signal for the training side, which until now had none: the agent trained
 * on whatever games were in a run rather than on games somebody confirmed were fair.
 *
 * Public and unauthenticated like the rest of this surface, and counts only -- the rule,
 * the numbers behind each decision, and the reasons. Never note text.
 *
 * Advisory. It returns every candidate and its verdict, not a filtered corpus; the caller
 * decides what to do. An empty `promoted` list is a real answer and the expected one until
 * the current builds have been played.
 */
router.get(
  '/promoted',
  asyncHandler(async (req: Request, res: Response) => {
    const gameId = typeof req.query.game === 'string' ? req.query.game : undefined;
    if (gameId && !GAME_ID.test(gameId)) {
      return res.status(400).json(formatResponse.error('BAD_GAME_ID', 'Invalid game id'));
    }
    return res.json(formatResponse.success(await Arc3Promotion.list(gameId)));
  }),
);

export default router;
