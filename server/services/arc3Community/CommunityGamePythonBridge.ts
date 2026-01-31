/*
 * Author: Cascade (Claude)
 * Date: 2026-01-31
 * PURPOSE: Python subprocess bridge for executing community ARCEngine games.
 *          Manages spawning, communication via stdin/stdout NDJSON, and cleanup.
 *          Based on the pattern from Arc3OpenRouterPythonBridge.ts.
 * SRP/DRY check: Pass — single-purpose subprocess management for game execution.
 */

import { spawn, type ChildProcess } from 'child_process';
import * as path from 'path';
import * as readline from 'readline';
import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';

const PYTHON_RUNNER_PATH = path.join(__dirname, '..', '..', 'python', 'community_game_runner.py');
const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds for game operations

export interface FrameData {
  type: 'frame';
  game_id: string;
  frame: number[][][];
  score: number;
  state: string;
  action_counter: number;
  max_actions: number;
  win_score: number;
  available_actions: string[];
  last_action: string;
}

export interface ReadyData {
  type: 'ready';
  game_id: string;
  metadata: {
    game_id: string;
    level_count: number;
    win_score: number;
    max_actions: number;
  };
}

export interface ErrorData {
  type: 'error';
  code: string;
  message: string;
}

export type BridgeMessage = FrameData | ReadyData | ErrorData;

export interface GameAction {
  action: 'RESET' | 'ACTION1' | 'ACTION2' | 'ACTION3' | 'ACTION4' | 'ACTION5' | 'ACTION6' | 'ACTION7';
  coordinates?: [number, number];
}

export interface BridgeConfig {
  gameId?: string;        // For official games via registry
  gameFilePath?: string;  // For community uploaded games
}

export class CommunityGamePythonBridge extends EventEmitter {
  private process: ChildProcess | null = null;
  private readline: readline.Interface | null = null;
  private config: BridgeConfig;
  private isReady: boolean = false;
  private isClosed: boolean = false;
  private pendingResolvers: Map<string, { resolve: (data: FrameData) => void; reject: (err: Error) => void }> = new Map();
  private actionCounter: number = 0;

  constructor(config: BridgeConfig) {
    super();
    this.config = config;
    if (!config.gameId && !config.gameFilePath) {
      throw new Error('Either gameId or gameFilePath must be provided');
    }
  }

  /**
   * Start the Python subprocess and initialize the game
   */
  async start(): Promise<ReadyData> {
    if (this.process) {
      throw new Error('Bridge already started');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.kill();
        reject(new Error('Game initialization timed out'));
      }, DEFAULT_TIMEOUT_MS);

      try {
        // Spawn Python process
        this.process = spawn('python', [PYTHON_RUNNER_PATH], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, PYTHONUNBUFFERED: '1' },
        });

        // Handle stderr for debugging
        this.process.stderr?.on('data', (data: Buffer) => {
          const msg = data.toString().trim();
          if (msg) {
            logger.warn(`[CommunityGame stderr] ${msg}`, 'python-bridge');
          }
        });

        // Set up readline for stdout NDJSON parsing
        this.readline = readline.createInterface({
          input: this.process.stdout!,
          terminal: false,
        });

        this.readline.on('line', (line: string) => {
          this.handleMessage(line);
        });

        // Handle process events
        this.process.on('error', (err) => {
          clearTimeout(timeout);
          logger.error(`Python process error: ${err.message}`, 'python-bridge');
          this.cleanup();
          reject(err);
        });

        this.process.on('exit', (code) => {
          if (!this.isClosed) {
            logger.info(`Python process exited with code ${code}`, 'python-bridge');
            this.cleanup();
          }
        });

        // Wait for ready signal
        const readyHandler = (data: ReadyData) => {
          clearTimeout(timeout);
          this.isReady = true;
          this.removeListener('ready', readyHandler);
          resolve(data);
        };

        const errorHandler = (data: ErrorData) => {
          clearTimeout(timeout);
          this.removeListener('error', errorHandler);
          reject(new Error(`Game initialization failed: ${data.message}`));
        };

        this.on('ready', readyHandler);
        this.on('bridge_error', errorHandler);

        // Send initialization payload
        const initPayload = JSON.stringify({ 
          game_id: this.config.gameId,
          game_path: this.config.gameFilePath 
        }) + '\n';
        this.process.stdin?.write(initPayload);

      } catch (error) {
        clearTimeout(timeout);
        this.cleanup();
        reject(error);
      }
    });
  }

  /**
   * Execute a game action and wait for the frame response
   */
  async executeAction(action: GameAction): Promise<FrameData> {
    if (!this.isReady || !this.process || this.isClosed) {
      throw new Error('Bridge not ready or closed');
    }

    return new Promise((resolve, reject) => {
      const actionId = `action_${++this.actionCounter}`;
      const timeout = setTimeout(() => {
        this.pendingResolvers.delete(actionId);
        reject(new Error(`Action ${action.action} timed out`));
      }, DEFAULT_TIMEOUT_MS);

      this.pendingResolvers.set(actionId, {
        resolve: (data: FrameData) => {
          clearTimeout(timeout);
          this.pendingResolvers.delete(actionId);
          resolve(data);
        },
        reject: (err: Error) => {
          clearTimeout(timeout);
          this.pendingResolvers.delete(actionId);
          reject(err);
        },
      });

      // Send action command
      const command = JSON.stringify({
        action: action.action,
        coordinates: action.coordinates,
      }) + '\n';

      this.process!.stdin?.write(command);
    });
  }

  /**
   * Handle incoming NDJSON messages from Python
   */
  private handleMessage(line: string): void {
    if (!line.trim()) return;

    try {
      const data = JSON.parse(line) as BridgeMessage;

      switch (data.type) {
        case 'ready':
          this.emit('ready', data);
          break;

        case 'frame':
          // Resolve any pending action
          const resolver = [...this.pendingResolvers.values()][0];
          if (resolver) {
            resolver.resolve(data);
          }
          this.emit('frame', data);
          break;

        case 'error':
          logger.error(`Game error: [${data.code}] ${data.message}`, 'python-bridge');
          // Reject any pending action
          const errorResolver = [...this.pendingResolvers.values()][0];
          if (errorResolver) {
            errorResolver.reject(new Error(data.message));
          }
          this.emit('bridge_error', data);
          break;

        default:
          logger.warn(`Unknown message type: ${JSON.stringify(data)}`, 'python-bridge');
      }
    } catch (error) {
      logger.error(`Failed to parse Python output: ${line}`, 'python-bridge');
    }
  }

  /**
   * Kill the subprocess and cleanup
   */
  kill(): void {
    this.isClosed = true;
    this.cleanup();
  }

  /**
   * Check if the bridge is ready for actions
   */
  get ready(): boolean {
    return this.isReady && !this.isClosed;
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    if (this.readline) {
      this.readline.close();
      this.readline = null;
    }

    if (this.process) {
      try {
        this.process.kill('SIGTERM');
      } catch {
        // Process may already be dead
      }
      this.process = null;
    }

    // Reject all pending resolvers
    for (const resolver of this.pendingResolvers.values()) {
      resolver.reject(new Error('Bridge closed'));
    }
    this.pendingResolvers.clear();

    this.isReady = false;
    this.removeAllListeners();
  }
}

/**
 * Factory function to create and start a bridge for an official game (by ID)
 */
export async function createGameBridgeById(gameId: string): Promise<CommunityGamePythonBridge> {
  const bridge = new CommunityGamePythonBridge({ gameId });
  await bridge.start();
  return bridge;
}

/**
 * Factory function to create and start a bridge for a community game (by file path)
 */
export async function createGameBridgeByPath(gameFilePath: string): Promise<CommunityGamePythonBridge> {
  const bridge = new CommunityGamePythonBridge({ gameFilePath });
  await bridge.start();
  return bridge;
}

/**
 * Factory function to create and start a bridge with full config
 */
export async function createGameBridge(config: BridgeConfig): Promise<CommunityGamePythonBridge> {
  const bridge = new CommunityGamePythonBridge(config);
  await bridge.start();
  return bridge;
}
