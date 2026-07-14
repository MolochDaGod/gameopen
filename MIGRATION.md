# Replit → Grudge Studio migration

## What the Replit example was

Live reference (Danger Room / animator):

`https://5e8ce733-3b10-4afe-be8b-323c6a5bcd5d-00-xdu2urc48h3w.riker.replit.dev/animator/`

That host is a **pnpm monorepo** with:

| Path | Role |
|------|------|
| `/animator/` | Danger Room combat + animation studio (Three.js + React HUD) |
| `/arpg-game/` | Survival ARPG client |
| `/game/` | Optional game shell |
| `/api/*` | Express + WebSocket (danger rooms, carrier, game) |

Source of truth for the animator artifact lived under Replit as
`artifacts/animator` (local mirror: `Documents/grudgecontroller`).

## What we migrated into `gameopen`

| Before (Replit) | After (Grudge fleet) |
|-----------------|----------------------|
| `@replit/vite-plugin-*` | Removed — plain Vite + React + Tailwind |
| Required `PORT` / `BASE_PATH` env | Defaults: `PORT=5173`, `BASE_PATH=/` |
| Clerk required to boot | **Grudge ID** (`id.grudge-studio.com`) + guest play; Clerk not fleet SSOT |
| Replit App Storage / proxy | Vercel rewrites → Railway + id.grudge-studio.com + ObjectStore |
| Thin public assets | Merged full gameopen pack (races, weapons, VFX, maps, 14 anim packs) |
| Single Replit process | **Vercel** SPA + **Railway** API/WS + optional **R2** |

## Improvements on the Replit baseline

1. **Fleet asset URLs** — `src/lib/fleet.ts` (`assetUrl`, `apiUrl`, `buildGrudgeLoginUrl`).
2. **Asset merge** — `pnpm assets:merge` pulls production GLB/FBX/icons into `artifacts/animator/public`.
3. **Path aliases** — minified + source clients both resolve striker / pirate / zombies.
4. **Co-located multiplayer** — api-server still attaches Danger + Carrier + space WS (liveservers pattern).
5. **No Replit lock-in** — builds on Vercel/Railway with standard Node 22.

## Local

```bash
corepack enable
pnpm install
pnpm assets:merge
pnpm --filter @workspace/animator-app dev   # http://localhost:5173
pnpm --filter @workspace/api-server build && pnpm start:api  # :8080
```

Optional env:

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_...   # enable Clerk shell
VITE_USE_R2=true
VITE_ASSET_BASE_URL=https://assets.grudge-studio.com/gameopen
BASE_PATH=/
PORT=5173
```

## Deploy

- **Frontend:** Vercel project `grudgenexus/gameopen` → https://gameopen.vercel.app  
- **API:** Railway `gameopen` → https://gameopen-production.up.railway.app  
- **GitHub:** https://github.com/MolochDaGod/gameopen  

## Still optional (recommended next)

1. Upload heavy models to R2 (`pnpm assets:upload-r2`) and set `VITE_USE_R2=true`.
2. Prefer Grudge ID only — do not re-enable Clerk as production login.
3. Keep `open.grudge-studio.com` Worker → Vercel (see `infra/cloudflare/open`).
4. Shared player data only via Railway `grudge-api-production` (see monorepo `docs/HOSTING_SCHEME.md` when co-located with Fantasy-Scene-Creator).
5. Sync hub/campfire deltas from Fantasy-Scene-Creator `charactersgrudox` when consolidating shells.
