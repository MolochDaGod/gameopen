# Warlords-era DRC + grudge6 audit

**Date:** 2026-08-02  
**Scope:** Loaders, assets, deploy systems for Warlords-era games (Open catalog `category: warlords` + fleet hosts).

**Law:** Unity **RTS_TOON / grudge6** mesh+equip · **Bip001 baked** packs from Open · DRC L0–L4 · never live Mixamo on grudge6.

Code matrix: `artifacts/animator/src/lib/drcSurfaceContract.ts` → `WARLORDS_ERA_FLEET`  
Full system: [`GRUDGE6_DRC_COMPLETE_SYSTEM.md`](GRUDGE6_DRC_COMPLETE_SYSTEM.md)

---

## Asset SSOT (all Warlords-era 3D)

| Layer | Host / path | HEAD (2026-08-02) |
|-------|-------------|-------------------|
| Race kits GLB | `assets…/models/grudge6/races/{WK\|BRB\|ELF\|DWF\|ORC\|UD}_Characters.glb` | **200** all 6 |
| Race atlas | `assets…/textures/grudge6/{folder}/*.webp` | **200** (WK Standard) |
| Baked anims | `open.grudge-studio.com/anims/baked/*` | **200** run_forward + samurai |
| Baked alias | `gameopen.vercel.app/anims/baked/*` | **200** |
| R2 `prod/anims` | `assets…/prod/anims/*` | **404** — do not primary |
| Arena `/anims/baked` | grudge-arena host | **404** — use Open packs |
| Pirate lobby mesh | `assets…/models/lobby/pirate-islands/scene.glb` | **200** |
| Bermuda map | `assets…/models/maps/bermuda.glb` | **200** |
| HUD | `ui.grudge-studio.com` | **200** |

**Forbidden primaries:** Meshy/capsule heroes · live Mixamo FBX on Bip001 · `sword_shield/sword and shield run` · `locomotion/running` as run · arena CDN as race-kit SSOT · Explorer product for pirate lobby.

---

## Host matrix

| Host | Mesh | Anim | Loader | Status |
|------|------|------|--------|--------|
| **Open Danger** (+ forest/maps) | grudge6 R2 | Open Bip001 | `GrudgeAvatar` / `grudge6Runtime` / `anims.ts` | **green** |
| **Multiverse** | grudge6 R2 | Open Bip001 | `grudge6Loader` + `grudge6SSOT` + `animPackLoader` | **green** (packs aligned 2026-08) |
| **Grudge Arena** | grudge6 via `/api/assets` | local Bip001 bakes | `createBakedGrudge6Unit` | **green** |
| **Hero Command** | grudge6 R2 | partial | `grudge6RaceAssets` | **partial** |
| **Warlords client** | RACE_GRUDGE6 CDN | mixed | `SharedGltfPipeline` + equip | **partial** |
| **Pirate islands** | lobby GLB + grudge6 heroes | via client | island-3d | **in-game only** |
| **Warlord Genesis** | mixed | **Mixamo** | mixamorig Animator | **legacy gap** |
| **RTS-Grudge** | mixed | mixed | Forge shell | **partial** |
| **Foundry** | grudge6 | n/a (create) | handoff to client | **tools** |

---

## Loaders (correct pattern)

```
1. GLTF/DRACO/Meshopt shared pipeline (not one-off GLTFLoader without decoders)
2. Race kit: assets.grudge-studio.com/models/grudge6/races/{PREFIX}_Characters.glb
3. Equip: mesh_ids visibility only (SkeletonUtils clone)
4. characterDeploy / fit 1.8 m SI, feet ground, face convention
5. Anims: open…/anims/baked/{pack}/{clip}.json  (rotation-only, strip position)
6. 1H sword: greatsword_samurai/*_sword  (NOT thin sword_shield run)
7. Sprint: clone pack run × 1.75 — never banned loco/running
8. Input: epicfight FLEET_COMBAT_INPUT when combat
9. HUD: ui.grudge-studio.com / CraftPix where MMO
```

---

## Deploy systems

| Product | Deploy | Gate |
|---------|--------|------|
| Open | `npm run deploy:prod` (gate + Vercel) | `open-deploy-gate.mjs` — grudge6 kit, atlas, baked run+samurai, SPA, UI, client, pirate mesh |
| Multiverse | Vercel + Railway rooms | Mesh/anims via Open SSOT |
| Arena | Vercel + `/cdn` + `/api/assets` | grudge6AssetUrl → R2 |
| Warlords client | GrudgeBuilder Vercel | assets.grudge-studio.com + same-origin `/api/assets` |
| Hero RTS | hero-rts Vercel | verifyGrudge6RacesOnCdn on boot |

---

## Gaps (priority)

1. **Warlord Genesis** — Mixamo combat still primary; migrate to grudge6 + Bip001 baked (same as Open Danger).
2. **Warlords client island3d** — `modelLoader` Mixamo remap remains for some characters; production heroes should use grudge6 + Bip001 packs.
3. **Hero Command** — race kits good; full DRC weapon-skill layer incomplete vs Open.
4. **Multiverse** — was on banned sword_shield run; **fixed** to samurai primary + Open-first hosts (redeploy Multiverse to ship).

---

## Unit tests

```bash
cd artifacts/animator
npx vitest run src/lib/drcSurfaceContract.test.ts src/three/grudge/anims.loco.test.ts src/game/gameLibrary.warlords.test.ts
```
