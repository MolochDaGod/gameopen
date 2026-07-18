# Ultimate Assassination Grounds — FFA battleground

**Map:** `models/maps/ultimate_assasination_grounds.glb`  
**CDN:** `https://assets.grudge-studio.com/models/maps/ultimate_assasination_grounds.glb`  
**Source:** `C:\Users\nugye\Documents\ultimate_assasination_grounds.glb`  
**Code:** `ArenaMatch` mode `ffa4` · `Studio.startArenaMatch("ffa4")`

## Mode

| Setting | Value |
| --- | --- |
| Players | Up to **4** (1 human + 3 AI explorers) |
| Win | **First to 10 kills** |
| Map | Assassination Grounds GLB |
| AI | Explorer avatars, weapon skills boosted, varied kits |
| Respawn | Auto-respawn AI; player quick-respawns on death |

## AI loadout (default)

| Pad | Fighter | Weapon | Role bias |
| --- | --- | --- | --- |
| West | You | (current) | — |
| North | AI | sword | duelist |
| East | AI | greatsword | bruiser |
| South | AI | gunblade | skirmisher |

Skills fire aggressively (`setArenaSkillBoost(true)` + hard difficulty after countdown).

## How to start

Danger Room → Admin / Systems panel → **Arena Match** →  
**FFA ×4 · Assassination Grounds · First to 10**

Retry / Return same as classic arenas.

## Multiplayer note

Current FFA is **local training** (1 human + AI). Network 4-player FFA can reuse the same mode + kill counters when lobby rooms pass `ffa4` + kill goal.

## Upload

```bash
# Already on R2 as of pipeline run
npx wrangler r2 object put grudge-assets/models/maps/ultimate_assasination_grounds.glb \
  --file=artifacts/animator/public/models/maps/ultimate_assasination_grounds.glb \
  --content-type=model/gltf-binary --remote
```

Do not commit the ~37 MB GLB (`models/maps/*.glb` gitignored).
