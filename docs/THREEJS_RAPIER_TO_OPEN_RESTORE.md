# threejs-rapier → Open DRC restore

**Lab SSOT:** `C:\Users\nugye\Documents\threejs-rapier-react-three-controller`  
**Live lab:** https://threejs-rapier-react-three-controll.vercel.app/  
**Open product:** `C:\Users\nugye\Documents\gameopen` → open.grudge-studio.com

## What was restored (this pass)

| File | Source |
|------|--------|
| `Controller.ts` | **lab** (59 KB clean DRC move/camera) |
| `input.ts` | **lab** |
| Studio / grudge / fleet shell | Open (must stay for lobby/account/maps) |

Full Studio overwrite from lab **breaks** Open App (missing fleet APIs). Correct recovery is lab **Controller + input** first, then port Studio combat wiring file-by-file.

## Full replace (blocked by Open shell)

`FORCE_OVERWRITE=1 node scripts/ingest-threejs-rapier.mjs --code-only` copies lab three/components but Open `App.tsx` expects fleet Studio methods. Do not ship full lab Studio without an Open bridge.

## Next

1. Diff lab vs Open `Studio` combat/input sections only  
2. Port those sections without fleet bloat  
3. Keep `normalizeToGrudgeAvatarId` + `loadGrudge6CombatRig` hard gates  
