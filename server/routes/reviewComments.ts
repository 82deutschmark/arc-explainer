/*
Author: Claude Opus 5.5 Medium
Date: 08-November-2026
PURPOSE: HTTP layer for shared review comments on special pages, mounted at /api/review-comments.
         Used by the review page client/public/specials/2026-11-06-arc3-solution-draft-review.html
         (script: client/public/specials/review-editor/review-editor.js).

           GET    /:doc                                  { document, threads } (open + resolved)
           POST   /:doc/threads                          new comment { author, body, anchor }
           POST   /:doc/threads/:id/replies              reply { author, body }
           PATCH  /:doc/threads/:id                      resolve or reopen { author, status }
           DELETE /:doc/threads/:id                      delete a comment { author }
           DELETE /:doc/threads/:id/replies/:replyId     delete one reply { author }
           POST   /:doc/import                           restore an exported backup { threads }

         OPEN ON PURPOSE: no sign-in, like a shared Google Doc link. The page is unlisted and
         noindex, writes are rate limited and size capped, only documents listed in
         services/reviewComments.ts REVIEW_DOCUMENTS exist, and a delete only hides a comment (its
         text stays in the log). The team Google sign-in was not used because not every reviewer
         is on its list and the task asked for no friction for Son.
SRP/DRY check: Pass -- HTTP only. Storage and validation in services/reviewComments.ts; responses
         via formatResponse and limits via express-rate-limit, as routes/specialsPublish.ts does.
*/

import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../middleware/asyncHandler';
import { formatResponse } from '../utils/responseFormatter';
import { logger } from '../utils/logger.js';
import {
  REVIEW_DOCUMENTS,
  ReviewInputError,
  ReviewNotFoundError,
  ReviewStorageFullError,
  addReply,
  createThread,
  deleteItem,
  importThreads,
  isReviewDocument,
  listThreads,
  reviewCommentsDir,
  setStatus,
} from '../services/reviewComments';

const router = Router();

const readLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 900, standardHeaders: true, legacyHeaders: false });
const writeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false });

router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('X-Robots-Tag', 'noindex');
  next();
});

type Handler = (root: string, doc: string, req: Request, res: Response) => Promise<unknown>;

/** Shared front half: storage configured, document known, errors mapped to plain messages. */
function handle(work: Handler) {
  return asyncHandler(async (req: Request, res: Response) => {
    const root = reviewCommentsDir();
    if (!root) {
      return res.status(503).json(formatResponse.error('storage_disabled', 'Shared comment storage is not configured on this server.'));
    }
    const doc = req.params.doc;
    if (!isReviewDocument(doc)) {
      return res.status(404).json(formatResponse.error('unknown_document', 'No review is open for that document.'));
    }
    try {
      return await work(root, doc, req, res);
    } catch (error) {
      if (error instanceof ReviewInputError) return res.status(400).json(formatResponse.error('bad_input', error.message));
      if (error instanceof ReviewNotFoundError) return res.status(404).json(formatResponse.error('not_found', error.message));
      if (error instanceof ReviewStorageFullError) return res.status(507).json(formatResponse.error('storage_full', error.message));
      throw error;
    }
  });
}

const body = (req: Request): Record<string, unknown> =>
  req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};

router.get('/:doc', readLimiter, handle(async (root, doc, _req, res) => {
  const threads = await listThreads(root, doc);
  return res.json(formatResponse.success({ document: { id: doc, ...REVIEW_DOCUMENTS[doc] }, threads }));
}));

router.post('/:doc/threads', writeLimiter, handle(async (root, doc, req, res) => {
  const thread = await createThread(root, doc, body(req));
  logger.info(`Review comment added on ${doc} by ${thread.author}`, 'review-comments');
  return res.status(201).json(formatResponse.success({ thread }));
}));

router.post('/:doc/threads/:id/replies', writeLimiter, handle(async (root, doc, req, res) => {
  const thread = await addReply(root, doc, req.params.id, body(req));
  return res.status(201).json(formatResponse.success({ thread }));
}));

router.patch('/:doc/threads/:id', writeLimiter, handle(async (root, doc, req, res) => {
  const thread = await setStatus(root, doc, req.params.id, body(req));
  return res.json(formatResponse.success({ thread }));
}));

router.delete('/:doc/threads/:id', writeLimiter, handle(async (root, doc, req, res) => {
  await deleteItem(root, doc, req.params.id, undefined, body(req));
  logger.info(`Review comment ${req.params.id} hidden on ${doc}`, 'review-comments');
  return res.json(formatResponse.success({ deleted: req.params.id }));
}));

router.delete('/:doc/threads/:id/replies/:replyId', writeLimiter, handle(async (root, doc, req, res) => {
  await deleteItem(root, doc, req.params.id, req.params.replyId, body(req));
  return res.json(formatResponse.success({ deleted: req.params.replyId }));
}));

router.post('/:doc/import', writeLimiter, handle(async (root, doc, req, res) => {
  const result = await importThreads(root, doc, body(req).threads);
  logger.info(`Review import on ${doc}: ${result.added} added, ${result.skipped} already there`, 'review-comments');
  return res.json(formatResponse.success(result));
}));

export default router;
