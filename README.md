# Grudge Open (`gameopen`)

**Canonical live origin:** [open.grudge-studio.com](https://open.grudge-studio.com)  
Steam-style library hub, Account hub, Danger Room (T0 combat), Mine-Loader Realms handoff, fleet SSO, companion AI.

| Surface | Platform | Role |
|---------|----------|------|
| Edge | **Cloudflare Worker** | `open.grudge-studio.com` → Vercel |
| Client SPA | **Vercel** | Animator build (`artifacts/animator`) |
| API | **Railway** | Health, effects, co-op helpers |
| Characters / wallet | **GrudgeBuilder Postgres** | `/api/characters`, `/api/wallet` |
| Catalog (D1+R2) | **ObjectStore** | Definition JSON (not character state) |
| Binaries | **R2** | `assets.grudge-studio.com/gameopen/*` |
| Auth | **Grudge ID** | `id.grudge-studio.com` |
| AI | **ai.grudge-studio.com** | Companion dock |
| Voxel worlds | **Mine-Loader** | Realms SPA + 1× world API |

**Macro stack / D1 / AI handoff:** [`docs/OPEN_STACK.md`](docs/OPEN_STACK.md)

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
5. Store under fleet keys: `grudge_auth_token`, `grudge_session_token`, `grudge.token`, `sso_token`, plus `grudge.open.token`.
6. **No custom identity headers** (e.g. `x-grudge-id`) — CORS preflight fails on Railway; Bearer carries identity.

```bash
# Probe id dual-write (expect 302 with both redirect_uri and redirect)
curl -sI "https://id.grudge-studio.com/auth/sso-check?return=https://gameopen.vercel.app/"
```

## Live

| URL | Role |
|-----|------|
| https://open.grudge-studio.com | **Canonical** production client |
| https://gameopen.vercel.app | Alias / Vercel project |
| https://gameopen-production.up.railway.app/api/healthz | Railway API |
| https://id.grudge-studio.com/login?redirect_uri=https%3A%2F%2Fopen.grudge-studio.com%2F | Fleet login → return here |
| https://github.com/MolochDaGod/gameopen | Source |

### Path slugs (surfaces)

Routing SSOT: [`artifacts/animator/src/lib/openRoutes.ts`](artifacts/animator/src/lib/openRoutes.ts) · practices: [`docs/OPEN_SYSTEMS.md`](docs/OPEN_SYSTEMS.md)

| Path | Surface |
|------|---------|
| `/` | Hub (door select) |
| `/danger` | Danger Room combat lab |
| `/play` | Play authored map |
| `/genesis` | Warlord Genesis waves |
| `/brawl` | Ruins Brawler |
| `/mimic` | Mimic dungeon encounter |
| `/login` | Grudge ID landing (fleet SSO) |
| `/voxel` | Voxel map editor (canonical block types) |
| `/world` | VoxGrudge open world |
| `/dressing` | Dressing Room / Animator (threejs-rapier suite) |
| `/avatar` | Cube modular Avatar Editor |
| `/characters` | Characters GRUDOX campfire hub |
| `/realms` | Mine-Loader / GRUDOX Realms |
| `/lobby` | Multiplayer lobby |
| `/zones` | GRUDOX zone launcher |
| `/ledmask` | LED Mask (right rail scroll-contained) |
| `/account` | Account hub (races, wallet, treaty) |

**Consolidation:** Open **replaces** [threejs-rapier-react-three-controll.vercel.app](https://threejs-rapier-react-three-controll.vercel.app/) as the product entry. See [`docs/OPEN_CONSOLIDATION.md`](docs/OPEN_CONSOLIDATION.md).
| `/arcade/play/<id>` | GRUDOX cabinet deep-link |

Also: `?door=<mode>` · `?mode=<cabinetId>` (legacy).

### Docs index

| Doc | Topic |
|-----|--------|
| [OPEN_STACK.md](docs/OPEN_STACK.md) | Stack, deps, D1 vs Postgres, AI handoff |
| [MINE_LOADER_SSOT.md](docs/MINE_LOADER_SSOT.md) | World editor SSOT, physics, lobby promote |
| [GAME_LIBRARY_AND_DEPLOY.md](docs/GAME_LIBRARY_AND_DEPLOY.md) | Library + Mine-Loader |
| [DANGER_ROOM_T0_COMBAT.md](docs/DANGER_ROOM_T0_COMBAT.md) | T0 skills, MM, parry/block |
| [ATTACHMENT_EQUIP_CARDS.md](docs/ATTACHMENT_EQUIP_CARDS.md) | Equip container cards |
| [DEPLOY.md](DEPLOY.md) | Env + smoke |
| [OPEN_SYSTEMS.md](docs/OPEN_SYSTEMS.md) | Path/routing practices (if present) |

## Voxel canonical (GRUDOX / editors / games)

Block types, scene interchange, and the 250-block Codex come from **Voxel Realms** (Mine-Loader):

| Piece | URL / path |
|-------|------------|
| Realms SPA | https://mineloader.grudge-studio.com |
| Catalog API | `GET /api/blocks` (Mine-Loader / proxied) |
| Package | `@workspace/voxel-canonical` → `lib/voxel-canonical` |
| Doc | [`docs/VOXEL_CANONICAL.md`](docs/VOXEL_CANONICAL.md) |

The Open Voxel Editor places **type ids** (`stone`, `grass`, `cat:alloy-frame`, …) and exports dual-format interchange so maps work in GRUDOX zone games and Voxel Realms.

## Asset pack (all used)

| Category | Count | Path |
|----------|------:|------|
| Animations (FBX packs) | 168 | `/anim/animations/{ambient,bow,climb,extra,farming,knife,magic,magic-loco,pistol,reactions,rifle,striker,swim,sword}/` |
| Models (GLB/GLTF) | 80+ | `/models/{races,weapons,vfx,props,enemies,destructibles,heroes,pirate}/` + arena/dungeon maps |
| HUD icons | 50 | `/icons/*.png` |
| Menu UI | 7 | `/ui/menu/*.png` |
| Pirate props + texture | 12 | `/models/pirate/` (includes `TX_PirateShipInterior_Color.png`) |

Path aliases are generated on install/build so the minified client also finds:

- `/anim/striker/flip_kick.fbx` → `animations/striker/Flip_Kick.fbx`
- Bare `voxel-zombie-*.glb` / `barrel-*.glb` next to canonical folders
- Flat pirate FBX names at site root

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
