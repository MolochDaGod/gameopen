import { defineConfig } from "vitest/config";
import path from "path";

// Standalone test config. The app's vite.config.ts deliberately throws when
// PORT/BASE_PATH are missing, so tests use this minimal config instead. Tests
// run in the node environment — the dungeon navmesh + damage modules are
// pure-data (no DOM / Three.js). Visual-effect modules that build CanvasTextures
// at construction time (telegraph rings, indicators) need a `document.createElement
// ("canvas")`; the setup file below installs a lightweight no-op canvas stub so
// those suites run without a heavy jsdom/happy-dom DOM environment (keeps the
// OOM-safe single-fork run lean — see .agents/memory/animator-vitest-oom.md).
export default defineConfig({
  resolve: {
    alias: [
      // `@assets/*` URL imports (e.g. self-hosted .wav one-shots) have no bundler
      // under the node test env; collapse them to an empty-string default so engine
      // modules that import asset URLs can be loaded by tests.
      { find: /^@assets\/.*/, replacement: path.resolve(import.meta.dirname, "src/three/__test-stubs__/assetUrl.ts") },
      { find: "@", replacement: path.resolve(import.meta.dirname, "src") },
      // @workspace/* packages — must match vite.config.ts exactly so tests
      // can resolve the same TS source the bundler resolves at build time.
      { find: "@workspace/epicfight",      replacement: path.resolve(import.meta.dirname, "../../lib/epicfight/src/index.ts") },
      { find: "@workspace/danger-net",     replacement: path.resolve(import.meta.dirname, "../../lib/danger-net/src/index.ts") },
      { find: "@workspace/brawl-net",      replacement: path.resolve(import.meta.dirname, "../../lib/brawl-net/src/index.ts") },
      { find: "@workspace/carrier-net",    replacement: path.resolve(import.meta.dirname, "../../lib/carrier-net/src/index.ts") },
      { find: "@workspace/api-client-react", replacement: path.resolve(import.meta.dirname, "../../lib/api-client-react/src/index.ts") },
      { find: "@workspace/api-zod",        replacement: path.resolve(import.meta.dirname, "../../lib/api-zod/src/index.ts") },
      { find: "@workspace/animator",       replacement: path.resolve(import.meta.dirname, "../../lib/animator/src/index.ts") },
      { find: "@workspace/grudge-runtime", replacement: path.resolve(import.meta.dirname, "../../lib/grudge-runtime/src/index.ts") },
      { find: "@workspace/grudge-physics", replacement: path.resolve(import.meta.dirname, "../../lib/grudge-physics/src/index.ts") },
      { find: "@workspace/grudge-warlords", replacement: path.resolve(import.meta.dirname, "../../lib/grudge-warlords/src/index.ts") },
      { find: "@workspace/voxel-canonical", replacement: path.resolve(import.meta.dirname, "../../lib/voxel-canonical/src/index.ts") },
    ],
  },
  // Component render tests (react-dom/server) need the automatic JSX runtime;
  // the app's tsconfig uses `jsx: preserve` and relies on Vite's React plugin,
  // which isn't loaded by this standalone config.
  esbuild: { jsx: "automatic" },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "node",
    setupFiles: [path.resolve(import.meta.dirname, "src/three/__test-stubs__/canvasStub.ts")],
  },
});
