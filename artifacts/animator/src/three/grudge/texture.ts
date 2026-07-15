import * as THREE from "three";
import { assetLoadError, resolveGrudgeAssetCandidates } from "./assetBase";

const textureLoader = new THREE.TextureLoader();

// Load a body-atlas texture across fleet hosts (R2 textures/grudge6 + assets/*).
// The atlas is a lossless `.webp`; we set sRGB colour space and keep `flipY = true`
// (the FBX UVs were authored for TGALoader's flipped orientation).
// Pass extra logical paths via `extraPaths` (e.g. race textureFallbacks).
export async function loadBodyTexture(
  textureUrl: string,
  extraPaths?: string[],
): Promise<THREE.Texture> {
  const logical = [textureUrl, ...(extraPaths ?? [])];
  const candidates: string[] = [];
  for (const p of logical) {
    if (/^([a-z]+:)?\/\//i.test(p)) candidates.push(p);
    else candidates.push(...resolveGrudgeAssetCandidates(p));
  }
  const urls = [...new Set(candidates)];
  let lastErr: unknown;
  for (const url of urls) {
    try {
      const tex = await textureLoader.loadAsync(url);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.flipY = true;
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      tex.needsUpdate = true;
      return tex;
    } catch (err) {
      lastErr = err;
    }
  }
  throw assetLoadError(textureUrl, lastErr);
}
