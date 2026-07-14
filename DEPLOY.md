# Grudge Open — Deployment Guide

## Vercel (gameopen.vercel.app)

### Required env vars (set in Vercel → Project → Settings → Environment Variables)

| Var | Value | Notes |
|-----|-------|-------|
| `VITE_USE_R2` | `true` | Route assets through R2 CDN |
| `VITE_ASSET_BASE_URL` | `https://assets.grudge-studio.com/gameopen` | R2 CDN prefix |
| `VITE_ASSET_CDN_URL` | `https://assets.grudge-studio.com` | R2 root |
| `VITE_GAME_SERVER_URL` | `wss://gameopen-production.up.railway.app` | Danger Room WS |
| `VITE_ZONE_SERVER_URL` | `wss://voxgrudge-grudox-room-production.up.railway.app` | GRUDOX zone WS |
| `VITE_GRUDGE_API_BASE` | `https://grudge-api-production-0d46.up.railway.app` | Railway API |
| `VITE_OBJECTSTORE_URL` | `https://objectstore.grudge-studio.com/api/v1` | Definitions CDN |

### Auth flow
1. Player opens gameopen.vercel.app → `gameSession.boot()` fires on load
2. Existing `grudge.open.token` in localStorage → verify via `/api/auth/me`
3. No token → guest mode (full gameplay available, no character persistence)
4. "Grudge ID" button → redirect `id.grudge-studio.com/login?redirect_uri=https://gameopen.vercel.app`
5. Return → `?grudge_token=<jwt>` captured, stored, fleet characters loaded

### Vercel rewrites (vercel.json — already configured)
- `/api/auth/*` → `id.grudge-studio.com`
- `/api/characters*` → `grudge-api-production`
- `/api/account/*` → `grudge-api-production`
- `/api/brawl` → GRUDOX zone server
- `/api/space` → GRUDOX zone server
- `/api/carrier` → GRUDOX zone server

## Railway (gameopen-production — api-server)

### Required env vars

| Var | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `PORT` | `8080` |
| `ALLOWED_ORIGINS` | `https://gameopen.vercel.app,https://open.grudge-studio.com` |
| `GRUDGE_ID_URL` | `https://id.grudge-studio.com` |
| `GRUDGE_BUILDER_API` | `https://grudge-api-production-0d46.up.railway.app` |
| `JWT_SECRET` | *(copy from GrudgeBuilder Railway vars)* |
| `SESSION_SECRET` | *(random 64-char hex)* |

## grudge-api-production (GrudgeBuilder Railway — external)

The Railway SSOT for characters/accounts must have `gameopen.vercel.app` in its ALLOWED_ORIGINS.
Add to that service's env: `https://gameopen.vercel.app` in ALLOWED_ORIGINS or CORS config.

**Contact:** GrudgeBuilder Railway → Settings → Variables → ALLOWED_ORIGINS

## Smoke checks after deploy

```bash
# api-server health
curl https://gameopen-production.up.railway.app/api/health

# Fleet auth
curl https://id.grudge-studio.com/login

# Character API via Vercel proxy (requires valid grudge_token)
curl -H "Authorization: Bearer <token>" https://gameopen.vercel.app/api/characters

# Asset CDN
curl -I https://assets.grudge-studio.com/gameopen/models/arena-war-zone.glb
```
