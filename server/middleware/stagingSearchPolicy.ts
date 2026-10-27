/**
 * Author: GPT-6 / Codex
 * Date: 2026-10-27
 * PURPOSE: Keep the independently deployed staging hostname out of public search results.
 * SRP/DRY check: Pass — one response header covers HTML, static files and existing routes.
 */
import type { Request, Response, NextFunction } from 'express';
export function stagingSearchPolicy(req: Request, res: Response, next: NextFunction): void {
  if ((req.get('host') || '').split(':')[0].toLowerCase() === 'arc-explainer-staging.up.railway.app') {
    res.set('X-Robots-Tag', 'noindex, nofollow');
  }
  next();
}
