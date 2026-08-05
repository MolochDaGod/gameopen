/* Grudge Open — installable app shell service worker
 *
 * v3: every respondWith path MUST resolve to a real Response.
 *     v2 returned `undefined` when cache misses → browser:
 *       "Failed to convert value to 'Response'" / FetchEvent network error.
 * v4 (2026-08): drop historical shell caches; NEVER cache 3D binaries
 *     (glb/fbx/bin/hdr/ktx2/draco) or /models|/textures|/anims|/audio.
 *     Stale mesh shells caused SI stretch / wrong kits after fleet CDN fixes.
 *
 * Strategy:
 *  - Navigations: network-only (no stale index.html pinning old Vite hashes)
 *  - /assets/*: network-first; cache hit only as offline fallback (JS/CSS only)
 *  - Icons: stale-while-revalidate with guaranteed Response fallback
 *  - Never intercept API/auth; never cache production meshes (CDN SSOT)
 */
const CACHE = "grudge-open-shell-v4";
const CACHE_VERSION = 4;
const PRECACHE = [
  "/manifest.webmanifest",
  "/favicon.svg",
  "/logo.svg",
  "/pwa-192.png",
  "/pwa-512.png",
  "/apple-touch-icon.png",
];

/** Paths that must always hit network / CDN — never Cache API (stretch / mismatch). */
function isHeavyAssetPath(path) {
  if (
    path.startsWith("/models/") ||
    path.startsWith("/textures/") ||
    path.startsWith("/anims/") ||
    path.startsWith("/audio/") ||
    path.startsWith("/cdn/") ||
    path.startsWith("/gameopen/models/")
  ) {
    return true;
  }
  return /\.(glb|gltf|fbx|bin|hdr|exr|ktx2|basis|wasm|mp3|ogg|wav|webm|mp4)(\?|$)/i.test(
    path,
  );
}

/** Always a valid Response — never undefined/null. */
function offlineResponse(status = 503, body = "Offline") {
  return new Response(body, {
    status,
    statusText: status === 503 ? "Service Unavailable" : "OK",
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function asResponse(value) {
  return value instanceof Response ? value : offlineResponse();
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        // addAll fails entirely if one URL 404s — use individual puts
        Promise.all(
          PRECACHE.map((url) =>
            fetch(url, { cache: "no-store" })
              .then((res) => (res.ok ? cache.put(url, res) : undefined))
              .catch(() => undefined),
          ),
        ),
      )
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim())
      .then(() =>
        self.clients.matchAll({ type: "window" }).then((clients) => {
          for (const c of clients) {
            c.postMessage({
              type: "SW_ACTIVATED",
              cache: CACHE,
              version: CACHE_VERSION,
            });
          }
        }),
      ),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  const path = url.pathname;
  if (
    path.startsWith("/api/") ||
    path.startsWith("/auth/") ||
    path.startsWith("/sign-in") ||
    path.startsWith("/sign-up") ||
    path.startsWith("/login") ||
    path.startsWith("/sso")
  ) {
    return; // default browser fetch — never break auth
  }

  // 3D / audio / baked anims — network only (R2 rewrite or CDN). Caching these
  // freezes wrong-scale kits and wastes RAM in Chromium's disk/memory cache.
  if (isHeavyAssetPath(path)) {
    event.respondWith(
      fetch(req, { cache: "no-store" })
        .then((res) => asResponse(res))
        .catch(() => offlineResponse(503, "asset offline")),
    );
    return;
  }

  // HTML navigations — network only so new deploys stick (no cached index)
  if (req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html")) {
    event.respondWith(
      fetch(req, { cache: "no-store" })
        .then((res) => asResponse(res))
        .catch(async () => {
          const cached =
            (await caches.match("/index.html")) ||
            (await caches.match("/")) ||
            (await caches.match(req));
          return asResponse(cached);
        }),
    );
    return;
  }

  // Never cache the SW itself
  if (path === "/sw.js") {
    event.respondWith(
      fetch(req, { cache: "no-store" })
        .then((res) => asResponse(res))
        .catch(() => offlineResponse(503, "sw.js offline")),
    );
    return;
  }

  // Hashed Vite assets — network first
  if (path.startsWith("/assets/")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return asResponse(res);
        })
        .catch(async () => asResponse(await caches.match(req))),
    );
    return;
  }

  // Icons / static — stale-while-revalidate
  if (
    path.endsWith(".png") ||
    path.endsWith(".svg") ||
    path.endsWith(".jpg") ||
    path.endsWith(".jpeg") ||
    path.endsWith(".webp") ||
    path.endsWith(".webmanifest") ||
    path.endsWith(".woff2") ||
    path.endsWith(".ico")
  ) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        const networkPromise = fetch(req)
          .then((res) => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
            }
            return res;
          })
          .catch(() => null);

        if (cached) {
          // update cache in background; return cache immediately
          networkPromise.catch(() => {});
          return cached;
        }
        const network = await networkPromise;
        return asResponse(network);
      })(),
    );
  }
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (data === "SKIP_WAITING" || data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  // Recovery: page can ask SW to nuke caches + unregister
  if (data === "NUKE" || data?.type === "NUKE") {
    event.waitUntil(
      caches
        .keys()
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .then(() => self.registration.unregister())
        .then(() =>
          self.clients.matchAll({ type: "window" }).then((clients) => {
            for (const c of clients) c.postMessage({ type: "SW_NUKED" });
          }),
        ),
    );
  }
});
