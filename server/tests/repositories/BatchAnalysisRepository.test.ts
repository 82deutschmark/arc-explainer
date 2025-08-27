/**
 * Unit tests for BatchAnalysisRepository
 * Tests batch session and result operations
 * 
 * @author Cascade
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BatchAnalysisRepository } from '../../repositories/BatchAnalysisRepository';
import { mockBatchSessionData, createMockClient } from '../mocks/mockDatabase';

jest.mock('../../repositories/base/BaseRepository.js', () => ({
  BaseRepository: jest.fn().mockImplementation(() => ({
    isConnected: jest.fn().mockReturnValue(true),
    getClient: jest.fn(),
    query: jest.fn(),
  }))
}));

describe('BatchAnalysisRepository', () => {
  let repository: BatchAnalysisRepository;
  let mockClient: any;

  beforeEach(() => {
    repository = new BatchAnalysisRepository();
    mockClient = createMockClient();
    
    (repository as any).isConnected = jest.fn().mockReturnValue(true);
    (repository as any).getClient = jest.fn().mockResolvedValue(mockClient);
    (repository as any).query = jest.fn();
  });

  describe('createBatchSession', () => {
    it('should create batch session successfully', async () => {
      mockClient.query.mockResolvedValue({ rowCount: 1 });

      const sessionData = {
        id: 'test-session-1',
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 2000,
        totalPuzzles: 10,
        estimatedCost: 0.50
      };

      const result = await repository.createBatchSession(sessionData);

      expect(result).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO batch_sessions'),
        expect.arrayContaining([
          sessionData.id,
          sessionData.model,
          sessionData.temperature,
          sessionData.maxTokens,
          sessionData.totalPuzzles,
          sessionData.estimatedCost
        ])
      );
    });

    it('should throw error when database not connected', async () => {
      (repository as any).isConnected = jest.fn().mockReturnValue(false);

      await expect(repository.createBatchSession({
        id: 'test',
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 2000,
        totalPuzzles: 10,
        estimatedCost: 0.50
      })).rejects.toThrow('Database not available');
    });
  });

  describe('updateBatchSession', () => {
    it('should update batch session with partial data', async () => {
      mockClient.query.mockResolvedValue({ rowCount: 1 });

      const updates = {
        status: 'completed',
        completedPuzzles: 10,
        successfulPuzzles: 8,
        failedPuzzles: 2
      };

      const result = await repository.updateBatchSession('test-session-1', updates);

      expect(result).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE batch_sessions'),
        expect.arrayContaining(['test-session-1'])
      );
    });
  });

  describe('getBatchSession', () => {
    it('should return batch session when found', async () => {
      (repository as any).query = jest.fn().mockResolvedValue({
        rows: [mockBatchSessionData]
      });

      const result = await repository.getBatchSession('test-session-1');

      expect(result).toEqual({
        id: mockBatchSessionData.id,
        model: mockBatchSessionData.model,
        temperature: mockBatchSessionData.temperature,
        maxTokens: mockBatchSessionData.max_tokens,
        status: mockBatchSessionData.status,
        totalPuzzles: mockBatchSessionData.total_puzzles,
        completedPuzzles: mockBatchSessionData.completed_puzzles,
        successfulPuzzles: mockBatchSessionData.successful_puzzles,
        failedPuzzles: mockBatchSessionData.failed_puzzles,
        createdAt: mockBatchSessionData.created_at,
        updatedAt: mockBatchSessionData.updated_at,
        estimatedCost: mockBatchSessionData.estimated_cost
      });
    });

    it('should return null when session not found', async () => {
      (repository as any).query = jest.fn().mockResolvedValue({ rows: [] });

      const result = await repository.getBatchSession('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('createBatchResult', () => {
    it('should create batch result successfully', async () => {
      mockClient.query.mockResolvedValue({ rowCount: 1 });

      const resultData = {
        sessionId: 'test-session-1',
        puzzleId: 'test-puzzle-1',
        success: true,
        processingTimeMs: 1500,
        cost: 0.01,
        errorMessage: null
      };

      const result = await repository.createBatchResult(resultData);

      expect(result).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO batch_results'),
        expect.arrayContaining([
          resultData.sessionId,
          resultData.puzzleId,
          resultData.success,
          resultData.processingTimeMs,
          resultData.cost,
          resultData.errorMessage
        ])
      );
    });
  });
});
