/*
 * Author: Cascade (Claude)
 * Date: 2026-01-31
 * PURPOSE: Express router for community game endpoints. Handles game uploads, listings,
 *          and metadata retrieval for user-created ARCEngine games.
 * SRP/DRY check: Pass — isolates HTTP contract for community game operations.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import { formatResponse } from '../utils/responseFormatter';
import { logger } from '../utils/logger';
import { CommunityGameRepository, type CreateGameInput, type GameListOptions } from '../repositories/CommunityGameRepository';
import { CommunityGameStorage } from '../services/arc3Community/CommunityGameStorage';
import { CommunityGameRunner } from '../services/arc3Community/CommunityGameRunner';
import { CommunityGameValidator } from '../services/arc3Community/CommunityGameValidator';
import { getPool } from '../repositories/base/BaseRepository';

const router = Router();

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
    .max(102400, 'Source code must be at most 100KB'),
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
 * List all approved community games with filtering
 */
router.get(
  '/games',
  asyncHandler(async (req: Request, res: Response) => {
    const params = listGamesSchema.parse(req.query);
    
    const options: GameListOptions = {
      ...params,
      status: params.status || 'approved', // Default to approved games only
      tags: params.tags ? params.tags.split(',').map(t => t.trim()) : undefined,
    };

    const { games, total } = await getRepository().listGames(options);

    res.json(formatResponse.success({
      games,
      total,
      limit: options.limit || 50,
      offset: options.offset || 0,
    }));
  }),
);

/**
 * GET /api/arc3-community/games/featured
 * Get featured community games
 */
router.get(
  '/games/featured',
  asyncHandler(async (req: Request, res: Response) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 6, 20);
    const games = await getRepository().getFeaturedGames(limit);
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
    if (await getRepository().gameIdExists(payload.gameId)) {
      return res.status(409).json(
        formatResponse.error('GAME_ID_EXISTS', 'A game with this ID already exists')
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
    };

    try {
      const game = await getRepository().createGame(createInput);
      logger.info(`New community game uploaded: ${payload.gameId} by ${payload.authorName}`, 'community-games');

      res.status(201).json(formatResponse.success({
        game,
        message: 'Game uploaded successfully. It will be available after auto-validation.',
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
    const game = await getRepository().getGameByGameId(gameId);

    if (!game) {
      return res.status(404).json(formatResponse.error('GAME_NOT_FOUND', 'Game not found'));
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

    const exists = await getRepository().gameIdExists(gameId);
    res.json(formatResponse.success({ 
      available: !exists,
      reason: exists ? 'This game ID is already taken' : undefined
    }));
  }),
);

export default router;
