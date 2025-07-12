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
  app.get("/api/puzzle/task/:taskId", asyncHandler(puzzleController.getById));
  app.post("/api/puzzle/analyze/:taskId/:model", asyncHandler(puzzleController.analyze));
  app.get("/api/puzzle/:puzzleId/has-explanation", asyncHandler(puzzleController.hasExplanation));
  
  // Explanation routes
  app.get("/api/puzzle/:puzzleId/explanations", asyncHandler(explanationController.getAll));
  app.get("/api/puzzle/:puzzleId/explanation", asyncHandler(explanationController.getOne));
  app.post("/api/puzzle/save-explained/:puzzleId", asyncHandler(explanationController.create));
  
  // Feedback routes
  app.post("/api/feedback", validation.feedback, asyncHandler(feedbackController.create));
  
  // Validation endpoint - return 501 Not Implemented (keeping for backward compatibility)
  app.post("/api/puzzle/validate", (req, res) => {
    return res.status(501).json({ 
      success: false,
      message: 'Solution validation is not available in this version. Please update your client.'
    });
  });

  // Error handling middleware (comes before the catch-all route)
  app.use(errorHandler);

  // Catch-all route handler for client-side routes
  // Serves the React app for all non-API routes
  app.get("*", (req, res) => {
    // Skip API routes - they should be handled by their specific handlers
    if (req.path.startsWith("/api/")) {
      return res.status(404).json({ message: "API endpoint not found" });
    }
    
    // Determine the path to the index.html file
    // In production, this is typically in a 'dist' or 'build' directory
    // Build output places index.html in 'dist/public' at project root
    const indexPath = path.resolve(process.cwd(), "dist/public/index.html");
    
    // Check if the file exists
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    } else {
      // Fall back to serving a simple message if the file doesn't exist
      // This might happen in development mode
      return res.status(500).send(
        "Server configuration issue: index.html not found. " + 
        "Make sure the client app is built and the path to index.html is correct."
      );
    }
  });

  return createServer(app);
}
