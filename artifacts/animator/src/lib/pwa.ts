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

/** Register the app shell service worker (production / preview only). */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;

  // Avoid SW during Vite HMR dev (stale shell confusion).
  if (import.meta.env.DEV) return null;

  try {
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
      if (ev.data?.type === "SW_ACTIVATED") reloadOnce();
    });

    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    // Force-check for updates every load (bust CDN / long-lived SW)
    void reg.update().catch(() => undefined);
    // Nudge waiting workers so updates apply immediately
    if (reg.waiting) reg.waiting.postMessage("SKIP_WAITING");
    reg.addEventListener("updatefound", () => {
      const sw = reg.installing;
      if (!sw) return;
      sw.addEventListener("statechange", () => {
        if (sw.state === "installed" && navigator.serviceWorker.controller) {
          sw.postMessage("SKIP_WAITING");
          console.info("[pwa] Update ready — applying");
        }
      });
    });
    return reg;
  } catch (err) {
    console.warn("[pwa] service worker registration failed", err);
    return null;
  }
}
