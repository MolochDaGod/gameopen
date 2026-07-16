/* Grudge Open — installable app shell service worker
 *
 * v2: never pin hashed Vite bundles forever; always drop old shell caches on
 * activate so users leave broken R2-gameopen asset loaders behind.
 */
const CACHE = "grudge-open-shell-v2";
const PRECACHE = [
  "/manifest.webmanifest",
  "/favicon.svg",
  "/logo.svg",
  "/pwa-192.png",
  "/pwa-512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            // Drop every shell cache that is not this version (v1 held stale index.html)
            .filter((k) => k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim())
      .then(() =>
        self.clients.matchAll({ type: "window" }).then((clients) => {
          for (const c of clients) {
            c.postMessage({ type: "SW_ACTIVATED", cache: CACHE });
          }
        }),
      ),
  );
});

/**
 * Navigation: network-first (never serve a stale index that points at old JS).
 * Hashed /assets/*: network-first with cache fallback (hashed names are immutable).
 * Never cache API / auth / websocket endpoints.
 */
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const path = url.pathname;
  if (
    path.startsWith("/api/") ||
    path.startsWith("/auth/") ||
    path.startsWith("/sign-in") ||
    path.startsWith("/sign-up") ||
    path.startsWith("/login")
  ) {
    return;
  }

  // HTML navigations — always prefer network so index.js hash updates stick
  if (req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html")) {
    event.respondWith(
      fetch(req, { cache: "no-store" })
        .then((res) => res)
        .catch(() => caches.match("/index.html").then((r) => r || caches.match("/"))),
    );
    return;
  }

  // Never cache the SW itself
  if (path === "/sw.js") {
    event.respondWith(fetch(req, { cache: "no-store" }));
    return;
  }

  // Hashed Vite assets — network first (new hash = new file; miss old cache)
  if (path.startsWith("/assets/")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req)),
    );
    return;
  }

  // Icons / static images — stale-while-revalidate
  if (
    path.endsWith(".png") ||
    path.endsWith(".svg") ||
    path.endsWith(".jpg") ||
    path.endsWith(".webp") ||
    path.endsWith(".webmanifest") ||
    path.endsWith(".woff2")
  ) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
            }
            return res;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
  }
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING" || event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
