/**
 * Author: gpt-5-codex
 * Date: 2025-10-16T00:00:00Z
 * PURPOSE: Bootstraps the Express server, wiring middleware, routes, static serving, and startup diagnostics.
 * SRP/DRY check: Pass — initialization and environment checks consolidated in a single entry point.
 */

import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import cors from 'cors';
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { attach as attachWs } from './services/wsService';
import { repositoryService } from './repositories/RepositoryService.ts';
import { logger } from './utils/logger.ts';
import { resolveStreamingConfig } from '@shared/config/streaming';
import { databaseMaintenance } from './maintenance/dbCleanup.js';

// Fix for ES modules and bundled code - get the actual current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Log environment variables status for debugging
logger.info('Environment variables loaded: ' + (process.env.OPENAI_API_KEY ? 'OPENAI_API_KEY is set' : 'OPENAI_API_KEY is NOT set'), 'startup');
logger.info('DeepSeek API key status: ' + (process.env.DEEPSEEK_API_KEY ? 'DEEPSEEK_API_KEY is set' : 'DEEPSEEK_API_KEY is NOT set'), 'startup');
logger.debug('Current working directory: ' + process.cwd(), 'startup');
logger.debug('__dirname: ' + __dirname, 'startup');

const streamingConfig = resolveStreamingConfig();
const streamingSource = streamingConfig.backendSource?.key ?? streamingConfig.frontendSource?.key ?? 'default';

if (streamingConfig.legacySources.length > 0) {
  logger.warn(
    `Legacy streaming env var(s) detected (${streamingConfig.legacySources.join(', ')}). Please migrate to STREAMING_ENABLED for consistency.`,
    'startup'
  );
}

if (streamingConfig.frontendAdvertises && !streamingConfig.enabled) {
  logger.warn(
    'Streaming mismatch detected: frontend build advertises streaming while backend disabled. Align STREAMING_ENABLED across environments to avoid silent regressions.',
    'startup'
  );
} else {
  logger.info(
    `Streaming feature flag resolved to ${streamingConfig.enabled ? 'ENABLED' : 'DISABLED'} (source: ${streamingSource}).`,
    'startup'
  );
}

const app = express();

// Configure CORS - Allow all origins
const corsOptions = {
  origin: true,  // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Length', 'Content-Type'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// Apply CORS middleware first before any other middleware
app.use(cors(corsOptions));

// Enforce HTTPS for API key submissions in production
if (app.get("env") === "production") {
  app.use('/api/poetiq/solve', (req, res, next) => {
    if (req.protocol !== 'https') {
      return res.status(400).json({
        error: 'HTTPS required',
        message: 'API keys must be transmitted over HTTPS for security'
      });
    }
    next();
  });
}

// CORS middleware handles all headers automatically - no manual headers needed

// Increase body parser limit to handle large AI responses (reasoning_items, etc.)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});


// Initialize the server
const initServer = async () => {
  // Initialize repository service (replaces dbService.init)
  const repoInitialized = await repositoryService.initialize();
  logger.info(`Repository service ${repoInitialized ? 'initialized successfully' : 'failed - running in fallback mode'}`, 'startup');
  
  if (repoInitialized) {
    const stats = await repositoryService.getDatabaseStats();
    logger.info(`Database stats: ${stats.totalExplanations} explanations, ${stats.totalFeedback} feedback entries`, 'startup');

    // Run database maintenance on startup to clean up temp files and optimize
    try {
      logger.info('Running database maintenance tasks on startup...', 'startup');
      await databaseMaintenance.performMaintenance();

      // Schedule periodic maintenance every 6 hours
      const maintenanceInterval = 6 * 60 * 60 * 1000; // 6 hours in ms
      setInterval(async () => {
        logger.info('Running scheduled database maintenance...', 'maintenance');
        try {
          await databaseMaintenance.performMaintenance();
        } catch (error) {
          logger.error(`Scheduled maintenance failed: ${error instanceof Error ? error.message : String(error)}`, 'maintenance');
        }
      }, maintenanceInterval);

      logger.info(`Scheduled database maintenance to run every 6 hours`, 'startup');
    } catch (error) {
      logger.warn(`Initial database maintenance failed (non-fatal): ${error instanceof Error ? error.message : String(error)}`, 'startup');
    }
  }
  // Register API routes FIRST
  const server = await registerRoutes(app);

  // Attach WebSocket hub for Saturn progress streaming
  attachWs(server);

  // In production, set up static file serving and the SPA fallback.
  // This must come AFTER API routes are registered.
  if (app.get("env") === "production") {
    // In the Railway environment, process.cwd() is the root of the project.
    // The client assets are built to 'dist/public'.
    const staticPath = path.join(process.cwd(), "dist", "public");

    logger.info(`Production mode: serving static files from ${staticPath}`, 'server');

    // Serve static files (e.g., assets, css, js)
    // Use explicit index: false to prevent express from serving index.html directly
    // when the URL path is to a directory
    app.use(express.static(staticPath, {
      index: false,  // Don't automatically serve index.html for directory requests
      setHeaders: (res, path) => {
        // Add cache headers for static assets
        if (path.endsWith('.css') || path.endsWith('.js')) {
          res.setHeader('Cache-Control', 'public, max-age=31536000');
        }
      }
    }));

    // For any other request that doesn't match an API route or a static file,
    // send the client's index.html file. This is the SPA fallback.
    app.get("*", (req, res) => {
      if (req.path.startsWith("/api")) {
        // This case should ideally not be hit if API routes are registered before this,
        // but it's a safe fallback.
        return res.status(404).json({ message: "API route not found" });
      }
      
      // Log the request and file path for debugging
      logger.debug(`Serving index.html for path: ${req.path}`, 'server');
      
      const indexPath = path.join(staticPath, "index.html");
      
      // Check if the file exists
      if (fs.existsSync(indexPath)) {
        logger.debug(`index.html found at: ${indexPath}`, 'server');
        
        // Use absolute path for sendFile to avoid path resolution issues
        return res.sendFile(path.resolve(indexPath));
      } else {
        logger.error(`index.html NOT found at: ${indexPath}`, 'server');
        return res.status(500).send(
          "Server configuration issue: index.html not found. " +
          "Make sure the client app is built and the path to index.html is correct."
        );
      }
    });
  } else {
    // Development mode - use Vite
    await setupVite(app, server);
  }

  // Start the server unless it's a Vercel-like environment (which is not our case)
  // For Railway, we need to listen on the port provided.
  const port = process.env.PORT || 5000;
  const host = '0.0.0.0'; // Listen on all available interfaces in production
  
  server.listen(port, () => {
    log(`Server running in ${app.get("env")} mode at http://${host}:${port}`);
  });
};

// Initialize the server
initServer().catch(error => {
  logger.error(`Server initialization failed: ${error instanceof Error ? error.message : String(error)}`, 'startup');
  process.exit(1);
});

// Export the app. While this is often for serverless, it doesn't harm our Railway deployment.
export default app;