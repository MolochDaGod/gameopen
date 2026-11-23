import { assetUrl } from "./fleet";

/**
 * Poster keys with no file on assets.grudge-studio.com and none in
 * artifacts/animator/public/rooms/. Do not request them — show the missing marker.
 *
 * Probed 2026-11-23 CT: /rooms/racing-scene.png 404 on open.grudge-studio.com;
 * racing-scene.png/.jpg 404 on the CDN root and /gameopen/rooms/.
 */
export const ROOM_POSTERS_WITHOUT_CDN: ReadonlySet<string> = new Set(["racing"]);

/** Absolute poster URL, or null when the key has no CDN or repo copy. */
export function roomPosterSrc(name: string): string | null {
  const key = name.trim().replace(/^\/+|\/+$/g, "");
  if (!key || ROOM_POSTERS_WITHOUT_CDN.has(key)) return null;
  return assetUrl(`rooms/${key}-scene.png`);
}
