/**
 * promptController.ts
 *
 * Author: Cascade
 * Date: 2025-11-19
 * PURPOSE: Controller for prompt template operations and previews.
 *          Supports continuation mode for Responses API conversation chaining.
 * SRP/DRY check: Pass - Single responsibility: HTTP handling for prompt operations
 */

import { Request, Response } from 'express';
import { PROMPT_TEMPLATES } from '../../shared/types';
import { formatResponse } from '../utils/responseFormatter';
import { puzzleService } from '../services/puzzleService';
import { buildAnalysisPrompt } from '../services/promptBuilder';
import type { PromptOptions } from '../services/promptBuilder';
import type { ServiceOptions } from '../services/base/BaseAIService';

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
    const {
      taskId,
      promptId,
      customPrompt,
      emojiSetKey,
      omitAnswer,
      topP,
      candidateCount,
      originalExplanation,
      customChallenge,
      sendAsEmojis,
      previousResponseId // For conversation chaining in discussion/debate mode
    } = req.body;

    const isContinuation = Boolean(previousResponseId);
    console.log(`[PromptController] Generating prompt preview for task ${taskId} with template ${promptId}${isContinuation ? ' (CONTINUATION MODE)' : ''}`);
    if (isContinuation) {
      console.log(`[PromptController] Previous response ID: ${previousResponseId.substring(0, 24)}...`);
    }

    try {
      // Get the task data
      const task = await puzzleService.getPuzzleById(taskId);
      if (!task) {
        return res.status(404).json(formatResponse.error('Task not found', 'TASK_NOT_FOUND'));
      }

      // Build the prompt package
      const promptOptions: PromptOptions = {
        emojiSetKey: sendAsEmojis ? emojiSetKey : undefined,
        omitAnswer: omitAnswer ?? true,
        systemPromptMode: 'ARC', // Use the new architecture
        useStructuredOutput: true,
        topP,
        candidateCount,
        originalExplanation, // For debate mode
        customChallenge // For debate/discussion mode
      };

      // Service options for continuation mode
      const serviceOpts: ServiceOptions = {
        previousResponseId, // Enables continuation prompt building
        suppressInstructionsOnContinuation: isContinuation // Skip full instructions on continuation
      };

      const promptPackage = buildAnalysisPrompt(task, promptId, customPrompt, promptOptions, serviceOpts);

      console.log(`[PromptController] Generated prompt preview - System: ${promptPackage.systemPrompt.length} chars, User: ${promptPackage.userPrompt.length} chars`);
      if (isContinuation) {
        console.log(`[PromptController] ✅ Continuation prompt successfully built with minimal system instructions`);
      }

      res.json(formatResponse.success({
        systemPrompt: promptPackage.systemPrompt,
        userPrompt: promptPackage.userPrompt,
        selectedTemplate: promptPackage.selectedTemplate,
        isAlienMode: promptPackage.isAlienMode,
        isSolver: promptPackage.isSolver,
        emojiSetKey: sendAsEmojis ? promptOptions.emojiSetKey : undefined
      }));
    } catch (error) {
      console.error('[PromptController] Error generating prompt preview:', error);
      res.status(500).json(formatResponse.error('Failed to generate prompt preview', 'PREVIEW_ERROR'));
    }
  }
};
