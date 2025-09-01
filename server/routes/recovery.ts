/**
 * Recovery Routes for Multiple Predictions Data
 * 
 * Provides endpoints to recover missing multiple predictions data
 * from entries that had the bug in explanationService.
 * 
 * @author Claude Sonnet 4  
 * @date 2025-08-29
 */

import { Request, Response } from 'express';
import { ExplanationRepository } from '../repositories/ExplanationRepository.js';
const explanationRepository = new ExplanationRepository();
import { formatResponse } from '../utils/responseFormatter.js';

export const recoveryRoutes = {
  /**
   * Analyze and recover multiple predictions data
   * 
   * @param req - Express request object
   * @param res - Express response object
   */
  async recoverMultiplePredictions(req: Request, res: Response) {
    try {
      // Find entries with null hasMultiplePredictions but have provider_raw_response data
      const entries = await explanationRepository.findMissingMultiplePredictions();
      
      let recoveredCount = 0;
      let processedCount = 0;
      const results: any[] = [];
      
      for (const entry of entries) {
        processedCount++;
        const { id, puzzleId, modelName, providerRawResponse } = entry;
        
        // Parse raw response to look for multiple predictions
        let parsedResponse;
        try {
          if (typeof providerRawResponse === 'string') {
            parsedResponse = JSON.parse(providerRawResponse);
          } else {
            parsedResponse = providerRawResponse;
          }
        } catch (e) {
          results.push({ 
            id, 
            puzzleId, 
            modelName, 
            status: 'parse_failed', 
            error: e instanceof Error ? e.message : String(e) 
          });
          continue;
        }
        
        // Check if it has multiple predictions data
        const collectedGrids = [];
        let hasMultiplePredictions = false;
        
        // Look for predictedOutput1, predictedOutput2, predictedOutput3
        let i = 1;
        while (parsedResponse[`predictedOutput${i}`]) {
          const grid = parsedResponse[`predictedOutput${i}`];
          if (Array.isArray(grid) && grid.length > 0 && Array.isArray(grid[0])) {
            collectedGrids.push(grid);
            hasMultiplePredictions = true;
          }
          i++;
        }
        
        // Also check multiplePredictedOutputs array format
        if (Array.isArray(parsedResponse.multiplePredictedOutputs)) {
          for (const item of parsedResponse.multiplePredictedOutputs) {
            if (Array.isArray(item) && item.length > 0) {
              collectedGrids.push(item);
              hasMultiplePredictions = true;
            }
          }
        }
        
        if (hasMultiplePredictions && collectedGrids.length > 0) {
          // Update the database entry
          await explanationRepository.updateMultiplePredictions(id, collectedGrids);
          recoveredCount++;
          
          results.push({
            id,
            puzzleId,
            modelName,
            status: 'recovered',
            gridsCount: collectedGrids.length
          });
        } else {
          results.push({
            id,
            puzzleId,
            modelName,
            status: 'no_multiple_predictions'
          });
        }
      }
      
      res.json(formatResponse.success({
        processed: processedCount,
        recovered: recoveredCount,
        results: results.slice(0, 20) // Limit response size
      }, `Recovery complete: ${recoveredCount} entries recovered from ${processedCount} processed`));
      
    } catch (error) {
      console.error('Recovery error:', error);
      res.status(500).json(formatResponse.error(
        'RECOVERY_FAILED',
        'Failed to recover multiple predictions data',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      ));
    }
  },

  /**
   * Get recovery status/stats
   */
  async getRecoveryStatus(req: Request, res: Response) {
    try {
      const stats = await explanationRepository.getMultiplePredictionsStats();
      res.json(formatResponse.success(stats));
    } catch (error) {
      console.error('Recovery status error:', error);
      res.status(500).json(formatResponse.error(
        'STATS_FAILED',
        'Failed to get recovery stats'
      ));
    }
  }
};