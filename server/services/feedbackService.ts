/**
 * feedbackService.ts
 * 
 * Service layer for feedback-related operations.
 * This service handles submitting and retrieving feedback for explanations.
 * 
 * @author Cascade
 */

import { repositoryService } from '../repositories/RepositoryService';
import { AppError } from '../middleware/errorHandler';
import { explanationService } from './explanationService';

export const feedbackService = {
  /**
   * Add feedback for an explanation
   * 
   * @param explanationId - The ID of the explanation receiving feedback
   * @param voteType - Type of vote ('helpful' or 'not_helpful')
   * @param comment - User's comment about the explanation
   * @returns Object with feedback ID and success message
   * @throws AppError if feedback cannot be added
   */
  async addFeedback(explanationId: number | string, feedbackType: 'helpful' | 'not_helpful' | 'solution_explanation', comment: string, puzzleId?: string) {
    const numericExplanationId = typeof explanationId === 'string' ? parseInt(explanationId, 10) : explanationId;

    try {
      let finalPuzzleId = puzzleId;
      if (!finalPuzzleId) {
        const explanation = await repositoryService.explanations.getExplanationById(numericExplanationId);
        if (!explanation) {
          throw new AppError('Explanation not found', 404, 'NOT_FOUND');
        }
        finalPuzzleId = explanation.puzzleId;
      }

      const feedbackResult = await repositoryService.feedback.addFeedback({
        puzzleId: finalPuzzleId,
        explanationId: numericExplanationId,
        feedbackType: feedbackType,
        comment,
      });

      const feedbackId = feedbackResult.feedback?.id;

      if (feedbackType === 'not_helpful') {
        try {
          const originalExplanation = await repositoryService.explanations.getExplanationById(numericExplanationId);
          if (originalExplanation) {
            await explanationService.retryAnalysis(
              originalExplanation.puzzleId,
              originalExplanation.modelName || 'gpt-4',
              comment
            );
          }
        } catch (retryError) {
          console.warn('Failed to trigger retry analysis:', retryError);
        }
      }

      return {
        success: true,
        message: feedbackType === 'not_helpful'
          ? 'Feedback recorded. Generating improved explanation...'
          : 'Feedback recorded successfully',
        feedbackId,
      };
    } catch (error) {
      throw new AppError(
        `Failed to add feedback: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'DATABASE_ERROR'
      );
    }
  },
  
  /**
   * Validate feedback data before submitting
   * 
   * @param explanationId - The ID of the explanation
   * @param voteType - Type of vote
   * @param comment - User's comment
   * @throws AppError if validation fails
   */
  validateFeedback(data: { puzzleId?: string, explanationId?: any, feedbackType: string, comment?: string }) {
    const { puzzleId, explanationId, feedbackType, comment } = data;
    const MINIMUM_COMMENT_LENGTH = 20;

    if (!puzzleId && !explanationId) {
      throw new AppError('Either puzzleId or explanationId is required', 400, 'VALIDATION_ERROR');
    }

    if (!feedbackType) {
      throw new AppError('Missing required field: feedbackType', 400, 'VALIDATION_ERROR');
    }

    const validFeedbackTypes = ['helpful', 'not_helpful', 'solution_explanation'];
    if (!validFeedbackTypes.includes(feedbackType)) {
      throw new AppError(`Invalid feedback type. Must be one of: ${validFeedbackTypes.join(', ')}`, 400, 'VALIDATION_ERROR');
    }

    if (feedbackType === 'not_helpful' && (!comment || comment.trim().length < MINIMUM_COMMENT_LENGTH)) {
      throw new AppError(
        `A meaningful comment of at least ${MINIMUM_COMMENT_LENGTH} characters is required for 'not_helpful' feedback`,
        400,
        'VALIDATION_ERROR'
      );
    }
  }
};
