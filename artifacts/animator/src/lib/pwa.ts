/**
 * Progressive Web App helpers — service worker registration + install prompt.
 * Makes Grudge Open installable like a desktop/mobile app (Steam-like shell).
 */

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<(canInstall: boolean) => void>();

function notify() {
  const can = !!deferred && !isStandalone();
  for (const fn of listeners) fn(can);
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia?.("(display-mode: standalone)")?.matches;
  const ios = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return !!(mq || ios);
}

export function canInstallPwa(): boolean {
  return !!deferred && !isStandalone();
}

export function onInstallAvailability(fn: (canInstall: boolean) => void): () => void {
  listeners.add(fn);
  fn(canInstallPwa());
  return () => listeners.delete(fn);
}

/** Capture Chrome/Edge beforeinstallprompt for a custom Install button. */
export function bindInstallPrompt(): () => void {
  if (typeof window === "undefined") return () => {};

  const onBip = (e: Event) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    notify();
  };
  const onInstalled = () => {
    deferred = null;
    notify();
  };

  window.addEventListener("beforeinstallprompt", onBip);
  window.addEventListener("appinstalled", onInstalled);
  return () => {
    window.removeEventListener("beforeinstallprompt", onBip);
    window.removeEventListener("appinstalled", onInstalled);
  };
}

/** Show the native install dialog if available. */
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferred) return "unavailable";
  try {
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null;
    notify();
    return outcome;
  } catch {
    return "unavailable";
  }
}

/**
 * Hard recovery: unregister all SWs + clear shell caches.
 * Also strips any accidental mesh/binary entries (stretch / wrong kit history).
 */
export async function nukeServiceWorkers(): Promise<void> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const reg of regs) {
      reg.active?.postMessage({ type: "NUKE" });
      await reg.unregister();
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      // Delete ALL grudge-open shells (v2/v3/v4) — not only current prefix
      await Promise.all(
        keys
          .filter(
            (k) =>
              k.startsWith("grudge-open-shell") ||
              k.includes("grudge-open") ||
              k.startsWith("workbox-") ||
              k.includes("precache"),
          )
          .map((k) => caches.delete(k)),
      );
    }
  } catch (err) {
    console.warn("[pwa] nukeServiceWorkers failed", err);
  }
}

/**
 * One-shot per deploy: if shell version lags, nuke caches once.
 * Call from boot when ?purge=1 or after fleet asset scale fixes.
 */
export async function purgeHistoricalShellIfNeeded(minVersion = 4): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const key = "grudge_open_shell_cache_ver";
    const cur = Number(localStorage.getItem(key) || "0");
    const force =
      new URLSearchParams(window.location.search).has("purge") ||
      new URLSearchParams(window.location.search).has("purgecache");
    if (!force && cur >= minVersion) return;
    await nukeServiceWorkers();
    localStorage.setItem(key, String(minVersion));
    if (force) {
      const u = new URL(window.location.href);
      u.searchParams.delete("purge");
      u.searchParams.delete("purgecache");
      window.location.replace(u.toString());
    }
  } catch (err) {
    console.warn("[pwa] purgeHistoricalShellIfNeeded failed", err);
  }
}

/** Register the app shell service worker (production / preview only). */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;

  // Avoid SW during Vite HMR dev (stale shell confusion).
  if (import.meta.env.DEV) return null;

  try {
    // Escape hatch: ?nosw=1 or localStorage grudge_open_nosw=1
    const nosw =
      new URLSearchParams(window.location.search).has("nosw") ||
      localStorage.getItem("grudge_open_nosw") === "1";
    if (nosw) {
      await nukeServiceWorkers();
      console.info("[pwa] Service worker disabled (?nosw=1 / grudge_open_nosw)");
      return null;
    }

    // When a new SW takes control, reload once so we leave stale hashed bundles
    // (e.g. index-C8VhAvKm.js with broken R2 /gameopen asset paths).
    let reloading = false;
    const reloadOnce = () => {
      if (reloading) return;
      reloading = true;
      console.info("[pwa] New app shell active — reloading");
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", reloadOnce);
    navigator.serviceWorker.addEventListener("message", (ev) => {
      if (ev.data?.type === "SW_ACTIVATED" || ev.data?.type === "SW_NUKED") reloadOnce();
    });

    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    // Force-check for updates every load (bust CDN / long-lived SW)
    void reg.update().catch(() => undefined);
    // Nudge waiting workers so updates apply immediately
    if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
    reg.addEventListener("updatefound", () => {
      const sw = reg.installing;
      if (!sw) return;
      sw.addEventListener("statechange", () => {
        if (sw.state === "installed" && navigator.serviceWorker.controller) {
          sw.postMessage({ type: "SKIP_WAITING" });
          console.info("[pwa] Update ready — applying");
        }
      });
    });
    return reg;
  } catch (err) {
    console.warn("[pwa] service worker registration failed", err);
    // Broken SW must not brick the site — try unregister and let next load recover
    try {
      await nukeServiceWorkers();
    } catch {
      /* */
    }
    return null;
  }
}
