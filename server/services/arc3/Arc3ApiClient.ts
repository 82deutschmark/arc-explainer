/*
Author: Claude (Windsurf Cascade)
Date: 2025-11-06
PURPOSE: HTTP client for the ARC-AGI-3 API at three.arcprize.org, providing methods to list games, start games, execute actions, and check status.
SRP/DRY check: Pass — encapsulates all ARC3 API communication separate from game logic and agent orchestration.
*/

export interface GameInfo {
  id: string;
  name: string;
  description: string;
  difficulty?: string;
  category?: string;
}

export interface FrameData {
  frame: number[][][];  // 3D array: [time][height][width] with values 0-15
  score: number;
  state: 'NOT_PLAYED' | 'IN_PROGRESS' | 'WIN' | 'GAME_OVER';
  action_counter: number;
  max_actions: number;
  full_reset: boolean;
}

export interface GameAction {
  action: 'RESET' | 'ACTION1' | 'ACTION2' | 'ACTION3' | 'ACTION4' | 'ACTION5' | 'ACTION6';
  coordinates?: [number, number];  // For ACTION6 only
}

export interface GameStatus {
  guid: string;
  game_id: string;
  state: string;
  score: number;
  action_counter: number;
  max_actions: number;
}

export class Arc3ApiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.baseUrl = 'https://three.arcprize.org/api';
    this.apiKey = apiKey;
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
   * List all available games
   */
  async listGames(): Promise<GameInfo[]> {
    return this.makeRequest<GameInfo[]>('/games');
  }

  /**
   * Start a new game session
   */
  async startGame(gameId: string): Promise<{ guid: string; frame_data: FrameData }> {
    return this.makeRequest<{ guid: string; frame_data: FrameData }>(`/games/${gameId}/start`, {
      method: 'POST',
    });
  }

  /**
   * Execute an action in a game session
   */
  async executeAction(guid: string, action: GameAction): Promise<FrameData> {
    return this.makeRequest<FrameData>(`/games/${guid}/action`, {
      method: 'POST',
      body: JSON.stringify(action),
    });
  }

  /**
   * Get the current status of a game session
   */
  async getStatus(guid: string): Promise<GameStatus> {
    return this.makeRequest<GameStatus>(`/games/${guid}/status`);
  }

  /**
   * Get the current frame data for a game session
   */
  async getFrameData(guid: string): Promise<FrameData> {
    return this.makeRequest<FrameData>(`/games/${guid}/frame`);
  }
}
