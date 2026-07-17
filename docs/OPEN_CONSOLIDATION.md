# Open consolidates the threejs-rapier Animator suite

**Canonical product:** https://open.grudge-studio.com  
**Vercel alias:** https://gameopen.vercel.app  
**Legacy (do not ship new features here):** https://threejs-rapier-react-three-controll.vercel.app  

Open is the **single** Grudge Studio browser app for:

| Surface | Path | Source lineage |
|---------|------|----------------|
| **Login / landing** | `/login` | threejs-rapier LandingPage → fleet Grudge ID |
| **Library hub** | `/` | Steam-style DoorSelect + fleet posters |
| **Danger Room (animator combat)** | `/danger` | threejs-rapier Studio + epicfight |
| **Dressing Room / Animator** | `/dressing` | threejs-rapier EditorMode |
| **Avatar Editor** | `/avatar` | threejs-rapier AvatarEditMode (cube head) |
| **LED Mask** | `/ledmask` | threejs-rapier LedMask (right rail scroll-contained) |
| **Characters GRUDOX** | `/characters` | Campfire hub + hero handoff |
| **Account** | `/account` | Fleet characters, wallet, treaty |
| **Voxel / Realms / Genesis / Brawl** | `/voxel` `/realms` `/genesis` … | Open + Mine-Loader fleet |

## Auth (fleet best practices)

1. Prefer full-page `id.grudge-studio.com/login` with dual-write return params.  
2. Prefer `sso_token` session JWT; store under fleet keys.  
3. Characters SSOT = Builder Postgres (`/api/characters`).  
4. No parallel puter-only identity for Open surfaces.

## Asset hosting

- **SSOT:** same-origin `artifacts/animator/public/` (models/grudge, weapons, anim, audio, avatar, backdrops).  
- **Ingest from lab:** `node scripts/ingest-threejs-rapier.mjs` copies missing files from the threejs-rapier monorepo (never overwrites unless `FORCE_OVERWRITE=1`).  
- Prefer R2 via `VITE_ASSET_BASE_URL` / fleet resolver for fleet packs (grudge6 FBX, baked anims).  
- `vercel.json` may still proxy `/models/grudge/*`, `/models/weapons/*`, `/anim/*` to the legacy host as a **last-resort** fallback when a file is missing from the deploy.  
- **Do not** treat the legacy host as the product entry point or feature SSOT.

## LED Mask UI rule

Right control rail: **vertical scroll inside the rail only** (`overflow-x: hidden`, `max-height` + `overscroll-behavior: contain`). Never scroll the stage off-screen horizontally.

## Migration for deep links

| Old | New |
|-----|-----|
| `threejs-rapier…/?door=danger` | `https://open.grudge-studio.com/danger` |
| `…/?door=editor` | `/dressing` |
| `…/?door=ledmask` | `/ledmask` |
| `…/?door=avatar` | `/avatar` |
| `…/?door=characters` | `/characters` |
| `…/?door=landing` or bare `/` login | `/login` then hub |

## three.js practices (Open)

- Engine owns `WebGLRenderer` + loop; React is HUD only.  
- **Physics SSOT:** `@workspace/grudge-physics` (Rapier 0.19 + capsule KCC + optional mesh-bvh) — see [`WARLORDS_PHYSICS_SSOT.md`](./WARLORDS_PHYSICS_SSOT.md). Same stack for Danger Room, dungeon, island, zone, instance.  
- Character height via `fitCharacterHeight` (no 100× skinned AABB bug).  
- Hand mounts prefer Bip001 / mixamo L/R sockets for dual weapons.

## Ingest (threejs-rapier → Open)

```bash
# From gameopen root — pull missing public + source modules from local lab clone
node scripts/ingest-threejs-rapier.mjs
# Optional: THREEJS_RAPIER_ROOT=F:/GitHub/threejs-rapier-react-three-controller/...

# App.tsx is NOT auto-merged (Open owns GRUDOX / Realms / fleet modes).
# New lab components (LoadingScreen, DjStation, toolbox, …) land under src/
# and must be wired deliberately if you want them on a surface.
```

## Deploy

```bash
# gameopen repo
pnpm build   # or scripts/vercel-build.mjs
# Vercel project gameopen → open.grudge-studio.com (CF Worker edge)
# npm run deploy:prod
```

After deploy, smoke: `/login` → Grudge ID → `/` library → `/dressing` · `/avatar` · `/ledmask` · `/danger`.  
Confirm race GLBs are same-origin (not only legacy):  
`https://open.grudge-studio.com/models/grudge/western-kingdoms_warrior.glb`
