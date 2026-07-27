# Fleet auth wiring (Open · Mine-Loader · satellites)

**SSOT:** `https://id.grudge-studio.com` (id-gateway Worker → Railway `grudge-api-production`).

## Topology

```
Browser (open / mine / puter / vercel)
  │
  ├─ Login UI ──────────────► id.grudge-studio.com/login
  ├─ /api/auth/* (same-origin) ► id.grudge-studio.com/api/auth/*  (Vercel rewrite)
  │                                or absolute id hub when no rewrite
  ├─ /api/characters|account ──► Railway Postgres (game data)
  └─ Mine worlds / blocks ─────► mine-loader-api Railway
```

| Concern | Host |
|---------|------|
| Login, me, exchange, bridge, claim, guest | **id.grudge-studio.com** |
| Characters, bag, wallet, island | Railway gameData |
| Voxel worlds / blocks | mine-loader-api |
| Portal marketing UI | grudge-studio.com (not auth APIs) |

## Open `vercel.json`

All `/api/auth/:path*` → `https://id.grudge-studio.com/api/auth/:path*`  
(No direct Railway auth splits — that caused inconsistent exchange.)

## Client rules

1. Prefer **sso_token** (session JWT) over **grudge_token** (launch).
2. Exchange launch tokens only via id hub (`session/exchange` or `grudge-bridge`).
3. On 401/403 stop retrying (no body×host storms).
4. Silent claim: `POST /api/auth/session/claim` with credentials when local JWT missing.
5. Dual-write login return params: `redirect_uri`, `redirect`, `return`, `return_to`, `origin`, `app`.

## Code

| App | Module |
|-----|--------|
| Open | `lib/grudgeAuth.ts`, `lib/fleet.ts`, `auth/fleetCore.ts` |
| Mine-Loader | `lib/grudgeAuth.ts`, api `fleetProxy.ts` |
| Drop-in | `grudge-game-bootstrap.js`, `grudge-fleet.js` ≥ 2.10 |
| Shared | GrudgeBuilder `shared/fleet/authConnect.ts`, `manifest.ts` |

## Smoke

```bash
# Auth hub
curl -s -o NUL -w "%{http_code}\n" https://id.grudge-studio.com/api/auth/me
# expect 401

curl -s -o NUL -w "%{http_code}\n" -X POST https://id.grudge-studio.com/api/auth/session/exchange \
  -H "Content-Type: application/json" -d '{"token":"x"}'
# expect 401 (not 404)

# Open rewrite (after deploy)
curl -s -o NUL -w "%{http_code}\n" https://open.grudge-studio.com/api/auth/me
# expect 401

# Mine SPA rewrite
curl -s -o NUL -w "%{http_code}\n" https://mine-loader.vercel.app/api/auth/me
# expect 401
```
