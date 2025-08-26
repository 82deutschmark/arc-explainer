import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from 'url';
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

// Get the current directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use a dynamic import for the cartographer plugin to avoid top-level await
export default defineConfig(async (): Promise<import('vite').UserConfig> => {
  const plugins: import('vite').PluginOption[] = [
    react(),
    runtimeErrorOverlay(),
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
