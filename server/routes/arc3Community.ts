/*
Author: GPT-5.2 / Claude Sonnet 4.6 / Claude Opus 5
Date: 2026-08-29
PURPOSE: Express router for ARC3 community game endpoints. Handles game listing, game play
         sessions (Node <-> Python bridge), single-file submission persistence, and source
         retrieval for official ARCEngine games and approved community games.
         The /games/:gameId/source endpoint now returns `className` so the Pyodide client-side
         game worker can instantiate the correct ARCBaseGame subclass without server execution.
         PATCH /games/:gameId/curation sets tags, difficulty and the featured flag on a
         game that is already published. Curation fields are otherwise settable only at
         creation and only through POST /games; the public POST /submissions path stores
         `tags: []` by design, so a game published that way was invisible to every surface
         that selects by tag -- including the synthetic set on the arc3 landing page --
         with no route able to repair it.
         Dependencies: CommunityGameRepository (Postgres), CommunityGameStorage (disk),
         CommunityGameValidator (static analysis), and ArcEngineOfficialGameCatalog (submodule).
SRP/DRY check: Pass - kept responsibilities at the HTTP layer and reused existing services.
*/

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import { formatResponse } from '../utils/responseFormatter';
import { logger } from '../utils/logger';
import { CommunityGameRepository, type CreateGameInput, type GameListOptions, type CommunityGame } from '../repositories/CommunityGameRepository';
import { CommunityGameStorage } from '../services/arc3Community/CommunityGameStorage';
import { CommunityGameRunner } from '../services/arc3Community/CommunityGameRunner';
import { CommunityGameValidator } from '../services/arc3Community/CommunityGameValidator';
import { ArcEngineOfficialGameCatalog } from '../services/arc3Community/ArcEngineOfficialGameCatalog';
import { getPool } from '../repositories/base/BaseRepository';
import { HumanPlayRepository } from '../repositories/HumanPlayRepository.js';
import { spawn } from 'child_process';
import path from 'path';

// Alpine Docker only ships python3; Windows uses python. Mirrors the resolution in
// services/arc3Community/CommunityGamePythonBridge.ts.
function resolvePythonBin(): string {
  if (process.env.PYTHON_BIN) return process.env.PYTHON_BIN;
  return process.platform === 'win32' ? 'python' : 'python3';
}

const THUMBNAIL_SCRIPT = path.join(process.cwd(), 'server', 'python', 'community_game_thumbnail.py');
const THUMBNAIL_TIMEOUT_MS = 20_000;

/** Render one game's opening frame to `outPath`. Rejects on non-zero exit or timeout. */
function renderGameThumbnail(sourceFilePath: string, outPath: string, size: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      resolvePythonBin(),
      [THUMBNAIL_SCRIPT, '--file', sourceFilePath, outPath, String(size)],
      { env: { ...process.env, PYTHONPATH: [path.join(process.cwd(), 'external', 'ARCEngine'), process.env.PYTHONPATH].filter(Boolean).join(path.delimiter) } },
    );

    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += String(chunk); });

    // A game whose reset loops would otherwise hold a request open indefinitely.
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('thumbnail render timed out'));
    }, THUMBNAIL_TIMEOUT_MS);

    child.on('error', (error) => { clearTimeout(timer); reject(error); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`renderer exited ${code}: ${stderr.trim().slice(-300)}`));
    });
  });
}


const router = Router();

// Built-in official games shipped via the ARCEngine submodule.
// Discovered dynamically so new official game files appear without server code changes.
async function getOfficialGames(): Promise<CommunityGame[]> {
  return (await ArcEngineOfficialGameCatalog.listOfficialGames()).map((item) => item.game);
}

// Lazy initialization of repository
let repository: CommunityGameRepository | null = null;

function getRepository(): CommunityGameRepository {
  if (!repository) {
    const pool = getPool();
    if (!pool) {
      throw new Error('Database connection not available');
    }
    repository = new CommunityGameRepository(pool);
  }
  return repository;
}

// Lazy initialization of game runner
let gameRunner: CommunityGameRunner | null = null;

function getGameRunner(): CommunityGameRunner {
  if (!gameRunner) {
    gameRunner = new CommunityGameRunner(getRepository());
  }
  return gameRunner;
}

function getProvidedArc3AdminToken(req: Request): string | null {
  const bearer = req.headers.authorization;
  if (typeof bearer === 'string' && bearer.toLowerCase().startsWith('bearer ')) {
    return bearer.slice('bearer '.length).trim() || null;
  }

  const header = req.headers['x-arc3-admin-token'];
  if (typeof header === 'string') return header.trim() || null;
  if (Array.isArray(header)) return header[0]?.trim() || null;
  return null;
}

function requireArc3AdminToken(req: Request, res: Response): boolean {
  const required = process.env.ARC3_COMMUNITY_ADMIN_TOKEN;
  if (!required) {
    res.status(503).json(
      formatResponse.error(
        'ADMIN_NOT_CONFIGURED',
        'ARC3 community admin token not configured on this server',
        { envVar: 'ARC3_COMMUNITY_ADMIN_TOKEN' },
      ),
    );
    return false;
  }

  const provided = getProvidedArc3AdminToken(req);
  if (!provided || provided !== required) {
    res.status(401).json(
      formatResponse.error('ADMIN_AUTH_REQUIRED', 'Admin authorization required'),
    );
    return false;
  }

  return true;
}

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const uploadGameSchema = z.object({
  gameId: z.string()
    .min(3, 'Game ID must be at least 3 characters')
    .max(50, 'Game ID must be at most 50 characters')
    .regex(/^[a-z][a-z0-9_-]*$/, 'Game ID must start with a letter and contain only lowercase letters, numbers, underscores, and dashes'),
  displayName: z.string()
    .min(3, 'Display name must be at least 3 characters')
    .max(100, 'Display name must be at most 100 characters'),
  description: z.string().max(2000).optional(),
  authorName: z.string()
    .min(2, 'Author name must be at least 2 characters')
    .max(100, 'Author name must be at most 100 characters'),
  authorEmail: z.string().email().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard', 'very-hard', 'unknown']).optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
  sourceCode: z.string()
    .min(100, 'Source code must be at least 100 characters')
    .max(500 * 1024, 'Source code must be at most 500KB'),
});

const listGamesSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'archived']).optional(),
  difficulty: z.enum(['easy', 'medium', 'hard', 'very-hard', 'unknown']).optional(),
  authorName: z.string().optional(),
  tags: z.string().optional(), // comma-separated
  isFeatured: z.coerce.boolean().optional(),
  search: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  orderBy: z.enum(['uploadedAt', 'playCount', 'displayName']).optional(),
  orderDir: z.enum(['ASC', 'DESC']).optional(),
});

// ============================================================================
// PUBLIC ENDPOINTS
// ============================================================================

/**
 * GET /api/arc3-community/games
 * List all approved community games with filtering (includes featured games)
 */
router.get(
  '/games',
  asyncHandler(async (req: Request, res: Response) => {
    const params = listGamesSchema.parse(req.query);
    
    const options: GameListOptions = {
      ...params,
      // Public list endpoint: never expose pending/rejected submissions.
      status: 'approved',
      tags: params.tags ? params.tags.split(',').map((t) => t.trim()) : undefined,
    };

    const { games: dbGames, total: dbTotal } = await getRepository().listGames(options);
    const officialGamesAll = await getOfficialGames();

    const officialGames = officialGamesAll.filter((game) => {
      if (options.status && options.status !== 'approved') return false;
      if (options.isFeatured === false) return false;
      if (options.difficulty && game.difficulty !== options.difficulty) return false;
      if (options.authorName && !game.authorName.toLowerCase().includes(options.authorName.toLowerCase())) return false;
      if (options.tags && options.tags.length > 0 && !options.tags.some(t => game.tags.includes(t))) return false;
      if (options.search) {
        const q = options.search.toLowerCase();
        const hay = `${game.displayName} ${game.description || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    // Merge featured community games with database games (featured first)
    const allGames = [...officialGames, ...dbGames];
    const total = dbTotal + officialGames.length;

    res.json(formatResponse.success({
      games: allGames,
      total,
      limit: options.limit || 50,
      offset: options.offset || 0,
    }));
  }),
);

/**
 * GET /api/arc3-community/games/featured
 * Get featured community games (featured games always included)
 */
router.get(
  '/games/featured',
  asyncHandler(async (req: Request, res: Response) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 6, 20);
    const dbGames = await getRepository().getFeaturedGames(limit);
    const officialGames = (await getOfficialGames()).filter(g => g.isFeatured);
    // Featured community games first, then featured from DB
    const games = [...officialGames, ...dbGames].slice(0, limit);
    res.json(formatResponse.success(games));
  }),
);

/**
 * GET /api/arc3-community/games/popular
 * Get popular community games by play count
 */
router.get(
  '/games/popular',
  asyncHandler(async (req: Request, res: Response) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const games = await getRepository().getPopularGames(limit);
    res.json(formatResponse.success(games));
  }),
);

/**
 * GET /api/arc3-community/games/:gameId
 * Get a specific community game by its game_id
 */
router.get(
  '/games/:gameId',
  asyncHandler(async (req: Request, res: Response) => {
    const { gameId } = req.params;
    
    // Check built-in official games first
    const officialGame = await ArcEngineOfficialGameCatalog.getOfficialGame(gameId);
    if (officialGame) {
      return res.json(formatResponse.success(officialGame.game));
    }

    // Then check database
    const game = await getRepository().getGameByGameId(gameId);

    if (!game) {
      return res.status(404).json(formatResponse.error('GAME_NOT_FOUND', 'Game not found'));
    }

    // Only return approved/playable games publicly
    if (game.status !== 'approved' || !game.isPlayable) {
      return res.status(404).json(formatResponse.error('GAME_NOT_AVAILABLE', 'Game is not available'));
    }

    res.json(formatResponse.success(game));
  }),
);

/**
 * POST /api/arc3-community/games
 * Upload a new community game
 */
router.post(
  '/games',
  asyncHandler(async (req: Request, res: Response) => {
    const payload = uploadGameSchema.parse(req.body);

    // Check if game ID already exists
    const isOfficialId = await ArcEngineOfficialGameCatalog.isOfficialGameId(payload.gameId);
    if (isOfficialId || await getRepository().gameIdExists(payload.gameId)) {
      return res.status(409).json(
        formatResponse.error('GAME_ID_EXISTS', 'A game with this ID already exists')
      );
    }

    // Validate the source code (static checks only; do not execute untrusted code here)
    const validationResult = await CommunityGameValidator.validateSource(payload.sourceCode);
    if (!validationResult.isValid) {
      return res.status(400).json(
        formatResponse.error('VALIDATION_FAILED', 'Game validation failed', {
          errors: validationResult.errors,
          warnings: validationResult.warnings,
        }),
      );
    }

    // Store the source file
    let storedFile;
    try {
      storedFile = await CommunityGameStorage.storeGameFile(payload.gameId, payload.sourceCode);
    } catch (error) {
      logger.error(`Failed to store game file: ${error}`, 'community-games');
      return res.status(500).json(
        formatResponse.error('STORAGE_ERROR', 'Failed to store game file')
      );
    }

    // Create game entry in database
    const createInput: CreateGameInput = {
      gameId: payload.gameId,
      displayName: payload.displayName,
      description: payload.description,
      authorName: payload.authorName,
      authorEmail: payload.authorEmail,
      difficulty: payload.difficulty,
      tags: payload.tags,
      sourceFilePath: storedFile.filePath,
      sourceHash: storedFile.hash,
      // levelCount/winScore are deliberately NOT taken from the payload: a submitter
      // should not declare facts about their own game. They cannot be derived here
      // either, because validateSource is static and never executes the file. They are
      // derived at publish time, where the game is run anyway.
      status: 'pending',
      isPlayable: false,
      validatedAt: new Date(),
      validationErrors: {
        warnings: validationResult.warnings,
        metadata: validationResult.metadata,
      },
    };

    try {
      const game = await getRepository().createGame(createInput);
      logger.info(`New community game uploaded: ${payload.gameId} by ${payload.authorName}`, 'community-games');

      res.status(201).json(formatResponse.success({
        game,
        message: 'Game uploaded successfully. It is pending review and will become playable once approved.',
      }));
    } catch (error) {
      // Clean up stored file on database error
      await CommunityGameStorage.deleteGameFiles(payload.gameId);
      throw error;
    }
  }),
);

/**
 * GET /api/arc3-community/games/:gameId/source
 * Get the source code for a game (for validation/debugging)
 */
router.get(
  '/games/:gameId/source',
  asyncHandler(async (req: Request, res: Response) => {
    const { gameId } = req.params;

    // Built-in official game source (from ARCEngine submodule)
    const officialGame = await ArcEngineOfficialGameCatalog.getOfficialGame(gameId);
    if (officialGame) {
      const isValid = await CommunityGameStorage.verifyFileHash(officialGame.pythonFilePath, officialGame.game.sourceHash);
      if (!isValid) {
        return res.status(500).json(
          formatResponse.error('FILE_INTEGRITY_ERROR', 'Official game file integrity check failed')
        );
      }

      const sourceCode = await CommunityGameStorage.readGameFile(officialGame.pythonFilePath);
      const officialValidation = await CommunityGameValidator.validateSource(sourceCode);
      return res.json(formatResponse.success({
        gameId: officialGame.game.gameId,
        sourceCode,
        hash: officialGame.game.sourceHash,
        className: officialValidation.metadata?.className ?? null,
      }));
    }

    const game = await getRepository().getGameByGameId(gameId);

    if (!game) {
      return res.status(404).json(formatResponse.error('GAME_NOT_FOUND', 'Game not found'));
    }

    // Keep submissions private until approved.
    if (game.status !== 'approved' || !game.isPlayable) {
      return res.status(404).json(formatResponse.error('GAME_NOT_AVAILABLE', 'Game is not available'));
    }

    // Verify file integrity
    const isValid = await CommunityGameStorage.verifyFileHash(game.sourceFilePath, game.sourceHash);
    if (!isValid) {
      return res.status(500).json(
        formatResponse.error('FILE_INTEGRITY_ERROR', 'Game file integrity check failed')
      );
    }

    const sourceCode = await CommunityGameStorage.readGameFile(game.sourceFilePath);
    const validation = await CommunityGameValidator.validateSource(sourceCode);

    res.json(formatResponse.success({
      gameId: game.gameId,
      sourceCode,
      hash: game.sourceHash,
      className: validation.metadata?.className ?? null,
    }));
  }),
);

/**
 * POST /api/arc3-community/human-events
 * Public, unauthenticated: a batch of anonymous play events.
 *
 * The play page runs the game client-side in Pyodide, so actions never reach the server
 * -- per-action logging on /session/:guid/action would record almost nothing. Events are
 * batched in the browser and posted here instead. Public because a login wall would kill
 * the sample, which is the whole point of collecting a human baseline.
 */
router.post(
  '/human-events',
  asyncHandler(async (req: Request, res: Response) => {
    const sessionGuid = String(req.body?.sessionGuid ?? '');
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(sessionGuid)) {
      return res.status(400).json(formatResponse.error('BAD_SESSION', 'Invalid sessionGuid'));
    }
    const gameId = String(req.body?.gameId ?? '');
    if (!/^[A-Za-z0-9_.-]{1,64}$/.test(gameId)) {
      return res.status(400).json(formatResponse.error('BAD_GAME_ID', 'Invalid gameId'));
    }
    const events = Array.isArray(req.body?.events) ? req.body.events.slice(0, 500) : [];
    if (events.length === 0) {
      return res.json(formatResponse.success({ written: 0 }));
    }

    // The session is created from the batch: the browser mints the GUID because it runs
    // the game, and it is the only party that knows whether this is a blind first play.
    await HumanPlayRepository.ensureSession(
      sessionGuid, gameId,
      req.body?.isFirstSession === true,
      typeof req.body?.uaFamily === 'string' ? req.body.uaFamily : '',
      typeof req.body?.viewport === 'string' ? req.body.viewport : '',
    );

    let written = 0;
    for (const raw of events) {
      if (!raw || typeof raw !== 'object') continue;
      const action = String(raw.action ?? '').slice(0, 16);
      if (!action) continue;
      await HumanPlayRepository.recordEvent({
        sessionGuid,
        seq: Number.isFinite(raw.seq) ? Number(raw.seq) : written,
        action,
        actionInt: HumanPlayRepository.actionInt(action),
        level: Number.isFinite(raw.level) ? Number(raw.level) : null,
        levelActions: Number.isFinite(raw.level_actions) ? Number(raw.level_actions) : null,
        score: Number.isFinite(raw.level) ? Number(raw.level) : null,
        state: typeof raw.state === 'string' ? raw.state.slice(0, 32) : null,
        tMs: Number.isFinite(raw.t_ms) ? Number(raw.t_ms) : null,
      });
      written += 1;
    }
    return res.json(formatResponse.success({ written }));
  }),
);

/**
 * GET /api/arc3-community/human-stats
 * Public: first-blind-attempt aggregates, the human half of the human-vs-agent gap.
 * Aggregates only -- never raw event streams.
 */
router.get(
  '/human-stats',
  asyncHandler(async (req: Request, res: Response) => {
    const gameId = typeof req.query.game === 'string' ? req.query.game : undefined;
    if (gameId && !/^[A-Za-z0-9_.-]{1,64}$/.test(gameId)) {
      return res.status(400).json(formatResponse.error('BAD_GAME_ID', 'Invalid game id'));
    }
    return res.json(formatResponse.success(await HumanPlayRepository.stats(gameId)));
  }),
);

/**
 * GET /api/arc3-community/games/:gameId/thumbnail
 * Render the game's opening frame as a PNG.
 *
 * The gallery is the site's landing page and shows one tile per task; a tile has to be
 * the task, the way arcprize.org shows a frame per task. Rendering is done by
 * server/python/community_game_thumbnail.py, which issues a single RESET and paints the
 * resulting 64x64 grid with the canonical ARC-3 palette — no session is created and no
 * play count is touched, so thumbnails never pollute the telemetry.
 *
 * Cached on disk under the storage thumbnail directory keyed by gameId AND sourceHash,
 * so a rebuilt game gets a new thumbnail automatically and a new game needs no manual
 * step. Failures answer 404 and the client falls back to a placeholder.
 */
router.get(
  '/games/:gameId/thumbnail',
  asyncHandler(async (req: Request, res: Response) => {
    const { gameId } = req.params;
    if (!/^[A-Za-z0-9_.-]{1,64}$/.test(gameId)) {
      return res.status(400).json(formatResponse.error('BAD_GAME_ID', 'Invalid game id'));
    }

    let sourceFilePath: string | null = null;
    let sourceHash = '';

    const officialGame = await ArcEngineOfficialGameCatalog.getOfficialGame(gameId);
    if (officialGame) {
      sourceFilePath = officialGame.pythonFilePath;
      sourceHash = officialGame.game.sourceHash;
    } else {
      const game = await getRepository().getGameByGameId(gameId);
      if (!game || game.status !== 'approved' || !game.isPlayable) {
        return res.status(404).json(formatResponse.error('GAME_NOT_FOUND', 'Game not found'));
      }
      sourceFilePath = game.sourceFilePath;
      sourceHash = game.sourceHash;
    }

    if (!sourceFilePath) {
      return res.status(404).json(formatResponse.error('GAME_NOT_FOUND', 'Game has no source file'));
    }

    const size = Math.min(512, Math.max(64, Number(req.query.size) || 256));
    const cachePath = CommunityGameStorage.thumbnailCachePath(gameId, sourceHash, size);

    const sendPng = () => {
      // Keyed by content hash, so a long cache is safe: a changed game changes the URL.
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.sendFile(cachePath);
    };

    if (await CommunityGameStorage.fileExists(cachePath)) {
      return sendPng();
    }

    try {
      await renderGameThumbnail(sourceFilePath, cachePath, size);
    } catch (error) {
      logger.warn(
        `Thumbnail render failed for ${gameId}: ${error instanceof Error ? error.message : String(error)}`,
        'arc3-community',
      );
      return res.status(404).json(formatResponse.error('THUMBNAIL_UNAVAILABLE', 'Could not render thumbnail'));
    }

    return sendPng();
  }),
);

/**
 * POST /api/arc3-community/games/:gameId/play
 * Record that a game session started (increments play count)
 */
router.post(
  '/games/:gameId/play',
  asyncHandler(async (req: Request, res: Response) => {
    const { gameId } = req.params;
    const game = await getRepository().getGameByGameId(gameId);

    if (!game || game.status !== 'approved') {
      return res.status(404).json(formatResponse.error('GAME_NOT_FOUND', 'Game not found'));
    }

    await getRepository().incrementPlayCount(gameId);
    res.json(formatResponse.success({ message: 'Play recorded' }));
  }),
);

/**
 * GET /api/arc3-community/stats
 * Get overall community games statistics
 */
router.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const repo = getRepository();
    
    const [approved, pending, total] = await Promise.all([
      repo.listGames({ status: 'approved', limit: 1 }),
      repo.listGames({ status: 'pending', limit: 1 }),
      repo.listGames({ limit: 1 }),
    ]);

    res.json(formatResponse.success({
      totalGames: total.total,
      approvedGames: approved.total,
      pendingGames: pending.total,
    }));
  }),
);

/**
 * GET /api/arc3-community/check-id/:gameId
 * Check if a game ID is available
 */
router.get(
  '/check-id/:gameId',
  asyncHandler(async (req: Request, res: Response) => {
    const { gameId } = req.params;
    
    // Validate format
    const idPattern = /^[a-z][a-z0-9_-]*$/;
    if (!idPattern.test(gameId) || gameId.length < 3 || gameId.length > 50) {
      return res.json(formatResponse.success({ 
        available: false, 
        reason: 'Invalid format. Must be 3-50 characters, start with a letter, and contain only lowercase letters, numbers, underscores, and dashes.' 
      }));
    }

    const isOfficialId = await ArcEngineOfficialGameCatalog.isOfficialGameId(gameId);
    const exists = isOfficialId || await getRepository().gameIdExists(gameId);
    res.json(formatResponse.success({ 
      available: !exists,
      reason: exists ? (isOfficialId ? 'This game ID is reserved for an official game' : 'This game ID is already taken') : undefined
    }));
  }),
);

// ============================================================================
// GAME SUBMISSION ENDPOINTS (single-file review pipeline)
// ============================================================================

const gameSubmissionSchema = z.object({
  gameId: z.string()
    .min(3, 'Game ID must be at least 3 characters')
    .max(50, 'Game ID must be at most 50 characters')
    .regex(/^[a-z][a-z0-9_-]*$/, 'Game ID must start with a letter and contain only lowercase letters, numbers, underscores, and dashes'),
  displayName: z.string()
    .min(3, 'Display name must be at least 3 characters')
    .max(100, 'Display name must be at most 100 characters'),
  description: z.string()
    .min(10, 'Description must be at least 10 characters')
    .max(500, 'Description must be at most 500 characters'),
  authorName: z.string()
    .max(100, 'Author name must be at most 100 characters')
    .transform(val => val?.trim() || undefined)
    .pipe(z.string().min(2, 'Author name must be at least 2 characters').optional()),
  creatorHandle: z.string()
    .min(1, 'Creator contact handle is required')
    .refine(
      (val) => {
        // Discord handle: username#1234 or new format username
        const discordPattern = /^[A-Za-z0-9_.-]{2,32}(#[0-9]{4})?$/;
        // Twitter/X URL: https://twitter.com/handle or https://x.com/handle
        const twitterPattern = /^https:\/\/(twitter|x)\.com\/[A-Za-z0-9_]{1,15}$/;
        return discordPattern.test(val) || twitterPattern.test(val);
      },
      'Must be a Discord handle (e.g., username#1234) or Twitter/X URL (e.g., https://twitter.com/username)'
    ),
  sourceCode: z.string()
    .min(50, 'Source code must be at least 50 characters')
    .max(500 * 1024, 'Source code must not exceed 500KB'),
  notes: z.string().max(1000).optional(),
});

/**
 * POST /api/arc3-community/submissions
 * Submit a Python file for review (single-file upload approach)
 */
router.post(
  '/submissions',
  asyncHandler(async (req: Request, res: Response) => {
    const payload = gameSubmissionSchema.parse(req.body);

    // Check if game ID already exists
    const isOfficialId = await ArcEngineOfficialGameCatalog.isOfficialGameId(payload.gameId);
    if (isOfficialId || await getRepository().gameIdExists(payload.gameId)) {
      return res.status(409).json(
        formatResponse.error('GAME_ID_EXISTS', 'A game with this ID already exists')
      );
    }

    // Static analysis first (fast reject for obvious issues)
    const validationResult = await CommunityGameValidator.validateSource(payload.sourceCode);
    
    if (!validationResult.isValid) {
      return res.status(400).json(
        formatResponse.error('VALIDATION_FAILED', 'Game validation failed', {
          errors: validationResult.errors,
          warnings: validationResult.warnings,
        })
      );
    }

    // Store the source file (needed on disk for runtime validation)
    let storedFile;
    try {
      storedFile = await CommunityGameStorage.storeGameFile(payload.gameId, payload.sourceCode);
    } catch (error) {
      logger.error(`Failed to store submitted game file: ${error}`, 'community-games');
      return res.status(500).json(
        formatResponse.error('STORAGE_ERROR', 'Failed to store submitted game file'),
      );
    }

    // Runtime validation: try to actually load and instantiate the game in a sandbox subprocess
    try {
      const runtimeResult = await CommunityGameValidator.validateRuntime(storedFile.filePath);
      if (!runtimeResult.isValid) {
        // Clean up stored file on runtime validation failure
        await CommunityGameStorage.deleteGameFiles(payload.gameId);
        return res.status(400).json(
          formatResponse.error('VALIDATION_FAILED', 'Game runtime validation failed', {
            errors: runtimeResult.errors,
            warnings: [...validationResult.warnings, ...runtimeResult.warnings],
          })
        );
      }
      // Merge runtime warnings into static result
      validationResult.warnings.push(...runtimeResult.warnings);
    } catch (runtimeError) {
      logger.warn(`Runtime validation skipped (non-fatal): ${runtimeError}`, 'community-games');
      // Non-fatal: if Python isn't available, fall through to static-only validation
      validationResult.warnings.push('Runtime validation was skipped - game will be tested manually during review');
    }

    const authorName = payload.authorName?.trim() ? payload.authorName.trim() : 'Anonymous';

    const createInput: CreateGameInput = {
      gameId: payload.gameId,
      displayName: payload.displayName,
      description: payload.description,
      authorName,
      creatorHandle: payload.creatorHandle,
      submissionNotes: payload.notes,
      difficulty: 'unknown',
      tags: [],
      sourceFilePath: storedFile.filePath,
      sourceHash: storedFile.hash,
      status: 'pending',
      isPlayable: false,
      validatedAt: new Date(),
      validationErrors: {
        warnings: validationResult.warnings,
        metadata: validationResult.metadata,
      },
    };

    try {
      const game = await getRepository().createGame(createInput);
      const submissionId = String(game.id);

      logger.info(
        `[community-games] New game submission: id=${submissionId} | gameId=${payload.gameId} | author=${authorName} | handle=${payload.creatorHandle} | lines=${payload.sourceCode.split(/\r?\n/).length}`,
        'community-games',
      );

      res.status(201).json(formatResponse.success({
        submissionId,
        status: game.status,
        message: 'Your game has been submitted for review. Validation passed. A moderator will review and approve your submission.',
        validation: {
          hasBaseGameClass: validationResult.metadata?.hasBaseGameClass,
          className: validationResult.metadata?.className,
          complexity: validationResult.metadata?.estimatedComplexity,
          warnings: validationResult.warnings,
        },
      }));
    } catch (error) {
      // Clean up stored file on database error
      await CommunityGameStorage.deleteGameFiles(payload.gameId);
      throw error;
    }
  }),
);

/**
 * GET /api/arc3-community/submissions
 * Admin-only: list stored submissions (pending by default)
 */
router.get(
  '/submissions',
  asyncHandler(async (req: Request, res: Response) => {
    if (!requireArc3AdminToken(req, res)) return;

    const params = listGamesSchema.parse(req.query);
    const options: GameListOptions = {
      ...params,
      status: params.status || 'pending',
      tags: params.tags ? params.tags.split(',').map((t) => t.trim()) : undefined,
    };

    const { games, total } = await getRepository().listGames(options);
    res.json(formatResponse.success({ games, total }));
  }),
);

/**
 * GET /api/arc3-community/submissions/:submissionId/source
 * Admin-only: fetch source code for a submission by numeric id (includes pending submissions)
 */
router.get(
  '/submissions/:submissionId/source',
  asyncHandler(async (req: Request, res: Response) => {
    if (!requireArc3AdminToken(req, res)) return;

    const submissionId = z.coerce.number().int().positive().parse(req.params.submissionId);
    const game = await getRepository().getGameById(submissionId);

    if (!game) {
      return res.status(404).json(formatResponse.error('SUBMISSION_NOT_FOUND', 'Submission not found'));
    }

    const isValid = await CommunityGameStorage.verifyFileHash(game.sourceFilePath, game.sourceHash);
    if (!isValid) {
      return res.status(500).json(
        formatResponse.error('FILE_INTEGRITY_ERROR', 'Submitted game file integrity check failed'),
      );
    }

    const sourceCode = await CommunityGameStorage.readGameFile(game.sourceFilePath);
    return res.json(formatResponse.success({
      submissionId: String(game.id),
      gameId: game.gameId,
      sourceCode,
      hash: game.sourceHash,
      status: game.status,
    }));
  }),
);

/**
 * PUT /api/arc3-community/games/:gameId/source
 * Admin-only: re-store the source file for an existing game and re-derive its metadata.
 *
 * Recovery path for a row whose file is gone. Until a persistent volume was mounted at
 * /app/uploads, an uploaded game's source lived on the container filesystem and was
 * destroyed by the next deploy, leaving the database pointing at a file that no longer
 * existed and the task unplayable. This restores the file, updates sourceHash, and
 * re-derives levelCount/winScore from the restored source in one step.
 */
router.put(
  '/games/:gameId/source',
  asyncHandler(async (req: Request, res: Response) => {
    if (!requireArc3AdminToken(req, res)) return;

    const { gameId } = req.params;
    const sourceCode = z.string().min(100).parse(req.body?.sourceCode);

    const game = await getRepository().getGameByGameId(gameId);
    if (!game) {
      return res.status(404).json(formatResponse.error('GAME_NOT_FOUND', 'Game not found'));
    }

    const validation = await CommunityGameValidator.validateSource(sourceCode);
    if (!validation.isValid) {
      return res.status(400).json(
        formatResponse.error('VALIDATION_FAILED', 'Source failed validation', {
          errors: validation.errors,
        }),
      );
    }

    const stored = await CommunityGameStorage.storeGameFile(gameId, sourceCode);
    // Static validation above gates the write; the level count needs the game actually
    // running, so derive it from the file we just stored.
    const runtime = await CommunityGameValidator.validateRuntime(stored.filePath);
    const levelCount = runtime.metadata?.levelCount ?? undefined;
    const winScore = runtime.metadata?.winScore ?? levelCount;

    const updated = await getRepository().updateGame(gameId, {
      sourceFilePath: stored.filePath,
      sourceHash: stored.hash,
      ...(typeof levelCount === 'number' ? { levelCount } : {}),
      ...(typeof winScore === 'number' ? { winScore } : {}),
    });

    logger.info(`Restored source for ${gameId} (levels ${levelCount})`, 'community-games');
    return res.json(formatResponse.success({
      gameId, levelCount, winScore, sourceHash: stored.hash, game: updated,
    }));
  }),
);

/**
 * POST /api/arc3-community/games/:gameId/rederive
 * Admin-only: re-derive levelCount and winScore for an existing game by running its
 * stored source through the validator.
 *
 * Uploads used to take those numbers from the submitter's payload and default to 1 when
 * absent, so any game submitted before that changed can be carrying a wrong level count
 * -- which misreports progress and win score for every session played against it. The
 * upload path now derives them; this repairs rows created before it did. Read-only with
 * respect to the game file: it validates, it does not rewrite source.
 */
router.post(
  '/games/:gameId/rederive',
  asyncHandler(async (req: Request, res: Response) => {
    if (!requireArc3AdminToken(req, res)) return;

    const { gameId } = req.params;
    const game = await getRepository().getGameByGameId(gameId);
    if (!game) {
      return res.status(404).json(formatResponse.error('GAME_NOT_FOUND', 'Game not found'));
    }

    // validateSource is static analysis and deliberately never executes the file, so it
    // cannot report a level count -- the count only exists once the game is instantiated,
    // which is what validateRuntime does. Executing here is legitimate: this route is
    // admin-gated and the file is already playable.
    const validation = await CommunityGameValidator.validateRuntime(game.sourceFilePath);
    if (!validation.isValid) {
      return res.status(422).json(
        formatResponse.error('VALIDATION_FAILED', 'Stored source no longer validates', {
          errors: validation.errors,
        }),
      );
    }

    const levelCount = validation.metadata?.levelCount ?? null;
    const winScore = validation.metadata?.winScore ?? levelCount;
    if (levelCount === null) {
      // Surface what the probe actually said; a bare NOT_DERIVABLE gives an operator
      // nothing to act on.
      return res.status(422).json(
        formatResponse.error('NOT_DERIVABLE', 'Validator did not report a level count', {
          errors: validation.errors,
          warnings: validation.warnings,
          metadata: validation.metadata,
        }),
      );
    }

    const updated = await getRepository().updateGame(gameId, {
      levelCount,
      ...(typeof winScore === 'number' ? { winScore } : {}),
    });

    logger.info(
      `Re-derived ${gameId}: levelCount ${game.levelCount} -> ${levelCount}`,
      'community-games',
    );
    return res.json(formatResponse.success({
      gameId,
      before: { levelCount: game.levelCount, winScore: game.winScore },
      after: { levelCount, winScore },
      game: updated,
    }));
  }),
);

const curateGameSchema = z.object({
  tags: z.array(z.string().max(30)).max(10).optional(),
  difficulty: z.enum(['easy', 'medium', 'hard', 'very-hard', 'unknown']).optional(),
  isFeatured: z.boolean().optional(),
}).refine(
  (v) => Object.keys(v).length > 0,
  'Provide at least one of tags, difficulty, isFeatured',
);

/**
 * PATCH /api/arc3-community/games/:gameId/curation
 * Admin-only: set curation fields (tags, difficulty, featured flag) on an existing game.
 *
 * Curation fields can only be set at creation time, and only through POST /games. A game
 * arriving on the public POST /submissions path is stored with `tags: []`, and until now
 * no route could set them afterwards. That default is right -- a submitter must not be
 * able to tag their own game into a curated collection -- but it left an operator who
 * has reviewed a game with no way to file it, and an untagged game is invisible to every
 * surface that selects by tag. The synthetic set on the arc3 landing page is exactly such
 * a filter, so a game published this way is playable but absent from the page that is
 * supposed to list it. This is the admin-gated way in. It never touches source, status,
 * playability or level counts.
 */
router.patch(
  '/games/:gameId/curation',
  asyncHandler(async (req: Request, res: Response) => {
    if (!requireArc3AdminToken(req, res)) return;

    const { gameId } = req.params;
    const updates = curateGameSchema.parse(req.body);

    const game = await getRepository().getGameByGameId(gameId);
    if (!game) {
      return res.status(404).json(formatResponse.error('GAME_NOT_FOUND', 'Game not found'));
    }

    const updated = await getRepository().updateGame(gameId, updates);
    if (!updated) {
      return res.status(500).json(
        formatResponse.error('UPDATE_FAILED', 'Failed to update curation fields'),
      );
    }

    logger.info(`Curated ${gameId}: ${JSON.stringify(updates)}`, 'community-games');
    return res.json(formatResponse.success({
      gameId,
      before: { tags: game.tags, difficulty: game.difficulty, isFeatured: game.isFeatured },
      after: { tags: updated.tags, difficulty: updated.difficulty, isFeatured: updated.isFeatured },
      game: updated,
    }));
  }),
);

/**
 * POST /api/arc3-community/submissions/:submissionId/publish
 * Admin-only: publish a reviewed submission (approve + make playable)
 */
router.post(
  '/submissions/:submissionId/publish',
  asyncHandler(async (req: Request, res: Response) => {
    if (!requireArc3AdminToken(req, res)) return;

    const submissionId = z.coerce.number().int().positive().parse(req.params.submissionId);
    const game = await getRepository().getGameById(submissionId);

    if (!game) {
      return res.status(404).json(formatResponse.error('SUBMISSION_NOT_FOUND', 'Submission not found'));
    }

    const isValid = await CommunityGameStorage.verifyFileHash(game.sourceFilePath, game.sourceHash);
    if (!isValid) {
      return res.status(500).json(
        formatResponse.error('FILE_INTEGRITY_ERROR', 'Submitted game file integrity check failed'),
      );
    }

    // Derive levelCount/winScore by actually running the game. This is the right place
    // for it: publishing is admin-gated and the task is about to become playable, so
    // executing it here changes no security posture -- whereas upload deliberately does
    // static analysis only. A submitter never declares these numbers.
    const runtime = await CommunityGameValidator.validateRuntime(game.sourceFilePath);
    const levelCount = runtime.metadata?.levelCount ?? undefined;
    const winScore = runtime.metadata?.winScore ?? levelCount;

    const updated = await getRepository().updateGame(game.gameId, {
      status: 'approved',
      isPlayable: true,
      validatedAt: new Date(),
      ...(typeof levelCount === 'number' ? { levelCount } : {}),
      ...(typeof winScore === 'number' ? { winScore } : {}),
    });

    if (!updated) {
      return res.status(500).json(formatResponse.error('PUBLISH_FAILED', 'Failed to publish submission'));
    }

    res.json(formatResponse.success({ game: updated }));
  }),
);

const rejectSubmissionSchema = z.object({
  reason: z.string().max(2000).optional(),
});

/**
 * POST /api/arc3-community/submissions/:submissionId/reject
 * Admin-only: reject a submission (keep non-playable)
 */
router.post(
  '/submissions/:submissionId/reject',
  asyncHandler(async (req: Request, res: Response) => {
    if (!requireArc3AdminToken(req, res)) return;

    const submissionId = z.coerce.number().int().positive().parse(req.params.submissionId);
    const payload = rejectSubmissionSchema.parse(req.body ?? {});

    const game = await getRepository().getGameById(submissionId);
    if (!game) {
      return res.status(404).json(formatResponse.error('SUBMISSION_NOT_FOUND', 'Submission not found'));
    }

    const previous = game.validationErrors && typeof game.validationErrors === 'object' ? game.validationErrors : {};
    const rejection = {
      reason: payload.reason || null,
      rejectedAt: new Date().toISOString(),
    };

    const updated = await getRepository().updateGame(game.gameId, {
      status: 'rejected',
      isPlayable: false,
      validatedAt: new Date(),
      validationErrors: { ...previous, rejection },
    });

    if (!updated) {
      return res.status(500).json(formatResponse.error('REJECT_FAILED', 'Failed to reject submission'));
    }

    res.json(formatResponse.success({ game: updated }));
  }),
);

// ============================================================================
// GAME EXECUTION ENDPOINTS
// ============================================================================

/**
 * POST /api/arc3-community/session/start
 * Start a new game session
 */
router.post(
  '/session/start',
  asyncHandler(async (req: Request, res: Response) => {
    const { gameId } = req.body;
    
    if (!gameId || typeof gameId !== 'string') {
      return res.status(400).json(formatResponse.error('INVALID_GAME_ID', 'gameId is required'));
    }

    try {
      const result = await getGameRunner().startGame(gameId);

      res.json(formatResponse.success(result));
    } catch (error) {
      logger.error(`Failed to start game ${gameId}: ${error}`, 'community-games');
      return res.status(500).json(
        formatResponse.error('START_FAILED', error instanceof Error ? error.message : 'Failed to start game')
      );
    }
  }),
);

/**
 * POST /api/arc3-community/session/:sessionGuid/action
 * Execute an action in an active game session
 */
router.post(
  '/session/:sessionGuid/action',
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionGuid } = req.params;
    const { action, coordinates } = req.body;

    if (!action || typeof action !== 'string') {
      return res.status(400).json(formatResponse.error('INVALID_ACTION', 'action is required'));
    }

    const validActions = ['RESET', 'ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5', 'ACTION6', 'ACTION7'];
    if (!validActions.includes(action.toUpperCase())) {
      return res.status(400).json(formatResponse.error('INVALID_ACTION', `action must be one of: ${validActions.join(', ')}`));
    }

    try {
      const result = await getGameRunner().executeAction(sessionGuid, {
        action: action.toUpperCase() as 'RESET' | 'ACTION1' | 'ACTION2' | 'ACTION3' | 'ACTION4' | 'ACTION5' | 'ACTION6' | 'ACTION7',
        coordinates: coordinates as [number, number] | undefined,
      });

      res.json(formatResponse.success(result));
    } catch (error) {
      logger.error(`Action failed for session ${sessionGuid}: ${error}`, 'community-games');
      return res.status(500).json(
        formatResponse.error('ACTION_FAILED', error instanceof Error ? error.message : 'Action failed')
      );
    }
  }),
);

/**
 * GET /api/arc3-community/session/:sessionGuid
 * Get current session state
 */
router.get(
  '/session/:sessionGuid',
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionGuid } = req.params;
    const session = getGameRunner().getSession(sessionGuid);

    if (!session) {
      return res.status(404).json(formatResponse.error('SESSION_NOT_FOUND', 'Session not found or expired'));
    }

    res.json(formatResponse.success({
      sessionGuid: session.sessionGuid,
      gameId: session.gameId,
      state: session.state,
      currentFrame: session.currentFrame,
      actionCount: session.actionHistory.length,
      startedAt: session.startedAt,
    }));
  }),
);

/**
 * DELETE /api/arc3-community/session/:sessionGuid
 * Abandon a game session
 */
router.delete(
  '/session/:sessionGuid',
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionGuid } = req.params;
    await getGameRunner().abandonSession(sessionGuid);
    res.json(formatResponse.success({ message: 'Session abandoned' }));
  }),
);

/**
 * POST /api/arc3-community/validate
 * Validate game source code before upload
 */
router.post(
  '/validate',
  asyncHandler(async (req: Request, res: Response) => {
    const { sourceCode } = req.body;

    if (!sourceCode || typeof sourceCode !== 'string') {
      return res.status(400).json(formatResponse.error('INVALID_SOURCE', 'sourceCode is required'));
    }

    const result = await CommunityGameValidator.validateSource(sourceCode);
    res.json(formatResponse.success(result));
  }),
);

export default router;
