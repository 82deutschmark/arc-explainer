/**
 * feedbackService.ts
 * 
 * Service layer for feedback-related operations.
 * This service handles submitting and retrieving feedback for explanations.
 * 
 * @author Cascade
 */

import { dbService } from './dbService';
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
  async addFeedback(explanationId: number | string, voteType: string, comment: string) {
    // Convert explanationId to number if it's a string
    const numericExplanationId = typeof explanationId === 'string' ? 
      parseInt(explanationId) : explanationId;
    
    try {
      // First, record the feedback
      const feedbackId = await dbService.addFeedback(
        numericExplanationId,
        voteType as 'helpful' | 'not_helpful',
        comment
      );
      
      // If feedback is "not helpful", trigger retry analysis
      if (voteType === 'not_helpful') {
        try {
          // Get the original explanation to extract puzzle details
          const originalExplanation = await dbService.getExplanationById(numericExplanationId);
          if (originalExplanation) {
            // Trigger retry analysis with user feedback as guidance
            await explanationService.retryAnalysis(
              originalExplanation.puzzleId,
              originalExplanation.modelName,
              comment // User feedback as guidance for improvement
            );
          }
        } catch (retryError) {
          // Log retry failure but don't fail the feedback submission
          console.warn('Failed to trigger retry analysis:', retryError);
        }
      }
      
      return {
        success: true,
        message: voteType === 'not_helpful' 
          ? 'Feedback recorded. Generating improved explanation...' 
          : 'Feedback recorded successfully',
        feedbackId
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
  validateFeedback(explanationId: any, voteType: string, comment: string) {
    const MINIMUM_COMMENT_LENGTH = 20;
    
    if (!explanationId) {
      throw new AppError('Missing required field: explanationId', 400, 'VALIDATION_ERROR');
    }
    
    if (!voteType) {
      throw new AppError('Missing required field: voteType', 400, 'VALIDATION_ERROR');
    }
    
    if (voteType !== 'helpful' && voteType !== 'not_helpful') {
      throw new AppError('Invalid vote type. Must be "helpful" or "not_helpful"', 400, 'VALIDATION_ERROR');
    }
    
    if (!comment || comment.trim().length < MINIMUM_COMMENT_LENGTH) {
      throw new AppError(
        `A meaningful comment of at least ${MINIMUM_COMMENT_LENGTH} characters is required`,
        400,
        'VALIDATION_ERROR'
      );
    }
  }
};
