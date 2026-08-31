/*
Author: Claude Opus 5
Date: 2026-08-30
PURPOSE: Public, unauthenticated HTTP surface for the mirrored ARC-AGI-3 game catalog.
         Replaces the DB-backed community catalog, which had drifted months out of date
         against arc3.sonpham.net (66 rows covering ~40 games, versus 300 upstream) and
         which is no longer ours to own -- sonpham-org/arc3 is the source of truth.

         GET /games/:gameId/source deliberately returns the SAME {sourceCode, className}
         shape the previous catalog served, because client/src/hooks/usePyodideGame.ts
         reads exactly those two fields. Preserving the contract means the Pyodide runtime
         and the human-play telemetry keep working untouched while the store behind them
         is swapped out.

         No auth on any route here: a login wall would kill the sample, and collecting an
         anonymous human baseline is the entire purpose of this surface.
         Dependencies: Arc3MirrorCatalog (fetch + strip + cache).
SRP/DRY check: Pass -- HTTP layer only; all catalog behaviour lives in the service, and
         responses use the shared formatResponse helper.
*/

import { Router, type Request, type Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { formatResponse } from '../utils/responseFormatter';
import { Arc3MirrorCatalog } from '../services/arc3Mirror/Arc3MirrorCatalog';
import { Arc3MirrorThumbnails } from '../services/arc3Mirror/Arc3MirrorThumbnails';

const router = Router();

/** GET /api/arc3-mirror/games - the full stripped catalog. No titles, descriptions or tags. */
router.get(
  '/games',
  asyncHandler(async (req: Request, res: Response) => {
    const games = await Arc3MirrorCatalog.listGames();
    const category = typeof req.query.category === 'string' ? req.query.category : null;
    const filtered = category ? games.filter((g) => g.category === category) : games;
    res.json(formatResponse.success({ games: filtered, total: filtered.length }));
  }),
);

/** GET /api/arc3-mirror/games/:gameId/source - Python source for the Pyodide worker. */
router.get(
  '/games/:gameId/source',
  asyncHandler(async (req: Request, res: Response) => {
    const source = await Arc3MirrorCatalog.getSource(req.params.gameId);
    if (!source) {
      return res.status(404).json(formatResponse.error('GAME_NOT_FOUND', 'Game not found'));
    }
    res.json(formatResponse.success({ gameId: req.params.gameId, ...source }));
  }),
);

/**
 * GET /api/arc3-mirror/games/:gameId/thumbnail - the game's opening frame as a PNG.
 *
 * A tile has to BE the task. The frame carries no words, so unlike the title it is safe
 * to show, and it is the only thing a blind player is meant to reason from. Failures
 * answer 404 and the client falls back to a deterministic placeholder sprite.
 */
router.get(
  '/games/:gameId/thumbnail',
  asyncHandler(async (req: Request, res: Response) => {
    const { gameId } = req.params;
    if (!/^[A-Za-z0-9_.-]{1,64}$/.test(gameId)) {
      return res.status(400).json(formatResponse.error('BAD_GAME_ID', 'Invalid game id'));
    }
    const size = Math.min(512, Math.max(64, Number(req.query.size) || 256));

    const cachePath = await Arc3MirrorThumbnails.getThumbnailPath(gameId, size);
    if (!cachePath) {
      return res.status(404).json(formatResponse.error('THUMBNAIL_UNAVAILABLE', 'Could not render thumbnail'));
    }

    // Upstream ids encode a content hash, so a changed game arrives under a new URL.
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.sendFile(cachePath);
  }),
);

/** GET /api/arc3-mirror/mirror-status - is the mirror live, and how stale is it? */
router.get(
  '/mirror-status',
  asyncHandler(async (_req: Request, res: Response) => {
    await Arc3MirrorCatalog.listGames().catch(() => undefined);
    res.json(formatResponse.success(Arc3MirrorCatalog.status()));
  }),
);

export default router;
