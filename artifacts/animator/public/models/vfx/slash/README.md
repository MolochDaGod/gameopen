# Production slash projectile bakes

Open production paths (same-origin `public/` → fleet CDN candidates):

| Variant id   | Path                              | Shader pattern |
|--------------|-----------------------------------|----------------|
| slashred     | `models/vfx/slash/slashred.glb`   | fireRise       |
| slashblue    | `models/vfx/slash/slashblue.glb`  | iceSwirl       |
| slashpurple  | `models/vfx/slash/slashpurple.glb`| arcanePulse    |
| slashyellow  | `models/vfx/slash/slashyellow.glb`| holyShimmer    |

**Shared fallback (shipped):** `models/vfx/stylized_ice_bow.glb`  
Runtime applies `createSlashEnergyMaterial` per variant so one mesh serves all
four colors until per-variant bakes land.

SSOT catalog: `src/three/fx/slashProjectileVariants.ts`  
Combat hotkeys: Alt+Space Getsuga (`vfxSandboxHotkeys.ts`).

When baking production meshes, keep SI scale ~2 m arc length and UVs continuous
for the energy flow shader.
