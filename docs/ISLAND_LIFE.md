# Island Life — survival RPG island

Minecraft-like survival map for Open Danger Room test worlds.

## Assets

| Role | Source | Staged path |
|------|--------|-------------|
| Island mesh | `D:\Games\Models\island_life.glb` (~451 MB Mineways) | `models/worlds/island_life.glb` (R2; wrangler CLI max **300 MiB** — use S3 multipart / `upload-outdoor-r2.mjs` with R2 keys). Runtime falls back to `sailtest` / `small_island` / `breeze-island` if missing. |
| Ore pack | `minecrafts_trailer_style_ores.glb` | `models/blocks/minecrafts_trailer_style_ores.glb` ✅ |
| Orcs | `Orc_Free.zip` → FBX | `models/enemies/polyart/orcs/*.glb` ✅ |
| Bandits | `Bandits_Free.zip` → FBX | `models/enemies/polyart/bandits/*.glb` ✅ |
| Wildlife | Blockbench / MC voxel only | `models/battle/animals/*` ✅ |

**Hard rule:** no COTW (Call of the Wild) animals in voxel games.

## Convert enemies

```bash
# Unzip already at D:\Games\Models\_extracted\
cd F:\GitHub\gameopen\artifacts\animator
node scripts/convert-fbx-to-glb.mjs --batch-orcs-bandits
```

## Gameplay hooks (Studio)

- **Test world id:** `island-life` (Admin / map switcher)
- **Red mushrooms** (`Red_Mushroom` / `Red_Mushroom_Block` materials) → orc tribe + outlaw camp
- **Raider boat:** every ~3 min, voxel boat unloads 3–5 bandits toward base
- **Blocks:** island ores/logs/stations map to terrain + optional `cat:` codex; trailer ore pack is placeable palette

## Code

- `game/islandLife/catalog.ts` — anchors, units, ores, wildlife
- `three/enemies/CampEnemySystem.spawnIslandMushroomTribes`
- `three/enemies/RaiderBoatSystem`
- `three/testWorlds.ts` → `island-life`
- Catalog: `content/worlds/island-life-deployments.json`

## Stage island mesh

```powershell
# Copy or R2 upload (cross-volume hardlink fails D:→F:)
Copy-Item "D:\Games\Models\island_life.glb" `
  "F:\GitHub\gameopen\artifacts\animator\public\models\worlds\island_life.glb"
# Prefer Draco/meshopt for web
```
