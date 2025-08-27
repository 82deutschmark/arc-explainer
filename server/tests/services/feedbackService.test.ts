/**
 * Unit tests for feedbackService
 * Tests feedback submission and retry analysis workflow
 * 
 * @author Cascade
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { feedbackService } from '../../services/feedbackService';
import { repositoryService } from '../../repositories/RepositoryService';
import { explanationService } from '../../services/explanationService';

jest.mock('../../repositories/RepositoryService', () => ({
  repositoryService: {
    feedback: {
      addFeedback: jest.fn(),
    },
    explanations: {
      getExplanationById: jest.fn(),
    }
  }
}));

jest.mock('../../services/explanationService', () => ({
  explanationService: {
    retryAnalysis: jest.fn(),
  }
}));

describe('feedbackService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('addFeedback', () => {
    it('should add helpful feedback successfully', async () => {
      const mockFeedbackResult = {
        success: true,
        feedback: { id: 1 }
      };

      (repositoryService.feedback.addFeedback as jest.Mock)
        .mockResolvedValue(mockFeedbackResult);

      const result = await feedbackService.addFeedback(1, 'helpful', 'This explanation was very clear and helped me understand the pattern.');

      expect(result).toEqual({
        success: true,
        message: 'Feedback recorded successfully',
        feedbackId: 1
      });

      expect(repositoryService.feedback.addFeedback).toHaveBeenCalledWith({
        explanationId: 1,
        voteType: 'helpful',
        comment: 'This explanation was very clear and helped me understand the pattern.'
      });
    });

    it('should add not helpful feedback and trigger retry analysis', async () => {
      const mockFeedbackResult = {
        success: true,
        feedback: { id: 2 }
      };

      const mockExplanation = {
        id: 1,
        taskId: 'test-puzzle-1',
        modelName: 'gpt-4'
      };

      (repositoryService.feedback.addFeedback as jest.Mock)
        .mockResolvedValue(mockFeedbackResult);

      (repositoryService.explanations.getExplanationById as jest.Mock)
        .mockResolvedValue(mockExplanation);

      (explanationService.retryAnalysis as jest.Mock)
        .mockResolvedValue({ success: true });

      const result = await feedbackService.addFeedback(
        1, 
        'not_helpful', 
        'The explanation was too vague and did not clearly explain the transformation rule.'
      );

      expect(result).toEqual({
        success: true,
        message: 'Feedback recorded. Generating improved explanation...',
        feedbackId: 2
      });

      expect(explanationService.retryAnalysis).toHaveBeenCalledWith(
        'test-puzzle-1',
        'gpt-4',
        'The explanation was too vague and did not clearly explain the transformation rule.'
      );
    });

    it('should handle string explanation ID', async () => {
      const mockFeedbackResult = {
        success: true,
        feedback: { id: 3 }
      };

      (repositoryService.feedback.addFeedback as jest.Mock)
        .mockResolvedValue(mockFeedbackResult);

      const result = await feedbackService.addFeedback('123', 'helpful', 'Great explanation, very detailed and accurate.');

      expect(repositoryService.feedback.addFeedback).toHaveBeenCalledWith({
        explanationId: 123,
        voteType: 'helpful',
        comment: 'Great explanation, very detailed and accurate.'
      });
    });

    it('should continue even if retry analysis fails', async () => {
      const mockFeedbackResult = {
        success: true,
        feedback: { id: 4 }
      };

      const mockExplanation = {
        id: 1,
        taskId: 'test-puzzle-1',
        modelName: 'gpt-4'
      };

      (repositoryService.feedback.addFeedback as jest.Mock)
        .mockResolvedValue(mockFeedbackResult);

      (repositoryService.explanations.getExplanationById as jest.Mock)
        .mockResolvedValue(mockExplanation);

      (explanationService.retryAnalysis as jest.Mock)
        .mockRejectedValue(new Error('Retry failed'));

      // Mock console.warn to suppress output during test
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = await feedbackService.addFeedback(1, 'not_helpful', 'The explanation needs improvement.');

      expect(result.success).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to trigger retry analysis:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('validateFeedback', () => {
    it('should pass validation for valid feedback', () => {
      expect(() => {
        feedbackService.validateFeedback(1, 'helpful', 'This is a valid comment with sufficient length to pass validation.');
      }).not.toThrow();
    });

    it('should throw error for missing explanation ID', () => {
      expect(() => {
        feedbackService.validateFeedback(null, 'helpful', 'Valid comment length here.');
      }).toThrow('Missing required field: explanationId');
    });

    it('should throw error for missing vote type', () => {
      expect(() => {
        feedbackService.validateFeedback(1, '', 'Valid comment length here.');
      }).toThrow('Missing required field: voteType');
    });

    it('should throw error for invalid vote type', () => {
      expect(() => {
        feedbackService.validateFeedback(1, 'invalid', 'Valid comment length here.');
      }).toThrow('Invalid vote type. Must be "helpful" or "not_helpful"');
    });

    it('should throw error for short comment', () => {
      expect(() => {
        feedbackService.validateFeedback(1, 'helpful', 'Too short');
      }).toThrow('A meaningful comment of at least 20 characters is required');
    });

    it('should throw error for empty comment', () => {
      expect(() => {
        feedbackService.validateFeedback(1, 'helpful', '');
      }).toThrow('A meaningful comment of at least 20 characters is required');
    });
  });
});
