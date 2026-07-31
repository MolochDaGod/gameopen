# Fleet ARPG / Three.js stack (Open pointer)

**Canonical full document:**  
[`survival` repo → `docs/FLEET_ARPG_STACK.md`](https://github.com/MolochDaGod/survival/blob/main/docs/FLEET_ARPG_STACK.md)  
(local: `F:\GitHub\survival\docs\FLEET_ARPG_STACK.md`)

**Live ARPG:** https://deploy-survival.vercel.app/arpg-game/  
**Open sandbox:** https://open.grudge-studio.com/

## Why Open cares

Open (dressing room, lobby, combat sandbox) must follow the same laws as the survival ARPG:

| Law | Open implication |
|-----|------------------|
| Ship or CDN every clip the mixer needs | `.vercelignore` must allowlist `public/anim/**` (T-pose fix) |
| Labels match resolved motion | Animations tab uses `previewClipLabel` |
| SI 1.8 m + ground | Explorer / grudge6 fit + snap |
| GLTF Draco/Meshopt | Shared loaders; no raw FBX as only path on prod |
| One play camera writer | Studio / controller ownership |
| Multi-host asset resolve | `fleetAssetResolver` + dead URL cache |

## Reference demos (patterns, not drop-in)

- [RPG Fantasy](https://threejs-games.github.io/examples/80-scenes/rpg-fantasy/) — lazy AI import, goals UI, putOnSolids  
- [Zeppelin](https://threejs-games.github.io/examples/80-scenes/zeppelin/) — vehicle camera, large map, updatables  
- [Graveyard Survival](https://threejs-games.github.io/examples/80-scenes/graveyard-survival/) — wave spawn, timer win, particles  

## Package gate (minimum)

See skill **`grudge-3d-game-packages`**: three ~0.185, Rapier, CDN assets, Grudge ID, SI controller, single TPS camera.

## After deploy smoke

```text
/dressing  → idle not T-pose; Animations tab labels match motion
/lobby     → 4-char campfire
/anim/base/animated-base-character.glb → non-HTML 200
```

Full upgrade roadmap, asset pipeline, and Three.js reliability checklist live in the **survival** doc above.
