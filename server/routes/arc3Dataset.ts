/*
Author: Claude Opus 5
Date: 2026-09-18
PURPOSE: HTTP layer for the private ARC-AGI-3 game dataset (services/arc3/arc3GameDataset.ts):
         the 25 public games, level by level, as JSON for the arc-3 training repo to fetch.

           GET /api/arc3/dataset          -> { schema, generatedAt, games: [...] }  all 25
           GET /api/arc3/dataset/:gameId  -> one game's document

         WHY A READ IS GUARDED HERE. Boss's call on 18-Sep-2026: the dataset gets curated and
         checked before anything is released, so it is not public yet and nothing on the site
         links to it. Our own pipeline still fetches it from day one, with the arc3 admin
         token (X-ARC3-Admin-Token). When Boss releases it, drop the guard; the shape stays.

         Always built fresh from the registry, and sent with no-store so neither a proxy nor
         the fetcher keeps a stale copy of a game file that was corrected an hour ago.
SRP/DRY check: Pass -- HTTP only. The document is built in arc3GameDataset.ts and the token
         check is the shared middleware/arc3AdminToken.ts, the same one the Kaggle push uses.
*/

import { Router, type Request, type Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireArc3AdminToken } from '../middleware/arc3AdminToken';
import { formatResponse } from '../utils/responseFormatter';
import {
  buildArc3GameDataset,
  buildArc3GameDatasetBundle,
} from '../services/arc3/arc3GameDataset';

const router = Router();

/** Game ids are four lowercase letters/digits (dc22, m0r0). Keeps odd input out of lookups. */
const GAME_ID = /^[a-z0-9]{4}$/;

router.use(requireArc3AdminToken({ label: 'Game dataset', logContext: 'arc3-dataset' }));
router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    res.json(formatResponse.success(buildArc3GameDatasetBundle()));
  }),
);

router.get(
  '/:gameId',
  asyncHandler(async (req: Request, res: Response) => {
    const gameId = String(req.params.gameId ?? '').toLowerCase();
    const dataset = GAME_ID.test(gameId) ? buildArc3GameDataset(gameId) : null;
    if (!dataset) {
      return res
        .status(404)
        .json(formatResponse.error('unknown_game', `No public ARC-AGI-3 game with id "${gameId}".`));
    }
    return res.json(formatResponse.success(dataset));
  }),
);

export default router;
