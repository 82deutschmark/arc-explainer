/*
Author: GPT-5.2
Date: 2026-02-04
PURPOSE: Express router for ARC3 community game endpoints. Handles game listing, game play
         sessions (Node <-> Python bridge), single-file submission persistence, and source
         retrieval for official ARCEngine games and approved community games.
         Dependencies: CommunityGameRepository (Postgres), CommunityGameStorage (disk), and
         ArcEngineOfficialGameCatalog (official game discovery via submodule).
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
      return res.json(formatResponse.success({
        gameId: officialGame.game.gameId,
        sourceCode,
        hash: officialGame.game.sourceHash,
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
    
    res.json(formatResponse.success({
      gameId: game.gameId,
      sourceCode,
      hash: game.sourceHash,
    }));
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
    .min(2, 'Author name must be at least 2 characters')
    .max(100, 'Author name must be at most 100 characters')
    .optional(),
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

    // Validate the source code
    const validationResult = await CommunityGameValidator.validateSource(payload.sourceCode);
    
    if (!validationResult.isValid) {
      return res.status(400).json(
        formatResponse.error('VALIDATION_FAILED', 'Game validation failed', {
          errors: validationResult.errors,
          warnings: validationResult.warnings,
        })
      );
    }

    // Store the source file (do not execute; store for offline review)
    let storedFile;
    try {
      storedFile = await CommunityGameStorage.storeGameFile(payload.gameId, payload.sourceCode);
    } catch (error) {
      logger.error(`Failed to store submitted game file: ${error}`, 'community-games');
      return res.status(500).json(
        formatResponse.error('STORAGE_ERROR', 'Failed to store submitted game file'),
      );
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

    const updated = await getRepository().updateGame(game.gameId, {
      status: 'approved',
      isPlayable: true,
      validatedAt: new Date(),
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
