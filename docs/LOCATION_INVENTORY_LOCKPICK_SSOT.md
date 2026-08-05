# Location inventory · camp · home island · lockpick — FLEET SSOT

**One source of truth** for Albion-style bags, camp RTS storage, home island safe vault, and lockpick loot.

| | |
|--|--|
| **Canonical doc** | This file (`docs/LOCATION_INVENTORY_LOCKPICK_SSOT.md`) |
| **Open repo** | https://github.com/MolochDaGod/gameopen |
| **Live Open** | https://open.grudge-studio.com |
| **Agent skill** | `open-camp-location-inventory` · `mine-loader-harvest-chests` |
| **Related** | [INVENTORY_BAG_ACCOUNT.md](./INVENTORY_BAG_ACCOUNT.md) · [CAMP_CLAIM_FLAG.md](./CAMP_CLAIM_FLAG.md) · [MINE_LOADER_SSOT.md](./MINE_LOADER_SSOT.md) |

Do **not** invent a second bag, bank, or lockpick host. Extend the paths below.

---

## 1. Ownership matrix (fleet)

| Concern | SSOT | Host / code |
|---------|------|-------------|
| Character bag 3×3 (carry) | **gameopen** | `artifacts/animator/src/game/inventory/characterBag.ts` |
| Home island bag = account vault | **gameopen** + Railway | `accountInventory.ts` → `/api/account/resources` |
| Camp storage (RTS) | **gameopen** | `locationInventory.ts` · Camp hub **Storage** |
| Deposit routing (Albion) | **gameopen** | `depositZones.ts` · `quickDepositAll` |
| Lockpick minigame | **gameopen** | `lockpick.ts` · `LockpickPanel.tsx` · ScriptRunner `open-ui` |
| Lockpick zone law | **gameopen** | `isLockpickAllowed` · `isHomeIslandStorage` |
| Hidden / dungeon / contested scripts | **gameopen** | `public/content/runtime/hidden-loot-lockpick-scripts.json` |
| Mine-Loader harvest + world chests | **mine-loader** | `HARVEST_SYSTEM.md` · `VoxelEngine` auto-harvest / `registerChest` |
| Account identity / shared bag API | Railway grudge-api | `account_inventory` · `account_resources` · `home_islands` |

**Rule:** Open owns MMO bag + camp + lockpick UX. Mine-Loader owns voxel harvest/chest runtime. Shared account vault is Railway. No third inventory stack.

---

## 2. Albion location model

| Layer | Stays where? | Use |
|-------|----------------|-----|
| Character bag | On body | Harvest carry, gear swap |
| **Camp storage** | At claim until sent home | **RTS** spends here |
| **Home island bag** | Account (all modes) | Shared fleet vault |
| Boat hold | On boat | Sail carry |
| World loot chests | Pin until picked | Lockpick when required |

Deposit at **claim/camp** → camp storage (not free account).  
**Send camp → home island** = explicit transfer only.

---

## 3. Lockpick zone law (hard)

| Zone | Lockpick? |
|------|-----------|
| **Home island** | **SAFE — never** |
| Own camp / own boat | Open free |
| Dungeons | **Yes** |
| Treasures / hidden chests in game | **Yes** |
| Contested area chests | **Yes** |
| Enemy area chests | **Yes** |
| Conquered-island enemy loot | **Yes** |
| Foreign player camps | **Yes** (steal) |

Code: `isLockpickAllowed()` · `enforceHomeIslandSafe()` · Studio / App refuse `home:*`.

Default DCs: dungeon 35 · hidden chest 28 · treasure 48 · contested 40 · enemy 55 · conquered 42 · foreign camp 55.

---

## 4. Code map (Open)

```
artifacts/animator/src/game/inventory/
  types.ts                 bag / deposit shapes
  characterBag.ts          3×3 carry
  accountInventory.ts      home island vault + Railway push
  locationInventory.ts     camp / boat / dungeon / contested / enemy stores
  lockpick.ts              pure skill-check
  depositZones.ts          destination routing
  store.ts                 harvestIntoBag · quickDepositAll

components/hud/CharacterBagPanel.tsx
components/CampClaimFlagPanel.tsx     Storage page
components/minigames/LockpickPanel.tsx
three/Studio.ts                       getDepositProbe · beginLockpickChallenge · open-ui
public/content/runtime/hidden-loot-lockpick-scripts.json
```

## 5. Code map (Mine-Loader)

```
docs/HARVEST_SYSTEM.md
artifacts/voxelcraft/src/lib/harvest/
artifacts/voxelcraft/src/lib/voxelEngine.ts   setPlayerAutoHarvest · registerChest
artifacts/voxelcraft/src/lib/interact/unitOrders.ts
.grok/skills/mine-loader-harvest-chests/
Live: mineloader.grudge-studio.com
```

---

## 6. Script contract (lockpick)

```json
{
  "kind": "open-ui",
  "payload": {
    "ui": "lockpick",
    "targetId": "dungeon:pin_id",
    "kind": "dungeon_chest",
    "zone": "dungeon",
    "difficulty": 35,
    "label": "Dungeon chest"
  }
}
```

**Banned:** `zone: "home_island"` or `targetId: "home:*"` on lockpick actions.

---

## 7. Agent skills

| Skill | When |
|-------|------|
| **`open-camp-location-inventory`** | Camp bag, home island, lockpick, deposit routing |
| **`mine-loader-harvest-chests`** | Voxel auto-harvest, ally harvest, world chests |
| **`kenney-skyrim-mods`** | Lockpick **style** reference only (no SWF runtime) |

---

## 8. Ship checklist

- [ ] Bag deposit at camp lands in camp storage (not account)
- [ ] Home island never opens LockpickPanel
- [ ] Dungeon / contested / enemy / treasure scripts fire lockpick
- [ ] Camp hub Storage lists vault + Send → home
- [ ] Mine-Loader Auto Harvest + E chests on production host
- [ ] Railway account resources still home-island SSOT when signed in

---

## 9. Still open (honest)

- Railway-authoritative camp storage rows (today: `localStorage grudge:loc-inv:v1:*` + home via account API)
- RTS trainUnit auto-deduct from camp storage
- Live multiplayer foreign-camp ownership IDs for PvP steal
