# Fleet SSOT — Eras · Separate codexes · Definitions · Grudge UUID

**One source of truth** for how account, era, catalogs, and ids fit together.  
Do not invent a second roster DB, a second definitions host, or a third UUID scheme.

| Related SSOT |
|--------------|
| Data layers: [CANONICAL_DATA_LAYER.md](./CANONICAL_DATA_LAYER.md) · code `lib/fleetSsot.ts` |
| Voxel codex generators: [CODEX_AND_VOXEL_GENERATION.md](./CODEX_AND_VOXEL_GENERATION.md) |
| Multi-era characters: Mine-Loader [CHARACTER_ERAS.md](https://github.com/MolochDaGod/mine-loader/blob/main/docs/CHARACTER_ERAS.md) · Open `FLEET_CHARACTER_ERAS` in `lib/grudgeAuth.ts` |
| **Voxel Codex** leaf: [CODEX_AND_VOXEL_GENERATION.md](./CODEX_AND_VOXEL_GENERATION.md) · [VOXEL_CANONICAL.md](./VOXEL_CANONICAL.md) |
| **Voxel avatar · gear · DB wiring (anti-duplicate):** [VOXEL_ERA_AVATAR_GEAR_WIRING.md](./VOXEL_ERA_AVATAR_GEAR_WIRING.md) |
| **Warlords** stack: [WARLORDS_PLATFORM_SSOT.md](./WARLORDS_PLATFORM_SSOT.md) · arsenal + info master catalogs |
| Shared weapon **mesh sockets** (not avatar customizer): [content/docs/WEAPON_PREFAB.md](../content/docs/WEAPON_PREFAB.md) |
| Runtime ids: `@workspace/grudge-runtime` `ids.ts` |
| Asset UUID / CDN: skill `grudge-d1-r2` · [OUTDOOR_ASSETS_D1_R2.md](./OUTDOOR_ASSETS_D1_R2.md) |
| Bag / camp / lockpick: [LOCATION_INVENTORY_LOCKPICK_SSOT.md](./LOCATION_INVENTORY_LOCKPICK_SSOT.md) · [INVENTORY_BAG_ACCOUNT.md](./INVENTORY_BAG_ACCOUNT.md) |
| PlayCanvas lab only: [ENGINE_SOURCE_CLOUDFLARE_SSOT.md](./ENGINE_SOURCE_CLOUDFLARE_SSOT.md) |

**Code anchors (Open):**

| Concern | Path |
|---------|------|
| Eras constant | `artifacts/animator/src/lib/grudgeAuth.ts` → `FLEET_CHARACTER_ERAS` |
| Definitions fetch | `artifacts/animator/src/lib/fleetSsot.ts` → `FLEET_CATALOGS` / `fetchCatalogJson` |
| Layer table | `fleetSsot.ts` → `SSOT_LAYERS` |
| Runtime IDs | `lib/grudge-runtime/src/ids.ts` |
| Unique gear mint | `game/inventory/ledgerClient.ts` · `types.ts` |
| Location keys | `game/inventory/locationInventory.ts` |

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
| Definitions (weapons, races…) | Global design data | **info.grudge-studio.com** (`/content` + `/api/v1`) |
| Mesh files | Global binaries | **assets.grudge-studio.com** (R2) |
| Worlds / voxels | Realms authority | Mine-Loader Railway **1 replica** |

**Rule:** One human → one account → **four separate era shelves** of heroes. Bag is shared; heroes are not.

```
Shared (account)          Isolated (per era shelf)
─────────────────         ────────────────────────
JWT / grudgeId            character rows (gameEra)
GBUX / wallet             slotIndex 0–3
account bag resources     mesh / race / class pipeline
home island vault         saveData.open | .realms | .warlords | …
                          kept loadout / equip mesh_ids
```

---

## 2. Eras (separate play rosters)

### 2.1 Production era matrix

Open / Foundry production constant (do not invent a fifth without updating **both** code and Railway `era_slots`):

```ts
// artifacts/animator/src/lib/grudgeAuth.ts
export const FLEET_CHARACTER_ERAS = ["warlords", "voxel", "nexus", "armada"] as const;
```

| Era id | Pipeline / look | **Era codex** | Create / select | Play host (typical) | Slots |
|--------|-----------------|---------------|-----------------|---------------------|-------|
| **warlords** | grudge6 modular · Foundry | **Warlords Codex** | character.grudge-studio.com Foundry | Open Danger / Island / WCS · grudgewarlords / client.* | **4** |
| **voxel** | voxel / explorer / TVS | **Voxel Codex** | Mine-Loader / Foundry `?era=voxel` | mineloader · Realms | **4** |
| **nexus** | toon / Grudox / mech shelf | **Nexus Codex** | Grudox / Foundry `?era=nexus` | grudox / nexus products | **4** |
| **armada** | naval / mech shelf | *(future Armada Codex when gated)* | Foundry `?era=armada` (may be content-gated) | Armada / sail products | **4** |

**Optional / non-product shelves (do not treat as Open library tabs):**

| Id | Status | Rule |
|----|--------|------|
| `game` | May appear on Builder as legacy/generic | Prefer one of the four product eras; do not add Open library filter without product ask |
| **independent** (e.g. Flare) | Own character DB | Grudge ID login only — heroes **never** in `/api/characters?era=*` |

API:

```http
GET  /api/characters?era=warlords
POST /api/characters          # body includes gameEra / era
PATCH /api/characters/:uuid
DELETE /api/characters/:uuid
```

**401** on characters = missing JWT (re-login), not “wrong era.”  
Empty `[]` when signed in = create hero for that era (Foundry CTA).

### 2.2 What is shared vs isolated

| Data | Shared | Isolated per era |
|------|--------|------------------|
| Grudge ID login | ✓ | |
| Account inventory / GBUX | ✓ | |
| Home island account vault | ✓ | |
| Character rows | | ✓ `gameEra` |
| `saveData.open` | | Open / Danger loadout |
| `saveData.realms` / voxel bag | | Voxel / Realms |
| `saveData.warlords` professions | | Warlords progress |
| `saveData.nexus` / `saveData.armada` | | Era-specific blobs |
| Mesh pipeline (`renderPipeline`) | Forced from era on create | |
| Active selection | | Prefer `grudge.selectedCharacterByEra[era]` |

**Never** PATCH one era’s blob over another.  
**Warlords heroes never become Realms / voxel map avatars** (Mine filters `era=voxel` only).

### 2.3 4-slot scene (every era)

```
[ Slot 0 ] [ Slot 1 ] [ Slot 2 ] [ Slot 3 ]
 empty/+     hero       hero      empty/+
   │           │
   ▼           ▼
 Foundry create   enter play + characterId + returnTo
 ?era=<era>
```

| Action | Shared fleet | Independent title |
|--------|--------------|-------------------|
| Empty slot | Foundry create `?era=` | Game’s own create UI |
| Select | Per-era selected id map | Game local active id |
| Enter play | Play host + `?characterId=` + `era=` | Game world entry |
| Delete | `DELETE /api/characters/:id` | Game API |

Prefer server `slotIndex` 0–3. Product max: **4** heroes per era (`accounts.era_slots` clamps legacy higher values). Grudox also uses `GRUDOX_MAX_SLOTS = 4`.

### 2.4 Era × product hosts

| Era | Library shelf | Primary mesh SSOT | App integration |
|-----|---------------|-------------------|-----------------|
| warlords | Open Warlords cards | grudge6 R2 kits · Foundry | grudgewarlords.com · client.* · Open Danger |
| voxel | Voxel / Realms | Mine-Loader blocks + explorer kits | mineloader · Open Realms entry |
| nexus | Nexus / Carrier / mech | Grudox toon / nexus assets | grudox.grudge-studio.com |
| armada | Armada / sail | Naval / mech packs (when gated open) | sail / armada products |

Open library filters: **Voxel · Warlords · Nexus · Armada · Account**.

### 2.5 Auth + 401 playbook

```
Browser  Authorization: Bearer <session JWT>
   → same-origin /api/characters?era=<era>
   → Vercel rewrite → grudge-api-production (Railway)
```

| Status | Meaning | Client action |
|--------|---------|----------------|
| **401 / 403** | No/expired token | Prompt re-login; roster cache; guest Explorer if allowed |
| **200 []** | Logged in, zero heroes | Link Foundry create `?era=` |
| **200 […]** | Roster | Fill 4-slot scene |
| Network fail | Offline | Cache + guest path |

Mine-Loader play roster:

1. `era=voxel` only  
2. Unscoped fallback still filters out `gameEra=warlords`  
3. Local cache `grudge_realms_fleet_roster_v2` (voxel-only)

### 2.6 Account bridge (not cross-play)

Same JWT · same account bag · same wallet.  
Deep links open the **other product**; they **do not** merge heroes onto the wrong map.

### 2.7 Wiring a new shared-era product

```
[ ] Pick FleetCharacterEra or independent
[ ] If fleet: Foundry createUrl ?era=
[ ] 4-slot scene (Foundry hub and/or in-app)
[ ] GET /api/characters?era= with Bearer
[ ] Per-era selected id map
[ ] saveData.<appNs> for progress
[ ] Vercel rewrite /api/characters → Builder Railway
[ ] CORS + SSO allowlist for origin
[ ] Never invent a second character Postgres for fleet eras
```

Independent game checklist:

```
[ ] Own character CRUD
[ ] Optional: Grudge ID SSO for account linking only
[ ] Own 4-slot UI (same UX outline, different API)
[ ] Do not call /api/characters?era=<your-indie-id>
```

---

## 3. Separate codexes (do not merge tables)

**Three production era codexes are real products** — one per major play shelf.  
They are **not** aliases of each other, and **info.grudge-studio.com is not “the codex.”**  
Info is the **definitions publish pipe** that Warlords / Nexus codex packages (and other catalogs) ride on.

| Era codex | Era id | Product meaning |
|-----------|--------|-----------------|
| **Warlords Codex** | `warlords` | Fantasy flagship design + arsenal gear/skills + grudge6 kits |
| **Voxel Codex** | `voxel` | Placeable blocks, Realms mechanics, voxel item/icon catalog |
| **Nexus Codex** | `nexus` | Sci-fi / mech / metaverse / Carrier / Grudox design shelf |

`armada` may grow a fourth era codex when naval content is gated open — do **not** invent it early by stuffing sail defs into Warlords or Nexus.

A **codex** = browse + generate + bind surface for **that era’s** content domain  
(own APIs, generators, place/bind rules). Agents must not dump all three into one JSON or one UI tab.

### 3.1 Era codex map (SSOT)

| Codex | Live UI / product | Authority | What it owns | Place / bind contract |
|-------|-------------------|-----------|--------------|----------------------|
| **Warlords Codex** | Arsenal · Foundry catalogs · Open Danger weapon/skill surfaces · equipment codex packs | **info** master catalogs + grudge6 presets + Open `arsenal/*` + R2 meshes | races, weapons, armor, equipment, master-weaponSkills, professions, skill trees, grudge6 mesh_ids / gear presets | Equip by template + ledger instance; mesh via R2 grudge6 kits — **not** `cat:` blocks |
| **Voxel Codex** | Mine-Loader `#/defs` · Open Production **Codex** tab (**P**) · Realms codex door | Mine-Loader Railway `blocks` + `gameDefs` + voxelcraft generators | **Blocks** (250+), mechanics prose, item-icon catalog, seed codex links | Place `cat:<slug>`; atlas face = codex look |
| **Nexus Codex** | Grudox / Carrier / nexus library shelf · nexus content catalogs | Nexus / Grudox definition packs + CDN toon/mech assets (info multi-host where published) | mech / toon / metaverse / Carrier content ids, nexus pipeline models | Era=`nexus` heroes only — **not** Realms block place |

**Naming trap:** Mine-Loader docs titled “Nexus-era Voxel SSOT” mean **voxel product lineage**, not character `era=nexus`.  
**Voxel Codex** = blocks/Realms. **Nexus Codex** = sci-fi/mech shelf. Do not merge.

### 3.2 Warlords Codex (detail)

| Slice | Source | Wired to play? |
|-------|--------|----------------|
| Weapons + skills | `weapons.json`, `master-weaponSkills.json` via `fetchCatalogJson` · Open `three/arsenal/*` · `content/masterWeaponSkills` | **Yes** — Danger / combat bar / T0 skills |
| Races + modular kits | `races.json`, `grudge6-gear-presets.json`, `grudge6-canonical.json` | **Yes** — Foundry / Danger grudge6 |
| Armor / equipment / items | `equipment.json`, `armor.json`, `master-items.json`, recipes | Arsenal product + bag templates |
| Classes / professions / trees | `classes.json`, `professions.json`, `master-skillTrees.json`, class relics | Progress / UI trees |
| Equipment production package | R2 / client `codex/equipment-production.json` (when exported) | Deploy artifact — still Warlords family |

**Law:** Warlords Arsenal reads **Warlords Codex** (info master-items / weapon skills).  
It does **not** consume Voxel Codex `/api/blocks` as gear SSOT.

Leaf: [WARLORDS_PLATFORM_SSOT.md](./WARLORDS_PLATFORM_SSOT.md) · skill `grudge-warlords-assets` · `grudge6-full-stack`.

### 3.3 Voxel Codex (detail)

Live: mineloader / mine-loader `#/defs` · Open Production UI **Codex** tab.  
Leaf: [CODEX_AND_VOXEL_GENERATION.md](./CODEX_AND_VOXEL_GENERATION.md) · [VOXEL_LAST30_D1_CODEX.md](./VOXEL_LAST30_D1_CODEX.md).

| Tab / surface | Source | Wired to play? |
|---------------|--------|----------------|
| **Mechanics** | `gameDefs.ts` → `GET /api/definitions` | Rules / map gen prose |
| **Blocks** | Postgres `blocks` + atlas → `cat:<id>` | **Yes** — place in Realms / voxel |
| **Catalog** (item icons) | ~550 icons / 22 packs | Browse reference until inventory opt-in |
| **Maps codex links** | D1 / catalog `codexBlocks` / `codexDefs` | Maps tab deep-links to blocks/defs |

Generators: Mine-Loader `build_block_icons.mjs`, `build_item_catalog.mjs`, …  
**Atlas face is Codex look** — no separate isometric crop.

```http
GET /api/ssot            # discovery contract
GET /api/definitions     # mechanics
GET /api/blocks?limit=N  # full Voxel Codex catalog
GET /api/blocks/{slug}
```

Open: `fetchCodexBlocks()` / `fetchCodexDefinitions()` in `harvestCatalog.ts`.  
Consumers (VoxGrudge, Open voxel): REST only — **do not fork** the block table.

### 3.4 Nexus Codex (detail)

| Slice | Source | Wired to play? |
|-------|--------|----------------|
| Era roster | `/api/characters?era=nexus` · Foundry `?era=nexus` | **Yes** — 4 nexus slots |
| Toon / mech / Grudox content | Nexus library shelf · Grudox cabinets · Carrier | Product hosts on `grudox.*` / nexus cards |
| Definition packs | Nexus / toon catalogs via info multi-host when published | Stats + mesh path pointers |
| Pipeline | `renderPipeline` forced from era on create | Nexus bodies — not grudge6 default, not `cat:` |

**Law:** Nexus Codex content never becomes Realms map avatars or Warlords Danger grudge6 kits without an explicit product bridge.  
Character isolation stays per §2.

### 3.5 Supporting catalogs (not era codexes)

These are real, but they are **not** substitutes for the three era codexes:

| Surface | Role | Belongs with |
|---------|------|--------------|
| **info / ObjectStore multi-host** | Publish + fetch pipe for design JSON | Warlords + Nexus (and shared templates) — §4 |
| **Camp claim catalog** | buildings, units, claim flag, storage keys | Open camp RTS · location inventory |
| **Outdoor / nature D1+R2** | island meshes, nature packs | Warlords outdoor / production world |
| **Amida farm bind** | mesh roles → terrain / `cat:` when online | Voxel place hints + farm layout |
| **enginesource lab** | PlayCanvas examples | **Not** a Grudge codex |

Camp deposit law stays in [LOCATION_INVENTORY_LOCKPICK_SSOT.md](./LOCATION_INVENTORY_LOCKPICK_SSOT.md).

### 3.6 Codex vs definitions vs gamedata vs registry

| Term | Meaning | Write player bag? |
|------|---------|-------------------|
| **Era codex** | Product surface for **one era** (Warlords / Voxel / Nexus) | **No** |
| **Definitions** | Static design JSON published on info (templates, stats) | **No** |
| **Gamedata (R2 bucket)** | Some backend JSON blobs | **No** |
| **Asset registry (D1)** | Index of **binary** R2 keys | **No** |
| **Player / ledger** | Railway rows + bag + ledger events | **Yes** |

Never write player bag into a codex JSON file.  
Never use D1 `asset_registry` as character SSOT.

### 3.7 Separation hard rules

| Do | Do not |
|----|--------|
| Extend **Voxel Codex** generators for new **blocks** | Put Warlords weapons into Mine `gameDefs` as gear SSOT |
| Extend **Warlords Codex** via arsenal + info master-* + grudge6 | Load Voxel `/api/blocks` as Arsenal inventory |
| Extend **Nexus Codex** via Grudox/nexus packs + `era=nexus` | Treat Mine-Loader “Nexus voxel” doc title as character `era=nexus` |
| Fetch Warlords/Nexus design via `fetchCatalogJson` | Hard-code objectstore-only URLs (many 404) |
| Bind Amida → Voxel `/api/blocks` when online | Invent a second block catalog in Open |
| Keep camp under camp content | Merge camp buildings into races.json or blocks |

---

## 4. Definitions (“defines”) layer

Definitions = **template / design data**. Instances of gear use **Grudge UUID / ledger** (§5).

### 4.1 Five-layer stack

Aligned with [CANONICAL_DATA_LAYER.md](./CANONICAL_DATA_LAYER.md) and `SSOT_LAYERS`:

| # | Layer | Host | Owns |
|---|-------|------|------|
| 1 | **Player state** | Railway Postgres | characters, bag, wallet, island, ledger |
| 2 | **Definitions** | **info.grudge-studio.com** | weapons, races, recipes, skills, gear presets |
| 3 | **Binaries** | **assets.grudge-studio.com** (R2) | GLB/FBX/tex/audio |
| 4 | **Asset index** | D1 `grudge-assets-db` | r2Key → metadata / grudge_uuid |
| 5 | **Worlds** | Mine-Loader Railway | seeds, block edits, lobby |

**Dead for new work:** `api.grudge-studio.com`.  
**Legacy fallback only:** raw objectstore host until dual-publish complete.

### 4.2 Canonical catalog files (`FLEET_CATALOGS`)

```ts
// artifacts/animator/src/lib/fleetSsot.ts
export const FLEET_CATALOGS = {
  races: "races.json",
  weapons: "weapons.json",
  equipment: "equipment.json",
  materials: "materials.json",
  armor: "armor.json",
  professions: "professions.json",
  masterItems: "master-items.json",
  masterRecipes: "master-recipes.json",
  masterWeaponSkills: "master-weaponSkills.json",
  grudge6GearPresets: "grudge6-gear-presets.json",
  grudge6Canonical: "grudge6-canonical.json",
  raceModelsV1: "race-models.v1.json",
  raceModels: "race-models.json",
  classes: "classes.json",
  classRelics: "class-relic-skillTrees.json",
  masterSkillTrees: "master-skillTrees.json",
} as const;
```

| Domain | Files (examples) |
|--------|------------------|
| Race / model | `races.json`, `race-models*.json`, grudge6 presets/canonical |
| Combat | `weapons.json`, `master-weaponSkills.json`, armor/equipment |
| Craft / mats | `materials.json`, `master-items.json`, `master-recipes.json` |
| Progress trees | `professions.json`, `master-skillTrees.json`, `classes.json`, class relics |

Fetch:

```ts
import { fetchCatalogJson, FLEET_CATALOGS } from "./lib/fleetSsot";
const skills = await fetchCatalogJson(FLEET_CATALOGS.masterWeaponSkills);
```

### 4.3 Definition host order (multi-host, first live wins)

Probed layout (do not reverse casually):

1. Same-origin `/content` (Vercel rewrite / shipped)  
2. `https://info.grudge-studio.com/content` — gear presets often live **here**, not only under `/api/v1`  
3. `https://assets.grudge-studio.com/content` — R2 content mirror  
4. `info…/api/v1` — materials, weapons, many `master-*`  
5. Same-origin `/api/v1` · `/api/objectstore/v1`  
6. Env `VITE_OBJECTSTORE_URL`  
7. Legacy objectstore host (last; often 404)

`fetchCatalogJson` marks hard 404/410 dead for the session so lobby does not re-probe forever.

### 4.4 Template id vs instance id (define vs unique)

| Concept | Example | Where |
|---------|---------|--------|
| **Definition / template id** | `iron_sword`, race `WK`, skill tree node | info JSON |
| **Stackable bag line** | `stack_<templateId>` + qty | bag / account resources |
| **Unique gear instance** | Railway **grudgeUuid** | `/api/uuid/generate` + ledger |
| **Provisional (guest only)** | `prov_…` | local until sign-in |
| **Banned as signed-in unique** | bare `ent_*` as bag SSOT | runtime entities only |

Weapon **tree branch** ids (`wpn_tree_<family>_tN_<uuid>`) are **progress keys**, not bag item instances ([INVENTORY_BAG_ACCOUNT.md](./INVENTORY_BAG_ACCOUNT.md)).

### 4.5 Era codex → definition packs

| Era codex | Definition / API surface used first |
|-----------|-------------------------------------|
| **Warlords Codex** | grudge6 presets/canonical, races, weapon skills, professions, classes, master-items (info multi-host) |
| **Voxel Codex** | Mine-Loader `/api/blocks` + `/api/definitions` + item catalog icons — **not** Warlords arsenal JSON |
| **Nexus Codex** | toon / nexus / Grudox catalogs (info multi-host when published) |
| armada (future) | naval/mech defs when gated live |

Mesh **files** still resolve through R2; definition JSON only **points** at paths / `mesh_ids`.

### 4.6 Join path (play boot)

```
character.race / model3d / equipment.mesh_ids
  → definition (info) for stats + preset mesh_ids
  → R2 path on assets.grudge-studio.com
  → optional D1 asset_registry row (index only)
```

---

## 5. Grudge UUID (many schemes — keep them straight)

There is **not** one global UUID type. Use the right **family**.

### 5.1 Identity families (full)

| Family | Example | Mint / storage | Used for |
|--------|---------|----------------|----------|
| **Account / human** | `grudgeId` on JWT/account | Grudge ID / Railway users | Account bag key, home vault |
| **Character (fleet)** | Railway uuid or `char_…` | `POST /api/characters` | Hero row, play handoff |
| **Hero pack** | `HERO-…` | character/API pack ids | Display packs |
| **Equipment instance** | `EQIP-…` | item/equip systems | Unique gear (catalog family) |
| **Item instance** | `ITEM-…` | item systems | Unique items (catalog family) |
| **Ledger gear (Open bag)** | structured **grudgeUuid** | `/api/uuid/generate` + `/api/ledger/*` | Production unique bag gear |
| **Stackable line** | `stack_<templateId>` | client bag helper | Mats qty (not unique mint) |
| **Provisional** | `prov_…` | guest local only | Until JWT mint |
| **Runtime entity** | `ent_…` | `newGrudgeId("entity")` | NPC, prop, projectile |
| **Instance / room / zone / portal / script** | `inst_` `room_` `zone_` `portal_` `scr_` | grudge-runtime | Sessions, content |
| **Logical asset key** | `asset_…` | grudge-runtime | Catalog logical id (not R2) |
| **Asset registry (D1)** | sha1 UUID from `r2Key` | D1 `asset_registry` | Binary file identity |
| **Human-prefixed assets** | `HERO-` / `EQIP-` / `ITEM-` on backend catalog | grudge-backend D1 `assets` | Alternate registry — **do not mix blindly** with Railway heroes |
| **Harvest location / instance** | `hrvl_` `hrvi_` `hrvd_` | Mine-Loader harvest SSOT | World harvest pins |
| **Location storage** | `camp:claim_*` `home:<grudgeId>` | Open location inventory | Albion bags |
| **Weapon tree branch** | `wpn_tree_…` | trees.ts | Progress, not bag instance |

### 5.2 Runtime mint (`@workspace/grudge-runtime`)

Code: `lib/grudge-runtime/src/ids.ts`.

```ts
export const ID_PREFIX = {
  character: "char_",
  hero: "HERO-",
  equipment: "EQIP-",
  item: "ITEM-",
  entity: "ent_",
  room: "room_",
  instance: "inst_",
  zone: "zone_",
  portal: "portal_",
  script: "scr_",
  asset: "asset_",
} as const;

import {
  newUuid,
  newGrudgeId,
  newInstanceId,
  detectIdKind,
  isCharacterId,
  encodeWirePlayerName,
  decodeWirePlayerName,
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
5. `isCharacterId` accepts `char_` / `HERO-` / `"guest"`.  
6. Multiplayer display names may contain `|` — wire uses **unit separator** `\u001f`.

### 5.3 Ledger unique gear (production bag)

Law (`ledgerClient.ts`):

| Item kind | Production path |
|-----------|-----------------|
| Stackable mats | account resources / bag qty (definition id + qty) |
| Unique gear / craft / equip | `POST /api/uuid/generate` → ledger events |
| Open localStorage bag | **cache only** when signed in |

Ledger event types include: `CREATED`, `ASSIGNED`, `EQUIPPED`, `UNEQUIPPED`, `UPGRADED`, `CONSUMED`, `TRANSFERRED`, `DESTROYED`, `ARCHIVED`.

```
mintUniqueItemInstance(templateId)
  → generateGrudgeUuid({ slot, tier, itemId })
  → /api/uuid/generate
  → item.instanceId = grudgeUuid
  → /api/ledger/* on equip/transfer/destroy
```

**Banned as production bag SSOT while signed in:** client-only `ent_*`, bare provisional uniques.

### 5.4 Asset UUID (Cloudflare D1)

```
grudge_uuid = formatUuid(sha1("grudge-asset:" + r2Key))
```

- Same `r2Key` → same uuid (idempotent re-upload).  
- **Not** a character id.  
- Join: character.race / modelPath → path → R2 → optional registry row.  
- Scripts: `scripts/lib/assetUuid.mjs` · skill `grudge-d1-r2`.

### 5.5 Account / location ids for bags

| Context | Id |
|---------|-----|
| Signed in account | `account.grudgeId` |
| Guest | `guest` |
| Home island location store | `home:<grudgeId>` |
| Camp store | `camp:claim_<characterId>` |

See `claimKeyForCharacter` / `accountIdForVault` in Open `locationInventory.ts`.  
Home island = shared account bag (no lockpick). Foreign/contested camps + hidden loot = lockpickable.

### 5.6 Anti-patterns

| Bad | Good |
|-----|------|
| Use D1 asset uuid as character id | Railway character uuid / `char_` |
| One uuid type for files + heroes + bag items | Family table §5.1 |
| Seed-derived entity ids | `newGrudgeId` / `newInstanceId` |
| Provisional unique gear when JWT present | Ledger mint |
| Merge era rosters into one 16-slot bag of heroes | 4 × 4 era shelves |
| Definitions only on objectstore | **info** primary + multi-host fallback |
| Mine-Loader worlds DB as hero SSOT | Railway `/api/characters?era=` |
| Puter UUID as production character id | Grudge ID + Railway |
| Cross-era saveData clobber | Namespace per app/era |
| Merge Warlords / Voxel / Nexus into one “fleet codex” | Three era codexes (§3) |
| Call Voxel Codex the “Nexus Codex” | Voxel = blocks; Nexus = sci-fi/mech shelf |

---

## 6. How eras × codexes × UUIDs meet at play time

```
1. Login (Grudge ID) → JWT  (account.grudgeId)
2. Pick era shelf → GET /api/characters?era=<era>
3. Select characterId (Railway uuid)  [per-era selection map]
4. Load that era’s codex:
     warlords → Warlords Codex (info master-* + arsenal + grudge6)
     voxel    → Voxel Codex    (/api/blocks + /api/definitions)
     nexus    → Nexus Codex    (Grudox/nexus packs + era pipeline)
5. Resolve mesh_ids / paths → assets.grudge-studio.com (R2)
   optional: D1 grudge_uuid index for the file
6. Play:
   - Account bag (shared) for mats when deposited home
   - Camp storage (claim key) for RTS
   - Character bag 3×3 carry
   - Ledger grudgeUuid for unique gear
   - Runtime ent_/inst_ for scene entities (not bag)
7. Worlds (voxel era only): Mine-Loader seed + Voxel Codex placeables
```

---

## 7. enginesource / Cloudflare (where it fits)

| Layer | enginesource | Fleet |
|-------|--------------|-------|
| Eras / characters | **None** | Railway eras |
| Codex / definitions | Example assets only | **Warlords + Voxel + Nexus** codexes · info publish pipe |
| Grudge UUID | **None** | grudge-runtime + Railway + D1 asset uuid |
| Binaries | Lab GLB/KTX2/Basis | R2 CDN |
| Deploy helper | Build flavors ESM/UMD | Vercel SPA + CF CDN Worker |

PlayCanvas is a **lab engine**, not an era and not a codex.  
See [ENGINE_SOURCE_CLOUDFLARE_SSOT.md](./ENGINE_SOURCE_CLOUDFLARE_SSOT.md).

---

## 8. Agent checklist

- [ ] Know which **era** and which **era codex** (Warlords / Voxel / Nexus) before loading content  
- [ ] Account bag ≠ character equip ≠ D1 asset uuid  
- [ ] Warlords design via **Warlords Codex** + info multi-host; binaries from **assets**  
- [ ] Voxel placeables via **Voxel Codex** `/api/blocks` — never fork the block table  
- [ ] Nexus content via **Nexus Codex** + `era=nexus` — not Realms blocks, not grudge6 default  
- [ ] Template id (define) ≠ instance grudgeUuid (unique) ≠ `stack_` (qty)  
- [ ] Mint runtime entities with `newGrudgeId`; harvest pins with Mine SSOT; uniques with ledger  
- [ ] Home island never lockpick; camp uses `claim_<characterId>`  
- [ ] Do not invent a fifth product era without `FLEET_CHARACTER_ERAS` + Railway `era_slots` + Foundry  
- [ ] Independent titles: login via Grudge ID only — no fake `?era=flare` on fleet API  

---

## 9. Smoke

```bash
# Auth + era roster (401 without token is OK — proves rewrite, not 404)
curl -s -o NUL -w "%{http_code}\n" \
  "https://open.grudge-studio.com/api/characters?era=warlords"
curl -s -o NUL -w "%{http_code}\n" \
  "https://mineloader.grudge-studio.com/api/characters?era=voxel"

# With JWT
curl -sH "Authorization: Bearer $JWT" \
  "https://open.grudge-studio.com/api/characters?era=warlords" | head

# Warlords Codex (definitions publish pipe)
curl -sI https://info.grudge-studio.com/content/grudge6-gear-presets.json
curl -sI https://info.grudge-studio.com/api/v1/master-weaponSkills.json
curl -sI https://info.grudge-studio.com/api/v1/materials.json

# Binaries (shared CDN)
curl -sI https://assets.grudge-studio.com/models/grudge6/races/WK_Characters.fbx

# Voxel Codex
curl -s "https://mineloader.grudge-studio.com/api/ssot" | head
curl -s "https://mineloader.grudge-studio.com/api/definitions" | head
curl -s "https://mineloader.grudge-studio.com/api/blocks?limit=3" | head
```

---

## 10. Related skills

| Skill / doc | When |
|-------------|------|
| `grudge-studio` → `grudge-production-wiring` | Auth, characters, bag |
| `grudge-d1-r2` | Asset index + R2 only |
| `grudge-foundry` | 4-slot create, era handoff |
| `open-camp-location-inventory` | Camp / home / lockpick |
| `mine-loader-harvest-chests` | Voxel harvest / chests |
| `grudge-warlords-assets` | Warlords-era CDN content |
| skill-catalog row | Eras · codexes · definitions · UUID → this doc |
