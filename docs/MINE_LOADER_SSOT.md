# Mine-Loader SSOT — editor, worlds, deploy, combat production

**Source of truth (promote + consolidate here):**  
https://github.com/MolochDaGod/mine-loader  

**Local clone:** `D:\GitHub\minegrudge\Mine-Loader`  
**Live Realms:** https://mineloader.grudge-studio.com (edge: `mine.grudge-studio.com` when CF live)  

**Open hub:** https://open.grudge-studio.com — library / account / Danger Room / **voxel editor**  
**Open voxel maps:** https://open.grudge-studio.com/voxel (premade Danger Room templates → playtest)

This doc is the fleet contract for **world authoring → lobby hosting → PvP danger rooms**, wired through **Grudge accounts**.

---

## 1. Ownership matrix

| Concern | SSOT repo | Consumed by |
|---------|-----------|-------------|
| Block catalog (250+ types), roles, rarities | **mine-loader** `lib/db` + `/api/blocks` | Open editor, GRUDOX, VoxGrudge |
| Scene format (`blockEdits`, spawn, colliders, props, npcs) | **mine-loader** scene + `lib/world-protocol` | Realms WS authority |
| World authority (1 replica) + Postgres | **mine-loader** `api-server` | Lobby multiplayer |
| Interchange dual-format | **gameopen** `lib/voxel-canonical` | Open ↔ Realms maps |
| Danger Room combat (T0, parry/block, MM) | **gameopen** `epicfight` + Studio | `/danger`, map playtest |
| Controllers / cameras (adopt pattern) | **gameopen** Controller + PhysicsSystem | All 3D Open modes |
| Icons / UI kits | Mine-Loader public + Open `public/icons` | HUDs |
| Fleet identity / characters | GrudgeBuilder Postgres | Both via `/api/characters` |
| Definition JSON (weapons master) | ObjectStore D1 | Both via `/api/objectstore` |

**Rule:** Promote world/editor/deploy features **into mine-loader first**, then consume from Open. Do not fork a second world server in gameopen.

---

## 2. Promote path (Open voxel → Realms lobby)

```
open.grudge-studio.com/voxel
  │  author map (premade Danger Room templates OK)
  │  export interchange (open + scene)
  ▼
lib/voxel-canonical  convertOpenToScene / exportInterchange
  ▼
Mine-Loader API  (POST scene / world room — fleet)
  │  DATABASE_URL Postgres · single replica
  ▼
mineloader.grudge-studio.com  /#/play  or lobby room
  │  SSO: sso_token + characterId + open=1 + from=gameopen
  ▼
Account-bound character appears in world
```

### Account wiring
1. Player signs in on Open or Realms with **same Grudge ID**.  
2. Character UUID from Builder Postgres travels as `characterId`.  
3. Realms peer transform may carry `eq` equipment blob (world-protocol).  
4. Danger Room / map playtest uses same character race → avatar resolve.

### Deploy checklist (host a world)
1. Mine-Loader: Railway API + Postgres, **replicas = 1**.  
2. Vercel SPA + `/api/*` rewrite to Railway host.  
3. CF edge optional (`mine.grudge-studio.com`).  
4. Open library card → Realms URL with SSO params (`gameLibrary.ts`).  
5. Smoke: `/api/healthz`, `/api/blocks?limit=1`, join lobby as authenticated user.

See mine-loader `docs/FLEET_DEPLOY.md`.

---

## 3. Premade Danger Rooms in Open voxel

Location: `artifacts/animator/src/three/voxel/templates.ts`  
Storage: `mapStore` keys `dangerroom:voxelmaps` / `dangerroom:voxelmap:<id>`.

**Practices:**
- Always place a **player start** deployable so **Test / Play** works.  
- Use **canonical block type ids** (`stone`, `grass`, `cat:…`) not free hex alone.  
- Export **interchange** before promoting to Realms (keeps `scene.blockEdits`).  
- For **PvP / combat playtest**: Play map → Open loads map into Studio Danger path with Rapier arena (`VoxelArena`) when map has collidable mesh.

---

## 4. Production physics, colliders, raycasts

### 4.1 Physics (Rapier)
| Standard | Value / practice |
|----------|------------------|
| Engine | `@dimforge/rapier3d-compat` via `PhysicsSystem` |
| Timestep | **fixed 1/60**, max 5 substeps/frame |
| Gravity Y | **−12** (Danger Room default; tune per game, document if different) |
| Ground | Large **cuboid** plane (not infinite plane) for capsule rest |
| Static world | **Trimesh** from mesh world-space triangles after bake |
| Player | **Kinematic capsule** + `KinematicCharacterController` offset ~0.08 |

### 4.2 Colliders (deploy as production)
1. **Author** visual mesh in editor (blocks / props with `collide: true`).  
2. **Bake** after placement: `updateMatrixWorld` → extract vertices/indices in **world space**.  
3. **Static** fixed body for environment; dynamic only for props that move.  
4. **Never** scale colliders after bake without re-bake.  
5. **Layers** (future): world vs hitbox vs trigger — keep combat hit volumes in epicfight colliders separate from walk colliders.

### 4.3 Raycasting
| Use | Practice |
|-----|----------|
| Camera occlusion | Third-person ray from pivot to camera; pull in if hit (`Controller` occluders) |
| Aim / soft lock | `AimSystem` raycast list (bones + dummies); document bone name conventions |
| Block place/break | Grid ray from camera through crosshair; snap to cell |
| Combat hits | Prefer **swept hit volumes** (epicfight colliders) over single ray for melee |

### 4.4 Animations
| Layer | Owner |
|-------|--------|
| Locomotion blend | Character / Explorer Animator |
| Combat one-shots | Studio + epicfight timing (windup/active/recovery) |
| Realms peers | world-protocol peer transform + held item — no full anim SSOT yet |
| Promote rule | Clip names and T0 skill labels stay weapon-driven (`t0WeaponSkills`) |

---

## 5. Controller & camera adoption (cross-game)

**Reference implementation:** `Controller.ts` + `PhysicsSystem.ts` (Danger Room / dungeon).

| Feature | Standard |
|---------|----------|
| Move | Camera-relative WASD |
| View | Third orbit **or** first-person (`viewMode`) |
| Jump | Ground + **one** mid-air double jump |
| Collision | Pluggable `CollisionProvider` (Rapier KCC) **or** flat floor + obstacle circles |
| Knockback | External velocity impulse with exp damp |
| Lock-on | Optional `lockTarget` world point; strafe relative |
| Water | Optional `WaterBand` sink clamp |
| Camera ray | Occluder mesh list for wall pull-in |

**Adoption checklist for a new game:**
1. Copy **interface** (`CollisionProvider`, fixed-step physics), not the whole Studio.  
2. Keep **one** player capsule height aligned to `CHARACTER_HEIGHT_M` / fitCharacterHeight.  
3. Do not invent a second gravity or tick rate without documenting.  
4. Combat games: drive defense through `CombatController` (T0 windows).  
5. World games: movement authority on Mine-Loader server; client predicts only.

Shared constants module (Open): `artifacts/animator/src/lib/productionRuntime.ts`  
(Import from new modes; keep numbers in one place.)

---

## 6. Danger Room PvP vs Realms lobby

| Mode | Physics | Authority | Account |
|------|---------|-----------|---------|
| Danger sparring / map play | Local Rapier + epicfight | Host client / danger-net | Character for avatar |
| Ruins Brawler | Local + brawl-net | Room host | Character optional |
| Mine-Loader lobby world | Server world memory + Postgres | **API single replica** | Character required for persistence |
| Carrier / space | Game process co-located WS | Same process as HTTP | JWT on socket |

**Do not** use multi-replica world servers.  
**Do** use Open for combat labs; Realms for persistent shared worlds.

---

## 7. Icons, assets, constants organization

| Kind | Mine-Loader | Open |
|------|-------------|------|
| Block icons | block-icons / catalog | Proxy `/api/blocks` + local palette |
| HUD icons | — | `public/icons/` (50) |
| UI frames | CraftPix in packs | `public/rooms/*-scene.png` library art |
| Scripts | `scripts/vercel-build`, package-local-release | `scripts/vercel-build`, content-index |
| Env | `DATABASE_URL`, `GRUDGE_API_BASE` | VITE_* + vercel rewrites |

Promote shared **block type constants** via `@workspace/voxel-canonical` only — update that package when Realms catalog changes.

---

## 8. Database sync

| DB | Role | Sync |
|----|------|------|
| Builder Postgres | Characters, wallet | Open/Realms proxy only |
| Mine-Loader Postgres | World chunks, block catalog seed | API self-seed + `db push-force` once |
| ObjectStore D1 | Weapon/item defs | CDN JSON; no world state |
| Browser localStorage | Open map drafts, local chars | Never source of production world truth |

**Sync practice:** Character → Builder. World edits → Mine-Loader API. Defs → ObjectStore. No dual-write of world cells to Builder.

---

## 9. Easy deploy recipes

### Realms (host worlds)
```bash
cd D:\GitHub\minegrudge\Mine-Loader
# Railway: Dockerfile.api + Postgres, 1 replica
# Vercel: root vercel.json, rewrite /api → Railway
# CF: infra/cloudflare/mine
pnpm build:web
npx vercel --prod
```

### Open (labs + editor)
```bash
cd D:\GitHub\gameopen
node scripts/vercel-build.mjs
npx vercel --prod
# Edge: infra/cloudflare/open
```

### Promote a Danger Room map to lobby
1. Open `/voxel` → pick premade template → polish.  
2. Export interchange JSON.  
3. Import / upload to Mine-Loader scene API (or hand-seed).  
4. Join Realms with `characterId` + SSO.  
5. Optional: link from Open library as custom world URL.

---

## 10. Related docs

| Doc | Repo |
|-----|------|
| `docs/FLEET_DEPLOY.md` | mine-loader |
| `docs/VOXEL_CANONICAL.md` | gameopen |
| `docs/OPEN_STACK.md` | gameopen |
| `docs/DANGER_ROOM_T0_COMBAT.md` | gameopen |
| `docs/GAME_LIBRARY_AND_DEPLOY.md` | gameopen |

---

## 11. Anti-patterns

- Second world authority inside gameopen Railway  
- Replit as production Realms  
- Free-color-only maps without `type` ids  
- Scaling GLB without `fitCharacterHeight`  
- Combat damage outside `CombatController`  
- Multi-replica Mine-Loader API  
- Camera collision that ignores occluder ray  
- Baking colliders before final world matrix  
