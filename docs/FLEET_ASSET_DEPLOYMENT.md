# Fleet asset deployment — textures, colors, production builds

## Problem we fixed

| Path on Open | Before | After |
|--------------|--------|-------|
| `/textures/grudge6/*` | **404** (no rewrite) | Vercel → `assets.grudge-studio.com` |
| `/models/grudge6/*` | **404** | Vercel → R2 |
| `/models/voxels/*` | missing | Vercel → R2 TVS GLBs |
| `/api/assets/*` | wrong `/gameopen/` prefix | R2 **root** |
| Load order | same-origin first → fail | **CDN-first** for grudge6 keys |

Without this, Danger Room race kits had wrong/missing **colors** (atlases never loaded) and broken modular meshes.

## Production architecture

```
[Browser game]
    │
    ├─ same-origin /textures/grudge6/*  ──rewrite──► assets.grudge-studio.com
    ├─ same-origin /models/grudge6/*    ──rewrite──► assets.grudge-studio.com
    ├─ same-origin /models/voxels/*     ──rewrite──► assets.grudge-studio.com
    ├─ same-origin /cdn/assets/characters/* ───────► grudge-arena (skinned GLB)
    ├─ same-origin /anims/baked/* ─────────────────► grudge-arena
    ├─ absolute https://assets.grudge-studio.com/* (CORS, CDN-first resolver)
    │
    ├─ /api/characters ──► Railway (account equipment / mesh_ids)
    └─ /api/objectstore ─► ObjectStore (gear presets, master-weaponSkills)
```

## Asset classes

| Class | Format | Texture / color | Build pipeline |
|-------|--------|-----------------|----------------|
| grudge6 races | FBX SSOT (+ arena GLB) | `textures/grudge6/{race}/*.webp` flipY=false | Unity Toon RTS → R2 webp |
| TVS voxel heroes | **GLB production** | atlas baked into GLB | `npm run convert:tvs` + `upload:tvs` |
| Weapons | GLB | materials in GLB | gltf-transform / lab pack |
| Icons | PNG/WebP | R2 `icons/pack` | ObjectStore / pack upload |
| Anim clips | JSON baked | n/a | arena `/anims/baked` |

## Color / texture contract (grudge6)

```ts
// loadBodyTexture / rebindRaceAtlas
texture.flipY = false
texture.colorSpace = SRGBColorSpace  // or encoding sRGB
texture.wrapS = texture.wrapT = ClampToEdge
MeshStandardMaterial({ map, color: 0xffffff, metalness: 0, roughness: 0.75 })
```

## Deploy checklist (Open / Danger Room)

```bash
# 1) Verify CDN truth
cd F:\GitHub\gameopen
node scripts/verify-fleet-assets.mjs --cdn-only

# 2) After vercel.json rewrite changes, deploy Open
# (Vercel git integration on MolochDaGod/gameopen → open.grudge-studio.com)

# 3) Verify same-origin proxies
node scripts/verify-fleet-assets.mjs --base https://open.grudge-studio.com
node scripts/verify-fleet-assets.mjs --base https://gameopen.vercel.app

# 4) Smoke Danger Room
# - Sign in → character with race
# - Console: race kit FBX ready, atlas loaded, equip=account|preset
# - Visual: race colors (not pink/black), single body mesh set
```

## VoxGrudge

```bash
cd F:\GitHub\voxgrudge
npm run convert:tvs      # bake heroes 2.0m + atlas
npm run upload:tvs       # R2 models/voxels/tvs
npm run verify:assets:cdn
```

`vercel.json` already proxies `/api/assets` → R2 root; TVS loader uses absolute CDN + same-origin mirror under `models/voxels/tvs/`.

## Runtime loaders (must stay aligned)

| Game | Config |
|------|--------|
| Open | `fleetAssetResolver.ts` CDN-first for grudge6 |
| Open | `raceAssets.ts` absolute CDN URLs |
| Open | `grudge6Runtime` FBX then arena GLB + atlas rebind |
| VoxGrudge | `grudge-asset-config.js` `useR2()` live default |
| VoxGrudge | `tvs-unit-loader.js` GLB-first production |

## Never

- Point `/api/assets` only at `…/gameopen/` prefix for fleet-wide keys  
- Prefer same-origin for `textures/grudge6` before rewrite exists  
- Use `flipY: true` on Toon RTS atlases  
- Ship raw Unity `.asset` / unbaked FBX-only without atlas rebind for web  

## Related

- `docs/UMMORPG_ENGINE_PRACTICES.md` — sockets, prefabs, skills  
- `content/docs/UMMORPG_ADOPTION.md` — skill catalog  
- grudge-asset-convert skill — FBX→GLB bake  
- grudge-fleet skill — domain map  
