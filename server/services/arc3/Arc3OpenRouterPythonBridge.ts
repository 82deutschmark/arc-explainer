/**
 * Author: Cascade
 * Date: 2026-01-02
 * PURPOSE: Spawn Python subprocess for OpenRouter ARC3 agent.
 *          Follows pattern from SnakeBenchPythonBridge.ts.
 *          Manages subprocess lifecycle, stdin/stdout, NDJSON event parsing.
 * SRP/DRY check: Pass — isolated subprocess management for OpenRouter agent.
 */

import { spawn, type SpawnOptions as ChildProcessSpawnOptions } from 'child_process';
import path from 'path';
import * as readline from 'readline';
import { logger } from '../../utils/logger.ts';

export interface Arc3OpenRouterPayload {
  game_id: string;
  model: string;
  instructions?: string;
  system_prompt?: string;      // User's custom system prompt (genius prompt)
  max_turns?: number;
  api_key?: string;            // OpenRouter API key (BYOK)
  arc3_api_key?: string;       // ARC3 API key
  agent_name?: string;         // User-defined agent name for scorecard
  reasoning_effort?: 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'; // OpenRouter reasoning.effort per docs
}

export interface Arc3OpenRouterSpawnOptions {
  timeoutMs?: number;
  customEnv?: Record<string, string>;
}

export class Arc3OpenRouterPythonBridge {
  /**
   * Resolve Python binary path from environment or default.
   */
  resolvePythonBin(): string {
    if (process.env.PYTHON_BIN) {
      return process.env.PYTHON_BIN;
    }
    return process.platform === 'win32' ? 'python' : 'python3';
  }

  /**
   * Resolve path to arc3_openrouter_runner.py
   */
  resolveRunnerPath(): string {
    return path.join(process.cwd(), 'server', 'python', 'arc3_openrouter_runner.py');
  }

  /**
   * Build spawn options with environment variables.
   */
  buildSpawnOptions(
    payload: Arc3OpenRouterPayload,
    opts: Arc3OpenRouterSpawnOptions = {}
  ): ChildProcessSpawnOptions {
    const env: Record<string, string> = {
      ...process.env as Record<string, string>,
      PYTHONUNBUFFERED: '1',  // Force unbuffered output for streaming
    };

    // Pass API keys via environment if not in payload
    if (!payload.api_key && process.env.OPENROUTER_API_KEY) {
      env.OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
    }
    if (!payload.arc3_api_key && process.env.ARC3_API_KEY) {
      env.ARC3_API_KEY = process.env.ARC3_API_KEY;
    }

    // Add custom env vars
    if (opts.customEnv) {
      Object.assign(env, opts.customEnv);
    }

    return {
      cwd: process.cwd(),
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    };
  }

  // Track active children by session for disconnect-driven teardown
  private activeChildren: Map<string, ReturnType<typeof spawn>> = new Map();

  /**
   * Spawn the OpenRouter agent subprocess with streaming line-by-line output.
   * Parses stdout as NDJSON events and forwards to callbacks.
   */
  async spawnAgent(
    payload: Arc3OpenRouterPayload,
    spawnOpts: Arc3OpenRouterSpawnOptions,
    onStdoutLine: (line: string) => void,
    onStderrLine: (line: string) => void,
    sessionId?: string
  ): Promise<{ stdout: string; stderr: string; code: number | null }> {
    const pythonBin = this.resolvePythonBin();
    const runnerPath = this.resolveRunnerPath();
    const timeoutMs = spawnOpts.timeoutMs ?? 10 * 60 * 1000; // 10 min default

    const childSpawnOpts = this.buildSpawnOptions(payload, spawnOpts);

    return new Promise((resolve, reject) => {
      logger.info(
        `[Arc3OpenRouter] Spawning Python agent: ${pythonBin} ${runnerPath}`,
        'arc3-openrouter'
      );
      logger.info(
        `[Arc3OpenRouter] Game: ${payload.game_id}, Model: ${payload.model}`,
        'arc3-openrouter'
      );

      const child = spawn(pythonBin, [runnerPath], childSpawnOpts);
      if (sessionId) {
        this.activeChildren.set(sessionId, child);
      }

      if (!child.stdout || !child.stderr || !child.stdin) {
        return reject(
          new Error('Python process streams not available for Arc3OpenRouter runner')
        );
      }

      // Timeout handling
      const timeoutHandle = setTimeout(() => {
        child.kill('SIGTERM');
        const mins = Math.round(timeoutMs / (60 * 1000));
        logger.error(
          `[Arc3OpenRouter] Runner timeout (${mins} minutes exceeded). Process killed.`,
          'arc3-openrouter'
        );
        reject(
          new Error(`Arc3OpenRouter runner timeout (${mins} minutes exceeded).`)
        );
      }, timeoutMs);

      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');

      // Use readline for line-by-line parsing of stdout (NDJSON)
      const rl = readline.createInterface({
        input: child.stdout,
        crlfDelay: Infinity,
      });

      let stdoutBuf = '';
      let stderrBuf = '';

      rl.on('line', (line) => {
        stdoutBuf += line + '\n';
        const trimmed = line.trim();
        if (trimmed) {
          onStdoutLine(trimmed);
        }
      });

      child.stderr.on('data', (chunk: Buffer | string) => {
        const text = chunk.toString();
        stderrBuf += text;
        const lines = text.split(/\r?\n/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed) {
            onStderrLine(trimmed);
          }
        }
      });

      child.on('close', (code: number | null) => {
        clearTimeout(timeoutHandle);
        rl.close();
        logger.info(
          `[Arc3OpenRouter] Python process exited with code ${code}`,
          'arc3-openrouter'
        );
        if (sessionId) {
          this.activeChildren.delete(sessionId);
        }
        resolve({ stdout: stdoutBuf, stderr: stderrBuf, code });
      });

      child.on('error', (err) => {
        clearTimeout(timeoutHandle);
        rl.close();
        logger.error(
          `[Arc3OpenRouter] Failed to spawn runner: ${err instanceof Error ? err.message : String(err)}`,
          'arc3-openrouter'
        );
        if (sessionId) {
          this.activeChildren.delete(sessionId);
        }
        reject(err);
      });

      // Send payload via stdin
      try {
        child.stdin.setDefaultEncoding('utf8');
        child.stdin.write(JSON.stringify(payload));
        child.stdin.end();
        logger.debug(
          `[Arc3OpenRouter] Sent payload to Python runner`,
          'arc3-openrouter'
        );
      } catch (err) {
        clearTimeout(timeoutHandle);
        rl.close();
        logger.error(
          `[Arc3OpenRouter] Failed to send payload: ${err instanceof Error ? err.message : String(err)}`,
          'arc3-openrouter'
        );
        child.kill();
        if (sessionId) {
          this.activeChildren.delete(sessionId);
        }
        reject(err);
      }
    });
  }

  /**
   * Kill an active child process for a session (used on SSE disconnect).
   */
  cancel(sessionId: string): void {
    const child = this.activeChildren.get(sessionId);
    if (child && !child.killed) {
      child.kill('SIGTERM');
      logger.info(`[Arc3OpenRouter] Killed Python runner for session ${sessionId} on disconnect`, 'arc3-openrouter');
    }
    this.activeChildren.delete(sessionId);
  }
}

export const arc3OpenRouterPythonBridge = new Arc3OpenRouterPythonBridge();
