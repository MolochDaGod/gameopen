# Deploy status & failed-build recovery (2026-08-04)

## SSOT connection audit (2026-08-05)

Verified against `FLEET_ENV_SECRETS_MATRIX.md` · `PRODUCTION_CONNECTIONS.md` · `fleetCore.FLEET` · five-layer asset law.

| Layer | SSOT host | Live probe | Via Open rewrite |
|-------|-----------|------------|------------------|
| **Player / bag / ledger** | Railway `grudge-api-production-0d46` | `/api/health` healthy · DB up | `/api/health` · `/api/uuid/test` · `/api/ledger/search` · `/api/characters` → 401 unauth JSON |
| **Auth** | `id.grudge-studio.com` | `/login` 200 | `vercel.json` → id |
| **Definitions** | `info…/api/v1` (+ objectstore OK) | master-weaponSkills 200 both | `/api/objectstore/*` → info |
| **Asset INDEX (D1)** | `api.grudge-studio.com/assets` | 200 JSON rows | `/api/asset-registry` |
| **Binaries (R2)** | `assets.grudge-studio.com` | grudge6 + outdoor + VFX 200 | same-origin rewrites |
| **Open Danger WS** | `gameopen-production` Railway | `/api/health` service=gameopen-api | CF Worker upgrade `/api/danger` only |
| **AI** | `ai.grudge-studio.com` | 200 | client `VITE_AI_URL` only (no keys) |

**Durable scripts (this host):** `deploy:gate` PASS · `smoke:prod` **41/41** · `verify:assets:cdn` **33/33** + D1 index.

**SPA:** live `index-6cCQMn6K.js` on open + gameopen.vercel.app (Vercel Production ~14m after PR #9). Bundle contains `/api/ledger`, `/api/uuid`, fleet hosts, heightfield, asset-registry.

**Best-practice checks:**

| Rule | Status |
|------|--------|
| Browser `apiUrl` same-origin `/api/*` | OK (`fleetCore`) |
| SSR/Node must not strip `/api` on Railway | Fixed 2026-08-05 (`apiUrl` → `gameDataUrl`) |
| No player bag in D1 | OK (registry = mesh index only) |
| No GLB in git for session mobs | OK (local only; seed script) |
| Vercel public env pack (auth/AI/CDN/API) | Present (names only) |
| CF open Worker: HTTP → Vercel rewrites; WS danger → Railway | OK |

## Live health (probed)

| Service | Host | Status |
|---------|------|--------|
| Open SPA | https://open.grudge-studio.com | **200** (Vercel Ready · `index-6cCQMn6K.js`) |
| Open API | https://gameopen-production.up.railway.app/api/healthz | **fix + redeploy 2026-08-04** (`root` crash + Danger WS) |
| Mine-Loader SPA | https://mine.grudge-studio.com · mineloader.grudge-studio.com | **200** (Vercel Ready) |
| Mine-Loader API | https://mine-loader-api-production.up.railway.app/api/healthz | **ok** (redeployed) |
| GRUDOX room | https://voxgrudge-grudox-room-production.up.railway.app/api/health | **ok** |
| Grudge API | https://grudge-api-production-0d46.up.railway.app/api/health | **ok** |

### 2026-08-04 pass (Open multiplayer + favicon)

| Issue | Fix |
|-------|-----|
| Railway `gameopen` **Crashed** (`ReferenceError: root is not defined` on `/api/maps`) | Define `root` in `server/standalone.mjs`; safe maps path |
| No Danger Room WS on Railway zero-dep server | `server/danger-relay.mjs` — full danger-net protocol + persistent DANGER/ARENA |
| Carrier upgrade **destroyed** non-carrier sockets | Carrier only claims `/api/carrier` |
| Client same-origin `/api/danger` hangs (Vercel no WS) | `DangerClient` → Railway WS on Open hosts; CF proxy upgrade path |
| Lobby empty when offline | Exponential backoff, offline event, Reconnect button, seed persistent rooms |
| `favicon.ico` 404 | Orc-head favicon set (`favicon.ico` / png / apple / pwa) |

## Failures found → fixed

### Vercel · gameopen
- **Symptom:** Production Error after PR #7 merge  
- **Cause:** `buildMineLoaderUrl` missing from `mineLoaderConfig.ts`  
- **Fix:** commit `53fd4da` restore exports · prod Ready  

### Vercel · mine-loader  
- **Symptom:** All production deploys Error (~7h)  
- **Cause:** `Characters.tsx` imported `fetchFleetCharactersDetailed` / `rosterEmptyHint` but era=voxel rewrite dropped exports  
- **Fix:** commit `0b35dc7` on `MolochDaGod/mine-loader` · prod Ready  

### Railway · gameopen  
- **Symptom:** Stale SUCCESS from 2026-07-09 while Open SPA advanced  
- **Fix:** `railway up` → SUCCESS `98162c5d…` (2026-08-03)  

### Railway · mine-loader-api  
- **Symptom:** Last SUCCESS 2026-07-31; needed latest code  
- **Fix:** `railway up` → SUCCESS `5bea3ad5…` (2026-08-03)  

## Agent checklist when deploys fail

1. `npx vercel ls <project> --limit 8` — find Error  
2. `npx vercel inspect <url> --logs` — root cause  
3. Railway: `railway link --project … --service …` then `railway deployment list`  
4. Health: curl `/api/healthz` on Railway hosts  
5. Fix **export/build** breaks first; redeploy Vercel (git push main) + Railway (`railway up`)  
6. Do not invent a second deploy path — use existing `vercel-build.mjs` / Dockerfiles  

## Projects intentionally not rebuilt this pass

| Project | Note |
|---------|------|
| grudge-builder | Production Ready |
| warlord-genesis | Production Ready |
| grudox / voxgrudge | Production Ready |
| warlord-genesis-api | Older SUCCESS; health OK if used |
