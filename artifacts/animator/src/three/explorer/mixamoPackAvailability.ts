/**
 * Mixamo FBX pack gate.
 *
 * Arcade / Danger **runtime** must not call FBXLoader even if `public/anim/**/*.fbx`
 * is on disk (~179 MB, 808 files). Use baked `/anims/baked/*.json` + base GLB.
 * Dressing Room / Anim Editor pass `allowFbx: true`.
 *
 * Probe **once** (same-origin HEAD only). When missing, all Mixamo clip loads
 * short-circuit with no network.
 */

let state: "unknown" | "present" | "missing" = "unknown";
let probe: Promise<boolean> | null = null;

/** Canonical probe file (skeleton source / universal loco). */
export const MIXAMO_PROBE_REL = "anim/animations/bow/unarmed-idle-01.fbx";

/** True for Explorer Mixamo clip paths (not grudge6 race FBX / base GLB). */
export function isMixamoClipPath(path: string): boolean {
  const p = String(path || "")
    .replace(/^\//, "")
    .replace(/\\/g, "/");
  if (p.startsWith("anim/animations/") || p.startsWith("animations/")) return true;
  // Short public layout: anim/bow/*, anim/sword/*, … (not anim/base)
  if (p.startsWith("anim/") && !p.startsWith("anim/base/")) return true;
  return false;
}

export function markMixamoPackMissing(): void {
  state = "missing";
}

export function markMixamoPackPresent(): void {
  state = "present";
}

/** Sync: null if not probed yet. */
export function mixamoPackKnownPresent(): boolean | null {
  if (state === "present") return true;
  if (state === "missing") return false;
  return null;
}

/**
 * One-shot availability. Same-origin only (no R2/CORS fan-out).
 * Production SPA may return HTML 200 — treat non-binary as missing.
 */
export async function isMixamoFbxPackAvailable(): Promise<boolean> {
  if (state === "present") return true;
  if (state === "missing") return false;
  if (probe) return probe;

  probe = (async () => {
    // Same-origin only (pack is either under public/anim after deploy, or absent).
    // Prefer short layout first — production ships public/anim/bow/* not nested
    // anim/animations/bow/* (both exist locally; Vercel allowlist covers both).
    const candidates = [
      `/${MIXAMO_PROBE_REL.replace("anim/animations/", "anim/")}`,
      `/${MIXAMO_PROBE_REL}`,
      // Range GET fallback: some hosts lie on HEAD or omit Content-Type for .fbx
      { url: `/${MIXAMO_PROBE_REL.replace("anim/animations/", "anim/")}`, get: true as const },
    ];
    for (const c of candidates) {
      const url = typeof c === "string" ? c : c.url;
      const useGet = typeof c !== "string" && c.get;
      try {
        const ctrl = new AbortController();
        const t = window.setTimeout(() => ctrl.abort(), 2500);
        const r = await fetch(url, {
          method: useGet ? "GET" : "HEAD",
          signal: ctrl.signal,
          cache: "force-cache",
          headers: useGet ? { Range: "bytes=0-15" } : undefined,
        });
        window.clearTimeout(t);
        if (!r.ok && r.status !== 206) continue;
        const ct = (r.headers.get("content-type") || "").toLowerCase();
        if (ct.includes("text/html") || ct.includes("text/plain")) continue;
        // FBX is often application/octet-stream / empty CT on static hosts
        if (useGet) {
          const buf = await r.arrayBuffer();
          // Kaydara FBX binary magic or ASCII "Kaydara FBX"
          const u8 = new Uint8Array(buf);
          const head = String.fromCharCode(...u8.slice(0, 12));
          if (!head.includes("Kaydara") && !(u8[0] === 0x4b && u8[1] === 0x61)) {
            // Still accept if body is clearly non-HTML binary
            if (u8.length < 4 || u8[0] === 0x3c /* < */) continue;
          }
        }
        state = "present";
        return true;
      } catch {
        /* try next */
      }
    }
    state = "missing";
    return false;
  })();

  return probe;
}
