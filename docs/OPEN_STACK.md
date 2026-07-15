# open.grudge-studio.com — stack, dependencies, data, AI handoff

**Canonical launcher origin:** https://open.grudge-studio.com  
**Vercel origin:** https://gameopen.vercel.app  
**Repo:** https://github.com/MolochDaGod/gameopen  

This is the **Grudge Open** monorepo: Steam-style game library, Account hub, Danger Room combat, Mine-Loader Realms handoff, fleet SSO, and companion AI.

---

## 1. Topology (macro)

```
Browser
  └─ https://open.grudge-studio.com
        │  Cloudflare Worker: gameopen-open-proxy
        │  (infra/cloudflare/open)
        ▼
     https://gameopen.vercel.app          artifacts/animator SPA
        │
        ├─ /api/auth/* , /login           → id.grudge-studio.com          (Grudge ID)
        ├─ /api/characters* , /account/*  → grudge-api-production (Railway Postgres)
        ├─ /api/wallet* , /nfts*          → grudge-api-production
        ├─ /api/objectstore/*             → objectstore.grudge-studio.com (D1 + R2 catalog)
        ├─ /api/assets/*                  → assets.grudge-studio.com/gameopen (R2 binaries)
        ├─ /api/brawl|space|carrier       → voxgrudge-grudox-room (Railway WS)
        └─ /api/*                         → gameopen-production (Railway API)
```

| Layer | Platform | Owns |
|-------|----------|------|
| Edge domain | **Cloudflare Worker** | `open.grudge-studio.com` → Vercel |
| SPA + rewrites | **Vercel** | Static client, same-origin API proxy |
| Open API / WS | **Railway** `gameopen-production` | Health, content, co-op helpers |
| Characters / wallet | **Railway** GrudgeBuilder | Postgres SSOT (not D1) |
| Definitions catalog | **ObjectStore Worker** | **D1** index + R2 JSON (`weaponSkills`, items, …) |
| Binary CDN | **R2** via `assets.grudge-studio.com` | GLB, FBX, rooms posters, icons |
| Identity | **id.grudge-studio.com** | Login, session exchange, JWT |
| AI Gateway | **ai.grudge-studio.com** | Companion chat / tools (fleet) |
| Voxel worlds | **Mine-Loader** | Vercel client + Railway world API (1 replica) |

---

## 2. Dependencies (runtime & monorepo)

### App workspace (animator)
| Area | Stack |
|------|--------|
| UI | React 18, Vite, Tailwind-ish utility CSS, Framer Motion (shell) |
| 3D | Three.js r184, Rapier (physics), custom Studio engine |
| Combat | `@workspace/epicfight` (local package) |
| Net | DangerClient / brawl-net / carrier-net |
| Auth | `grudgeAuth.ts` + fleet SSO (no Clerk required) |
| AI dock | `AiAssistant` + tool schemas (dangerTools, companionPrompt) |

### Backend packages
| Package | Role |
|---------|------|
| `lib/epicfight` | CombatController, resolveDefense, T0 windows |
| `lib/danger-net`, `lib/brawl-net`, `lib/carrier-net` | Multiplayer protocols |
| `lib/api-client-react` | Generated OpenAPI client (optional surfaces) |
| `lib/db` | Schema helpers (server-side; characters live on Builder) |
| `server/` | Express proxy + content routes |

### External services (not vendored)
- Grudge ID JWT + session exchange  
- GrudgeBuilder `/api/characters`, `/api/wallet`  
- ObjectStore D1-backed `/api/v1/*.json`  
- R2 CDN when `VITE_USE_R2=true`  
- AI Gateway when companion calls fleet AI  

Node **≥ 20**. Root scripts: `pnpm` / npm via `package.json` (`build` → `scripts/vercel-build.mjs`).

---

## 3. D1 vs Postgres (data map)

| Data | Store | Access from Open |
|------|-------|------------------|
| **Player characters** | Railway **Postgres** (GrudgeBuilder) | `/api/characters` rewrite |
| **Wallet / NFTs** | Railway Postgres | `/api/wallet`, `/api/nfts` |
| **Weapon / skill / item definitions** | ObjectStore **D1** + R2 JSON | `/api/objectstore/*` or `FLEET.objectStore` |
| **Asset binary files** | R2 | `/api/assets/*` or `assetUrl()` |
| **Guest / local draft chars** | `localStorage` `grudge.open.localChars` | Account hub only |
| **Treaty notes (temp)** | `localStorage` | Account → Treaty tab |
| **Soft credits (temp)** | `localStorage` | Account → Credits |
| **Mine-Loader worlds** | Mine-Loader Railway Postgres | External Realms SPA |

**Rule:** Character state never lives in D1 on Open. D1 is catalog/search (ObjectStore). Persistence SSOT for heroes = Builder Postgres.

---

## 4. Auth & handoff contract

### Browser → Open
1. `buildGrudgeLoginUrl()` dual-writes `redirect_uri|redirect|return|return_to|origin|app=gameopen`.  
2. Id hub returns `sso_token` + `grudge_token` (query + hash).  
3. Prefer **sso_token** as Bearer; exchange launch token if needed.  
4. Store fleet keys: `grudge_auth_token`, `grudge_session_token`, `grudge.token`, `sso_token`, `grudge.open.token`.  

### Open → other games (library / zones)
```
?sso_token=<jwt>&characterId=<id>&open=1&from=gameopen
```
Built by `gameLaunchUrl()` / `grudoxDeepLink()`.

### Mine-Loader Realms
Library entry `mine-loader-realms` → `https://mineloader.grudge-studio.com/` (+ SSO params).  
World engine path: local `D:\GitHub\minegrudge\Mine-Loader` · fleet doc `docs/GAME_LIBRARY_AND_DEPLOY.md`.

---

## 5. AI handoff

| Surface | Prompt / tools | Endpoint pattern |
|---------|----------------|------------------|
| App shell companion | `appGuideSystemPrompt` | Fleet AI gateway when configured |
| Danger Room | `dangerSystemPrompt` + `buildDangerTools` | Live engine tools (spawn, mode, …) |
| LED Mask | `companionSystemPrompt` + face moods | Embedded face chat |
| Dressing Room | Surface-registered assistant | Via `AssistantSurface` |

**Handoff principles:**
- One global dock (`AppShell` + `AiAssistant`); modes override via context.  
- Tools must be **idempotent** and bound to live `Studio` refs — never invent world state.  
- Auth: send fleet Bearer if AI route requires it; guest mode still allows local-only tools.  
- Prefer same-origin `/api/ai/*` if rewrite exists; absolute `FLEET.ai` is fallback.

Primary files:
- `artifacts/animator/src/ai/*`
- `artifacts/animator/src/lib/fleet.ts` (`FLEET.ai`)

---

## 6. Product surfaces (2026-07 macro update)

| Door / mode | Role |
|-------------|------|
| **`library` (default home)** | Steam-style catalog, Mine-Loader banner, deploy metadata |
| `account` | charactersgrudox races, wallet, credits, treaty, GRUDOX tier |
| `doors` | Classic poster grid |
| `danger` | Combat sandbox — **T0 weapon kits + MM + parry/block/dodge** |
| `voxel` / `editor` | Map + dressing room create path |
| `brawl` / `genesis` / `voxgrudge-native` / … | Native modes |
| External | Warlords, RTS, DCQ, Island, Metaverse, Realms |

Deep links: `/?door=library|account|danger|…` and `/arcade/play/<cabinetId>`.

---

## 7. Combat stack (T0)

| Concern | Location |
|---------|----------|
| T0 skill + MM catalog | `three/arsenal/t0WeaponSkills.ts` |
| Reaction windows + chip block | `lib/epicfight` defense + movesets |
| MM dash on skill cast | `Studio.ts` signature path |
| Refs | `artifacts/animator/docs/ref-combat/*` |
| Doc | `docs/DANGER_ROOM_T0_COMBAT.md` |

Character scale/color: `fitCharacterHeight.ts` (no world-box 100× bug).

Equip cards: `docs/ATTACHMENT_EQUIP_CARDS.md` + `components/equip/*`.

---

## 8. Env checklist (Vercel)

| Var | Purpose |
|-----|---------|
| `VITE_USE_R2` | `true` in production for CDN assets |
| `VITE_ASSET_BASE_URL` | `https://assets.grudge-studio.com/gameopen` |
| `VITE_OBJECTSTORE_URL` | ObjectStore API base |
| `VITE_GAME_SERVER_URL` | Danger / gameopen WS |
| `VITE_ZONE_SERVER_URL` | GRUDOX room WS |
| `VITE_GRUDGE_API_BASE` | Builder Railway (optional direct) |
| `VITE_PLAY_SHELL_URL` | GRUDOX Island play shell |

Railway `ALLOWED_ORIGINS` must include:
`https://open.grudge-studio.com`, `https://gameopen.vercel.app`.

---

## 9. Deploy commands

```bash
# SPA
cd D:\GitHub\gameopen
node scripts/vercel-build.mjs
npx vercel deploy --prod --yes

# Edge (open. subdomain)
cd infra/cloudflare/open
npx wrangler deploy

# API
cd server   # or monorepo root per railway.toml
railway up
```

Smoke:
```bash
curl -sI https://open.grudge-studio.com/ | head -5
curl -s https://gameopen-production.up.railway.app/api/health
curl -sI https://objectstore.grudge-studio.com/api/v1/weaponSkills.json | head -5
```

---

## 10. Doc index

| Doc | Topic |
|-----|--------|
| **This file** | Macro stack / D1 / AI / handoff |
| `DEPLOY.md` | Env + smoke |
| `README.md` | Overview + auth |
| `GAME_LIBRARY_AND_DEPLOY.md` | Library + Mine-Loader |
| `DANGER_ROOM_T0_COMBAT.md` | T0 skills, MM, parry/block |
| `ATTACHMENT_EQUIP_CARDS.md` | Body-anchored equip UI |
| `GRUDOX_UNIFIED_SCHEME.md` | Cross-app scheme pointer |
| Mine-Loader `docs/FLEET_DEPLOY.md` | Realms Vercel/Railway/CF |

---

## 11. Anti-patterns

- Replit for Mine-Loader / production Realms  
- Multi-replica world API  
- Character CRUD against ObjectStore D1  
- Using only `grudge_token` as long-lived Bearer  
- Measuring skinned GLB world box as scale without `fitCharacterHeight`  
- Second combat damage math outside `CombatController` / `resolveDefense`  
