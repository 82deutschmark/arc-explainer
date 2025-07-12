import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import path from "path";
import { fileURLToPath } from "url";

// Fix for ES modules and bundled code - get the actual current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Log environment variables status for debugging
console.log('Environment variables loaded:', process.env.OPENAI_API_KEY ? 'OPENAI_API_KEY is set' : 'OPENAI_API_KEY is NOT set');
console.log('Current working directory:', process.cwd());
console.log('__dirname:', __dirname);

const app = express();
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
  // Register API routes FIRST
  const server = await registerRoutes(app);

  // In production, set up static file serving and the SPA fallback.
  // This must come AFTER API routes are registered.
  if (app.get("env") === "production") {
    // In the Railway environment, process.cwd() is the root of the project.
    // The client assets are built to 'dist/public'.
    const staticPath = path.join(process.cwd(), "dist", "public");

    console.log(`Production mode: serving static files from ${staticPath}`);

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
      const indexPath = path.join(staticPath, "index.html");
      res.sendFile(indexPath, (err) => {
        if (err) {
          console.error("Error serving index.html:", err);
          res.status(500).send("Could not load the application. Please check server logs.");
        }
      });
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
initServer().catch(console.error);

// Export the app. While this is often for serverless, it doesn't harm our Railway deployment.
export default app;