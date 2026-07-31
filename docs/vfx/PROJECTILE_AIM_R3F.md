# Directional projectiles — aim, arc, face-on (R3F + imperative)

SSOT math: `artifacts/animator/src/three/fx/projectileAim.ts`  
Open runtime: `Vfx.getsugaSlash` · `castMagicOrbAt` · `flyModelSpline`

## Problem

Slash / Getsuga meshes (ice-bow lineage) are **thin ribbons** (AABB thin≈Y, long≈Z).  
Naïve `lookAt` or a fixed euler often shows the **flat board side** while the projectile skims past the camera — not the crescent face arcing into the target.

## Rules

| Rule | Detail |
|------|--------|
| **Aim** | Prefer **hostile torso** (`selectedHostilePoint`) over free look dir |
| **Arc** | Quadratic Bézier (raised mid + slight lateral) — not a flat ray |
| **Face-on (slashes)** | Thin mesh axis → **travel** so the **curve** faces the target |
| **Edge-lead (spears/orbs)** | Long / +Z axis → travel |
| **Basis** | Local **+Z = forward** (not camera −Z lookAt), +Y ≈ world up |
| **Per-frame** | Re-orient from **path tangent** + soft-home toward aim |

## Dependencies

### Imperative Open / Danger Room (current)

```json
{
  "three": "^0.185.1",
  "@dimforge/rapier3d-compat": "^0.19.3",
  "three-mesh-bvh": "^0.8.3",
  "postprocessing": "^6.39.2"
}
```

No extra npm package for aim/orient — pure `three` math in `projectileAim.ts`.

### R3F games (warcamp, forge, player-and-grass)

```json
{
  "three": "^0.185.1",
  "@react-three/fiber": "^9.6.1",
  "@react-three/drei": "^10.7.7",
  "@react-three/rapier": "^2.2.0",
  "zustand": "^5.0.0"
}
```

| Package | Projectile role |
|---------|-----------------|
| `three` | Curves, quaternions, basis |
| `@react-three/fiber` | `useFrame` for tangent orient + soft-home |
| `@react-three/drei` | `useGLTF` for slash/orb templates (clone, never mutate cache) |
| `@react-three/rapier` | Optional sensor sphere on projectile for hit (not for orient) |
| **Ban** | Driving play camera with Orbit while TPS owns combat aim |

Fleet package SSOT: skill **`grudge-3d-game-packages`**.

## Imperative usage (Open)

```ts
// Studio — always pass aim from lock/soft target
const lockPt = this.targets?.selectedHostilePoint?.();
const aimPt = lockPt
  ? lockPt.clone().setY(lockPt.y + 0.2)
  : muzzle.clone().addScaledVector(dir, range);

this.vfx.getsugaSlash(muzzle, projDir, {
  aim: aimPt,
  variant: "slashblue",
  arcHeightFrac: 0.16,
  arcLateral: 0.35,
  // …
});
```

Staff orbs:

```ts
this.vfx.castMagicOrbAt("orbFire", from, to, color, onHit);
// → flyModelSpline arc + +Z basis
```

## R3F pattern (best practice)

```tsx
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import {
  makeArcCurve,
  measureMeshAxes,
  orientProjectile,
} from "./fx/projectileAim"; // or @grudge-studio slice when published

function GetsugaSlash({
  from,
  aim,
  speed = 15,
  onHit,
}: {
  from: THREE.Vector3;
  aim: THREE.Vector3;
  speed?: number;
  onHit?: (p: THREE.Vector3) => void;
}) {
  const root = useRef<THREE.Group>(null);
  const { scene } = useGLTF("/models/vfx/slash/slashblue.glb");
  const mesh = useMemo(() => {
    const c = scene.clone(true);
    // SI fit once
    const box = new THREE.Box3().setFromObject(c);
    const size = box.getSize(new THREE.Vector3());
    const s = 2.2 / Math.max(size.x, size.y, size.z, 1e-4);
    c.scale.multiplyScalar(s);
    return c;
  }, [scene]);
  const axes = useMemo(() => measureMeshAxes(mesh), [mesh]);
  const curve = useMemo(
    () => makeArcCurve(from, aim, { heightFrac: 0.16, lateral: 0.35 }),
    [from, aim],
  );
  const life = useMemo(() => from.distanceTo(aim) / speed, [from, aim, speed]);
  const age = useRef(0);
  const tangent = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, dt) => {
    const g = root.current;
    if (!g) return;
    age.current += dt;
    const u = Math.min(1, age.current / life);
    curve.getPoint(u, g.position);
    curve.getTangent(u, tangent);
    orientProjectile(g, g.position, tangent, {
      faceMode: "faceOn",
      localThin: axes.thin,
      localMid: axes.mid,
      localLong: axes.long,
    });
    if (u >= 1) onHit?.(g.position.clone());
  });

  return (
    <group ref={root}>
      <primitive object={mesh} />
    </group>
  );
}
```

### R3F do / don't

| Do | Don't |
|----|--------|
| Clone `useGLTF` scene per projectile | Mutate cached GLTF scene rotation/scale |
| Orient in `useFrame` from **tangent** | Set rotation once at spawn only |
| Aim from combat targeting SSOT | Free mouse ray without soft-lock option |
| Dispose / unmount on impact | Leak mixers/materials |
| One play camera writer | OrbitControls fighting aim |

## Face modes

| Mode | When |
|------|------|
| `faceOn` | Getsuga, crescent slash, energy discs |
| `edgeLead` | Spear, javelin, laser bolt mesh |
| `lookAt` | Legacy / camera-aligned billboards only |

## Verify

```bash
cd artifacts/animator
npx vitest run src/three/fx/projectileAim.test.ts
```

In play: lock a hostile → fire slash skill → crescent should **arc into the torso** and read as a **curve facing the target**, not a flat plank.
