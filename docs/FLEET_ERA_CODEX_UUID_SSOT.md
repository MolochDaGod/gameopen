# Fleet SSOT — Eras · Separate codexes · Definitions · Grudge UUID

**One source of truth** for how account, era, catalogs, and ids fit together.  
Do not invent a second roster DB, a second definitions host, or a third UUID scheme.

| Related SSOT |
|--------------|
| Data layers: [CANONICAL_DATA_LAYER.md](./CANONICAL_DATA_LAYER.md) |
| Voxel codex generators: [CODEX_AND_VOXEL_GENERATION.md](./CODEX_AND_VOXEL_GENERATION.md) |
| Multi-era characters: Mine-Loader [CHARACTER_ERAS.md](https://github.com/MolochDaGod/mine-loader/blob/main/docs/CHARACTER_ERAS.md) · Open `FLEET_CHARACTER_ERAS` in `lib/grudgeAuth.ts` |
| Runtime ids: `@workspace/grudge-runtime` `ids.ts` · [WARLORDS_PLATFORM_SSOT.md](./WARLORDS_PLATFORM_SSOT.md) §3 |
| Asset UUID / CDN: skill `grudge-d1-r2` · [OUTDOOR_ASSETS_D1_R2.md](./OUTDOOR_ASSETS_D1_R2.md) |
| Bag / camp / lockpick: [LOCATION_INVENTORY_LOCKPICK_SSOT.md](./LOCATION_INVENTORY_LOCKPICK_SSOT.md) |
| PlayCanvas lab only: [ENGINE_SOURCE_CLOUDFLARE_SSOT.md](./ENGINE_SOURCE_CLOUDFLARE_SSOT.md) |

---

## 1. Cosmology (read this first)

```
                    ┌──────────────────────────┐
                    │  Grudge ID (human)       │
                    │  one JWT / one account   │
                    └────────────┬─────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
         ▼                       ▼                       ▼
  ACCOUNT SCOPE            ERA SCOPE                 ASSET SCOPE
  bag · GBUX · wallet      4 heroes per era          R2 binaries
  home island              mesh · XP · equip         D1 index only
  /api/account/*           /api/characters?era=      assets.grudge-studio.com
  Railway                  Railway                   Cloudflare
```

| Scope | Shared across eras? | Storage |
|-------|---------------------|---------|
| Login / account | **Yes** | Railway `users` / `accounts` |
| Bag / resources / GBUX | **Yes** (account) | `/api/account/*` |
| Home island bag | **Yes** (account vault) | location inventory → account |
| Character roster | **No** — **per era** | `/api/characters?era=<era>` · max **4** slots |
| Character XP / equip / professions | Per character (era-bound) | character row + `saveData.<namespace>` |
| Definitions (weapons, races…) | Global design data | **info.grudge-studio.com/api/v1** |
| Mesh files | Global binaries | **assets.grudge-studio.com** (R2) |
| Worlds / voxels | Realms authority | Mine-Loader Railway **1 replica** |

**Rule:** One human → one account → **four separate era shelves** of heroes. Bag is shared; heroes are not.

---

## 2. Eras (separate play rosters)

### 2.1 Production era matrix

| Era id | Pipeline / look | Create / select | Play host (typical) | Slots |
|--------|-----------------|-----------------|---------------------|-------|
| **warlords** | grudge6 modular · Foundry | character.grudge-studio.com Foundry | Open Danger / Island / WCS handoff | **4** |
| **voxel** | voxel / explorer / TVS | Mine-Loader / Open voxel | mineloader · Realms | **4** |
| **nexus** | toon / Grudox / mech shelf | Grudox / Foundry `?era=nexus` | grudox / nexus products | **4** |
| **armada** | naval / mech shelf | Foundry `?era=armada` (may be content-gated) | Armada / sail products | **4** |

Code constants (Open):

```ts
// artifacts/animator/src/lib/grudgeAuth.ts
export const FLEET_CHARACTER_ERAS = ["warlords", "voxel", "nexus", "armada"] as const;
```

API:

```http
GET  /api/characters?era=warlords
POST /api/characters          # body includes gameEra / era
PATCH /api/characters/:uuid
```

**401** on characters = missing JWT (re-login), not “wrong era.”  
Empty `[]` when signed in = create hero for that era.

### 2.2 What is shared vs isolated

| Data | Shared | Isolated per era |
|------|--------|------------------|
| Grudge ID login | ✓ | |
| Account inventory / GBUX | ✓ | |
| Home island account vault | ✓ | |
| Character rows | | ✓ `gameEra` |
| `saveData.open` | | Open namespace only |
| `saveData.realms` / voxel bag | | Voxel / Realms |
| `saveData.warlords` professions | | Warlords progress |
| Mesh pipeline (`renderPipeline`) | Forced from era on create | |

**Never** PATCH one era’s blob over another.  
**Independent titles** (e.g. Flare) may use Grudge ID for login only — their heroes **must not** appear in `/api/characters?era=*`.

### 2.3 4-slot scene (every era)

```
[ Slot 0 ] [ Slot 1 ] [ Slot 2 ] [ Slot 3 ]
 empty/+     hero       hero      empty/+
   │           │
   ▼           ▼
 Foundry create   enter play + characterId + returnTo
 ?era=<era>
```

Prefer server `slotIndex` 0–3. Product max: **4** heroes per era (`accounts.era_slots` clamps legacy higher values).

### 2.4 Era × product hosts

| Era | Library shelf | Primary mesh SSOT |
|-----|---------------|-------------------|
| warlords | Open Warlords cards | grudge6 R2 kits · Foundry |
| voxel | Voxel / Realms | Mine-Loader blocks + explorer kits |
| nexus | Nexus / Carrier / mech | Grudox toon / nexus assets |
| armada | Armada / sail | Naval / mech packs (when gated open) |

Open library filters: Voxel · Warlords · Nexus · Armada · Account.

---

## 3. Separate codexes (do not merge tables)

A **codex** is a **browse + generate + place** surface for one content domain.  
Each has its **own host, API, and generators**. Agents must not dump all content into one JSON file.

### 3.1 Codex map

| Codex | Live UI | Authority | What it defines |
|-------|---------|-----------|-----------------|
| **Mine-Loader Codex** | `mineloader…/#/defs` | Mine-Loader API + voxelcraft data | Mechanics prose, **blocks**, item icons catalog |
| **Fleet definitions (info)** | Open via `fetchCatalogJson` | **info.grudge-studio.com/api/v1** | weapons, races, recipes, skill trees, gear presets |
| **ObjectStore / Pages catalog** | ObjectStore site | D1 index + JSON | Same defs dual-publish; multi-host fallback |
| **Camp claim catalog** | Open Camp hub | Open `content/camp/*` + ObjectStore | buildings, units, node upgrades, claim flag |
| **Outdoor / nature test worlds** | Open outdoor | CDN + D1 registry | island meshes, nature packs |
| **enginesource lab** | PlayCanvas examples only | Local fork | **Not** a Grudge codex — codec/lab only |

### 3.2 Mine-Loader Codex (three tabs)

From [CODEX_AND_VOXEL_GENERATION.md](./CODEX_AND_VOXEL_GENERATION.md):

| Tab | Source | Wired to play? |
|-----|--------|----------------|
| **Mechanics** | `api-server/src/data/gameDefs.ts` → `GET /api/definitions` | Rules / map gen prose |
| **Blocks** | `blockCatalogData.ts` + atlas → `cat:<id>` | **Yes** — place in voxel |
| **Catalog** (items icons) | 550 icons / 22 packs | **Browse reference** until opt-in inventory phase |

Generators stay Mine-Loader scripts (`build_block_icons.mjs`, `build_item_catalog.mjs`, …).

### 3.3 Fleet definitions host (info)

Canonical design JSON (Open corrected 2026-07 — not dead objectstore-only):

| File (examples) | Domain |
|-----------------|--------|
| `races.json` | Race defs |
| `weapons.json` / `master-weaponSkills.json` | Weapons + skills |
| `equipment.json` / `armor.json` | Gear |
| `master-items.json` / `master-recipes.json` | Items / craft |
| `grudge6-gear-presets.json` / `grudge6-canonical.json` | Modular kits |
| `professions.json` / `master-skillTrees.json` | Professions / class trees |
| `materials.json` | Harvest / craft mats |

Fetch (Open):

```ts
import { fetchCatalogJson, FLEET_CATALOGS } from "./lib/fleetSsot";
const skills = await fetchCatalogJson(FLEET_CATALOGS.masterWeaponSkills);
```

Same-origin: `/api/objectstore/v1/*` → **info.grudge-studio.com**.

### 3.4 Codex vs “definitions” vs “gamedata”

| Term | Meaning |
|------|---------|
| **Codex** | Product UI that **shows** definitions + generation tools (Mine-Loader `#/defs`) |
| **Definitions** | Static design JSON (info / ObjectStore) — ids, stats, recipes |
| **Gamedata (R2 bucket)** | JSON blobs on Cloudflare `grudge-gamedata` for some backends |
| **Asset registry (D1)** | Index of **binary** R2 keys — not design stats |

Never write player bag into a codex JSON file.

---

## 4. Definitions layer (five-layer stack)

Aligned with [CANONICAL_DATA_LAYER.md](./CANONICAL_DATA_LAYER.md):

| # | Layer | Host | Owns |
|---|-------|------|------|
| 1 | **Player state** | Railway Postgres | characters, bag, wallet, island, ledger |
| 2 | **Definitions** | **info.grudge-studio.com** | weapons, races, recipes, skills |
| 3 | **Binaries** | **assets.grudge-studio.com** (R2) | GLB/FBX/tex/audio |
| 4 | **Asset index** | D1 `grudge-assets-db` | r2Key → metadata / grudge_uuid |
| 5 | **Worlds** | Mine-Loader Railway | seeds, block edits, lobby |

**Dead for new work:** `api.grudge-studio.com`.  
**Legacy fallback only:** raw objectstore host until dual-publish complete.

### Era-specific definition use

| Era | Definition packs used first |
|-----|----------------------------|
| warlords | grudge6 presets, races, weapon skills, professions |
| voxel | Mine-Loader blocks + definitions API + item catalog icons |
| nexus | toon / nexus catalogs + Grudox defs |
| armada | naval/mech defs when gated live |

Mesh **files** still resolve through R2; definition JSON only **points** at paths/mesh_ids.

---

## 5. Grudge UUID (many schemes — keep them straight)

There is **not** one global UUID type. Use the right namespace.

### 5.1 Identity families

| Family | Example | Mint / storage | Used for |
|--------|---------|----------------|----------|
| **Character (fleet)** | `char_…` or Railway uuid | `POST /api/characters` | Hero row, play handoff |
| **Hero pack** | `HERO-…` | character/API pack ids | Display packs |
| **Equipment instance** | `EQIP-…` | item/equip systems | Unique gear |
| **Item instance** | `ITEM-…` | item systems | Unique items |
| **Ledger gear (Open bag)** | structured `grudgeUuid` | `/api/uuid/generate` + `/api/ledger/*` | Production bag uniques |
| **Runtime entity** | `ent_…` | `newGrudgeId("entity")` | NPC, prop, projectile |
| **Instance / room / zone / portal / script** | `inst_` `room_` `zone_` `portal_` `scr_` | grudge-runtime | Sessions, content |
| **Asset registry** | sha1 UUID from `r2Key` | D1 `asset_registry` | Binary file identity |
| **Human-prefixed assets** | `HERO-` / `EQIP-` / `ITEM-` on backend catalog | grudge-backend D1 `assets` | Alternate registry (do not mix blindly) |
| **Harvest location / instance** | `hrvl_` `hrvi_` `hrvd_` | Mine-Loader harvest SSOT | World harvest pins |
| **Location storage** | `camp:claim_*` `home:<grudgeId>` | Open location inventory | Albion bags |

### 5.2 Runtime mint (Open / Warlords 3D)

```ts
import {
  newUuid,
  newGrudgeId,
  newInstanceId,
  detectIdKind,
  isCharacterId,
  encodeWirePlayerName,
} from "@workspace/grudge-runtime";

const ent = newGrudgeId("entity");     // ent_<uuid>
const run = newInstanceId();           // inst_…
const wire = encodeWirePlayerName(name, characterId, fleetId);
// display \u001f characterId \u001f fleetId
```

**Rules:**

1. World **seeds** stay deterministic.  
2. Entity / instance **ids** are never seed-derived.  
3. Signed-in unique gear: **ledger** `grudgeUuid` — no provisional `prov_*` as production SSOT.  
4. Stackable mats: definition id + qty (`stack_<templateId>`), not EQIP mint.

### 5.3 Asset UUID (Cloudflare D1)

```
grudge_uuid = formatUuid(sha1("grudge-asset:" + r2Key))
```

- Same `r2Key` → same uuid (idempotent re-upload).  
- **Not** a character id.  
- Join: character.race / modelPath → path → R2 → optional registry row.

### 5.4 Account id for bags

| Context | Id |
|---------|-----|
| Signed in | `account.grudgeId` |
| Guest | `guest` |
| Home island location store | `home:<grudgeId>` |
| Camp store | `camp:claim_<characterId>` |

See `claimKeyForCharacter` / `accountIdForVault` in Open `locationInventory.ts`.

### 5.5 Anti-patterns

| Bad | Good |
|-----|------|
| Use D1 asset uuid as character id | Railway character uuid / `char_` |
| One uuid type for files + heroes + bag items | Family table above |
| Seed-derived entity ids | `newGrudgeId` / `newInstanceId` |
| Provisional unique gear when JWT present | Ledger mint |
| Merge era rosters into one 16-slot bag of heroes | 4 × 4 era shelves |
| Definitions only on objectstore | **info** primary + multi-host fallback |

---

## 6. How eras × codexes × UUIDs meet at play time

```
1. Login (Grudge ID) → JWT
2. Pick era shelf → GET /api/characters?era=<era>
3. Select characterId (Railway uuid)
4. Load definitions (info) for race/class/weapons for that pipeline
5. Resolve mesh_ids / paths → assets.grudge-studio.com (R2)
6. Play:
   - Account bag (shared) for mats when deposited home
   - Camp storage (claim key) for RTS
   - Character bag 3×3 carry
   - Ledger grudgeUuid for unique gear
7. Worlds (voxel era): Mine-Loader seed + blocks from Mine codex
```

---

## 7. enginesource / Cloudflare (where it fits)

| Layer | enginesource | Fleet |
|-------|--------------|-------|
| Eras / characters | **None** | Railway eras |
| Codex / definitions | Example assets only | info + Mine Codex |
| Grudge UUID | **None** | grudge-runtime + Railway + D1 asset uuid |
| Binaries | Lab GLB/KTX2/Basis | R2 CDN |
| Deploy helper | Build flavors ESM/UMD | Vercel SPA + CF CDN Worker |

PlayCanvas is a **lab engine**, not an era and not a codex.

---

## 8. Agent checklist

- [ ] Know which **era** the character belongs to before loading mesh/pipeline  
- [ ] Account bag ≠ character equip ≠ D1 asset uuid  
- [ ] Definitions from **info** (or multi-host), binaries from **assets**  
- [ ] Mine Codex blocks vs item-catalog browse vs fleet master-JSON are **separate**  
- [ ] Mint runtime entities with `newGrudgeId` / harvest ids with Mine SSOT  
- [ ] Home island never lockpick; camp uses `claim_<characterId>`  
- [ ] Do not invent a fifth era without `FLEET_CHARACTER_ERAS` + Railway `era_slots`  

---

## 9. Smoke

```bash
# Auth + era roster
curl -sH "Authorization: Bearer $JWT" \
  "https://open.grudge-studio.com/api/characters?era=warlords" | head

# Definitions
curl -sI https://info.grudge-studio.com/api/v1/master-weaponSkills.json
curl -sI https://info.grudge-studio.com/api/v1/grudge6-gear-presets.json

# Binaries
curl -sI https://assets.grudge-studio.com/models/grudge6/races/WK_Characters.fbx

# Mine codex
curl -s "https://mineloader.grudge-studio.com/api/definitions" | head
curl -s "https://mineloader.grudge-studio.com/api/blocks?limit=3" | head
```
