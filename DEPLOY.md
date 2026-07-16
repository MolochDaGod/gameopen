# Grudge Open — Deployment Guide

**Canonical URL:** https://open.grudge-studio.com  
**Macro stack (D1, AI, handoff):** [docs/OPEN_STACK.md](docs/OPEN_STACK.md)

## Topology

```
open.grudge-studio.com  (CF Worker gameopen-open-proxy)
        → gameopen.vercel.app  (SPA + vercel.json rewrites)
                → id / grudge-api / objectstore / assets / gameopen Railway / zone WS
```

Deploy Worker: `cd infra/cloudflare/open && npx wrangler deploy`

---

## Vercel (gameopen.vercel.app)

### Required env vars

| Var | Value | Notes |
|-----|-------|-------|
| `VITE_USE_R2` | `true` | Route assets through R2 CDN |
| `VITE_ASSET_BASE_URL` | `https://assets.grudge-studio.com/gameopen` | R2 CDN prefix |
| `VITE_ASSET_CDN_URL` | `https://assets.grudge-studio.com` | R2 root |
| `VITE_GAME_SERVER_URL` | `wss://gameopen-production.up.railway.app` | Danger Room WS |
| `VITE_ZONE_SERVER_URL` | `wss://voxgrudge-grudox-room-production.up.railway.app` | GRUDOX zone WS |
| `VITE_GRUDGE_API_BASE` | `https://grudge-api-production-0d46.up.railway.app` | Builder API |
| `VITE_OBJECTSTORE_URL` | `https://info.grudge-studio.com/api/v1` | Definitions catalogs (info SSOT; objectstore host often 404) |
| `VITE_PLAY_SHELL_URL` | play-shell host | GRUDOX Island deep-links (optional) |

### Auth flow
1. Open **open.grudge-studio.com** (or Vercel origin) → `gameSession.boot()`
2. Existing fleet token → revalidate `/api/auth/*` / account
3. No token → guest (library + combat; local draft chars only)
4. Grudge ID → `id.grudge-studio.com` with dual return params (`app=gameopen`)
5. Prefer **`sso_token`** over launch `grudge_token`; exchange if needed
6. Characters from Postgres via `/api/characters` (not ObjectStore D1)

### Vercel rewrites (see root `vercel.json`)
- `/api/auth/*`, `/login` → Grudge ID  
- `/api/characters*`, `/api/account/*`, `/api/wallet*` → Builder Railway  
- `/api/objectstore/*` → ObjectStore (D1 catalogs)  
- `/api/assets/*` → R2  
- `/api/brawl|space|carrier` → GRUDOX zone Railway  
- `/api/*` → gameopen Railway  

---

## Railway (gameopen-production)

| Var | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `PORT` | `8080` |
| `ALLOWED_ORIGINS` | `https://gameopen.vercel.app,https://open.grudge-studio.com` |
| `GRUDGE_ID_URL` | `https://id.grudge-studio.com` |
| `GRUDGE_BUILDER_API` | `https://grudge-api-production-0d46.up.railway.app` |
| `JWT_SECRET` | *(shared with Builder)* |
| `SESSION_SECRET` | *(random 64-char hex)* |

## grudge-api-production (external)

`ALLOWED_ORIGINS` / CORS must include:
- `https://open.grudge-studio.com`
- `https://gameopen.vercel.app`

## Data reminders

| Kind | Store |
|------|--------|
| Characters / wallet | Builder **Postgres** |
| Weapon/skill JSON catalogs | ObjectStore **D1** + R2 |
| GLB / room posters | **R2** (`gameopen/`) |
| Mine-Loader worlds | Mine-Loader Railway (separate) |

## Smoke checks after deploy

```bash
curl -sI https://open.grudge-studio.com/ | head -5
curl -s https://gameopen-production.up.railway.app/api/health
curl -sI https://id.grudge-studio.com/login | head -3
curl -H "Authorization: Bearer <sso_token>" https://open.grudge-studio.com/api/characters
curl -sI https://objectstore.grudge-studio.com/api/v1/weaponSkills.json | head -5
curl -sI https://assets.grudge-studio.com/gameopen/icons/attack.png | head -5
```

Default home after deploy: **Game Library** (`/?door=library`).
