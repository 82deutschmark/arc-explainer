/**
 * Unit tests for batchAnalysisService
 * Tests batch analysis workflow and session management
 * 
 * @author Cascade
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { batchAnalysisService } from '../../services/batchAnalysisService';
import { repositoryService } from '../../repositories/RepositoryService';

jest.mock('../../repositories/RepositoryService', () => ({
  repositoryService: {
    batchAnalysis: {
      createBatchSession: jest.fn(),
      updateBatchSession: jest.fn(),
      getBatchSession: jest.fn(),
      createBatchResult: jest.fn(),
      updateBatchResult: jest.fn(),
      getBatchResults: jest.fn(),
      getAllBatchSessions: jest.fn(),
    },
    isConnected: jest.fn().mockReturnValue(true),
  }
}));

jest.mock('../../services/explanationService', () => ({
  explanationService: {
    explainPuzzle: jest.fn(),
  }
}));

describe('batchAnalysisService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createBatchSession', () => {
    it('should create batch session with valid parameters', async () => {
      const sessionData = {
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 2000,
        puzzleIds: ['puzzle1', 'puzzle2'],
        estimatedCost: 0.50
      };

      (repositoryService.batchAnalysis.createBatchSession as jest.Mock)
        .mockResolvedValue(true);

      const result = await batchAnalysisService.createBatchSession(sessionData);

      expect(result.success).toBe(true);
      expect(result.sessionId).toBeDefined();
      expect(repositoryService.batchAnalysis.createBatchSession).toHaveBeenCalledWith({
        id: expect.any(String),
        model: sessionData.model,
        temperature: sessionData.temperature,
        maxTokens: sessionData.maxTokens,
        totalPuzzles: sessionData.puzzleIds.length,
        estimatedCost: sessionData.estimatedCost,
      });
    });

    it('should handle database connection failure', async () => {
      (repositoryService.isConnected as jest.Mock).mockReturnValue(false);

      const result = await batchAnalysisService.createBatchSession({
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 2000,
        puzzleIds: ['puzzle1'],
        estimatedCost: 0.10
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database not available');
    });
  });

  describe('processBatchAnalysis', () => {
    it('should process batch analysis and update progress', async () => {
      const sessionId = 'test-session-1';
      const puzzleIds = ['puzzle1', 'puzzle2'];

      const mockSession = {
        id: sessionId,
        model: 'gpt-4',
        status: 'running',
        totalPuzzles: 2,
        completedPuzzles: 0
      };

      (repositoryService.batchAnalysis.getBatchSession as jest.Mock)
        .mockResolvedValue(mockSession);

      (repositoryService.batchAnalysis.updateBatchSession as jest.Mock)
        .mockResolvedValue(true);

      (repositoryService.batchAnalysis.createBatchResult as jest.Mock)
        .mockResolvedValue(true);

      const mockExplanationService = require('../../services/explanationService');
      mockExplanationService.explanationService.explainPuzzle
        .mockResolvedValueOnce({ success: true, explanation: { id: 1 } })
        .mockResolvedValueOnce({ success: true, explanation: { id: 2 } });

      const result = await batchAnalysisService.processBatchAnalysis(sessionId, puzzleIds);

      expect(result.success).toBe(true);
      expect(repositoryService.batchAnalysis.updateBatchSession).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({
          status: 'completed',
          completedPuzzles: 2,
          successfulPuzzles: 2,
          failedPuzzles: 0
        })
      );
    });

    it('should handle partial failures in batch processing', async () => {
      const sessionId = 'test-session-1';
      const puzzleIds = ['puzzle1', 'puzzle2'];

      (repositoryService.batchAnalysis.getBatchSession as jest.Mock)
        .mockResolvedValue({ id: sessionId, model: 'gpt-4' });

      const mockExplanationService = require('../../services/explanationService');
      mockExplanationService.explanationService.explainPuzzle
        .mockResolvedValueOnce({ success: true, explanation: { id: 1 } })
        .mockResolvedValueOnce({ success: false, error: 'AI service error' });

      const result = await batchAnalysisService.processBatchAnalysis(sessionId, puzzleIds);

      expect(result.success).toBe(true);
      expect(repositoryService.batchAnalysis.updateBatchSession).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({
          successfulPuzzles: 1,
          failedPuzzles: 1
        })
      );
    });
  });

  describe('getBatchSessionStatus', () => {
    it('should return batch session with results', async () => {
      const sessionId = 'test-session-1';
      const mockSession = {
        id: sessionId,
        model: 'gpt-4',
        status: 'completed',
        totalPuzzles: 2,
        completedPuzzles: 2
      };

      const mockResults = [
        { puzzleId: 'puzzle1', success: true },
        { puzzleId: 'puzzle2', success: false }
      ];

      (repositoryService.batchAnalysis.getBatchSession as jest.Mock)
        .mockResolvedValue(mockSession);

      (repositoryService.batchAnalysis.getBatchResults as jest.Mock)
        .mockResolvedValue(mockResults);

      const result = await batchAnalysisService.getBatchSessionStatus(sessionId);

      expect(result).toEqual({
        session: mockSession,
        results: mockResults
      });
    });

    it('should return null for non-existent session', async () => {
      (repositoryService.batchAnalysis.getBatchSession as jest.Mock)
        .mockResolvedValue(null);

      const result = await batchAnalysisService.getBatchSessionStatus('nonexistent');

      expect(result).toBeNull();
    });
  });
});
