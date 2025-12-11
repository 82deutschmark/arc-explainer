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
import { groverController } from "./controllers/groverController.js";
import { poetiqController } from "./controllers/poetiqController.js";
import { beetreeController } from "./controllers/beetreeController.ts";
import adminController, * as adminControllerFns from './controllers/adminController.js';
import * as modelManagementController from './controllers/modelManagementController.js';
import * as discussionController from './controllers/discussionController.js';
import { batchController } from './controllers/batchController.ts';
import { streamController } from "./controllers/streamController.ts";
import { wormArenaStreamController } from "./controllers/wormArenaStreamController.ts";

import { eloController } from "./controllers/eloController";
import modelDatasetController from "./controllers/modelDatasetController.ts";
import { snakeBenchController } from "./controllers/snakeBenchController.ts";

// Import route modules
import modelsRouter from "./routes/models.js";
import metricsRouter from './routes/metricsRoutes.ts';
import arc3Router from "./routes/arc3";
import { contributorController } from './controllers/contributorController.ts';

// Import middleware
import { errorHandler } from "./middleware/errorHandler";
import { asyncHandler } from "./middleware/asyncHandler";
import { validation } from "./middleware/validation";
// NOTE: Authentication middleware is NOT USED - all endpoints are public
// import { apiKeyAuth, optionalApiKeyAuth } from "./middleware/apiKeyAuth.js";

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

  // ARC3 playground routes
  app.use("/api/arc3", arc3Router);

  // Contributor trading cards routes
  app.use("/api/contributors", contributorController);
  
  // Model Management GUI API routes
  app.get("/api/model-management/list", asyncHandler(modelManagementController.listModels));
  app.get("/api/model-management/stats", asyncHandler(modelManagementController.getModelStats));
  app.get("/api/model-management/search", asyncHandler(modelManagementController.searchModels));
  app.post("/api/model-management/validate", asyncHandler(modelManagementController.validateModel));
  app.post("/api/model-management/toggle-active", asyncHandler(modelManagementController.toggleActive));
  app.post("/api/model-management/create-alias", asyncHandler(modelManagementController.createAlias));
  app.post("/api/model-management/add", asyncHandler(modelManagementController.addModel));
  app.put("/api/model-management/notes", asyncHandler(modelManagementController.updateNotes));
  app.delete("/api/model-management/delete", asyncHandler(modelManagementController.deleteModel));
  app.get("/api/model-management/openrouter-models", asyncHandler(modelManagementController.fetchOpenRouterModels));
  
  // Puzzle routes
  app.get("/api/puzzle/list", asyncHandler(puzzleController.list));
  app.get("/api/puzzle/overview", asyncHandler(puzzleController.overview));
  app.get("/api/puzzle/task/:taskId", asyncHandler(puzzleController.getById));
  app.post("/api/puzzle/bulk-status", asyncHandler(puzzleController.bulkStatus));
  app.post("/api/puzzle/analyze/:taskId/:model", validation.puzzleAnalysis, asyncHandler(puzzleController.analyze));
  app.post("/api/puzzle/analyze-list", asyncHandler(puzzleController.analyzeList));
  app.get("/api/puzzle/:puzzleId/has-explanation", asyncHandler(puzzleController.hasExplanation));
  app.post("/api/stream/analyze", asyncHandler(streamController.prepareAnalysisStream));
  app.get(
    "/api/stream/analyze/:taskId/:modelKey/:sessionId",
    asyncHandler(streamController.startAnalysisStream),
  );
  app.delete("/api/stream/analyze/:sessionId", asyncHandler(streamController.cancel));
  app.post("/api/stream/cancel/:sessionId", asyncHandler(streamController.cancel));
  
  // Debug route to force puzzle loader reinitialization
  app.post("/api/puzzle/reinitialize", asyncHandler(puzzleController.reinitialize));
  
  // MIXED ACCURACY/TRUSTWORTHINESS STATISTICS - G��n+� MISLEADING ENDPOINTS!
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

  // Enhanced trustworthiness statistics with minimum attempts filtering
  app.get("/api/puzzle/performance-stats-filtered", asyncHandler(puzzleController.getRealPerformanceStatsFiltered));
  app.get("/api/puzzle/trustworthiness-stats-filtered", asyncHandler(puzzleController.getTrustworthinessStatsFiltered));

  // CONFIDENCE ANALYSIS STATISTICS - AI confidence patterns
  app.get("/api/puzzle/confidence-stats", asyncHandler(puzzleController.getConfidenceStats));
  
  // DISCUSSION PAGE - worst-performing puzzles for retry analysis
  app.get("/api/puzzle/worst-performing", asyncHandler(puzzleController.getWorstPerformingPuzzles));
  app.get("/api/puzzles/stats", asyncHandler(puzzleController.getPuzzleStats));
  
  // Discussion routes - conversation chaining eligible explanations
  app.get("/api/discussion/eligible", asyncHandler(discussionController.getEligibleExplanations));
  
  // Metrics routes (reliability, comprehensive dashboard, etc.)
  app.use("/api/metrics", metricsRouter);

  // Model Dataset Performance routes - REAL database queries showing which ARC puzzles each model solved/failed/skipped
  app.get("/api/model-dataset/performance/:modelName/:datasetName", asyncHandler(modelDatasetController.getModelPerformance));
  app.get("/api/model-dataset/models", asyncHandler(modelDatasetController.getAvailableModels));
  app.get("/api/model-dataset/datasets", asyncHandler(modelDatasetController.getAvailableDatasets));
  app.get("/api/model-dataset/metrics/:modelName/:datasetName", asyncHandler(modelDatasetController.getModelDatasetMetrics));


  // Prompt preview route - shows exact prompt that will be sent to specific provider
  app.post("/api/prompt/preview/:provider/:taskId", validation.promptPreview, asyncHandler(puzzleController.previewPrompt));
  
  // Prompt template routes
  app.get("/api/prompts", asyncHandler(promptController.getAll));
  app.post("/api/prompt-preview", validation.required(['provider', 'taskId']), asyncHandler(promptController.preview));
  
  // Explanation routes
  app.get("/api/puzzle/:puzzleId/explanations/summary", asyncHandler(explanationController.getSummary));
  app.get("/api/puzzle/:puzzleId/explanations", asyncHandler(explanationController.getAll));
  app.get("/api/explanations/:id", asyncHandler(explanationController.getById));
  app.get("/api/puzzle/:puzzleId/explanation", asyncHandler(explanationController.getOne));
  app.post("/api/puzzle/save-explained/:puzzleId", validation.explanationCreate, asyncHandler(explanationController.create));

  // Rebuttal chain routes
  app.get("/api/explanations/:id/chain", asyncHandler(explanationController.getRebuttalChain));
  app.get("/api/explanations/:id/original", asyncHandler(explanationController.getOriginalExplanation));

  // Feedback routes
  app.post("/api/feedback", validation.feedback, asyncHandler(feedbackController.create));
  app.get("/api/explanation/:explanationId/feedback", asyncHandler(feedbackController.getByExplanation));
  app.get("/api/puzzle/:puzzleId/feedback", asyncHandler(feedbackController.getByPuzzle));
  app.get("/api/feedback", asyncHandler(feedbackController.getAll));
  app.get("/api/feedback/stats", asyncHandler(feedbackController.getStats));
  app.get("/api/feedback/accuracy-stats", asyncHandler(feedbackController.getAccuracyStats));

  // Enhanced accuracy analysis routes - model failure detection
  app.get("/api/feedback/accuracy-stats-filtered", asyncHandler(feedbackController.getAccuracyStatsFiltered));
  app.get("/api/feedback/overconfident-models", asyncHandler(feedbackController.getOverconfidentModels));

  // Debate accuracy statistics - separate from pure solver accuracy
  app.get("/api/feedback/debate-accuracy-stats", asyncHandler(feedbackController.getDebateAccuracyStats));

  // Solution submission and voting routes (from Gemini plan)
  app.get("/api/puzzles/:puzzleId/solutions", asyncHandler(feedbackController.getSolutions));
  app.post("/api/puzzles/:puzzleId/solutions", validation.solutionSubmission, asyncHandler(feedbackController.submitSolution));
  app.post("/api/solutions/:solutionId/vote", validation.solutionVote, asyncHandler(feedbackController.voteSolution));
  app.get("/api/solutions/:solutionId/votes", asyncHandler(feedbackController.getSolutionVotes));

  // Elo rating system routes - LMArena-style explanation comparisons
  app.get("/api/elo/comparison", asyncHandler(eloController.getRandomComparison));
  app.get("/api/elo/comparison/:puzzleId", asyncHandler(eloController.getComparison));
  app.post("/api/elo/vote", asyncHandler(eloController.recordVote));
  app.get("/api/elo/leaderboard", asyncHandler(eloController.getLeaderboard));
  app.get("/api/elo/models", asyncHandler(eloController.getModelStats));
  app.get("/api/elo/stats", asyncHandler(eloController.getSystemStats));

  // Saturn analysis routes
  app.post("/api/saturn/analyze/:taskId", validation.saturnAnalysis, asyncHandler(saturnController.analyze));
  app.get("/api/stream/saturn/:taskId/:modelKey", asyncHandler(saturnController.streamAnalyze));
  app.post("/api/saturn/analyze-with-reasoning/:taskId", validation.saturnAnalysis, asyncHandler(saturnController.analyzeWithReasoning));
  app.get("/api/saturn/status/:sessionId", asyncHandler(saturnController.getStatus));

  // Grover iterative solver routes
  app.post("/api/puzzle/grover/:taskId/:modelKey", asyncHandler(groverController.analyze));
  app.get("/api/stream/grover/:taskId/:modelKey", asyncHandler(groverController.streamAnalyze));
  app.get("/api/grover/status/:sessionId", asyncHandler(groverController.getStatus));

  // Poetiq iterative code-generation solver routes
  // https://github.com/82deutschmark/poetiq-arc-agi-solver
  app.post("/api/poetiq/solve/:taskId", asyncHandler(poetiqController.solve));
  app.post("/api/poetiq/batch", asyncHandler(poetiqController.startBatch));
  app.get("/api/poetiq/batch/:sessionId", asyncHandler(poetiqController.getBatchStatus));
  app.get("/api/poetiq/status/:sessionId", asyncHandler(poetiqController.getStatus));
  app.get("/api/poetiq/models", asyncHandler(poetiqController.getModels));
  // Community progress: shows ALL 120 ARC2-Eval puzzles with Poetiq-specific status
  app.get("/api/poetiq/community-progress", asyncHandler(poetiqController.getCommunityProgress));
  // SSE streaming endpoints (replacing WebSocket)
  app.get("/api/poetiq/stream/:sessionId", asyncHandler(poetiqController.streamProgress));
  app.post("/api/poetiq/stream/solve/:taskId", asyncHandler(poetiqController.solveWithStream));
  app.post("/api/poetiq/stream/start/:sessionId", asyncHandler(poetiqController.startStreamingSolver));

  // Beetree ensemble solver routes
  app.post("/api/beetree/run", asyncHandler(beetreeController.runBeetreeAnalysis));
  app.get("/api/beetree/status/:sessionId", asyncHandler(beetreeController.getBeetreeStatus));
  app.post("/api/beetree/estimate", asyncHandler(beetreeController.estimateBeetreeCost));
  app.get("/api/beetree/history/:taskId", asyncHandler(beetreeController.getBeetreeHistory));
  app.get("/api/beetree/cost-breakdown/:explanationId", asyncHandler(beetreeController.getBeetreeCostBreakdown));
  app.post("/api/beetree/cancel/:sessionId", asyncHandler(beetreeController.cancelBeetreeAnalysis));
  // Beetree streaming endpoint - client SSE connection
  app.get("/api/stream/analyze/beetree-:sessionId", asyncHandler(beetreeController.streamBeetreeAnalysis));

  // SnakeBench LLM Snake Arena routes
  app.post("/api/snakebench/run-match", asyncHandler(snakeBenchController.runMatch));
  app.post("/api/snakebench/run-batch", asyncHandler(snakeBenchController.runBatch));
  app.get("/api/snakebench/games", asyncHandler(snakeBenchController.listGames));
  app.get("/api/snakebench/games/:gameId", asyncHandler(snakeBenchController.getGame));
  app.get("/api/snakebench/health", asyncHandler(snakeBenchController.health));
  app.get("/api/snakebench/recent-activity", asyncHandler(snakeBenchController.recentActivity));
  app.get("/api/snakebench/leaderboard", asyncHandler(snakeBenchController.basicLeaderboard));
  app.get("/api/snakebench/stats", asyncHandler(snakeBenchController.stats));
  app.get("/api/snakebench/model-rating", asyncHandler(snakeBenchController.modelRating));
  app.get("/api/snakebench/model-history", asyncHandler(snakeBenchController.modelHistory));
  app.get("/api/snakebench/greatest-hits", asyncHandler(snakeBenchController.getWormArenaGreatestHits));
  app.get(
    "/api/snakebench/trueskill-leaderboard",
    asyncHandler(snakeBenchController.trueSkillLeaderboard),
  );

  // Worm Arena live streaming (SSE wrapper around SnakeBench matches)
  app.post("/api/wormarena/prepare", asyncHandler(wormArenaStreamController.prepare));
  app.get("/api/wormarena/stream/:sessionId", asyncHandler(wormArenaStreamController.stream));

  // Batch analysis routes
  app.post("/api/batch/start", asyncHandler(batchController.startBatch));
  app.get("/api/batch/status/:sessionId", asyncHandler(batchController.getBatchStatus));
  app.post("/api/batch/pause/:sessionId", asyncHandler(batchController.pauseBatch));
  app.post("/api/batch/resume/:sessionId", asyncHandler(batchController.resumeBatch));
  app.get("/api/batch/results/:sessionId", asyncHandler(batchController.getBatchResults));
  app.get("/api/batch/sessions", asyncHandler(batchController.listSessions));

  // Admin routes
  app.use("/api/admin", adminController);

  // Admin dashboard and HuggingFace ingestion routes
  app.get("/api/admin/quick-stats", asyncHandler(adminControllerFns.getQuickStats));
  app.get("/api/admin/recent-activity", asyncHandler(adminControllerFns.getRecentActivity));
  app.post("/api/admin/validate-ingestion", asyncHandler(adminControllerFns.validateIngestion));
  app.post("/api/admin/start-ingestion", asyncHandler(adminControllerFns.startIngestion));
  app.get("/api/admin/ingestion-history", asyncHandler(adminControllerFns.getIngestionHistory));
  app.get("/api/admin/hf-folders", asyncHandler(adminControllerFns.listHFFolders));
  app.get("/api/admin/openrouter/catalog", asyncHandler(adminControllerFns.getOpenRouterCatalog));
  app.get("/api/admin/openrouter/discover", asyncHandler(adminControllerFns.discoverOpenRouter));
  app.post("/api/admin/openrouter/import", asyncHandler(adminControllerFns.importOpenRouter));

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
  
  // Simple health check endpoint for deployment monitoring
  app.get("/api/health", (req, res) => {
    res.json({
      status: 'ok',
      message: 'ARC Explainer API is healthy',
      timestamp: new Date().toISOString()
    });
  });

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
