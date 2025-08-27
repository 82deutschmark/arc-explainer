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
import { dbService } from "./services/dbService";
import { logger } from "./utils/logger.js";

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize services
  await aiServiceFactory.initialize();
  const dbInitialized = await dbService.init();
  console.log(`Database ${dbInitialized ? 'initialized successfully' : 'not available - running in memory mode'}`);

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
  
  // Solver mode accuracy statistics
  app.get("/api/puzzle/accuracy-stats", asyncHandler(puzzleController.getAccuracyStats));
  
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
  
  // Database health check endpoint for debugging
  app.get("/api/health/database", asyncHandler(async (req, res) => {
    try {
      const isConnected = dbService.isConnected();
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
        const testResult = await dbService.hasExplanation('health-check-test');
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
