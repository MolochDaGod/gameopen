import * as THREE from "three";

/**
 * Unity / Voxel author GLB+FBX often bake Windows absolute texture URIs
 * (`D:/VoxelAssets/.../DungeonCrawler_Character.png`). GLTFLoader / FBXLoader
 * then concatenate them onto the clip directory, producing:
 *   anim/animations/reactions/D:/VoxelAssets/...png  → 404 spam
 *
 * Clips are bones-only for retarget; author albedo is unused. Rewrite to a
 * 1×1 pixel so loaders do not hit the network.
 */
const EMPTY_TEX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const WIN_DRIVE = /(?:^|[/?#]|[/\\])([A-Za-z]:[/\\][^?#]*)/;

export function rewriteAuthorResourceUrl(url: string): string {
  if (!url || url.startsWith("data:") || url.startsWith("blob:")) return url;
  let decoded = url;
  try {
    decoded = decodeURIComponent(url);
  } catch {
    /* keep raw */
  }
  if (WIN_DRIVE.test(decoded) || /^[A-Za-z]:[/\\]/.test(decoded)) {
    return EMPTY_TEX;
  }
  return url;
}

let installed = false;

/** Install once on the shared + default LoadingManagers. */
export function installAuthorUrlGuard(manager?: THREE.LoadingManager): void {
  const apply = (m: THREE.LoadingManager) => {
    m.setURLModifier(rewriteAuthorResourceUrl);
  };
  if (manager) apply(manager);
  if (installed) return;
  installed = true;
  apply(THREE.DefaultLoadingManager);
}
