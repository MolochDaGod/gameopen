# Zones in-app play — controllers, D1, postfx, 2D gore

**Live:** https://open.grudge-studio.com/zones

## Policy

Games from the GRUDOX library **play inside Open**:

1. **Native Open engine** when available (`/danger`, `/brawl`, `/survival`, `/genesis`, `/world`, `/realms`)
2. Else **in-app iframe canvas** with SSO handoff (`InAppGameCanvas`)
3. **Pop out** only as secondary

## Stack per native combat zone

| Layer | Implementation |
| --- | --- |
| Controller | Danger Room `InputState` + `Controller` (Brawler/Studio) |
| Postprocessing | `createMysticalComposer` (bloom, vignette, grain, ACES) |
| 3D impact | `Vfx.impact` ground burst + fresnel |
| **2D gore** | `GoreImpact2D` — CDN slash/effect sprites, blood + impact layers |
| D1 | `d1AssetRegistry` → `api.grudge-studio.com/assets` (or `/api/asset-registry`) warm on play |

## 2D gore / impact assets

CDN (always available):

- `icons/pack/misc/Slash_07.png`
- `icons/pack/misc/Effect.png`
- `icons/pack/misc/Flow.png`

Used as camera-facing planes on hit (`goreImpact2d.ts`), tinted crimson for blood, warm white/additive for energy impact.

## Code map

| File | Role |
| --- | --- |
| `lib/zoneGamePlay.ts` | Per-zone play profiles |
| `lib/d1AssetRegistry.ts` | D1 registry fetch + gore sprite URLs |
| `three/fx/goreImpact2d.ts` | 2D billboard bursts |
| `three/Vfx.ts` | impact() calls gore; optional camera bind |
| `three/brawler/BrawlerScene.ts` | postfx + impact on damage |
| `three/Studio.ts` | hit/crit/stagger → impact+gore |
| `components/InAppGameCanvas.tsx` | D1 warm, gamepad/pointer-lock, host postMessage |
| `components/GrudoxZones.tsx` | Play in Open labels + profile tags |

## Deploy notes

- Commit `vercel.json` rewrite: `/api/asset-registry` → `api.grudge-studio.com/assets`
- Gore sprites need no R2 upload (icons already on CDN)
