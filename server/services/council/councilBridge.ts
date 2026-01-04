/**
 * Author: Claude Sonnet 4 (Cascade)
 * Date: 2026-01-02
 * PURPOSE: Python subprocess bridge for LLM Council integration.
 *          Follows the same pattern as pythonBridge.ts (Saturn/Beetree/Grover).
 *          Spawns council_wrapper.py subprocess, communicates via stdin/stdout NDJSON.
 * SRP/DRY check: Pass - Single responsibility: subprocess management for council.
 */

import { spawn, type SpawnOptions } from 'child_process';
import path from 'path';
import * as readline from 'readline';
import fs from 'fs';
import { logger } from '../../utils/logger.ts';

// Configuration
const COUNCIL_TIMEOUT_MS = parseInt(process.env.COUNCIL_TIMEOUT_MS || '1200000', 10); // 20 min default for council

// Log muting for health check failures
let lastHealthCheckFailureTime: number | null = null;
const HEALTH_CHECK_MUTE_MS = 5 * 60 * 1000; // 5 minutes

export interface CouncilStage1Result {
  model: string;
  response: string;
}

export interface CouncilStage2Result {
  model: string;
  ranking: string;
  parsed_ranking: string[];
}

export interface CouncilStage3Result {
  model: string;
  response: string;
}

export interface CouncilMetadata {
  label_to_model: Record<string, string>;
  aggregate_rankings: Array<{
    model: string;
    average_rank: number;
    rankings_count: number;
  }>;
}

export interface CouncilResponse {
  stage1: CouncilStage1Result[];
  stage2: CouncilStage2Result[];
  stage3: CouncilStage3Result;
  metadata: CouncilMetadata;
}

export type CouncilBridgeEvent =
  | { type: 'start'; message?: string }
  | { type: 'progress'; stage: string; message: string; data?: any }
  | { type: 'log'; level: 'info' | 'warn' | 'error'; message: string }
  | { type: 'stage1_complete'; data: CouncilStage1Result[]; count: number }
  | { type: 'stage2_complete'; data: CouncilStage2Result[]; label_to_model: Record<string, string>; aggregate_rankings: any[] }
  | { type: 'stage3_complete'; data: CouncilStage3Result }
  | { type: 'final'; success: boolean; result: CouncilResponse }
  | { type: 'error'; message: string };

/**
 * Resolve Python binary path
 */
function resolvePythonBin(): string {
  if (process.env.PYTHON_BIN) {
    return process.env.PYTHON_BIN;
  }
  return process.platform === 'win32' ? 'python' : 'python3';
}

/**
 * Resolve path to council_wrapper.py
 */
function resolveWrapperPath(): string {
  return path.join(process.cwd(), 'server', 'python', 'council_wrapper.py');
}

/**
 * Check if the council Python wrapper and dependencies are available
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const wrapperPath = resolveWrapperPath();
    const councilDir = path.join(process.cwd(), 'llm-council');
    
    // Check wrapper exists
    if (!fs.existsSync(wrapperPath)) {
      logger.warn('[CouncilBridge] council_wrapper.py not found at:', wrapperPath);
      return false;
    }
    
    // Check llm-council submodule exists
    if (!fs.existsSync(councilDir)) {
      logger.warn('[CouncilBridge] llm-council submodule not found at:', councilDir);
      return false;
    }
    
    // Check Python is available
    const pythonBin = resolvePythonBin();
    const { spawnSync } = await import('child_process');
    const result = spawnSync(pythonBin, ['--version'], { encoding: 'utf8' });
    if (result.status !== 0) {
      logger.warn('[CouncilBridge] Python not available');
      return false;
    }
    
    // Check OPENROUTER_API_KEY
    if (!process.env.OPENROUTER_API_KEY) {
      logger.warn('[CouncilBridge] OPENROUTER_API_KEY not set');
      return false;
    }
    
    return true;
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    
    // Log muting: only log if 5+ minutes since last logged failure
    const now = Date.now();
    const shouldLog = !lastHealthCheckFailureTime || (now - lastHealthCheckFailureTime) >= HEALTH_CHECK_MUTE_MS;
    
    if (shouldLog) {
      logger.warn('[CouncilBridge] Health check failed:', errMsg);
      lastHealthCheckFailureTime = now;
    }
    
    return false;
  }
}

/**
 * Run council deliberation via Python subprocess
 * @param query - The query/prompt to send to the council
 * @param apiKey - The API key to use for council operations
 * @param onEvent - Callback for streaming events
 * @returns Promise with final result
 */
export async function runCouncil(
  query: string,
  apiKey: string,
  onEvent?: (evt: CouncilBridgeEvent) => void
): Promise<CouncilResponse> {
  return new Promise((resolve, reject) => {
    const pythonBin = resolvePythonBin();
    const wrapperPath = resolveWrapperPath();
    
    // Build environment with required API keys
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PYTHONIOENCODING: 'utf-8',
      PYTHONUTF8: '1',
    };
    
    // Set OPENROUTER_API_KEY to the resolved key (user key or server fallback)
    env.OPENROUTER_API_KEY = apiKey;
    
    const spawnOpts: SpawnOptions = {
      cwd: path.dirname(wrapperPath),
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    };
    
    logger.info('[CouncilBridge] Spawning council subprocess...');
    const child = spawn(pythonBin, [wrapperPath], spawnOpts);
    
    if (!child.stdout || !child.stderr || !child.stdin) {
      const err = new Error('Python process streams not available');
      if (onEvent) onEvent({ type: 'error', message: err.message });
      return reject(err);
    }
    
    // Set UTF-8 encoding
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    
    // Timeout handling
    const timeoutHandle = setTimeout(() => {
      logger.error('[CouncilBridge] Council subprocess timed out');
      child.kill('SIGTERM');
      const err = new Error(`Council timed out after ${COUNCIL_TIMEOUT_MS}ms`);
      if (onEvent) onEvent({ type: 'error', message: err.message });
      reject(err);
    }, COUNCIL_TIMEOUT_MS);
    
    let finalResult: CouncilResponse | null = null;
    const logBuffer: string[] = [];
    
    // Stream stdout as NDJSON
    const rl = readline.createInterface({ input: child.stdout });
    rl.on('line', (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      
      logBuffer.push(trimmed);
      
      try {
        const evt = JSON.parse(trimmed) as CouncilBridgeEvent;
        logger.debug(`[CouncilBridge] Event: ${evt.type}`);
        
        if (onEvent) onEvent(evt);
        
        // Capture final result
        if (evt.type === 'final' && evt.success && evt.result) {
          finalResult = evt.result;
        }
      } catch {
        // Non-JSON output - forward as log
        if (onEvent) onEvent({ type: 'log', level: 'info', message: trimmed });
      }
    });
    
    // Forward stderr as error logs
    const rlErr = readline.createInterface({ input: child.stderr });
    rlErr.on('line', (line) => {
      logBuffer.push(`[stderr] ${line}`);
      logger.warn('[CouncilBridge] stderr:', line);
      if (onEvent) onEvent({ type: 'log', level: 'error', message: line });
    });
    
    // Send payload to stdin
    const payload = JSON.stringify({ query });
    child.stdin.write(payload);
    child.stdin.end();
    
    child.on('close', (code) => {
      clearTimeout(timeoutHandle);
      
      if (code !== 0 && !finalResult) {
        const err = new Error(`Council subprocess exited with code ${code}`);
        if (onEvent) onEvent({ type: 'error', message: err.message });
        return reject(err);
      }
      
      if (!finalResult) {
        const err = new Error('Council subprocess did not return a final result');
        if (onEvent) onEvent({ type: 'error', message: err.message });
        return reject(err);
      }
      
      logger.info('[CouncilBridge] Council deliberation complete');
      resolve(finalResult);
    });
    
    child.on('error', (err) => {
      clearTimeout(timeoutHandle);
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error('[CouncilBridge] Subprocess error:', errMsg);
      if (onEvent) onEvent({ type: 'error', message: errMsg });
      reject(err);
    });
  });
}

export const councilBridge = {
  healthCheck,
  runCouncil,
};
