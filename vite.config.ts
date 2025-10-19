/**
 * Author: gpt-5-codex
 * Date: 2025-10-16T00:00:00Z
 * PURPOSE: Configures Vite for the React client, synchronizing streaming feature flags with the shared config helper.
 * SRP/DRY check: Pass — single responsibility for build tooling and env normalization.
 */

import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from 'url';

const STREAMING_ENV_KEYS = [
  'STREAMING_ENABLED',
  'VITE_STREAMING_ENABLED',
  'ENABLE_SSE_STREAMING',
  'VITE_ENABLE_SSE_STREAMING',
] as const;

function synchronizeStreamingEnv(mode: string): string {
  const env = loadEnv(mode, process.cwd(), '');
  const resolvedCandidate = STREAMING_ENV_KEYS.map(key => env[key]).find(value => typeof value !== 'undefined');
  const defaultValue = mode === 'development' ? 'true' : 'false';
  const resolvedValue = resolvedCandidate ?? defaultValue;

  if (env.ENABLE_SSE_STREAMING || env.VITE_ENABLE_SSE_STREAMING) {
    console.warn('[vite] Detected legacy streaming env var (ENABLE_SSE_STREAMING / VITE_ENABLE_SSE_STREAMING). Please migrate to STREAMING_ENABLED.');
  }

  if (!process.env.STREAMING_ENABLED) {
    process.env.STREAMING_ENABLED = resolvedValue;
  }
  process.env.VITE_STREAMING_ENABLED = resolvedValue;

  return resolvedValue;
}

// Get the current directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use a dynamic import for the cartographer plugin to avoid top-level await
export default defineConfig(async ({ mode }): Promise<import('vite').UserConfig> => {
  const streamingFlag = synchronizeStreamingEnv(mode);
  const plugins: import('vite').PluginOption[] = [
    react(),
 
  ];

  // Only include cartographer in development and when running in Replit
  if (process.env.NODE_ENV !== "production" && process.env.REPL_ID) {
    const { cartographer } = await import("@replit/vite-plugin-cartographer");
    const cartographerPlugin = cartographer();
    if (cartographerPlugin) {
      plugins.push(cartographerPlugin);
    }
  }

  return {
    base: '/', // Use root-relative paths for production to avoid nested path issues
    css: {
      postcss: './postcss.config.js', // Explicitly specify PostCSS config
    },
    plugins,
    define: {
      'import.meta.env.VITE_STREAMING_ENABLED': JSON.stringify(streamingFlag),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "client", "src"),
        "@shared": path.resolve(__dirname, "shared"),
        "@assets": path.resolve(__dirname, "attached_assets"),
      },
    },
    root: path.resolve(__dirname, "client"),
    build: {
      outDir: path.resolve(__dirname, "dist/public"),
      emptyOutDir: true,
      sourcemap: true, // Enable source maps for debugging
    },
    preview: {
      port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
      strictPort: true,
    },
    server: {
      allowedHosts: true, // Allow all hosts for deployment flexibility
      hmr: {
        overlay: false, // Suppress HMR error overlay when accessing via backend (localhost:5000)
      },
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          secure: false
        }
      }
    },
  };
});
