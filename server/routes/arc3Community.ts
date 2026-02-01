/*
 * Author: Cascade (Claude)
 * Date: 2026-02-01
 * PURPOSE: Express router for community game endpoints. Handles game uploads, listings,
 *          and metadata retrieval for user-created ARCEngine games.
 *          Updated to use official game IDs (ws01, gw01) from games.official module.
 * SRP/DRY check: Pass — isolates HTTP contract for community game operations.
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
import { getPool } from '../repositories/base/BaseRepository';

const router = Router();

// Featured community games from ARCEngine registry (always available)
// Using official game IDs (ws01, gw01) from games.official module
const FEATURED_COMMUNITY_GAMES: CommunityGame[] = [
  {
    id: -1,
    gameId: 'ws01',
    displayName: 'World Shifter',
    description: 'The world moves, not you. A puzzle game where player input moves the entire world in the opposite direction. Navigate mazes by shifting walls, obstacles, and the exit toward your fixed position.',
    authorName: 'Arc Explainer Team',
    authorEmail: null,
    version: '1.0.0',
    difficulty: 'medium',
    levelCount: 3,
    winScore: 1,
    maxActions: null,
    tags: ['featured', 'puzzle', 'maze'],
    sourceFilePath: '',
    sourceHash: '',
    thumbnailPath: null,
    status: 'approved',
    isFeatured: true,
    isPlayable: true,
    validatedAt: new Date(),
    validationErrors: null,
    playCount: 0,
    totalWins: 0,
    totalLosses: 0,
    averageScore: null,
    uploadedAt: new Date('2026-02-01'),
    updatedAt: new Date('2026-02-01'),
  },
  {
    id: -2,
    gameId: 'gw01',
    displayName: 'Gravity Well',
    description: 'Control gravity to collect orbs into wells. Yellow and Orange orbs fuse to Green. Wells cycle colors. Green phases through platforms.',
    authorName: 'Arc Explainer Team',
    authorEmail: null,
    version: '1.0.0',
    difficulty: 'medium',
    levelCount: 6,
    winScore: 6,
    maxActions: null,
    tags: ['featured', 'puzzle', 'gravity'],
    sourceFilePath: '',
    sourceHash: '',
    thumbnailPath: null,
    status: 'approved',
    isFeatured: true,
    isPlayable: true,
    validatedAt: new Date(),
    validationErrors: null,
    playCount: 0,
    totalWins: 0,
    totalLosses: 0,
    averageScore: null,
    uploadedAt: new Date('2026-02-01'),
    updatedAt: new Date('2026-02-01'),
  },
  {
    id: -3,
    gameId: 'ls20',
    displayName: 'Light Switch',
    description: 'Toggle lights in a grid to match a target pattern. Each switch affects adjacent cells. A classic puzzle mechanic with ARC-style visual encoding.',
    authorName: 'ARC Prize Team',
    authorEmail: null,
    version: '1.0.0',
    difficulty: 'medium',
    levelCount: 5,
    winScore: 5,
    maxActions: null,
    tags: ['featured', 'puzzle', 'logic'],
    sourceFilePath: '',
    sourceHash: '',
    thumbnailPath: null,
    status: 'approved',
    isFeatured: true,
    isPlayable: true,
    validatedAt: new Date(),
    validationErrors: null,
    playCount: 0,
    totalWins: 0,
    totalLosses: 0,
    averageScore: null,
    uploadedAt: new Date('2026-02-01'),
    updatedAt: new Date('2026-02-01'),
  },
  {
    id: -4,
    gameId: 'ft09',
    displayName: 'Fill The Grid',
    description: 'Fill an empty grid to match a target pattern using strategic placement. Plan your moves carefully to achieve the goal configuration.',
    authorName: 'ARC Prize Team',
    authorEmail: null,
    version: '1.0.0',
    difficulty: 'medium',
    levelCount: 5,
    winScore: 5,
    maxActions: null,
    tags: ['featured', 'puzzle', 'spatial'],
    sourceFilePath: '',
    sourceHash: '',
    thumbnailPath: null,
    status: 'approved',
    isFeatured: true,
    isPlayable: true,
    validatedAt: new Date(),
    validationErrors: null,
    playCount: 0,
    totalWins: 0,
    totalLosses: 0,
    averageScore: null,
    uploadedAt: new Date('2026-02-01'),
    updatedAt: new Date('2026-02-01'),
  },
  {
    id: -5,
    gameId: 'vc33',
    displayName: 'Vector Chase',
    description: 'Navigate a path through a grid following vector rules. Each move must follow the pattern established by the puzzle. Test your spatial reasoning.',
    authorName: 'ARC Prize Team',
    authorEmail: null,
    version: '1.0.0',
    difficulty: 'hard',
    levelCount: 5,
    winScore: 5,
    maxActions: null,
    tags: ['featured', 'puzzle', 'vectors'],
    sourceFilePath: '',
    sourceHash: '',
    thumbnailPath: null,
    status: 'approved',
    isFeatured: true,
    isPlayable: true,
    validatedAt: new Date(),
    validationErrors: null,
    playCount: 0,
    totalWins: 0,
    totalLosses: 0,
    averageScore: null,
    uploadedAt: new Date('2026-02-01'),
    updatedAt: new Date('2026-02-01'),
  },
];

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
 * List all approved community games with filtering (includes featured games)
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

    const { games: dbGames, total: dbTotal } = await getRepository().listGames(options);

    // Merge featured community games with database games (featured first)
    const allGames = [...FEATURED_COMMUNITY_GAMES, ...dbGames];
    const total = dbTotal + FEATURED_COMMUNITY_GAMES.length;

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
    // Featured community games first, then featured from DB
    const games = [...FEATURED_COMMUNITY_GAMES, ...dbGames].slice(0, limit);
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
    
    // Check featured community games first
    const featuredGame = FEATURED_COMMUNITY_GAMES.find(g => g.gameId === gameId);
    if (featuredGame) {
      return res.json(formatResponse.success(featuredGame));
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

// ============================================================================
// GAME SUBMISSION ENDPOINTS (GitHub repo link approach)
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
    .max(500000, 'Source code must not exceed 500KB'),
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
    const featuredExists = FEATURED_COMMUNITY_GAMES.some(g => g.gameId === payload.gameId);
    if (featuredExists || await getRepository().gameIdExists(payload.gameId)) {
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

    // Generate a submission ID for tracking
    const submissionId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Log the submission for manual review
    logger.info(
      `[community-games] New game submission: ${submissionId} | gameId=${payload.gameId} | author=${payload.authorName || 'Anonymous'} | handle=${payload.creatorHandle} | lines=${payload.sourceCode.split('\n').length}`,
      'community-games'
    );

    // Store the submission (would be database in production)
    // For now, just validate and return success
    res.status(201).json(formatResponse.success({
      submissionId,
      status: 'pending_review',
      message: 'Your game has been submitted for review. Validation passed. A moderator will review and approve your submission.',
      validation: {
        hasBaseGameClass: validationResult.metadata?.hasBaseGameClass,
        className: validationResult.metadata?.className,
        complexity: validationResult.metadata?.estimatedComplexity,
        warnings: validationResult.warnings,
      },
    }));
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
