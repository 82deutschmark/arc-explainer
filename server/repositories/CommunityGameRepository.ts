/*
 * Author: Cascade (Claude)
 * Date: 2026-01-31
 * PURPOSE: Repository for community game CRUD operations. Manages game metadata,
 *          session tracking, and statistics for user-uploaded ARCEngine games.
 * SRP/DRY check: Pass — single-purpose data access layer for community games.
 */

import { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger';

export type GameStatus = 'pending' | 'approved' | 'rejected' | 'archived';
export type GameDifficulty = 'easy' | 'medium' | 'hard' | 'very-hard' | 'unknown';

export interface CommunityGame {
  id: number;
  gameId: string;
  displayName: string;
  description: string | null;
  authorName: string;
  authorEmail: string | null;
  version: string;
  difficulty: GameDifficulty;
  levelCount: number;
  winScore: number;
  maxActions: number | null;
  tags: string[];
  sourceFilePath: string;
  sourceHash: string;
  thumbnailPath: string | null;
  status: GameStatus;
  isFeatured: boolean;
  isPlayable: boolean;
  validatedAt: Date | null;
  validationErrors: Record<string, unknown> | null;
  playCount: number;
  totalWins: number;
  totalLosses: number;
  averageScore: number | null;
  uploadedAt: Date;
  updatedAt: Date;
}

export interface CommunityGameSession {
  id: number;
  gameId: number;
  sessionGuid: string;
  state: string;
  finalScore: number;
  winScore: number;
  totalFrames: number;
  startedAt: Date;
  endedAt: Date | null;
}

export interface CreateGameInput {
  gameId: string;
  displayName: string;
  description?: string;
  authorName: string;
  authorEmail?: string;
  version?: string;
  difficulty?: GameDifficulty;
  levelCount?: number;
  winScore?: number;
  maxActions?: number;
  tags?: string[];
  sourceFilePath: string;
  sourceHash: string;
  thumbnailPath?: string;
}

export interface UpdateGameInput {
  displayName?: string;
  description?: string;
  version?: string;
  difficulty?: GameDifficulty;
  levelCount?: number;
  winScore?: number;
  maxActions?: number;
  tags?: string[];
  thumbnailPath?: string;
  status?: GameStatus;
  isFeatured?: boolean;
  isPlayable?: boolean;
  validatedAt?: Date;
  validationErrors?: Record<string, unknown>;
}

export interface GameListOptions {
  status?: GameStatus;
  difficulty?: GameDifficulty;
  authorName?: string;
  tags?: string[];
  isFeatured?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
  orderBy?: 'uploadedAt' | 'playCount' | 'displayName';
  orderDir?: 'ASC' | 'DESC';
}

export class CommunityGameRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Create a new community game entry
   */
  async createGame(input: CreateGameInput): Promise<CommunityGame> {
    const query = `
      INSERT INTO community_games (
        game_id, display_name, description, author_name, author_email,
        version, difficulty, level_count, win_score, max_actions,
        tags, source_file_path, source_hash, thumbnail_path
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
      )
      RETURNING *
    `;

    const values = [
      input.gameId,
      input.displayName,
      input.description || null,
      input.authorName,
      input.authorEmail || null,
      input.version || '1.0.0',
      input.difficulty || 'unknown',
      input.levelCount || 1,
      input.winScore || 1,
      input.maxActions || null,
      input.tags || [],
      input.sourceFilePath,
      input.sourceHash,
      input.thumbnailPath || null,
    ];

    const result = await this.pool.query(query, values);
    logger.info(`Created community game: ${input.gameId}`, 'community-games');
    return this.mapRowToGame(result.rows[0]);
  }

  /**
   * Get a game by its unique game_id
   */
  async getGameByGameId(gameId: string): Promise<CommunityGame | null> {
    const query = `SELECT * FROM community_games WHERE game_id = $1`;
    const result = await this.pool.query(query, [gameId]);
    return result.rows.length > 0 ? this.mapRowToGame(result.rows[0]) : null;
  }

  /**
   * Get a game by its numeric id
   */
  async getGameById(id: number): Promise<CommunityGame | null> {
    const query = `SELECT * FROM community_games WHERE id = $1`;
    const result = await this.pool.query(query, [id]);
    return result.rows.length > 0 ? this.mapRowToGame(result.rows[0]) : null;
  }

  /**
   * List games with filtering and pagination
   */
  async listGames(options: GameListOptions = {}): Promise<{ games: CommunityGame[]; total: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramCount = 0;

    if (options.status) {
      conditions.push(`status = $${++paramCount}`);
      values.push(options.status);
    }

    if (options.difficulty) {
      conditions.push(`difficulty = $${++paramCount}`);
      values.push(options.difficulty);
    }

    if (options.authorName) {
      conditions.push(`author_name ILIKE $${++paramCount}`);
      values.push(`%${options.authorName}%`);
    }

    if (options.tags && options.tags.length > 0) {
      conditions.push(`tags && $${++paramCount}`);
      values.push(options.tags);
    }

    if (options.isFeatured !== undefined) {
      conditions.push(`is_featured = $${++paramCount}`);
      values.push(options.isFeatured);
    }

    if (options.search) {
      conditions.push(`(display_name ILIKE $${++paramCount} OR description ILIKE $${paramCount})`);
      values.push(`%${options.search}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count query
    const countQuery = `SELECT COUNT(*) FROM community_games ${whereClause}`;
    const countResult = await this.pool.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count, 10);

    // Data query with ordering and pagination
    const orderBy = options.orderBy || 'uploadedAt';
    const orderDir = options.orderDir || 'DESC';
    const orderColumn = orderBy === 'uploadedAt' ? 'uploaded_at' : 
                        orderBy === 'playCount' ? 'play_count' : 'display_name';

    const limit = options.limit || 50;
    const offset = options.offset || 0;

    const dataQuery = `
      SELECT * FROM community_games 
      ${whereClause}
      ORDER BY ${orderColumn} ${orderDir}
      LIMIT $${++paramCount} OFFSET $${++paramCount}
    `;
    values.push(limit, offset);

    const dataResult = await this.pool.query(dataQuery, values);
    const games = dataResult.rows.map(row => this.mapRowToGame(row));

    return { games, total };
  }

  /**
   * Update a game's metadata
   */
  async updateGame(gameId: string, updates: UpdateGameInput): Promise<CommunityGame | null> {
    const setClauses: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const values: unknown[] = [];
    let paramCount = 0;

    const fieldMap: Record<string, string> = {
      displayName: 'display_name',
      description: 'description',
      version: 'version',
      difficulty: 'difficulty',
      levelCount: 'level_count',
      winScore: 'win_score',
      maxActions: 'max_actions',
      tags: 'tags',
      thumbnailPath: 'thumbnail_path',
      status: 'status',
      isFeatured: 'is_featured',
      isPlayable: 'is_playable',
      validatedAt: 'validated_at',
      validationErrors: 'validation_errors',
    };

    for (const [key, column] of Object.entries(fieldMap)) {
      if (key in updates && (updates as Record<string, unknown>)[key] !== undefined) {
        setClauses.push(`${column} = $${++paramCount}`);
        values.push((updates as Record<string, unknown>)[key]);
      }
    }

    if (setClauses.length === 1) {
      return this.getGameByGameId(gameId);
    }

    values.push(gameId);
    const query = `
      UPDATE community_games 
      SET ${setClauses.join(', ')}
      WHERE game_id = $${++paramCount}
      RETURNING *
    `;

    const result = await this.pool.query(query, values);
    if (result.rows.length === 0) return null;

    logger.info(`Updated community game: ${gameId}`, 'community-games');
    return this.mapRowToGame(result.rows[0]);
  }

  /**
   * Increment play count for a game
   */
  async incrementPlayCount(gameId: string): Promise<void> {
    const query = `
      UPDATE community_games 
      SET play_count = play_count + 1, updated_at = CURRENT_TIMESTAMP
      WHERE game_id = $1
    `;
    await this.pool.query(query, [gameId]);
  }

  /**
   * Record a game result (win/loss)
   */
  async recordGameResult(gameId: string, isWin: boolean, score: number): Promise<void> {
    const query = `
      UPDATE community_games 
      SET 
        ${isWin ? 'total_wins = total_wins + 1' : 'total_losses = total_losses + 1'},
        average_score = COALESCE(
          (average_score * (total_wins + total_losses) + $2) / (total_wins + total_losses + 1),
          $2
        ),
        updated_at = CURRENT_TIMESTAMP
      WHERE game_id = $1
    `;
    await this.pool.query(query, [gameId, score]);
  }

  /**
   * Create a new game session
   */
  async createSession(gameId: number, sessionGuid: string, winScore: number): Promise<CommunityGameSession> {
    const query = `
      INSERT INTO community_game_sessions (game_id, session_guid, win_score)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const result = await this.pool.query(query, [gameId, sessionGuid, winScore]);
    return this.mapRowToSession(result.rows[0]);
  }

  /**
   * Get a session by guid
   */
  async getSessionByGuid(sessionGuid: string): Promise<CommunityGameSession | null> {
    const query = `SELECT * FROM community_game_sessions WHERE session_guid = $1`;
    const result = await this.pool.query(query, [sessionGuid]);
    return result.rows.length > 0 ? this.mapRowToSession(result.rows[0]) : null;
  }

  /**
   * Update session state
   */
  async updateSession(
    sessionGuid: string, 
    updates: { state?: string; finalScore?: number; totalFrames?: number; endedAt?: Date }
  ): Promise<void> {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramCount = 0;

    if (updates.state) {
      setClauses.push(`state = $${++paramCount}`);
      values.push(updates.state);
    }
    if (updates.finalScore !== undefined) {
      setClauses.push(`final_score = $${++paramCount}`);
      values.push(updates.finalScore);
    }
    if (updates.totalFrames !== undefined) {
      setClauses.push(`total_frames = $${++paramCount}`);
      values.push(updates.totalFrames);
    }
    if (updates.endedAt) {
      setClauses.push(`ended_at = $${++paramCount}`);
      values.push(updates.endedAt);
    }

    if (setClauses.length === 0) return;

    values.push(sessionGuid);
    const query = `
      UPDATE community_game_sessions 
      SET ${setClauses.join(', ')}
      WHERE session_guid = $${++paramCount}
    `;
    await this.pool.query(query, values);
  }

  /**
   * Get featured games
   */
  async getFeaturedGames(limit: number = 6): Promise<CommunityGame[]> {
    const query = `
      SELECT * FROM community_games 
      WHERE is_featured = true AND status = 'approved' AND is_playable = true
      ORDER BY play_count DESC
      LIMIT $1
    `;
    const result = await this.pool.query(query, [limit]);
    return result.rows.map(row => this.mapRowToGame(row));
  }

  /**
   * Get popular games by play count
   */
  async getPopularGames(limit: number = 10): Promise<CommunityGame[]> {
    const query = `
      SELECT * FROM community_games 
      WHERE status = 'approved' AND is_playable = true
      ORDER BY play_count DESC
      LIMIT $1
    `;
    const result = await this.pool.query(query, [limit]);
    return result.rows.map(row => this.mapRowToGame(row));
  }

  /**
   * Check if a game_id already exists
   */
  async gameIdExists(gameId: string): Promise<boolean> {
    const query = `SELECT 1 FROM community_games WHERE game_id = $1 LIMIT 1`;
    const result = await this.pool.query(query, [gameId]);
    return result.rows.length > 0;
  }

  private mapRowToGame(row: Record<string, unknown>): CommunityGame {
    return {
      id: row.id as number,
      gameId: row.game_id as string,
      displayName: row.display_name as string,
      description: row.description as string | null,
      authorName: row.author_name as string,
      authorEmail: row.author_email as string | null,
      version: row.version as string,
      difficulty: row.difficulty as GameDifficulty,
      levelCount: row.level_count as number,
      winScore: row.win_score as number,
      maxActions: row.max_actions as number | null,
      tags: row.tags as string[],
      sourceFilePath: row.source_file_path as string,
      sourceHash: row.source_hash as string,
      thumbnailPath: row.thumbnail_path as string | null,
      status: row.status as GameStatus,
      isFeatured: row.is_featured as boolean,
      isPlayable: row.is_playable as boolean,
      validatedAt: row.validated_at ? new Date(row.validated_at as string) : null,
      validationErrors: row.validation_errors as Record<string, unknown> | null,
      playCount: row.play_count as number,
      totalWins: row.total_wins as number,
      totalLosses: row.total_losses as number,
      averageScore: row.average_score as number | null,
      uploadedAt: new Date(row.uploaded_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  private mapRowToSession(row: Record<string, unknown>): CommunityGameSession {
    return {
      id: row.id as number,
      gameId: row.game_id as number,
      sessionGuid: row.session_guid as string,
      state: row.state as string,
      finalScore: row.final_score as number,
      winScore: row.win_score as number,
      totalFrames: row.total_frames as number,
      startedAt: new Date(row.started_at as string),
      endedAt: row.ended_at ? new Date(row.ended_at as string) : null,
    };
  }
}
