# GRUDOX library → Open in-app + spline VFX

## Design

| Goal | Approach |
| --- | --- |
| Library games stay **in app** | Prefer `nativeModeForZone` → Open engine; else `InAppGameCanvas` embed with SSO |
| Pop-out secondary | “Pop out ↗” only |
| Presentation | `/zones` DataShapeStage — graph nodes + Catmull–Rom ribbons + data GLB |
| Combat VFX | Existing `postprocessing` (`postfx.ts`) + new `graphMath` / `splineVfx` for paths |

## Native upgrades (wired)

| Zone id | In-app path |
| --- | --- |
| brawler | `/brawl` |
| danger | `/danger` |
| survival | `/survival` |
| genesis | `/genesis` |
| voxgrudge | `/world` lab (Full World still canvas/pop) |
| minegrudge | `/realms` |
| characters | `/account` |
| racer / zombie / z-brawl | same-origin `/arcade/play/:id` or production embed |

## Graphing math

`src/three/fx/graphMath.ts` — lerp, smoothstep, cubic Bezier, Catmull–Rom, circle graph layout, pulse.  
`src/three/fx/splineVfx.ts` — TubeGeometry ribbons, spark trails, orbiting **Another shape of data**.

## Asset

| Item | Path |
| --- | --- |
| Local source | `C:\Users\nugye\Documents\another_shape_of_data.glb` |
| R2 / CDN | `models/vfx/another_shape_of_data.glb` |
| Loader key | `DATA_SHAPE_R2_KEY` in splineVfx |

Upload: `node scripts/retry-failed-glb.mjs models/vfx/another_shape_of_data.glb`

## Three.js VFX dependencies (already / preferred)

| Package | Use |
| --- | --- |
| **three** ^0.184 | Curves, TubeGeometry, Points, lights |
| **postprocessing** ^6.39 | Bloom, vignette, grain, ACES (`postfx.ts`) |
| **three-mesh-bvh** | Combat / terrain queries (not hub stage) |
| **yuka** | AI paths (games) |

No extra npm package required for splines — use `THREE.CatmullRomCurve3`.

## Optional next deps (not installed)

| Package | When |
| --- | --- |
| `maath` | Heavier easing/noise helpers |
| `@react-three/postprocessing` | Only if R3F scenes expand |
| `troika-three-text` | High-quality 3D labels on graph nodes |
