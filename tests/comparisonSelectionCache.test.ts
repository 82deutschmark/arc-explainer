/**
 * Author: GPT-6 Codex
 * Date: 2026-10-07
 * PURPOSE: Regress the saved 86.7% comparison score surviving a scoring correction.
 *          Check legacy payload rejection, URL precedence and selection-only persistence.
 * SRP/DRY check: Pass - Uses the same cache boundary as ModelComparisonPage.
 */

import { test, expect } from 'vitest';
import {
  createComparisonSelectionCache,
  readComparisonSelection,
} from '../client/src/services/metrics/comparisonSelectionCache';

const selection = {
  dataset: 'evaluation2',
  modelNames: ['claude-opus-4-6-thinking-120K-max-attempt1', 'claude-opus-4-6-thinking-120K-max-attempt2'],
};
const oldResults = {
  version: '2025-11-02-model-comparison-refresh',
  data: {
    summary: {
      dataset: selection.dataset,
      modelPerformance: selection.modelNames.map(modelName => ({ modelName })),
      attemptUnionStats: [{ unionAccuracyPercentage: 86.7 }],
    },
    details: [],
  },
};

test('legacy results cannot restore a score from history or local storage', () => {
  expect(readComparisonSelection('', oldResults, JSON.stringify(oldResults))).toBeNull();
  const query = new URLSearchParams({ dataset: selection.dataset, model1: selection.modelNames[0], model2: selection.modelNames[1] });
  expect(readComparisonSelection(`?${query}`, oldResults, JSON.stringify(oldResults))).toEqual(selection);
});

test('a restored cache contains only a request; results still have to be fetched', () => {
  const envelope = createComparisonSelectionCache({ ...selection, data: oldResults.data } as typeof selection);
  expect(Object.keys(envelope)).toEqual(['version', 'selection']);
  expect(JSON.stringify(envelope)).not.toContain('86.7');
  expect(readComparisonSelection('', null, JSON.stringify(envelope))).toEqual(selection);
  expect(readComparisonSelection('', envelope, null)).toEqual(selection);
});

test('shared URL selection wins over stored selections and malformed cache is ignored', () => {
  const cached = createComparisonSelectionCache(selection);
  expect(readComparisonSelection('?dataset=evaluation&model1=gemini-3-pro-preview-attempt1', cached, JSON.stringify(cached)))
    .toEqual({ dataset: 'evaluation', modelNames: ['gemini-3-pro-preview-attempt1'] });
  expect(readComparisonSelection('', null, '{')).toBeNull();
  expect(readComparisonSelection('', { ...cached, selection: { dataset: 'evaluation2', modelNames: [null, 9, ''] } }, null)).toBeNull();
});
