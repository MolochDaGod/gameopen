# Fleet env · secrets · AI · accounts — domain matrix

**Purpose:** One production connection matrix so **every** domain deployment uses the same dependencies, env names, accounts stack, and AI endpoints.

**Law:** Names only in git. Secret **values** live in Vercel / Railway / `wrangler secret` only. Never `VITE_*` for keys, JWT, DB URLs, or provider API secrets.

**Code SSOT (URLs):** `GrudgeBuilder/shared/fleet/manifest.ts` → `FLEET_URLS`  
**Code SSOT (client env keys):** `GrudgeBuilder/shared/fleet/storage.ts` → `FLEET_CLIENT_ENV` + `FLEET_SERVER_SECRET_KEYS`  
**Topology:** `docs/PRODUCTION_CONNECTIONS.md` · skills `grudge-live-servers` · `grudge-production-wiring` · `grudge-fleet`

---

## 1. Shared platform endpoints (all domains)

| Concern | Production URL | Browser pattern |
|---------|----------------|-----------------|
| **Accounts / login UI** | `https://id.grudge-studio.com` | `/login?redirect_uri=` + same-origin `/api/auth/*` rewrite |
| **Player SSOT (characters, bag, island, wallet)** | `https://grudge-api-production-0d46.up.railway.app` | same-origin `/api/characters\|account\|…` → Railway |
| **Definitions JSON** | `https://objectstore.grudge-studio.com/api/v1` (alt: `info…/api/v1`) | fetch catalogs; never player bag |
| **Binaries CDN** | `https://assets.grudge-studio.com` | R2; optional same-origin `/models` rewrite |
| **Asset index (D1)** | `https://api.grudge-studio.com/assets` | search only — not roster |
| **AI gateway** | `https://ai.grudge-studio.com` | client → hub; provider keys **only** on hub/worker |
| **Portal shell** | `https://grudge-studio.com` | marketing / ENGINE — not login SSOT |
| **Open launcher** | `https://open.grudge-studio.com` | library hub |
| **Warlords play** | `https://grudgewarlords.com` · `client.grudge-studio.com` | same SPA family |
| **Foundry create** | `https://character.grudge-studio.com` | create + 4-slot only |

**Token keys (all apps):** `grudge_auth_token` · `grudge_session_token` · `grudge.token` · `sso_token`

**Do not use:** `auth.grudge-studio.com` (not product) · `api.grudge-studio.com` for login · D1/localStorage as character SSOT · `VITE_OBJECTSTORE_URL` → github.io

---

## 2. Public client env (Vercel Production + Preview)

Mirror on **every** browser SPA that talks to the fleet. Prefer hard-coded defaults from `FLEET_URLS` in code; env is override / build-time bake.

| Key | Canonical value | Required on |
|-----|-----------------|-------------|
| `VITE_AUTH_GATEWAY_URL` | `https://id.grudge-studio.com` | All game SPAs |
| `VITE_AUTH_URL` / `VITE_AUTH_API_URL` | same as gateway (aliases) | Warlords / dual-name clients |
| `VITE_ASSETS_URL` | `https://assets.grudge-studio.com` | All 3D games |
| `VITE_ASSET_CDN_URL` | `https://assets.grudge-studio.com` | Open naming |
| `VITE_ASSET_BASE_URL` | `https://assets.grudge-studio.com/gameopen` | Open only (prefix pack) |
| `VITE_USE_R2` | `true` | Open production |
| `VITE_OBJECTSTORE_URL` | `https://objectstore.grudge-studio.com/api/v1` | All (or info alias) |
| `VITE_AI_URL` | `https://ai.grudge-studio.com` | Any AI UI / tools |
| `VITE_GAME_DATA_API` | `https://grudge-api-production-0d46.up.railway.app` | Prefer same-origin; URL for health/docs |
| `VITE_GRUDGE_API_BASE` | same Railway URL | Open naming |
| `VITE_COLYSEUS_URL` / `VITE_PVP_SERVER_URL` | `wss://grudge-api-production-0d46.up.railway.app` | Warlords rooms |
| `VITE_GAME_SERVER_URL` | `wss://gameopen-production.up.railway.app` | Open Danger |
| `VITE_ZONE_SERVER_URL` | `wss://voxgrudge-grudox-room-production.up.railway.app` | GRUDOX zones |
| `VITE_PHANTOM_APP_ID` | public app id (register origins) | Wallet UIs only |

**Forbidden on Vercel client env:** `JWT_SECRET`, `DATABASE_URL`, `OPENAI_API_KEY`, `ELEVEN_LABS_API`, `R2_SECRET_*`, Crossmint **server** keys, Discord client secret.

---

## 3. Server secrets (Railway + CF Workers only)

| Key | Where | Purpose |
|-----|--------|---------|
| `DATABASE_URL` | grudge-api Railway | Postgres player SSOT |
| `JWT_SECRET` | grudge-api + gameopen API + Workers that verify JWT | **Same value** fleet-wide |
| `SESSION_SECRET` | grudge-api / gameopen | sessions |
| `ALLOWED_ORIGINS` / `CORS_ORIGINS` | every Railway API | include all prod domains + `*.vercel.app` |
| `AUTH_EXTRA_RETURN_HOSTS` | grudge-api | extra SSO return hosts |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | upload jobs, ObjectStore | S3 API to R2 |
| `OBJECTSTORE_API_KEY` | workers / admin upload | ObjectStore admin |
| `ELEVEN_LABS_API` | **danger-ai Worker only** (or CI) | TTS/SFX — never browser |
| `OPENAI_API_KEY` / `XAI_API_KEY` / provider keys | **ai.grudge-studio.com hub** + Railway server paths | never `VITE_*` |
| `CROSSMINT_SERVER_API_KEY` | Railway only | mint / server wallet |
| `DISCORD_CLIENT_SECRET` | Railway auth only | OAuth |
| `INTERNAL_API_KEY` | shared Railway services | service-to-service |

ElevenLabs deploy:

```bash
cd gameopen/infra/cloudflare/danger-ai   # or monorepo path
npx wrangler secret put ELEVEN_LABS_API
npx wrangler deploy
```

---

## 4. Accounts stack (one account, all domains)

```
Browser domain
  → id.grudge-studio.com  (login / JWT mint)
  → same-origin /api/auth/*  (rewrite → id hub)
  → same-origin /api/characters|account|inventory|island|wallet  (rewrite → Railway)
```

| Scope | API | Shared? |
|-------|-----|---------|
| Account bag / GBUX / home island | `/api/account/*`, `/api/island/*` | Yes across eras |
| Character XP / mastery / equipment | `/api/characters/:id` | Per character UUID |
| Definitions | ObjectStore | Public |
| Auth return allowlist | `shared/fleet/authReturn.ts` + Railway `AUTH_EXTRA_RETURN_HOSTS` | Must list every public origin |

**Puter exception:** `*.puter.site` cannot Vercel-rewrite — call Railway + id + ObjectStore with CORS.

---

## 5. AI stack (one gateway)

| Layer | Host | Keys live on |
|-------|------|----------------|
| Client tools / companion | `VITE_AI_URL` → `ai.grudge-studio.com` | none in browser |
| CF AI hub + Workers AI | `ai.grudge-studio.com` | wrangler secrets / CF bindings |
| Open Danger audio AI | same-origin `/api/danger-ai/*` → Worker | `ELEVEN_LABS_API` |
| Server avatar/gen (Warlords) | Railway or AI hub proxy | `OPENAI_API_KEY` etc. |

Rule: browser never holds provider keys. Prefer hub routes with Grudge JWT.

---

## 6. Domain × deployment matrix

| Domain / product | Platform | Vercel project (if any) | Public env pack | Accounts | AI |
|------------------|----------|---------------------------|-----------------|----------|-----|
| open.grudge-studio.com | Vercel + CF edge | `gameopen` | Open pack (§2 + zone/game WS) | same-origin → Railway | `VITE_AI_URL` + danger-ai Worker |
| gameopen.vercel.app | same | `gameopen` | same | same | same |
| client.grudge-studio.com · grudgewarlords.com | Vercel | `grudge-builder` | `FLEET_CLIENT_ENV` | rewrites → id + Railway | `VITE_AI_URL` |
| character.grudge-studio.com | CF Pages | character-viewer | auth + assets + objectstore | Railway create | optional |
| id.grudge-studio.com | Vercel alias → Railway | grudge-builder / gateway | n/a (server) | **JWT mint** | — |
| info / objectstore | Vercel + Worker | `objectstore-grudge` | CORS allowlist | JWT verify | optional admin AI |
| grudox / carrier | CF Worker + Vercel static | `grudox` | DOMAIN_* + fleet URLs | Railway + room | hub URL |
| mine / mineloader | Vercel + Railway API | `mine-loader` | fleet VITE_* + mine API | id + Railway | optional |
| warlord-genesis | Vercel | `warlord-genesis` | fleet VITE_* | id + Railway | optional |
| forge.grudge-studio.com | Vercel + CF | `grudge-studio-forge` | fleet VITE_* | id | hub |
| voxgrudge | Vercel | `voxgrudge` | fleet VITE_* | Railway room | optional |
| dcq.grudge-studio.com | Vercel | `dungeon-crawler-quest` | fleet VITE_* | id + Railway | optional |
| the-engine / grudge-studio.com | Vercel + Railway | `the-engine` | portal + AI server keys | portal rewrites | GROQ/OpenAI **server** |
| assets.grudge-studio.com | CF CDN Worker | — | bindings | — | — |
| ai.grudge-studio.com | CF Workers | grudge-ai-hub | secrets | JWT | **all provider keys** |

### CORS / ALLOWED_ORIGINS (minimum production set)

```
https://open.grudge-studio.com
https://gameopen.vercel.app
https://grudgewarlords.com
https://client.grudge-studio.com
https://character.grudge-studio.com
https://grudox.grudge-studio.com
https://carrier.grudge-studio.com
https://forge.grudge-studio.com
https://grudge-studio.com
https://id.grudge-studio.com
https://*.vercel.app
https://*.puter.site
http://localhost:5173
http://localhost:3000
```

Keep in sync with `shared/fleet/authReturn.ts` and Railway env.

---

## 7. npm / runtime dependencies (fleet 3D games)

Do not invent alternate stacks. Skill **`grudge-3d-game-packages`** + Open `docs/OPEN_PACKAGE_SSOT.md`:

| Layer | Package |
|-------|---------|
| Renderer | `three` ^0.185 |
| Physics | `@dimforge/rapier3d-compat` + `@workspace/grudge-physics` when monorepo |
| Mesh queries | `three-mesh-bvh` |
| Nav / AI | `three-pathfinding`, `yuka` as needed |
| Auth client | fleet bootstrap / `grudge-fleet.js` ≥ 2.10 — not a second auth package |
| Player state | Railway via same-origin `/api` — not a second DB client in browser |

---

## 8. Gap audit (live Vercel production)

### 2026-08-04 — public fleet pack applied

Shared Production `VITE_*` pack (§9.1) force-synced to:

`gameopen` · `grudge-builder` · `warlord-genesis` · `mine-loader` · `voxgrudge` · `grudge-studio-forge` · `dungeon-crawler-quest` · `grudox`

Open extras: `VITE_ZONE_SERVER_URL`, `VITE_USE_R2=true`.

**Vite bakes env at build** — redeploy each project before runtime clients see new values (or rely on in-code `FLEET_URLS` defaults).

| Project | Public pack | Notes |
|---------|-------------|--------|
| **gameopen** | Applied | Auth + AI + objectstore + zone WS |
| **grudge-builder** | Applied | Already had family; re-synced canonical URLs |
| **warlord-genesis** | Applied | |
| **mine-loader** | Applied | Was thin (ID + asset only) |
| **voxgrudge** | Applied | Was empty |
| **grudge-studio-forge** | Applied | Was empty |
| **dungeon-crawler-quest** | Applied | Was backend-only |
| **grudox** | Applied | Still has DOMAIN_* / provider secrets (server-side) |
| **objectstore-grudge** | Server | CORS + JWT — not SPA pack |
| **the-engine** | Server-heavy | Provider keys OK on server; do not expose as VITE_ |

**Still ops-owned (secrets, not auto-set here):**

| Item | Owner |
|------|--------|
| `JWT_SECRET` same across Railway + JWT Workers | Railway / wrangler |
| `ALLOWED_ORIGINS` includes every live domain | Railway each API |
| `ELEVEN_LABS_API` | danger-ai Worker only |
| Provider AI keys | ai hub / Railway server only |
| Preview envs | Re-run §9.1 with `preview` if needed |

---

## 8b. Production schema + wiring pass (2026-08-04)

### Player SSOT — Railway Postgres (`grudge-warlords-rpg` / Postgres)

Applied via public proxy (additive / IF NOT EXISTS):

| Step | Result |
|------|--------|
| `ensure-auth-schema.mjs` | users/accounts identity + treaty tables bootstrap |
| `apply-sql-migrations.mjs` | 004–007, 009 applied (001–003 legacy skipped) |
| `run-migration-008.mjs` | treaty_groups / friends / DMs present |
| `fix-characters-full-schema.mjs` | roster columns complete; drizzle-like SELECT OK |
| `040_character_nfts.sql` | `character_nfts` table present |
| Verify | **65** public tables; fleet identity + characters columns OK |

### Shared wiring

| Change | Where |
|--------|--------|
| `CORS_ORIGINS` → **38** fleet hosts | Railway `grudge-api` |
| `ALLOWED_ORIGINS` mirrored | Railway `grudge-api` |
| `ALLOWED_ORIGINS` 7 → **19** | Railway `gameopen` |
| Public `VITE_*` pack | Vercel (prior pass) |
| SQL allowlist includes 008 + 040 | `scripts/apply-sql-migrations.mjs` |

### D1

| DB | Action |
|----|--------|
| `grudge-objectstore` | `wrangler d1 execute --remote --file=workers/schema.sql` (IF NOT EXISTS) |

### Redeploys

| Surface | Action |
|---------|--------|
| Railway `grudge-api` | Redeploy after CORS (SUCCESS) |
| Railway `gameopen` | Redeploy after ALLOWED_ORIGINS |
| Vercel `grudge-builder` / `gameopen` / `objectstore-grudge` | Production deploy (bake env) |

**Not player SSOT:** Neon local `.env` (dev), Supabase (deprecated), VPS MySQL (legacy). Do not migrate those for heroes.

---

## 9. Apply / sync procedure (ops)

### 9.1 Public fleet pack (safe to set via CLI)

```powershell
$scope = "grudgenexus"
$pack = @{
  VITE_AUTH_GATEWAY_URL = "https://id.grudge-studio.com"
  VITE_AUTH_URL         = "https://id.grudge-studio.com"
  VITE_ASSETS_URL       = "https://assets.grudge-studio.com"
  VITE_ASSET_CDN_URL    = "https://assets.grudge-studio.com"
  VITE_OBJECTSTORE_URL  = "https://objectstore.grudge-studio.com/api/v1"
  VITE_AI_URL           = "https://ai.grudge-studio.com"
  VITE_GAME_DATA_API    = "https://grudge-api-production-0d46.up.railway.app"
  VITE_GRUDGE_API_BASE  = "https://grudge-api-production-0d46.up.railway.app"
}
$projects = @(
  "gameopen","grudge-builder","warlord-genesis","mine-loader",
  "voxgrudge","grudge-studio-forge","dungeon-crawler-quest","grudox"
)
foreach ($p in $projects) {
  foreach ($k in $pack.Keys) {
    vercel env add $k production --scope $scope --project $p --value $pack[$k] --force -y --no-sensitive
  }
}
```

Open-only extras:

```powershell
vercel env add VITE_ZONE_SERVER_URL production --scope grudgenexus --project gameopen --value "wss://voxgrudge-grudox-room-production.up.railway.app" --force -y --no-sensitive
vercel env add VITE_USE_R2 production --scope grudgenexus --project gameopen --value "true" --force -y --no-sensitive
```

Redeploy each project after env change (env injects at **build** for Vite).

### 9.2 Secrets (manual / never paste into chat)

1. Railway `grudge-api` → confirm `JWT_SECRET`, `DATABASE_URL`, `CORS_ORIGINS`  
2. Railway `gameopen-production` → same `JWT_SECRET`  
3. CF `npx wrangler secret put` for AI hub + danger-ai  
4. Never `vercel env add OPENAI_API_KEY` on pure SPA projects  

### 9.3 Smoke

```bash
curl -sI https://id.grudge-studio.com/login
curl -s  https://grudge-api-production-0d46.up.railway.app/api/health
curl -sI https://open.grudge-studio.com/api/auth/me    # expect 401
curl -sI https://open.grudge-studio.com/api/health
curl -sI https://assets.grudge-studio.com/js/grudge-fleet.js
curl -sI https://objectstore.grudge-studio.com/api/v1/
curl -sI https://ai.grudge-studio.com/
```

From GrudgeBuilder: `npm run probe:auth` · `npm run probe:truth`

---

## 10. Anti-patterns

| Bad | Good |
|-----|------|
| Different JWT per Vercel project | One `JWT_SECRET` on Railway + verifiers |
| Provider keys in `VITE_*` | AI hub / Worker / Railway server |
| Empty Vercel env + hardcoded github.io ObjectStore | `FLEET_CLIENT_ENV` + objectstore.grudge-studio.com |
| Second character DB per game | Railway Postgres only |
| Login on portal or api.* | `id.grudge-studio.com` only |
| Secrets in this markdown | Names only |

---

## 11. Related docs

| Doc | Role |
|-----|------|
| `PRODUCTION_CONNECTIONS.md` | Topology + era surfaces |
| `FLEET_AUTH_WIRING.md` | Auth rewrites + smoke |
| `OPEN_STACK.md` | Open env checklist |
| `GAME_AUDIO_ELEVENLABS_AND_DOCKER.md` | ElevenLabs / Docker secrets |
| GrudgeBuilder `.env.production.example` | Full server secret **names** |
| gameopen `.env.example` | Open + animator templates |
| skill `grudge-game-onboarding/references/env-and-deploy.md` | Onboarding gates |
