import { createRoot } from "react-dom/client";
import App from "./App";
import { AppShell } from "./auth/ClerkSetup";
import { gameSession } from "./game/GameSession";
import { bindInstallPrompt, registerServiceWorker } from "./lib/pwa";
import "./index.css";

// Fleet auth + character roster (non-blocking — guest play works offline).
void gameSession.boot().catch((err) => {
  console.warn("[gameopen] fleet auth boot failed (guest mode)", err);
});

// PWA: capture install prompt + register offline shell worker (prod).
bindInstallPrompt();
void registerServiceWorker();

// Expose for Studio host / debug HUD (no React re-render requirement).
if (typeof window !== "undefined") {
  (window as unknown as { __GAME_SESSION__?: typeof gameSession }).__GAME_SESSION__ =
    gameSession;
}

createRoot(document.getElementById("root")!).render(<AppShell home={<App />} />);
