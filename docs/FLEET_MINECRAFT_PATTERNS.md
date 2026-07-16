# Grudge Fleet — Deployments, Lobby, Games & Minecraft Mechanics

**Status:** Architecture review + practice definitions (2026-07-15)  
**Audience:** Agents and humans shipping Open, Realms (Mine-Loader), Danger Room, and fleet satellites  
**Related:** [MINE_LOADER_SSOT.md](./MINE_LOADER_SSOT.md) · [GAME_LIBRARY_AND_DEPLOY.md](./GAME_LIBRARY_AND_DEPLOY.md) · [OPEN_STACK.md](./OPEN_STACK.md) · skills `grudge-fleet`, `grudge-live-servers`, `grudge-warlords-assets`

---

## 0. One-sentence map

| Layer | What it is | SSOT |
|-------|------------|------|
| **Open** | Steam-like launcher + combat labs + voxel authoring | `gameopen` → open.grudge-studio.com |
| **Realms** | Minecraft-like persistent voxel worlds | `Mine-Loader` → mine-loader.vercel.app (+ mine. edge) |
| **Identity** | One account everywhere | Grudge ID + Builder Postgres characters |
| **Assets** | Binary models/textures/icons | R2 `assets.grudge-studio.com` + ObjectStore JSON |
| **Live multiplayer** | Minimal servers | Carrier co-located WS · Railway world API (1 replica) · Colyseus (Warlords) |

---

## 1. Definitions (use these words consistently)

| Term | Definition | Anti-definition |
|------|------------|-----------------|
| **Launcher / Open** | Browser shell that lists games, holds SSO, hosts native engines (Danger, Brawl, editors) and **in-app canvas** embeds | Not the world authority for Realms blocks |
| **Lobby** | Room list / join UI before a shared world session (Mine-Loader `#/lobby`, Open multiplayer Lobby) | Not the Steam-style library catalog (that is **Library**) |
| **Library** | Catalog of fleet titles (GameEntry + posters) | Not the live game server |
| **Native mode** | Engine runs **in-process** in Open (`AppMode`: danger, brawl, voxel, …) | Not an iframe of another SPA |
| **In-app canvas** | Full-bleed iframe of a **production** fleet SPA with SSO query handoff | Not `window.open` as the primary path; not embedding broken same-origin stubs |
| **Zone** | GRUDOX card (brawler, racer, Realms, island, …) | Not a Minecraft chunk |
| **World / Realms** | Server-authoritative voxel world (seed + scene + block edits) | Not localStorage drafts on Open |
| **Chunk** | Indexed world slice (`chunkIdx` + seed-driven terrain); edits stored as **cell diffs** | Not client-owned permanent terrain |
| **Block** | Typed cell id (`stone`, `cat:<catalogId>`, air=null) with atlas/icon metadata | Not free hex color without type |
| **Scene** | Authored props, NPCs, colliders, triggers, spawn — **without** terrain diffs | Not the full world state alone |
| **Character** | Fleet hero row (UUID) + race/class/equipment — Builder Postgres | Not a local-only avatar blob as SSOT |
| **Deploy** | GitHub → Vercel (SPA) + Railway (API, 1 replica) + optional CF edge | Not Replit Publish for production |

---

## 2. Deployment topology (best practices)

### 2.1 Standard three-tier deploy

```
Browser
  │  SPA (Vercel)  — open.grudge-studio.com / mine-loader.vercel.app / …
  │  same-origin /api/* rewrites
  ▼
Edge (optional CF Worker)  — mine. / open. / forge. aliases
  ▼
API / World (Railway)      — Mine-Loader api-server OR GrudgeBuilder Colyseus
  │
  ├── Postgres             — worlds, block_edits, progress (Realms)
  │                        — characters, island, wallet (Builder)
  └── Assets               — R2 CDN + ObjectStore JSON (not on Railway disk)
```

### 2.2 Rules that prevent outages

1. **One world API replica** — in-memory `WorldRoom` + Postgres flush. Multi-replica = split brain.  
2. **Same-origin API proxy** — Vercel rewrites `/api/*` so cookies and no CORS preflight.  
3. **Never Replit as production Realms.**  
4. **Promote world features into Mine-Loader first**, then consume from Open.  
5. **No second character DB** on Realms — heroes stay Builder; Realms only caches membership/progress.  
6. **Magic-byte / real CDN assets** — never treat HTML fake-200 as GLB/FBX (grudge-warlords-assets).  
7. **Health before announce** — `/api/health` or `/api/healthz`, `/api/blocks?limit=1`, title tag smoke.

### 2.3 Multiplayer pattern picker

| Pattern | Use when | Example |
|---------|----------|---------|
| **Carrier** co-located WS | New browser game, one process | `/api/carrier` on same host as HTTP |
| **Mine-Loader WorldRoom** | Voxel Realms authority | Railway api-server + world-protocol WS |
| **Colyseus** | Warlords lobby/dungeon | GrudgeBuilder Railway |
| **danger-net / brawl-net** | Open combat rooms | Host-authoritative lab sparring |
| **pvp-server** socket.io | Isolated mech rooms | Railway pvp-server |

**Default for new titles:** Carrier or “host client lab” first; graduate to Railway world authority only when persistence is required.

### 2.4 Open launch matrix (post in-app canvas)

| Title type | Launch | Practice |
|------------|--------|----------|
| Combat lab | Native `AppMode` | danger, brawl, mimic |
| Fleet SPA | **InAppGameCanvas** iframe | Realms, DCQ, island, genesis |
| Pop-out | Opt-in only | When X-Frame-Options blocks embed |
| Auth handoff | Query | `grudge_token` + `characterId` + `open=1` + `from=` |

Code: `lib/inAppLaunch.ts`, `components/InAppGameCanvas.tsx`, `game/grudoxZones.ts`, `game/gameLibrary.ts`.

---

## 3. Lobby & game session model

### 3.1 Player journey

```
Sign in (Grudge ID)
  → Select character (Account / campfire)
  → Library or Zones
       ├─ Native: navigate AppMode (stays on open.*)
       ├─ Embed: InAppGameCanvas → production SPA + SSO
       └─ Realms deep path: Lobby → Join world → Play
  → WorldRoom snapshot (seed, chunkIdx, tod, scene+blockEdits)
  → Client predicts movement; server validates blocks / progress
```

### 3.2 Lobby responsibilities

| Surface | Owns | Does not own |
|---------|------|--------------|
| Open Lobby | Community maps, danger rooms list | Realms block truth |
| Mine-Loader Lobby | World list, invite codes, join | Character CRUD |
| GRUDOX Zones | Card catalog + launch policy | Game physics |

### 3.3 Session / progress namespaces

- Open: `saveData.open` (labs, loadouts, lastMode)  
- Realms: `saveData.realms` + server `progress` rows per (playerId, worldId)  
- Never dual-write world cells into Builder Postgres

---

## 4. Minecraft mechanics ↔ Grudge implementations

Traditional Minecraft systems mapped to **what we actually ship**.

### 4.1 Blocks

| Minecraft | Grudge Realms | Practice |
|-----------|---------------|----------|
| Block registry | `blockCatalog` 250+ + `/api/blocks` + DB seed | Typed ids; `cat:<id>` for catalog tiles |
| Atlas / textures | `catalog_atlas.png` + per-block icons | Build scripts bake icons; proxy via Open `/api/blocks` |
| Place / break | Client intent → **server validates** → broadcast `block` | Client never sole authority |
| Air / destroy | `type: null` edit row | Upsert/delete in `world_block_edits` |

**SSOT files:**  
- Client: `Mine-Loader/artifacts/voxelcraft/src/lib/blockCatalog*.ts`  
- Server: `artifacts/api-server/src/routes/blocks.ts`  
- DB: `lib/db/src/schema/blocks.ts` + seed JSON  
- Open interchange: `@workspace/voxel-canonical`

### 4.2 Chunks & terrain

| Minecraft | Grudge | Practice |
|-----------|--------|----------|
| Chunk sections | `chunkIdx` + seed procedural terrain | Same seed → same base world |
| Chunk save | Diff table `world_block_edits` (x,y,z,type) | Batch flush from memory room |
| Chunk load | Snapshot: seed + scene + merged blockEdits | Client rebuilds mesh from snapshot |

**Do not** store full voxel arrays in Postgres for every chunk — store **edits only**.

### 4.3 Crafting

Two pure systems (no React / engine deps — unit-testable):

| System | Minecraft analogue | Module |
|--------|--------------------|--------|
| **Shaped 5×5 grid** | Crafting table shape match (trim empty border) | `gridCraft.ts` |
| **Recipe list / bench** | Shapeless + category benches | `recipes.ts` |
| **UI** | Crafting table UI | `CraftingBench.tsx` |
| **Stations** | Furnace / anvil props | `public/assets/stations/*` + model library |

Practices:
- Recipes are **data** (`GRID_RECIPES`, `Recipe[]`); discovery/blueprint flags like MC recipe book.  
- Materials registry (`MATERIALS`) supplies name/emoji; tools have 3D held models when catalogued.  
- Open / Warlords crafting: ObjectStore materials + `grudge-crafting.puter.site` for fleet economy — do not invent a third recipe SSOT without linking ids.

### 4.4 Inventory / items

| Minecraft | Grudge | Module |
|-----------|--------|--------|
| Item registry | `itemCatalog` + `items.ts` | ids, stacks, kinds |
| Hotbar | `PlayHotbar.tsx` | held item → peer `held` field |
| Containers | `ContainerPanel.tsx` | chests / bags |
| Held visuals | `heldItemState.ts` + modelLibrary | tools/weapons GLBs |

### 4.5 Entities, AI, NPCs

| Minecraft | Grudge | Practice |
|-----------|--------|----------|
| Mob AI | Client **foe-authority** (elected peer) + custom foe defs | Server relays snaps; first joiner runs AI |
| Villagers | `villagers.ts` + ally roles | Speed, roles, path hooks |
| Boss | `CustomFoeDef` stages / AOE | Data-driven, clamped stats |
| NPC chat | `NpcChat.tsx` | Dialogue not world authority |
| Server AI jobs | `api-server/src/ai/*` | Optional GenAI jobs — not combat tick |

**Pattern:** Combat AI for Realms is **simulation-elected**, not full server-side pathfinding yet. Open Danger Room uses **FighterBrain** (goal evaluators) with weapon roles.

### 4.6 Multiplayer networking

| Minecraft | Grudge Realms | Practice |
|-----------|---------------|----------|
| Protocol | `@workspace/world-protocol` | Zod-validated `t` discriminant messages |
| Join | Snapshot + peers | `WorldSnapshot` includes terrain edits |
| Move | Peer transform stream | `PeerTransform` + optional `eq` equipment |
| Combat | `act` / `hit` / foe snaps | Validated server-side bounds |
| Co-op offline | Trystero / peer path | Same message shapes as server path |

Wire file: `lib/world-protocol/src/index.ts`  
Room authority: `api-server/src/world/room.ts` (`WorldRoom`)

### 4.7 Scripting / content extension

| Need | Solution | Location |
|------|----------|----------|
| Player-authored foes/missions | **JSON data** in `SceneDoc.custom` | `customContent.ts` |
| Map templates | Data + normalize | `mapTemplates.ts`, dungeon-spec |
| Runtime jobs / events | Event bus + scheduler | `api-server/src/runtime/*` |
| Open combat skills | T0 + master-weaponSkills JSON | gameopen arsenal / content API |
| Fleet AI generation | `ai.grudge-studio.com` | Optional; never required for world tick |
| Sandbox JS | Prefer **data + pure modules** over eval | No untrusted `eval` of player scripts in prod |

**Best practice:** Prefer **declarative content** (recipes, foes, missions, block ids) over arbitrary JS. When scripting is needed, run **server-side jobs** (AI / batch) or sandboxed workers — not client `eval` of world scripts.

### 4.8 Dungeons / navigation

| Minecraft | Grudge | Module |
|-----------|--------|--------|
| Structure gen | `dungeonBuilder` + dungeon-spec | Char grid → 3D |
| Pathing | `dungeonNav` | Nav graph for foes/allies |
| Minimap | `DungeonMinimap.tsx` | UI only |

### 4.9 Seed worlds & portal dungeons (deployments)

| Minecraft | Grudge | Practice |
|-----------|--------|----------|
| World seed | `WorldSnapshot.seed` + `hashSeed(label)` | Same seed ⇒ same overworld base |
| Stronghold / portal | `triggers.kind = "portal"` in seed deployment scene | Placed deterministically around spawn |
| Enter Nether/end | Load dungeon instance from `portal.target` | `dungeonSeed = mix(worldSeed, portalId)` |
| Return | Exit → `returnPosition` at overworld portal | `returnToPortal: true` |
| Deploy / multiplayer | Mine-Loader share `POST /api/worlds` or seed query | Open catalogs in `content/worlds/seed-deployments.json` |

**Contract:** `@workspace/voxel-canonical` `seedWorld.ts` · **UI:** Production Maps tab · **Doc:** [SEED_WORLD_DEPLOY.md](./SEED_WORLD_DEPLOY.md)

**Production rule:** Dungeons are **found** via open-world portals, not primary free teleport menus.

---

## 5. Animation blending & libraries

### 5.1 Two animation stacks (do not mix SSOT)

| Stack | Where | Role |
|-------|-------|------|
| **grudge6 combat** | Open Danger / GrudgeAvatar | Bip001 baked packs: idle/walk/run/attack + skill aliases (`grudge6Runtime`, `weaponSkillPacks`, T0 kits) |
| **Realms character** | Mine-Loader `CharacterAnimator` | Mixer + base locomotion crossfade + one-shot attack/hit/death |

### 5.2 Blending practices (both stacks)

1. **Base loop** = locomotion (idle/walk/run or pack idle/run).  
2. **One-shot overlay** = attack/cast/hurt/death; clampWhenFinished; fade base out/in.  
3. **Crossfade times** ~0.12–0.25 s; combat windups own their clip duration for recover windows.  
4. **Alias missing clips** → `attack` (Open skill slots / AI) — never leave T-pose.  
5. **Height** via `fitCharacterHeight` / PLAYER_HEIGHT_M — never ad-hoc scale.  
6. **Equipment** = mesh visibility (grudge6 prefixes) or held item model — not mesh swap of whole body.

### 5.3 Animation libraries / sources

| Library | Use |
|---------|-----|
| Baked Bip001 JSON (`/anims/baked/*`) | grudge6 packs sword_shield, longbow, magic, unarmed |
| Arena GLB races | Combat skinned meshes |
| Race FBX Toon RTS | Atlas rebind SSOT |
| voxelcraft modelLibrary FBX/GLB | Box hero / tools / creatures |
| epicFightLoader (Realms) | Optional combat timing bridge |

Promote rule: **clip names and skill labels stay weapon-driven** (T0 / weaponSkillPacks / animKey).

---

## 6. Servers — ownership checklist

| Server process | Repo | Auth | State |
|----------------|------|------|-------|
| Mine-Loader API | mine-loader `api-server` | Grudge JWT | Worlds, blocks, lobby, NPCs routes |
| GrudgeBuilder | GrudgeBuilder `server` | Grudge JWT | Characters, island, Colyseus |
| Open Railway API | gameopen-production | Session | Content / secondary only |
| Carrier | co-located on game API | JWT | Room sim 20–30 Hz |
| ObjectStore / CDN | CF Workers | Public read | Catalogs + binaries |

**Auth on every WS:** verify Grudge token; bind `playerId` for persistence; `connId` per tab for avatars.

---

## 7. Development patterns (Minecraft-inspired backlog)

Ordered for fleet coherence — implement against these contracts, not greenfield forks.

| Priority | Pattern | Where to land |
|----------|---------|---------------|
| P0 | Server-auth block place/break + edit flush | Mine-Loader WorldRoom (exists) |
| P0 | In-app launch + SSO | Open inAppLaunch (exists) |
| P1 | Voxel Editor export → Realms scene push | Open voxel-canonical → Mine-Loader API |
| P1 | Shaped crafting parity in Open island/economy | Link ObjectStore ids ↔ gridCraft materials |
| P2 | Chunk streaming / far LOD | Extend chunkIdx + client unload rings |
| P2 | Server-side mob AI (optional) | Move foe-authority off client election |
| P2 | JS content packs (sandboxed) | Data modules + schema, not eval |
| P3 | Cross-game skill clip share | Shared baked anim host + animKey registry |

---

## 8. Anti-patterns (hard bans)

| Ban | Why |
|-----|-----|
| Multi-replica Realms API | Split world memory |
| Replit production Realms | Unstable authority |
| Second character database | Identity drift |
| Free-color maps without block types | Broken interchange |
| Capsule/Meshy as shipped heroes | Assets skill ban |
| `window.open` as only game launch | Breaks “Open as hub” |
| Combat damage outside CombatController / validated hit msgs | Desync / cheat |
| Baking colliders before final world matrix | Wrong hitboxes |
| Eval of player-uploaded JS in the hot path | Security |

---

## 9. Agent / human quick checklist

### Shipping a lobby game
1. Register `GameEntry` or zone card.  
2. Native vs embed decision (`nativeModeForZone` / library launch).  
3. SSO params on every external URL.  
4. Poster via `assetUrl(rooms/…)`.  
5. Smoke launch on open.grudge-studio.com/zones.

### Shipping a Minecraft-like feature
1. Spec as **data** (block id, recipe, foe def) first.  
2. Pure module + unit tests.  
3. Wire UI.  
4. If shared world: validate on **server**, persist edit/progress.  
5. Document SSOT in Mine-Loader docs; link from Open MINE_LOADER_SSOT.

### Shipping deploy
1. Vercel SPA + rewrites.  
2. Railway API + Postgres + **1 replica**.  
3. CORS / origins include open + mine + vercel previews.  
4. Health endpoints.  
5. Never promote from Replit.

---

## 10. Canonical code index

| Concern | Path |
|---------|------|
| Open library | `gameopen/.../game/gameLibrary.ts` |
| Zones / deep links | `gameopen/.../game/grudoxZones.ts` |
| In-app canvas | `gameopen/.../lib/inAppLaunch.ts`, `InAppGameCanvas.tsx` |
| World protocol | `Mine-Loader/lib/world-protocol` |
| World room | `Mine-Loader/artifacts/api-server/src/world/room.ts` |
| Blocks API | `.../routes/blocks.ts` |
| Grid craft | `voxelcraft/src/lib/gridCraft.ts` |
| Recipes | `voxelcraft/src/lib/recipes.ts` |
| Animator | `voxelcraft/src/lib/characterAnimator.ts` |
| Custom content | `voxelcraft/src/lib/customContent.ts` |
| Persistent schema | `Mine-Loader/lib/db/src/schema/persistentWorld.ts` |
| grudge6 anim packs | `gameopen/.../grudge/grudge6Runtime.ts`, `weaponSkillPacks.ts` |
| Fighter AI | `gameopen/.../ai/FighterBrain.ts` |

---

*This document is the review snapshot. Prefer updating Mine-Loader SSOT docs when world contracts change; prefer updating this file when **cross-product** patterns (Open + Realms + deploy + MC mechanics) change.*
