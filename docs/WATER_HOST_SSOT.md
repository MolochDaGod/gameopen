# Water host SSOT — Warlords home island

**Canonical production URL:** https://water.grudge-studio.com/  
**Island path:** https://water.grudge-studio.com/island  

## What is fleet

| Item | Value |
|------|--------|
| Product | Warlords water / home-island SPA (Three.js + R3F) |
| Live host | **water.grudge-studio.com** |
| Assets | assets.grudge-studio.com (R2) + D1 registry |
| Characters | Railway via same-origin rewrites on that SPA |
| Source tree | Often still named `Tactical-Infinity` on disk/GitHub — **name is legacy** |

## What is NOT fleet

| Host | Status |
|------|--------|
| `https://tactical-infinity.vercel.app` | **Orphaned** — not our production product; do not link from Open library or docs as live |
| Old **Replit** TI / water URLs | **Dead** — removed from production; do not restore |
| Babylon `grudgeworld-action-rpg` | Separate archive; not water SPA |

## Open library

One card: **Warlords Home Island (Water)** → `FLEET_WORLD_HOSTS.waterIsland`  
Code: `artifacts/animator/src/lib/fleetWorlds.ts` · `game/gameLibrary.ts`

## Agent rule

If a task says “Tactical Infinity” or “TI island”, resolve to **water.grudge-studio.com** unless the user explicitly asks about the legacy repo name or archive hosts.
