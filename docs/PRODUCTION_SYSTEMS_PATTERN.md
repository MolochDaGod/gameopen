# Production systems pattern — fastest Open / fleet path

**Status:** SSOT 2026-07  
**Code:** `artifacts/animator/src/lib/productionSystemsPattern.ts`  
**Skills:** `grudge-live-servers` · `grudge-stack` · `grudge-production-cinema` · `grudge-production-world`

This is the **pattern and deployment system** we use for cinema, character select, sectors, load screens, REST, and Node edge. Do not invent a second topology.

---

## 1. Topology (best use of Cloudflare + Vercel + Railway)

```
Browser
  │
  ├─ open.grudge-studio.com          Cloudflare Worker (gameopen-open-proxy)
  │       └─► gameopen.vercel.app    Vercel SPA (static + vercel.json rewrites)
  │
  ├─ Same-origin REST /api/*         Vercel rewrites → Railway Node (grudge-api)
  │                                   + id.grudge-studio.com auth segments
  │
  ├─ Binaries                        Cloudflare R2 → assets.grudge-studio.com
  │                                   (also /models|/textures rewrites on Open)
  │
  ├─ Asset index                     Cloudflare D1 → api.grudge-studio.com/assets
  │
  └─ WebSockets (if needed)          CF Worker upgrade → Railway room
                                      (Vercel alone cannot upgrade WS)
```

| Layer | Platform | Why |
|-------|----------|-----|
| Frontend SPA | **Vercel** | Fast static edge, git deploy, rewrites |
| Custom domain / DDoS | **Cloudflare Worker** | open.* stable, cookie same-origin |
| GLB / textures | **R2 + CF CDN** | No Vercel OOM, cacheable |
| Registry | **D1** | Queryable index |
| Characters / account / island | **Railway Node** | Always-on REST + Postgres |
| PvP / rooms | **Railway or CF DO** | Realtime |

---

## 2. REST API pattern (fast + correct)

**Always call same-origin** on Open:

| Need | Path |
|------|------|
| Health | `GET /api/health` |
| Roster | `GET /api/characters?era=warlords` |
| Account | `GET /api/account` |
| Island | `GET /api/island` |
| Wallet | `GET /api/wallet` |
| Auth | `/api/auth/*` → id + Railway session |
| D1 index | `GET /api/asset-registry` |

**Do not** open absolute `https://grudge-api-….railway.app` from the browser when rewrites exist — CORS and cookies break.

Rewrites live in root `vercel.json`. Edge Worker only forwards to Vercel origin.

---

## 3. Timing pattern (cinema + load screens + REST)

| Budget | Value | Owner |
|--------|-------|--------|
| Parallel REST warmup | ≤ **2.5 s** | `warmupProductionSurface` |
| Surface slow notice | **4 s** | UI |
| Surface stall | **12 s** | UI skip / degraded |
| BootGate soft | **8 s** / step | `BOOT_SLOW_NOTICE_MS` |
| BootGate hard | **30 s** / step | `BOOT_STALL_TIMEOUT_MS` |
| Cinema skip | catalog `skippableAfterSec` | ProductionCinema |

**Rule:** During cinema or HelpersLoadScreen, **start REST + mesh prefetch in parallel**. Never:

```
await characters();  // then
await loadGlb();     // serial — slow
```

Use:

```
await Promise.all([warmupProductionSurface("characters"), cinemaPlay()]);
```

---

## 4. Load screen patterns (pick one per surface)

| Pattern | When | Implementation |
|---------|------|----------------|
| **cinema_backdrop** | Library doors | `intro_doors` loop under UI |
| **cinema_flow** | Characters, lobby, home, Hellmaw | `CinemaFlowGate` + letterbox |
| **boot_gate** | Danger Room / full play | `BootGate` + readiness checklist |
| **helpers_orbit** | Heavy mode boot | `HelpersLoadScreen` |
| **spa_instant** | Landing auth | No WebGL until enter |

Surface map: `SURFACE_LOAD_PLAN` in code.

---

## 5. Asset load pattern (fastest binaries)

1. **Catalog** relative keys only (`models/…`)  
2. **`loadGltfFirst` + `assetCandidates`** (CDN-first for grudge6, multi-host fallback)  
3. **Shared** Draco + Meshopt loader  
4. **Never** `assets.grudge-studio.com/gameopen/*` incomplete prefix  
5. **Never** multi-hundred-MB shells in git / Vercel output  

Cinema character inclusions follow the same path as gameplay.

---

## 6. Cinema + character select (game flow)

```
Landing (auth, spa_instant)
  → cinema intro_to_characters   (+ REST roster warmup parallel)
  → /characters CampfireLobby    (select / create)
Library doors
  → cinema_backdrop intro_doors  (+ REST parallel)
Lobby
  → cinema_flow lobby_establish
Danger
  → optional danger_establish → BootGate + HelpersLoad
Home / Hellmaw
  → cinema_flow + CDN shells
```

Code: `three/cinema/*`, `CinemaFlowGate`, `docs/PRODUCTION_CINEMA.md`.

---

## 7. Deploy checklist (ops)

```bash
cd C:\Users\nugye\Documents\gameopen

# 1 CDN truth
npm run verify:assets:cdn

# 2 SPA
git push origin main
# or: npm run deploy:prod

# 3 Edge (only if Worker changed)
cd infra/cloudflare/open && npx wrangler deploy

# 4 Same-origin + REST
npm run verify:assets:open
# GET https://open.grudge-studio.com/api/health

# 5 Flow smoke
# /login → cinema → /characters
# /  library ambient cinema
# /lobby establish
```

Node (Railway) deploys separately when **API** changes — frontend push does not replace grudge-api.

---

## 8. Kill list

- Large GLBs only in Vercel bundle  
- Browser → Railway absolute URL instead of `/api/*`  
- Incomplete R2 `/gameopen/` GLB prefix  
- Vercel-only WebSocket  
- Serial REST then mesh on critical path  
- Localhost-only cinema/world sign-off  

---

## 9. Related docs

| Doc | Topic |
|-----|--------|
| [DEPLOY.md](../DEPLOY.md) | Env + topology |
| [FLEET_ASSET_DEPLOYMENT.md](./FLEET_ASSET_DEPLOYMENT.md) | R2 rewrites |
| [PRODUCTION_CINEMA.md](./PRODUCTION_CINEMA.md) | Cinema recordings |
| [PRODUCTION_WORLD.md](./PRODUCTION_WORLD.md) | World rules |
| [OPEN_STACK.md](./OPEN_STACK.md) | Macro stack |
