---
name: mine-loader-harvest-chests
description: >
  Mine-Loader (mineloader.grudge-studio.com) player Auto Harvest, ally unitOrders
  auto-harvest, and deployable openable chests. USE FOR: wire HUD Auto ability,
  unit assign_auto_harvest, registerChest, starter chests, harvest profession
  swings, production deploy of gather/loot. Load AFTER grudge-studio. Repo:
  F:\GitHub\Mine-Loader · docs/HARVEST_SYSTEM.md.
---

# Mine-Loader — Auto Harvest + Chests

**Do not invent** a second harvest or chest stack. Extend:

| System | Path |
|--------|------|
| Harvest runtime | `artifacts/voxelcraft/src/lib/harvest/` (`HarvestWorld`, defs, professions) |
| Engine | `artifacts/voxelcraft/src/lib/voxelEngine.ts` |
| Unit orders | `artifacts/voxelcraft/src/lib/interact/unitOrders.ts` |
| HUD | `artifacts/voxelcraft/src/components/play/PlayModeHud.tsx` |
| Doc | `docs/HARVEST_SYSTEM.md` |

## Player Auto Harvest

1. HUD ability **Auto** (`ability_auto`) toggles `onAutoHarvestChange`.
2. `Game.tsx` → `engine.setPlayerAutoHarvest(on)`.
3. `updatePlay` → `tickPlayerAutoHarvest(dt)`:
   - Requires **Harvest** HUD mode (not Combat)
   - `HarvestWorld.nearestAlive` within ~4.2 m → `tryHarvestToward`
   - Else `tryMineBlock` under crosshair
   - Interval ~0.55 s; no combat lunge

```ts
engine.setPlayerAutoHarvest(true);
engine.isPlayerAutoHarvest(); // boolean
```

## Ally / unit Auto Harvest

1. RMB context `assign_auto_harvest` → `orderAutoHarvest(allyUnitId(i, name), pos, targetId, defId)`.
2. `updateAllies` checks `getOrder(allyUnitId(...))` **before** combat/hold formation.
3. `runAllyAutoHarvest`: walk to node → swing with pick/axe/hand by filter → loot via `onLoot`.

Ids must stay `allyUnitId(index, name)` — never invent a parallel id scheme.

## Chests (deployable game element)

| Register path | When |
|---------------|------|
| Prop spawn `chest` / `dungeon_chest` | Procedural + authored maps |
| `attachChestToRaft` | Raft module chest |
| `registerChest(holder, opts)` | Any deployable (Forge, scripts) |
| `ensureStarterChests` | `enterPlay` if `chests.length === 0` |

Open: **E** within ~2.6 m or RMB `open_chest` → `openChest` → `rollChestLoot` → container UI.

```ts
engine.registerChest(holder, { dungeon: false, mixer, open });
engine.getOpenableChestCount();
```

Scene authoring: place prop model `chest` or `dungeon_chest`. Deck: `build_chest_on_deck`.

## Production hosts

| Host | Role |
|------|------|
| `mineloader.grudge-studio.com` | Canonical play edge |
| `mine.grudge-studio.com` | Alias |
| `mine-loader.vercel.app` | Vercel SPA |

Deploy: repo root `pnpm build:web` / Vercel project linked to Mine-Loader · smoke `node scripts/smoke-mineloader-prod.mjs`.

## Tests

```bash
cd artifacts/voxelcraft
pnpm exec vitest run src/lib/harvest/harvest.test.ts src/lib/interact/interact.test.ts --pool=forks
```

## Hard bans

- ❌ Second harvest world or parallel auto-mine module
- ❌ React-only Auto toggle without `setPlayerAutoHarvest`
- ❌ Storing unit orders without ticking them in `updateAllies`
- ❌ New chest host/app — use existing E / interact / container panel
