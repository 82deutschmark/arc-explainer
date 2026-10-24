/*
Author: Claude Opus 5.5
Date: 2026-10-21
PURPOSE: HTTP layer for the team-only ARC-AGI-2 eval runs and their reasoning traces (Son's ask,
         21-Oct-2026). These are OUR model-evaluation box runs (a model served on 4x L4, scored
         on a panel of ARC-AGI-2 public-eval outputs), not Kaggle submissions: the team reads
         each output's full reasoning to see where the model goes wrong. Mounted at /api/team
         beside routes/teamRuns.ts, and built the same way.

         TEAM ROUTES (the team sign-in cookie, middleware/teamSession.ts):
           GET  /arc2-evals                          every run's index fields, newest first
           GET  /arc2-evals/:key                     one run's document in full
           GET  /arc2-evals/:key/traces/:output      one output's trace (404 if none stored)

         MACHINE ROUTES (X-ARC2-Eval-Token, middleware/arc2EvalToken.ts; not the arc3 admin
         token), at most 600 writes an hour from one address:
           PUT    /arc2-evals/machine/runs/:key                  the run document (max 4 MB)
           PUT    /arc2-evals/machine/runs/:key/traces/:output   one output's trace (max 3 MB;
                                                                 the run must exist)
           DELETE /arc2-evals/machine/runs/:key                  the run and all its traces

         A run key is the publisher's own name for the run (lowercase letters, digits, dot,
         underscore, dash; up to 100). An output key is "<task id>_<test index>", e.g.
         7b5033c1_0. Documents are stored and served verbatim; this file checks only the few
         fields that tie a document to its address and its kind, so new fields from the
         publisher pass straight through to the pages.

         2026-10-21 (Claude Opus 5.5), the runs API: every internal ARC-2 run, not only scored
         panels. A version 2 document names its `kind`: accuracy (a panel scored output by
         output, `rows` plus traces), or speed / kernel / profile (`arms` compared side by side:
         each a unique name, an ok / failed / skipped status and numeric metrics). Version 1
         documents (the first eval box uploads, no kind) are still taken as accuracy runs.
           GET    /arc2-evals/machine/schema   the versions, kinds and limits this site takes
                                               (token-checked, writes nothing)
         The reference for publishers is docs/RUNS_API.md in the team's arc2026 repository.
SRP/DRY check: Pass - HTTP only. Storage in TeamEvalRepository, sign-in in teamSession.ts, the
         machine token in arc2EvalToken.ts, responses via formatResponse, limits via
         express-rate-limit, all as routes/teamRuns.ts does.
*/

import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../middleware/asyncHandler';
import { formatResponse } from '../utils/responseFormatter';
import { requireArc2EvalToken } from '../middleware/arc2EvalToken';
import { requireTeamSession } from '../middleware/teamSession';
import { teamEvalRepository } from '../repositories/TeamEvalRepository.js';

const router = Router();
const COMPETITION = 'arc-2';
/** The publisher's run names, e.g. arc2fnx-acc-t30-k340-1021. */
export const EVAL_RUN_KEY = /^[a-z0-9][a-z0-9._-]{0,99}$/;
/** "<8-hex ARC task id>_<test index>". */
export const EVAL_OUTPUT_KEY = /^[0-9a-f]{8}_[0-9]{1,2}$/;
/** A run document is config plus one short row per output; bigger is a bug upstream. */
export const MAX_RUN_BYTES = 4 * 1024 * 1024;
/** A trace is one output's grids plus up to ~65k tokens of reasoning. */
export const MAX_TRACE_BYTES = 3 * 1024 * 1024;
/** accuracy: one panel scored output by output. speed / kernel / profile: arms side by side. */
export const RUN_KINDS = ['accuracy', 'speed', 'kernel', 'profile'] as const;
export type RunKind = (typeof RUN_KINDS)[number];
/** 1: the first eval box documents (accuracy only, no kind field). 2: every kind, kind required. */
export const API_VERSIONS = [1, 2] as const;
/** Arms on one page; a bigger sweep reads better as several runs. */
export const MAX_ARMS = 64;
export const ARM_STATUSES = ['ok', 'failed', 'skipped'] as const;
const MAX_ARM_NAME = 80;

// One publish is a run document plus a trace per output (a few hundred writes at most), so this
// is twice the Kaggle runs record's 300 an hour. The schema check counts against it too.
const machineWriteLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 600, standardHeaders: true, legacyHeaders: false });

type JsonObject = Record<string, unknown>;
const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

type Refusal = { ok: false; status: number; code: string; message: string };
export type UploadCheck = { ok: true; body: string } | Refusal;
export type RunUploadCheck = { ok: true; body: string; kind: RunKind } | Refusal;

const refuse = (status: number, code: string, message: string): Refusal => ({ ok: false, status, code, message });
const reply = (res: Response, refusal: Refusal) =>
  res.status(refusal.status).json(formatResponse.error(refusal.code, refusal.message));
const BAD_KEY = refuse(400, 'bad_key', 'Run keys are 1-100 lowercase letters, digits, dots, underscores or dashes.');
const BAD_OUTPUT = refuse(400, 'bad_output', 'Output keys are an 8-hex task id, an underscore and the test index, e.g. 7b5033c1_0.');

const isMetric = (value: unknown) => value === null || (typeof value === 'number' && Number.isFinite(value));

/** Why these arms cannot be laid side by side on a run page, or null when they can. */
export function armsProblem(arms: unknown): string | null {
  if (!Array.isArray(arms) || arms.length === 0 || arms.length > MAX_ARMS) return `arms must be a list of 1 to ${MAX_ARMS} arms.`;
  const names = new Set<string>();
  for (const [i, arm] of arms.entries()) {
    if (!isObject(arm) || typeof arm.name !== 'string' || !arm.name.trim() || arm.name.length > MAX_ARM_NAME) {
      return `arms[${i}] needs a name of 1 to ${MAX_ARM_NAME} characters.`;
    }
    if (names.has(arm.name)) return `arms[${i}]: the name "${arm.name}" is used twice.`;
    names.add(arm.name);
    if (arm.status !== undefined && !(ARM_STATUSES as readonly unknown[]).includes(arm.status)) {
      return `arms[${i}].status must be one of ${ARM_STATUSES.join(', ')}.`;
    }
    // Metrics become the rows of the side-by-side table, so they must compare as numbers.
    if (arm.metrics !== undefined && arm.metrics !== null) {
      if (!isObject(arm.metrics)) return `arms[${i}].metrics must be an object of numbers.`;
      const bad = Object.entries(arm.metrics).find(([, value]) => !isMetric(value));
      if (bad) return `arms[${i}].metrics.${bad[0]} must be a number or null.`;
    }
  }
  return null;
}

/**
 * A run upload: the key must be well formed and the body this run's document, under 4 MB, of a
 * version and kind this site shows: an accuracy run carries its rows, the other kinds their arms.
 */
export function checkRunUpload(key: string, doc: unknown): RunUploadCheck {
  if (!EVAL_RUN_KEY.test(key)) return BAD_KEY;
  if (!isObject(doc) || doc.key !== key) {
    return refuse(400, 'bad_document', 'The body must be the run document for this key.');
  }
  const version = doc.apiVersion ?? 1;
  if (!(API_VERSIONS as readonly unknown[]).includes(version)) {
    return refuse(400, 'unsupported_version', `apiVersion must be one of ${API_VERSIONS.join(', ')}.`);
  }
  const kind = doc.kind ?? (version === 1 ? 'accuracy' : undefined);
  if (!(RUN_KINDS as readonly unknown[]).includes(kind)) {
    return refuse(400, 'bad_kind', `kind must be one of ${RUN_KINDS.join(', ')}.`);
  }
  if (version === 1 && kind !== 'accuracy') {
    return refuse(400, 'bad_kind', 'apiVersion 1 documents are accuracy runs; send apiVersion 2 for other kinds.');
  }
  if (kind === 'accuracy') {
    if (!Array.isArray(doc.rows)) return refuse(400, 'bad_document', 'An accuracy run needs a rows array, one row per output.');
  } else {
    const problem = armsProblem(doc.arms);
    if (problem) return refuse(400, 'bad_arms', problem);
  }
  const body = JSON.stringify(doc);
  if (Buffer.byteLength(body) > MAX_RUN_BYTES) return refuse(413, 'too_large', 'Run documents are capped at 4 MB.');
  return { ok: true, body, kind: kind as RunKind };
}

/** A trace upload: both keys well formed, the body this output's trace, under 3 MB. */
export function checkTraceUpload(key: string, output: string, doc: unknown): UploadCheck {
  if (!EVAL_RUN_KEY.test(key)) return BAD_KEY;
  if (!EVAL_OUTPUT_KEY.test(output)) return BAD_OUTPUT;
  if (!isObject(doc) || doc.key !== key || doc.outputKey !== output) {
    return refuse(400, 'bad_document', 'The body must be the trace for this run and output.');
  }
  const body = JSON.stringify(doc);
  if (Buffer.byteLength(body) > MAX_TRACE_BYTES) return refuse(413, 'too_large', 'Traces are capped at 3 MB.');
  return { ok: true, body };
}

const param = (req: Request, name: string) => String(req.params[name] ?? '');
const noDatabase = (res: Response) =>
  res.status(503).json(formatResponse.error('no_database', 'Eval runs need the database, which is not connected.'));

/** Stored bodies are JSON written by this file, so they go out as they are, without a re-parse. */
function sendDocument(res: Response, field: 'run' | 'trace', body: string) {
  res.type('application/json').send(`{"success":true,"data":{"${field}":${body}}}`);
}

// ── machine routes (declared first so "machine" is never read as a run key) ────────────────

/** Lets a publisher check its token and what this deployment takes before it sends anything. */
router.get(
  '/arc2-evals/machine/schema',
  machineWriteLimiter,
  requireArc2EvalToken,
  (_req: Request, res: Response) =>
    res.json(formatResponse.success({
      apiVersions: API_VERSIONS, kinds: RUN_KINDS, armStatuses: ARM_STATUSES, maxArms: MAX_ARMS,
      maxRunBytes: MAX_RUN_BYTES, maxTraceBytes: MAX_TRACE_BYTES, page: '/team/arc2-evals/<key>',
    })),
);

router.put(
  '/arc2-evals/machine/runs/:key',
  machineWriteLimiter,
  requireArc2EvalToken,
  asyncHandler(async (req: Request, res: Response) => {
    const key = param(req, 'key');
    const checked = checkRunUpload(key, req.body);
    if (!checked.ok) return reply(res, checked);
    if (!(await teamEvalRepository.upsertRun(COMPETITION, key, checked.body))) return noDatabase(res);
    return res.json(formatResponse.success({ key, kind: checked.kind, stored: true, page: `/team/arc2-evals/${key}` }));
  }),
);

router.put(
  '/arc2-evals/machine/runs/:key/traces/:output',
  machineWriteLimiter,
  requireArc2EvalToken,
  asyncHandler(async (req: Request, res: Response) => {
    const key = param(req, 'key');
    const output = param(req, 'output');
    const checked = checkTraceUpload(key, output, req.body);
    if (!checked.ok) return reply(res, checked);
    const result = await teamEvalRepository.upsertTrace(COMPETITION, key, output, checked.body);
    if (result === 'no_database') return noDatabase(res);
    if (result === 'no_run') {
      return res.status(404).json(formatResponse.error('not_found', 'No eval run with that key; publish the run document first.'));
    }
    return res.json(formatResponse.success({ key, output, stored: true }));
  }),
);

router.delete(
  '/arc2-evals/machine/runs/:key',
  machineWriteLimiter,
  requireArc2EvalToken,
  asyncHandler(async (req: Request, res: Response) => {
    const key = param(req, 'key');
    if (!EVAL_RUN_KEY.test(key)) return reply(res, BAD_KEY);
    const removed = await teamEvalRepository.deleteRun(COMPETITION, key);
    if (!removed) return noDatabase(res);
    return res.json(formatResponse.success({ key, deleted: removed.run, traces: removed.traces }));
  }),
);

// ── team routes ─────────────────────────────────────────────────────────────────────────

router.get(
  '/arc2-evals',
  requireTeamSession,
  asyncHandler(async (_req: Request, res: Response) => {
    res.json(formatResponse.success({ runs: await teamEvalRepository.listRuns(COMPETITION) }));
  }),
);

router.get(
  '/arc2-evals/:key',
  requireTeamSession,
  asyncHandler(async (req: Request, res: Response) => {
    const key = param(req, 'key');
    if (!EVAL_RUN_KEY.test(key)) return reply(res, BAD_KEY);
    const body = await teamEvalRepository.getRun(COMPETITION, key);
    if (!body) return res.status(404).json(formatResponse.error('not_found', 'No eval run with that key.'));
    return sendDocument(res, 'run', body);
  }),
);

router.get(
  '/arc2-evals/:key/traces/:output',
  requireTeamSession,
  asyncHandler(async (req: Request, res: Response) => {
    const key = param(req, 'key');
    const output = param(req, 'output');
    if (!EVAL_RUN_KEY.test(key)) return reply(res, BAD_KEY);
    if (!EVAL_OUTPUT_KEY.test(output)) return reply(res, BAD_OUTPUT);
    const body = await teamEvalRepository.getTrace(COMPETITION, key, output);
    if (!body) return res.status(404).json(formatResponse.error('not_found', 'No trace stored for that output.'));
    return sendDocument(res, 'trace', body);
  }),
);

export default router;
