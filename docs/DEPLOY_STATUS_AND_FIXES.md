# Deploy status & failed-build recovery (2026-08-03)

## Live health (probed)

| Service | Host | Status |
|---------|------|--------|
| Open SPA | https://open.grudge-studio.com | **200** (Vercel Ready) |
| Open API | https://gameopen-production.up.railway.app/api/healthz | **ok** (redeployed) |
| Mine-Loader SPA | https://mine.grudge-studio.com · mineloader.grudge-studio.com | **200** (Vercel Ready) |
| Mine-Loader API | https://mine-loader-api-production.up.railway.app/api/healthz | **ok** (redeployed) |
| GRUDOX room | https://voxgrudge-grudox-room-production.up.railway.app/api/health | **ok** |
| Grudge API | https://grudge-api-production-0d46.up.railway.app/api/health | **ok** |

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
