/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-11-15
 * PURPOSE: Analyze ARC Eval puzzles using the free Sherlock Think Alpha cloaked model from OpenRouter.
 * Pulls ARC1 / ARC2 evaluation puzzle IDs, runs Sherlock Think Alpha with rate-limited launch spacing,
 * and persists explanations through the existing analysis + save endpoints.
 * UPDATED: Now skips puzzles that already have explanations from Sherlock Think Alpha.
 * SRP/DRY check: Pass — shared helpers are reused from the paid-model script with
 * model iteration generalized.
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

type SourceKey = 'ARC1-Eval' | 'ARC2-Eval';

type ModelKey = 'openrouter/sherlock-think-alpha';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';
const SOURCES: SourceKey[] = ['ARC2-Eval', 'ARC1-Eval'];

const DEFAULT_MODEL_KEYS: ModelKey[] = ['openrouter/sherlock-think-alpha'];

const RATE_LIMIT_DELAY_MS = Number(process.env.OPENROUTER_RATE_LIMIT_MS) || 5000;
const MODEL_SWITCH_DELAY_MS = Number(process.env.OPENROUTER_MODEL_SWITCH_DELAY_MS) || 3000;
const PUZZLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes timeout for reasoning model
const SAVE_TIMEOUT_MS = 30 * 1000; // 30 seconds

const knownModelKeys = new Set<ModelKey>(DEFAULT_MODEL_KEYS);

function parseModelKeys(raw?: string): ModelKey[] {
  if (!raw) {
    return DEFAULT_MODEL_KEYS;
  }

  const parsed = raw
    .split(',')
    .map(entry => entry.trim())
    .filter((entry): entry is ModelKey => knownModelKeys.has(entry as ModelKey));

  if (parsed.length === 0) {
    console.warn(
      'OPENROUTER_FREE_MODELS provided but contained no recognized model keys; falling back to Sherlock Think Alpha.'
    );
    return DEFAULT_MODEL_KEYS;
  }

  return parsed;
}

const MODEL_KEYS: ModelKey[] = parseModelKeys(process.env.OPENROUTER_FREE_MODELS);

interface AnalysisRequest {
  temperature: number;
  promptId: string;
  reasoningEffort: string;
  reasoningVerbosity: string;
  reasoningSummaryType: string;
  systemPromptMode: string;
  omitAnswer: boolean;
  retryMode: boolean;
}

interface AnalysisResult {
  puzzleId: string;
  modelKey: ModelKey;
  source: SourceKey;
  success: boolean;
  responseTime?: number;
  error?: string;
  skipped?: boolean;
}

interface PuzzleListRecord {
  id: string;
}

interface ExplanationRecord {
  modelKey: string;
  id?: number;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPuzzleIds(source: SourceKey): Promise<string[]> {
  const response = await axios.get(`${API_BASE_URL}/api/puzzle/list`, {
    params: { source },
    timeout: 60000
  });

  if (!response.data?.success) {
    throw new Error(`Unable to load puzzle list for ${source}`);
  }

  const items: PuzzleListRecord[] = response.data.data || [];
  return items.map(item => item.id);
}

async function hasExistingExplanation(puzzleId: string, modelKey: ModelKey): Promise<boolean> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/api/puzzle/${puzzleId}/explanations`,
      { timeout: 10000 }
    );

    if (!response.data?.success) {
      return false;
    }

    const explanations: ExplanationRecord[] = response.data.data || [];
    return explanations.some(exp => exp.modelKey === modelKey);
  } catch (error) {
    // If we can't fetch explanations, assume it doesn't exist and try to analyze
    console.warn(`Warning: Could not check existing explanations for ${puzzleId}, will attempt analysis`);
    return false;
  }
}

async function analyzeAndSave(puzzleId: string, modelKey: ModelKey): Promise<void> {
  const requestBody: AnalysisRequest = {
    temperature: 0.2,
    promptId: 'solver',
    reasoningEffort: 'medium',
    reasoningVerbosity: 'high',
    reasoningSummaryType: 'auto',
    systemPromptMode: 'ARC',
    omitAnswer: true,
    retryMode: false
  };

  const encodedModel = encodeURIComponent(modelKey);
  const analysisResponse = await axios.post(
    `${API_BASE_URL}/api/puzzle/analyze/${puzzleId}/${encodedModel}`,
    requestBody,
    {
      timeout: PUZZLE_TIMEOUT_MS,
      headers: { 'Content-Type': 'application/json' }
    }
  );

  if (!analysisResponse.data.success) {
    throw new Error(analysisResponse.data.message || 'Analysis call failed');
  }

  const explanationPayload = {
    [modelKey]: {
      ...analysisResponse.data.data,
      modelKey
    }
  };

  const saveResponse = await axios.post(
    `${API_BASE_URL}/api/puzzle/save-explained/${puzzleId}`,
    { explanations: explanationPayload },
    {
      timeout: SAVE_TIMEOUT_MS,
      headers: { 'Content-Type': 'application/json' }
    }
  );

  if (!saveResponse.data.success) {
    throw new Error(saveResponse.data.error || 'Save call failed');
  }
}

async function analyzePuzzleWithModel(
  puzzleId: string,
  modelKey: ModelKey,
  source: SourceKey
): Promise<AnalysisResult> {
  // First check if explanation already exists
  const hasExplanation = await hasExistingExplanation(puzzleId, modelKey);
  if (hasExplanation) {
    console.log(`⏭️  Skipping ${puzzleId} - already has explanation from ${modelKey}`);
    return { puzzleId, modelKey, source, success: true, skipped: true };
  }

  const startTime = Date.now();
  try {
    console.log(`🔍 Analyzing ${puzzleId} with ${modelKey} (${source})`);
    await analyzeAndSave(puzzleId, modelKey);
    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`✅ Completed ${puzzleId} with ${modelKey} in ${duration}s`);
    return { puzzleId, modelKey, source, success: true, responseTime: duration };
  } catch (error: any) {
    const duration = Math.round((Date.now() - startTime) / 1000);
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      'Unknown failure';
    console.error(`❌ Error for ${puzzleId} [${modelKey}]: ${message}`);
    return { puzzleId, modelKey, source, success: false, responseTime: duration, error: message };
  }
}

async function fireModelWithSpacing(
  modelKey: ModelKey,
  source: SourceKey,
  puzzleIds: string[]
): Promise<AnalysisResult[]> {
  console.log(`\n🚀 Firing ${modelKey} across ${puzzleIds.length} puzzles from ${source} (5s spacing)`);

  const pending: Promise<AnalysisResult>[] = [];

  for (let index = 0; index < puzzleIds.length; index++) {
    const puzzleId = puzzleIds[index];
    const promise = analyzePuzzleWithModel(puzzleId, modelKey, source);
    pending.push(promise);

    if (index < puzzleIds.length - 1) {
      await delay(RATE_LIMIT_DELAY_MS);
    }
  }

  const settled = await Promise.allSettled(pending);
  const results: AnalysisResult[] = settled.map(s =>
    s.status === 'fulfilled' ? s.value : ({ ...s.reason, success: false } as AnalysisResult)
  );

  const successCount = results.filter(r => r.success && !r.skipped).length;
  const skippedCount = results.filter(r => r.skipped).length;
  const failureCount = results.filter(r => !r.success).length;

  console.log(
    `\n📊 ${modelKey} on ${source}: ${successCount} analyzed, ${skippedCount} skipped (already exists), ${failureCount} failed`
  );

  return results;
}

function summarizeByModel(results: AnalysisResult[]): void {
  const byModel = new Map<ModelKey, { total: number; analyzed: number; skipped: number; failures: number }>();

  for (const modelKey of MODEL_KEYS) {
    byModel.set(modelKey, { total: 0, analyzed: 0, skipped: 0, failures: 0 });
  }

  for (const result of results) {
    const entry = byModel.get(result.modelKey);
    if (!entry) {
      continue;
    }

    entry.total += 1;
    if (result.skipped) {
      entry.skipped += 1;
    } else if (result.success) {
      entry.analyzed += 1;
    } else {
      entry.failures += 1;
    }
  }

  console.log('\n📈 Per-model summary');
  console.log('='.repeat(60));
  byModel.forEach((stats, modelKey) => {
    console.log(
      `${modelKey}:\n` +
      `  ✅ Analyzed: ${stats.analyzed}\n` +
      `  ⏭️  Skipped: ${stats.skipped} (already had explanations)\n` +
      `  ❌ Failed: ${stats.failures}\n` +
      `  📊 Total: ${stats.total}`
    );
  });
}

async function main(): Promise<void> {
  try {
    console.log('🔬 Sherlock Think Alpha - ARC Eval Analyzer');
    console.log('='.repeat(60));
    console.log(`🌐 API base URL: ${API_BASE_URL}`);
    console.log(`🤖 Model: ${MODEL_KEYS.join(', ')}`);
    console.log(`📚 Sources: ${SOURCES.join(', ')}`);
    console.log(`🎭 Note: Sherlock Think Alpha is a CLOAKED model - identity TBD`);
    console.log(`⏭️  Strategy: Skip puzzles with existing explanations`);
    console.log('='.repeat(60));

    const allResults: AnalysisResult[] = [];

    for (const source of SOURCES) {
      console.log(`\n📂 Loading puzzles for ${source}`);
      const puzzleIds = await fetchPuzzleIds(source);
      console.log(`📝 Loaded ${puzzleIds.length} puzzles (${source})`);

      for (let modelIndex = 0; modelIndex < MODEL_KEYS.length; modelIndex++) {
        const modelKey = MODEL_KEYS[modelIndex];
        console.log(`\n🎯 Launching model ${modelKey} for ${source}`);
        const modelResults = await fireModelWithSpacing(modelKey, source, puzzleIds);
        allResults.push(...modelResults);

        const nextModelExists = modelIndex < MODEL_KEYS.length - 1;
        if (nextModelExists) {
          console.log(`⏳ Waiting ${MODEL_SWITCH_DELAY_MS}ms before next model...`);
          await delay(MODEL_SWITCH_DELAY_MS);
        }
      }
    }

    const total = allResults.length;
    const analyzed = allResults.filter(r => r.success && !r.skipped).length;
    const skipped = allResults.filter(r => r.skipped).length;
    const failures = allResults.filter(r => !r.success).length;

    console.log('\n' + '='.repeat(60));
    console.log('🎉 Final Summary');
    console.log('='.repeat(60));
    console.log(`📊 Total puzzles processed: ${total}`);
    console.log(`✅ Successfully analyzed: ${analyzed}`);
    console.log(`⏭️  Skipped (already exist): ${skipped}`);
    console.log(`❌ Failures: ${failures}`);

    summarizeByModel(allResults);

    if (failures > 0) {
      console.log('\n❌ Failed analyses:');
      console.log('='.repeat(60));
      allResults.filter(r => !r.success && !r.skipped).forEach(result => {
        console.log(`  - ${result.puzzleId} [${result.modelKey}] (${result.source}): ${result.error}`);
      });
    }

    console.log('\n✨ Analysis run complete. Check the database for saved explanations.');

    if (failures > 0) {
      console.log(`\n💡 Tip: Run this script again to retry the ${failures} failed puzzle(s).`);
    }
  } catch (error) {
    console.error('💥 Fatal error during analysis run:', error);
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  console.log('\n⚠️  Analysis interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️  Analysis terminated by signal');
  process.exit(0);
});

main();
