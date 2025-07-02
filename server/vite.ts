import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
// Import the Vite config as a dynamic import to avoid issues with ESM top-level await
const importViteConfig = async () => {
  const config = await import('../vite.config');
  return config.default;
};
import { nanoid } from "nanoid";

const viteLogger = createLogger('info'); // Specify log level to fix argument error

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  // Get the Vite config dynamically
  const viteConfig = await importViteConfig();
  // Resolve async or function-based Vite config
  const baseConfig = typeof viteConfig === 'function' ? await viteConfig({ command: 'serve', mode: 'development' }) : viteConfig;

  const vite = await createViteServer({
    ...baseConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg: string, options?: any) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: {
      middlewareMode: true,
      hmr: {
        server,
        protocol: 'ws',
        host: 'localhost',
      },
    },
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "..", "dist", "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Serve static files including index.html
  app.use(express.static(distPath));

  // Fallback: return index.html for client-side routed paths
  app.use('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}
