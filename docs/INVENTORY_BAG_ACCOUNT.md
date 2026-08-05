# Character bag · Account inventory · Trees

**Fleet SSOT (one source of truth):** [LOCATION_INVENTORY_LOCKPICK_SSOT.md](./LOCATION_INVENTORY_LOCKPICK_SSOT.md)

Production inventory model for Open harvest/build HUD.

## Layers (Albion location model)

| Layer | Size | Scope | Use |
|-------|------|--------|-----|
| **Character bag** | **3×3** (9 slots) default | Per character | Gear swap, drops, harvest stacks (≤**100**), mission items, consumables — **carry only** |
| **Camp storage** | Location vault | One per claim flag / camp pin | **RTS play** spends mats here; deposit at claim stays at camp until moved |
| **Home island bag** | Account vault map | One per account · all modes / characters | Shared fleet bag (Railway `/api/account/resources`) — **not** free camp loot |
| **Boat hold** | Location vault | Per boat | Sailing carry |
| **Hidden chest / treasure** | Location vault + lock | World pins | Open via **lockpick** minigame → loot into bag |

Harvest **does not** go straight to home island. It fills the **character bag** until **Quick deposit** at a valid zone:

- **Claim / camp** → camp storage (stays for RTS)
- **Home island warehouse** → home island bag (shared account)
- **Boat** → boat hold
- Explicit **Send camp → home island** moves camp vault to account bag (own camp only)

### Lockpick zones (product law)

| Zone | Lockpick? |
|------|-----------|
| **Home island** (any home bag / warehouse) | **SAFE — never** |
| Own camp / own boat | No pick — open free |
| **Dungeons** | Yes |
| **Treasures / hidden chests** found in game | Yes |
| **Contested** area chests | Yes |
| **Enemy** territory chests | Yes |
| **Conquered island** enemy-area chests | Yes |
| **Foreign** player camps | Yes (steal) |

ScriptRunner `open-ui` → `LockpickPanel` (native HTML; Kenney Lockpick style reference only — no SWF).  
Gate: `isLockpickAllowed()` + `isHomeIslandStorage()` — home always rejected.

## HUD

- Harvest/build Craftpix bar: **far-right bag button (I)**
- Opens `CharacterBagPanel` (3×3)
- Badge = occupied slots
- **Quick deposit** pulses green when inside **claim / camp / boat**
- **RMB** on item → Use / Equip / Deposit / Drop / Inspect
- **LMB drag** bag → consumable hotkeys 1–4

Combat mode **I** still opens full Equipment paperdoll.

## Deposit zones

`Studio.getDepositProbe()` + `resolveDepositContext()` / `resolveDepositDestination()`:

- `claim` / `camp` — planted claim → **camp storage** (`camp:<claimKey>`)
- `boat` — sail/boat room kinds → boat hold
- `storage` / `onHomeIsland` — home warehouse → **home island bag**
- Hidden chest / treasure — **not** deposit; interact → lockpick → loot

Camp hub **Storage** page lists camp vault + **Send → home island**.

## Trees (uniform registry)

`game/inventory/trees.ts` · `allTreeRefs()` / `ensureWeaponBranches()`:

| Domain | Source |
|--------|--------|
| class / mastery | Class path (warrior, …) |
| profession | harvest skill-trees.json |
| camp | Claim, farm, build, defense, tame |
| weapon_tier | Per family × T0–T5 **UUID branch ids** (`wpn_tree_<family>_tN_<uuid>`) — progress keys, not bag instances |
| unique gear instance | Railway **`grudge_uuid`** via `/api/uuid/generate` + `/api/ledger/*` (Open: `mintUniqueItemInstance`) |
| stackable mats | definition id + qty; bag cache `stack_<templateId>`; deposit → `/api/account/resources` |
| equip | kept loadout + ledger `EQUIPPED` / `UNEQUIPPED` when `grudgeUuid` present |
| appearance | `PATCH /api/characters/:uuid` model3d + avatar + equipment mesh refs (`saveCharacterSlotAppearance`) |

**Banned as production bag SSOT:** client-only `ent_*` / provisional uniques while signed in.

Persisted: `localStorage grudge:weapon-tree-branches:v1`

## Code map

| Path | Role |
|------|------|
| `game/inventory/types.ts` | Bag / account / item shapes |
| `game/inventory/characterBag.ts` | 3×3 add/remove/swap/hotkeys |
| `game/inventory/accountInventory.ts` | Shared vault + Railway push |
| `game/inventory/locationInventory.ts` | Albion camp / boat / hidden location stores |
| `game/inventory/lockpick.ts` | Lockpick skill-check (pure) |
| `game/inventory/store.ts` | Persist + `harvestIntoBag` + `quickDepositAll` (routed) |
| `game/inventory/depositZones.ts` | Illumination + destination routing |
| `game/inventory/trees.ts` | Class/prof/camp/weapon trees |
| `components/hud/CharacterBagPanel.tsx` | UI + send camp→home |
| `components/minigames/LockpickPanel.tsx` | open-ui lockpick |
| `components/CampClaimFlagPanel.tsx` | Camp **Storage** page |
| `components/hud/CraftpixHarvestHud.tsx` | Bag button |
| `auth/accountBag.ts` | Railway `/api/account/resources` |
| `public/content/runtime/hidden-loot-lockpick-scripts.json` | Hidden chest / treasure / foreign camp scripts |

## Material mapping

Harvest ops write craft bag (`mat_*`) and character bag short ids (`wood`, `stone`, `ore`, …) via `applyHarvestYield(..., characterId)`.

## Next

- Railway-authoritative camp storage rows (today: `localStorage grudge:loc-inv:v1:*` cache + home = account API)
- Equipment paperdoll equip from bag RMB
- Account inventory full UI tab in AccountPanel (resources already listed)
- RTS trainUnit cost deduct from camp storage
- Building anim one-shots when placing
