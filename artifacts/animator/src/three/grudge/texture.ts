import * as THREE from "three";
import { assetLoadError, resolveGrudgeAssetCandidates } from "./assetBase";
import { prepTexture } from "../texturePrep";

const textureLoader = new THREE.TextureLoader();
// Required for R2 / CDN atlases when page origin is open.grudge-studio.com / vercel
if (typeof textureLoader.setCrossOrigin === "function") {
  textureLoader.setCrossOrigin("anonymous");
}

/**
 * Load a Toon RTS / grudge6 body-atlas texture across fleet hosts
 * (R2 textures/grudge6 + assets/* + absolute CDN).
 *
 * Contract (grudge6-modular-characters SSOT):
 *   - sRGB colour space
 *   - flipY = **false** (FBX/browse atlas path — not TGALoader default)
 *   - ClampToEdgeWrapping
 *   - mipmaps + anisotropy for mid-distance quality
 *
 * Pass extra logical paths via `extraPaths` (e.g. race textureFallbacks).
 */
export async function loadBodyTexture(
  textureUrl: string,
  extraPaths?: string[],
): Promise<THREE.Texture> {
  const logical = [textureUrl, ...(extraPaths ?? [])];
  // Always try absolute CDN race atlas keys as last-ditch
  const cdnFallbacks = [
    textureUrl.replace(/^\//, "https://assets.grudge-studio.com/"),
    ...(extraPaths || []).map((p) =>
      p.startsWith("http") ? p : `https://assets.grudge-studio.com/${p.replace(/^\//, "")}`,
    ),
  ];
  const candidates: string[] = [];
  for (const p of [...logical, ...cdnFallbacks]) {
    if (!p) continue;
    if (/^([a-z]+:)?\/\//i.test(p)) candidates.push(p);
    else candidates.push(...resolveGrudgeAssetCandidates(p));
  }
  const urls = [...new Set(candidates)];
  let lastErr: unknown;
  for (const url of urls) {
    try {
      // Reject HTML fake-200 from misconfigured CDN keys before decoding as image
      const head = await fetch(url, { method: "HEAD", mode: "cors", cache: "no-store" }).catch(
        () => null,
      );
      if (head) {
        const ct = (head.headers.get("content-type") || "").toLowerCase();
        if (ct.includes("text/html") || !head.ok) {
          lastErr = new Error(`bad content-type ${ct || head.status} ${url}`);
          continue;
        }
      }
      const tex = await textureLoader.loadAsync(url);
      // Three may still decode a tiny error image — require real dimensions
      const img = tex.image as { width?: number; height?: number } | undefined;
      if (img && (img.width ?? 0) < 8) {
        lastErr = new Error(`texture too small ${url}`);
        tex.dispose();
        continue;
      }
      prepTexture(tex, { sRGB: true, mipmaps: true, flipY: false });
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.needsUpdate = true;
      return tex;
    } catch (err) {
      lastErr = err;
    }
  }
  throw assetLoadError(textureUrl, lastErr);
}
