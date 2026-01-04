/**
 * Author: Claude Sonnet 4
 * Date: 2026-01-03
 * PURPOSE: Spawn Python subprocess for Haiku 4.5 ARC3 agent.
 *          Follows pattern from Arc3OpenRouterPythonBridge.ts.
 *          Manages subprocess lifecycle, stdin/stdout, NDJSON event parsing.
 * SRP/DRY check: Pass — isolated subprocess management for Haiku agent.
 */

import { spawn, type SpawnOptions as ChildProcessSpawnOptions } from 'child_process';
import path from 'path';
import * as readline from 'readline';
import { logger } from '../../utils/logger.ts';

export interface Arc3HaikuPayload {
  game_id: string;
  model?: string;                // Default: claude-3-5-haiku-20241022
  max_turns?: number;
  anthropic_api_key?: string;    // Anthropic API key (BYOK)
  arc3_api_key?: string;         // ARC3 API key
  agent_name?: string;           // User-defined agent name for scorecard
  system_prompt?: string;        // Optional custom system prompt override
}

export interface Arc3HaikuSpawnOptions {
  timeoutMs?: number;
  customEnv?: Record<string, string>;
}

export class Arc3HaikuPythonBridge {
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
   * Resolve path to arc3_haiku_agent.py
   */
  resolveRunnerPath(): string {
    return path.join(process.cwd(), 'server', 'python', 'arc3_haiku_agent.py');
  }

  /**
   * Build spawn options with environment variables.
   */
  buildSpawnOptions(
    payload: Arc3HaikuPayload,
    opts: Arc3HaikuSpawnOptions = {}
  ): ChildProcessSpawnOptions {
    const env: Record<string, string> = {
      ...process.env as Record<string, string>,
      PYTHONUNBUFFERED: '1',  // Force unbuffered output for streaming
    };

    // Pass API keys via environment if not in payload
    if (!payload.anthropic_api_key && process.env.ANTHROPIC_API_KEY) {
      env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
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

  /**
   * Spawn the Haiku agent subprocess with streaming line-by-line output.
   * Parses stdout as NDJSON events and forwards to callbacks.
   */
  async spawnAgent(
    payload: Arc3HaikuPayload,
    spawnOpts: Arc3HaikuSpawnOptions,
    onStdoutLine: (line: string) => void,
    onStderrLine: (line: string) => void
  ): Promise<{ stdout: string; stderr: string; code: number | null }> {
    const pythonBin = this.resolvePythonBin();
    const runnerPath = this.resolveRunnerPath();
    const timeoutMs = spawnOpts.timeoutMs ?? 10 * 60 * 1000; // 10 min default

    const childSpawnOpts = this.buildSpawnOptions(payload, spawnOpts);

    return new Promise((resolve, reject) => {
      logger.info(
        `[Arc3Haiku] Spawning Python agent: ${pythonBin} ${runnerPath}`,
        'arc3-haiku'
      );
      logger.info(
        `[Arc3Haiku] Game: ${payload.game_id}, Model: ${payload.model || 'claude-3-5-haiku-20241022'}`,
        'arc3-haiku'
      );

      const child = spawn(pythonBin, [runnerPath], childSpawnOpts);

      if (!child.stdout || !child.stderr || !child.stdin) {
        return reject(
          new Error('Python process streams not available for Arc3Haiku runner')
        );
      }

      // Timeout handling
      const timeoutHandle = setTimeout(() => {
        child.kill('SIGTERM');
        const mins = Math.round(timeoutMs / (60 * 1000));
        logger.error(
          `[Arc3Haiku] Runner timeout (${mins} minutes exceeded). Process killed.`,
          'arc3-haiku'
        );
        reject(
          new Error(`Arc3Haiku runner timeout (${mins} minutes exceeded).`)
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
          `[Arc3Haiku] Python process exited with code ${code}`,
          'arc3-haiku'
        );
        resolve({ stdout: stdoutBuf, stderr: stderrBuf, code });
      });

      child.on('error', (err) => {
        clearTimeout(timeoutHandle);
        rl.close();
        logger.error(
          `[Arc3Haiku] Failed to spawn runner: ${err instanceof Error ? err.message : String(err)}`,
          'arc3-haiku'
        );
        reject(err);
      });

      // Send payload via stdin
      try {
        child.stdin.setDefaultEncoding('utf8');
        child.stdin.write(JSON.stringify(payload));
        child.stdin.end();
        logger.debug(
          `[Arc3Haiku] Sent payload to Python runner`,
          'arc3-haiku'
        );
      } catch (err) {
        clearTimeout(timeoutHandle);
        rl.close();
        logger.error(
          `[Arc3Haiku] Failed to send payload: ${err instanceof Error ? err.message : String(err)}`,
          'arc3-haiku'
        );
        child.kill();
        reject(err);
      }
    });
  }
}

export const arc3HaikuPythonBridge = new Arc3HaikuPythonBridge();
