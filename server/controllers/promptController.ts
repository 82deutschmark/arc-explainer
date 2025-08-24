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
import { puzzleService } from '../services/puzzleService';
import { buildAnalysisPrompt } from '../services/promptBuilder';

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
   * Generate a prompt preview for a specific task and template
   * 
   * @param req - Express request object
   * @param res - Express response object
   */
  async preview(req: Request, res: Response) {
    const { taskId, promptId, customPrompt, emojiSetKey, omitAnswer } = req.body;
    
    console.log(`[PromptController] Generating prompt preview for task ${taskId} with template ${promptId}`);
    
    try {
      // Get the task data
      const task = await puzzleService.getPuzzleById(taskId);
      if (!task) {
        return res.status(404).json(formatResponse.error('Task not found', 'TASK_NOT_FOUND'));
      }

      // Build the prompt package
      const promptPackage = buildAnalysisPrompt(task, promptId, customPrompt, {
        emojiSetKey,
        omitAnswer: omitAnswer ?? true,
        systemPromptMode: 'ARC', // Use the new architecture
        useStructuredOutput: true
      });

      console.log(`[PromptController] Generated prompt preview - System: ${promptPackage.systemPrompt.length} chars, User: ${promptPackage.userPrompt.length} chars`);

      res.json(formatResponse.success({
        systemPrompt: promptPackage.systemPrompt,
        userPrompt: promptPackage.userPrompt,
        selectedTemplate: promptPackage.selectedTemplate,
        isAlienMode: promptPackage.isAlienMode,
        isSolver: promptPackage.isSolver
      }));
    } catch (error) {
      console.error('[PromptController] Error generating prompt preview:', error);
      res.status(500).json(formatResponse.error('Failed to generate prompt preview', 'PREVIEW_ERROR'));
    }
  }
};
