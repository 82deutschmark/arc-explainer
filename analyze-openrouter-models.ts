/**
 * Author: Codex
 * Date: 2025-11-11
 * PURPOSE: Analyze ARC Eval puzzles by firing requests to one OpenRouter model
 * (kimi-k2-thinking) spaced by 1s between submissions. It fetches puzzle IDs
 * with `/api/puzzle/list?source=...`, initiates analysis for each puzzle via
 * `/api/puzzle/analyze/:id/:model`, and saves explanations with
 * `/api/puzzle/save-explained/:id`. Requests are launched sequentially with a
 * 1s gap between starts but resolve concurrently in the background.
 * SRP/DRY check: Pass — API helpers are encapsulated; sequencing logic isolated.
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

type SourceKey = 'ARC1-Eval' | 'ARC2-Eval';

type ModelKey =
  | 'moonshotai/kimi-k2-thinking'
  | 'z-ai/glm-4.6v';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';
const SOURCES: SourceKey[] = ['ARC1-Eval', 'ARC2-Eval'];
const MODEL_KEY: ModelKey = 'z-ai/glm-4.6v';

// Hardcoded puzzle IDs for targeted runs (overrides source fetch when non-empty)
// Retry batch: 5 failed from run 3 (server unavailable + 400 error)
const HARDCODED_PUZZLE_IDS: string[] = [
  'bf45cf4b', '65b59efc', 'a251c730', 'edb79dae', 'fc7cae8d'
];

const RATE_LIMIT_DELAY_MS = Number(process.env.OPENROUTER_RATE_LIMIT_MS) || 30000;
// Not used now, but retained for clarity if future models are added.
const MODEL_SWITCH_DELAY_MS = Number(process.env.OPENROUTER_MODEL_SWITCH_DELAY_MS) || 3000;
const PUZZLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const SAVE_TIMEOUT_MS = 30 * 1000; // 30 seconds

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
}

interface PuzzleListRecord {
  id: string;
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
  const startTime = Date.now();
  try {
    console.log(`Analyzing ${puzzleId} with ${modelKey} (${source})`);
    await analyzeAndSave(puzzleId, modelKey);
    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`Completed ${puzzleId} with ${modelKey} in ${duration}s`);
    return { puzzleId, modelKey, source, success: true, responseTime: duration };
  } catch (error: any) {
    const duration = Math.round((Date.now() - startTime) / 1000);
    const message =
      error.response?.data?.message || error.response?.data?.error || error.message || 'Unknown failure';
    console.error(`Error for ${puzzleId} [${modelKey}]: ${message}`);
    return { puzzleId, modelKey, source, success: false, responseTime: duration, error: message };
  }
}

// Fires analyses to kimi with a 1s gap between starts; does not wait for each
// to finish before launching the next. Collects results when all settle.
async function fireKimiWithSpacing(
  source: SourceKey,
  puzzleIds: string[]
): Promise<AnalysisResult[]> {
  console.log(`Firing ${MODEL_KEY} across ${puzzleIds.length} puzzles from ${source} (1s spacing)`);

  const pending: Promise<AnalysisResult>[] = [];

  for (let index = 0; index < puzzleIds.length; index++) {
    const puzzleId = puzzleIds[index];
    // Launch without awaiting completion
    const p = analyzePuzzleWithModel(puzzleId, MODEL_KEY, source);
    pending.push(p);
    if (index < puzzleIds.length - 1) {
      await delay(RATE_LIMIT_DELAY_MS);
    }
  }

  const settled = await Promise.allSettled(pending);
  const results: AnalysisResult[] = settled.map(s =>
    s.status === 'fulfilled' ? s.value : ({ ...s.reason, success: false } as AnalysisResult)
  );

  const successCount = results.filter(r => r.success).length;
  const failureCount = results.length - successCount;
  console.log(
    `${MODEL_KEY} on ${source} completed: ${successCount}/${results.length} succeeded, ${failureCount} failed`
  );

  return results;
}

async function main(): Promise<void> {
  try {
    console.log('OpenRouter ARC Eval Analyzer');
    console.log('='.repeat(60));
    console.log(`API base URL: ${API_BASE_URL}`);
    console.log(`Model: ${MODEL_KEY}`);
    console.log(`Sources: ${SOURCES.join(', ')}`);
    console.log('='.repeat(60));

    const allResults: AnalysisResult[] = [];

    // Use hardcoded puzzle IDs if provided, otherwise fetch from sources
    if (HARDCODED_PUZZLE_IDS.length > 0) {
      console.log(`\nUsing ${HARDCODED_PUZZLE_IDS.length} hardcoded puzzle IDs`);
      const modelResults = await fireKimiWithSpacing('ARC1-Eval', HARDCODED_PUZZLE_IDS);
      allResults.push(...modelResults);
    } else {
      for (const source of SOURCES) {
        console.log(`\nLoading puzzles for ${source}`);
        const puzzleIds = await fetchPuzzleIds(source);
        console.log(`Loaded ${puzzleIds.length} puzzles (${source})`);

        const modelResults = await fireKimiWithSpacing(source, puzzleIds);
        allResults.push(...modelResults);
      }
    }

    const total = allResults.length;
    const successes = allResults.filter(r => r.success).length;
    const failures = total - successes;

    console.log('\nFinal summary');
    console.log('='.repeat(60));
    console.log(`Total analyses performed: ${total}`);
    console.log(`Successes: ${successes}`);
    console.log(`Failures: ${failures}`);

    if (failures > 0) {
      console.log('Failed analyses:');
      allResults.filter(r => !r.success).forEach(result => {
        console.log(`  - ${result.puzzleId} [${result.modelKey}] (${result.source}): ${result.error}`);
      });
    }

    console.log('\nAnalysis run complete. Check the database for saved explanations.');
  } catch (error) {
    console.error('Fatal error during analysis run:', error);
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  console.log('\nAnalysis interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nAnalysis terminated by signal');
  process.exit(0);
});

main();


