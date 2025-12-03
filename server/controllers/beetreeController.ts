/**
 * Author: Cascade
 * Date: 2025-12-01
 * PURPOSE: HTTP API controller for Beetree ensemble solver operations.
 * Provides endpoints for running ensemble analysis, checking status, estimating costs,
 * retrieving history, and accessing detailed cost breakdowns.
 * SRP/DRY check: Pass — follows existing controller patterns.
 */

import { Request, Response } from 'express';
import { beetreeService } from '../services/beetreeService';
import { beetreeStreamService } from '../services/streaming/beetreeStreamService';
import { puzzleService } from '../services/puzzleService';
import { explanationService } from '../services/explanationService';
import { broadcast } from '../services/wsService';
import { logger } from '../utils/logger';
import type { BeetreeRunConfig, BeetreeBridgeEvent } from '../../shared/types';

// Generate unique session IDs for Beetree runs
function generateSessionId(): string {
  return `beetree-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Start a new Beetree ensemble analysis
 * POST /api/beetree/run
 */
export async function runBeetreeAnalysis(req: Request, res: Response) {
  const startTime = Date.now();
  let sessionId: string;
  
  try {
    const { taskId, testIndex = 0, mode = 'testing', runTimestamp } = req.body;

    // Validate required parameters
    if (!taskId) {
      return res.status(400).json({
        error: 'Missing required parameter: taskId',
        timestamp: Date.now(),
      });
    }

    if (typeof testIndex !== 'number' || testIndex < 0) {
      return res.status(400).json({
        error: 'Invalid testIndex: must be a non-negative integer',
        timestamp: Date.now(),
      });
    }

    if (!['testing', 'production'].includes(mode)) {
      return res.status(400).json({
        error: 'Invalid mode: must be "testing" or "production"',
        timestamp: Date.now(),
      });
    }

    // Verify puzzle exists
    const puzzle = await puzzleService.getPuzzleById(taskId);
    if (!puzzle) {
      return res.status(404).json({
        error: `Puzzle ${taskId} not found`,
        timestamp: Date.now(),
      });
    }

    // Validate test index
    if (testIndex >= puzzle.test.length) {
      return res.status(400).json({
        error: `Invalid testIndex ${testIndex}: puzzle has ${puzzle.test.length} test cases`,
        timestamp: Date.now(),
      });
    }

    // Generate session ID
    sessionId = generateSessionId();
    const timestamp = runTimestamp || new Date().toISOString();

    // Configure Beetree run
    const beetreeConfig: BeetreeRunConfig = {
      taskId,
      testIndex,
      mode,
      runTimestamp: timestamp,
    };

    // Start streaming analysis
    beetreeStreamService.startStreaming({
      sessionId,
      taskId,
      testIndex,
      mode,
      runTimestamp: timestamp,
    }).catch(error => {
      logger.error(`Failed to start Beetree streaming for session ${sessionId}: ${error}`, 'beetree-controller');
      broadcast(sessionId, {
        type: 'error',
        message: 'Failed to start streaming analysis',
        timestamp: Date.now(),
      });
    });

    // Send initial response with success field for frontend compatibility
    res.status(202).json({
      success: true,
      sessionId,
      taskId,
      testIndex,
      mode,
      runTimestamp: timestamp,
      status: 'started',
      timestamp: Date.now(),
    });

    logger.info(`Beetree analysis started for session ${sessionId}, puzzle ${taskId}, test ${testIndex}`, 'beetree-controller');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error starting Beetree analysis: ${errorMessage}`, 'beetree-controller');
    
    res.status(500).json({
      error: 'Internal server error',
      details: errorMessage,
      timestamp: Date.now(),
    });
  }
}

/**
 * Get the current status of a Beetree analysis
 * GET /api/beetree/status/:sessionId
 */
export async function getBeetreeStatus(req: Request, res: Response) {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({
        error: 'Missing sessionId parameter',
        timestamp: Date.now(),
      });
    }

    const streamState = beetreeStreamService.getStreamState(sessionId);
    
    if (!streamState) {
      return res.status(404).json({
        error: `Session ${sessionId} not found or expired`,
        timestamp: Date.now(),
      });
    }

    const response = {
      sessionId,
      taskId: streamState.taskId,
      testIndex: streamState.testIndex,
      mode: streamState.mode,
      runTimestamp: streamState.runTimestamp,
      status: streamState.isComplete ? 'completed' : 'running',
      startTime: streamState.startTime,
      lastEventTime: streamState.lastEventTime,
      currentStage: streamState.currentStage,
      totalCost: streamState.totalCost,
      consensusStrength: streamState.consensusStrength,
      diversityScore: streamState.diversityScore,
      modelPredictions: streamState.modelPredictions,
      error: streamState.error,
      timestamp: Date.now(),
    };

    res.json(response);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error getting Beetree status: ${errorMessage}`, 'beetree-controller');
    
    res.status(500).json({
      error: 'Internal server error',
      details: errorMessage,
      timestamp: Date.now(),
    });
  }
}

/**
 * Estimate the cost of a Beetree analysis before running
 * POST /api/beetree/estimate
 */
export async function estimateBeetreeCost(req: Request, res: Response) {
  try {
    const { taskId, testIndex = 0, mode = 'testing' } = req.body;

    // Validate required parameters
    if (!taskId) {
      return res.status(400).json({
        error: 'Missing required parameter: taskId',
        timestamp: Date.now(),
      });
    }

    // Verify puzzle exists
    const puzzle = await puzzleService.getPuzzleById(taskId);
    if (!puzzle) {
      return res.status(404).json({
        error: `Puzzle ${taskId} not found`,
        timestamp: Date.now(),
      });
    }

    // Get cost estimation from Beetree service
    const costEstimate = await beetreeService.estimateCost(taskId, testIndex, mode);

    res.json({
      taskId,
      testIndex,
      mode,
      estimatedCost: costEstimate.estimatedTotalCost,
      costBreakdown: costEstimate.costBreakdown,
      estimatedDuration: costEstimate.estimatedDuration,
      recommendedStages: costEstimate.recommendedStages,
      timestamp: Date.now(),
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error estimating Beetree cost: ${errorMessage}`, 'beetree-controller');
    
    res.status(500).json({
      error: 'Internal server error',
      details: errorMessage,
      timestamp: Date.now(),
    });
  }
}

/**
 * Get historical Beetree analyses for a puzzle
 * GET /api/beetree/history/:taskId
 */
export async function getBeetreeHistory(req: Request, res: Response) {
  try {
    const { taskId } = req.params;
    const { limit = 10, offset = 0 } = req.query;

    if (!taskId) {
      return res.status(400).json({
        error: 'Missing taskId parameter',
        timestamp: Date.now(),
      });
    }

    // Verify puzzle exists
    const puzzle = await puzzleService.getPuzzleById(taskId);
    if (!puzzle) {
      return res.status(404).json({
        error: `Puzzle ${taskId} not found`,
        timestamp: Date.now(),
      });
    }

    // Get Beetree explanations from database
    const explanations = await explanationService.getExplanationsForPuzzle(taskId);
    
    // Filter for Beetree explanations only
    const beetreeExplanations = explanations.filter(exp => 
      exp.modelName && exp.modelName.includes('beetree')
    );

    // Apply pagination
    const limitNum = Math.min(Math.max(parseInt(limit as string) || 10, 1), 100);
    const offsetNum = Math.max(parseInt(offset as string) || 0, 0);
    
    const paginatedResults = beetreeExplanations
      .slice(offsetNum, offsetNum + limitNum);

    // Cast to any for beetree-specific fields until types are extended
    const response = {
      taskId,
      total: beetreeExplanations.length,
      limit: limitNum,
      offset: offsetNum,
      explanations: paginatedResults.map((exp: any) => ({
        id: exp.id,
        runTimestamp: exp.beetreeRunTimestamp || exp.createdAt,
        mode: exp.beetreeMode || 'unknown',
        stage: exp.beetreeStage || 'completed',
        consensusCount: exp.beetreeConsensusCount || 0,
        consensusStrength: exp.beetreeConsensusStrength || 0,
        diversityScore: exp.beetreeDiversityScore || 0,
        totalCost: exp.estimatedCost,
        createdAt: exp.createdAt,
        isPredictionCorrect: exp.isPredictionCorrect,
      })),
      timestamp: Date.now(),
    };

    res.json(response);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error getting Beetree history: ${errorMessage}`, 'beetree-controller');
    
    res.status(500).json({
      error: 'Internal server error',
      details: errorMessage,
      timestamp: Date.now(),
    });
  }
}

/**
 * Get detailed cost breakdown for a specific Beetree analysis
 * GET /api/beetree/cost-breakdown/:explanationId
 */
export async function getBeetreeCostBreakdown(req: Request, res: Response) {
  try {
    const { explanationId } = req.params;

    if (!explanationId) {
      return res.status(400).json({
        error: 'Missing explanationId parameter',
        timestamp: Date.now(),
      });
    }

    // Get explanation by ID
    const explanation = await explanationService.getExplanationById(parseInt(explanationId));
    
    if (!explanation) {
      return res.status(404).json({
        error: `Explanation ${explanationId} not found`,
        timestamp: Date.now(),
      });
    }

    // Cast to any for beetree-specific fields
    const exp = explanation as any;
    
    // Verify it's a Beetree explanation
    if (!explanation.modelName?.includes('beetree') || !exp.beetreeCostBreakdown) {
      return res.status(400).json({
        error: `Explanation ${explanationId} is not a Beetree analysis`,
        timestamp: Date.now(),
      });
    }

    const response = {
      explanationId: parseInt(explanationId),
      taskId: explanation.puzzleId,
      runTimestamp: exp.beetreeRunTimestamp || explanation.createdAt,
      mode: exp.beetreeMode || 'unknown',
      stage: exp.beetreeStage || 'completed',
      totalCost: explanation.estimatedCost,
      costBreakdown: exp.beetreeCostBreakdown,
      tokenUsage: exp.beetreeTokenUsage || { input: 0, output: 0, reasoning: 0 },
      consensusStrength: exp.beetreeConsensusStrength || 0,
      diversityScore: exp.beetreeDiversityScore || 0,
      consensusCount: exp.beetreeConsensusCount || 0,
      modelResults: exp.beetreeModelResults || [],
      timestamp: Date.now(),
    };

    res.json(response);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error getting Beetree cost breakdown: ${errorMessage}`, 'beetree-controller');
    
    res.status(500).json({
      error: 'Internal server error',
      details: errorMessage,
      timestamp: Date.now(),
    });
  }
}

/**
 * Cancel an active Beetree analysis
 * POST /api/beetree/cancel/:sessionId
 */
export async function cancelBeetreeAnalysis(req: Request, res: Response) {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({
        error: 'Missing sessionId parameter',
        timestamp: Date.now(),
      });
    }

    // Check if session exists and is running
    const streamState = beetreeStreamService.getStreamState(sessionId);
    
    if (!streamState) {
      return res.status(404).json({
        error: `Session ${sessionId} not found or already completed`,
        timestamp: Date.now(),
      });
    }

    if (streamState.isComplete) {
      return res.status(400).json({
        error: `Session ${sessionId} is already completed`,
        timestamp: Date.now(),
      });
    }

    // Cancel the stream
    await beetreeStreamService.cancelStream(sessionId);

    res.json({
      sessionId,
      status: 'cancelled',
      timestamp: Date.now(),
    });

    logger.info(`Beetree analysis cancelled for session ${sessionId}`, 'beetree-controller');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error cancelling Beetree analysis: ${errorMessage}`, 'beetree-controller');
    
    res.status(500).json({
      error: 'Internal server error',
      details: errorMessage,
      timestamp: Date.now(),
    });
  }
}


export const beetreeController = {
  runBeetreeAnalysis,
  getBeetreeStatus,
  estimateBeetreeCost,
  getBeetreeHistory,
  getBeetreeCostBreakdown,
  cancelBeetreeAnalysis
};
