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

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Router, type Request, type Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { formatResponse } from '../utils/responseFormatter';
import { Arc3MirrorCatalog, AUTHORED_DIR } from '../services/arc3Mirror/Arc3MirrorCatalog';
import { Arc3MirrorThumbnails } from '../services/arc3Mirror/Arc3MirrorThumbnails';
import { Arc3Triage } from '../services/arc3Mirror/Arc3Triage';

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

/**
 * GET /api/arc3-mirror/arcengine-wheel - the arcengine wheel, from OUR origin.
 *
 * The Pyodide worker used to fetch this itself: pypi.org/pypi/arcengine/json for the
 * metadata, then files.pythonhosted.org for the wheel. Two cross-origin requests from
 * inside a Web Worker on every cold start, which is exactly the kind of traffic a
 * corporate proxy, a TLS-inspecting antivirus or a strict DNS filter eats -- and when it
 * is eaten the failure is a hang, not an error, so the console just sits there with dead
 * controls. That is the reported Windows symptom.
 *
 * Serving it here makes the request same-origin and identical for every visitor. The
 * wheel is 37KB and pure Python, cached in memory after the first hit.
 */
let wheelCache: { bytes: Buffer; fetchedAt: number } | null = null;
const WHEEL_TTL_MS = 24 * 60 * 60 * 1000;

router.get(
  '/arcengine-wheel',
  asyncHandler(async (_req: Request, res: Response) => {
    if (!wheelCache || Date.now() - wheelCache.fetchedAt > WHEEL_TTL_MS) {
      const meta = await fetch('https://pypi.org/pypi/arcengine/json');
      if (!meta.ok) throw new Error(`PyPI metadata responded ${meta.status}`);
      const json = (await meta.json()) as { urls: { filename: string; url: string }[] };
      const entry = json.urls.find((u) => u.filename.endsWith('py3-none-any.whl'));
      if (!entry) throw new Error('no py3-none-any wheel published for arcengine');

      const wheel = await fetch(entry.url);
      if (!wheel.ok) throw new Error(`wheel download responded ${wheel.status}`);
      wheelCache = { bytes: Buffer.from(await wheel.arrayBuffer()), fetchedAt: Date.now() };
    }

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(wheelCache.bytes);
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

/**
 * GET /api/arc3-mirror/review-queue - the generated tasks in the order worth playing.
 *
 * `?all=1` includes the culled tasks with their reason, for a reviewer who wants to check
 * the cull rather than trust it. The default is the queue alone: the common case is "give
 * me the next thing to play" and that should not ship 571 rows.
 *
 * Static, so it is cacheable and never touches the upstream mirror — the review order has
 * to survive arc3.sonpham.net being unreachable.
 */
router.get(
  '/review-queue',
  asyncHandler(async (req: Request, res: Response) => {
    const includeAll = req.query.all === '1' || req.query.all === 'true';
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json(
      formatResponse.success({
        method: Arc3Triage.method(),
        // Per-batch, because the two batches were not measured the same way: the arena
        // batch was never duplicate-clustered, and a caller reading `duplicateOf: null`
        // off those rows would otherwise take a measurement that never ran for a pass.
        generations: Arc3Triage.generations(),
        totals: Arc3Triage.totals(),
        games: includeAll ? Arc3Triage.all() : Arc3Triage.queue(),
      }),
    );
  }),
);

/**
 * GET /api/arc3-mirror/mechanics - the spoiler guide's data.
 *
 * FULL SPOILERS for the 50 hand-authored tasks: what each one is, what each control does,
 * and what wins it. Unauthenticated like the rest of this router, and deliberately NOT
 * linked from anywhere a player would find it -- the play surface exists to collect blind
 * first contact and a discoverable answer key would destroy the sample it collects.
 * `noindex` on the page and no nav link is the whole of the protection; anyone with the
 * URL can read this, and it must not be mistaken for access control.
 *
 * Read from disk on first request and held: the file is a build artefact of
 * scripts/arc3/mechanic_digest.py, committed to the repo, and changes only when that is
 * re-run against a new batch.
 */
let mechanicsCache: unknown = null;
router.get(
  '/mechanics',
  asyncHandler(async (_req: Request, res: Response) => {
    if (mechanicsCache === null) {
      // AUTHORED_DIR, not a second copy of the same literal. That constant carries a
      // header explaining why the path is cwd-relative and why the directory is under
      // server/ rather than data/ -- Railway mounts a volume at /app/data that would
      // shadow a repo-tracked file there. Two spellings of one path is how the second
      // one ends up wrong.
      const file = path.join(AUTHORED_DIR, 'mechanics.json');
      mechanicsCache = JSON.parse(await readFile(file, 'utf-8'));
    }
    const games = mechanicsCache as unknown[];
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.json(formatResponse.success({ games, total: games.length }));
  }),
);

/**
 * GET /api/arc3-mirror/control-map - which actions each task actually READS.
 *
 * NOT the answer key. One list of action ids per game, derived from source by
 * scripts/arc3/mechanic_digest.py: which GameAction.ACTIONn the module tests against.
 * It says nothing about what any of them does, which is the part the player has to find.
 *
 * WHY THE FRAME IS NOT ENOUGH. `available_actions` is advisory metadata -- arcengine's
 * perform_action never gates on it (base_game.py:189) -- and it is wrong in both
 * directions across our set:
 *
 *   - OVER-REPORTING. Only 18 of the 50 declare it; the rest inherit the
 *     [1,2,3,4,5,6] default, so 26 advertise ACTION6 and read nothing from it, and 13 do
 *     the same with ACTION5. The deck showed those as live controls: press one, spend a
 *     step, nothing happens, indistinguishable from having used it wrongly.
 *   - UNDER-REPORTING, which is worse. `g033` and `g028` both READ ACTION7 and
 *     neither advertises it, so the console -- which refuses anything outside
 *     available_actions -- blocked a control those games use. In g028 that is the
 *     cancel for an armed fold, and folding is the whole game.
 *
 * `known` is separate from `reads` so the client can tell "this game does not use that
 * control" from "this game is not ours and we cannot say". Upstream tasks are not in the
 * digest and keep the frame's word; a false negative there would disable working controls,
 * which is the more expensive mistake.
 */
let controlMapCache: { known: string[]; reads: Record<string, number[]> } | null = null;
router.get(
  '/control-map',
  asyncHandler(async (_req: Request, res: Response) => {
    if (controlMapCache === null) {
      const raw = await readFile(path.join(AUTHORED_DIR, 'mechanics.json'), 'utf-8');
      const games = JSON.parse(raw) as { gameId: string; actionsReferenced: number[] }[];
      controlMapCache = {
        known: games.map((g) => g.gameId),
        reads: Object.fromEntries(games.map((g) => [g.gameId, g.actionsReferenced])),
      };
    }
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json(formatResponse.success(controlMapCache));
  }),
);

/**
 * GET /api/arc3-mirror/frames/:gameId.png - level 1 of an authored task, as an image.
 *
 * The mechanic guide is a reference for a set of VISUAL puzzles and carried no pictures,
 * so the two things players actually complained about -- "a big empty screen" and
 * "formulaic" -- could not be seen from it. These are rendered by
 * scripts/arc3/render_authored_frames.py and committed; nothing renders at request time.
 *
 * NOT A SPOILER, unlike the rest of this file's authored endpoints. It is the opening
 * frame after RESET and before any move, which is the same thing anyone gets by opening
 * the task. It is served without the noindex header the mechanics route sets, because it
 * gives nothing away that the play surface does not already show.
 *
 * The id is matched against the digest rather than interpolated into a path. A game id
 * reaching the filesystem is how a read of ../../.env gets written, and an allowlist of
 * fifty known ids removes the question rather than escaping it.
 */
let frameIdsCache: Set<string> | null = null;
router.get(
  '/frames/:gameId.png',
  asyncHandler(async (req: Request, res: Response) => {
    if (frameIdsCache === null) {
      const raw = await readFile(path.join(AUTHORED_DIR, 'mechanics.json'), 'utf-8');
      frameIdsCache = new Set((JSON.parse(raw) as { gameId: string }[]).map((g) => g.gameId));
    }
    const { gameId } = req.params as { gameId: string };
    if (!frameIdsCache.has(gameId)) {
      return res.status(404).json(formatResponse.error('not_found', `No authored frame for ${gameId}`));
    }
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.sendFile(path.join(AUTHORED_DIR, 'frames', `${gameId}.png`));
  }),
);

export default router;
