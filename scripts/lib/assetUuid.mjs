/**
 * Deterministic asset UUID (fleet SSOT) — same as RTS-Grudge asset_registry.
 * grudgeUuid = UUID-shaped digest of sha1("grudge-asset:" + r2Key)
 * so re-uploads never orphan references.
 */
import { createHash } from "node:crypto";

/**
 * @param {string} r2Key e.g. models/worlds/sailtest.glb
 * @returns {string} UUID string
 */
export function grudgeUuidFromR2Key(r2Key) {
  const key = String(r2Key || "")
    .replace(/^\/+/, "")
    .replace(/\\/g, "/");
  const buf = createHash("sha1").update(`grudge-asset:${key}`).digest();
  const h = buf.toString("hex");
  // UUID v5-ish layout (version nibble 5, variant 10xx)
  const part3 = `5${h.slice(13, 16)}`;
  const variantNibble = ((parseInt(h.slice(16, 17), 16) & 0x3) | 0x8).toString(16);
  const part4 = `${variantNibble}${h.slice(17, 20)}`;
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${part3}-${part4}-${h.slice(20, 32)}`;
}

export function cdnUrl(r2Key, host = "https://assets.grudge-studio.com") {
  const key = String(r2Key || "").replace(/^\/+/, "");
  return `${host.replace(/\/$/, "")}/${key}`;
}
