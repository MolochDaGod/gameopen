# Character bag · Account inventory · Trees

Production inventory model for Open harvest/build HUD.

## Two layers

| Layer | Size | Scope | Use |
|-------|------|--------|-----|
| **Character bag** | **3×3** (9 slots) default | Per character | Gear swap, drops, harvest stacks (≤**100**), mission items, consumables |
| **Account inventory** | Vault map | One per account · all islands / modes / instances / characters | Crafting, buildings, professions, shared materials |

Harvest **does not** go straight to account. It fills the **character bag** until **Quick deposit** at a valid zone.

## HUD

- Harvest/build Craftpix bar: **far-right bag button (I)**
- Opens `CharacterBagPanel` (3×3)
- Badge = occupied slots
- **Quick deposit** pulses green when inside **claim / camp / boat**
- **RMB** on item → Use / Equip / Deposit / Drop / Inspect
- **LMB drag** bag → consumable hotkeys 1–4

Combat mode **I** still opens full Equipment paperdoll.

## Deposit zones

`Studio.getDepositProbe()` + `resolveDepositContext()`:

- `claim` — planted claim flag radius (`CampBuildSystem.isInsideClaim`)
- `camp` — claim exists / structures present
- `boat` — sail/boat room kinds
- `storage` — reserved for chest props

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
| `game/inventory/store.ts` | Persist + `harvestIntoBag` + `quickDepositAll` |
| `game/inventory/depositZones.ts` | Illumination rules |
| `game/inventory/trees.ts` | Class/prof/camp/weapon trees |
| `components/hud/CharacterBagPanel.tsx` | UI |
| `components/hud/CraftpixHarvestHud.tsx` | Bag button |
| `auth/accountBag.ts` | Railway `/api/account/resources` |

## Material mapping

Harvest ops write craft bag (`mat_*`) and character bag short ids (`wood`, `stone`, `ore`, …) via `applyHarvestYield(..., characterId)`.

## Next

- Equipment paperdoll equip from bag RMB
- Account inventory full UI tab in AccountPanel (resources already listed)
- Building anim one-shots when placing
- Server-authoritative bag on character save API
