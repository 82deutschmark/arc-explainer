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

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // In production, serve static files manually to avoid path resolution issues
  if (app.get("env") === "production") {
    // For Railway deployment, the static files should be in the dist/public directory
    // We need to resolve this relative to the current working directory, not __dirname
    const staticPath = path.join(process.cwd(), 'dist', 'public');
    console.log('Serving static files from:', staticPath);
    
    // Serve static files with a fallback to index.html for SPA routing
    app.use(express.static(staticPath));
    
    // Handle client-side routing - serve index.html for all non-API routes
    app.get('*', (req: Request, res: Response) => {
      if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(staticPath, 'index.html'), (err) => {
          if (err) {
            console.error('Error serving index.html:', err);
            res.status(500).send('Error loading application');
          }
        });
      } else {
        res.status(404).json({ message: 'API route not found' });
      }
    });
  } else {
    // Development mode - use Vite
    await setupVite(app, server);
  }

  // Use PORT environment variable if available, otherwise default to 5000 for local development
  const port = process.env.PORT || 5000;
  // Railway sets HOST automatically, so use that or default to 0.0.0.0 for production
  const host = process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');
  
  server.listen({
    port: Number(port),
    host,
  }, () => {
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
    log(`Server running in ${app.get('env')} mode at ${protocol}://${host}:${port}`);
  });
})();