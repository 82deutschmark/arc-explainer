/**
 * promptController.ts
 * 
 * Controller for prompt template-related routes.
 * Handles HTTP requests and responses for prompt template operations.
 * Provides access to the available prompt templates for the prompt picker system.
 * 
 * @author Cascade
 */

import { Request, Response } from 'express';
import { PROMPT_TEMPLATES } from '../../shared/types';
import { formatResponse } from '../utils/responseFormatter';
import { getEmojiSetsForAPI } from '../services/promptBuilder';

export const promptController = {
  /**
   * Get all available prompt templates
   * 
   * @param req - Express request object
   * @param res - Express response object
   */
  async getAll(req: Request, res: Response) {
    console.log('[PromptController] Fetching all available prompt templates');
    
    // Convert the PROMPT_TEMPLATES record to an array for easier frontend consumption
    const promptList = Object.values(PROMPT_TEMPLATES);
    
    console.log(`[PromptController] Found ${promptList.length} prompt templates`);
    
    res.json(formatResponse.success(promptList));
  },

  /**
   * Get all available emoji sets with metadata
   * 
   * @param req - Express request object
   * @param res - Express response object
   */
  async getEmojiSets(req: Request, res: Response) {
    console.log('[PromptController] Fetching all available emoji sets');
    
    const emojiSets = getEmojiSetsForAPI();
    const setCount = Object.keys(emojiSets).length;
    
    console.log(`[PromptController] Found ${setCount} emoji sets`);
    
    res.json(formatResponse.success(emojiSets));
  }
};
