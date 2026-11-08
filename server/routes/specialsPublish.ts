/*
Author: Claude Opus 5.5 Low
Date: 07-November-2026
PURPOSE: HTTP layer for fast special-page publishing, so an edit to a /specials/ page (the
         Turducken write-up first) goes live in seconds instead of after a full Railway build.

           PUT    /api/specials/file?path=<relative path under /specials/>   body = raw file bytes
           DELETE /api/specials/file?path=<...>   drop the overlay copy, the baked file shows again

         The body is read raw (application/octet-stream) by a parser scoped to this router, so
         PNGs arrive byte for byte. The global express.json parser would swallow a JSON-typed
         body first; a non-raw body is therefore refused with 415 rather than guessed at.
         Guarded by the shared arc3 admin token (X-ARC3-Admin-Token), closed when unset.
         Storage, path safety and the per-deployment lifetime: services/specialsOverlay.ts.
         Publisher script: tools/specials-publish/publish_specials.py.
SRP/DRY check: Pass -- HTTP only; token check reuses middleware/arc3AdminToken.ts, responses
         use formatResponse, rate limiting follows routes/teamRuns.ts.
*/

import express, { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { createHash } from 'node:crypto';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireArc3AdminToken } from '../middleware/arc3AdminToken';
import { formatResponse } from '../utils/responseFormatter';
import { logger } from '../utils/logger.js';
import {
  overlayDir,
  removeOverlayFile,
  resolveSpecialPath,
  writeOverlayFile,
  SPECIALS_MAX_FILE_BYTES,
} from '../services/specialsOverlay';

const router = Router();

const writeLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 600, standardHeaders: true, legacyHeaders: false });

router.use(writeLimiter);
router.use(requireArc3AdminToken({
  label: 'Specials publish',
  logContext: 'specials-publish',
  disabledCode: 'publish_disabled',
}));
router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

/** Shared front half of both handlers: overlay on, path safe. Sends the error itself and returns null on failure. */
function targetFor(req: Request, res: Response): { target: string; relative: string } | null {
  const root = overlayDir();
  if (!root) {
    res.status(503).json(formatResponse.error('overlay_disabled', 'No persistent volume is configured on this deployment.'));
    return null;
  }
  const relative = req.query.path;
  const target = resolveSpecialPath(root, relative);
  if (!target) {
    res.status(400).json(formatResponse.error('bad_path', 'path must be a plain relative path under /specials/ with an allowed extension.'));
    return null;
  }
  return { target, relative: relative as string };
}

router.put(
  '/file',
  express.raw({ type: () => true, limit: SPECIALS_MAX_FILE_BYTES }),
  asyncHandler(async (req: Request, res: Response) => {
    const resolved = targetFor(req, res);
    if (!resolved) return;
    if (!Buffer.isBuffer(req.body)) {
      return res.status(415).json(formatResponse.error('bad_body', 'Send the file as application/octet-stream.'));
    }
    if (req.body.length === 0) {
      return res.status(400).json(formatResponse.error('empty_body', 'Refusing to publish an empty file.'));
    }
    await writeOverlayFile(resolved.target, req.body);
    const sha256 = createHash('sha256').update(req.body).digest('hex');
    logger.info(`Specials overlay wrote ${resolved.relative} (${req.body.length} bytes)`, 'specials-publish');
    return res.json(formatResponse.success({
      path: resolved.relative,
      url: `/specials/${resolved.relative}`,
      bytes: req.body.length,
      sha256,
    }));
  }),
);

router.delete(
  '/file',
  asyncHandler(async (req: Request, res: Response) => {
    const resolved = targetFor(req, res);
    if (!resolved) return;
    const removed = await removeOverlayFile(resolved.target);
    logger.info(`Specials overlay ${removed ? 'removed' : 'had no'} ${resolved.relative}`, 'specials-publish');
    return res.json(formatResponse.success({ path: resolved.relative, removed }));
  }),
);

export default router;
