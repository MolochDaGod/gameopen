# Asset production pipeline — scale, purpose, convert, Draco, AI

**SSOT convert CLI:** `ObjectStore/tools/grudge-convert` (`@grudge-studio/asset-convert`)  
**Open orchestrator:** `scripts/asset-pipeline/`  
**Runtime loaders:** `artifacts/animator/src/three/loaders/gltf.ts` (Draco + Meshopt + KTX2)

This document is the **development process** for shipping maps, weapons, characters, NPCs, textures, and anim banks into Open / Danger Room with correct scale, purpose, and AI/game-flow readiness.

---

## Order of operations (never reverse)

```
1. IDENTIFY purpose     → maps | weapons | characters | npcs | props | vfx | textures | anims
2. DCC cleanup          → skeletons, clip names, apply scale, purge orphans (Blender MCP optional)
3. CONVERT + SCALE BAKE → --cm-to-m / --height 1.7 / y-hip ground into mesh positions
4. VERIFY scale + AI    → green / yellow / red report
5. COMPRESS LAST        → --draco (and meshopt/quantize) only after scale + skins + anims OK
6. REGISTER             → CDN path, content JSON, weapon roles, AI profiles
7. SMOKE                → Danger Room load + hand mount + AI hostile equip
```

**Why Draco last:** compressing before scale bake freezes wrong units into the mesh and makes skeleton/anim repairs expensive. Always bake scale + clip integrity first.

---

## Purpose → convert flags

| Purpose | Convert flags | Colliders | Draco | AI contract |
|---------|---------------|-----------|-------|-------------|
| **character** | `--height 1.7 --cm-to-m` (no flatten) | capsule r≈0.35 | yes last | idle/walk/run/attack/hurt/death + hand bones |
| **npc** | same as character | capsule | yes last | idle/walk/attack/hurt/death |
| **weapon** | **no** height normalize | optional small box | yes last | hand-scale mesh only |
| **map** | author meters, y-hip ground | box / navmesh | yes last | walkable extent, grounded |
| **prop** | flatten OK | box | yes last | cover / interactable |
| **animation** | cm→m, no colliders, preserve names | none | after retarget | clip name stability |
| **texture** | WebP ≤1024; flipY=false grudge6 | n/a | n/a | material bind |
| **vfx** | small texture, optional anims | none | yes last | FX only |

Full classifier: `scripts/asset-pipeline/lib/purpose.mjs`.

---

## CLI (from gameopen root)

```bash
# Doctor convert backends (ObjectStore)
node scripts/asset-pipeline/convert.mjs doctor

# Classify everything under public/
npm run assets:classify
# → reports/asset-purpose.json (optional --out)

# Scale + AI clip verification (GLBs)
npm run assets:verify-scale
# → exit 1 if any red

# Full report + convert recipes
npm run assets:pipeline
# → reports/asset-pipeline-report.json
# → reports/asset-convert-recipes.md

# Convert one file (purpose auto or forced)
node scripts/asset-pipeline/convert.mjs raw/hero.fbx -o dist/production-assets/character/hero.glb --purpose character
node scripts/asset-pipeline/convert.mjs models/weapons/sword.glb -o dist/production-assets/weapon/sword.glb --purpose weapon

# Dry-run flags only
node scripts/asset-pipeline/convert.mjs in.glb -o out.glb --purpose character --dry-run

# Batch a folder
node scripts/asset-pipeline/convert.mjs batch ./raw -o ./dist/production-assets

# Re-bake only RED scale failures from last report
npm run assets:pipeline -- --convert-red
```

**Direct grudge-convert** (same flags; orchestrator wraps this):

```bash
cd F:\GitHub\ObjectStore
npm run convert:doctor
npm run convert -- fbx2gltf path/WK.fbx -o dist/WK.glb --height 1.7 --cm-to-m --texture atlas.webp --draco
npm run convert -- glb2glb model.glb -o dist/model.prod.glb --height 1.7 --draco
npm run convert -- inspect dist/WK.glb
```

---

## Scale verification bands

| Purpose | Pass | Fail |
|---------|------|------|
| character/npc height | 1.45–2.0 m soft, 0.8–2.6 hard | >50 units (likely cm) |
| ground | minY ≈ 0 | \|minY\| > 0.15 warn |
| weapon max dim | 0.05–5 m | >5 m (wrong purpose or scale) |
| map max dim | ≥4 m warn soft | — |

Scores: **green** / **yellow** / **red** — same idea as character-fleet-audit.

---

## Model importers (runtime)

| Loader | Path | Notes |
|--------|------|-------|
| **GLB production** | `loaders/gltf.ts` → `sharedGltfLoader()` | Draco + Meshopt + KTX2 |
| **grudge6 races** | `grudge6Runtime` + fleet CDN | FBX lab OK; production prefers GLB + atlas rebind |
| **Weapons** | `Weapons.ts` mountWeaponModel | hand grip from arsenal, tip for muzzle |
| **Textures** | race atlases | `flipY = false`, sRGB |
| **Anim banks** | retarget / baked JSON | preserve clip names for AnimationDirector |

Never ship raw multi-MB FBX as the only production path for web heroes when a GLB pack exists.

---

## AI brains & game flow

Assets are not just visuals — they feed **FighterBrain**, weapon roles, and combat CDs:

| Asset | Feeds |
|-------|--------|
| Character GLB + clips | locomotion blend, attack one-shots, hurt/death |
| Weapon mesh + `WeaponId` | `weaponRole()`, range, combo max, cast kind |
| NPC prefab | `WEAPON_COMBAT` + anim pack + aggro |
| Map | nav / cover / spawn volumes |
| VFX GLB | skill telegraph / impact only |

**Required clip roles** (characters) before marking production:

- `idle`, `walk` or run locomotion, `attack` (or weapon pack attacks), `hurt`, `death`

**Hand sockets** (modular grudge6):

- Prefer `R_hand_container` / `L_hand_container`, else `Bip001_R_Hand`

**Do not:**

- Height-normalize weapons to 1.7 m  
- Flatten skinned character hierarchies  
- Run Draco before `--cm-to-m` / `--height`  
- Register a map as a prop or a weapon as a character  

---

## CDN / registry

After convert:

1. Upload GLB + `.collider.json` + `.manifest.json` + `.purpose.json` to R2  
2. CDN: `https://assets.grudge-studio.com/...`  
3. Smoke: `npm run verify:assets:cdn`  
4. Content: weapons/skills JSON under `content/` when equipping new types  

See `docs/FLEET_ASSET_DEPLOYMENT.md`.

---

## Related skills

| Skill | Role |
|-------|------|
| `grudge-asset-convert` | Operational convert process |
| `gltf-asset-pipeline` | glTF-Transform / Khronos depth |
| `grudge-warlords-assets` | CDN / D1 SSOT rules |
| `grudge6-modular-characters` | Bip001 / mesh_ids |
| `grudge6-combat-runtime` | anim packs + gait |
| `character-fleet-audit` | fleet red/yellow/green characters |

---

## Quick checklist (agent)

```
[ ] classify purpose (not "unknown" for ship)
[ ] convert doctor green
[ ] scale bake flags correct for purpose
[ ] verify-scale green (or yellow with ticket)
[ ] AI clips / hands present for characters & NPCs
[ ] Draco last
[ ] collider.json for characters
[ ] CDN + runtime smoke
```
