/**
 * Author: GPT-6 / Codex
 * Date: 2026-10-22
 * PURPOSE: Serve the unlisted notebook at a memorable address, preserving older links. Publishing
 *          uses the existing machine admin token. No private document enters Git or assets.
 * SRP/DRY check: Pass - shared validation, existing authentication, separate repository.
 */
import { timingSafeEqual } from 'node:crypto';
import { Router, json, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { requireTeamSession } from '../middleware/teamSession';
import { requireArc3AdminToken } from '../middleware/arc3AdminToken';
import { asyncHandler } from '../middleware/asyncHandler';
import { formatResponse } from '../utils/responseFormatter';
import { teamGuideRepository } from '../repositories/TeamGuideRepository';
import { summitGuideSchema } from '../../shared/summitGuide';

const router = Router();
const key = 'summit-2026';
export const summitPublisherGuard = requireArc3AdminToken({ label: 'Private guide publication', logContext: 'team-guide' });

router.get('/summit-2026', requireTeamSession, asyncHandler(async (_req: Request, res: Response) => {
  const document = await teamGuideRepository.get(key);
  res.set('X-Robots-Tag', 'noindex, nofollow');
  if (!document) return res.status(404).json(formatResponse.error('guide_unavailable', 'The conversation guide has not been published yet.'));
  return res.type('json').send(JSON.stringify(formatResponse.success(JSON.parse(document))));
}));

// A memorable unlisted address, as requested; reading needs no account or token.
router.get('/notes1023', asyncHandler(async (_req: Request, res: Response) => {
  res.set({ 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' });
  const document = await teamGuideRepository.get(key);
  if (!document) return res.status(404).json(formatResponse.error('guide_unavailable', 'The guide has not been published yet.'));
  return res.type('json').send(JSON.stringify(formatResponse.success(JSON.parse(document))));
}));

// Possession of the unlisted URL grants reading; no account or sign-in is needed.
router.get('/shared/summit-2026/:shareKey', asyncHandler(async (req: Request, res: Response) => {
  res.set({ 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' });
  const supplied = String(req.params.shareKey);
  const expected = /^[A-Za-z0-9_-]{43}$/.test(supplied) ? await teamGuideRepository.get(key + '-share-key') : null;
  if (!expected || expected.length !== supplied.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) {
    return res.status(404).json(formatResponse.error('guide_unavailable', 'This share link is unavailable.'));
  }
  const document = await teamGuideRepository.get(key);
  if (!document) return res.status(404).json(formatResponse.error('guide_unavailable', 'The guide has not been published yet.'));
  return res.type('json').send(JSON.stringify(formatResponse.success(JSON.parse(document))));
}));

router.put('/machine/summit-2026', summitPublisherGuard,
  rateLimit({ windowMs: 60_000, max: 20, standardHeaders: true, legacyHeaders: false }),
  json({ limit: '512kb' }), asyncHandler(async (req: Request, res: Response) => {
    // A parent JSON parser may already have run; enforce the size even in that case.
    if (Buffer.byteLength(JSON.stringify(req.body) ?? '') > 512 * 1024) return res.status(413).json(formatResponse.error('guide_too_large', 'The guide must be under 512 KB.'));
    const checked = summitGuideSchema.safeParse(req.body);
    if (!checked.success) return res.status(400).json(formatResponse.error('invalid_guide', checked.error.issues.map(issue => issue.path.join('.') + ': ' + issue.message).join('; ')));
    const stored = await teamGuideRepository.put(key, JSON.stringify(checked.data));
    res.set('Cache-Control', 'private, no-store');
    if (!stored) return res.status(503).json(formatResponse.error('database_unavailable', 'The guide could not be saved.'));
    return res.json(formatResponse.success({ published: true, people: checked.data.people.length, sharePath: '/notes1023' }));
  }));
export default router;
