/**
 * server/services/snakeBenchService.ts
 *
 * Author: Cascade
 * Date: 2025-12-02
 * PURPOSE: Orchestrate single SnakeBench matches via a Python runner
 *          (server/python/snakebench_runner.py) and return a compact
 *          summary suitable for HTTP APIs and frontend usage.
 * SRP/DRY check: Pass — dedicated to SnakeBench subprocess handling and
 *                result shaping; reuses existing logging patterns.
 */

import { spawn, type SpawnOptions } from 'child_process';
import path from 'path';

import type {
  SnakeBenchRunMatchRequest,
  SnakeBenchRunMatchResult,
} from '../../shared/types.js';
import { logger } from '../utils/logger.ts';

export class SnakeBenchService {
  private resolvePythonBin(): string {
    if (process.env.PYTHON_BIN) {
      return process.env.PYTHON_BIN;
    }
    return process.platform === 'win32' ? 'python' : 'python3';
  }

  private resolveRunnerPath(): string {
    return path.join(process.cwd(), 'server', 'python', 'snakebench_runner.py');
  }

  async runMatch(request: SnakeBenchRunMatchRequest): Promise<SnakeBenchRunMatchResult> {
    const { modelA, modelB } = request;

    if (!modelA || !modelB) {
      throw new Error('modelA and modelB are required');
    }

    const width = request.width ?? 10;
    const height = request.height ?? 10;
    const maxRounds = request.maxRounds ?? 150;
    const numApples = request.numApples ?? 5;

    const payload = {
      modelA: String(modelA),
      modelB: String(modelB),
      width,
      height,
      maxRounds,
      numApples,
    };

    const pythonBin = this.resolvePythonBin();
    const runnerPath = this.resolveRunnerPath();

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PYTHONIOENCODING: 'utf-8',
      PYTHONUTF8: '1',
    };

    const spawnOpts: SpawnOptions = {
      cwd: path.dirname(runnerPath),
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    };

    return new Promise<SnakeBenchRunMatchResult>((resolve, reject) => {
      const child = spawn(pythonBin, [runnerPath], spawnOpts);

      if (!child.stdout || !child.stderr || !child.stdin) {
        return reject(new Error('Python process streams not available for SnakeBench runner'));
      }

      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');

      let stdoutBuf = '';
      let stderrBuf = '';

      child.stdout.on('data', (chunk: Buffer | string) => {
        stdoutBuf += chunk.toString();
      });

      child.stderr.on('data', (chunk: Buffer | string) => {
        stderrBuf += chunk.toString();
      });

      child.on('close', (code: number | null) => {
        if (code !== 0) {
          const errSnippet = (stderrBuf || stdoutBuf).trim().slice(0, 500);
          logger.error(
            `SnakeBench runner failed (exit code ${code ?? 'null'}): ${errSnippet}`,
            'snakebench-service',
          );
          return reject(new Error(`SnakeBench runner failed (exit code ${code ?? 'null'})`));
        }

        const lines = stdoutBuf
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter((l) => l.length > 0);

        if (lines.length === 0) {
          return reject(new Error('SnakeBench runner produced no output'));
        }

        const lastLine = lines[lines.length - 1];
        let parsed: any;
        try {
          parsed = JSON.parse(lastLine);
        } catch (err) {
          logger.error(
            `SnakeBench runner output was not valid JSON: ${lastLine.slice(0, 200)}`,
            'snakebench-service',
          );
          return reject(new Error('Failed to parse SnakeBench runner output'));
        }

        if (parsed && typeof parsed === 'object' && parsed.error) {
          return reject(new Error(String(parsed.error)));
        }

        const result: SnakeBenchRunMatchResult = {
          gameId: parsed.game_id ?? parsed.gameId ?? '',
          modelA: parsed.modelA,
          modelB: parsed.modelB,
          scores: parsed.scores ?? {},
          results: parsed.results ?? {},
          completedGamePath: parsed.completed_game_path ?? parsed.completedGamePath,
        };

        resolve(result);
      });

      child.on('error', (err) => {
        logger.error(
          `Failed to spawn SnakeBench runner: ${err instanceof Error ? err.message : String(err)}`,
          'snakebench-service',
        );
        reject(err);
      });

      try {
        child.stdin.setDefaultEncoding('utf8');
        child.stdin.write(JSON.stringify(payload));
        child.stdin.end();
      } catch (err) {
        logger.error(
          `Failed to send payload to SnakeBench runner: ${err instanceof Error ? err.message : String(err)}`,
          'snakebench-service',
        );
        child.kill();
        reject(err);
      }
    });
  }
}

export const snakeBenchService = new SnakeBenchService();
