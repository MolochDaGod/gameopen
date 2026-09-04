import { createRoot } from "react-dom/client";
import App from "./App";
import { AppShell } from "./auth/ClerkSetup";
import { gameSession } from "./game/GameSession";
import {
  bindInstallPrompt,
  purgeHistoricalShellIfNeeded,
  registerServiceWorker,
} from "./lib/pwa";
import { bootstrapMineLoaderFleetCache } from "./lib/mineLoaderFleetCache";
import "./index.css";

// Kill legacy R2 fetch hijack (prepare-client used to rewrite /models|/icons to
// assets.grudge-studio.com/gameopen which 404s). Must run before any GLTF load.
if (typeof window !== "undefined") {
  const g = (window as unknown as { __GAMEOPEN__?: { useR2?: boolean } }).__GAMEOPEN__;
  if (g) g.useR2 = false;
}

// Mine-Loader worldFleet / stamp epoch → CDN ?v= bust (shared with Realms).
void bootstrapMineLoaderFleetCache().catch((err) => {
  console.warn("[gameopen] fleet cache bootstrap failed", err);
});

// Fleet auth + character roster (non-blocking — guest play works offline).
void gameSession.boot().catch((err) => {
  console.warn("[gameopen] fleet auth boot failed (guest mode)", err);
});

// ObjectStore master-weaponSkills (uMMORPG catalog) for Danger Room hotbar.
void import("./three/content/masterWeaponSkills")
  .then(({ loadMasterWeaponSkills }) => loadMasterWeaponSkills())
  .catch((err) => console.warn("[gameopen] master-weaponSkills load failed", err));

// PWA: capture install prompt. Purge/register AFTER first paint so a controlling
// SW unregister cannot abort the hashed module graph (stuck "Loading library…").
bindInstallPrompt();
void (async () => {
  const reloading = await purgeHistoricalShellIfNeeded(6);
  if (reloading) return;
  const later =
    typeof window !== "undefined" && "requestIdleCallback" in window
      ? (fn: () => void) =>
          window.requestIdleCallback(fn, { timeout: 2500 })
      : (fn: () => void) => window.setTimeout(fn, 1200);
  later(() => {
    void registerServiceWorker();
  });
})();

// Expose for Studio host / debug HUD (no React re-render requirement).
if (typeof window !== "undefined") {
  (window as unknown as { __GAME_SESSION__?: typeof gameSession }).__GAME_SESSION__ =
    gameSession;
}

createRoot(document.getElementById("root")!).render(<AppShell home={<App />} />);
if (typeof window !== "undefined") {
  (window as unknown as { __GRUDGE_OPEN_BOOTED__?: boolean }).__GRUDGE_OPEN_BOOTED__ =
    true;
}
