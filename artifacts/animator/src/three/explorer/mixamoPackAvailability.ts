/**
 * Mixamo FBX pack gate — production Open excludes **\/*.fbx via .vercelignore
 * and R2 does not host `/anim/animations/*`. Without a gate, Explorer
 * `loadClips(allReferencedClipIds())` fires hundreds of multi-host 404s.
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
    const candidates = [
      `/${MIXAMO_PROBE_REL}`,
      `/${MIXAMO_PROBE_REL.replace("anim/animations/", "anim/")}`,
    ];
    for (const url of candidates) {
      try {
        const ctrl = new AbortController();
        const t = window.setTimeout(() => ctrl.abort(), 2500);
        const r = await fetch(url, {
          method: "HEAD",
          signal: ctrl.signal,
          cache: "force-cache",
        });
        window.clearTimeout(t);
        if (!r.ok) continue;
        const ct = (r.headers.get("content-type") || "").toLowerCase();
        if (ct.includes("text/html") || ct.includes("text/plain")) continue;
        // FBX is often application/octet-stream
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
