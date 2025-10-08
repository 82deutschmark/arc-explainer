/**
 * Author: Buffy the Base Agent (Codebuff)
 * Date: 2025-10-07
 * PURPOSE: Fire off up to 5 analyses for ARC2-Eval puzzles that do not yet have an explanation in the DB.
 *          Mirrors PuzzleExaminer behavior: POST /api/puzzle/analyze/:taskId/:model then POST /api/puzzle/save-explained/:taskId
 * SRP/DRY check: Pass — single-purpose helper script; reuses existing API endpoints, no new logic paths.
 * shadcn/ui: Pass — CLI script only
 */

import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

dotenv.config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';
// Use your working Grok-4-fast model key; change here if you prefer a different one
const MODEL_KEY = 'grok-4-fast-reasoning';

// ARC2-Eval lives under data/evaluation2
function getArc2EvalIds(): string[] {
  const dir = path.join(process.cwd(), 'data', 'evaluation2');
  const files = fs.readdirSync(dir);
  return files.filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
}

async function hasExplanation(puzzleId: string, modelKey?: string): Promise<boolean> {
  try {
    // Reuse existing endpoint; optional model filter if server supports query param (best-effort fallback)
    const url = `${API_BASE_URL}/api/puzzle/${encodeURIComponent(puzzleId)}/has-explanation` + (modelKey ? `?model=${encodeURIComponent(modelKey)}` : '');
    const { data } = await axios.get(url, { timeout: 15000 });
    if (data && typeof data === 'object') {
      // Expected shape: { success: true, data: { hasExplanation: boolean, ... } }
      const val = data.data?.hasExplanation;
      if (typeof val === 'boolean') return val;
      // Fallback: if server returns a boolean directly
      if (typeof data.data === 'boolean') return data.data;
    }
  } catch (e) {
    // If the endpoint shape changed, we’ll just fall back to treating as no explanation
  }
  return false;
}

async function analyzeAndSave(puzzleId: string) {
  const requestBody = {
    temperature: 0.2,
    promptId: 'solver',
    systemPromptMode: 'ARC',
    omitAnswer: true,
    retryMode: false
  };

  const encodedModel = encodeURIComponent(MODEL_KEY);

  const analyzeUrl = `${API_BASE_URL}/api/puzzle/analyze/${encodeURIComponent(puzzleId)}/${encodedModel}`;
  const saveUrl = `${API_BASE_URL}/api/puzzle/save-explained/${encodeURIComponent(puzzleId)}`;

  const startedAt = Date.now();
  try {
    console.log(`→ Analyzing ${puzzleId} with ${MODEL_KEY} ...`);
    const analyzeResp = await axios.post(analyzeUrl, requestBody, { timeout: 45 * 60 * 1000 });
    if (!analyzeResp.data?.success) throw new Error(analyzeResp.data?.message || 'analyze failed');
    const analysisData = analyzeResp.data.data;

    const payload = {
      explanations: {
        [MODEL_KEY]: {
          ...analysisData,
          modelKey: MODEL_KEY
        }
      }
    };

    const saveResp = await axios.post(saveUrl, payload, { timeout: 30000 });
    if (!saveResp.data?.success) throw new Error(saveResp.data?.message || 'save failed');

    const secs = Math.round((Date.now() - startedAt) / 1000);
    console.log(`✓ Saved ${puzzleId} in ${secs}s`);
    return { puzzleId, success: true, secs };
  } catch (err: any) {
    const secs = Math.round((Date.now() - startedAt) / 1000);
    const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Unknown error';
    console.log(`✗ ${puzzleId} failed in ${secs}s: ${msg}`);
    return { puzzleId, success: false, error: msg };
  }
}

async function main() {
  console.log('Run 5 unexplained ARC2-Eval analyses (simple mode)');
  console.log(`API: ${API_BASE_URL}`);
  console.log(`Model: ${MODEL_KEY}`);

  const allIds = getArc2EvalIds();

  // Filter to ones with no explanation yet (model-agnostic check first)
  const candidates: string[] = [];
  for (const id of allIds) {
    // Keep it quick: stop as soon as we collect 5
    if (candidates.length >= 5) break;
    const exists = await hasExplanation(id);
    if (!exists) candidates.push(id);
  }

  if (candidates.length === 0) {
    console.log('No unexplained ARC2-Eval puzzles found. All set!');
    return;
  }

  console.log(`Selected ${candidates.length} puzzle(s): ${candidates.join(', ')}`);

  const results = [] as Array<{ puzzleId: string; success: boolean; error?: string; secs?: number }>;
  for (const id of candidates) {
    results.push(await analyzeAndSave(id));
  }

  const ok = results.filter(r => r.success).length;
  const bad = results.length - ok;
  console.log(`\nSummary: ${ok} succeeded, ${bad} failed`);
  if (bad > 0) {
    console.log('Failures:');
    for (const r of results) if (!r.success) console.log(` - ${r.puzzleId}: ${r.error}`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err?.message || String(err));
  process.exit(1);
});
