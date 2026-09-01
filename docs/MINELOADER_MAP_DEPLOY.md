# Mine-Loader map deploy & play modes

**Play host (canonical):** https://mineloader.grudge-studio.com  
**Alias:** https://mine.grudge-studio.com  
**Origin:** https://mine-loader.vercel.app  
**World API:** https://mine-loader-api-production.up.railway.app (1 replica)  
**Characters / explorer avatar:** Railway `grudge-api` via SPA rewrites  

---

## What this host is for

| Capability | How |
|------------|-----|
| **Multiplayer** | `#/lobby` · room codes · Railway world authority |
| **Self-hosted maps** | Promote Open `/voxel` interchange → worlds API → `#/play?mapId=` |
| **Harvest mode** | Minecraft-like gather/build — `mode=harvest` |
| **DRC combat** | Danger-Room combat — `mode=drc` with **account explorer avatar** |
| **Account characters** | `characterId` + `baseId=explorer` (or race kit) from grudge-api |

Not for: player bag/XP SSOT (that stays Railway grudge-api characters/account).  
Not for: Replit hosts.

---

## Architecture

```
Browser  https://mineloader.grudge-studio.com
  │  CF Worker mineloader-edge-proxy
  ▼
https://mine-loader.vercel.app   (static voxelcraft SPA)
  ├─ /api/auth/*        → id.grudge-studio.com
  ├─ /api/characters*   → grudge-api-production (explorer avatars)
  ├─ /api/account|wallet → grudge-api
  └─ /api/*             → mine-loader-api Railway (worlds, blocks, lobby, WS)
                           └─ Realms Postgres (1 replica only)
```

---

## Handoff query contract (Open → Realms)

| Param | Required | Meaning |
|-------|----------|---------|
| `sso_token` / `grudge_token` | for live play | Short-lived JWT from Grudge ID |
| `characterId` | yes for account avatar | Builder Postgres character UUID |
| `baseId` | default `explorer` | Voxel body form (explorer avatar) |
| `raceId` | optional | Race kit when not pure explorer |
| `mode` | recommended | `harvest` \| `drc` \| `combat` \| `free` \| `lobby` |
| `mapId` | map deploys | Self-hosted / promoted scene id |
| `room` | multiplayer | Room / join code |
| `open=1` | yes | Marks Open fleet handoff |
| `from` | yes | e.g. `gameopen` |

Hash routes: `#/lobby` · `#/play?mode=harvest&mapId=…` · `#/join/:code` · `#/defs`

### Example URLs

```
# Multiplayer lobby (account explorer)
https://mineloader.grudge-studio.com/?sso_token=…&characterId=…&baseId=explorer&mode=lobby&open=1&from=gameopen#/lobby

# Harvest on a deployed map
https://mineloader.grudge-studio.com/?sso_token=…&characterId=…&baseId=explorer&mode=harvest&mapId=SEED&open=1&from=gameopen#/play?mode=harvest&mapId=SEED

# DRC combat with account character
https://mineloader.grudge-studio.com/?sso_token=…&characterId=…&baseId=explorer&mode=drc&open=1&from=gameopen#/play?mode=drc
```

Open helpers: `mineLoaderLobbyUrl` · `mineLoaderHarvestUrl` · `mineLoaderDrcUrl` · `mineLoaderPlayUrl`  
(`artifacts/animator/src/lib/productionRuntime.ts`)

---

## Map promote path

1. Author on Open `/voxel` (or Mine-Loader setup).  
2. Export interchange (`blockEdits`, spawn, colliders).  
3. POST to Mine-Loader worlds API (authenticated).  
4. Launch `mineLoaderPlayUrl({ mapId, mode: "harvest" | "drc", characterId, token })`.  
5. Peers join via lobby room code — same world authority.

---

## DNS / deploy

```bash
# Play host (from gameopen)
cd D:/GitHub/gameopen/infra/cloudflare/mineloader
npx wrangler deploy
# → mineloader.grudge-studio.com custom domain

# Alias (from Mine-Loader monorepo)
cd D:/GitHub/minegrudge/Mine-Loader/infra/cloudflare/mine
npx wrangler deploy
# → mine.grudge-studio.com
```

Smoke:

```bash
curl -I https://mineloader.grudge-studio.com/
curl https://mineloader.grudge-studio.com/api/healthz
curl "https://mineloader.grudge-studio.com/api/blocks?limit=1"
```

---

## Labels (fleet channel matrix)

| Label | Role on this host |
|-------|-------------------|
| **fleet** | SPA satellite (Vercel + CF edge) |
| **R2** | Block icons / models from assets CDN when configured |
| **open** | Open library card `mine-loader-realms` + `/realms` collection |
| puter / embed | Not production Realms — use Open Danger L7 for scene-only playtest |
