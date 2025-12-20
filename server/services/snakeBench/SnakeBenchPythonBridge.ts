/**
 * Author: Claude Code using Haiku 4.5
 * Date: 2025-12-19
 * PURPOSE: Manage SnakeBench Python subprocess spawning and lifecycle.
 *          Handles path resolution, environment setup, stdio management, timeouts, cleanup.
 *          Follows pattern from pythonBridge.ts (Saturn/Beetree).
 * SRP/DRY check: Pass — isolated subprocess management, single responsibility.
 */

import { spawn, type SpawnOptions as ChildProcessSpawnOptions } from 'child_process';
import path from 'path';
import * as readline from 'readline';
import { logger } from '../../utils/logger.ts';
import type { SnakeBenchMatchPayload, PreparedMatchConfig } from './helpers/validators.ts';

export interface SpawnOptions {
  enableLiveDb?: boolean;
  enableStdoutEvents?: boolean;
  timeoutMs?: number;
  customEnv?: Record<string, string>;
}

export interface SnakeBenchMatchResult {
  game_id?: string;
  gameId?: string;
  modelA?: string;
  modelB?: string;
  scores?: Record<string, number>;
  results?: Record<string, any>;
  completed_game_path?: string;
  completedGamePath?: string;
  error?: string;
}

export class SnakeBenchPythonBridge {
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
   * Resolve path to snakebench_runner.py
   */
  resolveRunnerPath(): string {
    return path.join(process.cwd(), 'server', 'python', 'snakebench_runner.py');
  }

  /**
   * Resolve path to SnakeBench backend directory
   */
  resolveBackendDir(): string {
    return path.join(process.cwd(), 'external', 'SnakeBench', 'backend');
  }

  /**
   * Spawn a non-streaming match subprocess.
   * Collects stdout, waits for completion, parses final JSON result.
   * Returns promise that resolves when subprocess closes.
   */
  async spawnMatch(
    payload: SnakeBenchMatchPayload,
    spawnOpts: ChildProcessSpawnOptions,
    timeoutMs: number
  ): Promise<{ stdout: string; stderr: string; code: number | null }> {
    const pythonBin = this.resolvePythonBin();
    const runnerPath = this.resolveRunnerPath();

    return new Promise((resolve, reject) => {
      const child = spawn(pythonBin, [runnerPath], spawnOpts);

      if (!child.stdout || !child.stderr || !child.stdin) {
        return reject(
          new Error('Python process streams not available for SnakeBench runner')
        );
      }

      const timeoutHandle = setTimeout(() => {
        child.kill('SIGTERM');
        const mins = Math.round(timeoutMs / (60 * 1000));
        logger.error(
          `SnakeBench runner timeout (${mins} minutes exceeded). Process killed. ` +
            `Configure via SNAKEBENCH_TIMEOUT_MS env var if longer matches are needed.`,
          'snakebench-service'
        );
        reject(
          new Error(
            `SnakeBench runner timeout (${mins} minutes exceeded). ` +
              `For longer matches, set SNAKEBENCH_TIMEOUT_MS environment variable.`
          )
        );
      }, timeoutMs);

      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');

      let stdoutBuf = '';
      let stderrBuf = '';

      logger.info(
        `SnakeBench pythonBridge: OPENROUTER_BASE_URL=${spawnOpts.env?.OPENROUTER_BASE_URL ?? '(unset)'}`,
        'snakebench-service'
      );

      child.stdout.on('data', (chunk: Buffer | string) => {
        const text = chunk.toString();
        stdoutBuf += text;

        // Surface provider failures emitted by the SnakeBench engine
        if (
          text.includes('Provider error') ||
          text.includes('No cookie auth credentials found') ||
          text.includes('cookie auth')
        ) {
          const preview = text.trim().split(/\r?\n/).filter(Boolean).slice(-3).join(' | ');
          logger.warn(
            `SnakeBench engine stdout (provider issue): ${preview}`,
            'snakebench-service'
          );
        }
      });

      child.stderr.on('data', (chunk: Buffer | string) => {
        stderrBuf += chunk.toString();
      });

      child.on('close', (code: number | null) => {
        clearTimeout(timeoutHandle);
        resolve({ stdout: stdoutBuf, stderr: stderrBuf, code });
      });

      child.on('error', (err) => {
        clearTimeout(timeoutHandle);
        logger.error(
          `Failed to spawn SnakeBench runner: ${err instanceof Error ? err.message : String(err)}`,
          'snakebench-service'
        );
        reject(err);
      });

      try {
        child.stdin.setDefaultEncoding('utf8');
        child.stdin.write(JSON.stringify(payload));
        child.stdin.end();
      } catch (err) {
        clearTimeout(timeoutHandle);
        logger.error(
          `Failed to send payload to SnakeBench runner: ${err instanceof Error ? err.message : String(err)}`,
          'snakebench-service'
        );
        child.kill();
        reject(err);
      }
    });
  }

  /**
   * Spawn a streaming match subprocess.
   * Parses stdout line-by-line, emitting events via callbacks.
   * Returns promise that resolves when subprocess closes.
   */
  async spawnMatchStreaming(
    payload: SnakeBenchMatchPayload,
    spawnOpts: ChildProcessSpawnOptions,
    timeoutMs: number,
    onStdoutLine: (line: string) => void,
    onStderrLine: (line: string) => void
  ): Promise<{ stdout: string; stderr: string; code: number | null }> {
    const pythonBin = this.resolvePythonBin();
    const runnerPath = this.resolveRunnerPath();

    return new Promise((resolve, reject) => {
      const child = spawn(pythonBin, [runnerPath], spawnOpts);

      if (!child.stdout || !child.stderr || !child.stdin) {
        return reject(
          new Error('Python process streams not available for SnakeBench runner')
        );
      }

      const timeoutHandle = setTimeout(() => {
        child.kill('SIGTERM');
        const mins = Math.round(timeoutMs / (60 * 1000));
        logger.error(
          `SnakeBench runner timeout (${mins} minutes exceeded). Process killed.`,
          'snakebench-service'
        );
        reject(
          new Error(
            `SnakeBench runner timeout (${mins} minutes exceeded). ` +
              `For longer matches, set SNAKEBENCH_TIMEOUT_MS environment variable.`
          )
        );
      }, timeoutMs);

      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');

      // Use readline for line-by-line parsing of stdout
      const rl = readline.createInterface({
        input: child.stdout,
        crlfDelay: Infinity,
      });

      let stdoutBuf = '';
      let stderrBuf = '';

      logger.info(
        `SnakeBench pythonBridge streaming: OPENROUTER_BASE_URL=${spawnOpts.env?.OPENROUTER_BASE_URL ?? '(unset)'}`,
        'snakebench-service'
      );

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
        resolve({ stdout: stdoutBuf, stderr: stderrBuf, code });
      });

      child.on('error', (err) => {
        clearTimeout(timeoutHandle);
        rl.close();
        logger.error(
          `Failed to spawn SnakeBench runner: ${err instanceof Error ? err.message : String(err)}`,
          'snakebench-service'
        );
        reject(err);
      });

      try {
        child.stdin.setDefaultEncoding('utf8');
        child.stdin.write(JSON.stringify(payload));
        child.stdin.end();
      } catch (err) {
        clearTimeout(timeoutHandle);
        rl.close();
        logger.error(
          `Failed to send payload to SnakeBench runner: ${err instanceof Error ? err.message : String(err)}`,
          'snakebench-service'
        );
        child.kill();
        reject(err);
      }
    });
  }
}

export const snakeBenchPythonBridge = new SnakeBenchPythonBridge();
