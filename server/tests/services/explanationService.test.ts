/**
 * Unit tests for explanationService
 * Tests service layer logic for explanation operations
 * 
 * @author Cascade
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { explanationService } from '../../services/explanationService';
import { repositoryService } from '../../repositories/RepositoryService';
import { aiServiceFactory } from '../../services/aiServiceFactory';

// Mock dependencies
jest.mock('../../repositories/RepositoryService', () => ({
  repositoryService: {
    explanations: {
      saveExplanation: jest.fn(),
      getExplanationById: jest.fn(),
      getBulkExplanationStatus: jest.fn(),
    },
    isConnected: jest.fn().mockReturnValue(true),
  }
}));

jest.mock('../../services/aiServiceFactory', () => ({
  aiServiceFactory: {
    createService: jest.fn(),
  }
}));

jest.mock('../../services/puzzleLoader', () => ({
  puzzleLoader: {
    loadPuzzle: jest.fn(),
    validateTask: jest.fn().mockReturnValue(true),
  }
}));

describe('explanationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('explainPuzzle', () => {
    it('should generate and save explanation successfully', async () => {
      const mockPuzzle = {
        id: 'test-puzzle-1',
        train: [{ input: [[1, 0]], output: [[0, 1]] }],
        test: [{ input: [[1, 0]] }],
      };

      const mockAiService = {
        explainPuzzle: jest.fn().mockResolvedValue({
          patternDescription: 'Flip bits horizontally',
          transformationRule: 'Each 1 becomes 0 and each 0 becomes 1',
          confidence: 0.95,
          hasReasoningLog: true,
          reasoningLog: 'Step by step analysis...',
          apiProcessingTimeMs: 2000,
          estimatedCost: 0.02,
        }),
      };

      const mockSavedExplanation = {
        id: 1,
        taskId: 'test-puzzle-1',
        patternDescription: 'Flip bits horizontally',
        transformationRule: 'Each 1 becomes 0 and each 0 becomes 1',
        modelName: 'gpt-4',
        confidence: 0.95,
        apiProcessingTimeMs: 2000,
        estimatedCost: 0.02,
        createdAt: new Date(),
        hasReasoningLog: true,
        reasoningLog: 'Step by step analysis...',
      };

      (require('../../services/puzzleLoader').puzzleLoader.loadPuzzle as jest.Mock)
        .mockResolvedValue(mockPuzzle);
      
      (aiServiceFactory.createService as jest.Mock).mockReturnValue(mockAiService);
      
      (repositoryService.explanations.saveExplanation as jest.Mock)
        .mockResolvedValue(mockSavedExplanation);

      const result = await explanationService.explainPuzzle('test-puzzle-1', 'gpt-4');

      expect(result.success).toBe(true);
      expect(result.explanation).toEqual(mockSavedExplanation);
      expect(aiServiceFactory.createService).toHaveBeenCalledWith('gpt-4');
      expect(mockAiService.explainPuzzle).toHaveBeenCalledWith(mockPuzzle);
      expect(repositoryService.explanations.saveExplanation).toHaveBeenCalledWith({
        taskId: 'test-puzzle-1',
        patternDescription: 'Flip bits horizontally',
        transformationRule: 'Each 1 becomes 0 and each 0 becomes 1',
        modelName: 'gpt-4',
        confidence: 0.95,
        apiProcessingTimeMs: 2000,
        estimatedCost: 0.02,
        hasReasoningLog: true,
        reasoningLog: 'Step by step analysis...',
      });
    });

    it('should handle puzzle not found error', async () => {
      (require('../../services/puzzleLoader').puzzleLoader.loadPuzzle as jest.Mock)
        .mockResolvedValue(null);

      const result = await explanationService.explainPuzzle('nonexistent', 'gpt-4');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Puzzle not found');
    });

    it('should handle AI service errors', async () => {
      const mockPuzzle = { id: 'test-puzzle-1' };
      const mockAiService = {
        explainPuzzle: jest.fn().mockRejectedValue(new Error('AI service unavailable')),
      };

      (require('../../services/puzzleLoader').puzzleLoader.loadPuzzle as jest.Mock)
        .mockResolvedValue(mockPuzzle);
      
      (aiServiceFactory.createService as jest.Mock).mockReturnValue(mockAiService);

      const result = await explanationService.explainPuzzle('test-puzzle-1', 'gpt-4');

      expect(result.success).toBe(false);
      expect(result.error).toContain('AI service unavailable');
    });
  });

  describe('retryAnalysis', () => {
    it('should retry analysis with feedback guidance', async () => {
      const mockPuzzle = { id: 'test-puzzle-1' };
      const mockAiService = {
        explainPuzzle: jest.fn().mockResolvedValue({
          patternDescription: 'Improved pattern description',
          transformationRule: 'Improved rule',
          confidence: 0.90,
        }),
      };

      (require('../../services/puzzleLoader').puzzleLoader.loadPuzzle as jest.Mock)
        .mockResolvedValue(mockPuzzle);
      
      (aiServiceFactory.createService as jest.Mock).mockReturnValue(mockAiService);
      
      (repositoryService.explanations.saveExplanation as jest.Mock)
        .mockResolvedValue({ id: 2 });

      const result = await explanationService.retryAnalysis(
        'test-puzzle-1',
        'gpt-4',
        'Previous explanation was too vague'
      );

      expect(result.success).toBe(true);
      expect(mockAiService.explainPuzzle).toHaveBeenCalledWith(
        mockPuzzle,
        expect.objectContaining({
          guidance: 'Previous explanation was too vague',
          isRetry: true,
        })
      );
    });
  });

  describe('getExplanationById', () => {
    it('should retrieve explanation by ID', async () => {
      const mockExplanation = {
        id: 1,
        taskId: 'test-puzzle-1',
        patternDescription: 'Test pattern',
        modelName: 'gpt-4',
      };

      (repositoryService.explanations.getExplanationById as jest.Mock)
        .mockResolvedValue(mockExplanation);

      const result = await explanationService.getExplanationById('1');

      expect(result).toEqual(mockExplanation);
      expect(repositoryService.explanations.getExplanationById).toHaveBeenCalledWith(1);
    });

    it('should handle invalid ID format', async () => {
      const result = await explanationService.getExplanationById('invalid');

      expect(result).toBeNull();
    });
  });
});
