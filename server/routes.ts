/**
 * routes.ts
 * 
 * Main routes configuration file for the API.
 * Registers all application routes and middleware.
 * Includes a catch-all route to handle client-side routing.
 * 
 * @author Cascade
 */

import type { Express } from "express";
import { createServer, type Server } from "http";
import path from "path";
import fs from "fs";

// Import controllers
import { puzzleController } from "./controllers/puzzleController";
import { explanationController } from "./controllers/explanationController";
import { feedbackController } from "./controllers/feedbackController";
import { promptController } from "./controllers/promptController";
import { saturnController } from "./controllers/saturnController";
import { batchAnalysisController } from "./controllers/batchAnalysisController";

// Import route modules
import modelsRouter from "./routes/models.js";

// Import middleware
import { errorHandler } from "./middleware/errorHandler";
import { asyncHandler } from "./middleware/asyncHandler";
import { validation } from "./middleware/validation";

// Import services
import { aiServiceFactory } from "./services/aiServiceFactory";
import { repositoryService } from './repositories/RepositoryService.ts';
import { logger } from "./utils/logger.ts";
import { formatResponse } from "./utils/responseFormatter.ts";

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize services
  await aiServiceFactory.initialize();
  
  // Database initialization is handled in index.ts - routes should not re-initialize;

  // Routes with consistent naming and error handling
  
  // Models API routes
  app.use("/api/models", modelsRouter);
  
  // Puzzle routes
  app.get("/api/puzzle/list", asyncHandler(puzzleController.list));
  app.get("/api/puzzle/overview", asyncHandler(puzzleController.overview));
  app.get("/api/puzzle/task/:taskId", asyncHandler(puzzleController.getById));
  app.post("/api/puzzle/analyze/:taskId/:model", validation.puzzleAnalysis, asyncHandler(puzzleController.analyze));
  app.get("/api/puzzle/:puzzleId/has-explanation", asyncHandler(puzzleController.hasExplanation));
  
  // Debug route to force puzzle loader reinitialization
  app.post("/api/puzzle/reinitialize", asyncHandler(puzzleController.reinitialize));
  
  // MIXED ACCURACY/TRUSTWORTHINESS STATISTICS - ⚠️ MISLEADING ENDPOINTS!
  app.get("/api/puzzle/accuracy-stats", asyncHandler(puzzleController.getAccuracyStats));
  // WARNING: Despite name, returns mixed data. accuracyByModel contains trustworthiness-filtered results!
  // Models without trustworthiness scores are excluded from "accuracy" rankings.
  
  app.get("/api/puzzle/general-stats", asyncHandler(puzzleController.getGeneralModelStats));
  // WARNING: Returns mixed data combining all explanations + solver attempts + trustworthiness metrics
  // Different arrays have different inclusion criteria - very confusing!
  
  // RAW DATABASE STATISTICS - Infrastructure metrics only
  app.get("/api/puzzle/raw-stats", asyncHandler(puzzleController.getRawStats));
  // NOTE: avgPredictionAccuracy field contains trustworthiness data, not pure accuracy!
  
  // TRUSTWORTHINESS STATISTICS - AI confidence reliability analysis  
  app.get("/api/puzzle/performance-stats", asyncHandler(puzzleController.getRealPerformanceStats));
  // CORRECT: Returns trustworthiness-focused analysis (confidence reliability metrics)

  // CONFIDENCE ANALYSIS STATISTICS - AI confidence patterns
  app.get("/api/puzzle/confidence-stats", asyncHandler(puzzleController.getConfidenceStats));
  
  // DISCUSSION PAGE - worst-performing puzzles for retry analysis
  app.get("/api/puzzle/worst-performing", asyncHandler(puzzleController.getWorstPerformingPuzzles));
  
  // COMPREHENSIVE DASHBOARD - combined accuracy, trustworthiness, and feedback metrics
  app.get("/api/metrics/comprehensive-dashboard", asyncHandler(puzzleController.getComprehensiveDashboard));
  
  // Prompt preview route - shows exact prompt that will be sent to specific provider
  app.post("/api/prompt/preview/:provider/:taskId", validation.promptPreview, asyncHandler(puzzleController.previewPrompt));
  
  // Prompt template routes
  app.get("/api/prompts", asyncHandler(promptController.getAll));
  app.post("/api/prompt-preview", validation.required(['provider', 'taskId']), asyncHandler(promptController.preview));
  
  // Explanation routes
  app.get("/api/puzzle/:puzzleId/explanations", asyncHandler(explanationController.getAll));
  app.get("/api/puzzle/:puzzleId/explanation", asyncHandler(explanationController.getOne));
  app.post("/api/puzzle/save-explained/:puzzleId", validation.explanationCreate, asyncHandler(explanationController.create));
  
  // Feedback routes
  app.post("/api/feedback", validation.feedback, asyncHandler(feedbackController.create));
  app.get("/api/explanation/:explanationId/feedback", asyncHandler(feedbackController.getByExplanation));
  app.get("/api/puzzle/:puzzleId/feedback", asyncHandler(feedbackController.getByPuzzle));
  app.get("/api/feedback", asyncHandler(feedbackController.getAll));
  app.get("/api/feedback/stats", asyncHandler(feedbackController.getStats));
  app.get("/api/feedback/accuracy-stats", asyncHandler(feedbackController.getAccuracyStats));
  
  // Solution submission and voting routes (from Gemini plan)
  app.get("/api/puzzles/:puzzleId/solutions", asyncHandler(feedbackController.getSolutions));
  app.post("/api/puzzles/:puzzleId/solutions", validation.solutionSubmission, asyncHandler(feedbackController.submitSolution));
  app.post("/api/solutions/:solutionId/vote", validation.solutionVote, asyncHandler(feedbackController.voteSolution));
  app.get("/api/solutions/:solutionId/votes", asyncHandler(feedbackController.getSolutionVotes));

  // Saturn analysis routes
  app.post("/api/saturn/analyze/:taskId", validation.saturnAnalysis, asyncHandler(saturnController.analyze));
  app.post("/api/saturn/analyze-with-reasoning/:taskId", validation.saturnAnalysis, asyncHandler(saturnController.analyzeWithReasoning));
  app.get("/api/saturn/status/:sessionId", asyncHandler(saturnController.getStatus));
  
  // Batch analysis routes
  app.post("/api/model/batch-analyze", validation.batchAnalysis, asyncHandler(batchAnalysisController.startBatch));
  app.get("/api/model/batch-status/:sessionId", asyncHandler(batchAnalysisController.getBatchStatus));
  app.post("/api/model/batch-control/:sessionId", validation.batchControl, asyncHandler(batchAnalysisController.controlBatch));
  app.get("/api/model/batch-results/:sessionId", asyncHandler(batchAnalysisController.getBatchResults));
  app.get("/api/model/batch-sessions", asyncHandler(batchAnalysisController.getAllSessions));
  
  // Recovery routes for multiple predictions data
  app.get("/api/admin/recovery-stats", asyncHandler(async (req: any, res: any) => {
    try {
      const stats = await repositoryService.explanations.getMultiplePredictionsStats();
      res.json(formatResponse.success(stats));
    } catch (error) {
      res.status(500).json(formatResponse.error('STATS_FAILED', 'Failed to get recovery stats'));
    }
  }));
  
  app.post("/api/admin/recover-multiple-predictions", asyncHandler(async (req: any, res: any) => {
    try {
      const entries = await repositoryService.explanations.findMissingMultiplePredictions();
      
      let recoveredCount = 0;
      let processedCount = 0;
      const results: any[] = [];
      
      for (const entry of entries) {
        processedCount++;
        const { id, puzzleId, modelName, providerRawResponse } = entry;
        
        let parsedResponse;
        try {
          parsedResponse = typeof providerRawResponse === 'string' 
            ? JSON.parse(providerRawResponse) 
            : providerRawResponse;
        } catch (e) {
          results.push({ id, puzzleId, modelName, status: 'parse_failed' });
          continue;
        }
        
        const collectedGrids = [];
        
        // Look for predictedOutput1, predictedOutput2, predictedOutput3
        let i = 1;
        while (parsedResponse[`predictedOutput${i}`]) {
          const grid = parsedResponse[`predictedOutput${i}`];
          if (Array.isArray(grid) && grid.length > 0 && Array.isArray(grid[0])) {
            collectedGrids.push(grid);
          }
          i++;
        }
        
        if (collectedGrids.length > 0) {
          await repositoryService.explanations.updateMultiplePredictions(id, collectedGrids);
          recoveredCount++;
          results.push({ id, puzzleId, modelName, status: 'recovered', gridsCount: collectedGrids.length });
        } else {
          results.push({ id, puzzleId, modelName, status: 'no_multiple_predictions' });
        }
      }
      
      res.json(formatResponse.success({
        processed: processedCount,
        recovered: recoveredCount,
        results: results.slice(0, 20)
      }, `Recovery complete: ${recoveredCount} entries recovered from ${processedCount} processed`));
      
    } catch (error) {
      res.status(500).json(formatResponse.error('RECOVERY_FAILED', 'Failed to recover multiple predictions data'));
    }
  }));
  
  // Database health check endpoint for debugging
  app.get("/api/health/database", asyncHandler(async (req: any, res: any) => {
    try {
      const isConnected = repositoryService.isConnected();
      const hasUrl = !!process.env.DATABASE_URL;
      
      if (!hasUrl) {
        return res.status(503).json({
          status: 'error',
          message: 'DATABASE_URL environment variable not set',
          connected: false,
          hasUrl: false
        });
      }
      
      if (!isConnected) {
        return res.status(503).json({
          status: 'error', 
          message: 'Database connection pool not initialized',
          connected: false,
          hasUrl: true
        });
      }
      
      // Test actual database query
      try {
        const testResult = await repositoryService.explanations.getExplanationForPuzzle('health-check-test');
        res.json({
          status: 'ok',
          message: 'Database connection healthy',
          connected: true,
          hasUrl: true,
          queryTest: 'passed'
        });
      } catch (queryError) {
        res.status(503).json({
          status: 'error',
          message: 'Database query failed',
          connected: true,
          hasUrl: true,
          queryTest: 'failed',
          error: queryError instanceof Error ? queryError.message : String(queryError)
        });
      }
    } catch (error) {
      logger.error('Health check failed: ' + (error instanceof Error ? error.message : String(error)), 'health-check');
      res.status(500).json({
        status: 'error',
        message: 'Health check failed',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }));

  // Validation endpoint - return 501 Not Implemented (keeping for backward compatibility)
  app.post("/api/puzzle/validate", (req, res) => {
    return res.status(501).json({ 
      success: false,
      message: 'Solution validation is not available in this version. Please update your client.'
    });
  });

  // Error handling middleware
  app.use(errorHandler);
  
  // NOTE: The catch-all route for serving the SPA is in server/index.ts
  // It's important that it comes AFTER the API routes and static file middleware

  return createServer(app);
}
