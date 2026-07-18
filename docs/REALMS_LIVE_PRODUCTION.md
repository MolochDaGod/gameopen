# Realms + Open live production (2026-07-18)

## Topology (production)

```
open.grudge-studio.com          CF Worker gameopen-open-proxy
        → gameopen.vercel.app   SPA (grudgenexus/gameopen)
                ├─ /api/auth/*           → id.grudge-studio.com
                ├─ /api/characters*      → grudge-api Railway (Postgres game DB)
                ├─ /api/blocks|worlds|*  → mine-loader-api Railway (Realms world DB)
                ├─ /api/ai/*             → ai.grudge-studio.com (realms agent)
                └─ /api/*                → gameopen-production Railway

mine-loader.vercel.app          Realms SPA
mine.grudge-studio.com          Edge mount
mine-loader-api-production      World authority (1 replica) + Postgres
```

## Railway game databases

| Project | Service | DB | Role |
|---------|---------|-----|------|
| **mine-loader** | `mine-loader-api` | **Postgres** (plugin) | Worlds, block edits, parties, codex server |
| **gameopen** | `gameopen` | **Postgres** (`DATABASE_URL`) | Open API content/helpers |
| **grudge-api** | Builder | **Postgres** | Characters, wallet, inventory (fleet SSOT) |

Confirm Online:

```bash
# Mine-Loader world API
curl -s https://mine-loader-api-production.up.railway.app/api/healthz
curl -s "https://mine-loader-api-production.up.railway.app/api/blocks?limit=2"

# Open API
curl -s https://gameopen-production.up.railway.app/api/health

# Characters (Builder)
curl -s https://grudge-api-production-0d46.up.railway.app/api/health
```

Schema push (Mine-Loader, one-off after empty DB):

```bash
cd F:\GitHub\mine-loader
railway link --project mine-loader --environment production --service mine-loader-api
railway run pnpm --filter @workspace/db run push-force
```

**Always 1 replica** on `mine-loader-api` (in-memory world authority).

## Vercel production (Open)

```bash
cd F:\GitHub\gameopen
# clear bad VERCEL_TOKEN if set
Remove-Item Env:VERCEL_TOKEN -ErrorAction SilentlyContinue
vercel link --yes --project gameopen --scope grudgenexus
vercel deploy --prod --yes
```

Aliases / domains:

- `gameopen.vercel.app` / `gameopen-grudgenexus.vercel.app`
- Custom: `open.grudge-studio.com` via CF Worker → Vercel

Required build env (Vercel project):

| Var | Value |
|-----|-------|
| `VITE_USE_R2` | `true` |
| `VITE_ASSET_CDN_URL` | `https://assets.grudge-studio.com` |
| `VITE_GAME_SERVER_URL` | `wss://gameopen-production.up.railway.app` |
| `VITE_ZONE_SERVER_URL` | `wss://voxgrudge-grudox-room-production.up.railway.app` |
| `VITE_GRUDGE_API_BASE` | `https://grudge-api-production-0d46.up.railway.app` |

## AI worker — Realms deploy ops

**Host:** https://ai.grudge-studio.com  
**Agent:** `POST /v1/agents/realms/chat` (auth Bearer / API key)

```bash
cd F:\GitHub\grudge-ai-hub
npx wrangler d1 execute grudge-ai-hub --remote --file=migrations/002_realms_agent.sql
npm run deploy
```

Open same-origin: `/api/ai/*` → AI hub (see `vercel.json`).

Example:

```http
POST https://ai.grudge-studio.com/v1/agents/realms/chat
Authorization: Bearer <token>
Content-Type: application/json

{ "message": "Checklist to go live with castle_eltz seed + codex blocks" }
```

## Seed + map-chunk deploys

```bash
npm run assets:voxel-last30:deployments
npm run assets:voxel-last30:seed-d1:apply
```

- Catalog: `content/worlds/seed-deployments.json` **v4**
- Map chunks: `content/worlds/voxel-map-chunk-deployments.json`
- D1: categories `voxel_map|animal|content|vfx`

## Smoke after ship

```bash
curl -sI https://open.grudge-studio.com/
curl -sI https://gameopen.vercel.app/
curl -s https://mine-loader-api-production.up.railway.app/api/healthz
curl -s "https://open.grudge-studio.com/api/blocks?limit=1"
curl -s https://ai.grudge-studio.com/health
curl -s https://ai.grudge-studio.com/v1/agents
```

Default home: **Game Library** (`/?door=library`). Production Maps: **P** → Maps (seed + mapChunk codex).
