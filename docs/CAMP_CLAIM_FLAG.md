# Camp Claim Flag hub

## What it is

Planting the **claim flag** (Pirate Claim Flag / territory marker) grants **build rights** in a radius for camp structures. The flag UI is the territory management hub.

## Pages

| Page | Role |
|------|------|
| **Camp Skills** | Account/camp skills (logistics, fortify, muster, husbandry, drill) |
| **Farming** | Farm plots, wheat, windmill, market (Ultimate Fantasy RTS farm line) |
| **Taming** | Creature pens / bond stable — profession XP carries to hero convert |
| **Defensives** | Walls, wall towers, gates, watchtowers |
| **Units** | RTS units from production buildings |
| **Buildings** | Claim-gated stations + RTS halls; lists quick-craft as **excluded** |
| **Upgrades** | Structure levels + `nodeUpgrades.json` tracks |

## Build rights vs quick-craft

**Claim-gated (flag required):** barracks, archery, temple, stables, walls, stations, storage, farms, pens.

**Not claim-gated (always field-placeable):** campfire, sleeping bag / bedroll, torch, camp cookpot, field tarp, other tier-0 utility quick kits.

## Units → hero convert

1. Units train from **RTS production buildings** (barracks / archery / temple / stable).
2. Unit level **1–100** (combat + drill XP).
3. At **level 100**, convert to a **level 1 hero**.
4. Converted heroes may only equip **T0** gear (`heroEquipMaxTier: 0`).
5. **Profession levels** earned as a unit **carry over** to the hero variant.

Catalogs: `factionUnits.json`, `nodeUpgrades.json`, `rtsModels.json`, `master-buildings.json`, `camp-claim-flag.json`.

Assets: Toon RTS Standard Units + uMMORPG / GenesisGrudge reference; Ultimate Fantasy RTS FBX (Barracks, Archery, Farm, Wall, WatchTower, …).

## Open controls

- **B** — toggle Camp claim flag hub (Danger Room + Play)
- Top bar **Camp** button
- Esc closes
- **Q** → Build mode · LMB place / commit ghost · **R** rotate ghost · Esc cancel ghost
- Camp UI **Place ghost** buttons call `Studio.beginPlacePlaceable`

## Converted claim flag mesh

| Step | Path |
|------|------|
| Source FBX | `public/models/pirate/Decor_PirateFlag_00.fbx` |
| Production GLB | `public/models/camp/claim-flag.glb` |
| Convert | `grudge-convert fbx2glb … --texture-size 1024 --no-colliders` |
| Placeable id | `claim_flag` |

Sandbox Danger Room auto-plants a claim at `(0,0,-6)` so gated ghosts validate.

## Unit mesh bind (uMMORPG prefabs)

| Layer | Source |
|-------|--------|
| RTS defs | `factionUnits.json` |
| Mesh kit | grudge6 Toon RTS race + gear preset (`unitMeshBind.ts`) |
| Prefabs | `warlordsRoles` + `prefabProfile` EntityPrefab |
| Commanders | `kind: commander` (8 roles) |
| Travelers | `kind: traveler` (expanded) |
| Convert hero | L100 → L1 · T0 equip · professions carry |

## Files

- SSOT: `content/camp/claim-flag.json`, `public/content/camp/claim-flag.json`, ObjectStore `api/v1/camp-claim-flag.json`
- Placeables: `src/three/camp/placeables.ts`, `CampBuildSystem.ts`, `unitMeshBind.ts`
- Runtime: `src/game/campClaimCatalog.ts`, `src/lib/campClaimPersist.ts`
- UI: `src/components/CampClaimFlagPanel.tsx`
- Studio: `beginPlacePlaceable`, build radial → flag/barracks/wall/…
