# Gameplay layers SSOT

**Source:** `artifacts/animator/src/three/gameplay/GamePlayLayers.ts`

Bitmasks + string tags for physics, raycasts, UI, combat, claim, and environment volumes. Harvest low bits (0–7) stay compatible with Mine-Loader / pinata.

---

## Layer catalog

| Bit | Name | Tag | Gameplay |
|-----|------|-----|----------|
| 0 | WORLD | world / solid / prop | Solid world colliders |
| 1 | HARVESTABLE | harvest | Trees, ore, forage |
| 2 | TOOL | tool | Player tool swing |
| 3 | ANIMAL | animal | Fauna |
| 4 | SCRAP | scrap | Wash-up scrap |
| 5 | DEBRIS | debris | Pinata chunks |
| 6 | PLAYER | player | Local player |
| 7 | TRIGGER | trigger / interact | Generic triggers |
| 8 | NPC | npc | Friendly NPCs |
| 9 | ALLY | ally | Party allies |
| 10 | MONSTER | monster | Hostiles |
| 11 | BOSS | boss | Bosses |
| 12 | REWARD | reward | Loot / reward |
| 13 | CLIMB | climb | Ladder / climb **sensor** |
| 14 | SWIM | swim | Water **sensor** |
| 15 | BURN | burn | Lava / fire **sensor** |
| 16 | OCEAN_FLOOR | ocean_floor | Seabed walk surface |
| 17 | TERRAIN | terrain | Heightmap / ground |
| 18 | ENEMY_ZONE | enemy_zone | Aggro / encounter **sensor** |
| 19 | CLAIM | claim | Claim / build rights **sensor** |
| 20 | UI | ui | World UI / markers |
| 21 | GHOST | ghost | Build ghost / blueprint |

---

## Query masks

| Mask | Hits |
|------|------|
| `TOOL_HIT_MASK` | harvest, animal, scrap, debris, reward |
| `MOVE_COLLIDE_MASK` | world, terrain, ocean_floor, harvest, scrap |
| `TERRAIN_SAMPLE_MASK` | terrain, ocean_floor, world |
| `COMBAT_TARGET_MASK` | monster, boss, animal |
| `FRIENDLY_SELECT_MASK` | npc, ally, player |
| `DAMAGE_VOLUME_MASK` | burn, enemy_zone |
| `LOCO_SENSOR_MASK` | climb, swim, burn, trigger |
| `CLAIM_MASK` | claim, ghost |
| `UI_RAYCAST_MASK` | ui, reward, ghost |
| `BUILD_GROUND_MASK` | terrain, ocean_floor, world |
| `AI_BLOCK_MASK` | world, terrain, harvest, player, npc, ally, monster, boss |

---

## userData contract

```ts
applyGameLayer(obj, "climb"); // sets:
// gameLayer, layers (bitmask), gamePlayLayer, harvestLayer (low 8),
// sensor (true for climb/swim/burn/claim/enemy_zone/ui/ghost),
// physicsLayer string for legacy brawler paths
```

Optional: `faction`, `claimId`, `zoneId`, `rewardId`.

---

## Helpers

- `createClaimVolume(center, radius, height, claimId)` — cylinder sensor  
- `createEnemyZoneBox(center, half, zoneId)` — box sensor  
- Island maps call `applyGameLayer` from `classifyIslandScene`  
- Forest mountains: terrain → `terrain`, harvest → `harvest`  

---

## UI / player / units (intent)

| Actor | Layer | Notes |
|-------|-------|-------|
| Player | PLAYER | Capsule KCC |
| Camp NPC | NPC | Talk / vendor |
| Ally unit | ALLY | Party combat |
| Creep / raider | MONSTER | Soft/hard lock |
| World boss | BOSS | Focus target |
| Claim flag radius | CLAIM | Build rights |
| Build ghost | GHOST | No solid collide |
| HUD markers | UI | Raycast only |

Wire new spawners with `applyGameLayer` so AI tools and bake pipelines see a single SSOT.
