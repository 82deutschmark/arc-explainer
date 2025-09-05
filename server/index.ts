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

// Fix for ES modules and bundled code - get the actual current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Log environment variables status for debugging
logger.info('Environment variables loaded: ' + (process.env.OPENAI_API_KEY ? 'OPENAI_API_KEY is set' : 'OPENAI_API_KEY is NOT set'), 'startup');
logger.info('DeepSeek API key status: ' + (process.env.DEEPSEEK_API_KEY ? 'DEEPSEEK_API_KEY is set' : 'DEEPSEEK_API_KEY is NOT set'), 'startup');
logger.debug('Current working directory: ' + process.cwd(), 'startup');
logger.debug('__dirname: ' + __dirname, 'startup');

const app = express();

// Configure CORS
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // In development, allow requests from common local ports and undefined origins (like Postman)
    if (process.env.NODE_ENV !== 'production') {
      const devOrigins = ['http://localhost:3000', 'http://localhost:5000', 'http://localhost:5173'];
      if (!origin || devOrigins.includes(origin)) {
        return callback(null, true);
      }
    }

    // In production, only allow requests from the whitelisted domains
    const allowedOrigins = [
      'https://sfmc.bhhc.us',                          // Production SFMC domain
      'https://sfmc-production.up.railway.app',        // Production SFMC on Railway
      'https://arc-explainer-production.up.railway.app',  // This API's own domain
      'https://arc-explainer.up.railway.app'            // Fallback/previous app domain
    ];

    if (origin && allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // Log the blocked origin for debugging purposes
      if (origin) {
        logger.warn(`CORS: Blocked origin: ${origin}`, 'security');
      } else if (process.env.NODE_ENV === 'production') {
        logger.warn(`CORS: Blocked request with no origin`, 'security');
      }
      // For production, block requests from non-whitelisted origins
      // In development, this part is not reached due to the check above, but as a fallback:
      if (process.env.NODE_ENV === 'production') {
        callback(new Error('Not allowed by CORS'));
      } else {
        callback(null, true); // Allow other origins in dev
      }
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Length', 'Content-Type'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// Apply CORS middleware first before any other middleware
app.use(cors(corsOptions));

// Add a specific middleware to ensure CORS headers are set
app.use((req, res, next) => {
  // Ensure CORS headers are set for all responses, including error responses
  res.header('Access-Control-Allow-Origin', req.get('origin') || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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