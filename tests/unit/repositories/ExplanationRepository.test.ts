/**
 * Author: GPT-5 Codex
 * Date: 2026-01-08T20:25:33-05:00
 * PURPOSE: Validate ExplanationRepository filtering, sanitization, and parameter shaping
 *          for JSONB storage and multi-test payload handling.
 * SRP/DRY check: Pass - Focused repository behavior only.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ExplanationRepository } from '../../../server/repositories/ExplanationRepository.js';

describe('ExplanationRepository', () => {
  let repository: ExplanationRepository;

  beforeEach(() => {
    repository = new ExplanationRepository();
    vi.spyOn(repository as any, 'isConnected').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getExplanationsForPuzzle', () => {
    it('applies correctness filter and sanitizes complex JSON fields', async () => {
      const fakeRow = {
        id: 42,
        puzzleId: 'puzzle-123',
        patternDescription: 'Pattern',
        solvingStrategy: 'Strategy',
        hints: '["Hint 1","Hint 2"]',
        confidence: '0.9',
        predictedOutputGrid: JSON.stringify([[1, 2]]),
        multiplePredictedOutputs: JSON.stringify({ predictedOutput1: [[3, 4]] }),
        multiTestResults: JSON.stringify([{ isPredictionCorrect: true }]),
        multiTestPredictionGrids: JSON.stringify([[[5, 6]]]),
        hasMultiplePredictions: true,
        multiTestAllCorrect: true,
        isPredictionCorrect: null,
        saturnImages: JSON.stringify(['img']),
        groverIterations: JSON.stringify([{ step: 1 }]),
        beetreeModelResults: JSON.stringify([{ model: 'x' }]),
        beetreeCostBreakdown: JSON.stringify({ total: 1 }),
        beetreeTokenUsage: JSON.stringify({ reasoning: 100 }),
        councilStage1Results: JSON.stringify([{ id: 1 }]),
        councilStage2Rankings: JSON.stringify([{ id: 2 }]),
        councilStage3Synthesis: JSON.stringify({ summary: 'done' }),
        councilMetadata: JSON.stringify({ round: 1 }),
        councilAggregateRankings: JSON.stringify([{ winner: 'A' }]),
      };

      const queryMock = vi
        .spyOn(repository as any, 'query')
        .mockResolvedValue({
          rows: [fakeRow],
          rowCount: 1,
        });

      const result = await repository.getExplanationsForPuzzle('puzzle-123', 'correct');

      expect(queryMock).toHaveBeenCalledTimes(1);
      const [sql, params] = queryMock.mock.calls[0];
      expect(sql).toContain('COALESCE(has_multiple_predictions');
      expect(params).toEqual(['puzzle-123']);

      expect(result).toHaveLength(1);
      const explanation = result[0];
      expect(explanation.hints).toEqual(['Hint 1', 'Hint 2']);
      expect(explanation.predictedOutputGrid).toEqual([[1, 2]]);
      expect(explanation.multiplePredictedOutputs).toEqual({ predictedOutput1: [[3, 4]] });
      expect(explanation.multiTestResults).toEqual([{ isPredictionCorrect: true }]);
      expect(explanation.multiTestPredictionGrids).toEqual([[[5, 6]]]);
      expect(explanation.hasMultiplePredictions).toBe(true);
      expect(explanation.multiTestAllCorrect).toBe(true);
      expect(explanation.saturnImages).toEqual(['img']);
      expect(explanation.groverIterations).toEqual([{ step: 1 }]);
      expect(explanation.beetreeModelResults).toEqual([{ model: 'x' }]);
      expect(explanation.councilMetadata).toEqual({ round: 1 });
    });
  });

  describe('saveExplanation', () => {
    it('normalizes payload before persistence (numTestPairs, sanitization, JSON encoding)', async () => {
      const client = { query: vi.fn(), release: vi.fn() };
      vi.spyOn(repository as any, 'getClient').mockResolvedValue(client);

      const queryMock = vi.spyOn(repository as any, 'query').mockResolvedValue({
        rows: [{ id: 99 }],
        rowCount: 1,
      });

      const multiTestResults = JSON.stringify([
        { isPredictionCorrect: false },
        { isPredictionCorrect: true },
      ]);

      await repository.saveExplanation({
        puzzleId: 'abc',
        patternDescription: 'desc',
        solvingStrategy: 'solve',
        hints: ['hint'],
        confidence: 2,
        modelName: 'model-x',
        reasoningLog: null,
        reasoningItems: null,
        hasMultiplePredictions: true,
        multiTestResults,
        multiTestPredictionGrids: [[[1, 'bad']]], // invalid -> sanitized to 0s
        predictedOutputGrid: [[1, 'x']], // invalid cell -> sanitized to 0
      } as any);

      expect(queryMock).toHaveBeenCalledTimes(1);
      const [, params, passedClient] = queryMock.mock.calls[0];

      expect(passedClient).toBe(client);
      expect(params.at(-1)).toBe(2); // num_test_pairs
      expect(params[94]).toBe('[[1,0]]'); // sanitized predicted grid stringified
      expect(params[119]).toBe('[[[1,0]]]'); // sanitized multi-test prediction grids
      expect(client.release).toHaveBeenCalledTimes(1);
    });
  });
});
