/*
Author: Claude Opus 5.5 Low
Date: 2026-10-19
PURPOSE: HTTP layer for the team-only ARC-AGI-2 runs record (Son's ask, built on the Boss's
         call to keep it on ARC Explainer behind a team login, 19-Oct-2026). Mounted at
         /api/team.

         SIGN-IN is Google, like the AutoResearchArena (routes/teamAuth.ts at /api/auth, the
         session check in middleware/teamSession.ts). A note records who saved it from the
         signed-in Google account, not from anything the browser sends.

         TEAM ROUTES (cookie required):
           GET  /arc2-runs             every run, newest first, without the bulky parts
           GET  /arc2-runs/:key        one run in full, with its team note
           POST /arc2-runs/:key/note   set the baseline it is judged against and a short note

         MACHINE ROUTES (the existing arc3 admin token, as the leaderboard push uses):
           PUT  /arc2-runs/machine/runs/:key   the Mac Mini publishes one run's document
           GET  /arc2-runs/machine/notes       the Mini reads the team's notes back, so a
                                               changed baseline gets a fresh Claude note

         A run key is the Kaggle submission number. The run documents' shape is set by the
         Mini's watcher (scripts/arc2_runs/arc2_runs.py); this file only checks the few fields
         it reads.
SRP/DRY check: Pass - HTTP only. Storage in TeamRunRepository, sign-in in teamSession.ts,
         machine auth via requireArc3AdminToken, responses via formatResponse, limits via
         express-rate-limit, all as the Kaggle board routes do.
*/

import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../middleware/asyncHandler';
import { formatResponse } from '../utils/responseFormatter';
import { requireArc3AdminToken } from '../middleware/arc3AdminToken';
import { requireTeamSession, type TeamUser } from '../middleware/teamSession';
import { teamRunRepository } from '../repositories/TeamRunRepository.js';

const router = Router();
const COMPETITION = 'arc-2';
/** Kaggle submission numbers. */
const RUN_KEY = /^[0-9]{1,15}$/;
/** A run document carries a log excerpt and a code diff; anything bigger is a bug upstream. */
const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024;
/** Fields the index needs. The log and the code diff stay on the run page. */
const INDEX_FIELDS = [
  'key', 'submittedAt', 'submittedBy', 'who', 'description', 'status', 'publicScore', 'kernel',
  'proposedBaseline', 'output', 'publishedAt',
] as const;

const writeLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false });

const requireMachineToken = requireArc3AdminToken({
  label: 'Team runs publish',
  logContext: 'team-runs',
  disabledCode: 'publish_disabled',
});

type JsonObject = Record<string, unknown>;
const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function parse(body: string): JsonObject | null {
  try {
    const value = JSON.parse(body);
    return isObject(value) ? value : null;
  } catch {
    return null;
  }
}

function optionalText(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;
}

// ── machine routes (declared before /:key so "machine" is never read as a run key) ─────────

router.put(
  '/arc2-runs/machine/runs/:key',
  writeLimiter,
  requireMachineToken,
  asyncHandler(async (req: Request, res: Response) => {
    const key = String(req.params.key ?? '');
    if (!RUN_KEY.test(key)) return res.status(400).json(formatResponse.error('bad_key', 'Run keys are Kaggle submission numbers.'));
    const doc = req.body;
    if (!isObject(doc) || doc.key !== key) {
      return res.status(400).json(formatResponse.error('bad_document', 'The body must be the run document for this key.'));
    }
    const body = JSON.stringify(doc);
    if (Buffer.byteLength(body) > MAX_DOCUMENT_BYTES) {
      return res.status(413).json(formatResponse.error('too_large', 'Run documents are capped at 4 MB.'));
    }
    const stored = await teamRunRepository.saveDocument(COMPETITION, key, body);
    return res.json(formatResponse.success({ key, stored }));
  }),
);

router.get(
  '/arc2-runs/machine/notes',
  requireMachineToken,
  asyncHandler(async (_req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');
    res.json(formatResponse.success({ notes: await teamRunRepository.listNotes(COMPETITION) }));
  }),
);

// ── team routes ─────────────────────────────────────────────────────────────────────────

router.get(
  '/arc2-runs',
  requireTeamSession,
  asyncHandler(async (_req: Request, res: Response) => {
    const [docs, notes] = await Promise.all([
      teamRunRepository.listDocuments(COMPETITION),
      teamRunRepository.listNotes(COMPETITION),
    ]);
    const runs = docs
      .map(({ runKey, body }) => {
        const doc = parse(body);
        if (!doc) return null;
        const row: JsonObject = Object.fromEntries(INDEX_FIELDS.map((f) => [f, doc[f] ?? null]));
        const summary = isObject(doc.summary) ? doc.summary : null;
        // The note's text rides along so the list can show its verdict and search it; notes are short.
        row.summary = summary
          ? { state: summary.state ?? null, baselineKey: summary.baselineKey ?? null, markdown: summary.markdown ?? null }
          : null;
        row.note = notes[runKey] ?? null;
        return row;
      })
      .filter((row): row is JsonObject => row !== null)
      .sort((a, b) => String(b.submittedAt ?? '').localeCompare(String(a.submittedAt ?? '')));
    res.json(formatResponse.success({ runs }));
  }),
);

router.get(
  '/arc2-runs/:key',
  requireTeamSession,
  asyncHandler(async (req: Request, res: Response) => {
    const key = String(req.params.key ?? '');
    if (!RUN_KEY.test(key)) return res.status(400).json(formatResponse.error('bad_key', 'Run keys are Kaggle submission numbers.'));
    const [body, note] = await Promise.all([
      teamRunRepository.getDocument(COMPETITION, key),
      teamRunRepository.getNote(COMPETITION, key),
    ]);
    const doc = body ? parse(body) : null;
    if (!doc) return res.status(404).json(formatResponse.error('not_found', 'No run with that key.'));
    res.json(formatResponse.success({ run: doc, note }));
  }),
);

router.post(
  '/arc2-runs/:key/note',
  writeLimiter,
  requireTeamSession,
  asyncHandler(async (req: Request, res: Response) => {
    const key = String(req.params.key ?? '');
    if (!RUN_KEY.test(key)) return res.status(400).json(formatResponse.error('bad_key', 'Run keys are Kaggle submission numbers.'));
    const body = isObject(req.body) ? req.body : {};
    // Baseline: another run's key, "none", or empty to go back to the watcher's guess.
    const baseline = optionalText(body.baseline, 64);
    if (baseline !== null && baseline !== 'none' && (!RUN_KEY.test(baseline) || baseline === key)) {
      return res.status(400).json(formatResponse.error('bad_baseline', 'The baseline must be another run, or none.'));
    }
    if (baseline !== null && baseline !== 'none' && !(await teamRunRepository.getDocument(COMPETITION, baseline))) {
      return res.status(400).json(formatResponse.error('bad_baseline', 'There is no run with that key to compare against.'));
    }
    const note = await teamRunRepository.saveNote(COMPETITION, key, {
      baseline,
      note: optionalText(body.note, 2000),
      updatedBy: (res.locals.teamUser as TeamUser).name.slice(0, 80),
    });
    if (!note) return res.status(503).json(formatResponse.error('no_database', 'Notes need the database, which is not connected.'));
    res.json(formatResponse.success({ note }));
  }),
);

export default router;
