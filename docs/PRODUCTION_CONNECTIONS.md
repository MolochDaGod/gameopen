# Production connections — Open + eras

**Canonical launcher:** https://open.grudge-studio.com  
**Repo:** `MolochDaGod/gameopen` (`F:\GitHub\gameopen`)  
**Deploy:** `npm run deploy:prod` → Vercel project `gameopen`  
**Edge:** CF Worker `infra/cloudflare/open` → open.grudge-studio.com  

Do **not** print secret values in chat/logs. Names only below.

---

## 1. Topology (one diagram)

```
Browser  open.grudge-studio.com
    │
    ├─ CF Worker (open proxy) ──► gameopen.vercel.app (SPA)
    │       rewrites:
    │         /api/auth/*  ──► id.grudge-studio.com  (+ Railway guest/session segments)
    │         /api/characters|account|wallet|island|…  ──► Railway grudge-api-production-0d46
    │         /api/health  ──► Railway grudge-api
    │         /api/brawl|space|carrier  ──► Railway voxgrudge-grudox-room (WS via GRUDOX CF)
    │         /api/* (gameopen-local) ──► gameopen-production Railway
    │         /models|/textures grudge6 ──► assets.grudge-studio.com (R2)
    │
    ├─ AI ──► ai.grudge-studio.com
    ├─ Definitions ──► info.grudge-studio.com/api/v1  (or objectstore)
    └─ CDN ──► assets.grudge-studio.com
```

---

## 2. Railway — game database (accounts / characters)

| Service | Host | Role |
|---------|------|------|
| **grudge-api-production-0d46** | `grudge-api-production-0d46.up.railway.app` | **Postgres SSOT** — characters, account, wallet, island, inventory, professions, auth guest/session |
| **gameopen-production** | `gameopen-production.up.railway.app` | Open Danger Room WS + co-located rooms (`/api/space|danger|carrier`) |
| **voxgrudge-grudox-room** | `voxgrudge-grudox-room-production.up.railway.app` | GRUDOX / Voxel multiplayer rooms (space, brawl, carrier) |
| **mine-loader-api** | `mine-loader-api-production.up.railway.app` | Voxel Realms world authority (1 replica) |

### Secrets (Railway / Vercel — names only)

| Secret | Where | Purpose |
|--------|--------|---------|
| `DATABASE_URL` / `DATABASE_PUBLIC_URL` | grudge-api Railway | Postgres |
| `JWT_SECRET` | grudge-api + gameopen Railway | Shared session/JWT with Builder |
| `SESSION_SECRET` | grudge-api / gameopen | Cookie/session |
| `ALLOWED_ORIGINS` | All Railway APIs | Must include open + gameopen + era domains |
| `CLERK_*` | optional | Clerk path if enabled |
| `R2_*` / Cloudflare | workers + upload scripts | Asset pipeline |
| `carry_discord_webhook` | optional | Discord |

### Vercel env (gameopen SPA — public `VITE_*`)

| Var | Production value (non-secret) |
|-----|-------------------------------|
| `VITE_USE_R2` | `true` |
| `VITE_ASSET_BASE_URL` | `https://assets.grudge-studio.com/gameopen` |
| `VITE_ASSET_CDN_URL` | `https://assets.grudge-studio.com` |
| `VITE_GAME_SERVER_URL` | `wss://gameopen-production.up.railway.app` |
| `VITE_ZONE_SERVER_URL` | `wss://voxgrudge-grudox-room-production.up.railway.app` |
| `VITE_GRUDGE_API_BASE` | `https://grudge-api-production-0d46.up.railway.app` |
| `VITE_OBJECTSTORE_URL` | `https://info.grudge-studio.com/api/v1` |
| `VITE_AI_URL` | `https://ai.grudge-studio.com` |
| `VITE_AUTH_GATEWAY_URL` | `https://id.grudge-studio.com` |

Root `.env.example` + `artifacts/animator/.env.example` are the templates.

---

## 3. The ENGINE + accounts

| Surface | URL | Connection |
|---------|-----|------------|
| Studio portal / The ENGINE | https://grudge-studio.com | Identity catch-all → Railway |
| **Grudge ID** | https://id.grudge-studio.com | Auth gateway — login, SSO, `/api/auth/*` |
| Account API edge | https://account.grudge-studio.com | Profiles / social (grudge-backend) |
| Open Account hub | `open…/?door=account` or native `account` | Same-origin `/api/characters` → **Postgres** |

**Flow:** Open `gameSession.boot()` → guest or SSO → characters from **Railway Postgres**, not ObjectStore D1.

---

## 4. AI workers / gateways

| Service | URL | Notes |
|---------|-----|--------|
| **AI Gateway** | https://ai.grudge-studio.com | CF AI Gateway + hub; Open Dressing Room / Danger tools |
| **ObjectStore** | https://objectstore.grudge-studio.com | D1 catalog index |
| **Info catalogs** | https://info.grudge-studio.com/api/v1 | Preferred JSON SSOT when objectstore 404s |
| **Asset index** | https://api.grudge-studio.com/assets | D1 `grudge-assets-db` |
| **CDN Worker** | https://assets.grudge-studio.com | R2 binaries |

Open client: `VITE_AI_URL` + animator `ai/` surfaces (danger tools, companion, pattern gen).

---

## 5. Editors & deployments by era

### Voxel era → **GRUDOX + Mine-Loader + VoxGrudge**

| Surface | URL | Deploy |
|---------|-----|--------|
| Open library (Voxel filter) | open.grudge-studio.com | gameopen Vercel |
| **VoxGrudge full world** | https://voxgrudge.vercel.app | Desktop kit / voxgrudge Vercel |
| GRUDOX hub | https://grudox.grudge-studio.com | CF Worker + Vercel static |
| Carrier | https://carrier.grudge-studio.com | Same GRUDOX worker → room Railway |
| Mine-Loader Realms | https://mine-loader.vercel.app | mine-loader + Railway API |
| Worldbuilder | open `/voxel` | native gameopen |
| DCQ | https://dcq.grudge-studio.com | Dungeon-Crawler-Quest Vercel |
| Z-Brawl | grudox …/arcade/play/z-brawl | GRUDOX arcade |

**WS:** Browser → CF Worker (grudox/carrier) → `voxgrudge-grudox-room` Railway (Vercel cannot upgrade WS).

### Warlords era → **Forge + Warlords client + Genesis**

| Surface | URL | Deploy |
|---------|-----|--------|
| Grudge Warlords | https://grudgewarlords.com | GrudgeBuilder Vercel + Colyseus Railway |
| Client play | https://client.grudge-studio.com | same / alias |
| **Forge editor** | https://forge.grudge-studio.com | Grudge-Studio-Forge / RTS-Grudge |
| Warlord Genesis | https://warlord-genesis.vercel.app/lobby | warlord-genesis Vercel |
| Character Foundry | https://character.grudge-studio.com | create heroes → client |
| Water home island | https://water.grudge-studio.com/island | **Canonical** Warlords water SPA (repo may still be named Tactical-Infinity). **Not** tactical-infinity.vercel.app (orphaned). **Not** Replit. |
| Studio | https://studio.grudge-studio.com | monorepo studio artifact |
| Dash | https://dash.grudge-studio.com | asset catalog admin |

### Nexus era

| Surface | URL | Deploy |
|---------|-----|--------|
| Carrier / rooms | https://carrier.grudge-studio.com | GRUDOX CF → room Railway |
| Metaverse | https://metaverse.grudge-studio.com | grudge-metaverse |
| Mech Forge | https://mech-playground.vercel.app | grudge-mech-forge |
| Import bay | Open library Nexus scaffold | until production URL replaces scaffold |

### Armada era

| Surface | URL | Deploy |
|---------|-----|--------|
| **Grim Armada** | https://grim-armada-web.vercel.app | grim-armada-web |
| Sailtest | open Danger map path | gameopen native |
| Import bay | Open library Armada scaffold | until next naval deploy |

---

## 6. Project connections (Vercel / Railway / CF)

| Project | Platform | Domain(s) |
|---------|----------|-----------|
| gameopen | Vercel | open.grudge-studio.com, gameopen.vercel.app |
| open CF worker | Cloudflare | open.grudge-studio.com proxy |
| grudox CF worker | Cloudflare | grudox / carrier |
| grudge-api | Railway | characters DB |
| gameopen API | Railway | Danger WS |
| grudox-room | Railway | zone WS |
| mine-loader | Vercel + Railway | Realms |
| voxgrudge | Vercel | full world |
| warlord-genesis | Vercel | MOBA lobby |
| forge | Vercel + CF | forge.grudge-studio.com |
| grim-armada-web | Vercel | Armada |

---

## 7. Deploy Open (production)

```bash
cd F:\GitHub\gameopen
git push origin main          # already CI if linked
npm run deploy:prod           # build + vercel --prod
# optional edge:
cd infra/cloudflare/open && npx wrangler deploy

# smoke
curl -sI https://open.grudge-studio.com/
curl -s https://open.grudge-studio.com/api/health
npm run verify:assets:open
```

**Smoke checklist**

1. Library loads with era filters (Voxel / Warlords / Nexus / Armada)  
2. Guest or SSO → `/api/characters` via Railway  
3. Danger Room mounts Studio  
4. Voxel → Worldbuilder / VoxGrudge handoff  
5. Assets from R2 (no HTML-as-GLB)  

---

## 8. Hard rules

1. Characters = **Railway Postgres** only (never invent a second account DB).  
2. Voxel multiplayer WS = **GRUDOX CF → grudox-room**, not Vercel alone.  
3. Warlords maps/edit = **Forge**; play = Warlords / Genesis / client.  
4. No Desktop HTML forks as production apps — see `docs/ERA_LIBRARY.md`.  
5. Secrets stay in Vercel/Railway/CF dashboards — never commit.
