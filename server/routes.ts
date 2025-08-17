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

// Import middleware
import { errorHandler } from "./middleware/errorHandler";
import { asyncHandler } from "./middleware/asyncHandler";
import { validation } from "./middleware/validation";

// Import services
import { aiServiceFactory } from "./services/aiServiceFactory";
import { dbService } from "./services/dbService";

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize services
  await aiServiceFactory.initialize();
  const dbInitialized = await dbService.init();
  console.log(`Database ${dbInitialized ? 'initialized successfully' : 'not available - running in memory mode'}`);

  // Routes with consistent naming and error handling
  
  // Puzzle routes
  app.get("/api/puzzle/list", asyncHandler(puzzleController.list));
  app.get("/api/puzzle/overview", asyncHandler(puzzleController.overview));
  app.get("/api/puzzle/task/:taskId", asyncHandler(puzzleController.getById));
  app.post("/api/puzzle/analyze/:taskId/:model", asyncHandler(puzzleController.analyze));
  app.get("/api/puzzle/:puzzleId/has-explanation", asyncHandler(puzzleController.hasExplanation));
  
  // Debug route to force puzzle loader reinitialization
  app.post("/api/puzzle/reinitialize", asyncHandler(puzzleController.reinitialize));
  
  // Prompt preview route - shows exact prompt that will be sent to specific provider
  app.post("/api/prompt/preview/:provider/:taskId", asyncHandler(puzzleController.previewPrompt));
  
  // Prompt template routes
  app.get("/api/prompts", asyncHandler(promptController.getAll));
  app.get("/api/emoji-sets", asyncHandler(promptController.getEmojiSets));
  
  // Explanation routes
  app.get("/api/puzzle/:puzzleId/explanations", asyncHandler(explanationController.getAll));
  app.get("/api/puzzle/:puzzleId/explanation", asyncHandler(explanationController.getOne));
  app.post("/api/puzzle/save-explained/:puzzleId", asyncHandler(explanationController.create));
  
  // Feedback routes
  app.post("/api/feedback", validation.feedback, asyncHandler(feedbackController.create));

  // Saturn analysis routes
  app.post("/api/saturn/analyze/:taskId", asyncHandler(saturnController.analyze));
  app.get("/api/saturn/status/:sessionId", asyncHandler(saturnController.getStatus));
  
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
