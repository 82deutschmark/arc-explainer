/*
Author: Claude Opus 5.5
Date: 2026-10-21
PURPOSE: The machine credential for publishing ARC-AGI-2 evaluation runs and their reasoning
         traces (routes/teamEvals.ts). Our model-evaluation box (a model served on 4x L4, scored
         on a panel of ARC-AGI-2 public-eval outputs) uploads with it. Son's ask, 21-Oct-2026.

         THE CREDENTIAL. `ARC2_EVAL_UPLOAD_TOKEN`, sent as the `X-ARC2-Eval-Token` header. It is
         deliberately its own secret, not the arc3 admin token the Mac Mini uses for the Kaggle
         runs record (middleware/arc3AdminToken.ts): the eval box is a rented GPU machine, and a
         leaked copy of its token should only ever let someone write eval runs, never touch the
         Kaggle board or the arc3 dataset. Rotating it signs out nothing else.

         CLOSED BY DEFAULT, like arc3AdminToken.ts: with no token configured, or one shorter
         than 32 characters (a guessable value is treated as no value), every upload answers 503
         `eval_uploads_not_configured`. A wrong or missing header answers 401.
SRP/DRY check: Pass - token checking only. The constant-time compare is tokenMatches from
         arc3AdminToken.ts; responses via formatResponse; logs via the shared logger.
*/

import type { Request, Response, NextFunction } from 'express';
import { tokenMatches } from './arc3AdminToken';
import { formatResponse } from '../utils/responseFormatter';
import { logger } from '../utils/logger.js';

export const ARC2_EVAL_TOKEN_ENV = 'ARC2_EVAL_UPLOAD_TOKEN';
/** Express lowercases header names. */
export const ARC2_EVAL_TOKEN_HEADER = 'x-arc2-eval-token';
export const MIN_EVAL_TOKEN_LENGTH = 32;

/** The configured upload token, or null when it is unset or too short to be a real secret. */
export function evalUploadToken(): string | null {
  const value = process.env[ARC2_EVAL_TOKEN_ENV]?.trim();
  return value && value.length >= MIN_EVAL_TOKEN_LENGTH ? value : null;
}

/** Express middleware: 503 when no usable secret is configured, 401 on a missing or wrong token. */
export function requireArc2EvalToken(req: Request, res: Response, next: NextFunction) {
  const expected = evalUploadToken();
  if (!expected) {
    logger.warn(`ARC-2 eval upload rejected: ${ARC2_EVAL_TOKEN_ENV} is unset or shorter than ${MIN_EVAL_TOKEN_LENGTH} characters.`, 'team-evals');
    return res
      .status(503)
      .json(formatResponse.error('eval_uploads_not_configured', 'ARC-2 eval uploads are not configured on this deployment.'));
  }
  const header = req.headers[ARC2_EVAL_TOKEN_HEADER];
  const provided = typeof header === 'string' ? header.trim() : '';
  if (!provided || !tokenMatches(provided, expected)) {
    logger.warn('ARC-2 eval upload rejected: bad or missing token.', 'team-evals');
    return res
      .status(401)
      .json(formatResponse.error('unauthorized', 'A valid X-ARC2-Eval-Token header is required.'));
  }
  return next();
}
