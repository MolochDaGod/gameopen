import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

/**
 * Grudge Studio — animator (Danger Room)
 * Migrated off Replit: no cartographer / dev-banner / runtime-error-modal.
 *
 * Defaults so local + Vercel work without Replit env injection:
 *   PORT=5173  BASE_PATH=/
 * Production under /animator/: BASE_PATH=/animator/
 */
const port = Number(process.env.PORT || 5173);
const basePath = process.env.BASE_PATH || "/";

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${process.env.PORT}"`);
}

export default defineConfig({
  base: basePath,
  plugins: [react(), tailwindcss({ optimize: false })],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "public"),
      "@workspace/api-client-react": path.resolve(
        import.meta.dirname,
        "../../lib/api-client-react/src/index.ts",
      ),
      "@workspace/api-zod": path.resolve(
        import.meta.dirname,
        "../../lib/api-zod/src/index.ts",
      ),
      "@workspace/danger-net": path.resolve(
        import.meta.dirname,
        "../../lib/danger-net/src/index.ts",
      ),
      "@workspace/epicfight": path.resolve(
        import.meta.dirname,
        "../../lib/epicfight/src/index.ts",
      ),
      "@workspace/carrier-net": path.resolve(
        import.meta.dirname,
        "../../lib/carrier-net/src/index.ts",
      ),
      "@workspace/brawl-net": path.resolve(
        import.meta.dirname,
        "../../lib/brawl-net/src/index.ts",
      ),
      "@workspace/voxel-canonical": path.resolve(
        import.meta.dirname,
        "../../lib/voxel-canonical/src/index.ts",
      ),
      "@workspace/animator": path.resolve(
        import.meta.dirname,
        "../../lib/animator/src/index.ts",
      ),
      // The @workspace/* libs above are aliased to their TS SOURCE, so their
      // bare external imports (e.g. @tanstack/react-query in the generated
      // api-client) must resolve to THIS app's installed copies regardless of
      // the importing file's location on disk. Without these, Rollup fails with
      // "failed to resolve import '@tanstack/react-query' from lib/...".
      "@tanstack/react-query": path.resolve(
        import.meta.dirname,
        "node_modules/@tanstack/react-query",
      ),
      zod: path.resolve(import.meta.dirname, "node_modules/zod"),
    },
    dedupe: ["react", "react-dom", "three"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    sourcemap: true,
    target: "es2022",
    rollupOptions: {
      output: {
        manualChunks: {
          three: ["three"],
          engine: ["@dimforge/rapier3d-compat", "yuka"].filter(() => true),
        },
      },
    },
  },
  server: {
    port,
    strictPort: false,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY || "http://127.0.0.1:8080",
        changeOrigin: true,
        ws: true,
      },
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
  define: {
    __GRUDGE_FLEET__: JSON.stringify({
      assets: "https://assets.grudge-studio.com",
      id: "https://id.grudge-studio.com",
      objectStore: "https://objectstore.grudge-studio.com/api/v1",
      gameData: "https://grudge-api-production-0d46.up.railway.app",
    }),
  },
});
