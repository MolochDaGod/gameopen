# Production slash projectile bakes

Open production paths (same-origin `public/` → fleet CDN candidates):

| Variant id   | Path                              | Shader pattern |
|--------------|-----------------------------------|----------------|
| slashred     | `models/vfx/slash/slashred.glb`   | fireRise       |
| slashblue    | `models/vfx/slash/slashblue.glb`  | iceSwirl       |
| slashpurple  | `models/vfx/slash/slashpurple.glb`| arcanePulse    |
| slashyellow  | `models/vfx/slash/slashyellow.glb`| holyShimmer    |

**Shipped production names** (optimized meshopt/webp ice-bow source):

- `slashred.glb` / `slashblue.glb` / `slashpurple.glb` / `slashyellow.glb`

Runtime always prefers these paths. Energy shader (`createSlashEnergyMaterial`)
tints + patterns per variant. Orientation: crescent face-on toward aim target
(local +Z = flight, vertical curve plane).

SSOT: `src/three/fx/slashProjectileVariants.ts`  
Combat: mid/finisher melee + Alt+Space Getsuga.
