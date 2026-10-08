/**
 * Author: GPT-6 Codex
 * Date: 2026-10-07
 * PURPOSE: Persist comparison selections without persisting scores. Reject legacy result
 *          envelopes so a changed backend scoring rule cannot leave an old score in the UI.
 * SRP/DRY check: Pass - Small pure cache boundary shared by the page and regression tests.
 */

import type { MetricsCompareRequest } from './compareService';

export const COMPARISON_CACHE_KEY = 'arc-comparison-data';
const CACHE_VERSION = '2026-10-07-selection-only';

function normalizeSelection(value: unknown): MetricsCompareRequest | null {
  if (!value || typeof value !== 'object') return null;
  const { dataset, modelNames } = value as Partial<MetricsCompareRequest>;
  if (typeof dataset !== 'string' || !dataset.trim() || !Array.isArray(modelNames)) return null;
  const models = [...new Set(modelNames
    .filter((name): name is string => typeof name === 'string' && Boolean(name.trim()))
    .map(name => name.trim()))].slice(0, 4);
  return models.length ? { dataset: dataset.trim(), modelNames: models } : null;
}

export function createComparisonSelectionCache(selection: MetricsCompareRequest) {
  return { version: CACHE_VERSION, selection: normalizeSelection(selection) };
}

function readEnvelope(value: unknown): MetricsCompareRequest | null {
  if (!value || typeof value !== 'object') return null;
  const envelope = value as { version?: unknown; selection?: unknown };
  return envelope.version === CACHE_VERSION ? normalizeSelection(envelope.selection) : null;
}

/** URL selections take priority; old envelopes containing result data are never restored. */
export function readComparisonSelection(
  search: string,
  historyValue: unknown,
  storedValue: string | null,
): MetricsCompareRequest | null {
  const params = new URLSearchParams(search);
  const fromUrl = normalizeSelection({
    dataset: params.get('dataset'),
    modelNames: ['model1', 'model2', 'model3', 'model4'].map(key => params.get(key)),
  });
  if (fromUrl) return fromUrl;
  const fromHistory = readEnvelope(historyValue);
  if (fromHistory) return fromHistory;
  if (!storedValue) return null;
  try {
    return readEnvelope(JSON.parse(storedValue));
  } catch {
    return null;
  }
}
