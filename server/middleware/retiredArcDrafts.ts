/**
 * Author: GPT-6.1 Sol
 * Date: 11-November-2026
 * PURPOSE: Retire removed ARC essay/technical draft URLs before overlay, static and SPA
 * serving. The manifest records deleted public files; shared evidence/assets remain live.
 * Also retires the draft's comments API so quoted draft text cannot remain public there.
 * SRP/DRY check: Pass — one deletion manifest, one early HTTP retirement policy.
 */
import type { Request, Response, NextFunction } from 'express';
import retiredFiles from '../data/retiredArcDrafts.json';

const retiredPaths = new Set(retiredFiles.map(file => `/specials/${file}`.toLowerCase()));
const retiredReview = '/api/review-comments/turducken-2026-11-06';

export function retiredArcDrafts(req: Request, res: Response, next: NextFunction): void {
  let requestPath: string;
  try {
    requestPath = decodeURIComponent(req.path).replace(/\/{2,}/g, '/').replace(/\/$/, '').toLowerCase();
  } catch {
    return next();
  }
  if (!retiredPaths.has(requestPath) && requestPath !== retiredReview && !requestPath.startsWith(`${retiredReview}/`)) {
    return next();
  }
  // A genuine Gone response lets crawlers drop old results; robots.txt must not block recrawls.
  res.status(410).set({ 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' })
    .type('text/plain').send('This draft has been removed.');
}
