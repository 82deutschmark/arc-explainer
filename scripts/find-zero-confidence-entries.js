/*
 * Author: Codex using GPT-4.1
 * Date: 2025-10-09 21:25:00
 * PURPOSE: Normalize legacy confidence values, repair trustworthiness metrics impacted by Grok/Grover decimal confidences, and default missing confidence responses to 50% so calibration analytics stay trustworthy across the dataset. Operates directly against PostgreSQL.
 * SRP/DRY check: Pass — one maintenance script focused on confidence normalization and trustworthiness recalculation; reuses shared logic concepts without duplicating repository code.
 * shadcn/ui: Pass — backend data repair only; no UI components involved.
 */

import 'dotenv/config';
import { Pool } from 'pg';

const APPLY_CHANGES = process.argv.includes('--apply');
const DEFAULT_CONFIDENCE = 50;
const TARGET_MODEL_PATTERNS = [/^grok/i, /^x-ai\/grok/i, /^grover/i];
const CONFIDENCE_THRESHOLD = 1; // Values <= 1 require normalization review
const TRUST_DELTA_THRESHOLD = 0.0001;

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function isTargetModel(modelName) {
  if (!modelName) return false;
  return TARGET_MODEL_PATTERNS.some(pattern => pattern.test(modelName));
}

function coerceNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const cleaned = value
      .replace(/percent(age)?/gi, '')
      .replace(/%/g, '')
      .replace(',', '.')
      .trim();
    if (cleaned.length === 0) {
      return null;
    }
    const parsed = parseFloat(cleaned);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function findConfidenceInObject(value) {
  const visited = new Set();
  const stack = [value];

  while (stack.length > 0) {
    const current = stack.pop();

    if (!current || typeof current !== 'object') {
      continue;
    }

    if (visited.has(current)) {
      continue;
    }
    visited.add(current);

    if (Array.isArray(current)) {
      for (const entry of current) {
        stack.push(entry);
      }
      continue;
    }

    for (const [key, entry] of Object.entries(current)) {
      if (typeof key === 'string' && key.toLowerCase().includes('confidence')) {
        const numeric = coerceNumber(entry);
        if (numeric !== null) {
          return numeric;
        }
      }
      if (entry && typeof entry === 'object') {
        stack.push(entry);
      }
    }
  }

  return null;
}

function extractConfidenceFromRaw(raw) {
  if (!raw) {
    return null;
  }

  let parsed = null;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        const regexMatch = trimmed.match(/"confidence"\s*:\s*(-?\d+(\.\d+)?)/i);
        if (regexMatch && regexMatch[1]) {
          return parseFloat(regexMatch[1]);
        }
      }
    }
  } else if (typeof raw === 'object') {
    parsed = raw;
  }

  if (parsed) {
    const numeric = findConfidenceInObject(parsed);
    if (numeric !== null) {
      return numeric;
    }
  }

  return null;
}

function normalizeConfidenceValue(raw) {
  if (raw === null || raw === undefined || Number.isNaN(raw)) {
    return DEFAULT_CONFIDENCE;
  }

  let numeric = raw;
  if (typeof numeric === 'string') {
    numeric = coerceNumber(numeric);
    if (numeric === null) {
      return DEFAULT_CONFIDENCE;
    }
  }

  if (typeof numeric !== 'number' || Number.isNaN(numeric)) {
    return DEFAULT_CONFIDENCE;
  }

  if (numeric < 0) {
    numeric = 0;
  }

  if (numeric > 0 && numeric <= 1) {
    numeric = numeric * 100;
  }

  if (numeric > 100) {
    numeric = 100;
  }

  return Math.round(numeric);
}

function calculateTrustworthinessScore(isCorrect, confidence) {
  if (confidence === null || confidence === undefined || Number.isNaN(confidence)) {
    return null;
  }

  if (typeof isCorrect !== 'boolean') {
    return null;
  }

  const normalizedConfidence = Math.max(0, Math.min(100, confidence)) / 100;
  if (isCorrect) {
    return Math.max(0.5, 0.5 + (normalizedConfidence * 0.5));
  }

  return 1.0 - normalizedConfidence;
}

function pickPreferredCorrectness(row) {
  if (typeof row.is_prediction_correct === 'boolean') {
    return row.is_prediction_correct;
  }
  if (typeof row.multi_test_all_correct === 'boolean') {
    return row.multi_test_all_correct;
  }
  return null;
}

function deriveConfidence(row) {
  const rawConfidence = extractConfidenceFromRaw(row.provider_raw_response);
  if (rawConfidence !== null) {
    return normalizeConfidenceValue(rawConfidence);
  }

  if (row.confidence === null) {
    return DEFAULT_CONFIDENCE;
  }

  if (row.confidence <= CONFIDENCE_THRESHOLD) {
    if (isTargetModel(row.model_name)) {
      if (row.confidence === 1) {
        return 100;
      }
      return DEFAULT_CONFIDENCE;
    }
    return DEFAULT_CONFIDENCE;
  }

  return Math.round(Math.max(0, Math.min(100, row.confidence)));
}

async function loadCandidates() {
  const { rows } = await pool.query(`
    SELECT 
      id,
      model_name,
      confidence,
      is_prediction_correct,
      multi_test_all_correct,
      trustworthiness_score,
      prediction_accuracy_score,
      provider_raw_response::text AS provider_raw_response
    FROM explanations
    WHERE confidence IS NULL
      OR confidence <= $1
      OR model_name ILIKE 'grok%'
      OR model_name ILIKE 'x-ai/grok%'
      OR model_name ILIKE 'grover%'
      OR (is_prediction_correct = FALSE AND trustworthiness_score IS NOT NULL AND trustworthiness_score > 0.9)
      OR (is_prediction_correct = TRUE AND trustworthiness_score IS NOT NULL AND trustworthiness_score < 0.5)
    ORDER BY id ASC
  `, [CONFIDENCE_THRESHOLD]);
  return rows;
}

async function applyUpdates(updates) {
  if (updates.length === 0) {
    return;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const update of updates) {
      await client.query(
        `UPDATE explanations
         SET confidence = $1,
             trustworthiness_score = $2,
             prediction_accuracy_score = $3
         WHERE id = $4`,
        [
          update.newConfidence,
          update.newTrustworthiness,
          update.newPredictionScore,
          update.id
        ]
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function summarizeResults(updates) {
  const summary = {
    updatedRows: updates.length,
    scaledDecimals: updates.filter(item => item.reason === 'scaled-decimal').length,
    defaultedToFifty: updates.filter(item => item.reason === 'default-50').length,
    promotedToHundred: updates.filter(item => item.reason === 'promoted-100').length,
    trustOnlyRecalcs: updates.filter(item => item.reason === 'trust-recalc').length
  };

  console.log('\nSummary:');
  console.table(summary);

  if (updates.length > 0) {
    console.log('\nSample fixes:');
    console.table(updates.slice(0, 10).map(item => ({
      id: item.id,
      model: item.modelName,
      oldConfidence: item.oldConfidence,
      newConfidence: item.newConfidence,
      oldTrust: item.oldTrustworthiness,
      newTrust: item.newTrustworthiness,
      reason: item.reason
    })));
  }
}

async function main() {
  console.log(`\nStarting confidence repair script (${APPLY_CHANGES ? 'apply mode' : 'dry run'})`);

  const candidates = await loadCandidates();
  console.log(`Evaluating ${candidates.length} explanation records for confidence normalization...\n`);

  const updates = [];

  for (const row of candidates) {
    const newConfidence = deriveConfidence(row);
    const boundedConfidence = Math.max(0, Math.min(100, Math.round(newConfidence)));
    const correctness = pickPreferredCorrectness(row);
    const recalculatedTrust = calculateTrustworthinessScore(correctness, boundedConfidence);
    const finalTrust = recalculatedTrust !== null ? parseFloat(recalculatedTrust.toFixed(4)) : row.trustworthiness_score;
    const finalPredictionScore = recalculatedTrust !== null ? finalTrust : row.prediction_accuracy_score;

    const confidenceChanged = row.confidence !== boundedConfidence;
    const trustChanged = recalculatedTrust !== null && (row.trustworthiness_score === null || Math.abs(row.trustworthiness_score - finalTrust) > TRUST_DELTA_THRESHOLD);
    const predictionScoreChanged = recalculatedTrust !== null && (row.prediction_accuracy_score === null || Math.abs(row.prediction_accuracy_score - finalPredictionScore) > TRUST_DELTA_THRESHOLD);

    if (!confidenceChanged && !trustChanged && !predictionScoreChanged) {
      continue;
    }

    let reason = 'trust-recalc';
    if (confidenceChanged) {
      if (boundedConfidence === DEFAULT_CONFIDENCE && (row.confidence === null || row.confidence <= CONFIDENCE_THRESHOLD)) {
        reason = 'default-50';
      } else if (boundedConfidence === 100 && row.confidence === 1) {
        reason = 'promoted-100';
      } else if (row.confidence !== boundedConfidence) {
        reason = 'scaled-decimal';
      }
    }

    updates.push({
      id: row.id,
      modelName: row.model_name,
      oldConfidence: row.confidence,
      newConfidence: boundedConfidence,
      oldTrustworthiness: row.trustworthiness_score,
      newTrustworthiness: finalTrust,
      newPredictionScore: finalPredictionScore,
      reason
    });
  }

  summarizeResults(updates);

  if (updates.length === 0) {
    console.log('\nNo changes required. Confidence metrics already normalized.');
    await pool.end();
    return;
  }

  if (!APPLY_CHANGES) {
    console.log('\nDry run complete. Re-run with --apply to persist these fixes.');
    await pool.end();
    return;
  }

  try {
    await applyUpdates(updates);
    console.log(`\nSuccessfully updated ${updates.length} explanation records.`);
  } catch (error) {
    console.error('\nFailed to apply updates:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error('Unexpected error during confidence repair:', error);
  pool.end().finally(() => process.exit(1));
});
