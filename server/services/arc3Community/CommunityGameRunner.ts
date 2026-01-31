
/*
 * Author: Cascade (Claude)
 * Date: 2026-01-31
 * PURPOSE: High-level service for running community games. Manages game sessions,
 *          coordinates with the Python bridge, and handles state persistence.
 * SRP/DRY check: Pass — single-purpose game session orchestration.
 */

import { v4 as uuidv4 } from 'uuid';
import { CommunityGamePythonBridge, createGameBridgeById, createGameBridgeByPath, type FrameData, type GameAction } from './CommunityGamePythonBridge';
import { CommunityGameStorage } from './CommunityGameStorage';
import { CommunityGameRepository, type CommunityGame } from '../../repositories/CommunityGameRepository';
import { logger } from '../../utils/logger';

// Featured community games from ARCEngine registry (not stored as files)
// Note: These are NOT official ARC Prize Foundation games - they are community creations
const FEATURED_COMMUNITY_GAMES = new Set(['world_shifter', 'chain_reaction']);

export interface GameSession {
  sessionGuid: string;
  gameId: string;
  game: CommunityGame;
  bridge: CommunityGamePythonBridge;
  currentFrame: FrameData | null;
  actionHistory: Array<{ action: string; timestamp: Date; frame: FrameData }>;
  startedAt: Date;
  state: 'active' | 'won' | 'lost' | 'abandoned';
}

export interface StartGameResult {
  sessionGuid: string;
  frame: FrameData;
  game: {
    gameId: string;
    displayName: string;
    winScore: number;
    maxActions: number | null;
  };
}

export interface ActionResult {
  frame: FrameData;
  isGameOver: boolean;
  isWin: boolean;
}

// Active sessions cache (in production, would use Redis or similar)
const activeSessions = new Map<string, GameSession>();

// Session timeout (15 minutes of inactivity)
const SESSION_TIMEOUT_MS = 15 * 60 * 1000;

export class CommunityGameRunner {
  private repository: CommunityGameRepository;

  constructor(repository: CommunityGameRepository) {
    this.repository = repository;
  }

  /**
   * Start a new game session
   */
  async startGame(gameId: string): Promise<StartGameResult> {
    const isFeaturedGame = FEATURED_COMMUNITY_GAMES.has(gameId);
    let game: CommunityGame;
    let bridge: CommunityGamePythonBridge;

    if (isFeaturedGame) {
      // Featured community game from ARCEngine registry - create virtual game record
      game = {
        id: 0,
        gameId,
        displayName: gameId === 'world_shifter' ? 'World Shifter' : 'Chain Reaction',
        description: gameId === 'world_shifter' 
          ? 'The world moves, not you. Navigate mazes by shifting walls toward your fixed position.'
          : 'Match colors. Clear the board. Escape.',
        authorName: 'ARCEngine Team',
        authorEmail: null,
        version: '0.0.1',
        difficulty: 'medium',
        levelCount: gameId === 'world_shifter' ? 3 : 1,
        winScore: 1,
        maxActions: null,
        tags: ['featured', 'puzzle'],
        sourceFilePath: '',  // No file for featured games (loaded from registry)
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
        uploadedAt: new Date(),
        updatedAt: new Date(),
      };

      // Create Python bridge using game registry
      try {
        bridge = await createGameBridgeById(gameId);
      } catch (error) {
        logger.error(`Failed to start featured game ${gameId}: ${error}`, 'game-runner');
        throw new Error('Failed to initialize game');
      }
    } else {
      // Community uploaded game - get from database
      const dbGame = await this.repository.getGameByGameId(gameId);
      if (!dbGame) {
        throw new Error(`Game not found: ${gameId}`);
      }

      if (dbGame.status !== 'approved' || !dbGame.isPlayable) {
        throw new Error(`Game is not available for play: ${gameId}`);
      }

      // Verify file integrity
      const isValid = await CommunityGameStorage.verifyFileHash(dbGame.sourceFilePath, dbGame.sourceHash);
      if (!isValid) {
        logger.error(`File integrity check failed for game ${gameId}`, 'game-runner');
        throw new Error('Game file integrity check failed');
      }

      game = dbGame;

      // Create Python bridge using file path
      try {
        bridge = await createGameBridgeByPath(game.sourceFilePath);
      } catch (error) {
        logger.error(`Failed to start game ${gameId}: ${error}`, 'game-runner');
        throw new Error('Failed to initialize game');
      }
    }

    // Generate session GUID
    const sessionGuid = uuidv4();

    // Get initial frame
    const initialFrame = await bridge.executeAction({ action: 'RESET' });

    // Create session record
    const session: GameSession = {
      sessionGuid,
      gameId: game.gameId,
      game,
      bridge,
      currentFrame: initialFrame,
      actionHistory: [{
        action: 'RESET',
        timestamp: new Date(),
        frame: initialFrame,
      }],
      startedAt: new Date(),
      state: 'active',
    };

    // Store session
    activeSessions.set(sessionGuid, session);

    // Create database session record
    try {
      await this.repository.createSession(game.id, sessionGuid, game.winScore);
    } catch (error) {
      logger.warn(`Failed to create session record: ${error}`, 'game-runner');
      // Continue anyway - session can work without DB record
    }

    // Increment play count
    await this.repository.incrementPlayCount(gameId);

    // Set up session timeout
    this.scheduleSessionCleanup(sessionGuid);

    logger.info(`Started game session ${sessionGuid} for game ${gameId}`, 'game-runner');

    return {
      sessionGuid,
      frame: initialFrame,
      game: {
        gameId: game.gameId,
        displayName: game.displayName,
        winScore: game.winScore,
        maxActions: game.maxActions,
      },
    };
  }

  /**
   * Execute an action in an active game session
   */
  async executeAction(sessionGuid: string, action: GameAction): Promise<ActionResult> {
    const session = activeSessions.get(sessionGuid);
    if (!session) {
      throw new Error('Session not found or expired');
    }

    if (session.state !== 'active') {
      throw new Error(`Game is already ${session.state}`);
    }

    if (!session.bridge.ready) {
      throw new Error('Game session is not ready');
    }

    // Execute action via bridge
    const frame = await session.bridge.executeAction(action);

    // Update session state
    session.currentFrame = frame;
    session.actionHistory.push({
      action: action.action,
      timestamp: new Date(),
      frame,
    });

    // Check game state
    const isWin = frame.state === 'WIN' || frame.score >= session.game.winScore;
    const isLoss = frame.state === 'LOSE' || 
                   (session.game.maxActions && frame.action_counter >= session.game.maxActions);
    const isGameOver = isWin || isLoss || frame.state === 'GAME_OVER';

    if (isGameOver) {
      session.state = isWin ? 'won' : 'lost';
      
      // Record result
      try {
        await this.repository.recordGameResult(session.gameId, isWin, frame.score);
        await this.repository.updateSession(sessionGuid, {
          state: session.state.toUpperCase(),
          finalScore: frame.score,
          totalFrames: frame.action_counter,
          endedAt: new Date(),
        });
      } catch (error) {
        logger.warn(`Failed to record game result: ${error}`, 'game-runner');
      }

      // Cleanup session after a short delay
      setTimeout(() => this.cleanupSession(sessionGuid), 5000);
    }

    // Reset session timeout
    this.scheduleSessionCleanup(sessionGuid);

    return {
      frame,
      isGameOver,
      isWin: isWin,
    };
  }

  /**
   * Get current session state
   */
  getSession(sessionGuid: string): GameSession | null {
    return activeSessions.get(sessionGuid) || null;
  }

  /**
   * Get current frame for a session
   */
  getCurrentFrame(sessionGuid: string): FrameData | null {
    const session = activeSessions.get(sessionGuid);
    return session?.currentFrame || null;
  }

  /**
   * Abandon a game session
   */
  async abandonSession(sessionGuid: string): Promise<void> {
    const session = activeSessions.get(sessionGuid);
    if (!session) return;

    session.state = 'abandoned';

    try {
      await this.repository.updateSession(sessionGuid, {
        state: 'ABANDONED',
        endedAt: new Date(),
      });
    } catch (error) {
      logger.warn(`Failed to update abandoned session: ${error}`, 'game-runner');
    }

    this.cleanupSession(sessionGuid);
  }

  /**
   * Clean up a session
   */
  private cleanupSession(sessionGuid: string): void {
    const session = activeSessions.get(sessionGuid);
    if (!session) return;

    try {
      session.bridge.kill();
    } catch {
      // Bridge may already be dead
    }

    activeSessions.delete(sessionGuid);
    logger.info(`Cleaned up session ${sessionGuid}`, 'game-runner');
  }

  /**
   * Schedule automatic session cleanup
   */
  private sessionTimeouts = new Map<string, NodeJS.Timeout>();

  private scheduleSessionCleanup(sessionGuid: string): void {
    // Clear existing timeout
    const existing = this.sessionTimeouts.get(sessionGuid);
    if (existing) {
      clearTimeout(existing);
    }

    // Set new timeout
    const timeout = setTimeout(() => {
      logger.info(`Session ${sessionGuid} timed out`, 'game-runner');
      this.abandonSession(sessionGuid);
    }, SESSION_TIMEOUT_MS);

    this.sessionTimeouts.set(sessionGuid, timeout);
  }

  /**
   * Get count of active sessions
   */
  getActiveSessionCount(): number {
    return activeSessions.size;
  }

  /**
   * Clean up all sessions (for shutdown)
   */
  cleanupAll(): void {
    for (const sessionGuid of activeSessions.keys()) {
      this.cleanupSession(sessionGuid);
    }
    for (const timeout of this.sessionTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.sessionTimeouts.clear();
  }
}
