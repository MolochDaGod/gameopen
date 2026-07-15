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

- Prefer same-origin `public/` or R2 via `VITE_ASSET_BASE_URL` / `assetHost.ts`.  
- Temporary CDN rewrites in `vercel.json` may still proxy heavy `/models/*` and `/anim/*` from the legacy Vercel host until assets are fully mirrored under Open/R2.  
- **Do not** treat the legacy host as the product entry point.

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
- Rapier for production physics where used.  
- Character height via `fitCharacterHeight` (no 100× skinned AABB bug).  
- Hand mounts prefer Bip001 / mixamo L/R sockets for dual weapons.

## Deploy

```bash
# gameopen repo
pnpm build   # or scripts/vercel-build.mjs
# Vercel project gameopen → open.grudge-studio.com (CF Worker edge)
```

After deploy, smoke: `/login` → Grudge ID → `/` library → `/dressing` · `/avatar` · `/ledmask` · `/danger`.
