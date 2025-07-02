import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

// Log environment variables status for debugging
console.log('Environment variables loaded:', process.env.OPENAI_API_KEY ? 'OPENAI_API_KEY is set' : 'OPENAI_API_KEY is NOT set');

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

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Use PORT environment variable if available, otherwise default to 5000 for local development
  const port = process.env.PORT || 5000;
  // Use 127.0.0.1 for Windows compatibility in development
  const host = process.env.NODE_ENV === 'development' ? '127.0.0.1' : (process.env.HOST || '0.0.0.0');
  
  server.listen({
    port: Number(port),
    host,
    reusePort: process.env.NODE_ENV === 'production', // Only reuse port in production
  }, () => {
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
    log(`Server running in ${app.get('env')} mode at ${protocol}://${host}:${port}`);
  });
})();
