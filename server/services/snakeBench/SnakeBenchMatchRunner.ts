/**
 * Author: Gemini 3 Flash High
 * Date: 2025-12-27
 * PURPOSE: Orchestrate non-streaming match execution (single + batch).
 *          Coordinates Python bridge, persistence, and error handling.
 * SRP/DRY check: Pass — match execution orchestration only, delegates to bridge and persistence.
 */

import type { SnakeBenchRunMatchRequest, SnakeBenchRunMatchResult, SnakeBenchRunBatchRequest, SnakeBenchRunBatchResult } from '../../../shared/types.js';
import { snakeBenchPythonBridge } from './SnakeBenchPythonBridge.ts';
import { PersistenceCoordinator } from './persistence/persistenceCoordinator.ts';
import { prepareRunMatch, validateModels } from './helpers/validators.ts';
import { logger } from '../../utils/logger.ts';

export class SnakeBenchMatchRunner {
  constructor(private readonly persistenceCoordinator: PersistenceCoordinator) {}

  /**
   * Run a single match between two models.
   * Non-blocking persistence (queued for async DB writes).
   * Returns result immediately after Python process completes.
   */
  async runMatch(
    request: SnakeBenchRunMatchRequest,
    allowedModels: string[]
  ): Promise<SnakeBenchRunMatchResult> {
    // Validate and prepare
    const prepared = prepareRunMatch(request, {
      enableLiveDb: false,
      enableStdoutEvents: false,
      allowedModels,
    });

    // Spawn Python runner
    const { stdout, stderr, code } = await snakeBenchPythonBridge.spawnMatch(
      prepared.payload,
      prepared.spawnOpts,
      prepared.timeoutMs
    );

    // Check for subprocess failure
    if (code !== 0) {
      const errSnippet = (stderr || stdout).trim().slice(0, 500);
      logger.error(
        `SnakeBench runner failed (exit code ${code ?? 'null'}): ${errSnippet}`,
        'snakebench-service'
      );
      throw new Error(`SnakeBench runner failed (exit code ${code ?? 'null'})`);
    }

    // Parse output
    const lines = stdout
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      throw new Error('SnakeBench runner produced no output');
    }

    const lastLine = lines[lines.length - 1];
    let parsed: any;
    try {
      parsed = JSON.parse(lastLine);
    } catch (err) {
      logger.error(
        `SnakeBench runner output was not valid JSON: ${lastLine.slice(0, 200)}`,
        'snakebench-service'
      );
      throw new Error('Failed to parse SnakeBench runner output');
    }

    if (parsed && typeof parsed === 'object' && parsed.error) {
      throw new Error(String(parsed.error));
    }

    const result: SnakeBenchRunMatchResult = {
      gameId: parsed.game_id ?? parsed.gameId ?? '',
      modelA: parsed.modelA,
      modelB: parsed.modelB,
      scores: parsed.scores ?? {},
      results: parsed.results ?? {},
      completedGamePath: parsed.completed_game_path ?? parsed.completedGamePath,
    };

    // Fire-and-forget persistence
    await this.persistenceCoordinator.enqueueMatch(
      result,
      prepared.width,
      prepared.height,
      prepared.numApples,
      { modelA: prepared.modelA, modelB: prepared.modelB }
    );

    return result;
  }

  /**
   * Run multiple matches sequentially (batch mode).
   * Each match is independent; errors in one don't stop subsequent matches.
   * Returns results array + errors array if any occurred.
   */
  async runBatch(
    request: SnakeBenchRunBatchRequest,
    allowedModels: string[]
  ): Promise<SnakeBenchRunBatchResult> {
    const { MAX_BATCH_COUNT } = await import('./utils/constants.ts');

    const countRaw = request.count;
    const count = Number.isFinite(countRaw) ? Math.floor(countRaw) : 0;

    if (count <= 0) {
      throw new Error('count must be a positive integer');
    }
    if (count > MAX_BATCH_COUNT) {
      throw new Error(`count must be <= ${MAX_BATCH_COUNT} for safety`);
    }

    const results: SnakeBenchRunMatchResult[] = [];
    const errors: { index: number; error: string }[] = [];

    for (let i = 0; i < count; i += 1) {
      try {
        const result = await this.runMatch(request, allowedModels);
        results.push(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push({ index: i, error: message });
      }
    }

    return {
      results,
      errors: errors.length ? errors : undefined,
    };
  }
}
