/**
 * Author: Claude Code using Haiku 4.5
 * Date: 2025-12-19
 * PURPOSE: Request validation, parameter normalization, and spawn payload preparation.
 *          Validates models, clamps numeric values, extracts pricing, handles environment.
 * SRP/DRY check: Pass — validation logic isolated, reusable for match preparation.
 */

import type { SpawnOptions } from 'child_process';
import type { SnakeBenchRunMatchRequest } from '../../../shared/types.js';
import { MODELS } from '../../../config/models.ts';
import {
  MIN_BOARD_SIZE,
  MAX_BOARD_SIZE,
  MIN_MAX_ROUNDS,
  MAX_MAX_ROUNDS,
  MIN_NUM_APPLES,
  MAX_NUM_APPLES,
  DEFAULT_SNAKEBENCH_TIMEOUT_MS,
} from '../utils/constants.ts';

export interface SnakeBenchMatchPayload {
  modelA: string;
  modelB: string;
  width: number;
  height: number;
  maxRounds: number;
  numApples: number;
  pricingInputA: number;
  pricingOutputA: number;
  pricingInputB: number;
  pricingOutputB: number;
  /** Player variant for model A (e.g., 'default', 'A'). */
  playerVariantA: string;
  /** Player variant for model B (e.g., 'default', 'A'). */
  playerVariantB: string;
}

export interface PreparedMatchConfig {
  modelA: string;
  modelB: string;
  width: number;
  height: number;
  maxRounds: number;
  numApples: number;
  payload: SnakeBenchMatchPayload;
  pythonBin: string;
  runnerPath: string;
  backendDir: string;
  spawnOpts: SpawnOptions;
  timeoutMs: number;
}

/**
 * Clamp a number between min and max, handling non-finite values.
 */
export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/**
 * Parse cost string (e.g., "$1.23" or "$1.23-$4.56") to a number.
 * Extracts first numeric value, returns 0 if unparseable.
 */
export function parseCostStringToNumber(cost: string | undefined | null): number {
  if (!cost) return 0;
  const cleaned = cost.replace(/\$/g, '').trim();
  const firstPart = cleaned.split(/-|–|—/)[0]?.trim() ?? '';
  const match = firstPart.match(/[0-9]*\.?[0-9]+/);
  if (!match) return 0;
  const value = parseFloat(match[0]);
  return Number.isFinite(value) ? value : 0;
}

/**
 * Validate that both models are in the allowed list.
 * Throws if either model is not allowed.
 */
export function validateModels(modelA: string, modelB: string, allowedModels: string[]): void {
  if (!modelA || !modelB) {
    throw new Error('modelA and modelB are required');
  }

  if (!allowedModels.includes(modelA)) {
    throw new Error(
      `Model '${modelA}' not available for SnakeBench. ` +
        `Available models: ${allowedModels.join(', ')}`
    );
  }

  if (!allowedModels.includes(modelB)) {
    throw new Error(
      `Model '${modelB}' not available for SnakeBench. ` +
        `Available models: ${allowedModels.join(', ')}`
    );
  }
}

/**
 * Prepare a match request for Python runner execution.
 * Validates models, clamps parameters, extracts pricing, prepares spawn options.
 */
export function prepareRunMatch(
  request: SnakeBenchRunMatchRequest,
  options: {
    enableLiveDb?: boolean;
    enableStdoutEvents?: boolean;
    allowedModels?: string[];
    pythonBin?: string;
    runnerPath?: string;
    backendDir?: string;
  }
): PreparedMatchConfig {
  const { modelA, modelB } = request;

  // Validate models
  const allowedModels =
    options.allowedModels && options.allowedModels.length > 0
      ? options.allowedModels
      : MODELS.filter((m) => m.provider === 'OpenRouter')
          .map((m) => m.apiModelName || m.key)
          .filter((m): m is string => typeof m === 'string' && m.trim().length > 0)
          .map((m) => m.trim());

  validateModels(modelA, modelB, allowedModels);

  // Clamp numeric parameters
  const widthRaw = request.width ?? 10;
  const heightRaw = request.height ?? 10;
  const maxRoundsRaw = request.maxRounds ?? 150;
  const numApplesRaw = request.numApples ?? 5;

  const width = clamp(widthRaw, MIN_BOARD_SIZE, MAX_BOARD_SIZE);
  const height = clamp(heightRaw, MIN_BOARD_SIZE, MAX_BOARD_SIZE);
  const maxRounds = clamp(maxRoundsRaw, MIN_MAX_ROUNDS, MAX_MAX_ROUNDS);
  const numApples = clamp(numApplesRaw, MIN_NUM_APPLES, MAX_NUM_APPLES);

  // Find model configs and extract pricing
  const findModelConfig = (slug: string) =>
    MODELS.find(
      (m) =>
        m.provider === 'OpenRouter' &&
        ((m.apiModelName && m.apiModelName === slug) || m.key === slug)
    );

  const configA = findModelConfig(modelA);
  const configB = findModelConfig(modelB);

  const pricingInputA = configA ? parseCostStringToNumber(configA.cost.input) : 0;
  const pricingOutputA = configA ? parseCostStringToNumber(configA.cost.output) : 0;
  const pricingInputB = configB ? parseCostStringToNumber(configB.cost.input) : 0;
  const pricingOutputB = configB ? parseCostStringToNumber(configB.cost.output) : 0;

  // Player variant selection (defaults to 'default' baseline prompt)
  const playerVariantA = request.playerVariantA?.trim() || 'default';
  const playerVariantB = request.playerVariantB?.trim() || 'default';

  const payload: SnakeBenchMatchPayload = {
    modelA: String(modelA),
    modelB: String(modelB),
    width,
    height,
    maxRounds,
    numApples,
    pricingInputA,
    pricingOutputA,
    pricingInputB,
    pricingOutputB,
    playerVariantA,
    playerVariantB,
  };

  const pythonBin = options.pythonBin || (process.platform === 'win32' ? 'python' : 'python3');
  const runnerPath =
    options.runnerPath || `${process.cwd()}/server/python/snakebench_runner.py`;
  const backendDir =
    options.backendDir || `${process.cwd()}/external/SnakeBench/backend`;

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PYTHONIOENCODING: 'utf-8',
    PYTHONUTF8: '1',
    PYTHONUNBUFFERED: '1',
  };

  // Disable SnakeBench's internal DB writes (we use our own)
  if (!options.enableLiveDb) {
    env.SNAKEBENCH_DISABLE_INTERNAL_DB = '1';
  }

  if (options.enableStdoutEvents) {
    env.ARC_EXPLAINER_STDOUT_EVENTS = '1';
  }

  // Ensure OpenRouter base URL is correct
  const expectedOpenRouterBaseUrl = 'https://openrouter.ai/api/v1';
  const configuredOpenRouterBaseUrl = (env.OPENROUTER_BASE_URL || '').trim();
  if (
    !configuredOpenRouterBaseUrl ||
    configuredOpenRouterBaseUrl === expectedOpenRouterBaseUrl ||
    configuredOpenRouterBaseUrl === `${expectedOpenRouterBaseUrl}/`
  ) {
    env.OPENROUTER_BASE_URL = expectedOpenRouterBaseUrl;
  } else {
    env.OPENROUTER_BASE_URL = expectedOpenRouterBaseUrl;
  }

  // Handle BYO API keys
  if (request.apiKey && request.provider) {
    switch (request.provider) {
      case 'openrouter':
        env.OPENROUTER_API_KEY = request.apiKey;
        break;
      case 'openai':
        env.OPENAI_API_KEY = request.apiKey;
        break;
      case 'anthropic':
        env.ANTHROPIC_API_KEY = request.apiKey;
        break;
      case 'xai':
        env.XAI_API_KEY = request.apiKey;
        break;
      case 'gemini':
        env.GEMINI_API_KEY = request.apiKey;
        break;
    }
  }

  const spawnOpts: SpawnOptions = {
    cwd: backendDir,
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
  };

  const timeoutMs = process.env.SNAKEBENCH_TIMEOUT_MS
    ? parseInt(process.env.SNAKEBENCH_TIMEOUT_MS, 10)
    : DEFAULT_SNAKEBENCH_TIMEOUT_MS;

  return {
    modelA,
    modelB,
    width,
    height,
    maxRounds,
    numApples,
    payload,
    pythonBin,
    runnerPath,
    backendDir,
    spawnOpts,
    timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : DEFAULT_SNAKEBENCH_TIMEOUT_MS,
  };
}
