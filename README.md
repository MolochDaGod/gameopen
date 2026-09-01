# Grudge Open (`gameopen`)

**Canonical live origin:** [open.grudge-studio.com](https://open.grudge-studio.com)

**Product:** Steam-like collection shell — **library**, **in-app canvas**, **arcade**, **accounts**, **saves**, **characters**, **editors**, **Mine-Loader Realms**, **Warlord Genesis**, GRUDOX arcade, and the all-era **Danger Room** combat lab. One origin; fleet SSO; Railway characters / `saveData.open`.

The default procedural **Explorer** supports weapon-specific locomotion and
multi-hit combos for sword, knife, axe, greatsword, mace, spear, greataxe,
two-handed hammer, bow, rifle, pistol, and magic. It also ships guarded-hit,
knockback, knockdown, recovery, and casting animation variants.

**Production tools:** in-app **Toolbox** (Tools / Three.js / Rapier / R3F / Create / Music) + [Grok Builder](https://grok-builder.vercel.app/?panel=modes). Guide: [`docs/PRODUCTION_TOOLS.md`](docs/PRODUCTION_TOOLS.md) / code: `artifacts/animator/src/lib/productionTools.ts`.

Full map: [`docs/OPEN_PRODUCT.md`](docs/OPEN_PRODUCT.md) / collection rules: [`docs/OPEN_COLLECTION_CONSOLIDATION.md`](docs/OPEN_COLLECTION_CONSOLIDATION.md)

**Replaces** the legacy Animator lab at [threejs-rapier-react-three-controll.vercel.app](https://threejs-rapier-react-three-controll.vercel.app/) - do not ship new features there. Ingest: `npm run ingest:rapier` / [`docs/OPEN_CONSOLIDATION.md`](docs/OPEN_CONSOLIDATION.md).

| Surface | Platform | Role |
|---------|----------|------|
| Edge | **Cloudflare Worker** | `open.grudge-studio.com` → Vercel |
| Client SPA | **Vercel** | Animator build (`artifacts/animator`) |
| API | **Railway** | Health, effects, co-op helpers |
| Characters / wallet | **GrudgeBuilder Postgres** | `/api/characters`, `/api/wallet` |
| Catalogs | **info.grudge-studio.com** | Definition JSON (not character state) |
| Binaries | **R2** | `assets.grudge-studio.com` |
| Auth | **Grudge ID** | `id.grudge-studio.com` |
| AI | **ai.grudge-studio.com** | Companion dock |
| Create / modes | **Grok Builder** | `grok-builder.vercel.app` (Toolbox Create tab) |
| Map editor | **Forge** | `forge.grudge-studio.com` |
| Voxel worlds | **Mine-Loader** | Realms SPA + 1× world API |

**Macro stack / D1 / AI handoff:** [`docs/OPEN_STACK.md`](docs/OPEN_STACK.md)

## Service worker (PWA shell)

`artifacts/animator/public/sw.js` — **v3** (`grudge-open-shell-v3`).

| Rule | Detail |
|------|--------|
| **Always return a Response** | Cache misses must not resolve `undefined` (browser: *Failed to convert value to 'Response'* / FetchEvent network error) |
| **Navigations** | Network-only (`cache: no-store`) so Vite hash updates stick |
| **Recovery** | `?nosw=1` or `localStorage.grudge_open_nosw=1` unregisters SW; `nukeServiceWorkers()` in `src/lib/pwa.ts` |

## Auth (return-to-origin SSO)

Canonical login always returns to **this** origin with tokens the app can store.

| Piece | Detail |
|-------|--------|
| Login URL builder | `artifacts/animator/src/lib/fleet.ts` → `buildGrudgeLoginUrl()` |
| Token pickup / bridge | `artifacts/animator/src/lib/grudgeAuth.ts` |
| Equip / game saves | `artifacts/animator/src/lib/characterLoadout.ts` (`saveData.open`) |
| Sign-in UI entry | Fleet bar → `loginWithGrudgeId()` |
| Full auth checklist | [`docs/AUTH_OPEN.md`](docs/AUTH_OPEN.md) |
| Id hub | `https://id.grudge-studio.com/login?redirect_uri=https://open.grudge-studio.com/` |

**Contract (must match GrudgeBuilder `docs/GRUDGE_AUTH_CONNECT.md`):**

1. **Dual-write return params** on the way to id: `redirect_uri` + `redirect` + `return` + `return_to` + `origin` + `app=gameopen`.
2. After login, id handoff attaches **`sso_token`** (full session JWT) and **`grudge_token`** (short launch) in **query and hash**.
3. On boot, **prefer `sso_token` / `token`** over `grudge_token`. Never use launch JWT alone as Bearer.
4. If only launch is present → `POST /api/auth/session/exchange` (or grudge-bridge) with `audience=https://gameopen.vercel.app`.
5. Store under fleet keys: **`grudge.open.token` first**, then `grudge_auth_token`, `grudge_session_token`, `grudge.token`, `sso_token`, `grudge_token`. Dual-write all on login.
6. **Read JWT** via `readProductionAuthToken()` (`lib/productionSystemsPattern.ts`) for AI hub + REST — never a third key scanner.
7. **No custom identity headers** (e.g. `x-grudge-id`) — CORS preflight fails on Railway; Bearer carries identity.

Pattern SSOT: [`docs/PRODUCTION_SYSTEMS_PATTERN.md`](docs/PRODUCTION_SYSTEMS_PATTERN.md) · [`docs/FLEET_AUTH_WIRING.md`](docs/FLEET_AUTH_WIRING.md).

```bash
# Probe id dual-write (expect 302 with both redirect_uri and redirect)
curl -sI "https://id.grudge-studio.com/auth/sso-check?return=https://gameopen.vercel.app/"
```

## Live

| URL | Role |
|-----|------|
| https://open.grudge-studio.com | **Canonical** production client |
| https://gameopen.vercel.app | Alias / Vercel project |
| https://gameopen-production.up.railway.app/api/healthz | Open Railway API |
| https://mine-loader-api-production.up.railway.app/api/healthz | Realms world API (proxied at `/api/blocks`, `/api/worlds`) |
| https://id.grudge-studio.com/login?redirect_uri=https%3A%2F%2Fopen.grudge-studio.com%2F | Fleet login → return here |
| https://github.com/MolochDaGod/gameopen | Source |

### Fleet API connections

| Same-origin path | Upstream |
|------------------|----------|
| `/api/characters*`, `/api/account*`, `/api/wallet*` | Builder Railway (`grudge-api-production-…`) |
| `/api/auth/*`, `/login` | Grudge ID (`id.grudge-studio.com`) |
| `/api/blocks*`, `/api/definitions*`, `/api/worlds*`, `/api/healthz` | **Mine-Loader Railway** (not Replit) |
| `/api/brawl`, `/api/carrier`, `/api/space` | GRUDOX room Railway |
| `/api/*` (remainder) | Open Railway |

Launch helper: `artifacts/animator/src/auth/mineLoaderConfig.ts`  
Seed catalog: `content/worlds/seed-deployments.json` → `public/content/worlds/`  
Seed math: `@workspace/voxel-canonical` `clampChunkIdx` · **chunkIdx 0..7 only**  
Doc: [`docs/SEED_WORLD_DEPLOY.md`](docs/SEED_WORLD_DEPLOY.md)

### Path slugs (surfaces)

Routing SSOT: [`artifacts/animator/src/lib/openRoutes.ts`](artifacts/animator/src/lib/openRoutes.ts) · practices: [`docs/OPEN_SYSTEMS.md`](docs/OPEN_SYSTEMS.md)

| Path | Surface |
|------|---------|
| `/` | Hub (door select) + **Toolbox** (production tools) |
| `/danger` | Danger Room combat lab |
| `/annihilate-demo` | Danger Room + grudge6 hero boot (`?hero=elf_worge`) |
| `/play` | Play authored map |
| `/genesis` | Warlord Genesis waves |
| `/brawl` | Ruins Brawler |
| `/mimic` | Mimic dungeon encounter |
| `/login` | Grudge ID landing (fleet SSO) |
| `/voxel` | Voxel map editor (canonical block types) |
| `/world` | VoxGrudge open world |
| `/dressing` | Dressing Room / Animator (threejs-rapier suite) |
| `/avatar` | Cube modular Avatar Editor |
| `/characters` | **TVS farm campfire** roster hub (CDN props) |
| `/realms` | Mine-Loader / GRUDOX Realms |
| `/lobby` | Same campfire roster (not dungeon cinema) |
| Game library → Nexus | Nexus Nemesis TCG (external SSOT: `nemesis.grudge-studio.com`) |
| `/api/ai/*` | AI hub rewrite (`ai.grudge-studio.com`; JWT for chat) |
| `/zones` | GRUDOX zone launcher |
| `/ledmask` | LED Mask + voxel avatar design |
| `/account` | Account hub (races, wallet, treaty) |
| `/arcade/play/<id>` | GRUDOX cabinet deep-link |

Also: `?door=<mode>` · `?mode=<cabinetId>` (legacy).  
**Consolidation:** Open replaces the legacy Animator lab — [`docs/OPEN_CONSOLIDATION.md`](docs/OPEN_CONSOLIDATION.md).  
Ingest: `npm run ingest:rapier`.

## Warlords in-game only (not Open library tiles)

**Flagship client:** [client.grudge-studio.com](https://client.grudge-studio.com/home) · [grudgewarlords.com](https://grudgewarlords.com)

Open may deep-link or catalog-document these worlds, but they are **`warlordsInGameOnly`** — never standalone Open tiles, never GRUDOX cabinets, never Explorer products.

| Id / map | Role | Production path |
|----------|------|-----------------|
| **`pirate-islands`** | **Chicken Gun / PolygonPirates lobby** = Warlords **opening map and tutorial map** | `/island-3d?mode=lobby&map=pirate-islands` · tutorial `/tutorial` |
| `water-island` / home | Home / water island inside Warlords | client home handoff |
| `grudox-island` | Legacy name for Warlords home lobby island | client home handoff |
| Sectors (era 9) | Sailing / land zones | in-client ocean + world map |

**Hard rules**

1. Chicken Gun **pirate-islands** is **not** GRUDOX and **not** an Explorer game.
2. CDN mesh: `assets.grudge-studio.com/models/lobby/pirate-islands/scene.glb`
3. Open Toolbox **Pirate Lobby** opens the Warlords client path above (not Grok invent mode).
4. Danger Room maps (`pirate-village`, forest harvest lab, shipwreck SPA) stay Open **training** maps — distinct from the production lobby mesh.
5. Catalog SSOT: `artifacts/animator/src/game/gameLibrary.ts` · tests: `gameLibrary.warlords.test.ts` · sectors meta: `warlordsSectors.ts`

Library eras: [`docs/ERA_LIBRARY.md`](docs/ERA_LIBRARY.md) · deploy gate: `npm run deploy:gate` / `npm run deploy:prod`.

**DRC + grudge6 on Warlords-era games:** loaders, asset hosts, deploy matrix — [`docs/WARLORDS_ERA_DRC_AUDIT.md`](docs/WARLORDS_ERA_DRC_AUDIT.md) · code `drcSurfaceContract.ts` (`WARLORDS_ERA_FLEET`).

## Asset production pipeline

Scale → purpose classify → convert (grudge-convert) → **Draco last** → AI/game-flow verify.

```bash
npm run assets:classify        # purpose map (characters, weapons, maps, …)
npm run assets:verify-scale    # green/yellow/red scale + AI clip checks
npm run assets:pipeline        # full report + convert recipes
npm run assets:convert:doctor  # grudge-convert backends
npm run assets:convert -- raw/hero.fbx -o dist/production-assets/character/hero.glb --purpose character
npm run ingest:rapier          # pull missing threejs-rapier lab assets/modules
npm run ci:test                # retarget + annihilate hero unit tests
npm run deploy:prod            # vercel-build + vercel --prod
npm run smoke:prod:open        # live SPA/API/CDN probes
npm run readiness:anims        # baked anim pack availability
```

See **[docs/ASSET_PRODUCTION_PIPELINE.md](docs/ASSET_PRODUCTION_PIPELINE.md)** · deploy: **[docs/PRODUCTION_DEPLOY.md](docs/PRODUCTION_DEPLOY.md)**.

### Annihilate demo (grudge6 + Danger Room)

Deep-link boots a **GrudgeAvatar** combat rig (not bare race slug):

```
/annihilate-demo?hero=elf_worge
→ grudge:high-elves:unarmed + mesh_ids + unarmed skills
→ Bip001 hands / R_hand_container · Mixamo retarget map · X dodge · F skills · MM
```

| Piece | Location |
|-------|----------|
| Hero parse + apply | `artifacts/animator/src/lib/annihilateHero.ts` |
| Bip001 ↔ Mixamo | `artifacts/animator/src/three/retargetMap.ts` |
| Hand bones | `artifacts/animator/src/three/grudge/skeleton.ts` · `Studio.reportHandSockets` |
| Route aliases | `artifacts/animator/src/lib/openRoutes.ts` |
| Doc | [`docs/ANNIHILATE_DEMO.md`](docs/ANNIHILATE_DEMO.md) |

Live: [open…/annihilate-demo?hero=elf_worge](https://open.grudge-studio.com/annihilate-demo?hero=elf_worge) · portal [grudge-studio.com/annihilate-demo](https://grudge-studio.com/annihilate-demo?hero=elf_worge)

### Docs index

| Doc | Topic |
|-----|--------|
| [OPEN_STACK.md](docs/OPEN_STACK.md) | Stack, deps, D1 vs Postgres, AI handoff |
| [PRODUCTION_DEPLOY.md](docs/PRODUCTION_DEPLOY.md) | Deploy order, smoke, annihilate connections |
| [ANNIHILATE_DEMO.md](docs/ANNIHILATE_DEMO.md) | Hero tokens, hands, Bip/Mixamo, controls |
| [VOXEL_STORE_ASSET_REVIEW.md](docs/VOXEL_STORE_ASSET_REVIEW.md) | itch Voxel Store → GLB unit DB bake |
| [SEED_WORLD_DEPLOY.md](docs/SEED_WORLD_DEPLOY.md) | Seed worlds, portals, chunkIdx, APIs |
| [CHARACTER_AVATARS.md](docs/CHARACTER_AVATARS.md) | Portraits, voxel heads, Railway avatarUrl |
| [CHARACTER_MESH_DELIVERY.md](docs/CHARACTER_MESH_DELIVERY.md) | Cloudflare R2 mesh/atlas/skeleton/anims |
| [GAMEPLAY_LOAD_STACK.md](docs/GAMEPLAY_LOAD_STACK.md) | Anims, controller, skills, panel, HUD boot |
| [CANONICAL_DATA_LAYER.md](docs/CANONICAL_DATA_LAYER.md) | Railway / info / R2 / D1 / worlds SSOT |
| [DANGER_ROOM_UX_CONSOLIDATION.md](docs/DANGER_ROOM_UX_CONSOLIDATION.md) | One Danger Room, HUD, equip, grudge6 hands |
| [MINE_LOADER_SSOT.md](docs/MINE_LOADER_SSOT.md) | World editor SSOT, physics, lobby promote |
| [GAME_LIBRARY_AND_DEPLOY.md](docs/GAME_LIBRARY_AND_DEPLOY.md) | Library + Mine-Loader |
| [WARLORDS_ERA_DRC_AUDIT.md](docs/WARLORDS_ERA_DRC_AUDIT.md) | Warlords games · grudge6 · DRC loaders/deploy |
| [OPEN_CONSOLIDATION.md](docs/OPEN_CONSOLIDATION.md) | threejs-rapier → Open |
| [DANGER_ROOM_T0_COMBAT.md](docs/DANGER_ROOM_T0_COMBAT.md) | T0 skills, MM, parry/block |
| [ATTACHMENT_EQUIP_CARDS.md](docs/ATTACHMENT_EQUIP_CARDS.md) | Equip container cards |
| [DEPLOY.md](DEPLOY.md) | Env + smoke |
| [OPEN_SYSTEMS.md](docs/OPEN_SYSTEMS.md) | Path/routing practices |

## Voxel canonical (GRUDOX / editors / games)

Block types, scene interchange, and the 250-block Codex come from **Voxel Realms** (Mine-Loader):

| Piece | URL / path |
|-------|------------|
| Realms SPA | https://mine.grudge-studio.com |
| Catalog API | `GET /api/blocks` → Railway (Open proxy or Mine-Loader) |
| Seed worlds | `content/worlds/seed-deployments.json` · `chunkIdx` 0..7 |
| Package | `@workspace/voxel-canonical` → `lib/voxel-canonical` |
| Doc | [`docs/VOXEL_CANONICAL.md`](docs/VOXEL_CANONICAL.md) |

The Open Voxel Editor places **type ids** (`stone`, `grass`, `cat:alloy-frame`, …) and exports dual-format interchange so maps work in GRUDOX zone games and Voxel Realms.

## Animation and asset packs

| Category | Count | Path |
|----------|------:|------|
| Explorer animation clips | 686 | `/anim/animations/` (663 FBX + 23 GLB) |
| Explorer combat categories | 22 | `ambient`, `block`, `bow`, `climb`, `combo`, `extra`, `farming`, `gestures`, `greataxe`, `greatsword`, `knife`, `mace`, `magic`, `magic-loco`, `pistol`, `reactions`, `rifle`, `spear`, `striker`, `swim`, `sword`, `ghostrider` |
| Models (GLB/GLTF) | 80+ | `/models/{races,weapons,vfx,props,enemies,destructibles,heroes,pirate}/` + arena/dungeon maps |
| HUD icons | 50 | `/icons/*.png` |
| Menu UI | 7 | `/ui/menu/*.png` |
| Pirate props + texture | 12 | `/models/pirate/` (includes `TX_PirateShipInterior_Color.png`) |

Path aliases are generated on install/build so the minified client also finds:

- `/anim/striker/flip_kick.fbx` → `animations/striker/Flip_Kick.fbx`
- Bare `voxel-zombie-*.glb` / `barrel-*.glb` next to canonical folders
- Flat pirate FBX names at site root

Explorer animation is data-driven: `src/three/explorer/clipCatalog.ts` maps
locomotion, combos, guard states, casts, and reactions to each weapon class.
`loader.ts` loads FBX files and retargets GLB combo clips, splitting authored
multi-hit combos into timed runtime subclips. Stage new assets under
`public/anim/` and register them in the catalog before use.

## Content SSOT (weapons / skills / items)

Authoring lives under **`content/`** — see [`content/README.md`](content/README.md) and [`content/docs/WEAPON_PREFAB.md`](content/docs/WEAPON_PREFAB.md).

```bash
pnpm content:index              # rebuild manifests
pnpm readiness:weapons          # readiness table (gold: wpn_sword_iron_01)
pnpm scaffold:weapon -- --family bow --slug oak_recurve
```

API (Railway / local `pnpm start:api`):

- `GET /api/content/weapons`
- `GET /api/content/skills`
- `GET /api/content/readiness`

## Local

```bash
pnpm install
pnpm assets:manifest
pnpm content:index
pnpm start:api                   # :8080 standalone
# client: artifacts/animator or client package
```

## Deploy

### Vercel (frontend)

```bash
# from repo root
vercel link
vercel env add VITE_USE_R2 production   # true after R2 upload
vercel --prod
```

`vercel.json` already rewrites:

- `/api/characters*` → GrudgeBuilder Railway  
- `/api/auth/*` → id.grudge-studio.com  
- `/api/*` → gameopen Railway API  
- SPA fallback → `index.html`

### Railway (backend)

```bash
cd server   # or root with railway.json
railway link
railway up
railway domain
```

Set `ALLOWED_ORIGINS` to your Vercel URL(s). Health: `GET /api/healthz`.

Optional WebSocket: `wss://<railway>/api/carrier?room=CODE`

### R2 upload (recommended for large GLB/FBX)

```bash
export R2_ACCOUNT_ID=...
export R2_ACCESS_KEY_ID=...
export R2_SECRET_ACCESS_KEY=...
export R2_BUCKET=grudge-assets
export R2_PREFIX=gameopen
pnpm add -wD @aws-sdk/client-s3   # once
pnpm assets:upload-r2
```

Then set Vercel `VITE_USE_R2=true` so the bootstrap rewrites `/models|/anim|/icons|/ui` to the CDN.

## Fleet diagram

```
Browser (Vercel SPA)
  ├── Sign in          → id.grudge-studio.com/login?redirect_uri=this-origin (dual params)
  │                      ← return ?sso_token=&grudge_token= (+ hash mirror)
  ├── /api/characters  → GrudgeBuilder Railway (Postgres characters)
  ├── /api/effects     → gameopen Railway (local VFX catalog + ObjectStore merge)
  ├── /api/auth/*      → id.grudge-studio.com (me, refresh, session/exchange)
  ├── /api/*           → gameopen Railway
  ├── /models|/anim    → Vercel static OR assets.grudge-studio.com/gameopen
  └── optional WS      → wss://gameopen-api…/api/carrier
```

## Source of the build

Packaged from `D:\Games\Models\gameopen\dist\public` (title: Grudges Survival / Grudge Open combat client). Engine + app are production Vite chunks; this repo adds fleet wiring, API, aliases, and deploy targets.

## License

MIT — Grudge Studio. Third-party packs retain their original licenses (see `models/hex-forcefield/LICENSE.txt`).
