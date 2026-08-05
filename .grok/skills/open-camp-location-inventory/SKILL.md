---
name: open-camp-location-inventory
description: >
  Open MMO Albion-style location inventory: character bag carry, camp storage for
  RTS, home island = shared account bag, lockpick for foreign camps / hidden
  chests / treasure. USE FOR: camp deposit routing, send to home island, steal
  lockpick, hidden loot scripts, bag panel. Load AFTER grudge-studio. Repo:
  Documents/gameopen · docs/INVENTORY_BAG_ACCOUNT.md · docs/CAMP_CLAIM_FLAG.md.
---

# Open — Camp + Home Island location inventory

**Fleet SSOT (one source of truth):** `docs/LOCATION_INVENTORY_LOCKPICK_SSOT.md`

**Do not invent** a second bag or lockpick host. Extend:

| System | Path |
|--------|------|
| Character bag 3×3 | `game/inventory/characterBag.ts` + `store.ts` |
| Home island bag | `accountInventory.ts` → Railway `/api/account/resources` |
| Camp / boat / hidden | `locationInventory.ts` |
| Deposit routing | `depositZones.ts` → `quickDepositAll(…, destination)` |
| Lockpick | `lockpick.ts` + `components/minigames/LockpickPanel.tsx` |
| Script open-ui | `Studio.loadRuntimeScripts` → `grudge-open-ui` event |
| Camp hub Storage | `CampClaimFlagPanel` page `storage` |
| Doc | `docs/INVENTORY_BAG_ACCOUNT.md` |

## Albion rules (product)

1. **Carry** = character bag only.
2. Deposit **at claim/camp** → **camp storage** (RTS inventory). Stays until sent home or carried out.
3. **Home island bag** = shared **account** vault (all characters / modes).
4. **Send camp → home** = explicit transfer (bag panel or camp Storage page).
5. **Home islands are SAFE** — **never lockpickable** (`isHomeIslandStorage` / zone `home_island`).
6. **Lockpickable:** dungeons, treasures, hidden chests, contested chests, enemy-area chests, conquered-island enemy loot, foreign camps.
7. Own camp/boat opens free (no pick).

## Lockpick wiring

```json
{
  "kind": "open-ui",
  "payload": {
    "ui": "lockpick",
    "targetId": "hchest:pin_id",
    "kind": "hidden_chest",
    "difficulty": 28,
    "label": "Hidden chest"
  }
}
```

Pack: `public/content/runtime/hidden-loot-lockpick-scripts.json`.

## Hard bans

- ❌ Depositing camp goods straight into account without location routing
- ❌ Skyrim SWF lockpick runtime
- ❌ Parallel inventory package outside `game/inventory/`
- ❌ Treating character `inventory` jsonb as fleet bag SSOT
