/**
 * Unit tests for FeedbackRepository
 * Tests feedback CRUD operations and statistics
 * 
 * @author Cascade
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { FeedbackRepository } from '../../repositories/FeedbackRepository';
import { mockFeedbackData, createMockClient } from '../mocks/mockDatabase';

jest.mock('../../repositories/base/BaseRepository.js', () => ({
  BaseRepository: jest.fn().mockImplementation(() => ({
    isConnected: jest.fn().mockReturnValue(true),
    getClient: jest.fn(),
    query: jest.fn(),
  }))
}));

describe('FeedbackRepository', () => {
  let repository: FeedbackRepository;
  let mockClient: any;

  beforeEach(() => {
    repository = new FeedbackRepository();
    mockClient = createMockClient();
    
    (repository as any).isConnected = jest.fn().mockReturnValue(true);
    (repository as any).getClient = jest.fn().mockResolvedValue(mockClient);
    (repository as any).query = jest.fn();
  });

  describe('addFeedback', () => {
    it('should add feedback successfully', async () => {
      mockClient.query.mockResolvedValue({
        rows: [mockFeedbackData]
      });

      const feedbackData = {
        explanationId: 1,
        voteType: 'helpful' as 'helpful',
        comment: 'Very helpful explanation',
        userAgent: 'test-agent',
        sessionId: 'test-session'
      };

      const result = await repository.addFeedback(feedbackData);

      expect(result.success).toBe(true);
      expect(result.feedback).toEqual({
        id: mockFeedbackData.id,
        explanationId: mockFeedbackData.explanation_id,
        voteType: mockFeedbackData.vote_type,
        comment: mockFeedbackData.comment,
        createdAt: mockFeedbackData.created_at,
        userAgent: mockFeedbackData.user_agent,
        sessionId: mockFeedbackData.session_id
      });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO feedback'),
        expect.arrayContaining([
          feedbackData.explanationId,
          feedbackData.voteType,
          feedbackData.comment,
          feedbackData.userAgent,
          feedbackData.sessionId
        ])
      );
    });

    it('should handle database not available', async () => {
      (repository as any).isConnected = jest.fn().mockReturnValue(false);

      await expect(repository.addFeedback({
        explanationId: 1,
        voteType: 'helpful',
        comment: 'test'
      })).rejects.toThrow('Database not available');
    });
  });

  describe('getFeedbackForExplanation', () => {
    it('should return feedback for explanation', async () => {
      (repository as any).query = jest.fn().mockResolvedValue({
        rows: [mockFeedbackData]
      });

      const result = await repository.getFeedbackForExplanation(1);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: mockFeedbackData.id,
        explanationId: mockFeedbackData.explanation_id,
        voteType: mockFeedbackData.vote_type,
        comment: mockFeedbackData.comment,
        createdAt: mockFeedbackData.created_at,
        userAgent: mockFeedbackData.user_agent,
        sessionId: mockFeedbackData.session_id
      });
    });

    it('should return empty array when database not connected', async () => {
      (repository as any).isConnected = jest.fn().mockReturnValue(false);

      const result = await repository.getFeedbackForExplanation(1);

      expect(result).toEqual([]);
    });
  });

  describe('getFeedbackSummaryStats', () => {
    it('should return comprehensive feedback statistics', async () => {
      const mockBasicStats = {
        total_feedback: '25',
        helpful_count: '18',
        not_helpful_count: '7',
        avg_comment_length: '42.5'
      };

      const mockTopModels = [{
        model_name: 'gpt-4',
        feedback_count: '15',
        helpful_count: '12',
        avg_confidence: '0.85'
      }];

      const mockDailyTrends = [{
        date: '2025-01-01',
        count: '5',
        helpful_count: '4'
      }];

      (repository as any).query = jest.fn()
        .mockResolvedValueOnce({ rows: [mockBasicStats] })
        .mockResolvedValueOnce({ rows: mockTopModels })
        .mockResolvedValueOnce({ rows: mockDailyTrends });

      const result = await repository.getFeedbackSummaryStats();

      expect(result).toEqual({
        totalFeedback: 25,
        helpfulCount: 18,
        notHelpfulCount: 7,
        helpfulPercentage: 72,
        averageCommentLength: 43,
        topModels: [{
          modelName: 'gpt-4',
          feedbackCount: 15,
          helpfulCount: 12,
          helpfulPercentage: 80,
          avgConfidence: 0.85
        }],
        feedbackTrends: {
          daily: [{
            date: '2025-01-01',
            totalCount: 5,
            helpfulCount: 4,
            notHelpfulCount: 1
          }],
          weekly: []
        }
      });
    });

    it('should return default stats when database not connected', async () => {
      (repository as any).isConnected = jest.fn().mockReturnValue(false);

      const result = await repository.getFeedbackSummaryStats();

      expect(result).toEqual({
        totalFeedback: 0,
        helpfulCount: 0,
        notHelpfulCount: 0,
        helpfulPercentage: 0,
        averageCommentLength: 0,
        topModels: [],
        feedbackTrends: {
          daily: [],
          weekly: []
        }
      });
    });
  });
});
