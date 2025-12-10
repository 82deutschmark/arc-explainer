/*
Author: Claude Code using Sonnet 4.5
Date: 2025-11-06
PURPOSE: HTTP client for the ARC-AGI-3 API at three.arcprize.org. Matches the official ARC-AGI-3-ClaudeCode-SDK reference implementation.
Key endpoints: /api/scorecard/open, /api/games, /api/cmd/RESET, /api/cmd/{ACTION1-6}
Manages scorecard lifecycle (required before starting games) and all game operations.
SRP/DRY check: Pass — encapsulates all ARC3 API communication separate from game logic and agent orchestration.
*/

/**
 * Game info structure returned by /api/games endpoint
 */
export interface GameInfo {
  game_id: string;  // e.g., "ls20", "as66"
  title: string;    // Human-readable title
}

/**
 * Frame data structure returned by game actions
 * Frame can be a 3D array: [layer][height][width] with values 0-15 (color indices)
 * OR a collection of frames (4D): [frameIndex][layer][height][width]
 */
export interface FrameData {
  guid: string;
  game_id: string;
  frame: number[][][] | number[][][][];
  score: number;
  state: string;  // 'NOT_PLAYED' | 'IN_PROGRESS' | 'WIN' | 'GAME_OVER'
  action_counter: number | null;
  max_actions: number;
  win_score: number;
  full_reset?: boolean;
  available_actions?: Array<string | number>;  // API may return numeric or string action identifiers
}

/**
 * Game action request structure
 * Actions 1-7 are supported by the ARC3 API (plus RESET which is action 0)
 */
export interface GameAction {
  action: 'RESET' | 'ACTION1' | 'ACTION2' | 'ACTION3' | 'ACTION4' | 'ACTION5' | 'ACTION6' | 'ACTION7';
  coordinates?: [number, number];  // For ACTION6 only (x, y)
}

export class Arc3ApiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private cardId: string | null = null;

  constructor(apiKey: string) {
    this.baseUrl = 'https://three.arcprize.org';
    this.apiKey = apiKey;
  }

  private normalizeFrame(frame: FrameData): FrameData {
    const normalizeAvailableActions = (tokens?: Array<string | number>): string[] | undefined => {
      if (!tokens || tokens.length === 0) return undefined;
      const normalized = tokens
        .map((token) => {
          if (typeof token === 'number') {
            return token === 0 ? 'RESET' : `ACTION${token}`;
          }
          const trimmed = token.trim();
          if (!trimmed) return null;
          const upper = trimmed.toUpperCase();
          if (upper === 'RESET') return 'RESET';
          if (/^ACTION\d+$/.test(upper)) return upper;
          if (/^\d+$/.test(upper)) return upper === '0' ? 'RESET' : `ACTION${upper}`;
          return upper;
        })
        .filter((value): value is string => value !== null);
      return normalized.length > 0 ? normalized : undefined;
    };

    return {
      ...frame,
      available_actions: normalizeAvailableActions(frame.available_actions),
      action_counter: frame.action_counter ?? 0,
    };
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'X-API-Key': this.apiKey,
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ARC3 API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return await response.json() as T;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`ARC3 API network error: ${error.message}`);
      }
      throw new Error('Unknown ARC3 API error');
    }
  }

  /**
   * Open a new scorecard. MUST be called before starting any games.
   * Reference: ARC-AGI-3-ClaudeCode-SDK/actions/open-scorecard.js
   */
  async openScorecard(tags?: string[], sourceUrl?: string, metadata?: any): Promise<string> {
    const requestBody: any = {};

    if (sourceUrl) {
      requestBody.source_url = sourceUrl;
    }

    if (tags && tags.length > 0) {
      requestBody.tags = tags;
    }

    if (metadata) {
      requestBody.opaque = metadata;
    }

    const response = await this.makeRequest<{ card_id: string }>('/api/scorecard/open', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    this.cardId = response.card_id;
    return this.cardId;
  }

  /**
   * Get the current scorecard ID (if one has been opened)
   */
  getCardId(): string | null {
    return this.cardId;
  }

  /**
   * List all available games
   * Reference: ARC-AGI-3-ClaudeCode-SDK/actions/list-games.js line 8
   */
  async listGames(): Promise<GameInfo[]> {
    return this.makeRequest<GameInfo[]>('/api/games');
  }

  /**
   * Start a new game session using RESET command
   * Reference: ARC-AGI-3-ClaudeCode-SDK/actions/start-game.js lines 40-48
   */
  async startGame(gameId: string, seedFrame?: FrameData, cardIdOverride?: string): Promise<FrameData> {
    if (seedFrame && seedFrame.game_id === gameId) {
      return this.normalizeFrame(seedFrame);
    }

    const cardId = cardIdOverride ?? this.cardId;
    if (!cardId) {
      throw new Error('Must open scorecard before starting game. Call openScorecard() first.');
    }

    const requestBody = {
      game_id: gameId,
      card_id: cardId,
    };

    const frame = await this.makeRequest<FrameData>('/api/cmd/RESET', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    return this.normalizeFrame(frame);
  }

  /**
   * Execute an action in a game session
   * Reference: ARC-AGI-3-ClaudeCode-SDK/actions/action.js lines 92-95
   */
  async executeAction(
    gameId: string,
    guid: string,
    action: GameAction,
    reasoning?: any,
    cardIdOverride?: string,
  ): Promise<FrameData> {
    const body: any = {
      game_id: gameId,  // Required by ARC3 API
      guid,
    };

    // ACTION6 includes coordinates
    if (action.coordinates && action.action === 'ACTION6') {
      body.x = action.coordinates[0];
      body.y = action.coordinates[1];
    }

    // RESET requires the active scorecard id
    // Reference: ARC-AGI-3-ClaudeCode-SDK/actions/reset-game.js
    if (action.action === 'RESET') {
      const cardId = cardIdOverride ?? this.cardId;
      if (!cardId) {
        throw new Error('Must open scorecard before resetting game. Call openScorecard() first.');
      }
      body.card_id = cardId;
    }

    if (reasoning && action.action !== 'RESET') {
      body.reasoning = reasoning;
    }

    const frame = await this.makeRequest<FrameData>(`/api/cmd/${action.action}`, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    return this.normalizeFrame(frame);
  }
}
