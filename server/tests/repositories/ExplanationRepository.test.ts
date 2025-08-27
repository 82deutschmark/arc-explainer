/**
 * Unit tests for ExplanationRepository
 * Tests all CRUD operations and business logic for explanation management
 * 
 * @author Cascade
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ExplanationRepository } from '../../repositories/ExplanationRepository';
import { mockPool, createMockClient, mockExplanationData } from '../mocks/mockDatabase';

// Mock the base repository
jest.mock('../../repositories/base/BaseRepository.js', () => ({
  BaseRepository: jest.fn().mockImplementation(() => ({
    isConnected: jest.fn().mockReturnValue(true),
    getClient: jest.fn(),
    query: jest.fn(),
  }))
}));

describe('ExplanationRepository', () => {
  let repository: ExplanationRepository;
  let mockClient: any;

  beforeEach(() => {
    repository = new ExplanationRepository();
    mockClient = createMockClient();
    
    // Setup default mocks
    (repository as any).isConnected = jest.fn().mockReturnValue(true);
    (repository as any).getClient = jest.fn().mockResolvedValue(mockClient);
    (repository as any).query = jest.fn();
  });

  describe('saveExplanation', () => {
    it('should save explanation and return ExplanationResponse', async () => {
      const explanationData = {
        taskId: 'test-puzzle-1',
        patternDescription: 'Test pattern',
        transformationRule: 'Test rule',
        modelName: 'gpt-4',
        confidence: 0.85,
        apiProcessingTimeMs: 1500,
        estimatedCost: 0.01,
        hasReasoningLog: true,
        reasoningLog: 'Test reasoning'
      };

      mockClient.query.mockResolvedValue({
        rows: [mockExplanationData]
      });

      const result = await repository.saveExplanation(explanationData);

      expect(result).toEqual({
        id: mockExplanationData.id,
        taskId: mockExplanationData.task_id,
        patternDescription: mockExplanationData.pattern_description,
        transformationRule: mockExplanationData.transformation_rule,
        modelName: mockExplanationData.model_name,
        confidence: mockExplanationData.confidence,
        apiProcessingTimeMs: mockExplanationData.api_processing_time_ms,
        estimatedCost: mockExplanationData.estimated_cost,
        createdAt: mockExplanationData.created_at,
        hasReasoningLog: mockExplanationData.has_reasoning_log,
        reasoningLog: mockExplanationData.reasoning_log
      });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO explanations'),
        expect.arrayContaining([
          explanationData.taskId,
          explanationData.patternDescription,
          explanationData.transformationRule,
          explanationData.modelName,
          explanationData.confidence,
          explanationData.apiProcessingTimeMs,
          explanationData.estimatedCost,
          explanationData.hasReasoningLog,
          explanationData.reasoningLog
        ])
      );
    });

    it('should throw error when database not connected', async () => {
      (repository as any).isConnected = jest.fn().mockReturnValue(false);

      await expect(repository.saveExplanation({
        taskId: 'test',
        patternDescription: 'test',
        transformationRule: 'test',
        modelName: 'gpt-4'
      })).rejects.toThrow('Database not available');
    });
  });

  describe('getExplanationById', () => {
    it('should return explanation when found', async () => {
      (repository as any).query = jest.fn().mockResolvedValue({
        rows: [mockExplanationData]
      });

      const result = await repository.getExplanationById(1);

      expect(result).toEqual({
        id: mockExplanationData.id,
        taskId: mockExplanationData.task_id,
        patternDescription: mockExplanationData.pattern_description,
        transformationRule: mockExplanationData.transformation_rule,
        modelName: mockExplanationData.model_name,
        confidence: mockExplanationData.confidence,
        apiProcessingTimeMs: mockExplanationData.api_processing_time_ms,
        estimatedCost: mockExplanationData.estimated_cost,
        createdAt: mockExplanationData.created_at,
        hasReasoningLog: mockExplanationData.has_reasoning_log,
        reasoningLog: mockExplanationData.reasoning_log
      });
    });

    it('should return null when explanation not found', async () => {
      (repository as any).query = jest.fn().mockResolvedValue({ rows: [] });

      const result = await repository.getExplanationById(999);

      expect(result).toBeNull();
    });

    it('should return null when database not connected', async () => {
      (repository as any).isConnected = jest.fn().mockReturnValue(false);

      const result = await repository.getExplanationById(1);

      expect(result).toBeNull();
    });
  });

  describe('getBulkExplanationStatus', () => {
    it('should return status map for multiple task IDs', async () => {
      (repository as any).query = jest.fn().mockResolvedValue({
        rows: [{
          puzzle_id: 'test-puzzle-1',
          has_explanation: true,
          explanation_id: 1,
          feedback_count: 3,
          api_processing_time_ms: 1500,
          model_name: 'gpt-4',
          created_at: mockExplanationData.created_at,
          confidence: 0.85,
          estimated_cost: 0.01
        }]
      });

      const result = await repository.getBulkExplanationStatus(['test-puzzle-1', 'test-puzzle-2']);

      expect(result).toEqual({
        'test-puzzle-1': {
          hasExplanation: true,
          explanationId: 1,
          feedbackCount: 3,
          apiProcessingTimeMs: 1500,
          modelName: 'gpt-4',
          createdAt: mockExplanationData.created_at,
          confidence: 0.85,
          estimatedCost: 0.01
        },
        'test-puzzle-2': {
          hasExplanation: false,
          explanationId: null,
          feedbackCount: 0,
          apiProcessingTimeMs: null,
          modelName: null,
          createdAt: null,
          confidence: null,
          estimatedCost: null
        }
      });
    });

    it('should return empty object when no task IDs provided', async () => {
      const result = await repository.getBulkExplanationStatus([]);

      expect(result).toEqual({});
    });
  });
});
