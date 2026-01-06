/**
 * Author: Sonnet 4
 * Date: 2026-01-05
 * PURPOSE: Controller for OG (Open Graph) image generation endpoint.
 *          Handles GET /api/og-image/:taskId requests for social media link unfurling.
 * SRP/DRY check: Pass - Single responsibility: HTTP request handling for OG images.
 */

import { Request, Response } from 'express';
import { generateOgImageForTask, getOgImageCacheStats, clearOgImageCache } from '../services/ogImageService.js';
import { puzzleLoader } from '../services/puzzleLoader.js';
import { logger } from '../utils/logger.js';
import { formatResponse } from '../utils/responseFormatter.js';

// Task ID format: 8 hex characters (standard ARC puzzle ID format)
const TASK_ID_REGEX = /^[a-f0-9]{8}$/i;

/**
 * GET /api/og-image/:taskId
 * Generate and return an OG image for the specified puzzle
 */
export async function getOgImage(req: Request, res: Response): Promise<void> {
  const { taskId } = req.params;

  // Validate taskId format
  if (!taskId || !TASK_ID_REGEX.test(taskId)) {
    res.status(400).json(formatResponse.error('INVALID_TASK_ID', 'Invalid task ID format. Expected 8 hex characters.'));
    return;
  }

  const normalizedTaskId = taskId.toLowerCase();

  try {
    // Load the task data
    const task = await puzzleLoader.loadPuzzle(normalizedTaskId);

    if (!task) {
      res.status(404).json(formatResponse.error('TASK_NOT_FOUND', `Task ${normalizedTaskId} not found`));
      return;
    }

    // Ensure we have training examples to show
    if (!task.train || task.train.length === 0) {
      res.status(400).json(formatResponse.error('NO_TRAINING_DATA', 'Task has no training examples to display'));
      return;
    }

    // Generate the OG image
    const imageBuffer = await generateOgImageForTask(task, normalizedTaskId);

    // Set response headers for image delivery
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', imageBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Send the image
    res.send(imageBuffer);

    logger.debug(`Served OG image for ${normalizedTaskId}`, 'ogImageController');
  } catch (error) {
    logger.error(`Failed to generate OG image for ${normalizedTaskId}: ${error instanceof Error ? error.message : String(error)}`, 'ogImageController');
    res.status(500).json(formatResponse.error('IMAGE_GENERATION_FAILED', 'Failed to generate preview image'));
  }
}

/**
 * GET /api/og-image/stats
 * Return cache statistics (for admin/debugging)
 */
export async function getOgImageStats(req: Request, res: Response): Promise<void> {
  const stats = getOgImageCacheStats();
  res.json(formatResponse.success(stats));
}

/**
 * POST /api/og-image/clear-cache
 * Clear the OG image cache (for admin)
 */
export async function clearCache(req: Request, res: Response): Promise<void> {
  clearOgImageCache();
  res.json(formatResponse.success({ message: 'OG image cache cleared' }));
}

export const ogImageController = {
  getOgImage,
  getOgImageStats,
  clearCache,
};
