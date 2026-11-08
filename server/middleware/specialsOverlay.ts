/*
Author: Claude Opus 5.5 Low
Date: 07-November-2026
PURPOSE: Read side of fast special-page publishing. Mounted at /specials just ahead of the
         dist/public static handler in server/index.ts: when a file was pushed through
         PUT /api/specials/file during this deployment, serve that copy with
         Cache-Control: no-cache so the next page load shows the edit; otherwise call next() and
         the baked-in file (or the SPA fallback) answers exactly as before.
SRP/DRY check: Pass -- serving only. Path rules and the overlay location come from
         services/specialsOverlay.ts, the same functions the write route uses.
*/

import type { NextFunction, Request, Response } from 'express';
import fs from 'node:fs';
import { overlayDir, resolveSpecialPath } from '../services/specialsOverlay';

export function specialsOverlay(req: Request, res: Response, next: NextFunction): void {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  const root = overlayDir();
  if (!root) return next();

  let relative: string;
  try {
    relative = decodeURIComponent(req.path).replace(/^\//, '');
  } catch {
    return next();
  }
  const target = resolveSpecialPath(root, relative);
  if (!target) return next();

  fs.stat(target, (error, stats) => {
    if (error || !stats.isFile()) return next();
    res.sendFile(target, { cacheControl: false, headers: { 'Cache-Control': 'no-cache', 'X-Specials-Source': 'overlay' } }, (sendError) => {
      if (sendError && !res.headersSent) next();
    });
  });
}
